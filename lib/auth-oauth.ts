import {createHash, randomBytes} from "node:crypto";

export const OAUTH_STATE_COOKIE = "ezda_oauth_state";
export const OAUTH_VERIFIER_COOKIE = "ezda_oauth_verifier";
export const OAUTH_NEXT_COOKIE = "ezda_oauth_next";
export const OAUTH_COOKIE_MAX_AGE = 10 * 60;

export function createPkcePair() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return {verifier, challenge};
}

export function createOAuthState() {
  return randomBytes(32).toString("base64url");
}

export function safeNextPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const parsed = new URL(value, "https://ezda.invalid");
    if (parsed.origin !== "https://ezda.invalid") return "/";
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return "/";
  }
}
