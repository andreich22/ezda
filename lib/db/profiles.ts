import {eq, sql} from "drizzle-orm";
import {profiles} from "./schema";

export type UserProfile = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function getProfile(userId: string): Promise<UserProfile | null> {
  const {db} = await import("./index");
  const [row] = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1);
  return row ?? null;
}

export async function ensureProfile(userId: string, email?: string | null): Promise<UserProfile> {
  const {db} = await import("./index");
  const existing = await getProfile(userId);
  if (existing) return existing;

  const localPart = email?.split("@")[0]?.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 24);
  const base = localPart && localPart.length >= 3 ? localPart : `user_${userId.replace(/-/g, "").slice(0, 12)}`;
  let username = base;

  for (let suffix = 0; suffix < 100; suffix += 1) {
    const candidate = suffix === 0 ? base : `${base.slice(0, 27)}_${suffix}`;
    const [conflict] = await db.select({id: profiles.id}).from(profiles).where(eq(profiles.username, candidate)).limit(1);
    if (!conflict) {
      username = candidate;
      break;
    }
  }

  const [row] = await db.insert(profiles).values({id: userId, username}).returning();
  if (!row) throw new Error("profile was not created");
  return row;
}

export type PublicProfileRoute = {
  id: string;
  title: string;
  description: string | null;
  distanceMeters: number;
  durationSeconds: number | null;
  elevationGainMeters: number | null;
  createdAt: Date;
};

export async function getPublicProfile(username: string): Promise<UserProfile | null> {
  const {db} = await import("./index");
  const normalizedUsername = username.trim().toLowerCase();
  if (!normalizedUsername) return null;

  const [row] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.username, normalizedUsername))
    .limit(1);

  return row ?? null;
}

export async function getPublicProfileRoutes(userId: string, limit = 50): Promise<PublicProfileRoute[]> {
  const {db} = await import("./index");
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || 50, 1), 100);
  const result = await db.execute(sql`
    select
      id,
      title,
      description,
      distance_meters as "distanceMeters",
      duration_seconds as "durationSeconds",
      elevation_gain_meters as "elevationGainMeters",
      created_at as "createdAt"
    from public.routes
    where author_id = ${userId}::uuid
      and is_public = true
    order by created_at desc
    limit ${safeLimit}
  `);

  return result as unknown as PublicProfileRoute[];
}

export async function updateProfile(
  userId: string,
  input: {username: string; displayName: string | null; avatarUrl: string | null},
): Promise<UserProfile> {
  const {db} = await import("./index");
  const [row] = await db
    .update(profiles)
    .set({
      username: input.username,
      displayName: input.displayName,
      avatarUrl: input.avatarUrl,
      updatedAt: new Date(),
    })
    .where(eq(profiles.id, userId))
    .returning();

  if (!row) throw new Error("profile was not found");
  return row;
}
