#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { escapeHtml, firstHeading, renderMarkdown, slugify } from "./render-language-style-html.mjs";
import { LANGUAGE_STYLE_READER_BEHAVIOR, LANGUAGE_STYLE_READER_CSS } from "./language-style-reader-css.mjs";

const STANDARD_FILE = "language-style-standard.html";
const SOURCE_FILES = [
  { fileName: "SKILL.md", relativePath: "SKILL.md" },
  { fileName: "four-layer-writing-contract.md", relativePath: "references/four-layer-writing-contract.md" },
  { fileName: "four-layer-style-data-schema.md", relativePath: "references/four-layer-style-data-schema.md" },
  { fileName: "four-layer-feature-catalog.json", relativePath: "references/four-layer-feature-catalog.json" },
  { fileName: "four-layer-type-catalog.json", relativePath: "references/four-layer-type-catalog.json" },
  { fileName: "文风参数化方法论_四层类型字典版.html", relativePath: "references/文风参数化方法论_四层类型字典版.html" },
  { fileName: "文风参数库_四层类型字典.json", relativePath: "references/文风参数库_四层类型字典.json" },
  { fileName: "lexical-extraction.md", relativePath: "references/lexical-extraction.md" },
  { fileName: "nonlexical-style-extraction.md", relativePath: "references/nonlexical-style-extraction.md" },
  { fileName: "style-extraction.md", relativePath: "references/style-extraction.md" },
];

