import type {EditableRoute} from "./db/routes";

export type Point = [number, number];

export type EditInitialState = {
  points: Point[];
  title: string;
  description: string;
  isPublic: boolean;
};

const MAX_EDIT_POINTS = 500;

function isValidLonLat(lon: unknown, lat: unknown): lon is number {
  return (
    typeof lon === "number" &&
    typeof lat === "number" &&
    Number.isFinite(lon) &&
    Number.isFinite(lat) &&
    lon >= -180 &&
    lon <= 180 &&
    lat >= -90 &&
    lat <= 90
  );
}

function cleanPoints(candidates: unknown): Point[] {
  if (!Array.isArray(candidates)) return [];
  const points: Point[] = [];
  for (const candidate of candidates) {
    if (Array.isArray(candidate) && isValidLonLat(candidate[0], candidate[1])) {
      points.push([candidate[0], candidate[1]]);
    }
  }
  return points;
}

function decimate(points: Point[], max: number): Point[] {
  if (points.length <= max) return points;
  const step = points.length / max;
  const result: Point[] = [];
  for (let i = 0; i < max; i += 1) {
    result.push(points[Math.floor(i * step)] as Point);
  }
  return result;
}

function pointsFromGeometry(geometry: GeoJSON.Geometry | null): Point[] {
  if (!geometry || geometry.type !== "LineString") return [];
  return decimate(cleanPoints((geometry as GeoJSON.LineString).coordinates), MAX_EDIT_POINTS);
}

export function toEditInitialState(route: EditableRoute): EditInitialState {
  const waypoints = cleanPoints(route.waypoints);
  return {
    points: waypoints.length > 0 ? waypoints : pointsFromGeometry(route.geometry.geometry),
    title: route.title,
    description: route.description ?? "",
    isPublic: route.isPublic,
  };
}
