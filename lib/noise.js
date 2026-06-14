/**
 * Noise Adapter — Listen Paint Art Engine v4
 *
 * Wraps simplex-noise behind a deterministic, seed-driven interface
 * for paper grain, ink texture, material perturbation, and natural
 * contour variation.
 */

import { createNoise2D, createNoise3D } from "simplex-noise";

const COORD_BOUND = 100000;
const MAX_NOISE_CACHE = 100;

function clampC(v) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(-COORD_BOUND, Math.min(COORD_BOUND, v));
}

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return (Math.abs(h) / 2147483648) % 1;
}

// Cache noise generators by seed
const noise2DCache = new Map();
const noise3DCache = new Map();

/**
 * Get or create a deterministic 2D noise function.
 *
 * @param {number|string} seed
 * @returns {function(number, number): number} noise function returning [-1, 1]
 */
export function getNoise2D(seed = 0) {
  const numSeed = typeof seed === "number" ? seed : hashString(String(seed));
  const key = numSeed.toFixed(8);
  if (noise2DCache.has(key)) return noise2DCache.get(key);

  const noiseFn = createNoise2D(() => numSeed);
  // Maintain cache size
  if (noise2DCache.size >= MAX_NOISE_CACHE) {
    noise2DCache.delete(noise2DCache.keys().next().value);
  }
  noise2DCache.set(key, noiseFn);
  return noiseFn;
}

/**
 * Get or create a deterministic 3D noise function.
 *
 * @param {number|string} seed
 * @returns {function(number, number, number): number}
 */
export function getNoise3D(seed = 0) {
  const numSeed = typeof seed === "number" ? seed : hashString(String(seed));
  const key = numSeed.toFixed(8);
  if (noise3DCache.has(key)) return noise3DCache.get(key);

  const noiseFn = createNoise3D(() => numSeed);
  if (noise3DCache.size >= MAX_NOISE_CACHE) {
    noise3DCache.delete(noise3DCache.keys().next().value);
  }
  noise3DCache.set(key, noiseFn);
  return noiseFn;
}

/**
 * Generate paper-like grain value for a coordinate.
 *
 * @param {number} x
 * @param {number} y
 * @param {number|string} [seed=0]
 * @param {number} [frequency=0.05] - noise frequency
 * @returns {number} value in [0, 1]
 */
export function paperGrain(x, y, seed = 0, frequency = 0.05) {
  const noise = getNoise2D(seed);
  const nx = clampC(x) * frequency;
  const ny = clampC(y) * frequency;
  // Use multiple octaves for natural paper texture
  const v1 = noise(nx, ny) * 0.6;
  const v2 = noise(nx * 2.3, ny * 2.3) * 0.25;
  const v3 = noise(nx * 5.7, ny * 5.7) * 0.15;
  return (v1 + v2 + v3 + 1) / 2; // map to [0, 1]
}

/**
 * Generate ink-like diffusion pattern.
 *
 * @param {number} x
 * @param {number} y
 * @param {number|string} [seed=0]
 * @param {number} [frequency=0.03]
 * @returns {number} value in [0, 1]
 */
export function inkTexture(x, y, seed = 0, frequency = 0.03) {
  const noise = getNoise3D(seed);
  const nx = clampC(x) * frequency;
  const ny = clampC(y) * frequency;
  const nz = 0.5; // third dimension for richness
  const v1 = noise(nx, ny, nz) * 0.5;
  const v2 = noise(nx * 2.7, ny * 2.7, nz + 1.5) * 0.3;
  const v3 = noise(nx * 6.1, ny * 6.1, nz + 3.0) * 0.2;
  // Threshold to create ink pooling effect
  let val = (v1 + v2 + v3 + 1) / 2;
  return Math.pow(val, 1.5); // bias toward darker values
}

