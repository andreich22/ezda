import {describe, expect, it, vi} from "vitest";

const getCurrentUser = vi.fn();
const getPublicRoutes = vi.fn();

vi.mock("../lib/current-user", () => ({getCurrentUser}));
vi.mock("../lib/db/routes", () => ({getPublicRoutes}));

describe("GET /api/routes", () => {
  it("forces anonymous requests to public visibility", async () => {
    getCurrentUser.mockResolvedValueOnce(null);
    getPublicRoutes.mockResolvedValueOnce({
      items: [],
      page: 1,
      pageSize: 50,
      total: 0,
      hasNextPage: false,
    });

    const {GET} = await import("../app/api/routes/route");
    const response = await GET(new Request("http://localhost/api/routes?visibility=private&page=2&limit=100"));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({page: 1, pageSize: 50});
    expect(getPublicRoutes).toHaveBeenCalledWith(2, 50, "public", undefined);
  });

  it("passes authenticated visibility and user id to the server query", async () => {
    getCurrentUser.mockResolvedValueOnce({id: "user-123"});
    getPublicRoutes.mockResolvedValueOnce({
      items: [],
      page: 2,
      pageSize: 25,
      total: 51,
      hasNextPage: true,
    });

    const {GET} = await import("../app/api/routes/route");
    const response = await GET(new Request("http://localhost/api/routes?visibility=private&page=2&limit=25"));

    expect(response.status).toBe(200);
    expect(getPublicRoutes).toHaveBeenCalledWith(2, 25, "private", "user-123");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
});
