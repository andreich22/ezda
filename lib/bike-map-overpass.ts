// Bicycle infrastructure + surface data via OpenStreetMap Overpass API (#203).
//
// Read-only, keyless, browser-side: no secrets, no backend load. One query
// per route bounding box, aborted when superseded, cached in memory.
// Any failure disables the layer with a notice — routing is never blocked.
// Unknown (untagged) data is never presented as absence of infrastructure.

export const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
export const OVERPASS_TIMEOUT_MS = 20_000;
/** Route bbox padding in degrees (~1.1 km at the equator). */
export const BBOX_PAD_DEG = 0.01;
/** Refuse bbox spans larger than this (degrees) to protect fair use. */
export const MAX_BBOX_SPAN_DEG = 0.5;
/** Rounded-bbox cache precision in degrees (~110 m). */
export const BBOX_KEY_PRECISION = 3;
/** Cap for the in-memory bbox cache (oldest entries evicted first). */
export const LAYER_CACHE_SIZE = 8;

export interface OverpassBbox {
  south: number;
  west: number;
  north: number;
  east: number;
}

export type InfraKind = "cycleway" | "lane" | "designated";

export type SurfaceCategory = "asphalt" | "unpaved" | "paved-other" | "unknown";

export interface LayerFeature {
  type: "Feature";
  properties: {
    kind?: InfraKind;
    surface: SurfaceCategory;
  };
  geometry: {
    type: "LineString";
    coordinates: [number, number][];
  };
}

interface OverpassGeometryPoint {
  lat: number;
  lon: number;
}

export interface OverpassWay {
  type: "way";
  id: number;
  tags?: Record<string, string>;
  geometry?: OverpassGeometryPoint[];
}

interface OverpassResponse {
  elements?: OverpassWay[];
}

export function bboxOfCoordinates(
  coordinates: readonly (readonly number[])[],
  pad: number = BBOX_PAD_DEG,
): OverpassBbox | null {
  const valid = coordinates.filter(
    (c): c is readonly [number, number] =>
      Array.isArray(c) &&
      c.length >= 2 &&
      typeof c[0] === "number" &&
      typeof c[1] === "number" &&
      Number.isFinite(c[0]) &&
      Number.isFinite(c[1]),
  );
  if (valid.length === 0) return null;
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [lon, lat] of valid) {
    if (lon < west) west = lon;
    if (lon > east) east = lon;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }
  return {
    south: Math.max(-90, south - pad),
    west: Math.max(-180, west - pad),
    north: Math.min(90, north + pad),
    east: Math.min(180, east + pad),
  };
}

export function isBboxTooLarge(
  bbox: OverpassBbox,
  maxSpan: number = MAX_BBOX_SPAN_DEG,
): boolean {
  return bbox.north - bbox.south > maxSpan || bbox.east - bbox.west > maxSpan;
}

export function bboxKey(
  bbox: OverpassBbox,
  precision: number = BBOX_KEY_PRECISION,
): string {
  const fix = (n: number) => n.toFixed(precision);
  return `${fix(bbox.south)},${fix(bbox.west)},${fix(bbox.north)},${fix(bbox.east)}`;
}

export function formatBbox(bbox: OverpassBbox): string {
  const fix = (n: number) => n.toFixed(5);
  // Overpass order: south,west,north,east.
  return `${fix(bbox.south)},${fix(bbox.west)},${fix(bbox.north)},${fix(bbox.east)}`;
}

export function buildOverpassQuery(bbox: OverpassBbox): string {
  const area = formatBbox(bbox);
  return `[out:json][timeout:25];
(
  way["highway"="cycleway"](${area});
  way["cycleway"](${area});
  way["cycleway:left"](${area});
  way["cycleway:right"](${area});
  way["bicycle"="designated"](${area});
  way["highway"]["surface"](${area});
);
out geom;`;
}

/**
 * Classify bicycle relevance from OSM tags. Returns null when the way has
 * no usable cycling tags — callers must treat null as "unknown", never as
 * "no infrastructure". Never infers protection level.
 */
export function classifyInfraKind(
  tags: Record<string, string | undefined> | undefined,
): InfraKind | null {
  if (!tags) return null;
  if (tags.highway === "cycleway") return "cycleway";
  for (const key of ["cycleway", "cycleway:both", "cycleway:left", "cycleway:right"]) {
    const value = tags[key];
    if (!value || value === "no" || value === "separate") continue;
    if (value.includes("track")) return "cycleway";
    if (value.includes("lane")) return "lane";
    // Any other explicit cycleway=* value (e.g. crossing) is a relevant
    // bicycle section, but not a lane or a track.
    return "designated";
  }
  if (tags.bicycle === "designated") return "designated";
  return null;
}

