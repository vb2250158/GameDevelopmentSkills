#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) throw new Error(`Unknown argument: ${value}`);
    const next = argv[index + 1];
    if (!next) throw new Error(`${value} requires a value`);
    options[value.slice(2)] = next;
    index += 1;
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
  const settingsPath = path.join(codexHome, "skills", "current-language-style", "references", "runtime-settings.json");
  const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));

  if (options.language) settings.targetLanguage = options.language;
  if (options.skill) {
    if (!/^[a-z0-9-]{1,64}$/.test(options.skill)) throw new Error("--skill must be a valid Skill machine name");
    const skillRoot = path.join(codexHome, "skills", options.skill);
    const skillPath = path.join(skillRoot, "SKILL.md");
    const dataPath = path.join(skillRoot, "references", "style-data.json");
    if (!fs.existsSync(skillPath)) throw new Error(`Skill not found: ${skillPath}`);
    if (!fs.existsSync(dataPath)) throw new Error(`Style data not found: ${dataPath}`);
    settings.activeStyleSkill = options.skill;
    settings.activeStyleData = dataPath;
  }

  if (options.audit) settings.audit.enabled = options.audit === "true";
  const styleData = JSON.parse(fs.readFileSync(settings.activeStyleData, "utf8"));
  styleData.runtimeConstraints ??= {};
  styleData.runtimeConstraints.targetLanguage = settings.targetLanguage;

  fs.writeFileSync(settings.activeStyleData, `${JSON.stringify(styleData, null, 2)}\n`, "utf8");
  fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ settingsPath, ...settings }, null, 2)}\n`);
}

main();
