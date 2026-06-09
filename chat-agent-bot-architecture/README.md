# chat-agent-bot-architecture

设计聊天软件机器人到 Codex/Agent 的通用架构，覆盖消息接入、事件规范化、路由、会话、心跳、状态和人工确认边界。

成熟参考案例：[NapCatCodexGateway](https://github.com/vb2250158/NapCatCodexGateway)。

这个案例已经落地了 QQ/NapCat 到 Codex Desktop 的完整链路：NapCat 反向 WebSocket 接收消息，本地 gateway 记录 JSONL 并路由直接 @、直接回复、间接回复，Codex Desktop IPC 负责固定线程 start/steer，NapCat 插件页面负责管理多个 gateway 和消息模板。

## 需要准备

- 明确目标聊天平台，例如 QQ/NapCat、微信、飞书、Discord、Slack、Telegram 或内部 IM。
- 目标平台的接入方式：Webhook、WebSocket、HTTP API、Bot Token、OneBot11 等。
- Codex/Agent 运行方式：本地线程、后台服务、HTTP 接口或队列消费者。
- 本地持久化位置，用于保存 raw event、normalized message、thread id、游标、去重键和恢复线索。
- 机器人回复消息默认不设发送限制：在哪个群、私聊或线程收到触发消息，就回到同一个目标；需要引用原消息时保留 reply 链。

## 推荐配置项

```text
BOT_PLATFORM=<platform>
BOT_WORKSPACE=<path>
AGENT_RUNTIME=<codex|openai|custom>
MESSAGE_STORE=<sqlite|jsonl|database>
DRY_RUN_WRITES=true
```

具体变量名可以按项目实际实现调整。聊天回复默认直接发送到消息来源；写外部系统、改项目状态这类业务写入仍建议用 `DRY_RUN_WRITES=true` 先生成待写草稿。

## 架构重点

- 接入层只负责收发消息，不直接执行复杂 agent 逻辑。
- 事件层保存原始 payload，并生成稳定的 normalized message。
- 路由层判断是否触发 agent、投递到哪个会话、是否需要去重。
- 会话层复用固定 thread，避免每条消息都开新会话。
- 心跳层在没有新消息时也巡检待办、缓存和外部系统。
- 状态层保存游标、计数、活跃任务、归档和幂等键。

## QQ / NapCat 成熟路由

QQ 群消息建议收敛为三类路由：

- 直接 @：当前消息本身直接 @ 机器人，且不是回复消息。
- 直接回复：当前消息直接回复机器人。QQ 回复常会自动带 @，所以要先判断回复，再判断普通 @。
- 间接回复：当前消息回复了某个用户，而被回复的那条消息里曾经 @ 过机器人。

发送给 Codex 的消息模板建议按路由拆成“直接 @ 模板、直接回复模板、间接回复模板、私聊模板”，并暴露 `{messageTarget}`、`{repliedMessageId}`、`{repliedMessage}` 等变量，方便 agent 还原目标和回复链。

NapCat 插件侧建议按官方插件机制组织为 `package.json`、`index.mjs`、`webui/`，在 `plugin_init(ctx)` 中注册页面/API。插件负责管理配置和展示状态，实际 WebSocket 监听、Codex IPC、JSONL 落盘由本地 gateway 服务负责。

## 使用边界

- 聊天回复不做发送限流或人工待审；根据 normalized message 的 `chatType`、`chatId`、`messageId` 和 reply 链原路回复。
- 写外部系统、改项目状态的动作仍应生成 dry-run 或待写草稿。
- 本地缓存只保存机器人运行所需的技术状态和短摘要，不应变成第二份项目表。
- 工作事实、负责人结论、验收状态和排期应写入外部真相源，例如腾讯文档、Issue 或工单系统。
