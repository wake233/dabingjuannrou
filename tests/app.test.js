import test from "node:test";
import assert from "node:assert/strict";
import { initialState } from "../static/model.js";

class FakeClassList {
  constructor() { this.values = new Set(); }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  toggle(value, force) {
    if (force === undefined ? !this.values.has(value) : force) this.values.add(value);
    else this.values.delete(value);
  }
  contains(value) { return this.values.has(value); }
}

class FakeElement {
  constructor(tagName, id = "") {
    this.tagName = tagName;
    this.id = id;
    this.attributes = {};
    this.children = [];
    this.style = {};
    this.classList = new FakeClassList();
    this.textContent = "";
    this.innerHTML = "";
    this.disabled = false;
    this.onclick = null;
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  removeAttribute(name) { delete this.attributes[name]; }
  replaceChildren(...children) { this.children = children; }
  cloneNode(deep = false) {
    const clone = new FakeElement(this.tagName, this.id);
    clone.attributes = { ...this.attributes };
    clone.style = { ...this.style };
    clone.children = deep ? this.children.map(child => child.cloneNode(true)) : [];
    return clone;
  }
  querySelector(selector) {
    if (selector.startsWith("#") && this.id === selector.slice(1)) return this;
    for (const child of this.children) {
      const found = child.querySelector(selector);
      if (found) return found;
    }
    return null;
  }
  querySelectorAll(selector) {
    const matches = [];
    if (selector === '[filter="url(#selection-glow)"]' && this.getAttribute("filter") === "url(#selection-glow)") matches.push(this);
    if (selector === ".preview" && this.classList.contains("preview")) matches.push(this);
    for (const child of this.children) matches.push(...child.querySelectorAll(selector));
    return matches;
  }
  remove() { this.removed = true; }
  click() { this.clicked = true; this.onclick?.(); }
}

function installBrowser() {
  const ids = [
    "drawing-layer", "preview-layer", "canvas", "canvas-shell", "object-count", "selection-count", "object-list",
    "feedback", "toast", "transcript", "latency", "voice-status", "listen-button",
    "wave", "listen-label", "fallback-panel", "retry-cloud", "fallback-stop",
    "mode-indicator"
  ];
  const elements = Object.fromEntries(ids.map(id => [id, new FakeElement(id === "canvas" ? "svg" : "div", id)]));
  elements["fallback-panel"].hidden = true;
  const downloads = [];
  const canvasCalls = [];
  const recognitions = [];
  let objectUrl = 0;
  const storage = new Map();
  globalThis.localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key),
    clear: () => storage.clear()
  };

  globalThis.document = {
    getElementById: id => elements[id],
    createElementNS: (_ns, tagName) => new FakeElement(tagName),
    createElement: tagName => {
      const element = new FakeElement(tagName);
      if (tagName === "a") {
        element.click = () => downloads.push({ name: element.download, href: element.href });
      }
      if (tagName === "canvas") {
        const context = {
          fillStyle: "",
          fillRect: (...args) => canvasCalls.push(["fillRect", context.fillStyle, ...args]),
          drawImage: (...args) => canvasCalls.push(["drawImage", ...args])
        };
        element.getContext = () => context;
        element.toBlob = callback => callback(new Blob(["png"], { type: "image/png" }));
      }
      return element;
    }
  };
  class FakeRecognition {
    constructor() {
      this.startCount = 0;
      this.stopCount = 0;
      this.phrases = [];
      recognitions.push(this);
    }
    start() {
      this.startCount++;
      this.onstart?.();
    }
    stop() {
      this.stopCount++;
      this.onend?.();
    }
    emitResult(text, confidence, isFinal = true) {
      this.emitAlternatives([{ text, confidence }], isFinal);
    }
    emitAlternatives(alternatives, isFinal = true) {
      const result = alternatives.map(alternative => ({
        transcript: alternative.text,
        confidence: alternative.confidence
      }));
      result.isFinal = isFinal;
      this.onresult?.({
        resultIndex: 0,
        results: [result]
      });
    }
    emitError(error) { this.onerror?.({ error }); }
  }
  globalThis.window = { SpeechRecognition: FakeRecognition };
  globalThis.performance = { now: () => 10 };
  globalThis.SpeechSynthesisUtterance = class {
    constructor(text) { this.text = text; this.onend = null; this.onerror = null; }
  };
  globalThis.speechSynthesis = {
    cancel() {},
    speak(utterance) { utterance.onend?.(); }
  };
  globalThis.XMLSerializer = class {
    serializeToString(element) {
      const serialize = item => {
        const attrs = Object.entries(item.attributes).map(([key, value]) => ` ${key}="${value}"`).join("");
        return `<${item.tagName}${item.id ? ` id="${item.id}"` : ""}${attrs}>${item.children.filter(child => !child.removed).map(serialize).join("")}${item.textContent || ""}</${item.tagName}>`;
      };
      return serialize(element);
    }
  };
  globalThis.URL = {
    createObjectURL: blob => {
      const href = `blob:test-${++objectUrl}`;
      downloads.push({ href, blob });
      return href;
    },
    revokeObjectURL() {}
  };
  globalThis.Image = class {
    set src(value) { this.value = value; queueMicrotask(() => this.onload?.()); }
  };
  return { elements, downloads, canvasCalls, recognitions };
}

