# 四层文风数据规范

这份规范把文风分析结果保存成统一数据，而不是只写成形容词或说明文章。四层都使用同一组客观参数：类型、频率、位置、组合、变化范围。阅读效果可以在解释层出现，但不能代替这五项数据。

## 目录

- [候选检查库](#候选检查库)
- [数据文件](#数据文件)
- [五项共同参数](#五项共同参数)
- [词汇类型](#词汇类型)
- [句式模板](#句式模板)
- [段落结构](#段落结构)
- [内容结构](#内容结构)
- [综合风格参数](#综合风格参数)
- [验证状态](#验证状态)
- [HTML 展示](#html-展示)

## 候选检查库

通用候选类型保存在 [four-layer-feature-catalog.json](four-layer-feature-catalog.json)。其中包括八个词汇大类、130 个词汇子类型、完整句式候选族、20 种段落候选结构和整篇模块维度。

候选库只回答“必须检查什么”，不回答“目标风格实际使用什么”。提取脚本必须在候选库、审计字段或独立检查报告中逐项留下 `observed`、`rare`、`absent`、`not_measured` 或 `insufficient_evidence` 状态；目标 `style-data.json`、派生字典和正文只保存实际命中次数大于零的参数。不能把候选库中的例词、句式和结构直接复制进目标 `StyleProfile`。候选库本身保留例词、模板和序列，是为了让扫描器拥有确定的检查对象，不表示这些写法值得采用。

## 数据文件

目标语言风格 Skill 必须生成 `references/style-data.json`。它至少包含：

```json
{
  "schemaVersion": 2,
  "language": "zh",
  "profileVersion": "版本号",
  "corpus": {},
  "vocabularyTypes": [],
  "sentencePatterns": [],
  "paragraphPatterns": [],
  "contentStructures": [],
  "styleProfiles": [],
  "runtimeConstraints": {
    "targetLanguage": "zh-CN",
    "applyDuring": ["planning", "visible_reasoning", "commentary", "final", "documents"],
    "checks": []
  }
}
```

直接创建和根据目标语料创建使用同一结构。直接创建没有可复核语料统计时，五项共同参数保留字段并使用 `null`，同时写明 `measurementStatus: "not_measured"`。根据目标语料创建时填写实际命中、覆盖率、对照差异、权重及其计算依据。

`runtimeConstraints.checks` 保存可执行检查。每项至少包含 `id`、`level`、`scope`、`kind`、`message` 和检查参数。Hook 只执行能够确定判断的规则；需要语义判断的规则作为生成约束和人工复核项，不得用脆弱正则冒充确定结论。

Markdown 档案解释数据、来源边界和运行规则；HTML 从 Markdown 与 `style-data.json` 共同生成。任何常用类型、排行榜或比例不能只写在 HTML 中。

## 五项共同参数

每个词汇类型、句式、段落结构和内容结构至少记录：

| 字段 | 要回答的问题 |
|---|---|
| `type` | 客观上使用了哪一种写法？ |
| `frequency` | 出现多少次？按本层单位标准化后是多少？覆盖多少单位？ |
| `position` | 常在开头、中间、结尾或其他什么位置？ |
| `combinations` | 常与哪些同层参数或相邻层参数共同出现？ |
| `variation` | 不同场景中的分布怎样变化？取值集中还是分散？ |

`frequency` 至少包含原始次数、标准化频率、分母和覆盖率。没有完成统计时写 `null` 并说明原因，不能用“高、中、低”替代数字。`position`、`combinations` 和 `variation` 即使结果为空，也必须记录已检查状态和分母，不能用空对象掩盖尚未分析。

完整成熟度还要求：

- 通用词汇候选均有可复核扫描状态；目标 `style-data.json` 只保存正向命中项，开放语义类必须写明候选词形边界或人工标注范围；
- 全部句式候选都有数值结果或人工复核结论，宽松规则候选不能视为已完成；
- 段落候选由完整段落或明确替代单位的人工功能标注得到；
- 内容结构由完整文本单位的模块标注得到，不能只验证首尾；
- `styleProfiles` 只引用 `observed` 或经过复核的场景限定参数。

## 词汇类型

`vocabularyTypes` 每项至少包含：

```json
{
  "id": "first-person-singular",
  "group": "指称、身份与关系",
  "name": "第一人称单数",
  "items": ["我"],
  "frequency": {
    "count": 0,
    "per10kCharacters": 0,
    "coverageCount": 0,
    "coverageRatio": 0
  },
  "position": {},
  "combinations": [],
  "variation": [],
  "control": {},
  "status": "stable"
}
```

词汇分类库至少覆盖以下八个同级大类，具体子类型按目标语言扩展：

1. 指称、身份与关系；
2. 判断、立场与情态；
3. 行动与言语行为；
4. 程度、范围、数量与时空；
5. 评价、情绪与声音；
6. 疑问、句尾与对话标记；
7. 逻辑与篇章组织词；
8. 词义层级、语域与圈层。

人类阅读版可以从这些记录派生 `vocabulary-dictionary.json` 和相同数据的词汇字典视图。派生数据允许增加 `definition`、`effect`、`usage`、`caution`、`example`、`signals`、`core` 和去重后的 `words` 索引，但这些字段不能覆盖原始统计字段。一个词属于多个类型时，索引保存全部类型引用；`overlap` 只表示多重归类，不表示这些语义在每次使用中同时成立。

句式阅读版派生为 `sentence-dictionary.json`。它保存 `sentenceTypeAxes`、`sentenceTypes`、`sentenceGroups`、`sentencePatterns`、`patternMeasurements`、`typeMeasurements`、`targetMatches` 和 `sourceStatistics`。`patternMeasurements` 只保存已经建立对应关系的目标统计；`targetMatches.status` 使用 `mapped`、`ambiguous` 或 `unmapped`。无法唯一映射的目标参数进入 `target-style-extensions`，不能删除，也不能按零次处理。

段落和整篇阅读版分别派生为 `paragraph-dictionary.json` 与 `composition-dictionary.json`。两者统一保存 `axes`、`types`、`groups`、`patterns`、`measurements`、`typeMeasurements`、`targetMatches` 和 `sourceStatistics`。段落对应8个分类轴、112种类型和65个通用模板；整篇对应9个分类轴、118种类型和60个通用模板。现有目标参数无法唯一对应通用模板时，同样进入目标扩展，不能按零次处理。

分类是检查范围，不是目标风格答案。未观察到的类型保留 `absent` 或 `insufficient_evidence` 状态。

## 持续学习记录

`style-learning-log.jsonl` 是候选样本清单，不是正式风格参数源。每行遵循 [style-learning-log-schema.json](style-learning-log-schema.json)。来源原文和任务适配样本必须分开汇总；未经确认的模型输出、用户否决文本和未复核候选不能写回正式频率。记录可以只保存文本哈希和受控本地引用，避免把私人对话或完整任务内容复制进 Skill。

## 句式模板

`sentencePatterns` 不是“长句、逻辑强”一类概括，而是可识别、可统计的具体结构。每项至少包含：

```json
{
  "id": "not-a-but-b",
  "group": "否定与纠正",
  "name": "纠正句",
  "template": "不是 A，而是 B",
  "relation": "排除 A，把 B 设为新的判断",
  "markers": ["不是", "而是"],
  "recognition": {
    "kind": "regex",
    "pattern": "不是[^。！？]{0,80}而是"
  },
  "frequency": {
    "count": 0,
    "per100Sentences": 0,
    "coverageCount": 0,
    "coverageRatio": 0
  },
  "position": {},
  "combinations": [],
  "variation": [],
  "control": {},
  "status": "stable"
}
```

句式库必须区分并检查：

- 陈述、判断、否定和各种疑问句；
- 请求、命令、禁止、建议、许可、拒绝和回应；
- 因果、条件、让步、转折、纠正、递进、取舍、并列、比较、顺序和变化；
- 定义、解释、改述、举例、总结和引用；
- 把字句、被字句、存现句、连动句、兼语句、话题句、无主句、省略句和倒装句；
- 插入、排比、反复、直接引语、间接引语及目标语料中实际存在的叙述组合；
- 简单句、并列复句、主从复句、嵌套复句、片段句及句长分布。

词语命中只能证明标记出现。需要语义或句法判断的结构必须抽样人工复核，并记录误报率或复核结论。

## 段落结构

`paragraphPatterns` 记录句子功能的实际排列，不保存空泛的“条理清楚”。每项至少包含：

```json
{
  "id": "problem-cause-solution",
  "name": "问题解决段",
  "sequence": ["问题", "原因", "解决办法"],
  "unit": "完整自然段或经说明的替代单位",
  "frequency": {
    "count": 0,
    "per100Paragraphs": 0,
    "coverageCount": 0,
    "coverageRatio": 0
  },
  "position": {},
  "combinations": [],
  "variation": [],
  "control": {},
  "status": "stable"
}
```

至少统计平均每段句数、一句段比例、段首功能分布、段尾功能分布、结构重复率和常见结构排行。若来源没有可靠自然段边界，必须明确替代单位；不能把完整发言直接称为普通文章自然段。

## 内容结构

`contentStructures` 记录完整文本由哪些功能模块组成，以及模块顺序。每项至少包含：

```json
{
  "id": "current-problem-to-decision",
  "name": "当前问题到决策",
  "modules": ["当前问题", "已知事实", "候选解释", "比较", "当前结论"],
  "unit": "完整文本",
  "frequency": {
    "count": 0,
    "per100Texts": 0,
    "coverageCount": 0,
    "coverageRatio": 0
  },
  "position": {},
  "combinations": [],
  "variation": [],
  "control": {},
  "status": "stable"
}
```

来源只有局部发言时，只能形成“完整发言结构”，不能宣称已经得到文章、章节或 README 的内容编排。

## 排行和展示

HTML 每层首先展示数据概览，再展示详细解释。至少提供：

- 常用词汇类型排行；
- 常用具体词排行；
- 常用句式排行；
- 常用段落结构排行；
- 常用内容结构排行；
- 每项的原始次数、标准化频率、覆盖率、位置、常见组合和对照差异；
- 未统计、未观察到和证据不足的项目。

没有 `style-data.json` 或句式没有“每百句次数”，完整校验不得通过。
