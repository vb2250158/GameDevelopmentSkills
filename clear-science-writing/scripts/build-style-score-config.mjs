#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

if (process.argv.length !== 3) {
  console.error("Usage: node build-style-score-config.mjs <style-skill-directory>");
  process.exit(1);
}
const skillDirectory = path.resolve(process.argv[2]);
const references = path.join(skillDirectory, "references");
const data = JSON.parse(fs.readFileSync(path.join(references, "style-data.json"), "utf8"));
const relationshipTypes = new Set(["亲属称呼", "反身与相互指称"]);
const lexicalForms = (data.vocabularyTypes ?? []).flatMap((type) => (type.items ?? [])
  .filter((item) => typeof item?.word === "string" && item.word.length >= 2 && Number(item.count ?? 0) > 0)
  .map((item) => {
    const scope = item.scope ?? (relationshipTypes.has(type.name) ? "scene_limited" : "main");
    return { term: item.word, type: type.name, core: Boolean(type.core), scope, sceneTags: item.sceneTags ?? (scope === "scene_limited" ? ["relationship", "dialogue"] : []), sourcePer10k: Number(item.per10kCharacters ?? 0) };
  }));
const sentenceForms = (data.sentencePatterns ?? []).flatMap((pattern) => {
  const sourcePer10k = Number(pattern.frequency?.per100Sentences ?? 0) * 100;
  if (pattern.recognition?.kind === "regex" && typeof pattern.recognition.rule === "string") {
    return [{ term: pattern.template ?? pattern.name, regex: pattern.recognition.rule, pattern: pattern.name, scope: pattern.scope ?? "main", sceneTags: pattern.sceneTags ?? (pattern.scope === "scene_limited" ? ["dialogue"] : []), sourcePer10k }];
  }
  return (pattern.markers ?? [])
    .filter((term) => typeof term === "string" && term.length >= 2 && !/[.…]/.test(term))
    .map((term) => ({ term, pattern: pattern.name, scope: pattern.scope ?? "main", sceneTags: pattern.sceneTags ?? (pattern.scope === "scene_limited" ? ["dialogue"] : []), sourcePer10k }));
});
const config = {
  schemaVersion: 1,
  calibrationStatus: "draft",
  generatedFrom: "style-data.json",
  calibrationRule: "Set a layer to calibrated only after multi-Agent sampling, full-corpus recount, and human semantic review have supplied the applicable target baselines.",
  layers: {
    lexical: { status: lexicalForms.length ? "draft" : "unavailable", forms: lexicalForms, minimumDistinctTypes: 3, densityFraction: 0.2 },
    sentence: { status: sentenceForms.length ? "draft" : "unavailable", forms: sentenceForms, minimumDistinctPatterns: 2, densityFraction: 0.1 },
    paragraph: { status: "needs_human_calibration", proxies: [], dialogueActionRatio: null },
    composition: { status: "needs_human_calibration", proxies: [], minimumParagraphs: null },
  },
};
fs.writeFileSync(path.join(references, "style-score-config.json"), `${JSON.stringify(config, null, 2)}\n`, "utf8");
console.log(`Generated score config: ${path.join(references, "style-score-config.json")}`);
