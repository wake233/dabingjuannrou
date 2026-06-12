export const CANVAS = { width: 1000, height: 700 };

export const ALLOWED_ACTIONS = new Set([
  "create", "select", "update", "move", "align", "distribute",
  "duplicate", "delete", "group", "ungroup", "history", "canvas",
  "export", "help", "status"
]);

const KINDS = new Set(["rect", "circle", "ellipse", "triangle", "star", "line", "arrow", "text"]);
const POSITIONS = new Set(["左边", "右边", "上边", "下边", "左上角", "右上角", "左下角", "右下角", "中央"]);
const ALIGN_MODES = new Set(["left", "right", "top", "bottom", "hcenter", "vcenter"]);
const AXES = new Set(["horizontal", "vertical"]);
const UPDATE_FIELDS = new Set(["fill", "stroke", "strokeWidth", "opacity", "rotation", "text", "width", "height", "zOrder"]);
const ACTION_FIELDS = {
  create: new Set(["type", "kind", "position", "x", "y", "width", "height", "fill", "stroke", "strokeWidth", "opacity", "rotation", "text"]),
  select: new Set(["type", "target"]),
  update: new Set(["type", "target", "changes"]),
  move: new Set(["type", "target", "position", "dx", "dy"]),
  align: new Set(["type", "target", "mode"]),
  distribute: new Set(["type", "target", "axis"]),
  duplicate: new Set(["type", "target"]),
  delete: new Set(["type", "target"]),
  group: new Set(["type", "target"]),
  ungroup: new Set(["type", "target"]),
  history: new Set(["type", "operation"]),
  canvas: new Set(["type", "operation", "color", "requiresConfirmation"]),
  export: new Set(["type", "format"]),
  help: new Set(["type"]),
  status: new Set(["type"])
};

const TYPE_NAMES = {
  rect: "矩形", circle: "圆形", ellipse: "椭圆", triangle: "三角形",
  star: "星形", line: "直线", arrow: "箭头", text: "文字"
};

const DEFAULTS = {
  rect: { width: 180, height: 120 },
  circle: { width: 130, height: 130 },
  ellipse: { width: 190, height: 110 },
  triangle: { width: 160, height: 140 },
  star: { width: 160, height: 160 },
  line: { width: 180, height: 0 },
  arrow: { width: 180, height: 0 },
  text: { width: 220, height: 60 }
};

function chineseIndex(number) {
  const digits = "零一二三四五六七八九";
  if (number < 10) return digits[number];
  if (number < 20) return `十${number % 10 ? digits[number % 10] : ""}`;
  if (number < 100) return `${digits[Math.floor(number / 10)]}十${number % 10 ? digits[number % 10] : ""}`;
  return String(number);
}

export function initialState() {
  return {
    objects: [], selection: [], background: "#ffffff", counters: {},
    lastCreated: [], nextId: 1, groups: {}, nextGroupId: 1
  };
}

export function validateActions(actions) {
  if (!Array.isArray(actions) || actions.length === 0 || actions.length > 20) {
    throw new Error("动作数量必须在 1 到 20 之间");
  }
  for (const action of actions) {
    if (!isRecord(action) || !ALLOWED_ACTIONS.has(action.type)) {
      throw new Error("包含不允许的动作");
    }
    validateAction(action);
  }
  if (actions.some(action => action.type === "history") && actions.length !== 1) {
    throw new Error("撤销或重做必须单独执行");
  }
  return true;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireFields(action, ...fields) {
  for (const field of fields) {
    if (!(field in action)) throw new Error(`${action.type} 缺少字段 ${field}`);
  }
}

function validateKnownFields(action) {
  for (const field of Object.keys(action)) {
    // Fields prefixed with "_" are internal metadata (e.g. _composite)
    // and are exempt from the allowed-fields whitelist.
    if (field.startsWith("_")) continue;
    if (!ACTION_FIELDS[action.type].has(field)) throw new Error(`${action.type} 包含不允许的字段 ${field}`);
  }
}

function isFiniteNumber(value, minimum = -1_000_000, maximum = 1_000_000) {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum;
}

function validateTarget(target, allowNone = false) {
  const validString = typeof target === "string" && target.length > 0 && target.length <= 100
    && (allowNone || target !== "none");
  const validArray = Array.isArray(target) && target.length > 0 && target.length <= 100
    && target.every(value => typeof value === "string" && value.length > 0 && value.length <= 100);
  if (!validString && !validArray) throw new Error("目标字段无效");
}

function validateColor(value, allowNone = true) {
  if (typeof value !== "string" || value.length > 20 || (!allowNone && value === "none")
    || !(value === "none" || /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value))) {
    throw new Error("颜色字段无效");
  }
}

