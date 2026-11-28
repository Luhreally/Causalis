// Saves (docs/architecture §33). A save document holds what the seed cannot
// regenerate: the minter, the scheduler and its agenda, every registered store
// (each with its schema version and its own hash), the checkpoint chain, and the
// ruleset it was made under. Loading builds a fresh world from the seed with the
// app's own builder (which registers the same systems and stores), migrates any
// store whose schema has moved on, loads every store, and proves the result by
// recomputing each domain's hash.
//
// Bytes, compression and storage slots are the host's business (host/storage.ts);
// this file only turns a world into plain data and back. A store that keeps long lists
// of records asks to be saved packed by column (StateStore.packed, kernel/pack.ts): what
// it loads is what it saved, as JSON would have given it back.
import { Hasher } from "./hash.ts";
import { eventTypes } from "./history.ts";
import { packList, packListSteps, unpackList, type Packed } from "./pack.ts";
import { jsonCopy } from "./split-json.ts";
import { kinds } from "./ref.ts";
import { seedFromText, streams, type Seed } from "./rng.ts";
import type { AgendaItem } from "./schedule.ts";
import type { Checkpoint, World } from "./world.ts";

/** 2: a store may be kept packed by column (a save of format 1 keeps every store as it is). */
export const SAVE_FORMAT = 3;
const FORMATS: readonly number[] = [1, 2, 3];

export type StoreChunk = {
  readonly schema: number;
  readonly data: unknown;
  readonly hash: string;
  /** The store's save packed by column (packList of it alone), as a store of long lists asks. */
  readonly packed?: true;
  /** A reading kept beside the world (StateStore.outsideRules): a game without it lets it go. */
  readonly outside?: true;
};

/** What a store saved, from its chunk (unpacked if it was packed): for reading a save as it is. */
export function chunkData(chunk: StoreChunk): unknown {
  return chunk.packed ? unpackList(chunk.data as Packed)[0] : chunk.data;
}

export type SaveDocument = {
  readonly format: number;
  readonly ruleset: string;
  /** Every ruleset this history has run under, from the moment it took over. */
  readonly lineage: readonly { readonly ruleset: string; readonly from: number }[];
  readonly seed: string;
  readonly t: number;
  readonly minter: readonly (readonly [string, number])[];
  readonly scheduler: {
    readonly time: number;
    readonly seq: number;
    readonly agenda: readonly AgendaItem[];
  };
  readonly stores: Readonly<Record<string, StoreChunk>>;
  readonly checkpoints: readonly Checkpoint[];
  /** Domain hashes at the moment of saving: what loading must reproduce. */
  readonly hashes: readonly (readonly [string, string])[];
  /** Presentation data from the app (a name, a thumbnail, when it was saved). Not hashed. */
  readonly meta: Readonly<Record<string, unknown>>;
};

type Migration = (data: unknown) => unknown;
const MIGRATIONS = new Map<string, Migration>();

/** Upgrade a store's saved data from schema `from` to `from + 1`. */
export function defineMigration(store: string, from: number, migrate: Migration): void {
  const key = `${store}@${from}`;
  if (MIGRATIONS.has(key)) throw new Error(`migration ${key} is defined twice`);
  MIGRATIONS.set(key, migrate);
}

function schemaOf(store: { readonly schema?: number }): number {
  return store.schema ?? 1;
}

/**
 * A store's chunk's hash: of the JSON text it was written as, told by a "j" before it (the text is at hand as a
 * save is made, and its hash is a straight run over it where the value's is a walk of every list and key); else
 * of its value, as every save before 2026-11-15 has it and a store too large for one text does.
 */
function chunkHash(data: unknown, text?: string): string {
  return text === undefined
    ? new Hasher().value(data).hex()
    : `j${new Hasher().string(text).hex()}`;
}

