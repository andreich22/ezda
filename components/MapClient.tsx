"use client";
import { useEffect, useRef, useState } from "react";
import { LngLatBounds, Map, Marker, NavigationControl, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

type Point = [number, number];

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

export default function MapClient() {
  const mapRef = useRef<Map | null>(null);
  const markers = useRef<Marker[]>([]);
  const [points, setPoints] = useState<Point[]>([]);
  const [route, setRoute] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
    const map = new Map({
      container: "map-host",
      style: osmStyle as any,
      center: [-74.006, 40.7128],
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
      setPoints((prev) => [...prev, [e.lngLat.lng, e.lngLat.lat]]);
    });

    mapRef.current = map;
    return () => map.remove();
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
      if (!r.ok) throw new Error(data.error || "Routing failed");
      if (!data.geometry?.geometry?.coordinates?.length) {
        throw new Error("Routing service returned no route geometry");
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
        } catch (drawError) {
          setError(
            drawError instanceof Error
              ? `Route drawing failed: ${drawError.message}`
              : "Route drawing failed",
          );
        }
      };

      if (map.isStyleLoaded()) {
        drawRoute();
      } else {
        map.once("idle", drawRoute);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Routing failed");
    }
  }

  function reset() {
    setPoints([]);
    setRoute(null);
    setError("");
    const map = mapRef.current;
    if (!map) return;
    if (map.getLayer("route-line")) map.removeLayer("route-line");
    if (map.getLayer("route-casing")) map.removeLayer("route-casing");
    if (map.getSource("route")) map.removeSource("route");
  }

  return (
    <>
      <div className="stat">
        <div className="card">
          <div className="label">Distance</div>
          <div className="value">
            {route ? `${(route.distanceMeters / 1000).toFixed(1)} km` : "—"}
          </div>
        </div>
        <div className="card">
          <div className="label">Elevation</div>
          <div className="value">
            {route?.elevationGainMeters != null
              ? `${Math.round(route.elevationGainMeters)} m`
              : "—"}
          </div>
        </div>
      </div>

      <button className="button" onClick={reset} disabled={!points.length}>
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
