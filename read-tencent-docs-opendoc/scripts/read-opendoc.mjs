#!/usr/bin/env node

import { inflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

function usage(exitCode = 0) {
  const text = `Usage:
  node read-opendoc.mjs --url "<opendoc-url>" [--query text] [--format text|json|tsv]
  TENCENT_DOCS_OPENDOC_URL="<opendoc-url>" node read-opendoc.mjs --query text

Options:
  --url <url>          Tencent Docs dop-api/opendoc URL. May also be first positional arg.
  --query <text>       Search row text. Can be repeated.
  --start-row <n>      First 1-based row to print.
  --end-row <n>        Last 1-based row to print.
  --limit <n>          Maximum rows to print. Default: 20.
  --format <name>      text, json, or tsv. Default: text.
  --include-empty      Include empty cells in structured output.
  --zero-based         Print 0-based Tencent row/column indexes.
  --raw-numbers        Keep numeric/date serials as raw numbers.
  --out <path>         Write output to a file instead of stdout.
  --help              Show this help.
`;
  (exitCode === 0 ? console.log : console.error)(text.trimEnd());
  process.exit(exitCode);
}

function parseArgs(argv) {
  const opts = {
    url: process.env.TENCENT_DOCS_OPENDOC_URL || "",
    queries: [],
    format: "text",
    limit: 20,
    includeEmpty: false,
    zeroBased: false,
    rawNumbers: false,
    out: "",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      i += 1;
      if (i >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[i];
    };

    if (arg === "--help" || arg === "-h") usage(0);
    else if (arg === "--url") opts.url = next();
    else if (arg === "--query" || arg === "-q") opts.queries.push(next());
    else if (arg === "--start-row") opts.startRow = Number(next());
    else if (arg === "--end-row") opts.endRow = Number(next());
    else if (arg === "--limit") opts.limit = Number(next());
    else if (arg === "--format") opts.format = next();
    else if (arg === "--include-empty") opts.includeEmpty = true;
    else if (arg === "--zero-based") opts.zeroBased = true;
    else if (arg === "--raw-numbers") opts.rawNumbers = true;
    else if (arg === "--out") opts.out = next();
    else if (!arg.startsWith("-") && !opts.url) opts.url = arg;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!opts.url) throw new Error("Missing --url or TENCENT_DOCS_OPENDOC_URL.");
  if (!/docs\.qq\.com\/dop-api\/opendoc/.test(opts.url)) {
    throw new Error("Expected a docs.qq.com dop-api/opendoc URL.");
  }
  if (!["text", "json", "tsv"].includes(opts.format)) {
    throw new Error("--format must be text, json, or tsv.");
  }
  if (!Number.isFinite(opts.limit) || opts.limit < 1) opts.limit = 20;
  return opts;
}

function stripJsonp(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return trimmed;
  const match = /^[^(]*\(([\s\S]*)\);?\s*$/.exec(trimmed);
  if (!match) throw new Error("Response is neither JSON nor recognized JSONP.");
  return match[1];
}

function readVarint(buf, offset) {
  let value = 0n;
  let shift = 0n;
  let pos = offset;
  while (pos < buf.length) {
    const byte = buf[pos];
    pos += 1;
    value |= BigInt(byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) return [Number(value), pos];
    shift += 7n;
    if (shift > 70n) throw new Error("Varint is too long.");
  }
  throw new Error("Unexpected EOF while reading varint.");
}

function entries(buf) {
  const out = [];
  let pos = 0;
  while (pos < buf.length) {
    const start = pos;
    let tag;
    [tag, pos] = readVarint(buf, pos);
    const field = tag >> 3;
    const wire = tag & 7;
    let value;

    if (wire === 0) {
      [value, pos] = readVarint(buf, pos);
    } else if (wire === 1) {
      if (pos + 8 > buf.length) throw new Error("Truncated fixed64.");
      value = buf.readDoubleLE(pos);
      pos += 8;
    } else if (wire === 2) {
      let len;
      [len, pos] = readVarint(buf, pos);
      if (len < 0 || pos + len > buf.length) throw new Error("Truncated length-delimited field.");
      value = buf.subarray(pos, pos + len);
      pos += len;
    } else if (wire === 5) {
      if (pos + 4 > buf.length) throw new Error("Truncated fixed32.");
      value = buf.readFloatLE(pos);
      pos += 4;
    } else {
      throw new Error(`Unsupported protobuf wire type ${wire}.`);
    }

    if (pos <= start) throw new Error("Parser made no progress.");
    out.push({ field, wire, value });
  }
  return out;
}

function tryEntries(buf) {
  try {
    return entries(buf);
  } catch {
    return null;
  }
}

function firstFieldValue(buf, field, nestedField = 1) {
  const all = tryEntries(buf);
  if (!all) return undefined;
  const found = all.find((entry) => entry.field === field);
  if (!found) return undefined;
  if (found.wire !== 2) return found.value;
  const nested = tryEntries(found.value);
  if (!nested) return found.value.toString("utf8");
  const value = nested.find((entry) => entry.field === nestedField);
  if (!value) return 0;
  if (value.wire === 2) return value.value.toString("utf8");
  return value.value;
}

function scanForSheetMessages(buf, path = [], out = [], depth = 0) {
  if (depth > 12 || buf.length === 0) return out;
  const all = tryEntries(buf);
  if (!all) return out;

  const cellCount = all.filter((entry) => entry.field === 6 && entry.wire === 2).length;
  const hasPool = all.some((entry) => entry.field === 5 && entry.wire === 2);
  if (cellCount > 0 && hasPool) out.push({ buf, path, cellCount });

  for (const entry of all) {
    if (entry.wire === 2 && entry.value.length > 1) {
      scanForSheetMessages(entry.value, path.concat(entry.field), out, depth + 1);
    }
  }
  return out;
}

function extractTextPool(poolBuf) {
  return entries(poolBuf)
    .filter((entry) => entry.field === 1 && entry.wire === 2)
    .map((entry) => {
      const nested = tryEntries(entry.value);
      const textEntry = nested?.find((item) => item.field === 1 && item.wire === 2);
      return (textEntry ? textEntry.value : entry.value).toString("utf8");
    });
}

function extractNumberPool(poolBuf) {
  return entries(poolBuf)
    .filter((entry) => entry.field === 3 && entry.wire === 2)
    .map((entry) => {
      const nested = tryEntries(entry.value);
      return nested?.find((item) => item.field === 1)?.value;
    });
}

function excelSerialToDate(serial) {
  if (!Number.isFinite(serial) || serial < 30000 || serial > 70000) return null;
  const millis = Math.round((serial - 25569) * 86400 * 1000);
  return new Date(millis).toISOString().slice(0, 10);
}

function textFromJsonPayload(raw) {
  if (!raw || typeof raw !== "string") return "";
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) return "";
      if (typeof parsed[0] === "string" && /^https?:\/\//.test(parsed[0])) return `[image] ${parsed[0]}`;
      if (Array.isArray(parsed[0])) {
        return parsed
          .map((item) => {
            if (Array.isArray(item)) return item[1] || item[0] || "";
            return String(item ?? "");
          })
          .filter(Boolean)
          .join(", ");
      }
    }
  } catch {
    return raw;
  }
  return raw;
}

