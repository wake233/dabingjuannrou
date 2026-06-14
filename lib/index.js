/**
 * Listen Paint Art Engine v4 — Adapter Index
 *
 * Unified entry point for the art rendering engine.
 * All third-party libraries are wrapped behind deterministic,
 * coordinate-safe interfaces driven by engineering seeds.
 *
 * Modules:
 *   - geometry: Organic curves, contours, Bezier operations (d3-shape, bezier-js)
 *   - brush:    Natural pen strokes with pressure and taper (perfect-freehand)
 *   - color:    Perceptual color palette and adjustments (culori)
 *   - noise:    Deterministic textures and perturbation (simplex-noise)
 */

// Re-export all adapter functions with namespacing
export {
  // Geometry
  clampCoord,
  clampPoint,
  clampPoints,
  organicCurve,
  organicContour,
  bezierSample,
  bezierSamples,
  bezierTangent,
  bezierOffset,
  bezierIntersections,
  smoothPoints
} from "./geometry.js";

export {
  // Brush
  freehandStroke,
  freehandHatch,
  taperedBrushStroke
} from "./brush.js";

export {
  // Color
  generatePalette,
  adjustLightness,
  mixColors,
  colorTemperature,
  temperaturePair,
  isValidHex,
  toHex
} from "./color.js";

export {
  // Noise
  getNoise2D,
  getNoise3D,
  paperGrain,
  inkTexture,
  perturb2D,
  perturbPath,
  woodGrain,
  cloudNoise,
  terrainNoise,
  clearNoiseCache
} from "./noise.js";

/**
 * Art engine version identifier.
 */
export const ART_ENGINE_VERSION = "4.0.0";

/**
 * Art engine build timestamp (set at build time).
 */
export const ART_ENGINE_BUILD = "__BUILD_TIMESTAMP__";
