#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const DEFAULT_ENDPOINT = "https://docs.qq.com/openapi/mcp";
const MCP_PROTOCOL_VERSION = "2025-06-18";

function usage(exitCode = 0) {
  const text = `Usage:
  node tencent-docs-mcp.mjs list-tools [--query text] [--format text|json]
  node tencent-docs-mcp.mjs call-tool --name <tool> --args '<json>'
  node tencent-docs-mcp.mjs get-sheet-info --url <sheet-url>
  node tencent-docs-mcp.mjs get-range --url <sheet-url> --range A1:C3 [--csv]
  node tencent-docs-mcp.mjs set-cell --url <sheet-url> --cell A1 --value "你好"

Options:
  --endpoint <url>     MCP endpoint. Default: ${DEFAULT_ENDPOINT}
  --token <token>      Token value. Prefer TENCENT_DOCS_TOKEN instead.
  --name <tool>        MCP tool name for call-tool.
  --args <json>        JSON arguments for call-tool.
  --url <url>          Tencent Docs sheet URL, e.g. https://docs.qq.com/sheet/<file_id>?tab=<sheet_id>
  --file-id <id>       Tencent Docs file ID. Overrides --url parsing.
  --sheet-id <id>      Sheet/tab ID. Overrides --url tab parsing.
  --cell <A1>          A1 cell address for set-cell.
  --range <A1:C3>      A1 range for get-range.
  --row <n>            1-based row for set-cell/get-range.
  --col <n>            1-based column for set-cell/get-range.
  --start-row <n>      1-based start row for get-range.
  --start-col <n>      1-based start column for get-range.
  --end-row <n>        1-based end row for get-range.
  --end-col <n>        1-based end column for get-range.
  --value <value>      Value for set-cell.
  --type <type>        STRING, NUMBER, BOOL, or FORMULA. Default: infer.
  --csv                get-range returns CSV data.
  --format <name>      text or json. Default: text.
  --out <path>         Write output to a file.
  --dry-run            Print the tool call without executing it.
  --help               Show this help.

Token lookup order:
  1. --token
  2. TENCENT_DOCS_TOKEN in the current process
  3. HKCU\\Environment\\TENCENT_DOCS_TOKEN on Windows
`;
  (exitCode === 0 ? console.log : console.error)(text.trimEnd());
  process.exit(exitCode);
}

function parseArgs(argv) {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) usage(0);

  const opts = {
    command: argv[0],
    endpoint: process.env.TENCENT_DOCS_MCP_ENDPOINT || DEFAULT_ENDPOINT,
    token: "",
    format: "text",
    dryRun: false,
    returnCsv: false,
  };

  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      i += 1;
      if (i >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[i];
    };

    if (arg === "--endpoint") opts.endpoint = next();
    else if (arg === "--token") opts.token = next();
    else if (arg === "--name") opts.name = next();
    else if (arg === "--args") opts.args = next();
    else if (arg === "--query" || arg === "-q") opts.query = next();
    else if (arg === "--url") opts.url = next();
    else if (arg === "--file-id") opts.fileId = next();
    else if (arg === "--sheet-id") opts.sheetId = next();
    else if (arg === "--cell") opts.cell = next();
    else if (arg === "--range") opts.range = next();
    else if (arg === "--row") opts.row = Number(next());
    else if (arg === "--col") opts.col = Number(next());
    else if (arg === "--start-row") opts.startRow = Number(next());
    else if (arg === "--start-col") opts.startCol = Number(next());
    else if (arg === "--end-row") opts.endRow = Number(next());
    else if (arg === "--end-col") opts.endCol = Number(next());
    else if (arg === "--value") opts.value = next();
    else if (arg === "--type") opts.type = next().toUpperCase();
    else if (arg === "--format") opts.format = next();
    else if (arg === "--out") opts.out = next();
    else if (arg === "--csv") opts.returnCsv = true;
    else if (arg === "--dry-run") opts.dryRun = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!["list-tools", "call-tool", "get-sheet-info", "get-range", "set-cell"].includes(opts.command)) {
    throw new Error(`Unknown command: ${opts.command}`);
  }
  if (!["text", "json"].includes(opts.format)) throw new Error("--format must be text or json.");
  return opts;
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

