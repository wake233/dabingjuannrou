import test from "node:test";
import assert from "node:assert/strict";
import { ENTITY_TEMPLATES, TEMPLATE_NAMES, validateEntityParams } from "../static/scene_schema.js";

class Element {
  constructor(tagName) { this.tagName = tagName; this.attributes = {}; this.children = []; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  appendChild(child) { this.children.push(child); return child; }
}

globalThis.document = { createElementNS: (_namespace, tagName) => new Element(tagName) };
const { renderEntity } = await import("../static/templates.js");

test("可信绘本模板注册表覆盖首批实体且均可整体渲染", () => {
  assert.equal(Object.keys(ENTITY_TEMPLATES).length, 26);
  assert.deepEqual(new Set(Object.keys(ENTITY_TEMPLATES)), new Set(Object.keys(TEMPLATE_NAMES)));
  for (const [index, templateId] of Object.keys(ENTITY_TEMPLATES).entries()) {
    const entity = {
      id: `entity-${index + 1}`, kind: "entity", templateId, name: TEMPLATE_NAMES[templateId],
      x: 10, y: 20, width: 240, height: 160, rotation: 0, opacity: 1, params: {}
    };
    const rendered = renderEntity(entity);
    assert.equal(rendered.tagName, "g", templateId);
    assert.equal(rendered.getAttribute("data-template"), templateId);
    assert.equal(rendered.getAttribute("data-id"), entity.id);
    assert.equal(rendered.getAttribute("data-art-style"), "storybook-layered", templateId);
    assert.ok(rendered.children.length > 0, templateId);
  }
});

test("常见场景核心模板具有绘本造型细节而非简易图标", () => {
  const render = (templateId, params = {}) => renderEntity({
    id: `entity-${templateId}`, kind: "entity", templateId, name: TEMPLATE_NAMES[templateId],
    x: 0, y: 0, width: 300, height: 300, rotation: 0, opacity: 1, params
  });
  const woman = render("person", { variant: "woman", pose: "walking", color: "#596780" });
  const umbrella = render("umbrella", { color: "#c97b84" });
  const buildings = render("buildings");
  const house = render("house");
  const bicycle = render("bicycle");
  const rain = render("rain", { density: .8 });
  assert.ok(woman.children.length >= 10, "人物应包含衣着、面部、四肢和阴影");
  assert.ok(umbrella.children.length >= 5, "雨伞应包含分片、伞骨、伞柄和阴影");
  assert.ok(buildings.children.length >= 20, "建筑应包含轮廓和窗户层次");
  assert.ok(house.children.length >= 7, "房屋应包含屋顶、门窗和烟囱");
  assert.ok(bicycle.children.length >= 5, "自行车应有完整车轮和车架");
  assert.ok(rain.children.length >= 25, "雨应包含疏密变化和落地水花");
});

test("模板参数仅接受声明的受控值", () => {
  assert.doesNotThrow(() => validateEntityParams("cat", { color: "#596780", pose: "curled", direction: "left" }));
  assert.doesNotThrow(() => validateEntityParams("person", { variant: "woman" }));
  assert.throws(() => validateEntityParams("person", { variant: "robot" }));
  assert.throws(() => validateEntityParams("cat", { density: .5 }));
  assert.throws(() => validateEntityParams("rain", { svg: "<path/>" }));
  assert.throws(() => validateEntityParams("rain", { density: 2 }));
  assert.throws(() => validateEntityParams("dragon", {}));
  const cat = renderEntity({
    id: "entity-1", kind: "entity", templateId: "cat", name: "猫", x: 0, y: 0,
    width: 120, height: 100, rotation: 0, opacity: 1, params: { direction: "left" }
  });
  assert.match(cat.getAttribute("transform"), /scale\(-1 1\)/);
});
