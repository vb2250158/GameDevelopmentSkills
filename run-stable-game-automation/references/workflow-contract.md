# 稳定工作流契约

## 入口

- `scripts\Invoke-StableGameWorkflow.bat`：Agent、GUI、心跳和人工命令的规范入口。
- `scripts\Run-Daily-Automation-Queue.bat`：单游戏底层执行器；稳定入口负责有界重试，底层负责日志增量证据、锁和清理。
- `scripts\Set-GameAutomationTakeover.bat`：人工接管租约。
- `scripts\Check-WeeklyEvidence.bat`：本周日志证据检查，不执行游戏点击。
- `scripts\Write-DailyAutomationAudit.bat`：汇总日常、周常、租约、锁和残留进程。

## 退出码

| 退出码 | 含义 | 后续动作 |
|---:|---|---|
| 0 | 权威证据确认完成，或 dry-run 成功 | 核对状态和日志 |
| 20 | 阻塞或失败 | 看 `failureClass`，只重试可恢复类 |
| 21 | 缺证据/部分完成/待复核 | 保存现场，不盲重试 |
| 30 | 人工接管生效 | 停止后续队列和清理 |
| 31 | 全局自动化锁已被占用 | 等当前单游戏结束 |
| 32 | 安全策略阻止 | 修配置，不绕过策略 |

## 状态文件

日常：

```text
daily-status/YYYY-MM-DD.json
```

周常：

```text
daily-status/weekly/YYYY-Www.json
```

尝试记录：

```text
daily-status/attempts/YYYY-MM-DD/<GameId>/<AttemptId>.json
```

主要状态：`running`、`done`、`blocked`、`failed`、`review_required`、`human_required`、`partial`、`skipped`。

`done` 记录应包含本轮队列日志、权威证据日志和证据起始字节；尝试记录保存退出码与 `failureClass`。JSON 使用同目录临时文件原子替换。

## 证据边界

执行前记录证据日志长度，只匹配本轮追加片段。日志被截断时可从头读取，但带完整时间戳的工具必须过滤到本轮开始时间。

成功条件可以包含一个主模式和多个必须同时出现的模式。失败和人工接管条件优先于成功条件。无完成模式的环境探针只能产生 `review_required`。

已收紧的关键条件：

- 终末地日常：`日常奖励领取完成` + 工具正常收尾；演算另算周常。
- 少女前线 2 日常：`日常完成!` + 工具正常收尾；`exception stopped` 永远不是成功。
- 绝区零日常：一条龙全部结束 + `日常奖励领取成功` + `活跃度已满`。
- 异环日常：每日活跃完成 + `failed []` + `结束执行日常任务`。
- PGR：本轮 `TASK_FLOW_START` 后必须有总完成且没有严重错误。
- NIKKE：同轮必须有 `nikke.outpost`、`nikke.dispatch_friend`、`nikke.daily_shop` 三个完成 Mark 与根级 `daily_done`；任意子树 success 不算整套完成。
- FGO：BBchannel 免责声明/模态窗和 FGA 无障碍都属于人工门；只有 `FGO_DAILY_DONE` 可完成。
- BD2：雷电 guarded runner 的启动、截图、OCR 和退出都不是完成；条款/隐私文本必须转人工接管。
- CZN：只认腾讯国服包 `com.tencent.czn` 与国服本轮证据。国际服 `com.smilegate.chaoszero.stove.google` 及其 `E21400 / 403 / res_438.pigz` 只算错误路线历史，不能进入国服状态判定。

## 重试与清理

默认最多两次尝试。只有 `recoverable`、`timeout`、`controller-disconnected`、`update-restart` 可进入第二次；确定性识别错误、安全策略、登录、协议和缺证据不重试。

全局文件锁保证同一时刻只有一个真实游戏执行器。锁异常退出后由操作系统释放句柄；后续运行可覆盖旧元数据。

雷电的 `dnplayer` / `LdVBoxHeadless` 是允许常驻的宿主，不参与 PC 游戏全局冲突判断。只有 FGO/BD2/CZN 自己的 runner 能决定是否管理模拟器。

高权限总复核使用 `Test-ElevatedDailyTasks.bat -Target Required -Strict`，只覆盖 WW/NIKKE/NTE/PGR。任务查询异常与确定缺失分开记录，不因一次 CIM 抖动触发重注册。

## 周常模式

- `evidence-only`：已有可核验日志，但暂不自动点击新的周常内容。
- `review-only`：没有独立权威入口，只写待复核。
- `manual`：需要用户完成，不能自动化。

绝区零周常始终排除枯萎之都。证据检查只认当前周、最新一轮运行片段；历史日志不能补齐本周状态。
