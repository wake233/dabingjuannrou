import { DrawingEngine, validateActions } from "./model.js";
import { parseCommand } from "./parser.js";
import { renderArtworkEntity } from "./renderers.js";
import { loadTexture, removeTexture, saveTexture } from "./texture_cache.js";
import { executeArtPipeline } from "./art_engine_core.js";
import { getMaterialProfile, materialBackdropStyle } from "./material.js";
import { getLightingProfile, getEnvironmentColor } from "./lighting.js";

export const engine = new DrawingEngine();
const $ = id => document.getElementById(id);
const layer = $("drawing-layer");
const previewLayer = $("preview-layer");
let lastPreviewText = "";
let lastPreviewTime = -1000;
let listeningWanted = false;
let speaking = false;
let speechSequence = 0;
const AUTOSAVE_KEY = "listen-paint-autosave-v1";
let cloudConfigured = null;
let backendApiAvailable = null;
let fallbackPending = false;
let mediaStream = null;
let audioContext = null;
let analyser = null;
let mediaRecorder = null;
let audioChunks = [];
let audioMonitorTimer = null;
let segmentDisposition = "discard";
let segmentStartedAt = 0;
let speechStartedAt = null;
let lastSoundAt = null;
let transcribing = false;
let segmentSequence = 0;
let recoveryInProgress = false;
let recoveryAttempted = false;
let recoveryCount = 0;
let sessionStartedAt = null;
let releasingCloudResources = false;
let activeTextureDataUrl = "";
let progressiveRenderId = 0;
let progressiveRenderHandle = null;

const MIN_SPEECH_MS = 250;
const MAX_SEGMENT_MS = 10000;
const SOUND_THRESHOLD = .035;
const ACCEPTANCE_EVENT = "listen-paint-acceptance";

function emitAcceptance(type, detail = {}) {
  const payload = { type, timestamp: new Date().toISOString(), ...detail };
  try {
    globalThis.dispatchEvent?.(new CustomEvent(ACCEPTANCE_EVENT, { detail: payload }));
  } catch (_error) {
    // Acceptance telemetry must never affect drawing or voice behavior.
  }
  return payload;
}

function cloudErrorMessage(errorCode, fallback) {
  const messages = {
    configuration_missing: "云端语音识别配置不完整",
    authentication_failed: "云端密钥无效或已过期",
    permission_denied: "云端访问被拒绝，请检查账号权限",
    model_not_found: "云端接口或模型不存在",
    rate_limited: "云端请求过多或额度不足",
    network_failure: "云端网络连接失败",
    timeout: "云端连接超时",
    invalid_response: "云端返回了无效响应",
    empty_transcription: "云端未识别到文字",
    api_unreachable: "未连接到听画 API 服务，请使用 python main.py 启动",
    microphone_permission: "麦克风权限被拒绝，请在浏览器设置中允许访问",
    browser_unsupported: "当前浏览器不支持云端录音",
    microphone_track_ended: "麦克风连接已中断",
    audio_context_suspended: "浏览器音频上下文已挂起",
    recorder_error: "浏览器录音器异常停止",
    recorder_stopped: "浏览器录音器意外停止",
    capture_recovery_failed: "语音会话中断，自动恢复失败"
  };
  return messages[errorCode] || fallback || "云端语音识别失败";
}

export function polygonPoints(kind, o) {
  if (kind === "triangle") return `${o.x + o.width / 2},${o.y} ${o.x + o.width},${o.y + o.height} ${o.x},${o.y + o.height}`;
  const points = [];
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 ? Math.min(o.width, o.height) * .22 : Math.min(o.width, o.height) * .5;
    const angle = -Math.PI / 2 + i * Math.PI / 5;
    points.push(`${o.x + o.width / 2 + Math.cos(angle) * radius},${o.y + o.height / 2 + Math.sin(angle) * radius}`);
  }
  return points.join(" ");
}

export function svgElement(o, renderOptions = {}) {
  if (o.kind === "entity") {
    const entity = renderArtworkEntity(o, engine.state.art.artDirection.style, {
      quality: renderOptions.quality || "full",
      namespace: renderOptions.namespace || "canvas"
    });
    if (engine.state.selection.includes(o.id) && !renderOptions.noSelectionHighlight) {
      entity.setAttribute("filter", "url(#selection-glow)");
    }
    return entity;
  }
  const ns = "http://www.w3.org/2000/svg";
  let el;
  const common = { fill: o.fill, stroke: o.stroke, "stroke-width": o.strokeWidth, opacity: o.opacity };
  if (o.kind === "rect") { el = document.createElementNS(ns, "rect"); Object.assign(common, { x: o.x, y: o.y, width: o.width, height: o.height, rx: 8 }); }
  else if (o.kind === "circle" || o.kind === "ellipse") {
    el = document.createElementNS(ns, "ellipse");
    Object.assign(common, { cx: o.x + o.width / 2, cy: o.y + o.height / 2, rx: o.width / 2, ry: o.height / 2 });
  } else if (o.kind === "triangle" || o.kind === "star") {
    el = document.createElementNS(ns, "polygon"); common.points = polygonPoints(o.kind, o);
  } else if (o.kind === "line" || o.kind === "arrow") {
    el = document.createElementNS(ns, "line");
    Object.assign(common, { x1: o.x, y1: o.y, x2: o.x + o.width, y2: o.y + o.height, fill: "none" });
    if (o.kind === "arrow") common["marker-end"] = "url(#arrow-head)";
  } else {
    el = document.createElementNS(ns, "text");
    Object.assign(common, { x: o.x, y: o.y + 42, "font-size": Math.max(18, o.height * .65), "font-family": "Microsoft YaHei UI", stroke: "none" });
    el.textContent = o.text;
  }
  Object.entries(common).forEach(([key, value]) => el.setAttribute(key, value));
  el.setAttribute("data-id", o.id);
  el.setAttribute("transform", `rotate(${o.rotation} ${o.x + o.width / 2} ${o.y + o.height / 2})`);
  if (engine.state.selection.includes(o.id)) el.setAttribute("filter", "url(#selection-glow)");
  return el;
}

