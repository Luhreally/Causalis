import { test } from "node:test";
import assert from "node:assert/strict";
import type { VillagePlan, WarsMap } from "../../src/bridge/index.ts";
import { sphereGrid } from "../../src/kernel/index.ts";
import {
  BATTLE_ROUND,
  MARCH,
  battleOf,
  clearOf,
  landWars,
  villageGround,
  voyageMarks,
  warPaths,
  warTokens,
} from "../../src/view/index.ts";
import { OCC } from "../../src/rules/index.ts";

const grid = sphereGrid(16);

/** A world half land (the northern half) and half sea. */
const elevation = Float32Array.from({ length: grid.count }, (_, c) =>
  grid.positions[c * 3 + 1]! > 0 ? 400 : -2000,
);
const cellNear = (x: number, y: number, z: number) => {
  let best = 0,
    bestDot = -Infinity;
  for (let c = 0; c < grid.count; c++) {
    const d =
      grid.positions[c * 3]! * x + grid.positions[c * 3 + 1]! * y + grid.positions[c * 3 + 2]! * z;
    if (d > bestDot) {
      bestDot = d;
      best = c;
    }
  }
  return best;
};

const red = [0.8, 0.2, 0.2] as const,
  blue = [0.2, 0.3, 0.8] as const;
const map = (from: number, to: number, ended: number | null = null): WarsMap => ({
  year: 300,
  wars: [
    {
      ref: "war:0:1",
      attacker: { ref: "pol:0:1", name: "the Reds", color: red },
      defender: { ref: "pol:0:2", name: "the Blues", color: blue },
      from,
      to,
      declared: 298,
      ended,
      battles: [
        { spot: to, year: 300, won: true, fallen: 4000, event: "evt:0:1" },
        { spot: from, year: 299, won: false, fallen: 12, event: "evt:0:2" },
      ],
    },
  ],
});

test("a war's host marches its way over the ground, and takes ship where the way crosses the sea", () => {
  // From the north over the south's sea and back up to land on the far side.
  const from = cellNear(0.7, 0.7, 0),
    to = cellNear(-0.7, 0.7, 0.05),
    overland = warPaths(map(from, to), grid, elevation),
    path = overland.paths[0]!;
  assert.equal(overland.colors.length, 2);
  assert.ok(path.points.every((p) => Math.hypot(p.x, p.y, p.z) >= 1));
  // Over the pole the way stays north, on land; a way through the south crosses sea.
  assert.ok(
    path.sea.every((s) => !s),
    "over land all the way",
  );
  const south = warPaths(map(cellNear(0.9, 0.05, 0.4), cellNear(-0.9, 0.05, -0.4)), grid, elevation)
    .paths[0]!;
  assert.ok(south.sea.some((s) => s) || south.sea.every((s) => !s));
  const across = warPaths(map(cellNear(0.6, 0.3, 0.7), cellNear(0.3, -0.9, 0.2)), grid, elevation);
  const ships = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].flatMap((k) =>
    warTokens(across, (k * MARCH) / 10).filter((t) => t.ship),
  );
  assert.ok(ships.length > 0, "ships on the sea part of the way");
  // The column: a banner-bearer and those behind, and the defenders at what they hold.
  const now = warTokens(overland, MARCH * 0.5);
  assert.ok(now.filter((t) => t.side === path.side).length >= 2);
  const held = now.filter((t) => t.side === path.foe);
  assert.equal(held.length, 2);
  const end = path.points.at(-1)!;
  assert.ok(Math.hypot(held[0]!.at.x - end.x, held[0]!.at.y - end.y, held[0]!.at.z - end.z) < 1e-9);
  // Each token stands on the globe, its up outward.
  for (const t of now) {
    const r = Math.hypot(t.at.x, t.at.y, t.at.z);
    assert.ok(Math.abs(t.up.x * t.at.x + t.up.y * t.at.y + t.up.z * t.at.z - r) < 1e-9);
  }
  // A war ended stands down: no host marches; its battles still show a while.
  const over = warPaths(map(from, to, 300), grid, elevation);
  assert.equal(warTokens(over, 3).length, 0);
  assert.equal(over.bursts.length, 2);
});

test("where a battle was fought, a burst: the larger the more fell, and dimmer as the years pass", () => {
  const w = warPaths(map(cellNear(0.7, 0.7, 0), cellNear(0, 0.9, 0.4)), grid, elevation);
  const [great, small] = w.bursts;
  assert.ok(great!.size > small!.size, "four thousand fallen, against twelve");
  assert.equal(great!.age, 0);
  assert.equal(small!.age, 1);
});

const village: VillagePlan = {
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
  road: { x: 0, z: 1100 },
  people: [
    { ref: "prsn:0:1", name: "A B", home: 0, age: 30, occupation: OCC.farmer, child: false },
  ],
  life: {
    fed: 1,
    growing: false,
    war: true,
    unrest: 0,
    faith: null,
    talk: ["war", "weather", "food", "gossip"],
    site: null,
    mourning: [],
    newborn: [],
    battle: {
      attacker: { name: "the Reds", color: red },
      defender: { name: "the Blues", color: blue },
      won: true,
      fallen: 400,
      year: 300,
      event: "evt:0:9",
    },
  },
};

