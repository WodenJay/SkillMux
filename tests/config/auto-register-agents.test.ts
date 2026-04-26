import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { autoRegisterNewAgents } from "../../src/config/auto-register-agents";
import { resolveSkillmuxHome } from "../../src/config/resolve-skillmux-home";
import { loadUserConfig } from "../../src/config/load-user-config";

function tempHome(): string {
  const dir = mkdtempSync(join(tmpdir(), "skillmux-auto-"));
  return dir;
}

function cleanup(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

function writeConfig(dir: string, config: unknown): void {
  const { configPath, skillmuxHome } = resolveSkillmuxHome(dir);
  mkdirSync(skillmuxHome, { recursive: true });
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
}

describe("autoRegisterNewAgents", () => {
  it("registers an unknown .xxx dir with skills/ subdirectory", async () => {
    const homeDir = tempHome();
    try {
      mkdirSync(join(homeDir, ".myagent", "skills"), { recursive: true });

      writeConfig(homeDir, {
        version: 1,
        agents: {},
        autoDiscover: { lastRunAt: null, intervalMs: 3600000 },
        removedAutoAgentIds: []
      });

      await autoRegisterNewAgents(homeDir);

      const config = await loadUserConfig(resolveSkillmuxHome(homeDir).skillmuxHome);

      expect(config.agents).toHaveProperty("myagent");
      expect(config.agents.myagent).toMatchObject({
        homeRelativeRootPath: ".myagent",
        skillsDirectoryPath: "skills",
        enabledByDefault: true,
        autoDiscovered: true
      });
      expect(config.autoDiscover?.lastRunAt).not.toBeNull();
    } finally {
      cleanup(homeDir);
    }
  });

  it("skips already-registered agents", async () => {
    const homeDir = tempHome();
    try {
      mkdirSync(join(homeDir, ".myagent", "skills"), { recursive: true });

      writeConfig(homeDir, {
        version: 1,
        agents: {
          myagent: {
            homeRelativeRootPath: ".myagent",
            skillsDirectoryPath: "skills",
            enabledByDefault: true
          }
        },
        autoDiscover: { lastRunAt: null, intervalMs: 3600000 },
        removedAutoAgentIds: []
      });

      await autoRegisterNewAgents(homeDir);

      const config = await loadUserConfig(resolveSkillmuxHome(homeDir).skillmuxHome);

      expect(config.agents.myagent).not.toHaveProperty("autoDiscovered");
    } finally {
      cleanup(homeDir);
    }
  });

  it("skips agents in removedAutoAgentIds", async () => {
    const homeDir = tempHome();
    try {
      mkdirSync(join(homeDir, ".myagent", "skills"), { recursive: true });

      writeConfig(homeDir, {
        version: 1,
        agents: {},
        autoDiscover: { lastRunAt: null, intervalMs: 3600000 },
        removedAutoAgentIds: ["myagent"]
      });

      await autoRegisterNewAgents(homeDir);

      const config = await loadUserConfig(resolveSkillmuxHome(homeDir).skillmuxHome);

      expect(config.agents).not.toHaveProperty("myagent");
    } finally {
      cleanup(homeDir);
    }
  });

  it("skips built-in agent directories that match known IDs", async () => {
    const homeDir = tempHome();
    try {
      mkdirSync(join(homeDir, ".codex", "skills"), { recursive: true });

      writeConfig(homeDir, {
        version: 1,
        agents: {},
        autoDiscover: { lastRunAt: null, intervalMs: 3600000 },
        removedAutoAgentIds: []
      });

      await autoRegisterNewAgents(homeDir);

      const config = await loadUserConfig(resolveSkillmuxHome(homeDir).skillmuxHome);

      expect(config.agents).not.toHaveProperty("codex");
    } finally {
      cleanup(homeDir);
    }
  });

  it("respects the cache interval and does not re-scan too soon", async () => {
    const homeDir = tempHome();
    try {
      const recentTimestamp = new Date().toISOString();
      writeConfig(homeDir, {
        version: 1,
        agents: {},
        autoDiscover: { lastRunAt: recentTimestamp, intervalMs: 3600000 },
        removedAutoAgentIds: []
      });

      mkdirSync(join(homeDir, ".lateragent", "skills"), { recursive: true });

      await autoRegisterNewAgents(homeDir);

      const config = await loadUserConfig(resolveSkillmuxHome(homeDir).skillmuxHome);

      expect(config.agents).not.toHaveProperty("lateragent");
      expect(config.autoDiscover?.lastRunAt).toBe(recentTimestamp);
    } finally {
      cleanup(homeDir);
    }
  });

  it("scans again when intervalMs is set to 0 (always scan)", async () => {
    const homeDir = tempHome();
    try {
      const recentTimestamp = new Date().toISOString();
      writeConfig(homeDir, {
        version: 1,
        agents: {},
        autoDiscover: { lastRunAt: recentTimestamp, intervalMs: 0 },
        removedAutoAgentIds: []
      });

      mkdirSync(join(homeDir, ".alwaysagent", "skills"), { recursive: true });

      await autoRegisterNewAgents(homeDir);

      const config = await loadUserConfig(resolveSkillmuxHome(homeDir).skillmuxHome);

      expect(config.agents).toHaveProperty("alwaysagent");
      expect(config.autoDiscover?.lastRunAt).not.toBe(recentTimestamp);
    } finally {
      cleanup(homeDir);
    }
  });

  it("skips directories without skills/ subdirectory", async () => {
    const homeDir = tempHome();
    try {
      mkdirSync(join(homeDir, ".emptyagent"), { recursive: true });

      writeConfig(homeDir, {
        version: 1,
        agents: {},
        autoDiscover: { lastRunAt: null, intervalMs: 3600000 },
        removedAutoAgentIds: []
      });

      await autoRegisterNewAgents(homeDir);

      const config = await loadUserConfig(resolveSkillmuxHome(homeDir).skillmuxHome);

      expect(config.agents).not.toHaveProperty("emptyagent");
    } finally {
      cleanup(homeDir);
    }
  });

  it("skips .skillmux directory even though it has skills/", async () => {
    const homeDir = tempHome();
    try {
      mkdirSync(join(homeDir, ".myagent", "skills"), { recursive: true });
      mkdirSync(join(homeDir, ".skillmux", "skills"), { recursive: true });

      writeConfig(homeDir, {
        version: 1,
        agents: {},
        autoDiscover: { lastRunAt: null, intervalMs: 3600000 },
        removedAutoAgentIds: []
      });

      await autoRegisterNewAgents(homeDir);

      const config = await loadUserConfig(resolveSkillmuxHome(homeDir).skillmuxHome);

      expect(config.agents).toHaveProperty("myagent");
      expect(config.agents).not.toHaveProperty("skillmux");
    } finally {
      cleanup(homeDir);
    }
  });

  it("skips non-dot-prefixed directories", async () => {
    const homeDir = tempHome();
    try {
      mkdirSync(join(homeDir, "normal-folder", "skills"), { recursive: true });

      writeConfig(homeDir, {
        version: 1,
        agents: {},
        autoDiscover: { lastRunAt: null, intervalMs: 3600000 },
        removedAutoAgentIds: []
      });

      await autoRegisterNewAgents(homeDir);

      const config = await loadUserConfig(resolveSkillmuxHome(homeDir).skillmuxHome);

      expect(config.agents).not.toHaveProperty("normal-folder");
    } finally {
      cleanup(homeDir);
    }
  });
});
