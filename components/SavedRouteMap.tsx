"use client";

import {useEffect, useRef} from "react";
import {LngLatBounds, Map, NavigationControl, setWorkerUrl} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

type Props = {
  geometry: {
    type: "Feature";
    properties?: Record<string, unknown>;
    geometry: {type: "LineString"; coordinates: number[][]};
  };
};

export default function SavedRouteMap({geometry}: Props) {
  const mapRef = useRef<Map | null>(null);

  useEffect(() => {
    setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
    const map = new Map({
      container: "saved-route-map",
      style: {
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
      } as any,
      center: geometry.geometry.coordinates[0] as [number, number],
      zoom: 12,
      attributionControl: {},
    });

    map.addControl(new NavigationControl({showCompass: true}), "top-right");

    const routeData = {
      type: "FeatureCollection",
      features: [geometry],
    };

    const draw = () => {
      if (!map.getSource("route")) {
        map.addSource("route", {type: "geojson", data: routeData as any});
        map.addLayer({
          id: "route-casing",
          type: "line",
          source: "route",
          layout: {"line-cap": "round", "line-join": "round"},
          paint: {"line-color": "#fff", "line-width": 10},
        });
        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          layout: {"line-cap": "round", "line-join": "round"},
          paint: {"line-color": "#e63946", "line-width": 6},
        });
      }

      const coordinates = geometry.geometry.coordinates;
      const bounds = coordinates.reduce(
        (result: LngLatBounds, coordinate) => result.extend([coordinate[0], coordinate[1]]),
        new LngLatBounds(
          coordinates[0] as [number, number],
          coordinates[0] as [number, number],
        ),
      );
      map.fitBounds(bounds, {padding: 50, duration: 0, maxZoom: 15});
    };

    if (map.isStyleLoaded()) draw();
    else map.once("idle", draw);

    mapRef.current = map;
    return () => {
      mapRef.current = null;
      map.remove();
    };
  }, [geometry]);

  return <div id="saved-route-map" className="saved-route-map" aria-label="Saved route map" />;
}
