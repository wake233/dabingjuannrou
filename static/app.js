import { DrawingEngine } from "./model.js";
import { parseCommand } from "./parser.js";
import { createVoskRecognizer, checkModelAvailability, downloadModel, deleteModel } from "./vosk_recognizer.js";

export const engine = new DrawingEngine();
const $ = id => document.getElementById(id);
const layer = $("drawing-layer");
const previewLayer = $("preview-layer");
let lastPreviewText = "";
let lastPreviewTime = -1000;
let recognition = null;
let listeningWanted = false;
let speaking = false;
let recognitionActive = false;
let recognitionRestartTimer = null;
let browserInterimCommitTimer = null;
let browserInterimText = "";
let browserFastCommittedText = "";
let suppressBrowserFinalUntil = 0;
let speechSequence = 0;
let pendingConfirmation = null;
let confirmationTimer = null;
const VOICE_MODE_KEY = "listen-paint-voice-mode";
const AUTOSAVE_KEY = "listen-paint-autosave-v1";
const savedVoiceMode = globalThis.localStorage?.getItem?.(VOICE_MODE_KEY);
let voiceMode = ["cloud", "browser"].includes(savedVoiceMode) ? savedVoiceMode : "cloud";
let cloudConfigured = null;
let backendApiAvailable = null;
let voskRecognizer = null;
let voskReady = false;
let voskModelAvailable = false;
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
let wakeWordActive = false;
let wakeWordRecognition = null;
let wakeWordSoundStart = null;
let wakeWordMonitorTimer = null;
let wakeWordTimeoutTimer = null;
let canvasFlashTimer = null;

const WAKE_WORDS = ["听画", "开始画", "嘿画布"];
const WAKE_WORD_SOUND_MS = 300;
const WAKE_WORD_RECOGNITION_MS = 3000;
const BROWSER_INTERIM_COMMIT_MS = 400;
const SILENCE_MS = 500;
const MIN_SPEECH_MS = 250;
const MAX_SEGMENT_MS = 10000;
const SOUND_THRESHOLD = .035;
const MUTATION_TYPES = new Set([
  "create", "update", "move", "align", "distribute", "duplicate",
  "delete", "group", "ungroup", "canvas"
]);

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
  const resumeWakeWord = wakeWordActive && !listeningWanted;
  speaking = true;
  if (resumeWakeWord) stopWakeWordListening();
  else pauseVoiceInput();
  const finish = () => {
    if (sequence !== speechSequence) return;
    speaking = false;
    if (listeningWanted && fallbackPending) startRecognition();
    else if (listeningWanted) resumeVoiceInput();
    else if (resumeWakeWord) startWakeWordListening();
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
  if (!response.ok) throw new Error(body.error || "模型解析失败");
  return body.actions;
}

export async function handleCommand(rawText, confidence = 1) {
  const started = performance.now();
  $("transcript").textContent = rawText;
  console.log("[handleCommand] text=%s confidence=%s", rawText, confidence);
  if (pendingConfirmation) {
    if (/确认|是|好的/.test(rawText)) {
      clearTimeout(confirmationTimer);
      const actions = pendingConfirmation;
      pendingConfirmation = null;
      console.log("[handleCommand] 确认执行暂挂的动作:", actions.length);
      return executeActions(actions, started, "已确认并执行");
    }
    if (/取消|否|不要/.test(rawText)) {
      clearTimeout(confirmationTimer);
      pendingConfirmation = null;
      console.log("[handleCommand] 取消暂挂的动作");
      return say("已取消操作");
    }
    console.log("[handleCommand] 确认窗口中收到非确认指令");
    say("请说确认或取消");
    return;
  }
  const modeCommand = rawText.trim();
  if (/^(切换到|使用)云端识别$/.test(modeCommand)) {
    await switchVoiceMode("cloud");
    return say("已切换到云端识别");
  }
  if (/^(切换到|使用)浏览器识别$/.test(modeCommand)) {
    await switchVoiceMode("browser");
    return say(voiceMode === "browser" ? "已切换到浏览器识别" : "浏览器识别不可用");
  }
  if (/^(当前识别模式|现在是什么模式)$/.test(modeCommand)) {
    return say(voiceMode === "browser" ? "当前是浏览器识别" : "当前是云端识别");
  }
  if (/离线识别|离线模式|下载离线模型/.test(modeCommand)) {
    return say("第二版不提供离线识别，请使用云端或浏览器识别");
  }
  if (/^丢弃上次工程$/.test(modeCommand)) {
    discardAutosave();
    return say("已丢弃上次工程");
  }
  // Voice sleep: return to wake-word listening from full listening
  if (listeningWanted && /^(休息|停止聆听)$/.test(rawText.trim())) {
    console.log("[handleCommand] 进入后台聆听模式");
    returnToWakeWord();
    say("已进入后台聆听");
    return;
  }
  let actions;
  try { actions = parseCommand(rawText, { selected: engine.state.selection.length > 0 }); }
  catch (parseError) {
    console.log("[handleCommand] 本地解析失败:", parseError.message);
    // Web Speech confidence scores are inconsistent for Chinese. A clear
    // locally parsed command is safe to execute regardless of that score, but
    // low-confidence unknown text must not trigger model fallback.
    if (Number.isFinite(confidence) && confidence > 0 && confidence < .45) {
      console.log("[handleCommand] 低置信度(%.2f)，拒绝回退模型", confidence);
      return say("没有听清，请再说一次");
    }
    try { actions = await llmFallback(rawText); }
    catch (error) {
      console.log("[handleCommand] 模型回退也失败:", error.message);
      return say(`${error.message}。请改用标准指令`);
    }
  }
  console.log("[handleCommand] 解析成功，%d 个动作:", actions.length, actions.map(a => a.type + (a.kind ? ":" + a.kind : "")));
  if (needsRiskConfirmation(actions)) {
    console.log("[handleCommand] 需要风险确认");
    pendingConfirmation = actions;
    say(riskConfirmationMessage(actions));
    confirmationTimer = setTimeout(() => { pendingConfirmation = null; say("确认超时，已取消操作"); }, 8000);
    return;
  }
  return executeActions(actions, started);
}

