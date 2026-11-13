// Phase 66: the ages past ours from their physics, and each new step asking a world's matter for what it
// takes. A step past ours has no date: it is shut where a world holds nothing that meets it, and says why.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AGE_LADDER,
  COVER_PEOPLE_KM2,
  FIRST_MIRRORS_KM2,
  MIRROR_DOUBLING,
  PRINCIPLES,
  REMAKE_YEARS,
  ageOf,
  ageReached,
  beam,
  cannotRemake,
  hasBeams,
  hasMachineHost,
  matterShuts,
  mirrorKw,
  mirrorsNextYear,
  mostMirrorsKm2,
  noBeamGrip,
  remadeGround,
  worldDiscKm2,
  type Figures,
} from "../../src/rules/index.ts";
import {
  HOTTEST_REMADE,
  LEAST_HOLD_G,
  THICKEST_REMADE,
  remadeWorld,
  remakingAt,
} from "../../src/rules/late.ts";
import {
  HEAT_TREE,
  LATE_TREE,
  LAW_TREE,
  MEANS_TREE,
  SIGNAL_TREE,
} from "../../src/rules/principles.ts";
import { seedFromText } from "../../src/kernel/index.ts";
import { functionsOf } from "../../src/gen/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { homePlanet } from "../../src/sim/index.ts";

test("mirrors gather what falls on them: a sphere of them at a world's distance gathers all its star gives", () => {
  // (As much rock as you like, and they make the whole sphere.)
  const sphere = mostMirrorsKm2(1e12, 1);
  assert.ok(Math.abs(mirrorKw(sphere, 1, 1) / 3.83e23 - 1) < 1e-9);
  assert.ok(Math.abs(mirrorKw(sphere, 2, 1) / (2 * 3.83e23) - 1) < 1e-9);
  // (As broad as the world's disc, about what falls on the world: some 1.7e14 kW.)
  const onEarth = mirrorKw(worldDiscKm2(1), 1, 1);
  assert.ok(onEarth > 1.6e14 && onEarth < 1.9e14, `${onEarth} kW on a world`);
});

test("mirrors grow by doubling, to what a system's rock makes and no further", () => {
  let km2 = FIRST_MIRRORS_KM2;
  for (let y = 0; y < MIRROR_DOUBLING; y++) km2 = mirrorsNextYear(km2, Infinity);
  assert.ok(Math.abs(km2 / (2 * FIRST_MIRRORS_KM2) - 1) < 1e-9);
  assert.equal(mirrorsNextYear(100, 101), 101);
  // (A kilogram of rock to a square metre; a world's rock, at a world's distance, is far from a sphere's.)
  const most = mostMirrorsKm2(0.01, 1);
  assert.ok(Math.abs(most / ((0.01 * 5.97e24) / 1e6) - 1) < 1e-9);
  assert.ok(
    mostMirrorsKm2(1e9, 0.1) < 4 * Math.PI * (0.1 * 1.5e8) ** 2 * 1.01,
    "the sphere bounds it",
  );
});

test("what cannot be remade says why, and what can comes to a home's air and warmth", () => {
  const ground = { kind: "rocky", gravity: 0.4, pressure: 0.01, temperature: -60 };
  assert.equal(cannotRemake(ground), null);
  assert.match(cannotRemake({ ...ground, kind: "giant" })!, /no ground/);
  assert.match(cannotRemake({ ...ground, gravity: LEAST_HOLD_G / 2 })!, /would lose any air/);
  assert.match(cannotRemake({ ...ground, temperature: HOTTEST_REMADE + 10 })!, /too hot/);
  assert.match(cannotRemake({ ...ground, pressure: THICKEST_REMADE + 10 })!, /taken away/);
  assert.deepEqual(remadeGround(ground, 0), { pressure: 0.01, temperature: -60 });
  assert.deepEqual(remadeGround(ground, 1), { pressure: 1, temperature: 15 });
  const half = remadeGround(ground, 0.5);
  assert.ok(half.pressure > 0.4 && half.pressure < 0.6 && half.temperature > -30);
  assert.ok(REMAKE_YEARS >= 100, "no world's air is made in a generation");
});

test("the steps past ours are added after all the others, so no earlier step moves", () => {
  const ids = PRINCIPLES.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  // (After them only arms by what they do, F1, and heat by what reaches it, F2, laws and signals, which every land's earlier draws stand before too.)
  const from =
    ids.length -
    LATE_TREE.length -
    MEANS_TREE.length -
    HEAT_TREE.length -
    LAW_TREE.length -
    SIGNAL_TREE.length;
  assert.deepEqual(
    ids.slice(from),
    [...LATE_TREE, ...MEANS_TREE, ...HEAT_TREE, ...LAW_TREE, ...SIGNAL_TREE].map((p) => p.id),
  );
  for (const id of [
    "fusion-power",
    "machine-minds",
    "drawn-carbon",
    "beam-arms",
    "made-bodies",
    "machine-soldiers",
    "star-mirrors",
    "vat-food",
    "world-making",
    "world-city",
  ])
    assert.ok(ids.slice(from).includes(id), `${id} among the late steps`);
});

test("each step that asks a function of its world's matter is shut where nothing meets it, and open where it is met", () => {
  const asking = LATE_TREE.filter((p) => p.asks?.length);
  assert.ok(asking.length >= 6, `${asking.length} ask a function`);
  const earth = functionsOf(homePlanet(EARTH.build(seedFromText("first light"))).generated);
  for (const p of asking) assert.equal(matterShuts(p, earth), null, `${p.id} on a solar world`);
  // A world with none of what a flame's wall or bottle would be made of.
  const shutAll = earth.map((f) => ({ ...f, met: false, by: null, subst: null }));
  for (const p of asking) {
    const shut = matterShuts(p, shutAll);
    assert.ok(shut && shut.met === false, `${p.id} is shut where nothing meets it`);
    assert.ok(shut.why || shut.asks, `${p.id} says why`);
  }
});