function validateText(value) {
  if (typeof value !== "string" || value.length > 1000) throw new Error("文字字段无效");
}

function validateDimension(value, allowZero = false) {
  const minimum = allowZero ? 0 : Number.EPSILON;
  if (!isFiniteNumber(value, minimum)) throw new Error("尺寸字段无效");
}

function validateChangeValue(field, value) {
  if (["width", "height"].includes(field) && isRecord(value)) {
    if (Object.keys(value).length !== 1 || !isFiniteNumber(value.multiply, Number.EPSILON, 1000)) {
      throw new Error("缩放倍数无效");
    }
    return;
  }
  if (["fill", "stroke"].includes(field)) validateColor(value);
  else if (field === "strokeWidth" && !isFiniteNumber(value, 0, 1000)) throw new Error("线宽无效");
  else if (field === "opacity" && !isFiniteNumber(value, 0, 1)) throw new Error("透明度无效");
  else if (field === "rotation" && !isFiniteNumber(value)) throw new Error("旋转角度无效");
  else if (field === "text") validateText(value);
  else if (field === "width") validateDimension(value);
  else if (field === "height") validateDimension(value, true);
  else if (field === "zOrder" && !["top", "bottom"].includes(value)) throw new Error("层级操作无效");
}

function validateAction(action) {
  validateKnownFields(action);
  if (action.type === "create") {
    requireFields(action, "kind");
    if (!KINDS.has(action.kind)) throw new Error("图形类型无效");
    if ("position" in action && !POSITIONS.has(action.position)) throw new Error("位置字段无效");
    if ("x" in action && !isFiniteNumber(action.x)) throw new Error("横坐标无效");
    if ("y" in action && !isFiniteNumber(action.y)) throw new Error("纵坐标无效");
    if ("width" in action) validateDimension(action.width);
    if ("height" in action) validateDimension(action.height, ["line", "arrow"].includes(action.kind));
    if ("fill" in action) validateColor(action.fill);
    if ("stroke" in action) validateColor(action.stroke);
    if ("strokeWidth" in action && !isFiniteNumber(action.strokeWidth, 0, 1000)) throw new Error("线宽无效");
    if ("opacity" in action && !isFiniteNumber(action.opacity, 0, 1)) throw new Error("透明度无效");
    if ("rotation" in action && !isFiniteNumber(action.rotation)) throw new Error("旋转角度无效");
    if ("text" in action) validateText(action.text);
    return;
  }
  if (action.type === "select") {
    requireFields(action, "target"); validateTarget(action.target, true); return;
  }
  if (action.type === "update") {
    requireFields(action, "target", "changes"); validateTarget(action.target);
    if (!isRecord(action.changes) || Object.keys(action.changes).length === 0) throw new Error("修改内容无效");
    for (const [field, value] of Object.entries(action.changes)) {
      if (!UPDATE_FIELDS.has(field)) throw new Error(`不能修改属性 ${field}`);
      validateChangeValue(field, value);
    }
    return;
  }
  if (action.type === "move") {
    requireFields(action, "target"); validateTarget(action.target);
    const hasPosition = "position" in action;
    const hasOffset = "dx" in action || "dy" in action;
    if (hasPosition === hasOffset) throw new Error("移动动作必须指定位置或偏移量");
    if (hasPosition && !POSITIONS.has(action.position)) throw new Error("位置字段无效");
    if ("dx" in action && !isFiniteNumber(action.dx)) throw new Error("水平偏移无效");
    if ("dy" in action && !isFiniteNumber(action.dy)) throw new Error("垂直偏移无效");
    return;
  }
  if (["align", "distribute"].includes(action.type)) {
    const field = action.type === "align" ? "mode" : "axis";
    requireFields(action, "target", field); validateTarget(action.target);
    const allowed = action.type === "align" ? ALIGN_MODES : AXES;
    if (!allowed.has(action[field])) throw new Error(`${field} 字段无效`);
    return;
  }
  if (["duplicate", "delete", "group", "ungroup"].includes(action.type)) {
    requireFields(action, "target"); validateTarget(action.target); return;
  }
  if (action.type === "history") {
    requireFields(action, "operation");
    if (!["undo", "redo"].includes(action.operation)) throw new Error("历史操作无效");
    return;
  }
  if (action.type === "canvas") {
    requireFields(action, "operation");
    if (!["clear", "background"].includes(action.operation)) throw new Error("画布操作无效");
    if (action.operation === "clear") {
      if (action.requiresConfirmation !== true) throw new Error("清空画布必须确认");
      if ("color" in action) throw new Error("清空画布不能设置颜色");
    }
    if (action.operation === "background") {
      if ("requiresConfirmation" in action) throw new Error("背景操作不能包含确认字段");
      requireFields(action, "color"); validateColor(action.color, false);
    }
    return;
  }
  if (action.type === "export") {
    requireFields(action, "format");
    if (!["svg", "png"].includes(action.format)) throw new Error("导出格式无效");
  }
}

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

