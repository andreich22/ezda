const DEFAULT_LOCAL_ORIGIN = "http://localhost:3000";

function normalizeOrigin(value: string) {
  return value.replace(/\/$/, "");
}

export function getAuthOrigin(request: Request) {
  const requestUrl = new URL(request.url);
  const hostname = requestUrl.hostname;

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return requestUrl.origin;
  }

  if (process.env.VERCEL_ENV === "production") {
    const configured = process.env.NEXT_PUBLIC_SITE_URL;
    if (configured) return normalizeOrigin(configured);
  }

  if (process.env.VERCEL_URL) {
    return normalizeOrigin(
      process.env.VERCEL_URL.startsWith("http")
        ? process.env.VERCEL_URL
        : `https://${process.env.VERCEL_URL}`,
    );
  }

  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return normalizeOrigin(configured);

  return requestUrl.origin || DEFAULT_LOCAL_ORIGIN;
}

export function getPasswordRecoveryRedirect(request: Request) {
  return `${getAuthOrigin(request)}/auth/recover`;
}
