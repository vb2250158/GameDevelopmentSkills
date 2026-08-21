#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { LANGUAGE_STYLE_READER_BEHAVIOR, LANGUAGE_STYLE_READER_CSS } from "./language-style-reader-css.mjs";

const REQUIRED_MARKDOWN = [
  "lexical-profile.md",
  "sentence-profile.md",
  "paragraph-profile.md",
  "composition-profile.md",
  "style-profile.md",
];
const REQUIRED_REPORT = "style-extraction-report.json";
const OPTIONAL_REFERENCES = [
  "reply-style.md",
  "document-style.md",
  "lexical-metrics.json",
  "style-data.json",
];
export const HTML_GUIDE = "style-guide.html";
export const VOCABULARY_DICTIONARY_JSON = "vocabulary-dictionary.json";
export const SENTENCE_DICTIONARY_JSON = "sentence-dictionary.json";
export const PARAGRAPH_DICTIONARY_JSON = "paragraph-dictionary.json";
export const COMPOSITION_DICTIONARY_JSON = "composition-dictionary.json";
const SENTENCE_STYLE_CATALOG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "references", "sentence-style-catalog.json");
const FOUR_LAYER_TYPE_CATALOG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "references", "four-layer-type-catalog.json");
const DEFAULT_STANDARD_URL = "../../clear-science-writing/references/language-style-standard.html";

function usage() {
  console.log(
    "Usage: node render-language-style-html.mjs <skill-directory> " +
      "[--output <html-path>] [--check] [--open]",
  );
}

function parseArgs(argv) {
  const positional = [];
  let output = null;
  let check = false;
  let open = false;
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--output") {
      output = argv[index + 1];
      if (!output) throw new Error("--output requires a path");
      index += 1;
    } else if (value === "--check") {
      check = true;
    } else if (value === "--open") {
      open = true;
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
  const skillDirectory = path.resolve(positional[0]);
  return {
    skillDirectory,
    outputPath: output
      ? path.resolve(output)
      : path.join(skillDirectory, "references", HTML_GUIDE),
    check,
    open,
  };
}

function openInBrowser(filePath) {
  const command =
    process.platform === "win32" ? "explorer.exe" : process.platform === "darwin" ? "open" : "xdg-open";
  const child = spawn(command, [filePath], { detached: true, stdio: "ignore" });
  child.unref();
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function slugify(value, fallback = "section") {
  const slug = String(value)
    .trim()
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

function stripFrontmatter(markdown) {
  return markdown.replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*(?:\r?\n|$)/, "");
}

export function firstHeading(markdown) {
  return stripFrontmatter(markdown).match(/^#\s+(.+?)\s*$/m)?.[1]?.trim() ?? "Language Style";
}

function inlineMarkdown(value, anchorMap) {
  const tokens = [];
  const tokenized = String(value).replace(/`([^`]+)`/g, (_match, code) => {
    const token = `\u0000CODE${tokens.length}\u0000`;
    tokens.push(`<code>${escapeHtml(code)}</code>`);
    return token;
  });
  let output = escapeHtml(tokenized);
  output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, target) => {
    const cleanTarget = target.trim();
    const localName = path.basename(cleanTarget.split("#")[0]);
    const anchor = anchorMap.get(localName);
    const href = anchor ? (/^(?:\.\.\/|\.\/|https?:\/\/)/u.test(anchor) ? anchor : `#${anchor}`) : cleanTarget;
    return `<a href="${escapeHtml(href)}">${label}</a>`;
  });
  output = output.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  output = output.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  output = output.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
  output = output.replace(/\u0000CODE(\d+)\u0000/g, (_match, index) => tokens[Number(index)]);
  return output;
}

function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableDivider(line) {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

export function renderMarkdown(markdown, documentId, anchorMap) {
  const lines = stripFrontmatter(markdown).replaceAll("\r\n", "\n").split("\n");
  const html = [];
  let paragraph = [];
  let listType = null;
  let inCode = false;
  let codeLanguage = "";
  let codeLines = [];
  const headingCounts = new Map();

  function flushParagraph() {
    if (paragraph.length === 0) return;
    html.push(`<p>${inlineMarkdown(paragraph.join(" "), anchorMap)}</p>`);
    paragraph = [];
  }

  function closeList() {
    if (!listType) return;
    html.push(`</${listType}>`);
    listType = null;
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fence = line.match(/^```\s*([^\s`]*)/);
    if (fence) {
      flushParagraph();
      closeList();
      if (!inCode) {
        inCode = true;
        codeLanguage = fence[1] ?? "";
        codeLines = [];
      } else {
        html.push(
          `<pre><code${codeLanguage ? ` class="language-${escapeHtml(codeLanguage)}"` : ""}>${escapeHtml(codeLines.join("\n"))}</code></pre>`,
        );
        inCode = false;
      }
      continue;
    }
    if (inCode) {
      codeLines.push(line);
      continue;
    }

    if (/^\s*$/.test(line)) {
      flushParagraph();
      closeList();
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1].length;
      const label = heading[2];
      const base = `${documentId}-${slugify(label)}`;
      const count = headingCounts.get(base) ?? 0;
      headingCounts.set(base, count + 1);
      const id = count === 0 ? base : `${base}-${count + 1}`;
      html.push(`<h${level} id="${id}">${inlineMarkdown(label, anchorMap)}</h${level}>`);
      continue;
    }

    if (
      line.includes("|") &&
      index + 1 < lines.length &&
      isTableDivider(lines[index + 1])
    ) {
      flushParagraph();
      closeList();
      const headers = splitTableRow(line);
      index += 2;
      const rows = [];
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
        rows.push(splitTableRow(lines[index]));
        index += 1;
      }
      index -= 1;
      html.push('<div class="table-wrap"><table><thead><tr>');
      for (const header of headers) html.push(`<th>${inlineMarkdown(header, anchorMap)}</th>`);
      html.push("</tr></thead><tbody>");
      for (const row of rows) {
        html.push("<tr>");
        for (let cell = 0; cell < headers.length; cell += 1) {
          html.push(`<td>${inlineMarkdown(row[cell] ?? "", anchorMap)}</td>`);
        }
        html.push("</tr>");
      }
      html.push("</tbody></table></div>");
      continue;
    }

    const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      flushParagraph();
      const desired = unordered ? "ul" : "ol";
      if (listType !== desired) {
        closeList();
        listType = desired;
        html.push(`<${listType}>`);
      }
      html.push(`<li>${inlineMarkdown((unordered ?? ordered)[1], anchorMap)}</li>`);
      continue;
    }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flushParagraph();
      closeList();
      html.push(`<blockquote>${inlineMarkdown(quote[1], anchorMap)}</blockquote>`);
      continue;
    }

    if (/^\s*(?:---+|\*\*\*+)\s*$/.test(line)) {
      flushParagraph();
      closeList();
      html.push("<hr>");
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph();
  closeList();
  if (inCode) {
    html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  }
  return html.join("\n");
}

function loadSources(skillDirectory) {
  const referencesDirectory = path.join(skillDirectory, "references");
  const descriptors = [
    { fileName: "SKILL.md", filePath: path.join(skillDirectory, "SKILL.md"), required: true },
    ...REQUIRED_MARKDOWN.map((fileName) => ({
      fileName,
      filePath: path.join(referencesDirectory, fileName),
      required: true,
    })),
    {
      fileName: REQUIRED_REPORT,
      filePath: path.join(referencesDirectory, REQUIRED_REPORT),
      required: true,
    },
    ...OPTIONAL_REFERENCES.map((fileName) => ({
      fileName,
      filePath: path.join(referencesDirectory, fileName),
      required: false,
    })),
  ];
  const missing = descriptors.filter((item) => item.required && !fs.existsSync(item.filePath));
  if (missing.length > 0) {
    throw new Error(`Missing required source files: ${missing.map((item) => item.fileName).join(", ")}`);
  }
  return descriptors
    .filter((item) => fs.existsSync(item.filePath))
    .map((item) => ({ ...item, content: fs.readFileSync(item.filePath, "utf8") }));
}

function sourceHash(sources) {
  const hash = crypto.createHash("sha256");
  for (const source of sources) {
    hash.update(source.fileName);
    hash.update("\u0000");
    let content = source.content;
    if (source.fileName === REQUIRED_REPORT) {
      try {
        const report = JSON.parse(content);
        delete report.bodyStyleValidation;
        content = JSON.stringify(report);
      } catch {
        // Invalid JSON is rendered as-is and will be reported elsewhere.
      }
    }
    hash.update(content);
    hash.update("\u0000");
  }
  return hash.digest("hex");
}

function renderReport(reportText, labels, anchorMap) {
  let report;
  try {
    report = JSON.parse(reportText);
    // bodyStyleValidation contains hashes of the generated HTML itself. Rendering
    // those hashes back into the HTML creates a self-referential regeneration
    // cycle: stamping changes JSON, JSON changes HTML, and HTML invalidates the
    // stamp. Keep this machine audit in the JSON source, but exclude it from the
    // human reading edition.
    delete report.bodyStyleValidation;
  } catch (error) {
    return `<div class="notice error">${escapeHtml(labels.invalidJson)}：${escapeHtml(error.message)}</div><pre><code>${escapeHtml(reportText)}</code></pre>`;
  }
  const context = report.context ?? {};
  const observations = Array.isArray(report.observations) ? report.observations : [];
  const validation = report.validation ?? {};
  const maturity = report.layerMaturity ?? {};
  const validationRows = Object.entries(validation);
  const passed = validationRows.filter(([, value]) => value?.status === "passed").length;
  const contextItems = Object.entries(context)
    .map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(typeof value === "object" ? JSON.stringify(value) : value)}</dd></div>`)
    .join("");
  const validationTable = validationRows
    .map(([key, value]) => {
      const evidence = value?.evidence;
      const summary = typeof evidence === "object" ? JSON.stringify(evidence) : evidence ?? value?.reason ?? "";
      return `<tr><td><code>${escapeHtml(key)}</code></td><td><span class="status ${escapeHtml(value?.status ?? "unknown")}">${escapeHtml(value?.status ?? "unknown")}</span></td><td>${inlineMarkdown(String(summary), anchorMap)}</td></tr>`;
    })
    .join("");
  const maturityRows = ["lexical", "sentence", "paragraph", "composition"]
    .map((layer) => {
      const value = maturity[layer] ?? {};
      const completed = Array.isArray(value.completedChecks) ? value.completedChecks.join("、") : "";
      const missing = Array.isArray(value.missingChecks) ? value.missingChecks.join("、") : "";
      return `<tr><td><code>${escapeHtml(layer)}</code></td><td><span class="status ${escapeHtml(value.status ?? "unknown")}">${escapeHtml(value.status ?? "unknown")}</span></td><td>${escapeHtml(value.unitDefinition ?? "")}</td><td>${escapeHtml(value.corpusUnits ?? "")}</td><td>${escapeHtml(completed)}</td><td>${escapeHtml(missing)}</td><td>${escapeHtml(value.evidence ?? "")}</td></tr>`;
    })
    .join("");
  const observationRows = observations
    .map((item) => `<tr><td><code>${escapeHtml(item.ruleId ?? "")}</code></td><td>${escapeHtml(item.status ?? "")}</td><td>${escapeHtml(item.primaryTendency ?? "")}</td><td>${escapeHtml(item.validationResult ?? "")}</td><td>${escapeHtml(item.confidence ?? "")}</td></tr>`)
    .join("");
  return `
<div class="metrics">
  <div class="metric"><strong>${observations.length}</strong><span>${escapeHtml(labels.observations)}</span></div>
  <div class="metric"><strong>${passed}/${validationRows.length}</strong><span>${escapeHtml(labels.validationsPassed)}</span></div>
</div>
<h2>${escapeHtml(labels.context)}</h2>
<dl class="context-grid">${contextItems}</dl>
<h2>${escapeHtml(labels.layerMaturity)}</h2>
<p><strong>${escapeHtml(labels.overallMaturity)}：</strong><span class="status ${escapeHtml(maturity.overall ?? "unknown")}">${escapeHtml(maturity.overall ?? "unknown")}</span></p>
<div class="table-wrap"><table><thead><tr><th>${escapeHtml(labels.layer)}</th><th>${escapeHtml(labels.status)}</th><th>${escapeHtml(labels.unitDefinition)}</th><th>${escapeHtml(labels.corpusUnits)}</th><th>${escapeHtml(labels.completedChecks)}</th><th>${escapeHtml(labels.missingChecks)}</th><th>${escapeHtml(labels.evidence)}</th></tr></thead><tbody>${maturityRows}</tbody></table></div>
<h2>${escapeHtml(labels.validation)}</h2>
<div class="table-wrap"><table><thead><tr><th>${escapeHtml(labels.item)}</th><th>${escapeHtml(labels.status)}</th><th>${escapeHtml(labels.evidence)}</th></tr></thead><tbody>${validationTable}</tbody></table></div>
<h2>${escapeHtml(labels.observations)}</h2>
<div class="table-wrap"><table><thead><tr><th>Rule ID</th><th>${escapeHtml(labels.status)}</th><th>${escapeHtml(labels.primaryTendency)}</th><th>${escapeHtml(labels.validation)}</th><th>${escapeHtml(labels.confidence)}</th></tr></thead><tbody>${observationRows}</tbody></table></div>
<details class="raw-json"><summary>${escapeHtml(labels.rawJson)}</summary><pre><code>${escapeHtml(JSON.stringify(report, null, 2))}</code></pre></details>`;
}

function renderJsonDocument(text, labels) {
  try {
    return `<pre><code>${escapeHtml(JSON.stringify(JSON.parse(text), null, 2))}</code></pre>`;
  } catch (error) {
    return `<div class="notice error">${escapeHtml(labels.invalidJson)}：${escapeHtml(error.message)}</div><pre><code>${escapeHtml(text)}</code></pre>`;
  }
}

function renderLexicalMetrics(text, labels) {
  let metrics;
  try {
    metrics = JSON.parse(text);
  } catch (error) {
    return `<div class="notice error">${escapeHtml(labels.invalidJson)}：${escapeHtml(error.message)}</div>`;
  }
  const categories = Array.isArray(metrics.categories) ? metrics.categories : [];
  const collocations = Array.isArray(metrics.stableCollocations) ? metrics.stableCollocations : [];
  const categoryRows = categories
    .map((category) => {
      const terms = Array.isArray(category.terms) ? category.terms : [];
      const observed = terms.filter((term) => Number(term.target?.count ?? 0) > 0);
      const topTerms = [...observed]
        .sort((left, right) => Number(right.target?.count ?? 0) - Number(left.target?.count ?? 0))
        .slice(0, 8)
        .map((term) => `${term.term}（${term.target.count}）`)
        .join("、");
      return `<tr><td>${escapeHtml(category.category ?? "")}</td><td>${Number(category.totals?.target ?? 0)}</td><td>${Number(category.totals?.control ?? 0)}</td><td>${observed.length}/${terms.length}</td><td>${escapeHtml(topTerms)}</td></tr>`;
    })
    .join("");
  const collocationRows = collocations
    .map((item) => `<tr><td>${escapeHtml(item.term ?? "")}</td><td>${escapeHtml((item.patterns ?? []).slice(0, 8).map((pattern) => `${pattern.phrase}（${pattern.count}）`).join("、"))}</td></tr>`)
    .join("");
  const interpretation = metrics.interpretation ?? {};
  const interpretationItems = Object.entries(interpretation)
    .map(([key, value]) => `<li><strong>${escapeHtml(key)}</strong>：${escapeHtml(Array.isArray(value) ? value.join("、") : value)}</li>`)
    .join("");
  const corpusCards = Object.entries(metrics.corpora ?? {})
    .map(([name, corpus]) => `<div class="metric"><strong>${Number(corpus.documents ?? 0)}</strong><span>${escapeHtml(name)} · documents</span></div>`)
    .join("");
  return `
