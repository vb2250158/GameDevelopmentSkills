---
name: visual-annotation-effects
description: 按参考图还原 UI、标注元素位置或精确比较截图时使用；将坐标与规则写为 JSON，生成可查看的标注预览，再按同一数据实现和验证。普通创意构图与不涉及位置的文案修改不强制坐标流程。
---

# 视觉标注与精确还原

本技能拥有单图、UI 与多帧标注的共同坐标合同。空间入口复用本规则，不维护第二套坐标与确认要求。

## 最小流程

1. 查看源图或帧，区分用户指定的目标、参考与当前实现。记录源版本、尺寸及对象；工具/Inspector 实测值优先于视觉估计。
2. 写清坐标系、原点、尺寸、缩放与映射。多模态观察确定语义对象；工具用于绘制、裁剪、转换和验证。用户要求算法检测或无法看图时，可产生 `toolCandidates`，经可视复核或用户确认后再作为最终点。
3. 记录 JSON：稳定 `id`、`bbox`/`anchor`/路径、用途、依据、置信度和未决项。原对象名保留，需要别名时显式记录。
4. 用实际可用的图像工具按 JSON 生成预览并查看自检；按用户指定方式及该工具的技能执行。文字描述或未标点的原始拼图不算预览。
5. 自检通过后继续已授权实现。用户要求先确认或目标含义仍不明确时，交付具体预览等待该项决定；其它可执行工作继续。无需为已明确目标重复索批。
6. 对照同版本 JSON、目标图与最终运行结果验证；错误先修标注/映射，再修实现并重跑。

| 任务 | 按需读取 |
| --- | --- |
| bbox 还原、RectTransform、Inspector 或 UI 视觉对比 | [UI 坐标与验证](references/ui-coordinate-mapping.md) |
| 逐帧、AE、挂点、轨迹与遮挡 | [多帧标注](references/motion-annotation.md) |

## 坐标合同

写清 `source`、`coordinateSpace`、`origin`、`dimensions`、`scalePolicy`。不同坐标系分区存储并记录转换，不能把图片像素直接当作布局单位。

```json
{
  "source": "reference.png",
  "coordinateSpace": "source_pixels",
  "origin": "top_left",
  "dimensions": { "width": 1920, "height": 1080 },
  "scalePolicy": "no_extra_scale",
  "elements": [{
    "id": "primary_button",
    "bbox": { "x": 1320, "y": 862, "w": 310, "h": 86 },
    "anchor": { "x": 1475, "y": 905 },
    "role": "确认按钮",
    "confidence": 0.92,
    "sourceOfCoordinates": "multimodal_visual_estimate"
  }],
  "toolCandidates": [],
  "openQuestions": []
}
```

检查尺寸非负、坐标与源图边界一致；部分越界或裁切是预期时明确记录。置信度是估计，不能用某个分数代替语义复核。

## 预览和结果

正式 UI 批注保留源图比例，扩大画布，源图内只画框、锚点与引线，编号和说明卡放在原图外侧。时序诊断的帧号与路径标签可置于帧内，但不能遮住待判断目标。

交付 JSON、预览、映射与已验证结果；只做标注时到此结束，不修改工程。要求精确还原时列出必需元素的预期/实际值及误差。若已跳过预览，先核对本次改动并补齐可复核依据，再按原授权修正，避免继续叠加错误。
