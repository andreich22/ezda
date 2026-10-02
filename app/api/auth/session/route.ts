import {NextResponse} from "next/server";
import {cookies} from "next/headers";
import {getUser, refreshSession, ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE} from "../../../../lib/auth";
import {setSessionCookies} from "../../../../lib/auth-cookies";
import {ensureProfile} from "../../../../lib/db/profiles";

export async function GET() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;

  if (!accessToken) return NextResponse.json({user: null});

  try {
    const user = await getUser(accessToken);
    try {
      await ensureProfile(user.id, user.email);
    } catch {
      // Profile persistence must not invalidate an otherwise valid Auth session.
    }
    return NextResponse.json({user});
  } catch {
    if (!refreshToken) return NextResponse.json({user: null});

    try {
      const session = await refreshSession(refreshToken);
      try {
        await ensureProfile(session.user.id, session.user.email);
      } catch {
        // Profile persistence must not invalidate an otherwise valid Auth session.
      }
      const response = NextResponse.json({user: session.user});
      setSessionCookies(response, session);
      return response;
    } catch {
      return NextResponse.json({user: null});
    }
  }
}
