import { executeArtPipeline } from "./art_engine_core.js";
import { FLAGSHIP_THEME_CONFIGS } from "./art_director.js";
import { ENTITY_TEMPLATES } from "./scene_schema.js";

export const FLAGSHIP_QUALITY_THRESHOLD = 72;
const FALLBACK_TEMPLATES = ["person", "tree", "cloud", "grass"];

function supportedTemplates(config) {
  return [...new Set([...config.requiredRoles, ...config.narrativeElements]
    .filter(templateId => templateId in ENTITY_TEMPLATES))];
}

export function buildFlagshipScene(themeId, variant = 0) {
  const config = FLAGSHIP_THEME_CONFIGS[themeId];
  if (!config) throw new Error(`Unknown flagship theme: ${themeId}`);
  const templates = supportedTemplates(config);
  while (templates.length < 4) templates.push(FALLBACK_TEMPLATES[templates.length]);
  const layouts = variant % 2 === 0
    ? [[70, 80, 420, 250, -2], [520, 180, 300, 290, 0], [280, 300, 250, 330, 2], [20, 480, 960, 210, 2]]
    : [[520, 60, 390, 250, -2], [100, 190, 330, 300, 0], [500, 300, 260, 330, 2], [20, 470, 960, 220, 1]];
  return templates.slice(0, 4).map((templateId, index) => {
    const [x, y, width, height, layer] = layouts[index];
    return {
      id: `${themeId}-${variant}-${index}`, kind: "entity", name: `${templateId}-${index}`,
      templateId, role: index === 2 ? "focus" : "", x, y, width, height, layer,
      rotation: 0, opacity: 1, params: {}
    };
  });
}

export function scoreFlagshipScene(themeId, entities, renderProfile = {}) {
  const config = FLAGSHIP_THEME_CONFIGS[themeId];
  if (!config) return { passed: false, score: 0, reasons: ["missing-theme-config"] };
  const cloned = entities.map(entity => ({ ...entity, params: { ...(entity.params || {}) } }));
  const pipeline = executeArtPipeline(cloned, { theme: themeId }, renderProfile, "storybook");
  const scores = pipeline.metadata.compositionScores || pipeline.directorResult.evaluation?.scores || {};
  const present = new Set(cloned.map(entity => entity.templateId));
  const required = config.requiredRoles.filter(templateId => templateId in ENTITY_TEMPLATES);
  const requiredCoverage = required.length ? required.filter(id => present.has(id)).length / required.length : 1;
  const narrative = supportedTemplates(config);
  const narrativeCoverage = narrative.length ? narrative.filter(id => present.has(id)).length / narrative.length : 1;

  let score = 0;
  score += pipeline.directorResult.accepted ? 30 : 0;
  score += Math.min(20, (scores.depthLayers || 0) / 3 * 20);
  score += (scores.focusScale || 0) >= 0.06 && (scores.focusScale || 0) <= 0.55 ? 15 : 0;
  score += (scores.occupiedArea || 0) >= 0.18 && (scores.occupiedArea || 0) <= 0.88 ? 15 : 0;
  score += requiredCoverage * 12;
  score += narrativeCoverage * 8;
  score = Math.round(score);

  const reasons = [];
  if (!pipeline.directorResult.accepted) reasons.push(pipeline.directorResult.rejectionReason || "art-director-rejected");
  if (requiredCoverage < 1) reasons.push("missing-required-roles");
  if ((scores.depthLayers || 0) < 3) reasons.push("missing-depth-layers");
  if (score < FLAGSHIP_QUALITY_THRESHOLD) reasons.push("below-quality-threshold");
  return { passed: score >= FLAGSHIP_QUALITY_THRESHOLD, score, reasons, scores, corrections: pipeline.directorResult.corrections };
}

export function evaluateFlagshipPortfolio() {
  return Object.keys(FLAGSHIP_THEME_CONFIGS).map(themeId => {
    const drafts = [0, 1].map(variant => {
      const entities = buildFlagshipScene(themeId, variant);
      return { variant, entities, quality: scoreFlagshipScene(themeId, entities) };
    });
    return { themeId, drafts, passed: drafts.every(draft => draft.quality.passed) };
  });
}
