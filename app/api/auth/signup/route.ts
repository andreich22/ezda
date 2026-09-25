import {NextResponse} from "next/server";
import {signUp} from "../../../../lib/auth";
import {setSessionCookies} from "../../../../lib/auth-cookies";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!email || password.length < 8) {
      return NextResponse.json({error: "Email and password (minimum 8 characters) are required"}, {status: 400});
    }

    const result = await signUp(email, password);
    const response = NextResponse.json({
      user: result.user,
      requiresEmailConfirmation: !result.session,
    });

    if (result.session) setSessionCookies(response, result.session);
    return response;
  } catch (error) {
    return NextResponse.json(
      {error: error instanceof Error ? error.message : "Unable to create account"},
      {status: 400},
    );
  }
}
