#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(scriptDir, "codex-language-style-hook.mjs");
const managerScript = path.join(scriptDir, "test-language-style-manager.mjs");

function run(input, env = process.env) {
  const result = spawnSync(process.execPath, [script], {
    input: JSON.stringify(input),
    encoding: "utf8",
    env,
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim() ? JSON.parse(result.stdout) : null;
}

function startManager() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [managerScript], { stdio: ["ignore", "pipe", "inherit"] });
    child.once("error", reject);
    child.stdout.once("data", (chunk) => resolve({ child, url: String(chunk).trim() }));
  });
}

const manager = await startManager();
const env = { ...process.env, RABI_MANAGER_URL: manager.url };

try {
const session = `style-test-${Date.now()}`;
const promptOutput = run({ hook_event_name: "UserPromptSubmit", session_id: session, prompt: "Skill 更新了吗？" }, env);
assert.match(promptOutput.hookSpecificOutput.additionalContext, /务实极简|direct-evidence-language-style/);

const failed = run({
  hook_event_name: "Stop",
  session_id: session,
  last_assistant_message: "没有。刚才只改了句子。",
}, env);
assert.match(failed.systemMessage, /PM-003/);

const passed = run({ hook_event_name: "Stop", session_id: session, last_assistant_message: "没有。" }, env);
assert.equal(passed, null);

const firstPerson = run({
  hook_event_name: "Stop",
  session_id: `style-test-first-person-${Date.now()}`,
  last_assistant_message: "我会更新规则。",
}, env);
assert.match(firstPerson.systemMessage, /PM-006/);

const unavailable = run(
  { hook_event_name: "Stop", session_id: session, last_assistant_message: "没有。" },
  { ...process.env, RABI_MANAGER_URL: "http://127.0.0.1:1" }
);
assert.equal(unavailable, null);

process.stdout.write("Codex language style hook tests passed.\n");
} finally {
  manager.child.kill();
}
