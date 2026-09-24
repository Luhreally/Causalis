// Pages read the world and never write it. Every page, inspector and pane is
// built on a new world, a village in its second year and the grown battery
// city, and the world hash must be the same before and after each. On a new
// world the Legends index, life pages, the ages, the stars, the economy and
// the panes each used to make a field the world had not yet made for itself
// (the stars, the festivals, the markets, the work of every person), until a
// new world was given its defaults when made (2026-09-23).
const fs = require("node:fs");
const zlib = require("node:zlib");
const path = require("node:path");
const { loadRuntime } = require("../scripts/runtime-probe.cjs");
const { report } = require("./lib/report.cjs");

const PAGES = `[
  ["legend index", () => renderLegendIndex("")],
  ["legend lists", () => ["lives", "polities", "places", "species", "wars", "artifacts", "cultures"].forEach((w) => renderLegendList(w, ""))],
  ["life pages", () => W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON).slice(0, 30).forEach((id) => renderLifePage(id))],
  ["faction pages", () => W.factions.forEach((f) => renderFactionPage(f.id))],
  ["culture pages", () => W.cultures.forEach((c) => renderCulturePage(c.id))],
  ["place pages", () => W.settlements.forEach((s) => renderPlacePage(s.id))],
  ["camp pages", () => (W.camps || []).forEach((c) => renderCampPage(c.id))],
  ["event pages", () => W.events.slice(-40).forEach((e) => renderEventPage(e.id))],
  ["years", () => renderYearsPage(0)],
  ["ages", () => renderAgesPage()],
  ["stars", () => renderStarsPage()],
  ["technology", () => renderTechnologyPage()],
  ["economy", () => renderEconomyPage()],
  ["inspectors", () => W.activeIds.slice(0, 200).forEach((id) => organismInspector(id))],
  ["tile inspectors", () => W.settlements.slice(0, 6).forEach((s) => tileInspector(idx(s.x, s.y)))],
  ["panes", () => { refreshChronicle(); refreshWorldInfo(); refreshStats(); refreshWarfare(); }],
  ["every tab", () => { for (const t of ["inspect", "chronicle", "legends", "warfare", "worldinfo", "stats"]) { UI.activeTab = t; refreshUI(true); } }],
]`;
const failures = [],
  worlds = [];
async function check(label, setup) {
  const rt = loadRuntime();
  await setup(rt);
  const pages = rt.get(`(${PAGES})`),
    hash = rt.get("worldHash"),
    writers = [];
  for (const [name, build] of pages) {
    const before = hash();
    try {
      build();
    } catch (error) {
      failures.push(`${label}: the ${name} threw: ${error.message}`);
      continue;
    }
    if (hash() !== before) writers.push(name);
  }
  if (writers.length) failures.push(`${label}: ${writers.join(", ")} wrote the world`);
  worlds.push({ label, pages: pages.length, writers });
}
const FRESH = { seed: "causal-origin", size: "battery", complexity: "lean" };
(async () => {
  await check("a new world", async (rt) => rt.sandbox.window.ALIFE_DEBUG.createTestWorld(FRESH));
  await check("a village in its second year", async (rt) => {
    rt.sandbox.window.ALIFE_DEBUG.createTestWorld(FRESH);
    const tick = rt.get("simTick");
    for (let i = 0; i < 300; i++) tick();
  });
  await check("the battery city", async (rt) => {
    const archive = zlib.gunzipSync(
      fs.readFileSync(path.join(__dirname, "fixtures", "launch-battery.json.gz")),
    );
    rt.sandbox.localStorage.setItem("causalis.save.pages", archive.toString("utf8"));
    if (!(await rt.sandbox.window.ALIFE_SAVE_DEBUG.load("pages")))
      throw new Error("fixture did not load");
  });
  report({ worlds }, failures);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
