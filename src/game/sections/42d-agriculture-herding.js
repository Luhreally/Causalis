// ================================================================
// 42D. CULTIVATED FIELDS, LIVING HERDS, AND PREDATOR DEFENSE
// ================================================================
// Crops remain tile chemistry, herd members remain individual organisms, and
// defense uses the same embodied combat graph as every other violent exchange.

function initializeAgricultureHerding(world = W) {
  if (!world) return null;
  world.fields = Array.isArray(world.fields) ? world.fields : [];
  world.herds = Array.isArray(world.herds) ? world.herds : [];
  world.fluidSplatters = Array.isArray(world.fluidSplatters) ? world.fluidSplatters : [];
  world.nextFieldId = Math.max(
    world.nextFieldId || 1,
    ...world.fields.map((field) => (field.id || 0) + 1),
  );
  world.nextHerdId = Math.max(
    world.nextHerdId || 1,
    ...world.herds.map((herd) => (herd.id || 0) + 1),
  );
  return world;
}

const restoreWorldAgricultureBase = restoreWorldDefaults;
restoreWorldDefaults = function () {
  restoreWorldAgricultureBase();
  initializeAgricultureHerding(W);
};

function cultivatedField(building) {
  initializeAgricultureHerding();
  if (!building || building.type !== "farm" || !building.complete || building.ruined) return null;
  let field = W.fields.find((candidate) => candidate.buildingId === building.id);
  if (field) {
    field.tile = idx(building.x, building.y);
    field.tiles = farmFootprintTiles(building);
    field.baselines = field.tiles.map((tile) => ({
      tile,
      organic:
        field.baselines?.find((baseline) => baseline.tile === tile)?.organic ??
        (tile === field.tile ? field.baseline?.organic : tileMatterAmount(tile, C.ORGANIC)),
      energy:
        field.baselines?.find((baseline) => baseline.tile === tile)?.energy ??
        (tile === field.tile ? field.baseline?.energy : tileMatterAmount(tile, C.ENERGY)),
    }));
    return field;
  }
  const tile = idx(building.x, building.y);
  const tiles = farmFootprintTiles(building);
  field = {
    id: W.nextFieldId++,
    buildingId: building.id,
    placeKind: building.placeKind,
    placeId: building.placeId,
    tile,
    stage: "fallow",
    cropName: `${W.definitions.species[C.ORGANIC].name} producer`,
    sowTick: -1,
    matureTick: -1,
    lastLaborTick: -999,
    lastGrowthTick: -999,
    growth: 0,
    cycles: 0,
    causeEvent: building.completedEvent || building.causeEvent || 0,
    baseline: {
      organic: tileMatterAmount(tile, C.ORGANIC),
      energy: tileMatterAmount(tile, C.ENERGY),
    },
    baselines: tiles.map((fieldTile) => ({
      tile: fieldTile,
      organic: tileMatterAmount(fieldTile, C.ORGANIC),
      energy: tileMatterAmount(fieldTile, C.ENERGY),
    })),
    cropChemistry: null,
    tiles,
  };
  W.fields.push(field);
  return field;
}

function farmFootprintTiles(building) {
  const tiles = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const x = building.x + dx,
        y = building.y + dy;
      if (inside(x, y)) tiles.push(idx(x, y));
    }
  return tiles;
}

function squareTilesAround(centerTile, radius) {
  const [centerX, centerY] = xy(centerTile),
    tiles = [];
  for (let y = Math.max(0, centerY - radius); y <= Math.min(W.height - 1, centerY + radius); y++)
    for (let x = Math.max(0, centerX - radius); x <= Math.min(W.width - 1, centerX + radius); x++)
      tiles.push(idx(x, y));
  return tiles;
}

function cultivatedPlotClear(tile, building, fieldId = 0) {
  if (!Number.isInteger(tile) || tile < 0 || tile >= W.tileCount) return false;
  const [x, y] = xy(tile);
  if (Math.max(Math.abs(x - building.x), Math.abs(y - building.y)) < 2) return false;
  return (
    developmentFootprintClear(x, y, 1, building.id, fieldId) &&
    W.tiles.liquid[tile] < 650 &&
    W.tiles.fire[tile] < 120
  );
}

function chooseCultivatedPlot(building, fieldId = 0) {
  const rotation = Math.abs(building.styleSeed || building.id) % 8,
    ringOffsets = [];
  for (let ring = 2; ring <= 9; ring++)
    for (let dy = -ring; dy <= ring; dy++)
      for (let dx = -ring; dx <= ring; dx++)
        if (Math.max(Math.abs(dx), Math.abs(dy)) === ring) ringOffsets.push([dx, dy]);
  if (ringOffsets.length) {
    const shift = rotation % ringOffsets.length;
    ringOffsets.push(...ringOffsets.splice(0, shift));
  }
  for (const [dx, dy] of ringOffsets) {
    const x = building.x + dx,
      y = building.y + dy;
    if (!inside(x, y)) continue;
    const tile = idx(x, y);
    if (cultivatedPlotClear(tile, building, fieldId)) return tile;
  }
  return null;
}

function fieldPlace(field) {
  return placeByRef(field.placeKind, field.placeId);
}

function transferPlaceMatterToTile(place, tile, requests) {
  const moved = {};
  for (const [species, requested] of requests) {
    const amount = Math.min(
      requested,
      place.inventory?.[species] || 0,
      Number.MAX_SAFE_INTEGER - tileMatterAmount(tile, species),
    );
    if (!amount) continue;
    place.inventory[species] -= amount;
    setTileMatterAmount(tile, species, tileMatterAmount(tile, species) + amount);
    moved[species] = amount;
  }
  return moved;
}

function transferPlaceMatterToField(place, tiles, requests) {
  const moved = {};
  for (const [species, requested] of requests) {
    let remaining = Math.min(requested, place.inventory?.[species] || 0);
    for (let n = 0; n < tiles.length && remaining > 0; n++) {
      const tile = tiles[n],
        share = Math.max(1, Math.ceil(remaining / (tiles.length - n))),
        amount = Math.min(
          share,
          remaining,
          Number.MAX_SAFE_INTEGER - tileMatterAmount(tile, species),
        );
      if (!amount) continue;
      place.inventory[species] -= amount;
      setTileMatterAmount(tile, species, tileMatterAmount(tile, species) + amount);
      moved[species] = (moved[species] || 0) + amount;
      remaining -= amount;
    }
  }
  return moved;
}

function fieldChemistrySignature(field) {
  const totals = {};
  for (const species of [C.ORGANIC, C.NUTRIENT, C.SOLVENT, C.PIGMENT, C.CATALYST, C.MINERAL])
    totals[species] = field.tiles.reduce(
      (total, tile) => total + tileMatterAmount(tile, species),
      0,
    );
  return totals;
}

function transferTileCropToPlace(place, tile, species, requested, reserve) {
  const available = Math.max(0, tileMatterAmount(tile, species) - reserve),
    room = Math.max(0, placeStorageRemaining(place)),
    amount = Math.min(requested, available, room, 65535 - (place.inventory[species] || 0));
  if (!amount) return 0;
  setTileMatterAmount(tile, species, tileMatterAmount(tile, species) - amount);
  place.inventory[species] += amount;
  return amount;
}

function sowCultivatedField(workerId, field, place) {
  if (!field || field.stage !== "fallow" || !place) return false;
  const tiles = field.tiles?.length ? field.tiles : [field.tile];
  const needed = [
    [C.ORGANIC, tiles.length],
    [C.NUTRIENT, tiles.length],
    [C.SOLVENT, tiles.length * 2],
  ];
  if (needed.some(([species, amount]) => (place.inventory[species] || 0) < amount)) return false;
  field.baseline = {
    organic: tileMatterAmount(field.tile, C.ORGANIC),
    energy: tileMatterAmount(field.tile, C.ENERGY),
  };
  field.baselines = tiles.map((tile) => ({
    tile,
    organic: tileMatterAmount(tile, C.ORGANIC),
    energy: tileMatterAmount(tile, C.ENERGY),
  }));
  const moved = transferPlaceMatterToField(place, tiles, needed),
    seedMass = Object.values(moved).reduce((total, amount) => total + amount, 0),
    ev = emitEvent("CropSownEvent", {
      subjects: [workerId, place.entityId].filter(Boolean),
      location: field.tile,
      factions: place.factionId ? [place.factionId] : [],
      causes: [field.causeEvent, place.importantEvents?.at(-1) || 0],
      evidence: [
        `${seedMass} conserved matter packets were divided across ${tiles.length} bounded producer tiles`,
        "every visible crop tile received remembered seed chemistry instead of only the center tile",
      ],
      magnitude: seedMass,
      importance: 2,
      data: { fieldId: field.id, buildingId: field.buildingId, moved, crop: field.cropName },
    });
  field.stage = "sown";
  field.sowTick = W.tick;
  field.matureTick = -1;
  field.lastLaborTick = W.tick;
  field.lastGrowthTick = W.tick;
  field.growth = 0;
  field.cropChemistry = fieldChemistrySignature(field);
  field.causeEvent = ev.id;
  for (const tile of tiles) {
    W.tiles.plantOrder[tile] = u16(
      W.tiles.plantOrder[tile] + Math.max(2, Math.ceil((seedMass * 5) / tiles.length)),
    );
    W.tiles.soilOrder[tile] = u16(
      W.tiles.soilOrder[tile] + Math.max(1, Math.ceil((seedMass * 2) / tiles.length)),
    );
  }
  if (place.importantEvents) place.importantEvents.push(ev.id);
  setWorkAction(
    workerId,
    "sow",
    `🌱 sowing ${field.cropName}`,
    field.tile,
    C.ORGANIC,
    field.buildingId,
  );
  return true;
}

