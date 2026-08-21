#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith("--") || argv[index + 1] === undefined) throw new Error(`Invalid option: ${key}`);
    const name = key.slice(2);
    const value = argv[++index];
    values[name] = name === "lexical-metrics" || name.endsWith("review") ? path.resolve(value) : path.resolve(value);
  }
  for (const key of ["target", "control", "output"]) if (!values[key]) throw new Error(`Missing --${key}`);
  if (!values["sentence-catalog"]) values["sentence-catalog"] = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "references", "sentence-style-catalog.json");
  if (!values["four-layer-catalog"]) values["four-layer-catalog"] = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "references", "four-layer-type-catalog.json");
  return values;
}

function readJsonl(filePath) {
  return fs.readFileSync(filePath, "utf8").split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line));
}

function splitSentences(text) {
  return (text.match(/[^。！？!?；;]+[。！？!?；;]?/gu) ?? []).map((value) => value.trim()).filter(Boolean);
}

function hanLength(text) {
  return (text.match(/[\p{Script=Han}]/gu) ?? []).length;
}

const PATTERNS = [
  ["statement", "陈述、判断与否定", "陈述句", "A。", "陈述事实、状态或判断", null],
  ["judgment-shi", "陈述、判断与否定", "判断句", "A 是 B", "建立判断关系", /是/u],
  ["negative-judgment", "陈述、判断与否定", "否定判断句", "A 不是 B", "否定判断关系", /(?:不是|并非|并不是)/u],
  ["adjective-predicate", "陈述、判断与否定", "形容词谓语句", "A 很／较 B", "用性质或状态说明 A", /(?:很|较|非常|十分|极其|相当|太)[\p{Script=Han}]{1,8}/u],
  ["you-construction", "陈述、判断与否定", "有字句", "A 有 B", "说明领有、存在或包含", /有[\p{Script=Han}]{1,30}/u],
  ["shi-de-construction", "陈述、判断与否定", "是……的句", "A 是……的", "突出时间、地点、方式或施事", /是[^。！？]{1,80}的(?:[。！？]|$)/u],
  ["yes-no-ma", "疑问", "是非问句", "A 吗？", "确认 A 是否成立", /吗[？?]?$/u],
  ["positive-negative-question", "疑问", "正反问句", "A 不 A？", "在肯定与否定间选择", /([\p{Script=Han}]{1,4})不\1|是不是|有没有|能不能|可不可以|要不要/u],
  ["choice-question", "疑问", "选择问句", "A 还是 B？", "在候选项中选择", /还是[^。！？]{1,80}[？?]/u],
  ["wh-question", "疑问", "特指问句", "疑问词 + 其余成分", "指定未知信息的位置", /(?:谁|什么|哪里|哪儿|何处|何时|什么时候|多久|为什么|为何|怎么|怎样|如何|多少|几个|多大|多快)[^。！？]*[？?]/u],
  ["rhetorical-question", "疑问", "反问句", "难道／怎么会／谁不／何必……？", "用问句形式预设判断", /(?:难道|怎么会|谁不|何必)[^。！？]*[？?]/u],
  ["confirmation-question", "疑问", "确认问句", "A，对吗／是不是？", "确认已有判断", /(?:对吗|对吧|没错吧|是吗|是不是)[？?]?$/u],
  ["zenmehui-ne", "疑问", "怎么会……呢", "怎么会 A 呢？", "以疑问形式否定或惊讶", /怎么会[^。！？]{0,80}呢?[？?]/u],
  ["shui-bu", "疑问", "谁不……", "谁不 A？", "以泛指人物预设肯定", /谁不[^。！？]{0,80}[？?]/u],
  ["hebi", "疑问", "何必……", "何必 A？", "否定行动的必要性", /何必[^。！？]{0,80}[？?]/u],
  ["not-a-but-b", "否定与纠正", "纠正句", "不是 A，而是 B", "排除 A，建立 B", /不是[^。！？]{0,100}而是/u],
  ["not-only", "递进", "不仅而且句", "不仅 A，而且／还 B", "在 A 上增加 B", /不仅[^。！？]{0,100}(?:而且|还|也)/u],
  ["because-so", "因果", "因为所以句", "因为 A，所以 B", "A 是 B 的原因", /因为[^。！？]{0,140}所以/u],
  ["cause-result", "因果", "因果句", "A，所以／因此 B", "从原因推进到结果", /(?:因为|由于|既然|原因是)[^。！？]{0,180}(?:所以|因此|因而|导致|意味着)/u],
  ["result-cause", "因果", "结果前置句", "之所以 B，是因为 A", "先写结果，再解释原因", /之所以[^。！？]{0,120}是因为/u],
  ["if-then", "条件", "假设条件句", "如果 A，那么／就 B", "条件改变后续结果", /如果[^。！？]{0,180}(?:那么|就|则|会)/u],
  ["only-if", "条件", "必要条件句", "只有 A，才 B", "A 是 B 的必要条件", /只有[^。！？]{0,140}才/u],
  ["as-long-as", "条件", "充分条件句", "只要 A，就 B", "A 足以推出 B", /只要[^。！？]{0,140}就/u],
  ["unless-otherwise", "条件", "排除条件句", "除非 A，否则 B", "不满足 A 时发生 B", /除非[^。！？]{0,140}否则/u],
  ["once-then", "条件", "一旦条件句", "一旦 A，就／会 B", "A 发生后触发 B", /一旦[^。！？]{0,140}(?:就|会|则)/u],
  ["even-if", "让步", "让步句", "即使／即便 A，也 B", "A 不改变 B", /(?:即使|即便|哪怕)[^。！？]{0,140}也/u],
  ["although-but", "转折", "承认转折句", "虽然 A，但是／不过 B", "承认 A，主结论为 B", /虽然[^。！？]{0,140}(?:但是|不过|却|仍)/u],
  ["rather-than", "取舍", "取舍句", "与其 A，不如 B", "在 A、B 中选择 B", /与其[^。！？]{0,140}不如/u],
  ["either-or", "选择", "选择句", "要么 A，要么 B", "列出互斥选择", /要么[^。！？]{0,140}要么/u],
  ["both-and", "并列与递进", "既又句", "既 A，又 B", "同时保留两个属性", /既[^。！？]{0,100}又/u],
  ["on-one-hand", "并列", "双面并列句", "一方面 A，另一方面 B", "并列两个观察方向", /一方面[^。！？]{0,160}另一方面/u],
  ["more-more", "变化", "越越句", "越 A，越 B", "A 与 B 同向变化", /越[^。！？]{0,80}越/u],
  ["since-then", "逻辑关系", "既然……就", "既然 A，就 B", "以前提 A 推进 B", /既然[^。！？]{0,140}(?:就|那么|则)/u],
  ["regardless-all", "逻辑关系", "无论……都", "无论 A，都 B", "A 的变化不改变 B", /无论[^。！？]{0,140}都/u],
  ["admittedly-but", "逻辑关系", "固然……但是", "固然 A，但是 B", "承认 A 后突出 B", /固然[^。！？]{0,140}(?:但是|不过|却)/u],
  ["rather-not", "逻辑关系", "宁可……也不", "宁可 A，也不 B", "在两个选项中坚持 A", /宁可[^。！？]{0,140}也不/u],
  ["some-some", "逻辑关系", "有的……有的", "有的 A，有的 B", "列举不同情况", /有的[^。！？]{0,140}有的/u],
  ["comparison-bi", "逻辑关系", "比较句", "A 比 B 更 C", "比较同一维度", /比[^。！？]{1,50}(?:更|还要|更加)/u],
  ["equal-comparison", "逻辑关系", "同等比较句", "A 和 B 一样 C", "说明同一维度相同", /(?:和|跟|与)[^。！？]{1,50}一样/u],
  ["range-from-to", "逻辑关系", "范围起止句", "从 A 到 B", "标明范围起止", /从[^。！？]{1,60}到/u],
  ["one-then", "逻辑关系", "一……就", "一 A，就 B", "A 紧接着触发 B", /一[^。！？]{1,60}就/u],
  ["until-only", "逻辑关系", "直到……才", "直到 A，才 B", "B 延迟到 A 后发生", /直到[^。！？]{1,100}才/u],
  ["since-ever", "逻辑关系", "自从……以来", "自从 A 以来，B", "以 A 为起点说明持续状态", /自从[^。！？]{1,100}以来/u],
  ["definition", "解释", "定义句", "所谓 A，是指／就是 B", "给 A 下定义", /所谓[^。！？]{0,100}(?:是指|就是|是)/u],
  ["rephrase", "解释", "改述句", "也就是说／换句话说，B", "用 B 重述前文", /(?:也就是说|换句话说)/u],
  ["example", "解释", "举例句", "A，例如／比如 B", "用 B 说明 A", /(?:例如|比如|譬如|举例来说)/u],
  ["summary", "总结", "总结句", "总之／结论是，A", "压缩前文为当前结论", /(?:总之|综上|结论是|简单来说)/u],
  ["citation", "解释与组织", "引用句", "根据／原文写道 A", "标明信息来源", /(?:根据|据|原文(?:是|写道)|文件(?:写道|显示)|报告(?:显示|表明))/u],
  ["self-correction", "解释与组织", "自我修正句", "A——不对／准确地说，B", "主动替换先前表达", /(?:不对|准确地说|更准确地说|换个说法)/u],
  ["sequence", "顺序", "顺序句", "先 A，再／然后 B", "明确先后次序", /先[^。！？]{0,120}(?:再|然后|接着)/u],
  ["ba-construction", "句法", "把字句", "主语 + 把 + 宾语 + 动作", "将受事提前", /把[\p{Script=Han}]{1,30}(?:了|到|成|为|给|在|进|出|上|下|开|掉)/u],
  ["bei-construction", "句法", "被字句", "受事 + 被 + 施事／动作", "将受事置于主语位置", /被[\p{Script=Han}]{1,40}/u],
  ["rang-jiao-construction", "句法", "兼语句", "主语 + 让／叫 + 对象 + 动作", "使后一对象承担动作", /(?:让|叫)[\p{Script=Han}]{1,20}(?:去|来|做|成为|进入|离开|继续|停止|知道|明白)/u],
  ["topic-comment", "信息结构", "话题句", "A，B", "先设话题再评论", /^(?:这个|这种|那种|至于|关于|对于)[^，。！？]{1,30}，/u],
  ["direct-command", "言语行为", "直接命令句", "动作／禁止标记 + 内容", "要求立即执行或停止", /^(?:立刻|马上|立即|停止|别|不要|不许|记住|必须)/u],
  ["request-qing", "言语行为", "请字请求句", "请 + 动作", "以请字提出请求", /请[\p{Script=Han}]{1,30}/u],
  ["request-nengfou", "言语行为", "能否请求句", "能否／可否 A", "询问对方是否可以执行", /(?:能否|可否)[\p{Script=Han}]{1,40}/u],
  ["advice-best", "言语行为", "建议句", "最好／不妨／建议 A", "提出非强制行动", /(?:最好|不妨|建议)[\p{Script=Han}]{1,50}/u],
  ["bufang", "言语行为", "不妨句", "不妨 A", "提出缓和建议", /不妨[\p{Script=Han}]{1,50}/u],
  ["reminder", "言语行为", "提醒句", "记得／注意 A", "要求保留注意", /(?:记得|注意|别忘了|请留意)[\p{Script=Han}]{1,60}/u],
  ["prohibition", "言语行为", "禁止句", "不得／不要／别 A", "禁止行动", /(?:不得|不要|别|不许|严禁)[\p{Script=Han}]{1,60}/u],
  ["hope", "言语行为", "希望句", "希望 A", "表达期望", /希望[\p{Script=Han}]{1,50}/u],
  ["wish-if-only", "言语行为", "要是……就好了", "要是 A 就好了", "表达未实现愿望", /要是[^。！？]{0,120}就好了/u],
  ["semicolon-parallel", "标点与复句", "分号并列句", "A；B", "用分号并列关系单元", /；/u],
  ["colon-explanation", "标点与复句", "冒号解释句", "A：B", "用后项解释或列举前项", /：/u],
  ["simile", "修辞与叙述组合", "比喻句", "A 像／仿佛 B", "以 B 的特征说明 A", /(?:像|如同|仿佛|好像|犹如)[\p{Script=Han}]{1,60}/u],
  ["inner-monologue", "修辞与叙述组合", "内心独白", "人物心想／意识到 A", "呈现人物思考", /(?:心想|暗想|意识到|脑海里|心中)[\p{Script=Han}]{1,80}/u],
  ["fragment", "复杂度与完整性", "片段句", "不具备完整主谓主干的片段", "依赖语境形成表达单位", null],
  ["simple-sentence", "复杂度与完整性", "简单句", "单一主谓主干", "承载一个主要关系", null],
  ["parallel-complex", "复杂度与完整性", "并列复句", "分句一 + 并列标记 + 分句二", "并列两个关系单元", /(?:而且|并且|同时|以及|又|也)[^。！？]{1,100}/u],
  ["subordinate-complex", "复杂度与完整性", "主从复句", "从句 + 主句", "用从属关系限定主干", /(?:如果|因为|虽然|即使|只要|只有|除非|当|在)[^。！？]{2,140}[，,][^。！？]{2,140}/u],
  ["nested-complex", "复杂度与完整性", "嵌套复句", "主句包含多层从句", "嵌套多个关系", null],
  ["long-complex", "复杂度", "长复句", "多个分句围绕一条主干", "连续承载多个关系", null],
  ["short-sentence", "复杂度", "短句", "短小完整句或片段", "快速交付判断或动作", null],
];