function executeActions(actions, started, confirmationMessage = "") {
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
    if (!result.effects.length) say(confirmationMessage || `已执行，共${actions.length}个动作`);
  } catch (error) {
    console.log("[executeActions] 执行失败:", error.message);
    say(error.message);
  }
}

export function needsRiskConfirmation(actions) {
  const mutations = actions.filter(action => MUTATION_TYPES.has(action.type));
  // Actions with _compositeId were generated by decomposeComposite.
  // Each distinct _compositeId represents one semantic unit (e.g., "画一个房子"
  // → 3 shapes with same _compositeId). Count each composite group as 1
  // instead of its individual actions to avoid false confirmation triggers.
  const compositeIds = new Set();
  let nonCompositeCount = 0;
  for (const a of mutations) {
    if (a._compositeId != null) compositeIds.add(a._compositeId);
    else nonCompositeCount++;
  }
  const effectiveMutationCount = compositeIds.size + nonCompositeCount;
  return actions.some(action => action.requiresConfirmation)
    || actions.some(action => action.type === "delete")
    || mutations.some(action => action.target === "all")
    || effectiveMutationCount >= 3;
}

function riskConfirmationMessage(actions) {
  if (actions.some(action => action.requiresConfirmation)) return "清空画布会删除全部图形，请在八秒内说确认或取消";
  if (actions.some(action => action.type === "delete")) return "删除操作需要确认，请在八秒内说确认或取消";
  if (actions.some(action => action.target === "all")) return "修改全部图形需要确认，请在八秒内说确认或取消";
  return "这条指令包含多个修改动作，请在八秒内说确认或取消";
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
  if (voiceMode === "cloud") stopCloudCapture();
  else if (voiceMode === "offline") stopOfflineCapture();
  else recognition?.stop();
}

function resumeVoiceInput() {
  if (voiceMode === "cloud") startCloudListening();
  else if (voiceMode === "offline") startOfflineListening();
  else startRecognition();
}

function startRecognition() {
  if (!recognition || !listeningWanted || speaking || recognitionActive || (voiceMode !== "browser" && !fallbackPending)) {
    console.log("[startRecognition] 跳过: recognition=%s listeningWanted=%s speaking=%s recognitionActive=%s voiceMode=%s",
      !!recognition, listeningWanted, speaking, recognitionActive, voiceMode);
    return;
  }
  clearTimeout(recognitionRestartTimer);
  recognitionRestartTimer = null;
  try {
    console.log("[startRecognition] 启动浏览器识别");
    recognition.start();
  } catch (error) {
    console.log("[startRecognition] 启动失败:", error?.name, error?.message);
    if (error?.name !== "InvalidStateError") {
      listeningWanted = false;
      updateListeningUi("语音识别启动失败");
      toast(`语音识别启动失败：${error?.message || error}`);
    }
  }
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
    if (!cloudConfigured && voiceMode === "cloud" && !listeningWanted && !wakeWordActive) {
      if (recognition) {
        updateListeningUi(`${cloudIssue}，可切换浏览器识别`);
      } else {
        updateListeningUi(`${cloudIssue}，浏览器也不支持语音识别`);
      }
    }
  } catch (_error) {
    backendApiAvailable = false;
    cloudConfigured = false;
    if (voiceMode === "cloud" && !listeningWanted && !wakeWordActive) {
      if (recognition) {
        updateListeningUi("未连接到听画 API 服务，可切换浏览器识别");
      } else {
        updateListeningUi("未连接到听画 API 服务，请使用 python main.py 启动");
      }
    }
  }
}