<div class="metrics">${corpusCards}<div class="metric"><strong>${categories.length}</strong><span>${escapeHtml(labels.lexicalCategories)}</span></div><div class="metric"><strong>${collocations.length}</strong><span>${escapeHtml(labels.collocations)}</span></div></div>
<h2>${escapeHtml(labels.interpretation)}</h2>
<ul>${interpretationItems}</ul>
<h2>${escapeHtml(labels.lexicalCategories)}</h2>
<div class="table-wrap"><table><thead><tr><th>${escapeHtml(labels.category)}</th><th>target</th><th>control</th><th>${escapeHtml(labels.observedTerms)}</th><th>${escapeHtml(labels.frequentTerms)}</th></tr></thead><tbody>${categoryRows}</tbody></table></div>
<h2>${escapeHtml(labels.collocations)}</h2>
<div class="table-wrap"><table><thead><tr><th>${escapeHtml(labels.term)}</th><th>${escapeHtml(labels.patterns)}</th></tr></thead><tbody>${collocationRows}</tbody></table></div>
<p class="source-link"><a href="lexical-metrics.json">${escapeHtml(labels.openRawMetrics)}</a></p>`;
}

const VOCABULARY_GROUP_GUIDANCE_ZH = {
  "指称、身份与关系": { definition: "记录说话者、听话者、第三方、群体边界和称呼方式。", effect: "改变责任归属、双方距离、身份感和对象是否明确。", usage: "用于分析谁在说、对谁说、谁承担判断或行动。", caution: "代词和群体词可能隐藏真实责任；称呼还会受到场景与关系影响。", signals: ["身份", "关系", "责任", "距离"] },
  "判断、立场与情态": { definition: "记录肯定、否定、可能、确定、必要、能力和立场来源。", effect: "改变判断的确定程度、可修正空间和行动约束。", usage: "用于区分事实、推测、许可、能力、义务和个人立场。", caution: "同一个词可能承担多种功能，必须结合上下文判断。", signals: ["判断", "确定性", "立场", "情态"] },
  "行动与言语行为": { definition: "记录决定、建议、请求、命令、禁止、回应和修正等说话动作。", effect: "改变文字要求读者做什么，以及要求的直接程度和责任对象。", usage: "用于分析一句话是在说明、请求、建议、命令、拒绝还是回应。", caution: "请求词和礼貌词不会自动降低要求强度；命令词也要区分真实权限。", signals: ["行动", "要求", "请求", "回应"] },
  "程度、范围、数量与时空": { definition: "记录强弱、范围、数量、频率、时间、空间和比较尺度。", effect: "改变结论的强度、适用边界、精确程度和推进顺序。", usage: "用于限制判断覆盖多少对象、持续多久、发生几次或强到什么程度。", caution: "范围词和程度词会直接改变事实；不能为了文风随意增减。", signals: ["程度", "范围", "数量", "时间"] },
  "评价、情绪与声音": { definition: "记录评价方向、情绪类别、强调、感叹、拟声和重复形式。", effect: "改变文本的态度、情绪温度、声音强度和即时感。", usage: "用于区分客观测量、主观评价和直接情绪表达。", caution: "评价词必须有明确对象；低情绪词频也不能直接推出说话者冷漠。", signals: ["评价", "情绪", "声音", "强度"] },
  "疑问、句尾与对话标记": { definition: "记录未知信息类型、确认方式、反问形式、句尾语气和简短回应。", effect: "改变互动方式、信息缺口、口语程度和句末态度。", usage: "用于分析在问什么、是否要求确认，以及一句话怎样结束。", caution: "疑问词出现不等于真正提问；句尾词的作用依赖完整句子。", signals: ["疑问", "互动", "句尾", "口语"] },
  "逻辑与篇章组织词": { definition: "记录并列、递进、转折、因果、条件、举例、总结和话题承接。", effect: "改变句子和段落之间显式呈现的逻辑关系与阅读路线。", usage: "用于观察作者怎样连接判断、证据、例子、限制和下一项内容。", caution: "连接词只能标记关系，不能证明关系真实成立。", signals: ["逻辑", "组织", "连接", "推进"] },
  "词义层级、语域与圈层": { definition: "记录词义具体程度、动作或状态类别、口语书面差异和专业圈层。", effect: "改变文本的具体程度、正式程度、身份线索和知识门槛。", usage: "用于分析同一内容选择日常词、书面词、专业词或圈层词的倾向。", caution: "专业术语和题材名词容易受内容影响，不能直接当作稳定个人文风。", signals: ["语域", "具体程度", "圈层", "术语"] },
};

const VOCABULARY_GROUP_GUIDANCE_EN = {
  "Reference, identity, and relation": { definition: "Tracks speakers, readers, third parties, group boundaries, and forms of address.", effect: "Changes responsibility, social distance, identity cues, and referential clarity.", usage: "Use it to identify who speaks, who is addressed, and who owns a judgment or action.", caution: "Pronouns can hide responsibility, while forms of address also vary by relationship and situation.", signals: ["identity", "relation", "responsibility", "distance"] },
  "Judgment, stance, and modality": { definition: "Tracks affirmation, negation, possibility, certainty, necessity, ability, and stance sources.", effect: "Changes certainty, revisability, and the force of an action constraint.", usage: "Use it to distinguish facts, guesses, permission, ability, obligation, and personal stance.", caution: "One word can serve several functions, so classification still depends on context.", signals: ["judgment", "certainty", "stance", "modality"] },
  "Action and speech acts": { definition: "Tracks decisions, suggestions, requests, commands, prohibitions, replies, and corrections.", effect: "Changes what the reader is expected to do and who owns that action.", usage: "Use it to distinguish explanation, request, suggestion, command, refusal, and reply.", caution: "Politeness does not automatically reduce force, and commands must still be checked against actual authority.", signals: ["action", "request", "command", "reply"] },
  "Degree, scope, quantity, and time-space": { definition: "Tracks intensity, scope, quantity, frequency, time, space, and comparison scales.", effect: "Changes strength, applicability, precision, and sequence.", usage: "Use it to limit how many objects a claim covers, how long it holds, or how strong it is.", caution: "Degree and scope words change facts and cannot be added merely for stylistic effect.", signals: ["degree", "scope", "quantity", "time"] },
  "Evaluation, emotion, and voice": { definition: "Tracks evaluative direction, emotion, emphasis, exclamation, sound imitation, and repetition.", effect: "Changes attitude, emotional temperature, vocal force, and immediacy.", usage: "Use it to separate measurement, evaluation, and direct emotion.", caution: "Evaluations need explicit objects; low emotion-word frequency does not prove indifference.", signals: ["evaluation", "emotion", "voice", "intensity"] },
  "Questions, endings, and dialogue markers": { definition: "Tracks missing-information types, confirmation, rhetorical questions, sentence-final particles, and short replies.", effect: "Changes interaction, information gaps, colloquiality, and sentence-final attitude.", usage: "Use it to identify what is being asked and how a sentence closes.", caution: "A question word does not always mark a real question; final particles depend on the whole sentence.", signals: ["question", "interaction", "ending", "dialogue"] },
  "Logic and discourse organization": { definition: "Tracks coordination, progression, contrast, cause, condition, examples, summaries, and topic continuation.", effect: "Changes how logical relations and reading routes are made explicit.", usage: "Use it to observe how judgments, evidence, examples, limits, and next points are connected.", caution: "A connector labels a relation; it does not prove that relation is valid.", signals: ["logic", "organization", "connection", "progression"] },
  "Meaning level, register, and community": { definition: "Tracks semantic specificity, action or state classes, spoken-written differences, and specialist language.", effect: "Changes specificity, formality, identity cues, and knowledge burden.", usage: "Use it to compare everyday, formal, professional, and community-specific choices.", caution: "Technical terms and topic nouns are content-sensitive and may not be stable style features.", signals: ["register", "specificity", "community", "terminology"] },
};

function vocabularyExample(group, word) {
  if (!word) return "当前候选词形没有提供可用例词。";
  if (group === "指称、身份与关系") return `把“${word}”换成另一种称呼或人称，会改变责任主体和双方距离。`;
  if (group === "判断、立场与情态") return `把“${word}”换成确定程度不同的词，会改变判断可以被修正的范围。`;
  if (group === "行动与言语行为") return `把“${word}”换成建议、请求或命令形式，会改变读者需要承担的动作。`;
  if (group === "程度、范围、数量与时空") return `删去或替换“${word}”，会改变结论的强度、范围、数量或时间边界。`;
  if (group === "评价、情绪与声音") return `把“${word}”换成中性测量词，会降低直接评价或情绪强度。`;
  if (group === "疑问、句尾与对话标记") return `“${word}”所在的位置会改变信息缺口、确认方式或句末语气。`;
  if (group === "逻辑与篇章组织词") return `“${word}”只有在相应逻辑关系真实成立时才能保留。`;
  return `“${word}”会改变词义的具体程度、语域或圈层线索。`;
}

function buildVocabularyDictionaryPayload(data, isChinese, catalog = null) {
  const sourceTypes = Array.isArray(data.vocabularyTypes) ? data.vocabularyTypes.filter((item) => item.frequency?.count == null || item.frequency.count > 0) : [];
  const guidanceCatalog = isChinese ? VOCABULARY_GROUP_GUIDANCE_ZH : VOCABULARY_GROUP_GUIDANCE_EN;
  const catalogGroups = Array.isArray(catalog?.vocabularyGroups) ? catalog.vocabularyGroups : [];
  const catalogTypes = Array.isArray(catalog?.vocabularyTypes) ? catalog.vocabularyTypes : [];
  const groupNames = catalogGroups.length ? catalogGroups.map((item) => item.name) : [...new Set(sourceTypes.map((item) => item.group).filter(Boolean))];
  let groups = groupNames.map((name, index) => {
    const guidance = guidanceCatalog[name] ?? {};
    const catalogGroup = catalogGroups.find((item) => item.name === name);
    return { id: catalogGroup?.id ?? `vocabulary-group-${String(index + 1).padStart(2, "0")}`, name, definition: catalogGroup?.description ?? guidance.definition ?? (isChinese ? `${name}的候选检查范围。` : `Candidate inspection scope for ${name}.`), effect: guidance.effect ?? (isChinese ? "记录这一组词怎样改变表达选择。" : "Records how this group changes expression choices."), usage: guidance.usage ?? (isChinese ? "用于逐项检查目标语料。" : "Use it to inspect the target corpus category by category."), caution: guidance.caution ?? (isChinese ? "候选词表不是穷尽语义词典。" : "The candidate list is not an exhaustive semantic dictionary."), signals: guidance.signals ?? [] };
  });
  const groupIdByName = new Map(groups.map((group) => [group.name, group.id]));
  const targetByName = new Map(sourceTypes.map((item) => [item.name, item]));
  const mappedTargetNames = new Set();
  const sourceForTypes = catalogTypes.length ? catalogTypes.filter((item) => targetByName.has(item.name)) : sourceTypes;
  const types = sourceForTypes.map((catalogItem) => {
    const item = catalogTypes.length ? targetByName.get(catalogItem.name) : catalogItem;
    if (item) mappedTargetNames.add(item.name);
    const groupName = catalogTypes.length ? catalogGroups.find((group) => group.id === catalogItem.group)?.name ?? catalogItem.group : item.group;
    const guidance = guidanceCatalog[groupName] ?? {};
    const targetWordMap = new Map((item?.items ?? []).map((entry) => [typeof entry === "string" ? entry : entry.word, entry]));
    const catalogWords = (item?.items ?? []).map((entry) => typeof entry === "string" ? entry : entry.word);
    const words = catalogWords.map((word) => { const entry = targetWordMap.get(word); return { word, count: typeof entry === "object" ? entry.count : null, per10kCharacters: typeof entry === "object" ? entry.per10kCharacters : null, coverageRatio: typeof entry === "object" ? entry.coverageRatio : null, position: typeof entry === "object" ? entry.position : null, controlRateRatio: typeof entry === "object" ? entry.controlRateRatio : null }; }).filter((entry) => entry.word && (entry.count == null || entry.count > 0));
    const topWord = [...words].sort((a, b) => Number(b.count ?? 0) - Number(a.count ?? 0))[0]?.word;
    return { id: catalogItem.id, group: groupIdByName.get(groupName) ?? catalogItem.group, groupName, name: catalogItem.name, definition: catalogItem.definition ?? (isChinese ? `${catalogItem.name}属于“${groupName}”。` : `${catalogItem.name} belongs to “${groupName}”.`), effect: catalogItem.function ?? guidance.effect ?? (isChinese ? "改变可观察的表达方式。" : "Changes an observable expression choice."), usage: guidance.usage ?? (isChinese ? "用于逐项检查目标语料。" : "Use it to inspect the target corpus category by category."), caution: item?.limitation ?? catalogItem.notes ?? guidance.caution ?? (isChinese ? "候选词形不等于完整语义类型。" : "Candidate forms do not exhaust the semantic category."), example: catalogItem.example ?? (isChinese ? vocabularyExample(groupName, topWord) : ""), signals: [...new Set([...(guidance.signals ?? []), catalogItem.name, ...(item?.combinations ?? []).slice(0, 3).map((entry) => entry.name).filter(Boolean)])], core: item?.core ?? groupName !== "词义层级、语域与词形", status: item?.status ?? "not_mapped", validation: item?.validation ?? null, words, frequency: item?.frequency ?? null, position: item?.position ?? null, combinations: item?.combinations ?? [], variation: item?.variation ?? [], control: item?.control ?? null, targetMapping: item ? { targetId: item.id, status: "mapped", method: "exact_name" } : { status: "not_mapped" } };
  });
  const extensionGroup = { id: "target-style-extensions", name: isChinese ? "目标文风扩展" : "Target-style extensions", definition: isChinese ? "目标语料已有统计、但尚未与通用词汇类型唯一对应的类别。" : "Target categories without a unique shared-type mapping.", effect: "", usage: "", caution: isChinese ? "不能强行拆分或错配。" : "Do not force a mapping.", signals: [] };
  const extensions = sourceTypes.filter((item) => !mappedTargetNames.has(item.name)).map((item) => { const guidance = guidanceCatalog[item.group] ?? {}; const words = (item.items ?? []).map((entry) => ({ word: typeof entry === "string" ? entry : entry.word, count: typeof entry === "string" ? null : entry.count, per10kCharacters: typeof entry === "string" ? null : entry.per10kCharacters, coverageRatio: typeof entry === "string" ? null : entry.coverageRatio, position: typeof entry === "string" ? null : entry.position, controlRateRatio: typeof entry === "string" ? null : entry.controlRateRatio })).filter((entry) => entry.word && (entry.count == null || entry.count > 0)); return { id: `target-extension-${item.id}`, group: extensionGroup.id, groupName: extensionGroup.name, name: item.name, definition: isChinese ? "目标语料已有统计，但通用类型库尚无同名唯一对应。" : "The target corpus has measurements, but no unique shared type matches by name.", effect: guidance.effect ?? "", usage: guidance.usage ?? "", caution: item.limitation ?? extensionGroup.caution, example: isChinese ? vocabularyExample(item.group, words[0]?.word) : "", signals: [item.name], core: false, status: item.status, validation: item.validation ?? null, words, frequency: item.frequency ?? null, position: item.position ?? null, combinations: item.combinations ?? [], variation: item.variation ?? [], control: item.control ?? null, targetMapping: { targetId: item.id, status: "unmapped" }, origin: "target_extension" }; });
  types.push(...extensions);
  if (extensions.length) groups.push(extensionGroup);
  groups = groups.filter((group) => types.some((type) => type.group === group.id));
  const wordMap = new Map();
  for (const type of types) for (const entry of type.words) {
    if (!wordMap.has(entry.word)) wordMap.set(entry.word, { word: entry.word, types: [], totalCount: 0, hitRate: null });
    const record = wordMap.get(entry.word);
    record.types.push({ id: type.id, name: type.name, group: type.groupName, effect: type.effect, caution: type.caution, count: entry.count, coverageRatio: entry.coverageRatio });
    record.totalCount += Number(entry.count ?? 0);
    if (typeof entry.coverageRatio === "number") record.hitRate = Math.max(Number(record.hitRate ?? 0), entry.coverageRatio);
  }
  const words = [...wordMap.values()].map((record) => ({ ...record, overlap: record.types.length > 1, description: isChinese ? `“${record.word}”在当前字典中属于${record.types.map((item) => `“${item.name}”`).join("、")}；目标语料候选扫描合计命中 ${record.totalCount} 次。具体功能仍需结合上下文判断。` : `“${record.word}” belongs to ${record.types.map((item) => `“${item.name}”`).join(", ")}; the candidate scan found ${record.totalCount} occurrences in total. Its function still depends on context.` })).sort((a, b) => Number(b.hitRate ?? -1) - Number(a.hitRate ?? -1) || b.totalCount - a.totalCount || a.word.localeCompare(b.word, isChinese ? "zh-CN" : "en"));
  return { schemaVersion: 1, language: isChinese ? "zh" : "en", groups, types, words, keyWordNotes: words.slice(0, 50).map((word) => ({ word: word.word, description: word.description })), sourceStatistics: { candidateTypes: catalogTypes.length || types.length, displayedTypes: types.length, mappedTargetTypes: mappedTargetNames.size, targetTypes: sourceTypes.length, targetExtensions: extensions.length, rawEntries: types.reduce((count, type) => count + type.words.length, 0), uniqueWords: words.length, overlapWords: words.filter((word) => word.overlap).length, keyWordNotes: Math.min(50, words.length), targetUnits: data.corpus?.targetUnits ?? null } };
}

function jsonForHtmlScript(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c").replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029");
}

function hitRateRanking(items, isChinese, options = {}) {
  const ranked = items
    .filter((item) => Number(item?.frequency?.count ?? 0) > 0)
    .sort((left, right) => Number(right.frequency?.coverageRatio ?? -1) - Number(left.frequency?.coverageRatio ?? -1) || Number(right.frequency?.count ?? 0) - Number(left.frequency?.count ?? 0))
    .slice(0, options.limit ?? 12);
  if (!ranked.length) return "";
  const title = options.title ?? (isChinese ? "高频参数" : "Frequent parameters");
  const note = options.note ?? (isChinese ? "按命中分析单位的覆盖率从高到低排列；覆盖率相同时再比较次数。" : "Sorted by unit coverage, then by count.");
  const rows = ranked.map((item, index) => {
    const coverage = typeof item.frequency?.coverageRatio === "number" ? `${(item.frequency.coverageRatio * 100).toFixed(1)}%` : "—";
    const count = Number(item.frequency?.count ?? 0);
    const form = item.template ?? (Array.isArray(item.sequence) ? item.sequence.join(" → ") : Array.isArray(item.modules) ? item.modules.join(" → ") : "");
    return `<li><span class="ranking-index">${index + 1}</span><span class="ranking-name">${escapeHtml(item.name ?? item.id)}</span><span class="ranking-value">${escapeHtml(coverage)}</span><span class="ranking-detail">${escapeHtml(isChinese ? `命中 ${count} 次${form ? ` · ${form}` : ""}` : `${count} hits${form ? ` · ${form}` : ""}`)}</span></li>`;
  }).join("");
  return `<section class="frequency-ranking"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(note)}</p><ol class="ranking-list">${rows}</ol></section>`;
}

function renderVocabularyDictionary(data, isChinese, catalog = null) {
  const payload = buildVocabularyDictionaryPayload(data, isChinese, catalog);
  const labels = isChinese ? { title: "实际词汇统计", note: "直接列出目标语料中实际命中的词条，默认按覆盖率、再按命中次数排列。类型只用于切换归组查看。", search: "搜索具体词、词汇类型或文风作用", allGroups: "全部大类", allLevels: "核心与扩展", core: "只看核心类型", extended: "只看扩展类型", typeView: "按类型归组", wordView: "具体词条", overlap: "只看多重归类词", expand: "展开全部", collapse: "全部收起", copyResult: "复制结果", edit: "编辑词汇 JSON", apply: "应用数据", reset: "恢复内置数据", copyJson: "复制 JSON", importJson: "导入 JSON", exportJson: "导出 JSON", downloadHtml: "下载当前 HTML", empty: "当前没有可显示的词条。", filter: "筛选", view: "查看方式", sort: "排序", hitSort: "命中率从高到低", countSort: "次数从高到低", nameSort: "名称", more: "附加条件与操作" } : { title: "Observed vocabulary", note: "Shows words observed in the target corpus, sorted by coverage and then count. Types are only an alternate grouped view.", search: "Search terms, types, or effects", allGroups: "All groups", allLevels: "Core and extended", core: "Core only", extended: "Extended only", typeView: "Grouped by type", wordView: "Observed words", overlap: "Overlaps only", expand: "Expand all", collapse: "Collapse all", copyResult: "Copy", edit: "Edit vocabulary JSON", apply: "Apply data", reset: "Restore built-in data", copyJson: "Copy JSON", importJson: "Import JSON", exportJson: "Export JSON", downloadHtml: "Download current HTML", empty: "No observed word.", filter: "Filters", view: "View", sort: "Sort", hitSort: "Hit rate descending", countSort: "Count descending", nameSort: "Name", more: "Options and actions" };
  return `<div class="data-overview vocabulary-dictionary" data-vocabulary-dictionary><h2>${escapeHtml(labels.title)}</h2><p class="notice">${escapeHtml(labels.note)}</p><div class="metrics vocabulary-metrics" data-vocabulary-metrics></div><div class="dictionary-controls"><div class="dictionary-filter-row"><span class="control-caption">${escapeHtml(labels.filter)}</span><input type="search" data-vocabulary-search aria-label="${escapeHtml(labels.search)}" placeholder="${escapeHtml(labels.search)}" autocomplete="off"><select data-vocabulary-group aria-label="${escapeHtml(labels.allGroups)}"><option value="">${escapeHtml(labels.allGroups)}</option></select><select data-vocabulary-level aria-label="${escapeHtml(labels.allLevels)}"><option value="">${escapeHtml(labels.allLevels)}</option><option value="core">${escapeHtml(labels.core)}</option><option value="extended">${escapeHtml(labels.extended)}</option></select></div><div class="dictionary-option-row"><fieldset class="dictionary-view-switch"><legend>${escapeHtml(labels.view)}</legend><div class="segmented-control"><button type="button" data-vocabulary-view="types" aria-pressed="true">${escapeHtml(labels.typeView)}</button><button type="button" data-vocabulary-view="words" aria-pressed="false">${escapeHtml(labels.wordView)}</button></div></fieldset><label class="dictionary-sort">${escapeHtml(labels.sort)}<select data-vocabulary-sort><option value="hit">${escapeHtml(labels.hitSort)}</option><option value="count">${escapeHtml(labels.countSort)}</option><option value="name">${escapeHtml(labels.nameSort)}</option></select></label><div class="dictionary-extra"><span class="control-caption">${escapeHtml(labels.more)}</span><label class="filter-toggle"><input type="checkbox" data-vocabulary-overlap> ${escapeHtml(labels.overlap)}</label><div class="dictionary-actions"><button type="button" data-vocabulary-expand>${escapeHtml(labels.expand)}</button><button type="button" data-vocabulary-collapse>${escapeHtml(labels.collapse)}</button><button type="button" data-vocabulary-copy-result>${escapeHtml(labels.copyResult)}</button></div></div></div></div><div class="dictionary-results" data-vocabulary-results></div><div class="empty vocabulary-empty" data-vocabulary-empty>${escapeHtml(labels.empty)}</div><details class="raw-json dictionary-data-region"><summary>${escapeHtml(labels.edit)}</summary><textarea data-vocabulary-json spellcheck="false"></textarea><div class="dictionary-data-actions"><button type="button" data-vocabulary-apply>${escapeHtml(labels.apply)}</button><button type="button" data-vocabulary-reset>${escapeHtml(labels.reset)}</button><button type="button" data-vocabulary-copy-json>${escapeHtml(labels.copyJson)}</button><button type="button" data-vocabulary-import>${escapeHtml(labels.importJson)}</button><button type="button" data-vocabulary-export>${escapeHtml(labels.exportJson)}</button><button type="button" data-vocabulary-download-html>${escapeHtml(labels.downloadHtml)}</button><input type="file" accept="application/json,.json" data-vocabulary-file hidden></div><p class="notice error" data-vocabulary-error hidden></p></details><script id="vocabularyDictionaryData" type="application/json">${jsonForHtmlScript(payload)}</script></div>`;
}

function normalizedSentenceKey(value) {
  return String(value ?? "")
    .toLocaleLowerCase()
    .replace(/[“”‘’'"`·，。！？、；：,.!?;:\s＋+／/—–-]+/gu, "")
    .replace(/[abcxyz甲乙丙]/gu, "#");
}

