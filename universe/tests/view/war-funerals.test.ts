import { test } from "node:test";
import assert from "node:assert/strict";
import { HOME_MONTHS, LEVEL, OCC } from "../../src/rules/index.ts";
import {
  LAKE_R,
  townLots,
  type Feast,
  type TownPlan,
  type VillageLife,
  type VillagePlan,
} from "../../src/bridge/index.ts";
import {
  MOST_BIERS,
  burialNow,
  feastOn,
  funeralsOf,
  gravesBefore,
  marketDay,
  momentOf,
  namedGraves,
  ritesOn,
} from "../../src/view/index.ts";
import { buryingDay } from "../../src/view/graveyard.ts";

// Phase 55 M225: a battle's fallen are borne from their town's square, two days after the battle
// (four where they are brought home from a land beside it): counted with the town's graves, dug as
// they are borne, and the names of those the roll knows told at their graves.

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

/** A town's life that year: quiet, and keeping these feasts. */
function lifeWith(feasts: readonly Feast[]): VillageLife {
  return {
    fed: 1,
    growing: true,
    war: false,
    unrest: 0,
    faith: "the Way",
    talk: [],
    site: null,
    mourning: [],
    newborn: [],
    feasts,
  };
}

// A battle at Yewford's land two days before its funeral, nine of its men dead, two of them named;
// one from a land beside Yewford's, brought home four days on; and one in the next year.
const near = {
    event: "ev:0:900",
    at: (40 * 365 + 2) * DAY + 14 * HOUR,
    dead: 9,
    home: false,
    where: "the battle at Yewford's land",
    named: [
      { name: "Bram Test", age: 31, ref: "folk:town:0:43:5:17" },
      { name: "Cole Test", age: 22, ref: "prsn:0:9" },
    ],
  },
  far = {
    event: "ev:0:901",
    at: (40 * 365 + 4) * DAY + 14 * HOUR,
    dead: 3,
    home: true,
    where: "the battle at Oxley's land",
    named: [],
  },
  later = { ...far, event: "ev:0:902", at: (41 * 365 + 2) * DAY + 14 * HOUR },
  plan = townOf({
    rest: {
      year: 40,
      perYear: 30,
      graves: 400,
      named: [{ name: "Ada Mill", year: 39, age: 61, home: 2 }],
      war: [near, far, later],
    },
  });

test("a battle's fallen are borne from the square at two", () => {
  const funerals = funeralsOf(plan),
    f = funerals.find((q) => q.key === "war:ev:0:900")!;
  assert.ok(f, "a funeral for the battle's fallen");
  assert.equal(f.home, -1, "from the square");
  assert.equal(f.struck, null);
  assert.equal(f.leaves, near.at, "at two, two days after the battle");
  assert.equal(f.dead, 9);
  assert.equal(f.biers, Math.min(9, MOST_BIERS));
  assert.equal(f.war?.where, "the battle at Yewford's land");
  const brought = funerals.find((q) => q.key === "war:ev:0:901");
  assert.ok(brought, "and the far battle's, brought home");
  assert.equal(brought.war?.home, true);
  assert.ok(!funerals.some((q) => q.key === "war:ev:0:902"), "the later one falls in another year");
  const none = townOf({ rest: { ...plan.rest!, war: [{ ...near, dead: 0 }] } });
  assert.ok(!funeralsOf(none).some((q) => q.key.startsWith("war:")), "no dead, no funeral");
});

test("their day keeps the square: no feast, no market", () => {
  const day = Math.floor(near.at / DAY),
    feast: Feast = { day, occasion: "harvest", words: "the harvest is in", ref: null },
    seed = (3 - (day % 7) + 7) % 7,
    unstruck = { ...plan, rest: { ...plan.rest!, war: [] } };
  assert.equal(buryingDay(plan, day), true);
  assert.equal(buryingDay(unstruck, day), false);
  // (Its feast that day, and its market: put off while the square keeps them.)
  assert.equal(feastOn({ ...unstruck, life: lifeWith([feast]) }, day)?.occasion, "harvest");
  assert.equal(feastOn({ ...plan, life: lifeWith([feast]) }, day), null, "the feast put off");
  assert.equal(marketDay({ ...unstruck, seed }, day), true);
  assert.equal(marketDay({ ...plan, seed }, day), false, "no market that day");
});

test("graves: counted with the year's dead, dug as they are buried, named", () => {
  // (Its named dead and its war dead, though counted, not yet among its graves.)
  assert.equal(gravesBefore(plan), 400 - 1 - 12);
  let plot = gravesBefore(plan);
  for (const f of funeralsOf(plan)) {
    assert.equal(f.plot, plot, `${f.key}'s grave`);
    plot += f.dead;
  }
  const f = funeralsOf(plan).find((q) => q.key === "war:ev:0:900")!,
    names = namedGraves(plan);
  assert.deepEqual(
    names.find((g) => g.name === "Bram Test"),
    {
      name: "Bram Test",
      year: 39,
      age: 31,
      plot: f.plot,
      buried: f.leaves,
    },
  );
  assert.equal(names.find((g) => g.name === "Cole Test")?.plot, f.plot + 1);
});

test("the town gathers: bearers, mourners, the words said", () => {
  const f = funeralsOf(plan).find((q) => q.key === "war:ev:0:900")!,
    day = Math.floor(f.leaves / DAY),
    rite = ritesOn(plan, day).find((r) => r.f.key === "war:ev:0:900")!;
  assert.equal(rite.bearers.length, 4 * f.biers);
  assert.equal(burialNow(plan, f.leaves - 5 * 60).mourning, true, "the town mourns");
  const said = plan.people.some((_, i) =>
    (momentOf(plan, i, f.leaves - 5 * 60).why ?? "").includes(
      "the fallen of the battle at Yewford's land",
    ),
  );
  assert.ok(said, "whose dead they are is said");
});

test("a plan with no war is as before", () => {
  const none = townOf({ rest: { ...townOf().rest!, war: [] } });
  assert.deepEqual(funeralsOf(townOf()), funeralsOf(none));
  assert.equal(gravesBefore(townOf()), 399);
  assert.equal(gravesBefore(none), 399);
});
