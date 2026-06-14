const DB_NAME = "listen-paint-textures";
const STORE_NAME = "textures";
const memory = new Map();

function openDatabase() {
  if (!globalThis.indexedDB?.open) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(mode, operation) {
  const db = await openDatabase();
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const request = operation(db.transaction(STORE_NAME, mode).objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveTexture(cacheKey, texture) {
  if (typeof cacheKey !== "string" || !cacheKey || !texture || typeof texture.dataUrl !== "string") throw new Error("纹理缓存数据无效");
  memory.set(cacheKey, texture);
  await withStore("readwrite", store => store ? store.put(texture, cacheKey) : ({ onsuccess: null }));
  return texture;
}

export async function loadTexture(cacheKey) {
  if (!cacheKey) return null;
  if (memory.has(cacheKey)) return memory.get(cacheKey);
  const result = await withStore("readonly", store => store ? store.get(cacheKey) : ({ onsuccess: null, result: null }));
  if (result) memory.set(cacheKey, result);
  return result || null;
}

export async function removeTexture(cacheKey) {
  memory.delete(cacheKey);
  await withStore("readwrite", store => store ? store.delete(cacheKey) : ({ onsuccess: null }));
}

export function clearMemoryTextureCache() {
  memory.clear();
}