/** Whether a chunk's data is what its hash says, as it was hashed. */
function chunkHolds(chunk: StoreChunk): boolean {
  if (!chunk.hash.startsWith("j")) return chunkHash(chunk.data) === chunk.hash;
  let text: string;
  try {
    text = JSON.stringify(chunk.data);
  } catch (error) {
    if (error instanceof RangeError) return false;
    throw error;
  }
  return chunkHash(chunk.data, text) === chunk.hash;
}

/**
 * The ruleset a world runs under: a hash of the app's version and of every
 * registry that shapes history (kinds, streams, event types, commands, agenda
 * handlers, systems, stores and their schemas).
 */
export function rulesetId(world: World, appVersion: string): string {
  const h = new Hasher().string(appVersion);
  for (const k of kinds()) h.string(k.code).string(k.origin);
  for (const s of streams()) h.string(s.tag).int(s.version);
  for (const e of eventTypes()) h.string(e.type).int(e.importance);
  for (const c of world.commands.types()) h.string(c);
  for (const t of world.scheduler.handlerTypes()) h.string(t);
  for (const key of world.scheduler.systemKeys()) h.string(key);
  // (Not a reading kept beside the world: it shapes nothing.)
  for (const name of world.storeNames())
    if (!world.store(name).outsideRules) h.string(name).int(schemaOf(world.store(name)));
  return h.hex();
}

/**
 * A store's state as JSON keeps it. (Copied without its text where the text would be longer than an engine's longest
 * string: a world of 162 million people could not be kept for that, 2026-11-13.)
 */
/**
 * throughJson a part at a time, a step after each: an object's or a short list's parts, a few levels down, each written and read
 * back on its own and the texts joined as JSON joins them (what JSON.stringify gives, letter for letter). A packed store is a
 * few such levels over its columns, and history's events were written and read back in one step of a tenth of a second late.
 */
function* throughJsonSteps(
  value: unknown,
): Generator<void, { data: unknown; text?: string }, void> {
  try {
    return yield* jsonSteps(value, JSON_LEVELS);
  } catch (error) {
    if (error instanceof RangeError) return { data: jsonCopy(value) };
    throw error;
  }
}

/** How far down throughJsonSteps goes, and the most parts a thing may have for it to go into them. */
const JSON_LEVELS = 4,
  JSON_PARTS = 64;

function* jsonSteps(
  value: unknown,
  levels: number,
): Generator<void, { data: unknown; text?: string }, void> {
  const parts =
    levels > 0 && value !== null && typeof value === "object"
      ? Array.isArray(value)
        ? value.length <= JSON_PARTS
          ? value
          : null
        : typeof (value as { toJSON?: unknown }).toJSON !== "function" &&
            Object.getPrototypeOf(value) === Object.prototype
          ? Object.keys(value)
          : null
      : null;
  if (
    !parts ||
    (!Array.isArray(value) && (parts as string[]).includes("__proto__")) ||
    parts.length > JSON_PARTS
  ) {
    const text = JSON.stringify(value) as string | undefined;
    yield;
    return text === undefined ? { data: undefined } : { data: JSON.parse(text) as unknown, text };
  }
  if (Array.isArray(value)) {
    const texts: string[] = [],
      data = new Array<unknown>(value.length);
    for (let i = 0; i < value.length; i++) {
      const r = yield* jsonSteps(value[i], levels - 1);
      texts.push(r.text ?? "null");
      data[i] = r.text === undefined ? null : r.data;
    }
    return { data, text: `[${texts.join(",")}]` };
  }
  const texts: string[] = [],
    data: Record<string, unknown> = {};
  for (const key of parts as string[]) {
    const r = yield* jsonSteps((value as Record<string, unknown>)[key], levels - 1);
    if (r.text === undefined) continue;
    texts.push(`${JSON.stringify(key)}:${r.text}`);
    data[key] = r.data;
  }
  return { data, text: `{${texts.join(",")}}` };
}

