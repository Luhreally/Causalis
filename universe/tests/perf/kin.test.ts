// Phase 55 wave 5: a person's page with its Family and Body tabs within 30 ms, their card's family
// and body lines within 10 ms — as the town view asks them, its rosters folded for its plan — over
// the largest town's line holders and the fallen and maimed of the largest recent battles (its
// levy's men among them). The worst of each is logged with its median and p90; the p90 is held to
// the bound. (npm test runs tests/perf alone, after the rest.)
import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, type Ref } from "../../src/kernel/index.ts";
import { populationContext, warsOf } from "../../src/sim/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { villagePlan } from "../../src/host/village.ts";
import { battleRoll } from "../../src/host/roll.ts";
import { LINE, townRoster } from "../../src/host/roster.ts";
import { kinCard } from "../../src/host/kin.ts";
import { pageOf } from "../../src/host/inspect/index.ts";

/** The most a page with its Family and Body tabs may take, and a card's lines (ms): twice on CI's shared runners. */
const PAGE_MS = process.env.CI ? 60 : 30,
  CARD_MS = process.env.CI ? 20 : 10;

const world = EARTH.build(seedFromText("first light"));
world.runTo(125 * YEAR);
const Y = Math.floor(world.now / YEAR);
const at = (xs: readonly number[], q: number) =>
  [...xs].sort((a, b) => a - b)[Math.floor(q * (xs.length - 1))]!;
const timed = (f: () => unknown) => {
  const t = performance.now();
  f();
  return performance.now() - t;
};

test("a person's page with Family and Body within 30 ms, their card within 10 ms", () => {
  const town = populationContext(world)
    .settlements.all()
    .filter((s) => s.population > 0)
    .sort((a, b) => b.population - a.population || (a.ref < b.ref ? -1 : 1))[0]!;
  // (The town view first: its plan folds its roster.)
  villagePlan(world, town.ref as Ref, undefined, 480);
  const roster = townRoster(world, town.ref),
    refs: string[] = [];
  for (let k = 0; k < Math.ceil(town.population / LINE) && refs.length < 40; k++) {
    const h = roster.holder(k);
    if (h) refs.push(h.ref);
  }
  const battles = [...warsOf(world).all()]
    .flatMap((w) => w.battles)
    .filter((b) => b.fell && b.year >= Y - 5)
    .sort((p, q) => q.year - p.year || (p.event < q.event ? -1 : p.event > q.event ? 1 : 0))
    .slice(0, 3);
  for (const b of battles) {
    const roll = battleRoll(world, b.event, 360);
    if (!roll) continue;
    for (const side of [roll.attacker, roll.defender])
      refs.push(
        ...side.fell.slice(0, 6).map((e) => e.ref),
        ...side.hurt
          .filter((e) => e.maimed)
          .slice(0, 4)
          .map((e) => e.ref),
      );
  }
  // Warm the code on a few, then each once for its card and once for its page.
  for (const ref of refs.slice(0, 4)) {
    kinCard(world, ref);
    pageOf(world, ref);
  }
  const cards = refs.map((ref) => ({ ref, ms: timed(() => kinCard(world, ref)) })),
    pages = refs.map((ref) => ({ ref, ms: timed(() => pageOf(world, ref)) }));
  const worst = (xs: { ref: string; ms: number }[]) =>
    [...xs].sort((a, b) => b.ms - a.ms || (a.ref < b.ref ? -1 : 1))[0]!;
  const line = (what: string, xs: { ref: string; ms: number }[]) =>
    `${what}: median ${at(
      xs.map((x) => x.ms),
      0.5,
    ).toFixed(2)} ms, p90 ${at(
      xs.map((x) => x.ms),
      0.9,
    ).toFixed(2)}, worst ${worst(xs).ms.toFixed(2)} (${worst(xs).ref})`;
  console.log(`${refs.length} people of ${town.name} and its battles' rolls.`);
  console.log(line("card", cards));
  console.log(line("page with Family and Body", pages));
  assert.ok(refs.length >= 40, `${refs.length} people timed`);
  const p90 = (xs: { ms: number }[]) =>
    at(
      xs.map((x) => x.ms),
      0.9,
    );
  assert.ok(p90(cards) <= CARD_MS, `a card's lines took ${p90(cards).toFixed(1)} ms (p90)`);
  assert.ok(p90(pages) <= PAGE_MS, `a page took ${p90(pages).toFixed(1)} ms (p90)`);
});
