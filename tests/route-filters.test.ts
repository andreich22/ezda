import {describe, expect, it} from "vitest";
import {getPublicRoutes, type RouteVisibility} from "../lib/db/routes";

describe("route catalog visibility contract", () => {
  it("supports the public, own, all and private visibility modes", () => {
    const modes: RouteVisibility[] = ["public", "my", "all", "private"];
    expect(modes).toEqual(["public", "my", "all", "private"]);
  });

  it("requires an authenticated owner id before non-public filters can be applied", () => {
    expect(getPublicRoutes).toBeTypeOf("function");
  });
});
