import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DAY,
  SaveError,
  World,
  YEAR,
  chunkData,
  defineMigration,
  loadWorld,
  rulesetId,
  SAVE_FORMAT,
  saveWorld,
  saveSteps,
  heldCopy,
  packList,
  seedFromText,
  verifyByReplay,
  Hasher,
  type DecisionRecord,
  type SaveDocument,
  type Seed,
  type StateStore,
  type StoreChunk,
} from "../../src/kernel/index.ts";
import { makePopulationWorld, makeToyWorld } from "../../src/sim/index.ts";

const build = (seed: Seed) => makeToyWorld(seed.text);
const VERSION = "test";

function roundTrip(doc: SaveDocument): SaveDocument {
  return JSON.parse(JSON.stringify(doc)) as SaveDocument;
}

function liveWorld(): World {
  const w = makeToyWorld("saves");
  w.runTo(4 * YEAR);
  w.submit("toy.bless", { cell: 5, people: 200 });
  w.runTo(10 * YEAR + 17 * DAY + 5);
  return w;
}

test("a loaded save continues exactly as the world it came from", () => {
  const live = liveWorld(),
    ruleset = rulesetId(live, VERSION),
    doc = roundTrip(saveWorld(live, ruleset, { name: "test" }));
  const { world } = loadWorld(doc, build, ruleset);
  assert.deepEqual(world.domainHashes(), live.domainHashes());
  live.submit("toy.bless", { cell: 1, people: 7 });
  world.submit("toy.bless", { cell: 1, people: 7 });
  live.runTo(25 * YEAR);
  world.runTo(25 * YEAR);
  assert.deepEqual(
    world.checkpoints().map((c) => c.chain),
    live.checkpoints().map((c) => c.chain),
  );
});

test("a save held in memory loads again, whatever a world loaded from it did since", () => {
  // (A store keeps what it loads: were it the save's own arrays, the world running on would
  // write into the save — a people's markets add a line each year — and the save would no
  // longer match its hashes.)
  const people = (seed: Seed) => makePopulationWorld(seed),
    live = people(seedFromText("first light"));
  live.runTo(60 * YEAR);
  const ruleset = rulesetId(live, VERSION),
    doc = saveWorld(live, ruleset),
    first = loadWorld(doc, people, ruleset).world;
  first.runTo(80 * YEAR);
  const again = loadWorld(doc, people, ruleset).world;
  assert.deepEqual(again.domainHashes(), live.domainHashes());
});

test("a save proves itself by replaying its commands from the seed", () => {
  const live = liveWorld(),
    ruleset = rulesetId(live, VERSION),
    doc = roundTrip(saveWorld(live, ruleset));
  assert.deepEqual(verifyByReplay(doc, build), { ok: true, problem: null });
  const cmds = doc.stores["commands.log"]!.data as { commands: { args: { people: number } }[] };
  cmds.commands[0]!.args.people = 201;
  const verdict = verifyByReplay(doc, build);
  assert.equal(verdict.ok, false);
  assert.match(verdict.problem!, /parts from the save|reaches different/);
});

test("damage, a foreign ruleset and a mid-moment save are refused", () => {
  const live = liveWorld(),
    ruleset = rulesetId(live, VERSION),
    doc = roundTrip(saveWorld(live, ruleset));
  const damaged = roundTrip(doc);
  const table = damaged.stores["toy.population"]!.data as { data: string },
    mid = table.data.length >> 1;
  table.data =
    table.data.slice(0, mid) + (table.data[mid] === "B" ? "C" : "B") + table.data.slice(mid + 1);
  assert.throws(
    () => loadWorld(damaged, build, ruleset),
    (e: unknown) => e instanceof SaveError && /corrupt/.test((e as Error).message),
  );
  assert.throws(() => loadWorld(doc, build, "another"), /ruleset/);
  const moved = loadWorld(doc, build, "another", { allowRulesetChange: true });
  assert.deepEqual(moved.lineage.at(-1), { ruleset: "another", from: doc.t });
  assert.equal(verifyByReplay({ ...doc, lineage: moved.lineage }, build).ok, false);
  // A save of older rules loads though the stores changed: one the old rules kept and
  // these do not is let go; one these keep that it lacks starts afresh.
  const older = roundTrip(doc),
    stores = older.stores as Record<string, unknown>;
  stores["retired.store"] = stores["toy.population"];
  const lacking = Object.keys(stores).find((n) => n !== "toy.population" && n !== "retired.store")!;
  delete stores[lacking];
  assert.throws(() => loadWorld(older, build, ruleset), /store/);
  const carried = loadWorld(older, build, "another", { allowRulesetChange: true });
  assert.equal(carried.world.now, doc.t);
  carried.world.runTo(doc.t + YEAR);
  const w = makeToyWorld("mid"),
    steps = w.advance(YEAR);
  steps.next();
  assert.throws(() => saveWorld(w, ruleset), /between moments/);
});

