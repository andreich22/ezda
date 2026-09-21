export const SIDEBAR_STORAGE_KEY = "ezda.sidebar.collapsed";

export function parseSidebarCollapsed(value: string | null): boolean {
  return value === "true";
}
