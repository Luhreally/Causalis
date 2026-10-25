import { test } from "node:test";
import assert from "node:assert/strict";
import type { VillagePlan } from "../../src/bridge/index.ts";
import { OCC } from "../../src/rules/index.ts";
import {
  ACTIVITY,
  FLIGHT,
  HUNT_DONE,
  HUNT_PARTY,
  HUNT_RUSH,
  HUNT_STALK,
  beastsAt,
  defaultBody,
  faunaOf,
  gameAt,
  huntGround,
  huntOn,
  hunterAt,
  momentOf,
  restDay,
  townDay,
  villageSolids,
  type BeastNow,
} from "../../src/view/index.ts";

// Phase 47 M209: the hunt — the town's hunters out together after the game in the wild beyond its
// fields; the stalk, the rush, one brought down (or the herd away); the kill carried home.

const DAY = 86_400,
  HOUR = 3_600,
  Y = 40 * 365;

const people: VillagePlan["people"][number][] = Array.from({ length: 24 }, (_, i) => ({
  ref: `prsn:0:${i + 1}`,
  name: `P${i}`,
  home: i % 8,
  age: 30,
  occupation: [OCC.forager, OCC.farmer, OCC.forager, OCC.crafter][i % 4]!,
  child: false,
}));

const plan = {
  ref: "town:0:47",
  name: "Spearholt",
  population: 280,
  market: false,
  hand: false,
  districts: null,
  biome: 9,
  seed: 4,
  homes: Array.from({ length: 8 }, (_, k) => ({
    x: 24 * Math.cos(k * 0.8),
    z: 24 * Math.sin(k * 0.8),
    yaw: k,
    household: `hhold:0:${k + 1}`,
  })),
  fields: [
    { x: 170, z: 10, w: 40, d: 25, yaw: 0 },
    { x: 150, z: 70, w: 40, d: 25, yaw: 0.3 },
  ],
  pasture: { x: 0, z: 220, r: 90 },
  wild: 320,
  water: { x: 0, z: -700 },
  house: { walls: "timber", roof: "thatch", form: "long", pitch: 45, design: null },
  body: null,
  road: { x: 900, z: 0 },
  era: "metal",
  people,
  fauna: {
    wild: [
      {
        ref: "spec:0:5",
        name: "red deer",
        niche: "grazer",
        size: 90,
        wool: false,
        stock: 0.8,
        body: defaultBody("grazer", 90, false),
      },
    ],
    flock: null,
    raided: false,
  },
  works: { mine: null, well: null, factory: null },
  life: {
    fed: 1,
    growing: true,
    war: false,
    unrest: 0,
    faith: null,
    talk: [],
    site: null,
    mourning: [],
    newborn: [],
  },
} as unknown as VillagePlan;

/** The first hunting day on or after a day, with or without a kill. */
function huntDay(from: number, kill: boolean): number {
  for (let d = from; d < from + 400; d++) {
    const h = huntOn(plan, d);
    if (h && !!h.kill === kill) return d;
  }
  throw new Error("no such hunt");
}

test("the game grazes in the wild away from the fields, clear of the pasture and the water", () => {
  const g = huntGround(plan)!,
    p = plan.pasture,
    w = plan.water!;
  assert.ok(g, "no ground for the game");
  assert.ok(Math.hypot(g.x, g.z) > 80, "the game among the homes");
  assert.ok(g.x < 0, "the game toward the fields");
  assert.ok(Math.hypot(g.x - p.x, g.z - p.z) > p.r + 60);
  assert.ok(Math.hypot(g.x - w.x, g.z - w.z) > 300);
  // (No game, or no one to hunt it: no ground, no hunts.)
  const bare = { ...plan, fauna: { ...plan.fauna!, wild: [] } } as VillagePlan,
    alone = { ...plan, people: plan.people.slice(1, 2) } as VillagePlan;
  assert.equal(huntGround(bare), null);
  assert.equal(huntGround(alone), null);
  assert.equal(huntOn(bare, huntDay(Y, true)), null);
});

