#!/usr/bin/env node

/**
 * Score a text against a language-style skill without treating the score as
 * authorship proof.  A layer contributes only after its own calibration is
 * marked calibrated in references/style-score-config.json.
 *
 * Central invocation:
 *   node score-language-style.mjs <style-skill-directory> <text-file> [--json]
 * Copied invocation:
 *   node scripts/score-style.mjs <text-file> [--json]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function usage() {
  console.error("Usage: node score-language-style.mjs <style-skill-directory> <text-file> [--json]");
}

function literalCount(text, term) {
  if (!term) return 0;
  let count = 0;
  let start = 0;
  while (true) {
    const index = text.indexOf(term, start);
    if (index < 0) return count;
    count += 1;
    start = index + term.length;
  }
}

function formCount(text, form) {
  if (!form.regex) return literalCount(text, form.term);
  const matcher = new RegExp(form.regex, "gu");
  let count = 0;
  while (matcher.exec(text)) count += 1;
  return count;
}

function clamp(value) { return Math.max(0, Math.min(100, value)); }
function mean(values) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null; }
function closeness(actual, target, tolerance) {
  const width = Math.max(0.01, Number(tolerance ?? Math.max(0.05, Number(target ?? 0) * 0.45)));
  return clamp(100 * (1 - Math.abs(actual - target) / width));
}

function detectModes(text) {
  return new Set([
    /[「『“"]/.test(text) ? "dialogue" : null,
    /(?:危险|受伤|攻击|敌人|追赶|逃跑|疼痛|威胁|战斗)/.test(text) ? "pressure" : null,
    /(?:脸红|回避|关心|担心|喜欢|照顾|陪着|关系)/.test(text) ? "relationship" : null,
    /(?:笑|玩笑|开玩笑|荒唐|吐槽|滑稽)/.test(text) ? "humour" : null,
    /(?:原来|也就是说|规则|能力|原因|其实)/.test(text) ? "explanation" : null,
    /(?:总之|终于|最后|回头|后来|结果)/.test(text) ? "summary" : null,
  ].filter(Boolean));
}

function isApplicable(form, modes) {
  if (form.scope !== "scene_limited") return true;
  const tags = Array.isArray(form.sceneTags) ? form.sceneTags : [];
  return tags.some((tag) => modes.has(tag));
}

function proseEligibility(paragraphs, sentences) {
  const structural = paragraphs.filter((paragraph) => /^(?:#{1,6}\s|[-*+]\s|\d+\.\s|```|\|)/.test(paragraph)).length;
  const proseLike = sentences.length >= 2 && structural / Math.max(1, paragraphs.length) < 0.25;
  return { proseLike, structuralRatio: Number((structural / Math.max(1, paragraphs.length)).toFixed(3)) };
}

function parseInvocation() {
  const raw = process.argv.slice(2);
  const json = raw.includes("--json");
  const args = raw.filter((item) => item !== "--json");
  const name = path.basename(fileURLToPath(import.meta.url));
  if (name === "score-style.mjs") {
    if (args.length !== 1) throw new Error("Copied scorer expects one text-file argument");
    return { skillDirectory: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), inputPath: path.resolve(args[0]), json };
  }
  if (args.length !== 2) throw new Error("Central scorer expects style-skill-directory and text-file");
  return { skillDirectory: path.resolve(args[0]), inputPath: path.resolve(args[1]), json };
}

function buildDraftConfig(styleData) {
  const lexicalForms = (styleData.vocabularyTypes ?? []).flatMap((type) =>
    (type.items ?? []).filter((item) => typeof item?.word === "string" && item.word.length >= 2 && Number(item.count ?? 0) > 0)
      .map((item) => ({ term: item.word, type: type.name, core: Boolean(type.core), sourcePer10k: Number(item.per10kCharacters ?? 0) })),
  );
  const sentenceForms = (styleData.sentencePatterns ?? []).flatMap((pattern) => {
    if (pattern.recognition?.kind === "regex" && typeof pattern.recognition.rule === "string") {
      return [{ term: pattern.template ?? pattern.name, regex: pattern.recognition.rule, pattern: pattern.name, sourcePer10k: Number(pattern.frequency?.per100Sentences ?? 0) * 100 }];
    }
    return (pattern.markers ?? []).filter((marker) => typeof marker === "string" && marker.length >= 2 && !/[.…]/.test(marker))
      .map((term) => ({ term, pattern: pattern.name, sourcePer10k: Number(pattern.frequency?.per100Sentences ?? 0) * 100 }));
  });
  return {
    schemaVersion: 1,
    calibrationStatus: "draft",
    generatedFrom: "style-data.json",
    layers: {
      lexical: { status: lexicalForms.length ? "draft" : "unavailable", forms: lexicalForms, minimumDistinctTypes: 3 },
      sentence: { status: sentenceForms.length ? "draft" : "unavailable", forms: sentenceForms, minimumDistinctPatterns: 2 },
      paragraph: { status: "needs_human_calibration", proxies: [] },
      composition: { status: "needs_human_calibration", proxies: [] },
    },
  };
}

function scoreFormLayer(text, characters, layer, label, modes) {
  if (layer?.status !== "calibrated") {
    return { status: layer?.status ?? "unavailable", score: null, confidence: "not_calibrated", evidence: [], note: `${label}层尚未完成可执行校准，不能伪造数值。` };
  }
  const allForms = Array.isArray(layer.forms) ? layer.forms.filter((form) => form.term?.length >= 2) : [];
  const forms = allForms.filter((form) => isApplicable(form, modes));
  if (!forms.length) return { status: "unavailable", score: null, confidence: "not_calibrated", evidence: [], note: `${label}层没有可评分的多字形式。` };
  const evidence = forms.map((form) => ({ ...form, count: formCount(text, form) })).filter((form) => form.count > 0);
  const distinct = new Set(evidence.map((form) => form.type ?? form.pattern ?? form.term));
  const targetDistinct = Math.max(1, Number(layer.minimumDistinctTypes ?? layer.minimumDistinctPatterns ?? 2));
  const diversity = Math.min(1, distinct.size / targetDistinct);
  const hits = evidence.reduce((sum, form) => sum + form.count, 0);
  const expectedPer10k = forms.reduce((sum, form) => sum + Number(form.sourcePer10k ?? 0), 0);
  const expectedHits = Math.max(1, expectedPer10k * characters / 10000 * Number(layer.densityFraction ?? 0.2));
  const density = Math.min(1, hits / expectedHits);
  return {
    status: "scored",
    score: Math.round(clamp(70 * diversity + 30 * density)),
    confidence: "feature_calibrated",
    evidence: evidence.sort((a, b) => b.count - a.count || a.term.localeCompare(b.term, "zh-CN")),
    detail: { matchedForms: evidence.length, matchedTypes: distinct.size, totalHits: hits, expectedMinimumHits: Number(expectedHits.toFixed(2)), applicableForms: forms.length, notApplicableForms: allForms.length - forms.length },
  };
}

function scoreParagraphLayer(paragraphs, characters, lexicalEvidence, layer, eligibility) {
  if (layer?.status !== "calibrated") return { status: layer?.status ?? "unavailable", score: null, confidence: "not_calibrated", evidence: [] };
  if (!eligibility.proseLike) return { status: "not_applicable", score: null, confidence: "input_not_prose", evidence: [], note: "输入主要是标题、清单、代码或非叙事结构，段落层不评分。" };
  if (characters < Number(layer.minimumCharacters ?? 600) || paragraphs.length < Number(layer.minimumParagraphs ?? 3)) {
    return { status: "insufficient_input", score: null, confidence: "insufficient_input", evidence: [], note: "段落层汇总评分需要达到已校准的最小长度与段落数。" };
  }
  const actionTerms = lexicalEvidence.filter((item) => item.type === "动作动词").map((item) => item.term);
  const dialogueStart = paragraphs.filter((paragraph) => /^[「『“\"]/.test(paragraph)).length / Math.max(1, paragraphs.length);
  const shortRatio = paragraphs.filter((paragraph) => (paragraph.match(/[\u3400-\u9fff]/g) ?? []).length <= 45).length / Math.max(1, paragraphs.length);
  const longRatio = paragraphs.filter((paragraph) => (paragraph.match(/[\u3400-\u9fff]/g) ?? []).length >= 100).length / Math.max(1, paragraphs.length);
  const dialogueAction = paragraphs.filter((paragraph, index) => /^[「『“\"]/.test(paragraph) && paragraphs[index + 1] && !/^[「『“\"]/.test(paragraphs[index + 1]) && actionTerms.some((term) => paragraphs[index + 1].includes(term))).length / Math.max(1, paragraphs.length);
  const connectorOpening = paragraphs.filter((paragraph) => /^(?:可是|不过|于是|这时候|因此|但是)/.test(paragraph)).length / Math.max(1, paragraphs.length);
  const metrics = [
    ["对白起段比例", dialogueStart, layer.metrics?.dialogueStartRatio],
    ["短段比例", shortRatio, layer.metrics?.shortParagraphRatio],
    ["长段比例", longRatio, layer.metrics?.longParagraphRatio],
    ["对白—动作交替", dialogueAction, layer.metrics?.dialogueActionRatio],
    ["显式连接词开段", connectorOpening, layer.metrics?.connectorOpeningRatio],
  ].filter(([, , target]) => target && Number.isFinite(Number(target.target)));
  if (!metrics.length) return { status: "unavailable", score: null, confidence: "not_calibrated", evidence: [], note: "段落层未提供经人工复核的代理基线。" };
  const evidence = metrics.map(([feature, actual, target]) => ({ feature, actual: Number(actual.toFixed(4)), target: target.target, score: Math.round(closeness(actual, target.target, target.tolerance)) }));
  return { status: "scored", score: Math.round(mean(evidence.map((item) => item.score))), confidence: "proxy_calibrated", evidence };
}

function scoreCompositionLayer(paragraphs, characters, lexicalEvidence, layer, eligibility) {
  if (layer?.status !== "calibrated") return { status: layer?.status ?? "unavailable", score: null, confidence: "not_calibrated", evidence: [] };
  if (!eligibility.proseLike) return { status: "not_applicable", score: null, confidence: "input_not_prose", evidence: [], note: "输入主要是标题、清单、代码或非叙事结构，整篇层不评分。" };
  const actionTerms = lexicalEvidence.filter((item) => item.type === "动作动词").map((item) => item.term);
  if (characters < Number(layer.minimumCharacters ?? 600) || paragraphs.length < Number(layer.minimumParagraphs ?? 3)) {
    return { status: "insufficient_input", score: null, confidence: "insufficient_input", evidence: [], note: "整篇评分需要达到已校准的最小长度与段落数。" };
  }
  const opening = paragraphs.slice(0, Math.max(1, Math.ceil(paragraphs.length * .1))).join("\n");
  const ending = paragraphs.at(-1) ?? "";
  const openingHasAction = actionTerms.some((term) => opening.includes(term)) || /[「『“\"]/.test(opening);
  const endingHasQuestionOrAction = /[？?]/.test(ending) || actionTerms.some((term) => ending.includes(term));
  const dialogueAction = paragraphs.some((paragraph, index) => /^[「『“\"]/.test(paragraph) && actionTerms.some((term) => (paragraphs[index + 1] ?? "").includes(term)));
  const earlyExposition = paragraphs.slice(0, Math.max(1, Math.ceil(paragraphs.length * .15))).some((paragraph) => (paragraph.match(/[\u3400-\u9fff]/g) ?? []).length >= Number(layer.maximumOpeningParagraphCharacters ?? 240));
  const checks = [
    { feature: "开篇进入场景、动作或局部互动", pass: openingHasAction, weight: 20 },
    { feature: "局部目标在解释前推进", pass: openingHasAction && !earlyExposition, weight: 15 },
    { feature: "关系通过对白与反应交换推进", pass: dialogueAction, weight: 20 },
    { feature: "信息未在开篇整段倾倒", pass: !earlyExposition, weight: 15 },
    { feature: "结尾保留问题或下一动作", pass: endingHasQuestionOrAction, weight: 10 },
    { feature: "达到最小段落数", pass: paragraphs.length >= Number(layer.minimumParagraphs ?? 3), weight: 20 },
  ];
  return { status: "scored", score: Math.round(checks.reduce((sum, item) => sum + (item.pass ? item.weight : 0), 0)), confidence: "proxy_calibrated", evidence: checks };
}

function renderText(result) {
  const line = (name, layer) => `${name}：${layer.score == null ? "未评分" : `${layer.score} 分`}（${layer.confidence}）`;
  return [
    `文风匹配：${result.overall.score == null ? "未形成总分" : `${result.overall.score} 分`}（${result.overall.status}）`,
    `输入：${result.input.characters} 个汉字，${result.input.paragraphs} 段，${result.input.sentences} 句`,
    line("词汇", result.layers.lexical), line("句式", result.layers.sentence),
    line("段落", result.layers.paragraph), line("整篇", result.layers.composition),
    result.warnings.length ? `提示：${result.warnings.join("；")}` : "",
  ].filter(Boolean).join("\n");
}

function run() {
  const { skillDirectory, inputPath, json } = parseInvocation();
  const styleDataPath = path.join(skillDirectory, "references", "style-data.json");
  if (!fs.existsSync(styleDataPath)) throw new Error(`Missing style data: ${styleDataPath}`);
  if (!fs.existsSync(inputPath)) throw new Error(`Missing text file: ${inputPath}`);
  const styleData = JSON.parse(fs.readFileSync(styleDataPath, "utf8"));
  const configPath = path.join(skillDirectory, "references", "style-score-config.json");
  const config = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, "utf8")) : buildDraftConfig(styleData);
  const text = fs.readFileSync(inputPath, "utf8").replace(/^\uFEFF/, "");
  const paragraphs = text.split(/\r?\n+/).map((item) => item.trim()).filter(Boolean);
  const sentences = text.split(/[。！？!?]+/).map((item) => item.trim()).filter(Boolean);
  const characters = (text.match(/[\u3400-\u9fff]/g) ?? []).length;
  const eligibility = proseEligibility(paragraphs, sentences);
  const modes = detectModes(text);
  const lexical = scoreFormLayer(text, characters, config.layers?.lexical, "词汇", modes);
  const sentence = scoreFormLayer(text, characters, config.layers?.sentence, "句式", modes);
  const lexicalForms = Array.isArray(config.layers?.lexical?.forms) ? config.layers.lexical.forms : [];
  const paragraph = scoreParagraphLayer(paragraphs, characters, lexicalForms, config.layers?.paragraph, eligibility);
  const composition = scoreCompositionLayer(paragraphs, characters, lexicalForms, config.layers?.composition, eligibility);
  const scored = [lexical, sentence, paragraph, composition].filter((layer) => Number.isFinite(layer.score));
  const result = {
    schemaVersion: 1,
    scorer: "language-style-score",
    calibrationStatus: config.calibrationStatus ?? "draft",
    input: { file: path.basename(inputPath), characters, paragraphs: paragraphs.length, sentences: sentences.length, detectedModes: [...modes], eligibility },
    overall: { score: scored.length ? Math.round(mean(scored.map((layer) => layer.score))) : null, status: scored.length === 4 ? "calibrated" : "partial", scoredLayers: scored.length },
    layers: { lexical, sentence, paragraph, composition },
    warnings: [
      "分数衡量的是已校准特征的匹配度，不证明作者身份、作品来源或文本质量。",
      "场景限定特征只有在检测到相应叙事场景时才参与评分；未触发显示为不适用，不作扣分。",
      ...(scored.length < 4 ? ["未校准层不计入总分；完成多 Agent 采样、全文回扫和人工标注后再校准。"] : []),
    ],
  };
  process.stdout.write(json ? `${JSON.stringify(result, null, 2)}\n` : `${renderText(result)}\n`);
}

try { run(); } catch (error) { console.error(`ERROR: ${error.message}`); usage(); process.exit(1); }
