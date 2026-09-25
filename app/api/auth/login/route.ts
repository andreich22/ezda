import {NextResponse} from "next/server";
import {signIn} from "../../../../lib/auth";
import {setSessionCookies} from "../../../../lib/auth-cookies";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json({error: "Email and password are required"}, {status: 400});
    }

    const session = await signIn(email, password);
    const response = NextResponse.json({user: session.user});
    setSessionCookies(response, session);
    return response;
  } catch (error) {
    return NextResponse.json(
      {error: error instanceof Error ? error.message : "Unable to sign in"},
      {status: 401},
    );
  }
}