/**
 * Enrich entity objects with art engine metadata for rendering.
 * Adds _grammarCategory, _structureRules, _lightingColors, _shadowOffset,
 * _materialRoughness, _materialEdgeStyle, _blockType, _blockOpacity.
 * Does NOT modify entity positions — art director is called separately.
 */
function applyArtEngineToEntities(objects, renderOptions = {}) {
  const entities = objects.filter(o => o.kind === "entity");
  if (!entities.length) return;

  const art = engine.state.art;
  const renderProfile = art.renderProfile || {};
  const style = art.artDirection.style || "storybook";
  const lighting = getLightingProfile(renderProfile.lighting || "soft-day");
  const material = getMaterialProfile(renderProfile.material || "paper");

  // Import needed functions (available at module scope)
  const { getGrammarCategory } = globalThis._artGrammar || {};
  const { getLightingColors, computeShadowOffset } = globalThis._artLighting || {};
  // Use inline imports if not available at module scope
  const grammar = typeof getGrammarCategory === "function" ? getGrammarCategory
    : (id => ({ person: "figure", cat: "figure", dog: "figure", bird: "figure",
      house: "structure", roof: "structure", bridge: "structure", boat: "structure",
      bench: "structure", bicycle: "structure", fence: "structure", buildings: "structure",
      streetlamp: "structure", umbrella: "structure", street: "structure",
      tree: "nature", mountain: "nature", flowers: "nature", grass: "nature",
      river: "nature", puddle: "nature",
      rain: "atmosphere", cloud: "atmosphere", sun: "atmosphere", moon: "atmosphere", stars: "atmosphere"
    }[id] || "structure"));

  for (const entity of entities) {
    // Grammar classification
    const cat = grammar(entity.templateId);
    entity._grammarCategory = cat;
    entity._structureRules = {
      figure: { hasSkeleton: true, hasJoints: true },
      structure: { hasPerspective: true, hasJoints: true },
      nature: { hasGrowth: true },
      atmosphere: { hasDirection: true }
    }[cat] || {};

    // Lighting metadata
    const baseColor = entity.params?.color || "#617f96";
    entity._lightingColors = (typeof getLightingColors === "function")
      ? getLightingColors(baseColor, lighting)
      : { highlight: baseColor, shadow: "#303946", ambient: baseColor };
    entity._shadowOffset = (typeof computeShadowOffset === "function")
      ? computeShadowOffset(entity, lighting)
      : { dx: 2, dy: 4 };

    // Material metadata
    entity._materialRoughness = material.roughness;
    entity._materialEdgeStyle = material.edgeStyle;

    // Block type assignment based on style
    if (style === "woodcut") {
      entity._blockType = "high-contrast";
      entity._carveDirection = cat === "nature" ? "diagonal" : "horizontal";
    } else if (style === "ink") {
      entity._blockType = "ink-wash-gradient";
      entity._flyingWhite = cat === "nature";
    } else {
      entity._blockType = cat === "figure" ? "layered-gradient"
        : cat === "structure" ? "solid-gradient"
        : cat === "nature" ? "variegated-gradient"
        : "diffuse-gradient";
      entity._blockOpacity = cat === "atmosphere" ? 0.4 : 1.0;
    }
  }

  // Apply material backdrop to canvas if in browser context
  if (typeof document !== "undefined" && renderProfile.material && renderProfile.material !== "smooth") {
    if (material.filterType !== "none") {
      try {
        const canvasEl = document.getElementById("drawing-layer");
        if (canvasEl && typeof canvasEl.hasAttribute === "function" && !canvasEl.hasAttribute("data-material-applied")) {
          canvasEl.style?.setProperty?.("--material-backdrop", materialBackdropStyle(renderProfile.material));
          canvasEl.setAttribute?.("data-material-applied", renderProfile.material);
        }
      } catch (_) { /* DOM mock may not support these operations */ }
    }
  }
}

