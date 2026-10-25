import { test } from "node:test";
import assert from "node:assert/strict";
import { HOME_MONTHS, LEVEL, OCC } from "../../src/rules/index.ts";
import { LAKE_R, townLots, type TownPlan, type VillagePlan } from "../../src/bridge/index.ts";
import {
  FUNERAL,
  type Funeral,
  MOST_BIERS,
  MOST_ROWS,
  MOST_SECTIONS,
  PLOT,
  burialNow,
  feastOn,
  funeralsOf,
  graveyardAt,
  graveyardFor,
  gravesBefore,
  marketDay,
  momentOf,
  namedGraves,
  plotAt,
  plotsOf,
  ritesOn,
  sayOf,
  villageSolids,
  yardPoint,
} from "../../src/view/index.ts";

// Phase 43 M205: a town's dead and their burying. Its graveyard stands past its homes, walled,
// row on row of graves; its dead of the year are buried on the days they fall — the watched
// households' by name, in the first weeks after the year's turn tells them dead — and those a
// fire or a quake killed two days after it, together; each funeral leaves at ten, its dead on a
// bier borne by four in step, its mourners after it, to a grave dug that morning and filled after.

const DAY = 86_400,
  HOUR = 3_600;

/** A town of homes built in year 10, its plan of year 40. */
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
  civics: [{ kind: "temple", at: 40, lots: 8, start: 5, end: 6, fell: null }],
  walls: null,
  months: HOME_MONTHS,
  designs: [{ since: -1, walls: "timber", roof: "thatch", form: "square", pitch: 40 }],
  paved: false,
  water: { x: 420, z: 80, r: LAKE_R },
  year: 40,
};

const lots = townLots(fabric.family, fabric.seed, fabric.axis, fabric.lots, fabric.water);
function townOf(over: Partial<VillagePlan> = {}): VillagePlan {
  return {
    ref: "town:0:43",
    name: "Yewford",
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
    // Thirty of its dead a year; four hundred in its graveyard; one of a watched household's
    // dead last year, by name.
    rest: {
      year: 40,
      perYear: 30,
      graves: 400,
      named: [{ name: "Ada Mill", year: 39, age: 61, home: 2 }],
    },
    ...over,
  };
}

test("a graveyard is as great as its dead want: a village's small, a great town's in sections side by side, never past its most", () => {
  const small = graveyardAt({ x: 0, z: 0 }, 0, 30, 2),
    great = graveyardAt({ x: 0, z: 0 }, 0, 20_000, 235);
  assert.equal(small.sections, 1);
  assert.ok(small.rows >= 3 && plotsOf(small) >= 30 + 2, "room for its dead and a year's more");
  assert.ok(great.sections > 1 && great.sections <= MOST_SECTIONS);
  assert.ok(great.rows <= MOST_ROWS);
  assert.ok(plotsOf(great) >= 235 * 3, "a great town's keeps some years of its dead");
  // Every plot within its wall, none on another; dug again once it is full.
  const g = graveyardAt({ x: 10, z: -20 }, 0.7, 500, 40),
    cap = plotsOf(g),
    seen: { x: number; z: number }[] = [];
  for (let k = 0; k < cap; k++) {
    const p = plotAt(g, k),
      dx = p.x - g.gate.x,
      dz = p.z - g.gate.z,
      v = dx * Math.cos(g.way) + dz * Math.sin(g.way),
      u = -dx * Math.sin(g.way) + dz * Math.cos(g.way);
    assert.ok(
      Math.abs(u) <= g.w / 2 - PLOT.rim + 1e-6 && v >= PLOT.rim && v <= g.d - PLOT.rim + 1e-6,
    );
    for (const q of seen) assert.ok(Math.hypot(q.x - p.x, q.z - p.z) > 1);
    seen.push(p);
  }
  assert.deepEqual(plotAt(g, cap + 5), plotAt(g, 5));
  // (Its frame: back from its gate along its way.)
  const back = yardPoint(g, 0, 10);
  assert.ok(Math.abs(back.x - (g.gate.x + 10 * Math.cos(0.7))) < 1e-9);
});

