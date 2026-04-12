# DECISIONS.md

记录关键决策与原因，避免后续忘记为什么这样做。

## 2026-04-12

### 决策：第一阶段产品形态为 CLI

- 原因：
  - 先压缩范围，降低实现成本
  - CLI 更适合 AI/Agent 直接调用
  - 先验证核心管理模型，再决定是否需要图形界面

### 决策：分发方式优先采用 npm

- 原因：
  - 便于跨平台分发
  - 用户安装路径更统一
  - 更容易接入现有 Node.js / agent 工作流

### 决策：`v0` 只管理本地已安装 skills

- 原因：
  - 降低第一阶段复杂度
  - 先解决多 agent / 多目录 / symlink 可见性管理这个核心痛点
  - 将远端下载、更新、版本同步留到下一阶段

### 决策：`v0` 直接修改本地环境

- 原因：
  - 用户目标是减少手工操作，而不是只查看状态
  - 只有真正接管目录和链接操作，才能提供一键管理体验

### 决策：agent 目录发现采用“内置规则 + 用户配置覆盖”

- 原因：
  - 纯自动猜测风险高，容易误改用户环境
  - 可参考 `npx skills add` 已覆盖的 agent 目录集合
  - 用户覆盖能兼顾稳定性与扩展性

### 决策：停用 skill 时由 SkillMux 托管真实内容

- 原因：
  - 让 SkillMux 成为 skills 资产的统一管理层
  - 避免继续依赖散落在用户环境中的原始路径
  - 后续重新启用、迁移 agent、做一致性检查都会更简单

### 决策：`v0` 采用“受管资产库”方案

- 原因：
  - 比轻量索引器更稳定
  - 比完整事务系统更轻，适合第一阶段落地
  - 一份真实 skill 内容，多 agent 通过链接引用，符合当前问题结构

### 决策：`v0` 的第一批命令为 `scan / list / import / enable / disable / agents / doctor / config`

- 原因：
  - 这组命令覆盖最小可用闭环
  - 先解决扫描、托管、启停、校验四类核心问题
  - 为后续增加 `update`、`install`、`sync` 留出空间

### 决策：SkillMux 托管目录固定解析为 `<user-home>/.skillmux`

- 原因：
  - `config.json`、manifest 与受管技能仓库都属于 SkillMux 自身状态
  - 固定放在用户 home 下的隐藏目录，跨平台更稳定
  - 后续如需扩展环境变量或 CLI override，会更容易保持向后兼容

### 决策：agent discovery 一律以用户 home 为根解析

- 原因：
  - `.codex`、`.claude`、`.gemini` 等目录属于用户环境，不属于 SkillMux 托管仓库
  - 如果 discovery 错挂到 `skillmuxHome` 下，会导致扫描、导入和启停都操作错误路径

### 决策：manifest contract 在 Task 2 就收紧到可维护一致性的级别

- 原因：
  - 允许非法 ID、缺失引用、重复 activation，会把问题拖到行为层
  - 提前在 schema 层拒绝不一致状态，可以降低后续命令复杂度

### 决策：Task 3 读取 manifest 时额外校验 `skillmuxHome`

- 原因：
  - 仅靠 schema 无法阻止 manifest 被移动或复制后的路径漂移
  - 尽早拒绝错误状态，能把问题限制在最小范围内

### 决策：Task 3 写入 manifest 时使用唯一 temp-file 名称

- 原因：
  - `process.pid + Date.now()` 在同进程同毫秒内不保证唯一
  - manifest 写入是所有后续命令的公共基础，不能保留这种低概率竞争

### 决策：Task 5 的路径包含判断必须显式处理 Windows 盘符边界

- 原因：
  - 只靠 `path.relative()` 会把跨盘符路径误判为“在目录内”
  - 这会直接影响受管链接识别和复制目标保护
  - 因此需要先比较根路径/盘符，再判断相对路径是否越界

### 决策：Task 5 的文件系统写入必须拒绝 symlink 或 junction 祖先目录

- 原因：
  - 只检查叶子路径不够，`mkdir(..., { recursive: true })` 会沿着已存在的 symlink/junction 继续写入
  - 对 SkillMux 这种直接改本地环境的工具，这是实质性的越界风险
  - 因此链接创建和受管复制都要在写入前检查祖先链路
