#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function usage() {
  console.error("Usage: node import-sentence-style-catalog.mjs <source-json> [output-json]");
}

const sourcePath = process.argv[2] ? path.resolve(process.argv[2]) : null;
const currentCatalogPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "references", "sentence-style-catalog.json");
const outputPath = process.argv[3]
  ? path.resolve(process.argv[3])
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "references", "sentence-style-catalog.json");

if (!sourcePath) {
  usage();
  process.exit(2);
}

const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
for (const field of ["sentenceTypeAxes", "sentenceTypes", "sentenceGroups", "sentencePatterns"]) {
  if (!Array.isArray(source[field])) throw new Error(`Source JSON lacks ${field}`);
}

let current = null;
if (fs.existsSync(currentCatalogPath)) {
  try { current = JSON.parse(fs.readFileSync(currentCatalogPath, "utf8")); } catch { current = null; }
}

function mergeById(previous = [], incoming = []) {
  const merged = new Map(previous.map((item) => [item.id, item]));
  for (const item of incoming) merged.set(item.id, { ...(merged.get(item.id) ?? {}), ...item });
  return [...merged.values()];
}

function stableJson(value) {
  return JSON.stringify(value, null, 2);
}

const previousCounts = current ? {
  axes: current.sentenceTypeAxes?.length ?? 0,
  types: current.sentenceTypes?.length ?? 0,
  groups: current.sentenceGroups?.length ?? 0,
  patterns: current.sentencePatterns?.length ?? 0,
} : null;

const catalog = {
  schemaVersion: 1,
  language: source.meta?.language ?? "zh-CN",
  sourceVersion: source.meta?.version ?? null,
  description: "通用句式检查字典。分类轴、类型和模板只规定检查范围；目标语料统计必须另行映射，未映射不能解释为零次。",
  measurementDimensions: mergeById(current?.measurementDimensions, source.measurementDimensions),
  sentenceTypeSchema: source.schemas?.sentenceType ?? null,
  sentencePatternSchema: source.schemas?.sentencePattern ?? null,
  sentenceTypeAxes: mergeById(current?.sentenceTypeAxes, source.sentenceTypeAxes),
  sentenceTypes: mergeById(current?.sentenceTypes, source.sentenceTypes),
  sentenceGroups: mergeById(current?.sentenceGroups, source.sentenceGroups),
  sentencePatterns: mergeById(current?.sentencePatterns, source.sentencePatterns),
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
const changes = {
  previous: previousCounts,
  current: { axes: catalog.sentenceTypeAxes.length, types: catalog.sentenceTypes.length, groups: catalog.sentenceGroups.length, patterns: catalog.sentencePatterns.length },
  addedAxes: catalog.sentenceTypeAxes.filter((item) => !current?.sentenceTypeAxes?.some((old) => old.id === item.id)).map((item) => item.id),
  addedTypes: catalog.sentenceTypes.filter((item) => !current?.sentenceTypes?.some((old) => old.id === item.id)).map((item) => item.id),
  addedGroups: catalog.sentenceGroups.filter((item) => !current?.sentenceGroups?.some((old) => old.id === item.id)).map((item) => item.id),
  addedPatterns: catalog.sentencePatterns.filter((item) => !current?.sentencePatterns?.some((old) => old.id === item.id)).map((item) => item.id),
  changedPatterns: catalog.sentencePatterns.filter((item) => { const old = current?.sentencePatterns?.find((candidate) => candidate.id === item.id); return old && stableJson(old) !== stableJson(item); }).map((item) => item.id),
};
const changePath = path.join(path.dirname(outputPath), "sentence-catalog-update-report.json");
fs.writeFileSync(changePath, `${JSON.stringify(changes, null, 2)}\n`, "utf8");
console.log(`Generated sentence style catalog: ${outputPath}`);
console.log(`Axes ${catalog.sentenceTypeAxes.length}; types ${catalog.sentenceTypes.length}; patterns ${catalog.sentencePatterns.length}`);
console.log(`Catalog update report: ${changePath}`);
