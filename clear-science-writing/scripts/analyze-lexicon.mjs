#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const SUPPORTED_EXTENSIONS = new Set([".txt", ".md", ".jsonl"]);

const zhCategories = {
  "人称词": ["我", "咱", "咱们", "我们", "你", "您", "你们", "他", "她", "他们", "大家", "各位"],
  "称呼词": ["朋友", "兄弟", "老师", "老板", "用户", "阁下", "同学", "先生", "女士"],
  "群体与阵营": ["咱们", "我们", "你们", "他们", "大家", "自己人", "外人", "团队", "双方", "对方"],
  "指示词": ["这", "那", "这里", "那里", "这个", "那个", "这种", "那种", "这些", "那些"],
  "疑问词与疑问短语": ["什么", "啥", "怎么", "咋", "为什么", "为啥", "为何", "如何", "何种", "是否", "谁", "哪", "哪里", "多少", "难道", "这是什么", "这是啥", "什么意思"],
  "条件与假设": ["如果", "若", "假如", "假设", "只要", "除非", "倘若", "一旦", "在这种情况下"],
  "确定程度": ["可能", "或许", "大概", "似乎", "未必", "倾向于", "一般来说", "基本上", "多半", "肯定", "必然", "一定", "显然", "毫无疑问", "绝对"],
  "判断依据与立场": ["我觉得", "我认为", "据观察", "数据显示", "从目前看", "目前看来", "从日志看", "根据", "据说", "一般认为", "可以认为", "由此可见"],
  "决策义务与许可": ["应该", "必须", "需要", "建议", "可以", "不得", "务必", "最好"],
  "否定与禁止": ["不", "没", "没有", "别", "并非", "未必", "不能", "不要", "无需", "不是", "否则"],
  "因果与推导": ["因为", "所以", "因此", "由此", "既然", "意味着", "导致", "造成", "结果是"],
  "转折与修正": ["但", "但是", "不过", "然而", "其实", "反而", "事实上", "问题是", "话虽如此"],
  "比较与选择": ["相比", "比", "而不是", "或者", "还是", "优先", "选择", "取决于", "相反"],
  "顺序与时间": ["首先", "其次", "最后", "第一", "第二", "接下来", "先", "然后", "接着", "现在", "马上", "之后", "最终", "一直"],
  "频率": ["经常", "总是", "一般", "通常", "偶尔", "有时", "几乎不", "从不"],
  "范围与数量": ["都", "只", "仅", "至少", "最多", "大部分", "个别", "基本上", "全部", "任何", "唯一", "部分"],
  "程度": ["很", "挺", "蛮", "特别", "非常", "极其", "巨", "贼", "稍微", "有点", "相当", "完全", "根本"],
  "评价": ["好", "差", "合理", "不合理", "靠谱", "离谱", "优雅", "粗暴", "恶心", "聪明", "优秀", "可行", "不可用"],
  "强调与聚焦": ["就是", "真的", "确实", "尤其", "重点是", "关键是", "本质上", "说到底"],
  "缓和": ["有点", "不太", "相对", "某种程度上", "未必", "尽量", "可能", "暂时"],
  "绝对化": ["一定", "完全", "根本", "绝对", "全部", "从来", "永远", "毫无疑问"],
  "总结与重述": ["总之", "简单说", "说白了", "归根结底", "换句话说", "也就是说", "总结一下"],
  "请求与礼貌": ["请", "麻烦", "能不能", "可以吗", "方便的话", "最好", "谢谢", "劳驾"],
  "命令与动作": ["去", "做", "检查", "停止", "记得", "注意", "禁止", "不要", "直接", "打开", "关闭", "确认"],
  "语气词与句末词": ["啊", "呀", "呢", "吧", "嘛", "呗", "啦", "哦", "哈", "对吧", "是不是"],
  "感叹拟声与停顿": ["哈哈", "嘿", "哎", "啧", "唉", "哇", "嗯", "呃", "呵呵"],
  "回应与确认": ["嗯", "哦", "好", "行", "可以", "明白", "收到", "知道了"],
  "口语与圈层": ["啥", "咋", "整", "搞", "弄", "这玩意", "没事", "离谱", "稳了", "逆天", "抽象"],
  "书面与正式": ["何种", "如何", "进行", "基于", "鉴于", "因此", "该项", "具备", "应当"],
  "文言与古典": ["吾", "汝", "然", "故", "亦", "莫", "何以", "甚是"]
};

const enCategories = {
  "personal_pronouns": ["i", "we", "you", "he", "she", "they", "everyone"],
  "address_terms": ["friend", "sir", "madam", "team", "folks", "everyone", "user", "customer"],
  "demonstratives": ["this", "that", "these", "those", "here", "there"],
  "questions": ["what", "why", "how", "who", "where", "when", "which", "whether"],
  "conditions": ["if", "unless", "provided that", "as long as", "assuming"],
  "certainty": ["maybe", "perhaps", "probably", "likely", "possibly", "certainly", "definitely", "obviously", "must"],
  "evidence_and_stance": ["i think", "i believe", "in my view", "based on", "the data shows", "the logs show", "at present", "it appears"],
  "decisions_and_obligation": ["should", "must", "need", "recommend", "may", "can", "cannot", "required"],
  "negation": ["not", "never", "no", "cannot", "don't", "isn't", "rather than"],
  "cause_and_inference": ["because", "so", "therefore", "thus", "hence", "means that", "as a result"],
  "contrast_and_correction": ["but", "however", "actually", "instead", "in fact", "the problem is"],
  "comparison_and_choice": ["compared with", "rather than", "instead of", "either", "or", "prefer", "depends on"],
  "sequence": ["first", "second", "next", "then", "finally", "now", "afterward"],
  "scope_and_frequency": ["all", "only", "at least", "most", "some", "always", "usually", "sometimes", "never"],
  "degree": ["very", "quite", "really", "extremely", "slightly", "completely", "absolutely"],
  "evaluation": ["good", "bad", "reasonable", "unreasonable", "reliable", "unreliable", "elegant", "rough", "feasible", "unusable"],
  "emphasis_and_focus": ["indeed", "especially", "the key is", "the point is", "essentially", "in fact"],
  "hedging": ["somewhat", "relatively", "to some extent", "perhaps", "likely", "for now", "as far as possible"],
  "summary_and_restatement": ["in short", "simply put", "in other words", "overall", "ultimately"],
  "politeness_and_requests": ["please", "could you", "would you", "thank you", "preferably"],
  "commands_and_actions": ["check", "stop", "remember to", "make sure", "open", "close", "confirm", "do not", "don't"],
  "response_and_fillers": ["yes", "no", "okay", "ok", "well", "um", "uh", "got it", "understood"],
  "colloquial_register": ["gonna", "wanna", "kinda", "sorta", "stuff", "thing", "nope", "yep"],
  "formal_register": ["therefore", "hereby", "pursuant to", "regarding", "constitutes", "shall", "aforementioned"],
  "discourse_openers": ["actually", "strictly speaking", "honestly", "the point is", "first of all"]
};

