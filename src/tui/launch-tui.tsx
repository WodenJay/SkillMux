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

export async function launchTui(options: LaunchTuiOptions = {}): Promise<void> {
  process.stdout.write(alternateScreenEnter);
  process.stdout.write(cursorHide);

  try {
    const instance = render(<App {...options} />);
    await instance.waitUntilExit();
  } finally {
    process.stdout.write(alternateScreenExit);
    process.stdout.write(cursorShow);
  }
}
