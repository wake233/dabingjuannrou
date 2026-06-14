import { ART_STYLES, generateCompositionDrafts } from "./art_schema.js";

/**
 * Evaluate portfolio subjects structurally, without auto-filled completion scores.
 * Visual acceptance is performed manually via the entity gallery and benchmark scenes pages.
 */
export function evaluatePortfolio(subjects) {
  if (!Array.isArray(subjects) || subjects.length < 6) throw new Error("作品集题材不足");
  return subjects.map(subject => {
    const styles = Object.fromEntries(ART_STYLES.map(style => {
      const drafts = generateCompositionDrafts(subject.title, style, 1);
      const distinct = ["focus", "flow", "scale", "negativeSpace"].every(
        field => new Set(drafts.map(draft => draft[field])).size === 3
      );
      return [style, {
        composition: distinct ? "三稿差异明显" : "小稿差异不足",
        draftsCount: drafts.length,
        requiresVisualReview: true
      }];
    }));
    return {
      id: subject.id,
      title: subject.title,
      styles,
      requiresVisualReview: true
    };
  });
}

export function portfolioSummary(subjects) {
  const entries = evaluatePortfolio(subjects);
  return {
    entries,
    total: entries.length,
    note: "视觉验收需通过 26 实体图鉴和六张标杆场景人工审查"
  };
}
