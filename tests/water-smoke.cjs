// Water smoke: the living loop returns the water it drinks — photosynthesis
// takes one solvent, a nutrient and two gas and gives an oxidant with its
// organic and energy; respiration still breathes out waste and gas, so the
// ground under the living is fertilized; mineralization takes oxidant and
// gives back a nutrient, a solvent and a gas; decomposition takes oxidant and
// returns a solvent; two organic eaten, their two energies respired and the
// waste mineralized return the solvent and the gas their making took and
// leave the ground richer; two organic rotted return the solvent, the
// nutrient and the oxidant — and the sky breathes: standing water above its
// depth gives the air a hundredth of its spare a pass in clear weather, twice
// in a heat wave, nothing in rain or drought or below freezing or at its
// level; wet ground above fifty moisture gives one a pass and one more for
// every ten above; dry ground gives nothing; every tile cools back toward the
// climate it was made with by a twentieth of the excess a pass; a body passes
// the nutrient above its reserve to the ground it stands on; and matter
// moves, none is made.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const out = { failures: [] }, fail = (m) => out.failures.push(m);
  const rx = (id) => reactionById(id), has = (list, sp, n) => list.some(([s, k]) => s === sp && k === n);
  const photo = rx("photosynthesis"), resp = rx("respiration"), rot = rx("decomposition"), min = rx("waste_mineralization"), dig = rx("digestion");
  if (!photo?.balanced || !resp?.balanced || !rot?.balanced || !min?.balanced || !dig?.balanced) fail("a reaction of the loop does not balance");
  if (!has(photo.reactants, C.SOLVENT, 1) || !has(photo.reactants, C.GAS, 2) || !has(photo.products, C.OXIDANT, 1)) fail("photosynthesis is not one solvent and two gas in, one oxidant out");
  if (!has(resp.products, C.WASTE, 1) || !has(resp.products, C.GAS, 1)) fail("respiration does not breathe out waste and gas");
  if (min.reactants.some(([s]) => s === C.SOLVENT) || !has(min.reactants, C.OXIDANT, 1) || !has(min.products, C.SOLVENT, 1) || !has(min.products, C.GAS, 1) || !has(min.products, C.NUTRIENT, 1)) fail("mineralization does not take oxidant and give back a nutrient, a solvent and a gas");
  if (!has(rot.reactants, C.OXIDANT, 1) || rot.reactants.some(([s]) => s === C.SOLVENT) || !has(rot.products, C.SOLVENT, 1)) fail("decomposition does not take oxidant and return a solvent");
  const tally = (steps) => { const net = new Map(); for (const [r, n] of steps) { for (const [s, k] of r.reactants) net.set(s, (net.get(s) || 0) - n * k); for (const [s, k] of r.products) net.set(s, (net.get(s) || 0) + n * k); } return net; };
  // Two organic eaten, their two energies respired, the two waste mineralized: the solvent and the gas come back, the ground is richer.
  const eaten = tally([[photo, 1], [dig, 1], [resp, 2], [min, 1]]);
  out.eaten = [...eaten.entries()].filter(([, v]) => v !== 0).map(([s, v]) => s + ":" + v);
  if (eaten.get(C.SOLVENT) !== 0 || !((eaten.get(C.GAS) || 0) >= 0) || eaten.get(C.WASTE) !== 0 || eaten.get(C.ORGANIC) !== 0 || eaten.get(C.ENERGY) !== 0) fail("the eaten loop does not return the solvent and the gas: " + out.eaten.join(","));
  if (!((eaten.get(C.NUTRIENT) || 0) > 0)) fail("the eaten loop leaves the ground no richer: " + out.eaten.join(","));
  // Two organic rotted: the solvent, the nutrient and the oxidant come back.
  const rotted = tally([[photo, 1], [rot, 1]]);
  out.rotted = [...rotted.entries()].filter(([, v]) => v !== 0).map(([s, v]) => s + ":" + v);
  if (rotted.get(C.SOLVENT) !== 0 || rotted.get(C.NUTRIENT) !== 0 || rotted.get(C.OXIDANT) !== 0) fail("the rotted loop does not return the solvent, the nutrient and the oxidant: " + out.rotted.join(","));
  // The sky breathes.
  const delta0 = auditMatter().delta, air0 = W.reservoirs.atmosphericSolvent;
  let lake = -1;
  for (let i = 0; i < W.tileCount && lake < 0; i++)
    if (W.tiles.liquid[i] > WATER_DEPTH.SURFACE && W.tiles.temperature[i] >= 0 && W.tiles.chem[C.SOLVENT][i] - W.tiles.liquid[i] >= 200) lake = i;
  if (lake < 0) { fail("no warm lake tile with spare water"); return out; }
  const spare = W.tiles.chem[C.SOLVENT][lake] - W.tiles.liquid[lake], before = W.tiles.chem[C.SOLVENT][lake];
  out.clear = breatheSurfaceWater(lake, "Clear");
  if (out.clear !== Math.ceil(spare * 0.01)) fail("a clear pass did not lift a hundredth of the spare: " + out.clear + " of " + spare);
  if (W.tiles.chem[C.SOLVENT][lake] !== before - out.clear || W.reservoirs.atmosphericSolvent !== air0 + out.clear) fail("the lift did not move from the lake to the air");
  const spare2 = W.tiles.chem[C.SOLVENT][lake] - W.tiles.liquid[lake];
  out.heat = breatheSurfaceWater(lake, "Heat Wave");
  if (out.heat !== Math.ceil(spare2 * 0.01) * 2) fail("a heat wave did not lift twice: " + out.heat);
  for (const w of ["Rain", "Heavy Rain", "Storm", "Drought"]) if (breatheSurfaceWater(lake, w) !== 0) fail("the lake breathed in " + w);
  const temp = W.tiles.temperature[lake];
  W.tiles.temperature[lake] = -10;
  out.frozen = breatheSurfaceWater(lake, "Clear");
  W.tiles.temperature[lake] = temp;
  if (out.frozen !== 0) fail("ice breathed: " + out.frozen);
  // A lake at its level gives nothing: the water its depth accounts for is the floor.
  const held = W.tiles.chem[C.SOLVENT][lake];
  W.tiles.chem[C.SOLVENT][lake] = W.tiles.liquid[lake];
  out.atLevel = breatheSurfaceWater(lake, "Clear");
  W.tiles.chem[C.SOLVENT][lake] = held;
  if (out.atLevel !== 0) fail("a lake at its level breathed: " + out.atLevel);
  // Wet ground gives a little by how wet it is; dry ground gives nothing.
  let land = -1, dryLand = -1;
  for (let i = 0; i < W.tileCount && (land < 0 || dryLand < 0); i++) {
    if (W.tiles.liquid[i] > WATER_DEPTH.SURFACE || W.tiles.temperature[i] < 0) continue;
    const m = tileMoisture(i);
    if (land < 0 && m > 50 && W.tiles.chem[C.SOLVENT][i] > 20) land = i;
    if (dryLand < 0 && m < 40) dryLand = i;
  }
  if (land >= 0) {
    const m = tileMoisture(land);
    out.wet = breatheSurfaceWater(land, "Clear");
    if (out.wet !== 1 + Math.floor((m - 50) / 10)) fail("wet ground did not breathe by its moisture: " + out.wet + " at " + m);
  } else out.wet = "no wet ground on this world";
  if (dryLand >= 0) {
    out.dry = breatheSurfaceWater(dryLand, "Clear");
    if (out.dry !== 0) fail("dry ground breathed: " + out.dry);
  }
  // The land cools to its climate: a tile a hundred tenths above cools five a pass, one forty below warms two, one at its climate holds.
  ensureClimateBaseline(W);
  const ct = land >= 0 ? land : 0, cBase = W.tiles.climateBase[ct] + (W.tiles.seasonOffset ? W.tiles.seasonOffset[ct] : 0), cKeep = W.tiles.temperature[ct];
  W.tiles.temperature[ct] = cBase + 100;
  out.coolHot = coolTileToClimate(ct);
  if (out.coolHot !== 5 || W.tiles.temperature[ct] !== cBase + 95) fail("a hot tile did not cool a twentieth: " + out.coolHot + " to " + (W.tiles.temperature[ct] - cBase));
  W.tiles.temperature[ct] = cBase - 40;
  out.coolCold = coolTileToClimate(ct);
  if (out.coolCold !== -2 || W.tiles.temperature[ct] !== cBase - 38) fail("a cold tile did not warm a twentieth: " + out.coolCold);
  W.tiles.temperature[ct] = cBase;
  out.coolHeld = coolTileToClimate(ct);
  if (out.coolHeld !== 0) fail("a tile at its climate moved: " + out.coolHeld);
  W.tiles.temperature[ct] = cKeep;
  // Nutrient above a body's reserve goes back to the ground it stands on: a person at 340 passes six a call, one at 200 nothing.
  const eater = W.activeIds.find((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && W.components.chemistry[id] && W.components.position[id]);
  if (eater) {
    const eq = W.components.chemistry[eater].q, ep = W.components.position[eater], eti = idx(ep.x, ep.y), nKeep = eq[C.NUTRIENT], tileBefore = tileMatterAmount(eti, C.NUTRIENT);
    W.conservation.playerInput += 340 - nKeep;
    eq[C.NUTRIENT] = 340;
    out.passed = passSurplusNutrient(eater, W.components.chemistry[eater], eti, 1);
    if (out.passed !== 6 || eq[C.NUTRIENT] !== 334 || tileMatterAmount(eti, C.NUTRIENT) !== tileBefore + 6) fail("a full body did not pass six nutrient to its tile: " + out.passed);
    eq[C.NUTRIENT] = 200;
    W.conservation.playerInput -= 134;
    out.passedModest = passSurplusNutrient(eater, W.components.chemistry[eater], eti, 1);
    if (out.passedModest !== 0) fail("a body under its reserve passed nutrient: " + out.passedModest);
    W.conservation.playerInput -= 200 - nKeep + 6;
    eq[C.NUTRIENT] = nKeep;
    setTileMatterAmount(eti, C.NUTRIENT, tileBefore);
  }
  if (auditMatter().delta !== delta0) fail("the breath made or lost matter: " + (auditMatter().delta - delta0));
  // The sky is deep (17): a tile below the world's starting air draws oxidant from the reservoir when the
  // substrate breathes it, the reservoir falls by the same, and the audit holds.
  ensureSky(W);
  const skyTile = idx(Math.floor(W.width / 2), Math.floor(W.height / 2)), base = W.skyBaseline.oxidant;
  const had = W.tiles.chem[C.OXIDANT][skyTile], taken = Math.min(had, base);
  W.tiles.chem[C.OXIDANT][skyTile] = u16(had - taken); W.conservation.playerInput -= taken;
  const reservoirBefore = W.reservoirs.atmosphericOxidant;
  breatheSky(skyTile);
  out.sky = { base, had, taken, drawn: W.tiles.chem[C.OXIDANT][skyTile] - (had - taken), reservoirDrop: reservoirBefore - W.reservoirs.atmosphericOxidant, audit: auditMatter().delta };
  if (!(out.sky.drawn > 0) || out.sky.drawn !== out.sky.reservoirDrop || out.sky.audit !== 0) fail("the sky did not give the tile its air back: " + JSON.stringify(out.sky));
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
const result = sandbox.window.ALIFE_WATER_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_WATER_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
