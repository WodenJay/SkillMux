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
- PTY exploration Task 3 is accepted at root commit `8413d13` (`test: add tui pty session driver`).
- Task 3 verification in the root repo is:
  - `npm run build` passes
  - `npm run typecheck` passes
  - `npm test -- --run tests/tui-e2e/pty-session.test.ts tests/tui-e2e/scenarios/smoke.test.ts` passes with the PTY session unit slice plus the real smoke path
- Task 3 implementation note: on this Windows PTY path, `skillmux tui` must be spawned with `TERM=xterm-256color` (or an inherited `TERM`) or Ink can sit without rendering dashboard output under the harness.
- Task 3 smoke-fixture note: the manifest used by the real PTY smoke path must define the `codex` agent record as well as the activation, because the read-only dashboard loader validates activation agent references before rendering.
- PTY exploration Task 4 is accepted at root commit `b3f6d9f` (`test: add tui sandbox fixtures`).
- Task 4 verification in the root repo is:
  - `npm test -- --run tests/tui-e2e/sandbox.test.ts tests/tui-e2e/scenarios/smoke.test.ts` passes with 3 tests
  - `npm run typecheck` passes
  - `git diff --check` passes
- Task 4 fixture note: scenario fixtures now write typed manifests through the real manifest writer, reject undeclared-agent references and conflicting duplicate declarations up front, and keep `lastScan.at` at `null` unless a later scenario explicitly opts into scanned state.
- Task 4 smoke note: the real PTY smoke path now asserts that the enabled managed skill row renders, not only that the dashboard header appears.
- PTY exploration Task 5 is accepted at root commits `c7aa8c6` (`test: add tui explorer scenarios`) and `cd8092c` (`test: harden explorer lock recovery`).
- Task 5 verification in the root repo is:
  - `npm run build` passes
  - `npm test -- --run tests/tui-e2e/explorer.test.ts tests/tui-e2e/scenarios/lifecycle-flow.test.ts tests/tui-e2e/scenarios/usability-probes.test.ts` passes with 5 tests
  - `npm test -- --run tests/tui-e2e/scenarios/smoke.test.ts` passes
  - `npm run typecheck` passes
  - `git diff --check` passes
- Task 5 explorer note: the high-level PTY explorer now wraps the raw session with key helpers, path/fs probes, and a repo-local PTY lock so real Windows PTY scenarios do not stampede each other.
- Task 5 reliability note: stale or corrupt PTY lock metadata is treated as recoverable, and lifecycle scenarios wait for the rendered confirm dialog text before sending `y`.
- PTY exploration Task 6 is accepted at root commits `624e7f3` (`test: stabilize pty session serialization`), `04abc2c` (`test: keep pty lock on close timeout`), and `4e3c3b9` (`test: extend tui timeout budgets`).
- Task 6 verification in the root repo is:
  - `npm run build` passes
  - `npm run test:tui-e2e` passes with 16 tests
  - `npm test` passes with 162 tests
  - `npm run typecheck` passes
  - `git diff --check` passes
