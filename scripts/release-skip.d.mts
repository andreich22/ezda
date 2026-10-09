export interface FetchIssueLabelOptions {
  repository?: string;
  token?: string;
}

export function extractIssueNumber(body: string | undefined): string | null;
export function shouldSkipReleaseByLabels(labels: unknown[]): boolean;
export function fetchIssueLabelNames(issueNumber: string, options?: FetchIssueLabelOptions): string[];