function updateCultivatedField(building, place, operatorId = 0) {
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
    if (place.importantEvents) place.importantEvents.push(ev.id);
    return 0;
  }
  const solar = reactionById("photosynthesis")?.externalEnergyRequirement || W.laws.solarFlux;
  let grew = 0;
  for (const tile of viableTiles)
    grew += executeProcess("photosynthesis", invTile(tile), 1, {
      externalEnergy: Math.max(solar, W.laws.solarFlux),
    });
  field.lastGrowthTick = W.tick;
  if (!grew) return 0;
  field.growth += grew;
  field.stage = "growing";
  for (const tile of viableTiles)
    W.tiles.plantOrder[tile] = u16(
      W.tiles.plantOrder[tile] + Math.max(1, Math.ceil((grew * 8) / viableTiles.length)),
    );
  field.cropChemistry = fieldChemistrySignature(field);
  if (W.tick - field.sowTick >= 64 && field.growth >= Math.max(6, tiles.length)) {
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
}

function harvestCultivatedField(workerId, field, place) {
  if (!field || field.stage !== "ripe" || !place) return false;
  const tiles = field.tiles?.length ? field.tiles : [field.tile];
  let organic = 0,
    energy = 0;
  for (const tile of tiles) {
    const baseline =
      field.baselines?.find((candidate) => candidate.tile === tile) || field.baseline;
    organic += transferTileCropToPlace(place, tile, C.ORGANIC, 8, (baseline?.organic || 0) + 1);
    energy += transferTileCropToPlace(place, tile, C.ENERGY, 5, (baseline?.energy || 0) + 1);
  }
  const harvested = organic + energy;
  if (!harvested) return false;
  const ev = emitEvent("CropHarvestedEvent", {
    subjects: [workerId, place.entityId].filter(Boolean),
    location: field.tile,
    factions: place.factionId ? [place.factionId] : [],
    causes: [field.causeEvent],
    evidence: [
      `${harvested} crop matter moved from ${tiles.length} field tiles into ${place.name}'s finite storage`,
      `${organic} organic and ${energy} energetic packets were actually transferred`,
    ],
    magnitude: harvested,
    importance: 2,
    data: {
      fieldId: field.id,
      buildingId: field.buildingId,
      crop: field.cropName,
      organic,
      energy,
    },
  });
  field.stage = "fallow";
  field.cycles++;
  field.lastLaborTick = W.tick;
  field.growth = 0;
  field.causeEvent = ev.id;
  for (const tile of tiles)
    W.tiles.plantOrder[tile] = u16(
      Math.max(0, W.tiles.plantOrder[tile] - Math.ceil((harvested * 3) / tiles.length)),
    );
  if (place.importantEvents) place.importantEvents.push(ev.id);
  setWorkAction(
    workerId,
    "harvest",
    `🧺 harvesting ${harvested} conserved crop matter`,
    field.tile,
    C.ORGANIC,
    field.buildingId,
  );
  return true;
}

function performFarmLabor(workerId) {
  if (W.kind[workerId] !== KINDS.PERSON || !classifyAlive(workerId)) return false;
  const place = nearestFriendlyPlace(workerId);
  if (!place) return false;
  const fields = completedBuildings(place, "farm")
    .map(cultivatedField)
    .filter(Boolean)
    .sort(
      (left, right) =>
        (left.stage === "ripe" ? -2 : left.stage === "fallow" ? -1 : 0) -
          (right.stage === "ripe" ? -2 : right.stage === "fallow" ? -1 : 0) || left.id - right.id,
    );
  const field = fields.find(
    (candidate) => candidate.stage === "ripe" || W.tick - candidate.lastLaborTick >= 12,
  );
  if (!field) return false;
  const building = W.buildings.find((candidate) => candidate.id === field.buildingId),
    position = W.components.position[workerId];
  if (!building || !position) return false;
  const access = farmLaborAccessTile(workerId, building);
  if (!access) return false;
  if (Math.max(Math.abs(position.x - access.x), Math.abs(position.y - access.y)) > 0)
    return moveWorkerToward(
      workerId,
      idx(access.x, access.y),
      field.stage === "ripe" ? "harvest" : field.stage === "fallow" ? "sow" : "tend",
      `${field.stage === "ripe" ? "🧺 moving to harvest" : field.stage === "fallow" ? "🌱 carrying seed matter to" : "🌾 tending"} ${building.name}`,
      C.ORGANIC,
      building.id,
    );
  if (field.stage === "fallow") return sowCultivatedField(workerId, field, place);
  if (field.stage === "ripe") return harvestCultivatedField(workerId, field, place);
  if (["sown", "growing"].includes(field.stage)) {
    const moved = transferPlaceMatterToField(place, field.tiles, [
      [C.SOLVENT, Math.max(2, field.tiles.length)],
      [C.NUTRIENT, Math.max(1, Math.ceil(field.tiles.length / 3))],
    ]);
    field.lastLaborTick = W.tick;
    for (const tile of field.tiles) W.tiles.soilOrder[tile] = u16(W.tiles.soilOrder[tile] + 1);
    setWorkAction(
      workerId,
      "tend",
      `🌾 tending ${field.cropName}; ${Object.values(moved).reduce((a, b) => a + b, 0)} matter supplied`,
      field.tile,
      C.NUTRIENT,
      building.id,
    );
    return true;
  }
  return false;
}

function farmLaborAccessTile(workerId, building) {
  const position = W.components.position[workerId];
  if (!position || !building) return null;
  const options = [];
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== 2) continue;
      const x = building.x + dx,
        y = building.y + dy;
      if (!inside(x, y)) continue;
      if (typeof movementTileBlocked === "function" && movementTileBlocked(workerId, x, y))
        continue;
      options.push({
        x,
        y,
        score:
          dist2(position.x, position.y, x, y) * 100 +
          (hashParts(W.seedHash, "farm-access", workerId, building.id, x, y) % 97),
      });
    }
  options.sort((left, right) => left.score - right.score || left.y - right.y || left.x - right.x);
  return options[0] || null;
}

const performCivilLaborAgricultureBase = performCivilLabor;
performCivilLabor = function (id) {
  const place = W.kind[id] === KINDS.PERSON ? nearestFriendlyPlace(id) : null,
    ripe = place
      ? completedBuildings(place, "farm").some(
          (building) => cultivatedField(building)?.stage === "ripe",
        )
      : false;
  if ((ripe || (W.tick + id) % 8 === 0) && performFarmLabor(id)) return true;
  return performCivilLaborAgricultureBase(id);
};

function herdForAnimal(id) {
  const herdId = W.components.life[id]?.herdId || 0;
  return herdId ? W.herds.find((herd) => herd.id === herdId && herd.active) || null : null;
}

function herdEnclosure(herd) {
  if (!herd?.enclosureBuildingId) return null;
  return W.buildings.find((building) => building.id === herd.enclosureBuildingId) || null;
}

function ensureHerdEnclosure(herd, place) {
  let enclosure = herdEnclosure(herd);
  if (enclosure && !enclosure.ruined) return enclosure;
  const kind = placeKindKey(place);
  enclosure = W.buildings.find(
    (building) =>
      !building.ruined &&
      building.type === "corral" &&
      building.placeKind === kind &&
      building.placeId === place.id,
  );
  if (!enclosure)
    enclosure = planBuilding(
      place,
      "corral",
      Math.max(place.management?.priorities?.food || 3, place.management?.priorities?.defense || 2),
    );
  herd.enclosureBuildingId = enclosure?.id || 0;
  return enclosure || null;
}

function herdEnclosureRadius(herd) {
  return 1;
}

function enclosureCondition(enclosure) {
  return enclosure?.complete && !enclosure.ruined
    ? clamp(enclosure.integrity / Math.max(1, enclosure.maxIntegrity), 0, 1)
    : 0;
}

function animalInsideEnclosure(animalId, herd, enclosure = herdEnclosure(herd)) {
  const position = W.components.position[animalId];
  if (!position || !enclosure?.complete || enclosure.ruined) return false;
  return (
    Math.max(Math.abs(position.x - enclosure.x), Math.abs(position.y - enclosure.y)) <=
    herdEnclosureRadius(herd)
  );
}

function removeHerdAnimal(herd, animalId) {
  herd.animalIds = herd.animalIds.filter((id) => id !== animalId);
  if (W.components.life[animalId]) W.components.life[animalId].herdId = 0;
}

