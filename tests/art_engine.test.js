/**
 * Art Engine tests — Phase 2: shape grammar, lighting, material,
 * composition evaluation, art director, and unified pipeline.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { getGrammarCategory, getGrammarKey, getStructureRules, getTemplatesInCategory, getAllTemplateIds, GRAMMAR_CATEGORIES } from "../static/shape_grammar.js";
import { getLightingProfile, computeLightAngle, computeShadowOffset, getLightingColors, getEnvironmentColor, needsFullLighting } from "../static/lighting.js";
import { getMaterialProfile, materialLineAdjustment, materialSupportsTexture } from "../static/material.js";
import { evaluateComposition, isInCanvasBounds, visualWeight } from "../static/composition.js";
import { runArtDirector, getArtDirectionConfig, getLayerBounds } from "../static/art_director.js";
import { executeArtPipeline, isSceneValid, getDepthLayers } from "../static/art_engine_core.js";
import { CANVAS } from "../static/model.js";

// ==================== Shape Grammar ====================

test("图形语法将 26 个实体分为四类", () => {
  const allIds = getAllTemplateIds();
  assert.equal(allIds.length, 26);

  for (const id of allIds) {
    const key = getGrammarKey(id);
    assert.ok(key, `${id} 应有语法分类`);
    assert.ok(["figure", "structure", "nature", "atmosphere"].includes(key));

    const cat = getGrammarCategory(id);
    assert.ok(cat);
    assert.ok(cat.structureRules);
    assert.ok(cat.structureRules.silhouetteStyle);
    assert.ok(cat.structureRules.primaryTier);
  }
});

test("人物动物类具有骨架和关节规则", () => {
  const cat = GRAMMAR_CATEGORIES.figure;
  assert.equal(cat.templates.length, 4);
  assert.equal(cat.structureRules.hasSkeleton, true);
  assert.equal(cat.structureRules.hasJoints, true);
  assert.equal(cat.structureRules.hasPosture, true);
  for (const id of ["person", "cat", "dog", "bird"]) {
    assert.equal(getGrammarKey(id), "figure");
  }
});

test("建筑器物类具有透视规则", () => {
  const cat = GRAMMAR_CATEGORIES.structure;
  assert.equal(cat.structureRules.hasPerspective, true);
  assert.equal(getGrammarKey("house"), "structure");
  assert.equal(getGrammarKey("bridge"), "structure");
  assert.equal(getGrammarKey("boat"), "structure");
});

test("植物自然类具有生长规则", () => {
  const cat = GRAMMAR_CATEGORIES.nature;
  assert.equal(cat.structureRules.hasGrowth, true);
  assert.equal(getGrammarKey("tree"), "nature");
  assert.equal(getGrammarKey("mountain"), "nature");
});

test("天气光效类具有方向规则且无阴影", () => {
  const cat = GRAMMAR_CATEGORIES.atmosphere;
  assert.equal(cat.structureRules.hasDirection, true);
  assert.equal(cat.structureRules.shadowType, "none");
  assert.equal(getGrammarKey("rain"), "atmosphere");
  assert.equal(getGrammarKey("sun"), "atmosphere");
});

// ==================== Lighting ====================

test("四种光线预设返回不同配置", () => {
  const presets = ["soft-day", "golden-hour", "night", "rain"];
  for (const name of presets) {
    const profile = getLightingProfile(name);
    assert.ok(profile);
    assert.ok(profile.sourceX >= 0 && profile.sourceX <= 1);
    assert.ok(profile.sourceY >= 0 && profile.sourceY <= 1);
    assert.ok(["warm", "cool"].includes(profile.colorTemp));
    assert.ok(profile.ambientLevel >= 0 && profile.ambientLevel <= 1);
    assert.ok(Array.isArray(profile.shadowDirection));
    assert.equal(profile.shadowDirection.length, 2);
  }
});

test("柔和日光和黄金时刻色温不同", () => {
  const day = getLightingProfile("soft-day");
  const golden = getLightingProfile("golden-hour");
  assert.notEqual(day.sourceX, golden.sourceX);
  assert.notEqual(day.shadowLength, golden.shadowLength);
});

test("光线角度计算有效", () => {
  const lighting = getLightingProfile("soft-day");
  const entity = { x: 400, y: 300, width: 160, height: 200 };
  const angle = computeLightAngle(entity, lighting);
  assert.ok(Number.isFinite(angle));
  assert.ok(angle > -Math.PI && angle < Math.PI);
});

test("阴影偏移与光照方向和实体尺寸相关", () => {
  const lighting = getLightingProfile("golden-hour");
  const entity = { x: 300, y: 400, width: 100, height: 150 };
  const offset = computeShadowOffset(entity, lighting);
  assert.ok("dx" in offset && "dy" in offset);
  assert.ok(Number.isFinite(offset.dx));
  assert.ok(Number.isFinite(offset.dy));
});

test("光照颜色生成高亮和阴影十六进制", () => {
  const lighting = getLightingProfile("rain");
  const colors = getLightingColors("#4f8cff", lighting);
  assert.ok(/^#[0-9a-f]{6}$/i.test(colors.highlight));
  assert.ok(/^#[0-9a-f]{6}$/i.test(colors.shadow));
  assert.ok(/^#[0-9a-f]{6}$/i.test(colors.ambient));
  // Highlight should be lighter, shadow darker
  const baseLum = hexLuminance("#4f8cff");
  assert.ok(hexLuminance(colors.highlight) >= baseLum);
});

test("环境光颜色与预设对应", () => {
  const colors = {
    "soft-day": getEnvironmentColor(getLightingProfile("soft-day")),
    "night": getEnvironmentColor(getLightingProfile("night")),
    "rain": getEnvironmentColor(getLightingProfile("rain"))
  };
  assert.ok(/^#[0-9a-f]{6}$/i.test(colors["soft-day"]));
  assert.ok(/^#[0-9a-f]{6}$/i.test(colors.night));
  assert.ok(/^#[0-9a-f]{6}$/i.test(colors.rain));
});

// ==================== Material ====================

test("四种材质返回不同配置", () => {
  const materials = ["paper", "smooth", "carved", "ink-wash"];
  for (const name of materials) {
    const profile = getMaterialProfile(name);
    assert.ok(profile);
    assert.ok(profile.roughness >= 0 && profile.roughness <= 1);
    assert.ok(profile.absorbency >= 0 && profile.absorbency <= 1);
    assert.ok(typeof profile.edgeStyle === "string");
    assert.ok(typeof profile.filterType === "string");
  }
});

test("光滑材质粗糙度最低", () => {
  const smooth = getMaterialProfile("smooth");
  const carved = getMaterialProfile("carved");
  assert.ok(smooth.roughness < carved.roughness);
});

test("材质线条调整因子随粗糙度增大", () => {
  const smoothAdj = materialLineAdjustment("smooth", "texture");
  const carvedAdj = materialLineAdjustment("carved", "texture");
  assert.ok(smoothAdj <= carvedAdj);
});

test("所有材质除光滑外均支持纹理叠加", () => {
  assert.equal(materialSupportsTexture("smooth"), false);
  assert.equal(materialSupportsTexture("paper"), true);
  assert.equal(materialSupportsTexture("carved"), true);
  assert.equal(materialSupportsTexture("ink-wash"), true);
});

// ==================== Composition ====================

test("空白场景通过构图评估", () => {
  const result = evaluateComposition([], {}, {});
  assert.equal(result.passed, true);
  assert.equal(result.scores.entityCount, 0);
});

test("场景深度层检测", () => {
  const entities = [
    { kind: "entity", x: 100, y: 100, width: 100, height: 100, templateId: "person", layer: -2, role: "" },
    { kind: "entity", x: 400, y: 300, width: 150, height: 200, templateId: "tree", layer: 0, role: "主角" },
    { kind: "entity", x: 700, y: 500, width: 80, height: 80, templateId: "bird", layer: 1, role: "" }
  ];
  const result = evaluateComposition(entities, { theme: "test" }, {});
  assert.equal(result.scores.depthLayers, 3);
});

test("严重遮挡被检测", () => {
  const entities = [
    { kind: "entity", x: 400, y: 300, width: 200, height: 200, templateId: "person", layer: 0, role: "主角" },
    { kind: "entity", x: 410, y: 310, width: 180, height: 180, templateId: "cat", layer: 0, role: "" }
  ];
  const result = evaluateComposition(entities, { theme: "test" }, {});
  assert.ok(result.scores.avgOverlap > 0.5);
});

test("画布边界检查", () => {
  const inside = { x: 100, y: 100, width: 100, height: 100 };
  const outside = { x: -200, y: 100, width: 100, height: 100 };
  assert.equal(isInCanvasBounds(inside), true);
  assert.equal(isInCanvasBounds(outside), false);
});

test("视觉权重中心实体更高", () => {
  const center = { x: 450, y: 300, width: 100, height: 100 };
  const edge = { x: 50, y: 50, width: 100, height: 100 };
  assert.ok(visualWeight(center) > visualWeight(edge));
});

// ==================== Art Director ====================

test("空白场景通过艺术导演", () => {
  const result = runArtDirector([], {}, {});
  assert.equal(result.accepted, true);
  assert.equal(result.corrections.length, 0);
});

test("有效场景通过艺术导演", () => {
  const entities = [
    { kind: "entity", name: "人物", x: 400, y: 250, width: 160, height: 340, templateId: "person", layer: 0, role: "主角" },
    { kind: "entity", name: "树", x: 700, y: 350, width: 120, height: 280, templateId: "tree", layer: -1, role: "" }
  ];
  const result = runArtDirector(entities, { theme: "雨中归人" }, {});
  assert.equal(result.accepted, true);
});

test("极小主体被拒绝", () => {
  const entities = [
    { kind: "entity", name: "人物", x: 500, y: 350, width: 10, height: 10, templateId: "person", layer: 0, role: "主角" }
  ];
  const result = runArtDirector(entities, { theme: "test" }, {}, { autoCorrect: false });
  assert.equal(result.accepted, false);
  assert.ok(result.rejectionReason.includes("主体过小"));
});

test("艺术导演自动校正主体尺度过小", () => {
  const entities = [
    { kind: "entity", name: "人物", x: 500, y: 350, width: 20, height: 20, templateId: "person", layer: 0, role: "主角" }
  ];
  const result = runArtDirector(entities, { theme: "test" }, {}, { autoCorrect: true });
  assert.equal(result.accepted, true);
  assert.ok(result.corrections.length > 0);
  assert.ok(entities[0].width > 40 || entities[0].height > 40);
});

test("旗舰题材配置可查询", () => {
  const config = getArtDirectionConfig("雨中归人");
  assert.ok(config);
  assert.ok(Array.isArray(config.requiredRoles));
  assert.ok(config.requiredRoles.length > 0);
  assert.ok(config.compositionRanges);
});

test("通用题材返回 null 配置", () => {
  const config = getArtDirectionConfig("完全未知的题材");
  assert.equal(config, null);
});

test("深度层边界根据层次变化", () => {
  const farBg = getLayerBounds(-3);
  const mid = getLayerBounds(0);
  const fg = getLayerBounds(2);
  assert.ok(farBg.yRange[1] < mid.yRange[1]);
  assert.ok(mid.scaleRange[0] < fg.scaleRange[0]);
});

// ==================== Art Engine Core ====================

test("统一渲染管道完整执行", () => {
  const entities = [
    { kind: "entity", name: "人物", x: 400, y: 250, width: 160, height: 340, templateId: "person", layer: 0, role: "主角", params: {} },
    { kind: "entity", name: "树", x: 700, y: 350, width: 120, height: 280, templateId: "tree", layer: -1, role: "", params: {} },
    { kind: "entity", name: "雨", x: 0, y: 0, width: 1000, height: 700, templateId: "rain", layer: -2, role: "", params: {} }
  ];
  const result = executeArtPipeline(entities, { theme: "雨中归人" }, { material: "paper", lighting: "rain" }, "storybook");
  assert.equal(result.metadata.stage, "complete");
  assert.equal(result.directorResult.accepted, true);
  assert.equal(result.metadata.style, "storybook");
  assert.ok(result.metadata.compositionScores);
});

test("场景验证快速检查", () => {
  const entities = [
    { kind: "entity", name: "人物", x: 400, y: 250, width: 160, height: 340, templateId: "person", layer: 0, role: "主角", params: {} }
  ];
  assert.equal(isSceneValid(entities), true);
});

test("深度层分类正确", () => {
  const entities = [
    { kind: "entity", name: "鸟", templateId: "bird", x: 0, y: 0, width: 50, height: 50, layer: 2 },
    { kind: "entity", name: "人物", templateId: "person", x: 0, y: 0, width: 50, height: 50, layer: 0 },
    { kind: "entity", name: "山", templateId: "mountain", x: 0, y: 0, width: 50, height: 50, layer: -2 }
  ];
  const layers = getDepthLayers(entities);
  assert.equal(layers.foreground.length, 1);
  assert.equal(layers.midground.length, 1);
  assert.equal(layers.background.length, 1);
});

test("木刻风格分配给实体高对比度块面", () => {
  const entities = [
    { kind: "entity", name: "人物", x: 400, y: 250, width: 160, height: 340, templateId: "person", layer: 0, role: "主角", params: {} }
  ];
  const result = executeArtPipeline(entities, { theme: "test" }, {}, "woodcut");
  assert.equal(result.metadata.style, "woodcut");
  assert.equal(entities[0]._blockType, "high-contrast");
});

test("水墨风格分配给实体墨层和飞白属性", () => {
  const entities = [
    { kind: "entity", name: "树", x: 400, y: 300, width: 120, height: 280, templateId: "tree", layer: 0, role: "", params: {} }
  ];
  const result = executeArtPipeline(entities, { theme: "test" }, {}, "ink");
  assert.equal(result.metadata.style, "ink");
  assert.equal(entities[0]._blockType, "ink-wash-gradient");
  assert.equal(entities[0]._flyingWhite, true);
});

// ==================== Helpers ====================

function hexLuminance(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
