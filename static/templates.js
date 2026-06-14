import { ENTITY_TEMPLATES, TEMPLATE_NAMES } from "./scene_schema.js";
import {
  LINE_TIERS, seedFromString, createRNG, clamp, penPath, taperedStroke,
  createPenElement, generateHatchLines, namespaceId, countPathNodes, checkNodeLimit
} from "./pen_stroke.js";

const NS = "http://www.w3.org/2000/svg";

const PALETTE = Object.freeze({
  ink: "#46505e", deepInk: "#303946", warm: "#d98f70", rose: "#c97b84",
  gold: "#e8c47c", green: "#86a886", moss: "#657f6a", blue: "#88a9bd",
  deepBlue: "#617f96", night: "#596780", paper: "#f4ead7", cream: "#fff8e9",
  skin: "#efc5a5", skinShadow: "#d4a78a", wood: "#8b6914", brick: "#c17a5e",
  waterLight: "#a8d4e6", waterDark: "#5c8a9e", foliage: "#5a7a4a",
  foliageDark: "#3d5432", stone: "#9e9e8e", stoneDark: "#6e6e60"
});

function node(tag, attrs = {}) {
  const element = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}

function add(group, tag, attrs) {
  const el = node(tag, attrs);
  group.appendChild(el);
  return el;
}

function repeat(group, count, create) {
  for (let i = 0; i < count; i += 1) create(i);
}

function shade(hex, amount) {
  const v = Number.parseInt(hex.slice(1), 16);
  const c = (ch) => Math.max(0, Math.min(255, ch + amount));
  return `#${[v >> 16, (v >> 8) & 255, v & 255].map(ch => c(ch).toString(16).padStart(2, "0")).join("")}`;
}

function alpha(hex, a) {
  const v = Number.parseInt(hex.slice(1), 16);
  return `rgba(${v >> 16},${(v >> 8) & 255},${v & 255},${a})`;
}

// ---------- Rendering functions ----------

function renderDefs(group, entity, namespace) {
  const { width: w, height: h, params = {} } = entity;
  const color = params.color || PALETTE.green;
  const accent = params.accent || PALETTE.warm;
  const ns = namespace || "canvas";

  const defs = node("defs");

  // Primary gradient
  const g1 = node("linearGradient", {
    id: namespaceId(ns, `grad-${entity.id}`),
    x1: "0", y1: "0", x2: "1", y2: "1",
    gradientTransform: "rotate(25)"
  });
  g1.appendChild(node("stop", { offset: "0%", "stop-color": shade(color, 20), "stop-opacity": "1" }));
  g1.appendChild(node("stop", { offset: "45%", "stop-color": color, "stop-opacity": "1" }));
  g1.appendChild(node("stop", { offset: "100%", "stop-color": shade(color, -25), "stop-opacity": "1" }));
  defs.appendChild(g1);

  // Shadow gradient
  const g2 = node("linearGradient", {
    id: namespaceId(ns, `shadow-${entity.id}`),
    x1: "0", y1: "0", x2: "1", y2: "1"
  });
  g2.appendChild(node("stop", { offset: "0%", "stop-color": PALETTE.night, "stop-opacity": "0.25" }));
  g2.appendChild(node("stop", { offset: "100%", "stop-color": PALETTE.night, "stop-opacity": "0.05" }));
  defs.appendChild(g2);

  // Highlight gradient (radial)
  const g3 = node("radialGradient", {
    id: namespaceId(ns, `highlight-${entity.id}`),
    cx: "40%", cy: "30%", r: "60%"
  });
  g3.appendChild(node("stop", { offset: "0%", "stop-color": PALETTE.cream, "stop-opacity": "0.4" }));
  g3.appendChild(node("stop", { offset: "100%", "stop-color": PALETTE.cream, "stop-opacity": "0" }));
  defs.appendChild(g3);

  group.appendChild(defs);
  return defs;
}

function penLine(group, points, options = {}) {
  const d = penPath(points, options);
  if (!d) return null;
  return createPenElement(globalThis.document || { createElementNS: () => node("path") }, d, options);
}

function penLineToGroup(group, points, options = {}) {
  const d = penPath(points, options);
  if (!d) return;
  const el = node("path", {
    d,
    fill: "none",
    stroke: options.stroke || PALETTE.ink,
    "stroke-width": ((options.baseWidth || 2.5) * (LINE_TIERS[options.tier] || LINE_TIERS.structure).width).toFixed(2),
    opacity: (options.opacity || (LINE_TIERS[options.tier] || LINE_TIERS.structure).opacity).toFixed(2),
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "data-line-tier": (options.tier || "structure")
  });
  if (LINE_TIERS[options.tier] && LINE_TIERS[options.tier].dash !== "none") {
    el.setAttribute("stroke-dasharray", LINE_TIERS[options.tier].dash);
  }
  group.appendChild(el);
  return el;
}

function shadowEllipse(group, cx, cy, rx, ry, fill, opacity) {
  add(group, "ellipse", {
    cx: cx.toFixed(1), cy: cy.toFixed(1),
    rx: rx.toFixed(1), ry: ry.toFixed(1),
    fill: fill || PALETTE.night,
    opacity: (opacity || 0.15).toFixed(2),
    stroke: "none",
    "data-shadow": "contact"
  });
}

function buildQuality(entity, quality) {
  return (quality === "full") ? "full" : "base";
}

// ==================== ENTITY TEMPLATES ====================

function renderPerson(entity, quality, namespace) {
  const { width: w, height: h, params = {} } = entity;
  const color = params.color || PALETTE.deepBlue;
  const accent = params.accent || PALETTE.warm;
  const variant = params.variant || "neutral";
  const pose = params.pose || "standing";
  const isFull = quality === "full";
  const rng = createRNG(entity.id, "person");
  const ns = namespace || "canvas";
  const group = node("g", { "data-template": "person", "data-art-style": "storybook-layered" });
  const ink = PALETTE.ink;
  const sw = Math.max(1.8, Math.min(w, h) * 0.016);

  // Shadow
  shadowEllipse(group, w * 0.5, h * 0.96, w * 0.3, h * 0.025, PALETTE.night, 0.18);

  // Legs
  const legPoints = pose === "walking"
    ? [[w * 0.44, h * 0.68], [w * 0.36, h * 0.94], [w * 0.4, h * 0.96],
       [w * 0.54, h * 0.68], [w * 0.66, h * 0.94], [w * 0.7, h * 0.96]]
    : [[w * 0.44, h * 0.7], [w * 0.40, h * 0.94], [w * 0.42, h * 0.95],
       [w * 0.56, h * 0.7], [w * 0.60, h * 0.94], [w * 0.58, h * 0.95]];

  penLineToGroup(group, legPoints.slice(0, 3), { tier: "outline", baseWidth: sw, stroke: ink, rng });
  penLineToGroup(group, legPoints.slice(3), { tier: "outline", baseWidth: sw, stroke: ink, rng });

  // Feet
  const isWoman = variant === "woman";
  const lfx = pose === "walking" ? w * 0.30 : w * 0.36;
  const rfx = pose === "walking" ? w * 0.72 : w * 0.60;
  penLineToGroup(group, [[lfx - w * 0.04, h * 0.96], [lfx + w * 0.06, h * 0.96], [lfx + w * 0.08, h * 0.94]],
    { tier: "outline", baseWidth: sw * 1.2, stroke: PALETTE.deepInk, rng });
  penLineToGroup(group, [[rfx - w * 0.04, h * 0.96], [rfx + w * 0.06, h * 0.96], [rfx + w * 0.08, h * 0.94]],
    { tier: "outline", baseWidth: sw * 1.2, stroke: PALETTE.deepInk, rng });

  // Body / torso
  const bodyPath = isWoman
    ? [[w * 0.35, h * 0.35], [w * 0.30, h * 0.50], [w * 0.28, h * 0.68],
       [w * 0.72, h * 0.68], [w * 0.70, h * 0.50], [w * 0.65, h * 0.35]]
    : [[w * 0.38, h * 0.32], [w * 0.34, h * 0.50], [w * 0.36, h * 0.68],
       [w * 0.64, h * 0.68], [w * 0.66, h * 0.50], [w * 0.62, h * 0.32]];

  // Body fill
  add(group, "path", {
    d: `M${bodyPath.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")} Z`,
    fill: `url(#${namespaceId(ns, `grad-${entity.id}`)})`,
    stroke: "none",
    "data-color-block": "body"
  });

  penLineToGroup(group, bodyPath.concat([bodyPath[0]]), {
    tier: "outline", baseWidth: sw, stroke: ink, rng, closed: true
  });

  // Belt / waist line
  if (isFull) {
    penLineToGroup(group, [[w * 0.35, h * 0.50], [w * 0.50, h * 0.51], [w * 0.65, h * 0.50]],
      { tier: "structure", baseWidth: sw * 0.8, stroke: accent, rng });
  }

  // Arms
  const armRelaxed = pose !== "walking";
  const lShoulderX = w * 0.34, lShoulderY = h * 0.38;
  const rShoulderX = w * 0.66, rShoulderY = h * 0.38;
  const lElbowX = armRelaxed ? w * 0.20 : w * 0.28, lElbowY = armRelaxed ? h * 0.52 : h * 0.46;
  const lHandX = armRelaxed ? w * 0.16 : w * 0.22, lHandY = armRelaxed ? h * 0.66 : h * 0.60;
  const rElbowX = armRelaxed ? w * 0.80 : w * 0.72, rElbowY = armRelaxed ? h * 0.52 : h * 0.46;
  const rHandX = armRelaxed ? w * 0.84 : w * 0.78, rHandY = armRelaxed ? h * 0.66 : h * 0.60;

  penLineToGroup(group, [[lShoulderX, lShoulderY], [lElbowX, lElbowY], [lHandX, lHandY]],
    { tier: "outline", baseWidth: sw * 0.75, stroke: ink, rng });
  penLineToGroup(group, [[rShoulderX, rShoulderY], [rElbowX, rElbowY], [rHandX, rHandY]],
    { tier: "outline", baseWidth: sw * 0.75, stroke: ink, rng });

  if (isFull) {
    // Arm structure lines
    penLineToGroup(group, [[lElbowX, lElbowY - h * 0.02], [lElbowX, lElbowY + h * 0.02]],
      { tier: "structure", baseWidth: sw * 0.45, stroke: PALETTE.deepInk, rng });
    penLineToGroup(group, [[rElbowX, rElbowY - h * 0.02], [rElbowX, rElbowY + h * 0.02]],
      { tier: "structure", baseWidth: sw * 0.45, stroke: PALETTE.deepInk, rng });
  }

  // Head
  add(group, "ellipse", {
    cx: (w * 0.5).toFixed(1), cy: (h * 0.20).toFixed(1),
    rx: (w * 0.11).toFixed(1), ry: (h * 0.11).toFixed(1),
    fill: PALETTE.skin, stroke: ink, "stroke-width": sw.toFixed(2)
  });

  // Hair
  const hairColor = variant === "woman" ? PALETTE.deepInk : shade(PALETTE.deepInk, -10);
  const hairPath = isWoman
    ? [[w * 0.37, h * 0.18], [w * 0.36, h * 0.10], [w * 0.45, h * 0.06],
       [w * 0.55, h * 0.06], [w * 0.64, h * 0.10], [w * 0.63, h * 0.18],
       [w * 0.60, h * 0.14], [w * 0.50, h * 0.12], [w * 0.40, h * 0.14]]
    : [[w * 0.38, h * 0.18], [w * 0.39, h * 0.12], [w * 0.46, h * 0.09],
       [w * 0.54, h * 0.09], [w * 0.62, h * 0.12], [w * 0.62, h * 0.18]];

  add(group, "path", {
    d: `M${hairPath.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" L")} Z`,
    fill: hairColor, stroke: ink, "stroke-width": sw.toFixed(2)
  });

  if (isFull) {
    // Facial features
    const faceLeft = w * 0.43, faceRight = w * 0.57, faceY = h * 0.21;
    penLineToGroup(group, [[faceLeft, faceY], [faceLeft + w * 0.015, faceY - h * 0.01]],
      { tier: "structure", baseWidth: sw * 0.5, stroke: ink, rng });
    penLineToGroup(group, [[faceRight, faceY], [faceRight - w * 0.015, faceY - h * 0.01]],
      { tier: "structure", baseWidth: sw * 0.5, stroke: ink, rng });
    // Mouth
    penLineToGroup(group, [[w * 0.48, h * 0.26], [w * 0.50, h * 0.265], [w * 0.52, h * 0.26]],
      { tier: "structure", baseWidth: sw * 0.4, stroke: PALETTE.rose, rng });
    // Hair detail
    repeat(group, isWoman ? 5 : 3, i => {
      penLineToGroup(group, [[w * (0.39 + i * 0.05), h * 0.12], [w * (0.40 + i * 0.05), h * 0.08]],
        { tier: "texture", baseWidth: sw * 0.35, stroke: hairColor, rng });
    });
  }

  // Skirt for woman variant
  if (isWoman) {
    const skirtTop = h * 0.50;
    add(group, "path", {
      d: `M${(w * 0.33).toFixed(1)} ${skirtTop.toFixed(1)} L${(w * 0.20).toFixed(1)} ${(h * 0.84).toFixed(1)} Q${(w * 0.50).toFixed(1)} ${(h * 0.92).toFixed(1)} ${(w * 0.80).toFixed(1)} ${(h * 0.84).toFixed(1)} L${(w * 0.67).toFixed(1)} ${skirtTop.toFixed(1)} Z`,
      fill: shade(color, 12), stroke: ink, "stroke-width": sw.toFixed(2)
    });
    if (isFull) {
      repeat(group, 6, i => {
        penLineToGroup(group, [[w * (0.25 + i * 0.09), skirtTop + h * 0.02], [w * (0.22 + i * 0.09), h * 0.82]],
          { tier: "texture", baseWidth: sw * 0.3, stroke: shade(color, -10), rng });
      });
    }
  }

  return group;
}