function releaseEscapedAnimal(herd, animalId, enclosure) {
  removeHerdAnimal(herd, animalId);
  const event = emitEvent("HerdEscapeEvent", {
    subjects: [animalId, herd.herderId],
    location: idx(enclosure.x, enclosure.y),
    causes: [herd.causeEvent, enclosure.lastDamage?.causeEvent || 0],
    evidence: [
      `${enclosure.name} had only ${Math.round(enclosureCondition(enclosure) * 100)}% structural integrity`,
      `${entityName(animalId)} physically crossed the damaged perimeter instead of disappearing from an abstract livestock count`,
    ],
    magnitude: 1,
    importance: 2,
    data: { herdId: herd.id, buildingId: enclosure.id },
  });
  herd.state = "animal escaped through damaged enclosure";
  herd.causeEvent = event.id;
}

function constrainHerdMovement(animalId, proposedX, proposedY) {
  const position = W.components.position[animalId],
    herd = herdForAnimal(animalId),
    enclosure = herdEnclosure(herd);
  if (!position || !herd || !enclosure?.complete || enclosure.ruined)
    return { x: proposedX, y: proposedY };
  const radius = herdEnclosureRadius(herd),
    currentDistance = Math.max(
      Math.abs(position.x - enclosure.x),
      Math.abs(position.y - enclosure.y),
    ),
    proposedDistance = Math.max(
      Math.abs(proposedX - enclosure.x),
      Math.abs(proposedY - enclosure.y),
    );
  if (
    proposedDistance <= radius ||
    (currentDistance > radius && proposedDistance < currentDistance)
  )
    return { x: proposedX, y: proposedY };
  herd.state = "contained behind a closed material gate";
  return { x: position.x, y: position.y };
}

function markEnclosureBreach(herd, enclosure, attackerId, causeEvent) {
  if (herd.lastBreachBuildingId === enclosure.id && herd.lastBreachTick === W.tick) return 0;
  const event = emitEvent("EnclosureBreachedEvent", {
    subjects: [attackerId, herd.herderId].filter(Boolean),
    location: idx(enclosure.x, enclosure.y),
    factions: attackerId ? combatFactions(attackerId, herd.herderId) : [],
    causes: [causeEvent, herd.causeEvent],
    evidence: [
      `${enclosure.name} fell below safe containment strength after cited structural damage`,
      "predators, thieves, and herd animals can cross only through this physical breach",
    ],
    magnitude: Math.max(1, Math.round((1 - enclosureCondition(enclosure)) * 100)),
    importance: 2,
    data: { herdId: herd.id, buildingId: enclosure.id, condition: enclosureCondition(enclosure) },
  });
  herd.lastBreachBuildingId = enclosure.id;
  herd.lastBreachTick = W.tick;
  herd.state = "material enclosure breached";
  herd.causeEvent = event.id;
  return event.id;
}

function enclosureBlocksPredator(predatorId, animalId) {
  const herd = herdForAnimal(animalId),
    enclosure = herdEnclosure(herd);
  if (
    !herd ||
    !enclosure?.complete ||
    enclosure.ruined ||
    !animalInsideEnclosure(animalId, herd, enclosure)
  )
    return false;
  const predator = W.components.position[predatorId];
  if (!predator || animalInsideEnclosure(predatorId, herd, enclosure)) return false;
  if (enclosure.integrity <= 0) return false;
  const life = W.components.life[predatorId],
    previous = life?.lastEnclosureAttackTick ?? -999;
  if (W.tick - previous >= 5) {
    life.lastEnclosureAttackTick = W.tick;
    const event = emitEvent("EnclosureAttackedEvent", {
        subjects: [predatorId, animalId, herd.herderId],
        location: idx(enclosure.x, enclosure.y),
        causes: [herd.causeEvent],
        evidence: [
          `${entityName(predatorId)} reached the enclosure perimeter but not the protected prey`,
          `${enclosure.name} is made from ${enclosure.requirements.map(([species]) => W.definitions.species[species].name).join(" and ")}`,
        ],
        magnitude: 1,
        importance: 1,
        data: { herdId: herd.id, buildingId: enclosure.id, protectedId: animalId },
      }),
      force = 12 + phenotype(predatorId).size * 18 + phenotype(predatorId).aggression * 12,
      damage = damageBuildingDirect(
        enclosure,
        force,
        `${entityName(predatorId)} tore at the livestock enclosure`,
        event.id,
      );
    event.magnitude = damage;
    event.data.damage = damage;
    event.data.remainingIntegrity = enclosure.integrity;
    if (enclosure.ruined) markEnclosureBreach(herd, enclosure, predatorId, event.id);
    else herd.state = "predator stopped at material enclosure";
  }
  return true;
}

const performHuntEnclosureBase = performHunt;
performHunt = function (id, prey) {
  const accessible = prey.filter((target) => !enclosureBlocksPredator(id, target));
  return performHuntEnclosureBase(id, accessible);
};

function chooseHerdPasture(place, herd) {
  let best = idx(place.x, place.y),
    bestScore = -Infinity;
  for (let y = Math.max(0, place.y - 7); y <= Math.min(W.height - 1, place.y + 7); y += 2)
    for (let x = Math.max(0, place.x - 7); x <= Math.min(W.width - 1, place.x + 7); x += 2) {
      const tile = idx(x, y);
      if (W.tiles.liquid[tile] > 650 || W.tiles.fire[tile] > 100) continue;
      const cultivated = W.fields.some(
          (field) => field.tile === tile && ["sown", "growing", "ripe"].includes(field.stage),
        ),
        score =
          tileFood(tile, "grazer") * 3.2 +
          tileMoisture(tile) * 0.7 -
          W.tiles.danger[tile] * 0.25 -
          tileFear(tile) * 0.8 -
          (cultivated ? 180 : 0) -
          Math.sqrt(dist2(x, y, place.x, place.y)) * 2 +
          counterRand("pasture-rank", herd?.id || 0, tile) * 0.01;
      if (score > bestScore) {
        best = tile;
        bestScore = score;
      }
    }
  return best;
}

function formPreyHerd(herderId, place, suppliedAnimals = null) {
  initializeAgricultureHerding();
  if (!place || !classifyAlive(herderId)) return null;
  const existing = W.herds.find(
    (herd) => herd.active && herd.placeKind === placeKindKey(place) && herd.placeId === place.id,
  );
  if (existing) return existing;
  const animals = (suppliedAnimals || entityAtRadius(idx(place.x, place.y), 9, KINDS.HERBIVORE))
    .filter((id) => classifyAlive(id) && !herdForAnimal(id))
    .sort((left, right) => left - right)
    .slice(0, 10);
  if (animals.length < 2) return null;
  const herd = {
      id: W.nextHerdId++,
      placeKind: placeKindKey(place),
      placeId: place.id,
      herderId,
      animalIds: animals,
      pastureTile: idx(place.x, place.y),
      active: true,
      state: "gathering",
      formedTick: W.tick,
      lastMoveTick: -999,
      lastDefenseTick: -999,
      causeEvent: 0,
    },
    pasture = chooseHerdPasture(place, herd),
    ev = emitEvent("HerdFormedEvent", {
      subjects: [herderId, ...animals, place.entityId].filter(Boolean),
      location: idx(place.x, place.y),
      factions: place.factionId ? [place.factionId] : [],
      causes: [place.importantEvents?.at(-1) || 0],
      evidence: [
        `${animals.length} individually simulated grazers were gathered without creating abstract livestock`,
        "the herder, animals, pasture destination, kin births, and predator threats remain explicit",
      ],
      magnitude: animals.length,
      importance: 2,
      data: { herdId: herd.id, placeKind: herd.placeKind, placeId: herd.placeId },
    });
  herd.pastureTile = pasture;
  herd.causeEvent = ev.id;
  W.herds.push(herd);
  const enclosure = ensureHerdEnclosure(herd, place);
  if (enclosure) herd.state = "awaiting material enclosure";
  for (const animal of animals) {
    const life = W.components.life[animal];
    life.herdId = herd.id;
    life.domestication = Math.max(life.domestication || 0, 0.24);
    addRelation(herderId, animal, "tends", 0.62, ev.id);
  }
  if (place.importantEvents) place.importantEvents.push(ev.id);
  setWorkAction(herderId, "herd", `🐑 gathering ${animals.length} living grazers`, pasture);
  return herd;
}

function moveHerdAnimalToward(animalId, targetTile) {
  const position = W.components.position[animalId],
    [tx, ty] = xy(targetTile);
  if (!position || dist2(position.x, position.y, tx, ty) <= 2) return false;
  const options = DIRS.slice(0, 8)
    .map(([dx, dy], order) => {
      const x = position.x + dx,
        y = position.y + dy;
      if (!inside(x, y)) return { x, y, order, score: -Infinity };
      const tile = idx(x, y);
      return {
        x,
        y,
        order,
        score:
          -Math.sqrt(dist2(x, y, tx, ty)) * 18 -
          W.tiles.fire[tile] * 0.5 -
          W.tiles.danger[tile] * 0.08 -
          (W.tiles.liquid[tile] > 700 ? 300 : 0) +
          tileFood(tile, "grazer") * 0.25,
      };
    })
    .sort((left, right) => right.score - left.score || left.order - right.order);
  const best = options[0];
  if (!best || !Number.isFinite(best.score)) return false;
  queueEffect("MoveEntity", { entityId: animalId, x: best.x, y: best.y }, animalId);
  return true;
}