function renderObjects(layerElement, objects, selection = [], textureDataUrl = "", renderOptions = {}) {
  // Apply art engine pipeline to entities for lighting/material metadata
  applyArtEngineToEntities(objects, renderOptions);

  const selectionSet = new Set(selection);
  const rendered = objects.map(o => {
    const el = svgElement(o, renderOptions);
    if (selectionSet.has(o.id) && !renderOptions.noSelectionHighlight) {
      el.setAttribute("filter", "url(#selection-glow)");
    }
    return el;
  });
  if (textureDataUrl) {
    const texture = document.createElementNS("http://www.w3.org/2000/svg", "image");
    texture.setAttribute("data-art-texture", "true");
    texture.setAttribute("href", textureDataUrl);
    texture.setAttribute("x", "0"); texture.setAttribute("y", "0");
    texture.setAttribute("width", "1000"); texture.setAttribute("height", "700");
    texture.setAttribute("opacity", ".16"); texture.setAttribute("pointer-events", "none");
    rendered.push(texture);
  }
  layerElement.replaceChildren(...rendered);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

export function clearPreview() {
  if (previewLayer) previewLayer.replaceChildren();
  lastPreviewText = "";
  lastPreviewTime = -1000;
}

function tryPreviewRender(text) {
  if (!text || !previewLayer) return;
  const now = performance.now();
  // Throttle: skip if < 200ms since last preview
  if (now - lastPreviewTime < 200) return;
  // Throttle: skip if text change < 2 chars from last previewed text
  const lenDiff = Math.abs(text.length - lastPreviewText.length);
  if (text !== lastPreviewText && lenDiff < 2) return;

  try {
    const actions = parseCommand(text, {
      selected: engine.state.selection.length > 0,
      entityNames: engine.state.objects.filter(object => object.kind === "entity").map(object => object.name),
      sceneTheme: engine.state.scene.theme, intentNarrative: engine.state.art.intent.narrative,
      artStyle: engine.state.art.artDirection.style, draftGeneration: engine.state.art.drafts.generation
    });
    // Clone engine state and apply actions to the clone
    const cloneState = JSON.parse(JSON.stringify(engine.state));
    const clone = new DrawingEngine(cloneState);
    // Bypass execute's undo stack by directly mutating clone state
    // (DrawingEngine.execute pushes to undoStack, but we just want the result)
    clone.execute(actions);
    renderObjects(previewLayer, clone.state.objects, [], "",
      { quality: "base", namespace: "preview", noSelectionHighlight: true });
    lastPreviewText = text;
    lastPreviewTime = now;
  } catch {
    // Interim text can't be parsed yet — clear any stale preview
    clearPreview();
    lastPreviewText = text;
  }
}

let lastRenderDuration = 0;

function scheduleFrame(callback) {
  if (typeof requestAnimationFrame === "function") {
    return requestAnimationFrame(callback);
  }
  // Node/test environment fallback
  return setTimeout(callback, 0);
}

function cancelFrame(handle) {
  if (typeof cancelAnimationFrame === "function") {
    cancelAnimationFrame(handle);
  } else {
    clearTimeout(handle);
  }
}

function cancelProgressiveRender() {
  if (progressiveRenderHandle !== null) {
    cancelFrame(progressiveRenderHandle);
    progressiveRenderHandle = null;
  }
  progressiveRenderId += 1;
}

export function render() {
  const started = performance.now();
  clearPreview();
  cancelProgressiveRender();

  // Render at full quality immediately (progressive scheduling in browser)
  const hasRaf = typeof requestAnimationFrame === "function";
  const initialQuality = hasRaf ? "base" : "full";

  // Step 1: Render initial quality immediately
  const currentRenderId = progressiveRenderId;
  renderObjects(layer, engine.state.objects, engine.state.selection, activeTextureDataUrl,
    { quality: initialQuality, namespace: "canvas" });

  // Step 2: Schedule full quality render if progressive is available
  if (hasRaf) {
    const objects = [...engine.state.objects];
    const selection = [...engine.state.selection];
    const textureUrl = activeTextureDataUrl;
    progressiveRenderHandle = scheduleFrame(() => {
      if (progressiveRenderId !== currentRenderId) return; // Cancelled
      renderObjects(layer, objects, selection, textureUrl,
        { quality: "full", namespace: "canvas" });
      progressiveRenderHandle = null;
    });
  }

  $("canvas").style.background = engine.state.background;
  $("object-count").textContent = engine.state.objects.length;
  $("selection-count").textContent = engine.state.selection.length;
  // Use a Set for selection membership test (same O(1) optimization as renderObjects)
  const selectionSet = new Set(engine.state.selection);
  $("object-list").innerHTML = engine.state.objects.length
    ? engine.state.objects.map(o => `<li>${escapeHtml(o.name)}${o.kind === "entity" ? " · 实体" : ""}${selectionSet.has(o.id) ? " · 已选中" : ""}</li>`).join("")
    : "<li>画布还是空的</li>";
  if ($("scene-summary")) $("scene-summary").textContent = engine.state.scene.summary || "尚未生成绘本场景";
  if ($("scene-composition")) $("scene-composition").textContent = engine.state.scene.composition || "暂无构图说明";
  if ($("entity-list")) {
    const entities = engine.state.objects.filter(object => object.kind === "entity");
    $("entity-list").innerHTML = entities.length ? entities.map(entity => `<li>${escapeHtml(entity.name)}</li>`).join("") : "<li>暂无语义实体</li>";
  }
  if ($("ignored-list")) {
    $("ignored-list").innerHTML = engine.state.scene.ignored.length
      ? engine.state.scene.ignored.map(item => `<li>${escapeHtml(item)}</li>`).join("") : "<li>无忽略内容</li>";
  }
  if ($("art-style")) $("art-style").textContent = ({ storybook: "绘本", woodcut: "木刻", ink: "水墨" })[engine.state.art.artDirection.style];
  if ($("art-stage")) $("art-stage").textContent = ({ intent: "表达意图", drafts: "选择小稿", canvas: "正式画布", refining: "审美精修", complete: "完成" })[engine.state.art.drafts.stage];
  if ($("art-focus")) $("art-focus").textContent = engine.state.art.intent.focus ? `焦点：${engine.state.art.intent.focus}` : "尚未设置视觉焦点";
  if ($("art-locks")) {
    const locks = [...engine.state.art.locks.fields, ...engine.state.art.locks.entities];
    $("art-locks").textContent = locks.length ? `已锁定：${locks.join("、")}` : "暂无锁定";
  }
  if ($("texture-status")) $("texture-status").textContent = `纹理：${engine.state.art.texture.status}`;
  if ($("draft-list")) $("draft-list").innerHTML = engine.state.art.drafts.items.length
    ? engine.state.art.drafts.items.map(draft => `<li>${escapeHtml(draft.label)} · ${escapeHtml(draft.focus)} · ${escapeHtml(draft.negativeSpace)}</li>`).join("")
    : "<li>说“生成三张绘本构图小稿，雨中归人”</li>";
  updateCanvasControls();
  lastRenderDuration = performance.now() - started;
}

export function getLastRenderDuration() { return lastRenderDuration; }

function say(message) {
  $("feedback").textContent = message;
  const sequence = ++speechSequence;
  speaking = true;
  pauseVoiceInput();
  const finish = () => {
    if (sequence !== speechSequence) return;
    speaking = false;
    if (listeningWanted && !fallbackPending) resumeVoiceInput();
  };
  try {
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = "zh-CN";
    utterance.onend = finish;
    utterance.onerror = finish;
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  } catch (_error) {
    finish();
  }
}

function toast(message) {
  $("toast").textContent = message; $("toast").classList.add("show");
  setTimeout(() => $("toast").classList.remove("show"), 1800);
}

function describeState() {
  const names = engine.state.objects.map(o => o.name).join("、");
  return engine.state.objects.length ? `画布有${engine.state.objects.length}个图形：${names}` : "画布目前是空的";
}

export function download(format) {
  if (format === "project") {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    return saveBlob(new Blob([JSON.stringify(engine.serializeProject(), null, 2)], { type: "application/json" }), `听画-${stamp}.listen-paint.json`);
  }
  const source = exportSvgSource();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  if (format === "svg") {
    let svgContent = source;
    if (engine.state.background && engine.state.background !== "#ffffff") {
      const bgRect = `<rect width="1000" height="700" fill="${engine.state.background}" />`;
      svgContent = svgContent.replace(/(<svg[^>]*>)/, `$1\n  ${bgRect}`);
    }
    return saveBlob(new Blob([svgContent], { type: "image/svg+xml" }), `听画-${stamp}.svg`);
  }
  const image = new Image();
  const url = URL.createObjectURL(new Blob([source], { type: "image/svg+xml" }));
  image.onload = () => {
    const canvas = document.createElement("canvas"); canvas.width = 1000; canvas.height = 700;
    const ctx = canvas.getContext("2d"); ctx.fillStyle = engine.state.background; ctx.fillRect(0, 0, 1000, 700); ctx.drawImage(image, 0, 0);
    canvas.toBlob(blob => saveBlob(blob, `听画-${stamp}.png`)); URL.revokeObjectURL(url);
  };
  image.src = url;
}

function exportSvgSource() {
  // Force full-quality render before export (cancel any pending progressive)
  cancelProgressiveRender();
  renderObjects(layer, engine.state.objects, engine.state.selection, activeTextureDataUrl,
    { quality: "full", namespace: "export", noSelectionHighlight: true });

  const canvas = $("canvas");
  const clean = canvas.cloneNode?.(true) || canvas;
  clean.querySelector?.("#preview-layer")?.replaceChildren();
  clean.querySelectorAll?.('[filter="url(#selection-glow)"]').forEach(element => element.removeAttribute("filter"));
  clean.querySelectorAll?.(".preview").forEach(element => element.remove());

  // If there's a pending progressive render for main canvas, re-trigger it
  if (progressiveRenderHandle === null && typeof requestAnimationFrame === "function") {
    progressiveRenderHandle = scheduleFrame(() => {
      renderObjects(layer, engine.state.objects, engine.state.selection, activeTextureDataUrl,
        { quality: "full", namespace: "canvas" });
      progressiveRenderHandle = null;
    });
  }

  return new XMLSerializer().serializeToString(clean);
}

function saveBlob(blob, name) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function llmFallback(text) {
  say("正在构思");
  const entities = engine.state.objects.filter(object => object.kind === "entity");
  const response = await fetch("/api/interpret", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, context: {
      objects: engine.state.objects.map(({ id, name, kind }) => ({ id, name, kind })),
      entities: entities.map(({ id, name, templateId, params, x, y, width, height }) => ({ id, name, templateId, params, bounds: { x, y, width, height } })),
      selection: engine.state.selection, scene: engine.state.scene, art: engine.state.art
    } })
  });
  const body = await response.json();
  if (!response.ok) {
    const error = new Error(body.error || "模型解析失败");
    error.errorCode = body.errorCode || "command_parse_failed";
    error.retryable = body.retryable === true;
    throw error;
  }
  return body;
}

