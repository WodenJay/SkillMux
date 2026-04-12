import * as fs from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Manifest, ScanIssue } from "../core/types";
import { loadUserConfig, type UserConfig } from "../config/load-user-config";
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
import { normalizeAbsolutePath } from "../fs/path-utils";
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

function buildIssue(
  code: string,
  severity: ScanIssue["severity"],
  message: string,
  path?: string
): ScanIssue {
  return path === undefined ? { code, severity, message } : { code, severity, message, path };
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

async function addUnmanagedDirectoryIssues(
  entries: ScannedSkillEntry[],
  issues: ScanIssue[]
): Promise<void> {
  for (const entry of entries) {
    if (entry.kind !== "unmanaged-directory") {
      continue;
    }

    if (await pathExists(join(entry.path, "SKILL.md"))) {
      issues.push(
        buildIssue(
          "unmanaged-skill-directory",
          "warning",
          `Unmanaged skill directory is present for ${entry.agentId}/${entry.skillName}`,
          entry.path
        )
      );
    }
  }
}

async function addMissingManagedSkillIssues(
  manifest: Manifest,
  issues: ScanIssue[]
): Promise<void> {
  for (const skill of Object.values(manifest.skills)) {
    if (await pathExists(skill.path)) {
      continue;
    }

    issues.push(
      buildIssue(
        "missing-managed-skill-path",
        "error",
        `Managed skill path is missing for ${skill.id}`,
        skill.path
      )
    );
  }
}

function addConflictingAgentPathIssues(
  agents: DiscoveredAgent[],
  issues: ScanIssue[]
): void {
  const pathToAgents = new Map<string, DiscoveredAgent[]>();

  for (const agent of agents) {
    const key = normalizeAbsolutePath(agent.absoluteSkillsDirectoryPath);
    const current = pathToAgents.get(key) ?? [];
    current.push(agent);
    pathToAgents.set(key, current);
  }

  for (const conflictedAgents of pathToAgents.values()) {
    if (conflictedAgents.length < 2) {
      continue;
    }

    const agentIds = conflictedAgents
      .map((agent) => agent.id)
      .sort((left, right) => left.localeCompare(right));

    issues.push(
      buildIssue(
        "conflicting-agent-path",
        "warning",
        `Multiple agents resolve to the same skills directory: ${agentIds.join(", ")}`,
        conflictedAgents[0].absoluteSkillsDirectoryPath
      )
    );
  }
}

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

  await addUnmanagedDirectoryIssues(entries, issues);
  await addMissingManagedSkillIssues(manifest, issues);
  addConflictingAgentPathIssues(agents, issues);

  const dedupedIssues = [...issues].sort((left, right) => {
    const leftKey = `${left.severity}:${left.code}:${left.path ?? ""}:${left.message}`;
    const rightKey = `${right.severity}:${right.code}:${right.path ?? ""}:${right.message}`;
    return leftKey.localeCompare(rightKey);
  });

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
