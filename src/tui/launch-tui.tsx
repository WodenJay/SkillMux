import React from "react";
import { render } from "ink";
import { App } from "./app";

export type LaunchTuiOptions = {
  homeDir?: string;
  skillmuxHome?: string;
};

const alternateScreenEnter = "\u001B[?1049h";
const alternateScreenExit = "\u001B[?1049l";
const cursorHide = "\u001B[?25l";
const cursorShow = "\u001B[?25h";
const lifecycleTraceEnabled = process.env.SKILLMUX_TUI_PTY_TRACE === "1";

export async function launchTui(options: LaunchTuiOptions = {}): Promise<void> {
  process.stdout.write(alternateScreenEnter);
  process.stdout.write(cursorHide);
  writeLifecycleTrace("alt-screen-enter");

  try {
    const instance = render(<App {...options} />);
    await instance.waitUntilExit();
  } finally {
    writeLifecycleTrace("alt-screen-exit");
    process.stdout.write(alternateScreenExit);
    process.stdout.write(cursorShow);
  }
}

function writeLifecycleTrace(stage: "alt-screen-enter" | "alt-screen-exit"): void {
  if (!lifecycleTraceEnabled) {
    return;
  }

  process.stderr.write(`[skillmux:${stage}]\n`);
}
