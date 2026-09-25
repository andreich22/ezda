import {cookies} from "next/headers";
import {ACCESS_TOKEN_COOKIE, getUser} from "./auth";

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) return null;

  try {
    return await getUser(accessToken);
  } catch {
    return null;
  }
}
