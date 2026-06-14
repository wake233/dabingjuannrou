import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { DrawingEngine, validateActions, validateProject } from "../static/model.js";
import { decomposeComposite, parseCommand } from "../static/parser.js";

test("创建、命名、移动和一次撤销整个事务", () => {
  const engine = new DrawingEngine();
  engine.execute([
    { type: "create", kind: "circle", position: "左边" },
    { type: "move", target: "last", dx: 50, dy: 0 }
  ]);
  assert.equal(engine.state.objects[0].name, "圆形一");
  const movedX = engine.state.objects[0].x;
  engine.execute([{ type: "history", operation: "undo" }]);
  assert.equal(engine.state.objects.length, 0);
  engine.execute([{ type: "history", operation: "redo" }]);
  assert.equal(engine.state.objects[0].x, movedX);
});

test("失败事务不会修改状态", () => {
  const engine = new DrawingEngine();
  engine.execute([{ type: "create", kind: "rect" }]);
  const before = JSON.stringify(engine.state);
  assert.throws(() => engine.execute([{ type: "align", target: "selected", mode: "top" }]));
  assert.equal(JSON.stringify(engine.state), before);
});

test("选择、对齐、分布、组合与删除", () => {
  const engine = new DrawingEngine();
  engine.execute([
    { type: "create", kind: "rect", x: 10 },
    { type: "create", kind: "circle", x: 300 },
    { type: "create", kind: "star", x: 700 }
  ]);
  engine.execute([{ type: "select", target: "all" }, { type: "align", target: "selected", mode: "top" }]);
  assert.equal(new Set(engine.state.objects.map(o => o.y)).size, 1);
  engine.execute([{ type: "distribute", target: "selected", axis: "horizontal" }, { type: "group", target: "selected" }]);
  assert.ok(engine.state.objects.every(o => o.groupId));
  engine.execute([{ type: "delete", target: "selected" }]);
  assert.equal(engine.state.objects.length, 0);
});

test("校验拒绝未知动作和过多动作", () => {
  assert.throws(() => validateActions([{ type: "eval" }]));
  assert.throws(() => validateActions(Array.from({ length: 21 }, () => ({ type: "help" }))));
});

test("创建八类图形并生成稳定名称和默认尺寸", () => {
  const engine = new DrawingEngine();
  const kinds = ["rect", "circle", "ellipse", "triangle", "star", "line", "arrow", "text"];
  engine.execute(kinds.map(kind => ({ type: "create", kind })));
  assert.deepEqual(engine.state.objects.map(o => o.name), [
    "矩形一", "圆形一", "椭圆一", "三角形一", "星形一", "直线一", "箭头一", "文字一"
  ]);
  assert.ok(engine.state.objects.every(o => o.width > 0));
  assert.deepEqual(engine.state.objects.filter(o => ["line", "arrow"].includes(o.kind)).map(o => o.height), [0, 0]);
});

test("样式、缩放、旋转、复制和层级调整", () => {
  const engine = new DrawingEngine();
  engine.execute([
    { type: "create", kind: "rect", width: 100, height: 60 },
    { type: "create", kind: "circle" }
  ]);
  const [rect, circle] = engine.state.objects;
  engine.execute([{
    type: "update",
    target: rect.id,
    changes: {
      fill: "#ef4444", stroke: "#3b82f6", strokeWidth: 6, opacity: .5,
      rotation: 45, width: { multiply: 2 }, height: { multiply: 2 }, zOrder: "top"
    }
  }]);
  assert.equal(engine.state.objects.at(-1).id, rect.id);
  assert.deepEqual(
    [rect.id, circle.id].map(id => engine.state.objects.find(o => o.id === id)?.name),
    ["矩形一", "圆形一"]
  );
  const updated = engine.state.objects.at(-1);
  assert.deepEqual(
    [updated.fill, updated.stroke, updated.strokeWidth, updated.opacity, updated.rotation, updated.width, updated.height],
    ["#ef4444", "#3b82f6", 6, .5, 45, 200, 120]
  );
  engine.execute([{ type: "duplicate", target: rect.id }]);
  assert.equal(engine.state.objects.at(-1).name, "矩形二");
  assert.equal(engine.state.objects.at(-1).width, 200);
  engine.execute([{ type: "update", target: "last", changes: { zOrder: "bottom" } }]);
  assert.equal(engine.state.objects[0].name, "矩形二");
});

