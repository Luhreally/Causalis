// People out of their place (rules/held.ts, sim/war/held.ts): the held, the fled, and the wrongs done to either.
import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, type Ref, type SimTime } from "../../src/kernel/index.ts";
import {
  FLED,
  HELD,
  caughtBy,
  caughtOf,
  takenShare,
  ownParts,
  ownReckoning,
  ownScore,
  quarterParts,
  quarterScore,
  settleHeld,
} from "../../src/rules/index.ts";
import {
  DisplacedStore,
  displacedOf,
  displacedYear,
  politiesOf,
  populationContext,
} from "../../src/sim/index.ts";
import { noteFled } from "../../src/sim/war/held.ts";
import { peopledWorld } from "../worlds.ts";

test("a rout gives up prisoners, an even day few, a handful none", () => {
  assert.equal(caughtOf(100, 50, 50), 0, "under the least are not held apart");
  const even = caughtOf(10000, 500, 500),
    rout = caughtOf(10000, 2000, 500);
  assert.equal(even, Math.floor(10000 * HELD.caught));
  assert.ok(rout > even && rout <= 10000 * HELD.caughtMost);
  assert.equal(caughtOf(0, 10, 10), 0);
});

test("quarter is refused only where much weighs against the beaten, and a say at home holds it back", () => {
  const mild = {
      strange: 0.3,
      unbelief: 0,
      closed: 0.4,
      valour: 0.5,
      hungry: 0,
      grudge: 0,
      voice: 0.5,
      citizens: 0,
    },
    hard = { ...mild, strange: 1, unbelief: 1, closed: 0.9, hungry: 1, grudge: 1, voice: 0 };
  assert.ok(quarterScore(mild) < HELD.line);
  assert.ok(quarterScore(hard) >= HELD.line);
  assert.ok(quarterScore({ ...hard, voice: 1, citizens: 1 }) < quarterScore(hard));
  assert.equal(
    Math.round(quarterParts(hard).reduce((s, p) => s + p.by, 0) * 1e6),
    Math.round(quarterScore(hard) * 1e6),
  );
});

test("at a peace the held are changed man for man, given up by the beaten, bought back, bound or let go: none lost", () => {
  const cases = [
    settleHeld({ held: [300, 100], victor: 0, binds: [true, false], afford: [0, 50] }),
    settleHeld({ held: [300, 100], victor: 1, binds: [true, true], afford: [1e9, 1e9] }),
    settleHeld({ held: [0, 700], victor: null, binds: [false, false], afford: [20, 0] }),
  ];
  const held = [
    [300, 100],
    [300, 100],
    [0, 700],
  ];
  cases.forEach((o, k) => {
    for (const s of [0, 1])
      assert.equal(
        o.exchanged + o.given[s]! + o.bought[s]! + o.bound[s]! + o.freed[s]!,
        held[k]![s],
        `case ${k} side ${s}`,
      );
  });
  // (The victor who binds keeps what is not bought; the beaten gives up what it holds.)
  assert.deepEqual(cases[0]!.bought, [50, 0]);
  assert.deepEqual(cases[0]!.bound, [150, 0]);
  assert.deepEqual(cases[1]!.given, [200, 0]);
  assert.deepEqual(cases[2]!.bought, [0, 20]);
  assert.deepEqual(cases[2]!.freed, [0, 680]);
});

const world = peopledWorld("kestrel", 400, { start: "spread" }),
  ctx = populationContext(world);

test("the fled are kept by where they came to and whence, settle a share a year, and are let go when few", () => {
  const store = displacedOf(world)!;
  assert.ok(store instanceof DisplacedStore);
  const [a, b] = politiesOf(world)
    .living()
    .filter((p) => p.members.length >= 1);
  assert.ok(a && b);
  const cause = a.event as Ref,
    year = Math.floor(world.now / YEAR) + 1,
    before = [...store.allCamps()].filter((c) => c.at === a.seat && c.from === b.seat).length;
  noteFled(world, b.seat, a.seat, 4000, "war", cause, year - 1);
  noteFled(world, b.seat, a.seat, 1000, "war", cause, year - 1);
  const camp = store.campsAt(a.seat).find((c) => c.from === b.seat)!;
  assert.ok(camp && camp.count >= 5000);
  assert.equal(
    [...store.allCamps()].filter((c) => c.at === a.seat && c.from === b.seat).length,
    Math.max(1, before),
  );
  // (Saved and loaded, the same.)
  const copy = new DisplacedStore();
  copy.load(JSON.parse(JSON.stringify(store.save())));
  assert.deepEqual(copy.save(), store.save());
  let last = camp.count;
  for (let y = year + 1; y < year + 60 && store.campsAt(a.seat).includes(camp); y++) {
    displacedYear(ctx, (y * YEAR) as SimTime);
    assert.ok(camp.count < last, "no share settled");
    last = camp.count;
  }
  assert.ok(!store.campsAt(a.seat).includes(camp), "a camp of a few was never let go");
  assert.ok(last < FLED.least / (1 - 2 * FLED.settle) + 1);
});

test("a wrong no peace answered is answered at home only where much weighs for it: a say, a later ruler, a shared faith", () => {
  const none = { voice: 0.1, citizens: 0, kin: 0, later: 0, standing: 0.5, won: 1 };
  // (A people with no say, under the ruler who had it done, in a war it won: no one answers.)
  assert.equal(ownReckoning(none), null);
  // (The wronged keep its own faith: that faith names it, though no court tries it.)
  assert.equal(ownReckoning({ ...none, kin: 1 }), "censured");
  // (A later ruler and a people come to a say: tried and cast down; with a law for strangers and no standing to shield them, they die for it.)
  assert.equal(ownReckoning({ ...none, voice: 0.6, later: 1, won: 0 }), "cast");
  assert.equal(
    ownReckoning({ voice: 0.9, citizens: 1, kin: 0, later: 1, standing: 0, won: 0 }),
    "own",
  );
  // (One who stands high is shielded: the same people, the same year.)
  const mid = { voice: 0.6, citizens: 0, kin: 0, later: 1, standing: 0, won: 0 };
  assert.ok(ownScore({ ...mid, standing: 1 }) < ownScore(mid));
  assert.ok(ownScore(mid) >= HELD.own && ownScore(mid) < HELD.ownDeath);
  assert.equal(
    Math.round(ownParts(mid).reduce((s, p) => s + p.by, 0) * 1e6),
    Math.round(ownScore(mid) * 1e6),
  );
});

test("how many are taken follows how the day ended: overrun most, broken by how far outweighed, drawn off few", () => {
  const share = (how: "overrun" | "morale" | "stalemate", pressure = 0) =>
    takenShare({ how, pressure });
  assert.equal(share("overrun"), HELD.overrun);
  assert.equal(share("stalemate", 0.9), HELD.withdrew);
  assert.equal(share("morale", 0), HELD.broke);
  assert.equal(share("morale", 1), HELD.brokeMost);
  assert.ok(share("morale", 0.2) < share("morale", 0.6));
  assert.ok(share("stalemate") < share("morale", 0) && share("morale", 1) < share("overrun"));
  assert.equal(caughtBy(10000, { how: "morale", pressure: 0.5 }, 1, 1), 1075);
  assert.equal(caughtBy(1000, { how: "stalemate", pressure: 0 }, 1, 1), 0, "under the least");
  // (A record that keeps no ending: by its losses, as before.)
  assert.equal(caughtBy(10000, null, 500, 500), caughtOf(10000, 500, 500));
});
