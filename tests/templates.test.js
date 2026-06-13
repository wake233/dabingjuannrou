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
  assert.equal(Object.keys(ENTITY_TEMPLATES).length, 18);
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
    assert.ok(rendered.children.length > 0, templateId);
  }
});

test("模板参数仅接受声明的受控值", () => {
  assert.doesNotThrow(() => validateEntityParams("cat", { color: "#596780", pose: "curled", direction: "left" }));
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
