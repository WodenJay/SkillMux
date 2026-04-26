# SkillMux Auto-Discover Agent Design

## Problem

Currently `discoverAgents()` is driven entirely by a static list of five built-in agent IDs (claude, codex, gemini, agents, openclaw) plus manually configured custom agents. There is no filesystem scanning. If a user has an agent directory like `~/.myagent/skills` that is not in the built-in list and has not been manually `config add-agent`ed, SkillMux is blind to it.

The user wants: SkillMux to automatically scan `os.homedir()` for folders matching `.*/skills` (dot-prefixed directories containing a `skills` subdirectory), and auto-register any unknown ones into `config.json` without manual intervention.

## Design

### Data Flow

```
autoRegisterNewAgents()  ←  called by discoverAgents() before building return value
  ├─ cache check: skip if lastRunAt + intervalMs > now
  ├─ scan homeDir level-1 for ".xxx" dirs containing "skills" subdir
  ├─ for each match, skip if:
  │    ├─ already in config.agents
  │    └─ id in removedAutoAgentIds
  ├─ remaining → pack AgentOverride { autoDiscovered: true, ...defaults }
  ├─ append to config.json, update lastRunAt
  └─ return (no changes if nothing new)
```

### Location

In `src/config/auto-register-agents.ts`:

```
autoRegisterNewAgents(homeDir: string, config: UserConfig, skillmuxHome: string): void
```

### Schema Changes

#### `AgentOverride` (in `src/core/types.ts`)

Add optional field:

```typescript
export type AgentOverride = {
  stableName?: string;
  supportedPlatforms?: SupportedPlatform[];
  homeRelativeRootPath?: string;
  skillsDirectoryPath?: string;
  enabledByDefault?: boolean;
  /** If true, this override was created by auto-discovery rather than user action. */
  autoDiscovered?: true;
};
```

#### `UserConfig` (in `src/core/types.ts`)

Add:

```typescript
export type UserConfig = {
  version: 1;
  agents: Record<string, AgentOverride>;
  /** Auto-discovery metadata. Present when version >= 1. */
  autoDiscover?: {
    /** ISO-8601 timestamp of the last successful scan. null = never run. */
    lastRunAt: string | null;
    /** Minimum interval between scans in ms. Default 3600000 (1 hour). */
    intervalMs: number;
  };
  /** Agent IDs that were auto-discovered but later removed by the user.
   *  Prevents re-registration on subsequent scans. */
  removedAutoAgentIds?: string[];
};
```

### Default Override Values for Auto-Discovered Agents

| Field | Value |
|-------|-------|
| `stableName` | Agent ID with first char uppercased (e.g. `"myagent"` → `"Myagent"`) |
| `supportedPlatforms` | `["win32", "linux", "darwin"]` |
| `homeRelativeRootPath` | The scanned directory name (e.g. `".myagent"`) |
| `skillsDirectoryPath` | `"skills"` |
| `enabledByDefault` | `true` |
| `autoDiscovered` | `true` |

### File Manifest

| File | Change |
|------|--------|
| `src/core/types.ts` | Add `autoDiscovered` to `AgentOverride`; add `autoDiscover` and `removedAutoAgentIds` to `UserConfig` |
| `src/config/load-user-config.ts` | Update Zod schema; populate defaults when fields are absent |
| `src/config/auto-register-agents.ts` | **NEW** — core scanning + registration logic |
| `src/discovery/discover-agents.ts` | Call `autoRegisterNewAgents()` before building the return list |
| `src/commands/config-remove-agent.ts` | When removing an `autoDiscovered: true` agent, push its ID to `removedAutoAgentIds` |
| `src/commands/config-update-agent.ts` | When updating an `autoDiscovered: true` agent, set `autoDiscovered: false` |
| `src/commands/agents.ts` | `DISCOVERY` column shows `auto` for auto-discovered agents |
| `src/tui/dashboard-model.ts` | Ensure `TuiAgentRow` correctly handles `discovery: "custom"` for auto-registered entries |
| `tests/discovery/auto-register.test.ts` | **NEW** — unit tests for scanning + registration |
| `tests/discovery/discover-agents.test.ts` | Add scenarios with auto-registered agents |

### CLI Behavior

- **`skillmux agents`**: Auto-discovered agents appear in the table with `DISCOVERY = auto`.
- **`skillmux config`**: Auto-registered entries visible in the config output.
- **`skillmux config update-agent --id <auto-agent>`**: Updates normally; after successful update, `autoDiscovered` is set to `false` (promoted to "custom").
- **`skillmux config remove-agent --id <auto-agent>`**: Removes the override; the ID is appended to `removedAutoAgentIds` so re-scan does not re-register it.

### TUI Behavior

- Auto-discovered agents appear in the agent list with existing relevance rules (has override + exists → visible in default list).
- Detail pane shows `DISCOVERY: auto`.
- `canEditOverride` / `canRemoveOverride` = `true`.
- Editing an auto-discovered agent via TUI sets `autoDiscovered: false` on successful save.
- Removing an auto-discovered agent via TUI appends to `removedAutoAgentIds`.

### Edge Cases

| Case | Handling |
|------|----------|
| Skills dir is a symlink | `fs.existsSync` resolves through symlinks; okay |
| Directory name is invalid agent ID | Skip (e.g. `..` entries, names with forbidden chars) |
| Agent already in built-in list | `config.agents` already has it → skipped |
| Agent manually removed then reappears | `removedAutoAgentIds` blocks re-registration |
| Multiple duplicates after re-scan | Cache timestamp prevents unnecessary re-scans |
| Config file doesn't exist yet | `loadUserConfig` returns empty config; auto-register populates defaults |
| User changes `autoDiscovered` agent's root via update | It's now `custom`, no longer subject to auto-register lifecycle |
| Concurrent process writes config | Same risk as existing `config write` operations; same handling (last-write-wins) |

### Cache Timing

Default `intervalMs`: **3 600 000** (1 hour). Stored in `autoDiscover.intervalMs` in `config.json` so user can adjust it. Setting to `0` means scan on every `discoverAgents()` call. Setting `auto-discover` config top-level field to absent effectively disables the feature.
