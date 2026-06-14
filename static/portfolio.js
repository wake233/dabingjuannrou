import { ART_STYLES, generateCompositionDrafts } from "./art_schema.js";
import { evaluateFlagshipPortfolio } from "./quality_score.js";

export function evaluatePortfolio(subjects) {
  if (!Array.isArray(subjects) || subjects.length < 12) throw new Error("作品集题材不足");
  return subjects.map(subject => {
    const styles = Object.fromEntries(ART_STYLES.map(style => {
      const drafts = generateCompositionDrafts(subject.title, style, 1);
      const distinct = ["focus", "flow", "scale", "negativeSpace"].every(
        field => new Set(drafts.map(draft => draft[field])).size === 3
      );
      return [style, {
        composition: distinct ? "three-distinct-drafts" : "insufficient-difference",
        draftsCount: drafts.length,
        requiresVisualReview: true
      }];
    }));
    return { id: subject.id, title: subject.title, styles, requiresVisualReview: true };
  });
}

export function portfolioSummary(subjects) {
  const entries = evaluatePortfolio(subjects);
  const flagship = evaluateFlagshipPortfolio();
  return {
    entries,
    flagship,
    total: entries.length,
    passed: flagship.every(entry => entry.passed),
    note: "结构质量门禁自动执行；视觉完成度仍需浏览器人工审查。"
  };
}