/**
 * Perturb a point for natural, organic contour variation.
 *
 * @param {number} x
 * @param {number} y
 * @param {number|string} [seed=0]
 * @param {number} [amplitude=2] - perturbation magnitude
 * @param {number} [frequency=0.1] - noise frequency
 * @returns {[number, number]} perturbed point
 */
export function perturb2D(x, y, seed = 0, amplitude = 2, frequency = 0.1) {
  const noiseX = getNoise2D(seed);
  const noiseY = getNoise2D(typeof seed === "number" ? seed + 0.5 : hashString(String(seed) + "_y"));
  const dx = noiseX(clampC(x) * frequency, clampC(y) * frequency) * amplitude;
  const dy = noiseY(clampC(y) * frequency, clampC(x) * frequency) * amplitude;
  return [clampC(x + dx), clampC(y + dy)];
}

/**
 * Perturb an array of points for organic outline variation.
 *
 * @param {Array<[number, number]>} points
 * @param {number|string} [seed=0]
 * @param {number} [amplitude=2]
 * @param {number} [frequency=0.1]
 * @returns {Array<[number, number]>}
 */
export function perturbPath(points, seed = 0, amplitude = 2, frequency = 0.1) {
  if (!Array.isArray(points)) return [];
  return points.map(([x, y], i) =>
    perturb2D(x, y, typeof seed === "number" ? seed + i * 0.01 : hashString(String(seed) + "_" + i), amplitude, frequency)
  );
}

/**
 * Generate a wood-grain-like pattern value.
 *
 * @param {number} x
 * @param {number} y
 * @param {number|string} [seed=0]
 * @param {number} [frequency=0.02]
 * @returns {number} value in [0, 1]
 */
export function woodGrain(x, y, seed = 0, frequency = 0.02) {
  const noise = getNoise2D(seed);
  const nx = clampC(x) * frequency;
  const ny = clampC(y) * frequency;
  // Ring-like pattern with noise
  const dist = Math.sqrt(nx * nx + ny * ny);
  const rings = Math.sin(dist * 10 + noise(nx * 2, ny * 2) * 2);
  return (rings + 1) / 2;
}

/**
 * Generate cloud-like volumetric noise.
 *
 * @param {number} x
 * @param {number} y
 * @param {number|string} [seed=0]
 * @param {number} [frequency=0.01]
 * @returns {number} value in [0, 1]
 */
export function cloudNoise(x, y, seed = 0, frequency = 0.01) {
  const noise = getNoise2D(seed);
  const nx = clampC(x) * frequency;
  const ny = clampC(y) * frequency;
  const v1 = noise(nx, ny);
  const v2 = noise(nx * 1.8 + 5.2, ny * 1.8 + 3.1);
  const v3 = noise(nx * 3.5 + 1.7, ny * 3.5 + 8.4);
  // Soft minimum for cloud shapes
  let val = Math.min(v1 * 0.5 + 0.5, v2 * 0.5 + 0.5);
  val = Math.min(val, v3 * 0.5 + 0.5);
  return Math.max(0, val);
}

/**
 * Generate a mountain-like fractal terrain value.
 *
 * @param {number} x
 * @param {number} y
 * @param {number|string} [seed=0]
 * @param {number} [frequency=0.005]
 * @param {number} [octaves=4]
 * @returns {number} value in [0, 1]
 */
export function terrainNoise(x, y, seed = 0, frequency = 0.005, octaves = 4) {
  const noise = getNoise2D(seed);
  const nx = clampC(x) * frequency;
  const ny = clampC(y) * frequency;
  let val = 0;
  let amp = 1;
  let totalAmp = 0;
  let f = 1;
  for (let i = 0; i < octaves; i++) {
    val += noise(nx * f, ny * f) * amp;
    totalAmp += amp;
    amp *= 0.5;
    f *= 2.0;
  }
  return (val / totalAmp + 1) / 2;
}

/**
 * Clear all noise caches (useful for testing).
 */
export function clearNoiseCache() {
  noise2DCache.clear();
  noise3DCache.clear();
}
