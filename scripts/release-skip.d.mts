export interface ShouldSkipReleaseOptions {
  body?: string;
  tasksDir?: string;
}

export function extractTaskId(body: string | undefined): string | null;
export function shouldSkipRelease(options?: ShouldSkipReleaseOptions): boolean;
