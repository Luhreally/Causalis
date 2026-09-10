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
