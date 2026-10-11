import {afterEach, describe, expect, it, vi} from "vitest";
import {DELETE, PATCH} from "../app/api/routes/[id]/route";
import {getCurrentUser} from "../lib/current-user";

vi.mock("../lib/current-user", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("../lib/db/routes", () => ({
  getRouteOwnership: vi.fn(),
  updateRoute: vi.fn(),
  deleteRoute: vi.fn(),
}));

import {getRouteOwnership, updateRoute, deleteRoute} from "../lib/db/routes";

const routeId = "11111111-1111-4111-8111-111111111111";
const requestBody = {
  title: "Updated route",
  description: "Updated description",
  geometry: {
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: [[-73, 40], [-72.9, 40.1]],
    },
  },
  distanceMeters: 1200,
  durationSeconds: 700,
  elevationGainMeters: 40,
  visibility: "public",
};

const request = (body: unknown) =>
  new Request(`http://localhost/api/routes/${routeId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

const expectResponse = (response: Response | undefined): Response => {
  expect(response).toBeDefined();
  if (!response) throw new Error("Expected route handler to return a response");
  return response;
};

const getRouteOwnershipMock = vi.mocked(getRouteOwnership);
const updateRouteMock = vi.mocked(updateRoute);
const deleteRouteMock = vi.mocked(deleteRoute);

afterEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue({id: "user-1", email: "user@example.com"});
});

describe("PATCH /api/routes/:id", () => {
  it("requires authentication", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const response = expectResponse(await PATCH(request(requestBody), {params: Promise.resolve({id: routeId})}));

    expect(response.status).toBe(401);
    expect(getRouteOwnershipMock).not.toHaveBeenCalled();
    expect(updateRouteMock).not.toHaveBeenCalled();
  });

  it("returns 404 for malformed ids", async () => {
    const response = expectResponse(
      await PATCH(request(requestBody), {params: Promise.resolve({id: "not-a-uuid"})}),
    );

    expect(response.status).toBe(404);
    expect(getRouteOwnershipMock).not.toHaveBeenCalled();
  });

  it("returns 404 for an absent route", async () => {
    getRouteOwnershipMock.mockResolvedValue(null as never);

    const response = expectResponse(await PATCH(request(requestBody), {params: Promise.resolve({id: routeId})}));

    expect(response.status).toBe(404);
    expect(updateRouteMock).not.toHaveBeenCalled();
  });

  it("returns 403 for another user's route", async () => {
    getRouteOwnershipMock.mockResolvedValue({id: routeId, authorId: "user-2"});

    const response = expectResponse(await PATCH(request(requestBody), {params: Promise.resolve({id: routeId})}));

    expect(response.status).toBe(403);
    expect(updateRouteMock).not.toHaveBeenCalled();
  });

  it("updates only an owned route", async () => {
    getRouteOwnershipMock.mockResolvedValue({id: routeId, authorId: "user-1"});
    updateRouteMock.mockResolvedValue({id: routeId});

    const response = expectResponse(await PATCH(request(requestBody), {params: Promise.resolve({id: routeId})}));

    expect(response.status).toBe(200);
    expect(updateRouteMock).toHaveBeenCalledWith(
      routeId,
      "user-1",
      expect.objectContaining({title: "Updated route", isPublic: true}),
    );
  });

  it("persists switching an owned route to private", async () => {
    getRouteOwnershipMock.mockResolvedValue({id: routeId, authorId: "user-1"});
    updateRouteMock.mockResolvedValue({id: routeId});

    const response = expectResponse(
      await PATCH(request({...requestBody, visibility: "private"}), {params: Promise.resolve({id: routeId})}),
    );

    expect(response.status).toBe(200);
    expect(updateRouteMock).toHaveBeenCalledWith(
      routeId,
      "user-1",
      expect.objectContaining({isPublic: false}),
    );
  });

  it("does not let the request body choose the owner", async () => {
    getRouteOwnershipMock.mockResolvedValue({id: routeId, authorId: "user-1"});
    updateRouteMock.mockResolvedValue({id: routeId});

    const response = expectResponse(
      await PATCH(
        request({...requestBody, author_id: "user-2"}),
        {params: Promise.resolve({id: routeId})},
      ),
    );

    expect(response.status).toBe(200);
    expect(updateRouteMock).toHaveBeenCalledWith(routeId, "user-1", expect.anything());
    expect(updateRouteMock.mock.calls[0]?.[2]).not.toHaveProperty("author_id");
  });

  it("rejects invalid input without touching the database", async () => {
    getRouteOwnershipMock.mockResolvedValue({id: routeId, authorId: "user-1"});

    const response = expectResponse(
      await PATCH(request({title: "  "}), {params: Promise.resolve({id: routeId})}),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({error: "title is required", code: "VALIDATION_ERROR"});
    expect(updateRouteMock).not.toHaveBeenCalled();
  });

  it("returns the stable route url on success", async () => {
    getRouteOwnershipMock.mockResolvedValue({id: routeId, authorId: "user-1"});
    updateRouteMock.mockResolvedValue({id: routeId});

    const response = expectResponse(await PATCH(request(requestBody), {params: Promise.resolve({id: routeId})}));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({id: routeId, url: `/routes/${routeId}`});
  });

  it("returns 404 when the route disappears before the update", async () => {
    getRouteOwnershipMock.mockResolvedValue({id: routeId, authorId: "user-1"});
    updateRouteMock.mockResolvedValue(null as never);

    const response = expectResponse(await PATCH(request(requestBody), {params: Promise.resolve({id: routeId})}));

    expect(response.status).toBe(404);
  });

  it("hides database internals on update failure", async () => {
    getRouteOwnershipMock.mockResolvedValue({id: routeId, authorId: "user-1"});
    updateRouteMock.mockRejectedValue(new Error("connection reset"));

    const response = expectResponse(await PATCH(request(requestBody), {params: Promise.resolve({id: routeId})}));

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({error: "Unable to update route", code: "UPDATE_FAILED"});
    expect(JSON.stringify(body)).not.toContain("connection reset");
  });
});

describe("DELETE /api/routes/:id", () => {
  it("requires authentication", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const response = expectResponse(
      await DELETE(new Request(`http://localhost/api/routes/${routeId}`, {method: "DELETE"}), {
        params: Promise.resolve({id: routeId}),
      }),
    );

    expect(response.status).toBe(401);
    expect(deleteRouteMock).not.toHaveBeenCalled();
  });

  it("returns 404 for malformed ids", async () => {
    const response = expectResponse(
      await DELETE(new Request("http://localhost/api/routes/not-a-uuid", {method: "DELETE"}), {
        params: Promise.resolve({id: "not-a-uuid"}),
      }),
    );

    expect(response.status).toBe(404);
    expect(deleteRouteMock).not.toHaveBeenCalled();
  });

  it("returns 404 for an absent route", async () => {
    getRouteOwnershipMock.mockResolvedValue(null as never);

    const response = expectResponse(
      await DELETE(new Request(`http://localhost/api/routes/${routeId}`, {method: "DELETE"}), {
        params: Promise.resolve({id: routeId}),
      }),
    );

    expect(response.status).toBe(404);
    expect(deleteRouteMock).not.toHaveBeenCalled();
  });

  it("returns 403 for another user's route", async () => {
    getRouteOwnershipMock.mockResolvedValue({id: routeId, authorId: "user-2"});

    const response = expectResponse(
      await DELETE(new Request(`http://localhost/api/routes/${routeId}`, {method: "DELETE"}), {
        params: Promise.resolve({id: routeId}),
      }),
    );

    expect(response.status).toBe(403);
    expect(deleteRouteMock).not.toHaveBeenCalled();
  });

  it("deletes only an owned route", async () => {
    getRouteOwnershipMock.mockResolvedValue({id: routeId, authorId: "user-1"});
    deleteRouteMock.mockResolvedValue({id: routeId});

    const response = expectResponse(
      await DELETE(new Request(`http://localhost/api/routes/${routeId}`, {method: "DELETE"}), {
        params: Promise.resolve({id: routeId}),
      }),
    );

    expect(response.status).toBe(204);
    expect(deleteRouteMock).toHaveBeenCalledWith(routeId, "user-1");
  });
});