- Task 6 PTY stability note: real-session serialization now lives in `tests/tui-e2e/pty-session.ts`, so direct PTY callers such as `smoke.test.ts` serialize correctly while mocked explorer unit tests stay lock-free.
- Task 6 close-timeout note: PTY session close keeps the lock until exit is confirmed and retries termination on a later close if the first close attempt times out.
- Task 6 timeout-budget note: the PTY session lock wait budget is now 30000 ms, the async `tui-lazy-loading` tests carry explicit 15000 ms test budgets, and the real PTY scenarios use explicit 10000 ms initial-ready waits so the full-suite run is stable under Windows worker load.
- Repository cleanup note: `.worktrees/tui-implementation` has been removed, the stale local lifecycle/TUI/task branches have been deleted, and the accepted PTY exploration state now lives on `main`.
- The next TUI product slice is PTY-driven audit and polish on top of the accepted harness, not additional harness construction.
- The written design spec for that slice is `docs/superpowers/specs/2026-04-21-skillmux-tui-pty-audit-polish-design.md`.
- The written implementation plan for that slice is `docs/superpowers/plans/2026-04-21-skillmux-tui-pty-audit-polish-implementation-plan.md`.
- Audit rounds should scan interaction/focus, layout, state feedback, and terminal behavior together, but only repair the highest-priority findings in each round before stopping for `/compact`.
- PTY audit/polish Round 1 is complete in root. It rewrote the overly dense footer/help legends for the 80x24 baseline and tightened regression coverage around the user-requested circle markers, then verified those changes with targeted TUI tests, `npm run test:tui-e2e`, `npm test`, `npm run typecheck`, and `npm run build`.
- PTY audit/polish Round 2 is complete in root. It compressed the Detail pane's managed-store and agent-link paths into one-line `Store` / `Link` summaries, then verified the change with targeted TUI tests, PTY smoke, `npm run test:tui-e2e`, `npm test`, `npm run typecheck`, and `npm run build`.
- PTY audit/polish Round 3 is complete in root. It removed default first-screen noise from built-in agents that are neither present locally nor carrying activation history, unmanaged entries, or issues, while keeping explicit agent search able to find those built-ins on demand.
- Round 3 verification in the root repo passed with `npm run build`, `npm test -- --run tests/tui/state.test.ts tests/tui-e2e/scenarios/smoke.test.ts`, `npm run test:tui-e2e`, `npm test`, `npm run typecheck`, and `git diff --check`.
- PTY audit/polish Round 4 is complete in root. It repaired search feedback and search-exit semantics: empty filtered lists now say `No matching agents` / `No matching skills`, `Esc` restores the pre-search selection, and `Enter` commits the current filtered selection before leaving search mode.
- Round 4 verification in the root repo passed with `npm run build`, `npm test -- --run tests/tui/state.test.ts tests/tui/components.test.tsx tests/tui-e2e/scenarios/usability-probes.test.ts`, `npm run test:tui-e2e`, `npm test`, `npm run typecheck`, and `git diff --check`.
- PTY audit/polish Round 5 is complete in root. It repaired agent-switch loading feedback so the Skills and Detail panes show loading placeholders instead of misleading empty-state copy while the next agent is still reloading.
- Round 5 verification in the root repo passed with `npm run build`, `npm test -- --run tests/tui/components.test.tsx`, `npm run test:tui-e2e`, `npm test`, `npm run typecheck`, and `git diff --check`.
- PTY audit/polish Round 6 is complete in root. It repaired agent-switch failure handling so a rejected agent reload rolls the dashboard back to the last successfully loaded model instead of leaving the failed target agent on a misleading empty state.
- Round 6 verification in the root repo passed with `npm run build`, `npm test -- --run tests/tui/components.test.tsx`, `npm run test:tui-e2e`, `npm test`, `npm run typecheck`, and `git diff --check`.
- PTY audit/polish Round 7 is complete in root. It repaired the empty-result search submit trap so pressing `Enter` with no visible matches restores the previous stable selection instead of committing an empty agent or skill selection.
- Round 7 verification in the root repo passed with `npm run build`, `npm test -- --run tests/tui/state.test.ts tests/tui/components.test.tsx`, `npm run test:tui-e2e`, `npm test`, `npm run typecheck`, and `git diff --check`.
- A new TUI runtime/layout slice is now approved in conversation: `skillmux tui` should enter the terminal alternate screen by default, occupy the full terminal viewport responsively, and restore the previous shell screen on exit.
- The written design spec for that slice is `docs/superpowers/specs/2026-04-22-skillmux-tui-alternate-screen-responsive-layout-design.md`.
- The written implementation plan for that slice is `docs/superpowers/plans/2026-04-22-skillmux-tui-alternate-screen-responsive-layout-implementation-plan.md`.
- Execution for that slice should start by choosing execution mode, then implementing alternate-screen lifecycle before responsive layout work.
- That slice is intentionally separate from the unfinished PTY audit/polish Round 8 search-cancel debugging thread; do not mix the uncommitted Round 8 WIP into the alternate-screen/fullscreen work accidentally.
- The user also requested a one-key action to adopt all unmanaged skills, but that is a later usability/lifecycle slice and not part of the alternate-screen/fullscreen runtime change.
- Execution mode for that slice is now selected: subagent-driven development.
- Alternate-screen/fullscreen Task 1 is now accepted in root at commits `1fb88d0`, `9766496`, `b85a10d`, `7bc49eb`, `594bbce`, and `d4093ba`.
- Task 1 verification in root passed with:
  - `npm run build`
  - `npm test -- --run tests/tui/launch-tui.test.tsx tests/tui-e2e/pty-session.test.ts tests/tui-e2e/scenarios/smoke.test.ts`
  - `npm test`
  - `npm run typecheck`
  - `git diff --check`
