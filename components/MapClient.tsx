"use client";
import { useEffect, useRef, useState } from "react";
import { Map, Marker, NavigationControl } from "maplibre-gl";
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
    const map = new Map({
      container: "map-host",
      style: osmStyle as any,
      center: [-74.006, 40.7128],
      zoom: 11,
      attributionControl: true,
    });

    map.addControl(new NavigationControl({ showCompass: true }), "top-right");

    map.on("error", (event) => {
      const message = event?.error?.message || "Map tiles failed to load";
      setError(`Map error: ${message}`);
    });

    map.on("click", (e) => {
      setError("");
      setRoute(null);
      setPoints((prev) =>
        prev.length >= 2
          ? [[e.lngLat.lng, e.lngLat.lat]]
          : [...prev, [e.lngLat.lng, e.lngLat.lat]],
      );
    });

    mapRef.current = map;
    return () => map.remove();
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markers.current.forEach((m) => m.remove());
    markers.current = points.map((p, i) =>
      new Marker({ color: i === 0 ? "#111" : "#d33" })
        .setLngLat(p)
        .addTo(map),
    );

    if (points.length === 2) buildRoute(points[0], points[1]);
  }, [points]);

  async function buildRoute(a: Point, b: Point) {
    try {
      const r = await fetch("/api/route", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ start: a, end: b }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Routing failed");

      setRoute(data);
      const map = mapRef.current;
      if (!map || !data.geometry) return;

      const drawRoute = () => {
        if (map.getSource("route")) {
          (map.getSource("route") as any).setData(data.geometry);
          return;
        }

        map.addSource("route", { type: "geojson", data: data.geometry });
        map.addLayer({
          id: "route-casing",
          type: "line",
          source: "route",
          paint: {
            "line-color": "#ffffff",
            "line-width": 9,
            "line-opacity": 0.9,
          },
        });
        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          paint: {
            "line-color": "#e63946",
            "line-width": 5,
            "line-opacity": 1,
          },
        });
      };

      if (map.isStyleLoaded()) {
        drawRoute();
      } else {
        map.once("load", drawRoute);
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

      <div className="hint">
        {points.length === 0
          ? "Click the map to set a start point."
          : points.length === 1
            ? "Click the map again to set the destination."
            : "Route built. Reset to start again."}
      </div>

      {error && <div className="error">{error}</div>}
    </>
  );
}
