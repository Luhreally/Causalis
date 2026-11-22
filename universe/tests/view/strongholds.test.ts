import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BROUGHT,
  DISTRICT,
  GONE_YEARS,
  HOLD_FOOT,
  districtOf,
  districtShares,
  holdOf,
  holdPlaces,
  holdSpot,
  streetsLaid,
  townForm,
  townLots,
  wetGround,
  type Brought,
  type FormFacts,
  type HoldFacts,
  type TownHold,
  type TownPlan,
  type TownSite,
} from "../../src/bridge/index.ts";
import { TownParts, townGround, townHomes, townScene } from "../../src/view/index.ts";
import { districtAt } from "../../src/view/townform.ts";
import { YEAR } from "../../src/kernel/index.ts";

// Asked 2026-11-21, and corrected the same day: strongholds and districts from the forces the world holds (bridge/
// strongholds.ts, bridge/districts.ts), not a ladder keyed to the age. Each check varies one force and holds the rest.

/** Battles on a land, a few years apart, each with what its foe brought. */
function pressed(from: number, n: number, brought: Brought, weight = 1) {
  return Array.from({ length: n }, (_, k) => ({ year: from + 6 * k, brought, weight }));
}
const REALM: HoldFacts = {
  holder: "realm",
  threats: pressed(1000, 4, BROUGHT.engines),
  now: 1040,
  walls: 2,
  means: 0.7,
  reach: 0.5,
  holds: true,
};

test("the same land with cannon brought against it raises bastions; without, a curtain flanked by towers and rings", () => {
  const without = holdOf(REALM),
    cannon = holdOf({ ...REALM, threats: pressed(1000, 4, BROUGHT.shot) });
  assert.equal(without.form, "rings");
  assert.equal(cannon.form, "bastions");
  // (And pressed less often, one ring.)
  assert.equal(holdOf({ ...REALM, threats: pressed(1000, 1, BROUGHT.engines) }).form, "towers");
  // (Against hands and ladders, height and a ditch: a keep in its curtain where the land builds in stone.)
  assert.equal(holdOf({ ...REALM, threats: pressed(1000, 2, BROUGHT.hands) }).form, "keep");
});

test("what the wall is built of is what the land and the holder have: no stone, or no means, earth and timber", () => {
  assert.equal(holdOf({ ...REALM, walls: 0 }).form, "mound");
  assert.equal(holdOf({ ...REALM, walls: 0 }).stone, false);
  assert.equal(holdOf({ ...REALM, means: 0.1 }).form, "mound");
  assert.equal(holdOf(REALM).stone, true);
});

test("a secure realm has few strongholds, a feuding one many: its houses fortify only where its will is weakly done", () => {
  const houses = (reach: number) =>
      [0, 1, 2].map((k) => holdOf({ ...REALM, holder: "house", reach, means: 0.5 + 0.1 * k })),
    count = (reach: number) =>
      [holdOf({ ...REALM, reach }), ...houses(reach)].filter((h) => h.form).length;
  assert.equal(count(0.85), 1);
  assert.equal(count(0.3), 4);
});

test("against shot a house's own walls stop paying: it raises none, and what stands stays as it was", () => {
  const house: HoldFacts = { ...REALM, holder: "house", reach: 0.3 };
  assert.equal(holdOf({ ...house, threats: pressed(1000, 4, BROUGHT.shot) }).form, null);
  const both = holdOf({
    ...house,
    threats: [...pressed(900, 3, BROUGHT.engines), ...pressed(1000, 4, BROUGHT.shot)],
  });
  assert.equal(both.form, "rings");
  assert.equal(both.raised, 912);
});

test("no battle near, no stronghold; a battle beside the land alone is not enough", () => {
  assert.equal(holdOf({ ...REALM, threats: [] }).form, null);
  assert.equal(
    holdOf({ ...REALM, threats: [{ year: 1000, brought: BROUGHT.engines, weight: 0.5 }] }).form,
    null,
  );
});