- Task 1 implementation note: `src/tui/launch-tui.tsx` now owns alternate-screen enter/exit, cursor hide/show, and preserves the original runtime failure even if cleanup also fails.
- Task 1 PTY note: the accepted smoke proof uses trace markers `alt-screen-enter`, `session-exit-clean`, and `alt-screen-exit`, and checks raw output after the exit boundary for dashboard residue instead of relying on the final xterm-headless snapshot alone.
- Alternate-screen/fullscreen Task 2 is now accepted in root at commit `463c970` (`feat: make tui layout responsive`).
- Task 2 verification in root passed with:
  - `npm run build`
  - `npm run typecheck`
  - `npm test -- --run tests/tui/components.test.tsx`
  - `git diff --check`
- Task 2 layout note: `Dashboard.tsx` now uses ratio-based pane widths with minimum guards and a fullscreen centered resize fallback below `80x24`.
- Task 2 execution note: implementation and review happened in `.worktrees/tui-alt-screen-task2`, then the accepted delta was synced back to root manually because the paused Round 8 root WIP still marked `src/tui/components/Dashboard.tsx` as modified.
- Alternate-screen/fullscreen Task 3 is now accepted in root at commit `38b819e` (`test: verify tui fullscreen pty behavior`).
- Task 3 verification in root passed with:
  - `npm run build`
  - `npm run typecheck`
  - `npm test -- --run tests/tui-e2e/scenarios/smoke.test.ts tests/tui-e2e/scenarios/usability-probes.test.ts`
  - `npm run test:tui-e2e`
  - `git diff --check`
- Task 3 execution note: implementation and review happened in `.worktrees/tui-alt-screen-task3`, then the accepted delta was synced back to root manually because the paused Round 8 root WIP still marked `src/tui/app.tsx` and `tests/tui-e2e/scenarios/usability-probes.test.ts` as modified.
- Task 3 PTY note: on this Windows `node-pty` path, child TTY APIs do not reflect live resize dimensions, so PTY resize verification uses a narrow test-only size bridge via `SKILLMUX_TUI_PTY_SIZE_FILE`.
- Task 3 cleanup note: Ctrl+C cleanup is now proven with trace markers, cursor hide/show output, and no dashboard residue after `alt-screen-exit`.
- Task 4 final verification gate passed in root with:
  - `npm run build`
  - `npm run test:tui-e2e`
  - `npm test`
  - `npm run typecheck`
  - `git diff --check`
- The alternate-screen/fullscreen slice is now complete in root.
- The next follow-up slice is the later usability/lifecycle request for one-key adoption of all unmanaged skills.
- The remaining Round 8 root residue in `src/tui/state.ts` and `tests/tui/state.test.ts` was later reviewed and discarded because it had no substantive code delta against `HEAD`; it was mixed line-ending noise, not a pending fix.
- The next TUI usability/lifecycle slice is now narrowed and approved in conversation:
  - scope: current selected agent only, not all agents
  - shortcut: `Shift+A`
  - lowercase `a` remains single-row adopt for the selected unmanaged skill
  - implementation should reuse existing `runAdopt({ agent })` semantics instead of adding a new CLI command
- The written design spec for that slice is `docs/superpowers/specs/2026-04-23-skillmux-tui-adopt-all-unmanaged-agent-skills-design.md`.
- The written implementation plan for that slice is `docs/superpowers/plans/2026-04-23-skillmux-tui-adopt-all-unmanaged-agent-skills-implementation-plan.md`.
- Execution mode for that slice is now selected: subagent-driven development.
- Bulk-adopt Task 1 is now accepted in root at commit `6c6811b` (`feat: add tui bulk adopt action contract`).
- Task 1 verification in root passed with:
  - `npm test -- --run tests/tui/state.test.ts tests/tui/actions.test.ts`
  - `npm run typecheck`
