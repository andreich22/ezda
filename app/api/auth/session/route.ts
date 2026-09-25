import {NextResponse} from "next/server";
import {cookies} from "next/headers";
import {getUser, ACCESS_TOKEN_COOKIE} from "../../../../lib/auth";

export async function GET() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;

  if (!accessToken) return NextResponse.json({user: null});

  try {
    const user = await getUser(accessToken);
    return NextResponse.json({user});
  } catch {
    return NextResponse.json({user: null});
  }
}
