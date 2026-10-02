import {afterEach, describe, expect, it, vi} from "vitest";
import {getUser, signIn, signUp} from "../lib/auth";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("Supabase Auth adapter", () => {
  it("fails clearly when Supabase Auth is not configured", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_ANON_KEY", "");
    await expect(signIn("a@example.com", "password123")).rejects.toThrow(
      "Supabase Auth is not configured",
    );
  });

  it("sends credentials through the Supabase token endpoint", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co/");
    vi.stubEnv("SUPABASE_ANON_KEY", "publishable-key");

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "access",
          refresh_token: "refresh",
          expires_in: 3600,
          user: {id: "user-1", email: "a@example.com"},
        }),
        {status: 200},
      ),
    );

    const session = await signIn("a@example.com", "password123");

    expect(session.user.id).toBe("user-1");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.supabase.co/auth/v1/token?grant_type=password",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        headers: expect.any(Headers),
      }),
    );

    const init = fetchMock.mock.calls[0][1]!;
    const headers = init.headers as Headers;
    expect(headers.get("apikey")).toBe("publishable-key");
    expect(JSON.parse(String(init.body))).toEqual({
      email: "a@example.com",
      password: "password123",
    });
  });

  it("returns signup confirmation state when Supabase does not create a session", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_ANON_KEY", "publishable-key");

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({user: {id: "user-1"}, session: null}), {status: 200}),
    );

    const result = await signUp("a@example.com", "password123", "http://localhost:3000/auth/confirm");
    expect(result.session).toBeNull();
    expect(result.user?.id).toBe("user-1");

    const requestUrl = fetchMock.mock.calls[0][0];
    expect(requestUrl).toBe(
      "https://example.supabase.co/auth/v1/signup?redirect_to=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Fconfirm",
    );
  });

  it("verifies a signup token hash through the server-side verify endpoint", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_ANON_KEY", "publishable-key");

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "access",
          refresh_token: "refresh",
          expires_in: 3600,
          user: {id: "user-1", email: "a@example.com"},
        }),
        {status: 200},
      ),
    );

    const session = await (await import("../lib/auth")).verifyEmailToken("token-hash", "signup");

    expect(session.user.id).toBe("user-1");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      token_hash: "token-hash",
      type: "signup",
    });
  });

  it("uses the bearer access token when resolving the current user", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_ANON_KEY", "publishable-key");

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({id: "user-1", email: "a@example.com"}), {status: 200}),
    );

    await getUser("access-token");
    const headers = fetchMock.mock.calls[0][1]?.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer access-token");
  });
});