function detect(pattern, sentence, medianLength) {
  if (pattern[0] === "statement") return !/[？?]/u.test(sentence);
  if (pattern[0] === "fragment") return hanLength(sentence) <= 8 && (sentence.match(/[，,：:；;…]/gu) ?? []).length === 0;
  if (pattern[0] === "simple-sentence") return hanLength(sentence) > 8 && (sentence.match(/[，,：:；;…]/gu) ?? []).length === 0;
  if (pattern[0] === "nested-complex") return (sentence.match(/[，,：:；;…]/gu) ?? []).length >= 3 && (sentence.match(/(?:如果|因为|虽然|即使|只要|只有|除非|但是|所以|那么|而且|或者)/gu) ?? []).length >= 2;
  if (pattern[0] === "long-complex") return hanLength(sentence) >= medianLength && (sentence.match(/[，,：:；;…]/gu) ?? []).length >= 3;
  if (pattern[0] === "short-sentence") return hanLength(sentence) <= 12;
  return pattern[5].test(sentence);
}

function catalogPatternTuple(item, groupName) {
  const detectRule = item.detect ?? {};
  const all = Array.isArray(detectRule.all) ? detectRule.all.filter(Boolean) : [];
  const any = Array.isArray(detectRule.any) ? detectRule.any.filter(Boolean) : [];
  const none = Array.isArray(detectRule.none) ? detectRule.none.filter(Boolean) : [];
  if (!all.length && !any.length) return [item.id, groupName, item.name, item.template, item.relation, null, "catalog_unmeasured"];
  const test = (sentence) => all.every((term) => sentence.includes(term)) && (!any.length || any.some((term) => sentence.includes(term))) && none.every((term) => !sentence.includes(term));
  return [item.id, groupName, item.name, item.template, item.relation, { test, rule: detectRule }, "catalog_detect"];
}

