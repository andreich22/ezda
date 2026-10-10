import { describe, expect, it } from "vitest";
import { extractIssueNumber, shouldSkipReleaseByLabels } from "../scripts/release-skip.mjs";

describe("release skip detection", () => {
  it("extracts an issue number from the PR body (case-insensitive)", () => {
    expect(extractIssueNumber("Closes #138")).toBe("138");
    expect(extractIssueNumber("fixes #42")).toBe("42");
    expect(extractIssueNumber("Resolves  #7 | docs")).toBe("7");
    expect(extractIssueNumber("no issue here")).toBeNull();
  });

  it("skips release when the linked issue carries a skip-release label", () => {
    const labels = ["bug", "skip-release"];
    expect(shouldSkipReleaseByLabels(labels)).toBe(true);
  });

  it("runs release when the linked issue has no skip-release label", () => {
    const labels = ["enhancement", "P2"];
    expect(shouldSkipReleaseByLabels(labels)).toBe(false);
  });

  it("runs release when the PR body has no issue number", () => {
    expect(extractIssueNumber("just a chore")).toBeNull();
  });

  it("is safe when labels are missing or malformed", () => {
    expect(shouldSkipReleaseByLabels([])).toBe(false);
    expect(shouldSkipReleaseByLabels(null as never)).toBe(false);
  });
});
