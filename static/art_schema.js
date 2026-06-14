export const ART_STYLES = Object.freeze(["storybook", "woodcut", "ink"]);
export const LOCKABLE_FIELDS = Object.freeze(["composition", "palette", "light", "focus", "atmosphere", "rhythm", "negativeSpace"]);

const STYLE_DIRECTIONS = Object.freeze({
  storybook: { palette: ["#355070", "#6d597a", "#b56576", "#e56b6f", "#eaac8b"], lineLanguage: "soft", shapeLanguage: "layered", texturePrompt: "soft paper grain" },
  woodcut: { palette: ["#171411", "#f2e8cf", "#9b2226"], lineLanguage: "carved", shapeLanguage: "bold", texturePrompt: "directional carved lines" },
  ink: { palette: ["#151515", "#66645f", "#d6d1c4"], lineLanguage: "calligraphic", shapeLanguage: "spare", texturePrompt: "controlled ink wash" }
});

const DRAFT_STRATEGIES = Object.freeze({
  storybook: [
    ["left-third", "diagonal-rise", "hero-large", "right-open"],
    ["center-low", "s-curve", "environment-large", "top-open"],
    ["right-third", "horizontal-calm", "hero-distant", "left-open"]
  ],
  woodcut: [
    ["left-edge", "hard-diagonal", "hero-large", "split-open"],
    ["center-high", "vertical-thrust", "environment-large", "bottom-open"],
    ["right-edge", "zigzag", "hero-distant", "center-open"]
  ],
  ink: [
    ["left-low", "floating-diagonal", "hero-small", "right-open"],
    ["center-low", "vertical-drift", "environment-large", "top-open"],
    ["right-low", "horizontal-pause", "hero-distant", "left-open"]
  ]
});

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

export function emptyArtState() {
  return {
    intent: { narrative: "", emotion: "", focus: "", rhythm: "", symbolism: "" },
    composition: { flow: "", negativeSpace: "", depth: "foreground-midground-background", lightSource: "", contrast: "" },
    artDirection: { style: "storybook", palette: [...STYLE_DIRECTIONS.storybook.palette], lineLanguage: "soft", shapeLanguage: "layered", texturePrompt: "soft paper grain" },
    locks: { fields: [], entities: [] },
    drafts: { items: [], selectedId: null, stage: "intent", generation: 0 },
    texture: { status: "none", prompt: "", model: "", cacheKey: "", mimeType: "", width: 0, height: 0 }
  };
}

export function styleDirection(style) {
  if (!ART_STYLES.includes(style)) throw new Error("艺术风格无效");
  return copy(STYLE_DIRECTIONS[style]);
}

export function generateCompositionDrafts(theme, style = "storybook", generation = 1) {
  if (typeof theme !== "string" || !theme.trim() || theme.length > 500) throw new Error("创作题材无效");
  if (!ART_STYLES.includes(style)) throw new Error("艺术风格无效");
  return DRAFT_STRATEGIES[style].map(([focus, flow, scale, negativeSpace], index) => ({
    id: `draft-${generation}-${index + 1}`,
    label: `构图小稿${index + 1}`,
    theme: theme.trim(),
    style,
    focus,
    flow,
    scale,
    negativeSpace,
    anchors: [
      { role: "focus", x: [260, 500, 740][index], y: [390, 430, 360][index], scale: [1.25, .9, .65][index] },
      { role: "support", x: [650, 250, 470][index], y: [350, 310, 470][index], scale: [.7, 1.15, .85][index] },
      { role: "atmosphere", x: [500, 700, 240][index], y: [150, 180, 170][index], scale: [1, .8, 1.2][index] }
    ]
  }));
}

export function mixCompositionDrafts(first, second, generation) {
  validateDraft(first);
  validateDraft(second);
  return {
    id: `draft-${generation}-mix`,
    label: "混合构图",
    theme: first.theme,
    style: first.style,
    focus: first.focus,
    flow: second.flow,
    scale: first.scale,
    negativeSpace: second.negativeSpace,
    anchors: first.anchors.map((anchor, index) => ({
      ...anchor,
      x: Math.round((anchor.x + second.anchors[index].x) / 2),
      y: Math.round((anchor.y + second.anchors[index].y) / 2),
      scale: Number(((anchor.scale + second.anchors[index].scale) / 2).toFixed(2))
    }))
  };
}

function validateString(value, maximum = 500) {
  return typeof value === "string" && value.length <= maximum;
}

export function validateDraft(draft) {
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) throw new Error("构图小稿无效");
  const fields = ["id", "label", "theme", "style", "focus", "flow", "scale", "negativeSpace", "anchors"];
  if (Object.keys(draft).some(key => !fields.includes(key)) || fields.some(key => !(key in draft))) throw new Error("构图小稿字段无效");
  if (!["id", "label", "theme", "focus", "flow", "scale", "negativeSpace"].every(key => validateString(draft[key]))) throw new Error("构图小稿文本无效");
  if (!ART_STYLES.includes(draft.style) || !Array.isArray(draft.anchors) || draft.anchors.length !== 3) throw new Error("构图小稿结构无效");
  for (const anchor of draft.anchors) {
    if (!anchor || Object.keys(anchor).some(key => !["role", "x", "y", "scale"].includes(key))
      || !validateString(anchor.role, 100) || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)
      || !Number.isFinite(anchor.scale) || anchor.scale <= 0 || anchor.scale > 3) throw new Error("构图锚点无效");
  }
  return true;
}

