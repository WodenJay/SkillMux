import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Manifest, ScanIssue } from "../../src/core/types";
import type { DiscoveredAgent } from "../../src/discovery/discover-agents";
import type { ScannedSkillEntry } from "../../src/discovery/infer-skill-entry";
import { buildDashboardModel } from "../../src/tui/dashboard-model";

function createManifest(root: string): Manifest {
  return {
    version: 1,
    skillmuxHome: join(root, ".skillmux"),
    skills: {
      "find-skills": {
        id: "find-skills",
        name: "Find Skills",
        path: join(root, ".skillmux", "skills", "find-skills"),
        source: {
          kind: "local",
          path: join(root, "sources", "find-skills")
        },
        importedAt: "2026-04-16T10:00:00.000Z"
      },
      "tui-design": {
        id: "tui-design",
        name: "TUI Design",
        path: join(root, ".skillmux", "skills", "tui-design"),
        source: {
          kind: "local",
          path: join(root, "sources", "tui-design")
        },
        importedAt: "2026-04-16T10:01:00.000Z"
      }
    },
    agents: {},
    activations: [
      {
        skillId: "find-skills",
        agentId: "codex",
        linkPath: join(root, ".codex", "skills", "find-skills"),
        state: "enabled",
        updatedAt: "2026-04-16T10:02:00.000Z"
      },
      {
        skillId: "tui-design",
        agentId: "codex",
        linkPath: join(root, ".codex", "skills", "tui-design"),
        state: "disabled",
        updatedAt: "2026-04-16T10:03:00.000Z"
      }
    ],
    lastScan: {
      at: "2026-04-16T10:04:00.000Z",
      issues: []
    }
  };
}

function createAgent(
  root: string,
  id: string,
  overrides?: Partial<DiscoveredAgent>
): DiscoveredAgent {
  return {
    id,
    stableName: id === "codex" ? "OpenAI Codex" : "Claude Code",
    supportedPlatforms: ["win32", "linux", "darwin"],
    homeRelativeRootPath: `.${id}`,
    skillsDirectoryPath: "skills",
    enabledByDefault: true,
    discovery: "builtin",
    absoluteRootPath: join(root, `.${id}`),
    absoluteSkillsDirectoryPath: join(root, `.${id}`, "skills"),
    exists: true,
    supportedOnPlatform: true,
    ...overrides
  };
}

describe("buildDashboardModel", () => {
  it("builds enabled, disabled, unmanaged, and issue rows with stable markers", () => {
    const root = join("C:", "tmp", "skillmux-dashboard");
    const agents = [
      createAgent(root, "codex"),
      createAgent(root, "claude"),
      createAgent(root, "openclaw", {
        discovery: "custom"
      })
    ];
    const entries: ScannedSkillEntry[] = [
      {
        agentId: "codex",
        agentName: "OpenAI Codex",
        skillName: "local-draft",
        kind: "unmanaged-directory",
        path: join(root, ".codex", "skills", "local-draft")
      },
      {
        agentId: "codex",
        agentName: "OpenAI Codex",
        skillName: "find-skills",
        kind: "managed-link",
        path: join(root, ".codex", "skills", "find-skills"),
        targetPath: join(root, ".skillmux", "skills", "find-skills")
      }
    ];
    const issues: ScanIssue[] = [
      {
        code: "unknown-entry",
        severity: "warning",
        message: "Skill entry is neither a managed link nor a directory",
        path: join(root, ".codex", "skills", "notes.txt")
      },
      {
        code: "global-warning",
        severity: "warning",
        message: "Global warning without agent path"
      }
    ];

    const model = buildDashboardModel({
      manifest: createManifest(root),
      agents,
      entries,
      issues,
      selectedAgentId: "codex",
      selectedSkillId: "tui-design",
      configuredAgentIds: ["codex", "openclaw"]
    });

    expect(model.selectedAgentId).toBe("codex");
    expect(model.selectedSkillId).toBe("tui-design");
    expect(model.issueCount).toBe(2);
    expect(model.skills).toEqual([
      expect.objectContaining({
        id: "find-skills",
        kind: "enabled",
        marker: "●",
        skillId: "find-skills"
      }),
      expect.objectContaining({
        id: "tui-design",
        kind: "disabled",
        marker: "○",
        skillId: "tui-design"
      }),
      expect.objectContaining({
        id: "unmanaged:local-draft",
        kind: "unmanaged",
        marker: "?",
        skillName: "local-draft"
      }),
      expect.objectContaining({
        kind: "issue",
        marker: "!",
        issueCode: "unknown-entry"
      })
    ]);
    expect(model.agents.find((agent) => agent.id === "codex")).toMatchObject({
      enabledCount: 1,
      disabledCount: 1,
      unmanagedCount: 1,
      issueCount: 1,
      hasUserOverride: true,
      canEditOverride: true,
      canRemoveOverride: true
    });
    expect(model.agents.find((agent) => agent.id === "claude")).toMatchObject({
      hasUserOverride: false,
      canEditOverride: false,
      canRemoveOverride: false
    });
    expect(model.agents.find((agent) => agent.id === "openclaw")).toMatchObject({
      discovery: "custom",
      hasUserOverride: true,
      canEditOverride: true,
      canRemoveOverride: true
    });
  });

  it("defaults selection and drops ambiguous issue rows from the selected agent list", () => {
    const root = join("C:", "tmp", "skillmux-dashboard");
    const agents = [
      createAgent(root, "claude", { exists: false }),
      createAgent(root, "codex")
    ];

    const model = buildDashboardModel({
      manifest: createManifest(root),
      agents,
      entries: [],
      issues: [
        {
          code: "ambiguous",
          severity: "warning",
          message: "No path to relate to an agent"
        }
      ],
      selectedAgentId: "missing-agent",
      selectedSkillId: "missing-skill"
    });

    expect(model.agents.map((agent) => agent.id)).toEqual(["claude", "codex"]);
    expect(model.selectedAgentId).toBe("codex");
    expect(model.selectedSkillId).toBe("find-skills");
    expect(model.issueCount).toBe(1);
    expect(model.skills.map((row) => row.kind)).toEqual(["enabled", "disabled"]);
  });

  it("attaches path issues to every related agent when skills directories overlap", () => {
    const root = join("C:", "tmp", "skillmux-dashboard");
    const sharedSkillsPath = join(root, ".codex", "skills");
    const agents = [
      createAgent(root, "codex", {
        absoluteSkillsDirectoryPath: sharedSkillsPath
      }),
      createAgent(root, "claude", {
        absoluteSkillsDirectoryPath: sharedSkillsPath
      })
    ];

    const model = buildDashboardModel({
      manifest: createManifest(root),
      agents,
      entries: [],
      issues: [
        {
          code: "conflicting-agent-path",
          severity: "warning",
          message:
            "Multiple agents resolve to the same skills directory: claude, codex",
          path: sharedSkillsPath
        }
      ],
      selectedAgentId: "claude"
    });

    expect(model.issueCount).toBe(1);
    expect(model.agents.find((agent) => agent.id === "claude")).toMatchObject({
      issueCount: 1
    });
    expect(model.agents.find((agent) => agent.id === "codex")).toMatchObject({
      issueCount: 1
    });
    expect(model.skills).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `issue:claude:conflicting-agent-path:${sharedSkillsPath}`,
          kind: "issue",
          issueCode: "conflicting-agent-path"
        })
      ])
    );
  });
});
