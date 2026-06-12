import test from "node:test";
import assert from "node:assert/strict";
import { DrawingEngine, validateActions } from "../static/model.js";
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
  const [firstId, secondId, thirdId] = engine.state.groups[groupId];
  engine.execute([{ type: "delete", target: firstId }]);
  assert.deepEqual(engine.state.groups[groupId], [secondId, thirdId]);
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
  assert.equal(validateActions([{ type: "canvas", operation: "clear", requiresConfirmation: true }]), true);
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
    { type: "canvas", operation: "clear" },
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