function applyTextureState(action) {
  engine.execute([action]);
  render();
  saveAutosave();
}

export async function generateArtworkTexture() {
  const art = engine.state.art;
  const prompt = art.artDirection.texturePrompt || `${art.artDirection.style} texture`;
  const textureType = art.artDirection.style === "woodcut" ? "carved" : art.artDirection.style === "ink" ? "ink-wash" : "paper";
  applyTextureState({ type: "texture", operation: "pending", prompt });
  try {
    const response = await fetch("/api/generate-texture", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, style: art.artDirection.style, textureType, width: 1000, height: 700 })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "纹理生成失败");
    if (!result || result.mimeType !== "image/png" || typeof result.imageBase64 !== "string"
      || typeof result.cacheKey !== "string" || !result.cacheKey) throw new Error("纹理响应无效");
    const dataUrl = `data:image/png;base64,${result.imageBase64}`;
    await saveTexture(result.cacheKey, { dataUrl, mimeType: result.mimeType, width: result.width, height: result.height });
    activeTextureDataUrl = dataUrl;
    applyTextureState({ type: "texture", operation: "apply", prompt: result.prompt, model: result.model,
      cacheKey: result.cacheKey, mimeType: result.mimeType, width: result.width, height: result.height });
    return true;
  } catch (_error) {
    activeTextureDataUrl = "";
    applyTextureState({ type: "texture", operation: "failed", prompt });
    return false;
  }
}

export async function restoreArtworkTexture() {
  const metadata = engine.state.art.texture;
  if (metadata.status !== "ready" || !metadata.cacheKey) {
    activeTextureDataUrl = "";
    render();
    return false;
  }
  const cached = await loadTexture(metadata.cacheKey);
  if (!cached) {
    activeTextureDataUrl = "";
    applyTextureState({ type: "texture", operation: "missing", prompt: metadata.prompt, model: metadata.model,
      cacheKey: metadata.cacheKey, mimeType: metadata.mimeType, width: metadata.width, height: metadata.height });
    return false;
  }
  activeTextureDataUrl = cached.dataUrl;
  render();
  return true;
}

export async function removeArtworkTexture() {
  const cacheKey = engine.state.art.texture.cacheKey;
  if (cacheKey) await removeTexture(cacheKey);
  activeTextureDataUrl = "";
  applyTextureState({ type: "texture", operation: "remove" });
}

