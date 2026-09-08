// Granary-call smoke: a hungry person on barren ground beyond the ration ring
// of a town whose stores hold food steps toward that town when seeking food;
// with an empty store, food underfoot, or the town within reach of its rations
// the call is silent and the old foraging step stands.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const call = window.ALIFE_GRANARY_CALL_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let s = null;
  for (let attempt = 0; attempt < 4 && !s; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    s = W.settlements.find((x) => !x.ruined);
    if (!s) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); s = W.settlements.find((x) => !x.ruined); } }
  }
  if (!s) { fail("no settlement"); return out; }
  if (!s.factionId) createFaction(s.id);
  const topUp = (sp, n) => { const want = n - (s.inventory[sp] || 0); if (want > 0) { s.inventory[sp] += want; W.conservation.playerInput += want; } };
  s.storageCapacity = Math.max(s.storageCapacity || 150, placeStorageUsed(s) + 200);
  topUp(C.ORGANIC, 60);
  // A hungry person fourteen tiles out on bare ground, with the town as home.
  const dx = s.x + 14 < W.width - 3 ? 14 : -14, px = clamp(s.x + dx, 2, W.width - 3), py = clamp(s.y, 2, W.height - 3);
  const id = createOrganism(KINDS.PERSON, px, py, makeRng(hashParts(W.seedHash, "granary-call", 1), "birth"), []);
  if (!id) { fail("no person"); return out; }
  const soc = W.components.social[id], p = W.components.position[id], q = W.components.chemistry[id].q;
  soc.homePlaceKind = "settlement"; soc.homePlaceId = s.id; soc.factionId = s.factionId;
  p.x = px; p.y = py; rebuildSpatialBins();
  { const want = 400 - q[C.SOLVENT]; if (want > 0) { q[C.SOLVENT] += want; W.conservation.playerInput += want; } }
  { const spare = q[C.ENERGY] - 100; if (spare > 0) { q[C.ENERGY] -= spare; W.conservation.playerInput -= spare; } }
  derivedLife(id);
  out.hunger = Math.round(W.components.life[id].hunger);
  if (!(out.hunger >= 60)) fail("the person is not hungry: " + out.hunger);
  const here = idx(px, py), ground = tileMatterAmount(here, C.ORGANIC);
  setTileMatterAmount(here, C.ORGANIC, 0); W.conservation.playerInput -= ground;
  out.tileFood = tileFood(here, "omnivore");
  out.place = call.place(id);
  if (out.place !== s.id) fail("the call names no fed town for a hungry person on bare ground: " + out.place);
  out.step = call.step(id);
  const dir = bestDirection(id, "food");
  out.dir = dir;
  const before = dist2(px, py, s.x, s.y), after = dist2(px + dir[0], py + dir[1], s.x, s.y);
  if (!(after < before)) fail("the food step does not shorten the walk home: " + JSON.stringify(dir));
  out.reason = W.components.life[id].behaviorReason || "";
  if (!/stores of/.test(out.reason)) fail("no reason names the stores: " + out.reason);
  out.steps = call.counts().steps;
  // An empty store is silent.
  const kept = s.inventory[C.ORGANIC]; s.inventory[C.ORGANIC] = 0; W.conservation.playerInput -= kept;
  out.emptyPlace = call.place(id);
  if (out.emptyPlace) fail("an empty store still calls");
  s.inventory[C.ORGANIC] = kept; W.conservation.playerInput += kept;
  // Food underfoot is eaten where it lies.
  setTileMatterAmount(here, C.ORGANIC, 80); W.conservation.playerInput += 80;
  out.fedGroundPlace = call.place(id);
  if (out.fedGroundPlace) fail("food underfoot still calls");
  setTileMatterAmount(here, C.ORGANIC, 0); W.conservation.playerInput -= 80;
  // Within the ration ring the call is silent.
  p.x = clamp(s.x + 3, 1, W.width - 2); p.y = s.y; rebuildSpatialBins();
  out.nearPlace = call.place(id);
  if (out.nearPlace) fail("a person within the ration ring is still called");
  // Rations at home whatever flag flies over the hall: a resident under another
  // faction's flag, hungry within the ring, still eats from the home stores.
  soc.factionId = 9999;
  out.home = call.home(id);
  if (out.home !== s.id) fail("the home stores are not open to a resident under another flag: " + out.home);
  { const t = idx(p.x, p.y), g = tileMatterAmount(t, C.ORGANIC); setTileMatterAmount(t, C.ORGANIC, 0); W.conservation.playerInput -= g; }
  const store0 = s.inventory[C.ORGANIC], eaten0 = W.components.inventory[id].digestive[C.ORGANIC];
  out.ateAtHome = performFeeding(id, idx(p.x, p.y), 1);
  out.storeDrop = store0 - s.inventory[C.ORGANIC];
  if (!(out.ateAtHome && out.storeDrop > 0 && W.components.inventory[id].digestive[C.ORGANIC] - eaten0 === out.storeDrop)) fail("the resident under another flag did not eat at home: " + JSON.stringify([out.ateAtHome, out.storeDrop]));
  out.homeReason = W.components.life[id].behaviorReason || "";
  if (!/at home/.test(out.homeReason)) fail("no reason names the home meal: " + out.homeReason);
  soc.factionId = s.factionId;
  // The hub calls no one while its stores are lean.
  const f = W.factions.find((x) => x.id === s.factionId);
  const keep = s.inventory[C.ORGANIC]; s.inventory[C.ORGANIC] = 0; W.conservation.playerInput -= keep;
  out.leanGate = typeof urbanHub === "function" && urbanHub(f) === s ? call.lean(f.id) : "no hub";
  if (out.leanGate === false) fail("an empty hub store does not hold the pull");
  s.inventory[C.ORGANIC] = keep; W.conservation.playerInput += keep;
  out.counts = call.counts();
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_GRANARY_CALL_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_GRANARY_CALL_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
