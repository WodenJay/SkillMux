import React from "react";
import { describe, expect, it, vi } from "vitest";

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

describe("launchTui", () => {
  it("renders the dashboard app and waits for exit", async () => {
    const options = {
      homeDir: "C:/tmp/home",
      skillmuxHome: "C:/tmp/home/.skillmux"
    };

    await launchTui(options);

    expect(renderMock).toHaveBeenCalledTimes(1);
    expect(renderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: App,
        props: options
      })
    );
    expect(waitUntilExitMock).toHaveBeenCalledTimes(1);
  });
});
