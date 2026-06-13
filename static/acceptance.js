export const ACCEPTANCE_STORAGE_KEY = "listen-paint-acceptance-v2";
export const ACCEPTANCE_COMMANDS = [
  "画一个红色圆形",
  "画一个蓝色矩形放在右边",
  "画一个文字，写上“你好”放在中央",
  "画一个房子，然后移动到右边",
  "画一个雪人，然后复制它",
  "画三个矩形，然后顶部对齐",
  "选择所有圆形",
  "选择所有图形",
  "把它改成绿色",
  "把它向下移动五十",
  "把它放大两倍",
  "把它旋转四十五",
  "顶部对齐",
  "横向均匀分布",
  "组合这些图形",
  "选择组合一",
  "撤销",
  "重做",
  "保存为 SVG",
  "保存为 PNG"
];

export function createAcceptanceState() {
  return {
    version: 2,
    updatedAt: null,
    environment: { browser: "", os: "", microphone: "", network: "", stt: "", operator: "" },
    records: ACCEPTANCE_COMMANDS.map((command, index) => ({
      index: index + 1,
      command,
      segmentId: null,
      transcript: "",
      success: null,
      override: null,
      localDurationMs: null,
      endToEndDurationMs: null,
      errorCode: "",
      notes: ""
    }))
  };
}

export function loadAcceptanceState(storage = globalThis.localStorage) {
  const stored = storage?.getItem?.(ACCEPTANCE_STORAGE_KEY);
  if (!stored) return createAcceptanceState();
  try {
    const parsed = JSON.parse(stored);
    if (parsed?.version !== 2 || !Array.isArray(parsed.records) || parsed.records.length !== ACCEPTANCE_COMMANDS.length) {
      return createAcceptanceState();
    }
    return parsed;
  } catch (_error) {
    return createAcceptanceState();
  }
}

export function saveAcceptanceState(state, storage = globalThis.localStorage) {
  state.updatedAt = new Date().toISOString();
  storage?.setItem?.(ACCEPTANCE_STORAGE_KEY, JSON.stringify(state));
  return state;
}

export function clearAcceptanceState(storage = globalThis.localStorage) {
  storage?.removeItem?.(ACCEPTANCE_STORAGE_KEY);
  return createAcceptanceState();
}

function recordForEvent(state, event) {
  if (event.segmentId != null) {
    const matched = state.records.find(record => record.segmentId === event.segmentId);
    if (matched) return matched;
  }
  return state.records.find(record => record.success == null && record.override == null) || state.records.at(-1);
}

export function applyAcceptanceEvent(state, event) {
  if (!event || !["segment-submitted", "transcription-completed", "command-completed", "error"].includes(event.type)) return state;
  const record = recordForEvent(state, event);
  if (!record) return state;
  if (event.segmentId != null) record.segmentId = event.segmentId;
  if (event.transcript) record.transcript = event.transcript;
  if (event.type === "command-completed") {
    record.success = event.success === true;
    record.localDurationMs = event.localDurationMs ?? null;
    record.endToEndDurationMs = event.endToEndDurationMs ?? null;
    record.errorCode = event.errorCode || "";
  }
  if (event.type === "error") {
    record.success = false;
    record.errorCode = event.errorCode || "unknown";
  }
  return state;
}

export function acceptanceSummary(state) {
  const decided = state.records.filter(record => record.override != null || record.success != null);
  const passed = decided.filter(record => record.override ?? record.success).length;
  return { passed, decided: decided.length, total: state.records.length };
}

export function acceptanceJson(state) {
  return JSON.stringify(state, null, 2);
}