function throughJson(value: unknown): { data: unknown; text?: string } {
  let text: string;
  try {
    text = JSON.stringify(value);
  } catch (error) {
    if (error instanceof RangeError) return { data: jsonCopy(value) };
    throw error;
  }
  return { data: JSON.parse(text) as unknown, text };
}

/** The least a store's JSON must be (characters) for its packing to be tried, and the most of it its packing may be to be kept. */
const PACK_FROM = 2048,
  PACK_WORTH = 0.9;

/** A store's save packed by column, where that is smaller than its JSON `plain` and unpacks to exactly it; null otherwise. */
function packedIfSmaller(saved: unknown, plain: string): { data: unknown; text: string } | null {
  let text: string;
  try {
    text = JSON.stringify(packList([saved]));
  } catch {
    return null;
  }
  if (text.length > plain.length * PACK_WORTH) return null;
  const data = JSON.parse(text) as unknown;
  try {
    if (JSON.stringify(unpackList(structuredClone(data) as Packed)[0]) !== plain) return null;
  } catch {
    return null;
  }
  return { data, text };
}

/** Turn a world into a save document. Only between moments. */
export function saveWorld(
  world: World,
  ruleset: string,
  meta: Record<string, unknown> = {},
  lineage?: SaveDocument["lineage"],
): SaveDocument {
  const steps = saveSteps(world, ruleset, meta, lineage);
  for (;;) {
    const r = steps.next();
    if (r.done) return r.value;
  }
}

/** What a save's steps yield: "held" once all it reads of the world is read, after which the world may go on. */
export type SaveStep = void | "held";

/**
 * saveWorld a piece at a time (2026-11-15): a step yielded after each store is read, and after it is packed and
 * hashed, and between the pieces of a store that makes its save in pieces (StateStore.saveSteps). Whoever runs it
 * keeps the world as it is till it yields "held" (2026-11-28): by then each store's save is copied as it stood
 * (heldCopy), and the packing and hashing after reads only the copies, so the world may go on meanwhile. What it
 * returns is what saveWorld would of the world as it was at "held".
 */
export function* saveSteps(
  world: World,
  ruleset: string,
  meta: Record<string, unknown> = {},
  lineage?: SaveDocument["lineage"],
): Generator<SaveStep, SaveDocument, void> {
  if (world.scheduler.midMoment) throw new Error("a world is saved between moments");
  const read: {
    name: string;
    schema: number;
    asked: boolean;
    outside: boolean;
    packed?: boolean;
    saved: unknown;
  }[] = [];
  for (const name of world.storeNames()) {
    const store = world.store(name),
      saved = store.saveSteps ? yield* store.saveSteps() : store.save();
    read.push({
      name,
      schema: schemaOf(store),
      asked: store.packed === true,
      outside: store.outsideRules === true,
      ...(store.packed === undefined ? {} : { packed: store.packed }),
      // (A store whose save is made anew needs no copy of it: it holds nothing the world goes on to change.)
      saved: store.savesAnew === true ? saved : heldCopy(saved),
    });
    yield;
  }
  // (What else the document holds of the world, as it stands: no later step reads the world.)
  const t = world.now,
    seed = world.seed.text,
    minter = heldCopy(world.minter.state()) as SaveDocument["minter"],
    scheduler = heldCopy(world.scheduler.save()) as SaveDocument["scheduler"],
    checkpoints = heldCopy(
      world.checkpoints().map((c) => ({ ...c })),
    ) as SaveDocument["checkpoints"],
    hashes = heldCopy(world.domainHashes()) as SaveDocument["hashes"],
    kept = heldCopy({ ...meta }) as SaveDocument["meta"];
  yield "held";
  const stores: Record<string, StoreChunk> = {};
  for (const r of read) {
    const { saved, asked } = r;
    r.saved = null;
    // (Packed straight from the store: packList keeps what JSON keeps, and the copy through
    // JSON is then of the packed lists, a fraction of the size.)
    // (A column at a time, a step after each: one store's packing was one step of 0.3 s and more.)
    let { data, text } = yield* throughJsonSteps(asked ? yield* packListSteps([saved]) : saved),
      packed = asked;
    // (A store that says nothing of it is kept packed all the same where that is the smaller and gives back, letter for
    // letter, what its JSON does: some hundred and fifty small stores of rows were 1.9 MB of a save at year 1,500
    // as they were and 1.2 MB so. A chunk says which it is, and a save from before loads as it did.)
    if (r.packed === undefined && text !== undefined && text.length >= PACK_FROM) {
      const smaller = packedIfSmaller(saved, text);
      if (smaller) {
        ({ data, text } = smaller);
        packed = true;
      }
    }
    yield;
    stores[r.name] = {
      schema: r.schema,
      data,
      hash: chunkHash(data, text),
      ...(packed ? { packed: true as const } : {}),
      ...(r.outside ? { outside: true as const } : {}),
    };
  }
  return {
    format: SAVE_FORMAT,
    ruleset,
    lineage: lineage ?? [{ ruleset, from: 0 }],
    seed,
    t,
    minter,
    scheduler,
    stores,
    checkpoints,
    hashes,
    meta: kept,
  };
}

