import { CANVAS } from "./model.js";
import { getGrammarCategory } from "./shape_grammar.js";

export const COMPOSITION_RULES = Object.freeze({
  minFocusScale: 0.06,
  maxFocusScale: 0.55,
  minOccupiedArea: 0.18,
  maxOccupiedArea: 0.88,
  minDepthLayers: 3,
  maxOverlapRatio: 0.48,
  maxPerLayer: 30
});

function focusEntity(entities) {
  return entities.find(entity => entity.role === "主角" || entity.role === "focus")
    || entities.find(entity => getGrammarCategory(entity.templateId)?.key === "figure")
    || entities.find(entity => (entity.layer || 0) >= 0)
    || entities[0];
}

function boundsOf(entities) {
  const x1 = Math.min(...entities.map(entity => entity.x));
  const y1 = Math.min(...entities.map(entity => entity.y));
  const x2 = Math.max(...entities.map(entity => entity.x + entity.width));
  const y2 = Math.max(...entities.map(entity => entity.y + entity.height));
  return { width: Math.max(0, x2 - x1), height: Math.max(0, y2 - y1) };
}

function overlapRatio(a, b) {
  const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return (width * height) / Math.max(1, Math.min(a.width * a.height, b.width * b.height));
}

export function evaluateComposition(entities, scene = {}, renderProfile = {}) {
  const entityArr = entities.filter(entity => entity.kind === "entity");
  if (!entityArr.length) return { passed: true, issues: [], scores: { entityCount: 0, occupiedArea: 0 } };

  const issues = [];
  const canvasArea = CANVAS.width * CANVAS.height;
  const focus = focusEntity(entityArr);
  const focusScale = (focus.width * focus.height) / canvasArea;
  const visibleEntities = entityArr.filter(entity => getGrammarCategory(entity.templateId)?.key !== "atmosphere");
  const bounds = boundsOf(visibleEntities.length ? visibleEntities : entityArr);
  const occupiedArea = (bounds.width * bounds.height) / canvasArea;
  const layers = new Set(entityArr.map(entity => entity.layer || 0));
  const overlaps = [];

  for (let i = 0; i < visibleEntities.length; i++) {
    for (let j = i + 1; j < visibleEntities.length; j++) {
      if ((visibleEntities[i].layer || 0) === (visibleEntities[j].layer || 0)) overlaps.push(overlapRatio(visibleEntities[i], visibleEntities[j]));
    }
  }
  const avgOverlap = overlaps.length ? overlaps.reduce((sum, value) => sum + value, 0) / overlaps.length : 0;

  if (focusScale < COMPOSITION_RULES.minFocusScale) issues.push({ rule: "focus-too-small", detail: focusScale });
  if (focusScale > COMPOSITION_RULES.maxFocusScale) issues.push({ rule: "focus-too-large", detail: focusScale });
  if (entityArr.length >= 3 && layers.size < COMPOSITION_RULES.minDepthLayers) issues.push({ rule: "insufficient-depth", detail: layers.size });
  if (entityArr.length >= 2 && occupiedArea < COMPOSITION_RULES.minOccupiedArea) issues.push({ rule: "excessive-negative-space", detail: occupiedArea });
  if (occupiedArea > COMPOSITION_RULES.maxOccupiedArea) issues.push({ rule: "insufficient-negative-space", detail: occupiedArea });
  if (avgOverlap > COMPOSITION_RULES.maxOverlapRatio) issues.push({ rule: "severe-occlusion", detail: avgOverlap });

  return {
    passed: issues.length === 0,
    issues,
    scores: {
      entityCount: entityArr.length,
      focusScale,
      occupiedArea,
      negativeSpace: 1 - occupiedArea,
      depthLayers: layers.size,
      avgOverlap,
      categoryCount: new Set(entityArr.map(entity => getGrammarCategory(entity.templateId)?.key).filter(Boolean)).size
    }
  };
}

export function isInCanvasBounds(entity, margin = 50) {
  return entity.x >= -margin && entity.y >= -margin
    && entity.x + entity.width <= CANVAS.width + margin
    && entity.y + entity.height <= CANVAS.height + margin;
}

export function visualWeight(entity) {
  const area = entity.width * entity.height;
  const cx = entity.x + entity.width / 2;
  const cy = entity.y + entity.height / 2;
  const distance = Math.hypot((cx - CANVAS.width / 2) / (CANVAS.width / 2), (cy - CANVAS.height / 2) / (CANVAS.height / 2));
  return (area / (CANVAS.width * CANVAS.height)) * (0.5 + Math.max(0, 1 - distance) * 0.5);
}
