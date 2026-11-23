import { test } from "node:test";
import assert from "node:assert/strict";
import type { PossessBody, PossessLive, VillagePlan } from "../../src/bridge/index.ts";
import {
  JOIN_M,
  NEAR_M,
  OUT_OF_SIGHT,
  PosedBodies,
  STILL_BID,
  WAY_STEP,
  agentOf,
  bidOf,
  bodyMoment,
  drawnHeight,
  nearSight,
  sightUp,
  joinsAt,
  lettersOf,
  momentOf,
  placesNear,
  takeOf,
  villageSolids,
  workOf,
  type Presence,
} from "../../src/view/index.ts";
import { OCC, POSSESS_HZ, POSSESS_MOST, bidsOf } from "../../src/rules/index.ts";

// Phase 60: one of a town's people possessed, as the view lays it out — the bid of a step from the
// stick and the eye, the taking (where he and those near are drawn, their ways, the town's solids
// and its places of work), those joining as he goes, and the bodies of the small world drawn over
// the town at the possession's own clock.

const DAY = 86_400,
  HOUR = 3_600;
const OCCS = [OCC.farmer, OCC.crafter, OCC.farmer, OCC.herder, OCC.crafter, OCC.forager];
const people: VillagePlan["people"][number][] = Array.from({ length: 36 }, (_, i) => ({
  // (Under the hand: each of them one of its people; the last two are not.)
  ref: i < 34 ? `agent:${100 + i}` : `prsn:0:${i}`,
  name: `P${i} of Harrowby`,
  home: i % 6,
  age: 34,
  occupation: i % 12 === 11 ? OCC.dependent : OCCS[i % 6]!,
  child: i % 12 === 11,
}));
/** A village, its fields crowding about its middle (a great town's fields far outnumber its smithies). */
const plan: VillagePlan = {
  ref: "town:0:7",
  name: "Harrowby",
  population: 240,
  market: false,
  hand: true,
  districts: null,
  biome: 8,
  seed: 3,
  homes: Array.from({ length: 6 }, (_, k) => ({
    x: 22 * Math.cos(k + 0.3),
    z: 22 * Math.sin(k + 0.3),
    yaw: k,
    household: `hhold:0:${k + 1}`,
  })),
  fields: Array.from({ length: 90 }, (_, k) => ({
    x: 40 + 6 * (k % 10),
    z: -30 + 6 * Math.floor(k / 10),
    w: 5,
    d: 5,
    yaw: 0,
  })),
  pasture: { x: -200, z: 0, r: 90 },
  wild: 320,
  water: { x: 0, z: -500 },
  house: { walls: "wattle", roof: "thatch", form: "long", pitch: 45, design: null },
  body: null,
  road: { x: 700, z: 700 },
  era: "metal",
  people,
  fauna: { wild: [], flock: null, raided: false },
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
};
const t = 365 * 40 * DAY + 3 * DAY + 10.5 * HOUR;

test("a step's bid is the stick as the eye looks: ahead is where it looks, right its right", () => {
  // (Looking along +z, the eye's right is -x, as the view draws.)
  assert.deepEqual(bidOf({ x: 0, y: 1 }, 0, false, 0), { mx: 0, mz: 31, run: false, act: 0 });
  assert.deepEqual(bidOf({ x: 1, y: 0 }, 0, true, 2), { mx: -31, mz: 0, run: true, act: 2 });
  // Looking along +x: ahead is +x.
  const east = bidOf({ x: 0, y: 1 }, Math.PI / 2, false, 0);
  assert.equal(east.mx, 31);
  assert.equal(Math.abs(east.mz), 0);
  // A push past the rim is the rim; none, still.
  const far = bidOf({ x: 3, y: 3 }, 0, false, 0);
  assert.ok(Math.abs(Math.hypot(far.mx, far.mz) - 31) <= 1);
  assert.deepEqual(bidOf({ x: 0, y: 0 }, 1.2, false, 0), STILL_BID);
  // In letters, as the host takes them, and back.
  const bids = [
    bidOf({ x: 0.3, y: -0.8 }, 2, true, 3),
    STILL_BID,
    bidOf({ x: -1, y: 0 }, -1, false, 1),
  ];
  assert.equal(lettersOf(bids).length, 9);
  assert.deepEqual(bidsOf(lettersOf(bids)), bids);
});

