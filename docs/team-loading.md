# 游戏项目技能加载说明

给使用 AI 协作的程序、美术和策划。公共技能来自 [GameDevelopmentSkills](https://github.com/vb2250158/GameDevelopmentSkills)，项目专用规则继续使用各项目自己的资料。

## 直接发给 AI

> 当前项目需要使用 https://github.com/vb2250158/GameDevelopmentSkills 的共用技能。请优先使用本机已有的对应仓库，核对远端与本地改动后更新；没有时克隆到我指定的工具目录。读取 docs/team-loading.md，预览并安装团队基础技能到项目的 .agents/skills/，保留已有项目技能和本地修改。按任务加载对应 SKILL.md 及其必要引用，不要全文加载整个仓库。项目入口使用本文的共用技能片段，与已有 AGENTS.md 合并；不要覆盖整个文件。报告实际安装位置、缺少的依赖和验证结果。

这是安装与接入请求。克隆地址或读过 README 本身不表示安装完成。安装后的技能通常在后续任务或下一轮发现；若尚未列出，使用完整本地路径显式读取 `SKILL.md`，检查 Agent 的实际技能列表。

## 安装到项目

需要 Git 和 PowerShell 7。把示例路径替换成该电脑的实际目录；工作副本仍使用团队指定的正式目录。

```powershell
git clone https://github.com/vb2250158/GameDevelopmentSkills.git "D:\Tools\GameDevelopmentSkills"
Set-Location "D:\Tools\GameDevelopmentSkills"

# 先检查目标和文件差异，不写入。
pwsh -NoProfile -File .\scripts\Install-TeamSkills.ps1 -ProjectPath "D:\Projects\MyGame"

# 执行同一份安装。只新增文件，相同内容跳过，有不同内容时整批停止。
pwsh -NoProfile -File .\scripts\Install-TeamSkills.ps1 -ProjectPath "D:\Projects\MyGame" -Apply

```

已有此仓库时检查 `git status --short` 和远端差异后更新，不重复克隆或覆盖目录。安装会向 `.agents/skills/` 添加文件；项目用 SVN 时按项目流程检查并提交这些精确路径。脚本不修改 `Assets`、`AGENTS.md`、账号配置或已存在的不同内容。

基础清单见 [team-skills.json](../team-skills.json)：安装语言入口及其绑定风格、持续执行、编程设计与设计巡检，共五个技能。设计规范与巡检、语言入口与风格分别保持同级。

美术需要查看 Prefab 源文件时，可在安装命令末尾增加 `-Include unity-prefab-source-editing`；该技能的 Python 依赖另按[依赖说明](dependencies.md)安装。其它可选技能按实际任务安装，不把 PM、外部发送、发布或安全审查流程变成每次改图的前置条件。

## 项目入口写什么

把下面片段合并到当前项目的 `AGENTS.md`，保留原有内容。路径都相对当前项目根目录。已有同类段落时修改原段落，避免重复维护。

```markdown
## 共用 AI 技能

共用技能来自 https://github.com/vb2250158/GameDevelopmentSkills，项目安装目录为 `.agents/skills/`。更新和依赖说明见该仓库 `docs/team-loading.md`。

- 用户可见答复使用 `.agents/skills/current-language-style/SKILL.md`，再按其中相对绑定加载风格与必要档案。
- 多步实施、调试和研究使用 `.agents/skills/continuous-task-execution/SKILL.md`；普通短答不启动完整工程流程。
- 写逻辑前使用 `.agents/skills/programming-design-style/SKILL.md`；分析已有逻辑使用 `.agents/skills/programming-design-review/SKILL.md`。
- Prefab 源文件任务在已安装时使用 `.agents/skills/unity-prefab-source-editing/SKILL.md`。缺少解析工具时按技能说明安装；源文件检查与 Unity 导入、视觉及运行验收分别报告。
- 只读取当前任务需要的技能及引用。缺失时报告精确路径和依赖，继续可独立完成的工作，不声称已经读取。
- 项目自己的配置、资源、SVN、发布和验收规则继续适用；共用技能不扩大用户授权。
```

对于 Copilot 或其它 Agent，把同一段项目路由放进其支持的入口，或明确要求它读取根 `AGENTS.md`；不要假定所有工具都会自动识别 `.agents/skills/`。现有无条件确认与授权规则冲突时，按负责人确认的现行规则统一，不能只加一个新链接而保留互相矛盾的要求。

## 项目专用技能

可选技能的同仓库依赖由安装器自动补齐，例如选择 `project-progress-pm` 会同时安装表格协作与腾讯文档读取。外部软件仍按依赖说明单独配置。

具体项目的配置、资源、存档、部署和验收规则由项目自己的入口与技能维护。个人目录中被团队必需流程引用的技能，应在确认可共享范围后迁入对应项目，并修复相对引用；私有内容不进入本公共仓库。

没有根 `AGENTS.md` 时可用上述片段建立共用技能入口，再补充项目自己的规则。已有其它 Agent 入口时保留并核对适用约束。专项资料按实际存在的文件定位；缺失时取得原文件或修正错误路由，不用名字相似的资料冒充替代，也不照搬另一项目的内部规则。

## 检查是否接入成功

让 AI 报告五个基础技能的实际路径，读取语言绑定中的目标文件，再按一个真实小任务只加载适用资料。安装脚本再次运行应报告 `AddedOrPlanned=0`。如果已有文件不同，比较并合并差异后再运行，脚本没有强制覆盖选项。

安装成功只说明文件已就位。远端美术电脑上的 Agent 发现、Unity 插件连接和界面效果仍在该电脑检查。
