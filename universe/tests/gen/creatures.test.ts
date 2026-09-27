import { test } from "node:test";
import assert from "node:assert/strict";
import { seedFromText } from "../../src/kernel/index.ts";
import { generateHomeWorld, lives, type Species } from "../../src/gen/index.ts";
import { EARTHLIKE, OPEN, creatureBody, creatureName } from "../../src/rules/index.ts";

const earth = generateHomeWorld(seedFromText("first light"), EARTHLIKE),
  aliens = ["alien 7", "alien 41", "alien 55", "moss", "kestrel"].map((s) =>
    generateHomeWorld(seedFromText(s), OPEN),
  ),
  beasts = (w: typeof earth) => w.life.species.filter((s) => s.body && s.died === null);

test("every beast has a body of its own, and Earth's are Earth's: four legs, or wings and two, or fins", () => {
  const all = beasts(earth);
  assert.ok(all.length >= 15, `${all.length} living beasts`);
  for (const s of all) {
    const b = s.body!;
    if (b.moves === "fly")
      assert.ok(b.wings === 2 && b.legs === 2 && b.covering === "feathers", s.name);
    else if (b.moves === "swim") assert.ok(b.fins > 0 && b.legs === 0, s.name);
    else
      assert.ok(
        b.legs === 4 || (s.niche === "seed-eater" && b.legs === 2),
        `${s.name}: ${b.legs} legs`,
      );
    assert.equal(b.symmetry, "bilateral");
    // Its name says what its body has.
    if (/\box\b/.test(s.name)) assert.ok(b.features.includes("horns"), s.name);
    if (/\bhorse\b/.test(s.name)) assert.ok(!b.features.includes("horns"), s.name);
    if (/tusker/.test(s.name)) assert.ok(b.features.includes("tusks"), s.name);
    if (/sheep/.test(s.name)) assert.equal(b.covering, "wool", s.name);
  }
  // The people have no beast's body; the grasses none at all.
  assert.ok(
    earth.life.species
      .filter((s) => s.niche === "seed grass" || s.niche === "upright ape")
      .every((s) => !s.body),
  );
});

test("a heavier world's beasts stand on more legs and go in plates and shells; a colder one's in fur", () => {
  const legs = (w: typeof earth) => {
    const walkers = beasts(w).filter((s) => s.body!.moves !== "fly" && s.body!.moves !== "swim");
    return walkers.reduce((a, s) => a + s.body!.legs, 0) / Math.max(1, walkers.length);
  };
  const byPull = aliens
    .map((w) => ({ g: w.planet.gravity, legs: legs(w) }))
    .sort((a, b) => a.g - b.g);
  const light = byPull.filter((x) => x.g < 1),
    heavy = byPull.filter((x) => x.g > 1.3);
  if (light.length && heavy.length) {
    const mean = (xs: { legs: number }[]) => xs.reduce((a, x) => a + x.legs, 0) / xs.length;
    assert.ok(
      mean(heavy) > mean(light),
      `heavy ${mean(heavy).toFixed(1)} legs, light ${mean(light).toFixed(1)}`,
    );
  }
  // The same niche, drawn in the cold and in the heat on an open world: the cold one furred.
  const draw = (warm: number) =>
    creatureBody(
      "grazer",
      { gravity: 1, ocean: 0.5, pressure: 1, earthlike: false },
      { warm, rain: 600 },
      () => 0.3,
    );
  assert.ok(["fur", "wool"].includes(draw(-5).covering));
  assert.ok(
    !["fur", "wool"].includes(
      creatureBody(
        "grazer",
        { gravity: 1, ocean: 0.5, pressure: 1, earthlike: false },
        { warm: 30, rain: 200 },
        () => 0.3,
      ).covering,
    ),
  );
  // A heavier pull keeps a body smaller.
  const size = (g: number) =>
    creatureBody(
      "hunter",
      { gravity: g, ocean: 0.5, pressure: 1, earthlike: false },
      { warm: 15, rain: 800 },
      () => 0.5,
    ).size;
  assert.ok(size(2) < size(1) && size(1) < size(0.5));
});

test("the web of eating has its levels: plant-eaters, the hunters of them, and the great hunters above", () => {
  for (const w of [earth, ...aliens]) {
    const all = beasts(w),
      levels = new Set(all.map((s) => s.level));
    assert.ok(levels.has(2) && (levels.has(3) || levels.has(4)), `levels ${[...levels]}`);
    // Every hunter of the web's newer niches lives where some beast it can eat lives.
    const eaters = all.filter((s) => s.niche === "small hunter" || s.niche === "scavenger"),
      game = all.filter((s) => s.level === 2 || s.level === 4);
    for (const h of eaters) {
      let meets = false;
      for (let c = 0; c < w.grid.count && !meets; c++)
        if (lives(w.life, c, h.index) && game.some((g) => lives(w.life, c, g.index))) meets = true;
      assert.ok(meets, `${h.name} meets its food`);
    }
  }
});

test("swimmers live only by water: a river, a lake or a coast", () => {
  const w = earth,
    land = (c: number) => w.tectonics.elevation[c]! > 0,
    wet = (c: number) => {
      if (w.water.river[c] || w.water.lake[c]) return true;
      for (let k = w.grid.offsets[c]!; k < w.grid.offsets[c + 1]!; k++)
        if (!land(w.grid.neighbours[k]!)) return true;
      return false;
    };
  const swimmers = beasts(w).filter((s) => s.niche === "swimmer");
  assert.ok(swimmers.length >= 1);
  for (const s of swimmers)
    for (let c = 0; c < w.grid.count; c += 3)
      if (lives(w.life, c, s.index)) assert.ok(wet(c), `${s.name} at ${c}`);
});

test("off the Earthlike prior, a lineage's name is made of its body", () => {
  const names = (w: typeof earth) => beasts(w).map((s: Species) => s.name);
  for (const w of aliens) {
    const all = names(w);
    assert.equal(new Set(all).size, all.length, "each its own name");
  }
  const body = creatureBody(
    "grazer",
    { gravity: 1.8, ocean: 0.3, pressure: 1, earthlike: false },
    { warm: 20, rain: 500 },
    (k) => (k === 2 ? 0.95 : 0.5),
  );
  assert.equal(body.legs, 8);
  assert.match(
    creatureName(body, "grazer", { warm: 20, rain: 500 }, false, 0.1),
    /eight-strider|crawler/,
  );
});
