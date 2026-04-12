# SkillMux

SkillMux is a local CLI for managing skills across multiple agents. It discovers agent skill directories, keeps a canonical managed store under `.skillmux`, and enables or disables skills by creating or removing symlinks. v0 is local-only: it does not download remote skills or update them from the network.

## Requirements

- Node.js 20 or newer
- Windows, Linux, or macOS

## Install and build

From the repository root:

```bash
npm install
npm run build
```

For local development, you can also run:

```bash
npm run test
npm run typecheck
```

After building, the CLI entrypoint is `dist/cli.js`, exposed as the `skillmux` binary in `package.json`.

## Supported commands

- `skillmux agents [--json]`
  - Shows the discovered agent directories and whether they exist on disk.
- `skillmux scan [--json]`
  - Scans discovered agent skill directories.
  - Updates the manifest with the current snapshot.
- `skillmux list [--view records|agents|skills] [--format table|json]`
  - Lists scan results as raw records, grouped by agent, or grouped by skill.
- `skillmux import --source <path> --name <name>`
  - Copies an existing local skill into the SkillMux managed store.
- `skillmux doctor [--json]`
  - Reports configuration, scan, and filesystem issues.
- `skillmux config [--json]`
  - Shows the resolved SkillMux home path and any user agent overrides.
- `skillmux enable --skill <skill> --agent <agent>`
  - Enables a managed skill for a target agent by creating a managed symlink.
- `skillmux disable --skill <skill> --agent <agent>`
  - Disables a managed skill for a target agent by removing the managed symlink.

Built-in agent IDs currently recognized by default are:

- `codex`
- `claude`
- `gemini`
- `agents`
- `openclaw`

## SkillMux home layout

SkillMux stores its local state in `<user home>/.skillmux`.

```text
~/.skillmux/
  config.json
  manifest.json
  skills/
    <skill-id>/
```

- `config.json` stores user overrides for agent discovery.
- `manifest.json` stores managed skills, discovered agent records, activation records, and the last scan snapshot.
- `skills/<skill-id>/` is the canonical local store for a managed skill. Agent entries point at this store through symlinks or junctions.

Default agent skill directories are resolved from the user home directory:

- `.codex/skills`
- `.claude/skills`
- `.gemini/skills`
- `.agents/skills`
- `.openclaw/skills`

User overrides in `config.json` can change the agent display name, supported platforms, root path, skills directory path, and default enablement.

## Safe usage notes

- v0 edits the local filesystem directly. Treat `scan`, `import`, `enable`, and `disable` as state-changing commands.
- SkillMux refuses to replace a non-link entry when disabling a skill. If an entry is not a managed symlink, it will not blindly overwrite it.
- `import` is conservative in `v0`: it copies the source skill into `.skillmux/skills/<skill-id>` and leaves the original source directory untouched.
- The managed store is meant to be the source of truth for enabled skills. Avoid editing files inside agent skill directories by hand.
- If two agents resolve to the same skills directory, `doctor` reports it as a conflict.
- On Windows, directory symlinks are handled as junctions.
- If you change agent paths or config, run `scan` again so the manifest reflects the current filesystem.

## Example flow

```bash
skillmux agents
skillmux scan
skillmux import --source C:\path\to\find-skills --name find-skills
skillmux list --view agents
skillmux enable --skill find-skills --agent codex
skillmux disable --skill find-skills --agent claude
skillmux doctor
```

Typical usage is:

1. Scan the current environment.
2. Import a local skill into the managed store.
3. Inspect agents or skills.
4. Enable a managed skill for the agents that should see it.
5. Disable it for agents that should not.
6. Run `doctor` when you want a quick consistency check.
