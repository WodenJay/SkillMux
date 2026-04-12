# NEXT_ACTIONS.md

记录下一步的任务和行动计划，完成了就打勾`[x]`

- [x] 读取 `AGENTS.md` 与现有项目状态
- [x] 固化当前已确认的产品方向（CLI-first、npm 分发、跨平台）
- [x] 澄清第一个关键问题：SkillMux 是否要直接负责“下载/更新远端 skills”，还是先只管理本地已安装 skills
- [x] 澄清第二个关键问题：SkillMux 是否应该接管“启用/停用”的真实实现（移动/重建 symlink），还是先只做状态编排与命令生成
- [x] 澄清第三个关键问题：agent 目录发现机制应以“内置常见规则 + 用户可配置覆盖”为主，还是完全自动发现
- [x] 澄清第四个关键问题：停用 skill 时，是移动到 SkillMux 自己的托管仓库，还是只删除 agent 侧链接并记录映射
- [x] 基于澄清结果提出 2-3 种产品边界方案与推荐方案
- [x] 输出第一版 SkillMux 信息架构与命令模型草案
- [x] 完成 spec 自审
- [x] 请用户审阅 `docs/superpowers/specs/2026-04-12-skillmux-v0-design.md`
- [x] 用户确认后，进入 implementation plan 编写
- [x] 写出 implementation plan 初稿
- [x] 请用户选择执行方式：subagent-driven 或 inline execution
- [x] 创建 `.worktrees/` 隔离工作区并验证基线
- [x] 进入 Task 1：bootstrap CLI workspace
- [x] 完成 Task 2 的 code quality review 并决定是否需要修复
- [x] 将通过验收的 Task 2 代码同步回主目录
- [x] 进入 Task 3：Implement Manifest Read And Write Persistence
- [x] 完成 Task 3 的 spec review、code quality review 与主目录验证
- [ ] 进入 Task 4：Add Path Resolution And Agent Discovery Rules
- [ ] 为 Task 4 准备 discovery/config 测试夹具（临时 home、agent 目录 fixture、用户配置覆盖样例）
- [ ] 在合适时机清理多余临时 worktree
