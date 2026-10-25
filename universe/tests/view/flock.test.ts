import { test } from "node:test";
import assert from "node:assert/strict";
import type { VillagePlan } from "../../src/bridge/index.ts";
import { OCC } from "../../src/rules/index.ts";
import {
  CULL,
  CULL_EVERY,
  FLOCK_IN,
  FLOCK_OUT,
  HARVEST,
  FLOCK_HANDS,
  LAMBING,
  countryOf,
  fleecesPiled,
  flockAt,
  flockMember,
  foldOf,
  foldReach,
  grazingOf,
  onHay,
  herderAt,
  momentOf,
  reapingsOf,
  restDay,
  shearingDay,
} from "../../src/view/index.ts";

// Phase 46 M208: the flock's day and year — folded by night at its pasture's gap, out to graze by
// day and in before evening, its herders with it; the stubble after the harvest; the fold and hay
// in winter; lambs in the spring, the shearing, the cull.

const DAY = 86_400,
  HOUR = 3_600,
  Y = 40 * 365;

function townOf(wool = true, herders = 3): VillagePlan {
  return {
    ref: "vill:0:46",
    name: "Foldham",
    population: 300,
    market: false,
    hand: false,
    districts: null,
    biome: 9,
    seed: 7,
    homes: Array.from({ length: 12 }, (_, k) => {
      const a = k * 2.399963,
        r = 16 + 8.5 * Math.sqrt(k);
      return { x: r * Math.cos(a), z: r * Math.sin(a), yaw: a, household: `hhold:0:${k}` };
    }),
    fields: Array.from({ length: 10 }, (_, k) => {
      const a = ((k - 4.5) / 10) * 2.6,
        r = 120 + (k % 3) * 45;
      return { x: r * Math.cos(a), z: r * Math.sin(a), w: 40, d: 25, yaw: a };
    }),
    pasture: { x: -150, z: 0, r: 60 },
    wild: 400,
    water: null,
    house: { walls: "timber", roof: "thatch", form: "square", pitch: 40, design: null },
    body: null,
    road: { x: 0, z: -500 },
    era: "farm",
    people: [],
    fauna: {
      wild: [],
      flock: { ref: "lin:0:1", name: "sheep", size: 60, wool, herders },
      raided: false,
    },
  } as unknown as VillagePlan;
}

/** A working day on or after a day of the year. */
const working = (plan: VillagePlan, yd: number) => {
  let day = Y + yd;
  while (restDay(plan, day)) day++;
  return day;
};

test("folded by night at the pasture's gap, lying down; out to graze in the morning and in before evening", () => {
  const plan = townOf(),
    fold = foldOf(plan),
    day = working(plan, 140),
    at = (h: number) => flockAt(plan, day * DAY + h * HOUR)!;
  // (The fold: in the pasture, on its side toward the town.)
  const p = plan.pasture;
  assert.ok(Math.hypot(fold.x - p.x, fold.z - p.z) < p.r);
  assert.ok(Math.hypot(fold.x, fold.z) < Math.hypot(p.x, p.z));
  for (const h of [2, 5.5, 20, 23]) {
    const f = at(h);
    assert.equal(f.state, "folded");
    assert.ok(f.lying, `lying at ${h} h`);
    assert.ok(Math.hypot(f.x - fold.x, f.z - fold.z) < 0.01);
  }
  assert.ok(!at(7).lying, "up by the morning");
  // The drive out: from the fold to its grazing, its way along.
  const out = at((FLOCK_OUT[0] + FLOCK_OUT[1]) / 2);
  assert.equal(out.state, "out");
  assert.ok(out.driven);
  const grazing = at(12),
    there = grazingOf(plan, day);
  assert.equal(grazing.state, "grazing");
  assert.ok(Math.hypot(grazing.x - there.at.x, grazing.z - there.at.z) < p.r * 0.2);
  assert.ok(
    Math.hypot(grazing.x - fold.x, grazing.z - fold.z) > p.r * 0.5,
    "grazing away from the fold",
  );
  // The drive in, and folded again.
  assert.equal(at((FLOCK_IN[0] + FLOCK_IN[1]) / 2).state, "in");
  assert.equal(at(FLOCK_IN[1] + 0.1).state, "folded");
  // A town that keeps none has none.
  assert.equal(flockAt(townOf(true, 0), day * DAY + 12 * HOUR), null);
});