function scheduleRecognitionRestart() {
  if (!listeningWanted || speaking || recognitionRestartTimer || voiceMode !== "browser") return;
  recognitionRestartTimer = setTimeout(() => {
    recognitionRestartTimer = null;
    startRecognition();
  }, 250);
}

function clearBrowserInterimCommit() {
  clearTimeout(browserInterimCommitTimer);
  browserInterimCommitTimer = null;
  browserInterimText = "";
}

function isFastBrowserCommand(text) {
  if (!text || text.length < 2 || /(?:然后|并且|接着|随后|再|和|，|、)$/.test(text)) return false;
  if (pendingConfirmation) return /^(?:确认|取消|是|否|好的|不要)$/.test(text);
  try {
    return parseCommand(text, { selected: engine.state.selection.length > 0 }).length > 0;
  } catch {
    return false;
  }
}

function scheduleBrowserInterimCommit(text) {
  const candidate = text.trim();
  if (!isFastBrowserCommand(candidate)) {
    clearBrowserInterimCommit();
    return;
  }
  if (browserInterimText === candidate && browserInterimCommitTimer) return;
  clearBrowserInterimCommit();
  browserInterimText = candidate;
  browserInterimCommitTimer = setTimeout(() => {
    browserInterimCommitTimer = null;
    if (!listeningWanted || speaking || voiceMode !== "browser" || browserInterimText !== candidate) return;
    suppressBrowserFinalUntil = Date.now() + 2000;
    browserFastCommittedText = candidate;
    browserInterimText = "";
    clearPreview();
    try { recognition?.stop(); } catch (_error) { /* recognition may already be ending */ }
    handleCommand(candidate);
  }, BROWSER_INTERIM_COMMIT_MS);
}

function isDuplicateBrowserFinal(text) {
  if (!browserFastCommittedText || Date.now() >= suppressBrowserFinalUntil) {
    browserFastCommittedText = "";
    return false;
  }
  const compact = value => value.replace(/[，。！？、\s]/g, "");
  const finalText = compact(text);
  const committedText = compact(browserFastCommittedText);
  const duplicate = finalText === committedText
    || finalText.includes(committedText)
    || committedText.includes(finalText);
  if (duplicate) browserFastCommittedText = "";
  return duplicate;
}

// SpeechRecognition.phrases (Chrome experimental API) is NOT supported for
// zh-CN and causes a phrases-not-supported error that breaks recognition.
// Removed entirely — see DESIGN.md §4.1 for the field biasing decision.

async function ensureCloudResources() {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder || !(window.AudioContext || window.webkitAudioContext)) {
    throw new Error("浏览器不支持云端录音");
  }
  if (mediaStream && audioContext && analyser) {
    if (audioContext.state === "suspended") await audioContext.resume?.();
    return;
  }
  releaseCloudResources();
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
  });
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
  if (!listeningWanted || speaking || fallbackPending || transcribing || voiceMode !== "cloud" || mediaRecorder?.state === "recording") return;
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
    if (disposition === "submit" && blob.size) await transcribeAudio(blob);
    if (listeningWanted && !speaking && !fallbackPending && !transcribing && voiceMode === "cloud") startCloudListening();
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

// ── Offline (Vosk) recognition ──────────────────────────────────

async function initVoskIfNeeded() {
  if (voskRecognizer && voskReady) return true;
  try {
    voskRecognizer = createVoskRecognizer({
      onPartial: (text) => {
        if (text) {
          $("transcript").textContent = text;
          tryPreviewRender(text);
        }
      },
      onFinal: (text) => {
        clearPreview();
        if (text?.trim()) handleCommand(text.trim());
      },
      onError: (error) => {
        toast(`离线识别错误: ${error}`);
      },
      onStatus: (status) => {
        updateModeIndicator();
      }
    });
    // Await the actual init Promise instead of a fixed setTimeout
    const initResult = await voskRecognizer.ready;
    voskReady = voskRecognizer.isReady();
    if (!voskReady) {
      // init resolved to false — recognizer is not functional
      toast("离线识别模块未就绪，真实离线识别不可用");
    }
    return voskReady;
  } catch (_error) {
    voskReady = false;
    return false;
  }
}

