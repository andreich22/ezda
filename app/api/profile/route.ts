import {NextResponse} from "next/server";
import {getCurrentUser} from "../../../lib/current-user";
import {ensureProfile, updateProfile} from "../../../lib/db/profiles";
import {parseProfileInput} from "../../../lib/profile-validation";

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
