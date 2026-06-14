/**
 * Color Adapter — Listen Paint Art Engine v4
 *
 * Wraps culori behind a seed-driven interface for perceptual color space
 * palette generation, lightness adjustments, and warm/cool relationships.
 */

import * as culori from "culori";

const COORD_BOUND = 100000;

function clampC(v) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(-COORD_BOUND, Math.min(COORD_BOUND, v));
}

function mulberry32(seed) {
  let state = Math.abs(Math.floor(seed * 2147483647)) | 0;
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return (Math.abs(h) / 2147483648) % 1;
}

// Cache palettes by seed for stability
const paletteCache = new Map();
const MAX_CACHE_SIZE = 200;

/**
 * Generate a coordinated color palette using perceptual color spaces.
 *
 * @param {number|string} seed - deterministic seed
 * @param {object} [options]
 * @param {number} [options.count=5] - number of colors
 * @param {string} [options.mode="analogous"] - "analogous", "complementary", "triadic", "tetradic", "monochromatic"
 * @param {string} [options.baseColor] - optional base hex color (default auto-generated from seed)
 * @param {number} [options.minLightness=0.15] - minimum OKLCH lightness
 * @param {number} [options.maxLightness=0.90] - maximum OKLCH lightness
 * @param {number} [options.minChroma=0.02] - minimum OKLCH chroma
 * @param {number} [options.maxChroma=0.18] - maximum OKLCH chroma
 * @returns {Array<string>} array of hex colors
 */
export function generatePalette(seed, options = {}) {
  const cacheKey = JSON.stringify({ seed, ...options });
  if (paletteCache.has(cacheKey)) return paletteCache.get(cacheKey);

  const numSeed = typeof seed === "number" ? seed : hashString(String(seed));
  const rng = mulberry32(numSeed);

  const count = Math.max(1, Math.min(options.count ?? 5, 8));
  const mode = options.mode || "analogous";
  const minLight = options.minLightness ?? 0.15;
  const maxLight = options.maxLightness ?? 0.90;
  const minChroma = options.minChroma ?? 0.02;
  const maxChroma = options.maxChroma ?? 0.18;

  // Parse base color or generate from seed
  let baseHue;
  if (options.baseColor && typeof options.baseColor === "string") {
    const parsed = culori.parse(options.baseColor);
    if (parsed) {
      const oklch = culori.oklch(parsed);
      baseHue = oklch.h ?? rng() * 360;
    } else {
      baseHue = rng() * 360;
    }
  } else {
    baseHue = rng() * 360;
  }

  const colors = [];

  switch (mode) {
    case "complementary":
      colors.push(oklchColor(baseHue, maxLight, maxChroma));
      colors.push(oklchColor((baseHue + 180) % 360, minLight + (maxLight - minLight) * 0.5, minChroma + (maxChroma - minChroma) * 0.6));
      if (count > 2) {
        for (let i = 2; i < count; i++) {
          const t = i / (count - 1);
          colors.push(oklchColor(
            (baseHue + 30 + (rng() - 0.5) * 60) % 360,
            minLight + (maxLight - minLight) * (0.3 + t * 0.7),
            minChroma + (maxChroma - minChroma) * (0.2 + t * 0.5)
          ));
        }
      }
      break;

    case "triadic":
      for (let i = 0; i < count; i++) {
        const hue = (baseHue + i * 120) % 360;
        const lightness = minLight + (maxLight - minLight) * ((i + 1) / (count + 1));
        colors.push(oklchColor(hue, lightness, maxChroma));
      }
      break;

    case "tetradic":
      for (let i = 0; i < count; i++) {
        const hue = (baseHue + i * 90) % 360;
        colors.push(oklchColor(
          hue,
          minLight + (maxLight - minLight) * (0.3 + rng() * 0.7),
          minChroma + (maxChroma - minChroma) * (0.5 + rng() * 0.5)
        ));
      }
      break;

    case "monochromatic":
      for (let i = 0; i < count; i++) {
        const t = i / Math.max(1, count - 1);
        colors.push(oklchColor(
          baseHue + (rng() - 0.5) * 15,
          minLight + (maxLight - minLight) * t,
          minChroma + (maxChroma - minChroma) * (0.3 + rng() * 0.4)
        ));
      }
      break;

    case "analogous":
    default:
      const spread = 60;
      for (let i = 0; i < count; i++) {
        const t = i / Math.max(1, count - 1);
        const hue = (baseHue + (t - 0.5) * spread) % 360;
        colors.push(oklchColor(
          hue,
          minLight + (maxLight - minLight) * (0.2 + t * 0.8),
          minChroma + (maxChroma - minChroma) * (0.5 + rng() * 0.5)
        ));
      }
      break;
  }

  // Ensure valid hex
  const hexColors = colors.map(c => {
    try {
      return culori.formatHex(c) || "#4f8cff";
    } catch (_) {
      return "#4f8cff";
    }
  });

  // Cache management
  if (paletteCache.size >= MAX_CACHE_SIZE) {
    const firstKey = paletteCache.keys().next().value;
    paletteCache.delete(firstKey);
  }
  paletteCache.set(cacheKey, hexColors);

  return hexColors;
}