function usage() {
  console.log(
    "Usage: node render-language-style-standard-html.mjs <clear-science-writing-directory> " +
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
  if (positional.length !== 1) throw new Error("Exactly one clear-science-writing directory is required");
  const root = path.resolve(positional[0]);
  return {
    root,
    outputPath: output ? path.resolve(output) : path.join(root, "references", STANDARD_FILE),
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

function loadSources(root) {
  return SOURCE_FILES.map((source) => {
    const filePath = path.join(root, source.relativePath);
    if (!fs.existsSync(filePath)) throw new Error(`Missing standard source: ${filePath}`);
    return { ...source, content: fs.readFileSync(filePath, "utf8") };
  });
}

function hashSources(sources) {
  const hash = crypto.createHash("sha256");
  for (const source of sources) {
    hash.update(source.relativePath);
    hash.update("\u0000");
    hash.update(source.content);
    hash.update("\u0000");
  }
  return hash.digest("hex");
}

function stripFrontmatter(markdown) {
  return markdown.replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*(?:\r?\n|$)/, "");
}

function splitH2(markdown) {
  const lines = stripFrontmatter(markdown).replaceAll("\r\n", "\n").split("\n");
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
  return { intro: intro.join("\n").trim(), sections };
}

function selectSections(markdown, names, { includeIntro = false } = {}) {
  const parsed = splitH2(markdown);
  const normalizedNames = names.map((name) => name.trim().toLocaleLowerCase());
  const selected = parsed.sections
    .filter((section) => normalizedNames.includes(section.title.trim().toLocaleLowerCase()))
    .map((section) => section.lines.join("\n").trim());
  return [includeIntro ? parsed.intro : "", ...selected].filter(Boolean).join("\n\n");
}

function standardSection(id, step, title, summary, body) {
  return `<section class="standard-section search-unit" id="${id}" data-searchable>
  <header class="section-heading"><div class="step-badge">${escapeHtml(step)}</div><div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(summary)}</p></div></header>
  <div class="section-body">${body}</div>
</section>`;
}

function catalogMarkdown(catalog, layer, typeCatalog = null) {
  if (layer === "lexical") {
    if (typeCatalog) return [
      "## 八大类与193种通用词汇类型",
      "",
      `词汇层包含 ${typeCatalog.vocabularyGroups.length} 个大类、${typeCatalog.vocabularyTypes.length} 种通用类型和 ${new Set(typeCatalog.vocabularyTypes.flatMap((item) => item.words ?? [])).size} 个去重候选词条。通用类型只规定检查范围；目标语料的词频、位置、组合和对照必须另行映射。`,
      "",
      ...typeCatalog.vocabularyGroups.map((group) => `- ${group.name}：${group.description}`),
    ].join("\n");
    return [
      "## 八大类与 130 个候选词汇类型",
      "",
      "这些类型只规定逐项检查范围。候选词形可以用于封闭扫描；开放语义类还要补充实际高频词和人工标注。零次只表示候选词形未出现，不能证明整个语义类别不存在。",
      "",
      ...catalog.vocabularyGroups.flatMap((group) => [`### ${group.name}`, "", group.types.map((item) => `- ${item.name}：${item.seedTerms.join("、")}`).join("\n"), ""]),
    ].join("\n");
  }
  if (layer === "sentence") {
    if (typeCatalog) return [
      "## 句式分类轴与具体模板",
      "",
      `句式层包含 ${typeCatalog.sentenceTypeAxes.length} 个分类轴、${typeCatalog.sentenceTypes.length} 种类型和 ${typeCatalog.sentencePatterns.length} 个具体模板。同一句可以同时命中多个分类轴；未建立目标统计映射时不能显示为零次。`,
      "",
      ...typeCatalog.sentenceTypeAxes.map((axis) => `- ${axis.name}：${axis.description}`),
    ].join("\n");
    return [
      "## 完整句式候选库",
      "",
      "句式候选库负责防止漏查。只有建立了可复核识别规则或人工标注，并完成频率、位置、组合和变化范围统计的类型，才能进入目标风格。",
      "",
      ...catalog.sentencePatternFamilies.flatMap((family) => [`### ${family.name}`, "", "| 类型 | 模板 | 客观关系 |", "|---|---|---|", family.types.map((item) => `| ${item.name} | ${item.template} | ${item.relation} |`).join("\n"), ""]),
    ].join("\n");
  }
  if (layer === "paragraph") {
    if (typeCatalog) return [
      "## 段落分类轴与具体模板",
      "",
      `段落层包含 ${typeCatalog.paragraphTypeAxes.length} 个分类轴、${typeCatalog.paragraphTypes.length} 种类型和 ${typeCatalog.paragraphPatterns.length} 个具体模板。类型用于多轴分类，模板记录完整的句子功能序列。`,
      "",
      ...typeCatalog.paragraphTypeAxes.map((axis) => `- ${axis.name}：${axis.description}`),
    ].join("\n");
    return [
      "## 段落结构候选库",
      "",
      "| 类型 | 句子功能顺序 |",
      "|---|---|",
      ...catalog.paragraphPatternCandidates.map((item) => `| ${item.name} | ${item.sequence.join(" → ")} |`),
    ].join("\n");
  }
  if (typeCatalog) return [
    "## 内容编排分类轴与具体模板",
    "",
    `整篇层包含 ${typeCatalog.contentTypeAxes.length} 个分类轴、${typeCatalog.contentTypes.length} 种类型和 ${typeCatalog.contentStructures.length} 个具体模板。类型用于说明整篇怎样编排，模板记录完整模块顺序。`,
    "",
    ...typeCatalog.contentTypeAxes.map((axis) => `- ${axis.name}：${axis.description}`),
  ].join("\n");
  return ["## 内容编排模块维度", "", ...catalog.contentStructureDimensions.map((name) => `- ${name}`)].join("\n");
}

export function buildStandardGuide(root) {
  const sources = loadSources(root);
  const digest = hashSources(sources);
  const anchorMap = new Map(sources.map((source) => [source.fileName, source.relativePath === "SKILL.md" ? "../SKILL.md" : source.relativePath.replace(/^references\//u, "")]));
  anchorMap.set(STANDARD_FILE, "standard-overview");
  const byName = new Map(sources.map((source) => [source.fileName, source.content]));
  const catalog = JSON.parse(byName.get("four-layer-feature-catalog.json"));
  const typeCatalog = JSON.parse(byName.get("four-layer-type-catalog.json"));
  const render = (markdown, id) => renderMarkdown(markdown, id, anchorMap);
  const navigationItems = [
    ["standard-overview", "先看整体"],
    ["standard-lexical", "第一层 · 词汇"],
    ["standard-sentence", "第二层 · 句式"],
    ["standard-paragraph", "第三层 · 段落结构"],
    ["standard-composition", "第四层 · 整篇编排"],
    ["standard-combined", "综合使用"],
    ["standard-validation", "提取与验证"],
  ];
  const navigation = navigationItems.map(([id, label]) => `<a href="#${id}">${label}</a>`).join("");

  const overviewMarkdown = selectSections(byName.get("SKILL.md"), ["先分清两种层级", "二、文风"], { includeIntro: true });
  const lexicalMarkdown = [catalogMarkdown(catalog, "lexical", typeCatalog), selectSections(byName.get("four-layer-writing-contract.md"), ["第一层：词汇维度"]), selectSections(byName.get("lexical-extraction.md"), [
    "两遍提取", "统计方法", "逐类回答“主要用什么”", "必须覆盖的词类", "句首、句末与组合", "多类词怎样共同出现", "开放发现", "区分来源词与内容词", "生成 LexicalProfile",
  ], { includeIntro: true })].filter(Boolean).join("\n\n");
  const sentenceMarkdown = [catalogMarkdown(catalog, "sentence", typeCatalog), selectSections(byName.get("four-layer-writing-contract.md"), ["第二层：句式维度"]), selectSections(byName.get("nonlexical-style-extraction.md"), ["句式档案"])].filter(Boolean).join("\n\n");
  const paragraphMarkdown = [catalogMarkdown(catalog, "paragraph", typeCatalog), selectSections(byName.get("four-layer-writing-contract.md"), ["第三层：段落维度"]), selectSections(byName.get("nonlexical-style-extraction.md"), ["段落档案"])].filter(Boolean).join("\n\n");
  const compositionMarkdown = [catalogMarkdown(catalog, "composition", typeCatalog), selectSections(byName.get("four-layer-writing-contract.md"), ["第四层：整篇编排维度"]), selectSections(byName.get("nonlexical-style-extraction.md"), ["整篇编排档案"])].filter(Boolean).join("\n\n");
  const combinedMarkdown = [selectSections(byName.get("four-layer-writing-contract.md"), ["基本规则", "维度检查矩阵", "四层校验"]), selectSections(byName.get("nonlexical-style-extraction.md"), ["两张分析地图", "先记录证据再判断效果", "阅读效果轴", "声音与表现策略", "一致性与场景变化"])].filter(Boolean).join("\n\n");
  const validationMarkdown = selectSections(byName.get("style-extraction.md"), ["选对样本", "先提取词汇", "从样本提取文风卡", "先保存 StyleExtractionReport", "生成 StyleProfile", "语言风格 Skill 的正式档案规范", "创建与验证语言风格 Skill", "验证提取结果", "命名语言风格"]);
  const sections = [
    standardSection("standard-overview", "00", "先看整体", "文风由词汇、句式、段落和整篇编排逐层形成；阅读效果与证据状态贯穿四层。", render(overviewMarkdown, "standard-overview")),
    standardSection("standard-lexical", "01", "第一层 · 词汇", "先统计实际使用的词、位置、搭配、覆盖和对照差异，再判断哪些词真正具有风格区分度。", render(lexicalMarkdown, "standard-lexical")),
    standardSection("standard-sentence", "02", "第二层 · 句式", "分析词语怎样组成言语行为、主语与责任、焦点、条件因果、否定、问句、命令、句长和标点。", render(sentenceMarkdown, "standard-sentence")),
    standardSection("standard-paragraph", "03", "第三层 · 段落结构", "分析段首怎样进入、中段怎样展开、段尾怎样退出，以及骨架、拆段、过渡和列表的稳定选择。", render(paragraphMarkdown, "standard-paragraph")),
    standardSection("standard-composition", "04", "第四层 · 整篇编排", "分析答案、背景、证据、反例、分支、行动和结尾在全文中的位置与顺序。", render(compositionMarkdown, "standard-composition")),
    standardSection("standard-combined", "05", "综合使用", "四层必须共同出现，并保留阅读效果、声音指纹、场景变化和不可迁移内容。", render(combinedMarkdown, "standard-combined")),
    standardSection("standard-validation", "06", "提取与验证", "所有结论必须可追溯、可复算、可对照、可证伪；证据不足时保留候选，不把空位补成稳定风格。", render(validationMarkdown, "standard-validation")),
  ].join("\n");
  const sourceLinks = sources.map((source) => {
    const href = source.relativePath === "SKILL.md" ? "../SKILL.md" : source.relativePath.replace(/^references\//u, "");
    return `<li><a href="${escapeHtml(href)}">${escapeHtml(source.relativePath)}</a></li>`;
  }).join("");
  const html = `<!doctype html>
<html lang="zh-CN" data-language-style-standard="generated">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="language-style-standard-source-hash" content="${digest}">
  <title>语言风格提取与生成通用规范</title>
  <style>
    :root{color-scheme:light;--bg:#f4f1e9;--panel:#fffdf7;--panel2:#ebe5d8;--text:#1f2722;--muted:#657067;--line:#d5cec0;--accent:#245f4b;--soft:#dce9e1;--code:#17231e;--shadow:0 14px 40px rgba(49,45,35,.08)}html[data-theme="dark"]{color-scheme:dark;--bg:#151a17;--panel:#1d241f;--panel2:#283029;--text:#eef3ee;--muted:#aab6ac;--line:#3c463e;--accent:#86c9aa;--soft:#243e32;--code:#0e1411;--shadow:0 14px 40px rgba(0,0,0,.25)}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.75 system-ui,-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}a{color:var(--accent)}.layout{display:grid;grid-template-columns:280px minmax(0,1fr);min-height:100vh}aside{position:sticky;top:0;height:100vh;padding:28px 22px;border-right:1px solid var(--line);overflow:auto}aside h1{font-size:1.1rem;line-height:1.35}aside nav{display:grid;gap:6px;margin-top:20px}aside nav a{padding:6px 8px;border-radius:7px;text-decoration:none}aside nav a:hover{background:var(--soft)}main{width:min(1180px,100%);padding:52px clamp(24px,5vw,72px) 90px}.hero{padding:32px;border:1px solid var(--line);border-radius:20px;background:linear-gradient(145deg,var(--panel),var(--soft));box-shadow:var(--shadow)}.hero h1{font-size:clamp(2rem,5vw,4rem);line-height:1.08;margin:8px 0 15px}.hero p{max-width:850px;color:var(--muted)}.eyebrow{color:var(--accent);font-weight:750;font-size:.75rem;letter-spacing:.08em}.controls{display:grid;grid-template-columns:minmax(220px,1fr) repeat(4,auto);gap:10px;margin:22px 0}.controls input,.controls button{border:1px solid var(--line);border-radius:10px;background:var(--panel);color:var(--text);padding:10px 13px}.controls button{cursor:pointer}.standard-section{margin:26px 0;border:1px solid var(--line);border-radius:18px;background:var(--panel);box-shadow:var(--shadow);overflow:hidden;scroll-margin-top:20px}.standard-section[hidden]{display:none}.section-heading{display:grid;grid-template-columns:auto 1fr;gap:16px;padding:24px 28px;background:linear-gradient(135deg,var(--panel2),var(--soft))}.section-heading h2{margin:0;font-size:1.7rem}.section-heading p{margin:5px 0 0;color:var(--muted);max-width:78ch}.step-badge{display:grid;place-items:center;width:46px;height:46px;border-radius:13px;background:var(--accent);color:var(--panel);font-weight:800}.section-body{padding:10px clamp(20px,4vw,44px) 42px}.section-body>h2{font-size:1.35rem;margin-top:2.2em;border-bottom:1px solid var(--line);padding-bottom:.35em}.section-body h3{font-size:1.12rem;margin-top:1.8em}.section-body p,.section-body li{max-width:88ch}blockquote{border-left:4px solid var(--accent);padding:.5em 1em;background:var(--soft)}code{font-family:"Cascadia Code",Consolas,monospace;font-size:.9em;background:var(--panel2);padding:.14em .35em;border-radius:5px}pre{overflow:auto;background:var(--code);color:#eef7f1;padding:18px;border-radius:11px}pre code{background:none;padding:0}.table-wrap{overflow:auto;margin:1.2em 0;border:1px solid var(--line);border-radius:10px}table{border-collapse:collapse;width:100%;min-width:680px;font-size:.9rem}th,td{text-align:left;vertical-align:top;padding:10px 12px;border-bottom:1px solid var(--line)}th{background:var(--panel2)}.source-review{margin:26px 0;border:1px solid var(--line);border-radius:14px;padding:0 18px;background:var(--panel)}.source-review summary{cursor:pointer;font-weight:750;padding:15px 0}.empty{display:none;padding:30px;text-align:center;color:var(--muted)}.empty.visible{display:block}@media(max-width:900px){.layout{display:block}aside{position:relative;height:auto;border-right:0;border-bottom:1px solid var(--line)}main{padding-top:28px}.controls{grid-template-columns:1fr 1fr}.controls input{grid-column:1/-1}}@media print{aside,.controls{display:none}.layout{display:block}main{width:100%;padding:0}.hero,.standard-section{box-shadow:none}.standard-section[hidden]{display:block}body{background:#fff;color:#111}}
    ${LANGUAGE_STYLE_READER_CSS}
  </style>
</head>
<body><a class="skip-link" href="#main-content">跳到正文</a><div class="layout">
  <aside aria-label="页面章节"><div class="eyebrow">CLEAR-SCIENCE-WRITING</div><h1>语言风格提取与生成通用规范</h1><nav aria-label="页面章节">${navigation}</nav></aside>
  <main id="main-content" tabindex="-1">
    <header class="hero"><div class="eyebrow">通用规范</div><h1>语言风格提取与生成通用规范</h1><p>这里统一说明词汇、句式、段落、整篇编排、命名、来源隔离、HTML 交付和验证要求。具体语言风格页面只填写自身参数，不重复复制这套方法。</p><p>源文件同步指纹：<code>${digest.slice(0,12)}</code></p></header>
    <div class="controls" role="search"><label class="sr-only" for="search">搜索通用规范</label><input id="search" type="search" placeholder="搜索通用规范"><button type="button" data-action="expand">全部展开</button><button type="button" data-action="collapse">全部折叠</button><button type="button" data-action="print">打印 / 导出 PDF</button><button type="button" data-action="theme">切换明暗</button></div>
    <div id="empty" class="empty">没有找到匹配内容。</div>${sections}<details class="source-review"><summary>查看通用规范源文件</summary><ul>${sourceLinks}</ul></details>
  </main>
</div><script>
${LANGUAGE_STYLE_READER_BEHAVIOR}
const root=document.documentElement;const panels=[...document.querySelectorAll('[data-searchable]')];const search=document.getElementById('search');const stored=localStorage.getItem('language-style-standard-theme');if(stored)root.dataset.theme=stored;search.addEventListener('input',()=>{const query=search.value.trim().toLocaleLowerCase();let visible=0;for(const panel of panels){const match=!query||panel.textContent.toLocaleLowerCase().includes(query);panel.hidden=!match;if(match)visible+=1}document.getElementById('empty').classList.toggle('visible',visible===0)});document.querySelector('[data-action="expand"]').addEventListener('click',()=>document.querySelectorAll('details').forEach(panel=>panel.open=true));document.querySelector('[data-action="collapse"]').addEventListener('click',()=>document.querySelectorAll('details').forEach(panel=>panel.open=false));document.querySelector('[data-action="print"]').addEventListener('click',()=>window.print());document.querySelector('[data-action="theme"]').addEventListener('click',()=>{root.dataset.theme=root.dataset.theme==='dark'?'light':'dark';localStorage.setItem('language-style-standard-theme',root.dataset.theme)});
</script></body></html>`;
  return { html, sourceHash: digest };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = buildStandardGuide(options.root);
  if (options.check) {
    if (!fs.existsSync(options.outputPath)) {
      console.error(`ERROR: Standard HTML is missing: ${options.outputPath}`);
      process.exit(1);
    }
    if (fs.readFileSync(options.outputPath, "utf8") !== result.html) {
      console.error(`ERROR: Standard HTML is out of date: ${options.outputPath}`);
      process.exit(1);
    }
    console.log(`Language style standard HTML is current: ${options.outputPath}`);
    return;
  }
  fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
  fs.writeFileSync(options.outputPath, result.html, "utf8");
  console.log(`Generated language style standard HTML: ${options.outputPath}`);
  if (options.open) {
    openInBrowser(options.outputPath);
    console.log(`Opened language style standard HTML in the system browser: ${options.outputPath}`);
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
