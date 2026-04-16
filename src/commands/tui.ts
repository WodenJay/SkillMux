import { launchTui, type LaunchTuiOptions } from "../tui/launch-tui";
import { isInteractiveTerminal, type TtyLike } from "../tui/tty";

export type RunTuiOptions = LaunchTuiOptions & {
  stdin?: TtyLike;
  stdout?: TtyLike;
  stderr?: { write(message: string): unknown };
  launch?: (options: LaunchTuiOptions) => Promise<void>;
};

export async function runTui(options: RunTuiOptions = {}): Promise<void> {
  const stdin = options.stdin ?? process.stdin;
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;

  if (!isInteractiveTerminal(stdin, stdout)) {
    stderr.write(
      "skillmux tui requires an interactive terminal. Use skillmux list, skillmux scan, or skillmux doctor for non-interactive output.\n"
    );
    throw new Error("skillmux tui requires an interactive terminal");
  }

  await (options.launch ?? launchTui)({
    homeDir: options.homeDir,
    skillmuxHome: options.skillmuxHome
  });
}
