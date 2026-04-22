import React from "react";
import { render, type Instance } from "ink";
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
  let instance: Instance | null = null;
  let sigintRequested = false;

  const handleSigint = () => {
    sigintRequested = true;
    instance?.unmount();
  };

  try {
    process.once("SIGINT", handleSigint);
    process.stdout.write(alternateScreenEnter);
    process.stdout.write(cursorHide);
    await writeLifecycleTrace("alt-screen-enter");

    instance = render(<App {...options} />);
    if (sigintRequested) {
      instance.unmount();
    }
    await instance.waitUntilExit();
    await writeLifecycleTrace("session-exit-clean");
  } catch (error) {
    failure = error;
  } finally {
    process.removeListener("SIGINT", handleSigint);
    failure = await runCleanup(failure, () => writeLifecycleTrace("alt-screen-exit"));
    failure = await runCleanup(failure, () => process.stdout.write(alternateScreenExit));
    failure = await runCleanup(failure, () => process.stdout.write(cursorShow));
  }

  if (failure !== undefined) {
    throw failure;
  }
}

function writeLifecycleTrace(
  stage: "alt-screen-enter" | "session-exit-clean" | "alt-screen-exit"
): Promise<void> {
  if (!lifecycleTraceEnabled) {
    return Promise.resolve();
  }

  process.stderr.write(`[skillmux:${stage}]\n`);
  return stage === "session-exit-clean" ? sleep(0) : Promise.resolve();
}

async function runCleanup(
  failure: unknown | undefined,
  cleanup: () => unknown | Promise<unknown>
): Promise<unknown | undefined> {
  try {
    await cleanup();
    return failure;
  } catch (error) {
    return failure === undefined ? error : failure;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