test("only the hand's people can be taken; a taking holds where they and those near are drawn", () => {
  assert.equal(agentOf({ ref: "agent:104" }), 104);
  assert.equal(agentOf({ ref: "prsn:0:4" }), null);
  assert.equal(takeOf(plan, 35, t), null, "not one of the hand's people");
  const me = 1,
    a = takeOf(plan, me, t)!;
  assert.equal(a.agent, 101);
  const m = momentOf(plan, me, t);
  assert.ok(Math.abs(a.at.x - m.x) < 0.01 && Math.abs(a.at.z - m.z) < 0.01, "where he is drawn");
  assert.equal(a.trade, workOf(plan, me, t).trade);
  // Those near him: the hand's people within NEAR_M, not hidden, the nearest first, each with a minute's way.
  let last = -1;
  for (const n of a.near) {
    assert.ok(n.id !== 101 && n.id >= 100 && n.id < 134);
    const d = Math.hypot(n.x - a.at.x, n.z - a.at.z);
    assert.ok(d <= NEAR_M + 0.01);
    assert.ok(d >= last - 0.01);
    last = d;
    assert.equal(n.ways.length, 5 * POSSESS_MOST.ways);
    assert.equal(n.ways[0], 0);
    assert.equal(n.ways[5], WAY_STEP);
  }
  assert.equal(a.solids.length % 7, 0);
  assert.ok(a.solids.length / 7 <= POSSESS_MOST.solids);
  assert.ok(a.places.length <= POSSESS_MOST.places);
});

test("a great town's fields do not crowd out its smithy: the nearest of each kind of work is taken", () => {
  const ground = villageSolids(plan),
    at = { x: 60, z: 0 },
    places = placesNear(plan, ground, t, at),
    kinds = new Set(places.map((p) => p.kind));
  assert.ok(plan.fields.length > POSSESS_MOST.places);
  for (const k of ["forge", "rack", "loom", "granary", "row"]) assert.ok(kinds.has(k as never), k);
  assert.equal(places.length, POSSESS_MOST.places);
  for (let i = 1; i < places.length; i++) {
    const d0 = Math.hypot(places[i - 1]!.x - at.x, places[i - 1]!.z - at.z),
      d1 = Math.hypot(places[i]!.x - at.x, places[i]!.z - at.z);
    assert.ok(d1 >= d0 - 1e-6, "the nearest first");
  }
  // Each crafter's work (at the forge or the loom, as their day has it): how far it stands.
  const crafters = people.flatMap((p, i) => (p.occupation === OCC.crafter ? [i] : []));
  assert.ok(crafters.length > 0);
  for (const i of crafters) {
    const w = workOf(plan, i, t);
    assert.ok(w.trade === "smith" || w.trade === "weaver", w.trade);
    assert.ok(w.far >= 0, `${people[i]!.name}: no ${w.trade}'s place near`);
  }
  // A child has no trade to be set to.
  assert.deepEqual(workOf(plan, 11, t), { trade: "", form: "", far: -1 });
});

test("those near him join each second: those come within reach, and those whose way runs out", () => {
  const me = takeOf(plan, 1, t)!,
    from = t,
    inWorld = new Map<number, number>();
  // None in the small world yet: those within JOIN_M of him, the nearest first.
  const fresh = joinsAt(plan, from, 0, me.at, inWorld);
  assert.ok(fresh.length <= POSSESS_MOST.joins);
  for (const j of fresh) {
    assert.ok(Math.hypot(j.x - me.at.x, j.z - me.at.z) <= JOIN_M + 0.01);
    assert.equal(j.when, 0);
    assert.equal(j.ways[0], 0);
  }
  // Those in it whose way runs on are left be; those whose way runs out within twenty seconds are given it again.
  for (const j of fresh) inWorld.set(j.id, 40 * POSSESS_HZ);
  assert.deepEqual(
    joinsAt(plan, from, 0, me.at, inWorld).filter((j) => inWorld.has(j.id)),
    [],
  );
  const later = joinsAt(plan, from, 25 * POSSESS_HZ, me.at, inWorld);
  assert.ok(
    fresh.every((j) => later.some((k) => k.id === j.id)) || later.length === POSSESS_MOST.joins,
  );
  for (const j of later) if (inWorld.has(j.id)) assert.equal(j.ways[0], 25 * POSSESS_HZ);
});

const body = (o: Partial<PossessBody>): PossessBody => ({
  id: 101,
  x: 3,
  z: 4,
  yaw: 0.5,
  vx: 0,
  vz: 0,
  doing: "hand",
  task: -1,
  carry: null,
  say: "",
  ...o,
});

