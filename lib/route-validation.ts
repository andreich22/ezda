export type Point = [number, number];

export type RouteFeature = {
  type: "Feature";
  properties?: Record<string, unknown>;
  geometry: {type: "LineString"; coordinates: number[][]};
};

export type CreateRouteInput = {
  title: string;
  description: string | null;
  geometry: RouteFeature;
  distanceMeters: number;
  durationSeconds: number | null;
  elevationGainMeters: number | null;
  isPublic: boolean;
  waypoints?: Point[];
};

const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_COORDINATES = 10_000;
const MAX_WAYPOINTS = 500;
const MAX_DISTANCE_METERS = 100_000_000;
const MAX_DURATION_SECONDS = 31_536_000;
const MAX_ELEVATION_GAIN_METERS = 10_000_000;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export function parseCreateRouteInput(body: unknown): CreateRouteInput | {error: string} {
  if (!body || typeof body !== "object") return {error: "invalid request body"};

  const value = body as Record<string, unknown>;
  if (typeof value.title !== "string") return {error: "title is required"};

  const title = value.title.trim();
  if (!title) return {error: "title is required"};
  if (title.length > MAX_TITLE_LENGTH) {
    return {error: "title must be 120 characters or fewer"};
  }

  let description: string | null = null;
  if (value.description != null) {
    if (typeof value.description !== "string") return {error: "description must be a string"};
    description = value.description.trim() || null;
    if (description && description.length > MAX_DESCRIPTION_LENGTH) {
      return {error: "description must be 2000 characters or fewer"};
    }
  }

  let isPublic = true;
  if (value.visibility != null) {
    if (value.visibility !== "public" && value.visibility !== "private") {
      return {error: "visibility must be public or private"};
    }
    isPublic = value.visibility === "public";
  }
  if (value.isPublic != null) {
    if (typeof value.isPublic !== "boolean") return {error: "isPublic must be a boolean"};
    if (value.visibility != null && value.isPublic !== isPublic) {
      return {error: "visibility and isPublic must agree"};
    }
    isPublic = value.isPublic;
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
  if (line.coordinates.length > MAX_COORDINATES) {
    return {error: "geometry must contain 10000 coordinates or fewer"};
  }

  const coordinates: number[][] = [];
  for (const coordinate of line.coordinates) {
    if (
      !Array.isArray(coordinate) ||
      coordinate.length < 2 ||
      coordinate.length > 3 ||
      !isFiniteNumber(coordinate[0]) ||
      !isFiniteNumber(coordinate[1]) ||
      coordinate[0] < -180 ||
      coordinate[0] > 180 ||
      coordinate[1] < -90 ||
      coordinate[1] > 90
    ) {
      return {error: "geometry contains invalid coordinates"};
    }
    if (coordinate.length === 3 && !isFiniteNumber(coordinate[2])) {
      return {error: "geometry contains invalid elevation coordinates"};
    }
    coordinates.push([coordinate[0], coordinate[1]]);
  }

  const distanceMeters = value.distanceMeters;
  if (!isFiniteNumber(distanceMeters) || distanceMeters < 0 || distanceMeters > MAX_DISTANCE_METERS) {
    return {error: "distanceMeters must be between 0 and 100000000"};
  }

  const durationSeconds = value.durationSeconds;
  if (
    durationSeconds != null &&
    (!isFiniteNumber(durationSeconds) || durationSeconds < 0 || durationSeconds > MAX_DURATION_SECONDS)
  ) {
    return {error: "durationSeconds must be between 0 and 31536000"};
  }

  const elevationGainMeters = value.elevationGainMeters;
  if (
    elevationGainMeters != null &&
    (!isFiniteNumber(elevationGainMeters) ||
      elevationGainMeters < 0 ||
      elevationGainMeters > MAX_ELEVATION_GAIN_METERS)
  ) {
    return {error: "elevationGainMeters must be between 0 and 10000000"};
  }

  let waypoints: Point[] | undefined = undefined;
  if (value.waypoints != null) {
    if (!Array.isArray(value.waypoints)) return {error: "waypoints must be an array of [lon, lat]"};
    if (value.waypoints.length > MAX_WAYPOINTS) {
      return {error: "waypoints must contain 500 points or fewer"};
    }
    const parsedWaypoints: Point[] = [];
    for (const waypoint of value.waypoints) {
      if (
        !Array.isArray(waypoint) ||
        waypoint.length < 2 ||
        !isFiniteNumber(waypoint[0]) ||
        !isFiniteNumber(waypoint[1]) ||
        waypoint[0] < -180 ||
        waypoint[0] > 180 ||
        waypoint[1] < -90 ||
        waypoint[1] > 90
      ) {
        return {error: "waypoints contain invalid coordinates"};
      }
      parsedWaypoints.push([waypoint[0], waypoint[1]]);
    }
    waypoints = parsedWaypoints;
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
    isPublic,
    waypoints,
  };
}