function renderCat(entity, quality, namespace) {
  const { width: w, height: h, params = {} } = entity;
  const color = params.color || PALETTE.warm;
  const accent = params.accent || PALETTE.rose;
  const pose = params.pose || "sitting";
  const isFull = quality === "full";
  const rng = createRNG(entity.id, "cat");
  const ns = namespace || "canvas";
  const group = node("g", { "data-template": "cat", "data-art-style": "storybook-layered" });
  const ink = PALETTE.ink;
  const sw = Math.max(1.8, Math.min(w, h) * 0.016);

  shadowEllipse(group, w * 0.48, h * 0.93, w * 0.38, h * 0.05);

  // Body
  add(group, "ellipse", {
    cx: (w * 0.46).toFixed(1), cy: (h * 0.63).toFixed(1),
    rx: (w * 0.33).toFixed(1), ry: (h * 0.26).toFixed(1),
    fill: `url(#${namespaceId(ns, `grad-${entity.id}`)})`, stroke: ink, "stroke-width": sw.toFixed(2)
  });

  // Head
  add(group, "circle", {
    cx: (w * 0.68).toFixed(1), cy: (h * 0.36).toFixed(1),
    r: (h * 0.21).toFixed(1),
    fill: shade(color, 15), stroke: ink, "stroke-width": sw.toFixed(2)
  });

  // Ears
  penLineToGroup(group, [[w * 0.58, h * 0.22], [w * 0.63, h * 0.02], [w * 0.70, h * 0.20]],
    { tier: "outline", baseWidth: sw, stroke: ink, rng });
  penLineToGroup(group, [[w * 0.76, h * 0.18], [w * 0.83, h * 0.02], [w * 0.86, h * 0.22]],
    { tier: "outline", baseWidth: sw, stroke: ink, rng });

  // Tail
  const tailCurve = isFull
    ? [[w * 0.20, h * 0.66], [w * 0.06, h * 0.52], [w * 0.01, h * 0.35], [w * 0.10, h * 0.22]]
    : [[w * 0.20, h * 0.66], [w * 0.08, h * 0.48], [w * 0.10, h * 0.28]];
  penLineToGroup(group, tailCurve, {
    tier: "outline", baseWidth: sw * 0.7, stroke: ink, rng
  });

  if (isFull) {
    // Face
    penLineToGroup(group, [[w * 0.62, h * 0.36], [w * 0.65, h * 0.37]],
      { tier: "structure", baseWidth: sw * 0.5, stroke: ink, rng });
    penLineToGroup(group, [[w * 0.74, h * 0.36], [w * 0.77, h * 0.37]],
      { tier: "structure", baseWidth: sw * 0.5, stroke: ink, rng });
    penLineToGroup(group, [[w * 0.68, h * 0.42], [w * 0.70, h * 0.44], [w * 0.73, h * 0.42]],
      { tier: "structure", baseWidth: sw * 0.4, stroke: PALETTE.rose, rng });
    // Whiskers
    const whiskerBase = [w * 0.68, h * 0.40];
    repeat(group, 6, i => {
      const a = -0.5 + i * 0.2;
      penLineToGroup(group, [whiskerBase, [whiskerBase[0] + Math.cos(a) * w * 0.18, whiskerBase[1] + Math.sin(a) * h * 0.04]],
        { tier: "texture", baseWidth: sw * 0.25, stroke: ink, rng });
    });
    // Fur texture
    repeat(group, 8, i => {
      const furX = w * (0.22 + i * 0.06), furY = h * (0.50 + (i % 3) * 0.06);
      penLineToGroup(group, [[furX, furY], [furX + w * 0.02, furY - h * 0.02]],
        { tier: "texture", baseWidth: sw * 0.2, stroke: shade(color, -10), rng });
    });
    // Stripe markings
    repeat(group, 4, i => {
      penLineToGroup(group, [[w * (0.28 + i * 0.08), h * 0.55], [w * (0.26 + i * 0.08), h * 0.60]],
        { tier: "structure", baseWidth: sw * 0.4, stroke: shade(color, -20), rng });
    });
  }

  return group;
}

function renderDog(entity, quality, namespace) {
  const { width: w, height: h, params = {} } = entity;
  const color = params.color || PALETTE.warm;
  const accent = params.accent || PALETTE.gold;
  const isFull = quality === "full";
  const rng = createRNG(entity.id, "dog");
  const ns = namespace || "canvas";
  const group = node("g", { "data-template": "dog", "data-art-style": "storybook-layered" });
  const ink = PALETTE.ink;
  const sw = Math.max(1.8, Math.min(w, h) * 0.016);

  shadowEllipse(group, w * 0.5, h * 0.94, w * 0.4, h * 0.05);

  // Body
  add(group, "ellipse", {
    cx: (w * 0.47).toFixed(1), cy: (h * 0.62).toFixed(1),
    rx: (w * 0.34).toFixed(1), ry: (h * 0.25).toFixed(1),
    fill: `url(#${namespaceId(ns, `grad-${entity.id}`)})`, stroke: ink, "stroke-width": sw.toFixed(2)
  });

  // Head
  add(group, "circle", {
    cx: (w * 0.72).toFixed(1), cy: (h * 0.40).toFixed(1),
    r: (h * 0.21).toFixed(1),
    fill: shade(color, 12), stroke: ink, "stroke-width": sw.toFixed(2)
  });

  // Snout
  add(group, "ellipse", {
    cx: (w * 0.82).toFixed(1), cy: (h * 0.46).toFixed(1),
    rx: (w * 0.10).toFixed(1), ry: (h * 0.08).toFixed(1),
    fill: shade(color, 5), stroke: ink, "stroke-width": sw.toFixed(2)
  });

  // Ears (floppy)
  penLineToGroup(group, [[w * 0.62, h * 0.28], [w * 0.52, h * 0.12], [w * 0.62, h * 0.20]],
    { tier: "outline", baseWidth: sw * 0.8, stroke: ink, rng });
  penLineToGroup(group, [[w * 0.78, h * 0.26], [w * 0.88, h * 0.10], [w * 0.84, h * 0.30]],
    { tier: "outline", baseWidth: sw * 0.8, stroke: ink, rng });

  // Legs
  penLineToGroup(group, [[w * 0.30, h * 0.72], [w * 0.26, h * 0.94]],
    { tier: "outline", baseWidth: sw * 1.1, stroke: PALETTE.deepInk, rng });
  penLineToGroup(group, [[w * 0.58, h * 0.72], [w * 0.63, h * 0.94]],
    { tier: "outline", baseWidth: sw * 1.1, stroke: PALETTE.deepInk, rng });

  // Tail
  penLineToGroup(group, [[w * 0.17, h * 0.56], [w * 0.04, h * 0.40], [w * 0.12, h * 0.26]],
    { tier: "outline", baseWidth: sw * 0.7, stroke: ink, rng });

  if (isFull) {
    // Eye
    add(group, "circle", { cx: (w * 0.83).toFixed(1), cy: (h * 0.42).toFixed(1), r: (sw * 0.6).toFixed(2), fill: PALETTE.deepInk, stroke: "none" });
    // Mouth line
    penLineToGroup(group, [[w * 0.80, h * 0.50], [w * 0.84, h * 0.48]],
      { tier: "structure", baseWidth: sw * 0.4, stroke: ink, rng });
    // Fur detail
    repeat(group, 6, i => {
      penLineToGroup(group, [[w * (0.28 + i * 0.07), h * 0.68], [w * (0.30 + i * 0.07), h * 0.72]],
        { tier: "texture", baseWidth: sw * 0.22, stroke: shade(color, -10), rng });
    });
    // Paw detail
    penLineToGroup(group, [[w * 0.22, h * 0.95], [w * 0.24, h * 0.93], [w * 0.27, h * 0.95]],
      { tier: "structure", baseWidth: sw * 0.3, stroke: PALETTE.deepInk, rng });
    penLineToGroup(group, [[w * 0.59, h * 0.95], [w * 0.61, h * 0.93], [w * 0.64, h * 0.95]],
      { tier: "structure", baseWidth: sw * 0.3, stroke: PALETTE.deepInk, rng });
  }

  return group;
}

