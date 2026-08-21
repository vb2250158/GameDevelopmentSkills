#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const [referenceArg, catalogArg] = process.argv.slice(2);
if (!referenceArg || !catalogArg) throw new Error("Usage: node enrich-four-layer-feature-catalog.mjs <reference.txt> <catalog.json>");
const reference = fs.readFileSync(path.resolve(referenceArg), "utf8");
const catalogPath = path.resolve(catalogArg);
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));

const vocabularySection = reference.match(/## 词汇字典的正确分组([\s\S]*?)---\s*\n\s*# 第二层/u)?.[1] ?? "";
const dictionaries = new Map();
for (const match of vocabularySection.matchAll(/###\s+\d+\.\s+([^\r\n]+)([\s\S]*?)(?=###\s+\d+\.|$)/gu)) {
  const types = [];
  for (const line of match[2].split(/\r?\n/u)) {
    const item = line.match(/^\s*\*\s+([^：:]+)[：:]\s*(.+?)\s*$/u);
    if (!item) continue;
    types.push({ name: item[1].trim(), seedTerms: item[2].split(/[、，,]/u).map((term) => term.trim()).filter(Boolean) });
  }
  dictionaries.set(match[1].trim(), types);
}
const registerSeedTerms = {
  "具体人物名词": ["学生", "医生", "队员"], "具体物体名词": ["桌子", "文件", "钥匙"], "地点名词": ["学校", "房间", "城市"], "抽象名词": ["关系", "原因", "价值"],
  "动作动词": ["走", "打开", "检查"], "状态动词": ["存在", "保持", "属于"], "心理动词": ["想", "认为", "担心"], "感官动词": ["看见", "听到", "闻到"],
  "性质形容词": ["可靠", "复杂", "合理"], "感官形容词": ["明亮", "刺耳", "冰冷"], "名词化表达": ["进行处理", "完成验证", "实施管理"], "日常口语词": ["啥", "咋", "这玩意"],
  "书面词": ["何种", "如何", "鉴于"], "网络词": ["离谱", "抽象", "稳了"], "方言词": ["咋", "整", "蛮"], "文言与古风词": ["吾", "然", "何以"],
  "专业术语": ["架构", "耦合", "帧同步"], "外来词和缩略语": ["API", "CPU", "OK"], "儿童常用基础词": ["爸爸", "开心", "好玩"], "成语与四字格": ["显而易见", "一目了然", "津津有味"],
  "儿化词": ["玩儿", "门儿", "一会儿"], "小称与昵称": ["小明", "阿姨", "宝宝"]
};
for (const group of catalog.vocabularyGroups) {
  let types = dictionaries.get(group.name);
  const allowedNames = new Set(group.types.map((type) => typeof type === "string" ? type : type.name));
  if (types?.length) types = types.filter((type) => allowedNames.has(type.name));
  if (!types?.length) {
    types = group.types.map((type) => {
      const name = typeof type === "string" ? type : type.name;
      return { name, seedTerms: registerSeedTerms[name] ?? [] };
    });
  }
  const parsedNames = new Set(types.map((type) => type.name));
  for (const name of allowedNames) if (!parsedNames.has(name)) types.push({ name, seedTerms: registerSeedTerms[name] ?? [] });
  if (!types?.length) throw new Error(`No vocabulary dictionary parsed for ${group.name}`);
  group.types = types;
}

const templateRows = reference.match(/例如：\s*\n\s*\| 句式[\s\S]*?(?=完整句式库还应继续覆盖)/u)?.[0] ?? "";
const sentenceTemplateMap = new Map();
for (const line of templateRows.split(/\r?\n/u)) {
  if (!/^\|/u.test(line) || /^\|\s*(?:句式|-)/u.test(line)) continue;
  const cells = line.trim().replace(/^\||\|$/gu, "").split("|").map((cell) => cell.trim());
  if (cells.length >= 3) sentenceTemplateMap.set(cells[0], { template: cells[1], relation: cells[2] });
}

const compactTemplates = {
  "陈述句":"A。|陈述事实、状态或判断", "判断句":"A 是 B|建立判断关系", "否定判断句":"A 不是 B|否定判断关系", "名词谓语句":"A，B|用名词性成分说明 A", "形容词谓语句":"A 很／较 B|用性质或状态说明 A", "有字句":"A 有 B|说明领有、存在或包含", "双宾句":"主语 + 动词 + 间接宾语 + 直接宾语|一个动作关联两个宾语", "述补句":"动作／性质 + 补语|补充结果、程度、方向或可能", "是……的句":"A 是……的|突出时间、地点、方式或施事",
  "确认问句":"A，对吗／是不是？|确认已有判断", "回声问句":"A？|重复对方内容并要求澄清", "设问句":"A？B。|提出问题后自行回答", "怎么会……呢":"怎么会 A 呢？|以疑问形式否定或惊讶", "谁不……":"谁不 A？|以泛指人物预设肯定", "何必……":"何必 A？|否定行动的必要性",
  "直接命令句":"动作／禁止标记 + 内容|要求执行或停止", "请字请求句":"请 A|提出请求", "能否请求句":"能否／可否 A？|询问能否执行", "建议句":"最好／建议 A|提出非强制行动", "不妨句":"不妨 A|提出缓和建议", "提醒句":"记得／注意 A|要求保留注意", "禁止句":"不得／不要／别 A|禁止行动", "希望句":"希望 A|表达期望", "要是……就好了":"要是 A 就好了|表达未实现愿望",
  "因为所以句":"因为 A，所以 B|A 是 B 的原因", "因果句":"A，所以／因此 B|从原因推进到结果", "结果前置句":"之所以 B，是因为 A|先写结果再解释原因", "假设条件句":"如果 A，那么／就 B|条件改变后续结果", "必要条件句":"只有 A，才 B|A 是 B 的必要条件", "充分条件句":"只要 A，就 B|A 足以推出 B", "排除条件句":"除非 A，否则 B|不满足 A 时发生 B", "一旦条件句":"一旦 A，就／会 B|A 发生后触发 B", "让步句":"即使／即便 A，也 B|A 不改变 B", "承认转折句":"虽然 A，但是／不过 B|承认 A 后突出 B", "纠正句":"不是 A，而是 B|排除 A 后建立 B", "不仅而且句":"不仅 A，而且／还 B|在 A 上增加 B", "取舍句":"与其 A，不如 B|在 A、B 中选择 B", "选择句":"要么 A，要么 B|列出互斥选择", "既又句":"既 A，又 B|同时保留两个属性", "双面并列句":"一方面 A，另一方面 B|并列两个方向", "越越句":"越 A，越 B|A 与 B 同向变化", "顺序句":"先 A，再 B，最后 C|明确行动或事件顺序", "既然……就":"既然 A，就 B|以前提 A 推进 B", "无论……都":"无论 A，都 B|A 的变化不改变 B", "固然……但是":"固然 A，但是 B|承认 A 后突出 B", "宁可……也不":"宁可 A，也不 B|在两个选项中坚持 A", "有的……有的":"有的 A，有的 B|列举不同情况", "比较句":"A 比 B 更 C|比较同一维度", "同等比较句":"A 和 B 一样 C|说明同一维度相同", "范围起止句":"从 A 到 B|标明范围起止", "一……就":"一 A，就 B|A 紧接着触发 B", "直到……才":"直到 A，才 B|B 延迟到 A 后发生", "自从……以来":"自从 A 以来，B|以 A 为起点说明持续状态",
  "定义句":"所谓 A，是指／就是 B|给 A 下定义", "改述句":"A。也就是说／换句话说，B|用 B 重述 A", "举例句":"A，例如／比如 B|用 B 说明 A", "总结句":"总之／结论是，A|压缩前文为 A", "引用句":"根据／原文写道 A|标明信息来源", "冒号解释句":"A：B|用后项解释或列举前项", "分号并列句":"A；B|并列相对独立的关系单元", "插入语句":"A，插入说明，B|在主干中加入补充", "自我修正句":"A——不对／准确地说，B|主动替换先前表达",
  "把字句":"主语 + 把 + 宾语 + 动作|将受事提前", "被字句":"受事 + 被 + 施事／动作|将受事置于主语位置", "存现句":"地点 + 有／出现 + 对象|引入场景对象", "连动句":"主语 + 动作一 + 动作二|同一主体连续行动", "兼语句":"主语 + 让／叫 + 对象 + 动作|使后一对象承担动作", "双宾句":"主语 + 动词 + 间接宾语 + 直接宾语|一个动作关联两个宾语", "述补句":"动作／性质 + 补语|补充结果或程度", "话题句":"A，B|先设话题再评论", "无主句":"谓语或动作直接出现|省略无法或无需指出的主语", "省略句":"删除上下文可恢复成分|依赖语境补全", "倒装句":"重点成分 + 常规主干|改变信息落点",
  "排比句":"A；A；A|用同构成分连续推进", "反复句":"A……A|重复成分形成强调或节奏", "比喻句":"A 像／仿佛 B|以 B 的特征说明 A", "拟人句":"非人对象 + 人的动作或心理|按人物方式表达非人对象", "夸张句":"超出事实尺度的 A|放大或缩小数量、程度或结果", "反语句":"表面判断与实际判断相反|依赖语境形成反向评价", "直接引语":"说话标记：‘A’|保留原话形式", "间接引语":"主语说／认为 A|把原话改写为叙述成分", "对白加动作":"‘A。’主语 + 动作|对白后补人物动作", "动作加对白":"主语 + 动作：‘A。’|动作后进入对白", "内心独白":"人物心想／意识到 A|呈现人物思考", "感知—想法—行动句":"感知 A → 想法 B → 行动 C|由感知推进到认知和行动", "环境—人物—动作句":"环境 A → 人物 B → 动作 C|从场景进入人物行动", "结果前置叙述句":"结果 B，随后／原来 A|先呈现结果再回补过程",
  "短句":"短小完整句或片段|快速交付判断或动作", "片段句":"不具备完整主谓主干的片段|依赖语境形成表达单位", "简单句":"单一主谓主干|承载一个主要关系", "并列复句":"分句一 + 并列标记 + 分句二|并列两个关系单元", "主从复句":"从句 + 主句|用从属关系限定主干", "嵌套复句":"主句包含多层从句|嵌套多个关系", "长复句":"多个分句围绕一条主干|连续承载多个关系"
};
for (const [name, value] of Object.entries(compactTemplates)) {
  const [template, relation] = value.split("|");
  if (!sentenceTemplateMap.has(name)) sentenceTemplateMap.set(name, { template, relation });
}
for (const family of catalog.sentencePatternFamilies) {
  family.types = family.types.map((type) => {
    const name = typeof type === "string" ? type : type.name;
    const spec = sentenceTemplateMap.get(name);
    if (!spec) throw new Error(`No template for sentence type ${name}`);
    return { name, ...spec };
  });
}

const vocabularyTypeCount = catalog.vocabularyGroups.reduce((sum, group) => sum + group.types.length, 0);
const sentenceTypeCount = catalog.sentencePatternFamilies.reduce((sum, family) => sum + family.types.length, 0);
if (vocabularyTypeCount !== 130) throw new Error(`Expected 130 vocabulary types, got ${vocabularyTypeCount}`);
fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ catalogPath, vocabularyTypeCount, sentenceTypeCount }, null, 2));
