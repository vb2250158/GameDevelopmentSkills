---
name: read-tencent-docs-opendoc
description: 读取、搜索和在用户明确授权时修改腾讯文档表格。Use when 用户提供 docs.qq.com 的 dop-api/opendoc JSONP 链接、要求 Codex 查看腾讯文档表格行列/单元格、在不粘贴 Cookie 的前提下搜索腾讯文档内容，或使用 TENCENT_DOCS_TOKEN 通过腾讯文档 MCP 修改在线表格。
---

# 读取腾讯文档 Opendoc

## 概览

使用本 skill 读取腾讯文档表格的 `https://docs.qq.com/dop-api/opendoc?...` 授权接口数据。配套脚本会拉取 JSONP 响应，解压腾讯文档内嵌的 workbook/block 数据，解析 protobuf-like 的单元格记录，并输出可搜索的行列文本。

如果用户已经配置 `TENCENT_DOCS_TOKEN`，也可以通过腾讯文档 MCP 调用在线表格写入工具。写入必须是用户明确要求的具体操作，例如指定文档、子表、单元格和写入值；不要在仅“看看”“能不能改”的场景下擅自写表。

不要要求用户粘贴 `cookie`、`DOC_SID`、`uid_key`、`TOK`、`tdocs_sec_ticket` 或浏览器存储内容。如果仅凭 `opendoc` URL 无法访问，优先使用用户已登录的浏览器会话，或让用户导出 `.xlsx` / `.csv`。

## 快速使用

### 读取 opendoc

直接传入 `opendoc` URL：

```powershell
node C:\Users\Administrator\.codex\skills\read-tencent-docs-opendoc\scripts\read-opendoc.mjs --url "<opendoc-url>" --query "关键词"
```

长 URL 或带敏感参数的 URL，优先放到环境变量里：

```powershell
$env:TENCENT_DOCS_OPENDOC_URL = "<opendoc-url>"
node C:\Users\Administrator\.codex\skills\read-tencent-docs-opendoc\scripts\read-opendoc.mjs --query "钓鱼"
```

常用参数：

```text
--query <text>       搜索包含指定文本的行，可重复传多个
--start-row <n>      从第 n 行开始输出，1-based
--end-row <n>        输出到第 n 行，1-based
--limit <n>          最多输出多少行，默认 20
--format text|json|tsv
--include-empty      JSON/TSV 输出中保留空单元格
--zero-based         按腾讯内部 0-based 行列索引输出
--raw-numbers        数字/日期序列值保持原始数字
--out <path>         将输出写入文件
```

### 通过 MCP 读取/修改在线表格

Token 优先从当前进程环境变量 `TENCENT_DOCS_TOKEN` 读取；如果当前 Codex 子进程没有继承，脚本会在 Windows 上兜底读取 `HKCU\Environment\TENCENT_DOCS_TOKEN`。不要在最终回复里打印 token。

列出可用工具：

```powershell
node C:\Users\Administrator\.codex\skills\read-tencent-docs-opendoc\scripts\tencent-docs-mcp.mjs list-tools --query sheet
```

查看在线表格子表信息：

```powershell
node C:\Users\Administrator\.codex\skills\read-tencent-docs-opendoc\scripts\tencent-docs-mcp.mjs get-sheet-info --url "https://docs.qq.com/sheet/DSXprT0RUZ0RJQ0JE?tab=BB08J2"
```

读取区域：

```powershell
node C:\Users\Administrator\.codex\skills\read-tencent-docs-opendoc\scripts\tencent-docs-mcp.mjs get-range --url "https://docs.qq.com/sheet/DSXprT0RUZ0RJQ0JE?tab=BB08J2" --range A1:C3
```

设置单元格：

```powershell
node C:\Users\Administrator\.codex\skills\read-tencent-docs-opendoc\scripts\tencent-docs-mcp.mjs set-cell --url "https://docs.qq.com/sheet/DSXprT0RUZ0RJQ0JE?tab=BB08J2" --cell A1 --value "你好"
```

批量写入多个单元格时，使用 `sheet.set_range_value`。`row` / `col` 均为 0-based，A1 是 `row=0,col=0`：

