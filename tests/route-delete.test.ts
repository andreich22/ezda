import {describe, expect, it, vi} from "vitest";

const getCurrentUser = vi.fn();
const getRouteOwnership = vi.fn();
const deleteRoute = vi.fn();

vi.mock("../lib/current-user", () => ({getCurrentUser}));
vi.mock("../lib/db/routes", () => ({deleteRoute, getRouteOwnership}));

const ROUTE_ID = "11111111-1111-1111-8111-111111111111";
const params = {params: Promise.resolve({id: ROUTE_ID})};

describe("DELETE /api/routes/[id]", () => {
  it("rejects unauthenticated requests with 401", async () => {
    getCurrentUser.mockResolvedValueOnce(null);

    const {DELETE} = await import("../app/api/routes/[id]/route");
    const response = await DELETE(new Request("http://localhost/api/routes/x"), params);

    expect(response!.status).toBe(401);
    expect(await response!.json()).toMatchObject({code: "AUTH_REQUIRED"});
    expect(deleteRoute).not.toHaveBeenCalled();
  });

  it("returns 404 for a malformed id", async () => {
    getCurrentUser.mockResolvedValueOnce({id: "user-1"});

    const {DELETE} = await import("../app/api/routes/[id]/route");
    const response = await DELETE(new Request("http://localhost/api/routes/x"), {
      params: Promise.resolve({id: "not-a-uuid"}),
    });

    expect(response!.status).toBe(404);
    expect(deleteRoute).not.toHaveBeenCalled();
  });

  it("returns 404 for a missing route", async () => {
    getCurrentUser.mockResolvedValueOnce({id: "user-1"});
    getRouteOwnership.mockResolvedValueOnce(null);

    const {DELETE} = await import("../app/api/routes/[id]/route");
    const response = await DELETE(new Request("http://localhost/api/routes/x"), params);

    expect(response!.status).toBe(404);
    expect(deleteRoute).not.toHaveBeenCalled();
  });

  it("forbids deleting someone else's route with 403", async () => {
    getCurrentUser.mockResolvedValueOnce({id: "user-1"});
    getRouteOwnership.mockResolvedValueOnce({id: ROUTE_ID, authorId: "user-2"});

    const {DELETE} = await import("../app/api/routes/[id]/route");
    const response = await DELETE(new Request("http://localhost/api/routes/x"), params);

    expect(response!.status).toBe(403);
    expect(await response!.json()).toMatchObject({code: "FORBIDDEN"});
    expect(deleteRoute).not.toHaveBeenCalled();
  });

  it("deletes the owner's route with 204", async () => {
    getCurrentUser.mockResolvedValueOnce({id: "user-1"});
    getRouteOwnership.mockResolvedValueOnce({id: ROUTE_ID, authorId: "user-1"});
    deleteRoute.mockResolvedValueOnce({id: ROUTE_ID});

    const {DELETE} = await import("../app/api/routes/[id]/route");
    const response = await DELETE(new Request("http://localhost/api/routes/x"), params);

    expect(response!.status).toBe(204);
    expect(deleteRoute).toHaveBeenCalledWith(ROUTE_ID, "user-1");
  });

  it("returns 404 when the route vanished between the check and the delete", async () => {
    getCurrentUser.mockResolvedValueOnce({id: "user-1"});
    getRouteOwnership.mockResolvedValueOnce({id: ROUTE_ID, authorId: "user-1"});
    deleteRoute.mockResolvedValueOnce(null);

    const {DELETE} = await import("../app/api/routes/[id]/route");
    const response = await DELETE(new Request("http://localhost/api/routes/x"), params);

    expect(response!.status).toBe(404);
  });

  it("returns 500 without leaking internals when the database fails", async () => {
    getCurrentUser.mockResolvedValueOnce({id: "user-1"});
    getRouteOwnership.mockResolvedValueOnce({id: ROUTE_ID, authorId: "user-1"});
    deleteRoute.mockRejectedValueOnce(new Error("secret connection string postgres://x"));

    const {DELETE} = await import("../app/api/routes/[id]/route");
    const response = await DELETE(new Request("http://localhost/api/routes/x"), params);

    expect(response!.status).toBe(500);
    const body = JSON.stringify(await response!.json());
    expect(body).toContain("DELETE_FAILED");
    expect(body).not.toContain("postgres://x");
  });
});
