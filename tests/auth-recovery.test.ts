import {afterEach, describe, expect, it, vi} from "vitest";
import {getAuthOrigin, getPasswordRecoveryRedirect} from "../lib/auth-redirect";
import {GET as recoveryCallback} from "../app/auth/recover/route";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("auth redirect selection", () => {
  it("keeps local development on localhost", () => {
    vi.stubEnv("VERCEL_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://ezda-eta.vercel.app");

    const request = new Request("http://localhost:3000/api/auth/recover");
    expect(getAuthOrigin(request)).toBe("http://localhost:3000");
    expect(getPasswordRecoveryRedirect(request)).toBe("http://localhost:3000/auth/recover");
  });

  it("uses the configured production site URL instead of localhost", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://ezda-eta.vercel.app");

    const request = new Request("https://ezda-eta.vercel.app/api/auth/recover");
    expect(getPasswordRecoveryRedirect(request)).toBe("https://ezda-eta.vercel.app/auth/recover");
  });

  it("uses the Vercel preview URL for preview deployments", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "ezda-preview.vercel.app");

    const request = new Request("https://ezda-preview.vercel.app/api/auth/recover");
    expect(getPasswordRecoveryRedirect(request)).toBe("https://ezda-preview.vercel.app/auth/recover");
  });
});

describe("password recovery callback", () => {
  it("rejects malformed links without exposing token data", async () => {
    const response = await recoveryCallback(
      new Request("https://ezda-eta.vercel.app/auth/recover?token_hash=secret&type=invalid"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://ezda-eta.vercel.app/auth?error=password_recovery",
    );
    expect(response.headers.get("location")).not.toContain("secret");
  });

  it("exchanges the recovery token server-side and sets HttpOnly cookies", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_ANON_KEY", "publishable-key");

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "access-token",
          refresh_token: "refresh-token",
          expires_in: 3600,
          user: {id: "user-1", email: "recover@example.com"},
        }),
        {status: 200},
      ),
    );

    const response = await recoveryCallback(
      new Request("https://ezda-eta.vercel.app/auth/recover?token_hash=one-time-secret&type=recovery"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://ezda-eta.vercel.app/auth/reset-password",
    );

    const cookies = response.headers.getSetCookie();
    expect(cookies).toHaveLength(2);
    expect(cookies[0]).toContain("ezda_access_token=access-token");
    expect(cookies[0]).toContain("HttpOnly");
    expect(cookies[1]).toContain("ezda_refresh_token=refresh-token");
    expect(cookies[1]).toContain("HttpOnly");

    const init = vi.mocked(globalThis.fetch).mock.calls[0][1]!;
    expect(JSON.parse(String(init.body))).toEqual({
      token_hash: "one-time-secret",
      type: "recovery",
    });
  });

  it("returns a safe error redirect when Supabase rejects an expired token", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_ANON_KEY", "publishable-key");

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({message: "Token expired"}), {status: 403}),
    );

    const response = await recoveryCallback(
      new Request("https://ezda-eta.vercel.app/auth/recover?token_hash=expired-secret&type=recovery"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://ezda-eta.vercel.app/auth?error=password_recovery",
    );
    expect(response.headers.get("location")).not.toContain("expired-secret");
  });
});
