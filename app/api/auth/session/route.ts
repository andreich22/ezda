import {NextResponse} from "next/server";
import {cookies} from "next/headers";
import {getUser, refreshSession, ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE} from "../../../../lib/auth";
import {setSessionCookies} from "../../../../lib/auth-cookies";

export async function GET() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;

  if (!accessToken) return NextResponse.json({user: null});

  try {
    const user = await getUser(accessToken);
    return NextResponse.json({user});
  } catch {
    if (!refreshToken) return NextResponse.json({user: null});

    try {
      const session = await refreshSession(refreshToken);
      const response = NextResponse.json({user: session.user});
      setSessionCookies(response, session);
      return response;
    } catch {
      return NextResponse.json({user: null});
    }
  }
}
