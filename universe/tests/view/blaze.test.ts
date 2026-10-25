import { test } from "node:test";
import assert from "node:assert/strict";
import { HOME_MONTHS, LEVEL, OCC } from "../../src/rules/index.ts";
import {
  LAKE_R,
  SPREAD,
  lotStates,
  townLots,
  type TownPlan,
  type TownStrike,
  type VillagePlan,
} from "../../src/bridge/index.ts";
import {
  FALLS_S,
  FLAMES_S,
  SHAKE_S,
  TOWN_WELL,
  TownParts,
  blazeNow,
  momentOf,
  strikeTurned,
  townHomes,
  townScene,
  type Moment,
} from "../../src/view/index.ts";

// Phase 42 M201: what strikes a town, seen as it plays out — its homes the god's fire took
// standing till each caught, burning and falling in; the town's bucket line at it from its well,
// those come to watch; and a quake's homes shaken down, dust over them, the ground shaking, and
// the rubble dug.

const DAY = 86_400,
  HOUR = 3_600,
  YEAR_S = 365 * DAY;
/** The fire: year 40, day 130, ten in the morning, on lot 120. */
const AT = 40 * YEAR_S + 130 * DAY + 10 * HOUR;

/** A town of homes, forty of them (lots 100–139) razed in year 40 by what struck it. */
function fabricOf(struck: TownStrike[]): TownPlan {
  return {
    family: "grid",
    seed: 11,
    axis: 0.3,
    lots: 480,
    whole: 480,
    runs: [
      [0, 0, 100, 10, 10, LEVEL.house, -1],
      [3, 100, 140, 40, 40, 0, 0],
      [0, 140, 480, 10, 10, LEVEL.house, -1],
    ],
    civics: [],
    walls: null,
    months: HOME_MONTHS,
    designs: [{ since: -1, walls: "timber", roof: "thatch", form: "square", pitch: 40 }],
    paved: false,
    water: { x: 420, z: 80, r: LAKE_R },
    year: 40,
    struck,
  };
}
const fire = fabricOf([{ kind: "fire", at: AT, lot: 120, homes: 40, event: "evnt:0:1" }]),
  quake = fabricOf([{ kind: "quake", at: AT, lot: -1, homes: 40, event: "evnt:0:2" }]);

function planOf(fabric: TownPlan): VillagePlan {
  const lots = townLots(fabric.family, fabric.seed, fabric.axis, fabric.lots, fabric.water);
  return {
    ref: "town:0:9",
    name: "Ashby",
    population: 2400,
    market: true,
    hand: false,
    districts: null,
    biome: 8,
    seed: 5,
    // (Their homes standing, beyond the fire's.)
    homes: Array.from({ length: 12 }, (_, k) => ({
      x: lots.x[150 + k * 5]!,
      z: lots.z[150 + k * 5]!,
      yaw: lots.yaw[150 + k * 5]!,
      household: `hhold:0:${k}`,
    })),
    fields: [{ x: -420, z: 30, w: 40, d: 25, yaw: 0 }],
    pasture: { x: 30, z: 470, r: 90 },
    wild: 700,
    water: { x: 420, z: 80 },
    house: { walls: "timber", roof: "thatch", form: "square", pitch: 40, design: null },
    body: null,
    road: { x: 1100 * Math.cos(fabric.axis), z: 1100 * Math.sin(fabric.axis) },
    // Crafters and farmers; every ninth a child of eight, every tenth old.
    people: Array.from({ length: 54 }, (_, i) => ({
      ref: `prsn:0:${i}`,
      name: `P${i} Test`,
      home: i % 12,
      age: i % 9 === 8 ? 8 : i % 10 === 9 ? 70 : 20 + ((i * 7) % 30),
      occupation: i % 9 === 8 ? OCC.dependent : i % 2 ? OCC.crafter : OCC.farmer,
      child: i % 9 === 8,
    })),
    town: fabric,
  };
}

test("a fire's homes catch one after another from the lot it fell on, as their neighbours stood", () => {
  const states = lotStates(fire);
  const order = Array.from({ length: 40 }, (_, k) => 100 + k).sort(
    (a, b) => states.began[a]! - states.began[b]!,
  );
  assert.equal(order[0], 120, "the lot it fell on first");
  for (let k = 100; k < 140; k++) {
    assert.equal(states.struck[k], 0);
    assert.equal(states.burns[k], 1);
    assert.equal(states.level[k], LEVEL.house, "as the homes beside it stood");
    assert.ok(states.began[k]! >= AT && states.began[k]! <= AT + SPREAD.fireAll + SPREAD.fire);
  }
  // (Nearer the lot it fell on, sooner.)
  assert.ok(states.began[119]! < states.began[105]!);
  assert.ok(states.began[121]! < states.began[138]!);
  // Others' homes untouched.
  assert.equal(states.struck[99], -1);
  assert.equal(states.struck[140], -1);
});

