import { SerializeAddon } from "@xterm/addon-serialize";
import { Terminal } from "@xterm/headless";

export type ScreenBuffer = {
  write(data: string): Promise<void>;
  resize(cols: number, rows: number): void;
  snapshot(): string;
};

export function createScreenBuffer({
  cols,
  rows
}: {
  cols: number;
  rows: number;
}): ScreenBuffer {
  const terminal = new Terminal({ cols, rows, allowProposedApi: true });
  const serializer = new SerializeAddon();

  terminal.loadAddon(serializer);

  return {
    write(data) {
      return new Promise((resolve) => {
        terminal.write(data, resolve);
      });
    },
    resize(nextCols, nextRows) {
      terminal.resize(nextCols, nextRows);
    },
    snapshot() {
      return serializer.serialize();
    }
  };
}