const browser = installBrowser();
const app = await import("../static/app.js");

function resetApp() {
  app._resetCloudConfig();
  app.engine.state = initialState();
  app.engine.undoStack = [];
  app.engine.redoStack = [];
  browser.downloads.length = 0;
  browser.canvasCalls.length = 0;
  browser.elements.feedback.textContent = "";
  app.render();
}

test("浏览器端渲染八类 SVG 图形并应用样式与选择状态", () => {
  resetApp();
  const kinds = ["rect", "circle", "ellipse", "triangle", "star", "line", "arrow", "text"];
  app.engine.execute(kinds.map((kind, index) => ({
    type: "create", kind, fill: "#ef4444", stroke: "#3b82f6",
    strokeWidth: 5, opacity: .6, rotation: index * 5, text: "你好"
  })));
  app.engine.execute([{ type: "select", target: "all" }]);
  app.render();

  const rendered = browser.elements["drawing-layer"].children;
  assert.deepEqual(rendered.map(element => element.tagName), [
    "rect", "ellipse", "ellipse", "polygon", "polygon", "line", "line", "text"
  ]);
  assert.ok(rendered.slice(0, -1).every(element => element.getAttribute("stroke") === "#3b82f6"));
  assert.equal(rendered.at(-1).getAttribute("stroke"), "none");
  assert.ok(rendered.every(element => element.getAttribute("stroke-width") === "5"));
  assert.ok(rendered.every(element => element.getAttribute("opacity") === "0.6"));
  assert.ok(rendered.every(element => element.getAttribute("filter") === "url(#selection-glow)"));
  assert.equal(rendered[6].getAttribute("marker-end"), "url(#arrow-head)");
  assert.equal(rendered[7].textContent, "你好");
  assert.equal(browser.elements["object-count"].textContent, 8);
  assert.equal(browser.elements["selection-count"].textContent, 8);
});

test("低置信度的明确本地指令仍会执行", async () => {
  resetApp();
  await app.handleCommand("画一个矩形", .44);
  assert.equal(app.engine.state.objects.length, 1);
  assert.equal(app.engine.state.objects[0].kind, "rect");
});

test("低置信度的未知指令不会回退模型或执行动作", async () => {
  resetApp();
  let requested = false;
  globalThis.fetch = async () => {
    requested = true;
    return { ok: true, json: async () => ({ actions: [{ type: "create", kind: "star" }] }) };
  };

  await app.handleCommand("无法理解的含糊表达", .44);

  assert.equal(requested, false);
  assert.equal(app.engine.state.objects.length, 0);
  assert.equal(browser.elements.feedback.textContent, "没有听清，请再说一次");
});

test("正式应用不创建浏览器 SpeechRecognition 实例", () => {
  assert.equal(browser.recognitions.length, 0);
});

