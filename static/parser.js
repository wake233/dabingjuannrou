import { validateActions } from "./model.js";

const COLORS = {
  红色: "#ef4444", 蓝色: "#3b82f6", 绿色: "#22c55e", 黄色: "#eab308",
  橙色: "#f97316", 紫色: "#a855f7", 粉色: "#ec4899", 黑色: "#111827",
  白色: "#ffffff", 灰色: "#94a3b8", 青色: "#06b6d4", 透明: "none"
};
const KINDS = {
  矩形: "rect", 方形: "rect", 长方形: "rect", 圆形: "circle", 圆: "circle",
  椭圆: "ellipse", 椭圆形: "ellipse", 三角形: "triangle", 三角: "triangle",
  星形: "star", 星星: "star", 五角形: "star", 五角星: "star",
  直线: "line", 线条: "line", 箭头: "arrow", 文字: "text", 文本: "text"
};
const POSITIONS = ["左上角", "右上角", "左下角", "右下角", "中央", "中间", "左边", "右边", "上边", "下边"];
const CN_DIGITS = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

// ── Homophone / near-homophone fuzzy correction table ──────────
// Sorted by descending key length at runtime (longest phrase matched first).
const FUZZY_MAP = Object.freeze(Object.fromEntries(Object.entries({
  // ── Action words (画/创建/删除/撤销/重做/移动/复制/填充/描边) ──
  "花一个": "画一个", "花矩形": "画矩形", "华图": "画图", "华圆": "画圆",
  "花椭圆": "画椭圆", "花三角形": "画三角形", "花线": "画线",
  "花文字": "画文字", "华一个": "画一个",
  // ── Shape words (形状名) ──
  "局型": "矩形", "方型": "方形", "园形": "圆形", "椭圆型": "椭圆形",
  "三脚型": "三角形", "五角型": "五角形", "矩型": "矩形", "圆型": "圆形",
  "三角型": "三角形", "星型": "星形", "箭型": "箭形",
  // ── Operation words (操作词) ──
  "三除": "删除", "山除": "删除", "撤消": "撤销", "鼎部": "顶部",
  "低部": "底部", "举重": "居中", "缩方": "缩放", "悬转": "旋转",
  "一副": "移动", "拷贝": "复制", "天充": "填充", "苗边": "描边",
  // ── Colors (颜色) ──
  "黄涩": "黄色", "兰色": "蓝色", "滤色": "绿色", "成色": "橙色",
  "自色": "紫色", "粉涩": "粉色", "白涩": "白色", "黑涩": "黑色",
  "红涩": "红色", "宗色": "棕色",
  // ── Position / direction (位置/方向) ──
  "又边": "右边", "中样": "中央", "坐上方": "左上角",
  "又上方": "右上角", "坐下": "左下角", "又下": "右下角",
  // ── Quantity / common (数量/其他) ──
  "一个": "一个", "两个": "两个", "三个": "三个",
  // ── Additional common errors (额外常误) ──
  "青空": "清空", "抱存": "保存", "倒出": "导出", "背色": "背景色",
  "画部": "画布", "背井": "背景", "钱宽": "线宽",
  "头明度": "透明度", "全不": "全部", "所又": "所有",
  "取消选择": "取消选择", "选的": "选择", "帮助": "帮助",
  "撞态": "状态", "对齐": "对齐", "分步": "分布", "主合": "组合",
  "打组": "打组", "方形": "方形", "开始画": "开始画",
  "灰度": "灰色",
  // ── Expanded homophone coverage ──
  "花星形": "画星形", "花箭": "画箭", "华一个矩形": "画一个矩形",
  "花圆形": "画圆形", "画局型": "画矩形", "删出": "删除",
  "移出": "移动", "三解形": "三角形", "变框": "边框",
  "退色": "褪色", "透民度": "透明度", "去消": "取消",
  "线款": "线宽", "背静": "背景", "花步": "画布",
  "青除": "清除", "起用": "启用",
}).sort(([a], [b]) => b.length - a.length)));

function fuzzyCorrect(text) {
  let result = text;
  for (const [wrong, correct] of Object.entries(FUZZY_MAP)) {
    if (result.includes(wrong)) {
      result = result.replaceAll(wrong, correct);
    }
  }
  return result;
}