function renderBird(entity, quality, namespace) {
  const { width: w, height: h, params = {} } = entity;
  const color = params.color || PALETTE.blue;
  const count = Math.max(1, Math.min(8, params.count || 3));
  const isFull = quality === "full";
  const rng = createRNG(entity.id, "bird");
  const ns = namespace || "canvas";
  const group = node("g", { "data-template": "bird", "data-art-style": "storybook-layered" });
  const ink = PALETTE.ink;
  const sw = Math.max(1.5, Math.min(w, h) * 0.015);

  repeat(group, count, index => {
    const x = w * (0.14 + (index % 4) * 0.23);
    const y = h * (0.25 + Math.floor(index / 4) * 0.38 + (index % 2) * 0.08);
    const size = Math.min(w, h) * (0.12 + (index % 3) * 0.02);

    // Wing arc
    penLineToGroup(group, [
      [x - size * 1.5, y],
      [x - size * 0.6, y - size * 0.8],
      [x + size * 0.2, y - size * 0.1],
      [x + size * 1.5, y],
      [x + size * 0.6, y + size * 0.3],
      [x - size * 0.1, y + size * 0.05]
    ], {
      tier: "outline", baseWidth: sw * 1.2, stroke: index % 2 ? color : shade(color, -15), rng: createRNG(entity.id, `bird-${index}`)
    });

    if (isFull) {
      // Wing feather details
      penLineToGroup(group, [
        [x - size * 0.5, y - size * 0.2],
        [x + size * 0.5, y - size * 0.3]
      ], {
        tier: "structure", baseWidth: sw * 0.4, stroke: shade(color, -20), rng: createRNG(entity.id, `bird-feather-${index}`)
      });
    }
  });

  return group;
}

function renderUmbrella(entity, quality, namespace) {
  const { width: w, height: h, params = {} } = entity;
  const color = params.color || PALETTE.rose;
  const accent = params.accent || PALETTE.gold;
  const isFull = quality === "full";
  const rng = createRNG(entity.id, "umbrella");
  const ns = namespace || "canvas";
  const group = node("g", { "data-template": "umbrella", "data-art-style": "storybook-layered" });
  const ink = PALETTE.ink;
  const sw = Math.max(1.8, Math.min(w, h) * 0.016);

  // Shadow disk
  shadowEllipse(group, w * 0.52, h * 0.48, w * 0.46, h * 0.07);

  // Canopy
  add(group, "path", {
    d: `M${(w * 0.05).toFixed(1)} ${(h * 0.48).toFixed(1)} Q${(w * 0.50).toFixed(1)} ${(-h * 0.04).toFixed(1)} ${(w * 0.95).toFixed(1)} ${(h * 0.48).toFixed(1)} Q${(w * 0.84).toFixed(1)} ${(h * 0.40).toFixed(1)} ${(w * 0.73).toFixed(1)} ${(h * 0.48).toFixed(1)} Q${(w * 0.61).toFixed(1)} ${(h * 0.38).toFixed(1)} ${(w * 0.50).toFixed(1)} ${(h * 0.48).toFixed(1)} Q${(w * 0.39).toFixed(1)} ${(h * 0.38).toFixed(1)} ${(w * 0.27).toFixed(1)} ${(h * 0.48).toFixed(1)} Q${(w * 0.16).toFixed(1)} ${(h * 0.40).toFixed(1)} ${(w * 0.05).toFixed(1)} ${(h * 0.48).toFixed(1)} Z`,
    fill: `url(#${namespaceId(ns, `grad-${entity.id}`)})`, stroke: ink, "stroke-width": sw.toFixed(2)
  });

  // Handle
  penLineToGroup(group, [[w * 0.50, h * 0.48], [w * 0.50, h * 0.88], [w * 0.50, h * 0.92], [w * 0.58, h * 0.90]],
    { tier: "outline", baseWidth: sw * 1.6, stroke: PALETTE.deepInk, rng });

  // Top tip
  add(group, "circle", {
    cx: (w * 0.50).toFixed(1), cy: (h * 0.03).toFixed(1),
    r: (sw * 1.4).toFixed(2), fill: accent, stroke: ink, "stroke-width": sw.toFixed(2)
  });

  if (isFull) {
    // Rib lines
    repeat(group, 7, i => {
      const x = w * (0.16 + i * 0.10);
      penLineToGroup(group, [[w * 0.50, h * 0.04], [x, h * 0.46]],
        { tier: "structure", baseWidth: sw * 0.45, stroke: shade(color, -15), rng });
    });
    // Handle grip
    penLineToGroup(group, [[w * 0.48, h * 0.84], [w * 0.52, h * 0.84]],
      { tier: "structure", baseWidth: sw * 0.5, stroke: accent, rng });
  }

  return group;
}

function renderStreetlamp(entity, quality, namespace) {
  const { width: w, height: h, params = {} } = entity;
  const color = params.color || PALETTE.night;
  const accent = params.accent || PALETTE.gold;
  const isFull = quality === "full";
  const rng = createRNG(entity.id, "lamp");
  const ns = namespace || "canvas";
  const group = node("g", { "data-template": "streetlamp", "data-art-style": "storybook-layered" });
  const ink = PALETTE.ink;
  const sw = Math.max(1.8, Math.min(w, h) * 0.017);

  // Light glow
  add(group, "ellipse", {
    cx: (w * 0.50).toFixed(1), cy: (h * 0.34).toFixed(1),
    rx: (w * 0.48).toFixed(1), ry: (h * 0.32).toFixed(1),
    fill: accent, opacity: "0.12", stroke: "none"
  });

  // Pole
  penLineToGroup(group, [[w * 0.50, h * 0.28], [w * 0.50, h * 0.92]],
    { tier: "outline", baseWidth: sw * 2.2, stroke: ink, rng });

  // Base
  penLineToGroup(group, [[w * 0.28, h * 0.95], [w * 0.50, h * 0.90], [w * 0.72, h * 0.95]],
    { tier: "outline", baseWidth: sw * 2.0, stroke: ink, rng });

  // Lamp housing
  add(group, "path", {
    d: `M${(w * 0.34).toFixed(1)} ${(h * 0.10).toFixed(1)} L${(w * 0.66).toFixed(1)} ${(h * 0.10).toFixed(1)} L${(w * 0.74).toFixed(1)} ${(h * 0.32).toFixed(1)} Q${(w * 0.50).toFixed(1)} ${(h * 0.40).toFixed(1)} ${(w * 0.26).toFixed(1)} ${(h * 0.32).toFixed(1)} Z`,
    fill: `url(#${namespaceId(ns, `grad-${entity.id}`)})`, stroke: ink, "stroke-width": sw.toFixed(2)
  });

  if (isFull) {
    // Cross braces
    penLineToGroup(group, [[w * 0.40, h * 0.16], [w * 0.60, h * 0.28]],
      { tier: "structure", baseWidth: sw * 0.5, stroke: shade(PALETTE.night, 20), rng });
    penLineToGroup(group, [[w * 0.60, h * 0.16], [w * 0.40, h * 0.28]],
      { tier: "structure", baseWidth: sw * 0.5, stroke: shade(PALETTE.night, 20), rng });
    // Light bulb indication
    add(group, "circle", {
      cx: (w * 0.50).toFixed(1), cy: (h * 0.34).toFixed(1),
      r: (sw * 1.5).toFixed(2), fill: PALETTE.cream, opacity: "0.9", stroke: "none"
    });
    // Pole texture
    penLineToGroup(group, [[w * 0.50, h * 0.45], [w * 0.50, h * 0.55]],
      { tier: "texture", baseWidth: sw * 0.3, stroke: shade(PALETTE.night, 30), rng });
    penLineToGroup(group, [[w * 0.50, h * 0.65], [w * 0.50, h * 0.75]],
      { tier: "texture", baseWidth: sw * 0.3, stroke: shade(PALETTE.night, 30), rng });
  }

  return group;
}

