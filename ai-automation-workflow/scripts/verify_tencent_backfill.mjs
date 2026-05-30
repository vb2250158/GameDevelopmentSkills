#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { getRange, headerMap, parseArgs, requireHeader, requireOption, cellsToMatrix } from "./lib/tencent-docs.mjs";

function usage() {
  console.error(`用法：
  node verify_tencent_backfill.mjs --url <docs-sheet-url> --expected <payload.json>

逐格校验预期内容，并检查目标行的“修正方案批注”是否为空。`);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) return usage();
  const url = requireOption(opts, "url");
  const expected = JSON.parse(readFileSync(requireOption(opts, "expected"), "utf8"));
  const rows = [...new Set(expected.values.map((value) => value.row))].sort((a, b) => a - b);
  const cols = [...new Set(expected.values.map((value) => value.col))].sort((a, b) => a - b);
  const minRow = Math.min(0, ...rows);
  const maxRow = Math.max(...rows);
  const minCol = Math.min(0, ...cols, expected.comment_column ?? 0);
  const maxCol = Math.max(...cols, expected.comment_column ?? 0);

  const data = await getRange(url, minRow, minCol, maxRow, maxCol);
  const matrix = cellsToMatrix(data.cells || []);
  const headers = headerMap(data.cells || [], 0);
  const fixCol = requireHeader(headers, "修正方案");
  const confirmCol = requireHeader(headers, "确认修正方案");
  const commentCol = headers.get("修正方案批注");

  const bad = [];
  let fixExact = 0;
  let pendingReview = 0;
  let insufficient = 0;
  for (const value of expected.values) {
    const actual = matrix.get(value.row, value.col);
    if (actual !== value.string_value) {
      bad.push({ row: value.row + 1, col: value.col + 1, expected: value.string_value, actual });
    }
    if (value.col === fixCol && actual === value.string_value) fixExact += 1;
    if (value.col === confirmCol && actual === "方案待确认") pendingReview += 1;
    if (value.col === confirmCol && actual === "信息不足") insufficient += 1;
  }

  let commentEmpty = 0;
  const commentBad = [];
  if (commentCol != null) {
    const expectsComment = expected.values.some((value) => value.col === commentCol);
    if (!expectsComment) {
      for (const row of rows) {
        const actual = matrix.get(row, commentCol);
        if (!actual) commentEmpty += 1;
        else commentBad.push({ row: row + 1, actual });
      }
    }
  }

  const result = {
    检查行数: rows.length,
    检查单元格数: expected.values.length,
    修正方案精确匹配数: fixExact,
    方案待确认数: pendingReview,
    信息不足数: insufficient,
    批注为空数: commentEmpty,
    异常数: bad.length + commentBad.length,
    异常行: [...bad, ...commentBad.map((item) => ({ ...item, col: "修正方案批注" }))],
  };
  console.log(JSON.stringify(result, null, 2));
  if (result.异常数 > 0) process.exit(2);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