const zhStopwords = new Set(["一个", "这个", "那个", "这些", "那些", "自己", "已经", "可以", "没有", "不是", "就是", "进行", "以及", "或者", "因为", "所以", "但是", "如果", "然后", "我们", "你们", "他们"]);
const enStopwords = new Set(["the", "and", "that", "this", "with", "from", "have", "has", "was", "were", "are", "for", "not", "but", "you", "your", "they", "their", "our", "can", "will", "into", "than", "then"]);
const zhWordSegmenter = new Intl.Segmenter("zh", { granularity: "word" });
const enSentenceSegmenter = new Intl.Segmenter("en", { granularity: "sentence" });
const zhSegmentCache = new Map();
const zhTokenCache = new Map();
const zhSingleTermOccurrenceCache = new Map();
const zhSingleTermDocumentStatsCache = new Map();
const enTokenSpanCache = new Map();
let zhTrackedSingleTerms = new Set();
const GENERATED_SAMPLE_RECORD_TYPE = "clear-science-writing-sampled-paragraph-v1";
const JSONL_TEXT_FIELDS = ["quote", "text", "content", "paragraphText"];

function usage() {
  console.error(`Usage: node analyze-lexicon.mjs <input-file-or-directory> [output-json] [options]

Options:
  --sample-size <n>            Analyze n sampled paragraphs; 0 means full corpus (default: 0)
  --sample-seed <value>        Reproducible sampling seed (default: 42)
  --sample-strategy <name>     random | even | stratified | head (default: random)
  --min-paragraph-chars <n>    Ignore shorter paragraphs (default: 1)
  --sample-output <jsonl>      Optionally save sampled paragraph text for local review
  --terms-file <json>          Merge custom category-to-terms JSON into built-in categories
  --terms-mode <mode>          merge | only (default: merge)
  --open-top <n>               Number of open-vocabulary candidates (default: 100)
  --min-count <n>              Minimum count for reported reference terms (default: 1)
  --language <value>           auto | zh | en (default: auto)
  --path-mode <mode>           anonymous | relative | absolute (default: anonymous)`);
}

function parseArgs(argv) {
  const options = {
    sampleSize: 0,
    sampleSeed: "42",
    sampleStrategy: "random",
    minParagraphChars: 1,
    sampleOutput: undefined,
    termsFile: undefined,
    termsMode: "merge",
    openTop: 100,
    minCount: 1,
    language: "auto",
    pathMode: "anonymous"
  };
  const positional = [];
  const numberOption = (name, value, minimum = 0) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < minimum) throw new Error(`${name} must be an integer >= ${minimum}.`);
    return parsed;
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length || argv[index].startsWith("--")) throw new Error(`Missing value for ${arg}.`);
      return argv[index];
    };
    if (arg === "--sample-size") options.sampleSize = numberOption(arg, next());
    else if (arg === "--sample-seed") options.sampleSeed = next();
    else if (arg === "--sample-strategy") options.sampleStrategy = next();
    else if (arg === "--min-paragraph-chars") options.minParagraphChars = numberOption(arg, next());
    else if (arg === "--sample-output") options.sampleOutput = next();
    else if (arg === "--terms-file") options.termsFile = next();
    else if (arg === "--terms-mode") options.termsMode = next();
    else if (arg === "--open-top") options.openTop = numberOption(arg, next(), 1);
    else if (arg === "--min-count") options.minCount = numberOption(arg, next(), 1);
    else if (arg === "--language") options.language = next();
    else if (arg === "--path-mode") options.pathMode = next();
    else if (arg.startsWith("--")) throw new Error(`Unknown option: ${arg}`);
    else positional.push(arg);
  }
  if (positional.length > 2) throw new Error(`Unexpected positional argument: ${positional[2]}`);
  if (!["random", "even", "stratified", "head"].includes(options.sampleStrategy)) {
    throw new Error("--sample-strategy must be random, even, stratified, or head.");
  }
  if (!["merge", "only"].includes(options.termsMode)) throw new Error("--terms-mode must be merge or only.");
  if (options.termsMode === "only" && !options.termsFile) throw new Error("--terms-mode only requires --terms-file.");
  if (!["auto", "zh", "en"].includes(options.language)) throw new Error("--language must be auto, zh, or en.");
  if (!["anonymous", "relative", "absolute"].includes(options.pathMode)) {
    throw new Error("--path-mode must be anonymous, relative, or absolute.");
  }
  return { inputArg: positional[0], outputArg: positional[1], options };
}

function collectFiles(inputPath, excludedPaths = new Set()) {
  const resolved = path.resolve(inputPath);
  if (!fs.existsSync(resolved)) throw new Error(`Input does not exist: ${resolved}`);
  const stat = fs.statSync(resolved);
  if (stat.isFile()) {
    return SUPPORTED_EXTENSIONS.has(path.extname(resolved).toLowerCase()) && !excludedPaths.has(resolved) ? [resolved] : [];
  }
  const files = [];
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase()) && !excludedPaths.has(path.resolve(full))) files.push(full);
    }
  };
  visit(resolved);
  return files.sort();
}

function decodeBuffer(buffer) {
  const utf8 = new TextDecoder("utf-8").decode(buffer);
  const utf8Bad = (utf8.match(/\uFFFD/g) || []).length;
  if (utf8Bad === 0) return utf8;
  const gb = new TextDecoder("gb18030").decode(buffer);
  const gbBad = (gb.match(/\uFFFD/g) || []).length;
  return gbBad < utf8Bad ? gb : utf8;
}

function isGeneratedSampleFile(file) {
  if (path.extname(file).toLowerCase() !== ".jsonl") return false;
  const descriptor = fs.openSync(file, "r");
  const prefix = Buffer.alloc(Math.min(fs.fstatSync(descriptor).size, 4096));
  try {
    fs.readSync(descriptor, prefix, 0, prefix.length, 0);
  } finally {
    fs.closeSync(descriptor);
  }
  const firstLine = decodeBuffer(prefix).split(/\r?\n/u).find((line) => line.trim());
  if (!firstLine) return false;
  if (new RegExp(`^\\s*\\{\\s*"recordType"\\s*:\\s*"${escapeRegex(GENERATED_SAMPLE_RECORD_TYPE)}"`, "u").test(firstLine)) return true;
  try {
    return JSON.parse(firstLine).recordType === GENERATED_SAMPLE_RECORD_TYPE;
  } catch {
    return false;
  }
}

function readSourceFile(file) {
  const raw = decodeBuffer(fs.readFileSync(file));
  if (path.extname(file).toLowerCase() !== ".jsonl") {
    return {
      file,
      documents: [{ file, recordIndex: null, jsonlLine: null, text: raw }],
      jsonlDiagnostics: null
    };
  }
  const documents = [];
  const skippedRecords = [];
  const invalidRecordsUsedAsText = [];
  let recordsRead = 0;
  for (const [recordIndex, line] of raw.split(/\r?\n/u).entries()) {
    if (!line.trim()) continue;
    recordsRead += 1;
    try {
      const record = JSON.parse(line);
      if (record.recordType === GENERATED_SAMPLE_RECORD_TYPE) continue;
      const value = JSONL_TEXT_FIELDS
        .map((field) => record[field])
        .find((candidate) => typeof candidate === "string" && candidate.trim());
      if (value) {
        documents.push({ file, recordIndex, jsonlLine: recordIndex + 1, text: value });
      } else {
        skippedRecords.push({ line: recordIndex + 1, reason: "no_supported_nonempty_text_field" });
      }
    } catch {
      documents.push({ file, recordIndex, jsonlLine: recordIndex + 1, text: line });
      invalidRecordsUsedAsText.push({ line: recordIndex + 1, reason: "invalid_json_used_as_text" });
    }
  }
  return {
    file,
    documents,
    jsonlDiagnostics: {
      recordsRead,
      recordsUsed: documents.length,
      recordsSkipped: skippedRecords.length,
      skippedRecords,
      invalidRecordsUsedAsText,
      supportedTextFields: JSONL_TEXT_FIELDS
    }
  };
}

