---
name: unity-prefab-source-editing
description: "在不启动或连接 Unity 时，直接读取、验证、比较和精确修改文本序列化的 Prefab YAML。用于源码、fileID 字段、序列化引用与无损往返检查；不替代需要 Unity 导入或运行验证的视觉制作。"
---

# Unity Prefab 源文件编辑

使用 `socialpoint-labs/unity-yaml-parser` 的可维护下游，直接处理文本序列化的 Unity `.prefab`。工具不启动也不连接 Unity。

## 本机依赖

- 下游仓库：优先使用环境变量 `UNITY_YAML_PARSER_REPO`，否则使用当前用户目录下的 `.local/share/unity-yaml-parser`。安装和调用使用同一规则。
- `origin`：`vb2250158/unity-yaml-parser`
- `upstream`：`socialpoint-labs/unity-yaml-parser`
- Python：仓库内 `.venv`，以 editable 模式安装；修改下游源码后立即生效。
- 统一入口：`scripts/invoke-unity-prefab-yaml.ps1`

需要 Git、PowerShell 和带 `py` 启动器的 Python 3.11。仓库或环境缺失时，在用户授权安装依赖后运行 `scripts/install-unity-yaml-parser.ps1`。安装脚本不自动 pull，也不覆盖已有本地修改。指定 `-TargetPath` 时，后续调用须把 `UNITY_YAML_PARSER_REPO` 设为同一路径；只需当前进程变量，不必写永久环境变量。

## 适用范围

- 按 `fileID` 查看对象类型、字段和值。
- 修改已存在的标量、映射或列表元素。
- 写入前生成完整 diff，不连接 Unity。
- 检查解析结果、重复 anchor 和缺失的本地 `fileID` 引用。
- 检查目标文件经过解析和重新序列化后是否字节一致。

新增或删除 GameObject、Component、YAML 文档块、嵌套 Prefab 或脚本组件时，不把普通字段修改当作安全结构编辑。需要直接改结构时，先读取 [references/format-and-safety.md](references/format-and-safety.md)，建立并验证完整 `fileID` 关系。

## 写入流程

1. 确认目标是文本 YAML，且用户没有在 Unity 中未保存地编辑同一 Prefab。
2. 按目标项目要求完成任务归属和版本控制状态检查；不把某个项目的发布或数据规则应用到其它项目。
3. 运行 `roundtrip`。只有 `byteIdentical=true` 才进入普通字段写入。
4. 用 `inspect` 和 `get` 确认精确 `fileID`、类型和字段路径。
5. 运行不带 `--write` 的 `set`，检查完整 unified diff。
6. 只在用户已授权该目标修改、diff 没有无关变化时，加 `--write --ack-source-edit`。
7. 运行 `validate`、`roundtrip` 和版本控制 diff。视觉、序列化引用或运行行为仍按项目要求在 Unity/目标包验证。

写入备份默认放在系统临时目录的 `unity-prefab-source-editing-backups`，不能在 `Assets` 内生成 `.bak` 文件。

## 命令

```powershell
$tool = "<实际技能目录>\scripts\invoke-unity-prefab-yaml.ps1"

& $tool roundtrip "C:\Path\To\Foo.prefab"
& $tool inspect "C:\Path\To\Foo.prefab" --class-name RectTransform
& $tool get "C:\Path\To\Foo.prefab" --anchor 224123456789 --field "m_SizeDelta.x"

# 默认只输出 diff
& $tool set "C:\Path\To\Foo.prefab" `
  --anchor 224123456789 `
  --field "m_SizeDelta.x" `
  --value "320"

# 确认 diff 后写入
& $tool set "C:\Path\To\Foo.prefab" `
  --anchor 224123456789 `
  --field "m_SizeDelta.x" `
  --value "320" `
  --write --ack-source-edit

& $tool validate "C:\Path\To\Foo.prefab"
```

复杂值使用 JSON：

```powershell
& $tool set "C:\Path\To\Foo.prefab" `
  --anchor 224123456789 `
  --field "m_SizeDelta" `
  --value-json '{"x":"320","y":"180"}'
```

修改 `m_Component`、`m_Children`、`m_Father`、`fileID`、`guid` 等结构或引用字段时，CLI 会拒绝；明确完成关系审计后才能增加 `--allow-structural`。

## 已知限制

- 上游明确说明，多行单引号或双引号字符串的换行格式可能与 Unity 不完全一致；`roundtrip` 不一致时停止写入。
- 该工具只证明源文件解析、目标 diff 和基础引用关系；不能证明 Unity 导入、组件类型、Prefab Variant 覆盖、视觉或运行结果。
- 不直接编辑二进制资源，不处理未启用 Force Text 的 Prefab。
