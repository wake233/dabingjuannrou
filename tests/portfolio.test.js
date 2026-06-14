import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { portfolioSummary } from "../static/portfolio.js";
import { generateCompositionDrafts } from "../static/art_schema.js";

const portfolio = JSON.parse(fs.readFileSync(new URL("../docs/portfolio.json", import.meta.url), "utf8"));

test("十二题材三风格作品集均达到五维评分门槛", () => {
  const summary = portfolioSummary(portfolio.subjects);
  assert.equal(summary.total, 12);
  assert.equal(summary.passed, 12);
  assert.ok(summary.average >= 4);
  for (const entry of summary.entries) {
    assert.deepEqual(Object.keys(entry.styles), ["storybook", "woodcut", "ink"]);
    assert.ok(Object.values(entry.styles).every(scores => Object.values(scores).every(score => score >= 4)));
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
