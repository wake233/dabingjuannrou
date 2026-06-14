import { renderEntity as renderStorybookEntity, PALETTE } from "./templates.js";
import { ART_STYLES } from "./art_schema.js";
import { getGrammarCategory } from "./shape_grammar.js";

const NS = "http://www.w3.org/2000/svg";

// ---- Colour palettes ----

const WOODCUT = Object.freeze({
  ink: "#171411",
  paper: "#f2e8cf",
  accent: "#9b2226",
  mid: "#3d3522",
  light: "#5a4a32",
  deep: "#2a2218"
});

const INK = Object.freeze({
  jiao: "#151515",
  nong: "#2d2d2d",
  zhong: "#4a4a4a",
  dan: "#7a7a7a",
  qing: "#b0b0b0"
});

// ---- Helpers ----

function node(tag, attrs = {}) {
  const element = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}

function finish(group, entity, style) {
  group.setAttribute("data-id", entity.id);
  group.setAttribute("data-name", entity.name);
  group.setAttribute("data-renderer", style);
  group.setAttribute("data-semantic-entity", entity.templateId);
  const direction = entity.params?.direction === "left" ? ` translate(${entity.width} 0) scale(-1 1)` : "";
  group.setAttribute("transform", `translate(${entity.x} ${entity.y}) rotate(${entity.rotation} ${entity.width / 2} ${entity.height / 2})${direction}`);
  group.setAttribute("opacity", entity.opacity);
  return group;
}

function inferGrammarCategory(templateId) {
  if (["person", "cat", "dog", "bird"].includes(templateId)) return "figure";
  if (["house", "roof", "bridge", "boat", "bench", "bicycle", "fence", "buildings", "streetlamp", "umbrella", "street"].includes(templateId)) return "structure";
  if (["tree", "mountain", "flowers", "grass", "river", "puddle"].includes(templateId)) return "nature";
  if (["rain", "cloud", "sun", "moon", "stars"].includes(templateId)) return "atmosphere";
  return "structure";
}

function getMeta(entity, key, fallback) {
  if (entity[key] !== undefined) return entity[key];
  return fallback;
}

/**
 * Estimate the visual darkness of a hex colour string (0 = light, 1 = dark).
 */
function darkness(hex) {
  if (!hex || hex === "none" || hex.startsWith("url(")) return 0.5;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 1 - (0.299 * r + 0.587 * g + 0.114 * b);
}

/**
 * Deep-clone an SVG element tree, transforming every element via a callback.
 * The callback receives (element, depth) and returns a new element (or null to skip).
 */
function transformTree(source, callback, depth = 0) {
  const result = callback(source, depth);
  if (!result) return null;
  for (const child of source.children) {
    const transformed = transformTree(child, callback, depth + 1);
    if (transformed) result.appendChild(transformed);
  }
  return result;
}

// ==================== WOODCUT RENDERER ====================

/**
 * Render an entity in woodcut (木刻版画) style.
 *
 * Steps:
 *   1. Render the entity at base quality in storybook style to get the semantic skeleton.
 *   2. Walk the SVG tree, replacing gradient fills with solid woodcut-palette tone blocks,
 *      converting strokes to the paper colour with square caps / miter joins.
 *   3. Add directional carved lines (hatching) and an optional accent block.
 */
