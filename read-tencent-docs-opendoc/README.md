# read-tencent-docs-opendoc

读取、搜索腾讯文档 `opendoc` 数据，并在用户明确授权时通过腾讯文档 MCP 修改在线表格。

## 需要准备

- Node.js 18+。
- 可访问 `docs.qq.com` 的网络环境。
- 读取 `opendoc` URL 时，需要用户从已登录浏览器或网络请求中提供 `https://docs.qq.com/dop-api/opendoc?...` 链接。
- 使用 MCP 写表时，需要配置 `TENCENT_DOCS_TOKEN`。

## 环境变量

```powershell
$env:TENCENT_DOCS_TOKEN = "<token>"
```

在 Windows 上也可以写入用户环境变量；脚本会尝试从当前进程环境变量和 `HKCU\Environment` 读取。不要把 token 提交到仓库。

## 常用命令

读取 opendoc：

```powershell
node scripts/read-opendoc.mjs --url "<opendoc-url>" --limit 20
```

搜索关键词：

```powershell
node scripts/read-opendoc.mjs --url "<opendoc-url>" --query "关键词"
```

查看腾讯文档 MCP 可用工具：

```powershell
node scripts/tencent-docs-mcp.mjs list-tools --query sheet
```

读取在线表格信息：

```powershell
node scripts/tencent-docs-mcp.mjs get-sheet-info --url "https://docs.qq.com/sheet/<file_id>?tab=<sheet_id>"
```

## 使用边界

- 只读场景不要要求用户粘贴 Cookie 或浏览器存储内容。
- 写表必须有用户明确授权，并指定目标文档、子表、单元格或区域和值。
- 最终回复、日志和提交内容里不要打印 token。
