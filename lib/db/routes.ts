import {sql} from "drizzle-orm";
import {routes} from "./schema";
import type {CreateRouteInput} from "../route-validation";

function toWkt(coordinates: number[][]) {
  return `SRID=4326;LINESTRING(${coordinates.map(([lon, lat]) => `${lon} ${lat}`).join(", ")})`;
}

export async function createRoute(input: CreateRouteInput) {
  const {db} = await import("./index");
  const [row] = await db
    .insert(routes)
    .values({
      title: input.title,
      description: input.description,
      geometry: sql`gis.ST_GeogFromText(${toWkt(input.geometry.geometry.coordinates)})`,
      distanceMeters: input.distanceMeters,
      durationSeconds: input.durationSeconds,
      elevationGainMeters: input.elevationGainMeters,
      isPublic: true,
    })
    .returning({id: routes.id});

  if (!row) throw new Error("route was not created");
  return row;
}

export async function getPublicRoute(id: string) {
  const {db} = await import("./index");
  const result = await db.execute(sql`
    select
      id,
      title,
      description,
      distance_meters as "distanceMeters",
      duration_seconds as "durationSeconds",
      elevation_gain_meters as "elevationGainMeters",
      created_at as "createdAt",
      gis.ST_AsGeoJSON(geometry::gis.geometry) as geometry
    from public.routes
    where id = ${id}::uuid
      and is_public = true
    limit 1
  `);

  const row = result[0] as
    | {
        id: string;
        title: string;
        description: string | null;
        distanceMeters: number;
        durationSeconds: number | null;
        elevationGainMeters: number | null;
        createdAt: string;
        geometry: string;
      }
    | undefined;

  if (!row) return null;

  return {
    ...row,
    geometry: {
      type: "Feature",
      properties: {},
      geometry: JSON.parse(row.geometry),
    },
  };
}
