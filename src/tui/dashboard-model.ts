import type { Manifest, ManagedSkill, ScanIssue } from "../core/types";
import type { AgentOverride } from "../config/load-user-config";
import type { DiscoveredAgent } from "../discovery/discover-agents";
import type {
  ScannedSkillEntry,
  SkillEntryKind
} from "../discovery/infer-skill-entry";
import { isPathInside } from "../fs/path-utils";

export type TuiAgentRow = {
  id: string;
  name: string;
  stableName?: string;
  path: string;
  homeRelativeRootPath?: string;
  skillsDirectoryPath?: string;
  supportedPlatforms?: string[];
  enabledByDefault?: boolean;
  overrideStableName?: string;
  overrideHomeRelativeRootPath?: string;
  overrideSkillsDirectoryPath?: string;
  overrideSupportedPlatforms?: string[];
  overrideEnabledByDefault?: boolean;
  discovery: "builtin" | "custom";
  exists: boolean;
  supported: boolean;
  hasUserOverride: boolean;
  canEditOverride: boolean;
  canRemoveOverride: boolean;
  activationCount?: number;
  autoDiscovered?: boolean;
  enabledCount: number;
  disabledCount: number;
  unmanagedCount: number;
  issueCount: number;
};

export type TuiEnabledSkillRow = {
  id: string;
  kind: "enabled";
  marker: "●";
  skillId: string;
  name: string;
  path: string;
  agentId: string;
  activationLinkPath: string;
};

export type TuiDisabledSkillRow = {
  id: string;
  kind: "disabled";
  marker: "○";
  skillId: string;
  name: string;
  path: string;
  agentId: string;
  activationLinkPath: string | null;
};

export type TuiUnmanagedSkillRow = {
  id: string;
  kind: "unmanaged";
  marker: "?";
  skillName: string;
  name: string;
  path: string;
  agentId: string;
  entryKind: Extract<SkillEntryKind, "unmanaged-directory" | "unmanaged-link">;
  targetPath?: string;
};

export type TuiIssueSkillRow = {
  id: string;
  kind: "issue";
  marker: "!";
  issueCode: string;
  severity: ScanIssue["severity"];
  message: string;
  path: string | null;
  agentId: string;
};

export type TuiSkillRow =
  | TuiEnabledSkillRow
  | TuiDisabledSkillRow
  | TuiUnmanagedSkillRow
  | TuiIssueSkillRow;

export type DashboardModel = {
  agents: TuiAgentRow[];
  skills: TuiSkillRow[];
  selectedAgentId: string | null;
  selectedSkillId: string | null;
  lastScanAt: string | null;
  issueCount: number;
};

export type BuildDashboardModelInput = {
  manifest: Manifest;
  agents: DiscoveredAgent[];
  entries: ScannedSkillEntry[];
  issues: ScanIssue[];
  configuredAgentIds?: string[];
  agentOverrides?: Record<string, AgentOverride>;
  selectedAgentId?: string;
  selectedSkillId?: string;
};

type RowCounts = {
  enabledCount: number;
  disabledCount: number;
  unmanagedCount: number;
  issueCount: number;
};

const emptyCounts = (): RowCounts => ({
  enabledCount: 0,
  disabledCount: 0,
  unmanagedCount: 0,
  issueCount: 0
});

function sortById<T extends { id: string }>(values: T[]): T[] {
  return [...values].sort((left, right) => left.id.localeCompare(right.id));
}

function getSelectedAgentId(
  agents: DiscoveredAgent[],
  requestedAgentId?: string
): string | null {
  if (requestedAgentId !== undefined) {
    const requestedAgent = agents.find((agent) => agent.id === requestedAgentId);

    if (requestedAgent !== undefined) {
      return requestedAgent.id;
    }
  }

  const availableAgent = agents.find(
    (agent) => agent.exists && agent.supportedOnPlatform
  );

  return availableAgent?.id ?? agents[0]?.id ?? null;
}

function findEnabledActivation(
  manifest: Manifest,
  skillId: string,
  agentId: string
) {
  return manifest.activations.find(
    (activation) =>
      activation.skillId === skillId &&
      activation.agentId === agentId &&
      activation.state === "enabled"
  );
}

function findAnyActivation(
  manifest: Manifest,
  skillId: string,
  agentId: string
) {
  return manifest.activations.find(
    (activation) =>
      activation.skillId === skillId && activation.agentId === agentId
  );
}

function buildManagedSkillRow(
  manifest: Manifest,
  skill: ManagedSkill,
  agentId: string
): TuiEnabledSkillRow | TuiDisabledSkillRow {
  const enabledActivation = findEnabledActivation(manifest, skill.id, agentId);

  if (enabledActivation !== undefined) {
    return {
      id: skill.id,
      kind: "enabled",
      marker: "●",
      skillId: skill.id,
      name: skill.name,
      path: skill.path,
      agentId,
      activationLinkPath: enabledActivation.linkPath
    };
  }

  return {
    id: skill.id,
    kind: "disabled",
    marker: "○",
    skillId: skill.id,
    name: skill.name,
    path: skill.path,
    agentId,
    activationLinkPath:
      findAnyActivation(manifest, skill.id, agentId)?.linkPath ?? null
  };
}

function isAdoptableEntry(
  entry: ScannedSkillEntry
): entry is ScannedSkillEntry & {
  kind: "unmanaged-directory" | "unmanaged-link";
} {
  return entry.kind === "unmanaged-directory" || entry.kind === "unmanaged-link";
}