async function startOfflineListening() {
  if (!listeningWanted || speaking || fallbackPending || transcribing || voiceMode !== "offline") return;
  try {
    await ensureCloudResources();
    const ready = await initVoskIfNeeded();
    if (!ready) {
      showFallbackPrompt("离线模型未就绪");
      return;
    }
    voskRecognizer.start();
    updateListeningUi("离线识别");
    $("wave").classList.add("active");
    beginOfflineSegment();
    if (!audioMonitorTimer) audioMonitorTimer = setInterval(monitorOfflineAudio, 100);
  } catch (error) {
    showFallbackPrompt(error.message || "离线语音识别启动失败");
  }
}

function beginOfflineSegment() {
  if (!listeningWanted || speaking || fallbackPending || transcribing || voiceMode !== "offline") return;
  segmentDisposition = "discard";
  segmentStartedAt = performance.now();
  speechStartedAt = null;
  lastSoundAt = null;
}

function monitorOfflineAudio() {
  if (!analyser || !voskRecognizer || !voskRecognizer.isReady() || voiceMode !== "offline") return;
  const samples = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(samples);
  const level = Math.sqrt(samples.reduce((sum, value) => sum + ((value - 128) / 128) ** 2, 0) / samples.length);

  // Feed audio to Vosk recognizer (convert to Float32Array at ~16kHz equivalent)
  const floatSamples = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    floatSamples[i] = (samples[i] - 128) / 128;
  }
  voskRecognizer.feedAudio(floatSamples);

  const state = { segmentStartedAt, speechStartedAt, lastSoundAt };
  const decision = voiceActivityDecision(state, level, performance.now());
  speechStartedAt = state.speechStartedAt;
  lastSoundAt = state.lastSoundAt;
  if (decision === "submit" || decision === "discard") finishOfflineSegment(decision);
}

function finishOfflineSegment(disposition = "discard") {
  segmentDisposition = disposition;
  if (voskRecognizer && disposition === "submit") {
    voskRecognizer.stop();
    // After Vosk produces a final result, restart if still listening
    if (listeningWanted && !speaking && !fallbackPending && !transcribing && voiceMode === "offline") {
      setTimeout(() => {
        if (listeningWanted && voiceMode === "offline") startOfflineListening();
      }, 300);
    }
  } else if (voskRecognizer) {
    voskRecognizer.stop();
    if (listeningWanted && !speaking && !fallbackPending && !transcribing && voiceMode === "offline") {
      setTimeout(() => {
        if (listeningWanted && voiceMode === "offline") startOfflineListening();
      }, 100);
    }
  }
}

function stopOfflineCapture() {
  clearInterval(audioMonitorTimer);
  audioMonitorTimer = null;
  finishOfflineSegment("discard");
  if (voskRecognizer) voskRecognizer.stop();
  $("wave").classList.remove("active");
}

function releaseOfflineResources() {
  stopOfflineCapture();
  releaseCloudResources();
  voskRecognizer = null;
  voskReady = false;
}

// ── Mode switching ──────────────────────────────────────────────

export async function switchVoiceMode(mode) {
  if (!["cloud", "browser"].includes(mode)) {
    toast(`不支持的模式: ${mode}`);
    return;
  }

  const wasListening = listeningWanted;
  const wasWakeWordActive = wakeWordActive;

  // Stop current mode
  if (wakeWordActive) stopWakeWordListening();
  if (listeningWanted) {
    stopCloudCapture();
    recognition?.stop();
    if (voskRecognizer) {
      voskRecognizer.stop();
    }
  }
  clearPreview();

  voiceMode = mode;
  globalThis.localStorage?.setItem?.(VOICE_MODE_KEY, voiceMode);
  updateModeIndicator();
  if (mode === "browser" && !recognition) {
    voiceMode = "cloud";
    globalThis.localStorage?.setItem?.(VOICE_MODE_KEY, voiceMode);
    updateModeIndicator();
    updateListeningUi("浏览器不支持语音识别，已保留云端模式");
    return;
  }

  if (!wasListening && !wasWakeWordActive) {
    const idleStatus = voiceMode === "cloud"
      ? (cloudConfigured === false ? "云端语音识别未配置" : "云端识别待启动")
      : "浏览器识别待启动";
    updateListeningUi(idleStatus);
  }

  // Restart if was listening
  if (wasListening) {
    if (voiceMode === "cloud") {
      listeningWanted = true;
      startCloudListening();
    } else if (voiceMode === "browser") {
      listeningWanted = true;
      updateListeningUi("浏览器识别");
      startRecognition();
    }
  }

  // Restart wake word if was in background mode
  if (!listeningWanted && wasWakeWordActive) {
    startWakeWordListening();
  }
}

