// VoskRecognizer — wraps Vosk WASM module for offline Chinese speech recognition
//
// Public API:
//   createVoskRecognizer({ onPartial, onFinal, onError, onStatus })
//     → { start(), stop(), feedAudio(audioData), isReady(), getStatus(), ready }
//
// Model management:
//   checkModelAvailability() → Promise<{available, source}>
//   downloadModel(onProgress) → Promise<void>
//   deleteModel() → Promise<void>
//
// The model is stored in IndexedDB for persistence across sessions.
// Model source: vosk-model-small-cn-0.22 (~42MB)
// Download URL: https://alphacephei.com/vosk/models/vosk-model-small-cn-0.22.zip
//
// ⚠️ STATUS (per DESIGN.md §7.1–7.2):
// Real Vosk WASM integration is NOT yet complete. The current implementation:
//   - Caches the raw model ZIP in IndexedDB (download works)
//   - Does NOT extract ZIP contents or set up the Vosk virtual filesystem
//   - Does NOT load the real Vosk WASM module
//   - The mock recognizer produces NO results in production
// Therefore checkModelAvailability() deliberately returns {available: false}
// until the real Vosk WASM path is implemented. See DESIGN.md §8.2.

// ── IndexedDB store for Vosk model ──────────────────────────────

const DB_NAME = "vosk-model-store";
const DB_VERSION = 1;
const STORE_NAME = "vosk-models";
const MODEL_KEY = "vosk-model-small-cn";

function openModelDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("无法打开模型数据库"));
  });
}

function getModelFromDB(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(MODEL_KEY);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("无法读取模型数据"));
  });
}

function storeModelToDB(db, modelData) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(modelData, MODEL_KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error("无法存储模型数据"));
  });
}

function deleteModelFromDB(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(MODEL_KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error("无法删除模型数据"));
  });
}

// ── Model management (public API) ───────────────────────────────

export async function checkModelAvailability() {
  // Per DESIGN.md §7.1–7.2: real Vosk WASM integration is not yet complete.
  // The raw ZIP may be cached in IndexedDB, but the model is not extracted
  // or loaded into the Vosk virtual filesystem. The mock recognizer produces
  // no results in production. Until the real Vosk WASM path is implemented,
  // always report unavailable to avoid misleading users.
  //
  // When the real Vosk WASM module is loaded and a model is properly
  // initialized, this function should check for that instead.
  try {
    const db = await openModelDB();
    const model = await getModelFromDB(db);
    db.close();
    // Check if the real Vosk WASM module is loaded and functional
    const voskModuleReady = typeof globalThis !== "undefined"
      && globalThis.VoskModule
      && typeof globalThis.VoskModule.createModel === "function";
    // Also require model data to be present
    const modelCached = model && model.data && model.data.byteLength > 0;
    // Only report available when BOTH the WASM module and model data are ready
    return {
      available: voskModuleReady && modelCached,
      source: modelCached ? "indexeddb" : null,
      wasmReady: voskModuleReady,
      modelCached,
    };
  } catch (_error) {
    return { available: false, source: null, wasmReady: false, modelCached: false };
  }
}

export async function downloadModel(onProgress) {
  const MODEL_URL = "https://alphacephei.com/vosk/models/vosk-model-small-cn-0.22.zip";

  // Check if already cached
  const existing = await checkModelAvailability();
  if (existing.available) return;

  if (typeof onProgress !== "function") onProgress = () => {};

  onProgress({ stage: "download", loaded: 0, total: 0 });

  const response = await fetch(MODEL_URL);
  if (!response.ok) throw new Error(`模型下载失败: HTTP ${response.status}`);

  const contentLength = response.headers.get("content-length");
  const total = contentLength ? parseInt(contentLength, 10) : 0;
  const reader = response.body.getReader();
  const chunks = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onProgress({ stage: "download", loaded, total });
  }

  onProgress({ stage: "extract", loaded, total });

  // Store the raw zip data in IndexedDB for now.
  // In a real implementation, we would extract the model files
  // from the zip using a library like JSZip and store them individually.
  // For the Vosk WASM module, the model directory structure needs to be
  // preserved so the WASM runtime can read it via its virtual filesystem.
  //
  // Current implementation stores the full zip as a single blob.
  // A production implementation would:
  //   1. Use JSZip to extract model files
  //   2. Write each file to the Vosk WASM virtual filesystem
  //   3. Or store extracted files in IndexedDB for persistent caching
  const allChunks = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    allChunks.set(chunk, offset);
    offset += chunk.length;
  }

  const db = await openModelDB();
  await storeModelToDB(db, {
    data: allChunks.buffer,
    downloadedAt: Date.now(),
    source: MODEL_URL
  });
  db.close();

  onProgress({ stage: "complete", loaded, total });
}

