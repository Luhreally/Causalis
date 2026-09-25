import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DAY,
  SaveError,
  World,
  YEAR,
  defineMigration,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  verifyByReplay,
  Hasher,
  type SaveDocument,
  type Seed,
  type StateStore,
} from "../../src/kernel/index.ts";
import { makeToyWorld } from "../fixtures/toy.ts";

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