function extractCellText(cellPayload, textPool, numberPool, opts) {
  const cellType = firstFieldValue(cellPayload, 1);
  const valueIndex = firstFieldValue(cellPayload, 2);
  const richJson = firstFieldValue(cellPayload, 17);
  const richText = textFromJsonPayload(typeof richJson === "string" ? richJson : "");
  if (richText) return richText;

  if (typeof valueIndex !== "number") return "";

  if (cellType === 2) {
    const number = numberPool[valueIndex];
    if (number === undefined) return "";
    if (opts.rawNumbers) return String(number);
    return excelSerialToDate(number) || String(number);
  }

  return textPool[valueIndex] || "";
}

function parseRelatedSheet(base64, opts) {
  const inflated = inflateSync(Buffer.from(base64, "base64"));
  const candidates = scanForSheetMessages(inflated).sort((a, b) => b.cellCount - a.cellCount);
  if (candidates.length === 0) throw new Error("Could not locate a sheet message in related_sheet.");

  const sheetEntries = entries(candidates[0].buf);
  const poolBuf = sheetEntries.find((entry) => entry.field === 5 && entry.wire === 2)?.value;
  if (!poolBuf) throw new Error("Could not locate the sheet value pool.");

  const textPool = extractTextPool(poolBuf);
  const numberPool = extractNumberPool(poolBuf);
  const rows = new Map();
  let maxCol = 0;

  for (const cell of sheetEntries.filter((entry) => entry.field === 6 && entry.wire === 2)) {
    const cellEntries = entries(cell.value);
    const row = cellEntries.find((entry) => entry.field === 1)?.value ?? 0;
    const col = cellEntries.find((entry) => entry.field === 2)?.value ?? 0;
    const payload = cellEntries.find((entry) => entry.field === 3 && entry.wire === 2)?.value;
    if (!payload) continue;

    const text = extractCellText(payload, textPool, numberPool, opts);
    if (!rows.has(row)) rows.set(row, new Map());
    rows.get(row).set(col, text);
    if (col > maxCol) maxCol = col;
  }

  return {
    path: candidates[0].path.join("."),
    cellCount: candidates[0].cellCount,
    textPoolSize: textPool.length,
    numberPoolSize: numberPool.length,
    rows,
    maxCol,
  };
}