function renderRoof(entity, quality, namespace) {
  const { width: w, height: h, params = {} } = entity;
  const color = params.color || PALETTE.brick;
  const accent = params.accent || PALETTE.warm;
  const isFull = quality === "full";
  const rng = createRNG(entity.id, "roof");
  const ns = namespace || "canvas";
  const group = node("g", { "data-template": "roof", "data-art-style": "storybook-layered" });
  const ink = PALETTE.ink;
  const sw = Math.max(1.8, Math.min(w, h) * 0.016);

  // Main roof triangle
  add(group, "path", {
    d: `M${(-w * 0.03).toFixed(1)} ${(h * 0.74).toFixed(1)} L${(w * 0.50).toFixed(1)} ${(h * 0.08).toFixed(1)} L${(w * 1.03).toFixed(1)} ${(h * 0.74).toFixed(1)} Z`,
    fill: `url(#${namespaceId(ns, `grad-${entity.id}`)})`, stroke: ink, "stroke-width": sw.toFixed(2)
  });

  // Eaves overhang
  add(group, "rect", {
    x: (w * 0.20).toFixed(1), y: (h * 0.68).toFixed(1),
    width: (w * 0.60).toFixed(1), height: (h * 0.30).toFixed(1),
    rx: (sw * 2).toFixed(1), fill: accent, stroke: ink, "stroke-width": sw.toFixed(2)
  });

  if (isFull) {
    // Ridge line
    penLineToGroup(group, [[w * 0.02, h * 0.70], [w * 0.50, h * 0.14], [w * 0.98, h * 0.70]],
      { tier: "structure", baseWidth: sw * 1.2, stroke: shade(color, -20), rng });

    // Tile lines
    repeat(group, 6, i => {
      penLineToGroup(group, [[w * (0.10 + i * 0.13), h * 0.74], [w * 0.50, h * (0.20 + i * 0.06)]],
        { tier: "texture", baseWidth: sw * 0.3, stroke: shade(color, -10), rng });
    });

    // Window
    add(group, "rect", {
      x: (w * 0.44).toFixed(1), y: (h * 0.74).toFixed(1),
      width: (w * 0.12).toFixed(1), height: (h * 0.22).toFixed(1),
      fill: PALETTE.night, stroke: ink, "stroke-width": sw.toFixed(2)
    });

    // Side windows
    add(group, "rect", { x: (w * 0.26).toFixed(1), y: (h * 0.75).toFixed(1), width: (w * 0.10).toFixed(1), height: (h * 0.10).toFixed(1), fill: PALETTE.gold, stroke: ink, "stroke-width": sw.toFixed(2) });
    add(group, "rect", { x: (w * 0.64).toFixed(1), y: (h * 0.75).toFixed(1), width: (w * 0.10).toFixed(1), height: (h * 0.10).toFixed(1), fill: PALETTE.gold, stroke: ink, "stroke-width": sw.toFixed(2) });
  }

  return group;
}

function renderHouse(entity, quality, namespace) {
  const { width: w, height: h, params = {} } = entity;
  const color = params.color || PALETTE.warm;
  const accent = params.accent || PALETTE.brick;
  const isFull = quality === "full";
  const rng = createRNG(entity.id, "house");
  const ns = namespace || "canvas";
  const group = node("g", { "data-template": "house", "data-art-style": "storybook-layered" });
  const ink = PALETTE.ink;
  const sw = Math.max(1.8, Math.min(w, h) * 0.016);

  shadowEllipse(group, w * 0.50, h * 0.97, w * 0.46, h * 0.035);

  // Walls
  add(group, "rect", {
    x: (w * 0.18).toFixed(1), y: (h * 0.44).toFixed(1),
    width: (w * 0.64).toFixed(1), height: (h * 0.50).toFixed(1),
    rx: (sw * 2).toFixed(1), fill: accent, stroke: ink, "stroke-width": sw.toFixed(2)
  });

  // Roof
  add(group, "path", {
    d: `M${(w * 0.08).toFixed(1)} ${(h * 0.48).toFixed(1)} L${(w * 0.50).toFixed(1)} ${(h * 0.10).toFixed(1)} L${(w * 0.92).toFixed(1)} ${(h * 0.48).toFixed(1)} Z`,
    fill: `url(#${namespaceId(ns, `grad-${entity.id}`)})`, stroke: ink, "stroke-width": sw.toFixed(2)
  });

  // Door
  add(group, "rect", {
    x: (w * 0.43).toFixed(1), y: (h * 0.64).toFixed(1),
    width: (w * 0.14).toFixed(1), height: (h * 0.30).toFixed(1),
    rx: sw.toFixed(1), fill: shade(color, -15), stroke: ink, "stroke-width": sw.toFixed(2)
  });

  if (isFull) {
    // Windows
    repeat(group, 2, i => {
      add(group, "rect", { x: (w * (0.24 + i * 0.42)).toFixed(1), y: (h * 0.58).toFixed(1), width: (w * 0.12).toFixed(1), height: (h * 0.14).toFixed(1), fill: PALETTE.gold, stroke: ink, "stroke-width": sw.toFixed(2) });
      // Window cross
      penLineToGroup(group, [[w * (0.30 + i * 0.42), h * 0.58], [w * (0.30 + i * 0.42), h * 0.72]],
        { tier: "structure", baseWidth: sw * 0.4, stroke: PALETTE.night, rng });
      penLineToGroup(group, [[w * (0.24 + i * 0.42), h * 0.65], [w * (0.36 + i * 0.42), h * 0.65]],
        { tier: "structure", baseWidth: sw * 0.4, stroke: PALETTE.night, rng });
    });

    // Chimney
    add(group, "rect", { x: (w * 0.68).toFixed(1), y: (h * 0.16).toFixed(1), width: (w * 0.09).toFixed(1), height: (h * 0.22).toFixed(1), fill: shade(color, -20), stroke: ink, "stroke-width": sw.toFixed(2) });

    // Wall texture
    repeat(group, 5, i => {
      penLineToGroup(group, [[w * (0.22 + i * 0.11), h * 0.76], [w * (0.24 + i * 0.11), h * 0.70]],
        { tier: "texture", baseWidth: sw * 0.2, stroke: shade(accent, -15), rng });
    });

    // Door knob
    add(group, "circle", { cx: (w * 0.53).toFixed(1), cy: (h * 0.80).toFixed(1), r: (sw * 0.6).toFixed(2), fill: PALETTE.gold, stroke: "none" });
  }

  return group;
}

function renderBridge(entity, quality, namespace) {
  const { width: w, height: h, params = {} } = entity;
  const color = params.color || PALETTE.stone;
  const accent = params.accent || PALETTE.warm;
  const isFull = quality === "full";
  const rng = createRNG(entity.id, "bridge");
  const ns = namespace || "canvas";
  const group = node("g", { "data-template": "bridge", "data-art-style": "storybook-layered" });
  const ink = PALETTE.ink;
  const sw = Math.max(1.8, Math.min(w, h) * 0.016);

  // Arch body
  add(group, "path", {
    d: `M0 ${(h * 0.82).toFixed(1)} Q${(w * 0.50).toFixed(1)} ${(h * 0.14).toFixed(1)} ${w} ${(h * 0.82).toFixed(1)} L${w} ${h} L0 ${h} Z`,
    fill: `url(#${namespaceId(ns, `grad-${entity.id}`)})`, stroke: ink, "stroke-width": sw.toFixed(2)
  });

  // Road surface
  add(group, "path", {
    d: `M${(w * 0.18).toFixed(1)} ${(h * 0.84).toFixed(1)} Q${(w * 0.50).toFixed(1)} ${(h * 0.34).toFixed(1)} ${(w * 0.82).toFixed(1)} ${(h * 0.84).toFixed(1)} L${(w * 0.72).toFixed(1)} ${(h * 0.84).toFixed(1)} Q${(w * 0.50).toFixed(1)} ${(h * 0.52).toFixed(1)} ${(w * 0.28).toFixed(1)} ${(h * 0.84).toFixed(1)} Z`,
    fill: PALETTE.paper, stroke: ink, "stroke-width": sw.toFixed(2)
  });

  if (isFull) {
    // Guard rail
    penLineToGroup(group, [[w * 0.10, h * 0.60], [w * 0.50, h * 0.08], [w * 0.90, h * 0.60]],
      { tier: "structure", baseWidth: sw * 1.4, stroke: accent, rng });

    // Support cables/struts
    repeat(group, 7, i => {
      penLineToGroup(group, [[w * (0.14 + i * 0.11), h * (0.53 - Math.abs(3 - i) * 0.08)],
        [w * (0.14 + i * 0.11), h * (0.66 - Math.abs(3 - i) * 0.04)]],
        { tier: "structure", baseWidth: sw * 0.7, stroke: ink, rng });
    });

    // Stone texture
    repeat(group, 10, i => {
      const bx = w * (0.05 + i * 0.09), by = h * (0.70 + (i % 3) * 0.06);
      penLineToGroup(group, [[bx, by], [bx + w * 0.04, by - h * 0.01]],
        { tier: "texture", baseWidth: sw * 0.2, stroke: shade(color, -10), rng });
    });

    // Water reflection hint
    add(group, "path", {
      d: `M0 ${(h * 0.90).toFixed(1)} Q${(w * 0.25).toFixed(1)} ${(h * 0.86).toFixed(1)} ${(w * 0.50).toFixed(1)} ${(h * 0.90).toFixed(1)} Q${(w * 0.75).toFixed(1)} ${(h * 0.94).toFixed(1)} ${w} ${(h * 0.90).toFixed(1)}`,
      fill: "none", stroke: PALETTE.waterLight, opacity: "0.5", "stroke-width": sw.toFixed(2), "data-line-tier": "atmosphere"
    });
  }

  return group;
}

function renderBoat(entity, quality, namespace) {
  const { width: w, height: h, params = {} } = entity;
  const color = params.color || PALETTE.wood;
  const accent = params.accent || PALETTE.cream;
  const isFull = quality === "full";
  const rng = createRNG(entity.id, "boat");
  const ns = namespace || "canvas";
  const group = node("g", { "data-template": "boat", "data-art-style": "storybook-layered" });
  const ink = PALETTE.ink;
  const sw = Math.max(1.8, Math.min(w, h) * 0.016);

  shadowEllipse(group, w * 0.50, h * 0.88, w * 0.48, h * 0.07);

  // Hull
  add(group, "path", {
    d: `M${(w * 0.10).toFixed(1)} ${(h * 0.64).toFixed(1)} Q${(w * 0.50).toFixed(1)} ${(h * 0.86).toFixed(1)} ${(w * 0.90).toFixed(1)} ${(h * 0.64).toFixed(1)} Q${(w * 0.78).toFixed(1)} ${(h * 0.96).toFixed(1)} ${(w * 0.26).toFixed(1)} ${(h * 0.94).toFixed(1)} Z`,
    fill: `url(#${namespaceId(ns, `grad-${entity.id}`)})`, stroke: ink, "stroke-width": sw.toFixed(2)
  });

  // Mast
  penLineToGroup(group, [[w * 0.50, h * 0.16], [w * 0.50, h * 0.70]],
    { tier: "outline", baseWidth: sw * 1.5, stroke: ink, rng });

  // Sail
  add(group, "path", {
    d: `M${(w * 0.50).toFixed(1)} ${(h * 0.18).toFixed(1)} L${(w * 0.50).toFixed(1)} ${(h * 0.60).toFixed(1)} L${(w * 0.18).toFixed(1)} ${(h * 0.54).toFixed(1)} Z`,
    fill: accent, stroke: ink, "stroke-width": sw.toFixed(2)
  });
  add(group, "path", {
    d: `M${(w * 0.50).toFixed(1)} ${(h * 0.22).toFixed(1)} L${(w * 0.80).toFixed(1)} ${(h * 0.56).toFixed(1)} L${(w * 0.50).toFixed(1)} ${(h * 0.60).toFixed(1)} Z`,
    fill: shade(color, 15), stroke: ink, "stroke-width": sw.toFixed(2)
  });

  if (isFull) {
    // Sail fabric lines
    repeat(group, 4, i => {
      penLineToGroup(group, [[w * (0.42 - i * 0.06), h * (0.28 + i * 0.07)], [w * (0.22 + i * 0.04), h * (0.54 + i * 0.01)]],
        { tier: "texture", baseWidth: sw * 0.25, stroke: shade(accent, -10), rng });
    });
    // Hull planking
    repeat(group, 5, i => {
      penLineToGroup(group, [[w * (0.15 + i * 0.12), h * 0.78], [w * (0.20 + i * 0.12), h * 0.72]],
        { tier: "texture", baseWidth: sw * 0.22, stroke: shade(color, -15), rng });
    });
    // Flag
    penLineToGroup(group, [[w * 0.50, h * 0.16], [w * 0.56, h * 0.12], [w * 0.50, h * 0.18]],
      { tier: "structure", baseWidth: sw * 0.4, stroke: PALETTE.rose, rng });
  }

  return group;
}

