#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildStyleGuide, HTML_GUIDE } from "./render-language-style-html.mjs";

function usage() {
  console.log(
    "Usage: node init-language-style-skill.mjs <skill-name> --path <parent-directory> " +
      "--display-name <name> --language <zh|en> --description <trigger-description>",
  );
}

function parseArgs(argv) {
  const positional = [];
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--help" || value === "-h") {
      usage();
      process.exit(0);
    }
    if (value.startsWith("--")) {
      const next = argv[index + 1];
      if (!next) throw new Error(`${value} requires a value`);
      options[value.slice(2)] = next;
      index += 1;
    } else {
      positional.push(value);
    }
  }
  if (positional.length !== 1) throw new Error("Exactly one skill name is required");
  for (const required of ["path", "display-name", "language", "description"]) {
    if (!options[required]) throw new Error(`--${required} is required`);
  }
  if (!/^[a-z0-9-]{1,64}$/.test(positional[0])) {
    throw new Error("skill-name must use 1-64 lowercase ASCII letters, digits, or hyphens");
  }
  if (!new Set(["zh", "en"]).has(options.language)) {
    throw new Error("--language must be zh or en");
  }
  return {
    skillName: positional[0],
    parentDirectory: path.resolve(options.path),
    displayName: options["display-name"],
    language: options.language,
    description: options.description,
  };
}

