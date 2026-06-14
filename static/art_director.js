/**
 * Deterministic local art director.
 *
 * Corrections are applied to entity geometry, then the corrected scene is
 * evaluated again. A scene is accepted only when the post-correction result
 * clears the hard composition rules.
 */

import { CANVAS } from "./model.js";
import { evaluateComposition } from "./composition.js";
import { getGrammarCategory } from "./shape_grammar.js";

export const ART_DIRECTOR_RULES = Object.freeze({
  minFocusAreaRatio: 0.06,
  maxFocusAreaRatio: 0.55,
  maxAverageOverlap: 0.48,
  minDepthLayers: 3,
  minOccupiedAreaRatio: 0.18,
  maxOccupiedAreaRatio: 0.88,
  maxStackingDensity: 5
});

const config = (id, aliases, requiredRoles, narrativeElements) => ({
  id,
  aliases,
  requiredRoles,
  compositionRanges: { focusX: [0.28, 0.72], focusY: [0.24, 0.72], focusScale: [0.06, 0.42] },
  colorRelations: [["warm", "cool"], ["focus", "environment"]],
  narrativeElements,
  depthPriority: ["foreground", "midground", "background"]
});

export const FLAGSHIP_THEME_CONFIGS = Object.freeze({
  "rain-woman": config("rain-woman", ["雨中打伞的女人", "雨中人物", "雨中归人"], ["person", "rain"], ["person", "umbrella", "rain", "puddle"]),
  "moon-cat": config("moon-cat", ["月夜屋顶的猫", "月夜"], ["cat", "moon"], ["cat", "roof", "moon", "stars"]),
  "spring-river": config("spring-river", ["春日河畔"], ["river", "tree"], ["river", "bridge", "tree", "flowers"]),
  "quiet-street": config("quiet-street", ["安静街道"], ["street", "house"], ["street", "house", "tree", "streetlamp"]),
  "child-tree": config("child-tree", ["树下读书的孩子"], ["person", "tree"], ["person", "tree", "grass", "book"]),
  "boat-bridge": config("boat-bridge", ["桥下小船"], ["boat", "bridge"], ["boat", "bridge", "river"]),
  "mountain-traveler": config("mountain-traveler", ["山路旅人"], ["person", "mountain"], ["person", "mountain", "tree", "grass"]),
  "wind-birds": config("wind-birds", ["风中的飞鸟"], ["bird"], ["bird", "cloud", "wind"]),
  "lamp-rain": config("lamp-rain", ["雨夜路灯"], ["streetlamp", "rain"], ["streetlamp", "rain", "puddle"]),
  "garden-dog": config("garden-dog", ["花园里的狗"], ["dog", "flowers"], ["dog", "flowers", "grass", "tree"]),
  "river-bicycle": config("river-bicycle", ["河畔自行车"], ["bicycle", "river"], ["bicycle", "river", "tree", "grass"]),
  "snow-house": config("snow-house", ["雪地房屋", "雪景小屋"], ["house"], ["house", "tree", "mountain", "snow"])
});

function focusEntity(entities) {
  return entities.find(entity => entity.role === "主角" || entity.role === "focus")
    || entities.find(entity => getGrammarCategory(entity.templateId)?.key === "figure")
    || entities.find(entity => (entity.layer || 0) >= 0)
    || entities[0];
}

function ensureFocusScale(entities, corrections) {
  const focus = focusEntity(entities);
  if (!focus) return;
  const canvasArea = CANVAS.width * CANVAS.height;
  const areaRatio = (focus.width * focus.height) / canvasArea;
  if (areaRatio >= ART_DIRECTOR_RULES.minFocusAreaRatio) return;
  const factor = Math.min(12, Math.sqrt((ART_DIRECTOR_RULES.minFocusAreaRatio * 1.08) / Math.max(areaRatio, 0.0001)));
  const cx = focus.x + focus.width / 2;
  const cy = focus.y + focus.height / 2;
  focus.width = Math.round(focus.width * factor);
  focus.height = Math.round(focus.height * factor);
  focus.x = Math.round(cx - focus.width / 2);
  focus.y = Math.round(cy - focus.height / 2);
  corrections.push({ action: "scale-focus", entity: focus.name || focus.id, factor: Number(factor.toFixed(2)) });
}

function ensureDepthLayers(entities, corrections) {
  if (entities.length < 3) return;
  const layers = new Set(entities.map(entity => entity.layer || 0));
  if (layers.size >= ART_DIRECTOR_RULES.minDepthLayers) return;
  const ordered = [...entities].sort((a, b) => {
    const categoryOrder = { atmosphere: -3, nature: -1, structure: 0, figure: 1 };
    return (categoryOrder[getGrammarCategory(a.templateId)?.key] || 0)
      - (categoryOrder[getGrammarCategory(b.templateId)?.key] || 0);
  });
  ordered.forEach((entity, index) => {
    entity.layer = index < Math.ceil(ordered.length / 3) ? -2
      : index < Math.ceil(ordered.length * 2 / 3) ? 0 : 2;
  });
  corrections.push({ action: "assign-foreground-midground-background" });
}

