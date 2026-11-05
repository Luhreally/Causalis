// Tests for the fleet fight script (Phase 67, task 1): counts, classes, losses and breaks, the shots,
// where the ships are, the eye, the frame, the words and the star-war line. The script is pure, so
// every check is exact.
import { test } from "node:test";
import assert from "node:assert/strict";
import type {
  FightSide,
  StarFightEntry,
  StarFightList,
  StarFightPlan,
  StarLanding,
} from "../../src/bridge/index.ts";
import {
  classesOf,
  fleetAt,
  fleetFrame,
  fleetScript,
  fleetTally,
  fleetWords,
  poseMatrix,
  shipPixels,
  shipsInView,
  shipsOf,
  starFightTake,
  toWorld,
  type V3,
} from "../../src/view/fleet.ts";

const ATTACKER: FightSide = {
  ref: "civ:4",
  kind: "people",
  name: "the Kregraanok",
  words: "trunked giants",
  color: [180, 90, 40],
  strength: 5.2,
  machines: null,
  gravity: 1.1,
  medium: "land",
  clade: "trunked",
  drive: "none",
  arm: "beam",
  beamArm: "beam-rifle",
  minds: false,
  sky: "fleet",
};

const DEFENDER: FightSide = {
  ref: "pol:2",
  kind: "realm",
  name: "Shisten",
  words: "the commonwealth of Shisten",
  color: [60, 120, 200],
  strength: 5,
  machines: null,
  gravity: 1,
  medium: "land",
  clade: null,
  drive: "none",
  arm: "missile",
  beamArm: null,
  minds: false,
  sky: "fleet",
};

// The fixture: a raid the attackers won, both skies full, no landing.
function plan(
  over: {
    attacker?: Partial<FightSide>;
    defender?: Partial<FightSide>;
    won?: boolean;
    landing?: StarLanding | null;
  } = {},
): StarFightPlan {
  return {
    id: "ev:0:364215",
    road: "raid",
    year: 1757,
    sailed: 1666,
    attacker: { ...ATTACKER, ...over.attacker },
    defender: { ...DEFENDER, ...over.defender },
    won: over.won ?? true,
    place: { kind: "home", cell: 1, spot: 1, words: "over Shisten" },
    event: "ev:0:364215",
    war: null,
    claim: "A fleet fell on them, year 1757",
    why: "They sailed, year 1666",
    landing: over.landing ?? null,
    nowYear: 1757,
  };
}

function entry(id: string, year: number, ships: boolean): StarFightEntry {
  return {
    id,
    road: "raid",
    year,
    attacker: `X${id}`,
    defender: `Y${id}`,
    attackerColor: [1, 2, 3],
    defenderColor: [4, 5, 6],
    won: true,
    strength: 5,
    defence: 5,
    dead: 0,
    town: null,
    ships,
    claim: `claim ${id}`,
    page: `ev:${id}`,
  };
}

const dot3 = (a: V3, b: V3) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross3 = (a: V3, b: V3): V3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const near = (a: number, b: number, tol = 1e-6) =>
  assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test("ship counts follow the strength, from 6 to 30", () => {
  assert.equal(shipsOf(0.1), 6);
  assert.equal(shipsOf(1), 8);
  assert.equal(shipsOf(2.5), 12);
  assert.equal(shipsOf(5), 18);
  assert.equal(shipsOf(5.2), 19);
  assert.equal(shipsOf(10), 29);
  assert.equal(shipsOf(20), 30);
});

test("classes split a side into capitals, line ships and escorts", () => {
  assert.deepEqual(classesOf(19, false), [2, 7, 10]);
  assert.deepEqual(classesOf(18, false), [2, 6, 10]);
  assert.deepEqual(classesOf(30, false), [3, 11, 16]);
  assert.deepEqual(classesOf(8, false), [1, 3, 4]);
  assert.deepEqual(classesOf(4, true), [0, 4, 0]);
});

test("the fixture fight: counts, losses, the winner and the end", () => {
  const s = fleetScript(plan());
  assert.deepEqual(s.counts, [19, 18]);
  assert.deepEqual(s.lost, [8, 14]);
  assert.equal(s.winner, 0);
  assert.equal(s.end, 48);
});

test("a lost raid: the defender wins and the losses swap sides", () => {
  const s = fleetScript(
    plan({ won: false, attacker: { strength: 5 }, defender: { strength: 20 } }),
  );
  assert.deepEqual(s.counts, [18, 30]);
  assert.deepEqual(s.lost, [16, 8]);
  assert.equal(s.winner, 1);
});

test("at the end the winner keeps its unbroken ships and the loser's survivors are gone", () => {
  const now = fleetAt(fleetScript(plan()), 48);
  assert.deepEqual(now.left, [11, 0]);
  assert.equal(now.wrecks.length, 44);
  assert.equal(now.stage, "after");
});

test("the same time gives the same numbers, whatever was asked before", () => {
  const p = plan();
  const once = JSON.stringify(fleetAt(fleetScript(p), 20));
  assert.equal(JSON.stringify(fleetAt(fleetScript(p), 20)), once);
  const s = fleetScript(p);
  assert.equal(JSON.stringify(fleetAt(s, 20)), once);
  fleetAt(s, 5);
  assert.equal(JSON.stringify(fleetAt(s, 20)), once);
});