test("the ladder past ours reads from what a world can do, the highest whose asks all stand", () => {
  const figures = (over: Partial<Figures>): Figures =>
    ({
      energy: 40,
      materials: 2000,
      precision: 0.001,
      computing: 1e4,
      life: 5,
      reach: 1e13,
      people: 5e8,
      lands: 400,
      realms: 50,
      towns: 2000,
      cities: 100,
      sat: 1,
      crew: 1,
      station: 1,
      starships: 1,
      colonies: 2,
      starColonies: 1,
      flame: 0,
      beams: 0,
      remade: 0,
      cover: 0,
      gathered: 0,
      ...over,
    }) as unknown as Figures;
  const ids = AGE_LADDER.map((a) => a.id),
    from = ids.indexOf("stars");
  assert.deepEqual(ids.slice(from + 1), [
    "fusion",
    "minds",
    "beams",
    "bodies",
    "remade",
    "covered",
    "gathered",
  ]);
  const plain = ageOf(figures({})).id;
  assert.ok(!ids.slice(from + 1).includes(plain), `with none of them, ${plain}`);
  assert.equal(ageOf(figures({ flame: 100 })).id, "fusion");
  assert.equal(ageOf(figures({ flame: 100, gathered: 1 })).id, "gathered");
  // (It falls when what it stood on goes.)
  assert.notEqual(ageOf(figures({ cover: 0.4 })).id, "covered");
  assert.equal(ageOf(figures({ cover: 0.6 })).id, "covered");
  assert.ok(COVER_PEOPLE_KM2 > 100, "a land built over holds more than any land of farms");
});

test("an age past ours is reached only where its own asks stood, not on the way to a higher one", () => {
  const ids = AGE_LADDER.map((a) => a.id),
    at = (id: string) => ids.indexOf(id),
    figures = {
      flame: 0,
      computing: 1e9,
      beams: 0,
      life: 0,
      remade: 0,
      cover: 0,
      gathered: 0,
    } as never;
  // (Minds of crystal with no flame ever held: no age of fusion passed through.)
  assert.equal(ageReached(at("fusion"), at("minds"), figures), false);
  assert.equal(ageReached(at("minds"), at("minds"), figures), true);
  // (Those up to the stars are passed on the way up.)
  assert.equal(ageReached(at("orbit"), at("minds"), figures), true);
  assert.equal(ageReached(at("beams"), at("minds"), figures), false);
});

test("a body that has no grip for a beam rifle is told so; one of the water has its lance", () => {
  const body = (over: object) =>
    ({
      manipulators: "hands",
      limbs: 4,
      medium: "land",
      size: 70,
      senses: ["sight"],
      ...over,
    }) as never;
  assert.equal(noBeamGrip(body({})), null);
  assert.match(noBeamGrip(body({ manipulators: "claws" }))!, /claws do not have/);
  assert.match(noBeamGrip(body({ manipulators: "mandibles" }))!, /mandibles do not have/);
  assert.equal(noBeamGrip(body({ manipulators: "claws", medium: "water" })), null);
});

test("beams are of the fire terms: a straight line of light, for those who can make it", () => {
  const b = beam("beam-rifle");
  assert.ok(b, "the beam rifle has its row");
  assert.ok(beam("beam-lance"), "the beam lance has its row");
  assert.equal(beam("automatic"), undefined);
  assert.equal(typeof hasBeams, "function");
  assert.equal(typeof hasMachineHost, "function");
});

test("a remaking seen: a breath, then what can be breathed, ice melting on the way", () => {
  const moon = { air: "none", water: "ice", pressure: 0, temperature: -120, icy: true };
  assert.deepEqual(remadeWorld(moon, 0), moon);
  const third = remadeWorld(moon, 0.3);
  assert.equal(third.air, "none");
  assert.ok(Math.abs(third.pressure - 0.3) < 1e-12);
  assert.equal(remadeWorld(moon, 0.5).air, "thin");
  assert.equal(remadeWorld(moon, 0.5).icy, true);
  assert.equal(remadeWorld(moon, 0.7).water, "liquid");
  assert.equal(remadeWorld(moon, 0.7).icy, false);
  const done = remadeWorld(moon, 1);
  assert.equal(done.air, "breathable");
  assert.equal(done.pressure, 1);
  assert.equal(done.temperature, 15);
  // (Thick air it had keeps its name until it can be breathed.)
  assert.equal(remadeWorld({ ...moon, air: "thick" }, 0.9).air, "thick");
});

test("how far a remaking had come by a year, for its film", () => {
  const r = { from: 1500, to: 1900, share: 1 };
  assert.equal(remakingAt(r, 1400), 0);
  assert.equal(remakingAt(r, 1500), 0);
  assert.equal(remakingAt(r, 1700), 0.5);
  assert.equal(remakingAt(r, 1900), 1);
  assert.equal(remakingAt(r, 2500), 1);
  // (Stopped part way: it never comes further than it came.)
  assert.equal(remakingAt({ from: 1500, to: 1600, share: 0.25 }, 3000), 0.25);
  assert.equal(remakingAt({ from: 1500, to: 1500, share: 0 }, 1500), 0);
});
