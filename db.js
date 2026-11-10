// Tiny IndexedDB wrapper for big binary data (voice notes + screenshots).
// Everything else (subjects, tasks, text notes…) lives in localStorage via store.jsx.

const DB_NAME = 'study-planner';
const STORE = 'blobs';
let dbPromise = null;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function run(mode, fn) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(req ? req.result : undefined);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

export const putBlob = (id, blob) => run('readwrite', (s) => s.put(blob, id));
export const getBlob = (id) => run('readonly', (s) => s.get(id));
export const deleteBlob = (id) => run('readwrite', (s) => s.delete(id));

// Ask the browser not to evict our data when disk space is low.
export const requestPersistence = () => {
  try {
    navigator.storage?.persist?.();
  } catch {
    /* ignore */
  }
};

// ---------- backup / restore (one JSON file with everything, media included) ----------
const toDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

export async function exportBackup(state) {
  const ids = new Set();
  state.topics.forEach((t) => {
    if (t.audioId) ids.add(t.audioId);
    (t.imageIds || []).forEach((i) => ids.add(i));
  });
  const media = {};
  for (const id of ids) {
    const blob = await getBlob(id);
    if (blob) media[id] = await toDataUrl(blob);
  }
  const payload = { app: 'study-planner', version: 1, exportedAt: new Date().toISOString(), state, media };
  return new Blob([JSON.stringify(payload)], { type: 'application/json' });
}

export async function importBackup(file) {
  const data = JSON.parse(await file.text());
  if (data.app !== 'study-planner' || !data.state) throw new Error('Not a Study Planner backup file');
  for (const [id, url] of Object.entries(data.media || {})) {
    const blob = await (await fetch(url)).blob();
    await putBlob(id, blob);
  }
  return data.state;
}
