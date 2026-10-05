import {beforeEach, describe, expect, it, vi} from "vitest";

const execute = vi.fn();

vi.mock("../lib/db/index", () => ({
  db: {execute},
}));

describe("getPublicRoutes", () => {
  beforeEach(() => {
    execute.mockReset();
  });

  it("returns page 2 metadata and items when more rows exist", async () => {
    execute
      .mockResolvedValueOnce([{total: "101"}])
      .mockResolvedValueOnce([
        {
          id: "route-51",
          title: "Route 51",
          description: null,
          distanceMeters: 1000,
          durationSeconds: 600,
          elevationGainMeters: 10,
          createdAt: "2026-10-05T00:00:00Z",
          isPublic: true,
        },
      ]);

    const {getPublicRoutes} = await import("../lib/db/routes");
    const result = await getPublicRoutes(2, 50, "public");

    expect(result).toEqual({
      items: expect.any(Array),
      page: 2,
      pageSize: 50,
      total: 101,
      hasNextPage: true,
    });
    expect(result.items).toHaveLength(1);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("keeps the real total for an out-of-range page", async () => {
    execute
      .mockResolvedValueOnce([{total: "101"}])
      .mockResolvedValueOnce([]);

    const {getPublicRoutes} = await import("../lib/db/routes");
    const result = await getPublicRoutes(999, 50, "public");

    expect(result).toEqual({
      items: [],
      page: 999,
      pageSize: 50,
      total: 101,
      hasNextPage: false,
    });
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("uses the authenticated owner for private visibility", async () => {
    execute
      .mockResolvedValueOnce([{total: "1"}])
      .mockResolvedValueOnce([
        {
          id: "private-route",
          title: "Private",
          description: null,
          distanceMeters: 1000,
          durationSeconds: null,
          elevationGainMeters: null,
          createdAt: "2026-10-05T00:00:00Z",
          isPublic: false,
        },
      ]);

    const {getPublicRoutes} = await import("../lib/db/routes");
    const result = await getPublicRoutes(1, 50, "private", "11111111-1111-1111-1111-111111111111");

    expect(result.items[0]?.isPublic).toBe(false);
    expect(execute).toHaveBeenCalledTimes(2);
    const queryText = String(execute.mock.calls[0]?.[0]);
    expect(queryText).toContain("author_id");
    expect(queryText).toContain("is_public");
  });
});
