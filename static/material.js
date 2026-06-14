/**
 * Material Module — Listen Paint Art Engine v4
 *
 * Defines material properties for the four material types (paper, smooth,
 * carved, ink-wash) and provides SVG filter/pattern generation for each.
 */

import { MATERIAL_OPTIONS } from "./art_schema.js";

const NS = "http://www.w3.org/2000/svg";

/**
 * Material presets.
 */
const MATERIAL_PRESETS = Object.freeze({
  paper: {
    label: "纸纹",
    roughness: 0.35,
    absorbency: 0.60,
    grainScale: 1.0,
    edgeStyle: "soft-rounded",
    lineScatter: 0.015,
    filterType: "noise-paper",
    overlayOpacity: 0.08,
    strokeTexture: "micro-jitter"
  },
  smooth: {
    label: "光滑",
    roughness: 0.05,
    absorbency: 0.15,
    grainScale: 0.3,
    edgeStyle: "crisp",
    lineScatter: 0.003,
    filterType: "none",
    overlayOpacity: 0.02,
    strokeTexture: "clean"
  },
  carved: {
    label: "木刻",
    roughness: 0.80,
    absorbency: 0.20,
    grainScale: 0.7,
    edgeStyle: "angular-chiseled",
    lineScatter: 0.025,
    filterType: "noise-wood",
    overlayOpacity: 0.12,
    strokeTexture: "directional-groove"
  },
  "ink-wash": {
    label: "水墨",
    roughness: 0.50,
    absorbency: 0.85,
    grainScale: 0.5,
    edgeStyle: "bleeding-soft",
    lineScatter: 0.020,
    filterType: "noise-ink",
    overlayOpacity: 0.15,
    strokeTexture: "feathered-wash"
  }
});

/**
 * Get the material profile.
 *
 * @param {string} material - one of MATERIAL_OPTIONS
 * @returns {object}
 */
export function getMaterialProfile(material = "paper") {
  return MATERIAL_PRESETS[material] || MATERIAL_PRESETS.paper;
}

/**
 * Create an SVG filter element for the given material.
 *
 * @param {Document} doc - SVG document
 * @param {string} material - material type
 * @param {string} filterId - unique filter ID
 * @returns {SVGFilterElement}
 */
export function createMaterialFilter(doc, material = "paper", filterId = "material-filter") {
  const profile = getMaterialProfile(material);
  const filter = doc.createElementNS(NS, "filter");
  filter.setAttribute("id", filterId);
  filter.setAttribute("x", "-10%");
  filter.setAttribute("y", "-10%");
  filter.setAttribute("width", "120%");
  filter.setAttribute("height", "120%");

  if (profile.filterType === "none") return filter;

  // Base noise
  const turbulence = doc.createElementNS(NS, "feTurbulence");
  turbulence.setAttribute("type", "fractalNoise");
  turbulence.setAttribute("baseFrequency", String(profile.grainScale * 0.04));
  turbulence.setAttribute("numOctaves", "3");
  turbulence.setAttribute("seed", "42");
  turbulence.setAttribute("result", "noise");
  filter.appendChild(turbulence);

  // Color matrix for opacity
  const colorMatrix = doc.createElementNS(NS, "feColorMatrix");
  colorMatrix.setAttribute("type", "matrix");
  colorMatrix.setAttribute("values", "0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.15 0");
  colorMatrix.setAttribute("in", "noise");
  colorMatrix.setAttribute("result", "noiseAlpha");
  filter.appendChild(colorMatrix);

  // Blend with source graphic
  const blend = doc.createElementNS(NS, "feBlend");
  blend.setAttribute("in", "SourceGraphic");
  blend.setAttribute("in2", "noiseAlpha");
  blend.setAttribute("mode", "multiply");
  filter.appendChild(blend);

  return filter;
}

/**
 * Generate CSS backdrop-filter style for material texture overlay.
 *
 * @param {string} material
 * @returns {string} CSS filter value
 */
export function materialBackdropStyle(material = "paper") {
  const profile = getMaterialProfile(material);
  if (profile.filterType === "none") return "";
  const grain = profile.grainScale * 0.5;
  return `contrast(${1 + grain * 0.1}) brightness(${1 + profile.overlayOpacity})`;
}

/**
 * Get the line tier adjustment factor for a material.
 * Rougher materials get more line scatter.
 *
 * @param {string} material
 * @param {string} lineTier - outline/structure/texture/atmosphere
 * @returns {number} adjustment factor
 */
export function materialLineAdjustment(material, lineTier) {
  const profile = getMaterialProfile(material);
  const tierFactors = {
    outline: 1.0,
    structure: 1.0 + profile.lineScatter * 0.5,
    texture: 1.0 + profile.lineScatter,
    atmosphere: 1.0 + profile.lineScatter * 1.5
  };
  return tierFactors[lineTier] || 1.0;
}

/**
 * Determine if the material supports texture overlays.
 *
 * @param {string} material
 * @returns {boolean}
 */
export function materialSupportsTexture(material) {
  return material !== "smooth";
}
