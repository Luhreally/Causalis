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
  if (field) return field;
  const tile = idx(building.x, building.y);
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
  };
  W.fields.push(field);
  return field;
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
  const needed = [
    [C.ORGANIC, 6],
    [C.NUTRIENT, 5],
    [C.SOLVENT, 10],
  ];
  if (needed.some(([species, amount]) => (place.inventory[species] || 0) < amount)) return false;
  field.baseline = {
    organic: tileMatterAmount(field.tile, C.ORGANIC),
    energy: tileMatterAmount(field.tile, C.ENERGY),
  };
  const moved = transferPlaceMatterToTile(place, field.tile, needed),
    seedMass = Object.values(moved).reduce((total, amount) => total + amount, 0),
    ev = emitEvent("CropSownEvent", {
      subjects: [workerId, place.entityId].filter(Boolean),
      location: field.tile,
      factions: place.factionId ? [place.factionId] : [],
      causes: [field.causeEvent, place.importantEvents?.at(-1) || 0],
      evidence: [
        `${seedMass} conserved matter packets moved from storage into a bounded producer bed`,
        "soil order and a remembered planting location replaced random extraction",
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
  field.causeEvent = ev.id;
  W.tiles.plantOrder[field.tile] = u16(W.tiles.plantOrder[field.tile] + seedMass * 5);
  W.tiles.soilOrder[field.tile] = u16(W.tiles.soilOrder[field.tile] + seedMass * 2);
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
  if (W.tiles.fire[field.tile] > 90 || tileMoisture(field.tile) < 8) {
    const cause = W.events.findLast(
        (event) =>
          event.location === field.tile &&
          ["FireStartedEvent", "FireDisasterEvent", "DroughtEvent"].includes(event.type),
      )?.id,
      ev = emitEvent("CropFailedEvent", {
        subjects: [operatorId, place.entityId].filter(Boolean),
        location: field.tile,
        factions: place.factionId ? [place.factionId] : [],
        causes: [cause || field.causeEvent],
        evidence: [
          W.tiles.fire[field.tile] > 90
            ? `fire intensity ${W.tiles.fire[field.tile]} destroyed producer order`
            : `moisture ${tileMoisture(field.tile).toFixed(1)} fell below the crop threshold`,
          "remaining crop matter stayed in the tile substrate for decay or later recovery",
        ],
        magnitude: field.growth,
        importance: 2,
        data: { fieldId: field.id, crop: field.cropName, fire: W.tiles.fire[field.tile] },
      });
    field.stage = "fallow";
    field.growth = 0;
    field.causeEvent = ev.id;
    if (place.importantEvents) place.importantEvents.push(ev.id);
    return 0;
  }
  const solar = reactionById("photosynthesis")?.externalEnergyRequirement || W.laws.solarFlux,
    grew = executeProcess("photosynthesis", invTile(field.tile), 4, {
      externalEnergy: Math.max(solar, W.laws.solarFlux),
    });
  field.lastGrowthTick = W.tick;
  if (!grew) return 0;
  field.growth += grew;
  field.stage = "growing";
  W.tiles.plantOrder[field.tile] = u16(W.tiles.plantOrder[field.tile] + grew * 8);
  if (W.tick - field.sowTick >= 64 && field.growth >= 6) {
    field.stage = "ripe";
    field.matureTick = W.tick;
    const ev = emitEvent("FieldMaturedEvent", {
      subjects: [operatorId, place.entityId].filter(Boolean),
      location: field.tile,
      factions: place.factionId ? [place.factionId] : [],
      causes: [field.causeEvent],
      evidence: [
        `${field.growth} balanced photosynthesis extents accumulated after sowing`,
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
  const organic = transferTileCropToPlace(
      place,
      field.tile,
      C.ORGANIC,
      28,
      field.baseline.organic + 2,
    ),
    energy = transferTileCropToPlace(place, field.tile, C.ENERGY, 16, field.baseline.energy + 1),
    harvested = organic + energy;
  if (!harvested) return false;
  const ev = emitEvent("CropHarvestedEvent", {
    subjects: [workerId, place.entityId].filter(Boolean),
    location: field.tile,
    factions: place.factionId ? [place.factionId] : [],
    causes: [field.causeEvent],
    evidence: [
      `${harvested} crop matter moved from the field tile into ${place.name}'s finite storage`,
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
  W.tiles.plantOrder[field.tile] = u16(Math.max(0, W.tiles.plantOrder[field.tile] - harvested * 3));
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
  if (dist2(position.x, position.y, building.x, building.y) > 2)
    return moveWorkerToward(
      workerId,
      field.tile,
      field.stage === "ripe" ? "harvest" : field.stage === "fallow" ? "sow" : "tend",
      `${field.stage === "ripe" ? "🧺 moving to harvest" : field.stage === "fallow" ? "🌱 carrying seed matter to" : "🌾 tending"} ${building.name}`,
      C.ORGANIC,
      building.id,
    );
  if (field.stage === "fallow") return sowCultivatedField(workerId, field, place);
  if (field.stage === "ripe") return harvestCultivatedField(workerId, field, place);
  if (["sown", "growing"].includes(field.stage)) {
    const moved = transferPlaceMatterToTile(place, field.tile, [
      [C.SOLVENT, 2],
      [C.NUTRIENT, 1],
    ]);
    field.lastLaborTick = W.tick;
    W.tiles.soilOrder[field.tile] = u16(W.tiles.soilOrder[field.tile] + 3);
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
    if (
      W.tick - herd.lastMoveTick >= 96 ||
      tileFood(herd.pastureTile, "grazer") < herd.animalIds.length * 2
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
        herd.state = "grazing under watch";
        setWorkAction(
          herder,
          "herd",
          `🐑 watching ${herd.animalIds.length} grazers reproduce and feed`,
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
  const predatorLife = W.components.life[predatorId],
    previous = predatorLife.lastCommunityDefenseTick || -999;
  if (!forceHit && W.tick - previous < 8) return 0;
  predatorLife.lastCommunityDefenseTick = W.tick;
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
        "a person physically intercepted it instead of only increasing an abstract defense score",
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
    if (responses >= 3 || W.kind[predatorId] !== KINDS.PREDATOR || !classifyAlive(predatorId))
      continue;
    const protectedState = protectedPreyNearPredator(predatorId);
    if (!protectedState) continue;
    const predator = W.components.position[predatorId],
      preferred = protectedState.herd?.herderId || 0,
      defenders = [preferred, ...nearbyIds(predatorId, 7, (id) => W.kind[id] === KINDS.PERSON)]
        .filter(
          (id, index, list) =>
            id &&
            list.indexOf(id) === index &&
            classifyAlive(id) &&
            derivedLife(id).health > 24 &&
            embodiedCapability(id).locomotion > 0.2 &&
            embodiedCapability(id).manipulation > 0.15,
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
    defendAgainstPredator(defenders[0], predatorId, protectedState);
    responses++;
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
    herder = classifyAlive(herd.herderId) ? entityName(herd.herderId) : "no living herder";
  html += `<div class="subhead">Living herd state</div><div class="card"><div class="kv"><span>Herd</span><b>${herd.id} · ${esc(herd.state)}</b><span>Home community</span><b>${esc(place?.name || "dispersed")}</b><span>Herder</span><b>${esc(herder)}</b><span>Living herd members</span><b>${herd.animalIds.filter(classifyAlive).length}</b><span>Domestication</span><b>${pct((W.components.life[id].domestication || 0) * 100)}</b><span>Pasture tile</span><b>${xy(herd.pastureTile).join(", ")}</b></div><div class="divider"></div><small class="muted">This is still a normal prey organism: it feeds, flees, reproduces from parent matter, can be injured, and can be killed. Herding changes guidance and protection, not its physical identity.</small></div>`;
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
    .map(
      (herd) =>
        `<div class="card"><div class="row between"><b>🐑 Living herd ${herd.id}</b><span class="tag">${herd.animalIds.filter(classifyAlive).length} prey</span></div><small class="muted">${esc(herd.state)} · pasture ${xy(herd.pastureTile).join(", ")} · herder ${esc(entityName(herd.herderId))}</small></div>`,
    )
    .join("")}</div>`;
};

function agricultureHerdingAudit() {
  const failures = [];
  for (const field of W.fields || []) {
    const building = W.buildings.find((candidate) => candidate.id === field.buildingId);
    if (!building || building.type !== "farm")
      failures.push(`field ${field.id} lacks a farm building`);
    if (!["fallow", "sown", "growing", "ripe"].includes(field.stage))
      failures.push(`field ${field.id} has invalid stage ${field.stage}`);
    if (field.causeEvent && !W.events.some((event) => event.id === field.causeEvent))
      failures.push(`field ${field.id} cites a missing event`);
  }
  for (const herd of W.herds.filter((candidate) => candidate.active)) {
    if (!classifyAlive(herd.herderId)) failures.push(`herd ${herd.id} lacks a living herder`);
    for (const animal of herd.animalIds)
      if (W.kind[animal] !== KINDS.HERBIVORE || W.components.life[animal]?.herdId !== herd.id)
        failures.push(`herd ${herd.id} contains invalid prey ${animal}`);
  }
  return {
    failures,
    fields: W.fields.map((field) => ({
      id: field.id,
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
        causeEvent: herd.causeEvent,
      })),
    predatorDefenses: W.events.filter((event) => event.type === "PredatorDefenseEvent").length,
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

function debugCompletePhysicalFarm(place) {
  let building = completedBuildings(place, "farm")[0];
  if (building) return building;
  building = planBuilding(place, "farm", 5);
  if (!building) return null;
  for (const [species, required] of building.requirements) {
    let needed = required;
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
  const harvested = field.stage === "ripe" && harvestCultivatedField(worker, field, place);
  const localPrey = prey.slice(0, 4);
  for (let index = 0; index < localPrey.length; index++) {
    const position = W.components.position[localPrey[index]];
    position.x = clamp(place.x + (index % 2), 0, W.width - 1);
    position.y = clamp(place.y + Math.floor(index / 2), 0, W.height - 1);
    position.regionId = regionId(position.x, position.y);
  }
  const herd = formPreyHerd(worker, place, localPrey),
    predator = predators[0],
    protectedAnimal = herd?.animalIds[0] || 0;
  if (herd && protectedAnimal) {
    const animalPosition = W.components.position[protectedAnimal],
      predatorPosition = W.components.position[predator];
    workerPosition.x = animalPosition.x;
    workerPosition.y = animalPosition.y;
    predatorPosition.x = clamp(animalPosition.x + 1, 0, W.width - 1);
    predatorPosition.y = animalPosition.y;
    workerPosition.regionId = regionId(workerPosition.x, workerPosition.y);
    predatorPosition.regionId = regionId(predatorPosition.x, predatorPosition.y);
  }
  rebuildSpatialBins();
  const defense = herd
      ? defendAgainstPredator(worker, predator, { targetId: protectedAnimal, herd }, true)
      : 0,
    eventTypes = W.events.slice(-40).map((event) => event.type),
    matterDelta = totalMatter() - beforeMatter;
  return {
    ok:
      !!sown &&
      !!harvested &&
      !!herd &&
      herd.animalIds.length >= 2 &&
      !!defense &&
      eventTypes.includes("CropSownEvent") &&
      eventTypes.includes("CropHarvestedEvent") &&
      eventTypes.includes("HerdFormedEvent") &&
      eventTypes.includes("PredatorDefenseEvent") &&
      W.fluidSplatters.length > 0 &&
      Math.abs(matterDelta) < 1e-8,
    field: {
      id: field.id,
      sown,
      harvested,
      stage: field.stage,
      cycles: field.cycles,
    },
    herd: herd
      ? {
          id: herd.id,
          actualAnimalIds: herd.animalIds.slice(),
          state: herd.state,
          pastureTile: herd.pastureTile,
        }
      : null,
    predatorDefense: { defender: worker, predator, protectedAnimal, result: defense },
    eventTypes,
    fluidSplatters: W.fluidSplatters.length,
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
