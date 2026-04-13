# SkillMux

SkillMux 是一个用来管理本地 agent skills 的命令行工具。

很多 skills 会通过 `skills.sh` 一类的方式安装到多个 agent 目录里，例如 `.codex/skills`、`.claude/skills`、`.gemini/skills`。这些目录里通常不是多份独立文件，而是一份真实内容加上多处 symlink 或 junction。手动管理这些链接很麻烦，也容易弄乱。

SkillMux 的作用就是把这件事接管下来：把 skill 收拢到统一位置，然后按 agent 启用、停用、扫描和检查状态。它既适合人直接用，也适合把仓库链接发给 AI，让 AI 按文档自动安装和操作。

## 适合谁

如果你符合下面任意一种情况，SkillMux 就适合你：

- 你已经用过 `skills.sh` 或类似方式安装 skills
- 你同时在用 Codex、Claude、Gemini 等多个 agent
- 你想让某个 skill 只对部分 agent 可见
- 你不想每次停用后再重新下载同一个 skill
- 你想把本地 skills 管理得更清楚，方便自己或 AI 代管

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

扫描本地 skills 状态：

```bash
skillmux scan
```

把一个本地 skill 纳入 SkillMux 托管：

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

### `skillmux disable`

把某个托管 skill 从指定 agent 目录中移除。

```bash
skillmux disable --skill find-skills --agent codex
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

## 一个典型流程

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

- `scan`、`import`、`enable`、`disable` 会直接修改本地状态
- `disable` 只会移除受管链接，不会盲删普通目录
- `import` 不会删除原始 skill 目录
- Windows 下目录链接使用 junction 语义
- 如果你手动改过 agent 目录，建议重新执行一次 `skillmux scan`

## 给 AI 使用时的建议

如果你把这个仓库链接发给 AI，让它帮你安装和使用 SkillMux，最有用的信息就是这几件事：

- 安装命令是 `npm install -g skillmux`
- 查看环境先用 `skillmux agents` 和 `skillmux scan`
- 自定义 agent 入口用 `skillmux config add-agent`
- 把本地 skill 纳入管理用 `skillmux import`
- 控制某个 skill 对哪些 agent 可见，用 `skillmux enable` 和 `skillmux disable`
- 检查异常状态用 `skillmux doctor`
