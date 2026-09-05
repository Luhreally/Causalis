// Legends smoke: the annals ledger, page rendering for every kind of record,
// links between pages, and history that outlives event compression.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const legends = window.ALIFE_LEGENDS_DEBUG, living = window.ALIFE_LIVING_DEBUG, out = { failures: [] };
  const fail = (m) => out.failures.push(m);
  const clean = (html, label) => {
    if (typeof html !== "string" || !html.length) fail(label + " rendered nothing");
    else if (/undefined|NaN|\[object Object\]/.test(html)) fail(label + " rendered undefined or NaN: " + html.slice(0, 200));
    return html || "";
  };
  for (let i = 0; i < 260; i++) simTick();
  let settlement = W.settlements.find((s) => !s.ruined);
  if (!settlement) {
    const camp = W.camps.find((c) => c.active);
    if (camp) { createSettlement(camp.id); settlement = W.settlements.find((s) => !s.ruined); }
  }
  if (!settlement) { fail("no settlement for legends pages"); return out; }
  const faction = settlement.factionId ? W.factions.find((f) => f.id === settlement.factionId) : createFaction(settlement.id);
  if (!faction) { fail("no faction for legends pages"); return out; }
  const eruptionId = living.erupt();
  const succession = living.forceSuccession(faction.id);
  for (let i = 0; i < 40; i++) simTick();
  out.annals = legends.annals();
  if (!out.annals) fail("no annals were recorded for notable events");
  const index = clean(legends.render("index"), "index");
  if (!/Polities/.test(index) || !/data-legend="faction:/.test(index)) fail("index lacks a polity link");
  if (!new RegExp('data-legend="place:' + settlement.id + '"').test(index) && !/data-legend="list:places"/.test(index)) fail("index lacks the settlement");
  const factionPage = clean(legends.render("faction", faction.id), "faction page");
  if (!factionPage.includes(faction.name.replace(/&/g, "&amp;"))) fail("faction page lacks the faction name");
  if (!new RegExp('data-legend="place:' + settlement.id + '"').test(factionPage)) fail("faction page does not link its place");
  if (succession?.leaderId && !new RegExp('data-legend="life:' + succession.leaderId + '"').test(factionPage)) fail("faction page does not link its Voice");
  const leaderId = succession?.leaderId || W.activeIds.find((id) => W.kind[id] === KINDS.PERSON);
  const lifePage = clean(legends.render("life", leaderId), "life page");
  if (!/Chronicle/.test(lifePage) || !new RegExp('data-legend="faction:' + faction.id + '"').test(lifePage)) fail("life page lacks chronicle or polity link");
  if (!/data-portrait=/.test(lifePage)) fail("living person has no portrait canvas");
  const placePage = clean(legends.render("place", settlement.id), "place page");
  if (!placePage.includes(settlement.name.replace(/&/g, "&amp;")) || !/Founded/.test(placePage)) fail("place page lacks name or founding");
  const culture = W.cultures.find((c) => c.id === faction.cultureId);
  if (culture) clean(legends.render("culture", culture.id), "culture page");
  const speciesKey = Object.keys(W.speciesRegistry)[0];
  if (speciesKey) {
    const speciesPage = clean(legends.render("species", speciesKey), "species page");
    if (!/First seen/.test(speciesPage)) fail("species page lacks first-seen year");
  }
  const eventPage = clean(legends.render("event", eruptionId), "event page");
  if (!/erupted/.test(eventPage) || !/Causes/.test(eventPage)) fail("event page lacks the eruption sentence or causes");
  clean(legends.render("list", "lives"), "lives list");
  clean(legends.render("list", "calamities"), "calamities list");
  // Compression: remove the eruption from the live feed and read it back from the annals.
  const liveIndex = W.events.findIndex((e) => e.id === eruptionId);
  if (liveIndex >= 0) W.events.splice(liveIndex, 1);
  const recovered = eventById(eruptionId);
  out.recoveredType = recovered?.type || null;
  if (recovered?.type !== "EruptionEvent") fail("an annal did not stand in for a compressed event");
  if (!/erupted/.test(eventSentence(recovered))) fail("a recovered annal does not render as a sentence");
  // Name survival: forget a subject's identity and read the name back from the annals.
  const subjectId = recovered.subjects?.[0];
  if (subjectId && W.historicalIdentities[subjectId]) {
    const saved = W.historicalIdentities[subjectId];
    delete W.historicalIdentities[subjectId];
    out.recoveredName = entityName(subjectId);
    W.historicalIdentities[subjectId] = saved;
  }
  out.pages = { index: index.length, faction: factionPage.length, life: lifePage.length, place: placePage.length, event: eventPage.length };
  out.annalsDigest = JSON.stringify((W.annals || []).map((a) => [a.id, a.type, a.tick]));
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const test = sandbox.window.ALIFE_LEGENDS_TEST;
if (!test) throw new Error("Legends test surface did not initialize");
const first = test.run();
for (const f of first.failures) failures.push(f);
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const second = test.run();
if (first.annalsDigest !== second.annalsDigest) failures.push("annals were not deterministic across identical runs");
delete first.annalsDigest;
console.log(JSON.stringify({ ok: !failures.length, failures, result: first }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_LEGENDS_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