function chineseIndex(number) {
  const digits = "零一二三四五六七八九";
  if (number < 10) return digits[number];
  if (number < 20) return `十${number % 10 ? digits[number % 10] : ""}`;
  if (number < 100) return `${digits[Math.floor(number / 10)]}十${number % 10 ? digits[number % 10] : ""}`;
  return String(number);
}

export function chineseNumber(value) {
  if (value == null) return null;
  if (/^\d+(\.\d+)?$/.test(value)) return Number(value);
  if (!/^[零一二两三四五六七八九十百千]+$/.test(value)) return null;
  let total = 0, section = 0, current = 0, lastUnit = 1, zeroAfterUnit = false;
  for (const char of value) {
    if (char in CN_DIGITS) {
      current = CN_DIGITS[char];
      if (char === "零" && lastUnit > 1) zeroAfterUnit = true;
    }
    else {
      const unit = { 十: 10, 百: 100, 千: 1000 }[char];
      section += (current || 1) * unit;
      current = 0;
      lastUnit = unit;
      zeroAfterUnit = false;
    }
  }
  if (current && lastUnit >= 100 && !zeroAfterUnit) current *= lastUnit / 10;
  total += section + current;
  return total || null;
}

export function normalizeText(text) {
  const quotes = [];
  const guarded = text.trim().replace(/[“”「」"][^“”「」"]*?[“”「」"]/g, (match) => {
    quotes.push(match);
    return `\x00Q${quotes.length - 1}\x00`;
  });
  // Replace Chinese punctuation with " 然后 ", but avoid creating
  // duplicate "然后" sequences (e.g. "，然后" → " 然后 然后").
  const normalized = guarded
    .replace(/[。！？、]/g, " 然后 ")
    .replace(/，(?:\s*然后)?/g, " 然后 ")
    .replace(/\s+/g, " ")
    .replace(/正方形/g, "方形").replace(/正中央/g, "中央").replace(/中间/g, "中央")
    .replace(/撤消/g, "撤销").replace(/删掉/g, "删除").replace(/拷贝/g, "复制");
  return normalized.replace(/\x00Q(\d+)\x00/g, (_, i) => quotes[Number(i)]);
}

export function splitCommands(text, alreadyNormalized = false) {
  const normalized = alreadyNormalized ? text : normalizeText(text);
  return normalized.split(/\s*(?:然后|并且|接着|随后|再(?=画|创建|选|把|将|向|往|顶部|底部|左|右|水平|垂直|保存|复制|删除|置|组合|取消组合))\s*/).filter(Boolean);
}

// Sorted by key length descending so "椭圆形" matches before "圆"
const KINDS_SORTED = Object.entries(KINDS).sort(([a], [b]) => b.length - a.length);

function shapeKindFromText(text) {
  const matches = KINDS_SORTED.filter(([keyword]) => text.includes(keyword));
  // Prefer longest-matching keyword (e.g. "椭圆形" → "椭圆" over "圆形")
  matches.sort(([a], [b]) => b.length - a.length);
  return matches[0]?.[1] || null;
}

const SHAPE_DEFAULTS = {
  rect: { width: 200, height: 150 },
  circle: { width: 160, height: 160 },
  ellipse: { width: 200, height: 110 },
  triangle: { width: 200, height: 140 },
  star: { width: 160, height: 160 },
  line: { width: 180, height: 0 },
  arrow: { width: 180, height: 0 },
  text: { width: 220, height: 60 }
};

