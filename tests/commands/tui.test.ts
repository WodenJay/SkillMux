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

  it("shows help without running the tui action", async () => {
    const cli = buildCli();
    cli.exitOverride();
    const stdoutChunks: string[] = [];
    const originalWrite = process.stdout.write;
    process.stdout.write = ((chunk: string | Uint8Array) => {
      stdoutChunks.push(
        typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8")
      );
      return true;
    }) as typeof process.stdout.write;

    try {
      await expect(
        cli.parseAsync(["node", "skillmux", "tui", "--help"], { from: "node" })
      ).rejects.toThrow(/process\.exit unexpectedly called with "0"/);
    } finally {
      process.stdout.write = originalWrite;
    }

    expect(stdoutChunks.join("")).toContain(
      "Open the interactive SkillMux dashboard"
    );
  });

  it("reports non-interactive CLI use without surfacing a stack trace", async () => {
    const cli = buildCli();
    const stderrChunks: string[] = [];
    const originalWrite = process.stderr.write;
    const originalExitCode = process.exitCode;
    let exitCodeAfterRun: string | number | undefined;
    process.exitCode = 0;
    process.stderr.write = ((chunk: string | Uint8Array) => {
      stderrChunks.push(
        typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8")
      );
      return true;
    }) as typeof process.stderr.write;

    try {
      await cli.parseAsync(["node", "skillmux", "tui"], { from: "node" });
      exitCodeAfterRun = process.exitCode;
    } finally {
      process.stderr.write = originalWrite;
      process.exitCode = originalExitCode;
    }

    const stderr = stderrChunks.join("");
    expect(exitCodeAfterRun).toBe(1);
    expect(stderr).toContain("requires an interactive terminal");
    expect(stderr).not.toContain("Error:");
  });
});
