/**
 * Deterministic Pen Stroke Engine for Storybook Renderer
 *
 * Generates variable-width SVG paths from centerline samples,
 * simulating pen-and-ink strokes with controlled perturbation.
 * Supports four line tiers, seeded randomness, and coordinate safety.
 */
const NS = "http://www.w3.org/2000/svg";

const MAX_NODES_PER_ENTITY = 12000;
const COORD_BOUND = 100000;

export const LINE_TIERS = Object.freeze({
  outline:    { width: 1.0, opacity: 0.92, dash: "none",   perturb: 0.008, gapChance: 0.00, label: "outline" },
  structure:  { width: 0.55, opacity: 0.78, dash: "none",   perturb: 0.014, gapChance: 0.02, label: "structure" },
  texture:    { width: 0.28, opacity: 0.55, dash: "none",   perturb: 0.022, gapChance: 0.08, label: "texture" },
  atmosphere: { width: 0.16, opacity: 0.35, dash: "4 6",   perturb: 0.035, gapChance: 0.15, label: "atmosphere" }
});

/**
 * Simple deterministic hash from a string, returns a number in [0, 1).
 */
export function seedFromString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  const n = Math.abs(h) / 2147483648;
  return n - Math.floor(n);
}

/**
 * Mulberry32 PRNG seeded from a numeric seed.
 * Returns a function that produces numbers in [0, 1).
 */
function mulberry32(seed) {
  let state = (seed * 2147483647 + 1) | 0;
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Create a PRNG from entity ID and part name.
 */
export function createRNG(entityId, partName = "default") {
  const seed = seedFromString(`${entityId}|${partName}`);
  return mulberry32(seed);
}

/**
 * Clamp a value to the safe coordinate range.
 */
export function clamp(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-COORD_BOUND, Math.min(COORD_BOUND, value));
}

/**
 * Perpendicular vector to [dx, dy] at a given offset distance.
 */
function perp(dx, dy, distance, side) {
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  return [
    (-dy / len) * distance * side,
    (dx / len) * distance * side
  ];
}

/**
 * Generate a variable-width pen path from a centerline array.
 *
 * @param {Array<[number, number]>} points - centerline control points
 * @param {object} options
 * @param {string} options.tier - one of "outline", "structure", "texture", "atmosphere"
 * @param {number} [options.baseWidth] - base stroke width in pixels
 * @param {number} [options.widthScale] - multiplier for tier width
 * @param {Function} [options.widthFn] - (t) => width multiplier along the path
 * @param {Function} [options.rng] - PRNG function returning [0,1)
 * @param {boolean} [options.closed] - whether the path is closed
 * @param {number} [options.minWidth] - minimum resulting width in pixels
 * @returns {string} SVG path data string
 */
export function penPath(points, options = {}) {
  if (!Array.isArray(points) || points.length < 2) return "";

  const tier = LINE_TIERS[options.tier] || LINE_TIERS.structure;
  const baseWidth = options.baseWidth || 2.5;
  const widthScale = options.widthScale || 1.0;
  const widthFn = options.widthFn || (() => 1.0);
  const rng = options.rng || (() => 0.5);
  const closed = options.closed || false;
  const minWidth = options.minWidth || 0.4;

  const wp = baseWidth * tier.width * widthScale;
  const pert = wp * tier.perturb * 2;
  const gapChance = tier.gapChance;

  // Build smooth centerline with interpolation
  const interpolated = [];
  const totalSteps = Math.min(points.length * 3, 400);
  const segmentCount = points.length - 1;

  for (let i = 0; i <= totalSteps; i += 1) {
    const t = i / totalSteps;
    const rawIdx = t * segmentCount;
    const idx = Math.min(Math.floor(rawIdx), segmentCount - 1);
    const frac = rawIdx - idx;
    const p0 = points[idx];
    const p1 = points[Math.min(idx + 1, points.length - 1)];
    interpolated.push([
      p0[0] + (p1[0] - p0[0]) * frac,
      p0[1] + (p1[1] - p0[1]) * frac
    ]);
  }

  // Compute tangents
  const tangents = [];
  for (let i = 0; i < interpolated.length; i += 1) {
    const prev = interpolated[Math.max(0, i - 1)];
    const next = interpolated[Math.min(interpolated.length - 1, i + 1)];
    tangents.push([next[0] - prev[0], next[1] - prev[1]]);
  }

  // Generate left and right offset points
  const left = [];
  const right = [];
  const n = interpolated.length;

  for (let i = 0; i < n; i += 1) {
    const t = i / (n - 1);
    const w = Math.max(minWidth, wp * widthFn(t));
    const [tx, ty] = tangents[i];
    const len = Math.sqrt(tx * tx + ty * ty) || 1;

    // Perturb
    const px = pert * (rng() - 0.5);
    const py = pert * (rng() - 0.5);

    const lx = interpolated[i][0] + (-ty / len) * w + px;
    const ly = interpolated[i][1] + (tx / len) * w + py;
    const rx = interpolated[i][0] + (ty / len) * w + px;
    const ry = interpolated[i][1] + (-tx / len) * w + py;

    left.push([clamp(lx), clamp(ly)]);
    right.push([clamp(rx), clamp(ry)]);
  }

  // Build path with optional gaps
  let d = "";
  let nodeCount = 0;
  const maxNodes = MAX_NODES_PER_ENTITY;

  function appendPoint(x, y, forceMove) {
    if (nodeCount >= maxNodes) return;
    nodeCount += 1;
    const cmd = forceMove ? "M" : (d ? "L" : "M");
    d += `${cmd}${clamp(x).toFixed(2)} ${clamp(y).toFixed(2)}`;
  }

  // Build left side
  let inGap = false;

  for (let i = 0; i < left.length; i += 1) {
    if (nodeCount >= maxNodes) break;
    const isGap = gapChance > 0 && rng() < gapChance;
    if (isGap && !closed) {
      inGap = true;
    } else {
      const wasInGap = inGap;
      inGap = false;
      appendPoint(left[i][0], left[i][1], wasInGap);
    }
  }

  // Build right side (reverse) — connect last left point to first right point
  inGap = false;
  for (let i = right.length - 1; i >= 0; i -= 1) {
    if (nodeCount >= maxNodes) break;
    const isGap = gapChance > 0 && rng() < gapChance;
    if (isGap && !closed) {
      inGap = true;
    } else {
      const wasInGap = inGap;
      inGap = false;
      appendPoint(right[i][0], right[i][1], wasInGap);
    }
  }

  if (closed && d) d += " Z";
  if (nodeCount >= maxNodes && d) d += " Z";

  return d;
}

