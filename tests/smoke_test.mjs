// Smoke test for manual verification after speech recognition fixes.
// Run with: node tests/smoke_test.mjs

const parser = await import("../static/parser.js");
const model = await import("../static/model.js");

let passed = 0;
let failed = 0;

function check(label, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${label}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${label}`);
    console.log(`    ${e.message}`);
  }
}

// ── Parser: composite commands mixed with clauses (was broken) ──
console.log("\n📋 Parser — 复合指令拆解");

check("房子+移动 → 4 个动作", () => {
  const r = parser.parseCommand("画一个房子，然后移动到右边");
  if (r.length !== 4) throw new Error(`期望 4，实际 ${r.length}`);
  if (r[0].kind !== "triangle") throw new Error("第一个不是 triangle");
  if (r[3].type !== "move") throw new Error("第四个不是 move");
});

check("一排矩形+顶部对齐 → 4 个动作", () => {
  const r = parser.parseCommand("画一排三个矩形，然后顶部对齐");
  if (r.length !== 4) throw new Error(`期望 4，实际 ${r.length}`);
  if (r[3].mode !== "top") throw new Error("对齐模式不是 top");
});

check("雪人+复制 → 4 个动作", () => {
  const r = parser.parseCommand("画一个雪人，然后复制它");
  if (r.length !== 4) throw new Error(`期望 4，实际 ${r.length}`);
});

check("笑脸独立 → 4 个动作", () => {
  const r = parser.parseCommand("画一个笑脸");
  if (r.length !== 4) throw new Error(`期望 4，实际 ${r.length}`);
});

// ── Parser: fuzzy correction ──
console.log("\n📋 Parser — 模糊纠错");

check("花一个局型 → rect", () => {
  const r = parser.parseCommand("花一个局型");
  if (r[0].kind !== "rect") throw new Error(`期望 rect，实际 ${r[0].kind}`);
});

check("三除它 → delete", () => {
  const r = parser.parseCommand("三除它");
  if (r[0].type !== "delete") throw new Error(`期望 delete，实际 ${r[0].type}`);
});

check("兰色矩形 → 蓝色填充", () => {
  const r = parser.parseCommand("画一个兰色矩形");
  if (r[0].fill !== "#3b82f6") throw new Error(`期望 #3b82f6，实际 ${r[0].fill}`);
});

// ── Parser: splitCommands ──
console.log("\n📋 Parser — 分句");

check("撤销，然后重做 → 2 句", () => {
  const clauses = parser.splitCommands("撤销，然后重做");
  if (clauses.length !== 2) throw new Error(`期望 2，实际 ${clauses.length}`);
});

check("normalizeText 正确处理'，然后'不产生双'然后'", () => {
  const n = parser.normalizeText("画一排三个矩形，然后顶部对齐");
  if (n.includes("然后 然后")) throw new Error(`产生了双"然后": ${n}`);
  // After fix: "，" + "然后" should collapse to a single "然后"
  if (!n.includes("然后")) throw new Error(`缺少"然后"连接词: ${n}`);
});

// ── Model: transactions ──
console.log("\n📋 Model — 事务执行");

check("创建+撤销 → 回退", () => {
  const engine = new model.DrawingEngine();
  engine.execute([{ type: "create", kind: "circle" }]);
  if (engine.state.objects.length !== 1) throw new Error("创建失败");
  engine.execute([{ type: "history", operation: "undo" }]);
  if (engine.state.objects.length !== 0) throw new Error("撤销失败");
});

check("失败事务不污染状态", () => {
  const engine = new model.DrawingEngine();
  engine.execute([{ type: "create", kind: "rect" }]);
  const before = JSON.stringify(engine.state);
  try { engine.execute([{ type: "align", target: "selected", mode: "top" }]); } catch {}
  if (JSON.stringify(engine.state) !== before) throw new Error("状态被污染");
});

check("组合指令一次撤销全部回退", () => {
  const engine = new model.DrawingEngine();
  const house = parser.decomposeComposite("画一个房子");
  engine.execute(house);
  if (engine.state.objects.length !== 3) throw new Error("创建房子失败");
  engine.execute([{ type: "history", operation: "undo" }]);
  if (engine.state.objects.length !== 0) throw new Error("一次撤销应回退全部3个图形");
});

// ── Results ──
console.log(`\n${'='.repeat(40)}`);
console.log(`通过: ${passed}  失败: ${failed}  总计: ${passed + failed}`);
if (failed > 0) {
  console.log("❌ 存在未通过的校验项");
  process.exit(1);
} else {
  console.log("✅ 所有校验项通过");
}