function splitParagraphs(text) {
  return text
    .replace(/\r\n?/gu, "\n")
    .split(/\n+/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function cleanInlineAnalysisText(sourceLine) {
  return sourceLine
    .replace(/(`+)(.*?)\1/gu, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/gu, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1")
    .replace(/https?:\/\/\S+/giu, (match) => match.match(/[.,!?;:]+$/u)?.[0] ?? "")
    .replace(/\*\*|__|~~/gu, "");
}

function stripMarkdownPrefix(sourceLine) {
  let line = sourceLine;
  let previous;
  do {
    previous = line;
    line = line
      .replace(/^\s{0,3}#{1,6}\s+/u, "")
      .replace(/^\s*>\s?/u, "")
      .replace(/^\s*(?:[-*+]\s+|\d+[.)、]\s*)/u, "")
      .replace(/^\s*\[[ xX]\]\s+/u, "");
  } while (line !== previous);
  return line.trim();
}

function splitParagraphRecords(text, markupMode) {
  const records = [];
  let codeFence = null;
  let paragraphBuffer = [];
  let quoteBuffer = [];
  let listBuffer = null;
  const indentationWidth = (line) => {
    const prefix = line.match(/^\s*/u)?.[0] ?? "";
    return [...prefix].reduce((width, character) => width + (character === "\t" ? 4 : 1), 0);
  };
  const cleanedLines = (lines) => lines
    .map((line) => stripMarkdownPrefix(cleanInlineAnalysisText(line.trim())))
    .filter(Boolean)
    .join(" ");
  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) return;
    const raw = paragraphBuffer.map((line) => line.trim()).join(" ");
    records.push({ text: raw, analysisText: stripMarkdownPrefix(cleanInlineAnalysisText(raw)) });
    paragraphBuffer = [];
  };
  const flushQuote = () => {
    if (quoteBuffer.length === 0) return;
    records.push({
      text: quoteBuffer.map((line) => line.trim()).join(" "),
      analysisText: cleanedLines(quoteBuffer)
    });
    quoteBuffer = [];
  };
  const flushList = () => {
    if (!listBuffer) return;
    records.push({
      text: listBuffer.lines.map((line) => line.trim()).join(" "),
      analysisText: cleanedLines(listBuffer.lines)
    });
    listBuffer = null;
  };
  const flushTextBuffers = () => {
    flushParagraph();
    flushQuote();
    flushList();
  };
  for (const sourceLine of text.replace(/\r\n?/gu, "\n").split("\n")) {
    const raw = sourceLine.trim();
    if (markupMode !== "markdown") {
      if (!raw) continue;
      records.push({ text: raw, analysisText: raw });
      continue;
    }
    if (codeFence) {
      const closingPattern = new RegExp(`^${escapeRegex(codeFence.character)}{${codeFence.length},}\\s*$`, "u");
      if (closingPattern.test(raw)) codeFence = null;
      records.push({ text: raw, analysisText: "" });
      continue;
    }
    const openingFence = raw.match(/^(`{3,}|~{3,})/u)?.[1];
    if (openingFence) {
      flushTextBuffers();
      codeFence = { character: openingFence[0], length: openingFence.length };
      records.push({ text: raw, analysisText: "" });
      continue;
    }
    if (!raw) {
      flushTextBuffers();
      continue;
    }
    const horizontalRule = /^\s{0,3}(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})$/u.test(sourceLine);
    if (horizontalRule) {
      flushTextBuffers();
      records.push({ text: raw, analysisText: "" });
      continue;
    }
    if (/^\s{0,3}#{1,6}\s+/u.test(sourceLine)) {
      flushTextBuffers();
      records.push({
        text: raw,
        analysisText: stripMarkdownPrefix(cleanInlineAnalysisText(raw))
      });
      continue;
    }
    if (/^\s{0,3}>/u.test(sourceLine)) {
      flushParagraph();
      flushList();
      const quoteText = stripMarkdownPrefix(sourceLine);
      if (!quoteText) flushQuote();
      else quoteBuffer.push(sourceLine);
      continue;
    }
    const listMatch = sourceLine.match(/^(\s*)(?:[-*+]|\d+[.)、])\s+(.+)$/u);
    if (listMatch) {
      flushParagraph();
      flushQuote();
      flushList();
      listBuffer = { indent: indentationWidth(listMatch[1]), lines: [sourceLine] };
      continue;
    }
    if (quoteBuffer.length > 0) {
      quoteBuffer.push(sourceLine);
      continue;
    }
    if (listBuffer) {
      if (indentationWidth(sourceLine) >= listBuffer.indent + 8) {
        flushList();
        records.push({ text: raw, analysisText: "" });
      } else {
        listBuffer.lines.push(sourceLine);
      }
      continue;
    }
    if (/^(?: {4}|\t)/u.test(sourceLine)) {
      flushTextBuffers();
      records.push({ text: raw, analysisText: "" });
      continue;
    }
    paragraphBuffer.push(sourceLine);
  }
  flushTextBuffers();
  return records;
}

