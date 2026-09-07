// Afternoon smoke: industry strains the sky and stewardship eases it, a
// strained sky forces droughts and heat waves and is chronicled; every polity
// has a way of rule that drifts with letters and war and names a government,
// and distances polities whose ways differ; satellites and a launch tower
// raise orbital stations that quicken inquiry; the epilogue keeps a decade
// ledger once the ladder reaches the stars and quietens the alerts; pages
// render.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const af = window.ALIFE_AFTERNOON_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let settlement = null;
  for (let attempt = 0; attempt < 4 && !settlement; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    settlement = W.settlements.find((s) => !s.ruined);
    if (!settlement) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); settlement = W.settlements.find((s) => !s.ruined); } }
  }
  if (!settlement) { fail("no settlement"); return out; }
  if (!settlement.factionId) createFaction(settlement.id);
  const faction = W.factions.find((f) => f.id === settlement.factionId);
  if (!faction) { fail("no faction"); return out; }
  const know = (...ts) => { for (const t of ts) if (!settlement.knownProcesses.includes(t)) settlement.knownProcesses.push(t); };
  const forget = (...ts) => { settlement.knownProcesses = settlement.knownProcesses.filter((t) => !ts.includes(t)); };
  const complete = (type) => {
    const b = planBuilding(settlement, type, 9) || W.buildings.find((x) => !x.ruined && x.placeKind === "settlement" && x.placeId === settlement.id && x.type === type && !x.complete);
    if (b) { b.complete = true; b.stage = 6; b.integrity = b.maxIntegrity; b.completedTick = W.tick; for (const [sp, n] of b.requirements || []) b.composition[sp] = n; }
    return b;
  };
  // Industry strains the sky; stewardship and ecological engineering ease it.
  forget("mechanization", "combustion", "electricity", "fusion", "planetary_stewardship", "ecological_engineering");
  out.deltaClean = af.delta();
  if (out.deltaClean !== 0) fail("a town without engines strains the sky: " + out.deltaClean);
  know("mechanization", "combustion", "electricity");
  out.deltaIndustry = +af.delta().toFixed(3);
  if (!(out.deltaIndustry > 0.07)) fail("engines, combustion, and current do not strain the sky: " + out.deltaIndustry);
  let strain = 0;
  for (let i = 0; i < 40; i++) af.tick();
  strain = af.strain(); out.strainIndustry = +strain.toFixed(2);
  if (!(strain >= 1)) fail("forty years of industry did not make the sky heavy: " + strain);
  const heavy = W.events.find((e) => e.type === "ClimateEvent");
  if (!heavy) fail("no ClimateEvent when the sky grew heavy"); else { out.heavySentence = eventSentence(heavy); if (!/heavy|choking/.test(out.heavySentence) || !alertWorthy(heavy)) fail("the heavy sky is not chronicled or alerted: " + out.heavySentence); }
  out.weather = af.weather(1) || af.weather(2) || af.weather(3) || af.weather(4) || af.weather(5) || af.weather(6) || af.weather(7) || af.weather(8);
  if (!["Drought", "Heat Wave"].includes(out.weather)) fail("a strained sky forces no drought or heat within eight seasons: " + out.weather);
  know("planetary_stewardship", "ecological_engineering");
  out.deltaTended = +af.delta().toFixed(3);
  if (!(out.deltaTended < out.deltaIndustry)) fail("stewardship does not ease the strain: " + out.deltaTended);
  for (let i = 0; i < 80; i++) af.tick();
  out.strainEased = +af.strain().toFixed(2);
  if (!(out.strainEased < out.strainIndustry)) fail("eighty tended years did not ease the sky: " + out.strainEased);
  if (!W.events.some((e) => e.type === "ClimateEasedEvent") && out.strainEased < 0.5) fail("the sky cleared without a ClimateEasedEvent");
  // Ways of rule.
  const ideology = af.ideology(faction.id);
  if (!(Math.abs(ideology.rule) <= 1 && Math.abs(ideology.openness) <= 1)) fail("the way of rule is off its axes: " + JSON.stringify(ideology));
  out.government = af.government(faction.id);
  if (!out.government) fail("the polity has no government name");
  faction.ideology.openness = -0.5; know("writing", "printing", "radio");
  const openBefore = faction.ideology.openness;
  af.drift();
  out.openness = [openBefore, +faction.ideology.openness.toFixed(3)];
  if (!(faction.ideology.openness > openBefore)) fail("letters and radio did not open the polity: " + JSON.stringify(out.openness));
  faction.ideology.rule = 0.9; faction.ideology.openness = -0.9;
  out.autocracy = af.government(faction.id);
  if (out.autocracy !== "Autocracy") fail("the one ruling a closed polity is not an autocracy: " + out.autocracy);
  faction.ideology.rule = -0.9; faction.ideology.openness = 0.9;
  if (af.government(faction.id) !== "Open republic") fail("the many ruling an open polity is not an open republic: " + af.government(faction.id));
  const other = { id: 9999, ethos: { hierarchical: 0.9, mercantile: 0.1, inventive: 0.1 }, relations: {} };
  W.factions.push(other);
  out.distance = af.distance(faction.id, other.id);
  W.factions = W.factions.filter((f) => f !== other);
  if (!(out.distance > 0.3 && out.distance <= 1)) fail("polities of opposite ways are not held apart: " + out.distance);
  // Orbital stations quicken inquiry.
  know("satellites"); complete("launch_tower"); W.afternoon.stationLast = {};
  const tempoBefore = researchTempoFactor(settlement);
  const raised = af.raise();
  out.stations = af.stations(faction.id);
  if (!raised.length || out.stations !== 1) fail("no station was raised with satellites and a tower: " + out.stations);
  else { out.stationSentence = eventSentence(raised[0]); if (!/orbital station/.test(out.stationSentence)) fail("the station is not chronicled: " + out.stationSentence); }
  out.tempo = [tempoBefore, researchTempoFactor(settlement)];
  if (!(out.tempo[1] > out.tempo[0])) fail("a station does not quicken inquiry: " + JSON.stringify(out.tempo));
  if (af.raise().length) fail("a second station rose in the same decade");
  // The epilogue keeps a decade ledger and quietens the alerts.
  if (af.active()) fail("the epilogue began before the stars were reached");
  const keepStage = { stage: W.civilization.stage, index: W.civilization.stageIndex };
  W.civilization.stage = "interstellar"; W.civilization.stageIndex = CIV_STAGE_ORDER.indexOf("interstellar");
  const entry = af.record();
  if (!entry || entry.type !== "EpilogueEvent") fail("no epilogue entry was recorded at the stars");
  else { out.epilogue = eventSentence(entry); if (!/people in/.test(out.epilogue)) fail("the epilogue sentence is wrong: " + out.epilogue); }
  if (af.epilogue().length !== 1) fail("the epilogue ledger does not hold one decade: " + af.epilogue().length);
  const quiet = { type: "CaravanEvent", importance: 2, data: {} };
  if (alertWorthy(quiet)) out.quietNote = "a minor event was already unalerted";
  const loud = { type: "MilestoneEvent", importance: 4, data: {} };
  if (!alertWorthy(loud)) fail("a milestone is silenced in the epilogue");
  W.civilization.stage = keepStage.stage; W.civilization.stageIndex = keepStage.index;
  // Pages.
  const ages = window.ALIFE_LEGENDS_DEBUG.render("ages", 0);
  if (!/The sky/.test(ages) || !/long afternoon/.test(ages)) fail("the Ages page lacks the sky and the afternoon");
  if (!/Rule/.test(window.ALIFE_LEGENDS_DEBUG.render("faction", faction.id))) fail("the polity page has no Rule row");
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_AFTERNOON_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_AFTERNOON_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
