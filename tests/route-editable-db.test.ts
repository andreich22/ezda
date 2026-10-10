import {beforeEach, describe, expect, it, vi} from "vitest";

const execute = vi.fn();

vi.mock("../lib/db/index", () => ({
  db: {execute},
}));

describe("getEditableRoute", () => {
  beforeEach(() => {
    execute.mockReset();
  });

  it("returns the owner's route with parsed waypoints, geometry and visibility", async () => {
    execute.mockResolvedValueOnce([
      {
        id: "route-1",
        authorId: "user-1",
        title: "Morning loop",
        description: null,
        distanceMeters: 5000,
        durationSeconds: 1500,
        elevationGainMeters: 42,
        createdAt: "2026-10-01T00:00:00Z",
        isPublic: false,
        waypoints: [[37.6, 55.75], [37.65, 55.76]],
        geometry: JSON.stringify({type: "LineString", coordinates: [[37.6, 55.75], [37.65, 55.76]]}),
      },
    ]);

    const {getEditableRoute} = await import("../lib/db/routes");
    const result = await getEditableRoute("route-1", "user-1");

    expect(result).toMatchObject({
      id: "route-1",
      authorId: "user-1",
      title: "Morning loop",
      isPublic: false,
      waypoints: [[37.6, 55.75], [37.65, 55.76]],
    });
    expect(result?.geometry.geometry).toEqual({
      type: "LineString",
      coordinates: [[37.6, 55.75], [37.65, 55.76]],
    });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("returns null when the route is missing or belongs to someone else", async () => {
    execute.mockResolvedValueOnce([]);

    const {getEditableRoute} = await import("../lib/db/routes");
    await expect(getEditableRoute("route-9", "user-1")).resolves.toBeNull();
  });
});
