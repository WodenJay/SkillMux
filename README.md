# SkillMux

SkillMux 是一个用于管理本地 agent skills 的 CLI 工具。

它解决的是 `skills.sh` 这一类安装方式带来的管理问题：同一个 skill 的真实内容通常只有一份，但会通过 symlink 或 junction 暴露到多个 agent 目录里，比如 `.codex/skills`、`.claude/skills`、`.gemini/skills`。一旦你想精细地控制“哪个 agent 能看到哪个 skill”，手动操作这些目录会很麻烦，也容易弄乱。

SkillMux 的目标是把这些零散的本地 skills 收拢到一个统一的托管目录里，然后按 agent 或按 skill 来启用、停用和检查状态。

## `v0` 做什么

`v0` 是一个本地优先的 CLI 版本，当前能力是：

- 管理本地已经存在的 skills
- 把 skill 导入 SkillMux 自己的托管目录
- 按 agent 启用或停用某个 skill
- 扫描本地 agent skills 目录并输出状态
- 检查坏链、冲突目录和异常状态

`v0` 目前 **不负责**：

- 从远端仓库下载 skill
- 更新远端 skill
- 图形界面

## 适用场景

如果你有下面这些需求，SkillMux 就是为它设计的：

- 你已经通过 `skills.sh` 或类似方式装过一些 skills
- 这些 skills 分散在多个 agent 目录里
- 你想临时让某个 agent 看不到某个 skill，而不是重新下载或手动删目录
- 你想把 skill 的真实内容统一收拢，避免本地目录越来越乱

## 支持的内置 agent 目录

`v0` 内置支持这些 skills 目录：

- `.codex/skills`
- `.claude/skills`
- `.gemini/skills`
- `.agents/skills`
- `.openclaw/skills`

另外也支持通过 `~/.skillmux/config.json` 自定义或覆盖 agent 规则。

## 安装

全局安装：

```bash
npm install -g skillmux
```

安装完成后可直接使用：

```bash
skillmux --help
```

## 卸载

如果你需要频繁安装和测试，直接卸载 npm 全局包即可：

```bash
npm uninstall -g skillmux
```

这只会卸载 CLI 本身，不会自动删除你本地的 `~/.skillmux` 数据目录。

## 本地开发

如果你是在仓库里本地开发或调试：

```bash
npm install
npm run build
npm test
npm run typecheck
```

构建后 CLI 入口是：

```text
dist/cli.js
```

## SkillMux 的本地目录结构

SkillMux 默认把自己的数据放在：

```text
~/.skillmux/
  config.json
  manifest.json
  skills/
    <skill-id>/
```

含义如下：

- `config.json`
  用户自定义的 agent 发现规则
- `manifest.json`
  SkillMux 的状态清单，记录托管 skill、agent、activation 和最近一次扫描结果
- `skills/<skill-id>/`
  SkillMux 托管的真实 skill 内容

agent 目录里通常只保留指向这里的链接。

## 命令

### `skillmux agents`

查看当前识别到的 agent 目录。

```bash
skillmux agents
skillmux agents --json
```

### `skillmux scan`

扫描本地 agent skills 目录，并刷新 manifest 中的扫描结果。

```bash
skillmux scan
skillmux scan --json
```

### `skillmux list`

查看当前扫描到的记录，可以按原始记录、按 agent、或按 skill 聚合。

```bash
skillmux list
skillmux list --view agents
skillmux list --view skills
skillmux list --view records --format json
```

### `skillmux import`

把一个本地 skill 导入 SkillMux 的托管目录。

```bash
skillmux import --source /path/to/find-skills --name find-skills
```

Windows 示例：

```bash
skillmux import --source C:\path\to\find-skills --name find-skills
```

说明：

- `--source` 指向本地已有的 skill 目录
- 目录根下需要有 `SKILL.md`
- `v0` 默认是复制，不会删除原目录

### `skillmux enable`

把某个托管 skill 暴露给指定 agent。

```bash
skillmux enable --skill find-skills --agent codex
skillmux enable --skill find-skills --agent claude
```

### `skillmux disable`

把某个托管 skill 从指定 agent 目录里移除。

```bash
skillmux disable --skill find-skills --agent codex
```

### `skillmux doctor`

检查异常状态，例如：

- 坏链
- 托管 skill 路径丢失
- 看起来像 skill 的未托管目录
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

## 推荐使用流程

第一次使用时，推荐按这个顺序：

1. 先运行 `skillmux agents`，确认发现了哪些 agent 目录
2. 运行 `skillmux scan`，查看当前本地 skills 状态
3. 用 `skillmux import` 把想长期管理的 skill 导入托管目录
4. 用 `skillmux enable` 给需要的 agent 启用
5. 用 `skillmux disable` 从不需要的 agent 上停用
6. 用 `skillmux doctor` 检查本地状态是否健康

## 示例

```bash
skillmux agents
skillmux scan
skillmux import --source C:\skills\find-skills --name find-skills
skillmux enable --skill find-skills --agent codex
skillmux enable --skill find-skills --agent claude
skillmux list --view skills
skillmux disable --skill find-skills --agent claude
skillmux doctor
```

## 使用注意

- `scan`、`import`、`enable`、`disable` 都会直接修改本地环境或本地状态
- `disable` 只会移除受管链接，不会盲删普通目录
- `import` 不会删除原始 skill 源目录
- Windows 下目录链接使用 junction 语义
- 如果你手动改过 agent 目录，建议重新运行一次 `scan`

## 当前限制

`v0` 还没有这些能力：

- 远端安装和更新
- `remove` / `uninstall` 某个已托管 skill
- 图形界面

如果你只需要稳定地管理本地已有 skills，`v0` 已经够用。
