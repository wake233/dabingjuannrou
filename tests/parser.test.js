import test from "node:test";
import assert from "node:assert/strict";
import { chineseNumber, normalizeText, parseCommand, splitCommands } from "../static/parser.js";

test("中文数字与常见识别文本归一化", () => {
  assert.equal(chineseNumber("五十"), 50);
  assert.equal(chineseNumber("一百二十"), 120);
  assert.match(normalizeText("撤消，正中央"), /撤销.*中央/);
});

test("复杂创建指令拆成两个动作", () => {
  const actions = parseCommand("画一个红色圆形放在左边，再画一个蓝色矩形放在右边");
  assert.equal(actions.length, 2);
  assert.deepEqual(actions.map(a => a.kind), ["circle", "rect"]);
  assert.deepEqual(actions.map(a => a.position), ["左边", "右边"]);
});

test("选择、对齐和上下文引用", () => {
  const actions = parseCommand("选中刚才两个图形，顶部对齐，然后整体向下移动五十");
  assert.deepEqual(actions, [
    { type: "select", target: "lastTwo" },
    { type: "align", target: "selected", mode: "top" },
    { type: "move", target: "selected", dx: 0, dy: 50 }
  ]);
});

test("命名对象和画布指令", () => {
  assert.equal(parseCommand("选择矩形1")[0].target, "矩形一");
  assert.equal(parseCommand("清空画布")[0].requiresConfirmation, true);
  assert.equal(splitCommands("撤销，然后重做").length, 2);
});

test("文字创建与内容更新可以拆分执行", () => {
  const actions = parseCommand("画一个文字，写上“你好”");
  assert.equal(actions[0].kind, "text");
  assert.equal(actions[1].changes.text, "你好");
});
