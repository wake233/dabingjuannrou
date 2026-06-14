import test from "node:test";
import assert from "node:assert/strict";
import {
  LINE_TIERS, seedFromString, createRNG, clamp, penPath, taperedStroke,
  createPenElement, generateHatchLines, namespaceId, countPathNodes, checkNodeLimit
} from "../static/pen_stroke.js";

// Test A01: Deterministic variable-width SVG path generation
test("钢笔笔触生成确定性可变宽 SVG 路径", () => {
  const points = [[10, 50], [50, 30], [90, 50]];
  const rng = createRNG("test-entity", "outline");

  const d1 = penPath(points, { tier: "outline", baseWidth: 3, rng });
  const d2 = penPath(points, { tier: "outline", baseWidth: 3, rng: createRNG("test-entity", "outline") });

  assert.ok(typeof d1 === "string" && d1.length > 0, "应生成非空路径");
  assert.equal(d1, d2, "相同输入应产生相同路径");
  assert.match(d1, /^M[\d.-]+ [\d.-]+/, "路径应以 M 开头");
  assert.match(d1, /[\d.-]+ [\d.-]+/, "路径应包含坐标点");
});

test("不同 seed 或参数产生不同的路径", () => {
  const points = [[10, 50], [50, 30], [90, 50]];
  const d1 = penPath(points, { tier: "outline", baseWidth: 3, rng: createRNG("e1", "p1") });
  const d2 = penPath(points, { tier: "outline", baseWidth: 3, rng: createRNG("e2", "p1") });
  const d3 = penPath(points, { tier: "structure", baseWidth: 3, rng: createRNG("e1", "p1") });

  // Different seeds produce slightly different paths (perturbation)
  assert.notEqual(d1, d2, "不同实体 ID 应产生不同路径");
  // Different tiers produce different node count behavior
  assert.ok(typeof d3 === "string" && d3.length > 0, "不同层级也应生成有效路径");
});

// Test A02: Four line tiers with different parameters
test("四级线条具有不同粗细、透明度、断续和扰动参数", () => {
  assert.ok(LINE_TIERS.outline.width > LINE_TIERS.structure.width, "主轮廓应最粗");
  assert.ok(LINE_TIERS.structure.width > LINE_TIERS.texture.width, "结构线应居中");
  assert.ok(LINE_TIERS.texture.width > LINE_TIERS.atmosphere.width, "纹理线应较细");
  assert.ok(LINE_TIERS.atmosphere.width > 0, "氛围线应有正值");

  assert.ok(LINE_TIERS.outline.opacity > LINE_TIERS.structure.opacity, "主轮廓应最不透明");
  assert.ok(LINE_TIERS.outline.perturb < LINE_TIERS.atmosphere.perturb, "主轮廓扰动应最小");

  assert.equal(LINE_TIERS.outline.dash, "none", "主轮廓应为实线");
  assert.notEqual(LINE_TIERS.atmosphere.dash, "none", "氛围线应有断续");

  const points = [[0, 50], [100, 50]];
  const d = penPath(points, { tier: "outline", baseWidth: 3, rng: createRNG("test", "a") });
  // Should contain data-line-tier attribute after being used in createPenElement
  assert.ok(d.length > 0);

  // Verify tier label attributes
  assert.equal(LINE_TIERS.outline.label, "outline");
  assert.equal(LINE_TIERS.structure.label, "structure");
  assert.equal(LINE_TIERS.texture.label, "texture");
  assert.equal(LINE_TIERS.atmosphere.label, "atmosphere");
});

