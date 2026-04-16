import { describe, expect, it } from "vitest";
import { buildCli } from "../../src/index";

describe("buildCli", () => {
  it("registers the scan command", () => {
    const cli = buildCli();

    expect(cli.commands.map((command) => command.name())).toEqual(
      expect.arrayContaining(["scan", "tui"])
    );
  });
});
