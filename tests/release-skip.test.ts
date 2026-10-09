import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { shouldSkipRelease, extractTaskId } from "../scripts/release-skip.mjs";

describe("release skip detection", () => {
  let tasksDir: string;

  beforeEach(() => {
    tasksDir = mkdtempSync(path.join(os.tmpdir(), "ezda-release-skip-"));
  });

  afterEach(() => {
    rmSync(tasksDir, { recursive: true, force: true });
  });

  function writeTask(id: string, skipRelease?: boolean) {
    const file = path.join(tasksDir, `${id}.json`);
    writeFileSync(
      file,
      JSON.stringify({ id, title: "x", status: "review", ...(skipRelease ? { skipRelease: true } : {}) }),
    );
    return file;
  }

  it("extracts a task id from the PR body (case-insensitive)", () => {
    expect(extractTaskId("Closes TASK-A7C3 #138")).toBe("a7c3");
    expect(extractTaskId("chore: TASK-B6E4 | bump")).toBe("b6e4");
    expect(extractTaskId("no task here")).toBeNull();
  });

  it("skips release when the referenced task has skipRelease=true", () => {
    writeTask("a7c3", true);
    const body = "chore: a7c3 | bump\nCloses TASK-A7C3 #138";
    expect(shouldSkipRelease({ body, tasksDir })).toBe(true);
  });

  it("runs release when the task has no skipRelease flag", () => {
    writeTask("b6e4");
    const body = "chore: b6e4 | bump\nCloses TASK-B6E4 #17";
    expect(shouldSkipRelease({ body, tasksDir })).toBe(false);
  });

  it("runs release when the PR body has no task id", () => {
    expect(shouldSkipRelease({ body: "just a chore" })).toBe(false);
  });

  it("runs release when the referenced task file is missing", () => {
    const body = "chore: c0de | bump\nCloses TASK-C0DE #1";
    expect(shouldSkipRelease({ body, tasksDir })).toBe(false);
  });
});
