export const APP_MENU_ITEMS = [
  { label: "Sign in", href: "/auth" },
  { label: "Routes", href: "/routes" },
] as const;

export const AUTHENTICATED_APP_MENU_ITEMS = [
  { label: "My Routes", href: "/routes?visibility=my" },
  { label: "Private Routes", href: "/routes?visibility=private" },
] as const;
