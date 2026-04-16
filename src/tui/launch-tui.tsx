export type LaunchTuiOptions = {
  homeDir?: string;
  skillmuxHome?: string;
};

export async function launchTui(_options: LaunchTuiOptions = {}): Promise<void> {
  throw new Error("TUI launch is not implemented yet");
}