test("after the harvest it grazes the stubble of the fields reaped, driven out through the gap", () => {
  const plan = townOf(),
    reaped = reapingsOf(plan).filter((r) => r),
    last = Math.max(...reaped.map((r) => r!.to)),
    day = working(plan, last + 3),
    g = grazingOf(plan, day);
  assert.ok(g.stubble >= 0, "no stubble grazed after the harvest");
  assert.ok(reapingsOf(plan)[g.stubble]!.to <= (day % 365) + 0, "a field not yet reaped");
  const noon = flockAt(plan, day * DAY + 12 * HOUR)!,
    f = plan.fields[g.stubble]!;
  assert.equal(noon.stubble, g.stubble);
  assert.ok(Math.hypot(noon.x - f.x, noon.z - f.z) < 12);
  // (Before the harvest, its pasture.)
  assert.equal(grazingOf(plan, working(plan, 150)).stubble, -1);
});

test("in winter at the fold on hay; a woolly flock penned for its shearing on a day of early summer", () => {
  const plan = townOf(),
    winter = working(plan, 350),
    noon = flockAt(plan, winter * DAY + 12 * HOUR)!;
  assert.equal(noon.state, "winter");
  assert.equal(flockAt(plan, (Y + 20) * DAY + 12 * HOUR)!.state, "winter");
  const shorn = shearingDay(plan, Y + 100);
  assert.ok(shorn > Y && !restDay(plan, shorn));
  assert.equal(flockAt(plan, shorn * DAY + 11 * HOUR)!.state, "shearing");
  assert.notEqual(flockAt(plan, (shorn + 1) * DAY + 11 * HOUR)!.state, "shearing");
  assert.equal(shearingDay(townOf(false), Y + 100), -1, "goats are not shorn");
  // The herders: shearing among it, feeding it at the fold in winter, watching it graze.
  assert.equal(herderAt(plan, shorn * DAY + 11 * HOUR, 0)!.why, "Shearing the flock");
  assert.equal(
    herderAt(plan, winter * DAY + 11 * HOUR, 1)!.why,
    "Feeding the flock hay at the fold",
  );
  const day = working(plan, 140),
    g = flockAt(plan, day * DAY + 12 * HOUR)!,
    h = herderAt(plan, day * DAY + 12 * HOUR, 2)!;
  assert.equal(h.why, "Watching the flock at its grazing");
  const off = Math.hypot(h.x - g.x, h.z - g.z);
  assert.ok(off > 4 && off < 60, `${off.toFixed(1)} m from the flock`);
  // (Facing it.)
  assert.ok(Math.abs(Math.atan2(g.x - h.x, g.z - h.z) - h.face) < 1e-9);
  // On a drive, behind it.
  const drive = flockAt(plan, day * DAY + (FLOCK_OUT[0] + 0.4) * HOUR)!,
    d = herderAt(plan, day * DAY + (FLOCK_OUT[0] + 0.4) * HOUR, 0)!;
  assert.equal(d.why, "Driving the flock out to graze");
  assert.ok(
    (d.x - drive.x) * drive.driven!.ux + (d.z - drive.z) * drive.driven!.uz < 0,
    "not behind it",
  );
});

test("one in four taken in the autumn's cull and born again as a lamb in the spring, grown by the harvest", () => {
  const plan = townOf(),
    at = (yd: number) => (Y + yd) * DAY + 12 * HOUR,
    n = 40,
    count = (yd: number) =>
      Array.from({ length: n }, (_, j) => flockMember(plan, j, at(yd))).filter((m) => m.shown);
  assert.equal(count(150).length, n, "all there in summer");
  assert.equal(
    count(Math.ceil(CULL[1] * 365) + 2).length,
    n - n / CULL_EVERY,
    "thinned for the winter",
  );
  assert.equal(count(30).length, n - n / CULL_EVERY, "still thinned before the lambing");
  // Lambs: small at birth, grown by the harvest.
  const lambs = Array.from({ length: n }, (_, j) => j).filter(
      (j) => j % CULL_EVERY === CULL_EVERY - 1,
    ),
    spring = lambs.map((j) => flockMember(plan, j, at(Math.ceil(LAMBING[1] * 365) + 3)));
  assert.ok(spring.every((m) => m.shown && m.size < 0.75 && m.size >= 0.45));
  assert.ok(
    lambs.every((j) => flockMember(plan, j, at(Math.ceil(HARVEST[0] * 365) + 1)).size === 1),
  );
});

