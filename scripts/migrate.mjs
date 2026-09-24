#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {pathToFileURL} from "node:url";
import postgres from "postgres";

export const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

export function listMigrationFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

export function isLocalDatabase(connectionString) {
  return (
    connectionString.includes("localhost") ||
    connectionString.includes("127.0.0.1") ||
    connectionString.includes("@db:")
  );
}

async function waitForDatabase(sql, attempts = 30, delayMs = 1000) {
  for (let attempt = 1; ; attempt++) {
    try {
      await sql`select 1`;
      return;
    } catch (error) {
      if (attempt >= attempts) throw error;
      console.log(`Waiting for the database (${attempt}/${attempts})...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

export async function runMigrations(sql, dir = MIGRATIONS_DIR) {
  await sql.unsafe(
    "create table if not exists public.schema_migrations (" +
      "name text primary key," +
      "applied_at timestamptz not null default now());",
  );

  const appliedRows = await sql`select name from public.schema_migrations`;
  const applied = new Set(appliedRows.map((row) => row.name));
  const pending = listMigrationFiles(dir).filter((name) => !applied.has(name));

  for (const name of pending) {
    const content = fs.readFileSync(path.join(dir, name), "utf8");
    console.log(`Applying ${name}...`);
    await sql.unsafe(content);
    await sql`insert into public.schema_migrations (name) values (${name}) on conflict do nothing`;
  }

  console.log(
    pending.length
      ? `Applied ${pending.length} migration(s).`
      : "Database is up to date.",
  );
  return pending;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const sql = postgres(connectionString, {
    max: 1,
    prepare: false,
    ssl: isLocalDatabase(connectionString) ? false : "require",
  });

  try {
    await waitForDatabase(sql);
    await runMigrations(sql);
  } finally {
    await sql.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
