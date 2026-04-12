import type { ScanIssue } from "../core/types";

export function formatIssue(issue: ScanIssue): string {
  const location = issue.path === undefined ? "" : ` (${issue.path})`;
  return `[${issue.severity}] ${issue.code}: ${issue.message}${location}`;
}