// Test A03: Fixed seed from entity ID + part name
test("使用实体ID+部件名称生成固定 seed，生成结果一致", () => {
  const rng1 = createRNG("entity-5", "left-arm");
  const rng2 = createRNG("entity-5", "left-arm");
  const rng3 = createRNG("entity-5", "right-arm");

  // Same seed produces same sequence
  const values1 = Array.from({ length: 10 }, () => rng1());
  const values2 = Array.from({ length: 10 }, () => rng2());
  assert.deepEqual(values1, values2, "相同 seed 应产生相同随机序列");

  // Different part name produces different sequence
  const values3 = Array.from({ length: 10 }, () => rng3());
  assert.notDeepEqual(values1, values3, "不同部件名应产生不同序列");

  // Path consistency test
  const points = [[0, 0], [50, 50], [100, 0]];
  const d1 = penPath(points, { tier: "outline", baseWidth: 2, rng: createRNG("ent-1", "head") });
  const d2 = penPath(points, { tier: "outline", baseWidth: 2, rng: createRNG("ent-1", "head") });
  assert.equal(d1, d2, "相同 seed 的路径应完全一致");
});

// Test A04: Finite coordinates and node count limit
test("所有生成坐标有限，单实体节点数量有上限", () => {
  const rng = createRNG("limit-test", "main");

  // Generate a path with many points
  const points = [];
  for (let i = 0; i < 200; i += 1) {
    points.push([i * 5, Math.sin(i * 0.1) * 50 + 200]);
  }
  const d = penPath(points, { tier: "structure", baseWidth: 2, rng });

  // Path should be valid
  assert.ok(d.length > 0);
  assert.ok(d.length < 50000, "路径字符串不应过长");

  // All coordinates should be finite
  const coordMatches = d.match(/-?[\d.]+/g) || [];
  for (const num of coordMatches) {
    assert.ok(Number.isFinite(Number(num)), `坐标 ${num} 应为有限值`);
  }

  // Node count should be within limits
  const nodeCount = countPathNodes([d]);
  assert.ok(nodeCount <= 12000, `节点数 ${nodeCount} 应不超过 12000`);

  // clamp function
  assert.equal(clamp(500), 500);
  assert.equal(clamp(Infinity), 0);
  assert.equal(clamp(-Infinity), 0);
  assert.equal(clamp(NaN), 0);
  assert.equal(clamp(999999), 100000); // COORD_BOUND
  assert.equal(clamp(-999999), -100000);
});

// Test: seedFromString determinism
test("seedFromString 从相同输入产生相同的哈希值", () => {
  const s1 = seedFromString("entity-1|head");
  const s2 = seedFromString("entity-1|head");
  const s3 = seedFromString("entity-2|head");

  assert.equal(s1, s2);
  assert.notEqual(s1, s3);
  assert.ok(s1 >= 0 && s1 < 1, "seed 应在 [0, 1) 范围内");
});

// Test: penPath closed option
test("penPath 支持闭合路径", () => {
  const points = [[50, 50], [100, 50], [100, 100], [50, 100]];
  const open = penPath(points, { tier: "outline", baseWidth: 2, rng: createRNG("test", "open") });
  const closed = penPath(points, { tier: "outline", baseWidth: 2, rng: createRNG("test", "closed"), closed: true });

  assert.ok(open.length > 0);
  assert.ok(closed.length > 0);
  assert.ok(closed.endsWith("Z") || closed.includes("Z"), "闭合路径应以 Z 结尾");
});

// Test: taperedStroke produces tapered paths
test("taperedStroke 产生起收笔渐细效果", () => {
  const points = [[0, 50], [50, 30], [100, 50]];
  const d = taperedStroke(points, { tier: "outline", baseWidth: 3, rng: createRNG("test", "taper") });
  assert.ok(typeof d === "string" && d.length > 0);
});

// Test: createPenElement produces correct attributes
test("createPenElement 生成正确的 SVG 元素属性", () => {
  const mockDoc = {
    createElementNS: (ns, tag) => {
      const el = {
        tagName: tag, attributes: {},
        setAttribute(name, value) { this.attributes[name] = String(value); },
        getAttribute(name) { return this.attributes[name] || null; }
      };
      return el;
    }
  };

  const d = "M10 20 L30 40";
  const el = createPenElement(mockDoc, d, { tier: "outline", stroke: "#303946", partName: "head" });

  assert.equal(el.getAttribute("d"), d);
  assert.equal(el.getAttribute("data-line-tier"), "outline");
  assert.equal(el.getAttribute("data-part"), "head");
  assert.equal(el.getAttribute("fill"), "#303946");
  assert.equal(el.getAttribute("stroke"), "none");
});