function sentencePatternInventory(sentenceCatalog) {
  if (!sentenceCatalog?.sentencePatterns?.length) return PATTERNS;
  const groupNames = new Map((sentenceCatalog.sentenceGroups ?? []).map((group) => [group.id, group.name]));
  const legacyById = new Map(PATTERNS.map((item) => [item[0], item]));
  const shared = sentenceCatalog.sentencePatterns.map((item) => {
    const tuple = catalogPatternTuple(item, groupNames.get(item.group) ?? item.group);
    const legacy = legacyById.get(item.id);
    if (tuple[6] === "catalog_unmeasured" && legacy?.[5]) return [item.id, tuple[1], item.name, item.template, item.relation, legacy[5], "legacy_fallback"];
    return tuple;
  });
  const sharedIds = new Set(shared.map((item) => item[0]));
  return [...shared, ...PATTERNS.filter((item) => !sharedIds.has(item[0])).map((item) => [...item, "legacy"] )];
}

function summarize(units, medianLength, patternInventory = PATTERNS) {
  const sentences = [];
  for (const unit of units) for (const text of splitSentences(unit.text)) sentences.push({ text, unitId: unit.unitId });
  const result = new Map();
  for (const pattern of patternInventory) result.set(pattern[0], { count: 0, units: new Set(), opening: 0, middle: 0, ending: 0, co: new Map(), variation: [0, 0, 0], variationSentences: [0, 0, 0] });
  for (const [unitIndex, unit] of units.entries()) {
    const unitSentences = splitSentences(unit.text);
    const third = Math.min(2, Math.floor(unitIndex * 3 / Math.max(1, units.length)));
    for (const item of result.values()) item.variationSentences[third] += unitSentences.length;
    for (const [index, text] of unitSentences.entries()) {
      const ids = patternInventory.filter((pattern) => pattern[5] && detect(pattern, text, medianLength)).map((pattern) => pattern[0]);
      const position = index === 0 ? "opening" : index === unitSentences.length - 1 ? "ending" : "middle";
      for (const id of ids) {
        const item = result.get(id); item.count += 1; item.units.add(unit.unitId); item[position] += 1; item.variation[third] += 1;
        for (const other of ids) if (other !== id) item.co.set(other, (item.co.get(other) ?? 0) + 1);
      }
    }
  }
  return { units: units.length, sentences: sentences.length, result };
}

