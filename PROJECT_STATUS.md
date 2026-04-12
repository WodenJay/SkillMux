# PROJECT_STATUS.md

记录当前项目的总进度总览

## 当前状态

- 阶段：产品定义 / brainstorming
- 仓库状态：初始化完成，但尚未开始实现代码
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
- 下一步等待用户审阅 spec，然后再写 implementation plan
