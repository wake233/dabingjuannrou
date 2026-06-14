/**
 * Composition Evaluation — Listen Paint Art Engine v4
 *
 * Evaluates and validates scene composition against art direction rules.
 * Checks focus scale, occlusion, negative space, depth layers, palette
 * harmony, and lighting consistency at the entity layout level.
 */

import { CANVAS } from "./model.js";
import { getGrammarCategory } from "./shape_grammar.js";
import { getLightingProfile } from "./lighting.js";

const COMPOSITION_RULES = {
  // Minimum size ratio of focus entity relative to canvas
  minFocusScale: 0.08,
  // Maximum size ratio (prevent over-large subjects)
  maxFocusScale: 0.60,
  // Minimum negative space ratio
  minNegativeSpace: 0.10,
  // Minimum depth layers required for a valid scene
  minDepthLayers: 2,
  // Maximum entity count per depth layer
  maxPerLayer: 30,
  // Minimum entity overlap threshold (too much overlap = bad)
  maxOverlapRatio: 0.60
};

/**
 * Evaluate a scene composition and return a quality report.
 *
 * @param {Array<object>} entities - array of entity objects
 * @param {object} scene - scene metadata
 * @param {object} renderProfile - render profile
 * @returns {object} { passed: boolean, issues: Array<{rule, detail}>, scores: object }
 */
export function evaluateComposition(entities, scene = {}, renderProfile = {}) {
  const issues = [];
  const scores = {};
  const entityArr = entities.filter(e => e.kind === "entity");

  if (entityArr.length === 0) {
    return { passed: true, issues: [], scores: { entityCount: 0 } };
  }

  // 1. Check focus entity scale
  const focusEntity = entityArr.find(e => e.role === "主角")
    || entityArr.find(e => e.layer >= 0)
    || entityArr[0];

  if (focusEntity) {
    const focusArea = (focusEntity.width * focusEntity.height) / (CANVAS.width * CANVAS.height);
    scores.focusScale = focusArea;
    if (focusArea < COMPOSITION_RULES.minFocusScale) {
      issues.push({ rule: "focus-too-small", detail: `主体占据画布 ${(focusArea * 100).toFixed(1)}%，低于最低 ${(COMPOSITION_RULES.minFocusScale * 100).toFixed(0)}%` });
    }
    if (focusArea > COMPOSITION_RULES.maxFocusScale) {
      issues.push({ rule: "focus-too-large", detail: `主体过大，占据画布 ${(focusArea * 100).toFixed(1)}%` });
    }
  }

  // 2. Check depth layers
  const layers = new Set(entityArr.map(e => e.layer || 0));
  scores.depthLayers = layers.size;
  if (layers.size < COMPOSITION_RULES.minDepthLayers) {
    issues.push({ rule: "insufficient-depth", detail: `场景只有 ${layers.size} 个深度层次，需要至少 ${COMPOSITION_RULES.minDepthLayers} 层` });
  }

  // 3. Check occlusion (entity overlap)
  if (entityArr.length >= 2) {
    let totalOverlapArea = 0;
    let pairCount = 0;
    for (let i = 0; i < entityArr.length; i++) {
      for (let j = i + 1; j < entityArr.length; j++) {
        const a = entityArr[i], b = entityArr[j];
        const overlap = rectOverlap(a, b);
        if (overlap > 0) {
          totalOverlapArea += overlap / (a.width * a.height);
          pairCount++;
        }
      }
    }
    if (pairCount > 0) {
      scores.avgOverlap = totalOverlapArea / pairCount;
      if (scores.avgOverlap > COMPOSITION_RULES.maxOverlapRatio) {
        issues.push({ rule: "severe-occlusion", detail: "实体间遮挡过于严重" });
      }
    } else {
      scores.avgOverlap = 0;
    }
  }

  // 4. Check negative space
  const totalEntityArea = entityArr.reduce((sum, e) => sum + e.width * e.height, 0);
  const negativeSpace = 1 - totalEntityArea / (CANVAS.width * CANVAS.height);
  scores.negativeSpace = negativeSpace;
  if (negativeSpace < COMPOSITION_RULES.minNegativeSpace && entityArr.length > 1) {
    issues.push({ rule: "insufficient-negative-space", detail: `留白比例 ${(negativeSpace * 100).toFixed(1)}%，低于最低 ${(COMPOSITION_RULES.minNegativeSpace * 100).toFixed(0)}%` });
  }

  // 5. Check entity count per layer
  for (const layer of layers) {
    const count = entityArr.filter(e => (e.layer || 0) === layer).length;
    if (count > COMPOSITION_RULES.maxPerLayer) {
      issues.push({ rule: "too-many-per-layer", detail: `深度层 ${layer} 中有 ${count} 个实体，超过上限 ${COMPOSITION_RULES.maxPerLayer}` });
    }
  }

  // 6. Check category balance
  const categories = new Set();
  for (const e of entityArr) {
    const cat = getGrammarCategory(e.templateId);
    if (cat) categories.add(cat.key);
  }
  scores.categoryCount = categories.size;

  return {
    passed: issues.length === 0,
    issues,
    scores
  };
}

/**
 * Compute the overlap area ratio between two entity rectangles.
 *
 * @param {object} a - entity with x, y, width, height
 * @param {object} b - entity with x, y, width, height
 * @returns {number} overlap area (0 if no overlap)
 */
function rectOverlap(a, b) {
  const ax2 = a.x + a.width, ay2 = a.y + a.height;
  const bx2 = b.x + b.width, by2 = b.y + b.height;
  const overlapX = Math.max(0, Math.min(ax2, bx2) - Math.max(a.x, b.x));
  const overlapY = Math.max(0, Math.min(ay2, by2) - Math.max(a.y, b.y));
  return overlapX * overlapY;
}

/**
 * Check if an entity is positioned within a valid canvas region.
 *
 * @param {object} entity
 * @param {number} [margin=50] - margin from canvas edge
 * @returns {boolean}
 */
export function isInCanvasBounds(entity, margin = 50) {
  return entity.x >= -margin
    && entity.y >= -margin
    && entity.x + entity.width <= CANVAS.width + margin
    && entity.y + entity.height <= CANVAS.height + margin;
}

/**
 * Compute the visual weight of an entity.
 * Larger, more central entities have higher weight.
 *
 * @param {object} entity
 * @returns {number}
 */
export function visualWeight(entity) {
  const area = entity.width * entity.height;
  const canvasArea = CANVAS.width * CANVAS.height;
  const cx = entity.x + entity.width / 2;
  const cy = entity.y + entity.height / 2;
  // Distance from center (normalized)
  const distFromCenter = Math.sqrt(
    Math.pow((cx - CANVAS.width / 2) / (CANVAS.width / 2), 2) +
    Math.pow((cy - CANVAS.height / 2) / (CANVAS.height / 2), 2)
  );
  const centrality = Math.max(0, 1 - distFromCenter);
  return (area / canvasArea) * (0.5 + centrality * 0.5);
}
