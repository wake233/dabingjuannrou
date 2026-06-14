import { renderArtworkEntity } from "./renderers.js";

const scene = [
  { id: "entity-cloud", kind: "entity", templateId: "cloud", name: "云", x: 20, y: 10, width: 290, height: 90, rotation: 0, opacity: 1, params: {} },
  { id: "entity-street", kind: "entity", templateId: "street", name: "街道", x: 0, y: 220, width: 360, height: 140, rotation: 0, opacity: 1, params: {} },
  { id: "entity-lamp", kind: "entity", templateId: "streetlamp", name: "路灯", x: 265, y: 95, width: 65, height: 230, rotation: 0, opacity: 1, params: {} },
  { id: "entity-person", kind: "entity", templateId: "person", name: "人物", x: 130, y: 120, width: 85, height: 220, rotation: 0, opacity: 1, params: { variant: "woman", pose: "walking" } },
  { id: "entity-umbrella", kind: "entity", templateId: "umbrella", name: "伞", x: 95, y: 75, width: 160, height: 130, rotation: 0, opacity: 1, params: { color: "#b56576" } }
];

const descriptions = {
  storybook: "柔和轮廓、层叠部件、明确前中后景。",
  woodcut: "高反差块面、有限色板、方向性刻线。",
  ink: "浓淡墨层、留白节奏、飞白与受控墨迹。"
};

for (const style of ["storybook", "woodcut", "ink"]) {
  const article = document.createElement("article");
  article.innerHTML = `<h2>${({ storybook: "层叠绘本", woodcut: "木刻版画", ink: "水墨" })[style]}</h2>`;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 360 360");
  svg.setAttribute("data-gallery-style", style);
  scene.forEach(entity => svg.appendChild(renderArtworkEntity(entity, style)));
  const note = document.createElement("p");
  note.className = "note";
  note.textContent = descriptions[style];
  article.append(svg, note);
  document.getElementById("gallery").appendChild(article);
}
