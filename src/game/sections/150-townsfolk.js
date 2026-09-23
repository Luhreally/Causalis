// ═══════════════════════════════════════════════════════════════════════════
// 150. TOWNSFOLK — the many, kept as the town's ledger
// ═══════════════════════════════════════════════════════════════════════════
// Asked for: a lot of people without bogging the world down, by an elegant
// method. Every person in the world was a full life: a body of conserved
// matter, a genome, a mind stepped every fourth tick, a place in the spatial
// bins, a walk to work, a share of every pass that loops over the living.
// The tick costs near enough one for one in people (0.2 ms a person on this
// desktop in Node, 127's measurement), and a slow phone could not hold the
// two hundred of a grown world (149).
//
// The industrial town now keeps its many as a ledger, the way the wild has
// always kept its herds past the cap as cohorts (12): the townsfolk. A ledger
// has the shape of a cohort (a count, four age bands, the summed matter of
// its bodies, the sums of its genes) and is held by its town. Its cost is one
// pass a town every thirty-two ticks, whatever its count. The town keeps up
// to forty full lives (FOLK_AGENTS), the people who are followed,
// inspected, fall in love, go to war and are written into the chronicle; when
// an industrial town (one that knows mechanization) already has as many, a
// child born to two of its people is born into the ledger with the matter its
// parents gave it (12's cohort birth matter), and a life folded past the
// world's cap (12) is folded into its town's ledger rather than the wild's.
// When the town's full lives fall below four fifths of the forty, one of
// the ledger is drawn out as a life (12's materializeCohort) and walks into the
// town: the named cast renews itself from the crowd. A town past its forty
// folds four of its least noted grown people a pass into the ledger (never a
// voice, a soldier, a traveller under orders or anyone the chronicle has
// marked), so a grown industrial city of a hundred and twenty full lives is,
// within a few years, forty lives and a crowd.
//
// The ledger lives: it ages by band (12's advanceCohortAges, the old dying
// into the town's ground); it eats from the town's stores, above the seed
// the town keeps back (82), and drinks from the ground about the town; what
// it eats goes back to the town's streets, the energy breathed out there as
// waste and gas (respiration, 02) and the rest to decompose, where the muck
// of 134 carries it back to the fields; it starves when the stores are empty;
// it bears children when fed and housed, each body made of the town's food and
// water; it sleeps in the beds its full lives leave; and its hands work: they
// sow, tend and harvest the town's fields (42d's own acts, no worker named),
// carry the stores' materials to the town's building sites, and quarry from
// the ground about the town what those sites still want. Everything it
// holds is counted in the world's matter and chemical energy, so the audit
// balances.
//
// Counting: a town's people (25's settlementPopulation) include its ledger,
// so it plans fields, homes and towers for them (82, 103, 121, 127); the
// world's people (populationSummary) include every ledger.
// The full lives a town keeps (a let only so the test can set it for a small town).
let FOLK_AGENTS = 40;
const FOLK_EVERY = 32,
  FOLK_FOLD_PER_PASS = 4,
  FOLK_GATHER = 2,
  FOLK_GATHER_REACH = 10,
  FOLK_PROMOTE_BELOW = 0.8,
  // Food a member eats a pass (organic one, energy two), 24 a year. Measured
  // on the grown phone world (scratchpad/ration-probe.cjs): the fields yield 36
  // organic-and-energy a townsperson a year, of which a townsperson draws only
  // six straight from the stores; the rest reaches them carried and foraged.
  FOLK_MEAL = 3,
  FOLK_CHILD_MEAL = 0.6,
  FOLK_DRINK = 2,
  FOLK_BODY = Object.freeze([
    [C.ORGANIC, 30],
    [C.ENERGY, 10],
    [C.SOLVENT, 40],
  ]),
  FOLK_BIRTH_RATE = 0.015,
  FOLK_ROOM = 1.1,
  FOLK_FIELD_HANDS = 4,
  FOLK_FIELD_HANDS_MECHANIZED = 2,
  FOLK_HAUL = 3,
  FOLK_SEWER_REACH = 2,
  FOLK_WELL_REACH = 4;
