#!/usr/bin/env node
import postgres from "postgres";
import {isLocalDatabase} from "./migrate.mjs";

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
  const [row] = await sql`
    with state as (
      select
        to_regclass('public.routes') as routes_oid,
        to_regtype('gis.geography') as geography_oid
    )
    select
      state.routes_oid is not null as routes_table,
      to_regnamespace('gis') is not null as gis_schema,
      state.geography_oid is not null as geography_type,
      to_regprocedure('gis.st_geogfromtext(text)') is not null as geog_function,
      exists (
        select 1
        from pg_attribute
        where attrelid = state.routes_oid
          and attname = 'geometry'
          and atttypid = state.geography_oid
      ) as routes_geometry_geography
    from state
  `;

  const checks = [
    ["public.routes table", row.routes_table],
    ["gis schema", row.gis_schema],
    ["gis.geography type", row.geography_type],
    ["gis.st_geogfromtext(text) function", row.geog_function],
    ["routes.geometry is gis.geography(LineString,4326)", row.routes_geometry_geography],
  ];

  let failed = false;
  for (const [label, ok] of checks) {
    console.log(`${ok ? "ok  " : "FAIL"} - ${label}`);
    if (!ok) failed = true;
  }

  if (failed) {
    console.error("Schema verification failed.");
    process.exit(1);
  }
  console.log("Schema verification passed.");
} finally {
  await sql.end();
}
