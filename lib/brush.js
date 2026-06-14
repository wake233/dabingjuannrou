/**
 * Brush Adapter — Listen Paint Art Engine v4
 *
 * Wraps perfect-freehand behind a deterministic, seed-driven interface.
 * Generates natural pen strokes with pressure simulation and taper.
 */

import { getStroke, getStrokePoints } from "perfect-freehand";

const COORD_BOUND = 100000;
const MAX_STROKE_POINTS = 200;
const MAX_PATH_LENGTH = 12000;

/**
 * Clamp a coordinate.
 */
function clampC(v) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(-COORD_BOUND, Math.min(COORD_BOUND, v));
}

/**
 * Simple PRNG: mulberry32.
 */
function mulberry32(seed) {
  let state = Math.abs(Math.floor(seed * 2147483647)) | 0;
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Hash a string to [0,1).
 */
function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return (Math.abs(h) / 2147483648) % 1;
}

// Default stroke options (matching storybook style)
const DEFAULT_STROKE_OPTIONS = {
  size: 3.5,
  thinning: 0.55,
  smoothing: 0.5,
  streamline: 0.5,
  taperStart: 0.15,
  taperEnd: 0.15,
  capStart: true,
  capEnd: true,
  simulatePressure: true
};

/**
 * Generate a natural, variable-width pen stroke SVG path data string
 * from a centerline point array.
 *
 * @param {Array<[number, number]>} points - centerline points
 * @param {object} [options]
 * @param {number} [options.size=3.5] - base stroke width
 * @param {number} [options.thinning=0.55] - pressure variability
 * @param {number} [options.smoothing=0.5] - point smoothing
 * @param {number} [options.streamline=0.5] - motion streamline
 * @param {number} [options.taperStart=0.15] - start taper amount
 * @param {number} [options.taperEnd=0.15] - end taper amount
 * @param {number|string} [options.seed] - deterministic seed for pressure variation
 * @param {boolean} [options.closed=false] - whether stroke forms a closed shape
 * @returns {string} SVG path data string
 */
export function freehandStroke(points, options = {}) {
  if (!Array.isArray(points) || points.length < 2) return "";

  const clamped = points.map(([x, y]) => [
    clampC(x || 0),
    clampC(y || 0)
  ]);

  const seed = typeof options.seed === "number"
    ? options.seed
    : hashString(String(options.seed ?? "default"));

  const rng = mulberry32(seed);

  const strokeOpts = {
    ...DEFAULT_STROKE_OPTIONS,
    ...options,
    simulatePressure: true
  };

  // Inject deterministic "pressure" at each point
  const withPressure = clamped.map(([x, y], i) => {
    const t = i / Math.max(1, clamped.length - 1);
    // Pressure curve: higher in middle, lower at ends
    const basePressure = 0.4 + 0.6 * (1 - Math.abs(2 * t - 1));
    // Add deterministic jitter
    const jitter = (rng() - 0.5) * 0.3;
    return [x, y, Math.max(0.1, Math.min(1, basePressure + jitter))];
  });

  try {
    const stroke = getStroke(withPressure, strokeOpts);
    if (!stroke || stroke.length < 3) return "";

    // Convert outline points to SVG path data
    let d = "";
    let nodeCount = 0;

    for (let i = 0; i < stroke.length; i++) {
      if (nodeCount >= MAX_PATH_LENGTH) break;
      const [x, y] = stroke[i];
      const cmd = i === 0 ? "M" : "L";
      d += `${cmd}${clampC(x).toFixed(2)} ${clampC(y).toFixed(2)}`;
      nodeCount++;
    }

    if (options.closed && d) d += " Z";
    return d;
  } catch (_) {
    return "";
  }
}

/**
 * Generate hatching lines from a freehand stroke style.
 * Creates multiple parallel pen strokes.
 *
 * @param {Array<[number, number]>} points - centerline reference points
 * @param {number} count - number of hatch lines
 * @param {number} spacing - spacing between lines
 * @param {number} angle - angle in degrees
 * @param {number|string} seed - PRNG seed
 * @returns {Array<string>} array of SVG path data strings
 */
export function freehandHatch(points, count = 8, spacing = 8, angle = 45, seed = "hatch") {
  if (!Array.isArray(points) || points.length < 2) return [];

  const numSeed = typeof seed === "number" ? seed : hashString(String(seed));
  const rng = mulberry32(numSeed + 1);
  const rad = angle * Math.PI / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const minX = Math.min(...points.map(p => p[0]));
  const maxX = Math.max(...points.map(p => p[0]));
  const minY = Math.min(...points.map(p => p[1]));
  const maxY = Math.max(...points.map(p => p[1]));
  const diagonal = Math.sqrt((maxX - minX) ** 2 + (maxY - minY) ** 2);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  const lines = [];
  for (let i = 0; i < count; i++) {
    const offset = (i - count / 2) * spacing + (rng() - 0.5) * spacing * 0.5;
    const p1x = cx + cos * (-diagonal) + (-sin) * offset;
    const p1y = cy + sin * (-diagonal) + cos * offset;
    const p2x = cx + cos * diagonal + (-sin) * offset;
    const p2y = cy + sin * diagonal + cos * offset;

    const hatchSeed = numSeed + i * 100;
    const d = freehandStroke(
      [[p1x, p1y], [p2x, p2y]],
      { size: 1.2, thinning: 0.4, smoothing: 0.3, taperStart: 0.1, taperEnd: 0.1, seed: hatchSeed }
    );
    if (d) lines.push(d);
  }

  return lines;
}

/**
 * Create an organic brush outline path with variable width
 * that perfectly tapers at both ends. Uses perfect-freehand
 * with high taper settings.
 *
 * @param {Array<[number, number]>} points
 * @param {object} [options]
 * @returns {string} SVG path data string
 */
export function taperedBrushStroke(points, options = {}) {
  return freehandStroke(points, {
    ...options,
    taperStart: options.taperStart ?? 0.25,
    taperEnd: options.taperEnd ?? 0.25,
    thinning: options.thinning ?? 0.65
  });
}
