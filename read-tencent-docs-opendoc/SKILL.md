---
name: read-tencent-docs-opendoc
description: 读取、搜索和在用户明确授权时修改腾讯文档表格。Use when 用户提供 docs.qq.com 的 dop-api/opendoc JSONP 链接、要求 Codex 查看腾讯文档表格行列/单元格、在不粘贴 Cookie 的前提下搜索腾讯文档内容，或使用 TENCENT_DOCS_TOKEN 通过腾讯文档 MCP 修改在线表格。
---

# 读取腾讯文档 Opendoc

## 概览

使用本 skill 读取腾讯文档表格的 `https://docs.qq.com/dop-api/opendoc?...` 授权接口数据。配套脚本会拉取 JSONP 响应，解压腾讯文档内嵌的 workbook/block 数据，解析 protobuf-like 的单元格记录，并输出可搜索的行列文本。

如果用户已经配置 `TENCENT_DOCS_TOKEN`，也可以通过腾讯文档 MCP 调用在线表格写入工具。写入必须是用户明确要求的具体操作，例如指定文档、子表、单元格和写入值；不要在仅“看看”“能不能改”的场景下擅自写表。

不要要求用户粘贴 `cookie`、`DOC_SID`、`uid_key`、`TOK`、`tdocs_sec_ticket` 或浏览器存储内容。如果仅凭 `opendoc` URL 无法访问，优先使用用户已登录的浏览器会话，或让用户导出 `.xlsx` / `.csv`。

当调用方需要读取腾讯文档表格截图时，不能只依赖 `sheet.get_cell_data` 的文本结果。只要 `截图` 字段有非空值、占位、图片标记，或页面/导出文件显示该行存在图片，而当前解析没有拿到 `docimg*.docs.qq.com/image/...`，必须先停下来排查截图获取链路：重新捕获目标行所在的 `dop-api/opendoc` 切片、确认已登录 Chrome 页面网络请求、滚动/刷新让目标行进入切片、检查图片是否藏在 payload field `17.1` 的 rich JSON 中，必要时改用用户导出的 `.xlsx` / `.csv`。不要把“当前通道没有返回图片 URL”写成“没有截图”。

如果 `sheet.get_cell_data` 返回空字符串或空格，但用户截图、页面缩略图、批注或导出的 xlsx 显示该行有截图，必须视为“截图存在但当前通道未暴露 URL”。此时不要继续下游分析或回填；先解决截图获取，或把所有尝试过的通道和失败原因写入 manifest。

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

### 日期口径

本 skill 的日期读取口径固定为 ISO 日期字符串 `YYYY-MM-DD`。

- opendoc 中数字/日期值通常来自字段 `5.3`。脚本只在单元格类型为数字、且数值落在 `30000..70000` 的 Excel 日期序列号范围内时，将其转换为 `YYYY-MM-DD`。
- 转换公式与脚本一致：按 Excel/Unix 序列差值 `serial - 25569` 计算 UTC 日期，并输出 `new Date(...).toISOString().slice(0, 10)`。
- 传入 `--raw-numbers` 时，不做日期转换，原样输出数字序列号。
- 文本单元格不会被二次解析为日期；例如 `2026/6/2`、`2026年6月2日`、`06-02` 会按原文本输出，不在本 skill 中猜测含义。
- 所有下游 workflow、PM 备注和本地 JSON/Markdown 若需要规范化日期，必须以 `YYYY-MM-DD` 为唯一标准格式；不能混用 `YYYY/MM/DD`、`YYYY年M月D日`、`M/D` 或只写“今天/明天”。
- 写入腾讯文档日期列时，当前 MCP 主要支持 `STRING` / `NUMBER` / `BOOL` / `FORMULA`，没有独立 `DATE` 类型。默认写入 `STRING`，值使用 `YYYY-MM-DD`。只有用户明确要求保留表格原生日期序列号或公式时，才写数字序列号或公式，并在写回摘要中说明。
- 读取到无法确认的日期文本时，不要编造日期。保留原值，并在结构化输出中可另记 `dateRaw` / `targetDateRaw` 供人工核对。

配套脚本：

```powershell
node C:\Users\Administrator\.codex\skills\read-tencent-docs-opendoc\scripts\normalize-dates.mjs --value "2026/6/2"
node C:\Users\Administrator\.codex\skills\read-tencent-docs-opendoc\scripts\normalize-dates.mjs --in rows.json --out rows.normalized.json
```

`normalize-dates.mjs` 支持 Excel 日期序列号、`YYYY-M-D`、`YYYY/M/D`、`YYYY.M.D`、`YYYY年M月D日`；不会猜测 `6/2`、`明天`、`周二` 等缺少明确年月日的值。其他腾讯文档工作流需要规范化日期时，应优先复用本 skill 的 `scripts/dates.mjs` 或 CLI，不要各自手写不同正则。

### 通过 MCP 读取/修改在线表格

Token 优先从当前进程环境变量 `TENCENT_DOCS_TOKEN` 读取；如果当前 Codex 子进程没有继承，脚本会在 Windows 上兜底读取 `HKCU\Environment\TENCENT_DOCS_TOKEN`。不要在最终回复里打印 token。

列出可用工具：

```powershell
node C:\Users\Administrator\.codex\skills\read-tencent-docs-opendoc\scripts\tencent-docs-mcp.mjs list-tools --query sheet
```

查看在线表格子表信息：