/**
 * Generate a simple varying-width path for quick line segments.
 * Produces a closed polygon simulating a tapering pen stroke.
 */
export function taperedStroke(points, options = {}) {
  if (!Array.isArray(points) || points.length < 2) return "";

  const tier = LINE_TIERS[options.tier] || LINE_TIERS.outline;
  const baseWidth = options.baseWidth || 2.5;
  const rng = options.rng || (() => 0.5);
  const wp = baseWidth * tier.width;

  // Width function: taper at both ends
  const widthFn = (t) => {
    const startTaper = Math.min(1, t * 4);
    const endTaper = Math.min(1, (1 - t) * 4);
    return startTaper * endTaper;
  };

  return penPath(points, {
    ...options,
    widthFn: options.widthFn || widthFn,
    baseWidth,
    tier: options.tier || "outline"
  });
}

/**
 * Create an SVG path element with pen stroke attributes.
 */
export function createPenElement(doc, d, options = {}) {
  const element = doc.createElementNS(NS, "path");
  const tier = LINE_TIERS[options.tier] || LINE_TIERS.structure;
  const penColor = options.stroke || "#303946";
  element.setAttribute("d", d);
  // Default to fill (variable-width envelope), override with options.fill if provided
  element.setAttribute("fill", options.fill !== undefined ? options.fill : penColor);
  element.setAttribute("stroke", options.strokeOverride || "none");
  element.setAttribute("opacity", (options.opacity || tier.opacity).toFixed(2));
  element.setAttribute("stroke-linecap", "round");
  element.setAttribute("stroke-linejoin", "round");
  element.setAttribute("data-line-tier", tier.label);
  if (options.partName) {
    element.setAttribute("data-part", options.partName);
  }
  return element;
}

/**
 * Generate hatching lines within a region for texture shading.
 * Returns array of path data strings.
 */
export function generateHatchLines(bounds, angle, spacing, rng, count = 8) {
  const { x, y, width, height } = bounds;
  const rad = angle * Math.PI / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const diagonal = Math.sqrt(width * width + height * height);
  const lines = [];

  for (let i = 0; i < count; i += 1) {
    const offset = (i - count / 2) * spacing + (rng() - 0.5) * spacing * 0.5;
    const cx = x + width / 2;
    const cy = y + height / 2;
    const p1x = cx + cos * (-diagonal) + (-sin) * offset;
    const p1y = cy + sin * (-diagonal) + cos * offset;
    const p2x = cx + cos * diagonal + (-sin) * offset;
    const p2y = cy + sin * diagonal + cos * offset;
    lines.push(`M${clamp(p1x).toFixed(1)} ${clamp(p1y).toFixed(1)} L${clamp(p2x).toFixed(1)} ${clamp(p2y).toFixed(1)}`);
  }

  return lines;
}

/**
 * Generate a unique namespace ID for SVG gradients and filters.
 */
export function namespaceId(namespace, baseId) {
  return `ns-${namespace}-${baseId}`;
}

/**
 * Count total nodes in a set of path data strings.
 */
export function countPathNodes(paths) {
  let count = 0;
  for (const d of paths) {
    if (typeof d !== "string") continue;
    // Count coordinate pairs by looking for number patterns
    const matches = d.match(/[-\d.]+[,\s]+[-\d.]+/g);
    if (matches) count += matches.length;
  }
  return count;
}

/**
 * Track node count and throw if exceeding the limit.
 */
export function checkNodeLimit(current, max = MAX_NODES_PER_ENTITY) {
  if (current > max) {
    throw new Error(`实体节点数 ${current} 超过上限 ${max}`);
  }
}