test("静音检测会忽略短噪声、在停顿后提交并限制最长录音", () => {
  const shortNoise = { segmentStartedAt: 0, speechStartedAt: null, lastSoundAt: null };
  assert.equal(app.voiceActivityDecision(shortNoise, .1, 100), "sound");
  assert.equal(app.voiceActivityDecision(shortNoise, 0, 950), "discard");

  const speech = { segmentStartedAt: 0, speechStartedAt: null, lastSoundAt: null };
  app.voiceActivityDecision(speech, .1, 100);
  app.voiceActivityDecision(speech, .1, 500);
  assert.equal(app.voiceActivityDecision(speech, 0, 1300), "submit");

  assert.equal(app.voiceActivityDecision({
    segmentStartedAt: 0, speechStartedAt: null, lastSoundAt: null
  }, 0, 10000), "discard");
});

test("自适应 VAD：短指令(语音时长<2s)使用 400ms 静音阈值提交", () => {
  // Short speech: duration ~600ms (< 2000ms), adaptive silence = 400ms
  const state = { segmentStartedAt: 0, speechStartedAt: null, lastSoundAt: null };
  app.voiceActivityDecision(state, .1, 100);  // sound starts
  app.voiceActivityDecision(state, .1, 300);  // sound continues
  app.voiceActivityDecision(state, .1, 700);  // last sound at 700
  // Speech duration = 700-100 = 600ms < 2000ms → silence threshold = 400ms
  // At t=1100, silence = 400ms since last sound → "submit"
  assert.equal(app.voiceActivityDecision(state, 0, 1100), "submit");
});

test("自适应 VAD：长指令(语音时长>=2s)使用 600ms 静音阈值提交", () => {
  // Long speech: duration ~2500ms (>= 2000ms), adaptive silence = 600ms
  const state = { segmentStartedAt: 0, speechStartedAt: null, lastSoundAt: null };
  app.voiceActivityDecision(state, .1, 100);   // sound starts
  app.voiceActivityDecision(state, .1, 800);   // sound continues
  app.voiceActivityDecision(state, .1, 1600);  // sound continues
  app.voiceActivityDecision(state, .1, 2600);  // last sound at 2600
  // Speech duration = 2600-100 = 2500ms >= 2000ms → silence threshold = 600ms
  // At t=3200, silence = 600ms since last sound → "submit"
  assert.equal(app.voiceActivityDecision(state, 0, 3200), "submit");
});

test("自适应 VAD：短指令静音不足 400ms 时继续等待", () => {
  const state = { segmentStartedAt: 0, speechStartedAt: null, lastSoundAt: null };
  app.voiceActivityDecision(state, .1, 100);
  app.voiceActivityDecision(state, .1, 500);  // last sound at 500, duration=400ms < 2000ms
  // At t=800, silence = 300ms < 400ms threshold → "continue"
  assert.equal(app.voiceActivityDecision(state, 0, 800), "continue");
  // At t=900, silence = 400ms >= 400ms threshold → "submit"
  assert.equal(app.voiceActivityDecision(state, 0, 900), "submit");
});

test("自适应 VAD：语音时长不足最短语音时长则丢弃", () => {
  // Speech duration < MIN_SPEECH_MS (250ms) → discard even if silence threshold met
  const state = { segmentStartedAt: 0, speechStartedAt: null, lastSoundAt: null };
  app.voiceActivityDecision(state, .1, 100);  // sound at 100
  app.voiceActivityDecision(state, .1, 200);  // last sound at 200
  // Speech duration = 200-100 = 100ms < 250ms (MIN_SPEECH_MS) → "discard"
  // Silence till 600ms (600-200=400 >= adaptive 400ms)
  assert.equal(app.voiceActivityDecision(state, 0, 600), "discard");
});

// ── Phase 4.2: Preview Rendering ────────────────────────────────