function getToken(opts) {
  const token = opts.token || process.env.TENCENT_DOCS_TOKEN || readTokenFromRegistry();
  if (!token) throw new Error("Missing TENCENT_DOCS_TOKEN. Set it in the process env or HKCU user environment.");
  return token;
}

function parseSheetUrl(urlText = "") {
  if (!urlText) return {};
  const url = new URL(urlText);
  const parts = url.pathname.split("/").filter(Boolean);
  const sheetIndex = parts.findIndex((item) => item === "sheet");
  return {
    fileId: sheetIndex >= 0 ? parts[sheetIndex + 1] : "",
    sheetId: url.searchParams.get("tab") || "",
  };
}

function colLettersToIndex(letters) {
  let value = 0;
  for (const char of letters.toUpperCase()) {
    const code = char.charCodeAt(0);
    if (code < 65 || code > 90) throw new Error(`Invalid column letters: ${letters}`);
    value = value * 26 + (code - 64);
  }
  return value - 1;
}

function parseA1Cell(cell) {
  const match = /^([A-Za-z]+)([1-9]\d*)$/.exec(cell || "");
  if (!match) throw new Error(`Invalid A1 cell address: ${cell}`);
  return {
    row: Number(match[2]) - 1,
    col: colLettersToIndex(match[1]),
  };
}

function parseA1Range(range) {
  const parts = String(range || "").split(":");
  if (parts.length === 1) {
    const cell = parseA1Cell(parts[0]);
    return { startRow: cell.row, startCol: cell.col, endRow: cell.row, endCol: cell.col };
  }
  if (parts.length !== 2) throw new Error(`Invalid A1 range: ${range}`);
  const start = parseA1Cell(parts[0]);
  const end = parseA1Cell(parts[1]);
  return {
    startRow: Math.min(start.row, end.row),
    startCol: Math.min(start.col, end.col),
    endRow: Math.max(start.row, end.row),
    endCol: Math.max(start.col, end.col),
  };
}

function requireSheetIdentity(opts) {
  const fromUrl = parseSheetUrl(opts.url);
  const fileId = opts.fileId || fromUrl.fileId;
  const sheetId = opts.sheetId || fromUrl.sheetId;
  if (!fileId) throw new Error("Missing --file-id or a docs.qq.com/sheet URL.");
  return { file_id: fileId, sheet_id: sheetId };
}

function inferValue(value, requestedType) {
  const type = (requestedType || "").toUpperCase();
  if (type === "NUMBER") return { value_type: "NUMBER", number_value: Number(value) };
  if (type === "BOOL") return { value_type: "BOOL", bool_value: /^(true|1|yes)$/i.test(value) };
  if (type === "FORMULA") return { value_type: "FORMULA", formula: value };
  if (type === "STRING") return { value_type: "STRING", string_value: value };
  if (/^-?\d+(\.\d+)?$/.test(value)) return { value_type: "NUMBER", number_value: Number(value) };
  if (/^(true|false)$/i.test(value)) return { value_type: "BOOL", bool_value: /^true$/i.test(value) };
  if (value.startsWith("=")) return { value_type: "FORMULA", formula: value };
  return { value_type: "STRING", string_value: value };
}

