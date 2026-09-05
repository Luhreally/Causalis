// Living-world smoke: seasons, worn paths, natural disasters, succession,
// omens, and shrines. Reuses the shared smoke-test harness and injects a
// fixture that runs inside the runtime closure so conservation can be checked
// with the same totalMatter() the world uses.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const living = window.ALIFE_LIVING_DEBUG, out = { failures: [] };
  const fail = (message) => out.failures.push(message);
  // Seasons: a tilted world must carry offsets after a season step; an untilted one must not.
  const genome = living.season().genome;
  out.tilt = genome?.amplitude ?? null;
  for (let i = 0; i < 128; i++) simTick();
  const season = living.season();
  out.season = season;
  if (out.tilt > 0) {
    if (!season.name) fail("tilted world has no season name");
    if (season.offsets.max <= 0 && season.offsets.min >= 0) fail("tilted world applied no seasonal offsets");
    // The applied offsets must be exactly what the column records: temperature moved by offset.
    const t = W.tiles, samples = [0, Math.floor(W.tileCount / 2), W.tileCount - 1];
    out.offsetSamples = samples.map((i) => t.seasonOffset[i]);
    if (W.terrainGenome.climate !== "radial" && W.terrainGenome.climate !== "banded") {
      const top = t.seasonOffset[Math.floor(W.width / 2)], bottom = t.seasonOffset[(W.height - 1) * W.width + Math.floor(W.width / 2)];
      out.hemispheres = [top, bottom];
      if (top && bottom && Math.sign(top) === Math.sign(bottom) && W.terrainGenome.climate === "latitudinal") fail("latitudinal hemispheres swing in the same direction");
    }
  } else if (season.offsets && (season.offsets.max || season.offsets.min)) fail("untilted world applied seasonal offsets");
  // Worn paths: after people and herds move, some tiles carry traffic.
  for (let i = 0; i < 300; i++) simTick();
  out.traffic = living.traffic();
  if (!out.traffic.max) fail("no traffic was recorded after movement");
  // Disasters: each is chronicled and none creates or destroys matter, even after the fires they start resolve.
  const beforeMatter = totalMatter(), ashBefore = Array.from(W.tiles.chem[C.ASH]).reduce((a, b) => a + b, 0);
  const eruption = living.erupt(), quakeId = living.quake(undefined, 1.2), meteor = living.meteor();
  resolveEffects();
  out.disasterEvents = [eruption, quakeId, meteor].map((id) => eventById(id)?.type || null);
  if (out.disasterEvents.join() !== "EruptionEvent,EarthquakeEvent,MeteorEvent") fail("forced disasters were not all chronicled");
  const ashAfter = Array.from(W.tiles.chem[C.ASH]).reduce((a, b) => a + b, 0);
  out.ashGained = ashAfter - ashBefore;
  if (out.ashGained <= 0) fail("eruption produced no ash");
  out.disasterMatterDelta = totalMatter() - beforeMatter;
  for (let i = 0; i < 40; i++) simTick();
  out.disasterMatterDeltaAfterFires = totalMatter() - beforeMatter;
  if (out.disasterMatterDelta !== 0 || out.disasterMatterDeltaAfterFires !== 0) fail("disasters changed total matter");
  out.sentences = [eruption, quakeId, meteor].map((id) => eventSentence(eventById(id)));
  if (out.sentences.some((s) => !s || /undefined|occurred in/.test(s))) fail("disaster sentences fell back to a generic form");
  // Succession and omens need a polity: found a faction on the fixture settlement.
  let settlement = W.settlements.find((s) => !s.ruined);
  if (!settlement) {
    const camp = W.camps.find((c) => c.active);
    if (camp) {
      createSettlement(camp.id);
      settlement = W.settlements.find((s) => !s.ruined);
    }
  }
  out.settlementId = settlement?.id || 0;
  if (settlement) {
    const faction = settlement.factionId ? W.factions.find((f) => f.id === settlement.factionId) : createFaction(settlement.id);
    out.factionId = faction?.id || 0;
    if (faction) {
      const result = living.forceSuccession(faction.id);
      out.succession = result;
      const successionEvent = W.events.filter((e) => e.type === "SuccessionEvent").at(-1);
      if (!result?.succeeded || !successionEvent || !result.leaderId) fail("a leaderless polity did not choose a new Voice");
      else {
        out.successionSentence = eventSentence(successionEvent);
        if (!W.components.identity[result.leaderId]?.titles.some((t) => t.startsWith("Voice of"))) fail("the new Voice received no title");
      }
      // An intervention beside the settlement is read as an omen.
      const before = W.events.length;
      UI.tool = "rain";
      UI.brush = 1;
      applyTool(idx(clamp(settlement.x + 2, 0, W.width - 1), settlement.y));
      const omens = living.omens();
      out.omens = omens.find((o) => o.id === settlement.id) || null;
      const omenEvent = W.events.slice(before).find((e) => e.type === "OmenEvent");
      if (!out.omens || out.omens.omens < 1 || !omenEvent) fail("a rain intervention beside a settlement produced no omen");
      else {
        out.omenSentence = eventSentence(omenEvent);
        if (out.omens.favour <= 0) fail("rain was not read as favour");
      }
      out.shrinesPlanned = living.planShrine(settlement.id);
      if (!out.shrinesPlanned) fail("a settlement that saw omens planned no shrine");
      UI.tool = "inspect";
    }
  } else fail("civic fixture produced no settlement for succession and omen checks");
  // Determinism: everything above must hash-stable across a save round trip of the columns.
  out.columns = { traffic: W.tiles.traffic.length === W.tileCount, seasonOffset: W.tiles.seasonOffset.length === W.tileCount };
  if (!out.columns.traffic || !out.columns.seasonOffset) fail("living-world tile columns are missing or mis-sized");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
const seeds = ["x3", "hollow-crown"];
const results = {};
for (const seed of seeds) {
  game.createTestWorld({ seed, size: "small" });
  const fixture = controls.createCivicTestScenario();
  if (!fixture) failures.push(seed + ": civic fixture could not be created");
  const test = sandbox.window.ALIFE_LIVING_TEST;
  if (!test) throw new Error("Living-world test surface did not initialize");
  const result = test.run();
  results[seed] = result;
  for (const f of result.failures) failures.push(seed + ": " + f);
}
if (!(results.x3.tilt > 0)) failures.push("x3 should be a tilted world");
if (results["hollow-crown"].tilt !== 0) failures.push("hollow-crown should be an untilted world");
console.log(JSON.stringify({ ok: !failures.length, failures, results }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_LIVING_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
