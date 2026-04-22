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
  let failure: unknown;

  try {
    process.stdout.write(alternateScreenEnter);
    process.stdout.write(cursorHide);
    writeLifecycleTrace("alt-screen-enter");

    const instance = render(<App {...options} />);
    await instance.waitUntilExit();
  } catch (error) {
    failure = error;
  } finally {
    failure = runCleanup(failure, () => writeLifecycleTrace("alt-screen-exit"));
    failure = runCleanup(failure, () => process.stdout.write(alternateScreenExit));
    failure = runCleanup(failure, () => process.stdout.write(cursorShow));
  }

  if (failure !== undefined) {
    throw failure;
  }
}

function writeLifecycleTrace(stage: "alt-screen-enter" | "alt-screen-exit"): void {
  if (!lifecycleTraceEnabled) {
    return;
  }

  process.stderr.write(`[skillmux:${stage}]\n`);
}

function runCleanup(
  failure: unknown | undefined,
  cleanup: () => unknown
): unknown | undefined {
  try {
    cleanup();
    return failure;
  } catch (error) {
    return failure === undefined ? error : failure;
  }
}
