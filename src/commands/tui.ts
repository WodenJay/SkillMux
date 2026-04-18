import type { LaunchTuiOptions } from "../tui/launch-tui";
import { isInteractiveTerminal, type TtyLike } from "../tui/tty";

export type RunTuiOptions = LaunchTuiOptions & {
  stdin?: TtyLike;
  stdout?: TtyLike;
  stderr?: { write(message: string): unknown };
  launch?: (options: LaunchTuiOptions) => Promise<void>;
};

export class TuiNonInteractiveTerminalError extends Error {
  constructor() {
    super("skillmux tui requires an interactive terminal");
    this.name = "TuiNonInteractiveTerminalError";
  }
}

async function launchDefaultTui(options: LaunchTuiOptions): Promise<void> {
  const { launchTui } = await import("../tui/launch-tui");

  await launchTui(options);
}

export async function runTui(options: RunTuiOptions = {}): Promise<void> {
  const stdin = options.stdin ?? process.stdin;
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;

  if (!isInteractiveTerminal(stdin, stdout)) {
    stderr.write(
      "skillmux tui requires an interactive terminal. Use skillmux list, skillmux scan, or skillmux doctor for non-interactive output.\n"
    );
    throw new TuiNonInteractiveTerminalError();
  }

  await (options.launch ?? launchDefaultTui)({
    homeDir: options.homeDir,
    skillmuxHome: options.skillmuxHome
  });
}
