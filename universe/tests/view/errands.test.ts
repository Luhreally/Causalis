import { test } from "node:test";
import assert from "node:assert/strict";
import type { VillageLife, VillagePlan } from "../../src/bridge/index.ts";
import {
  HEAP_MOST,
  heapCounts,
  momentOf,
  prepareDay,
  restDay,
  storeHeaps,
  storeSpots,
  storesNow,
  townDay,
  villageSolids,
  type Moment,
} from "../../src/view/index.ts";
import { OCC } from "../../src/rules/index.ts";

const DAY = 86_400,
  HOUR = 3_600;

const OCCS = [OCC.farmer, OCC.farmer, OCC.crafter, OCC.herder, OCC.forager, OCC.crafter];
const people: VillagePlan["people"][number][] = Array.from({ length: 30 }, (_, i) => ({
  ref: `prsn:0:${i + 1}`,
  name: `P${i}`,
  home: i % 6,
  age: 34,
  occupation: i % 10 === 9 ? OCC.dependent : OCCS[i % 6]!,
  child: false,
}));

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
  ref: "town:0:7",
  name: "Harrowby",
  population: 240,
  market: false,
  hand: false,
  districts: null,
  biome: 8,
  seed: 3,
  homes: Array.from({ length: 6 }, (_, k) => ({
    x: 22 * Math.cos(k + 0.3),
    z: 22 * Math.sin(k + 0.3),
    yaw: k,
    household: `hhold:0:${k + 1}`,
  })),
  fields: [
    { x: 160, z: 0, w: 40, d: 25, yaw: 0 },
    { x: 150, z: 60, w: 40, d: 25, yaw: 0.2 },
  ],
  pasture: { x: -200, z: 0, r: 90 },
  wild: 320,
  water: { x: 0, z: -500 },
  house: { walls: "wattle", roof: "thatch", form: "long", pitch: 45, design: null },
  body: null,
  road: { x: 700, z: 700 },
  era: "metal",
  people,
  fauna: {
    wild: [],
    flock: { ref: "spec:0:4", name: "grey horse", size: 380, wool: false, herders: 6 },
    raided: false,
  },
  works: {
    mine: { x: -150, z: 150, kind: "pit", what: "ore", ref: null },
    well: null,
    factory: null,
  },
  life,
};

/** The first day from `from` on that is not a day of rest. */
function workDay(p: VillagePlan, from: number): number {
  let day = from;
  while (restDay(p, day)) day++;
  return day;
}

/** Someone's moments through the working hours, a minute apart. */
function hoursOf(p: VillagePlan, i: number, day: number, from = 6, to = 19): Moment[] {
  const out: Moment[] = [];
  for (let m = from * 60; m < to * 60; m++) out.push(momentOf(p, i, day * DAY + m * 60));
  return out;
}

const farmers = people.flatMap((p, i) => (p.occupation === OCC.farmer ? [i] : []));

test("the harvest's reapers bring their sheaves to the granary, and its grain rises", () => {
  // (A day in the reaping: the year's 0.66.)
  const day = workDay(plan, 365 * 40 + 240),
    town = townDay(plan, day, villageSolids(plan)),
    reapers = town.roles.flatMap((r, i) => (r.kind === "reap" ? [i] : []));
  assert.deepEqual(reapers, farmers, "every farmer reaps at the harvest");
  const granary = storeSpots(plan, villageSolids(plan), day * DAY).granary,
    seen = hoursOf(plan, reapers[0]!, day);
  assert.ok(
    seen.some((m) => m.carry === "sheaf"),
    "a reaper carries the sheaves",
  );
  assert.ok(
    seen.some(
      (m) =>
        m.task === "load" &&
        Math.hypot(m.x - granary.door.x, m.z - granary.door.z) < 4 &&
        /granary/.test(m.why ?? ""),
    ),
    "and stacks them in at the granary's door",
  );
  assert.ok(
    seen.some((m) => m.task === "reap" && m.why === "Reaping: the harvest is in"),
    "reaping, and why",
  );
  const morning = storesNow(plan, day * DAY + 6 * HOUR),
    evening = storesNow(plan, day * DAY + 20 * HOUR);
  assert.ok(evening.have.grain > morning.have.grain, "the granary fuller by evening");
  assert.ok(evening.brought.grain > 0);
  assert.equal(evening.lean, false);
  assert.ok(evening.doing.some((d) => d.kind === "reap" && d.n === farmers.length));
});

test("builders carry beams from the yard to the rising home, and the yard never runs out", () => {
  // (A summer's day, the year's 0.45: the village raising its next home.)
  const day = workDay(plan, 365 * 40 + 164),
    town = townDay(plan, day, villageSolids(plan)),
    builders = town.roles.flatMap((r, i) => (r.kind === "build" ? [i] : [])),
    fellers = town.roles.filter((r) => r.kind === "cut").length,
    site = life.site!,
    yard = storeSpots(plan, villageSolids(plan), day * DAY).yard;
  assert.ok(builders.length >= 2, `builders at the site (${builders.length})`);
  assert.equal(town.sites.length, 1);
  assert.ok(fellers >= 1, "a feller to keep the yard in timber");
  const seen = builders.flatMap((i) => hoursOf(plan, i, day));
  assert.ok(
    seen.some((m) => m.carry === "beam"),
    "beams carried",
  );
  assert.ok(
    seen.some(
      (m) =>
        m.task === "build" &&
        Math.hypot(m.x - site.x, m.z - site.z) < 14 &&
        /Raising/.test(m.why ?? ""),
    ),
    "raising the new home at its walls",
  );
  assert.ok(
    seen.some((m) => m.task === "load" && Math.hypot(m.x - yard.door.x, m.z - yard.door.z) < 4),
    "taking a load at the yard",
  );
  // The yard keeps some timber all day, as builders take it and fellers bring it.
  let low = Infinity,
    taken = 0,
    brought = 0;
  for (let m = 0; m < 24 * 60; m += 10) {
    const s = storesNow(plan, day * DAY + m * 60);
    low = Math.min(low, s.have.wood);
    taken = s.taken.wood;
    brought = s.brought.wood;
  }
  assert.ok(low >= 1, `timber in the yard all day (${low})`);
  assert.ok(taken >= builders.length, `builders took from the yard (${taken})`);
  assert.ok(brought >= 1, `fellers brought timber in (${brought})`);
  const now = storesNow(plan, day * DAY + 11 * HOUR);
  assert.equal(now.sites.length, 1);
  assert.equal(now.sites[0]!.hands, builders.length);
  assert.equal(now.have.stone, 0, "no stone in a yard that raises none");
});

