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
  grainLost,
  stepWilds,
  waterYield,
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
  hunter: 0,
  hunters: 1,
  flocksTaken: null,
  huntersLeft: null,
  small: 1,
  lesserOf: 1,
  lesser: 1,
  scavengerOf: 2,
  carrion: 1,
  fish: 1,
  multiplied: null,
  grainEaten: null,
  fishFew: null,
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
  // (The game a little past the ground's share, its hunters thinned with it.)
  assert.ok(farmed.forest <= 0.2 + 1e-9 && farmed.wild <= 0.36 * 1.2 + 1e-9);
  assert.ok(farmed.soil < 0.8, `worn soil ${farmed.soil.toFixed(2)}`);
  // ...unless the fields are rested in turn and dunged.
  const rested = fresh();
  for (let y = 0; y < 40; y++) stepWilds(rested, 0, 0.8, 1);
  assert.equal(rested.soil, 1);
  // Let be, the forest comes back slowly.
  for (let y = 0; y < 20; y++) stepWilds(farmed, 0, 0, 0);
  assert.ok(farmed.forest > 0.2 && farmed.forest < 0.8, `regrown ${farmed.forest.toFixed(2)}`);
});

test("the hunters follow their game, fall under a people who guard their flocks, and come back when let be", () => {
  // As the game is thinned, so are its hunters.
  const thinned = fresh();
  for (let y = 0; y < 40; y++) stepWilds(thinned, 0.95, 0, 0);
  assert.ok(
    thinned.hunters < thinned.wild + 0.1 && thinned.hunters < 0.6,
    `hunters ${thinned.hunters.toFixed(2)}`,
  );
  // A people who keep and guard flocks drive them down, well below what the game would keep.
  const guarded = fresh();
  for (let y = 0; y < 40; y++) stepWilds(guarded, 0, 0, 0, 0.3);
  assert.ok(guarded.hunters < 0.5, `guarded ${guarded.hunters.toFixed(2)}`);
  // Left be, with the game there, they return toward as many as it keeps.
  for (let y = 0; y < 80; y++) stepWilds(guarded, 0, 0, 0, 0);
  assert.ok(guarded.hunters > 0.85, `returned ${guarded.hunters.toFixed(2)}`);
  // A land with no hunting lineage keeps none.
  const bare = { ...fresh(), hunter: -1, hunters: 0 };
  for (let y = 0; y < 20; y++) stepWilds(bare, 0, 0, 0, 0);
  assert.equal(bare.hunters, 0);
});

