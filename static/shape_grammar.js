/**
 * Shape Grammar — Listen Paint Art Engine v4
 *
 * Categorizes entity templates into four shape grammar families,
 * each with its own structural rules for the unified rendering pipeline.
 *
 * Categories:
 *   - FIGURE:  人物动物 (person, cat, dog, bird)
 *   - STRUCTURE: 建筑器物 (house, roof, bridge, boat, bench, bicycle, fence, buildings, streetlamp, umbrella, street)
 *   - NATURE:  植物自然 (tree, mountain, flowers, grass, river, puddle)
 *   - ATMOSPHERE: 天气光效 (rain, cloud, sun, moon, stars)
 */

export const GRAMMAR_CATEGORIES = Object.freeze({
  // 人物动物 — characters and animals
  figure: {
    label: "人物动物",
    templates: ["person", "cat", "dog", "bird"],
    structureRules: {
      hasSkeleton: true,
      hasJoints: true,
      hasPosture: true,
      silhouetteStyle: "organic-curved",
      primaryTier: "outline",
      shadowType: "contact-ellipse"
    }
  },
  // 建筑器物 — buildings and objects
  structure: {
    label: "建筑器物",
    templates: ["house", "roof", "bridge", "boat", "bench", "bicycle", "fence", "buildings", "streetlamp", "umbrella", "street"],
    structureRules: {
      hasSkeleton: false,
      hasJoints: true,
      hasPerspective: true,
      silhouetteStyle: "angular-connected",
      primaryTier: "structure",
      shadowType: "directional-cast"
    }
  },
  // 植物自然 — plants and nature
  nature: {
    label: "植物自然",
    templates: ["tree", "mountain", "flowers", "grass", "river", "puddle"],
    structureRules: {
      hasSkeleton: false,
      hasJoints: false,
      hasGrowth: true,
      silhouetteStyle: "irregular-organic",
      primaryTier: "texture",
      shadowType: "ambient-occlusion"
    }
  },
  // 天气光效 — weather and light effects
  atmosphere: {
    label: "天气光效",
    templates: ["rain", "cloud", "sun", "moon", "stars"],
    structureRules: {
      hasSkeleton: false,
      hasJoints: false,
      hasDirection: true,
      silhouetteStyle: "diffuse-luminous",
      primaryTier: "atmosphere",
      shadowType: "none"
    }
  }
});

/**
 * Get the grammar category for an entity template.
 *
 * @param {string} templateId
 * @returns {object|null} grammar category or null
 */
export function getGrammarCategory(templateId) {
  for (const [key, category] of Object.entries(GRAMMAR_CATEGORIES)) {
    if (category.templates.includes(templateId)) {
      return { key, ...category };
    }
  }
  return null;
}

/**
 * Get the grammar category key for an entity template.
 *
 * @param {string} templateId
 * @returns {string|null} "figure", "structure", "nature", or "atmosphere"
 */
export function getGrammarKey(templateId) {
  for (const [key, category] of Object.entries(GRAMMAR_CATEGORIES)) {
    if (category.templates.includes(templateId)) return key;
  }
  return null;
}

/**
 * Get the structure rules for an entity template.
 *
 * @param {string} templateId
 * @returns {object} structure rules
 */
export function getStructureRules(templateId) {
  const cat = getGrammarCategory(templateId);
  return cat?.structureRules || GRAMMAR_CATEGORIES.structure.structureRules;
}

/**
 * Get all template IDs in a given grammar category.
 *
 * @param {string} key
 * @returns {Array<string>}
 */
export function getTemplatesInCategory(key) {
  return GRAMMAR_CATEGORIES[key]?.templates || [];
}

/**
 * Get all template IDs across all categories (sorted).
 *
 * @returns {Array<string>}
 */
export function getAllTemplateIds() {
  const ids = [];
  for (const cat of Object.values(GRAMMAR_CATEGORIES)) {
    ids.push(...cat.templates);
  }
  return [...new Set(ids)].sort();
}
