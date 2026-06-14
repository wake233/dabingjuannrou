/**
 * Art Engine Core — Listen Paint v4
 *
 * Unified rendering pipeline:
 *   语义骨架 → 有机轮廓 → 材质块面 → 结构线 → 光影 → 纹理细节 → 风格解释
 *
 * Storybook uses the full pipeline.
 * Woodcut and ink-wash reuse the semantic skeleton and organic contour,
 * then apply their own block, carve, ink-layer, and negative-space rules.
 */

import { getGrammarCategory } from "./shape_grammar.js";
import { getLightingProfile, getLightingColors, computeShadowOffset } from "./lighting.js";
import { getMaterialProfile } from "./material.js";
import { runArtDirector } from "./art_director.js";
import { evaluateComposition } from "./composition.js";
import { ART_STYLES } from "./art_schema.js";

/**
 * The unified rendering pipeline.
 *
 * @param {Array<object>} entities - entity objects
 * @param {object} scene - scene metadata
 * @param {object} renderProfile - render profile (seed, camera, lighting, material, detail)
 * @param {string} style - "storybook", "woodcut", or "ink"
 * @returns {object} { entities, metadata, directorResult }
 */
export function executeArtPipeline(entities, scene = {}, renderProfile = {}, style = "storybook") {
  const metadata = {
    pipelineVersion: "4.0.0",
    stage: "skeleton",
    style,
    timestamp: new Date().toISOString()
  };

  // Stage 1: Semantic Skeleton — validate and classify entities
  metadata.stage = "skeleton";
  const entityArr = entities.filter(e => e.kind === "entity");
  for (const entity of entityArr) {
    const cat = getGrammarCategory(entity.templateId);
    entity._grammarCategory = cat?.key || "structure";
    entity._structureRules = cat?.structureRules || {};
  }

  // Stage 2: Organic Contour — apply noise perturbation to outlines
  metadata.stage = "organic-contour";
  // This is handled by the template renderers which already use pen_stroke.js
  // The adapters (lib/brush.js, lib/geometry.js) provide enhanced capabilities

  // Stage 3: Run art director (composition correction)
  metadata.stage = "art-director";
  const directorResult = runArtDirector(entityArr, scene, renderProfile);
  if (!directorResult.accepted) {
    metadata.rejected = true;
    metadata.rejectionReason = directorResult.rejectionReason;
    return { entities, metadata, directorResult };
  }

  // Stage 4: Material block assignment
  metadata.stage = "material-blocks";
  if (style === "woodcut") {
    assignWoodcutBlocks(entityArr);
  } else if (style === "ink") {
    assignInkWashBlocks(entityArr);
  } else {
    assignStorybookBlocks(entityArr, renderProfile);
  }

  // Stage 5: Lighting assignment
  metadata.stage = "lighting";
  const lighting = getLightingProfile(renderProfile.lighting || "soft-day");
  for (const entity of entityArr) {
    entity._lightingColors = getLightingColors(
      entity.params?.color || getEntityDefaultColor(entity.templateId),
      lighting
    );
    entity._shadowOffset = computeShadowOffset(entity, lighting);
  }

  // Stage 6: Texture detail assignment
  metadata.stage = "texture-details";
  const material = getMaterialProfile(renderProfile.material || "paper");
  for (const entity of entityArr) {
    entity._materialRoughness = material.roughness;
    entity._materialEdgeStyle = material.edgeStyle;
  }

  // Stage 7: Composition evaluation (post-correction)
  metadata.stage = "evaluation";
  const compEval = evaluateComposition(entityArr, scene, renderProfile);
  metadata.compositionScores = compEval.scores;

  metadata.stage = "complete";
  return { entities, metadata, directorResult };
}

/**
 * Assign storybook-style material blocks.
 */
function assignStorybookBlocks(entities, renderProfile) {
  for (const entity of entities) {
    const cat = entity._grammarCategory;
    entity._blockType = cat === "figure" ? "layered-gradient"
      : cat === "structure" ? "solid-gradient"
      : cat === "nature" ? "variegated-gradient"
      : "diffuse-gradient";
    entity._blockOpacity = cat === "atmosphere" ? 0.4 : 1.0;
  }
}

/**
 * Assign woodcut-style blocks (high contrast, angular).
 */
function assignWoodcutBlocks(entities) {
  for (const entity of entities) {
    entity._blockType = "high-contrast";
    entity._blockCount = entity._grammarCategory === "figure" ? 4 : 3;
    entity._carveDirection = entity._grammarCategory === "nature" ? "diagonal" : "horizontal";
    entity._accentBlock = entity._grammarCategory === "figure" || entity._grammarCategory === "structure";
  }
}

/**
 * Assign ink-wash style blocks (gradated wash, sparse).
 */
function assignInkWashBlocks(entities) {
  for (const entity of entities) {
    entity._blockType = "ink-wash-gradient";
    entity._washLayers = entity._grammarCategory === "atmosphere" ? 1
      : entity._grammarCategory === "nature" ? 2 : 3;
    entity._flyingWhite = entity._grammarCategory === "nature";
    entity._speckCount = entity._grammarCategory === "figure" ? 6 : 3;
  }
}

/**
 * Get default color for an entity template.
 */
function getEntityDefaultColor(templateId) {
  const colors = {
    person: "#617f96", cat: "#d98f70", dog: "#d98f70", bird: "#88a9bd",
    umbrella: "#c97b84", streetlamp: "#596780", roof: "#c17a5e",
    house: "#d98f70", bridge: "#9e9e8e", boat: "#8b6914",
    bench: "#8b6914", bicycle: "#88a9bd", fence: "#8b6914",
    buildings: "#657f6a", rain: "#88a9bd", cloud: "#88a9bd",
    sun: "#e8c47c", moon: "#e8c47c", stars: "#e8c47c",
    tree: "#5a7a4a", mountain: "#657f6a", flowers: "#c97b84",
    river: "#5c8a9e", grass: "#5a7a4a", street: "#9e9e8e", puddle: "#a8d4e6"
  };
  return colors[templateId] || "#86a886";
}

/**
 * Quick check: does the scene pass basic art direction?
 *
 * @param {Array<object>} entities
 * @param {object} scene
 * @param {object} renderProfile
 * @returns {boolean}
 */
export function isSceneValid(entities, scene = {}, renderProfile = {}) {
  const result = executeArtPipeline(entities, scene, renderProfile);
  return result.metadata?.rejected !== true;
}

/**
 * Get the entity names organized by depth layer.
 *
 * @param {Array<object>} entities
 * @returns {object} { foreground: [], midground: [], background: [] }
 */
export function getDepthLayers(entities) {
  const layers = { foreground: [], midground: [], background: [] };
  for (const e of entities) {
    if (e.kind !== "entity") continue;
    const layer = e.layer || 0;
    if (layer >= 1) layers.foreground.push(e.name);
    else if (layer >= -1) layers.midground.push(e.name);
    else layers.background.push(e.name);
  }
  return layers;
}
