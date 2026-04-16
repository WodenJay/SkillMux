import { homedir } from "node:os";
import type { Manifest, ScanIssue } from "../core/types";
import { loadUserConfig, type UserConfig } from "../config/load-user-config";
import { resolveSkillmuxHome } from "../config/resolve-skillmux-home";
import {
  collectDoctorIssues,
  dedupeAndSortIssues
} from "../diagnostics/collect-doctor-issues";
import {
  discoverAgents,
  type DiscoveredAgent
} from "../discovery/discover-agents";
import {
  scanAgentSkills,
  type ScanAgentSkillsResult
} from "../discovery/scan-agent-skills";
import { type ScannedSkillEntry } from "../discovery/infer-skill-entry";
import { readManifest } from "../manifest/read-manifest";
import { formatIssue } from "../output/format-issue";
import { printJson } from "../output/print-json";
import { printTable } from "../output/print-table";

export type RunDoctorOptions = {
  homeDir?: string;
  skillmuxHome?: string;
  platform?: NodeJS.Platform;
  json?: boolean;
};

export type RunDoctorResult = {
  skillmuxHome: string;
  manifest: Manifest;
  config: UserConfig;
  agents: DiscoveredAgent[];
  entries: ScannedSkillEntry[];
  issues: ScanIssue[];
  output: string;
};

function buildTableOutput(issues: ScanIssue[]): string {
  if (issues.length === 0) {
    return "No doctor issues found.\n";
  }

  return printTable(
    issues.map((issue) => ({
      severity: issue.severity,
      code: issue.code,
      path: issue.path ?? "",
      message: issue.message
    })),
    [
      { key: "severity", label: "Severity" },
      { key: "code", label: "Code" },
      { key: "path", label: "Path" },
      { key: "message", label: "Message" }
    ]
  );
}

function buildJsonOutput(result: Omit<RunDoctorResult, "output">): string {
  return printJson({
    skillmuxHome: result.skillmuxHome,
    issues: result.issues,
    agents: result.agents.map((agent) => ({
      id: agent.id,
      path: agent.absoluteSkillsDirectoryPath,
      supportedOnPlatform: agent.supportedOnPlatform
    })),
    entries: result.entries
  });
}

export async function runDoctor(
  options: RunDoctorOptions = {}
): Promise<RunDoctorResult> {
  const homeDir = options.homeDir ?? homedir();
  const resolvedPaths = resolveSkillmuxHome(homeDir);
  const skillmuxHome = options.skillmuxHome ?? resolvedPaths.skillmuxHome;
  const [manifest, config, agents] = await Promise.all([
    readManifest(skillmuxHome),
    loadUserConfig(skillmuxHome),
    discoverAgents({
      homeDir,
      skillmuxHome,
      platform: options.platform
    })
  ]);

  const entries: ScannedSkillEntry[] = [];
  const issues: ScanIssue[] = [];

  for (const agent of agents) {
    const scannedAgent: ScanAgentSkillsResult = await scanAgentSkills(agent, skillmuxHome);
    entries.push(...scannedAgent.entries);
    issues.push(...scannedAgent.issues);
  }

  const doctorIssues = await collectDoctorIssues({
    manifest,
    agents,
    entries
  });
  const dedupedIssues = dedupeAndSortIssues([...issues, ...doctorIssues]);

  const resultWithoutOutput = {
    skillmuxHome,
    manifest,
    config,
    agents,
    entries,
    issues: dedupedIssues
  };

  return {
    ...resultWithoutOutput,
    output:
      options.json === true
        ? buildJsonOutput(resultWithoutOutput)
        : buildTableOutput(dedupedIssues)
  };
}