function absorbHerdBirths(herd) {
  const members = new Set(herd.animalIds),
    newborns = W.activeIds.filter((id) => {
      if (
        W.kind[id] !== KINDS.HERBIVORE ||
        !classifyAlive(id) ||
        members.has(id) ||
        herdForAnimal(id)
      )
        return false;
      return (W.components.identity[id]?.parents || []).some((parent) => members.has(parent));
    });
  for (const newborn of newborns) {
    herd.animalIds.push(newborn);
    W.components.life[newborn].herdId = herd.id;
    W.components.life[newborn].domestication = 0.28;
    const birth = W.components.identity[newborn]?.birthEventId || 0,
      ev = emitEvent("HerdBirthEvent", {
        subjects: [newborn, ...W.components.identity[newborn].parents, herd.herderId],
        location: idx(W.components.position[newborn].x, W.components.position[newborn].y),
        causes: [birth, herd.causeEvent],
        evidence: ["offspring inherited matter from two physically present herd members"],
        magnitude: 1,
        importance: 1,
        data: { herdId: herd.id },
      });
    herd.causeEvent = ev.id;
  }
}

function feedEnclosedHerd(herd, place, enclosure) {
  if (W.tick % 8 || !enclosure?.complete || enclosure.ruined) return 0;
  const tile = idx(enclosure.x, enclosure.y),
    animals = herd.animalIds.filter(classifyAlive),
    interiorTiles = farmFootprintTiles(enclosure);
  if (!animals.length) return 0;
  let moved = 0;
  for (const animal of animals) {
    const chemistry = W.components.chemistry[animal]?.q,
      digestive = W.components.inventory[animal]?.digestive;
    if (!chemistry || !digestive) continue;
    for (const [species, target] of [
      [C.ORGANIC, 18],
      [C.NUTRIENT, 9],
    ]) {
      const amount = Math.min(
        Math.max(0, target - digestive[species]),
        place.inventory?.[species] || 0,
        65535 - digestive[species],
      );
      if (!amount) continue;
      place.inventory[species] -= amount;
      digestive[species] += amount;
      moved += amount;
    }
    const water = Math.min(
      Math.max(0, 120 - chemistry[C.SOLVENT]),
      place.inventory?.[C.SOLVENT] || 0,
      65535 - chemistry[C.SOLVENT],
    );
    if (water) {
      place.inventory[C.SOLVENT] -= water;
      chemistry[C.SOLVENT] += water;
      moved += water;
    }
  }
  if (!moved) {
    for (const [n, interiorTile] of interiorTiles.entries()) {
      const species = n % 3 === 2 ? C.NUTRIENT : C.ORGANIC,
        reserve = species === C.ORGANIC ? 8 : 5,
        sourceTiles = squareTilesAround(tile, 5)
          .filter((source) => !interiorTiles.includes(source))
          .sort(
            (left, right) =>
              tileMatterAmount(right, species) - tileMatterAmount(left, species) || left - right,
          ),
        source = sourceTiles.find((candidate) => tileMatterAmount(candidate, species) > reserve);
      if (source == null) continue;
      const amount = Math.min(2, tileMatterAmount(source, species) - reserve);
      setTileMatterAmount(source, species, tileMatterAmount(source, species) - amount);
      setTileMatterAmount(interiorTile, species, tileMatterAmount(interiorTile, species) + amount);
      moved += amount;
    }
  }
  if (!moved) return 0;
  const event = emitEvent("HerdFedEvent", {
    subjects: [herd.herderId, ...herd.animalIds.slice(0, 5)],
    location: tile,
    factions: place.factionId ? [place.factionId] : [],
    causes: [herd.causeEvent],
    evidence: [
      `${moved} conserved food and water packets were provisioned across the nine-tile enclosure`,
      "ranch feed came from community stores or nearby forage and entered real digestive/body chemistry",
    ],
    magnitude: moved,
    importance: 1,
    data: { herdId: herd.id, buildingId: enclosure.id },
  });
  herd.causeEvent = event.id;
  return moved;
}

const shelterProtectionHerdBase = shelterProtectionAt;
shelterProtectionAt = function (id, tile) {
  const protection = shelterProtectionHerdBase(id, tile),
    herd = herdForAnimal(id),
    enclosure = herdEnclosure(herd);
  if (
    W.kind[id] !== KINDS.HERBIVORE ||
    !enclosure?.complete ||
    enclosure.ruined ||
    !animalInsideEnclosure(id, herd, enclosure)
  )
    return protection;
  return Math.max(protection, 0.9 * Math.max(0.35, enclosureCondition(enclosure)));
};

const updateHealthHerdBase = updateHealth;
updateHealth = function (id) {
  const herd = herdForAnimal(id),
    enclosure = herdEnclosure(herd);
  if (
    W.kind[id] === KINDS.HERBIVORE &&
    enclosure?.complete &&
    !enclosure.ruined &&
    animalInsideEnclosure(id, herd, enclosure)
  ) {
    const position = W.components.position[id],
      tile = idx(position.x, position.y),
      chemistry = W.components.chemistry[id]?.q,
      digestive = W.components.inventory[id]?.digestive;
    if (digestive?.[C.ORGANIC] < 6) performFeeding(id, tile);
    if (chemistry?.[C.SOLVENT] < 35) performDrinking(id, tile);
  }
  return updateHealthHerdBase(id);
};

function factionsAtWar(left, right) {
  return !!(
    left &&
    right &&
    left !== right &&
    W.activeWars?.some(
      (war) =>
        !war.ended && ((war.a === left && war.b === right) || (war.a === right && war.b === left)),
    )
  );
}

function updateHerdTheftThreats() {
  for (const herd of W.herds.filter((candidate) => candidate.active)) {
    const place = fieldPlace(herd),
      enclosure = herdEnclosure(herd);
    if (!place?.factionId || !enclosure || !herd.animalIds.length) continue;
    const intruders = W.activeIds
      .filter((id) => {
        if (W.kind[id] !== KINDS.PERSON || !classifyAlive(id)) return false;
        const factionId = W.components.social[id]?.factionId || 0,
          position = W.components.position[id];
        return (
          factionsAtWar(factionId, place.factionId) &&
          position &&
          (dist2(position.x, position.y, enclosure.x, enclosure.y) <= 25 ||
            herd.animalIds.some((animal) => {
              const animalPosition = W.components.position[animal];
              return (
                animalPosition &&
                dist2(position.x, position.y, animalPosition.x, animalPosition.y) <= 9
              );
            }))
        );
      })
      .sort((left, right) => left - right);
    const thief = intruders[0];
    if (!thief) continue;
    const thiefLife = W.components.life[thief],
      previous = thiefLife.lastHerdTheftTick ?? -999;
    if (W.tick - previous < 16) continue;
    thiefLife.lastHerdTheftTick = W.tick;
    if (enclosure.complete && !enclosure.ruined) {
      const event = emitEvent("HerdTheftPreventedEvent", {
          subjects: [thief, herd.herderId, herd.animalIds[0]],
          location: idx(enclosure.x, enclosure.y),
          factions: [W.components.social[thief]?.factionId, place.factionId].filter(Boolean),
          causes: [herd.causeEvent],
          evidence: [
            `${entityName(thief)} reached the herd but the closed material perimeter blocked removal`,
            "the intruder must physically breach the enclosure before an animal can be taken",
          ],
          magnitude: 1,
          importance: 2,
          data: { herdId: herd.id, buildingId: enclosure.id },
        }),
        force = 6 + combatEquipmentQuality(thief) * 0.16,
        damage = damageBuildingDirect(
          enclosure,
          force,
          `${entityName(thief)} attempted to force the livestock gate`,
          event.id,
        );
      event.data.damage = damage;
      event.data.remainingIntegrity = enclosure.integrity;
      herd.state = "theft attempt stopped by enclosure";
      herd.causeEvent = event.id;
      if (enclosure.ruined) markEnclosureBreach(herd, enclosure, thief, event.id);
      continue;
    }
    const thiefPosition = W.components.position[thief],
      animal =
        herd.animalIds.find((id) => animalInsideEnclosure(id, herd, enclosure)) ||
        herd.animalIds.find((id) => {
          const position = W.components.position[id];
          return (
            position &&
            thiefPosition &&
            dist2(position.x, position.y, thiefPosition.x, thiefPosition.y) <= 25
          );
        });
    if (!animal) continue;
    removeHerdAnimal(herd, animal);
    W.components.life[animal].stolenByFactionId = W.components.social[thief]?.factionId || 0;
    const event = emitEvent("HerdAnimalStolenEvent", {
      subjects: [thief, animal, herd.herderId],
      location: idx(enclosure.x, enclosure.y),
      factions: [W.components.social[thief]?.factionId, place.factionId].filter(Boolean),
      causes: [herd.causeEvent, enclosure.lastDamage?.causeEvent || 0],
      evidence: [
        enclosure.ruined || enclosure.lastDamage
          ? "a prior physical breach opened the livestock perimeter"
          : "the livestock enclosure was not yet complete enough to close its perimeter",
        `${entityName(thief)} removed ${entityName(animal)} from the living herd roster`,
      ],
      magnitude: 1,
      importance: 3,
      data: { herdId: herd.id, buildingId: enclosure.id },
    });
    addRelation(thief, animal, "stole", 1, event.id);
    herd.state = "animal stolen through breached enclosure";
    herd.causeEvent = event.id;
  }
}

