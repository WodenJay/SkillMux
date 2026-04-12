export type Manifest = {
  version: 1;
  skillmuxHome: string;
  skills: Record<string, ManagedSkill>;
  agents: Record<string, AgentRecord>;
  activations: ActivationRecord[];
  lastScan: {
    at: string | null;
    issues: ScanIssue[];
  };
};

export type ManagedSkill = {
  id: string;
  name: string;
  path: string;
  source: {
    kind: "local" | "imported";
    path: string;
  };
  importedAt: string;
};

export type AgentRecord = {
  id: string;
  name: string;
  path: string;
  discovery: "builtin" | "custom";
  available: boolean;
  lastSeenAt: string | null;
};

export type ActivationRecord = {
  skillId: string;
  agentId: string;
  linkPath: string;
  state: "enabled" | "disabled";
  updatedAt: string;
};

export type ScanIssue = {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
  path?: string;
};
