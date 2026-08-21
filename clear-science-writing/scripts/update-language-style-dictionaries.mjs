#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const renderScript = path.join(scriptDirectory, "render-language-style-html.mjs");
const args = process.argv.slice(2);
const skillDirectory = args[0] ? path.resolve(args[0]) : null;
let learningLogPath = null;
for (let index = 1; index < args.length; index += 1) {
  if (args[index] === "--learning-log") {
    learningLogPath = args[index + 1] ? path.resolve(args[index + 1]) : null;
    if (!learningLogPath) throw new Error("--learning-log requires a path");
    index += 1;
  } else {
    throw new Error(`Unknown option: ${args[index]}`);
  }
}
if (!skillDirectory) {
  console.error("Usage: node update-language-style-dictionaries.mjs <language-style-skill-directory> [--learning-log <jsonl-path>]");
  process.exit(2);
}

const result = spawnSync(process.execPath, [renderScript, skillDirectory], { encoding: "utf8" });
if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout);
  process.exit(result.status ?? 1);
}

const references = path.join(skillDirectory, "references");
learningLogPath ??= path.join(references, "style-learning-log.jsonl");
const vocabulary = JSON.parse(fs.readFileSync(path.join(references, "vocabulary-dictionary.json"), "utf8"));
const sentence = JSON.parse(fs.readFileSync(path.join(references, "sentence-dictionary.json"), "utf8"));
const paragraph = JSON.parse(fs.readFileSync(path.join(references, "paragraph-dictionary.json"), "utf8"));
const composition = JSON.parse(fs.readFileSync(path.join(references, "composition-dictionary.json"), "utf8"));

function readLearningLog(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try { return JSON.parse(line); }
      catch (error) { throw new Error(`Invalid JSON in ${filePath}:${index + 1}: ${error.message}`); }
    });
}

const learningSamples = readLearningLog(learningLogPath);
const sourceKinds = ["source_corpus", "user_revision", "user_accepted", "user_rejected", "model_candidate"];
const bySourceKind = Object.fromEntries(sourceKinds.map((kind) => [kind, learningSamples.filter((item) => item.sourceKind === kind).length]));
const formallyEligible = learningSamples.filter((item) =>
  item.reviewStatus === "reviewed"
  && new Set(["source_corpus", "user_revision", "user_accepted"]).has(item.sourceKind)
  && new Set(["include_source_evidence", "include_adaptation_evidence"]).has(item.decision));
const negativeSamples = learningSamples.filter((item) => item.sourceKind === "user_rejected" || item.decision === "negative_evidence");
const candidateOnlySamples = learningSamples.filter((item) => item.sourceKind === "model_candidate" || item.decision === "candidate_only" || item.reviewStatus === "unreviewed");
const learningCandidates = learningSamples.flatMap((item) =>
  (item.candidateParameters ?? []).map((candidate) => ({ sampleId: item.sampleId, sourceKind: item.sourceKind, reviewStatus: item.reviewStatus, ...candidate })));
const report = {
  generatedAt: new Date().toISOString(),
  skillDirectory,
  vocabulary: {
    groups: vocabulary.groups?.filter((item) => item.id !== "target-style-extensions").length ?? 0,
    sharedTypes: vocabulary.sourceStatistics?.candidateTypes ?? 0,
    displayedTypes: vocabulary.sourceStatistics?.displayedTypes ?? vocabulary.types?.length ?? 0,
    targetTypes: vocabulary.sourceStatistics?.targetTypes ?? 0,
    mappedTargetTypes: vocabulary.sourceStatistics?.mappedTargetTypes ?? 0,
    targetExtensions: vocabulary.sourceStatistics?.targetExtensions ?? 0,
    uniqueWords: vocabulary.words?.length ?? 0,
    overlapWords: vocabulary.words?.filter((item) => item.overlap).length ?? 0,
  },
  sentence: {
    axes: sentence.sentenceTypeAxes?.length ?? 0,
    types: sentence.sentenceTypes?.length ?? 0,
    sharedPatterns: sentence.sourceStatistics?.patterns ?? 0,
    targetPatterns: sentence.sourceStatistics?.targetPatterns ?? 0,
    mapped: sentence.sourceStatistics?.mappedTargetPatterns ?? 0,
    ambiguous: sentence.sourceStatistics?.ambiguousTargetPatterns ?? 0,
    unmapped: sentence.sourceStatistics?.unmappedTargetPatterns ?? 0,
    targetExtensions: sentence.sourceStatistics?.targetExtensions ?? 0,
  },
  paragraph: {
    axes: paragraph.sourceStatistics?.axes ?? 0,
    types: paragraph.sourceStatistics?.types ?? 0,
    sharedPatterns: paragraph.sourceStatistics?.patterns ?? 0,
    targetPatterns: paragraph.sourceStatistics?.targetPatterns ?? 0,
    mapped: paragraph.sourceStatistics?.mappedTargetPatterns ?? 0,
    ambiguous: paragraph.sourceStatistics?.ambiguousTargetPatterns ?? 0,
    unmapped: paragraph.sourceStatistics?.unmappedTargetPatterns ?? 0,
    targetExtensions: paragraph.sourceStatistics?.targetExtensions ?? 0,
  },
  composition: {
    axes: composition.sourceStatistics?.axes ?? 0,
    types: composition.sourceStatistics?.types ?? 0,
    sharedPatterns: composition.sourceStatistics?.patterns ?? 0,
    targetPatterns: composition.sourceStatistics?.targetPatterns ?? 0,
    mapped: composition.sourceStatistics?.mappedTargetPatterns ?? 0,
    ambiguous: composition.sourceStatistics?.ambiguousTargetPatterns ?? 0,
    unmapped: composition.sourceStatistics?.unmappedTargetPatterns ?? 0,
    targetExtensions: composition.sourceStatistics?.targetExtensions ?? 0,
  },
  learning: {
    logPath: learningLogPath,
    exists: fs.existsSync(learningLogPath),
    samples: learningSamples.length,
    bySourceKind,
    formallyEligible: formallyEligible.length,
    negativeSamples: negativeSamples.length,
    candidateOnlySamples: candidateOnlySamples.length,
    candidateParameters: learningCandidates,
    rule: "正式频率仍需重新分析原文或已复核文本；日志中的候选不能直接写回 style-data.json。",
  },
  promotionCandidates: [
    ...(sentence.targetMatches ?? []).filter((item) => item.status !== "mapped").map((item) => ({ layer: "sentence", targetId: item.targetId, targetName: item.targetName, status: item.status, candidates: item.candidates })),
    ...(paragraph.targetMatches ?? []).filter((item) => item.status !== "mapped").map((item) => ({ layer: "paragraph", targetId: item.targetId, targetName: item.targetName, status: item.status, candidates: item.candidates })),
    ...(composition.targetMatches ?? []).filter((item) => item.status !== "mapped").map((item) => ({ layer: "composition", targetId: item.targetId, targetName: item.targetName, status: item.status, candidates: item.candidates })),
  ],
  rule: "目标扩展可随当前语料更新；升级通用字典仍需跨语料复现和人工语义复核。",
};
const outputPath = path.join(references, "dictionary-update-report.json");
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ output: outputPath, vocabulary: report.vocabulary, sentence: report.sentence, paragraph: report.paragraph, composition: report.composition, learning: report.learning, promotionCandidates: report.promotionCandidates.length }, null, 2));
