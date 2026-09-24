import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {afterEach, describe, expect, it} from "vitest";
import {isLocalDatabase, listMigrationFiles} from "../scripts/migrate.mjs";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length) {
    fs.rmSync(tempDirs.pop()!, {recursive: true, force: true});
  }
});

function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ezda-migrations-"));
  tempDirs.push(dir);
  return dir;
}

describe("listMigrationFiles", () => {
  it("returns sorted .sql files only", () => {
    const dir = makeTempDir();
    fs.writeFileSync(path.join(dir, "20260924_b.sql"), "-- b");
    fs.writeFileSync(path.join(dir, "20260923_a.sql"), "-- a");
    fs.writeFileSync(path.join(dir, "notes.txt"), "not a migration");

    expect(listMigrationFiles(dir)).toEqual([
      "20260923_a.sql",
      "20260924_b.sql",
    ]);
  });

  it("returns an empty list for a missing directory", () => {
    expect(
      listMigrationFiles(path.join(os.tmpdir(), "ezda-migrations-missing")),
    ).toEqual([]);
  });

  it("orders the postgis setup before the initial routes migration", () => {
    const files = listMigrationFiles(
      path.join(process.cwd(), "supabase", "migrations"),
    );
    const ensure = files.indexOf("20260922150000_ensure_postgis_gis_schema.sql");
    const initial = files.indexOf("20260922160000_initial_routes.sql");

    expect(ensure).toBeGreaterThanOrEqual(0);
    expect(initial).toBeGreaterThan(ensure);
  });
});

describe("isLocalDatabase", () => {
  it("detects local docker and localhost urls", () => {
    expect(isLocalDatabase("postgres://ezda:ezda@db:5432/ezda")).toBe(true);
    expect(isLocalDatabase("postgres://user:pass@localhost:5432/ezda")).toBe(
      true,
    );
    expect(isLocalDatabase("postgres://user:pass@127.0.0.1:5432/ezda")).toBe(
      true,
    );
  });

  it("treats remote urls as non-local", () => {
    expect(
      isLocalDatabase("postgres://user:pass@db.example.com:5432/ezda"),
    ).toBe(false);
    expect(
      isLocalDatabase(
        "postgres://user:pass@aws-0-region.pooler.supabase.com:6543/postgres",
      ),
    ).toBe(false);
  });
});