const FOLK = {
  admitted: 0,
  folded: 0,
  born: 0,
  starved: 0,
  promoted: 0,
  passes: 0,
  eaten: 0,
  drunk: 0,
  sown: 0,
  tended: 0,
  harvested: 0,
  hauled: 0,
  gathered: 0,
};
function folkEra(town) {
  return !!town && !town.ruined && !!town.knownProcesses?.includes("mechanization");
}
function folkLedger(town, create = false) {
  if (!W || !town) return null;
  const key = String(town.id);
  let folk = W.townsfolk?.[key] || null;
  if (!folk && create) {
    W.townsfolk ||= {};
    folk = W.townsfolk[key] = ensureCohortState({
      id: 1000000 + town.id,
      kind: KINDS.PERSON,
      townId: town.id,
      regionId: regionId(town.x, town.y),
      factionId: town.factionId || 0,
      cultureId: town.cultureId || 0,
      lineageId: 0,
      count: 0,
      health: 0.8,
      foodAccess: 1,
      growthRate: 0,
      fed: 1,
      watered: 1,
      housed: 0,
      hands: 0,
      born: 0,
      starved: 0,
      promoted: 0,
    });
  }
  return folk;
}
function folkCount(town) {
  return W?.townsfolk?.[String(town?.id)]?.count || 0;
}
function allTownsfolk() {
  return W?.townsfolk ? Object.keys(W.townsfolk).sort((a, b) => a - b).map((k) => W.townsfolk[k]) : [];
}
// The full lives whose home is each town, counted once a tick.
let FOLK_AGENT_COUNT = { world: null, tick: -1, length: -1, next: -1, byTown: null };
function townAgentCount(town) {
  const c = FOLK_AGENT_COUNT;
  if (c.world !== W || c.tick !== W.tick || c.length !== W.activeIds.length || c.next !== W.nextEntityId) {
    const byTown = new Map();
    for (const id of W.activeIds) {
      if (W.kind[id] !== KINDS.PERSON || !classifyAlive(id)) continue;
      const soc = W.components.social[id];
      if (soc?.homePlaceKind === "settlement") byTown.set(soc.homePlaceId, (byTown.get(soc.homePlaceId) || 0) + 1);
    }
    FOLK_AGENT_COUNT = { world: W, tick: W.tick, length: W.activeIds.length, next: W.nextEntityId, byTown };
  }
  return FOLK_AGENT_COUNT.byTown.get(town.id) || 0;
}
function folkAddMember(folk, chemistry, genome, bin = 0) {
  folk.count++;
  for (let sp = 0; sp < SPECIES_COUNT; sp++) {
    folk.chemistryTotals[sp] += chemistry[sp] || 0;
    folk.bodyChemistryTotals[sp] += chemistry[sp] || 0;
  }
  for (let i = 0; i < 13; i++) {
    const v = genome?.instructions?.[i]?.expression || 0;
    folk.geneSums[i] += v;
    folk.geneSquares[i] += v * v;
  }
  folk.ageBins[bin]++;
}
// ── Born into the ledger ────────────────────────────────────────────────────
// Every child of the world is made by createOffspring (23, from the paired
// births of 24 and the couplings of 76), so the ledger takes it there: the
// matter its parents give (the cohort birth of 12), a genome of the two, and
// the parents' rest after a birth as 24 sets it.
const createOffspringFolkBase = createOffspring;
createOffspring = function (kind, parents, tile) {
  const town = kind === KINDS.PERSON ? homeTownOf(parents[0]) || homeTownOf(parents[1]) : null;
  if (!folkEra(town) || townAgentCount(town) < FOLK_AGENTS) return createOffspringFolkBase(kind, parents, tile);
  const r = makeRng(hashParts(W.seedHash, W.tick, ...parents), "folk-birth"),
    g = genomeFrom(r, KINDS.PERSON, W.components.genome[parents[0]], W.components.genome[parents[1] || parents[0]]),
    chemistry = makeCohortBirthMatter(parents),
    folk = folkLedger(town, true);
  folkAddMember(folk, chemistry, g, 0);
  folk.born++;
  FOLK.admitted++;
  recordCohortBirths(
    folk,
    1,
    tile,
    parents.map((par) => W.components.identity[par]?.birthEventId || 0),
    "two of the town's named people had a child, born into the town's crowd",
  );
  const recovery = LIFE_HISTORY.person;
  for (const parent of parents)
    if (W.components.reproduction[parent])
      W.components.reproduction[parent].cooldown =
        recovery.birthRecovery + Math.floor(counterRand("sexual-recovery", W.tick, parent, 0) * recovery.birthRecoverySpread);
  return 0;
};
// ── Folded into the ledger past the world's cap ─────────────────────────────
const aggregateIntoCohortFolkBase = aggregateIntoCohort;
aggregateIntoCohort = function (id, reason = "density cap") {
  const town = W.kind[id] === KINDS.PERSON ? homeTownOf(id) : null;
  if (!folkEra(town)) return aggregateIntoCohortFolkBase(id, reason);
  const g = W.components.genome[id],
    ch = W.components.chemistry[id],
    ident = W.components.identity[id],
    inventory = W.components.inventory[id],
    life = W.components.life[id],
    body = W.components.body[id];
  if (!g || !ch || !life || !body || ident?.notable) return false;
  const folk = folkLedger(town, true),
    held = new Array(SPECIES_COUNT).fill(0);
  for (let sp = 0; sp < SPECIES_COUNT; sp++)
    held[sp] = ch.q[sp] + (inventory?.materials[sp] || 0) + (inventory?.digestive[sp] || 0);
  folkAddMember(folk, held, g, cohortAgeBin(life.age, folk.maxAge));
  // The body is the body; what was carried and in the gut is held by the ledger too.
  for (let sp = 0; sp < SPECIES_COUNT; sp++) folk.bodyChemistryTotals[sp] -= held[sp] - ch.q[sp];
  rememberCohortHistory(folk, { name: ident?.generatedName || `Entity ${id}`, reason });
  W.historicalIdentities[id] = {
    ...ident,
    kind: KINDS.PERSON,
    name: ident?.generatedName || `Entity ${id}`,
    aggregatedTick: W.tick,
    townsfolkOf: town.id,
  };
  if (typeof pruneHistoricalIdentities === "function") pruneHistoricalIdentities();
  removeEntity(id);
  FOLK.folded++;
  return true;
};
// ── The ledger's year ───────────────────────────────────────────────────────
function folkSewerTiles(town) {
  const out = [];
  for (let dy = -FOLK_SEWER_REACH; dy <= FOLK_SEWER_REACH; dy++)
    for (let dx = -FOLK_SEWER_REACH; dx <= FOLK_SEWER_REACH; dx++) {
      const x = town.x + dx,
        y = town.y + dy;
      if (inside(x, y)) out.push(idx(x, y));
    }
  return out;
}
// What is eaten is moved out of the stores into the ledger, then out of the
// ledger onto the streets: the energy breathed out there (respiration), the
// rest left to decompose. Returns the food units eaten (organic one, energy two).
function folkEat(town, folk, need) {
  if (need <= 0) return 0;
  const reserve = typeof seedReserve === "function" ? seedReserve(town) : 0,
    organic = Math.max(0, Math.min((town.inventory[C.ORGANIC] || 0) - reserve, need)),
    energy = Math.max(0, Math.min(town.inventory[C.ENERGY] || 0, Math.ceil((need - organic) / 2)));
  town.inventory[C.ORGANIC] -= organic;
  town.inventory[C.ENERGY] -= energy;
  const sewers = folkSewerTiles(town);
  if (sewers.length) {
    for (const [sp, amount] of [
      [C.ORGANIC, organic],
      [C.ENERGY, energy],
    ]) {
      const share = Math.floor(amount / sewers.length);
      let rest = amount - share * sewers.length;
      for (const tile of sewers) {
        const give = share + (rest > 0 ? 1 : 0);
        if (rest > 0) rest--;
        if (give) giveTileMatter(tile, sp, give);
      }
    }
    if (energy) {
      const breathed = Math.ceil(energy / sewers.length);
      for (const tile of sewers) executeProcess("respiration", invTile(tile), breathed, { location: tile });
    }
  } else {
    town.inventory[C.ORGANIC] += organic;
    town.inventory[C.ENERGY] += energy;
    return 0;
  }
  FOLK.eaten += organic + energy * 2;
  return organic + energy * 2;
}
// Water from the ground within the town's wells' reach, wettest first; what is
// drunk goes back to the sky as the living breathe and sweat it.
function folkDrink(town, folk, need) {
  if (need <= 0) return 0;
  const wells = [];
  for (let dy = -FOLK_WELL_REACH; dy <= FOLK_WELL_REACH; dy++)
    for (let dx = -FOLK_WELL_REACH; dx <= FOLK_WELL_REACH; dx++) {
      const x = town.x + dx,
        y = town.y + dy;
      if (inside(x, y)) wells.push(idx(x, y));
    }
  wells.sort((a, b) => tileMatterAmount(b, C.SOLVENT) - tileMatterAmount(a, C.SOLVENT) || a - b);
  let drunk = 0;
  for (const tile of wells) {
    if (drunk >= need) break;
    const spare = Math.max(0, tileMatterAmount(tile, C.SOLVENT) - 40);
    if (!spare) break;
    drunk += takeTileMatter(tile, C.SOLVENT, Math.min(spare, need - drunk));
  }
  W.reservoirs.atmosphericSolvent = (W.reservoirs.atmosphericSolvent || 0) + drunk;
  FOLK.drunk += drunk;
  return drunk;
}
// A body for a child of the ledger, from the stores' food and the wells' water.
function folkBirthBody(town) {
  const reserve = typeof seedReserve === "function" ? seedReserve(town) : 0;
  if ((town.inventory[C.ORGANIC] || 0) - reserve < FOLK_BODY[0][1] || (town.inventory[C.ENERGY] || 0) < FOLK_BODY[1][1])
    return null;
  const chemistry = new Array(SPECIES_COUNT).fill(0);
  let water = 0;
  const wells = folkSewerTiles(town).sort((a, b) => tileMatterAmount(b, C.SOLVENT) - tileMatterAmount(a, C.SOLVENT) || a - b);
  for (const tile of wells) {
    if (water >= FOLK_BODY[2][1]) break;
    const spare = Math.max(0, tileMatterAmount(tile, C.SOLVENT) - 40);
    if (spare) water += takeTileMatter(tile, C.SOLVENT, Math.min(spare, FOLK_BODY[2][1] - water));
  }
  if (water < FOLK_BODY[2][1]) {
    if (water) giveTileMatter(idx(town.x, town.y), C.SOLVENT, water);
    return null;
  }
  town.inventory[C.ORGANIC] -= FOLK_BODY[0][1];
  town.inventory[C.ENERGY] -= FOLK_BODY[1][1];
  chemistry[C.ORGANIC] = FOLK_BODY[0][1];
  chemistry[C.ENERGY] = FOLK_BODY[1][1];
  chemistry[C.SOLVENT] = water;
  return chemistry;
}
function folkBeds(town) {
  let beds = 0;
  for (const b of W.buildings)
    if (b.placeKind === "settlement" && b.placeId === town.id) beds += habitationBeds(b);
  return beds;
}
// The ledger's hands on the town's fields and sites. They are the adults of
// the middle bands; a third work the fields in crews (four to a field, two
// with machines), a quarter carry the stores' materials to the sites.
function folkLabour(town, folk, adults) {
  const machines = town.knownProcesses?.includes("mechanization"),
    hands = Math.floor(adults * 0.35),
    fields = completedBuildings(town, "farm")
      .map(cultivatedField)
      .filter(Boolean)
      .sort((a, b) => a.id - b.id);
  let crews = Math.floor(hands / (machines ? FOLK_FIELD_HANDS_MECHANIZED : FOLK_FIELD_HANDS));
  folk.hands = hands;
  for (const field of fields) {
    if (crews <= 0) break;
    if (field.stage === "ripe" && W.tick >= (field.harvestBlockedUntil || 0)) {
      if (harvestCultivatedField(0, field, town)) {
        FOLK.harvested++;
        crews--;
      }
    } else if (field.stage === "fallow") {
      if (sowCultivatedField(0, field, town)) {
        FOLK.sown++;
        crews--;
      }
    } else if (["sown", "growing"].includes(field.stage) && W.tick - field.lastLaborTick >= 12) {
      transferPlaceMatterToField(town, field.tiles, [
        [C.SOLVENT, Math.max(2, field.tiles.length)],
        [C.NUTRIENT, Math.max(1, Math.ceil(field.tiles.length / 3))],
      ]);
      field.lastLaborTick = W.tick;
      for (const tile of field.tiles) W.tiles.soilOrder[tile] = u16(W.tiles.soilOrder[tile] + 1);
      FOLK.tended++;
      crews--;
    }
  }
  let haul = Math.floor(adults * 0.25) * FOLK_HAUL;
  for (const b of activeBuildings(town).sort((a, c) => a.id - c.id)) {
    if (haul <= 0) break;
    if (b.placeKind !== "settlement" || b.placeId !== town.id || b.complete || b.ruined) continue;
    const missing = missingBuildingMaterial(b);
    if (!missing) continue;
    const sp = missing.sp,
      reserve = typeof researchMaterialReserve === "function" ? researchMaterialReserve(town, sp) : 0,
      stocked = Math.max(0, (town.inventory[sp] || 0) - reserve),
      amount = Math.min(haul, missing.needed, stocked, 65535 - (b.composition[sp] || 0));
    if (amount <= 0) continue;
    town.inventory[sp] -= amount;
    b.composition[sp] += amount;
    W.civicMetrics.delivered = (W.civicMetrics.delivered || 0) + amount;
    refreshBuildingStage(b);
    haul -= amount;
    FOLK.hauled += amount;
  }
}
// What the town's sites still want and its stores do not hold, quarried from
// the ground within ten tiles: the richest tiles first, as a hand without a
// tool takes it (30c's extractForWork: fibre cured from the plants first).
function folkGather(town, adults) {
  let budget = Math.floor(adults * 0.2) * FOLK_GATHER;
  if (budget <= 0) return 0;
  const wants = new Map();
  for (const b of activeBuildings(town)) {
    if (b.placeKind !== "settlement" || b.placeId !== town.id || b.complete || b.ruined) continue;
    for (const [sp, n] of b.requirements || []) {
      const short = n - (b.composition?.[sp] || 0) - (town.inventory[sp] || 0);
      if (short > 0) wants.set(sp, (wants.get(sp) || 0) + short);
    }
  }
  let got = 0;
  for (const sp of [...wants.keys()].sort((a, b) => a - b)) {
    if (budget <= 0) break;
    if (STORE_DRAWN_MATERIALS.includes(sp)) continue;
    const tiles = [];
    for (let dy = -FOLK_GATHER_REACH; dy <= FOLK_GATHER_REACH; dy++)
      for (let dx = -FOLK_GATHER_REACH; dx <= FOLK_GATHER_REACH; dx++) {
        const x = town.x + dx,
          y = town.y + dy;
        if (!inside(x, y)) continue;
        const i = idx(x, y);
        if (W.tiles.liquid[i] > 900 || W.tiles.fire[i] > 350 || workResourceAmount(i, sp) < 2) continue;
        tiles.push(i);
      }
    tiles.sort((a, b) => workResourceAmount(b, sp) - workResourceAmount(a, sp) || a - b);
    let want = Math.min(wants.get(sp), budget);
    for (const tile of tiles) {
      if (want <= 0) break;
      let available = resourceAmountAt(tile, sp);
      if (sp === C.FIBER && available < 1 && resourceAmountAt(tile, C.ORGANIC) > 0) {
        executeProcess("fiber_curing", invTile(tile), Math.min(want, resourceAmountAt(tile, C.ORGANIC)));
        available = resourceAmountAt(tile, sp);
      }
      const amount = Math.min(available, want, 65535 - (town.inventory[sp] || 0));
      if (amount < 1) continue;
      setTileMatterAmount(tile, sp, available - amount);
      town.inventory[sp] += amount;
      if (sp === C.ORGANIC || sp === C.FIBER || sp === C.FUEL) W.tiles.plantOrder[tile] = u16(W.tiles.plantOrder[tile] - amount * 2);
      if (W.tiles.featureStrength?.[tile]) W.tiles.featureStrength[tile] = u16(W.tiles.featureStrength[tile] - amount);
      W.civicMetrics.gathered = (W.civicMetrics.gathered || 0) + amount;
      want -= amount;
      budget -= amount;
      got += amount;
    }
  }
  FOLK.gathered += got;
  return got;
}
// The least noted grown people of a town past its forty, folded into its ledger.
function folkFoldExcess(town) {
  const over = townAgentCount(town) - FOLK_AGENTS;
  if (over <= 0) return 0;
  const voices = new Set(W.factions.map((f) => f.leaderId).filter(Boolean)),
    candidates = [];
  for (const id of W.activeIds) {
    if (W.kind[id] !== KINDS.PERSON || !classifyAlive(id)) continue;
    const soc = W.components.social[id],
      ident = W.components.identity[id];
    if (soc?.homePlaceKind !== "settlement" || soc.homePlaceId !== town.id) continue;
    if (!isAdultPerson(id) || voices.has(id) || ident?.notable || soc.unitId || soc.revengeTargetId) continue;
    if (W.components.campaign?.[id] || W.civilOrders?.some((o) => o.id === id)) continue;
    candidates.push([ident?.significance || 0, id]);
  }
  candidates.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let folded = 0;
  for (const [, id] of candidates.slice(0, Math.min(over, FOLK_FOLD_PER_PASS)))
    if (aggregateIntoCohort(id, "folded into the town's crowd")) folded++;
  if (folded) rebuildSpatialBins();
  return folded;
}
function folkPass(town) {
  const folk = folkLedger(town);
  if (!folk) return;
  ensureCohortState(folk);
  folk.factionId = town.factionId || 0;
  folk.cultureId = town.cultureId || folk.cultureId;
  const tile = idx(town.x, town.y);
  if (folk.count) advanceCohortAges(folk, tile);
  if (folk.count) {
    const adults = folk.ageBins[1] + folk.ageBins[2],
      need = (adults + folk.ageBins[3]) * FOLK_MEAL + Math.ceil(folk.ageBins[0] * FOLK_MEAL * FOLK_CHILD_MEAL),
      eaten = folkEat(town, folk, need),
      drunk = folkDrink(town, folk, folk.count * FOLK_DRINK);
    folk.fed = need ? +(eaten / need).toFixed(3) : 1;
    folk.watered = +(drunk / Math.max(1, folk.count * FOLK_DRINK)).toFixed(3);
    const kept = Math.min(folk.fed, folk.watered);
    folk.health = +clamp(folk.health + (kept - 0.75) * 0.12, 0.1, 1).toFixed(3);
    if (kept < 0.5 && folk.count) {
      const lost = Math.max(1, Math.ceil(folk.count * (0.6 - kept) * 0.1));
      removeCohortMembers(folk, lost, tile, "hunger and thirst among the townsfolk", false, 2);
      folk.starved += lost;
      FOLK.starved += lost;
    }
    const beds = folkBeds(town),
      free = Math.max(0, beds - townAgentCount(town));
    folk.housed = Math.min(folk.count, free);
    if (folk.count && kept >= 0.8 && folk.count < free * FOLK_ROOM) {
      const progress = folk.reproductionRemainder + adults * FOLK_BIRTH_RATE * kept * folk.health,
        wanted = Math.min(Math.floor(progress), Math.max(0, Math.floor(free * FOLK_ROOM) - folk.count));
      folk.reproductionRemainder = clamp(progress - Math.floor(progress), 0, 0.999999999);
      let births = 0;
      for (let n = 0; n < wanted; n++) {
        const body = folkBirthBody(town);
        if (!body) break;
        const before = Math.max(1, folk.count),
          mean = { instructions: folk.geneSums.map((s) => ({ expression: s / before })) };
        folkAddMember(folk, body, mean, 0);
        births++;
      }
      if (births) {
        folk.born += births;
        FOLK.born += births;
        recordCohortBirths(folk, births, tile, [], "the town's crowd bore children of its stores' food and its wells' water");
      }
    }
    folkLabour(town, folk, adults);
    folkGather(town, adults);
  }
  folkFoldExcess(town);
  // The named cast renews itself from the crowd.
  if (folk.count && townAgentCount(town) < FOLK_AGENTS * FOLK_PROMOTE_BELOW) {
    const id = materializeCohort(folk);
    if (id) {
      const p = W.components.position[id],
        soc = W.components.social[id];
      p.x = town.x;
      p.y = town.y;
      p.regionId = regionId(town.x, town.y);
      soc.homePlaceKind = "settlement";
      soc.homePlaceId = town.id;
      soc.factionId = town.factionId || 0;
      soc.cultureId = town.cultureId || soc.cultureId;
      folk.promoted++;
      FOLK.promoted++;
      rebuildSpatialBins();
    }
  }
}
function updateTownsfolk() {
  if (!W?.settlements) return;
  let passed = 0;
  for (const town of W.settlements) {
    if (W.tick % FOLK_EVERY !== town.id % FOLK_EVERY) continue;
    let folk = folkLedger(town);
    if (!folk && !town.ruined && folkEra(town) && townAgentCount(town) > FOLK_AGENTS) folk = folkLedger(town, true);
    if (!folk) continue;
    if (town.ruined) {
      // A fallen town's crowd scatters into the wild's cohort of its region.
      if (folk.count) {
        const c = cohortFor(KINDS.PERSON, folk.regionId, folk.factionId, 0);
        for (const k of ["count"]) c[k] += folk[k];
        for (let sp = 0; sp < SPECIES_COUNT; sp++) {
          c.chemistryTotals[sp] += folk.chemistryTotals[sp];
          c.bodyChemistryTotals[sp] += folk.bodyChemistryTotals[sp];
          folk.chemistryTotals[sp] = 0;
          folk.bodyChemistryTotals[sp] = 0;
        }
        for (let i = 0; i < 13; i++) {
          c.geneSums[i] += folk.geneSums[i];
          c.geneSquares[i] += folk.geneSquares[i];
        }
        for (let b = 0; b < 4; b++) c.ageBins[b] += folk.ageBins[b];
        folk.count = 0;
        folk.ageBins.fill(0);
        ensureCohortState(c);
        ensureCohortState(folk);
      }
      continue;
    }
    folkPass(town);
    passed++;
  }
  FOLK.passes += passed;
}
const simTickFolkBase = simTick;
simTick = function () {
  simTickFolkBase();
  if (W) updateTownsfolk();
};
// No worker is named when the ledger's hands sow or reap (42d's acts take one
// for the chronicle and the worker's action); an act with none sets no action.
const setWorkActionFolkBase = setWorkAction;
setWorkAction = function (id, ...rest) {
  if (!id) return null;
  return setWorkActionFolkBase(id, ...rest);
};
// ── Counted with the town and the world ─────────────────────────────────────
const settlementPopulationFolkBase = settlementPopulation;
settlementPopulation = function (s) {
  return settlementPopulationFolkBase(s) + (s?.knownProcesses ? folkCount(s) : 0);
};
const populationSummaryFolkBase = populationSummary;
populationSummary = function () {
  const s = populationSummaryFolkBase();
  if (s && W?.townsfolk) for (const folk of allTownsfolk()) s.person = (s.person || 0) + folk.count;
  return s;
};
const totalMatterFolkBase = totalMatter;
totalMatter = function () {
  let total = totalMatterFolkBase();
  for (const folk of allTownsfolk()) for (const v of folk.chemistryTotals) total += v;
  return total;
};
const totalChemicalEnergyFolkBase = totalChemicalEnergy;
totalChemicalEnergy = function () {
  let total = totalChemicalEnergyFolkBase();
  const energy = W.definitions.species.map((s) => s.freeEnergy);
  for (const folk of allTownsfolk())
    for (let sp = 0; sp < SPECIES_COUNT; sp++) total += (folk.chemistryTotals[sp] || 0) * energy[sp];
  return total;
};
// ── What the town says ──────────────────────────────────────────────────────
const renderPlacePageFolkBase = renderPlacePage;
renderPlacePage = function (id) {
  const html = renderPlacePageFolkBase(id),
    town = W.settlements.find((s) => s.id === id),
    folk = town ? folkLedger(town) : null;
  if (!folk?.count) return html;
  const row = `<div class="kv" data-townsfolk="${folk.count}"><span>Townsfolk</span><b>${fmt(folk.count)} in the crowd besides the ${townAgentCount(town)} named · ${Math.round(folk.fed * 100)}% fed · ${fmt(folk.housed)} housed · ${fmt(folk.hands)} hands at the fields and sites · ${folk.born} born, ${folk.promoted} come forward</b></div>`,
    at = html.indexOf('<div class="subhead">');
  return at < 0 ? html + row : html.slice(0, at) + row + html.slice(at);
};
window.ALIFE_FOLK_DEBUG = Object.freeze({
  counts: () => ({ ...FOLK }),
  ledger: (townId) => {
    const town = W.settlements.find((s) => s.id === townId),
      folk = town ? folkLedger(town) : null;
    return folk ? JSON.parse(JSON.stringify(folk)) : null;
  },
  total: () => allTownsfolk().reduce((n, f) => n + f.count, 0),
  era: (townId) => folkEra(W.settlements.find((s) => s.id === townId)),
  agents: (townId) => townAgentCount(W.settlements.find((s) => s.id === townId)),
  pass: (townId) => folkPass(W.settlements.find((s) => s.id === townId)),
  create: (townId) => !!folkLedger(W.settlements.find((s) => s.id === townId), true),
  budget: (n) => (n === undefined ? FOLK_AGENTS : (FOLK_AGENTS = n)),
  fold: (townId) => folkFoldExcess(W.settlements.find((s) => s.id === townId)),
});
