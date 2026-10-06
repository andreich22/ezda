import { describe, expect, it } from "vitest";
import { isIgnoredPath, shouldIgnore } from "../scripts/vercel-ignore.mjs";

describe("Vercel deployment filtering", () => {
  it("ignores repository-only changes", () => {
    expect(isIgnoredPath("README.md")).toBe(true);
    expect(isIgnoredPath("docs/vercel-deployments.md")).toBe(true);
    expect(isIgnoredPath(".github/workflows/ci.yml")).toBe(true);
    expect(isIgnoredPath("tasks/ad3c.json")).toBe(true);
    expect(shouldIgnore(["README.md", "docs/development-workflow.md"])).toBe(true);
  });

  it("does not ignore application changes", () => {
    expect(isIgnoredPath("app/page.tsx")).toBe(false);
    expect(shouldIgnore(["app/page.tsx"])).toBe(false);
  });

  it("does not ignore mixed changes", () => {
    expect(shouldIgnore(["README.md", "app/page.tsx"])).toBe(false);
  });
});
