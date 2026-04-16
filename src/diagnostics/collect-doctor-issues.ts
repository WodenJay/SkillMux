import * as fs from "node:fs/promises";
import { join } from "node:path";
import type { Manifest, ScanIssue } from "../core/types";
import type { DiscoveredAgent } from "../discovery/discover-agents";
import type { ScannedSkillEntry } from "../discovery/infer-skill-entry";
import { normalizeAbsolutePath } from "../fs/path-utils";

export type CollectDoctorIssuesInput = {
  manifest: Manifest;
  agents: DiscoveredAgent[];
  entries: ScannedSkillEntry[];
};

function buildIssue(
  code: string,
  severity: ScanIssue["severity"],
  message: string,
  path?: string
): ScanIssue {
  return path === undefined
    ? { code, severity, message }
    : { code, severity, message, path };
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

function issueSortKey(issue: ScanIssue): string {
  return `${issue.severity}:${issue.code}:${issue.path ?? ""}:${issue.message}`;
}

function sortIssues(issues: ScanIssue[]): ScanIssue[] {
  return [...issues].sort((left, right) =>
    issueSortKey(left).localeCompare(issueSortKey(right))
  );
}

export function dedupeAndSortIssues(issues: ScanIssue[]): ScanIssue[] {
  const issueByKey = new Map<string, ScanIssue>();

  for (const issue of issues) {
    issueByKey.set(issueSortKey(issue), issue);
  }

  return sortIssues([...issueByKey.values()]);
}

export async function collectDoctorIssues(
  input: CollectDoctorIssuesInput
): Promise<ScanIssue[]> {
  const issues: ScanIssue[] = [];

  await addUnmanagedDirectoryIssues(input.entries, issues);
  await addMissingManagedSkillIssues(input.manifest, issues);
  addConflictingAgentPathIssues(input.agents, issues);

  return dedupeAndSortIssues(issues);
}
