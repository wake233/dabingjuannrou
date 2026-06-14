import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, styles, app, diagnostic] = await Promise.all([
  readFile(new URL("../static/index.html", import.meta.url), "utf8"),
  readFile(new URL("../static/styles.css", import.meta.url), "utf8"),
  readFile(new URL("../static/app.js", import.meta.url), "utf8"),
  readFile(new URL("../static/diagnostic.html", import.meta.url), "utf8")
]);

test("现代画室界面保留核心语音与画布接口", () => {
  for (const id of [
    "listen-button", "voice-status", "latency", "fallback-panel",
    "canvas-shell", "canvas", "drawing-layer", "preview-layer",
    "transcript", "feedback", "object-count", "selection-count", "object-list"
    ,"scene-summary", "scene-composition", "entity-list", "ignored-list",
    "undo-button", "redo-button", "clear-button", "export-button", "export-options"
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /class="studio-layout"/);
  assert.match(html, /class="workspace"/);
  assert.match(html, /1000 × 700/);
});

test("画布快捷工具栏提供历史、清空与三种导出入口", () => {
  assert.match(html, /data-export-format="svg"/);
  assert.match(html, /data-export-format="png"/);
  assert.match(html, /data-export-format="project"/);
  assert.match(app, /executeToolbarAction/);
  assert.match(app, /event\.key === "Escape"/);
  assert.match(styles, /\.canvas-actions/);
  assert.match(styles, /\.export-options/);
});

test("主界面提供绘本场景说明、实体和忽略内容区域", () => {
  assert.match(html, /创作说明/);
  assert.match(html, /语义实体/);
  assert.match(html, /忽略内容/);
  assert.match(styles, /\.scene-card/);
});

test("界面包含响应式、键盘焦点与减少动态效果支持", () => {
  assert.match(styles, /button:focus-visible/);
  assert.match(styles, /@media \(max-width: 850px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});

test("语音按钮同步可访问性状态", () => {
  assert.match(app, /setAttribute\("aria-pressed", String\(listeningWanted\)\)/);
  assert.match(app, /setAttribute\("aria-label", listeningWanted \?/);
});

test("普通模式不静态显示验收台，诊断页提供验收模式入口", () => {
  assert.doesNotMatch(html, /id="acceptance-panel"/);
  assert.match(app, /get\("acceptance"\) === "1"/);
  assert.match(app, /import\("\.\/acceptance\.js"\)/);
  assert.match(diagnostic, /\/\?acceptance=1/);
  assert.match(styles, /\.acceptance-panel/);
});
