# SkillMux (UTF-8)

该项目(SkillMux)为一个用于管理通过`https://skills.sh/`网站的类似`npx skills add https://github.com/vercel-labs/skills --skill find-skills`命令添加的skills的工具。
因为通过这种方式安装的skills会散落在多个文件夹内(例如`.agent`, `.claude`, `.codex`等)，如果我想精细的管理(比如我先把`find-skills`这个skills从`.codex`中移除，也就是让codex看不到这个skill)，那只能我手动去执行，这很麻烦。我如果后续又需要这个skills，我还要再下载一遍。
所以我想开发一个工具来管理这些skills，能够一键安装、停用(从目标agent的文件夹中暂时移除)、启用(从目标agent的文件夹中恢复)、更新这些skills，并且是**以agent为单位**进行管理，同时也可以以skill为单位进行管理。
注意，通过`https://skills.sh/`下载的skills往往只有一份文件，安装到不同agent的文件夹中只是创建了一个symlink，要处理好这种情况。

## Iron Rule

- 每一步都要落盘，具体而言，有四个文件，你需要**及时维护/更新这四个文件**：
  - `AGENTS.md`：就是当前这个文件，每个agent/session都要读取的文件
  - `PROJECT_STATUS.md`：记录当前项目的总进度总览
  - `NEXT_ACTIONS.md`：记录每个agent/session下一步行动计划, 完成了就打勾`[x]`
  - `DECISIONS.md`：记录关键决策，避免忘记为什么要这样做
  注意，不要每次都重写这四个文件，最好是追加、修改。
- 合理使用skills，如果还没有安装合适的skills，你可以通过`find-skills`这个技能来查找适合的技能。
- 有一些命令在sandbox里面运行不了，直接找我提权
- **合理使用subagent**，想想你自己是一个leader，把可切分的任务分配给subagent，自己专注于管理和协调，以避免上下文过长。
- 当前目录才是主目录！把稳定版代码放到当前目录！.worktrees只是作为开发时期使用的
- 当一个比较大的任务完成时，停下来提醒我`/compact`，以压缩上下文，避免后续的上下文过长导致性能问题。但你要整理好下一步需要做什么，避免compact后忘记了下一步要做什么。
- 对于subagent，当执行完任务并且不再需要的时候，及时清理，不要堆积大量无用的subagent。
- `docs/superpowers/plans`里面的任务每完成一个也要打勾`[x]`以保持同步。
- subagent不要使用太旧的模型(比如`GPT-5.2`)，相对简单/追求快速的任务(比如写`README.md`)可以使用`GPT-5.4-mini`(更省token)，相对困难/追求质量的任务就用`GPT-5.4`(主agent的model)。

## Current Direction

- 当前优先目标是先做一个**CLI 工具**，暂不做图形界面。
- 分发方式优先采用 **npm 包**，目标支持 Windows / Linux / macOS。
- `v0` 只管理本地已安装 skills，不负责远端下载/更新。
- `npx skills` / `https://skills.sh/` 继续作为远端安装入口；SkillMux 不重复实现远端安装器。
- 工具需要同时支持：
  - 以 **agent** 为中心管理 skills
  - 以 **skill** 为中心管理其在不同 agent 中的启用状态
- 需要正确处理 `skills.sh` 安装模式下“单份 skill 内容 + 多处 symlink 引用”的情况。
- `v0` 需要**直接修改本地环境**，自动完成启用/停用所需的目录与 symlink 操作，而不是只输出建议命令。
- 需要尽可能覆盖常见 agent（如 `.gemini`、`.codex`、`.claude`、`.agents`、`.openclaw` 等），并尽量自动找对目录。
- agent 目录发现优先采用“**内置常见规则 + 用户配置覆盖**”的方式，并可参考 `npx skills add <owner/repo>` 已支持的安装目录集合。
- 停用 skill 时，SkillMux 优先将真实 skill 内容收拢到自己托管的本地仓库中；agent 侧只保留或移除可重建的链接状态。
- 后续如扩展与 `npx skills` 的配合，重点是优化“安装后如何被 SkillMux 接管和管理”的衔接，不是替代 `npx skills` 的远端获取能力。
- 现在已经支持通过 `skillmux config add-agent` 为自定义 agent 写入 `~/.skillmux/config.json`。
- 现在已经支持通过 `skillmux config remove-agent` 删除自定义 agent 的配置覆盖项。
- 现在已经支持通过 `skillmux config update-agent` 更新已有自定义 agent 配置覆盖项；新增仍然使用 `config add-agent`。
- 现在已经支持 `skillmux adopt`、`skillmux remove` 和常用 repeatable flag 批量操作；README 需要保持这些命令的用户向说明。
- 当前已经进入 TUI 设计阶段；设计阶段使用 `$using-superpowers` 和 `$tui-design`，实现阶段再额外使用 `$terminal-ui`。
- TUI 实现前必须先完成并批准 `docs/superpowers/specs/` 下的设计 spec；不要跳过 brainstorming 的设计门禁。
- 当前开发环境是windows，使用的是PowerShell，不支持`&&`，因此使用命令的时候请不要使用`&&`。

## Execution Notes

- 当前仓库已回到 **root-only** 工作状态，`.worktrees/` 已清理；主目录 `C:\Users\wudon\Desktop\SkillMux\` 是唯一稳定版与最终交付区。
- 如果后续需要重新使用 worktree 做隔离开发，可以再创建，但 accepted state 仍然只以主目录验证通过后的代码为准。
- 子代理产出的代码只有在主目录完成验证后，才算 accepted state。
- lifecycle-closure Task 1 已同步并提交到主目录；当前没有活跃开发 worktree，后续 Task 2 应从主目录 accepted state 重新创建隔离 worktree。
- lifecycle-closure Task 2 (`skillmux adopt --agent <agent> [--skill <skill>]`) is accepted in root commit `3f3c2ee`; `.worktrees/lifecycle-adopt` has been removed, and the repo is back to root-only accepted state for the next slice.
- lifecycle-closure Task 3 (`skillmux config update-agent`) is accepted in root commit `a645ade`; `.worktrees/lifecycle-config-update` has been removed, and the repo is back to root-only accepted state for the next slice.
- lifecycle-closure Task 4 (`lifecycle batch operations`) is accepted in root commit `6fcaef7`; `.worktrees/lifecycle-batch` has been removed, and the repo is back to root-only accepted state for the next slice.
- lifecycle-closure Task 5 (`final documentation and release readiness`) is accepted in root commit `64a0d42`; `.worktrees/lifecycle-release-docs` has been removed, and the repo is back to root-only accepted state.
- post-lifecycle npm release prep was opened after root commit `73cb496`; the active isolated preparation worktree is recorded in the next note.
- post-lifecycle npm release prep is accepted in root commit `0f72701`; `.worktrees/post-lifecycle-release` has been removed; target `skillmux@0.1.2`; final root verification passed.
- `skillmux@0.1.2` has been published to npm and verified with `npm view skillmux version` returning `0.1.2`; the temporary npm userconfig used for publishing was deleted after publish.
- TUI design has started from the root-only accepted state after `skillmux@0.1.2`; no implementation worktree is active yet.
- TUI design spec is written, spec-reviewed, and user-approved at `docs/superpowers/specs/2026-04-16-skillmux-tui-design.md`.
- TUI implementation plan at `docs/superpowers/plans/2026-04-16-skillmux-tui-implementation-plan.md` is reviewed and approved; next step is execution-mode choice before implementation starts.
- Browser visual companion scratch files live under `.superpowers/brainstorm/` and should stay out of git.
