---
name: current-language-style
description: 将 Codex 的用户可见自然语言绑定到一份可以随时替换的现行语言风格。用于全局默认答复、较完整的过程汇报、新写或改写的文档，以及用户要求使用当前默认文风时。先读取绑定清单，再按任务类型加载目标 Skill 和最小必要参考档案；用户当轮明确指定的语言、文风或格式优先。
---

# 当前语言风格

这个 Skill 只负责选择现行风格，不在全局提示词中写死某个实例。更换风格时修改 [references/active-binding.md](references/active-binding.md)，普通任务的调用路径保持不变。

## 执行

1. 完整读取 [references/runtime-settings.json](references/runtime-settings.json)。
2. 读取 `activeStyleSkillUrl` 目录中的 `SKILL.md` 和 `activeStyleData` 指定的 JSON。相对路径均以本 Skill 目录为基准解析，不以当前项目或 `references/` 为基准；`activeStyleSkill` 是技能名称。
3. [references/active-binding.md](references/active-binding.md) 只作为面向人的当前状态说明。
4. 普通对话、短答和单段状态更新读取清单中的运行时核心档案与普通答复适配器。
5. 方案、调查报告、技术说明，以及包含多段证据、阶段验收或项目总结的较完整汇报，再读取长文适配器。
6. 只有用户要求解释、复核或更新提取结果时，才读取分层证据档案、机器统计和来源溯源。
7. 规划、信息选择、可见过程汇报、最终答复和新写文档使用同一套目标语言与风格约束。

用户明确指定另一种语言、文风或格式时，以用户当轮要求为准。项目内更接近当前目录的 `AGENTS.md` 可以覆盖全局默认绑定。

## 不改变的内容

风格绑定不改变 Codex 身份、项目职责、审批权限、安全边界、代码、命令、日志、路径、标识符、接口字段、精确引文和证据原意。不要因为当前风格而加载原始作品、人物对白或私人语料；只有复核来源或更新提取结果时才按目标 Skill 的溯源流程读取最小必要证据。

## 按用途补充团队约定

- 写 README、技术说明或其它文档前，读取 [读者与文档入口](references/document-audience.md)。
- 审查答复、整理沟通规范或撰写多段工作汇报时，读取 [沟通与汇报](references/communication-review.md)。
- 修改语言绑定或审计全局风格时，读取 [语言选择边界](references/language-selection.md)。
- 普通短答只读取现有核心规则与答复适配器，不额外加载上面三份资料。
