export function isIgnoredPath(file: string): boolean;
export function isVersionOnlyChange(
  files: string[],
  options?: { previousSha?: string; currentSha?: string },
): boolean;
export function shouldIgnore(
  files: string[],
  options?: { previousSha?: string; currentSha?: string },
): boolean;
