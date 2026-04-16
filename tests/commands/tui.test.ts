import { describe, expect, it, vi } from "vitest";
import { buildCli } from "../../src/index";
import { runTui } from "../../src/commands/tui";

describe("tui command", () => {
  it("is registered on the CLI", () => {
    const cli = buildCli();

    expect(cli.commands.map((command) => command.name())).toContain("tui");
  });

  it("does not launch when stdio is not interactive", async () => {
    const launch = vi.fn();
    const stderr = { write: vi.fn() };

    await expect(
      runTui({
        stdin: { isTTY: false },
        stdout: { isTTY: true },
        stderr,
        launch
      })
    ).rejects.toThrow(/interactive terminal/i);

    expect(launch).not.toHaveBeenCalled();
    expect(stderr.write).toHaveBeenCalledWith(
      "skillmux tui requires an interactive terminal. Use skillmux list, skillmux scan, or skillmux doctor for non-interactive output.\n"
    );
  });

  it("does not launch when stdout is not interactive", async () => {
    const launch = vi.fn();
    const stderr = { write: vi.fn() };

    await expect(
      runTui({
        stdin: { isTTY: true },
        stdout: { isTTY: false },
        stderr,
        launch
      })
    ).rejects.toThrow(/interactive terminal/i);

    expect(launch).not.toHaveBeenCalled();
    expect(stderr.write).toHaveBeenCalledWith(
      "skillmux tui requires an interactive terminal. Use skillmux list, skillmux scan, or skillmux doctor for non-interactive output.\n"
    );
  });

  it("passes only home options to an injected launcher", async () => {
    const launch = vi.fn().mockResolvedValue(undefined);
    const stderr = { write: vi.fn() };

    await runTui({
      stdin: { isTTY: true },
      stdout: { isTTY: true },
      stderr,
      homeDir: "C:/tmp/home",
      skillmuxHome: "C:/tmp/home/.skillmux",
      launch
    });

    expect(launch).toHaveBeenCalledTimes(1);
    expect(launch).toHaveBeenCalledWith({
      homeDir: "C:/tmp/home",
      skillmuxHome: "C:/tmp/home/.skillmux"
    });
    expect(stderr.write).not.toHaveBeenCalled();
  });
});