test("when the threat goes the seat turns to display: kept up and lived in, or a ruin, by whether it is kept up", () => {
  const later = { ...REALM, now: 1040 + GONE_YEARS + 1 };
  assert.equal(holdOf(REALM).state, "held");
  assert.equal(holdOf(later).gone, "secure");
  assert.equal(holdOf(later).state, "kept");
  assert.equal(holdOf({ ...later, holds: false }).state, "ruin");
  assert.equal(holdOf({ ...later, means: 0.1 }).state, "ruin");
  // (Foes who bring arms no wall answers: walls stop mattering at once; a state whose will is done far keeps offices.)
  const outmatched = {
    ...REALM,
    threats: [...REALM.threats, { year: 1039, brought: BROUGHT.beyond, weight: 1 }],
  };
  assert.equal(holdOf(outmatched).gone, "outmatched");
  assert.equal(holdOf({ ...outmatched, reach: 0.8 }).show, "offices");
  assert.equal(holdOf(outmatched).show, null);
  // (A secure house that holds its land and can pay raises a country house where it never fortified.)
  assert.equal(
    holdOf({ ...REALM, holder: "house", reach: 0.9, threats: [], now: 1040 }).show,
    "house",
  );
});

const SITE: TownSite = {
  up: 0.6,
  rise: 30,
  lee: 2.4,
  roads: [
    { bearing: 0.3, busy: 4, rails: true, to: 1 },
    { bearing: 2.9, busy: 1, rails: false, to: 2 },
  ],
  measured: -1,
  walled: null,
  dry: false,
};

test("a stronghold stands up the town's rise, off its roads in, and never on water", () => {
  const s = holdSpot(SITE, null, 180, 30)!;
  assert.ok(s, "a spot");
  assert.ok(s.climb > 0, `up the rise (climb ${s.climb})`);
  const a = Math.atan2(s.z, s.x);
  for (const r of SITE.roads)
    assert.ok(
      Math.abs(Math.atan2(Math.sin(a - r.bearing), Math.cos(a - r.bearing))) *
        Math.hypot(s.x, s.z) >=
        30,
      "off the road",
    );
  // (A lake over the rise: it goes elsewhere, dry.)
  const lake = { x: 220 * Math.cos(0.6), z: 220 * Math.sin(0.6), r: 120 },
    t = holdSpot(SITE, lake, 180, 30)!;
  assert.ok(Math.hypot(t.x - lake.x, t.z - lake.z) > lake.r + 30, "off the lake");
  assert.equal(wetGround(SITE, t.x, t.z), false);
});

const FOOT: FormFacts = {
  how: "feet",
  share: 0,
  mass: 70,
  winged: false,
  water: false,
  social: 0.6,
  engines: -1,
  rain: 800,
  warm: 12,
  reach: 0.5,
  spare: 0.4,
  stone: true,
  market: true,
  seat: 1,
  people: 4000,
  own: false,
};

test("households with engines of their own spread the town into sprawl; walking keeps it compact", () => {
  const walks = townForm(FOOT),
    drives = townForm({ ...FOOT, how: "wheels", share: 0.6, engines: 30 }),
    sprawl = (f: ReturnType<typeof townForm>) =>
      districtShares(f, 2000, 0, () => false)[DISTRICT.sprawl]!,
    apart = (f: ReturnType<typeof townForm>) => {
      const s = districtShares(f, 2000, 0, () => false);
      return s[DISTRICT.edge]! + s[DISTRICT.sprawl]! + s[DISTRICT.line]!;
    };
  assert.equal(sprawl(walks), 0);
  assert.ok(sprawl(drives) > 0.5, `sprawl ${sprawl(drives)}`);
  assert.ok(apart(walks) < 0.35, `apart on foot ${apart(walks)}`);
  // (A line they all share: villas strung along its roads, the old edge between.)
  const line = townForm({ ...FOOT, how: "line", share: 0.4, engines: 30 });
  assert.equal(districtOf(line, 1990, 2000, 0, true), DISTRICT.line);
  assert.equal(districtOf(line, 1990, 2000, 0, false), DISTRICT.edge);
  // (Walls make the ground within them scarce: built close to the last lot.)
  assert.equal(districtOf(drives, 1990, 2000, 2000, false), DISTRICT.core);
});

