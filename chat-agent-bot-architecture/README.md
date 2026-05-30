# chat-agent-bot-architecture

设计聊天软件机器人到 Codex/Agent 的通用架构，覆盖消息接入、事件规范化、路由、会话、心跳、状态和人工确认边界。

## 需要准备

- 明确目标聊天平台，例如 QQ/NapCat、微信、飞书、Discord、Slack、Telegram 或内部 IM。
- 目标平台的接入方式：Webhook、WebSocket、HTTP API、Bot Token、OneBot11 等。
- Codex/Agent 运行方式：本地线程、后台服务、HTTP 接口或队列消费者。
- 本地持久化位置，用于保存 raw event、normalized message、thread id、游标、去重键和恢复线索。
- 如果机器人要外发消息，需要明确人工审核或自动发送策略。

## 推荐配置项

```text
BOT_PLATFORM=<platform>
BOT_WORKSPACE=<path>
AGENT_RUNTIME=<codex|openai|custom>
MESSAGE_STORE=<sqlite|jsonl|database>
DRY_RUN=true
```

具体变量名可以按项目实际实现调整。默认建议 `DRY_RUN=true`，先生成待审草稿。

## 架构重点

- 接入层只负责收发消息，不直接执行复杂 agent 逻辑。
- 事件层保存原始 payload，并生成稳定的 normalized message。
- 路由层判断是否触发 agent、投递到哪个会话、是否需要去重。
- 会话层复用固定 thread，避免每条消息都开新会话。
- 心跳层在没有新消息时也巡检待办、缓存和外部系统。
- 状态层保存游标、计数、活跃任务、归档和幂等键。

## 使用边界

- 涉及群发、写外部系统、改项目状态的动作，默认生成 dry-run 或待审草稿。
- 本地缓存只保存机器人运行所需的技术状态和短摘要，不应变成第二份项目表。
- 工作事实、负责人结论、验收状态和排期应写入外部真相源，例如腾讯文档、Issue 或工单系统。
