import { Command } from "commander";
import { supportedPlatforms } from "./config/default-agent-rules";
import { runAdopt } from "./commands/adopt";
import { runAgents } from "./commands/agents";
import { runConfigAddAgent } from "./commands/config-add-agent";
import { runConfigRemoveAgent } from "./commands/config-remove-agent";
import { runConfigUpdateAgent } from "./commands/config-update-agent";
import { runConfig } from "./commands/config";
import { runDoctor } from "./commands/doctor";
import { runDisable } from "./commands/disable";
import { runEnable } from "./commands/enable";
import { runImport } from "./commands/import";
import { runList } from "./commands/list";
import { runRemove } from "./commands/remove";
import { runScan } from "./commands/scan";

export function buildCli(): Command {
  const program = new Command();
  program.name("skillmux");

  program
    .command("adopt")
    .requiredOption("--agent <agent>", "Source agent id")
    .option("--skill <skill>", "One installed skill to adopt")
    .option("--json", "Emit structured JSON output")
    .action(async (options: { agent: string; skill?: string; json?: boolean }) => {
      const result = await runAdopt({
        agent: options.agent,
        skill: options.skill,
        json: options.json === true
      });
      process.stdout.write(result.output);
    });

  program
    .command("scan")
    .option("--json", "Emit structured JSON output")
    .action(async (options: { json?: boolean }) => {
      const result = await runScan({ json: options.json === true });
      process.stdout.write(result.output);
    });

  program
    .command("agents")
    .option("--json", "Emit structured JSON output")
    .action(async (options: { json?: boolean }) => {
      const result = await runAgents({ json: options.json === true });
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

  program
    .command("import")
    .requiredOption("--source <path>", "Local skill source directory")
    .requiredOption("--name <name>", "Managed skill name")
    .action(async (options: { source: string; name: string }) => {
      const result = await runImport({
        sourcePath: options.source,
        skillName: options.name
      });
      process.stdout.write(result.output);
    });

  program
    .command("doctor")
    .option("--json", "Emit structured JSON output")
    .action(async (options: { json?: boolean }) => {
      const result = await runDoctor({ json: options.json === true });
      process.stdout.write(result.output);
    });

  const configCommand = program.command("config");

  configCommand
    .option("--json", "Emit structured JSON output")
    .action(async (options: { json?: boolean }) => {
      const result = await runConfig({ json: options.json === true });
      process.stdout.write(result.output);
    });

  configCommand
    .command("add-agent")
    .requiredOption("--id <id>", "Agent id")
    .requiredOption("--root <path>", "Home-relative root path")
    .option("--skills <path>", "Skills directory path relative to the agent root", "skills")
    .option("--name <name>", "Stable display name")
    .option(
      "--platform <platform>",
      `Supported platform (${supportedPlatforms.join(", ")})`,
      (value: string, previous: string[] = []) => [...previous, value],
      []
    )
    .option("--disabled-by-default", "Mark this custom agent as disabled by default")
    .option("--json", "Emit structured JSON output")
    .action(
      async (options: {
        id: string;
        root: string;
        skills?: string;
        name?: string;
        platform?: string[];
        disabledByDefault?: boolean;
        json?: boolean;
      }) => {
        const result = await runConfigAddAgent({
          id: options.id,
          root: options.root,
          skills: options.skills,
          name: options.name,
          platforms: options.platform,
          disabledByDefault: options.disabledByDefault === true,
          json: options.json === true
        });
        process.stdout.write(result.output);
      }
    );

  configCommand
    .command("remove-agent")
    .requiredOption("--id <id>", "Agent id")
    .option("--json", "Emit structured JSON output")
    .action(async (options: { id: string; json?: boolean }) => {
      const result = await runConfigRemoveAgent({
        id: options.id,
        json: options.json === true
      });
      process.stdout.write(result.output);
    });

  configCommand
    .command("update-agent")
    .requiredOption("--id <id>", "Agent id")
    .option("--root <path>", "Home-relative root path")
    .option("--skills <path>", "Skills directory path relative to the agent root")
    .option("--name <name>", "Stable display name")
    .option(
      "--platform <platform>",
      `Supported platform (${supportedPlatforms.join(", ")})`,
      (value: string, previous: string[] = []) => [...previous, value],
      []
    )
    .option("--enabled-by-default", "Mark this custom agent as enabled by default")
    .option("--disabled-by-default", "Mark this custom agent as disabled by default")
    .option("--json", "Emit structured JSON output")
    .action(
      async (options: {
        id: string;
        root?: string;
        skills?: string;
        name?: string;
        platform?: string[];
        enabledByDefault?: boolean;
        disabledByDefault?: boolean;
        json?: boolean;
      }) => {
        const result = await runConfigUpdateAgent({
          id: options.id,
          root: options.root,
          skills: options.skills,
          name: options.name,
          platforms:
            options.platform !== undefined && options.platform.length > 0
              ? options.platform
              : undefined,
          enabledByDefault:
            options.enabledByDefault === true ? true : undefined,
          disabledByDefault: options.disabledByDefault === true,
          json: options.json === true
        });
        process.stdout.write(result.output);
      }
    );

  program
    .command("enable")
    .requiredOption("--skill <skill>", "Managed skill name or id")
    .requiredOption("--agent <agent>", "Target agent id")
    .action(async (options: { skill: string; agent: string }) => {
      const result = await runEnable({
        skill: options.skill,
        agent: options.agent
      });
      process.stdout.write(result.output);
    });

  program
    .command("disable")
    .requiredOption("--skill <skill>", "Managed skill name or id")
    .requiredOption("--agent <agent>", "Target agent id")
    .action(async (options: { skill: string; agent: string }) => {
      const result = await runDisable({
        skill: options.skill,
        agent: options.agent
      });
      process.stdout.write(result.output);
    });

  program
    .command("remove")
    .requiredOption("--skill <skill>", "Managed skill name or id")
    .option("--json", "Emit structured JSON output")
    .action(async (options: { skill: string; json?: boolean }) => {
      const result = await runRemove({
        skill: options.skill,
        json: options.json === true
      });
      process.stdout.write(result.output);
    });

  return program;
}
