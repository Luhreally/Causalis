// The underworld lens (2026-11-16): what goes on under the law, read off stores that are already kept. It reads nothing where
// nothing is kept (an early world's lands, or a land whose rows are taken away), and the rows written into its stores as they are:
// a realm's smuggling and its carriers organised, a land's intoxicants and its people on the street, the realms in a cartel among
// realms, and its crime as its towns' cases are read. Juniper sixty years on, its rows set down by hand and put back after.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { World } from "../../src/kernel/index.ts";
import {
  BAR,
  BAR_STORE,
  CARTEL_STORE,
  INTOX,
  INTOX_STORE,
  ROOFLESS_STORE,
  ROOF_ROW,
  SMUGGLE,
  SMUGGLE_STORE,
  cartelKey,
  moneyStore,
  politiesOf,
  populationContext,
  refNumber,
  societyStore,
  tradeStore,
  type Polity,
  type RowStore,
} from "../../src/sim/index.ts";
import { G } from "../../src/rules/index.ts";
import {
  UNDERWORLD_VIEWS,
  underworldCrime,
  underworldRead,
  underworldReading,
} from "../../src/host/inspect/underworld.ts";
import { townWrong } from "../../src/host/inspect/justice.ts";
import { yearNow } from "../../src/host/inspect/words.ts";
import { landReadings, lensReading } from "../../src/host/lenses.ts";
import { tipOf } from "../../src/host/inspect/index.ts";
import { underworldShade } from "../../src/view/index.ts";
import { peopledWorld } from "../worlds.ts";

const world = peopledWorld("juniper", 60, { start: "spread" });

/** The most peopled living realm, and its most peopled land that has a town a year old. */
function chosen(w: World): { realm: Polity; cell: number } {
  const ctx = populationContext(w),
    year = yearNow(w),
    people = (p: Polity) => p.members.reduce((n, c) => n + (ctx.provinces.get(c)?.total() ?? 0), 0),
    realm = [...politiesOf(w).living()].sort(
      (a, b) => people(b) - people(a) || (a.ref < b.ref ? -1 : 1),
    )[0]!,
    cell = [...realm.members]
      .filter((c) =>
        ctx.settlements.inProvince(c).some((t) => t.population > 0 && t.founded < year),
      )
      .sort(
        (a, b) => (ctx.provinces.get(b)?.total() ?? 0) - (ctx.provinces.get(a)?.total() ?? 0),
      )[0]!;
  return { realm, cell };
}

/** Set rows down for a test, and put back what was there after it. */
function withRows(
  rows: readonly (readonly [RowStore, string | number, number[]])[],
  run: () => void,
) {
  const was = rows.map(([s, k]) => [s, k, s.get(k)] as const);
  try {
    for (const [s, k, r] of rows) s.set(k, r);
    run();
  } finally {
    for (const [s, k, r] of was)
      if (r) s.set(k, [...r]);
      else s.drop(k);
  }
}

test("an early world, its stores holding nothing yet, reads nothing under the underworld lens", () => {
  const early = peopledWorld("juniper", 2),
    read = underworldRead(early);
  for (const [cell, v] of read.lands) {
    assert.equal(v.length, UNDERWORLD_VIEWS.length);
    for (const x of v) assert.ok(x <= 0, `land ${cell} reads ${x}`);
  }
  assert.equal(read.cartelLands.size, 0);
  for (const [, v] of underworldCrime(early)) assert.ok(v >= 0);
  // (Nothing kept is drawn as nothing: no colour on the ramp.)
  for (const view of UNDERWORLD_VIEWS) assert.equal(underworldShade(view, -1), -1);
});

test("a land whose rows are not kept reads none kept, and its tip says so", () => {
  const { realm, cell } = chosen(world),
    drop = (s: RowStore | null, k: string | number) => {
      const r = s?.get(k);
      s?.drop(k);
      return () => {
        if (s && r) s.set(k, [...r]);
      };
    },
    back = [
      drop(moneyStore(world, SMUGGLE_STORE), realm.ref),
      drop(moneyStore(world, BAR_STORE), realm.ref),
      drop(moneyStore(world, INTOX_STORE), cell),
      drop(societyStore(world, ROOFLESS_STORE), cell),
    ];
  try {
    const v = underworldRead(world).lands.get(cell)!;
    assert.deepEqual(
      [v[0], v[1], v[2], v[4]],
      [-1, -1, -1, -1],
      "smuggling, cartels, addiction and the roofless: none kept",
    );
    assert.match(underworldReading(world, cell, "smuggling")!.line, /keeps no border yet/);
    assert.match(underworldReading(world, cell, "addiction")!.line, /nothing they take is kept/);
    assert.match(underworldReading(world, cell, "roofless")!.line, /no town here keeps a count/);
    assert.equal(underworldReading(world, cell, "cartels")!.stats.length, 0);
  } finally {
    for (const b of back) b();
  }
});

