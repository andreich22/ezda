import {describe, expect, it, vi, afterEach} from "vitest";
import {
  BBOX_KEY_PRECISION,
  MAX_BBOX_SPAN_DEG,
  bboxKey,
  bboxOfCoordinates,
  buildOverpassQuery,
  classifyInfraKind,
  classifySurface,
  describeOverpassFailure,
  fetchBikeWays,
  formatBbox,
  isBboxTooLarge,
  wayElementsToLayers,
  type OverpassBbox,
  type OverpassWay,
} from "../lib/bike-map-overpass";

afterEach(() => {
  vi.restoreAllMocks();
});

const bbox: OverpassBbox = {south: 55.7, west: 37.5, north: 55.8, east: 37.7};

describe("bbox helpers", () => {
  it("builds a padded bbox from route coordinates", () => {
    const result = bboxOfCoordinates(
      [
        [37.6, 55.75],
        [37.65, 55.77],
      ],
      0.01,
    );
    expect(result).toEqual({south: 55.74, west: 37.59, north: 55.78, east: 37.66});
  });

  it("returns null without valid coordinates and skips bad entries", () => {
    expect(bboxOfCoordinates([])).toBeNull();
    expect(bboxOfCoordinates([[NaN, 1]])).toBeNull();
    const result = bboxOfCoordinates([[37.6, 55.75], [NaN, NaN], [37.6]], 0);
    expect(result).toEqual({south: 55.75, west: 37.6, north: 55.75, east: 37.6});
  });

  it("clamps padding at the antimeridian and poles", () => {
    const result = bboxOfCoordinates([[179.999, 89.999]], 1);
    expect(result).toEqual({south: 88.999, west: 178.999, north: 90, east: 180});
  });

  it("refuses oversized areas for fair use", () => {
    expect(isBboxTooLarge(bbox)).toBe(false);
    expect(
      isBboxTooLarge({south: 0, west: 0, north: MAX_BBOX_SPAN_DEG + 0.1, east: 0.1}),
    ).toBe(true);
  });

  it("produces stable rounded cache keys", () => {
    const a = bboxKey({south: 55.70001, west: 37.50001, north: 55.8, east: 37.7});
    const b = bboxKey({south: 55.70004, west: 37.50004, north: 55.8, east: 37.7});
    expect(a).toBe(b);
    expect(a.split(",")).toHaveLength(4);
    expect(a.split(",")[0].split(".")[1]).toHaveLength(BBOX_KEY_PRECISION);
  });

  it("formats bbox in Overpass south,west,north,east order", () => {
    expect(formatBbox(bbox)).toBe("55.70000,37.50000,55.80000,37.70000");
  });
});

describe("overpass query", () => {
  it("requests cycleways, lanes, designated sections and surfaces with geometry", () => {
    const query = buildOverpassQuery(bbox);
    expect(query).toContain(formatBbox(bbox));
    expect(query).toContain('way["highway"="cycleway"]');
    expect(query).toContain('way["cycleway"]');
    expect(query).toContain('way["bicycle"="designated"]');
    expect(query).toContain('way["highway"]["surface"]');
    expect(query).toContain("out geom;");
  });
});

describe("classifyInfraKind", () => {
  it("detects tracks, lanes and designated sections", () => {
    expect(classifyInfraKind({highway: "cycleway"})).toBe("cycleway");
    expect(classifyInfraKind({highway: "residential", cycleway: "track"})).toBe(
      "cycleway",
    );
    expect(classifyInfraKind({highway: "residential", cycleway: "lane"})).toBe(
      "lane",
    );
    expect(
      classifyInfraKind({highway: "residential", "cycleway:right": "shared_lane"}),
    ).toBe("lane");
    expect(
      classifyInfraKind({highway: "path", bicycle: "designated"}),
    ).toBe("designated");
  });

  it("returns null for untagged, excluded or irrelevant ways", () => {
    expect(classifyInfraKind(undefined)).toBeNull();
    expect(classifyInfraKind({})).toBeNull();
    expect(classifyInfraKind({highway: "residential"})).toBeNull();
    expect(classifyInfraKind({highway: "residential", cycleway: "no"})).toBeNull();
    expect(
      classifyInfraKind({highway: "residential", cycleway: "separate"}),
    ).toBeNull();
    expect(classifyInfraKind({highway: "footway"})).toBeNull();
  });
});

describe("classifySurface", () => {
  it("maps known surfaces and keeps the rest unknown", () => {
    expect(classifySurface("asphalt")).toBe("asphalt");
    expect(classifySurface("gravel")).toBe("unpaved");
    expect(classifySurface("ground")).toBe("unpaved");
    expect(classifySurface("paving_stones")).toBe("paved-other");
    expect(classifySurface("sett")).toBe("paved-other");
    expect(classifySurface(undefined)).toBe("unknown");
    expect(classifySurface("")).toBe("unknown");
    expect(classifySurface("aeroway_runway")).toBe("unknown");
  });
});

describe("wayElementsToLayers", () => {
  const ways: OverpassWay[] = [
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
    {
      type: "way",
      id: 3,
      tags: {highway: "residential", cycleway: "lane"},
      geometry: [
        {lat: 55.75, lon: 37.6},
        {lat: 55.76, lon: 37.63},
      ],
    },
    {type: "way", id: 4, tags: {highway: "cycleway"}},
    {
      type: "way",
      id: 5,
      tags: {highway: "cycleway", surface: "asphalt"},
      geometry: [{lat: 55.75, lon: 37.6}],
    },
  ];

  it("splits infra and surface layers and skips geometry-less ways", () => {
    const {infra, surface} = wayElementsToLayers(ways);
    expect(infra.map((f) => f.properties.kind)).toEqual([
      "cycleway",
      "lane",
    ]);
    expect(surface.map((f) => f.properties.surface)).toEqual([
      "asphalt",
      "unpaved",
    ]);
    expect(infra[0].geometry.coordinates).toEqual([
      [37.6, 55.75],
      [37.61, 55.76],
    ]);
  });

  it("keeps untagged surface out of the surface layer", () => {
    const {surface} = wayElementsToLayers(ways);
    expect(surface.every((f) => f.properties.surface !== "unknown")).toBe(true);
  });
});

describe("fetchBikeWays", () => {
  it("posts the query and returns way elements", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          elements: [{type: "way", id: 1, tags: {}, geometry: []}],
        }),
        {status: 200},
      ),
    );
    const ways = await fetchBikeWays(bbox);
    expect(ways).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("overpass"),
      expect.objectContaining({method: "POST"}),
    );
  });

  it("throws on upstream errors and unusable payloads", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("busy", {status: 429}),
    );
    await expect(fetchBikeWays(bbox)).rejects.toThrow(/status 429/);
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({elements: "nope"}), {status: 200}),
    );
    await expect(fetchBikeWays(bbox)).rejects.toThrow(/unusable/);
  });

  it("describes failures without blaming the route", () => {
    const timeout = new Error("aborted");
    timeout.name = "TimeoutError";
    expect(describeOverpassFailure(timeout)).toMatch(/route is unaffected/i);
    expect(describeOverpassFailure(new Error("500"))).toMatch(
      /temporarily unavailable.*route is unaffected/i,
    );
  });
});
