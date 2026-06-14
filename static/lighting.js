/**
 * Lighting Module — Listen Paint Art Engine v4
 *
 * Determines light source position, color temperature, shadow direction,
 * and ambient occlusion based on the render profile's lighting setting.
 */

import { LIGHTING_OPTIONS } from "./art_schema.js";

/**
 * Lighting presets for each lighting option.
 * Each defines light source position (relative to canvas),
 * color temperature (warm/cool), ambient level, and shadow properties.
 */
const LIGHTING_PRESETS = Object.freeze({
  "soft-day": {
    label: "柔和日光",
    sourceX: 0.65, sourceY: 0.18,        // upper-right sun
    colorTemp: "warm",                    // warm daylight
    baseColor: "#fff8e9",                 // warm cream light
    shadowColor: "#303946",               // deep blue-grey shadow
    ambientLevel: 0.45,                   // moderate ambient fill
    shadowDirection: [ -0.35, 0.55 ],     // shadow falls down-left
    shadowLength: 0.35,                    // moderate shadow length
    highlightIntensity: 0.30
  },
  "golden-hour": {
    label: "黄金时刻",
    sourceX: 0.25, sourceY: 0.45,         // lower-left warm sun
    colorTemp: "warm",
    baseColor: "#f5d0a9",                 // golden amber light
    shadowColor: "#2a3040",               // deep blue shadow
    ambientLevel: 0.30,                   // lower ambient (more contrast)
    shadowDirection: [ 0.55, 0.30 ],      // shadow falls right-up
    shadowLength: 0.65,                    // long shadows
    highlightIntensity: 0.45
  },
  "night": {
    label: "夜景",
    sourceX: 0.50, sourceY: 0.20,         // moon overhead
    colorTemp: "cool",
    baseColor: "#c8d8e8",                 // cool moonlight
    shadowColor: "#101118",               // very dark shadow
    ambientLevel: 0.20,                   // low ambient (high contrast)
    shadowDirection: [ 0.05, 0.60 ],      // shadow falls down
    shadowLength: 0.45,
    highlightIntensity: 0.15
  },
  "rain": {
    label: "雨天",
    sourceX: 0.50, sourceY: 0.10,         // diffuse overhead
    colorTemp: "cool",
    baseColor: "#d8dce4",                 // cool grey light
    shadowColor: "#3a4050",               // muted shadow
    ambientLevel: 0.55,                   // high ambient (flat lighting)
    shadowDirection: [ 0.0, 0.45 ],       // shadow falls straight down
    shadowLength: 0.25,                    // short shadows
    highlightIntensity: 0.12
  }
});

/**
 * Get the lighting profile for a given lighting option.
 *
 * @param {string} lighting - one of LIGHTING_OPTIONS
 * @returns {object} lighting profile
 */
export function getLightingProfile(lighting = "soft-day") {
  return LIGHTING_PRESETS[lighting] || LIGHTING_PRESETS["soft-day"];
}

/**
 * Compute the light angle (in radians) from the source position
 * relative to an entity's center.
 *
 * @param {object} entity - entity with x, y, width, height
 * @param {object} lighting - lighting profile
 * @returns {number} angle in radians
 */
export function computeLightAngle(entity, lighting) {
  const entityCx = entity.x + entity.width / 2;
  const entityCy = entity.y + entity.height / 2;
  const lightX = lighting.sourceX * 1000;  // canvas width
  const lightY = lighting.sourceY * 700;   // canvas height
  return Math.atan2(lightY - entityCy, lightX - entityCx);
}

/**
 * Compute the shadow offset for an entity based on lighting.
 *
 * @param {object} entity
 * @param {object} lighting
 * @returns {{ dx: number, dy: number }}
 */
export function computeShadowOffset(entity, lighting) {
  const baseScale = Math.min(entity.width, entity.height) * 0.05;
  return {
    dx: lighting.shadowDirection[0] * baseScale * lighting.shadowLength * 10,
    dy: lighting.shadowDirection[1] * baseScale * lighting.shadowLength * 10
  };
}

/**
 * Get highlight and shadow colors for an entity based on its base color
 * and the current lighting.
 *
 * @param {string} baseColor - entity base hex color
 * @param {object} lighting
 * @returns {{ highlight: string, shadow: string, ambient: string }}
 */
export function getLightingColors(baseColor, lighting) {
  // Simple luminance-based adjustment
  const hex = baseColor.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  const blend = (c, light, factor) =>
    Math.max(0, Math.min(255, Math.round(c + (light - c) * factor)));

  const lightR = parseInt(lighting.baseColor.substring(1, 3), 16);
  const lightG = parseInt(lighting.baseColor.substring(3, 5), 16);
  const lightB = parseInt(lighting.baseColor.substring(5, 7), 16);

  const shadowR = parseInt(lighting.shadowColor.substring(1, 3), 16);
  const shadowG = parseInt(lighting.shadowColor.substring(3, 5), 16);
  const shadowB = parseInt(lighting.shadowColor.substring(5, 7), 16);

  const highlight = `#${[blend(r, lightR, 0.3), blend(g, lightG, 0.3), blend(b, lightB, 0.3)]
    .map(v => v.toString(16).padStart(2, "0")).join("")}`;
  const shadow = `#${[blend(r, shadowR, 0.5), blend(g, shadowG, 0.5), blend(b, shadowB, 0.5)]
    .map(v => v.toString(16).padStart(2, "0")).join("")}`;
  const ambient = `#${[blend(r, lightR, lighting.ambientLevel * 0.4), blend(g, lightG, lighting.ambientLevel * 0.4), blend(b, lightB, lighting.ambientLevel * 0.4)]
    .map(v => v.toString(16).padStart(2, "0")).join("")}`;

  return { highlight, shadow, ambient };
}

/**
 * Determine if an entity should receive full lighting treatment
 * based on its layer depth (foreground gets more detail).
 *
 * @param {number} layer - entity layer index
 * @returns {boolean}
 */
export function needsFullLighting(layer = 0) {
  return layer >= 0; // foreground and midground
}

/**
 * Get sky/environment color for the current lighting.
 *
 * @param {object} lighting
 * @returns {string} hex color
 */
export function getEnvironmentColor(lighting) {
  const envColors = {
    "soft-day": "#e8f0f8",
    "golden-hour": "#f0d8b8",
    "night": "#101828",
    "rain": "#b0b8c4"
  };
  return envColors[lighting.label] || "#e8f0f8";
}
