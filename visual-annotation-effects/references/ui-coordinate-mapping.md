# UI 坐标映射与验证

## 源与缩放

记录 `targetImage`、`currentImage`、根区域、`requiredElements` 和映射。目标只使用用户指定的有效版本；当前截图、旧图与失败中间稿不自动替代目标。

`no_extra_scale` 表示合同中的源尺寸已对应目标逻辑尺寸；只有该前提成立时才直接以 bbox 宽高设置尺寸。图片像素、CSS 像素、Unity Canvas 本地单位与设备物理像素不天然相等。记录确切比例和布局映射后再转换，不猜测追加面板缩放。

对于中心锚点、中心 pivot、未旋转且同单位的父面板，源图左上角 bbox 可转换为：

```text
width  = bbox.w
height = bbox.h
x = bbox.x + bbox.w / 2 - panelBBox.x - panelBBox.w / 2
y = panelBBox.y + panelBBox.h / 2 - bbox.y - bbox.h / 2
```

其它锚点、拉伸布局、变换或父级缩放使用实际变换；先转换到同一坐标系。已知 Inspector/运行工具值时，单独记录 `unityRectTransform` 的 `anchoredPosition`、`sizeDelta`、`anchorMin`、`anchorMax`、`pivot` 和 `sourceOfCoordinates`，不以视觉估计覆盖实测值。

## 层级与复用

区分整组与内部节点：标注容器时移动容器；内部文字或图标只有独立标注时才独立调整。先保护用户差异，定位本次污染的节点及真实来源，再按项目恢复流程修正，不能重置整个场景掩盖问题。

## 验证

从项目正式截图或探针入口取得最后修改后的运行结果。逐必需元素比对数据和像素，预期值来自独立标注或实测源，不能取自实现常量。记录位置、尺寸、裁切、间距与层级；自适应布局比较语义约束与映射后的值。

| 元素 | 预期来源 | 预期位置/尺寸 | 实际位置/尺寸 | 误差与结果 |
| --- | --- | --- | --- | --- |
| 元素 ID | JSON 或 Inspector | 同坐标系 | 运行探针与截图 | 待验证 |

检查目标比例和必要的备用比例；工具或运行条件缺失时明确未验证的层级，不以字段齐全认定视觉通过。