function zhTemplates({ skillName, displayName, description }) {
  return {
    "SKILL.md": `---
name: ${skillName}
description: ${description}
---

# ${displayName}

这是一份语言风格，不是人格。先保证任务、事实、责任主体、安全和读者需要准确，再应用已经验证的风格规则。

## 按任务读取

- 普通输出读取 [references/lexical-profile.md](references/lexical-profile.md) 与 [references/style-profile.md](references/style-profile.md)。
- 解释、复核或更新句式时读取 [references/sentence-profile.md](references/sentence-profile.md)。
- 解释、复核或更新段落时读取 [references/paragraph-profile.md](references/paragraph-profile.md)。
- 解释、复核或更新整篇编排时读取 [references/composition-profile.md](references/composition-profile.md)。
- 复核证据和七项验证时读取 [references/style-extraction-report.json](references/style-extraction-report.json)。
- 给人查看、搜索或打印整套风格档案时，打开 [references/style-guide.html](references/style-guide.html)。HTML 是由正式档案生成的阅读版，不参与 Agent 运行时加载。

## 执行

1. 先完成内容与事实判断。
2. 按词汇档案选择与当前功能相符的实际词语。
3. 只应用总风格参数中状态为“稳定”或“场景限定”的运行时规则。
4. 暂定、否决和证据不足的规则只用于复核，不进入默认输出。
5. 不迁移来源身份、题材、原句、故意错误或私人信息。
`,
    "lexical-profile.md": `# ${displayName}：词汇档案

## 目标语言与语料范围

- 目标语言：待提取。
- 语料范围：待提取。
- 固定样本、全文与对照范围：待提取。

## 词汇规则

| 规则 ID | 词汇类别 | 实证词 | 规则类别 | 状态 | 使用方式 | 频率与覆盖 | 位置与搭配 | 同义替代与对照 | 变化触发条件 | 证据 | 验证结果 | 置信度 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| L-01 | 待提取 | 待提取 | 语料观察 | 暂定 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 未运行 | 待提取 |

## 同义替代、位置、搭配与对照

- 待提取主要选择、次要选择、句首句末位置、稳定搭配和对照差异。

## 未观察到与不可迁移

- 待提取。
`,
    "sentence-profile.md": `# ${displayName}：句式档案

## 句式维度总览

按维度检查句类与言语行为、主语与责任、主动被动与状态表达、语序与焦点、肯定否定限制与纠正、逻辑关系、复杂度、句长节奏、重复平行和标点断句。这里不预设目标句型；每项填写语料的实际取值，未观察到时也保留状态。

## 句式维度检查矩阵

| 维度 | 状态 | 目标语料的实际取值 | 分析单位与样本范围 | 数量、比例或结构指标 | 位置与组合 | 实际功能 | 同类对照 | 场景变化 | 混淆因素 | 验证结果 | 置信度 | 能推出什么 | 不能推出什么 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 句类与言语行为 | 证据不足 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 未运行 | 待提取 | 待提取 | 待提取 |
| 主语、责任与视角 | 证据不足 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 未运行 | 待提取 | 待提取 | 待提取 |
| 主动、被动与状态表达 | 证据不足 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 未运行 | 待提取 | 待提取 | 待提取 |
| 语序、焦点与信息落点 | 证据不足 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 未运行 | 待提取 | 待提取 | 待提取 |
| 肯定、否定、限制与纠正 | 证据不足 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 未运行 | 待提取 | 待提取 | 待提取 |
| 逻辑关系与显化程度 | 证据不足 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 未运行 | 待提取 | 待提取 | 待提取 |
| 复杂度与从句组织 | 证据不足 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 未运行 | 待提取 | 待提取 | 待提取 |
| 句长、节奏与断句 | 证据不足 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 未运行 | 待提取 | 待提取 | 待提取 |
| 重复、平行与递进 | 证据不足 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 未运行 | 待提取 | 待提取 | 待提取 |
| 标点分布 | 证据不足 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 未运行 | 待提取 | 待提取 | 待提取 |

## 句式参数词典

| 参数 ID | 所属维度 | 具体形式 | 实际例项或抽象槽位 | 使用倾向 | 常见条件 | 减少使用或不适用的条件 | 次数、频率与覆盖 | 常见位置与组合 | 实际功能 | 状态 | 同类对照与混淆 | 验证结果与置信度 | 不能推出什么 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| SP-01 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 证据不足 | 待提取 | 未运行 | 待提取 |

## 句式规则

| 规则 ID | 规则类别 | 状态 | 适用范围 | 主要倾向 | 次要倾向 | 证据 | 变化触发条件 | 混淆因素与例外 | 验证结果 | 置信度 |
|---|---|---|---|---|---|---|---|---|---|---|
| S-01 | 风格推断 | 暂定 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 未运行 | 待提取 |

## 正反校准

- 正向样例：待提取。
- 反向样例及失败层级：待提取。
`,
    "paragraph-profile.md": `# ${displayName}：段落档案

## 段落维度总览

按维度检查中心任务、段首功能、中段展开、段尾功能、段内动作序列、主干与辅助关系、长度、拆分、合并、承接、过渡和排版。这里不预设段落骨架或句数。

## 段落维度检查矩阵

| 维度 | 状态 | 目标语料的实际取值 | 分析单位与样本范围 | 数量、比例或结构指标 | 位置与组合 | 实际功能 | 同类对照 | 场景变化 | 混淆因素 | 验证结果 | 置信度 | 能推出什么 | 不能推出什么 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 中心任务 | 证据不足 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 未运行 | 待提取 | 待提取 | 待提取 |
| 段首功能 | 证据不足 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 未运行 | 待提取 | 待提取 | 待提取 |
| 中段展开功能 | 证据不足 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 未运行 | 待提取 | 待提取 | 待提取 |
| 段尾功能 | 证据不足 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 未运行 | 待提取 | 待提取 | 待提取 |
| 段内动作序列 | 证据不足 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 未运行 | 待提取 | 待提取 | 待提取 |
| 长度、拆分与合并 | 证据不足 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 未运行 | 待提取 | 待提取 | 待提取 |
| 承接、过渡与排版 | 证据不足 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 未运行 | 待提取 | 待提取 | 待提取 |

## 段落参数词典

| 参数 ID | 所属维度 | 具体形式 | 实际例项或抽象槽位 | 使用倾向 | 常见条件 | 减少使用或不适用的条件 | 次数、频率与覆盖 | 常见位置与组合 | 实际功能 | 状态 | 同类对照与混淆 | 验证结果与置信度 | 不能推出什么 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| PP-01 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 证据不足 | 待提取 | 未运行 | 待提取 |

## 段落规则

| 规则 ID | 规则类别 | 状态 | 适用范围 | 主要倾向 | 次要倾向 | 证据 | 变化触发条件 | 混淆因素与例外 | 验证结果 | 置信度 |
|---|---|---|---|---|---|---|---|---|---|---|
| P-01 | 风格推断 | 暂定 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 未运行 | 待提取 |

## 段首、展开与段尾

- 段首：待提取。
- 展开：待提取。
- 段尾：待提取。

## 骨架、拆段、过渡与列表

- 骨架：待提取。
- 拆段：待提取。
- 过渡：待提取。
- 列表：待提取。
`,
    "composition-profile.md": `# ${displayName}：整篇编排档案

## 整篇维度总览

按维度检查目的、读者、首要问题、开头信息、答案位置、背景深度、证据与例子位置、反例和限制、方案与行动、排序依据、推进路线、结尾功能以及场景变化。这里不预设全文模板。

## 整篇维度检查矩阵

| 维度 | 状态 | 目标语料的实际取值 | 分析单位与样本范围 | 数量、比例或结构指标 | 位置与组合 | 实际功能 | 同类对照 | 场景变化 | 混淆因素 | 验证结果 | 置信度 | 能推出什么 | 不能推出什么 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 目的、读者与首要问题 | 证据不足 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 未运行 | 待提取 | 待提取 | 待提取 |
| 开头信息与答案位置 | 证据不足 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 未运行 | 待提取 | 待提取 | 待提取 |
| 背景位置与展开深度 | 证据不足 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 未运行 | 待提取 | 待提取 | 待提取 |
| 证据、例子、反例与限制的位置 | 证据不足 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 未运行 | 待提取 | 待提取 | 待提取 |
| 信息排序依据 | 证据不足 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 未运行 | 待提取 | 待提取 | 待提取 |
| 全文推进路线 | 证据不足 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 未运行 | 待提取 | 待提取 | 待提取 |
| 行动、成功标志与失败处理 | 证据不足 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 未运行 | 待提取 | 待提取 | 待提取 |
| 用途、媒介与场景变化 | 证据不足 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 未运行 | 待提取 | 待提取 | 待提取 |
| 结尾功能 | 证据不足 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 未运行 | 待提取 | 待提取 | 待提取 |

## 整篇参数词典

| 参数 ID | 所属维度 | 具体形式 | 实际例项或抽象槽位 | 使用倾向 | 常见条件 | 减少使用或不适用的条件 | 次数、频率与覆盖 | 常见位置与组合 | 实际功能 | 状态 | 同类对照与混淆 | 验证结果与置信度 | 不能推出什么 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CP-01 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 证据不足 | 待提取 | 未运行 | 待提取 |

## 整篇规则

| 规则 ID | 规则类别 | 状态 | 适用范围 | 主要倾向 | 次要倾向 | 证据 | 变化触发条件 | 混淆因素与例外 | 验证结果 | 置信度 |
|---|---|---|---|---|---|---|---|---|---|---|
| C-01 | 风格推断 | 暂定 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 待提取 | 未运行 | 待提取 |

## 答案、背景与证据

- 答案位置：待提取。
- 背景深度：待提取。
- 证据顺序：待提取。

## 反例、行动与结尾

- 反例位置：待提取。
- 行动位置：待提取。
- 结尾方式：待提取。
`,
    "style-profile.md": `# ${displayName}：总风格参数

本页链接 [词汇档案](lexical-profile.md)、[句式档案](sentence-profile.md)、[段落档案](paragraph-profile.md) 与 [整篇编排档案](composition-profile.md)。

## 适用范围

- 待提取。

## 分层验证状态

| 层级 | 状态 | 运行结论 |
|---|---|---|
| 词汇 | 证据不足 | 不进入运行时 |
| 句式 | 证据不足 | 不进入运行时 |
| 段落 | 证据不足 | 不进入运行时 |
| 整篇 | 证据不足 | 不进入运行时 |

## 运行时规则

| 规则 ID | 来源规则 | 状态 | 输出规则 | 验证结果 | 变化触发条件 |
|---|---|---|---|---|---|
| R-01 | 待提取 | 暂定 | 待提取 | 未运行 | 待提取 |

## 主倾向与次倾向

- 主倾向：待提取。
- 次倾向：待提取。

## 场景变化触发条件

- 待提取。

## 声音指纹

- R-01：待提取。
- R-01：待提取。
- R-01：待提取。

## 禁止项与不可迁移内容

- 禁止项：待提取。
- 不可迁移内容：来源身份、原句、题材事实和私人信息。

## 正反校准

- 正向样例：待提取。
- 反向样例及失败层级：待提取。
`,
    "style-extraction-report.json": `{
  "schemaVersion": 1,
  "context": {
    "language": "zh",
    "textType": "待提取",
    "corpusUnits": 0
  },
  "layerMaturity": {
    "overall": "insufficient",
    "lexical": { "status": "insufficient", "unitDefinition": "待提取", "corpusUnits": 0, "completedChecks": ["已创建档案结构"], "missingChecks": ["词类统计", "覆盖率", "位置与搭配", "同文体对照", "保留样本复现"], "evidence": "待提取" },
    "sentence": { "status": "insufficient", "unitDefinition": "待提取", "corpusUnits": 0, "completedChecks": ["已创建档案结构"], "missingChecks": ["句长与分句", "主语与责任", "焦点与语序", "言语行为", "结构对照", "人工复核"], "evidence": "待提取" },
    "paragraph": { "status": "insufficient", "unitDefinition": "待提取", "corpusUnits": 0, "completedChecks": ["已创建档案结构"], "missingChecks": ["段首功能", "展开方式", "段尾功能", "骨架序列", "拆段与过渡", "人工复核"], "evidence": "待提取" },
    "composition": { "status": "insufficient", "unitDefinition": "待提取", "corpusUnits": 0, "completedChecks": ["已创建档案结构"], "missingChecks": ["完整文本单位", "答案与背景位置", "证据与反例顺序", "全文路线", "结尾合同", "人工复核"], "evidence": "待提取" }
  },
  "bodyStyleValidation": {
    "status": "not_run",
    "profileVersion": null,
    "language": "zh",
    "sourceHash": null,
    "markdownBodySha256": null,
    "htmlBodySha256": null,
    "files": [],
    "review": { "status": "not_run", "executor": null, "runId": null, "scope": null, "resultSummary": null, "layerChecks": {} }
  },
  "observations": [
    {
      "ruleId": "待提取",
      "ruleCategory": "corpus_observation",
      "status": "tentative",
      "applicability": "待提取",
      "primaryTendency": "待提取",
      "secondaryTendency": "待提取",
      "evidence": "待提取",
      "shiftTrigger": "待提取",
      "confounds": "待提取",
      "validationResult": "not_run",
      "confidence": "待提取"
    }
  ],
  "validation": {
    "sampleFullStability": { "status": "not_run" },
    "holdoutReproduction": { "status": "not_run" },
    "controlDiscrimination": { "status": "not_run" },
    "oneVariableTests": { "status": "not_run" },
    "forwardGeneration": { "status": "not_run", "evidence": { "runs": [] } },
    "contentPreservation": { "status": "not_run" },
    "provenanceLeakage": { "status": "not_run" }
  }
}
`,
    "style-data.json": `{
  "schemaVersion": 2,
  "language": "zh",
  "profileVersion": "待提取",
  "evidencePolicy": "直接创建时记录用户确认的规则；根据目标语料创建时记录命中、覆盖率、对照差异和权重依据。",
  "corpus": { "measurementStatus": "not_measured" },
  "vocabularyTypes": [],
  "sentencePatterns": [],
  "paragraphPatterns": [],
  "contentStructures": [],
  "styleProfiles": [],
  "runtimeConstraints": {
    "targetLanguage": "zh-CN",
    "applyDuring": ["planning", "visible_reasoning", "commentary", "final", "documents"],
    "checks": []
  },
  "targetParameterPolicy": {
    "frequencyPolicy": "null_when_not_measured",
    "runtimeSource": "runtimeConstraints.checks"
  }
}
`,
  };
}

