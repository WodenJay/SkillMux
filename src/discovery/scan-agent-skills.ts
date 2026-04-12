import * as fs from "node:fs/promises";
import type { ScanIssue } from "../core/types";
import type { DiscoveredAgent } from "./discover-agents";
import {
  inferSkillEntry,
  type ScannedSkillEntry
} from "./infer-skill-entry";

export type ScanAgentSkillsResult = {
  entries: ScannedSkillEntry[];
  issues: ScanIssue[];
};

export async function scanAgentSkills(
  agent: DiscoveredAgent,
  skillmuxHome: string
): Promise<ScanAgentSkillsResult> {
  if (!agent.exists || !agent.supportedOnPlatform) {
    return {
      entries: [],
      issues: []
    };
  }

  const directoryEntries = await fs.readdir(agent.absoluteSkillsDirectoryPath, {
    withFileTypes: true
  });
  const sortedDirectoryEntries = [...directoryEntries].sort((left, right) =>
    left.name.localeCompare(right.name)
  );

  const entries: ScannedSkillEntry[] = [];
  const issues: ScanIssue[] = [];

  for (const directoryEntry of sortedDirectoryEntries) {
    const result = await inferSkillEntry({
      agentId: agent.id,
      agentName: agent.stableName,
      path: `${agent.absoluteSkillsDirectoryPath}/${directoryEntry.name}`,
      skillmuxHome
    });

    entries.push(result.entry);

    if (result.issue !== undefined) {
      issues.push(result.issue);
    }
  }

  return {
    entries,
    issues
  };
}
