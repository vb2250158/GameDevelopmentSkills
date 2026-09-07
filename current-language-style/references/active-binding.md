# 当前绑定

程序实际读取 [runtime-settings.json](runtime-settings.json)。本页用于人工查看。

- 正式名称：务实极简风格
- 机器 Skill：`direct-evidence-language-style`
- Skill 入口：读取已安装的上述机器 Skill 的 `SKILL.md`
- 运行时核心档案：目标 Skill 内的 `references/core-style.md`
- 普通答复适配器：目标 Skill 内的 `references/reply-style.md`
- 长文附加适配器：目标 Skill 内的 `references/document-style.md`；方案、调查、技术说明、README、多段证据汇报、阶段验收和项目总结均加载
- 主要目标：先判断文字用途，只保留读者必须知道的信息，输出最短完整版本
- 过程汇报：每个自然段不超过 50 个字符
- 使用边界：模板句式不是绝对禁用；只有确实纠正误解、说明关系或缩短理解路径时才使用
- 档案版本：`2026-08-13-v3`
