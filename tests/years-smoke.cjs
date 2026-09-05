// Years smoke: the annals read year by year — the digest written at the turn of
// the year, the scoped timeline for the world, a polity, and a place, the
// category chips and year selection, and the links that lead into it.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const years = window.ALIFE_YEARS_DEBUG, legends = window.ALIFE_LEGENDS_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let settlement = null;
  for (let attempt = 0; attempt < 4 && !settlement; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    settlement = W.settlements.find((s) => !s.ruined);
    if (!settlement) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); settlement = W.settlements.find((s) => !s.ruined); } }
  }
  if (!settlement) { fail("no settlement"); return out; }
  const faction = settlement.factionId ? W.factions.find((f) => f.id === settlement.factionId) : createFaction(settlement.id);
  if (!faction) { fail("no faction"); return out; }
  // Run past a year turn so the digest is written by the ordinary tick.
  const target = (formatYear() + 1) * TICKS_PER_YEAR + 2;
  while (W.tick < target) simTick();
  const yearEvents = W.events.filter((e) => e.type === "YearEvent");
  out.yearEvents = yearEvents.map((e) => eventSentence(e));
  if (!yearEvents.length) fail("no YearEvent was written at the turn of the year");
  if (!(W.annals || []).some((a) => a.type === "YearEvent")) fail("the year digest is not in the annals");
  const digestYear = formatYear() - 1;
  out.digest = years.digest(digestYear);
  if (!out.digest || !/notable event/.test(out.digest)) fail("the year digest is empty (" + out.digest + ")");
  // The world timeline: bars, chips, year headings, event rows.
  const page = years.render(0);
  out.pageLength = page.length;
  if (!/years-bars/.test(page) || !/data-years-year=/.test(page)) fail("the years page has no year bars");
  if (!/data-years-cat="war"/.test(page)) fail("the years page has no category chips");
  if (!/Year \d+<\/span>/.test(page)) fail("the years page has no year headings");
  if (!/data-legend="event:/.test(page)) fail("the years page rows do not link to events");
  // Scoped to the polity and the place.
  const scoped = years.render(faction.id * 10 + 1);
  if (!scoped.includes(faction.name)) fail("the polity-scoped page does not name the polity");
  if (!/whole world/.test(scoped)) fail("the scoped page has no way back to the whole world");
  const placePage = years.render(settlement.id * 10 + 2);
  if (!placePage.includes(settlement.name)) fail("the place-scoped page does not name the place");
  out.scope = years.scope(faction.id * 10 + 1).kind + "/" + years.scope(settlement.id * 10 + 2).kind + "/" + years.scope(0).kind;
  // Category and year selection narrow the page.
  years.setCategory("war");
  const warPage = years.render(0);
  if (!/data-years-cat="war" ?/.test(warPage) || !/filt active" data-years-cat="war"/.test(warPage)) fail("the war chip is not marked active");
  years.setCategory("all");
  years.setYear(digestYear);
  const yearPage = years.render(0);
  if (!new RegExp("Year " + digestYear + " ✕").test(yearPage)) fail("a selected year shows no clear chip");
  if ((yearPage.match(/years-group/g) || []).length !== 1) fail("a selected year shows more than one year group");
  years.setYear(-1);
  // Entry points: the index card and the page buttons.
  const index = legends.render("index", 0);
  if (!/data-legend="years:0"/.test(index)) fail("the Legends index has no years card");
  if (!new RegExp('data-legend="years:' + (faction.id * 10 + 1) + '"').test(legends.render("faction", faction.id))) fail("the polity page has no chronicle-by-year button");
  if (!new RegExp('data-legend="years:' + (settlement.id * 10 + 2) + '"').test(legends.render("place", settlement.id))) fail("the place page has no chronicle-by-year button");
  if (!/The annals, year by year/.test(legends.render("years", 0))) fail("the legend page router does not route years");
  // Forcing a turn twice in the same year writes nothing new.
  const before = W.events.length;
  years.turn(formatYear());
  years.turn(formatYear());
  out.forced = W.events.length - before;
  if (out.forced > 1) fail("the same year was digested twice");
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_YEARS_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_YEARS_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