test("hunting days: never a day of rest; some days, not all; one brought down as often as not", () => {
  let hunts = 0,
    kills = 0,
    working = 0;
  for (let d = Y; d < Y + 700; d++) {
    const h = huntOn(plan, d);
    if (restDay(plan, d)) {
      assert.equal(h, null);
      continue;
    }
    working++;
    if (!h) continue;
    hunts++;
    if (h.kill) kills++;
    // (The hunters come at it from the town's side: it runs on, away.)
    assert.ok(Math.abs(Math.hypot(h.ux, h.uz) - 1) < 1e-9);
    assert.ok(h.target.x * h.ux + h.target.z * h.uz > 0);
  }
  assert.ok(hunts > working * 0.3 && hunts < working * 0.6, `${hunts} hunts of ${working} days`);
  assert.ok(kills > hunts * 0.45 && kills < hunts * 0.75, `${kills} kills of ${hunts} hunts`);
});

test("the hunters gather, close in abreast, rush, and stand about the kill — or where the herd was", () => {
  const day = huntDay(Y, true),
    hunt = huntOn(plan, day)!,
    at = (h: number, seat: number) => hunterAt(plan, day * DAY + h * HOUR, seat)!,
    off = (p: { x: number; z: number }) => Math.hypot(p.x - hunt.target.x, p.z - hunt.target.z);
  // Gathered, then creeping in: nearer the herd as the stalk goes on, low (stalking).
  assert.equal(at(7.9, 0).why, "Gathered for the hunt, waiting on the others");
  let last = Infinity;
  for (let h = HUNT_STALK[0]; h < HUNT_STALK[1]; h += 0.2) {
    const p = at(h, 0);
    assert.equal(p.task, "stalk");
    assert.ok(off(p) <= last + 1e-9);
    last = off(p);
  }
  assert.ok(off(at(HUNT_STALK[0], 0)) > 120 && off(at(HUNT_STALK[1] - 0.01, 0)) < 40);
  // Abreast: each in a place of their own.
  for (let a = 0; a < HUNT_PARTY; a++)
    for (let b = a + 1; b < HUNT_PARTY; b++) {
      const p = at(9, a),
        q = at(9, b);
      assert.ok(Math.hypot(p.x - q.x, p.z - q.z) > 3, "two hunters in one place");
    }
  // The rush, spears thrust; then about the kill, facing it, the first two dressing it.
  assert.equal(at((HUNT_RUSH[0] + HUNT_RUSH[1]) / 2, 2).task, "strike");
  for (let seat = 0; seat < HUNT_PARTY; seat++) {
    const p = at(10, seat),
      k = hunt.kill!;
    assert.ok(Math.hypot(p.x - k.x, p.z - k.z) < 6, `hunter ${seat} away from the kill`);
    assert.ok(Math.abs(Math.atan2(k.x - p.x, k.z - p.z) - p.face) < 1e-9);
    assert.equal(p.why, seat < 2 ? "Dressing the kill" : "Standing by the kill");
  }
  assert.equal(hunterAt(plan, day * DAY + HUNT_DONE * HOUR, 0), null);
  // A hunt without a kill: where the herd was, watching it go.
  const missed = huntDay(Y, false);
  assert.equal(hunterAt(plan, missed * DAY + 10 * HOUR, 1)!.why, "The herd got away");
});

test("the herd: heads up at the stalk's end, running at the rush, off and back over the days; one down", () => {
  const day = huntDay(Y, true),
    hunt = huntOn(plan, day)!,
    g = (h: number, d = day) => gameAt(plan, d * DAY + h * HOUR)!;
  assert.equal(g(8).alert, 0);
  assert.ok(g(HUNT_STALK[1] - 0.05).alert > 0.5, "not alarmed as the hunters come in");
  assert.ok(g(HUNT_RUSH[0] + 0.01).running);
  assert.ok(!g(HUNT_RUSH[0] + 0.2).running);
  // (Run on along the hunters' way, some way off; back by two days on.)
  const before = g(HUNT_RUSH[0] - 0.001),
    after = g(HUNT_RUSH[0] + 0.1),
    away = (after.x - before.x) * hunt.ux + (after.z - before.z) * hunt.uz;
  assert.ok(away > FLIGHT * 0.8, `ran ${away.toFixed(0)} m`);
  // The one brought down lies where it fell till the hunt is done; gone from the herd all day.
  assert.deepEqual(g(10).down, hunt.kill);
  assert.equal(g(HUNT_DONE + 0.01).down, null);
  assert.ok(g(10).struck && g(16).struck);
});

