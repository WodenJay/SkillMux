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

## Current Direction (及时清理，不要留下过时/没用的内容)

- 分发方式优先采用 **npm 包**，目标支持 Windows / Linux / macOS。
- `v0` 只管理本地已安装 skills，不负责远端下载/更新。
- `npx skills` / `https://skills.sh/` 继续作为远端安装入口；SkillMux 不重复实现远端安装器。
- 工具需要同时支持：
  - 以 **agent** 为中心管理 skills
  - 以 **skill** 为中心管理其在不同 agent 中的启用状态
- 需要正确处理 `skills.sh` 安装模式下“单份 skill 内容 + 多处 symlink 引用”的情况。
- 需要尽可能覆盖常见 agent（如 `.gemini`、`.codex`、`.claude`、`.agents`、`.openclaw` 等），并尽量自动找对目录。
- agent 目录发现优先采用“**内置常见规则 + 用户配置覆盖**”的方式，并可参考 `npx skills add <owner/repo>` 已支持的安装目录集合。
- 停用 skill 时，SkillMux 优先将真实 skill 内容收拢到自己托管的本地仓库中；agent 侧只保留或移除可重建的链接状态。
- 后续如扩展与 `npx skills` 的配合，重点是优化“安装后如何被 SkillMux 接管和管理”的衔接，不是替代 `npx skills` 的远端获取能力。
- 当前已经进入 TUI 设计阶段；设计阶段使用 `$using-superpowers` 和 `$tui-design`，实现阶段再额外使用 `$terminal-ui`。
- TUI 实现前必须先完成并批准 `docs/superpowers/specs/` 下的设计 spec；不要跳过 brainstorming 的设计门禁。
- 当前开发环境是windows，使用的是PowerShell，不支持`&&`，因此使用命令的时候请不要使用`&&`。

## Execution Notes (及时清理，不要留下过时/没用的内容)

- A TUI usability follow-up planning pass is recorded at `docs/superpowers/plans/2026-04-19-skillmux-tui-usability-follow-up-plan.md`; resume from that file instead of memory.
- The recorded follow-up fixes are:
  - make the dashboard occupy the full terminal and read like the current terminal session has been taken over
  - switch panel focus with left/right arrows
  - remove `E0` / `D1` style agent counters
  - keep user-facing status icons, but explain them clearly in the footer/help area
  - keep the selected agent clearly highlighted while Skills has focus
  - remove the Detail pane from the focus cycle
- The follow-up implementation is now applied in the root repo and verified with targeted TUI tests plus `npm test`, `npm run typecheck`, and `npm run build`.
- The next TUI design slice is a PTY-driven exploration and end-to-end test harness for `skillmux tui`.
- That harness is intentionally scoped to terminal semantics, not Windows Terminal desktop automation.
- The approved design direction is: real TUI actions in a temporary sandbox, scriptable exploratory sessions, and artifacts that include event logs plus screen snapshots.
- The approved implementation plan for that slice is `docs/superpowers/plans/2026-04-21-skillmux-tui-pty-exploration-implementation-plan.md`.
- The user selected subagent-driven execution for the PTY exploration implementation.
- PTY exploration Task 1 is accepted at root commit `606217b` (`test: bootstrap tui pty runner`).
- On the current Windows PowerShell + Vitest setup, passing `tests/tui-e2e/**/*.test.ts` through `npm test -- --run` returns `No test files found`; the accepted runner enumerates the current PTY `.test.ts` files explicitly for regression mode instead.
- Task 1 verification in the root repo is:
  - `npm run build` passes
  - `npm test -- --run tests/tui-e2e/scenarios/smoke.test.ts` fails on missing `tests/tui-e2e/fixtures.ts` / `tests/tui-e2e/explorer.ts`, as intended for this bootstrap slice
  - `node scripts/run-tui-e2e.mjs regression` builds and then fails on the same missing harness modules
- PTY exploration Task 2 is accepted at root commit `714e328` (`test: add tui screen artifact primitives`).
- Task 2 verification in the root repo is:
  - `npm test -- --run tests/tui-e2e/screen.test.ts` passes with 5 tests
  - `npm run typecheck` still fails only on the pre-existing Task 1 placeholder imports in `tests/tui-e2e/scenarios/smoke.test.ts`
  - `git diff --check` passes
- The next PTY exploration slice is Task 3: PTY session driver.
