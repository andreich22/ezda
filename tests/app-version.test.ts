import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { APP_VERSION } from "../lib/app-version";

const root = path.resolve(process.cwd());

describe("application version source", () => {
  it("uses package.json as the single source of truth", () => {
    const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as { version: string };

    expect(APP_VERSION).toBe(packageJson.version);
  });

  it("does not hardcode a version in the home page", () => {
    const page = readFileSync(path.join(root, "app", "page.tsx"), "utf8");

    expect(page).toContain('import { APP_VERSION } from "../lib/app-version";');
    expect(page).not.toMatch(/const APP_VERSION = ["']\\d+\\.\\d+\\.\\d+/);
  });
});
