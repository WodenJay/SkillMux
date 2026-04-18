# SkillMux

<p align="center">
  <img src="assets/logo.png" alt="SkillMux logo" width="280" />
</p>

SkillMux 是一个用来管理本地 agent skills 的命令行工具。

很多 skills 会通过 `skills.sh` 一类的方式安装到多个 agent 目录里，例如 `.codex/skills`、`.claude/skills`、`.gemini/skills`。这些目录里通常不是多份独立文件，而是一份真实内容加上多处 symlink 或 junction。手动管理这些链接很麻烦，也容易弄乱。

SkillMux 的作用就是把这件事接管下来：把 skill 收拢到统一位置，然后按 agent 启用、停用、扫描和检查状态。它既适合人直接用，也适合把仓库链接发给 AI，让 AI 按文档自动安装和操作。

你可以继续把它交给 AI 使用，也可以用 `skillmux tui` 在终端里直接查看和管理某个 agent 的 skills。后续如果需要，还可以继续扩展 web 等界面。

## 适合谁

如果你符合下面任意一种情况，SkillMux 就适合你：

- 你已经用过 `skills.sh` 或类似方式安装 skills
- 你同时在用 Codex、Claude、Gemini 等多个 agent
- 你想让某个 skill 只对部分 agent 可见
- 你不想每次停用后再重新下载同一个 skill
- 你想把本地 skills 管理得更清楚，方便自己或 AI 代管

## 和 `npx skills` 的分工

`npx skills` / `skills.sh` 负责从远端下载和安装 skill。SkillMux 不重复做远端安装器，它负责管理已经在本地出现的 skills。

推荐流程是：

```bash
npx skills add https://github.com/vercel-labs/skills --skill find-skills
skillmux scan
skillmux adopt --agent codex --skill find-skills
skillmux enable --skill find-skills --agent claude
```

也就是说，先用 `npx skills` 把 skill 放到本地，再用 SkillMux 接管、启用、停用、删除本地托管副本。

## 安装

全局安装：

```bash
npm install -g skillmux
```

安装后可直接查看帮助：

```bash
skillmux --help
```

卸载：

```bash
npm uninstall -g skillmux
```

这只会卸载 CLI，不会删除本地的 `~/.skillmux` 数据目录。

## SkillMux 会管理什么

SkillMux 默认把自己的数据放在：

```text
~/.skillmux/
  config.json
  manifest.json
  skills/
    <skill-id>/
```

含义如下：

- `config.json`：用户自定义的 agent 目录规则
- `manifest.json`：SkillMux 记录的托管状态
- `skills/<skill-id>/`：SkillMux 托管的真实 skill 内容

agent 目录里通常只保留指向这里的链接。

## 支持的 agent 目录

内置支持这些常见目录：

- `.codex/skills`
- `.claude/skills`
- `.gemini/skills`
- `.agents/skills`
- `.openclaw/skills`

如果你的环境不在这些目录里，也可以通过 `skillmux config add-agent` 注册自定义 agent。

## 快速开始

先看 SkillMux 找到了哪些 agent：

```bash
skillmux agents
```

如果你的 agent 不在内置列表里，先加进去：

```bash
skillmux config add-agent --id antigravity --root .gemini/antigravity --name "Gemini Antigravity"
```

如果之后不再需要这个自定义 agent 规则，也可以删掉：

```bash
skillmux config remove-agent --id antigravity
```

如果需要修改已有的自定义 agent 规则：

```bash
skillmux config update-agent --id antigravity --name "Gemini Antigravity"
```

扫描本地 skills 状态：

```bash
skillmux scan
```

把已经安装在某个 agent 目录里的 skill 纳入 SkillMux 托管：

```bash
skillmux adopt --agent codex --skill find-skills
```

把一个本地 skill 目录纳入 SkillMux 托管：

```bash
skillmux import --source C:\path\to\find-skills --name find-skills
```

给某个 agent 启用这个 skill：

```bash
skillmux enable --skill find-skills --agent codex
```

如果之后想让另一个 agent 看不到它：

```bash
skillmux disable --skill find-skills --agent claude
```

如果这个 skill 已经在所有 agent 里停用，并且不想再保留托管副本：

```bash
skillmux remove --skill find-skills
```

查看当前状态：

```bash
skillmux list --view skills
```

