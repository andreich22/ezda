import {describe, expect, it} from "vitest";
import {toEditInitialState} from "../lib/route-edit";
import type {EditableRoute} from "../lib/db/routes";

function editableRoute(overrides: Partial<EditableRoute> = {}): EditableRoute {
  return {
    id: "11111111-1111-1111-8111-111111111111",
    authorId: "user-1",
    title: "Morning loop",
    description: "Easy ride",
    distanceMeters: 5000,
    durationSeconds: 1500,
    elevationGainMeters: 42,
    createdAt: "2026-10-01T00:00:00Z",
    isPublic: true,
    waypoints: [[37.6, 55.75], [37.65, 55.76]],
    geometry: {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [[37.6, 55.75], [37.65, 55.76]],
      },
    },
    ...overrides,
  };
}

describe("toEditInitialState", () => {
  it("prefers saved waypoints and passes title, description and visibility through", () => {
    expect(toEditInitialState(editableRoute())).toEqual({
      points: [[37.6, 55.75], [37.65, 55.76]],
      title: "Morning loop",
      description: "Easy ride",
      isPublic: true,
    });
  });

  it("preserves private visibility so an edit never flips a route public", () => {
    expect(toEditInitialState(editableRoute({isPublic: false})).isPublic).toBe(false);
  });

  it("falls back to geometry coordinates when waypoints are missing", () => {
    const state = toEditInitialState(
      editableRoute({
        waypoints: null,
        geometry: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [[10, 20, 5], [11, 21, 6], [12, 22]],
          },
        },
      }),
    );

    expect(state.points).toEqual([[10, 20], [11, 21], [12, 22]]);
  });

  it("drops invalid waypoint entries instead of breaking the editor", () => {
    const state = toEditInitialState(
      editableRoute({waypoints: [[37.6, 55.75], [999, 55.7], "nope", [37.65, 55.76]] as unknown as number[][]}),
    );

    expect(state.points).toEqual([[37.6, 55.75], [37.65, 55.76]]);
  });

  it("starts empty when neither waypoints nor usable geometry exist", () => {
    const state = toEditInitialState(
      editableRoute({waypoints: [], geometry: {type: "Feature", properties: {}, geometry: null}}),
    );

    expect(state.points).toEqual([]);
    expect(state.title).toBe("Morning loop");
  });

  it("thins very long geometry to the waypoint limit", () => {
    const coordinates = Array.from({length: 1200}, (_, i) => [30 + i * 0.001, 50]);
    const state = toEditInitialState(
      editableRoute({
        waypoints: null,
        geometry: {
          type: "Feature",
          properties: {},
          geometry: {type: "LineString", coordinates},
        },
      }),
    );

    expect(state.points.length).toBeLessThanOrEqual(500);
    expect(state.points[0]).toEqual([30, 50]);
  });

  it("defaults a missing description to an empty string", () => {
    expect(toEditInitialState(editableRoute({description: null})).description).toBe("");
  });
});
