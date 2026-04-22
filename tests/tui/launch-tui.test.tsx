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

  it("writes alternate-screen enter and cursor-hide before rendering, then restores on normal exit", async () => {
    const options = {
      homeDir: "C:/tmp/home",
      skillmuxHome: "C:/tmp/home/.skillmux"
    };
    const writes: string[] = [];
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
      writes.push(String(chunk));
      return true;
    });

    renderMock.mockImplementationOnce(() => {
      expect(writeSpy).toHaveBeenCalledTimes(2);
      expect(writeSpy).toHaveBeenNthCalledWith(1, alternateScreenEnter);
      expect(writeSpy).toHaveBeenNthCalledWith(2, cursorHide);

      return {
        waitUntilExit: waitUntilExitMock
      };
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

  it("writes alternate-screen enter and cursor-hide before rendering, then restores when rendering throws", async () => {
    const renderFailure = new Error("render failed");
    const writes: string[] = [];
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
      writes.push(String(chunk));
      return true;
    });

    renderMock.mockImplementationOnce(() => {
      expect(writeSpy).toHaveBeenCalledTimes(2);
      expect(writeSpy).toHaveBeenNthCalledWith(1, alternateScreenEnter);
      expect(writeSpy).toHaveBeenNthCalledWith(2, cursorHide);
      throw renderFailure;
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

  it("writes alternate-screen enter and cursor-hide before rendering, then restores when the Ink session rejects", async () => {
    const sessionFailure = new Error("session failed");
    const writes: string[] = [];
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
      writes.push(String(chunk));
      return true;
    });

    renderMock.mockImplementationOnce(() => {
      expect(writeSpy).toHaveBeenCalledTimes(2);
      expect(writeSpy).toHaveBeenNthCalledWith(1, alternateScreenEnter);
      expect(writeSpy).toHaveBeenNthCalledWith(2, cursorHide);

      return {
        waitUntilExit: waitUntilExitMock.mockRejectedValueOnce(sessionFailure)
      };
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
