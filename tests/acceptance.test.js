import test from "node:test";
import assert from "node:assert/strict";
import {
  ACCEPTANCE_COMMANDS,
  ACCEPTANCE_STORAGE_KEY,
  acceptanceJson,
  acceptanceMarkdown,
  acceptanceSummary,
  applyAcceptanceEvent,
  clearAcceptanceState,
  createAcceptanceState,
  loadAcceptanceState,
  saveAcceptanceState
} from "../static/acceptance.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
}

test("验收台包含 20 条云端标准指令并按指标事件记录结果", () => {
  const state = createAcceptanceState();
  assert.equal(ACCEPTANCE_COMMANDS.length, 20);
  assert.equal(ACCEPTANCE_COMMANDS[5], "画三个矩形，然后顶部对齐");
  applyAcceptanceEvent(state, { type: "segment-submitted", segmentId: 3 });
  applyAcceptanceEvent(state, { type: "transcription-completed", segmentId: 3, transcript: "画一个红色圆形" });
  applyAcceptanceEvent(state, { type: "command-completed", segmentId: 3, success: true, localDurationMs: 12, endToEndDurationMs: 650 });
  assert.deepEqual(state.records[0], {
    index: 1,
    command: "画一个红色圆形",
    segmentId: 3,
    transcript: "画一个红色圆形",
    success: true,
    override: null,
    localDurationMs: 12,
    endToEndDurationMs: 650,
    errorCode: "",
    notes: ""
  });
  assert.deepEqual(acceptanceSummary(state), { passed: 1, decided: 1, total: 20 });
});

test("验收记录仅在传入浏览器存储中持久化并可清除", () => {
  const storage = memoryStorage();
  const state = createAcceptanceState();
  state.environment.browser = "Chrome";
  state.records[0].override = false;
  saveAcceptanceState(state, storage);
  assert.ok(storage.getItem(ACCEPTANCE_STORAGE_KEY));
  assert.equal(loadAcceptanceState(storage).environment.browser, "Chrome");
  assert.equal(loadAcceptanceState(storage).records[0].override, false);
  const cleared = clearAcceptanceState(storage);
  assert.equal(storage.getItem(ACCEPTANCE_STORAGE_KEY), null);
  assert.equal(cleared.records.length, 20);
});

test("版本 2 验收数据迁移时保留指令结果并补充会话指标", () => {
  const storage = memoryStorage();
  const oldState = createAcceptanceState();
  oldState.version = 2;
  delete oldState.session;
  oldState.records[0].success = true;
  storage.setItem(ACCEPTANCE_STORAGE_KEY, JSON.stringify(oldState));

  const migrated = loadAcceptanceState(storage);
  assert.equal(migrated.version, 3);
  assert.equal(migrated.records[0].success, true);
  assert.equal(migrated.session.recoveryAttempts, 0);
});

test("JSON 与 Markdown 验收报告包含环境和结果且不包含音频", () => {
  const state = createAcceptanceState();
  state.environment.browser = "Edge";
  state.records[0].transcript = "画一个红色圆形";
  state.records[0].success = true;
  const json = acceptanceJson(state);
  const markdown = acceptanceMarkdown(state);
  assert.match(json, /"browser": "Edge"/);
  assert.match(markdown, /通过：1\/20/);
  assert.match(markdown, /人工验收阻塞/);
  assert.doesNotMatch(json + markdown, /audio|blob|音频内容/);
});

test("验收台记录会话中断、自动恢复与会话时长", () => {
  const state = createAcceptanceState();
  applyAcceptanceEvent(state, { type: "session-started", sessionStartedAt: "2026-06-14T00:00:00.000Z" });
  applyAcceptanceEvent(state, { type: "session-interrupted", reason: "microphone_track_ended", sessionDurationMs: 1200 });
  applyAcceptanceEvent(state, { type: "recovery-attempted", recoveryCount: 1 });
  applyAcceptanceEvent(state, { type: "recovery-completed", recoveryCount: 1, success: true });
  applyAcceptanceEvent(state, { type: "session-ended", reason: "user_stopped", sessionDurationMs: 3000 });

  assert.deepEqual(state.session, {
    startedAt: "2026-06-14T00:00:00.000Z",
    durationMs: 3000,
    interruptionCount: 1,
    recoveryAttempts: 1,
    recoverySuccesses: 1,
    lastInterruptionReason: "microphone_track_ended",
    endedReason: "user_stopped"
  });
  assert.match(acceptanceMarkdown(state), /自动恢复：1\/1/);
});
