#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { normalizeIsoDate } from "./lib/dates.mjs";
import { parseArgs } from "./lib/tencent-docs.mjs";

function usage() {
  console.error(`用法：
  node normalize_dates.mjs --value <date-text>
  node normalize_dates.mjs --in <input.json> [--out <output.json>]

说明：
  - 输出/写回日期统一为 YYYY-MM-DD。
  - 支持 Excel 日期序列号、YYYY-M-D、YYYY/M/D、YYYY.M.D、YYYY年M月D日。
  - 不会猜测 6/2、明天、周二等缺少明确年月日的值。
  - JSON 模式会递归规范化 date、targetDate、日期、验收日期、目标验收日期 字段，并保留 *Raw 原值。`);
}

const DATE_KEYS = new Set(["date", "targetDate", "日期", "验收日期", "目标验收日期"]);

function normalizeObjectDates(value) {
  if (Array.isArray(value)) return value.map(normalizeObjectDates);
  if (!value || typeof value !== "object") return value;

  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (DATE_KEYS.has(key)) {
      const normalized = normalizeIsoDate(item);
      output[key] = normalized.normalized ? normalized.value : item;
      const rawKey = rawFieldName(key);
      if (rawKey && output[rawKey] == null) output[rawKey] = normalized.raw;
    } else {
      output[key] = normalizeObjectDates(item);
    }
  }
  return output;
}

function rawFieldName(key) {
  if (key === "date") return "dateRaw";
  if (key === "targetDate") return "targetDateRaw";
  if (key === "日期") return "日期Raw";
  if (key === "验收日期") return "验收日期Raw";
  if (key === "目标验收日期") return "目标验收日期Raw";
  return "";
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || (!opts.value && !opts.in)) return usage();

  if (opts.value != null) {
    process.stdout.write(`${JSON.stringify(normalizeIsoDate(opts.value), null, 2)}\n`);
    return;
  }

  const input = JSON.parse(readFileSync(opts.in, "utf8"));
  const output = normalizeObjectDates(input);
  const text = `${JSON.stringify(output, null, 2)}\n`;
  if (opts.out) writeFileSync(opts.out, text, "utf8");
  else process.stdout.write(text);
}

main();