function actionsFromInterpretation(result) {
  if (!result || typeof result !== "object") throw new Error("模型解释结果无效");
  if (result.kind === "actions" || result.kind === "scene_revision") {
    if (Object.keys(result).some(key => !["kind", "actions"].includes(key))) throw new Error("模型解释结果字段无效");
    validateActions(result.actions);
    return { actions: result.actions, message: result.kind === "scene_revision" ? "场景已更新" : "" };
  }
  if (result.kind !== "scene_plan" || Object.keys(result).some(key => !["kind", "scene", "entities"].includes(key))
    || !Array.isArray(result.entities) || result.entities.length > 20 || !result.scene) throw new Error("场景规划结果无效");
  if (!result.entities.length) return { actions: [], message: `暂时无法表达：${result.scene.ignored?.join("、") || "没有受支持实体"}` };
  const actions = [
    { type: "scene_update", changes: result.scene },
    ...[...result.entities].sort((a, b) => (a.layer || 0) - (b.layer || 0))
      .map(entity => ({ type: "entity_create", ...entity }))
  ];
  validateActions(actions);
  return {
    actions,
    message: result.scene.ignored?.length
      ? `场景已生成，已忽略：${result.scene.ignored.join("、")}`
      : "场景已生成"
  };
}

export async function handleCommand(rawText, confidence = 1, metrics = {}) {
  const started = performance.now();
  $("transcript").textContent = rawText;
  console.log("[handleCommand] text=%s confidence=%s", rawText, confidence);
  const modeCommand = rawText.trim();
  if (/^(当前识别模式|现在是什么模式)$/.test(modeCommand)) return say("当前是云端识别");
  if (/浏览器识别|切换到云端识别|使用云端识别/.test(modeCommand)) return say("当前仅提供云端识别");
  if (/离线识别|离线模式|下载离线模型/.test(modeCommand)) {
    return say("第二版不提供离线识别，请使用云端识别");
  }
  if (/^丢弃上次工程$/.test(modeCommand)) {
    discardAutosave();
    return say("已丢弃上次工程");
  }
  if (listeningWanted && /^(休息|停止聆听)$/.test(rawText.trim())) {
    stopListening();
    say("已停止聆听");
    return;
  }
  let actions;
  try { actions = parseCommand(rawText, {
    selected: engine.state.selection.length > 0,
    entityNames: engine.state.objects.filter(object => object.kind === "entity").map(object => object.name),
    sceneTheme: engine.state.scene.theme, intentNarrative: engine.state.art.intent.narrative,
    artStyle: engine.state.art.artDirection.style, draftGeneration: engine.state.art.drafts.generation
  }); }
  catch (parseError) {
    console.log("[handleCommand] 本地解析失败:", parseError.message);
    // A clear locally parsed command is safe to execute regardless of an
    // optional confidence score, but low-confidence unknown text must not
    // trigger model fallback.
    if (Number.isFinite(confidence) && confidence > 0 && confidence < .45) {
      console.log("[handleCommand] 低置信度(%.2f)，拒绝回退模型", confidence);
      emitAcceptance("error", { segmentId: metrics.segmentId, errorCode: "low_confidence", retryable: true, message: "没有听清" });
      return say("没有听清，请再说一次");
    }
    try {
      const interpreted = actionsFromInterpretation(await llmFallback(rawText));
      if (!interpreted.actions.length) return say(interpreted.message);
      actions = interpreted.actions;
      metrics.confirmationMessage = interpreted.message;
    }
    catch (error) {
      console.log("[handleCommand] 模型回退也失败:", error.message);
      emitAcceptance("error", { segmentId: metrics.segmentId, errorCode: error.errorCode || "command_parse_failed", retryable: error.retryable === true, message: error.message });
      return say(`${error.message}。请改用标准指令`);
    }
  }
  console.log("[handleCommand] 解析成功，%d 个动作:", actions.length, actions.map(a => a.type + (a.kind ? ":" + a.kind : "")));
  return executeActions(actions, started, metrics.confirmationMessage || "", { ...metrics, transcript: rawText });
}

function executeActions(actions, started, confirmationMessage = "", metrics = {}, options = {}) {
  const announce = options.announce !== false;
  const reportAcceptance = options.reportAcceptance !== false;
  try {
    console.log("[executeActions] 执行 %d 个动作", actions.length);
    const result = engine.execute(actions); render();
    if (actions.some(action => !["export", "help", "status"].includes(action.type))) saveAutosave();
    if (actions.some(action => action.type === "creative" && ["select_draft", "mix_drafts", "regenerate_texture"].includes(action.operation))) {
      generateArtworkTexture();
    }
    if (actions.some(action => action.type === "texture" && action.operation === "remove")) activeTextureDataUrl = "";
    console.log("[executeActions] 执行成功, 画布图形数:", engine.state.objects.length, "效果:", result.effects.length);
    for (const effect of result.effects) {
      if (effect.type === "export") download(effect.format);
      if (effect.type === "help" && announce) say("你可以创建图形，选择和移动，修改颜色，对齐，撤销，清空或保存画布");
      if (effect.type === "status" && announce) say(describeState());
    }
    const latency = Math.round(performance.now() - started);
    $("latency").textContent = `本次响应 ${latency}ms`;
    if (reportAcceptance) {
      emitAcceptance("command-completed", {
        segmentId: metrics.segmentId,
        transcript: metrics.transcript,
        success: true,
        actionCount: actions.length,
        localDurationMs: latency,
        endToEndDurationMs: metrics.segmentSubmittedAt == null ? null : Math.round(performance.now() - metrics.segmentSubmittedAt)
      });
    }
    if (!result.effects.length && announce) say(confirmationMessage || `已执行，共${actions.length}个动作`);
    if (!announce && options.visualMessage) {
      $("feedback").textContent = options.visualMessage;
      toast(options.visualMessage);
    }
    return true;
  } catch (error) {
    console.log("[executeActions] 执行失败:", error.message);
    if (reportAcceptance) {
      emitAcceptance("command-completed", {
        segmentId: metrics.segmentId,
        transcript: metrics.transcript,
        success: false,
        actionCount: actions.length,
        localDurationMs: Math.round(performance.now() - started),
        endToEndDurationMs: metrics.segmentSubmittedAt == null ? null : Math.round(performance.now() - metrics.segmentSubmittedAt),
        errorCode: "command_execution_failed",
        message: error.message
      });
    }
    if (announce) say(error.message);
    else {
      $("feedback").textContent = error.message;
      toast(error.message);
    }
    return false;
  }
}

