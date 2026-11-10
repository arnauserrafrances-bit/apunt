// «Recorda'm en aquest dispositiu»: la clau de dades es guarda a IndexedDB, embolicada amb una clau
// WebCrypto que no es pot exportar (ni llegir des de fora del navegador). «Tanca la sessió» l'esborra.
const DB = "apunt-keys";
const STORE = "keys";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

interface Stored {
  userId: string;
  wrapper: CryptoKey;
  iv: Uint8Array;
  data: ArrayBuffer;
}

export async function rememberDataKey(userId: string, dataKey: Uint8Array): Promise<void> {
  try {
    const wrapper = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, wrapper, dataKey as BufferSource);
    await run("readwrite", (s) => s.put({ userId, wrapper, iv, data } satisfies Stored, "dataKey"));
  } catch {
    // Si el navegador no ho permet, només caldrà tornar a escriure la contrasenya.
  }
}

export async function recallDataKey(userId: string): Promise<Uint8Array | null> {
  try {
    const stored = (await run("readonly", (s) => s.get("dataKey"))) as Stored | undefined;
    if (!stored || stored.userId !== userId) return null;
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: stored.iv as BufferSource }, stored.wrapper, stored.data);
    return new Uint8Array(plain);
  } catch {
    return null;
  }
}

export async function forgetDataKey(): Promise<void> {
  try {
    await run("readwrite", (s) => s.delete("dataKey"));
  } catch {
    /* no hi havia res */
  }
}
