// A field site is seeded from its own plot (137): on a generated world, a
// new field site that lacks its organic seed takes it from the growth on its
// three by three, as much as the plot loses, and the matter audit stays at
// nought.
const { loadRuntime } = require("../scripts/runtime-probe.cjs");
const { report } = require("./lib/report.cjs");

const failures = [];
(async () => {
  const rt = loadRuntime();
  rt.sandbox.window.ALIFE_DEBUG.createTestWorld({
    seed: "causal-origin",
    size: "battery",
    complexity: "lean",
  });
  // Grown until a town has a finished field (its first year, on this seed).
  const tick = rt.get("simTick");
  for (let year = 0; year < 30; year++) {
    for (let i = 0; i < 256; i++) tick();
    if (rt.get(`W.settlements.some((s) => !s.ruined && completedBuildings(s, "farm").length)`))
      break;
  }
  const out = rt.get(`(() => {
    const out = {}, plot = window.ALIFE_FIELD_PLOT_DEBUG;
    const around = (b) => { let n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = b.x + dx, y = b.y + dy; if (inside(x, y)) n += resourceAmountAt(idx(x, y), C.ORGANIC); } return n; };
    // A new field site in the first town with fields that has room for one, with growth
    // put on its plot for the test (from the hall's own tile, so no matter is made).
    let town = null, site = null;
    for (const s of W.settlements.filter((s) => !s.ruined && completedBuildings(s, "farm").length)) {
      site = planBuilding(s, "farm", 9);
      if (site) { town = s; break; }
    }
    if (!town) return { none: "no town with fields could plan another" };
    out.town = town.name;
    out.organicWanted = (site.requirements || []).find(([sp]) => sp === C.ORGANIC)?.[1] || 0;
    const hall = idx(town.x, town.y), give = Math.min(40, resourceAmountAt(hall, C.ORGANIC));
    setTileMatterAmount(hall, C.ORGANIC, resourceAmountAt(hall, C.ORGANIC) - give);
    setTileMatterAmount(idx(site.x, site.y), C.ORGANIC, resourceAmountAt(idx(site.x, site.y), C.ORGANIC) + give);
    const plotBefore = around(site), heldBefore = site.composition[C.ORGANIC] || 0;
    out.seeded = plot.seed(town.id, site.id);
    out.plotLost = plotBefore - around(site);
    out.siteGained = (site.composition[C.ORGANIC] || 0) - heldBefore;
    out.counts = plot.counts();
    out.audit = auditMatter().delta;
    return out;
  })()`);
  if (out.none) failures.push(out.none);
  else {
    if (!(out.seeded > 0)) failures.push("a field site was not seeded from the growth on its plot");
    if (out.plotLost !== out.siteGained)
      failures.push(`the plot lost ${out.plotLost} and the site gained ${out.siteGained}`);
    if (out.audit !== 0) failures.push(`the matter audit reads ${out.audit}`);
  }
  report(out, failures);
})().catch((error) => {
  report({ error: String(error?.stack || error) }, [String(error?.message || error)]);
});