function updateModeIndicator() {
  const indicator = $("mode-indicator");
  if (!indicator) return;
  if (voiceMode === "cloud") {
    indicator.textContent = "🌐 云端";
  } else {
    indicator.textContent = "🌐↓ 浏览器";
  }
}

export function getVoiceMode() { return voiceMode; }
export function isVoskReady() { return voskReady; }

export async function startModelDownload() {
  const progressBar = $("download-progress");
  const progressFill = $("download-progress-fill");
  const progressText = $("download-progress-text");
  if (progressBar) progressBar.hidden = false;
  try {
    await downloadModel((progress) => {
      if (progress.stage === "download" && progressFill && progressText) {
        const pct = progress.total ? Math.round((progress.loaded / progress.total) * 100) : 0;
        progressFill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
        progressText.textContent = `下载模型 ${pct}%`;
      } else if (progress.stage === "extract" && progressText) {
        progressText.textContent = "正在解压模型...";
      } else if (progress.stage === "complete" && progressText) {
        progressText.textContent = "模型下载完成";
      }
    });
    voskModelAvailable = true;
    if (progressBar) progressBar.hidden = true;
    toast("离线模型下载完成，可切换至离线模式");
  } catch (error) {
    if (progressBar) progressBar.hidden = true;
    toast(`模型下载失败: ${error.message}`);
  }
}

async function startCloudListening() {
  if (!listeningWanted || speaking || fallbackPending || transcribing || voiceMode !== "cloud") return;
  if (backendApiAvailable === false) {
    if (recognition) {
      showFallbackPrompt("未连接到听画 API 服务，请使用 python main.py 启动");
    } else {
      listeningWanted = false;
      updateListeningUi("未连接到听画 API 服务，请使用 python main.py 启动");
    }
    return;
  }
  if (cloudConfigured === false) {
    if (recognition) {
      showFallbackPrompt("云端未配置 OPENAI_API_KEY");
    } else {
      listeningWanted = false;
      updateListeningUi("云端未配置，浏览器也不支持语音识别");
    }
    return;
  }
  try {
    await ensureCloudResources();
    updateListeningUi("云端识别");
    $("wave").classList.add("active");
    beginCloudSegment();
    if (!audioMonitorTimer) audioMonitorTimer = setInterval(monitorCloudAudio, 100);
  } catch (error) {
    showFallbackPrompt(error.message || "云端语音识别启动失败");
  }
}

// ── Wake Word Detection (Two-Level) ──────────────────────────

export async function tryAutoStart() {
  if (!navigator.mediaDevices?.getUserMedia) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => t.stop());
    startWakeWordListening();
  } catch (_error) {
    // Permission not granted yet — user must click the button
  }
}

export function startWakeWordListening() {
  if (wakeWordActive || listeningWanted) return;
  wakeWordActive = true;
  updateWakeWordUi();
  ensureCloudResources().then(() => {
    if (!wakeWordActive) return;
    $("wave").classList.add("background");
    toast("正在后台聆听唤醒词'听画'…");
    startWakeWordEnergyMonitor();
  }).catch(error => {
    wakeWordActive = false;
    updateListeningUi("已暂停");
    if (error.name === "NotAllowedError") {
      toast("需要麦克风权限才能使用语音控制");
    } else {
      toast(`后台聆听启动失败：${error?.message || error}`);
    }
  });
}

function stopWakeWordListening() {
  wakeWordActive = false;
  stopWakeWordEnergyMonitor();
  stopWakeWordRecognition();
  $("wave").classList.remove("active", "background");
  if (!listeningWanted) releaseCloudResources();
}

function startWakeWordEnergyMonitor() {
  if (!wakeWordActive || wakeWordMonitorTimer) return;
  wakeWordSoundStart = null;
  wakeWordMonitorTimer = setInterval(() => {
    if (!analyser || !wakeWordActive) return;
    const samples = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(samples);
    const level = Math.sqrt(samples.reduce((sum, v) => sum + ((v - 128) / 128) ** 2, 0) / samples.length);
    const now = performance.now();
    if (level >= SOUND_THRESHOLD) {
      wakeWordSoundStart ??= now;
      if (now - wakeWordSoundStart >= WAKE_WORD_SOUND_MS) {
        stopWakeWordEnergyMonitor();
        startWakeWordRecognition();
      }
    } else {
      wakeWordSoundStart = null;
    }
  }, 100);
}

function stopWakeWordEnergyMonitor() {
  clearInterval(wakeWordMonitorTimer);
  wakeWordMonitorTimer = null;
  wakeWordSoundStart = null;
}

