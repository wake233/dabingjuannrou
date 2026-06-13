export const ENTITY_TEMPLATES = Object.freeze({
  person: ["color", "accent", "pose", "direction", "variant"],
  cat: ["color", "accent", "pose", "direction"],
  dog: ["color", "accent", "pose", "direction"],
  bird: ["color", "accent", "direction", "count"],
  umbrella: ["color", "accent", "direction"],
  streetlamp: ["color", "accent"],
  roof: ["color", "accent"],
  house: ["color", "accent"],
  bridge: ["color", "accent"],
  boat: ["color", "accent", "direction"],
  bench: ["color", "accent"],
  bicycle: ["color", "accent", "direction"],
  fence: ["color", "accent", "density"],
  buildings: ["color", "accent", "density"],
  rain: ["color", "density", "direction"],
  cloud: ["color", "density"],
  sun: ["color", "accent"],
  moon: ["color", "accent"],
  stars: ["color", "density", "count"],
  tree: ["color", "accent", "density"],
  mountain: ["color", "accent", "density"],
  flowers: ["color", "accent", "density", "count"],
  river: ["color", "accent", "direction"],
  grass: ["color", "accent", "density"],
  street: ["color", "accent", "direction"],
  puddle: ["color", "accent"]
});

export const TEMPLATE_NAMES = Object.freeze({
  person: "人物", cat: "猫", dog: "狗", bird: "鸟", umbrella: "伞", streetlamp: "路灯", roof: "屋顶",
  house: "房屋", bridge: "桥", boat: "船", bench: "长椅", bicycle: "自行车", fence: "栅栏",
  buildings: "建筑剪影", rain: "雨", cloud: "云", sun: "太阳", moon: "月亮",
  stars: "星空", tree: "树", mountain: "山", flowers: "花丛", river: "河流",
  grass: "草地", street: "街道", puddle: "水洼"
});

export const EMPTY_SCENE = Object.freeze({
  style: "storybook", theme: "", mood: "", composition: "", summary: "", ignored: []
});

export function validateEntityParams(templateId, params = {}) {
  const fields = ENTITY_TEMPLATES[templateId];
  if (!fields || params === null || typeof params !== "object" || Array.isArray(params)) {
    throw new Error("实体模板或参数无效");
  }
  for (const [field, value] of Object.entries(params)) {
    if (!fields.includes(field)) throw new Error(`模板不支持参数 ${field}`);
    if (["color", "accent"].includes(field)) {
      if (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value)) throw new Error("实体颜色参数无效");
    } else if (field === "pose") {
      if (!["standing", "walking", "sitting", "curled"].includes(value)) throw new Error("实体姿态参数无效");
    } else if (field === "direction") {
      if (!["left", "right", "vertical", "diagonal"].includes(value)) throw new Error("实体方向参数无效");
    } else if (field === "variant") {
      if (!["woman", "man", "child", "neutral"].includes(value)) throw new Error("人物类型参数无效");
    } else if (field === "count") {
      if (!Number.isInteger(value) || value < 1 || value > 100) throw new Error("实体数量参数无效");
    } else if (field === "density") {
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) throw new Error("实体密度参数无效");
    }
  }
  return true;
}

export function emptyScene() {
  return JSON.parse(JSON.stringify(EMPTY_SCENE));
}