test("a body of the small world as drawn: carried on at its pace, at its work by his trade, lying where it fell", () => {
  const walking = bodyMoment(body({ vx: 1.3 }), 0.05, "smith", "sickle", true);
  assert.ok(Math.abs(walking.x - (3 + 1.3 * 0.05)) < 1e-9);
  assert.equal(walking.task, null);
  // (Never carried on more than a tenth of a second past what the host told.)
  assert.ok(Math.abs(bodyMoment(body({ vx: 1.3 }), 5, "smith", "sickle", true).x - 3.13) < 1e-9);
  assert.equal(bodyMoment(body({ doing: "work" }), 0, "smith", "sickle", true).task, "hammer");
  assert.equal(bodyMoment(body({ doing: "work" }), 0, "potter", "jar", true).task, "throw");
  assert.equal(bodyMoment(body({ doing: "work" }), 0, "farmer", "row", true).task, "hoe");
  const down = bodyMoment(body({ doing: "down", vx: 2 }), 0.1, "smith", "sickle", false);
  assert.equal(down.x, 3, "the fallen do not slide");
  assert.equal(
    bodyMoment(body({ doing: "way", task: OUT_OF_SIGHT }), 0, "", "", false).hidden,
    true,
  );
  assert.equal(bodyMoment(body({ carry: "sack" }), 0, "", "", false).carry, "sack");
});

test("the town drawn at the possession's clock, the small world's bodies posed over it", () => {
  const posed = new PosedBodies(plan, t, "smith", "sickle", 101);
  posed.step = 30;
  assert.equal(posed.at(), t + 30 / POSSESS_HZ);
  assert.equal(posed.indexOf(101), 1);
  assert.equal(posed.indexOf(999), -1);
  const live = {
    step: 30,
    kept: 20,
    bodies: [body({ vx: 1, x: 10, z: 10 }), body({ id: 104, doing: "down", x: 12, z: 10 })],
    lying: [],
    offers: [],
    told: null,
    strip: { name: "P1", what: "a smith", strength: 1, carries: "empty-handed", body: "whole" },
    deeds: { made: 0, struck: 0, spoke: 0, took: 0 },
    ended: "",
  } satisfies PossessLive;
  posed.live = live;
  const drawn = plan.people.map((_, i) => ({
      moment: momentOf(plan, i, posed.at()),
      size: 1,
      stride: 0,
    })),
    presence = new Map<string, Presence>(
      ["agent:101", "agent:104"].map((r) => [
        r,
        { x: 0, z: 0, vx: 0, vz: 0, yaw: 0, size: 1, blinking: true, stride: 0 },
      ]),
    );
  posed.pose(drawn, presence);
  assert.equal(drawn[1]!.moment.x, 10);
  assert.equal(drawn[4]!.moment.x, 12);
  assert.deepEqual([...posed.downed], [4], "the one struck down lies");
  assert.equal(presence.get("agent:101")!.x, 10);
  assert.equal(presence.get("agent:101")!.blinking, false);
  assert.equal(presence.get("agent:104")!.vx, 0);
  assert.equal(posed.drawnAt(101)!.x, 10);
  assert.equal(posed.drawnAt(105), null, "not in the small world");
});

test("looking down from high on one held, those nearer the eye along the ground than he fade, by degrees; a tall thing read to its top", () => {
  // (A soldier's eye: well over him, looking down; those behind him along the ground stand at the screen's foot.)
  const h = 1.75,
    eye = { x: 0, y: 3.2 * h, z: -2 * h, tall: h },
    flat = nearSight(eye, { x: 0, z: 0 }, true);
  assert.equal(flat({ x: 0, z: -1.2 * h }), 0, "a rank and more behind him, under the eye");
  assert.equal(flat({ x: 0.8 * h, z: -1.8 * h }), 0, "behind him and aside, at the screen's foot");
  assert.equal(flat({ x: 0.8 * h, z: 0 }), 1, "beside him");
  assert.equal(flat({ x: 0, z: 1.5 * h }), 1, "before him");
  assert.equal(flat({ x: 0.8 * h, z: -0.3 * h }), 1, "close behind him, aside: whole");
  // (Walked from under the eye to past him, and across: never more than a little at a step.)
  for (const across of [0, 0.5, 1.5]) {
    let was = flat({ x: across * h, z: -2 * h });
    for (let z = -2 * h; z < 2 * h; z += 0.01 * h) {
      const a = flat({ x: across * h, z });
      assert.ok(Math.abs(a - was) < 0.15, `${across} across, at ${z / h}: ${was} to ${a}`);
      was = a;
    }
  }
  // (A stake as tall as the eye beside it, its foot beside him: read at its foot whole, read to its top gone.)
  const low = nearSight({ x: 0, y: 2 * h, z: -2.6 * h, tall: h }, { x: 0, z: 0 }),
    up = sightUp(low);
  assert.equal(up(1.2 * h, -1.8 * h, 0, 0.5 * h), low({ x: 1.2 * h, z: -1.8 * h, lift: 0 }));
  assert.ok(
    low({ x: 0.6 * h, z: -2.3 * h, lift: 0 }) > 0.5,
    "its foot alone, by the eye: much of it drawn",
  );
  assert.equal(up(0.6 * h, -2.3 * h, 0, 2.2 * h), 0, "read up it to its top by the eye: gone");
});

