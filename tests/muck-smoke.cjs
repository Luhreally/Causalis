// Muck smoke: a farming town whose fields have fallen under a fertility of
// thirty carts nutrient and waste from the richest bare tiles of its own
// ground onto the poorest field tiles, as much as its people can carry a pass;
// the move is tile to tile and the matter audit stays at nought; a field
// already fertile and a town without agriculture move nothing; the tick's pass
// carts nothing before a ship has left and carts behind one; and reading the
// fields never writes the world.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const muck = window.ALIFE_MUCK_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let s = null;
  for (let attempt = 0; attempt < 4 && !s; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    s = W.settlements.find((x) => !x.ruined);
    if (!s) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); s = W.settlements.find((x) => !x.ruined); } }
  }
  if (!s) { fail("no settlement"); return out; }
  const finish = (bld) => { if (bld) { bld.complete = true; bld.stage = 6; bld.integrity = bld.maxIntegrity; bld.completedTick = W.tick; for (const [sp, n] of bld.requirements || []) { W.conservation.playerInput += Math.max(0, n - (bld.composition[sp] || 0)); bld.composition[sp] = n; } } return bld; };
  if (!s.knownProcesses.includes("agriculture")) s.knownProcesses.push("agriculture");
  let farm = W.buildings.find((b) => !b.ruined && b.complete && b.placeKind === "settlement" && b.placeId === s.id && b.type === "farm");
  if (!farm) farm = finish(planBuilding(s, "farm", 9) || W.buildings.find((b) => !b.ruined && b.placeKind === "settlement" && b.placeId === s.id && b.type === "farm"));
  if (!farm) { fail("could not raise a farm"); return out; }
  cultivatedField(farm);
  const fields = muck.fields(s.id);
  if (!fields.length) { fail("the farm has no field tiles"); return out; }
  // Everyone calls the town home and stands by the hall, so the town has hands.
  const people = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && W.components.social[id] && W.components.position[id]);
  for (const id of people) { const soc = W.components.social[id], p = W.components.position[id]; soc.homePlaceKind = "settlement"; soc.homePlaceId = s.id; p.x = clamp(s.x + (id % 3) - 1, 0, W.width - 1); p.y = clamp(s.y + ((id >> 2) % 3) - 1, 0, W.height - 1); }
  rebuildSpatialBins();
  W.tick++;
  const hands = granaryResidents(s).length;
  if (!hands) { fail("the town has no residents to cart the muck"); return out; }
  // Poor fields, a rich town: nutrient drawn down on the fields and piled on bare ground round the hall.
  const fieldTiles = new Set(fields.map((f) => f.tile)), reach = hearthReach(s), rich = [];
  for (let y = Math.max(0, s.y - reach); y <= Math.min(W.height - 1, s.y + reach); y++)
    for (let x = Math.max(0, s.x - reach); x <= Math.min(W.width - 1, s.x + reach); x++) {
      const i = idx(x, y);
      if (fieldTiles.has(i) || W.tiles.liquid[i] > WATER_DEPTH.SURFACE || dist2(x, y, s.x, s.y) > reach * reach) continue;
      rich.push(i);
    }
  if (rich.length < 4) { fail("no town ground to draw from"); return out; }
  const total = () => { let n = 0; for (let i = 0; i < W.tileCount; i++) n += W.tiles.chem[C.NUTRIENT][i] + W.tiles.chem[C.WASTE][i]; return n; };
  const auditBefore = auditMatter().delta, totalBefore = total();
  // Move matter within the world so the audit is untouched: the fields down to 100 and the far
  // corners of the map down by 300 apiece, all of it piled on the first four tiles round the hall.
  const richSet = new Set(rich);
  let pool = 0, wastePool = 0;
  for (const t of fieldTiles) { const q = W.tiles.chem[C.NUTRIENT][t]; if (q > 100) { pool += q - 100; W.tiles.chem[C.NUTRIENT][t] = 100; } }
  for (let i = 0; i < W.tileCount && pool < 8000; i++) {
    if (fieldTiles.has(i) || richSet.has(i)) continue;
    const [x, y] = xy(i);
    if (dist2(x, y, s.x, s.y) <= (reach + 2) * (reach + 2)) continue;
    const q = W.tiles.chem[C.NUTRIENT][i], take = Math.min(300, q);
    pool += take; W.tiles.chem[C.NUTRIENT][i] -= take;
    const w = W.tiles.chem[C.WASTE][i], tw = Math.min(20, w); wastePool += tw; W.tiles.chem[C.WASTE][i] -= tw;
  }
  // Bare ground: the muck is carted from streets and yards, not from ground that grows.
  const orders = rich.slice(0, 4).map((i) => [i, W.tiles.plantOrder[i]]);
  for (const [i] of orders) W.tiles.plantOrder[i] = 0;
  for (const i of rich.slice(0, 4)) {
    const room = 65535 - 2000 - W.tiles.chem[C.NUTRIENT][i], add = Math.min(room, Math.ceil(pool / 4));
    W.tiles.chem[C.NUTRIENT][i] += Math.min(add, pool); pool -= Math.min(add, pool);
    const wadd = Math.min(wastePool, 60); W.tiles.chem[C.WASTE][i] += wadd; wastePool -= wadd;
  }
  if (pool > 0) W.tiles.chem[C.NUTRIENT][rich[0]] += pool;
  if (wastePool > 0) W.tiles.chem[C.WASTE][rich[0]] += wastePool;
  if (total() !== totalBefore) fail("the test's own shuffle changed the tile total: " + totalBefore + " -> " + total());
  out.before = muck.fields(s.id).map((f) => f.fertility);
  if (!out.before.every((f) => f < 30)) fail("the fields were not made poor: " + JSON.stringify(out.before));
  const hashBefore = worldHash();
  muck.fields(s.id);
  if (worldHash() !== hashBefore) fail("reading the fields wrote the world");
  // The tick's pass carts nothing before a ship has left.
  W.tick += (16 + (s.id % 16) - (W.tick % 16)) % 16;
  const moved0 = muck.counts().moved;
  muck.pass();
  out.passBeforeShip = muck.counts().moved - moved0;
  if (out.passBeforeShip !== 0) fail("the muck was carted before any ship had left: " + out.passBeforeShip);
  W.ascensions.push({ id: 1, settlementId: s.id, factionId: s.factionId || 0, buildingId: 0, tile: idx(s.x, s.y), tick: W.tick, eventId: 0, first: true });
  const fieldNutBefore = fields.reduce((n, f) => n + W.tiles.chem[C.NUTRIENT][f.tile] + W.tiles.chem[C.WASTE][f.tile], 0);
  muck.pass();
  out.moved = muck.counts().moved - moved0;
  const fieldNutAfter = fields.reduce((n, f) => n + W.tiles.chem[C.NUTRIENT][f.tile] + W.tiles.chem[C.WASTE][f.tile], 0);
  out.fieldGain = fieldNutAfter - fieldNutBefore;
  out.hands = hands;
  if (!(out.moved > 0)) fail("nothing was carted to the poor fields behind the ship");
  if (out.fieldGain !== out.moved) fail("the fields did not gain what was moved: " + out.fieldGain + " vs " + out.moved);
  if (out.moved > Math.min(600, hands * 24)) fail("more was carted than the hands could carry: " + out.moved + " with " + hands + " hands");
  if (total() !== totalBefore) fail("the muck made or lost matter: " + totalBefore + " -> " + total());
  out.after = muck.fields(s.id).map((f) => f.fertility);
  if (!out.after.some((f, i) => f > out.before[i])) fail("no field grew more fertile: " + JSON.stringify(out.before) + " -> " + JSON.stringify(out.after));
  out.audit = auditMatter().delta - auditBefore;
  if (out.audit !== 0) fail("the matter audit moved: " + out.audit);
  // A field already fertile is left alone.
  for (const t of fieldTiles) W.tiles.chem[C.NUTRIENT][t] += 3000;
  W.tiles.chem[C.NUTRIENT][rich[0]] = Math.max(0, W.tiles.chem[C.NUTRIENT][rich[0]] - 3000 * fieldTiles.size);
  out.movedRich = muck.run(s.id);
  if (out.movedRich !== 0) fail("a fertile field was still carted to: " + out.movedRich);
  for (const t of fieldTiles) W.tiles.chem[C.NUTRIENT][t] = Math.max(0, W.tiles.chem[C.NUTRIENT][t] - 3000);
  // A town that has not learned agriculture carts nothing.
  const known = s.knownProcesses.slice();
  s.knownProcesses = known.filter((k) => k !== "agriculture");
  out.movedUnlearned = muck.run(s.id);
  if (out.movedUnlearned !== 0) fail("a town without agriculture carted muck: " + out.movedUnlearned);
  s.knownProcesses = known;
  W.ascensions.pop();
  for (const [i, o] of orders) W.tiles.plantOrder[i] = o;
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_MUCK_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_MUCK_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