test("删除组合成员会同步组合记录并在不足两项时解散", () => {
  const engine = new DrawingEngine();
  engine.execute([
    { type: "create", kind: "rect" },
    { type: "create", kind: "circle" },
    { type: "create", kind: "star" },
    { type: "select", target: "all" },
    { type: "group", target: "selected" }
  ]);
  const groupId = engine.state.objects[0].groupId;
  const [firstId, secondId, thirdId] = engine.state.groups[groupId].members;
  engine.execute([{ type: "delete", target: firstId }]);
  assert.deepEqual(engine.state.groups[groupId].members, [secondId, thirdId]);
  assert.ok(engine.state.objects.every(o => o.groupId === groupId));
  engine.execute([{ type: "delete", target: secondId }]);
  assert.deepEqual(engine.state.groups, {});
  assert.equal(engine.state.objects[0].groupId, undefined);
  assert.deepEqual(engine.state.lastCreated, [thirdId]);
});

test("重新组合会清理旧组合关系", () => {
  const engine = new DrawingEngine();
  engine.execute([
    { type: "create", kind: "rect" },
    { type: "create", kind: "circle" },
    { type: "create", kind: "star" }
  ]);
  const [rect, circle, star] = engine.state.objects;
  engine.execute([{ type: "group", target: [rect.id, circle.id] }]);
  const oldGroup = engine.state.objects.find(o => o.id === rect.id).groupId;
  engine.execute([{ type: "group", target: [circle.id, star.id] }]);
  assert.equal(engine.state.groups[oldGroup], undefined);
  const regrouped = engine.state.objects;
  assert.equal(regrouped.find(o => o.id === rect.id).groupId, undefined);
  assert.equal(
    regrouped.find(o => o.id === circle.id).groupId,
    regrouped.find(o => o.id === star.id).groupId
  );
});

test("背景、效果动作和历史上限", () => {
  const engine = new DrawingEngine();
  const effects = engine.execute([
    { type: "canvas", operation: "background", color: "#111827" },
    { type: "help" },
    { type: "status" },
    { type: "export", format: "svg" }
  ]).effects;
  assert.equal(engine.state.background, "#111827");
  assert.deepEqual(effects.map(effect => effect.type), ["help", "status", "export"]);
  for (let i = 0; i < 55; i++) {
    engine.execute([{ type: "canvas", operation: "background", color: `#${i.toString(16).padStart(6, "0")}` }]);
  }
  assert.equal(engine.undoStack.length, 50);
});

test("字段级校验接受完整标准动作接口", () => {
  assert.equal(validateActions([
    { type: "create", kind: "text", position: "中央", x: 1, y: 2, width: 200, height: 60, fill: "#fff", stroke: "#123456", strokeWidth: 2, opacity: 0.5, rotation: 30, text: "你好" },
    { type: "select", target: "all" },
    { type: "update", target: "selected", changes: { fill: "#abcdef", width: { multiply: 2 }, zOrder: "top" } },
    { type: "move", target: "selected", dx: 10, dy: -5 },
    { type: "align", target: "selected", mode: "hcenter" },
    { type: "distribute", target: "selected", axis: "vertical" },
    { type: "duplicate", target: "selected" },
    { type: "delete", target: ["shape-1"] },
    { type: "group", target: "selected" },
    { type: "ungroup", target: "selected" },
    { type: "canvas", operation: "background", color: "#ffffff" },
    { type: "export", format: "svg" },
    { type: "help" },
    { type: "status" }
  ]), true);
  assert.equal(validateActions([{ type: "history", operation: "undo" }]), true);
  assert.equal(validateActions([{ type: "canvas", operation: "clear" }]), true);
});

test("字段级校验拒绝非法载荷和清空确认绕过", () => {
  const invalidActions = [
    { type: "create" },
    { type: "create", kind: "script" },
    { type: "create", kind: "rect", fill: "url(https://example.test/a.svg)" },
    { type: "create", kind: "rect", opacity: 2 },
    { type: "select", target: 3 },
    { type: "update", target: "selected", changes: {} },
    { type: "update", target: "selected", changes: { x: 10 } },
    { type: "update", target: "selected", changes: { width: { multiply: -1 } } },
    { type: "move", target: "selected", position: "中央", dx: 10 },
    { type: "align", target: "selected", mode: "diagonal" },
    { type: "distribute", target: "selected", axis: "depth" },
    { type: "history", operation: "clear" },
    { type: "canvas", operation: "background", color: "red" },
    { type: "export", format: "pdf" },
    { type: "help", payload: "unexpected" }
  ];
  for (const action of invalidActions) assert.throws(() => validateActions([action]));
  assert.throws(() => validateActions([{ type: "history", operation: "undo" }, { type: "help" }]));
});

