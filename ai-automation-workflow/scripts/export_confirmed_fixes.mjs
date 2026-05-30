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

const CONFIRMED_VALUE = "已确认方案";
const PROCESSING_VALUE = "处理中";
const DONE_VALUE = "已处理完成";
const CLOSED_VALUE = "关闭";

function usage() {
  console.error(`用法：
  node export_confirmed_fixes.mjs --url <docs-sheet-url> --out <confirmed.md> [--range A1:AZ1000] [--owner <name>]

导出“确认修正方案”精确等于“已确认方案”的行。
“处理中”“已处理完成”“关闭”都会被忽略，不会重复导出。
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
  const fixCol = requireHeader(headers, "修正方案");
  const confirmCol = requireHeader(headers, "确认修正方案");
  const commentCol = headers.get("修正方案批注");
  const ownerCol = headers.get("负责人");
  const statusCol = headers.get("状态");
  const priorityCol = headers.get("优先级");

  const rows = [];
  for (let row = range.startRow + 1; row <= range.endRow; row += 1) {
    const confirmation = matrix.get(row, confirmCol).trim();
    if (confirmation !== CONFIRMED_VALUE) continue;
    const owner = ownerCol == null ? "" : matrix.get(row, ownerCol).trim();
    if (opts.owner && !owner.includes(opts.owner)) continue;
    rows.push({
      rowNumber: row + 1,
      desc: matrix.get(row, descCol).trim(),
      priority: priorityCol == null ? "" : matrix.get(row, priorityCol).trim(),
      status: statusCol == null ? "" : matrix.get(row, statusCol).trim(),
      owner,
      confirmation,
      comment: commentCol == null ? "" : matrix.get(row, commentCol).trim(),
      solution: matrix.get(row, fixCol).trim(),
    });
  }

  const lines = [
    "# 已确认方案实施清单",
    "",
    `- 来源：${url}`,
    `- 确认值：${CONFIRMED_VALUE}`,
    `- 实施状态流转：${CONFIRMED_VALUE} -> ${PROCESSING_VALUE} -> ${DONE_VALUE}`,
    `- 忽略终态：${CLOSED_VALUE}`,
    `- 已确认行数：${rows.length}`,
    `- 生成时间：${new Date().toISOString()}`,
    "",
  ];

  for (const item of rows) {
    lines.push(`## ${item.rowNumber}. ${item.desc || "（描述为空）"}`, "");
    lines.push(`- 优先级：${item.priority}`);
    lines.push(`- 状态：${item.status}`);
    lines.push(`- 负责人：${item.owner}`);
    lines.push(`- 确认修正方案：${item.confirmation}`);
    if (item.comment) lines.push("", "**用户批注**", "", item.comment);
    lines.push("", "**已确认修正方案**", "", item.solution || "（修正方案为空，实施前必须补齐）");
    lines.push("", "**实施记录**", "", "- 待分配子 agent。", "");
  }

  writeFileSync(out, `${lines.join("\n")}\n`, "utf8");
  console.log(JSON.stringify({ 输出文件: out, 已确认行数: rows.length }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
