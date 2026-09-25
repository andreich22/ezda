export function parseProfileInput(body: unknown) {
  if (!body || typeof body !== "object") return {error: "invalid JSON body"} as const;
  const value = body as Record<string, unknown>;
  const username = typeof value.username === "string" ? value.username.trim().toLowerCase() : "";
  const displayName = typeof value.displayName === "string" ? value.displayName.trim() : null;
  const avatarUrl = typeof value.avatarUrl === "string" ? value.avatarUrl.trim() : null;

  if (!/^[a-z0-9_]{3,32}$/.test(username)) {
    return {error: "username must be 3-32 characters using lowercase letters, numbers, or underscores"} as const;
  }
  if (displayName && displayName.length > 80) return {error: "display name is too long"} as const;
  if (avatarUrl && avatarUrl.length > 500) return {error: "avatar URL is too long"} as const;
  if (avatarUrl && !/^https?:\/\//i.test(avatarUrl)) return {error: "avatar URL must use http or https"} as const;

  return {value: {username, displayName: displayName || null, avatarUrl: avatarUrl || null}} as const;
}
