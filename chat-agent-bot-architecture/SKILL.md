---
name: chat-agent-bot-architecture
description: 设计和实现聊天软件机器人到 Codex/Agent 的通用架构。Use when Codex needs to build or review a QQ/NapCat, WeChat, Feishu/Lark, Discord, Slack, Telegram, or internal IM bot that receives chat messages, persists history, routes mentions/private/reply events into agent sessions, manages conversation threads, starts or steers agents, designs heartbeat schedules, maintains counters/caches/state files, or turns a project PM bot into a reusable robot pattern.
---

# Chat Agent Bot Architecture

## 核心目标

把聊天软件机器人做成“可持续工作的项目成员”，而不是只会转发消息的 webhook。

一个成熟机器人至少包含七层：

1. 接入层：连接聊天软件，接收消息，发送消息。
2. 事件层：规范化事件，落盘历史，保留原始 payload。
3. 路由层：判断哪些消息要触发 agent，哪些只记录。
4. 会话层：把事件投递到固定 agent 会话，避免重复开线程。
5. 心跳层：无消息时也主动巡检缓存、排期、待办和外部系统。
6. 状态层：维护计数、游标、缓存、活跃任务、归档和幂等。
7. 控制台层：用独立 WebUI / Bot Hub 管理平台、路由、agent、插件、草稿、安全门和运行状态。

## 总体架构

```text
Chat Platform
  -> Adapter / Gateway
  -> Raw Event Log
  -> Normalized Message Store
  -> Bot Hub / Middleware
  -> Router / Policy Engine
  -> Agent Session Manager
  -> Codex / Agent Runtime
  -> Action Queue / Drafts
  -> Human Approval
  -> Chat Platform / External Systems
```

关键原则：

- 接收和发送分离。接收消息可以自动，发送外部消息默认要用户授权。
- 消息路由和 agent 执行分离。路由只决定“是否提醒/启动/引导”，agent 决定“怎么处理”。
- 实时消息和心跳巡检分离。实时消息负责响应上下文变化，心跳负责主动推进。
- 只要涉及外部系统写入或群发，都要有 dry-run / 待审草稿，除非用户明确授权自动执行。
- WebUI 是控制面，不是业务真相源。它可以展示状态、编辑配置、审批草稿、查看日志和触发重放；项目事实仍应写入腾讯文档、Issue、工单或数据库。

如果机器人不只是单个平台单个 agent，推荐在 gateway 和 agent runtime 之间加一层独立中间层：

```text
QQ / WeChat / Feishu / Discord / Slack / Telegram
  -> Platform Adapters
  -> Bot Hub API
  -> Event Store / State Store
  -> Pipeline: normalize -> dedupe -> route -> enrich -> policy -> dispatch
  -> Agent Drivers: Codex / OpenAI / local LLM / workflow scripts
  -> Action Queue
  -> WebUI Console
```

## 独立 WebUI / Bot Hub 中间层

当需求接近 AstrBot 这类“多平台接入 + 多插件 + 多模型/多 agent + 管理后台”时，不要把所有逻辑塞进某个平台插件。推荐做一个独立 Bot Hub：

```text
Platform Plugin / Adapter
  -> Bot Hub HTTP/WebSocket API
  -> Event Pipeline
  -> Agent Orchestrator
  -> Approval / Action Center
  -> Platform Send API
```

各组件职责：

- 平台插件：只负责平台生命周期、登录态、收发桥接、配置发现和轻量健康检查。
- Bot Hub API：统一接收各平台事件，提供发送、审批、重放、状态、配置和日志查询 API。
- Event Pipeline：做规范化、去重、回复链补齐、附件缓存、身份映射、限流和路由。
- Agent Orchestrator：按 bot/profile/thread key 选择 Codex 线程、OpenAI API、本地模型、工作流脚本或人工队列。
- Action Center：保存待审群消息、私聊、表格写回、Issue 更新和外部 API 调用；用户确认后再 commit。
- WebUI Console：管理平台连接、bot profile、路由规则、模板、agent driver、插件、心跳、草稿、运行日志和指标。

