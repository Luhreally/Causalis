// Zoning smoke: a town's quarters partition the ground around it and are the
// town's own, a use is placed in a quarter that will have it, what gets planned
// answers what the town is short of, a cottage in a dense core is bought out for
// a block without conjuring or destroying matter and without putting anyone on
// the street, a flat costs more where it is wanted more, and the town's own page
// never writes the world.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const z = window.ALIFE_ZONING_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let town = null;
  for (let attempt = 0; attempt < 4 && !town; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    town = W.settlements.find((s) => !s.ruined);
    if (!town) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); town = W.settlements.find((s) => !s.ruined); } }
  }
  if (!town) { fail("no settlement"); return out; }

  // The plan covers the ground, and every plot has exactly one use.
  const g = z.genome(town.id);
  out.genome = { core: +g.core.toFixed(2), industry: g.industry, commerce: g.commerce };
  if (!(g.core >= 2)) fail("the core is too small to hold anything: " + g.core);
  const seen = {};
  for (let dy = -12; dy <= 12; dy++)
    for (let dx = -12; dx <= 12; dx++) {
      const x = town.x + dx, y = town.y + dy;
      if (!inside(x, y)) continue;
      const zone = z.zone(town.id, x, y);
      if (typeof zone !== "string") fail("a plot has no use at all");
      seen[zone] = (seen[zone] || 0) + 1;
    }
  out.zones = seen;
  for (const need of ["civic", "residential", "industry", "farmland"])
    if (!seen[need]) fail("the plan has no " + need + " quarter at all");
  // The centre is the civic heart, and the far edge is not zoned at all.
  if (z.zone(town.id, town.x, town.y) !== "civic") fail("the town centre is not civic");
  if (z.zone(town.id, town.x + 40, town.y) !== "open") fail("the plan reaches the far side of the map");

  // The plan is the town's own, not the world's: another town's works face a
  // different way, or the same way by chance but from its own roll.
  out.perTown = W.settlements.filter((s) => !s.ruined).slice(0, 4).map((s) => z.genome(s.id).industry);

  // What it is short of is what it plans.
  const d = z.demand(town.id);
  out.demand = d ? { r: +d.residential.toFixed(2), i: +d.industry.toFixed(2), c: +d.commercial.toFixed(2) } : null;
  if (!d) fail("a standing town reports no demand at all");
  for (const k of ["residential", "industry", "commercial"])
    if (!(d[k] >= 0 && d[k] <= 1)) fail(k + " demand is out of range: " + d[k]);

  // A use is placed in a quarter that will have it.
  const before = W.buildings.length;
  planBuilding(town, "workshop", 5);
  const raisedWorkshop = W.buildings.length > before ? W.buildings[W.buildings.length - 1] : null;
  out.workshopZone = raisedWorkshop ? z.zone(town.id, raisedWorkshop.x, raisedWorkshop.y) : null;
  if (raisedWorkshop && z.prefers(town.id, "workshop", raisedWorkshop.x, raisedWorkshop.y) < 0)
    fail("a works was planned into the " + out.workshopZone + " quarter, which will not have one");
  const homeBefore = W.buildings.length;
  planBuilding(town, "shelter", 5);
  const raisedHome = W.buildings.length > homeBefore ? W.buildings[W.buildings.length - 1] : null;
  out.homeZone = raisedHome ? z.zone(town.id, raisedHome.x, raisedHome.y) : null;
  if (raisedHome && z.prefers(town.id, "shelter", raisedHome.x, raisedHome.y) < 0)
    fail("a home was planned into the " + out.homeZone + " quarter, which will not have one");
  // A civic building is the planner's business, not the plan's: no bias at all.
  if (z.bias(town.id, "hall", town.x + 3, town.y) !== 0)
    fail("the plan leaned on where the hall goes");

  // Buying a cottage out conserves matter and rehouses the household.
  const beforeMatter = auditMatter().delta;
  town.knownProcesses = [...new Set([...town.knownProcesses, "masonry"])];
  const cottage = W.buildings.find((b) => b.complete && !b.ruined && b.type === "shelter" &&
    b.placeKind === "settlement" && b.placeId === town.id);
  if (!cottage) out.redevelop = "no cottage standing";
  else {
    // Put it in the core, and let the town grow until it is the size at which a
    // city stops keeping cottages in its middle.
    // Somewhere the plan calls residential — not the square, which is kept for
    // the hall and the market and is never redeveloped.
    let plot = null;
    for (let r = 3; r <= 7 && !plot; r++)
      for (let dy = -r; dy <= r && !plot; dy++)
        for (let dx = -r; dx <= r && !plot; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = town.x + dx, y = town.y + dy;
          if (inside(x, y) && z.zone(town.id, x, y) === "residential") plot = [x, y];
        }
    if (!plot) { fail("the plan has no residential plot within reach of the centre"); return out; }
    cottage.x = plot[0]; cottage.y = plot[1];
    town.zoningRedevelopedYear = null;
    if (!z.redevelopable(town.id).includes(cottage.id))
      fail("a cottage in the middle of the town is not seen as redevelopable");
    const redevelopedBefore = z.counts().redeveloped;
    for (let round = 0; round < 10 && z.gate(town.id).pop < z.gate(town.id).needs; round++)
      for (let i = 0; i < 400; i++) simTick();
    out.gate = z.gate(town.id);
    const residentsBefore = cottage.tenancy ? cottage.tenancy.residents.length : 0;
    town.zoningRedevelopedYear = null;
    out.redevelop = z.redevelop(town.id);
    out.redevelopedTotal = z.counts().redeveloped;
    // Either the town bought a cottage out while it was growing, or it does so
    // when asked now. A grown town with beds to spare must do one or the other.
    if (out.gate.pop >= out.gate.needs && out.gate.spare > 0 && out.redevelopedTotal === redevelopedBefore && !out.redevelop)
      fail("a grown town with beds to spare kept every cottage in its core");
    out.matterAfterRedevelop = auditMatter().delta;
    if (out.matterAfterRedevelop !== beforeMatter)
      fail("redevelopment moved matter: " + beforeMatter + " -> " + out.matterAfterRedevelop);
    if (out.redevelop) {
      const gone = W.buildings.find((b) => b.id === out.redevelop);
      if (!gone || !gone.ruined) fail("the bought-out cottage still stands");
      out.rehoused = residentsBefore;
    }
  }

  // A flat is dearer where it is wanted more.
  const home = W.buildings.find((b) => habitationBeds(b) > 0 && b.placeId === town.id);
  if (home) {
    out.price = z.price(home.id);
    if (!(out.price >= habitationBeds(home) * 4)) fail("a flat is cheaper than its bare bed count: " + out.price);
  }

  // The town's own page reads and never writes.
  const hash = worldHash();
  const page = renderPlacePage(town.id);
  out.pageMentionsZoning = /Zoning and demand/.test(page);
  if (!out.pageMentionsZoning) fail("the place page says nothing about the plan");
  if (worldHash() !== hash) fail("rendering the place page changed the world");
  const renderHash = worldHash();
  window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "iso", quality: "high", zoom: 3, x: town.x, y: town.y, now: 5000 });
  if (worldHash() !== renderHash) fail("drawing the town changed the world");

  out.counts = z.counts();
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "zone-1", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_ZONING_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_ZONING_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