test("预览渲染：可解析的中间结果渲染到预览层", () => {
  resetApp();
  app.engine.execute([{ type: "create", kind: "rect" }]); // existing shape
  app.render();

  // Ensure existing shape on drawing layer, preview is empty
  assert.ok(browser.elements["drawing-layer"].children.length >= 1);
  assert.equal(browser.elements["preview-layer"].children.length, 0);

  // Simulate interim result "画一个圆"
  app.tryPreviewRender("画一个圆形");
  // Preview layer should now have content (the existing rect + new circle)
  assert.ok(browser.elements["preview-layer"].children.length >= 2,
    "preview layer should have both existing rect and new circle");

  // Drawing layer should be unchanged (preview doesn't modify the real engine)
  app.render();
  assert.equal(browser.elements["drawing-layer"].children.length, 1,
    "drawing layer should still have only the original rect");
});

test("预览渲染：clearPreview 清空预览层", () => {
  resetApp();
  app.tryPreviewRender("画一个圆形");
  assert.ok(browser.elements["preview-layer"].children.length >= 1,
    "preview layer should have content after tryPreviewRender");

  app.clearPreview();
  assert.equal(browser.elements["preview-layer"].children.length, 0,
    "preview layer should be empty after clearPreview");
});

test("预览渲染：render 调用前先清空预览层", () => {
  resetApp();
  app.engine.execute([{ type: "create", kind: "circle" }]);
  app.tryPreviewRender("画一个矩形");
  // Preview has content
  assert.ok(browser.elements["preview-layer"].children.length >= 1);

  // render() clears preview and renders to drawing layer
  app.render();
  assert.equal(browser.elements["preview-layer"].children.length, 0,
    "render should clear preview layer");
  assert.equal(browser.elements["drawing-layer"].children.length, 1,
    "drawing layer should have the circle");
});

test("预览渲染：不可解析的中间结果清空预览层", () => {
  resetApp();
  app.engine.execute([{ type: "create", kind: "rect" }]);
  app.render();

  // Override performance.now to advance time between calls
  const origNow = globalThis.performance.now;
  let fakeTime = 0;
  globalThis.performance.now = () => { fakeTime += 250; return fakeTime; };

  // First a parseable preview
  app.tryPreviewRender("画一个圆");
  assert.ok(browser.elements["preview-layer"].children.length >= 2);

  // Then an unparseable interim result — time has advanced past throttle
  app.tryPreviewRender("无法解析的乱码文本xyz");
  assert.equal(browser.elements["preview-layer"].children.length, 0,
    "unparseable interim should clear preview");

  // Restore
  globalThis.performance.now = origNow;
});

test("预览渲染：节流跳过过快或变更过小的中间结果", () => {
  resetApp();
  const origNow = globalThis.performance.now;
  let fakeTime = 0;
  globalThis.performance.now = () => fakeTime;

  // First call at t=0 with text "画一个圆形" (parseable, renders to preview)
  app.tryPreviewRender("画一个圆形");
  const countAfterFirst = browser.elements["preview-layer"].children.length;
  assert.ok(countAfterFirst >= 1, "first preview should render");

  // Second call at t=50 (< 200ms since last render) — should be throttled
  // Preview layer content should NOT change (time throttle blocks)
  fakeTime = 50;
  app.tryPreviewRender("画一个红色矩形"); // different text, but time throttle blocks
  assert.equal(browser.elements["preview-layer"].children.length, countAfterFirst,
    "second call within 200ms should be throttled, preview unchanged");

  // Third call at t=300 (>= 200ms later, and text length differs by >= 2 chars)
  // "画一个红色矩形" (7 chars) vs lastPreviewText "画一个圆形" (5 chars) → diff=2 → proceeds
  fakeTime = 300;
  app.tryPreviewRender("画一个红色矩形");
  // Now the preview should have updated: 0 existing + 1 red rect = 1 shape
  // (clone engine is empty since we never executed the circle on real engine;
  //  preview clone has only the new parsed action)
  assert.equal(browser.elements["preview-layer"].children.length, 1,
    "third call renders updated preview");

  // Restore
  globalThis.performance.now = origNow;
});

// ── Phase 4.3: Render Performance ──────────────────────────────

