import { test } from "node:test";
import assert from "node:assert/strict";
import type { Feast, VillageLife, VillagePlan } from "../../src/bridge/index.ts";
import {
  ACTIVITY,
  FEAST,
  FEAST_HOURS,
  feastAt,
  feastPlace,
  feastScene,
  fireOf,
  flamesAt,
  limbPitch,
  figureOf,
  marketAt,
  marketDay,
  marketScene,
  momentOf,
  ringTurn,
  sayOf,
  squareNow,
  squareScale,
} from "../../src/view/index.ts";
import { OCC } from "../../src/rules/index.ts";

const DAY = 86_400,
  HOUR = 3_600;

/** A village of forty about its square (as the life tests' own), keeping the feasts given. */
function village(feasts: readonly Feast[], market = false): VillagePlan {
  const life: VillageLife = {
    fed: 1,
    growing: false,
    war: false,
    unrest: 0,
    faith: null,
    talk: ["weather", "food", "gossip"],
    site: null,
    mourning: [],
    newborn: [],
    feasts,
  };
  const homes = Array.from({ length: 10 }, (_, k) => {
    const a = k * 2.399963,
      r = 16 + 8.5 * Math.sqrt(k);
    return { x: r * Math.cos(a), z: r * Math.sin(a), yaw: a, household: `hhold:0:${k}` };
  });
  const people = Array.from({ length: 40 }, (_, i) => ({
    ref: `prsn:0:${i}`,
    name: `P${i} Test`,
    home: i % 10,
    age: i % 8 === 7 ? 9 : i % 8 === 6 ? 70 : 18 + ((i * 7) % 24),
    occupation:
      i % 8 === 7 ? OCC.dependent : i % 8 === 5 ? OCC.trader : i % 2 ? OCC.crafter : OCC.farmer,
    child: i % 8 === 7,
  }));
  return {
    ref: "town:0:9",
    name: "Feastford",
    population: 200,
    market,
    hand: false,
    districts: null,
    biome: 8,
    seed: 3,
    homes,
    fields: [
      { x: 160, z: 0, w: 40, d: 25, yaw: 0 },
      { x: 150, z: 60, w: 40, d: 25, yaw: 0.2 },
    ],
    pasture: { x: -300, z: 0, r: 90 },
    wild: 400,
    water: { x: 0, z: -700 },
    house: { walls: "wattle", roof: "thatch", form: "round", pitch: 45, design: null },
    body: null,
    road: { x: 0, z: 1100 },
    people,
    life,
  };
}

// A working day (not its day of rest, nor its market day) to feast on, and the day before it.
const seed = 3,
  feastDay = [20, 21, 22, 23, 24, 25, 26].find(
    (d) => (d + (seed % 7)) % 7 !== 0 && (d + (seed % 7)) % 7 !== 3,
  )!,
  harvest: Feast = { day: feastDay, occasion: "harvest", words: "Harvest home", ref: null },
  plan = village([harvest]),
  /** A town's square (drawn from its fabric): forty metres across. */
  town = { market: true, town: {} as NonNullable<VillagePlan["town"]> },
  everyone = (p: VillagePlan, t: number) => p.people.map((_, i) => momentOf(p, i, t));

test("the square is dressed on its feast day only, and its bonfire burns from dusk until late", () => {
  const at = (day: number, hour: number) => feastAt(plan, day * DAY + hour * HOUR);
  assert.equal(at(feastDay - 1, 20), null, "no feast the day before");
  assert.equal(at(feastDay, 7)?.dressed, false, "not dressed before the morning's work");
  assert.equal(at(feastDay, 10)?.dressed, true);
  assert.equal(at(feastDay, 10)?.lit, false, "no fire by day");
  assert.equal(at(feastDay, FEAST_HOURS.lit + 0.5)?.lit, true);
  assert.equal(at(feastDay, 23.5)?.lit, true);
  assert.equal(at(feastDay + 1, 10), null, "put away the next day");
  assert.match(squareNow(plan, feastDay * DAY + 19 * HOUR)!.words, /Harvest home in Feastford/);
  assert.equal(squareNow(plan, feastDay * DAY + 19 * HOUR)!.icon, "🌾🎉");
});

