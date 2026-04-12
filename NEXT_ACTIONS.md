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
- [ ] 请用户审阅 `docs/superpowers/specs/2026-04-12-skillmux-v0-design.md`
- [ ] 用户确认后，进入 implementation plan 编写
