const assert = require("node:assert/strict");
const { loadRuntime } = require("../scripts/runtime-probe.cjs");
const rt = loadRuntime();
rt.game.createTestWorld({ seed: "x3", size: "small" });
rt.sandbox.window.ALIFE_CONTROL_DEBUG.createCivicTestScenario();
const result = rt.get(`(() => {
  const out = { failures: [] }, fail = (text) => out.failures.push(text);
  for (let i = 0; i < 160; i++) simTick();
  let town = W.settlements.find((s) => !s.ruined);
  if (!town) { const camp = W.camps.find((c) => c.active); if (camp) town = createSettlement(camp.id); }
  if (!town) { fail("fixture has no town"); return out; }
  if (!town.factionId) createFaction(town.id);
  town.stage = "urban";
  for (const id of ["masonry", "governance", "electricity", "combustion", "mechanization", "currency", "starflight", "writing"])
    if (!town.knownProcesses.includes(id)) town.knownProcesses.push(id);
  const make = (type) => {
    const b = planBuilding(town, type, 9);
    if (b) { b.complete = true; b.stage = 6; b.integrity = b.maxIntegrity; b.completedTick = W.tick;
      for (const [sp, n] of b.requirements) b.composition[sp] = n; }
    return b;
  };
  const tower = make("tower"), house = make("shelter");
  if (!tower || !house) { fail("fixture could not build homes"); return out; }
  const people = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id)).slice(0, 12);
  for (const id of people) {
    Object.assign(W.components.social[id], { homePlaceKind: "settlement", homePlaceId: town.id, factionId: town.factionId });
    const inv = W.components.inventory[id].materials;
    inv[C.FIBER] += 4; inv[C.PIGMENT] += 4;
  }
  const faction = polityOfPlace(town); faction.treasury = 200;
  const coins = () => faction.treasury + Object.values(W.components.identity).reduce((n, ident) => n + (ident?.civicCoins || 0), 0);
  const beforeMatter = totalMatter(), beforeCoins = coins();
  const homes = updateHabitationTown(town); habitationAccounts(town, homes);
  if (totalMatter() !== beforeMatter) fail("furnishing moved matter out of the audit");
  if (coins() !== beforeCoins) fail("wages or rents created coins");
  const allResidents = homes.flatMap((b) => b.tenancy.residents);
  if (new Set(allResidents).size !== allResidents.length) fail("one person rents two beds");
  for (const b of homes) if (b.tenancy.residents.length > habitationBeds(b)) fail("housing capacity exceeded");
  const address = JSON.stringify(people.map((id) => habitationHome(id)?.id || 0));
  updateHabitationTown(town);
  if (address !== JSON.stringify(people.map((id) => habitationHome(id)?.id || 0))) fail("addresses changed without a household change");
  const resident = people.find((id) => habitationHome(id));
  if (preferredReturnBuilding(resident)?.id !== habitationHome(resident)?.id) fail("resident returns to a different home");
  out.furnishings = homes.reduce((n, b) => n + b.tenancy.decor.length, 0);
  if (!out.furnishings) fail("no resident furnished their home");
  UI.camera.cutaway = true; UI.camera.zoom = 6;
  const hash = worldHash(), state = makeInteriorState({ x0: 0, y0: 0, x1: W.width, y1: W.height });
  if (!state.visible.has(tower.id)) fail("tower absent from cutaway");
  if (state.homeByPerson.get(resident) !== habitationHome(resident)?.id) fail("rendered address differs from tenancy");
  for (const view of ["top", "iso", "oblique"]) window.ALIFE_VISUAL_DEBUG.renderOnly({ view, quality: "high", zoom: 6, x: town.x, y: town.y, now: 6000 });
  if (worldHash() !== hash) fail("rendering mutated W");
  const encoded = JSON.stringify(snapshot(), saveReplacer), decoded = JSON.parse(encoded, saveReviver);
  if (!encoded.includes('"tenancy"')) fail("save omitted tenancies");
  const original = W; W = decoded.world;
  if (worldHash() !== decoded.savedHash) fail("tenancies fail save hash roundtrip");
  W = original;
  out.saved = !!decoded;
  const inquiry = causalSkipMicroStages().filter((s) => s.key.startsWith("inquiry:"));
  if (!inquiry.length || !inquiry.some((s) => !s.done())) fail("Starflight has no further research objective");
  // The effort tends the sky: under a hazed or heavy sky the inquiry leads with
  // Ecological Engineering, and the craft is not done while a straining town lacks it.
  {
    const strainWas = ensureAfternoon(W).strain;
    W.afternoon.strain = 3;
    const heavyList = causalSkipMicroStages().filter((s) => s.key.startsWith("inquiry:")),
      stageOf = (list, id) => list.find((s) => s.key === "inquiry:" + id);
    out.skyFirst = heavyList.slice(0, 3).map((s) => s.key.slice(8));
    if (out.skyFirst.join() !== "planetary_stewardship,ecological_engineering,fusion") fail("a heavy sky does not put the sky crafts first: " + out.skyFirst.join());
    const eco = stageOf(heavyList, "ecological_engineering");
    if (!eco) fail("no Ecological Engineering stage");
    else {
      if (eco.done()) fail("the sky craft is done while a straining town lacks it");
      const skyTown = window.ALIFE_CONTINUING_DEBUG.sky().crafts.find((c) => c.id === "ecological_engineering")?.town;
      if (skyTown !== town.name) fail("the sky push does not aim at the straining town: " + skyTown);
      town.knownProcesses.push("ecological_engineering");
      if (!eco.done()) fail("the sky craft is not done when every straining town knows it");
      town.knownProcesses = town.knownProcesses.filter((t) => t !== "ecological_engineering");
    }
    // Once one town knows the craft, a push carries it to a straining town that lacks it and holds its priors and its hall.
    {
      const twin = { ...town, id: 100002, name: "Twin hall", x: clamp(town.x + 3, 2, W.width - 3), y: clamp(town.y + 3, 2, W.height - 3), knownProcesses: town.knownProcesses.filter((t) => t !== "ecological_engineering"), inventory: new Uint16Array(town.inventory), importantEvents: [] };
      W.settlements.push(twin);
      const hall = planBuilding(twin, "hall", 9);
      if (hall) { hall.complete = true; hall.stage = 6; hall.integrity = hall.maxIntegrity; hall.completedTick = W.tick; for (const [sp, n] of hall.requirements || []) hall.composition[sp] = n; }
      for (const t of ["planetary_stewardship", "chemistry"]) { if (!town.knownProcesses.includes(t)) town.knownProcesses.push(t); if (!twin.knownProcesses.includes(t)) twin.knownProcesses.push(t); }
      town.knownProcesses.push("ecological_engineering");
      const matterT = totalMatter(), inputT = W.conservation.playerInput;
      causalPushToward({ key: "inquiry:ecological_engineering", pushes: 3 });
      out.taught = twin.knownProcesses.includes("ecological_engineering");
      if (!hall) fail("fixture could not give the twin a hall");
      else if (!out.taught) fail("the push did not carry the sky craft to the straining town that lacked it");
      if (totalMatter() - matterT !== W.conservation.playerInput - inputT) fail("carrying a craft moved matter");
      W.settlements.splice(W.settlements.indexOf(twin), 1);
      for (let i = W.buildings.length - 1; i >= 0; i--) if (W.buildings[i].placeKind === "settlement" && W.buildings[i].placeId === twin.id) W.buildings.splice(i, 1);
      town.knownProcesses = town.knownProcesses.filter((t) => t !== "ecological_engineering");
    }
    W.afternoon.strain = 0.6;
    if (causalSkipMicroStages().filter((s) => s.key.startsWith("inquiry:"))[0]?.key !== "inquiry:planetary_stewardship") fail("a hazed sky does not lead with the sky crafts");
    W.afternoon.strain = 0.2;
    const clearList = causalSkipMicroStages().filter((s) => s.key.startsWith("inquiry:"));
    if (/planetary_stewardship|ecological_engineering|fusion/.test(clearList[0]?.key || "")) fail("a clear sky still leads with a sky craft: " + clearList[0]?.key);
    W.afternoon.strain = strainWas;
  }
  const target = inquiry.find((s) => !s.done()), matter0 = totalMatter(), input0 = W.conservation.playerInput;
  causalPushToward({ key: target.key, pushes: 8 });
  if (!town.researchFocus) fail("post-flight push did not set real research");
  if (totalMatter() - matter0 !== W.conservation.playerInput - input0) fail("research input is not booked");
  const effortMatter = totalMatter(), effortInput = W.conservation.playerInput;
  causalSkipIntervene();
  if (totalMatter() - effortMatter !== W.conservation.playerInput - effortInput) fail("intervention booked matter before it arrived");
  out.research = town.researchFocus;
  // Full homes release their residents when lost; inspectors cannot leave a
  // surviving person assigned to a ruin.
  const oldHome = habitationHome(resident); oldHome.ruined = true;
  updateHabitationTown(town);
  if (habitationHome(resident)?.id === oldHome.id) fail("resident still lives in a ruin");
  // A funded route boards a living traveller, follows laid tiles, and delivers
  // that same person. Wages, buses and decorations keep their separate ledgers.
  const second = { ...town, id: 100001, x: clamp(town.x + 5, 2, W.width - 2), inventory: new Uint16Array(town.inventory), name: "Route endpoint" };
  W.settlements.push(second); ensureRoads(); town.stage = second.stage = "urban";
  const path = [], sign = second.x > town.x ? 1 : -1;
  for (let x = town.x; x !== second.x + sign; x += sign) {
    const tile = idx(x, town.y); path.push(tile); W.tiles.road[tile] = ROAD_PAVED; W.tiles.fire[tile] = 0;
  }
  const link = { id: W.roads.nextId++, a: town.id, b: second.id, path, complete: true, kind: "road" };
  W.roads.links.push(link); town.inventory[C.METAL] += 40;
  const p = W.components.position[resident]; p.x = town.x; p.y = town.y;
  W.components.life[resident].insideBuildingId = 0; W.components.life[resident].transitLinkId = 0;
  W.civilOrders = [{ id: resident, kind: "journey", x: second.x, y: second.y }];
  W.tick = Math.ceil(W.tick / 256) * 256 + 112;
  const roadMatter = totalMatter(); publicTransportPass();
  if (totalMatter() !== roadMatter) fail("route vehicle lost its metal");
  const route = publicRoutes().find((r) => r.linkId === link.id);
  if (!route?.passengers.includes(resident)) fail("traveller did not board the public route");
  for (let n = 0; n < 100 && !(W.publicTransport?.journeys > 0); n++) { W.tick += 4; publicTransportPass(); }
  if (!(W.publicTransport?.journeys > 0) || p.x !== second.x || p.y !== second.y) fail("public route did not deliver its traveller");
  if (W.components.life[resident].transitLinkId) fail("arriving traveller remains aboard");
  out.journeys = W.publicTransport?.journeys || 0;
  return out;
})()`);
assert.deepEqual(Array.from(result.failures), [], JSON.stringify(result));
const signatures = [];
for (const seed of ["causal-origin", "ship-b", "ship-c"]) {
  rt.game.createTestWorld({ seed, size: "battery", complexity: "lean" });
  const design = rt.sandbox.window.ALIFE_DESIGN_DEBUG;
  const first = JSON.stringify([design.world(), design.car(100, 50)]);
  rt.game.createTestWorld({ seed, size: "battery", complexity: "lean" });
  assert.equal(JSON.stringify([design.world(), design.car(100, 50)]), first, "same seed changed its design");
  signatures.push(first);
}
assert.equal(new Set(signatures).size, 3, "different seeds share a design");
console.log(JSON.stringify({ ok: true, result, distinctSeeds: signatures.length }, null, 2));
