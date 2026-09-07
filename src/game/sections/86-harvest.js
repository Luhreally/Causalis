// ═══════════════════════════════════════════════════════════════════════════
// 86. HARVEST — fields yield in step with the hands and the water on them
// ═══════════════════════════════════════════════════════════════════════════
// A cultivated field grew once every sixty-four ticks by a single extent of
// photosynthesis, whether a farmer stood in it or not and whether the town
// knew irrigation or not, so a farm fed a family and never a town: at the
// population cap a quarter of the people went hungry with every granary in
// place. Growth now keeps pace with the care a field gets. A field that was
// tended within the season, and a town that knows irrigation, waterworks, or
// industrial chemistry, each add an extent, and the field grows every 64/n
// ticks; the same water techs let a harvest lift a quarter more from each
// tile. Photosynthesis is still the only maker of crop matter, drawing
// nutrient, solvent, and gas from the tile, so nothing is created: the field
// simply turns what the farmers carry to it into food faster; and a field now
// ripens when it carries a real crop (six organic per tile) rather than at the
// first green, when nine seed came back as nine grain. The same section
// gives migration a measured pace: a town that has just sent a household waits
// three years before it sends another, and a world sends at most a few
// households a year, so a famine reads as a few marked departures rather than
// a chronicle of hundreds.
const HARVEST_BASE_INTERVAL = 64,
  HARVEST_MIN_INTERVAL = 16,
  HARVEST_TENDED_WINDOW = 96,
  HARVEST_WATER_TECHS = Object.freeze(["irrigation", "waterworks", "chemistry"]),
  MIGRATION_REST = 768,
  MIGRATIONS_PER_YEAR_BASE = 2;
function fieldTended(field) {
  return !!field && W.tick - (Number.isFinite(field.lastLaborTick) ? field.lastLaborTick : -1e9) < HARVEST_TENDED_WINDOW;
}
function harvestTechCount(place) {
  const known = place?.knownProcesses || [];
  return HARVEST_WATER_TECHS.filter((t) => known.includes(t)).length;
}
// One extent by right, one for the farmer's care, one for each water craft.
function fieldGrowthExtent(place, field) {
  return 1 + (fieldTended(field) ? 1 : 0) + harvestTechCount(place);
}
function fieldGrowthInterval(place, field) {
  return Math.max(HARVEST_MIN_INTERVAL, Math.round(HARVEST_BASE_INTERVAL / fieldGrowthExtent(place, field)));
}
function harvestCapFactor(place) {
  return 1 + 0.25 * harvestTechCount(place);
}
updateCultivatedFields = function () {
  for (const building of W.buildings) {
    if (building.type !== "farm" || !building.complete || building.ruined) continue;
    const field = cultivatedField(building),
      place = buildingPlace(building);
    if (!field || !place || !["sown", "growing"].includes(field.stage)) continue;
    if (W.tick - field.lastGrowthTick >= fieldGrowthInterval(place, field))
      updateCultivatedField(building, place, 0);
  }
};
const transferTileCropToPlaceHarvestBase = transferTileCropToPlace;
transferTileCropToPlace = function (place, tile, species, requested, reserve) {
  const scaled = species === C.ORGANIC ? Math.round(requested * harvestCapFactor(place)) : requested;
  return transferTileCropToPlaceHarvestBase(place, tile, species, scaled, reserve);
};
// ── A field ripens when there is a crop to take, not at the first green ───────
// The field ripened as soon as its growth passed the tile count, which one
// growth step (two organic per tile) already did; the harvest then lifted one
// unit per tile above the ground's reserve, and nine seed came back as nine
// grain. A field now grows until it carries six organic per tile (three full
// growth steps), for two years if the ground is poor, or until it has stopped
// growing for two steps because the ground is spent, before it is ripe.
const HARVEST_RIPE_PER_TILE = 6,
  HARVEST_PATIENCE = 512,
  HARVEST_STALL_UPDATES = 2;
