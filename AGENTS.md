# SkillMux (UTF-8) (只读，禁止修改)

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
- Use 'bd' for task tracking(使用方法见`beads.md`)
- 当前开发环境是windows，使用的是PowerShell，不支持`&&`，因此使用命令的时候请不要使用`&&`。
