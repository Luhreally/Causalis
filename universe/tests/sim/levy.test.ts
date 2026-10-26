// The levy and the losses (Phase 55 M224b): a realm raises its host from all its lands on its home
// world by their fighting men (D2), and a battle's dead come from the men engaged, struck by the
// foe's arms against their own guard, the beaten the most (D5). First the rule alone, with each kit
// written as numbers; then a world's battles: each side's lands sum exactly to the men it brought,
// its fallen and its wounded; and the hand's village sends no one.
import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText } from "../../src/kernel/index.ts";
import { offworldSite } from "../../src/gen/index.ts";
import { fellTotals, unpackTowns, type Blow } from "../../src/rules/index.ts";
import {
  LOSSES,
  battleDead,
  makePopulationWorld,
  politiesOf,
  populationContext,
  warsOf,
  type HostInBattle,
  type HostTerms,
} from "../../src/sim/index.ts";

/** A host's terms as numbers: its care, its blow, its shock, protection, fire and range. */
const terms = (
  care: number,
  blow: Blow,
  shock: number,
  protection: number,
  fire: number,
  range: number,
): HostTerms => ({ care, blow, shock, protection, fire, range, bore: null });

/** Four kits as performanceOf read them on 2026-10-26 (the test uses the numbers, not the kits). */
const KITS = {
  bronze: terms(0.25, "edge", 0.82, 0.3, 0, 0),
  "steel sword, plate and cavalry": terms(0.6, "edge", 1.2, 0.85, 0, 0),
  "rifle, plate and cavalry": terms(0.75, "shot", 1.15, 0.85, 0, 1.15),
  "machine gun, helmet and armoured car": terms(1, "shot", 1.2, 0.95, 6.4919, 1.3255),
} as const;
type Kit = keyof typeof KITS;

/** Both sides lie low under the fiercer side's fire (war.ts fireTerms). */
const disperse = (a: HostTerms, b: HostTerms) => 1 / (1 + 0.12 * Math.max(a.fire, b.fire));
const host = (fielded: number, kit: HostTerms): HostInBattle => ({ fielded, terms: kit });
/** A kit fighting itself, ten thousand a side, the attacker winning. */
const itself = (kit: Kit) =>
  battleDead(
    host(10_000, KITS[kit]),
    host(10_000, KITS[kit]),
    true,
    disperse(KITS[kit], KITS[kit]),
    60,
  );
const total = (dead: readonly [number, number]) => dead[0] + dead[1];

test("each kit fighting itself, ten thousand a side, the attacker winning, loses as the rule says", () => {
  // (The spec's starting LOSSES gave [701, 1576], [451, 1016], [466, 1048] and [406, 913]; these
  // are the calibrated ones, §8.4's levers 1–3: open 0.75, fire 3, hit 0.75. The beaten bronze host
  // is struck at the most, 0.9 of those it engages.)
  assert.deepEqual(itself("bronze"), [876, 1820]);
  assert.deepEqual(itself("steel sword, plate and cavalry"), [564, 1270]);
  assert.deepEqual(itself("rifle, plate and cavalry"), [696, 1565]);
  assert.deepEqual(itself("machine gun, helmet and armoured car"), [648, 1457]);
});

test("better guarded hosts lose fewer, fire lays men low, and the beaten lose the most", () => {
  const bronze = total(itself("bronze")),
    steel = total(itself("steel sword, plate and cavalry")),
    rifle = total(itself("rifle, plate and cavalry")),
    machine = total(itself("machine gun, helmet and armoured car"));
  assert.ok(bronze > steel, `bronze ${bronze} against steel ${steel}`);
  assert.ok(
    machine < bronze && machine < rifle,
    `machine ${machine}, bronze ${bronze}, rifle ${rifle}`,
  );
  for (const kit of Object.keys(KITS) as Kit[]) {
    const [winner, loser] = itself(kit);
    assert.ok(loser > winner, `${kit}: the beaten ${loser} against the winner ${winner}`);
  }
  // With the same foe, a guard of 0.6 loses fewer than one of 0.3, winning or beaten.
  const foe = host(10_000, KITS.bronze),
    guarded = host(10_000, { ...KITS.bronze, protection: 0.6 });
  for (const won of [true, false]) {
    const [heavy] = battleDead(guarded, foe, won, 1, 60),
      [light] = battleDead(host(10_000, KITS.bronze), foe, won, 1, 60);
    assert.ok(heavy < light, `${won ? "winning" : "beaten"}: ${heavy} against ${light}`);
  }
});

