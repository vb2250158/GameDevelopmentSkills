#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildBodyAudit } from "./audit-language-style-body.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const initScript = path.join(scriptDirectory, "init-language-style-skill.mjs");
const renderScript = path.join(scriptDirectory, "render-language-style-html.mjs");
const renderStandardScript = path.join(scriptDirectory, "render-language-style-standard-html.mjs");
const validateScript = path.join(scriptDirectory, "validate-language-style-skill.mjs");
const updateDictionariesScript = path.join(scriptDirectory, "update-language-style-dictionaries.mjs");
const analyzeFourLayerScript = path.join(scriptDirectory, "analyze-four-layer-style.mjs");
const importFourLayerCatalogScript = path.join(scriptDirectory, "import-four-layer-style-catalog.mjs");
const sentenceCatalogPath = path.resolve(scriptDirectory, "..", "references", "sentence-style-catalog.json");
const fourLayerCatalogPath = path.resolve(scriptDirectory, "..", "references", "four-layer-type-catalog.json");
const fourLayerSourcePath = path.resolve(scriptDirectory, "..", "references", "文风参数库_四层类型字典.json");
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "language-style-skill-test-"));
const skillName = "test-reasoning-language-style";
const skillDirectory = path.join(temporaryRoot, skillName);

function run(script, args) {
  return spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
}

function write(relativePath, content) {
  const outputPath = path.join(skillDirectory, relativePath);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, content, "utf8");
}

function completedDimensionMatrix(language, layer) {
  const english = language === "en";
  const dimensions = english
    ? {
        sentence: ["Sentence types and speech acts", "Subjects, responsibility, and viewpoint", "Active, passive, and state expressions", "Word order, focus, and information landing", "Affirmation, negation, limitation, and correction", "Logical relations and explicitness", "Complexity and clause organization", "Sentence length, rhythm, and segmentation", "Repetition, parallelism, and progression", "Punctuation distribution"],
        paragraph: ["Central task", "Opening function", "Development function", "Ending function", "Within-paragraph action sequence", "Length, splitting, and merging", "Cohesion, transitions, and layout"],
        composition: ["Purpose, reader, and primary question", "Opening information and answer position", "Background position and depth", "Positions of evidence, examples, counterexamples, and limits", "Information ordering basis", "Whole-text route", "Actions, success criteria, and failure handling", "Purpose, medium, and scenario shifts", "Ending function"],
      }[layer]
    : {
        sentence: ["句类与言语行为", "主语、责任与视角", "主动、被动与状态表达", "语序、焦点与信息落点", "肯定、否定、限制与纠正", "逻辑关系与显化程度", "复杂度与从句组织", "句长、节奏与断句", "重复、平行与递进", "标点分布"],
        paragraph: ["中心任务", "段首功能", "中段展开功能", "段尾功能", "段内动作序列", "长度、拆分与合并", "承接、过渡与排版"],
        composition: ["目的、读者与首要问题", "开头信息与答案位置", "背景位置与展开深度", "证据、例子、反例与限制的位置", "信息排序依据", "全文推进路线", "行动、成功标志与失败处理", "用途、媒介与场景变化", "结尾功能"],
      }[layer];
  const title = english
    ? { sentence: "Sentence dimension matrix", paragraph: "Paragraph dimension matrix", composition: "Composition dimension matrix" }[layer]
    : { sentence: "句式维度检查矩阵", paragraph: "段落维度检查矩阵", composition: "整篇维度检查矩阵" }[layer];
  const headers = english
    ? ["Dimension", "Status", "Observed target-corpus value", "Analysis unit and sample scope", "Count, proportion, or structural metric", "Position and combination", "Observed function", "Comparable control", "Scenario shift", "Confounds", "Validation result", "Confidence", "Supported conclusion", "Unsupported conclusion"]
    : ["维度", "状态", "目标语料的实际取值", "分析单位与样本范围", "数量、比例或结构指标", "位置与组合", "实际功能", "同类对照", "场景变化", "混淆因素", "验证结果", "置信度", "能推出什么", "不能推出什么"];
  const values = english
    ? ["stable", "observed value", "120 units", "measured difference", "observed position", "observed function", "matched control", "documented shift", "documented confound", "passed", "high", "supported result", "unsupported overreach"]
    : ["稳定", "语料实际值", "120 个分析单位", "已测结构差异", "已观察位置组合", "已观察功能", "同类对照", "已记录场景变化", "已记录混淆因素", "通过", "高", "可支持结论", "不可越界结论"];
  const separator = headers.map(() => "---");
  const rows = dimensions.map((dimension) => `| ${dimension} | ${values.join(" | ")} |`);
  return `## ${title}\n\n| ${headers.join(" | ")} |\n|${separator.join("|")}|\n${rows.join("\n")}\n\n`;
}

function completedParameterDictionary(language, layer) {
  const english = language === "en";
  const specification = {
    sentence: { titleZh: "句式参数词典", titleEn: "Sentence parameter dictionary", prefix: "SP", count: 10, dimensionZh: "逻辑关系与显化程度", dimensionEn: "Logical relations and explicitness" },
    paragraph: { titleZh: "段落参数词典", titleEn: "Paragraph parameter dictionary", prefix: "PP", count: 7, dimensionZh: "段内动作序列", dimensionEn: "Within-paragraph action sequence" },
    composition: { titleZh: "整篇参数词典", titleEn: "Composition parameter dictionary", prefix: "CP", count: 8, dimensionZh: "全文推进路线", dimensionEn: "Whole-text route" },
  }[layer];
  const headers = english
    ? ["Parameter ID", "Dimension", "Form", "Observed example or abstract slot", "Usage tendency", "Common conditions", "Reduced-use or inapplicable conditions", "Count, frequency, and coverage", "Position and combination", "Observed function", "Status", "Control and confounds", "Validation and confidence", "Unsupported conclusion"]
    : ["参数 ID", "所属维度", "具体形式", "实际例项或抽象槽位", "使用倾向", "常见条件", "减少使用或不适用的条件", "次数、频率与覆盖", "常见位置与组合", "实际功能", "状态", "同类对照与混淆", "验证结果与置信度", "不能推出什么"];
  const values = english
    ? [specification.dimensionEn, "observed form", "A leads to B", "high when supported", "documented condition", "documented exclusion", "24 occurrences in 18 units", "observed position and combination", "observed function", "stable", "matched control and confound", "passed; high", "unsupported overreach"]
    : [specification.dimensionZh, "已观察形式", "A 推进到 B", "有证据时常用", "已记录条件", "已记录不适用条件", "24 次，覆盖 18 个单位", "已观察位置与组合", "已观察功能", "稳定", "同类对照与混淆已记录", "通过；高", "不能越界推断"];
  const rows = Array.from({ length: specification.count }, (_, index) => `| ${specification.prefix}-${String(index + 1).padStart(2, "0")} | ${values.join(" | ")} |`);
  const title = english ? specification.titleEn : specification.titleZh;
  return `## ${title}\n\n| ${headers.join(" | ")} |\n|${headers.map(() => "---").join("|")}|\n${rows.join("\n")}\n\n`;
}