function resolve(state, target = "selected") {
  if (Array.isArray(target)) return state.objects.filter(o => target.includes(o.id));
  if (target === "selected") return state.objects.filter(o => state.selection.includes(o.id));
  if (target === "last") return state.objects.filter(o => state.lastCreated.includes(o.id));
  if (target === "lastTwo") return state.objects.slice(-2);
  if (target === "all") return [...state.objects];
  if (typeof target === "string") {
    const exact = state.objects.find(o => o.id === target || o.name === target);
    if (exact) return [exact];
    return state.objects.filter(o => TYPE_NAMES[o.kind] === target);
  }
  return [];
}

function requireTargets(state, target, minimum = 1) {
  const found = resolve(state, target);
  if (found.length < minimum) throw new Error(minimum > 1 ? "选中的图形数量不足" : "没有找到目标图形");
  return found;
}

function reconcileGroups(state) {
  for (const [groupId, memberIds] of Object.entries(state.groups)) {
    const members = state.objects.filter(o => memberIds.includes(o.id));
    if (members.length < 2) {
      members.forEach(o => { if (o.groupId === groupId) delete o.groupId; });
      delete state.groups[groupId];
      continue;
    }
    state.groups[groupId] = members.map(o => o.id);
  }
  const validGroups = new Set(Object.keys(state.groups));
  state.objects.forEach(o => { if (o.groupId && !validGroups.has(o.groupId)) delete o.groupId; });
}

function positionFor(name, width, height) {
  const gap = 45;
  const positions = {
    "左边": [gap, (CANVAS.height - height) / 2],
    "右边": [CANVAS.width - width - gap, (CANVAS.height - height) / 2],
    "上边": [(CANVAS.width - width) / 2, gap],
    "下边": [(CANVAS.width - width) / 2, CANVAS.height - height - gap],
    "左上角": [gap, gap], "右上角": [CANVAS.width - width - gap, gap],
    "左下角": [gap, CANVAS.height - height - gap],
    "右下角": [CANVAS.width - width - gap, CANVAS.height - height - gap],
    "中央": [(CANVAS.width - width) / 2, (CANVAS.height - height) / 2]
  };
  return positions[name] || positions["中央"];
}

