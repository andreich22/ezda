import {beforeEach, describe, expect, it, vi} from "vitest";

const execute = vi.fn();

vi.mock("../lib/db/index", () => ({
  db: {execute},
}));

describe("getRouteForViewer waypoint parsing", () => {
  beforeEach(() => {
    execute.mockReset();
  });

  async function loadModule() {
    return await import("../lib/db/routes");
  }

  it("parses valid JSON waypoints string without throwing", async () => {
    const waypoints = "[[-74.2,40.7],[-74.1,40.6]]";
    execute.mockResolvedValueOnce([{
      id: "6f9fdf9e-89be-4641-94d7-16dabb22991c",
      title: "Test",
      description: null,
      distanceMeters: 1000,
      durationSeconds: null,
      elevationGainMeters: null,
      createdAt: "2026-10-05T00:00:00Z",
      waypoints,
      geometry: '{"type":"Feature","properties":{},"geometry":{"type":"LineString","coordinates":[[-74.2,40.7],[-74.1,40.6]]}}',
    }]);

    const {getRouteForViewer} = await loadModule();
    const route = await getRouteForViewer("6f9fdf9e-89be-4641-94d7-16dabb22991c", null);

    expect(route).not.toBeNull();
    expect(route!.waypoints).toEqual([[-74.2, 40.7], [-74.1, 40.6]]);
  });

  it("returns null waypoints (no crash) when stored value is malformed JSON", async () => {
    execute.mockResolvedValueOnce([{
      id: "6f9fdf9e-89be-4641-94d7-16dabb22991c",
      title: "Test",
      description: null,
      distanceMeters: 1000,
      durationSeconds: null,
      elevationGainMeters: null,
      createdAt: "2026-10-05T00:00:00Z",
      waypoints: "{{1,2},{3,4}}",
      geometry: '{"type":"Feature","properties":{},"geometry":{"type":"LineString","coordinates":[[-74.2,40.7],[-74.1,40.6]]}}',
    }]);

    const {getRouteForViewer} = await loadModule();
    const route = await getRouteForViewer("6f9fdf9e-89be-4641-94d7-16dabb22991c", null);

    expect(route).not.toBeNull();
    expect(route!.waypoints).toBeNull();
  });

  it("returns null waypoints when stored value is null", async () => {
    execute.mockResolvedValueOnce([{
      id: "6f9fdf9e-89be-4641-94d7-16dabb22991c",
      title: "Test",
      description: null,
      distanceMeters: 1000,
      durationSeconds: null,
      elevationGainMeters: null,
      createdAt: "2026-10-05T00:00:00Z",
      waypoints: null,
      geometry: '{"type":"Feature","properties":{},"geometry":{"type":"LineString","coordinates":[[-74.2,40.7],[-74.1,40.6]]}}',
    }]);

    const {getRouteForViewer} = await loadModule();
    const route = await getRouteForViewer("6f9fdf9e-89be-4641-94d7-16dabb22991c", null);

    expect(route).not.toBeNull();
    expect(route!.waypoints).toBeNull();
  });

  it("handles array-typed waypoints (Drizzle already parsed)", async () => {
    execute.mockResolvedValueOnce([{
      id: "6f9fdf9e-89be-4641-94d7-16dabb22991c",
      title: "Test",
      description: null,
      distanceMeters: 1000,
      durationSeconds: null,
      elevationGainMeters: null,
      createdAt: "2026-10-05T00:00:00Z",
      waypoints: [[-74.2, 40.7], [-74.1, 40.6]],
      geometry: '{"type":"Feature","properties":{},"geometry":{"type":"LineString","coordinates":[[-74.2,40.7],[-74.1,40.6]]}}',
    }]);

    const {getRouteForViewer} = await loadModule();
    const route = await getRouteForViewer("6f9fdf9e-89be-4641-94d7-16dabb22991c", null);

    expect(route).not.toBeNull();
    expect(route!.waypoints).toEqual([[-74.2, 40.7], [-74.1, 40.6]]);
  });
});
