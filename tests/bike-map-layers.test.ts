import {describe, expect, it} from "vitest";
import {
  DEFAULT_LAYER_STATE,
  LAYER_SOURCES,
  MVP_INFRA_SOURCE_ID,
  UNKNOWN_MEANS_UNKNOWN,
  createLayerState,
  layerNeedsNotice,
  legendFor,
} from "../lib/bike-map-layers";

describe("bike-map layer contracts (#202 inventory)", () => {
  it("keeps every layer off by default so routing is never blocked", () => {
    for (const state of Object.values(DEFAULT_LAYER_STATE)) {
      expect(state.enabled).toBe(false);
      expect(state.data).toBe("idle");
      expect(state.notice).toBeNull();
    }
  });

  it("encodes the unknown-is-not-absent honesty rule", () => {
    expect(UNKNOWN_MEANS_UNKNOWN).toMatch(/not be presented as absence/i);
    for (const lines of [
      legendFor("cycling-infrastructure"),
      legendFor("surface"),
    ]) {
      expect(lines.join("\n")).toMatch(/unknown/i);
    }
  });

  it("selects the keyless OSM source as the MVP for infra and surface", () => {
    expect(MVP_INFRA_SOURCE_ID).toBe("osm-overpass");
    expect(LAYER_SOURCES["cycling-infrastructure"].id).toBe(
      MVP_INFRA_SOURCE_ID,
    );
    expect(LAYER_SOURCES.surface.id).toBe(MVP_INFRA_SOURCE_ID);
    expect(LAYER_SOURCES["cycling-infrastructure"].attribution).toMatch(
      /OpenStreetMap/,
    );
  });

  it("requests a user notice exactly for empty/error/disabled states", () => {
    const id = "cycling-infrastructure" as const;
    expect(layerNeedsNotice(createLayerState(id, {data: "ready"}))).toBe(false);
    expect(layerNeedsNotice(createLayerState(id, {data: "loading"}))).toBe(
      false,
    );
    expect(layerNeedsNotice(createLayerState(id, {data: "empty"}))).toBe(true);
    expect(layerNeedsNotice(createLayerState(id, {data: "error"}))).toBe(true);
    expect(layerNeedsNotice(createLayerState(id, {data: "disabled"}))).toBe(
      true,
    );
  });

  it("never promises protection, safety, traffic or guarded facilities", () => {
    const infra = legendFor("cycling-infrastructure").join("\n").toLowerCase();
    // The only allowed mention is the explicit disclaimer.
    expect(infra).toMatch(/no statement about protection or safety/);
    const all = [
      legendFor("cycling-infrastructure"),
      legendFor("surface"),
      legendFor("services"),
      legendFor("weather"),
      legendFor("reports"),
    ]
      .flat()
      .join("\n")
      .toLowerCase();
    expect(all).not.toMatch(/guaranteed|traffic intensity|fully safe|100% safe/);
    expect(all).not.toMatch(/protected lane|safe route|guarded/);
  });
});
