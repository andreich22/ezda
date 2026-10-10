export function buildRouteSharePath(id: string): string {
  return `/routes/${id}`;
}

export function buildRouteShareUrl(pathOrId: string, origin?: string): string {
  const path = pathOrId.startsWith("/") ? pathOrId : buildRouteSharePath(pathOrId);
  if (!origin) return path;
  return new URL(path, origin).toString();
}

export type CopyResult = {ok: true; method: "clipboard" | "fallback"} | {ok: false; error: string};

export async function copyTextToClipboard(text: string): Promise<CopyResult> {
  try {
    const clipboard = (globalThis as {navigator?: Navigator}).navigator?.clipboard;
    if (clipboard && typeof clipboard.writeText === "function") {
      await clipboard.writeText(text);
      return {ok: true, method: "clipboard"};
    }
  } catch {
    // Fall through to the legacy fallback below so a denied
    // clipboard permission does not break the copy action.
  }

  try {
    if (typeof document === "undefined" || typeof document.createElement !== "function") {
      return {ok: false, error: "Clipboard is not available"};
    }
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const succeeded =
      typeof document.execCommand === "function" ? document.execCommand("copy") : false;
    document.body.removeChild(textarea);
    if (succeeded) return {ok: true, method: "fallback"};
    return {ok: false, error: "Clipboard is not available"};
  } catch {
    return {ok: false, error: "Unable to copy the link"};
  }
}
