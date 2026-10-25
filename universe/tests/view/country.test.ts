import { test } from "node:test";
import assert from "node:assert/strict";
import type { VillagePlan } from "../../src/bridge/index.ts";
import {
  boatAt,
  blossomOf,
  countryOf,
  fruitHangs,
  hayStands,
  mannerOf,
  scarecrowsStand,
  tractorAt,
} from "../../src/view/index.ts";

// Phase 32 M170–M172: the countryside about a town, as Classic drew it.

const DAY = 86_400,
  YEAR = 365 * DAY;

/** A town's fields in a fan toward the good ground, as the host lays them: three rings of twelve. */
function town(
  era: VillagePlan["era"],
  walls = "wattle",
  biome = 9,
  fields = 36,
  flock = false,
): VillagePlan {
  return {
    ref: "town:0:7",
    name: "Testford",
    population: 400,
    market: true,
    hand: false,
    districts: null,
    biome,
    seed: 7,
    homes: [],
    fields: Array.from({ length: fields }, (_, k) => {
      const ring = Math.floor(k / 12),
        a = (((k % 12) - 5.5) / 12) * 2.6,
        r = 160 + ring * 45;
      return { x: r * Math.cos(a), z: r * Math.sin(a), w: 38, d: 26, yaw: a };
    }),
    pasture: { x: -300, z: 40, r: 90 },
    wild: 500,
    water: null,
    house: { walls, roof: "thatch", form: "long", pitch: 45, design: null },
    body: null,
    road: { x: 0, z: 900 },
    people: [],
    era,
    ...(flock
      ? {
          fauna: {
            wild: [],
            flock: { ref: "lin:0:1", name: "sheep", size: 1, wool: true, herders: 3 },
            raided: false,
          },
        }
      : {}),
  };
}

test("a land bounds its fields as it builds: hedges, walls, fences, banks; foragers not at all", () => {
  assert.equal(mannerOf(town("farm", "wattle", 9)), "hedge");
  assert.equal(mannerOf(town("farm", "stone", 9)), "wall");
  assert.equal(mannerOf(town("metal", "timber", 11)), "fence");
  assert.equal(mannerOf(town("farm", "mudbrick", 11)), "bank");
  assert.equal(mannerOf(town("farm", "wattle", 11)), "hurdle");
  assert.equal(mannerOf(town("farm", "shell-walls", 9)), "ridge");
  assert.equal(mannerOf(town("forage")), null);
  const foragers = countryOf(town("forage"));
  assert.deepEqual(
    [foragers.bounds.length, foragers.trees.length, foragers.barns.length, foragers.mills.length],
    [0, 0, 0, 0],
  );
});

test("each field bounded all round but for a gap toward the town; fences on posts", () => {
  const plan = town("farm", "timber", 9, 12),
    c = countryOf(plan, 1);
  assert.equal(c.manner, "fence");
  // (Two rails to a length; four sides, the gate's side in two lengths.)
  assert.equal(c.bounds.length, plan.fields.length * 5 * 2);
  assert.ok(c.posts.length > plan.fields.length * 20);
  for (const [k, f] of plan.fields.entries()) {
    // The gap: each field alone, no length of its bound within a few metres of the middle of
    // its side nearest the town.
    const alone = countryOf({ ...plan, fields: [f] }, 1);
    assert.equal(alone.bounds.length, 5 * 2);
    const sides = [
        [0, -0.5],
        [0.5, 0],
        [0, 0.5],
        [-0.5, 0],
      ].map(([u, v]) => ({
        x: f.x + Math.cos(f.yaw) * u! * f.w + Math.sin(f.yaw) * v! * f.d,
        z: f.z - Math.sin(f.yaw) * u! * f.w + Math.cos(f.yaw) * v! * f.d,
      })),
      gate = [...sides].sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))[0]!;
    // (How near a length of bound comes to the gate: the nearest point along it.)
    const reach = (b: (typeof alone.bounds)[number]) => {
      const dx = Math.sin(b.yaw),
        dz = Math.cos(b.yaw),
        along = Math.max(-b.sz / 2, Math.min(b.sz / 2, (gate.x - b.x) * dx + (gate.z - b.z) * dz));
      return Math.hypot(b.x + dx * along - gate.x, b.z + dz * along - gate.z);
    };
    assert.ok(
      alone.bounds.every((b) => reach(b) > 3),
      `field ${k}'s gate is open`,
    );
    assert.ok(
      alone.bounds.some((b) => reach(b) < 6),
      `field ${k}'s gate is in its bound`,
    );
  }
  const shut = countryOf(town("farm", "stone", 9, 12), 1);
  assert.equal(shut.bounds.length, 12 * 5);
  assert.equal(shut.posts.length, 0);
});

