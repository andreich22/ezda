import {and, eq, sql} from "drizzle-orm";
import {routes} from "./schema";
import type {CreateRouteInput} from "../route-validation";

function toWkt(coordinates: number[][]) {
  return `SRID=4326;LINESTRING(${coordinates.map(([lon, lat]) => `${lon} ${lat}`).join(", ")})`;
}

export async function createRoute(input: CreateRouteInput, authorId: string) {
  const {db} = await import("./index");
  const [row] = await db
    .insert(routes)
    .values({
      authorId,
      title: input.title,
      description: input.description,
      geometry: sql`gis.ST_GeogFromText(${toWkt(input.geometry.geometry.coordinates)})`,
      distanceMeters: input.distanceMeters,
      durationSeconds: input.durationSeconds,
      elevationGainMeters: input.elevationGainMeters,
      isPublic: input.isPublic,
    })
    .returning({id: routes.id});

  if (!row) throw new Error("route was not created");
  return row;
}

export async function getRouteOwnership(id: string) {
  const {db} = await import("./index");
  const [row] = await db
    .select({id: routes.id, authorId: routes.authorId})
    .from(routes)
    .where(eq(routes.id, id))
    .limit(1);

  return row ?? null;
}

export async function updateRoute(id: string, authorId: string, input: CreateRouteInput) {
  const {db} = await import("./index");
  const [row] = await db
    .update(routes)
    .set({
      title: input.title,
      description: input.description,
      geometry: sql`gis.ST_GeogFromText(${toWkt(input.geometry.geometry.coordinates)})`,
      distanceMeters: input.distanceMeters,
      durationSeconds: input.durationSeconds,
      elevationGainMeters: input.elevationGainMeters,
      isPublic: input.isPublic,
    })
    .where(and(eq(routes.id, id), eq(routes.authorId, authorId)))
    .returning({id: routes.id});

  return row ?? null;
}

export async function deleteRoute(id: string, authorId: string) {
  const {db} = await import("./index");
  const [row] = await db
    .delete(routes)
    .where(and(eq(routes.id, id), eq(routes.authorId, authorId)))
    .returning({id: routes.id});

  return row ?? null;
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

export async function getRouteForViewer(id: string, authorId?: string | null) {
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
      and (is_public = true or (${authorId ?? null}::uuid is not null and author_id = ${authorId ?? null}::uuid))
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

export type RouteVisibility = "all" | "my" | "public" | "private";

export type PublicRouteListItem = {
  id: string;
  title: string;
  description: string | null;
  distanceMeters: number;
  durationSeconds: number | null;
  elevationGainMeters: number | null;
  createdAt: string;
  isPublic: boolean;
};

export async function getPublicRoutes(
  limit = 50,
  visibility: RouteVisibility = "public",
  authorId?: string | null,
): Promise<PublicRouteListItem[]> {
  const {db} = await import("./index");
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || 50, 1), 100);
  const canReadOwnRoutes = Boolean(authorId);
  const effectiveVisibility: RouteVisibility = canReadOwnRoutes ? visibility : "public";

  let visibilityCondition = sql`is_public = true`;
  if (effectiveVisibility === "my") {
    visibilityCondition = sql`author_id = ${authorId!}::uuid`;
  } else if (effectiveVisibility === "private") {
    visibilityCondition = sql`author_id = ${authorId!}::uuid and is_public = false`;
  } else if (effectiveVisibility === "all") {
    visibilityCondition = sql`(is_public = true or author_id = ${authorId!}::uuid)`;
  }

  const result = await db.execute(sql`
    select
      id,
      title,
      description,
      distance_meters as "distanceMeters",
      duration_seconds as "durationSeconds",
      elevation_gain_meters as "elevationGainMeters",
      created_at as "createdAt",
      is_public as "isPublic"
    from public.routes
    where ${visibilityCondition}
    order by created_at desc
    limit ${safeLimit}
  `);

  return result as unknown as PublicRouteListItem[];
}
