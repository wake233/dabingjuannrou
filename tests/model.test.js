import test from "node:test";
import assert from "node:assert/strict";
import { DrawingEngine, validateActions } from "../static/model.js";

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