test("the default world's lands keep their hunters, and where herders guard their flocks the hunters are driven out or take flocks, and say which", () => {
  const world = makePopulationWorld(seedFromText("first light"));
  world.runTo(250 * YEAR);
  const ctx = populationContext(world),
    life = homePlanet(world).generated.life,
    lands = ctx.provinces.all().filter((p) => p.total() > 0),
    withHunters = lands.filter((p) => wildsOf(ctx, p.cell).hunter >= 0);
  assert.ok(
    withHunters.length > lands.length / 4,
    `${withHunters.length} of ${lands.length} lands have hunters`,
  );
  const told = world.events
    .all()
    .filter(
      (e) =>
        e.type === ECOLOGY_EVENTS.huntersGone.type || e.type === ECOLOGY_EVENTS.flocksTaken.type,
    );
  assert.ok(told.length > 0, "hunters driven out or flocks taken somewhere");
  for (const e of told.slice(0, 5)) {
    const s = life.species.find((x) => x.ref === e.subjects[0]);
    assert.ok(s?.niche === "hunter" || s?.niche === "small hunter", "a hunting lineage");
    assert.match(why(world, e.id).claim, new RegExp(s!.name));
  }
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
    { ...wildsOf(ctx, cell), wild: 0.5, soil: 0.25, small: 1, fish: 1 },
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

test("a land let be keeps every level of its web as it was", () => {
  const w = fresh();
  for (let y = 0; y < 100; y++) stepWilds(w, 0, 0, 0, 0);
  for (const [name, v] of [
    ["wild", w.wild],
    ["small", w.small],
    ["lesser", w.lesser],
    ["carrion", w.carrion],
    ["fish", w.fish],
    ["hunters", w.hunters],
  ] as const)
    assert.ok(Math.abs(v - 1) < 1e-9, `${name} ${v}`);
});

test("where its hunters are driven out, the game multiplies past what it was and browses the woods back", () => {
  const gone = { ...fresh(), lost: [0], hunters: 0 },
    kept = fresh();
  for (const w of [gone, kept]) w.forest = 0.3;
  for (let y = 0; y < 40; y++) {
    stepWilds(gone, 0, 0, 0, 0);
    stepWilds(kept, 0, 0, 0, 0);
  }
  assert.ok(gone.wild > 1.15 && gone.wild <= 1.2 + 1e-9, `game ${gone.wild.toFixed(2)}`);
  assert.equal(kept.wild, 1);
  assert.ok(
    gone.forest < kept.forest - 0.1,
    `browsed woods ${gone.forest.toFixed(2)} against ${kept.forest.toFixed(2)}`,
  );
  // And the scavengers, living on the kills, dwindle with the hunters gone; with the game
  // hunted hard as well, fewer still.
  assert.ok(gone.carrion < 0.6, `scavengers ${gone.carrion.toFixed(2)}`);
  const bare = { ...fresh(), lost: [0], hunters: 0 };
  for (let y = 0; y < 60; y++) stepWilds(bare, 0.99, 0, 0, 0);
  assert.ok(bare.carrion < gone.carrion * 0.5, `scavengers ${bare.carrion.toFixed(2)}`);
});

test("farmers and herders drive off the small hunters, and the small game eats the grain", () => {
  const w = fresh();
  for (let y = 0; y < 80; y++) stepWilds(w, 0, 0.9, 1, 0.3);
  assert.ok(w.lesser < 0.4, `small hunters ${w.lesser.toFixed(2)}`);
  assert.ok(w.small > 1.05, `small game ${w.small.toFixed(2)}`);
  assert.ok(grainLost(w) > 0.01 && grainLost(w) <= 0.06 + 1e-9, `grain lost ${grainLost(w)}`);
  // The capacity the land offers counts it.
  const c = living({ forage: 100, farm: 200, pasture: 50, areaKm2: 10 }, w);
  assert.ok(c.farm < 200 * w.soil);
  // Where the small hunters stand, the small game keeps no more than the ground and fields give.
  const kept = { ...fresh(), lesserOf: -1, lesser: 0 };
  for (let y = 0; y < 80; y++) stepWilds(kept, 0, 0.9, 1, 0.3);
  assert.ok(kept.small < w.small, "fewer small game where nothing was driven off");
});

test("fished hard, the waters grow poor and the wild's food with them; let be, they come back", () => {
  const w = fresh();
  for (let y = 0; y < 30; y++) stepWilds(w, 0.95, 0, 0, 0);
  assert.ok(w.fish < 0.4, `fish ${w.fish.toFixed(2)}`);
  assert.ok(waterYield(w) < 0.95);
  for (let y = 0; y < 40; y++) stepWilds(w, 0, 0, 0, 0);
  assert.ok(w.fish > 0.9, `fish ${w.fish.toFixed(2)}`);
  // A land with no water has no fish to lose.
  const dry = { ...fresh(), fish: -1 };
  for (let y = 0; y < 30; y++) stepWilds(dry, 0.95, 0, 0, 0);
  assert.equal(dry.fish, -1);
  assert.equal(waterYield(dry), 1);
});

test("the web's turns for the worse enter history, each with its why", () => {
  const world = makePopulationWorld(seedFromText("first light"));
  world.runTo(120 * YEAR);
  const ctx = populationContext(world),
    home = homePlanet(world).generated.life.people!.cell,
    cell = ctx.provinces
      .all()
      .filter((p) => p.total() > 0 && p.knowsCultivation && wildsOf(ctx, p.cell).fish >= 0)
      .map((p) => p.cell)
      .sort((a, b) => Number(b === home) - Number(a === home) || a - b)[0]!;
  const place = ctx.provinces.get(cell)!.ref;
  // Its waters fished down, and its small game grown thick in the fields.
  ecologyOf(world).set({ ...wildsOf(ctx, cell), fish: 0.2, small: 1.4 });
  world.runTo(122 * YEAR);
  const told = (type: string) =>
    world.events.all().filter((e) => e.type === type && e.place === place);
  const fish = told(ECOLOGY_EVENTS.fishFew.type),
    grain = told(ECOLOGY_EVENTS.grainEaten.type);
  assert.equal(fish.length, 1, "the fish grown few, told once");
  assert.equal(grain.length, 1, "the grain eaten, told once");
  assert.match(why(world, fish[0]!.id).claim, /The fish of .* grew few, fished hard/);
  assert.match(why(world, grain[0]!.id).claim, /of .* ate \d+ in a hundred of its grain/);
  // The land remembers them while they last.
  const w = wildsOf(ctx, cell);
  assert.equal(w.fishFew, fish[0]!.id);
  assert.equal(w.grainEaten, grain[0]!.id);
});
