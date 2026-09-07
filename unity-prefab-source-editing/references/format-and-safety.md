# Unity YAML 格式和安全边界

## 数据关系

一个文本 Prefab 由多个 YAML 文档块组成。每个块的头部 anchor 是本地 `fileID`：

```yaml
--- !u!1 &1158508787625206
GameObject:
```

常见关系：

- `GameObject.m_Component[].component.fileID` 指向组件文档。
- `Transform.m_GameObject.fileID` 指回所属 GameObject。
- `Transform.m_Father.fileID` 与 `Transform.m_Children[].fileID` 共同表达层级。
- `MonoBehaviour.m_Script.guid` 指向脚本 `.meta`。
- `m_CorrespondingSourceObject`、`m_PrefabInstance`、`m_PrefabAsset` 和 `m_Modification` 参与嵌套 Prefab 与 Variant 覆盖。

只改现有普通字段时，不应改动上述关系。

## 字段路径

CLI 使用点号和列表下标：

```text
m_Name
m_SizeDelta.x
m_Component[0].component.fileID
m_Modification.m_Modifications[2].propertyPath
```

`set` 要求最后一个字段已经存在，不会静默新增键或扩展列表。

## 结构修改条件

只有同时满足以下条件，才使用 `--allow-structural`：

1. 已列出新增、删除和保留的全部 YAML 文档 anchor。
2. 已核对 GameObject、Component 和 Transform 双向引用。
3. 已核对嵌套 Prefab、Prefab Variant 和对应源对象关系。
4. dry-run diff 只包含预期文档块和引用。
5. 写后 `validate` 没有重复 anchor 或缺失本地引用。
6. 项目要求的 Unity 导入、编译和入口验证仍会执行。

当前 CLI 只提供字段级写入。新增或删除完整 YAML 文档块需要先扩展下游库或 CLI，并增加覆盖该关系的测试。

## 下游维护

```powershell
Set-Location "<实际 unity-yaml-parser 仓库目录>"
git remote -v
git fetch upstream
git status --short
```

`origin` 保存自己的修改，`upstream` 只用于获取原项目更新。合并上游前先运行：

```powershell
& .\.venv\Scripts\python.exe -m pytest -q
```

Skill 的包装脚本通过 editable 安装使用该工作区，不需要重新打包；依赖或入口变化后重新运行安装脚本和 Skill 验收。
