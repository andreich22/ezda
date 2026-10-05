import {describe, expect, it} from "vitest";
import {normalizeRoutePagination} from "../lib/route-pagination";

describe("route catalog pagination", () => {
  it("defaults to page 1 and page size 50", () => {
    expect(normalizeRoutePagination(undefined, undefined)).toEqual({page: 1, pageSize: 50});
  });

  it("normalizes invalid pages and caps the requested page size at 50", () => {
    expect(normalizeRoutePagination("0", "100")).toEqual({page: 1, pageSize: 50});
    expect(normalizeRoutePagination("-2", "25")).toEqual({page: 1, pageSize: 25});
    expect(normalizeRoutePagination("3", "10")).toEqual({page: 3, pageSize: 10});
  });
});
