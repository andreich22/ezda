import {NextResponse} from "next/server";
import {hav} from "../../../lib/geo";

type Point = [number, number];

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
      geometry: { type: "LineString", coordinates },
    },
    distanceMeters,
    durationSeconds,
    elevationGainMeters: null,
    source,
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const start = body.start as Point;
    const end = body.end as Point;

    if (
      !Array.isArray(start) ||
      !Array.isArray(end) ||
      start.length !== 2 ||
      end.length !== 2
    ) {
      return NextResponse.json(
        { error: "start and end are required" },
        { status: 400 },
      );
    }

    const key = process.env.ORS_API_KEY;

    // Preferred provider when an API key is configured.
    if (key) {
      console.log("Using OpenRouteService API key for routing.");
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
              coordinates: [start, end],
              instructions: false,
              elevation: true,
            }),
            cache: "no-store",
          },
        );
console.log("response response response", response);
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
              distanceMeters: summary?.distance ?? hav(start, end),
              durationSeconds: summary?.duration ?? null,
              elevationGainMeters: elevation,
              source: "OpenRouteService",
            });
          }
        }
      } catch {
        // Continue to the public OSM bicycle router.
      }
    }

    // No API key is required for this public OSM bicycle routing service.
    // It follows the OSM road network instead of drawing a straight line.
    try {
      const coordinates = `${start[0]},${start[1]};${end[0]},${end[1]}`;
      const response = await fetch(
        `https://routing.openstreetmap.de/routed-bike/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`,
        { cache: "no-store" },
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
      }
    } catch {
      // Continue to the deterministic fallback below.
    }

    // Last-resort fallback when external routing services are unavailable.
    const distance = hav(start, end);
    return responseFromLine(
      [start, end],
      distance,
      distance / 5,
      "Straight-line fallback",
    );
  } catch {
    return NextResponse.json({ error: "Invalid routing request" }, { status: 400 });
  }
}
