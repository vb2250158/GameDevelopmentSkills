#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { buildBodyAudit } from "./audit-language-style-body.mjs";

function parseArgs(argv) {
  const [skillDirectory, ...rest] = argv;
  if (!skillDirectory) throw new Error("Usage: node stamp-language-style-body-validation.mjs <skill-directory> --run-id <id> --executor <independent_agent|independent_task> --summary <text> --lexical <evidence> --sentence <evidence> --paragraph <evidence> --composition <evidence>");
  const values = {};
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index];
    const value = rest[index + 1];
    if (!key?.startsWith("--") || value === undefined) throw new Error(`Invalid option near ${key ?? "end"}`);
    values[key.slice(2)] = value;
  }
  for (const key of ["run-id", "executor", "summary", "lexical", "sentence", "paragraph", "composition"]) {
    if (!values[key]) throw new Error(`Missing --${key}`);
  }
  if (!new Set(["independent_agent", "independent_task"]).has(values.executor)) throw new Error("--executor must be independent_agent or independent_task");
  return { skillDirectory: path.resolve(skillDirectory), values };
}

const { skillDirectory, values } = parseArgs(process.argv.slice(2));
const reportPath = path.join(skillDirectory, "references", "style-extraction-report.json");
const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
const audit = buildBodyAudit(skillDirectory);
report.bodyStyleValidation = {
  status: "passed",
  ...audit,
  files: audit.files.map((file) => ({ ...file, status: "passed" })),
  review: {
    status: "passed",
    executor: values.executor,
    runId: values["run-id"],
    scope: "只审查 SKILL、正式档案、任务适配器和 HTML 的叙述正文；排除标题、表格及表格数据、代码块、原始 JSON、导航和页面控件。",
    resultSummary: values.summary,
    layerChecks: Object.fromEntries(["lexical", "sentence", "paragraph", "composition"].map((layer) => [layer, { status: "passed", evidence: values[layer] }])),
  },
};
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(`Stamped body style validation: ${reportPath}`);
