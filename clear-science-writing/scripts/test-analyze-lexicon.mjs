#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const analyzer = path.join(scriptDirectory, "analyze-lexicon.mjs");
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "clear-science-writing-test-"));

function run(input, ...args) {
  return JSON.parse(execFileSync(process.execPath, [analyzer, input, ...args], { encoding: "utf8" }));
}

function runFailure(input, ...args) {
  try {
    execFileSync(process.execPath, [analyzer, input, ...args], { encoding: "utf8", stdio: "pipe" });
  } catch (error) {
    return error.stderr?.toString() ?? String(error);
  }
  assert.fail("Expected analyze-lexicon to fail");
}

function category(report, name) {
  const value = report.categories.find((item) => item.category === name);
  assert.ok(value, `Missing category: ${name}`);
  return value;
}

function form(report, categoryName, term) {
  const value = category(report, categoryName).dominantForms.find((item) => item.term === term);
  assert.ok(value, `Missing reported term ${term} in ${categoryName}`);
  return value;
}

function categoryPair(report, scope, left, right) {
  return report.styleMetrics.categoryCombinations[scope].pairs.find((item) => (
    item.categories.includes(left) && item.categories.includes(right)
  ));
}

try {
  const englishFile = path.join(temporaryRoot, "english.txt");
  fs.writeFileSync(
    englishFile,
    "He runs. She walks. I agree.\nDon't stop. See https://example.com/a.b.\n",
    "utf8"
  );
  const english = run(englishFile, "--language", "en", "--open-top", "5");
  assert.equal(english.corpus.sentences, 5, "English periods must split sentences");
  assert.equal(english.corpus.pathMode, "anonymous");
  assert.deepEqual(english.corpus.files, ["source-0001.txt"]);
  assert.ok(!JSON.stringify(english).includes(path.resolve(temporaryRoot)), "Default reports must not disclose absolute source paths");
  assert.equal(english.styleMetrics.punctuation.periods, 5, "URL dots must not inflate terminal-period counts");
  assert.equal(english.styleMetrics.punctuation.quotationMarks, 0, "Contraction apostrophes are not quotation marks");
  const englishAbsolutePaths = run(englishFile, "--language", "en", "--path-mode", "absolute", "--open-top", "5");
  assert.equal(englishAbsolutePaths.corpus.input, path.resolve(englishFile));
  assert.equal(englishAbsolutePaths.corpus.files[0], path.resolve(englishFile));

  const curlyContractionsFile = path.join(temporaryRoot, "curly-contractions.txt");
  fs.writeFileSync(curlyContractionsFile, "Don’t stop. It isn’t done.\n", "utf8");
  const curlyContractions = run(curlyContractionsFile, "--language", "en", "--open-top", "5");
  assert.equal(form(curlyContractions, "negation", "don't").count, 1);
  assert.equal(form(curlyContractions, "negation", "isn't").count, 1);

  const englishPositionsFile = path.join(temporaryRoot, "english-positions.txt");
  fs.writeFileSync(englishPositionsFile, "Hello there, he waits. I see you.\n", "utf8");
  const englishPositions = run(englishPositionsFile, "--language", "en", "--open-top", "5");
  assert.equal(form(englishPositions, "personal_pronouns", "he").positions.sentenceStart, 0);
  assert.equal(form(englishPositions, "personal_pronouns", "you").positions.sentenceEnd, 1);

  const englishPunctuationFile = path.join(temporaryRoot, "english-punctuation.txt");
  fs.writeFileSync(englishPunctuationFile, `"Are you?" James' book. "Yes."\n`, "utf8");
  const englishPunctuation = run(englishPunctuationFile, "--language", "en", "--open-top", "5");
  assert.equal(englishPunctuation.styleMetrics.sentenceTypes.question, 1);
  assert.equal(englishPunctuation.styleMetrics.sentenceTypes.declarative, 2);
  assert.equal(englishPunctuation.styleMetrics.punctuation.quotationMarks, 4, "Possessive apostrophes are not quotation marks");

  const markdownFile = path.join(temporaryRoot, "markdown.md");
  fs.writeFileSync(
    markdownFile,
    [
      "# Guide",
      "- If prose continues.",
      "> However quoted prose.",
      "1. Then finish.",
      "```js",
      "if (hidden) however();",
      "```",
      "Use `if (inline)` and [the link](https://example.com/a.b)."
    ].join("\n") + "\n",
    "utf8"
  );
  const markdown = run(markdownFile, "--language", "en", "--open-top", "20");
  assert.equal(form(markdown, "conditions", "if").count, 1, "Fenced and inline code must not enter lexical counts");
  assert.equal(form(markdown, "contrast_and_correction", "however").count, 1);
  assert.equal(form(markdown, "contrast_and_correction", "however").positions.sentenceStart, 1, "Markdown prefixes must not hide sentence starts");
  assert.equal(markdown.corpus.sentences, 5);
  assert.equal(markdown.corpus.sourceRecords, 8);
  assert.equal(markdown.corpus.sourceParagraphs, 5);
  assert.equal(markdown.corpus.eligibleParagraphs, 5);

  const markdownBlocksFile = path.join(temporaryRoot, "markdown-blocks.md");
  fs.writeFileSync(
    markdownBlocksFile,
    [
      "# Title",
      "A soft-wrapped",
      "paragraph stays together.",
      "",
      "~~~js",
      "if (hidden) stop();",
      "~~~",
      "    if (alsoHidden) stop();",
      "Visible ``if inline`` text."
    ].join("\n") + "\n",
    "utf8"
  );
  const markdownBlocks = run(markdownBlocksFile, "--language", "en", "--open-top", "10");
  assert.equal(markdownBlocks.corpus.sourceRecords, 7);
  assert.equal(markdownBlocks.corpus.sourceParagraphs, 3);
  assert.equal(markdownBlocks.corpus.eligibleParagraphs, 3, "Soft-wrapped prose must remain one paragraph while fenced and indented code stays excluded");
  assert.equal(
    category(markdownBlocks, "conditions").dominantForms.some((item) => item.term === "if"),
    false,
    "Tilde fences, indented code, and multi-backtick inline code must not enter lexical counts"
  );

  const markdownParagraphsFile = path.join(temporaryRoot, "markdown-paragraphs.md");
  fs.writeFileSync(
    markdownParagraphsFile,
    [
      "> If the quoted explanation starts here,",
      "> however it continues on the next source line.",
      "",
      "- Then the list item starts here,",
      "  because this is its continuation.",
      "  - Unless a nested item starts here,",
      "    therefore this line continues that nested item."
    ].join("\n") + "\n",
    "utf8"
  );
  const markdownParagraphs = run(markdownParagraphsFile, "--language", "en", "--open-top", "10");
  assert.equal(markdownParagraphs.corpus.sourceRecords, 3);
  assert.equal(markdownParagraphs.corpus.sourceParagraphs, 3, "Consecutive quote lines and list continuations must follow Markdown paragraph boundaries");
  assert.equal(markdownParagraphs.corpus.eligibleParagraphs, 3);
  assert.equal(markdownParagraphs.sampling.paragraphReferences.length, 3);
  assert.ok(categoryPair(markdownParagraphs, "paragraphs", "conditions", "contrast_and_correction"));
  assert.ok(categoryPair(markdownParagraphs, "paragraphs", "sequence", "cause_and_inference"));

  const plainMarkupFile = path.join(temporaryRoot, "plain-markup.txt");
  fs.writeFileSync(plainMarkupFile, "# If this is literal text.\nUse `if` literally.\n", "utf8");
  const plainMarkup = run(plainMarkupFile, "--language", "en", "--open-top", "5");
  assert.equal(form(plainMarkup, "conditions", "if").count, 2, "Plain text must not be cleaned as Markdown");

  const collocationBoundaryFile = path.join(temporaryRoot, "collocation-boundary.txt");
  fs.writeFileSync(collocationBoundaryFile, "Alpha ends. However beta starts.\n", "utf8");
  const collocationBoundary = run(collocationBoundaryFile, "--language", "en", "--open-top", "5");
  const howeverCollocations = form(collocationBoundary, "contrast_and_correction", "however").collocations;
  assert.ok(howeverCollocations.some((item) => item.phrase === "however beta"));
  assert.ok(!howeverCollocations.some((item) => item.phrase === "ends however"), "Collocations must not cross sentence boundaries");

  const chineseFile = path.join(temporaryRoot, "chinese.txt");
  fs.writeFileSync(chineseFile, "我不走。你别来。但我去。这很好。\n", "utf8");
  const chinese = run(chineseFile, "--language", "zh", "--open-top", "5");
  assert.equal(chinese.reportType, "LexiconScanReport");
  assert.equal(chinese.schemaVersion, 3);
  assert.match(chinese.note, /第一轮词汇统计/u);
  assert.match(chinese.styleMetrics.note, /机械指标/u);
  assert.match(category(chinese, "人称词").finding, /参考分类不是最终文风结论/u);
  assert.equal(form(chinese, "人称词", "我").count, 1);
  assert.equal(form(chinese, "转折与修正", "但").count, 1);

  const sharedCategoryTermFile = path.join(temporaryRoot, "shared-category-term.txt");
  fs.writeFileSync(sharedCategoryTermFile, "可能。\n", "utf8");
  const sharedCategoryTerm = run(sharedCategoryTermFile, "--language", "zh", "--open-top", "5");
  assert.equal(category(sharedCategoryTerm, "确定程度").dominantForms[0].term, "可能");
  assert.equal(category(sharedCategoryTerm, "缓和").dominantForms[0].term, "可能");
  assert.equal(
    categoryPair(sharedCategoryTerm, "sentences", "确定程度", "缓和"),
    undefined,
    "One shared lexical form must not create a category co-occurrence pair by itself"
  );
  for (const [categoryName, term] of [["人称词", "我"], ["否定与禁止", "不"], ["否定与禁止", "别"], ["程度", "很"]]) {
    const candidate = category(chinese, categoryName).ambiguousReferenceForms.find((item) => item.term === term);
    assert.ok(candidate && candidate.ambiguousSubstringCount > 0);
  }

  const chineseAmbiguityFile = path.join(temporaryRoot, "chinese-ambiguity.txt");
  fs.writeFileSync(chineseAmbiguityFile, "其他人乘坐一只船沉没，过去以后离开。\n", "utf8");
  const chineseAmbiguity = run(chineseAmbiguityFile, "--language", "zh", "--open-top", "5");
  for (const [categoryName, term] of [["人称词", "他"], ["否定与禁止", "没"], ["范围与数量", "只"], ["命令与动作", "去"]]) {
    assert.ok(!category(chineseAmbiguity, categoryName).dominantForms.some((item) => item.term === term));
  }

  const chineseSuffixFile = path.join(temporaryRoot, "chinese-suffix.txt");
  fs.writeFileSync(chineseSuffixFile, "我去。再去。真好。\n", "utf8");
  const chineseSuffix = run(chineseSuffixFile, "--language", "zh", "--open-top", "5");
  for (const [categoryName, term] of [["命令与动作", "去"], ["评价", "好"]]) {
    const value = category(chineseSuffix, categoryName);
    assert.ok(value.ambiguousReferenceForms.some((item) => item.term === term && item.substringCount > 0));
    assert.ok(!value.absentReferenceForms.includes(term));
  }

  const chinesePrefixFile = path.join(temporaryRoot, "chinese-prefix.txt");
  fs.writeFileSync(chinesePrefixFile, "别人去年没收了我们这个东西。\n", "utf8");
  const chinesePrefix = run(chinesePrefixFile, "--language", "zh", "--open-top", "5");
  for (const [categoryName, term] of [["否定与禁止", "别"], ["命令与动作", "去"], ["否定与禁止", "没"], ["人称词", "我"], ["指示词", "这"]]) {
    const value = category(chinesePrefix, categoryName);
    assert.ok(!value.dominantForms.some((item) => item.term === term));
    assert.ok(value.ambiguousReferenceForms.some((item) => item.term === term));
  }
  assert.equal(form(chinesePrefix, "人称词", "我们").count, 1);
  assert.equal(form(chinesePrefix, "指示词", "这个").count, 1);

  const chinesePositionFile = path.join(temporaryRoot, "chinese-position.txt");
  fs.writeFileSync(chinesePositionFile, "我们先走，我留下。\n", "utf8");
  const chinesePosition = run(chinesePositionFile, "--language", "zh", "--open-top", "5");
  assert.equal(form(chinesePosition, "人称词", "我").positions.sentenceStart, 0);

  const paragraphPositionFile = path.join(temporaryRoot, "paragraph-position.txt");
  fs.writeFileSync(paragraphPositionFile, "如果可以，就继续。\n后面如果失败，就停止。\n", "utf8");
  const paragraphPosition = run(paragraphPositionFile, "--language", "zh", "--open-top", "5");
  const ifForm = form(paragraphPosition, "条件与假设", "如果");
  assert.equal(ifForm.paragraphCoverage, 2);
  assert.equal(ifForm.paragraphCoverageDenominator, 2);
  assert.equal(ifForm.positions.paragraphStart, 1);
  assert.equal(ifForm.positions.paragraphStartRatio, 0.5);
  assert.equal(ifForm.positions.sentenceCoverage, 2);
  assert.equal(ifForm.positions.sentenceStartRatio, 0.5);
  const conditionDecisionPair = categoryPair(paragraphPosition, "sentences", "条件与假设", "决策义务与许可");
  assert.ok(conditionDecisionPair && conditionDecisionPair.count === 1);
  assert.ok(paragraphPosition.styleMetrics.categoryCombinations.paragraphs.categoryCoverage.some((item) => item.category === "条件与假设" && item.count === 2));

  const rhythmFile = path.join(temporaryRoot, "rhythm.txt");
  fs.writeFileSync(rhythmFile, "短。这个句子明显长一些。再短。\n单句段。\n", "utf8");
  const rhythm = run(rhythmFile, "--language", "zh", "--open-top", "5").styleMetrics.rhythm;
  assert.equal(rhythm.paragraphsWithMultipleSentences, 1);
  assert.equal(rhythm.adjacentPairs, 2, "Sentence-length transitions must not cross paragraph boundaries");
  assert.equal(rhythm.directionChangeOpportunities, 1);
  assert.equal(rhythm.directionChanges, 1);
  assert.ok(rhythm.sentenceLengthStandardDeviation > 0);

  const thresholded = run(chineseFile, "--language", "zh", "--min-count", "2", "--open-top", "5");
  const pronouns = category(thresholded, "人称词");
  assert.ok(pronouns.belowMinimumForms.some((item) => item.term === "我" && item.count === 1));
  assert.ok(!pronouns.absentReferenceForms.includes("我"), "A hidden low-count term must not be reported as absent");

  const jsonlFile = path.join(temporaryRoot, "records.jsonl");
  const termsFile = path.join(temporaryRoot, "terms.json");
  fs.writeFileSync(
    jsonlFile,
    [
      JSON.stringify({ text: "alpha alpha" }),
      JSON.stringify({ text: "beta" }),
      JSON.stringify({ text: "alpha" })
    ].join("\n") + "\n",
    "utf8"
  );
  fs.writeFileSync(termsFile, `${JSON.stringify({ custom: ["alpha", "beta"] })}\n`, "utf8");
  const jsonl = run(
    jsonlFile,
    "--language", "en",
    "--terms-file", termsFile,
    "--terms-mode", "only",
    "--open-top", "5"
  );
  assert.equal(jsonl.corpus.sourceFiles, 1);
  assert.equal(jsonl.corpus.sourceDocuments, 3, "Each text-bearing JSONL record is a logical document");
  assert.equal(form(jsonl, "custom", "alpha").documentCoverage, 2);
  assert.equal(form(jsonl, "custom", "beta").documentCoverage, 1);
  assert.equal(form(jsonl, "custom", "alpha").documentCoverageDenominator, 3);
  assert.equal(form(jsonl, "custom", "alpha").coverageScope, "analyzed_logical_documents");

  const jsonlDiagnosticsFile = path.join(temporaryRoot, "records-with-gaps.jsonl");
  fs.writeFileSync(
    jsonlDiagnosticsFile,
    [
      JSON.stringify({ text: "alpha" }),
      JSON.stringify({ message: "beta" }),
      JSON.stringify({ quote: 42, text: "gamma" })
    ].join("\n") + "\n",
    "utf8"
  );
  const jsonlDiagnostics = run(
    jsonlDiagnosticsFile,
    "--language", "en",
    "--terms-file", termsFile,
    "--terms-mode", "only",
    "--open-top", "5"
  );
  assert.equal(jsonlDiagnostics.corpus.sourceDocuments, 2, "A later string field must be used when an earlier field is non-string");
  assert.equal(jsonlDiagnostics.corpus.jsonlDiagnostics[0].recordsRead, 3);
  assert.equal(jsonlDiagnostics.corpus.jsonlDiagnostics[0].recordsSkipped, 1);
  assert.deepEqual(jsonlDiagnostics.corpus.jsonlDiagnostics[0].skippedRecords, [{ line: 2, reason: "no_supported_nonempty_text_field" }]);

  const caseTermsFile = path.join(temporaryRoot, "case-terms.json");
  fs.writeFileSync(caseTermsFile, `${JSON.stringify({ custom: ["alpha", "ALPHA"] })}\n`, "utf8");
  const caseDeduplication = run(
    jsonlFile,
    "--language", "en",
    "--terms-file", caseTermsFile,
    "--terms-mode", "only",
    "--open-top", "5"
  );
  assert.equal(category(caseDeduplication, "custom").dominantForms.length, 1);
  assert.equal(category(caseDeduplication, "custom").totalHits, 3);

  const bomTermsFile = path.join(temporaryRoot, "bom-terms.json");
  fs.writeFileSync(bomTermsFile, `\uFEFF${JSON.stringify({ custom: ["alpha"] })}\n`, "utf8");
  const bomTerms = run(
    jsonlFile,
    "--language", "en",
    "--terms-file", bomTermsFile,
    "--terms-mode", "only",
    "--open-top", "5"
  );
  assert.equal(form(bomTerms, "custom", "alpha").count, 3, "UTF-8 BOM category files must be accepted on Windows");

  const chineseCollocationFile = path.join(temporaryRoot, "chinese-collocations.txt");
  const englishCollocationFile = path.join(temporaryRoot, "english-collocations.txt");
  const collocationTermsFile = path.join(temporaryRoot, "collocation-terms.json");
  fs.writeFileSync(chineseCollocationFile, "如果成功就继续。如果失败就停止。\n", "utf8");
  fs.writeFileSync(englishCollocationFile, "We should test. We should check.\n", "utf8");
  fs.writeFileSync(collocationTermsFile, `${JSON.stringify({ custom: ["如果", "should"] })}\n`, "utf8");
  const chineseCollocations = run(
    chineseCollocationFile,
    "--language", "zh",
    "--terms-file", collocationTermsFile,
    "--terms-mode", "only",
    "--open-top", "5"
  );
  const chinesePhrases = form(chineseCollocations, "custom", "如果").collocations;
  assert.ok(chinesePhrases.some((item) => item.direction === "right" && item.phrase === "如果成"));
  assert.ok(chinesePhrases.every((item) => [...item.phrase].length >= 2 && [...item.phrase].length <= 6));
  const englishCollocations = run(
    englishCollocationFile,
    "--language", "en",
    "--terms-file", collocationTermsFile,
    "--terms-mode", "only",
    "--open-top", "5"
  );
  assert.ok(form(englishCollocations, "custom", "should").collocations.some((item) => item.direction === "left" && item.phrase === "we should" && item.count === 2));

  const sampleDirectory = path.join(temporaryRoot, "sample-corpus");
  fs.mkdirSync(sampleDirectory);
  const sampleCorpus = path.join(sampleDirectory, "corpus.txt");
  const sampleOutput = path.join(sampleDirectory, "review-sample.jsonl");
  fs.writeFileSync(sampleCorpus, "one\ntwo\nthree\nfour\nfive\n", "utf8");
  const firstSample = run(
    sampleDirectory,
    "--language", "en",
    "--sample-size", "3",
    "--sample-seed", "42",
    "--sample-output", sampleOutput,
    "--open-top", "5"
  );
  const repeatedSample = run(
    sampleDirectory,
    "--language", "en",
    "--sample-size", "3",
    "--sample-seed", "42",
    "--sample-output", sampleOutput,
    "--open-top", "5"
  );
  assert.deepEqual(firstSample.sampling.paragraphReferences, repeatedSample.sampling.paragraphReferences);
  const afterSample = run(sampleDirectory, "--language", "en", "--open-top", "5");
  assert.equal(afterSample.corpus.sourceFiles, 1, "Generated sample JSONL must not re-enter directory scans");
  assert.equal(afterSample.corpus.sourceDocuments, 1);
  assert.equal(afterSample.corpus.sourceParagraphs, 5);

  const nestedSignatureFile = path.join(sampleDirectory, "ordinary-with-nested-signature.jsonl");
  fs.writeFileSync(
    nestedSignatureFile,
    `${JSON.stringify({ metadata: { recordType: "clear-science-writing-sampled-paragraph-v1" }, text: "ordinary alpha text" })}\n`,
    "utf8"
  );
  const nestedSignature = run(sampleDirectory, "--language", "en", "--open-top", "5");
  assert.equal(nestedSignature.corpus.sourceFiles, 2, "A nested recordType field must not make an ordinary JSONL corpus look like a generated sample file");
  assert.equal(nestedSignature.corpus.sourceDocuments, 2);

  const stratifiedDirectory = path.join(temporaryRoot, "stratified-corpus");
  fs.mkdirSync(stratifiedDirectory);
  fs.writeFileSync(path.join(stratifiedDirectory, "a.txt"), "a1\na2\na3\na4\na5\na6\na7\na8\n", "utf8");
  fs.writeFileSync(path.join(stratifiedDirectory, "b.txt"), "b1\nb2\n", "utf8");
  const stratified = run(
    stratifiedDirectory,
    "--language", "en",
    "--sample-size", "2",
    "--sample-strategy", "stratified",
    "--sample-seed", "42",
    "--path-mode", "relative",
    "--open-top", "5"
  );
  assert.deepEqual(new Set(stratified.sampling.paragraphReferences.map((item) => item.file)), new Set(["a.txt", "b.txt"]));

  const languageFile = path.join(temporaryRoot, "language.txt");
  fs.writeFileSync(
    languageFile,
    "Short heading\nThis English corpus contains enough ordinary words to determine its language from the full eligible input.\n",
    "utf8"
  );
  const fullLanguage = run(languageFile, "--sample-size", "0", "--open-top", "5");
  const headLanguage = run(
    languageFile,
    "--sample-size", "1",
    "--sample-strategy", "head",
    "--open-top", "5"
  );
  assert.equal(fullLanguage.language, "en");
  assert.equal(headLanguage.language, fullLanguage.language, "Sampling must not change corpus language detection");
  assert.equal(fullLanguage.schemaVersion, 3);

  const mixedLanguageFile = path.join(temporaryRoot, "mixed-language.txt");
  fs.writeFileSync(mixedLanguageFile, "这是中文材料并且需要单独分析。\nThis English material also needs separate analysis.\n", "utf8");
  assert.match(runFailure(mixedLanguageFile, "--open-top", "5"), /Mixed Chinese and English corpus detected/u);

  const identifierLanguageFile = path.join(temporaryRoot, "identifier-language.txt");
  fs.writeFileSync(identifierLanguageFile, `${"中文".repeat(15)} a_b_c abc123def a.b.c\n`, "utf8");
  const identifierLanguage = run(identifierLanguageFile, "--open-top", "5");
  assert.equal(identifierLanguage.language, "zh", "Code-like identifiers must each count as one English unit during language detection");
  assert.equal(identifierLanguage.languageEvidence.englishWords, 3);

  const noLanguageFile = path.join(temporaryRoot, "no-language.txt");
  fs.writeFileSync(noLanguageFile, "12345 😀\n", "utf8");
  assert.match(runFailure(noLanguageFile, "--open-top", "5"), /Could not detect Chinese or English text/u);

  assert.match(runFailure(languageFile, "--sample-size", "1foo"), /must be an integer/u);
  assert.match(runFailure(languageFile, "--sample-size", "1.9"), /must be an integer/u);
  assert.match(runFailure(languageFile, "--sample-seed", "--language", "en"), /Missing value for --sample-seed/u);
  assert.match(runFailure(languageFile, "--terms-mode", "only"), /requires --terms-file/u);
  assert.match(runFailure(languageFile, "--path-mode", "public"), /anonymous, relative, or absolute/u);

  process.stdout.write("analyze-lexicon tests passed\n");
} finally {
  const resolvedTemporaryRoot = path.resolve(temporaryRoot);
  const resolvedSystemTemp = path.resolve(os.tmpdir());
  assert.ok(resolvedTemporaryRoot.startsWith(`${resolvedSystemTemp}${path.sep}`));
  assert.ok(path.basename(resolvedTemporaryRoot).startsWith("clear-science-writing-test-"));
  fs.rmSync(resolvedTemporaryRoot, { recursive: true, force: true });
}