function startWakeWordRecognition() {
  if (!wakeWordActive || wakeWordRecognition) return;
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    if (wakeWordActive) startWakeWordEnergyMonitor();
    return;
  }
  wakeWordRecognition = new Recognition();
  wakeWordRecognition.lang = "zh-CN";
  wakeWordRecognition.continuous = false;
  wakeWordRecognition.interimResults = false;
  wakeWordRecognition.onresult = (event) => {
    const text = event.results[0]?.[0]?.transcript?.trim() || "";
    handleWakeWordResult(text);
  };
  wakeWordRecognition.onerror = () => {
    cleanupWakeWordRecognition();
    if (wakeWordActive) startWakeWordEnergyMonitor();
  };
  wakeWordRecognition.onend = () => {
    cleanupWakeWordRecognition();
    if (wakeWordActive) startWakeWordEnergyMonitor();
  };
  try {
    wakeWordRecognition.start();
    wakeWordTimeoutTimer = setTimeout(() => {
      if (wakeWordRecognition) wakeWordRecognition.stop();
    }, WAKE_WORD_RECOGNITION_MS);
  } catch (_error) {
    cleanupWakeWordRecognition();
    if (wakeWordActive) startWakeWordEnergyMonitor();
  }
}

function stopWakeWordRecognition() {
  clearTimeout(wakeWordTimeoutTimer);
  wakeWordTimeoutTimer = null;
  cleanupWakeWordRecognition();
}

function cleanupWakeWordRecognition() {
  if (!wakeWordRecognition) return;
  wakeWordRecognition.onresult = null;
  wakeWordRecognition.onerror = null;
  wakeWordRecognition.onend = null;
  try { wakeWordRecognition.stop(); } catch (_error) { /* ignore */ }
  wakeWordRecognition = null;
  clearTimeout(wakeWordTimeoutTimer);
  wakeWordTimeoutTimer = null;
}

function handleWakeWordResult(text) {
  stopWakeWordRecognition();
  if (!wakeWordActive) return;
  if (WAKE_WORDS.some(w => text.includes(w))) {
    onWakeSuccess();
  } else {
    if (wakeWordActive) startWakeWordEnergyMonitor();
  }
}

function onWakeSuccess() {
  stopWakeWordListening();
  listeningWanted = true;
  fallbackPending = false;
  $("fallback-panel").hidden = true;
  updateListeningUi("正在启动");
  $("wave").classList.add("active");
  say("听画已唤醒");
  flashCanvasBorder();
}

export function returnToWakeWord() {
  listeningWanted = false;
  stopCloudCapture();
  recognition?.stop();
  if (voskRecognizer) voskRecognizer.stop();
  clearTimeout(recognitionRestartTimer);
  recognitionRestartTimer = null;
  fallbackPending = false;
  $("fallback-panel").hidden = true;
  clearPreview();
  startWakeWordListening();
}

function flashCanvasBorder() {
  const shell = $("canvas-shell");
  if (!shell) return;
  shell.style.transition = "border-color 0.15s";
  shell.style.borderColor = "var(--accent)";
  clearTimeout(canvasFlashTimer);
  canvasFlashTimer = setTimeout(() => {
    shell.style.borderColor = "";
  }, 600);
}

function updateWakeWordUi() {
  if (wakeWordActive) {
    $("listen-button").classList.add("active");
    $("listen-label").textContent = "停止聆听";
    $("voice-status").textContent = "后台聆听中 (唤醒词)";
  } else {
    $("listen-button").classList.remove("active");
    $("listen-label").textContent = "授权麦克风并开始";
    $("voice-status").textContent = "尚未启动";
  }
}

export async function transcribeAudio(blob) {
  transcribing = true;
  let apiUnavailableError = false;
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
        apiUnavailableError = true;
        throw new Error("未连接到听画 API 服务，请使用 python main.py 启动");
      }
    }
    const body = await response.json();
    if (!response.ok) {
      console.log("[transcribeAudio] API 返回错误:", body.error);
      throw new Error(body.error || "云端语音识别失败");
    }
    if (!body.text?.trim()) {
      console.log("[transcribeAudio] API 返回空文本");
      throw new Error("云端语音识别未返回文字");
    }
    console.log("[transcribeAudio] 识别文本:", body.text);
    await handleCommand(body.text.trim());
  } catch (error) {
    console.log("[transcribeAudio] 错误:", error.message);
    showFallbackPrompt(error.message);
  } finally {
    transcribing = false;
  }
}

