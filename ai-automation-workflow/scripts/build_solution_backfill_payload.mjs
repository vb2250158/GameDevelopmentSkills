#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  cellsToMatrix,
  getRange,
  headerMap,
  parseArgs,
  parseSheetUrl,
  requireHeader,
  requireOption,
} from "./lib/tencent-docs.mjs";
import {
  classifyConfirmation,
  composeBackfillText,
  parseSolutionSections,
  parseVerificationStatus,
} from "./lib/solutions.mjs";

function usage() {
  console.error(`用法：
  node build_solution_backfill_payload.mjs --solution <solution.md> --url <docs-sheet-url> --out <payload.json> [--status-file <verification.md>] [--owner <name>] [--status <text>] [--all-statuses]

输出：
  生成包含 sheet.set_range_value 所需 values 的 JSON，并附带用于精确替换的 clear_ranges。
  本脚本永远不会写入“修正方案批注”。
  未传 --status 时默认只允许回填“状态”包含 A未开始 的行；只有显式传 --all-statuses 才不过滤状态。`);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) return usage();
  const solutionPath = requireOption(opts, "solution");
  const url = requireOption(opts, "url");
  const out = resolve(requireOption(opts, "out"));

  const { fileId, sheetId } = parseSheetUrl(url);
  const scanEndRow = Number(opts.scanEndRow || 1000);
  const scanEndCol = Number(opts.scanEndCol || 80);
  const sheetData = await getRange(url, 0, 0, scanEndRow, scanEndCol);
  const headers = headerMap(sheetData.cells || [], 0);
  const matrix = cellsToMatrix(sheetData.cells || []);
  const fixCol = requireHeader(headers, "修正方案");
  const confirmCol = requireHeader(headers, "确认修正方案");
  const useRowMapping = opts.mapBy === "row";
  const descCol = useRowMapping ? null : requireHeader(headers, "描述");
  const statusCol = headers.get("状态");
  const commentCol = headers.get("修正方案批注");
  const ownerCol = headers.get("负责人");
  const rowByDescription = useRowMapping ? new Map() : buildRowByDescription(sheetData.cells || [], descCol);
  const effectiveStatus = opts.allStatuses ? "" : String(opts.status || "A未开始");
  if (effectiveStatus && statusCol == null) {
    throw new Error(`默认需要按状态 ${effectiveStatus} 保护回填，但表头中未找到“状态”。如确实要不过滤状态，请传 --all-statuses。`);
  }

  const statusSets = parseVerificationStatus(opts.statusFile);
  const sections = parseSolutionSections(solutionPath);
  const values = [];
  const rows = [];
  const warnings = [];
  const summary = { total: 0, pendingReview: 0, insufficient: 0, ownerWrites: 0, descriptionMapped: 0, rowFallback: 0, skippedByStatus: 0 };

  for (const section of sections) {
    const text = composeBackfillText(section);
    const confirmation = classifyConfirmation(section, statusSets);
    const normalizedTitle = normalizeText(section.title);
    const mappedRow0 = useRowMapping ? undefined : rowByDescription.get(normalizedTitle);
    const targetRow0 = mappedRow0 == null ? section.row - 1 : mappedRow0;
    if (mappedRow0 == null) {
      summary.rowFallback += 1;
      warnings.push({ row: section.row, title: section.title, warning: "未找到匹配的线上描述，已回退到物理行号" });
    } else {
      summary.descriptionMapped += 1;
    }
    const onlineStatus = statusCol == null ? "" : matrix.get(targetRow0, statusCol).trim();
    if (effectiveStatus && !onlineStatus.includes(effectiveStatus)) {
      summary.skippedByStatus += 1;
      warnings.push({
        row: section.row,
        title: section.title,
        online_row: targetRow0 + 1,
        online_status: onlineStatus,
        warning: `线上状态不包含 ${effectiveStatus}，已跳过回填`,
      });
      continue;
    }
    rows.push(targetRow0 + 1);
    summary.total += 1;
    if (confirmation === "方案待确认") summary.pendingReview += 1;
    if (confirmation === "信息不足") summary.insufficient += 1;
    values.push({ row: targetRow0, col: fixCol, value_type: "STRING", string_value: text, row_id: section.row });
    values.push({ row: targetRow0, col: confirmCol, value_type: "STRING", string_value: confirmation, row_id: section.row });
    if (opts.owner) {
      if (ownerCol == null) throw new Error("无法写入 --owner，因为未找到“负责人”表头。");
      values.push({ row: targetRow0, col: ownerCol, value_type: "STRING", string_value: opts.owner, row_id: section.row });
      summary.ownerWrites += 1;
    }
  }

  const clearCols = [fixCol, confirmCol];
  if (opts.owner && ownerCol != null) clearCols.push(ownerCol);
  const payload = {
    file_id: fileId,
    sheet_id: sheetId,
    generated_at: new Date().toISOString(),
    source_solution: resolve(solutionPath),
    comment_column: commentCol,
    note: "不要写入“修正方案批注”；这是用户字段。",
    summary,
    warnings,
    clear_ranges: buildClearRanges(rows, clearCols),
    values,
  };
  writeFileSync(out, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    输出文件: out,
    总条目数: summary.total,
    方案待确认数: summary.pendingReview,
    信息不足数: summary.insufficient,
    状态跳过数: summary.skippedByStatus,
    负责人写入数: summary.ownerWrites,
    描述匹配数: summary.descriptionMapped,
    行号回退数: summary.rowFallback,
    写入单元格数: values.length,
    清空范围数: payload.clear_ranges.length,
  }, null, 2));
}

function normalizeText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function buildRowByDescription(cells, descCol) {
  const candidates = new Map();
  for (const cell of cells) {
    if (cell.row === 0 || cell.col !== descCol) continue;
    const value = normalizeText(cell.string_value || "");
    if (!value) continue;
    if (!candidates.has(value)) candidates.set(value, []);
    candidates.get(value).push(cell.row);
  }
  const result = new Map();
  for (const [desc, rows] of candidates.entries()) {
    if (rows.length === 1) result.set(desc, rows[0]);
  }
  return result;
}

function buildClearRanges(rows, cols) {
  const rowRanges = [];
  const sortedRows = [...new Set(rows)].sort((a, b) => a - b);
  let start = null;
  let prev = null;
  for (const row of sortedRows) {
    if (start == null) {
      start = row;
      prev = row;
    } else if (row === prev + 1) {
      prev = row;
    } else {
      rowRanges.push([start, prev]);
      start = row;
      prev = row;
    }
  }
  if (start != null) rowRanges.push([start, prev]);
  return rowRanges.flatMap(([startRow, endRow]) =>
    cols.map((col) => ({
      start_row: startRow - 1,
      end_row: endRow - 1,
      start_col: col,
      end_col: col,
    })),
  );
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
