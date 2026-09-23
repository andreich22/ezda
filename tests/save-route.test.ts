import {afterEach, describe, expect, it, vi} from "vitest";
import {POST} from "../app/api/routes/route";
import {createRoute} from "../lib/db/routes";

vi.mock("../lib/db/routes", () => ({
  createRoute: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/routes", () => {
  it("rejects invalid geometry", async () => {
    const response = await POST(
      new Request("http://localhost/api/routes", {
        method: "POST",
        body: JSON.stringify({
          title: "Test route",
          geometry: {
            type: "Feature",
            geometry: {type: "Point", coordinates: [-73, 40]},
          },
          distanceMeters: 1000,
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "geometry must be a LineString",
    });
    expect(createRoute).not.toHaveBeenCalled();
  });

  it("rejects missing title", async () => {
    const response = await POST(
      new Request("http://localhost/api/routes", {
        method: "POST",
        body: JSON.stringify({
          geometry: {
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: [[-73, 40], [-72.9, 40.1]],
            },
          },
          distanceMeters: 1000,
        }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("creates a route and returns its public URL", async () => {
    vi.mocked(createRoute).mockResolvedValue({id: "11111111-1111-1111-1111-111111111111"});

    const response = await POST(
      new Request("http://localhost/api/routes", {
        method: "POST",
        body: JSON.stringify({
          title: "Prospect Park Loop",
          description: "A short ride",
          geometry: {
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: [[-73.97, 40.66], [-73.96, 40.67]],
            },
          },
          distanceMeters: 2500,
          durationSeconds: 600,
          elevationGainMeters: 30,
        }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      id: "11111111-1111-1111-1111-111111111111",
      url: "/routes/11111111-1111-1111-1111-111111111111",
    });
    expect(createRoute).toHaveBeenCalledOnce();
  });
});
