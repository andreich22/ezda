import {NextResponse} from "next/server";
import {verifyEmailToken} from "../../../../lib/auth";
import {setSessionCookies} from "../../../../lib/auth-cookies";

const CONFIRMATION_ERROR = "email_confirmation";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");

  const successUrl = new URL("/auth?confirmed=1", request.url);
  const errorUrl = new URL(`/auth?error=${CONFIRMATION_ERROR}`, request.url);

  if (!tokenHash || type !== "signup") {
    return NextResponse.redirect(errorUrl);
  }

  try {
    const session = await verifyEmailToken(tokenHash, "signup");
    const response = NextResponse.redirect(successUrl);
    setSessionCookies(response, session);
    return response;
  } catch {
    return NextResponse.redirect(errorUrl);
  }
}
