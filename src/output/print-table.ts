export type TableColumn<Row extends Record<string, unknown>> = {
  key: keyof Row;
  label: string;
};

export function printTable<Row extends Record<string, unknown>>(
  rows: Row[],
  columns: TableColumn<Row>[]
): string {
  const renderedRows = rows.map((row) =>
    columns.map((column) => String(row[column.key] ?? ""))
  );
  const widths = columns.map((column, index) =>
    Math.max(
      column.label.length,
      ...renderedRows.map((row) => row[index]?.length ?? 0)
    )
  );

  const header = columns
    .map((column, index) => column.label.padEnd(widths[index]))
    .join("  ");
  const separator = widths.map((width) => "-".repeat(width)).join("  ");
  const body = renderedRows.map((row) =>
    row.map((cell, index) => cell.padEnd(widths[index])).join("  ")
  );

  return `${[header, separator, ...body].join("\n")}\n`;
}
