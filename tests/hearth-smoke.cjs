// Hearth smoke: a town's reach is two tiles past its farthest finished
// building, never under eight nor over twenty-four; a resident standing
// fourteen tiles from the hall is fed from home once the town has built out
// that far, and not before; the meal moves rations from the store into the
// eater; behind the ship a store at its seed reserve feeds nobody at home and
// the daily draw reaches a member fourteen tiles out and a member six tiles
// out the base draw refused as a hostile visitor for their flag; the meal at
// the hall leaves the seed reserve in the store; a full store gives a hungry
// town a full ration and a store at its reserve is stretched; a day's meals
// from the store are one gut's worth; a lean town's herd is fed no bread; a
// stranger's meal is judged as before; behind the ship a hoard in a resident's gut
// goes back to the store; and reading the reach never writes the
// world.
const fs = require("node:fs");

const smokeSource = fs.readFileSync(require.resolve("./smoke-test.cjs"), "utf8");
const harnessEnd = smokeSource.indexOf('if (process.env.SETTLEMENT_DEBUG === "1")');
if (harnessEnd < 0) throw new Error("Unable to locate the shared smoke-test harness");

const fixtureSource = String.raw`(() => {
  const hearth = window.ALIFE_HEARTH_DEBUG, out = { failures: [] }, fail = (m) => out.failures.push(m);
  let s = null;
  for (let attempt = 0; attempt < 4 && !s; attempt++) {
    for (let i = 0; i < 160; i++) simTick();
    s = W.settlements.find((x) => !x.ruined);
    if (!s) { const camp = W.camps.find((c) => c.active); if (camp) { createSettlement(camp.id); s = W.settlements.find((x) => !x.ruined); } }
  }
  if (!s) { fail("no settlement"); return out; }
  const a = W.activeIds.find((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && W.components.social[id] && W.components.position[id] && W.components.inventory[id]?.digestive);
  if (!a) { fail("nobody to feed"); return out; }
  const soc = W.components.social[a], p = W.components.position[a];
  soc.homePlaceKind = "settlement"; soc.homePlaceId = s.id;
  const grant = 300;
  s.inventory[C.ORGANIC] = (s.inventory[C.ORGANIC] || 0) + grant;
  W.conservation.playerInput += grant;
  // Every other store is emptied so the only meal in reach is the home one.
  const emptied = [];
  for (const t of W.settlements) if (t !== s && t.inventory) { emptied.push([t, t.inventory[C.ORGANIC] || 0]); t.inventory[C.ORGANIC] = 0; }
  // The hall's buildings drawn in close: the reach is the floor of eight.
  const mine = W.buildings.filter((b) => b.placeKind === "settlement" && b.placeId === s.id && b.complete && !b.ruined);
  const saved = mine.map((b) => [b, b.x, b.y]);
  for (const b of mine) { b.x = s.x; b.y = s.y; }
  W.tick++;
  out.reachClose = hearth.reach(s.id);
  if (out.reachClose !== 8) fail("a town built round its hall does not reach eight: " + out.reachClose);
  // A resident fourteen tiles out, with nothing built that far, is not fed from home.
  const dx = s.x + 14 < W.width ? 14 : -14;
  p.x = s.x + dx; p.y = s.y;
  out.farBefore = homeRationPlace(a)?.id || 0;
  if (out.farBefore === s.id) fail("a resident fourteen tiles from a village hall was fed from home");
  // The town builds out to thirteen tiles: the reach follows.
  if (!mine.length) fail("the town has no finished building to move");
  else { mine[0].x = s.x + (dx > 0 ? 13 : -13); mine[0].y = s.y; }
  W.tick++;
  out.reachBuilt = hearth.reach(s.id);
  if (out.reachBuilt !== 15) fail("a town built out to thirteen tiles does not reach fifteen: " + out.reachBuilt);
  const before = worldHash();
  hearth.reach(s.id);
  if (worldHash() !== before) fail("reading the reach wrote the world");
  out.farAfter = homeRationPlace(a)?.id || 0;
  if (out.farAfter !== s.id) fail("a resident fourteen tiles out is not fed from home once the town reaches him: " + out.farAfter);
  // The granary counts him among its residents only behind the ship.
  rebuildSpatialBins();
  W.tick++;
  out.residentBeforeShip = granaryResidents(s).includes(a);
  if (out.residentBeforeShip) fail("a member fourteen tiles out was counted among the residents before any ship had left");
  W.ascensions.push({ id: 1, settlementId: s.id, factionId: s.factionId || 0, buildingId: 0, tile: idx(s.x, s.y), tick: W.tick, eventId: 0, first: true });
  W.tick++;
  out.residentBehindShip = granaryResidents(s).includes(a);
  if (!out.residentBehindShip) fail("a member fourteen tiles out is not counted among the residents behind the ship");
  W.ascensions.pop();
  W.tick++;
  // The meal moves rations from the store into the eater.
  // On bare ground, so the mouthful cannot come from underfoot.
  const digestive = W.components.inventory[a].digestive, ateBefore = digestive[C.ORGANIC], storeBefore = s.inventory[C.ORGANIC], tile = idx(p.x, p.y),
    ground = [W.tiles.chem[C.ORGANIC][tile], W.tiles.chem[C.ENERGY][tile], W.tiles.plantOrder[tile]];
  W.tiles.chem[C.ORGANIC][tile] = 0; W.tiles.chem[C.ENERGY][tile] = 0; W.tiles.plantOrder[tile] = 0;
  W.components.life[a].hunger = 90;
  out.fed = performFeeding(a, tile, 1);
  out.moved = [digestive[C.ORGANIC] - ateBefore, storeBefore - s.inventory[C.ORGANIC]];
  [W.tiles.chem[C.ORGANIC][tile], W.tiles.chem[C.ENERGY][tile], W.tiles.plantOrder[tile]] = ground;
  if (!out.fed || out.moved[0] <= 0 || out.moved[0] !== out.moved[1]) fail("the meal did not move rations from the store to the eater: " + JSON.stringify(out.moved));
  // The seed corn is not a meal: a store at its seed reserve feeds nobody at home.
  const savedStore = s.inventory[C.ORGANIC];
  const fallowField = cultivatedField(W.buildings.find((b) => b.type === "farm" && b.placeId === s.id && !b.ruined) || planBuilding(s, "farm", 9));
  if (fallowField) fallowField.stage = "fallow";
  out.seedReserve = seedReserve(s);
  s.inventory[C.ORGANIC] = out.seedReserve;
  out.fedAtSeedBeforeShip = homeRationPlace(a)?.id || 0;
  if (out.seedReserve > 0 && out.fedAtSeedBeforeShip !== s.id) fail("before any ship the seed was kept from a hungry resident");
  W.ascensions.push({ id: 1, settlementId: s.id, factionId: s.factionId || 0, buildingId: 0, tile: idx(s.x, s.y), tick: W.tick, eventId: 0, first: true });
  out.fedAtSeed = homeRationPlace(a)?.id || 0;
  if (out.seedReserve > 0 && out.fedAtSeed === s.id) fail("behind the ship a store at its seed reserve fed a resident at home");
  s.inventory[C.ORGANIC] = out.seedReserve + 5;
  out.fedAboveSeed = homeRationPlace(a)?.id || 0;
  if (out.fedAboveSeed !== s.id) fail("a store above its seed reserve did not feed a resident at home");
  W.ascensions.pop();
  s.inventory[C.ORGANIC] = savedStore;
  // The daily draw reaches a member fourteen tiles out only behind the ship, by the granary's own ration.
  {
    const digestive = W.components.inventory[a].digestive, gutBefore = digestive[C.ORGANIC];
    digestive[C.ORGANIC] = 0;
    W.conservation.playerInput -= gutBefore;
    s.inventory[C.ORGANIC] = seedReserve(s) + 200;
    W.tick++;
    const storeBefore = s.inventory[C.ORGANIC];
    out.drawBeforeShip = hearth.draw(s.id);
    if (out.drawBeforeShip !== 0 || digestive[C.ORGANIC] !== 0) fail("the far member drew a ration before any ship had left: " + out.drawBeforeShip);
    W.ascensions.push({ id: 1, settlementId: s.id, factionId: s.factionId || 0, buildingId: 0, tile: idx(s.x, s.y), tick: W.tick, eventId: 0, first: true });
    W.tick++;
    out.drawBehindShip = hearth.draw(s.id);
    out.drawCap = rationCap(s);
    if (!(out.drawBehindShip > 0)) fail("the far member drew nothing behind the ship");
    if (out.drawBehindShip > out.drawCap) fail("the far member drew more than the ration: " + out.drawBehindShip + " > " + out.drawCap);
    if (digestive[C.ORGANIC] !== out.drawBehindShip || storeBefore - s.inventory[C.ORGANIC] !== out.drawBehindShip) fail("the ration did not move from the store to the gut: gut " + digestive[C.ORGANIC] + " store -" + (storeBefore - s.inventory[C.ORGANIC]));
    W.ascensions.pop();
    digestive[C.ORGANIC] = gutBefore;
    W.conservation.playerInput += gutBefore;
    s.inventory[C.ORGANIC] = savedStore;
  }
  // A member six tiles from the hall under another flag and a campaign is a hostile visitor to the
  // base draw; behind the ship the hearth feeds them and they take the town's flag.
  if (s.factionId) {
    const digestive = W.components.inventory[a].digestive, gutBefore = digestive[C.ORGANIC], pos = W.components.position[a], savedPos = [pos.x, pos.y], savedFaction = soc.factionId;
    pos.x = clamp(s.x + 6, 0, W.width - 1); pos.y = s.y;
    rebuildSpatialBins();
    soc.factionId = s.factionId + 1000;
    W.components.campaign = W.components.campaign || {};
    W.components.campaign[a] = { role: "rescue", warId: 0, issuedTick: W.tick };
    digestive[C.ORGANIC] = 0;
    W.conservation.playerInput -= gutBefore;
    s.inventory[C.ORGANIC] = seedReserve(s) + 200;
    W.tick++;
    out.refused = personIsHostileVisitor(a, s.factionId);
    if (!out.refused) fail("the flagged member at six tiles was not refused by the base draw's rule");
    W.ascensions.push({ id: 1, settlementId: s.id, factionId: s.factionId || 0, buildingId: 0, tile: idx(s.x, s.y), tick: W.tick, eventId: 0, first: true });
    W.tick++;
    out.drawRefused = hearth.draw(s.id);
    if (!(out.drawRefused > 0) || digestive[C.ORGANIC] !== out.drawRefused) fail("the refused member six tiles out drew nothing behind the ship: " + out.drawRefused);
    if (soc.factionId !== s.factionId) fail("the refused member did not take the town's flag: " + soc.factionId + " vs " + s.factionId);
    W.ascensions.pop();
    delete W.components.campaign[a];
    soc.factionId = savedFaction;
    W.conservation.playerInput -= digestive[C.ORGANIC] - gutBefore;
    digestive[C.ORGANIC] = gutBefore;
    s.inventory[C.ORGANIC] = savedStore;
    [pos.x, pos.y] = savedPos;
    rebuildSpatialBins();
  }
  // The seed is kept from the meal behind the ship: a hungry member at the hall eats what is above the reserve.
  {
    const q = W.components.chemistry[a].q, digestive = W.components.inventory[a].digestive, pos = W.components.position[a];
    const savedPos = [pos.x, pos.y], energy0 = q[C.ENERGY], gut0 = digestive[C.ORGANIC];
    pos.x = clamp(s.x + 1, 0, W.width - 1); pos.y = s.y;
    rebuildSpatialBins();
    W.conservation.playerInput += 50 - energy0; q[C.ENERGY] = 50;
    W.conservation.playerInput -= gut0; digestive[C.ORGANIC] = 0;
    W.ascensions.push({ id: 1, settlementId: s.id, factionId: s.factionId || 0, buildingId: 0, tile: idx(s.x, s.y), tick: W.tick, eventId: 0, first: true });
    W.tick++;
    const reserve = seedReserve(s);
    s.inventory[C.ORGANIC] = reserve + 5;
    derivedLife(a);
    out.mealHunger = Math.round(W.components.life[a].hunger);
    out.mealAte = performFeeding(a, idx(pos.x, pos.y));
    out.mealStore = s.inventory[C.ORGANIC];
    out.mealReserve = reserve;
    if (s.inventory[C.ORGANIC] < reserve) fail("the meal ate the seed corn: store " + s.inventory[C.ORGANIC] + " under the reserve " + reserve);
    if (typeof window.ALIFE_HEARTH_DEBUG.counts().seedHidden !== "number") fail("no count of the seed hidden");
    W.ascensions.pop();
    W.conservation.playerInput -= digestive[C.ORGANIC] - gut0; digestive[C.ORGANIC] = gut0;
    W.conservation.playerInput -= q[C.ENERGY] - energy0; q[C.ENERGY] = energy0;
    s.inventory[C.ORGANIC] = savedStore;
    [pos.x, pos.y] = savedPos;
    rebuildSpatialBins();
  }
  // A full store gives a full ration whatever the hungry share; a store at its seed reserve is stretched as before.
  {
    W.ascensions.push({ id: 1, settlementId: s.id, factionId: s.factionId || 0, buildingId: 0, tile: idx(s.x, s.y), tick: W.tick, eventId: 0, first: true });
    W.tick++;
    const residents = granaryResidents(s), hungers = residents.map((id) => [id, W.components.life[id].hunger]);
    for (const [id] of hungers) W.components.life[id].hunger = 90;
    W.tick++;
    const reserve = seedReserve(s);
    s.inventory[C.ORGANIC] = reserve + 18 * Math.max(1, residents.length);
    out.rationFull = rationCap(s);
    out.rationHungry = +hungryShare(s).toFixed(2);
    if (out.rationFull !== 18) fail("a full store did not give a full ration to a hungry town: " + out.rationFull + " with hungry " + out.rationHungry);
    s.inventory[C.ORGANIC] = reserve;
    W.tick++;
    out.rationStretched = rationCap(s);
    if (out.rationStretched >= 18) fail("a store at its seed reserve was not stretched: " + out.rationStretched);
    W.ascensions.pop();
    for (const [id, h] of hungers) W.components.life[id].hunger = h;
    s.inventory[C.ORGANIC] = savedStore;
    W.tick++;
  }
  // A day's meals are one gut's worth: the second meal of the day takes nothing from the store, the next day's does.
  {
    const q = W.components.chemistry[a].q, digestive = W.components.inventory[a].digestive, pos = W.components.position[a], life = W.components.life[a];
    const savedPos = [pos.x, pos.y], energy0 = q[C.ENERGY], gut0 = digestive[C.ORGANIC], day0 = [life.mealDay, life.mealTaken];
    pos.x = clamp(s.x + 1, 0, W.width - 1); pos.y = s.y;
    rebuildSpatialBins();
    W.ascensions.push({ id: 1, settlementId: s.id, factionId: s.factionId || 0, buildingId: 0, tile: idx(s.x, s.y), tick: W.tick, eventId: 0, first: true });
    W.tick += 1 + (32 - (W.tick % 32)) % 32;
    s.inventory[C.ORGANIC] = seedReserve(s) + 400;
    const eat = () => { W.conservation.playerInput += 50 - q[C.ENERGY]; q[C.ENERGY] = 50; W.conservation.playerInput -= digestive[C.ORGANIC]; digestive[C.ORGANIC] = 0; derivedLife(a); const before = s.inventory[C.ORGANIC]; performFeeding(a, idx(pos.x, pos.y)); return before - s.inventory[C.ORGANIC]; };
    // Bare ground under the eater: the forage would fill the gut before the store was asked.
    const ti = idx(pos.x, pos.y), bare = {};
    for (const sp of [C.ORGANIC, C.ENERGY, C.NUTRIENT]) { bare[sp] = W.tiles.chem[sp][ti]; W.conservation.playerInput -= bare[sp]; W.tiles.chem[sp][ti] = 0; }
    W.conservation.playerInput += 50 - q[C.ENERGY]; q[C.ENERGY] = 50; derivedLife(a);
    out.quotaFirst = eat();
    out.quotaLeft = window.ALIFE_HEARTH_DEBUG.quotaLeft(a);
    if (!(out.quotaFirst > 0)) fail("the first meal of the day took nothing from a full store: " + out.quotaFirst);
    if (out.quotaFirst > 24) fail("the first meal took more than a gut's worth: " + out.quotaFirst);
    if (out.quotaLeft !== 24 - out.quotaFirst) fail("the meal was not booked to the day: left " + out.quotaLeft + " after " + out.quotaFirst);
    life.mealTaken = 24;
    out.quotaSecond = eat();
    if (out.quotaSecond !== 0) fail("a meal past the day's quota took from the store: " + out.quotaSecond);
    W.tick += 32;
    out.quotaNextDay = eat();
    if (!(out.quotaNextDay > 0)) fail("the next day's meal took nothing: " + out.quotaNextDay);
    W.ascensions.pop();
    W.conservation.playerInput -= digestive[C.ORGANIC] - gut0; digestive[C.ORGANIC] = gut0;
    W.conservation.playerInput -= q[C.ENERGY] - energy0; q[C.ENERGY] = energy0;
    [life.mealDay, life.mealTaken] = day0;
    for (const sp of [C.ORGANIC, C.ENERGY, C.NUTRIENT]) { W.conservation.playerInput += bare[sp] - W.tiles.chem[sp][ti]; W.tiles.chem[sp][ti] = bare[sp]; }
    s.inventory[C.ORGANIC] = savedStore;
    [pos.x, pos.y] = savedPos;
    rebuildSpatialBins();
    W.tick++;
  }
  // A lean town's herd is fed no bread behind the ship: the store is whole after the feeding.
  if (typeof feedEnclosedHerd === "function") {
    const residents = granaryResidents(s), hungers = residents.map((id) => [id, W.components.life[id].hunger]);
    for (const [id] of hungers) W.components.life[id].hunger = 90;
    W.ascensions.push({ id: 1, settlementId: s.id, factionId: s.factionId || 0, buildingId: 0, tile: idx(s.x, s.y), tick: W.tick, eventId: 0, first: true });
    W.tick += (8 - (W.tick % 8)) % 8;
    s.inventory[C.ORGANIC] = seedReserve(s) + 120;
    const storeBefore = s.inventory[C.ORGANIC], kept0 = window.ALIFE_HEARTH_DEBUG.counts().herdKept;
    const corral = { id: -1, type: "corral", complete: true, ruined: false, x: s.x, y: s.y, composition: new Uint16Array(SPECIES_COUNT) };
    out.herdFed = feedEnclosedHerd({ animalIds: [], herderId: 0 }, s, corral);
    out.herdKept = window.ALIFE_HEARTH_DEBUG.counts().herdKept - kept0;
    if (s.inventory[C.ORGANIC] !== storeBefore) fail("the lean town's store changed while its herd was fed: " + storeBefore + " -> " + s.inventory[C.ORGANIC]);
    if (out.herdKept !== 1) fail("the herd's bread was not kept from it: " + out.herdKept);
    W.ascensions.pop();
    for (const [id, h] of hungers) W.components.life[id].hunger = h;
    s.inventory[C.ORGANIC] = savedStore;
    W.tick++;
  }
  // Behind the ship a hoard in the gut of a resident at home goes back to the store; a modest gut, and a hoard away from home, are left alone.
  {
    W.ascensions.push({ smoke: true });
    const gut = W.components.inventory[a].digestive, gutBefore = gut[C.ORGANIC], storeBefore = s.inventory[C.ORGANIC] || 0, px = p.x, py = p.y;
    p.x = s.x; p.y = s.y;
    gut[C.ORGANIC] = 500;
    W.conservation.playerInput += 500 - gutBefore;
    out.unloaded = hearth.unload(a);
    if (out.unloaded !== 500 - 48) fail("the hoard was not unloaded down to two days' meals: " + out.unloaded);
    if ((s.inventory[C.ORGANIC] || 0) !== storeBefore + out.unloaded) fail("the store did not receive the hoard: " + (s.inventory[C.ORGANIC] || 0) + " vs " + (storeBefore + out.unloaded));
    if (gut[C.ORGANIC] !== 48) fail("the gut was not left with two days' meals: " + gut[C.ORGANIC]);
    gut[C.ORGANIC] = 150;
    W.conservation.playerInput += 150 - 48;
    out.keptModest = hearth.unload(a);
    if (out.keptModest !== 0) fail("a gut under eight days' meals was unloaded: " + out.keptModest);
    gut[C.ORGANIC] = 500;
    W.conservation.playerInput += 350;
    p.x = clamp(s.x + (s.x + 30 < W.width ? 30 : -30), 0, W.width - 1);
    out.keptAway = hearth.unload(a);
    if (out.keptAway !== 0) fail("a hoard away from home was unloaded: " + out.keptAway);
    W.ascensions.pop();
    s.inventory[C.ORGANIC] += gut[C.ORGANIC] - gutBefore;
    gut[C.ORGANIC] = gutBefore;
    p.x = px; p.y = py;
    W.tick++;
  }
  // A stranger to the town is judged as before.
  soc.homePlaceId = s.id + 1000;
  out.stranger = homeRationPlace(a)?.id || 0;
  if (out.stranger === s.id) fail("a stranger fourteen tiles out was fed from a town he does not belong to");
  soc.homePlaceId = s.id;
  // Twenty-four is the ceiling.
  if (mine.length) { mine[0].x = clamp(s.x + (dx > 0 ? 40 : -40), 0, W.width - 1); }
  W.tick++;
  out.reachCeiling = hearth.reach(s.id);
  if (out.reachCeiling > 24) fail("the reach passed twenty-four: " + out.reachCeiling);
  for (const [b, x, y] of saved) { b.x = x; b.y = y; }
  for (const [t, n] of emptied) t.inventory[C.ORGANIC] = n;
  for (const [k, v] of Object.entries(out)) if (typeof v === "string" && /undefined|NaN/.test(v)) fail(k + " contains undefined");
  return out;
})()`;

const assertions = String.raw`
const failures = [];
game.createTestWorld({ seed: "x3", size: "small" });
controls.createCivicTestScenario();
const result = sandbox.window.ALIFE_HEARTH_TEST.run();
for (const f of result.failures) failures.push(f);
console.log(JSON.stringify({ ok: !failures.length, failures, result }, null, 2));
if (failures.length) process.exitCode = 1;
`;

const injectedRuntime = `window.ALIFE_HEARTH_TEST=Object.freeze({run:()=>${fixtureSource}});\nreturn {boot};`;
const harnessSource = smokeSource
  .slice(0, harnessEnd)
  .replace(
    'const script = composeRuntime({ format: "script" });',
    `const script = composeRuntime({ format: "script" }).replace("return {boot};", ${JSON.stringify(injectedRuntime)});`,
  );
new Function("require", harnessSource + "\n" + assertions)(require);