function fieldRipeTarget(place, field) {
  const tiles = field?.tiles?.length || 1;
  return Math.max(6, tiles * HARVEST_RIPE_PER_TILE);
}
updateCultivatedField = function (building, place, operatorId = 0) {
  const field = cultivatedField(building);
  if (!field || !place || !["sown", "growing"].includes(field.stage)) return 0;
  const tiles = field.tiles?.length ? field.tiles : [field.tile],
    viableTiles = tiles.filter((tile) => W.tiles.fire[tile] <= 90 && tileMoisture(tile) >= 8);
  if (!viableTiles.length) {
    const cause = W.events.findLast(
        (event) =>
          tiles.includes(event.location) &&
          ["FireStartedEvent", "FireDisasterEvent", "DroughtEvent"].includes(event.type),
      )?.id,
      ev = emitEvent("CropFailedEvent", {
        subjects: [operatorId, place.entityId].filter(Boolean),
        location: field.tile,
        factions: place.factionId ? [place.factionId] : [],
        causes: [cause || field.causeEvent],
        evidence: [
          `all ${tiles.length} producer tiles fell below the moisture/fire viability threshold`,
          "remaining crop matter stayed in the tile substrate for decay or later recovery",
        ],
        magnitude: field.growth,
        importance: 2,
        data: {
          fieldId: field.id,
          crop: field.cropName,
          fire: Math.max(...tiles.map((tile) => W.tiles.fire[tile])),
        },
      });
    field.stage = "fallow";
    field.growth = 0;
    field.causeEvent = ev.id;
    for (const tile of tiles) {
      const baseline = field.baselines?.find((candidate) => candidate.tile === tile);
      if (baseline) W.tiles.plantOrder[tile] = u16(baseline.plantOrder);
    }
    if (place.importantEvents) place.importantEvents.push(ev.id);
    return 0;
  }
  let grew = 0;
  const photosynthesis = reactionById("photosynthesis");
  for (const tile of viableTiles)
    grew += executeProcess("photosynthesis", invTile(tile), 1, {
      externalEnergy: photosynthesis?.externalEnergyRequirement || 0,
      externalFlux: W.laws.solarFlux,
      location: tile,
    });
  field.lastGrowthTick = W.tick;
  const since = W.tick - field.sowTick,
    floor = Math.max(6, tiles.length);
  // Spent ground: a field that has stopped growing is harvested for what it holds.
  if (!grew) {
    field.stalledGrowth = (field.stalledGrowth || 0) + 1;
    if (!(since >= 64 && field.stalledGrowth >= HARVEST_STALL_UPDATES && field.growth >= floor))
      return 0;
  } else {
    field.stalledGrowth = 0;
    field.growth += grew;
    field.stage = "growing";
    for (const tile of viableTiles)
      W.tiles.plantOrder[tile] = u16(
        W.tiles.plantOrder[tile] + Math.max(1, Math.ceil((grew * 8) / viableTiles.length)),
      );
    field.cropChemistry = fieldChemistrySignature(field);
  }
  const ripe =
    since >= 64 &&
    (!grew ||
      field.growth >= fieldRipeTarget(place, field) ||
      (since >= HARVEST_PATIENCE && field.growth >= floor));
  if (ripe) {
    field.stage = "ripe";
    field.matureTick = W.tick;
    const ev = emitEvent("FieldMaturedEvent", {
      subjects: [operatorId, place.entityId].filter(Boolean),
      location: field.tile,
      factions: place.factionId ? [place.factionId] : [],
      causes: [field.causeEvent],
      evidence: [
        `${field.growth} balanced photosynthesis extents accumulated across ${viableTiles.length}/${tiles.length} viable crop tiles`,
        "solvent, nutrient, gas, and radiant energy produced harvestable organic matter",
      ],
      magnitude: field.growth,
      importance: 1,
      data: { fieldId: field.id, buildingId: field.buildingId, crop: field.cropName },
    });
    field.causeEvent = ev.id;
    if (place.importantEvents) place.importantEvents.push(ev.id);
  }
  return grew;
};
// In famine one sowing's seed is kept back from the daily draw, not two: a
// town that starved beside eighteen units of "seed" it could not yet sow now
// eats nine of them and sows the rest; a merely lean town still keeps two.
seedReserve = function (place) {
  if (!place?.knownProcesses || !W.fields) return 0;
  let fallow = 0,
    tiles = 9;
  for (const f of W.fields)
    if (f.placeKind === "settlement" && f.placeId === place.id && f.stage === "fallow") {
      fallow++;
      tiles = Math.max(tiles, f.tiles?.length || 9);
    }
  // In famine one sowing is kept back and the rest is eaten; when the stores are
  // merely lean two are kept, so more fields go under seed together.
  const sowings = foodOutlook(place)?.famine ? 1 : 2;
  return Math.min(sowings, fallow) * tiles;
};
// ── Hungry hands are wanted in the fields ────────────────────────────────────
// The labour pool only called on people whose minds were set on work, so in a
// hungry town, where every mind is set on food, the fields stood fallow and
// ripe crops rotted while the stores held seed: the hungry-hands rule of 82
// was never reached. A lean town now counts every hungry resident as wanted
// labour whenever a field can be sown or reaped (read by 30a).
function hungryHandsWanted(id, place) {
  if (!place?.knownProcesses || W.kind[id] !== KINDS.PERSON) return false;
  const life = W.components.life[id];
  if (!life || life.hunger <= 56 || life.hunger > 92 || life.thirst > 80) return false;
  const farms = completedBuildings(place, "farm");
  if (!farms.length) return false;
  let ripe = false,
    fallow = false;
  for (const b of farms) {
    const f = cultivatedField(b);
    if (!f) continue;
    if (f.stage === "ripe" && W.tick >= (f.harvestBlockedUntil || 0)) ripe = true;
    else if (f.stage === "fallow") fallow = true;
  }
  if (ripe) return true;
  if (!fallow || (place.inventory[C.ORGANIC] || 0) < 9) return false;
  const outlook = foodOutlook(place);
  return !!outlook?.lean;
}
// ── Hearth and home: a child belongs where its parents live ───────────────────
// A person's social record was born without a home, on the rule that
// membership comes with residence, but nothing ever granted residence to a
// child born in a town. Rations, hungry-hands labour, and the granary's own
// count of residents all go by the home place, so once a town's founders aged
// out, a second generation stood in its streets counted by the population but
// fed by nobody, and starved beside the granary. Every season the homeless
// take the home of a parent who has one, or of the town they live beside.
const HOME_PASS_CADENCE = 64,
  HOME_PASS_OFFSET = 20,
  HOME_RADIUS = 8;
