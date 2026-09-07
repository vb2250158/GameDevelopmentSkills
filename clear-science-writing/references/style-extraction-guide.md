# 文风提取与档案维护

只在提取、创建或更新文风档案时读取，不用于普通短文改写。以下 `scripts/` 命令在本 Skill 根目录执行；目标档案数量按实际证据决定，候选库不是必须凑齐的目标参数。

## 二、文风

### 1. 词汇是第一风格约束

提取文风时先完整阅读 [references/lexical-extraction.md](lexical-extraction.md)。其中的词类和例词只是搜索范围，不是提取答案。必须回到实际语料，逐类找出主要使用的词、较少使用的同义词、稳定搭配、常见位置和覆盖范围。语料没有出现的类别只留在通用候选检查结果中，不写入目标风格 Skill 的正式参数、字典或正文。

根据目标语料创建时，按 [语料提取与复核](multi-agent-corpus-workflow.md) 建立覆盖记录。四个语言层级均需审阅，可由同一 Agent 分阶段完成；多 Agent 仅在可用、获准且有独立分工收益时使用。禁止把通用候选库、单字命中或脚本高频项直接写成目标风格规则。每层还要保留主倾向、次倾向、场景限定与低频有效变体，不能把一部小说压成一个套路。用户要求可评分交付时，生成并校准评分器；未校准层不得计入总分。

统计不能停在“出现多少次”。至少同时记录词频、标准化频率、样本覆盖率、句中位置、稳定搭配、承担功能、同义替代比例和对照组差异。单词相同但位置和作用不同，产生的文风也不同；例如“可以”可能表示许可、能力或可能性，必须按上下文分别统计。

语料较大时先运行词汇扫描；采样、匿名路径、JSONL、开放词汇和全文复核的完整规则只保存在 [references/lexical-extraction.md](lexical-extraction.md)，不要在两处分别维护：

```powershell
node scripts/analyze-lexicon.mjs <文本文件或目录> [输出 JSON] --sample-size 120 --sample-seed 42 --sample-strategy random --min-paragraph-chars 20
```

第一轮固定种子抽取 100–300 个有效段落，人工发现候选词后用同一词表复扫样本，再以 `--sample-size 0` 完成全文验证。所有原文样本保存在私人层；公开档案只保存匿名统计和可复核结论。

### 2. 识别文风

文风不是“多用高级词”或“句子写得长”。它是同一说话者、作者、团队或文体长期稳定的选择：用什么词进入问题，句子怎样施加动作，段落怎样展开，整篇先让读者知道什么，以及这些选择在什么场景下改变。

先记录可观察证据，再推定阅读效果：

| 层级 | 要记录什么 |
| --- | --- |
| 词汇 | 人称、称呼、判断依据、确定程度、行动词、评价词、回应词、句首句末、语域、稳定搭配和禁用词 |
| 句式 | 言语行为、主语与责任、主动或被动、焦点位置、否定方式、逻辑骨架、句长、断句和重复 |
| 段落 | 段首功能、主要展开方式、段尾功能、常用骨架、拆段条件、过渡和列表使用方式 |
| 整篇编排 | 读者首要问题、答案位置、背景深度、证据与反例顺序、常用全文路线和结尾合同 |

再分开记录关系、判断与行动、情绪、信息和节奏等阅读效果。每项写清证据、可能的混淆因素、适用性和置信度；没有证据时标为“不适用”或“证据不足”，不能补造特征。

### 3. 建立和迁移文风

只有同一文体、相近受众和相近目的的样本，才可放进同一文风比较组。不要把考场议论文的宏大抒情、文学散文的意象、技术说明的准确克制混成一种“高级文风”。

需要从样本文本提取文风，或让某种文风实际约束 Codex 的本次输出时，先生成逐类词汇统计和 `LexicalProfile`，再完整读取 [references/nonlexical-style-extraction.md](nonlexical-style-extraction.md) 与 [references/style-extraction.md](style-extraction.md)，生成非词汇档案、完整 `StyleExtractionReport` 和供实际写作使用的最终 `StyleProfile`。所有档案都沿用语料语言，并直接采用目标风格书写。

每个稳定维度记录一个主倾向、一个确有证据的次倾向，以及触发变化的场景。声音一致不等于每句话相同；普通场景与高风险场景可以使用不同强度，但变化必须发生在可预测的范围内。绑定时先让语料实际偏好的词、搭配、句首句末习惯和确定程度进入用户可见输出，再处理句式、段落、整篇编排、声音和表现策略；代码、标识符、日志、引用、事实和责任主体不因文风而改变。