test("渲染性能：100 个图形渲染 预览层已清空且绘制层完整", () => {
  resetApp();

  // Create 100 shapes in batches of 20 (model.js limits 1-20 actions per execute)
  const allKinds = ["rect", "circle", "ellipse", "triangle", "star"];
  for (let batch = 0; batch < 5; batch++) {
    const batchActions = [];
    for (let i = 0; i < 20; i++) {
      const idx = batch * 20 + i;
      batchActions.push({
        type: "create",
        kind: allKinds[idx % allKinds.length],
        x: (idx % 10) * 100,
        y: Math.floor(idx / 10) * 70
      });
    }
    app.engine.execute(batchActions);
  }
  app.engine.execute([{ type: "select", target: "all" }]);

  // Use real process.hrtime for accurate timing in Node test runner
  const start = process.hrtime.bigint();
  app.render();
  const end = process.hrtime.bigint();
  const durationMs = Number(end - start) / 1_000_000;

  // Verify correctness
  assert.equal(browser.elements["drawing-layer"].children.length, 100,
    "all 100 shapes should be in drawing layer");
  assert.equal(browser.elements["preview-layer"].children.length, 0,
    "preview layer should be cleared by render");
  assert.equal(browser.elements["object-count"].textContent, 100);
  assert.equal(browser.elements["selection-count"].textContent, 100);

  // Verify render performance (100 shapes should render in < 16ms for 60fps)
  assert.ok(durationMs < 16,
    `render of 100 shapes took ${durationMs.toFixed(2)}ms, expected < 16ms for 60fps`);
});

// ── End Preview Rendering tests ─────────────────────────────────

test("云端转写成功后执行绘图指令", async () => {
  resetApp();
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "/api/transcribe");
    assert.equal(options.headers["Content-Type"], "audio/webm");
    return { ok: true, json: async () => ({ text: "画一个圆形" }) };
  };

  await app.transcribeAudio(new Blob(["audio"], { type: "audio/webm" }));

  assert.equal(app.engine.state.objects.length, 1);
  assert.equal(app.engine.state.objects[0].kind, "circle");
});

test("云端转写失败后提供重试和停止操作", async () => {
  globalThis.fetch = async () => ({ ok: false, json: async () => ({ error: "云端语音识别未配置" }) });

  await app.transcribeAudio(new Blob(["audio"], { type: "audio/webm" }));

  assert.equal(browser.elements["voice-status"].textContent, "云端识别不可用，请重试或停止");
  assert.equal(browser.elements["fallback-panel"].hidden, false);
  assert.equal(typeof browser.elements["retry-cloud"].onclick, "function");
  browser.elements["fallback-stop"].click();
  assert.equal(browser.elements["voice-status"].textContent, "已暂停");
});

test("重试云端识别会重新检查配置并恢复录音", async () => {
  const recorders = [];
  class FakeMediaRecorder {
    constructor() { this.state = "inactive"; this.mimeType = "audio/webm"; recorders.push(this); }
    start() { this.state = "recording"; }
    stop() { this.state = "inactive"; this.onstop?.(); }
  }
  class FakeAudioContext {
    constructor() { this.state = "running"; }
    createAnalyser() { return { fftSize: 2048, getByteTimeDomainData(values) { values.fill(128); } }; }
    createMediaStreamSource() { return { connect() {} }; }
    close() {}
  }
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) } }
  });
  globalThis.MediaRecorder = FakeMediaRecorder;
  window.MediaRecorder = FakeMediaRecorder;
  window.AudioContext = FakeAudioContext;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ apiVersion: 1, cloudTranscriptionConfigured: true, cloudTranscriptionIssue: null, commandModelConfigured: true })
  });

  await app.retryCloudRecognition();

  assert.equal(browser.elements["fallback-panel"].hidden, true);
  assert.equal(browser.elements["voice-status"].textContent, "云端识别");
  assert.equal(recorders.at(-1).state, "recording");
  browser.elements["listen-button"].click();
});

test("休息和停止聆听会直接停止云端识别", async () => {
  app.testEnterFullListening();
  await app.handleCommand("休息");

  assert.equal(browser.elements.feedback.textContent, "已停止聆听");
  assert.equal(browser.elements["voice-status"].textContent, "已暂停");
});

