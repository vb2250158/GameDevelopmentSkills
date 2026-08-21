#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MARKDOWN_FILES = [
  "SKILL.md",
  "references/lexical-profile.md",
  "references/sentence-profile.md",
  "references/paragraph-profile.md",
  "references/composition-profile.md",
  "references/style-profile.md",
  "references/reply-style.md",
  "references/document-style.md",
];

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/gu, " ").trim();
}

function stripInlineMarkdown(value) {
  return value
    .replace(/!\[([^\]]*)\]\([^)]+\)/gu, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/gu, "$1")
    .replace(/`[^`]*`/gu, " ")
    .replace(/[*_~]/gu, "")
    .replace(/<https?:\/\/[^>]+>/gu, " ")
    .replace(/https?:\/\/\S+/gu, " ");
}

export function extractMarkdownBody(markdown) {
  const lines = markdown
    .replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*(?:\r?\n|$)/u, "")
    .replaceAll("\r\n", "\n")
    .split("\n");
  const kept = [];
  let inCode = false;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^```/u.test(line)) {
      inCode = !inCode;
      continue;
    }
    if (inCode || /^\s*#/u.test(line)) continue;
    if (line.includes("|") && index + 1 < lines.length) {
      const divider = lines[index + 1]
        .trim()
        .replace(/^\||\|$/gu, "")
        .split("|")
        .map((cell) => cell.trim());
      if (divider.length > 0 && divider.every((cell) => /^:?-{3,}:?$/u.test(cell))) {
        index += 2;
        while (index < lines.length && lines[index].includes("|") && lines[index].trim()) index += 1;
        index -= 1;
        continue;
      }
    }
    const prose = stripInlineMarkdown(
      line
        .replace(/^\s*(?:[-*+] |\d+[.)] )/u, "")
        .replace(/^\s*>\s?/u, ""),
    );
    if (prose.trim()) kept.push(prose.trim());
  }
  return normalizeWhitespace(kept.join("\n"));
}

function decodeEntities(value) {
  const named = new Map([
    ["amp", "&"], ["lt", "<"], ["gt", ">"], ["quot", '"'], ["#39", "'"], ["nbsp", " "],
  ]);
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/giu, (_match, entity) => {
    if (named.has(entity)) return named.get(entity);
    if (/^#x/iu.test(entity)) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    if (/^#/u.test(entity)) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    return _match;
  });
}

