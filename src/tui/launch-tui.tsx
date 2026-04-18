import React from "react";
import { render } from "ink";
import { App } from "./app";

export type LaunchTuiOptions = {
  homeDir?: string;
  skillmuxHome?: string;
};

export async function launchTui(options: LaunchTuiOptions = {}): Promise<void> {
  const instance = render(<App {...options} />);
  await instance.waitUntilExit();
}
