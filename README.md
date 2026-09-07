# GameDevelopmentSkills

这个开源仓库维护可复用的游戏研发 AI 技能。项目通过版本管理的加载入口直接读取这份公共仓库。团队更新公共仓库与各自项目即可取得规则，不必重复复制个人技能。

## 开始使用

- **在项目中使用**：[技能加载说明](docs/team-loading.md)，包含首次克隆、日常更新、项目入口与路径检查。
- **缺少工具或插件**：[依赖说明](docs/dependencies.md)，区分技能文件、电脑软件和项目私有流程。
- **维护共享技能**：[维护说明](docs/maintaining.md)，说明本地来源、同步与更新检查。
- **查看本轮整理范围**：[14 项技能整理记录](docs/skill-review.md)，说明保留、调整和验证范围。

只克隆仓库不会自动加载全部技能。项目接入后，按加载说明让 AI 明确读取公共仓库中的适用技能；未接入的项目先添加入口。不要一次性加载整个仓库。

## Skills

| Skill | 用途 |
| :--- | :--- |
| [`current-language-style`](current-language-style/) | 选择当前语言风格，配套安装下方风格技能；绑定使用相对路径。 |
| [`direct-evidence-language-style`](direct-evidence-language-style/) | 用简短、具体的中文解释结果、证据和剩余事项。 |
| [`continuous-task-execution`](continuous-task-execution/) | 推进多步任务、处理失败并按实际验收结果收尾；不安装全局 Hook。 |
| [`unity-prefab-source-editing`](unity-prefab-source-editing/) | 查看、比较和小范围修改 Unity 文本 Prefab；另需安装 Python 解析工具。 |
| [`read-tencent-docs-opendoc`](read-tencent-docs-opendoc/) | 读取、搜索腾讯文档 opendoc 数据，并在明确授权时通过腾讯文档 MCP 修改在线表格。 |
| [`ai-automation-workflow`](ai-automation-workflow/) | 从腾讯文档任务清单拉取待处理项，整理本地任务包，分析方案，回填方案并推进已确认修复。 |
| [`project-progress-pm`](project-progress-pm/) | 基于腾讯文档项目进度表做 PM 巡检，维护状态批注，拆分待实现 / 待验收 / 待确认队列并推进闭环。 |
| [`github-submit-workflow`](github-submit-workflow/) | 通用 GitHub 提交流程，包含改动核对、脱敏处理、详细版本日志、提交说明和推送。 |
| [`ai-code-security-review`](ai-code-security-review/) | 审查 AI 辅助代码与 Agent 执行链的秘钥、信任边界、危险执行和发布风险。 |
| [`github-pull-workflow`](github-pull-workflow/) | 通用 GitHub 拉取流程，包含版本日志阅读、备份、拉取合并、冲突处理和配置/逻辑迁移。 |
| [`programming-design-style`](programming-design-style/) | 写逻辑前加载适用规范，以此约束后续设计、编码、修改和验证，并按照规范实现。 |
| [`programming-design-review`](programming-design-review/) | 针对已有逻辑使用：分析实现、检查代码规范和设计，给出结论与代码证据；进入修改前转用设计风格规范。 |
| [`clear-science-writing`](clear-science-writing/) | 撰写、改写和审阅中文说明、科普、技术介绍与项目叙述，让非专业读者能理解内容，同时保留事实和证据边界。 |
| [`run-stable-game-automation`](run-stable-game-automation/) | 以权威日志证据、人工接管租约、全局锁和有界重试安全运行并复核游戏每日/周常。 |

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

当前内容同步自维护者使用的 Agent skills 目录。安装时使用团队所用 Agent 支持的 skills 目录，不依赖维护者的本机路径。

同步时建议整目录复制对应 skill，而不是只复制 `SKILL.md`，这样可以保留脚本、模板、参考文档和 agent 配置。

`programming-design-style` 与 `programming-design-review` 需要配套使用，安装后保持两个目录同级：写逻辑前加载设计规范并遵照实现；检查已有逻辑时使用巡检入口。
