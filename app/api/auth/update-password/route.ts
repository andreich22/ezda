import {NextResponse} from "next/server";
import {getUser, updatePassword} from "../../../../lib/auth";
import {ACCESS_TOKEN_COOKIE} from "../../../../lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const password = typeof body?.password === "string" ? body.password : "";
    if (password.length < 8) {
      return NextResponse.json({error: "Password must be at least 8 characters"}, {status: 400});
    }

    const token = request.headers.get("cookie")?.match(
      new RegExp(`(?:^|;\\s*)${ACCESS_TOKEN_COOKIE}=([^;]+)`),
    )?.[1];

    if (!token) {
      return NextResponse.json({error: "Recovery session is missing or expired"}, {status: 401});
    }

    await getUser(token);
    await updatePassword(token, password);
    return NextResponse.json({ok: true});
  } catch (error) {
    return NextResponse.json(
      {error: error instanceof Error ? error.message : "Unable to update password"},
      {status: 400},
    );
  }
}