function enTemplates({ skillName, displayName, description }) {
  return {
    "SKILL.md": `---
name: ${skillName}
description: ${description}
---

# ${displayName}

This is a language style, not a persona. Preserve the task, facts, responsibility, safety, and reader needs before applying validated style rules.

## Load by task

- For ordinary output, read [references/lexical-profile.md](references/lexical-profile.md) and [references/style-profile.md](references/style-profile.md).
- For sentence review or updates, read [references/sentence-profile.md](references/sentence-profile.md).
- For paragraph review or updates, read [references/paragraph-profile.md](references/paragraph-profile.md).
- For composition review or updates, read [references/composition-profile.md](references/composition-profile.md).
- For evidence and the seven validation gates, read [references/style-extraction-report.json](references/style-extraction-report.json).
- To browse, search, or print the complete style documentation, open [references/style-guide.html](references/style-guide.html). The HTML file is generated from the formal profiles and is not loaded by agents at runtime.

## Execute

1. Establish the content and factual boundaries first.
2. Select observed vocabulary that serves the current function.
3. Apply only stable or contextual runtime rules from the style profile.
4. Keep tentative, rejected, and insufficient-evidence rules out of default output.
5. Do not transfer source identity, subject matter, original lines, deliberate errors, or private information.
`,
    "lexical-profile.md": `# ${displayName}: Lexical profile

## Target language and corpus scope

- Target language: To extract.
- Corpus scope: To extract.
- Fixed sample, full corpus, and control scope: To extract.

## Lexical rules

| Rule ID | Word category | Observed words | Rule category | Status | Output rule | Frequency and coverage | Position and collocation | Alternatives and control | Shift trigger | Evidence | Validation result | Confidence |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| L-01 | To extract | To extract | corpus observation | tentative | To extract | To extract | To extract | To extract | To extract | To extract | not run | To extract |

## Alternatives, position, collocation, and control

- Extract primary choices, secondary choices, sentence positions, stable collocations, and control differences.

## Absent and non-transferable vocabulary

- To extract.
`,
    "sentence-profile.md": `# ${displayName}: Sentence profile

## Sentence dimension overview

Inspect sentence types and speech acts, subjects and responsibility, active/passive/state expressions, word order and focus, affirmation/negation/limitation/correction, logical relations, complexity, length and rhythm, repetition and parallelism, punctuation, and segmentation. Do not preselect a target pattern; record the corpus result for every dimension, including absent or insufficient-evidence results.

## Sentence dimension matrix

| Dimension | Status | Observed target-corpus value | Analysis unit and sample scope | Count, proportion, or structural metric | Position and combination | Observed function | Comparable control | Scenario shift | Confounds | Validation result | Confidence | Supported conclusion | Unsupported conclusion |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Sentence types and speech acts | insufficient evidence | To extract | To extract | To extract | To extract | To extract | To extract | To extract | To extract | not run | To extract | To extract | To extract |
| Subjects, responsibility, and viewpoint | insufficient evidence | To extract | To extract | To extract | To extract | To extract | To extract | To extract | To extract | not run | To extract | To extract | To extract |
| Active, passive, and state expressions | insufficient evidence | To extract | To extract | To extract | To extract | To extract | To extract | To extract | To extract | not run | To extract | To extract | To extract |
| Word order, focus, and information landing | insufficient evidence | To extract | To extract | To extract | To extract | To extract | To extract | To extract | To extract | not run | To extract | To extract | To extract |
| Affirmation, negation, limitation, and correction | insufficient evidence | To extract | To extract | To extract | To extract | To extract | To extract | To extract | To extract | not run | To extract | To extract | To extract |
| Logical relations and explicitness | insufficient evidence | To extract | To extract | To extract | To extract | To extract | To extract | To extract | To extract | not run | To extract | To extract | To extract |
| Complexity and clause organization | insufficient evidence | To extract | To extract | To extract | To extract | To extract | To extract | To extract | To extract | not run | To extract | To extract | To extract |
| Sentence length, rhythm, and segmentation | insufficient evidence | To extract | To extract | To extract | To extract | To extract | To extract | To extract | To extract | not run | To extract | To extract | To extract |
| Repetition, parallelism, and progression | insufficient evidence | To extract | To extract | To extract | To extract | To extract | To extract | To extract | To extract | not run | To extract | To extract | To extract |
| Punctuation distribution | insufficient evidence | To extract | To extract | To extract | To extract | To extract | To extract | To extract | To extract | not run | To extract | To extract | To extract |

## Sentence parameter dictionary

| Parameter ID | Dimension | Form | Observed example or abstract slot | Usage tendency | Common conditions | Reduced-use or inapplicable conditions | Count, frequency, and coverage | Position and combination | Observed function | Status | Control and confounds | Validation and confidence | Unsupported conclusion |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| SP-01 | To extract | To extract | To extract | To extract | To extract | To extract | To extract | To extract | To extract | insufficient evidence | To extract | not run | To extract |

## Sentence rules

| Rule ID | Rule category | Status | Applicability | Primary tendency | Secondary tendency | Evidence | Shift trigger | Confounds and exceptions | Validation result | Confidence |
|---|---|---|---|---|---|---|---|---|---|---|
| S-01 | style inference | tentative | To extract | To extract | To extract | To extract | To extract | To extract | not run | To extract |

## Calibration

- Positive calibration: To extract.
- Negative calibration and failure layer: To extract.
`,
    "paragraph-profile.md": `# ${displayName}: Paragraph profile

## Paragraph dimension overview

Inspect the central task, opening, development, ending, within-paragraph action sequence, main and supporting information, length, splitting, merging, cohesion, transitions, and layout. Do not preselect a paragraph skeleton or sentence count.

## Paragraph dimension matrix

| Dimension | Status | Observed target-corpus value | Analysis unit and sample scope | Count, proportion, or structural metric | Position and combination | Observed function | Comparable control | Scenario shift | Confounds | Validation result | Confidence | Supported conclusion | Unsupported conclusion |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Central task | insufficient evidence | To extract | To extract | To extract | To extract | To extract | To extract | To extract | To extract | not run | To extract | To extract | To extract |
| Opening function | insufficient evidence | To extract | To extract | To extract | To extract | To extract | To extract | To extract | To extract | not run | To extract | To extract | To extract |
| Development function | insufficient evidence | To extract | To extract | To extract | To extract | To extract | To extract | To extract | To extract | not run | To extract | To extract | To extract |
| Ending function | insufficient evidence | To extract | To extract | To extract | To extract | To extract | To extract | To extract | To extract | not run | To extract | To extract | To extract |
| Within-paragraph action sequence | insufficient evidence | To extract | To extract | To extract | To extract | To extract | To extract | To extract | To extract | not run | To extract | To extract | To extract |
| Length, splitting, and merging | insufficient evidence | To extract | To extract | To extract | To extract | To extract | To extract | To extract | To extract | not run | To extract | To extract | To extract |
| Cohesion, transitions, and layout | insufficient evidence | To extract | To extract | To extract | To extract | To extract | To extract | To extract | To extract | not run | To extract | To extract | To extract |

## Paragraph parameter dictionary

| Parameter ID | Dimension | Form | Observed example or abstract slot | Usage tendency | Common conditions | Reduced-use or inapplicable conditions | Count, frequency, and coverage | Position and combination | Observed function | Status | Control and confounds | Validation and confidence | Unsupported conclusion |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| PP-01 | To extract | To extract | To extract | To extract | To extract | To extract | To extract | To extract | To extract | insufficient evidence | To extract | not run | To extract |

## Paragraph rules

| Rule ID | Rule category | Status | Applicability | Primary tendency | Secondary tendency | Evidence | Shift trigger | Confounds and exceptions | Validation result | Confidence |
|---|---|---|---|---|---|---|---|---|---|---|
| P-01 | style inference | tentative | To extract | To extract | To extract | To extract | To extract | To extract | not run | To extract |

## Paragraph opening, development, and ending

- Paragraph opening: To extract.
- Development: To extract.
- Paragraph ending: To extract.

## Skeleton, splitting, transitions, and lists

- Skeleton: To extract.
- Splitting: To extract.
- Transition: To extract.
- List use: To extract.
`,
    "composition-profile.md": `# ${displayName}: Composition profile

## Composition dimension overview

Inspect purpose, reader, primary question, opening information, answer position, background depth, evidence and example positions, counterexamples and limits, options and actions, ordering basis, whole-text route, ending function, and scenario shifts. Do not preselect a whole-text template.

## Composition dimension matrix

| Dimension | Status | Observed target-corpus value | Analysis unit and sample scope | Count, proportion, or structural metric | Position and combination | Observed function | Comparable control | Scenario shift | Confounds | Validation result | Confidence | Supported conclusion | Unsupported conclusion |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Purpose, reader, and primary question | insufficient evidence | To extract | To extract | To extract | To extract | To extract | To extract | To extract | To extract | not run | To extract | To extract | To extract |
| Opening information and answer position | insufficient evidence | To extract | To extract | To extract | To extract | To extract | To extract | To extract | To extract | not run | To extract | To extract | To extract |
| Background position and depth | insufficient evidence | To extract | To extract | To extract | To extract | To extract | To extract | To extract | To extract | not run | To extract | To extract | To extract |
| Positions of evidence, examples, counterexamples, and limits | insufficient evidence | To extract | To extract | To extract | To extract | To extract | To extract | To extract | To extract | not run | To extract | To extract | To extract |
| Information ordering basis | insufficient evidence | To extract | To extract | To extract | To extract | To extract | To extract | To extract | To extract | not run | To extract | To extract | To extract |
| Whole-text route | insufficient evidence | To extract | To extract | To extract | To extract | To extract | To extract | To extract | To extract | not run | To extract | To extract | To extract |
| Actions, success criteria, and failure handling | insufficient evidence | To extract | To extract | To extract | To extract | To extract | To extract | To extract | To extract | not run | To extract | To extract | To extract |
| Purpose, medium, and scenario shifts | insufficient evidence | To extract | To extract | To extract | To extract | To extract | To extract | To extract | To extract | not run | To extract | To extract | To extract |
| Ending function | insufficient evidence | To extract | To extract | To extract | To extract | To extract | To extract | To extract | To extract | not run | To extract | To extract | To extract |

## Composition parameter dictionary

| Parameter ID | Dimension | Form | Observed example or abstract slot | Usage tendency | Common conditions | Reduced-use or inapplicable conditions | Count, frequency, and coverage | Position and combination | Observed function | Status | Control and confounds | Validation and confidence | Unsupported conclusion |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CP-01 | To extract | To extract | To extract | To extract | To extract | To extract | To extract | To extract | To extract | insufficient evidence | To extract | not run | To extract |

## Composition rules

| Rule ID | Rule category | Status | Applicability | Primary tendency | Secondary tendency | Evidence | Shift trigger | Confounds and exceptions | Validation result | Confidence |
|---|---|---|---|---|---|---|---|---|---|---|
| C-01 | style inference | tentative | To extract | To extract | To extract | To extract | To extract | To extract | not run | To extract |

## Answer, background, and evidence

- Answer position: To extract.
- Background depth: To extract.
- Evidence order: To extract.

## Counterexamples, action, and ending

- Counterexample position: To extract.
- Action position: To extract.
- Ending: To extract.
`,
    "style-profile.md": `# ${displayName}: Style profile

This page links the [lexical profile](lexical-profile.md), [sentence profile](sentence-profile.md), [paragraph profile](paragraph-profile.md), and [composition profile](composition-profile.md).

## Scope

- To extract.

## Layer validation status

| Layer | Status | Runtime result |
|---|---|---|
| Lexical | insufficient evidence | Excluded from runtime |
| Sentence | insufficient evidence | Excluded from runtime |
| Paragraph | insufficient evidence | Excluded from runtime |
| Composition | insufficient evidence | Excluded from runtime |

## Runtime rules

| Rule ID | Source rule | Status | Output rule | Validation result | Shift trigger |
|---|---|---|---|---|---|
| R-01 | To extract | tentative | To extract | not run | To extract |

## Primary tendency and secondary tendency

- Primary tendency: To extract.
- Secondary tendency: To extract.

## Shift triggers

- To extract.

## Voice fingerprints

- R-01: To extract.
- R-01: To extract.
- R-01: To extract.

## Forbidden and non-transferable content

- Forbidden: To extract.
- Non-transferable: source identity, source lines, subject matter facts, and private information.

## Calibration

- Positive calibration: To extract.
- Negative calibration and failure layer: To extract.
`,
    "style-extraction-report.json": `{
  "schemaVersion": 1,
  "context": {
    "language": "en",
    "textType": "To extract",
    "corpusUnits": 0
  },
  "layerMaturity": {
    "overall": "insufficient",
    "lexical": { "status": "insufficient", "unitDefinition": "To extract", "corpusUnits": 0, "completedChecks": ["Profile structure created"], "missingChecks": ["category counts", "coverage", "position and collocation", "matched control", "holdout reproduction"], "evidence": "To extract" },
    "sentence": { "status": "insufficient", "unitDefinition": "To extract", "corpusUnits": 0, "completedChecks": ["Profile structure created"], "missingChecks": ["length and clauses", "subject and responsibility", "focus and order", "speech acts", "structural control", "manual review"], "evidence": "To extract" },
    "paragraph": { "status": "insufficient", "unitDefinition": "To extract", "corpusUnits": 0, "completedChecks": ["Profile structure created"], "missingChecks": ["opening function", "development", "ending function", "skeleton sequence", "splitting and transitions", "manual review"], "evidence": "To extract" },
    "composition": { "status": "insufficient", "unitDefinition": "To extract", "corpusUnits": 0, "completedChecks": ["Profile structure created"], "missingChecks": ["complete text units", "answer and background position", "evidence and counterexample order", "whole-text route", "ending contract", "manual review"], "evidence": "To extract" }
  },
  "bodyStyleValidation": {
    "status": "not_run",
    "profileVersion": null,
    "language": "en",
    "sourceHash": null,
    "markdownBodySha256": null,
    "htmlBodySha256": null,
    "files": [],
    "review": { "status": "not_run", "executor": null, "runId": null, "scope": null, "resultSummary": null, "layerChecks": {} }
  },
  "observations": [
    {
      "ruleId": "To extract",
      "ruleCategory": "corpus_observation",
      "status": "tentative",
      "applicability": "To extract",
      "primaryTendency": "To extract",
      "secondaryTendency": "To extract",
      "evidence": "To extract",
      "shiftTrigger": "To extract",
      "confounds": "To extract",
      "validationResult": "not_run",
      "confidence": "To extract"
    }
  ],
  "validation": {
    "sampleFullStability": { "status": "not_run" },
    "holdoutReproduction": { "status": "not_run" },
    "controlDiscrimination": { "status": "not_run" },
    "oneVariableTests": { "status": "not_run" },
    "forwardGeneration": { "status": "not_run", "evidence": { "runs": [] } },
    "contentPreservation": { "status": "not_run" },
    "provenanceLeakage": { "status": "not_run" }
  }
}
`,
    "style-data.json": `{
  "schemaVersion": 2,
  "language": "en",
  "profileVersion": "To extract",
  "evidencePolicy": "For direct creation, record user-confirmed rules. For corpus-based creation, record hits, coverage, control differences, and weight evidence.",
  "corpus": { "measurementStatus": "not_measured" },
  "vocabularyTypes": [],
  "sentencePatterns": [],
  "paragraphPatterns": [],
  "contentStructures": [],
  "styleProfiles": [],
  "runtimeConstraints": {
    "targetLanguage": "en-US",
    "applyDuring": ["planning", "visible_reasoning", "commentary", "final", "documents"],
    "checks": []
  },
  "targetParameterPolicy": {
    "frequencyPolicy": "null_when_not_measured",
    "runtimeSource": "runtimeConstraints.checks"
  }
}
`,
  };
}

