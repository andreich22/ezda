import {describe, expect, it, vi, afterEach} from "vitest";
import {POST} from "../app/api/route/route";
import {hav} from "../lib/geo";

afterEach(() => {
  vi.restoreAllMocks();
});

const point = (lon: number, lat: number): [number, number] => [lon, lat];

describe("hav", () => {
  it("returns zero for identical points", () => {
    expect(hav(point(0, 0), point(0, 0))).toBe(0);
  });

  it("calculates a known one-degree equatorial distance", () => {
    expect(hav(point(0, 0), point(1, 0))).toBeCloseTo(111194.93, 1);
  });

  it("is symmetric", () => {
    const a = point(-73.94907, 40.68884);
    const b = point(-73.91785, 40.68602);
    expect(hav(a, b)).toBeCloseTo(hav(b, a), 8);
  });
});

describe("POST /api/route", () => {
  it("rejects requests without two-point start/end coordinates", async () => {
    const response = await POST(
      new Request("http://localhost/api/route", {
        method: "POST",
        body: JSON.stringify({start: [1], end: [2, 3]}),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "start and end are required",
    });
  });

  it("uses OpenRouteService when configured and returns its route", async () => {
    vi.stubEnv("ORS_API_KEY", "test-key");
    const geo = {
      features: [
        {
          type: "Feature",
          properties: {summary: {distance: 1234, duration: 321}},
          geometry: {
            type: "LineString",
            coordinates: [
              [-73.9, 40.6, 10],
              [-73.8, 40.7, 25],
              [-73.7, 40.8, 20],
            ],
          },
        },
      ],
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(geo), {status: 200}),
    );

    const response = await POST(
      new Request("http://localhost/api/route", {
        method: "POST",
        body: JSON.stringify({start: [-73.9, 40.6], end: [-73.7, 40.8]}),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      distanceMeters: 1234,
      durationSeconds: 321,
      elevationGainMeters: 15,
      source: "OpenRouteService",
    });
  });

  it("falls back to the public bicycle router when ORS fails", async () => {
    vi.stubEnv("ORS_API_KEY", "test-key");
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("upstream error", {status: 503}))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            routes: [
              {
                geometry: {
                  coordinates: [
                    [-73.9, 40.6],
                    [-73.85, 40.62],
                    [-73.8, 40.7],
                  ],
                },
                distance: 2500,
                duration: 600,
              },
            ],
          }),
          {status: 200},
        ),
      );

    const response = await POST(
      new Request("http://localhost/api/route", {
        method: "POST",
        body: JSON.stringify({start: [-73.9, 40.6], end: [-73.8, 40.7]}),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      distanceMeters: 2500,
      durationSeconds: 600,
      source: "OpenStreetMap bicycle routing",
    });
  });

  it("returns the straight-line fallback when routing providers are unavailable", async () => {
    vi.stubEnv("ORS_API_KEY", "");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network unavailable"));

    const start = point(-73.9, 40.6);
    const end = point(-73.8, 40.7);
    const response = await POST(
      new Request("http://localhost/api/route", {
        method: "POST",
        body: JSON.stringify({start, end}),
      }),
    );

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.source).toBe("Straight-line fallback");
    expect(body.distanceMeters).toBeCloseTo(hav(start, end), 8);
    expect(body.geometry.geometry.coordinates).toEqual([start, end]);
  });
});