class Ledger implements StateStore {
  readonly name = "ledger.book";
  readonly schema = 2;
  entries: { who: string; amount: number }[] = [];
  hashInto(h: Hasher): void {
    h.value(this.entries);
  }
  save(): unknown {
    return { entries: this.entries };
  }
  load(state: unknown): void {
    this.entries = (state as { entries: { who: string; amount: number }[] }).entries;
  }
}
defineMigration("ledger.book", 1, (data) => ({
  entries: (data as { names: string[] }).names.map((who) => ({ who, amount: 0 })),
}));

test("an old store schema is migrated on load", () => {
  const make = (seed: Seed) => {
    const w = new World(seed);
    w.register(new Ledger());
    return w;
  };
  const w = make(seedFromText("ledger")),
    ruleset = rulesetId(w, VERSION),
    doc = roundTrip(saveWorld(w, ruleset));
  // The same save as an older game wrote it: the ledger at schema 1, a list of names.
  const oldData = { names: ["Ada", "Ben"] },
    old: SaveDocument = {
      ...doc,
      stores: {
        ...doc.stores,
        "ledger.book": { schema: 1, data: oldData, hash: new Hasher().value(oldData).hex() },
      },
    };
  const { world } = loadWorld(old, make, ruleset);
  assert.deepEqual(world.store<Ledger>("ledger.book").entries, [
    { who: "Ada", amount: 0 },
    { who: "Ben", amount: 0 },
  ]);
});

/** A save as a game before packing wrote it: format 1, every store as it saved it. */
function unpacked(doc: SaveDocument): SaveDocument {
  const stores: Record<string, StoreChunk> = {};
  for (const [name, chunk] of Object.entries(doc.stores)) {
    const data = chunkData(chunk);
    stores[name] = { schema: chunk.schema, data, hash: new Hasher().value(data).hex() };
  }
  return { ...doc, format: 1, stores };
}

test("a store of long lists is saved packed by column, and loads back as it was", () => {
  const live = liveWorld(),
    ruleset = rulesetId(live, VERSION),
    doc = roundTrip(saveWorld(live, ruleset)),
    chunk = doc.stores["history.events"]!;
  assert.equal(doc.format, SAVE_FORMAT);
  assert.equal(chunk.packed, true);
  assert.equal(
    doc.stores["commands.log"]!.packed,
    undefined,
    "a store that does not ask is kept as it is",
  );
  assert.deepEqual(chunkData(chunk), JSON.parse(JSON.stringify(live.events.save())));
  const { world } = loadWorld(doc, build, ruleset);
  assert.deepEqual(world.domainHashes(), live.domainHashes());
  assert.deepEqual(world.events.all(), live.events.all());
  // (A decision as "why" tells it, all that is read of one and all that a save keeps.)
  const told = (d: DecisionRecord) => ({
    ...d,
    score: d.score.toFixed(2),
    factors: d.factors.map((f) => ({
      name: f.name,
      told: f.contribution.toFixed(2),
      source: f.source,
    })),
  });
  assert.deepEqual(world.decisions.all().map(told), live.decisions.all().map(told));
  assert.equal(world.decisions.count, live.decisions.count);
});

test("a store of many rows that does not ask is kept packed where that is smaller, and loads back as it was", () => {
  // (A store of rows as the small ones of a peopled world are: a key and a few whole numbers each.)
  class Rows implements StateStore {
    readonly name = "test.rows";
    rows: [string, number, number, number][] = [];
    hashInto(h: Hasher): void {
      h.value(this.rows);
    }
    save(): unknown {
      return { rows: this.rows, sets: this.rows.length };
    }
    load(state: unknown): void {
      this.rows = (state as { rows: [string, number, number, number][] }).rows;
    }
  }
  const withRows = (seed: Seed) => {
      const w = makeToyWorld(seed.text);
      w.register(new Rows());
      return w;
    },
    live = withRows(seedFromText("rows"));
  live.runTo(3 * YEAR);
  const rows = live.store<Rows>("test.rows");
  for (let i = 0; i < 400; i++) rows.rows.push([`cell:0:${i}`, i * 7, 1000 - i, i % 5]);
  const ruleset = rulesetId(live, VERSION),
    doc = roundTrip(saveWorld(live, ruleset)),
    chunk = doc.stores["test.rows"]!,
    plain = JSON.stringify(rows.save());
  assert.equal(chunk.packed, true);
  assert.ok(JSON.stringify(chunk.data).length < 0.9 * plain.length, "smaller than its JSON");
  assert.equal(JSON.stringify(chunkData(chunk)), plain, "and gives back what its JSON does");
  assert.equal(doc.stores["commands.log"]!.packed, undefined, "a few lines are kept as they are");
  const { world } = loadWorld(doc, withRows, ruleset);
  assert.deepEqual(world.domainHashes(), live.domainHashes());
  assert.deepEqual(world.store<Rows>("test.rows").rows, rows.rows);
});

