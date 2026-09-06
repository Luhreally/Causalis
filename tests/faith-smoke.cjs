// Faith smoke: named beliefs become sects, polities of one sect keep their
// quarrels small, polities of rival sects feel zeal that presses toward war,
// and a war begun under that zeal is a holy war on its pages.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const faith = window.ALIFE_FAITH_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let settlement = null;
  for (let attempt = 0; attempt < 4 && !settlement; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    settlement = W.settlements.find((s) => !s.ruined);
    if (!settlement) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); settlement = W.settlements.find((s) => !s.ruined); } }
  }
  if (!settlement) { fail("no settlement"); return out; }
  if (!settlement.factionId) createFaction(settlement.id);
  // A second polity of its own culture.
  for (const t of W.settlements) if (!t.ruined && !t.factionId && W.factions.length < 3) createFaction(t.id);
  const people = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id));
  while (W.factions.length < 3 && people.length) {
    const founder = people.pop();
    let tile = -1;
    for (let tries = 0; tries < 400 && tile < 0; tries++) {
      const x = 4 + ((tries * 37 + 11) % (W.width - 8)), y = 4 + ((tries * 23) % (W.height - 8)), t = idx(x, y);
      if (W.tiles.liquid[t] <= WATER_DEPTH.SURFACE && !campNear(t, 6) && !nearestSettlement(t, 10)) tile = t;
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
    const town = createSettlement(camp.id);
    if (town) createFaction(town.id);
  }
  const living = W.factions.filter((f) => f.stability > 0);
  if (living.length < 3) { fail("could not raise three polities"); return out; }
  const [A, B, Cc] = living, cC = W.cultures.find((c) => c.id === Cc.cultureId), cA = W.cultures.find((c) => c.id === A.cultureId), cB = W.cultures.find((c) => c.id === B.cultureId);
  if (!cA || !cB || cA === cB) { fail("the polities do not have their own cultures"); return out; }
  ensureBeliefs();
  // Beliefs named: one god, read as favour by one people and wrath by the other.
  for (const [c, favour] of [[cA, 5], [cB, 5], [cC, 5]]) { c.belief.named = true; c.belief.name = "Ora"; c.belief.gloss = "the tide"; c.belief.favour = favour; }
  A.ethos.spiritual = 0.8; B.ethos.spiritual = 0.8; Cc.ethos.spiritual = 0.8;
  for (const [p, q] of [[A, B], [B, A], [A, Cc], [Cc, A], [B, Cc], [Cc, B]]) { const rel = relationOf(p, q); rel.pressure = 10; rel.status = "neutral"; }
  faith.update();
  // Three polities of one sect at peace are bound: a league forms without any formal alliance.
  if (!faith.bond(A.id, Cc.id)) fail("co-religionists at peace share no bond");
  window.ALIFE_ERAS_DEBUG.updateLeagues();
  const compact = window.ALIFE_ERAS_DEBUG.leagues().find((l) => !l.dissolvedTick);
  if (!compact) fail("no league formed from a shared faith"); else out.compact = compact.name + " (" + compact.members.length + ")";
  if (compact && !/binds every member/.test(window.ALIFE_ERAS_DEBUG.page("league", compact.id))) fail("the league page does not name its faith");
  relationOf(A, B).pressure = 50; relationOf(B, A).pressure = 50;
  faith.update();
  out.faithA = faith.faith(A.id)?.name;
  if (!/Bright Way of Ora/.test(out.faithA || "")) fail("the favourable reading did not become the Bright Way");
  if (!W.events.some((e) => e.type === "SectEvent")) fail("no SectEvent");
  if (!(relationOf(A, B).pressure < 50)) fail("one sect did not keep the quarrel small");
  // Now the second people read the god as wrath: zeal, pressure, then a holy war.
  cB.belief.favour = -5;
  const before = relationOf(A, B).pressure;
  faith.update();
  out.faithB = faith.faith(B.id)?.name;
  if (!/Dread Way of Ora/.test(out.faithB || "")) fail("the wrathful reading did not become the Dread Way");
  out.zeal = faith.zeal(A.id, B.id);
  if (!(out.zeal >= 0.45)) fail("rival sects of one god feel too little zeal: " + out.zeal);
  if (!(relationOf(A, B).pressure > before)) fail("zeal did not press toward war");
  const war = window.ALIFE_DIPLOMACY_DEBUG.war(A.id, B.id);
  if (!war) { fail("no war could be declared"); return out; }
  faith.update();
  if (!war.holy) fail("a war between rival sects was not holy");
  const holy = W.events.find((e) => e.type === "HolyWarEvent");
  if (!holy) fail("no HolyWarEvent"); else out.holySentence = eventSentence(holy);
  if (!/Faith/.test(window.ALIFE_LEGENDS_DEBUG.render("faction", A.id))) fail("the polity page names no faith");
  if (!/Sect/.test(window.ALIFE_LEGENDS_DEBUG.render("culture", cA.id))) fail("the culture page names no sect");
  if (!/Holy war/.test(window.ALIFE_LEGENDS_DEBUG.render("war", war.id))) fail("the war page does not say it is holy");
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_FAITH_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_FAITH_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
