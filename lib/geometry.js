/**
 * Geometry Adapter — Listen Paint Art Engine v4
 *
 * Wraps d3-shape and bezier-js behind deterministic,
 * coordinate-bounded interfaces for organic curve generation.
 */

import { line, curveCatmullRom, curveNatural, curveLinear, area } from "d3-shape";
import { Bezier } from "bezier-js";

const COORD_BOUND = 100000;
const MAX_CURVE_POINTS = 500;

/**
 * Clamp a coordinate to the safe range.
 */
export function clampCoord(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-COORD_BOUND, Math.min(COORD_BOUND, value));
}

/**
 * Clamp a point array.
 */
export function clampPoint([x, y]) {
  return [clampCoord(x), clampCoord(y)];
}

/**
 * Clamp all points in an array.
 */
export function clampPoints(points) {
  return points.map(clampPoint);
}

// ---------- Curve Generation (d3-shape) ----------

/**
 * Generate an organic smooth curve through control points.
 * Uses Catmull-Rom spline for natural flow.
 *
 * @param {Array<[number, number]>} points - control points
 * @param {object} [options]
 * @param {string} [options.curve="catmullRom"] - "catmullRom", "natural", or "linear"
 * @param {number} [options.samples] - number of sample points (default 100)
 * @returns {Array<[number, number]>} sampled curve points
 */
export function organicCurve(points, options = {}) {
  if (!Array.isArray(points) || points.length < 2) return [];
  const clamped = clampPoints(points);
  const curveType = options.curve || "catmullRom";
  const samples = Math.min(options.samples || 100, MAX_CURVE_POINTS);

  let curveFn;
  switch (curveType) {
    case "natural": curveFn = curveNatural; break;
    case "linear": curveFn = curveLinear; break;
    default: curveFn = curveCatmullRom;
  }

  const lineGen = line().curve(curveFn);
  const pathData = lineGen(clamped);
  if (!pathData) return [];

  // Parse path data back to points (M x,y L x,y ...)
  const pts = [];
  const re = /([ML])\s*([-\d.]+)\s*[,]\s*([-\d.]+)/g;
  let match;
  while ((match = re.exec(pathData))) {
    pts.push([clampCoord(parseFloat(match[2])), clampCoord(parseFloat(match[3]))]);
  }

  // If insufficient points from parsing, interpolate linearly
  if (pts.length < 2 && clamped.length >= 2) {
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const idx = Math.min(Math.floor(t * (clamped.length - 1)), clamped.length - 2);
      const frac = t * (clamped.length - 1) - idx;
      pts.push([
        clampCoord(clamped[idx][0] + (clamped[idx + 1][0] - clamped[idx][0]) * frac),
        clampCoord(clamped[idx + 1][1] + (clamped[idx + 1][1] - clamped[idx][1]) * frac)
      ]);
    }
  }

  return pts;
}

/**
 * Generate a contour from boundary points.
 * Uses area generator with organic curve.
 *
 * @param {Array<[number, number]>} points - boundary points
 * @returns {Array<[number, number]>} closed contour points
 */
export function organicContour(points) {
  if (!Array.isArray(points) || points.length < 3) return [];
  const clamped = clampPoints(points);
  const areaGen = area().curve(curveCatmullRom);
  // We only need the perimeter by generating full boundary
  const contour = organicCurve([...clamped, clamped[0]], { curve: "catmullRom" });
  return contour;
}

// ---------- Bezier Operations (bezier-js) ----------

/**
 * Sample a cubic Bezier curve at parameter t.
 *
 * @param {[number, number]} p0 - start point
 * @param {[number, number]} p1 - control point 1
 * @param {[number, number]} p2 - control point 2
 * @param {[number, number]} p3 - end point
 * @param {number} t - parameter in [0, 1]
 * @returns {[number, number]} point on curve
 */
export function bezierSample(p0, p1, p2, p3, t) {
  try {
    const b = new Bezier(
      clampCoord(p0[0]), clampCoord(p0[1]),
      clampCoord(p1[0]), clampCoord(p1[1]),
      clampCoord(p2[0]), clampCoord(p2[1]),
      clampCoord(p3[0]), clampCoord(p3[1])
    );
    const pt = b.get(t);
    return [clampCoord(pt.x), clampCoord(pt.y)];
  } catch (_) {
    // Fallback: linear interpolation
    const mt = 1 - t;
    return [
      clampCoord(mt * mt * mt * p0[0] + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t * t * t * p3[0]),
      clampCoord(mt * mt * mt * p0[1] + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t * t * t * p3[1])
    ];
  }
}