function ratio(left, right) { return right ? Number((left / right).toFixed(3)) : null; }
function fixed(value, digits = 3) { return Number(value.toFixed(digits)); }

const wordSegmenter = new Intl.Segmenter("zh", { granularity: "word" });

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function termMatches(text, term) {
  if (!term) return [];
  if (/^[\p{Script=Han}]$/u.test(term)) {
    return [...wordSegmenter.segment(text)]
      .filter((part) => part.isWordLike && part.segment === term)
      .map((part) => ({ index: part.index, length: term.length }));
  }
  const ascii = /^[A-Za-z0-9_+.-]+$/u.test(term);
  const expression = ascii
    ? new RegExp(`(?<![A-Za-z0-9_])${escapeRegex(term)}(?![A-Za-z0-9_])`, "giu")
    : new RegExp(escapeRegex(term), "gu");
  return [...text.matchAll(expression)].map((match) => ({ index: match.index ?? 0, length: match[0].length }));
}

function sentencePosition(text, match) {
  const before = hanLength(text.slice(0, match.index));
  const after = hanLength(text.slice(match.index + match.length));
  if (before <= 1) return "opening";
  if (after <= 1) return "ending";
  return "middle";
}

function scanVocabularyTypes(catalog, targetUnits, controlUnits) {
  const groupNames = new Map((catalog?.vocabularyGroups ?? []).map((group) => [group.id, group.name]));
  const definitions = Array.isArray(catalog?.vocabularyTypes)
    ? catalog.vocabularyTypes.map((candidate) => ({
      id: candidate.id,
      group: groupNames.get(candidate.group) ?? candidate.group,
      name: candidate.name,
      terms: [...new Set(candidate.words ?? [])],
    }))
    : (catalog?.vocabularyGroups ?? []).flatMap((group) =>
      (group.types ?? []).map((candidate, typeIndex) => ({
        id: `vocabulary-type-${group.id}-${String(typeIndex + 1).padStart(2, "0")}`,
        group: group.name,
        name: typeof candidate === "string" ? candidate : candidate.name,
        terms: typeof candidate === "string" ? [] : [...new Set(candidate.seedTerms ?? [])],
      })),
    );
  const createStats = () => ({
    count: 0,
    units: new Set(),
    position: { opening: 0, middle: 0, ending: 0 },
    terms: new Map(),
    co: new Map(),
    variation: [0, 0, 0],
    variationCharacters: [0, 0, 0],
  });
  const scan = (units) => {
    const stats = new Map(definitions.map((definition) => [definition.id, createStats()]));
    const totalCharacters = units.reduce((sum, unit) => sum + hanLength(unit.text), 0);
    for (const [unitIndex, unit] of units.entries()) {
      const third = Math.min(2, Math.floor(unitIndex * 3 / Math.max(1, units.length)));
      stats.forEach((value) => { value.variationCharacters[third] += hanLength(unit.text); });
      for (const sentence of splitSentences(unit.text)) {
        const sentenceHits = new Map();
        for (const definition of definitions) {
          const matches = [];
          for (const term of definition.terms) {
            for (const match of termMatches(sentence, term)) matches.push({ ...match, term });
          }
          if (!matches.length) continue;
          sentenceHits.set(definition.id, matches.length);
          const item = stats.get(definition.id);
          item.count += matches.length;
          item.units.add(unit.unitId);
          item.variation[third] += matches.length;
          for (const match of matches) {
            const position = sentencePosition(sentence, match);
            item.position[position] += 1;
            const term = item.terms.get(match.term) ?? { count: 0, units: new Set(), position: { opening: 0, middle: 0, ending: 0 } };
            term.count += 1;
            term.units.add(unit.unitId);
            term.position[position] += 1;
            item.terms.set(match.term, term);
          }
        }
        for (const [id, count] of sentenceHits) {
          const item = stats.get(id);
          for (const [otherId, otherCount] of sentenceHits) {
            if (otherId === id) continue;
            item.co.set(otherId, (item.co.get(otherId) ?? 0) + Math.min(count, otherCount));
          }
        }
      }
    }
    return { stats, totalCharacters };
  };
  const target = scan(targetUnits);
  const control = scan(controlUnits);
  const nameById = new Map(definitions.map((item) => [item.id, item.name]));
  return definitions.map((definition) => {
    const a = target.stats.get(definition.id);
    const b = control.stats.get(definition.id);
    const per10k = a.count * 10000 / Math.max(1, target.totalCharacters);
    const controlPer10k = b.count * 10000 / Math.max(1, control.totalCharacters);
    return {
      id: definition.id,
      group: definition.group,
      name: definition.name,
      dictionaryScope: "通用候选词形的封闭扫描；非穷尽语义词典",
      items: definition.terms.map((word) => {
        const item = a.terms.get(word) ?? { count: 0, units: new Set(), position: { opening: 0, middle: 0, ending: 0 } };
        const controlItem = b.terms.get(word) ?? { count: 0 };
        const itemPer10k = item.count * 10000 / Math.max(1, target.totalCharacters);
        const controlItemPer10k = controlItem.count * 10000 / Math.max(1, control.totalCharacters);
        return { word, count: item.count, per10kCharacters: fixed(itemPer10k), coverageCount: item.units.size, coverageRatio: fixed(item.units.size / Math.max(1, targetUnits.length)), position: item.position, controlCount: controlItem.count, controlRateRatio: ratio(itemPer10k, controlItemPer10k) };
      }).sort((left, right) => right.count - left.count),
      frequency: { count: a.count, per10kCharacters: fixed(per10k), coverageCount: a.units.size, coverageRatio: fixed(a.units.size / Math.max(1, targetUnits.length)) },
      position: a.position,
      combinations: [...a.co.entries()].sort((left, right) => right[1] - left[1]).slice(0, 8).map(([typeId, count]) => ({ typeId, name: nameById.get(typeId), count })),
      variation: ["前段", "中段", "后段"].map((context, index) => ({ context, count: a.variation[index], per10kCharacters: fixed(a.variation[index] * 10000 / Math.max(1, a.variationCharacters[index])) })),
      control: { count: b.count, per10kCharacters: fixed(controlPer10k), rateRatio: ratio(per10k, controlPer10k) },
      status: a.count >= 5 && a.units.size >= 3 ? "observed" : a.count > 0 ? "rare" : "absent",
      validation: { status: "automatic_counted", method: "候选词形逐句扫描；单字按中文分词边界识别，多字词按完整字面形式识别" },
      limitation: "零次只表示这组候选词形未出现，不能证明整个语义类型不存在；开放词汇仍需从高频词表和人工语义标注补充。",
    };
  });
}

