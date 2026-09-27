import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DAY,
  World,
  EVENT,
  YEAR,
  defineEventType,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  type Ref,
} from "../../src/kernel/index.ts";
import { registerExplainer, spine, why } from "../../src/causal/index.ts";
import {
  BLESSING_EVENT,
  EXODUS_EVENT,
  FLOOD_EVENT,
  FLOODPLAIN,
  cellRef,
  makeToyWorld,
  type ToyPopulation,
} from "../../src/sim/index.ts";

const MIDDLING = defineEventType("test.middling", 3);
const PING = defineEventType("test.ping", 1);
const BIG = defineEventType("test.big", 5);

registerExplainer(FLOODPLAIN.code, (_world, ref) => ({
  ref,
  claim: "a floodplain the generator laid down",
  basis: "generated",
  t: null,
  causes: [],
}));

test("events check their type, subjects and causes", () => {
  const w = new World(seedFromText("events"));
  const a = w.events.emit({ type: PING.type });
  assert.equal(w.events.get(a)?.importance, 1);
  assert.throws(() => w.events.emit({ type: "test.unknown" }), /not defined/);
  assert.throws(() => w.events.emit({ type: PING.type, importance: 9 }), /importance/);
  assert.throws(
    () => w.events.emit({ type: PING.type, subjects: [a, a, a, a, a] }),
    /at most 4 subjects/,
  );
  assert.throws(
    () =>
      w.events.emit({
        type: PING.type,
        causes: [{ ref: "ev:0:99" as Ref, role: "trigger", weight: 1 }],
      }),
    /not earlier/,
  );
  assert.throws(
    () => w.events.emit({ type: PING.type, causes: [{ ref: a, role: "trigger", weight: 2 }] }),
    /weight/,
  );
});

test("an important event lends significance to what it cites", () => {
  const w = new World(seedFromText("hindsight"));
  const small = w.events.emit({ type: PING.type }),
    context = w.events.emit({ type: PING.type });
  w.events.emit({
    type: BIG.type,
    causes: [
      { ref: small, role: "trigger", weight: 0.7 },
      { ref: context, role: "enabler", weight: 0.3 },
    ],
  });
  assert.equal(w.events.get(small)?.importance, 3, "the trigger is promoted");
  assert.equal(w.events.get(context)?.importance, 1, "an enabler is not");
});

test("old ordinary events are forgotten; the chronicle and whatever it cites stay", () => {
  const w = makeToyWorld("forget");
  w.retention = { window: 5 * YEAR, chronicle: 4 };
  w.runTo(40 * YEAR);
  const live = w.events.all();
  const forgotten = w.events
    .summaries()
    .reduce((s, x) => s + Object.values(x.counts).reduce((a, b) => a + b, 0), 0);
  assert.ok(forgotten > 50, `forgot ${forgotten} events`);
  // A kept event older than the window is in the chronicle or cited by something kept.
  const cited = new Set<string>();
  for (const e of live) for (const c of e.causes) cited.add(c.ref);
  for (const d of w.decisions.all()) for (const r of w.decisions.cited(d.id)) cited.add(r);
  for (const e of live)
    if (w.now - e.t >= 5 * YEAR + YEAR && e.importance < 4)
      assert.ok(cited.has(e.id), `${e.id} (${e.type}) was kept without a reason`);
  // A pinned event survives the window; its unpinned neighbour does not.
  const pinned = makeToyWorld("forget");
  pinned.retention = { window: 5 * YEAR, chronicle: 4 };
  pinned.runTo(3 * YEAR);
  const [first, second] = pinned.events.all();
  assert.ok(first && second);
  pinned.addPinner(() => [first.id]);
  pinned.runTo(30 * YEAR);
  assert.ok(pinned.events.get(first.id), "the pinned event is kept");
  assert.ok(!pinned.events.get(second.id), "its unpinned neighbour is forgotten");
  // A forgotten event still answers why, from its tombstone.
  let tombstoned: Ref | null = null;
  for (let n = 1; n <= w.minter.count(EVENT) && !tombstoned; n++) {
    const ref = `ev:0:${n}` as Ref;
    if (w.events.tombstone(ref)) tombstoned = ref;
  }
  assert.ok(tombstoned, "some event was forgotten");
  const told = why(w, tombstoned);
  assert.equal(told.basis, "forgotten");
  assert.match(told.claim, /since forgotten/);
});

