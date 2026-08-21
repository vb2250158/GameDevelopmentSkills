#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

function number(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function weightEntry(entry) {
  const coverage = number(entry?.frequency?.coverageRatio, 0);
  const contrast = Math.max(0.5, Math.min(2, number(entry?.control?.rateRatio, 1)));
  const reviewed = /human_reviewed|complete|observed|stable/i.test(
    `${entry?.status ?? ""} ${entry?.validation?.status ?? ""}`,
  );
  const confidence = reviewed ? 1 : 0.7;
  return {
    raw: coverage * contrast * confidence,
    coverage,
    contrast,
    confidence,
  };
}

function applyWeights(entries) {
  const measured = entries.map((entry) => ({ entry, values: weightEntry(entry) }));
  const maximum = Math.max(0, ...measured.map(({ values }) => values.raw));
  for (const { entry, values } of measured) {
    entry.weight = maximum > 0 ? Number((values.raw / maximum).toFixed(6)) : null;
    entry.weightEvidence = {
      model: "normalized_coverage_contrast_v1",
      coverageRatio: values.coverage || null,
      controlRateRatio: values.contrast,
      confidenceFactor: values.confidence,
    };
  }
}

const filePath = path.resolve(process.argv[2] || "");
if (!filePath || !fs.existsSync(filePath)) {
  throw new Error("Usage: node update-language-style-weights.mjs <style-data.json>");
}

const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
for (const key of ["vocabularyTypes", "sentencePatterns", "paragraphPatterns", "contentStructures"]) {
  applyWeights(Array.isArray(data[key]) ? data[key] : []);
}
data.weightModel = {
  id: "normalized_coverage_contrast_v1",
  range: [0, 1],
  formula: "normalize(coverageRatio * clamp(controlRateRatio, 0.5, 2) * confidenceFactor)",
  purpose: "在同一层内排序运行时优先级；不替代语义、任务条件或人工复核。",
};
fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
process.stdout.write(`${filePath}\n`);