test("a battle in a village's land: the hosts close from the road and the homes, fight at the line, fall, and the beaten fall back", () => {
  const each = 10,
    at = (k: number) => battleOf(village, each, k * BATTLE_ROUND);
  assert.equal(at(0.1).length, 2 * each);
  // Closing: each side nearer the other than it began.
  const gap = (k: number) => {
    const t = at(k),
      mean = (side: number) => {
        const s = t.filter((q) => q.side === side);
        return {
          x: s.reduce((a, q) => a + q.x, 0) / s.length,
          z: s.reduce((a, q) => a + q.z, 0) / s.length,
        };
      },
      a = mean(0),
      b = mean(1);
    return Math.hypot(a.x - b.x, a.z - b.z);
  };
  assert.ok(
    gap(0.02) > 40 && gap(0.5) < 12,
    `${gap(0.02).toFixed(0)} m, then ${gap(0.5).toFixed(0)} m`,
  );
  // Facing each other at the line.
  for (const q of at(0.5).filter((q) => q.doing === "fight")) {
    const ahead = { x: Math.sin(q.yaw), z: Math.cos(q.yaw) },
      road = { x: village.road.x, z: village.road.z },
      toward = (q.side === 0 ? -1 : 1) * (ahead.x * road.x + ahead.z * road.z);
    assert.ok(toward > 0, "facing the foe");
  }
  // As many fall as the battle's toll says (four hundred fallen: half of those who fought, at most).
  const fallen = at(0.8).filter((q) => q.doing === "fallen").length;
  assert.ok(fallen >= 2 && fallen <= each, `${fallen} fallen`);
  // The attackers won: the defenders fall back at the round's end, the attackers hold.
  const late = at(0.9);
  assert.ok(late.some((q) => q.side === 1 && q.doing === "fall back"));
  assert.ok(late.every((q) => (q.side === 0 ? q.doing !== "fall back" : true)));
  // Never in a home.
  const ground = villageGround(village);
  for (let k = 0; k < 1; k += 0.05)
    for (const q of at(k)) for (const h of ground.homes) assert.ok(clearOf(h, q) >= 1.2 - 1e-6);
  // A village whose land saw no battle has none.
  assert.equal(
    battleOf({ ...village, life: { ...village.life!, battle: null } }, each, 3).length,
    0,
  );
});

test("a fleet of war crosses between the stars, and its star is ringed in fire when the battle is fought", () => {
  const plan = {
      radius: 20,
      stars: [
        {
          ref: "star:0:1",
          x: 10,
          y: 0,
          z: 0,
          distance: 10,
          spectral: "G",
          mass: 1,
          luminosity: 1,
          temperature: 5800,
          ageGyr: 4,
          remnant: false,
          planets: 5,
          seas: 1,
        },
      ],
    } as unknown as Parameters<typeof voyageMarks>[0],
    sky = {
      programs: [],
      colonies: [],
      fleets: [
        {
          realm: "the Reds",
          enemy: "the Far Ones",
          star: "star:0:1",
          sailed: 1000,
          arrives: 1100,
          won: null,
          event: "evt:0:3",
        },
      ],
    } as unknown as Parameters<typeof voyageMarks>[1];
  const half = voyageMarks(plan, sky, 1050);
  assert.equal(half.fleets.length, 3, "three ships to a fleet");
  const lead = half.fleets[0]!,
    star = voyageMarks(plan, sky, 1099).fleets[0]!;
  assert.ok(Math.hypot(lead.x, lead.z) < Math.hypot(star.x, star.z), "on its way out");
  assert.equal(half.battles.length, 0);
  const after = voyageMarks(
    plan,
    { ...sky, fleets: [{ ...sky.fleets![0]!, won: true }] } as typeof sky,
    1110,
  );
  assert.equal(after.fleets.length, 0);
  assert.equal(after.battles.length, 1);
});

test("a land's map shows the wars the globe shows: hosts coming in for what they want, going out to the front, and its battles", () => {
  // A land at the equator facing +z: its middle spot, and a strip of another spot to its east.
  const mid = cellNear(0, 0, 1),
    east = cellNear(0.2, 0, 0.98),
    size = 8,
    parent = Int32Array.from({ length: size * size }, (_, t) => (t % size >= 6 ? east : mid)),
    west = cellNear(-0.9, 0, 0.44),
    far = cellNear(0.9, 0, 0.44);
  assert.notEqual(mid, east);
  const wars: WarsMap = {
    year: 300,
    wars: [
      // Its host comes from far in the west for the eastern strip; fought there this year.
      {
        ...map(west, east).wars[0]!,
        battles: [
          { spot: east, year: 300, won: true, fallen: 4000, event: "evt:0:1" },
          { spot: west, year: 300, won: false, fallen: 50, event: "evt:0:2" },
          { spot: mid, year: 297, won: true, fallen: 900, event: "evt:0:3" },
        ],
      },
      // Another sets out from the land's middle for the far east.
      { ...map(mid, far).wars[0]!, ref: "war:0:2", battles: [] },
      // A war ended long ago shows nothing.
      { ...map(west, mid, 250).wars[0]!, ref: "war:0:3", battles: [] },
    ],
  };
  const land = landWars(wars, parent, size, 1, grid),
    half = (size - 1) / 2;
  assert.equal(land.marches.length, 2, "the two wars still fought cross it");
  const coming = land.marches.find((m) => m.ref === "war:0:1")!,
    going = land.marches.find((m) => m.ref === "war:0:2")!;
  assert.ok(coming.held, "defenders hold what the host comes for");
  assert.ok(coming.to.x > 2, `it comes for the eastern strip (${coming.to.x.toFixed(1)})`);
  assert.ok(coming.from.x < -half * 0.8, `in from the western edge (${coming.from.x.toFixed(1)})`);
  assert.ok(!going.held);
  assert.ok(going.to.x > half * 0.8, `out to the eastern edge (${going.to.x.toFixed(1)})`);
  // Its battles: only the one fought in it lately, the larger the more fell.
  assert.equal(land.battles.length, 1);
  assert.equal(land.battles[0]!.event, "evt:0:1");
  assert.ok(land.battles[0]!.size > 0.8 && land.battles[0]!.won);
  assert.ok(land.battles[0]!.at.x > 2);
});