/** A seat with a stronghold about it. */
function seatPlan(facts: FormFacts, hold: TownHold["hold"]): TownPlan {
  const laid = streetsLaid(facts),
    lots = 1200;
  return {
    family: "lanes",
    site: laid ? { ...SITE, laid } : SITE,
    form: townForm(facts),
    rank: {
      gini: 0,
      drives: false,
      holds: [
        {
          holder: "realm",
          name: "the realm",
          ref: "pol:1:1",
          color: [0.8, 0.1, 0.1],
          hold,
          whys: [],
          k: 0,
        },
      ],
    },
    seed: 77,
    axis: 0.3,
    lots,
    whole: lots,
    runs: [[0, 0, lots, 10, 12, 1, -1]],
    civics: [],
    walls: null,
    months: [1, 2, 4, 8, 12, 24, 36],
    designs: [{ since: -1, walls: "stone", roof: "tile", form: "", pitch: 40 }],
    paved: true,
    water: null,
    year: 12,
  };
}

test("a stronghold's ground is its own: no home or block of the town on it, and the rest drawn as before", () => {
  const hold = holdOf(REALM),
    plan = seatPlan(FOOT, hold),
    bare: TownPlan = { ...plan, rank: undefined },
    lots = townLots(plan.family, plan.seed, plan.axis, plan.lots, plan.water, plan.site ?? null),
    places = holdPlaces(plan, lots);
  assert.equal(places.length, 1);
  const p = places[0]!;
  assert.equal(p.r, HOLD_FOOT.rings);
  const t = 13 * YEAR,
    homes = (pl: TownPlan) => {
      const scene = townScene(pl, t),
        out = new TownParts();
      townHomes(scene, scene.settled, t, out);
      return out;
    },
    onIt = (parts: TownParts, pad: number) => {
      let n = 0;
      for (const g of parts.groups.values())
        for (let i = 0; i < g.data.length; i += 7)
          if (Math.hypot(g.data[i]! - p.x, g.data[i + 2]! - p.z) < p.r - pad) n++;
      return n;
    };
  assert.ok(onIt(homes(bare), -20) > 20, "without it, homes stood there (the rule fired)");
  assert.equal(onIt(homes(plan), 0), 0, "no home on its ground");
  // (Every home not on its ground's blocks drawn as it was: the parts of the bare town past them, the same.)
  const without = homes(bare),
    keyed = (parts: TownParts) => {
      const out: string[] = [];
      for (const [key, g] of parts.groups)
        for (let i = 0; i < g.data.length; i += 7)
          if (Math.hypot(g.data[i]! - p.x, g.data[i + 2]! - p.z) > p.r + 60)
            out.push(`${key}|${[...g.data.slice(i, i + 7)].map((v) => v.toFixed(3)).join(",")}`);
      return out.sort();
    };
  assert.deepEqual(keyed(homes(plan)), keyed(without));
  // (And its ground drawn: what stands there is the stronghold, nothing else of the town's.)
  const scene = townScene(plan, t),
    ground = new TownParts(),
    plain = new TownParts();
  townGround(scene, ground);
  townGround(townScene(bare, t), plain);
  assert.ok(ground.count > plain.count, "the stronghold drawn");
});

test("sprawl is drawn as homes on their own plots, hedged, with their drives; a walking town's edge is not", () => {
  const drives = { ...FOOT, how: "wheels" as const, share: 0.6, engines: 0 },
    t = 13 * YEAR,
    plots = (facts: FormFacts) => {
      const plan: TownPlan = {
          ...seatPlan(facts, holdOf({ ...REALM, threats: [] })),
          rank: undefined,
        },
        scene = townScene(plan, t),
        out = new TownParts();
      out.compound = true;
      townHomes(scene, scene.settled, t, out);
      let n = 0;
      for (const g of out.groups.values())
        if (g.mesh === "plot" || g.mesh === "plotCar") n += g.data.length / 7;
      return { n, scene };
    },
    a = plots(drives),
    b = plots(FOOT);
  assert.ok(a.n > 300, `plots in sprawl ${a.n}`);
  assert.equal(b.n, 0);
  assert.equal(districtAt(a.scene, 1100), DISTRICT.sprawl);
});