function readJson(filePath) {
  return filePath && fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, "utf8")) : null;
}

function skeletonItems(entries, controlEntries, unitCount, controlUnitCount, layer, prefix) {
  const controlMap = new Map((controlEntries ?? []).map((item) => [item.name, item]));
  const frequencyKey = layer === "paragraph" ? "per100Paragraphs" : "per100Texts";
  return (entries ?? []).slice(0, 40).map((item, index) => {
    const sequence = item.name.split("→");
    const controlItem = controlMap.get(item.name);
    const standardized = item.count * 100 / Math.max(1, unitCount);
    const controlStandardized = (controlItem?.count ?? 0) * 100 / Math.max(1, controlUnitCount);
    return {
      id: `${prefix}-${String(index + 1).padStart(2, "0")}`,
      name: item.name,
      ...(layer === "paragraph" ? { sequence } : { modules: sequence }),
      unit: layer === "paragraph" ? "带明确归属的完整发言替代单位" : "至少三个句子或至少一百八十个汉字的完整长发言",
      frequency: { count: item.count, [frequencyKey]: fixed(standardized), coverageCount: item.count, coverageRatio: fixed(item.count / Math.max(1, unitCount)) },
      position: { opening: sequence[0], ending: sequence.at(-1) },
      combinations: sequence.slice(1).map((name, position) => ({ name, position: position + 2 })),
      variation: [{ context: "目标全量", count: item.count, standardized: fixed(standardized) }],
      control: { count: controlItem?.count ?? 0, standardized: fixed(controlStandardized), rateRatio: ratio(standardized, controlStandardized) },
      status: item.count >= 5 ? "observed" : item.count > 0 ? "rare" : "absent",
      validation: { status: "automatic_candidate", method: "自动功能标签压缩；必须结合人工样本解释，不单独升级为来源规则" },
    };
  });
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const targetUnits = readJsonl(options.target);
  const controlUnits = readJsonl(options.control);
  const catalog = readJson(options.catalog);
  const sentenceCatalog = readJson(options["sentence-catalog"]);
  const fourLayerCatalog = readJson(options["four-layer-catalog"]);
  const patternInventory = sentencePatternInventory(sentenceCatalog);
  const analysisSummary = readJson(options["analysis-summary"]);
  const targetLengths = targetUnits.flatMap((unit) => splitSentences(unit.text).map(hanLength)).sort((a,b)=>a-b);
  const median = targetLengths[Math.floor(targetLengths.length / 2)] ?? 40;
  const target = summarize(targetUnits, median, patternInventory);
  const control = summarize(controlUnits, median, patternInventory);
  const semanticReviewRequired = new Set(["rhetorical-question", "positive-negative-question", "not-a-but-b", "rang-jiao-construction", "topic-comment", "direct-command"]);
  let sentencePatterns = patternInventory.map(([id, group, name, template, relation, recognition, origin]) => {
    const a = target.result.get(id); const b = control.result.get(id);
    if (origin === "catalog_unmeasured") return {
      id, group, name, template, relation, markers: [],
      recognition: { kind: "not_implemented", pattern: null },
      frequency: { count: null, per100Sentences: null, coverageCount: null, coverageRatio: null },
      position: {}, combinations: [], variation: [], control: { count: null, per100Sentences: null, rateRatio: null },
      status: "not_measured",
      validation: { status: "not_measured", method: "通用句式字典要求检查，但没有可靠自动检测规则，需要人工语义或句法标注。" },
    };
    const per100 = a.count * 100 / Math.max(1, target.sentences);
    const controlPer100 = b.count * 100 / Math.max(1, control.sentences);
    return {
      id, group, name, template, relation,
      markers: recognition?.rule ? [...(recognition.rule.all ?? []), ...(recognition.rule.any ?? [])] : recognition ? [String(recognition)] : [],
      recognition: recognition?.rule ? { kind: "catalog_rule", rule: recognition.rule } : recognition ? { kind: "regex", pattern: recognition.source } : { kind: "derived_metric", pattern: id },
      frequency: { count: a.count, per100Sentences: fixed(per100), coverageCount: a.units.size, coverageRatio: fixed(a.units.size / Math.max(1, target.units)) },
      position: { opening: a.opening, middle: a.middle, ending: a.ending },
      combinations: [...a.co.entries()].sort((x,y)=>y[1]-x[1]).slice(0,5).map(([patternId,count])=>({ patternId, count })),
      variation: ["前段", "中段", "后段"].map((context, index) => ({ context, count: a.variation[index], per100Sentences: fixed(a.variation[index] * 100 / Math.max(1, a.variationSentences[index])) })),
      control: { count: b.count, per100Sentences: fixed(controlPer100), rateRatio: ratio(per100, controlPer100) },
      status: a.count >= 10 && a.units.size >= 8 ? "observed" : a.count > 0 ? "rare" : "absent",
      validation: semanticReviewRequired.has(id)
        ? { status: "automatic_candidate", method: "规则扫描；尚需逐类人工语义复核" }
        : { status: "automatic_counted", method: recognition ? "固定标记或结构规则扫描" : "长度与分句指标" },
    };
  });
  const measuredSentenceNames = new Set(sentencePatterns.map((item) => item.name));
  let missingSentenceIndex = 0;
  for (const family of catalog?.sentencePatternFamilies ?? []) {
    for (const candidate of family.types ?? []) {
      const name = typeof candidate === "string" ? candidate : candidate.name;
      if (measuredSentenceNames.has(name)) continue;
      missingSentenceIndex += 1;
      sentencePatterns.push({
        id: `sentence-unmeasured-${String(missingSentenceIndex).padStart(3, "0")}`,
        group: family.name,
        name,
        template: typeof candidate === "string" ? "尚未建立可复核模板" : candidate.template,
        relation: typeof candidate === "string" ? "候选库要求检查；现有规则尚不能可靠识别" : candidate.relation,
        markers: [],
        recognition: { kind: "not_implemented", pattern: null },
        frequency: { count: null, per100Sentences: null, coverageCount: null, coverageRatio: null },
        position: {}, combinations: [], variation: [], control: { count: null, per100Sentences: null, rateRatio: null },
        status: "not_measured",
        validation: { status: "not_measured", method: "需要新增结构识别规则或人工句法标注" },
      });
    }
  }
  for (const candidate of sentenceCatalog?.sentencePatterns ?? []) {
    if (measuredSentenceNames.has(candidate.name)) continue;
    missingSentenceIndex += 1;
    sentencePatterns.push({
      id: candidate.id,
      group: sentenceCatalog.sentenceGroups?.find((group) => group.id === candidate.group)?.name ?? candidate.group,
      name: candidate.name,
      template: candidate.template,
      relation: candidate.relation,
      frequency: { count: null, per100Sentences: null, coverageCount: null, coverageRatio: null },
      position: { opening: null, middle: null, ending: null },
      combinations: [], variation: [], control: {}, status: "not_measured",
      validation: { status: "not_measured", method: "通用句式字典已要求检查，但当前 detect 规则不足以自动计数，需要人工语义标注。" },
      limitation: candidate.notes || "没有可靠自动检测规则。",
    });
  }
  sentencePatterns = sentencePatterns
    .filter((item) => item.frequency?.count == null || item.frequency.count > 0)
    .sort((a,b)=>(b.frequency.coverageRatio ?? -1)-(a.frequency.coverageRatio ?? -1)||(b.frequency.count ?? -1)-(a.frequency.count ?? -1));
  let vocabularyMetrics = [];
  let vocabularyTypes = scanVocabularyTypes(fourLayerCatalog ?? catalog, targetUnits, controlUnits)
    .filter((item) => item.frequency?.count == null || item.frequency.count > 0)
    .sort((a,b)=>(b.frequency.coverageRatio ?? -1)-(a.frequency.coverageRatio ?? -1)||(b.frequency.count ?? -1)-(a.frequency.count ?? -1));
  if (options["lexical-metrics"] && fs.existsSync(options["lexical-metrics"])) {
    const lexical = JSON.parse(fs.readFileSync(options["lexical-metrics"], "utf8"));
    const groupMap = catalog?.lexicalMetricGroupMap ?? {};
    vocabularyMetrics = (lexical.categories ?? []).map((category, categoryIndex) => {
      const observed = (category.terms ?? []).filter((item) => item.target?.count > 0);
      const count = observed.reduce((sum, item) => sum + item.target.count, 0);
      const coverageCount = new Set(observed.flatMap((item) => item.target?.documentCoverage ? [item.term] : [])).size;
      const normalized = observed.reduce((sum, item) => sum + Number(item.target?.normalizedPer10k ?? 0), 0);
      const sentenceStart = observed.reduce((sum, item) => sum + Number(item.target?.positions?.sentenceStart ?? 0), 0);
      const sentenceEnd = observed.reduce((sum, item) => sum + Number(item.target?.positions?.sentenceEnd ?? 0), 0);
      const questionSentence = observed.reduce((sum, item) => sum + Number(item.target?.positions?.questionSentence ?? 0), 0);
      return {
        id: `vocabulary-metric-${String(categoryIndex + 1).padStart(2, "0")}`,
        group: groupMap[category.category] ?? "未映射类别",
        name: category.category,
        items: observed.sort((a,b)=>b.target.count-a.target.count).slice(0,30).map((item) => ({ word: item.term, count: item.target.count, per10kCharacters: item.target.normalizedPer10k, coverageCount: item.target.documentCoverage, coverageRatio: item.target.documentCoverageRatio, position: item.target.positions ?? {}, controlRateRatio: item.comparisons?.targetToControlRateRatio ?? null })),
        frequency: { count, per10kCharacters: fixed(normalized), coverageCount, coverageRatio: null },
        position: { sentenceStart, sentenceEnd, questionSentence },
        combinations: (lexical.stableCollocations ?? []).filter((item) => observed.some((term) => String(item.term ?? "").includes(term.term))).slice(0,8),
        variation: [{ context: "目标全文", count, per10kCharacters: fixed(normalized) }],
        control: { count: category.totals?.control ?? null },
        status: observed.length ? "observed" : "absent",
        validation: { status: "automatic_counted", method: "冻结词表全文扫描；开放词汇仍需人工补充" },
      };
    }).filter((item) => item.frequency.count > 0)
      .sort((a,b)=>(b.frequency.coverageRatio ?? -1)-(a.frequency.coverageRatio ?? -1)||(b.frequency.count ?? -1)-(a.frequency.count ?? -1));
  }
  if (vocabularyMetrics.length === 0) {
    vocabularyMetrics = vocabularyTypes.map((item) => ({ ...item, id: `metric-${item.id}` }));
  }
  let paragraphPatterns = [];
  if (analysisSummary?.target?.skeletons) {
    paragraphPatterns = skeletonItems(analysisSummary.target.skeletons, analysisSummary.control?.skeletons, analysisSummary.target.turns, analysisSummary.control?.turns, "paragraph", "paragraph-skeleton");
  }
  if (options["paragraph-review"] && fs.existsSync(options["paragraph-review"])) {
    const review = JSON.parse(fs.readFileSync(options["paragraph-review"], "utf8"));
    paragraphPatterns.push(...(review.openingToEndingPairs ?? []).map((item, index) => ({ id: `paragraph-human-pair-${String(index + 1).padStart(2, "0")}`, name: `人工复核：${item.label}`, sequence: item.label.split("→"), unit: review.sampling, frequency: { count: item.count, per100Paragraphs: fixed(item.share * 100), coverageCount: item.count, coverageRatio: item.share }, position: { opening: item.label.split("→")[0], ending: item.label.split("→").at(-1) }, combinations: [], variation: [{ context: "固定种子人工样本", count: item.count }], control: {}, status: item.count >= 3 ? "observed" : "rare", validation: { status: "human_reviewed", sampleUnits: review.reviewedUnits } })));
  }
  const paragraphReviewAvailable = Boolean(options["paragraph-review"] && fs.existsSync(options["paragraph-review"]));
  const measuredParagraphNames = new Set(paragraphPatterns.map((item) => item.name.replace(/^人工复核：/u, "")));
  let paragraphCandidateIndex = 0;
  for (const candidate of fourLayerCatalog?.paragraphPatterns ?? []) {
    if (measuredParagraphNames.has(candidate.name) || paragraphPatterns.some((item) => item.id === candidate.id)) continue;
    paragraphCandidateIndex += 1;
    paragraphPatterns.push({
      id: candidate.id,
      catalogId: candidate.id,
      group: candidate.group,
      name: candidate.name,
      sequence: candidate.sequence,
      purpose: candidate.purpose,
      typeIds: candidate.typeIds ?? [],
      unit: "候选检查库",
      frequency: { count: null, per100Paragraphs: null, coverageCount: null, coverageRatio: null },
      position: { opening: candidate.sequence?.[0] ?? null, ending: candidate.sequence?.at(-1) ?? null },
      combinations: [], variation: [], control: {}, status: "not_measured",
      validation: { status: "not_measured", method: "目标语料尚未按这一完整段落模板完成人工标注" },
    });
  }
  let contentStructures = [];
  if (analysisSummary?.extendedTarget?.skeletons) {
    contentStructures = skeletonItems(analysisSummary.extendedTarget.skeletons, analysisSummary.extendedControl?.skeletons, analysisSummary.extendedTarget.turns, analysisSummary.extendedControl?.turns, "composition", "content-skeleton");
  }
  if (options["composition-review"] && fs.existsSync(options["composition-review"])) {
    const review = JSON.parse(fs.readFileSync(options["composition-review"], "utf8"));
    contentStructures.push(...(review.openingToEndingPairs ?? []).map((item, index) => ({ id: `content-human-boundary-${String(index + 1).padStart(2, "0")}`, name: `人工边界复核：${item.label}`, modules: item.label.split("→"), unit: "固定种子人工复核的完整长发言", frequency: { count: item.count, per100Texts: fixed(item.share * 100), coverageCount: item.count, coverageRatio: item.share }, position: { opening: item.label.split("→")[0], ending: item.label.split("→").at(-1) }, combinations: [], variation: [{ context: "固定种子人工样本", count: item.count }], control: {}, status: item.count >= 3 ? "observed" : "rare", validation: { status: "human_reviewed_boundaries_only", sampleUnits: review.reviewedUnits }, limitation: "只验证进入和退出，不表示中间模块已完成人工标注。" })));
  }
  let contentCandidateIndex = 0;
  const measuredContentNames = new Set(contentStructures.map((item) => item.name.replace(/^人工边界复核：/u, "")));
  for (const candidate of fourLayerCatalog?.contentStructures ?? []) {
    if (measuredContentNames.has(candidate.name) || contentStructures.some((item) => item.id === candidate.id)) continue;
    contentCandidateIndex += 1;
    contentStructures.push({
      id: candidate.id,
      catalogId: candidate.id,
      group: candidate.group,
      name: candidate.name,
      modules: candidate.sequence,
      purpose: candidate.purpose,
      outline: candidate.outline ?? [],
      typeIds: candidate.typeIds ?? [],
      unit: "候选检查库",
      frequency: { count: null, per100Texts: null, coverageCount: null, coverageRatio: null },
      position: { opening: candidate.sequence?.[0] ?? null, ending: candidate.sequence?.at(-1) ?? null },
      combinations: [], variation: [], control: {}, status: "not_measured",
      validation: { status: "not_measured", method: "目标语料尚未按这一完整内容编排模板完成人工标注" },
    });
  }
  const compositionReviewAvailable = Boolean(options["composition-review"] && fs.existsSync(options["composition-review"]));
  const catalogVocabularyTypeCount = fourLayerCatalog?.vocabularyTypes?.length ?? (catalog?.vocabularyGroups ?? []).reduce((sum, group) => sum + (group.types?.length ?? 0), 0);
  const catalogSentenceTypeCount = sentenceCatalog?.sentenceTypes?.length ?? (catalog?.sentencePatternFamilies ?? []).reduce((sum, group) => sum + (group.types?.length ?? 0), 0);
  const styleProfiles = [{
    id: "compiled-style-profile",
    name: "四层综合参数",
    vocabulary: vocabularyMetrics.filter((item) => item.status === "observed").sort((a,b)=>(b.frequency.per10kCharacters ?? 0)-(a.frequency.per10kCharacters ?? 0)).slice(0,12).map((item) => item.id),
    sentences: sentencePatterns.filter((item) => item.status === "observed" && item.validation.status !== "automatic_candidate").slice(0,16).map((item) => item.id),
    paragraphs: paragraphPatterns.filter((item) => item.status === "observed" && item.validation?.status === "human_reviewed").slice(0,12).map((item) => item.id),
    contentOrder: contentStructures.filter((item) => item.status === "observed" && item.validation?.status === "human_reviewed").slice(0,12).map((item) => item.id),
    compilationRule: "只收录目标语料中达到观察阈值的参数；自动语义候选不能单独成为运行规则。",
    status: paragraphReviewAvailable && compositionReviewAvailable ? "evidence_compiled" : "partial_evidence",
  }];
  const output = {
    schemaVersion: 1,
    language: "zh",
    profileVersion: "2026-08-12-v8",
    corpus: {
      targetUnits: target.units,
      targetSentences: target.sentences,
      controlUnits: control.units,
      controlSentences: control.sentences,
      sentenceMedianHanCharacters: median,
      extendedTargetUnits: analysisSummary?.extendedTarget?.turns ?? null,
      extendedControlUnits: analysisSummary?.extendedControl?.turns ?? null,
    },
    catalogAudit: { vocabularyGroups: fourLayerCatalog?.vocabularyGroups?.length ?? catalog?.vocabularyGroups?.length ?? null, vocabularyCandidateTypes: catalogVocabularyTypeCount || null, sentenceTypeAxes: sentenceCatalog?.sentenceTypeAxes?.length ?? null, sentenceCandidateTypes: catalogSentenceTypeCount || null, sentencePatternCandidates: sentenceCatalog?.sentencePatterns?.length ?? patternInventory.length, paragraphTypeAxes: fourLayerCatalog?.paragraphTypeAxes?.length ?? null, paragraphCandidateTypes: fourLayerCatalog?.paragraphTypes?.length ?? null, paragraphPatternCandidates: fourLayerCatalog?.paragraphPatterns?.length ?? null, contentTypeAxes: fourLayerCatalog?.contentTypeAxes?.length ?? null, contentCandidateTypes: fourLayerCatalog?.contentTypes?.length ?? null, contentStructureCandidates: fourLayerCatalog?.contentStructures?.length ?? null },
    contentModuleAudit: (catalog?.contentStructureDimensions ?? []).map((name, index) => ({ id: `content-module-${String(index + 1).padStart(2, "0")}`, name, status: "checked_as_dimension", evidence: "在完整长发言的自动功能标签与人工边界复核中检查；是否形成稳定模块顺序由 contentStructures 单独记录。" })),
    vocabularyTypes,
    vocabularyMetrics,
    sentencePatterns,
    paragraphPatterns,
    contentStructures,
    styleProfiles,
    limitations: [`通用候选库完成 ${catalogVocabularyTypeCount} 个词汇类型的封闭扫描；目标 style-data.json 只保存实际命中项，零命中结果留在候选检查报告，不进入目标风格参数。开放语义类别仍需从高频词表和人工标注补充。`, "正则命中证明结构标记出现，不等同于完整语义或依存句法标注。", "回声问句、设问、部分句法结构和修辞结构仍需人工标注。", paragraphReviewAvailable ? "段落层已载入人工复核，但只能在复核范围内形成来源规则。" : "段落结构只有自动候选，尚未载入人工功能标注，不能进入来源规则。", compositionReviewAvailable ? "整篇层已载入人工复核，但只按其实际标注范围形成来源规则。" : "内容结构只有自动候选，尚未载入完整模块人工标注，不能进入来源规则。"],
  };
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ output: options.output, targetSentences: target.sentences, patterns: sentencePatterns.length, observed: sentencePatterns.filter((item)=>item.status==="observed").length }, null, 2));
}

main();