test("commands are validated, logged, applied next moment and cited", () => {
  const w = makeToyWorld("acts");
  w.runTo(2 * YEAR + 5 * DAY);
  const pop = w.store<ToyPopulation>("toy.population"),
    before = pop.counts.get(4, 0);
  assert.throws(() => w.submit("toy.bless", { cell: 99, people: 5 }), /cell/);
  assert.throws(() => w.submit("toy.curse", {}), /no command/);
  assert.equal(w.commands.all().length, 0, "rejected commands are not logged");
  const c = w.submit("toy.bless", { cell: 4, people: 100 });
  assert.equal(c.t, w.now + 1);
  assert.equal(pop.counts.get(4, 0), before, "not applied before its moment");
  w.runTo(w.now + 1);
  assert.equal(pop.counts.get(4, 0), before + 100);
  const blessing = w.events.all().find((e) => e.type === BLESSING_EVENT.type)!;
  assert.deepEqual(blessing.causes, [{ ref: c.id, role: "agent", weight: 1 }]);
  assert.equal(why(w, blessing.id).causes[0]!.next().basis, "command");
});

test("replaying the command log from the seed reproduces history bit for bit", () => {
  const live = makeToyWorld("replay");
  live.runTo(3 * YEAR);
  live.submit("toy.bless", { cell: 2, people: 300 });
  live.runTo(5 * YEAR + 17);
  live.submit("toy.bless", { cell: 9, people: 40 });
  live.submit("toy.bless", { cell: 9, people: 41 });
  live.runTo(12 * YEAR);
  const again = makeToyWorld("replay");
  again.replay(live.commands.all(), 12 * YEAR);
  assert.deepEqual(
    again.checkpoints().map((c) => c.chain),
    live.checkpoints().map((c) => c.chain),
  );
  const untouched = makeToyWorld("replay");
  untouched.runTo(12 * YEAR);
  assert.notEqual(untouched.checkpoints().at(-1)!.chain, live.checkpoints().at(-1)!.chain);
});

test("why walks from an exodus through its decision to a flood and back to the land", () => {
  const w = makeToyWorld("why");
  w.runTo(25 * YEAR);
  const exodus = w.events
    .all()
    .find(
      (e) =>
        e.type === EXODUS_EVENT.type &&
        w.decisions.get(e.causes[0]!.ref)?.factors.some((f) => f.source),
    );
  assert.ok(exodus, "an exodus that remembered a flood");
  const decision = why(w, exodus.id).causes[0]!.next();
  assert.equal(decision.basis, "recorded");
  assert.match(decision.claim, /toy\.leave/);
  const flood = decision.causes.find((e) => e.cause.role === "pressure")!.next();
  assert.match(flood.claim, /toy\.flood/);
  const path = spine(w, flood.ref);
  assert.equal(path.at(-1)!.basis === "generated" || path.at(-1)!.basis === "forgotten", true);
  for (let i = 1; i < path.length; i++)
    if (path[i]!.t !== null && path[i - 1]!.t !== null)
      assert.ok(path[i]!.t! <= path[i - 1]!.t!, "causes are earlier");
  assert.equal(why(w, cellRef(3)).basis, "unknown");
});

