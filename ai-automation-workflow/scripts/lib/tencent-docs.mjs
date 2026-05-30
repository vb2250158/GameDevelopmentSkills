import { execFileSync } from "node:child_process";

const DEFAULT_ENDPOINT = "https://docs.qq.com/openapi/mcp";
const MCP_PROTOCOL_VERSION = "2025-06-18";

export function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) throw new Error(`不支持的位置参数：${arg}`);
    const key = arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (i + 1 >= argv.length || argv[i + 1].startsWith("--")) {
      opts[key] = true;
    } else {
      opts[key] = argv[i + 1];
      i += 1;
    }
  }
  return opts;
}

export function requireOption(opts, name) {
  if (opts[name] == null || opts[name] === "") throw new Error(`缺少 --${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`);
  return opts[name];
}

export function parseSheetUrl(urlText = "") {
  const url = new URL(urlText);
  const parts = url.pathname.split("/").filter(Boolean);
  const sheetIndex = parts.findIndex((item) => item === "sheet");
  return {
    fileId: sheetIndex >= 0 ? parts[sheetIndex + 1] : "",
    sheetId: url.searchParams.get("tab") || "",
  };
}

function readTokenFromRegistry() {
  if (process.platform !== "win32") return "";
  try {
    const output = execFileSync("reg", ["query", "HKCU\\Environment", "/v", "TENCENT_DOCS_TOKEN"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const line = output
      .split(/\r?\n/)
      .map((item) => item.trim())
      .find((item) => item.startsWith("TENCENT_DOCS_TOKEN"));
    return line?.replace(/^TENCENT_DOCS_TOKEN\s+REG_\w+\s+/, "").trim() || "";
  } catch {
    return "";
  }
}

export function getTencentDocsToken() {
  const token = process.env.TENCENT_DOCS_TOKEN || readTokenFromRegistry();
  if (!token) throw new Error("当前进程环境变量或 HKCU 用户环境中缺少 TENCENT_DOCS_TOKEN。");
  return token;
}

function parseSseJson(text) {
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") continue;
    return JSON.parse(data);
  }
  return JSON.parse(text);
}

export async function callTencentDocsTool(name, args, endpoint = DEFAULT_ENDPOINT) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: getTencentDocsToken(),
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`腾讯文档 MCP 返回 HTTP ${response.status}：${text.slice(0, 240)}`);
  const result = parseSseJson(text).result;
  if (result?.structuredContent !== undefined) return result.structuredContent;
  const contentText = result?.content?.find((item) => item.type === "text")?.text;
  return contentText ? JSON.parse(contentText) : result;
}

export async function getSheetInfo(urlText) {
  const { fileId } = parseSheetUrl(urlText);
  if (!fileId) throw new Error("无法从 docs.qq.com/sheet URL 解析 file id。");
  return callTencentDocsTool("sheet.get_sheet_info", { file_id: fileId });
}

export async function getRange(urlText, startRow, startCol, endRow, endCol) {
  const { fileId, sheetId } = parseSheetUrl(urlText);
  if (!fileId || !sheetId) throw new Error("URL 必须包含 /sheet/<file_id>?tab=<sheet_id>。");
  return callTencentDocsTool("sheet.get_cell_data", {
    file_id: fileId,
    sheet_id: sheetId,
    start_row: startRow,
    start_col: startCol,
    end_row: endRow,
    end_col: endCol,
    return_csv: false,
  });
}

export function cellValue(cell) {
  if (!cell) return "";
  if (cell.value_type === "NUMBER") return String(cell.number_value);
  if (cell.value_type === "BOOL") return String(cell.bool_value);
  if (cell.value_type === "FORMULA") return cell.formula || "";
  return cell.string_value || "";
}

export function cellsToMatrix(cells = []) {
  const map = new Map();
  for (const cell of cells) map.set(`${cell.row},${cell.col}`, cellValue(cell));
  return {
    get(row, col) {
      return map.get(`${row},${col}`) || "";
    },
    has(row, col) {
      return map.has(`${row},${col}`);
    },
  };
}

export function headerMap(cells = [], headerRow = 0) {
  const headers = new Map();
  for (const cell of cells) {
    if (cell.row !== headerRow) continue;
    const value = cellValue(cell).trim();
    if (value) headers.set(value, cell.col);
  }
  if (!headers.has("描述") && headers.has("截图") && headers.has("修正方案") && headers.has("状态")) {
    headers.set("描述", 0);
  }
  return headers;
}

export function requireHeader(headers, name) {
  if (!headers.has(name)) throw new Error(`缺少必需表头：${name}`);
  return headers.get(name);
}

export function excelSerialToDate(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "";
  const millis = Math.round((number - 25569) * 86400 * 1000);
  return new Date(millis).toISOString().slice(0, 10);
}

export function buildContiguousRanges(rows) {
  const sorted = [...new Set(rows)].sort((a, b) => a - b);
  const ranges = [];
  let start = null;
  let prev = null;
  for (const row of sorted) {
    if (start == null) {
      start = row;
      prev = row;
    } else if (row === prev + 1) {
      prev = row;
    } else {
      ranges.push([start, prev]);
      start = row;
      prev = row;
    }
  }
  if (start != null) ranges.push([start, prev]);
  return ranges;
}
