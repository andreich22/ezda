export function isIgnoredPath(file: string): boolean;
export function isChoreCommit(message?: string): boolean;
export function isVersionBump(
  files: string[],
  options?: {
    previousSha?: string;
    currentSha?: string;
    versionChanged?: boolean;
  },
): boolean;
export function shouldIgnore(
  files: string[],
  options?: {
    previousSha?: string;
    currentSha?: string;
    commitMessage?: string;
    versionChanged?: boolean;
  },
): boolean;
