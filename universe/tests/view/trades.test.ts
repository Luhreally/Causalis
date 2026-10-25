import { test } from "node:test";
import assert from "node:assert/strict";
import { HOME_MONTHS, LEVEL, OCC } from "../../src/rules/index.ts";
import { LAKE_R, townLots, type TownPlan, type VillagePlan } from "../../src/bridge/index.ts";
import {
  TownParts,
  civicChimneys,
  civicDoors,
  civicMotions,
  momentOf,
  restDay,
  townCivics,
  townDay,
  townScene,
  villageSolids,
  type Moment,
} from "../../src/view/index.ts";

// Phase 41 M199: a town's trades at their own buildings — its children at its school of a
// morning and their teacher before them, its potters at its kiln, its millers carrying its grain
// to its mill, its people at prayer before its temple on the day of rest; its kilns, smithies and
// workshops smoking, its mills' sails turning.

const DAY = 86_400,
  HOUR = 3_600,
  YEAR_S = 365 * DAY;

/** A town of homes, with its square's market hall, a school, a kiln, a mill, a temple, a workshop and a smithy built in year 6. */
const fabric: TownPlan = {
  family: "grid",
  seed: 11,
  axis: 0.3,
  lots: 480,
  whole: 480,
  runs: [
    [0, 0, 16, 10, 10, LEVEL.house, -1],
    [0, 64, 480, 10, 10, LEVEL.house, -1],
  ],
  civics: [
    { kind: "market", at: 16, lots: 4, start: 5, end: 6, fell: null },
    { kind: "school", at: 24, lots: 4, start: 5, end: 6, fell: null },
    { kind: "kiln", at: 32, lots: 2, start: 5, end: 6, fell: null },
    { kind: "mill", at: 36, lots: 2, start: 5, end: 6, fell: null },
    { kind: "temple", at: 40, lots: 8, start: 5, end: 6, fell: null },
    { kind: "workshop", at: 48, lots: 2, start: 5, end: 6, fell: null },
    { kind: "smithy", at: 52, lots: 2, start: 5, end: 6, fell: null },
  ],
  walls: null,
  months: HOME_MONTHS,
  designs: [{ since: -1, walls: "timber", roof: "thatch", form: "square", pitch: 40 }],
  paved: false,
  water: { x: 420, z: 80, r: LAKE_R },
  year: 40,
};

const lots = townLots(fabric.family, fabric.seed, fabric.axis, fabric.lots, fabric.water);
const plan: VillagePlan = {
  ref: "town:0:9",
  name: "Kilnby",
  population: 2400,
  market: true,
  hand: false,
  districts: null,
  biome: 8,
  seed: 5,
  homes: Array.from({ length: 12 }, (_, k) => ({
    x: lots.x[70 + k * 6]!,
    z: lots.z[70 + k * 6]!,
    yaw: lots.yaw[70 + k * 6]!,
    household: `hhold:0:${k}`,
  })),
  fields: [
    { x: -420, z: 30, w: 40, d: 25, yaw: 0 },
    { x: -380, z: -160, w: 40, d: 25, yaw: 0.4 },
  ],
  pasture: { x: 30, z: 470, r: 90 },
  wild: 700,
  water: { x: 420, z: 80 },
  house: { walls: "timber", roof: "thatch", form: "square", pitch: 40, design: null },
  body: null,
  road: { x: 1100 * Math.cos(fabric.axis), z: 1100 * Math.sin(fabric.axis) },
  // Crafters and farmers; every ninth a child of eight.
  people: Array.from({ length: 54 }, (_, i) => ({
    ref: `prsn:0:${i}`,
    name: `P${i} Test`,
    home: i % 12,
    age: i % 9 === 8 ? 8 : 20 + ((i * 7) % 30),
    occupation: i % 9 === 8 ? OCC.dependent : i % 2 ? OCC.crafter : OCC.farmer,
    child: i % 9 === 8,
  })),
  town: fabric,
};

const ground = villageSolids(plan);
/** The first day from `from` on that is (or is not) a day of rest. */
function dayFrom(from: number, rest: boolean): number {
  let day = from;
  while (restDay(plan, day) !== rest) day++;
  return day;
}
const DAY0 = dayFrom(365 * 40 + 120, false);
const doors = civicDoors(plan, DAY0 * DAY);
const near = (m: Moment, p: { x: number; z: number }, r: number) =>
  Math.hypot(m.x - p.x, m.z - p.z) < r;
