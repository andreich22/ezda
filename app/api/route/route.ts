import {NextResponse} from "next/server";
import {hav} from "../../../lib/geo";
import {
  API_ERROR_CODES,
  errorResponse,
  logServerWarning,
} from "../../../lib/api-errors";

type Point = [number, number];

const ROUTING_TIMEOUT_MS = 10_000;
const MAX_ROUTE_POINTS = 500;

function responseFromLine(
  coordinates: number[][],
  distanceMeters: number,
  durationSeconds: number | null,
  source: string,
) {
  return NextResponse.json({
    geometry: {
      type: "Feature",
      properties: {},
      geometry: {type: "LineString", coordinates},
    },
    distanceMeters,
    durationSeconds,
    elevationGainMeters: null,
    source,
  });
}

function isPoint(value: unknown): value is Point {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((coordinate) => typeof coordinate === "number" && Number.isFinite(coordinate)) &&
    (value as number[])[0] >= -180 &&
    (value as number[])[0] <= 180 &&
    (value as number[])[1] >= -90 &&
    (value as number[])[1] <= 90
  );
}

function isPointList(value: unknown): value is Point[] {
  return Array.isArray(value) && value.length >= 2 && value.every(isPoint);
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

function isTimeoutError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const points: Point[] = isPointList(body.points)
      ? body.points
      : isPoint(body.start) && isPoint(body.end)
        ? [body.start, body.end]
        : [];

    if (points.length < 2) {
      return errorResponse(
        API_ERROR_CODES.ROUTING_REQUEST_INVALID,
        "at least two route points are required",
        400,
      );
    }

    if (points.length > MAX_ROUTE_POINTS) {
      return errorResponse(
        API_ERROR_CODES.ROUTING_REQUEST_INVALID,
        "too many route points",
        400,
      );
    }

    const key = process.env.ORS_API_KEY;

    // Preferred provider when an API key is configured. OpenRouteService
    // accepts an ordered list of coordinates, so intermediate waypoints
    // are visited in exactly the order selected by the user.
    if (key) {
      try {
        const response = await fetch(
          "https://api.openrouteservice.org/v2/directions/cycling-regular/geojson",
          {
            method: "POST",
            headers: {
              Authorization: key,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              coordinates: points,
              instructions: false,
              elevation: true,
            }),
            cache: "no-store",
            signal: timeoutSignal(ROUTING_TIMEOUT_MS),
          },
        );

        if (response.ok) {
          const geo = await response.json();
          const feature = geo.features?.[0];
          const summary = feature?.properties?.summary;
          const coords = feature?.geometry?.coordinates ?? [];

          if (feature && coords.length > 1) {
            const elevation = coords.reduce(
              (sum: number, coordinate: number[], index: number, all: number[][]) =>
                sum +
                (index
                  ? Math.max(
                      0,
                      (coordinate[2] ?? 0) - (all[index - 1][2] ?? 0),
                    )
                  : 0),
              0,
            );

            return NextResponse.json({
              geometry: feature,
              distanceMeters: summary?.distance ?? 0,
              durationSeconds: summary?.duration ?? null,
              elevationGainMeters: elevation,
              source: "OpenRouteService",
              pointCount: points.length,
            });
          } else {
            logServerWarning(
              "routing",
              `OpenRouteService returned no usable route (status ok, ${coords.length} coords)`,
            );
          }
        } else {
          logServerWarning("routing", `OpenRouteService request failed with status ${response.status}`);
        }
      } catch (error) {
        // Continue to the public OSM bicycle router.
        logServerWarning(
          "routing",
          isTimeoutError(error)
            ? "OpenRouteService request timed out"
            : "OpenRouteService request failed",
        );
      }
    }

    // Public OSM bicycle router. It also accepts an ordered list of
    // coordinates separated by semicolons, preserving all waypoints.
    try {
      const coordinates = points.map(([lon, lat]) => `${lon},${lat}`).join(";");
      const response = await fetch(
        `https://routing.openstreetmap.de/routed-bike/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`,
        {cache: "no-store", signal: timeoutSignal(ROUTING_TIMEOUT_MS)},
      );

      if (response.ok) {
        const data = await response.json();
        const route = data.routes?.[0];

        if (route?.geometry?.coordinates?.length > 1) {
          return responseFromLine(
            route.geometry.coordinates,
            route.distance,
            route.duration,
            "OpenStreetMap bicycle routing",
          );
        }
        logServerWarning("routing", "OSM router returned no usable route");
      } else {
        logServerWarning("routing", `OSM router request failed with status ${response.status}`);
      }
    } catch (error) {
      // Continue to the deterministic fallback below.
      logServerWarning(
        "routing",
        isTimeoutError(error) ? "OSM router request timed out" : "OSM router request failed",
      );
    }

    // Last-resort fallback: connect every selected point in order.
    logServerWarning("routing", "using straight-line fallback");
    const coordinates = points as number[][];
    const distance = points.slice(1).reduce(
      (sum, point, index) => sum + hav(points[index], point),
      0,
    );
    return responseFromLine(
      coordinates,
      distance,
      distance / 5,
      "Straight-line fallback",
    );
  } catch {
    return errorResponse(
      API_ERROR_CODES.ROUTING_REQUEST_INVALID,
      "Invalid routing request",
      400,
    );
  }
}