test("on a feast day the work is put down by mid-afternoon, and the town feasts at the tables and in the ring", () => {
  const working = (t: number) =>
    everyone(plan, t).filter((m) => m.activity === ACTIVITY.working).length;
  const ordinary = feastDay + 7;
  assert.ok(working(ordinary * DAY + 16 * HOUR) >= 10, "at work of an ordinary afternoon");
  assert.equal(working(feastDay * DAY + 16 * HOUR), 0, "none at work on the feast's afternoon");
  const evening = everyone(plan, feastDay * DAY + 20.5 * HOUR),
    grown = plan.people.flatMap((p, i) => (p.child ? [] : [evening[i]!])),
    feasting = grown.filter((m) => m.activity === ACTIVITY.feasting);
  assert.ok(feasting.length >= grown.length * 0.8, `${feasting.length} of ${grown.length} feast`);
  const fire = fireOf(plan),
    k = squareScale(plan),
    ring = feasting.filter((m) => m.task === "dance"),
    tables = feasting.filter((m) => m.task === "feast");
  assert.ok(ring.length >= 3 && tables.length >= 3, `${ring.length} dance, ${tables.length} eat`);
  for (const m of ring)
    assert.ok(Math.abs(Math.hypot(m.x - fire.x, m.z - fire.z) - FEAST.ring * k) < 0.5);
  // (At the tables: within the open square, which a village's homes ring from sixteen metres out.)
  for (const m of tables) assert.ok(Math.hypot(m.x, m.z) < 13.5, `${m.x}, ${m.z} at the tables`);
  // (The young home sooner; all home by midnight.)
  const late = everyone(plan, feastDay * DAY + 21.6 * HOUR);
  plan.people.forEach((p, i) => {
    if (p.child) assert.notEqual(late[i]!.activity, ACTIVITY.feasting);
  });
  const night = everyone(plan, (feastDay + 1) * DAY + 0.5 * HOUR);
  assert.equal(night.filter((m) => m.activity === ACTIVITY.feasting).length, 0);
});

test("the dancers face the fire and go round in step; those at the tables face across them, with a cup raised", () => {
  for (const u of [0, 0.2, 0.55, 0.9]) {
    const d = feastPlace(plan, true, u),
      fire = fireOf(plan),
      to = Math.atan2(fire.x - d.x, fire.z - d.z);
    assert.ok(Math.abs(Math.atan2(Math.sin(d.yaw - to), Math.cos(d.yaw - to))) < 1e-6);
  }
  // (At the tables, in a village's square and in a town's: both sides kept, each facing across.)
  for (const p of [plan, { ...plan, town: town.town }]) {
    const places = Array.from({ length: 100 }, (_, i) => feastPlace(p, false, i / 100)),
      tables = feastScene(p).tables;
    assert.ok(places.some((s) => s.yaw === 0) && places.some((s) => s.yaw === Math.PI));
    for (const s of places) {
      const t = tables.reduce((a, b) => (Math.abs(b.z - s.z) < Math.abs(a.z - s.z) ? b : a));
      assert.ok(Math.sign(t.z - s.z) === Math.sign(Math.cos(s.yaw)), "facing across the table");
      assert.ok(Math.abs(s.x - t.x) < t.sx / 2, "along its length");
    }
  }
  // (The ring goes round the fire by the screen's clock, each dancer facing it still.)
  const d = feastPlace(plan, true, 0.3),
    fire = fireOf(plan),
    now = ringTurn(plan, d, 0),
    later = ringTurn(plan, d, 6);
  assert.ok(Math.hypot(now.x - d.x, now.z - d.z) < 1e-9);
  assert.ok(Math.hypot(later.x - d.x, later.z - d.z) > 2, "carried round");
  assert.ok(
    Math.abs(
      Math.hypot(later.x - fire.x, later.z - fire.z) - Math.hypot(d.x - fire.x, d.z - fire.z),
    ) < 1e-9,
  );
  assert.ok(
    Math.abs(later.yaw - Math.atan2(fire.x - later.x, fire.z - later.z)) < 1e-9,
    "facing the fire",
  );
  const arm = figureOf(null).parts.find((p) => p.swing && p.x > 0)!,
    a = limbPitch(arm, "dance", false, 0.1, 3),
    b = limbPitch(arm, "dance", false, 0.4, 3);
  assert.ok(a < 0 && b < 0 && a !== b, "hands up and swinging");
  const signs = new Set<string>();
  for (let s = 0; s < 400; s += 1.3)
    plan.people.forEach((_, i) => {
      const m = momentOf(plan, i, feastDay * DAY + 20.5 * HOUR),
        sign = sayOf(plan, i, m, s);
      if (sign) signs.add(sign);
    });
  for (const sign of ["🎶", "🍖", "🍻"]) assert.ok(signs.has(sign), `${sign} among ${[...signs]}`);
});