test("one field in five or so an orchard, its trees in rows within it; the rest sown in rows", () => {
  const plan = town("metal", "wattle", 9, 90),
    c = countryOf(plan, 1),
    orchards = c.orchard.filter(Boolean).length;
  assert.ok(orchards >= 9 && orchards <= 30, `${orchards} orchards of 90 fields`);
  assert.ok(c.trees.length >= orchards * 6);
  for (const t of c.trees)
    assert.ok(
      plan.fields.some(
        (f, k) =>
          c.orchard[k] &&
          Math.abs((t.x - f.x) * Math.cos(f.yaw) - (t.z - f.z) * Math.sin(f.yaw)) < f.w / 2 &&
          Math.abs((t.x - f.x) * Math.sin(f.yaw) + (t.z - f.z) * Math.cos(f.yaw)) < f.d / 2,
      ),
      "every orchard tree stands in an orchard",
    );
  // (A patchwork: grain the most, greens, and some left fallow, no rows across it.)
  const grain = c.crop.filter((x) => x === "grain").length,
    greens = c.crop.filter((x) => x === "greens").length,
    fallow = c.crop.filter((x) => x === "fallow").length;
  assert.equal(grain + greens + fallow + orchards, 90);
  assert.ok(grain > greens && greens > 0 && fallow > 0, `${grain}/${greens}/${fallow}`);
  assert.ok(c.rows.length >= (grain + greens) * 6);
  assert.ok(c.rows.every((r) => r.crop !== "fallow"));
  // (No rows on the plainest setting; no orchards where trees will not grow.)
  assert.equal(countryOf(plan, 0).rows.length, 0);
  assert.equal(countryOf(town("metal", "mudbrick", 11, 90)).trees.length, 0);
});

test("the ages show: windmills once metal is worked, silos and bales with engines, tractors and turbines when modern", () => {
  const farm = countryOf(town("farm", "wattle", 9, 36)),
    metal = countryOf(town("metal", "wattle", 9, 36)),
    industry = countryOf(town("industry", "brick", 9, 36)),
    modern = countryOf(town("modern", "brick", 9, 36));
  assert.equal(farm.mills.length, 0);
  assert.ok(metal.mills.length >= 1 && metal.mills.every((m) => m.kind === "mill"));
  assert.ok(industry.mills.every((m) => m.kind === "mill"));
  assert.ok(modern.mills.length >= 3 && modern.mills.every((m) => m.kind === "turbine"));
  assert.equal(metal.silos.length, 0);
  assert.equal(metal.bales, false);
  assert.ok(industry.silos.length + modern.silos.length > 0);
  assert.ok(industry.bales && modern.bales);
  assert.equal(industry.tractors.length, 0);
  assert.ok(modern.tractors.length > 0 && modern.tractors.length <= 6);
  assert.ok(metal.scarecrows.length > 0);
  assert.equal(modern.scarecrows.length, 0);
  assert.ok(metal.barns.length > 0, "barns by the far fields");
  // (Mills stand out on the rim, past the fields.)
  const rim = Math.max(...town("metal").fields.map((f) => Math.hypot(f.x, f.z)));
  for (const m of [...metal.mills, ...modern.mills]) assert.ok(Math.hypot(m.x, m.z) > rim);
});