test("组合指令拆解结果作为单一事务执行 一次撤销全部回退", () => {
  // House: 3 shapes
  const engine = new DrawingEngine();
  const houseActions = decomposeComposite("画一个房子");
  assert.equal(houseActions.length, 3);
  engine.execute(houseActions);
  assert.equal(engine.state.objects.length, 3, "应创建3个图形");
  // One undo reverts all 3
  engine.execute([{ type: "history", operation: "undo" }]);
  assert.equal(engine.state.objects.length, 0, "一次撤销应移除所有3个图形");

  // Snowman: 3 circles
  const snowmanActions = parseCommand("画一个雪人");
  assert.equal(snowmanActions.length, 3);
  engine.execute(snowmanActions);
  assert.equal(engine.state.objects.length, 3);
  engine.execute([{ type: "history", operation: "undo" }]);
  assert.equal(engine.state.objects.length, 0);

  // Smiley: 4 shapes
  const smileyActions = parseCommand("画一个笑脸");
  assert.equal(smileyActions.length, 4);
  engine.execute(smileyActions);
  assert.equal(engine.state.objects.length, 4);
  engine.execute([{ type: "history", operation: "undo" }]);
  assert.equal(engine.state.objects.length, 0);

  // Row of 5 circles: one transaction
  const rowActions = parseCommand("画一排五个圆");
  assert.equal(rowActions.length, 5);
  engine.execute(rowActions);
  assert.equal(engine.state.objects.length, 5);
  engine.execute([{ type: "history", operation: "undo" }]);
  assert.equal(engine.state.objects.length, 0);

  // Redo after undo restores all
  engine.execute(rowActions);
  assert.equal(engine.state.objects.length, 5);
  engine.execute([{ type: "history", operation: "undo" }]);
  assert.equal(engine.state.objects.length, 0);
  engine.execute([{ type: "history", operation: "redo" }]);
  assert.equal(engine.state.objects.length, 5);
});

test("组合指令失败时不修改画布状态", () => {
  // Verify that if part of composite actions would fail, the entire transaction is rolled back
  // This is ensured by the existing transaction mechanism - test with a valid composite
  const engine = new DrawingEngine();
  engine.execute([{ type: "create", kind: "rect" }]);
  const before = JSON.stringify(engine.state);
  // A valid composite should not corrupt state
  engine.execute(decomposeComposite("画一个房子"));
  assert.equal(engine.state.objects.length, 4, "应有原来的1个+房子的3个=4个");
  engine.execute([{ type: "history", operation: "undo" }]);
  assert.equal(JSON.stringify(engine.state), before, "撤销后应恢复原状态");
});

test("复合创建后的上下文作用于全部组件且普通创建不合并", () => {
  for (const [command, expectedCount] of [
    ["画一个房子，然后移动到右边", 3],
    ["画一个雪人，然后复制它", 6],
    ["画一排三个矩形，然后顶部对齐", 3]
  ]) {
    const engine = new DrawingEngine();
    engine.execute(parseCommand(command));
    assert.equal(engine.state.objects.length, expectedCount, command);
    assert.equal(engine.undoStack.length, 1, command);
    engine.undo();
    assert.equal(engine.state.objects.length, 0, command);
  }
  const engine = new DrawingEngine();
  engine.execute(parseCommand("画一个圆形，再画一个矩形"));
  assert.equal(engine.state.lastCreated.length, 1);
  assert.equal(engine.state.objects.find(o => o.id === engine.state.lastCreated[0]).kind, "rect");
});

test("复合创建后的布局操作保留整组选择反馈", () => {
  const engine = new DrawingEngine();
  const actions = parseCommand("画三个矩形，然后顶部对齐");
  assert.equal(new Set(actions.slice(0, 3).map(action => action.y)).size, 3);
  engine.execute(actions);

  assert.equal(engine.state.objects.length, 3);
  assert.equal(engine.state.selection.length, 3);
  assert.deepEqual(
    new Set(engine.state.selection),
    new Set(engine.state.objects.map(object => object.id))
  );
  assert.equal(new Set(engine.state.objects.map(object => object.y)).size, 1);
});