function showFallbackPrompt(reason) {
  fallbackPending = true;
  releaseCloudResources();
  // Check if browser recognition is actually available before switching
  if (recognition) {
    updateListeningUi("等待降级确认");
    $("fallback-panel").hidden = false;
    say(`${reason}。请选择使用浏览器识别或停止聆听`);
    startFallbackDecisionRecognition();
  } else {
    // No browser recognition available — only option is to stop
    listeningWanted = false;
    updateListeningUi("语音识别不可用，请点击按钮重试");
    $("fallback-panel").hidden = false;
    $("fallback-browser").disabled = true;
    say(`${reason}。浏览器也不支持语音识别，请停止聆听后检查配置`);
  }
}

function startFallbackDecisionRecognition() {
  if (!recognition) return;
  setTimeout(startRecognition, 0);
}

export function useBrowserRecognition() {
  if (!recognition) {
    listeningWanted = false;
    updateListeningUi("浏览器不支持语音识别");
    return;
  }
  fallbackPending = false;
  $("fallback-panel").hidden = true;
  voiceMode = "browser";
  globalThis.localStorage?.setItem?.(VOICE_MODE_KEY, voiceMode);
  updateModeIndicator();
  updateListeningUi("浏览器识别");
  startRecognition();
}

function stopListening() {
  stopWakeWordListening();
  listeningWanted = false;
  fallbackPending = false;
  clearTimeout(recognitionRestartTimer);
  recognitionRestartTimer = null;
  recognition?.stop();
  clearBrowserInterimCommit();
  if (voskRecognizer) voskRecognizer.stop();
  releaseCloudResources();
  $("fallback-panel").hidden = true;
  clearPreview();
  updateListeningUi("已暂停");
}

async function startFullListening() {
  if (voiceMode === "cloud" && cloudConfigured == null) {
    updateListeningUi("正在检查云端配置");
    await loadVoiceCapabilities();
  }
  stopWakeWordListening();
  listeningWanted = true;
  fallbackPending = false;
  $("fallback-panel").hidden = true;
  clearPreview();
  if (voiceMode === "browser" && !recognition) {
    listeningWanted = false;
    updateListeningUi("浏览器不支持语音识别，请使用 Chrome 或 Edge");
    return;
  }
  updateListeningUi("正在启动");
  resumeVoiceInput();
}

const COMMAND_KEYWORDS = ["画", "创建", "删除", "移动", "选择", "撤销", "重做", "填充", "描边", "背景", "导出", "保存", "帮助", "状态", "对齐", "分布", "组合", "取消", "置顶", "置底", "缩放", "旋转", "复制", "清空"];

export function chooseRecognitionAlternative(result) {
  const alternatives = Array.from(result)
    .map(alternative => ({
      text: alternative.transcript?.trim() || "",
      confidence: alternative.confidence
    }))
    .filter(alternative => alternative.text);
  if (!alternatives.length) return null;

  if (pendingConfirmation) {
    const confirmation = alternatives.find(alternative => /确认|取消|是|否|好的|不要/.test(alternative.text));
    if (confirmation) return confirmation;
  }

  const context = { selected: engine.state.selection.length > 0 };
  const scored = alternatives.map(alternative => {
    let score = 0;
    const text = alternative.text;

    // Rule 1: Parseable → +10
    try {
      parseCommand(text, context);
      score += 10;
    } catch { /* not parseable */ }

    // Rule 2: Known command keywords → +5 each
    for (const keyword of COMMAND_KEYWORDS) {
      if (text.includes(keyword)) score += 5;
    }

    // Rule 3: ASR confidence → +confidence × 5
    if (Number.isFinite(alternative.confidence)) {
      score += alternative.confidence * 5;
    }

    // Rule 4: Short noise (length < 2 chars, no keywords) → -10
    const hasKeywords = COMMAND_KEYWORDS.some(kw => text.includes(kw));
    if (text.length < 2 && !hasKeywords) {
      score -= 10;
    }

    return { ...alternative, score };
  });

  // Sort by score descending, tie-break by confidence descending
  scored.sort((a, b) => b.score - a.score || b.confidence - a.confidence);

  // If no candidate scores > 0, return highest-confidence original
  if (scored[0].score <= 0) {
    const bestByConf = [...alternatives].sort((a, b) => b.confidence - a.confidence);
    return bestByConf[0];
  }

  return scored[0];
}

