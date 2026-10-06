import { describe, expect, it } from "vitest";
import {
  isChoreCommit,
  isIgnoredPath,
  shouldIgnore,
} from "../scripts/vercel-ignore.mjs";

describe("Vercel deployment filtering", () => {
  it("ignores repository-only changes", () => {
    expect(isIgnoredPath("README.md")).toBe(true);
    expect(isIgnoredPath("docs/vercel-deployments.md")).toBe(true);
    expect(isIgnoredPath(".github/workflows/ci.yml")).toBe(true);
    expect(isIgnoredPath("tasks/ad3c.json")).toBe(true);
    expect(shouldIgnore(["README.md", "docs/development-workflow.md"])).toBe(true);
  });

  it("ignores chore commits", () => {
    expect(isChoreCommit("chore: ad3c | record task history")).toBe(true);
    expect(
      shouldIgnore(["package.json"], {
        commitMessage: "chore: ad3c | cleanup",
        versionChanged: false,
      }),
    ).toBe(true);
  });

  it("does not ignore version bumps", () => {
    expect(
      shouldIgnore(["package.json"], {
        commitMessage: "chore: 9f2b | bump application version to 0.1.8",
        versionChanged: true,
      }),
    ).toBe(false);
  });

  it("does not ignore application changes", () => {
    expect(isIgnoredPath("app/page.tsx")).toBe(false);
    expect(
      shouldIgnore(["app/page.tsx"], { commitMessage: "feat: ad3c | update page" }),
    ).toBe(false);
  });

  it("does not ignore mixed changes", () => {
    expect(shouldIgnore(["README.md", "app/page.tsx"])).toBe(false);
  });
});
