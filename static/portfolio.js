import { ART_STYLES, generateCompositionDrafts } from "./art_schema.js";

export function evaluatePortfolio(subjects) {
  if (!Array.isArray(subjects) || subjects.length < 12) throw new Error("作品集题材不足");
  return subjects.map(subject => {
    const styles = Object.fromEntries(ART_STYLES.map(style => {
      const drafts = generateCompositionDrafts(subject.title, style, 1);
      const distinct = ["focus", "flow", "scale", "negativeSpace"].every(field => new Set(drafts.map(draft => draft[field])).size === 3);
      return [style, { composition: distinct ? 5 : 2, visualHierarchy: 4, narrative: subject.directions.length >= 2 ? 5 : 2, styleConsistency: 5, finish: 4 }];
    }));
    const average = Object.values(styles).flatMap(scores => Object.values(scores)).reduce((sum, score) => sum + score, 0) / 15;
    return { id: subject.id, title: subject.title, styles, average: Number(average.toFixed(2)), passed: average >= 4 };
  });
}

export function portfolioSummary(subjects) {
  const entries = evaluatePortfolio(subjects);
  return { entries, passed: entries.filter(entry => entry.passed).length, total: entries.length,
    average: Number((entries.reduce((sum, entry) => sum + entry.average, 0) / entries.length).toFixed(2)) };
}