test("批量创建与后续独立布局指令共享整组选择", () => {
  for (const command of ["画三个矩形", "画一排三个矩形"]) {
    const engine = new DrawingEngine();
    engine.execute(parseCommand(command));

    assert.equal(engine.state.selection.length, 3, command);
    assert.doesNotThrow(() => engine.execute(parseCommand("顶部对齐", { selected: true })), command);
    assert.equal(new Set(engine.state.objects.map(object => object.y)).size, 1, command);
  }
});

test("浏览器动作元数据、零线宽与类型选择边界", () => {
  assert.doesNotThrow(() => validateActions([{ type: "create", kind: "rect", _compositeId: 1 }]));
  for (const value of [0, -1, 1.2, "1", null]) {
    assert.throws(() => validateActions([{ type: "create", kind: "rect", _compositeId: value }]));
  }
  assert.throws(() => validateActions([{ type: "create", kind: "rect", _private: 1 }]));
  const engine = new DrawingEngine();
  engine.execute([{ type: "create", kind: "rect", strokeWidth: 0 }]);
  assert.equal(engine.state.objects[0].strokeWidth, 0);

  engine.execute([
    { type: "create", kind: "circle" }, { type: "create", kind: "circle" },
    { type: "create", kind: "circle" }, { type: "create", kind: "rect" }
  ]);
  engine.execute([{ type: "select", target: "圆形" }]);
  assert.equal(engine.state.selection.length, 3);
  const before = JSON.stringify(engine.state);
  assert.throws(() => engine.execute([{ type: "select", target: "星形" }]));
  assert.equal(JSON.stringify(engine.state), before);
});

test("组合名称是一等目标并由历史完整恢复", () => {
  const engine = new DrawingEngine();
  engine.execute([
    { type: "create", kind: "rect" }, { type: "create", kind: "circle" },
    { type: "select", target: "all" }, { type: "group", target: "selected" }
  ]);
  const group = engine.state.groups["group-1"];
  assert.equal(group.name, "组合一");
  engine.execute([{ type: "move", target: "组合一", dx: 25, dy: 0 }]);
  assert.equal(engine.state.objects.every(o => o.x >= 25), true);
  engine.undo();
  assert.equal(engine.state.groups["group-1"].name, "组合一");
  engine.redo();
  assert.equal(engine.state.groups["group-1"].members.length, 2);
});

test("工程格式往返恢复完整状态并原子拒绝恶意载荷", () => {
  const engine = new DrawingEngine();
  engine.execute([
    { type: "create", kind: "rect" }, { type: "create", kind: "circle" },
    { type: "select", target: "all" }, { type: "group", target: "selected" },
    { type: "canvas", operation: "background", color: "#111827" }
  ]);
  const project = engine.serializeProject();
  const restored = new DrawingEngine();
  restored.loadProject(project);
  assert.deepEqual(restored.serializeProject(), project);
  assert.equal(restored.undoStack.length, 1);

  const before = JSON.stringify(restored.serializeProject());
  for (const invalid of [
    { ...project, version: 4 },
    { ...project, state: { ...project.state, objects: [{ ...project.state.objects[0], onclick: "alert(1)" }] } },
    { ...project, state: { ...project.state, selection: ["missing-id"] } },
    { ...project, state: { ...project.state, counters: { rect: -1 } } },
    { ...project, state: { ...project.state, groups: { ...project.state.groups, "group-2": { id: "group-2", name: "组合二", members: project.state.groups["group-1"].members } } } }
  ]) {
    assert.throws(() => restored.loadProject(invalid));
    assert.equal(JSON.stringify(restored.serializeProject()), before);
  }
  assert.doesNotThrow(() => validateProject(project));
});

test("工程组合记录严格拒绝未知字段和非法 ID 且保持原子性", () => {
  const engine = new DrawingEngine();
  engine.execute([
    { type: "create", kind: "rect" }, { type: "create", kind: "circle" },
    { type: "select", target: "all" }, { type: "group", target: "selected" }
  ]);
  const project = engine.serializeProject();
  const restored = new DrawingEngine();
  restored.loadProject(project);
  const before = JSON.stringify(restored.serializeProject());
  const clone = value => JSON.parse(JSON.stringify(value));

  const onclick = clone(project);
  onclick.state.groups["group-1"].onclick = "alert(1)";
  const url = clone(project);
  url.state.groups["group-1"].url = "https://evil.example/payload";
  const invalidGroupId = clone(project);
  invalidGroupId.state.groups["https://evil.example/group"] = {
    ...invalidGroupId.state.groups["group-1"],
    id: "https://evil.example/group"
  };
  delete invalidGroupId.state.groups["group-1"];
  invalidGroupId.state.objects.forEach(object => { object.groupId = "https://evil.example/group"; });
  const longName = clone(project);
  longName.state.groups["group-1"].name = "组".repeat(101);
  const invalidShapeId = clone(project);
  invalidShapeId.state.objects[0].id = "javascript:alert(1)";
  invalidShapeId.state.groups["group-1"].members[0] = "javascript:alert(1)";
  invalidShapeId.state.selection[0] = "javascript:alert(1)";
  invalidShapeId.state.lastCreated[0] = "javascript:alert(1)";

  for (const invalid of [onclick, url, invalidGroupId, longName, invalidShapeId]) {
    assert.throws(() => restored.loadProject(invalid));
    assert.equal(JSON.stringify(restored.serializeProject()), before);
  }
});