export function decomposeComposite(text) {
  const normalized = normalizeText(text).trim();

  const housePattern = /^(?:画(?:一个)?(?:房子|房屋))\s*$/;
  if (housePattern.test(normalized)) {
    const cx = 500, cy = 350;
    const wallW = 200, wallH = 150;
    return [
      { type: "create", kind: "triangle", x: cx - wallW / 2, y: cy - wallH / 2 - 140, width: wallW, height: 140, fill: "#eab308" },
      { type: "create", kind: "rect", x: cx - wallW / 2, y: cy - wallH / 2, width: wallW, height: wallH, fill: "#f97316" },
      { type: "create", kind: "rect", x: cx - 30, y: cy + wallH / 2 - 70, width: 60, height: 70, fill: "#78350f" }
    ];
  }

  const snowmanPattern = /^(?:画(?:一个)?雪人)\s*$/;
  if (snowmanPattern.test(normalized)) {
    const cx = 500;
    return [
      { type: "create", kind: "circle", x: cx - 60, y: 390, width: 120, height: 120, fill: "#ffffff", stroke: "#26364a" },
      { type: "create", kind: "circle", x: cx - 40, y: 300, width: 80, height: 80, fill: "#ffffff", stroke: "#26364a" },
      { type: "create", kind: "circle", x: cx - 25, y: 225, width: 50, height: 50, fill: "#ffffff", stroke: "#26364a" }
    ];
  }

  const smileyPattern = /^(?:画(?:一个)?笑脸)\s*$/;
  if (smileyPattern.test(normalized)) {
    const cx = 500, cy = 350;
    return [
      { type: "create", kind: "circle", x: cx - 80, y: cy - 80, width: 160, height: 160, fill: "#eab308", stroke: "#26364a" },
      { type: "create", kind: "circle", x: cx - 50 - 10, y: cy - 40, width: 20, height: 20, fill: "#111827", stroke: "none" },
      { type: "create", kind: "circle", x: cx + 50 - 10, y: cy - 40, width: 20, height: 20, fill: "#111827", stroke: "none" },
      { type: "create", kind: "ellipse", x: cx - 40, y: cy + 30, width: 80, height: 30, fill: "none", stroke: "#111827", strokeWidth: 3 }
    ];
  }

  const rowPattern = /^画一排([零一二两三四五六七八九十百千\d]+)个(.+)$/;
  const rowMatch = normalized.match(rowPattern);
  if (rowMatch) {
    const count = chineseNumber(rowMatch[1]);
    const kind = shapeKindFromText(rowMatch[2]);
    if (kind && count >= 1 && count <= 20) return arrangeComposite(kind, count, "horizontal");
    if (kind && count > 20) throw new Error("复合动作数量不能超过 20");
  }

  const colPattern = /^画一列([零一二两三四五六七八九十百千\d]+)个(.+)$/;
  const colMatch = normalized.match(colPattern);
  if (colMatch) {
    const count = chineseNumber(colMatch[1]);
    const kind = shapeKindFromText(colMatch[2]);
    if (kind && count >= 1 && count <= 20) return arrangeComposite(kind, count, "vertical");
    if (kind && count > 20) throw new Error("复合动作数量不能超过 20");
  }

  return null;
}

function arrangeComposite(kind, count, axis) {
  const margin = 20;
  const available = axis === "horizontal" ? 1000 - margin * 2 : 700 - margin * 2;
  const original = SHAPE_DEFAULTS[kind];
  const primary = axis === "horizontal" ? original.width : Math.max(original.height, 1);
  const maxGap = Math.min(30, primary * .25);
  const gap = count > 1 ? Math.max(0, Math.min(maxGap, (available - primary * count) / (count - 1))) : 0;
  const scale = Math.min(1, available / (primary * count + gap * (count - 1)));
  const width = original.width * scale;
  const height = original.height * scale;
  const adjustedPrimary = axis === "horizontal" ? width : Math.max(height, 1);
  const adjustedGap = count > 1 ? Math.max(0, (available - adjustedPrimary * count) / (count - 1)) : 0;
  const total = adjustedPrimary * count + adjustedGap * (count - 1);
  const start = margin + (available - total) / 2;
  return Array.from({ length: count }, (_, index) => ({
    type: "create", kind,
    x: axis === "horizontal" ? start + index * (width + adjustedGap) : (1000 - width) / 2,
    y: axis === "vertical" ? start + index * (Math.max(height, 1) + adjustedGap) : (700 - height) / 2,
    width, height
  }));
}

function colorFrom(text) {
  return Object.entries(COLORS).find(([name]) => text.includes(name))?.[1];
}

function colorAfter(text, words) {
  const names = Object.keys(COLORS).join("|");
  const match = text.match(new RegExp(`(?:${words})(?:改成|设为|设置为|是|为)?(${names})`));
  return match ? COLORS[match[1]] : null;
}

