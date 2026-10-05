import {NextResponse} from "next/server";
import {
  OAUTH_COOKIE_MAX_AGE,
  OAUTH_NEXT_COOKIE,
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  createOAuthState,
  createPkcePair,
  safeNextPath,
} from "../../../../lib/auth-oauth";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: OAUTH_COOKIE_MAX_AGE,
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");

  if (!supabaseUrl) {
    return NextResponse.redirect(new URL("/auth?error=oauth_unavailable", request.url));
  }

  const state = createOAuthState();
  const {verifier, challenge} = createPkcePair();
  const next = safeNextPath(url.searchParams.get("next"));
  const callback = new URL("/auth/callback", request.url);

  const authorizeUrl = new URL(supabaseUrl + "/auth/v1/authorize");
  authorizeUrl.searchParams.set("provider", "google");
  authorizeUrl.searchParams.set("redirect_to", callback.toString());
  authorizeUrl.searchParams.set("code_challenge", challenge);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");
  authorizeUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(OAUTH_STATE_COOKIE, state, cookieOptions);
  response.cookies.set(OAUTH_VERIFIER_COOKIE, verifier, cookieOptions);
  response.cookies.set(OAUTH_NEXT_COOKIE, next, cookieOptions);
  return response;
}