test("a home stands till it catches, blackens as it burns and falls in, then burnt out", () => {
  const scene = townScene(fire, AT - HOUR),
    first = scene.struck[0]!,
    caught = scene.states.began[first]!,
    colours = (t: number) => {
      const out = new TownParts();
      townHomes(scene, [first], t, out);
      return {
        groups: [...out.groups.values()].filter((g) => !g.lamp).map((g) => g.color),
        lamps: out.groups.has("lamp"),
        n: out.count,
      };
    },
    bright = (c: readonly number[]) => c[0]! + c[1]! + c[2]!,
    before = colours(caught - 60),
    burning = colours(caught + FALLS_S * 0.5),
    after = colours(caught + FALLS_S + HOUR);
  assert.ok(scene.active.includes(first), "drawn again as it burns");
  assert.ok(before.n >= 2, "a home standing before it caught");
  assert.ok(before.lamps, "its windows");
  assert.ok(!burning.lamps, "no windows lit while it burns");
  assert.ok(
    Math.max(...burning.groups.map(bright)) < Math.max(...before.groups.map(bright)) * 0.75,
    "blackened",
  );
  assert.ok(after.n >= 5 && after.n <= 7, `${after.n} parts of a home burnt out`);
  assert.ok(
    after.groups.every((c) => bright(c) < 1.5),
    "its ash, its black stubs and its smoked chimney",
  );
  assert.ok(
    after.groups.some((c) => bright(c) < 0.6),
    "black stubs",
  );
});

test("the homes alight burn, smoke and smoulder; nothing before the fire nor long after", () => {
  const scene = townScene(fire, AT - HOUR);
  assert.equal(blazeNow(scene, AT - 600).fires.length, 0);
  const half = blazeNow(scene, AT + 40 * 60);
  assert.ok(half.fires.length >= 15, `${half.fires.length} alight forty minutes on`);
  assert.ok(half.fires.every((f) => f.k > 0 && f.k <= 1 && f.high > 3));
  assert.equal(half.smoke.length, half.fires.length);
  assert.equal(half.shake, 0);
  const all = blazeNow(scene, AT + SPREAD.fireAll + 30 * 60);
  assert.equal(all.fires.length, 40, "every home of it alight once the fire has spread");
  const out = blazeNow(scene, AT + SPREAD.fireAll + FLAMES_S + 3600);
  assert.equal(out.fires.length, 0, "the flames out");
  assert.ok(out.smoke.length >= 30 && out.smoke.every((f) => f.k < 0.45), "smouldering");
  assert.equal(blazeNow(scene, AT + 3 * DAY).smoke.length, 0);
});

test("the town comes to its fire: a bucket line from its well, two throwing, others watching; and goes back to its day", () => {
  const plan = planOf(fire),
    scene = townScene(fire, AT - HOUR),
    at = (i: number, t: number): Moment => momentOf(plan, i, t),
    during = plan.people.map((_, i) => at(i, AT + 50 * 60)),
    tasks = (ms: readonly Moment[], task: string) => ms.filter((m) => m.task === task);
  const throwing = tasks(during, "douse"),
    filling = tasks(during, "fill"),
    passing = tasks(during, "pass"),
    watching = tasks(during, "watch");
  assert.equal(throwing.length, 2, "two throwing water on it");
  assert.equal(filling.length, 1, "one filling buckets");
  assert.ok(passing.length >= 6, `${passing.length} passing buckets down the line`);
  assert.ok(watching.length >= 4, `${watching.length} watching`);
  // At the fire, the line from its water to it: the well where a line walked from it reaches,
  // else a neighbour's water butt a little way off the fire.
  const alight = (m: Moment) =>
    Math.min(
      ...scene.struck.map((p) => Math.hypot(scene.lots.x[p]! - m.x, scene.lots.z[p]! - m.z)),
    );
  assert.ok(
    alight(throwing[0]!) < 14,
    `the throwers ${alight(throwing[0]!).toFixed(1)} m from a home alight`,
  );
  const filler = filling[0]!,
    atWell = Math.hypot(filler.x - TOWN_WELL.x, filler.z - TOWN_WELL.z) < 6;
  assert.ok(
    atWell || (/water butt/.test(filler.why ?? "") && alight(filler) < 70),
    `filling at ${filler.x.toFixed(0)}, ${filler.z.toFixed(0)}: ${filler.why}`,
  );
  assert.ok(throwing.every((m) => /Throwing water on the fire/.test(m.why ?? "")));
  assert.ok(passing.every((m) => /Passing buckets/.test(m.why ?? "")));
  // No child at the line, nor the old; before the alarm and after the fire, their day as ever.
  for (const [i, m] of during.entries()) {
    const p = plan.people[i]!;
    if (m.task === "douse" || m.task === "pass" || m.task === "fill")
      assert.ok(!p.child && p.age < 62, `${p.name} at the line`);
  }
  const before = plan.people.map((_, i) => at(i, AT - 10 * 60)),
    later = plan.people.map((_, i) => at(i, AT + 9 * HOUR));
  for (const ms of [before, later])
    assert.equal(
      ms.filter((m) => ["douse", "pass", "fill", "watch"].includes(m.task ?? "")).length,
      0,
    );
});