function woodcutEntity(entity) {
  const { width: w, height: h, templateId } = entity;

  // --- Art-engine metadata (with sensible defaults) ---
  const cat = getMeta(entity, "_grammarCategory", inferGrammarCategory(templateId));
  const blockCount = getMeta(entity, "_blockCount", cat === "figure" ? 4 : 3);
  const carveDir = getMeta(entity, "_carveDirection", cat === "nature" ? "diagonal" : "horizontal");
  const hasAccent = getMeta(entity, "_accentBlock", cat === "figure" || cat === "structure");

  // --- Obtain semantic skeleton from storybook templates (base quality) ---
  const skeleton = renderStorybookEntity(entity, {
    quality: "base",
    namespace: "woodcut-" + entity.id
  });

  // --- Build woodcut group ---
  const group = node("g", {
    "data-art-style": "woodcut",
    "stroke-linecap": "square",
    "stroke-linejoin": "miter"
  });

  // --- Collect fill-bearing elements for tone-block assignment ---
  const fillElements = [];

  function collectFills(el) {
    const f = el.getAttribute("fill");
    if (f && f !== "none") fillElements.push({ el, fill: f, darkness: darkness(f) });
    for (const child of el.children) collectFills(child);
  }
  collectFills(skeleton);

  // Sort fill-bearing elements by visual darkness so we can assign distinct tone blocks
  fillElements.sort((a, b) => b.darkness - a.darkness);

  // Assign woodcut tone blocks based on entity._blockCount
  // Tones cycle through: dark (ink), mid, light, deep
  const woodcutTones = [WOODCUT.ink, WOODCUT.mid, WOODCUT.light, WOODCUT.deep];
  const toneLabels = ["dark", "mid", "light", "deep"];
  const fillMap = new Map(); // element -> { fill, label }
  for (let i = 0; i < fillElements.length; i += 1) {
    const blockIndex = i % blockCount;
    fillMap.set(fillElements[i].el, {
      fill: woodcutTones[blockIndex % woodcutTones.length],
      label: toneLabels[blockIndex % toneLabels.length]
    });
  }

  // --- Transform the skeleton tree into woodcut style ---
  const woodcutRoot = transformTree(skeleton, (el, depth) => {
    // Skip defs (gradient definitions are meaningless for woodcut)
    if (el.tagName === "defs") return null;

    const newEl = node(el.tagName);

    // Copy non-style attributes
    for (const attrName of el.getAttributeNames ? el.getAttributeNames() : Object.keys(el.attributes || {})) {
      const value = el.getAttribute(attrName);

      if (attrName === "fill") {
        if (value === "none") {
          newEl.setAttribute("fill", "none");
        } else {
          const mapped = fillMap.get(el);
          if (mapped) {
            newEl.setAttribute("fill", mapped.fill);
            newEl.setAttribute("data-tone-block", mapped.label);
          } else {
            newEl.setAttribute("fill", WOODCUT.ink);
            newEl.setAttribute("data-tone-block", "dark");
          }
        }
      } else if (attrName === "stroke") {
        if (value !== "none") {
          newEl.setAttribute("stroke", WOODCUT.paper);
        } else {
          newEl.setAttribute("stroke", "none");
        }
      } else if (attrName === "stroke-width") {
        // Slightly thicken for carved look
        const sw = parseFloat(value) || 2;
        newEl.setAttribute("stroke-width", Math.max(2, sw * 1.25).toFixed(2));
      } else if (attrName === "stroke-linecap" || attrName === "stroke-linejoin") {
        // Overridden by group-level attributes; skip
      } else if (attrName === "opacity") {
        // Reduce opacity slightly for woodcut texture feel, but keep it
        newEl.setAttribute("opacity", Math.min(1, parseFloat(value) * 1.1).toFixed(2));
      } else if (attrName === "data-art-style" || attrName === "data-template" ||
                 attrName === "data-quality" || attrName === "data-namespace" ||
                 attrName === "data-id" || attrName === "data-name") {
        // Strip storybook metadata; finish() will set the correct values
      } else if (attrName === "data-line-tier") {
        newEl.setAttribute("data-line-tier", value);
        newEl.setAttribute("data-carved", "true");
      } else if (attrName === "data-shadow") {
        newEl.setAttribute("fill", WOODCUT.mid);
        newEl.setAttribute("opacity", "0.5");
        newEl.setAttribute("data-tone-block", "mid");
        newEl.setAttribute("data-shadow", "contact");
      } else {
        // Pass through
        newEl.setAttribute(attrName, value);
      }
    }

    return newEl;
  });

  // Append transformed elements to the woodcut group
  if (woodcutRoot) {
    for (const child of woodcutRoot.children) {
      group.appendChild(child);
    }
  }

  // --- Add directional carved lines ---
  addCarveLines(group, entity, carveDir, blockCount);

  // --- Add accent block for figures and structures ---
  if (hasAccent) {
    addAccentBlock(group, entity);
  }

  return finish(group, entity, "woodcut");
}

function addCarveLines(group, entity, direction, count) {
  const { width: w, height: h } = entity;
  const sw = Math.max(1, Math.min(w, h) * 0.006);
  const totalLines = Math.max(6, Math.min(20, Math.round(count * 4)));

  for (let i = 0; i < totalLines; i += 1) {
    const t = i / (totalLines - 1);
    let x1, y1, x2, y2;

    if (direction === "diagonal") {
      // Diagonal lines from bottom-left to top-right area
      x1 = t * w * 0.9;
      y1 = h * 0.95 - t * h * 0.4;
      x2 = Math.min(w * 0.95, x1 + w * 0.35);
      y2 = Math.max(0, y1 - h * 0.35);
    } else {
      // Horizontal lines across the entity
      x1 = w * 0.05;
      y1 = h * 0.15 + t * h * 0.75;
      x2 = w * 0.95;
      y2 = y1;
    }

    const el = node("path", {
      d: `M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}`,
      fill: "none",
      stroke: WOODCUT.paper,
      "stroke-width": sw.toFixed(2),
      opacity: (0.3 + (i % 4) * 0.12).toFixed(2),
      "stroke-linecap": "square",
      "data-carved-line": direction
    });
    group.appendChild(el);
  }
}