- Task 1 contract note: `state.ts` now exposes `request-adopt-all`, `confirm-adopt-all`, and a required `adoptAll` footer/action flag for the selected agent.
- Task 1 dispatcher note: `actions.ts` now supports `adopt-all` by reusing `runAdopt({ agent })` with no `skill`, while refusing missing-agent and zero-unmanaged cases with short user-facing status text.
- Bulk-adopt Task 2 is now accepted in root at commit `099c221` (`feat: add tui shift-a bulk adopt flow`).
- Task 2 verification in root passed with:
  - `npm test -- --run tests/tui/components.test.tsx`
  - `npm run build`
  - `npm run typecheck`
  - `git diff --check`
- Task 2 interaction note: `Shift+A` now opens a visible bulk-adopt confirmation dialog, and `y` dispatches `adopt-all` exactly once through the existing duplicate-confirm guard.
- Task 2 UI note: footer/help copy now teaches `Shift+A`, and the bulk-adopt confirm dialog explains that the current agent's unmanaged skills will move under SkillMux management.
- Bulk-adopt Task 3 is now accepted in root at commit `0f9d883` (`test: cover tui bulk adopt flow`).
- Task 3 verification in root passed with:
  - `npm test -- --run tests/tui-e2e/scenarios/bulk-adopt-flow.test.ts`
  - `npm run test:tui-e2e`
  - `npm run typecheck`
- Task 3 PTY note: the explorer now exposes `bulkAdopt()` as a thin `A` key helper, and the new PTY scenario proves current-agent bulk adopt for two unmanaged skills on `codex`.
- Task 3 stability note: the accepted PTY slice also tightens the existing resize restore probe so it waits for the fullscreen dashboard to be fully restored, not just for stale header text to reappear under suite load.
- Bulk-adopt Task 4 final verification gate passed in root with:
  - `npm run build`
  - `npm run test:tui-e2e`
  - `npm test`
  - `npm run typecheck`
  - `git diff --check`
- The current-agent `Shift+A` bulk-adopt slice is now complete in root.
- The next TUI product slice is full parity with the current local-management CLI surface for setup/configuration workflows that are still missing from the dashboard.
- The written design spec for that slice is `docs/superpowers/specs/2026-04-23-skillmux-tui-cli-parity-design.md`.
- Accepted scope for that slice:
  - `config add-agent`
  - `config update-agent`
  - `config remove-agent`
  - `import`
  - `doctor`
- Accepted interaction model for that slice:
  - direct keyboard shortcuts instead of a command palette
  - single-page modal forms instead of a wizard
  - `n` add agent, `e` edit selected agent, `X` remove selected agent, `i` import skill, `d` doctor
  - full current CLI field coverage for add/update/import rather than a reduced TUI-only subset
- Accepted architecture boundary for that slice: the TUI should reuse `runConfigAddAgent`, `runConfigUpdateAgent`, `runConfigRemoveAgent`, `runImport`, and `runDoctor` as the source of truth instead of reimplementing their validation or write semantics.
- The written implementation plan for that slice is `docs/superpowers/plans/2026-04-23-skillmux-tui-cli-parity-implementation-plan.md`.
- Planned execution order for that slice:
  - Task 1: dashboard metadata and reducer scaffolding
  - Task 2: form payloads and command dispatcher support
  - Task 3: modal UI, keyboard wiring, and doctor presentation
  - Task 4: focused PTY agent-config/import/doctor scenarios
  - Task 5: final tracking sync and full root verification gate
- Execution mode for that slice is now selected: subagent-driven development.
- TUI CLI parity Task 1 is now accepted in root at commit `8350bb0` (`feat: add tui parity workflow scaffolding`).
- Task 1 verification in root passed with:
  - `npm test -- --run tests/tui/dashboard-model.test.ts tests/tui/state.test.ts`
  - `npm run typecheck`
  - `git diff --check`
- Task 1 dashboard-model note: agent rows now carry required `hasUserOverride`, `canEditOverride`, and `canRemoveOverride` booleans, and `loadDashboardState()` passes configured agent ids into the dashboard model build so editability is data-driven rather than inferred from labels.
- Task 1 reducer note: parity workflow shells now exist for add-agent, edit-agent, remove-agent, import, doctor, and discard-dirty-form, with modal-open state blocking background dashboard input.
- Task 1 visibility note: config-only agent overrides remain visible in the default Agents list even when the local agent root does not yet exist, so later add/edit/remove flows do not depend on search to rediscover them.
- TUI CLI parity Task 2 is now accepted in root at commit `9f36282` (`feat: add tui parity command payloads`).
- Task 2 verification in root passed with:
  - `npm test -- --run tests/tui/dashboard-model.test.ts tests/tui/state.test.ts tests/tui/actions.test.ts`
  - `npm run typecheck`
  - `git diff --check`
