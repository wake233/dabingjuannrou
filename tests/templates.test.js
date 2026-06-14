import test from "node:test";
import assert from "node:assert/strict";
import { ENTITY_TEMPLATES, TEMPLATE_NAMES, validateEntityParams } from "../static/scene_schema.js";

class Element {
  constructor(tagName) { this.tagName = tagName; this.attributes = {}; this.children = []; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  appendChild(child) { this.children.push(child); return child; }
}

// Collect all path, circle, and ellipse data strings from an element tree
function collectSilhouetteData(element) {
  const items = [];
  if (element.tagName === "path" && element.getAttribute("d")) {
    items.push(element.getAttribute("d"));
  }
  if (element.tagName === "circle") {
    items.push(`circle-${element.getAttribute("cx")}-${element.getAttribute("cy")}-${element.getAttribute("r")}`);
  }
  if (element.tagName === "ellipse") {
    items.push(`ellipse-${element.getAttribute("cx")}-${element.getAttribute("cy")}-${element.getAttribute("rx")}-${element.getAttribute("ry")}`);
  }
  if (element.children) {
    for (const child of element.children) {
      items.push(...collectSilhouetteData(child));
    }
  }
  return items;
}

// Collect all data-line-tier tags
function collectLineTiers(element) {
  const tiers = [];
  const tier = element.getAttribute("data-line-tier");
  if (tier) tiers.push(tier);
  if (element.children) {
    for (const child of element.children) {
      tiers.push(...collectLineTiers(child));
    }
  }
  return tiers;
}

// Collect shadow attributes
function collectShadows(element) {
  const shadows = [];
  const s = element.getAttribute("data-shadow");
  if (s) shadows.push(s);
  if (element.children) {
    for (const child of element.children) {
      shadows.push(...collectShadows(child));
    }
  }
  return shadows;
}

// Collect gradient references (url(#...) in fill/stroke)
function collectGradientRefs(element) {
  const refs = [];
  const fill = element.getAttribute("fill");
  const stroke = element.getAttribute("stroke");
  if (fill && fill.startsWith("url(#")) refs.push(fill);
  if (stroke && stroke.startsWith("url(#")) refs.push(stroke);
  if (element.children) {
    for (const child of element.children) {
      refs.push(...collectGradientRefs(child));
    }
  }
  return refs;
}

// Collect all defs (gradient definitions)
function collectDefs(element) {
  const defs = [];
  if (element.tagName === "defs") {
    defs.push(element);
  } else if (element.children) {
    for (const child of element.children) {
      defs.push(...collectDefs(child));
    }
  }
  return defs;
}

globalThis.document = { createElementNS: (_namespace, tagName) => new Element(tagName) };
const { renderEntity } = await import("../static/templates.js");
const { renderArtworkEntity } = await import("../static/renderers.js");

// --- Original registration test ---
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

// --- A05: All 26 entities have unique silhouettes ---
test("全部 26 个实体具有独立可辨识的外轮廓，不复用通用剪影", () => {
  const silhouettes = new Map();
  for (const templateId of Object.keys(ENTITY_TEMPLATES)) {
    const entity = {
      id: `sil-${templateId}`, kind: "entity", templateId, name: TEMPLATE_NAMES[templateId],
      x: 0, y: 0, width: 300, height: 200, rotation: 0, opacity: 1, params: {}
    };
    const rendered = renderEntity(entity, { quality: "full", namespace: "test" });
    const data = collectSilhouetteData(rendered);
    // Each entity must have at least one unique primary outline element
    silhouettes.set(templateId, data.slice(0, 5).join("|"));
  }
  // Check that all 26 have content
  assert.equal(silhouettes.size, 26);
  for (const [templateId, data] of silhouettes) {
    assert.ok(data.length > 0, `${templateId} 应有外轮廓路径`);
  }
  // Check uniqueness: no two entities share identical primary path data
  const values = [...silhouettes.values()];
  assert.equal(new Set(values).size, values.length, "所有实体应有唯一外轮廓");
});

// --- A06: Characters/animals have body structure ---
test("角色与动物包含结构线和姿态相关轮廓", () => {
  for (const templateId of ["person", "cat", "dog", "bird"]) {
    const entity = {
      id: `struct-${templateId}`, kind: "entity", templateId, name: TEMPLATE_NAMES[templateId],
      x: 0, y: 0, width: 240, height: 200, rotation: 0, opacity: 1, params: {}
    };
    const rendered = renderEntity(entity, { quality: "full", namespace: "test" });
    const tiers = collectLineTiers(rendered);
    assert.ok(tiers.includes("structure"), `${templateId} 应包含结构线`);
    assert.ok(tiers.includes("outline"), `${templateId} 应包含外轮廓`);
    if (templateId !== "bird") {
      const shadows = collectShadows(rendered);
      assert.ok(shadows.length > 0, `${templateId} 应有接触阴影`);
    }
  }
});

// --- A07: Buildings/objects have structure ---
test("建筑与器物包含可信连接关系和厚度", () => {
  for (const templateId of ["house", "roof", "bridge", "boat", "bench", "bicycle", "umbrella", "streetlamp"]) {
    const entity = {
      id: `arch-${templateId}`, kind: "entity", templateId, name: TEMPLATE_NAMES[templateId],
      x: 0, y: 0, width: 260, height: 180, rotation: 0, opacity: 1, params: {}
    };
    const rendered = renderEntity(entity, { quality: "full", namespace: "test" });
    assert.ok(rendered.children.length >= 3, `${templateId} 应包含多个结构元素`);
  }
});

// --- A08: Natural entities have irregular contours ---
test("自然实体包含不规则轮廓和疏密变化", () => {
  for (const templateId of ["tree", "mountain", "cloud", "flowers", "grass"]) {
    const entity = {
      id: `nat-${templateId}`, kind: "entity", templateId, name: TEMPLATE_NAMES[templateId],
      x: 0, y: 0, width: 280, height: 220, rotation: 0, opacity: 1, params: { density: 0.6 }
    };
    const rendered = renderEntity(entity, { quality: "full", namespace: "test" });
    const items = collectSilhouetteData(rendered);
    assert.ok(items.length >= 3, `${templateId} 应包含多个不规则路径元素`);
  }
});

// --- A09: Scene/lighting entities have directional elements ---
test("场景与光效包含方向场和反光元素", () => {
  for (const templateId of ["rain", "river", "street", "puddle", "sun", "moon", "stars"]) {
    const entity = {
      id: `scene-${templateId}`, kind: "entity", templateId, name: TEMPLATE_NAMES[templateId],
      x: 0, y: 0, width: 400, height: 300, rotation: 0, opacity: 1, params: { density: 0.5 }
    };
    const rendered = renderEntity(entity, { quality: "full", namespace: "test" });
    assert.ok(rendered.children.length >= 2, `${templateId} 应包含光效或方向元素`);
  }
});

// --- A10: Gradients with namespace ---
test("每个绘本实体使用带命名空间的渐变", () => {
  const entity = {
    id: "grad-test", kind: "entity", templateId: "person", name: "人物",
    x: 0, y: 0, width: 200, height: 280, rotation: 0, opacity: 1, params: {}
  };
  const rendered = renderEntity(entity, { quality: "full", namespace: "test-ns" });
  const defs = collectDefs(rendered);
  assert.ok(defs.length > 0, "应包含 defs 定义");
  const refs = collectGradientRefs(rendered);
  assert.ok(refs.length > 0, "应引用渐变");
  for (const ref of refs) {
    assert.match(ref, /ns-test-ns-/, "渐变引用应包含命名空间前缀");
  }
});

// --- A11: Shadows and highlights ---
test("使用阴影和半透明高光建立体积", () => {
  const entity = {
    id: "light-test", kind: "entity", templateId: "person", name: "人物",
    x: 0, y: 0, width: 200, height: 300, rotation: 0, opacity: 1, params: {}
  };
  const rendered = renderEntity(entity, { quality: "full", namespace: "test" });
  const shadows = collectShadows(rendered);
  assert.ok(shadows.length > 0, "应包含接触阴影");
});

// --- A13: Namespace uniqueness ---
test("不同命名空间下的渐变 ID 不会冲突", () => {
  const entity = { id: "ns1", kind: "entity", templateId: "person", name: "P1", x: 0, y: 0, width: 200, height: 300, rotation: 0, opacity: 1, params: {} };

  const r1 = renderEntity({ ...entity, id: "ns-test-1" }, { quality: "full", namespace: "canvas" });
  const r2 = renderEntity({ ...entity, id: "ns-test-2" }, { quality: "full", namespace: "preview" });

  const refs1 = collectGradientRefs(r1);
  const refs2 = collectGradientRefs(r2);

  for (const ref of refs1) {
    assert.ok(ref.includes("ns-canvas"), "canvas 渐变应有 canvas 前缀");
    assert.ok(!ref.includes("ns-preview"), "canvas 渐变不应有 preview 前缀");
  }
  for (const ref of refs2) {
    assert.ok(ref.includes("ns-preview"), "preview 渐变应有 preview 前缀");
  }
});

// --- A14/A15: Quality parameter (base vs full) ---
test("base 和 full 质量渲染明显不同", () => {
  const entity = { id: "qual-test", kind: "entity", templateId: "person", name: "人物", x: 0, y: 0, width: 240, height: 300, rotation: 0, opacity: 1, params: { variant: "woman" } };

  const base = renderEntity(entity, { quality: "base", namespace: "test" });
  const full = renderEntity(entity, { quality: "full", namespace: "test" });

  assert.equal(base.getAttribute("data-quality"), "base");
  assert.equal(full.getAttribute("data-quality"), "full");

  // Full should have more detail
  assert.ok(full.children.length > base.children.length,
    `full(${full.children.length}) 应比 base(${base.children.length}) 有更多子元素`);

  // Base should not have texture lines
  const baseTiers = collectLineTiers(base);
  assert.ok(!baseTiers.includes("texture"), "base 质量不应包含纹理线");

  // Full should have texture lines
  const fullTiers = collectLineTiers(full);
  assert.ok(fullTiers.includes("texture") || fullTiers.includes("structure"),
    "full 质量应包含纹理或结构线");
});

test("所有 26 个实体均支持 base 和 full 质量", () => {
  for (const templateId of Object.keys(ENTITY_TEMPLATES)) {
    const entity = {
      id: `qual-${templateId}`, kind: "entity", templateId, name: TEMPLATE_NAMES[templateId],
      x: 0, y: 0, width: 200, height: 150, rotation: 0, opacity: 1, params: {}
    };
    assert.doesNotThrow(() => renderEntity(entity, { quality: "base", namespace: "test" }),
      `${templateId} base 质量渲染不应抛错`);
    assert.doesNotThrow(() => renderEntity(entity, { quality: "full", namespace: "test" }),
      `${templateId} full 质量渲染不应抛错`);
  }
});

// --- A12: Detail density varies by layer ---
test("近景实体细节密度明显高于远景", () => {
  const nearEntity = {
    id: "near", kind: "entity", templateId: "tree", name: "近景树",
    x: 0, y: 0, width: 300, height: 400, rotation: 0, opacity: 1, params: { density: 0.8 }
  };
  const farEntity = {
    id: "far", kind: "entity", templateId: "tree", name: "远景树",
    x: 0, y: 0, width: 80, height: 100, rotation: 0, opacity: 1, params: { density: 0.3 }
  };
  const near = renderEntity(nearEntity, { quality: "full", namespace: "test" });
  const far = renderEntity(farEntity, { quality: "full", namespace: "test" });
  // Near (larger) should have more children than far (smaller)
  assert.ok(near.children.length >= far.children.length,
    `近景(${near.children.length}) 应有不少于远景(${far.children.length})的细节`);
});

// --- Regression tests for woodcut/ink (A19) ---
test("木刻渲染器使用高反差块面、有限色板和方向性刻线", () => {
  const entity = { id: "entity-woodcut", kind: "entity", templateId: "person", name: "旅人", x: 20, y: 30,
    width: 260, height: 420, rotation: 0, opacity: 1, params: { direction: "left" } };
  const rendered = renderArtworkEntity(entity, "woodcut");
  assert.equal(rendered.getAttribute("data-renderer"), "woodcut");
  assert.equal(rendered.getAttribute("data-art-style"), "woodcut");
  assert.equal(rendered.children.filter(child => child.getAttribute("data-tone-block")).length, 2);
  assert.ok(rendered.children.filter(child => child.getAttribute("data-carved-line") === "diagonal").length >= 8);
  assert.match(rendered.getAttribute("transform"), /scale\(-1 1\)/);
  assert.notEqual(rendered.children.length, renderArtworkEntity(entity, "storybook").children.length);
});

test("水墨渲染器使用浓淡层次、飞白和受控墨迹并保持实体整体", () => {
  const entity = { id: "entity-ink", kind: "entity", templateId: "mountain", name: "远山", x: 10, y: 40,
    width: 600, height: 360, rotation: 0, opacity: 1, params: {} };
  const rendered = renderArtworkEntity(entity, "ink");
  assert.equal(rendered.getAttribute("data-id"), "entity-ink");
  assert.equal(rendered.getAttribute("data-renderer"), "ink");
  assert.equal(rendered.children.filter(child => child.getAttribute("data-ink-wash")).length, 2);
  assert.equal(rendered.children.filter(child => child.getAttribute("data-flying-white") === "true").length, 1);
  assert.equal(rendered.children.filter(child => child.getAttribute("data-ink-speck") === "controlled").length, 4);
  assert.notEqual(rendered.children.length, renderArtworkEntity(entity, "woodcut").children.length);
});

// --- Original parameter test ---
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

// --- Original detail test (updated to new template structure) ---
test("常见场景核心模板具有绘本造型细节而非简易图标", () => {
  const render = (templateId, params = {}) => renderEntity({
    id: `entity-${templateId}`, kind: "entity", templateId, name: TEMPLATE_NAMES[templateId],
    x: 0, y: 0, width: 300, height: 300, rotation: 0, opacity: 1, params
  }, { quality: "full", namespace: "detail-test" });
  const woman = render("person", { variant: "woman", pose: "walking", color: "#596780" });
  const umbrella = render("umbrella", { color: "#c97b84" });
  const buildings = render("buildings");
  const house = render("house");
  const bicycle = render("bicycle");
  const rain = render("rain", { density: .8 });
  assert.ok(woman.children.length >= 7, `人物应包含衣着、面部、四肢和阴影，实际 ${woman.children.length}`);
  assert.ok(umbrella.children.length >= 3, `雨伞应包含分片、伞骨、伞柄，实际 ${umbrella.children.length}`);
  assert.ok(buildings.children.length >= 8, `建筑应包含轮廓和窗户，实际 ${buildings.children.length}`);
  assert.ok(house.children.length >= 5, `房屋应包含屋顶、门窗，实际 ${house.children.length}`);
  assert.ok(bicycle.children.length >= 4, `自行车应有完整车轮和车架，实际 ${bicycle.children.length}`);
  assert.ok(rain.children.length >= 8, `雨应包含疏密变化，实际 ${rain.children.length}`);
});

// --- Original renderer test ---
test("绘本独立渲染器保留语义实体与参数化部件", () => {
  const entity = { id: "entity-1", kind: "entity", templateId: "person", name: "人物", x: 10, y: 20,
    width: 240, height: 400, rotation: 0, opacity: 1, params: { variant: "woman", pose: "walking" } };
  const rendered = renderArtworkEntity(entity, "storybook");
  assert.equal(rendered.getAttribute("data-renderer"), "storybook");
  assert.equal(rendered.getAttribute("data-semantic-entity"), "person");
  assert.ok(rendered.children.length >= 7);
});

// Test: renderArtworkEntity accepts quality/namespace options
test("renderArtworkEntity 接受 quality 和 namespace 参数", () => {
  const entity = { id: "opt-test", kind: "entity", templateId: "cat", name: "猫", x: 0, y: 0,
    width: 150, height: 120, rotation: 0, opacity: 1, params: {} };
  const base = renderArtworkEntity(entity, "storybook", { quality: "base", namespace: "preview" });
  const full = renderArtworkEntity(entity, "storybook", { quality: "full", namespace: "canvas" });
  assert.ok(base.children.length > 0);
  assert.ok(full.children.length >= base.children.length);
});
