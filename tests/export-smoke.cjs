// Export smoke: the Legends export is a self-contained HTML document with a
// section per page and working anchors, the chronicle export is plain text
// year by year, and the Legends index offers both.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const exp = window.ALIFE_EXPORT_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let settlement = null;
  for (let attempt = 0; attempt < 4 && !settlement; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    settlement = W.settlements.find((s) => !s.ruined);
    if (!settlement) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); settlement = W.settlements.find((s) => !s.ruined); } }
  }
  if (!settlement) { fail("no settlement"); return out; }
  const faction = settlement.factionId ? W.factions.find((f) => f.id === settlement.factionId) : createFaction(settlement.id);
  if (!faction) { fail("no faction"); return out; }
  for (let i = 0; i < 300; i++) simTick();
  window.ALIFE_HOUSES_DEBUG.update();
  const html = exp.html();
  out.htmlBytes = html.length;
  if (!/^<!doctype html>/i.test(html)) fail("the export is not an HTML document");
  if (!new RegExp('<section class="page" id="faction-' + faction.id + '"').test(html)) fail("the polity has no section");
  if (!new RegExp('<section class="page" id="place-' + settlement.id + '"').test(html)) fail("the place has no section");
  if (!/<section class="page" id="life-\d+"/.test(html)) fail("no life has a section");
  if (!/id="annals"/.test(html) || !/id="year-\d+"/.test(html)) fail("the annals are missing");
  if (/<canvas/.test(html)) fail("a canvas leaked into the export");
  if (/data-world-goto|data-follow=/.test(html)) fail("world controls leaked into the export");
  if (!/data-legend="faction:/.test(html)) fail("links between pages were stripped");
  if (!/<script>/.test(html) || !/scrollIntoView/.test(html)) fail("the anchor script is missing");
  if (!/<style>/.test(html)) fail("the stylesheet is missing");
  if (/undefined|NaN/.test(html.replace(/[a-z]undefined/g, ""))) fail("the export contains undefined");
  const text = exp.text();
  out.textBytes = text.length;
  if (!/^LEGENDS OF/.test(text)) fail("the chronicle has no title");
  if (!/POLITIES\n  /.test(text)) fail("the chronicle lists no polities");
  if (!/\nYear \d+/.test(text)) fail("the chronicle has no years");
  if (!/\n  \[[a-z]+\] /.test(text)) fail("the chronicle has no event lines");
  if (/undefined|NaN/.test(text)) fail("the chronicle contains undefined");
  const index = window.ALIFE_LEGENDS_DEBUG.render("index", 0);
  if (!/data-legend-export="html"/.test(index) || !/data-legend-export="text"/.test(index)) fail("the Legends index offers no export buttons");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_EXPORT_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_EXPORT_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
