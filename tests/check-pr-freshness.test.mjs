import { describe, expect, it } from "vitest";
import { evaluateFreshness } from "../scripts/check-pr-freshness.mjs";

describe("evaluateFreshness", () => {
  it("accepts a PR head that contains the current base", () => {
    expect(evaluateFreshness({
      baseRef: "main",
      baseSha: "base-sha",
      headSha: "head-sha",
      isAncestor: true,
    })).toEqual({
      ok: true,
      message: "PR head head-sha includes current main base base-sha.",
    });
  });

  it("rejects a stale branch and reports the compared SHAs", () => {
    const result = evaluateFreshness({
      baseRef: "main",
      baseSha: "new-base",
      headSha: "old-head",
      isAncestor: false,
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("base new-base");
    expect(result.message).toContain("head old-head");
    expect(result.message).toContain("Update/rebase");
  });

  it("fails closed when refs or comparison results are unavailable", () => {
    expect(evaluateFreshness({
      baseRef: "main",
      baseSha: "",
      headSha: "head",
      isAncestor: false,
    }).ok).toBe(false);
    expect(evaluateFreshness({
      baseRef: "main",
      baseSha: "base",
      headSha: "head",
      isAncestor: undefined,
    }).ok).toBe(false);
  });
});