test("on a hunting day the town's foragers go out after the game, the first few; on others they gather", () => {
  const day = huntDay(Y, true),
    roles = townDay(plan, day, villageSolids(plan)).roles,
    hunting = roles.flatMap((r, i) => (r.kind === "hunt" ? [i] : []));
  assert.ok(hunting.length >= 2 && hunting.length <= HUNT_PARTY, `${hunting.length} hunting`);
  assert.ok(hunting.every((i) => plan.people[i]!.occupation === OCC.forager));
  assert.deepEqual(
    hunting.map((i) => roles[i]!.seat).sort((a, b) => a - b),
    hunting.map((_, k) => k),
  );
  let none = Y;
  while (huntOn(plan, none) || restDay(plan, none)) none++;
  assert.ok(townDay(plan, none, villageSolids(plan)).roles.every((r) => r.kind !== "hunt"));
});

test("a hunter's day: out to the hunt, the stalk, the rush on their feet, the kill dressed, carried home and hung", () => {
  const day = huntDay(Y, true),
    roles = townDay(plan, day, villageSolids(plan)).roles,
    first = roles.findIndex((r) => r.kind === "hunt" && r.seat === 0),
    m = (h: number) => momentOf(plan, first, day * DAY + h * HOUR);
  assert.ok(first >= 0);
  assert.equal(m(9).why, "Stalking the herd");
  assert.equal(m(9).task, "stalk");
  const rush = m((HUNT_RUSH[0] + HUNT_RUSH[1]) / 2);
  assert.equal(rush.why, "Running at the herd");
  assert.equal(rush.activity, ACTIVITY.walking);
  assert.equal(m(10).why, "Dressing the kill");
  // Home with it across the shoulders to the store, and hung there.
  let carried = false,
    hung = false;
  for (let h = HUNT_DONE; h < 12; h += 1 / 60) {
    const x = m(h);
    if (x.carry === "kill" && /^Carrying the kill to/.test(x.why ?? "")) carried = true;
    if (/^Hanging the kill in/.test(x.why ?? "")) hung = true;
  }
  assert.ok(carried && hung, "the kill not carried home and hung");
});

test("the game drawn by the world's clock: on its ground, running at the rush, one down where it fell", () => {
  const f = faunaOf(plan, 160, 2, true),
    day = huntDay(Y, true),
    hunt = huntOn(plan, day)!,
    out: BeastNow[] = [],
    game = f.herds.findIndex((h) => !!h.game),
    // (Its beasts as drawn: after the herds before it, its own — but the one struck down, and
    // that one lying where it fell.)
    start = f.herds.slice(0, game).reduce((a, h) => a + h.members.length, 0),
    drawn = (h: number) => {
      const t = day * DAY + h * HOUR,
        g = gameAt(plan, t)!;
      beastsAt(f, 50, out, t);
      return out.slice(
        start,
        start + f.herds[game]!.members.length - (g.struck ? 1 : 0) + (g.down ? 1 : 0),
      );
    };
  assert.ok(game >= 0, "no herd of game");
  const herd = f.herds[game]!.members.length,
    at = gameAt(plan, day * DAY + 8 * HOUR)!,
    eight = drawn(8),
    mid = eight.reduce((a, b) => ({ x: a.x + b.x / eight.length, z: a.z + b.z / eight.length }), {
      x: 0,
      z: 0,
    });
  assert.equal(eight.length, herd);
  assert.ok(Math.hypot(mid.x - at.x, mid.z - at.z) < 15, "the game away from its ground");
  // At the rush: running, on along the hunters' way.
  const run = drawn(HUNT_RUSH[0] + 0.02).filter((b) => !b.dead);
  assert.ok(run.every((b) => b.pose.gait === 2));
  assert.ok(run.every((b) => Math.abs(b.yaw - Math.atan2(hunt.ux, hunt.uz)) < 1e-9));
  // The kill: one fewer in the herd, and it lying where it fell.
  const ten = drawn(10),
    dead = ten.filter((b) => b.dead);
  assert.equal(ten.length - dead.length, herd - 1);
  assert.equal(dead.length, 1);
  assert.ok(Math.hypot(dead[0]!.x - hunt.kill!.x, dead[0]!.z - hunt.kill!.z) < 1e-9);
  assert.equal(drawn(HUNT_DONE + 0.1).filter((b) => b.dead).length, 0);
});