function seedToNumber(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let state = seedToNumber(seed);
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleParagraphs(paragraphs, size, strategy, seed) {
  if (size <= 0 || size >= paragraphs.length) return [...paragraphs];
  if (strategy === "head") return paragraphs.slice(0, size);
  if (strategy === "even") {
    if (size === 1) return [paragraphs[Math.floor(paragraphs.length / 2)]];
    return Array.from({ length: size }, (_, index) => paragraphs[Math.round((index * (paragraphs.length - 1)) / (size - 1))]);
  }
  const random = seededRandom(seed);
  if (strategy === "stratified") {
    const byDocument = new Map();
    for (const paragraph of paragraphs) {
      if (!byDocument.has(paragraph.sourceDocumentIndex)) byDocument.set(paragraph.sourceDocumentIndex, []);
      byDocument.get(paragraph.sourceDocumentIndex).push(paragraph);
    }
    const documentGroups = [...byDocument.values()];
    const selected = [];
    const groupsToCover = size >= documentGroups.length
      ? documentGroups
      : Array.from({ length: size }, (_, index) => {
          const groupIndex = size === 1
            ? Math.floor(documentGroups.length / 2)
            : Math.round((index * (documentGroups.length - 1)) / (size - 1));
          return documentGroups[groupIndex];
        });
    for (const group of groupsToCover) selected.push(group[Math.floor(random() * group.length)]);
    if (selected.length < size) {
      const selectedIndexes = new Set(selected.map((item) => item.globalIndex));
      const remaining = paragraphs.filter((item) => !selectedIndexes.has(item.globalIndex));
      const needed = size - selected.length;
      for (let index = 0; index < needed; index += 1) {
        const start = Math.floor((index * remaining.length) / needed);
        const end = Math.max(start + 1, Math.floor(((index + 1) * remaining.length) / needed));
        selected.push(remaining[start + Math.floor(random() * (end - start))]);
      }
    }
    return selected.sort((a, b) => a.globalIndex - b.globalIndex);
  }
  const shuffled = [...paragraphs];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled.slice(0, size).sort((a, b) => a.globalIndex - b.globalIndex);
}

function loadCustomCategories(file, language) {
  if (!file) return {};
  const raw = fs.readFileSync(path.resolve(file), "utf8").replace(/^\uFEFF/u, "");
  const parsed = JSON.parse(raw);
  const source = parsed.categories && typeof parsed.categories === "object" ? parsed.categories : parsed;
  const result = {};
  for (const [category, terms] of Object.entries(source)) {
    if (!Array.isArray(terms) || !terms.every((term) => typeof term === "string" && term.trim())) {
      throw new Error(`Custom category ${category} must be an array of non-empty strings.`);
    }
    const normalizedTerms = terms.map((term) => term.trim());
    if (language === "en") {
      result[category] = [...new Set(normalizedTerms.map((term) => term.toLowerCase()))];
    } else {
      result[category] = [...new Set(normalizedTerms)];
    }
  }
  return result;
}

function resolveCategories(language, options) {
  const builtIn = language === "zh" ? zhCategories : enCategories;
  const custom = loadCustomCategories(options.termsFile, language);
  if (options.termsMode === "only") return custom;
  const merged = Object.fromEntries(Object.entries(builtIn).map(([key, terms]) => [key, [...terms]]));
  for (const [category, terms] of Object.entries(custom)) {
    merged[category] = [...new Set([...(merged[category] || []), ...terms])];
  }
  return merged;
}

function inspectLanguage(text) {
  const hanCharacters = (text.match(/[\p{Script=Han}]/gu) || []).length;
  const englishWords = (text.match(/[A-Za-z][A-Za-z0-9_.]*(?:['’][A-Za-z]+)*/gu) || []).length;
  return { hanCharacters, englishWords };
}

function detectLanguage(evidence) {
  const { hanCharacters, englishWords } = evidence;
  if (hanCharacters === 0 && englishWords === 0) {
    throw new Error("Could not detect Chinese or English text. Pass --language zh or --language en after checking the corpus.");
  }
  if (hanCharacters > 0 && englishWords > 0) {
    const smaller = Math.min(hanCharacters, englishWords);
    const larger = Math.max(hanCharacters, englishWords);
    if (smaller / larger >= 0.2) {
      throw new Error("Mixed Chinese and English corpus detected. Split the corpus by language or pass --language after choosing the target group.");
    }
  }
  return hanCharacters > englishWords ? "zh" : "en";
}

function splitSentences(text, language) {
  if (language === "en") {
    return [...enSentenceSegmenter.segment(text)]
      .map((item) => item.segment.trim())
      .filter(Boolean);
  }
  return text.match(/[^。！？!?\n]+[。！？!?]?/gu)?.map((item) => item.trim()).filter(Boolean) ?? [];
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function zhWordSegments(text) {
  if (!zhSegmentCache.has(text)) {
    zhSegmentCache.set(text, [...zhWordSegmenter.segment(text)].filter((item) => item.isWordLike));
  }
  return zhSegmentCache.get(text);
}

function zhTokens(text) {
  if (!zhTokenCache.has(text)) zhTokenCache.set(text, zhWordSegments(text).map((item) => item.segment));
  return zhTokenCache.get(text);
}

function configureZhSingleTerms(categories) {
  zhTrackedSingleTerms = new Set(Object.values(categories).flat().filter((term) => [...term].length === 1));
  zhSingleTermOccurrenceCache.clear();
  zhSingleTermDocumentStatsCache.clear();
}

function zhSingleTermOccurrences(text) {
  if (!zhSingleTermOccurrenceCache.has(text)) {
    const occurrences = new Map();
    for (const item of zhWordSegments(text)) {
      if (zhTrackedSingleTerms.has(item.segment)) {
        if (!occurrences.has(item.segment)) occurrences.set(item.segment, []);
        occurrences.get(item.segment).push({ start: item.index, end: item.index + item.segment.length });
      }
    }
    zhSingleTermOccurrenceCache.set(text, occurrences);
  }
  return zhSingleTermOccurrenceCache.get(text);
}

function zhSingleTermDocumentStats(text) {
  if (!zhSingleTermDocumentStatsCache.has(text)) {
    const prefixCandidates = new Map();
    const substringCounts = new Map();
    for (const character of text) {
      if (zhTrackedSingleTerms.has(character)) {
        substringCounts.set(character, (substringCounts.get(character) || 0) + 1);
      }
    }
    for (const item of zhWordSegments(text)) {
      if (zhTrackedSingleTerms.has(item.segment)) continue;
      const firstCharacter = [...item.segment][0];
      if (zhTrackedSingleTerms.has(firstCharacter)) {
        prefixCandidates.set(firstCharacter, (prefixCandidates.get(firstCharacter) || 0) + 1);
      }
    }
    zhSingleTermDocumentStatsCache.set(text, { prefixCandidates, substringCounts });
  }
  return zhSingleTermDocumentStatsCache.get(text);
}

function findTermOccurrences(text, term, language) {
  if (language === "en") {
    const termPattern = escapeRegex(term).replace(/['’]/gu, "['’]");
    const pattern = new RegExp(`(?<![A-Za-z])${termPattern}(?![A-Za-z])`, "giu");
    return [...text.matchAll(pattern)].map((match) => ({ start: match.index, end: match.index + match[0].length }));
  }
  if ([...term].length === 1) {
    return zhSingleTermOccurrences(text).get(term) ?? [];
  }
  const occurrences = [];
  let index = 0;
  while ((index = text.indexOf(term, index)) !== -1) {
    occurrences.push({ start: index, end: index + term.length });
    index += Math.max(term.length, 1);
  }
  return occurrences;
}

function countInText(text, term, language) {
  return findTermOccurrences(text, term, language).length;
}

function addCollocation(counts, direction, phrase) {
  const normalized = phrase.trim();
  if (!normalized) return;
  const key = `${direction}\u0000${normalized}`;
  counts.set(key, (counts.get(key) || 0) + 1);
}

function collectChineseCollocations(text, term, occurrences, counts) {
  const termLength = [...term].length;
  const available = 6 - termLength;
  if (available <= 0) return;
  for (const occurrence of occurrences) {
    const leftWindow = [...text.slice(Math.max(0, occurrence.start - available * 2), occurrence.start)];
    const rightWindow = [...text.slice(occurrence.end, occurrence.end + available * 2)];
    const leftCharacters = [];
    const rightCharacters = [];
    for (let index = leftWindow.length - 1; index >= 0 && leftCharacters.length < available; index -= 1) {
      if (!/^\p{Script=Han}$/u.test(leftWindow[index])) break;
      leftCharacters.unshift(leftWindow[index]);
    }
    for (const character of rightWindow) {
      if (!/^\p{Script=Han}$/u.test(character) || rightCharacters.length >= available) break;
      rightCharacters.push(character);
    }
    for (let length = 1; length <= Math.min(available, leftCharacters.length); length += 1) {
      addCollocation(counts, "left", `${leftCharacters.slice(-length).join("")}${term}`);
    }
    for (let length = 1; length <= Math.min(available, rightCharacters.length); length += 1) {
      addCollocation(counts, "right", `${term}${rightCharacters.slice(0, length).join("")}`);
    }
  }
}

function lastTokenEndingAtOrBefore(tokens, offset) {
  let low = 0;
  let high = tokens.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (tokens[middle].end <= offset) low = middle + 1;
    else high = middle;
  }
  return low > 0 ? tokens[low - 1] : null;
}

function firstTokenStartingAtOrAfter(tokens, offset) {
  let low = 0;
  let high = tokens.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (tokens[middle].start < offset) low = middle + 1;
    else high = middle;
  }
  return tokens[low] ?? null;
}

function collectEnglishCollocations(text, occurrences, counts) {
  if (!enTokenSpanCache.has(text)) {
    enTokenSpanCache.set(text, [...text.matchAll(/[A-Za-z][A-Za-z'’-]*/g)].map((match) => ({
      text: match[0].replace(/’/gu, "'").toLowerCase(),
      start: match.index,
      end: match.index + match[0].length
    })));
  }
  const tokens = enTokenSpanCache.get(text);
  for (const occurrence of occurrences) {
    const surface = text.slice(occurrence.start, occurrence.end).replace(/’/gu, "'").toLowerCase();
    const previous = lastTokenEndingAtOrBefore(tokens, occurrence.start);
    const next = firstTokenStartingAtOrAfter(tokens, occurrence.end);
    if (previous && !/[.!?\n]/u.test(text.slice(previous.end, occurrence.start))) {
      addCollocation(counts, "left", `${previous.text} ${surface}`);
    }
    if (next && !/[.!?\n]/u.test(text.slice(occurrence.end, next.start))) {
      addCollocation(counts, "right", `${surface} ${next.text}`);
    }
  }
}

function formatCollocations(counts, limit = 12) {
  return [...counts.entries()]
    .map(([key, count]) => {
      const [direction, phrase] = key.split("\u0000");
      return { phrase, direction, count };
    })
    .sort((a, b) => b.count - a.count || a.phrase.localeCompare(b.phrase) || a.direction.localeCompare(b.direction))
    .slice(0, limit);
}

function normalizeSentence(sentence) {
  return sentence.replace(/^[\s“”‘’"'（(【[]+/u, "").replace(/[\s。！？!?；;，,：:.“”‘’"'）)】\]]+$/u, "").trim();
}

function analyzeTerm(term, documents, paragraphs, sentences, language, unitSize) {
  let count = 0;
  let documentCoverage = 0;
  let paragraphCoverage = 0;
  let substringCount = 0;
  let prefixCandidateCount = 0;
  const collocationCounts = new Map();
  for (const document of documents) {
    const occurrences = findTermOccurrences(document.text, term, language);
    const hits = occurrences.length;
    count += hits;
    if (language === "zh" && [...term].length === 1) {
      const documentStats = zhSingleTermDocumentStats(document.text);
      substringCount += documentStats.substringCounts.get(term) || 0;
      prefixCandidateCount += documentStats.prefixCandidates.get(term) || 0;
    }
    if (hits > 0) documentCoverage += 1;
    if (hits > 0) {
      if (language === "zh") collectChineseCollocations(document.text, term, occurrences, collocationCounts);
      else collectEnglishCollocations(document.text, occurrences, collocationCounts);
    }
  }
  let sentenceStart = 0;
  let sentenceEnd = 0;
  let questionSentence = 0;
  let sentenceCoverage = 0;
  for (const sentence of sentences) {
    const positionOccurrences = findTermOccurrences(sentence, term, language);
    if (positionOccurrences.length === 0) continue;
    sentenceCoverage += 1;
    const normalized = normalizeSentence(sentence);
    const normalizedOccurrences = normalized === sentence
      ? positionOccurrences
      : findTermOccurrences(normalized, term, language);
    if (normalizedOccurrences.some((item) => item.start === 0)) sentenceStart += 1;
    if (normalizedOccurrences.some((item) => item.end === normalized.length)) sentenceEnd += 1;
    if (/[？?]/u.test(sentence)) questionSentence += 1;
  }
  let paragraphStart = 0;
  let paragraphEnd = 0;
  for (const paragraph of paragraphs) {
    const positionOccurrences = findTermOccurrences(paragraph.analysisText, term, language);
    if (positionOccurrences.length === 0) continue;
    paragraphCoverage += 1;
    const normalized = normalizeSentence(paragraph.analysisText);
    const normalizedOccurrences = normalized === paragraph.analysisText
      ? positionOccurrences
      : findTermOccurrences(normalized, term, language);
    if (normalizedOccurrences.some((item) => item.start === 0)) paragraphStart += 1;
    if (normalizedOccurrences.some((item) => item.end === normalized.length)) paragraphEnd += 1;
  }
  const result = {
    term,
    count,
    normalizedPer10k: Number(((count / Math.max(unitSize, 1)) * 10000).toFixed(3)),
    documentCoverage,
    documentCoverageRatio: Number((documentCoverage / Math.max(documents.length, 1)).toFixed(3)),
    documentCoverageDenominator: documents.length,
    coverageScope: "analyzed_logical_documents",
    paragraphCoverage,
    paragraphCoverageRatio: Number((paragraphCoverage / Math.max(paragraphs.length, 1)).toFixed(3)),
    paragraphCoverageDenominator: paragraphs.length,
    paragraphCoverageScope: "analyzed_paragraphs",
    positions: {
      sentenceCoverage,
      sentenceStart,
      sentenceStartRatio: Number((sentenceStart / Math.max(sentenceCoverage, 1)).toFixed(3)),
      sentenceEnd,
      sentenceEndRatio: Number((sentenceEnd / Math.max(sentenceCoverage, 1)).toFixed(3)),
      questionSentence,
      questionSentenceRatio: Number((questionSentence / Math.max(sentenceCoverage, 1)).toFixed(3)),
      paragraphStart,
      paragraphStartRatio: Number((paragraphStart / Math.max(paragraphCoverage, 1)).toFixed(3)),
      paragraphEnd,
      paragraphEndRatio: Number((paragraphEnd / Math.max(paragraphCoverage, 1)).toFixed(3))
    },
    collocations: formatCollocations(collocationCounts),
    needsContextReview: true
  };
  if (language === "zh" && [...term].length === 1) {
    result.matchMode = "zh_segment_exact_single_character";
    result.substringCount = substringCount;
    result.prefixCandidateCount = prefixCandidateCount;
    result.ambiguousSubstringCount = Math.max(0, substringCount - count);
  }
  return result;
}

function tokenize(text, language) {
  if (language === "zh") {
    return zhTokens(text)
      .map((item) => item.trim())
      .filter((word) => word.length >= 2 && !zhStopwords.has(word));
  }
  return (text.toLowerCase().replace(/’/gu, "'").match(/[a-z][a-z'-]{2,}/g) || []).filter((word) => !enStopwords.has(word));
}

function topCounts(values, limit = 100) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([term, count]) => ({ term, count }));
}

function sentenceEdges(sentences, language) {
  const starts = [];
  const ends = [];
  for (const sentence of sentences) {
    const normalized = normalizeSentence(sentence);
    if (!normalized) continue;
    if (language === "zh") {
      const words = zhTokens(normalized);
      if (words.length) {
        starts.push(words.slice(0, 2).join(""));
        ends.push(words.slice(-2).join(""));
      }
    } else {
      const words = normalized.toLowerCase().replace(/’/gu, "'").match(/[a-z][a-z'-]*/g) || [];
      if (words.length) {
        starts.push(words.slice(0, 3).join(" "));
        ends.push(words.slice(-3).join(" "));
      }
    }
  }
  return { sentenceStarts: topCounts(starts, 40), sentenceEnds: topCounts(ends, 40) };
}

function textUnitLength(text, language) {
  if (language === "zh") return (text.match(/[\p{Script=Han}]/gu) || []).length;
  return (text.match(/[A-Za-z][A-Za-z'’-]*/g) || []).length;
}

function numericSummary(values) {
  if (values.length === 0) return { average: 0, median: 0, p75: 0, p90: 0, maximum: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const percentile = (ratio) => sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio))];
  return {
    average: Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)),
    median: percentile(0.5),
    p75: percentile(0.75),
    p90: percentile(0.9),
    maximum: sorted.at(-1)
  };
}

function standardDeviation(values) {
  if (values.length === 0) return 0;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + ((value - average) ** 2), 0) / values.length;
  return Math.sqrt(variance);
}

function analyzeRhythm(paragraphs, language) {
  const sentenceLengths = [];
  const adjacentAbsoluteChanges = [];
  let adjacentPairs = 0;
  let directionChangeOpportunities = 0;
  let directionChanges = 0;
  let paragraphsWithMultipleSentences = 0;
  for (const paragraph of paragraphs) {
    const lengths = splitSentences(paragraph.analysisText, language)
      .map((sentence) => textUnitLength(sentence, language))
      .filter((value) => value > 0);
    sentenceLengths.push(...lengths);
    if (lengths.length < 2) continue;
    paragraphsWithMultipleSentences += 1;
    let previousDirection = 0;
    for (let index = 1; index < lengths.length; index += 1) {
      const delta = lengths[index] - lengths[index - 1];
      adjacentPairs += 1;
      adjacentAbsoluteChanges.push(Math.abs(delta));
      const direction = Math.sign(delta);
      if (direction === 0) continue;
      if (previousDirection !== 0) {
        directionChangeOpportunities += 1;
        if (direction !== previousDirection) directionChanges += 1;
      }
      previousDirection = direction;
    }
  }
  const average = sentenceLengths.length > 0
    ? sentenceLengths.reduce((sum, value) => sum + value, 0) / sentenceLengths.length
    : 0;
  const deviation = standardDeviation(sentenceLengths);
  return {
    note: language === "zh"
      ? "句长变化只在同一段内部计算；它描述节奏变化，不直接等同于快、慢、口语或专业。"
      : "Sentence-length changes are measured only within paragraphs; variation describes rhythm and does not by itself imply speed, informality, or expertise.",
    sentenceLengthUnit: language === "zh" ? "han_characters" : "words",
    paragraphsWithMultipleSentences,
    adjacentPairs,
    adjacentAbsoluteChange: numericSummary(adjacentAbsoluteChanges),
    sentenceLengthStandardDeviation: Number(deviation.toFixed(3)),
    sentenceLengthCoefficientOfVariation: Number((deviation / Math.max(average, 1)).toFixed(3)),
    directionChangeOpportunities,
    directionChanges,
    directionChangeRatio: Number((directionChanges / Math.max(directionChangeOpportunities, 1)).toFixed(3))
  };
}

function buildCategoryMatchers(categories, language) {
  return Object.entries(categories).map(([category, terms]) => {
    if (language === "zh") {
      const singleCharacters = new Set(terms.filter((term) => [...term].length === 1));
      const longerTerms = terms.filter((term) => [...term].length > 1);
      return {
        category,
        matchingTerms(text, tokenSet) {
          const matched = longerTerms.filter((term) => text.includes(term));
          if (singleCharacters.size > 0) {
            for (const term of singleCharacters) {
              if (tokenSet.has(term)) matched.push(term);
            }
          }
          return matched;
        }
      };
    }
    const termMatchers = terms.map((term) => ({
      term,
      pattern: new RegExp(`(?<![A-Za-z])${escapeRegex(term).replace(/['’]/gu, "['’]")}(?![A-Za-z])`, "iu")
    }));
    return {
      category,
      matchingTerms: (text) => termMatchers.filter((item) => item.pattern.test(text)).map((item) => item.term)
    };
  });
}

function categoryPresence(text, matchers, language) {
  const tokenSet = language === "zh" ? new Set(zhTokens(text)) : null;
  return matchers
    .map((matcher) => ({ category: matcher.category, matchedTerms: matcher.matchingTerms(text, tokenSet) }))
    .filter((item) => item.matchedTerms.length > 0);
}

function hasDistinctMatchedForms(left, right) {
  return left.matchedTerms.some((leftTerm) => right.matchedTerms.some((rightTerm) => leftTerm !== rightTerm));
}

function analyzeCategoryCombinationScope(texts, matchers, language, limit = 60) {
  const categoryCoverage = new Map();
  const pairCounts = new Map();
  for (const text of texts) {
    const present = categoryPresence(text, matchers, language).sort((a, b) => a.category.localeCompare(b.category));
    for (const item of present) {
      categoryCoverage.set(item.category, (categoryCoverage.get(item.category) || 0) + 1);
    }
    for (let leftIndex = 0; leftIndex < present.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < present.length; rightIndex += 1) {
        if (!hasDistinctMatchedForms(present[leftIndex], present[rightIndex])) continue;
        const key = `${present[leftIndex].category}\u0000${present[rightIndex].category}`;
        pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
      }
    }
  }
  const denominator = Math.max(texts.length, 1);
  const coverage = [...categoryCoverage.entries()]
    .map(([category, count]) => ({
      category,
      count,
      ratio: Number((count / denominator).toFixed(3))
    }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
  const pairs = [...pairCounts.entries()]
    .map(([key, count]) => {
      const [left, right] = key.split("\u0000");
      const leftCount = categoryCoverage.get(left) || 0;
      const rightCount = categoryCoverage.get(right) || 0;
      const observed = count / denominator;
      const expected = (leftCount / denominator) * (rightCount / denominator);
      return {
        categories: [left, right],
        count,
        ratio: Number(observed.toFixed(3)),
        lift: Number((observed / Math.max(expected, Number.EPSILON)).toFixed(3))
      };
    })
    .sort((a, b) => b.count - a.count || b.lift - a.lift || a.categories.join("|").localeCompare(b.categories.join("|")))
    .slice(0, limit);
  return { units: texts.length, distinctPairs: pairCounts.size, reportedPairLimit: limit, categoryCoverage: coverage, pairs };
}

function analyzeCategoryCombinations(paragraphs, sentences, categories, language) {
  const matchers = buildCategoryMatchers(categories, language);
  return {
    note: language === "zh"
      ? "类别可以重叠；同一个共享词不会单独形成类别组合，至少要出现两个不同词形。共现仍只说明哪些功能词群经常一起出现，必须回看上下文判断言语行为和可迁移性。"
      : "Categories may overlap. One shared form does not create a category pair by itself; at least two distinct forms must be present. Context review is still required for speech acts and transferability.",
    sentences: analyzeCategoryCombinationScope(sentences, matchers, language),
    paragraphs: analyzeCategoryCombinationScope(paragraphs.map((item) => item.analysisText), matchers, language)
  };
}

function activeCategories(categoryResults) {
  return Object.fromEntries(categoryResults
    .map((category) => [
      category.category,
      [
        ...category.dominantForms.map((item) => item.term),
        ...category.belowMinimumForms.map((item) => item.term)
      ]
    ])
    .filter(([, terms]) => terms.length > 0));
}

function countPattern(text, pattern) {
  return (text.match(pattern) || []).length;
}

function countEnglishTerminalPeriods(sentences) {
  return sentences.filter((sentence) => {
    const trimmed = sentence.trim().replace(/["'”’)}\]]+$/u, "");
    return trimmed.endsWith(".") && !trimmed.endsWith("...");
  }).length;
}

function stripClosingMarks(sentence) {
  return sentence.trim().replace(/["'”’)}\]]+$/u, "");
}

function countQuotationMarks(text, language) {
  const doubleMarks = countPattern(text, /[“”"]/gu);
  if (language !== "en") return doubleMarks + countPattern(text, /[‘’]/gu);
  const straightSinglePairs = countPattern(text, /(?:^|[\s([{])'[^'\n]+'(?=$|[\s)\]}.,!?;:])/gmu) * 2;
  const curlySinglePairs = countPattern(text, /‘[^’\n]+’/gu) * 2;
  return doubleMarks + straightSinglePairs + curlySinglePairs;
}

function categoryTotal(categoryResults, category) {
  return categoryResults.find((item) => item.category === category)?.totalHits ?? 0;
}

function analyzeStyleMetrics(paragraphs, sentences, combined, language, categoryResults) {
  const paragraphLengths = paragraphs.map((item) => textUnitLength(item.analysisText, language));
  const sentenceLengths = sentences.map((item) => textUnitLength(item, language)).filter((value) => value > 0);
  const paragraphSentenceCounts = paragraphs.map((item) => splitSentences(item.analysisText, language).length);
  const sentenceTypes = { declarative: 0, question: 0, exclamation: 0, ellipsis: 0 };
  for (const sentence of sentences) {
    const terminalSentence = stripClosingMarks(sentence);
    if (/[？?]\s*$/u.test(terminalSentence)) sentenceTypes.question += 1;
    else if (/[！!]\s*$/u.test(terminalSentence)) sentenceTypes.exclamation += 1;
    else sentenceTypes.declarative += 1;
    if (/……|\.\.\./u.test(terminalSentence)) sentenceTypes.ellipsis += 1;
  }
  const paragraphShape = {
    oneSentenceParagraphs: paragraphSentenceCounts.filter((count) => count <= 1).length,
    listLikeParagraphs: paragraphs.filter((item) => /^(?:[-*+]\s+|\d+[.)、]\s*)/u.test(item.text)).length,
    headingParagraphs: paragraphs.filter((item) => /^#{1,6}\s+/u.test(item.text)).length,
    blockQuoteParagraphs: paragraphs.filter((item) => /^>\s*/u.test(item.text)).length,
    codeFenceParagraphs: paragraphs.filter((item) => /^```/u.test(item.text)).length,
    parentheticalParagraphs: paragraphs.filter((item) => /[（(].+[）)]/u.test(item.text)).length,
    directSpeechParagraphs: paragraphs.filter((item) => /[“”]|(?:^|\s)".+"/u.test(item.text)).length
  };
  const punctuationSource = combined;
  const punctuationSentences = splitParagraphs(punctuationSource).flatMap((paragraph) => splitSentences(paragraph, language));
  const punctuation = {
    periods: language === "en" ? countEnglishTerminalPeriods(punctuationSentences) : countPattern(punctuationSource, /[。]/gu),
    commas: countPattern(punctuationSource, /[，,]/gu),
    semicolons: countPattern(punctuationSource, /[；;]/gu),
    colons: countPattern(punctuationSource, /[：:]/gu),
    questionMarks: countPattern(punctuationSource, /[？?]/gu),
    exclamationMarks: countPattern(punctuationSource, /[！!]/gu),
    ellipses: countPattern(punctuationSource, /……|\.\.\./gu),
    emDashes: countPattern(punctuationSource, /——|—/gu),
    parentheses: countPattern(punctuationSource, /[（(]/gu),
    quotationMarks: countQuotationMarks(punctuationSource, language)
  };
  const logicVisibility = language === "zh"
    ? {
        conditions: categoryTotal(categoryResults, "条件与假设"),
        causeAndInference: categoryTotal(categoryResults, "因果与推导"),
        contrastAndCorrection: categoryTotal(categoryResults, "转折与修正"),
        sequenceAndTime: categoryTotal(categoryResults, "顺序与时间"),
        summaryAndRestatement: categoryTotal(categoryResults, "总结与重述")
      }
    : {
        conditions: categoryTotal(categoryResults, "conditions"),
        causeAndInference: categoryTotal(categoryResults, "cause_and_inference"),
        contrastAndCorrection: categoryTotal(categoryResults, "contrast_and_correction"),
        sequenceAndTime: categoryTotal(categoryResults, "sequence"),
        summaryAndRestatement: categoryTotal(categoryResults, "summary_and_restatement")
      };
  return {
    note: language === "zh"
      ? "这里只是机械指标。句法、叙述距离、情绪、留白、修辞、幽默和声音一致性仍须结合样本上下文判断。"
      : "Mechanical indicators only. Interpret syntax, narrative distance, emotion, ellipsis, rhetoric, humor, and voice consistency from sampled context.",
    paragraphLength: numericSummary(paragraphLengths),
    sentenceLength: numericSummary(sentenceLengths),
    paragraphSentenceCount: numericSummary(paragraphSentenceCounts),
    sentenceTypes,
    rhythm: analyzeRhythm(paragraphs, language),
    paragraphShape,
    punctuation,
    logicVisibility,
    categoryCombinations: analyzeCategoryCombinations(paragraphs, sentences, activeCategories(categoryResults), language)
  };
}

function buildSourceLabels(files, inputRoot, pathMode) {
  return new Map(files.map((file, index) => {
    const resolved = path.resolve(file);
    let label;
    if (pathMode === "absolute") label = resolved;
    else if (pathMode === "relative") label = path.relative(inputRoot, resolved) || path.basename(resolved);
    else label = `source-${String(index + 1).padStart(4, "0")}${path.extname(resolved).toLowerCase()}`;
    return [resolved, label];
  }));
}

function reportPathLabel(value, pathMode, anonymousStem) {
  if (!value) return null;
  const resolved = path.resolve(value);
  if (pathMode === "absolute") return resolved;
  if (pathMode === "relative") return path.basename(resolved);
  return `${anonymousStem}${path.extname(resolved).toLowerCase()}`;
}

function main() {
  const { inputArg, outputArg, options } = parseArgs(process.argv.slice(2));
  if (!inputArg) {
    usage();
    process.exitCode = 1;
    return;
  }
  const excludedPaths = new Set(
    [outputArg, options.sampleOutput]
      .filter(Boolean)
      .map((item) => path.resolve(item))
  );
  const files = collectFiles(inputArg, excludedPaths).filter((file) => !isGeneratedSampleFile(file));
  if (files.length === 0) throw new Error("No supported .txt, .md, or .jsonl files were found.");
  let globalIndex = 0;
  const sourceFiles = files.map((file) => readSourceFile(file));
  const sourceDocuments = sourceFiles
    .flatMap((sourceFile) => sourceFile.documents)
    .map((document, sourceDocumentIndex) => {
      const markupMode = path.extname(document.file).toLowerCase() === ".md" ? "markdown" : "plain";
      const paragraphs = splitParagraphRecords(document.text, markupMode).map((paragraph, paragraphIndex) => ({
        file: document.file,
        sourceDocumentIndex,
        recordIndex: document.recordIndex,
        jsonlLine: document.jsonlLine,
        paragraphIndex,
        globalIndex: globalIndex++,
        text: paragraph.text,
        analysisText: paragraph.analysisText
      }));
      return { ...document, sourceDocumentIndex, paragraphs };
    });
  if (sourceDocuments.length === 0) throw new Error("No text records were found in the supported input files.");
  const sourceCombined = sourceDocuments.map((item) => item.text).join("\n");
  const allParagraphs = sourceDocuments.flatMap((item) => item.paragraphs);
  const sourceParagraphs = allParagraphs.filter((item) => item.analysisText.trim());
  const eligibleParagraphs = sourceParagraphs.filter((item) => [...item.analysisText].length >= options.minParagraphChars);
  if (eligibleParagraphs.length === 0) {
    throw new Error("No paragraphs met --min-paragraph-chars. Lower the threshold or inspect the input corpus.");
  }
  const languageBasis = eligibleParagraphs.map((item) => item.analysisText).join("\n");
  const languageEvidence = {
    ...inspectLanguage(languageBasis),
    basis: "eligible_analysis_text"
  };
  const language = options.language === "auto" ? detectLanguage(languageEvidence) : options.language;
  const sampledParagraphs = sampleParagraphs(eligibleParagraphs, options.sampleSize, options.sampleStrategy, options.sampleSeed);
  const grouped = new Map();
  for (const paragraph of sampledParagraphs) {
    if (!grouped.has(paragraph.sourceDocumentIndex)) {
      grouped.set(paragraph.sourceDocumentIndex, {
        file: paragraph.file,
        sourceDocumentIndex: paragraph.sourceDocumentIndex,
        recordIndex: paragraph.recordIndex,
        jsonlLine: paragraph.jsonlLine,
        paragraphs: []
      });
    }
    grouped.get(paragraph.sourceDocumentIndex).paragraphs.push(paragraph.analysisText);
  }
  const documents = [...grouped.values()].map((item) => ({ ...item, text: item.paragraphs.join("\n") }));
  const combined = documents.map((item) => item.text).join("\n");
  const sentences = sampledParagraphs.flatMap((item) => splitSentences(item.analysisText, language));
  const unitSize = language === "zh"
    ? (combined.match(/[\p{Script=Han}]/gu) || []).length
    : (combined.match(/[A-Za-z][A-Za-z'’-]*/g) || []).length;
  const categories = resolveCategories(language, options);
  if (language === "zh") configureZhSingleTerms(categories);
  const termAnalysisCache = new Map();
  const analyzeCachedTerm = (term) => {
    const cacheKey = language === "en" ? term.toLowerCase() : term;
    if (!termAnalysisCache.has(cacheKey)) {
      termAnalysisCache.set(cacheKey, analyzeTerm(term, documents, sampledParagraphs, sentences, language, unitSize));
    }
    return termAnalysisCache.get(cacheKey);
  };
  const categoryResults = Object.entries(categories).map(([category, terms]) => {
    const analyzedForms = terms
      .map((term) => analyzeCachedTerm(term))
      .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term));
    const forms = analyzedForms.filter((item) => item.count >= options.minCount);
    return {
      category,
      totalHits: analyzedForms.reduce((sum, item) => sum + item.count, 0),
      dominantForms: forms,
      belowMinimumForms: analyzedForms
        .filter((item) => item.count > 0 && item.count < options.minCount)
        .map(({ term, count }) => ({ term, count })),
      ambiguousReferenceForms: analyzedForms
        .filter((item) => (item.ambiguousSubstringCount ?? 0) > 0)
        .map(({ term, count, substringCount, prefixCandidateCount, ambiguousSubstringCount, matchMode }) => ({
          term,
          confirmedCount: count,
          substringCount,
          prefixCandidateCount,
          ambiguousSubstringCount,
          matchMode
        })),
      absentReferenceForms: analyzedForms
        .filter((item) => item.count === 0 && (item.substringCount ?? 0) === 0)
        .map((item) => item.term),
      finding: language === "zh"
        ? "需要结合上下文解释；参考分类不是最终文风结论。"
        : "Requires contextual interpretation; reference categories are not final style conclusions."
    };
  });
  const edges = sentenceEdges(sentences, language);
  const styleMetrics = analyzeStyleMetrics(sampledParagraphs, sentences, combined, language, categoryResults);
  const inputResolved = path.resolve(inputArg);
  const inputIsDirectory = fs.statSync(inputResolved).isDirectory();
  const inputRoot = inputIsDirectory ? inputResolved : path.dirname(inputResolved);
  const sourceLabels = buildSourceLabels(files, inputRoot, options.pathMode);
  const sourceLabel = (file) => sourceLabels.get(path.resolve(file));
  const paragraphReferences = sampledParagraphs.map((item) => ({
    file: sourceLabel(item.file),
    sourceDocumentIndex: item.sourceDocumentIndex,
    recordIndex: item.recordIndex,
    jsonlLine: item.jsonlLine,
    paragraphIndex: item.paragraphIndex,
    globalIndex: item.globalIndex
  }));
  if (options.sampleOutput) {
    const samplePath = path.resolve(options.sampleOutput);
    fs.mkdirSync(path.dirname(samplePath), { recursive: true });
    const sampleLines = sampledParagraphs.map((item) => JSON.stringify({
      recordType: GENERATED_SAMPLE_RECORD_TYPE,
      file: sourceLabel(item.file),
      sourceDocumentIndex: item.sourceDocumentIndex,
      recordIndex: item.recordIndex,
      jsonlLine: item.jsonlLine,
      paragraphIndex: item.paragraphIndex,
      globalIndex: item.globalIndex,
      text: item.text
    }));
    fs.writeFileSync(samplePath, `${sampleLines.join("\n")}\n`, "utf8");
  }
  const result = {
    schemaVersion: 3,
    reportType: "LexiconScanReport",
    language,
    languageEvidence,
    note: language === "zh"
      ? "这里只是第一轮词汇统计。分类与短语可能重叠，因此总数不能相加。文档覆盖对 .txt/.md 按文件计算，对 .jsonl 按含文本记录计算。多义词、题材词、搭配和可迁移性仍须结合上下文复核。"
      : "First-pass lexical statistics only. Categories and phrases may overlap, so totals are not additive. Document coverage uses one document per .txt/.md file and one document per text-bearing .jsonl record. Review polysemy, topic terms, collocations, and transferability in context.",
    corpus: {
      input: options.pathMode === "absolute"
        ? inputResolved
        : options.pathMode === "relative"
          ? path.basename(inputResolved)
          : `input-${inputIsDirectory ? "directory" : `file${path.extname(inputResolved).toLowerCase()}`}`,
      pathMode: options.pathMode,
      sourceFiles: files.length,
      sourceDocuments: sourceDocuments.length,
      jsonlDiagnostics: sourceFiles
        .filter((sourceFile) => sourceFile.jsonlDiagnostics)
        .map((sourceFile) => ({
          file: sourceLabel(sourceFile.file),
          ...sourceFile.jsonlDiagnostics
        })),
      sourceCharacters: sourceCombined.length,
      sourceRecords: allParagraphs.length,
      sourceParagraphs: sourceParagraphs.length,
      eligibleParagraphs: eligibleParagraphs.length,
      documents: documents.length,
      files: files.map((file) => sourceLabel(file)),
      characters: combined.length,
      normalizedUnit: language === "zh" ? "han_characters" : "words",
      normalizedUnitCount: unitSize,
      sentences: sentences.length
    },
    sampling: {
      enabled: options.sampleSize > 0 && options.sampleSize < eligibleParagraphs.length,
      requestedSize: options.sampleSize,
      sampledParagraphs: sampledParagraphs.length,
      strategy: options.sampleStrategy,
      seed: options.sampleSeed,
      minParagraphChars: options.minParagraphChars,
      sampleOutput: reportPathLabel(options.sampleOutput, options.pathMode, "sample-output"),
      paragraphReferences
    },
    parameters: {
      language: options.language,
      termsFile: reportPathLabel(options.termsFile, options.pathMode, "terms-file"),
      termsMode: options.termsMode,
      openTop: options.openTop,
      minCount: options.minCount,
      pathMode: options.pathMode
    },
    categories: categoryResults,
    openVocabulary: topCounts(tokenize(combined, language), options.openTop),
    styleMetrics,
    ...edges
  };
  const json = `${JSON.stringify(result, null, 2)}\n`;
  if (outputArg) {
    fs.mkdirSync(path.dirname(path.resolve(outputArg)), { recursive: true });
    fs.writeFileSync(path.resolve(outputArg), json, "utf8");
  } else {
    process.stdout.write(json);
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
