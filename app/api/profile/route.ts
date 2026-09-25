import {NextResponse} from "next/server";
import {getCurrentUser} from "../../../lib/current-user";
import {ensureProfile, updateProfile} from "../../../lib/db/profiles";

export function parseProfileInput(body: unknown) {
  if (!body || typeof body !== "object") return {error: "invalid JSON body"} as const;
  const value = body as Record<string, unknown>;
  const username = typeof value.username === "string" ? value.username.trim().toLowerCase() : "";
  const displayName = typeof value.displayName === "string" ? value.displayName.trim() : null;
  const avatarUrl = typeof value.avatarUrl === "string" ? value.avatarUrl.trim() : null;

  if (!/^[a-z0-9_]{3,32}$/.test(username)) {
    return {error: "username must be 3-32 characters using lowercase letters, numbers, or underscores"} as const;
  }
  if (displayName && displayName.length > 80) return {error: "display name is too long"} as const;
  if (avatarUrl && avatarUrl.length > 500) return {error: "avatar URL is too long"} as const;
  if (avatarUrl && !/^https?:\/\//i.test(avatarUrl)) return {error: "avatar URL must use http or https"} as const;

  return {value: {username, displayName: displayName || null, avatarUrl: avatarUrl || null}} as const;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({error: "authentication required"}, {status: 401});

  const profile = await ensureProfile(user.id, user.email);
  return NextResponse.json({profile});
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({error: "authentication required"}, {status: 401});

  const parsed = parseProfileInput(await request.json().catch(() => null));
  if ("error" in parsed) return NextResponse.json({error: parsed.error}, {status: 400});

  try {
    const profile = await updateProfile(user.id, parsed.value);
    return NextResponse.json({profile});
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update profile";
    if (message.toLowerCase().includes("unique")) {
      return NextResponse.json({error: "username is already taken"}, {status: 409});
    }
    return NextResponse.json({error: "Unable to update profile"}, {status: 500});
  }
}