export function validateArtState(art) {
  if (!art || typeof art !== "object" || Array.isArray(art)) throw new Error("创作状态无效");
  const top = ["intent", "composition", "artDirection", "locks", "drafts", "texture"];
  if (Object.keys(art).some(key => !top.includes(key)) || top.some(key => !(key in art))) throw new Error("创作状态字段无效");
  const intentFields = ["narrative", "emotion", "focus", "rhythm", "symbolism"];
  const compositionFields = ["flow", "negativeSpace", "depth", "lightSource", "contrast"];
  const directionFields = ["style", "palette", "lineLanguage", "shapeLanguage", "texturePrompt"];
  for (const [record, fields] of [[art.intent, intentFields], [art.composition, compositionFields]]) {
    if (!record || Object.keys(record).some(key => !fields.includes(key)) || fields.some(key => !validateString(record[key]))) throw new Error("创作描述无效");
  }
  if (!art.artDirection || Object.keys(art.artDirection).some(key => !directionFields.includes(key))
    || !ART_STYLES.includes(art.artDirection.style) || !Array.isArray(art.artDirection.palette)
    || art.artDirection.palette.length < 1 || art.artDirection.palette.length > 8
    || art.artDirection.palette.some(color => !/^#[0-9a-f]{6}$/i.test(color))
    || !["lineLanguage", "shapeLanguage", "texturePrompt"].every(key => validateString(art.artDirection[key]))) throw new Error("艺术指导无效");
  if (!art.locks || Object.keys(art.locks).some(key => !["fields", "entities"].includes(key))
    || !Array.isArray(art.locks.fields) || !Array.isArray(art.locks.entities)
    || art.locks.fields.some(field => !LOCKABLE_FIELDS.includes(field))
    || art.locks.entities.some(id => typeof id !== "string" || !id)) throw new Error("创作锁定无效");
  if (!art.drafts || Object.keys(art.drafts).some(key => !["items", "selectedId", "stage", "generation"].includes(key))
    || !Array.isArray(art.drafts.items) || art.drafts.items.length > 4 || !["intent", "drafts", "canvas", "refining", "complete"].includes(art.drafts.stage)
    || !Number.isSafeInteger(art.drafts.generation) || art.drafts.generation < 0) throw new Error("创作阶段无效");
  art.drafts.items.forEach(validateDraft);
  if (art.drafts.selectedId !== null && !art.drafts.items.some(draft => draft.id === art.drafts.selectedId)) throw new Error("选中小稿无效");
  const textureFields = ["status", "prompt", "model", "cacheKey", "mimeType", "width", "height"];
  if (!art.texture || Object.keys(art.texture).some(key => !textureFields.includes(key))
    || !["none", "pending", "ready", "missing", "failed"].includes(art.texture.status)
    || !["prompt", "model", "cacheKey", "mimeType"].every(key => validateString(art.texture[key], 1000))
    || !Number.isSafeInteger(art.texture.width) || !Number.isSafeInteger(art.texture.height)
    || art.texture.width < 0 || art.texture.height < 0) throw new Error("纹理元数据无效");
  return true;
}

export function applyDraftToEntities(objects, draft, lockedEntityIds = []) {
  const entities = objects.filter(object => object.kind === "entity" && !lockedEntityIds.includes(object.id));
  entities.forEach((entity, index) => {
    const anchor = draft.anchors[index % draft.anchors.length];
    entity.x = Math.round(anchor.x - entity.width * anchor.scale / 2);
    entity.y = Math.round(anchor.y - entity.height * anchor.scale / 2);
    entity.width = Math.round(entity.width * anchor.scale);
    entity.height = Math.round(entity.height * anchor.scale);
  });
}

export function refineArtwork(art, objects, instruction) {
  if (typeof instruction !== "string" || !instruction.trim() || instruction.length > 500) throw new Error("审美意图无效");
  const text = instruction.trim();
  const fields = new Set(art.locks.fields);
  if (/孤独/.test(text) && !fields.has("atmosphere")) art.intent.emotion = "孤独、克制";
  if (/风感|风更强|加强风/.test(text) && !fields.has("rhythm")) art.intent.rhythm = "强烈的方向性风感";
  if (/右侧留白/.test(text) && !fields.has("negativeSpace")) art.composition.negativeSpace = "right-open";
  if (/左侧留白/.test(text) && !fields.has("negativeSpace")) art.composition.negativeSpace = "left-open";
  if (/焦点/.test(text) && !fields.has("focus")) art.intent.focus = text;
  if (/光|明暗/.test(text) && !fields.has("light")) art.composition.lightSource = text;
  if (/氛围/.test(text) && !fields.has("atmosphere")) art.intent.emotion = text;
  if (/节奏/.test(text) && !fields.has("rhythm")) art.intent.rhythm = text;
  if (/构图/.test(text) && !fields.has("composition")) art.composition.flow = text;
  if (!fields.has("composition")) {
    const movable = objects.filter(object => object.kind === "entity" && !art.locks.entities.includes(object.id));
    if (/右侧留白/.test(text)) movable.forEach(object => { object.x = Math.max(20, object.x - 60); });
    if (/左侧留白/.test(text)) movable.forEach(object => { object.x = Math.min(980 - object.width, object.x + 60); });
    if (/风感|风更强|加强风/.test(text)) movable.forEach((object, index) => { object.rotation += index % 2 ? 4 : -4; });
  }
  art.drafts.stage = "refining";
}