test("云端模式启动采集，并在语音反馈期间暂停后恢复", async () => {
  const recorders = [];
  const audioContexts = [];
  const tracks = [{ stopped: false, stop() { this.stopped = true; } }];
  class FakeMediaRecorder {
    constructor() {
      this.state = "inactive";
      this.mimeType = "audio/webm";
      recorders.push(this);
    }
    start() { this.state = "recording"; }
    stop() {
      this.state = "inactive";
      this.onstop?.();
    }
  }
  class FakeAudioContext {
    constructor() {
      this.state = "suspended";
      this.resumeCount = 0;
      audioContexts.push(this);
    }
    createAnalyser() {
      return { fftSize: 0, getByteTimeDomainData(values) { values.fill(128); } };
    }
    createMediaStreamSource() { return { connect() {} }; }
    async resume() { this.resumeCount++; this.state = "running"; }
    close() { this.state = "closed"; }
  }
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { mediaDevices: { getUserMedia: async () => ({ getTracks: () => tracks }) } }
  });
  globalThis.MediaRecorder = FakeMediaRecorder;
  window.MediaRecorder = FakeMediaRecorder;
  window.AudioContext = FakeAudioContext;

  // Use test helper to directly enter cloud listening (bypassing wake-word flow)
  app.testEnterFullListening("cloud");
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(browser.elements["voice-status"].textContent, "云端识别");
  assert.equal(recorders[0].state, "recording");
  assert.equal(audioContexts[0].resumeCount, 1);

  await app.handleCommand("画一个矩形");
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(recorders[0].state, "inactive");
  assert.equal(recorders.at(-1).state, "recording");

  browser.elements["listen-button"].click();
  assert.equal(tracks[0].stopped, true);
});

test("清空画布直接执行", async () => {
  resetApp();
  await app.handleCommand("画一个矩形");
  assert.equal(app.engine.state.objects.length, 1);
  await app.handleCommand("清空画布");
  assert.equal(app.engine.state.objects.length, 0);
});

test("删除指令直接执行", async () => {
  resetApp();
  await app.handleCommand("画一个矩形");
  assert.equal(app.engine.state.objects.length, 1);
  await app.handleCommand("删除它");
  assert.equal(app.engine.state.objects.length, 0);
});

test("未知本地指令回退模型并携带画布上下文", async () => {
  resetApp();
  app.engine.execute([{ type: "create", kind: "circle" }]);
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ actions: [{ type: "create", kind: "star" }] }) };
  };

  await app.handleCommand("来点模型才能理解的表达");
  assert.equal(request.url, "/api/parse");
  const body = JSON.parse(request.options.body);
  assert.equal(body.text, "来点模型才能理解的表达");
  assert.equal(body.context.objects[0].kind, "circle");
  assert.deepEqual(app.engine.state.objects.map(object => object.kind), ["circle", "star"]);
});

test("SVG 与 PNG 导出触发下载并为 PNG 绘制背景", async () => {
  resetApp();
  app.engine.execute([{ type: "canvas", operation: "background", color: "#111827" }]);
  app.render();

  app.download("svg");
  app.download("png");
  await new Promise(resolve => setTimeout(resolve, 0));

  assert.ok(browser.downloads.some(item => item.name?.startsWith("听画-") && item.name.endsWith(".svg")));
  assert.ok(browser.downloads.some(item => item.name?.startsWith("听画-") && item.name.endsWith(".png")));
  assert.deepEqual(browser.canvasCalls[0], ["fillRect", "#111827", 0, 0, 1000, 700]);
  assert.equal(browser.canvasCalls[1][0], "drawImage");
});

test("SVG 导出包含背景矩形", () => {
  resetApp();
  app.engine.execute([{ type: "canvas", operation: "background", color: "#ef4444" }]);
  app.render();

  const OriginalBlob = Blob;
  let capturedParts = null;
  globalThis.Blob = function(parts, options) {
    capturedParts = parts;
    return new OriginalBlob(parts, options);
  };

  app.download("svg");
  globalThis.Blob = OriginalBlob;

  assert.ok(capturedParts, "download 应创建 Blob");
  assert.match(capturedParts.join(""), /fill="#ef4444"/, "SVG 应包含表示背景色的 rect 元素");
});

