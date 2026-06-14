import test from "node:test";
import assert from "node:assert/strict";
import { chineseNumber, composeCommonScene, decomposeComposite, normalizeText, parseCommand, splitCommands } from "../static/parser.js";

test("中文数字与常见识别文本归一化", () => {
  assert.equal(chineseNumber("五十"), 50);
  assert.equal(chineseNumber("一百二十"), 120);
  assert.equal(chineseNumber("两百五"), 250);
  assert.equal(chineseNumber("三千零六"), 3006);
  assert.equal(chineseNumber("一百二十三"), 123);
  assert.equal(chineseNumber("错误"), null);
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

test("这些图形只引用选择，不会退化为全部图形", () => {
  assert.deepEqual(parseCommand("这些图形向右移动五十"), [
    { type: "move", target: "selected", dx: 50, dy: 0 }
  ]);
  assert.equal(parseCommand("所有图形向右移动五十")[0].target, "all");
  assert.equal(parseCommand("向右移动五十", { selected: true })[0].target, "selected");
});

test("命名对象和画布指令", () => {
  assert.equal(parseCommand("选择矩形1")[0].target, "矩形一");
  assert.equal(parseCommand("清空画布")[0].operation, "clear");
  assert.equal(splitCommands("撤销，然后重做").length, 2);
});

test("文字创建与内容更新可以拆分执行", () => {
  const actions = parseCommand("画一个文字，写上“你好”");
  assert.equal(actions[0].kind, "text");
  assert.equal(actions[1].changes.text, "你好");
});

test("引号内标点不被替换为连接词", () => {
  assert.equal(normalizeText(`写上"你好，世界"`), `写上"你好，世界"`);
  assert.equal(normalizeText(`写上「你好，世界」`), `写上「你好，世界」`);
});

test("画文字指令带引号内逗号正确解析为文字内容", () => {
  const actions = parseCommand(`画一个文字，写上"你好，世界"`);
  assert.equal(actions.length, 2);
  assert.equal(actions[0].kind, "text");
  assert.equal(actions[1].changes.text, "你好，世界");
});

test("同句填充色和描边色分别解析", () => {
  assert.deepEqual(parseCommand("把它填充为红色描边为蓝色"), [{
    type: "update",
    target: "selected",
    changes: { fill: "#ef4444", stroke: "#3b82f6" }
  }]);
  assert.deepEqual(parseCommand("画一个填充红色描边蓝色矩形"), [{
    type: "create",
    kind: "rect",
    fill: "#ef4444",
    stroke: "#3b82f6"
  }]);
  assert.deepEqual(parseCommand("画一个描边蓝色矩形"), [{
    type: "create",
    kind: "rect",
    stroke: "#3b82f6"
  }]);
});

test("decomposeComposite 画房子拆解为屋顶三角形+墙体矩形+门矩形", () => {
  const actions = decomposeComposite("画一个房子");
  assert.equal(actions.length, 3);
  assert.deepEqual(actions.map(a => a.kind), ["triangle", "rect", "rect"]);
  // Roof sits above wall
  assert.ok(actions[0].y + actions[0].height <= actions[1].y + 5, "屋顶应在墙体上方");
  // Door is centered at bottom of wall
  assert.ok(actions[2].x > actions[1].x && actions[2].x + actions[2].width < actions[1].x + actions[1].width, "门应在墙体内");
  assert.ok(actions[2].y > actions[1].y + actions[1].height / 2, "门应在墙体下半部分");
  // Verify colors
  assert.equal(actions[0].fill, "#eab308");
  assert.equal(actions[1].fill, "#f97316");
  assert.equal(actions[2].fill, "#78350f");
});

test("decomposeComposite 画雪人拆解为三个纵向堆叠圆形", () => {
  const actions = decomposeComposite("画一个雪人");
  assert.equal(actions.length, 3);
  assert.deepEqual(actions.map(a => a.kind), ["circle", "circle", "circle"]);
  // Radii decrease bottom to top
  assert.ok(actions[0].width >= actions[1].width, "底部圆应最大");
  assert.ok(actions[1].width >= actions[2].width, "中部圆应大于头部");
  // Vertically stacked: bottom circle below middle, middle below head
  assert.ok(actions[0].y > actions[1].y, "底部圆应在中部圆下方");
  assert.ok(actions[1].y > actions[2].y, "中部圆应在头部下方");
  // All centered horizontally
  const centers = actions.map(a => a.x + a.width / 2);
  assert.ok(Math.abs(centers[0] - centers[1]) < 5, "应水平居中");
  assert.ok(Math.abs(centers[1] - centers[2]) < 5, "应水平居中");
  // White fill with dark stroke
  assert.equal(actions[0].fill, "#ffffff");
});

test("decomposeComposite 画笑脸拆解为脸+双眼+嘴", () => {
  const actions = decomposeComposite("画一个笑脸");
  assert.equal(actions.length, 4);
  assert.deepEqual(actions.map(a => a.kind), ["circle", "circle", "circle", "ellipse"]);
  // Face circle is largest
  assert.ok(actions[0].width >= 100, "脸应足够大");
  // Eyes are small circles
  assert.ok(actions[1].width < 30, "眼睛应是小圆");
  assert.ok(actions[2].width < 30, "眼睛应是小圆");
  // Eyes are on upper part of face
  const faceCenterY = actions[0].y + actions[0].height / 2;
  assert.ok(actions[1].y + actions[1].height / 2 < faceCenterY, "左眼应在脸上半部分");
  assert.ok(actions[2].y + actions[2].height / 2 < faceCenterY, "右眼应在脸上半部分");
  // Eyes are symmetric around face center x
  const faceCenterX = actions[0].x + actions[0].width / 2;
  const leftEyeCX = actions[1].x + actions[1].width / 2;
  const rightEyeCX = actions[2].x + actions[2].width / 2;
  assert.ok(leftEyeCX < faceCenterX, "左眼应在面部中心左侧");
  assert.ok(rightEyeCX > faceCenterX, "右眼应在面部中心右侧");
  // Mouth is below center
  assert.ok(actions[3].y > faceCenterY, "嘴应在脸下半部分");
});

test("decomposeComposite 画一排五个圆产生五个水平排列圆形", () => {
  const actions = decomposeComposite("画一排五个圆");
  assert.equal(actions.length, 5);
  assert.ok(actions.every(a => a.kind === "circle"), "应全部为圆形");
  // Horizontal arrangement: same y
  const yValues = actions.map(a => a.y);
  assert.equal(new Set(yValues).size, 1, "所有圆形应有相同的 y 坐标");
  // Increasing x
  for (let i = 1; i < actions.length; i++) {
    assert.ok(actions[i].x > actions[i - 1].x, `第${i}个圆应在第${i - 1}个圆右侧`);
  }
});

test("decomposeComposite 画一列三个矩形产生三个垂直排列矩形", () => {
  const actions = decomposeComposite("画一列三个矩形");
  assert.equal(actions.length, 3);
  assert.ok(actions.every(a => a.kind === "rect"), "应全部为矩形");
  // Vertical arrangement: same x
  const xValues = actions.map(a => a.x);
  assert.equal(new Set(xValues).size, 1, "所有矩形应有相同的 x 坐标");
  // Increasing y
  for (let i = 1; i < actions.length; i++) {
    assert.ok(actions[i].y > actions[i - 1].y, `第${i}个矩形应在第${i - 1}个矩形下方`);
  }
});

test("decomposeComposite 对非组合指令返回 null", () => {
  assert.equal(decomposeComposite("画一个圆"), null);
  assert.equal(decomposeComposite("画一个红色矩形"), null);
  assert.equal(decomposeComposite("移动圆形二向右五十"), null);
  assert.equal(decomposeComposite(""), null);
});

test("parseCommand 通过 decomposeComposite 处理组合指令", () => {
  // House via parseCommand (full pipeline)
  const houseActions = parseCommand("画一个房子");
  assert.equal(houseActions.length, 3);
  assert.deepEqual(houseActions.map(a => a.kind), ["triangle", "rect", "rect"]);

  // Row via parseCommand
  const rowActions = parseCommand("画一排三个矩形");
  assert.equal(rowActions.length, 3);
  assert.ok(rowActions.every(a => a.kind === "rect"));

  // Non-composite still works through regular pipeline
  const circleActions = parseCommand("画一个圆形");
  assert.equal(circleActions.length, 1);
  assert.equal(circleActions[0].kind, "circle");
});

test("decomposeComposite 支持阿拉伯数字和房屋别名", () => {
  // Arabic number for row
  const actions = decomposeComposite("画一排3个圆");
  assert.equal(actions.length, 3);
  assert.ok(actions.every(a => a.kind === "circle"));

  // "房屋" alias for house
  const houseActions = decomposeComposite("画房屋");
  assert.equal(houseActions.length, 3);
  assert.deepEqual(houseActions.map(a => a.kind), ["triangle", "rect", "rect"]);

  // "画房子" without "一个"
  const house2 = decomposeComposite("画房子");
  assert.equal(house2.length, 3);
});

test("decomposeComposite 组合动作通过 validateActions 校验", () => {
  // All composite actions should pass validation
  const composites = [
    decomposeComposite("画一个房子"),
    decomposeComposite("画一个雪人"),
    decomposeComposite("画一个笑脸"),
    decomposeComposite("画一排五个圆"),
    decomposeComposite("画一列三个矩形")
  ];
  for (const actions of composites) {
    assert.ok(actions.length > 0, "每个组合应返回动作");
    // No throw means pass
    // validateActions is called implicitly by parseCommand
    // We verify by calling parseCommand which calls validateActions internally
  }

  // Explicit verification via parseCommand
  assert.doesNotThrow(() => parseCommand("画一个房子"));
  assert.doesNotThrow(() => parseCommand("画一个雪人"));
  assert.doesNotThrow(() => parseCommand("画一个笑脸"));
  assert.doesNotThrow(() => parseCommand("画一排五个圆"));
  assert.doesNotThrow(() => parseCommand("画一列三个矩形"));
});

// ── Phase 3.1: Homophone fuzzy matching tests ─────────────────

test("fuzzyCorrect 修正动作词同音错误", () => {
  const actions = parseCommand("花一个局型");
  assert.equal(actions.length, 1);
  assert.equal(actions[0].kind, "rect");
  assert.equal(actions[0].type, "create");
});

test("fuzzyCorrect 修正多个同音词在同一句中", () => {
  const actions = parseCommand("花一个黄色园形");
  assert.equal(actions.length, 1);
  assert.equal(actions[0].kind, "circle");
  assert.equal(actions[0].fill, "#eab308");
});

test("fuzzyCorrect 修正形状词同音错误", () => {
  assert.equal(parseCommand("画一个三脚型")[0].kind, "triangle");
  assert.equal(parseCommand("画一个椭圆型")[0].kind, "ellipse");
  assert.equal(parseCommand("画一个星型")[0].kind, "star");
  assert.equal(parseCommand("画一个五角型")[0].kind, "star");
});

test("fuzzyCorrect 修正操作词同音错误", () => {
  const actions = parseCommand("三除它");
  assert.equal(actions.length, 1);
  assert.equal(actions[0].type, "delete");

  const moveActions = parseCommand("一副到右边");
  assert.equal(moveActions.length, 1);
  assert.equal(moveActions[0].type, "move");
});

test("fuzzyCorrect 修正颜色词同音错误", () => {
  const actions = parseCommand("把它填充为兰色");
  assert.equal(actions.length, 1);
  assert.equal(actions[0].changes.fill, "#3b82f6");

  const createActions = parseCommand("画一个滤色矩形");
  assert.equal(createActions.length, 1);
  assert.equal(createActions[0].fill, "#22c55e");
});

test("fuzzyCorrect 修正位置词同音错误", () => {
  const actions = parseCommand("移动到又边");
  assert.equal(actions.length, 1);
  assert.equal(actions[0].position, "右边");

  // "坐上方" corrects to "左上角" which matches POSITIONS
  const posActions = parseCommand("放在坐上方");
  assert.equal(posActions.length, 1);
  assert.equal(posActions[0].position, "左上角");
});

test("fuzzyCorrect 对正常指令不引入误判", () => {
  const actions = parseCommand("画一个红色矩形");
  assert.equal(actions.length, 1);
  assert.equal(actions[0].kind, "rect");

  const actions2 = parseCommand("画一个圆形");
  assert.equal(actions2.length, 1);
  assert.equal(actions2[0].kind, "circle");

  const actions3 = parseCommand("撤销");
  assert.equal(actions3.length, 1);
  assert.equal(actions3[0].type, "history");
});

test("fuzzyCorrect 修正背景和画布相关词", () => {
  const canvasActions = parseCommand("青空画部");
  assert.equal(canvasActions.length, 1);
  assert.equal(canvasActions[0].type, "canvas");
  assert.equal(canvasActions[0].operation, "clear");

  const bgActions = parseCommand("背色设为自色");
  assert.equal(bgActions.length, 1);
  assert.equal(bgActions[0].type, "canvas");
});

test("fuzzyCorrect 修正撤销和重做", () => {
  assert.equal(parseCommand("撤消")[0].type, "history");
  assert.equal(parseCommand("撤消")[0].operation, "undo");
});

test("fuzzyCorrect 修正长短语优先级匹配", () => {
  // "华一个矩形" should match "华一个" → "画一个" (longer match) not "华图" → "画图"
  const actions = parseCommand("华一个矩形");
  assert.equal(actions.length, 1);
  assert.equal(actions[0].kind, "rect");
});

test("fuzzyCorrect 修正线宽和透明度", () => {
  // "钱宽" corrects to "线宽", number-after pattern matches "线宽五"
  const actions = parseCommand("钱宽五");
  assert.equal(actions.length, 1);
  assert.equal(actions[0].changes.strokeWidth, 5);

  const opacityActions = parseCommand("头明度五十");
  assert.equal(opacityActions.length, 1);
  assert.equal(opacityActions[0].changes.opacity, 0.5);
});

test("fuzzyCorrect 修正全部和所有引用词", () => {
  const actions = parseCommand("全不图形向右移动五十");
  assert.equal(actions.length, 1);
  assert.equal(actions[0].target, "all");

  const selectAll = parseCommand("选的所又图形");
  assert.equal(selectAll.length, 1);
  assert.equal(selectAll[0].target, "all");
});

// ── Phase: Composite commands mixed with other clauses (DESIGN §4.2 fix) ──

test("复合指令与其他子句混用时正确拆解", () => {
  // "画一个房子，然后移动到右边" — house (3) + move (1) = 4 actions
  const houseAndMove = parseCommand("画一个房子，然后移动到右边");
  assert.equal(houseAndMove.length, 4);
  assert.deepEqual(houseAndMove.map(a => a.kind || a.type), ["triangle", "rect", "rect", "move"]);

  // "画一个雪人，然后复制它" — snowman (3) + duplicate (1) = 4 actions
  const snowmanAndCopy = parseCommand("画一个雪人，然后复制它");
  assert.equal(snowmanAndCopy.length, 4);
  assert.deepEqual(snowmanAndCopy.map(a => a.kind || a.type), ["circle", "circle", "circle", "duplicate"]);

  // "画一排三个矩形，然后顶部对齐" — row (3) + align (1) = 4 actions
  const rowAndAlign = parseCommand("画一排三个矩形，然后顶部对齐");
  assert.equal(rowAndAlign.length, 4);
  assert.equal(rowAndAlign[3].type, "align");
  assert.equal(rowAndAlign[3].mode, "top");

  const manyAndAlign = parseCommand("画三个矩形，然后顶部对齐");
  assert.equal(manyAndAlign.length, 4);
  assert.equal(new Set(manyAndAlign.slice(0, 3).map(action => action.y)).size, 3);
  assert.equal(manyAndAlign[3].type, "align");
  assert.equal(manyAndAlign[3].mode, "top");
});

test("纯复合指令仍然独立工作", () => {
  // Single composite commands still work via the first decomposeComposite check
  assert.equal(parseCommand("画一个房子").length, 3);
  assert.equal(parseCommand("画一个雪人").length, 3);
  assert.equal(parseCommand("画一个笑脸").length, 4);
  assert.equal(parseCommand("画一排五个圆").length, 5);
  assert.equal(parseCommand("画一列三个矩形").length, 3);
});

test("按类型选择保留中文类型目标且所有图形仍为 all", () => {
  assert.equal(parseCommand("选择所有圆形")[0].target, "圆形");
  assert.equal(parseCommand("选择全部矩形")[0].target, "矩形");
  assert.equal(parseCommand("选择所有图形")[0].target, "all");
});

test("一排一列在画布内等间距且超上限明确拒绝", () => {
  for (const [command, axis, limit] of [
    ["画一排二十个圆", "x", 1000],
    ["画一列二十个矩形", "y", 700]
  ]) {
    const actions = parseCommand(command);
    assert.equal(actions.length, 20);
    assert.ok(actions.every(action => action.width > 0 && action.height >= 0));
    assert.ok(actions.every(action => action.x >= 0 && action.y >= 0
      && action.x + action.width <= 1000 && action.y + action.height <= 700));
    const gaps = actions.slice(1).map((action, index) => action[axis] - actions[index][axis]);
    assert.ok(gaps.every(gap => Math.abs(gap - gaps[0]) < 1e-8));
    assert.ok(actions.at(-1)[axis] < limit);
  }
  assert.throws(() => parseCommand("画一排二十一 个圆".replace(" ", "")), /不能超过 20/);
});

test("常见语义实体修改由本地规则确定性解析", () => {
  assert.deepEqual(parseCommand("把伞改成红色"), [{
    type: "entity_update", target: "伞", changes: { params: { color: "#ef4444" } }
  }]);
  assert.deepEqual(parseCommand("女人往左一点"), [{
    type: "move", target: "人物", dx: -50, dy: 0
  }]);
  assert.deepEqual(parseCommand("删除那只猫"), [{ type: "delete", target: "猫" }]);
  assert.equal(parseCommand("保存项目")[0].format, "project");
});

test("扩展常见场景实体可被后续语音修改", () => {
  assert.deepEqual(parseCommand("把自行车改成红色"), [{
    type: "entity_update", target: "自行车", changes: { params: { color: "#ef4444" } }
  }]);
  assert.deepEqual(parseCommand("删除小狗"), [{ type: "delete", target: "狗" }]);
  assert.deepEqual(parseCommand("小船往右一点"), [{ type: "move", target: "船", dx: 50, dy: 0 }]);
});

test("常见丰富场景由本地构图器稳定生成完整分层画面", () => {
  const rainyWoman = parseCommand("画一个下雨天打伞的女人");
  assert.equal(rainyWoman[0].type, "scene_update");
  assert.ok(rainyWoman.length >= 8);
  assert.deepEqual(
    new Set(rainyWoman.slice(1).map(action => action.templateId)),
    new Set(["cloud", "buildings", "street", "puddle", "streetlamp", "person", "umbrella", "rain"])
  );
  assert.equal(rainyWoman.find(action => action.templateId === "person").params.variant, "woman");

  for (const text of ["画一个午后公园", "画一个有桥和小船的河岸", "画一个月夜小镇", "画一条安静街道", "画一个春日山野"]) {
    const actions = composeCommonScene(text);
    assert.ok(actions.length >= 8, text);
    assert.equal(actions[0].type, "scene_update", text);
    assert.ok(new Set(actions.slice(1).map(action => action.templateId)).size >= 7, text);
  }
  const appended = parseCommand("画一个下雨天打伞的女人", { entityNames: rainyWoman.slice(1).map(action => action.name) });
  assert.ok(appended.slice(1).every(action => !rainyWoman.slice(1).some(existing => existing.name === action.name)));
});

test("艺术创作语音可生成选取混合精修锁定并切换风格", () => {
  assert.deepEqual(parseCommand("生成三张水墨构图小稿，雨中归人"), [{
    type: "creative", operation: "generate_drafts", theme: "雨中归人", style: "ink"
  }]);
  assert.deepEqual(parseCommand("选择第二张小稿", { draftGeneration: 2 }), [{
    type: "creative", operation: "select_draft", draftId: "draft-2-2"
  }]);
  assert.deepEqual(parseCommand("混合第一和第三", { draftGeneration: 2 }), [{
    type: "creative", operation: "mix_drafts", draftIds: ["draft-2-1", "draft-2-3"]
  }]);
  assert.deepEqual(parseCommand("保持构图"), [{ type: "creative", operation: "lock", field: "composition" }]);
  assert.deepEqual(parseCommand("取消锁定构图"), [{ type: "creative", operation: "unlock", field: "composition" }]);
  assert.deepEqual(parseCommand("右侧留白更多"), [{ type: "creative", operation: "refine", instruction: "右侧留白更多" }]);
  assert.deepEqual(parseCommand("切换成木刻风格"), [{ type: "creative", operation: "set_style", style: "woodcut" }]);
  assert.deepEqual(parseCommand("重新生成纹理"), [{ type: "creative", operation: "regenerate_texture" }]);
  assert.deepEqual(parseCommand("移除纹理"), [{ type: "texture", operation: "remove" }]);
});
