// Peace smoke: every war has an aim read from what drove it (grievance makes
// tribute, a parent polity makes liberation), the column marches at the
// capital for tribute, a won war ends in tribute and a failed one in the old
// border standing, a league makes peace as one, the Chronicle reads the peace
// in a sentence, and the war page shows the aim and the terms.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const peace = window.ALIFE_PEACE_DEBUG, dip = window.ALIFE_DIPLOMACY_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let settlement = null;
  for (let attempt = 0; attempt < 4 && !settlement; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    settlement = W.settlements.find((s) => !s.ruined);
    if (!settlement) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); settlement = W.settlements.find((s) => !s.ruined); } }
  }
  if (!settlement) { fail("no settlement"); return out; }
  if (!settlement.factionId) createFaction(settlement.id);
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
  const [A, B, Cc] = living;
  for (const [p, q] of [[A, B], [B, A], [A, Cc], [Cc, A], [B, Cc], [Cc, B]]) { const rel = relationOf(p, q); rel.pressure = 30; rel.trade = 1; rel.grievance = 0; }
  // Aims follow what drove the war.
  out.aims = Object.keys(peace.aims());
  relationOf(A, B).grievance = 6;
  out.aimGrievance = peace.derive(A.id, B.id);
  if (out.aimGrievance !== "tribute") fail("grievance did not make a war for tribute: " + out.aimGrievance);
  relationOf(A, B).grievance = 0;
  const keepParent = B.parentFactionId;
  B.parentFactionId = A.id;
  out.aimRevolt = peace.derive(A.id, B.id);
  if (out.aimRevolt !== "liberation") fail("a rebel polity did not make a war of liberation: " + out.aimRevolt);
  B.parentFactionId = keepParent;
  out.aimPlain = peace.derive(A.id, B.id);
  if (!out.aims.includes(out.aimPlain)) fail("an unknown aim: " + out.aimPlain);
  // A war for tribute strikes at the capital and, won, ends in tribute.
  relationOf(A, B).grievance = 6;
  const war = dip.war(A.id, B.id);
  if (!war) { fail("no war"); return out; }
  war.attackerId = A.id;
  out.aim = peace.aim(war.id);
  if (out.aim !== "tribute") fail("the war did not take the tribute aim: " + out.aim);
  const capital = factionCapital(B);
  out.target = peace.target(war.id, A.id);
  if (capital && out.target !== capital.id) fail("the column did not march at the capital: " + out.target + " vs " + capital.id);
  const before = W.events.length;
  endWar(war, A, B, (capital?.name || "the town") + " was physically occupied");
  const p1 = peace.peace(war.id);
  out.peace1 = p1;
  if (!p1 || p1.outcome !== "attacker") fail("a captured town did not read as the attacker's victory: " + JSON.stringify(p1));
  if (p1 && !/pays|conceded/.test(p1.terms)) fail("the victor took no terms: " + p1.terms);
  if (/pays/.test(p1?.terms || "") && !activeTreaty("tribute", B, A)) fail("no tribute treaty stands behind the terms");
  const peaceEvents = W.events.slice(before).filter((e) => e.type === "PeaceEvent");
  if (peaceEvents.length !== 1) fail("expected one PeaceEvent, saw " + peaceEvents.length);
  out.sentence = peaceEvents[0] ? eventSentence(peaceEvents[0]) : "";
  if (!out.sentence || /undefined|NaN/.test(out.sentence)) fail("the peace sentence is broken: " + out.sentence);
  if (relationOf(A, B).status !== "truce") fail("no truce followed the peace");
  const page = renderLegendPage("war", war.id);
  if (!/War aim/.test(page) || !/Peace/.test(page)) fail("the war page does not show the aim and the terms");
  // A failed war leaves the old border standing.
  const war2 = dip.war(A.id, Cc.id);
  if (!war2) { fail("no second war"); return out; }
  war2.attackerId = A.id;
  endWar(war2, A, Cc, A.name + "'s column was broken before the walls and the survivors withdrew");
  out.peace2 = peace.peace(war2.id);
  if (!out.peace2 || out.peace2.outcome !== "defender" || !/old border stood/.test(out.peace2.terms)) fail("a broken column did not leave the old border standing: " + JSON.stringify(out.peace2));
  // A league makes peace as one.
  const league = formLeague([A.id, Cc.id]);
  const war3 = dip.war(A.id, B.id), war4 = dip.war(Cc.id, B.id);
  if (!war3 || !war4) { fail("no league wars"); return out; }
  endWar(war3, A, B, "both peoples were weary of war");
  out.peace3 = peace.peace(war3.id);
  out.leagueEnded = !!war4.ended;
  out.leagueReason = war4.endReason || "";
  if (!war4.ended || !/made peace as one/.test(out.leagueReason)) fail("the league did not make peace as one: " + out.leagueReason);
  const conference = W.events.filter((e) => e.type === "PeaceEvent" && e.data?.conference);
  if (!conference.length) fail("no conference peace was recorded");
  else out.conferenceSentence = eventSentence(conference.at(-1));
  if (out.peace3 && out.peace3.outcome !== "draw") fail("weary peoples did not draw: " + out.peace3.outcome);
  if (league) league.dissolvedTick = W.tick;
  // A war ended by collapse takes no terms.
  const war5 = dip.war(A.id, Cc.id);
  if (war5) { endWar(war5, A, Cc, "political collapse"); out.peace5 = peace.peace(war5.id); if (!out.peace5 || out.peace5.outcome !== "collapse" || out.peace5.years) fail("collapse took terms: " + JSON.stringify(out.peace5)); }
  simTick();
  if (auditMatter().delta !== 0) fail("matter drifted: " + auditMatter().delta);
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_PEACE_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_PEACE_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