WebUI 推荐页面：

- Dashboard：平台连接、gateway 状态、agent 活跃 turn、队列长度、最近错误、心跳状态。
- Platforms：QQ/NapCat、WeChat、Feishu/Lark、Discord、Slack、Telegram 等适配器配置。
- Bots：每个机器人 profile 的名称、权限、触发范围、目标项目、默认 agent、数据目录。
- Routes：私聊、群 at、reply、间接 reply、关键词、普通消息记录、限流和优先级规则。
- Prompts：按 route kind 维护模板，不要把模板硬编码在 handler 里。
- Agents：Codex Desktop IPC、OpenAI API、本地模型、脚本工作流等 driver 的配置和健康检查。
- Approvals：待审回复、待写外部系统、dry-run diff、执行记录和回滚线索。
- Logs：raw event、normalized message、route decision、agent dispatch、action commit 的可搜索视图。
- Replay：选择一条历史 event 重新跑 normalize/route/dispatch，用于调试路由 bug。

中间层数据模型建议：

```ts
type BotProfile = {
  id: string;
  name: string;
  platformScopes: string[];
  defaultAgentDriver: "codex-desktop" | "openai-api" | "local-llm" | "workflow";
  dataDir: string;
  permissions: {
    autoRecord: boolean;
    autoStartAgent: boolean;
    autoSendExternal: boolean;
    autoWriteExternalSystems: boolean;
  };
};

type PipelineStep =
  | "normalize"
  | "dedupe"
  | "resolveIdentity"
  | "resolveReplyChain"
  | "cacheAttachment"
  | "route"
  | "applyPolicy"
  | "dispatchAgent"
  | "enqueueAction";
```

类 AstrBot 设计可以借鉴“插件 + 事件总线 + 管理后台”的形态，但要保留 Codex/项目 PM 机器人需要的安全边界：

- 插件只注册能力：平台适配、命令、路由扩展、事实源读取、动作执行器、UI 面板。
- 插件不要直接绕过 Action Center 给外部群发消息或写业务系统。
- 插件 API 要区分 `read`、`draft`、`commit` 权限；默认只给 `read` 和 `draft`。
- 路由、prompt、权限和 agent driver 配置要按 bot profile 隔离，避免一个群的设置影响另一个群。
- 所有插件执行都要写 audit log：输入 event id、输出 action id、是否 commit、操作者和时间。

什么时候需要独立 WebUI / Bot Hub：

- 同时接多个平台或多个 QQ 号/群。
- 需要非开发人员调整路由、模板、审批草稿或查看运行状态。
- 一个机器人要切换多个 agent driver，例如 Codex、OpenAI API、本地 LLM、脚本工作流。
- 需要历史事件重放、日志搜索、权限控制、插件市场或团队协作。

什么时候不需要：

- 只有一个平台、一个群、一个固定 Codex 线程，且配置很少变化。
- 只是临时验证消息到 Codex 的链路。
- 用户不需要管理后台，直接用本地配置文件和日志即可。

落地技术建议：

- 后端：Node.js/TypeScript 或 Python/FastAPI 均可；优先选项目已有栈。
- 前端：React/Vite 或现有管理后台框架；WebUI 只做控制台，不做营销页。
- 存储：开发期可用 SQLite + JSONL；生产期再考虑 Postgres。raw event 仍建议保留 JSONL 方便追查。
- 通信：平台到 Hub 用 WebSocket/HTTP；Hub 到 Codex Desktop 用 IPC；Hub 到 OpenAI/API 模型用官方 SDK。
- 配置：用户可见配置进 WebUI；token、cookie、密钥进 secret store 或本机环境，不提交仓库。
- 部署：本机机器人用单进程 manager 启动 API + WebUI + gateway；团队版再拆服务。

