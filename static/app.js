import { DrawingEngine } from "./model.js";
import { parseCommand } from "./parser.js";

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
    browser_unsupported: "当前浏览器不支持云端录音"
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

export function svgElement(o) {
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

function renderObjects(layerElement, objects, selection = []) {
  const selectionSet = new Set(selection);
  layerElement.replaceChildren(...objects.map(o => {
    const el = svgElement(o);
    if (selectionSet.has(o.id)) {
      el.setAttribute("filter", "url(#selection-glow)");
    }
    return el;
  }));
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
    const actions = parseCommand(text, { selected: engine.state.selection.length > 0 });
    // Clone engine state and apply actions to the clone
    const cloneState = JSON.parse(JSON.stringify(engine.state));
    const clone = new DrawingEngine(cloneState);
    // Bypass execute's undo stack by directly mutating clone state
    // (DrawingEngine.execute pushes to undoStack, but we just want the result)
    clone.execute(actions);
    renderObjects(previewLayer, clone.state.objects);
    lastPreviewText = text;
    lastPreviewTime = now;
  } catch {
    // Interim text can't be parsed yet — clear any stale preview
    clearPreview();
    lastPreviewText = text;
  }
}

let lastRenderDuration = 0;

export function render() {
  const started = performance.now();
  clearPreview();
  renderObjects(layer, engine.state.objects, engine.state.selection);
  $("canvas").style.background = engine.state.background;
  $("object-count").textContent = engine.state.objects.length;
  $("selection-count").textContent = engine.state.selection.length;
  // Use a Set for selection membership test (same O(1) optimization as renderObjects)
  const selectionSet = new Set(engine.state.selection);
  $("object-list").innerHTML = engine.state.objects.length
    ? engine.state.objects.map(o => `<li>${o.name}${selectionSet.has(o.id) ? " · 已选中" : ""}</li>`).join("")
    : "<li>画布还是空的</li>";
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
  const canvas = $("canvas");
  const clean = canvas.cloneNode?.(true) || canvas;
  clean.querySelector?.("#preview-layer")?.replaceChildren();
  clean.querySelectorAll?.('[filter="url(#selection-glow)"]').forEach(element => element.removeAttribute("filter"));
  clean.querySelectorAll?.(".preview").forEach(element => element.remove());
  return new XMLSerializer().serializeToString(clean);
}

function saveBlob(blob, name) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function llmFallback(text) {
  say("正在理解");
  const response = await fetch("/api/parse", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, context: { objects: engine.state.objects.map(({ id, name, kind }) => ({ id, name, kind })), selection: engine.state.selection } })
  });
  const body = await response.json();
  if (!response.ok) {
    const error = new Error(body.error || "模型解析失败");
    error.errorCode = body.errorCode || "command_parse_failed";
    error.retryable = body.retryable === true;
    throw error;
  }
  return body.actions;
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
  try { actions = parseCommand(rawText, { selected: engine.state.selection.length > 0 }); }
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
    try { actions = await llmFallback(rawText); }
    catch (error) {
      console.log("[handleCommand] 模型回退也失败:", error.message);
      emitAcceptance("error", { segmentId: metrics.segmentId, errorCode: error.errorCode || "command_parse_failed", retryable: error.retryable === true, message: error.message });
      return say(`${error.message}。请改用标准指令`);
    }
  }
  console.log("[handleCommand] 解析成功，%d 个动作:", actions.length, actions.map(a => a.type + (a.kind ? ":" + a.kind : "")));
  return executeActions(actions, started, "", { ...metrics, transcript: rawText });
}

function executeActions(actions, started, confirmationMessage = "", metrics = {}) {
  try {
    console.log("[executeActions] 执行 %d 个动作", actions.length);
    const result = engine.execute(actions); render();
    if (actions.some(action => !["export", "help", "status"].includes(action.type))) saveAutosave();
    console.log("[executeActions] 执行成功, 画布图形数:", engine.state.objects.length, "效果:", result.effects.length);
    for (const effect of result.effects) {
      if (effect.type === "export") download(effect.format);
      if (effect.type === "help") say("你可以创建图形，选择和移动，修改颜色，对齐，撤销，清空或保存画布");
      if (effect.type === "status") say(describeState());
    }
    const latency = Math.round(performance.now() - started);
    $("latency").textContent = `本次响应 ${latency}ms`;
    emitAcceptance("command-completed", {
      segmentId: metrics.segmentId,
      transcript: metrics.transcript,
      success: true,
      actionCount: actions.length,
      localDurationMs: latency,
      endToEndDurationMs: metrics.segmentSubmittedAt == null ? null : Math.round(performance.now() - metrics.segmentSubmittedAt)
    });
    if (!result.effects.length) say(confirmationMessage || `已执行，共${actions.length}个动作`);
    return true;
  } catch (error) {
    console.log("[executeActions] 执行失败:", error.message);
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
    say(error.message);
    return false;
  }
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
  mediaRecorder = new MediaRecorder(mediaStream);
  mediaRecorder.ondataavailable = event => { if (event.data?.size) audioChunks.push(event.data); };
  mediaRecorder.onstop = async () => {
    const disposition = segmentDisposition;
    const type = mediaRecorder?.mimeType || audioChunks[0]?.type || "audio/webm";
    const blob = new Blob(audioChunks, { type });
    mediaRecorder = null;
    audioChunks = [];
    if (disposition === "submit" && blob.size) {
      const segmentId = ++segmentSequence;
      const segmentSubmittedAt = performance.now();
      emitAcceptance("segment-submitted", { segmentId });
      await transcribeAudio(blob, { segmentId, segmentSubmittedAt });
    }
    if (listeningWanted && !speaking && !fallbackPending && !transcribing) startCloudListening();
  };
  mediaRecorder.start(250);
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
  mediaRecorder.stop();
}

function stopCloudCapture() {
  clearInterval(audioMonitorTimer);
  audioMonitorTimer = null;
  finishCloudSegment("discard");
  $("wave").classList.remove("active");
}

function releaseCloudResources() {
  stopCloudCapture();
  mediaStream?.getTracks?.().forEach(track => track.stop());
  audioContext?.close?.();
  mediaStream = null;
  audioContext = null;
  analyser = null;
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
  } catch (error) {
    showFallbackPrompt(error.message || "云端语音识别启动失败", error.errorCode || "capture_start_failed");
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
  emitAcceptance("error", { segmentId, errorCode, retryable, message: reason });
  fallbackPending = true;
  releaseCloudResources();
  listeningWanted = false;
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
  updateListeningUi("正在启动");
  await startCloudListening();
}

function stopListening() {
  listeningWanted = false;
  fallbackPending = false;
  releaseCloudResources();
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
  loadVoiceCapabilities();
}

export { tryPreviewRender };

export function _resetCloudConfig() { cloudConfigured = null; backendApiAvailable = null; }
export function testEnterFullListening() {
  listeningWanted = true;
  fallbackPending = false;
  $("fallback-panel").hidden = true;
  startCloudListening();
}

export function saveProjectData() {
  return engine.serializeProject();
}

export function loadProjectData(project) {
  engine.loadProject(project);
  render();
  saveAutosave();
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

restoreAutosave(); render(); setupVoice();
if (new URLSearchParams(globalThis.location?.search || "").get("acceptance") === "1") {
  import("./acceptance.js").then(({ setupAcceptancePanel }) => setupAcceptancePanel());
}