function homePlaceValid(soc) {
  if (!soc?.homePlaceKind || !soc.homePlaceId) return false;
  if (soc.homePlaceKind === "settlement")
    return W.settlements.some((s) => s.id === soc.homePlaceId && !s.ruined);
  if (soc.homePlaceKind === "camp") return W.camps.some((c) => c.id === soc.homePlaceId && c.active);
  return false;
}
function adoptInto(id, soc, kind, place) {
  soc.homePlaceKind = kind;
  soc.homePlaceId = place.id;
  if (!soc.factionId && place.factionId) soc.factionId = place.factionId;
  if (!soc.cultureId && place.cultureId) soc.cultureId = place.cultureId;
}
function adoptResidents() {
  let adopted = 0;
  for (const id of W.activeIds) {
    if (W.kind[id] !== KINDS.PERSON || !classifyAlive(id)) continue;
    const soc = W.components.social[id];
    if (!soc || homePlaceValid(soc)) continue;
    if (civilOrderOf(id)) continue;
    // A parent's home first.
    const ident = W.components.identity[id];
    let done = false;
    for (const parent of ident?.parents || []) {
      const ps = W.components.social[parent];
      if (ps && homePlaceValid(ps) && (!soc.factionId || !ps.factionId || soc.factionId === ps.factionId)) {
        const place =
          ps.homePlaceKind === "settlement"
            ? W.settlements.find((s) => s.id === ps.homePlaceId)
            : W.camps.find((c) => c.id === ps.homePlaceId);
        if (place) {
          adoptInto(id, soc, ps.homePlaceKind, place);
          done = true;
          break;
        }
      }
    }
    if (done) {
      adopted++;
      continue;
    }
    // Else the town they live beside, if it is theirs or belongs to no one else.
    const p = W.components.position[id];
    if (!p) continue;
    let best = null,
      bestD = Infinity;
    for (const s of W.settlements) {
      if (s.ruined) continue;
      const d = dist2(p.x, p.y, s.x, s.y);
      if (d > HOME_RADIUS * HOME_RADIUS || d >= bestD) continue;
      if (soc.factionId && s.factionId && soc.factionId !== s.factionId) continue;
      best = s;
      bestD = d;
    }
    if (best) {
      adoptInto(id, soc, "settlement", best);
      adopted++;
      continue;
    }
    for (const c of W.camps) {
      if (!c.active) continue;
      const d = dist2(p.x, p.y, c.x, c.y);
      if (d > HOME_RADIUS * HOME_RADIUS || d >= bestD) continue;
      best = c;
      bestD = d;
    }
    if (best) {
      adoptInto(id, soc, "camp", best);
      adopted++;
    }
  }
  return adopted;
}
const simTickHarvestBase = simTick;
simTick = function () {
  simTickHarvestBase();
  if (W?.settlements && W.tick % HOME_PASS_CADENCE === HOME_PASS_OFFSET) adoptResidents();
};
// ── Rest owed, and room for the harvest ──────────────────────────────────────
// Fatigue rose a little every tick and fell only while a person chose to rest,
// which the labour pool never let a working person do until fatigue passed the
// gate of eighty-eight; a few ticks of rest brought it back under the gate and
// the pool put them to work again, so a whole town hovered at ninety, never
// fit (under eighty) for the fields, and the crops rotted ripe. A rest is now
// owed until fatigue is back to fifty, and the pool leaves a person who owes
// one alone. Separately, a harvest that found the store full was postponed
// while the crop stood, so a town whose store was brimming with water starved:
// the harvest now spills the town's least-needed bulk back to the ground to
// make room for grain. Matter moves; none is made.
const workerReadyForLaborHarvestBase = workerReadyForLabor;
workerReadyForLabor = function (id) {
  if (W.components.life[id]?.restDebt) return false;
  return workerReadyForLaborHarvestBase(id);
};
const HARVEST_ROOM_PER_TILE = 6,
  HARVEST_SPILL_MATERIALS = () => [C.SOLVENT, C.MINERAL, C.ENERGY, C.FUEL];
