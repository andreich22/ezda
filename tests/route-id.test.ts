import {describe, expect, it} from "vitest";
import {isValidRouteId} from "../lib/route-id";

describe("isValidRouteId", () => {
  it("accepts canonical UUID route ids", () => {
    expect(isValidRouteId("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  it("rejects malformed ids before database access", () => {
    expect(isValidRouteId("550e8400-e29b-41d4-a716-44665544000-")).toBe(false);
    expect(isValidRouteId("550e8400e29b41d4a716446655440000")).toBe(false);
    expect(isValidRouteId("not-a-route-id")).toBe(false);
  });
});