test("its fold: hurdles round it in the pasture, open toward the town and the pasture; hay in its racks in winter, fleeces by it at the shearing", () => {
  const plan = townOf(),
    fold = foldOf(plan),
    r = foldReach(plan),
    pen = countryOf(plan).pen.fold!,
    p = plan.pasture,
    toward = Math.atan2(-p.z, -p.x);
  assert.ok(pen.hurdles.length >= 8, `${pen.hurdles.length} hurdles`);
  for (const h of pen.hurdles) {
    assert.ok(Math.abs(Math.hypot(h.x - fold.x, h.z - fold.z) - r) < 0.01);
    assert.ok(Math.hypot(h.x - p.x, h.z - p.z) < p.r - 2, "a hurdle out of the pasture");
  }
  // (Open both ways: no hurdle across the way to the town, nor across the way into the pasture.)
  for (const way of [toward, toward + Math.PI])
    for (const h of pen.hurdles) {
      const a = Math.atan2(h.z - fold.z, h.x - fold.x);
      assert.ok(Math.abs(Math.atan2(Math.sin(a - way), Math.cos(a - way))) > 0.3, "the fold shut");
    }
  // Its racks within, either side; the winter's herders by them, within the hurdles.
  for (const k of pen.racks) assert.ok(Math.hypot(k.x - fold.x, k.z - fold.z) < r - 1);
  const winter = working(plan, 350);
  for (const seat of [0, 1]) {
    const h = herderAt(plan, winter * DAY + 11 * HOUR, seat)!,
      d = Math.hypot(h.x - fold.x, h.z - fold.z);
    assert.ok(d < r - 0.3 && d > r * 0.8, `a herder ${d.toFixed(1)} m from the fold's middle`);
    assert.ok(
      pen.racks.some((k) => Math.hypot(k.x - h.x, k.z - h.z) < 2.5),
      "not by a rack",
    );
  }
  // Hay in winter only; the fleeces piled from the shearing's first hour, gone by the next day.
  assert.ok(onHay(winter * DAY) && !onHay(working(plan, 150) * DAY));
  const shorn = shearingDay(plan, Y + 100);
  assert.ok(!fleecesPiled(plan, shorn * DAY + 7 * HOUR));
  assert.ok(fleecesPiled(plan, shorn * DAY + 12 * HOUR));
  assert.ok(!fleecesPiled(plan, (shorn + 1) * DAY + 12 * HOUR));
  // (A town that keeps no flock has no fold.)
  assert.equal(countryOf(townOf(true, 0)).pen.fold, null);
});

test("a great town's first herders are with the flock it draws, each in a place of their own; the rest out on the far pastures", () => {
  const plan = {
      ...townOf(true, 10),
      people: Array.from({ length: 10 }, (_, i) => ({
        ref: `prsn:0:${i + 1}`,
        name: `H${i}`,
        home: i,
        age: 30,
        occupation: OCC.herder,
        child: false,
      })),
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
    } as unknown as VillagePlan,
    day = working(plan, 150),
    t = day * DAY + 10.5 * HOUR,
    at = plan.people.map((_, i) => momentOf(plan, i, t));
  const withIt = at.filter((m) => /^Watching the flock/.test(m.why ?? "")),
    far = at.filter((m) => m.why === "With the flocks on the far pastures");
  assert.equal(withIt.length, FLOCK_HANDS, at.map((m) => m.why).join(" | "));
  assert.equal(far.length, plan.people.length - FLOCK_HANDS);
  // (Each with the flock in a place of their own.)
  for (let a = 0; a < withIt.length; a++)
    for (let b = a + 1; b < withIt.length; b++)
      assert.ok(
        Math.hypot(withIt[a]!.x - withIt[b]!.x, withIt[a]!.z - withIt[b]!.z) > 1,
        "two herders in one place",
      );
  // (The far pastures: beyond the town's pasture.)
  const p = plan.pasture;
  for (const m of far) assert.ok(Math.hypot(m.x, m.z) > Math.hypot(p.x, p.z) + p.r);
});