WebUI 最容易犯的错：

- 把 WebUI 做成第二份项目表，和腾讯文档/Issue 产生事实冲突。
- 让平台插件直接包含 agent 编排、外部写入和审批逻辑，后续无法多平台复用。
- 只有“启动/停止”按钮，没有重放、日志、路由理由和 action 审批。
- 允许任何插件直接发送群消息，缺少权限和 audit log。
- 修改 prompt 或路由后没有版本记录，导致问题无法复盘。

## 成熟案例：NapCatCodexGateway

成熟参考实现：[vb2250158/NapCatCodexGateway](https://github.com/vb2250158/NapCatCodexGateway)。

这个案例已经验证了 QQ/NapCat 到 Codex Desktop 的完整链路：

```text
NapCat WebSocket 客户端
  -> 本地 gateway 接收 OneBot 事件
  -> JSONL 消息日志与 Codex 投递日志
  -> 路由器判断直接 @ / 直接回复 / 间接回复
  -> Codex Desktop IPC 固定线程 start / steer
  -> NapCat 插件页面管理多 gateway、端口、模板和运行状态
```

可复用设计点：

- 用本地 gateway manager 管理多个 gateway，而不是把所有配置塞进单进程命令行。
- NapCat 插件只做管理界面和配置桥接；实际消息接收、Codex IPC、日志落盘由独立 gateway 服务负责。
- NapCat 插件按官方机制提供 `package.json`、`index.mjs`、`webui/`，在 `plugin_init(ctx)` 中使用 `ctx.router` 注册页面和 API。
- WebSocket Client 用于接收 QQ 事件；HTTP Server 用于主动发送 QQ 消息和调用 OneBot API。这两个配置要在 UI 里写清楚，最好从 NapCat OneBot 配置文件/API 中读取成下拉选项。
- 发送给 Codex 的消息模板不要硬编码在 handler 里；按路由类型拆成可编辑模板，例如直接 @、直接回复、间接回复、私聊。
- 模板变量要暴露消息目标和回复链，例如 `{messageTarget}`、`{targetType}`、`{targetId}`、`{repliedMessageId}`、`{repliedMessage}`。
- 路由理由用于 debug 可以存在于内部结构，但不要强迫用户在模板里理解抽象字段；用户可见模板应直接写清楚触发说明。
- Codex Desktop IPC 运行中追加消息时，如果 `steer` 返回 active turn 已结束，要自动切回 `start`，不要丢消息。
- 管理页面显示“当前进程日志”，重启时清掉旧堆栈，避免旧错误误导用户判断当前状态。

这个案例适合作为 QQ/NapCat 类项目的基线：先复用“NapCat 插件 + 本地 gateway manager + Codex IPC + JSONL 日志 + 模板化路由”结构，再按具体项目改业务模板、工作缓存和外部事实源。

## 机器人姿态

机器人要把维护自身工作记忆当成自己的职责，不能把问题甩给用户。

必须避免的表达：

- “为什么你老是不停改这个文件？”
- “这个应该写到腾讯文档吧，你自己去改。”
- “这里面的内容是不是要移除？”
- “本地只应该放永久记录，所以我不处理。”
- “都写到腾讯文档去。”
- “本地只保留长期规则，其他全删。”

正确行为：

- 主动判断信息分层：外部事实源、项目状态、机器人工作缓存、临时运行日志、归档记录。
- 需要写腾讯文档时，直接形成写回 dry-run；如果已获授权，就写入并回读核验。
- 需要清理本地缓存时，给出具体 diff 或直接清理可安全清理的临时项。
- 需要保留本地长期记忆时，说明它用于恢复上下文、定位 message_id、避免重复催办或恢复等待链。
- 如果边界不确定，提出一个具体整理方案，而不是质问用户为什么没有维护文件。
- 不要一刀切迁移。先按信息类型决定去向，再执行或生成 dry-run。

文件分层建议：

- 外部真相源：腾讯文档、Issue、工单、数据库；保存所有工作内容、工作状态和项目协作事实，例如项目状态、负责人结论、验收/关闭口径、排期、待办、风险、下一步动作。
- 本地永久记录：机器人后续工作必须长期依赖、但不适合写进外部真相源的运行记录，例如身份映射、message_id 索引、项目作息、用户偏好、thread id、路由游标、去重键、恢复线索。不要把工作状态长期放在本地。
- 本地工作缓存可以存在，但必须永远保持为一段短摘要，而不是流水账或第二份项目表。摘要只回答：最新看到的消息是什么、当前还有什么待处理、下一步准备做什么、需要哪些 message_id/thread id 用于恢复。
- 本地归档：已闭环事项的复盘信息和关键证据，不参与日常活跃队列。
- 临时日志：raw event、debug log、下载缓存；可按 TTL 或大小清理。

机器人看到缓存文件变大时，应先分类整理、归档、压缩或生成写回计划；不要把“该写哪里/该删哪里”的判断压力抛回给用户。

分流规则：

- 写外部真相源：所有工作内容和工作状态，包括工作项状态、负责人结论、验收结论、关闭原因、排期承诺、待办、风险、下一步动作、需要团队共享或影响项目推进的事实。
- 留本地永久记录：机器人运行所需、且不适合进入外部真相源的技术状态和恢复线索，包括群号/用户映射、称呼、项目作息、用户偏好、message_id 索引、thread id、路由计数、游标、去重键、最近跟进点对应的索引。
- 留本地工作缓存：只能是一段话摘要，不能追加成列表流水。每次心跳或消息处理后都覆盖更新这一段话，保持“最新消息 + 当前待处理 + 下一步 + 必要恢复索引”。
- 归档到本地：已闭环事项的复盘、关键消息证据、写回记录、误判修正规则。
- 清理或压缩：重复流水、过期统计快照、已写入外部真相源且不再需要逐条恢复的中间过程。

当用户指出“文件混乱/一直被改”时，机器人应该输出类似下面的整理计划：

```text
我会按四类处理：
1. 所有工作内容和项目事实，整理为腾讯文档待写 dry-run。
2. 机器人恢复上下文必须用的 message_id、称呼、thread id、路由游标和去重键，保留在本地永久记录。
3. 已闭环流水，移到本地归档。
4. 本地工作缓存覆盖成一段话摘要；重复统计和过期过程记录清理或压缩。
```

不要把机器人内部技术状态写进腾讯文档，例如内部游标、message_id、路由状态、agent thread id、调试日志和恢复线索。但凡属于工作内容、工作状态、项目事实、排期、待办、风险、负责人结论、下一步动作或验收口径，都应进入腾讯文档或形成待写 dry-run。本地只放机器人后续工作需要永久依赖的运行记录；若需要“工作缓存”，只保留一段持续覆盖更新的摘要。

本地工作缓存推荐格式：

```text
最新消息：<时间/发送者/message_id/一句话概括>。待处理：<当前仍需推进的 1-3 件事或“无”>。下一步：<下个心跳/工作窗口要做什么>。恢复索引：<必要 message_id/thread id/外部行定位>。
```

这段缓存要覆盖更新，不要追加历史；历史应在聊天日志、外部真相源或归档里。

## 聊天软件接入

每个平台都抽象成同一组能力：

- `receive`: 收到群聊、私聊、回复、引用、图片、文件、撤回、自己发送消息。
- `send`: 发送群聊、私聊、回复、引用、图片、文件。
- `history`: 拉历史消息，补齐监听断档。
- `identity`: 识别机器人自己、群号、用户号、昵称、群名。
- `health`: 检查连接状态、登录状态、心跳和限流。

适配器落地要求：

- 保留原始事件：`raw-events.jsonl`，便于以后修路由 bug。
- 写规范化记录：例如 `group-messages.jsonl`、`private-messages.jsonl`。
- 每条记录至少包含：`time`、`platform`、`chatType`、`chatId`、`senderId`、`senderName`、`messageId`、`rawText`、`segments`、`replyToMessageId`、`isSelf`、`rawEventPath`。
- 图片/文件不要只存 `[图片]`，要保存可追溯的 file id、URL、缓存路径或拉取方式。
- 发送消息走单独 action API，不要让 agent 随手从接收 handler 里直接发。

### NapCat / OneBot 插件化落地

当平台是 QQ/NapCat 时，优先使用“NapCat 插件管理界面 + 本地 gateway 服务”的拆分：

- NapCat 网络配置：
  - WebSocket 客户端：NapCat 主动连接本地 gateway，用于接收群聊、私聊、回复、图片等 OneBot 事件。
  - HTTP 服务器：gateway 主动请求 NapCat，用于发送群聊/私聊和调用 OneBot API。
- NapCat 插件：
  - 按官方插件机制提供 `package.json`、`index.mjs`、`webui/`。
  - `package.json` 的 `name` 应使用 `napcat-plugin-` 前缀，并提供 `plugin`、`version`、`main`、`description`、`author`、`napcat.tags`、`napcat.minVersion`、`napcat.homepage`。
  - 在 `plugin_init(ctx)` 中注册页面、静态资源和 API；配置持久化使用 `ctx.configPath`；日志使用 `ctx.logger`。
  - 插件可以读取 NapCat OneBot 配置，给 WebSocket 客户端和 HTTP 服务器做下拉选择，减少手填端口错误。
- 本地 gateway：
  - 负责监听 WebSocket、保存 JSONL、路由消息、投递 Codex、调用 NapCat HTTP API。
  - 运行配置放在 `gateways.json` 或等价配置文件；真实配置、日志、token、数据目录不提交到仓库。
  - 多 gateway 用 manager 管理 start/stop/restart/status，不要靠手工开多个终端。
- 主动发送 QQ 消息时，优先用 Node `fetch` 调 NapCat HTTP API，避免每次临时写 Python 脚本。短英文 / 纯 CQ 码可用 one-liner；包含中文、长文本、换行或多个 CQ 码时，默认用临时 Node 脚本或 action API，不要把中文直接放进 PowerShell 命令行、here-string、`Invoke-RestMethod -Body` 或 `node -e` 参数里。当前环境已实测：PowerShell inline 中文会在进入 Node/Python 前被替换成 `?`，导致 QQ 端全乱码；只做 JSON escape / `ensure_ascii` 不能修复已经损坏的文本。
  ```javascript
  const message = "[CQ:reply,id=123][CQ:at,qq=1050739541] \u91cd\u53d1\u4e00\u4e0b";
  const res = await fetch("http://127.0.0.1:<napcat-http-port>/send_group_msg", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ group_id: "<group_id>", message, auto_escape: false })
  });
  console.log(await res.text());
  ```
  群聊使用 `/send_group_msg`，私聊使用 `/send_private_msg`；需要 reply / at 时在 `message` 里使用 CQ 码，且 `auto_escape:false`。临时脚本推荐保持源文件全 ASCII，用 `\uXXXX` Unicode escape 还原中文；或只读取已确认 UTF-8 的 JSON / txt 文件。

## 消息路由

路由不是简单的 `text.includes("@bot")`。至少支持：

- 私聊：默认触发 agent。
- 群显式 at：结构化 at segment、CQ at、平台 mention 对象。
- 直接回复机器人：当前消息是 reply/quote，且回复目标是机器人或当前回复消息自动带了机器人 at。
- 间接回复机器人：当前消息回复了某个用户，而被回复的那条消息里曾经 at / mention 过机器人。
- 关键词命令：例如 `/ping`、`/查`、`/总结`。
- 自身消息：默认记录，只有需要“机器人自己发的消息也进入上下文”时才触发。
- 普通群消息：默认只记录，不触发，避免刷屏。

QQ/NapCat 群路由建议明确收敛成三类：

```ts
type GroupRouteKind = "direct_at" | "direct_reply" | "indirect_reply";
```

- `direct_at`：当前消息本身直接 @ 机器人，且不是回复消息。
- `direct_reply`：当前消息直接回复机器人。注意 QQ 回复经常会自动带 `[CQ:at]`，所以要优先判断 reply，再判断普通 at，避免把直接回复误判成直接 @。
- `indirect_reply`：当前消息回复了某个用户，而被回复的那条消息中曾经 @ 过机器人。实现上需要用 `replyToMessageId` 回查本地消息日志或平台历史。

不要只看当前消息文本。成熟路由需要同时检查：

- 结构化消息段，例如 `at`、`reply`、平台 mention 对象。
- CQ 码文本，例如 `[CQ:at,qq=...]`、`[CQ:reply,id=...]`。
- 被回复消息的原始内容和 message id。
- 机器人自己的 QQ / ID / 昵称。

发送给 agent 的模板建议按路由拆分，而不是在一个模板里塞复杂原因变量：

- 直接 @ 模板。
- 直接回复模板。
- 间接回复模板。
- 私聊模板。

模板变量要覆盖消息目标和回复链，例如：

```text
{routeKind} {time} {targetType} {targetId} {messageTarget}
{groupId} {userId} {selfId} {sender} {senderName}
{message} {rawMessage} {messageId}
{repliedMessageId} {repliedMessage}
{botNickname} {dataDir} {groupLogPath} {privateLogPath}
```

路由输出建议是结构化对象：

```ts
type RouteDecision = {
  action: "ignore" | "record" | "notify" | "startAgent" | "steerAgent";
  reason: string;
  routeKind?: "private" | "direct_at" | "direct_reply" | "indirect_reply" | "command";
  priority: "low" | "normal" | "high" | "urgent";
  targetThreadKey: string;
  relatedMessageIds: string[];
  shouldDraftReply: boolean;
};
```

内部可以保存 `reason` 用于 debug，但用户可编辑模板不应依赖抽象的 reason 字段。模板里直接写清楚该路由的触发说明，减少配置理解成本。

## 会话管理

每类机器人要有固定会话，而不是每条消息创建一个新会话。

推荐状态文件：

```json
{
  "threads": {
    "qq-pm-monitor": {
      "threadId": "019e...",
      "name": "QQ 消息监听",
      "lastStartedAt": "2026-05-30T12:00:00+08:00",
      "active": false,
      "lastEventId": "platform-message-id",
      "notificationCount": 42
    }
  }
}
```

会话路由规则：

- 固定 thread name，例如 `QQ 消息监听`；不要把时间和消息序号拼进会话名。
- 如果目标 thread 空闲，启动一个新 agent turn。
- 如果目标 thread 已有 agent 正在运行，把新消息作为“引导/steer”追加到当前 turn。
- 如果启动失败，记录失败事件和错误，不要丢消息。
- 如果 thread id 失效，清理旧 id，重建固定名称会话，并记录一次迁移。

Codex Desktop IPC 经验：

- Windows Desktop 可用 `\\.\pipe\codex-ipc`，协议是 4 字节 little-endian 长度 + UTF-8 JSON frame。
- 先发 `initialize`，并对 `client-discovery-request` 回复 `canHandle:false`。
- 空闲时用 `thread-follower-start-turn`。
- 运行中用 `thread-follower-steer-turn`，这是 UI 里的“引导 / Ctrl+Enter”的程序化等价。
- 监听 `thread-stream-state-changed` 来维护 active/idle 状态。
- `steer` 可能因为 active turn 已经结束而失败；遇到类似 `SteerTurnInactiveError` 或“active turn already ended”时，应把本地 active 状态置空并自动切回 `start`，不要丢消息。
- 不要用外部 `codex app-server --listen` 冒充 Desktop 当前窗口；那可能写入同一套文件，但 UI 不一定订阅它。

## 启动 Agent

启动 agent 的输入要告诉它三件事：

1. 这是哪个机器人/平台来的提醒。
2. 应该读取哪些本地日志和缓存。
3. 允许做什么，不允许做什么。

模板：

```text
这是来自 <平台>/<机器人> 的实时消息提醒。
请读取 <data-dir> 下相关 JSONL 的最新记录，结合项目缓存理解上下文。
本轮目标：判断是否需要推进事项、整理待办、生成待审话术或 dry-run。
不要自动发送外部消息，不要写外部系统，除非用户在当前 Codex 会话中明确授权。
```

运行中 steer 的输入要更短：

```text
这是运行中的 <平台>/<机器人> 补充消息。
请把它作为当前任务的新上下文继续处理，不要另开思路。
```

避免的输入：

- “收到请回复一句 OK”：会让 agent 看起来启动了但没有做事。
- 只贴原始消息不告诉它读哪里：agent 容易漏上下文。
- 让 agent 自动回复群：容易误发、刷屏或越权。

## 心跳设计

心跳不是“定时看看有没有新消息”。它负责无消息时的主动推进。

心跳优先级：

1. 读机器人项目上下文和活跃缓存。
2. 读消息日志，补齐新消息、回复链和未处理事件。
3. 读外部事实源，例如腾讯文档、Issue、工单、数据库、项目排期。
4. 维护队列：闭环归档、活跃项更新、等待链更新、下一步动作。
5. 生成内部产物：排期小清单、负责人清单、待写 dry-run、待审回复。
6. 到达合适沟通窗口时，才建议对外发消息。

频率设计：

- 实时事件：消息到达即触发路由。
- 上班时间：高频心跳，例如 15 分钟，用来推进和响应。
- 下班/周末：低频心跳，例如 1 小时，用来内部整理，不主动打扰人。
- 紧急事件：单独高优先级，不依赖普通心跳。

创建心跳 agent / automation 时，默认使用最新可用模型，并且推理强度用 `high`。心跳负责读缓存、读外部事实源、核状态、拆排期和形成下一步动作，不是简单 echo；不要默认用旧模型、`minimal` 或 `low`。如果某个平台的 heartbeat API 不暴露 model / reasoning effort，就在 prompt 里明确要求“使用当前默认最新模型能力、深入巡检/主动推进/不得只看最新消息”；cron 类 automation 应显式配置最新模型和 `reasoningEffort: "high"`。

心跳输出必须至少有一类具体产物：

- 缓存更新建议。
- 外部系统写回 dry-run。
- 下一批 1-3 个可推进事项。
- 待审群/私聊话术。
- 下一轮观察点和等待对象。

如果只输出“没有新消息，无需处理”，说明心跳提示词不合格。

## 计数与状态架构

计数分三类，不要混在一个 `count` 里：

- 接收计数：收到多少原始事件、群消息、私聊、图片、文件、自身消息。
- 路由计数：触发了多少 notify/start/steer，忽略了多少普通消息，失败了多少。
- 业务计数：未闭环事项、待验收、待确认、待排期、等待回复、已归档。

推荐状态文件：

```json
{
  "cursors": {
    "group:<group_id>": {
      "lastMessageId": "1784407816",
      "lastSeenAt": "2026-05-30T12:00:00+08:00"
    }
  },
  "counters": {
    "rawEvents": 1200,
    "groupMessages": 930,
    "privateMessages": 18,
    "routedNotifications": 42,
    "agentStarts": 12,
    "agentSteers": 30,
    "routeErrors": 0
  },
  "business": {
    "activeItems": 17,
    "waitingReplies": 5,
    "pendingReview": 9,
    "archivedItems": 31
  }
}
```

计数使用规则：

- 更新计数要幂等。用 `messageId` / event id 去重，不要重启后重复计数。
- `notificationCount` 只表示投递给 agent 的次数，不代表业务处理完成数。
- 业务计数从缓存或事实源重算，不要长期相信旧快照。
- 每次心跳报告里只展示与决策相关的计数，不要用大而空的总数淹没行动建议。

## 缓存与归档

机器人必须有项目级缓存，不要完全依赖对话上下文。

活跃缓存记录：

- 稳定事项标题或摘要。
- 关联外部行/issue/message id。
- 当前状态、负责人、等待对象。
- 最近一次提问时间和 message id。
- 下一步动作。
- 是否允许自动发送或写回。

归档记录：

- 最终结论。
- 关键证据 message id。
- 写回位置和值。
- 关闭时间。

原则：

- 活跃缓存只放还需要继续看的事。
- 已闭环移入归档，避免反复催。
- Row number 只能当临时参考，继续处理前用内容/负责人/状态重新定位。
- 上下文压缩或重启后，先读缓存和归档再行动。

## 外部动作安全

把外部动作做成两阶段：

1. Draft：生成待审消息、待写表格、待调用 API。
2. Commit：用户明确授权后执行。

默认禁止：

- 自动群发。
- 自动私聊。
- 自动写腾讯文档/Issue/数据库。
- 自动改触发实现流程的状态列。

可以自动做：

- 记录消息。
- 更新本地缓存。
- 生成 dry-run。
- 启动/引导 Codex 内部 agent。
- 健康检查和读取公开/已授权数据。

## 最小实现清单

新做一个聊天 agent bot 时，至少交付：

- 适配器：能接收消息、发送测试消息、拉历史。
- 中间层：统一 Bot Hub API，接收平台事件，输出 route decision、agent dispatch 和 action draft。
- 数据目录：`raw-events.jsonl`、规范化消息 JSONL、`state.json`、项目缓存。
- 路由器：私聊、at、reply/quote、关键词、自身消息、普通消息。
- 会话管理：固定 thread、active/idle、start/steer、失败重试。
- 心跳：上班高频、下班低频、无消息主动推进。
- 安全门：外部发送和写入默认 dry-run。
- 控制台：至少能查看连接状态、最近事件、路由理由、agent 状态、待审草稿和错误日志。
- 验证：收一条私聊、群 at、群 reply、普通群消息、连续消息、agent 运行中 steer、重启恢复、历史 event 重放、待审 action commit。

## 常见失败模式

- 只监听 at，漏掉 reply/quote 到机器人的消息。
- 每条消息创建新会话，导致一堆并行 agent。
- 运行中继续 start turn，而不是 steer，引发混乱或报错。
- 心跳只看最新群消息，没消息就空跑。
- 只做全表总数统计，不拆下一步可执行清单。
- 非工作时间直接停工，而不是低频做内部整理。
- 计数混乱，把收到消息数、投递 agent 数、业务闭环数混为一谈。
- 手写 session 文件或连错 app-server，以为 UI 已接入。
- WebUI 只做配置表单，没有事件重放、路由理由、审批队列和 audit log，出了问题无法定位。
- 把平台插件做成巨型单体，里面混着收消息、agent 编排、业务写入和 UI，导致换平台时无法复用。
- 类 AstrBot 插件直接发送外部消息或写业务系统，绕过 dry-run、权限和人工审批。
- PowerShell inline 中文导致 `??`，误判平台编码有问题。
- Node `fetch` 仍把中文写在 `node -e` 或 PowerShell 命令文本里，结果源文本已经在 shell/Codex 层损坏；正确做法是 action API、ASCII 临时脚本 + Unicode escape，或读取已确认 UTF-8 的消息文件。