- Task 2 form-state note: `src/tui/forms.ts` now owns deterministic add/edit/import form builders, validation, normalization, and array-safe baseline cloning for `platforms[]`.
- Task 2 reducer note: parity workflows now stage payload-bearing `pendingCommand` intents for add/edit/remove/import/doctor, include doctor loading/ready/error states, and open dirty-form discard confirmation before dropping local edits.
- Task 2 patch-semantics note: edit-agent now seeds from raw override payload fields instead of merged discovered-agent values, so unchanged edits do not bake inherited defaults into `config.json`; `preserveEnabledByDefault` keeps the CLI unset state distinct from explicit true/false.
- TUI CLI parity Task 3 is now accepted in root at commit `6425d93` (`fix: preserve tui doctor failure state`).
- Task 3 verification in root passed with:
  - `npm test -- --run tests/tui/components.test.tsx tests/tui/actions.test.ts`
  - `npm run build`
  - `npm run typecheck`
  - `git diff --check`
- Task 3 modal note: the dashboard now renders fullscreen parity overlays for add-agent, edit-agent, import, remove-agent confirm, discard-dirty-form confirm, and doctor, with dedicated `FormDialog` and `DoctorDialog` components.
- Task 3 interaction note: normal-mode `n` / `e` / `X` / `i` / `d` are now wired in `App`, modal forms use `Up` / `Down` field movement plus explicit submit rows, and dirty-form `q` follows the discard-confirmation flow instead of exiting immediately.
- Task 3 failure-handling note: add/edit/import command failures now stay inside the modal with preserved inputs and inline errors, and real resolved doctor failures preserve the original command error instead of degrading to `Doctor report missing`.
- TUI CLI parity Task 4 is now accepted in root at commit `ab0bf07` (`test: cover tui cli parity flows`).
- Task 4 verification in root passed with:
  - `npm run build` PASS
  - `npm test -- --run tests/tui-e2e/scenarios/agent-config-flow.test.ts tests/tui-e2e/scenarios/import-doctor-flow.test.ts` PASS (4 tests)
  - `npm run typecheck` PASS
  - `git diff --check` PASS
- Task 4 sandbox note: `sandbox.ts` now exposes `writeConfig` and `createImportSourceDir` for parity scenario setup.
- Task 4 explorer note: `explorer.ts` now exposes `openAddAgent`, `openEditAgent`, `openRemoveAgent`, `openImport`, `openDoctor`, `typeText`, `backspace`, and `submitForm` for form-interaction PTY scenarios.
- Task 4 PTY note: form interactions in the PTY require ~150ms inter-key sleeps to avoid racing React state updates; ANSI-bolded header text such as "Skills for <agent>" can break simple substring matching when the agent name carries formatting codes, so dashboard confirmation should target plain text in the detail or skills pane.
- Task 4 scenario note: the full `npm test:tui-e2e` suite exhibits pre-existing PTY lock contention timeouts when many real-PTY tests run together; individual test runs all pass.
- The next step for this slice is Task 5: final tracking sync and root verification gate.
- A post-bulk-adopt npm release attempt has started for `skillmux@0.1.3`.
- Local release-prep verification for `0.1.3` passed in root with:
  - `npm run build`
  - `npm run test:tui-e2e`
  - `npm test`
  - `npm run typecheck`
  - `git diff --check`
  - `npm pack --dry-run`
- `npm view skillmux version` returned `0.1.2` before publish, so `0.1.3` is the next available patch version.
- The release was published as `skillmux@0.1.3`.
- Publish verification for `0.1.3`:
  - token-authenticated `npm whoami` returned `wodenjay`
  - `npm publish --access public` returned `+ skillmux@0.1.3`
  - a fresh follow-up `npm view skillmux version` returned `0.1.3`
- The temporary npm userconfig used for publish was deleted immediately after publish/verification.


<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->
