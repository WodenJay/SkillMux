import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { renderMock, waitUntilExitMock } = vi.hoisted(() => {
  const waitUntilExitMock = vi.fn().mockResolvedValue(undefined);
  const renderMock = vi.fn(() => ({
    waitUntilExit: waitUntilExitMock
  }));

  return { renderMock, waitUntilExitMock };
});

vi.mock("ink", async () => {
  const actual = await vi.importActual<typeof import("ink")>("ink");

  return {
    ...actual,
    render: renderMock
  };
});

import { App } from "../../src/tui/app";
import { launchTui } from "../../src/tui/launch-tui";

const alternateScreenEnter = "\u001B[?1049h";
const alternateScreenExit = "\u001B[?1049l";
const cursorHide = "\u001B[?25l";
const cursorShow = "\u001B[?25h";

describe("launchTui", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("enters alternate screen before rendering and restores on normal exit", async () => {
    const options = {
      homeDir: "C:/tmp/home",
      skillmuxHome: "C:/tmp/home/.skillmux"
    };
    const writes: string[] = [];

    vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
      writes.push(String(chunk));
      return true;
    });

    await launchTui(options);

    expect(renderMock).toHaveBeenCalledTimes(1);
    expect(renderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: App,
        props: options
      })
    );
    expect(waitUntilExitMock).toHaveBeenCalledTimes(1);
    expect(writes).toEqual([
      alternateScreenEnter,
      cursorHide,
      alternateScreenExit,
      cursorShow
    ]);
  });

  it("restores alternate screen and cursor when rendering throws", async () => {
    const renderFailure = new Error("render failed");
    const writes: string[] = [];

    renderMock.mockImplementationOnce(() => {
      throw renderFailure;
    });

    vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
      writes.push(String(chunk));
      return true;
    });

    await expect(launchTui()).rejects.toThrow(renderFailure);

    expect(renderMock).toHaveBeenCalledTimes(1);
    expect(waitUntilExitMock).not.toHaveBeenCalled();
    expect(writes).toEqual([
      alternateScreenEnter,
      cursorHide,
      alternateScreenExit,
      cursorShow
    ]);
  });

  it("restores alternate screen and cursor when the Ink session rejects", async () => {
    const sessionFailure = new Error("session failed");
    const writes: string[] = [];

    waitUntilExitMock.mockRejectedValueOnce(sessionFailure);

    vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
      writes.push(String(chunk));
      return true;
    });

    await expect(launchTui()).rejects.toThrow(sessionFailure);

    expect(renderMock).toHaveBeenCalledTimes(1);
    expect(waitUntilExitMock).toHaveBeenCalledTimes(1);
    expect(writes).toEqual([
      alternateScreenEnter,
      cursorHide,
      alternateScreenExit,
      cursorShow
    ]);
  });
});
