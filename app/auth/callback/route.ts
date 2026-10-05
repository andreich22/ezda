import {NextResponse} from "next/server";
import {cookies} from "next/headers";
import {ensureProfile} from "../../../lib/db/profiles";
import {setSessionCookies} from "../../../lib/auth-cookies";
import {
  OAUTH_NEXT_COOKIE,
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  safeNextPath,
} from "../../../lib/auth-oauth";

const oauthError = "oauth_error";

function clearOAuthCookies(response: NextResponse) {
  for (const name of [OAUTH_STATE_COOKIE, OAUTH_VERIFIER_COOKIE, OAUTH_NEXT_COOKIE]) {
    response.cookies.set(name, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }
}

function errorRedirect(request: Request) {
  return new URL("/auth?error=" + oauthError, request.url);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const authError = url.searchParams.get("error");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  const verifier = cookieStore.get(OAUTH_VERIFIER_COOKIE)?.value;
  const next = safeNextPath(cookieStore.get(OAUTH_NEXT_COOKIE)?.value);

  if (authError || !code || !returnedState || !expectedState || returnedState !== expectedState || !verifier) {
    const response = NextResponse.redirect(errorRedirect(request));
    clearOAuthCookies(response);
    return response;
  }

  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    const response = NextResponse.redirect(errorRedirect(request));
    clearOAuthCookies(response);
    return response;
  }

  try {
    const tokenResponse = await fetch(supabaseUrl + "/auth/v1/token?grant_type=pkce", {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({auth_code: code, code_verifier: verifier}),
      cache: "no-store",
    });
    const session = await tokenResponse.json().catch(() => null);

    if (!tokenResponse.ok || !session?.access_token || !session?.refresh_token || !session?.user?.id) {
      throw new Error("OAuth token exchange failed");
    }

    await ensureProfile(session.user.id, session.user.email);
    const response = NextResponse.redirect(new URL(next, request.url));
    setSessionCookies(response, session);
    clearOAuthCookies(response);
    return response;
  } catch {
    const response = NextResponse.redirect(errorRedirect(request));
    clearOAuthCookies(response);
    return response;
  }
}