function sentencePatternScore(catalogPattern, targetPattern) {
  if (catalogPattern.id === targetPattern.id) return 100;
  let score = 0;
  if (catalogPattern.name === targetPattern.name) score += 60;
  const catalogTemplate = normalizedSentenceKey(catalogPattern.template);
  const targetTemplate = normalizedSentenceKey(targetPattern.template);
  if (catalogTemplate && catalogTemplate === targetTemplate) score += 50;
  else if (catalogTemplate && targetTemplate && (catalogTemplate.includes(targetTemplate) || targetTemplate.includes(catalogTemplate))) score += 18;
  const catalogMarkers = new Set((catalogPattern.markers ?? []).map(normalizedSentenceKey).filter(Boolean));
  const targetMarkers = new Set([...(targetPattern.markers ?? []), ...(targetPattern.template?.match(/[\p{Script=Han}]{1,5}/gu) ?? [])].map(normalizedSentenceKey).filter(Boolean));
  for (const marker of targetMarkers) if (catalogMarkers.has(marker)) score += 4;
  return score;
}

function buildSentenceDictionaryPayload(data, catalog, isChinese) {
  const targetPatterns = Array.isArray(data.sentencePatterns) ? data.sentencePatterns.filter((item) => item.frequency?.count == null || item.frequency.count > 0) : [];
  const catalogPatterns = Array.isArray(catalog.sentencePatterns) ? catalog.sentencePatterns : [];
  const patternMeasurements = {};
  const targetMatches = [];
  for (const target of targetPatterns) {
    const ranked = catalogPatterns
      .map((pattern) => ({ pattern, score: sentencePatternScore(pattern, target) }))
      .filter((item) => item.score >= 50)
      .sort((left, right) => right.score - left.score);
    const bestScore = ranked[0]?.score ?? 0;
    const best = ranked.filter((item) => item.score === bestScore).slice(0, 3);
    if (!best.length) {
      targetMatches.push({ targetId: target.id, targetName: target.name, status: "unmapped", candidates: [] });
      continue;
    }
    const status = best.length === 1 && bestScore >= 60 ? "mapped" : "ambiguous";
    targetMatches.push({ targetId: target.id, targetName: target.name, status, candidates: best.map((item) => ({ id: item.pattern.id, name: item.pattern.name, score: item.score })) });
    if (status !== "mapped") continue;
    const catalogId = best[0].pattern.id;
    const existing = patternMeasurements[catalogId];
    const measurement = {
      targetId: target.id,
      targetName: target.name,
      mappingMethod: bestScore === 100 ? "exact_id" : target.name === best[0].pattern.name ? "exact_name" : "exact_template",
      status: target.status ?? "not_measured",
      frequency: target.frequency ?? null,
      position: target.position ?? null,
      combinations: target.combinations ?? [],
      variation: target.variation ?? [],
      control: target.control ?? null,
      validation: target.validation ?? null,
      limitation: target.limitation ?? null,
    };
    if (!existing || Number(measurement.frequency?.count ?? -1) > Number(existing.frequency?.count ?? -1)) patternMeasurements[catalogId] = measurement;
  }
  const targetExtensionGroupId = "target-style-extensions";
  const targetExtensions = targetMatches
    .filter((item) => item.status !== "mapped")
    .map((match) => {
      const target = targetPatterns.find((item) => item.id === match.targetId);
      return {
        id: `target-extension-${target.id}`,
        group: targetExtensionGroupId,
        name: target.name,
        template: target.template ?? "—",
        relation: isChinese ? "目标语料已有参数，但尚未与通用句式模板建立唯一对应。" : "The target corpus has this parameter, but no unique shared-pattern mapping exists yet.",
        example: target.example ?? null,
        markers: target.markers ?? [],
        detect: target.detect ?? {},
        variants: target.variants ?? [],
        notes: target.limitation ?? (isChinese ? "保留在目标扩展区；完成人工复核和跨语料验证后，才可升级到通用字典。" : "Keep as a target extension until human and cross-corpus validation support promotion."),
        measure: [],
        typeIds: [],
        origin: "target_extension",
      };
    });
  for (const extension of targetExtensions) {
    const target = targetPatterns.find((item) => `target-extension-${item.id}` === extension.id);
    patternMeasurements[extension.id] = {
      targetId: target.id,
      targetName: target.name,
      mappingMethod: "target_extension",
      status: target.status ?? "not_measured",
      frequency: target.frequency ?? null,
      position: target.position ?? null,
      combinations: target.combinations ?? [],
      variation: target.variation ?? [],
      control: target.control ?? null,
      validation: target.validation ?? null,
      limitation: target.limitation ?? null,
    };
  }
  const mappedCatalogIds = new Set(Object.keys(patternMeasurements));
  const displayedPatterns = [...catalogPatterns.filter((pattern) => mappedCatalogIds.has(pattern.id)), ...targetExtensions];
  const typeMeasurements = {};
  for (const type of catalog.sentenceTypes ?? []) {
    const measurements = (type.patternIds ?? []).map((id) => patternMeasurements[id]).filter(Boolean);
    const counted = measurements.filter((item) => typeof item.frequency?.count === "number");
    const validationStatuses = [...new Set(measurements.map((item) => item.validation?.status ?? item.status).filter(Boolean))];
    typeMeasurements[type.id] = {
      mappedPatterns: measurements.length,
      measuredPatterns: counted.length,
      countSum: counted.reduce((sum, item) => sum + Number(item.frequency.count), 0),
      validationStatuses,
      status: measurements.length ? (counted.length ? "partially_measured" : "mapped_not_measured") : "not_mapped",
    };
  }
  return {
    schemaVersion: 1,
    language: isChinese ? "zh" : "en",
    description: isChinese ? "通用句式分类轴、类型和模板，与目标语料已有统计的映射结果。未映射表示尚未建立对应关系，不表示零次。" : "Shared sentence axes, types, and patterns with mapped target-corpus measurements. Unmapped does not mean zero occurrences.",
    measurementDimensions: catalog.measurementDimensions ?? [],
    sentenceTypeAxes: catalog.sentenceTypeAxes ?? [],
    sentenceTypes: (catalog.sentenceTypes ?? []).filter((type) => (type.patternIds ?? []).some((id) => mappedCatalogIds.has(id))),
    sentenceGroups: [...(catalog.sentenceGroups ?? []).filter((group) => displayedPatterns.some((pattern) => pattern.group === group.id)), ...(targetExtensions.length ? [{ id: targetExtensionGroupId, name: isChinese ? "目标文风扩展" : "Target-style extensions", description: isChinese ? "当前目标语料实际记录、但尚未进入通用句式字典的参数。" : "Parameters observed in the current target corpus but not yet promoted to the shared dictionary." }] : [])],
    sentencePatterns: displayedPatterns,
    patternMeasurements,
    typeMeasurements,
    targetMatches,
    sourceStatistics: {
      axes: catalog.sentenceTypeAxes?.length ?? 0,
      types: catalog.sentenceTypes?.length ?? 0,
      patterns: catalogPatterns.length,
      displayedPatterns: displayedPatterns.length,
      targetExtensions: targetExtensions.length,
      targetPatterns: targetPatterns.length,
      mappedTargetPatterns: targetMatches.filter((item) => item.status === "mapped").length,
      ambiguousTargetPatterns: targetMatches.filter((item) => item.status === "ambiguous").length,
      unmappedTargetPatterns: targetMatches.filter((item) => item.status === "unmapped").length,
      measuredCatalogPatterns: Object.keys(patternMeasurements).length,
    },
  };
}

function renderSentenceDictionary(data, catalog, isChinese) {
  const payload = buildSentenceDictionaryPayload(data, catalog, isChinese);
  const labels = isChinese
    ? { title: "实际句式统计", note: "直接列出目标语料中实际命中的句式模板，默认按覆盖率、再按命中次数排列。类型只用于切换归组查看。", search: "搜索句式类型、模板、关系或标记", allGroups: "全部分类", typeView: "按类型归组", patternView: "具体句式", measured: "只看已映射统计", copy: "复制筛选结果", edit: "编辑句式 JSON", apply: "应用数据", reset: "恢复内置数据", copyJson: "复制 JSON", importJson: "导入 JSON", exportJson: "导出 JSON", downloadHtml: "下载当前 HTML", empty: "当前没有可显示的句式。" }
    : { title: "Data-driven sentence dictionary", note: "Classify objective sentence types first, then inspect concrete patterns. Target measurements appear only when mapped.", search: "Search sentence types, patterns, relations, or markers", allGroups: "All groups", typeView: "Type dictionary", patternView: "Concrete patterns", measured: "Mapped measurements only", copy: "Copy results", edit: "Edit sentence JSON", apply: "Apply data", reset: "Restore built-in data", copyJson: "Copy JSON", importJson: "Import JSON", exportJson: "Export JSON", downloadHtml: "Download current HTML", empty: "No matching item." };
  const ui = isChinese ? { filter: "筛选", view: "查看方式", sort: "排序", hit: "命中率从高到低", count: "次数从高到低", name: "名称", more: "附加条件与操作" } : { filter: "Filters", view: "View", sort: "Sort", hit: "Hit rate descending", count: "Count descending", name: "Name", more: "Options and actions" };
  return `<div class="data-overview sentence-dictionary" data-sentence-dictionary><h2>${escapeHtml(labels.title)}</h2><p class="notice">${escapeHtml(labels.note)}</p><div class="metrics sentence-metrics" data-sentence-metrics></div><div class="dictionary-controls sentence-controls"><div class="dictionary-filter-row"><span class="control-caption">${escapeHtml(ui.filter)}</span><input type="search" data-sentence-search aria-label="${escapeHtml(labels.search)}" placeholder="${escapeHtml(labels.search)}" autocomplete="off"><select data-sentence-group aria-label="${escapeHtml(labels.allGroups)}"><option value="">${escapeHtml(labels.allGroups)}</option></select></div><div class="dictionary-option-row"><fieldset class="dictionary-view-switch"><legend>${escapeHtml(ui.view)}</legend><div class="segmented-control"><button type="button" data-sentence-view="types" aria-pressed="true">${escapeHtml(labels.typeView)}</button><button type="button" data-sentence-view="patterns" aria-pressed="false">${escapeHtml(labels.patternView)}</button></div></fieldset><label class="dictionary-sort">${escapeHtml(ui.sort)}<select data-sentence-sort><option value="hit">${escapeHtml(ui.hit)}</option><option value="count">${escapeHtml(ui.count)}</option><option value="name">${escapeHtml(ui.name)}</option></select></label><div class="dictionary-extra"><span class="control-caption">${escapeHtml(ui.more)}</span><label class="filter-toggle"><input type="checkbox" data-sentence-measured> ${escapeHtml(labels.measured)}</label><div class="dictionary-actions"><button type="button" data-sentence-copy-result>${escapeHtml(labels.copy)}</button></div></div></div></div><div class="dictionary-results" data-sentence-results></div><div class="empty sentence-empty" data-sentence-empty>${escapeHtml(labels.empty)}</div><details class="raw-json dictionary-data-region"><summary>${escapeHtml(labels.edit)}</summary><textarea data-sentence-json spellcheck="false"></textarea><div class="dictionary-data-actions"><button type="button" data-sentence-apply>${escapeHtml(labels.apply)}</button><button type="button" data-sentence-reset>${escapeHtml(labels.reset)}</button><button type="button" data-sentence-copy-json>${escapeHtml(labels.copyJson)}</button><button type="button" data-sentence-import>${escapeHtml(labels.importJson)}</button><button type="button" data-sentence-export>${escapeHtml(labels.exportJson)}</button><button type="button" data-sentence-download-html>${escapeHtml(labels.downloadHtml)}</button><input type="file" accept="application/json,.json" data-sentence-file hidden></div><p class="notice error" data-sentence-error hidden></p></details><script id="sentenceDictionaryData" type="application/json">${jsonForHtmlScript(payload)}</script></div>`;
}

function normalizedStructureKey(value) {
  const items = Array.isArray(value) ? value : String(value ?? "").split(/(?:→|—>|->|＞|>)/u);
  return items.map((item) => String(item).trim().toLocaleLowerCase().replace(/[\s，。！？、；：,.!?;:()[\]{}]+/gu, "")).filter(Boolean).join("→");
}

function structureMatchScore(catalogItem, targetItem, targetField) {
  if (catalogItem.id === targetItem.id || catalogItem.id === targetItem.catalogId) return 100;
  let score = catalogItem.name === targetItem.name ? 60 : 0;
  const catalogSequence = normalizedStructureKey(catalogItem.sequence);
  const targetSequence = normalizedStructureKey(targetItem[targetField]);
  if (catalogSequence && catalogSequence === targetSequence) score += 50;
  return score;
}

function buildStructuralDictionaryPayload(data, catalog, layer, isChinese) {
  const paragraph = layer === "paragraph";
  const config = paragraph
    ? { axes: "paragraphTypeAxes", types: "paragraphTypes", groups: "paragraphGroups", patterns: "paragraphPatterns", target: "paragraphPatterns", targetField: "sequence", typeLinks: "patternIds", title: "段落", per100: "per100Paragraphs" }
    : { axes: "contentTypeAxes", types: "contentTypes", groups: "contentGroups", patterns: "contentStructures", target: "contentStructures", targetField: "modules", typeLinks: "structureIds", title: "整篇编排", per100: "per100Texts" };
  const catalogItems = Array.isArray(catalog[config.patterns]) ? catalog[config.patterns] : [];
  const targetItems = Array.isArray(data[config.target]) ? data[config.target].filter((item) => item.frequency?.count == null || item.frequency.count > 0) : [];
  const measurements = {};
  const targetMatches = [];
  for (const target of targetItems) {
    const ranked = catalogItems.map((item) => ({ item, score: structureMatchScore(item, target, config.targetField) })).filter((item) => item.score >= 50).sort((left, right) => right.score - left.score);
    const bestScore = ranked[0]?.score ?? 0;
    const best = ranked.filter((item) => item.score === bestScore).slice(0, 3);
    const status = !best.length ? "unmapped" : best.length === 1 && bestScore >= 60 ? "mapped" : "ambiguous";
    targetMatches.push({ targetId: target.id, targetName: target.name, status, candidates: best.map((entry) => ({ id: entry.item.id, name: entry.item.name, score: entry.score })) });
    if (status !== "mapped") continue;
    const catalogId = best[0].item.id;
    const measurement = { targetId: target.id, targetName: target.name, mappingMethod: bestScore === 100 ? "exact_id" : target.name === best[0].item.name ? "exact_name" : "exact_sequence", status: target.status ?? "not_measured", frequency: target.frequency ?? null, position: target.position ?? null, combinations: target.combinations ?? [], variation: target.variation ?? [], control: target.control ?? null, validation: target.validation ?? null, limitation: target.limitation ?? null };
    const existing = measurements[catalogId];
    if (!existing || Number(measurement.frequency?.count ?? -1) > Number(existing.frequency?.count ?? -1)) measurements[catalogId] = measurement;
  }
  const extensionGroupId = "target-style-extensions";
  const extensions = targetMatches.filter((item) => item.status !== "mapped").map((match) => {
    const target = targetItems.find((item) => item.id === match.targetId);
    return { id: `target-extension-${target.id}`, group: extensionGroupId, name: target.name, sequence: target[config.targetField] ?? [], purpose: isChinese ? `目标语料已有${config.title}参数，但尚未与通用模板建立唯一对应。` : `The target corpus has this ${layer} parameter, but no unique shared mapping exists yet.`, example: target.example ?? [], variants: [], notes: target.limitation ?? (isChinese ? "保留在目标扩展区；完成人工复核和跨语料验证后才可升级。" : "Keep as a target extension until validation supports promotion."), measure: [], typeIds: [], origin: "target_extension" };
  });
  for (const extension of extensions) {
    const target = targetItems.find((item) => `target-extension-${item.id}` === extension.id);
    measurements[extension.id] = { targetId: target.id, targetName: target.name, mappingMethod: "target_extension", status: target.status ?? "not_measured", frequency: target.frequency ?? null, position: target.position ?? null, combinations: target.combinations ?? [], variation: target.variation ?? [], control: target.control ?? null, validation: target.validation ?? null, limitation: target.limitation ?? null };
  }
  const mappedCatalogIds = new Set(Object.keys(measurements));
  const displayedItems = [...catalogItems.filter((item) => mappedCatalogIds.has(item.id)), ...extensions];
  const displayedTypes = (catalog[config.types] ?? []).filter((type) => (type[config.typeLinks] ?? []).some((id) => mappedCatalogIds.has(id)));
  const displayedAxes = (catalog[config.axes] ?? []).filter((axis) => displayedTypes.some((type) => type.group === axis.id));
  const displayedGroups = [...(catalog[config.groups] ?? []).filter((group) => displayedItems.some((item) => item.group === group.id)), ...(extensions.length ? [{ id: extensionGroupId, name: isChinese ? "目标文风扩展" : "Target-style extensions", description: isChinese ? `当前目标语料实际记录、但尚未进入通用${config.title}字典的参数。` : "Target parameters not yet promoted to the shared dictionary." }] : [])];
  const typeMeasurements = {};
  for (const type of catalog[config.types] ?? []) {
    const mapped = (type[config.typeLinks] ?? []).map((id) => measurements[id]).filter(Boolean);
    const counted = mapped.filter((item) => typeof item.frequency?.count === "number");
    typeMeasurements[type.id] = { mappedPatterns: mapped.length, measuredPatterns: counted.length, countSum: counted.reduce((sum, item) => sum + Number(item.frequency.count), 0), status: mapped.length ? counted.length ? "partially_measured" : "mapped_not_measured" : "not_mapped" };
  }
  return { schemaVersion: 1, language: isChinese ? "zh" : "en", layer, description: isChinese ? `只展示目标语料已经命中或保留为目标扩展的${config.title}类型与模板；公共候选全集仍留在提取工具中。` : `Shows only ${layer} types and patterns observed in the target corpus or retained as target extensions.`, axes: displayedAxes, types: displayedTypes, groups: displayedGroups, patterns: displayedItems, measurements, typeMeasurements, targetMatches, fieldNames: { axes: config.axes, types: config.types, groups: config.groups, patterns: config.patterns, typeLinks: config.typeLinks, sequence: "sequence", per100: config.per100 }, sourceStatistics: { axes: catalog[config.axes]?.length ?? 0, types: catalog[config.types]?.length ?? 0, patterns: catalogItems.length, displayedAxes: displayedAxes.length, displayedTypes: displayedTypes.length, displayedPatterns: displayedItems.length, targetExtensions: extensions.length, targetPatterns: targetItems.length, mappedTargetPatterns: targetMatches.filter((item) => item.status === "mapped").length, ambiguousTargetPatterns: targetMatches.filter((item) => item.status === "ambiguous").length, unmappedTargetPatterns: targetMatches.filter((item) => item.status === "unmapped").length } };
}

