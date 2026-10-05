import {NextResponse} from "next/server";
import {verifyEmailToken} from "../../../lib/auth";
import {setSessionCookies} from "../../../lib/auth-cookies";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");

  const successUrl = new URL("/auth/reset-password", request.url);
  const errorUrl = new URL("/auth?error=password_recovery", request.url);

  if (!tokenHash || type !== "recovery") {
    return NextResponse.redirect(errorUrl);
  }

  try {
    const session = await verifyEmailToken(tokenHash, "recovery");
    const response = NextResponse.redirect(successUrl);
    setSessionCookies(response, session);
    return response;
  } catch {
    return NextResponse.redirect(errorUrl);
  }
}