function updateLivingHerds() {
  initializeAgricultureHerding();
  let moved = false;
  for (const herd of W.herds.filter((candidate) => candidate.active)) {
    herd.animalIds = herd.animalIds.filter(
      (animal) => W.kind[animal] === KINDS.HERBIVORE && classifyAlive(animal),
    );
    if (!herd.animalIds.length) {
      herd.active = false;
      herd.state = "lost";
      continue;
    }
    absorbHerdBirths(herd);
    const place = fieldPlace(herd);
    if (!place || (herd.placeKind === "camp" ? !place.active : place.ruined)) {
      herd.active = false;
      herd.state = "dispersed";
      for (const animal of herd.animalIds) W.components.life[animal].herdId = 0;
      continue;
    }
    const enclosure = ensureHerdEnclosure(herd, place),
      enclosed = !!(enclosure?.complete && !enclosure.ruined);
    if (enclosed) {
      herd.pastureTile = idx(enclosure.x, enclosure.y);
      if (!herd.enclosedTick || herd.enclosureCompletedBuildingId !== enclosure.id) {
        const event = emitEvent("HerdEnclosedEvent", {
          subjects: [herd.herderId, ...herd.animalIds.slice(0, 8), place.entityId].filter(Boolean),
          location: herd.pastureTile,
          factions: place.factionId ? [place.factionId] : [],
          causes: [herd.causeEvent, enclosure.completedEvent || enclosure.causeEvent],
          evidence: [
            `${enclosure.name} was completed from ${enclosure.requirements.map(([species, amount]) => `${amount} ${W.definitions.species[species].name}`).join(", ")}`,
            "its closed gate constrains individual animal movement and blocks unbreached predator or theft access",
          ],
          magnitude: herd.animalIds.length,
          importance: 2,
          data: { herdId: herd.id, buildingId: enclosure.id },
        });
        herd.enclosedTick = W.tick || 1;
        herd.enclosureCompletedBuildingId = enclosure.id;
        herd.causeEvent = event.id;
      }
      feedEnclosedHerd(herd, place, enclosure);
    }
    if (
      !enclosed &&
      (W.tick - herd.lastMoveTick >= 96 ||
        tileFood(herd.pastureTile, "grazer") < herd.animalIds.length * 2)
    ) {
      const previous = herd.pastureTile,
        next = chooseHerdPasture(place, herd);
      herd.lastMoveTick = W.tick;
      if (next !== previous) {
        herd.pastureTile = next;
        herd.state = "moving to pasture";
        const ev = emitEvent("HerdMovedEvent", {
          subjects: [herd.herderId, ...herd.animalIds.slice(0, 8)],
          location: next,
          factions: place.factionId ? [place.factionId] : [],
          causes: [herd.causeEvent],
          evidence: [
            `grazing value at the old pasture fell to ${tileFood(previous, "grazer").toFixed(1)}`,
            "the herd walked through traversable adjacent tiles toward a safer food gradient",
          ],
          magnitude: herd.animalIds.length,
          importance: 1,
          data: { herdId: herd.id, previousTile: previous, nextTile: next },
        });
        herd.causeEvent = ev.id;
      }
    }
    for (const animal of herd.animalIds.slice(0, 24)) {
      moved = moveHerdAnimalToward(animal, herd.pastureTile) || moved;
      const life = W.components.life[animal];
      life.domestication = clamp((life.domestication || 0) + 0.0007, 0, 1);
    }
    const herder = herd.herderId,
      herderPosition = W.components.position[herder],
      [px, py] = xy(herd.pastureTile);
    if (herderPosition && classifyAlive(herder)) {
      if (dist2(herderPosition.x, herderPosition.y, px, py) > 9)
        moveWorkerToward(
          herder,
          herd.pastureTile,
          "herd",
          `🐑 guiding ${herd.animalIds.length} living grazers toward pasture`,
        );
      else {
        herd.state = enclosed ? "secured inside material enclosure" : "grazing under watch";
        setWorkAction(
          herder,
          "herd",
          enclosed
            ? `🔒 tending feed and the closed gate for ${herd.animalIds.length} grazers`
            : `🐑 watching ${herd.animalIds.length} grazers reproduce and feed`,
          herd.pastureTile,
        );
      }
    }
  }
  if (moved) resolveEffects();
}

function maybeFormLivingHerds() {
  const places = W.settlements
    .filter((place) => !place.ruined)
    .concat(W.camps.filter((place) => place.active));
  for (const place of places) {
    if (
      W.herds.some(
        (herd) =>
          herd.active && herd.placeKind === placeKindKey(place) && herd.placeId === place.id,
      )
    )
      continue;
    const people = entityAtRadius(idx(place.x, place.y), 8, KINDS.PERSON)
        .filter(classifyAlive)
        .sort((left, right) => left - right),
      prey = entityAtRadius(idx(place.x, place.y), 9, KINDS.HERBIVORE).filter(classifyAlive);
    if (people.length < 2 || prey.length < 2) continue;
    const supported =
      completedBuildings(place, "farm").length > 0 ||
      (place.inventory?.[C.ORGANIC] || 0) > 20 ||
      !place.knownProcesses;
    if (!supported || counterRand("herd-formation", W.tick >> 6, place.id) > 0.42) continue;
    formPreyHerd(people[0], place, prey);
  }
}

function protectedPreyNearPredator(predatorId) {
  const predator = W.components.position[predatorId];
  if (!predator) return null;
  for (const herd of W.herds.filter((candidate) => candidate.active))
    for (const animal of herd.animalIds) {
      const position = W.components.position[animal];
      if (position && dist2(position.x, position.y, predator.x, predator.y) <= 25)
        return { targetId: animal, herd };
    }
  const target = nearbyIds(
    predatorId,
    4,
    (id) => W.kind[id] === KINDS.PERSON && classifyAlive(id),
  )[0];
  if (target) return { targetId: target, herd: null };
  const remembered = W.components.life[predatorId]?.preyTargetId || 0;
  if (
    remembered &&
    classifyAlive(remembered) &&
    (W.kind[remembered] === KINDS.PERSON || herdForAnimal(remembered))
  )
    return { targetId: remembered, herd: herdForAnimal(remembered) };
  return null;
}

function defendAgainstPredator(defenderId, predatorId, protectedState, forceHit = false) {
  const defender = W.components.position[defenderId],
    predator = W.components.position[predatorId];
  if (!defender || !predator || !classifyAlive(defenderId) || !classifyAlive(predatorId)) return 0;
  const tile = idx(predator.x, predator.y);
  if (dist2(defender.x, defender.y, predator.x, predator.y) > 2) {
    moveWorkerToward(
      defenderId,
      tile,
      "predator_defense",
      `🛡️ closing on ${entityName(predatorId)} before it reaches ${entityName(protectedState.targetId)}`,
    );
    return 0;
  }
  const defenderLife = W.components.life[defenderId],
    defenseCooldowns =
      defenderLife.predatorDefenseCooldowns || (defenderLife.predatorDefenseCooldowns = {}),
    previous = defenseCooldowns[predatorId] ?? -999;
  if (!forceHit && W.tick - previous < 8) return 0;
  defenseCooldowns[predatorId] = W.tick;
  const cause =
      W.events.findLast(
        (event) =>
          (event.type === "InjuryEvent" && event.subjects[1] === predatorId) ||
          (event.type === "PredationEvent" && event.subjects[0] === predatorId),
      )?.id ||
      protectedState.herd?.causeEvent ||
      0,
    defense = emitEvent("PredatorDefenseEvent", {
      subjects: [defenderId, predatorId, protectedState.targetId],
      location: tile,
      factions: combatFactions(defenderId, predatorId),
      causes: [cause],
      evidence: [
        protectedState.herd
          ? `the predator entered striking range of herd ${protectedState.herd.id}`
          : "the predator entered striking range of a living community member",
        "a people-level defender physically intercepted it instead of only increasing an abstract defense score",
      ],
      magnitude: 1,
      importance: 2,
      data: { herdId: protectedState.herd?.id || 0, protectedId: protectedState.targetId },
    }),
    result = detailedCombatExchange(defenderId, predatorId, {
      causeEvent: defense.id,
      predatorDefense: true,
      intensity: 0.86,
      force: forceHit,
      forceHit,
    });
  defense.data.outcome =
    result === 2 ? "predator killed" : result === 1 ? "predator wounded" : "intercepted";
  setWorkAction(
    defenderId,
    "predator_defense",
    `⚔️ ${defense.data.outcome} while protecting ${entityName(protectedState.targetId)}`,
    tile,
  );
  if (protectedState.herd) {
    protectedState.herd.state = "defended from predator";
    protectedState.herd.lastDefenseTick = W.tick;
    protectedState.herd.causeEvent = defense.id;
  }
  return result || -1;
}

