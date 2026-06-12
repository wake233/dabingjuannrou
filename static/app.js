import { DrawingEngine } from "./model.js";
import { parseCommand } from "./parser.js";

const engine = new DrawingEngine();
const $ = id => document.getElementById(id);
const layer = $("drawing-layer");
let recognition = null;
let listeningWanted = false;
let speaking = false;
let pendingConfirmation = null;
let confirmationTimer = null;

function polygonPoints(kind, o) {
  if (kind === "triangle") return `${o.x + o.width / 2},${o.y} ${o.x + o.width},${o.y + o.height} ${o.x},${o.y + o.height}`;
  const points = [];
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 ? Math.min(o.width, o.height) * .22 : Math.min(o.width, o.height) * .5;
    const angle = -Math.PI / 2 + i * Math.PI / 5;
    points.push(`${o.x + o.width / 2 + Math.cos(angle) * radius},${o.y + o.height / 2 + Math.sin(angle) * radius}`);
  }
  return points.join(" ");
}

function svgElement(o) {
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

function render() {
  layer.replaceChildren(...engine.state.objects.map(svgElement));
  $("canvas").style.background = engine.state.background;
  $("object-count").textContent = engine.state.objects.length;
  $("selection-count").textContent = engine.state.selection.length;
  $("object-list").innerHTML = engine.state.objects.length
    ? engine.state.objects.map(o => `<li>${o.name}${engine.state.selection.includes(o.id) ? " · 已选中" : ""}</li>`).join("")
    : "<li>画布还是空的</li>";
}

function say(message) {
  $("feedback").textContent = message;
  const utterance = new SpeechSynthesisUtterance(message);
  utterance.lang = "zh-CN";
  speaking = true;
  recognition?.stop();
  utterance.onend = () => { speaking = false; if (listeningWanted) startRecognition(); };
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}

function toast(message) {
  $("toast").textContent = message; $("toast").classList.add("show");
  setTimeout(() => $("toast").classList.remove("show"), 1800);
}

function describeState() {
  const names = engine.state.objects.map(o => o.name).join("、");
  return engine.state.objects.length ? `画布有${engine.state.objects.length}个图形：${names}` : "画布目前是空的";
}

function download(format) {
  const source = new XMLSerializer().serializeToString($("canvas"));
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  if (format === "svg") return saveBlob(new Blob([source], { type: "image/svg+xml" }), `听画-${stamp}.svg`);
  const image = new Image();
  const url = URL.createObjectURL(new Blob([source], { type: "image/svg+xml" }));
  image.onload = () => {
    const canvas = document.createElement("canvas"); canvas.width = 1000; canvas.height = 700;
    const ctx = canvas.getContext("2d"); ctx.fillStyle = engine.state.background; ctx.fillRect(0, 0, 1000, 700); ctx.drawImage(image, 0, 0);
    canvas.toBlob(blob => saveBlob(blob, `听画-${stamp}.png`)); URL.revokeObjectURL(url);
  };
  image.src = url;
}

function saveBlob(blob, name) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function llmFallback(text) {
  say("正在理解");
  const response = await fetch("/api/parse", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, context: { objects: engine.state.objects.map(({ id, name, kind }) => ({ id, name, kind })), selection: engine.state.selection } })
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "模型解析失败");
  return body.actions;
}

async function handleCommand(rawText, confidence = 1) {
  const started = performance.now();
  $("transcript").textContent = rawText;
  if (confidence < .45) return say("没有听清，请再说一次");
  if (pendingConfirmation) {
    if (/确认/.test(rawText)) {
      clearTimeout(confirmationTimer); const actions = pendingConfirmation; pendingConfirmation = null;
      engine.execute(actions); render(); return say("画布已清空");
    }
    if (/取消/.test(rawText)) { clearTimeout(confirmationTimer); pendingConfirmation = null; return say("已取消清空"); }
  }
  let actions;
  try { actions = parseCommand(rawText, { selected: engine.state.selection.length > 0 }); }
  catch {
    try { actions = await llmFallback(rawText); }
    catch (error) { return say(`${error.message}。请改用标准指令`); }
  }
  if (actions.some(a => a.requiresConfirmation)) {
    pendingConfirmation = actions; say("清空画布会删除全部图形，请在八秒内说确认或取消");
    confirmationTimer = setTimeout(() => { pendingConfirmation = null; say("确认超时，已取消清空"); }, 8000);
    return;
  }
  try {
    const result = engine.execute(actions); render();
    for (const effect of result.effects) {
      if (effect.type === "export") download(effect.format);
      if (effect.type === "help") say("你可以创建图形，选择和移动，修改颜色，对齐，撤销，清空或保存画布");
      if (effect.type === "status") say(describeState());
    }
    const latency = Math.round(performance.now() - started);
    $("latency").textContent = `本次响应 ${latency}ms`;
    if (!result.effects.length) say(`已执行，共${actions.length}个动作`);
  } catch (error) { say(error.message); }
}

function startRecognition() {
  if (!recognition || speaking) return;
  try { recognition.start(); } catch {}
}

function setupVoice() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    $("voice-status").textContent = "浏览器不支持语音识别";
    $("listen-button").disabled = true; return;
  }
  recognition = new Recognition(); recognition.lang = "zh-CN"; recognition.continuous = true; recognition.interimResults = true;
  recognition.onstart = () => { $("voice-status").textContent = "正在聆听"; $("wave").classList.add("active"); };
  recognition.onend = () => { $("wave").classList.remove("active"); if (listeningWanted && !speaking) setTimeout(startRecognition, 250); };
  recognition.onerror = event => { if (event.error !== "no-speech") toast(`语音识别：${event.error}`); };
  recognition.onresult = event => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i], text = result[0].transcript;
      if (result.isFinal) handleCommand(text, result[0].confidence); else interim += text;
    }
    if (interim) $("transcript").textContent = interim;
  };
  $("listen-button").onclick = () => {
    listeningWanted = !listeningWanted; $("listen-button").classList.toggle("active", listeningWanted);
    $("listen-label").textContent = listeningWanted ? "停止聆听" : "开始聆听";
    $("voice-status").textContent = listeningWanted ? "正在启动" : "已暂停";
    if (listeningWanted) startRecognition(); else recognition.stop();
  };
}

render(); setupVoice();
