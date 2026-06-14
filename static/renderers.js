import { renderEntity as renderStorybookEntity } from "./templates.js";
import { ART_STYLES } from "./art_schema.js";

const NS = "http://www.w3.org/2000/svg";

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

function woodcutSilhouette(entity) {
  const { width: w, height: h, templateId } = entity;
  const group = node("g", { "data-art-style": "woodcut", "stroke-linecap": "square", "stroke-linejoin": "miter" });
  const organic = ["person", "cat", "dog", "bird", "tree", "flowers", "grass", "cloud", "mountain"].includes(templateId);
  const base = organic
    ? node("path", { d: `M${w * .12} ${h * .86} Q${w * .05} ${h * .35} ${w * .5} ${h * .08} Q${w * .95} ${h * .35} ${w * .88} ${h * .86} Z`,
      fill: "#171411", stroke: "#f2e8cf", "stroke-width": Math.max(3, Math.min(w, h) * .025), "data-tone-block": "dark" })
    : node("path", { d: `M${w * .08} ${h * .9} L${w * .16} ${h * .18} L${w * .78} ${h * .08} L${w * .94} ${h * .82} Z`,
      fill: "#171411", stroke: "#f2e8cf", "stroke-width": Math.max(3, Math.min(w, h) * .025), "data-tone-block": "dark" });
  group.appendChild(base);
  group.appendChild(node("path", { d: `M${w * .2} ${h * .72} L${w * .48} ${h * .2} L${w * .82} ${h * .68} Z`,
    fill: "#9b2226", stroke: "#f2e8cf", "stroke-width": Math.max(2, Math.min(w, h) * .014), "data-tone-block": "accent" }));
  for (let index = 0; index < 9; index += 1) {
    const offset = index * w / 10;
    group.appendChild(node("path", { d: `M${offset} ${h} L${Math.min(w, offset + w * .32)} 0`, fill: "none",
      stroke: "#f2e8cf", "stroke-width": Math.max(1, Math.min(w, h) * .008), "data-carved-line": "diagonal" }));
  }
  return finish(group, entity, "woodcut");
}

function inkSilhouette(entity) {
  const { width: w, height: h, templateId } = entity;
  const group = node("g", { "data-art-style": "ink", "stroke-linecap": "round", "stroke-linejoin": "round" });
  const landscape = ["mountain", "river", "grass", "street", "buildings", "cloud"].includes(templateId);
  group.appendChild(node("ellipse", { cx: w * .48, cy: h * .62, rx: w * .44, ry: h * .31,
    fill: "#151515", opacity: landscape ? .18 : .3, stroke: "none", "data-ink-wash": "light" }));
  group.appendChild(node("ellipse", { cx: w * .52, cy: h * .55, rx: w * .3, ry: h * .4,
    fill: "#151515", opacity: landscape ? .32 : .55, stroke: "none", "data-ink-wash": "dark" }));
  group.appendChild(node("path", { d: `M${w * .08} ${h * .76} Q${w * .34} ${h * .1} ${w * .55} ${h * .38} T${w * .92} ${h * .2}`,
    fill: "none", stroke: "#151515", opacity: .8, "stroke-width": Math.max(3, Math.min(w, h) * .026), "data-ink-mark": "gesture" }));
  group.appendChild(node("path", { d: `M${w * .12} ${h * .88} Q${w * .42} ${h * .68} ${w * .88} ${h * .82}`,
    fill: "none", stroke: "#151515", opacity: .62, "stroke-width": Math.max(4, Math.min(w, h) * .034),
    "stroke-dasharray": `${Math.max(4, w * .08)} ${Math.max(3, w * .035)}`, "data-flying-white": "true" }));
  for (let index = 0; index < 4; index += 1) {
    group.appendChild(node("circle", { cx: w * (.22 + index * .17), cy: h * (.28 + (index % 2) * .12),
      r: Math.max(2, Math.min(w, h) * (.012 + index * .004)), fill: "#151515", opacity: .25 + index * .12, "data-ink-speck": "controlled" }));
  }
  return finish(group, entity, "ink");
}

/**
 * Render an artwork entity in the specified style.
 *
 * @param {object} entity - Entity object
 * @param {string} style - "storybook", "woodcut", or "ink"
 * @param {object} [options] - Rendering options
 * @param {string} [options.quality="full"] - "base" or "full" (storybook only)
 * @param {string} [options.namespace="canvas"] - SVG id namespace
 * @returns {SVGElement} SVG group element
 */
export function renderArtworkEntity(entity, style = "storybook", options = {}) {
  if (!ART_STYLES.includes(style)) throw new Error("艺术风格无效");
  if (style === "woodcut") return woodcutSilhouette(entity);
  if (style === "ink") return inkSilhouette(entity);
  const rendered = renderStorybookEntity(entity, {
    quality: options.quality || "full",
    namespace: options.namespace || "canvas"
  });
  rendered.setAttribute("data-renderer", style);
  rendered.setAttribute("data-semantic-entity", entity.templateId);
  return rendered;
}