function updatePredatorDefense() {
  let responses = 0;
  for (const predatorId of W.activeIds) {
    if (responses >= 12 || W.kind[predatorId] !== KINDS.PREDATOR || !classifyAlive(predatorId))
      continue;
    const protectedState = protectedPreyNearPredator(predatorId);
    if (!protectedState) continue;
    const predator = W.components.position[predatorId],
      preferred = protectedState.herd?.herderId || 0,
      protectedFaction = protectedState.herd
        ? fieldPlace(protectedState.herd)?.factionId || 0
        : W.components.social[protectedState.targetId]?.factionId || 0,
      defenders = [preferred, ...nearbyIds(predatorId, 7, (id) => W.kind[id] === KINDS.PERSON)]
        .filter(
          (id, index, list) =>
            id &&
            list.indexOf(id) === index &&
            classifyAlive(id) &&
            derivedLife(id).health > 24 &&
            embodiedCapability(id).locomotion > 0.2 &&
            embodiedCapability(id).manipulation > 0.15 &&
            (!protectedFaction ||
              !W.components.social[id]?.factionId ||
              W.components.social[id].factionId === protectedFaction),
        )
        .sort(
          (left, right) =>
            dist2(
              W.components.position[left].x,
              W.components.position[left].y,
              predator.x,
              predator.y,
            ) -
              dist2(
                W.components.position[right].x,
                W.components.position[right].y,
                predator.x,
                predator.y,
              ) || left - right,
        );
    if (!defenders.length) continue;
    for (const defenderId of defenders.slice(0, Math.min(4, 12 - responses))) {
      defendAgainstPredator(defenderId, predatorId, protectedState);
      responses++;
      if (!classifyAlive(predatorId)) break;
    }
  }
}

function updateCultivatedFields() {
  for (const building of W.buildings.filter(
    (candidate) => candidate.type === "farm" && candidate.complete && !candidate.ruined,
  )) {
    const field = cultivatedField(building),
      place = buildingPlace(building);
    if (!field || !place || !["sown", "growing"].includes(field.stage)) continue;
    if (W.tick - field.lastGrowthTick >= 64) updateCultivatedField(building, place, 0);
  }
}

const simTickAgricultureBase = simTick;
simTick = function () {
  simTickAgricultureBase();
  if (!W) return;
  initializeAgricultureHerding();
  if (W.tick % 4 === 0) updatePredatorDefense();
  if (W.tick % 8 === 0) updateLivingHerds();
  if (W.tick % 16 === 0) updateHerdTheftThreats();
  if (W.tick % 32 === 0) updateCultivatedFields();
  if (W.tick % 64 === 0) maybeFormLivingHerds();
  // A tick boundary is a save/hash boundary. Resolve any defensive or herding
  // movement queued by this late wrapper so archives never discard pending work.
  if (W.effects.length) {
    resolveEffects();
    rebuildSpatialBins();
  }
};

const eventSentenceAgricultureBase = eventSentence;
eventSentence = function (event) {
  const names = event.subjects.map(entityName),
    location = locationName(event.location);
  switch (event.type) {
    case "CropSownEvent":
      return `🌱 ${names[0]} sowed ${event.data.magnitude || event.magnitude} conserved matter into ${event.data.crop} at ${location}.`;
    case "FieldMaturedEvent":
      return `🌾 A cultivated ${event.data.crop} field matured through measured photosynthesis at ${location}.`;
    case "CropHarvestedEvent":
      return `🧺 ${names[0]} harvested ${event.magnitude} actual matter from ${event.data.crop} at ${location}.`;
    case "CropFailedEvent":
      return `🥀 ${event.data.crop} failed at ${location}; fire or water loss destroyed its organized growth without deleting its matter.`;
    case "HerdFormedEvent":
      return `🐑 ${names[0]} gathered ${event.magnitude} individually simulated prey animals into herd ${event.data.herdId}.`;
    case "HerdMovedEvent":
      return `🐾 Herd ${event.data.herdId} walked to a safer, richer pasture at ${location}.`;
    case "HerdBirthEvent":
      return `🐣 ${names[0]} was born from physically present herd parents and joined herd ${event.data.herdId}.`;
    case "HerdEnclosedEvent":
      return `🔒 ${names[0]} secured herd ${event.data.herdId} inside a completed material enclosure at ${location}.`;
    case "HerdFedEvent":
      return `🌿 ${names[0]} moved ${event.magnitude} conserved food matter into enclosed herd ${event.data.herdId}.`;
    case "HerdEscapeEvent":
      return `🐾 ${names[0]} escaped herd ${event.data.herdId} through a physically damaged enclosure at ${location}.`;
    case "EnclosureAttackedEvent":
      return `🦷 ${names[0]} attacked the material enclosure protecting ${names[1]} at ${location}, causing ${event.data.damage || 0} structural damage.`;
    case "EnclosureBreachedEvent":
      return `⚠️ ${names[0]} breached herd ${event.data.herdId}'s enclosure at ${location}; containment and access protection were physically lost.`;
    case "HerdTheftPreventedEvent":
      return `🔐 ${names[0]} tried to take ${names[2]} but herd ${event.data.herdId}'s closed enclosure blocked the theft.`;
    case "HerdAnimalStolenEvent":
      return `🐑 ${names[0]} removed ${names[1]} through a prior breach in herd ${event.data.herdId}'s enclosure.`;
    case "PredatorDefenseEvent":
      return `🛡️ ${names[0]} intercepted ${names[1]} while it threatened ${names[2]} at ${location}; ${event.data.outcome || "combat followed"}.`;
    default:
      return eventSentenceAgricultureBase(event);
  }
};

const organismInspectorHerdBase = organismInspector;
organismInspector = function (id) {
  let html = organismInspectorHerdBase(id);
  const herd = herdForAnimal(id);
  if (!herd) return html;
  const place = fieldPlace(herd),
    herder = classifyAlive(herd.herderId) ? entityName(herd.herderId) : "no living herder",
    enclosure = herdEnclosure(herd),
    materials = enclosure?.requirements
      ?.map(([species]) => W.definitions.species[species].name)
      .join(" + ");
  html += `<div class="subhead">Living herd state</div><div class="card"><div class="kv"><span>Herd</span><b>${herd.id} · ${esc(herd.state)}</b><span>Home community</span><b>${esc(place?.name || "dispersed")}</b><span>Herder</span><b>${esc(herder)}</b><span>Living herd members</span><b>${herd.animalIds.filter(classifyAlive).length}</b><span>Domestication</span><b>${pct((W.components.life[id].domestication || 0) * 100)}</b><span>Pasture tile</span><b>${xy(herd.pastureTile).join(", ")}</b><span>Enclosure</span><b>${enclosure ? `${esc(enclosure.name)} · ${enclosure.complete && !enclosure.ruined ? `${pct(enclosureCondition(enclosure) * 100)} secure` : enclosure.ruined ? "breached" : `${pct(enclosure.progress * 100)} built`}` : "not planned"}</b><span>Fence analogue</span><b>${esc(materials || "awaiting materials")}</b><span>Gate</span><b>${enclosure?.complete && !enclosure.ruined ? "closed and containing" : "open or breached"}</b></div><div class="divider"></div><small class="muted">This remains an individually simulated prey organism. A completed standing enclosure constrains movement to its nine interior tiles, provisions conserved feed and water, blocks attacks and theft, and opens only when the structure is actually ruined.</small></div>`;
  return html;
};

const placeDevelopmentAgricultureBase = placeDevelopmentCard;
placeDevelopmentCard = function (place, interactive = true) {
  const html = placeDevelopmentAgricultureBase(place, interactive),
    kind = placeKindKey(place),
    fields = W.fields.filter((field) => field.placeKind === kind && field.placeId === place.id),
    herds = W.herds.filter(
      (herd) => herd.active && herd.placeKind === kind && herd.placeId === place.id,
    );
  if (!fields.length && !herds.length) return html;
  return `${html}<div class="subhead">Food production and living herds</div><div class="stack">${fields
    .map(
      (field) =>
        `<div class="card"><div class="row between"><b>🌾 ${esc(field.cropName)}</b><span class="tag ${field.stage === "ripe" ? "good" : ""}">${esc(titleCase(field.stage))}</span></div><small class="muted">Growth ${field.growth} · completed harvests ${field.cycles} · tile ${xy(field.tile).join(", ")}</small></div>`,
    )
    .join("")}${herds
    .map((herd) => {
      const enclosure = herdEnclosure(herd),
        security =
          enclosure?.complete && !enclosure.ruined
            ? `${pct(enclosureCondition(enclosure) * 100)} enclosure integrity`
            : enclosure?.ruined
              ? "enclosure breached"
              : enclosure
                ? `${pct(enclosure.progress * 100)} enclosure construction`
                : "no enclosure";
      return `<div class="card"><div class="row between"><b>🐑 Living herd ${herd.id}</b><span class="tag">${herd.animalIds.filter(classifyAlive).length} prey</span></div><small class="muted">${esc(herd.state)} · ${esc(security)} · pasture ${xy(herd.pastureTile).join(", ")} · herder ${esc(entityName(herd.herderId))}</small></div>`;
    })
    .join("")}</div>`;
};