test("the seasons set the farmers' work: sowing, the hoe, the slack season's firewood", () => {
  const ground = villageSolids(plan),
    kinds = (from: number) => {
      const day = workDay(plan, 365 * 40 + from);
      return farmers.map((i) => townDay(plan, day, ground).roles[i]!.kind);
    };
  const spring = kinds(91);
  assert.ok(
    spring.every((k) => k === "sow" || k === "build"),
    "sowing in the spring",
  );
  assert.ok(spring.filter((k) => k === "sow").length > spring.length / 2);
  assert.ok(
    kinds(164).every((k) => k === "hoe" || k === "build"),
    "the hoe in summer (a hand at the next home)",
  );
  const winter = kinds(347);
  assert.ok(winter.every((k) => ["firewood", "mend", "hoe", "build"].includes(k)));
  assert.ok(
    winter.some((k) => k !== "hoe"),
    "firewood or mending in the slack season",
  );
});

test("a lean year: the granary has nothing to give, and the idle go out to the wild", () => {
  const lean: VillagePlan = { ...plan, ref: "town:0:8", life: { ...life, fed: 0.7 } },
    day = workDay(lean, 365 * 40 + 164),
    town = townDay(lean, day, villageSolids(lean));
  assert.equal(town.lean, true);
  lean.people.forEach((p, i) => {
    if (p.occupation === OCC.dependent) assert.equal(town.roles[i]!.kind, "forage");
  });
  // Every household sends one of its own for bread, and comes home without.
  const homes = new Set(town.roles.flatMap((r, i) => (r.fetch ? [lean.people[i]!.home] : [])));
  assert.equal(homes.size, lean.homes.length);
  const fetcher = town.roles.findIndex((r) => r.fetch),
    seen = hoursOf(lean, fetcher, day, 6, 23);
  assert.ok(seen.some((m) => m.why === "The granary has nothing to give: the year is lean"));
  assert.equal(storesNow(lean, day * DAY + 12 * HOUR).lean, true);
});

test("a day is the same however it is asked for: laid out ahead, or as it comes", () => {
  const day = workDay(plan, 365 * 41 + 250),
    ahead: VillagePlan = JSON.parse(JSON.stringify(plan)),
    fresh: VillagePlan = JSON.parse(JSON.stringify(plan));
  let laid = false,
    rounds = 0;
  while (!laid && rounds++ < 100) laid = prepareDay(ahead, day, 4);
  assert.ok(laid && rounds > 2, "laid a few at a time");
  for (const h of [7.2, 10.5, 12.3, 15.9, 18.4])
    for (let i = 0; i < people.length; i += 3)
      assert.deepEqual(
        momentOf(ahead, i, day * DAY + h * HOUR),
        momentOf(fresh, i, day * DAY + h * HOUR),
      );
  assert.deepEqual(
    storesNow(ahead, day * DAY + 14 * HOUR),
    storesNow(fresh, day * DAY + 14 * HOUR),
  );
});

test("the stores' heaps hold as much as the stores, behind where they are brought", () => {
  const spots = storeSpots(plan, villageSolids(plan), 0),
    n = heapCounts(spots, { grain: 6, wood: 50, stone: 3, ore: 20 });
  assert.deepEqual(n, { sacks: 12, logs: HEAP_MOST.logs, stones: 3, ore: 12 });
  const heaps = storeHeaps(spots, n, 1);
  assert.equal(heaps.sacks.length, 12);
  assert.equal(heaps.logs.length, HEAP_MOST.logs);
  assert.equal(heaps.stones.length, 3);
  assert.equal(heaps.ore.length, 1);
  const behind = (s: { x: number; z: number; yaw: number }, p: { x: number; z: number }) =>
    (p.x - s.x) * Math.sin(s.yaw) + (p.z - s.z) * Math.cos(s.yaw);
  for (const p of heaps.sacks) {
    assert.ok(behind(spots.granary, p) < 0, "sacks behind the granary's door");
    assert.ok(p.y - p.sy / 2 >= -1e-9, "resting on the ground or a sack");
  }
  for (const p of [...heaps.logs, ...heaps.stones, ...heaps.ore])
    assert.ok(behind(spots.yard, p) < 0, "the yard's heaps behind its door");
  for (const p of heaps.logs) assert.ok(p.y - p.sx / 2 >= -1e-9);
  // A granary with a building of its own keeps its grain within; an empty store, no heap.
  const housed = { ...spots, granary: { ...spots.granary, heap: false } };
  assert.equal(heapCounts(housed, { grain: 6, wood: 0, stone: 0, ore: 0 }).sacks, 0);
  assert.deepEqual(heapCounts(spots, { grain: 0, wood: 0, stone: 0, ore: 0 }), {
    sacks: 0,
    logs: 0,
    stones: 0,
    ore: 0,
  });
});
