import { Box, Text } from "ink";
import type { DoctorModal } from "../state";
import { useTheme } from "../theme";

export type DoctorDialogProps = {
  modal: DoctorModal;
  scrollOffset?: number;
  width?: number;
  height?: number;
};

type DoctorIssue = NonNullable<Extract<DoctorModal, { status: "ready" }>["report"]["issues"]>[number];

function issueLabel(issue: DoctorIssue): string {
  return `${issue.severity} ${issue.code}`;
}

function issuePath(issue: DoctorIssue): string | null {
  return issue.path ?? null;
}

function visibleIssueCount(height: number): number {
  return Math.max(height - 5, 1);
}

export function DoctorDialog({
  modal,
  scrollOffset = 0,
  width = 72,
  height = 14
}: DoctorDialogProps) {
  const theme = useTheme();

  if (modal.status === "loading") {
    return (
      <Box flexDirection="column" width={width} height={height}>
        <Text bold color={theme.fg.emphasis}>Doctor</Text>
        <Text color={theme.fg.muted}>Loading doctor diagnostics...</Text>
        <Text dimColor>[Esc] close</Text>
      </Box>
    );
  }

  if (modal.status === "error") {
    return (
      <Box flexDirection="column" width={width} height={height}>
        <Text bold color={theme.fg.emphasis}>Doctor</Text>
        <Text color={theme.status.error}>{modal.errorMessage}</Text>
        <Text dimColor>[Esc] close</Text>
      </Box>
    );
  }

  const issues = modal.report.issues;
  const maxIssues = visibleIssueCount(height);
  const maxOffset = Math.max(issues.length - maxIssues, 0);
  const clampedOffset = Math.min(Math.max(scrollOffset, 0), maxOffset);
  const visibleIssues = issues.slice(clampedOffset, clampedOffset + maxIssues);

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Text bold color={theme.fg.emphasis}>Doctor</Text>
      <Text dimColor>{issues.length === 0 ? "No doctor issues found." : `${issues.length} issue(s) found`}</Text>
      {issues.length === 0 ? null : (
        <>
          {visibleIssues.map((issue) => (
            <Text key={`${issue.code}:${issue.path ?? issue.message}`}>
              <Text color={issue.severity === "error" ? theme.status.error : theme.status.warning}>! </Text>
              <Text color={theme.fg.default}>
                {issueLabel(issue)} - {issue.message}
                {issuePath(issue) === null ? "" : ` - ${issuePath(issue)}`}
              </Text>
            </Text>
          ))}
          {issues.length > visibleIssues.length ? (
            <Text dimColor>
              Showing {clampedOffset + 1}-{clampedOffset + visibleIssues.length} of {issues.length}
            </Text>
          ) : null}
        </>
      )}
      <Text dimColor>[Up/Down] scroll   [Esc] close</Text>
    </Box>
  );
}
