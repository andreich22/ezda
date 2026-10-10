import {beforeEach, describe, expect, it, vi} from "vitest";

const execute = vi.fn();

vi.mock("../lib/db/index", () => ({
  db: {execute},
}));

describe("getRouteForViewer geometry parsing", () => {
  beforeEach(() => {
    execute.mockReset();
  });

  async function loadModule() {
    return await import("../lib/db/routes");
  }

  const baseRow = (overrides: Record<string, unknown>) => ({
    id: "6f9fdf9e-89be-4641-94d7-16dabb22991c",
    title: "Test",
    description: null,
    distanceMeters: 1000,
    durationSeconds: null,
    elevationGainMeters: null,
    createdAt: "2026-10-05T00:00:00Z",
    ...overrides,
  });

  it("parses valid GeoJSON geometry without throwing", async () => {
    execute.mockResolvedValueOnce([{
      ...baseRow({
        waypoints: null,
        geometry: '{"type":"Feature","properties":{},"geometry":{"type":"LineString","coordinates":[[0,0],[1,1]]}}',
      }),
    }]);

    const {getRouteForViewer} = await loadModule();
    const route = await getRouteForViewer("6f9fdf9e-89be-4641-94d7-16dabb22991c", null);

    expect(route).not.toBeNull();
    expect(route!.geometry.geometry).not.toBeNull();
    expect(route!.geometry.geometry?.type).toBe("LineString");
    expect((route!.geometry.geometry as GeoJSON.LineString).coordinates).toEqual([[0, 0], [1, 1]]);
  });

  it("returns a valid geometry when stored value wraps the Feature outside geometry (no crash)", async () => {
    execute.mockResolvedValueOnce([{
      ...baseRow({
        waypoints: null,
        geometry: '{"type":"Feature","properties":{},"geometry":{"type":"LineString","coordinates":[[0,0],[1,1]]}}',
      }),
    }]);

    const {getRouteForViewer} = await loadModule();
    const route = await getRouteForViewer("6f9fdf9e-89be-4641-94d7-16dabb22991c", null);

    expect(route).not.toBeNull();
    expect(route!.geometry.geometry?.type).toBe("LineString");
  });

  it("returns null geometry (no crash) when stored value is malformed JSON", async () => {
    execute.mockResolvedValueOnce([{
      ...baseRow({
        waypoints: null,
        geometry: "not-geojson-at-all",
      }),
    }]);

    const {getRouteForViewer} = await loadModule();
    const route = await getRouteForViewer("6f9fdf9e-89be-4641-94d7-16dabb22991c", null);

    expect(route).not.toBeNull();
    expect(route!.geometry.geometry).toBeNull();
  });

  it("returns null geometry (no crash) when stored value is not an object", async () => {
    execute.mockResolvedValueOnce([{
      ...baseRow({
        waypoints: null,
        geometry: "42",
      }),
    }]);

    const {getRouteForViewer} = await loadModule();
    const route = await getRouteForViewer("6f9fdf9e-89be-4641-94d7-16dabb22991c", null);

    expect(route).not.toBeNull();
    expect(route!.geometry.geometry).toBeNull();
  });

  it("handles array-typed geometry (Drizzle already parsed) without throwing", async () => {
    execute.mockResolvedValueOnce([{
      ...baseRow({
        waypoints: null,
        geometry: {
          type: "Feature",
          properties: {},
          geometry: {type: "LineString", coordinates: [[0, 0], [1, 1]]},
        },
      }),
    }]);

    const {getRouteForViewer} = await loadModule();
    const route = await getRouteForViewer("6f9fdf9e-89be-4641-94d7-16dabb22991c", null);

    expect(route).not.toBeNull();
    expect(route!.geometry.geometry?.type).toBe("LineString");
  });
});
