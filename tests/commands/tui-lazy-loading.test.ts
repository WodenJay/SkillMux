import { afterEach, describe, expect, it, vi } from "vitest";

const lazyImportState = vi.hoisted(() => ({
  launchModuleImported: false,
  launchTui: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("../../src/tui/launch-tui", () => {
  lazyImportState.launchModuleImported = true;

  return {
    launchTui: lazyImportState.launchTui
  };
});

afterEach(() => {
  vi.resetModules();
  lazyImportState.launchModuleImported = false;
  lazyImportState.launchTui.mockClear();
});

describe("tui lazy loading", () => {
  it("does not import the default launcher during CLI registration or help", async () => {
    const { buildCli } = await import("../../src/index");

    expect(lazyImportState.launchModuleImported).toBe(false);

    const cli = buildCli();

    expect(lazyImportState.launchModuleImported).toBe(false);
    expect(cli.commands.map((command) => command.name())).toContain("tui");

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
    expect(lazyImportState.launchModuleImported).toBe(false);
  });

  it("imports the default launcher only when interactive tui runs", async () => {
    const { runTui } = await import("../../src/commands/tui");

    expect(lazyImportState.launchModuleImported).toBe(false);

    await runTui({
      stdin: { isTTY: true },
      stdout: { isTTY: true },
      stderr: { write: vi.fn() }
    });

    expect(lazyImportState.launchModuleImported).toBe(true);
    expect(lazyImportState.launchTui).toHaveBeenCalledTimes(1);
  });
});
