import {NextResponse} from "next/server";
import {cookies} from "next/headers";
import {signOut, ACCESS_TOKEN_COOKIE} from "../../../../lib/auth";

export async function POST() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;

  if (accessToken) {
    try {
      await signOut(accessToken);
    } catch {
      // The local session is cleared even if Supabase already rejected it.
    }
  }

  const response = NextResponse.json({ok: true});
  response.cookies.set(ACCESS_TOKEN_COOKIE, "", {httpOnly: true, expires: new Date(0), path: "/"});
  response.cookies.set("ezda_refresh_token", "", {httpOnly: true, expires: new Date(0), path: "/"});
  return response;
}
