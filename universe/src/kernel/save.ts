// Saves (docs/architecture §33). A save document holds what the seed cannot
// regenerate: the minter, the scheduler and its agenda, every registered store
// (each with its schema version and its own hash), the checkpoint chain, and the
// ruleset it was made under. Loading builds a fresh world from the seed with the
// app's own builder (which registers the same systems and stores), migrates any
// store whose schema has moved on, loads every store, and proves the result by
// recomputing each domain's hash.
//
// Bytes, compression and storage slots are the host's business (host/storage.ts);
// this file only turns a world into plain data and back.
import { Hasher } from "./hash.ts";
import { eventTypes } from "./history.ts";
import { kinds } from "./ref.ts";
import { seedFromText, streams, type Seed } from "./rng.ts";
import type { AgendaItem } from "./schedule.ts";
import type { Checkpoint, World } from "./world.ts";

export const SAVE_FORMAT = 1;

export type StoreChunk = { readonly schema: number; readonly data: unknown; readonly hash: string };

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

function chunkHash(data: unknown): string {
  return new Hasher().value(data).hex();
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
  for (const name of world.storeNames()) h.string(name).int(schemaOf(world.store(name)));
  return h.hex();
}

/** Turn a world into a save document. Only between moments. */
export function saveWorld(
  world: World,
  ruleset: string,
  meta: Record<string, unknown> = {},
  lineage?: SaveDocument["lineage"],
): SaveDocument {
  if (world.scheduler.midMoment) throw new Error("a world is saved between moments");
  const stores: Record<string, StoreChunk> = {};
  for (const name of world.storeNames()) {
    const store = world.store(name),
      data = JSON.parse(JSON.stringify(store.save())) as unknown;
    stores[name] = { schema: schemaOf(store), data, hash: chunkHash(data) };
  }
  return {
    format: SAVE_FORMAT,
    ruleset,
    lineage: lineage ?? [{ ruleset, from: 0 }],
    seed: world.seed.text,
    t: world.now,
    minter: world.minter.state(),
    scheduler: world.scheduler.save(),
    stores,
    checkpoints: world.checkpoints().map((c) => ({ ...c })),
    hashes: world.domainHashes(),
    meta: { ...meta },
  };
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
  if (doc.format !== SAVE_FORMAT)
    throw new SaveError(`save format ${doc.format} is not ${SAVE_FORMAT}`);
  const changed = doc.ruleset !== ruleset;
  if (changed && !options.allowRulesetChange)
    throw new SaveError(
      `the save was made under ruleset ${doc.ruleset}, this game runs ${ruleset}`,
    );
  const world = build(seedFromText(doc.seed));
  const names = world.storeNames();
  for (const name of Object.keys(doc.stores))
    if (!names.includes(name))
      throw new SaveError(`the save has a store ${name} this game does not`);
  for (const name of names) {
    const chunk = doc.stores[name];
    if (!chunk) throw new SaveError(`the save has no store ${name}`);
    if (chunkHash(chunk.data) !== chunk.hash)
      throw new SaveError(`store ${name} is corrupt (its hash does not match)`);
    const store = world.store(name),
      target = schemaOf(store);
    let data = chunk.data;
    for (let v = chunk.schema; v < target; v++) {
      const migrate = MIGRATIONS.get(`${name}@${v}`);
      if (!migrate) throw new SaveError(`no migration for ${name} from schema ${v}`);
      data = migrate(data);
    }
    if (chunk.schema > target)
      throw new SaveError(
        `store ${name} has schema ${chunk.schema}, newer than this game's ${target}`,
      );
    store.load(data);
  }
  world.minter.restore(doc.minter);
  world.scheduler.load(doc.scheduler);
  world.restoreCheckpoints(doc.checkpoints);
  const migrated = Object.values(doc.stores).some(
    (c, i) => c.schema !== schemaOf(world.store(Object.keys(doc.stores)[i]!)),
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
  const commands =
    (doc.stores["commands.log"]?.data as { commands?: [] } | undefined)?.commands ?? [];
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
