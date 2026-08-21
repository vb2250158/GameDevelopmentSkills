#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { buildStyleGuide, HTML_GUIDE } from "./render-language-style-html.mjs";
import { buildBodyAudit } from "./audit-language-style-body.mjs";

const REQUIRED_PROFILES = [
  "lexical-profile.md",
  "sentence-profile.md",
  "paragraph-profile.md",
  "composition-profile.md",
  "style-profile.md",
];
const EVIDENCE_REPORT = "style-extraction-report.json";
const STYLE_DATA = "style-data.json";
const VALIDATION_KEYS = [
  "sampleFullStability",
  "holdoutReproduction",
  "controlDiscrimination",
  "oneVariableTests",
  "forwardGeneration",
  "contentPreservation",
  "provenanceLeakage",
];
const STYLE_LAYERS = ["lexical", "sentence", "paragraph", "composition"];
const LAYER_MATURITY_STATUSES = new Set(["complete", "partial", "insufficient"]);
const LAYER_PROFILE_FILES = {
  lexical: "lexical-profile.md",
  sentence: "sentence-profile.md",
  paragraph: "paragraph-profile.md",
  composition: "composition-profile.md",
};
const COMPLETE_LAYER_CONTRACTS = {
  lexical: [
    { label: "word categories", alternatives: ["词汇类别", "类型", "Word category"] },
    { label: "frequency and coverage", alternatives: ["频率", "覆盖", "Frequency", "Coverage"] },
    { label: "positions and collocations", alternatives: ["位置", "搭配", "Position", "Collocation"] },
    { label: "controls", alternatives: ["对照", "Control"] },
  ],
  sentence: [
    { label: "dimension matrix", alternatives: ["句式维度检查矩阵", "Sentence dimension matrix"] },
    { label: "sentence types and speech acts", alternatives: ["句类与言语行为", "Sentence types and speech acts"] },
    { label: "sentence length", alternatives: ["句长", "Sentence length"] },
    { label: "clauses or relation chains", alternatives: ["分句", "关系链", "Clause", "Relation chain"] },
    { label: "subject or responsibility", alternatives: ["主语", "责任主体", "Subject", "Responsibility"] },
    { label: "active passive or state", alternatives: ["主动、被动与状态", "主动被动与状态", "Active, passive, and state"] },
    { label: "word order and focus", alternatives: ["语序、焦点", "语序与焦点", "Word order", "Focus"] },
    { label: "questions", alternatives: ["问句", "疑问", "Question"] },
    { label: "negation or commands", alternatives: ["否定", "命令", "Negation", "Command"] },
    { label: "logical relations", alternatives: ["逻辑关系", "Logical relation"] },
    { label: "complexity and clause organization", alternatives: ["复杂度与从句组织", "Complexity and clause organization"] },
    { label: "repetition or parallelism", alternatives: ["重复、平行", "重复与平行", "Repetition", "Parallelism"] },
    { label: "punctuation and segmentation", alternatives: ["标点", "断句", "Punctuation", "Segmentation"] },
    { label: "calibration", alternatives: ["校准", "Calibration"] },
  ],
  paragraph: [
    { label: "dimension matrix", alternatives: ["段落维度检查矩阵", "Paragraph dimension matrix"] },
    { label: "central task", alternatives: ["中心任务", "Central task"] },
    { label: "paragraph opening", alternatives: ["段首", "Paragraph opening"] },
    { label: "paragraph development", alternatives: ["展开", "Development"] },
    { label: "paragraph ending", alternatives: ["段尾", "Paragraph ending"] },
    { label: "paragraph skeleton", alternatives: ["骨架", "Skeleton"] },
    { label: "paragraph splitting", alternatives: ["拆段", "Splitting"] },
    { label: "transitions", alternatives: ["过渡", "Transition"] },
    { label: "lists", alternatives: ["列表", "List"] },
    { label: "merge conditions or layout", alternatives: ["合并", "合段", "排版", "Merging", "Layout"] },
    { label: "calibration", alternatives: ["校准", "Calibration"] },
  ],
  composition: [
    { label: "dimension matrix", alternatives: ["整篇维度检查矩阵", "Composition dimension matrix"] },
    { label: "purpose and reader", alternatives: ["目的、读者", "目的与读者", "Purpose", "Reader"] },
    { label: "answer or judgment position", alternatives: ["答案", "判断", "Answer", "Judgment"] },
    { label: "background", alternatives: ["背景", "Background"] },
    { label: "evidence order", alternatives: ["证据", "Evidence"] },
    { label: "counterexamples or branches", alternatives: ["反例", "分支", "Counterexample", "Branch"] },
    { label: "action position", alternatives: ["行动", "Action"] },
    { label: "ordering basis and route", alternatives: ["排序依据", "推进路线", "Ordering basis", "Whole-text route"] },
    { label: "success or failure handling", alternatives: ["成功标志", "失败处理", "Success criteria", "Failure handling"] },
    { label: "ending", alternatives: ["结尾", "收束", "Ending"] },
    { label: "calibration", alternatives: ["校准", "Calibration"] },
  ],
};

function usage() {
  console.log(
    "Usage: node validate-language-style-skill.mjs <skill-directory> " +
      "[--forbid-source <term>]... [--require-complete] [--json]",
  );
}

function parseArgs(argv) {
  const positional = [];
  const forbiddenSources = [];
  let json = false;
  let requireComplete = false;

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--forbid-source") {
      const term = argv[index + 1];
      if (!term) throw new Error("--forbid-source requires a term");
      forbiddenSources.push(term);
      index += 1;
    } else if (value === "--json") {
      json = true;
    } else if (value === "--require-complete") {
      requireComplete = true;
    } else if (value === "--help" || value === "-h") {
      usage();
      process.exit(0);
    } else if (value.startsWith("--")) {
      throw new Error(`Unknown option: ${value}`);
    } else {
      positional.push(value);
    }
  }

  if (positional.length !== 1) throw new Error("Exactly one skill directory is required");
  return { skillDirectory: path.resolve(positional[0]), forbiddenSources, json, requireComplete };
}

function readText(filePath, errors, label) {
  if (!fs.existsSync(filePath)) {
    errors.push(`${label} is missing: ${filePath}`);
    return "";
  }
  return fs.readFileSync(filePath, "utf8");
}

