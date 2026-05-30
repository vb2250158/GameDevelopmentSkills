#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  cellsToMatrix,
  getRange,
  headerMap,
  parseArgs,
  requireHeader,
  requireOption,
} from "./lib/tencent-docs.mjs";

function usage() {
  console.error(`用法：
  node sync_solution_comments.mjs --url <docs-sheet-url> --out <comments.md> [--range A1:AZ1000] [--status <text>] [--owner <name>]

把非空“修正方案批注”单元格导出到本地 Markdown 复核文档。
本脚本永远不会写入腾讯文档。`);
}

function parseA1Range(text = "A1:AZ1000") {
  const colToIndex = (letters) => {
    let value = 0;
    for (const char of letters.toUpperCase()) value = value * 26 + (char.charCodeAt(0) - 64);
    return value - 1;
  };
  const parseCell = (cell) => {
    const match = /^([A-Za-z]+)([1-9]\d*)$/.exec(cell);
    if (!match) throw new Error(`无效的 A1 单元格地址：${cell}`);
    return { row: Number(match[2]) - 1, col: colToIndex(match[1]) };
  };
  const [a, b = a] = text.split(":");
  const start = parseCell(a);
  const end = parseCell(b);
  return {
    startRow: Math.min(start.row, end.row),
    startCol: Math.min(start.col, end.col),
    endRow: Math.max(start.row, end.row),
    endCol: Math.max(start.col, end.col),
  };
}

function clip(text, max = 1200) {
  const value = String(text || "").trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max)}\n\n...（已截断，原文请回腾讯文档查看）`;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) return usage();
  const url = requireOption(opts, "url");
  const out = resolve(requireOption(opts, "out"));
  const range = parseA1Range(opts.range || "A1:AZ1000");

  const data = await getRange(url, range.startRow, range.startCol, range.endRow, range.endCol);
  const headers = headerMap(data.cells || [], range.startRow);
  const matrix = cellsToMatrix(data.cells || []);

  const descCol = requireHeader(headers, "描述");
  const commentCol = requireHeader(headers, "修正方案批注");
  const fixCol = requireHeader(headers, "修正方案");
  const confirmCol = requireHeader(headers, "确认修正方案");
  const ownerCol = headers.get("负责人");
  const statusCol = headers.get("状态");
  const priorityCol = headers.get("优先级");

  const rows = [];
  for (let row = range.startRow + 1; row <= range.endRow; row += 1) {
    const comment = matrix.get(row, commentCol).trim();
    if (!comment) continue;
    const owner = ownerCol == null ? "" : matrix.get(row, ownerCol).trim();
    const status = statusCol == null ? "" : matrix.get(row, statusCol).trim();
    if (opts.owner && !owner.includes(opts.owner)) continue;
    if (opts.status && !status.includes(opts.status)) continue;
    rows.push({
      rowNumber: row + 1,
      desc: matrix.get(row, descCol).trim(),
      priority: priorityCol == null ? "" : matrix.get(row, priorityCol).trim(),
      status,
      owner,
      confirmation: matrix.get(row, confirmCol).trim(),
      comment,
      solution: matrix.get(row, fixCol).trim(),
    });
  }

  const lines = [
    "# 修正方案批注同步清单",
    "",
    `- 来源：${url}`,
    `- 批注行数：${rows.length}`,
    `- 生成时间：${new Date().toISOString()}`,
    "",
  ];

  for (const item of rows) {
    lines.push(`## ${item.rowNumber}. ${item.desc || "（描述为空）"}`, "");
    lines.push(`- 优先级：${item.priority}`);
    lines.push(`- 状态：${item.status}`);
    lines.push(`- 负责人：${item.owner}`);
    lines.push(`- 确认修正方案：${item.confirmation}`);
    lines.push("", "**用户批注**", "", item.comment);
    lines.push("", "**当前修正方案**", "", clip(item.solution));
    lines.push("", "**二轮处理记录**", "", "- 待主 agent 复核。", "");
  }

  writeFileSync(out, `${lines.join("\n")}\n`, "utf8");
  console.log(JSON.stringify({ 输出文件: out, 批注行数: rows.length }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