function addAccentBlock(group, entity) {
  const { width: w, height: h } = entity;
  // Accent: a distinctive angular shape near the center-top area
  const cx = w * 0.38;
  const cy = h * 0.22;
  const size = Math.min(w, h) * 0.1;

  const el = node("path", {
    d: [
      `M${(cx - size).toFixed(1)} ${(cy + size * 0.6).toFixed(1)}`,
      `L${(cx - size * 0.3).toFixed(1)} ${(cy - size * 0.7).toFixed(1)}`,
      `L${(cx + size * 0.7).toFixed(1)} ${(cy).toFixed(1)}`,
      `L${(cx + size * 0.3).toFixed(1)} ${(cy + size * 0.8).toFixed(1)}`,
      "Z"
    ].join(" "),
    fill: WOODCUT.accent,
    stroke: WOODCUT.paper,
    "stroke-width": Math.max(1.5, Math.min(w, h) * 0.012).toFixed(2),
    "stroke-linecap": "square",
    "stroke-linejoin": "miter",
    opacity: "0.85",
    "data-tone-block": "accent",
    "data-accent": "true"
  });
  group.appendChild(el);
}

// ==================== INK-WASH RENDERER ====================

/**
 * Render an entity in ink-wash (水墨) style.
 *
 * Steps:
 *   1. Render the entity at base quality in storybook style to get the semantic skeleton.
 *   2. Walk the SVG tree, reducing fills to ink-wash tones, converting strokes to
 *      round-cap ink lines.
 *   3. Add wash-layer ellipses, flying-white textures (for nature), and controlled specks.
 */
function inkEntity(entity) {
  const { width: w, height: h, templateId } = entity;

  // --- Art-engine metadata (with sensible defaults) ---
  const cat = getMeta(entity, "_grammarCategory", inferGrammarCategory(templateId));
  const washLayers = getMeta(entity, "_washLayers", cat === "atmosphere" ? 1 : cat === "nature" ? 2 : 3);
  const flyingWhite = getMeta(entity, "_flyingWhite", cat === "nature");
  const speckCount = getMeta(entity, "_speckCount", cat === "figure" ? 6 : 3);

  // --- Obtain semantic skeleton from storybook templates (base quality) ---
  const skeleton = renderStorybookEntity(entity, {
    quality: "base",
    namespace: "ink-" + entity.id
  });

  // --- Build ink group ---
  const group = node("g", {
    "data-art-style": "ink",
    "stroke-linecap": "round",
    "stroke-linejoin": "round"
  });

  // --- Collect fill-bearing elements for wash-tone assignment ---
  const fillElements = [];
  function collectFills(el) {
    const f = el.getAttribute("fill");
    if (f && f !== "none") fillElements.push({ el, fill: f, darkness: darkness(f) });
    for (const child of el.children) collectFills(child);
  }
  collectFills(skeleton);

  fillElements.sort((a, b) => b.darkness - a.darkness);

  // Assign ink wash tones — cycle through the ink palette
  const inkTones = [INK.jiao, INK.nong, INK.zhong, INK.dan, INK.qing];
  const inkLabels = ["jiao", "nong", "zhong", "dan", "qing"];
  const fillMap = new Map();
  const numTones = Math.min(inkTones.length, washLayers + 1);
  for (let i = 0; i < fillElements.length; i += 1) {
    const toneIdx = i % numTones;
    fillMap.set(fillElements[i].el, {
      fill: inkTones[toneIdx],
      label: inkLabels[toneIdx]
    });
  }

  // --- Transform the skeleton tree into ink style ---
  const inkRoot = transformTree(skeleton, (el, depth) => {
    // Skip defs
    if (el.tagName === "defs") return null;

    const newEl = node(el.tagName);

    for (const attrName of el.getAttributeNames ? el.getAttributeNames() : Object.keys(el.attributes || {})) {
      const value = el.getAttribute(attrName);

      if (attrName === "fill") {
        if (value === "none") {
          newEl.setAttribute("fill", "none");
        } else {
          const mapped = fillMap.get(el);
          if (mapped) {
            newEl.setAttribute("fill", mapped.fill);
            newEl.setAttribute("data-ink-wash", mapped.label);
          } else {
            newEl.setAttribute("fill", INK.jiao);
            newEl.setAttribute("data-ink-wash", "jiao");
          }
        }
      } else if (attrName === "stroke") {
        if (value !== "none") {
          // Use darkest ink for primary outlines, medium for inner lines
          const mapped = fillMap.get(el);
          newEl.setAttribute("stroke", depth === 0 ? INK.jiao : INK.nong);
        } else {
          newEl.setAttribute("stroke", "none");
        }
      } else if (attrName === "stroke-width") {
        const sw = parseFloat(value) || 2;
        newEl.setAttribute("stroke-width", sw.toFixed(2));
      } else if (attrName === "stroke-linecap" || attrName === "stroke-linejoin") {
        // Overridden by group-level; skip
      } else if (attrName === "opacity") {
        const op = parseFloat(value);
        // Ink wash — slightly increase opacity for depth
        newEl.setAttribute("opacity", Math.min(1, op * 1.05).toFixed(2));
      } else if (attrName === "data-art-style" || attrName === "data-template" ||
                 attrName === "data-quality" || attrName === "data-namespace" ||
                 attrName === "data-id" || attrName === "data-name") {
        // Strip storybook metadata
      } else if (attrName === "data-line-tier") {
        newEl.setAttribute("data-line-tier", value);
        newEl.setAttribute("data-ink-mark", "gesture");
      } else if (attrName === "data-shadow") {
        newEl.setAttribute("fill", INK.zhong);
        newEl.setAttribute("opacity", "0.45");
        newEl.setAttribute("data-ink-wash", "light");
        newEl.setAttribute("data-shadow", "contact");
      } else {
        newEl.setAttribute(attrName, value);
      }
    }

    return newEl;
  });

  // Append transformed elements
  if (inkRoot) {
    for (const child of inkRoot.children) {
      group.appendChild(child);
    }
  }

  // --- Add wash layers ---
  addWashLayers(group, entity, washLayers);

  // --- Add flying-white (for nature entities) ---
  if (flyingWhite) {
    addFlyingWhite(group, entity);
  }

  // --- Add controlled specks ---
  addInkSpecks(group, entity, speckCount);

  return finish(group, entity, "ink");
}