export function extractHtmlBody(html) {
  let body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/iu)?.[1] ?? html;
  body = body
    .replace(/<(?:script|style|head|nav)\b[^>]*>[\s\S]*?<\/(?:script|style|head|nav)>/giu, " ")
    .replace(/<section\b[^>]*class=["'][^"']*review-section[^"']*["'][^>]*>[\s\S]*?<\/section>/giu, " ")
    .replace(/<details\b[^>]*class=["'][^"']*raw-json[^"']*["'][^>]*>[\s\S]*?<\/details>/giu, " ")
    .replace(/<(?:table|pre)\b[^>]*>[\s\S]*?<\/(?:table|pre)>/giu, " ")
    .replace(/<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]>/giu, " ")
    .replace(/<(?:button|input|select|option|textarea)\b[^>]*>[\s\S]*?<\/(?:button|input|select|option|textarea)>/giu, " ")
    .replace(/<(?:button|input)\b[^>]*\/?\s*>/giu, " ")
    .replace(/<[^>]+>/gu, " ");
  return normalizeWhitespace(decodeEntities(body));
}

function languageStats(text, language) {
  const han = (text.match(/\p{Script=Han}/gu) ?? []).length;
  const latin = (text.match(/[A-Za-z]/gu) ?? []).length;
  const denominator = han + latin;
  const ratio = denominator === 0 ? 0 : language === "zh" ? han / denominator : latin / denominator;
  return {
    hanCharacters: han,
    latinLetters: latin,
    targetScriptRatio: Number(ratio.toFixed(4)),
    languageMatch: language === "zh" ? han >= 20 && ratio >= 0.55 : latin >= 50 && ratio >= 0.75,
  };
}

function representativeTerms(lexicalProfile, language) {
  const terms = [];
  for (const line of lexicalProfile.split(/\r?\n/u)) {
    if (!/^\|\s*L-\d+\s*\|/u.test(line)) continue;
    const cells = line.trim().replace(/^\||\|$/gu, "").split("|").map((cell) => cell.trim());
    if (cells.length < 6 || !/稳定|场景限定|stable|contextual/iu.test(cells[4])) continue;
    const observed = cells[2];
    if (/未独立统计|not independently measured/iu.test(observed)) continue;
    const candidates = language === "zh"
      ? observed.split(/[\s、，,；;／/]+/u).map((part) => part.match(/[\p{Script=Han}]{1,8}/u)?.[0]).filter(Boolean)
      : observed.split(/[\s,;\/]+/u).map((part) => part.match(/[A-Za-z][A-Za-z'-]{1,30}/u)?.[0]).filter(Boolean);
    for (const candidate of candidates.slice(0, 3)) {
      if (!terms.includes(candidate)) terms.push(candidate);
    }
  }
  return terms.slice(0, 40);
}

export function buildBodyAudit(skillDirectory) {
  const root = path.resolve(skillDirectory);
  const reportPath = path.join(root, "references", "style-extraction-report.json");
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const language = report.context?.language ?? "zh";
  const files = [];
  const sourceParts = [];
  const markdownBodies = [];
  for (const relativePath of MARKDOWN_FILES) {
    const absolutePath = path.join(root, relativePath);
    if (!fs.existsSync(absolutePath)) continue;
    const content = fs.readFileSync(absolutePath, "utf8");
    const body = extractMarkdownBody(content);
    sourceParts.push(`${relativePath}\0${content}`);
    markdownBodies.push(body);
    files.push({
      path: relativePath.replaceAll("\\", "/"),
      bodyCharacters: [...body].length,
      bodySha256: sha256(body),
      ...languageStats(body, language),
    });
  }
  const htmlPath = path.join(root, "references", "style-guide.html");
  const html = fs.readFileSync(htmlPath, "utf8");
  const htmlBody = extractHtmlBody(html);
  sourceParts.push(`references/style-guide.html\0${htmlBody}`);
  files.push({
    path: "references/style-guide.html",
    bodyCharacters: [...htmlBody].length,
    bodySha256: sha256(htmlBody),
    ...languageStats(htmlBody, language),
  });
  const markdownBody = normalizeWhitespace(markdownBodies.join("\n"));
  const lexicalProfile = fs.readFileSync(path.join(root, "references", "lexical-profile.md"), "utf8");
  const terms = representativeTerms(lexicalProfile, language);
  const combinedBody = `${markdownBody}\n${htmlBody}`;
  const observedTerms = terms
    .map((term) => ({ term, count: combinedBody.split(term).length - 1 }))
    .filter((item) => item.count > 0);
  return {
    profileVersion: report.profileVersion ?? null,
    language,
    exclusions: ["YAML frontmatter", "headings", "tables and table data", "code blocks", "raw JSON", "navigation and controls"],
    sourceHash: sha256(sourceParts.join("\n\0\n")),
    markdownBodySha256: sha256(markdownBody),
    htmlBodySha256: sha256(htmlBody),
    files,
    lexicalUse: {
      representativeTerms: terms,
      observedTerms,
      observedTermCount: observedTerms.length,
    },
  };
}

function main() {
  const [skillDirectory] = process.argv.slice(2);
  if (!skillDirectory) {
    console.error("Usage: node audit-language-style-body.mjs <skill-directory>");
    process.exit(2);
  }
  console.log(JSON.stringify(buildBodyAudit(skillDirectory), null, 2));
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) main();