完成验证后再命名和生成 Skill。正式名称、五份档案、HTML 阅读版、规则字段、来源隔离、运行时加载和七项验证的唯一规范见 [references/style-extraction.md](style-extraction.md)，本页不再复制这些字段。

创建新语言风格 Skill 时，先运行使用 `skill-creator` 的初始化脚本封装：

```powershell
node scripts/init-language-style-skill.mjs <skill-name> --path <输出目录> --display-name <正式名称> --language <zh|en> --description <触发说明>
```

完成提取、替换所有占位内容并生成界面 metadata 后，必须从当前正式档案同步生成 `references/style-guide.html`。HTML 使用目标语料语言和目标文风，集中展示五份档案、证据报告及已有任务适配器，并提供目录、搜索、折叠、明暗切换和打印；它是面向用户的主要查看入口，只供人阅读，不是新的规则事实源，也不参与 Agent 的普通运行时加载：

```powershell
node scripts/render-language-style-html.mjs <目标 Skill 目录>
```

向用户交付或现场查看时，必须用系统浏览器打开 HTML，不能用 Codex 的源码查看器或文件预览代替；文件预览通常不会执行搜索、折叠、主题切换等页面脚本。可以直接双击 `style-guide.html`，或运行：

```powershell
node scripts/render-language-style-html.mjs <目标 Skill 目录> --open
```

普通用户默认只需要 HTML。Markdown 和 JSON 供 Agent 加载、规则复核和数据审计使用；除非用户要求查看原始档案，不要把一组 Markdown 文件当作主要交付入口。具体风格 HTML 默认认为读者已经理解本 Skill 定义的四层通用规范，只展示该风格的实际词汇、句式、段落、整篇参数和验证结果；不要在每个页面复制通用方法。页面顶部必须提供返回 `clear-science-writing` 的通用规范链接。

词汇层必须由 [references/four-layer-type-catalog.json](four-layer-type-catalog.json) 的8个大类、193种通用词汇类型与 `style-data.json` 中的目标统计联合生成数据驱动字典，不能再把词汇总表写死在 HTML。只自动映射同名唯一类型；通用类型把旧类别拆得更细时，不根据词条重合强行拆分目标统计，而是保留目标扩展。目标字典保存实际命中次数大于零的目标参数；零命中类型仍留在通用候选库和检查报告中，不进入具体语言风格 Skill。面向人的具体风格 HTML 只显示覆盖率不低于 1% 的参数，低于 1% 的统计仍保留在 JSON 中供复核。具体风格页面只保留“按类型归组”和“具体词条”两种查看方式；两种视图都使用默认展开的等尺寸卡片，并在卡片标题区显示命中次数与覆盖率，不提供搜索、筛选、排序、展开收起或复制操作。完整搜索和字典维护功能只属于通用规范页。类型数、类型内词条数、去重词条数和多重归类词数必须由当前数据实时计算。词条的通用定义、作用和注意项与目标语料的次数、覆盖、位置、组合、变化和对照属于不同字段；页面可以联合展示，但不能用通用分类说明伪造目标语料统计。生成 HTML 时同时生成 `references/vocabulary-dictionary.json`，并确保它与 HTML 内嵌数据一致。下载当前 HTML 时，应把用户已经应用的词汇数据重新嵌入下载文件。

句式层必须同时加载 [references/sentence-style-catalog.json](sentence-style-catalog.json) 的通用分类轴、句式类型和具体模板，并把 `style-data.json` 中已有的目标语料统计映射进去。完整字典维护界面提供搜索、分类筛选、排序、编辑、导入和导出 JSON；具体风格 HTML 只保留“按句式类型”和“按具体模板”两个卡片视图，默认显示具体模板，隐藏覆盖率低于 1% 的卡片。生成 HTML 时同时生成 `references/sentence-dictionary.json`，并确保它与 HTML 内嵌数据一致。通用字典中的分类轴、句式类型和模板只规定检查范围；未映射不得显示为零次，实际计数为零的目标项也不得保存到具体风格 Skill。目标语料出现而通用库尚无唯一对应的句式，保留在“目标文风扩展”中，不得丢弃或强行错配。

