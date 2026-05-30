#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import {
  cellsToMatrix,
  excelSerialToDate,
  getRange,
  getSheetInfo,
  headerMap,
  parseArgs,
  requireHeader,
  requireOption,
} from "./lib/tencent-docs.mjs";

function usage() {
  console.error(`用法：
  node export_tencent_bug_rows.mjs --url <docs-sheet-url> --out <tasks.md> --images-dir <dir> [--range A1:AZ501] [--owner <name>] [--status <text>] [--all-statuses] [--solution-state any|empty|nonempty] [--month YYYY-MM] [--submitter <name>] [--title <text>] [--source-md <path>] [--rows-out <rows.json>] [--manifest-out <manifest.json>]

说明：
  - 每次运行都会读取第 1 行表头。
  - 除 --month 外，筛选条件都是子串匹配；--month 会把“日期”序列值或字符串匹配成 YYYY-MM。
  - 未传 --status 时默认只导出“状态”包含 A未开始 的行；只有显式传 --all-statuses 才不过滤状态。
  - --solution-state empty 表示“修正方案”为空，即 AI 未接入；nonempty 表示已有修正方案，即 AI 已接入；默认 any。
  - 只有“截图”单元格文本包含直接 http(s) 图片 URL 时才会下载图片。
  - 下载 docimg*.docs.qq.com 图片时会带 Referer: https://docs.qq.com/，Markdown 写成本地图片引用。
  - 遇到 docimg 缩略图 URL（imageMogr2/thumbnail）会优先改成同一路径的非缩略图 URL 下载。
  - 如果提供 --source-md，会优先复用该 Markdown 清单中对应行/标题下已经内嵌的截图。
  - 如果截图列只有空格或空字符串，只表示当前表格读取通道未暴露嵌入图片 URL，不代表腾讯文档里没有图片。`);
}

function parseA1Range(text = "A1:AZ501") {
  const colToIndex = (letters) => {
    let value = 0;
    for (const char of letters.toUpperCase()) value = value * 26 + (char.charCodeAt(0) - 64);
    return value - 1;
  };
  const parseCell = (cell) => {
    const match = /^([A-Za-z]+)([1-9]\d*)$/.exec(cell);
    if (!match) throw new Error(`无效的 A1 单元格地址：${cell}`);
    return { row: Number(match[2]) - 1, col: colToIndex(match[1]) };
  };
  const [a, b = a] = text.split(":");
  const start = parseCell(a);
  const end = parseCell(b);
  return {
    startRow: Math.min(start.row, end.row),
    startCol: Math.min(start.col, end.col),
    endRow: Math.max(start.row, end.row),
    endCol: Math.max(start.col, end.col),
  };
}

function normalizeDate(value) {
  if (!value) return "";
  const serial = excelSerialToDate(value);
  if (serial) return serial;
  const match = String(value).match(/(20\d{2})[-/.年](\d{1,2})/);
  if (!match) return String(value);
  return `${match[1]}-${match[2].padStart(2, "0")}`;
}

function directImageUrls(value) {
  return [...String(value || "").matchAll(/https?:\/\/[^\s),\]]+/g)]
    .map((match) => match[0])
    .filter((url) => /\.(png|jpe?g|webp|gif)(\?|$)/i.test(url));
}