test("the eye stands off by the body's height as the town draws it (its true height: view/stature.ts)", () => {
  const h = drawnHeight(plan);
  assert.ok(h > 1.7 && h < 1.8, `${h}`);
  assert.ok(drawnHeight({ body: null }) === h);
});

test("those near the eye behind him, or between it and him, fade out by degrees, never at once", () => {
  const h = drawnHeight(plan),
    eye = { x: 10, y: 0.9 * h, z: 10 - 2.6 * h, tall: h },
    sight = nearSight(eye, { x: 10, z: 10 });
  // (Between: on the line from the eye to him, gone; a little off it, fading; clear of it, whole.)
  assert.equal(sight({ x: 10, z: 10 - 0.6 * h }), 0, "close behind him, in the eye's line");
  const off = [0.15, 0.3, 0.4, 0.5, 0.75].map((k) => sight({ x: 10 + k * h, z: 10 - 0.6 * h }));
  assert.ok(
    off.every((a, i) => i === 0 || a >= off[i - 1]!),
    `${off}: more drawn the farther off it`,
  );
  assert.ok(
    off.some((a) => a > 0.05 && a < 0.95),
    `${off}: by degrees`,
  );
  assert.equal(off.at(-1), 1);
  // (Near the eye, nearer than he is: whole past a body and a half from it, gone within one, by degrees between.)
  const by = [0.3, 0.8, 1, 1.2, 1.5].map((k) => sight({ x: 10 + 0.7 * h, z: eye.z + k * h }));
  assert.ok(
    by.every((a, i) => i === 0 || a >= by[i - 1]!),
    `${by}`,
  );
  assert.equal(by[0], 0);
  assert.equal(by.at(-1), 1);
  assert.ok(
    by.some((a) => a > 0.05 && a < 0.95),
    `${by}: by degrees`,
  );
  assert.equal(sight({ x: 10, z: 10 + 0.8 * h }), 1, "beyond him");
  // (Walked along the eye's line and past him, and across it, with the eye far and near: never more than a little at a step.)
  for (const back of [2.6, 0.6]) {
    const e = { ...eye, z: 10 - back * h },
      look = nearSight(e, { x: 10, z: 10 });
    for (const across of [0, 0.1, 0.3]) {
      let was = look({ x: 10 + across * h, z: e.z - h });
      for (let z = e.z - h; z < 10 + 2 * h; z += 0.01 * h) {
        const a = look({ x: 10 + across * h, z });
        assert.ok(
          Math.abs(a - was) < 0.15,
          `eye ${back} back, ${across} across, at ${(z - 10) / h}: ${was} to ${a}`,
        );
        was = a;
      }
    }
  }
  assert.equal(sight({ x: 10 + 4 * h, z: 10 }), 1, "beside him, far off the line");
  // In the town drawn: those of the small world and the town's own alike, he never.
  const posed = new PosedBodies(plan, t, "smith", "sickle", 101),
    live = {
      step: 30,
      kept: 20,
      bodies: [body({ x: 10, z: 10 }), body({ id: 104, doing: "follow", x: 10, z: 10 - 0.6 * h })],
      lying: [],
      offers: [],
      told: null,
      strip: { name: "P1", what: "a smith", strength: 1, carries: "empty-handed", body: "whole" },
      deeds: { made: 0, struck: 0, spoke: 0, took: 0 },
      ended: "",
    } satisfies PossessLive;
  posed.step = 30;
  posed.live = live;
  const drawn = () =>
    plan.people.map((_, i) => ({ moment: momentOf(plan, i, posed.at()), size: 1, stride: 0 }));
  let d = drawn();
  posed.pose(d, new Map());
  assert.ok(
    posed.alpha.every((a) => a === 1),
    "no eye behind him: all whole",
  );
  posed.eye = eye;
  d = drawn();
  posed.pose(d, new Map());
  assert.equal(posed.alpha[4], 0, "the one in the line");
  assert.equal(posed.alpha[1], 1, "he is whole");
  assert.equal(d[4]!.size, 1, "faded, not shrunk or hidden");
  assert.ok(posed.hid >= 1);
});
