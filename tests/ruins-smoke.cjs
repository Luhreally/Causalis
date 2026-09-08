// Ruins smoke: a town that falls stands empty instead of collapsing, its ghost
// is chronicled, dark, and drawn under a veil without touching the world;
// the years wear the empty buildings down and bring them to rubble, rubble
// sinks into the conserved ground until the ruin is cleared and no longer
// drawn, a living town queues salvage for rubble within reach, planning over
// an emptied ruin clears it, and settlers on a ghost town take up its
// standing buildings.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const ruins = window.ALIFE_RUINS_DEBUG, dl = window.ALIFE_DAYLIGHT_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let settlement = null;
  for (let attempt = 0; attempt < 4 && !settlement; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    settlement = W.settlements.find((s) => !s.ruined);
    if (!settlement) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); settlement = W.settlements.find((s) => !s.ruined); } }
  }
  if (!settlement) { fail("no settlement"); return out; }
  if (!settlement.factionId) createFaction(settlement.id);
  const complete = (place, type) => {
    const b = planBuilding(place, type, 9) || W.buildings.find((x) => !x.ruined && x.placeKind === (place.knownProcesses ? "settlement" : "camp") && x.placeId === place.id && x.type === type);
    if (b) { b.complete = true; b.stage = 6; b.integrity = b.maxIntegrity; b.completedTick = W.tick; for (const [sp, n] of b.requirements || []) b.composition[sp] = n; }
    return b;
  };
  const freeFounder = () => {
    const id = W.activeIds.find((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && !W.components.social[id]?.homePlaceId) || W.activeIds.find((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id));
    if (id) { const soc = W.components.social[id]; if (soc) { soc.homePlaceKind = ""; soc.homePlaceId = 0; } }
    return id;
  };
  const raiseTown = (cx, cy, spread) => {
    for (let tries = 0; tries < 60; tries++) {
      const x = clamp(cx + (tries % 6) * spread, 3, W.width - 4), y = clamp(cy + Math.floor(tries / 6) * spread, 3, W.height - 4), t = idx(x, y);
      if (W.tiles.liquid[t] > WATER_DEPTH.SURFACE || campNear(t, 6) || nearestSettlement(t, 10)) continue;
      const founder = freeFounder();
      if (!founder) return null;
      const camp = createCamp(t, founder);
      if (!camp) continue;
      for (const type of ["stockpile", "shelter", "hearth"]) complete(camp, type);
      const town = createSettlement(camp.id);
      if (town) return town;
    }
    return null;
  };
  // A town with finished buildings, a fire, and a half-built site.
  // Within the living town's salvage reach (fourteen tiles) but outside its founding radius.
  const doomed = raiseTown(settlement.x + 12, settlement.y - 6, 1);
  if (!doomed) { fail("could not raise the doomed town"); return out; }
  for (const t of ["controlled_fire", "masonry"]) if (!doomed.knownProcesses.includes(t)) doomed.knownProcesses.push(t);
  for (const t of ["shelter", "hearth", "workshop", "hall"]) complete(doomed, t);
  const built = W.buildings.filter((b) => b.complete && !b.ruined && b.placeKind === "settlement" && b.placeId === doomed.id);
  const site = planBuilding(doomed, "stockpile", 9);
  if (site) site.composition[site.requirements[0][0]] = 20;
  if (built.length < 3) { fail("could not build the doomed town: " + built.length); return out; }
  out.built = built.length;
  const collapsedBefore = W.events.filter((e) => e.type === "BuildingCollapsedEvent").length,
    sites = W.buildings.filter((b) => !b.complete && !b.ruined && b.placeKind === "settlement" && b.placeId === doomed.id).length;
  out.sites = sites;
  const matterBefore = totalMatter();
  // The town falls: its finished buildings stand empty; only the site is rubble.
  const ev = ruinSettlement(doomed, [], "sacked for the test");
  if (!ev) { fail("the town did not fall"); return out; }
  const standing = ruins.standing(doomed.id);
  out.standing = standing.length;
  if (standing.length !== built.length) fail("the finished buildings did not all stand: " + standing.length + " of " + built.length);
  for (const b of built) if (b.ruined || !b.complete || !b.abandoned) fail(b.name + " did not stand empty");
  if (site && !site.ruined) fail("the half-built site did not fall to rubble");
  out.collapsedAtFall = W.events.filter((e) => e.type === "BuildingCollapsedEvent").length - collapsedBefore;
  if (out.collapsedAtFall !== sites) fail("standing buildings were collapsed at the fall: " + out.collapsedAtFall + " collapses for " + sites + " unfinished sites");
  const ghost = W.events.filter((e) => e.type === "GhostTownEvent").at(-1);
  out.ghost = ghost ? eventSentence(ghost) : "";
  if (!ghost || ghost.data.standing !== standing.length) fail("no ghost town was chronicled: " + out.ghost);
  if (townLighting(built[0]) !== "dark") fail("a ghost town is lit: " + townLighting(built[0]));
  // Drawn under a veil in both lenses, dark at night, and the world untouched.
  const clean = (opts) => { const h0 = worldHash(); window.ALIFE_VISUAL_DEBUG.renderOnly(opts); if (worldHash() !== h0) fail("drawing ruins changed the world (" + opts.view + ")"); };
  ruins.reset();
  clean({ view: "iso", quality: "high", zoom: 3, x: doomed.x, y: doomed.y, now: 5000 });
  out.ghostsIso = ruins.counts().ghostsDrawn;
  ruins.reset();
  clean({ view: "top", quality: "standard", zoom: 3, x: doomed.x, y: doomed.y, now: 5100 });
  out.ghostsTop = ruins.counts().ghostsDrawn;
  if (!(out.ghostsIso >= built.length) || !(out.ghostsTop >= built.length)) fail("the ghost town was not drawn under a veil: " + out.ghostsIso + "/" + out.ghostsTop);
  const h = dl.hemisphereAt(doomed.x, doomed.y), year = W.tick - (W.tick % TICKS_PER_YEAR) + TICKS_PER_YEAR;
  let midnight = year;
  for (let t = year; t < year + TICKS_PER_YEAR; t++) if (dl.lightAt(t, h) < dl.lightAt(midnight, h)) midnight = t;
  const keepTick = W.tick;
  W.tick = midnight;
  const lights = () => (typeof dl.lightsDrawn === "function" ? dl.lightsDrawn() : dl.lightsDrawn);
  clean({ view: "iso", quality: "high", zoom: 6, x: doomed.x, y: doomed.y, now: 5200 });
  out.lightsGhost = lights();
  for (const b of built) b.abandoned = false;
  clean({ view: "iso", quality: "high", zoom: 6, x: doomed.x, y: doomed.y, now: 5300 });
  out.lightsIfLived = lights();
  for (const b of built) b.abandoned = true;
  W.tick = keepTick;
  if (out.lightsGhost !== 0) fail("a ghost town glows at night: " + out.lightsGhost);
  if (!(out.lightsIfLived >= 1)) fail("the same hearths would not glow if the town lived: " + out.lightsIfLived);
  // A year of weather wears the empty buildings without felling them, and conserves matter.
  out.life = built.map((b) => +ruins.life(b.id).toFixed(1));
  out.materials = built.map((b) => ruins.material(b.id));
  if (out.life.some((y) => !(y >= 4))) fail("an empty building would fall within four years: " + out.life.join(","));
  const yearOne = ruins.weather(1);
  out.yearOne = yearOne;
  if (yearOne.fell) fail("buildings fell in the first year of weather");
  for (const b of built) if (!(b.integrity < b.maxIntegrity)) fail(b.name + " did not weather");
  if (site && !(ruinRubble(site) < 20)) fail("the rubble did not sink into the ground: " + ruinRubble(site));
  if (totalMatter() !== matterBefore) fail("weathering did not conserve matter: " + matterBefore + " -> " + totalMatter());
  if (!(yearOne.salvage >= 1)) fail("no living town queued salvage for the rubble within reach");
  if (!W.workOrders.some((o) => o.type === "salvage" && o.status === "open" && o.placeId === settlement.id)) fail("the living town holds no open salvage order");
  // Settlers on the ghost town take up its standing buildings.
  out.pageRuin = /Ruins<\/span>/.test(renderLegendPage ? renderLegendPage("place", doomed.id) : "");
  if (!out.pageRuin) fail("the ruin's page shows no ruins row");
  const heir = raiseTown(doomed.x, doomed.y, 1);
  if (!heir) { fail("could not settle the ghost town"); return out; }
  out.heirDistance = Math.sqrt(dist2(heir.x, heir.y, doomed.x, doomed.y));
  out.reclaimed = heir.reclaimed || null;
  const near = built.filter((b) => dist2(b.x, b.y, heir.x, heir.y) <= 49);
  out.near = near.length;
  if (!(out.reclaimed?.count >= Math.max(1, near.length))) fail("the settlers took up no standing buildings: " + JSON.stringify(out.reclaimed));
  for (const b of near) if (b.placeId !== heir.id || b.abandoned) fail(b.name + " was not taken up");
  if (ruins.standing(doomed.id).some((id) => { const b = W.buildings.find((x) => x.id === id); return dist2(b.x, b.y, heir.x, heir.y) <= 49; })) fail("buildings within reach still stand empty after being taken up");
  if (!(heir.housing > 0)) fail("the taken buildings add no housing");
  const reclaimEv = W.events.filter((e) => e.type === "TownReclaimedEvent").at(-1);
  out.reclaimSentence = reclaimEv ? eventSentence(reclaimEv) : "";
  if (!reclaimEv) fail("no TownReclaimedEvent");
  if (!/Reclaimed<\/span>/.test(renderLegendPage ? renderLegendPage("place", heir.id) : "")) fail("the heir's page shows no reclaimed row");
  // Planning over an emptied ruin clears it.
  if (site) {
    for (let sp = 0; sp < site.composition.length; sp++) site.composition[sp] = 0;
    const planned = planBuilding(heir, "shelter", 9);
    if (planned) { planned.x = site.x; planned.y = site.y; out.clearedUnder = ruins.clearUnder(planned.id); if (!(out.clearedUnder >= 1) || !site.cleared) fail("planning over an emptied ruin did not clear it"); }
  }
  // The heir falls in turn; sixty years of weather fell the ghosts and clear the rubble, conserving matter.
  const matterMid = totalMatter();
  ruinSettlement(heir, [], "sacked again for the test");
  out.standingAgain = ruins.standing(heir.id).length;
  if (!(out.standingAgain >= built.length)) fail("the heir's buildings did not stand empty: " + out.standingAgain);
  let fell = 0;
  for (let y = 0; y < 60; y++) fell += ruins.weather(1).fell;
  out.fell = fell;
  if (fell !== out.standingAgain) fail("the years did not fell every empty building: " + fell + " of " + out.standingAgain);
  for (const b of built) if (!b.ruined || b.abandoned) fail(b.name + " still stands after sixty years");
  out.rubbleLeft = ruins.rubble(heir.id).length;
  out.cleared = ruins.cleared(heir.id);
  if (out.rubbleLeft !== 0 || !(out.cleared >= out.standingAgain)) fail("rubble remains after sixty years: " + out.rubbleLeft + " left, " + out.cleared + " cleared");
  if (totalMatter() !== matterMid) fail("sixty years of weather did not conserve matter: " + matterMid + " -> " + totalMatter());
  const weatherFall = W.events.filter((e) => e.type === "BuildingCollapsedEvent" && /weather/.test(e.evidence[0] || "")).length;
  if (!(weatherFall >= out.standingAgain)) fail("the falls were not chronicled as weather: " + weatherFall);
  ruins.reset();
  clean({ view: "iso", quality: "high", zoom: 3, x: heir.x, y: heir.y, now: 5400 });
  out.afterCounts = ruins.counts();
  if (out.afterCounts.ghostsDrawn !== 0 || !(out.afterCounts.skipped >= out.standingAgain)) fail("cleared ruins are still drawn: " + JSON.stringify(out.afterCounts));
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_RUINS_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_RUINS_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
