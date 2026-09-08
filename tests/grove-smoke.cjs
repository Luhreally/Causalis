// Grove smoke: on the Earth-like seed the canopy carries several species
// chosen by the ground, trees are drawn as species in both lenses without
// touching the world, leaves turn in the fall, highland features are drawn as
// crags, ground marks and cliff strata appear at a close camera; on an alien
// seed the plain canopies split between the old crown and new forms.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const grove = window.ALIFE_GROVE_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  for (let i = 0; i < 32; i++) simTick();
  const clean = (opts) => { const h0 = worldHash(); window.ALIFE_VISUAL_DEBUG.renderOnly(opts); if (worldHash() !== h0) fail("drawing the grove changed the world (" + opts.view + ")"); };
  // Species by the ground.
  out.species = grove.speciesCounts();
  const kinds = Object.keys(out.species);
  if (!(kinds.length >= 3)) fail("the canopy has too few species: " + kinds.join(","));
  const canopy = [];
  for (let i = 0; i < W.tileCount; i++) if (W.tiles.featureType?.[i] === TERRAIN_FEATURE.CANOPY) canopy.push(i);
  if (!canopy.length) { fail("no canopy to draw"); return out; }
  const ci = canopy[Math.floor(canopy.length / 2)], cx = ci % W.width, cy = Math.floor(ci / W.width);
  if (grove.species(ci) !== grove.species(ci)) fail("species are not deterministic");
  // Drawn as species in both lenses.
  grove.reset();
  clean({ view: "iso", quality: "high", zoom: 4, x: cx, y: cy, now: 5000 });
  out.iso = grove.counts();
  grove.reset();
  clean({ view: "top", quality: "high", zoom: 4, x: cx, y: cy, now: 5100 });
  out.top = grove.counts();
  if (!(out.iso.trees >= 1) || !(out.top.trees >= 1)) fail("trees were not drawn as species: " + out.iso.trees + "/" + out.top.trees);
  if (!(out.iso.marks + out.top.marks >= 1)) fail("no ground marks were drawn");
  // Leaves turn in the fall.
  const keepTick = W.tick;
  const year = W.tick - (W.tick % TICKS_PER_YEAR) + TICKS_PER_YEAR;
  let fallTick = year, best = -1, summerTick = year, least = 2;
  for (let t = year; t < year + TICKS_PER_YEAR; t += 4) { W.tick = t; const s = grove.season(cx, cy); if (s.fall > best) { best = s.fall; fallTick = t; } if (s.fall < least) { least = s.fall; summerTick = t; } }
  W.tick = summerTick;
  const green = grove.leaf("broadleaf", cx, cy, ci);
  W.tick = fallTick;
  const turned = grove.leaf("broadleaf", cx, cy, ci);
  W.tick = keepTick;
  out.leaves = { green: green.hue, turned: turned.hue, fall: best };
  if (best > 0.5 && Math.abs(turned.hue - green.hue) < 5) fail("the leaves do not turn in the fall: " + JSON.stringify(out.leaves));
  // Crags where the land has highland features.
  let hi = -1;
  for (let i = 0; i < W.tileCount; i++) if (W.tiles.featureType?.[i] === TERRAIN_FEATURE.HIGHLAND) { hi = i; break; }
  if (hi >= 0) {
    grove.reset();
    clean({ view: "iso", quality: "high", zoom: 3, x: hi % W.width, y: Math.floor(hi / W.width), now: 5200 });
    out.crags = grove.counts().crags;
    const spec = featureSpecAt(hi);
    if (spec && spec.form !== "mesa" && spec.form !== "arch" && !(out.crags >= 1)) fail("highland features are not drawn as crags");
  } else out.crags = "no highland";
  // Cliff strata at a close camera, where the land steps.
  let steep = -1, bestStep = 0;
  for (let i = 0; i < W.tileCount; i++) { const x = i % W.width; if (x >= W.width - 1) continue; const d = W.tiles.elevation[i] - W.tiles.elevation[i + 1]; if (d > bestStep && W.tiles.liquid[i] <= 140) { bestStep = d; steep = i; } }
  grove.reset();
  clean({ view: "iso", quality: "high", zoom: 6, x: steep % W.width, y: Math.floor(steep / W.width), now: 5300 });
  out.strata = grove.counts().strata;
  out.steepest = bestStep;
  if (bestStep > 120 && !(out.strata >= 1)) fail("tall cliffs show no strata");
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const alienSource = String.raw`(() => {
  const grove = window.ALIFE_GROVE_DEBUG, out = { failures: [] };
  for (let i = 0; i < 16; i++) simTick();
  const canopy = [];
  for (let i = 0; i < W.tileCount; i++) if (W.tiles.featureType?.[i] === TERRAIN_FEATURE.CANOPY) canopy.push(i);
  if (!canopy.length) { out.note = "no canopy"; return out; }
  const h0 = worldHash();
  grove.reset();
  for (const ci of canopy.slice(0, 6)) window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "iso", quality: "high", zoom: 3, x: ci % W.width, y: Math.floor(ci / W.width), now: 6000 });
  if (worldHash() !== h0) out.failures.push("drawing alien canopies changed the world");
  out.counts = grove.counts();
  if (out.counts.trees > 0) out.failures.push("an alien world grew Earth species");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "causal-origin", size: "small" });
const result = sandbox.window.ALIFE_GROVE_TEST.run();
for (const f of result.failures) failures.push(f);
game.createTestWorld({ seed: "x3", size: "small" });
const alien = sandbox.window.ALIFE_GROVE_TEST.alien();
for (const f of alien.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result, alien }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_GROVE_TEST=Object.freeze({run:()=>${fixtureSource},alien:()=>${alienSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
