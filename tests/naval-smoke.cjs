// Naval smoke: two polities at war with docks fight a sea battle, the loser's
// dock is battered and its town blockaded so no boat fishes or sails and unrest
// rises, and the blockade lifts when the war ends.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const naval = window.ALIFE_NAVAL_DEBUG, sea = window.ALIFE_SEA_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let settlement = null;
  for (let attempt = 0; attempt < 4 && !settlement; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    settlement = W.settlements.find((s) => !s.ruined);
    if (!settlement) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); settlement = W.settlements.find((s) => !s.ruined); } }
  }
  if (!settlement) { fail("no settlement"); return out; }
  if (!settlement.factionId) createFaction(settlement.id);
  const people = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id));
  let second = W.settlements.find((s) => !s.ruined && s.id !== settlement.id);
  while (!second && people.length) {
    const founder = people.pop();
    let tile = -1;
    for (let tries = 0; tries < 400 && tile < 0; tries++) {
      const x = 4 + ((tries * 37 + 11) % (W.width - 8)), y = 4 + ((tries * 23) % (W.height - 8)), t = idx(x, y);
      if (W.tiles.liquid[t] <= WATER_DEPTH.SURFACE && !campNear(t, 6) && !nearestSettlement(t, 10) && x + 12 < W.width) tile = t;
    }
    if (tile < 0) break;
    const soc = W.components.social[founder];
    if (soc) { soc.homePlaceKind = ""; soc.homePlaceId = 0; soc.factionId = 0; }
    const camp = createCamp(tile, founder);
    if (!camp) continue;
    for (const type of ["stockpile", "shelter", "hearth"]) {
      const b = planBuilding(camp, type, 5) || W.buildings.find((x) => !x.ruined && x.placeKind === "camp" && x.placeId === camp.id && x.type === type);
      if (b) { b.complete = true; b.stage = 6; b.integrity = b.maxIntegrity; b.completedTick = W.tick; }
    }
    second = createSettlement(camp.id);
  }
  if (!second) { fail("no second town"); return out; }
  if (!second.factionId) createFaction(second.id);
  const A = W.factions.find((f) => f.id === settlement.factionId), B = W.factions.find((f) => f.id === second.factionId);
  if (!A || !B || A === B) { fail("two polities were not raised"); return out; }
  // Shores and docks for both towns.
  const setWater = (x, y, depth) => { if (inside(x, y)) { const t = idx(x, y); W.tiles.liquid[t] = depth; W.tiles.fire[t] = 0; if (depth > 0) W.tiles.chem[C.ORGANIC][t] = Math.max(W.tiles.chem[C.ORGANIC][t], 60); } };
  const docks = [];
  for (const town of [settlement, second]) {
    const dir = town.x + 12 < W.width ? 1 : -1;
    for (let dy = -1; dy <= 1; dy++) for (let k = 3; k <= 5; k++) setWater(town.x + dir * k, town.y + dy, 700);
    for (let dy = -3; dy <= 3; dy++) for (let k = 6; k <= 8; k++) setWater(town.x + dir * k, town.y + dy, 1500);
    const dock = sea.planDock(town.id);
    if (!dock) { fail("no dock could be planned for " + town.name); return out; }
    const b = W.buildings.find((x) => x.id === dock.id);
    b.complete = true; b.stage = 6; b.integrity = b.maxIntegrity; b.completedTick = W.tick;
    docks.push(b);
  }
  if (naval.docks(A.id) < 1 || naval.docks(B.id) < 1) fail("the polities do not count their docks");
  // War, then a sea battle.
  const war = window.ALIFE_DIPLOMACY_DEBUG.war(A.id, B.id);
  if (!war) { fail("no war"); return out; }
  const integrityBefore = docks.map((d) => d.integrity);
  const battle = naval.battle(war.id);
  if (!battle) { fail("no sea battle was fought"); return out; }
  out.battle = eventSentence(battle);
  if (!docks.some((d, i) => d.integrity < integrityBefore[i])) fail("no dock was battered");
  if (!(war.seaBattles >= 1)) fail("the war counts no sea battle");
  const blockades = naval.blockades().filter((b) => b.active);
  if (blockades.length !== 1) { fail("expected one blockade, saw " + blockades.length); return out; }
  const blockaded = W.settlements.find((s) => s.id === blockades[0].placeId);
  out.blockade = eventSentence(W.events.find((e) => e.type === "BlockadeEvent"));
  if (startFishing(blockaded).length) fail("a blockaded town still fishes");
  if (launchVoyage(blockaded, false)) fail("a blockaded town still sails");
  const real = W.naval.blockades.find((b) => b.id === blockades[0].id);
  const calm = unrestOf(blockaded);
  real.active = false;
  const free = unrestOf(blockaded);
  real.active = true;
  if (!(calm > free)) fail("a blockade does not raise unrest");
  if (!/Blockaded/.test(window.ALIFE_LEGENDS_DEBUG.render("place", blockaded.id))) fail("the place page does not show the blockade");
  if (!/Sea battles/.test(window.ALIFE_LEGENDS_DEBUG.render("war", war.id))) fail("the war page does not count sea battles");
  // Peace lifts the blockade.
  endWar(war, A, B, "a peace for the test");
  naval.update();
  if (naval.blockades().some((b) => b.active)) fail("the blockade outlived the war");
  const lifted = W.events.find((e) => e.type === "BlockadeLiftedEvent");
  if (!lifted) fail("no BlockadeLiftedEvent"); else out.lifted = eventSentence(lifted);
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_NAVAL_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_NAVAL_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
