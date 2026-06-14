import test from "node:test";
import assert from "node:assert/strict";
import { DrawingEngine } from "../static/model.js";
import { clearMemoryTextureCache, loadTexture, removeTexture, saveTexture } from "../static/texture_cache.js";

test("纹理元数据作为受约束动作保存、撤销、移除并恢复", () => {
  const engine = new DrawingEngine();
  const apply = { type: "texture", operation: "apply", prompt: "soft paper", model: "cloud-texture",
    cacheKey: "texture-safe", mimeType: "image/png", width: 1000, height: 700 };
  engine.execute([apply]);
  assert.equal(engine.state.art.texture.status, "ready");
  assert.equal(engine.serializeProject().state.art.texture.cacheKey, "texture-safe");
  engine.undo();
  assert.equal(engine.state.art.texture.status, "none");
  engine.redo();
  engine.execute([{ type: "texture", operation: "remove" }]);
  assert.equal(engine.state.art.texture.status, "none");
  assert.throws(() => engine.execute([{ ...apply, mimeType: "image/svg+xml" }]));
});

test("纹理缓存缺失时可回退且显式移除", async () => {
  clearMemoryTextureCache();
  assert.equal(await loadTexture("missing"), null);
  const texture = { dataUrl: "data:image/png;base64,AA==", mimeType: "image/png", width: 1, height: 1 };
  await saveTexture("texture-one", texture);
  assert.deepEqual(await loadTexture("texture-one"), texture);
  await removeTexture("texture-one");
  assert.equal(await loadTexture("texture-one"), null);
});
