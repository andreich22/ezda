import type {RouteVisibility} from "./db/routes";

export function normalizeRouteVisibility(value: string | undefined, authenticated: boolean): RouteVisibility {
  if (!authenticated) return "public";
  if (value === "all" || value === "my" || value === "private") return value;
  return "public";
}