function agricultureHerdingAudit() {
  const failures = [];
  const standingBuildings = (W.buildings || []).filter(
    (building) => !building.ruined || sum(Array.from(building.composition || [])) > 0,
  );
  for (let leftIndex = 0; leftIndex < standingBuildings.length; leftIndex++)
    for (let rightIndex = leftIndex + 1; rightIndex < standingBuildings.length; rightIndex++) {
      const left = standingBuildings[leftIndex],
        right = standingBuildings[rightIndex];
      if (
        spatialFootprintsOverlap(
          left.x,
          left.y,
          buildingSpatialRadius(left.type),
          right.x,
          right.y,
          buildingSpatialRadius(right.type),
        )
      )
        failures.push(`buildings ${left.id} and ${right.id} have overlapping footprints`);
    }
  for (const field of W.fields || []) {
    const building = W.buildings.find((candidate) => candidate.id === field.buildingId);
    if (!building || building.type !== "farm")
      failures.push(`field ${field.id} lacks a farm building`);
    if (!["fallow", "sown", "growing", "ripe"].includes(field.stage))
      failures.push(`field ${field.id} has invalid stage ${field.stage}`);
    if (field.causeEvent && !W.events.some((event) => event.id === field.causeEvent))
      failures.push(`field ${field.id} cites a missing event`);
    if (
      building &&
      (field.tile !== idx(building.x, building.y) ||
        (field.tiles || farmFootprintTiles(building)).length !== 9 ||
        !farmFootprintNaturallyDry(building.x, building.y) ||
        (field.tiles || farmFootprintTiles(building)).some(
          (tile) => W.tiles.liquid[tile] >= 700 || W.tiles.fire[tile] >= 200,
        ))
    )
      failures.push(`field ${field.id} is not a safe centered nine-tile farm footprint`);
  }
  for (const herd of W.herds.filter((candidate) => candidate.active)) {
    if (!classifyAlive(herd.herderId)) failures.push(`herd ${herd.id} lacks a living herder`);
    const enclosure = herdEnclosure(herd);
    if (!enclosure || enclosure.type !== "corral")
      failures.push(`herd ${herd.id} lacks a material enclosure plan`);
    for (const animal of herd.animalIds)
      if (W.kind[animal] !== KINDS.HERBIVORE || W.components.life[animal]?.herdId !== herd.id)
        failures.push(`herd ${herd.id} contains invalid prey ${animal}`);
  }
  return {
    failures,
    fields: W.fields.map((field) => ({
      id: field.id,
      tile: field.tile,
      stage: field.stage,
      growth: field.growth,
      cycles: field.cycles,
      causeEvent: field.causeEvent,
    })),
    herds: W.herds
      .filter((herd) => herd.active)
      .map((herd) => ({
        id: herd.id,
        members: herd.animalIds.filter(classifyAlive).length,
        state: herd.state,
        pastureTile: herd.pastureTile,
        enclosure: (() => {
          const building = herdEnclosure(herd);
          return building
            ? {
                buildingId: building.id,
                complete: building.complete,
                ruined: building.ruined,
                condition: enclosureCondition(building),
                materials: building.requirements.map(([species, amount]) => [species, amount]),
              }
            : null;
        })(),
        causeEvent: herd.causeEvent,
      })),
    predatorDefenses: W.events.filter((event) => event.type === "PredatorDefenseEvent").length,
    enclosureAttacks: W.events.filter((event) => event.type === "EnclosureAttackedEvent").length,
    preventedThefts: W.events.filter((event) => event.type === "HerdTheftPreventedEvent").length,
    fluidSplatters: W.fluidSplatters.length,
    matter: auditMatter(),
  };
}

function debugMoveTileMatterToStore(store, species, requested) {
  let needed = Math.min(requested, 65535 - (store[species] || 0));
  for (let tile = 0; tile < W.tileCount && needed > 0; tile++) {
    const amount = Math.min(needed, tileMatterAmount(tile, species));
    if (!amount) continue;
    setTileMatterAmount(tile, species, tileMatterAmount(tile, species) - amount);
    store[species] += amount;
    needed -= amount;
  }
  return requested - needed;
}

function debugCompletePhysicalBuilding(place, type) {
  let building = completedBuildings(place, type)[0];
  if (building) return building;
  building = W.buildings.find(
    (candidate) =>
      !candidate.ruined &&
      candidate.type === type &&
      candidate.placeKind === placeKindKey(place) &&
      candidate.placeId === place.id,
  );
  if (!building) building = planBuilding(place, type, 5);
  if (!building) return null;
  for (const [species, required] of building.requirements) {
    let needed = required;
    const stored = Math.min(needed, place.inventory?.[species] || 0);
    if (stored) {
      place.inventory[species] -= stored;
      building.composition[species] += stored;
      needed -= stored;
    }
    for (let tile = 0; tile < W.tileCount && needed > 0; tile++) {
      const amount = Math.min(needed, tileMatterAmount(tile, species));
      if (!amount) continue;
      setTileMatterAmount(tile, species, tileMatterAmount(tile, species) - amount);
      building.composition[species] += amount;
      needed -= amount;
    }
    if (needed) return null;
  }
  building.workDone = building.workRequired;
  refreshBuildingStage(building);
  return building.complete ? building : null;
}

function debugCompletePhysicalFarm(place) {
  return debugCompletePhysicalBuilding(place, "farm");
}