test("a quake shakes the ground, throws homes down in dust, some burning; the rubble dug", () => {
  const states = lotStates(quake),
    burnt = Array.from({ length: 40 }, (_, k) => states.burns[100 + k]!).filter(Boolean).length;
  assert.ok(burnt >= 3 && burnt <= 20, `${burnt} of forty burn`);
  for (let k = 100; k < 140; k++) assert.ok(states.began[k]! - AT <= SPREAD.quakeAll);
  const scene = townScene(quake, AT - HOUR);
  assert.ok(blazeNow(scene, AT + 10).shake > 0.5, "the ground shaking");
  assert.equal(blazeNow(scene, AT + SHAKE_S + 5).shake, 0);
  const now = blazeNow(scene, AT + 5 * 60);
  assert.equal(now.dust.length, 40 - burnt, "dust over the homes shaken down");
  assert.equal(now.fires.length, burnt);
  const plan = planOf(quake),
    digging = plan.people
      .map((_, i) => momentOf(plan, i, AT + HOUR))
      .filter((m) => m.task === "dig" && /rubble/.test(m.why ?? ""));
  assert.ok(digging.length >= 6, `${digging.length} digging in the rubble`);
  // Thrown down, burning or not: in rubble from the moment it fell, the flames low on it; and
  // drawn again as each falls, not at the next of the fire's minutes.
  const top = (p: number, t: number) => {
      const out = new TownParts();
      townHomes(scene, [p], t, out);
      let most = 0;
      for (const g of out.groups.values())
        for (let o = 0; o < g.data.length; o += 7)
          most = Math.max(most, g.data[o + 1]! + g.data[o + 4]! / 2);
      return most;
    },
    alight = Array.from({ length: 40 }, (_, k) => 100 + k).find((p) => states.burns[p] === 1)!;
  assert.ok(top(alight, states.began[alight]! - 5) > 3, "standing till it fell");
  assert.ok(top(alight, states.began[alight]! + 60) < 2.5, "burning in its rubble");
  assert.ok(
    now.fires.every((f) => f.high < 2),
    "flames low on the rubble",
  );
  assert.ok(strikeTurned(scene, AT - 1, AT + SPREAD.quakeAll));
  assert.ok(!strikeTurned(scene, AT + 2 * HOUR, AT + 3 * HOUR));
});

test("those at a fire of a morning dig in the rubble of the quake that afternoon", () => {
  const plan = planOf(
      fabricOf([
        { kind: "fire", at: AT, lot: 120, homes: 20, event: "evnt:0:1" },
        { kind: "quake", at: AT + 6 * HOUR, lot: -1, homes: 20, event: "evnt:0:2" },
      ]),
    ),
    at = (i: number, t: number) => momentOf(plan, i, t),
    fought = plan.people
      .map((_, i) => i)
      .filter((i) => ["douse", "pass", "fill", "watch"].includes(at(i, AT + 50 * 60).task ?? "")),
    digging = plan.people.map((_, i) => i).filter((i) => at(i, AT + 7 * HOUR).task === "dig");
  assert.ok(fought.length >= 20, `${fought.length} at the fire`);
  assert.ok(digging.length >= 6, `${digging.length} digging`);
  assert.ok(
    digging.some((i) => fought.includes(i)),
    "some of those at the fire in the morning digging in the afternoon",
  );
});

test("a fire and a quake in one year: each its own homes, as the fabric took them", () => {
  const both = fabricOf([
      { kind: "fire", at: AT, lot: 120, homes: 20, event: "evnt:0:1" },
      { kind: "quake", at: AT + 5 * DAY, lot: -1, homes: 20, event: "evnt:0:2" },
    ]),
    states = lotStates(both);
  // The fire's the twenty nearest the lot it fell on; the quake's, of those left, from the heart out.
  for (let p = 110; p < 130; p++) assert.equal(states.struck[p], 0, `lot ${p} the fire's`);
  for (const p of [100, 105, 109, 130, 135, 139])
    assert.equal(states.struck[p], 1, `lot ${p} the quake's`);
  assert.ok(states.began[100]! >= AT + 5 * DAY, "fallen when the quake came");
});
