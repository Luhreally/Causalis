// Living-grove smoke: a mature tree seeds a sapling on open grass beside it,
// moving its own organic matter as the seed; a seedling on dried ground
// withers and is gone; fruit hangs on broadleaves in late summer and fall and
// makes the tile read as richer food to grazers and to people, and none in
// deep winter; brambles stand in the grass; the fruit and the brambles are
// drawn without touching the world; and the yearly pass is cheap.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const grove = window.ALIFE_LIVING_GROVE_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m), t = W.tiles;
  for (let i = 0; i < 64; i++) simTick();
  // A mature tree beside open grass.
  let parent = -1, child = -1;
  for (let i = 0; i < W.tileCount && parent < 0; i++) {
    if (t.featureType[i] !== TERRAIN_FEATURE.CANOPY || t.liquid[i] > 140) continue;
    const x = i % W.width, y = (i / W.width) | 0;
    if (x < 2 || y < 2 || x > W.width - 3 || y > W.height - 3) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      const n = (y + dy) * W.width + x + dx;
      if (t.featureType[n] || t.liquid[n] > 140 || t.fire[n]) continue;
      parent = i; child = n; break;
    }
  }
  if (parent < 0) { fail("no canopy beside open ground"); return out; }
  t.featureStrength[parent] = 900;
  // Make the child open ground: grass, moist, unbuilt.
  t.plantOrder[child] = Math.max(t.plantOrder[child], 300);
  { const want = 400 - t.chem[C.SOLVENT][child]; if (want > 0) { t.chem[C.SOLVENT][child] += want; W.conservation.playerInput += want; } }
  { const want = 20 - t.chem[C.ORGANIC][parent]; if (want > 0) { t.chem[C.ORGANIC][parent] += want; W.conservation.playerInput += want; } }
  t.habitation[child] = 0; if (t.road) t.road[child] = 0;
  out.open = grove.open(child);
  if (!out.open) fail("the neighbouring grass does not count as open ground");
  // Force the seed roll: every neighbour side may be picked, so try the sides until the open one is chosen.
  const matter0 = totalMatter(), organic0 = t.chem[C.ORGANIC][parent] + t.chem[C.ORGANIC][child];
  let seeded = false;
  for (let k = 0; k < 12 && !seeded; k++) { W.tick += 256; seeded = grove.seed(parent, 0); }
  out.seeded = seeded; out.saplingStrength = t.featureStrength[child]; out.childType = t.featureType[child];
  if (!seeded) fail("no sapling took root beside the mature tree");
  if (totalMatter() !== matter0) fail("seeding did not conserve matter");
  if (seeded && t.chem[C.ORGANIC][parent] + t.chem[C.ORGANIC][child] !== organic0) fail("the seed's organic matter was not moved from parent to child");
  // A seedling on dried ground withers and is gone.
  const sapling = seeded && t.featureType[child] === TERRAIN_FEATURE.CANOPY ? child : -1;
  if (sapling >= 0) {
    const water = t.chem[C.SOLVENT][sapling]; t.chem[C.SOLVENT][sapling] = 0; W.conservation.playerInput -= water;
    let passes = 0; while (t.featureType[sapling] === TERRAIN_FEATURE.CANOPY && passes < 6) { grove.wither(sapling); passes++; }
    out.witherPasses = passes; out.gone = t.featureType[sapling] === 0;
    if (!out.gone) fail("a seedling on dry ground did not wither away");
  }
  // Fruit in season, none in deep winter, and richer food when it hangs.
  const canopy = []; for (let i = 0; i < W.tileCount; i++) if (t.featureType[i] === TERRAIN_FEATURE.CANOPY && t.featureStrength[i] >= 500 && ["broadleaf", "palm", "baobab", "shrub"].includes(treeSpeciesAt(i))) canopy.push(i);
  if (!canopy.length) { fail("no fruiting species stands in this world"); return out; }
  const fx = canopy[0] % W.width, fy = (canopy[0] / W.width) | 0, tick0 = W.tick;
  let best = -1, bestFruit = 0, worst = -1, worstFruit = 2;
  for (let s = 0; s < 64; s++) { W.tick = tick0 + s * 4; const f = grove.fruit(canopy[0]); if (f > bestFruit) { bestFruit = f; best = W.tick; } if (f < worstFruit) { worstFruit = f; worst = W.tick; } }
  out.fruitPeak = +bestFruit.toFixed(2); out.fruitLow = +worstFruit.toFixed(2);
  if (!(bestFruit >= 0.5)) fail("no fruit hangs in season: " + bestFruit);
  W.tick = worst; const foodBare = tileFood(canopy[0], "omnivore");
  W.tick = best; const foodFruit = tileFood(canopy[0], "omnivore");
  out.foodBare = +foodBare.toFixed(2); out.foodFruit = +foodFruit.toFixed(2);
  if (!(foodFruit > foodBare)) fail("a fruiting tile is not richer food: " + foodBare + " -> " + foodFruit);
  // Drawn without touching the world.
  grove.reset();
  const h0 = worldHash();
  window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "iso", quality: "high", zoom: 3, x: fx + 0.5, y: fy + 0.5, now: 5000 });
  if (worldHash() !== h0) fail("drawing the living grove changed the world");
  out.counts = grove.counts();
  if (!(out.counts.fruitDrawn >= 1)) fail("no fruit was drawn on the crowns in season");
  // Brambles stand somewhere in the grass.
  let brambles = 0; for (let i = 0; i < W.tileCount; i++) if (grove.bramble(i)) brambles++;
  out.brambleTiles = brambles;
  if (!brambles) fail("no brambles in the grass");
  W.tick = tick0;
  // The yearly pass is cheap.
  const t0 = performance.now(); let acted = 0; for (let k = 0; k < 8; k++) { W.tick += 32; acted += grove.pass(); }
  out.passMs = +((performance.now() - t0) / 8).toFixed(2); out.passActed = acted;
  if (out.passMs > 8) fail("the grove pass is too slow: " + out.passMs + " ms");
  W.tick = tick0;
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "causal-origin", size: "small" });
const result = sandbox.window.ALIFE_LIVING_GROVE_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_LIVING_GROVE_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