function run() {
  const options = parseArgs(process.argv.slice(2));
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const initScript = path.resolve(
    scriptDirectory,
    "..",
    "..",
    ".system",
    "skill-creator",
    "scripts",
    "init_skill.py",
  );

  if (!fs.existsSync(initScript)) {
    throw new Error(`skill-creator init script not found: ${initScript}`);
  }

  fs.mkdirSync(options.parentDirectory, { recursive: true });
  const shortDescription =
    options.language === "zh"
      ? "把已验证的词汇、句式、段落和整篇编排规则用于用户可见写作"
      : "Apply validated language-style rules to user-visible writing";
  const defaultPrompt =
    options.language === "zh"
      ? `使用 $${options.skillName}，按已经验证的词汇、句式、段落和整篇编排规则完成用户任务。`
      : `Use $${options.skillName} and apply its validated lexical, sentence, paragraph, and composition rules.`;

  const result = spawnSync(
    process.env.PYTHON || "python",
    [
      "-X",
      "utf8",
      initScript,
      options.skillName,
      "--path",
      options.parentDirectory,
      "--resources",
      "references",
      "--interface",
      `display_name=${options.displayName}`,
      "--interface",
      `short_description=${shortDescription}`,
      "--interface",
      `default_prompt=${defaultPrompt}`,
    ],
    { encoding: "utf8" },
  );

  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "init_skill.py failed").trim());
  }

  const skillDirectory = path.join(options.parentDirectory, options.skillName);
  const templates =
    options.language === "zh" ? zhTemplates(options) : enTemplates(options);
  for (const [relativePath, content] of Object.entries(templates)) {
    const outputRelativePath =
      relativePath === "SKILL.md" ? relativePath : path.join("references", relativePath);
    const outputPath = path.join(skillDirectory, outputRelativePath);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, content, "utf8");
  }

  const htmlGuide = buildStyleGuide(skillDirectory);
  fs.writeFileSync(
    path.join(skillDirectory, "references", HTML_GUIDE),
    htmlGuide.html,
    "utf8",
  );

  console.log(`Created language style skill scaffold: ${skillDirectory}`);
  console.log("Replace every extraction placeholder, regenerate the HTML guide, then run:");
  console.log(
    `node "${path.join(scriptDirectory, "render-language-style-html.mjs")}" "${skillDirectory}"`,
  );
  console.log(
    `node "${path.join(scriptDirectory, "validate-language-style-skill.mjs")}" "${skillDirectory}"`,
  );
}

try {
  run();
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  usage();
  process.exit(1);
}