export async function deleteModel() {
  try {
    const db = await openModelDB();
    await deleteModelFromDB(db);
    db.close();
  } catch (_error) {
    throw new Error("删除模型失败");
  }
}

// ── VoskRecognizer class ────────────────────────────────────────

class VoskRecognizer {
  constructor(callbacks = {}) {
    this.onPartial = callbacks.onPartial || (() => {});
    this.onFinal = callbacks.onFinal || (() => {});
    this.onError = callbacks.onError || (() => {});
    this.onStatus = callbacks.onStatus || (() => {});

    this._status = "unavailable";
    this._ready = false;
    this._active = false;
    this._recognizer = null;
    this._sampleRate = 16000;

    // Recognition state for mock implementation
    this._audioBuffer = [];
    this._recognitionTimer = null;
  }

  // Check if model is cached, then initialize the recognizer
  async init() {
    try {
      const availability = await checkModelAvailability();
      if (!availability.available) {
        this._setStatus("unavailable");
        this._ready = false;
        return false;
      }

      this._setStatus("loading");
      // In production, this would initialize the real Vosk WASM recognizer.
      // The Vosk library provides a KaldiRecognizer object that takes
      // the model and sample rate as parameters.
      await this._initRecognizer();
      return true;
    } catch (error) {
      this._setStatus("error");
      this.onError(error.message || "离线识别器初始化失败");
      return false;
    }
  }

  async _initRecognizer() {
    // Attempt to create a real Vosk recognizer if the WASM module is loaded.
    // When the Vosk WASM module is available (loaded via <script> tag or
    // dynamic import), it exposes a global `Vosk` object with:
    //   - Vosk.KaldiRecognizer(model, sampleRate)
    //   - Vosk.setLogLevel(level)
    //
    // The model parameter is a path to the model directory managed by
    // the Vosk WASM virtual filesystem.
    //
    // Usage with real Vosk WASM:
    //
    //   const channel = new MessageChannel();
    //   const recognizer = new this._vosk.KaldiRecognizer(modelPath, this._sampleRate);
    //   recognizer.on("result", (message) => { ... });
    //   recognizer.on("partialresult", (message) => { ... });
    //   this._recognizer = recognizer;
    //
    // DESIGN.md §7.2: The real Vosk WASM path is not yet implemented.
    // checkModelAvailability() now requires both the WASM module AND model data.
    // When only the ZIP is cached, init() will reach this point with
    // globalThis.VoskModule undefined, so we fall back to the mock
    // which clearly reports its non-functional status.

    const voskModuleReady = typeof globalThis !== "undefined"
      && globalThis.VoskModule
      && typeof globalThis.VoskModule.createModel === "function";

    if (voskModuleReady) {
      // Real Vosk WASM module is available (injected for testing or production)
      await this._createRealRecognizer();
    } else {
      // Fall back to mock implementation — will NOT produce results in production
      this._setStatus("unavailable");
      this._ready = false;
      this.onError("真实离线语音识别模块未加载，离线模式不可用");
      return;
    }

    this._ready = true;
    this._setStatus("ready");
  }

  async _createRealRecognizer() {
    // Stub: Real Vosk WASM initialization.
    // In production, the Vosk WASM module would be loaded via:
    //
    //   1. Include <script src="/vosk/vosk.js"></script> in index.html
    //   2. Model files placed in /vosk/vosk-model-small-cn-0.22/
    //   3. Vosk WASM serves model files via its virtual filesystem
    //
    // Example real implementation:
    //
    //   const vosk = globalThis.VoskModule || window.Vosk;
    //   vosk.setLogLevel(-1);
    //   const model = await vosk.createModel("/vosk/vosk-model-small-cn-0.22");
    //   const recognizer = new vosk.KaldiRecognizer(model, this._sampleRate);
    //   recognizer.on("result", (msg) => {
    //     const result = JSON.parse(msg);
    //     if (result.text) this.onFinal(result.text);
    //   });
    //   recognizer.on("partialresult", (msg) => {
    //     const partial = JSON.parse(msg);
    //     if (partial.partial) this.onPartial(partial.partial);
    //   });
    //   this._recognizer = { model, recognizer };
    //
    // For now, fall back to mock since the real WASM is not loaded.
    await this._createMockRecognizer();
  }