/** Someone's moments through a day, twenty seconds apart (a walk across the town is a minute or two), from an hour to an hour. */
function through(i: number, day: number, from = 6, to = 19): Moment[] {
  const out: Moment[] = [];
  for (let m = from * 180; m < to * 180; m++) out.push(momentOf(plan, i, day * DAY + m * 20));
  return out;
}

test("a town's buildings standing are told by kind, each with its door on its street", () => {
  for (const kind of ["market", "school", "kiln", "mill", "temple", "workshop", "smithy"] as const)
    assert.equal(doors.get(kind)?.length, 1, kind);
  assert.equal(doors.get("kiln")![0]!.words, "the potter's kiln");
  assert.equal(doors.get("mill")![0]!.words, "the mill");
  // (None stood before it was built.)
  assert.equal(civicDoors(plan, 5 * YEAR_S).size, 0);
});

test("the town's children go to its school of a morning, in rows before it with their teacher before them, and play after", () => {
  const town = townDay(plan, DAY0, ground),
    pupils = town.roles.flatMap((r, i) => (r.kind === "school" ? [i] : [])),
    teachers = town.roles.flatMap((r, i) => (r.kind === "teach" ? [i] : [])),
    school = doors.get("school")![0]!;
  assert.deepEqual(
    pupils,
    plan.people.flatMap((p, i) => (p.child ? [i] : [])),
    "every child of an age for it",
  );
  assert.equal(teachers.length, 1, "one to teach them");
  const at10 = pupils.map((i) => momentOf(plan, i, DAY0 * DAY + 10 * HOUR));
  for (const m of at10) {
    assert.equal(m.task, "learn");
    assert.ok(near(m, school.door, 14), "before the school");
  }
  // In rows: no two in one place.
  for (let a = 0; a < at10.length; a++)
    for (let b = a + 1; b < at10.length; b++)
      assert.ok(Math.hypot(at10[a]!.x - at10[b]!.x, at10[a]!.z - at10[b]!.z) > 0.5);
  const teacher = momentOf(plan, teachers[0]!, DAY0 * DAY + 10 * HOUR);
  assert.equal(teacher.task, "talk");
  assert.ok(near(teacher, school.door, 6), "the teacher at its door");
  assert.match(teacher.why ?? "", /Teaching/);
  // The afternoon at play.
  const at15 = momentOf(plan, pupils[0]!, DAY0 * DAY + 15 * HOUR);
  assert.equal(at15.task, "play");
});

test("the potters fire the kiln with the yard's wood, throw pots by it, and bring them to the market hall", () => {
  const town = townDay(plan, DAY0, ground),
    potters = town.roles.flatMap((r, i) => (r.kind === "kiln" ? [i] : []));
  assert.ok(potters.length > 0, "some at the kiln");
  const kiln = doors.get("kiln")![0]!,
    market = doors.get("market")![0]!,
    seen = through(potters[0]!, DAY0);
  assert.ok(
    seen.some((m) => m.carry === "log" && /kiln/.test(m.why ?? "")),
    "wood for the kiln",
  );
  assert.ok(
    seen.some((m) => m.task === "tend" && near(m, kiln.door, 9)),
    "firing it",
  );
  assert.ok(
    seen.some((m) => m.task === "throw" && near(m, kiln.door, 9)),
    "at the wheel",
  );
  assert.ok(
    seen.some((m) => m.carry === "pots"),
    "carrying the pots",
  );
  assert.ok(
    seen.some((m) => m.task === "load" && near(m, market.door, 4) && /pots/.test(m.why ?? "")),
    "setting them out at the market hall",
  );
});

test("the millers carry the granary's grain to the mill, grind it, and bring the flour back", () => {
  const town = townDay(plan, DAY0, ground),
    millers = town.roles.flatMap((r, i) => (r.kind === "mill" ? [i] : []));
  assert.equal(millers.length, 2, "two to the mill");
  const mill = doors.get("mill")![0]!,
    seen = through(millers[0]!, DAY0);
  assert.ok(seen.some((m) => m.carry === "sack" && /to the mill/.test(m.why ?? "")));
  assert.ok(
    seen.some((m) => m.task === "tend" && near(m, mill.door, 9)),
    "grinding at the mill",
  );
  assert.ok(
    seen.some((m) => m.carry === "sack" && /flour/.test(m.why ?? "")),
    "the flour back",
  );
});

