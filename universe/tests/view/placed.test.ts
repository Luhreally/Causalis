// A battle fought in place before a town (Phase 55 M227): its field laid flat along the town's road
// (no ridge, no river), the beaten flying to its flanks, never into the town behind them; laid clear
// of the town's edge and turned with its road; every figure a man of the roll, each lot as long as
// the field draws it; those come out to watch at the town's edge; the hosts' fires behind their
// lines; the fallen lying, then borne in.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  battleFigures,
  type BattleNear,
  type BattleOutcome,
  type BattleRoll,
  type BattleSideNear,
  type RollEntry,
  type VillagePlan,
} from "../../src/bridge/index.ts";
import {
  BATTLE_LENGTH,
  FIELD,
  MOMENTS,
  PLACED_MOST,
  WATCHERS,
  battleAt,
  battleShelter,
  borneNow,
  fallenNow,
  fieldFrame,
  fieldPoint,
  fieldWatchers,
  figureFate,
  frameYaw,
  newBattle,
  newBlows,
  placeAt,
  placedCamp,
  placedMost,
  placedPoint,
  rollNames,
  villageGround,
} from "../../src/view/index.ts";
import { OCC } from "../../src/rules/index.ts";

const side = (
  name: string,
  fielded: number,
  fallen: number,
  wounded: number,
  arm = "spear",
): BattleSideNear => ({
  ref: `realm:${name}`,
  name: `the realm of ${name}`,
  color: [0.8, 0.2, 0.2],
  arms: null,
  fielded,
  fallen,
  wounded,
  host: { arm, guard: "shield", mount: "" },
  kit: `${arm}s`,
});

function near(
  outcome: BattleOutcome,
  a: BattleSideNear,
  d: BattleSideNear,
  ground: { hills?: boolean; river?: boolean; walls?: 0 | 1 | 2 } = {},
): BattleNear {
  return {
    event: `ev:0:9:${a.fielded}`,
    war: "war:1",
    title: "The battle at the test land",
    cell: 1,
    land: "The test land",
    year: 364,
    attacker: a,
    defender: { ...d, color: [0.2, 0.3, 0.85] },
    won: outcome !== "held",
    outcome,
    civil: null,
    hills: ground.hills ?? false,
    river: ground.river ?? false,
    walls: ground.walls ?? 0,
    town: ground.walls ? "Testholt" : null,
    figure: null,
    plan: {
      seed: "test battle",
      ages: [
        { index: 0, from: 0, to: 0, kind: "quiet", seaLevel: 0, warmth: 0, forests: true },
      ] as never,
      lineages: [],
    },
  };
}

const field = near("field", side("Ash", 4000, 600, 900), side("Elm", 3200, 1400, 700), {
    hills: true,
    river: true,
  }),
  walled = near("stormed", side("Ash", 5000, 900, 600, "axe"), side("Elm", 1500, 1100, 200), {
    walls: 2,
  });

const town: VillagePlan = {
  ref: "town:0:5",
  name: "Fieldham",
  population: 90,
  market: false,
  hand: false,
  districts: null,
  biome: 8,
  seed: 4,
  homes: Array.from({ length: 12 }, (_, k) => {
    const a = k * 2.399963,
      r = 16 + 8.5 * Math.sqrt(k);
    return { x: r * Math.cos(a), z: r * Math.sin(a), yaw: a, household: null };
  }),
  fields: [{ x: 160, z: 20, w: 40, d: 25, yaw: 0 }],
  pasture: { x: -300, z: 0, r: 90 },
  wild: 400,
  water: null,
  house: { walls: "wattle", roof: "thatch", form: "round", pitch: 45, design: null },
  body: null,
  road: { x: 600, z: 800 },
  people: Array.from({ length: 40 }, (_, i) => ({
    ref: `prsn:0:${i + 1}`,
    name: `Person ${i}`,
    home: i % 12,
    age: i < 6 ? 8 : 30,
    occupation: OCC.farmer,
    child: i < 6,
    ...(i === 6 ? { healer: true as const } : {}),
    ...(i === 7 ? { gone: 0 } : {}),
    ...(i === 8 ? { away: [{ from: 0, until: 400 * 365 * 86_400, land: "the war" }] } : {}),
  })) as VillagePlan["people"],
};

test("laid in place, the field is flat: no ridge, no river; on its own close field it keeps them", () => {
  const placed = newBattle(field, 240, true),
    close = newBattle(field, 240);
  assert.equal(placed.placed, true);
  assert.ok(!placed.ground.hill && !placed.ground.river);
  assert.ok(close.ground.hill && close.ground.river);
  assert.ok(!("placed" in close));
  // (The same men in the same files: only the ground and the flight differ.)
  assert.deepEqual(
    placed.troopers.map((t) => [t.side, t.file, t.rank, t.falls]),
    close.troopers.map((t) => [t.side, t.file, t.rank, t.falls]),
  );
});