function renderBench(entity, quality, namespace) {
  const { width: w, height: h, params = {} } = entity;
  const color = params.color || PALETTE.wood;
  const accent = params.accent || PALETTE.moss;
  const isFull = quality === "full";
  const rng = createRNG(entity.id, "bench");
  const ns = namespace || "canvas";
  const group = node("g", { "data-template": "bench", "data-art-style": "storybook-layered" });
  const ink = PALETTE.ink;
  const sw = Math.max(1.8, Math.min(w, h) * 0.016);

  shadowEllipse(group, w * 0.50, h * 0.92, w * 0.46, h * 0.05);

  // Back slats
  repeat(group, 3, i => {
    add(group, "rect", {
      x: (w * 0.12).toFixed(1), y: (h * (0.24 + i * 0.14)).toFixed(1),
      width: (w * 0.76).toFixed(1), height: (h * 0.09).toFixed(1),
      rx: (sw * 2).toFixed(1), fill: i % 2 ? color : shade(color, 15), stroke: ink, "stroke-width": sw.toFixed(2)
    });
  });

  // Seat
  add(group, "rect", {
    x: (w * 0.10).toFixed(1), y: (h * 0.68).toFixed(1),
    width: (w * 0.80).toFixed(1), height: (h * 0.11).toFixed(1),
    rx: (sw * 2).toFixed(1), fill: color, stroke: ink, "stroke-width": sw.toFixed(2)
  });

  // Legs
  penLineToGroup(group, [[w * 0.20, h * 0.76], [w * 0.16, h * 0.94]],
    { tier: "outline", baseWidth: sw * 1.6, stroke: PALETTE.deepInk, rng });
  penLineToGroup(group, [[w * 0.80, h * 0.76], [w * 0.84, h * 0.94]],
    { tier: "outline", baseWidth: sw * 1.6, stroke: PALETTE.deepInk, rng });

  // Side supports
  penLineToGroup(group, [[w * 0.18, h * 0.28], [w * 0.20, h * 0.72]],
    { tier: "outline", baseWidth: sw * 1.3, stroke: ink, rng });
  penLineToGroup(group, [[w * 0.82, h * 0.28], [w * 0.80, h * 0.72]],
    { tier: "outline", baseWidth: sw * 1.3, stroke: ink, rng });

  if (isFull) {
    // Wood grain
    repeat(group, 8, i => {
      const gx = w * (0.14 + i * 0.08);
      penLineToGroup(group, [[gx, h * 0.70], [gx + w * 0.02, h * 0.71]],
        { tier: "texture", baseWidth: sw * 0.18, stroke: shade(color, -10), rng });
    });
  }

  return group;
}

function renderBicycle(entity, quality, namespace) {
  const { width: w, height: h, params = {} } = entity;
  const color = params.color || PALETTE.blue;
  const accent = params.accent || PALETTE.warm;
  const isFull = quality === "full";
  const rng = createRNG(entity.id, "bicycle");
  const ns = namespace || "canvas";
  const group = node("g", { "data-template": "bicycle", "data-art-style": "storybook-layered" });
  const ink = PALETTE.ink;
  const sw = Math.max(1.8, Math.min(w, h) * 0.016);

  shadowEllipse(group, w * 0.50, h * 0.91, w * 0.48, h * 0.04);

  // Wheels
  const wheelR = Math.min(w, h) * 0.20;
  add(group, "circle", { cx: (w * 0.24).toFixed(1), cy: (h * 0.69).toFixed(1), r: wheelR.toFixed(1), fill: "none", stroke: ink, "stroke-width": (sw * 1.4).toFixed(2) });
  add(group, "circle", { cx: (w * 0.76).toFixed(1), cy: (h * 0.69).toFixed(1), r: wheelR.toFixed(1), fill: "none", stroke: ink, "stroke-width": (sw * 1.4).toFixed(2) });

  // Frame
  penLineToGroup(group, [[w * 0.24, h * 0.69], [w * 0.44, h * 0.38], [w * 0.58, h * 0.69]],
    { tier: "outline", baseWidth: sw * 1.8, stroke: color, rng });
  penLineToGroup(group, [[w * 0.44, h * 0.38], [w * 0.70, h * 0.38], [w * 0.76, h * 0.69]],
    { tier: "outline", baseWidth: sw * 1.8, stroke: color, rng });

  // Handlebars
  penLineToGroup(group, [[w * 0.38, h * 0.34], [w * 0.52, h * 0.34]],
    { tier: "outline", baseWidth: sw * 1.2, stroke: ink, rng });
  penLineToGroup(group, [[w * 0.74, h * 0.28], [w * 0.82, h * 0.28]],
    { tier: "outline", baseWidth: sw * 1.2, stroke: ink, rng });
  penLineToGroup(group, [[w * 0.70, h * 0.38], [w * 0.74, h * 0.28]],
    { tier: "outline", baseWidth: sw * 1.0, stroke: ink, rng });

  // Axle
  add(group, "circle", { cx: (w * 0.58).toFixed(1), cy: (h * 0.69).toFixed(1), r: (sw * 2).toFixed(2), fill: accent, stroke: ink, "stroke-width": sw.toFixed(2) });

  if (isFull) {
    // Spokes
    repeat(group, 16, i => {
      const a = i * Math.PI / 8;
      const cx = i < 8 ? w * 0.24 : w * 0.76;
      const cy = h * 0.69;
      penLineToGroup(group, [[cx, cy], [cx + Math.cos(a) * wheelR * 0.92, cy + Math.sin(a) * wheelR * 0.92]],
        { tier: "texture", baseWidth: sw * 0.18, stroke: ink, rng });
    });
    // Seat
    add(group, "ellipse", { cx: (w * 0.44).toFixed(1), cy: (h * 0.34).toFixed(1), rx: (w * 0.06).toFixed(1), ry: (h * 0.03).toFixed(1), fill: PALETTE.deepInk, stroke: ink, "stroke-width": sw.toFixed(2) });
  }

  return group;
}

function renderFence(entity, quality, namespace) {
  const { width: w, height: h, params = {} } = entity;
  const color = params.color || PALETTE.wood;
  const accent = params.accent || PALETTE.moss;
  const density = params.density || 0.5;
  const count = Math.max(4, Math.round(5 + density * 5));
  const isFull = quality === "full";
  const rng = createRNG(entity.id, "fence");
  const ns = namespace || "canvas";
  const group = node("g", { "data-template": "fence", "data-art-style": "storybook-layered" });
  const ink = PALETTE.ink;
  const sw = Math.max(1.8, Math.min(w, h) * 0.016);

  // Pickets
  repeat(group, count, i => {
    const x = i * w / (count - 1);
    const pW = w * 0.05;
    add(group, "path", {
      d: `M${x.toFixed(1)} ${(h * 0.94).toFixed(1)} L${x.toFixed(1)} ${(h * 0.20).toFixed(1)} L${(x + pW * 0.5).toFixed(1)} ${(h * 0.10).toFixed(1)} L${(x + pW).toFixed(1)} ${(h * 0.20).toFixed(1)} L${(x + pW).toFixed(1)} ${(h * 0.94).toFixed(1)} Z`,
      fill: i % 2 ? color : shade(color, 12), stroke: ink, "stroke-width": sw.toFixed(2)
    });
  });

  // Horizontal rails
  add(group, "rect", { x: "0", y: (h * 0.44).toFixed(1), width: w.toString(), height: (h * 0.10).toFixed(1), fill: accent, stroke: ink, "stroke-width": sw.toFixed(2) });
  add(group, "rect", { x: "0", y: (h * 0.74).toFixed(1), width: w.toString(), height: (h * 0.10).toFixed(1), fill: accent, stroke: ink, "stroke-width": sw.toFixed(2) });

  if (isFull) {
    // Wood grain on pickets
    repeat(group, count, i => {
      const x = i * w / count;
      penLineToGroup(group, [[x + w * 0.01, h * 0.50], [x + w * 0.02, h * 0.40]],
        { tier: "texture", baseWidth: sw * 0.15, stroke: shade(color, -10), rng });
    });
  }

  return group;
}