function createObject(state, action) {
  if (!DEFAULTS[action.kind]) throw new Error("不支持的图形类型");
  const count = (state.counters[action.kind] || 0) + 1;
  state.counters[action.kind] = count;
  const size = DEFAULTS[action.kind];
  const width = Number(action.width) || size.width;
  const height = action.height === 0 ? 0 : (Number(action.height) || size.height);
  const [px, py] = positionFor(action.position || "中央", width, height);
  const object = {
    id: `shape-${state.nextId++}`, name: `${TYPE_NAMES[action.kind]}${chineseIndex(count)}`,
    kind: action.kind, x: Number.isFinite(action.x) ? action.x : px,
    y: Number.isFinite(action.y) ? action.y : py, width, height,
    fill: action.fill || (["line", "arrow"].includes(action.kind) ? "none" : "#4f8cff"),
    stroke: action.stroke || "#26364a", strokeWidth: Number(action.strokeWidth) || 3,
    opacity: Number.isFinite(action.opacity) ? action.opacity : 1,
    rotation: Number(action.rotation) || 0, text: action.text || "文字"
  };
  state.objects.push(object);
  state.selection = [object.id];
  state.lastCreated = [object.id];
  return object;
}

function applyAction(state, action) {
  if (action.type === "create") return createObject(state, action);
  if (action.type === "select") {
    if (action.target === "none") state.selection = [];
    else {
      const targets = requireTargets(state, action.target || "last");
      state.selection = targets.map(o => o.id);
    }
    return;
  }
  if (action.type === "update") {
    const allowed = new Set(["fill", "stroke", "strokeWidth", "opacity", "rotation", "text", "width", "height", "zOrder"]);
    const targets = requireTargets(state, action.target);
    for (const object of targets) {
      for (const [key, value] of Object.entries(action.changes || {})) {
        if (!allowed.has(key)) throw new Error(`不能修改属性 ${key}`);
        if (key === "zOrder") continue;
        object[key] = value && typeof value === "object" && Number.isFinite(value.multiply)
          ? object[key] * value.multiply : value;
      }
    }
    if (action.changes?.zOrder) {
      const ids = new Set(targets.map(o => o.id));
      const others = state.objects.filter(o => !ids.has(o.id));
      state.objects = action.changes.zOrder === "top" ? [...others, ...targets] : [...targets, ...others];
    }
    return;
  }
  if (action.type === "move") {
    const targets = requireTargets(state, action.target);
    if (action.position) {
      const minX = Math.min(...targets.map(o => o.x));
      const minY = Math.min(...targets.map(o => o.y));
      const maxX = Math.max(...targets.map(o => o.x + o.width));
      const maxY = Math.max(...targets.map(o => o.y + Math.max(o.height, 1)));
      const [x, y] = positionFor(action.position, maxX - minX, maxY - minY);
      targets.forEach(o => { o.x += x - minX; o.y += y - minY; });
    } else {
      targets.forEach(o => { o.x += Number(action.dx) || 0; o.y += Number(action.dy) || 0; });
    }
    return;
  }
  if (action.type === "align") {
    const targets = requireTargets(state, action.target, 2);
    const box = {
      left: Math.min(...targets.map(o => o.x)), right: Math.max(...targets.map(o => o.x + o.width)),
      top: Math.min(...targets.map(o => o.y)), bottom: Math.max(...targets.map(o => o.y + o.height))
    };
    for (const o of targets) {
      if (action.mode === "left") o.x = box.left;
      else if (action.mode === "right") o.x = box.right - o.width;
      else if (action.mode === "top") o.y = box.top;
      else if (action.mode === "bottom") o.y = box.bottom - o.height;
      else if (action.mode === "hcenter") o.x = (box.left + box.right - o.width) / 2;
      else if (action.mode === "vcenter") o.y = (box.top + box.bottom - o.height) / 2;
      else throw new Error("未知对齐方式");
    }
    return;
  }
  if (action.type === "distribute") {
    const targets = requireTargets(state, action.target, 3);
    const axis = action.axis === "vertical" ? "y" : "x";
    const size = axis === "x" ? "width" : "height";
    const sorted = [...targets].sort((a, b) => a[axis] - b[axis]);
    const start = sorted[0][axis], end = sorted.at(-1)[axis] + sorted.at(-1)[size];
    const occupied = sorted.reduce((sum, o) => sum + o[size], 0);
    const gap = (end - start - occupied) / (sorted.length - 1);
    let cursor = start;
    sorted.forEach(o => { o[axis] = cursor; cursor += o[size] + gap; });
    return;
  }
  if (action.type === "duplicate") {
    const targets = requireTargets(state, action.target);
    const ids = [];
    for (const original of targets) {
      const duplicate = createObject(state, { ...original, kind: original.kind, x: original.x + 25, y: original.y + 25 });
      duplicate.text = original.text;
      ids.push(duplicate.id);
    }
    state.selection = ids; state.lastCreated = ids;
    return;
  }
  if (action.type === "delete") {
    const ids = new Set(requireTargets(state, action.target).map(o => o.id));
    state.objects = state.objects.filter(o => !ids.has(o.id));
    state.selection = state.selection.filter(id => !ids.has(id));
    state.lastCreated = state.lastCreated.filter(id => !ids.has(id));
    reconcileGroups(state);
    return;
  }
  if (action.type === "group") {
    const targets = requireTargets(state, action.target, 2);
    const targetIds = new Set(targets.map(o => o.id));
    for (const [groupId, memberIds] of Object.entries(state.groups)) {
      state.groups[groupId] = memberIds.filter(id => !targetIds.has(id));
    }
    targets.forEach(o => { delete o.groupId; });
    reconcileGroups(state);
    const groupId = `group-${state.nextGroupId++}`;
    state.groups[groupId] = targets.map(o => o.id);
    targets.forEach(o => { o.groupId = groupId; });
    return;
  }
  if (action.type === "ungroup") {
    const targets = requireTargets(state, action.target);
    const groupIds = new Set(targets.map(o => o.groupId).filter(Boolean));
    if (!groupIds.size) throw new Error("目标没有组合");
    groupIds.forEach(id => delete state.groups[id]);
    state.objects.forEach(o => { if (groupIds.has(o.groupId)) delete o.groupId; });
    return;
  }
  if (action.type === "canvas") {
    if (action.operation === "clear") {
      state.objects = []; state.selection = []; state.lastCreated = []; state.groups = {};
    } else if (action.operation === "background") state.background = action.color;
    else throw new Error("未知画布操作");
    return;
  }
  if (["export", "help", "status", "history"].includes(action.type)) return;
  throw new Error("无法执行动作");
}

