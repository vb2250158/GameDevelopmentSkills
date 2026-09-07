---
name: shared-game-development
description: "为当前项目定位和加载共用游戏研发技能。用于技能发现、团队接入，以及读取共享语言、实施、审查或 Unity 源文件编辑规范前的路径解析。"
---

# 加载共用技能

本文件随项目更新，共用技能正文由 GameDevelopmentSkills 仓库维护。

1. 以当前项目根目录为起点读取 `.agents/shared-skills.json`。`repositoryPath` 相对项目根目录解析，不相对当前终端目录；当前进程设置了 `GAME_DEVELOPMENT_SKILLS_ROOT` 时使用该绝对路径。
2. 在解析出的公共仓库读取 `team-skills.json`，确认 `schemaVersion=1`。按任务选择其中 core 或 optional 的名称，读取 `<公共仓库>/<名称>/SKILL.md`，再按正文相对路径加载必要引用。不得拼接未登记名称或从个人技能目录兜底。
3. 用户可见文字使用 `current-language-style`；多步实施使用 `continuous-task-execution`；写逻辑使用 `programming-design-style`；审查逻辑使用 `programming-design-review`；Prefab 源文件操作使用 `unity-prefab-source-editing`。其余技能按触发条件加载。
4. 对这些公共名称，明确读取公共仓库当前正文，避免个人目录或以前安装的副本覆盖团队版本。项目专用技能继续从项目 `.agents/skills/` 读取。语言风格绑定按公共仓库原来的相对关系解析。
5. 仓库缺失时报告解析后的路径，并按 `docs/team-loading.md` 完成首次克隆；不得声称已读取。更新只需 Git 拉取公共仓库与项目自身版本控制更新，无需重复复制、安装或建立符号链接。
6. 技能文件就位不等于外部软件、账号和服务就绪。只在实际任务需要时读取公共仓库 `docs/dependencies.md`，发现当前可用能力；缺失软件按授权安装，缺少账号或服务配置时报告具体缺口，继续独立工作。

入口只负责解析与路由，不自动加载全部技能，也不授权发布、发送消息或写入真实数据。

所有 Skill 的标题、触发描述、操作说明、配套参考和界面提示统一使用中文；技能标识、文件名、命令、代码与 API 字段保持原样。后续新增和修改继续遵循本约定。
