import {describe, expect, it, vi, afterEach} from "vitest";
import {POST} from "../app/api/route/route";
import {hav} from "../lib/geo";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
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
  it("rejects requests without at least two route points", async () => {
    const response = await POST(
      new Request("http://localhost/api/route", {
        method: "POST",
        body: JSON.stringify({points: [[1]]}),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "at least two route points are required",
    });
  });

  it("uses OpenRouteService for multiple ordered waypoints", async () => {
    vi.stubEnv("ORS_API_KEY", "test-key");
    const geo = {
      features: [
        {
          type: "Feature",
          properties: {summary: {distance: 3000, duration: 900}},
          geometry: {
            type: "LineString",
            coordinates: [
              [-73.9, 40.6, 10],
              [-73.85, 40.65, 20],
              [-73.8, 40.7, 15],
            ],
          },
        },
      ],
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(geo), {status: 200}),
    );

    const response = await POST(
      new Request("http://localhost/api/route", {
        method: "POST",
        body: JSON.stringify({
          points: [
            [-73.9, 40.6],
            [-73.85, 40.65],
            [-73.8, 40.7],
          ],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openrouteservice.org/v2/directions/cycling-regular/geojson",
      expect.objectContaining({
        body: expect.stringContaining('"coordinates":[[-73.9,40.6],[-73.85,40.65],[-73.8,40.7]]'),
      }),
    );
    await expect(response.json()).resolves.toMatchObject({
      distanceMeters: 3000,
      durationSeconds: 900,
      elevationGainMeters: 10,
      source: "OpenRouteService",
      pointCount: 3,
    });
  });

  it("falls back to the public bicycle router with all waypoints", async () => {
    vi.stubEnv("ORS_API_KEY", "test-key");
    const fetchMock = vi.spyOn(globalThis, "fetch")
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
        body: JSON.stringify({
          points: [
            [-73.9, 40.6],
            [-73.85, 40.65],
            [-73.8, 40.7],
          ],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls[1][0]).toContain(
      "-73.9,40.6;-73.85,40.65;-73.8,40.7",
    );
    await expect(response.json()).resolves.toMatchObject({
      distanceMeters: 2500,
      durationSeconds: 600,
      source: "OpenStreetMap bicycle routing",
    });
  });

  it("returns a fallback route through every selected point", async () => {
    vi.stubEnv("ORS_API_KEY", "");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network unavailable"));

    const points = [
      point(-73.9, 40.6),
      point(-73.85, 40.65),
      point(-73.8, 40.7),
    ];
    const response = await POST(
      new Request("http://localhost/api/route", {
        method: "POST",
        body: JSON.stringify({points}),
      }),
    );

    const body = await response.json();
    const expectedDistance = hav(points[0], points[1]) + hav(points[1], points[2]);
    expect(response.status).toBe(200);
    expect(body.source).toBe("Straight-line fallback");
    expect(body.distanceMeters).toBeCloseTo(expectedDistance, 8);
    expect(body.geometry.geometry.coordinates).toEqual(points);
  });

  it("keeps the old start/end request format working", async () => {
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
    expect(body.geometry.geometry.coordinates).toEqual([start, end]);
  });
});
