#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const [skillArgument, styleDataArgument, attributionAuditArgument] = process.argv.slice(2);
if (!skillArgument || !styleDataArgument) {
  throw new Error("Usage: node mark-language-style-partial.mjs <skill-directory> <style-data.json> [attribution-audit.json]");
}

const root = path.resolve(skillArgument);
const styleDataPath = path.resolve(styleDataArgument);
const attributionAuditPath = attributionAuditArgument ? path.resolve(attributionAuditArgument) : null;
const references = path.join(root, "references");
const targetStyleDataPath = path.join(references, "style-data.json");
const reportPath = path.join(references, "style-extraction-report.json");
const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
const styleData = JSON.parse(fs.readFileSync(styleDataPath, "utf8"));
const attributionAudit = attributionAuditPath ? JSON.parse(fs.readFileSync(attributionAuditPath, "utf8")) : null;

for (const key of ["vocabularyTypes", "vocabularyMetrics", "sentencePatterns", "paragraphPatterns", "contentStructures"]) {
  if (Array.isArray(styleData[key])) styleData[key] = styleData[key].filter((item) => item.frequency?.count == null || item.frequency.count > 0);
}
fs.writeFileSync(targetStyleDataPath, `${JSON.stringify(styleData, null, 2)}\n`, "utf8");
report.profileVersion = styleData.profileVersion;
report.context = {
  language: styleData.language,
  textType: "同一分句内由目标姓名和说话动词直接归属的对白单位",
  corpusUnits: styleData.corpus.targetUnits,
  targetCharacters: null,
  normalizedUnit: "han_characters",
  controlUnits: styleData.corpus.controlUnits,
  sentenceUnits: styleData.corpus.targetSentences,
  controlSentenceUnits: styleData.corpus.controlSentences,
  extendedUnits: styleData.corpus.extendedTargetUnits ?? null,
  extendedControlUnits: styleData.corpus.extendedControlUnits ?? null,
  attributionAudit: attributionAudit ? {
    checkedUnits: attributionAudit.structuralAudit.checkedUnits,
    passedUnits: attributionAudit.structuralAudit.passedUnits,
    failedUnits: attributionAudit.structuralAudit.failedUnits,
    sourceSha256: attributionAudit.source.sha256,
    manualSampleUnits: attributionAudit.manualSample.units,
    manualSampleStatus: attributionAudit.manualSample.status,
  } : null,
};
const unresolvedSentences = styleData.sentencePatterns.filter((item) => item.status === "not_measured" || item.validation?.status === "automatic_candidate").length;
const unresolvedParagraphs = styleData.paragraphPatterns.filter((item) => item.status === "not_measured" || item.validation?.status !== "human_reviewed").length;
const unresolvedComposition = styleData.contentStructures.filter((item) => item.status === "not_measured" || !String(item.validation?.status ?? "").startsWith("human_reviewed")).length;
report.layerMaturity = {
  overall: "insufficient",
  lexical: {
    status: "partial",
    unitDefinition: "明确归属对白中的规范化汉字和候选词形",
    corpusUnits: styleData.corpus.targetUnits,
    completedChecks: [`通用候选库完成 ${styleData.catalogAudit?.vocabularyCandidateTypes ?? "全部"} 个词汇类型扫描；目标档案保存 ${styleData.vocabularyTypes.length} 个正向命中类型`, "次数、每万字、覆盖、位置、共现、前中后变化和对照扫描"],
    missingChecks: ["开放语义词汇的高频词人工归类", "歧义词的逐类语义复核", "人工归属样本完成后重新校准置信度"],
    evidence: "候选词形扫描和正式词汇档案已经生成；零命中项只保留在通用候选检查结果，不进入目标风格参数。",
  },
  sentence: {
    status: "partial",
    unitDefinition: "明确归属发言内按终止标点切分的句子",
    corpusUnits: styleData.corpus.targetSentences,
    completedChecks: [`目标档案保存 ${styleData.sentencePatterns.length - unresolvedSentences} 个已有数值结果的句式`, "每百句、覆盖、位置、共现、前中后变化和同场景对照"],
    missingChecks: [`${unresolvedSentences} 个句式仍需人工句法或语义标注`, "人工复核后重新编译句式运行规则"],
    evidence: "固定标记结构已经计数并写入正式句式档案；回声、设问、部分句法和修辞结构不能由宽松正则可靠判定。",
  },
  paragraph: {
    status: "insufficient",
    unitDefinition: "一个明确归属的完整引号发言，作为自然段替代单位",
    corpusUnits: styleData.corpus.targetUnits,
    completedChecks: ["40 个候选字典、自动功能序列、位置、组合、变化范围和同场景对照"],
    missingChecks: [`${unresolvedParagraphs} 个结构尚未完成人工段内功能序列标注`, "段落类型、位置、组合和变化范围的人工复核"],
    evidence: "自动功能标签只能寻找候选，不能证明段落骨架。",
  },
  composition: {
    status: "insufficient",
    unitDefinition: "至少三个句子或至少一百八十个汉字的明确归属长发言",
    corpusUnits: styleData.corpus.extendedTargetUnits ?? 0,
    completedChecks: ["20 个候选字典、自动内容模块序列、位置、组合、变化范围和同场景对照"],
    missingChecks: [`${unresolvedComposition} 个路线尚未完成完整模块人工标注`, "开头、中段、结尾和模块组合的人工复核"],
    evidence: "完整发言可以作为一次推演单位，但自动首尾或关键词标签不能替代完整模块标注。",
  },
};
const vocabularyByName = new Map(styleData.vocabularyTypes.map((item) => [item.name, item]));
const sentenceById = new Map(styleData.sentencePatterns.map((item) => [item.id, item]));
function lexicalObservation(ruleId, name, applicability, primaryTendency, secondaryTendency, shiftTrigger, confounds) {
  const item = vocabularyByName.get(name);
  if (!item) throw new Error(`Missing vocabulary type: ${name}`);
  return {
    ruleId,
    ruleCategory: "corpus_observation",
    status: "contextual",
    applicability,
    primaryTendency,
    secondaryTendency,
    evidence: `${name}出现 ${item.frequency.count} 次，每万字 ${item.frequency.per10kCharacters}，覆盖 ${Number(item.frequency.coverageRatio * 100).toFixed(1)}%；相对同场景对照为 ${item.control.rateRatio ?? "无法计算"} 倍。`,
    shiftTrigger,
    confounds,
    confidence: "medium_high",
    validationResult: "passed_closed_candidate_scan",
  };
}
function sentenceObservation(ruleId, patternId, applicability, primaryTendency, secondaryTendency, shiftTrigger, confounds) {
  const item = sentenceById.get(patternId);
  if (!item) throw new Error(`Missing sentence pattern: ${patternId}`);
  return {
    ruleId,
    ruleCategory: "corpus_observation",
    status: "contextual",
    applicability,
    primaryTendency,
    secondaryTendency,
    evidence: `${item.name}出现 ${item.frequency.count} 次，每百句 ${item.frequency.per100Sentences}，覆盖 ${Number(item.frequency.coverageRatio * 100).toFixed(1)}%；相对同场景对照为 ${item.control.rateRatio ?? "无法计算"} 倍。`,
    shiftTrigger,
    confounds,
    confidence: "medium_high",
    validationResult: "passed_fixed_pattern_scan",
  };
}
report.observations = [
  lexicalObservation("L-01", "可能性词", "存在尚未封闭的结果分支", "使用可能、或许或也许标记未确定结果", "证据足够时改用有限肯定", "新证据关闭或重新打开分支", "候选词形是封闭词典；可能也可作名词"),
  lexicalObservation("L-02", "条件", "条件会改变结果或行动", "使用如果、只要、只有或除非写明条件", "条件简单时允许省略成分", "先决条件或例外发生变化", "题材中的假设讨论会提高条件词频"),
  lexicalObservation("L-03", "因果", "文本需要明确原因与结果", "使用因为或所以连接真实因果", "关系已清楚时不强制补齐成对标记", "因果证据发生变化", "相邻事实不必然构成因果"),
  lexicalObservation("L-04", "必要与义务词", "行动存在必要条件或义务", "区分需要、必须和务必", "必要程度较低时不用强制词", "条件从可选变为不可缺少", "任务文本本身会提高义务词频"),
  lexicalObservation("L-05", "许可与能力词", "说明能力、许可或可行路径", "优先使用可以和能够说明可行范围", "必要时补充限制条件", "权限、资源或能力发生变化", "可以也可能承担口语缓和功能"),
  sentenceObservation("S-01", "if-then", "假设条件会产生不同结果", "使用如果 A，那么或就 B 展开分支", "必要时补充范围或后果", "条件不再影响结果", "固定标记扫描不能判断假设是否真实重要"),
  sentenceObservation("S-02", "because-so", "原因与结果都需要显式说明", "使用因为 A，所以 B 连接因果", "因果简单时只保留一侧标记", "因果关系未被证据支持", "固定标记存在不等于因果判断正确"),
  sentenceObservation("S-03", "long-complex", "同一判断包含多个相互依赖的关系", "用复句连续承载条件、判断和结果", "关系独立或读者负担过高时拆句", "主干变化或关系可以独立交付", "长度指标只能证明结构复杂，不能证明逻辑正确"),
];
report.validation = {
  corpusAttribution: attributionAudit ? {
    status: attributionAudit.structuralAudit.status,
    evidence: `${attributionAudit.structuralAudit.passedUnits}/${attributionAudit.structuralAudit.checkedUnits} 个正式单位通过同分句显式归属和原文引号溯源检查。`,
  } : { status: "not_run", evidence: "未提供归属审计。" },
  sampleFullStability: { status: "not_applicable", reason: "新语料尚未完成样本与全文稳定性比较。" },
  holdoutReproduction: { status: "not_applicable", reason: "新规则尚未形成可执行保留集。" },
  controlDiscrimination: { status: "not_applicable", reason: "数据包含同场景对照，但正式规则尚未完成重新编译。" },
  oneVariableTests: { status: "not_applicable", reason: "等待新正式规则生成。" },
  forwardGeneration: { status: "passed", evidence: { runs: [{ runId: "style-v8-short-forward", kind: "short", executor: "independent_agent", task: "回答配置修改且静态检查通过后能否确认修复完成。", resultSummary: "只确认文件已更改和静态检查结果，把运行生效与问题复测保留为必要条件；使用当前 R-01、R-03、R-04。", status: "passed", contentPreserved: true, provenanceLeakage: false }, { runId: "style-v8-long-forward", kind: "long", executor: "independent_agent", task: "根据代码、单元测试、迁移和登录验证状态生成阶段验收说明。", resultSummary: "保留全部已完成和未验证事实，使用当前 R-01 至 R-04 说明交付条件；明确段落和整篇顺序来自文档适配器，不冒充来源规律。", status: "passed", contentPreserved: true, provenanceLeakage: false }] } },
  contentPreservation: { status: "passed", evidence: "独立短答没有扩大已知范围；独立长文按给定阶段事实生成。" },
  provenanceLeakage: { status: "passed", evidence: "前向输出未出现来源作品、人物、原句或可识别专名。" },
  fourLayerCompleteness: { status: "failed", evidence: "新词汇与句式统计已生成；开放词汇、人工句法、段落序列和完整内容模块标注尚未完成。" },
};
report.bodyStyleValidation = {
  status: "stale",
  reason: "正式语料和 style-data 已更换；旧 Markdown 与 HTML 正文尚未按新参数重写。",
  files: [],
};
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ skill: root, styleData: targetStyleDataPath, report: reportPath, maturity: report.layerMaturity }, null, 2));