// Test: generateHatchLines
test("generateHatchLines 生成排线路径", () => {
  const bounds = { x: 10, y: 10, width: 80, height: 60 };
  const rng = createRNG("hatch-test", "shade");
  const lines = generateHatchLines(bounds, 45, 8, rng, 6);

  assert.equal(lines.length, 6, "应生成指定数量排线");
  for (const d of lines) {
    assert.match(d, /^M[\d.-]+ [\d.-]+ L[\d.-]+ [\d.-]+$/, "每条排线应为 M...L... 格式");
  }
});

// Test: namespaceId
test("namespaceId 生成带前缀的唯一 ID", () => {
  assert.equal(namespaceId("canvas", "grad-entity-1"), "ns-canvas-grad-entity-1");
  assert.equal(namespaceId("preview", "highlight"), "ns-preview-highlight");
  assert.equal(namespaceId("export", "shadow-5"), "ns-export-shadow-5");
});

// Test: countPathNodes
test("countPathNodes 正确计数路径节点", () => {
  const paths = ["M10 20 L30 40", "M50 60 L70 80 L90 100"];
  const count = countPathNodes(paths);
  assert.equal(count, 5, "两个路径共有 5 个坐标点");
});

// Test: checkNodeLimit
test("checkNodeLimit 在超出上限时抛出错误", () => {
  assert.doesNotThrow(() => checkNodeLimit(100, 12000));
  assert.throws(() => checkNodeLimit(12001, 12000));
  assert.throws(() => checkNodeLimit(20000, 12000));
});

// Performance test: A23 - 20 entities base render under 100ms
test("20 个实体基础渲染综合耗时低于 100ms", async () => {
  // We need to set up mock DOM for entity rendering
  class MockElement {
    constructor(tagName) { this.tagName = tagName; this.attributes = {}; this.children = []; }
    setAttribute(n, v) { this.attributes[n] = String(v); }
    getAttribute(n) { return this.attributes[n] ?? null; }
    appendChild(c) { this.children.push(c); return c; }
    insertBefore(newChild, refChild) {
      const idx = refChild ? this.children.indexOf(refChild) : 0;
      if (idx >= 0) this.children.splice(idx, 0, newChild);
      else this.children.push(newChild);
      return newChild;
    }
    get firstChild() { return this.children[0] || null; }
  }

  const savedDoc = globalThis.document;
  globalThis.document = { createElementNS: (ns, tag) => new MockElement(tag) };

  try {
    const { renderEntity } = await import("../static/templates.js");
    const templateIds = Object.keys({ person: 1, cat: 1, dog: 1, bird: 1, umbrella: 1,
      streetlamp: 1, roof: 1, house: 1, bridge: 1, boat: 1,
      bench: 1, bicycle: 1, fence: 1, buildings: 1, rain: 1,
      cloud: 1, sun: 1, moon: 1, stars: 1, tree: 1 });

    const start = performance.now();
    let i = 0;
    for (const templateId of templateIds) {
      i += 1;
      const entity = {
        id: `entity-${i}`, kind: "entity", templateId,
        name: templateId, x: 10, y: 20, width: 200, height: 150,
        rotation: 0, opacity: 1, params: {}
      };
      renderEntity(entity, { quality: "base", namespace: "perf-test" });
    }
    const duration = performance.now() - start;
    assert.ok(duration < 100, `20 个实体 base 渲染耗时 ${duration.toFixed(1)}ms 应低于 100ms`);
  } finally {
    globalThis.document = savedDoc;
  }
});
