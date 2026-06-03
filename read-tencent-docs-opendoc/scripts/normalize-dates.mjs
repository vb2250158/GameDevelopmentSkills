#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { normalizeIsoDate } from "./dates.mjs";

const DATE_KEYS = new Set(["date", "targetDate", "日期", "验收日期", "目标验收日期"]);

function usage() {
  console.error(`Usage:
  node normalize-dates.mjs --value <date-text>
  node normalize-dates.mjs --in <input.json> [--out <output.json>]

Rules:
  - Normalize confirmed dates to YYYY-MM-DD.
  - Supports Excel serials, YYYY-M-D, YYYY/M/D, YYYY.M.D, YYYY年M月D日.
  - Does not guess ambiguous values such as 6/2, tomorrow, or Tuesday.
  - JSON mode recursively normalizes date fields and preserves *Raw fields.`);
}

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) throw new Error(`Unsupported positional argument: ${arg}`);
    const key = arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (i + 1 >= argv.length || argv[i + 1].startsWith("--")) opts[key] = true;
    else {
      opts[key] = argv[i + 1];
      i += 1;
    }
  }
  return opts;
}

function rawFieldName(key) {
  if (key === "date") return "dateRaw";
  if (key === "targetDate") return "targetDateRaw";
  if (key === "日期") return "日期Raw";
  if (key === "验收日期") return "验收日期Raw";
  if (key === "目标验收日期") return "目标验收日期Raw";
  return "";
}

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
