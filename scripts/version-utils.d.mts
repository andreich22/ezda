export function validateVersion(version: unknown, source?: string): string;
export function compareVersions(left: string, right: string): number;
export function assertVersionIncreased(previousVersion: string, currentVersion: string): void;
export function assertTagConsistency(args: {
  tagExists: boolean;
  tagCommit?: string;
  mergeSha: string;
  tagName: string;
}): void;
