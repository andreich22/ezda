import {describe, expect, it} from "vitest";
import {pushHistory, snapshotPoints, undoHistory} from "../lib/route-history";

describe("route history", () => {
  it("stores independent snapshots", () => {
    const points: [number, number][] = [[1, 2]];
    const history = pushHistory([], points);
    points[0][0] = 9;
    expect(history).toEqual([[[1, 2]]]);
  });

  it("undoes the latest snapshot", () => {
    const history = pushHistory(pushHistory([], [[1, 2]]), [[3, 4]]);
    expect(undoHistory(history)).toEqual({
      history: [[[1, 2]]],
      points: [[3, 4]],
    });
  });

  it("returns null when there is nothing to undo", () => {
    expect(undoHistory([])).toEqual({history: [], points: null});
    expect(undoHistory([[]])).toEqual({history: [], points: null});
    expect(snapshotPoints([[1, 2]])).toEqual([[1, 2]]);
  });
});
