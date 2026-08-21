#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

async function readInput() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString("utf8").trim();
  return text ? JSON.parse(text) : {};
}

function loadRuntime() {
  const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
  const settingsPath = path.join(codexHome, "skills", "current-language-style", "references", "runtime-settings.json");
  const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  const styleData = JSON.parse(fs.readFileSync(settings.activeStyleData, "utf8"));
  return { settings, styleData };
}

function statePath(sessionId) {
  const safe = String(sessionId || "unknown").replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(os.tmpdir(), "codex-language-style-hook", `${safe}.json`);
}

function promptFlags(prompt) {
  const text = String(prompt || "").trim();
  return {
    asksReason: /为什么|原因|解释|说明一下|怎么回事|如何|依据/.test(text),
    asksBoundary: /是否意味着|等于|代表|能否说明|能不能说明|通过了吗|失败了吗|边界|排除/.test(text),
    simpleStatusQuestion:
      text.length <= 80 &&
      /(?:吗|么|没|没有|是否|是不是|有没有|完成|更新|通过|成功|失败|好了)[？?]?$/.test(text) &&
      !/为什么|原因|解释|如何|怎么/.test(text),
  };
}

function saveFlags(input) {
  const filePath = statePath(input.session_id);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify({ ...promptFlags(input.prompt), prompt: String(input.prompt || "") })}\n`, "utf8");
}

function loadFlags(input) {
  const filePath = statePath(input.session_id);
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return { asksReason: false, asksBoundary: false, simpleStatusQuestion: false };
  }
}

function instruction(settings, styleData) {
  const checks = styleData?.runtimeConstraints?.checks ?? [];
  const rules = checks.map((item) => `${item.id}: ${item.message}`).join("\n");
  return [
    "[Codex 目标语言与风格]",
    `目标语言：${settings.targetLanguage}`,
    `目标风格 Skill：${settings.activeStyleSkill}`,
    "规划、信息选择、可见过程汇报、最终答复和新写文档使用同一套约束。",
    "代码、命令、日志、路径、标识符、接口字段和精确引文保持原样。",
    rules ? `程序化检查：\n${rules}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function hookOutput(eventName, additionalContext) {
  return {
    ...(["SessionStart", "UserPromptSubmit"].includes(eventName) ? { continue: true } : {}),
    hookSpecificOutput: { hookEventName: eventName, additionalContext },
  };
}

async function validateWithManager(input, settings) {
  const managerUrl = String(process.env.RABI_MANAGER_URL || process.env.RABI_CODEX_MANAGER_URL || "http://127.0.0.1:8790")
    .trim()
    .replace(/\/+$/, "");
  const styleSkillUrl = settings.activeStyleSkillUrl
    || path.dirname(path.dirname(String(settings.activeStyleData || "")));
  const state = loadFlags(input);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(`${managerUrl}/api/language-style/validate`, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8", accept: "application/json" },
      body: JSON.stringify({
        text: String(input.last_assistant_message || ""),
        styleSkillUrl,
        scope: "final",
        prompt: String(state.prompt || "")
      }),
      signal: controller.signal
    });
    const payload = await response.json();
    if (!response.ok || payload?.code === -1) throw new Error(String(payload?.message || `HTTP ${response.status}`));
    return payload?.data;
  } finally {
    clearTimeout(timer);
  }
}

const input = await readInput();
const eventName = String(input.hook_event_name || "");
try {
  const { settings, styleData } = loadRuntime();
  if (!settings?.audit?.enabled) process.exit(0);
  if (eventName === "UserPromptSubmit") saveFlags(input);
  if (["SessionStart", "UserPromptSubmit", "PreToolUse"].includes(eventName)) {
    process.stdout.write(`${JSON.stringify(hookOutput(eventName, instruction(settings, styleData)))}\n`);
  } else if (eventName === "Stop") {
    const result = await validateWithManager(input, settings);
    const errors = result?.violations ?? [];
    if (!result?.passed && errors.length > 0 && settings.audit.reportErrors) {
      const lines = errors.map(
        (error) => `- ${error.ruleId}，第 ${error.paragraph} 段：${error.message}（${error.evidence}）`,
      );
      process.stdout.write(`${JSON.stringify({ systemMessage: `语言风格检查发现 ${errors.length} 项错误：\n${lines.join("\n")}` })}\n`);
    }
  }
} catch (error) {
  if (eventName !== "Stop") {
    process.stderr.write(`[codex-language-style] ${error instanceof Error ? error.message : String(error)}\n`);
  }
}
