"use client";
import { useEffect, useRef, useState } from "react";
import { pushHistory, removePointAt, undoHistory } from "../lib/route-history";
import { invalidateRouteCatalogCache } from "../lib/route-catalog-cache";
import { friendlyRoutingError, friendlySaveError } from "../lib/route-error-messages";
import { LngLatBounds, Map, Marker, NavigationControl, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  LAYER_CACHE_SIZE,
  OVERPASS_TIMEOUT_MS,
  bboxKey,
  bboxOfCoordinates,
  describeOverpassFailure,
  isBboxTooLarge,
  requestBikeLayers,
  type LayerFeature,
} from "../lib/bike-map-overpass";
import {
  createLayerState,
  layerNeedsNotice,
  legendFor,
  type BikeMapLayerState,
} from "../lib/bike-map-layers";

type Point = [number, number];

type MapClientProps = {
  initialPoints?: Point[];
  initialTitle?: string;
  initialDescription?: string;
  initialIsPublic?: boolean;
  editRouteId?: string;
};

const osmStyle = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "osm",
      type: "raster",
      source: "osm",
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

interface BikeLayerDef {
  id: string;
  source: "bike-infra" | "bike-surface";
  filter: (string | string[])[];
  color: string;
  width: number;
  dash?: number[];
}

const BIKE_LAYER_DEFS: BikeLayerDef[] = [
  {id: "bike-infra-cycleway", source: "bike-infra", filter: ["==", ["get", "kind"], "cycleway"], color: "#0f766e", width: 5},
  {id: "bike-infra-lane", source: "bike-infra", filter: ["==", ["get", "kind"], "lane"], color: "#14b8a6", width: 3},
  {id: "bike-infra-designated", source: "bike-infra", filter: ["==", ["get", "kind"], "designated"], color: "#14b8a6", width: 3, dash: [2, 2]},
  {id: "bike-surface-asphalt", source: "bike-surface", filter: ["==", ["get", "surface"], "asphalt"], color: "#16a34a", width: 4},
  {id: "bike-surface-unpaved", source: "bike-surface", filter: ["==", ["get", "surface"], "unpaved"], color: "#d97706", width: 4, dash: [2, 2]},
  {id: "bike-surface-other", source: "bike-surface", filter: ["==", ["get", "surface"], "paved-other"], color: "#6b7280", width: 4, dash: [4, 2]},
];

const INFRA_SWATCHES = [
  "swatch-infra-cycleway",
  "swatch-infra-lane",
  "swatch-infra-designated",
];

const SURFACE_SWATCHES = [
  "swatch-surface-asphalt",
  "swatch-surface-unpaved",
  "swatch-surface-other",
];

function featureCollection(features: LayerFeature[]) {
  return {type: "FeatureCollection", features};
}

function drawBikeLayers(
  map: Map,
  infra: LayerFeature[],
  surface: LayerFeature[],
  showInfra: boolean,
  showSurface: boolean,
) {
  const syncSource = (id: "bike-infra" | "bike-surface", features: LayerFeature[]) => {
    const existing = map.getSource(id) as {setData?: (data: unknown) => void} | undefined;
    if (existing?.setData) existing.setData(featureCollection(features));
    else map.addSource(id, {type: "geojson", data: featureCollection(features)} as never);
  };
  const ensureLayer = (def: BikeLayerDef) => {
    if (map.getLayer(def.id)) return;
    const paint: Record<string, unknown> = {
      "line-color": def.color,
      "line-width": def.width,
      "line-opacity": 0.9,
    };
    if (def.dash) paint["line-dasharray"] = def.dash;
    const layer = {
      id: def.id,
      type: "line",
      source: def.source,
      filter: def.filter,
      layout: {"line-cap": "round", "line-join": "round"},
      paint,
    };
    // Bike layers stay below the route line so the route remains visible.
    if (map.getLayer("route-casing")) map.addLayer(layer as never, "route-casing");
    else map.addLayer(layer as never);
  };
  const dropSource = (id: "bike-infra" | "bike-surface") => {
    for (const def of BIKE_LAYER_DEFS) {
      if (def.source === id && map.getLayer(def.id)) map.removeLayer(def.id);
    }
    if (map.getSource(id)) map.removeSource(id);
  };
  if (showInfra) {
    syncSource("bike-infra", infra);
    for (const def of BIKE_LAYER_DEFS) {
      if (def.source === "bike-infra") ensureLayer(def);
    }
  } else {
    dropSource("bike-infra");
  }
  if (showSurface) {
    syncSource("bike-surface", surface);
    for (const def of BIKE_LAYER_DEFS) {
      if (def.source === "bike-surface") ensureLayer(def);
    }
  } else {
    dropSource("bike-surface");
  }
}

