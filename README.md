# GameDevelopmentSkills

这个仓库用于同步和沉淀 Codex 游戏研发相关的可复用 Skills。

## Skills

| Skill | 用途 |
| :--- | :--- |
| [`read-tencent-docs-opendoc`](read-tencent-docs-opendoc/) | 读取、搜索腾讯文档 opendoc 数据，并在明确授权时通过腾讯文档 MCP 修改在线表格。 |
| [`ai-automation-workflow`](ai-automation-workflow/) | 从腾讯文档任务清单拉取待处理项，整理本地任务包，分析方案，回填方案并推进已确认修复。 |
| [`chat-agent-bot-architecture`](chat-agent-bot-architecture/) | 设计聊天软件机器人到 Codex/Agent 的通用架构，包括消息接入、路由、会话、心跳和状态管理。 |
| [`project-progress-pm`](project-progress-pm/) | 基于腾讯文档项目进度表做 PM 巡检，维护状态批注，拆分待实现 / 待验收 / 待确认队列并推进闭环。 |
| [`github-submit-workflow`](github-submit-workflow/) | 通用 GitHub 提交流程，包含改动核对、脱敏处理、详细版本日志、提交说明和推送。 |
| [`github-pull-workflow`](github-pull-workflow/) | 通用 GitHub 拉取流程，包含版本日志阅读、备份、拉取合并、冲突处理和配置/逻辑迁移。 |

## 目录结构

每个 skill 作为独立子目录保存，目录内保留原始相对结构：

```text
<skill-name>/
  SKILL.md
  agents/
  scripts/
  references/
```

部分目录可能没有 `scripts` 或 `references`，以实际 skill 内容为准。

## 同步来源

当前内容来自本机 Codex skill 目录：

```text
C:\Users\Administrator\.codex\skills
```

同步时建议整目录复制对应 skill，而不是只复制 `SKILL.md`，这样可以保留脚本、模板、参考文档和 agent 配置。