function colorWithoutStroke(text) {
  const names = Object.keys(COLORS).join("|");
  return colorFrom(text.replace(new RegExp(`(?:描边|边框|轮廓)(?:改成|设为|设置为|是|为)?(?:${names})`, "g"), ""));
}

function numberAfter(text, words) {
  const match = text.match(new RegExp(`(?:${words})([零一二两三四五六七八九十百\\d.]+)`));
  return match ? chineseNumber(match[1]) : null;
}

function targetFrom(text, context) {
  if (/刚才两个|上两个|最近两个/.test(text)) return "lastTwo";
  if (/所有|全部/.test(text)) {
    const typeName = KINDS_SORTED.find(([name]) => text.includes(name))?.[0];
    if (typeName && !/所有图形|全部图形/.test(text)) return TYPE_TARGET_NAMES[shapeKindFromText(typeName)];
    return "all";
  }
  if (/这些图形|它们|整体/.test(text)) return "selected";
  if (/它|这个/.test(text) && context.composite) return "last";
  if (/它|这个|选中/.test(text)) return "selected";
  const group = text.match(/组合([一二两三四五六七八九十百千\d]+)/);
  if (group) return `组合${chineseIndex(chineseNumber(group[1]))}`;
  const named = text.match(/(矩形|圆形|椭圆|三角形|星形|直线|箭头|文字)([一二两三四五六七八九十百千\d]+)/);
  if (named) return `${named[1]}${chineseIndex(chineseNumber(named[2]))}`;
  return context.selected ? "selected" : "last";
}

const TYPE_TARGET_NAMES = {
  rect: "矩形", circle: "圆形", ellipse: "椭圆", triangle: "三角形",
  star: "星形", line: "直线", arrow: "箭头", text: "文字"
};

