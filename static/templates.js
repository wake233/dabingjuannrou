import { ENTITY_TEMPLATES, TEMPLATE_NAMES } from "./scene_schema.js";

const NS = "http://www.w3.org/2000/svg";
const PALETTE = Object.freeze({
  ink: "#4b5563", warm: "#d98f70", gold: "#e8c47c", green: "#86a886",
  blue: "#88a9bd", night: "#596780", paper: "#f4ead7"
});

function node(tag, attrs = {}) {
  const element = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}

function add(group, tag, attrs) {
  const element = node(tag, attrs);
  group.appendChild(element);
  return element;
}

function repeat(group, count, create) {
  for (let index = 0; index < count; index += 1) create(index);
}

function renderTemplate(entity) {
  const { templateId, width: w, height: h, params = {} } = entity;
  const color = params.color || (["rain", "river", "puddle", "cloud"].includes(templateId) ? PALETTE.blue : PALETTE.green);
  const accent = params.accent || PALETTE.warm;
  const ink = PALETTE.ink;
  const group = node("g", { "data-template": templateId, "stroke-linecap": "round", "stroke-linejoin": "round" });
  const line = { stroke: ink, "stroke-width": Math.max(2, Math.min(w, h) * .025), fill: "none" };
  if (templateId === "person") {
    add(group, "circle", { cx: w * .5, cy: h * .2, r: h * .12, fill: accent, stroke: ink });
    add(group, "path", { d: `M${w*.5} ${h*.32} L${w*.5} ${h*.68} M${w*.5} ${h*.42} L${w*.25} ${h*.55} M${w*.5} ${h*.42} L${w*.75} ${h*.55} M${w*.5} ${h*.68} L${w*.3} ${h*.94} M${w*.5} ${h*.68} L${w*.7} ${h*.94}`, ...line, stroke: color });
  } else if (templateId === "cat") {
    add(group, "ellipse", { cx: w*.48, cy: h*.62, rx: w*.32, ry: h*.25, fill: color, stroke: ink });
    add(group, "circle", { cx: w*.68, cy: h*.35, r: h*.2, fill: color, stroke: ink });
    add(group, "path", { d: `M${w*.55} ${h*.22} L${w*.6} 0 L${w*.7} ${h*.2} L${w*.82} 0 L${w*.82} ${h*.28} M${w*.2} ${h*.62} Q0 ${h*.45} ${w*.08} ${h*.25}`, ...line });
  } else if (templateId === "umbrella") {
    add(group, "path", { d: `M${w*.08} ${h*.45} Q${w*.5} 0 ${w*.92} ${h*.45} Z`, fill: color, stroke: ink });
    add(group, "path", { d: `M${w*.5} ${h*.45} L${w*.5} ${h*.9} Q${w*.5} ${h} ${w*.62} ${h*.92}`, ...line });
  } else if (templateId === "streetlamp") {
    add(group, "path", { d: `M${w*.5} ${h*.25} L${w*.5} ${h*.92} M${w*.25} ${h*.94} L${w*.75} ${h*.94}`, ...line });
    add(group, "circle", { cx: w*.5, cy: h*.18, r: h*.14, fill: accent, stroke: ink });
  } else if (templateId === "roof") {
    add(group, "path", { d: `M0 ${h*.7} L${w*.5} ${h*.08} L${w} ${h*.7} Z`, fill: color, stroke: ink });
    add(group, "rect", { x: w*.18, y: h*.65, width: w*.64, height: h*.3, fill: accent, stroke: ink });
  } else if (templateId === "buildings") {
    repeat(group, 5, index => add(group, "rect", { x: index*w*.2, y: h*(.2+(index%3)*.12), width: w*.18, height: h, fill: index%2 ? color : accent, stroke: ink }));
  } else if (templateId === "rain") {
    const count = Math.max(4, Math.round(8 + (params.density ?? .5) * 22));
    repeat(group, count, index => add(group, "line", { x1: (index*47)%w, y1: (index*71)%h, x2: (index*47)%w+w*.025, y2: (index*71)%h+h*.09, stroke: color, "stroke-width": 2 }));
  } else if (templateId === "cloud") {
    repeat(group, 4, index => add(group, "circle", { cx: w*(.2+index*.2), cy: h*(.58-(index%2)*.16), r: h*(.23+(index%2)*.06), fill: color, stroke: ink }));
  } else if (templateId === "sun" || templateId === "moon") {
    add(group, "circle", { cx: w*.5, cy: h*.5, r: Math.min(w,h)*.38, fill: color || PALETTE.gold, stroke: ink });
    if (templateId === "moon") add(group, "circle", { cx: w*.66, cy: h*.38, r: Math.min(w,h)*.36, fill: PALETTE.paper, stroke: "none" });
  } else if (templateId === "stars") {
    const count = Math.max(3, Math.min(30, params.count || Math.round(6+(params.density??.5)*18)));
    repeat(group, count, index => add(group, "circle", { cx: (index*73)%w, cy: (index*41)%h, r: 2+(index%3), fill: color || PALETTE.gold }));
  } else if (templateId === "tree") {
    add(group, "rect", { x: w*.42, y: h*.48, width: w*.16, height: h*.5, rx: 5, fill: accent, stroke: ink });
    repeat(group, 3, index => add(group, "circle", { cx: w*(.3+index*.2), cy: h*(.32-(index%2)*.1), r: h*.25, fill: color, stroke: ink }));
  } else if (templateId === "mountain") {
    add(group, "path", { d: `M0 ${h} L${w*.35} ${h*.12} L${w*.58} ${h*.55} L${w*.75} ${h*.25} L${w} ${h} Z`, fill: color, stroke: ink });
  } else if (templateId === "flowers") {
    const count = Math.max(3, Math.min(24, params.count || 10));
    repeat(group, count, index => {
      const x=(index*67)%w, y=h*.35+(index%4)*h*.15;
      add(group, "line", { x1:x, y1:y, x2:x, y2:h, stroke: PALETTE.green, "stroke-width":2 });
      add(group, "circle", { cx:x, cy:y, r:Math.max(3,h*.06), fill:index%2?color:accent, stroke:ink });
    });
  } else if (templateId === "river" || templateId === "street") {
    add(group, "path", { d: `M0 ${h*.25} Q${w*.35} ${h*.75} ${w*.55} ${h*.35} T${w} ${h*.55} L${w} ${h} Q${w*.65} ${h*.68} ${w*.45} ${h*.92} T0 ${h*.7} Z`, fill: color, stroke: ink });
  } else if (templateId === "grass") {
    add(group, "rect", { x:0, y:h*.35, width:w, height:h*.65, fill:color, stroke:ink });
    repeat(group, 12, index => add(group, "line", { x1:index*w/11, y1:h*.55, x2:index*w/11+w*.02, y2:h*.25, stroke:accent, "stroke-width":2 }));
  } else if (templateId === "puddle") {
    add(group, "ellipse", { cx:w*.5, cy:h*.55, rx:w*.46, ry:h*.3, fill:color, stroke:ink });
  }
  return group;
}

export function renderEntity(entity) {
  if (!(entity.templateId in ENTITY_TEMPLATES)) throw new Error("未知实体模板");
  const group = renderTemplate(entity);
  group.setAttribute("data-id", entity.id);
  group.setAttribute("data-name", entity.name);
  const direction = entity.params?.direction === "left" ? ` translate(${entity.width} 0) scale(-1 1)` : "";
  group.setAttribute("transform", `translate(${entity.x} ${entity.y}) rotate(${entity.rotation} ${entity.width/2} ${entity.height/2})${direction}`);
  group.setAttribute("opacity", entity.opacity);
  return group;
}

export { ENTITY_TEMPLATES, TEMPLATE_NAMES, PALETTE };
