import {beforeEach, describe, expect, it, vi} from "vitest";

const cookieValues = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieValues.get(name);
      return value === undefined ? undefined : {value};
    },
  }),
}));

vi.mock("../lib/db/profiles", () => ({
  ensureProfile: vi.fn().mockResolvedValue({id: "user-1", username: "user"}),
}));

vi.mock("../lib/auth-cookies", () => ({
  setSessionCookies: vi.fn(),
}));

import {GET as authorize} from "../app/api/auth/google/route";
import {GET as callback} from "../app/auth/callback/route";
import {ensureProfile} from "../lib/db/profiles";

beforeEach(() => {
  cookieValues.clear();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("Google OAuth", () => {
  it("redirects to Supabase with state and PKCE parameters", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NODE_ENV", "test");

    const response = await authorize(new Request("http://localhost:3000/api/auth/google?next=/routes"));
    const location = new URL(response.headers.get("location")!);

    expect(location.origin).toBe("https://example.supabase.co");
    expect(location.pathname).toBe("/auth/v1/authorize");
    expect(location.searchParams.get("provider")).toBe("google");
    expect(location.searchParams.get("redirect_to")).toBe("http://localhost:3000/auth/callback");
    expect(location.searchParams.get("code_challenge_method")).toBe("S256");
    expect(location.searchParams.get("code_challenge")).toBeTruthy();
    expect(location.searchParams.get("state")).toBeTruthy();
    expect(response.headers.get("set-cookie")).toContain("ezda_oauth_state=");
    expect(response.headers.get("set-cookie")).toContain("ezda_oauth_verifier=");
    expect(response.headers.get("set-cookie")).toContain("ezda_oauth_next=%2Froutes");
  });

  it("rejects callback when OAuth state does not match", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_ANON_KEY", "publishable-key");
    cookieValues.set("ezda_oauth_state", "expected");
    cookieValues.set("ezda_oauth_verifier", "verifier");

    const fetchMock = vi.spyOn(globalThis, "fetch");
    const response = await callback(new Request("http://localhost:3000/auth/callback?code=secret&state=wrong"));

    expect(response.headers.get("location")).toBe("http://localhost:3000/auth?error=oauth_error");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toContain("ezda_oauth_state=");
  });

  it("exchanges the OAuth code, provisions a profile, and redirects to the safe next path", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_ANON_KEY", "publishable-key");
    cookieValues.set("ezda_oauth_state", "expected");
    cookieValues.set("ezda_oauth_verifier", "verifier");
    cookieValues.set("ezda_oauth_next", "/routes?source=google");

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        access_token: "access",
        refresh_token: "refresh",
        expires_in: 3600,
        user: {id: "user-1", email: "google@example.com"},
      }), {status: 200}),
    );

    const response = await callback(new Request("http://localhost:3000/auth/callback?code=oauth-code&state=expected"));

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.supabase.co/auth/v1/token?grant_type=pkce",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({auth_code: "oauth-code", code_verifier: "verifier"}),
      }),
    );
    expect(ensureProfile).toHaveBeenCalledWith("user-1", "google@example.com");
    expect(response.headers.get("location")).toBe("http://localhost:3000/routes?source=google");
  });

  it("does not leak an OAuth code when token exchange fails", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_ANON_KEY", "publishable-key");
    cookieValues.set("ezda_oauth_state", "expected");
    cookieValues.set("ezda_oauth_verifier", "verifier");

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({error: "invalid_grant"}), {status: 400}),
    );

    const response = await callback(new Request("http://localhost:3000/auth/callback?code=secret-code&state=expected"));

    expect(response.headers.get("location")).toBe("http://localhost:3000/auth?error=oauth_error");
    expect(response.headers.get("location")).not.toContain("secret-code");
  });
});