段落层和整篇层使用 [references/four-layer-type-catalog.json](four-layer-type-catalog.json) 中的分类轴、类型和具体模板。段落层生成 `references/paragraph-dictionary.json`，至少包含8个分类轴、112种类型和65个通用模板；整篇层生成 `references/composition-dictionary.json`，至少包含9个分类轴、118种类型和60个通用模板。完整字典维护界面保留搜索、分类筛选、类型跳转和 JSON 操作；具体风格 HTML 只保留类型视图与具体结构视图，默认显示具体结构，隐藏覆盖率低于 1% 的卡片。无法唯一对应的目标段落或整篇结构进入目标扩展，不得按零次处理。

字典随提取任务持续更新，不冻结在首次生成版本。每次 `style-data.json` 改变后重新生成目标词汇和句式字典；新发现的词或句式先进入目标扩展并保留来源、统计和验证状态。只有同一参数在多份独立语料中重复出现、边界清楚并完成人工语义复核后，才可用 `scripts/import-sentence-style-catalog.mjs` 或同等受控流程升级通用候选字典。单一作品、人物或任务中的偶然写法不得直接污染所有风格的通用分类。

日常使用可以为后续迭代提供样本，但不能让 Skill 用自己的生成文本证明自己的规则。样本按来源分级：目标原文是来源证据；用户亲自改写的版本和用户明确接受的版本是适配证据；用户否决的版本是反向证据；未经用户确认的模型输出只能进入候选队列。日常任务不得静默改写全局 Skill；只有用户要求更新，或进入明确的维护任务时，才把最小必要记录写入 `references/style-learning-log.jsonl`，再重新统计、抽样复核并更新 `style-data.json`。不要保存无关对话、私人内容或整份任务历史，优先保存文本哈希、受控本地引用、差异摘要和候选参数。

新一轮语料分析完成后运行：

```powershell
node scripts/update-language-style-dictionaries.mjs <目标语言风格 Skill 目录>
```

语料命中和对照统计完成后，使用统一权重脚本补充各层参数优先级：

```powershell
node scripts/update-language-style-weights.mjs <目标语言风格 Skill 目录>/references/style-data.json
```

权重只用于同层排序。它由覆盖率、对照差异和复核置信度计算，不能覆盖语义适用条件，也不能把低频但必要的安全、事实或责任规则降级。

该命令重新生成 HTML、词汇、句式、段落、整篇字典和 `dictionary-update-report.json`。如果存在 `references/style-learning-log.jsonl`，报告还会区分可复核样本、反向样本、模型候选和待人工判断的参数。报告逐层列出目标参数规模、映射结果、歧义项、未映射项和通用字典升级候选。它只负责发现维护工作，不自动修改正式统计，也不自动把目标扩展升级为通用参数。学习记录格式见 [references/style-learning-log-schema.json](style-learning-log-schema.json)。

面向人的 HTML 必须按“先看整体 → 第一层词汇 → 第二层句式 → 第三层段落 → 第四层整篇编排 → 综合使用 → 复核”逐层递进，不能按 Markdown 文件名排列。四层采用同一展示合同，不能词汇层有词典和数据，句式、段落、整篇却只剩几条概括。每一层都依次展示：主要特征、具体类型或结构、常见组合、场景变化、正反样例、数据与文本依据、置信度和未验证项。

生成和校验四层档案时，完整读取 [references/four-layer-writing-contract.md](four-layer-writing-contract.md)、[references/four-layer-style-data-schema.md](four-layer-style-data-schema.md)、[references/four-layer-feature-catalog.json](four-layer-feature-catalog.json) 与 [references/four-layer-type-catalog.json](four-layer-type-catalog.json)。严格继承其中的客观分析维度、候选字典和数据合同，不把参考材料中的任何候选写法直接当成目标技巧。候选库只规定必须检查的范围，不能冒充目标风格；候选句式、段落序列和内容路线必须保留名称、模板或序列及客观关系，便于逐项统计。所有维度都必须检查并在候选库、审计字段或独立报告中留下状态；目标档案只列语料实际命中的参数：词汇列实际词，句式列“……吗”“不是 A，而是 B”一类实际结构，段落列实际动作序列，整篇列实际信息路线。四层每个实际命中的参数统一记录类型、频率、位置、组合和变化范围，并写入 `references/style-data.json`；次数为零的参数不得写入目标 Skill。缺少其中任何一项时只能算部分完成。候选表里的例词、反问、排比、段落模板或“答案先行”等写法，没有语料证据时不得进入目标 `StyleProfile`。