function updateCanvasControls() {
  if ($("undo-button")) $("undo-button").disabled = engine.undoStack.length === 0;
  if ($("redo-button")) $("redo-button").disabled = engine.redoStack.length === 0;
  if ($("clear-button")) $("clear-button").disabled = engine.state.objects.length === 0;
}

function closeExportMenu() {
  if (!$("export-options") || !$("export-button")) return;
  $("export-options").hidden = true;
  $("export-button").setAttribute("aria-expanded", "false");
}

export function executeToolbarAction(actions, visualMessage) {
  return executeActions(actions, performance.now(), "", {}, {
    announce: false,
    reportAcceptance: false,
    visualMessage
  });
}

function setupCanvasControls() {
  if (!$("undo-button")) return;
  $("undo-button").onclick = () => executeToolbarAction([{ type: "history", operation: "undo" }], "已撤销");
  $("redo-button").onclick = () => executeToolbarAction([{ type: "history", operation: "redo" }], "已重做");
  $("clear-button").onclick = () => executeToolbarAction([{ type: "canvas", operation: "clear" }], "画布已清空，可撤销");
  $("export-button").onclick = event => {
    event?.stopPropagation?.();
    const open = $("export-options").hidden;
    $("export-options").hidden = !open;
    $("export-button").setAttribute("aria-expanded", String(open));
  };
  $("export-options").querySelectorAll?.("[data-export-format]").forEach(button => {
    button.onclick = () => {
      const format = button.dataset.exportFormat || button.getAttribute("data-export-format");
      executeToolbarAction([{ type: "export", format }], `已导出 ${format === "project" ? "工程文件" : format.toUpperCase()}`);
      closeExportMenu();
    };
  });
  document.addEventListener?.("click", event => {
    if (!event.target?.closest?.(".export-menu")) closeExportMenu();
  });
  document.addEventListener?.("keydown", event => {
    if (event.key === "Escape") closeExportMenu();
  });
  updateCanvasControls();
}

export function voiceActivityDecision(state, level, now) {
  if (level >= SOUND_THRESHOLD) {
    state.speechStartedAt ??= now;
    state.lastSoundAt = now;
    return "sound";
  }
  if (state.speechStartedAt != null) {
    const speechDuration = state.lastSoundAt - state.speechStartedAt;
    const adaptiveSilence = speechDuration < 2000 ? 400 : 600;
    if (now - state.lastSoundAt >= adaptiveSilence) {
      return speechDuration >= MIN_SPEECH_MS ? "submit" : "discard";
    }
  }
  if (now - state.segmentStartedAt >= MAX_SEGMENT_MS) {
    return state.speechStartedAt != null && state.lastSoundAt - state.speechStartedAt >= MIN_SPEECH_MS
      ? "submit" : "discard";
  }
  return "continue";
}

function pauseVoiceInput() {
  stopCloudCapture();
}

function resumeVoiceInput() {
  startCloudListening();
}

function updateListeningUi(status) {
  const listenButton = $("listen-button");
  listenButton.classList.toggle("active", listeningWanted);
  listenButton.setAttribute("aria-pressed", String(listeningWanted));
  listenButton.setAttribute("aria-label", listeningWanted ? "停止语音控制" : "开始语音控制");
  $("listen-label").textContent = listeningWanted ? "停止聆听" : "开始聆听";
  $("voice-status").textContent = status || (listeningWanted ? "正在启动" : "已暂停");
}

export async function loadVoiceCapabilities() {
  try {
    const response = await fetch("/api/status", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const status = await response.json();
    if (status.apiVersion !== 1) throw new Error("API version mismatch");
    backendApiAvailable = true;
    cloudConfigured = status.cloudTranscriptionConfigured === true;
    const cloudIssue = status.cloudTranscriptionIssue === "missing_api_key"
      ? "云端未配置 OPENAI_API_KEY"
      : status.cloudTranscriptionIssue === "unsupported_realtime_model"
        ? "云端实时模型与当前录音接口不兼容"
        : "云端语音识别配置不完整";
    if (!cloudConfigured && !listeningWanted) updateListeningUi(cloudIssue);
  } catch (_error) {
    backendApiAvailable = false;
    cloudConfigured = false;
    if (!listeningWanted) updateListeningUi("未连接到听画 API 服务，请使用 python main.py 启动");
  }
}

async function ensureCloudResources() {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder || !(window.AudioContext || window.webkitAudioContext)) {
    const error = new Error(cloudErrorMessage("browser_unsupported"));
    error.errorCode = "browser_unsupported";
    throw error;
  }
  if (mediaStream && audioContext && analyser) {
    if (audioContext.state === "suspended") await audioContext.resume?.();
    return;
  }
  releaseCloudResources();
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    });
  } catch (cause) {
    const errorCode = ["NotAllowedError", "SecurityError"].includes(cause?.name) ? "microphone_permission" : "microphone_unavailable";
    const error = new Error(cloudErrorMessage(errorCode, cause?.message || "麦克风不可用"));
    error.errorCode = errorCode;
    throw error;
  }
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  const context = new AudioContext();
  try {
    const nextAnalyser = context.createAnalyser();
    nextAnalyser.fftSize = 2048;
    context.createMediaStreamSource(stream).connect(nextAnalyser);
    if (context.state === "suspended") await context.resume?.();
    stream.getTracks?.().forEach(track => {
      track.addEventListener?.("ended", () => handleVoiceInterruption("microphone_track_ended"));
    });
    context.addEventListener?.("statechange", () => {
      if (context.state === "suspended" && document.visibilityState !== "hidden") {
        handleVoiceInterruption("audio_context_suspended");
      }
    });
    mediaStream = stream;
    audioContext = context;
    analyser = nextAnalyser;
  } catch (error) {
    stream.getTracks?.().forEach(track => track.stop());
    context.close?.();
    throw error;
  }
}

