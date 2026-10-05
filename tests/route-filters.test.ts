import {describe, expect, it} from "vitest";
import {normalizeRouteVisibility} from "../lib/route-filters";

describe("route catalog visibility", () => {
  it("supports the public, own, all and private visibility modes for authenticated users", () => {
    expect(normalizeRouteVisibility("public", true)).toBe("public");
    expect(normalizeRouteVisibility("my", true)).toBe("my");
    expect(normalizeRouteVisibility("all", true)).toBe("all");
    expect(normalizeRouteVisibility("private", true)).toBe("private");
  });

  it("forces every filter to public for unauthenticated users", () => {
    expect(normalizeRouteVisibility("my", false)).toBe("public");
    expect(normalizeRouteVisibility("all", false)).toBe("public");
    expect(normalizeRouteVisibility("private", false)).toBe("public");
  });

  it("falls back to public for an unknown filter", () => {
    expect(normalizeRouteVisibility("unknown", true)).toBe("public");
    expect(normalizeRouteVisibility(undefined, true)).toBe("public");
  });
});
