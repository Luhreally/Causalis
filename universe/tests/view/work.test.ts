import { test } from "node:test";
import assert from "node:assert/strict";
import type { VillagePlan } from "../../src/bridge/index.ts";
import {
  ACTIVITY,
  TRAFFIC_PACE,
  beastsAt,
  faunaOf,
  itemParts,
  minePieces,
  momentOf,
  smokeAt,
  toolHead,
  travellerAt,
  type BeastNow,
  type Carry,
  type Puff,
} from "../../src/view/index.ts";
import { OCC } from "../../src/rules/index.ts";

const DAY = 86_400,
  HOUR = 3_600;

const people: VillagePlan["people"][number][] = Array.from({ length: 24 }, (_, i) => ({
  ref: `prsn:0:${i + 1}`,
  name: `P${i}`,
  home: i % 4,
  age: 30,
  occupation: [OCC.farmer, OCC.crafter, OCC.forager, OCC.trader, OCC.herder][i % 5]!,
  child: false,
}));

const plan: VillagePlan = {
  ref: "town:0:9",
  name: "Delving",
  population: 200,
  market: true,
  hand: false,
  districts: null,
  biome: 8,
  seed: 3,
  homes: [
    { x: 20, z: 0, yaw: 0, household: "hhold:0:1" },
    { x: -20, z: 10, yaw: 1, household: "hhold:0:2" },
    { x: 0, z: -25, yaw: 2, household: null },
    { x: 15, z: 25, yaw: 3, household: null },
  ],
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
};

/** What each person carries through a day: walking out, at work, walking back, at home. */
function dayOfCarrying(p: VillagePlan, i: number, day: number) {
  const seen: { hour: number; activity: number; carry: Carry | null; x: number; z: number }[] = [];
  // (Every half minute: a walk to the fields takes a couple of minutes.)
  for (let h = 0; h < 24; h += 1 / 120) {
    const m = momentOf(p, i, day * DAY + h * HOUR);
    seen.push({ hour: h, activity: m.activity, carry: m.carry, x: m.x, z: m.z });
  }
  return seen;
}

/** A work day for this plan (one in seven rests). */
const workday = (d0: number) =>
  [0, 1, 2, 3, 4, 5, 6].map((k) => d0 + k).find((d) => (d + (plan.seed % 7)) % 7 !== 0)!;

test("a farmer goes out with a tool and works with it in hand; in the harvest they bring sheaves back", () => {
  const spring = workday(40),
    harvest = workday(Math.floor(0.68 * 365));
  for (const [day, back] of [
    [spring, "tool"],
    [harvest, "sheaf"],
  ] as const) {
    const d = dayOfCarrying(plan, 0, day);
    const out = d.filter((s) => s.activity === ACTIVITY.walking && s.hour < 9);
    assert.ok(out.length, "walks out in the morning");
    assert.ok(
      out.every((s) => s.carry === "tool"),
      "with a tool",
    );
    const working = d.filter((s) => s.activity === ACTIVITY.working);
    assert.ok(working.length && working.every((s) => s.carry === "tool"), "working, tool in hand");
    const home = d.filter((s) => s.activity === ACTIVITY.walking && s.hour > 16);
    assert.ok(
      home.some((s) => s.carry === back),
      `back with ${back}`,
    );
    assert.ok(
      d
        .filter((s) => s.activity === ACTIVITY.asleep || s.activity === ACTIVITY.eating)
        .every((s) => s.carry === null),
      "empty-handed at home",
    );
  }
});

test("in a land that digs, crafters walk to the mine with picks and back with ore; by the water, foragers fish; traders carry packs", () => {
  const day = workday(100),
    carried = (occ: number) =>
      new Set(
        people
          .map((p, i) => ({ p, i }))
          .filter(({ p }) => p.occupation === occ)
          .flatMap(({ i }) => dayOfCarrying(plan, i, day).map((s) => s.carry)),
      );
  const crafters = carried(OCC.crafter);
  assert.ok(crafters.has("ore") && crafters.has("tool"), `crafters carry ${[...crafters]}`);
  // Those who dig work at the mine.
  const miners = people
    .map((p, i) => ({ p, i }))
    .filter(
      ({ p, i }) =>
        p.occupation === OCC.crafter && dayOfCarrying(plan, i, day).some((s) => s.carry === "ore"),
    );
  for (const { i } of miners) {
    const at = dayOfCarrying(plan, i, day).find((s) => s.activity === ACTIVITY.working)!;
    assert.ok(
      Math.hypot(at.x - plan.works!.mine!.x, at.z - plan.works!.mine!.z) < 25,
      "at the mine",
    );
  }
  // (A land without a mine has no one bringing ore.)
  const noMine = { ...plan, ref: "town:0:10", works: { mine: null, well: null, factory: null } };
  assert.ok(
    people.every(
      (p, i) =>
        p.occupation !== OCC.crafter ||
        dayOfCarrying(noMine, i, day).every((s) => s.carry !== "ore"),
    ),
  );
  const foragers = carried(OCC.forager);
  assert.ok(foragers.has("fish") || foragers.has("basket"), `foragers carry ${[...foragers]}`);
  assert.ok(carried(OCC.trader).has("pack") || carried(OCC.trader).has("sack"));
  assert.ok(carried(OCC.herder).has("staff"));
});

