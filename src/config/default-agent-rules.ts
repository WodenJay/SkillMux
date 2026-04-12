export const supportedPlatforms = ["win32", "linux", "darwin"] as const;

export type SupportedPlatform = (typeof supportedPlatforms)[number];

export const builtInAgentIds = [
  "codex",
  "claude",
  "gemini",
  "agents",
  "openclaw"
] as const;

export type BuiltInAgentId = (typeof builtInAgentIds)[number];

export type AgentRule = {
  id: string;
  stableName: string;
  supportedPlatforms: SupportedPlatform[];
  homeRelativeRootPath: string;
  skillsDirectoryPath: string;
  enabledByDefault: boolean;
  discovery: "builtin" | "custom";
};

export const defaultAgentRules: AgentRule[] = [
  {
    id: "codex",
    stableName: "OpenAI Codex",
    supportedPlatforms: [...supportedPlatforms],
    homeRelativeRootPath: ".codex",
    skillsDirectoryPath: "skills",
    enabledByDefault: true,
    discovery: "builtin"
  },
  {
    id: "claude",
    stableName: "Claude Code",
    supportedPlatforms: [...supportedPlatforms],
    homeRelativeRootPath: ".claude",
    skillsDirectoryPath: "skills",
    enabledByDefault: true,
    discovery: "builtin"
  },
  {
    id: "gemini",
    stableName: "Gemini CLI",
    supportedPlatforms: [...supportedPlatforms],
    homeRelativeRootPath: ".gemini",
    skillsDirectoryPath: "skills",
    enabledByDefault: true,
    discovery: "builtin"
  },
  {
    id: "agents",
    stableName: "Agents",
    supportedPlatforms: [...supportedPlatforms],
    homeRelativeRootPath: ".agents",
    skillsDirectoryPath: "skills",
    enabledByDefault: true,
    discovery: "builtin"
  },
  {
    id: "openclaw",
    stableName: "OpenClaw",
    supportedPlatforms: [...supportedPlatforms],
    homeRelativeRootPath: ".openclaw",
    skillsDirectoryPath: "skills",
    enabledByDefault: true,
    discovery: "builtin"
  }
];

export const defaultAgentRuleMap = Object.fromEntries(
  defaultAgentRules.map((rule) => [rule.id, rule])
) as Record<BuiltInAgentId, AgentRule>;