test("the beaten fly to the field's flanks and out of sight, never into the town behind them", () => {
  const f = newBattle(field, 240, true),
    fled = f.troopers.filter((t) => t.side === 1 && t.falls === null && t.flees !== null);
  assert.ok(fled.length > 10, `${fled.length} fled`);
  const at = (s: number) => {
    const now = battleAt(f, s);
    return fled.map((t) => now.troopers[t.id]!);
  };
  let wider = 0;
  const rout = at(MOMENTS.rout + 4),
    later = at(MOMENTS.after);
  rout.forEach((t, i) => {
    if (Math.abs(later[i]!.z) > Math.abs(t.z) + 1) wider++;
  });
  assert.ok(wider > fled.length * 0.6, `${wider} of ${fled.length} out toward a flank`);
  for (const t of [...rout, ...later]) assert.ok(t.x < FIELD.x * 0.35 + 14, `fled to x ${t.x}`);
  // (Gone from the field by its end.)
  for (const t of at(BATTLE_LENGTH)) assert.ok(t.size < 0.05, `still drawn at ${t.size}`);
  // The pursuers stop short of the town: none past where its defenders stood drawn up.
  const rear = Math.max(...f.troopers.filter((t) => t.side === 1).map((t) => placeAt(f, t, 0).x)),
    end = battleAt(f, BATTLE_LENGTH);
  for (const t of end.troopers)
    if (t.side === 0 && t.size > 0.05) assert.ok(t.x <= rear + 2, `a pursuer at ${t.x}`);
});

test("at a seat, the beaten behind its walls go from sight past them, its walls the field's outworks", () => {
  const f = newBattle(walled, 240, true),
    w = f.ground.wall!;
  assert.ok(w);
  const end = battleAt(f, BATTLE_LENGTH);
  for (const t of end.troopers)
    if (t.side === 1 && f.troopers[t.id]!.falls === null && t.x > w.x + 8)
      assert.ok(t.size < 0.05, `drawn behind the walls at ${t.x}`);
});

test("laid before the town clear of its edge along its road, the field's +x toward the town", () => {
  const f = newBattle(field, 240, true),
    frame = fieldFrame(town, f),
    edge = villageGround(town).homesReach,
    road = Math.hypot(town.road.x, town.road.z),
    along = (p: { x: number; z: number }) => (p.x * town.road.x + p.z * town.road.z) / road;
  // Its defenders' rear as they stand drawn up: a little short of the town's edge.
  const rear = Math.max(...f.troopers.filter((t) => t.side === 1).map((t) => placeAt(f, t, 0).x)),
    back = placedPoint(frame, rear, 0);
  assert.ok(Math.abs(along(back) - (edge + 12)) < 0.5, `${along(back)} vs ${edge + 12}`);
  // The attackers come from out along the road: their side further from the town.
  assert.ok(along(placedPoint(frame, -FIELD.x, 0)) > along(placedPoint(frame, FIELD.x, 0)));
  // Twice the close field's size: as large as the town's folk are drawn.
  const a = placedPoint(frame, 10, -20),
    b = placedPoint(frame, 30, 25);
  assert.ok(Math.abs(Math.hypot(a.x - b.x, a.z - b.z) - 2 * Math.hypot(20, 45)) < 1e-9);
  // And back again.
  const p = fieldPoint(frame, a.x, a.z);
  assert.ok(Math.abs(p.x - 10) < 1e-9 && Math.abs(p.z + 20) < 1e-9);
  // Turned as an entity is: (x, z) to (x cos θ + z sin θ, −x sin θ + z cos θ).
  const th = frameYaw(frame),
    c = { x: 13 * Math.cos(th) + -7 * Math.sin(th), z: -13 * Math.sin(th) + -7 * Math.cos(th) },
    q = placedPoint(frame, 13, -7);
  assert.ok(Math.abs(frame.x + 2 * c.x - q.x) < 1e-9 && Math.abs(frame.z + 2 * c.z - q.z) < 1e-9);
});