test("rows written into the stores are read as they stand, with their causes and the page that tells them", () => {
  const { realm, cell } = chosen(world),
    smuggle = moneyStore(world, SMUGGLE_STORE)!,
    bars = moneyStore(world, BAR_STORE)!,
    intox = moneyStore(world, INTOX_STORE)!,
    roof = societyStore(world, ROOFLESS_STORE)!,
    cartels = tradeStore(world, CARTEL_STORE)!,
    bar = new Array<number>(18).fill(0),
    ix = new Array<number>(13).fill(0),
    rf = new Array<number>(17).fill(0);
  bar[BAR.barred] = 700;
  bar[BAR.cartel] = 240;
  ix[INTOX.dependent] = 30;
  ix[INTOX.deaths] = 1500;
  ix[INTOX.use + 1] = 120;
  ix[INTOX.lost] = 45;
  rf[ROOF_ROW.street] = 64;
  rf[ROOF_ROW.rent] = 150;
  rf[ROOF_ROW.displaced] = 20;
  rf[ROOF_ROW.kin] = 300;
  withRows(
    [
      // (A quarter slips past; its wedge 40%, half its lands on a border, its carriers organised.)
      [smuggle, realm.ref, [250, 400, 1234, 56, (4 * 0.5 + 2 * 0.24) * 1000, 0]],
      [bars, realm.ref, bar],
      [intox, cell, ix],
      [roof, cell, rf],
      [
        cartels,
        cartelKey(G.iron),
        [700, 500, 600, 150, 200, refNumber(realm.ref) + 1, 0, 0, 0, 0, 40, 0],
      ],
    ],
    () => {
      const read = underworldRead(world),
        v = read.lands.get(cell)!;
      assert.deepEqual([v[0], v[1], v[2], v[4]], [0.25, 0.24, 0.03, 0.064]);
      // (Every land of the realm shares its realm's rows, and is marked in its cartel among realms.)
      for (const c of realm.members) {
        if (!populationContext(world).provinces.get(c)) continue;
        assert.equal(read.lands.get(c)![0], 0.25);
        assert.ok(read.cartelLands.get(c)! >= 1);
      }
      // (The map's readings carry them.)
      const lr = landReadings(world)(cell);
      assert.deepEqual(lr.underworld, v);
      assert.ok(lr.tradeCartel >= 1);

      const sm = underworldReading(world, cell, "smuggling")!;
      assert.match(sm.line, /^Smuggling: 25% of what .* bars or taxes slips past$/);
      assert.deepEqual(
        sm.stats.map((s) => [s.label, s.value]),
        [
          ["Of its lands on a border", "50%"],
          ["What it bars or lays on", "40%"],
          ["Its carriers organised", "24%"],
          ["Smuggled a year", "1,234 grain's worth"],
        ],
      );
      assert.equal(sm.go?.ref, `${realm.ref}#treasury`);

      const ct = underworldReading(world, cell, "cartels")!;
      assert.match(ct.line, /are 24% organised$/);
      assert.equal(ct.stats.find((s) => s.label === "How far it forbids them")?.value, "70%");
      assert.match(ct.stats.at(-1)!.value, /iron \(\+20%\)/);
      assert.equal(ct.go?.ref, `${realm.ref}#treasury`);

      const ad = underworldReading(world, cell, "addiction")!;
      assert.equal(ad.line, "Addiction: 3% of its people need what they take");
      assert.deepEqual(ad.stats[0], {
        label: "Who die of it a year",
        value: "0.15% of its people",
      });
      assert.equal(ad.stats.find((s) => s.label === "Taken: what wakes")?.value, "by 12%");
      assert.equal(ad.stats.find((s) => s.label === "Its realm forbids them")?.value, "70%");
      assert.equal(ad.go?.ref, `cell:0:${cell}#wealth`);

      const ro = underworldReading(world, cell, "roofless")!;
      assert.equal(ro.line, "Without a roof: 6.4% of its towns' people on the street");
      assert.deepEqual(
        ro.stats.map((s) => s.label),
        ["Can't meet the least rent", "Turned out by war, fire or flood", "Taken in"],
      );
      assert.equal(ro.go?.ref, `cell:0:${cell}#lives`);

      // (The tip under a finger carries the page a tap opens.)
      const tip = tipOf(world, `cell:0:${cell}`, "underworld:roofless");
      assert.equal(tip.line, ro.line);
      assert.equal(tip.go, `cell:0:${cell}#lives`);
      assert.equal(lensReading(world, cell, "underworld", "smuggling")!.line, sm.line);
    },
  );
  // (Put back, the store's own rows are read again.)
  assert.notEqual(underworldRead(world).lands.get(cell)![2], 0.03);
});

test("a land's crime is its greatest towns' weights on their peace, weighed by their people", () => {
  const { cell } = chosen(world),
    year = yearNow(world),
    towns = populationContext(world)
      .settlements.inProvince(cell)
      .filter((t) => t.population > 0 && t.founded < year)
      .sort((a, b) => b.population - a.population || (a.ref < b.ref ? -1 : 1))
      .slice(0, 4);
  let people = 0,
    weigh = 0,
    due = 0;
  for (const t of towns) {
    const w = townWrong(world, t, year);
    // (What weighs on it is a quiet year's half and each of its weights by name.)
    assert.ok(Math.abs(w.weigh - 0.5 - w.pressing.reduce((n, [, v]) => n + v, 0)) < 1e-9);
    people += t.population;
    weigh += t.population * w.weigh;
    due += w.due;
  }
  const kept = new Map(underworldCrime(world)).get(cell)!;
  assert.ok(Math.abs(kept - Math.round((weigh / people) * 1000) / 1000) < 1e-9);
  const r = underworldReading(world, cell, "crime")!;
  assert.match(r.line, new RegExp(`^Crime: ${due} cases? due this year in `));
  assert.equal(r.stats[0]!.label, "What weighs on its peace");
  assert.ok(r.stats.length <= 4);
  assert.equal(r.go?.ref, `${towns[0]!.ref}#law`);
});
