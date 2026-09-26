import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, type Ref } from "../../src/kernel/index.ts";
import {
  ECOLOGY_EVENTS,
  ecologyOf,
  homePlanet,
  landMaterials,
  living,
  makePopulationWorld,
  marketsOf,
  populationContext,
  stepWilds,
  wildsOf,
  type Wilds,
} from "../../src/sim/index.ts";
import { why } from "../../src/causal/index.ts";
import { G } from "../../src/rules/index.ts";

const fresh = (): Wilds => ({
  cell: 0,
  wild: 1,
  forest: 1,
  soil: 1,
  firstForest: 1,
  lost: [],
  thinned: null,
  cleared: null,
  worn: null,
});

test("pressed hard, the living world gives way; let be, it heals", () => {
  // Foragers taking most of what the wild yields thin it; a land let be grows it back.
  const hunted = fresh();
  for (let y = 0; y < 40; y++) stepWilds(hunted, 0.95, 0, 0);
  assert.ok(hunted.wild < 0.5, `hunted wild ${hunted.wild.toFixed(2)}`);
  for (let y = 0; y < 60; y++) stepWilds(hunted, 0, 0, 0);
  assert.ok(hunted.wild > 0.9, "and it comes back when the hunt eases");
  // Fields clear the forest at once, take the wild's ground, and wear the soil...
  const farmed = fresh();
  for (let y = 0; y < 40; y++) stepWilds(farmed, 0, 0.8, 0);
  assert.ok(farmed.forest <= 0.2 + 1e-9 && farmed.wild <= 0.36 + 1e-9);
  assert.ok(farmed.soil < 0.8, `worn soil ${farmed.soil.toFixed(2)}`);
  // ...unless the fields are rested in turn and dunged.
  const rested = fresh();
  for (let y = 0; y < 40; y++) stepWilds(rested, 0, 0.8, 1);
  assert.equal(rested.soil, 1);
  // Let be, the forest comes back slowly.
  for (let y = 0; y < 20; y++) stepWilds(farmed, 0, 0, 0);
  assert.ok(farmed.forest > 0.2 && farmed.forest < 0.8, `regrown ${farmed.forest.toFixed(2)}`);
});

test("the great beasts are hunted out of a foraging land, and history says which and why", () => {
  const world = makePopulationWorld(seedFromText("kestrel"));
  world.runTo(30 * YEAR);
  const out = world.events.all().filter((e) => e.type === ECOLOGY_EVENTS.huntedOut.type);
  assert.ok(out.length >= 1, "some great beast was hunted out");
  const life = homePlanet(world).generated.life,
    ctx = populationContext(world);
  for (const e of out) {
    const beast = life.species.find((s) => s.ref === e.subjects[0])!;
    assert.equal(beast.niche, "great beast");
    const cell = Number(e.place!.split(":")[2]);
    assert.ok(wildsOf(ctx, cell).lost.includes(beast.index), "the land remembers losing it");
    assert.match(
      why(world, e.id).claim,
      new RegExp(`The last ${beast.name} of .* were hunted out`),
    );
  }
});

test("a land's harvest is what its soil still gives; its wood, what its forest still holds", () => {
  const twin = () => {
    const w = makePopulationWorld(seedFromText("first light"));
    w.runTo(120 * YEAR);
    return w;
  };
  const whole = twin(),
    worn = twin(),
    home = homePlanet(worn).generated.life.people!.cell,
    ctx = populationContext(worn);
  // Wear the cradle's soil to half, and let a month go by in both.
  ecologyOf(worn).set({ ...wildsOf(ctx, home), soil: 0.5 });
  whole.runTo(120 * YEAR + YEAR / 12);
  worn.runTo(120 * YEAR + YEAR / 12);
  // Grain made this year so far (the market's ledger: line by good, "made" first).
  const grain = (w: typeof whole) => marketsOf(w).get(home)!.ledger[G.grain]!;
  assert.ok(
    grain(worn) < grain(whole) * 0.8,
    `${grain(worn)} grain from worn soil, ${grain(whole)} from whole`,
  );
  // A cleared land has little wood to build with.
  const cell = ctx.provinces.all().find((p) => landMaterials(ctx, p.cell).has("wood"))!.cell;
  ecologyOf(worn).set({ ...wildsOf(ctx, cell), forest: 0.1 });
  assert.ok(!landMaterials(ctx, cell).has("wood"));
  const c = living(
    { forage: 100, farm: 200, pasture: 50, areaKm2: 10 },
    { ...wildsOf(ctx, cell), wild: 0.5, soil: 0.25 },
  );
  assert.deepEqual([c.forage, c.farm, c.pasture], [50, 50, 50]);
});

test("where people press the land hard, its turns for the worse enter history", () => {
  // Kestrel's dry steppe fills with farmers: game grows scarce and soils wear.
  const world = makePopulationWorld(seedFromText("kestrel"), { start: "spread" });
  world.runTo(300 * YEAR);
  const told = (type: string) => world.events.all().filter((e) => e.type === type);
  const thinned = told(ECOLOGY_EVENTS.thinned.type),
    worn = told(ECOLOGY_EVENTS.worn.type);
  assert.ok(
    thinned.length >= 3 && worn.length >= 3,
    `${thinned.length} thinned, ${worn.length} worn`,
  );
  for (const e of worn) {
    assert.ok(
      e.causes.some((c) => world.events.get(c.ref as Ref)?.type.startsWith("knowledge.")),
      "their fields",
    );
    assert.match(why(world, e.id).claim, /soils of .* wore thin under the plough/);
  }
});
