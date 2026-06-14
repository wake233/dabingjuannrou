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

const DEFAULT_COLORS = Object.freeze({
  person: PALETTE.deepBlue, cat: PALETTE.warm, dog: PALETTE.warm,
  bird: PALETTE.blue, umbrella: PALETTE.rose, streetlamp: PALETTE.night,
  roof: PALETTE.brick, house: PALETTE.warm, bridge: PALETTE.stone,
  boat: PALETTE.wood, bench: PALETTE.wood, bicycle: PALETTE.blue,
  fence: PALETTE.wood, buildings: PALETTE.moss, rain: PALETTE.blue,
  cloud: PALETTE.blue, sun: PALETTE.gold, moon: PALETTE.gold,
  stars: PALETTE.gold, tree: PALETTE.foliage, mountain: PALETTE.moss,
  flowers: PALETTE.rose, river: PALETTE.waterDark, grass: PALETTE.foliage,
  street: PALETTE.stone, puddle: PALETTE.waterLight
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
  const { width: w, height: h, params = {}, templateId } = entity;
  const color = params.color || DEFAULT_COLORS[templateId] || PALETTE.green;
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
  const tier = LINE_TIERS[options.tier] || LINE_TIERS.structure;
  const penColor = options.stroke || PALETTE.ink;
  const el = node("path", {
    d,
    fill: penColor,
    stroke: "none",
    opacity: (options.opacity || tier.opacity).toFixed(2),
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "data-line-tier": (options.tier || "structure")
  });
  if (options.closed) el.setAttribute("data-closed", "true");
  group.appendChild(el);
  return el;
}

function addHatching(group, bounds, angle, spacing, count, stroke, tier, rng) {
  const lines = generateHatchLines(bounds, angle, spacing, rng, count);
  for (const d of lines) {
    const el = node("path", {
      d,
      fill: "none",
      stroke: stroke || PALETTE.ink,
      "stroke-width": ((tier || LINE_TIERS.texture).width * 1.5).toFixed(2),
      opacity: (tier || LINE_TIERS.texture).opacity.toFixed(2),
      "stroke-linecap": "round",
      "data-line-tier": (tier || LINE_TIERS.texture).label
    });
    group.appendChild(el);
  }
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
  const isWoman = variant === "woman";
  const isWalking = pose === "walking";

  // Ground shadow
  shadowEllipse(group, w * 0.50, h * 0.965, w * 0.32, h * 0.025, PALETTE.night, 0.20);

  // === FEET & SHOES ===
  const lfx = isWalking ? w * 0.30 : w * 0.36;
  const rfx = isWalking ? w * 0.72 : w * 0.60;
  const footY = h * 0.95;
  // Left foot - more organic shape
  penLineToGroup(group, [
    [lfx - w * 0.05, footY], [lfx - w * 0.03, footY - h * 0.02],
    [lfx - w * 0.01, footY - h * 0.025], [lfx + w * 0.02, footY - h * 0.022],
    [lfx + w * 0.06, footY - h * 0.015], [lfx + w * 0.09, footY],
    [lfx + w * 0.07, footY + h * 0.008]
  ], { tier: "outline", baseWidth: sw * 1.4, stroke: PALETTE.deepInk, rng });
  // Right foot
  penLineToGroup(group, [
    [rfx - w * 0.05, footY], [rfx - w * 0.03, footY - h * 0.02],
    [rfx - w * 0.01, footY - h * 0.025], [rfx + w * 0.02, footY - h * 0.022],
    [rfx + w * 0.06, footY - h * 0.015], [rfx + w * 0.09, footY],
    [rfx + w * 0.07, footY + h * 0.008]
  ], { tier: "outline", baseWidth: sw * 1.4, stroke: PALETTE.deepInk, rng });

  // === LEGS ===
  const hipY = h * 0.50;
  const kneeY = h * 0.72;
  const lLegPts = isWalking
    ? [[w * 0.38, hipY], [w * 0.34, kneeY], [w * 0.30, h * 0.84], [lfx, footY - h * 0.01]]
    : [[w * 0.40, hipY], [w * 0.38, kneeY], [w * 0.37, h * 0.84], [lfx, footY - h * 0.01]];
  const rLegPts = isWalking
    ? [[w * 0.62, hipY], [w * 0.66, kneeY], [w * 0.70, h * 0.84], [rfx, footY - h * 0.01]]
    : [[w * 0.60, hipY], [w * 0.62, kneeY], [w * 0.63, h * 0.84], [rfx, footY - h * 0.01]];
  penLineToGroup(group, lLegPts, { tier: "outline", baseWidth: sw * 1.3, stroke: ink, rng });
  penLineToGroup(group, rLegPts, { tier: "outline", baseWidth: sw * 1.3, stroke: ink, rng });

  // === BODY / TORSO ===
  const shoulderY = h * 0.30;
  const waistY = h * 0.50;
  const bodyPts = isWoman
    ? [[w * 0.34, shoulderY], [w * 0.32, h * 0.38], [w * 0.29, waistY],
       [w * 0.28, h * 0.58], [w * 0.27, h * 0.68],
       [w * 0.73, h * 0.68], [w * 0.72, h * 0.58], [w * 0.71, waistY],
       [w * 0.68, h * 0.38], [w * 0.66, shoulderY]]
    : [[w * 0.36, shoulderY], [w * 0.34, h * 0.38], [w * 0.33, waistY],
       [w * 0.35, h * 0.60], [w * 0.36, h * 0.68],
       [w * 0.64, h * 0.68], [w * 0.65, h * 0.60], [w * 0.67, waistY],
       [w * 0.66, h * 0.38], [w * 0.64, shoulderY]];
  const bodyD = `M${bodyPts.map(p => p.map(v => v.toFixed(1)).join(",")).join(" L")} Z`;
  add(group, "path", { d: bodyD, fill: `url(#${namespaceId(ns, `grad-${entity.id}`)})`, stroke: "none", "data-color-block": "body" });
  penLineToGroup(group, [...bodyPts, bodyPts[0]], { tier: "outline", baseWidth: sw, stroke: ink, rng, closed: true });

  // === CLOTHING DETAILS ===
  if (isFull) {
    // Collar
    const collarY = h * 0.31;
    penLineToGroup(group, [[w * 0.40, collarY], [w * 0.44, collarY + h * 0.03], [w * 0.50, collarY], [w * 0.56, collarY + h * 0.03], [w * 0.60, collarY]],
      { tier: "structure", baseWidth: sw * 0.55, stroke: shade(color, -25), rng });
    // Collar inner V
    penLineToGroup(group, [[w * 0.43, collarY + h * 0.02], [w * 0.50, collarY + h * 0.05], [w * 0.57, collarY + h * 0.02]],
      { tier: "structure", baseWidth: sw * 0.4, stroke: accent, rng });
    // Belt/waist
    penLineToGroup(group, [[w * 0.33, waistY - h * 0.01], [w * 0.50, waistY + h * 0.01], [w * 0.67, waistY - h * 0.01]],
      { tier: "structure", baseWidth: sw * 0.8, stroke: shade(color, -20), rng });
    penLineToGroup(group, [[w * 0.33, waistY + h * 0.02], [w * 0.50, waistY + h * 0.04], [w * 0.67, waistY + h * 0.02]],
      { tier: "structure", baseWidth: sw * 0.8, stroke: shade(color, -20), rng });
    // Fabric folds on torso
    repeat(group, 5, i => {
      penLineToGroup(group, [[w * (0.31 + i * 0.07), h * (0.38 + (i % 3) * 0.04)], [w * (0.33 + i * 0.07), h * (0.42 + (i % 3) * 0.04)]],
        { tier: "texture", baseWidth: sw * 0.3, stroke: shade(color, -12), rng });
    });
  }

  // === ARMS ===
  const lShX = w * 0.35, rShX = w * 0.65, shY = shoulderY + h * 0.02;
  const armRelaxed = !isWalking;
  const lElbX = armRelaxed ? w * 0.18 : w * 0.26, lElbY = armRelaxed ? h * 0.46 : h * 0.42;
  const lHndX = armRelaxed ? w * 0.14 : w * 0.20, lHndY = armRelaxed ? h * 0.60 : h * 0.54;
  const rElbX = armRelaxed ? w * 0.82 : w * 0.74, rElbY = armRelaxed ? h * 0.46 : h * 0.42;
  const rHndX = armRelaxed ? w * 0.86 : w * 0.80, rHndY = armRelaxed ? h * 0.60 : h * 0.54;
  penLineToGroup(group, [[lShX, shY], [lElbX - w * 0.01, lElbY - h * 0.01], [lElbX, lElbY], [lElbX + w * 0.01, lElbY + h * 0.01], [lHndX, lHndY]],
    { tier: "outline", baseWidth: sw * 0.8, stroke: ink, rng });
  penLineToGroup(group, [[rShX, shY], [rElbX + w * 0.01, rElbY - h * 0.01], [rElbX, rElbY], [rElbX - w * 0.01, rElbY + h * 0.01], [rHndX, rHndY]],
    { tier: "outline", baseWidth: sw * 0.8, stroke: ink, rng });
  if (isFull) {
    // Elbow joint lines
    penLineToGroup(group, [[lElbX - w * 0.015, lElbY - h * 0.015], [lElbX + w * 0.015, lElbY + h * 0.01]],
      { tier: "structure", baseWidth: sw * 0.4, stroke: PALETTE.deepInk, rng });
    penLineToGroup(group, [[rElbX + w * 0.015, rElbY - h * 0.015], [rElbX - w * 0.015, rElbY + h * 0.01]],
      { tier: "structure", baseWidth: sw * 0.4, stroke: PALETTE.deepInk, rng });
    // Hands
    penLineToGroup(group, [[lHndX - w * 0.02, lHndY - h * 0.01], [lHndX + w * 0.02, lHndY + h * 0.01]],
      { tier: "structure", baseWidth: sw * 0.5, stroke: PALETTE.skin, rng });
    penLineToGroup(group, [[rHndX - w * 0.02, rHndY - h * 0.01], [rHndX + w * 0.02, rHndY + h * 0.01]],
      { tier: "structure", baseWidth: sw * 0.5, stroke: PALETTE.skin, rng });
  }

  // === HEAD ===
  const headCx = w * 0.50, headCy = h * 0.19, headRx = w * 0.105, headRy = h * 0.11;
  add(group, "ellipse", {
    cx: headCx.toFixed(1), cy: headCy.toFixed(1),
    rx: headRx.toFixed(1), ry: headRy.toFixed(1),
    fill: PALETTE.skin, stroke: ink, "stroke-width": sw.toFixed(2)
  });
  // Neck
  penLineToGroup(group, [[w * 0.46, h * 0.28], [w * 0.46, h * 0.30], [w * 0.54, h * 0.30], [w * 0.54, h * 0.28]],
    { tier: "outline", baseWidth: sw * 0.7, stroke: ink, rng });

  // === HAIR ===
  const hairColor = isWoman ? PALETTE.deepInk : shade(PALETTE.deepInk, -10);
  if (isWoman) {
    const hairPts = [
      [w * 0.375, h * 0.17], [w * 0.36, h * 0.12], [w * 0.37, h * 0.07],
      [w * 0.42, h * 0.04], [w * 0.48, h * 0.03], [w * 0.54, h * 0.04],
      [w * 0.59, h * 0.07], [w * 0.63, h * 0.12], [w * 0.625, h * 0.17],
      [w * 0.61, h * 0.13], [w * 0.55, h * 0.10], [w * 0.50, h * 0.09],
      [w * 0.45, h * 0.10], [w * 0.39, h * 0.13]
    ];
    add(group, "path", { d: `M${hairPts.map(p => p.map(v => v.toFixed(1)).join(",")).join(" L")} Z`, fill: hairColor, stroke: ink, "stroke-width": sw.toFixed(2) });
    // Long side hair
    add(group, "path", {
      d: `M${(w * 0.375).toFixed(1)} ${(h * 0.16).toFixed(1)} Q${(w * 0.34).toFixed(1)} ${(h * 0.26).toFixed(1)} ${(w * 0.36).toFixed(1)} ${(h * 0.34).toFixed(1)} L${(w * 0.39).toFixed(1)} ${(h * 0.30).toFixed(1)} Q${(w * 0.38).toFixed(1)} ${(h * 0.24).toFixed(1)} ${(w * 0.40).toFixed(1)} ${(h * 0.17).toFixed(1)} Z`,
      fill: hairColor, stroke: ink, "stroke-width": sw.toFixed(2)
    });
    add(group, "path", {
      d: `M${(w * 0.625).toFixed(1)} ${(h * 0.16).toFixed(1)} Q${(w * 0.66).toFixed(1)} ${(h * 0.26).toFixed(1)} ${(w * 0.64).toFixed(1)} ${(h * 0.34).toFixed(1)} L${(w * 0.61).toFixed(1)} ${(h * 0.30).toFixed(1)} Q${(w * 0.62).toFixed(1)} ${(h * 0.24).toFixed(1)} ${(w * 0.60).toFixed(1)} ${(h * 0.17).toFixed(1)} Z`,
      fill: hairColor, stroke: ink, "stroke-width": sw.toFixed(2)
    });
  } else {
    const hairPts = [
      [w * 0.385, h * 0.17], [w * 0.38, h * 0.13], [w * 0.39, h * 0.09],
      [w * 0.44, h * 0.07], [w * 0.50, h * 0.06], [w * 0.56, h * 0.07],
      [w * 0.61, h * 0.09], [w * 0.62, h * 0.13], [w * 0.62, h * 0.17]
    ];
    add(group, "path", { d: `M${hairPts.map(p => p.map(v => v.toFixed(1)).join(",")).join(" L")} Z`, fill: hairColor, stroke: ink, "stroke-width": sw.toFixed(2) });
  }

  // === FACIAL FEATURES ===
  if (isFull) {
    // Eyebrows
    penLineToGroup(group, [[w * 0.425, h * 0.17], [w * 0.44, h * 0.162], [w * 0.455, h * 0.17]],
      { tier: "structure", baseWidth: sw * 0.5, stroke: hairColor, rng });
    penLineToGroup(group, [[w * 0.545, h * 0.17], [w * 0.56, h * 0.162], [w * 0.575, h * 0.17]],
      { tier: "structure", baseWidth: sw * 0.5, stroke: hairColor, rng });
    // Eyes
    penLineToGroup(group, [[w * 0.435, h * 0.19], [w * 0.45, h * 0.185]],
      { tier: "outline", baseWidth: sw * 0.55, stroke: ink, rng });
    penLineToGroup(group, [[w * 0.55, h * 0.185], [w * 0.565, h * 0.19]],
      { tier: "outline", baseWidth: sw * 0.55, stroke: ink, rng });
    // Nose
    penLineToGroup(group, [[w * 0.50, h * 0.19], [w * 0.498, h * 0.21], [w * 0.505, h * 0.212]],
      { tier: "structure", baseWidth: sw * 0.35, stroke: shade(PALETTE.skin, -30), rng });
    // Mouth
    penLineToGroup(group, [[w * 0.47, h * 0.24], [w * 0.50, h * 0.245], [w * 0.53, h * 0.24]],
      { tier: "structure", baseWidth: sw * 0.45, stroke: PALETTE.rose, rng });
    // Hair texture lines
    repeat(group, isWoman ? 7 : 4, i => {
      penLineToGroup(group, [[w * (0.40 + i * 0.03), h * 0.10], [w * (0.41 + i * 0.03), h * 0.065]],
        { tier: "texture", baseWidth: sw * 0.28, stroke: shade(hairColor, 20), rng });
    });
  }

  // === SKIRT/DRESS (woman) ===
  if (isWoman) {
    const skTop = h * 0.50;
    add(group, "path", {
      d: `M${(w * 0.30).toFixed(1)} ${skTop.toFixed(1)} L${(w * 0.22).toFixed(1)} ${(h * 0.78).toFixed(1)} Q${(w * 0.16).toFixed(1)} ${(h * 0.86).toFixed(1)} ${(w * 0.50).toFixed(1)} ${(h * 0.90).toFixed(1)} Q${(w * 0.84).toFixed(1)} ${(h * 0.86).toFixed(1)} ${(w * 0.78).toFixed(1)} ${(h * 0.78).toFixed(1)} L${(w * 0.70).toFixed(1)} ${skTop.toFixed(1)} Z`,
      fill: shade(color, 12), stroke: ink, "stroke-width": sw.toFixed(2)
    });
    if (isFull) {
      // Skirt pleat lines
      repeat(group, 7, i => {
        penLineToGroup(group, [[w * (0.23 + i * 0.08), skTop], [w * (0.20 + i * 0.08), h * 0.84]],
          { tier: "texture", baseWidth: sw * 0.28, stroke: shade(color, -8), rng });
      });
      // Skirt hem
      penLineToGroup(group, [[w * 0.17, h * 0.85], [w * 0.50, h * 0.89], [w * 0.83, h * 0.85]],
        { tier: "structure", baseWidth: sw * 0.5, stroke: shade(color, -15), rng });
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

  shadowEllipse(group, w * 0.48, h * 0.94, w * 0.40, h * 0.05);

  // === BODY (organic oval with pointed ends) ===
  const bodyPts = [
    [w * 0.18, h * 0.60], [w * 0.16, h * 0.66], [w * 0.22, h * 0.78],
    [w * 0.34, h * 0.86], [w * 0.50, h * 0.88], [w * 0.66, h * 0.84],
    [w * 0.76, h * 0.72], [w * 0.74, h * 0.60], [w * 0.62, h * 0.52],
    [w * 0.44, h * 0.50], [w * 0.28, h * 0.52]
  ];
  const bodyD = `M${bodyPts.map(p => p.map(v => v.toFixed(1)).join(",")).join(" L")} Z`;
  add(group, "path", { d: bodyD, fill: `url(#${namespaceId(ns, `grad-${entity.id}`)})`, stroke: "none" });
  penLineToGroup(group, [...bodyPts, bodyPts[0]], { tier: "outline", baseWidth: sw, stroke: ink, rng, closed: true });

  // === HEAD (slightly flattened circle) ===
  const headCx = w * 0.68, headCy = h * 0.36;
  add(group, "ellipse", { cx: headCx.toFixed(1), cy: headCy.toFixed(1), rx: (h * 0.23).toFixed(1), ry: (h * 0.20).toFixed(1), fill: shade(color, 15), stroke: ink, "stroke-width": sw.toFixed(2) });

  // === EARS (triangular with inner detail) ===
  penLineToGroup(group, [[w * 0.56, h * 0.22], [w * 0.60, h * 0.04], [w * 0.64, h * 0.06], [w * 0.69, h * 0.20]],
    { tier: "outline", baseWidth: sw * 0.9, stroke: ink, rng });
  penLineToGroup(group, [[w * 0.74, h * 0.18], [w * 0.80, h * 0.04], [w * 0.84, h * 0.06], [w * 0.86, h * 0.22]],
    { tier: "outline", baseWidth: sw * 0.9, stroke: ink, rng });
  // Inner ear
  if (isFull) {
    penLineToGroup(group, [[w * 0.60, h * 0.16], [w * 0.62, h * 0.10], [w * 0.66, h * 0.18]],
      { tier: "structure", baseWidth: sw * 0.35, stroke: PALETTE.rose, rng });
    penLineToGroup(group, [[w * 0.78, h * 0.14], [w * 0.80, h * 0.10], [w * 0.83, h * 0.18]],
      { tier: "structure", baseWidth: sw * 0.35, stroke: PALETTE.rose, rng });
  }

  // === LEGS (front paws visible) ===
  penLineToGroup(group, [[w * 0.28, h * 0.74], [w * 0.22, h * 0.88], [w * 0.24, h * 0.93]],
    { tier: "outline", baseWidth: sw * 1.1, stroke: PALETTE.deepInk, rng });
  penLineToGroup(group, [[w * 0.62, h * 0.72], [w * 0.64, h * 0.88], [w * 0.66, h * 0.93]],
    { tier: "outline", baseWidth: sw * 1.1, stroke: PALETTE.deepInk, rng });

  // === TAIL (curving up and around) ===
  const tailPts = isFull
    ? [[w * 0.20, h * 0.64], [w * 0.08, h * 0.56], [w * 0.03, h * 0.44], [w * 0.04, h * 0.32], [w * 0.08, h * 0.24], [w * 0.14, h * 0.20]]
    : [[w * 0.20, h * 0.64], [w * 0.06, h * 0.48], [w * 0.08, h * 0.28], [w * 0.14, h * 0.22]];
  penLineToGroup(group, tailPts, { tier: "outline", baseWidth: sw * 0.7, stroke: ink, rng });

  if (isFull) {
    // === FACE DETAILS ===
    // Eyes (almond shaped)
    penLineToGroup(group, [[w * 0.61, h * 0.33], [w * 0.64, h * 0.31], [w * 0.66, h * 0.33]],
      { tier: "outline", baseWidth: sw * 0.6, stroke: ink, rng });
    penLineToGroup(group, [[w * 0.72, h * 0.33], [w * 0.75, h * 0.31], [w * 0.77, h * 0.33]],
      { tier: "outline", baseWidth: sw * 0.6, stroke: ink, rng });
    // Pupils
    add(group, "circle", { cx: (w * 0.64).toFixed(1), cy: (h * 0.32).toFixed(1), r: (sw * 0.5).toFixed(2), fill: PALETTE.deepInk, stroke: "none" });
    add(group, "circle", { cx: (w * 0.74).toFixed(1), cy: (h * 0.32).toFixed(1), r: (sw * 0.5).toFixed(2), fill: PALETTE.deepInk, stroke: "none" });
    // Nose
    add(group, "path", { d: `M${(w * 0.68).toFixed(1)} ${(h * 0.39).toFixed(1)} L${(w * 0.70).toFixed(1)} ${(h * 0.40).toFixed(1)} L${(w * 0.72).toFixed(1)} ${(h * 0.39).toFixed(1)} Z`, fill: PALETTE.rose, stroke: "none" });
    // Mouth lines
    penLineToGroup(group, [[w * 0.70, h * 0.40], [w * 0.68, h * 0.42]],
      { tier: "structure", baseWidth: sw * 0.35, stroke: ink, rng });
    penLineToGroup(group, [[w * 0.70, h * 0.40], [w * 0.72, h * 0.42]],
      { tier: "structure", baseWidth: sw * 0.35, stroke: ink, rng });

    // === WHISKERS ===
    const wBase = [w * 0.68, h * 0.38];
    repeat(group, 6, i => {
      const a = -0.6 + i * 0.22;
      const len = w * (0.14 + (i % 2) * 0.06);
      penLineToGroup(group, [wBase, [wBase[0] + Math.cos(a) * len, wBase[1] + Math.sin(a) * h * 0.03]],
        { tier: "texture", baseWidth: sw * 0.22, stroke: ink, rng });
    });

    // === FUR TEXTURE (hatching on body) ===
    addHatching(group, { x: w * 0.20, y: h * 0.56, width: w * 0.50, height: h * 0.28 }, -30, 10, rng, 8, shade(color, -8), LINE_TIERS.texture);
    // Individual fur strokes
    repeat(group, 10, i => {
      const fx = w * (0.22 + i * 0.05), fy = h * (0.55 + (i % 4) * 0.05);
      penLineToGroup(group, [[fx, fy], [fx + w * 0.015, fy - h * 0.025]],
        { tier: "texture", baseWidth: sw * 0.18, stroke: shade(color, -8), rng });
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

  shadowEllipse(group, w * 0.50, h * 0.95, w * 0.42, h * 0.05);

  // Body — organic contour
  const bodyPts = [
    [w * 0.16, h * 0.54], [w * 0.15, h * 0.62], [w * 0.19, h * 0.74],
    [w * 0.28, h * 0.82], [w * 0.44, h * 0.84], [w * 0.60, h * 0.80],
    [w * 0.70, h * 0.68], [w * 0.68, h * 0.56], [w * 0.56, h * 0.48],
    [w * 0.38, h * 0.46], [w * 0.24, h * 0.48]
  ];
  const bodyD = `M${bodyPts.map(p => p.map(v => v.toFixed(1)).join(",")).join(" L")} Z`;
  add(group, "path", { d: bodyD, fill: `url(#${namespaceId(ns, `grad-${entity.id}`)})`, stroke: "none" });
  penLineToGroup(group, [...bodyPts, bodyPts[0]], { tier: "outline", baseWidth: sw, stroke: ink, rng, closed: true });

  // Head + snout
  add(group, "ellipse", { cx: (w * 0.72).toFixed(1), cy: (h * 0.38).toFixed(1), rx: (w * 0.13).toFixed(1), ry: (h * 0.17).toFixed(1), fill: shade(color, 12), stroke: ink, "stroke-width": sw.toFixed(2) });
  add(group, "ellipse", { cx: (w * 0.83).toFixed(1), cy: (h * 0.44).toFixed(1), rx: (w * 0.09).toFixed(1), ry: (h * 0.07).toFixed(1), fill: shade(color, 5), stroke: ink, "stroke-width": sw.toFixed(2) });
  add(group, "circle", { cx: (w * 0.89).toFixed(1), cy: (h * 0.44).toFixed(1), r: (sw * 0.8).toFixed(2), fill: PALETTE.deepInk, stroke: "none" });

  // Ears
  penLineToGroup(group, [[w * 0.62, h * 0.26], [w * 0.54, h * 0.14], [w * 0.58, h * 0.20], [w * 0.64, h * 0.28]],
    { tier: "outline", baseWidth: sw * 0.8, stroke: ink, rng });
  penLineToGroup(group, [[w * 0.76, h * 0.24], [w * 0.84, h * 0.12], [w * 0.82, h * 0.22], [w * 0.78, h * 0.28]],
    { tier: "outline", baseWidth: sw * 0.8, stroke: ink, rng });

  // Legs
  penLineToGroup(group, [[w * 0.28, h * 0.70], [w * 0.24, h * 0.86], [w * 0.26, h * 0.93]],
    { tier: "outline", baseWidth: sw * 1.2, stroke: PALETTE.deepInk, rng });
  penLineToGroup(group, [[w * 0.56, h * 0.68], [w * 0.60, h * 0.86], [w * 0.63, h * 0.93]],
    { tier: "outline", baseWidth: sw * 1.2, stroke: PALETTE.deepInk, rng });

  // Tail
  penLineToGroup(group, [[w * 0.16, h * 0.56], [w * 0.06, h * 0.46], [w * 0.08, h * 0.36], [w * 0.14, h * 0.30]],
    { tier: "outline", baseWidth: sw * 0.6, stroke: ink, rng });

  if (isFull) {
    // Eye with highlight
    add(group, "circle", { cx: (w * 0.84).toFixed(1), cy: (h * 0.40).toFixed(1), r: (sw * 0.65).toFixed(2), fill: PALETTE.deepInk, stroke: "none" });
    add(group, "circle", { cx: (w * 0.845).toFixed(1), cy: (h * 0.395).toFixed(1), r: (sw * 0.2).toFixed(2), fill: PALETTE.cream, stroke: "none" });
    // Mouth
    penLineToGroup(group, [[w * 0.83, h * 0.48], [w * 0.86, h * 0.47], [w * 0.88, h * 0.48]],
      { tier: "structure", baseWidth: sw * 0.35, stroke: ink, rng });
    // Collar
    penLineToGroup(group, [[w * 0.58, h * 0.50], [w * 0.66, h * 0.52], [w * 0.74, h * 0.50]],
      { tier: "structure", baseWidth: sw * 0.7, stroke: accent, rng });
    // Fur strokes
    repeat(group, 10, i => {
      penLineToGroup(group, [[w * (0.20 + i * 0.04), h * (0.56 + (i % 3) * 0.04)], [w * (0.22 + i * 0.04), h * (0.53 + (i % 3) * 0.03)]],
        { tier: "texture", baseWidth: sw * 0.18, stroke: shade(color, -10), rng });
    });
    // Paws
    penLineToGroup(group, [[w * 0.22, h * 0.94], [w * 0.24, h * 0.92], [w * 0.27, h * 0.94]],
      { tier: "structure", baseWidth: sw * 0.3, stroke: PALETTE.deepInk, rng });
    penLineToGroup(group, [[w * 0.59, h * 0.94], [w * 0.61, h * 0.92], [w * 0.64, h * 0.94]],
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
    const brng = createRNG(entity.id, `bird-${index}`);

    // Body
    penLineToGroup(group, [
      [x - size * 0.8, y - size * 0.1],
      [x - size * 0.4, y - size * 0.5],
      [x + size * 0.15, y - size * 0.15],
      [x + size * 0.8, y],
      [x + size * 0.5, y + size * 0.2],
      [x - size * 0.15, y + size * 0.05]
    ], { tier: "outline", baseWidth: sw * 1.1, stroke: index % 2 ? color : shade(color, -15), rng: brng });

    // Head
    add(group, "circle", { cx: (x + size * 0.15).toFixed(1), cy: (y - size * 0.28).toFixed(1), r: (size * 0.25).toFixed(1), fill: shade(color, 10), stroke: ink, "stroke-width": sw.toFixed(2) });
    // Beak
    penLineToGroup(group, [[x + size * 0.35, y - size * 0.30], [x + size * 0.65, y - size * 0.22]],
      { tier: "structure", baseWidth: sw * 0.5, stroke: PALETTE.warm, rng: brng });

    if (isFull) {
      // Wing feathers
      repeat(group, 3, fi => {
        penLineToGroup(group, [
          [x - size * 0.3 + fi * size * 0.15, y - size * 0.15],
          [x + size * 0.3 + fi * size * 0.1, y - size * 0.2]
        ], { tier: "texture", baseWidth: sw * 0.3, stroke: shade(color, -20), rng: createRNG(entity.id, `bf-${index}-${fi}`) });
      });
      // Eye
      add(group, "circle", { cx: (x + size * 0.22).toFixed(1), cy: (y - size * 0.32).toFixed(1), r: (sw * 0.4).toFixed(2), fill: PALETTE.deepInk, stroke: "none" });
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

  shadowEllipse(group, w * 0.52, h * 0.50, w * 0.48, h * 0.07);

  // Canopy with scalloped edge
  add(group, "path", {
    d: `M${(w * 0.05).toFixed(1)} ${(h * 0.48).toFixed(1)} Q${(w * 0.50).toFixed(1)} ${(-h * 0.04).toFixed(1)} ${(w * 0.95).toFixed(1)} ${(h * 0.48).toFixed(1)} Q${(w * 0.84).toFixed(1)} ${(h * 0.38).toFixed(1)} ${(w * 0.73).toFixed(1)} ${(h * 0.48).toFixed(1)} Q${(w * 0.61).toFixed(1)} ${(h * 0.36).toFixed(1)} ${(w * 0.50).toFixed(1)} ${(h * 0.48).toFixed(1)} Q${(w * 0.39).toFixed(1)} ${(h * 0.36).toFixed(1)} ${(w * 0.27).toFixed(1)} ${(h * 0.48).toFixed(1)} Q${(w * 0.16).toFixed(1)} ${(h * 0.38).toFixed(1)} ${(w * 0.05).toFixed(1)} ${(h * 0.48).toFixed(1)} Z`,
    fill: `url(#${namespaceId(ns, `grad-${entity.id}`)})`, stroke: ink, "stroke-width": sw.toFixed(2)
  });

  // Handle
  penLineToGroup(group, [[w * 0.50, h * 0.04], [w * 0.50, h * 0.48], [w * 0.50, h * 0.88], [w * 0.50, h * 0.92], [w * 0.60, h * 0.88]],
    { tier: "outline", baseWidth: sw * 1.6, stroke: PALETTE.deepInk, rng });

  // Top ferrule + tip
  add(group, "circle", { cx: (w * 0.50).toFixed(1), cy: (h * 0.02).toFixed(1), r: (sw * 1.5).toFixed(2), fill: accent, stroke: ink, "stroke-width": sw.toFixed(2) });

  if (isFull) {
    // Rib lines (arc from top to each scallop)
    repeat(group, 7, i => {
      penLineToGroup(group, [[w * 0.50, h * 0.04], [w * (0.14 + i * 0.10), h * 0.46]],
        { tier: "structure", baseWidth: sw * 0.4, stroke: shade(color, -18), rng });
    });
    // Canopy highlight
    penLineToGroup(group, [[w * 0.20, h * 0.40], [w * 0.50, h * 0.10], [w * 0.80, h * 0.40]],
      { tier: "atmosphere", baseWidth: sw * 0.3, stroke: shade(color, 30), opacity: 0.4, rng });
    // Handle grip detail
    penLineToGroup(group, [[w * 0.48, h * 0.82], [w * 0.52, h * 0.84]],
      { tier: "structure", baseWidth: sw * 0.55, stroke: accent, rng });
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

  // Light glow (radial)
  const glowCx = w * 0.50, glowCy = h * 0.30;
  add(group, "ellipse", { cx: glowCx.toFixed(1), cy: glowCy.toFixed(1), rx: (w * 0.52).toFixed(1), ry: (h * 0.34).toFixed(1), fill: accent, opacity: "0.08", stroke: "none" });
  add(group, "ellipse", { cx: glowCx.toFixed(1), cy: glowCy.toFixed(1), rx: (w * 0.32).toFixed(1), ry: (h * 0.20).toFixed(1), fill: accent, opacity: "0.10", stroke: "none" });

  // === POLE ===
  const poleTop = h * 0.24;
  const poleBot = h * 0.92;
  penLineToGroup(group, [[w * 0.48, poleTop], [w * 0.50, h * 0.50], [w * 0.51, h * 0.70], [w * 0.50, poleBot]],
    { tier: "outline", baseWidth: sw * 2.2, stroke: ink, rng });

  // === BASE ===
  // Ornamental base - trapezoidal
  add(group, "path", {
    d: `M${(w * 0.30).toFixed(1)} ${(h * 0.94).toFixed(1)} L${(w * 0.36).toFixed(1)} ${(h * 0.88).toFixed(1)} L${(w * 0.64).toFixed(1)} ${(h * 0.88).toFixed(1)} L${(w * 0.70).toFixed(1)} ${(h * 0.94).toFixed(1)} Q${(w * 0.50).toFixed(1)} ${(h * 0.97).toFixed(1)} ${(w * 0.30).toFixed(1)} ${(h * 0.94).toFixed(1)} Z`,
    fill: shade(color, -10), stroke: ink, "stroke-width": sw.toFixed(2)
  });
  // Base detail ring
  penLineToGroup(group, [[w * 0.34, h * 0.90], [w * 0.50, h * 0.91], [w * 0.66, h * 0.90]],
    { tier: "structure", baseWidth: sw * 1.0, stroke: shade(color, 20), rng });

  // === LAMP HOUSING ===
  // Main lantern body - more ornate shape
  const lTop = h * 0.04, lBot = h * 0.26;
  add(group, "path", {
    d: `M${(w * 0.30).toFixed(1)} ${(h * 0.12).toFixed(1)} L${(w * 0.32).toFixed(1)} ${(h * 0.07).toFixed(1)} L${(w * 0.68).toFixed(1)} ${(h * 0.07).toFixed(1)} L${(w * 0.70).toFixed(1)} ${(h * 0.12).toFixed(1)} Q${(w * 0.78).toFixed(1)} ${(h * 0.20).toFixed(1)} ${(w * 0.74).toFixed(1)} ${(h * 0.28).toFixed(1)} Q${(w * 0.50).toFixed(1)} ${(h * 0.36).toFixed(1)} ${(w * 0.26).toFixed(1)} ${(h * 0.28).toFixed(1)} Q${(w * 0.22).toFixed(1)} ${(h * 0.20).toFixed(1)} ${(w * 0.30).toFixed(1)} ${(h * 0.12).toFixed(1)} Z`,
    fill: `url(#${namespaceId(ns, `grad-${entity.id}`)})`, stroke: ink, "stroke-width": sw.toFixed(2)
  });
  // Roof cap
  add(group, "path", {
    d: `M${(w * 0.35).toFixed(1)} ${(h * 0.07).toFixed(1)} L${(w * 0.50).toFixed(1)} ${(-h * 0.01).toFixed(1)} L${(w * 0.65).toFixed(1)} ${(h * 0.07).toFixed(1)} Z`,
    fill: shade(color, -15), stroke: ink, "stroke-width": sw.toFixed(2)
  });
  // Finial
  add(group, "circle", { cx: (w * 0.50).toFixed(1), cy: (h * 0.01).toFixed(1), r: (sw * 1.8).toFixed(2), fill: accent, stroke: ink, "stroke-width": sw.toFixed(2) });

  if (isFull) {
    // === LAMP GLASS PANES ===
    // Center pane
    add(group, "rect", { x: (w * 0.44).toFixed(1), y: (h * 0.14).toFixed(1), width: (w * 0.12).toFixed(1), height: (h * 0.14).toFixed(1), fill: PALETTE.cream, opacity: "0.85", stroke: shade(color, 30), "stroke-width": (sw * 0.4).toFixed(2) });
    // Side panes
    add(group, "path", { d: `M${(w * 0.33).toFixed(1)} ${(h * 0.16).toFixed(1)} L${(w * 0.39).toFixed(1)} ${(h * 0.14).toFixed(1)} L${(w * 0.39).toFixed(1)} ${(h * 0.28).toFixed(1)} L${(w * 0.33).toFixed(1)} ${(h * 0.26).toFixed(1)} Z`, fill: PALETTE.cream, opacity: "0.60", stroke: shade(color, 30), "stroke-width": (sw * 0.4).toFixed(2) });
    add(group, "path", { d: `M${(w * 0.61).toFixed(1)} ${(h * 0.14).toFixed(1)} L${(w * 0.67).toFixed(1)} ${(h * 0.16).toFixed(1)} L${(w * 0.67).toFixed(1)} ${(h * 0.26).toFixed(1)} L${(w * 0.61).toFixed(1)} ${(h * 0.28).toFixed(1)} Z`, fill: PALETTE.cream, opacity: "0.60", stroke: shade(color, 30), "stroke-width": (sw * 0.4).toFixed(2) });

    // === LAMP BRACKET/ARM ===
    penLineToGroup(group, [[w * 0.50, poleTop], [w * 0.50, h * 0.14]],
      { tier: "structure", baseWidth: sw * 0.8, stroke: shade(color, 20), rng });
    // Decorative scrolls on bracket
    add(group, "path", {
      d: `M${(w * 0.44).toFixed(1)} ${(h * 0.24).toFixed(1)} Q${(w * 0.40).toFixed(1)} ${(h * 0.20).toFixed(1)} ${(w * 0.42).toFixed(1)} ${(h * 0.18).toFixed(1)} M${(w * 0.56).toFixed(1)} ${(h * 0.24).toFixed(1)} Q${(w * 0.60).toFixed(1)} ${(h * 0.20).toFixed(1)} ${(w * 0.58).toFixed(1)} ${(h * 0.18).toFixed(1)}`,
      fill: "none", stroke: accent, "stroke-width": (sw * 0.6).toFixed(2), "stroke-linecap": "round", "data-line-tier": "structure"
    });

    // === CROSS BRACES ===
    penLineToGroup(group, [[w * 0.38, h * 0.18], [w * 0.62, h * 0.26]],
      { tier: "structure", baseWidth: sw * 0.45, stroke: shade(color, 30), rng });
    penLineToGroup(group, [[w * 0.62, h * 0.18], [w * 0.38, h * 0.26]],
      { tier: "structure", baseWidth: sw * 0.45, stroke: shade(color, 30), rng });

    // === POLE JOINT DETAILS ===
    repeat(group, 3, i => {
      const jy = h * (0.40 + i * 0.16);
      penLineToGroup(group, [[w * 0.47, jy], [w * 0.53, jy]],
        { tier: "texture", baseWidth: sw * 0.45, stroke: shade(color, 25), rng });
      penLineToGroup(group, [[w * 0.47, jy + h * 0.01], [w * 0.53, jy + h * 0.01]],
        { tier: "texture", baseWidth: sw * 0.45, stroke: shade(color, 25), rng });
    });

    // === POLE VERTICAL TEXTURE ===
    penLineToGroup(group, [[w * 0.50, h * 0.35], [w * 0.50, h * 0.38]],
      { tier: "texture", baseWidth: sw * 0.2, stroke: shade(color, 45), rng });
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

  // Main roof triangle with slight overhang
  add(group, "path", {
    d: `M${(-w * 0.04).toFixed(1)} ${(h * 0.74).toFixed(1)} L${(w * 0.50).toFixed(1)} ${(h * 0.06).toFixed(1)} L${(w * 1.04).toFixed(1)} ${(h * 0.74).toFixed(1)} Z`,
    fill: `url(#${namespaceId(ns, `grad-${entity.id}`)})`, stroke: ink, "stroke-width": sw.toFixed(2)
  });

  // Eaves
  add(group, "rect", { x: (w * 0.19).toFixed(1), y: (h * 0.66).toFixed(1), width: (w * 0.62).toFixed(1), height: (h * 0.30).toFixed(1), rx: (sw * 2).toFixed(1), fill: accent, stroke: ink, "stroke-width": sw.toFixed(2) });
  // Fascia board
  penLineToGroup(group, [[w * 0.02, h * 0.72], [w * 0.50, h * 0.16], [w * 0.98, h * 0.72]],
    { tier: "structure", baseWidth: sw * 0.8, stroke: shade(color, -15), rng });

  if (isFull) {
    // Tile rows
    repeat(group, 7, i => {
      const ty = h * (0.18 + i * 0.07);
      penLineToGroup(group, [[w * (0.06 + i * 0.02), ty], [w * (0.94 - i * 0.02), ty]],
        { tier: "texture", baseWidth: sw * 0.25, stroke: shade(color, -8), rng });
    });
    // Dormer window
    add(group, "rect", { x: (w * 0.43).toFixed(1), y: (h * 0.72).toFixed(1), width: (w * 0.14).toFixed(1), height: (h * 0.22).toFixed(1), rx: sw.toFixed(1), fill: PALETTE.night, stroke: ink, "stroke-width": sw.toFixed(2) });
    add(group, "line", { x1: (w * 0.50).toFixed(1), y1: (h * 0.72).toFixed(1), x2: (w * 0.50).toFixed(1), y2: (h * 0.94).toFixed(1), stroke: ink, "stroke-width": (sw * 0.4).toFixed(2), "data-line-tier": "structure" });
    // Side windows
    add(group, "rect", { x: (w * 0.25).toFixed(1), y: (h * 0.74).toFixed(1), width: (w * 0.10).toFixed(1), height: (h * 0.09).toFixed(1), fill: PALETTE.gold, stroke: ink, "stroke-width": sw.toFixed(2) });
    add(group, "rect", { x: (w * 0.65).toFixed(1), y: (h * 0.74).toFixed(1), width: (w * 0.10).toFixed(1), height: (h * 0.09).toFixed(1), fill: PALETTE.gold, stroke: ink, "stroke-width": sw.toFixed(2) });
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

  shadowEllipse(group, w * 0.50, h * 0.97, w * 0.48, h * 0.035);

  // Walls
  add(group, "rect", { x: (w * 0.16).toFixed(1), y: (h * 0.42).toFixed(1), width: (w * 0.68).toFixed(1), height: (h * 0.52).toFixed(1), rx: (sw * 2).toFixed(1), fill: accent, stroke: ink, "stroke-width": sw.toFixed(2) });
  // Roof
  add(group, "path", { d: `M${(w * 0.06).toFixed(1)} ${(h * 0.46).toFixed(1)} L${(w * 0.50).toFixed(1)} ${(h * 0.08).toFixed(1)} L${(w * 0.94).toFixed(1)} ${(h * 0.46).toFixed(1)} Z`, fill: `url(#${namespaceId(ns, `grad-${entity.id}`)})`, stroke: ink, "stroke-width": sw.toFixed(2) });
  // Foundation line
  penLineToGroup(group, [[w * 0.14, h * 0.94], [w * 0.86, h * 0.94]],
    { tier: "structure", baseWidth: sw * 0.9, stroke: shade(accent, -20), rng });
  // Door
  add(group, "rect", { x: (w * 0.42).toFixed(1), y: (h * 0.62).toFixed(1), width: (w * 0.16).toFixed(1), height: (h * 0.32).toFixed(1), rx: sw.toFixed(1), fill: shade(color, -15), stroke: ink, "stroke-width": sw.toFixed(2) });
  // Door panels
  add(group, "rect", { x: (w * 0.44).toFixed(1), y: (h * 0.65).toFixed(1), width: (w * 0.12).toFixed(1), height: (h * 0.12).toFixed(1), rx: (sw * 0.5).toFixed(1), fill: "none", stroke: shade(color, -25), "stroke-width": (sw * 0.5).toFixed(2) });

  if (isFull) {
    // Windows
    repeat(group, 2, i => {
      const wx = w * (0.22 + i * 0.44);
      add(group, "rect", { x: wx.toFixed(1), y: (h * 0.56).toFixed(1), width: (w * 0.13).toFixed(1), height: (h * 0.15).toFixed(1), fill: PALETTE.gold, stroke: ink, "stroke-width": sw.toFixed(2) });
      // Window mullions
      penLineToGroup(group, [[wx + w * 0.065, h * 0.56], [wx + w * 0.065, h * 0.71]], { tier: "structure", baseWidth: sw * 0.35, stroke: PALETTE.night, rng });
      penLineToGroup(group, [[wx, h * 0.635], [wx + w * 0.13, h * 0.635]], { tier: "structure", baseWidth: sw * 0.35, stroke: PALETTE.night, rng });
    });
    // Chimney with brick pattern
    add(group, "rect", { x: (w * 0.68).toFixed(1), y: (h * 0.14).toFixed(1), width: (w * 0.10).toFixed(1), height: (h * 0.24).toFixed(1), fill: shade(color, -20), stroke: ink, "stroke-width": sw.toFixed(2) });
    repeat(group, 3, i => {
      penLineToGroup(group, [[w * 0.68, h * (0.18 + i * 0.06)], [w * 0.78, h * (0.18 + i * 0.06)]], { tier: "texture", baseWidth: sw * 0.2, stroke: shade(color, -30), rng });
    });
    // Wall hatching
    addHatching(group, { x: w * 0.22, y: h * 0.70, width: w * 0.56, height: h * 0.18 }, -25, 12, rng, 6, shade(accent, -12), LINE_TIERS.texture);
    // Door knob
    add(group, "circle", { cx: (w * 0.54).toFixed(1), cy: (h * 0.79).toFixed(1), r: (sw * 0.7).toFixed(2), fill: PALETTE.gold, stroke: "none" });
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
  add(group, "path", { d: `M0 ${(h * 0.82).toFixed(1)} Q${(w * 0.50).toFixed(1)} ${(h * 0.12).toFixed(1)} ${w} ${(h * 0.82).toFixed(1)} L${w} ${h} L0 ${h} Z`, fill: `url(#${namespaceId(ns, `grad-${entity.id}`)})`, stroke: ink, "stroke-width": sw.toFixed(2) });
  // Road surface
  add(group, "path", { d: `M${(w * 0.16).toFixed(1)} ${(h * 0.82).toFixed(1)} Q${(w * 0.50).toFixed(1)} ${(h * 0.34).toFixed(1)} ${(w * 0.84).toFixed(1)} ${(h * 0.82).toFixed(1)} L${(w * 0.74).toFixed(1)} ${(h * 0.82).toFixed(1)} Q${(w * 0.50).toFixed(1)} ${(h * 0.50).toFixed(1)} ${(w * 0.26).toFixed(1)} ${(h * 0.82).toFixed(1)} Z`, fill: PALETTE.paper, stroke: ink, "stroke-width": sw.toFixed(2) });

  if (isFull) {
    // Parapet rail
    penLineToGroup(group, [[w * 0.08, h * 0.58], [w * 0.50, h * 0.06], [w * 0.92, h * 0.58]], { tier: "structure", baseWidth: sw * 1.5, stroke: accent, rng });
    // Vertical struts
    repeat(group, 7, i => {
      const sx = w * (0.12 + i * 0.12);
      const sy = h * (0.52 - Math.abs(3 - i) * 0.07);
      penLineToGroup(group, [[sx, sy], [sx, sy + h * 0.14]], { tier: "structure", baseWidth: sw * 0.6, stroke: ink, rng });
    });
    // Stone block joints
    repeat(group, 12, i => {
      const bx = w * (0.04 + i * 0.08), by = h * (0.68 + (i % 4) * 0.05);
      penLineToGroup(group, [[bx, by], [bx + w * 0.03, by - h * 0.01]], { tier: "texture", baseWidth: sw * 0.2, stroke: shade(color, -8), rng });
    });
    // Water reflection
    add(group, "path", { d: `M0 ${(h * 0.90).toFixed(1)} Q${(w * 0.30).toFixed(1)} ${(h * 0.85).toFixed(1)} ${(w * 0.50).toFixed(1)} ${(h * 0.90).toFixed(1)} Q${(w * 0.70).toFixed(1)} ${(h * 0.95).toFixed(1)} ${w} ${(h * 0.90).toFixed(1)}`, fill: "none", stroke: PALETTE.waterLight, opacity: "0.45", "stroke-width": sw.toFixed(2), "data-line-tier": "atmosphere" });
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

  shadowEllipse(group, w * 0.50, h * 0.90, w * 0.50, h * 0.07);

  // Hull — curved bottom
  add(group, "path", {
    d: `M${(w * 0.08).toFixed(1)} ${(h * 0.62).toFixed(1)} Q${(w * 0.50).toFixed(1)} ${(h * 0.88).toFixed(1)} ${(w * 0.92).toFixed(1)} ${(h * 0.62).toFixed(1)} Q${(w * 0.80).toFixed(1)} ${(h * 0.95).toFixed(1)} ${(w * 0.24).toFixed(1)} ${(h * 0.93).toFixed(1)} Z`,
    fill: `url(#${namespaceId(ns, `grad-${entity.id}`)})`, stroke: ink, "stroke-width": sw.toFixed(2)
  });
  // Gunwale line
  penLineToGroup(group, [[w * 0.08, h * 0.62], [w * 0.50, h * 0.66], [w * 0.92, h * 0.62]],
    { tier: "structure", baseWidth: sw * 1.2, stroke: shade(color, -20), rng });

  // Mast
  penLineToGroup(group, [[w * 0.50, h * 0.14], [w * 0.50, h * 0.68]],
    { tier: "outline", baseWidth: sw * 1.5, stroke: ink, rng });
  // Mast rings
  penLineToGroup(group, [[w * 0.48, h * 0.38], [w * 0.52, h * 0.38]], { tier: "structure", baseWidth: sw * 0.5, stroke: shade(color, -20), rng });
  penLineToGroup(group, [[w * 0.48, h * 0.52], [w * 0.52, h * 0.52]], { tier: "structure", baseWidth: sw * 0.5, stroke: shade(color, -20), rng });

  // Main sail
  add(group, "path", { d: `M${(w * 0.50).toFixed(1)} ${(h * 0.16).toFixed(1)} L${(w * 0.50).toFixed(1)} ${(h * 0.58).toFixed(1)} L${(w * 0.16).toFixed(1)} ${(h * 0.52).toFixed(1)} Z`, fill: accent, stroke: ink, "stroke-width": sw.toFixed(2) });
  // Secondary sail
  add(group, "path", { d: `M${(w * 0.50).toFixed(1)} ${(h * 0.20).toFixed(1)} L${(w * 0.50).toFixed(1)} ${(h * 0.58).toFixed(1)} L${(w * 0.82).toFixed(1)} ${(h * 0.54).toFixed(1)} Z`, fill: shade(color, 12), stroke: ink, "stroke-width": sw.toFixed(2) });

  if (isFull) {
    // Sail seams
    repeat(group, 3, i => {
      penLineToGroup(group, [[w * (0.42 - i * 0.07), h * (0.28 + i * 0.08)], [w * (0.20 + i * 0.04), h * (0.52 + i * 0.01)]], { tier: "texture", baseWidth: sw * 0.22, stroke: shade(accent, -10), rng });
    });
    // Hull planks
    repeat(group, 6, i => {
      penLineToGroup(group, [[w * (0.14 + i * 0.10), h * 0.78], [w * (0.18 + i * 0.10), h * 0.72]], { tier: "texture", baseWidth: sw * 0.22, stroke: shade(color, -12), rng });
    });
    // Pennant
    penLineToGroup(group, [[w * 0.50, h * 0.14], [w * 0.58, h * 0.08], [w * 0.50, h * 0.16]], { tier: "structure", baseWidth: sw * 0.4, stroke: PALETTE.rose, rng });
    // Bow wave
    add(group, "path", { d: `M${(w * 0.08).toFixed(1)} ${(h * 0.80).toFixed(1)} Q${(w * 0.04).toFixed(1)} ${(h * 0.72).toFixed(1)} ${(w * 0.08).toFixed(1)} ${(h * 0.64).toFixed(1)}`, fill: "none", stroke: PALETTE.waterLight, opacity: "0.5", "stroke-width": sw.toFixed(2), "data-line-tier": "atmosphere" });
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

  shadowEllipse(group, w * 0.50, h * 0.93, w * 0.48, h * 0.05);

  // Backrest slats
  repeat(group, 3, i => {
    add(group, "rect", { x: (w * 0.10).toFixed(1), y: (h * (0.22 + i * 0.14)).toFixed(1), width: (w * 0.80).toFixed(1), height: (h * 0.09).toFixed(1), rx: (sw * 2).toFixed(1), fill: i % 2 ? color : shade(color, 12), stroke: ink, "stroke-width": sw.toFixed(2) });
  });
  // Top rail
  add(group, "rect", { x: (w * 0.08).toFixed(1), y: (h * 0.18).toFixed(1), width: (w * 0.84).toFixed(1), height: (h * 0.06).toFixed(1), rx: (sw * 2).toFixed(1), fill: shade(color, -10), stroke: ink, "stroke-width": sw.toFixed(2) });
  // Armrests
  add(group, "rect", { x: (w * 0.06).toFixed(1), y: (h * 0.46).toFixed(1), width: (w * 0.14).toFixed(1), height: (h * 0.06).toFixed(1), rx: (sw * 1.5).toFixed(1), fill: shade(color, -8), stroke: ink, "stroke-width": sw.toFixed(2) });
  add(group, "rect", { x: (w * 0.80).toFixed(1), y: (h * 0.46).toFixed(1), width: (w * 0.14).toFixed(1), height: (h * 0.06).toFixed(1), rx: (sw * 1.5).toFixed(1), fill: shade(color, -8), stroke: ink, "stroke-width": sw.toFixed(2) });
  // Seat
  add(group, "rect", { x: (w * 0.08).toFixed(1), y: (h * 0.66).toFixed(1), width: (w * 0.84).toFixed(1), height: (h * 0.12).toFixed(1), rx: (sw * 2).toFixed(1), fill: color, stroke: ink, "stroke-width": sw.toFixed(2) });

  // Legs — front and back with angle
  penLineToGroup(group, [[w * 0.16, h * 0.50], [w * 0.18, h * 0.75], [w * 0.14, h * 0.93]], { tier: "outline", baseWidth: sw * 1.5, stroke: PALETTE.deepInk, rng });
  penLineToGroup(group, [[w * 0.84, h * 0.50], [w * 0.82, h * 0.75], [w * 0.86, h * 0.93]], { tier: "outline", baseWidth: sw * 1.5, stroke: PALETTE.deepInk, rng });
  // Back legs
  penLineToGroup(group, [[w * 0.14, h * 0.22], [w * 0.16, h * 0.50]], { tier: "outline", baseWidth: sw * 1.2, stroke: ink, rng });
  penLineToGroup(group, [[w * 0.86, h * 0.22], [w * 0.84, h * 0.50]], { tier: "outline", baseWidth: sw * 1.2, stroke: ink, rng });

  if (isFull) {
    // Wood grain
    repeat(group, 10, i => {
      penLineToGroup(group, [[w * (0.12 + i * 0.07), h * 0.68], [w * (0.14 + i * 0.07), h * 0.69]], { tier: "texture", baseWidth: sw * 0.16, stroke: shade(color, -8), rng });
    });
    // Bolt details
    add(group, "circle", { cx: (w * 0.14).toFixed(1), cy: (h * 0.50).toFixed(1), r: (sw * 0.5).toFixed(2), fill: PALETTE.night, stroke: "none" });
    add(group, "circle", { cx: (w * 0.86).toFixed(1), cy: (h * 0.50).toFixed(1), r: (sw * 0.5).toFixed(2), fill: PALETTE.night, stroke: "none" });
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

  shadowEllipse(group, w * 0.50, h * 0.92, w * 0.50, h * 0.04);

  // Wheels with tire and rim
  const wheelR = Math.min(w, h) * 0.20;
  add(group, "circle", { cx: (w * 0.24).toFixed(1), cy: (h * 0.69).toFixed(1), r: (wheelR * 1.1).toFixed(1), fill: "none", stroke: PALETTE.deepInk, "stroke-width": (sw * 2.0).toFixed(2) });
  add(group, "circle", { cx: (w * 0.24).toFixed(1), cy: (h * 0.69).toFixed(1), r: wheelR.toFixed(1), fill: "none", stroke: ink, "stroke-width": (sw * 1.0).toFixed(2) });
  add(group, "circle", { cx: (w * 0.76).toFixed(1), cy: (h * 0.69).toFixed(1), r: (wheelR * 1.1).toFixed(1), fill: "none", stroke: PALETTE.deepInk, "stroke-width": (sw * 2.0).toFixed(2) });
  add(group, "circle", { cx: (w * 0.76).toFixed(1), cy: (h * 0.69).toFixed(1), r: wheelR.toFixed(1), fill: "none", stroke: ink, "stroke-width": (sw * 1.0).toFixed(2) });

  // Frame — diamond shape
  penLineToGroup(group, [[w * 0.24, h * 0.69], [w * 0.44, h * 0.36], [w * 0.58, h * 0.69]], { tier: "outline", baseWidth: sw * 1.8, stroke: color, rng });
  penLineToGroup(group, [[w * 0.44, h * 0.36], [w * 0.72, h * 0.36], [w * 0.76, h * 0.69]], { tier: "outline", baseWidth: sw * 1.8, stroke: color, rng });
  // Chain stay
  penLineToGroup(group, [[w * 0.58, h * 0.69], [w * 0.76, h * 0.69]], { tier: "structure", baseWidth: sw * 0.8, stroke: shade(color, -15), rng });

  // Handlebars
  penLineToGroup(group, [[w * 0.72, h * 0.36], [w * 0.68, h * 0.30], [w * 0.74, h * 0.24], [w * 0.80, h * 0.26]], { tier: "outline", baseWidth: sw * 1.2, stroke: ink, rng });
  // Seat post + saddle
  penLineToGroup(group, [[w * 0.44, h * 0.36], [w * 0.42, h * 0.30]], { tier: "outline", baseWidth: sw * 1.0, stroke: ink, rng });
  add(group, "ellipse", { cx: (w * 0.44).toFixed(1), cy: (h * 0.28).toFixed(1), rx: (w * 0.07).toFixed(1), ry: (h * 0.03).toFixed(1), fill: PALETTE.deepInk, stroke: ink, "stroke-width": sw.toFixed(2) });
  // Crank
  add(group, "circle", { cx: (w * 0.58).toFixed(1), cy: (h * 0.69).toFixed(1), r: (sw * 2.2).toFixed(2), fill: accent, stroke: ink, "stroke-width": sw.toFixed(2) });

  if (isFull) {
    // Spokes
    repeat(group, 20, i => {
      const a = i * Math.PI / 10;
      const cx = i < 10 ? w * 0.24 : w * 0.76;
      penLineToGroup(group, [[cx, h * 0.69], [cx + Math.cos(a) * wheelR * 0.88, h * 0.69 + Math.sin(a) * wheelR * 0.88]], { tier: "texture", baseWidth: sw * 0.15, stroke: ink, rng });
    });
    // Pedals
    penLineToGroup(group, [[w * 0.54, h * 0.72], [w * 0.62, h * 0.72]], { tier: "structure", baseWidth: sw * 0.6, stroke: PALETTE.deepInk, rng });
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

  // Pickets with pointed tops
  repeat(group, count, i => {
    const x = i * w / (count - 1);
    const pW = w * 0.05;
    add(group, "path", {
      d: `M${x.toFixed(1)} ${(h * 0.94).toFixed(1)} L${x.toFixed(1)} ${(h * 0.18).toFixed(1)} L${(x + pW * 0.5).toFixed(1)} ${(h * 0.08).toFixed(1)} L${(x + pW).toFixed(1)} ${(h * 0.18).toFixed(1)} L${(x + pW).toFixed(1)} ${(h * 0.94).toFixed(1)} Z`,
      fill: i % 2 ? color : shade(color, 12), stroke: ink, "stroke-width": sw.toFixed(2)
    });
    // Pickets nail detail
    if (isFull) {
      add(group, "circle", { cx: (x + pW * 0.5).toFixed(1), cy: (h * 0.46).toFixed(1), r: (sw * 0.3).toFixed(2), fill: PALETTE.night, stroke: "none" });
    }
  });

  // Horizontal rails
  add(group, "rect", { x: "0", y: (h * 0.42).toFixed(1), width: w.toString(), height: (h * 0.10).toFixed(1), fill: accent, stroke: ink, "stroke-width": sw.toFixed(2) });
  add(group, "rect", { x: "0", y: (h * 0.72).toFixed(1), width: w.toString(), height: (h * 0.10).toFixed(1), fill: shade(accent, -8), stroke: ink, "stroke-width": sw.toFixed(2) });

  if (isFull) {
    // Wood grain
    repeat(group, count, i => {
      penLineToGroup(group, [[i * w / count + w * 0.01, h * 0.50], [i * w / count + w * 0.02, h * 0.38]], { tier: "texture", baseWidth: sw * 0.14, stroke: shade(color, -8), rng });
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
    const top = h * (0.12 + (i % 3) * 0.10);
    const bw = w * 0.178;

    // Building body
    add(group, "rect", { x: x.toFixed(1), y: top.toFixed(1), width: bw.toFixed(1), height: (h - top).toFixed(1), rx: sw.toFixed(1), fill: i % 2 ? color : shade(color, -8), stroke: ink, "stroke-width": sw.toFixed(2) });
    // Rooftop
    add(group, "rect", { x: (x - bw * 0.02).toFixed(1), y: (top - h * 0.015).toFixed(1), width: (bw * 1.04).toFixed(1), height: (h * 0.03).toFixed(1), fill: shade(color, -15), stroke: ink, "stroke-width": sw.toFixed(2) });

    if (isFull) {
      // Windows with frames
      repeat(group, 3, row => {
        const wrx = x + bw * 0.20, wry = top + h * 0.10 + row * h * 0.20;
        add(group, "rect", { x: wrx.toFixed(1), y: wry.toFixed(1), width: (bw * 0.22).toFixed(1), height: (h * 0.09).toFixed(1), fill: (i + row) % 3 ? PALETTE.gold : PALETTE.night, opacity: "0.8", stroke: shade(ink, 30), "stroke-width": (sw * 0.3).toFixed(2) });
        add(group, "rect", { x: (wrx + bw * 0.36).toFixed(1), y: wry.toFixed(1), width: (bw * 0.22).toFixed(1), height: (h * 0.09).toFixed(1), fill: (i + row) % 2 ? PALETTE.gold : PALETTE.night, opacity: "0.7", stroke: shade(ink, 30), "stroke-width": (sw * 0.3).toFixed(2) });
        // Window cross
        penLineToGroup(group, [[wrx + bw * 0.11, wry], [wrx + bw * 0.11, wry + h * 0.09]], { tier: "texture", baseWidth: sw * 0.15, stroke: PALETTE.night, rng });
      });
      // Building base line
      penLineToGroup(group, [[x, h * 0.96], [x + bw, h * 0.96]], { tier: "structure", baseWidth: sw * 0.5, stroke: shade(color, -20), rng });
    }
  });

  return group;
}

function renderRain(entity, quality, namespace) {
  const { width: w, height: h, params = {} } = entity;
  const color = params.color || PALETTE.blue;
  const density = params.density || 0.5;
  const count = Math.max(6, Math.round(8 + density * 22));
  const isFull = quality === "full";
  const rng = createRNG(entity.id, "rain");
  const group = node("g", { "data-template": "rain", "data-art-style": "storybook-layered" });
  const sw = Math.max(1.2, Math.min(w, h) * 0.012);

  // Rain streaks with varied angle
  repeat(group, count, i => {
    const x = (i * 47) % w;
    const y = (i * 71) % h;
    const length = h * (0.04 + (i % 4) * 0.012);
    const angle = -0.08 + (i % 3) * 0.02;
    const dx = Math.sin(angle) * length;
    penLineToGroup(group, [[x, y], [x + dx, y + length]], {
      tier: i % 4 === 0 ? "structure" : "texture",
      baseWidth: sw * (0.5 + (i % 4) * 0.2),
      stroke: i % 3 ? color : shade(color, 12),
      opacity: 0.40 + (i % 5) * 0.12,
      rng: createRNG(entity.id, `rain-${i}`)
    });
  });

  if (isFull) {
    // Splash ripples
    repeat(group, Math.max(3, Math.round(count / 6)), i => {
      const sx = (i * 173 + w * 0.10) % w;
      const sy = h * (0.82 + (i % 4) * 0.03);
      add(group, "path", { d: `M${sx.toFixed(1)} ${sy.toFixed(1)} q${(w * 0.03).toFixed(1)} ${(-h * 0.03).toFixed(1)} ${(w * 0.06).toFixed(1)} 0`, fill: "none", stroke: shade(color, 12), opacity: "0.55", "stroke-width": sw.toFixed(2), "stroke-linecap": "round", "data-line-tier": "atmosphere" });
    });
    // Mist layer
    add(group, "ellipse", { cx: (w * 0.50).toFixed(1), cy: (h * 0.88).toFixed(1), rx: (w * 0.45).toFixed(1), ry: (h * 0.06).toFixed(1), fill: color, opacity: "0.06", stroke: "none" });
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
  add(group, "ellipse", { cx: (w * 0.50).toFixed(1), cy: (h * 0.78).toFixed(1), rx: (w * 0.46).toFixed(1), ry: (h * 0.14).toFixed(1), fill: shade(color, -30), opacity: "0.20", stroke: "none" });

  // Main cloud puffs — varied sizes and positions
  const puffs = [[w * 0.18, h * 0.63, h * 0.26], [w * 0.32, h * 0.54, h * 0.22], [w * 0.50, h * 0.56, h * 0.24], [w * 0.66, h * 0.58, h * 0.21], [w * 0.80, h * 0.65, h * 0.20], [w * 0.26, h * 0.52, h * 0.18], [w * 0.58, h * 0.51, h * 0.17]];
  puffs.forEach(([cx, cy, cr], pi) => {
    add(group, "circle", { cx: cx.toFixed(1), cy: cy.toFixed(1), r: cr.toFixed(1), fill: pi % 2 ? color : shade(color, 8), stroke: ink, "stroke-width": sw.toFixed(2) });
  });

  // Base
  penLineToGroup(group, [[w * 0.10, h * 0.72], [w * 0.32, h * 0.68], [w * 0.55, h * 0.74], [w * 0.78, h * 0.70], [w * 0.92, h * 0.72]], { tier: "structure", baseWidth: sw * 0.6, stroke: shade(color, -22), rng });

  if (isFull) {
    // Fluff texture
    repeat(group, 10, i => {
      penLineToGroup(group, [[w * (0.12 + i * 0.08), h * (0.46 + (i % 3) * 0.06)], [w * (0.15 + i * 0.08), h * (0.40 + (i % 3) * 0.04)]], { tier: "texture", baseWidth: sw * 0.22, stroke: shade(color, 5), rng });
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

  // Multi-layer glow
  add(group, "circle", { cx: (w * 0.50).toFixed(1), cy: (h * 0.50).toFixed(1), r: (Math.min(w, h) * 0.50).toFixed(1), fill: color, opacity: "0.06", stroke: "none" });
  add(group, "circle", { cx: (w * 0.50).toFixed(1), cy: (h * 0.50).toFixed(1), r: (r * 1.20).toFixed(1), fill: color, opacity: "0.10", stroke: "none" });
  // Sun body
  add(group, "circle", { cx: (w * 0.50).toFixed(1), cy: (h * 0.50).toFixed(1), r: r.toFixed(1), fill: `url(#${namespaceId(ns, `grad-${entity.id}`)})`, stroke: ink, "stroke-width": sw.toFixed(2) });

  // Rays — alternating long and short
  repeat(group, 12, i => {
    const a = i * Math.PI / 6;
    const len = i % 2 ? 1.38 : 1.18;
    const outerR = r * len;
    const innerR = r * 1.04;
    penLineToGroup(group, [
      [w * 0.50 + Math.cos(a) * innerR, h * 0.50 + Math.sin(a) * innerR],
      [w * 0.50 + Math.cos(a) * outerR, h * 0.50 + Math.sin(a) * outerR]
    ], { tier: "structure", baseWidth: sw * 1.0, stroke: shade(color, -8), rng: createRNG(entity.id, `ray-${i}`) });
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

  // Multi-layer glow
  add(group, "circle", { cx: (w * 0.50).toFixed(1), cy: (h * 0.50).toFixed(1), r: (Math.min(w, h) * 0.50).toFixed(1), fill: color, opacity: "0.07", stroke: "none" });
  add(group, "circle", { cx: (w * 0.50).toFixed(1), cy: (h * 0.50).toFixed(1), r: (r * 1.20).toFixed(1), fill: color, opacity: "0.12", stroke: "none" });
  // Moon body
  add(group, "circle", { cx: (w * 0.50).toFixed(1), cy: (h * 0.50).toFixed(1), r: r.toFixed(1), fill: `url(#${namespaceId(ns, `grad-${entity.id}`)})`, stroke: ink, "stroke-width": sw.toFixed(2) });
  // Crescent shadow
  add(group, "circle", { cx: (w * 0.66).toFixed(1), cy: (h * 0.38).toFixed(1), r: (r * 0.94).toFixed(1), fill: PALETTE.paper, stroke: "none" });

  if (isFull) {
    // Craters with rim detail
    add(group, "circle", { cx: (w * 0.36).toFixed(1), cy: (h * 0.42).toFixed(1), r: (r * 0.16).toFixed(1), fill: "none", stroke: shade(color, -15), opacity: "0.3", "stroke-width": (sw * 0.4).toFixed(2) });
    add(group, "circle", { cx: (w * 0.38).toFixed(1), cy: (h * 0.44).toFixed(1), r: (r * 0.13).toFixed(1), fill: shade(color, -15), opacity: "0.18", stroke: "none" });
    add(group, "circle", { cx: (w * 0.40).toFixed(1), cy: (h * 0.58).toFixed(1), r: (r * 0.09).toFixed(1), fill: shade(color, -15), opacity: "0.15", stroke: "none" });
    add(group, "circle", { cx: (w * 0.33).toFixed(1), cy: (h * 0.52).toFixed(1), r: (r * 0.06).toFixed(1), fill: shade(color, -15), opacity: "0.12", stroke: "none" });
  }

  return group;
}

function renderStars(entity, quality, namespace) {
  const { width: w, height: h, params = {} } = entity;
  const color = params.color || PALETTE.gold;
  const count = Math.max(4, Math.min(30, params.count || Math.round(6 + (params.density || 0.5) * 18)));
  const rng = createRNG(entity.id, "stars");
  const group = node("g", { "data-template": "stars", "data-art-style": "storybook-layered" });
  const sw = Math.max(1.2, Math.min(w, h) * 0.012);

  repeat(group, count, i => {
    const x = (i * 73) % w;
    const y = (i * 41) % h;
    const r = 1.5 + (i % 4);
    const opacity = 0.45 + (i % 4) * 0.15;
    // Four-pointed star
    add(group, "path", { d: `M${(x - r * 2.5).toFixed(1)} ${y.toFixed(1)} L${(x + r * 2.5).toFixed(1)} ${y.toFixed(1)} M${x.toFixed(1)} ${(y - r * 2.5).toFixed(1)} L${x.toFixed(1)} ${(y + r * 2.5).toFixed(1)}`, fill: "none", stroke: color, "stroke-width": (r * 0.55).toFixed(2), opacity: opacity.toFixed(2), "stroke-linecap": "round", "data-line-tier": "atmosphere" });
    // Center dot for bright stars
    if (i % 5 === 0) {
      add(group, "circle", { cx: x.toFixed(1), cy: y.toFixed(1), r: (sw * 0.5).toFixed(2), fill: PALETTE.cream, opacity: "0.8", stroke: "none" });
    }
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

  shadowEllipse(group, w * 0.50, h * 0.98, w * 0.44, h * 0.035);

  // Trunk — tapered with root flare
  add(group, "path", {
    d: `M${(w * 0.42).toFixed(1)} ${(h * 0.97).toFixed(1)} L${(w * 0.44).toFixed(1)} ${(h * 0.50).toFixed(1)} L${(w * 0.47).toFixed(1)} ${(h * 0.36).toFixed(1)} L${(w * 0.50).toFixed(1)} ${(h * 0.42).toFixed(1)} L${(w * 0.53).toFixed(1)} ${(h * 0.36).toFixed(1)} L${(w * 0.56).toFixed(1)} ${(h * 0.50).toFixed(1)} L${(w * 0.58).toFixed(1)} ${(h * 0.97).toFixed(1)} Z`,
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

  // Distant peak
  add(group, "path", { d: `M0 ${h} L${(w * 0.26).toFixed(1)} ${(h * 0.30).toFixed(1)} L${(w * 0.48).toFixed(1)} ${h} Z`, fill: shade(color, 18), stroke: ink, "stroke-width": sw.toFixed(2) });
  // Mid peak
  add(group, "path", { d: `M${(w * 0.06).toFixed(1)} ${h} L${(w * 0.40).toFixed(1)} ${(h * 0.20).toFixed(1)} L${(w * 0.70).toFixed(1)} ${h} Z`, fill: shade(color, 6), stroke: ink, "stroke-width": sw.toFixed(2) });

  // Main peak — irregular ridge
  add(group, "path", {
    d: `M${(w * 0.14).toFixed(1)} ${h} L${(w * 0.34).toFixed(1)} ${(h * 0.48).toFixed(1)} L${(w * 0.46).toFixed(1)} ${(h * 0.28).toFixed(1)} L${(w * 0.50).toFixed(1)} ${(h * 0.08).toFixed(1)} L${(w * 0.58).toFixed(1)} ${(h * 0.26).toFixed(1)} L${(w * 0.74).toFixed(1)} ${(h * 0.54).toFixed(1)} L${(w * 0.88).toFixed(1)} ${(h * 0.26).toFixed(1)} L${w} ${h} Z`,
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
    repeat(group, 5, i => {
      penLineToGroup(group, [[w * (0.24 + i * 0.10), h * (0.48 + i * 0.06)], [w * (0.28 + i * 0.10), h * (0.36 + i * 0.04)]],
        { tier: "texture", baseWidth: sw * 0.22, stroke: shade(color, -10), rng });
    });
    // Tree line
    repeat(group, 3, i => {
      add(group, "circle", { cx: (w * (0.18 + i * 0.28)).toFixed(1), cy: (h * (0.82 + i * 0.02)).toFixed(1), r: (sw * 0.9).toFixed(2), fill: PALETTE.foliageDark, opacity: "0.5", stroke: "none" });
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
    const { width: w, height: h, params = {}, templateId } = entity;
    const color = params.color || DEFAULT_COLORS[templateId] || PALETTE.green;
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

    group.insertBefore(defs, group.firstChild);
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