function rowToObject(rowIndex, cells, opts) {
  const rowNumber = opts.zeroBased ? rowIndex : rowIndex + 1;
  const result = { row: rowNumber, cells: {} };
  const sorted = [...cells.entries()].sort((a, b) => a[0] - b[0]);
  for (const [col, text] of sorted) {
    if (!opts.includeEmpty && !text) continue;
    const colName = opts.zeroBased ? `C${col}` : `C${col + 1}`;
    result.cells[colName] = text;
  }
  return result;
}

function filterRows(parsed, opts) {
  const lowerQueries = opts.queries.map((query) => query.toLocaleLowerCase());
  const rows = [...parsed.rows.entries()].sort((a, b) => a[0] - b[0]);
  const start = opts.startRow == null ? -Infinity : opts.startRow - 1;
  const end = opts.endRow == null ? Infinity : opts.endRow - 1;

  const filtered = [];
  for (const [rowIndex, cells] of rows) {
    if (rowIndex < start || rowIndex > end) continue;
    const haystack = [...cells.values()].join("\t").toLocaleLowerCase();
    if (lowerQueries.length > 0 && !lowerQueries.every((query) => haystack.includes(query))) continue;
    filtered.push(rowToObject(rowIndex, cells, opts));
    if (filtered.length >= opts.limit) break;
  }
  return filtered;
}

function renderText(meta, rows) {
  const lines = [
    `title: ${meta.title || ""}`,
    `tab: ${meta.tabName || meta.tabId || ""}`,
    `sheetPath: ${meta.sheetPath}`,
    `cells: ${meta.cellCount}`,
    `matches: ${rows.length}`,
    "",
  ];

  for (const row of rows) {
    const parts = Object.entries(row.cells).map(([col, text]) => `${col}=${text}`);
    lines.push(`Row ${row.row}: ${parts.join(" | ")}`);
  }
  return lines.join("\n");
}

function renderTsv(rows) {
  const allCols = [...new Set(rows.flatMap((row) => Object.keys(row.cells)))].sort(
    (a, b) => Number(a.slice(1)) - Number(b.slice(1)),
  );
  const lines = [["row", ...allCols].join("\t")];
  for (const row of rows) {
    lines.push([row.row, ...allCols.map((col) => row.cells[col] || "")].join("\t"));
  }
  return lines.join("\n");
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const response = await fetch(opts.url, {
    headers: {
      referer: "https://docs.qq.com/",
      "user-agent": "Mozilla/5.0",
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} while fetching opendoc.`);

  const payload = JSON.parse(stripJsonp(await response.text()));
  const sheetText = payload.clientVars?.collab_client_vars?.initialAttributedText?.text?.[0];
  const blocks = Array.isArray(sheetText?.block_datas) ? sheetText.block_datas : [];
  const block = blocks.find((item) => typeof item?.related_sheet === "string" && item.related_sheet.length > 0);
  if (!block) throw new Error("No related_sheet block found in opendoc payload.");

  const parsed = parseRelatedSheet(block.related_sheet, opts);
  const headerTabs = payload.clientVars?.collab_client_vars?.header?.[0]?.d || [];
  const tabId = payload.clientVars?.collab_client_vars?.padSubId || "";
  const tabName = headerTabs.find((tab) => tab.id === tabId)?.name || "";
  const rows = filterRows(parsed, opts);
  const meta = {
    title: payload.clientVars?.title || payload.clientVars?.initialTitle || payload.bodyData?.initialTitle || "",
    tabId,
    tabName,
    sheetPath: parsed.path,
    cellCount: parsed.cellCount,
    textPoolSize: parsed.textPoolSize,
    numberPoolSize: parsed.numberPoolSize,
  };

  let output;
  if (opts.format === "json") output = JSON.stringify({ meta, rows }, null, 2);
  else if (opts.format === "tsv") output = renderTsv(rows);
  else output = renderText(meta, rows);

  if (opts.out) writeFileSync(opts.out, output, "utf8");
  else process.stdout.write(`${output}\n`);
}

main().catch((error) => {
  console.error(`read-opendoc failed: ${error.message}`);
  process.exit(1);
});
