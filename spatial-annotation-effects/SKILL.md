---
name: spatial-annotation-effects
description: 逐帧定位、角色部位跟随、AE 挂点、粒子路径、遮罩、轨迹或时序表现校对时使用。复用 visual-annotation-effects 的坐标合同；单图与 UI 还原直接使用视觉标注入口。
---

# 空间与时序标注入口

保留既有技能名称与调用路径，统一从 [视觉标注](../visual-annotation-effects/SKILL.md) 读取共同流程，再读其 [多帧标注](../visual-annotation-effects/references/motion-annotation.md)。

明确语义目标、帧号、可见性与坐标系；生成 JSON 和预览并自检，再按同一数据实现及验证漂移。世界坐标或引擎挂点先读取实际 Transform/骨骼及其投影关系，不能由二维截图直接推断深度。

本入口只负责选择空间与时序路线，不再复制 UI 坐标、预览确认或工具例外规则。原有 UI 请求继续转到视觉标注，不要求调用者改名。