function debugAgricultureHerdingProbe() {
  initializeAgricultureHerding();
  const people = W.activeIds
      .filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id))
      .sort((left, right) => left - right),
    prey = W.activeIds
      .filter((id) => W.kind[id] === KINDS.HERBIVORE && classifyAlive(id))
      .sort((left, right) => left - right),
    predators = W.activeIds
      .filter((id) => W.kind[id] === KINDS.PREDATOR && classifyAlive(id))
      .sort((left, right) => left - right),
    place =
      W.settlements.find((candidate) => !candidate.ruined) ||
      W.camps.find((candidate) => candidate.active);
  if (people.length < 1 || prey.length < 2 || !predators.length || !place)
    return { ok: false, reason: "probe needs a place, a person, two prey, and a predator" };
  const beforeMatter = totalMatter(),
    worker = people[0],
    building = debugCompletePhysicalFarm(place);
  if (!building) return { ok: false, reason: "could not assemble a conserved farm building" };
  const farmTerrainDry = buildingTerrainFootprintValid("farm", building.x, building.y);
  for (const [species, amount] of [
    [C.ORGANIC, 18],
    [C.NUTRIENT, 18],
    [C.SOLVENT, 36],
  ])
    debugMoveTileMatterToStore(place.inventory, species, amount);
  const workerPosition = W.components.position[worker];
  workerPosition.x = building.x;
  workerPosition.y = building.y;
  workerPosition.regionId = regionId(building.x, building.y);
  const field = cultivatedField(building),
    sown = sowCultivatedField(worker, field, place);
  for (let cycle = 0; sown && cycle < 4 && field.stage !== "ripe"; cycle++) {
    W.tick += 64;
    updateCultivatedField(building, place, worker);
  }
  const cropVisual =
      field.stage === "ripe" && typeof cultivatedCropVisual === "function"
        ? cultivatedCropVisual(field, building)
        : null,
    alternateCropVisual = cropVisual
      ? cultivatedCropVisual(
          {
            ...field,
            cropChemistry: {
              ...field.cropChemistry,
              [C.PIGMENT]: (field.cropChemistry?.[C.PIGMENT] || 0) + 997,
              [C.CATALYST]: (field.cropChemistry?.[C.CATALYST] || 0) + 431,
            },
          },
          building,
        )
      : null,
    cropVisualVaries =
      !!cropVisual &&
      !!alternateCropVisual &&
      (cropVisual.form !== alternateCropVisual.form ||
        cropVisual.stemHue !== alternateCropVisual.stemHue ||
        cropVisual.bloomHue !== alternateCropVisual.bloomHue);
  if (cropVisual) drawBuildingSite(ctx, building, 0, projectionMetrics());
  const harvested = field.stage === "ripe" && harvestCultivatedField(worker, field, place);
  const localPrey = prey.slice(0, 4);
  for (let index = 0; index < localPrey.length; index++) {
    const position = W.components.position[localPrey[index]];
    position.x = clamp(place.x + (index % 2), 0, W.width - 1);
    position.y = clamp(place.y + Math.floor(index / 2), 0, W.height - 1);
    position.regionId = regionId(position.x, position.y);
  }
  const herd = formPreyHerd(worker, place, localPrey),
    enclosure = herd ? debugCompletePhysicalBuilding(place, "corral") : null,
    predator = predators[0],
    protectedAnimal = herd?.animalIds[0] || 0;
  if (herd && enclosure) {
    herd.enclosureBuildingId = enclosure.id;
    herd.pastureTile = idx(enclosure.x, enclosure.y);
    for (const animal of herd.animalIds) {
      const position = W.components.position[animal];
      position.x = enclosure.x;
      position.y = enclosure.y;
      position.regionId = regionId(position.x, position.y);
    }
    updateLivingHerds();
  }
  const animalPosition = protectedAnimal ? W.components.position[protectedAnimal] : null,
    predatorPosition = W.components.position[predator],
    radius = herd ? herdEnclosureRadius(herd) : 0,
    constrained =
      herd && enclosure && animalPosition
        ? constrainHerdMovement(
            protectedAnimal,
            clamp(enclosure.x + radius + 1, 0, W.width - 1),
            enclosure.y,
          )
        : null,
    containmentBlocked =
      !!animalPosition &&
      !!constrained &&
      constrained.x === animalPosition.x &&
      constrained.y === animalPosition.y;
  let damagedStandingContainment = false;
  if (herd && enclosure && animalPosition) {
    const priorIntegrity = enclosure.integrity;
    enclosure.integrity = 1;
    const damagedConstraint = constrainHerdMovement(
      protectedAnimal,
      clamp(enclosure.x + radius + 1, 0, W.width - 1),
      enclosure.y,
    );
    damagedStandingContainment =
      !enclosure.ruined &&
      damagedConstraint.x === animalPosition.x &&
      damagedConstraint.y === animalPosition.y;
    enclosure.integrity = priorIntegrity;
  }
  if (herd && enclosure && protectedAnimal) {
    workerPosition.x = clamp(enclosure.x + radius + 1, 0, W.width - 1);
    workerPosition.y = enclosure.y;
    predatorPosition.x = workerPosition.x;
    predatorPosition.y = workerPosition.y;
    workerPosition.regionId = regionId(workerPosition.x, workerPosition.y);
    predatorPosition.regionId = regionId(predatorPosition.x, predatorPosition.y);
    W.components.life[predator].lastAttackTick = W.tick - 10;
  }
  const thief = people.find((id) => id !== worker) || 0,
    herdCountBeforeTheft = herd?.animalIds.length || 0,
    theftEventCountBefore = W.events.filter(
      (event) => event.type === "HerdTheftPreventedEvent",
    ).length;
  if (thief && herd && enclosure) {
    const ownerFaction = place.factionId || 910001,
      thiefFaction = ownerFaction + 1,
      thiefPosition = W.components.position[thief],
      probeWar = { id: 910001, a: ownerFaction, b: thiefFaction, ended: false };
    place.factionId = ownerFaction;
    W.components.social[worker].factionId = ownerFaction;
    W.components.social[thief].factionId = thiefFaction;
    thiefPosition.x = clamp(enclosure.x + radius, 0, W.width - 1);
    thiefPosition.y = enclosure.y;
    thiefPosition.regionId = regionId(thiefPosition.x, thiefPosition.y);
    W.components.life[thief].lastHerdTheftTick = W.tick - 32;
    W.activeWars.push(probeWar);
    updateHerdTheftThreats();
    W.activeWars = W.activeWars.filter((war) => war !== probeWar);
  }
  const theftPrevented =
    !!herd &&
    herd.animalIds.length === herdCountBeforeTheft &&
    W.events.filter((event) => event.type === "HerdTheftPreventedEvent").length >
      theftEventCountBefore;
  rebuildSpatialBins();
  const protectedIntegrityBefore = W.components.life[protectedAnimal]?.integrity || 0,
    enclosureIntegrityBefore = enclosure?.integrity || 0,
    huntResult = herd ? performHunt(predator, [protectedAnimal]) : false,
    enclosureBlockedPredator =
      !!enclosure &&
      !huntResult &&
      enclosure.integrity < enclosureIntegrityBefore &&
      W.components.life[protectedAnimal]?.integrity === protectedIntegrityBefore,
    alliedDefenders = people.slice(0, 4);
  if (herd && enclosure && protectedAnimal) {
    const ownerFaction = place.factionId || 910001,
      offsets = [
        [0, 0],
        [1, 0],
        [0, 1],
        [-1, 0],
      ],
      predatorLife = W.components.life[predator];
    predatorLife.integrity = Math.max(predatorLife.integrity, 1000);
    W.components.body[predator].integrity = predatorLife.integrity;
    for (let index = 0; index < alliedDefenders.length; index++) {
      const defenderId = alliedDefenders[index],
        position = W.components.position[defenderId],
        [dx, dy] = offsets[index];
      W.components.social[defenderId].factionId = ownerFaction;
      W.components.life[defenderId].lastMilitaryAttackTick = W.tick - 99;
      W.components.life[defenderId].predatorDefenseCooldowns = {};
      position.x = clamp(predatorPosition.x + dx, 0, W.width - 1);
      position.y = clamp(predatorPosition.y + dy, 0, W.height - 1);
      position.regionId = regionId(position.x, position.y);
    }
    rebuildSpatialBins();
  }
  const defenseEventsBefore = W.events.length;
  if (herd) updatePredatorDefense();
  const coordinatedDefenseEvents = W.events
      .slice(defenseEventsBefore)
      .filter((event) => event.type === "PredatorDefenseEvent" && event.subjects[1] === predator),
    coordinatedDefenders = Array.from(
      new Set(coordinatedDefenseEvents.map((event) => event.subjects[0])),
    ),
    forcedDefense =
      herd && classifyAlive(predator)
        ? defendAgainstPredator(worker, predator, { targetId: protectedAnimal, herd }, true)
        : coordinatedDefenseEvents.length,
    defense = coordinatedDefenders.length,
    farmAccess =
      typeof farmLaborAccessTile === "function" ? farmLaborAccessTile(worker, building) : null;
  if (typeof reconcileBuildingOccupancy === "function") reconcileBuildingOccupancy();
  const farmFootprintClear = !W.activeIds.some((id) => {
      const position = W.components.position[id];
      return (
        classifyAlive(id) &&
        [KINDS.PERSON, KINDS.PREDATOR, KINDS.HERBIVORE].includes(W.kind[id]) &&
        position &&
        Math.max(Math.abs(position.x - building.x), Math.abs(position.y - building.y)) <= 1
      );
    }),
    corralContainsOnlyOwnedHerd =
      !herd ||
      !enclosure ||
      !W.activeIds.some((id) => {
        const position = W.components.position[id];
        if (
          !classifyAlive(id) ||
          !position ||
          Math.max(Math.abs(position.x - enclosure.x), Math.abs(position.y - enclosure.y)) > 1
        )
          return false;
        return !herd.animalIds.includes(id);
      }),
    farmPerimeterAccess =
      !!farmAccess &&
      Math.max(Math.abs(farmAccess.x - building.x), Math.abs(farmAccess.y - building.y)) === 2 &&
      (typeof movementTileBlocked !== "function" ||
        !movementTileBlocked(worker, farmAccess.x, farmAccess.y)),
    inventoryManifest = personInventoryPanel(worker).includes("All tools, weapons and armor"),
    eventTypes = W.events.slice(-40).map((event) => event.type),
    matterDelta = totalMatter() - beforeMatter;
  return {
    ok:
      !!sown &&
      !!harvested &&
      cropVisualVaries &&
      !!herd &&
      !!enclosure &&
      enclosure.complete &&
      containmentBlocked &&
      damagedStandingContainment &&
      enclosureBlockedPredator &&
      theftPrevented &&
      farmFootprintClear &&
      corralContainsOnlyOwnedHerd &&
      farmPerimeterAccess &&
      farmTerrainDry &&
      inventoryManifest &&
      herd.animalIds.length >= 2 &&
      defense >= 2 &&
      eventTypes.includes("CropSownEvent") &&
      eventTypes.includes("CropHarvestedEvent") &&
      eventTypes.includes("HerdFormedEvent") &&
      eventTypes.includes("HerdEnclosedEvent") &&
      eventTypes.includes("EnclosureAttackedEvent") &&
      eventTypes.includes("HerdTheftPreventedEvent") &&
      eventTypes.includes("PredatorDefenseEvent") &&
      W.fluidSplatters.length > 0 &&
      Math.abs(matterDelta) < 1e-8,
    field: {
      id: field.id,
      sown,
      harvested,
      stage: field.stage,
      cycles: field.cycles,
      visual: cropVisual
        ? {
            form: cropVisual.form,
            stemHue: cropVisual.stemHue,
            bloomHue: cropVisual.bloomHue,
            chemistryVaries: cropVisualVaries,
          }
        : null,
      collision: {
        footprintClear: farmFootprintClear,
        perimeterAccess: farmPerimeterAccess,
        allNineTilesDry: farmTerrainDry,
      },
    },
    herd: herd
      ? {
          id: herd.id,
          actualAnimalIds: herd.animalIds.slice(),
          state: herd.state,
          pastureTile: herd.pastureTile,
          enclosure: enclosure
            ? {
                buildingId: enclosure.id,
                complete: enclosure.complete,
                condition: enclosureCondition(enclosure),
                materials: enclosure.requirements.map(([species, amount]) => [species, amount]),
                containmentBlocked,
                damagedStandingContainment,
                predatorBlocked: enclosureBlockedPredator,
                theftBlocked: theftPrevented,
                ownedAnimalsOnly: corralContainsOnlyOwnedHerd,
              }
            : null,
        }
      : null,
    predatorDefense: {
      defenders: coordinatedDefenders,
      predator,
      protectedAnimal,
      result: defense,
      forcedResult: forcedDefense,
    },
    eventTypes,
    fluidSplatters: W.fluidSplatters.length,
    inventoryManifest,
    matterDelta,
  };
}

window.ALIFE_AGRICULTURE_DEBUG = Object.freeze({
  audit: agricultureHerdingAudit,
  probe: debugAgricultureHerdingProbe,
  field: (buildingId) =>
    cultivatedField(W.buildings.find((building) => building.id === buildingId)),
  herd: (id) => W.herds.find((herd) => herd.id === id) || null,
  formHerd: formPreyHerd,
  defend: (defenderId, predatorId, targetId) =>
    defendAgainstPredator(
      defenderId,
      predatorId,
      { targetId, herd: herdForAnimal(targetId) },
      true,
    ),
});
