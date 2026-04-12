import { describe, expect, it } from "vitest";
import { buildEmptyManifest } from "../../src/manifest/build-empty-manifest";
import { manifestSchema } from "../../src/manifest/manifest-schema";

describe("manifestSchema", () => {
  it("accepts an empty manifest built for a skillmux home", () => {
    const skillmuxHome = "C:/skillmux";
    const manifest = buildEmptyManifest(skillmuxHome);

    expect(manifestSchema.parse(manifest)).toEqual({
      version: 1,
      skillmuxHome,
      skills: {},
      agents: {},
      activations: [],
      lastScan: {
        at: null,
        issues: [],
      },
    });
  });

  it("rejects non-canonical ids in records and activation references", () => {
    const manifest = buildEmptyManifest("C:/skillmux");

    manifest.skills["Skill One"] = {
      id: "Skill One",
      name: "Skill One",
      path: "C:/skillmux/store/skill-one",
      source: {
        kind: "imported",
        path: "C:/imports/skill-one",
      },
      importedAt: "2026-04-12T00:00:00.000Z",
    };

    manifest.agents["Claude Desktop"] = {
      id: "Claude Desktop",
      name: "Claude Desktop",
      path: "C:/Users/example/.claude/skills",
      discovery: "builtin",
      available: true,
      lastSeenAt: "2026-04-12T00:00:00.000Z",
    };

    manifest.activations.push({
      skillId: "Skill One",
      agentId: "Claude Desktop",
      linkPath: "C:/Users/example/.claude/skills/skill-one",
      state: "enabled",
      updatedAt: "2026-04-12T00:00:00.000Z",
    });

    expect(() => manifestSchema.parse(manifest)).toThrow();
  });

  it("rejects records whose object ids do not match their manifest keys", () => {
    const manifest = buildEmptyManifest("C:/skillmux");

    manifest.skills["skill-one"] = {
      id: "skill-two",
      name: "Skill One",
      path: "C:/skillmux/store/skill-one",
      source: {
        kind: "imported",
        path: "C:/imports/skill-one",
      },
      importedAt: "2026-04-12T00:00:00.000Z",
    };

    manifest.agents["claude-desktop"] = {
      id: "openai-codex",
      name: "Claude Desktop",
      path: "C:/Users/example/.claude/skills",
      discovery: "builtin",
      available: true,
      lastSeenAt: "2026-04-12T00:00:00.000Z",
    };

    expect(() => manifestSchema.parse(manifest)).toThrow();
  });

  it("rejects activations that reference missing skills or agents", () => {
    const manifest = buildEmptyManifest("C:/skillmux");

    manifest.skills["skill-one"] = {
      id: "skill-one",
      name: "Skill One",
      path: "C:/skillmux/store/skill-one",
      source: {
        kind: "imported",
        path: "C:/imports/skill-one",
      },
      importedAt: "2026-04-12T00:00:00.000Z",
    };

    manifest.agents["claude-desktop"] = {
      id: "claude-desktop",
      name: "Claude Desktop",
      path: "C:/Users/example/.claude/skills",
      discovery: "builtin",
      available: true,
      lastSeenAt: "2026-04-12T00:00:00.000Z",
    };

    manifest.activations.push({
      skillId: "missing-skill",
      agentId: "claude-desktop",
      linkPath: "C:/Users/example/.claude/skills/skill-one",
      state: "enabled",
      updatedAt: "2026-04-12T00:00:00.000Z",
    });

    expect(() => manifestSchema.parse(manifest)).toThrow();
  });

  it("rejects duplicate activations for the same skill and agent", () => {
    const manifest = buildEmptyManifest("C:/skillmux");

    manifest.skills["skill-one"] = {
      id: "skill-one",
      name: "Skill One",
      path: "C:/skillmux/store/skill-one",
      source: {
        kind: "imported",
        path: "C:/imports/skill-one",
      },
      importedAt: "2026-04-12T00:00:00.000Z",
    };

    manifest.agents["claude-desktop"] = {
      id: "claude-desktop",
      name: "Claude Desktop",
      path: "C:/Users/example/.claude/skills",
      discovery: "builtin",
      available: true,
      lastSeenAt: "2026-04-12T00:00:00.000Z",
    };

    manifest.activations.push({
      skillId: "skill-one",
      agentId: "claude-desktop",
      linkPath: "C:/Users/example/.claude/skills/skill-one",
      state: "enabled",
      updatedAt: "2026-04-12T00:00:00.000Z",
    });

    manifest.activations.push({
      skillId: "skill-one",
      agentId: "claude-desktop",
      linkPath: "C:/Users/example/.claude/skills/skill-one-copy",
      state: "disabled",
      updatedAt: "2026-04-12T00:01:00.000Z",
    });

    expect(() => manifestSchema.parse(manifest)).toThrow();
  });
});