function makeRoomForHarvest(place, field) {
  const tiles = field?.tiles?.length || 1,
    want = tiles * HARVEST_ROOM_PER_TILE,
    free = () => (place.storageCapacity || 150) - placeStorageUsed(place);
  if (free() >= want) return 0;
  const targets = new Map(essentialStockTargets(place)),
    ground = idx(place.x, place.y);
  let spilled = 0;
  for (const sp of HARVEST_SPILL_MATERIALS()) {
    const need = want - free();
    if (need <= 0) break;
    const held = place.inventory[sp] || 0,
      keep = Math.round((targets.get(sp) || 0) * 0.6),
      excess = Math.max(0, held - keep),
      n = Math.min(excess, need, 65535 - tileMatterAmount(ground, sp));
    if (n <= 0) continue;
    place.inventory[sp] -= n;
    setTileMatterAmount(ground, sp, tileMatterAmount(ground, sp) + n);
    spilled += n;
  }
  return spilled;
}
const harvestCultivatedFieldHarvestBase = harvestCultivatedField;
harvestCultivatedField = function (workerId, field, place) {
  if (field?.stage === "ripe" && place) makeRoomForHarvest(place, field);
  return harvestCultivatedFieldHarvestBase(workerId, field, place);
};
// ── Measured migration ────────────────────────────────────────────────────────
function ensureHarvestState(world = W) {
  if (!world) return null;
  world.harvest = world.harvest || { version: 1, migration: { year: -1, count: 0 } };
  world.harvest.migration = world.harvest.migration || { year: -1, count: 0 };
  return world.harvest;
}
const restoreWorldDefaultsHarvestBase = restoreWorldDefaults;
restoreWorldDefaults = function () {
  restoreWorldDefaultsHarvestBase();
  ensureHarvestState(W);
};
function migrationLedger() {
  const ledger = ensureHarvestState(W).migration,
    year = Math.floor(W.tick / TICKS_PER_YEAR);
  if (ledger.year !== year) {
    ledger.year = year;
    ledger.count = 0;
  }
  return ledger;
}
function migrationBudget() {
  const towns = W.settlements.filter((s) => !s.ruined).length;
  return Math.max(MIGRATIONS_PER_YEAR_BASE, Math.ceil(towns / 3));
}
// Why a town may not send a household now, or null when it may.
function migrationGate(town) {
  ensureHarvestState(W);
  if (!town) return "no town";
  if (W.tick - (Number.isFinite(town.lastMigrationTick) ? town.lastMigrationTick : -1e9) < MIGRATION_REST) return "rested";
  if (migrationLedger().count >= migrationBudget()) return "budget";
  return null;
}
const migrateHouseholdsHarvestBase = migrateHouseholds;
migrateHouseholds = function (town, force = false) {
  if (!force && migrationGate(town)) return null;
  const ev = migrateHouseholdsHarvestBase(town, force);
  if (ev) {
    migrationLedger().count++;
    // A household or two leaving is a footnote; a column is a chapter.
    if ((ev.data?.count || 0) < 4) ev.importance = Math.min(ev.importance, 1);
  }
  return ev;
};
window.ALIFE_HARVEST_DEBUG = Object.freeze({
  extent: (buildingId) => {
    const b = W.buildings.find((x) => x.id === buildingId);
    return b ? fieldGrowthExtent(buildingPlace(b), cultivatedField(b)) : 0;
  },
  interval: (buildingId) => {
    const b = W.buildings.find((x) => x.id === buildingId);
    return b ? fieldGrowthInterval(buildingPlace(b), cultivatedField(b)) : 0;
  },
  tended: (buildingId) => {
    const b = W.buildings.find((x) => x.id === buildingId);
    return b ? fieldTended(cultivatedField(b)) : false;
  },
  cap: (placeId) => harvestCapFactor(W.settlements.find((s) => s.id === placeId) || W.camps.find((c) => c.id === placeId)),
  gate: (townId) => migrationGate(W.settlements.find((s) => s.id === townId)),
  budget: () => migrationBudget(),
  ledger: () => ({ ...migrationLedger() }),
  rest: MIGRATION_REST,
  makeRoom: (placeId) => {
    const s = W.settlements.find((x) => x.id === placeId);
    return s ? makeRoomForHarvest(s, { tiles: new Array(9) }) : 0;
  },
  restDebt: (id) => !!W.components.life[id]?.restDebt,
  adopt: () => adoptResidents(),
  homeValid: (id) => homePlaceValid(W.components.social[id]),
  ripeTarget: (buildingId) => {
    const b = W.buildings.find((x) => x.id === buildingId);
    return b ? fieldRipeTarget(buildingPlace(b), cultivatedField(b)) : 0;
  },
});
