const ACCESS_TOKEN_COOKIE = "ezda_access_token";
const REFRESH_TOKEN_COOKIE = "ezda_refresh_token";

type SupabaseUser = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
};

export type AuthSession = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  expires_at?: number;
  user: SupabaseUser;
};

function getConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Supabase Auth is not configured");
  }

  return {url, key};
}

async function authRequest<T>(
  path: string,
  init: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  const {url, key} = getConfig();
  const headers = new Headers(init.headers);
  headers.set("apikey", key);
  headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const response = await fetch(`${url}/auth/v1/${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      body && typeof body.message === "string"
        ? body.message
        : body && typeof body.error_description === "string"
          ? body.error_description
          : "Supabase Auth request failed";
    throw new Error(message);
  }

  return body as T;
}

export async function signUp(email: string, password: string, redirectTo?: string) {
  const path = redirectTo ? `signup?redirect_to=${encodeURIComponent(redirectTo)}` : "signup";

  return authRequest<{user: SupabaseUser | null; session: AuthSession | null}>(
    path,
    {method: "POST", body: JSON.stringify({email, password})},
  );
}

export async function verifyEmailToken(tokenHash: string, type: "signup" | "email" | "recovery") {
  return authRequest<AuthSession>(
    "verify",
    {
      method: "POST",
      body: JSON.stringify({token_hash: tokenHash, type}),
    },
  );
}

export async function signIn(email: string, password: string) {
  return authRequest<AuthSession>(
    "token?grant_type=password",
    {method: "POST", body: JSON.stringify({email, password})},
  );
}

export async function sendPasswordReset(email: string, redirectTo: string) {
  return authRequest<{message?: string}>(
    "recover",
    {method: "POST", body: JSON.stringify({email, redirect_to: redirectTo})},
  );
}

export async function updatePassword(accessToken: string, password: string) {\n  return authRequest<{user: SupabaseUser}>(\n    "user",\n    {method: "PUT", body: JSON.stringify({password})},\n    accessToken,\n  );\n}\n\nexport async function refreshSession(refreshToken: string) {
  return authRequest<AuthSession>(
    "token?grant_type=refresh_token",
    {method: "POST", body: JSON.stringify({refresh_token: refreshToken})},
  );
}

export async function signOut(accessToken: string) {
  return authRequest<void>("logout?scope=local", {method: "POST"}, accessToken);
}

export async function getUser(accessToken: string) {
  return authRequest<SupabaseUser>("user", {method: "GET"}, accessToken);
}

export {ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE};