/** A value JSON writes as it was when held (heldCopy): what a store kept in it that is not plain data. */
class HeldJson {
  private readonly json: unknown;
  constructor(json: unknown) {
    this.json = json;
  }
  toJSON(): unknown {
    return this.json;
  }
}

/**
 * A copy of a store's save as it stands, that the world going on cannot change: its plain objects and arrays copied
 * (their keys in order, holes left holes), what is not plain data held as the JSON it gives now. packList and JSON read
 * the copy as they would the save: a plain object or array is still one, and the rest is still not (kept for JSON).
 */
export function heldCopy(v: unknown): unknown {
  if (typeof v !== "object" || v === null) return v;
  const proto = Object.getPrototypeOf(v) as unknown;
  if (Array.isArray(v) && proto === Array.prototype) {
    // (Copied whole, holes and all, then what in it is not a plain value copied in its place: most of a save's arrays are of numbers.)
    const out = (v as unknown[]).slice(),
      n = out.length;
    for (let j = 0; j < n; j++) {
      const x = out[j];
      if (typeof x === "object" && x !== null) out[j] = heldCopy(x);
    }
    return out;
  }
  if (
    (proto !== Object.prototype && proto !== null) ||
    Array.isArray(v) ||
    typeof (v as { toJSON?: unknown }).toJSON === "function"
  ) {
    const text = JSON.stringify(v);
    return new HeldJson(text === undefined ? undefined : JSON.parse(text));
  }
  const o = v as Record<string, unknown>,
    out: Record<string, unknown> =
      proto === null ? (Object.create(null) as Record<string, unknown>) : {};
  for (const key of Object.keys(o)) {
    const x = o[key],
      y = typeof x === "object" && x !== null ? heldCopy(x) : x;
    if (key === "__proto__")
      Object.defineProperty(out, key, {
        value: y,
        enumerable: true,
        writable: true,
        configurable: true,
      });
    else out[key] = y;
  }
  return out;
}

export class SaveError extends Error {}

export type LoadOptions = {
  /** Accept a save made under another ruleset: history is kept, the future follows the new rules. */
  readonly allowRulesetChange?: boolean;
};

/** A loaded world and the lineage it now continues. */
export type Loaded = { readonly world: World; readonly lineage: SaveDocument["lineage"] };