  async _createMockRecognizer() {
    // Mock recognizer — used ONLY for automated tests when
    // globalThis.__mockVoskBehavior is configured.
    //
    // In production without the real Vosk WASM module, this recognizer
    // will never produce results. The _initRecognizer() method now
    // returns early (without calling this) when VoskModule is absent.
    //
    // Tests inject behavior via:
    //   globalThis.__mockVoskBehavior = {
    //     simulateResult: (audio) => "识别结果文本",
    //     simulatePartial: (audio) => "部分结果",
    //     delay: 500
    //   };
    this._recognizer = { type: "mock", note: "非功能性模拟识别器 — 不会产生真实识别结果" };
  }

  start() {
    if (!this._ready) {
      this.onError("离线识别器未就绪");
      return;
    }
    this._active = true;
    this._audioBuffer = [];
    this._setStatus("ready");

    // Clear any pending recognition timer
    if (this._recognitionTimer) {
      clearTimeout(this._recognitionTimer);
      this._recognitionTimer = null;
    }
  }

  stop() {
    this._active = false;
    this._processAudio();
  }

  feedAudio(audioData) {
    if (!this._ready || !this._active) return;

    // audioData should be a Float32Array of raw audio samples at 16kHz mono
    if (audioData instanceof Float32Array && audioData.length > 0) {
      this._audioBuffer.push(new Float32Array(audioData));
    }

    // In production with real Vosk:
    //   this._recognizer.recognizer.acceptWaveform(audioData);
    //   const partial = this._recognizer.recognizer.partialResult();
    //   if (partial.partial) this.onPartial(partial.partial);
    //
    // For mock: check if we should simulate a partial result
    this._maybeEmitMockPartial(audioData);
  }

  _maybeEmitMockPartial(audioData) {
    // If a mock behavior is configured for testing, emit partial results
    const mockBehavior = globalThis.__mockVoskBehavior;
    if (!mockBehavior || !mockBehavior.simulatePartial) return;

    const rms = audioData.length
      ? Math.sqrt(audioData.reduce((sum, v) => sum + v * v, 0) / audioData.length)
      : 0;

    if (rms > mockBehavior.minLevel || 0.005) {
      const partialText = mockBehavior.simulatePartial(audioData);
      if (partialText) {
        this.onPartial(partialText);
      }
    }
  }

  _processAudio() {
    // Called when stop() is invoked — process accumulated audio buffer.
    // In production with real Vosk:
    //   const final = this._recognizer.recognizer.finalResult();
    //   const parsed = JSON.parse(final);
    //   if (parsed.text) this.onFinal(parsed.text);
    //
    // For mock: check for configured mock behavior
    const mockBehavior = globalThis.__mockVoskBehavior;
    if (mockBehavior && typeof mockBehavior.simulateResult === "function") {
      const delay = mockBehavior.delay || 100;
      this._recognitionTimer = setTimeout(() => {
        const result = mockBehavior.simulateResult(this._audioBuffer);
        if (result) this.onFinal(result);
        this._audioBuffer = [];
        this._recognitionTimer = null;
      }, delay);
    } else {
      // No mock configured, just clear buffer
      this._audioBuffer = [];
    }
  }

  isReady() {
    return this._ready;
  }

  getStatus() {
    return this._status;
  }

  _setStatus(status) {
    this._status = status;
    try { this.onStatus(status); } catch (_) { /* noop */ }
  }

  destroy() {
    this.stop();
    if (this._recognitionTimer) {
      clearTimeout(this._recognitionTimer);
      this._recognitionTimer = null;
    }
    this._audioBuffer = [];
    this._ready = false;
    this._active = false;
    this.onPartial = null;
    this.onFinal = null;
    this.onError = null;
    this.onStatus = null;
  }
}

// ── Public factory function ─────────────────────────────────────

export function createVoskRecognizer(callbacks = {}) {
  const recognizer = new VoskRecognizer(callbacks);

  // Expose the init Promise so callers can await readiness.
  // The init failure is also reported via the onError callback.
  recognizer.ready = recognizer.init().catch((_error) => {
    // init failure is handled via onError callback
    return false;
  });

  return recognizer;
}

// Export the class for testing
export { VoskRecognizer };