function injectCompletedDimensionMatrices(directory, language) {
  for (const [layer, fileName] of [["sentence", "sentence-profile.md"], ["paragraph", "paragraph-profile.md"], ["composition", "composition-profile.md"]]) {
    const filePath = path.join(directory, "references", fileName);
    let text = fs.readFileSync(filePath, "utf8");
    const matrix = completedDimensionMatrix(language, layer);
    const heading = language === "en" ? "## " + ({ sentence: "Sentence rules", paragraph: "Paragraph rules", composition: "Composition rules" }[layer]) : "## " + ({ sentence: "句式规则", paragraph: "段落规则", composition: "整篇规则" }[layer]);
    const matrixTitle = language === "en" ? ({ sentence: "Sentence dimension matrix", paragraph: "Paragraph dimension matrix", composition: "Composition dimension matrix" }[layer]) : ({ sentence: "句式维度检查矩阵", paragraph: "段落维度检查矩阵", composition: "整篇维度检查矩阵" }[layer]);
    const matrixPattern = new RegExp(`## ${matrixTitle}[\\s\\S]*?(?=${heading.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")})`);
    text = matrixPattern.test(text) ? text.replace(matrixPattern, matrix) : text.replace(heading, matrix + heading);
    const dictionary = completedParameterDictionary(language, layer);
    const dictionaryTitle = language === "en" ? ({ sentence: "Sentence parameter dictionary", paragraph: "Paragraph parameter dictionary", composition: "Composition parameter dictionary" }[layer]) : ({ sentence: "句式参数词典", paragraph: "段落参数词典", composition: "整篇参数词典" }[layer]);
    const dictionaryPattern = new RegExp(`## ${dictionaryTitle}[\\s\\S]*?(?=${heading.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")})`);
    text = dictionaryPattern.test(text) ? text.replace(dictionaryPattern, dictionary) : text.replace(heading, dictionary + heading);
    fs.writeFileSync(filePath, text, "utf8");
  }
}