/**
 * Sample a cubic Bezier curve into N evenly-spaced points.
 *
 * @param {[number, number]} p0
 * @param {[number, number]} p1
 * @param {[number, number]} p2
 * @param {[number, number]} p3
 * @param {number} [samples=50]
 * @returns {Array<[number, number]>}
 */
export function bezierSamples(p0, p1, p2, p3, samples = 50) {
  const n = Math.min(samples, MAX_CURVE_POINTS);
  const result = [];
  for (let i = 0; i <= n; i++) {
    result.push(bezierSample(p0, p1, p2, p3, i / n));
  }
  return result;
}

/**
 * Get tangent angle at parameter t along a cubic Bezier.
 *
 * @returns {number} angle in radians
 */
export function bezierTangent(p0, p1, p2, p3, t) {
  try {
    const b = new Bezier(
      clampCoord(p0[0]), clampCoord(p0[1]),
      clampCoord(p1[0]), clampCoord(p1[1]),
      clampCoord(p2[0]), clampCoord(p2[1]),
      clampCoord(p3[0]), clampCoord(p3[1])
    );
    const d = b.derivative(t);
    return Math.atan2(d.y, d.x);
  } catch (_) {
    return 0;
  }
}

/**
 * Offset a cubic Bezier curve by a distance.
 *
 * @returns {object|null} { p0, p1, p2, p3 } or null
 */
export function bezierOffset(p0, p1, p2, p3, distance) {
  try {
    const b = new Bezier(
      clampCoord(p0[0]), clampCoord(p0[1]),
      clampCoord(p1[0]), clampCoord(p1[1]),
      clampCoord(p2[0]), clampCoord(p2[1]),
      clampCoord(p3[0]), clampCoord(p3[1])
    );
    const offset = b.offset(distance);
    const pts = offset.points;
    return {
      p0: [clampCoord(pts[0].x), clampCoord(pts[0].y)],
      p1: [clampCoord(pts[1].x), clampCoord(pts[1].y)],
      p2: [clampCoord(pts[2].x), clampCoord(pts[2].y)],
      p3: [clampCoord(pts[3].x), clampCoord(pts[3].y)]
    };
  } catch (_) {
    return null;
  }
}

/**
 * Find intersection points between two cubic Bezier curves.
 *
 * @returns {Array<[number, number]>} intersection points
 */
export function bezierIntersections(p0a, p1a, p2a, p3a, p0b, p1b, p2b, p3b) {
  try {
    const b1 = new Bezier(
      clampCoord(p0a[0]), clampCoord(p0a[1]),
      clampCoord(p1a[0]), clampCoord(p1a[1]),
      clampCoord(p2a[0]), clampCoord(p2a[1]),
      clampCoord(p3a[0]), clampCoord(p3a[1])
    );
    const b2 = new Bezier(
      clampCoord(p0b[0]), clampCoord(p0b[1]),
      clampCoord(p1b[0]), clampCoord(p1b[1]),
      clampCoord(p2b[0]), clampCoord(p2b[1]),
      clampCoord(p3b[0]), clampCoord(p3b[1])
    );
    const intersections = b1.intersects(b2);
    return intersections.map(t => {
      const pt = b1.get(t);
      return [clampCoord(pt.x), clampCoord(pt.y)];
    });
  } catch (_) {
    return [];
  }
}

/**
 * Convert an array of points into a smooth path using Bezier interpolation.
 * Creates cubic Beziers through successive point triples.
 *
 * @param {Array<[number, number]>} points
 * @returns {Array<[number, number]>} sampled smooth points
 */
export function smoothPoints(points) {
  if (!Array.isArray(points) || points.length < 2) return [];
  if (points.length === 2) {
    return [points[0], points[1]];
  }
  const clamped = clampPoints(points);
  const result = [];
  for (let i = 0; i < clamped.length - 1; i++) {
    const p0 = clamped[i];
    const p3 = clamped[i + 1];
    const prev = clamped[Math.max(0, i - 1)];
    const next = clamped[Math.min(clamped.length - 1, i + 2)];
    const cp1 = [
      p0[0] + (p3[0] - prev[0]) / 6,
      p0[1] + (p3[1] - prev[1]) / 6
    ];
    const cp2 = [
      p3[0] - (next[0] - p0[0]) / 6,
      p3[1] - (next[1] - p0[1]) / 6
    ];
    const seg = bezierSamples(p0, cp1, cp2, p3, 20);
    if (i > 0) seg.shift(); // avoid duplicate
    result.push(...seg);
  }
  return result;
}
