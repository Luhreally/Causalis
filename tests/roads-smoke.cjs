// Roads smoke: a polity lays a paved road and then rails between two of its
// towns a few tiles a pass, paying from the town stores into a ledger the
// conservation audit counts; the road and rail are chronicled and alerted and
// mark milestones; carts, trucks, and trains roll travellers further along a
// road; the pages name the roads; rendering with roads does not throw.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const rd = window.ALIFE_ROADS_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let settlement = null;
  for (let attempt = 0; attempt < 4 && !settlement; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    settlement = W.settlements.find((s) => !s.ruined);
    if (!settlement) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); settlement = W.settlements.find((s) => !s.ruined); } }
  }
  if (!settlement) { fail("no settlement"); return out; }
  if (!settlement.factionId) createFaction(settlement.id);
  const complete = (place, type) => {
    const b = planBuilding(place, type, 9) || W.buildings.find((x) => !x.ruined && x.placeId === place.id && x.type === type && !x.complete);
    if (b) { b.complete = true; b.stage = 6; b.integrity = b.maxIntegrity; b.completedTick = W.tick; for (const [sp, n] of b.requirements || []) b.composition[sp] = n; }
    return b;
  };
  // A second town of the same polity within road reach and by land.
  const people = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id));
  let second = null;
  for (let tries = 0; tries < 600 && !second && people.length; tries++) {
    const x = 4 + ((tries * 37 + 11) % (W.width - 8)), y = 4 + ((tries * 23) % (W.height - 8)), t = idx(x, y), d = Math.sqrt(dist2(x, y, settlement.x, settlement.y));
    if (d < 14 || d > 44) continue;
    if (W.tiles.liquid[t] > WATER_DEPTH.SURFACE || campNear(t, 6) || nearestSettlement(t, 10)) continue;
    if (!civilReachable(idx(settlement.x, settlement.y), { x, y }, settlement.factionId)) continue;
    const founder = people.pop(), soc = W.components.social[founder];
    if (soc) { soc.homePlaceKind = ""; soc.homePlaceId = 0; }
    const camp = createCamp(t, founder);
    if (!camp) continue;
    for (const type of ["stockpile", "shelter", "hearth"]) complete(camp, type);
    second = createSettlement(camp.id);
  }
  if (!second) { fail("could not raise a second town within road reach"); return out; }
  second.factionId = settlement.factionId;
  for (const id of W.activeIds) { const soc = W.components.social[id]; if (soc?.homePlaceKind === "settlement" && soc.homePlaceId === second.id) soc.factionId = settlement.factionId; }
  const faction = W.factions.find((f) => f.id === settlement.factionId);
  if (!faction) { fail("no faction"); return out; }
  out.distance = Math.round(Math.sqrt(dist2(second.x, second.y, settlement.x, settlement.y)));
  for (const t of [settlement, second]) { t.inventory[C.MINERAL] = Math.max(t.inventory[C.MINERAL], 400); t.inventory[C.METAL] = Math.max(t.inventory[C.METAL], 400); }
  // Nothing is paved without the craft.
  settlement.knownProcesses = settlement.knownProcesses.filter((t) => !["road_building", "railways", "wheel", "combustion"].includes(t));
  second.knownProcesses = second.knownProcesses.filter((t) => !["road_building", "railways", "wheel", "combustion"].includes(t));
  const t0 = W.tick; W.tick = t0 - (t0 % 128) + 72; updateRoads(); W.tick = t0;
  if (rd.tiles().paved) fail("a road was laid without Paved Roads");
  // The polity lays a road and rails, paying from its stores into the ledger.
  const matterBefore = totalMatter(), mineralBefore = settlement.inventory[C.MINERAL] + second.inventory[C.MINERAL];
  let passes = 0, road = null, rail = null;
  for (; passes < 160; passes++) {
    rd.pave(faction.id, "road");
    road = rd.links().find((l) => l.kind === "road" && l.factionId === faction.id) || null;
    if (road?.complete) break;
  }
  out.passes = passes; out.road = road ? { tiles: road.path, paved: road.paved, complete: road.complete } : null;
  if (!road?.complete) fail("the road was not completed: " + JSON.stringify(out.road));
  out.tilesRoad = rd.tiles();
  if (!(out.tilesRoad.paved > 0)) fail("no road tiles were laid");
  out.ledger = rd.matter();
  const mineralAfter = settlement.inventory[C.MINERAL] + second.inventory[C.MINERAL];
  if (!(out.ledger > 0) || mineralAfter >= mineralBefore) fail("the road bed was not paid from the stores: " + JSON.stringify({ ledger: out.ledger, mineralBefore, mineralAfter }));
  if (totalMatter() !== matterBefore) fail("paving created or destroyed matter: " + (totalMatter() - matterBefore));
  const roadEvent = W.events.find((e) => e.type === "RoadEvent");
  if (!roadEvent) fail("no RoadEvent"); else { out.roadSentence = eventSentence(roadEvent); if (!/paved road/.test(out.roadSentence) || !alertWorthy(roadEvent)) fail("the road is not chronicled or alerted: " + out.roadSentence); }
  // Wheels: a cart rolls one tile further along a road, a truck two, a train three.
  const link = W.roads.links.find((l) => l.id === road.id), path = link.path;
  const traveller = W.activeIds.find((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && W.components.social[id]?.factionId === faction.id && !W.components.life[id]?.insideBuildingId);
  if (!traveller) fail("no traveller of the polity");
  else {
    const p = W.components.position[traveller], keep = { x: p.x, y: p.y };
    W.civilOrders = (W.civilOrders || []).filter((o) => o.id !== traveller);
    if (W.components.campaign) delete W.components.campaign[traveller];
    // A start tile with three road tiles ahead of it toward the far end of the road.
    const runStart = (roadPath, steps) => { for (let i = 1; i + steps < roadPath.length - 1; i++) if (roadPath.slice(i, i + steps + 1).every((q) => W.tiles.road[q] >= 1)) return roadPath[i]; return undefined; };
    const place = (tile) => { const [x, y] = xy(tile); p.x = x; p.y = y; p.regionId = regionId(x, y); rebuildSpatialBins(); };
    const townNear = (tile) => { const [x, y] = xy(tile); return dist2(x, y, second.x, second.y) <= dist2(x, y, settlement.x, settlement.y) ? second : settlement; };
    const other = townNear(path[path.length - 1]);
    const start = runStart(path, 3);
    if (start === undefined) fail("no run of road tiles to drive on");
    else {
      out.vehicleNone = rd.vehicle(traveller);
      if (out.vehicleNone) fail("a polity without the wheel has a vehicle: " + out.vehicleNone);
      settlement.knownProcesses.push("wheel"); rd.forget();
      out.vehicleCart = rd.vehicle(traveller);
      if (out.vehicleCart !== "cart") fail("the wheel gives no cart: " + out.vehicleCart);
      place(start);
      issueCivilOrder(traveller, "caravan", other.x, other.y, { placeId: other.id });
      const before = campaignRouteIndex(path, p.x, p.y).index;
      out.trace = rd.trace(traveller);
      rd.drive();
      const afterCart = campaignRouteIndex(path, p.x, p.y).index;
      out.cartSteps = afterCart - before;
      if (out.cartSteps < 1) fail("a cart did not roll further on the road: " + out.cartSteps);
      settlement.knownProcesses.push("combustion"); rd.forget();
      if (rd.vehicle(traveller) !== "motor") fail("combustion gives no motor vehicle");
      place(start);
      rd.drive();
      out.motorSteps = campaignRouteIndex(path, p.x, p.y).index - before;
      if (out.motorSteps < 2) fail("a truck did not roll two tiles: " + out.motorSteps);
      // Then the rails, which follow the road bed and carry everyone three tiles.
      for (let k = 0; k < 160; k++) {
        rd.pave(faction.id, "rail");
        rail = rd.links().find((l) => l.kind === "rail" && l.factionId === faction.id) || null;
        if (rail?.complete) break;
      }
      out.rail = rail ? { tiles: rail.path, paved: rail.paved, complete: rail.complete } : null;
      if (!rail?.complete) fail("the railway was not completed: " + JSON.stringify(out.rail));
      out.tiles = rd.tiles();
      if (!(out.tiles.rail > 0)) fail("no rail tiles were laid");
      const railEvent = W.events.find((e) => e.type === "RailEvent");
      if (!railEvent) fail("no RailEvent"); else { out.railSentence = eventSentence(railEvent); if (!/rails/.test(out.railSentence)) fail("the rail is not chronicled: " + out.railSentence); }
      const milestones = window.ALIFE_TECH_DEBUG.milestones().map((m) => m.key);
      if (!milestones.includes("first-road") || !milestones.includes("first-rail")) fail("the first road and rail are not milestones: " + milestones.join(","));
      const railPath = W.roads.links.find((l) => l.id === rail.id).path, railStart = (() => { for (let i = 1; i + 3 < railPath.length - 1; i++) if (railPath.slice(i, i + 4).every((q) => W.tiles.road[q] === 2)) return railPath[i]; return undefined; })();
      if (railStart !== undefined) {
        const [rx, ry] = xy(railStart); p.x = rx; p.y = ry; p.regionId = regionId(rx, ry); rebuildSpatialBins();
        W.civilOrders = W.civilOrders.filter((o) => o.id !== traveller);
        const railGoal = townNear(railPath[railPath.length - 1]);
        issueCivilOrder(traveller, "caravan", railGoal.x, railGoal.y, { placeId: railGoal.id });
        const b2 = campaignRouteIndex(railPath, p.x, p.y).index;
        rd.drive();
        out.railSteps = campaignRouteIndex(railPath, p.x, p.y).index - b2;
        if (out.railSteps < 3) fail("a train did not carry three tiles: " + out.railSteps);
      } else out.railSkipped = "no run of four rail tiles";
    }
    clearCivilOrder(traveller);
    p.x = keep.x; p.y = keep.y; p.regionId = regionId(keep.x, keep.y); rebuildSpatialBins();
  }
  // Pages and rendering.
  const factionPage = window.ALIFE_LEGENDS_DEBUG.render("faction", faction.id), placePage = window.ALIFE_LEGENDS_DEBUG.render("place", settlement.id);
  if (!/Roads/.test(factionPage)) fail("the polity page does not name its roads");
  if (!/Roads/.test(placePage)) fail("the place page does not name its roads");
  UI.camera.x = settlement.x; UI.camera.y = settlement.y;
  window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "top", quality: "high", zoom: 3, now: 5000 });
  window.ALIFE_VISUAL_DEBUG.renderOnly({ view: "iso", quality: "standard", zoom: 2, now: 5100 });
  if (typeof worldHash === "function" && worldHash() !== worldHash()) fail("rendering roads was not stable");
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_ROADS_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_ROADS_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
