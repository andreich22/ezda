"use client";
import { useEffect, useRef, useState } from "react";
import { pushHistory, undoHistory } from "../lib/route-history";
import { invalidateRouteCatalogCache } from "../lib/route-catalog-cache";
import { friendlyRoutingError, friendlySaveError } from "../lib/route-error-messages";
import { LngLatBounds, Map, Marker, NavigationControl, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

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
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const visibility = initialIsPublic ?? true;
  const historyRef = useRef<Point[][]>([]);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    const map = mapRef.current;
    if (!map) return;
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

  function clearRoute() {
    if (!points.length) return;
    historyRef.current = pushHistory(historyRef.current, points);
    reset(false);
    showActionFeedback("Route cleared");
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
          ...(isEditMode ? {isPublic: visibility} : {}),
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