function renderStructuralDictionary(data, catalog, layer, isChinese) {
  const payload = buildStructuralDictionaryPayload(data, catalog, layer, isChinese);
  const paragraph = layer === "paragraph";
  const prefix = paragraph ? "paragraph" : "composition";
  const title = isChinese ? paragraph ? "实际段落结构统计" : "实际编排方式统计" : paragraph ? "Observed paragraph structures" : "Observed composition patterns";
  const templateLabel = isChinese ? paragraph ? "按具体段落模板" : "按具体整篇模板" : "Concrete templates";
  const noun = isChinese ? paragraph ? "段落" : "整篇编排" : layer;
  const ui = isChinese ? { filter: "筛选", view: "查看方式", sort: "排序", hit: "命中率从高到低", count: "次数从高到低", name: "名称", more: "附加条件与操作", all: "全部分类", mapped: "只看已映射统计", copy: "复制结果" } : { filter: "Filters", view: "View", sort: "Sort", hit: "Hit rate descending", count: "Count descending", name: "Name", more: "Options and actions", all: "All groups", mapped: "Mapped only", copy: "Copy" };
  const searchLabel = isChinese ? `搜索${noun}类型、模板或功能` : `Search ${noun} types or templates`;
  return `<div class="data-overview structural-dictionary" data-structural-dictionary="${prefix}"><h2>${escapeHtml(title)}</h2><p class="notice">${escapeHtml(isChinese ? `先按客观标准判断${noun}类型，再查看具体模板。通用目录只规定检查范围，目标统计只显示已经建立的映射。` : `Classify objective ${noun} types first, then inspect concrete templates.`)}</p><div class="metrics" data-${prefix}-metrics></div><div class="dictionary-controls"><div class="dictionary-filter-row"><span class="control-caption">${escapeHtml(ui.filter)}</span><input type="search" data-${prefix}-search aria-label="${escapeHtml(searchLabel)}" placeholder="${escapeHtml(searchLabel)}" autocomplete="off"><select data-${prefix}-group aria-label="${escapeHtml(ui.all)}"><option value="">${escapeHtml(ui.all)}</option></select></div><div class="dictionary-option-row"><fieldset class="dictionary-view-switch"><legend>${escapeHtml(ui.view)}</legend><div class="segmented-control"><button type="button" data-${prefix}-view="types" aria-pressed="true">${escapeHtml(isChinese ? "类型" : "Types")}</button><button type="button" data-${prefix}-view="patterns" aria-pressed="false">${escapeHtml(templateLabel)}</button></div></fieldset><label class="dictionary-sort">${escapeHtml(ui.sort)}<select data-${prefix}-sort><option value="hit">${escapeHtml(ui.hit)}</option><option value="count">${escapeHtml(ui.count)}</option><option value="name">${escapeHtml(ui.name)}</option></select></label><div class="dictionary-extra"><span class="control-caption">${escapeHtml(ui.more)}</span><label class="filter-toggle"><input type="checkbox" data-${prefix}-measured> ${escapeHtml(ui.mapped)}</label><div class="dictionary-actions"><button type="button" data-${prefix}-copy-result>${escapeHtml(ui.copy)}</button></div></div></div></div><div class="dictionary-results" data-${prefix}-results></div><div class="empty" data-${prefix}-empty>${escapeHtml(isChinese ? "当前筛选没有匹配项。" : "No matching item.")}</div><details class="raw-json dictionary-data-region"><summary>${escapeHtml(isChinese ? `编辑${noun} JSON` : `Edit ${noun} JSON`)}</summary><textarea data-${prefix}-json spellcheck="false"></textarea><div class="dictionary-data-actions"><button type="button" data-${prefix}-apply>${escapeHtml(isChinese ? "应用数据" : "Apply")}</button><button type="button" data-${prefix}-reset>${escapeHtml(isChinese ? "恢复内置数据" : "Reset")}</button><button type="button" data-${prefix}-copy-json>${escapeHtml(isChinese ? "复制 JSON" : "Copy JSON")}</button><button type="button" data-${prefix}-import>${escapeHtml(isChinese ? "导入 JSON" : "Import JSON")}</button><button type="button" data-${prefix}-export>${escapeHtml(isChinese ? "导出 JSON" : "Export JSON")}</button><button type="button" data-${prefix}-download-html>${escapeHtml(isChinese ? "下载当前 HTML" : "Download HTML")}</button><input type="file" accept="application/json,.json" data-${prefix}-file hidden></div><p class="notice error" data-${prefix}-error hidden></p></details><script id="${prefix}DictionaryData" type="application/json">${jsonForHtmlScript(payload)}</script></div>`;
}

function renderFourLayerData(text, layer, isChinese, sentenceCatalog = null, fourLayerCatalog = null) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    return `<div class="notice error">JSON：${escapeHtml(error.message)}</div>`;
  }
  const configurations = {
    lexical: { key: "vocabularyTypes", title: isChinese ? "常用词汇类型统计" : "Frequent vocabulary-type statistics", unit: isChinese ? "次数" : "Count" },
    sentence: { key: "sentencePatterns", title: isChinese ? "常用句式统计" : "Frequent sentence-pattern statistics", unit: isChinese ? "每百句" : "Per 100 sentences" },
    paragraph: { key: "paragraphPatterns", title: isChinese ? "常用段落结构统计" : "Frequent paragraph-pattern statistics", unit: isChinese ? "每百段" : "Per 100 paragraphs" },
    composition: { key: "contentStructures", title: isChinese ? "常用内容结构统计" : "Frequent content-structure statistics", unit: isChinese ? "每百篇／单元" : "Per 100 texts or units" },
  };
  const config = configurations[layer];
  if (layer === "lexical") return renderVocabularyDictionary(data, isChinese, fourLayerCatalog);
  if (layer === "sentence" && sentenceCatalog) return renderSentenceDictionary(data, sentenceCatalog, isChinese);
  if (layer === "paragraph" && fourLayerCatalog) return renderStructuralDictionary(data, fourLayerCatalog, layer, isChinese);
  if (layer === "composition" && fourLayerCatalog) return renderStructuralDictionary(data, fourLayerCatalog, layer, isChinese);
  const items = Array.isArray(data[config.key]) ? data[config.key] : [];
  const measuredItems = items.filter((item) => !["not_measured", "insufficient_evidence"].includes(item.status) && (item.frequency?.count == null || item.frequency.count > 0));
  const unmeasuredItems = items.filter((item) => ["not_measured", "insufficient_evidence"].includes(item.status));
  const displayItems = [...measuredItems.slice(0, layer === "lexical" ? 40 : 50), ...unmeasuredItems];
  const positionLabels = isChinese
    ? { opening: "句首", middle: "句中", ending: "句尾" }
    : { opening: "opening", middle: "middle", ending: "ending" };
  const validationLabels = isChinese
    ? {
        automatic_counted: "已自动计数",
        automatic_candidate: "待人工复核",
        human_reviewed: "已人工复核",
        not_measured: "尚未统计",
        observed: "已观察",
        rare: "低频",
        absent: "未出现",
      }
    : {};
  const rows = displayItems.map((item, index) => {
    const frequency = item.frequency ?? {};
    const standardized = layer === "sentence" ? frequency.per100Sentences : layer === "paragraph" ? frequency.per100Paragraphs : layer === "composition" ? frequency.per100Texts : frequency.per10kCharacters;
    const form = item.template ?? (Array.isArray(item.sequence) ? item.sequence.join(" → ") : Array.isArray(item.modules) ? item.modules.join(" → ") : (item.items ?? []).slice(0, 8).map((entry) => typeof entry === "string" ? entry : `${entry.word}（${entry.count}）`).join("、"));
    const positions = Object.entries(item.position ?? {}).map(([key, value]) => `${positionLabels[key] ?? key} ${value}`).join(" · ");
    const combinations = (item.combinations ?? []).slice(0, 4).map((entry) => `${entry.patternId ?? entry.id ?? entry.name}${entry.count ? `(${entry.count})` : ""}`).join("、");
    const control = item.control?.per100Sentences ?? item.control?.rateRatio ?? item.control?.count ?? "—";
    const rawValidation = item.validation?.status ?? item.status ?? "—";
    const validation = validationLabels[rawValidation] ?? rawValidation;
    const count = typeof frequency.count === "number" ? frequency.count : "—";
    const coverage = typeof frequency.coverageRatio === "number" ? `${(frequency.coverageRatio * 100).toFixed(1)}%` : "—";
    return `<tr><td>${index + 1}</td><td>${escapeHtml(item.group ? `${item.group}／${item.name ?? item.id}` : item.name ?? item.id)}</td><td>${escapeHtml(form || "—")}</td><td>${count}</td><td>${standardized ?? "—"}</td><td>${coverage}</td><td>${escapeHtml(positions || "—")}</td><td>${escapeHtml(combinations || "—")}</td><td>${escapeHtml(control)}</td><td>${escapeHtml(validation)}</td></tr>`;
  }).join("");
  const notes = {
    lexical: "八大类和 130 个子类型已经按候选词形扫描；开放语义类仍需补充实际高频词和人工归类，零次不能证明整个语义类别不存在。",
    sentence: "自动计数表示结构标记命中；标为 automatic_candidate 的项目仍需逐类人工语义复核，不能直接进入运行时规则。",
    paragraph: "这里的统计单位是带明确归属的完整发言，不冒充普通文章自然段；人工复核项和自动候选项分别标记。",
    composition: "完整长发言的自动模块顺序只用于候选搜索；人工复核目前只验证进入和退出，不能冒充完整文章编排。",
  };
  const note = isChinese ? notes[layer] : "";
  const auditItems = layer === "lexical" && Array.isArray(data.vocabularyTypes) ? data.vocabularyTypes : layer === "sentence" ? unmeasuredItems : [];
  const auditRows = auditItems.map((item, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(item.group ?? "—")}</td><td>${escapeHtml(item.name ?? item.id)}</td><td>${escapeHtml(item.status ?? "—")}</td><td>${escapeHtml(item.validation?.method ?? "—")}</td></tr>`).join("");
  const auditTable = auditRows ? `<details><summary>${escapeHtml(isChinese ? `展开候选类型检查表（${auditItems.length} 项）` : `Open candidate-type audit (${auditItems.length})`)}</summary><div class="table-wrap"><table><thead><tr><th>#</th><th>${escapeHtml(isChinese ? "大类" : "Group")}</th><th>${escapeHtml(isChinese ? "具体类型" : "Concrete type")}</th><th>${escapeHtml(isChinese ? "状态" : "Status")}</th><th>${escapeHtml(isChinese ? "说明" : "Note")}</th></tr></thead><tbody>${auditRows}</tbody></table></div></details>` : "";
  const candidateCount = layer === "lexical" ? Number(data.catalogAudit?.vocabularyCandidateTypes ?? auditItems.length) : layer === "sentence" ? Number(data.catalogAudit?.sentenceCandidateTypes ?? items.length) : items.length;
  const targetUnits = layer === "sentence" ? data.corpus?.targetSentences : layer === "composition" ? data.corpus?.extendedTargetUnits : data.corpus?.targetUnits;
  return `<div class="data-overview"><h2>${escapeHtml(config.title)}</h2>${note ? `<p class="notice">${escapeHtml(note)}</p>` : ""}<div class="metrics"><div class="metric"><strong>${candidateCount}</strong><span>${escapeHtml(isChinese ? "候选检查类型" : "Candidate types")}</span></div><div class="metric"><strong>${measuredItems.length}</strong><span>${escapeHtml(isChinese ? "已有统计" : "Measured")}</span></div><div class="metric"><strong>${layer === "lexical" ? auditItems.filter((item)=>item.status === "not_measured").length : unmeasuredItems.length}</strong><span>${escapeHtml(isChinese ? "未完成统计" : "Unmeasured")}</span></div><div class="metric"><strong>${Number(targetUnits ?? 0)}</strong><span>${escapeHtml(isChinese ? "目标分析单位" : "Target units")}</span></div></div><div class="table-wrap wide-table-wrap" aria-label="${escapeHtml(isChinese ? "可横向滚动的数据表" : "Horizontally scrollable data table")}"><table class="wide-data-table"><thead><tr><th>#</th><th>${escapeHtml(isChinese ? "类型" : "Type")}</th><th>${escapeHtml(isChinese ? "模板／构成" : "Template or form")}</th><th>${escapeHtml(isChinese ? "次数" : "Count")}</th><th>${escapeHtml(config.unit)}</th><th>${escapeHtml(isChinese ? "覆盖率" : "Coverage")}</th><th>${escapeHtml(isChinese ? "位置" : "Position")}</th><th>${escapeHtml(isChinese ? "常见组合" : "Combinations")}</th><th>${escapeHtml(isChinese ? "对照" : "Control")}</th><th>${escapeHtml(isChinese ? "验证状态" : "Validation")}</th></tr></thead><tbody>${rows}</tbody></table></div>${auditTable}<p class="source-link"><a href="style-data.json">${escapeHtml(isChinese ? "打开四层原始统计数据" : "Open raw four-layer data")}</a></p></div>`;
}

