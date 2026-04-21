import { join } from "node:path";
import { writeManifest } from "../../src/manifest/write-manifest";
import type { ActivationRecord, AgentRecord, Manifest, ManagedSkill } from "../../src/core/types";
import { createSandbox } from "./sandbox";

export type ScenarioFixtureInput = {
  agents: string[];
  managedEnabled?: Array<{ agentId: string; skillName: string }>;
  managedDisabled?: Array<{ agentId: string; skillName: string }>;
  unmanaged?: Array<{ agentId: string; skillName: string }>;
};

export type ScenarioFixture = {
  homeDir: string;
  skillmuxHome: string;
  cleanup(): void;
};

export async function createScenarioFixture(
  input: ScenarioFixtureInput
): Promise<ScenarioFixture> {
  validateScenarioFixtureInput(input);

  const sandbox = await createSandbox();
  const timestamp = "2026-04-21T00:00:00.000Z";
  const managedSkillNames = collectManagedSkillNames(input);

  for (const agentId of input.agents) {
    await sandbox.ensureAgentSkillsDir(agentId);
  }

  for (const skillName of managedSkillNames) {
    await sandbox.writeManagedSkill(skillName);
  }

  for (const item of input.managedEnabled ?? []) {
    await sandbox.enableManagedSkill(item.agentId, item.skillName);
  }

  for (const item of input.unmanaged ?? []) {
    await sandbox.writeUnmanagedSkill(item.agentId, item.skillName);
  }

  const manifest = buildManifest({
    sandbox,
    input,
    managedSkillNames,
    timestamp
  });

  await writeManifest(sandbox.skillmuxHome, manifest);

  return {
    homeDir: sandbox.homeDir,
    skillmuxHome: sandbox.skillmuxHome,
    cleanup: sandbox.cleanup
  };
}

function validateScenarioFixtureInput(input: ScenarioFixtureInput): void {
  const declaredAgents = new Set(input.agents);

  if (declaredAgents.size !== input.agents.length) {
    throw new Error("Scenario fixture has duplicate agent ids");
  }

  const seenActivationPairs = new Map<string, "enabled" | "disabled" | "unmanaged">();

  for (const item of input.managedEnabled ?? []) {
    assertDeclaredAgent(item.agentId, declaredAgents);
    trackPair(seenActivationPairs, item.agentId, item.skillName, "enabled");
  }

  for (const item of input.managedDisabled ?? []) {
    assertDeclaredAgent(item.agentId, declaredAgents);
    trackPair(seenActivationPairs, item.agentId, item.skillName, "disabled");
  }

  for (const item of input.unmanaged ?? []) {
    assertDeclaredAgent(item.agentId, declaredAgents);
    trackPair(seenActivationPairs, item.agentId, item.skillName, "unmanaged");
  }
}

function assertDeclaredAgent(agentId: string, declaredAgents: Set<string>): void {
  if (!declaredAgents.has(agentId)) {
    throw new Error(`Scenario fixture references agent "${agentId}" not declared in agents`);
  }
}

function trackPair(
  seenActivationPairs: Map<string, "enabled" | "disabled" | "unmanaged">,
  agentId: string,
  skillName: string,
  kind: "enabled" | "disabled" | "unmanaged"
): void {
  const key = `${agentId}:${skillName}`;
  const previousKind = seenActivationPairs.get(key);

  if (previousKind !== undefined) {
    if (previousKind !== kind) {
      throw new Error(
        `Scenario fixture has conflicting activation declarations for ${key}`
      );
    }

    throw new Error(`Scenario fixture has duplicate declaration for ${key}`);
  }

  seenActivationPairs.set(key, kind);
}

function collectManagedSkillNames(input: ScenarioFixtureInput): Set<string> {
  const managedSkillNames = new Set<string>();

  for (const item of input.managedEnabled ?? []) {
    managedSkillNames.add(item.skillName);
  }

  for (const item of input.managedDisabled ?? []) {
    managedSkillNames.add(item.skillName);
  }

  return managedSkillNames;
}

function buildManifest({
  sandbox,
  input,
  managedSkillNames,
  timestamp
}: {
  sandbox: Awaited<ReturnType<typeof createSandbox>>;
  input: ScenarioFixtureInput;
  managedSkillNames: Set<string>;
  timestamp: string;
}): Manifest {
  const skills: Record<string, ManagedSkill> = Object.fromEntries(
    [...managedSkillNames].map((skillName) => {
      const path = join(sandbox.skillmuxHome, "skills", skillName);
      const record: ManagedSkill = {
        id: skillName,
        name: skillName,
        path,
        source: {
          kind: "local",
          path
        },
        importedAt: timestamp
      };

      return [skillName, record] as const;
    })
  );

  const agents: Record<string, AgentRecord> = Object.fromEntries(
    input.agents.map((agentId) => {
      const path = join(sandbox.homeDir, `.${agentId}`);
      const record: AgentRecord = {
        id: agentId,
        name: agentId,
        path,
        discovery: "builtin",
        available: true,
        lastSeenAt: timestamp
      };

      return [agentId, record] as const;
    })
  );

  const activations: ActivationRecord[] = [
    ...(input.managedEnabled ?? []).map((item) =>
      buildActivationRecord(item, "enabled", sandbox.homeDir, timestamp)
    ),
    ...(input.managedDisabled ?? []).map((item) =>
      buildActivationRecord(item, "disabled", sandbox.homeDir, timestamp)
    )
  ];

  return {
    version: 1,
    skillmuxHome: sandbox.skillmuxHome,
    skills,
    agents,
    activations,
    lastScan: {
      at: null,
      issues: []
    }
  };
}

function buildActivationRecord(
  item: { agentId: string; skillName: string },
  state: "enabled" | "disabled",
  homeDir: string,
  timestamp: string
): ActivationRecord {
  return {
    skillId: item.skillName,
    agentId: item.agentId,
    linkPath: join(homeDir, `.${item.agentId}`, "skills", item.skillName),
    state,
    updatedAt: timestamp
  };
}