```powershell
node C:\Users\Administrator\.codex\skills\read-tencent-docs-opendoc\scripts\tencent-docs-mcp.mjs call-tool --name sheet.set_range_value --args '{"file_id":"DSXprT0RUZ0RJQ0JE","sheet_id":"BB08J2","values":[{"row":0,"col":0,"value_type":"STRING","string_value":"你好"},{"row":0,"col":1,"value_type":"STRING","string_value":"世界"}]}'
```

批量写回本地核对结果时，先从表头确认列位，再生成 `values` 数组；大批量或高风险写入先用 `--dry-run` 检查目标行列和值，写入后用 `get-range` 复核目标区域。

调用任意 MCP 工具：

```powershell
node C:\Users\Administrator\.codex\skills\read-tencent-docs-opendoc\scripts\tencent-docs-mcp.mjs call-tool --name sheet.set_cell_value --args '{"file_id":"DSXprT0RUZ0RJQ0JE","sheet_id":"BB08J2","row":0,"col":0,"value_type":"STRING","string_value":"你好"}'
```

## 工作流程

1. 如果是只读解析，确认输入是 `dop-api/opendoc` URL，而不是普通 `/sheet/` 页面 URL。普通页面通常只能看到标题、页签等外层信息，不一定能读到单元格内容。
2. 将 URL 中的 `xsrf`、`t` 等参数视为敏感临时参数。除非用户明确要求，不要在最终回复里复述完整 URL。
3. 运行 `scripts/read-opendoc.mjs`。
4. 如果脚本返回行数据，基于提取文本回答用户。
5. 如果返回 `401`、`403`、空 block 或解析失败，说明该 URL 本身不足以直接读取；建议改用已登录浏览器会话，或导出 `.xlsx` / `.csv`。

MCP 写入流程：

1. 确认用户已经明确要求写入，并明确文档、子表、单元格/区域和值。
2. 不打印 `TENCENT_DOCS_TOKEN`；当前进程没有继承时，可从 `HKCU\Environment` 读入 `$env:TENCENT_DOCS_TOKEN` 或直接依赖 `tencent-docs-mcp.mjs` 的兜底读取。
3. 优先先运行 `get-sheet-info` 确认 `file_id`、`sheet_id` 和子表名。
4. 对危险或批量操作先用 `--dry-run` 展示将调用的工具参数。
5. 单个单元格写入优先使用 `set-cell`；批量写入优先使用 `call-tool --name sheet.set_range_value`；复杂格式、行列尺寸、筛选等操作再考虑 `sheet.operation_sheet` 等 MCP 工具。
6. 写入后用 `get-range` 或 `sheet.get_cell_data` 复核目标区域。

## 数据结构笔记

腾讯文档 `opendoc` 通常返回类似下面的 JSONP：

```text
clientVarsCallback({...})
```

常见有效数据路径：

```text
clientVars.collab_client_vars.initialAttributedText.text[0].block_datas[*].related_sheet
```

`related_sheet` 是 base64 zlib 数据。解压后是 protobuf wire 风格的数据：

- Sheet message 通常包含字段 `5` 的值池。
- 文本值通常在字段 `5.1`。
- 数字/日期值通常在字段 `5.3`。
- 单元格记录通常在字段 `6`。
- 每条单元格记录里，字段 `1` 常表示行，字段 `2` 常表示列，字段 `3` 是单元格 payload。
- 单元格 payload 的字段 `2.1` 常表示值池索引，字段 `17.1` 常保存下拉框、图片、链接等 JSON。

脚本会自动寻找“单元格记录最多”的嵌套 sheet message，所以不会硬编码依赖 `1.5.19` 这类路径。

## 安全注意

- 不要粘贴或保存包含 `cookie` 的 Request Headers。
- 不要把用户 token、登录态或完整 Cookie 写进 skill、脚本或仓库。
- 不要在对话最终回复、日志摘要或文档中复述 `TENCENT_DOCS_TOKEN` 的值；只可说明是否存在和值长度。
- 写入腾讯文档必须基于用户明确授权；不要因为链接可访问就擅自创建、删除、清空、重命名或改写数据。
- 如果用户已经在聊天中贴出了凭据，不要继续使用这些凭据；建议用户重新登录或清理 `docs.qq.com` 站点 Cookie，让旧 session 失效。
- 需要长期、稳定、可重复的自动化时，优先让用户导出 `.xlsx` / `.csv`，或接入正式 API/低权限账号。
