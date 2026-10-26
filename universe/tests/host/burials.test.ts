import { test } from "node:test";
import assert from "node:assert/strict";
import { DAY, YEAR, seedFromText } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { levyPlaces } from "../../src/host/fallen.ts";
import { landTitle } from "../../src/host/inspect/names.ts";
import {
  battleOf,
  battlesOfYear,
  burialOf,
  restsFrom,
  townTally,
  townWarDead,
  warRests,
  type Fought,
} from "../../src/host/burials.ts";
import { WAR_BURIAL } from "../../src/bridge/index.ts";
import { populationContext, warsOf } from "../../src/sim/index.ts";

// Phase 55 M225: a battle's fallen are buried where their land lies, told from the battle's record
// (its towns' tallies of its men), never drawn. One world: the first light, a hundred and
// twenty-five years on.

const world = EARTH.build(seedFromText("first light"));
world.runTo(125 * YEAR);
const before = JSON.stringify(world.domainHashes());
const Y = Math.floor(world.now / YEAR),
  ctx = populationContext(world),
  fought: Fought[] = [...warsOf(world).all()].flatMap((war) =>
    war.battles.map((b) => ({ war, b })),
  ),
  // (Recent: a battle's town tallies are kept for these years, so its towns can be told.)
  recent = fought.filter(({ b }) => b.year >= Y - 39 && b.fell);

/** The cells that border a land (its grid's neighbours). */
function bordersOf(land: number): number[] {
  const grid = ctx.generated.grid,
    out: number[] = [];
  for (let k = grid.offsets[land]!; k < grid.offsets[land + 1]!; k++) out.push(grid.neighbours[k]!);
  return out;
}

test("burial follows where the land lies", () => {
  let rows = 0;
  for (const { b } of recent)
    for (const side of [0, 1] as const)
      for (const p of levyPlaces(world, b, side, Infinity))
        if (p.kind === "town" && p.ref) {
          rows++;
          assert.deepEqual(townTally(world, b, side, p.ref), [p.sent, p.dead, p.hurt], p.name);
          const want =
            p.cell === b.land ? "here" : bordersOf(b.land).includes(p.cell) ? "home" : "field";
          assert.equal(burialOf(world, b.land, p.cell), want, `${b.event} ${p.name}`);
        }
  assert.ok(rows > 0, "a town of a recent battle sent men");
});

test("a town's war funerals are those of the battles at its year's turn", () => {
  let buried = 0;
  for (const { b } of recent)
    for (const side of [0, 1] as const)
      for (const p of levyPlaces(world, b, side, Infinity))
        if (p.kind === "town" && p.ref && p.dead > 0) {
          const kind = burialOf(world, b.land, p.cell),
            r = warRests(world, p.ref, b.year + 1).find((x) => x.event === b.event);
          if (kind === "field") {
            assert.equal(r, undefined, `${b.event} lies on the field`);
            continue;
          }
          assert.ok(r, `${b.event} ${p.name}`);
          buried++;
          assert.equal(
            r.at,
            ((b.year + 1) * 365 + (kind === "here" ? 2 : 4)) * DAY + WAR_BURIAL.leaves,
            `${b.event} ${p.name} at`,
          );
          assert.equal(r.dead, p.dead);
          assert.equal(r.home, kind === "home");
          assert.equal(r.where, `the battle at ${landTitle(world, b.land, true)}`);
          assert.deepEqual(r.named, []);
          const eight = Array.from({ length: 8 }, (_, k) => ({
            name: `N${k} Test`,
            age: 20 + k,
            ref: `prsn:0:${k}`,
          }));
          const named = warRests(world, p.ref, b.year + 1, () => eight).find(
            (x) => x.event === b.event,
          );
          assert.equal(named?.named.length, WAR_BURIAL.named, `${b.event} names told`);
        }
  assert.ok(buried > 0, "a town buried its fallen by war");
});

test("townWarDead sums a town's fallen of a year, wherever they lie", () => {
  const towns: { ref: string; year: number }[] = [];
  for (const { b } of recent)
    for (const side of [0, 1] as const)
      for (const p of levyPlaces(world, b, side, Infinity))
        if (p.kind === "town" && p.ref && towns.length < 50)
          towns.push({ ref: p.ref, year: b.year });
  assert.ok(towns.length > 0, "some town rows to sum");
  for (const { ref, year } of towns) {
    let sum = 0;
    for (const { b } of battlesOfYear(world, year))
      for (const side of [0, 1] as const) sum += townTally(world, b, side, ref)?.[1] ?? 0;
    assert.equal(townWarDead(world, ref, year), sum, `${ref} in ${year}`);
    const buried = warRests(world, ref, year + 1).reduce((s, r) => s + r.dead, 0);
    assert.ok(sum >= buried, `${ref} buries no more than it lost`);
  }
});

test("battles found by event and year", () => {
  for (const { b } of fought) assert.equal(battleOf(world, b.event)?.b.event, b.event);
  assert.equal(battleOf(world, "ev:0:999999999"), null);
  const years = new Set(fought.map(({ b }) => b.year));
  for (const y of years)
    assert.equal(
      battlesOfYear(world, y).length,
      fought.filter(({ b }) => b.year === y).length,
      `every battle of year ${y}`,
    );
  assert.equal(
    battlesOfYear(world, Y - 1).length,
    fought.filter(({ b }) => b.year === Y - 1).length,
  );
});

test("old saves bury no one by war", () => {
  let checked = 0;
  for (const { war, b } of recent) {
    if (checked >= 20) break;
    const town = levyPlaces(world, b, 0, Infinity).find((p) => p.kind === "town" && p.ref)?.ref;
    if (!town) continue;
    const { fell, ...old } = b;
    void fell;
    assert.deepEqual(restsFrom(world, town, [{ war, b: old }]), []);
    assert.equal(townTally(world, old, 0, town), null);
    checked++;
  }
  assert.ok(checked > 0, "a recent battle with a town to test");
});

test("looking changes no history", () => {
  assert.equal(JSON.stringify(world.domainHashes()), before);
});
