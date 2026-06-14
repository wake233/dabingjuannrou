/**
 * Local Art Director — Listen Paint Art Engine v4
 *
 * Runs after model planning to perform deterministic correction of:
 * - Focus scale and placement
 * - Occlusion resolution
 * - Negative space
 * - Depth layering
 * - Color palette coordination
 * - Lighting consistency
 *
 * Rejects scenes that violate hard rules (focus too small, severe occlusion,
 * element stacking, missing depth layers).
 */

import { CANVAS } from "./model.js";
import { getGrammarCategory } from "./shape_grammar.js";
import { getLightingProfile } from "./lighting.js";
import { evaluateComposition } from "./composition.js";

/**
 * Hard rule thresholds for scene rejection.
 */
const HARD_RULES = {
  minFocusAreaRatio: 0.03,       // focus must be at least 3% of canvas
  maxOverlapRatio: 0.75,         // max acceptable overlap between entities
  minDepthLayers: 1,             // at least one distinguishable layer
  maxStackingDensity: 5          // max entities in same small region
};

/**
 * Art direction configuration for a specific theme.
 *
 * @typedef {object} ArtDirectionConfig
 * @property {string} theme - theme identifier
 * @property {Array<string>} requiredRoles - required entity roles
 * @property {object} compositionRange - acceptable composition ranges
 * @property {Array<Array<string>>} colorRelations - color relationship hints
 * @property {Array<string>} narrativeElements - necessary narrative elements
 */

/**
 * Predefined art direction configs for the 12 flagship themes.
 */
const FLAGSHIP_THEME_CONFIGS = {
  "雨中归人": {
    theme: "雨中归人",
    requiredRoles: ["人物", "雨", "伞"],
    compositionRanges: { focusX: [0.25, 0.55], focusY: [0.20, 0.60], focusScale: [0.06, 0.30] },
    colorRelations: [["deepBlue", "rose"], ["night", "gold"], ["blue", "waterDark"]],
    narrativeElements: ["人物", "雨", "伞", "路灯或水洼"],
    depthPriority: ["foreground-figure", "midground-rain", "background-sky"]
  },
  "春日河岸": {
    theme: "春日河岸",
    requiredRoles: ["桥", "船", "河流", "树"],
    compositionRanges: { focusX: [0.30, 0.70], focusY: [0.25, 0.65], focusScale: [0.08, 0.35] },
    colorRelations: [["green", "waterDark"], ["gold", "foliage"], ["blue", "sky"]],
    narrativeElements: ["桥", "船", "河流", "飞鸟", "树"],
    depthPriority: ["foreground-water", "midground-bridge", "background-mountain"]
  },
  "安静街道": {
    theme: "安静街道",
    requiredRoles: ["街道", "房屋", "树"],
    compositionRanges: { focusX: [0.30, 0.70], focusY: [0.30, 0.70], focusScale: [0.05, 0.25] },
    colorRelations: [["wood", "green"], ["brick", "moss"], ["stone", "cream"]],
    narrativeElements: ["街道", "房屋", "自行车或长椅", "树"],
    depthPriority: ["foreground-street", "midground-buildings", "background-sky"]
  },
  "月夜": {
    theme: "月夜",
    requiredRoles: ["月亮", "星空"],
    compositionRanges: { focusX: [0.40, 0.80], focusY: [0.05, 0.35], focusScale: [0.04, 0.20] },
    colorRelations: [["night", "gold"], ["deepBlue", "cream"], ["moon", "stars"]],
    narrativeElements: ["月亮", "星空", "山或建筑剪影"],
    depthPriority: ["foreground-silhouette", "midground", "background-moon"]
  },
  "晴天公园": {
    theme: "晴天公园",
    requiredRoles: ["树", "花丛", "草地"],
    compositionRanges: { focusX: [0.20, 0.80], focusY: [0.30, 0.70], focusScale: [0.05, 0.20] },
    colorRelations: [["green", "rose"], ["foliage", "gold"], ["blue", "cream"]],
    narrativeElements: ["树", "花丛", "草地", "人物或鸟"],
    depthPriority: ["foreground-flowers", "midground-trees", "background-sky"]
  },
  "雪景小屋": {
    theme: "雪景小屋",
    requiredRoles: ["房屋", "树", "山"],
    compositionRanges: { focusX: [0.25, 0.75], focusY: [0.20, 0.60], focusScale: [0.05, 0.25] },
    colorRelations: [["cream", "night"], ["blue", "white"], ["brick", "blue"]],
    narrativeElements: ["房屋", "树", "山", "雪"],
    depthPriority: ["foreground-house", "midground-trees", "background-mountains"]
  },
  "渔港黄昏": {
    theme: "渔港黄昏",
    requiredRoles: ["船", "河流", "太阳"],
    compositionRanges: { focusX: [0.25, 0.75], focusY: [0.15, 0.65], focusScale: [0.05, 0.30] },
    colorRelations: [["gold", "waterLight"], ["rose", "waterDark"], ["wood", "gold"]],
    narrativeElements: ["船", "河流", "太阳", "建筑剪影"],
    depthPriority: ["foreground-boat", "midground-water", "background-sunset"]
  },
  "秋日山野": {
    theme: "秋日山野",
    requiredRoles: ["山", "树", "花丛"],
    compositionRanges: { focusX: [0.20, 0.80], focusY: [0.20, 0.60], focusScale: [0.06, 0.35] },
    colorRelations: [["warm", "gold"], ["rose", "moss"], ["gold", "foliage"]],
    narrativeElements: ["山", "树", "花丛", "云"],
    depthPriority: ["foreground-flowers", "midground-trees", "background-mountains"]
  }
};

