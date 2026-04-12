# PROJECT_STATUS.md

记录当前项目的总进度总览

## 当前状态

- 阶段：implementation execution
- 仓库状态：主目录已同步通过验收的 Task 1、Task 2、Task 3 与 Task 4 代码
- worktree 状态：canonical worktree 已重建并同步到 Task 4 accepted state
- 已确认方向：
  - 先做 CLI，不做 GUI
  - 通过 npm 分发
  - 首批目标平台为 Windows / Linux / macOS
  - `v0` 只管理本地已安装 skills，不负责远端下载/更新
  - `v0` 直接修改本地环境，负责启用/停用所需的真实文件系统操作
  - `v0` 需要覆盖尽可能多的 agent，并自动识别正确目录
  - agent 目录发现采用“内置规则 + 用户配置覆盖”，规则来源可参考 `npx skills add` 的安装覆盖面
  - 停用策略优先采用“SkillMux 托管真实 skill 内容，agent 侧只保留链接状态”
  - 核心能力围绕 skills 的安装、启用、停用、更新、按 agent/skill 维度管理

## 本轮目标

- 澄清 SkillMux 的管理边界与核心工作流
- 产出第一版产品方案候选
- 为后续设计文档和实现计划做准备

## 最新进展

- 已确认 `v0` 产品边界与推荐方案
- 已完成正式设计文档初稿
- 用户已确认 spec
- 已完成 implementation plan 初稿
- 用户已选择 `Subagent-Driven` 执行方式
- 已建立 canonical worktree `.worktrees/task1-bootstrap-cli`
- 已完成并验收 Task 1：bootstrap CLI workspace
- 主目录已同步 Task 1 稳定代码
- Task 1 验证结果：
  - `npm test -- tests/smoke/cli-smoke.test.ts` 通过
  - `npm run typecheck` 通过
  - `npm run build` 通过
- 已完成并验收 Task 2：define manifest schema and domain types
- 主目录已同步 Task 2 稳定代码
- Task 2 验证结果：
  - `npm test -- --run tests/manifest/manifest-schema.test.ts` 通过
  - `npm run typecheck` 通过
  - `npm run build` 通过
- 已完成并验收 Task 3：implement manifest read and write persistence
- 主目录已同步 Task 3 稳定代码
- Task 3 验证结果：
  - `npm test` 通过
  - `npm run typecheck` 通过
  - `npm run build` 通过
- Task 3 结果摘要：
  - 新增 `readManifest` / `writeManifest`
  - 缺失 manifest 时会自动创建并持久化空状态
  - 读取时会拒绝 `skillmuxHome` 漂移的 manifest
  - 写入时改为使用唯一临时文件路径，避免同毫秒 temp-file 冲突
- 已完成并验收 Task 4：add path resolution and agent discovery rules
- 主目录已同步 Task 4 稳定代码
- Task 4 验证结果：
  - `npm test -- --run tests/discovery/discover-agents.test.ts` 通过
  - `npm test` 通过
  - `npm run typecheck` 通过
  - `npm run build` 通过
- Task 4 结果摘要：
  - 新增 `resolveSkillmuxHome`，统一将 SkillMux 托管目录解析为 `<user-home>/.skillmux`
  - 新增 `<skillmux-home>/config.json` 加载逻辑，并支持内置 agent 规则的用户覆盖
  - 新增 `discoverAgents`，按用户 home 解析 agent 目录，并返回绝对路径、存在状态与平台支持状态
  - discovery 测试补齐了所有内置 agent 的路径断言，并覆盖了 `constructor` 这类原型链键名的自定义 agent 回归场景
- 下一步进入 Task 5：Add Filesystem Safety And Link Operations