test("the square's dressing stands in the square, clear of the well and the market hall", () => {
  for (const p of [plan, { ...plan, market: true }, town]) {
    const f = feastScene(p),
      k = squareScale(p),
      // (A town's square is forty metres across; a village's homes stand from sixteen metres out.)
      open = p.town ? 19.5 : 13.5;
    const pieces = [...f.poles, ...f.flags.flat(), ...f.tables, ...f.trestles, ...f.food, f.logs];
    assert.ok(f.flags.flat().length >= 20, "bunting strung about it");
    for (const q of pieces) {
      const reach = Math.hypot(Math.abs(q.x) + q.sx / 2, Math.abs(q.z) + q.sz / 2);
      assert.ok(reach < open, `${JSON.stringify(q)} within ${open} m`);
      assert.ok(Math.hypot(q.x, q.z) > 2.5 * k, "clear of the well");
    }
    for (const fl of flamesAt(p, 3.3)) assert.ok(fl.sy > 0 && Math.hypot(fl.x, fl.z) < open);
  }
  // A market town's hall stands by its square at (14, -10), in a village and in a town drawn
  // from its fabric: nothing of the feast or the market stands in it.
  const hall = (q: { x: number; z: number }) => Math.abs(q.x - 14) < 9 && Math.abs(q.z + 10) < 5.5;
  for (const p of [{ ...plan, market: true }, town]) {
    const f = feastScene(p),
      m = marketScene(p);
    for (const q of [...f.poles, ...f.flags.flat(), ...m.stalls, ...m.awnings.flat()])
      assert.ok(!hall(q), `${JSON.stringify(q)} clear of the hall`);
    assert.ok(m.stalls.length >= (p.town ? 7 : 5), `${m.stalls.length} stalls about the square`);
  }
  assert.equal(
    marketScene({ ...town, market: false }).stalls.length,
    10,
    "ten stalls where no hall stands",
  );
});

test("the market stands once a week of a morning, never on a feast day; the old go to buy, the traders keep the stalls", () => {
  const p = village([harvest], true),
    days = Array.from({ length: 28 }, (_, d) => feastDay - 14 + d).filter((d) => marketDay(p, d));
  assert.equal(days.length, 4, "once a week");
  assert.ok(!days.includes(feastDay));
  assert.ok(!marketDay(village([harvest], false), days[0]!), "no market where none is kept");
  const day = days.at(-1)!;
  assert.ok(marketAt(p, day * DAY + 9 * HOUR) && !marketAt(p, day * DAY + 19 * HOUR));
  assert.equal(squareNow(p, day * DAY + 9 * HOUR)?.icon, "🛒");
  const m = marketScene(p),
    near = (x: { x: number; z: number }, q: readonly { x: number; z: number }[], r: number) =>
      q.some((s) => Math.hypot(s.x - x.x, s.z - x.z) < r);
  const morning = everyone(p, day * DAY + 10 * HOUR);
  p.people.forEach((person, i) => {
    const at = morning[i]!;
    if (person.age >= 62)
      assert.ok(at.task === "haggle" && near(at, m.fronts, 0.6), `elder ${i} at a stall`);
    if (person.occupation === OCC.trader)
      assert.ok(near(at, m.backs, 1), `trader ${i} behind a stall`);
  });
  // (Home again with what they bought.)
  const elder = p.people.findIndex((q) => q.age >= 62),
    back = Array.from({ length: 12 }, (_, k) =>
      momentOf(p, elder, day * DAY + (11 + k / 8) * HOUR),
    );
  assert.ok(
    back.some((b) => b.carry === "sack"),
    "a sack carried home",
  );
});
