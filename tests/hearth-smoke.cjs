// Hearth smoke: a town's reach is two tiles past its farthest finished
// building, never under eight nor over twenty-four; a resident standing
// fourteen tiles from the hall is fed from home once the town has built out
// that far, and not before; the meal moves rations from the store into the
// eater; a stranger's meal is judged as before; and reading the reach never
// writes the world.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const hearth = window.ALIFE_HEARTH_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let s = null;
  for (let attempt = 0; attempt < 4 && !s; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    s = W.settlements.find((x) => !x.ruined);
    if (!s) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); s = W.settlements.find((x) => !x.ruined); } }
  }
  if (!s) { fail("no settlement"); return out; }
  const a = W.activeIds.find((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && W.components.social[id] && W.components.position[id] && W.components.inventory[id]?.digestive);
  if (!a) { fail("nobody to feed"); return out; }
  const soc = W.components.social[a], p = W.components.position[a];
  soc.homePlaceKind = "settlement"; soc.homePlaceId = s.id;
  const grant = 300;
  s.inventory[C.ORGANIC] = (s.inventory[C.ORGANIC] || 0) + grant;
  W.conservation.playerInput += grant;
  // Every other store is emptied so the only meal in reach is the home one.
  const emptied = [];
  for (const t of W.settlements) if (t !== s && t.inventory) { emptied.push([t, t.inventory[C.ORGANIC] || 0]); t.inventory[C.ORGANIC] = 0; }
  // The hall's buildings drawn in close: the reach is the floor of eight.
  const mine = W.buildings.filter((b) => b.placeKind === "settlement" && b.placeId === s.id && b.complete && !b.ruined);
  const saved = mine.map((b) => [b, b.x, b.y]);
  for (const b of mine) { b.x = s.x; b.y = s.y; }
  W.tick++;
  out.reachClose = hearth.reach(s.id);
  if (out.reachClose !== 8) fail("a town built round its hall does not reach eight: " + out.reachClose);
  // A resident fourteen tiles out, with nothing built that far, is not fed from home.
  const dx = s.x + 14 < W.width ? 14 : -14;
  p.x = s.x + dx; p.y = s.y;
  out.farBefore = homeRationPlace(a)?.id || 0;
  if (out.farBefore === s.id) fail("a resident fourteen tiles from a village hall was fed from home");
  // The town builds out to thirteen tiles: the reach follows.
  if (!mine.length) fail("the town has no finished building to move");
  else { mine[0].x = s.x + (dx > 0 ? 13 : -13); mine[0].y = s.y; }
  W.tick++;
  out.reachBuilt = hearth.reach(s.id);
  if (out.reachBuilt !== 15) fail("a town built out to thirteen tiles does not reach fifteen: " + out.reachBuilt);
  const before = worldHash();
  hearth.reach(s.id);
  if (worldHash() !== before) fail("reading the reach wrote the world");
  out.farAfter = homeRationPlace(a)?.id || 0;
  if (out.farAfter !== s.id) fail("a resident fourteen tiles out is not fed from home once the town reaches him: " + out.farAfter);
  // The meal moves rations from the store into the eater.
  // On bare ground, so the mouthful cannot come from underfoot.
  const digestive = W.components.inventory[a].digestive, ateBefore = digestive[C.ORGANIC], storeBefore = s.inventory[C.ORGANIC], tile = idx(p.x, p.y),
    ground = [W.tiles.chem[C.ORGANIC][tile], W.tiles.chem[C.ENERGY][tile], W.tiles.plantOrder[tile]];
  W.tiles.chem[C.ORGANIC][tile] = 0; W.tiles.chem[C.ENERGY][tile] = 0; W.tiles.plantOrder[tile] = 0;
  W.components.life[a].hunger = 90;
  out.fed = performFeeding(a, tile, 1);
  out.moved = [digestive[C.ORGANIC] - ateBefore, storeBefore - s.inventory[C.ORGANIC]];
  [W.tiles.chem[C.ORGANIC][tile], W.tiles.chem[C.ENERGY][tile], W.tiles.plantOrder[tile]] = ground;
  if (!out.fed || out.moved[0] <= 0 || out.moved[0] !== out.moved[1]) fail("the meal did not move rations from the store to the eater: " + JSON.stringify(out.moved));
  // A stranger to the town is judged as before.
  soc.homePlaceId = s.id + 1000;
  out.stranger = homeRationPlace(a)?.id || 0;
  if (out.stranger === s.id) fail("a stranger fourteen tiles out was fed from a town he does not belong to");
  soc.homePlaceId = s.id;
  // Twenty-four is the ceiling.
  if (mine.length) { mine[0].x = clamp(s.x + (dx > 0 ? 40 : -40), 0, W.width - 1); }
  W.tick++;
  out.reachCeiling = hearth.reach(s.id);
  if (out.reachCeiling > 24) fail("the reach passed twenty-four: " + out.reachCeiling);
  for (const [b, x, y] of saved) { b.x = x; b.y = y; }
  for (const [t, n] of emptied) t.inventory[C.ORGANIC] = n;
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_HEARTH_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_HEARTH_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