export class DrawingEngine {
  constructor(state = initialState()) {
    this.state = copy(state);
    this.undoStack = [];
    this.redoStack = [];
  }

  execute(actions) {
    validateActions(actions);
    if (actions.length === 1 && actions[0].type === "history") {
      return actions[0].operation === "redo" ? this.redo() : this.undo();
    }
    const effects = actions.filter(a => ["export", "help", "status"].includes(a.type));
    const mutations = actions.filter(a => !["export", "help", "status"].includes(a.type));
    if (!mutations.length) return { state: this.state, effects };
    const before = copy(this.state);
    const working = copy(this.state);
    try {
      mutations.forEach(action => applyAction(working, action));
    } catch (error) {
      throw error;
    }
    this.undoStack.push(before);
    if (this.undoStack.length > 50) this.undoStack.shift();
    this.redoStack = [];
    this.state = working;
    return { state: this.state, effects };
  }

  undo() {
    if (!this.undoStack.length) throw new Error("没有可以撤销的操作");
    this.redoStack.push(copy(this.state));
    this.state = this.undoStack.pop();
    return { state: this.state, effects: [] };
  }

  redo() {
    if (!this.redoStack.length) throw new Error("没有可以重做的操作");
    this.undoStack.push(copy(this.state));
    this.state = this.redoStack.pop();
    return { state: this.state, effects: [] };
  }
}
