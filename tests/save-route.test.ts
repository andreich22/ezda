import {afterEach, describe, expect, it, vi} from "vitest";
import {POST} from "../app/api/routes/route";
import {createRoute} from "../lib/db/routes";
import {getCurrentUser} from "../lib/current-user";

vi.mock("../lib/db/routes", () => ({
  createRoute: vi.fn(),
}));

vi.mock("../lib/current-user", () => ({
  getCurrentUser: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue({id: "user-1", email: "user@example.com"});
});

const request = (body: unknown) =>
  new Request("http://localhost/api/routes", {
    method: "POST",
    body: JSON.stringify(body),
  });

const validRoute = {
  title: "Test route",
  geometry: {
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: [[-73, 40], [-72.9, 40.1]],
    },
  },
  distanceMeters: 1000,
};

describe("POST /api/routes", () => {
  it("requires an authenticated user before saving", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const response = await POST(request(validRoute));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({error: "authentication required", code: "AUTH_REQUIRED"});
    expect(createRoute).not.toHaveBeenCalled();
  });

  it("uses the server-side authenticated user as route owner", async () => {
    vi.mocked(createRoute).mockResolvedValue({id: "11111111-1111-1111-1111-111111111111"});

    const response = await POST(request({...validRoute, author_id: "attacker-user"}));

    expect(response.status).toBe(201);
    expect(createRoute).toHaveBeenCalledWith(expect.objectContaining({title: "Test route"}), "user-1");
    expect(vi.mocked(createRoute).mock.calls[0][0]).not.toHaveProperty("author_id");
  });
  it("rejects invalid geometry", async () => {
    const response = await POST(request({
      ...validRoute,
      geometry: {
        type: "Feature",
        geometry: {type: "Point", coordinates: [-73, 40]},
      },
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "geometry must be a LineString",
      code: "VALIDATION_ERROR",
    });
    expect(createRoute).not.toHaveBeenCalled();
  });

  it("rejects missing title", async () => {
    const {title: _, ...body} = validRoute;
    const response = await POST(request(body));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({error: "title is required", code: "VALIDATION_ERROR"});
  });

  it("rejects malformed JSON", async () => {
    const response = await POST(new Request("http://localhost/api/routes", {
      method: "POST",
      body: "{",
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({error: "invalid JSON body", code: "INVALID_JSON"});
  });

  it("rejects invalid request values", async () => {
    const cases = [
      [null, "invalid request body"],
      ["just a string", "invalid request body"],
      [{title: "x"}, "geometry is required"],
      [{...validRoute, geometry: "LineString"}, "geometry is required"],
      [{...validRoute, geometry: {type: "Point"}}, "geometry must be a GeoJSON Feature"],
      [{...validRoute, geometry: {type: "Feature"}}, "geometry must contain a LineString"],
      [{...validRoute, geometry: {type: "Feature", geometry: "LineString"}}, "geometry must contain a LineString"],
      [{...validRoute, geometry: {type: "Feature", geometry: {type: "LineString", coordinates: [[-73, 40]]}}}, "geometry must contain at least two coordinates"],
      [{...validRoute, geometry: {type: "Feature", geometry: {type: "LineString", coordinates: "nope"}}}, "geometry must contain at least two coordinates"],
      [{...validRoute, geometry: {type: "Feature", geometry: {type: "LineString", coordinates: [1, 2]}}}, "geometry contains invalid coordinates"],
      [{...validRoute, geometry: {type: "Feature", geometry: {type: "LineString", coordinates: [[-73], [-72, 40]]}}}, "geometry contains invalid coordinates"],
      [{...validRoute, geometry: {type: "Feature", geometry: {type: "LineString", coordinates: [[-181, 40], [-72, 40]]}}}, "geometry contains invalid coordinates"],
      [{...validRoute, geometry: {type: "Feature", geometry: {type: "LineString", coordinates: [[181, 40], [-72, 40]]}}}, "geometry contains invalid coordinates"],
      [{...validRoute, geometry: {type: "Feature", geometry: {type: "LineString", coordinates: [[-73, null], [-72, 40]]}}}, "geometry contains invalid coordinates"],
      [{...validRoute, geometry: {type: "Feature", geometry: {type: "LineString", coordinates: [[null, 40], [-72, 40]]}}}, "geometry contains invalid coordinates"],
      [{...validRoute, geometry: {type: "Feature", geometry: {type: "LineString", coordinates: [[-73, -91], [-72, 40]]}}}, "geometry contains invalid coordinates"],
      [{...validRoute, geometry: {type: "Feature", geometry: {type: "LineString", coordinates: [[-73, 91], [-72, 40]]}}}, "geometry contains invalid coordinates"],
      [{...validRoute, distanceMeters: -1}, "distanceMeters must be between 0 and 100000000"],
      [{...validRoute, durationSeconds: -1}, "durationSeconds must be between 0 and 31536000"],
      [{...validRoute, elevationGainMeters: -1}, "elevationGainMeters must be between 0 and 10000000"],
      [{...validRoute, description: 123}, "description must be a string"],
      [{...validRoute, title: " ".repeat(121)}, "title is required"],
      [{...validRoute, title: "x".repeat(121)}, "title must be 120 characters or fewer"],
    ] as const;

    for (const [body, error] of cases) {
      const response = await POST(request(body));
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({error, code: "VALIDATION_ERROR"});
    }
  });

  it("rejects an oversized request body before parsing or persistence", async () => {
    const response = await POST(new Request("http://localhost/api/routes", {
      method: "POST",
      body: "x".repeat(256 * 1024 + 1),
    }));

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({error: "request body is too large", code: "BODY_TOO_LARGE"});
    expect(createRoute).not.toHaveBeenCalled();
  });

  it("validates and persists explicit private visibility", async () => {
    vi.mocked(createRoute).mockResolvedValue({id: "11111111-1111-1111-1111-111111111111"});

    const response = await POST(request({...validRoute, visibility: "private"}));

    expect(response.status).toBe(201);
    expect(createRoute).toHaveBeenCalledWith(expect.objectContaining({isPublic: false}), "user-1");
  });

  it("normalizes optional values and extra coordinate dimensions", async () => {
    vi.mocked(createRoute).mockResolvedValue({id: "11111111-1111-1111-1111-111111111111"});

    const response = await POST(request({
      ...validRoute,
      title: "  Prospect Park Loop  ",
      description: "  A short ride  ",
      geometry: {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [[-73.97, 40.66, 12], [-73.96, 40.67, 15]],
        },
      },
      durationSeconds: null,
      elevationGainMeters: null,
    }));

    expect(response.status).toBe(201);
    expect(createRoute).toHaveBeenCalledWith(expect.objectContaining({
      title: "Prospect Park Loop",
      description: "A short ride",
      durationSeconds: null,
      elevationGainMeters: null,
      geometry: {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: [[-73.97, 40.66], [-73.96, 40.67]],
        },
      },
    }), "user-1");
  });

  it("treats a whitespace-only description as absent", async () => {
    vi.mocked(createRoute).mockResolvedValue({id: "11111111-1111-1111-1111-111111111111"});

    const response = await POST(request({...validRoute, description: "   "}));

    expect(response.status).toBe(201);
    expect(createRoute).toHaveBeenCalledWith(expect.objectContaining({description: null}), "user-1");
  });

  it("rejects an overlong description", async () => {
    const response = await POST(request({...validRoute, description: "x".repeat(2001)}));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "description must be 2000 characters or fewer",
      code: "VALIDATION_ERROR",
    });
  });

  it("rejects non-finite or invalid optional metrics", async () => {
    const cases = [
      ["distanceMeters", "far"],
      ["durationSeconds", "slow"],
      ["elevationGainMeters", "high"],
    ] as const;

    for (const [field, value] of cases) {
      const response = await POST(request({...validRoute, [field]: value}));
      expect(response.status).toBe(400);
      expect((await response.json()).error).toContain(field);
    }
  });

  it("returns 500 when route persistence fails", async () => {
    vi.mocked(createRoute).mockRejectedValue(new Error("database unavailable"));

    const response = await POST(request(validRoute));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({error: "Unable to save route", code: "SAVE_FAILED"});
  });

  it("creates a route and returns its public URL", async () => {
    vi.mocked(createRoute).mockResolvedValue({id: "11111111-1111-1111-1111-111111111111"});

    const response = await POST(request({
      ...validRoute,
      title: "Prospect Park Loop",
      description: "A short ride",
      durationSeconds: 600,
      elevationGainMeters: 30,
    }));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      id: "11111111-1111-1111-1111-111111111111",
      url: "/routes/11111111-1111-1111-1111-111111111111",
    });
    expect(createRoute).toHaveBeenCalledOnce();
  });
});
