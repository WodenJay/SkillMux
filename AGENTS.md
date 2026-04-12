# SkillMux

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
- 合理使用skills，如果还没有安装合适的skills，你可以通过`find-skills`这个技能来查找适合的技能。
- 有一些命令在sandbox里面运行不了，直接找我提权
- 合理使用subagent，想想你自己是一个leader，把可切分的任务分配给subagent，自己专注于管理和协调，以避免上下文过长。
- 当前目录才是主目录！把稳定版代码放到当前目录！.worktrees只是作为开发时期使用的
- 当一个比较大的任务完成时，停下来提醒我`/compact`，以压缩上下文，避免后续的上下文过长导致性能问题。但你要整理好下一步需要做什么，避免compact后忘记了下一步要做什么。

## Current Direction

- 当前优先目标是先做一个**CLI 工具**，暂不做图形界面。
- 分发方式优先采用 **npm 包**，目标支持 Windows / Linux / macOS。
- `v0` 只管理本地已安装 skills，不负责远端下载/更新。
- 工具需要同时支持：
  - 以 **agent** 为中心管理 skills
  - 以 **skill** 为中心管理其在不同 agent 中的启用状态
- 需要正确处理 `skills.sh` 安装模式下“单份 skill 内容 + 多处 symlink 引用”的情况。
- `v0` 需要**直接修改本地环境**，自动完成启用/停用所需的目录与 symlink 操作，而不是只输出建议命令。
- 需要尽可能覆盖常见 agent（如 `.gemini`、`.codex`、`.claude`、`.agents`、`.openclaw` 等），并尽量自动找对目录。
- agent 目录发现优先采用“**内置常见规则 + 用户配置覆盖**”的方式，并可参考 `npx skills add <owner/repo>` 已支持的安装目录集合。
- 停用 skill 时，SkillMux 优先将真实 skill 内容收拢到自己托管的本地仓库中；agent 侧只保留或移除可重建的链接状态。
- 当前开发环境是windows，使用的是PowerShell。

## Execution Notes

- 实现阶段只维护一个 **canonical worktree** 作为主执行目录；其他子代理产生的临时工作副本只作为中间产物，不作为最终事实来源。
- 当前 canonical worktree 为 `.worktrees/task1-bootstrap-cli`。
- 主目录 `C:\Users\wudon\Desktop\SkillMux\` 是稳定版与最终交付区；canonical worktree 用于开发执行，主目录文档必须及时同步。
- 子代理产出的代码只有在主目录完成验证后，才算 accepted state。
