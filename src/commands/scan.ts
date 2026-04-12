import { homedir } from "node:os";
import type { AgentRecord, Manifest, ScanIssue } from "../core/types";
import { resolveSkillmuxHome } from "../config/resolve-skillmux-home";
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
import { writeManifest } from "../manifest/write-manifest";
import { formatIssue } from "../output/format-issue";
import { printJson } from "../output/print-json";
import { printTable } from "../output/print-table";

export type RunScanOptions = {
  homeDir?: string;
  skillmuxHome?: string;
  platform?: NodeJS.Platform;
  now?: Date;
  json?: boolean;
};

export type RunScanResult = {
  manifest: Manifest;
  agents: DiscoveredAgent[];
  entries: ScannedSkillEntry[];
  issues: ScanIssue[];
  output: string;
};

function buildAgentRecord(
  agent: DiscoveredAgent,
  timestamp: string,
  previousRecord?: AgentRecord
): AgentRecord {
  const lastSeenAt = agent.exists ? timestamp : previousRecord?.lastSeenAt ?? null;

  return {
    id: agent.id,
    name: agent.stableName,
    path: agent.absoluteSkillsDirectoryPath,
    discovery: agent.discovery,
    available: agent.exists && agent.supportedOnPlatform,
    lastSeenAt
  };
}

function buildScanOutput(result: Omit<RunScanResult, "output">, json: boolean): string {
  if (json) {
    return printJson({
      lastScan: result.manifest.lastScan,
      agents: result.agents.map((agent) => ({
        id: agent.id,
        name: agent.stableName,
        path: agent.absoluteSkillsDirectoryPath,
        exists: agent.exists,
        supportedOnPlatform: agent.supportedOnPlatform
      })),
      entries: result.entries
    });
  }

  if (result.entries.length === 0) {
    return "No skill entries found.\n";
  }

  const table = printTable(
    result.entries.map((entry) => ({
      agent: entry.agentId,
      skill: entry.skillName,
      kind: entry.kind,
      path: entry.path
    })),
    [
      { key: "agent", label: "Agent" },
      { key: "skill", label: "Skill" },
      { key: "kind", label: "Kind" },
      { key: "path", label: "Path" }
    ]
  );

  if (result.issues.length === 0) {
    return table;
  }

  return `${table}\n${result.issues.map(formatIssue).join("\n")}\n`;
}

export async function runScan(options: RunScanOptions = {}): Promise<RunScanResult> {
  const homeDir = options.homeDir ?? homedir();
  const resolvedPaths = resolveSkillmuxHome(homeDir);
  const skillmuxHome = options.skillmuxHome ?? resolvedPaths.skillmuxHome;
  const manifest = await readManifest(skillmuxHome);
  const agents = await discoverAgents({
    homeDir,
    platform: options.platform,
    skillmuxHome
  });

  const timestamp = (options.now ?? new Date()).toISOString();
  const entries: ScannedSkillEntry[] = [];
  const issues: ScanIssue[] = [];

  for (const agent of agents) {
    const scannedAgent = await scanAgentSkills(agent, skillmuxHome);
    entries.push(...scannedAgent.entries);
    issues.push(...scannedAgent.issues);
    manifest.agents[agent.id] = buildAgentRecord(
      agent,
      timestamp,
      manifest.agents[agent.id]
    );
  }

  manifest.lastScan = {
    at: timestamp,
    issues
  };

  await writeManifest(skillmuxHome, manifest);

  const resultWithoutOutput = {
    manifest,
    agents,
    entries,
    issues
  };

  return {
    ...resultWithoutOutput,
    output: buildScanOutput(resultWithoutOutput, options.json === true)
  };
}