test("with no defending sky the fight is empty: no shots, and it ends at 14 s", () => {
  const s = fleetScript(plan({ defender: { sky: "none" } }));
  assert.deepEqual(s.counts, [19, 0]);
  assert.equal(s.shots.length, 0);
  assert.equal(s.end, 14);
  assert.equal(s.empty, true);
  assert.equal(fleetAt(s, 8).stage, "after");
  assert.equal(fleetAt(s, 14).left[0], 19);
});

test("platforms: a few in a row, all in the line class, placed where they start", () => {
  const s = fleetScript(plan({ defender: { sky: "platforms", strength: 1.7 } }));
  assert.equal(s.counts[1], 4);
  const platforms = s.ships.filter((x) => x.side === 1);
  assert.equal(platforms.length, 4);
  for (const x of platforms) {
    assert.equal(x.cls, 1);
    assert.equal(x.platform, true);
    assert.deepEqual(x.from, x.slot);
  }
});

test("beams come only from the attacker's side, missiles only from the defender's", () => {
  const s = fleetScript(plan());
  let beams = 0;
  let missiles = 0;
  for (let i = 0; i <= 100; i++) {
    const now = fleetAt(s, 8 + i * 0.25);
    for (const b of now.beams) {
      assert.equal(b.side, 0);
      beams++;
    }
    for (const m of now.missiles) {
      assert.equal(m.side, 1);
      missiles++;
    }
  }
  assert.ok(beams > 0 && missiles > 0);
});

test("every break comes in the fight, and each broken ship took its hits first", () => {
  const s = fleetScript(plan());
  let broken = 0;
  for (const ship of s.ships) {
    if (ship.breakAt === null) continue;
    broken++;
    assert.ok(ship.breakAt >= s.arrive + 2 && ship.breakAt < s.fightEnd);
    assert.ok(ship.hits.length >= 2);
    assert.deepEqual(
      [...ship.hits],
      [...ship.hits].sort((a, b) => a - b),
    );
    for (const h of ship.hits) assert.ok(h < ship.breakAt);
  }
  assert.equal(broken, 22);
});

test("most ships are in the frame at the wide shot and in the late shot", () => {
  const s = fleetScript(plan());
  assert.ok(shipsInView(s, 12) >= 0.8);
  assert.ok(shipsInView(s, 44) >= 0.6);
});

test("a line ship is readable at the wide shot, a capital is large", () => {
  assert.ok(shipPixels(0.035, 1.05) >= 30);
  assert.ok(shipPixels(0.1, 1.05) >= 90);
});

test("the pose is orthonormal and right-handed, and its translation is the world point", () => {
  const frame = fleetFrame({ x: 0.3, y: 0.8, z: 0.5 });
  const m = new Float32Array(16);
  const p: V3 = { x: 0.02, y: 0.03, z: -0.01 };
  poseMatrix(m, 0, frame, p, { x: 0.2, y: -0.9, z: 0.1 }, 0.7, 1, 1, 1);
  const at = (i: number) => m[i] ?? 0;
  const c0: V3 = { x: at(0), y: at(1), z: at(2) };
  const c1: V3 = { x: at(4), y: at(5), z: at(6) };
  const c2: V3 = { x: at(8), y: at(9), z: at(10) };
  for (const c of [c0, c1, c2]) near(Math.sqrt(dot3(c, c)), 1);
  near(dot3(c0, c1), 0);
  near(dot3(c0, c2), 0);
  near(dot3(c1, c2), 0);
  const k = cross3(c0, c1);
  near(k.x, c2.x);
  near(k.y, c2.y);
  near(k.z, c2.z);
  const w = toWorld(frame, p);
  near(at(12), w.x);
  near(at(13), w.y);
  near(at(14), w.z);
});

test("a raid that came down brings four landers, seen on their way down", () => {
  const s = fleetScript(plan({ landing: {} as StarLanding }));
  assert.equal(s.landers, 4);
  assert.ok(fleetAt(s, 38).ships.some((x) => x.lander));
});

test("the words say what is on screen, in the record's own sentences", () => {
  const p = plan();
  const s = fleetScript(p);
  assert.ok(fleetWords(p, s, 1).includes("They sailed"));
  const w5 = fleetWords(p, s, 5);
  for (const part of ["Kregraanok", "5.2", "5.0"]) assert.ok(w5.includes(part), w5);
  const w20 = fleetWords(p, s, 20);
  assert.ok(w20.includes("beams") && w20.includes("missiles"), w20);
  const w47 = fleetWords(p, s, 47);
  assert.ok(w47.includes("year 1757") && w47.includes("nothing on the ground"), w47);
  assert.ok(fleetTally(p, s).includes("19 and 18 ships drawn"));
  const rich = plan({ attacker: { machines: 4000000 } });
  assert.ok(fleetTally(rich, fleetScript(rich)).includes("4,000,000"));
});

test("a star war is told once, and the next one after five rounds", () => {
  const list: StarFightList = {
    fights: [entry("a", 100, true), entry("b", 102, true)],
    total: 2,
    open: 0,
    best: "a",
    first: "a",
    firstYear: 100,
  };
  const d = { told: new Set<string>(), round: 0 };
  assert.equal(starFightTake(d, list, 103)?.id, "a");
  assert.equal(starFightTake(d, list, 103), null);
  d.round = 5;
  assert.equal(starFightTake(d, list, 103)?.id, "b");
  assert.equal(starFightTake(d, list, 200), null);
});
