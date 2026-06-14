import { ENTITY_TEMPLATES, emptyScene, validateEntityParams } from "./scene_schema.js";
import {
  ART_STYLES, LOCKABLE_FIELDS, applyDraftToEntities, emptyArtState, generateCompositionDrafts,
  mixCompositionDrafts, refineArtwork, styleDirection, validateArtState
} from "./art_schema.js";

export const CANVAS = { width: 1000, height: 700 };

export const ALLOWED_ACTIONS = new Set([
  "create", "select", "update", "move", "align", "distribute",
  "duplicate", "delete", "group", "ungroup", "history", "canvas",
  "export", "help", "status", "entity_create", "entity_update", "scene_update", "creative", "texture"
]);

const KINDS = new Set(["rect", "circle", "ellipse", "triangle", "star", "line", "arrow", "text"]);
const POSITIONS = new Set(["左边", "右边", "上边", "下边", "左上角", "右上角", "左下角", "右下角", "中央"]);
const ALIGN_MODES = new Set(["left", "right", "top", "bottom", "hcenter", "vcenter"]);
const AXES = new Set(["horizontal", "vertical"]);
const UPDATE_FIELDS = new Set(["fill", "stroke", "strokeWidth", "opacity", "rotation", "text", "width", "height", "zOrder"]);
const PROJECT_NAME_MAX_LENGTH = 100;
const HISTORY_LIMIT = 50;
const SHAPE_ID_PATTERN = /^shape-[1-9]\d*$/;
const ENTITY_ID_PATTERN = /^entity-[1-9]\d*$/;
const GROUP_ID_PATTERN = /^group-[1-9]\d*$/;
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
  canvas: new Set(["type", "operation", "color"]),
  export: new Set(["type", "format"]),
  help: new Set(["type"]),
  status: new Set(["type"]),
  entity_create: new Set(["type", "templateId", "name", "role", "x", "y", "width", "height", "rotation", "opacity", "layer", "params"]),
  entity_update: new Set(["type", "target", "changes"]),
  scene_update: new Set(["type", "changes"]),
  creative: new Set(["type", "operation", "theme", "style", "draftId", "draftIds", "instruction", "target", "field"]),
  texture: new Set(["type", "operation", "prompt", "model", "cacheKey", "mimeType", "width", "height"])
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
    lastCreated: [], nextId: 1, groups: {}, nextGroupId: 1, scene: emptyScene(), art: emptyArtState()
  };
}