test("the year shows: blossom in spring, fruit at the summer's end, scarecrows over the corn, hay after the reaping", () => {
  const at = (share: number) => 3 * YEAR + share * YEAR;
  assert.ok(blossomOf(at(0.29)) > 0.9);
  assert.equal(blossomOf(at(0.6)), 0);
  assert.ok(fruitHangs(at(0.62)) && !fruitHangs(at(0.2)));
  assert.ok(scarecrowsStand(at(0.4)) && !scarecrowsStand(at(0.9)));
  assert.ok(hayStands(at(0.8)) && !hayStands(at(0.4)) && !hayStands(at(0.05)));
});

test("a tractor works its field at the sowing and the harvest by day, and waits at the gate between", () => {
  const plan = town("modern", "brick", 9, 36),
    c = countryOf(plan),
    sowingNoon = 3 * YEAR + Math.floor(0.25 * 365) * DAY + 12 * 3600,
    winterNoon = 3 * YEAR + Math.floor(0.05 * 365) * DAY + 12 * 3600,
    sowingNight = sowingNoon + 10 * 3600;
  const f = plan.fields[c.tractors[0]!.field]!,
    working = tractorAt(plan, c, 0, sowingNoon, 12.5),
    later = tractorAt(plan, c, 0, sowingNoon, 13.5);
  assert.ok(working.working);
  assert.ok(
    Math.hypot(working.x - f.x, working.z - f.z) < Math.hypot(f.w, f.d) / 2,
    "on its field",
  );
  assert.ok(Math.hypot(later.x - working.x, later.z - working.z) > 1, "and moving");
  for (const when of [winterNoon, sowingNight]) {
    const idle = tractorAt(plan, c, 0, when, 12.5);
    assert.ok(!idle.working);
    assert.deepEqual(
      { x: idle.x, z: idle.z },
      { x: c.tractors[0]!.gate.x, z: c.tractors[0]!.gate.z },
    );
  }
});

test("the pasture fenced round with a gap toward the town; a rack of hay only where no flock grazes", () => {
  const empty = countryOf(town("farm")),
    kept = countryOf(town("farm", "wattle", 9, 36, true));
  assert.ok(empty.pen.posts.length >= 12);
  assert.equal(empty.pen.rails.length, (empty.pen.posts.length - 1) * 2);
  assert.ok(empty.pen.trough && empty.pen.rack);
  assert.ok(kept.pen.trough && !kept.pen.rack);
});

test("the same plan, the same countryside", () => {
  assert.deepEqual(countryOf(town("metal")), countryOf(town("metal")));
});

test("by the water: a jetty out from the shore nearest the town, boats by the age, out by day and tied up by night or on ice", () => {
  const lake = (era: VillagePlan["era"]) => ({ ...town(era), water: { x: 0, z: -700 } }),
    c = countryOf(lake("metal"));
  assert.ok(c.water, "a town by water has its jetty");
  assert.equal(countryOf(town("metal")).water, null);
  assert.equal(c.water.boat, "sail");
  assert.equal(countryOf(lake("farm")).water?.boat, "row");
  assert.equal(countryOf(lake("industry")).water?.boat, "steam");
  assert.equal(countryOf(lake("modern")).water?.boat, "motor");
  // (The jetty runs from the shore nearest the town out over the water.)
  const deck = c.water.pier[0]!;
  assert.ok(Math.abs(deck.x) < 1 && deck.z < -480 && deck.z > -520, `${deck.x}, ${deck.z}`);
  const noon = 3 * YEAR + 100 * DAY + 12 * 3600,
    night = noon + 11 * 3600;
  for (let k = 0; k < c.water.boats.length; k++) {
    const out = boatAt(c, k, noon, 40),
      later = boatAt(c, k, noon, 45),
      moored = boatAt(c, k, night, 40),
      iced = boatAt(c, k, noon, 40, true);
    assert.ok(out.out && Math.hypot(out.x, out.z + 700) < 220, "out on the water");
    assert.ok(Math.hypot(later.x - out.x, later.z - out.z) > 1, "and going about it");
    assert.ok(
      !moored.out && Math.hypot(moored.x - deck.x, moored.z - deck.z) < 25,
      "tied up at the jetty",
    );
    assert.deepEqual(iced, moored);
  }
});
