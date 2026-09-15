// Ferry smoke: when no land path joins two towns, a road link is begun along
// the sea road and marked ferried; when a land path exists the link is the old
// one; the ferried link's completion is chronicled with the crossing left to
// the boats; and reading the counts writes nothing.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const ferry = window.ALIFE_FERRY_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let s = null;
  for (let attempt = 0; attempt < 4 && !s; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    s = W.settlements.find((x) => !x.ruined);
    if (!s) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); s = W.settlements.find((x) => !x.ruined); } }
  }
  if (!s) { fail("no settlement"); return out; }
  if (!s.factionId) createFaction(s.id);
  const f = W.factions.find((x) => x.id === s.factionId);
  if (!f) { fail("no polity"); return out; }
  if (typeof ensureRoads === "function") ensureRoads();
  // A second town across the water: a stand-in far enough away, on the same map.
  const bx = clamp(s.x + 20 < W.width ? s.x + 20 : s.x - 20, 1, W.width - 2), by = s.y;
  const b = { id: 99001, name: "Farshore", x: bx, y: by, factionId: s.factionId, entityId: s.entityId, ruined: false, inventory: new Uint16Array(SPECIES_COUNT), knownProcesses: ["road_building"] };
  // The pathfinder, held: no land between the two, a sea road across.
  const saved = civilPathFind;
  const line = []; for (let x = Math.min(s.x, bx); x <= Math.max(s.x, bx); x++) line.push(idx(x, by));
  civilPathFind = (seed, target, factionId, mode = "land") => (mode === "sea" ? line.slice() : []);
  const before = W.roads.links.length, countsBefore = ferry.counts().links;
  const link = startRoadLink(f, s, b, "road");
  out.ferriedLink = link ? { ferried: !!link.ferried, tiles: link.path.length, kind: link.kind } : null;
  if (!link) fail("no link was begun across the water");
  else {
    if (!link.ferried) fail("the link across the water is not marked ferried");
    if (link.path.length !== line.length) fail("the link did not take the sea road: " + link.path.length + " tiles");
    if (W.roads.links.length !== before + 1) fail("the link was not recorded");
  }
  if (ferry.counts().links !== countsBefore + 1) fail("the ferry count did not move");
  // With land between, the link is the old one, not ferried.
  civilPathFind = (seed, target, factionId, mode = "land") => (mode === "land" ? line.slice() : []);
  const landLink = startRoadLink(f, s, { ...b, id: 99002 }, "road");
  out.landLink = landLink ? { ferried: !!landLink.ferried, tiles: landLink.path.length } : null;
  if (!landLink || landLink.ferried) fail("a link with land between was ferried or missing");
  civilPathFind = saved;
  // The chronicle names the crossing.
  if (link) {
    W.settlements.push(b);
    const ev = roadEventFor(link, s, b);
    out.sentence = eventSentence(ev);
    if (!/left to the boats/.test(out.sentence)) fail("the ferried road's sentence does not name the crossing: " + out.sentence);
    W.settlements.pop();
  }
  const hash = worldHash();
  ferry.counts();
  if (worldHash() !== hash) fail("reading the counts wrote the world");
  // Leave the world as it was.
  W.roads.links.length = before;
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_FERRY_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_FERRY_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
