# ai-automation-workflow

围绕腾讯文档任务清单执行 AI 辅助工作流：拉取任务、整理本地 Markdown、分析修正方案、回填方案、处理批注和推进已确认修复。

## 需要准备

- Node.js 18+。
- 可读取腾讯文档的 `opendoc` URL，或已配置腾讯文档 MCP token。
- 同目录或本机可用 `read-tencent-docs-opendoc` skill。
- 若要进行代码分析或实施修复，需要本地项目工作区可读写。
- 若要写回腾讯文档，需要用户明确授权，并配置 `TENCENT_DOCS_TOKEN`。

## 环境变量

```powershell
$env:TENCENT_DOCS_TOKEN = "<token>"
```

token 只用于在线表格读取或写入。不要提交 token、Cookie、`DOC_SID`、`uid_key`、`TOK` 或 `tdocs_sec_ticket`。

## 典型流程

1. 读取腾讯文档表头和目标行，按状态、负责人、月份、是否已有修正方案等条件筛选。
2. 导出本地任务清单和截图目录。
3. 对每条任务做静态分析，生成可执行修正方案。
4. 用户确认后，将方案写回 `修正方案` 或相关列。
5. 用户在批注列提出反馈后，吸收反馈并更新方案。
6. 用户标记已确认方案后，进入实施、复核和回填完成状态。

## 常用脚本

导出腾讯文档任务行：

```powershell
node scripts/export_tencent_bug_rows.mjs --help
```

校验任务 Markdown：

```powershell
node scripts/validate_task_markdown.mjs --help
```

生成方案回填 payload：

```powershell
node scripts/build_solution_backfill_payload.mjs --help
```

验证回填结果：

```powershell
node scripts/verify_tencent_backfill.mjs --help
```

## 使用边界

- 没有明确授权时，只生成本地文档和待写回 payload，不直接写表。
- 筛选范围必须来自用户指令或当前任务集合，不能擅自扩大到整张表。
- 截图要挂到对应任务段落，不能只下载到目录或放在文末图库。
- 线上写回后需要读回校验。
