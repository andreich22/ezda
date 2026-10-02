import {afterEach, describe, expect, it, vi} from "vitest";
import {GET} from "../app/auth/confirm/route";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("email confirmation callback", () => {
  it("rejects malformed confirmation links without exposing token data", async () => {
    const response = await GET(new Request("http://localhost:3000/auth/confirm?token_hash=secret&type=invalid"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/auth?error=email_confirmation",
    );
    expect(response.headers.get("location")).not.toContain("secret");
  });

  it("verifies the token server-side and stores the session in HttpOnly cookies", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_ANON_KEY", "publishable-key");

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "access-token",
          refresh_token: "refresh-token",
          expires_in: 3600,
          user: {id: "user-1", email: "confirmed@example.com"},
        }),
        {status: 200},
      ),
    );

    const response = await GET(
      new Request("https://ezda-eta.vercel.app/auth/confirm?token_hash=one-time-secret&type=signup"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://ezda-eta.vercel.app/auth?confirmed=1",
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
      type: "signup",
    });
  });

  it("returns the same safe error redirect for an expired token", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_ANON_KEY", "publishable-key");

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({message: "Email link is invalid or has expired"}), {status: 403}),
    );

    const response = await GET(
      new Request("https://ezda-eta.vercel.app/auth/confirm?token_hash=expired-secret&type=signup"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://ezda-eta.vercel.app/auth?error=email_confirmation",
    );
    expect(response.headers.get("location")).not.toContain("expired-secret");
  });
});
