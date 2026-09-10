// Modern smoke: a polity with one fully teched city, its tower, its factory,
// and its launch tower still cannot send a ship until the world is modern (two
// cities, current in three towns, three towers or offices, two factories, a
// road, a hundred people); the shortfall names what is missing, the causal
// push raises those things and brings the stone the road is paved with, the
// stage list carries them before Starflight,
// skylines want more towers and offices, and the countryside gains hedgerows,
// scarecrows, and windmills.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const modern = window.ALIFE_MODERN_DEBUG, eras = window.ALIFE_ERAS_DEBUG, push = window.ALIFE_CAUSAL_PUSH_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
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
  // The effort sends the ship itself when nothing is missing, rather than
  // leaving a world at the edge of its conditions to win a roll of the dice.
  const shipsBefore = W.ascensions.slice();
  W.ascensions.length = 0;
  out.ascensionShortfall = modern.shortfall();
  out.ascensionPushShip = causalPushToward({ key: "ascension", pushes: 3 });
  out.shipFromPush = W.ascensions.length > 0;
  if (!out.ascensionShortfall.length && !out.shipFromPush) fail("the ascension push sent no ship from a world with nothing missing");
  W.ascensions.length = 0;
  for (const a of shipsBefore) W.ascensions.push(a);
  W.roads.links = W.roads.links.filter((l) => l !== link);
  // Stone to the road: a polity that knows road building but holds no stone
  // paves nothing, and the road push brings the stone so the link advances.
  grant(s, "road_building");
  f.stability = Math.max(f.stability || 0, 0.5);
  for (const town of [s, b, c]) town.inventory[C.MINERAL] = 0;
  ensureRoads();
  const pavedTotal = () => W.roads.links.filter((l) => l.factionId === f.id && l.kind === "road" && !l.abandoned).reduce((n, l) => n + l.paved, 0);
  out.pavedWithoutStone = roadPassFor(f, false, "road").road;
  if (out.pavedWithoutStone > 0) fail("a polity with no stone paved " + out.pavedWithoutStone + " tiles");
  if (!W.roads.links.some((l) => l.factionId === f.id && l.kind === "road" && !l.abandoned)) fail("no road link was started between the towns");
  const pavedBefore = pavedTotal(), inputBefore = W.conservation.playerInput;
  out.roadPush = modern.push("road");
  out.pavedByPush = pavedTotal() - pavedBefore;
  out.roadStoneBooked = W.conservation.playerInput - inputBefore;
  if (!(out.roadStoneBooked > 0)) fail("the road push brought no stone: " + out.roadStoneBooked);
  if (!(out.pavedByPush > 0)) fail("the road push laid no stone: " + out.pavedByPush);
  // A road between neighbours under different flags is still a road: no polity
  // here has two towns, and the push must still pave one.
  for (const l of W.roads.links) l.abandoned = true;
  for (const town of [b, c]) town.factionId = 0;
  for (const town of [s, b, c]) town.inventory[C.MINERAL] = 0;
  out.strangerPolities = W.factions.filter((x) => x.stability > 0 && polityTownsOf(x).length >= 2).length;
  if (out.strangerPolities) fail("a polity still holds two towns; the stranger road is not being tested");
  const strangerPaved = () => W.roads.links.filter((l) => l.kind === "road" && !l.abandoned).reduce((n, l) => n + l.paved, 0);
  const strangerBefore = strangerPaved(), strangerInput = W.conservation.playerInput;
  out.strangerPush = modern.push("road");
  out.strangerPavedBy = strangerPaved() - strangerBefore;
  out.strangerStone = W.conservation.playerInput - strangerInput;
  if (!(out.strangerStone > 0)) fail("the road push brought no stone across the border: " + out.strangerStone);
  if (!(out.strangerPavedBy > 0)) fail("the road push laid nothing between towns of different flags: " + out.strangerPavedBy);
  for (const town of [b, c]) town.factionId = f.id;
  // The groundwork for a tower is sought side by side: a world whose lead city
  // lacks two of the understandings sets more than one town to work on them.
  for (const town of W.settlements) { if (town.ruined) continue; town.knownProcesses = town.knownProcesses.filter((x) => x !== "combustion" && x !== "computing"); town.researchFocus = ""; }
  out.groundwork = modern.groundwork(modernLaunchSite()?.id || 0);
  if (!(out.groundwork.length >= 2)) fail("the launch site lacks fewer than two understandings: " + out.groundwork.join(","));
  out.towerPush = causalPushToward({ key: "tower", pushes: 2 });
  out.groundworkWorking = W.settlements.filter((x) => !x.ruined && x.researchFocus).length;
  if (!(out.groundworkWorking >= 2)) fail("the tower push set " + out.groundworkWorking + " town to work alone");
  out.groundworkLead = push.lead();
  // A ship leaves from one place: the effort picks the town that holds the
  // tower and teaches that town to fly, not whichever town happens to lead.
  out.site = modern.site();
  if (out.site !== s.name) fail("the launch site is not the town with the tower: " + out.site + " vs " + s.name);
  // The place does not move under the work when another town outgrows it.
  const held = modern.siteId();
  for (const id of W.activeIds) { const soc = W.components.social[id]; if (soc?.homePlaceKind === "settlement" && soc.homePlaceId === s.id) { soc.homePlaceId = b.id; } }
  rebuildSpatialBins();
  out.siteAfterGrowth = modern.site();
  out.siteHeld = modern.siteId() === held;
  if (!out.siteHeld) fail("the launch site moved when another town outgrew it: " + out.siteAfterGrowth);
  grant(s, "combustion", "computing");
  for (const town of W.settlements) { if (town.ruined) continue; town.knownProcesses = town.knownProcesses.filter((x) => x !== "starflight"); town.researchFocus = ""; }
  out.ascensionPush = causalPushToward({ key: "ascension", pushes: 2 });
  out.ascensionFocus = s.researchFocus || "";
  // The Starflight stage teaches the place the ship leaves from, not the lead.
  for (const town of W.settlements) { if (!town.ruined) town.researchFocus = ""; }
  out.starflightPush = causalPushToward({ key: "starflight", pushes: 2 });
  out.starflightFocus = s.researchFocus || "";
  if (out.starflightFocus !== "starflight") fail("the Starflight stage did not set the launch site to work on it: " + out.starflightFocus);
  if (out.ascensionPush !== "research") fail("the ascension push pushed no research: " + out.ascensionPush);
  if (out.ascensionFocus !== "starflight") fail("the ascension push did not set the launch site to work on Starflight: " + out.ascensionFocus);
  // A site that knows how to fly but holds no tower gets one raised, even
  // though a tower stands elsewhere in the world.
  grant(s, "starflight");
  for (const x of W.buildings) if (!x.ruined && x.placeKind === "settlement" && x.placeId === s.id && x.type === "launch_tower") x.ruined = true;
  out.towerlessPush = causalPushToward({ key: "ascension", pushes: 3 });
  out.towerRaised = W.buildings.filter((x) => !x.ruined && x.placeKind === "settlement" && x.placeId === s.id && x.type === "launch_tower").length;
  if (out.towerlessPush !== "tower") fail("the ascension push raised no tower for a site without one: " + out.towerlessPush);
  if (!(out.towerRaised > 0)) fail("no launch tower was planned at the launch site");
  // The effort feeds the hands it works: a town in famine gets bread carried to
  // it, and its second field, half raised beside a finished one, gets supplied
  // where the push used to see the finished one and call the town served.
  const hungerTown = c;
  // Clear the town's fields so the finished one stands first in the world's
  // list and the planned one after it, which is the order that hid the second.
  for (const x of W.buildings) if (!x.ruined && x.placeKind === "settlement" && x.placeId === hungerTown.id && x.type === "farm") x.ruined = true;
  if (!complete(hungerTown, "farm")) fail("no field could be finished");
  const secondFarm = planBuilding(hungerTown, "farm", 9);
  if (!secondFarm) fail("no second field could be planned");
  out.fieldOrder = W.buildings.filter((x) => !x.ruined && x.placeKind === "settlement" && x.placeId === hungerTown.id && x.type === "farm").map((x) => (x.complete ? "done" : "planned"));
  hungerTown.inventory[C.ORGANIC] = 0;
  for (const id of W.activeIds) {
    const soc = W.components.social[id];
    if (soc?.homePlaceKind === "settlement" && soc.homePlaceId === hungerTown.id) {
      const life = W.components.life?.[id];
      if (life) life.hunger = 90;
    }
  }
  out.hungerFamine = !!foodOutlook(hungerTown)?.famine;
  if (!out.hungerFamine) fail("the starved town does not read famine");
  out.pushUnfinishedField = causalPushBuilding(hungerTown, "farm", 3);
  if (!out.pushUnfinishedField) fail("the push saw the finished field beside the unfinished one and called the town fed");
  const breadBefore = hungerTown.inventory[C.ORGANIC] || 0, inputBeforeBread = W.conservation.playerInput;
  out.fed = modern.feed(1);
  out.bread = (hungerTown.inventory[C.ORGANIC] || 0) - breadBefore;
  out.breadBooked = W.conservation.playerInput - inputBeforeBread;
  if (!(out.fed > 0)) fail("the effort fed no starving town");
  if (!(out.bread > 0)) fail("the effort carried no food to the starving town: " + out.bread);
  if (!(out.breadBooked >= out.bread)) fail("the food was not booked as the player's doing: " + out.breadBooked);
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
  // A stage the world has already reached does not end a later press: it is
  // still worked toward, but reaching it again is not news.
  const notDone = causalSkipMicroStages().find((x) => !x.done());
  if (!notDone) fail("every micro-stage is done; the quiet flag cannot be checked");
  else {
    W.causalReached = [];
    modernRecordReached({ stopReason: "milestone", milestone: { key: notDone.key } });
    out.reached = modern.reached();
    if (!out.reached.includes(notDone.key)) fail("the skip recorded no stage it reached: " + JSON.stringify(out.reached));
    const again = makeCausalSkipState(64).pending.find((x) => x.key === notDone.key);
    out.quietStage = again ? !!again.quiet : null;
    if (!out.quietStage) fail("a stage already reached is not marked quiet: " + notDone.key);
    W.causalReached = [];
  }
  // A quiet stage that is already met does not end the press; a loud one does.
  const stepOnce = (quiet) => {
    const st = makeCausalSkipState(64);
    st.startStageIndex = 1e9;
    st.startBiosphereStage = W.biosphere?.stage || "";
    st.pending = [{ key: "test-stage", label: "a stage for the test", quiet, done: () => true }];
    while (W.tick % 16 !== 15) simTick();
    causalSkipStep(st);
    return st;
  };
  out.quietDidNotStop = !stepOnce(true).done;
  out.loudDidStop = stepOnce(false).stopReason === "milestone";
  if (!out.quietDidNotStop) fail("a stage already reached still ended the press");
  if (!out.loudDidStop) fail("a stage not yet reached no longer ends the press");
  // A skip that ends smaller than it began says what it cost, in people.
  out.skipToll = causalSkipResult(st).toll;
  if (!(out.skipToll > 0)) fail("the skip named no toll after the world was struck: " + out.skipToll);
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
