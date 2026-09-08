// Modern smoke: a polity with one fully teched city, its tower, its factory,
// and its launch tower still cannot send a ship until the world is modern (two
// cities, current in three towns, three towers or offices, two factories, a
// road, a hundred people); the shortfall names what is missing, the causal
// push raises those things, the stage list carries them before Starflight,
// skylines want more towers and offices, and the countryside gains hedgerows,
// scarecrows, and windmills.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const modern = window.ALIFE_MODERN_DEBUG, eras = window.ALIFE_ERAS_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let s = null;
  for (let attempt = 0; attempt < 4 && !s; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    s = W.settlements.find((x) => !x.ruined);
    if (!s) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); s = W.settlements.find((x) => !x.ruined); } }
  }
  if (!s) { fail("no settlement"); return out; }
  if (!s.factionId) createFaction(s.id);
  const f = W.factions.find((x) => x.id === s.factionId);
  const finish = (b) => { if (b) { b.complete = true; b.stage = 6; b.integrity = b.maxIntegrity; b.completedTick = W.tick; for (const [sp, n] of b.requirements || []) b.composition[sp] = n; } return b; };
  const complete = (place, type) => finish(planBuilding(place, type, 9) || W.buildings.find((x) => !x.ruined && x.placeKind === (place.knownProcesses ? "settlement" : "camp") && x.placeId === place.id && x.type === type && !x.complete));
  const grant = (place, ...techs) => { for (const t of techs) if (!place.knownProcesses.includes(t)) place.knownProcesses.push(t); };
  const freeFounder = () => {
    const id = W.activeIds.find((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && !W.components.social[id]?.homePlaceId) || W.activeIds.find((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id));
    if (id) { const soc = W.components.social[id]; if (soc) { soc.homePlaceKind = ""; soc.homePlaceId = 0; } }
    return id;
  };
  const raiseTown = (cx, cy) => {
    for (let tries = 0; tries < 60; tries++) {
      const x = clamp(cx + (tries % 6), 3, W.width - 4), y = clamp(cy + Math.floor(tries / 6), 3, W.height - 4), t = idx(x, y);
      if (W.tiles.liquid[t] > WATER_DEPTH.SURFACE || campNear(t, 6) || nearestSettlement(t, 10)) continue;
      const founder = freeFounder(); if (!founder) return null;
      const camp = createCamp(t, founder); if (!camp) continue;
      for (const type of ["stockpile", "shelter", "hearth"]) complete(camp, type);
      const town = createSettlement(camp.id);
      if (town) { town.factionId = f.id; return town; }
    }
    return null;
  };
  // One fully teched city with everything a single city needs.
  grant(s, "writing", "navigation", "astronomy", "mechanization", "waterworks", "sanitation", "public_works", "planetary_stewardship", "chemistry", "combustion", "electricity", "computing", "masonry", "starflight");
  s.stage = "urban"; s.stability = Math.max(s.stability || 0, 0.6);
  for (const type of ["launch_tower", "tower", "factory"]) if (!complete(s, type)) fail("could not raise a " + type);
  out.shortfall = modern.shortfall(f.id);
  if (!(out.shortfall.length >= 3)) fail("a lone city is already a modern world: " + out.shortfall.join(","));
  out.shipAlone = !!eras.launch(s.id, false);
  if (out.shipAlone) fail("a ship left before the world was modern");
  // The stage list carries the modern world before Starflight.
  out.stages = modern.stages(f.id).map((x) => x.key);
  if (!["cities", "current", "skyline", "works", "road", "hundred"].every((k) => out.stages.includes(k))) fail("the modern stages are incomplete: " + out.stages.join(","));
  // Denser skylines.
  out.towersWanted = modern.towers(s.id); out.officesWanted = modern.offices(s.id);
  if (!(out.towersWanted >= 2)) fail("an electric city wants fewer than two towers");
  // Build the modern world: two more towns, current in three, skylines, works, a road, a hundred people.
  const b = raiseTown(s.x + 12, s.y - 6), c = raiseTown(s.x - 12, s.y + 8);
  if (!b || !c) { fail("could not raise the other towns"); return out; }
  grant(b, "masonry", "mechanization", "electricity", "medicine", "governance", "writing"); grant(c, "electricity");
  const living = () => W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && W.components.social[id] && W.components.position[id]);
  for (let n = 0; living().length < 110 && n < 120; n++) createOrganism(KINDS.PERSON, s.x, s.y, makeRng(hashParts(W.seedHash, "modern-fixture", n), "birth"), []);
  living().forEach((id, i) => { const soc = W.components.social[id], p = W.components.position[id], target = i % 3 === 0 ? b : i % 3 === 1 ? c : s; soc.homePlaceKind = "settlement"; soc.homePlaceId = target.id; soc.factionId = f.id; p.x = clamp(target.x + (i % 5) - 2, 1, W.width - 2); p.y = clamp(target.y + (Math.floor(i / 5) % 5) - 2, 1, W.height - 2); });
  rebuildSpatialBins();
  // The push raises what is missing: a second city, then skylines and works.
  out.pushCities = modern.push("cities");
  for (const type of ["hall", "clinic", "shelter", "shelter", "workshop", "kiln", "stockpile", "hearth"]) complete(b, type);
  b.stage = "urban";
  out.pushSkyline = modern.push("skyline");
  out.pushWorks = modern.push("works");
  for (const town of [s, b]) for (const x of W.buildings) if (!x.ruined && !x.complete && x.placeKind === "settlement" && x.placeId === town.id && ["tower", "office", "factory", "hall", "clinic"].includes(x.type)) finish(x);
  while (modern.shortfall(f.id).some((m) => /tower blocks/.test(m))) { if (!complete(b, "tower") && !complete(s, "tower")) break; }
  while (modern.shortfall(f.id).some((m) => /factories/.test(m))) { if (!complete(b, "factory") && !complete(s, "factory")) break; }
  ensureRoads();
  const link = { id: 9101, factionId: f.id, a: s.id, b: b.id, kind: "road", complete: true, path: [idx(s.x, s.y), idx(b.x, b.y)], tiles: 2, completedEventId: 0 };
  W.roads.links.push(link);
  out.people = W.settlements.filter((x) => !x.ruined && x.factionId === f.id).reduce((n, x) => n + settlementPopulation(x), 0);
  out.shortfallAfter = modern.shortfall(f.id);
  if (out.shortfallAfter.length) fail("the modern world still falls short: " + out.shortfallAfter.join(","));
  out.shipModern = !!eras.launch(s.id, false);
  if (!out.shipModern) fail("no ship left the modern world");
  W.roads.links = W.roads.links.filter((l) => l !== link);
  // Countryside: hedgerows, scarecrows, and windmills over the farms.
  for (let n = 0; n < 4; n++) complete(s, "farm");
  grant(s, "windmills");
  const farm = W.buildings.find((x) => !x.ruined && x.complete && x.type === "farm" && x.placeKind === "settlement" && x.placeId === s.id);
  modern.reset();
  const h0 = worldHash();
  window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "iso", quality: "high", zoom: 3, x: farm ? farm.x : s.x, y: farm ? farm.y : s.y, now: 5000 });
  if (worldHash() !== h0) fail("drawing the countryside changed the world");
  out.countryside = modern.counts();
  if (!(out.countryside.hedgerows >= 1)) fail("no hedgerows along the fields");
  if (!(out.countryside.windmills + out.countryside.scarecrows >= 1)) fail("no windmill or scarecrow over the farms");
  // The skip halts when the world's people halve since it began.
  const st = makeCausalSkipState(4096);
  st.startStageIndex = 1e9; st.pending = [];
  out.startPeople = st.startPeople;
  const alive = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id));
  for (const id of alive.slice(0, Math.ceil(alive.length * 0.6))) killEntity(id, "struck for the test");
  for (let i = 0; i < 600 && !st.done; i++) causalSkipStep(st);
  out.skipStop = st.stopReason; out.skipTicks = st.advanced;
  if (st.stopReason !== "collapse") fail("the skip did not halt on a collapsing world: " + st.stopReason + " after " + st.advanced);
  if (!(st.milestone && /halving/.test(st.milestone.label))) fail("the collapse stop names no halving");
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_MODERN_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_MODERN_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
