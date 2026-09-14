// Irrigation smoke: a town that knows a water craft carries water from surface
// water onto its dry, tended fields; the water moves and is not made; a source
// is never drawn below what its own depth accounts for; a town without the
// craft, or a field nobody has tended, gets nothing; and drawing the fields
// never writes the world.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const irr = window.ALIFE_IRRIGATION_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let town = null;
  for (let attempt = 0; attempt < 4 && !town; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    town = W.settlements.find((s) => !s.ruined);
    if (!town) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); town = W.settlements.find((s) => !s.ruined); } }
  }
  if (!town) { fail("no settlement"); return out; }
  // A finished farm with a sown field beside a lake we dig ourselves, booking
  // the water we set down as player input so the audit stays honest.
  const farm = planBuilding(town, "farm", 9) || W.buildings.find((b) => b.type === "farm" && b.placeId === town.id && !b.ruined);
  if (!farm) { fail("no farm could be planned"); return out; }
  farm.complete = true; farm.stage = 6; farm.integrity = farm.maxIntegrity; farm.completedTick = W.tick;
  for (const [sp, n] of farm.requirements || []) farm.composition[sp] = n;
  const field = cultivatedField(farm);
  if (!field) { fail("the farm has no field"); return out; }
  const tiles = field.tiles?.length ? field.tiles : [field.tile];
  // Dry the field: move its water onto one far tile so nothing is created or lost.
  const sink = idx(1, 1);
  let parked = 0;
  for (const t of tiles) {
    const s = W.tiles.chem[C.SOLVENT][t], keep = Math.floor(W.tiles.liquid[t] * 0.55) + 9;
    const move = Math.max(0, s - keep);
    W.tiles.chem[C.SOLVENT][t] -= move; parked += move;
  }
  W.tiles.chem[C.SOLVENT][sink] += Math.min(parked, 65535 - W.tiles.chem[C.SOLVENT][sink]);
  out.dryBefore = tiles.filter((t) => tileMoisture(t) <= 16).length;
  if (!(out.dryBefore >= tiles.length - 1)) fail("could not dry the field: " + out.dryBefore + "/" + tiles.length);
  // A lake beside it. Digging one is player-created matter and is booked as such.
  const [fx, fy] = xy(field.tile), lakeX = Math.min(W.width - 2, fx + 2), lakeY = fy, lake = idx(lakeX, lakeY);
  const lakeSolventBefore = W.tiles.chem[C.SOLVENT][lake];
  W.tiles.liquid[lake] = WATER_DEPTH.SHALLOW + 40;
  W.tiles.chem[C.SOLVENT][lake] = W.tiles.liquid[lake] + 1500;
  W.conservation.playerInput += W.tiles.chem[C.SOLVENT][lake] - lakeSolventBefore;
  const spareBefore = irr.spare(lakeX, lakeY);
  if (!(spareBefore >= 1500)) fail("the lake has nothing to spare: " + spareBefore);
  // A channel draws from the whole shore in reach, so conservation is checked
  // against every source within it, not the one lake we dug.
  const shore = () => { let n = 0; for (let dy = -12; dy <= 12; dy++) for (let dx = -12; dx <= 12; dx++) if (inside(fx + dx, fy + dy)) n += irr.spare(fx + dx, fy + dy); return n; };
  const shoreBefore = shore();
  // The craft and the care.
  town.knownProcesses = [...new Set([...town.knownProcesses, "irrigation"])];
  field.lastLaborTick = W.tick;
  if (!irr.irrigates(town.id)) fail("a town that knows irrigation does not irrigate");
  const audit = auditMatter().delta, fieldWaterBefore = tiles.reduce((n, t) => n + W.tiles.chem[C.SOLVENT][t], 0),
    moistBefore = tiles.reduce((n, t) => n + tileMoisture(t), 0) / tiles.length;
  irr.reset();
  irr.pass();
  out.counts = irr.counts();
  const fieldWaterAfter = tiles.reduce((n, t) => n + W.tiles.chem[C.SOLVENT][t], 0),
    gained = fieldWaterAfter - fieldWaterBefore, shoreLost = shoreBefore - shore();
  out.gained = gained; out.shoreLost = shoreLost;
  if (!(gained > 0)) fail("the dry field got no water: " + gained);
  if (gained !== shoreLost) fail("water was made or lost on the way: field +" + gained + ", shore -" + shoreLost);
  if (auditMatter().delta !== audit) fail("irrigation changed total matter: " + audit + " -> " + auditMatter().delta);
  if (!(out.counts.moved === gained)) fail("the tally does not match the water moved: " + out.counts.moved + " vs " + gained);
  // One bucket a tile a pass is a trickle: moisture rises, it does not jump.
  out.moist = [+moistBefore.toFixed(1), +(tiles.reduce((n, t) => n + tileMoisture(t), 0) / tiles.length).toFixed(1)];
  if (!(out.moist[1] > out.moist[0])) fail("a pass did not raise the field's moisture: " + out.moist.join(" -> "));
  // Kept up, the trickle brings every tile out of dry — and the lake is drawn
  // to exactly what its depth accounts for, never past it.
  for (let n = 0; n < 60; n++) irr.pass();
  out.dryAfter = tiles.filter((t) => tileMoisture(t) <= 16).length;
  if (out.dryAfter !== 0) fail("tiles still dry after a season of watering: " + out.dryAfter + "/" + tiles.length);
  out.lakeFloor = W.tiles.chem[C.SOLVENT][lake] - W.tiles.liquid[lake];
  if (out.lakeFloor < 0) fail("the lake was drawn below its depth: " + out.lakeFloor);
  // Nor is any other tile on the shore: solvent never falls under depth anywhere in reach.
  let underDepth = 0;
  for (let dy = -12; dy <= 12; dy++) for (let dx = -12; dx <= 12; dx++) {
    if (!inside(fx + dx, fy + dy)) continue;
    const i = idx(fx + dx, fy + dy);
    if (W.tiles.liquid[i] > WATER_DEPTH.SURFACE && W.tiles.chem[C.SOLVENT][i] < W.tiles.liquid[i]) underDepth++;
  }
  out.underDepth = underDepth;
  if (underDepth) fail("a source on the shore was drawn below its depth: " + underDepth + " tiles");
  // A field nobody tended is not watered, and a town without the craft does nothing.
  for (const t of tiles) { const s = W.tiles.chem[C.SOLVENT][t], keep = Math.floor(W.tiles.liquid[t] * 0.55) + 9, mv = Math.max(0, s - keep); W.tiles.chem[C.SOLVENT][t] -= mv; W.tiles.chem[C.SOLVENT][sink] += Math.min(mv, 65535 - W.tiles.chem[C.SOLVENT][sink]); }
  W.tiles.chem[C.SOLVENT][lake] = W.tiles.liquid[lake] + 1500; W.conservation.playerInput += 1500 - out.lakeFloor;
  field.lastLaborTick = -1e9;
  irr.reset(); irr.pass();
  out.untendedMoved = irr.counts().moved;
  if (out.untendedMoved !== 0) fail("an untended field was watered: " + out.untendedMoved);
  field.lastLaborTick = W.tick;
  town.knownProcesses = town.knownProcesses.filter((t) => !["irrigation", "waterworks", "chemistry"].includes(t));
  irr.reset(); irr.pass();
  out.craftlessMoved = irr.counts().moved;
  if (out.craftlessMoved !== 0) fail("a town without a water craft irrigated: " + out.craftlessMoved);
  // Drawing never writes.
  const hash = worldHash();
  window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "iso", quality: "high", zoom: 4, x: fx, y: fy, now: 5000 });
  if (worldHash() !== hash) fail("drawing the fields changed the world");
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "dry-1", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_IRRIGATION_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_IRRIGATION_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
