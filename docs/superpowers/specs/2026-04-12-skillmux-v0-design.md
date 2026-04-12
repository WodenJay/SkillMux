# SkillMux v0 Design

## Summary

SkillMux 是一个通过 npm 分发的跨平台 CLI，用来统一管理本地已经安装的 skills。  
`v0` 不负责从远端下载或更新 skill；它只管理本地已有 skill 的归档、启用、停用、扫描和校验。

SkillMux 的核心目标是解决一个具体问题：skills 会散落在多个 agent 目录中，例如 `.codex`、`.claude`、`.gemini`、`.agents`、`.openclaw`。用户要按 agent 或按 skill 精细管理启用状态时，手工操作目录和 symlink 很容易出错，也很难恢复。SkillMux 要接管这层文件系统操作。

## Goals

- 提供一个 CLI，统一查看和管理不同 agent 下的 skills
- 让用户可以按 agent 视角和按 skill 视角操作
- 直接修改本地环境，自动处理 symlink、目录创建、停用和恢复
- 将真实 skill 内容收拢到 SkillMux 自己的托管仓库
- 尽可能覆盖 `npx skills add` 已支持的常见 agent 目录
- 保证跨平台可用，首批支持 Windows、Linux、macOS
- 为后续的远端安装、更新和同步能力预留扩展点

## Non-Goals

- `v0` 不负责从 GitHub 或 `skills.sh` 下载 skill
- `v0` 不负责远端版本检查和自动更新
- `v0` 不提供图形界面
- `v0` 不尝试支持所有未知 agent；未知 agent 通过配置扩展

## Product Approach

`v0` 采用“受管资产库”方案。

SkillMux 在本地维护一份自己的托管仓库，保存每个 skill 的真实内容。各 agent 目录中不再把这些 skill 当作独立副本管理，而是通过 symlink 或平台等价机制链接到 SkillMux 托管仓库中的真实目录。

这个方案有三个直接好处：

- 模型简单。一份真实内容，多个 agent 引用。
- 恢复容易。某个 agent 停用 skill 时，只需要移除该 agent 下的链接。
- 后续可扩展。以后做远端安装、升级、迁移时，不需要先推翻本地模型。

## Core Concepts

### Managed Skill

SkillMux 托管的一份真实 skill 内容。它有稳定 ID、显示名、来源信息和本地存储路径。

### Agent Registry

SkillMux 识别到的 agent 集合。每个 agent 记录名字、平台路径规则、skills 目录路径、是否存在、自定义来源等信息。

### Activation

某个 skill 是否对某个 agent 可见。对用户来说，这就是“启用”或“停用”；对实现来说，这通常对应 agent skills 目录中是否存在有效链接。

### Manifest

SkillMux 自己维护的状态文件，用来记录托管 skill、agent 注册信息、激活关系、上次扫描结果和异常状态。

## User Workflows

### 1. 扫描现有环境

用户执行 `skillmux scan`。

SkillMux 会：

- 按内置规则寻找常见 agent 目录
- 应用用户配置中的额外目录或覆盖规则
- 识别每个 agent 的 skills 目录
- 枚举其中的目录、symlink、坏链和未知内容
- 将结果写入 manifest
- 输出摘要和异常项

### 2. 导入已有 skill

用户执行 `skillmux import`，把现有环境中的 skill 纳入 SkillMux 托管。

SkillMux 会：

- 识别某个 skill 的真实内容路径
- 将其复制或移动到 SkillMux 托管仓库
- 为已启用的 agent 重建到托管仓库的链接
- 更新 manifest

`v0` 应优先支持保守导入。遇到复杂情况时，宁可拒绝并提示，也不要猜测删除真实目录。

### 3. 启用 skill

用户执行 `skillmux enable <skill> --agent <agent>`。

SkillMux 会：

- 校验该 skill 已被托管
- 校验目标 agent 已识别且目录有效
- 在 agent 对应的 skills 目录中创建链接
- 写入 manifest

如果链接已存在且目标正确，命令应保持幂等并直接成功。

### 4. 停用 skill

用户执行 `skillmux disable <skill> --agent <agent>`。

SkillMux 会：

- 只移除该 agent 下的链接
- 不删除 SkillMux 托管仓库中的真实内容
- 更新 manifest

如果目标本来就未启用，命令应保持幂等并直接成功。

### 5. 校验环境

用户执行 `skillmux doctor`。

SkillMux 会检查：

- manifest 中记录的 skill 路径是否存在
- agent 侧链接是否仍然有效
- 是否存在坏链
- 是否存在未托管但看起来像 skill 的目录
- 是否存在命名冲突或重复托管