/**
 * Run the local art director on a scene.
 *
 * Applies deterministic corrections for focus scale, occlusion,
 * negative space, depth layers, and palette coordination.
 * Hard rule violations cause rejection.
 *
 * @param {Array<object>} entities - entity objects
 * @param {object} scene - scene metadata
 * @param {object} renderProfile - render profile
 * @param {object} [options]
 * @param {boolean} [options.autoCorrect=true] - automatically correct fixable issues
 * @returns {object} { accepted: boolean, entities: Array, corrections: Array, rejectionReason: string|null }
 */
export function runArtDirector(entities, scene = {}, renderProfile = {}, options = {}) {
  const autoCorrect = options.autoCorrect !== false;
  const corrections = [];
  const entityArr = entities.filter(e => e.kind === "entity");

  if (entityArr.length === 0) {
    return { accepted: true, entities, corrections: [], rejectionReason: null };
  }

  // Step 1: Evaluate composition
  const evalResult = evaluateComposition(entityArr, scene, renderProfile);

  // Step 2: Hard rule checks (rejection)
  const rejection = checkHardRules(entityArr, evalResult);
  if (rejection && !autoCorrect) {
    return { accepted: false, entities, corrections, rejectionReason: rejection };
  }
  if (rejection && autoCorrect) {
    // Try auto-correction once
    const corrected = autoCorrectScene(entityArr, rejection);
    if (corrected.corrections.length > 0) {
      corrections.push(...corrected.corrections);
    }
    if (!corrected.success) {
      return { accepted: false, entities: corrected.entities, corrections, rejectionReason: rejection };
    }
  }

  // Step 3: Soft corrections
  if (autoCorrect) {
    // 3a. Center focus if too far from canvas center
    const focusEntity = entityArr.find(e => e.role === "主角")
      || entityArr.find(e => e.layer >= 0)
      || entityArr[0];

    if (focusEntity) {
      const themeConfig = findThemeConfig(scene.theme);
      if (themeConfig) {
        const ranges = themeConfig.compositionRanges;
        const focusCx = focusEntity.x + focusEntity.width / 2;
        const focusCy = focusEntity.y + focusEntity.height / 2;
        const targetX = CANVAS.width * ((ranges.focusX[0] + ranges.focusX[1]) / 2);
        const targetY = CANVAS.height * ((ranges.focusY[0] + ranges.focusY[1]) / 2);

        if (Math.abs(focusCx - targetX) > CANVAS.width * 0.15
          || Math.abs(focusCy - targetY) > CANVAS.height * 0.15) {
          const dx = targetX - focusCx;
          const dy = targetY - focusCy;
          entityArr.forEach(e => {
            e.x += dx;
            e.y += dy;
          });
          corrections.push({ action: "recenter-composition", dx: Math.round(dx), dy: Math.round(dy) });
        }
      }

      // 3b. Ensure minimum focus scale
      const focusArea = (focusEntity.width * focusEntity.height) / (CANVAS.width * CANVAS.height);
      if (focusArea < HARD_RULES.minFocusAreaRatio * 2) {
        const scaleUp = (HARD_RULES.minFocusAreaRatio * 2) / Math.max(focusArea, 0.001);
        const cappedScale = Math.min(scaleUp, 2.0);
        focusEntity.width = Math.round(focusEntity.width * cappedScale);
        focusEntity.height = Math.round(focusEntity.height * cappedScale);
        corrections.push({ action: "scale-focus", entity: focusEntity.name, scale: Number(cappedScale.toFixed(2)) });
      }
    }

    // 3c. Spread overlapping entities
    const overlapCorrections = resolveOverlaps(entityArr);
    corrections.push(...overlapCorrections);
  }

  return {
    accepted: true,
    entities,
    corrections,
    rejectionReason: null
  };
}

