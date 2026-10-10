import {afterEach, describe, expect, it, vi} from "vitest";
import {POST as routePOST} from "../app/api/route/route";
import {POST as savePOST} from "../app/api/routes/route";
import {friendlyRoutingError, friendlySaveError} from "../lib/route-error-messages";
import {createRoute} from "../lib/db/routes";
import {getCurrentUser} from "../lib/current-user";

vi.mock("../lib/db/routes", () => ({
  createRoute: vi.fn(),
}));

vi.mock("../lib/current-user", () => ({
  getCurrentUser: vi.fn(),
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

const postRoute = (body: unknown) =>
  routePOST(
    new Request("http://localhost/api/route", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

describe("TASK-e3f4 routing error handling", () => {
  it("rejects out-of-range coordinates as a validation error with a stable code", async () => {
    vi.stubEnv("ORS_API_KEY", "");
    const response = await postRoute({
      points: [
        [-200, 40],
        [30, 40],
      ],
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "at least two route points are required",
      code: "ROUTING_REQUEST_INVALID",
    });
  });

  it("rejects latitude outside -90..90 as invalid routing input", async () => {
    vi.stubEnv("ORS_API_KEY", "");
    const response = await postRoute({
      points: [
        [30, 95],
        [31, 40],
      ],
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("ROUTING_REQUEST_INVALID");
  });

  it("falls back to a straight line when the provider times out", async () => {
    vi.stubEnv("ORS_API_KEY", "test-key");
    const timeoutError = new Error("The operation timed out");
    timeoutError.name = "TimeoutError";
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(timeoutError)
      .mockRejectedValueOnce(timeoutError);

    const points = [
      [-73.9, 40.6],
      [-73.8, 40.7],
    ];
    const warnMock = vi.spyOn(console, "warn").mockImplementation(() => {});
    const response = await postRoute({points});
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(body.source).toBe("Straight-line fallback");
    expect(body.geometry.geometry.coordinates).toEqual(points);
    expect(warnMock).toHaveBeenCalled();
  });

  it("sends an abort signal so provider requests cannot hang forever", async () => {
    vi.stubEnv("ORS_API_KEY", "");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({routes: []}), {status: 200}));

    await postRoute({
      points: [
        [-73.9, 40.6],
        [-73.8, 40.7],
      ],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({signal: expect.any(AbortSignal)});
  });

  it("never exposes the routing API key in responses", async () => {
    vi.stubEnv("ORS_API_KEY", "super-secret-key");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const response = await postRoute({
      points: [
        [-73.9, 40.6],
        [-73.8, 40.7],
      ],
    });
    const raw = await response.text();

    expect(raw).not.toContain("super-secret-key");
  });
});

describe("TASK-e3f4 save error handling", () => {
  const validRoute = {
    title: "Test route",
    geometry: {
      type: "Feature",
      geometry: {type: "LineString", coordinates: [[-73, 40], [-72.9, 40.1]]},
    },
    distanceMeters: 1000,
  };
  const request = (body: unknown) =>
    new Request("http://localhost/api/routes", {
      method: "POST",
      body: JSON.stringify(body),
    });

  it("returns a stable code for validation failures", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({id: "user-1", email: "u@example.com"});
    const response = await savePOST(request({...validRoute, title: "  "}));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "title is required",
      code: "VALIDATION_ERROR",
    });
    expect(createRoute).not.toHaveBeenCalled();
  });

  it("hides database internals behind SAVE_FAILED without leaking details", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({id: "user-1", email: "u@example.com"});
    vi.mocked(createRoute).mockRejectedValue(
      new Error("connect postgres://secret:password@internal/db failed"),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await savePOST(request(validRoute));
    const raw = await response.text();

    expect(response.status).toBe(500);
    expect(JSON.parse(raw)).toEqual({error: "Unable to save route", code: "SAVE_FAILED"});
    expect(raw).not.toContain("postgres://");
    expect(raw).not.toContain("password");
  });
});

describe("TASK-e3f4 friendly UI messages", () => {
  it("maps routing codes to short actionable messages without stack traces", () => {
    expect(friendlyRoutingError("ROUTING_REQUEST_INVALID")).toBe(
      "Check the selected points and try again.",
    );
    expect(friendlyRoutingError("SOME_UNKNOWN_CODE")).toBe(
      "Couldn't build the route. Try again or change the points.",
    );
    expect(friendlyRoutingError(undefined)).not.toMatch(/Error|at Object|node_modules/i);
  });

  it("maps save codes to short actionable messages", () => {
    expect(friendlySaveError("AUTH_REQUIRED")).toBe("Please sign in to save routes.");
    expect(friendlySaveError("VALIDATION_ERROR")).toBe(
      "Check the title and route data, then try again.",
    );
    expect(friendlySaveError("SAVE_FAILED")).toBe("Couldn't save the route. Try again.");
    expect(friendlySaveError(undefined)).toBe("Couldn't save the route. Try again.");
  });
});
