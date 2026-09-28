import { test } from "node:test";
import assert from "node:assert/strict";
import type { VillagePlan, WarsMap } from "../../src/bridge/index.ts";
import { sphereGrid } from "../../src/kernel/index.ts";
import {
  BATTLE_ROUND,
  MARCH,
  battleFigures,
  battleOf,
  clearOf,
  counterWords,
  holdShape,
  hostShape,
  landBattle,
  landColumn,
  landShape,
  landWars,
  rides,
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
  garrisons: [],
  wars: [
    {
      ref: "war:0:1",
      attacker: {
        ref: "pol:0:1",
        name: "the Reds",
        color: red,
        fields: 1200,
        arms: null,
        host: { arm: "spear", guard: "shield", mount: "foot" },
      },
      defender: {
        ref: "pol:0:2",
        name: "the Blues",
        color: blue,
        fields: 800,
        arms: null,
        host: { arm: "bow", guard: "leather", mount: "horse" },
      },
      from,
      to,
      declared: 298,
      ended,
      siege: null,
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
          realmRef: "pol:0:1",
          enemyRef: "civ:0:2",
          strength: 7.3,
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
  // Its counter stands at its lead ship: its realm, its enemy, its strength (M101).
  assert.deepEqual(half.heads, [{ ...lead, realm: "pol:0:1", enemy: "civ:0:2", strength: 7.3 }]);
  assert.equal(half.battles.length, 0);
  const after = voyageMarks(
    plan,
    { ...sky, fleets: [{ ...sky.fleets![0]!, won: true }] } as typeof sky,
    1110,
  );
  assert.equal(after.fleets.length, 0);
  assert.equal(after.heads.length, 0, "no counter once it has come");
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
    garrisons: [],
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

test("a host crossing the sea in a land goes in ships, as the globe shows it; on the ground, on foot", () => {
  // West of the land's middle is ground, east of it sea; the host marches east, far along.
  const from = { x: -10, z: 0 },
    to = { x: 10, z: 0 },
    sea = (x: number) => x > 0,
    col = landColumn(from, to, 0.9, sea);
  assert.ok(col.afloat, "its head is out on the sea");
  assert.ok(col.ships.length >= 1 && col.ships.length <= 3, `a few ships (${col.ships.length})`);
  assert.ok(
    col.ships.every((f) => f.x > 0),
    "every ship on the sea",
  );
  assert.ok(
    col.people.every((f) => f.x <= 0.5),
    "every one on foot on the ground",
  );
  assert.ok(col.ships[0]!.lead, "the head's ship leads");
  assert.ok(Math.abs(col.yaw - Math.PI / 2) < 1e-9, "all face the way it goes");
  // All on the ground: no ships, the whole column on foot, its head on the ground.
  const dry = landColumn(from, to, 0.5, () => false);
  assert.equal(dry.ships.length, 0);
  assert.equal(dry.people.length, 12);
  assert.ok(!dry.afloat && dry.head !== null);
  // All at sea: one ship for every four of the column, none on foot.
  const wet = landColumn(from, to, 0.5, () => true);
  assert.equal(wet.people.length, 0);
  assert.equal(wet.ships.length, 3);
});

test("a host's counter: its side, its realm and the men it fields, said short", () => {
  assert.equal(counterWords(850), "850");
  assert.equal(counterWords(3400), "3.4k");
  assert.equal(counterWords(9949), "9.9k");
  assert.equal(counterWords(9950), "10k");
  assert.equal(counterWords(12_345), "12k");
  assert.equal(counterWords(-3), "0");
  // On the globe: the marchers are the attacker's, the standard at what they want the defender's.
  const from = cellNear(0.2, 0.9, 0.4),
    to = cellNear(-0.2, 0.9, 0.4),
    tokens = warTokens(warPaths(map(from, to), grid, elevation), 3);
  const heads = tokens.filter((t) => t.lead);
  assert.equal(heads.filter((t) => t.attacker).length, 1, "one head of the attacker's host");
  assert.equal(heads.filter((t) => !t.attacker).length, 1, "one standard of the defenders");
  // In a land: each march bears both its sides, their realms and the men each fields.
  const size = 8,
    mid = cellNear(0, 0, 1),
    parent = new Int32Array(size * size).fill(mid),
    land = landWars(map(cellNear(-0.9, 0, 0.44), mid), parent, size, 1, grid);
  assert.equal(land.marches.length, 1);
  assert.deepEqual(land.marches[0]!.attacker, { ref: "pol:0:1", fields: 1200 });
  assert.deepEqual(land.marches[0]!.defender, { ref: "pol:0:2", fields: 800 });
});

test("a host is as large as the men it fields: more ranks, more files abreast, a banner every third rank", () => {
  const shapes = [300, 2000, 9000, 60000, 400000].map(hostShape);
  for (let i = 1; i < shapes.length; i++)
    assert.ok(
      shapes[i]!.ranks * shapes[i]!.files > shapes[i - 1]!.ranks * shapes[i - 1]!.files,
      `larger with more men (${JSON.stringify(shapes)})`,
    );
  assert.deepEqual(hostShape(300), { ranks: 3, files: 1 });
  assert.ok(holdShape(100000).ranks > holdShape(500).ranks);
  const from = cellNear(0.7, 0.7, 0),
    to = cellNear(-0.7, 0.7, 0.05),
    sized = (fields: number) => {
      const m = map(from, to),
        w = m.wars[0]!;
      return warTokens(
        warPaths({ ...m, wars: [{ ...w, attacker: { ...w.attacker, fields } }] }, grid, elevation),
        MARCH * 0.8,
      ).filter((t) => t.attacker);
    };
  const band = sized(400),
    host = sized(80000);
  assert.ok(host.length > band.length * 3, `${host.length} marching against ${band.length}`);
  assert.equal(host.filter((t) => t.lead).length, 1, "one head");
  assert.ok(host.filter((t) => t.banner).length >= 2, "banners along the column");
  // Riders where its design rides; the Reds go on foot, the Blues ride.
  assert.ok(rides({ arm: "bow", guard: "leather", mount: "horse" }));
  assert.ok(!rides({ arm: "spear", guard: "shield", mount: "foot" }) && !rides(null));
  const tokens = warTokens(warPaths(map(from, to), grid, elevation), MARCH * 0.5);
  assert.ok(tokens.filter((t) => t.attacker).every((t) => !t.mounted));
  assert.ok(tokens.filter((t) => !t.attacker).every((t) => t.mounted));
});

test("a battle is two masses meeting in their colours, the fallen between them; a seat besieged is ringed by a camp", () => {
  const from = cellNear(0.7, 0.7, 0),
    to = cellNear(-0.7, 0.7, 0.05),
    paths = warPaths(map(from, to), grid, elevation),
    now = battleFigures(paths, 2);
  // This year's battle (4000 fell) and last year's (12): the older smaller, both shown.
  const fresh = now.filter((f) => f.event === "evt:0:1"),
    old = now.filter((f) => f.event === "evt:0:2");
  assert.ok(fresh.length > 0 && old.length > 0);
  const standing = fresh.filter((f) => !f.fallen),
    sides = new Set(standing.map((f) => f.side));
  assert.equal(sides.size, 2, "two masses");
  const fallen = fresh.filter((f) => f.fallen).length;
  assert.ok(fallen > old.filter((f) => f.fallen).length, "the more fell, the more lie");
  assert.ok(
    old.every((f) => f.size < 1),
    "last year's the smaller",
  );
  // Each faces the other mass.
  const middle = (side: number) => {
    const list = standing.filter((f) => f.side === side),
      sum = list.reduce((s, f) => ({ x: s.x + f.at.x, y: s.y + f.at.y, z: s.z + f.at.z }), {
        x: 0,
        y: 0,
        z: 0,
      });
    return { x: sum.x / list.length, y: sum.y / list.length, z: sum.z / list.length };
  };
  for (const f of standing) {
    const other = middle([...sides].find((s) => s !== f.side)!),
      d = { x: other.x - f.at.x, y: other.y - f.at.y, z: other.z - f.at.z };
    assert.ok(f.ahead.x * d.x + f.ahead.y * d.y + f.ahead.z * d.z > 0, "facing the foe");
  }
  // Two years on, no battle is fought there: none stand.
  assert.equal(
    battleFigures({ ...paths, bursts: paths.bursts.map((b) => ({ ...b, age: 2 })) }, 2).length,
    0,
  );
  // A seat under siege: the besiegers' camp; a realm at peace: its garrison at its seat.
  const m = map(from, to),
    besieged = warPaths(
      {
        ...m,
        garrisons: [
          {
            realm: "pol:0:9",
            name: "the Greens",
            color: [0.2, 0.8, 0.3],
            spot: from,
            fields: 5000,
            host: null,
          },
        ],
        wars: [{ ...m.wars[0]!, siege: to }],
      },
      grid,
      elevation,
    );
  assert.equal(besieged.camps.length, 1);
  assert.equal(besieged.camps[0]!.side, besieged.paths[0]!.side, "in the besiegers' colours");
  assert.equal(besieged.garrisons.length, 1);
  assert.equal(besieged.garrisons[0]!.realm, "pol:0:9");
  assert.ok(
    Math.hypot(
      besieged.garrisons[0]!.at.x,
      besieged.garrisons[0]!.at.y,
      besieged.garrisons[0]!.at.z,
    ) >= 1,
  );
});

test("in a land a host marches in ranks as many as its men, under banners; a camp rings a seat besieged there, a garrison stands by a seat at peace", () => {
  assert.ok(
    landShape(80000).files * landShape(80000).ranks > landShape(500).files * landShape(500).ranks,
  );
  const col = landColumn({ x: -20, z: 0 }, { x: 20, z: 0 }, 0.8, () => false, {
    files: 3,
    ranks: 7,
  });
  assert.equal(col.people.length, 21);
  assert.equal(col.people.filter((f) => f.lead).length, 1);
  assert.deepEqual(
    col.people.filter((f) => f.banner).map((f) => f.rank),
    [0, 3, 6],
    "a banner at the head and over every third rank",
  );
  const size = 8,
    mid = cellNear(0, 0, 1),
    parent = new Int32Array(size * size).fill(mid),
    m = map(cellNear(-0.9, 0, 0.44), mid),
    land = landWars(
      {
        ...m,
        garrisons: [
          {
            realm: "pol:0:9",
            name: "the Greens",
            color: [0.2, 0.8, 0.3],
            spot: mid,
            fields: 5000,
            host: null,
          },
        ],
        wars: [{ ...m.wars[0]!, siege: mid }],
      },
      parent,
      size,
      1,
      grid,
    );
  assert.equal(land.camps.length, 1);
  assert.match(land.camps[0]!.name, /camp of the Reds/);
  assert.equal(land.garrisons.length, 1);
  assert.match(land.garrisons[0]!.name, /garrison of the Greens/);
  assert.deepEqual(land.marches[0]!.hosts.defender, {
    arm: "bow",
    guard: "leather",
    mount: "horse",
  });
  // A seat beyond the map: no camp in it.
  const away = landWars(
    { ...m, wars: [{ ...m.wars[0]!, siege: cellNear(-0.9, 0, 0.44) }] },
    parent,
    size,
    1,
    grid,
  );
  assert.equal(away.camps.length, 0);
});

test("a battle in a land plays out: the hosts come on, fight at the line, fall as many as fell, the beaten fall back", () => {
  const b = { at: { x: 3, z: -2 }, event: "evt:0:77", won: true, size: 0.6, age: 0 },
    at = (phase: number) => landBattle(b, 10, phase * BATTLE_ROUND);
  // Coming on: far apart; at the line: close; each side facing the other.
  const far = at(0.02),
    met = at(0.5),
    gap = (list: typeof far) => {
      const mid = (side: 0 | 1) => {
        const xs = list.filter((f) => f.side === side);
        return {
          x: xs.reduce((n, f) => n + f.x, 0) / xs.length,
          z: xs.reduce((n, f) => n + f.z, 0) / xs.length,
        };
      };
      const a = mid(0),
        d = mid(1);
      return Math.hypot(a.x - d.x, a.z - d.z);
    };
  assert.ok(far.every((f) => f.doing === "advance"));
  assert.ok(gap(far) > gap(met) * 4, `${gap(far)} apart, then ${gap(met)}`);
  assert.equal(met.filter((f) => f.side === 0).length, 10);
  // As many fall as fell, the beaten the more; then the beaten fall back.
  const late = at(0.9),
    down = (side: 0 | 1) => late.filter((f) => f.side === side && f.doing === "fallen").length;
  assert.ok(down(1) > down(0), `the beaten lose more (${down(1)} to ${down(0)})`);
  assert.ok(
    late.some((f) => f.side === 1 && f.doing === "fall back"),
    "the beaten fall back",
  );
  assert.ok(!late.some((f) => f.side === 0 && f.doing === "fall back"), "the victors hold");
  // Last year's battle is not fought again: its fallen lie still.
  const old = { ...b, age: 1 };
  assert.deepEqual(landBattle(old, 10, 3), landBattle(old, 10, 17));
  assert.ok(landBattle(old, 10, 3).some((f) => f.doing === "fallen"));
});