/** A roll as its lots stand for a battle drawn at `most`: as many named in each as battleFigures has. */
function rollFor(b: BattleNear, most: number): BattleRoll {
  const figs = battleFigures(b, most),
    man = (side: number, lot: string, i: number, maimed = false): RollEntry => ({
      ref: `lv:${b.event}:${side}:${lot}${i}`,
      name: `${lot} ${i}`,
      place: 0,
      age: 30,
      kept: false,
      ...(maimed ? { maimed: true as const } : {}),
    }),
    sideOf = (s: 0 | 1) => {
      const f = figs.sides[s];
      return {
        realm: s === 0 ? b.attacker.ref : b.defender.ref,
        figures: f,
        fell: Array.from({ length: f.falls }, (_, i) => man(s, "fell", i)),
        hurt: Array.from({ length: f.hurt }, (_, i) => man(s, "hurt", i, i % 3 === 0)),
        stood: Array.from({ length: f.stood }, (_, i) => man(s, "stood", i)),
        towns: [],
      };
    };
  return {
    event: b.event,
    war: b.war,
    year: b.year,
    per: figs.per,
    most,
    attacker: sideOf(0),
    defender: sideOf(1),
  };
}

test("every figure a man of the roll: its fallen the roll's fallen, its struck who lived its wounded, the rest the rest", () => {
  for (const b of [field, walled])
    for (const most of PLACED_MOST) {
      const f = newBattle(b, most, true),
        blows = newBlows(f),
        roll = rollFor(b, most),
        names = rollNames(f, blows, roll),
        seen = new Set<string>();
      for (const t of f.troopers) {
        const e = names[t.id];
        assert.ok(e, `figure ${t.id} unnamed (most ${most})`);
        assert.ok(!seen.has(e.ref), `${e.ref} twice`);
        seen.add(e.ref);
        const fate = figureFate(f, blows, t.id),
          lot = e.ref.split(":").at(-1)!.replace(/\d+$/, "");
        assert.equal(lot, fate === "fell" ? "fell" : fate === "stood" ? "stood" : "hurt");
      }
      assert.equal(seen.size, f.troopers.length);
    }
  assert.equal(placedMost(0), PLACED_MOST[0]);
  assert.equal(placedMost(9), PLACED_MOST[3]);
});

test("those come out to watch: grown, at home, nearest the field first, at the town's edge facing it", () => {
  const f = newBattle(field, 240, true),
    frame = fieldFrame(town, f),
    t = 365 * 365 * 86_400 + 9 * 3600,
    w = fieldWatchers(town, frame, t),
    edge = villageGround(town).homesReach;
  assert.ok(w.length > 0 && w.length <= WATCHERS);
  for (const x of w) {
    const p = town.people[x.index]!;
    assert.ok(!p.child && !p.healer && p.gone === undefined && !p.away, p.name);
    const out = (x.x * -frame.ux + x.z * -frame.uz) / Math.hypot(frame.ux, frame.uz);
    assert.ok(out >= edge + 2.9 && out <= edge + 5, `${out} out`);
    // (Facing out along the road, toward the field.)
    assert.ok(Math.abs(Math.sin(x.yaw) * frame.ux + Math.cos(x.yaw) * frame.uz + 1) < 1e-9);
  }
  // Indoors from an hour before it to half an hour after.
  const s = battleShelter(365);
  assert.equal(s.from, 365 * 365 * 86_400 + 7 * 3600);
  assert.equal(s.to, 365 * 365 * 86_400 + 8 * 3600 + BATTLE_LENGTH * 60 + 1800);
});

test("the hosts' fires the night before lie behind their lines; the fallen lie, then are borne in", () => {
  const f = newBattle(field, 240, true),
    frame = fieldFrame(town, f),
    fires = placedCamp(frame, f);
  assert.ok(fires.length >= 4 && fires.length <= 16);
  for (const p of fires) {
    const q = fieldPoint(frame, p.x, p.z),
      sideAt = q.x < f.meet ? 0 : 1,
      rank = f.troopers
        .filter((t) => t.side === sideAt)
        .map((t) => placeAt(f, t, 0).x)
        .reduce((a, x) => (sideAt === 0 ? Math.min(a, x) : Math.max(a, x)));
    assert.ok(sideAt === 0 ? q.x < rank : q.x > rank, `a fire at ${q.x}, rank ${rank}`);
  }
  const blows = newBlows(f),
    end = battleAt(f, BATTLE_LENGTH),
    lying = fallenNow(f, end),
    fell = f.troopers.filter((t) => t.falls !== null).length;
  assert.equal(lying.troopers.filter((t) => t.size > 0.01).length, fell);
  assert.equal(lying.flying.length + lying.spray.length + lying.dust.length, 0);
  assert.equal(borneNow(f, lying, 0), lying);
  const half = borneNow(f, lying, 0.5).troopers.filter((t) => t.size > 0.01).length;
  assert.ok(half > fell * 0.3 && half < fell * 0.7, `${half} of ${fell} still lying`);
  assert.equal(borneNow(f, lying, 1).troopers.filter((t) => t.size > 0.01).length, 0);
  assert.ok(blows.dead[0] + blows.dead[1] === fell);
});