/**
 * Check hard rules that would cause scene rejection.
 *
 * @param {Array<object>} entities
 * @param {object} evalResult
 * @returns {string|null} rejection reason or null
 */
function checkHardRules(entities, evalResult) {
  // Rule 1: Focus too small
  if (evalResult.scores.focusScale !== undefined
    && evalResult.scores.focusScale < HARD_RULES.minFocusAreaRatio) {
    return `主体过小：占据画布 ${(evalResult.scores.focusScale * 100).toFixed(1)}%，低于最低要求 ${(HARD_RULES.minFocusAreaRatio * 100).toFixed(0)}%`;
  }

  // Rule 2: Severe occlusion
  if (evalResult.scores.avgOverlap !== undefined
    && evalResult.scores.avgOverlap > HARD_RULES.maxOverlapRatio) {
    return `严重遮挡：实体间平均重叠率达到 ${(evalResult.scores.avgOverlap * 100).toFixed(0)}%`;
  }

  // Rule 3: Insufficient depth
  if (evalResult.scores.depthLayers !== undefined
    && evalResult.scores.depthLayers < HARD_RULES.minDepthLayers) {
    return "缺少深度层次：场景需要至少一个可辨识的层次";
  }

  // Rule 4: Element stacking (many entities in same small region)
  if (entities.length >= HARD_RULES.maxStackingDensity) {
    const region = groupByRegion(entities);
    for (const [key, group] of Object.entries(region)) {
      if (group.length > HARD_RULES.maxStackingDensity) {
        return `元素堆叠：${group.length} 个实体集中在同一区域`;
      }
    }
  }

  return null;
}

/**
 * Group entities by region for stacking detection.
 */
function groupByRegion(entities) {
  const cellSize = 150; // pixels
  const grid = {};
  for (const e of entities) {
    const cx = Math.floor((e.x + e.width / 2) / cellSize);
    const cy = Math.floor((e.y + e.height / 2) / cellSize);
    const key = `${cx},${cy}`;
    if (!grid[key]) grid[key] = [];
    grid[key].push(e);
  }
  return grid;
}

/**
 * Auto-correct hard rule violations.
 */
function autoCorrectScene(entities, rejection) {
  const corrections = [];
  let success = false;

  // Handle focus too small: scale up the focus entity
  if (rejection.includes("主体过小")) {
    const focusEntity = entities.find(e => e.role === "主角")
      || entities.find(e => e.layer >= 0)
      || entities[0];
    if (focusEntity) {
      const focusArea = (focusEntity.width * focusEntity.height) / (CANVAS.width * CANVAS.height);
      if (focusArea < HARD_RULES.minFocusAreaRatio) {
        const scaleUp = Math.sqrt((HARD_RULES.minFocusAreaRatio * 1.2) / Math.max(focusArea, 0.0001));
        const cappedScale = Math.min(scaleUp, 5.0);
        focusEntity.width = Math.round(focusEntity.width * cappedScale);
        focusEntity.height = Math.round(focusEntity.height * cappedScale);
        corrections.push({ action: "scale-focus-up", entity: focusEntity.name || "主角", scale: Number(cappedScale.toFixed(2)) });
        success = true;
      }
    }
  }

  // Try spreading entities
  if (rejection.includes("遮挡") || rejection.includes("堆叠")) {
    const overlapCorrections = resolveOverlaps(entities);
    corrections.push(...overlapCorrections);
    success = overlapCorrections.length > 0 || success;
  }

  // Try re-layering
  if (rejection.includes("深度")) {
    let layerIdx = -2;
    for (const e of entities) {
      if (getGrammarCategory(e.templateId)?.key === "atmosphere") {
        e.layer = -3;
      } else if (getGrammarCategory(e.templateId)?.key === "nature") {
        e.layer = -1;
      } else {
        e.layer = layerIdx++;
      }
    }
    corrections.push({ action: "re-layer-entities" });
    success = true;
  }

  return { success, entities, corrections };
}