function renderBuildings(entity, quality, namespace) {
  const { width: w, height: h, params = {} } = entity;
  const color = params.color || PALETTE.moss;
  const accent = params.accent || PALETTE.night;
  const isFull = quality === "full";
  const rng = createRNG(entity.id, "buildings");
  const ns = namespace || "canvas";
  const group = node("g", { "data-template": "buildings", "data-art-style": "storybook-layered" });
  const ink = PALETTE.ink;
  const sw = Math.max(1.6, Math.min(w, h) * 0.014);

  repeat(group, 6, i => {
    const x = i * w / 6;
    const top = h * (0.14 + (i % 3) * 0.10);
    const bw = w * 0.18;

    // Building body
    add(group, "rect", {
      x: x.toFixed(1), y: top.toFixed(1),
      width: bw.toFixed(1), height: (h - top).toFixed(1),
      rx: sw.toFixed(1),
      fill: i % 2 ? color : shade(color, -10),
      stroke: ink, "stroke-width": sw.toFixed(2)
    });

    if (isFull) {
      // Windows - left column
      repeat(group, 3, row => {
        add(group, "rect", {
          x: (x + bw * 0.22).toFixed(1), y: (top + h * 0.12 + row * h * 0.18).toFixed(1),
          width: (bw * 0.20).toFixed(1), height: (h * 0.08).toFixed(1),
          fill: (i + row) % 3 ? PALETTE.gold : PALETTE.night,
          opacity: "0.8", stroke: "none"
        });
      });

      // Windows - right column
      repeat(group, 3, row => {
        add(group, "rect", {
          x: (x + bw * 0.58).toFixed(1), y: (top + h * 0.12 + row * h * 0.18).toFixed(1),
          width: (bw * 0.20).toFixed(1), height: (h * 0.08).toFixed(1),
          fill: (i + row) % 2 ? PALETTE.gold : PALETTE.night,
          opacity: "0.7", stroke: "none"
        });
      });

      // Roof line detail
      penLineToGroup(group, [[x + bw * 0.1, top], [x + bw * 0.5, top - h * 0.04], [x + bw * 0.9, top]],
        { tier: "structure", baseWidth: sw * 0.7, stroke: ink, rng });
    }
  });

  return group;
}

function renderRain(entity, quality, namespace) {
  const { width: w, height: h, params = {} } = entity;
  const color = params.color || PALETTE.blue;
  const density = params.density || 0.5;
  const count = Math.max(5, Math.round(8 + density * 22));
  const isFull = quality === "full";
  const rng = createRNG(entity.id, "rain");
  const group = node("g", { "data-template": "rain", "data-art-style": "storybook-layered" });
  const sw = Math.max(1.2, Math.min(w, h) * 0.012);

  // Rain streaks
  repeat(group, count, i => {
    const x = (i * 47) % w;
    const y = (i * 71) % h;
    const length = h * (0.04 + (i % 4) * 0.01);

    penLineToGroup(group, [[x, y], [x - w * 0.015, y + length]], {
      tier: i % 3 === 0 ? "structure" : "texture",
      baseWidth: sw * (0.55 + (i % 3) * 0.22),
      stroke: i % 3 ? color : shade(color, 15),
      opacity: 0.48 + (i % 4) * 0.12,
      rng: createRNG(entity.id, `rain-${i}`)
    });
  });

  if (isFull) {
    // Splash ripples on ground
    repeat(group, Math.max(2, Math.round(count / 7)), i => {
      const sx = (i * 173 + w * 0.12) % w;
      const sy = h * (0.84 + (i % 3) * 0.04);
      add(group, "path", {
        d: `M${sx.toFixed(1)} ${sy.toFixed(1)} q${(w * 0.025).toFixed(1)} ${(-h * 0.025).toFixed(1)} ${(w * 0.05).toFixed(1)} 0`,
        fill: "none", stroke: shade(color, 15), opacity: "0.65", "stroke-width": sw.toFixed(2),
        "stroke-linecap": "round", "data-line-tier": "atmosphere"
      });
      // Puddle hint
      penLineToGroup(group, [[sx + w * 0.03, sy], [sx + w * 0.03, sy - h * 0.03]], {
        tier: "atmosphere", baseWidth: sw * 0.4, stroke: color, opacity: 0.4, rng: createRNG(entity.id, `splash-${i}`)
      });
    });
  }

  return group;
}

function renderCloud(entity, quality, namespace) {
  const { width: w, height: h, params = {} } = entity;
  const color = params.color || PALETTE.blue;
  const isFull = quality === "full";
  const rng = createRNG(entity.id, "cloud");
  const ns = namespace || "canvas";
  const group = node("g", { "data-template": "cloud", "data-art-style": "storybook-layered" });
  const ink = PALETTE.ink;
  const sw = Math.max(1.8, Math.min(w, h) * 0.016);

  // Underside shadow
  add(group, "ellipse", {
    cx: (w * 0.50).toFixed(1), cy: (h * 0.78).toFixed(1),
    rx: (w * 0.44).toFixed(1), ry: (h * 0.14).toFixed(1),
    fill: shade(color, -30), opacity: "0.22", stroke: "none"
  });

  // Cloud puffs
  repeat(group, 5, i => {
    add(group, "circle", {
      cx: (w * (0.18 + i * 0.17)).toFixed(1),
      cy: (h * (0.62 - (i % 3) * 0.10)).toFixed(1),
      r: (h * (0.22 + (i % 2) * 0.04)).toFixed(1),
      fill: i % 2 ? color : shade(color, 10),
      stroke: ink, "stroke-width": sw.toFixed(2)
    });
  });

  // Base connecting line
  penLineToGroup(group, [[w * 0.12, h * 0.70], [w * 0.35, h * 0.66], [w * 0.55, h * 0.72], [w * 0.75, h * 0.68], [w * 0.90, h * 0.70]], {
    tier: "structure", baseWidth: sw * 0.7, stroke: shade(color, -20), rng
  });

  if (isFull) {
    // Fluff detail
    repeat(group, 8, i => {
      penLineToGroup(group, [
        [w * (0.15 + i * 0.09), h * (0.48 + (i % 2) * 0.08)],
        [w * (0.18 + i * 0.09), h * (0.42 + (i % 2) * 0.06)]
      ], { tier: "texture", baseWidth: sw * 0.25, stroke: shade(color, 5), rng });
    });
  }

  return group;
}

function renderSun(entity, quality, namespace) {
  const { width: w, height: h, params = {} } = entity;
  const color = params.color || PALETTE.gold;
  const isFull = quality === "full";
  const rng = createRNG(entity.id, "sun");
  const ns = namespace || "canvas";
  const group = node("g", { "data-template": "sun", "data-art-style": "storybook-layered" });
  const ink = PALETTE.ink;
  const sw = Math.max(1.8, Math.min(w, h) * 0.016);
  const r = Math.min(w, h) * 0.34;

  // Outer glow
  add(group, "circle", {
    cx: (w * 0.50).toFixed(1), cy: (h * 0.50).toFixed(1),
    r: (Math.min(w, h) * 0.49).toFixed(1),
    fill: color, opacity: "0.14", stroke: "none"
  });

  // Sun body
  add(group, "circle", {
    cx: (w * 0.50).toFixed(1), cy: (h * 0.50).toFixed(1),
    r: r.toFixed(1),
    fill: `url(#${namespaceId(ns, `grad-${entity.id}`)})`, stroke: ink, "stroke-width": sw.toFixed(2)
  });

  // Rays
  repeat(group, 10, i => {
    const a = i * Math.PI / 5;
    const outerR = r * 1.32;
    const innerR = r * 1.05;
    penLineToGroup(group, [
      [w * 0.50 + Math.cos(a) * innerR, h * 0.50 + Math.sin(a) * innerR],
      [w * 0.50 + Math.cos(a) * outerR, h * 0.50 + Math.sin(a) * outerR]
    ], {
      tier: "structure", baseWidth: sw * 1.2, stroke: shade(color, -10), rng: createRNG(entity.id, `ray-${i}`)
    });
  });

  return group;
}

function renderMoon(entity, quality, namespace) {
  const { width: w, height: h, params = {} } = entity;
  const color = params.color || PALETTE.gold;
  const isFull = quality === "full";
  const rng = createRNG(entity.id, "moon");
  const ns = namespace || "canvas";
  const group = node("g", { "data-template": "moon", "data-art-style": "storybook-layered" });
  const ink = PALETTE.ink;
  const sw = Math.max(1.8, Math.min(w, h) * 0.016);
  const r = Math.min(w, h) * 0.34;

  // Outer glow
  add(group, "circle", {
    cx: (w * 0.50).toFixed(1), cy: (h * 0.50).toFixed(1),
    r: (Math.min(w, h) * 0.49).toFixed(1),
    fill: color, opacity: "0.16", stroke: "none"
  });

  // Moon body
  add(group, "circle", {
    cx: (w * 0.50).toFixed(1), cy: (h * 0.50).toFixed(1),
    r: r.toFixed(1),
    fill: `url(#${namespaceId(ns, `grad-${entity.id}`)})`, stroke: ink, "stroke-width": sw.toFixed(2)
  });

  // Crescent shadow
  add(group, "circle", {
    cx: (w * 0.66).toFixed(1), cy: (h * 0.38).toFixed(1),
    r: (r * 0.95).toFixed(1),
    fill: PALETTE.paper, stroke: "none"
  });

  if (isFull) {
    // Surface craters
    add(group, "circle", { cx: (w * 0.38).toFixed(1), cy: (h * 0.44).toFixed(1), r: (r * 0.14).toFixed(1), fill: shade(color, -15), opacity: "0.25", stroke: "none" });
    add(group, "circle", { cx: (w * 0.40).toFixed(1), cy: (h * 0.58).toFixed(1), r: (r * 0.08).toFixed(1), fill: shade(color, -15), opacity: "0.20", stroke: "none" });
  }

  return group;
}

function renderStars(entity, quality, namespace) {
  const { width: w, height: h, params = {} } = entity;
  const color = params.color || PALETTE.gold;
  const count = Math.max(3, Math.min(30, params.count || Math.round(6 + (params.density || 0.5) * 18)));
  const rng = createRNG(entity.id, "stars");
  const group = node("g", { "data-template": "stars", "data-art-style": "storybook-layered" });
  const sw = Math.max(1.2, Math.min(w, h) * 0.012);

  repeat(group, count, i => {
    const x = (i * 73) % w;
    const y = (i * 41) % h;
    const r = 2 + (i % 3);
    const opacity = 0.55 + (i % 3) * 0.20;

    // Four-pointed star
    add(group, "path", {
      d: `M${(x - r * 2.2).toFixed(1)} ${y.toFixed(1)} L${(x + r * 2.2).toFixed(1)} ${y.toFixed(1)} M${x.toFixed(1)} ${(y - r * 2.2).toFixed(1)} L${x.toFixed(1)} ${(y + r * 2.2).toFixed(1)}`,
      fill: "none", stroke: color, "stroke-width": (r * 0.65).toFixed(2),
      opacity: opacity.toFixed(2), "stroke-linecap": "round",
      "data-line-tier": "atmosphere"
    });
  });

  return group;
}

