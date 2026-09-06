// Politics smoke: unrest is read from a town's troubles and chronicled when it
// first runs high, a coup replaces the Voice, a restless second town secedes
// as a free polity at war with its parent, and the pages and map mode show it.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const politics = window.ALIFE_POLITICS_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let settlement = null;
  for (let attempt = 0; attempt < 4 && !settlement; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    settlement = W.settlements.find((s) => !s.ruined);
    if (!settlement) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); settlement = W.settlements.find((s) => !s.ruined); } }
  }
  if (!settlement) { fail("no settlement"); return out; }
  const faction = settlement.factionId ? W.factions.find((f) => f.id === settlement.factionId) : createFaction(settlement.id);
  if (!faction) { fail("no faction"); return out; }
  const residents = () => entityAtRadius(idx(settlement.x, settlement.y), 8, KINDS.PERSON).filter((id) => classifyAlive(id) && W.components.social[id].factionId === faction.id);
  for (const id of residents()) { W.components.life[id].age = Math.max(W.components.life[id].age, 4000); window.ALIFE_CHARACTER_DEBUG.ensure(id); }
  if (!faction.leaderId || !classifyAlive(faction.leaderId)) { faction.leaderId = residents()[0]; addRelation(faction.leaderId, faction.entityId, "leads", 1); }
  // A content town is calm; a hungry, unequal, unstable one is not.
  out.calm = politics.unrest(settlement.id);
  settlement.stability = 0.1;
  settlement.inequality = 0.8;
  for (const id of residents()) W.components.life[id].hunger = 85;
  out.troubled = politics.unrest(settlement.id);
  if (!(out.troubled > 0.62) || !(out.troubled > out.calm)) fail("unrest does not rise with hunger, inequality and low stability (" + out.calm + " -> " + out.troubled + ")");
  politics.update();
  const unrest = W.events.filter((e) => e.type === "UnrestEvent").at(-1);
  if (!unrest) fail("no UnrestEvent when unrest first ran high"); else out.unrestSentence = eventSentence(unrest);
  if (settlement.unrestHigh !== 1) fail("the high streak did not start");
  // A coup in a restless capital.
  const oldVoice = faction.leaderId;
  const coup = politics.coup(faction.id);
  if (!coup || coup.type !== "CoupEvent") fail("no coup happened");
  else {
    out.coupSentence = eventSentence(coup);
    if (faction.leaderId === oldVoice) fail("the coup did not change the Voice");
    const leads = relationsOf(faction.entityId, "leads").filter((e) => e.to === faction.entityId && classifyAlive(e.from));
    if (leads.length !== 1 || leads[0].from !== faction.leaderId) fail("the leads relation does not point at the new Voice alone");
    if (W.components.identity[oldVoice] && !W.components.identity[oldVoice].titles.includes("Deposed")) fail("the old Voice is not marked deposed");
  }
  // Secession needs a second town of the same polity.
  let second = W.settlements.find((s) => !s.ruined && s.id !== settlement.id);
  for (let attempt = 0; attempt < 10 && !second; attempt++) { for (let i = 0; i < 160; i++) simTick(); second = W.settlements.find((s) => !s.ruined && s.id !== settlement.id); }
  if (second) {
    const other = second.factionId && second.factionId !== faction.id ? W.factions.find((f) => f.id === second.factionId) : null;
    second.factionId = faction.id; second.cultureId = faction.cultureId;
    for (const id of entityAtRadius(idx(second.x, second.y), 8, KINDS.PERSON)) if (classifyAlive(id)) { W.components.social[id].factionId = faction.id; W.components.life[id].age = Math.max(W.components.life[id].age, 4000); }
    if (other) other.stability = 0;
    updateFactions();
    if (!faction.settlementIds.includes(second.id)) fail("the second town did not join the polity");
    second.stability = 0.1; second.inequality = 0.7;
    for (const id of entityAtRadius(idx(second.x, second.y), 8, KINDS.PERSON)) if (classifyAlive(id)) W.components.life[id].hunger = 85;
    politics.update();
    const factionsBefore = W.factions.length;
    const rebellion = politics.secede(second.id);
    if (!rebellion || rebellion.type !== "RebellionEvent") fail("the restless town did not secede");
    else {
      out.rebellionSentence = eventSentence(rebellion);
      const rebels = W.factions[W.factions.length - 1];
      if (W.factions.length !== factionsBefore + 1) fail("no new polity was founded");
      if (second.factionId !== rebels.id) fail("the town does not belong to the new polity");
      if (faction.relations[rebels.id]?.status !== "hostile" && faction.relations[rebels.id]?.status !== "at war") fail("parent and rebels are not hostile");
      if (!rebels.leaderId || !classifyAlive(rebels.leaderId)) fail("the new polity has no Voice");
      const moved = entityAtRadius(idx(second.x, second.y), 8, KINDS.PERSON).filter((id) => classifyAlive(id) && W.components.social[id].factionId === rebels.id).length;
      if (!moved) fail("no residents joined the new polity");
      out.war = W.activeWars.some((w) => !w.ended && ((w.a === faction.id && w.b === rebels.id) || (w.a === rebels.id && w.b === faction.id)));
      if (!/Broke from/.test(window.ALIFE_LEGENDS_DEBUG.render("faction", rebels.id))) fail("the new polity's page does not say whom it broke from");
    }
  } else {
    out.singleTown = true;
    if (politics.secede(settlement.id)) fail("a lone capital seceded");
  }
  // Pages and the map mode.
  if (!/Unrest/.test(window.ALIFE_LEGENDS_DEBUG.render("faction", faction.id))) fail("the polity page has no unrest row");
  if (!/Unrest/.test(window.ALIFE_LEGENDS_DEBUG.render("place", settlement.id))) fail("the place page has no unrest row");
  if (!(overlayValue("unrest", idx(settlement.x, settlement.y)) > 0)) fail("the unrest overlay is dark over a restless town");
  const before = worldHash(), overlay = UI.overlay;
  UI.overlay = "unrest";
  window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "top", quality: "standard", zoom: 3, now: 5000 });
  UI.overlay = overlay;
  if (worldHash() !== before) fail("rendering the unrest overlay changed the world hash");
  for (let i = 0; i < 40; i++) simTick();
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_POLITICS_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_POLITICS_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
