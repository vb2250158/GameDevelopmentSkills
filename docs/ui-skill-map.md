# UI 技能分工与迁移

2026-11-02 整理。通用规则由共享仓库维护，项目入口保存适配；第三方技能沿其官方来源安装。保持现有技能名及 `<name>/SKILL.md` 路径，按当前任务加载，不一次读取整个集合。

## 使用路线

项目 UI 入口 → [ui-design-workflow](../ui-design-workflow/SKILL.md) → 本次需要的能力。没有项目入口时，先核对当前设计系统与组件，再使用通用流程。

| 阶段或问题 | 规则拥有者 | 与相邻能力的边界 |
| --- | --- | --- |
| 任务分流、复用与项目适配 | `ui-design-workflow` | 选择路线，不重复工程规则 |
| 用户任务、导航、文案和说明 | `design-for-users` | 负责用户理解，不指定品牌和框架 |
| 保存、加载、等待与恢复 | `design-responsive-interactions` | 负责连续交互，不复制数据拥有权 |
| 操作状态与效果图覆盖 | `gameplay-screen-effect-inventory` | 决定要表达哪些状态，不规定横竖屏或生成工具 |
| 坐标、批注、映射和视觉比较 | `visual-annotation-effects` | 单一坐标规范及 UI/多帧参考 |
| 空间与时序旧入口 | `spatial-annotation-effects` | 保留名称，转入视觉标注与多帧参考 |
| 会话、未读、消息投递与导航 | `design-chat-app-experience` | 产品语义，不另造存储或重试框架 |
| Avalonia 布局、绑定和焦点 | `avalonia-ui-design` | 平台通用，产品结构与视觉方向在项目 |
| 业务代码与数据写入 | `programming-design-style` | 唯一数据源、配置、性能、生命周期与旧逻辑收尾 |
| 既有实现调查 | `programming-design-review` | 证据和审查流程，修改前使用设计规范 |
| Unity 资产源文件操作 | `unity-prefab-source-editing` | 文件级检查与编辑，不代替 UI 设计和运行验收 |

## 本次候选处置

| 原技能或知识类型 | 处置 | 保留或迁移内容 |
| --- | --- | --- |
| 项目 Unity UI 规范 | 项目适配入口 | 通用复用、缩放及验收提炼到 `ui-design-workflow/references/`；风格、颜色、正式资源、基类、窗口、测试和已校准参数继续在项目 |
| `design-for-users` | 通用共享 | 中文整理用户任务、文案与文档规范 |
| `design-responsive-interactions` | 继续共享 | 复用已有正文，本轮不另写等待规范 |
| `gameplay-screen-effect-inventory` | 通用共享并修正 | 去掉项目角色、固定横屏与特定制作方式要求 |
| `visual-annotation-effects` | 通用共享并整合 | 统一坐标与预览；拆分 UI 映射和多帧细则，修正示例坐标超出图片尺寸的问题 |
| `spatial-annotation-effects` | 兼容入口 | 去掉重复流程及冲突的额外确认，转用统一标注规则 |
| `design-chat-app-experience` | 通用共享 | 保留会话/未读/投递语义；去掉产品迁移案例和私有端点；限定离线副本、未知结果与重试边界 |
| `ar-glasses-gui-design` | 本轮不纳入 | 属于设备专项，继续由对应项目维护；不进入公共清单、安装依赖或 UI 总入口 |
| 产品 Avalonia UI 规范 | 提炼通用能力 | 新增 `avalonia-ui-design`；产品专用导航、配色、尺寸与功能不随共享技能分发 |
| `unity-uiblueprint-manager` | 项目/框架工具 | 当前实现依赖非随包分发的 UI 框架；不作为任意 Unity 工程的即插即用工具发布。通用“布局数据 → 预览 → 验证”方法归入共享工作流 |
| 同事策划与美术知识 | 项目保留 | 私人身份、原始资料、业务规则和工具菜单不复制到公共仓库；确有跨项目方法时单独提炼并核对来源 |
| `ui-ux-pro-max`、`frontend-design`、`prototype` | 外部依赖 | 保留官方来源与安装说明，不复制用户安装副本及整个工具库 |

候选以本次可读取的技能正文与参考为准。截图中未展开的实施配套项按职责使用现有编程、巡检、执行、Prefab 与发布入口，不根据“共 11 项”推断未提供的具体清单。

项目原主文及复用、效果图、Unity 实施、分辨率参考删去已迁移的通用流程，保留原文件作为适配入口。公共 `unity-ui-implementation.md`、`unity-assets-and-audit.md` 和 `unity-resolution-and-input.md` 分别维护实施、资源/关联/自检及缩放/输入；项目仅补充配置、正式组件、清单、固定基准和更具体的验收合同。按这些引用读取后，项目规则与共享规则共同覆盖完整 UI 设计与实施要求。

## 外部技能

按官方文档支持的目录或插件方式安装，保留许可证与版本；发现同名本地改动时先比对再合并。仅安装到当前 Agent 的技能目录，不将整套插件缓存复制进本仓库。

| 能力 | 官方来源 | 使用注意 |
| --- | --- | --- |
| 视觉设计系统与检索 | [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | 按官方 README 安装 CLI/技能；数据与 Python 工具依赖由该项目说明 |
| Web 视觉与实现 | [Anthropic frontend-design](https://github.com/anthropics/skills/tree/main/skills/frontend-design) | 安装该技能及许可证；示例视觉取向不能覆盖项目已有设计系统 |
| 探索原型 | [Matt Pocock prototype](https://github.com/mattpocock/skills/tree/main/prototype) | 区分逻辑与视觉问题；使用隔离测试数据，验证后的结论进入正式实现，临时入口按退役规则清理 |

外部技能是可选工具，不阻断不依赖它们的调查、文案或实现；实际需要而不可用时说明具体缺口。公开目录登记的是本仓库交付的技能，不用同名占位正文冒充已安装第三方能力。

## 接入与验证

直接引用项目更新公共仓库后，从 `team-skills.json` 选择新增名称。复制安装兼容方式：

```powershell
pwsh -NoProfile -File ./scripts/Install-TeamSkills.ps1 -ProjectPath <项目根目录> -Include ui-design-workflow
pwsh -NoProfile -File ./scripts/Install-TeamSkills.ps1 -ProjectPath <项目根目录> -Include ui-design-workflow -Apply
```

第一条只预览。当前复制安装器要求目标是带 Assets/ProjectSettings 的 Unity 工程；其它项目按 Agent 支持的安装方式复制完整技能及依赖，或直接引用公共仓库。不同内容的旧副本需要先备份、核对和合并，安装器不静默覆盖。

验证正文的 UTF-8、frontmatter、JSON、相对引用、依赖闭包、安装幂等与冲突保护。场景用例是人工/Agent 评估材料，静态检查通过不等于已运行所有业务场景。UI 真机、Unity 导入与 Avalonia 运行由对应目标任务验收，本次不宣称这些应用已经通过。