function renderTree(entity, quality, namespace) {
  const { width: w, height: h, params = {} } = entity;
  const color = params.color || PALETTE.foliage;
  const accent = params.accent || PALETTE.warm;
  const isFull = quality === "full";
  const rng = createRNG(entity.id, "tree");
  const ns = namespace || "canvas";
  const group = node("g", { "data-template": "tree", "data-art-style": "storybook-layered" });
  const ink = PALETTE.ink;
  const sw = Math.max(1.8, Math.min(w, h) * 0.016);

  shadowEllipse(group, w * 0.50, h * 0.98, w * 0.40, h * 0.035);

  // Trunk
  add(group, "path", {
    d: `M${(w * 0.44).toFixed(1)} ${(h * 0.97).toFixed(1)} Q${(w * 0.47).toFixed(1)} ${(h * 0.65).toFixed(1)} ${(w * 0.40).toFixed(1)} ${(h * 0.44).toFixed(1)} Q${(w * 0.50).toFixed(1)} ${(h * 0.52).toFixed(1)} ${(w * 0.60).toFixed(1)} ${(h * 0.44).toFixed(1)} Q${(w * 0.53).toFixed(1)} ${(h * 0.65).toFixed(1)} ${(w * 0.56).toFixed(1)} ${(h * 0.97).toFixed(1)} Z`,
    fill: accent, stroke: ink, "stroke-width": sw.toFixed(2)
  });

  // Foliage clusters
  repeat(group, 7, i => {
    const cx = w * (0.22 + (i % 4) * 0.18);
    const cy = h * (0.20 + Math.floor(i / 4) * 0.20 + (i % 2) * 0.04);
    const cr = h * (0.18 + (i % 3) * 0.02);
    add(group, "circle", {
      cx: cx.toFixed(1), cy: cy.toFixed(1), r: cr.toFixed(1),
      fill: i % 3 ? color : shade(color, 10),
      stroke: ink, "stroke-width": sw.toFixed(2)
    });
  });

  if (isFull) {
    // Trunk bark texture
    repeat(group, 6, i => {
      const ty = h * (0.48 + i * 0.07);
      penLineToGroup(group, [[w * 0.41, ty], [w * 0.45, ty]],
        { tier: "texture", baseWidth: sw * 0.22, stroke: shade(accent, -15), rng });
      penLineToGroup(group, [[w * 0.55, ty], [w * 0.59, ty]],
        { tier: "texture", baseWidth: sw * 0.22, stroke: shade(accent, -15), rng });
    });

    // Branch detail
    penLineToGroup(group, [[w * 0.40, h * 0.44], [w * 0.24, h * 0.32]],
      { tier: "structure", baseWidth: sw * 0.5, stroke: ink, rng });
    penLineToGroup(group, [[w * 0.60, h * 0.44], [w * 0.74, h * 0.36]],
      { tier: "structure", baseWidth: sw * 0.5, stroke: ink, rng });

    // Fruit/flowers
    repeat(group, 5, i => {
      add(group, "circle", {
        cx: (w * (0.26 + (i % 3) * 0.22)).toFixed(1),
        cy: (h * (0.18 + (i % 2) * 0.22)).toFixed(1),
        r: (h * 0.022).toFixed(1),
        fill: i % 2 ? accent : PALETTE.gold,
        stroke: "none"
      });
    });
  }

  return group;
}

function renderMountain(entity, quality, namespace) {
  const { width: w, height: h, params = {} } = entity;
  const color = params.color || PALETTE.moss;
  const accent = params.accent || PALETTE.stoneDark;
  const isFull = quality === "full";
  const rng = createRNG(entity.id, "mountain");
  const ns = namespace || "canvas";
  const group = node("g", { "data-template": "mountain", "data-art-style": "storybook-layered" });
  const ink = PALETTE.ink;
  const sw = Math.max(1.8, Math.min(w, h) * 0.016);

  // Background peak (lighter)
  add(group, "path", {
    d: `M0 ${h} L${(w * 0.24).toFixed(1)} ${(h * 0.36).toFixed(1)} L${(w * 0.44).toFixed(1)} ${h} Z`,
    fill: shade(color, 15), stroke: ink, "stroke-width": sw.toFixed(2)
  });

  // Main peak
  add(group, "path", {
    d: `M${(w * 0.18).toFixed(1)} ${h} L${(w * 0.50).toFixed(1)} ${(h * 0.10).toFixed(1)} L${(w * 0.72).toFixed(1)} ${(h * 0.60).toFixed(1)} L${(w * 0.84).toFixed(1)} ${(h * 0.30).toFixed(1)} L${w} ${h} Z`,
    fill: `url(#${namespaceId(ns, `grad-${entity.id}`)})`, stroke: ink, "stroke-width": sw.toFixed(2)
  });

  if (isFull) {
    // Snow cap
    add(group, "path", {
      d: `M${(w * 0.40).toFixed(1)} ${(h * 0.40).toFixed(1)} L${(w * 0.50).toFixed(1)} ${(h * 0.10).toFixed(1)} L${(w * 0.62).toFixed(1)} ${(h * 0.36).toFixed(1)} L${(w * 0.56).toFixed(1)} ${(h * 0.32).toFixed(1)} L${(w * 0.48).toFixed(1)} ${(h * 0.40).toFixed(1)} Z`,
      fill: PALETTE.paper, stroke: ink, "stroke-width": (sw * 0.6).toFixed(2)
    });

    // Shadow side
    add(group, "path", {
      d: `M${(w * 0.50).toFixed(1)} ${(h * 0.10).toFixed(1)} L${(w * 0.62).toFixed(1)} ${(h * 0.36).toFixed(1)} L${(w * 0.72).toFixed(1)} ${(h * 0.60).toFixed(1)} L${(w * 0.56).toFixed(1)} ${(h * 0.32).toFixed(1)} Z`,
      fill: shade(color, -15), opacity: "0.40", stroke: "none"
    });

    // Ridge lines
    repeat(group, 4, i => {
      const rx = w * (0.30 + i * 0.12);
      penLineToGroup(group, [[rx, h * (0.50 + i * 0.08)], [rx + w * 0.06, h * (0.38 + i * 0.05)]],
        { tier: "texture", baseWidth: sw * 0.25, stroke: shade(color, -10), rng });
    });
  }

  return group;
}

function renderFlowers(entity, quality, namespace) {
  const { width: w, height: h, params = {} } = entity;
  const color = params.color || PALETTE.rose;
  const accent = params.accent || PALETTE.warm;
  const count = Math.max(3, Math.min(24, params.count || 10));
  const isFull = quality === "full";
  const rng = createRNG(entity.id, "flowers");
  const group = node("g", { "data-template": "flowers", "data-art-style": "storybook-layered" });
  const ink = PALETTE.ink;
  const sw = Math.max(1.5, Math.min(w, h) * 0.014);

  repeat(group, count, i => {
    const x = (i * 67) % w;
    const baseY = h * 0.92;
    const topY = h * 0.38 + (i % 4) * h * 0.14;
    const stemRng = createRNG(entity.id, `flower-stem-${i}`);

    // Stem
    penLineToGroup(group, [[x, baseY], [x - w * 0.02, (baseY + topY) / 2], [x, topY]], {
      tier: "structure", baseWidth: sw * 0.8, stroke: PALETTE.moss, rng: stemRng
    });

    // Petals
    repeat(group, 5, petal => {
      const a = petal * Math.PI * 2 / 5;
      const petalRng = createRNG(entity.id, `flower-petal-${i}-${petal}`);
      const pr = h * 0.045;
      add(group, "circle", {
        cx: (x + Math.cos(a) * pr * 1.1).toFixed(1),
        cy: (topY + Math.sin(a) * pr * 1.1).toFixed(1),
        r: pr.toFixed(1),
        fill: i % 2 ? accent : color,
        stroke: ink, "stroke-width": (sw * 0.45).toFixed(2)
      });
    });

    // Center
    add(group, "circle", {
      cx: x.toFixed(1), cy: topY.toFixed(1),
      r: Math.max(2, h * 0.028).toFixed(1),
      fill: PALETTE.gold, stroke: "none"
    });

    if (isFull && i % 3 === 0) {
      // Leaf
      penLineToGroup(group, [[x, (baseY + topY) / 2], [x + w * 0.03, (baseY + topY) / 2 - h * 0.02]],
        { tier: "texture", baseWidth: sw * 0.35, stroke: PALETTE.foliage, rng: stemRng });
    }
  });

  return group;
}

function renderRiverOrStreet(entity, quality, namespace) {
  const { width: w, height: h, params = {}, templateId } = entity;
  const color = params.color || (templateId === "river" ? PALETTE.waterDark : PALETTE.stone);
  const accent = params.accent || PALETTE.warm;
  const isStreet = templateId === "street";
  const isFull = quality === "full";
  const rng = createRNG(entity.id, templateId);
  const ns = namespace || "canvas";
  const group = node("g", { "data-template": templateId, "data-art-style": "storybook-layered" });
  const ink = PALETTE.ink;
  const sw = Math.max(1.8, Math.min(w, h) * 0.016);

  // Body path
  add(group, "path", {
    d: `M0 ${(h * 0.24).toFixed(1)} Q${(w * 0.35).toFixed(1)} ${(h * 0.75).toFixed(1)} ${(w * 0.55).toFixed(1)} ${(h * 0.36).toFixed(1)} T${w} ${(h * 0.52).toFixed(1)} L${w} ${h} Q${(w * 0.65).toFixed(1)} ${(h * 0.68).toFixed(1)} ${(w * 0.45).toFixed(1)} ${(h * 0.94).toFixed(1)} T0 ${(h * 0.72).toFixed(1)} Z`,
    fill: `url(#${namespaceId(ns, `grad-${entity.id}`)})`, stroke: ink, "stroke-width": sw.toFixed(2)
  });

  // Flow/road markings
  repeat(group, 4, i => {
    penLineToGroup(group, [
      [w * (0.10 + i * 0.20), h * (0.50 + (i % 2) * 0.15)],
      [w * (0.18 + i * 0.20), h * (0.50 + (i % 2) * 0.15) + h * 0.04]
    ], {
      tier: isStreet ? "structure" : "texture",
      baseWidth: sw * (isStreet ? 1.0 : 0.7),
      stroke: isStreet ? accent : shade(color, 15),
      opacity: 0.70,
      rng
    });
  });

  if (isFull) {
    if (isStreet) {
      // Center line
      repeat(group, 8, i => {
        penLineToGroup(group, [
          [w * (0.05 + i * 0.11), h * (0.48 + (i % 3) * 0.06)],
          [w * (0.10 + i * 0.11), h * (0.48 + (i % 3) * 0.06)]
        ], { tier: "structure", baseWidth: sw * 0.5, stroke: PALETTE.gold, opacity: 0.6, rng });
      });
    } else {
      // Water ripples
      repeat(group, 6, i => {
        const rx = w * (0.10 + i * 0.14);
        const ry = h * (0.45 + (i % 3) * 0.12);
        penLineToGroup(group, [[rx, ry], [rx + w * 0.06, ry - h * 0.02]],
          { tier: "atmosphere", baseWidth: sw * 0.35, stroke: PALETTE.waterLight, opacity: 0.55, rng: createRNG(entity.id, `ripple-${i}`) });
      });
    }
  }

  return group;
}

