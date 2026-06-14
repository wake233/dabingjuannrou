import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { portfolioSummary } from "../static/portfolio.js";
import { generateCompositionDrafts } from "../static/art_schema.js";

const portfolio = JSON.parse(fs.readFileSync(new URL("../docs/portfolio.json", import.meta.url), "utf8"));

test("作品集返回结构化的题材信息，不自动填充完成度分数", () => {
  const summary = portfolioSummary(portfolio.subjects);
  assert.equal(summary.total, portfolio.subjects.length);
  assert.ok(summary.note.includes("人工审查"));
  for (const entry of summary.entries) {
    assert.deepEqual(Object.keys(entry.styles), ["storybook", "woodcut", "ink"]);
    assert.equal(entry.requiresVisualReview, true);
    for (const [, styleInfo] of Object.entries(entry.styles)) {
      assert.equal(typeof styleInfo.composition, "string");
      assert.equal(styleInfo.requiresVisualReview, true);
    }
  }
});

test("同题材不同审美方向与小稿选择形成明显不同有效作品", () => {
  for (const subject of portfolio.subjects) {
    assert.notEqual(subject.directions[0], subject.directions[1]);
    const drafts = generateCompositionDrafts(subject.title, "storybook", 1);
    const first = drafts[0], last = drafts[2];
    assert.notEqual(first.focus, last.focus);
    assert.notEqual(first.flow, last.flow);
    assert.notEqual(first.negativeSpace, last.negativeSpace);
  }
});