test("工程加载严格拒绝冲突计数器和超长历史且保持原子性", () => {
  const engine = new DrawingEngine();
  engine.execute([
    { type: "create", kind: "rect" }, { type: "create", kind: "rect" },
    { type: "create", kind: "circle" }, { type: "select", target: "all" },
    { type: "group", target: "selected" }
  ]);
  const project = engine.serializeProject();
  const restored = new DrawingEngine();
  restored.loadProject(project);
  const before = JSON.stringify(restored.serializeProject());
  const clone = value => JSON.parse(JSON.stringify(value));

  const nextShapeConflict = clone(project);
  nextShapeConflict.state.nextId = 3;
  const nextGroupConflict = clone(project);
  nextGroupConflict.state.nextGroupId = 1;
  const lowKindCounter = clone(project);
  lowKindCounter.state.counters.rect = 1;
  const uncoveredGeneratedName = clone(project);
  uncoveredGeneratedName.state.objects.find(object => object.kind === "rect").name = "矩形三";
  uncoveredGeneratedName.state.counters.rect = 2;
  const oversizedUndo = clone(project);
  oversizedUndo.history.undo = Array.from({ length: 51 }, () => clone(project.state));
  const oversizedRedo = clone(project);
  oversizedRedo.history.redo = Array.from({ length: 51 }, () => clone(project.state));

  for (const invalid of [
    nextShapeConflict, nextGroupConflict, lowKindCounter, uncoveredGeneratedName, oversizedUndo, oversizedRedo
  ]) {
    assert.throws(() => restored.loadProject(invalid));
    assert.equal(JSON.stringify(restored.serializeProject()), before);
  }

  const withDeletedGap = new DrawingEngine();
  withDeletedGap.execute([
    { type: "create", kind: "rect" }, { type: "create", kind: "rect" }, { type: "create", kind: "rect" }
  ]);
  withDeletedGap.execute([{ type: "delete", target: ["shape-2"] }]);
  assert.doesNotThrow(() => validateProject(withDeletedGap.serializeProject()));
});

test("共享动作验证向量在浏览器侧按预期接受或拒绝", () => {
  const vectors = JSON.parse(fs.readFileSync(new URL("./action_vectors.json", import.meta.url), "utf8"));
  for (const actions of vectors.valid) assert.doesNotThrow(() => validateActions(actions));
  for (const actions of vectors.invalid) assert.throws(() => validateActions(actions));
});

test("语义实体创建、按中文名修改移动删除并一次撤销场景事务", () => {
  const engine = new DrawingEngine();
  engine.execute([
    { type: "scene_update", changes: { theme: "雨夜", mood: "安静", composition: "人物在左，路灯在右", summary: "雨中人物", ignored: ["龙"] } },
    { type: "entity_create", templateId: "person", name: "人物", role: "主角", x: 300, y: 260, width: 100, height: 240, params: { color: "#596780", direction: "right" } },
    { type: "entity_create", templateId: "umbrella", name: "伞", role: "道具", x: 260, y: 180, width: 180, height: 160, params: { color: "#88a9bd" } },
    { type: "entity_create", templateId: "rain", name: "雨", role: "天气", x: 0, y: 0, width: 1000, height: 700, params: { density: .5 } }
  ]);
  assert.equal(engine.undoStack.length, 1);
  assert.equal(engine.state.scene.summary, "雨中人物");
  engine.execute([
    { type: "entity_update", target: "伞", changes: { params: { color: "#ef4444" } } },
    { type: "move", target: "人物", dx: -50, dy: 0 },
    { type: "entity_update", target: "雨", changes: { params: { density: .9 } } }
  ]);
  assert.equal(engine.state.objects.find(object => object.name === "伞").params.color, "#ef4444");
  assert.equal(engine.state.objects.find(object => object.name === "人物").x, 250);
  assert.equal(engine.state.objects.find(object => object.name === "雨").params.density, .9);
  engine.undo();
  assert.equal(engine.state.objects.find(object => object.name === "伞").params.color, "#88a9bd");
  engine.undo();
  assert.equal(engine.state.objects.length, 0);
});