function injectCompletedStyleData(directory, language) {
  const item = (id, name, layer, index) => ({
    id: `${id}-${String(index + 1).padStart(2, "0")}`,
    group: layer,
    name: `${name} ${index + 1}`,
    ...(layer === "sentence" ? { template: "A leads to B", relation: "observed relation", recognition: { kind: "regex", pattern: "A" }, validation: { status: "automatic_counted" } } : {}),
    ...(layer === "paragraph" ? { sequence: ["opening", "ending"] } : {}),
    ...(layer === "composition" ? { modules: ["opening", "ending"] } : {}),
    frequency: { count: 12 + index, per10kCharacters: 1 + index, per100Sentences: 1 + index, per100Paragraphs: 1 + index, per100Texts: 1 + index, coverageCount: 10, coverageRatio: 0.2 },
    position: { opening: 2, middle: 4, ending: 3 },
    combinations: [],
    variation: [{ context: "fixture", count: 12 + index }],
    control: { count: 8, rateRatio: 1.5 },
    status: "observed",
  });
  const data = {
    schemaVersion: 1,
    language,
    profileVersion: "fixture-v1",
    corpus: { targetUnits: 120, targetSentences: 240 },
    catalogAudit: { vocabularyGroups: 8, vocabularyCandidateTypes: 130, sentenceCandidateTypes: 97, paragraphCandidateTypes: 20, contentStructureDimensions: 13 },
    vocabularyTypes: Array.from({ length: 130 }, (_, index) => ({ ...item("VT", "Vocabulary", "lexical", index), group: `vocabulary-group-${(index % 8) + 1}` })),
    vocabularyMetrics: Array.from({ length: 8 }, (_, index) => item("VM", "Vocabulary metric", "lexical", index)),
    sentencePatterns: Array.from({ length: 20 }, (_, index) => item("SP", "Sentence", "sentence", index)),
    paragraphPatterns: Array.from({ length: 5 }, (_, index) => item("PP", "Paragraph", "paragraph", index)),
    contentStructures: Array.from({ length: 5 }, (_, index) => item("CP", "Composition", "composition", index)),
    styleProfiles: [{ id: "fixture-profile", name: "Fixture profile", vocabulary: [], sentences: [], paragraphs: [], contentOrder: [], status: "evidence_compiled" }],
  };
  fs.writeFileSync(path.join(directory, "references", "style-data.json"), `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function stampBodyStyleValidation(directory, runId) {
  const reportPath = path.join(directory, "references", "style-extraction-report.json");
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const audit = buildBodyAudit(directory);
  report.bodyStyleValidation = {
    status: "passed",
    ...audit,
    files: audit.files.map((file) => ({ ...file, status: "passed" })),
    review: {
      status: "passed",
      executor: "independent_task",
      runId,
      scope: "Prose body excluding headings, tables, code, JSON, navigation, and controls.",
      resultSummary: "Fixture body uses the target language and applies all four style layers.",
      layerChecks: Object.fromEntries(["lexical", "sentence", "paragraph", "composition"].map((layer) => [layer, { status: "passed", evidence: `${layer} fixture evidence` }])),
    },
  };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
}

function completeLayerMaturity(language) {
  const chinese = language === "zh";
  const unitNames = chinese
    ? { lexical: "词例", sentence: "句子", paragraph: "完整段落", composition: "完整文本" }
    : { lexical: "word occurrence", sentence: "sentence", paragraph: "complete paragraph", composition: "complete text" };
  return {
    overall: "complete",
    lexical: { status: "complete", unitDefinition: unitNames.lexical, corpusUnits: 120, completedChecks: ["frequency", "coverage", "control", "holdout"], missingChecks: [], evidence: "fixture control comparison" },
    sentence: { status: "complete", unitDefinition: unitNames.sentence, corpusUnits: 240, completedChecks: ["length", "clauses", "subject", "speech acts", "control", "review"], missingChecks: [], evidence: "fixture control comparison" },
    paragraph: { status: "complete", unitDefinition: unitNames.paragraph, corpusUnits: 120, completedChecks: ["opening", "development", "ending", "skeleton", "transitions", "control", "manual review"], missingChecks: [], evidence: "fixture control comparison and manual review" },
    composition: { status: "complete", unitDefinition: unitNames.composition, corpusUnits: 30, completedChecks: ["answer position", "background", "evidence order", "route", "ending", "control", "manual review"], missingChecks: [], evidence: "fixture control comparison and manual review" },
  };
}

try {
  const initialized = run(initScript, [
    skillName,
    "--path",
    temporaryRoot,
    "--display-name",
    "测试推演语言风格",
    "--language",
    "zh",
    "--description",
    "用于测试语言风格 Skill 生成和验证流程。",
  ]);
  assert.equal(initialized.status, 0, initialized.stderr || initialized.stdout);

  for (const fileName of [
    "SKILL.md",
    "agents/openai.yaml",
    "references/lexical-profile.md",
    "references/sentence-profile.md",
    "references/paragraph-profile.md",
    "references/composition-profile.md",
    "references/style-profile.md",
    "references/style-extraction-report.json",
    "references/style-guide.html",
  ]) {
    assert.equal(fs.existsSync(path.join(skillDirectory, fileName)), true, `${fileName} missing`);
  }

  const incomplete = run(validateScript, [skillDirectory]);
  assert.equal(incomplete.status, 1, "scaffold must not pass before extraction placeholders are replaced");
  assert.match(incomplete.stderr, /placeholder|待填写|待提取/i);

  const englishSkillName = "test-analytical-language-style";
  const englishSkillDirectory = path.join(temporaryRoot, englishSkillName);
  const englishInitialized = run(initScript, [
    englishSkillName,
    "--path",
    temporaryRoot,
    "--display-name",
    "Analytical Language Style",
    "--language",
    "en",
    "--description",
    "Use an extracted analytical language style for test output.",
  ]);
  assert.equal(
    englishInitialized.status,
    0,
    englishInitialized.stderr || englishInitialized.stdout,
  );
  assert.match(
    fs.readFileSync(path.join(englishSkillDirectory, "SKILL.md"), "utf8"),
    /This is a language style, not a persona/,
  );
  assert.match(
    fs.readFileSync(path.join(englishSkillDirectory, "references", "style-guide.html"), "utf8"),
    /Reading edition generated from the formal profiles/,
  );
  assert.match(
    fs.readFileSync(
      path.join(englishSkillDirectory, "references", "lexical-profile.md"),
      "utf8",
    ),
    /Observed words/,
  );
  const incompleteEnglish = run(validateScript, [englishSkillDirectory]);
  assert.equal(
    incompleteEnglish.status,
    1,
    "English scaffold must not pass before extraction placeholders are replaced",
  );
  assert.match(incompleteEnglish.stderr, /placeholder|To extract|not_applicable|not_run/i);

  function writeEnglish(relativePath, content) {
    const outputPath = path.join(englishSkillDirectory, relativePath);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, content, "utf8");
  }

  writeEnglish(
    "references/lexical-profile.md",
    `# Analytical Language Style: Lexical profile

## Target language and corpus scope

- Target language: English.
- Corpus scope: 120 technical explanation units plus a matched control.

## Lexical rules

| Rule ID | Word category | Observed words | Rule category | Status | Output rule | Frequency and coverage | Position and collocation | Alternatives and control | Shift trigger | Evidence | Validation result | Confidence |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| L-01 | Conditions | if | corpus observation | stable | Use only for outcome-changing conditions | 42 uses across 30 units | sentence opening; if...then | whether is lower in control | the branch closes | full corpus and control | sample and full corpus passed | high |
`,
  );
  writeEnglish(
    "references/sentence-profile.md",
    `# Analytical Language Style: Sentence profile

## Sentence rules

| Rule ID | Rule category | Status | Applicability | Primary tendency | Secondary tendency | Evidence | Shift trigger | Confounds and exceptions | Validation result | Confidence |
|---|---|---|---|---|---|---|---|---|---|---|
| S-01 | style inference | stable | conditional analysis | condition before result | short conclusion | full corpus and control | branch exists | genre effect excluded | holdout passed | high |

## Sentence length, clauses, and relation chains

- Sentence length and clause count were compared with a control corpus.

## Subject, responsibility, questions, negation, and commands

- Subject and responsibility positions were reviewed; questions, negation, and commands were counted.

## Calibration

- Positive and negative calibration examples preserve the same facts.
`,
  );
  writeEnglish(
    "references/paragraph-profile.md",
    `# Analytical Language Style: Paragraph profile

## Paragraph rules

| Rule ID | Rule category | Status | Applicability | Primary tendency | Secondary tendency | Evidence | Shift trigger | Confounds and exceptions | Validation result | Confidence |
|---|---|---|---|---|---|---|---|---|---|---|
| P-01 | style inference | contextual | analysis paragraph | one decision per paragraph | action at the end | corpus control and manual review | decision changes | short answers may stay in one paragraph | manual review passed | medium |

## Paragraph opening, development, and ending

- Paragraph opening states the current decision; development explains a condition; paragraph ending gives the next action.

## Skeleton, splitting, transitions, and lists

- The skeleton follows condition to result; splitting follows a decision change; transitions name the relation; lists hold independent items.

## Calibration

- Positive and negative paragraph calibration was manually reviewed against the control.
`,
  );
  writeEnglish(
    "references/composition-profile.md",
    `# Analytical Language Style: Composition profile

## Composition rules

| Rule ID | Rule category | Status | Applicability | Primary tendency | Secondary tendency | Evidence | Shift trigger | Confounds and exceptions | Validation result | Confidence |
|---|---|---|---|---|---|---|---|---|---|---|
| C-01 | style inference | contextual | technical explanation | current answer first | conditions next | corpus control and manual review | reader changes | narrative tasks may differ | manual review passed | medium |

## Answer, background, and evidence

- Put the answer first, keep background local, and place evidence beside the claim it limits.

## Counterexamples, action, and ending

- Put counterexamples beside the affected claim, then state the action and ending condition.

## Branch route and calibration

- Branches preserve alternative outcomes; positive and negative calibration was manually reviewed against the control.
`,
  );
  writeEnglish(
    "references/style-profile.md",
    `# Analytical Language Style: Style profile

This page links the [lexical profile](lexical-profile.md), [sentence profile](sentence-profile.md), [paragraph profile](paragraph-profile.md), and [composition profile](composition-profile.md).

## Scope

- English analytical replies.

## Layer validation status

Lexical and sentence rules are stable. Paragraph and composition rules are task adapters.

## Runtime rules

| Rule ID | Source rule | Status | Output rule | Validation result | Shift trigger |
|---|---|---|---|---|---|
| R-01 | L-01 and S-01 | stable | Use real conditions to reach a bounded result | holdout and forward tests passed | the branch closes |

## Primary tendency and secondary tendency

- Primary tendency: condition-to-result reasoning.
- Secondary tendency: short bounded conclusions.

## Shift triggers

- Close the branch when evidence is sufficient.

## Voice fingerprints

- R-01: condition plus result.
- R-01: bounded conclusion plus scope.
- R-01: evidence plus next action.

## Forbidden and non-transferable content

- Forbidden: unsupported absolutes.
- Non-transferable: source identity, source lines, subject matter facts, and private information.

## Calibration

- Positive calibration: a real condition limits the result.
- Negative calibration and failure layer: an unsupported absolute expands the result.
`,
  );
  writeEnglish(
    "SKILL.md",
    `---
name: ${englishSkillName}
description: Use an extracted analytical language style for English replies and documents.
---

# Analytical Language Style

If a condition remains unresolved, keep the possible branch open; because the current evidence is limited, state what must be checked next. Read the [lexical profile](references/lexical-profile.md), [sentence profile](references/sentence-profile.md), [paragraph profile](references/paragraph-profile.md), [composition profile](references/composition-profile.md), [style profile](references/style-profile.md), [evidence report](references/style-extraction-report.json), and [HTML guide](references/style-guide.html).
`,
  );
  writeEnglish(
    "references/style-extraction-report.json",
    JSON.stringify(
      {
        schemaVersion: 1,
        context: { language: "en", textType: "technical explanation", corpusUnits: 120 },
        layerMaturity: completeLayerMaturity("en"),
        observations: [
          {
            ruleId: "L-01",
            ruleCategory: "corpus_observation",
            status: "stable",
            applicability: "conditional explanations",
            primaryTendency: "use if for real conditions",
            secondaryTendency: "state the result next",
            evidence: "full corpus and control",
            shiftTrigger: "the branch closes",
            confounds: "topic-specific hypotheses",
            validationResult: "passed",
            confidence: "high",
          },
          {
            ruleId: "S-01", ruleCategory: "style_inference", status: "stable", applicability: "sentences", primaryTendency: "condition before result", secondaryTendency: "bounded ending", evidence: "control comparison", shiftTrigger: "branch closes", confounds: "genre", validationResult: "passed", confidence: "high",
          },
          {
            ruleId: "P-01", ruleCategory: "style_inference", status: "contextual", applicability: "paragraphs", primaryTendency: "decision opening", secondaryTendency: "action ending", evidence: "control and manual review", shiftTrigger: "decision changes", confounds: "short replies", validationResult: "passed", confidence: "medium",
          },
          {
            ruleId: "C-01", ruleCategory: "style_inference", status: "contextual", applicability: "complete explanations", primaryTendency: "answer before conditions", secondaryTendency: "action at ending", evidence: "control and manual review", shiftTrigger: "reader changes", confounds: "genre", validationResult: "passed", confidence: "medium",
          },
        ],
        validation: {
          sampleFullStability: { status: "passed", evidence: "English fixture" },
          holdoutReproduction: { status: "passed", evidence: "English fixture" },
          controlDiscrimination: { status: "passed", evidence: "English fixture" },
          oneVariableTests: { status: "passed", evidence: "English fixture" },
          forwardGeneration: {
            status: "passed",
            evidence: {
              runs: [
                {
                  runId: "english-short",
                  kind: "short",
                  executor: "independent_agent",
                  task: "Answer a bounded configuration question.",
                  resultSummary: "The answer preserved the unresolved runtime condition.",
                  status: "passed",
                  contentPreserved: true,
                  provenanceLeakage: false,
                },
                {
                  runId: "english-long",
                  kind: "long",
                  executor: "independent_task",
                  task: "Write a technical validation note.",
                  resultSummary: "The note separated evidence, conditions, and action.",
                  status: "passed",
                  contentPreserved: true,
                  provenanceLeakage: false,
                },
              ],
            },
          },
          contentPreservation: { status: "passed", evidence: "English fixture" },
          provenanceLeakage: { status: "passed", evidence: "English fixture" },
        },
      },
      null,
      2,
    ),
  );
  injectCompletedDimensionMatrices(englishSkillDirectory, "en");
  injectCompletedStyleData(englishSkillDirectory, "en");
  const renderedEnglish = run(renderScript, [englishSkillDirectory]);
  assert.equal(renderedEnglish.status, 0, renderedEnglish.stderr || renderedEnglish.stdout);
  stampBodyStyleValidation(englishSkillDirectory, "english-body-style");
  const rerenderedEnglish = run(renderScript, [englishSkillDirectory]);
  assert.equal(rerenderedEnglish.status, 0, rerenderedEnglish.stderr || rerenderedEnglish.stdout);
  const validEnglish = run(validateScript, [englishSkillDirectory]);
  assert.equal(validEnglish.status, 0, validEnglish.stderr || validEnglish.stdout);
  const completeEnglish = run(validateScript, [englishSkillDirectory, "--require-complete"]);
  assert.equal(completeEnglish.status, 0, completeEnglish.stderr || completeEnglish.stdout);
  const falselyIncompleteDataPath = path.join(englishSkillDirectory, "references", "style-data.json");
  const falselyIncompleteData = JSON.parse(fs.readFileSync(falselyIncompleteDataPath, "utf8"));
  falselyIncompleteData.sentencePatterns[0].status = "not_measured";
  falselyIncompleteData.sentencePatterns[0].frequency.count = null;
  falselyIncompleteData.sentencePatterns[0].frequency.per100Sentences = null;
  fs.writeFileSync(falselyIncompleteDataPath, `${JSON.stringify(falselyIncompleteData, null, 2)}\n`, "utf8");
  const falseCompleteEnglish = run(validateScript, [englishSkillDirectory, "--require-complete"]);
  assert.equal(falseCompleteEnglish.status, 1, "complete validation must reject unmeasured style-data even when the report says complete");
  assert.match(falseCompleteEnglish.stderr, /not_measured|unresolved/i);
  injectCompletedStyleData(englishSkillDirectory, "en");

  write(
    "references/lexical-profile.md",
    `# 测试推演语言风格：词汇档案

## 目标语言与语料范围

- 目标语言：中文。
- 语料范围：120 个技术说明单位及同文体对照。

## 词汇规则

| 规则 ID | 词汇类别 | 实证词 | 规则类别 | 状态 | 使用方式 | 频率与覆盖 | 位置与搭配 | 同义替代与对照 | 变化触发条件 | 证据 | 验证结果 | 置信度 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| L-01 | 条件 | 如果 | 语料观察 | 稳定 | 条件改变结果时使用 | 42 次，覆盖 30 个单位 | 常在句首，与结果词搭配 | “若”较少，对照更低 | 分支封闭 | 全文与对照 | 样本与全文通过 | 高 |
`,
  );
  write(
    "references/sentence-profile.md",
    `# 测试推演语言风格：句式档案

## 句式规则

| 规则 ID | 规则类别 | 状态 | 适用范围 | 主要倾向 | 次要倾向 | 证据 | 变化触发条件 | 混淆因素与例外 | 验证结果 | 置信度 |
|---|---|---|---|---|---|---|---|---|---|---|
| S-01 | 风格推断 | 稳定 | 条件句 | 条件先行 | 结果随后 | 全文与对照 | 分支存在 | 题材影响已排除 | 保留样本通过 | 高 |

## 句长、分句与关系链

- 句长和分句数量已经与对照语料比较。

## 主语、责任主体、问句、否定与命令

- 主语和责任主体位置经过复核；问句、否定和命令方式分别统计。

## 校准

- 正反校准保持相同事实，只改变句式参数。
`,
  );
  write(
    "references/paragraph-profile.md",
    `# 测试推演语言风格：段落档案

## 段落规则

| 规则 ID | 规则类别 | 状态 | 适用范围 | 主要倾向 | 次要倾向 | 证据 | 变化触发条件 | 混淆因素与例外 | 验证结果 | 置信度 |
|---|---|---|---|---|---|---|---|---|---|---|
| P-01 | 风格推断 | 场景限定 | 分析段 | 条件推进 | 短句收束 | 对照语料与人工复核 | 分支存在 | 对话格式影响 | 人工复核通过 | 中 |

## 段首、展开与段尾

- 段首写当前判断，展开写条件，段尾写动作。

## 骨架、拆段、过渡与列表

- 骨架按条件推进；结论改变时拆段；过渡写真实关系；列表只放独立项目。

## 校准

- 正反段落样例已经与对照进行人工复核。
`,
  );
  write(
    "references/composition-profile.md",
    `# 测试推演语言风格：整篇编排档案

## 整篇规则

| 规则 ID | 规则类别 | 状态 | 适用范围 | 主要倾向 | 次要倾向 | 证据 | 变化触发条件 | 混淆因素与例外 | 验证结果 | 置信度 |
|---|---|---|---|---|---|---|---|---|---|---|
| C-01 | 风格推断 | 场景限定 | 技术说明 | 结论靠前 | 条件随后 | 对照语料与人工复核 | 读者改变 | 文体默认已比较 | 人工复核通过 | 中 |

## 答案、背景与证据

- 答案靠前，背景就近，证据紧邻受其限制的结论。

## 反例、行动与结尾

- 反例紧邻原结论，随后给行动和结尾条件。

## 分支路线与校准

- 分支保留不同结果；正反整篇样例已经与对照进行人工复核。
`,
  );
  write(
    "references/style-profile.md",
    `# 测试推演语言风格：总风格参数

本页链接 [词汇档案](lexical-profile.md)、[句式档案](sentence-profile.md)、[段落档案](paragraph-profile.md) 与 [整篇编排档案](composition-profile.md)。

## 适用范围

- 中文技术说明。

## 分层验证状态

词汇、句式稳定；段落和整篇场景限定。

## 运行时规则

| 规则 ID | 来源规则 | 状态 | 输出规则 | 验证结果 | 变化触发条件 |
|---|---|---|---|---|---|
| R-01 | L-01、S-01 | 稳定 | 用真实条件推进当前判断 | 保留样本通过 | 分支关闭时压缩条件 |
| R-02 | P-01、C-01 | 场景限定 | 技术说明中先写当前结论 | 前向测试通过 | 读者或文体改变 |

## 主倾向与次倾向

- 主倾向：条件推进。
- 次倾向：短句收束。

## 场景变化触发条件

- 读者变化时调整解释深度。

## 声音指纹

- R-01：条件 + 结果。
- R-01：有限结论 + 范围。
- R-01：证据 + 下一动作。

## 禁止项与不可迁移内容

- 禁止项：无依据的绝对词。
- 不可迁移内容：来源身份和题材事实。

## 正反校准

- 正向：条件真实，结论有限。
- 反向：条件缺失却使用绝对结论。
`,
  );
  write(
    "SKILL.md",
    `---
name: ${skillName}
description: 使用经过提取和验证的测试推演语言风格生成中文答复与文档。
---

# 测试推演语言风格

如果条件仍未封闭，那么先保留可能性；因为当前证据只支持有限范围，所以必须说明下一步需要验证什么。普通答复读取 [词汇档案](references/lexical-profile.md)、[句式档案](references/sentence-profile.md)、[段落档案](references/paragraph-profile.md)、[整篇编排档案](references/composition-profile.md)、[总风格参数](references/style-profile.md)、[证据报告](references/style-extraction-report.json) 和 [HTML 阅读版](references/style-guide.html)。
`,
  );
  write(
    "references/style-extraction-report.json",
    JSON.stringify(
      {
        schemaVersion: 1,
        context: { language: "zh", textType: "技术说明", corpusUnits: 120 },
        layerMaturity: completeLayerMaturity("zh"),
        observations: [
          {
            ruleId: "L-01",
            ruleCategory: "corpus_observation",
            status: "stable",
            applicability: "条件说明",
            primaryTendency: "真实条件使用如果",
            secondaryTendency: "随后写结果",
            evidence: "全文与对照",
            shiftTrigger: "分支封闭",
            confounds: "题材假设",
            validationResult: "passed",
            confidence: "high",
          },
          {
            ruleId: "S-01",
            ruleCategory: "style_inference",
            status: "stable",
            applicability: "条件句",
            primaryTendency: "条件先行",
            secondaryTendency: "结果随后",
            evidence: "保留样本",
            shiftTrigger: "分支出现",
            confounds: "文体默认",
            validationResult: "passed",
            confidence: "high",
          },
          {
            ruleId: "P-01", ruleCategory: "style_inference", status: "contextual", applicability: "分析段", primaryTendency: "段首固定判断", secondaryTendency: "段尾交付动作", evidence: "对照与人工复核", shiftTrigger: "分支存在", confounds: "对话格式", validationResult: "passed", confidence: "medium",
          },
          {
            ruleId: "C-01", ruleCategory: "style_inference", status: "contextual", applicability: "完整说明", primaryTendency: "答案靠前", secondaryTendency: "结尾交付行动", evidence: "对照与人工复核", shiftTrigger: "读者改变", confounds: "文体默认", validationResult: "passed", confidence: "medium",
          },
        ],
        validation: {
          sampleFullStability: { status: "passed", evidence: "test fixture" },
          holdoutReproduction: { status: "passed", evidence: "test fixture" },
          controlDiscrimination: { status: "passed", evidence: "test fixture" },
          oneVariableTests: { status: "passed", evidence: "test fixture" },
          forwardGeneration: {
            status: "passed",
            evidence: {
              runs: [
                {
                  runId: "zh-short",
                  kind: "short",
                  executor: "independent_agent",
                  task: "回答一个有限条件问题。",
                  resultSummary: "答复保留了未封闭条件。",
                  status: "passed",
                  contentPreserved: true,
                  provenanceLeakage: false,
                },
                {
                  runId: "zh-long",
                  kind: "long",
                  executor: "independent_task",
                  task: "写一份技术验证说明。",
                  resultSummary: "说明分开证据、条件和行动。",
                  status: "passed",
                  contentPreserved: true,
                  provenanceLeakage: false,
                },
              ],
            },
          },
          contentPreservation: { status: "passed", evidence: "test fixture" },
          provenanceLeakage: { status: "passed", evidence: "test fixture" },
        },
      },
      null,
      2,
    ),
  );

  injectCompletedDimensionMatrices(skillDirectory, "zh");
  injectCompletedStyleData(skillDirectory, "zh");
  const rendered = run(renderScript, [skillDirectory]);
  assert.equal(rendered.status, 0, rendered.stderr || rendered.stdout);
  stampBodyStyleValidation(skillDirectory, "zh-body-style");
  const rerendered = run(renderScript, [skillDirectory]);
  assert.equal(rerendered.status, 0, rerendered.stderr || rerendered.stdout);
  const generatedHtml = fs.readFileSync(
    path.join(skillDirectory, "references", "style-guide.html"),
    "utf8",
  );
  assert.match(generatedHtml, /data-style-guide="generated"/);
  assert.match(generatedHtml, /搜索全部档案/);
  assert.match(generatedHtml, /language-style-source-hash/);
  assert.match(generatedHtml, /\.\.\/\.\.\/clear-science-writing\/references\/language-style-standard\.html/);
  assert.doesNotMatch(generatedHtml, /<details class="source-panel"[^>]*id="doc-skill-md"/);
  assert.match(generatedHtml, /id="vocabularyDictionaryData" type="application\/json"/);
  assert.match(generatedHtml, /data-vocabulary-search/);
  assert.match(generatedHtml, /data-vocabulary-view="types"/);
  assert.match(generatedHtml, /data-vocabulary-view="words"/);
  assert.match(generatedHtml, /data-vocabulary-overlap/);
  assert.match(generatedHtml, /data-vocabulary-apply/);
  assert.match(generatedHtml, /data-vocabulary-import/);
  assert.match(generatedHtml, /data-vocabulary-export/);
  assert.match(generatedHtml, /data-vocabulary-download-html/);
  assert.match(generatedHtml, /多重归类词/);
  assert.match(generatedHtml, /typeHitRate\(type\) < 0\.01/);
  assert.match(generatedHtml, /Number\(word\.hitRate \?\? -1\) < 0\.01/);
  assert.match(generatedHtml, /height:336px/);
  assert.match(generatedHtml, /scrollbar-gutter:stable/);
  assert.match(generatedHtml, /observed-headline/);
  assert.match(generatedHtml, /<article class="dictionary-card word-card"><h3>/);
  const embeddedVocabularyText = generatedHtml.match(/<script id="vocabularyDictionaryData" type="application\/json">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(embeddedVocabularyText, "generated HTML must embed the vocabulary dictionary JSON");
  const embeddedVocabulary = JSON.parse(embeddedVocabularyText);
  assert.equal(embeddedVocabulary.sourceStatistics.candidateTypes, 193);
  assert.equal(embeddedVocabulary.sourceStatistics.targetTypes, 130);
  assert.equal(embeddedVocabulary.types.length, embeddedVocabulary.sourceStatistics.displayedTypes);
  assert.equal(embeddedVocabulary.types.filter((type) => type.origin !== "target_extension").length, embeddedVocabulary.sourceStatistics.mappedTargetTypes);
  assert.equal(embeddedVocabulary.types.filter((type) => type.origin === "target_extension").length, embeddedVocabulary.sourceStatistics.targetExtensions);
  assert.ok(embeddedVocabulary.groups.every((group) => embeddedVocabulary.types.some((type) => type.group === group.id)), "target dictionary must not retain unused candidate groups");
  assert.ok(embeddedVocabulary.types.every((type) => type.frequency?.count == null || type.frequency.count > 0), "target dictionary must omit zero-hit vocabulary types");
  assert.ok(embeddedVocabulary.words.every((word) => word.totalCount > 0), "target dictionary must omit zero-hit vocabulary words");
  assert.equal(embeddedVocabulary.sourceStatistics.rawEntries, embeddedVocabulary.types.reduce((sum, type) => sum + type.words.length, 0));
  assert.equal(embeddedVocabulary.sourceStatistics.uniqueWords, embeddedVocabulary.words.length);
  assert.equal(embeddedVocabulary.sourceStatistics.overlapWords, embeddedVocabulary.words.filter((word) => word.overlap).length);
  const generatedVocabularyPath = path.join(skillDirectory, "references", "vocabulary-dictionary.json");
  assert.ok(fs.existsSync(generatedVocabularyPath), "renderer must also write a standalone vocabulary dictionary JSON");
  const generatedVocabulary = JSON.parse(fs.readFileSync(generatedVocabularyPath, "utf8"));
  assert.deepEqual(generatedVocabulary, embeddedVocabulary, "standalone and embedded vocabulary dictionaries must match");
  assert.match(generatedHtml, /id="sentenceDictionaryData" type="application\/json"/);
  for (const control of ["data-sentence-search", "data-sentence-group", "data-sentence-view=\"types\"", "data-sentence-view=\"patterns\"", "data-sentence-measured", "data-sentence-apply", "data-sentence-import", "data-sentence-export", "data-sentence-download-html"]) assert.match(generatedHtml, new RegExp(control));
  const embeddedSentenceText = generatedHtml.match(/<script id="sentenceDictionaryData" type="application\/json">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(embeddedSentenceText, "generated HTML must embed the sentence dictionary JSON");
  const embeddedSentence = JSON.parse(embeddedSentenceText);
  assert.ok(embeddedSentence.sentenceTypeAxes.length <= 9);
  assert.ok(embeddedSentence.sentenceTypes.length <= 129);
  assert.equal(embeddedSentence.sourceStatistics.patterns, 286);
  assert.equal(embeddedSentence.sentencePatterns.length, embeddedSentence.sourceStatistics.displayedPatterns);
  assert.ok(embeddedSentence.sentencePatterns.every((pattern) => embeddedSentence.patternMeasurements?.[pattern.id]?.frequency?.count == null || embeddedSentence.patternMeasurements[pattern.id].frequency.count > 0), "target dictionary must omit zero-hit sentence patterns");
  const generatedSentencePath = path.join(skillDirectory, "references", "sentence-dictionary.json");
  assert.ok(fs.existsSync(generatedSentencePath), "renderer must write a standalone sentence dictionary JSON");
  assert.deepEqual(JSON.parse(fs.readFileSync(generatedSentencePath, "utf8")), embeddedSentence, "standalone and embedded sentence dictionaries must match");
  for (const [prefix, expectedAxes, expectedTypes, expectedPatterns] of [["paragraph", 8, 112, 65], ["composition", 9, 118, 60]]) {
    assert.match(generatedHtml, new RegExp(`id="${prefix}DictionaryData" type="application/json"`));
    for (const control of [`data-${prefix}-search`, `data-${prefix}-group`, `data-${prefix}-view="types"`, `data-${prefix}-view="patterns"`, `data-${prefix}-measured`, `data-${prefix}-apply`, `data-${prefix}-import`, `data-${prefix}-export`, `data-${prefix}-download-html`]) assert.match(generatedHtml, new RegExp(control));
    const embeddedText = generatedHtml.match(new RegExp(`<script id="${prefix}DictionaryData" type="application/json">([\\s\\S]*?)<\\/script>`))?.[1];
    assert.ok(embeddedText, `generated HTML must embed the ${prefix} dictionary JSON`);
    const embedded = JSON.parse(embeddedText);
    assert.ok(embedded.axes.length <= expectedAxes);
    assert.ok(embedded.types.length <= expectedTypes);
    assert.equal(embedded.sourceStatistics.patterns, expectedPatterns);
    assert.equal(embedded.axes.length, embedded.sourceStatistics.displayedAxes);
    assert.equal(embedded.types.length, embedded.sourceStatistics.displayedTypes);
    assert.equal(embedded.patterns.length, embedded.sourceStatistics.displayedPatterns);
    assert.ok(embedded.patterns.every((pattern) => embedded.measurements?.[pattern.id]?.frequency?.count == null || embedded.measurements[pattern.id].frequency.count > 0), `target dictionary must omit zero-hit ${prefix} patterns`);
    const generatedPath = path.join(skillDirectory, "references", `${prefix}-dictionary.json`);
    assert.ok(fs.existsSync(generatedPath), `renderer must write a standalone ${prefix} dictionary JSON`);
    assert.deepEqual(JSON.parse(fs.readFileSync(generatedPath, "utf8")), embedded, `standalone and embedded ${prefix} dictionaries must match`);
  }
  const sharedSentenceCatalog = JSON.parse(fs.readFileSync(sentenceCatalogPath, "utf8"));
  assert.equal(sharedSentenceCatalog.sentenceTypeAxes.length, 9);
  assert.equal(sharedSentenceCatalog.sentenceTypes.length, 129);
  assert.equal(sharedSentenceCatalog.sentencePatterns.length, 286);
  const sharedFourLayerCatalog = JSON.parse(fs.readFileSync(fourLayerCatalogPath, "utf8"));
  assert.equal(sharedFourLayerCatalog.paragraphTypeAxes.length, 8);
  assert.equal(sharedFourLayerCatalog.paragraphTypes.length, 112);
  assert.equal(sharedFourLayerCatalog.paragraphPatterns.length, 65);
  assert.equal(sharedFourLayerCatalog.contentTypeAxes.length, 9);
  assert.equal(sharedFourLayerCatalog.contentTypes.length, 118);
  assert.equal(sharedFourLayerCatalog.contentStructures.length, 60);
  const importedCatalogPath = path.join(temporaryRoot, "four-layer-type-catalog.json");
  const firstImport = run(importFourLayerCatalogScript, [fourLayerSourcePath, importedCatalogPath]);
  assert.equal(firstImport.status, 0, firstImport.stderr || firstImport.stdout);
  const secondImport = run(importFourLayerCatalogScript, [fourLayerSourcePath, importedCatalogPath]);
  assert.equal(secondImport.status, 0, secondImport.stderr || secondImport.stdout);
  const importedCatalog = JSON.parse(fs.readFileSync(importedCatalogPath, "utf8"));
  assert.equal(importedCatalog.vocabularyTypes.length, 193);
  assert.equal(importedCatalog.paragraphTypes.length, 112);
  assert.equal(importedCatalog.contentTypes.length, 118);
  const importReport = JSON.parse(fs.readFileSync(path.join(temporaryRoot, "four-layer-catalog-update-report.json"), "utf8"));
  assert.equal(importReport.added.paragraphTypes.length, 0);
  assert.equal(importReport.changed.paragraphTypes.length, 0);
  assert.equal(importReport.added.contentTypes.length, 0);
  assert.equal(importReport.changed.contentTypes.length, 0);
  const updatedDictionaries = run(updateDictionariesScript, [skillDirectory]);
  assert.equal(updatedDictionaries.status, 0, updatedDictionaries.stderr || updatedDictionaries.stdout);
  const updateReport = JSON.parse(fs.readFileSync(path.join(skillDirectory, "references", "dictionary-update-report.json"), "utf8"));
  assert.ok(updateReport.sentence.axes <= 9);
  assert.ok(updateReport.sentence.types <= 129);
  assert.ok(updateReport.sentence.sharedPatterns <= 286);
  assert.ok(updateReport.paragraph.axes <= 8);
  assert.ok(updateReport.paragraph.types <= 112);
  assert.ok(updateReport.paragraph.sharedPatterns <= 65);
  assert.ok(updateReport.composition.axes <= 9);
  assert.ok(updateReport.composition.types <= 118);
  assert.ok(updateReport.composition.sharedPatterns <= 60);
  assert.ok(Array.isArray(updateReport.promotionCandidates));
  assert.equal(updateReport.learning.exists, false);
  assert.equal(updateReport.learning.samples, 0);
  const learningLogPath = path.join(skillDirectory, "references", "style-learning-log.jsonl");
  fs.writeFileSync(learningLogPath, [
    JSON.stringify({ sampleId: "source-1", recordedAt: "2026-08-12T00:00:00.000Z", language: "zh-CN", sourceKind: "source_corpus", decision: "include_source_evidence", textHash: "sha256:source", layers: ["lexical"], candidateParameters: [{ layer: "lexical", form: "如果" }], reviewStatus: "reviewed" }),
    JSON.stringify({ sampleId: "accepted-1", recordedAt: "2026-08-12T00:00:01.000Z", language: "zh-CN", sourceKind: "user_accepted", decision: "include_adaptation_evidence", textHash: "sha256:accepted", layers: ["sentence"], candidateParameters: [{ layer: "sentence", form: "不是 A，而是 B" }], reviewStatus: "reviewed" }),
    JSON.stringify({ sampleId: "rejected-1", recordedAt: "2026-08-12T00:00:02.000Z", language: "zh-CN", sourceKind: "user_rejected", decision: "negative_evidence", textHash: "sha256:rejected", layers: ["sentence"], reviewStatus: "reviewed" }),
    JSON.stringify({ sampleId: "model-1", recordedAt: "2026-08-12T00:00:03.000Z", language: "zh-CN", sourceKind: "model_candidate", decision: "candidate_only", textHash: "sha256:model", layers: ["paragraph"], candidateParameters: [{ layer: "paragraph", form: "判断 → 原因 → 行动" }], reviewStatus: "unreviewed" }),
  ].join("\n") + "\n", "utf8");
  const updatedWithLearning = run(updateDictionariesScript, [skillDirectory]);
  assert.equal(updatedWithLearning.status, 0, updatedWithLearning.stderr || updatedWithLearning.stdout);
  const learningReport = JSON.parse(fs.readFileSync(path.join(skillDirectory, "references", "dictionary-update-report.json"), "utf8"));
  assert.equal(learningReport.learning.samples, 4);
  assert.equal(learningReport.learning.formallyEligible, 2);
  assert.equal(learningReport.learning.negativeSamples, 1);
  assert.equal(learningReport.learning.candidateOnlySamples, 1);
  assert.equal(learningReport.learning.candidateParameters.length, 3);
  const analyzerTargetPath = path.join(temporaryRoot, "sentence-target.jsonl");
  const analyzerControlPath = path.join(temporaryRoot, "sentence-control.jsonl");
  const analyzerOutputPath = path.join(temporaryRoot, "sentence-style-data.json");
  fs.writeFileSync(analyzerTargetPath, [
    JSON.stringify({ unitId: "t1", text: "因为缓存没有更新，所以页面仍然显示旧值。" }),
    JSON.stringify({ unitId: "t2", text: "这不是权限问题，而是配置问题。" }),
    JSON.stringify({ unitId: "t3", text: "你完成了吗？" }),
  ].join("\n") + "\n", "utf8");
  fs.writeFileSync(analyzerControlPath, [
    JSON.stringify({ unitId: "c1", text: "今天星期一。" }),
    JSON.stringify({ unitId: "c2", text: "门口站着一个人。" }),
  ].join("\n") + "\n", "utf8");
  const analyzedWithSentenceCatalog = run(analyzeFourLayerScript, [
    "--target", analyzerTargetPath,
    "--control", analyzerControlPath,
    "--output", analyzerOutputPath,
    "--catalog", path.resolve(scriptDirectory, "..", "references", "four-layer-feature-catalog.json"),
  ]);
  assert.equal(analyzedWithSentenceCatalog.status, 0, analyzedWithSentenceCatalog.stderr || analyzedWithSentenceCatalog.stdout);
  const analyzedStyleData = JSON.parse(fs.readFileSync(analyzerOutputPath, "utf8"));
  assert.equal(analyzedStyleData.catalogAudit.sentenceTypeAxes, 9);
  assert.equal(analyzedStyleData.catalogAudit.sentenceCandidateTypes, 129);
  assert.equal(analyzedStyleData.catalogAudit.sentencePatternCandidates, 286);
  assert.equal(analyzedStyleData.catalogAudit.paragraphTypeAxes, 8);
  assert.equal(analyzedStyleData.catalogAudit.paragraphCandidateTypes, 112);
  assert.equal(analyzedStyleData.catalogAudit.paragraphPatternCandidates, 65);
  assert.equal(analyzedStyleData.catalogAudit.contentTypeAxes, 9);
  assert.equal(analyzedStyleData.catalogAudit.contentCandidateTypes, 118);
  assert.equal(analyzedStyleData.catalogAudit.contentStructureCandidates, 60);
  assert.ok(analyzedStyleData.paragraphPatterns.some((item) => item.id === "definition-example" && item.status === "not_measured"));
  assert.ok(analyzedStyleData.contentStructures.some((item) => item.id === "chronological-narrative" && item.status === "not_measured"));
  const measuredBecauseSo = analyzedStyleData.sentencePatterns.find((item) => item.id === "because-so");
  assert.equal(measuredBecauseSo?.frequency.count, 1, "catalog detect rules must participate in the next analysis run");
  const unmeasuredSubjectPredicate = analyzedStyleData.sentencePatterns.find((item) => item.id === "subject-predicate");
  assert.equal(unmeasuredSubjectPredicate?.status, "not_measured", "catalog patterns without detect rules must not be recorded as zero");
  const generatedInlineScripts = [...generatedHtml.matchAll(/<script(?![^>]*type="application\/json")[^>]*>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
  assert.ok(generatedInlineScripts.length > 0, "generated HTML must contain an executable inline script");
  for (const inlineScript of generatedInlineScripts) new vm.Script(inlineScript);

  const standardOutput = path.join(temporaryRoot, "language-style-standard.html");
  const renderedStandard = run(renderStandardScript, [
    path.resolve(scriptDirectory, ".."),
    "--output",
    standardOutput,
  ]);
  assert.equal(renderedStandard.status, 0, renderedStandard.stderr || renderedStandard.stdout);
  const standardHtml = fs.readFileSync(standardOutput, "utf8");
  assert.match(standardHtml, /data-language-style-standard="generated"/);
  assert.match(standardHtml, /语言风格提取与生成通用规范/);
  assert.match(standardHtml, /lexical-extraction\.md/);

  const valid = run(validateScript, [skillDirectory]);
  assert.equal(valid.status, 0, valid.stderr || valid.stdout);
  const complete = run(validateScript, [skillDirectory, "--require-complete"]);
  assert.equal(complete.status, 0, complete.stderr || complete.stdout);

  const bodyStylePath = path.join(skillDirectory, "references", "style-profile.md");
  const bodyStyleText = fs.readFileSync(bodyStylePath, "utf8");
  fs.writeFileSync(bodyStylePath, bodyStyleText.replace("条件推进。", "如果条件仍未封闭，就继续保留分支。"), "utf8");
  const bodyStyleRerender = run(renderScript, [skillDirectory]);
  assert.equal(bodyStyleRerender.status, 0, bodyStyleRerender.stderr || bodyStyleRerender.stdout);
  const staleBodyReview = run(validateScript, [skillDirectory, "--require-complete"]);
  assert.equal(staleBodyReview.status, 1, "changing prose and regenerating HTML must invalidate the old body-style review");
  assert.match(staleBodyReview.stderr, /bodyStyleValidation\.(?:sourceHash|markdownBodySha256)|file hash is stale/i);
  fs.writeFileSync(bodyStylePath, bodyStyleText, "utf8");
  const restoredBodyHtml = run(renderScript, [skillDirectory]);
  assert.equal(restoredBodyHtml.status, 0, restoredBodyHtml.stderr || restoredBodyHtml.stdout);

  write("references/reply-style.md", "这个适配器调用 S-99；如果规则不存在，那么校验必须失败。\n");
  const danglingAdapterRule = run(validateScript, [skillDirectory]);
  assert.equal(danglingAdapterRule.status, 1, "task adapters with missing source-rule IDs must fail validation");
  assert.match(danglingAdapterRule.stderr, /reply-style\.md references missing source rule S-99/i);
  fs.rmSync(path.join(skillDirectory, "references", "reply-style.md"));

  const completeReportPath = path.join(skillDirectory, "references", "style-extraction-report.json");
  const completeReportText = fs.readFileSync(completeReportPath, "utf8");
  const reportClaimingCompleteWithoutParagraphEvidence = JSON.parse(completeReportText);
  reportClaimingCompleteWithoutParagraphEvidence.layerMaturity.paragraph.evidence = "只有自动结构统计，没有对照或语义标注。";
  reportClaimingCompleteWithoutParagraphEvidence.layerMaturity.paragraph.completedChecks = ["opening", "development", "ending"];
  fs.writeFileSync(
    completeReportPath,
    JSON.stringify(reportClaimingCompleteWithoutParagraphEvidence, null, 2),
    "utf8",
  );
  const falseComplete = run(validateScript, [skillDirectory, "--require-complete"]);
  assert.equal(falseComplete.status, 1, "a self-declared complete layer without control and manual review evidence must fail");
  assert.match(falseComplete.stderr, /complete layer paragraph lacks control|complete layer paragraph lacks manual review/i);
  fs.writeFileSync(
    completeReportPath,
    completeReportText,
    "utf8",
  );

  const lexicalPath = path.join(skillDirectory, "references", "lexical-profile.md");
  const validLexical = fs.readFileSync(lexicalPath, "utf8");
  fs.writeFileSync(lexicalPath, validLexical.replace("42 次", "43 次"), "utf8");
  const staleHtml = run(validateScript, [skillDirectory]);
  assert.equal(staleHtml.status, 1, "HTML must be regenerated after a source profile changes");
  assert.match(staleHtml.stderr, /style-guide\.html is out of date/i);
  fs.writeFileSync(lexicalPath, validLexical, "utf8");

  const htmlPath = path.join(skillDirectory, "references", "style-guide.html");
  const validHtml = fs.readFileSync(htmlPath, "utf8");
  fs.writeFileSync(htmlPath, validHtml.replace('data-style-guide="generated"', ""), "utf8");
  const missingHtmlMarker = run(validateScript, [skillDirectory]);
  assert.equal(missingHtmlMarker.status, 1, "HTML without its generated marker must fail validation");
  assert.match(missingHtmlMarker.stderr, /generated style-guide marker/i);
  fs.writeFileSync(htmlPath, validHtml, "utf8");

  const sentencePath = path.join(skillDirectory, "references", "sentence-profile.md");
  const validSentence = fs.readFileSync(sentencePath, "utf8");
  fs.writeFileSync(sentencePath, validSentence.replaceAll("验证结果", "复核记录"), "utf8");
  const missingValidationResult = run(validateScript, [skillDirectory]);
  assert.equal(
    missingValidationResult.status,
    1,
    "layer rules without a validation result field must fail validation",
  );
  assert.match(missingValidationResult.stderr, /validation result|dimension check matrix/i);
  fs.writeFileSync(sentencePath, validSentence, "utf8");

  const paragraphPath = path.join(skillDirectory, "references", "paragraph-profile.md");
  const validParagraph = fs.readFileSync(paragraphPath, "utf8");
  fs.writeFileSync(paragraphPath, validParagraph.replaceAll("段尾", "收束处"), "utf8");
  const missingParagraphContract = run(validateScript, [skillDirectory]);
  assert.equal(
    missingParagraphContract.status,
    1,
    "paragraph profiles without an ending contract must fail validation",
  );
  assert.match(missingParagraphContract.stderr, /paragraph ending/i);
  fs.writeFileSync(paragraphPath, validParagraph, "utf8");

  fs.writeFileSync(
    paragraphPath,
    validParagraph.replace("| 分支存在 | 对话格式影响 |", "|  | 对话格式影响 |"),
    "utf8",
  );
  const missingContextTrigger = run(validateScript, [skillDirectory]);
  assert.equal(
    missingContextTrigger.status,
    1,
    "contextual source rules without shift triggers must fail validation",
  );
  assert.match(missingContextTrigger.stderr, /contextual but lacks a shift trigger/i);
  fs.writeFileSync(paragraphPath, validParagraph, "utf8");

  const reportPath = path.join(skillDirectory, "references", "style-extraction-report.json");
  const validReport = fs.readFileSync(reportPath, "utf8");
  const reportWithoutForwardRuns = JSON.parse(validReport);
  reportWithoutForwardRuns.validation.forwardGeneration.evidence.runs = [];
  fs.writeFileSync(reportPath, JSON.stringify(reportWithoutForwardRuns, null, 2), "utf8");
  const missingForwardRuns = run(validateScript, [skillDirectory]);
  assert.equal(
    missingForwardRuns.status,
    1,
    "forward generation without independent short and long records must fail validation",
  );
  assert.match(missingForwardRuns.stderr, /independent short run|independent long run/i);
  fs.writeFileSync(reportPath, validReport, "utf8");

  const reportWithSkippedForwardTest = JSON.parse(validReport);
  reportWithSkippedForwardTest.validation.forwardGeneration = {
    status: "not_applicable",
    reason: "fixture attempted to skip the required gate",
  };
  fs.writeFileSync(reportPath, JSON.stringify(reportWithSkippedForwardTest, null, 2), "utf8");
  const skippedForwardTest = run(validateScript, [skillDirectory]);
  assert.equal(skippedForwardTest.status, 1, "forward generation cannot be marked not_applicable");
  assert.match(skippedForwardTest.stderr, /forwardGeneration must be passed/i);
  fs.writeFileSync(reportPath, validReport, "utf8");

  const reportWithMismatchedObservation = JSON.parse(validReport);
  reportWithMismatchedObservation.observations[0].validationResult = "not_promoted";
  fs.writeFileSync(reportPath, JSON.stringify(reportWithMismatchedObservation, null, 2), "utf8");
  const mismatchedObservation = run(validateScript, [skillDirectory]);
  assert.equal(
    mismatchedObservation.status,
    1,
    "executable observations without passed validation must fail validation",
  );
  assert.match(mismatchedObservation.stderr, /validationResult did not pass/i);
  fs.writeFileSync(reportPath, validReport, "utf8");

  const sourceLeak = run(validateScript, [skillDirectory, "--forbid-source", "测试推演"]);
  assert.equal(sourceLeak.status, 1, "forbidden source terms must fail validation");

  const stylePath = path.join(skillDirectory, "references", "style-profile.md");
  const validStyle = fs.readFileSync(stylePath, "utf8");
  fs.writeFileSync(stylePath, validStyle.replaceAll("R-01：", ""), "utf8");
  const fingerprintWithoutRuleId = run(validateScript, [skillDirectory]);
  assert.equal(
    fingerprintWithoutRuleId.status,
    1,
    "voice fingerprints without runtime rule IDs must fail validation",
  );
  assert.match(fingerprintWithoutRuleId.stderr, /must reference at least one runtime rule ID/i);
  fs.writeFileSync(stylePath, validStyle, "utf8");
  fs.writeFileSync(stylePath, validStyle.replace("L-01、S-01", "L-99、S-01"), "utf8");
  const missingSourceRule = run(validateScript, [skillDirectory]);
  assert.equal(missingSourceRule.status, 1, "runtime rules with missing source IDs must fail validation");
  assert.match(missingSourceRule.stderr, /missing source rule L-99/i);
  fs.writeFileSync(stylePath, validStyle, "utf8");
  fs.writeFileSync(
    stylePath,
    validStyle.replace("| R-01 | L-01、S-01 | 稳定 |", "| R-01 | L-01、S-01 | 暂定 |"),
    "utf8",
  );
  const tentativeRuntime = run(validateScript, [skillDirectory]);
  assert.equal(tentativeRuntime.status, 1, "tentative runtime rules must fail validation");
  assert.match(tentativeRuntime.stderr, /runtime rules/i);

  console.log("language style skill tools: all tests passed");
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