export function validateActions(actions) {
  const sceneBatch = Array.isArray(actions) && actions.length <= 21
    && actions.filter(action => action?.type === "scene_update").length === 1
    && actions.filter(action => action?.type === "entity_create").length === actions.length - 1;
  if (!Array.isArray(actions) || actions.length === 0 || (actions.length > 20 && !sceneBatch)) {
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

function isProjectString(value) {
  return typeof value === "string" && value.length > 0 && value.length <= PROJECT_NAME_MAX_LENGTH;
}

function isProjectId(value, pattern) {
  return isProjectString(value) && pattern.test(value) && Number.isSafeInteger(Number(value.slice(value.lastIndexOf("-") + 1)));
}

function projectIdNumber(value) {
  return Number(value.slice(value.lastIndexOf("-") + 1));
}

function generatedNameIndex(kind, name) {
  const prefix = TYPE_NAMES[kind];
  if (!prefix || !name.startsWith(prefix)) return null;
  const suffix = name.slice(prefix.length);
  for (let index = 1; index < 100; index += 1) {
    if (suffix === chineseIndex(index)) return index;
  }
  if (!/^[1-9]\d*$/.test(suffix)) return null;
  const index = Number(suffix);
  return Number.isSafeInteger(index) && index >= 100 ? index : null;
}

function requireFields(action, ...fields) {
  for (const field of fields) {
    if (!(field in action)) throw new Error(`${action.type} 缺少字段 ${field}`);
  }
}

function validateKnownFields(action) {
  for (const field of Object.keys(action)) {
    if (field === "_compositeId") {
      if (!Number.isInteger(action[field]) || action[field] <= 0) throw new Error("复合动作元数据无效");
      continue;
    }
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

function validateProjectString(value, allowEmpty = false, maximum = 1000) {
  if (typeof value !== "string" || (!allowEmpty && !value) || value.length > maximum) throw new Error("文本字段无效");
}

function validateSceneChanges(changes) {
  if (!isRecord(changes) || !Object.keys(changes).length) throw new Error("场景修改内容无效");
  const allowed = new Set(["theme", "mood", "composition", "summary", "ignored"]);
  for (const [field, value] of Object.entries(changes)) {
    if (!allowed.has(field)) throw new Error(`不能修改场景属性 ${field}`);
    if (field === "ignored") {
      if (!Array.isArray(value) || value.length > 20 || value.some(item => typeof item !== "string" || !item || item.length > 100)) {
        throw new Error("场景忽略项无效");
      }
    } else validateProjectString(value, true);
  }
}

function validateEntityChanges(changes) {
  if (!isRecord(changes) || !Object.keys(changes).length) throw new Error("实体修改内容无效");
  const allowed = new Set(["name", "role", "width", "height", "rotation", "opacity", "params", "zOrder"]);
  for (const [field, value] of Object.entries(changes)) {
    if (!allowed.has(field)) throw new Error(`不能修改实体属性 ${field}`);
    if (["name", "role"].includes(field)) validateProjectString(value, field === "role", 100);
    else if (["width", "height"].includes(field)) validateChangeValue(field, value);
    else if (field === "rotation" || field === "opacity" || field === "zOrder") validateChangeValue(field, value);
    else if (!isRecord(value)) throw new Error("实体参数修改无效");
    else {
      for (const [param, paramValue] of Object.entries(value)) {
        const templateId = Object.keys(ENTITY_TEMPLATES).find(id => ENTITY_TEMPLATES[id].includes(param));
        if (!templateId) throw new Error("实体参数修改无效");
        validateEntityParams(templateId, { [param]: paramValue });
      }
    }
  }
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
  if (action.type === "entity_create") {
    requireFields(action, "templateId", "name", "x", "y", "width", "height");
    if (!(action.templateId in ENTITY_TEMPLATES)) throw new Error("未知实体模板");
    validateProjectString(action.name, false, 100);
    if ("role" in action) validateProjectString(action.role, true, 100);
    if (!isFiniteNumber(action.x) || !isFiniteNumber(action.y)) throw new Error("实体坐标无效");
    validateDimension(action.width); validateDimension(action.height);
    if ("rotation" in action && !isFiniteNumber(action.rotation)) throw new Error("实体旋转无效");
    if ("opacity" in action && !isFiniteNumber(action.opacity, 0, 1)) throw new Error("实体透明度无效");
    if ("layer" in action && (!Number.isSafeInteger(action.layer) || Math.abs(action.layer) > 1000)) throw new Error("实体层次无效");
    validateEntityParams(action.templateId, action.params || {});
    return;
  }
  if (action.type === "entity_update") {
    requireFields(action, "target", "changes"); validateTarget(action.target); validateEntityChanges(action.changes); return;
  }
  if (action.type === "scene_update") {
    requireFields(action, "changes"); validateSceneChanges(action.changes); return;
  }
  if (action.type === "creative") {
    requireFields(action, "operation");
    const operations = new Set(["generate_drafts", "select_draft", "mix_drafts", "refine", "lock", "unlock", "set_style", "regenerate_texture"]);
    if (!operations.has(action.operation)) throw new Error("创作操作无效");
    if ("theme" in action) validateProjectString(action.theme, false, 500);
    if ("style" in action && !ART_STYLES.includes(action.style)) throw new Error("艺术风格无效");
    if ("draftId" in action) validateProjectString(action.draftId, false, 100);
    if ("draftIds" in action && (!Array.isArray(action.draftIds) || action.draftIds.length !== 2
      || action.draftIds.some(id => typeof id !== "string" || !id || id.length > 100))) throw new Error("混合小稿无效");
    if ("instruction" in action) validateProjectString(action.instruction, false, 500);
    if ("field" in action && !LOCKABLE_FIELDS.includes(action.field)) throw new Error("锁定字段无效");
    if ("target" in action) validateTarget(action.target);
    if (action.operation === "generate_drafts") requireFields(action, "theme", "style");
    if (action.operation === "select_draft") requireFields(action, "draftId");
    if (action.operation === "mix_drafts") requireFields(action, "draftIds");
    if (action.operation === "refine") requireFields(action, "instruction");
    if (["lock", "unlock"].includes(action.operation) && !("field" in action) && !("target" in action)) throw new Error("锁定目标无效");
    if (action.operation === "set_style") requireFields(action, "style");
    return;
  }
  if (action.type === "texture") {
    requireFields(action, "operation");
    if (!["pending", "apply", "remove", "missing", "failed"].includes(action.operation)) throw new Error("纹理操作无效");
    for (const field of ["prompt", "model", "cacheKey", "mimeType"]) {
      if (field in action) validateProjectString(action[field], true, 1000);
    }
    for (const field of ["width", "height"]) {
      if (field in action && (!Number.isSafeInteger(action[field]) || action[field] < 0 || action[field] > 2048)) throw new Error("纹理尺寸无效");
    }
    if (action.operation === "apply") {
      requireFields(action, "prompt", "model", "cacheKey", "mimeType", "width", "height");
      if (action.mimeType !== "image/png" || !action.cacheKey) throw new Error("纹理元数据无效");
    }
    return;
  }
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
      if ("color" in action) throw new Error("清空画布不能设置颜色");
    }
    if (action.operation === "background") {
      requireFields(action, "color"); validateColor(action.color, false);
    }
    return;
  }
  if (action.type === "export") {
    requireFields(action, "format");
    if (!["svg", "png", "project"].includes(action.format)) throw new Error("导出格式无效");
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
    const group = state.groups[target] || Object.values(state.groups).find(item => item.name === target);
    if (group) return state.objects.filter(o => group.members.includes(o.id));
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
  for (const [groupId, group] of Object.entries(state.groups)) {
    const members = state.objects.filter(o => group.members.includes(o.id));
    if (members.length < 2) {
      members.forEach(o => { if (o.groupId === groupId) delete o.groupId; });
      delete state.groups[groupId];
      continue;
    }
    group.members = members.map(o => o.id);
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

function createObject(state, action, context = {}) {
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
    stroke: action.stroke || "#26364a", strokeWidth: action.strokeWidth ?? 3,
    opacity: Number.isFinite(action.opacity) ? action.opacity : 1,
    rotation: Number(action.rotation) || 0, text: action.text || "文字"
  };
  state.objects.push(object);
  const continuesComposite = action._compositeId && context.lastCompositeId === action._compositeId;
  if (continuesComposite) {
    state.selection.push(object.id);
    state.lastCreated.push(object.id);
  } else {
    state.selection = [object.id];
    state.lastCreated = [object.id];
  }
  context.lastCompositeId = action._compositeId || null;
  return object;
}

function createEntity(state, action) {
  if (state.objects.some(object => object.name === action.name)) throw new Error("实体名称已存在");
  const entity = {
    id: `entity-${state.nextId++}`, name: action.name, kind: "entity", templateId: action.templateId,
    role: action.role || "", x: action.x, y: action.y, width: action.width, height: action.height,
    rotation: action.rotation || 0, opacity: action.opacity ?? 1, layer: action.layer || 0, params: copy(action.params || {})
  };
  state.objects.push(entity);
  state.selection = [entity.id];
  state.lastCreated = [entity.id];
  return entity;
}

function duplicateEntityName(state, name) {
  let index = 1;
  let candidate = `${name}副本`;
  while (state.objects.some(object => object.name === candidate)) candidate = `${name}副本${++index}`;
  return candidate;
}

function applyAction(state, action, context) {
  if (action.type === "create") return createObject(state, action, context);
  if (action.type === "entity_create") return createEntity(state, action);
  context.lastCompositeId = null;
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
        if (object.kind === "entity" && !["opacity", "rotation", "width", "height", "zOrder"].includes(key)) {
          throw new Error(`语义实体不能修改属性 ${key}`);
        }
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
  if (action.type === "entity_update") {
    const targets = requireTargets(state, action.target);
    if (targets.some(object => object.kind !== "entity")) throw new Error("实体修改只能用于语义实体");
    for (const object of targets) {
      for (const [key, value] of Object.entries(action.changes)) {
        if (key === "zOrder") continue;
        if (key === "params") {
          const merged = { ...object.params, ...value };
          validateEntityParams(object.templateId, merged);
          object.params = merged;
        } else if (["width", "height"].includes(key) && isRecord(value)) object[key] *= value.multiply;
        else object[key] = value;
      }
    }
    if (action.changes.zOrder) {
      const ids = new Set(targets.map(object => object.id));
      const others = state.objects.filter(object => !ids.has(object.id));
      state.objects = action.changes.zOrder === "top" ? [...others, ...targets] : [...targets, ...others];
    }
    return;
  }
  if (action.type === "scene_update") {
    state.scene = { ...state.scene, ...copy(action.changes), style: state.art.artDirection.style };
    return;
  }
  if (action.type === "creative") {
    const art = state.art;
    if (action.operation === "generate_drafts") {
      const generation = art.drafts.generation + 1;
      art.intent.narrative = action.theme;
      art.artDirection = { ...art.artDirection, ...styleDirection(action.style), style: action.style };
      art.drafts = { items: generateCompositionDrafts(action.theme, action.style, generation), selectedId: null, stage: "drafts", generation };
    } else if (action.operation === "select_draft") {
      const draft = art.drafts.items.find(item => item.id === action.draftId);
      if (!draft) throw new Error("找不到构图小稿");
      art.drafts.selectedId = draft.id; art.drafts.stage = "canvas";
      art.intent.focus = draft.focus;
      art.composition.flow = draft.flow; art.composition.negativeSpace = draft.negativeSpace;
      applyDraftToEntities(state.objects, draft, art.locks.entities);
    } else if (action.operation === "mix_drafts") {
      const drafts = action.draftIds.map(id => art.drafts.items.find(item => item.id === id));
      if (drafts.some(draft => !draft)) throw new Error("找不到混合小稿");
      const mixed = mixCompositionDrafts(drafts[0], drafts[1], art.drafts.generation);
      art.drafts.items = [...art.drafts.items.slice(0, 3), mixed];
      art.drafts.selectedId = mixed.id; art.drafts.stage = "canvas";
      art.intent.focus = mixed.focus; art.composition.flow = mixed.flow; art.composition.negativeSpace = mixed.negativeSpace;
      applyDraftToEntities(state.objects, mixed, art.locks.entities);
    } else if (action.operation === "refine") {
      refineArtwork(art, state.objects, action.instruction);
    } else if (["lock", "unlock"].includes(action.operation)) {
      const add = action.operation === "lock";
      if (action.field) art.locks.fields = add
        ? [...new Set([...art.locks.fields, action.field])] : art.locks.fields.filter(field => field !== action.field);
      if (action.target) {
        const ids = requireTargets(state, action.target).filter(object => object.kind === "entity").map(object => object.id);
        art.locks.entities = add ? [...new Set([...art.locks.entities, ...ids])] : art.locks.entities.filter(id => !ids.includes(id));
      }
    } else if (action.operation === "set_style") {
      art.artDirection = { ...art.artDirection, ...styleDirection(action.style), style: action.style };
      state.scene.style = action.style;
    } else if (action.operation === "regenerate_texture") {
      art.texture.status = "pending";
    }
    return;
  }
  if (action.type === "texture") {
    if (action.operation === "remove") state.art.texture = emptyArtState().texture;
    else state.art.texture = {
      ...state.art.texture,
      status: action.operation === "apply" ? "ready" : action.operation,
      ...copy(Object.fromEntries(Object.entries(action).filter(([key]) => !["type", "operation"].includes(key))))
    };
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
    state.selection = targets.map(o => o.id);
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
    state.selection = targets.map(o => o.id);
    return;
  }
  if (action.type === "duplicate") {
    const targets = requireTargets(state, action.target);
    const ids = [];
    for (const original of targets) {
      const duplicate = original.kind === "entity"
        ? createEntity(state, { ...original, name: duplicateEntityName(state, original.name), x: original.x + 25, y: original.y + 25 })
        : createObject(state, { ...original, kind: original.kind, x: original.x + 25, y: original.y + 25 }, context);
      if (original.kind !== "entity") duplicate.text = original.text;
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
    if (targets.some(object => object.kind === "entity")) throw new Error("语义实体不能组合");
    const targetIds = new Set(targets.map(o => o.id));
    for (const group of Object.values(state.groups)) {
      group.members = group.members.filter(id => !targetIds.has(id));
    }
    targets.forEach(o => { delete o.groupId; });
    reconcileGroups(state);
    const groupId = `group-${state.nextGroupId++}`;
    state.groups[groupId] = { id: groupId, name: `组合${chineseIndex(state.nextGroupId - 1)}`, members: targets.map(o => o.id) };
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
      state.objects = []; state.selection = []; state.lastCreated = []; state.groups = {}; state.scene = emptyScene(); state.art = emptyArtState();
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
      const context = { lastCompositeId: null };
      mutations.forEach(action => applyAction(working, action, context));
    } catch (error) {
      throw error;
    }
    this.undoStack.push(before);
    if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
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
    if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
    this.state = this.redoStack.pop();
    return { state: this.state, effects: [] };
  }

  serializeProject() {
    return {
      format: "listen-paint",
      version: 3,
      state: copy(this.state),
      history: { undo: copy(this.undoStack), redo: copy(this.redoStack) }
    };
  }

  loadProject(project) {
    const loaded = validateProject(project);
    this.state = loaded.state;
    this.undoStack = loaded.history.undo;
    this.redoStack = loaded.history.redo;
    return { state: this.state, effects: [] };
  }
}

function validateState(state) {
  if (!isRecord(state)) throw new Error("工程状态无效");
  const required = ["objects", "selection", "background", "counters", "lastCreated", "nextId", "groups", "nextGroupId", "scene", "art"];
  if (Object.keys(state).some(key => !required.includes(key)) || required.some(key => !(key in state))) throw new Error("工程状态字段无效");
  if (!Array.isArray(state.objects) || !Array.isArray(state.selection) || !Array.isArray(state.lastCreated)) throw new Error("工程对象结构无效");
  validateColor(state.background, false);
  validateScene(state.scene);
  validateArtState(state.art);
  if (!isRecord(state.counters) || !isRecord(state.groups) || !Number.isSafeInteger(state.nextId) || state.nextId < 1
    || !Number.isSafeInteger(state.nextGroupId) || state.nextGroupId < 1) throw new Error("工程计数器无效");
  for (const [kind, count] of Object.entries(state.counters)) {
    if (!KINDS.has(kind) || !Number.isSafeInteger(count) || count < 0) throw new Error("工程图形计数器无效");
  }
  const ids = new Set();
  const names = new Set();
  const maxNameIndexes = {};
  let maxShapeId = 0;
  for (const object of state.objects) {
    if (!isRecord(object)) throw new Error("工程图形无效");
    const entity = object.kind === "entity";
    const fields = entity
      ? new Set(["id", "name", "kind", "templateId", "role", "x", "y", "width", "height", "opacity", "rotation", "layer", "params"])
      : new Set(["id", "name", "kind", "x", "y", "width", "height", "fill", "stroke", "strokeWidth", "opacity", "rotation", "text", "groupId"]);
    if (Object.keys(object).some(key => !fields.has(key)) || !isProjectId(object.id, entity ? ENTITY_ID_PATTERN : SHAPE_ID_PATTERN)
      || !isProjectString(object.name) || ids.has(object.id) || names.has(object.name)
      || (!entity && object.groupId !== undefined && object.groupId !== null && !isProjectId(object.groupId, GROUP_ID_PATTERN))) {
      throw new Error("工程图形 ID 或字段无效");
    }
    if (entity) {
      validateAction({ type: "entity_create", templateId: object.templateId, name: object.name, role: object.role,
        x: object.x, y: object.y, width: object.width, height: object.height, opacity: object.opacity,
        rotation: object.rotation, layer: object.layer, params: object.params });
    } else {
      validateAction({ type: "create", kind: object.kind, x: object.x, y: object.y, width: object.width, height: object.height,
        fill: object.fill, stroke: object.stroke, strokeWidth: object.strokeWidth, opacity: object.opacity,
        rotation: object.rotation, text: object.text });
      const nameIndex = generatedNameIndex(object.kind, object.name);
      if (nameIndex === null) throw new Error("工程图形名称无效");
      maxNameIndexes[object.kind] = Math.max(maxNameIndexes[object.kind] || 0, nameIndex);
    }
    maxShapeId = Math.max(maxShapeId, projectIdNumber(object.id));
    ids.add(object.id);
    names.add(object.name);
  }
  if (state.nextId <= maxShapeId) throw new Error("工程图形 ID 计数器无效");
  for (const [kind, maxNameIndex] of Object.entries(maxNameIndexes)) {
    if ((state.counters[kind] || 0) < maxNameIndex) throw new Error("工程图形命名计数器无效");
  }
  for (const value of [...state.selection, ...state.lastCreated]) if (!ids.has(value)) throw new Error("工程对象引用无效");
  const groupNames = new Set();
  const groupedMembers = new Set();
  let maxGroupId = 0;
  for (const [groupId, group] of Object.entries(state.groups)) {
    const fields = new Set(["id", "name", "members"]);
    if (!isRecord(group) || Object.keys(group).some(key => !fields.has(key))
      || !isProjectId(groupId, GROUP_ID_PATTERN) || group.id !== groupId || !isProjectString(group.name)
      || groupNames.has(group.name) || !Array.isArray(group.members) || group.members.length < 2
      || new Set(group.members).size !== group.members.length
      || group.members.some(id => !isProjectId(id, SHAPE_ID_PATTERN) || !ids.has(id) || groupedMembers.has(id))) {
      throw new Error("工程组合引用无效");
    }
    maxGroupId = Math.max(maxGroupId, projectIdNumber(groupId));
    groupNames.add(group.name);
    group.members.forEach(id => groupedMembers.add(id));
  }
  if (state.nextGroupId <= maxGroupId) throw new Error("工程组合 ID 计数器无效");
  for (const object of state.objects) {
    if (object.groupId && (!state.groups[object.groupId] || !state.groups[object.groupId].members.includes(object.id))) {
      throw new Error("工程组合引用无效");
    }
    if (!object.groupId && groupedMembers.has(object.id)) throw new Error("工程组合引用无效");
  }
  return copy(state);
}

export function validateProject(project) {
  if (!isRecord(project) || project.format !== "listen-paint" || ![1, 2, 3].includes(project.version)
    || !isRecord(project.history) || !Array.isArray(project.history.undo) || !Array.isArray(project.history.redo)
    || project.history.undo.length > HISTORY_LIMIT || project.history.redo.length > HISTORY_LIMIT
    || Object.keys(project).some(key => !["format", "version", "state", "history"].includes(key))
    || Object.keys(project.history).some(key => !["undo", "redo"].includes(key))) throw new Error("工程格式或版本无效");
  const migrate = state => {
    const migrated = copy(state);
    if (project.version === 1) migrated.scene = emptyScene();
    if (project.version < 3) migrated.art = emptyArtState();
    return migrated;
  };
  return {
    state: validateState(migrate(project.state)),
    history: {
      undo: project.history.undo.map(state => validateState(migrate(state))),
      redo: project.history.redo.map(state => validateState(migrate(state)))
    }
  };
}

function validateScene(scene) {
  if (!isRecord(scene) || !ART_STYLES.includes(scene.style)) throw new Error("场景元数据无效");
  const fields = new Set(["style", "theme", "mood", "composition", "summary", "ignored"]);
  if (Object.keys(scene).some(key => !fields.has(key))) throw new Error("场景元数据字段无效");
  validateSceneChanges({ theme: scene.theme, mood: scene.mood, composition: scene.composition, summary: scene.summary, ignored: scene.ignored });
}
