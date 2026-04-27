<p align="center">
  <img src="assets/logo.png" alt="SkillMux logo" width="240" />
</p>

<p align="center">
  <strong>Manage local agent skills across multiple AI coding agents from a single hub.</strong>
</p>

<p align="center">
  <img alt="npm" src="https://img.shields.io/npm/v/skillmux" />
  <img alt="node" src="https://img.shields.io/node/v/skillmux" />
</p>

<!-- README-I18N:START -->

[中文](./README.md) | **English**

<!-- README-I18N:END -->

---

## What is SkillMux

AI coding agents (Codex, Claude, Gemini, etc.) each have their own `skills/` directory loaded with symlinks or junctions pointing to shared skill files. Managing these links by hand — deciding which agent sees which skill — gets messy fast.

SkillMux centralizes your skills into `~/.skillmux/` and manages symlink exposure per agent. Install a skill once, then enable or disable it for any agent with a single command. No re-downloading, no hunting through hidden directories.

Use it yourself from the terminal, or hand it to your AI agent — SkillMux is built for both.

## Preview

<p align="center">
  <img src="assets/tui_screen.png" alt="SkillMux TUI dashboard" width="720" />
</p>

## Features

- **Unified skill store** — one canonical copy of each skill, symlinked into agent directories
- **Per-agent visibility** — enable or disable any skill for any agent independently
- **Auto-discovery** — detects `.codex/skills`, `.claude/skills`, `.gemini/skills`, and any `./xxx/skills` directory automatically
- **TUI dashboard** — interactive terminal UI to browse, search, enable, disable, adopt, and remove skills
- **Batch operations** — toggle multiple skills or agents in a single command
- **AI-friendly** — JSON output and deterministic behavior make it safe for AI agents to operate
- **Safe by default** — never deletes original files; `disable` only removes managed links; `remove` refuses if a skill is still in use

## Installation

```
npm install -g skillmux
```

> [!NOTE]
> Requires **Node.js >= 20**. Uninstalling the CLI does not touch your `~/.skillmux/` data.

## Quick Start

Run the TUI dashboard and follow your intuition:

```bash
skillmux tui
```

Press `?` for keyboard shortcuts — the footer explains every icon at a glance.

If you prefer the command line:

```bash
skillmux agents                  # see which agents were detected
skillmux scan                    # scan local skill directories
skillmux adopt --agent codex --skill find-skills   # bring a skill under management
skillmux enable --skill find-skills --agent claude # share it with another agent
skillmux list --view skills      # review current state
```

To remove a skill from an agent:

```bash
skillmux disable --skill find-skills --agent claude
```

To delete a skill entirely after disabling it everywhere:

```bash
skillmux remove --skill find-skills
```

## How It Works

```
~/.skillmux/
  config.json          # agent directory rules (built-in, auto-discovered, custom)
  manifest.json        # managed skill registry
  skills/
    find-skills/       # <-- canonical copy (real files live here)
    clean-code/
    ...

~/.codex/skills/
  find-skills/   --> ~/.skillmux/skills/find-skills/   (symlink/junction)

~/.claude/skills/
  find-skills/   --> ~/.skillmux/skills/find-skills/   (symlink/junction)
```

SkillMux copies each skill's real content into its managed store once, then creates links into each agent's `skills/` directory. `enable` creates a link; `disable` removes the link but keeps the content. `import` and `adopt` bring external skills under management; `remove` cleans up the store when a skill is no longer needed.

**Supported agents (built-in):** `.codex`, `.claude`, `.gemini`, `.agents`, `.openclaw`.  
**Auto-discovered:** any `./xxx/skills` directory under your home folder is picked up automatically.

## CLI Commands

### Setup

| Command | Purpose |
|---|---|
| `skillmux agents [--json]` | List detected agent directories (`builtin` / `auto` / `custom`) |
| `skillmux config` | Show resolved configuration |
| `skillmux config add-agent --id ... --root ...` | Register a custom agent directory |
| `skillmux config update-agent --id ...` | Update a custom agent rule |
| `skillmux config remove-agent --id ...` | Remove a custom agent rule |
| `skillmux scan [--json]` | Scan agent skill directories and refresh state |

### Manage

| Command | Purpose |
|---|---|
| `skillmux adopt --agent <id> [--skill <name>]` | Bring agent-side skills under SkillMux management |
| `skillmux import --source <path> --name <id>` | Import a local skill directory |
| `skillmux enable --skill <name> --agent <id>` | Expose a managed skill to an agent |
| `skillmux disable --skill <name> --agent <id>` | Hide a managed skill from an agent |
| `skillmux remove --skill <name>` | Delete a skill from the managed store (must be fully disabled) |

### Inspect

| Command | Purpose |
|---|---|
| `skillmux list [--view agents\|skills\|records]` | View managed state |
| `skillmux doctor [--json]` | Check for broken links, orphans, and anomalies |

Use `--help` on any command to see all available flags.

## TUI Keyboard Shortcuts

| Key | Action |
|---|---|
| `←` `→` | Switch focus between Agents and Skills panels |
| `Space` | Enable / disable the selected managed skill |
| `a` | Adopt an unmanaged skill (with confirmation) |
| `r` | Remove a fully-disabled skill (with confirmation) |
| `s` | Scan agent directories and refresh |
| `/` | Filter the focused list |
| `?` | Show help overlay |
| `q` | Quit |

For non-interactive terminals or scripted use, prefer `skillmux list`, `skillmux scan`, or `skillmux doctor`.

## Batch Operations

Repeat flags to operate on multiple targets in one command:

```bash
skillmux enable --skill find-skills --agent codex --agent claude
skillmux disable --skill find-skills --agent codex --agent claude
skillmux adopt --agent codex --skill find-skills --skill clean-code
skillmux remove --skill old-skill --skill unused-skill
```

If a batch operation fails partway through, SkillMux reports completed items so you can pick up where you left off.

## Relationship with `npx skills` / `skills.sh`

`npx skills` downloads skills from remote repositories. SkillMux does not replace that — it manages skills that are already on disk.

Recommended flow:

```
npx skills add https://github.com/vercel-labs/skills --skill find-skills
skillmux scan
skillmux adopt --agent codex --skill find-skills
skillmux enable --skill find-skills --agent claude
```

## For AI Agents

If you're giving this README to an AI, here's what it needs:

- Install: `npm install -g skillmux`
- Remote install: continue using `npx skills` / `skills.sh`
- Check the environment: `skillmux agents`, `skillmux scan`
- Get skills under management: `skillmux adopt`, `skillmux import`
- Control visibility: `skillmux enable`, `skillmux disable`
- Clean up: `skillmux remove`
- Check health: `skillmux doctor`
- JSON output: add `--json` to any command for structured data

> [!IMPORTANT]
> `scan`, `import`, `enable`, `disable`, `adopt`, `remove`, and config write commands all modify local state directly.
> `disable` only removes managed links — it never touches normal directories.
> `remove` refuses to run if the skill is still enabled on any agent.
> `import` copies content without deleting the original.
> On Windows, directory links use junction semantics.
> Re-run `skillmux scan` if you've manually changed agent directories.