test("a town's year of funerals: as many as it buries a year, each leaving at ten, the named dead early in the year from their homes", () => {
  const plan = townOf(),
    year = funeralsOf(plan);
  assert.deepEqual(funeralsOf(townOf()), year, "the same for the same town and year");
  const plain = year.filter((f) => !f.struck && !f.name);
  assert.ok(Math.abs(plain.length - 30) <= 12, `${plain.length} of thirty a year`);
  for (const f of plain) {
    const hour = (f.leaves % DAY) / HOUR;
    assert.ok(hour >= 10 && hour < 19, "from ten in the morning");
    assert.equal(f.home, -2, "from any of its homes");
  }
  const named = year.filter((f) => f.name);
  assert.equal(named.length, 1);
  assert.equal(named[0]!.name, "Ada Mill");
  assert.equal(named[0]!.home, 2, "from their own home");
  assert.ok(Math.floor(named[0]!.leaves / DAY) - 40 * 365 <= 21, "in the first weeks of the year");
  // Its graves dug one after another from those it held as the year began (the named dead's,
  // though counted, not yet among them).
  assert.equal(gravesBefore(plan), 399);
  year.forEach((f, k) => assert.equal(f.plot, 399 + k));
  // Their grave is the one their funeral digs; the named dead of the years before lie among the
  // first graves of the year after they died, buried as its first weeks went.
  const ada = namedGraves(plan).find((g) => g.name === "Ada Mill")!;
  assert.deepEqual([ada.plot, ada.year, ada.buried], [named[0]!.plot, 39, named[0]!.leaves]);
  const older = townOf({
      rest: { ...plan.rest!, named: [{ name: "Old Tom", year: 37, age: 80, home: 1 }] },
    }),
    grave = namedGraves(older)[0]!;
  assert.ok(grave.plot >= 400 - 2 * 30 && grave.plot < 400 - 2 * 30 + 3, `plot ${grave.plot}`);
  assert.equal(Math.floor(grave.buried / DAY / 365), 38);
  assert.equal(grave.year, 37);
});

test("those a fire killed are buried together two days after it, from the square: on biers to the most, its market and feast put off", () => {
  const at = (40 * 365 + 100) * DAY + 11 * HOUR,
    plan = townOf({
      town: {
        ...fabric,
        struck: [{ kind: "fire", at, lot: 120, homes: 3, event: "ev:0:9", dead: 9 }],
      },
      life: {
        fed: 1,
        growing: true,
        war: false,
        unrest: 0,
        faith: "the Way",
        talk: [],
        site: null,
        mourning: [],
        newborn: [],
        feasts: [
          { day: 40 * 365 + 102, occasion: "harvest", words: "the harvest is in", ref: null },
        ],
      },
    }),
    day = Math.floor((at + FUNERAL.struckAfter) / DAY),
    f = funeralsOf(plan).find((q) => q.struck === "ev:0:9")!;
  assert.ok(f, "a funeral for the fire's dead");
  assert.equal(Math.floor(f.leaves / DAY), day);
  assert.equal(f.leaves % DAY, FUNERAL.struckLeaves);
  assert.equal(f.dead, 9);
  assert.equal(f.biers, Math.min(9, MOST_BIERS));
  assert.equal(f.home, -1, "from the square");
  // (Its feast day, and a market day where it keeps its market then: both put off.)
  const unstruck = { ...plan, town: fabric },
    seed = (3 - (day % 7) + 7) % 7;
  assert.equal(feastOn(unstruck, day)?.occasion, "harvest");
  assert.equal(feastOn(plan, day), null, "the feast put off");
  assert.equal(marketDay({ ...unstruck, seed, life: { ...plan.life!, feasts: [] } }, day), true);
  assert.equal(marketDay({ ...plan, seed, life: { ...plan.life!, feasts: [] } }, day), false);
  // Its biers borne off one after another, four to each, the town gathered.
  const rite = ritesOn(plan, day).find((r) => r.f.struck === "ev:0:9")!;
  assert.equal(rite.bearers.length, 4 * f.biers);
  const before = burialNow(plan, f.leaves - 5 * 60);
  assert.equal(before.biers.filter((b) => !b.borne).length, f.biers, "laid out before they go");
  assert.ok(before.mourning, "the town mourning");
  const gathered = plan.people.filter(
    (_, i) => momentOf(plan, i, f.leaves - 5 * 60).task === "mourn",
  ).length;
  assert.ok(gathered >= 4 * f.biers + 8, `${gathered} gathered`);
  const borne = burialNow(plan, f.leaves + (f.biers - 1) * 20 + 60).biers.filter((b) => b.borne);
  assert.equal(borne.length, f.biers, "all of them borne off");
});

