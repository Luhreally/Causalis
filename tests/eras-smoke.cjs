// Eras smoke: ages follow the most advanced town, leagues rise from allied
// polities and honour their wars, towns raise observatories and launch towers
// as they learn, and the first ship begins the Age of Stars and the ending.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const eras = window.ALIFE_ERAS_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
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
  // Ages follow knowledge, never skipping one.
  const grant = (...techs) => { for (const t of techs) if (!settlement.knownProcesses.includes(t)) settlement.knownProcesses.push(t); };
  out.age0 = eras.age().tier;
  grant("controlled_fire", "metalworking");
  const metal = eras.updateAges();
  if (!metal || metal.tier !== 2) fail("metalworking did not begin the Age of Metal");
  if (W.ages.length !== 2) fail("the Age of Hearths was skipped");
  const ageEvents = W.events.filter((e) => e.type === "AgeEvent");
  if (ageEvents.length !== 2) fail("expected two AgeEvents, saw " + ageEvents.length); else out.ageSentence = eventSentence(ageEvents[1]);
  if (eras.updateAges()) fail("an age began twice");
  // Leagues: three allied polities swear one, and it honours a member's war.
  const towns = W.settlements.filter((s) => !s.ruined && s.id !== settlement.id);
  for (const t of towns) if (!t.factionId && W.factions.length < 4) createFaction(t.id);
  const people = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id));
  while (W.factions.length < 4 && people.length) {
    const founder = people.pop();
    let tile = -1;
    for (let tries = 0; tries < 400 && tile < 0; tries++) {
      const x = 4 + ((tries * 37 + W.factions.length * 11) % (W.width - 8)), y = 4 + ((tries * 23) % (W.height - 8)), t = idx(x, y);
      if (W.tiles.liquid[t] <= WATER_DEPTH.SURFACE && !campNear(t, 6) && !nearestSettlement(t, 10)) tile = t;
    }
    if (tile < 0) { out.raise = (out.raise || "") + " no-tile"; break; }
    const soc = W.components.social[founder];
    if (soc) { soc.homePlaceKind = ""; soc.homePlaceId = 0; soc.factionId = 0; }
    const camp = createCamp(tile, founder);
    if (!camp) { out.raise = (out.raise || "") + " no-camp"; continue; }
    // A camp becomes a town once its stockpile, shelter, and hearth stand.
    for (const type of ["stockpile", "shelter", "hearth"]) {
      const b = planBuilding(camp, type, 5) || W.buildings.find((x) => !x.ruined && x.placeKind === "camp" && x.placeId === camp.id && x.type === type);
      if (b) { b.complete = true; b.stage = 6; b.integrity = b.maxIntegrity; b.completedTick = W.tick; }
    }
    const town = createSettlement(camp.id);
    if (!town) { out.raise = (out.raise || "") + " no-town"; continue; }
    const made = createFaction(town.id);
    if (!made) out.raise = (out.raise || "") + " no-faction";
  }
  const living = W.factions.filter((f) => f.stability > 0);
  if (living.length < 4) { fail("could not raise four polities (" + living.length + ")"); return out; }
  const [A, B, Cc, D] = living;
  for (const [x, y] of [[A, B], [B, Cc], [A, Cc]]) for (const [p, q] of [[x, y], [y, x]]) { if (!p.allies.includes(q.id)) p.allies.push(q.id); const rel = relationOf(p, q); rel.status = "allied"; rel.pressure = 0; }
  eras.updateLeagues();
  const league = eras.leagues().find((l) => !l.dissolvedTick);
  if (!league) { fail("no league formed"); return out; }
  out.league = { name: league.name, members: league.members.length };
  if (league.members.length !== 3) fail("the league has the wrong members");
  const formed = W.events.find((e) => e.type === "LeagueFormedEvent");
  if (!formed) fail("no LeagueFormedEvent"); else out.leagueSentence = eventSentence(formed);
  if (!/Members/.test(eras.page("league", league.id))) fail("the league page has no members");
  if (!/League/.test(window.ALIFE_LEGENDS_DEBUG.render("faction", A.id))) fail("the polity page does not name its league");
  if (!/Leagues/.test(window.ALIFE_LEGENDS_DEBUG.render("index"))) fail("the Legends index lists no leagues");
  // A quarrel inside the league is restrained; a war outside it draws the others in.
  relationOf(A, B).pressure = 90; eras.updateLeagues(); if (relationOf(A, B).pressure > 30) fail("the league did not restrain its members");
  const dip = window.ALIFE_DIPLOMACY_DEBUG || {}, warFn = dip.war || dip.declareWar || dip.startWar;
  const war = typeof warFn === "function" ? warFn(A.id, D.id) : null;
  if (!war) { out.warSkipped = true; } else {
    for (let i = 0; i < 12; i++) eras.updateLeagues();
    const pressured = relationOf(B, D).pressure;
    if (!(pressured >= 80)) fail("league members felt no pressure against the enemy: " + pressured);
    const honoured = W.events.find((e) => e.type === "LeagueWarEvent");
    if (honoured) out.warSentence = eventSentence(honoured); else out.warNotJoined = relationOf(B, D).status;
  }
  // Alliances lapse and the league dissolves.
  A.allies = A.allies.filter((id) => id !== B.id && id !== Cc.id); B.allies = B.allies.filter((id) => id !== A.id); Cc.allies = Cc.allies.filter((id) => id !== A.id);
  eras.updateLeagues();
  if (eras.leagues().some((l) => !l.dissolvedTick && l.id === league.id)) fail("the league outlived its alliances");
  if (!W.events.some((e) => e.type === "LeagueDissolvedEvent")) fail("no LeagueDissolvedEvent");
  // Wonders: letters and navigation raise an observatory; engines and stewardship a launch tower.
  if (!technologyDefinition("astronomy") || !technologyDefinition("starflight")) fail("the sky techs are missing");
  if (!BUILDING_DEFS.observatory || !BUILDING_DEFS.launch_tower) fail("the wonder buildings are missing");
  grant("writing", "navigation");
  simTick(); // plans refresh once per tick
  eras.plan(settlement.id);
  const planned = (type) => W.buildings.find((b) => !b.ruined && b.placeKind === "settlement" && b.placeId === settlement.id && b.type === type);
  if (!planned("observatory")) fail("no observatory was planned");
  grant("astronomy", "mechanization", "waterworks", "sanitation", "public_works", "planetary_stewardship", "chemistry", "combustion", "electricity", "computing");
  simTick(); // plans refresh once per tick
  settlement.stage = "urban"; // only a city raises the tower and sends the ship
  eras.plan(settlement.id);
  const tower = planned("launch_tower");
  if (!tower) { fail("no launch tower was planned"); return out; }
  tower.complete = true; tower.stage = 6; tower.integrity = tower.maxIntegrity; tower.completedTick = W.tick;
  settlement.stability = Math.max(settlement.stability || 0, 0.6);
  if (eras.launch(settlement.id, false)) fail("a ship left before starflight was known");
  grant("starflight");
  // No ship leaves a city of cottages (110): a tower block and a factory stand first.
  for (const type of ["tower", "factory"]) { const b = planned(type) || planBuilding(settlement, type, 9); if (b) { b.complete = true; b.stage = 6; b.integrity = b.maxIntegrity; b.completedTick = W.tick; } else fail("no " + type + " could be raised for the launch"); }
  const ship = eras.launch(settlement.id, false);
  if (!ship) { fail("no ship left"); return out; }
  out.ship = { first: ship.first, tile: ship.tile };
  const rose = W.events.find((e) => e.type === "AscensionEvent");
  if (!rose) fail("no AscensionEvent"); else out.shipSentence = eventSentence(rose);
  if (eras.age().gloss !== "Stars") fail("the Age of Stars did not begin: " + JSON.stringify(eras.age()));
  if (!W.endingShownTick) fail("the ending was not marked shown");
  out.ending = eras.ending().length;
  if (/undefined|NaN/.test(eras.ending())) fail("the ending contains undefined");
  if (!/Age of Stars/.test(eras.page("ages", 0))) fail("the ages page does not show the Age of Stars");
  window.ALIFE_TRAITS_DEBUG.update();
  if (!faction.traits.includes("Starfarers")) fail("the polity did not become Starfarers");
  if (eras.launch(settlement.id, true)) fail("a town launched twice");
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_ERAS_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_ERAS_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