test("however much the town raises, its school keeps its teacher and its kiln and mill a hand each, the same day on day", () => {
  // (The same town raising a third of its homes through this year — a run of the year before
  // goes up through the next: its sites want more hands than it has.)
  const busy: VillagePlan = {
      ...plan,
      ref: "town:0:10",
      town: {
        ...fabric,
        runs: [
          [0, 0, 16, 10, 10, LEVEL.house, -1],
          [0, 64, 300, 10, 10, LEVEL.house, -1],
          [0, 300, 480, 39, 39, LEVEL.house, -1],
        ],
      },
    },
    g = villageSolids(busy),
    crafters = busy.people.flatMap((p, i) => (p.occupation === OCC.crafter ? [i] : [])),
    kept = { teach: new Set<number>(), kiln: new Set<number>(), mill: new Set<number>() };
  let swept = 0,
    days = 0;
  for (let day = DAY0; day < DAY0 + 21; day++) {
    if (restDay(busy, day)) continue;
    days++;
    const town = townDay(busy, day, g),
      at = (kind: string) => town.roles.flatMap((r, i) => (r.kind === kind ? [i] : []));
    assert.equal(at("teach").length, 1, `one teaching on day ${day}`);
    assert.ok(at("kiln").length >= 1, `one at the kiln on day ${day}`);
    assert.ok(at("mill").length >= 1, `one at the mill on day ${day}`);
    for (const kind of ["teach", "kiln", "mill"] as const) kept[kind].add(at(kind)[0]!);
    // (A day the sites and the woodlot took every crafter but those kept.)
    const rest = crafters.filter((i) => !["teach", "kiln", "mill"].includes(town.roles[i]!.kind));
    if (rest.every((i) => ["build", "cut"].includes(town.roles[i]!.kind))) swept++;
  }
  assert.ok(
    days >= 15 && swept >= days / 2,
    `days the sites took all the rest: ${swept} of ${days}`,
  );
  for (const kind of ["teach", "kiln", "mill"] as const)
    assert.equal(kept[kind].size, 1, `the same ${kind} day on day`);
});

test("on a day of rest most of the town stands at prayer before its temple in the morning", () => {
  const rest = dayFrom(DAY0, true),
    temple = doors.get("temple")![0]!,
    at10 = plan.people.map((_, i) => momentOf(plan, i, rest * DAY + 10 * HOUR)),
    praying = at10.filter((m) => m.task === "pray");
  assert.ok(praying.length >= plan.people.length * 0.5, `${praying.length} at prayer`);
  for (const m of praying) assert.ok(near(m, temple.door, 18), "before the temple");
  // And home again by noon.
  const at13 = plan.people.map((_, i) => momentOf(plan, i, rest * DAY + 13 * HOUR));
  assert.equal(at13.filter((m) => m.task === "pray").length, 0);
});

test("a town's kilns, smithies and workshops smoke from their chimneys; its mills' sails are drawn turning", () => {
  const t = DAY0 * DAY,
    scene = townScene(fabric, t),
    tops = civicChimneys(scene, t);
  for (const kind of ["kiln", "smithy", "workshop"] as const) {
    const d = doors.get(kind)![0]!.middle;
    assert.ok(
      tops.some((c) => Math.hypot(c.x - d.x, c.z - d.z) < 12 && c.y >= 8),
      `${kind}'s chimney smokes`,
    );
  }
  const motions = civicMotions(scene, t);
  assert.deepEqual(motions.map((m) => m.kind).sort(), ["kiln", "mill", "smithy"]);
  const mill = motions.find((m) => m.kind === "mill")!;
  assert.equal(mill.y, 9, "its sails' hub up its tower");
  // Its sails drawn with it still (far off), or not (turning, by themselves).
  const still = new TownParts(),
    turning = new TownParts();
  townCivics(scene, t, still);
  townCivics(scene, t, turning, false);
  const count = (p: TownParts) => [...p.groups.values()].reduce((a, g) => a + g.data.length / 7, 0);
  assert.equal(count(still) - count(turning), 2, "two sail bars fewer");
});