function ensureOccupiedArea(entities, corrections) {
  const visible = entities.filter(entity => getGrammarCategory(entity.templateId)?.key !== "atmosphere");
  if (visible.length < 2) return;
  const bounds = sceneBounds(visible);
  const ratio = (bounds.width * bounds.height) / (CANVAS.width * CANVAS.height);
  if (ratio >= ART_DIRECTOR_RULES.minOccupiedAreaRatio) return;
  const factor = Math.min(1.8, Math.sqrt(ART_DIRECTOR_RULES.minOccupiedAreaRatio / Math.max(ratio, 0.001)));
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  for (const entity of visible) {
    const ecx = entity.x + entity.width / 2;
    const ecy = entity.y + entity.height / 2;
    entity.width = Math.round(entity.width * factor);
    entity.height = Math.round(entity.height * factor);
    entity.x = Math.round(CANVAS.width / 2 + (ecx - cx) * factor - entity.width / 2);
    entity.y = Math.round(CANVAS.height * 0.55 + (ecy - cy) * factor - entity.height / 2);
  }
  corrections.push({ action: "fill-excessive-negative-space", factor: Number(factor.toFixed(2)) });
}

function resolveSevereOverlap(entities, corrections) {
  for (let iteration = 0; iteration < 4; iteration++) {
    let moved = false;
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const a = entities[i];
        const b = entities[j];
        if ((a.layer || 0) !== (b.layer || 0)) continue;
        const overlap = overlapRatio(a, b);
        if (overlap <= ART_DIRECTOR_RULES.maxAverageOverlap) continue;
        const direction = (a.x + a.width / 2) <= (b.x + b.width / 2) ? -1 : 1;
        const shift = Math.max(12, Math.min(a.width, b.width) * 0.18);
        a.x += direction * shift;
        b.x -= direction * shift;
        moved = true;
        corrections.push({ action: "separate-occlusion", entities: [a.name, b.name], shift: Math.round(shift) });
      }
    }
    if (!moved) break;
  }
}

function clampToCanvas(entities) {
  for (const entity of entities) {
    entity.x = Math.round(Math.max(0, Math.min(CANVAS.width - entity.width, entity.x)));
    entity.y = Math.round(Math.max(0, Math.min(CANVAS.height - entity.height, entity.y)));
  }
}

function sceneBounds(entities) {
  const x1 = Math.min(...entities.map(entity => entity.x));
  const y1 = Math.min(...entities.map(entity => entity.y));
  const x2 = Math.max(...entities.map(entity => entity.x + entity.width));
  const y2 = Math.max(...entities.map(entity => entity.y + entity.height));
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

function overlapRatio(a, b) {
  const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return (width * height) / Math.max(1, Math.min(a.width * a.height, b.width * b.height));
}

function hardFailure(evaluation, entityCount) {
  const scores = evaluation.scores;
  if ((scores.focusScale || 0) < ART_DIRECTOR_RULES.minFocusAreaRatio) return "主体过小";
  if ((scores.focusScale || 0) > ART_DIRECTOR_RULES.maxFocusAreaRatio) return "主体过大";
  if (entityCount >= 3 && (scores.depthLayers || 0) < ART_DIRECTOR_RULES.minDepthLayers) return "缺少前中后景";
  if ((scores.avgOverlap || 0) > ART_DIRECTOR_RULES.maxAverageOverlap) return "严重遮挡";
  if (entityCount >= 2 && (scores.occupiedArea || 0) < ART_DIRECTOR_RULES.minOccupiedAreaRatio) return "负空间过多";
  if ((scores.occupiedArea || 0) > ART_DIRECTOR_RULES.maxOccupiedAreaRatio) return "负空间不足";
  return null;
}

export function runArtDirector(entities, scene = {}, renderProfile = {}, options = {}) {
  const entityArr = entities.filter(entity => entity.kind === "entity");
  const corrections = [];
  if (!entityArr.length) return { accepted: true, entities, corrections, rejectionReason: null, evaluation: evaluateComposition([], scene, renderProfile) };

  if (options.autoCorrect !== false) {
    ensureFocusScale(entityArr, corrections);
    ensureDepthLayers(entityArr, corrections);
    ensureOccupiedArea(entityArr, corrections);
    resolveSevereOverlap(entityArr, corrections);
    clampToCanvas(entityArr);
  }

  const evaluation = evaluateComposition(entityArr, scene, renderProfile);
  const rejectionReason = hardFailure(evaluation, entityArr.length);
  return { accepted: !rejectionReason, entities, corrections, rejectionReason, evaluation };
}

export function getArtDirectionConfig(theme) {
  if (!theme) return null;
  const normalized = String(theme).toLowerCase();
  return Object.values(FLAGSHIP_THEME_CONFIGS).find(item =>
    item.id === normalized || item.aliases.some(alias => normalized.includes(alias.toLowerCase()))
  ) || null;
}

export function getLayerBounds(layer = 0) {
  const margin = 40;
  if (layer <= -2) return { xRange: [margin, CANVAS.width - margin], yRange: [margin, CANVAS.height * 0.48], scaleRange: [0.35, 0.75] };
  if (layer >= 2) return { xRange: [margin, CANVAS.width - margin], yRange: [CANVAS.height * 0.35, CANVAS.height - margin], scaleRange: [1, 1.8] };
  return { xRange: [margin, CANVAS.width - margin], yRange: [CANVAS.height * 0.15, CANVAS.height * 0.82], scaleRange: [0.7, 1.25] };
}