检查坏链、冲突目录和异常状态：

```bash
skillmux doctor
```

## 常用命令

### `skillmux agents`

查看当前识别到的 agent 目录。

```bash
skillmux agents
skillmux agents --json
```

### `skillmux scan`

扫描本地 agent skills 目录，并刷新 SkillMux 的扫描结果。

```bash
skillmux scan
skillmux scan --json
```

### `skillmux list`

查看当前状态。

```bash
skillmux list
skillmux list --view agents
skillmux list --view skills
skillmux list --view records --format json
```

### `skillmux adopt`

把已经安装在某个 agent skills 目录里的 skill 接管到 SkillMux 托管目录。

```bash
skillmux adopt --agent codex
skillmux adopt --agent codex --skill find-skills
skillmux adopt --agent codex --skill find-skills --json
```

说明：

- 不传 `--skill` 时，会尝试接管该 agent 目录下所有看起来像 skill 的条目
- 判断一个目录是否像 skill，主要看根目录下是否存在 `SKILL.md`
- 接管后会把真实内容复制到 `~/.skillmux/skills/<skill-id>/`
- agent 侧会变成指向 SkillMux 托管目录的链接

### `skillmux import`

把一个已经存在于本地的 skill 导入 SkillMux 托管目录。

```bash
skillmux import --source C:\path\to\find-skills --name find-skills
```

要求：

- `--source` 必须指向一个本地 skill 目录
- 目录根下必须有 `SKILL.md`
- 导入时会复制到 SkillMux 托管目录，不会删除原目录

### `skillmux enable`

把某个托管 skill 暴露给指定 agent。

```bash
skillmux enable --skill find-skills --agent codex
skillmux enable --skill find-skills --agent claude
```

也可以一次启用到多个 agent：

```bash
skillmux enable --skill find-skills --agent codex --agent claude
```

### `skillmux disable`

把某个托管 skill 从指定 agent 目录中移除。

```bash
skillmux disable --skill find-skills --agent codex
```

也可以一次从多个 agent 停用：

```bash
skillmux disable --skill find-skills --agent codex --agent claude
```

如果第一次停用时遇到 `skills.sh` 生成的外部链接，并且目标目录里有 `SKILL.md`，SkillMux 会先把它接管到托管目录，再完成停用。

### `skillmux remove`

删除一个已经停用的托管 skill。

```bash
skillmux remove --skill find-skills
skillmux remove --skill find-skills --json
```

说明：

- `remove` 只删除 SkillMux 托管目录里的本地副本和 manifest 记录
- 如果这个 skill 仍然对任何 agent 启用，`remove` 会拒绝执行
- 如果要删除多个已经停用的 skills，可以重复传 `--skill`

```bash
skillmux remove --skill old-skill --skill unused-skill
```

### `skillmux doctor`

检查异常状态，例如：

- 坏链
- 托管目录缺失
- 看起来像 skill 但未被托管的目录
- 多个 agent 指向同一个 skills 目录

```bash
skillmux doctor
skillmux doctor --json
```

### `skillmux config`

查看 SkillMux 解析到的配置和用户覆盖规则。

```bash
skillmux config
skillmux config --json
```

### `skillmux config add-agent`

添加或覆盖一个自定义 agent 规则。

```bash
skillmux config add-agent --id antigravity --root .gemini/antigravity
skillmux config add-agent --id antigravity --root .gemini/antigravity --name "Gemini Antigravity"
skillmux config add-agent --id antigravity --root .gemini/antigravity --skills skills
skillmux config add-agent --id antigravity --root .gemini/antigravity --platform win32 --platform linux
skillmux config add-agent --id antigravity --root .gemini/antigravity --disabled-by-default
```

说明：

- `--id` 是 agent 的唯一标识
- `--root` 是相对用户 home 的根目录
- `--skills` 默认是 `skills`
- `--platform` 不传时默认写入当前平台
- `--disabled-by-default` 会把该自定义 agent 标记为默认不启用

### `skillmux config update-agent`

更新一个已经存在的自定义 agent 规则。

```bash
skillmux config update-agent --id antigravity --name "Gemini Antigravity"
skillmux config update-agent --id antigravity --root .gemini/antigravity
skillmux config update-agent --id antigravity --skills skills
skillmux config update-agent --id antigravity --platform win32 --platform linux
skillmux config update-agent --id antigravity --enabled-by-default
skillmux config update-agent --id antigravity --disabled-by-default
skillmux config update-agent --id antigravity --json
```

