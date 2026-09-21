import { describe, expect, it } from "vitest";
import { parseSidebarCollapsed } from "../lib/sidebar-state";

describe("parseSidebarCollapsed", () => {
  it("restores a persisted collapsed state", () => {
    expect(parseSidebarCollapsed("true")).toBe(true);
    expect(parseSidebarCollapsed("false")).toBe(false);
  });

  it("defaults invalid or missing values to expanded", () => {
    expect(parseSidebarCollapsed(null)).toBe(false);
    expect(parseSidebarCollapsed("1")).toBe(false);
    expect(parseSidebarCollapsed("")).toBe(false);
  });
});