test("SVG 导出白色背景时不添加多余背景矩形", () => {
  resetApp();
  app.engine.execute([{ type: "canvas", operation: "background", color: "#ffffff" }]);
  app.render();

  const OriginalBlob = Blob;
  let capturedParts = null;
  globalThis.Blob = function(parts, options) {
    capturedParts = parts;
    return new OriginalBlob(parts, options);
  };

  app.download("svg");
  globalThis.Blob = OriginalBlob;

  assert.ok(capturedParts, "download 应创建 Blob");
  assert.ok(!/<rect[^>]*fill="#ffffff"/.test(capturedParts.join("")), "默认白色背景不应添加多余的 rect");
});

test("选中图形和预览存在时导出源不含选择高亮或预览", () => {
  resetApp();
  app.engine.execute([{ type: "create", kind: "rect" }, { type: "select", target: "all" }]);
  app.render();
  browser.elements["preview-layer"].replaceChildren(new FakeElement("rect"));
  const OriginalBlob = Blob;
  let capturedParts = null;
  globalThis.Blob = function(parts, options) {
    capturedParts = parts;
    return new OriginalBlob(parts, options);
  };
  app.download("svg");
  globalThis.Blob = OriginalBlob;
  const source = capturedParts.join("");
  assert.doesNotMatch(source, /selection-glow/);
  assert.doesNotMatch(source, /preview-layer[^>]*><rect/);
});


// ── Phase 1: Hands-free Operation ─────────────────────────────

test("vosk_recognizer 模块导出 createVoskRecognizer API", async () => {
  const vosk = await import("../static/vosk_recognizer.js");
  assert.equal(typeof vosk.createVoskRecognizer, "function");
  assert.equal(typeof vosk.checkModelAvailability, "function");
  assert.equal(typeof vosk.downloadModel, "function");
  assert.equal(typeof vosk.deleteModel, "function");
  assert.equal(typeof vosk.VoskRecognizer, "function");
});

test("createVoskRecognizer 返回具有完整 API 的实例", async () => {
  const vosk = await import("../static/vosk_recognizer.js");
  const recognizer = vosk.createVoskRecognizer({
    onPartial: () => {},
    onFinal: () => {},
    onError: () => {},
    onStatus: () => {}
  });
  // The mock recognizer starts as unavailable without IndexedDB
  assert.equal(typeof recognizer.start, "function");
  assert.equal(typeof recognizer.stop, "function");
  assert.equal(typeof recognizer.feedAudio, "function");
  assert.equal(typeof recognizer.isReady, "function");
  assert.equal(typeof recognizer.getStatus, "function");
  assert.equal(typeof recognizer.destroy, "function");
  // Without IndexedDB, model is unavailable
  assert.equal(recognizer.isReady(), false);
  assert.equal(recognizer.getStatus(), "unavailable");
});

test("checkModelAvailability 在无 IndexedDB 时返回 available:false", async () => {
  const vosk = await import("../static/vosk_recognizer.js");
  const result = await vosk.checkModelAvailability();
  assert.equal(result.available, false);
  assert.equal(result.source, null);
});

test("VoskRecognizer feedAudio 接受 Float32Array 数据", async () => {
  const vosk = await import("../static/vosk_recognizer.js");
  const recognizer = vosk.createVoskRecognizer({});

  // feedAudio should not throw even when not ready (silently ignores)
  const audioData = new Float32Array([0.1, 0.2, -0.1, -0.3, 0.05]);
  assert.doesNotThrow(() => recognizer.feedAudio(audioData));
});

test("VoskRecognizer start/stop 在未就绪时安全处理", async () => {
  const vosk = await import("../static/vosk_recognizer.js");
  const recognizer = vosk.createVoskRecognizer({});

  // start when not ready should emit error via onError
  let errorMsg = null;
  recognizer.onError = (msg) => { errorMsg = msg; };
  recognizer.start();
  assert.equal(errorMsg, "离线识别器未就绪");

  // stop when not ready should not throw
  assert.doesNotThrow(() => recognizer.stop());
});

