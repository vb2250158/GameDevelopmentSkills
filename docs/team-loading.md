# 团队技能加载与更新

给使用 AI 协作的程序、美术和策划。共用技能来自 [GameDevelopmentSkills](https://github.com/vb2250158/GameDevelopmentSkills)，项目专用规则随项目自身更新。

## 团队成员只需更新两处

项目已经包含加载入口时，首次把公共仓库克隆到项目同级的 `GameDevelopmentSkills` 目录。项目可以有不同名称；多个项目共用这一份仓库。

```text
工作目录/
├─ GameDevelopmentSkills/
├─ GameA/
└─ GameB/
```

```powershell
# 在项目的父目录执行，只在首次使用时克隆。
git clone https://github.com/vb2250158/GameDevelopmentSkills.git

# 后续先检查本地修改，再拉取；遇到差异先合并，勿强制覆盖。
git -C ./GameDevelopmentSkills status --short
git -C ./GameDevelopmentSkills pull --ff-only
```

然后正常更新需要工作的私有项目（如 SVN Update）。项目入口会让 AI 直接读取公共仓库的当前技能，项目技能则读取项目自身文件。无需重新复制技能、运行安装器或传递个人目录。已有任务应在更新后重新读取适用技能；文件更新不会自动替换任务已经读入的旧文字。

首次接入可以直接发给 AI：

> 请按当前项目 AGENTS.md 和 .agents/skills/shared-game-development/SKILL.md 加载 GameDevelopmentSkills。检查 .agents/shared-skills.json 的路径，读取当前仓库清单及本次适用技能。检查本地差异后更新公共仓库和当前项目，报告解析路径及缺少的依赖。

公共仓库不在项目同级时，将当前进程 `GAME_DEVELOPMENT_SKILLS_ROOT` 指向它的绝对路径。共享配置保留相对路径，不提交个人电脑目录。找不到时报告实际路径，不遍历磁盘或默默使用旧的个人技能副本。

## 已有个人规则的电脑

若个人 `AGENTS.md` 仍强制读取个人路径下的同名技能，按 [全局入口模板](../agent-instruction-maintenance/references/global-AGENTS.md) 合并“共享源优先”和任务触发条件，不整份覆盖个人文件。保留个人账号例外和机器配置，不把它们提交到公共仓库或项目。公共仓库更新不会自动修改个人全局规则。

可交给另一端 Agent：

> 更新后请检查个人与项目 AGENTS.md 的同名技能来源。项目配置共享入口时只读取共享正文；普通状态查询、路径查找和文案修改不触发编程实施或系统化巡检。先展示差异，取得本机规则修改授权后精确合并，保留账号、凭据和项目安全边界。最后验证共享加载，并重新读取本任务适用规则。

## 维护者首次接入项目

1. 将 [配置模板](../templates/shared-skills.json) 放入项目 `.agents/shared-skills.json`。
2. 将 [加载入口](../templates/shared-game-development/SKILL.md) 放入项目 `.agents/skills/shared-game-development/SKILL.md`。
3. 在项目根 `AGENTS.md` 写明：共用技能先读取 `.agents/skills/shared-game-development/SKILL.md`，然后按任务读取共享源文件。其它 Agent 的入口（例如 `.github/copilot-instructions.md`）引用同一个根入口。
4. 检查项目必需的专用技能、脚本和引用是否随项目提交。内部服务和业务规则留在私有项目；不要把个人账号、凭据或全局设置复制过来。
5. 提交这些精确文件，团队成员更新项目即可得到入口。不要假定所有 Agent 都会自动注册外部技能；入口要求按实际文件路径显式读取。

检查命令只读取文件：

```powershell
pwsh -NoProfile -File ./GameDevelopmentSkills/scripts/Test-SharedSkillLoading.ps1 -ProjectPath ./GameA
```

成功时显示项目与公共仓库的实际路径、15 个技能和已解析依赖。该检查覆盖文件入口、清单和语言绑定；Agent 是否实际读取、外部工具连接和 Unity 运行效果另需在使用端核验。

## 外部软件

阅读 Markdown 技能本身不需要安装 Python 或 Unity 插件。操作 Prefab、浏览器、表格、内部服务时才按 [依赖说明](dependencies.md) 检查相应软件、连接器和账号。拉取仓库不会替使用者登录，也不会自动安装软件。普通改图和文案工作不以 PM、发布或账号配置作为前置流程。

## 独立复制安装（可选）

仅适用于需要独立技能副本的项目。采用前面的直接引用方式时不运行本节。旧副本不会随公共仓库拉取自动刷新；改用直接引用后，项目入口明确读取共享源，维护者确认无项目改写内容后才清理旧副本。


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
