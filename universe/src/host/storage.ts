// Save bytes and slots (docs/architecture §33). A save document becomes gzipped
// JSON through the platform's CompressionStream (Chrome, Firefox, Safari 16.4+,
// Node 18+). Each save name keeps two slots written alternately: the new save
// goes to the slot the index does not point at, is read back and checked, and
// only then does the index move — so a crash mid-write leaves the previous save
// intact, and a damaged latest save falls back to the one before.
import { SaveError, type SaveDocument } from "../kernel/index.ts";

export interface ByteStore {
  get(key: string): Promise<Uint8Array | undefined>;
  put(key: string, bytes: Uint8Array): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

/** Bytes in memory (tests, and browsers where storage is refused). */
export class MemoryByteStore implements ByteStore {
  private readonly map = new Map<string, Uint8Array>();
  async get(key: string): Promise<Uint8Array | undefined> {
    const v = this.map.get(key);
    return v ? v.slice() : undefined;
  }
  async put(key: string, bytes: Uint8Array): Promise<void> {
    this.map.set(key, bytes.slice());
  }
  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }
  async keys(): Promise<string[]> {
    return [...this.map.keys()].sort();
  }
}

/** Bytes in IndexedDB (browsers and workers). */
export class IndexedDbByteStore implements ByteStore {
  private readonly db: Promise<IDBDatabase>;
  constructor(name = "causalis-universe") {
    this.db = new Promise((resolve, reject) => {
      const open = indexedDB.open(name, 1);
      open.onupgradeneeded = () => open.result.createObjectStore("bytes");
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
  }
  private async request<T>(
    mode: IDBTransactionMode,
    run: (s: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const db = await this.db;
    return new Promise((resolve, reject) => {
      const tx = db.transaction("bytes", mode),
        req = run(tx.objectStore("bytes"));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async get(key: string): Promise<Uint8Array | undefined> {
    const v = await this.request<unknown>("readonly", (s) => s.get(key));
    return v instanceof Uint8Array ? v : v instanceof ArrayBuffer ? new Uint8Array(v) : undefined;
  }
  async put(key: string, bytes: Uint8Array): Promise<void> {
    await this.request("readwrite", (s) => s.put(bytes, key));
  }
  async delete(key: string): Promise<void> {
    await this.request("readwrite", (s) => s.delete(key));
  }
  async keys(): Promise<string[]> {
    return (
      (await this.request<IDBValidKey[]>("readonly", (s) => s.getAllKeys())) as string[]
    ).sort();
  }
}

async function pipe(
  bytes: Uint8Array,
  stream: CompressionStream | DecompressionStream,
): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

/** A save document as gzipped UTF-8 JSON. */
export async function encodeSave(doc: SaveDocument): Promise<Uint8Array> {
  return pipe(new TextEncoder().encode(JSON.stringify(doc)), new CompressionStream("gzip"));
}

/** The document encodeSave wrote. */
export async function decodeSave(bytes: Uint8Array): Promise<SaveDocument> {
  let text: string;
  try {
    text = new TextDecoder().decode(await pipe(bytes, new DecompressionStream("gzip")));
  } catch (error) {
    throw new SaveError(`the save's bytes do not decompress (${(error as Error).message})`);
  }
  try {
    return JSON.parse(text) as SaveDocument;
  } catch {
    throw new SaveError("the save's bytes are not a save document");
  }
}

type SlotIndex = { latest: "a" | "b"; count: number };

/** Two alternating slots under one save name, with verified writes and fallback reads. */
export class SaveSlots {
  private readonly store: ByteStore;
  readonly name: string;
  constructor(store: ByteStore, name: string) {
    this.store = store;
    this.name = name;
  }
  private key(part: string): string {
    return `save/${this.name}/${part}`;
  }
  private async index(): Promise<SlotIndex | null> {
    const bytes = await this.store.get(this.key("index"));
    return bytes ? (JSON.parse(new TextDecoder().decode(bytes)) as SlotIndex) : null;
  }
  /** Write a save; returns its compressed size in bytes. */
  async write(doc: SaveDocument): Promise<number> {
    const index = await this.index(),
      slot: "a" | "b" = index?.latest === "a" ? "b" : "a",
      bytes = await encodeSave(doc);
    await this.store.put(this.key(slot), bytes);
    const back = await this.store.get(this.key(slot));
    if (!back || back.length !== bytes.length || back.some((b, i) => b !== bytes[i]))
      throw new SaveError("the save did not read back as written; the previous save is untouched");
    const next: SlotIndex = { latest: slot, count: (index?.count ?? 0) + 1 };
    await this.store.put(this.key("index"), new TextEncoder().encode(JSON.stringify(next)));
    return bytes.length;
  }
  /**
   * Read the latest save that decodes and passes `accept` (a caller's check, such
   * as loading it); falls back to the other slot. Returns null when neither does.
   */
  async read<T>(
    accept: (doc: SaveDocument) => T,
  ): Promise<{ value: T; slot: "a" | "b"; fellBack: boolean } | null> {
    const index = await this.index();
    if (!index) return null;
    const order: ("a" | "b")[] = index.latest === "a" ? ["a", "b"] : ["b", "a"];
    for (const slot of order) {
      const bytes = await this.store.get(this.key(slot));
      if (!bytes) continue;
      try {
        return { value: accept(await decodeSave(bytes)), slot, fellBack: slot !== index.latest };
      } catch {
        continue;
      }
    }
    return null;
  }
  async remove(): Promise<void> {
    for (const part of ["a", "b", "index"]) await this.store.delete(this.key(part));
  }
}

/** Ask the browser not to evict saves (Safari clears unused sites' storage after 7 days otherwise). */
export async function requestPersistentStorage(): Promise<boolean> {
  const storage = (globalThis as { navigator?: { storage?: { persist?: () => Promise<boolean> } } })
    .navigator?.storage;
  return storage?.persist ? storage.persist() : false;
}
