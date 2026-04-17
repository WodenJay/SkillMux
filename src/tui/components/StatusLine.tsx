import { Box, Text } from "ink";

export type StatusLineProps = {
  busy: boolean;
  statusMessage: string | null;
  lastScanAt: string | null;
  issueCount: number;
};

export function StatusLine({
  busy,
  statusMessage,
  lastScanAt,
  issueCount
}: StatusLineProps) {
  const message =
    statusMessage ??
    `Last scan: ${lastScanAt ?? "never"} | issues: ${issueCount}`;

  return (
    <Box height={1}>
      <Text color={busy ? "cyan" : undefined}>
        {busy ? "scanning..." : message}
      </Text>
    </Box>
  );
}
