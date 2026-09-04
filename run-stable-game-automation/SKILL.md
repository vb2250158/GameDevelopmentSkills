---
name: run-stable-game-automation
description: 用于安全运行、恢复、审计和优化 Windows 多游戏每日/周常自动化。用户要求完成每日或每周、继续游戏自动化、登录后恢复、排查假完成/重复重试/抢焦点，或维护“游戏自动化研究”工作区时使用。
---

# 稳定游戏自动化

以游戏日志证据为完成真源。一次只运行一个游戏；进程退出、脚本退出码 0 和旧日志都不能单独证明完成。

## 定位工作区

1. 优先查找 `X:\夜雨\游戏自动化研究`，其次查找 `G:\夜雨\游戏自动化研究`。
2. 读取 `game-automation-policy.json`、当天 `daily-status\YYYY-MM-DD.json` 和本周 `daily-status\weekly\YYYY-Www.json`。
3. 游戏日以 Asia/Shanghai 04:00 为界。04:00 前归前一个自然日。
4. 执行或改代码前，读取 `一条龙队列说明.md` 和相关游戏的最新权威工具日志。

## 运行流程

1. 检查 `daily-status\human-takeover.json`。租约有效时，不启动游戏、不点击窗口、不恢复焦点、不清理进程。
2. 先 dry-run：

```powershell
scripts\Invoke-StableGameWorkflow.bat -Game <GameId> -Cadence Daily
```

3. 用户明确要求实际完成时，一次执行一个游戏：

```powershell
scripts\Invoke-StableGameWorkflow.bat -Game <GameId> -Cadence Daily -Execute
```

4. 周常单独运行和记账。只读证据检查也走稳定入口：

```powershell
scripts\Invoke-StableGameWorkflow.bat -Game <GameId> -Cadence Weekly -Execute
```

5. 同一游戏确实需要日常后立即复核周常时才用 `-Cadence Both`。不要用多游戏 `-AllowMultipleSteps`。
6. 高权限游戏只有在计划任务已验证 Ready 时才加 `-UseElevatedTasks`。
   总复核使用 `scripts\Test-ElevatedDailyTasks.bat -Target Required -Strict`；ZZZ 不属于必需高权限任务。
7. 结束后核对状态 JSON、`daily-status\attempts`、权威日志、截图和残留进程。状态不是 `done` 时必须说明缺失证据或阻塞。
8. 实验列表中的手游 `FGO`、`BD2`、`CZN` 都要进入执行/核对范围，不因缺少成熟一条龙而静默跳过；启动和抓图不能冒充完成。

## 雷电手游

FGO、BD2、CZN 统一使用雷电。BD2/CZN 的保守入口为：

```powershell
scripts\Invoke-LDPlayerMobileGame.bat -Game BD2 -Execute -Capture -WriteReport
scripts\Invoke-LDPlayerMobileGame.bat -Game CZN -Execute -Capture -WriteReport
```

该入口只启动包、抓截图/UI 树并用 Windows OCR 分类，点击数固定为 0。登录、验证码、使用条款、隐私政策进入 `human_required`。CZN 只认腾讯国服包 `com.tencent.czn`，官方安装源为 TapTap 应用 759688 或 WeGame；国际服 `com.smilegate.chaoszero.stove.google` 永久排除，不能执行或提供完成证据。没有权威每日 marker 时保持 `review_required`。FGO 继续使用 `Run-FGO-Daily.bat` 的 BBchannel/FGA 路线。

BD2 无法连接时先检查雷电内代理客户端包 `com.github.metacubex.clash.meta`。缺失时使用 `scripts\Install-BD2-ProxyClient.bat`：默认 dry-run，真实下载/安装必须显式 `-Execute`，有效人工接管租约存在时拒绝安装；租约结束后静默 ADB 安装并核对前台 Activity 未变化。只允许 MetaCubeX 官方 GitHub Release，按 ABI 选 APK并校验官方 SHA-256，API 限流时可使用已缓存且带官方摘要的 release manifest。安装后还必须由 `dumpsys connectivity` 证明活动网络含 `Transports: VPN`；仅安装 APK 不算就绪。脚本不得启动代理、导入订阅或记录订阅地址；需要订阅/凭据或批准 VPN 时进入人工接管。

## 人工接管

登录、账号选择、验证码、协议或隐私确认出现时，立即建立接管租约再请用户操作：

```powershell
scripts\Set-GameAutomationTakeover.bat -Mode Begin -Game <GameId> -Reason "需要登录或确认" -Execute
```

用户明确说“已登录”“输入好了”后，清除租约并恢复该游戏：

```powershell
scripts\Invoke-StableGameWorkflow.bat -Game <GameId> -Cadence Daily -ResumeAfterHumanTakeover -Execute
```

接管期间不要清理用户正在操作的游戏、启动器或雷电窗口。

## 判定规则

- `done`：本轮新增的权威日志片段满足该游戏全部完成条件，且没有同轮失败条件。
- NIKKE 的 `done` 还必须同时包含 `nikke.outpost`、`nikke.dispatch_friend`、`nikke.daily_shop` 三个完成 Mark 与根级 `daily_done`；子树 success 不足以完成。
- `review_required`：进程退出或工具返回成功，但缺少权威完成证据；不要盲重试或改成完成。
- `human_required`：需要用户输入或同意；保留现场并停止后续队列。
- `blocked` / `failed`：保存日志和截图，只对策略标记为可恢复的类别做一次有界重试。
- 周常与日常分开。每日完成不能推导周常完成，配置了周常任务也不能推导执行成功。

## 固定安全边界

- 不执行购买、抽卡、分解、强化、交易、账号设置、PVP、排行榜或不可逆选择。
- 不消耗燃料、体力药或保留资源；只使用自然恢复资源。
- 模拟器统一使用雷电。雷电宿主进程允许常驻，不把它单独视为 FGO/BD2/CZN 正在自动化。
- 绝区零的“枯萎之都”永久排除；不得启用，也不计入周常缺项。
- FGO、BD2、CZN 没有权威完成入口时保持 `manual` / `review_required`，不得用环境探针冒充完成。

## 修改与验证

修改工作流时保持策略、执行、状态和 GUI 分层：安全禁项在 `game-automation-policy.json`，执行入口在 `scripts`，状态文件是唯一运行真源，GUI 只投影状态。

至少运行：

```powershell
scripts\Test-StableGameWorkflow.bat
scripts\Test-DailyGame-GUI.bat
```

需要排查状态结构、失败分类或周常证据契约时，读取 [工作流契约](references/workflow-contract.md)。