function beginCloudSegment() {
  if (!listeningWanted || speaking || fallbackPending || transcribing || mediaRecorder?.state === "recording") return;
  audioChunks = [];
  segmentDisposition = "discard";
  segmentStartedAt = performance.now();
  speechStartedAt = null;
  lastSoundAt = null;
  const recorder = new MediaRecorder(mediaStream);
  recorder._listenPaintExpectedStop = false;
  mediaRecorder = recorder;
  recorder.ondataavailable = event => { if (event.data?.size) audioChunks.push(event.data); };
  recorder.onerror = () => handleVoiceInterruption("recorder_error");
  recorder.onstop = async () => {
    const expectedStop = recorder._listenPaintExpectedStop;
    const disposition = segmentDisposition;
    const type = recorder.mimeType || audioChunks[0]?.type || "audio/webm";
    const blob = new Blob(audioChunks, { type });
    if (mediaRecorder === recorder) mediaRecorder = null;
    audioChunks = [];
    if (!expectedStop) {
      await handleVoiceInterruption("recorder_stopped");
      return;
    }
    if (disposition === "submit" && blob.size) {
      const segmentId = ++segmentSequence;
      const segmentSubmittedAt = performance.now();
      emitAcceptance("segment-submitted", { segmentId });
      await transcribeAudio(blob, { segmentId, segmentSubmittedAt });
    }
    if (listeningWanted && !speaking && !fallbackPending && !transcribing && !recoveryInProgress) startCloudListening();
  };
  recorder.start(250);
}

function monitorCloudAudio() {
  if (!analyser || !mediaRecorder || mediaRecorder.state !== "recording") return;
  const samples = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(samples);
  const level = Math.sqrt(samples.reduce((sum, value) => sum + ((value - 128) / 128) ** 2, 0) / samples.length);
  const state = { segmentStartedAt, speechStartedAt, lastSoundAt };
  const decision = voiceActivityDecision(state, level, performance.now());
  speechStartedAt = state.speechStartedAt;
  lastSoundAt = state.lastSoundAt;
  if (decision === "submit" || decision === "discard") finishCloudSegment(decision);
}

function finishCloudSegment(disposition = "discard") {
  if (!mediaRecorder || mediaRecorder.state !== "recording") return;
  segmentDisposition = disposition;
  mediaRecorder._listenPaintExpectedStop = true;
  mediaRecorder.stop();
}

function stopCloudCapture() {
  clearInterval(audioMonitorTimer);
  audioMonitorTimer = null;
  finishCloudSegment("discard");
  $("wave").classList.remove("active");
}

function releaseCloudResources() {
  releasingCloudResources = true;
  try {
    stopCloudCapture();
    mediaStream?.getTracks?.().forEach(track => track.stop());
    audioContext?.close?.();
    mediaStream = null;
    audioContext = null;
    analyser = null;
  } finally {
    releasingCloudResources = false;
  }
}

async function startCloudListening() {
  if (!listeningWanted || speaking || fallbackPending || transcribing) return;
  if (backendApiAvailable === false) {
    showFallbackPrompt(cloudErrorMessage("api_unreachable"), "api_unreachable", true);
    return;
  }
  if (cloudConfigured === false) {
    showFallbackPrompt(cloudErrorMessage("configuration_missing"), "configuration_missing", false);
    return;
  }
  try {
    await ensureCloudResources();
    if (!listeningWanted || speaking || fallbackPending || transcribing) {
      releaseCloudResources();
      return;
    }
    updateListeningUi("云端识别");
    $("wave").classList.add("active");
    beginCloudSegment();
    if (!audioMonitorTimer) audioMonitorTimer = setInterval(monitorCloudAudio, 100);
    return true;
  } catch (error) {
    showFallbackPrompt(error.message || "云端语音识别启动失败", error.errorCode || "capture_start_failed");
    return false;
  }
}

function sessionDurationMs() {
  return sessionStartedAt == null ? null : Math.max(0, Math.round(performance.now() - sessionStartedAt));
}

function beginVoiceSession() {
  if (sessionStartedAt != null) return;
  sessionStartedAt = performance.now();
  recoveryAttempted = false;
  recoveryCount = 0;
  emitAcceptance("session-started", { sessionStartedAt: new Date().toISOString() });
}

function endVoiceSession(reason) {
  if (sessionStartedAt == null) return;
  emitAcceptance("session-ended", { reason, sessionDurationMs: sessionDurationMs(), recoveryCount });
  sessionStartedAt = null;
}

async function handleVoiceInterruption(reason) {
  if (releasingCloudResources || !listeningWanted || speaking || fallbackPending || transcribing || recoveryInProgress) return false;
  emitAcceptance("session-interrupted", { reason, sessionDurationMs: sessionDurationMs(), recoveryCount });
  if (recoveryAttempted) {
    showFallbackPrompt(cloudErrorMessage("capture_recovery_failed"), "capture_recovery_failed", true);
    return false;
  }
  recoveryAttempted = true;
  recoveryInProgress = true;
  recoveryCount++;
  emitAcceptance("recovery-attempted", { reason, recoveryCount });
  updateListeningUi("语音连接中断，正在自动恢复");
  releaseCloudResources();
  const recovered = await startCloudListening();
  emitAcceptance("recovery-completed", { reason, recoveryCount, success: recovered === true });
  recoveryInProgress = false;
  return recovered === true;
}

function checkVoiceHealth() {
  if (!listeningWanted || speaking || fallbackPending || transcribing || recoveryInProgress) return;
  const tracks = mediaStream?.getTracks?.() || [];
  if (tracks.some(track => track.readyState === "ended")) {
    handleVoiceInterruption("microphone_track_ended");
  } else if (audioContext?.state === "suspended") {
    handleVoiceInterruption("audio_context_suspended");
  } else if (!mediaRecorder || mediaRecorder.state !== "recording") {
    handleVoiceInterruption("recorder_stopped");
  }
}