test("the chronicle thins with age on a fixed schedule; a world saved and loaded keeps the same", () => {
  const aged = {
      window: 5 * YEAR,
      chronicle: 3,
      aging: { every: 20 * YEAR, steps: [{ after: 30 * YEAR, chronicle: 4 }] },
    },
    build = (seed: { text: string }) => {
      const w = makeToyWorld(seed.text);
      w.retention = aged;
      return w;
    };
  const run = build({ text: "aging" });
  run.runTo(100 * YEAR);
  // Kept events older than the last reckoning's thirty years are the greater ones, or cited.
  const cited = new Set<string>();
  for (const e of run.events.all()) for (const c of e.causes) cited.add(c.ref);
  for (const d of run.decisions.all()) for (const r of run.decisions.cited(d.id)) cited.add(r);
  const reckoned = Math.floor(run.now / (20 * YEAR)) * 20 * YEAR;
  const old = run.events.all().filter((e) => reckoned - e.t >= 30 * YEAR);
  for (const e of old)
    assert.ok(
      e.importance >= 5 || cited.has(e.id),
      `${e.id} (${e.type}, ${e.importance}) kept too long`,
    );
  // A thing of middling note, standing alone, is let go once old; a whole chronicle keeps it.
  const plant = (w: World, until: number) => {
    const out: Ref[] = [];
    for (let y = 1; y <= until; y++) {
      w.runTo(y * YEAR);
      if (y <= 10) out.push(w.events.emit({ type: MIDDLING.type }));
    }
    return out;
  };
  const agedRun = build({ text: "aging" }),
    whole = makeToyWorld("aging");
  whole.retention = { window: 5 * YEAR, chronicle: 3 };
  const lost = plant(agedRun, 100),
    held = plant(whole, 100);
  assert.ok(
    lost.every((r) => !agedRun.events.get(r)),
    "old middling news let go",
  );
  assert.ok(
    held.every((r) => whole.events.get(r)),
    "a whole chronicle keeps it",
  );
  // Saved half-way and loaded, it ends with the very same history.
  const first = build({ text: "aging" });
  first.runTo(57 * YEAR);
  const ruleset = rulesetId(first, "test"),
    doc = JSON.parse(JSON.stringify(saveWorld(first, ruleset))) as ReturnType<typeof saveWorld>,
    { world: again } = loadWorld(doc, (s) => build(s), ruleset);
  again.runTo(100 * YEAR);
  assert.deepEqual(again.domainHashes(), run.domainHashes());
});

test("ancestry fades with age: an old small event is kept only as a direct cause of a greater one", () => {
  const aged = {
      window: 5 * YEAR,
      chronicle: 3,
      aging: { every: 20 * YEAR, steps: [{ after: 30 * YEAR, chronicle: 4 }] },
    },
    chain = (w: World) => {
      const root = w.events.emit({ type: MIDDLING.type }),
        cause = w.events.emit({
          type: MIDDLING.type,
          causes: [{ ref: root, role: "enabler", weight: 1 }],
        }),
        great = w.events.emit({
          type: BIG.type,
          causes: [{ ref: cause, role: "enabler", weight: 1 }],
        });
      return [root, cause, great] as const;
    };
  const w = makeToyWorld("fading");
  w.retention = aged;
  w.runTo(5 * YEAR);
  const [oldRoot, oldCause, oldGreat] = chain(w);
  w.runTo(95 * YEAR);
  const [newRoot, newCause, newGreat] = chain(w);
  w.runTo(100 * YEAR);
  assert.ok(w.events.get(oldGreat), "the old great event stays");
  assert.ok(w.events.get(oldCause), "and its direct cause");
  assert.equal(w.events.get(oldRoot), undefined, "the cause's own old cause is let go");
  assert.equal(why(w, oldRoot).basis, "forgotten");
  assert.ok(
    [newRoot, newCause, newGreat].every((r) => w.events.get(r)),
    "a young chain is whole",
  );
  // Without aging, the whole old chain stays.
  const whole = makeToyWorld("fading");
  whole.retention = { window: 5 * YEAR, chronicle: 3 };
  whole.runTo(5 * YEAR);
  const kept = chain(whole);
  whole.runTo(100 * YEAR);
  assert.ok(kept.every((r) => whole.events.get(r)));
});
