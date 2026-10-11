import {describe, expect, it, vi, afterEach} from "vitest";
import {POST} from "../app/api/bike-layers/route";

afterEach(() => {
  vi.restoreAllMocks();
});

const bbox = {south: 55.7, west: 37.5, north: 55.8, east: 37.7};

function request(body: unknown) {
  return new Request("http://localhost/api/bike-layers", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const overpassPayload = {
  elements: [
    {
      type: "way",
      id: 1,
      tags: {highway: "cycleway", surface: "asphalt"},
      geometry: [
        {lat: 55.75, lon: 37.6},
        {lat: 55.76, lon: 37.61},
      ],
    },
    {
      type: "way",
      id: 2,
      tags: {highway: "residential", surface: "gravel"},
      geometry: [
        {lat: 55.75, lon: 37.6},
        {lat: 55.76, lon: 37.62},
      ],
    },
  ],
};

describe("POST /api/bike-layers", () => {
  it("rejects requests without a valid bbox", async () => {
    for (const body of [
      {},
      {bbox: null},
      {bbox: {south: 55.7, west: 37.5}},
      {bbox: {...bbox, south: 60}},
      {bbox: {...bbox, west: 200}},
      {bbox: {...bbox, south: NaN}},
    ]) {
      const response = await POST(request(body));
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        code: "LAYERS_REQUEST_INVALID",
      });
    }
  });

  it("rejects oversized areas", async () => {
    const response = await POST(
      request({bbox: {south: 0, west: 0, north: 10, east: 10}}),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "LAYERS_REQUEST_INVALID",
    });
  });

  it("rejects malformed JSON", async () => {
    const response = await POST(
      new Request("http://localhost/api/bike-layers", {
        method: "POST",
        body: "{not json",
      }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "INVALID_JSON",
    });
  });

  it("returns parsed infra and surface layers from Overpass", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(overpassPayload), {status: 200}),
    );
    const response = await POST(request({bbox}));
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("overpass"),
      expect.objectContaining({method: "POST"}),
    );
    const data = await response.json();
    expect(data.infra).toHaveLength(1);
    expect(data.infra[0].properties.kind).toBe("cycleway");
    expect(data.source).toMatch(/overpass/);
    expect(data.surface).toHaveLength(2);
    expect(data.surface.map((f: {properties: {surface: string}}) => f.properties.surface)).toEqual([
      "asphalt",
      "unpaved",
    ]);
  });

  it("maps upstream failures to a predictable 502 without internals", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("busy", {status: 429}),
    );
    const response = await POST(request({bbox}));
    expect(response.status).toBe(502);
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
    await expect(response.json()).resolves.toEqual({
      error: "Bike data is temporarily unavailable",
      code: "LOAD_FAILED",
    });
  });

  it("maps unusable upstream payloads to 502", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({elements: []}), {status: 200}),
    );
    const empty = await POST(request({bbox}));
    expect(empty.status).toBe(200);
    await expect(empty.json()).resolves.toMatchObject({infra: [], surface: []});

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({nope: true}), {status: 200}),
    );
    const broken = await POST(request({bbox}));
    expect(broken.status).toBe(502);
  });
});
