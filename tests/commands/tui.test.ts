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
});