function renderGrass(entity, quality, namespace) {
  const { width: w, height: h, params = {} } = entity;
  const color = params.color || PALETTE.foliage;
  const accent = params.accent || PALETTE.moss;
  const isFull = quality === "full";
  const rng = createRNG(entity.id, "grass");
  const ns = namespace || "canvas";
  const group = node("g", { "data-template": "grass", "data-art-style": "storybook-layered" });
  const ink = PALETTE.ink;
  const sw = Math.max(1.5, Math.min(w, h) * 0.014);

  // Ground body
  add(group, "path", {
    d: `M0 ${(h * 0.44).toFixed(1)} Q${(w * 0.24).toFixed(1)} ${(h * 0.28).toFixed(1)} ${(w * 0.46).toFixed(1)} ${(h * 0.42).toFixed(1)} T${w} ${(h * 0.36).toFixed(1)} L${w} ${h} L0 ${h} Z`,
    fill: `url(#${namespaceId(ns, `grad-${entity.id}`)})`, stroke: ink, "stroke-width": sw.toFixed(2)
  });

  // Grass blades
  repeat(group, 22, i => {
    const x = i * w / 21;
    const top = h * (0.22 + (i % 5) * 0.03);
    const bladeRng = createRNG(entity.id, `grass-${i}`);

    penLineToGroup(group, [[x, h * 0.69], [x - w * 0.012, h * 0.44], [x - w * 0.022, top]], {
      tier: "structure", baseWidth: sw * 0.55, stroke: i % 3 ? shade(color, -10) : accent, rng: bladeRng
    });
    penLineToGroup(group, [[x, h * 0.69], [x + w * 0.015, h * 0.45], [x + w * 0.028, top + h * 0.03]], {
      tier: "structure", baseWidth: sw * 0.55, stroke: i % 3 ? shade(color, -5) : shade(accent, -5), rng: bladeRng
    });
  });

  if (isFull) {
    // Flower dots in grass
    repeat(group, 4, i => {
      add(group, "circle", {
        cx: (w * (0.15 + i * 0.22)).toFixed(1),
        cy: (h * (0.38 + (i % 2) * 0.06)).toFixed(1),
        r: (sw * 1.0).toFixed(2),
        fill: PALETTE.gold, opacity: "0.7", stroke: "none"
      });
    });
  }

  return group;
}

function renderPuddle(entity, quality, namespace) {
  const { width: w, height: h, params = {} } = entity;
  const color = params.color || PALETTE.waterLight;
  const accent = params.accent || PALETTE.waterDark;
  const isFull = quality === "full";
  const rng = createRNG(entity.id, "puddle");
  const ns = namespace || "canvas";
  const group = node("g", { "data-template": "puddle", "data-art-style": "storybook-layered" });
  const ink = PALETTE.ink;
  const sw = Math.max(1.8, Math.min(w, h) * 0.016);

  // Floor shadow
  add(group, "ellipse", {
    cx: (w * 0.50).toFixed(1), cy: (h * 0.64).toFixed(1),
    rx: (w * 0.50).toFixed(1), ry: (h * 0.32).toFixed(1),
    fill: PALETTE.night, opacity: "0.12", stroke: "none"
  });

  // Water body (irregular)
  add(group, "path", {
    d: `M${(w * 0.08).toFixed(1)} ${(h * 0.56).toFixed(1)} Q${(w * 0.20).toFixed(1)} ${(h * 0.28).toFixed(1)} ${(w * 0.42).toFixed(1)} ${(h * 0.38).toFixed(1)} Q${(w * 0.60).toFixed(1)} ${(h * 0.20).toFixed(1)} ${(w * 0.78).toFixed(1)} ${(h * 0.42).toFixed(1)} Q${(w * 0.98).toFixed(1)} ${(h * 0.44).toFixed(1)} ${(w * 0.94).toFixed(1)} ${(h * 0.70).toFixed(1)} Q${(w * 0.72).toFixed(1)} ${(h * 0.96).toFixed(1)} ${(w * 0.50).toFixed(1)} ${(h * 0.80).toFixed(1)} Q${(w * 0.22).toFixed(1)} ${(h * 0.96).toFixed(1)} ${(w * 0.08).toFixed(1)} ${(h * 0.56).toFixed(1)} Z`,
    fill: `url(#${namespaceId(ns, `grad-${entity.id}`)})`, stroke: ink, "stroke-width": sw.toFixed(2)
  });

  if (isFull) {
    // Water surface reflections
    repeat(group, 5, i => {
      const rx = w * (0.18 + i * 0.14);
      const ry = h * (0.44 + (i % 3) * 0.08);
      penLineToGroup(group, [[rx, ry], [rx + w * 0.05, ry - h * 0.01]], {
        tier: "atmosphere", baseWidth: sw * 0.35, stroke: shade(color, 10), opacity: 0.75, rng: createRNG(entity.id, `reflect-${i}`)
      });
    });

    // Highlight
    add(group, "path", {
      d: `M${(w * 0.48).toFixed(1)} ${(h * 0.68).toFixed(1)} Q${(w * 0.64).toFixed(1)} ${(h * 0.60).toFixed(1)} ${(w * 0.76).toFixed(1)} ${(h * 0.66).toFixed(1)}`,
      fill: "none", stroke: PALETTE.cream, opacity: "0.5", "stroke-width": sw.toFixed(2),
      "stroke-linecap": "round", "data-line-tier": "atmosphere"
    });
  }

  return group;
}

// ==================== RENDER DISPATCH ====================

const RENDERERS = {
  person: renderPerson,
  cat: renderCat,
  dog: renderDog,
  bird: renderBird,
  umbrella: renderUmbrella,
  streetlamp: renderStreetlamp,
  roof: renderRoof,
  house: renderHouse,
  bridge: renderBridge,
  boat: renderBoat,
  bench: renderBench,
  bicycle: renderBicycle,
  fence: renderFence,
  buildings: renderBuildings,
  rain: renderRain,
  cloud: renderCloud,
  sun: renderSun,
  moon: renderMoon,
  stars: renderStars,
  tree: renderTree,
  mountain: renderMountain,
  flowers: renderFlowers,
  river: renderRiverOrStreet,
  grass: renderGrass,
  street: renderRiverOrStreet,
  puddle: renderPuddle
};

/**
 * Render a semantic entity using the storybook style.
 *
 * @param {object} entity - Entity object with templateId, width, height, params, id, etc.
 * @param {object} [options] - Rendering options.
 * @param {string} [options.quality="full"] - "base" or "full"
 * @param {string} [options.namespace="canvas"] - Namespace for SVG id uniqueness
 * @returns {SVGElement} SVG group element
 */
export function renderEntity(entity, options = {}) {
  const quality = options.quality || "full";
  const namespace = options.namespace || "canvas";
  const renderFn = RENDERERS[entity.templateId];
  if (!renderFn) throw new Error(`未知实体模板: ${entity.templateId}`);

  let group;
  try {
    group = renderFn(entity, quality, namespace);
  } catch (err) {
    throw new Error(`渲染实体 ${entity.templateId} 失败: ${err.message}`);
  }

  // Ensure gradient defs are present (prepend to group)
  if (quality === "full") {
    const defs = node("defs");
    const { width: w, height: h, params = {} } = entity;
    const color = params.color || PALETTE.green;
    const ns = namespace || "canvas";

    // Primary gradient
    const g1 = node("linearGradient", {
      id: namespaceId(ns, `grad-${entity.id}`),
      x1: "0", y1: "0", x2: "1", y2: "1",
      gradientTransform: "rotate(25)"
    });
    const stop1a = node("stop", { offset: "0%", "stop-color": shade(color, 20), "stop-opacity": "1" });
    const stop1b = node("stop", { offset: "45%", "stop-color": color, "stop-opacity": "1" });
    const stop1c = node("stop", { offset: "100%", "stop-color": shade(color, -25), "stop-opacity": "1" });
    g1.appendChild(stop1a);
    g1.appendChild(stop1b);
    g1.appendChild(stop1c);
    defs.appendChild(g1);

    // Shadow gradient
    const g2 = node("linearGradient", {
      id: namespaceId(ns, `shadow-${entity.id}`),
      x1: "0", y1: "0", x2: "1", y2: "1"
    });
    g2.appendChild(node("stop", { offset: "0%", "stop-color": PALETTE.night, "stop-opacity": "0.25" }));
    g2.appendChild(node("stop", { offset: "100%", "stop-color": PALETTE.night, "stop-opacity": "0.05" }));
    defs.appendChild(g2);

    // Highlight gradient (radial)
    const g3 = node("radialGradient", {
      id: namespaceId(ns, `highlight-${entity.id}`),
      cx: "40%", cy: "30%", r: "60%"
    });
    g3.appendChild(node("stop", { offset: "0%", "stop-color": PALETTE.cream, "stop-opacity": "0.4" }));
    g3.appendChild(node("stop", { offset: "100%", "stop-color": PALETTE.cream, "stop-opacity": "0" }));
    defs.appendChild(g3);

    group.children.unshift(defs);
  }

  // Set common attributes
  group.setAttribute("data-id", entity.id);
  group.setAttribute("data-name", entity.name);
  group.setAttribute("data-quality", quality);
  group.setAttribute("data-namespace", namespace);
  group.setAttribute("data-template", entity.templateId);

  const direction = entity.params?.direction === "left"
    ? ` translate(${entity.width} 0) scale(-1 1)` : "";
  const rotation = entity.rotation || 0;
  group.setAttribute("transform",
    `translate(${entity.x} ${entity.y}) rotate(${rotation} ${entity.width / 2} ${entity.height / 2})${direction}`);

  if (entity.opacity !== undefined && entity.opacity !== 1) {
    group.setAttribute("opacity", String(entity.opacity));
  }

  return group;
}

export { ENTITY_TEMPLATES, TEMPLATE_NAMES, PALETTE };