function removeBikeLayers(map: Map | null) {
  if (!map) return;
  for (const def of BIKE_LAYER_DEFS) {
    if (map.getLayer(def.id)) map.removeLayer(def.id);
  }
  if (map.getSource("bike-infra")) map.removeSource("bike-infra");
  if (map.getSource("bike-surface")) map.removeSource("bike-surface");
}

export default function MapClient({
  initialPoints,
  initialTitle,
  initialDescription,
  initialIsPublic,
  editRouteId,
}: MapClientProps = {}) {
  const isEditMode = Boolean(editRouteId);
  const mapRef = useRef<Map | null>(null);
  const markers = useRef<Marker[]>([]);
  const [points, setPoints] = useState<Point[]>(() => [...(initialPoints ?? [])]);
  const [route, setRoute] = useState<any>(null);
  const [error, setError] = useState("");
  const [actionFeedback, setActionFeedback] = useState("");
  const [saveTitle, setSaveTitle] = useState(initialTitle ?? "");
  const [saveDescription, setSaveDescription] = useState(initialDescription ?? "");
  const [isPublic, setIsPublic] = useState(initialIsPublic ?? true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const historyRef = useRef<Point[][]>([]);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [infraLayer, setInfraLayer] = useState<BikeMapLayerState>(() =>
    createLayerState("cycling-infrastructure"),
  );
  const [surfaceLayer, setSurfaceLayer] = useState<BikeMapLayerState>(() =>
    createLayerState("surface"),
  );
  const layersCache = useRef(
    new globalThis.Map<string, {infra: LayerFeature[]; surface: LayerFeature[]}>(),
  );

  useEffect(() => {
    setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
    const map = new Map({
      container: "map-host",
      style: osmStyle as any,
      center: [37.6173, 55.7558],
      zoom: 11,
      attributionControl: {},
    });

    map.addControl(new NavigationControl({showCompass: true}), "top-right");

    map.on("error", (event) => {
      const message = event?.error?.message || "Map tiles failed to load";
      setError(`Map error: ${message}`);
    });

    map.on("click", (e) => {
      setError("");
      setRoute(null);
      setPoints((prev) => {
        historyRef.current = pushHistory(historyRef.current, prev);
        return [...prev, [e.lngLat.lng, e.lngLat.lat]];
      });
    });

    mapRef.current = map;
    const handleSidebarChange = () => map.resize();
    window.addEventListener("ezda:sidebar-change", handleSidebarChange);
    return () => {
      window.removeEventListener("ezda:sidebar-change", handleSidebarChange);
      map.remove();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markers.current.forEach((m) => m.remove());

    markers.current = points.map((p, i) => {
      const marker = new Marker({
        color: i === 0 ? "#111" : i === points.length - 1 ? "#d33" : "#f59e0b",
        draggable: true,
      })
        .setLngLat(p)
        .addTo(map);

      marker.on("dragend", () => {
        const lngLat = marker.getLngLat();
        setError("");
        setRoute(null);
        setPoints((prev) => {
          historyRef.current = pushHistory(historyRef.current, prev);
          const next = [...prev];
          next[i] = [lngLat.lng, lngLat.lat];
          return next;
        });
      });

      return marker;
    });

    if (points.length >= 2) buildRoute(points);
  }, [points]);

  useEffect(() => {
    const map = mapRef.current;
    const wantInfra = infraLayer.enabled;
    const wantSurface = surfaceLayer.enabled;
    if (!map || (!wantInfra && !wantSurface)) {
      removeBikeLayers(map);
      return;
    }
    const coordinates = route?.geometry?.geometry?.coordinates as
      | number[][]
      | undefined;
    if (!coordinates || coordinates.length < 2) {
      removeBikeLayers(map);
      return;
    }
    const bbox = bboxOfCoordinates(coordinates);
    if (!bbox) return;
    if (isBboxTooLarge(bbox)) {
      const notice =
        "This route covers a large area — bike layers stay off here to respect the shared data source.";
      if (wantInfra) setInfraLayer((s) => ({...s, data: "disabled", notice}));
      if (wantSurface) setSurfaceLayer((s) => ({...s, data: "disabled", notice}));
      removeBikeLayers(map);
      return;
    }
    const key = bboxKey(bbox);
    const applyFeatures = (infra: LayerFeature[], surface: LayerFeature[]) => {
      try {
        drawBikeLayers(map, infra, surface, wantInfra, wantSurface);
      } catch {
        const notice = "Couldn't display the bike layers. Try again.";
        if (wantInfra) setInfraLayer((s) => ({...s, data: "error", notice}));
        if (wantSurface) setSurfaceLayer((s) => ({...s, data: "error", notice}));
        return;
      }
      if (wantInfra) {
        setInfraLayer((s) => ({
          ...s,
          data: infra.length ? "ready" : "empty",
          notice: infra.length
            ? null
            : "No tagged cycleways, lanes or bicycle sections in this area. Missing data does not mean missing infrastructure.",
        }));
      }
      if (wantSurface) {
        setSurfaceLayer((s) => ({
          ...s,
          data: surface.length ? "ready" : "empty",
          notice: surface.length
            ? null
            : "No tagged surfaces in this area. Missing data only means it is not mapped.",
        }));
      }
    };
    const cached = layersCache.current.get(key);
    if (cached) {
      applyFeatures(cached.infra, cached.surface);
      return;
    }
    if (wantInfra) {
      setInfraLayer((s) => ({...s, data: "loading", notice: null}));
    }
    if (wantSurface) {
      setSurfaceLayer((s) => ({...s, data: "loading", notice: null}));
    }
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), OVERPASS_TIMEOUT_MS);
    requestBikeLayers(bbox, {signal: controller.signal})
      .then(({infra, surface}) => {
        if (cancelled) return;
        layersCache.current.set(key, {infra, surface});
        while (layersCache.current.size > LAYER_CACHE_SIZE) {
          const oldest = layersCache.current.keys().next();
          if (oldest.done) break;
          layersCache.current.delete(oldest.value);
        }
        applyFeatures(infra, surface);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const notice = describeOverpassFailure(error);
        if (wantInfra) setInfraLayer((s) => ({...s, data: "error", notice}));
        if (wantSurface) setSurfaceLayer((s) => ({...s, data: "error", notice}));
        removeBikeLayers(map);
      });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [route, infraLayer.enabled, surfaceLayer.enabled]);

  async function buildRoute(routePoints: Point[]) {
    try {
      const r = await fetch("/api/route", {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({points: routePoints}),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(friendlyRoutingError(data?.code));
      if (!data.geometry?.geometry?.coordinates?.length) {
        throw new Error(friendlyRoutingError(data?.code));
      }

      setRoute(data);
      const map = mapRef.current;
      if (!map) return;

      const routeFeature = {
        ...data.geometry,
        geometry: {
          ...data.geometry.geometry,
          coordinates: data.geometry.geometry.coordinates.map(
            (coordinate: number[]) => [coordinate[0], coordinate[1]],
          ),
        },
      };
      const routeData = {
        type: "FeatureCollection",
        features: [routeFeature],
      };

      const drawRoute = () => {
        try {
          const source = map.getSource("route") as any;

          if (source) {
            source.setData(routeData);
          } else {
            map.addSource("route", {type: "geojson", data: routeData as any});

            map.addLayer({
              id: "route-casing",
              type: "line",
              source: "route",
              layout: {"line-cap": "round", "line-join": "round"},
              paint: {
                "line-color": "#ffffff",
                "line-width": 10,
                "line-opacity": 0.95,
              },
            });

            map.addLayer({
              id: "route-line",
              type: "line",
              source: "route",
              layout: {"line-cap": "round", "line-join": "round"},
              paint: {
                "line-color": "#e63946",
                "line-width": 6,
                "line-opacity": 1,
              },
            });
          }

          const coordinates = routeFeature.geometry.coordinates as number[][];
          const lngLatBounds = coordinates.reduce(
            (bounds: any, coordinate: number[]) =>
              bounds.extend([coordinate[0], coordinate[1]]),
            new LngLatBounds(
              coordinates[0] as [number, number],
              coordinates[0] as [number, number],
            ),
          );
          map.fitBounds(lngLatBounds, {padding: 80, duration: 700, maxZoom: 15});
        } catch {
          setError("Couldn't display the route. Try again.");
        }
      };

      if (map.isStyleLoaded()) {
        drawRoute();
      } else {
        map.once("idle", drawRoute);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      setError(
        message.includes("Try again") ||
          message.includes("Check the") ||
          message.includes("sign in")
          ? message
          : friendlyRoutingError(undefined),
      );
    }
  }

  function reset(recordHistory = true) {
    if (recordHistory && points.length) historyRef.current = pushHistory(historyRef.current, points);
    setPoints([]);
    setRoute(null);
    setError("");
    setInfraLayer((s) => ({...s, data: "idle", notice: null}));
    setSurfaceLayer((s) => ({...s, data: "idle", notice: null}));
    const map = mapRef.current;
    if (!map) return;
    removeBikeLayers(map);
    if (map.getLayer("route-line")) map.removeLayer("route-line");
    if (map.getLayer("route-casing")) map.removeLayer("route-casing");
    if (map.getSource("route")) map.removeSource("route");
  }


  function showActionFeedback(message: string) {
    setActionFeedback(message);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => setActionFeedback(""), 2400);
  }

  function fitRoute() {
    const coordinates = route?.geometry?.geometry?.coordinates as number[][] | undefined;
    const map = mapRef.current;
    if (!map || !coordinates?.length) {
      showActionFeedback("No route to fit");
      return;
    }

    const bounds = coordinates.reduce(
      (result: LngLatBounds, coordinate: number[]) => result.extend([coordinate[0], coordinate[1]]),
      new LngLatBounds(
        coordinates[0] as [number, number],
        coordinates[0] as [number, number],
      ),
    );
    map.fitBounds(bounds, {padding: 80, duration: 500, maxZoom: 15});
    showActionFeedback("Map fitted to route");
  }

  function toggleInfraLayer() {
    setInfraLayer((s) =>
      s.enabled ? {...s, enabled: false, data: "idle", notice: null} : {...s, enabled: true},
    );
  }

  function toggleSurfaceLayer() {
    setSurfaceLayer((s) =>
      s.enabled ? {...s, enabled: false, data: "idle", notice: null} : {...s, enabled: true},
    );
  }

  function clearRoute() {
    if (!points.length) return;
    historyRef.current = pushHistory(historyRef.current, points);
    reset(false);
    showActionFeedback("Route cleared");
  }

  function removePoint(index: number) {
    if (index < 0 || index >= points.length) return;
    historyRef.current = pushHistory(historyRef.current, points);
    const next = removePointAt(points, index);
    setError("");
    setRoute(null);
    setPoints(next);
    if (next.length < 2) {
      const map = mapRef.current;
      if (map) {
        removeBikeLayers(map);
        if (map.getLayer("route-line")) map.removeLayer("route-line");
        if (map.getLayer("route-casing")) map.removeLayer("route-casing");
        if (map.getSource("route")) map.removeSource("route");
      }
    }
    showActionFeedback("Route point removed");
  }

  function undoLastAction() {
    const result = undoHistory(historyRef.current);
    if (!result.points) {
      showActionFeedback("Nothing to undo");
      return;
    }
    historyRef.current = result.history;
    setError("");
    setRoute(null);
    setPoints(result.points);
    showActionFeedback("Last route change undone");
  }

  async function saveRoute() {
    if (!route?.geometry) return;

    setSaving(true);
    setSaveError("");

    try {
      const response = await fetch(isEditMode ? `/api/routes/${editRouteId}` : "/api/routes", {
        method: isEditMode ? "PATCH" : "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({
          title: saveTitle,
          description: saveDescription,
          geometry: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: route.geometry.geometry.coordinates,
            },
          },
          distanceMeters: route.distanceMeters,
          durationSeconds: route.durationSeconds,
          elevationGainMeters: route.elevationGainMeters,
          waypoints: points,
          isPublic,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(friendlySaveError(data?.code));
      }

      invalidateRouteCatalogCache();
      window.location.assign(data.url);
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      setSaveError(
        message.includes("Try again") ||
          message.includes("Check the") ||
          message.includes("sign in") ||
          message.includes("too large") ||
          message.includes("permission") ||
          message.includes("not found")
          ? message
          : friendlySaveError(undefined),
      );
      setSaving(false);
    }
  }

  function locateMe() {
    if (!navigator.geolocation) {
      showActionFeedback("Location is not available");
      return;
    }

    showActionFeedback("Finding your location…");
    navigator.geolocation.getCurrentPosition(
      ({coords}) => {
        const map = mapRef.current;
        if (!map) return;
        map.flyTo({center: [coords.longitude, coords.latitude], zoom: Math.max(map.getZoom(), 14), duration: 500});
        showActionFeedback("Centered on your location");
      },
      () => showActionFeedback("Location permission was denied or unavailable"),
      {enableHighAccuracy: true, timeout: 8000, maximumAge: 30000},
    );
  }

  const durationMinutes = route?.durationSeconds != null
    ? Math.round(route.durationSeconds / 60)
    : null;
  const elevationCoordinates = route?.geometry?.geometry?.coordinates?.filter(
    (coordinate: number[]) => typeof coordinate[2] === "number",
  ) ?? [];
  const elevations = elevationCoordinates.map((coordinate: number[]) => coordinate[2]);
  const minElevation = elevations.length ? Math.min(...elevations) : 0;
  const maxElevation = elevations.length ? Math.max(...elevations) : 0;
  const elevationRange = Math.max(1, maxElevation - minElevation);

  return (
    <>
      <div className="quick-actions" aria-label="Map quick actions">
        <button className="quick-action" type="button" onClick={locateMe} aria-label="My location" title="My location">
          <span aria-hidden="true">⌖</span><span>Location</span>
        </button>
        <button className="quick-action" type="button" onClick={fitRoute} disabled={!route} aria-label="Fit route to map" title="Fit route to map">
          <span aria-hidden="true">⤢</span><span>Fit route</span>
        </button>
        <button className="quick-action" type="button" onClick={clearRoute} disabled={!points.length} aria-label="Clear route" title="Clear route">
          <span aria-hidden="true">×</span><span>Clear</span>
        </button>
        <button className="quick-action" type="button" onClick={undoLastAction} disabled={!historyRef.current.length} aria-label="Undo last action" title="Undo last action">
          <span aria-hidden="true">↶</span><span>Undo</span>
        </button>
      </div>
      {actionFeedback && <div className="action-feedback" role="status" aria-live="polite">{actionFeedback}</div>}

      <div className="route-summary">
        <div className="route-summary-title">Route</div>
        <div className="stat">
          <div className="card">
            <div className="label">Distance</div>
            <div className="value">
              {route ? (route.distanceMeters / 1000).toFixed(1) + " km" : "—"}
            </div>
          </div>
          <div className="card">
            <div className="label">Time</div>
            <div className="value">
              {durationMinutes != null
                ? durationMinutes >= 60
                  ? Math.floor(durationMinutes / 60) + " h " + (durationMinutes % 60) + " min"
                  : durationMinutes + " min"
                : "—"}
            </div>
          </div>
          <div className="card">
            <div className="label">Elevation gain</div>
            <div className="value">
              {route?.elevationGainMeters != null
                ? "↑ " + Math.round(route.elevationGainMeters) + " m"
                : "—"}
            </div>
          </div>
          <div className="card">
            <div className="label">Waypoints</div>
            <div className="value">{points.length || "—"}</div>
          </div>
        </div>
      </div>

      <div className="card layers-card">
        <div className="label">Map layers</div>
        <div className="visibility-toggle" role="group" aria-label="Map layers">
          <button
            type="button"
            className={"visibility-option" + (infraLayer.enabled ? " active" : "")}
            aria-pressed={infraLayer.enabled}
            onClick={toggleInfraLayer}
          >
            Bike lanes
          </button>
          <button
            type="button"
            className={"visibility-option" + (surfaceLayer.enabled ? " active" : "")}
            aria-pressed={surfaceLayer.enabled}
            onClick={toggleSurfaceLayer}
          >
            Surface
          </button>
        </div>
        {(infraLayer.enabled || surfaceLayer.enabled) && !route && (
          <div className="hint">Build a route first — layers load for the area around it.</div>
        )}
        {route && (infraLayer.data === "loading" || surfaceLayer.data === "loading") && (
          <div className="hint" role="status">Loading bike data…</div>
        )}
        {infraLayer.enabled && layerNeedsNotice(infraLayer) && infraLayer.notice && (
          <div className="hint">{infraLayer.notice}</div>
        )}
        {surfaceLayer.enabled && layerNeedsNotice(surfaceLayer) && surfaceLayer.notice && (
          <div className="hint">{surfaceLayer.notice}</div>
        )}
        {infraLayer.enabled && (
          <ul className="layer-legend" aria-label="Bike infrastructure legend">
            {legendFor("cycling-infrastructure").map((line, index) => (
              <li key={line}>
                {index < INFRA_SWATCHES.length && (
                  <span className={"swatch " + INFRA_SWATCHES[index]} aria-hidden="true" />
                )}
                <span>{line}</span>
              </li>
            ))}
          </ul>
        )}
        {surfaceLayer.enabled && (
          <ul className="layer-legend" aria-label="Surface legend">
            {legendFor("surface").map((line, index) => (
              <li key={line}>
                {index < SURFACE_SWATCHES.length && (
                  <span className={"swatch " + SURFACE_SWATCHES[index]} aria-hidden="true" />
                )}
                <span>{line}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="hint">
          Bike data: © OpenStreetMap contributors via Overpass API. Only mapped
          objects are shown — missing data does not mean missing infrastructure,
          and a marked lane says nothing about protection or safety.
        </div>
      </div>

      {elevations.length > 1 && (
        <div className="profile card">
          <div className="label">Elevation profile</div>
          <svg viewBox="0 0 300 90" className="profile-chart" role="img" aria-label="Elevation profile">
            <polyline
              points={elevations.map((elevation: number, index: number) => {
                const x = (index / (elevations.length - 1)) * 300;
                const y = 82 - ((elevation - minElevation) / elevationRange) * 68;
                return x + "," + y;
              }).join(" ")}
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="profile-scale">
            <span>{Math.round(minElevation)} m</span>
            <span>{Math.round(maxElevation)} m</span>
          </div>
        </div>
      )}

      <div className="waypoints card">
        <div className="label">Route points</div>
        {points.length === 0 ? (
          <div className="empty">No points yet</div>
        ) : (
          <ol>
            {points.map((point, index) => (
              <li key={point[0] + "-" + point[1] + "-" + index}>
                <span className={"point-dot " + (index === 0 ? "start" : index === points.length - 1 ? "finish" : "")} />
                <span>
                  <strong>
                    {index === 0 ? "Start" : index === points.length - 1 ? "Finish" : "Waypoint " + index}
                  </strong>
                  <small>{point[1].toFixed(5)}, {point[0].toFixed(5)}</small>
                </span>
                <button
                  type="button"
                  className="waypoint-remove"
                  onClick={() => removePoint(index)}
                  aria-label={"Remove " + (index === 0 ? "start" : index === points.length - 1 ? "finish" : "waypoint " + index) + " point"}
                  title="Remove point"
                >
                  <span aria-hidden="true">×</span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>

      {route && (
        <div className="save-route card">
          <div className="route-summary-title">{isEditMode ? "Save changes" : "Save route"}</div>
          <label className="field">
            <span className="label">Title</span>
            <input
              value={saveTitle}
              onChange={(event) => {
                setSaveTitle(event.target.value);
                setSaveError("");
              }}
              maxLength={120}
              placeholder="e.g. Prospect Park Loop"
              disabled={saving}
            />
          </label>
          <label className="field">
            <span className="label">Description</span>
            <textarea
              value={saveDescription}
              onChange={(event) => {
                setSaveDescription(event.target.value);
                setSaveError("");
              }}
              maxLength={2000}
              rows={3}
              placeholder="Add a short description (optional)"
              disabled={saving}
            />
          </label>
          <div className="field">
            <span className="label" id="route-visibility-label">Visibility</span>
            <div className="visibility-toggle" role="group" aria-labelledby="route-visibility-label">
              <button
                type="button"
                className={"visibility-option" + (isPublic ? " active" : "")}
                aria-pressed={isPublic}
                onClick={() => setIsPublic(true)}
                disabled={saving}
              >
                Public
              </button>
              <button
                type="button"
                className={"visibility-option" + (!isPublic ? " active" : "")}
                aria-pressed={!isPublic}
                onClick={() => setIsPublic(false)}
                disabled={saving}
              >
                Private
              </button>
            </div>
            <p className="hint visibility-hint">
              {isPublic
                ? "Public routes appear in the catalog and anyone with the link can view them."
                : "Private routes are visible only to you."}
            </p>
          </div>
          <button className="button" type="button" onClick={saveRoute} disabled={saving || !saveTitle.trim()}>
            {saving ? "Saving…" : isEditMode ? "Save changes" : "Save route"}
          </button>
          {saveError && <div className="error" role="alert">{saveError}</div>}
        </div>
      )}

      <button className="button" onClick={() => reset()} disabled={!points.length}>
        Reset route
      </button>

      {route?.source && <div className="hint">Routing: {route.source}</div>}

      <div className="hint">
        {points.length === 0
          ? "Click the map to set a start point."
          : points.length === 1
            ? "Click the map to add a destination or waypoint."
            : "Drag any point to adjust the route, or click to add another waypoint."}
      </div>

      {error && <div className="error">{error}</div>}
    </>
  );
}