## CLI Surface

建议 `v0` 先提供以下命令：

- `skillmux scan`
- `skillmux list`
- `skillmux list --agent <name>`
- `skillmux list --skill <name>`
- `skillmux import`
- `skillmux enable <skill> --agent <name>`
- `skillmux disable <skill> --agent <name>`
- `skillmux agents`
- `skillmux doctor`
- `skillmux config`

建议大部分命令都支持：

- `--json`，方便 AI 和脚本调用
- `--dry-run`，先展示计划再执行
- `--verbose`，输出路径与决策细节

## Storage Layout

建议 SkillMux 使用独立的用户级数据目录。

示例结构：

```text
<skillmux-home>/
  manifest.json
  skills/
    <skill-id>/
      ...skill files
  logs/
  backups/
  config.json
```

平台上可优先采用系统惯例目录；如果实现成本过高，`v0` 也可以先统一使用用户 home 下固定目录，再在后续版本细化。

## Agent Discovery

目录发现采用“内置规则 + 用户配置覆盖”。

### Built-in Rules

SkillMux 内置一批常见 agent 目录规则，优先参考 `npx skills add` 已覆盖的目录集合。每条规则至少包含：

- agent 名称
- 可能的根目录
- skills 子目录位置
- 平台差异说明
- 检测条件

### User Overrides

用户可以在配置中：

- 新增一个自定义 agent
- 覆盖某个内置 agent 的路径
- 禁用某个内置 agent 的自动发现

### Discovery Principle

发现逻辑必须保守。  
找不到目录时，不报错退出；误判目录时，后果更严重。  
因此 `v0` 应优先做到“少误判”，而不是“多猜中”。

## Filesystem Strategy

### Preferred Link Type

在支持 symlink 的平台上，优先使用 symlink。  
如果某些平台或权限环境中 symlink 不稳定，需要评估是否回退到 junction 或等价机制；这部分应由实现层封装，不暴露给命令层。

### Safety Rules

- 不删除不属于 SkillMux 托管仓库的真实 skill 内容
- 遇到普通目录时，不把它当成可直接删除的链接
- 修改前先校验目标路径和链接目标
- 提供 `--dry-run` 预演执行计划
- 关键操作前写入备份或操作日志

## Manifest Model

`manifest.json` 建议至少包含：

```json
{
  "version": 1,
  "skillmuxHome": "<path>",
  "skills": {},
  "agents": {},
  "activations": [],
  "lastScan": {
    "at": "<iso-datetime>",
    "issues": []
  }
}
```

其中：

- `skills` 记录 skill ID、显示名、本地路径、来源信息、导入时间
- `agents` 记录 agent 名称、路径、发现方式、可用性
- `activations` 记录 skill-agent 关系和链接状态
- `lastScan.issues` 记录坏链、冲突、未知目录等问题

## Error Handling

### Command Errors

- 目标 agent 未找到
- 目标 skill 未托管
- 链接已存在但指向错误目标
- 目标路径缺少权限
- manifest 损坏或版本不兼容

### Recovery Rules

- 对幂等操作返回成功，并说明当前状态
- 对高风险场景停止执行，并给出明确修复建议
- 对部分成功的批量操作记录成功项与失败项

## Testing Strategy

`v0` 需要优先覆盖这些测试：

- agent 目录发现规则测试
- manifest 读写测试
- 启用/停用幂等测试
- 导入已有 skill 的迁移测试
- 坏链与未知目录的 doctor 测试
- Windows / Unix 路径差异测试

还需要做一组端到端测试，在临时目录中模拟：

- 多 agent
- 单 skill 被多个 agent 引用
- 普通目录、symlink、坏链混合存在
- manifest 丢失后重新扫描

## Open Questions For Planning

这些问题不阻塞 `v0` 设计方向，但会影响实现计划：

- Windows 下优先使用 symlink 还是 junction
- `import` 默认采用复制还是移动
- `skill-id` 的生成规则是否基于目录名、来源信息或内容指纹
- `config.json` 的位置和格式
- CLI 框架选型与打包方式

## Recommendation

`v0` 按“受管资产库”方案推进。

先把最小闭环做完整：

- 扫描现有 agent 环境
- 导入已有 skill
- 启用某个 skill 到某个 agent
- 停用某个 skill
- 校验和修复常见异常

只要这条链路稳定，SkillMux 就已经解决了最核心的手工管理问题。远端安装、更新和同步应放到下一阶段。
