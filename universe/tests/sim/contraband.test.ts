// Contraband ware by ware (sim/money/contraband.ts) and intoxicants kind by kind (sim/money/intox.ts), on First Light a century on.
import { test } from "node:test";
import assert from "node:assert/strict";
import { EARTH } from "../../src/host/planet.ts";
import {
  CONTRA_SLOTS,
  CONTRA_STORE,
  INTOX,
  INTOX_STORE,
  KINDS_STORE,
  KIND_ROW,
  contrabandOf,
  holdsOf,
  intoxLineages,
  kindBarred,
  kindsOf,
  marketsOf,
  moneyStore,
  politiesOf,
  populationContext,
  realmName,
  type Polity,
} from "../../src/sim/index.ts";
import { reckonContraband } from "../../src/sim/money/contraband.ts";
import { CONTRA_CAUSES, HOLD, INTOX_KINDS, WARE_COUNT, WARE_INTOX } from "../../src/rules/index.ts";
import { universeWorld } from "../host/worlds.ts";

const world = universeWorld(EARTH, "first light", 100);

test("a realm keeps its greatest few smuggled wares by their rent, each crossing unseen in part, each with its why", () => {
  let realms = 0;
  for (const p of politiesOf(world).living()) {
    const wares = contrabandOf(world, p.ref);
    if (!wares.length) continue;
    realms++;
    assert.ok(wares.length <= CONTRA_SLOTS);
    for (const w of wares) {
      assert.ok(w.ware >= 0 && w.ware < WARE_COUNT, realmName(p));
      assert.ok(w.share > 0 && w.share <= 0.8);
      assert.ok(CONTRA_CAUSES[w.cause], `a cause for ${w.ware}`);
      assert.ok(w.worth >= 1);
    }
    const rent = wares.map((w) => w.worth * w.wedge);
    for (let k = 1; k < rent.length; k++) assert.ok(rent[k]! <= rent[k - 1]! + 1);
  }
  // More than what calms is smuggled: goods too, for their tariffs, their licences and their wars.
  const wares = new Set(
    politiesOf(world)
      .living()
      .flatMap((p) => contrabandOf(world, p.ref).map((w) => w.ware)),
  );
  assert.ok(realms > 10, `realms with contraband: ${realms}`);
  assert.ok(
    [...wares].some((w) => w < WARE_INTOX),
    "a good, not only an intoxicant",
  );
});

/** Two standing realms whose lands meet. */
function neighbours(): [Polity, Polity] {
  const ctx = populationContext(world),
    g = ctx.generated,
    realms = politiesOf(world);
  for (const p of realms.living())
    for (const c of p.members)
      for (let k = g.grid.offsets[c]!; k < g.grid.offsets[c + 1]!; k++) {
        const q = realms.of(g.grid.neighbours[k]!);
        if (
          q &&
          q.ended === null &&
          q.ref !== p.ref &&
          ctx.provinces.get(g.grid.neighbours[k]!)?.total()
        )
          return [p, q];
      }
  throw new Error("no two realms meet");
}

test("at war, what the enemy's side holds cheaper is smuggled across, its wedge the gap; the row is put back after", () => {
  const [p, q] = neighbours(),
    store = moneyStore(world, CONTRA_STORE)!,
    was = store.get(p.ref),
    ctx = populationContext(world),
    markets = marketsOf(world),
    held = holdsOf(world, p.ref);
  try {
    store.drop(p.ref);
    reckonContraband({
      ctx,
      p,
      lands: p.members
        .map((c) => ({ prov: ctx.provinces.get(c)!, m: markets.get(c)! }))
        .filter((x) => x.prov && x.m && x.prov.total() > 0),
      inBy: undefined,
      shutBy: undefined,
      rate: 0,
      dealt: 1e9,
      hold: { force: held[HOLD.force]!, capacity: 0.5, corruption: 0.2 },
      border: 2,
      force: 0.3,
      voice: 0.5,
      word: 0.5,
      foes: new Set([q.ref]),
      tell: () => assert.fail("nothing told under a dealt this great"),
    });
    const wares = contrabandOf(world, p.ref);
    assert.ok(
      wares.length > 0,
      `something would cross between ${realmName(p)} and ${realmName(q)}`,
    );
    for (const w of wares) {
      assert.equal(CONTRA_CAUSES[w.cause], "war");
      assert.ok(w.wedge > 0 && w.wedge <= 1);
    }
  } finally {
    if (was) store.set(p.ref, was);
    else store.drop(p.ref);
  }
});

test("intoxicants kind by kind: each kind's law its own, and trade carries a kind to realms where none grows", () => {
  const kinds = moneyStore(world, KINDS_STORE)!,
    lands = moneyStore(world, INTOX_STORE)!;
  let carried = 0;
  for (const p of politiesOf(world).living()) {
    const row = kinds.get(p.ref);
    if (!row) continue;
    INTOX_KINDS.forEach((_, k) => {
      assert.equal(kindBarred(world, p.ref, k), row[KIND_ROW.width * k + KIND_ROW.barred]! / 1000);
      const bought = row[KIND_ROW.width * k + KIND_ROW.imported]!,
        grows = p.members.some((c) => (lands.get(c)?.[INTOX.have + k] ?? 0) > 0);
      if (bought > 0 && !grows) carried++;
    });
  }
  assert.ok(carried > 0, "some realm buys a kind none of its lands grows");
  // A forced row: a realm forbids what eases pain and lets what calms be.
  const p = politiesOf(world).living()[0]!,
    was = kinds.get(p.ref),
    row = new Array<number>(KIND_ROW.told + 1).fill(0);
  row[KIND_ROW.width * 3 + KIND_ROW.barred] = 800;
  try {
    kinds.set(p.ref, row);
    assert.equal(kindBarred(world, p.ref, 3), 0.8);
    assert.equal(kindBarred(world, p.ref, 0), 0);
  } finally {
    if (was) kinds.set(p.ref, was);
    else kinds.drop(p.ref);
  }
});

test("a lineage holds its own kind as before, and may hold others besides", () => {
  const ctx = populationContext(world),
    l = intoxLineages(ctx);
  assert.ok(l.growing > 0);
  assert.equal(l.holding.length, INTOX_KINDS.length);
  for (const s of ctx.generated.life.species.slice(0, 40)) {
    const k = kindsOf(world, s.index);
    assert.equal(new Set(k).size, k.length);
    assert.deepEqual(kindsOf(world, s.index), k, "the same each time");
  }
});