function addWashLayers(group, entity, count) {
  const { width: w, height: h } = entity;
  // Ink-wash layers are semi-transparent elliptical overlays in increasingly
  // lighter tones, creating the graduated wash effect.
  const centers = [
    [w * 0.48, h * 0.62],
    [w * 0.52, h * 0.55],
    [w * 0.50, h * 0.50]
  ];
  const washes = [
    { ink: INK.nong, opacity: 0.12, rxScale: 0.44, ryScale: 0.31 },
    { ink: INK.zhong, opacity: 0.15, rxScale: 0.35, ryScale: 0.28 },
    { ink: INK.dan, opacity: 0.18, rxScale: 0.28, ryScale: 0.22 }
  ];

  for (let i = 0; i < Math.min(count, washes.length); i += 1) {
    const wash = washes[i];
    const cx = centers[i][0];
    const cy = centers[i][1];
    const el = node("ellipse", {
      cx: cx.toFixed(1),
      cy: cy.toFixed(1),
      rx: (w * wash.rxScale).toFixed(1),
      ry: (h * wash.ryScale).toFixed(1),
      fill: wash.ink,
      opacity: wash.opacity.toFixed(2),
      stroke: "none",
      "data-ink-wash": i === 0 ? "heavy" : i === 1 ? "medium" : "light"
    });
    group.appendChild(el);
  }
}

function addFlyingWhite(group, entity) {
  const { width: w, height: h } = entity;
  // Flying white (飞白): dashed, broken strokes that simulate
  // the dry-brush effect where paper texture shows through.
  const sw = Math.max(2, Math.min(w, h) * 0.02);
  const strokes = [
    // Horizontal-ish dry brush strokes
    { d: `M${(w * 0.08).toFixed(1)} ${(h * 0.65).toFixed(1)} Q${(w * 0.3).toFixed(1)} ${(h * 0.5).toFixed(1)} ${(w * 0.5).toFixed(1)} ${(h * 0.58).toFixed(1)}` },
    { d: `M${(w * 0.15).toFixed(1)} ${(h * 0.78).toFixed(1)} Q${(w * 0.4).toFixed(1)} ${(h * 0.68).toFixed(1)} ${(w * 0.7).toFixed(1)} ${(h * 0.76).toFixed(1)}` },
    { d: `M${(w * 0.12).toFixed(1)} ${(h * 0.38).toFixed(1)} Q${(w * 0.55).toFixed(1)} ${(h * 0.22).toFixed(1)} ${(w * 0.88).toFixed(1)} ${(h * 0.46).toFixed(1)}` }
  ];

  strokes.forEach((stroke, i) => {
    const el = node("path", {
      d: stroke.d,
      fill: "none",
      stroke: INK.zhong,
      "stroke-width": sw.toFixed(2),
      opacity: (0.35 + i * 0.1).toFixed(2),
      "stroke-dasharray": `${Math.max(4, w * 0.06).toFixed(1)} ${Math.max(3, w * 0.04).toFixed(1)}`,
      "stroke-linecap": "round",
      "data-flying-white": "true",
      "data-ink-mark": "gesture"
    });
    group.appendChild(el);
  });
}