```powershell
node C:\Users\Administrator\.codex\skills\read-tencent-docs-opendoc\scripts\tencent-docs-mcp.mjs get-sheet-info --url "https://docs.qq.com/sheet/<file_id>?tab=<sheet_id>"
```

读取区域：

```powershell
node C:\Users\Administrator\.codex\skills\read-tencent-docs-opendoc\scripts\tencent-docs-mcp.mjs get-range --url "https://docs.qq.com/sheet/<file_id>?tab=<sheet_id>" --range A1:C3
```

设置单元格：

```powershell
node C:\Users\Administrator\.codex\skills\read-tencent-docs-opendoc\scripts\tencent-docs-mcp.mjs set-cell --url "https://docs.qq.com/sheet/<file_id>?tab=<sheet_id>" --cell A1 --value "你好"
```

批量写入多个单元格时，使用 `sheet.set_range_value`。`row` / `col` 均为 0-based，A1 是 `row=0,col=0`：

  ```powershell
  node C:\Users\Administrator\.codex\skills\read-tencent-docs-opendoc\scripts\tencent-docs-mcp.mjs call-tool --name sheet.set_range_value --args '{"file_id":"<file_id>","sheet_id":"<sheet_id>","values":[{"row":0,"col":0,"value_type":"STRING","string_value":"你好"},{"row":0,"col":1,"value_type":"STRING","string_value":"世界"}]}'
  ```

  当写入值包含长中文、换行、空格、反引号或 Markdown 代码片段时，优先把 JSON 参数写入 UTF-8 无 BOM 文件，再使用 `--args-file <path>`，避免 PowerShell / cmd 参数转义把 JSON 拆坏。

  批量写回本地核对结果时，先从表头确认列位，再生成 `values` 数组；大批量或高风险写入先用 `--dry-run` 检查目标行列和值，写入后用 `get-range` 复核目标区域。

调用任意 MCP 工具：

```powershell
node C:\Users\Administrator\.codex\skills\read-tencent-docs-opendoc\scripts\tencent-docs-mcp.mjs call-tool --name sheet.set_cell_value --args '{"file_id":"<file_id>","sheet_id":"<sheet_id>","row":0,"col":0,"value_type":"STRING","string_value":"你好"}'
```

## 工作流程

1. 如果是只读解析，确认输入是 `dop-api/opendoc` URL，而不是普通 `/sheet/` 页面 URL。普通页面通常只能看到标题、页签等外层信息，不一定能读到单元格内容。
2. 将 URL 中的 `xsrf`、`t` 等参数视为敏感临时参数。除非用户明确要求，不要在最终回复里复述完整 URL。
3. 运行 `scripts/read-opendoc.mjs`。
4. 如果脚本返回行数据，基于提取文本回答用户。
5. 如果返回 `401`、`403`、空 block 或解析失败，说明该 URL 本身不足以直接读取；建议改用已登录浏览器会话，或导出 `.xlsx` / `.csv`。
6. 如果目标任务的 `截图` 字段有值但脚本输出没有图片 URL，不要继续下游任务；先确认当前 opendoc URL 覆盖的 `tab`、行列范围是否包含目标行和截图列，再从已登录浏览器 DOM/Network 或导出文件中补取图片。最终结果至少要记录：目标行、截图列值、尝试过的通道、是否发现 `docimg`、下载/映射状态。
7. 如果浏览器/opendoc 通道拿不到图片，但可调用 `manage.export_file` / `manage.export_progress`，导出 xlsx 后解析 OOXML drawing 作为兜底：先确认 ZIP 完整且存在 `xl/workbook.xml`；再按 workbook 找目标 sheet，读取 `xl/worksheets/_rels/sheetN.xml.rels` 找 drawing，读取 `xl/drawings/drawingN.xml` 的 `from.row` / `from.col` 和 drawing rels。OOXML row/col 是 0-based；`from.row = 表格行号 - 1` 且 `from.col` 是截图列时，可将对应 media 图片映射到该行，manifest 的 `mappingMethod` 写 `xlsx_drawing_anchor`。下载被截断或 ZIP 无法打开时必须重新下载，不能继续解析半截文件。

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
- 图片常以 `docimg*.docs.qq.com/image/...` 出现在 field `17.1` 或 rich JSON 内；带 `imageMogr2/thumbnail` 的 URL 只能作为定位线索，下载正文截图时应去掉缩略图参数或使用页面预览提供的大图 URL，并带 `Referer: https://docs.qq.com/`。

脚本会自动寻找“单元格记录最多”的嵌套 sheet message，所以不会硬编码依赖 `1.5.19` 这类路径。

## 安全注意

- 不要粘贴或保存包含 `cookie` 的 Request Headers。
- 不要把用户 token、登录态或完整 Cookie 写进 skill、脚本或仓库。
- 不要在对话最终回复、日志摘要或文档中复述 `TENCENT_DOCS_TOKEN` 的值；只可说明是否存在和值长度。
- 写入腾讯文档必须基于用户明确授权；不要因为链接可访问就擅自创建、删除、清空、重命名或改写数据。
- 如果用户已经在聊天中贴出了凭据，不要继续使用这些凭据；建议用户重新登录或清理 `docs.qq.com` 站点 Cookie，让旧 session 失效。
- 需要长期、稳定、可重复的自动化时，优先让用户导出 `.xlsx` / `.csv`，或接入正式 API/低权限账号。
