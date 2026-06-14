import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { FLAGSHIP_THEME_CONFIGS, ART_DIRECTOR_RULES, runArtDirector } from "../static/art_director.js";
import { evaluateFlagshipPortfolio, scoreFlagshipScene } from "../static/quality_score.js";

class Element {
  constructor(tagName) { this.tagName = tagName; this.attributes = {}; this.children = []; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  appendChild(child) { this.children.push(child); return child; }
  insertBefore(child, reference) {
    const index = this.children.indexOf(reference);
    if (index < 0) this.children.push(child); else this.children.splice(index, 0, child);
    return child;
  }
  get firstChild() { return this.children[0] || null; }
}

globalThis.document = { createElementNS: (_namespace, tagName) => new Element(tagName) };
const { renderEntity } = await import("../static/templates.js");
const descendants = element => [element, ...element.children.flatMap(descendants)];

test("艺术导演使用统一严格规则并配置全部 12 个旗舰题材", () => {
  assert.equal(Object.keys(FLAGSHIP_THEME_CONFIGS).length, 12);
  assert.equal(ART_DIRECTOR_RULES.minDepthLayers, 3);
  assert.ok(ART_DIRECTOR_RULES.minFocusAreaRatio >= 0.06);
  for (const config of Object.values(FLAGSHIP_THEME_CONFIGS)) {
    assert.ok(config.requiredRoles.length > 0);
    assert.equal(config.depthPriority.length, 3);
    assert.ok(config.narrativeElements.length > 0);
  }
});

test("艺术导演会修改真实几何并在校正后重新验收", () => {
  const entities = [
    { kind: "entity", id: "focus", name: "focus", templateId: "person", role: "focus", x: 480, y: 330, width: 20, height: 30, layer: 0, params: {} },
    { kind: "entity", id: "tree", name: "tree", templateId: "tree", x: 490, y: 335, width: 30, height: 40, layer: 0, params: {} },
    { kind: "entity", id: "cloud", name: "cloud", templateId: "cloud", x: 500, y: 340, width: 30, height: 20, layer: 0, params: {} }
  ];
  const before = { ...entities[0] };
  const result = runArtDirector(entities, { theme: "mountain-traveler" });
  assert.ok(result.corrections.length >= 2);
  assert.ok(entities[0].width > before.width);
  assert.equal(new Set(entities.map(entity => entity.layer)).size, 3);
});

test("12 个旗舰题材各两稿通过结构质量门禁", () => {
  const results = evaluateFlagshipPortfolio();
  assert.equal(results.length, 12);
  assert.ok(results.every(entry => entry.drafts.length === 2));
  assert.ok(results.every(entry => entry.passed), results.filter(entry => !entry.passed).map(entry => entry.themeId).join(","));
});

test("结构质量评分会拒绝主体极小且缺少层次的差场景", () => {
  const result = scoreFlagshipScene("rain-woman", [
    { kind: "entity", id: "tiny", name: "tiny", templateId: "person", role: "focus", x: 490, y: 340, width: 8, height: 10, layer: 0, params: {} }
  ]);
  assert.equal(result.passed, false);
  assert.ok(result.score < 72);
});

test("人物 SVG 使用受控颜色和连续、比例受限的共享骨架肢体", () => {
  const render = pose => renderEntity({
    id: `person-${pose}`, kind: "entity", templateId: "person", name: pose,
    x: 0, y: 0, width: 240, height: 400, rotation: 0, opacity: 1,
    params: { variant: "woman", pose, color: "#596780" }
  }, { quality: "full", namespace: "quality" });
  const standing = render("standing");
  const walking = render("walking");
  const standingNodes = descendants(standing);
  assert.ok(standingNodes.some(node => node.getAttribute("data-anatomy") === "organic-torso"));
  const segments = standingNodes.filter(node => node.getAttribute("data-anatomy") === "limb-segment");
  const joints = standingNodes.filter(node => node.getAttribute("data-joint"));
  assert.equal(segments.length, 8);
  assert.equal(joints.length, 4);

  const forbiddenBlack = new Set(["black", "#000", "#000000", "rgb(0,0,0)", "rgb(0, 0, 0)"]);
  for (const node of standingNodes) {
    assert.ok(!forbiddenBlack.has(node.getAttribute("fill")), `unexpected black fill on ${node.tagName}`);
    assert.ok(!forbiddenBlack.has(node.getAttribute("stroke")), `unexpected black stroke on ${node.tagName}`);
  }

  const limbColors = new Map();
  for (const segment of segments) {
    const limb = segment.getAttribute("data-limb");
    const stroke = segment.getAttribute("stroke");
    const width = Number(segment.getAttribute("stroke-width"));
    assert.match(stroke, /^#[0-9a-f]{6}$/i);
    assert.ok(width >= 14 && width <= 20, `${limb} width ${width} outside controlled range`);
    assert.equal(segment.getAttribute("fill"), "none");
    limbColors.set(limb, stroke);
  }
  assert.equal(limbColors.get("left-arm"), limbColors.get("right-arm"));
  assert.equal(limbColors.get("left-leg"), limbColors.get("right-leg"));

  const point = value => value.split(/\s+/).map(Number);
  for (const limb of ["left-arm", "right-arm", "left-leg", "right-leg"]) {
    const chain = segments.filter(node => node.getAttribute("data-limb") === limb);
    const firstEnd = point(chain[0].getAttribute("d").match(/L([\d.]+ [\d.]+)$/)[1]);
    const secondStart = point(chain[1].getAttribute("d").match(/^M([\d.]+ [\d.]+)/)[1]);
    assert.deepEqual(firstEnd, secondStart, `${limb} segments must meet`);
    const joint = joints.find(node => node.getAttribute("data-limb") === limb);
    assert.deepEqual(firstEnd, [Number(joint.getAttribute("cx")), Number(joint.getAttribute("cy"))], `${limb} joint must sit on connection`);
  }

  const garment = standingNodes.find(node => node.getAttribute("data-anatomy") === "lower-garment");
  assert.ok(garment);
  const garmentNumbers = garment.getAttribute("d").match(/[\d.]+/g).map(Number);
  const garmentYs = garmentNumbers.filter((_, index) => index % 2 === 1);
  assert.ok(Math.max(...garmentYs) <= 400 * 0.73, "lower garment must not become a giant lower-body block");

  const paths = root => descendants(root).filter(node => node.tagName === "path").map(node => node.getAttribute("d")).join("|");
  assert.notEqual(paths(standing), paths(walking));
});

test("云与草地的可见 SVG 实际消费开源适配器", () => {
  for (const templateId of ["cloud", "grass"]) {
    const rendered = renderEntity({
      id: templateId, kind: "entity", templateId, name: templateId,
      x: 0, y: 0, width: 500, height: 240, rotation: 0, opacity: 1, params: {}
    }, { quality: "full", namespace: "quality" });
    assert.ok(descendants(rendered).some(node => node.getAttribute("data-art-adapter")), templateId);
  }
});

test("主 app 可见渲染入口调用统一艺术管线而非仅附加元数据", () => {
  const source = fs.readFileSync(new URL("../static/app.js", import.meta.url), "utf8");
  assert.match(source, /function prepareArtRenderObjects[\s\S]*executeArtPipeline\(/);
  assert.match(source, /function renderObjects[\s\S]*prepareArtRenderObjects\(/);
  assert.match(source, /data-art-pipeline/);
  assert.match(source, /data-art-director/);
});

test("20 个实体完整精绘低于 500ms", () => {
  const templateIds = ["person", "tree", "cloud", "grass", "house", "dog", "flowers", "river", "mountain", "bird"];
  const entities = Array.from({ length: 20 }, (_, index) => ({
    id: `perf-${index}`, kind: "entity", templateId: templateIds[index % templateIds.length], name: `perf-${index}`,
    x: 0, y: 0, width: 240, height: 260, rotation: 0, opacity: 1, params: {}
  }));
  const started = process.hrtime.bigint();
  for (const entity of entities) renderEntity(entity, { quality: "full", namespace: "performance" });
  const duration = Number(process.hrtime.bigint() - started) / 1_000_000;
  assert.ok(duration < 500, `20 entity full render took ${duration.toFixed(1)}ms`);
});
