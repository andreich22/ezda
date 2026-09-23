export type Point = [number, number];

export type RouteFeature = {
  type: "Feature";
  properties?: Record<string, unknown>;
  geometry: {
    type: "LineString";
    coordinates: number[][];
  };
};

export type CreateRouteInput = {
  title: string;
  description: string | null;
  geometry: RouteFeature;
  distanceMeters: number;
  durationSeconds: number | null;
  elevationGainMeters: number | null;
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export function parseCreateRouteInput(body: unknown): CreateRouteInput | { error: string } {
  if (!body || typeof body !== "object") return {error: "invalid request body"};

  const value = body as Record<string, unknown>;
  if (typeof value.title !== "string") return {error: "title is required"};

  const title = value.title.trim();
  if (!title) return {error: "title is required"};
  if (title.length > 120) return {error: "title must be 120 characters or fewer"};

  let description: string | null = null;
  if (value.description != null) {
    if (typeof value.description !== "string") return {error: "description must be a string"};
    description = value.description.trim() || null;
    if (description && description.length > 2000) {
      return {error: "description must be 2000 characters or fewer"};
    }
  }

  const geometry = value.geometry;
  if (!geometry || typeof geometry !== "object") return {error: "geometry is required"};

  const geometryValue = geometry as Record<string, unknown>;
  if (geometryValue.type !== "Feature") return {error: "geometry must be a GeoJSON Feature"};

  const featureGeometry = geometryValue.geometry;
  if (!featureGeometry || typeof featureGeometry !== "object") {
    return {error: "geometry must contain a LineString"};
  }

  const line = featureGeometry as Record<string, unknown>;
  if (line.type !== "LineString") return {error: "geometry must be a LineString"};

  if (!Array.isArray(line.coordinates) || line.coordinates.length < 2) {
    return {error: "geometry must contain at least two coordinates"};
  }

  const coordinates: number[][] = [];
  for (const coordinate of line.coordinates) {
    if (
      !Array.isArray(coordinate) ||
      coordinate.length < 2 ||
      !isFiniteNumber(coordinate[0]) ||
      !isFiniteNumber(coordinate[1]) ||
      coordinate[0] < -180 ||
      coordinate[0] > 180 ||
      coordinate[1] < -90 ||
      coordinate[1] > 90
    ) {
      return {error: "geometry contains invalid coordinates"};
    }
    coordinates.push([coordinate[0], coordinate[1]]);
  }

  const distanceMeters = value.distanceMeters;
  if (!isFiniteNumber(distanceMeters) || distanceMeters < 0) {
    return {error: "distanceMeters must be a non-negative number"};
  }

  const durationSeconds = value.durationSeconds;
  if (durationSeconds != null && (!isFiniteNumber(durationSeconds) || durationSeconds < 0)) {
    return {error: "durationSeconds must be a non-negative number"};
  }

  const elevationGainMeters = value.elevationGainMeters;
  if (
    elevationGainMeters != null &&
    (!isFiniteNumber(elevationGainMeters) || elevationGainMeters < 0)
  ) {
    return {error: "elevationGainMeters must be a non-negative number"};
  }

  return {
    title,
    description,
    geometry: {
      type: "Feature",
      properties: {},
      geometry: {type: "LineString", coordinates},
    },
    distanceMeters,
    durationSeconds: durationSeconds ?? null,
    elevationGainMeters: elevationGainMeters ?? null,
  };
}
