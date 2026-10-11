import {NextResponse} from "next/server";
import {
  API_ERROR_CODES,
  errorResponse,
  logServerWarning,
} from "../../../lib/api-errors";
import {
  OVERPASS_TIMEOUT_MS,
  fetchBikeWays,
  isBboxTooLarge,
  wayElementsToLayers,
  type OverpassBbox,
} from "../../../lib/bike-map-overpass";

function isBbox(value: unknown): value is OverpassBbox {
  if (typeof value !== "object" || value === null) return false;
  const {south, west, north, east} = value as Record<string, unknown>;
  for (const n of [south, west, north, east]) {
    if (typeof n !== "number" || !Number.isFinite(n)) return false;
  }
  const s = south as number;
  const w = west as number;
  const n = north as number;
  const e = east as number;
  return (
    s >= -90 &&
    s <= 90 &&
    n >= -90 &&
    n <= 90 &&
    w >= -180 &&
    w <= 180 &&
    e >= -180 &&
    e <= 180 &&
    s <= n &&
    w <= e
  );
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

/**
 * Same-origin proxy for bicycle infrastructure + surface data (#203).
 * Browsers must not call Overpass directly (CORS and quota discipline);
 * the server validates the bbox, queries Overpass, and returns parsed
 * GeoJSON layer features. Routing is never involved here.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(
      API_ERROR_CODES.INVALID_JSON,
      "Invalid bike layers request",
      400,
    );
  }

  const bbox =
    typeof body === "object" && body !== null
      ? (body as {bbox?: unknown}).bbox
      : undefined;

  if (!isBbox(bbox)) {
    return errorResponse(
      API_ERROR_CODES.LAYERS_REQUEST_INVALID,
      "a valid bbox with south, west, north and east is required",
      400,
    );
  }

  if (isBboxTooLarge(bbox)) {
    return errorResponse(
      API_ERROR_CODES.LAYERS_REQUEST_INVALID,
      "bbox is too large",
      400,
    );
  }

  try {
    const {elements, endpoint} = await fetchBikeWays(bbox, {
      signal: timeoutSignal(OVERPASS_TIMEOUT_MS),
    });
    const {infra, surface} = wayElementsToLayers(elements);
    return NextResponse.json({infra, surface, source: endpoint});
  } catch (error) {
    logServerWarning(
      "bike-layers",
      error instanceof Error ? error.message : "Overpass request failed",
    );
    return errorResponse(
      API_ERROR_CODES.LOAD_FAILED,
      "Bike data is temporarily unavailable",
      502,
    );
  }
}