const UNPAVED_SURFACES = new Set([
  "unpaved",
  "gravel",
  "fine_gravel",
  "ground",
  "grass",
  "dirt",
  "earth",
  "sand",
  "mud",
  "clay",
  "compacted",
]);

const PAVED_OTHER_SURFACES = new Set([
  "paved",
  "paving_stones",
  "sett",
  "cobblestone",
  "cobblestone:flattened",
  "concrete",
  "concrete:plates",
  "concrete:lanes",
  "metal",
  "wood",
  "bricks",
]);

export function classifySurface(
  surfaceTag: string | undefined,
): SurfaceCategory {
  if (!surfaceTag) return "unknown";
  const value = surfaceTag.trim().toLowerCase();
  if (value === "asphalt") return "asphalt";
  if (UNPAVED_SURFACES.has(value)) return "unpaved";
  if (PAVED_OTHER_SURFACES.has(value)) return "paved-other";
  return "unknown";
}

/**
 * Split Overpass ways into the two #203 layers. Ways without geometry are
 * skipped. A way may appear in both layers. Untagged surface stays
 * "unknown" and is never rendered as paved or unpaved.
 */
export function wayElementsToLayers(elements: OverpassWay[]): {
  infra: LayerFeature[];
  surface: LayerFeature[];
} {
  const infra: LayerFeature[] = [];
  const surface: LayerFeature[] = [];
  for (const element of elements) {
    if (element?.type !== "way" || !Array.isArray(element.geometry)) continue;
    const coordinates = element.geometry.filter(
      (p): p is OverpassGeometryPoint =>
        !!p &&
        typeof p.lon === "number" &&
        typeof p.lat === "number" &&
        Number.isFinite(p.lon) &&
        Number.isFinite(p.lat),
    );
    if (coordinates.length < 2) continue;
    const line: [number, number][] = coordinates.map((p) => [p.lon, p.lat]);
    const tags = element.tags ?? {};
    const kind = classifyInfraKind(tags);
    const surfaceCategory = classifySurface(tags.surface);
    if (kind) {
      infra.push({
        type: "Feature",
        properties: {kind, surface: surfaceCategory},
        geometry: {type: "LineString", coordinates: line},
      });
    }
    if (surfaceCategory !== "unknown") {
      const feature: LayerFeature = {
        type: "Feature",
        properties: {surface: surfaceCategory},
        geometry: {type: "LineString", coordinates: line},
      };
      if (kind) feature.properties.kind = kind;
      surface.push(feature);
    }
  }
  return {infra, surface};
}

function timeoutSignal(ms: number): AbortSignal | undefined {
  try {
    if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
      return AbortSignal.timeout(ms);
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export async function fetchBikeWays(
  bbox: OverpassBbox,
  options: {signal?: AbortSignal} = {},
): Promise<OverpassWay[]> {
  const response = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: {"Content-Type": "application/x-www-form-urlencoded"},
    body: `data=${encodeURIComponent(buildOverpassQuery(bbox))}`,
    signal: options.signal ?? timeoutSignal(OVERPASS_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Overpass request failed with status ${response.status}`);
  }
  const data = (await response.json()) as OverpassResponse;
  if (!data || !Array.isArray(data.elements)) {
    throw new Error("Overpass returned an unusable response");
  }
  return data.elements;
}

export interface BikeLayersResult {
  infra: LayerFeature[];
  surface: LayerFeature[];
}

/**
 * Browser entry point for #203 layers. Same-origin call to
 * POST /api/bike-layers — the browser never talks to Overpass directly,
 * so CORS and third-party quota handling stay server-side.
 * Throws on any failure; callers map it with describeOverpassFailure().
 */
export async function requestBikeLayers(
  bbox: OverpassBbox,
  options: {signal?: AbortSignal} = {},
): Promise<BikeLayersResult> {
  const response = await fetch("/api/bike-layers", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({bbox}),
    signal: options.signal,
  });
  if (!response.ok) {
    throw new Error(`Bike layers request failed with status ${response.status}`);
  }
  const data = (await response.json()) as Partial<BikeLayersResult>;
  if (!data || !Array.isArray(data.infra) || !Array.isArray(data.surface)) {
    throw new Error("Bike layers returned an unusable response");
  }
  return {infra: data.infra, surface: data.surface};
}

/** User-facing failure text. Always stresses that routing is unaffected. */
export function describeOverpassFailure(error: unknown): string {
  if (
    error instanceof Error &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  ) {
    return "Bike layer request timed out. The route is unaffected — try toggling the layer again.";
  }
  return "Bike data is temporarily unavailable. The route is unaffected — try again later.";
}
