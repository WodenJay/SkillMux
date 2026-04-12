import { Command } from "commander";

export function buildCli(): Command {
  const program = new Command();
  program.name("skillmux");
  program.command("scan");
  return program;
}