function parseClause(clause, context) {
  if (/^(撤销|返回上一步)$/.test(clause)) return [{ type: "history", operation: "undo" }];
  if (/^(重做|恢复上一步)$/.test(clause)) return [{ type: "history", operation: "redo" }];
  if (/^(帮助|有什么指令|怎么使用)/.test(clause)) return [{ type: "help" }];
  if (/^(当前状态|画布状态|有什么图形)/.test(clause)) return [{ type: "status" }];
  if (/取消选择/.test(clause)) return [{ type: "select", target: "none" }];
  if (/清空画布|清除画布|全部清空/.test(clause)) return [{ type: "canvas", operation: "clear" }];
  if (/背景/.test(clause) && colorFrom(clause)) return [{ type: "canvas", operation: "background", color: colorFrom(clause) }];
  if (/保存|导出|下载/.test(clause)) {
    return [{ type: "export", format: /svg/i.test(clause) ? "svg" : "png" }];
  }

  const kindEntry = KINDS_SORTED.find(([name]) => clause.includes(name));
  if (kindEntry && /画|创建|添加|生成|来一个/.test(clause)) {
    const position = POSITIONS.find(p => clause.includes(p))?.replace("中间", "中央");
    const action = { type: "create", kind: kindEntry[1] };
    const fill = colorAfter(clause, "填充|颜色") || colorWithoutStroke(clause);
    const stroke = colorAfter(clause, "描边|边框|轮廓");
    if (fill) action.fill = fill;
    if (stroke) action.stroke = stroke;
    if (position) action.position = position;
    const width = numberAfter(clause, "宽(?:度)?");
    const height = numberAfter(clause, "高(?:度)?");
    if (width) action.width = width;
    if (height) action.height = height;
    if (kindEntry[1] === "text") {
      const quoted = clause.match(/[“"「](.+?)[”"」]/);
      action.text = quoted?.[1] || clause.match(/(?:写上|内容是|文字是)(.+?)(?:放在|$)/)?.[1]?.trim() || "文字";
    }
    return [action];
  }

  if (/选中|选择/.test(clause)) {
    const action = { type: "select", target: targetFrom(clause, context) };
    context.selected = true;
    return [action];
  }
  const target = targetFrom(clause, context);
  if (/取消组合|解散组合/.test(clause)) return [{ type: "ungroup", target }];
  if (/组合|编组/.test(clause)) return [{ type: "group", target }];
  if (/复制|克隆/.test(clause)) return [{ type: "duplicate", target }];
  if (/删除|移除/.test(clause)) return [{ type: "delete", target }];
  if (/置顶|移到最上层/.test(clause)) return [{ type: "update", target, changes: { zOrder: "top" } }];
  if (/置底|移到最下层/.test(clause)) return [{ type: "update", target, changes: { zOrder: "bottom" } }];

  const position = POSITIONS.find(p => clause.includes(p));
  if (/移动|放到|放在|移到/.test(clause) && position) {
    return [{ type: "move", target, position: position.replace("中间", "中央") }];
  }
  const distance = chineseNumber(clause.match(/([零一二两三四五六七八九十百\d.]+)(?:个像素|像素)?/)?.[1]) || 50;
  if (/向左|往左/.test(clause)) return [{ type: "move", target, dx: -distance, dy: 0 }];
  if (/向右|往右/.test(clause)) return [{ type: "move", target, dx: distance, dy: 0 }];
  if (/向上|往上/.test(clause)) return [{ type: "move", target, dx: 0, dy: -distance }];
  if (/向下|往下/.test(clause)) return [{ type: "move", target, dx: 0, dy: distance }];

  const alignments = [
    ["顶部对齐", "top"], ["底部对齐", "bottom"], ["左对齐", "left"], ["右对齐", "right"],
    ["水平居中", "hcenter"], ["垂直居中", "vcenter"]
  ];
  const alignment = alignments.find(([word]) => clause.includes(word));
  if (alignment) return [{ type: "align", target, mode: alignment[1] }];
  if (/横向均匀|水平分布/.test(clause)) return [{ type: "distribute", target, axis: "horizontal" }];
  if (/纵向均匀|垂直分布/.test(clause)) return [{ type: "distribute", target, axis: "vertical" }];

  const changes = {};
  const textValue = clause.match(/(?:写上|内容是|文字是)[“"「]?(.+?)[”"」]?(?:放在|$)/)?.[1]?.trim();
  if (textValue) changes.text = textValue;
  const fill = colorAfter(clause, "填充|颜色");
  const stroke = colorAfter(clause, "描边|边框|轮廓");
  const genericColor = colorFrom(clause);
  if (fill) changes.fill = fill;
  else if (genericColor && /改成|变成/.test(clause) && !/描边|边框|轮廓/.test(clause)) changes.fill = genericColor;
  if (stroke) changes.stroke = stroke;
  const strokeWidth = numberAfter(clause, "线宽|描边宽度");
  if (strokeWidth) changes.strokeWidth = strokeWidth;
  const rotation = numberAfter(clause, "旋转");
  if (rotation) changes.rotation = rotation;
  const opacity = numberAfter(clause, "透明度");
  if (opacity != null) changes.opacity = opacity > 1 ? opacity / 100 : opacity;
  const scale = numberAfter(clause, "放大|缩小");
  if (scale && /放大|缩小/.test(clause)) {
    const ratio = /缩小/.test(clause) ? 1 / scale : scale;
    changes.width = { multiply: ratio }; changes.height = { multiply: ratio };
  }
  if (Object.keys(changes).length) return [{ type: "update", target, changes }];
  throw new Error(`无法理解“${clause}”`);
}

export function parseCommand(text, initialContext = {}) {
  const context = { selected: Boolean(initialContext.selected), composite: false };
  const corrected = fuzzyCorrect(text);
  const normalized = normalizeText(corrected);
  // Split into clauses, then try decomposeComposite on EACH clause.
  // This fixes DESIGN.md §4.2 / §7.8: composite commands like "画一个房子"
  // could not previously be mixed with other clauses ("然后移动到右边").
  // We must split FIRST because decomposeComposite patterns use .+ which is
  // greedy and would consume subsequent clauses as part of the shape description.
  let compositeSeq = 0;
  const actions = splitCommands(normalized, true).flatMap(clause => {
    const composite = decomposeComposite(clause.trim());
    if (composite) {
      // Mark composite-generated actions with a shared _compositeId so
      // each composite group is treated as one semantic unit for
      // single-intent commands like "画一个房子".
      const gid = ++compositeSeq;
      context.composite = true;
      return composite.map(action => ({ ...action, _compositeId: gid }));
    }
    const parsed = parseClause(clause.trim(), context);
    context.composite = false;
    return parsed;
  });
  validateActions(actions);
  return actions;
}