test("every thing carried is built of a few boxes, and tools are headed by what the land works", () => {
  for (const c of [
    "tool",
    "sheaf",
    "sack",
    "basket",
    "fish",
    "ore",
    "pack",
    "staff",
    "water",
  ] as const) {
    const parts = itemParts(c);
    assert.ok(parts.length >= 1 && parts.length <= 2, c);
  }
  const stone = toolHead("farm"),
    bronze = toolHead("metal"),
    steel = toolHead("modern");
  assert.notDeepEqual(stone, bronze);
  assert.notDeepEqual(bronze, steel);
});

test("a mine is built by its kind: a windlass over a pit, a headframe and engine over a shaft, a stepped quarry", () => {
  const roles = (kind: "pit" | "shaft" | "quarry") =>
    minePieces({ x: 0, z: 0, kind, what: kind === "quarry" ? "stone" : "coal", ref: null }).map(
      (p) => p.role,
    );
  const pit = roles("pit"),
    shaft = roles("shaft"),
    quarry = roles("quarry");
  assert.ok(pit.includes("pit") && pit.includes("spoil") && pit.includes("wheel"));
  assert.ok(!pit.includes("chimney"));
  assert.ok(
    shaft.filter((r) => r === "frame").length >= 5 &&
      shaft.includes("chimney") &&
      shaft.includes("track"),
  );
  assert.ok(quarry.includes("step") && quarry.includes("block") && !quarry.includes("pit"));
});

test("the road's traffic keeps to the road at its own pace: pack beasts where the flocks carry, carts in the engines' age, lorries after", () => {
  const f = faunaOf(plan, 160, 2, true);
  assert.equal(f.road.kind, "pack");
  assert.ok(f.road.species >= 0 && f.species[f.road.species]!.name === "grey horse");
  assert.ok(f.species[f.road.species]!.burden);
  assert.equal(faunaOf({ ...plan, era: "industry" }, 160, 2, true).road.kind, "cart");
  assert.equal(faunaOf({ ...plan, era: "modern" }, 160, 2, true).road.kind, "lorry");
  // Sheep carry nothing: porters walk.
  const sheep = {
    ...plan,
    fauna: {
      ...plan.fauna!,
      flock: { ref: "spec:0:5", name: "pale woolly sheep", size: 60, wool: true, herders: 4 },
    },
  };
  assert.equal(faunaOf(sheep, 160, 2, true).road.kind, "porter");
  // On the road, moving at its pace, never jumping.
  const len = Math.hypot(plan.road.x, plan.road.z);
  for (let s = 0; s < 3000; s += 7) {
    const a = travellerAt(f.road.way, 1, s, TRAFFIC_PACE.pack),
      b = travellerAt(f.road.way, 1, s + 1, TRAFFIC_PACE.pack),
      along = (a.x * plan.road.x + a.z * plan.road.z) / len,
      off = Math.abs((-a.x * plan.road.z + a.z * plan.road.x) / len);
    assert.ok(along > 0 && along < len && off < 5, "on the road");
    const step = Math.hypot(b.x - a.x, b.z - a.z);
    assert.ok(step < TRAFFIC_PACE.pack * 1.3 || step > 5.5, `at a walk (${step.toFixed(2)} m/s)`);
  }
  // The beasts go with it, marked as working.
  const out: BeastNow[] = [],
    n = beastsAt(f, 50, out);
  assert.equal(out.slice(0, n).filter((b) => b.task === 1).length, f.road.count);
});

test("hearths smoke more at the hours they cook; works smoke always", () => {
  const hearths = Array.from({ length: 30 }, (_, i) => ({ x: i * 10, y: 5, z: 0, dark: 0 })),
    works = [{ x: 0, y: 30, z: 0, dark: 1 }],
    out: Puff[] = [];
  const at = (hour: number, src = hearths) => smokeAt(src, hour, 10, out);
  assert.ok(at(7) > at(13), "more at breakfast than at noon");
  assert.ok(at(19) > at(2), "more at supper than at night");
  assert.ok(at(3, works) > 0 && at(13, works) === at(3, works), "works burn always");
  smokeAt(works, 12, 10, out);
  assert.ok(
    out.slice(0, 5).every((p) => p.y >= 30 && p.dark === 1),
    "black smoke from the stack's top",
  );
});