function addInkSpecks(group, entity, count) {
  const { width: w, height: h } = entity;
  // Controlled ink specks (墨点) scattered within the entity bounds.
  for (let i = 0; i < count; i += 1) {
    // Use a simple deterministic scatter based on entity id and speck index
    const seed = (entity.id || "").split("").reduce((s, c) => s + c.charCodeAt(0), 0) + i * 37;
    const pseudoRand = (n) => ((seed * (n + 1) * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

    const cx = w * (0.15 + pseudoRand(0) * 0.7);
    const cy = h * (0.15 + pseudoRand(1) * 0.7);
    const r = Math.max(1.5, Math.min(w, h) * (0.008 + pseudoRand(2) * 0.025));
    const opacity = 0.15 + pseudoRand(3) * 0.3;
    const tone = [INK.jiao, INK.nong, INK.zhong][i % 3];

    const el = node("circle", {
      cx: cx.toFixed(1),
      cy: cy.toFixed(1),
      r: r.toFixed(2),
      fill: tone,
      opacity: opacity.toFixed(2),
      stroke: "none",
      "data-ink-speck": "controlled"
    });
    group.appendChild(el);
  }
}

// ==================== PUBLIC API ====================

/**
 * Render an artwork entity in the specified style.
 *
 * @param {object} entity - Entity object with templateId, width, height, params, id, etc.
 * @param {string} style - "storybook", "woodcut", or "ink"
 * @param {object} [options] - Rendering options
 * @param {string} [options.quality="full"] - "base" or "full" (storybook only)
 * @param {string} [options.namespace="canvas"] - SVG id namespace
 * @returns {SVGElement} SVG group element
 */
export function renderArtworkEntity(entity, style = "storybook", options = {}) {
  if (!ART_STYLES.includes(style)) throw new Error("艺术风格无效");

  if (style === "woodcut") {
    // Ensure art-engine metadata is available; if not, compute defaults
    if (!entity._grammarCategory) {
      entity._grammarCategory = inferGrammarCategory(entity.templateId);
    }
    if (!entity._blockType) {
      entity._blockType = "high-contrast";
    }
    if (entity._blockCount === undefined) {
      entity._blockCount = entity._grammarCategory === "figure" ? 4 : 3;
    }
    if (!entity._carveDirection) {
      entity._carveDirection = entity._grammarCategory === "nature" ? "diagonal" : "horizontal";
    }
    if (entity._accentBlock === undefined) {
      entity._accentBlock = entity._grammarCategory === "figure" || entity._grammarCategory === "structure";
    }
    return woodcutEntity(entity);
  }

  if (style === "ink") {
    // Ensure art-engine metadata is available; if not, compute defaults
    if (!entity._grammarCategory) {
      entity._grammarCategory = inferGrammarCategory(entity.templateId);
    }
    if (!entity._blockType) {
      entity._blockType = "ink-wash-gradient";
    }
    if (entity._washLayers === undefined) {
      entity._washLayers = entity._grammarCategory === "atmosphere" ? 1
        : entity._grammarCategory === "nature" ? 2 : 3;
    }
    if (entity._flyingWhite === undefined) {
      entity._flyingWhite = entity._grammarCategory === "nature";
    }
    if (entity._speckCount === undefined) {
      entity._speckCount = entity._grammarCategory === "figure" ? 6 : 3;
    }
    return inkEntity(entity);
  }

  // Storybook — delegate to templates.js as before
  const rendered = renderStorybookEntity(entity, {
    quality: options.quality || "full",
    namespace: options.namespace || "canvas"
  });
  rendered.setAttribute("data-renderer", style);
  rendered.setAttribute("data-semantic-entity", entity.templateId);
  return rendered;
}
