#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const [inputArgument] = process.argv.slice(2);
if (!inputArgument) throw new Error("Usage: node prune-zero-hit-style-data.mjs <style-data.json>");

const inputPath = path.resolve(inputArgument);
const data = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const fields = ["vocabularyTypes", "vocabularyMetrics", "sentencePatterns", "paragraphPatterns", "contentStructures"];
const removed = {};

for (const field of fields) {
  if (!Array.isArray(data[field])) continue;
  const before = data[field].length;
  data[field] = data[field]
    .filter((item) => item.frequency?.count == null || item.frequency.count > 0)
    .sort((left, right) => Number(right.frequency?.coverageRatio ?? -1) - Number(left.frequency?.coverageRatio ?? -1) || Number(right.frequency?.count ?? -1) - Number(left.frequency?.count ?? -1));
  removed[field] = before - data[field].length;
}

data.profileVersion = String(data.profileVersion ?? "unversioned").replace(/-positive-hits$/u, "") + "-positive-hits";
data.targetParameterPolicy = {
  minimumCount: 1,
  order: "coverage_ratio_desc_then_count_desc",
  zeroHitStorage: "shared_candidate_catalog_or_audit_only",
};

fs.writeFileSync(inputPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ input: inputPath, removed, remaining: Object.fromEntries(fields.filter((field) => Array.isArray(data[field])).map((field) => [field, data[field].length])) }, null, 2));