/** Rebuild a world from a save document with the app's builder. */
export function loadWorld(
  doc: SaveDocument,
  build: (seed: Seed) => World,
  ruleset: string,
  options: LoadOptions = {},
): Loaded {
  if (!FORMATS.includes(doc.format))
    throw new SaveError(`save format ${doc.format} is not ${FORMATS.join(" or ")}`);
  const changed = doc.ruleset !== ruleset;
  if (changed && !options.allowRulesetChange)
    throw new SaveError(
      `the save was made under ruleset ${doc.ruleset}, this game runs ${ruleset}`,
    );
  const world = build(seedFromText(doc.seed));
  const names = world.storeNames();
  // Under new rules a store the old ones kept and these do not is let go, and a store
  // these keep and the old did not begins as it would on a new world, from the moment
  // of loading: history is kept, the future follows the new rules.
  for (const name of Object.keys(doc.stores))
    if (!names.includes(name) && !changed && !doc.stores[name]!.outside)
      throw new SaveError(`the save has a store ${name} this game does not`);
  for (const name of names) {
    const chunk = doc.stores[name];
    // (A reading kept beside the world, which a save made without it lacks, begins here, empty.)
    if (!chunk && (changed || world.store(name).outsideRules)) continue;
    if (!chunk) throw new SaveError(`the save has no store ${name}`);
    if (!chunkHolds(chunk))
      throw new SaveError(`store ${name} is corrupt (its hash does not match)`);
    const store = world.store(name),
      target = schemaOf(store);
    // (A copy: a store keeps what it loads, and the world running on must not write into the
    // save it came from — the same save may be loaded again. A packed chunk is copied as it is
    // packed, and unpacks into lists of its own.)
    let data = chunk.packed ? unpackList(structuredClone(chunk.data) as Packed)[0] : chunk.data;
    for (let v = chunk.schema; v < target; v++) {
      const migrate = MIGRATIONS.get(`${name}@${v}`);
      if (!migrate) throw new SaveError(`no migration for ${name} from schema ${v}`);
      data = migrate(data);
    }
    if (chunk.schema > target)
      throw new SaveError(
        `store ${name} has schema ${chunk.schema}, newer than this game's ${target}`,
      );
    store.load(chunk.packed ? data : structuredClone(data));
  }
  world.minter.restore(doc.minter);
  world.scheduler.load(doc.scheduler);
  world.restoreCheckpoints(doc.checkpoints);
  const migrated = Object.entries(doc.stores).some(
    ([name, c]) => names.includes(name) && c.schema !== schemaOf(world.store(name)),
  );
  if (!changed && !migrated) {
    const now = world.domainHashes();
    const differ = doc.hashes
      .filter(([d, h]) => now.find(([e]) => e === d)?.[1] !== h)
      .map(([d]) => d);
    if (differ.length)
      throw new SaveError(
        `loading did not reproduce the saved world (domains ${differ.join(", ")})`,
      );
  }
  world.settleIndex();
  const lineage = changed ? [...doc.lineage, { ruleset, from: doc.t }] : doc.lineage;
  return { world, lineage };
}

/**
 * Verify a save by replaying its command log from the seed: the rebuilt world
 * must reach the same checkpoint chain and the same domain hashes.
 */
export function verifyByReplay(
  doc: SaveDocument,
  build: (seed: Seed) => World,
): { ok: boolean; problem: string | null } {
  if (doc.lineage.length > 1)
    return {
      ok: false,
      problem: "replay is valid only within one ruleset; this history changed rules",
    };
  const log = doc.stores["commands.log"],
    commands =
      ((log ? chunkData(log) : undefined) as { commands?: [] } | undefined)?.commands ?? [];
  const world = build(seedFromText(doc.seed));
  world.replay(commands, doc.t);
  const chain = world.checkpoints().map((c) => c.chain),
    saved = doc.checkpoints.map((c) => c.chain);
  for (let i = 0; i < saved.length; i++)
    if (chain[i] !== saved[i])
      return {
        ok: false,
        problem: `replay parts from the save at checkpoint ${i} (t=${doc.checkpoints[i]!.t})`,
      };
  const now = world.domainHashes(),
    differ = doc.hashes.filter(([d, h]) => now.find(([e]) => e === d)?.[1] !== h).map(([d]) => d);
  if (differ.length) return { ok: false, problem: `replay reaches different ${differ.join(", ")}` };
  return { ok: true, problem: null };
}