async function rpc(opts, payload) {
  const response = await fetch(opts.endpoint, {
    method: "POST",
    headers: {
      Authorization: getToken(opts),
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
    },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status} from Tencent Docs MCP.`);
  if ((response.headers.get("content-type") || "").includes("text/event-stream")) {
    return parseSseJson(text);
  }
  return JSON.parse(text);
}

function parseSseJson(text) {
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") continue;
    return JSON.parse(data);
  }
  throw new Error("No JSON data found in SSE response.");
}

function toolPayload(name, args) {
  return {
    jsonrpc: "2.0",
    id: Date.now(),
    method: "tools/call",
    params: { name, arguments: args },
  };
}

function extractStructured(result) {
  const payload = result.result;
  if (payload?.structuredContent !== undefined) return payload.structuredContent;
  const text = payload?.content?.find((item) => item.type === "text")?.text;
  if (!text) return payload;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function buildCall(opts) {
  if (opts.command === "call-tool") {
    if (!opts.name) throw new Error("call-tool requires --name.");
    return { name: opts.name, args: opts.args ? JSON.parse(opts.args) : {} };
  }

  if (opts.command === "get-sheet-info") {
    const { file_id } = requireSheetIdentity(opts);
    return { name: "sheet.get_sheet_info", args: { file_id } };
  }

  if (opts.command === "get-range") {
    const identity = requireSheetIdentity(opts);
    if (!identity.sheet_id) throw new Error("get-range requires --sheet-id or a URL with ?tab=<sheet_id>.");
    const range = opts.range ? parseA1Range(opts.range) : {
      startRow: opts.startRow == null ? (opts.row ?? 1) - 1 : opts.startRow - 1,
      startCol: opts.startCol == null ? (opts.col ?? 1) - 1 : opts.startCol - 1,
      endRow: opts.endRow == null ? (opts.row ?? opts.startRow ?? 1) - 1 : opts.endRow - 1,
      endCol: opts.endCol == null ? (opts.col ?? opts.startCol ?? 1) - 1 : opts.endCol - 1,
    };
    return {
      name: "sheet.get_cell_data",
      args: {
        ...identity,
        start_row: range.startRow,
        start_col: range.startCol,
        end_row: range.endRow,
        end_col: range.endCol,
        return_csv: opts.returnCsv,
      },
    };
  }

  if (opts.command === "set-cell") {
    const identity = requireSheetIdentity(opts);
    if (!identity.sheet_id) throw new Error("set-cell requires --sheet-id or a URL with ?tab=<sheet_id>.");
    if (opts.value == null) throw new Error("set-cell requires --value.");
    const cell = opts.cell ? parseA1Cell(opts.cell) : { row: opts.row - 1, col: opts.col - 1 };
    if (!Number.isInteger(cell.row) || cell.row < 0 || !Number.isInteger(cell.col) || cell.col < 0) {
      throw new Error("set-cell requires --cell or positive --row and --col.");
    }
    return {
      name: "sheet.set_cell_value",
      args: {
        ...identity,
        row: cell.row,
        col: cell.col,
        ...inferValue(opts.value, opts.type),
      },
    };
  }

  throw new Error(`No tool call for command: ${opts.command}`);
}

function renderList(tools, opts) {
  const filtered = opts.query
    ? tools.filter((tool) => `${tool.name}\n${tool.description}`.toLocaleLowerCase().includes(opts.query.toLocaleLowerCase()))
    : tools;
  if (opts.format === "json") return JSON.stringify(filtered, null, 2);
  return filtered.map((tool) => `${tool.name} - ${tool.description}`).join("\n");
}

function render(value, opts) {
  if (opts.format === "json" || typeof value !== "string") return JSON.stringify(value, null, 2);
  return value;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  let output;

  if (opts.command === "list-tools") {
    const result = await rpc(opts, { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} });
    output = renderList(result.result?.tools || [], opts);
  } else {
    const call = buildCall(opts);
    if (opts.dryRun) {
      output = render(call, { ...opts, format: "json" });
    } else {
      const result = await rpc(opts, toolPayload(call.name, call.args));
      output = render(extractStructured(result), opts);
    }
  }

  if (opts.out) writeFileSync(opts.out, `${output}\n`, "utf8");
  else process.stdout.write(`${output}\n`);
}

main().catch((error) => {
  console.error(`tencent-docs-mcp failed: ${error.message}`);
  process.exit(1);
});