function setupVoice() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (Recognition) {
    recognition = new Recognition(); recognition.lang = "zh-CN"; recognition.continuous = false; recognition.interimResults = true; recognition.maxAlternatives = 10;
  }
  if (recognition) {
  recognition.onstart = () => {
    console.log("[browser.onstart] 浏览器识别已启动");
    recognitionActive = true;
    updateListeningUi(fallbackPending ? "等待降级确认" : "浏览器识别");
    $("wave").classList.add("active");
  };
  recognition.onend = () => {
    console.log("[browser.onend] 浏览器识别已结束");
    recognitionActive = false;
    $("wave").classList.remove("active");
    scheduleRecognitionRestart();
  };
  recognition.onerror = event => {
    console.log("[browser.onerror] 错误:", event.error, event.message);
    clearBrowserInterimCommit();
    clearPreview();
    const fatalErrors = {
      "not-allowed": "麦克风权限被拒绝，请在浏览器中允许麦克风",
      "service-not-allowed": "浏览器未允许语音识别服务",
      "audio-capture": "未检测到可用的麦克风",
      "network": "浏览器语音识别服务网络不可用",
      "language-not-supported": "浏览器语音识别不支持中文"
    };
    if (fatalErrors[event.error]) {
      listeningWanted = false;
      fallbackPending = false;
      clearTimeout(recognitionRestartTimer);
      recognitionRestartTimer = null;
      $("wave").classList.remove("active");
      $("fallback-panel").hidden = true;
      updateListeningUi(fatalErrors[event.error]);
      // Try to fall back to cloud mode if available
      if (cloudConfigured !== false && backendApiAvailable !== false) {
        toast(`${fatalErrors[event.error]}，可切换至云端模式重试`);
      } else {
        toast(fatalErrors[event.error]);
      }
      return;
    }
    if (event.error !== "no-speech" && event.error !== "aborted") toast(`语音识别：${event.error}`);
  };
  recognition.onresult = event => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) {
        clearBrowserInterimCommit();
        clearPreview();
        const alternative = chooseRecognitionAlternative(result);
        console.log("[browser.onresult] final, alternatives:", result.length, "chosen:", alternative?.text, "conf:", alternative?.confidence);
        if (!alternative) {
          console.log("[browser.onresult] 没有有效候选项，所有候选项文本为空");
          continue;
        }
        if (isDuplicateBrowserFinal(alternative.text)) {
          console.log("[browser.onresult] 忽略重复最终结果:", alternative.text);
          continue;
        }
        if (fallbackPending) {
          if (/使用浏览器识别|浏览器识别/.test(alternative.text)) useBrowserRecognition();
          else if (/停止|取消/.test(alternative.text)) stopListening();
        } else {
          handleCommand(alternative.text, alternative.confidence);
        }
      } else {
        interim += result[0]?.transcript?.trim() || "";
      }
    }
    if (interim) {
      $("transcript").textContent = interim;
      tryPreviewRender(interim);
      scheduleBrowserInterimCommit(interim);
    }
  };
  }
  $("fallback-browser").disabled = !recognition;
  // Show a clear warning if the browser doesn't support Web Speech
  if (!recognition) {
    console.warn("[setupVoice] 浏览器不支持 Web Speech API，请使用 Chrome 或 Edge");
    $("voice-status").textContent = "浏览器不支持语音识别";
    toast("⚠️ 请使用 Chrome 或 Edge 浏览器以获得语音识别支持");
    if (voiceMode === "browser") {
      voiceMode = "cloud";
      globalThis.localStorage?.setItem?.(VOICE_MODE_KEY, voiceMode);
      updateModeIndicator();
    }
  }

  // Mode switch button
  const modeSwitchBtn = $("mode-switch-button");
  if (modeSwitchBtn) {
    modeSwitchBtn.onclick = () => {
      const modes = [];
      if (cloudConfigured !== false) modes.push("cloud");
      if (recognition) modes.push("browser");
      if (modes.length <= 1 && modes.includes(voiceMode)) {
        toast("当前没有其他可用的语音识别模式");
        return;
      }
      const currentIndex = modes.indexOf(voiceMode);
      const nextMode = modes[(currentIndex + 1) % modes.length];
      switchVoiceMode(nextMode);
    };
  }

  $("listen-button").onclick = () => {
    if (listeningWanted || wakeWordActive) {
      if (wakeWordActive) stopWakeWordListening();
      else stopListening();
      updateListeningUi("已暂停");
      return;
    }
    startFullListening();
  };
  $("fallback-browser").onclick = useBrowserRecognition;
  $("fallback-stop").onclick = stopListening;
  loadVoiceCapabilities();
}

export function isWakeWordActive() { return wakeWordActive; }
export { tryPreviewRender };

export function testEnterFullListening(mode = "cloud") {
  stopWakeWordListening();
  listeningWanted = true;
  voiceMode = mode;
  fallbackPending = false;
  $("fallback-panel").hidden = true;
  updateModeIndicator();
  if (mode === "cloud") startCloudListening();
  else { updateListeningUi("浏览器识别"); startRecognition(); }
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
