import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadUserConfig } from "../../src/config/load-user-config";
import { resolveSkillmuxHome } from "../../src/config/resolve-skillmux-home";
import { discoverAgents } from "../../src/discovery/discover-agents";
import {
  cleanupTempHomeDir,
  createTempHomeDir,
  ensureDirectory,
  writeSkillmuxConfig
} from "../helpers/temp-env";

describe("skillmux discovery", () => {
  it("resolves skillmux home and config path from the user home", () => {
    const homeDir = join("relative", "user-home");

    const resolved = resolveSkillmuxHome(homeDir);

    expect(resolved.skillmuxHome).toContain("user-home");
    expect(resolved.skillmuxHome).toBe(
      join(resolve(process.cwd(), homeDir), ".skillmux")
    );
    expect(resolved.configPath).toBe(join(resolved.skillmuxHome, "config.json"));
  });

  it("loads an empty config when the skillmux config is missing", async () => {
    const homeDir = createTempHomeDir();

    try {
      const { skillmuxHome } = resolveSkillmuxHome(homeDir);

      await expect(loadUserConfig(skillmuxHome)).resolves.toEqual({
        version: 1,
        agents: {},
        autoDiscover: { lastRunAt: null, intervalMs: 3600000 },
        removedAutoAgentIds: []
      });
    } finally {
      cleanupTempHomeDir(homeDir);
    }
  });

  it("discovers built-in agents under the user home and merges custom config", async () => {
    const homeDir = createTempHomeDir();

    try {
      ensureDirectory(join(homeDir, ".codex-custom", "custom-skills"));
      ensureDirectory(join(homeDir, ".claude", "skills"));
      ensureDirectory(join(homeDir, ".gemini", "skills"));
      ensureDirectory(join(homeDir, ".agents", "skills"));
      ensureDirectory(join(homeDir, ".openclaw", "skills"));
      ensureDirectory(join(homeDir, ".acme", "plugins"));
      ensureDirectory(join(homeDir, ".constructor-agent", "plugins"));

      writeSkillmuxConfig(homeDir, {
        version: 1,
        agents: {
          codex: {
            homeRelativeRootPath: ".codex-custom",
            skillsDirectoryPath: "custom-skills",
            enabledByDefault: false
          },
          acme: {
            stableName: "Acme Agent",
            supportedPlatforms: ["win32"],
            homeRelativeRootPath: ".acme",
            skillsDirectoryPath: "plugins",
            enabledByDefault: true
          },
          constructor: {
            stableName: "Constructor Agent",
            supportedPlatforms: ["win32"],
            homeRelativeRootPath: ".constructor-agent",
            skillsDirectoryPath: "plugins",
            enabledByDefault: true
          }
        }
      });

      const agents = await discoverAgents({
        homeDir,
        platform: "win32"
      });

      expect(agents.map((agent) => agent.id)).toEqual([
        "codex",
        "claude",
        "gemini",
        "agents",
        "openclaw",
        "acme",
        "constructor"
      ]);

      expect(
        agents
          .filter((agent) =>
            ["claude", "gemini", "agents", "openclaw"].includes(agent.id)
          )
          .map((agent) => ({
            id: agent.id,
            discovery: agent.discovery,
            absoluteRootPath: agent.absoluteRootPath,
            absoluteSkillsDirectoryPath: agent.absoluteSkillsDirectoryPath,
            exists: agent.exists,
            supportedOnPlatform: agent.supportedOnPlatform
          }))
      ).toEqual([
        {
          id: "claude",
          discovery: "builtin",
          absoluteRootPath: join(homeDir, ".claude"),
          absoluteSkillsDirectoryPath: join(homeDir, ".claude", "skills"),
          exists: true,
          supportedOnPlatform: true
        },
        {
          id: "gemini",
          discovery: "builtin",
          absoluteRootPath: join(homeDir, ".gemini"),
          absoluteSkillsDirectoryPath: join(homeDir, ".gemini", "skills"),
          exists: true,
          supportedOnPlatform: true
        },
        {
          id: "agents",
          discovery: "builtin",
          absoluteRootPath: join(homeDir, ".agents"),
          absoluteSkillsDirectoryPath: join(homeDir, ".agents", "skills"),
          exists: true,
          supportedOnPlatform: true
        },
        {
          id: "openclaw",
          discovery: "builtin",
          absoluteRootPath: join(homeDir, ".openclaw"),
          absoluteSkillsDirectoryPath: join(homeDir, ".openclaw", "skills"),
          exists: true,
          supportedOnPlatform: true
        }
      ]);

      expect(agents.find((agent) => agent.id === "codex")).toMatchObject({
        discovery: "builtin",
        stableName: "OpenAI Codex",
        homeRelativeRootPath: ".codex-custom",
        skillsDirectoryPath: "custom-skills",
        enabledByDefault: false,
        absoluteRootPath: join(homeDir, ".codex-custom"),
        absoluteSkillsDirectoryPath: join(
          homeDir,
          ".codex-custom",
          "custom-skills"
        ),
        exists: true,
        supportedOnPlatform: true
      });

      expect(agents.find((agent) => agent.id === "claude")).toMatchObject({
        discovery: "builtin",
        stableName: "Claude Code",
        absoluteRootPath: join(homeDir, ".claude"),
        absoluteSkillsDirectoryPath: join(homeDir, ".claude", "skills"),
        exists: true,
        supportedOnPlatform: true
      });

      expect(agents.find((agent) => agent.id === "acme")).toMatchObject({
        discovery: "custom",
        stableName: "Acme Agent",
        absoluteRootPath: join(homeDir, ".acme"),
        absoluteSkillsDirectoryPath: join(homeDir, ".acme", "plugins"),
        exists: true,
        supportedOnPlatform: true
      });

      expect(agents.find((agent) => agent.id === "constructor")).toMatchObject({
        discovery: "custom",
        stableName: "Constructor Agent",
        absoluteRootPath: join(homeDir, ".constructor-agent"),
        absoluteSkillsDirectoryPath: join(
          homeDir,
          ".constructor-agent",
          "plugins"
        ),
        exists: true,
        supportedOnPlatform: true
      });
    } finally {
      cleanupTempHomeDir(homeDir);
    }
  });

  it("discovers auto-registered agents from unknown dot directories", async () => {
    const homeDir = createTempHomeDir();
    try {
      ensureDirectory(join(homeDir, ".autofound", "skills"));
      ensureDirectory(join(homeDir, ".claude", "skills"));
      ensureDirectory(join(homeDir, ".gemini", "skills"));
      ensureDirectory(join(homeDir, ".agents", "skills"));
      ensureDirectory(join(homeDir, ".openclaw", "skills"));

      writeSkillmuxConfig(homeDir, {
        version: 1,
        agents: {},
        autoDiscover: { lastRunAt: null, intervalMs: 0 },
        removedAutoAgentIds: []
      });

      const agents = await discoverAgents({
        homeDir,
        platform: "win32"
      });

      const autoAgent = agents.find((a) => a.id === "autofound");
      expect(autoAgent).toBeDefined();
      expect(autoAgent?.discovery).toBe("custom");
      expect(autoAgent?.autoDiscovered).toBe(true);
      expect(autoAgent?.homeRelativeRootPath).toBe(".autofound");
      expect(autoAgent?.skillsDirectoryPath).toBe("skills");
      expect(autoAgent?.exists).toBe(true);
      expect(autoAgent?.supportedOnPlatform).toBe(true);
    } finally {
      cleanupTempHomeDir(homeDir);
    }
  });
});
