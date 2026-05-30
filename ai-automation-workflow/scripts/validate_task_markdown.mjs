#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs, requireOption } from "./lib/tencent-docs.mjs";

function usage() {
  console.error(`用法：
  node validate_task_markdown.mjs --md <tasks.md>

检查主 Markdown 是否符合任务包截图规则：
  - 不允许文末 Unmapped/Full-Size Screenshot Gallery。
  - 不允许用 all_screenshots*.md 或 README 替代正文截图。
  - 不允许 docimg 外链或 imageMogr2/thumbnail 缩略图。
  - 截图必须出现在具体任务段落中。`);
}

function lineNumberAt(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) return usage();
  const mdPath = resolve(requireOption(opts, "md"));
  const text = readFileSync(mdPath, "utf8");
  const failures = [];

  const forbiddenPatterns = [
    [/Unmapped\s+Docimg\s+Image\s+Gallery/i, "不允许把未映射图片放进主 Markdown 图库"],
    [/Full-?Size\s+Screenshot\s+Gallery/i, "不允许把全量图片池追加到主 Markdown 末尾"],
    [/all_screenshots(?:_full)?\.md/i, "不允许用 all_screenshots*.md 替代主 Markdown 正文截图"],
    [/未按行号精确映射图库|另见全量截图|全量截图预览/i, "不允许在主 Markdown 中用旁路图库说明替代正文截图"],
    [/docimg\d*\.docs\.qq\.com/i, "主 Markdown 不允许引用 docimg 外链，必须引用本地图片"],
    [/imageMogr2\/thumbnail/i, "主 Markdown 不允许引用 thumbnail 缩略图"],
  ];

  for (const [pattern, message] of forbiddenPatterns) {
    const match = pattern.exec(text);
    if (match) failures.push({ line: lineNumberAt(text, match.index), message });
  }

  const imageMatches = [...text.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)];
  for (const match of imageMatches) {
    const target = match[1].trim();
    if (/^https?:\/\//i.test(target)) {
      failures.push({ line: lineNumberAt(text, match.index), message: `图片必须是本地路径，当前是外链：${target}` });
    }
  }

  const sections = text.split(/(?=^##\s+\d+\.\s+)/m).filter((section) => /^##\s+\d+\.\s+/m.test(section));
  const galleryLikeSections = sections.filter((section) => /^##\s+\d+\.\s*(Screenshot|Docimg|Image)\b/im.test(section));
  for (const section of galleryLikeSections) {
    const index = text.indexOf(section);
    failures.push({ line: lineNumberAt(text, index), message: "任务段落标题不能是泛化截图/图片编号，图片必须挂在具体任务标题下" });
  }

  if (failures.length) {
    console.error(JSON.stringify({ md: mdPath, ok: false, failures }, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify({ md: mdPath, ok: true, imageCount: imageMatches.length, taskSectionCount: sections.length }, null, 2));
}

main();