说明：

- 只会更新已有的自定义 agent override
- 不传的字段会保持原值
- 如果要新增 agent，请继续使用 `skillmux config add-agent`

### `skillmux config remove-agent`

删除一个自定义 agent 规则。

```bash
skillmux config remove-agent --id antigravity
skillmux config remove-agent --id antigravity --json
```

说明：

- 只会删除 `~/.skillmux/config.json` 里的该 agent override
- 不会删除 `manifest.json`
- 不会删除任何本地 skill、symlink 或 junction

## 常用批量写法

这些命令支持通过重复参数处理常见批量操作：

```bash
skillmux enable --skill find-skills --agent codex --agent claude
skillmux disable --skill find-skills --agent codex --agent claude
skillmux adopt --agent codex --skill find-skills --skill ui-ux-pro-max
skillmux remove --skill old-skill --skill unused-skill
```

批量操作仍然按单个操作的安全规则执行。如果中途失败，SkillMux 会报告已经完成的项目，方便你继续处理。

## 一个典型流程

如果 skill 已经通过 `npx skills` / `skills.sh` 安装到了某个 agent 目录，可以这样接管：

```bash
npx skills add https://github.com/vercel-labs/skills --skill find-skills
skillmux agents
skillmux scan
skillmux adopt --agent codex --skill find-skills
skillmux enable --skill find-skills --agent antigravity
skillmux list --view skills
skillmux disable --skill find-skills --agent antigravity
skillmux doctor
```

如果你手里已经有一个本地 skill 目录，可以继续使用 `import`：

```bash
skillmux agents
skillmux config add-agent --id antigravity --root .gemini/antigravity
skillmux scan
skillmux import --source C:\skills\find-skills --name find-skills
skillmux enable --skill find-skills --agent codex
skillmux enable --skill find-skills --agent antigravity
skillmux list --view skills
skillmux disable --skill find-skills --agent antigravity
skillmux doctor
```

## 使用注意

- `scan`、`import`、`enable`、`disable`、`adopt`、`remove` 和 `config` 的写入类子命令会直接修改本地状态
- `disable` 只会移除受管链接，不会盲删普通目录
- `remove` 只会删除已经停用的托管 skill
- `import` 不会删除原始 skill 目录
- Windows 下目录链接使用 junction 语义
- 如果你手动改过 agent 目录，建议重新执行一次 `skillmux scan`

## 给 AI 使用时的建议

如果你把这个仓库链接发给 AI，让它帮你安装和使用 SkillMux，最有用的信息就是这几件事：

- 安装命令是 `npm install -g skillmux`
- 远端安装继续使用 `npx skills` / `skills.sh`
- 查看环境先用 `skillmux agents` 和 `skillmux scan`
- 自定义 agent 入口用 `skillmux config add-agent`
- 修改自定义 agent 入口用 `skillmux config update-agent`
- 删除自定义 agent 入口用 `skillmux config remove-agent`
- 把已经安装在 agent 目录里的 skill 纳入管理用 `skillmux adopt`
- 把本地 skill 目录纳入管理用 `skillmux import`
- 控制某个 skill 对哪些 agent 可见，用 `skillmux enable` 和 `skillmux disable`
- 删除已经停用的托管 skill 用 `skillmux remove`
- 检查异常状态用 `skillmux doctor`

## 交互式看板

如果你想一次只看一个 agent，并直接管理它能看到的 skills，可以运行：

```bash
skillmux tui
```

这个界面适合在交互式终端里使用。它会显示当前选中的 agent，以及这个 agent 能看到的 skills，并允许你直接做常见管理操作。

- `Space` 启用或停用当前选中的已托管 skill。
- `a` 在确认后接管一个未托管 skill。
- `r` 在确认后移除一个已停用的已托管 skill。
- `s` 扫描本地 agent 文件夹并刷新看板。
- `/` 在当前聚焦的列表里搜索。
- `?` 打开帮助。
- `q` 退出界面。

如果输出是脚本重定向，或者当前终端不是交互式终端，请改用 `skillmux list`、`skillmux scan` 或 `skillmux doctor`。
