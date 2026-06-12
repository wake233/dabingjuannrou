import { validateActions } from "./model.js";

const COLORS = {
  红色: "#ef4444", 蓝色: "#3b82f6", 绿色: "#22c55e", 黄色: "#eab308",
  橙色: "#f97316", 紫色: "#a855f7", 粉色: "#ec4899", 黑色: "#111827",
  白色: "#ffffff", 灰色: "#94a3b8", 青色: "#06b6d4", 透明: "none"
};
const KINDS = {
  矩形: "rect", 方形: "rect", 长方形: "rect", 圆形: "circle", 圆: "circle",
  椭圆: "ellipse", 三角形: "triangle", 三角: "triangle", 星形: "star", 星星: "star",
  直线: "line", 线条: "line", 箭头: "arrow", 文字: "text", 文本: "text"
};
const POSITIONS = ["左上角", "右上角", "左下角", "右下角", "中央", "中间", "左边", "右边", "上边", "下边"];
const CN_DIGITS = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
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
  if (value === "十") return 10;
  let total = 0, current = 0;
  for (const char of value) {
    if (char in CN_DIGITS) current = CN_DIGITS[char];
    else if (char === "十") { total += (current || 1) * 10; current = 0; }
    else if (char === "百") { total += (current || 1) * 100; current = 0; }
  }
  return total + current || null;
}

export function normalizeText(text) {
  return text.trim().replace(/[，。！？、]/g, " 然后 ").replace(/\s+/g, " ")
    .replace(/正方形/g, "方形").replace(/正中央/g, "中央").replace(/中间/g, "中央")
    .replace(/撤消/g, "撤销").replace(/删掉/g, "删除").replace(/拷贝/g, "复制");
}

export function splitCommands(text) {
  return normalizeText(text).split(/\s*(?:然后|并且|接着|随后|再(?=画|创建|选|把|将|向|往|顶部|底部|左|右|水平|垂直|保存|复制|删除|置|组合|取消组合))\s*/).filter(Boolean);
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
  if (/所有|全部/.test(text)) return "all";
  if (/这些图形|它们|整体/.test(text)) return "selected";
  if (/它|这个|选中/.test(text)) return "selected";
  const named = text.match(/(矩形|圆形|椭圆|三角形|星形|直线|箭头|文字)([一二两三四五六七八九十\d]+)/);
  if (named) return `${named[1]}${chineseIndex(chineseNumber(named[2]))}`;
  return context.selected ? "selected" : "last";
}

function parseClause(clause, context) {
  if (/^(撤销|返回上一步)$/.test(clause)) return [{ type: "history", operation: "undo" }];
  if (/^(重做|恢复上一步)$/.test(clause)) return [{ type: "history", operation: "redo" }];
  if (/^(帮助|有什么指令|怎么使用)/.test(clause)) return [{ type: "help" }];
  if (/^(当前状态|画布状态|有什么图形)/.test(clause)) return [{ type: "status" }];
  if (/取消选择/.test(clause)) return [{ type: "select", target: "none" }];
  if (/清空画布|清除画布|全部清空/.test(clause)) return [{ type: "canvas", operation: "clear", requiresConfirmation: true }];
  if (/背景/.test(clause) && colorFrom(clause)) return [{ type: "canvas", operation: "background", color: colorFrom(clause) }];
  if (/保存|导出|下载/.test(clause)) {
    return [{ type: "export", format: /svg/i.test(clause) ? "svg" : "png" }];
  }

  const kindEntry = Object.entries(KINDS).find(([name]) => clause.includes(name));
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
  const context = { selected: Boolean(initialContext.selected) };
  const actions = splitCommands(text).flatMap(clause => parseClause(clause, context));
  validateActions(actions);
  return actions;
}