function buildUnmanagedRows(
  entries: ScannedSkillEntry[],
  agentId: string
): TuiUnmanagedSkillRow[] {
  return entries
    .filter((entry) => entry.agentId === agentId)
    .filter(isAdoptableEntry)
    .sort((left, right) =>
      `${left.skillName}:${left.path}`.localeCompare(
        `${right.skillName}:${right.path}`
      )
    )
    .map((entry) => ({
      id: `unmanaged:${entry.skillName}`,
      kind: "unmanaged",
      marker: "?",
      skillName: entry.skillName,
      name: entry.skillName,
      path: entry.path,
      agentId,
      entryKind: entry.kind,
      targetPath: entry.targetPath
    }));
}

function relatedAgentIdsForIssue(
  issue: ScanIssue,
  agents: DiscoveredAgent[]
): string[] {
  if (issue.path === undefined) {
    return [];
  }

  const issuePath = issue.path;

  return agents
    .filter((agent) => isPathInside(agent.absoluteSkillsDirectoryPath, issuePath))
    .map((agent) => agent.id);
}

function buildIssueId(issue: ScanIssue, agentId: string): string {
  return `issue:${agentId}:${issue.code}:${issue.path ?? issue.message}`;
}

function buildIssueRows(
  issues: ScanIssue[],
  agents: DiscoveredAgent[],
  agentId: string
): TuiIssueSkillRow[] {
  return issues
    .filter((issue) => {
      const relatedAgentIds = relatedAgentIdsForIssue(issue, agents);
      return relatedAgentIds.includes(agentId);
    })
    .map((issue) => ({
      id: buildIssueId(issue, agentId),
      kind: "issue",
      marker: "!",
      issueCode: issue.code,
      severity: issue.severity,
      message: issue.message,
      path: issue.path ?? null,
      agentId
    }));
}

function buildSkillRowsForAgent(
  input: BuildDashboardModelInput,
  agentId: string
): TuiSkillRow[] {
  const managedRows = sortById(Object.values(input.manifest.skills)).map((skill) =>
    buildManagedSkillRow(input.manifest, skill, agentId)
  );
  const unmanagedRows = buildUnmanagedRows(input.entries, agentId);
  const issueRows = buildIssueRows(input.issues, input.agents, agentId);

  return [...managedRows, ...unmanagedRows, ...issueRows];
}

function countsForRows(rows: TuiSkillRow[]): RowCounts {
  const counts = emptyCounts();

  for (const row of rows) {
    if (row.kind === "enabled") {
      counts.enabledCount += 1;
    } else if (row.kind === "disabled") {
      counts.disabledCount += 1;
    } else if (row.kind === "unmanaged") {
      counts.unmanagedCount += 1;
    } else {
      counts.issueCount += 1;
    }
  }

  return counts;
}

function countActivationsForAgent(
  manifest: Manifest,
  agentId: string
): number {
  return manifest.activations.filter((activation) => activation.agentId === agentId)
    .length;
}

function hasUserOverride(
  configuredAgentIds: Set<string>,
  agentId: string
): boolean {
  return configuredAgentIds.has(agentId);
}

function buildAgentRows(input: BuildDashboardModelInput): TuiAgentRow[] {
  const configuredAgentIds = new Set(input.configuredAgentIds ?? []);

  return sortById(input.agents).map((agent) => {
    const counts = countsForRows(buildSkillRowsForAgent(input, agent.id));
    const userOverride = hasUserOverride(configuredAgentIds, agent.id);
    const agentOverride = input.agentOverrides?.[agent.id];

    return {
      id: agent.id,
      name: agent.stableName,
      stableName: agent.stableName,
      path: agent.absoluteSkillsDirectoryPath,
      homeRelativeRootPath: agent.homeRelativeRootPath,
      skillsDirectoryPath: agent.skillsDirectoryPath,
      supportedPlatforms: [...agent.supportedPlatforms],
      enabledByDefault: agent.enabledByDefault,
      ...(agentOverride?.stableName === undefined
        ? {}
        : { overrideStableName: agentOverride.stableName }),
      ...(agentOverride?.homeRelativeRootPath === undefined
        ? {}
        : { overrideHomeRelativeRootPath: agentOverride.homeRelativeRootPath }),
      ...(agentOverride?.skillsDirectoryPath === undefined
        ? {}
        : { overrideSkillsDirectoryPath: agentOverride.skillsDirectoryPath }),
      ...(agentOverride?.supportedPlatforms === undefined
        ? {}
        : { overrideSupportedPlatforms: [...agentOverride.supportedPlatforms] }),
      ...(agentOverride?.enabledByDefault === undefined
        ? {}
        : { overrideEnabledByDefault: agentOverride.enabledByDefault }),
      autoDiscovered:
        agentOverride?.autoDiscovered === true ? true : undefined,
      discovery: agent.discovery,
      exists: agent.exists,
      supported: agent.supportedOnPlatform,
      hasUserOverride: userOverride,
      canEditOverride: userOverride,
      canRemoveOverride: userOverride,
      activationCount: countActivationsForAgent(input.manifest, agent.id),
      ...counts
    };
  });
}

export function buildDashboardModel(
  input: BuildDashboardModelInput
): DashboardModel {
  const sortedAgents = sortById(input.agents);
  const selectedAgentId = getSelectedAgentId(
    sortedAgents,
    input.selectedAgentId
  );
  const skills =
    selectedAgentId === null
      ? []
      : buildSkillRowsForAgent({ ...input, agents: sortedAgents }, selectedAgentId);
  const selectedSkillId = skills.some((row) => row.id === input.selectedSkillId)
    ? (input.selectedSkillId as string)
    : skills[0]?.id ?? null;

  return {
    agents: buildAgentRows({ ...input, agents: sortedAgents }),
    skills,
    selectedAgentId,
    selectedSkillId,
    lastScanAt: input.manifest.lastScan.at,
    issueCount: input.issues.length
  };
}
