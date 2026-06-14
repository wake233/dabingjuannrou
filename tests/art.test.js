import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { DrawingEngine, validateActions } from "../static/model.js";
import { emptyArtState, generateCompositionDrafts, mixCompositionDrafts, validateArtState } from "../static/art_schema.js";
const portfolio = JSON.parse(fs.readFileSync(new URL("../docs/portfolio.json", import.meta.url), "utf8"));

function createScene(engine) {
  engine.execute([
    { type: "scene_update", changes: { theme: "雨夜", mood: "安静", composition: "人物与路灯", summary: "雨夜归人", ignored: [] } },
    { type: "entity_create", templateId: "person", name: "人物", x: 400, y: 250, width: 160, height: 340, params: { variant: "woman" } },
    { type: "entity_create", templateId: "streetlamp", name: "路灯", x: 700, y: 180, width: 120, height: 390, params: {} }
  ]);
}

test("版本 3 创作状态可从版本 2 安全迁移并完整往返", () => {
  const engine = new DrawingEngine();
  createScene(engine);
  const version3 = engine.serializeProject();
  assert.equal(version3.version, 3);
  validateArtState(version3.state.art);
  const version2 = structuredClone(version3);
  version2.version = 2;
  delete version2.state.art;
  version2.history.undo.forEach(state => delete state.art);
  version2.history.redo.forEach(state => delete state.art);
  const restored = new DrawingEngine();
  restored.loadProject(version2);
  assert.deepEqual(restored.state.art, emptyArtState());
  assert.deepEqual(new DrawingEngine().loadProject(version3).state, version3.state);
});

test("三张小稿在焦点、动线、尺度与负空间上明显不同", () => {
  for (const style of ["storybook", "woodcut", "ink"]) {
    const drafts = generateCompositionDrafts("雨中归人", style, 1);
    assert.equal(drafts.length, 3);
    for (const field of ["focus", "flow", "scale", "negativeSpace"]) {
      assert.equal(new Set(drafts.map(draft => draft[field])).size, 3);
    }
  }
});

test("选稿、混稿、重新生成和恢复均进入单一事务历史", () => {
  const engine = new DrawingEngine();
  createScene(engine);
  engine.execute([{ type: "creative", operation: "generate_drafts", theme: "雨中归人", style: "storybook" }]);
  const beforeSelect = structuredClone(engine.state.objects);
  engine.execute([{ type: "creative", operation: "select_draft", draftId: "draft-1-1" }]);
  assert.notDeepEqual(engine.state.objects, beforeSelect);
  engine.undo();
  assert.deepEqual(engine.state.objects, beforeSelect);
  engine.redo();
  engine.execute([{ type: "creative", operation: "mix_drafts", draftIds: ["draft-1-1", "draft-1-2"] }]);
  assert.equal(engine.state.art.drafts.selectedId, "draft-1-mix");
  const project = engine.serializeProject();
  const restored = new DrawingEngine();
  restored.loadProject(project);
  assert.equal(restored.state.art.drafts.stage, "canvas");
  engine.execute([{ type: "creative", operation: "generate_drafts", theme: "雨中归人", style: "storybook" }]);
  assert.equal(engine.state.art.drafts.generation, 2);
});

test("审美精修产生实质变化并严格保持锁定字段和实体", () => {
  const engine = new DrawingEngine();
  createScene(engine);
  const personId = engine.state.objects.find(object => object.name === "人物").id;
  engine.execute([{ type: "creative", operation: "lock", field: "composition" }, { type: "creative", operation: "lock", target: "人物" }]);
  const before = structuredClone(engine.state);
  engine.execute([{ type: "creative", operation: "refine", instruction: "更孤独，加强风感，右侧留白更多" }]);
  assert.equal(engine.state.art.intent.emotion, "孤独、克制");
  assert.equal(engine.state.art.intent.rhythm, "强烈的方向性风感");
  assert.deepEqual(engine.state.objects.find(object => object.id === personId), before.objects.find(object => object.id === personId));
  assert.deepEqual(engine.state.objects, before.objects);
  engine.execute([{ type: "creative", operation: "unlock", field: "composition" }, { type: "creative", operation: "unlock", target: "人物" }]);
  engine.execute([{ type: "creative", operation: "refine", instruction: "右侧留白更多" }]);
  assert.notDeepEqual(engine.state.objects, before.objects);
});

test("创作动作与混合小稿严格校验", () => {
  assert.equal(validateActions([{ type: "creative", operation: "set_style", style: "ink" }]), true);
  assert.throws(() => validateActions([{ type: "creative", operation: "set_style", style: "oil" }]));
  const drafts = generateCompositionDrafts("河岸", "storybook", 1);
  const mixed = mixCompositionDrafts(drafts[0], drafts[1], 1);
  assert.equal(mixed.focus, drafts[0].focus);
  assert.equal(mixed.flow, drafts[1].flow);
});

test("作品验收集包含十二个精选题材与五项评分维度", () => {
  assert.equal(portfolio.subjects.length, 12);
  assert.deepEqual(portfolio.criteria, ["composition", "visualHierarchy", "narrative", "styleConsistency", "finish"]);
  assert.ok(portfolio.subjects.every(subject => subject.directions.length >= 2));
});

test("切换至木刻保留语义叙事关系并应用独立艺术指导", () => {
  const engine = new DrawingEngine();
  createScene(engine);
  const semanticBefore = engine.state.objects.map(({ id, name, templateId }) => ({ id, name, templateId }));
  engine.execute([{ type: "creative", operation: "set_style", style: "woodcut" }]);
  assert.deepEqual(engine.state.objects.map(({ id, name, templateId }) => ({ id, name, templateId })), semanticBefore);
  assert.equal(engine.state.scene.style, "woodcut");
  assert.equal(engine.state.art.artDirection.lineLanguage, "carved");
  assert.equal(engine.state.art.artDirection.palette.length, 3);
});
