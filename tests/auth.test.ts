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

    const result = await signUp("a@example.com", "password123");
    expect(result.session).toBeNull();
    expect(result.user?.id).toBe("user-1");
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
