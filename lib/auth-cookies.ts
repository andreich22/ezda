import type {NextResponse} from "next/server";
import type {AuthSession} from "./auth";
import {ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE} from "./auth";

const baseCookie = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export function setSessionCookies(response: NextResponse, session: AuthSession) {
  response.cookies.set(ACCESS_TOKEN_COOKIE, session.access_token, {
    ...baseCookie,
    maxAge: Math.max(60, session.expires_in ?? 3600),
  });
  response.cookies.set(REFRESH_TOKEN_COOKIE, session.refresh_token, {
    ...baseCookie,
    maxAge: 60 * 60 * 24 * 30,
  });
}
