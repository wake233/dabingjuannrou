export const CANVAS = { width: 1000, height: 700 };

export const ALLOWED_ACTIONS = new Set([
  "create", "select", "update", "move", "align", "distribute",
  "duplicate", "delete", "group", "ungroup", "history", "canvas",
  "export", "help", "status"
]);

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
    if (!action || typeof action !== "object" || !ALLOWED_ACTIONS.has(action.type)) {
      throw new Error("包含不允许的动作");
    }
  }
  return true;
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
    return;
  }
  if (action.type === "group") {
    const targets = requireTargets(state, action.target, 2);
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
