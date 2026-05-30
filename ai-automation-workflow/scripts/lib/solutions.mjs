import { readFileSync } from "node:fs";

export function parseSolutionSections(solutionPath) {
  const text = readFileSync(solutionPath, "utf8");
  const starts = [];
  const headingRe = /^## (\d+)\. ([^\n]*)$/gm;
  let match;
  while ((match = headingRe.exec(text))) {
    starts.push({ row: Number(match[1]), title: match[2].trim(), index: match.index });
  }

  return starts.map((start, index) => {
    const end = index + 1 < starts.length ? starts[index + 1].index : text.length;
    const section = text.slice(start.index, end);
    return {
      row: start.row,
      title: start.title,
      section,
      rootCause: extractSubsection(section, "原因分析") || extractSubsection(section, "根因判断"),
      fixPlan: extractSubsection(section, "修改方案"),
      userConfirmation: extractSubsection(section, "待用户确认") || extractSubsection(section, "待确认") || "",
      insufficient: extractSubsection(section, "信息不足") || "",
    };
  });
}

export function extractSubsection(section, title) {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\*\\*${escaped}\\*\\*\\s*\\n([\\s\\S]*?)(?=\\n\\*\\*[^*]+\\*\\*|$)`);
  return section.match(re)?.[1].trim() || "";
}

export function composeBackfillText(section) {
  const blocks = [];
  if (section.rootCause) blocks.push(`【原因分析】\n${section.rootCause}`);
  if (section.fixPlan) blocks.push(`【修改方案】\n${section.fixPlan}`);
  if (section.insufficient) blocks.push(`【信息不足】\n${section.insufficient}`);
  else if (section.userConfirmation) blocks.push(`【待用户确认】\n${section.userConfirmation}`);
  return blocks
    .join("\n\n")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function parseVerificationStatus(statusPath) {
  if (!statusPath) return { verified: new Set(), insufficient: new Set() };
  const text = readFileSync(statusPath, "utf8");
  const verifiedBlock = text.split("## 已二次核实")[1]?.split("## 待二次核实")[0] || "";
  const insufficientBlock = text.split("## 待二次核实")[1] || "";
  return {
    verified: new Set([...verifiedBlock.matchAll(/^-\s*(\d+)\./gm)].map((m) => Number(m[1]))),
    insufficient: new Set([...insufficientBlock.matchAll(/^-\s*(\d+)\./gm)].map((m) => Number(m[1]))),
  };
}

export function classifyConfirmation(section, statusSets) {
  if (statusSets?.insufficient?.has(section.row)) return "信息不足";
  if (section.insufficient && !hasActionableFixPlan(section.fixPlan)) return "信息不足";
  if (hasActionableFixPlan(section.fixPlan)) return "方案待确认";
  return "信息不足";
}

export function hasActionableFixPlan(text) {
  const plan = String(text || "").trim();
  if (!plan) return false;
  const normalized = plan.replace(/\s+/g, "");
  const insufficientOnly = [
    "信息不足",
    "待确认",
    "方案待确认",
    "无法确定",
    "需要确认",
    "需要复现",
    "需要看日志",
    "需要实机确认",
    "暂无方案",
    "无",
  ];
  if (insufficientOnly.some((word) => normalized === word || normalized.includes(`【${word}】`))) return false;
  const actionableMarkers = [
    "代码",
    "Prefab",
    "UI",
    "资源",
    "配置",
    "CSV",
    "类",
    "方法",
    "字段",
    "按钮",
    "窗口",
    "组件",
    "绑定",
    "改",
    "新增",
    "删除",
    "调整",
    "替换",
    "修正",
  ];
  return actionableMarkers.some((marker) => plan.includes(marker));
}