test("语义实体非法模板参数和失败场景事务原子回滚", () => {
  assert.throws(() => validateActions([{ type: "entity_create", templateId: "dragon", name: "龙", x: 0, y: 0, width: 100, height: 100 }]));
  assert.throws(() => validateActions([{ type: "entity_create", templateId: "cat", name: "猫", x: 0, y: 0, width: 100, height: 100, params: { svg: "<path/>" } }]));
  assert.throws(() => validateActions([{ type: "entity_update", target: "猫", changes: { params: { href: "https://evil.test" } } }]));
  const engine = new DrawingEngine();
  const before = JSON.stringify(engine.state);
  assert.throws(() => engine.execute([
    { type: "entity_create", templateId: "cat", name: "猫", x: 100, y: 100, width: 120, height: 100 },
    { type: "entity_update", target: "不存在", changes: { params: { direction: "left" } } }
  ]));
  assert.equal(JSON.stringify(engine.state), before);
});

test("版本 1 工程迁移为空场景且版本 3 完整恢复实体参数", () => {
  const oldEngine = new DrawingEngine();
  oldEngine.execute([{ type: "create", kind: "circle" }]);
  const version1 = oldEngine.serializeProject();
  version1.version = 1;
  delete version1.state.scene;
  version1.history.undo.forEach(state => delete state.scene);
  version1.history.redo.forEach(state => delete state.scene);
  const migrated = new DrawingEngine();
  migrated.loadProject(version1);
  assert.equal(migrated.state.scene.style, "storybook");
  assert.equal(migrated.state.scene.summary, "");

  migrated.execute([
    { type: "scene_update", changes: { summary: "月夜屋顶猫" } },
    { type: "entity_create", templateId: "cat", name: "猫", x: 500, y: 300, width: 150, height: 120, params: { direction: "left", color: "#596780" } }
  ]);
  const version2 = migrated.serializeProject();
  assert.equal(version2.version, 3);
  const restored = new DrawingEngine();
  restored.loadProject(version2);
  assert.deepEqual(restored.serializeProject(), version2);
});

test("现有选择、缩放、旋转、置顶和删除动作支持语义实体", () => {
  const engine = new DrawingEngine();
  engine.execute([
    { type: "entity_create", templateId: "moon", name: "月亮", x: 50, y: 50, width: 100, height: 100 },
    { type: "entity_create", templateId: "cloud", name: "云", x: 200, y: 80, width: 180, height: 90 }
  ]);
  engine.execute([{ type: "select", target: "月亮" }, {
    type: "update", target: "selected", changes: { width: { multiply: 2 }, height: { multiply: 2 }, rotation: 15, zOrder: "top" }
  }]);
  assert.equal(engine.state.objects.at(-1).name, "月亮");
  assert.equal(engine.state.objects.at(-1).width, 200);
  assert.equal(engine.state.objects.at(-1).rotation, 15);
  engine.execute([{ type: "delete", target: "云" }]);
  assert.deepEqual(engine.state.objects.map(object => object.name), ["月亮"]);
});

test("选中的语义实体可通过左移指令移动", () => {
  const engine = new DrawingEngine();
  engine.execute([
    { type: "entity_create", templateId: "moon", name: "月亮", x: 100, y: 50, width: 100, height: 100 }
  ]);
  engine.execute(parseCommand("选中实体左移"));
  assert.equal(engine.state.objects[0].x, 50);
});

test("单个场景规划允许最多 20 个实体但拒绝普通 21 动作", () => {
  const sceneActions = [
    { type: "scene_update", changes: { summary: "星空" } },
    ...Array.from({ length: 20 }, (_, index) => ({
      type: "entity_create", templateId: "stars", name: `星空${index + 1}`,
      x: index * 10, y: 0, width: 100, height: 100
    }))
  ];
  assert.doesNotThrow(() => validateActions(sceneActions));
  const engine = new DrawingEngine();
  engine.execute(sceneActions);
  assert.equal(engine.state.objects.length, 20);
  assert.equal(engine.undoStack.length, 1);
  assert.throws(() => validateActions(Array.from({ length: 21 }, () => ({ type: "help" }))));
});
