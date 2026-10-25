import { test } from "node:test";
import assert from "node:assert/strict";
import type { VillageLife, VillagePlan } from "../../src/bridge/index.ts";
import {
  SAPLING_DAYS,
  STUMP_DAYS,
  fellingNow,
  momentOf,
  prepareDay,
  restDay,
  townDay,
  treesOf,
  villageSolids,
} from "../../src/view/index.ts";
import { OCC } from "../../src/rules/index.ts";

// Phase 41 M200: the woodlot. A feller's tree comes down at the end of their first blows, away
// from them; it lies as they cut it up and carry it off, a log at a time; then a stump stands
// where it stood, and later a sapling, grown at last to a tree to fell again. The next tree
// felled is the next nearest the yard still standing.

const DAY = 86_400,
  HOUR = 3_600;

const OCCS = [OCC.farmer, OCC.crafter, OCC.crafter, OCC.herder, OCC.forager, OCC.crafter];
const life: VillageLife = {
  fed: 1,
  growing: true,
  war: false,
  unrest: 0,
  faith: null,
  talk: [],
  site: { x: 45, z: 35, yaw: 0.4, progress: 0.3 },
  mourning: [],
  newborn: [],
};
const plan: VillagePlan = {
  ref: "town:0:31",
  name: "Fellwood",
  population: 240,
  market: false,
  hand: false,
  districts: null,
  // (A land of broadleaf woods.)
  biome: 9,
  seed: 3,
  homes: Array.from({ length: 6 }, (_, k) => ({
    x: 22 * Math.cos(k + 0.3),
    z: 22 * Math.sin(k + 0.3),
    yaw: k,
    household: `hhold:0:${k + 1}`,
  })),
  fields: [{ x: 160, z: 0, w: 40, d: 25, yaw: 0 }],
  pasture: { x: -200, z: 0, r: 90 },
  wild: 320,
  water: null,
  house: { walls: "wattle", roof: "thatch", form: "long", pitch: 45, design: null },
  body: null,
  road: { x: 700, z: 700 },
  era: "metal",
  people: Array.from({ length: 30 }, (_, i) => ({
    ref: `prsn:0:${i + 1}`,
    name: `P${i}`,
    home: i % 6,
    age: 34,
    occupation: OCCS[i % 6]!,
    child: false,
  })),
  life,
};
const ground = villageSolids(plan);

/** A working day from \`from\` on with fellers at work, its day laid out as the renderer lays it. */
function fellingDay(from: number): { day: number; fellers: number[] } {
  for (let day = from; day < from + 40; day++) {
    if (restDay(plan, day)) continue;
    const fellers = townDay(plan, day, ground).roles.flatMap((r, i) =>
      r.kind === "cut" ? [i] : [],
    );
    if (!fellers.length) continue;
    prepareDay(plan, day, 1e6);
    return { day, fellers };
  }
  throw new Error("no feller in forty days");
}

test("a feller's tree comes down at their first blows' end, lies as it is cut up, and leaves a stump", () => {
  assert.ok(treesOf(plan, 0.35).length > 20, "a wooded land");
  const { day } = fellingDay(365 * 30 + 60),
    dawn = fellingNow(plan, day * DAY + 5 * HOUR);
  assert.ok(dawn.next !== null, "a tree to come down today");
  assert.equal(dawn.falling.length, 0, "none down at dawn");
  const when = dawn.next!,
    coming = fellingNow(plan, when + 15),
    lying = fellingNow(plan, when + 120),
    later = fellingNow(plan, when + 1.5 * HOUR),
    evening = fellingNow(plan, day * DAY + 21 * HOUR);
  const tree = coming.falling[0]!;
  assert.ok(tree.over > 0 && tree.over < 1, `coming down (${tree.over.toFixed(2)} over)`);
  assert.ok(coming.down.has(tree.index), "no longer standing");
  const lain = lying.falling.find((f) => f.index === tree.index)!;
  assert.equal(lain.over, 1, "down");
  const cut = later.falling.find((f) => f.index === tree.index);
  assert.ok(!cut || cut.left < lain.left, "cut shorter as its logs are carried off");
  assert.ok(evening.stumps.includes(tree.index), "a stump by evening");
  assert.ok(!evening.falling.some((f) => f.index === tree.index), "carried off");
  // Felled away from the one who felled it: they stood on the yard's side of it, facing it.
  const feller = momentOf(
    plan,
    townDay(plan, day, ground).roles.findIndex((r) => r.kind === "cut"),
    when - 60,
  );
  assert.equal(feller.task, "chop");
  assert.ok(
    Math.abs(Math.atan2(Math.sin(feller.yaw - tree.yaw), Math.cos(feller.yaw - tree.yaw))) < 0.01,
  );
});

test("the next day's trees are the next nearest the yard still standing; a stump grows a sapling, and a tree again", () => {
  const first = fellingDay(365 * 31 + 30),
    felledFirst = new Set(
      fellingNow(plan, first.day * DAY + 21 * HOUR).stumps.filter(
        (k) => !fellingNow(plan, first.day * DAY + 1).stumps.includes(k),
      ),
    ),
    second = fellingDay(first.day + 1),
    evening = fellingNow(plan, second.day * DAY + 21 * HOUR),
    felledSecond = evening.stumps.filter(
      (k) => !felledFirst.has(k) && !fellingNow(plan, second.day * DAY + 1).stumps.includes(k),
    );
  assert.ok(felledFirst.size > 0 && felledSecond.length > 0);
  for (const k of felledSecond) assert.ok(!felledFirst.has(k), "never a stump felled again");
  // A season on, a sapling where the first stood; years on, a tree again.
  const k = [...felledFirst][0]!,
    sapling = fellingNow(plan, (first.day + STUMP_DAYS + 200) * DAY);
  assert.ok((sapling.saplings.get(k) ?? 0) > 0, "a sapling growing");
  const grown = fellingNow(plan, (first.day + STUMP_DAYS + SAPLING_DAYS + 1) * DAY);
  assert.ok(!grown.down.has(k), "a tree again");
});