新增或修订四层类型库时，保留两份重要原始参考：[文风参数化方法论_四层类型字典版.html](文风参数化方法论_四层类型字典版.html) 供人阅读，[文风参数库_四层类型字典.json](文风参数库_四层类型字典.json) 供数据复核。运行时使用由下列命令增量合并生成的 `four-layer-type-catalog.json`，不要直接改写原始参考：

```powershell
node scripts/import-four-layer-style-catalog.mjs references/文风参数库_四层类型字典.json
```

递进只负责阅读顺序，不得隐藏证据。每层结论后面都要就近提供可展开的依据，至少说明可观察事实、样本和全文范围、频率或结构指标、对照差异、混淆因素、规则状态、验证结果，以及当前证据不能推出什么。证据不足时保留该层和相应类型，但标为候选、暂定或未验证；不能为了填满四层而补造稳定特征，也不能直接从词频跨层推断句式、段落或整篇结构。

给人阅读的通用规范使用 [references/language-style-standard.html](language-style-standard.html)。本 Skill 或词汇、非词汇、风格提取规范改变后，重新生成它：

```powershell
node scripts/render-language-style-standard-html.mjs <clear-science-writing Skill 目录>
```

随后同时运行系统基础校验和专用合规校验：

```powershell
python -X utf8 <skill-creator>/scripts/quick_validate.py <目标 Skill 目录>
node scripts/validate-language-style-skill.mjs <目标 Skill 目录> [--forbid-source <来源名称>]
node scripts/validate-language-style-skill.mjs <目标 Skill 目录> --require-complete [--forbid-source <来源名称>]
```

完整度不得由报告自报。`style-data.json` 中仍有未统计、证据不足，或只由宽松规则得到且未完成人工语义复核的参数时，对应层必须失败；段落与整篇还必须有人工复核证据。

第一条检查文件、字段、链接、同步状态、运行时规则和来源隔离是否正确；第二条再检查词汇、句式、段落和整篇编排是否都达到“完整”成熟度。`--require-complete` 不只读取报告中的状态，还会独立核对各层档案是否有规定参数、正向单位数、对照证据、可执行来源规则和通过验证的 observation；段落与整篇还必须有人工复核证据。它同时校验正文文风记录：除标题、表格及表格数据、代码、JSON、导航和控件外，目标 `SKILL.md`、五份正式档案、已有任务适配器和 HTML 正文必须使用目标语料语言，并由独立任务按词汇、句式、段落和整篇四层复核；正文或 HTML 改动后，哈希不一致会使旧记录失效。最终交付目标语言风格必须通过该检查。如果某层只有候选、任务适配器或由其他层间接推断，结构校验可以通过，但成熟度只能是 `partial` 或 `insufficient`，不得称为已经完成的语言风格。

`style-extraction-report.json` 必须包含 `layerMaturity` 和 `bodyStyleValidation`。四层分别记录分析单位、单位数、已完成检查、仍缺检查和证据说明；`overall` 由四层状态自动核对。`bodyStyleValidation` 保存被复核正文的版本、语言、源文件哈希、Markdown 与 HTML 正文哈希、逐文件结果和独立复核记录。词汇层的词频不能替代句式统计，对白碎片不能替代段落边界，局部发言不能替代整篇编排；规则表完整也不能替代正文实际采用目标文风。校验器必须把“文件齐全”“证据齐全”和“正文文风通过”分开报告。

改写时先保留目标文本的身份和任务，再选择两三项可迁移的文风特征，例如“短句为主 + 具体动词 + 先事实后判断”。不要逐句仿写，也不要为了模仿词频而牺牲事实边界。

### 4. 用修辞控制语气和节奏

- **对比**：比较对象处在同一维度，并写出差异造成的结果。
- **比喻或类比**：说明陌生机制与熟悉经验的对应关系；必要时说明类比在哪一点失效。
- **排比**：并列项的语法和层级一致；过长时改为列表。
- **设问**：提出读者真正会问的问题，紧接真实回答。
- **反复**：固定主旨、术语或限制，不用近义词轮换制造文采。
- **举例**：把抽象机制落到具体场景，不以个例冒充普遍结论。

避免用口号、连续反问、堆叠形容词、过度拟人或戏剧化语气制造“力度”。它们不能弥补缺失的因果和证据。