export async function transcribeAudio(blob, metrics = {}) {
  transcribing = true;
  stopCloudCapture();
  updateListeningUi("正在转写");
  console.log("[transcribeAudio] 发送音频 blob.size=%d type=%s", blob.size, blob.type);
  try {
    const response = await fetch("/api/transcribe", {
      method: "POST",
      headers: { "Content-Type": blob.type || "audio/webm" },
      body: blob
    });
    console.log("[transcribeAudio] 响应 status=%d ok=%s", response.status, response.ok);
    // Detect whether we're talking to the Listen Paint API server or a generic
    // HTTP server (which would return an HTML 404 page). Our server sends
    // X-Listen-Paint-API: 1 on all API responses (via send_json).
    // Fall back to status + Content-Type for environments where custom headers
    // are stripped (test mocks, proxies).
    const isListenPaintApi = response.headers?.get?.("X-Listen-Paint-API") === "1";
    if (!isListenPaintApi && !response.ok) {
      const contentType = response.headers?.get?.("Content-Type") || "";
      // 404 status from a non-API server (HTML page) — definitely wrong server.
      const isNonApiResponse = response.status === 404 && !contentType.includes("application/json");
      console.log("[transcribeAudio] API检测: isListenPaintApi=%s contentType=%s isNonApi=%s",
        isListenPaintApi, contentType, isNonApiResponse);
      if (isNonApiResponse) {
        backendApiAvailable = false;
        const error = new Error(cloudErrorMessage("api_unreachable"));
        error.errorCode = "api_unreachable";
        throw error;
      }
    }
    const body = await response.json();
    if (!response.ok) {
      console.log("[transcribeAudio] API 返回错误:", body.error);
      const error = new Error(cloudErrorMessage(body.errorCode, body.error));
      error.errorCode = body.errorCode || "service_error";
      error.retryable = body.retryable === true;
      throw error;
    }
    if (!body.text?.trim()) {
      console.log("[transcribeAudio] API 返回空文本");
      throw new Error("云端语音识别未返回文字");
    }
    console.log("[transcribeAudio] 识别文本:", body.text);
    emitAcceptance("transcription-completed", {
      segmentId: metrics.segmentId,
      transcript: body.text.trim(),
      transcriptionDurationMs: metrics.segmentSubmittedAt == null ? null : Math.round(performance.now() - metrics.segmentSubmittedAt)
    });
    await handleCommand(body.text.trim(), 1, metrics);
  } catch (error) {
    console.log("[transcribeAudio] 错误:", error.message);
    const errorCode = error.errorCode || (error instanceof TypeError ? "api_unreachable" : "transcription_failed");
    showFallbackPrompt(cloudErrorMessage(errorCode, error.message), errorCode, error.retryable === true, metrics.segmentId);
  } finally {
    transcribing = false;
  }
}

function showFallbackPrompt(reason, errorCode = "cloud_unavailable", retryable = true, segmentId = null) {
  fallbackPending = true;
  releaseCloudResources();
  listeningWanted = false;
  endVoiceSession(errorCode);
  emitAcceptance("error", { segmentId, errorCode, retryable, message: reason });
  updateListeningUi("云端识别不可用，请重试或停止");
  $("fallback-panel").hidden = false;
  say(`${reason}。请选择重试云端识别或停止聆听`);
}

export async function retryCloudRecognition() {
  fallbackPending = false;
  $("fallback-panel").hidden = true;
  cloudConfigured = null;
  backendApiAvailable = null;
  updateListeningUi("正在检查云端配置");
  await loadVoiceCapabilities();
  listeningWanted = true;
  beginVoiceSession();
  updateListeningUi("正在启动");
  await startCloudListening();
}

function stopListening() {
  listeningWanted = false;
  fallbackPending = false;
  releaseCloudResources();
  endVoiceSession("user_stopped");
  $("fallback-panel").hidden = true;
  clearPreview();
  updateListeningUi("已暂停");
}

async function startFullListening() {
  if (cloudConfigured == null) {
    updateListeningUi("正在检查云端配置");
    await loadVoiceCapabilities();
  }
  listeningWanted = true;
  beginVoiceSession();
  fallbackPending = false;
  $("fallback-panel").hidden = true;
  clearPreview();
  updateListeningUi("正在启动");
  resumeVoiceInput();
}

function setupVoice() {
  $("listen-button").onclick = () => {
    if (listeningWanted) {
      stopListening();
      updateListeningUi("已暂停");
      return;
    }
    startFullListening();
  };
  $("retry-cloud").onclick = retryCloudRecognition;
  $("fallback-stop").onclick = stopListening;
  document.addEventListener?.("visibilitychange", () => {
    if (document.visibilityState === "visible") checkVoiceHealth();
  });
  loadVoiceCapabilities();
}

export { tryPreviewRender };

export function _resetCloudConfig() { cloudConfigured = null; backendApiAvailable = null; }
export function testEnterFullListening() {
  listeningWanted = true;
  beginVoiceSession();
  fallbackPending = false;
  $("fallback-panel").hidden = true;
  startCloudListening();
}

export function saveProjectData() {
  return engine.serializeProject();
}

export { actionsFromInterpretation };

export function loadProjectData(project) {
  engine.loadProject(project);
  render();
  saveAutosave();
  restoreArtworkTexture();
}

function saveAutosave() {
  globalThis.localStorage?.setItem?.(AUTOSAVE_KEY, JSON.stringify(engine.serializeProject()));
}

export function discardAutosave() {
  globalThis.localStorage?.removeItem?.(AUTOSAVE_KEY);
}

function restoreAutosave() {
  const stored = globalThis.localStorage?.getItem?.(AUTOSAVE_KEY);
  if (!stored) return;
  try {
    engine.loadProject(JSON.parse(stored));
  } catch (_error) {
    toast("上次工程已损坏，已忽略");
  }
}

restoreAutosave(); render(); restoreArtworkTexture(); setupCanvasControls(); setupVoice();
if (new URLSearchParams(globalThis.location?.search || "").get("acceptance") === "1") {
  import("./acceptance.js").then(({ setupAcceptancePanel }) => setupAcceptancePanel());
}
