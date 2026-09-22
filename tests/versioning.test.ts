import {execFileSync, spawnSync} from "node:child_process";
import {mkdtempSync, rmSync, writeFileSync} from "node:fs";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {describe, expect, it} from "vitest";
import {
  assertTagConsistency,
  assertVersionIncreased,
  compareVersions,
} from "../scripts/version-utils.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const validateScript = path.join(root, "scripts", "validate-version.mjs");
const mergeScript = path.join(root, "scripts", "validate-merge-version.mjs");

function runValidateVersion(cwd: string) {
  return spawnSync(process.execPath, [validateScript], {
    cwd,
    encoding: "utf8",
  });
}

function withFixture(packageVersion: string, lockVersion = packageVersion, rootLockVersion = lockVersion) {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "ezda-version-"));
  writeFileSync(
    path.join(cwd, "package.json"),
    JSON.stringify({name: "fixture", version: packageVersion}),
  );
  writeFileSync(
    path.join(cwd, "package-lock.json"),
    JSON.stringify({
      name: "fixture",
      version: lockVersion,
      lockfileVersion: 3,
      packages: {"": {name: "fixture", version: rootLockVersion}},
    }),
  );
  return cwd;
}

describe("application version validation", () => {
  it("accepts a valid version and matching lockfile", () => {
    const cwd = withFixture("0.0.19");
    const result = runValidateVersion(cwd);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Application version: 0.0.19");
    rmSync(cwd, {recursive: true, force: true});
  });

  it("rejects an invalid version", () => {
    const cwd = withFixture("0.0");
    const result = runValidateVersion(cwd);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Invalid application version");
    rmSync(cwd, {recursive: true, force: true});
  });

  it("rejects package.json/package-lock.json mismatch", () => {
    const cwd = withFixture("0.0.19", "0.0.18");
    const result = runValidateVersion(cwd);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("package-lock.json version does not match");
    rmSync(cwd, {recursive: true, force: true});
  });

  it("rejects a mismatched lockfile root package version", () => {
    const cwd = withFixture("0.0.19", "0.0.19", "0.0.18");
    const result = runValidateVersion(cwd);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("package-lock.json root package version");
    rmSync(cwd, {recursive: true, force: true});
  });
});

describe("semantic version comparisons", () => {
  it("compares 0.0.9 below 0.0.10 numerically", () => {
    expect(compareVersions("0.0.9", "0.0.10")).toBeLessThan(0);
  });

  it("accepts patch, minor, and major increases", () => {
    expect(() => assertVersionIncreased("0.0.18", "0.0.19")).not.toThrow();
    expect(() => assertVersionIncreased("0.0.18", "0.1.0")).not.toThrow();
    expect(() => assertVersionIncreased("0.0.18", "1.0.0")).not.toThrow();
  });

  it("rejects equal and decreasing versions", () => {
    expect(() => assertVersionIncreased("0.0.18", "0.0.18")).toThrow();
    expect(() => assertVersionIncreased("0.0.18", "0.0.17")).toThrow();
  });

  it("supports standard prerelease and build metadata", () => {
    expect(() => assertVersionIncreased("1.0.0-beta.1", "1.0.0")).not.toThrow();
    expect(compareVersions("1.0.0+build.1", "1.0.0+build.2")).toBe(0);
  });
});

describe("release tag consistency", () => {
  it("allows a missing tag", () => {
    expect(() =>
      assertTagConsistency({
        tagExists: false,
        tagCommit: undefined,
        mergeSha: "abc",
        tagName: "v0.0.19",
      }),
    ).not.toThrow();
  });

  it("allows an existing tag on the merge commit", () => {
    expect(() =>
      assertTagConsistency({
        tagExists: true,
        tagCommit: "abc",
        mergeSha: "abc",
        tagName: "v0.0.19",
      }),
    ).not.toThrow();
  });

  it("rejects an existing tag pointing elsewhere", () => {
    expect(() =>
      assertTagConsistency({
        tagExists: true,
        tagCommit: "def",
        mergeSha: "abc",
        tagName: "v0.0.19",
      }),
    ).toThrow("already exists");
  });

  it("validates the merge-version command", () => {
    expect(
      execFileSync(process.execPath, [mergeScript, "0.0.9", "0.0.10"], {
        encoding: "utf8",
      }),
    ).toContain("0.0.9 -> 0.0.10");

    expect(
      spawnSync(process.execPath, [mergeScript, "0.0.10", "0.0.9"], {
        encoding: "utf8",
      }).status,
    ).toBe(1);
  });
});
