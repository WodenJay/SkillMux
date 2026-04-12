# PROJECT_STATUS.md

记录当前项目的总进度总览。

## 当前状态

- 阶段：implementation execution
- 主目录状态：已接受并提交 Task 1、Task 2、Task 3、Task 4、Task 5 的稳定代码
- 主目录最新稳定代码提交：
  - `2f88f26` `chore: bootstrap skillmux cli workspace`
  - `cc7fc7f` `feat: define manifest schema and domain types`
  - `228cc24` `feat: add manifest persistence`
  - `abaf9c6` `feat: add agent discovery and config loading`
  - `84ea69c` `feat: add filesystem safety and link helpers`
- canonical worktree：`.worktrees/task1-bootstrap-cli`
- 当前方向：
  - 先做 CLI，不做 GUI
  - 通过 npm 分发
  - 目标支持 Windows / Linux / macOS
  - `v0` 只管理本地已安装 skills，不负责远端下载/更新
  - `v0` 直接修改本地环境
  - agent 目录发现采用“内置规则 + 用户配置覆盖”
  - 停用策略优先采用“SkillMux 托管真实 skill 内容，agent 侧只保留链接状态”

## 已完成任务

### Task 1：Bootstrap CLI Workspace

- 新增基础 CLI 脚手架、`package.json`、`tsconfig.json`、`tsup.config.ts`、`vitest.config.ts`
- 新增 smoke test，确认 `scan` 命令已注册

### Task 2：Manifest Schema And Domain Types

- 新增核心类型、ID 规则、manifest schema 与空 manifest builder
- 在 schema 层收紧 ID、引用关系与 activation 一致性约束

### Task 3：Manifest Persistence

- 新增 `readManifest` / `writeManifest`
- 缺失 manifest 时自动创建空状态
- 读取时拒绝 `skillmuxHome` 漂移
- 写入时使用唯一临时文件路径，避免 temp-file 冲突

### Task 4：Agent Discovery And Config Loading

- 新增 `resolveSkillmuxHome`
- 新增 `<skillmux-home>/config.json` 加载逻辑
- 新增 built-in agent rules 与用户覆盖
- 新增 `discoverAgents`
- 覆盖 `.codex`、`.claude`、`.gemini`、`.agents`、`.openclaw`

### Task 5：Filesystem Safety And Link Operations

- 新增 `src/fs/path-utils.ts`
- 新增 `src/fs/link-ops.ts`
- 新增 `src/fs/safe-copy.ts`
- 新增 `src/fs/safe-remove-link.ts`
- 新增 `tests/fs/link-ops.test.ts`
- Task 5 结果摘要：
  - 新增绝对路径归一化、路径相等比较、路径包含判断
  - 新增受管目录链接创建与受管目标识别
  - 新增“只删链接、不删普通目录”的安全移除逻辑
  - 新增保守的目录复制逻辑，拒绝复制源中的 symlink
  - 补上 Windows 跨盘符、`..hidden` 合法子路径、以及 symlink/junction 祖先逃逸的回归测试

## 最新验证

Task 5 在主目录 fresh 通过：

- `npm test -- --run tests/fs/link-ops.test.ts`
- `npm test`
- `npm run typecheck`
- `npm run build`

## 下一步

- 将 canonical worktree 重新对齐到主目录的 Task 5 accepted state
- 进入 Task 6：Implement Scan And List Commands
- 在合适时机清理多余临时 worktree
