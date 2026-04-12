import { Command } from "commander";
import { runList } from "./commands/list";
import { runScan } from "./commands/scan";

export function buildCli(): Command {
  const program = new Command();
  program.name("skillmux");

  program
    .command("scan")
    .option("--json", "Emit structured JSON output")
    .action(async (options: { json?: boolean }) => {
      const result = await runScan({ json: options.json === true });
      process.stdout.write(result.output);
    });

  program
    .command("list")
    .option("--view <view>", "Select records, agents, or skills view", "records")
    .option("--format <format>", "Select table or json output", "table")
    .action(async (options: { view?: "records" | "agents" | "skills"; format?: "table" | "json" }) => {
      const result = await runList({
        view: options.view,
        format: options.format
      });
      process.stdout.write(result.output);
    });

  return program;
}