function normalizeImageUrl(url) {
  if (!/^https:\/\/docimg\d*\.docs\.qq\.com\//i.test(url)) return url;
  if (!/imageMogr2\/thumbnail/i.test(url)) return url;
  const parsed = new URL(url);
  return `${parsed.origin}${parsed.pathname}`;
}

function displayValue(value) {
  const text = String(value || "").trim();
  return text || "无";
}

function markdownPath(fromFile, targetFile) {
  return relative(dirname(fromFile), targetFile).replaceAll("\\", "/");
}

function parseSourceMarkdownImages(sourceMdPath) {
  if (!sourceMdPath) return new Map();
  const sourcePath = resolve(sourceMdPath);
  if (!existsSync(sourcePath)) throw new Error(`--source-md 不存在：${sourcePath}`);
  const sourceDir = dirname(sourcePath);
  const text = readFileSync(sourcePath, "utf8");
  const sections = text.split(/(?=^##\s+)/m);
  const byRow = new Map();
  for (const section of sections) {
    const heading = section.match(/^##\s+(\d+)\.\s+(.+)$/m);
    if (!heading) continue;
    const rowNumber = Number(heading[1]);
    const images = [...section.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)]
      .map((match) => match[1].trim())
      .filter(Boolean)
      .map((imagePath) => {
        if (/^[a-z]+:\/\//i.test(imagePath)) return imagePath;
        if (/^[A-Za-z]:[\\/]/.test(imagePath)) return imagePath;
        return resolve(sourceDir, imagePath);
      });
    if (images.length) byRow.set(rowNumber, images);
  }
  return byRow;
}

function priorityRank(value) {
  const match = String(value || "").match(/^\s*(\d+)/);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

async function downloadImage(url, imagesDir, rowNumber, index) {
  const downloadUrl = normalizeImageUrl(url);
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
  };
  if (/^https:\/\/docimg\d*\.docs\.qq\.com\//i.test(downloadUrl)) {
    headers.Referer = "https://docs.qq.com/";
  }
  const response = await fetch(downloadUrl, { headers });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const urlObj = new URL(downloadUrl);
  const ext = extname(urlObj.pathname) || ".png";
  const fileName = `row${String(rowNumber).padStart(3, "0")}_${index}${ext}`;
  const target = join(imagesDir, fileName);
  const buffer = Buffer.from(await response.arrayBuffer());
  writeFileSync(target, buffer);
  return { localPath: target, sourceUrl: url, downloadUrl };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) return usage();
  const url = requireOption(opts, "url");
  const out = resolve(requireOption(opts, "out"));
  const imagesDir = resolve(requireOption(opts, "imagesDir"));
  const rowsOut = resolve(opts.rowsOut || join(dirname(out), "rows.json"));
  const manifestOut = resolve(opts.manifestOut || join(imagesDir, "manifest.json"));
  const range = parseA1Range(opts.range || "A1:AZ501");
  const sourceImagesByRow = parseSourceMarkdownImages(opts.sourceMd);

  await getSheetInfo(url);
  const data = await getRange(url, range.startRow, range.startCol, range.endRow, range.endCol);
  const headers = headerMap(data.cells || [], range.startRow);
  const matrix = cellsToMatrix(data.cells || []);

  const col = {
    desc: requireHeader(headers, "描述"),
    screenshot: headers.get("截图"),
    submitter: headers.get("发起人"),
    date: headers.get("日期"),
    targetDate: headers.get("目标验收日期"),
    type: headers.get("类型"),
    details: headers.get("内容说明"),
    supplement1: headers.get("调整补充说明1"),
    supplement2: headers.get("调整补充说明2"),
    priority: headers.get("优先级"),
    status: headers.get("状态"),
    owner: headers.get("负责人"),
    solution: headers.get("修正方案"),
    solutionComment: headers.get("修正方案批注"),
    confirmSolution: headers.get("确认修正方案"),
  };
  const effectiveStatus = opts.allStatuses ? "" : String(opts.status || "A未开始");
  if (effectiveStatus && col.status == null) {
    throw new Error(`默认需要按状态 ${effectiveStatus} 筛选，但表头中未找到“状态”。如确实要不过滤状态，请传 --all-statuses。`);
  }
  const solutionState = String(opts.solutionState || "any").toLowerCase();
  if (!["any", "empty", "nonempty"].includes(solutionState)) {
    throw new Error("--solution-state 只支持 any、empty、nonempty。");
  }
  if (solutionState !== "any" && col.solution == null) {
    throw new Error(`需要按修正方案 ${solutionState} 筛选，但表头中未找到“修正方案”。`);
  }

  mkdirSync(imagesDir, { recursive: true });
  mkdirSync(dirname(out), { recursive: true });
  mkdirSync(dirname(rowsOut), { recursive: true });
  mkdirSync(dirname(manifestOut), { recursive: true });
  const rows = [];
  for (let row = range.startRow + 1; row <= range.endRow; row += 1) {
    const desc = matrix.get(row, col.desc).trim();
    if (!desc) continue;
    const owner = col.owner == null ? "" : matrix.get(row, col.owner).trim();
    const status = col.status == null ? "" : matrix.get(row, col.status).trim();
    const submitter = col.submitter == null ? "" : matrix.get(row, col.submitter).trim();
    const date = col.date == null ? "" : normalizeDate(matrix.get(row, col.date).trim());
    const solution = col.solution == null ? "" : matrix.get(row, col.solution).trim();
    if (opts.owner && !owner.includes(opts.owner)) continue;
    if (effectiveStatus && !status.includes(effectiveStatus)) continue;
    if (solutionState === "empty" && solution) continue;
    if (solutionState === "nonempty" && !solution) continue;
    if (opts.submitter && !submitter.includes(opts.submitter)) continue;
    if (opts.month && !date.startsWith(opts.month)) continue;
    const targetDate = col.targetDate == null ? "" : normalizeDate(matrix.get(row, col.targetDate).trim());
    const type = col.type == null ? "" : matrix.get(row, col.type).trim();
    const priority = col.priority == null ? "" : matrix.get(row, col.priority).trim();
    const solutionComment = col.solutionComment == null ? "" : matrix.get(row, col.solutionComment).trim();
    const confirmSolution = col.confirmSolution == null ? "" : matrix.get(row, col.confirmSolution).trim();
    rows.push({ row, rowNumber: row + 1, desc, owner, status, submitter, date, targetDate, type, priority, solution, solutionComment, confirmSolution });
  }
  rows.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || a.rowNumber - b.rowNumber);

  const filterParts = [`页签 \`${new URL(url).searchParams.get("tab") || "无"}\``];
  if (opts.owner) filterParts.push(`负责人列包含 \`${opts.owner}\``);
  if (effectiveStatus) filterParts.push(`状态包含 \`${effectiveStatus}\`${opts.status ? "" : "（默认）"}`);
  else filterParts.push("状态不过滤（显式 --all-statuses）");
  if (solutionState === "empty") filterParts.push("修正方案为空（AI 未接入）");
  if (solutionState === "nonempty") filterParts.push("修正方案非空（AI 已接入）");
  if (solutionState === "any") filterParts.push("修正方案不过滤");
  if (opts.month) filterParts.push(`日期月份为 \`${opts.month}\``);
  if (opts.submitter) filterParts.push(`提出/来源包含 \`${opts.submitter}\``);
  filterParts.push("按优先级从高到低排序");
  const bugCount = rows.filter((item) => item.type === "bug").length;
  const aiEngagedCount = rows.filter((item) => item.solution).length;

  const lines = [
    `# ${opts.title || "腾讯文档待处理任务清单"}`,
    "",
    `来源: [腾讯文档](${url})`,
    "",
    `筛选条件: ${filterParts.join(", ")}.`,
    "",
    `截图已下载到本地目录: \`${markdownPath(out, imagesDir)}/\`.`,
    "",
    `共 ${rows.length} 条; 其中类型列明确为 \`bug\` 的 ${bugCount} 条; 修正方案非空（AI 已接入）的 ${aiEngagedCount} 条.`,
    "",
  ];
  const rowsJson = [];
  const manifest = [];

  for (let itemIndex = 0; itemIndex < rows.length; itemIndex += 1) {
    const item = rows[itemIndex];
    const displayIndex = itemIndex + 1;
    const row = item.row;
    const screenshotRaw = col.screenshot == null ? "" : matrix.get(row, col.screenshot);
    const screenshotUrls = directImageUrls(screenshotRaw);
    const images = [];
    const sourceImages = sourceImagesByRow.get(item.rowNumber) || [];
    for (const image of sourceImages) {
      if (/^https?:\/\//i.test(image)) {
        images.push({
          localPath: "",
          markdownPath: "",
          sourceUrl: image,
          downloadUrl: normalizeImageUrl(image),
          downloadStatus: "source_markdown_external_not_embedded",
          mappingMethod: "source_markdown",
        });
      } else {
        images.push({
          localPath: image,
          markdownPath: markdownPath(out, image),
          sourceUrl: "",
          downloadUrl: "",
          downloadStatus: "source_markdown",
          mappingMethod: "source_markdown",
        });
      }
    }
    for (let i = 0; i < screenshotUrls.length; i += 1) {
      try {
        const image = await downloadImage(screenshotUrls[i], imagesDir, item.rowNumber, i + 1);
        images.push({
          localPath: image.localPath,
          markdownPath: markdownPath(out, image.localPath),
          sourceUrl: image.sourceUrl,
          downloadUrl: image.downloadUrl,
          downloadStatus: "downloaded",
          mappingMethod: "cell_text_url",
        });
      } catch (error) {
        images.push({
          localPath: "",
          markdownPath: "",
          sourceUrl: screenshotUrls[i],
          downloadUrl: normalizeImageUrl(screenshotUrls[i]),
          downloadStatus: `failed: ${error.message}`,
          mappingMethod: "cell_text_url",
        });
      }
    }

    lines.push(`## ${displayIndex}. ${item.desc}`, "");
    lines.push(`- 优先级: ${displayValue(item.priority)}`);
    lines.push(`- 状态: ${displayValue(item.status)}`);
    lines.push(`- 提出/来源: ${displayValue(item.submitter)}`);
    lines.push(`- 日期: ${displayValue(item.date)}`);
    lines.push(`- 目标验收: ${displayValue(item.targetDate)}`);
    lines.push(`- 类型: ${displayValue(item.type)}`);
    if (item.confirmSolution) lines.push(`- 确认修正方案: ${item.confirmSolution}`);
    const details = col.details == null ? "" : matrix.get(row, col.details).trim();
    const supplements = [
      ["调整补充说明1", col.supplement1 == null ? "" : matrix.get(row, col.supplement1).trim()],
      ["调整补充说明2", col.supplement2 == null ? "" : matrix.get(row, col.supplement2).trim()],
    ].filter(([, value]) => value);
    if (details) lines.push("", "**内容说明**", "", details);
    if (item.solution) lines.push("", "**已有修正方案**", "", item.solution);
    if (item.solutionComment) lines.push("", "**修正方案批注**", "", item.solutionComment);
    if (supplements.length) {
      lines.push("", "**调整补充说明**", "");
      for (const [label, value] of supplements) lines.push(`- ${label}: ${value}`);
    }
    const embeddableImages = images.filter((image) => image.localPath && image.markdownPath);
    const failedImages = images.filter((image) => !image.localPath && image.sourceUrl);
    if (embeddableImages.length) {
      lines.push("", "**截图**", "");
      for (let imageIndex = 0; imageIndex < embeddableImages.length; imageIndex += 1) {
        const image = embeddableImages[imageIndex];
        lines.push(`![截图${imageIndex + 1}](${image.markdownPath})`);
      }
      for (const image of failedImages) lines.push(`- 截图待下载：${image.sourceUrl} (${image.downloadStatus})`);
    } else if (screenshotRaw.trim()) {
      lines.push("", "**截图**", "", `- 原始截图单元格：${screenshotRaw.trim()}`);
    }
    rowsJson.push({
      sourceRowIndex: item.row,
      sourceRowNumber: item.rowNumber,
      title: item.desc,
      desc: item.desc,
      priority: item.priority,
      status: item.status,
      owner: item.owner,
      submitter: item.submitter,
      date: item.date,
      targetDate: item.targetDate,
      type: item.type,
      details,
      supplements: supplements.map(([label, value]) => ({ label, value })),
      solution: item.solution,
      solutionComment: item.solutionComment,
      confirmSolution: item.confirmSolution,
      images,
    });
    manifest.push({ sourceRowNumber: item.rowNumber, title: item.desc, images });
    lines.push("");
  }

  writeFileSync(out, `${lines.join("\n")}\n`, "utf8");
  writeFileSync(rowsOut, `${JSON.stringify({ source: url, count: rowsJson.length, rows: rowsJson }, null, 2)}\n`, "utf8");
  writeFileSync(manifestOut, `${JSON.stringify({ source: url, imagesDir, rows: manifest }, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ 输出文件: out, 行数据: rowsOut, 截图清单: manifestOut, 截图目录: imagesDir, 导出行数: rows.length, 文件名: basename(out) }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
