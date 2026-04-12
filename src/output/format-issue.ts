import type { ScanIssue } from "../core/types";

export function formatIssue(issue: ScanIssue): string {
  if (issue.path === undefined) {
    return `[${issue.severity}] ${issue.code}: ${issue.message}`;
  }

  return `[${issue.severity}] ${issue.code} @ ${issue.path}: ${issue.message}`;
}
