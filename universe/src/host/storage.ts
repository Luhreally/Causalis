// Save bytes and slots (docs/architecture §33). A save document becomes gzipped
// JSON through the platform's CompressionStream (Chrome, Firefox, Safari 16.4+,
// Node 18+). Each save name keeps two slots written alternately: the new save
// goes to the slot the index does not point at, is read back and checked, and
// only then does the index move — so a crash mid-write leaves the previous save
// intact, and a damaged latest save falls back to the one before.
import type { SaveMeta } from "../bridge/index.ts";
import { PIECE_MOST, SaveError, joinJson, splitJson, type SaveDocument } from "../kernel/index.ts";

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
  // (A preview build keeps its worlds apart from the game's on the same site: VITE_SAVE_DB at build.)
  constructor(name = import.meta.env?.VITE_SAVE_DB ?? "causalis-universe") {
    this.db = new Promise((resolve, reject) => {
      const open = indexedDB.open(name, 1);
      open.onupgradeneeded = () => open.result.createObjectStore("bytes");
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    // Opening may fail before the first save or listing asks for the database. Keep that
    // rejection handled; each request still receives it and can tell the viewer.
    void this.db.catch(() => {});
  }
  private async request<T>(
    mode: IDBTransactionMode,
    run: (s: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const db = await this.db;
    return new Promise((resolve, reject) => {
      const tx = db.transaction("bytes", mode),
        req = run(tx.objectStore("bytes"));
      // A successful request is not a committed transaction (quota or eviction can abort
      // it afterwards). Do not acknowledge a save until its transaction has completed.
      tx.oncomplete = () => resolve(req.result);
      tx.onabort = () => reject(tx.error ?? new SaveError("the save transaction was interrupted"));
      tx.onerror = () => reject(tx.error ?? req.error);
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

/** What a save written in pieces begins with (a save in one text begins "{"). */
const SPLIT_HEAD = "CAUSALIS-SPLIT 1\n";

/** Text sent to the gzip in runs of about this many characters, so that what is encoded at once stays small. */
const RUN = 4 * 1024 * 1024;

/**
 * A document's one JSON text, as JSON.stringify(doc) would write it, given out a part at a time: each store's text
 * on its own, so the whole is never one string (a far world's is hundreds of megabytes: held whole, then again as
 * bytes, it was most of what a save took of memory). Null where it is past `most` characters or a part of it is
 * longer than an engine's longest string: then it is written in pieces instead.
 */
async function wholeText(
  doc: SaveDocument,
  emit: (text: string) => Promise<void>,
  most: number,
): Promise<true | null> {
  let length = 0,
    sep = "{";
  const text = (value: unknown): string | undefined | null => {
      try {
        return JSON.stringify(value);
      } catch (error) {
        if (error instanceof RangeError) return null;
        throw error;
      }
    },
    put = async (t: string): Promise<boolean> => {
      length += t.length;
      if (length > most) return false;
      for (let at = 0; at < t.length; at += RUN) await emit(t.slice(at, at + RUN));
      return true;
    };
  for (const [key, value] of Object.entries(doc)) {
    const stores =
      key === "stores" && value !== null && typeof value === "object" && !Array.isArray(value);
    if (!stores) {
      const t = text(value);
      if (t === null) return null;
      // (As JSON leaves out what it has no text for.)
      if (t === undefined) continue;
      if (!(await put(`${sep}${JSON.stringify(key)}:${t}`))) return null;
      sep = ",";
      continue;
    }
    if (!(await put(`${sep}${JSON.stringify(key)}:`))) return null;
    sep = ",";
    let inner = "{";
    for (const [name, chunk] of Object.entries(value as Record<string, unknown>)) {
      const t = text(chunk);
      if (t === null) return null;
      if (t === undefined) continue;
      if (!(await put(`${inner}${JSON.stringify(name)}:${t}`))) return null;
      inner = ",";
    }
    if (!(await put(inner === "{" ? "{}" : "}"))) return null;
  }
  return (await put(sep === "{" ? "{}" : "}")) ? true : null;
}

/** What is written to a gzip, gathered: its writer, and the bytes once it is closed. */
function gzipped(): {
  write: (text: string) => Promise<void>;
  done: () => Promise<Uint8Array>;
  drop: () => Promise<void>;
} {
  const gzip = new CompressionStream("gzip"),
    out = new Response(gzip.readable).arrayBuffer(),
    writer = gzip.writable.getWriter(),
    encoder = new TextEncoder();
  // (A write let go of is told of by done's or drop's own.)
  void out.catch(() => {});
  return {
    write: (text) => writer.write(encoder.encode(text)),
    done: async () => {
      await writer.close();
      return new Uint8Array(await out);
    },
    drop: async () => {
      await writer.abort().catch(() => {});
    },
  };
}

/**
 * A save document as gzipped UTF-8 JSON: one text (JSON.stringify's, written a store at a time), or, where that
 * would be longer than an engine's longest string (or than `most`), a line saying so and then its pieces a line
 * each (kernel/split-json.ts), gzipped as they come.
 */
export async function encodeSave(doc: SaveDocument, most = PIECE_MOST * 4): Promise<Uint8Array> {
  const whole = gzipped();
  if (await wholeText(doc, whole.write, most)) return whole.done();
  await whole.drop();
  const split = gzipped();
  await split.write(SPLIT_HEAD);
  await splitJson(
    doc,
    async (piece) => {
      await split.write(piece);
      await split.write("\n");
    },
    Math.min(most, PIECE_MOST),
  );
  return split.done();
}

/** The document encodeSave wrote. */
export async function decodeSave(bytes: Uint8Array): Promise<SaveDocument> {
  let text: string;
  try {
    // (Text already, if a server that read a file's name took the gzip off on its way: "{" or a split save's "C".)
    const plain =
      bytes[0] === 123 || bytes[0] === 67
        ? bytes
        : await pipe(bytes, new DecompressionStream("gzip"));
    if (plain[0] === 67) return joinSplit(plain);
    text = new TextDecoder().decode(plain);
  } catch (error) {
    if (error instanceof SaveError) throw error;
    throw new SaveError(`the save's bytes do not decompress (${(error as Error).message})`);
  }
  try {
    return JSON.parse(text) as SaveDocument;
  } catch {
    throw new SaveError("the save's bytes are not a save document");
  }
}

/** A save written in pieces, read a line at a time: no text of it longer than a piece. */
function joinSplit(bytes: Uint8Array): SaveDocument {
  const decoder = new TextDecoder(),
    texts: string[] = [];
  let from = bytes.indexOf(10) + 1;
  if (!from || decoder.decode(bytes.subarray(0, from)) !== SPLIT_HEAD)
    throw new SaveError("the save's bytes are not a save document");
  while (from < bytes.length) {
    let to = bytes.indexOf(10, from);
    if (to < 0) to = bytes.length;
    if (to > from) texts.push(decoder.decode(bytes.subarray(from, to)));
    from = to + 1;
  }
  try {
    return joinJson(texts) as SaveDocument;
  } catch {
    throw new SaveError("the save's bytes are not a save document");
  }
}

/** Whether two runs of bytes are the same (a plain walk: a far world's save is tens of millions of them). */
function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

type SlotIndex = {
  latest: "a" | "b";
  count: number;
  meta?: Omit<SaveMeta, "name" | "count">;
  /** Each slot's towns kept apart (APART), by their chunk's hash (absent: kept in the slot). */
  apart?: { a?: string; b?: string };
};

/**
 * The towns entered and kept (town mode's places, host/place.ts PlaceStore): kept apart from the rest of a save (O1),
 * under a key of their own named by what they hold (their chunk's hash, as the save already reckons it). A save whose
 * towns are as they were when last saved writes none of them again: a world saved on and on, its towns left alone,
 * gzips only itself. Read back, they are put again where they were; a save whose towns' bytes are lost loads without
 * them, as a game without the store does (an outside reading: kernel/save.ts).
 */
const APART = "readings.places";
type ApartChunk = { readonly hash: string; readonly apart?: true; readonly data: unknown };

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
  private apartKey(hash: string): string {
    return this.key(`towns-${hash}`);
  }
  /** Write a save; returns its compressed size in bytes. */
  async write(whole: SaveDocument): Promise<number> {
    const index = await this.index(),
      slot: "a" | "b" = index?.latest === "a" ? "b" : "a",
      towns = whole.stores[APART] as ApartChunk | undefined;
    let doc = whole,
      apart: string | undefined,
      townBytes = 0;
    if (towns && towns.data !== null && towns.data !== undefined) {
      apart = towns.hash;
      const key = this.apartKey(apart);
      // (Written only where these very towns are not kept already: read back and checked, as the save is.)
      if (!(await this.store.get(key))) {
        // (Its chunk alone, in a document of nothing else.)
        const b = await encodeSave({ stores: { [APART]: whole.stores[APART]! } } as unknown as SaveDocument);
        await this.store.put(key, b);
        const back = await this.store.get(key);
        if (!back || !sameBytes(back, b))
          throw new SaveError("the save did not read back as written; the previous save is untouched");
        townBytes = b.length;
      }
      doc = {
        ...whole,
        stores: { ...whole.stores, [APART]: { ...whole.stores[APART]!, data: null, apart: true } },
      } as SaveDocument;
    }
    const bytes = await encodeSave(doc);
    await this.store.put(this.key(slot), bytes);
    const back = await this.store.get(this.key(slot));
    if (!back || !sameBytes(back, bytes))
      throw new SaveError("the save did not read back as written; the previous save is untouched");
    const next: SlotIndex = {
      latest: slot,
      count: (index?.count ?? 0) + 1,
      meta: {
        universe: String((doc.meta as { universe?: unknown } | undefined)?.universe ?? ""),
        seed: doc.seed,
        t: doc.t,
        bytes: bytes.length,
        rulesets: doc.lineage.length,
        savedAt: Date.now(),
      },
      apart: { ...index?.apart, [slot]: apart },
    };
    if (!apart) delete next.apart![slot];
    await this.store.put(this.key("index"), new TextEncoder().encode(JSON.stringify(next)));
    // (Towns no slot names any more let go.)
    const named = new Set(Object.values(next.apart ?? {}).filter(Boolean));
    for (const k of await this.store.keys())
      if (k.startsWith(this.key("towns-")) && !named.has(k.slice(this.key("towns-").length)))
        await this.store.delete(k);
    return bytes.length + townBytes;
  }
  /** A slot's save with its towns put back where they were kept apart (left out, where their bytes are lost). */
  private async whole(doc: SaveDocument): Promise<SaveDocument> {
    const towns = doc.stores[APART] as ApartChunk | undefined;
    if (!towns?.apart) return doc;
    const stores = { ...doc.stores };
    delete stores[APART];
    const bytes = await this.store.get(this.apartKey(towns.hash));
    if (bytes)
      try {
        const kept = (await decodeSave(bytes)).stores[APART];
        if (kept && (kept as ApartChunk).hash === towns.hash) stores[APART] = kept;
      } catch {
        // (Unreadable: the world loads without its towns.)
      }
    return { ...doc, stores } as SaveDocument;
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
        return {
          value: accept(await this.whole(await decodeSave(bytes))),
          slot,
          fellBack: slot !== index.latest,
        };
      } catch {
        continue;
      }
    }
    return null;
  }
  async remove(): Promise<void> {
    for (const part of ["a", "b", "index"]) await this.store.delete(this.key(part));
    for (const k of await this.store.keys())
      if (k.startsWith(this.key("towns-"))) await this.store.delete(k);
  }
}

/** Every save kept in a store, newest first. */
export async function listSaves(store: ByteStore): Promise<SaveMeta[]> {
  const out: SaveMeta[] = [];
  for (const key of await store.keys()) {
    const m = /^save\/(.+)\/index$/.exec(key);
    if (!m) continue;
    const bytes = await store.get(key);
    if (!bytes) continue;
    try {
      const index = JSON.parse(new TextDecoder().decode(bytes)) as SlotIndex;
      out.push({
        name: m[1]!,
        count: index.count,
        universe: index.meta?.universe ?? m[1]!.split(":")[0] ?? "",
        seed: index.meta?.seed ?? m[1]!.split(":")[1] ?? "",
        t: index.meta?.t ?? 0,
        bytes: index.meta?.bytes ?? 0,
        rulesets: index.meta?.rulesets ?? 1,
        savedAt: index.meta?.savedAt ?? 0,
      });
    } catch {
      // An index that does not read is not listed; its slots stay untouched.
    }
  }
  return out.sort((a, b) => b.savedAt - a.savedAt || (a.name < b.name ? -1 : 1));
}

/** Ask the browser not to evict saves (Safari clears unused sites' storage after 7 days otherwise). */
export async function requestPersistentStorage(): Promise<boolean> {
  const storage = (globalThis as { navigator?: { storage?: { persist?: () => Promise<boolean> } } })
    .navigator?.storage;
  return storage?.persist ? storage.persist() : false;
}
