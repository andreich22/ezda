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

afterEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue({id: "user-1", email: "user@example.com"});
});

describe("PATCH /api/routes/:id", () => {
  it("requires authentication", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const response = await PATCH(request(requestBody), {params: Promise.resolve({id: routeId})});

    expect(response.status).toBe(401);
    expect(getRouteOwnership).not.toHaveBeenCalled();
    expect(updateRoute).not.toHaveBeenCalled();
  });

  it("returns 404 for malformed ids", async () => {
    const response = await PATCH(request(requestBody), {params: Promise.resolve({id: "not-a-uuid"})});

    expect(response.status).toBe(404);
    expect(getRouteOwnership).not.toHaveBeenCalled();
  });

  it("returns 404 for an absent route", async () => {
    vi.mocked(getRouteOwnership).mockResolvedValue(null);

    const response = await PATCH(request(requestBody), {params: Promise.resolve({id: routeId})});

    expect(response.status).toBe(404);
    expect(updateRoute).not.toHaveBeenCalled();
  });

  it("returns 403 for another user's route", async () => {
    vi.mocked(getRouteOwnership).mockResolvedValue({id: routeId, authorId: "user-2"});

    const response = await PATCH(request(requestBody), {params: Promise.resolve({id: routeId})});

    expect(response.status).toBe(403);
    expect(updateRoute).not.toHaveBeenCalled();
  });

  it("updates only an owned route", async () => {
    vi.mocked(getRouteOwnership).mockResolvedValue({id: routeId, authorId: "user-1"});
    vi.mocked(updateRoute).mockResolvedValue({id: routeId});

    const response = await PATCH(request(requestBody), {params: Promise.resolve({id: routeId})});

    expect(response.status).toBe(200);
    expect(updateRoute).toHaveBeenCalledWith(
      routeId,
      "user-1",
      expect.objectContaining({title: "Updated route", isPublic: true}),
    );
  });

  it("does not let the request body choose the owner", async () => {
    vi.mocked(getRouteOwnership).mockResolvedValue({id: routeId, authorId: "user-1"});
    vi.mocked(updateRoute).mockResolvedValue({id: routeId});

    const response = await PATCH(
      request({...requestBody, author_id: "user-2"}),
      {params: Promise.resolve({id: routeId})},
    );

    expect(response.status).toBe(200);
    expect(updateRoute).toHaveBeenCalledWith(routeId, "user-1", expect.anything());
    expect(updateRoute.mock.calls[0][2]).not.toHaveProperty("author_id");
  });
});

describe("DELETE /api/routes/:id", () => {
  it("requires authentication", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const response = await DELETE(new Request(`http://localhost/api/routes/${routeId}`, {method: "DELETE"}), {
      params: Promise.resolve({id: routeId}),
    });

    expect(response.status).toBe(401);
    expect(deleteRoute).not.toHaveBeenCalled();
  });

  it("returns 404 for malformed ids", async () => {
    const response = await DELETE(new Request("http://localhost/api/routes/not-a-uuid", {method: "DELETE"}), {
      params: Promise.resolve({id: "not-a-uuid"}),
    });

    expect(response.status).toBe(404);
    expect(deleteRoute).not.toHaveBeenCalled();
  });

  it("returns 404 for an absent route", async () => {
    vi.mocked(getRouteOwnership).mockResolvedValue(null);

    const response = await DELETE(new Request(`http://localhost/api/routes/${routeId}`, {method: "DELETE"}), {
      params: Promise.resolve({id: routeId}),
    });

    expect(response.status).toBe(404);
    expect(deleteRoute).not.toHaveBeenCalled();
  });

  it("returns 403 for another user's route", async () => {
    vi.mocked(getRouteOwnership).mockResolvedValue({id: routeId, authorId: "user-2"});

    const response = await DELETE(new Request(`http://localhost/api/routes/${routeId}`, {method: "DELETE"}), {
      params: Promise.resolve({id: routeId}),
    });

    expect(response.status).toBe(403);
    expect(deleteRoute).not.toHaveBeenCalled();
  });

  it("deletes only an owned route", async () => {
    vi.mocked(getRouteOwnership).mockResolvedValue({id: routeId, authorId: "user-1"});
    vi.mocked(deleteRoute).mockResolvedValue({id: routeId});

    const response = await DELETE(new Request(`http://localhost/api/routes/${routeId}`, {method: "DELETE"}), {
      params: Promise.resolve({id: routeId}),
    });

    expect(response.status).toBe(204);
    expect(deleteRoute).toHaveBeenCalledWith(routeId, "user-1");
  });
});
