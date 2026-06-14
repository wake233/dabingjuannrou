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

export function renderArtworkEntity(entity, style = "storybook") {
  if (!ART_STYLES.includes(style)) throw new Error("艺术风格无效");
  if (style === "woodcut") return woodcutSilhouette(entity);
  const rendered = renderStorybookEntity(entity);
  rendered.setAttribute("data-renderer", style);
  rendered.setAttribute("data-semantic-entity", entity.templateId);
  return rendered;
}