test("a funeral's day: its grave dug in the morning, its dead borne in step to it, its mourners about it, then filled in", () => {
  const plan = townOf(),
    yard = graveyardFor(plan)!,
    ground = villageSolids(plan),
    riteOf = (q: Funeral) =>
      ritesOn(plan, Math.floor(q.leaves / DAY)).find((r) => r.f.key === q.key)!,
    // (One whose way out of the town turns its corners.)
    f = funeralsOf(plan).find((q) => q.home === -2 && riteOf(q).ways[0]!.length > 4)!,
    day = Math.floor(f.leaves / DAY),
    rite = riteOf(f),
    grave = rite.graves[0]!;
  // The graveyard past the town's homes.
  assert.ok(Math.hypot(yard.gate.x, yard.gate.z) >= ground.homesReach);
  assert.deepEqual(grave, plotAt(yard, f.plot));
  // Its grave dug in the morning by one come to dig it.
  const at = (t: number) => plan.people.map((_, i) => momentOf(plan, i, t));
  const morning = at(day * DAY + 8.25 * HOUR).filter(
    (m) => m.task === "dig" && Math.hypot(m.x - grave.x, m.z - grave.z) < 6,
  );
  assert.equal(morning.length, 1, "one digging it");
  const dug = burialNow(plan, day * DAY + 8.25 * HOUR).open;
  assert.equal(dug.length, 1);
  assert.ok(dug[0]!.deep > 0 && dug[0]!.deep < 1, "half dug");
  // Gathered before it leaves, its bier set down.
  const gathered = burialNow(plan, f.leaves - 10 * 60);
  assert.equal(gathered.biers.length, 1);
  assert.equal(gathered.biers[0]!.borne, false);
  assert.ok(at(f.leaves - 10 * 60).filter((m) => m.task === "mourn").length >= 6);
  // Borne in step, round its corners too: each of its four never far from it — and so every
  // funeral of the year.
  for (const q of funeralsOf(plan)) {
    const r = riteOf(q);
    assert.equal(r.bearers.length, 4);
    for (let t = r.starts[0]! + 5; t < r.arrive - 40; t += 9) {
      const b = burialNow(plan, t).biers.find((x) => x.bearers[0] === r.bearers[0])!;
      assert.ok(b?.borne, "borne");
      for (const i of r.bearers) {
        const m = momentOf(plan, i, t),
          off = Math.hypot(m.x - b.x, m.z - b.z);
        assert.equal(m.task, "bear");
        assert.ok(off < 4.5, `${q.key}: a bearer ${off.toFixed(1)} m off`);
      }
    }
  }
  // About the grave, the bier set by it.
  const there = burialNow(plan, rite.arrive + 5 * 60);
  assert.ok(Math.hypot(there.biers[0]!.x - grave.x, there.biers[0]!.z - grave.z) < 0.5);
  const about = at(rite.arrive + 5 * 60).filter(
    (m) => m.task === "mourn" && Math.hypot(m.x - grave.x, m.z - grave.z) < 14,
  );
  assert.ok(about.length >= 6, `${about.length} about the grave`);
  // Filled in after: one more grave, none open.
  const filled = Math.max(...rite.filled),
    after = burialNow(plan, filled + 60),
    was = burialNow(plan, rite.done - 60);
  assert.equal(after.graves, was.graves + 1);
  assert.equal(after.open.length, 0);
  assert.ok(
    at(filled - 10 * 60).some(
      (m) => m.task === "dig" && Math.hypot(m.x - grave.x, m.z - grave.z) < 6,
    ),
    "filled in by its digger",
  );
});

test("while the town buries those a strike killed, its talk is of them", () => {
  const plan = townOf(),
    m = {
      ...momentOf(plan, 1, (40 * 365 + 50) * DAY + 10 * HOUR),
      task: "talk" as const,
      hidden: false,
    },
    said = new Set<string | null>();
  for (let s = 0; s < 400; s += 0.7) said.add(sayOf(plan, 1, m, s, false, true));
  said.delete(null);
  assert.deepEqual([...said], ["😢"]);
});