function parseFrontmatter(text) {
  const match = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return null;
  const body = match[1];
  const name = body.match(/^name:\s*(.+?)\s*$/m)?.[1]?.replace(/^['"]|['"]$/g, "");
  const description = body
    .match(/^description:\s*(.+?)\s*$/m)?.[1]
    ?.replace(/^['"]|['"]$/g, "");
  return { name, description };
}

function containsAny(text, alternatives) {
  const lowered = text.toLocaleLowerCase();
  return alternatives.some((value) => lowered.includes(value.toLocaleLowerCase()));
}

function requireGroups(text, groups, label, errors) {
  for (const group of groups) {
    if (!containsAny(text, group.alternatives)) {
      errors.push(`${label} lacks ${group.label}`);
    }
  }
}

const DIMENSION_MATRIX_REQUIREMENTS = {
  "sentence-profile.md": {
    headerAlternatives: [["维度", "Dimension"], ["状态", "Status"], ["目标语料的实际取值", "Observed target-corpus value"], ["分析单位与样本范围", "Analysis unit and sample scope"], ["数量、比例或结构指标", "Count, proportion, or structural metric"], ["位置与组合", "Position and combination"], ["实际功能", "Observed function"], ["同类对照", "Comparable control"], ["场景变化", "Scenario shift"], ["混淆因素", "Confounds"], ["验证结果", "Validation result"], ["置信度", "Confidence"], ["能推出什么", "Supported conclusion"], ["不能推出什么", "Unsupported conclusion"]],
    dimensions: [["句类与言语行为", "Sentence types and speech acts"], ["主语、责任与视角", "Subjects, responsibility, and viewpoint"], ["主动、被动与状态表达", "Active, passive, and state expressions"], ["语序、焦点与信息落点", "Word order, focus, and information landing"], ["肯定、否定、限制与纠正", "Affirmation, negation, limitation, and correction"], ["逻辑关系与显化程度", "Logical relations and explicitness"], ["复杂度与从句组织", "Complexity and clause organization"], ["句长、节奏与断句", "Sentence length, rhythm, and segmentation"], ["重复、平行与递进", "Repetition, parallelism, and progression"], ["标点分布", "Punctuation distribution"]],
  },
  "paragraph-profile.md": {
    headerAlternatives: [["维度", "Dimension"], ["状态", "Status"], ["目标语料的实际取值", "Observed target-corpus value"], ["分析单位与样本范围", "Analysis unit and sample scope"], ["数量、比例或结构指标", "Count, proportion, or structural metric"], ["位置与组合", "Position and combination"], ["实际功能", "Observed function"], ["同类对照", "Comparable control"], ["场景变化", "Scenario shift"], ["混淆因素", "Confounds"], ["验证结果", "Validation result"], ["置信度", "Confidence"], ["能推出什么", "Supported conclusion"], ["不能推出什么", "Unsupported conclusion"]],
    dimensions: [["中心任务", "Central task"], ["段首功能", "Opening function"], ["中段展开功能", "Development function"], ["段尾功能", "Ending function"], ["段内动作序列", "Within-paragraph action sequence"], ["长度、拆分与合并", "Length, splitting, and merging"], ["承接、过渡与排版", "Cohesion, transitions, and layout"]],
  },
  "composition-profile.md": {
    headerAlternatives: [["维度", "Dimension"], ["状态", "Status"], ["目标语料的实际取值", "Observed target-corpus value"], ["分析单位与样本范围", "Analysis unit and sample scope"], ["数量、比例或结构指标", "Count, proportion, or structural metric"], ["位置与组合", "Position and combination"], ["实际功能", "Observed function"], ["同类对照", "Comparable control"], ["场景变化", "Scenario shift"], ["混淆因素", "Confounds"], ["验证结果", "Validation result"], ["置信度", "Confidence"], ["能推出什么", "Supported conclusion"], ["不能推出什么", "Unsupported conclusion"]],
    dimensions: [["目的、读者与首要问题", "Purpose, reader, and primary question"], ["开头信息与答案位置", "Opening information and answer position"], ["背景位置与展开深度", "Background position and depth"], ["证据、例子、反例与限制的位置", "Positions of evidence, examples, counterexamples, and limits"], ["信息排序依据", "Information ordering basis"], ["全文推进路线", "Whole-text route"], ["行动、成功标志与失败处理", "Actions, success criteria, and failure handling"], ["用途、媒介与场景变化", "Purpose, medium, and scenario shifts"], ["结尾功能", "Ending function"]],
  },
};

const PARAMETER_DICTIONARY_REQUIREMENTS = {
  "sentence-profile.md": {
    titleAlternatives: ["句式参数词典", "Sentence parameter dictionary"],
    headerAlternatives: [["参数 ID", "Parameter ID"], ["所属维度", "Dimension"], ["具体形式", "Form"], ["实际例项或抽象槽位", "Observed example or abstract slot"], ["使用倾向", "Usage tendency"], ["常见条件", "Common conditions"], ["减少使用或不适用的条件", "Reduced-use or inapplicable conditions"], ["次数、频率与覆盖", "Count, frequency, and coverage"], ["常见位置与组合", "Position and combination"], ["实际功能", "Observed function"], ["状态", "Status"], ["同类对照与混淆", "Control and confounds"], ["验证结果与置信度", "Validation and confidence"], ["不能推出什么", "Unsupported conclusion"]],
    idPattern: /^SP-\d+$/,
    minimumRows: 10,
  },
  "paragraph-profile.md": {
    titleAlternatives: ["段落参数词典", "Paragraph parameter dictionary"],
    headerAlternatives: [["参数 ID", "Parameter ID"], ["所属维度", "Dimension"], ["具体形式", "Form"], ["实际例项或抽象槽位", "Observed example or abstract slot"], ["使用倾向", "Usage tendency"], ["常见条件", "Common conditions"], ["减少使用或不适用的条件", "Reduced-use or inapplicable conditions"], ["次数、频率与覆盖", "Count, frequency, and coverage"], ["常见位置与组合", "Position and combination"], ["实际功能", "Observed function"], ["状态", "Status"], ["同类对照与混淆", "Control and confounds"], ["验证结果与置信度", "Validation and confidence"], ["不能推出什么", "Unsupported conclusion"]],
    idPattern: /^PP-\d+$/,
    minimumRows: 7,
  },
  "composition-profile.md": {
    titleAlternatives: ["整篇参数词典", "Composition parameter dictionary"],
    headerAlternatives: [["参数 ID", "Parameter ID"], ["所属维度", "Dimension"], ["具体形式", "Form"], ["实际例项或抽象槽位", "Observed example or abstract slot"], ["使用倾向", "Usage tendency"], ["常见条件", "Common conditions"], ["减少使用或不适用的条件", "Reduced-use or inapplicable conditions"], ["次数、频率与覆盖", "Count, frequency, and coverage"], ["常见位置与组合", "Position and combination"], ["实际功能", "Observed function"], ["状态", "Status"], ["同类对照与混淆", "Control and confounds"], ["验证结果与置信度", "Validation and confidence"], ["不能推出什么", "Unsupported conclusion"]],
    idPattern: /^CP-\d+$/,
    minimumRows: 8,
  },
};

function validateDimensionMatrix(fileName, text, errors, { requireComplete = false } = {}) {
  const requirement = DIMENSION_MATRIX_REQUIREMENTS[fileName];
  if (!requirement) return;
  const tables = parseMarkdownTables(text);
  const matrix = tables.find((table) => requirement.headerAlternatives.every((alternatives) => alternatives.some((header) => table.headers.includes(header))));
  if (!matrix) {
    errors.push(`${fileName} lacks a complete dimension check matrix`);
    return;
  }
  const rows = new Map(matrix.rows.map((row) => [getRowValue(row, ["维度", "Dimension"]), row]));
  for (const dimensionNames of requirement.dimensions) {
    const row = dimensionNames.map((name) => rows.get(name)).find(Boolean);
    const dimension = dimensionNames[0];
    if (!row) {
      errors.push(`${fileName} dimension matrix lacks ${dimension}`);
      continue;
    }
    if (!requireComplete) continue;
    const dimensionStatus = getRowValue(row, ["状态", "Status"]);
    const executableDimension = /^(?:稳定|stable)$/i.test(dimensionStatus.trim());
    for (const alternatives of requirement.headerAlternatives.slice(1)) {
      const value = getRowValue(row, alternatives);
      const isValidationField = alternatives.includes("验证结果") || alternatives.includes("Validation result");
      const unfinished = /待提取|to extract/i.test(String(value));
      const validationNotRun = isValidationField && /未运行|not run/i.test(String(value));
      if (!hasMeaningfulValue(value) || unfinished || (validationNotRun && executableDimension)) {
        errors.push(`${fileName} dimension ${dimension} has no completed ${alternatives[0]}`);
      }
    }
  }
}

function validateParameterDictionary(fileName, text, errors, { requireComplete = false } = {}) {
  const requirement = PARAMETER_DICTIONARY_REQUIREMENTS[fileName];
  if (!requirement) return;
  if (!containsAny(text, requirement.titleAlternatives)) {
    errors.push(`${fileName} lacks a parameter dictionary section`);
  }
  const tables = parseMarkdownTables(text);
  const dictionary = tables.find((table) => requirement.headerAlternatives.every((alternatives) => alternatives.some((header) => table.headers.includes(header))));
  if (!dictionary) {
    errors.push(`${fileName} lacks a complete parameter dictionary`);
    return;
  }
  const idAlternatives = requirement.headerAlternatives[0];
  const validRows = dictionary.rows.filter((row) => requirement.idPattern.test(getRowValue(row, idAlternatives)));
  if (validRows.length < requirement.minimumRows) {
    errors.push(`${fileName} parameter dictionary has ${validRows.length} rows; expected at least ${requirement.minimumRows}`);
  }
  if (!requireComplete) return;
  for (const row of validRows) {
    const parameterId = getRowValue(row, idAlternatives);
    const status = getRowValue(row, ["状态", "Status"]);
    const executable = /^(?:稳定|stable)$/i.test(status.trim());
    for (const alternatives of requirement.headerAlternatives.slice(1)) {
      const value = getRowValue(row, alternatives);
      const validationField = alternatives.includes("验证结果与置信度") || alternatives.includes("Validation and confidence");
      if (!hasMeaningfulValue(value) || /待提取|to extract/i.test(String(value)) || (executable && validationField && /未运行|not run/i.test(String(value)))) {
        errors.push(`${fileName} parameter ${parameterId} has no completed ${alternatives[0]}`);
      }
    }
  }
}

function extractLevelTwoSection(text, titles) {
  const lines = text.split(/\r?\n/);
  let start = -1;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (titles.some((title) => line === `## ${title}`)) {
      start = index + 1;
      break;
    }
  }
  if (start < 0) return "";
  let end = lines.length;
  for (let index = start; index < lines.length; index += 1) {
    if (/^##\s+/.test(lines[index])) {
      end = index;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}

function hasIndex(text) {
  return /^##\s+(索引|目录|Index|Contents)\s*$/m.test(text);
}

function lineCount(text) {
  return text.length === 0 ? 0 : text.split(/\r?\n/).length;
}

function splitTableRow(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return [];
  return trimmed
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
}

function parseMarkdownTables(text) {
  const lines = text.split(/\r?\n/);
  const tables = [];
  for (let index = 0; index < lines.length - 1; index += 1) {
    const headers = splitTableRow(lines[index]);
    const separator = splitTableRow(lines[index + 1]);
    if (
      headers.length === 0 ||
      headers.length !== separator.length ||
      !separator.every((cell) => /^:?-{3,}:?$/.test(cell))
    ) {
      continue;
    }
    const rows = [];
    let rowIndex = index + 2;
    while (rowIndex < lines.length) {
      const cells = splitTableRow(lines[rowIndex]);
      if (cells.length !== headers.length) break;
      rows.push(Object.fromEntries(headers.map((header, cellIndex) => [header, cells[cellIndex]])));
      rowIndex += 1;
    }
    tables.push({ headers, rows });
    index = rowIndex - 1;
  }
  return tables;
}

function getRowValue(row, alternatives) {
  for (const key of alternatives) {
    if (Object.hasOwn(row, key)) return row[key];
  }
  return "";
}

function normalizeRuleStatus(value) {
  const lowered = String(value ?? "").trim().toLocaleLowerCase();
  if (new Set(["稳定", "stable"]).has(lowered)) return "stable";
  if (new Set(["场景限定", "contextual"]).has(lowered)) return "contextual";
  if (new Set(["暂定", "tentative"]).has(lowered)) return "tentative";
  if (new Set(["否决", "rejected"]).has(lowered)) return "rejected";
  return "unknown";
}

function normalizeRuleCategory(value) {
  const lowered = String(value ?? "").trim().toLocaleLowerCase().replaceAll(" ", "_");
  const aliases = new Map([
    ["语料观察", "corpus_observation"],
    ["corpus_observation", "corpus_observation"],
    ["风格推断", "style_inference"],
    ["style_inference", "style_inference"],
    ["任务适配", "task_adapter"],
    ["task_adapter", "task_adapter"],
    ["通用约束", "universal_constraint"],
    ["universal_constraint", "universal_constraint"],
  ]);
  return aliases.get(lowered) ?? "unknown";
}

function hasMeaningfulValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return typeof value === "string" ? value.trim().length > 0 : value !== undefined && value !== null;
}

function hasMeaningfulTrigger(value) {
  return hasMeaningfulValue(value) && !/^(?:不适用|无|n\/?a|none|not applicable)$/i.test(String(value).trim());
}

function validationLooksPassed(value) {
  return /通过|passed/i.test(String(value ?? "")) && !/未通过|failed|not[_ ]run/i.test(String(value ?? ""));
}

function validateCompleteLayerContracts({ layerMaturity, parsedReport, profileTexts, sourceRuleMap, errors }) {
  if (!layerMaturity || !parsedReport) return;
  for (const layer of STYLE_LAYERS) {
    const entry = layerMaturity[layer];
    if (entry?.status !== "complete") continue;
    const fileName = LAYER_PROFILE_FILES[layer];
    const profileText = profileTexts.get(fileName) ?? "";
    requireGroups(profileText, COMPLETE_LAYER_CONTRACTS[layer], fileName, errors);
    if (!Number.isFinite(entry.corpusUnits) || entry.corpusUnits <= 0) {
      errors.push(`${EVIDENCE_REPORT} complete layer ${layer} must have a positive corpusUnits value`);
    }
    const completedChecks = Array.isArray(entry.completedChecks) ? entry.completedChecks.join(" ") : "";
    if (!/对照|control/i.test(`${completedChecks} ${entry.evidence ?? ""}`)) {
      errors.push(`${EVIDENCE_REPORT} complete layer ${layer} lacks control or comparison evidence`);
    }
    if (new Set(["paragraph", "composition"]).has(layer) && !/人工|manual|review/i.test(`${completedChecks} ${entry.evidence ?? ""}`)) {
      errors.push(`${EVIDENCE_REPORT} complete layer ${layer} lacks manual review evidence`);
    }
    const prefix = layer[0].toUpperCase();
    const executableRules = [...sourceRuleMap.entries()].filter(
      ([ruleId, rule]) => ruleId.startsWith(`${prefix}-`)
        && new Set(["stable", "contextual"]).has(rule.status)
        && new Set(["corpus_observation", "style_inference"]).has(rule.category),
    );
    if (executableRules.length === 0) {
      errors.push(`${fileName} is marked complete but has no executable ${prefix}- rules`);
    }
    const passedObservations = (parsedReport.observations ?? []).filter(
      (observation) => observation.ruleId?.startsWith(`${prefix}-`)
        && new Set(["stable", "contextual"]).has(normalizeRuleStatus(observation.status))
        && validationLooksPassed(observation.validationResult),
    );
    if (passedObservations.length === 0) {
      errors.push(`${EVIDENCE_REPORT} complete layer ${layer} has no passed executable observation`);
    }
  }
}

function validateBodyStyle({ root, parsedReport, errors }) {
  const validation = parsedReport?.bodyStyleValidation;
  if (!validation || validation.status !== "passed") {
    errors.push(`${EVIDENCE_REPORT} bodyStyleValidation must be passed`);
    return;
  }
  let audit;
  try {
    audit = buildBodyAudit(root);
  } catch (error) {
    errors.push(`body style audit cannot run: ${error.message}`);
    return;
  }
  for (const field of ["profileVersion", "language", "sourceHash", "markdownBodySha256", "htmlBodySha256"]) {
    if (validation[field] !== audit[field]) {
      errors.push(`${EVIDENCE_REPORT} bodyStyleValidation.${field} is stale or mismatched`);
    }
  }
  const requiredPaths = new Set(audit.files.map((file) => file.path));
  const recordedFiles = new Map((validation.files ?? []).map((file) => [file.path, file]));
  for (const file of audit.files) {
    const recorded = recordedFiles.get(file.path);
    if (!recorded) {
      errors.push(`${EVIDENCE_REPORT} bodyStyleValidation lacks file ${file.path}`);
      continue;
    }
    if (recorded.bodySha256 !== file.bodySha256) errors.push(`${EVIDENCE_REPORT} bodyStyleValidation file hash is stale: ${file.path}`);
    if (recorded.status !== "passed") errors.push(`${EVIDENCE_REPORT} bodyStyleValidation file did not pass: ${file.path}`);
    if (!file.languageMatch) errors.push(`${file.path} body language does not match ${audit.language}`);
  }
  for (const file of validation.files ?? []) {
    if (!requiredPaths.has(file.path)) errors.push(`${EVIDENCE_REPORT} bodyStyleValidation records an unknown file: ${file.path}`);
  }
  if ((audit.lexicalUse?.representativeTerms?.length ?? 0) > 0 && (audit.lexicalUse?.observedTermCount ?? 0) < 1) {
    errors.push("body prose does not visibly use enough representative target-style vocabulary");
  }
  const review = validation.review;
  if (!review || !new Set(["independent_agent", "independent_task"]).has(review.executor) || review.status !== "passed") {
    errors.push(`${EVIDENCE_REPORT} bodyStyleValidation requires a passed independent review`);
    return;
  }
  if (!hasMeaningfulValue(review.runId) || !hasMeaningfulValue(review.scope) || !hasMeaningfulValue(review.resultSummary)) {
    errors.push(`${EVIDENCE_REPORT} bodyStyleValidation independent review lacks runId, scope, or resultSummary`);
  }
  for (const layer of STYLE_LAYERS) {
    const entry = review.layerChecks?.[layer];
    if (!entry || entry.status !== "passed" || !hasMeaningfulValue(entry.evidence)) {
      errors.push(`${EVIDENCE_REPORT} bodyStyleValidation review lacks passed ${layer} body evidence`);
    }
  }
}

function validate() {
  const options = parseArgs(process.argv.slice(2));
  const errors = [];
  const warnings = [];
  const root = options.skillDirectory;
  const skillPath = path.join(root, "SKILL.md");
  const skillText = readText(skillPath, errors, "SKILL.md");
  const frontmatter = parseFrontmatter(skillText);

  if (!frontmatter) {
    errors.push("SKILL.md has no valid YAML frontmatter");
  } else {
    if (!frontmatter.name || !/^[a-z0-9-]{1,64}$/.test(frontmatter.name)) {
      errors.push("frontmatter name must use 1-64 lowercase ASCII letters, digits, or hyphens");
    }
    if (!frontmatter.description) errors.push("frontmatter description is required");
    if (frontmatter.name && path.basename(root) !== frontmatter.name) {
      errors.push(
        `skill directory name (${path.basename(root)}) does not match frontmatter name (${frontmatter.name})`,
      );
    }
  }

  if (lineCount(skillText) > 500) warnings.push("SKILL.md exceeds 500 lines");

  const referencesDirectory = path.join(root, "references");
  const profileTexts = new Map();
  for (const fileName of REQUIRED_PROFILES) {
    const filePath = path.join(referencesDirectory, fileName);
    const text = readText(filePath, errors, fileName);
    profileTexts.set(fileName, text);

    const expectedLink = `(references/${fileName})`;
    if (skillText && !skillText.includes(expectedLink)) {
      errors.push(`SKILL.md must link directly to references/${fileName}`);
    }

    if (lineCount(text) > 100 && !hasIndex(text)) {
      errors.push(`${fileName} exceeds 100 lines but has no top-level index`);
    }
  }

  const reportPath = path.join(referencesDirectory, EVIDENCE_REPORT);
  const reportText = readText(reportPath, errors, EVIDENCE_REPORT);
  let parsedReport = null;
  let layerMaturity = null;
  if (skillText && !skillText.includes(`(references/${EVIDENCE_REPORT})`)) {
    errors.push(`SKILL.md must link directly to references/${EVIDENCE_REPORT}`);
  }
  if (reportText) {
    try {
      const report = JSON.parse(reportText);
      parsedReport = report;
      if (!report.context?.language) errors.push(`${EVIDENCE_REPORT} lacks context.language`);
      if (!Array.isArray(report.observations) || report.observations.length === 0) {
        errors.push(`${EVIDENCE_REPORT} must contain at least one observation`);
      } else {
        const requiredObservationFields = [
          "ruleId",
          "ruleCategory",
          "status",
          "applicability",
          "primaryTendency",
          "secondaryTendency",
          "evidence",
          "shiftTrigger",
          "confounds",
          "validationResult",
          "confidence",
        ];
        for (const [index, observation] of report.observations.entries()) {
          for (const field of requiredObservationFields) {
            if (!hasMeaningfulValue(observation?.[field])) {
              errors.push(`${EVIDENCE_REPORT} observations[${index}] lacks ${field}`);
            }
          }
          if (observation?.ruleId && !/^[LSPC]-\d+$/.test(observation.ruleId)) {
            errors.push(`${EVIDENCE_REPORT} observations[${index}].ruleId is invalid`);
          }
          if (normalizeRuleCategory(observation?.ruleCategory) === "unknown") {
            errors.push(`${EVIDENCE_REPORT} observations[${index}].ruleCategory is invalid`);
          }
          if (normalizeRuleStatus(observation?.status) === "unknown") {
            errors.push(`${EVIDENCE_REPORT} observations[${index}].status is invalid`);
          }
          const observationStatus = normalizeRuleStatus(observation?.status);
          if (
            new Set(["stable", "contextual"]).has(observationStatus) &&
            !validationLooksPassed(observation?.validationResult)
          ) {
            errors.push(`${EVIDENCE_REPORT} observations[${index}] is executable but validationResult did not pass`);
          }
          if (
            new Set(["tentative", "rejected"]).has(observationStatus) &&
            validationLooksPassed(observation?.validationResult)
          ) {
            errors.push(`${EVIDENCE_REPORT} observations[${index}] is non-executable but validationResult says passed`);
          }
        }
      }
      layerMaturity = report.layerMaturity;
      if (!layerMaturity || typeof layerMaturity !== "object") {
        errors.push(`${EVIDENCE_REPORT} lacks layerMaturity`);
      } else {
        for (const layer of STYLE_LAYERS) {
          const entry = layerMaturity[layer];
          if (!entry || !LAYER_MATURITY_STATUSES.has(entry.status)) {
            errors.push(`${EVIDENCE_REPORT} layerMaturity.${layer}.status must be complete, partial, or insufficient`);
            continue;
          }
          for (const field of ["unitDefinition", "corpusUnits", "completedChecks", "missingChecks", "evidence"]) {
            if (entry[field] === undefined || entry[field] === null) {
              errors.push(`${EVIDENCE_REPORT} layerMaturity.${layer} lacks ${field}`);
            }
          }
          if (!Number.isFinite(entry.corpusUnits) || entry.corpusUnits < 0) {
            errors.push(`${EVIDENCE_REPORT} layerMaturity.${layer}.corpusUnits must be a non-negative number`);
          }
          if (!Array.isArray(entry.completedChecks) || entry.completedChecks.length === 0) {
            errors.push(`${EVIDENCE_REPORT} layerMaturity.${layer}.completedChecks must not be empty`);
          }
          if (!Array.isArray(entry.missingChecks)) {
            errors.push(`${EVIDENCE_REPORT} layerMaturity.${layer}.missingChecks must be an array`);
          }
          if (entry.status === "complete" && Array.isArray(entry.missingChecks) && entry.missingChecks.length > 0) {
            errors.push(`${EVIDENCE_REPORT} layerMaturity.${layer} is complete but still has missingChecks`);
          }
        }
        const actualOverall = STYLE_LAYERS.every((layer) => layerMaturity[layer]?.status === "complete")
          ? "complete"
          : STYLE_LAYERS.some((layer) => layerMaturity[layer]?.status === "insufficient")
            ? "insufficient"
            : "partial";
        if (layerMaturity.overall !== actualOverall) {
          errors.push(`${EVIDENCE_REPORT} layerMaturity.overall must be ${actualOverall}`);
        }
        if (options.requireComplete && actualOverall !== "complete") {
          errors.push(`${EVIDENCE_REPORT} is structurally valid but four-layer extraction maturity is ${actualOverall}`);
        }
      }
      for (const key of VALIDATION_KEYS) {
        const entry = report.validation?.[key];
        if (!entry || !new Set(["passed", "not_applicable"]).has(entry.status)) {
          errors.push(`${EVIDENCE_REPORT} validation.${key} must be passed or not_applicable`);
        } else if (entry.status === "not_applicable" && !entry.reason) {
          errors.push(`${EVIDENCE_REPORT} validation.${key} needs a reason when not_applicable`);
        } else if (entry.status === "passed" && !hasMeaningfulValue(entry.evidence)) {
          errors.push(`${EVIDENCE_REPORT} validation.${key} needs evidence when passed`);
        }
      }
      const forwardGeneration = report.validation?.forwardGeneration;
      if (forwardGeneration?.status !== "passed") {
        errors.push(`${EVIDENCE_REPORT} validation.forwardGeneration must be passed for a generated style skill`);
      } else {
        const runs = forwardGeneration.evidence?.runs;
        if (!Array.isArray(runs)) {
          errors.push(`${EVIDENCE_REPORT} validation.forwardGeneration needs evidence.runs`);
        } else {
          for (const kind of ["short", "long"]) {
            const run = runs.find((candidate) => candidate?.kind === kind);
            if (!run) {
              errors.push(`${EVIDENCE_REPORT} forwardGeneration lacks an independent ${kind} run`);
              continue;
            }
            for (const field of ["runId", "executor", "task", "resultSummary", "status"]) {
              if (!hasMeaningfulValue(run[field])) {
                errors.push(`${EVIDENCE_REPORT} forwardGeneration ${kind} run lacks ${field}`);
              }
            }
            if (!new Set(["independent_agent", "independent_task"]).has(run.executor)) {
              errors.push(`${EVIDENCE_REPORT} forwardGeneration ${kind} run is not independent`);
            }
            if (run.status !== "passed") {
              errors.push(`${EVIDENCE_REPORT} forwardGeneration ${kind} run did not pass`);
            }
            if (run.contentPreserved !== true) {
              errors.push(`${EVIDENCE_REPORT} forwardGeneration ${kind} run lacks content preservation proof`);
            }
            if (run.provenanceLeakage !== false) {
              errors.push(`${EVIDENCE_REPORT} forwardGeneration ${kind} run has no provenance leakage proof`);
            }
          }
        }
      }
    } catch (error) {
      errors.push(`${EVIDENCE_REPORT} is not valid JSON: ${error.message}`);
    }
  }

  const htmlGuidePath = path.join(referencesDirectory, HTML_GUIDE);
  const htmlGuideText = readText(htmlGuidePath, errors, HTML_GUIDE);
  if (skillText && !skillText.includes(`(references/${HTML_GUIDE})`)) {
    errors.push(`SKILL.md must link directly to references/${HTML_GUIDE}`);
  }
  if (htmlGuideText) {
    if (!/<html\b[^>]*data-style-guide=["']generated["']/i.test(htmlGuideText)) {
      errors.push(`${HTML_GUIDE} lacks the generated style-guide marker`);
    }
    if (!/<meta\b[^>]*name=["']language-style-source-hash["']/i.test(htmlGuideText)) {
      errors.push(`${HTML_GUIDE} lacks the source synchronization hash`);
    }
    if (/<(?:script|link|img)\b[^>]*(?:src|href)=["']https?:\/\//i.test(htmlGuideText)) {
      errors.push(`${HTML_GUIDE} must not depend on external scripts, styles, or images`);
    }
    for (const sourceName of [...REQUIRED_PROFILES, EVIDENCE_REPORT, STYLE_DATA]) {
      if (!htmlGuideText.includes(sourceName)) {
        errors.push(`${HTML_GUIDE} does not identify source file ${sourceName}`);
      }
    }
    try {
      const expectedGuide = buildStyleGuide(root).html;
      if (htmlGuideText !== expectedGuide) {
        errors.push(`${HTML_GUIDE} is out of date; regenerate it from the current profiles`);
      }
    } catch (error) {
      errors.push(`${HTML_GUIDE} cannot be regenerated: ${error.message}`);
    }
  }

  const styleDataPath = path.join(referencesDirectory, STYLE_DATA);
  const styleDataText = readText(styleDataPath, errors, STYLE_DATA);
  let parsedStyleData = null;
  if (styleDataText) {
    try {
      const styleData = JSON.parse(styleDataText);
      parsedStyleData = styleData;
      for (const [key, minimum] of [["vocabularyTypes", 8], ["sentencePatterns", 20], ["paragraphPatterns", 5], ["contentStructures", 5]]) {
        const items = styleData[key];
        if (!Array.isArray(items)) {
          errors.push(`${STYLE_DATA} lacks ${key}`);
          continue;
        }
        if (options.requireComplete && items.length < minimum) errors.push(`${STYLE_DATA} ${key} has ${items.length} items; expected at least ${minimum}`);
        for (const item of items) {
          for (const requiredKey of ["id", "name", "frequency", "position", "combinations", "variation", "status"]) {
            if (!(requiredKey in item)) errors.push(`${STYLE_DATA} ${key} item lacks ${requiredKey}`);
          }
          const frequency = item.frequency ?? {};
          const unmeasured = ["not_measured", "insufficient_evidence"].includes(item.status);
          if (typeof frequency.count === "number" && frequency.count <= 0) errors.push(`${STYLE_DATA} ${key} ${item.id ?? "unknown"} has zero hits; target style data must contain observed positive-hit parameters only`);
          if (options.requireComplete && unmeasured) {
            errors.push(`${STYLE_DATA} ${key} ${item.id ?? "unknown"} is still ${item.status}`);
          }
          if (typeof frequency.count !== "number" && !(unmeasured && frequency.count === null)) errors.push(`${STYLE_DATA} ${key} ${item.id ?? "unknown"} lacks numeric count or explicit unmeasured null`);
          if (options.requireComplete && (!item.position || Object.keys(item.position).length === 0)) errors.push(`${STYLE_DATA} ${key} ${item.id ?? "unknown"} lacks checked position data`);
          if (options.requireComplete && !Array.isArray(item.combinations)) errors.push(`${STYLE_DATA} ${key} ${item.id ?? "unknown"} lacks checked combination data`);
          if (options.requireComplete && (!Array.isArray(item.variation) || item.variation.length === 0)) errors.push(`${STYLE_DATA} ${key} ${item.id ?? "unknown"} lacks checked variation data`);
          if (key === "sentencePatterns") {
            if (!item.template || !item.relation || !item.recognition) errors.push(`${STYLE_DATA} sentence pattern ${item.id ?? "unknown"} lacks template, relation, or recognition`);
            if (typeof frequency.per100Sentences !== "number" && !(unmeasured && frequency.per100Sentences === null)) errors.push(`${STYLE_DATA} sentence pattern ${item.id ?? "unknown"} lacks per100Sentences or explicit unmeasured null`);
            if (typeof frequency.coverageRatio !== "number" && !(unmeasured && frequency.coverageRatio === null)) errors.push(`${STYLE_DATA} sentence pattern ${item.id ?? "unknown"} lacks coverageRatio or explicit unmeasured null`);
            if (!item.control || !("rateRatio" in item.control)) errors.push(`${STYLE_DATA} sentence pattern ${item.id ?? "unknown"} lacks matched-control rate ratio`);
            if (!item.validation?.status) errors.push(`${STYLE_DATA} sentence pattern ${item.id ?? "unknown"} lacks validation status`);
            if (options.requireComplete && ["automatic_candidate", "not_measured"].includes(item.validation?.status)) errors.push(`${STYLE_DATA} sentence pattern ${item.id ?? "unknown"} lacks completed semantic validation`);
          }
        }
      }
      if (!Array.isArray(styleData.styleProfiles) || styleData.styleProfiles.length < 1) {
        errors.push(`${STYLE_DATA} lacks a compiled styleProfiles entry`);
      }
      if (!Array.isArray(styleData.vocabularyMetrics) || styleData.vocabularyMetrics.length < 8) {
        errors.push(`${STYLE_DATA} lacks measured vocabularyMetrics`);
      }
      if (options.requireComplete) {
        const vocabularyGroups = new Set((styleData.vocabularyTypes ?? []).map((item) => item.group).filter(Boolean));
        if (vocabularyGroups.size < 1) errors.push(`${STYLE_DATA} contains no observed vocabulary group`);
        if (styleData.catalogAudit?.vocabularyCandidateTypes !== 130) errors.push(`${STYLE_DATA} catalogAudit.vocabularyCandidateTypes must equal 130`);
        if ((styleData.catalogAudit?.sentenceCandidateTypes ?? 0) < 70) errors.push(`${STYLE_DATA} catalogAudit.sentenceCandidateTypes must cover at least 70 sentence types`);
        if ((styleData.catalogAudit?.paragraphCandidateTypes ?? 0) < 20) errors.push(`${STYLE_DATA} catalogAudit.paragraphCandidateTypes must cover at least 20 paragraph structures`);
      }
    } catch (error) {
      errors.push(`${STYLE_DATA} is not valid JSON: ${error.message}`);
    }
  }

  if (parsedStyleData && layerMaturity) {
    const layerKeys = {
      lexical: "vocabularyTypes",
      sentence: "sentencePatterns",
      paragraph: "paragraphPatterns",
      composition: "contentStructures",
    };
    for (const [layer, key] of Object.entries(layerKeys)) {
      if (layerMaturity[layer]?.status !== "complete") continue;
      const unresolved = (parsedStyleData[key] ?? []).filter((item) =>
        ["not_measured", "insufficient_evidence"].includes(item.status)
        || ["not_measured", "automatic_candidate"].includes(item.validation?.status),
      );
      if (unresolved.length) {
        errors.push(`${EVIDENCE_REPORT} marks ${layer} complete, but ${STYLE_DATA} still has ${unresolved.length} unresolved ${key} records`);
      }
    }
  }

  const lexicalText = profileTexts.get("lexical-profile.md") ?? "";
  requireGroups(
    lexicalText,
    [
      { label: "target language", alternatives: ["目标语言", "Target language"] },
      { label: "corpus scope", alternatives: ["语料范围", "Corpus scope"] },
      { label: "a rule ID field", alternatives: ["规则 ID", "规则ID", "Rule ID"] },
      { label: "word categories", alternatives: ["词汇类别", "类型", "Word category"] },
      { label: "observed words", alternatives: ["实证词", "实际词", "Observed words"] },
      { label: "frequency and coverage", alternatives: ["频率", "覆盖", "Frequency", "Coverage"] },
      { label: "positions and collocations", alternatives: ["位置", "搭配", "Position", "Collocation"] },
      { label: "alternatives or controls", alternatives: ["同义", "替代", "对照", "Alternative", "Control"] },
      { label: "status", alternatives: ["状态", "Status"] },
      { label: "evidence", alternatives: ["证据", "Evidence"] },
      { label: "validation result", alternatives: ["验证结果", "Validation result", "Validation"] },
      { label: "confidence", alternatives: ["置信度", "Confidence"] },
    ],
    "lexical-profile.md",
    errors,
  );

  const layeredGroups = [
    { label: "a rule ID field", alternatives: ["规则 ID", "规则ID", "Rule ID"] },
    { label: "rule category", alternatives: ["规则类别", "Rule category"] },
    { label: "status", alternatives: ["状态", "Status"] },
    { label: "applicability or scope", alternatives: ["适用范围", "适用性", "Applicability", "Scope"] },
    { label: "primary tendency", alternatives: ["主要倾向", "主倾向", "Primary tendency"] },
    { label: "secondary tendency", alternatives: ["次要倾向", "Secondary tendency"] },
    { label: "evidence", alternatives: ["证据", "Evidence"] },
    { label: "shift trigger", alternatives: ["变化触发", "触发条件", "Shift trigger"] },
    { label: "confounds or exceptions", alternatives: ["混淆", "例外", "Confounds", "Exceptions"] },
    { label: "validation result", alternatives: ["验证结果", "Validation result", "Validation"] },
    { label: "confidence", alternatives: ["置信度", "Confidence"] },
  ];

  for (const fileName of [
    "sentence-profile.md",
    "paragraph-profile.md",
    "composition-profile.md",
  ]) {
    requireGroups(profileTexts.get(fileName) ?? "", layeredGroups, fileName, errors);
    validateDimensionMatrix(fileName, profileTexts.get(fileName) ?? "", errors, {
      requireComplete: options.requireComplete,
    });
    validateParameterDictionary(fileName, profileTexts.get(fileName) ?? "", errors, {
      requireComplete: options.requireComplete,
    });
  }

  requireGroups(
    profileTexts.get("paragraph-profile.md") ?? "",
    [
      { label: "paragraph opening", alternatives: ["段首", "Paragraph opening"] },
      { label: "paragraph development", alternatives: ["展开", "Development"] },
      { label: "paragraph ending", alternatives: ["段尾", "Paragraph ending"] },
      { label: "paragraph skeleton", alternatives: ["骨架", "Skeleton"] },
      { label: "paragraph splitting", alternatives: ["拆段", "Splitting"] },
      { label: "transitions", alternatives: ["过渡", "Transition"] },
      { label: "lists", alternatives: ["列表", "List"] },
    ],
    "paragraph-profile.md",
    errors,
  );
  requireGroups(
    profileTexts.get("composition-profile.md") ?? "",
    [
      { label: "answer position", alternatives: ["答案", "Answer"] },
      { label: "background", alternatives: ["背景", "Background"] },
      { label: "evidence order", alternatives: ["证据", "Evidence"] },
      { label: "counterexamples", alternatives: ["反例", "Counterexample"] },
      { label: "action position", alternatives: ["行动", "Action"] },
      { label: "ending", alternatives: ["结尾", "Ending"] },
    ],
    "composition-profile.md",
    errors,
  );

  const styleText = profileTexts.get("style-profile.md") ?? "";
  requireGroups(
    styleText,
    [
      { label: "scope", alternatives: ["适用范围", "Scope"] },
      { label: "layer validation status", alternatives: ["分层验证状态", "Layer validation status"] },
      { label: "runtime rules", alternatives: ["运行时规则", "Runtime rules"] },
      { label: "primary tendency", alternatives: ["主倾向", "Primary tendency"] },
      { label: "secondary tendency", alternatives: ["次倾向", "Secondary tendency"] },
      { label: "shift triggers", alternatives: ["变化触发", "场景触发", "Shift triggers"] },
      { label: "voice fingerprints", alternatives: ["声音指纹", "Voice fingerprints"] },
      { label: "forbidden patterns", alternatives: ["禁止项", "否决项", "Forbidden"] },
      { label: "non-transferable content", alternatives: ["不可迁移", "Non-transferable"] },
      { label: "positive and negative calibration", alternatives: ["正反校准", "Calibration"] },
      { label: "validation result", alternatives: ["验证结果", "Validation result", "Validation"] },
      { label: "lexical layer", alternatives: ["词汇", "Lexical"] },
      { label: "sentence layer", alternatives: ["句式", "Sentence"] },
      { label: "paragraph layer", alternatives: ["段落", "Paragraph"] },
      { label: "composition layer", alternatives: ["整篇", "Composition"] },
    ],
    "style-profile.md",
    errors,
  );

  for (const fileName of [
    "lexical-profile.md",
    "sentence-profile.md",
    "paragraph-profile.md",
    "composition-profile.md",
  ]) {
    if (styleText && !styleText.includes(`(${fileName})`)) {
      errors.push(`style-profile.md must link to ${fileName}`);
    }
  }

  const runtimeRules = extractLevelTwoSection(styleText, ["运行时规则", "Runtime rules"]);
  if (!runtimeRules) {
    errors.push("style-profile.md has no readable runtime rules section");
  } else if (/暂定|否决|证据不足|tentative|rejected|insufficient[_ ]evidence/i.test(runtimeRules)) {
    errors.push("runtime rules contain tentative, rejected, or insufficient-evidence rules");
  }

  const sourceRuleMap = new Map();
  for (const fileName of [
    "lexical-profile.md",
    "sentence-profile.md",
    "paragraph-profile.md",
    "composition-profile.md",
  ]) {
    for (const table of parseMarkdownTables(profileTexts.get(fileName) ?? "")) {
      for (const row of table.rows) {
        const ruleId = getRowValue(row, ["规则 ID", "规则ID", "Rule ID"]);
        if (!/^[LSPC]-\d+$/.test(ruleId)) continue;
        if (sourceRuleMap.has(ruleId)) errors.push(`duplicate source rule ID: ${ruleId}`);
        const status = normalizeRuleStatus(getRowValue(row, ["状态", "Status"]));
        const category = normalizeRuleCategory(getRowValue(row, ["规则类别", "Rule category"]));
        const validationResult = getRowValue(row, ["验证结果", "Validation result", "Validation"]);
        const shiftTrigger = getRowValue(row, ["变化触发条件", "变化触发", "Shift trigger"]);
        sourceRuleMap.set(ruleId, { fileName, status, category, validationResult, shiftTrigger });
        if (new Set(["stable", "contextual"]).has(status) && !validationLooksPassed(validationResult)) {
          errors.push(`${fileName} ${ruleId} is executable but has no passed validation result`);
        }
        if (status === "contextual" && !hasMeaningfulTrigger(shiftTrigger)) {
          errors.push(`${fileName} ${ruleId} is contextual but lacks a shift trigger`);
        }
      }
    }
  }

  for (const adapterName of ["reply-style.md", "document-style.md"]) {
    const adapterPath = path.join(referencesDirectory, adapterName);
    if (!fs.existsSync(adapterPath)) continue;
    const adapterText = fs.readFileSync(adapterPath, "utf8");
    for (const sourceId of new Set(adapterText.match(/\b[LSPC]-\d+\b/g) ?? [])) {
      if (!sourceRuleMap.has(sourceId)) {
        errors.push(`${adapterName} references missing source rule ${sourceId}`);
      }
    }
    const numericRanges = [...adapterText.matchAll(/\b([LSPC])-(\d+)\s*(?:至|到|through|to|[-–—])\s*\1-(\d+)\b/gi)];
    for (const match of numericRanges) {
      const [, prefix, startText, endText] = match;
      const start = Number(startText);
      const end = Number(endText);
      for (let value = Math.min(start, end); value <= Math.max(start, end); value += 1) {
        const sourceId = `${prefix.toUpperCase()}-${String(value).padStart(startText.length, "0")}`;
        if (!sourceRuleMap.has(sourceId)) {
          errors.push(`${adapterName} references missing source rule ${sourceId} through a range`);
        }
      }
    }
  }

  if (parsedReport?.observations) {
    for (const observation of parsedReport.observations) {
      const sourceRule = sourceRuleMap.get(observation.ruleId);
      if (!sourceRule) {
        errors.push(`${EVIDENCE_REPORT} references missing profile rule ${observation.ruleId}`);
        continue;
      }
      if (sourceRule.status !== normalizeRuleStatus(observation.status)) {
        errors.push(`${EVIDENCE_REPORT} status disagrees with profile rule ${observation.ruleId}`);
      }
      if (sourceRule.category !== normalizeRuleCategory(observation.ruleCategory)) {
        errors.push(`${EVIDENCE_REPORT} category disagrees with profile rule ${observation.ruleId}`);
      }
      if (
        validationLooksPassed(sourceRule.validationResult) !==
        validationLooksPassed(observation.validationResult)
      ) {
        errors.push(`${EVIDENCE_REPORT} validationResult disagrees with profile rule ${observation.ruleId}`);
      }
    }
  }

  if (options.requireComplete) {
    validateCompleteLayerContracts({ layerMaturity, parsedReport, profileTexts, sourceRuleMap, errors });
    validateBodyStyle({ root, parsedReport, errors });
  }

  const runtimeTables = parseMarkdownTables(runtimeRules);
  const runtimeTable = runtimeTables.find((table) =>
    table.headers.some((header) => new Set(["来源规则", "Source rule"]).has(header)),
  );
  if (!runtimeTable) {
    errors.push("style-profile.md runtime rules have no readable source-rule table");
  } else {
    if (!runtimeTable.headers.some((header) => new Set(["变化触发条件", "变化触发", "Shift trigger"]).has(header))) {
      errors.push("style-profile.md runtime rule table lacks a shift-trigger field");
    }
    for (const row of runtimeTable.rows) {
      const runtimeId = getRowValue(row, ["规则 ID", "规则ID", "Rule ID"]);
      const sourceRules = getRowValue(row, ["来源规则", "Source rule"]);
      const status = normalizeRuleStatus(getRowValue(row, ["状态", "Status"]));
      const shiftTrigger = getRowValue(row, ["变化触发条件", "变化触发", "Shift trigger"]);
      const validationResult = getRowValue(row, ["验证结果", "Validation result", "Validation"]);
      if (!/^R-\d+$/.test(runtimeId)) errors.push(`invalid runtime rule ID: ${runtimeId || "missing"}`);
      if (!new Set(["stable", "contextual"]).has(status)) {
        errors.push(`${runtimeId || "runtime rule"} has a non-executable status`);
      }
      if (!validationLooksPassed(validationResult)) {
        errors.push(`${runtimeId || "runtime rule"} has no passed validation result`);
      }
      if (status === "contextual" && !hasMeaningfulTrigger(shiftTrigger)) {
        errors.push(`${runtimeId || "runtime rule"} is contextual but lacks a shift trigger`);
      }
      const referencedIds = sourceRules.match(/\b[LSPC]-\d+\b/g) ?? [];
      if (referencedIds.length === 0) errors.push(`${runtimeId || "runtime rule"} has no source rule IDs`);
      for (const sourceId of referencedIds) {
        const sourceRule = sourceRuleMap.get(sourceId);
        if (!sourceRule) {
          errors.push(`${runtimeId || "runtime rule"} references missing source rule ${sourceId}`);
          continue;
        }
        if (!new Set(["stable", "contextual"]).has(sourceRule.status)) {
          errors.push(`${runtimeId || "runtime rule"} references non-executable source rule ${sourceId}`);
        }
        if (new Set(["task_adapter", "universal_constraint"]).has(sourceRule.category)) {
          errors.push(`${runtimeId || "runtime rule"} references non-style source rule ${sourceId}`);
        }
      }
    }
  }

  const voiceFingerprints = extractLevelTwoSection(styleText, [
    "声音指纹",
    "主倾向、次倾向与声音指纹",
    "Voice fingerprints",
    "Primary tendency, secondary tendency, and voice fingerprints",
  ]);
  if (/暂定|否决|证据不足|tentative|rejected|insufficient[_ ]evidence/i.test(voiceFingerprints)) {
    errors.push("voice fingerprints contain tentative, rejected, or insufficient-evidence rules");
  }
  const runtimeRuleIds = new Set(
    runtimeTable?.rows
      .map((row) => getRowValue(row, ["规则 ID", "规则ID", "Rule ID"]))
      .filter((value) => /^R-\d+$/.test(value)) ?? [],
  );
  const fingerprintRuntimeIds = voiceFingerprints.match(/\bR-\d+\b/g) ?? [];
  if (fingerprintRuntimeIds.length === 0) {
    errors.push("voice fingerprints must reference at least one runtime rule ID");
  }
  for (const runtimeId of fingerprintRuntimeIds) {
    if (!runtimeRuleIds.has(runtimeId)) {
      errors.push(`voice fingerprints reference missing runtime rule ${runtimeId}`);
    }
  }
  const fingerprintItems = voiceFingerprints
    .split(/\r?\n/)
    .filter((line) => /^\s*(?:[-*]|\d+\.)\s+/.test(line));
  if (fingerprintItems.length < 3 || fingerprintItems.length > 5) {
    errors.push("voice fingerprints must contain three to five list items");
  }
  for (const item of fingerprintItems) {
    if (!/\bR-\d+\b/.test(item)) {
      errors.push("each voice fingerprint must reference a runtime rule ID");
    }
  }
  for (const sourceId of voiceFingerprints.match(/\b[LSPC]-\d+\b/g) ?? []) {
    const sourceRule = sourceRuleMap.get(sourceId);
    if (!sourceRule || !new Set(["stable", "contextual"]).has(sourceRule.status)) {
      errors.push(`voice fingerprints reference non-executable source rule ${sourceId}`);
    }
  }

  const openAiPath = path.join(root, "agents", "openai.yaml");
  const openAiText = readText(openAiPath, errors, "agents/openai.yaml");
  if (openAiText) {
    for (const field of ["display_name:", "short_description:", "default_prompt:"]) {
      if (!openAiText.includes(field)) errors.push(`agents/openai.yaml lacks ${field}`);
    }
    if (frontmatter?.name && !openAiText.includes(`$${frontmatter.name}`)) {
      errors.push(`agents/openai.yaml default_prompt must reference $${frontmatter.name}`);
    }
  }

  const publicFiles = [
    skillPath,
    openAiPath,
    reportPath,
    htmlGuidePath,
    ...REQUIRED_PROFILES.map((name) => path.join(referencesDirectory, name)),
  ];
  const privatePathPattern = /(?:[A-Za-z]:\\Users\\[^\s\\]+|\/Users\/[^\s/]+|\/home\/[^\s/]+)/;
  for (const filePath of publicFiles) {
    if (!fs.existsSync(filePath)) continue;
    const text = fs.readFileSync(filePath, "utf8");
    if (privatePathPattern.test(text)) errors.push(`${path.relative(root, filePath)} contains a private user path`);
    if (/\bTODO\b|待填写|待提取/.test(text)) {
      errors.push(`${path.relative(root, filePath)} still contains scaffold placeholders`);
    }
    for (const sourceTerm of options.forbiddenSources) {
      if (sourceTerm && text.toLocaleLowerCase().includes(sourceTerm.toLocaleLowerCase())) {
        errors.push(`${path.relative(root, filePath)} contains forbidden source term: ${sourceTerm}`);
      }
    }
  }

  const result = {
    skillDirectory: root,
    valid: errors.length === 0,
    maturity: layerMaturity?.overall ?? "unknown",
    layerMaturity,
    errors,
    warnings,
  };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    if (errors.length === 0) {
      console.log(`Language style skill is structurally valid; four-layer maturity: ${layerMaturity?.overall ?? "unknown"}.`);
    }
    for (const error of errors) console.error(`ERROR: ${error}`);
    for (const warning of warnings) console.warn(`WARNING: ${warning}`);
  }

  process.exit(errors.length === 0 ? 0 : 1);
}

try {
  validate();
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  usage();
  process.exit(2);
}
