import { printJson } from "../output/print-json";
import { printTable } from "../output/print-table";
import { runScan, type RunScanOptions, type RunScanResult } from "./scan";

export type ListView = "records" | "agents" | "skills";
export type ListFormat = "table" | "json";

export type RunListOptions = Omit<RunScanOptions, "json"> & {
  view?: ListView;
  format?: ListFormat;
};

export type RunListResult = {
  output: string;
  data: unknown;
};

function buildRecordsView(scanResult: RunScanResult) {
  return {
    view: "records" as const,
    records: scanResult.entries,
    issues: scanResult.issues
  };
}

function buildAgentsView(scanResult: RunScanResult) {
  const groups = new Map<
    string,
    {
      agentId: string;
      agentName: string;
      entries: RunScanResult["entries"];
    }
  >();

  for (const entry of scanResult.entries) {
    const current = groups.get(entry.agentId) ?? {
      agentId: entry.agentId,
      agentName: entry.agentName,
      entries: []
    };
    current.entries.push(entry);
    groups.set(entry.agentId, current);
  }

  return {
    view: "agents" as const,
    agents: [...groups.values()].sort((left, right) =>
      left.agentId.localeCompare(right.agentId)
    ),
    issues: scanResult.issues
  };
}

function buildSkillsView(scanResult: RunScanResult) {
  const groups = new Map<
    string,
    {
      skillName: string;
      entries: RunScanResult["entries"];
    }
  >();

  for (const entry of scanResult.entries) {
    const current = groups.get(entry.skillName) ?? {
      skillName: entry.skillName,
      entries: []
    };
    current.entries.push(entry);
    groups.set(entry.skillName, current);
  }

  return {
    view: "skills" as const,
    skills: [...groups.values()].sort((left, right) =>
      left.skillName.localeCompare(right.skillName)
    ),
    issues: scanResult.issues
  };
}

function buildListData(scanResult: RunScanResult, view: ListView): unknown {
  if (view === "agents") {
    return buildAgentsView(scanResult);
  }

  if (view === "skills") {
    return buildSkillsView(scanResult);
  }

  return buildRecordsView(scanResult);
}

function buildTableOutput(data: unknown, view: ListView): string {
  if (view === "agents") {
    const agentRows = (data as { agents: Array<{ agentId: string; agentName: string; entries: unknown[] }> }).agents;
    return printTable(
      agentRows.map((agent) => ({
        agent: agent.agentId,
        name: agent.agentName,
        entries: String(agent.entries.length)
      })),
      [
        { key: "agent", label: "Agent" },
        { key: "name", label: "Name" },
        { key: "entries", label: "Entries" }
      ]
    );
  }

  if (view === "skills") {
    const skillRows = (data as { skills: Array<{ skillName: string; entries: unknown[] }> }).skills;
    return printTable(
      skillRows.map((skill) => ({
        skill: skill.skillName,
        entries: String(skill.entries.length)
      })),
      [
        { key: "skill", label: "Skill" },
        { key: "entries", label: "Entries" }
      ]
    );
  }

  const records = (data as { records: Array<{ agentId: string; skillName: string; kind: string }> }).records;
  return printTable(
    records.map((record) => ({
      agent: record.agentId,
      skill: record.skillName,
      kind: record.kind
    })),
    [
      { key: "agent", label: "Agent" },
      { key: "skill", label: "Skill" },
      { key: "kind", label: "Kind" }
    ]
  );
}

export async function runList(options: RunListOptions = {}): Promise<RunListResult> {
  const view = options.view ?? "records";
  const format = options.format ?? "table";
  const scanResult = await runScan(options);
  const data = buildListData(scanResult, view);

  return {
    data,
    output: format === "json" ? printJson(data) : buildTableOutput(data, view)
  };
}