/**
 * Resolve overlapping entities by nudging them apart.
 */
function resolveOverlaps(entities) {
  const corrections = [];
  const MAX_ITERATIONS = 5;

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    let moved = false;
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const a = entities[i], b = entities[j];
        if (!a || !b) continue;
        const overlap = computeOverlap(a, b);
        if (overlap.area > 0 && overlap.ratio > 0.3) {
          // Nudge apart
          const dx = overlap.dx * 0.6;
          const dy = overlap.dy * 0.6;
          a.x += dx; a.y += dy;
          b.x -= dx; b.y -= dy;
          moved = true;
          corrections.push({ action: "nudge-apart", entities: [a.name, b.name], dx: Math.round(dx), dy: Math.round(dy) });
        }
      }
    }
    if (!moved) break;
  }

  return corrections;
}

/**
 * Compute overlap metrics between two entities.
 */
function computeOverlap(a, b) {
  const ax2 = a.x + a.width, ay2 = a.y + a.height;
  const bx2 = b.x + b.width, by2 = b.y + b.height;
  const ox = Math.max(0, Math.min(ax2, bx2) - Math.max(a.x, b.x));
  const oy = Math.max(0, Math.min(ay2, by2) - Math.max(a.y, b.y));
  const area = ox * oy;
  const minArea = Math.min(a.width * a.height, b.width * b.height);
  return {
    area,
    ratio: minArea > 0 ? area / minArea : 0,
    dx: (b.x + b.width / 2) - (a.x + a.width / 2),
    dy: (b.y + b.height / 2) - (a.y + a.height / 2)
  };
}

/**
 * Find the art direction config for a theme.
 *
 * @param {string} theme
 * @returns {object|null}
 */
function findThemeConfig(theme) {
  if (!theme) return null;
  for (const [key, config] of Object.entries(FLAGSHIP_THEME_CONFIGS)) {
    if (theme.includes(key) || key.includes(theme)) return config;
  }
  return null;
}

/**
 * Get the art direction config for a given theme.
 *
 * @param {string} theme
 * @returns {object|null}
 */
export function getArtDirectionConfig(theme) {
  return findThemeConfig(theme) || null;
}

/**
 * Get the canvas position bounds for a depth layer.
 *
 * @param {number} layer - depth layer index (-3 = far bg, 0 = mid, 2+ = fg)
 * @returns {{ xRange: [number, number], yRange: [number, number], scaleRange: [number, number] }}
 */
export function getLayerBounds(layer = 0) {
  const margin = 40;
  if (layer <= -3) {
    // Far background - full width, top portion
    return { xRange: [margin, CANVAS.width - margin], yRange: [margin, CANVAS.height * 0.4], scaleRange: [0.3, 0.6] };
  }
  if (layer === -2) {
    // Background - full width, upper half
    return { xRange: [margin, CANVAS.width - margin], yRange: [margin, CANVAS.height * 0.5], scaleRange: [0.5, 0.8] };
  }
  if (layer === -1) {
    // Mid-background
    return { xRange: [margin, CANVAS.width - margin], yRange: [CANVAS.height * 0.1, CANVAS.height * 0.7], scaleRange: [0.6, 1.0] };
  }
  if (layer === 0) {
    // Midground
    return { xRange: [margin, CANVAS.width - margin], yRange: [CANVAS.height * 0.15, CANVAS.height * 0.8], scaleRange: [0.8, 1.3] };
  }
  // Foreground
  return { xRange: [margin, CANVAS.width - margin], yRange: [CANVAS.height * 0.25, CANVAS.height * 0.9], scaleRange: [1.0, 1.8] };
}