test("no host loses more than 0.41 of the men it engages, nor any where it brings none", () => {
  const sizes = [0, 1, 10, 1000, 100_000],
    kits = Object.values(KITS);
  let cases = 0;
  for (const na of sizes)
    for (const nb of sizes)
      for (const ka of kits)
        for (const kb of kits)
          for (const won of [true, false]) {
            const a = host(na, ka),
              b = host(nb, kb),
              dead = battleDead(a, b, won, disperse(ka, kb), 60);
            for (const [i, own, foe] of [
              [0, a, b],
              [1, b, a],
            ] as const) {
              const engaged = Math.min(own.fielded, LOSSES.engage * foe.fielded),
                most = Math.round(0.41 * engaged);
              assert.ok(Number.isInteger(dead[i]) && dead[i] >= 0, `dead ${dead[i]}`);
              assert.ok(dead[i] <= most && most <= own.fielded, `${dead[i]} of ${engaged} engaged`);
              if (own.fielded === 0) assert.equal(dead[i], 0);
            }
            cases++;
          }
  assert.equal(cases, 800);
});

const world = makePopulationWorld(seedFromText("first light"), { start: "spread" });
world.runTo(100 * YEAR);
const ctx = populationContext(world),
  battles = () =>
    warsOf(world)
      .all()
      .flatMap((w) => w.battles);

test("each side's men come from its realm's lands on its home world, and sum to what it brought, lost and carried home wounded", () => {
  const all = battles();
  assert.ok(all.length >= 200, `${all.length} battles`);
  let spread = 0;
  for (const b of all)
    for (const i of [0, 1] as const) {
      const lands = b.fell![i];
      assert.deepEqual(
        fellTotals(lands),
        [b.fielded![i], b.fallen[i], b.wounded![i]],
        `${b.event} side ${i}`,
      );
      lands.forEach(([cell, sent, dead], k) => {
        if (k) assert.ok(cell > lands[k - 1]![0], "each land once, ascending");
        assert.equal(offworldSite(ctx.generated, cell), null, "no land off the home world");
        assert.ok(sent > 0 && dead <= sent, "a land sends someone, and its dead are of those");
      });
      if (lands.filter((l) => l[2] > 0).length >= 2) spread++;
    }
  assert.ok(spread >= 1, "some side's dead come from two lands or more");
});

test("the hand's village sends no one", () => {
  // A realm now at war (the one in the most wars), its most peopled land on the home world, and
  // that land's most peopled village: the hand is laid there and the world runs three years.
  const wars = warsOf(world)
      .all()
      .filter((w) => w.ended === null),
    at = (ref: string) => wars.filter((w) => w.attacker === ref || w.defender === ref).length,
    realm = politiesOf(world)
      .living()
      .filter((p) => at(p.ref) > 0)
      .sort((x, y) => at(y.ref) - at(x.ref) || (x.ref < y.ref ? -1 : 1))[0];
  assert.ok(realm, "some realm is at war");
  const people = (c: number) => ctx.provinces.get(c)?.total() ?? 0,
    land = realm.members
      .filter((c) => !offworldSite(ctx.generated, c))
      .sort((x, y) => people(y) - people(x) || x - y)[0]!,
    towns = ctx.settlements.inProvince(land);
  let k = 0;
  for (let i = 1; i < towns.length; i++) if (towns[i]!.population > towns[k]!.population) k = i;
  const village = towns[k];
  assert.ok(village && village.population > 0, "a peopled village");
  const before = new Set(battles().map((b) => b.event));
  world.submit("hand.lay", { village: village.ref });
  world.runTo(world.now + 3 * YEAR);
  let tuples = 0;
  for (const b of battles())
    if (!before.has(b.event))
      for (const side of b.fell!)
        for (const [cell, , , , flat] of side) {
          if (cell !== land) continue;
          tuples++;
          assert.ok(flat !== undefined, "a recent battle keeps its towns");
          assert.deepEqual(
            unpackTowns(flat)[k] ?? [0, 0, 0],
            [0, 0, 0],
            "the held village sent no one",
          );
        }
  assert.ok(tuples >= 1, "its land sent men to a battle after the laying");
});
