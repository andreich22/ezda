import {describe, expect, it} from "vitest";
import {parseCreateRouteInput} from "../lib/route-validation";

const valid = {
  title: "Morning ride",
  description: "A short test route",
  geometry: {
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates: [[-73.9, 40.6], [-73.8, 40.7]],
    },
  },
  distanceMeters: 1200,
  durationSeconds: 600,
  elevationGainMeters: 40,
};

describe("parseCreateRouteInput", () => {
  it("accepts a valid route and defaults visibility to public", () => {
    expect(parseCreateRouteInput(valid)).toMatchObject({
      title: "Morning ride",
      isPublic: true,
    });
  });

  it("accepts explicit public/private visibility", () => {
    expect(parseCreateRouteInput({...valid, visibility: "private"})).toMatchObject({isPublic: false});
    expect(parseCreateRouteInput({...valid, isPublic: false})).toMatchObject({isPublic: false});
  });

  it("rejects invalid visibility and conflicting visibility fields", () => {
    expect(parseCreateRouteInput({...valid, visibility: "friends"})).toEqual({
      error: "visibility must be public or private",
    });
    expect(parseCreateRouteInput({...valid, visibility: "private", isPublic: true})).toEqual({
      error: "visibility and isPublic must agree",
    });
    expect(parseCreateRouteInput({...valid, isPublic: "private"})).toEqual({
      error: "isPublic must be a boolean",
    });
  });

  it("rejects coordinates outside longitude/latitude bounds", () => {
    expect(parseCreateRouteInput({
      ...valid,
      geometry: {...valid.geometry, geometry: {type: "LineString", coordinates: [[181, 0], [0, 0]]}},
    })).toEqual({error: "geometry contains invalid coordinates"});
  });

  it("rejects non-finite and oversized metrics", () => {
    expect(parseCreateRouteInput({...valid, distanceMeters: Number.NaN})).toEqual({
      error: "distanceMeters must be between 0 and 100000000",
    });
    expect(parseCreateRouteInput({...valid, durationSeconds: 31_536_001})).toEqual({
      error: "durationSeconds must be between 0 and 31536000",
    });
    expect(parseCreateRouteInput({...valid, elevationGainMeters: 10_000_001})).toEqual({
      error: "elevationGainMeters must be between 0 and 10000000",
    });
  });

  it("rejects oversized strings and geometry", () => {
    expect(parseCreateRouteInput({...valid, title: "x".repeat(121)})).toEqual({
      error: "title must be 120 characters or fewer",
    });
    expect(parseCreateRouteInput({...valid, description: "x".repeat(2001)})).toEqual({
      error: "description must be 2000 characters or fewer",
    });
    const coordinates = Array.from({length: 10_001}, (_, index) => [0, index % 90]);
    expect(parseCreateRouteInput({
      ...valid,
      geometry: {...valid.geometry, geometry: {type: "LineString", coordinates}},
    })).toEqual({
      error: "geometry must contain 10000 coordinates or fewer",
    });
  });

  it("rejects malformed GeoJSON coordinates", () => {
    expect(parseCreateRouteInput({
      ...valid,
      geometry: {...valid.geometry, geometry: {type: "LineString", coordinates: [[0, 0, 100, 1], [1, 1]]}},
    })).toEqual({error: "geometry contains invalid coordinates"});
    expect(parseCreateRouteInput({
      ...valid,
      geometry: {...valid.geometry, geometry: {type: "LineString", coordinates: [[0, 0, NaN], [1, 1]]}},
    })).toEqual({error: "geometry contains invalid elevation coordinates"});
  });
});