export function acceptanceMarkdown(state) {
  const summary = acceptanceSummary(state);
  const env = Object.entries(state.environment).map(([key, value]) => `- ${key}: ${value || "待填写"}`).join("\n");
  const rows = state.records.map(record => {
    const result = record.override ?? record.success;
    return `| ${record.index} | ${record.command} | ${record.transcript || ""} | ${result == null ? "待测" : result ? "通过" : "失败"} | ${record.localDurationMs ?? ""} | ${record.endToEndDurationMs ?? ""} | ${record.errorCode || ""} |`;
  }).join("\n");
  return `# 听画真实语音验收报告

状态：人工验收阻塞，需在 Chrome/Edge 分别达到至少 18/20 后人工更新。

## 环境

${env}

## 汇总

- 通过：${summary.passed}/${summary.total}
- 已判定：${summary.decided}/${summary.total}

## 指令记录

| # | 标准指令 | 实际转写 | 结果 | 本地耗时(ms) | 端到端耗时(ms) | 错误分类 |
| ---: | --- | --- | --- | ---: | ---: | --- |
${rows}
`;
}

function downloadReport(content, name, type) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([content], { type }));
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function renderPanel(panel, state, storage) {
  const summary = acceptanceSummary(state);
  panel.querySelector("[data-summary]").textContent = `通过 ${summary.passed}/${summary.total}，已判定 ${summary.decided}/${summary.total}`;
  panel.querySelector("[data-records]").innerHTML = state.records.map(record => {
    const result = record.override ?? record.success;
    return `<li data-index="${record.index}">
      <strong>${record.index}. ${escapeHtml(record.command)}</strong>
      <span>转写：${escapeHtml(record.transcript || "待测")}</span>
      <span>结果：${result == null ? "待测" : result ? "通过" : "失败"} · 本地 ${record.localDurationMs ?? "-"}ms · 端到端 ${record.endToEndDurationMs ?? "-"}ms · ${record.errorCode || "无错误"}</span>
      <div><button type="button" data-result="pass">标为通过</button><button type="button" data-result="fail">标为失败</button></div>
    </li>`;
  }).join("");
  panel.querySelectorAll("[data-result]").forEach(button => {
    button.onclick = () => {
      const record = state.records[Number(button.closest("[data-index]").dataset.index) - 1];
      record.override = button.dataset.result === "pass";
      saveAcceptanceState(state, storage);
      renderPanel(panel, state, storage);
    };
  });
}

export function setupAcceptancePanel({ storage = globalThis.localStorage } = {}) {
  const state = loadAcceptanceState(storage);
  const panel = document.createElement("section");
  panel.id = "acceptance-panel";
  panel.className = "acceptance-panel";
  panel.innerHTML = `
    <div class="acceptance-heading"><div><p class="panel-kicker">真实语音验收</p><h2>云端模式 20 条指令</h2></div><strong data-summary></strong></div>
    <p>数据只保存在当前浏览器，不保存音频。按顺序说出下列指令，可人工修正结果。</p>
    <div class="acceptance-environment">
      ${Object.keys(state.environment).map(key => `<label>${key}<input data-environment="${key}" value="${escapeHtml(state.environment[key])}"></label>`).join("")}
    </div>
    <div class="acceptance-actions"><button type="button" data-export="json">导出 JSON</button><button type="button" data-export="markdown">导出 Markdown</button><button type="button" data-clear>清除验收数据</button></div>
    <ol data-records></ol>`;
  document.body.append(panel);
  panel.querySelectorAll("[data-environment]").forEach(input => {
    input.onchange = () => {
      state.environment[input.dataset.environment] = input.value;
      saveAcceptanceState(state, storage);
    };
  });
  panel.querySelector('[data-export="json"]').onclick = () => downloadReport(acceptanceJson(state), "听画-验收报告.json", "application/json");
  panel.querySelector('[data-export="markdown"]').onclick = () => downloadReport(acceptanceMarkdown(state), "听画-验收报告.md", "text/markdown");
  panel.querySelector("[data-clear]").onclick = () => {
    Object.assign(state, clearAcceptanceState(storage));
    renderPanel(panel, state, storage);
  };
  globalThis.addEventListener("listen-paint-acceptance", event => {
    applyAcceptanceEvent(state, event.detail);
    saveAcceptanceState(state, storage);
    renderPanel(panel, state, storage);
  });
  renderPanel(panel, state, storage);
  return { panel, state };
}