test("VoskRecognizer 使用 mock 行为产生最终结果", async () => {
  const vosk = await import("../static/vosk_recognizer.js");

  // Configure mock behavior
  globalThis.__mockVoskBehavior = {
    simulateResult: (audioBuffer) => {
      // Simulate returning a recognition result based on accumulated audio
      return "画一个矩形";
    },
    delay: 20
  };

  let finalResult = null;
  const recognizer = vosk.createVoskRecognizer({
    onFinal: (text) => { finalResult = text; }
  });

  // Wait for init to complete (it will be unavailable, but mock behavior works)
  await new Promise(resolve => setTimeout(resolve, 100));

  // Manually set ready for mock testing (bypass IndexedDB check)
  recognizer._ready = true;
  recognizer._status = "ready";

  recognizer.start();
  recognizer.feedAudio(new Float32Array([0.1, 0.2, 0.3, 0.1, 0.2]));
  recognizer.feedAudio(new Float32Array([-0.1, -0.2, 0.1, 0.15]));
  recognizer.stop();

  // Wait for mock delay
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(finalResult, "画一个矩形");

  // Clean up
  recognizer.destroy();
  delete globalThis.__mockVoskBehavior;
});

test("VoskRecognizer 使用 mock 产生中间结果", async () => {
  const vosk = await import("../static/vosk_recognizer.js");

  let partialResults = [];
  globalThis.__mockVoskBehavior = {
    simulatePartial: (audioData) => {
      // Return partial text when audio has content
      const sum = audioData.reduce((s, v) => s + Math.abs(v), 0);
      return sum > 0.1 ? `画一个${sum > 0.5 ? "红色的矩形" : "圆"}` : "";
    },
    minLevel: 0
  };

  const recognizer = vosk.createVoskRecognizer({
    onPartial: (text) => { partialResults.push(text); }
  });

  await new Promise(resolve => setTimeout(resolve, 100));

  recognizer._ready = true;
  recognizer._status = "ready";
  recognizer.start();

  recognizer.feedAudio(new Float32Array([0.1, 0.2, 0.3]));
  recognizer.feedAudio(new Float32Array([0.4, 0.5, 0.6, -0.2]));

  recognizer.stop();
  await new Promise(resolve => setTimeout(resolve, 50));

  assert.ok(partialResults.length >= 1, "should have at least one partial result");
  assert.ok(partialResults.some(t => t.includes("画")), "partial should contain recognition text");

  recognizer.destroy();
  delete globalThis.__mockVoskBehavior;
});

test("VoskRecognizer getStatus 返回正确状态字符串", async () => {
  const vosk = await import("../static/vosk_recognizer.js");
  const recognizer = vosk.createVoskRecognizer({});
  // Without IndexedDB, should be "unavailable"
  assert.equal(recognizer.getStatus(), "unavailable");
  assert.equal(recognizer.isReady(), false);
});

test("工程自动保存只在成功提交后更新并支持安全加载与丢弃", async () => {
  localStorage.clear();
  resetApp();
  await app.handleCommand("画一个矩形");
  const stored = localStorage.getItem("listen-paint-autosave-v1");
  assert.ok(stored);
  const saved = JSON.parse(stored);
  assert.equal(saved.state.objects.length, 1);
  await app.handleCommand("顶部对齐");
  assert.equal(localStorage.getItem("listen-paint-autosave-v1"), stored);

  const project = app.saveProjectData();
  app.engine.state = initialState();
  app.loadProjectData(project);
  assert.equal(app.engine.state.objects.length, 1);
  assert.throws(() => app.loadProjectData({ format: "listen-paint", version: 99 }));
  assert.equal(app.engine.state.objects.length, 1);
  await app.handleCommand("丢弃上次工程");
  assert.equal(localStorage.getItem("listen-paint-autosave-v1"), null);
});