test("a save from before packing loads, and runs on as the world it came from", () => {
  const live = liveWorld(),
    ruleset = rulesetId(live, VERSION),
    old = roundTrip(unpacked(saveWorld(live, ruleset)));
  assert.equal(old.stores["history.events"]!.packed, undefined);
  const { world } = loadWorld(old, build, ruleset);
  assert.deepEqual(world.domainHashes(), live.domainHashes());
  live.runTo(20 * YEAR);
  world.runTo(20 * YEAR);
  assert.deepEqual(
    world.checkpoints().map((c) => c.chain),
    live.checkpoints().map((c) => c.chain),
  );
  assert.throws(
    () => loadWorld({ ...old, format: SAVE_FORMAT + 1 }, build, ruleset),
    /save format 4/,
  );
});

test("a packed store damaged is refused by its hash", () => {
  const live = liveWorld(),
    ruleset = rulesetId(live, VERSION),
    doc = roundTrip(saveWorld(live, ruleset));
  // (A letter of a column of numbers changed: the column still reads, its hash does not match.)
  const text = JSON.stringify(doc.stores["history.events"]!.data),
    at = text.indexOf('"d":"') + 6;
  assert.ok(at > 6);
  const damaged = JSON.parse(
    text.slice(0, at) + (text[at] === "B" ? "C" : "B") + text.slice(at + 1),
  );
  (doc.stores as Record<string, StoreChunk>)["history.events"] = {
    ...doc.stores["history.events"]!,
    data: damaged,
  };
  assert.throws(
    () => loadWorld(doc, build, ruleset),
    (e: unknown) =>
      e instanceof SaveError && /history.events is corrupt/.test((e as Error).message),
  );
});

test("a save reads the world first and makes the rest from its copy: the world going on after does not change it", () => {
  const w = makePopulationWorld(seedFromText("held saves"));
  w.runTo(6 * YEAR);
  const ruleset = rulesetId(w, VERSION),
    at = JSON.stringify(saveWorld(w, ruleset)),
    steps = saveSteps(w, ruleset);
  let r = steps.next();
  while (!r.done && r.value !== "held") r = steps.next();
  assert.equal(r.value, "held");
  // (On five years, then the rest of the save made.)
  w.runTo(11 * YEAR);
  for (r = steps.next(); !r.done;) r = steps.next();
  assert.equal(JSON.stringify(r.value), at, "the world as it was when the save held");
  assert.notEqual(JSON.stringify(saveWorld(w, ruleset)), at, "the world went on");
});

test("a held copy is read by JSON and by packing as what it was copied from", () => {
  class Kept {
    readonly a = 1;
    readonly b = [2, 3];
  }
  const live = { n: [1, 2, 3] },
    holed: number[] = [1];
  holed[2] = 3;
  const odd: Record<string, unknown> = {
    plain: { x: 1, y: "two", z: [1, 2, { w: null }] },
    undef: { x: undefined, y: 2 },
    neg: [-0, 0, NaN, Infinity],
    holed,
    dated: new Date(0),
    kept: new Kept(),
    typed: new Uint8Array([1, 2]),
    map: new Map([[1, 2]]),
    fn: { f: () => 1, g: 2 },
    own: { toJSON: () => live.n },
    bare: Object.assign(Object.create(null) as object, { q: 1 }),
    many: Array.from({ length: 80 }, (_, j) => j % 7),
    rows: Array.from({ length: 80 }, (_, j) => ({ id: `ev:${j}:1`, t: j * 3, s: [j, -j] })),
  };
  Object.defineProperty(odd, "__proto__", {
    value: { p: 1 },
    enumerable: true,
    writable: true,
    configurable: true,
  });
  const copy = heldCopy(odd),
    json = JSON.stringify(odd),
    packed = JSON.stringify(packList([odd]));
  // (What was copied changes after: the copy does not.)
  live.n.push(4);
  (odd.plain as { x: number }).x = 9;
  (odd.rows as { t: number }[])[0]!.t = -1;
  assert.equal(JSON.stringify(copy), json);
  assert.equal(JSON.stringify(packList([copy])), packed);
  assert.equal(1 in (heldCopy(holed) as unknown[]), false, "a hole is kept a hole");
});
