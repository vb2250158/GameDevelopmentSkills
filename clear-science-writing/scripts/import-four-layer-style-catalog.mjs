#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultOutput = path.resolve(scriptDirectory, "..", "references", "four-layer-type-catalog.json");
const sourcePath = process.argv[2] ? path.resolve(process.argv[2]) : null;
const outputPath = process.argv[3] ? path.resolve(process.argv[3]) : defaultOutput;

if (!sourcePath) {
  console.error("Usage: node import-four-layer-style-catalog.mjs <source-json> [output-json]");
  process.exit(2);
}

const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const arrayFields = [
  "measurementDimensions",
  "vocabularyGroups",
  "vocabularyTypes",
  "sentenceTypeAxes",
  "sentenceTypes",
  "sentenceGroups",
  "sentencePatterns",
  "paragraphTypeAxes",
  "paragraphTypes",
  "paragraphGroups",
  "paragraphPatterns",
  "contentTypeAxes",
  "contentTypes",
  "contentGroups",
  "contentStructures",
];
for (const field of arrayFields) {
  if (!Array.isArray(source[field])) throw new Error(`Source JSON lacks ${field}`);
}

let current = null;
if (fs.existsSync(outputPath)) {
  try { current = JSON.parse(fs.readFileSync(outputPath, "utf8")); } catch { current = null; }
}

function mergeById(previous = [], incoming = []) {
  const merged = new Map(previous.map((item) => [item.id, item]));
  for (const item of incoming) merged.set(item.id, { ...(merged.get(item.id) ?? {}), ...item });
  return [...merged.values()];
}

const catalog = {
  schemaVersion: 1,
  language: source.meta?.language ?? "zh-CN",
  sourceVersion: source.meta?.version ?? null,
  sourceTitle: source.meta?.title ?? null,
  description: "四层通用检查目录。类型轴和具体模板只规定分析范围；目标语料统计必须另行映射，未映射不能解释为零次。",
  measurementDimensions: mergeById(current?.measurementDimensions, source.measurementDimensions),
  schemas: source.schemas ?? current?.schemas ?? {},
};
for (const field of arrayFields.slice(1)) catalog[field] = mergeById(current?.[field], source[field]);

const changed = {};
const added = {};
for (const field of arrayFields.slice(1)) {
  const previous = new Map((current?.[field] ?? []).map((item) => [item.id, JSON.stringify(item)]));
  added[field] = catalog[field].filter((item) => !previous.has(item.id)).map((item) => item.id);
  changed[field] = catalog[field]
    .filter((item) => previous.has(item.id) && previous.get(item.id) !== JSON.stringify(item))
    .map((item) => item.id);
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
const reportPath = path.join(path.dirname(outputPath), "four-layer-catalog-update-report.json");
const report = {
  generatedAt: new Date().toISOString(),
  sourceFile: path.basename(sourcePath),
  outputFile: path.basename(outputPath),
  counts: Object.fromEntries(arrayFields.slice(1).map((field) => [field, catalog[field].length])),
  added,
  changed,
};
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ output: outputPath, report: reportPath, counts: report.counts }, null, 2));