function stripDocumentChrome(markdown) {
  const body = stripFrontmatter(markdown).replaceAll("\r\n", "\n");
  const lines = body.split("\n");
  const output = [];
  let skippingIndex = false;
  let seenContentHeading = false;
  for (const line of lines) {
    if (/^#\s+/.test(line)) continue;
    if (/^##\s+(?:索引|Index)\s*$/i.test(line)) {
      skippingIndex = true;
      continue;
    }
    if (skippingIndex && /^##\s+/.test(line)) {
      skippingIndex = false;
      seenContentHeading = true;
    }
    if (skippingIndex) continue;
    if (/^##\s+/.test(line)) seenContentHeading = true;
    if (!seenContentHeading && /^\s*$/.test(line) && output.length === 0) continue;
    output.push(line);
  }
  return output.join("\n").trim();
}

function splitLevelTwoSections(markdown) {
  const body = stripFrontmatter(markdown).replaceAll("\r\n", "\n");
  const lines = body.split("\n");
  const intro = [];
  const sections = [];
  let current = null;
  for (const line of lines) {
    if (/^#\s+/.test(line)) continue;
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      current = { title: heading[1].trim(), lines: [line] };
      sections.push(current);
      continue;
    }
    if (current) current.lines.push(line);
    else intro.push(line);
  }
  return {
    intro: intro.join("\n").trim(),
    sections: sections.filter((section) => !/^(?:索引|Index)$/i.test(section.title)),
  };
}

function composeProfile(markdown, options = {}) {
  const { intro, sections } = splitLevelTwoSections(markdown);
  const normalized = (value) => String(value).trim().toLocaleLowerCase();
  const used = new Set();
  const output = [];
  if (options.includeIntro !== false && intro) output.push(intro);
  for (const alternatives of options.order ?? []) {
    const wanted = alternatives.map(normalized);
    const section = sections.find((candidate) =>
      wanted.some((name) => normalized(candidate.title) === name),
    );
    if (section) {
      used.add(section);
      output.push(section.lines.join("\n").trim());
    }
  }
  if (options.appendUnmatched !== false) {
    const excluded = (options.exclude ?? []).map(normalized);
    for (const section of sections) {
      if (used.has(section)) continue;
      if (excluded.some((name) => normalized(section.title) === name)) continue;
      output.push(section.lines.join("\n").trim());
    }
  }
  return output.filter(Boolean).join("\n\n");
}

function sectionCard({ id, step, title, summary, body, tone = "" }) {
  return `<section class="layer-section search-unit ${tone}" id="${id}" data-searchable>
  <header class="layer-heading"><div class="step-badge">${escapeHtml(step)}</div><div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(summary)}</p></div></header>
  <div class="layer-body">${body}</div>
</section>`;
}

export function buildStyleGuide(skillDirectory) {
  const root = path.resolve(skillDirectory);
  const sources = loadSources(root);
  const skillSource = sources.find((source) => source.fileName === "SKILL.md");
  const reportSource = sources.find((source) => source.fileName === REQUIRED_REPORT);
  let report = {};
  try {
    report = JSON.parse(reportSource.content);
  } catch {
    report = {};
  }
  const isChinese = String(report.context?.language ?? "").toLocaleLowerCase().startsWith("zh") || /[\u3400-\u9fff]/u.test(firstHeading(skillSource.content));
  const labels = isChinese
    ? {
        pageSuffix: "阅读版",
        generatedView: "由正式档案生成的阅读版",
        sourceNotice: "五份 Markdown 档案与 JSON 证据报告是规则来源；本页只负责浏览、搜索和打印，不参与 Agent 运行时加载。",
        standardNotice: "本页只展示这个语言风格的实际参数。词汇、句式、段落、整篇编排、命名、提取和验证的通用规范，统一查看 clear-science-writing。",
        standardLink: "查看 clear-science-writing 通用规范",
        search: "搜索全部档案",
        expand: "全部展开",
        collapse: "全部折叠",
        print: "打印 / 导出 PDF",
        theme: "切换明暗",
        formalProfiles: "正式档案",
        evidenceReport: "证据报告",
        optional: "任务适配与补充数据",
        sourceFile: "来源文件",
        observations: "规则观察",
        validationsPassed: "通过的验证",
        context: "语料与提取范围",
        layerMaturity: "四层提取成熟度",
        overallMaturity: "总体成熟度",
        layer: "层级",
        unitDefinition: "分析单位",
        corpusUnits: "单位数",
        completedChecks: "已完成检查",
        missingChecks: "仍缺检查",
        validation: "验证结果",
        item: "项目",
        status: "状态",
        evidence: "证据",
        primaryTendency: "主要倾向",
        confidence: "置信度",
        rawJson: "查看原始 JSON",
        lexicalCategories: "词汇类别",
        collocations: "稳定搭配",
        interpretation: "统计解释",
        category: "类别",
        observedTerms: "出现词项",
        frequentTerms: "高频词",
        term: "词语",
        patterns: "常见搭配",
        openRawMetrics: "打开完整词汇指标 JSON",
        invalidJson: "JSON 无法解析",
        noResults: "没有找到匹配内容。",
        skipToContent: "跳到正文",
        pageNavigation: "页面章节",
        files: "份来源文件",
        overview: "先看整体",
        overviewSummary: "先理解这份风格怎样推进问题，再逐层查看词汇、句式、段落和整篇编排。",
        lexicalLayer: "第一层 · 词汇",
        lexicalSummary: "先决定具体使用哪些词，以及这些词承担条件、判断、行动、范围或关系中的哪一种作用。",
        sentenceLayer: "第二层 · 句式",
        sentenceSummary: "再决定这些词怎样组成判断、疑问、否定、比较、修正和行动句。",
        paragraphLayer: "第三层 · 段落结构",
        paragraphSummary: "句子组成段落后，明确段首怎样进入、中间怎样展开、段尾怎样收束。",
        compositionLayer: "第四层 · 整篇编排",
        compositionSummary: "最后安排答案、背景、证据、分支、行动和结尾在全文中的位置。",
        combinedUse: "综合使用",
        combinedSummary: "四层共同出现时，才形成稳定文风；场景变化、禁止项和正反校准也在这里说明。",
        reviewArea: "复核区",
        reviewSummary: "规则 ID、统计摘要、任务适配器和验证记录供复核使用，不是普通读者的首读路径。",
        layerEvidence: "本层数据、文本依据与证据边界",
        layerEvidenceSummary: "包含观察事实、样本与全文范围、对照、混淆因素、验证结果、置信度和仍不能推出的结论。",
      }
    : {
        pageSuffix: "Reading edition",
        generatedView: "Reading edition generated from the formal profiles",
        sourceNotice: "The five Markdown profiles and JSON evidence report remain the rule sources. This page is only for browsing, search, and print; agents do not load it at runtime.",
        standardNotice: "This page contains only the observed parameters of this language style. See clear-science-writing for the shared rules for vocabulary, sentences, paragraphs, composition, naming, extraction, and validation.",
        standardLink: "View the clear-science-writing standard",
        search: "Search all profiles",
        expand: "Expand all",
        collapse: "Collapse all",
        print: "Print / export PDF",
        theme: "Toggle theme",
        formalProfiles: "Formal profiles",
        evidenceReport: "Evidence report",
        optional: "Task adapters and supplementary data",
        sourceFile: "Source file",
        observations: "Observations",
        validationsPassed: "Validations passed",
        context: "Corpus and extraction context",
        layerMaturity: "Four-layer extraction maturity",
        overallMaturity: "Overall maturity",
        layer: "Layer",
        unitDefinition: "Analysis unit",
        corpusUnits: "Units",
        completedChecks: "Completed checks",
        missingChecks: "Missing checks",
        validation: "Validation",
        item: "Item",
        status: "Status",
        evidence: "Evidence",
        primaryTendency: "Primary tendency",
        confidence: "Confidence",
        rawJson: "View raw JSON",
        lexicalCategories: "Lexical categories",
        collocations: "Stable collocations",
        interpretation: "Interpretation",
        category: "Category",
        observedTerms: "Observed terms",
        frequentTerms: "Frequent terms",
        term: "Term",
        patterns: "Common patterns",
        openRawMetrics: "Open the complete lexical metrics JSON",
        invalidJson: "Invalid JSON",
        noResults: "No matching content was found.",
        skipToContent: "Skip to content",
        pageNavigation: "Page sections",
        files: "source files",
        overview: "Start with the whole style",
        overviewSummary: "Understand how the style moves a problem forward before reading its vocabulary, sentences, paragraphs, and composition.",
        lexicalLayer: "Layer 1 · Vocabulary",
        lexicalSummary: "Choose the actual words and the conditions, judgments, actions, scopes, or relationships they express.",
        sentenceLayer: "Layer 2 · Sentences",
        sentenceSummary: "Combine those words into judgments, questions, negations, comparisons, corrections, and actions.",
        paragraphLayer: "Layer 3 · Paragraphs",
        paragraphSummary: "Define how a paragraph enters, develops, and closes.",
        compositionLayer: "Layer 4 · Composition",
        compositionSummary: "Place answers, background, evidence, branches, actions, and endings across the full text.",
        combinedUse: "Use the four layers together",
        combinedSummary: "A stable style appears only when all four layers work together, including scenario shifts, exclusions, and calibration.",
        reviewArea: "Review and evidence",
        reviewSummary: "Rule IDs, metrics, adapters, and validation records are for review, not the primary reading path.",
        layerEvidence: "Data, textual evidence, and limits for this layer",
        layerEvidenceSummary: "Includes observations, sample and full-corpus scope, controls, confounds, validation, confidence, and unsupported conclusions.",
      };
  const title = firstHeading(skillSource.content);
  const digest = sourceHash(sources);
  const sourceIds = new Map();
  for (const source of sources) sourceIds.set(source.fileName, `doc-${slugify(source.fileName)}`);
  const byName = new Map(sources.map((source) => [source.fileName, source]));
  const styleDataText = byName.get("style-data.json")?.content ?? "";
  let sentenceCatalog = null;
  let fourLayerCatalog = null;
  try {
    sentenceCatalog = JSON.parse(fs.readFileSync(SENTENCE_STYLE_CATALOG, "utf8"));
  } catch {
    sentenceCatalog = null;
  }
  try {
    fourLayerCatalog = JSON.parse(fs.readFileSync(FOUR_LAYER_TYPE_CATALOG, "utf8"));
  } catch {
    fourLayerCatalog = null;
  }
  const renderProfile = (fileName, id, options = {}) =>
    renderMarkdown(composeProfile(byName.get(fileName)?.content ?? "", options), id, sourceIds);
  const evidenceBlock = (fileName, id, order) => {
    const body = renderProfile(fileName, id, {
      includeIntro: false,
      order,
      appendUnmatched: false,
    });
    return body
      ? `<details class="evidence-block"><summary><span>${escapeHtml(labels.layerEvidence)}</span><small>${escapeHtml(labels.layerEvidenceSummary)}</small></summary><div>${body}</div></details>`
      : "";
  };
  const navigation = [
    ["overview", labels.overview],
    ["layer-lexical", labels.lexicalLayer],
    ["layer-sentence", labels.sentenceLayer],
    ["layer-paragraph", labels.paragraphLayer],
    ["layer-composition", labels.compositionLayer],
    ["combined", labels.combinedUse],
    ["review", labels.reviewArea],
  ].map(([id, label]) => `<a href="#${id}">${escapeHtml(label)}</a>`).join("");

  const readableSections = [
    sectionCard({ id: "overview", step: "00", title: labels.overview, summary: labels.overviewSummary, body: renderProfile("style-profile.md", "overview-style", {
      order: [["适用范围", "Scope"], ["四层执行边界", "Four-layer execution boundary"], ["主倾向、次倾向与声音指纹", "Primary tendency, secondary tendency, and voice fingerprints"]],
      appendUnmatched: false,
    }) + evidenceBlock("style-profile.md", "overview-evidence", [["分层验证状态", "Layer validation status"], ["运行时规则", "Runtime rules"], ["验证记录", "Validation record"]]) }),
    sectionCard({ id: "layer-lexical", step: "01", title: labels.lexicalLayer, summary: labels.lexicalSummary, body: (styleDataText ? renderFourLayerData(styleDataText, "lexical", isChinese, sentenceCatalog, fourLayerCatalog) : "") + renderProfile("lexical-profile.md", "layer-lexical", {
      order: [["核心词汇组合", "Core lexical combinations"], ["分类词典", "Lexical dictionary"], ["同义替代与控制", "Alternatives and controls"], ["人称与责任主体", "Person and responsibility"], ["稳定搭配", "Stable collocations"], ["疑问词、语气词与情绪词", "Question, modal, and emotion words"], ["信息词与专业词", "Information and professional words"], ["高频不等于代表词", "Frequent does not mean distinctive"], ["任务工作词不是核心词汇", "Task words are not core style vocabulary"], ["应用顺序", "Application order"]],
      exclude: [["统计依据"], ["样本与全文的稳定性"]].flat(),
    }) + evidenceBlock("lexical-profile.md", "lexical-evidence", [["统计依据", "Statistical basis"], ["样本与全文的稳定性", "Sample and full-corpus stability"]]) }),
    sectionCard({ id: "layer-sentence", step: "02", title: labels.sentenceLayer, summary: labels.sentenceSummary, body: (styleDataText ? renderFourLayerData(styleDataText, "sentence", isChinese, sentenceCatalog) : "") + renderProfile("sentence-profile.md", "layer-sentence", {
      order: [["句式维度总览", "Sentence dimension overview"], ["句式参数词典", "Sentence parameter dictionary"], ["句类与言语行为", "Sentence types and speech acts"], ["主语、责任与视角", "Subjects, responsibility, and viewpoint"], ["主动、被动与状态表达", "Active, passive, and state expressions"], ["语序、焦点与信息落点", "Word order, focus, and information landing"], ["肯定、否定、限制与纠正", "Affirmation, negation, limitation, and correction"], ["逻辑关系与显化程度", "Logical relations and explicitness"], ["复杂度与从句组织", "Complexity and clause organization"], ["句长、节奏与断句", "Sentence length, rhythm, and segmentation"], ["重复、平行与递进", "Repetition, parallelism, and progression"], ["标点分布", "Punctuation distribution"], ["常见组合与场景变化", "Common combinations and scenario shifts"], ["主要表达方式", "Main expression patterns"], ["常见组合", "Common combinations"], ["场景变化", "Scenario shifts"], ["正反校准", "Positive and negative calibration"], ["校准样例", "Calibration examples"]],
      exclude: ["证据状态", "Evidence status", "句式参数总表", "Sentence parameter table", "证据限制与后续加强", "Evidence limits and future strengthening"],
    }) + evidenceBlock("sentence-profile.md", "sentence-evidence", [["证据状态", "Evidence status"], ["句式参数总表", "Sentence parameter table"], ["证据限制与后续加强", "Evidence limits and future strengthening"]]) }),
    sectionCard({ id: "layer-paragraph", step: "03", title: labels.paragraphLayer, summary: labels.paragraphSummary, body: (styleDataText ? renderFourLayerData(styleDataText, "paragraph", isChinese, sentenceCatalog, fourLayerCatalog) : "") + renderProfile("paragraph-profile.md", "layer-paragraph", {
      order: [["段落维度总览", "Paragraph dimension overview"], ["段落参数词典", "Paragraph parameter dictionary"], ["中心任务", "Central task"], ["段首功能", "Opening function"], ["中段展开功能", "Development function"], ["段尾功能", "Ending function"], ["段内动作序列", "Within-paragraph action sequence"], ["长度、拆分与合并", "Length, splitting, and merging"], ["承接、过渡与排版", "Cohesion, transitions, and layout"], ["常见组合与场景变化", "Common combinations and scenario shifts"], ["段首、展开与段尾", "Paragraph opening, development, and ending"], ["常见骨架", "Common skeletons"], ["拆段、过渡与列表", "Splitting, transitions, and lists"], ["场景变化", "Scenario shifts"], ["正反校准", "Positive and negative calibration"], ["校准样例", "Calibration examples"]],
      exclude: ["适用范围与证据边界", "Scope and evidence boundary", "段落规则", "Paragraph rules", "证据限制与后续加强", "Evidence limits and future strengthening"],
    }) + evidenceBlock("paragraph-profile.md", "paragraph-evidence", [["适用范围与证据边界", "Scope and evidence boundary"], ["段落规则", "Paragraph rules"], ["证据限制与后续加强", "Evidence limits and future strengthening"]]) }),
    sectionCard({ id: "layer-composition", step: "04", title: labels.compositionLayer, summary: labels.compositionSummary, body: (styleDataText ? renderFourLayerData(styleDataText, "composition", isChinese, sentenceCatalog, fourLayerCatalog) : "") + renderProfile("composition-profile.md", "layer-composition", {
      order: [["整篇维度总览", "Composition dimension overview"], ["整篇参数词典", "Composition parameter dictionary"], ["目的、读者与首要问题", "Purpose, reader, and primary question"], ["开头信息与答案位置", "Opening information and answer position"], ["背景位置与展开深度", "Background position and depth"], ["证据、例子、反例与限制的位置", "Positions of evidence, examples, counterexamples, and limits"], ["信息排序依据", "Information ordering basis"], ["全文推进路线", "Whole-text route"], ["行动、成功标志与失败处理", "Actions, success criteria, and failure handling"], ["用途、媒介与场景变化", "Purpose, medium, and scenario shifts"], ["结尾功能", "Ending function"], ["内容位置与推进路线", "Content positions and route"], ["场景变化", "Scenario shifts"], ["任务适配器映射", "Task adapter mapping"], ["正反校准", "Positive and negative calibration"], ["校准样例", "Calibration examples"]],
      exclude: ["证据结论", "Evidence conclusion", "整篇规则", "Composition rules", "验证要求", "Validation requirements"],
    }) + evidenceBlock("composition-profile.md", "composition-evidence", [["证据结论", "Evidence conclusion"], ["整篇规则", "Composition rules"], ["验证要求", "Validation requirements"]]) }),
    sectionCard({ id: "combined", step: "05", title: labels.combinedUse, summary: labels.combinedSummary, body: ["reply-style.md", "document-style.md"].filter((name) => byName.has(name)).map((name) => `<div class="adapter-block">${renderProfile(name, `combined-${slugify(name)}`)}</div>`).join("") }),
  ].join("\n");

  const reportHtml = renderReport(reportSource.content, labels, sourceIds);
  const metricsHtml = "";
  const sourceLinks = sources.filter((source) => source.fileName !== "SKILL.md").map((source) => `<li><a href="${escapeHtml(source.fileName)}">${escapeHtml(source.fileName)}</a></li>`).join("");
  const reviewSection = `<section class="layer-section search-unit review-section" id="review" data-searchable>
  <header class="layer-heading"><div class="step-badge">06</div><div><h2>${escapeHtml(labels.reviewArea)}</h2><p>${escapeHtml(labels.reviewSummary)}</p></div></header>
  <div class="layer-body"><details><summary>${escapeHtml(labels.evidenceReport)}</summary>${reportHtml}</details>${metricsHtml ? `<details><summary>${escapeHtml(labels.lexicalCategories)} · ${escapeHtml(labels.validation)}</summary>${metricsHtml}</details>` : ""}<details><summary>${escapeHtml(labels.sourceFile)}</summary><ul>${sourceLinks}</ul></details></div>
</section>`;

  const html = `<!doctype html>
<html lang="${isChinese ? "zh-CN" : "en"}" data-style-guide="generated">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="language-style-guide" content="generated">
  <meta name="language-style-source-hash" content="${digest}">
  <title>${escapeHtml(title)} · ${escapeHtml(labels.pageSuffix)}</title>
  <style>
    :root{color-scheme:light;--bg:#f4f1e9;--panel:#fffdf7;--panel-2:#ebe5d8;--text:#1f2722;--muted:#657067;--line:#d5cec0;--accent:#245f4b;--accent-soft:#dce9e1;--code:#17231e;--shadow:0 14px 40px rgba(49,45,35,.08)}
    html[data-theme="dark"]{color-scheme:dark;--bg:#151a17;--panel:#1d241f;--panel-2:#283029;--text:#eef3ee;--muted:#aab6ac;--line:#3c463e;--accent:#86c9aa;--accent-soft:#243e32;--code:#0e1411;--shadow:0 14px 40px rgba(0,0,0,.25)}
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.75 system-ui,-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}
    a{color:var(--accent);text-decoration-thickness:.08em;text-underline-offset:.18em}button,input{font:inherit}.layout{display:grid;grid-template-columns:250px minmax(0,1fr);min-height:100vh}
    aside{position:sticky;top:0;height:100vh;padding:28px 22px;border-right:1px solid var(--line);overflow:auto;background:color-mix(in srgb,var(--bg) 88%,transparent)}
    aside h1{font-size:1.05rem;line-height:1.35;margin:0 0 8px}.eyebrow{color:var(--accent);font-weight:750;font-size:.75rem;letter-spacing:.08em;text-transform:uppercase}.layer-nav{display:grid;gap:6px;margin-top:22px}.layer-nav a{padding:7px 9px;border-radius:8px;text-decoration:none;font-size:.9rem}.layer-nav a:hover{background:var(--accent-soft)}
    main{width:min(1480px,100%);padding:52px clamp(24px,4vw,64px) 90px}.hero{padding:32px;border:1px solid var(--line);border-radius:20px;background:linear-gradient(145deg,var(--panel),var(--accent-soft));box-shadow:var(--shadow)}.hero h1{font-size:clamp(2rem,5vw,4rem);line-height:1.08;letter-spacing:-.035em;margin:10px 0 16px}.hero p{max-width:820px;margin:0;color:var(--muted)}
    .controls{display:grid;grid-template-columns:minmax(220px,1fr) repeat(4,auto);gap:10px;margin:22px 0}.controls input,.controls button{border:1px solid var(--line);border-radius:10px;background:var(--panel);color:var(--text);padding:10px 13px}.controls button{cursor:pointer}.controls button:hover{border-color:var(--accent)}
    .summary-strip{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}.summary-strip span{background:var(--panel);border:1px solid var(--line);border-radius:999px;padding:5px 11px;color:var(--muted);font-size:.85rem}
    .layer-section{margin:26px 0;border:1px solid var(--line);border-radius:18px;background:var(--panel);box-shadow:var(--shadow);overflow:hidden;scroll-margin-top:20px}.layer-section[hidden]{display:none}.layer-heading{display:grid;grid-template-columns:auto 1fr;gap:16px;padding:24px 28px;background:linear-gradient(135deg,var(--panel-2),var(--accent-soft));align-items:start}.layer-heading h2{margin:0;font-size:1.7rem}.layer-heading p{margin:5px 0 0;color:var(--muted);max-width:78ch}.step-badge{display:grid;place-items:center;width:46px;height:46px;border-radius:13px;background:var(--accent);color:var(--panel);font-weight:800}.layer-body{padding:10px clamp(20px,4vw,44px) 42px}.layer-body>h2{font-size:1.35rem;margin-top:2.2em;border-bottom:1px solid var(--line);padding-bottom:.35em}.layer-body>h3{font-size:1.1rem;margin-top:1.8em}.layer-body p,.layer-body li{max-width:88ch}.layer-body details{margin:16px 0;border:1px solid var(--line);border-radius:12px;padding:0 16px}.layer-body details>summary{cursor:pointer;font-weight:750;padding:14px 0}.evidence-block{margin-top:30px!important;border-color:color-mix(in srgb,var(--accent) 45%,var(--line))!important;background:color-mix(in srgb,var(--accent-soft) 38%,var(--panel))}.evidence-block>summary{display:flex;flex-direction:column;gap:2px}.evidence-block>summary small{font-weight:400;color:var(--muted)}.evidence-block>div{padding-bottom:18px}.adapter-block+ .adapter-block{border-top:1px solid var(--line);margin-top:30px;padding-top:12px}.review-section{background:color-mix(in srgb,var(--panel) 92%,var(--panel-2))}blockquote{border-left:4px solid var(--accent);margin:1.4em 0;padding:.5em 1em;background:var(--accent-soft)}
    code{font-family:"Cascadia Code",Consolas,monospace;font-size:.9em;background:var(--panel-2);padding:.14em .35em;border-radius:5px;overflow-wrap:anywhere}pre{overflow:auto;background:var(--code);color:#eef7f1;padding:18px;border-radius:11px}pre code{background:none;padding:0;color:inherit}.table-wrap{overflow:auto;margin:1.2em 0;border:1px solid var(--line);border-radius:10px;overscroll-behavior-inline:contain;scrollbar-gutter:stable}table{border-collapse:collapse;width:100%;min-width:680px;font-size:.9rem}th,td{text-align:left;vertical-align:top;padding:10px 12px;border-bottom:1px solid var(--line);overflow-wrap:break-word;word-break:normal}th{position:sticky;top:0;background:var(--panel-2);color:var(--text)}tbody tr:last-child td{border-bottom:0}.wide-table-wrap{box-shadow:inset -16px 0 18px -20px rgba(0,0,0,.45)}.wide-data-table{width:100%;min-width:1420px;table-layout:auto}.wide-data-table th:nth-child(1),.wide-data-table td:nth-child(1){min-width:46px;width:46px;white-space:nowrap}.wide-data-table th:nth-child(2),.wide-data-table td:nth-child(2){min-width:190px}.wide-data-table th:nth-child(3),.wide-data-table td:nth-child(3){min-width:270px}.wide-data-table th:nth-child(4),.wide-data-table td:nth-child(4),.wide-data-table th:nth-child(5),.wide-data-table td:nth-child(5),.wide-data-table th:nth-child(6),.wide-data-table td:nth-child(6),.wide-data-table th:nth-child(9),.wide-data-table td:nth-child(9),.wide-data-table th:nth-child(10),.wide-data-table td:nth-child(10){min-width:86px;white-space:nowrap}.wide-data-table th:nth-child(7),.wide-data-table td:nth-child(7){min-width:205px;white-space:nowrap}.wide-data-table th:nth-child(8),.wide-data-table td:nth-child(8){min-width:260px}
    .metrics{display:flex;gap:12px;flex-wrap:wrap}.metric{display:grid;min-width:150px;padding:14px 16px;background:var(--accent-soft);border-radius:12px}.metric strong{font-size:1.5rem}.metric span{color:var(--muted);font-size:.85rem}.context-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}.context-grid div{padding:12px;background:var(--panel-2);border-radius:9px}.context-grid dt{font-size:.78rem;color:var(--muted)}.context-grid dd{margin:2px 0 0;overflow-wrap:anywhere}.status{display:inline-block;padding:2px 8px;border-radius:999px;background:var(--panel-2)}.status.passed{background:#d9efdf;color:#165b31}.notice.error{padding:12px;border-radius:9px;background:#f9dddd;color:#7c1e1e}.empty{display:none;padding:30px;text-align:center;color:var(--muted)}.empty.visible{display:block}
    .dictionary-controls{display:grid;grid-template-columns:minmax(260px,1fr) repeat(2,minmax(150px,max-content));gap:9px;align-items:center;margin:18px 0}.dictionary-controls input[type="search"],.dictionary-controls select,.dictionary-controls button,.dictionary-data-actions button{min-width:0;border:1px solid var(--line);border-radius:9px;background:var(--panel);color:var(--text);padding:8px 11px;font:inherit}.dictionary-controls button,.dictionary-data-actions button{cursor:pointer;white-space:nowrap}.dictionary-controls button[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:var(--panel)}.dictionary-controls label{display:flex;align-items:center;gap:5px;padding:7px 9px;border:1px solid var(--line);border-radius:9px;white-space:nowrap}.dictionary-results{display:grid;gap:18px}.dictionary-group{border:1px solid var(--line);border-radius:14px;overflow:hidden}.dictionary-group>header{padding:15px 18px;background:var(--panel-2)}.dictionary-group>header h3{margin:0}.dictionary-group>header p{margin:4px 0 0;color:var(--muted)}.dictionary-group-body{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr));gap:14px;padding:16px}.dictionary-card{border:1px solid var(--line);border-radius:11px;background:var(--panel);padding:0 16px;min-width:0}.dictionary-card summary{cursor:pointer;padding:15px 0;font-weight:750;overflow-wrap:normal;word-break:keep-all}.dictionary-card-body{padding:0 0 17px}.dictionary-card p{margin:.65em 0;line-height:1.75}.dictionary-meta{color:var(--muted);font-size:.83rem}.dictionary-statline{display:flex;flex-wrap:wrap;gap:7px;margin:11px 0}.dictionary-statline span,.type-tag,.signal-tag{display:inline-block;border-radius:999px;padding:4px 9px;background:var(--accent-soft);font-size:.79rem}.word-list{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.word-chip{border:1px solid var(--line);border-radius:999px;background:var(--panel-2);color:var(--text);padding:5px 10px;cursor:pointer;white-space:nowrap}.word-chip[data-overlap="true"]{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}.word-chip small{color:var(--muted)}.word-card{border:1px solid var(--line);border-radius:11px;padding:18px;min-width:0}.word-card h3{margin:0 0 8px}.word-card p{margin:.6em 0;line-height:1.75}.word-types{display:flex;flex-wrap:wrap;gap:7px}.dictionary-data-region textarea{width:100%;min-height:440px;resize:vertical;border:1px solid var(--line);border-radius:9px;background:var(--code);color:#eef7f1;padding:14px;font:13px/1.55 "Cascadia Code",Consolas,monospace}.dictionary-data-actions{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.vocabulary-empty.visible{display:block}.vocabulary-dictionary mark{background:#ffe69a;color:#2e260c;border-radius:3px;padding:0 .08em}
    @media(max-width:1050px){.dictionary-controls{grid-template-columns:1fr 1fr}.dictionary-controls input[type="search"]{grid-column:1/-1}}
    @media(max-width:900px){.layout{display:block}aside{position:relative;height:auto;border-right:0;border-bottom:1px solid var(--line)}.layer-nav{grid-template-columns:1fr 1fr}.layer-nav a{background:var(--panel)}main{padding-top:28px}.controls{grid-template-columns:1fr 1fr}.controls input{grid-column:1/-1}.dictionary-group-body{grid-template-columns:1fr}}
    @media(max-width:620px){.dictionary-controls{grid-template-columns:1fr}.dictionary-controls input[type="search"]{grid-column:auto}.dictionary-controls>*{width:100%}.controls{grid-template-columns:1fr}.controls input{grid-column:auto}.hero{padding:24px}.hero h1{font-size:2rem}.layer-body{padding-inline:16px}.dictionary-group-body{padding:10px}.dictionary-card{padding-inline:13px}}
    @media print{aside,.controls{display:none}.layout{display:block}main{width:100%;padding:0}.hero,.layer-section{box-shadow:none}.layer-section[hidden]{display:block}body{background:#fff;color:#111}a{color:#111}.empty{display:none!important}}
    ${LANGUAGE_STYLE_READER_CSS}
  </style>
</head>
<body class="target-style-guide">
<a class="skip-link" href="#main-content">${escapeHtml(labels.skipToContent)}</a>
<div class="layout">
  <aside aria-label="${escapeHtml(labels.pageNavigation)}">
    <div class="eyebrow">${escapeHtml(labels.generatedView)}</div>
    <h1>${escapeHtml(title)}</h1>
    <nav class="layer-nav" aria-label="${escapeHtml(labels.pageNavigation)}">${navigation}</nav>
  </aside>
  <main id="main-content" tabindex="-1">
    <header class="hero">
      <div class="eyebrow">${escapeHtml(labels.generatedView)}</div>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(labels.overviewSummary)}</p>
      <p class="standard-notice">${escapeHtml(labels.standardNotice)} <a href="${DEFAULT_STANDARD_URL}">${escapeHtml(labels.standardLink)}</a></p>
      <div class="summary-strip"><span>${escapeHtml(labels.lexicalLayer)}</span><span>${escapeHtml(labels.sentenceLayer)}</span><span>${escapeHtml(labels.paragraphLayer)}</span><span>${escapeHtml(labels.compositionLayer)}</span></div>
    </header>
    <div class="controls" role="search" aria-label="document controls">
      <label class="sr-only" for="search">${escapeHtml(labels.search)}</label>
      <input id="search" type="search" placeholder="${escapeHtml(labels.search)}" autocomplete="off">
      <button type="button" data-action="expand">${escapeHtml(labels.expand)}</button>
      <button type="button" data-action="collapse">${escapeHtml(labels.collapse)}</button>
      <button type="button" data-action="print">${escapeHtml(labels.print)}</button>
      <button type="button" data-action="theme">${escapeHtml(labels.theme)}</button>
    </div>
    <div id="empty" class="empty">${escapeHtml(labels.noResults)}</div>
    ${readableSections}
    ${reviewSection}
  </main>
</div>
<script>
  ${LANGUAGE_STYLE_READER_BEHAVIOR}
  const root = document.documentElement;
  const panels = [...document.querySelectorAll('[data-searchable]')];
  const search = document.getElementById('search');
  const storedTheme = localStorage.getItem('language-style-guide-theme');
  if (storedTheme) root.dataset.theme = storedTheme;
  search.addEventListener('input', () => {
    const query = search.value.trim().toLocaleLowerCase();
    let visible = 0;
    for (const panel of panels) {
      const match = !query || panel.textContent.toLocaleLowerCase().includes(query);
      panel.hidden = !match;
      if (match) { visible += 1; if (query) panel.open = true; }
    }
    document.getElementById('empty').classList.toggle('visible', visible === 0);
  });
  document.querySelector('[data-action="expand"]').addEventListener('click', () => document.querySelectorAll('details').forEach(panel => panel.open = true));
  document.querySelector('[data-action="collapse"]').addEventListener('click', () => document.querySelectorAll('details').forEach(panel => panel.open = false));
  document.querySelector('[data-action="print"]').addEventListener('click', () => window.print());
  document.querySelector('[data-action="theme"]').addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('language-style-guide-theme', root.dataset.theme);
  });
  const dictionaryRoot = document.querySelector('[data-vocabulary-dictionary]');
  if (dictionaryRoot) {
    const embeddedData = document.getElementById('vocabularyDictionaryData');
    const searchInput = dictionaryRoot.querySelector('[data-vocabulary-search]');
    const groupSelect = dictionaryRoot.querySelector('[data-vocabulary-group]');
    const levelSelect = dictionaryRoot.querySelector('[data-vocabulary-level]');
    const sortSelect = dictionaryRoot.querySelector('[data-vocabulary-sort]');
    const overlapInput = dictionaryRoot.querySelector('[data-vocabulary-overlap]');
    const results = dictionaryRoot.querySelector('[data-vocabulary-results]');
    const empty = dictionaryRoot.querySelector('[data-vocabulary-empty]');
    const metrics = dictionaryRoot.querySelector('[data-vocabulary-metrics]');
    const editor = dictionaryRoot.querySelector('[data-vocabulary-json]');
    const errorBox = dictionaryRoot.querySelector('[data-vocabulary-error]');
    const fileInput = dictionaryRoot.querySelector('[data-vocabulary-file]');
    const builtInText = embeddedData.textContent.trim();
    let dictionaryData = JSON.parse(builtInText);
    let dictionaryView = 'words';
    const dictionaryChinese = dictionaryData.language !== 'en';
    const dictionaryUi = dictionaryChinese
      ? { groups: '大类', types: '类型', entries: '类型内词条', words: '去重词条', overlaps: '多重归类词', core: '核心', extended: '扩展', styleEffect: '文风作用：', usage: '使用：', caution: '注意：', example: '同一句变化：', count: '次数 ', per10k: '每万字 ', coverage: '覆盖 ', position: '位置：', combinations: '常见组合：', variation: '变化范围：', control: '同场景对照：', opening: '句首', middle: '句中', ending: '句尾', total: '合计 ', times: ' 次', overlap: ' · 多重归类', invalid: 'JSON 必须包含 groups 和 types 数组；也兼容 categories 作为类型数组。', jsonName: '文风词汇类型字典.json', htmlName: '语言风格_词汇字典数据版.html' }
      : { groups: 'Groups', types: 'Types', entries: 'Type entries', words: 'Unique terms', overlaps: 'Overlapping terms', core: 'Core', extended: 'Extended', styleEffect: 'Style effect: ', usage: 'Usage: ', caution: 'Caution: ', example: 'Same-sentence variation: ', count: 'Count ', per10k: 'Per 10k ', coverage: 'Coverage ', position: 'Position: ', combinations: 'Combinations: ', variation: 'Variation: ', control: 'Matched control: ', opening: 'Opening', middle: 'Middle', ending: 'Ending', total: 'Total ', times: ' occurrences', overlap: ' · overlapping', invalid: 'JSON must contain groups and types arrays; categories is also accepted as the type array.', jsonName: 'language-style-vocabulary-dictionary.json', htmlName: 'language-style-vocabulary-data.html' };
    const escapeText = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    const normalize = value => String(value ?? '').toLocaleLowerCase();
    const downloadBlob = (contents, fileName, type) => {
      const url = URL.createObjectURL(new Blob([contents], { type }));
      const link = document.createElement('a');
      link.href = url; link.download = fileName; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    const refreshGroupOptions = () => {
      const selected = groupSelect.value;
      groupSelect.querySelectorAll('option:not(:first-child)').forEach(option => option.remove());
      for (const group of dictionaryData.groups ?? []) {
        const option = document.createElement('option'); option.value = group.id; option.textContent = group.name; groupSelect.append(option);
      }
      if ([...groupSelect.options].some(option => option.value === selected)) groupSelect.value = selected;
    };
    const wordIndex = () => {
      const index = new Map();
      for (const type of dictionaryData.types ?? []) for (const entry of type.words ?? []) {
        const word = typeof entry === 'string' ? entry : entry.word;
        const count = typeof entry === 'string' ? 0 : Number(entry.count ?? 0);
        const coverageRatio = typeof entry === 'string' ? null : entry.coverageRatio;
        if (!index.has(word)) index.set(word, { word, types: [], totalCount: 0, hitRate: null });
        const record = index.get(word); record.types.push({ id: type.id, name: type.name, group: type.groupName, effect: type.effect, caution: type.caution, count, coverageRatio }); record.totalCount += count;
        if (typeof coverageRatio === 'number') record.hitRate = Math.max(Number(record.hitRate ?? 0), coverageRatio);
      }
      return [...index.values()].filter(record => record.totalCount > 0).map(record => ({ ...record, overlap: record.types.length > 1, description: dictionaryChinese ? '“' + record.word + '”属于' + record.types.map(item => '“' + item.name + '”').join('、') + '；目标语料候选扫描合计命中 ' + record.totalCount + ' 次。具体功能仍需结合上下文判断。' : '“' + record.word + '” belongs to ' + record.types.map(item => '“' + item.name + '”').join(', ') + '; the target-corpus candidate scan found ' + record.totalCount + ' occurrences in total. Its function still depends on context.' }));
    };
    const typeHitRate = type => typeof type.frequency?.coverageRatio === 'number' ? type.frequency.coverageRatio : -1;
    const typeCount = type => Number(type.frequency?.count ?? 0);
    const sortTypes = types => [...types].sort((left,right) => sortSelect.value === 'name' ? left.name.localeCompare(right.name, dictionaryChinese ? 'zh-CN' : 'en') : sortSelect.value === 'count' ? typeCount(right)-typeCount(left)||typeHitRate(right)-typeHitRate(left) : typeHitRate(right)-typeHitRate(left)||typeCount(right)-typeCount(left));
    const sortWords = words => [...words].sort((left,right) => sortSelect.value === 'name' ? left.word.localeCompare(right.word, dictionaryChinese ? 'zh-CN' : 'en') : sortSelect.value === 'count' ? right.totalCount-left.totalCount||Number(right.hitRate??-1)-Number(left.hitRate??-1) : Number(right.hitRate??-1)-Number(left.hitRate??-1)||right.totalCount-left.totalCount);
    const typeSearchText = type => normalize([type.name, type.groupName, type.definition, type.effect, type.usage, type.caution, type.example, ...(type.signals ?? []), ...(type.words ?? []).map(entry => typeof entry === 'string' ? entry : entry.word)].join(' '));
    const renderMetrics = () => {
      const words = wordIndex();
      const stats = { groups: (dictionaryData.groups ?? []).length, types: (dictionaryData.types ?? []).length, entries: (dictionaryData.types ?? []).reduce((sum, type) => sum + (type.words ?? []).length, 0), words: words.length, overlaps: words.filter(word => word.overlap).length };
      metrics.innerHTML = [[dictionaryUi.groups, stats.groups], [dictionaryUi.types, stats.types], [dictionaryUi.entries, stats.entries], [dictionaryUi.words, stats.words], [dictionaryUi.overlaps, stats.overlaps]].map(([label, value]) => '<div class="metric"><strong>' + value + '</strong><span>' + label + '</span></div>').join('');
    };
    const renderTypes = (query, group, level, overlapOnly) => {
      const exactWords = new Set(wordIndex().filter(word => normalize(word.word) === query).map(word => word.word));
      const filtered = (dictionaryData.types ?? []).filter(type => {
        if (typeHitRate(type) < 0.01) return false;
        if (group && type.group !== group) return false;
        if (level === 'core' && !type.core) return false;
        if (level === 'extended' && type.core) return false;
        if (overlapOnly && !(type.words ?? []).some(entry => wordIndex().find(word => word.word === (typeof entry === 'string' ? entry : entry.word))?.overlap)) return false;
        if (!query) return true;
        if (exactWords.size) return (type.words ?? []).some(entry => exactWords.has(typeof entry === 'string' ? entry : entry.word));
        return typeSearchText(type).includes(query);
      });
      const groups = new Map();
      for (const type of sortTypes(filtered)) { if (!groups.has(type.group)) groups.set(type.group, []); groups.get(type.group).push(type); }
      results.innerHTML = [...groups.entries()].map(([groupId, types]) => {
        const groupData = (dictionaryData.groups ?? []).find(item => item.id === groupId) ?? { name: types[0]?.groupName ?? groupId };
        const cards = types.map(type => {
          const words = (type.words ?? []).filter(entry => !query || !exactWords.size || exactWords.has(typeof entry === 'string' ? entry : entry.word));
          const chips = words.map(entry => { const word = typeof entry === 'string' ? entry : entry.word; const count = typeof entry === 'string' ? null : entry.count; const overlap = wordIndex().find(item => item.word === word)?.overlap; return '<button type="button" class="word-chip" data-word="' + escapeText(word) + '" data-overlap="' + Boolean(overlap) + '">' + escapeText(word) + (count == null ? '' : ' <small>' + count + '</small>') + '</button>'; }).join('');
          const frequency = type.frequency ?? {};
          const stats = [dictionaryUi.count + (frequency.count ?? '—'), dictionaryUi.per10k + (frequency.per10kCharacters ?? '—'), dictionaryUi.coverage + (typeof frequency.coverageRatio === 'number' ? (frequency.coverageRatio * 100).toFixed(1) + '%' : '—')];
          const positions = Object.entries(type.position ?? {}).map(([key, value]) => ({ opening: dictionaryUi.opening, middle: dictionaryUi.middle, ending: dictionaryUi.ending }[key] ?? key) + ' ' + value).join(' · ') || '—';
          const combinations = (type.combinations ?? []).slice(0, 6).map(item => (item.name ?? item.patternId ?? item.id) + (item.count ? '（' + item.count + '）' : '')).join('、') || '—';
          const variation = (type.variation ?? []).map(item => (item.context ?? '场景') + ' ' + (item.per10kCharacters ?? item.standardized ?? item.count ?? '—')).join('；') || '—';
          const control = type.control?.rateRatio ?? type.control?.count ?? '—';
          const headline = dictionaryUi.count + Number(frequency.count ?? 0) + ' · ' + dictionaryUi.coverage + (typeof frequency.coverageRatio === 'number' ? (frequency.coverageRatio * 100).toFixed(1) + '%' : '—');
          return '<article class="dictionary-card word-card"><h3>' + escapeText(type.name) + ' <span class="dictionary-meta observed-headline">' + escapeText(headline) + '</span></h3><div class="dictionary-card-body"><p class="dictionary-meta">' + (type.core ? dictionaryUi.core : dictionaryUi.extended) + ' · ' + escapeText(type.status ?? '—') + '</p><p>' + escapeText(type.definition) + '</p><p><strong>' + dictionaryUi.styleEffect + '</strong>' + escapeText(type.effect) + '</p><p><strong>' + dictionaryUi.usage + '</strong>' + escapeText(type.usage) + '</p><p><strong>' + dictionaryUi.caution + '</strong>' + escapeText(type.caution) + '</p><p><strong>' + dictionaryUi.example + '</strong>' + escapeText(type.example) + '</p><div class="dictionary-statline">' + stats.map(stat => '<span>' + escapeText(stat) + '</span>').join('') + '</div><p><strong>' + dictionaryUi.position + '</strong>' + escapeText(positions) + '</p><p><strong>' + dictionaryUi.combinations + '</strong>' + escapeText(combinations) + '</p><p><strong>' + dictionaryUi.variation + '</strong>' + escapeText(variation) + '</p><p><strong>' + dictionaryUi.control + '</strong>' + escapeText(control) + '</p><div class="word-list">' + chips + '</div><div>' + (type.signals ?? []).map(signal => '<span class="signal-tag">' + escapeText(signal) + '</span>').join(' ') + '</div></div></article>';
        }).join('');
        return '<section class="dictionary-group"><header><h3>' + escapeText(groupData.name) + '</h3><p>' + escapeText(groupData.definition ?? '') + '</p></header><div class="dictionary-group-body">' + cards + '</div></section>';
      }).join('');
      return filtered.length;
    };
    const renderWords = (query, group, level, overlapOnly) => {
      const typesById = new Map((dictionaryData.types ?? []).map(type => [type.id, type]));
      const allWords = wordIndex();
      const exactMatch = allWords.some(word => normalize(word.word) === query);
      const filtered = sortWords(allWords.filter(word => {
        if (Number(word.hitRate ?? -1) < 0.01) return false;
        const matchingTypes = word.types.filter(ref => { const type = typesById.get(ref.id); return type && (!group || type.group === group) && (!level || (level === 'core' ? type.core : !type.core)); });
        if (!matchingTypes.length || (overlapOnly && !word.overlap)) return false;
        if (!query) return true;
        if (exactMatch) return normalize(word.word) === query;
        return normalize([word.word, word.description, ...matchingTypes.flatMap(type => [type.name, type.group, type.effect, type.caution])].join(' ')).includes(query);
      }));
      results.innerHTML = filtered.map(word => '<article class="word-card"><h3>' + escapeText(word.word) + ' <span class="dictionary-meta observed-headline">' + dictionaryUi.count + Number(word.totalCount ?? 0) + ' · ' + dictionaryUi.coverage + (typeof word.hitRate === 'number' ? (word.hitRate * 100).toFixed(1) + '%' : '—') + '</span></h3><p>' + escapeText(word.description ?? '') + '</p>' + (word.overlap ? '<p class="dictionary-meta">' + dictionaryUi.overlap + '</p>' : '') + '<div class="word-types">' + word.types.map(type => '<button type="button" class="type-tag" data-type="' + escapeText(type.id) + '">' + escapeText(type.group + '／' + type.name) + '</button>').join('') + '</div></article>').join('');
      return filtered.length;
    };
    const renderDictionary = () => {
      const query = normalize(searchInput.value.trim());
      const count = dictionaryView === 'types' ? renderTypes(query, groupSelect.value, levelSelect.value, overlapInput.checked) : renderWords(query, groupSelect.value, levelSelect.value, overlapInput.checked);
      empty.classList.toggle('visible', count === 0);
      dictionaryRoot.querySelectorAll('[data-vocabulary-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.vocabularyView === dictionaryView)));
      renderMetrics();
    };
    const applyDictionaryText = text => {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed.types) && Array.isArray(parsed.categories)) parsed.types = parsed.categories;
      if (!Array.isArray(parsed.groups) || !Array.isArray(parsed.types)) throw new Error(dictionaryUi.invalid);
      dictionaryData = parsed;
      dictionaryData.types = dictionaryData.types.filter(type => type.frequency?.count == null || type.frequency.count > 0).map(type => ({ ...type, words: (type.words ?? []).filter(entry => typeof entry === 'string' || Number(entry.count ?? 0) > 0) })).filter(type => (type.words ?? []).length > 0 || Number(type.frequency?.count ?? 0) > 0);
      const rebuiltWords = sortWords(wordIndex());
      dictionaryData.words = rebuiltWords;
      dictionaryData.keyWordNotes = rebuiltWords.slice(0, 50).map(word => ({ word: word.word, description: word.description }));
      dictionaryData.sourceStatistics = { ...(dictionaryData.sourceStatistics ?? {}), candidateTypes: dictionaryData.types.length, rawEntries: dictionaryData.types.reduce((sum, type) => sum + (type.words ?? []).length, 0), uniqueWords: rebuiltWords.length, overlapWords: rebuiltWords.filter(word => word.overlap).length, keyWordNotes: Math.min(50, rebuiltWords.length) };
      embeddedData.textContent = JSON.stringify(dictionaryData); editor.value = JSON.stringify(dictionaryData, null, 2); errorBox.hidden = true; refreshGroupOptions(); renderDictionary();
    };
    editor.value = JSON.stringify(dictionaryData, null, 2); refreshGroupOptions(); renderDictionary();
    searchInput.addEventListener('input', renderDictionary); groupSelect.addEventListener('change', renderDictionary); levelSelect.addEventListener('change', renderDictionary); sortSelect.addEventListener('change', renderDictionary); overlapInput.addEventListener('change', renderDictionary);
    dictionaryRoot.querySelectorAll('[data-vocabulary-view]').forEach(button => button.addEventListener('click', () => { dictionaryView = button.dataset.vocabularyView; renderDictionary(); }));
    results.addEventListener('click', event => { const wordButton = event.target.closest('[data-word]'); if (wordButton) { searchInput.value = wordButton.dataset.word; dictionaryView = 'words'; renderDictionary(); return; } const typeButton = event.target.closest('[data-type]'); if (typeButton) { const type = (dictionaryData.types ?? []).find(item => item.id === typeButton.dataset.type); if (type) { searchInput.value = type.name; dictionaryView = 'types'; renderDictionary(); } } });
    dictionaryRoot.querySelector('[data-vocabulary-expand]').addEventListener('click', () => dictionaryRoot.querySelectorAll('.dictionary-card').forEach(card => card.open = true));
    dictionaryRoot.querySelector('[data-vocabulary-collapse]').addEventListener('click', () => dictionaryRoot.querySelectorAll('.dictionary-card').forEach(card => card.open = false));
    dictionaryRoot.querySelector('[data-vocabulary-copy-result]').addEventListener('click', () => navigator.clipboard.writeText(results.innerText));
    dictionaryRoot.querySelector('[data-vocabulary-apply]').addEventListener('click', () => { try { applyDictionaryText(editor.value); } catch (error) { errorBox.textContent = error.message; errorBox.hidden = false; } });
    dictionaryRoot.querySelector('[data-vocabulary-reset]').addEventListener('click', () => applyDictionaryText(builtInText));
    dictionaryRoot.querySelector('[data-vocabulary-copy-json]').addEventListener('click', () => navigator.clipboard.writeText(editor.value));
    dictionaryRoot.querySelector('[data-vocabulary-import]').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => { const file = fileInput.files?.[0]; if (!file) return; try { applyDictionaryText(await file.text()); } catch (error) { errorBox.textContent = error.message; errorBox.hidden = false; } finally { fileInput.value = ''; } });
    dictionaryRoot.querySelector('[data-vocabulary-export]').addEventListener('click', () => downloadBlob(editor.value, dictionaryUi.jsonName, 'application/json;charset=utf-8'));
    dictionaryRoot.querySelector('[data-vocabulary-download-html]').addEventListener('click', () => { const clone = document.documentElement.cloneNode(true); const dataNode = clone.querySelector('#vocabularyDictionaryData'); if (dataNode) dataNode.textContent = JSON.stringify(dictionaryData); downloadBlob('<!doctype html>\\n' + clone.outerHTML, dictionaryUi.htmlName, 'text/html;charset=utf-8'); });
  }
  const sentenceRoot = document.querySelector('[data-sentence-dictionary]');
  if (sentenceRoot) {
    const embeddedData = document.getElementById('sentenceDictionaryData');
    const builtInText = embeddedData.textContent;
    let sentenceData = JSON.parse(builtInText);
    let sentenceView = 'patterns';
    const chinese = sentenceData.language !== 'en';
    const ui = chinese
      ? { axes: '分类轴', types: '句式类型', patterns: '通用模板', extensions: '目标扩展', mapped: '已映射目标参数', mappedPatterns: '已映射模板 ', measuredPatterns: '已计数模板 ', count: '合计次数 ', definition: '客观定义：', criteria: '识别条件：', linked: '具体模板：', template: '结构模板：', relation: '表达关系：', markers: '形式标记：', example: '示例：', measurement: '目标统计：', noMeasurement: '尚未映射目标统计；不能解释为零次。', validation: '验证：', invalid: 'JSON 必须包含 sentenceTypeAxes、sentenceTypes、sentenceGroups 和 sentencePatterns 数组。', jsonName: '文风句式类型字典.json', htmlName: '语言风格_句式字典数据版.html' }
      : { axes: 'Axes', types: 'Sentence types', patterns: 'Shared patterns', extensions: 'Target extensions', mapped: 'Mapped target parameters', mappedPatterns: 'Mapped patterns ', measuredPatterns: 'Measured patterns ', count: 'Total count ', definition: 'Definition: ', criteria: 'Criteria: ', linked: 'Concrete patterns: ', template: 'Template: ', relation: 'Relation: ', markers: 'Markers: ', example: 'Example: ', measurement: 'Target measurement: ', noMeasurement: 'No target measurement is mapped; this does not mean zero occurrences.', validation: 'Validation: ', invalid: 'JSON must contain sentenceTypeAxes, sentenceTypes, sentenceGroups, and sentencePatterns arrays.', jsonName: 'language-style-sentence-dictionary.json', htmlName: 'language-style-sentence-data.html' };
    const escapeText = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    const normalize = value => String(value ?? '').toLocaleLowerCase();
    const searchInput = sentenceRoot.querySelector('[data-sentence-search]');
    const groupSelect = sentenceRoot.querySelector('[data-sentence-group]');
    const sortSelect = sentenceRoot.querySelector('[data-sentence-sort]');
    const measuredInput = sentenceRoot.querySelector('[data-sentence-measured]');
    const metrics = sentenceRoot.querySelector('[data-sentence-metrics]');
    const results = sentenceRoot.querySelector('[data-sentence-results]');
    const empty = sentenceRoot.querySelector('[data-sentence-empty]');
    const editor = sentenceRoot.querySelector('[data-sentence-json]');
    const fileInput = sentenceRoot.querySelector('[data-sentence-file]');
    const errorBox = sentenceRoot.querySelector('[data-sentence-error]');
    const downloadBlob = (contents, fileName, type) => { const url = URL.createObjectURL(new Blob([contents], { type })); const link = document.createElement('a'); link.href = url; link.download = fileName; link.click(); setTimeout(() => URL.revokeObjectURL(url), 0); };
    const groupCollections = () => sentenceView === 'types' ? sentenceData.sentenceTypeAxes ?? [] : sentenceData.sentenceGroups ?? [];
    const refreshGroups = () => { const selected = groupSelect.value; groupSelect.querySelectorAll('option:not(:first-child)').forEach(option => option.remove()); for (const group of groupCollections()) { const option = document.createElement('option'); option.value = group.id; option.textContent = group.name; groupSelect.append(option); } if ([...groupSelect.options].some(option => option.value === selected)) groupSelect.value = selected; };
    const renderMetrics = () => { const stats = sentenceData.sourceStatistics ?? {}; metrics.innerHTML = [[ui.axes, (sentenceData.sentenceTypeAxes ?? []).length], [ui.types, (sentenceData.sentenceTypes ?? []).length], [ui.patterns, stats.patterns ?? (sentenceData.sentencePatterns ?? []).filter(item => item.origin !== 'target_extension').length], [ui.extensions, stats.targetExtensions ?? (sentenceData.sentencePatterns ?? []).filter(item => item.origin === 'target_extension').length], [ui.mapped, stats.mappedTargetPatterns ?? Object.keys(sentenceData.patternMeasurements ?? {}).length]].map(([label,value]) => '<div class="metric"><strong>' + value + '</strong><span>' + label + '</span></div>').join(''); };
    const measurementText = measurement => { if (!measurement) return ui.noMeasurement; const frequency = measurement.frequency ?? {}; const count = typeof frequency.count === 'number' ? frequency.count : '—'; const per100 = typeof frequency.per100Sentences === 'number' ? frequency.per100Sentences : '—'; const coverage = typeof frequency.coverageRatio === 'number' ? (frequency.coverageRatio * 100).toFixed(1) + '%' : '—'; return ui.count + count + ' · 每百句 ' + per100 + ' · 覆盖 ' + coverage; };
    const measurementScore = measurement => ({ hit: Number(measurement?.frequency?.coverageRatio ?? -1), count: Number(measurement?.frequency?.count ?? -1) });
    const typeScore = type => { const linked = (type.patternIds ?? []).map(id => sentenceData.patternMeasurements?.[id]).filter(item => Number(item?.frequency?.count ?? 0) > 0); return { hit: Math.max(-1,...linked.map(item => Number(item.frequency.coverageRatio ?? -1))), count: linked.reduce((sum,item)=>sum+Number(item.frequency.count??0),0) }; };
    const sortItems = (items, score, name) => [...items].sort((left,right) => sortSelect.value === 'name' ? name(left).localeCompare(name(right), chinese ? 'zh-CN' : 'en') : sortSelect.value === 'count' ? score(right).count-score(left).count||score(right).hit-score(left).hit : score(right).hit-score(left).hit||score(right).count-score(left).count);
    const renderTypes = query => {
      const group = groupSelect.value; const measuredOnly = measuredInput.checked; const patternsById = new Map((sentenceData.sentencePatterns ?? []).map(item => [item.id, item]));
      const filtered = sortItems((sentenceData.sentenceTypes ?? []).filter(type => { const score = typeScore(type); const text = normalize([type.name,type.definition,type.criteria,type.example,...(type.patternIds ?? []).map(id => patternsById.get(id)?.name ?? id)].join(' ')); return score.count > 0 && score.hit >= 0.01 && (!group || type.group === group) && (!measuredOnly || score.count > 0) && (!query || text.includes(query)); }), typeScore, type => type.name);
      const groups = groupCollections().filter(axis => filtered.some(type => type.group === axis.id));
      results.innerHTML = groups.map(axis => { const cards = filtered.filter(type => type.group === axis.id).map(type => { const aggregate = sentenceData.typeMeasurements?.[type.id] ?? {}; const score = typeScore(type); const coverage = score.hit >= 0 ? (score.hit * 100).toFixed(1) + '%' : '—'; const links = (type.patternIds ?? []).map(id => patternsById.get(id)).filter(Boolean).map(pattern => '<button type="button" class="type-tag" data-sentence-pattern="' + escapeText(pattern.id) + '">' + escapeText(pattern.name) + '</button>').join(''); const example = Array.isArray(type.example) ? type.example.join(' → ') : type.example; return '<article class="dictionary-card word-card"><h3>' + escapeText(type.name) + ' <span class="dictionary-meta observed-headline">' + (chinese ? '命中 ' : 'Count ') + score.count + ' · ' + (chinese ? '覆盖 ' : 'Coverage ') + coverage + '</span></h3><p><strong>' + ui.definition + '</strong>' + escapeText(type.definition) + '</p><p><strong>' + ui.criteria + '</strong>' + escapeText(type.criteria) + '</p><div class="dictionary-statline"><span>' + ui.mappedPatterns + Number(aggregate.mappedPatterns ?? 0) + '</span><span>' + ui.measuredPatterns + Number(aggregate.measuredPatterns ?? 0) + '</span><span>' + ui.count + Number(aggregate.countSum ?? 0) + '</span></div><p><strong>' + ui.example + '</strong>' + escapeText(example ?? '—') + '</p><p><strong>' + ui.linked + '</strong></p><div class="word-types">' + links + '</div></article>'; }).join(''); return '<section class="dictionary-group"><header><h3>' + escapeText(axis.name) + '</h3><p>' + escapeText(axis.description ?? axis.question ?? '') + '</p></header><div class="dictionary-group-body">' + cards + '</div></section>'; }).join('');
      return filtered.length;
    };
    const renderPatterns = query => {
      const group = groupSelect.value; const measuredOnly = measuredInput.checked; const measurementMap = sentenceData.patternMeasurements ?? {};
      const filtered = sortItems((sentenceData.sentencePatterns ?? []).filter(pattern => { const measurement = measurementMap[pattern.id]; const text = normalize([pattern.name,pattern.template,pattern.relation,pattern.example,...(pattern.markers ?? []),...(pattern.variants ?? []),pattern.notes].join(' ')); return Number(measurement?.frequency?.count ?? 0) > 0 && Number(measurement?.frequency?.coverageRatio ?? -1) >= 0.01 && (!group || pattern.group === group) && (!measuredOnly || measurement) && (!query || text.includes(query)); }), pattern => measurementScore(measurementMap[pattern.id]), pattern => pattern.name);
      const groups = groupCollections().filter(item => filtered.some(pattern => pattern.group === item.id));
      results.innerHTML = groups.map(groupData => { const cards = filtered.filter(pattern => pattern.group === groupData.id).map(pattern => { const measurement = measurementMap[pattern.id]; const example = Array.isArray(pattern.example) ? pattern.example.join(' → ') : pattern.example; return '<article class="dictionary-card word-card"><h3>' + escapeText(pattern.name) + '</h3><p><strong>' + ui.template + '</strong><code>' + escapeText(pattern.template) + '</code></p><p><strong>' + ui.relation + '</strong>' + escapeText(pattern.relation) + '</p><p><strong>' + ui.markers + '</strong>' + escapeText((pattern.markers ?? []).join('、') || '—') + '</p><p><strong>' + ui.example + '</strong>' + escapeText(example ?? '—') + '</p><p><strong>' + ui.measurement + '</strong>' + escapeText(measurementText(measurement)) + '</p><p class="dictionary-meta"><strong>' + ui.validation + '</strong>' + escapeText(measurement?.validation?.status ?? measurement?.status ?? 'unmapped') + '</p></article>'; }).join(''); return '<section class="dictionary-group"><header><h3>' + escapeText(groupData.name) + '</h3><p>' + escapeText(groupData.description ?? '') + '</p></header><div class="dictionary-group-body">' + cards + '</div></section>'; }).join('');
      return filtered.length;
    };
    const render = () => { const query = normalize(searchInput.value.trim()); const count = sentenceView === 'types' ? renderTypes(query) : renderPatterns(query); empty.classList.toggle('visible', count === 0); sentenceRoot.querySelectorAll('[data-sentence-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.sentenceView === sentenceView))); renderMetrics(); };
    const applyText = text => { const parsed = JSON.parse(text); for (const key of ['sentenceTypeAxes','sentenceTypes','sentenceGroups','sentencePatterns']) if (!Array.isArray(parsed[key])) throw new Error(ui.invalid); parsed.patternMeasurements = Object.fromEntries(Object.entries(parsed.patternMeasurements ?? {}).filter(([,measurement]) => measurement?.frequency?.count == null || measurement.frequency.count > 0)); parsed.sentencePatterns = parsed.sentencePatterns.filter(pattern => pattern.origin !== 'target_extension' || Number(parsed.patternMeasurements?.[pattern.id]?.frequency?.count ?? 0) > 0); sentenceData = parsed; embeddedData.textContent = JSON.stringify(sentenceData); editor.value = JSON.stringify(sentenceData, null, 2); errorBox.hidden = true; refreshGroups(); render(); };
    editor.value = JSON.stringify(sentenceData, null, 2); refreshGroups(); render();
    searchInput.addEventListener('input', render); groupSelect.addEventListener('change', render); sortSelect.addEventListener('change', render); measuredInput.addEventListener('change', render);
    sentenceRoot.querySelectorAll('[data-sentence-view]').forEach(button => button.addEventListener('click', () => { sentenceView = button.dataset.sentenceView; groupSelect.value = ''; refreshGroups(); render(); }));
    results.addEventListener('click', event => { const button = event.target.closest('[data-sentence-pattern]'); if (!button) return; const pattern = (sentenceData.sentencePatterns ?? []).find(item => item.id === button.dataset.sentencePattern); if (!pattern) return; sentenceView = 'patterns'; groupSelect.value = ''; refreshGroups(); searchInput.value = pattern.name; render(); });
    sentenceRoot.querySelector('[data-sentence-copy-result]').addEventListener('click', () => navigator.clipboard.writeText(results.innerText));
    sentenceRoot.querySelector('[data-sentence-apply]').addEventListener('click', () => { try { applyText(editor.value); } catch (error) { errorBox.textContent = error.message; errorBox.hidden = false; } });
    sentenceRoot.querySelector('[data-sentence-reset]').addEventListener('click', () => applyText(builtInText));
    sentenceRoot.querySelector('[data-sentence-copy-json]').addEventListener('click', () => navigator.clipboard.writeText(editor.value));
    sentenceRoot.querySelector('[data-sentence-import]').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => { const file = fileInput.files?.[0]; if (!file) return; try { applyText(await file.text()); } catch (error) { errorBox.textContent = error.message; errorBox.hidden = false; } finally { fileInput.value = ''; } });
    sentenceRoot.querySelector('[data-sentence-export]').addEventListener('click', () => downloadBlob(editor.value, ui.jsonName, 'application/json;charset=utf-8'));
    sentenceRoot.querySelector('[data-sentence-download-html]').addEventListener('click', () => { const clone = document.documentElement.cloneNode(true); const dataNode = clone.querySelector('#sentenceDictionaryData'); if (dataNode) dataNode.textContent = JSON.stringify(sentenceData); downloadBlob('<!doctype html>\\n' + clone.outerHTML, ui.htmlName, 'text/html;charset=utf-8'); });
  }
  const initializeStructuralDictionary = prefix => {
    const root = document.querySelector('[data-structural-dictionary="' + prefix + '"]');
    if (!root) return;
    const embedded = document.getElementById(prefix + 'DictionaryData');
    const builtInText = embedded.textContent;
    let data = JSON.parse(builtInText);
    let view = 'patterns';
    const chinese = data.language !== 'en';
    const noun = chinese ? prefix === 'paragraph' ? '段落' : '整篇编排' : prefix;
    const escapeText = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    const normalize = value => String(value ?? '').toLocaleLowerCase();
    const query = selector => root.querySelector('[data-' + prefix + '-' + selector + ']');
    const search = query('search'); const groupSelect = query('group'); const sortSelect = query('sort'); const measured = query('measured'); const metrics = query('metrics'); const results = query('results'); const empty = query('empty'); const editor = query('json'); const fileInput = query('file'); const errorBox = query('error');
    const downloadBlob = (contents, fileName, type) => { const url = URL.createObjectURL(new Blob([contents], { type })); const link = document.createElement('a'); link.href = url; link.download = fileName; link.click(); setTimeout(() => URL.revokeObjectURL(url), 0); };
    const typeLinks = type => type[data.fieldNames?.typeLinks] ?? type.patternIds ?? type.structureIds ?? [];
    const collections = () => view === 'types' ? data.axes ?? [] : data.groups ?? [];
    const measurementScore = measurement => ({ hit: Number(measurement?.frequency?.coverageRatio ?? -1), count: Number(measurement?.frequency?.count ?? -1) });
    const typeScore = type => { const linked = typeLinks(type).map(id => measurementScore(data.measurements?.[id])); return { hit: Math.max(-1, ...linked.map(item => item.hit)), count: Number(data.typeMeasurements?.[type.id]?.countSum ?? 0) }; };
    const sortItems = (items, score, name) => [...items].sort((left,right) => sortSelect.value === 'name' ? name(left).localeCompare(name(right), chinese ? 'zh-CN' : 'en') : sortSelect.value === 'count' ? score(right).count-score(left).count||score(right).hit-score(left).hit : score(right).hit-score(left).hit||score(right).count-score(left).count);
    const refreshGroups = () => { const selected = groupSelect.value; groupSelect.querySelectorAll('option:not(:first-child)').forEach(option => option.remove()); for (const group of collections()) { const option = document.createElement('option'); option.value = group.id; option.textContent = group.name; groupSelect.append(option); } if ([...groupSelect.options].some(option => option.value === selected)) groupSelect.value = selected; };
    const renderMetrics = () => { const stats = data.sourceStatistics ?? {}; metrics.innerHTML = [[chinese ? '分类轴' : 'Axes', (data.axes ?? []).length], [chinese ? noun + '类型' : 'Types', (data.types ?? []).length], [chinese ? '通用模板' : 'Shared templates', stats.patterns ?? 0], [chinese ? '目标扩展' : 'Extensions', stats.targetExtensions ?? 0], [chinese ? '已映射目标参数' : 'Mapped target parameters', stats.mappedTargetPatterns ?? 0]].map(([label,value]) => '<div class="metric"><strong>' + value + '</strong><span>' + label + '</span></div>').join(''); };
    const measurementText = measurement => { if (!measurement) return chinese ? '尚未映射目标统计；不能解释为零次。' : 'No mapped measurement; this does not mean zero.'; const frequency = measurement.frequency ?? {}; const per100Key = data.fieldNames?.per100; const per100 = per100Key && typeof frequency[per100Key] === 'number' ? frequency[per100Key] : '—'; const coverage = typeof frequency.coverageRatio === 'number' ? (frequency.coverageRatio * 100).toFixed(1) + '%' : '—'; return (chinese ? '次数 ' : 'Count ') + (frequency.count ?? '—') + ' · ' + (chinese ? '每百单位 ' : 'Per 100 ') + per100 + ' · ' + (chinese ? '覆盖 ' : 'Coverage ') + coverage; };
    const renderTypes = text => {
      const patterns = new Map((data.patterns ?? []).map(item => [item.id, item]));
      const filtered = sortItems((data.types ?? []).filter(type => {
        const score = typeScore(type);
        const searchable = normalize([type.name,type.definition,type.criteria,JSON.stringify(type.example),...typeLinks(type).map(id => patterns.get(id)?.name ?? id)].join(' '));
        return score.count > 0 && score.hit >= 0.01 && (!groupSelect.value || type.group === groupSelect.value) && (!measured.checked || score.count > 0) && (!text || searchable.includes(text));
      }), typeScore, item => item.name);
      const groups = collections().filter(axis => filtered.some(type => type.group === axis.id));
      results.innerHTML = groups.map(axis => '<section class="dictionary-group"><header><h3>' + escapeText(axis.name) + '</h3><p>' + escapeText(axis.description ?? '') + '</p></header><div class="dictionary-group-body">' + filtered.filter(type => type.group === axis.id).map(type => {
        const aggregate = data.typeMeasurements?.[type.id] ?? {};
        const score = typeScore(type);
        const coverage = score.hit >= 0 ? (score.hit * 100).toFixed(1) + '%' : '—';
        const links = typeLinks(type).map(id => patterns.get(id)).filter(Boolean).map(pattern => '<button type="button" class="type-tag" data-structural-pattern="' + escapeText(pattern.id) + '">' + escapeText(pattern.name) + '</button>').join('');
        return '<article class="dictionary-card word-card"><h3>' + escapeText(type.name) + ' <span class="dictionary-meta observed-headline">' + (chinese ? '命中 ' : 'Count ') + score.count + ' · ' + (chinese ? '覆盖 ' : 'Coverage ') + coverage + '</span></h3><p><strong>' + (chinese ? '客观定义：' : 'Definition: ') + '</strong>' + escapeText(type.definition) + '</p><p><strong>' + (chinese ? '识别条件：' : 'Criteria: ') + '</strong>' + escapeText(type.criteria) + '</p><div class="dictionary-statline"><span>' + (chinese ? '已映射模板 ' : 'Mapped ') + Number(aggregate.mappedPatterns ?? 0) + '</span><span>' + (chinese ? '已计数模板 ' : 'Measured ') + Number(aggregate.measuredPatterns ?? 0) + '</span><span>' + (chinese ? '合计次数 ' : 'Count ') + Number(aggregate.countSum ?? 0) + '</span></div><p><strong>' + (chinese ? '示例：' : 'Example: ') + '</strong>' + escapeText(Array.isArray(type.example) ? type.example.join(' → ') : type.example ?? '—') + '</p><div class="word-types">' + links + '</div></article>';
      }).join('') + '</div></section>').join('');
      return filtered.length;
    };
    const renderPatterns = text => {
      const filtered = sortItems((data.patterns ?? []).filter(pattern => {
        const measurement = data.measurements?.[pattern.id];
        const searchable = normalize([pattern.name,pattern.purpose,JSON.stringify(pattern.sequence),JSON.stringify(pattern.example),pattern.notes].join(' '));
        return Number(measurement?.frequency?.count ?? 0) > 0 && Number(measurement?.frequency?.coverageRatio ?? -1) >= 0.01 && (!groupSelect.value || pattern.group === groupSelect.value) && (!measured.checked || measurement) && (!text || searchable.includes(text));
      }), pattern => measurementScore(data.measurements?.[pattern.id]), item => item.name);
      const groups = collections().filter(group => filtered.some(pattern => pattern.group === group.id));
      results.innerHTML = groups.map(group => '<section class="dictionary-group"><header><h3>' + escapeText(group.name) + '</h3><p>' + escapeText(group.description ?? '') + '</p></header><div class="dictionary-group-body">' + filtered.filter(pattern => pattern.group === group.id).map(pattern => '<article class="dictionary-card word-card"><h3>' + escapeText(pattern.name) + '</h3><p><strong>' + (chinese ? '结构序列：' : 'Sequence: ') + '</strong><code>' + escapeText((pattern.sequence ?? []).join(' → ')) + '</code></p><p><strong>' + (chinese ? '完成任务：' : 'Purpose: ') + '</strong>' + escapeText(pattern.purpose) + '</p><p><strong>' + (chinese ? '示例：' : 'Example: ') + '</strong>' + escapeText(Array.isArray(pattern.example) ? pattern.example.join(' → ') : pattern.example ?? '—') + '</p><p><strong>' + (chinese ? '目标统计：' : 'Measurement: ') + '</strong>' + escapeText(measurementText(data.measurements?.[pattern.id])) + '</p><p class="dictionary-meta"><strong>' + (chinese ? '验证：' : 'Validation: ') + '</strong>' + escapeText(data.measurements?.[pattern.id]?.validation?.status ?? data.measurements?.[pattern.id]?.status ?? 'unmapped') + '</p></article>').join('') + '</div></section>').join('');
      return filtered.length;
    };
    const render = () => { const text = normalize(search.value.trim()); const count = view === 'types' ? renderTypes(text) : renderPatterns(text); empty.classList.toggle('visible', count === 0); root.querySelectorAll('[data-' + prefix + '-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset[prefix + 'View'] === view))); renderMetrics(); };
    const applyText = text => { const parsed = JSON.parse(text); for (const key of ['axes','types','groups','patterns']) if (!Array.isArray(parsed[key])) throw new Error(chinese ? 'JSON 必须包含 axes、types、groups 和 patterns 数组。' : 'JSON must contain axes, types, groups, and patterns arrays.'); parsed.patterns = parsed.patterns.filter(pattern => { const count = parsed.measurements?.[pattern.id]?.frequency?.count; return count == null || count > 0; }); for (const [id, measurement] of Object.entries(parsed.measurements ?? {})) if (typeof measurement?.frequency?.count === 'number' && measurement.frequency.count <= 0) delete parsed.measurements[id]; data = parsed; embedded.textContent = JSON.stringify(data); editor.value = JSON.stringify(data, null, 2); errorBox.hidden = true; refreshGroups(); render(); };
    editor.value = JSON.stringify(data, null, 2); refreshGroups(); render(); search.addEventListener('input', render); groupSelect.addEventListener('change', render); sortSelect.addEventListener('change', render); measured.addEventListener('change', render);
    root.querySelectorAll('[data-' + prefix + '-view]').forEach(button => button.addEventListener('click', () => { view = button.dataset[prefix + 'View']; groupSelect.value = ''; refreshGroups(); render(); }));
    results.addEventListener('click', event => { const button = event.target.closest('[data-structural-pattern]'); if (!button) return; const pattern = (data.patterns ?? []).find(item => item.id === button.dataset.structuralPattern); if (!pattern) return; view = 'patterns'; groupSelect.value = ''; refreshGroups(); search.value = pattern.name; render(); });
    query('copy-result').addEventListener('click', () => navigator.clipboard.writeText(results.innerText)); query('apply').addEventListener('click', () => { try { applyText(editor.value); } catch (error) { errorBox.textContent = error.message; errorBox.hidden = false; } }); query('reset').addEventListener('click', () => applyText(builtInText)); query('copy-json').addEventListener('click', () => navigator.clipboard.writeText(editor.value)); query('import').addEventListener('click', () => fileInput.click()); fileInput.addEventListener('change', async () => { const file = fileInput.files?.[0]; if (!file) return; try { applyText(await file.text()); } catch (error) { errorBox.textContent = error.message; errorBox.hidden = false; } finally { fileInput.value = ''; } }); query('export').addEventListener('click', () => downloadBlob(editor.value, noun + '类型字典.json', 'application/json;charset=utf-8')); query('download-html').addEventListener('click', () => { const clone = document.documentElement.cloneNode(true); const node = clone.querySelector('#' + prefix + 'DictionaryData'); if (node) node.textContent = JSON.stringify(data); downloadBlob('<!doctype html>\\n' + clone.outerHTML, '语言风格_' + noun + '字典数据版.html', 'text/html;charset=utf-8'); });
  };
  initializeStructuralDictionary('paragraph');
  initializeStructuralDictionary('composition');
  const annotateObservedCards = container => {
    if (!container) return;
    for (const card of container.querySelectorAll('.word-card')) {
      const heading = card.querySelector('h3');
      if (!heading || heading.querySelector('.observed-headline')) continue;
      const measurement = [...card.querySelectorAll('p')].find(item => /(?:目标统计|Measurement)[:：]/.test(item.textContent));
      if (!measurement) continue;
      const text = measurement.textContent;
      const count = text.match(/(?:次数|Count)\s*([^·]+)/)?.[1]?.trim();
      const coverage = text.match(/(?:覆盖|Coverage)\s*([^·]+)/)?.[1]?.trim();
      if (!count && !coverage) continue;
      const badge = document.createElement('span');
      badge.className = 'dictionary-meta observed-headline';
      badge.textContent = (document.documentElement.lang === 'zh-CN' ? '命中 ' : 'Count ') + (count ?? '—') + ' · ' + (document.documentElement.lang === 'zh-CN' ? '覆盖 ' : 'Coverage ') + (coverage ?? '—');
      heading.append(' ', badge);
    }
  };
  for (const selector of ['[data-sentence-results]','[data-paragraph-results]','[data-composition-results]']) {
    const container = document.querySelector(selector);
    annotateObservedCards(container);
    if (container) new MutationObserver(() => annotateObservedCards(container)).observe(container, { childList: true, subtree: true });
  }
</script>
</body>
</html>
`;
  let vocabularyDictionary = null;
  let sentenceDictionary = null;
  let paragraphDictionary = null;
  let compositionDictionary = null;
  if (styleDataText) {
    try {
      const parsedStyleData = JSON.parse(styleDataText);
      vocabularyDictionary = buildVocabularyDictionaryPayload(parsedStyleData, isChinese, fourLayerCatalog);
      if (sentenceCatalog) sentenceDictionary = buildSentenceDictionaryPayload(parsedStyleData, sentenceCatalog, isChinese);
      if (fourLayerCatalog) {
        paragraphDictionary = buildStructuralDictionaryPayload(parsedStyleData, fourLayerCatalog, "paragraph", isChinese);
        compositionDictionary = buildStructuralDictionaryPayload(parsedStyleData, fourLayerCatalog, "composition", isChinese);
      }
    } catch {
      vocabularyDictionary = null;
      sentenceDictionary = null;
      paragraphDictionary = null;
      compositionDictionary = null;
    }
  }
  return { html, sourceHash: digest, sources: sources.map((source) => source.fileName), vocabularyDictionary, sentenceDictionary, paragraphDictionary, compositionDictionary };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = buildStyleGuide(options.skillDirectory);
  const dictionaryPath = path.join(options.skillDirectory, "references", VOCABULARY_DICTIONARY_JSON);
  const dictionaryText = result.vocabularyDictionary ? `${JSON.stringify(result.vocabularyDictionary, null, 2)}\n` : null;
  const sentenceDictionaryPath = path.join(options.skillDirectory, "references", SENTENCE_DICTIONARY_JSON);
  const sentenceDictionaryText = result.sentenceDictionary ? `${JSON.stringify(result.sentenceDictionary, null, 2)}\n` : null;
  const paragraphDictionaryPath = path.join(options.skillDirectory, "references", PARAGRAPH_DICTIONARY_JSON);
  const paragraphDictionaryText = result.paragraphDictionary ? `${JSON.stringify(result.paragraphDictionary, null, 2)}\n` : null;
  const compositionDictionaryPath = path.join(options.skillDirectory, "references", COMPOSITION_DICTIONARY_JSON);
  const compositionDictionaryText = result.compositionDictionary ? `${JSON.stringify(result.compositionDictionary, null, 2)}\n` : null;
  if (options.check) {
    if (!fs.existsSync(options.outputPath)) {
      console.error(`ERROR: HTML guide is missing: ${options.outputPath}`);
      process.exit(1);
    }
    const current = fs.readFileSync(options.outputPath, "utf8");
    if (current !== result.html) {
      console.error(`ERROR: HTML guide is out of date: ${options.outputPath}`);
      process.exit(1);
    }
    if (dictionaryText !== null) {
      if (!fs.existsSync(dictionaryPath)) {
        console.error(`ERROR: vocabulary dictionary JSON is missing: ${dictionaryPath}`);
        process.exit(1);
      }
      if (fs.readFileSync(dictionaryPath, "utf8") !== dictionaryText) {
        console.error(`ERROR: vocabulary dictionary JSON is out of date: ${dictionaryPath}`);
        process.exit(1);
      }
    }
    if (sentenceDictionaryText !== null) {
      if (!fs.existsSync(sentenceDictionaryPath)) {
        console.error(`ERROR: sentence dictionary JSON is missing: ${sentenceDictionaryPath}`);
        process.exit(1);
      }
      if (fs.readFileSync(sentenceDictionaryPath, "utf8") !== sentenceDictionaryText) {
        console.error(`ERROR: sentence dictionary JSON is out of date: ${sentenceDictionaryPath}`);
        process.exit(1);
      }
    }
    for (const [name, filePath, expected] of [["paragraph", paragraphDictionaryPath, paragraphDictionaryText], ["composition", compositionDictionaryPath, compositionDictionaryText]]) {
      if (expected === null) continue;
      if (!fs.existsSync(filePath)) {
        console.error(`ERROR: ${name} dictionary JSON is missing: ${filePath}`);
        process.exit(1);
      }
      if (fs.readFileSync(filePath, "utf8") !== expected) {
        console.error(`ERROR: ${name} dictionary JSON is out of date: ${filePath}`);
        process.exit(1);
      }
    }
    console.log(`HTML guide is current: ${options.outputPath}`);
    return;
  }
  fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
  fs.writeFileSync(options.outputPath, result.html, "utf8");
  if (dictionaryText !== null) fs.writeFileSync(dictionaryPath, dictionaryText, "utf8");
  if (sentenceDictionaryText !== null) fs.writeFileSync(sentenceDictionaryPath, sentenceDictionaryText, "utf8");
  if (paragraphDictionaryText !== null) fs.writeFileSync(paragraphDictionaryPath, paragraphDictionaryText, "utf8");
  if (compositionDictionaryText !== null) fs.writeFileSync(compositionDictionaryPath, compositionDictionaryText, "utf8");
  console.log(`Generated language style HTML: ${options.outputPath}`);
  if (options.open) {
    openInBrowser(options.outputPath);
    console.log(`Opened language style HTML in the system browser: ${options.outputPath}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    usage();
    process.exit(2);
  }
}