/**
 * Create an OKLCH color object.
 */
function oklchColor(h, l, c) {
  return culori.oklch({
    mode: "oklch",
    l: Math.max(0, Math.min(1, l)),
    c: Math.max(0, Math.min(0.4, c)),
    h: ((h % 360) + 360) % 360
  });
}

/**
 * Adjust a hex color's lightness in OKLCH perceptual space.
 *
 * @param {string} hex - hex color
 * @param {number} amount - positive = lighter, negative = darker, range roughly [-0.5, 0.5]
 * @returns {string} adjusted hex color
 */
export function adjustLightness(hex, amount) {
  try {
    const parsed = culori.parse(hex);
    if (!parsed) return hex;
    const oklch = culori.oklch(parsed);
    oklch.l = Math.max(0, Math.min(1, oklch.l + amount));
    return culori.formatHex(oklch) || hex;
  } catch (_) {
    // Fallback: simple RGB adjustment
    const v = Number.parseInt(hex.slice(1), 16);
    if (isNaN(v)) return hex;
    const adjust = Math.round(amount * 255);
    const r = Math.max(0, Math.min(255, ((v >> 16) & 255) + adjust));
    const g = Math.max(0, Math.min(255, ((v >> 8) & 255) + adjust));
    const b = Math.max(0, Math.min(255, (v & 255) + adjust));
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }
}

/**
 * Mix two colors in OKLCH perceptual space.
 *
 * @param {string} hex1
 * @param {string} hex2
 * @param {number} [t=0.5] - blend parameter
 * @returns {string} mixed hex color
 */
export function mixColors(hex1, hex2, t = 0.5) {
  try {
    const c1 = culori.parse(hex1);
    const c2 = culori.parse(hex2);
    if (!c1 || !c2) return hex1;
    const oklch1 = culori.oklch(c1);
    const oklch2 = culori.oklch(c2);
    const mixed = culori.oklch({
      mode: "oklch",
      l: oklch1.l + (oklch2.l - oklch1.l) * t,
      c: oklch1.c + (oklch2.c - oklch1.c) * t,
      h: oklch1.h + (oklch2.h - oklch1.h) * t
    });
    return culori.formatHex(mixed) || hex1;
  } catch (_) {
    return hex1;
  }
}

/**
 * Determine if a color is warm or cool.
 *
 * @param {string} hex
 * @returns {"warm"|"cool"|"neutral"}
 */
export function colorTemperature(hex) {
  try {
    const parsed = culori.parse(hex);
    if (!parsed) return "neutral";
    const oklch = culori.oklch(parsed);
    // In OKLCH, warm colors cluster around 30-120 (orange-red-yellow),
    // cool around 200-300 (blue-green-purple)
    const h = ((oklch.h ?? 0) % 360 + 360) % 360;
    if (h >= 20 && h <= 150) return "warm";
    if (h >= 190 && h <= 310) return "cool";
    return "neutral";
  } catch (_) {
    return "neutral";
  }
}

/**
 * Create a warm/cool contrast pair from a base color.
 *
 * @param {string} hex - base color
 * @param {number|string} seed
 * @returns {{ warm: string, cool: string }}
 */
export function temperaturePair(hex, seed = 0) {
  const numSeed = typeof seed === "number" ? seed : hashString(String(seed));
  const temp = colorTemperature(hex);
  try {
    const parsed = culori.parse(hex);
    if (!parsed) return { warm: hex, cool: hex };
    const oklch = culori.oklch(parsed);
    const warm = { ...oklch, h: temp === "warm" ? oklch.h : (oklch.h + 120 + numSeed * 40) % 360 };
    const cool = { ...oklch, h: temp === "cool" ? oklch.h : (oklch.h - 120 + numSeed * 40) % 360 };
    return {
      warm: culori.formatHex(culori.oklch(warm)) || hex,
      cool: culori.formatHex(culori.oklch(cool)) || hex
    };
  } catch (_) {
    return { warm: hex, cool: hex };
  }
}

/**
 * Validate a hex color string.
 *
 * @param {string} value
 * @returns {boolean}
 */
export function isValidHex(value) {
  if (typeof value !== "string") return false;
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value);
}

/**
 * Parse any CSS color to hex. Returns null on failure.
 *
 * @param {string} color
 * @returns {string|null}
 */
export function toHex(color) {
  try {
    const parsed = culori.parse(color);
    if (!parsed) return null;
    return culori.formatHex(parsed);
  } catch (_) {
    return null;
  }
}
