// ═══════════════════════════════════════════════════════════════════════════
// 30e. SOCIETY — PRODUCTION: facilities, civic production, the settlement tick
// ═══════════════════════════════════════════════════════════════════════════
// Operating a facility, smelting, civic production, how many people a place
// holds, and the settlement update with its vitality and research layers.
// This section was one file of four thousand nine hundred lines, 30a-material-
// society.js, split in six along its own seams on 2026-09-14; the composed
// runtime is unchanged, and `scripts/who-overrides.cjs <name>` shows a
// function's layers across them.
function operateFacility(s, type, phase, material = -1) {
  const b = completedBuildings(s, type)[0];
  if (!b) return null;
  const workers = localPlaceWorkers(s)
      .filter(workerReadyForLabor)
      .sort((a, c) => {
        const wa = workState(a),
          wc = workState(c),
          assignedA = wa.facilityBuildingId === b.id && W.tick <= (wa.facilityUntil || 0) ? 0 : 1,
          assignedC = wc.facilityBuildingId === b.id && W.tick <= (wc.facilityUntil || 0) ? 0 : 1;
        if (assignedA !== assignedC) return assignedA - assignedC;
        const pa = W.components.position[a],
          pc = W.components.position[c];
        return dist2(pa.x, pa.y, b.x, b.y) - dist2(pc.x, pc.y, b.x, b.y) || a - c;
      }),
    id = workers[0];
  if (!id) return null;
  const p = W.components.position[id],
    site = idx(b.x, b.y),
    tool = toolForPurpose(id, "build"),
    work = workState(id);
  work.facilityBuildingId = b.id;
  work.facilityMaterialId = material;
  work.facilityPhase = phase;
  work.facilityUntil = W.tick + 160;
  if (dist2(p.x, p.y, b.x, b.y) > 2) {
    moveWorkerToward(
      id,
      site,
      "craft",
      `moving to operate ${b.name}`,
      material,
      b.id,
      tool?.entityId || 0,
    );
    return null;
  }
  setWorkAction(id, "craft", phase, site, material, b.id, tool?.entityId || 0);
  return { id, building: b };
}
// A town with ore lying by and a forge to reduce it in keeps the fuel that
// smelt will need. The hearth burned the stores down to two and the kiln to
// eight, so the woodpile never reached the eleven a smelt asks for, and a town
// that had learned to work metal never worked any: the lesser fires now burn
// only what stands above the smith's floor.
const SMELT_FUEL_FLOOR = 14;
function smeltingFuelFloor(s) {
  return s.knownProcesses?.includes("metalworking") &&
    (s.inventory[C.ORE] || 0) > 10 &&
    placeHasFacility(s, "forge")
    ? SMELT_FUEL_FLOOR
    : 0;
}
function updateCivicProduction() {
  for (const s of W.settlements) {
    if (s.ruined) continue;
    const inv = invSettlement(s),
      ti = idx(s.x, s.y),
      context = {
        location: ti,
        subjects: [s.entityId],
        factions: s.factionId ? [s.factionId] : [],
        causes: [s.importantEvents.at(-1) || 0],
        eventSink: s.importantEvents,
        recordEvent: W.tick % 128 === 0,
      };
    if (concertedIntensity() > 0 && W.tick % 32 === 0) {
      const [cx, cy] = xy(ti);
      let room = placeStorageRemaining(s),
        foodMoved = 0,
        waterMoved = 0;
      for (let y = Math.max(0, cy - 3); y <= Math.min(W.height - 1, cy + 3); y++)
        for (let x = Math.max(0, cx - 3); x <= Math.min(W.width - 1, cx + 3); x++) {
          const i = idx(x, y),
            food = takeTileMatter(
              i,
              C.ORGANIC,
              Math.min(4, Math.max(0, 24 - foodMoved), Math.max(0, room), 65535 - s.inventory[C.ORGANIC]),
            );
          if (food > 0) {
            s.inventory[C.ORGANIC] += food;
            foodMoved += food;
            room -= food;
          }
          const water = takeTileMatter(
            i,
            C.SOLVENT,
            Math.min(6, Math.max(0, 32 - waterMoved), Math.max(0, room), 65535 - s.inventory[C.SOLVENT]),
          );
          if (water > 0) {
            s.inventory[C.SOLVENT] += water;
            waterMoved += water;
            room -= water;
          }
        }
    }
    if (placeHasFacility(s, "hearth") && s.inventory[C.FUEL] > 2 + smeltingFuelFloor(s) && W.tick % 64 === 0) {
      const operator = operateFacility(s, "hearth", "tending a bounded combustion bed", C.FUEL);
      if (operator) {
        const room = placeStorageRemaining(s),
          oxidant = takeTileMatter(ti, C.OXIDANT, Math.min(3, room, 65535 - s.inventory[C.OXIDANT]));
        s.inventory[C.OXIDANT] += oxidant;
        s.productionTemperature = Math.max(s.productionTemperature || 20, 420);
        if (s.knownProcesses.includes("controlled_fire"))
          executeProcess("combustion", inv, 1, context);
      }
    }
    if (
      placeHasFacility(s, "farm") &&
      s.knownProcesses.includes("agriculture") &&
      W.tick % 64 === 0
    ) {
      const farm = completedBuildings(s, "farm")[0],
        operator = operateFacility(s, "farm", "cultivating producer beds", C.NUTRIENT);
      if (operator) updateCultivatedField(farm, s, operator);
    }
    if (s.knownProcesses.includes("metalworking") && s.researchInventory) {
      const wantOre = Math.min(
          s.researchInventory[C.ORE] || 0,
          Math.max(0, 14 - s.inventory[C.ORE]),
        ),
        wantFuel = Math.min(
          Math.max(0, (s.researchInventory[C.FUEL] || 0) - 10),
          Math.max(0, 14 - s.inventory[C.FUEL]),
        );
      s.researchInventory[C.ORE] -= wantOre;
      s.inventory[C.ORE] += wantOre;
      s.researchInventory[C.FUEL] -= wantFuel;
      s.inventory[C.FUEL] += wantFuel;
    }
    if (
      s.knownProcesses.includes("metalworking") &&
      s.inventory[C.ORE] > 10 &&
      s.inventory[C.FUEL] > 10 &&
      operateFacility(s, "forge", "reducing ore into a worked tool material", C.ORE)
    ) {
      s.productionTemperature = 760;
      executeProcess("smelting", inv, 2, context);
    }
    if (
      s.knownProcesses.includes("ceramics") &&
      s.inventory[C.MINERAL] > 10 &&
      s.inventory[C.FUEL] > 8 + smeltingFuelFloor(s) &&
      operateFacility(s, "kiln", "firing a rigid ceramic matrix", C.MINERAL)
    ) {
      s.productionTemperature = 560;
      executeProcess(
        "ceramic_firing",
        inv,
        concertedIntensity() ? 1 + concertedIntensity() : 1,
        context,
      );
    }
    if (
      s.knownProcesses.includes("drying") &&
      s.inventory[C.ORGANIC] > 20 &&
      s.inventory[C.CATALYST] > 0 &&
      operateFacility(s, "hearth", "drying and fermenting stored organic matter", C.ORGANIC)
    )
      executeProcess("fermentation", inv, 2, context);
    if (
      s.knownProcesses.includes("medicine") &&
      s.inventory[C.ORGANIC] > 8 &&
      s.inventory[C.NUTRIENT] > 8 &&
      s.inventory[C.CATALYST] > 0 &&
      operateFacility(s, "clinic", "synthesizing catalytic medicine", C.CATALYST)
    )
      executeProcess("medicine_synthesis", inv, 1, context);
    if (
      s.knownProcesses.includes("writing") &&
      s.inventory[C.INFO] > 2 &&
      s.inventory[C.ENERGY] > 2 &&
      s.inventory[C.NUTRIENT] > 2 &&
      operateFacility(s, "archive", "copying information polymers into the archive", C.INFO)
    )
      executeProcess("polymer_copying", inv, 1, context);
    if (
      s.knownProcesses.includes("irrigation") &&
      s.inventory[C.MINERAL] > 2 &&
      s.inventory[C.SOLVENT] > 4 &&
      operateFacility(
        s,
        placeHasFacility(s, "waterworks") ? "waterworks" : "workshop",
        "cutting and flushing solvent channels",
        C.SOLVENT,
      )
    )
      executeProcess("dissolution", inv, 1, context);
    if (
      s.knownProcesses.includes("storage") &&
      s.inventory[C.NUTRIENT] > 12 &&
      s.inventory[C.SOLVENT] > 2 &&
      W.tick % (eligibleResearchMaterialNeeds(s).some((x) => x.sp === C.CRYSTAL) ? 128 : 256) ===
        0 &&
      operateFacility(s, "stockpile", "crystallizing durable storage salts", C.NUTRIENT)
    )
      executeProcess("crystallization", inv, 1, context);
    if (s.inventory[C.METAL] > 12 && s.inventory[C.SOLVENT] > 20 && W.tick % 256 === 0)
      executeProcess("corrosion", inv, 1, context);
  }
}
// How many people the world insists on before it allows another place. Never
// fewer than the crowd that makes a town urban (84), or the world scatters
// itself into hamlets that can never become the cities the modern stage asks
// for. Read through a function so the gate is consulted at the time it matters
// rather than frozen at load.
function placePeoplePerTown() {
  const urban = typeof urbanGate === "function" ? urbanGate().local : 0;
  return Math.max(PLACE_PEOPLE_PER_TOWN, urban);
}
const PLACE_PEOPLE_PER_TOWN = 24,
  PLACE_PEOPLE_NEARBY = 16;
updateSettlements = function () {
  assignPartners();
  const candidates = [];
  for (const id of W.activeIds)
    if (W.kind[id] === KINDS.PERSON && classifyAlive(id)) {
      const p = W.components.position[id],
        ti = idx(p.x, p.y);
      W.tiles.habitation[ti] = u16(W.tiles.habitation[ti] + 12);
      if (W.tiles.habitation[ti] > 340 && !campNear(ti, 5) && !settlementNear(ti, 6))
        candidates.push({
          id,
          tile: ti,
          score:
            W.tiles.habitation[ti] +
            tileFood(ti, "omnivore") * 8 +
            tileMoisture(ti) * 5 -
            W.tiles.danger[ti],
        });
    }
  candidates.sort((a, b) => b.score - a.score || a.id - b.id);
  let livePlaceCount =
      W.settlements.filter((s) => !s.ruined).length + W.camps.filter((c) => c.active).length,
    // One place for every fourteen people, not six: a world that allowed a
    // camp per six settled into hamlets of six to twelve and never raised a
    // city; the pull of the city and the granary both want fewer, larger towns.
    //
    // Fourteen was still too many, and for a reason arithmetic makes plain: a
    // world that allows a place per fourteen people and spreads them evenly
    // holds towns of fourteen, and the modern stage wants cities of whatever
    // `urbanGate` calls urban — twenty-two on a small map. No town could ever
    // reach that, because the world founded another the moment it had the
    // people for one. Measured on causal-origin small: a hundred and thirty
    // people across six to eight towns and almost none above eighteen, press
    // after press. The divisor is now whichever is larger, so a world never
    // spreads itself thinner than the size it calls a city.
    //
    // Twenty-four now, the line a town must reach to send settlers (68). At
    // fourteen the people the fields floor of 127 added founded towns instead
    // of filling the ones that stood: four a farm alone made nine towns on
    // battery causal-origin and ten on phone by year sixty where there had
    // been five and six, each with its own cottages, at 1.7 times the tick.
    // At twenty-four the same people stay in the five and six, the city holds
    // sixty-seven and seventy-six where it held thirty-two and twenty-eight,
    // and the tick costs 1.4 and 1.3 times.
    placeCapacity = Math.max(4, Math.floor(biospherePopulation(KINDS.PERSON) / placePeoplePerTown()));
  for (const c of candidates.slice(0, 2)) {
    if (livePlaceCount >= placeCapacity) break;
    const [ccx, ccy] = xy(c.tile),
      nearPeople = entityAtRadius(c.tile, 22, KINDS.PERSON).filter(classifyAlive).length,
      nearPlaces = [
        ...W.camps.filter((q) => q.active),
        ...W.settlements.filter((q) => !q.ruined),
      ].filter((q) => dist2(q.x, q.y, ccx, ccy) <= 484).length;
    if (nearPlaces >= Math.max(1, Math.floor(nearPeople / PLACE_PEOPLE_NEARBY))) continue;
    const local = entityAtRadius(c.tile, 3, KINDS.PERSON).filter(classifyAlive),
      pioneer = nearPlaces === 0,
      needPeople = pioneer ? 3 : 4,
      needCohesion = pioneer ? 0.24 : 0.32,
      needMoisture = pioneer ? 18 : 22,
      needFood = pioneer ? 6 : 8;
    if (
      local.length >= needPeople &&
      socialCohesionAt(c.tile) > needCohesion &&
      tileMoisture(c.tile) > needMoisture &&
      tileFood(c.tile, "omnivore") > needFood
    ) {
      const camp = createCamp(c.tile, c.id, W.causalIndex.tile[c.tile] || 0);
      if (camp) livePlaceCount++;
    }
  }
  for (const c of W.camps) {
    if (!c.active) continue;
    const ti = idx(c.x, c.y),
      people = entityAtRadius(ti, 6, KINDS.PERSON).filter(classifyAlive);
    if (people.length) {
      c.lastOccupied = W.tick;
      c.stableTicks += 32;
    } else if (W.tick - c.lastOccupied > 256)
      c.structure.integrity = u16(c.structure.integrity - 2);
    ensurePlacePlans(c);
    recomputePlaceCapacity(c);
    if (
      c.stableTicks > 256 &&
      people.length >= 5 &&
      completedBuildings(c, "shelter").length &&
      completedBuildings(c, "stockpile").length &&
      completedBuildings(c, "hearth").length
    )
      createSettlement(c.id, W.lastEventByType.BuildingCompletedEvent || c.causeEvent);
    if (W.tick - c.lastOccupied > 1536 || c.structure.integrity < 5) {
      c.active = false;
      const abandoned = W.buildings.filter(
          (b) => b.placeKind === "camp" && b.placeId === c.id && !b.ruined,
        ),
        abandonment = emitEvent("CampAbandonedEvent", {
          subjects: [c.entityId],
          location: ti,
          causes: [W.causalIndex.tile[ti] || c.causeEvent || 0],
          evidence: [
            "workers departed after prolonged absence or structural decline",
            "unmaintained construction weathered into conserved ground material",
          ],
          importance: 2,
          data: { name: c.name },
        });
      for (const b of abandoned) {
        for (let sp = 0; sp < SPECIES_COUNT; sp++) {
          depositTileMatter(idx(b.x, b.y), sp, b.composition[sp]);
          b.composition[sp] = 0;
        }
        collapseBuilding(
          b,
          `${c.name} was abandoned and the unmaintained structure weathered`,
          abandonment.id,
        );
      }
      const abandonedIds = new Set(abandoned.map((b) => b.id));
      for (const id of W.activeIds)
        if (abandonedIds.has(W.components.work?.[id]?.buildingId)) clearStaleWork(id);
      for (let sp = 0; sp < SPECIES_COUNT; sp++) {
        depositTileMatter(ti, sp, c.inventory[sp]);
        c.inventory[sp] = 0;
      }
    }
  }
  for (const s of W.settlements) {
    if (s.ruined) continue;
    ensurePlacePlans(s);
    recomputePlaceCapacity(s);
    const ti = idx(s.x, s.y),
      people = entityAtRadius(ti, 8, KINDS.PERSON).filter(classifyAlive);
    for (const id of people) {
      // Enemy soldiers standing in the streets are invaders, not immigrants: they neither
      // adopt the town's allegiance nor draw its rations. (Without this, an attacking column
      // was absorbed by the settlement it reached and its muster rebuilt the army at home.)
      if (personIsHostileVisitor(id, s.factionId)) continue;
      if (s.factionId) W.components.social[id].factionId = s.factionId;
      if (s.cultureId && !W.components.social[id].cultureId)
        W.components.social[id].cultureId = s.cultureId;
      const digestive = W.components.inventory[id].digestive,
        body = W.components.chemistry[id].q,
        foodNeed = Math.max(0, 24 - digestive[C.ORGANIC]),
        drinkNeed = Math.max(0, 560 - body[C.SOLVENT]),
        food = Math.min(
          typeof rationCap === "function" ? rationCap(s) : 18,
          foodNeed,
          Math.max(
            0,
            s.inventory[C.ORGANIC] - (typeof seedReserve === "function" ? seedReserve(s) : 0),
          ),
          65535 - digestive[C.ORGANIC],
        ),
        drink = Math.min(36, drinkNeed, s.inventory[C.SOLVENT], 65535 - body[C.SOLVENT]);
      s.inventory[C.ORGANIC] -= food;
      digestive[C.ORGANIC] += food;
      s.inventory[C.SOLVENT] -= drink;
      body[C.SOLVENT] += drink;
    }
    for (const c of W.cohorts)
      if (
        c.kind === KINDS.PERSON &&
        c.count &&
        ((s.factionId && c.factionId === s.factionId) || c.regionId === regionId(s.x, s.y))
      ) {
        const food = Math.min(
            c.count,
            Math.max(
              0,
              s.inventory[C.ORGANIC] - (typeof seedReserve === "function" ? seedReserve(s) : 0),
            ),
          ),
          drink = Math.min(c.count, s.inventory[C.SOLVENT]);
        s.inventory[C.ORGANIC] -= food;
        c.chemistryTotals[C.ORGANIC] += food;
        s.inventory[C.SOLVENT] -= drink;
        c.chemistryTotals[C.SOLVENT] += drink;
      }
    if (!placeHasFacility(s, "stockpile"))
      executeProcess(
        "decomposition",
        invSettlement(s),
        Math.max(0, Math.floor(s.inventory[C.ORGANIC] / 150)),
      );
    const rawPop = settlementPopulation(s),
      needs =
        (settlementFood(s) < 8 ? -0.025 : 0.012) +
        (settlementWater(s) < 8 ? -0.025 : 0.008) +
        (s.housing < rawPop ? -0.018 : 0.01) -
        settlementDisease(s) * 0.0008;
    s.stability = clamp(s.stability + needs, 0, 1);
    if (rawPop < 1 && W.tick - s.foundedTick > 1024)
      ruinSettlement(
        s,
        W.causalIndex.tile[ti] || 0,
        "population dispersed from an unmaintained built settlement",
      );
  }
  updateCivicProduction();
};
const updateSettlementsVitalityBase = updateSettlements;
updateSettlements = function () {
  updateSettlementsVitalityBase();
  for (const s of W.settlements) {
    if (s.ruined) continue;
    rebalancePlaceStorage(s);
    const people = entityAtRadius(idx(s.x, s.y), 8, KINDS.PERSON).filter(classifyAlive);
    let requested = 0,
      served = 0;
    for (const id of people) {
      const digestive = W.components.inventory[id].digestive,
        body = W.components.chemistry[id].q,
        energyNeed = Math.max(0, 240 - body[C.ENERGY]),
        nutrientNeed = Math.max(0, 16 - digestive[C.NUTRIENT]),
        energy = Math.min(12, energyNeed, s.inventory[C.ENERGY], 65535 - body[C.ENERGY]),
        nutrient = Math.min(
          5,
          nutrientNeed,
          s.inventory[C.NUTRIENT],
          65535 - digestive[C.NUTRIENT],
        );
      requested += Math.min(12, energyNeed) + Math.min(5, nutrientNeed);
      served += energy + nutrient;
      s.inventory[C.ENERGY] -= energy;
      body[C.ENERGY] += energy;
      s.inventory[C.NUTRIENT] -= nutrient;
      digestive[C.NUTRIENT] += nutrient;
    }
    const coverage = requested ? served / requested : 1,
      health = people.length ? mean(people.map((id) => derivedLife(id).health)) : 0,
      homeostasis = people.length
        ? mean(
            people.map(
              (id) =>
                1 -
                clamp(
                  (derivedLife(id).hunger + derivedLife(id).thirst + derivedLife(id).fatigue) / 300,
                  0,
                  1,
                ),
            ),
          )
        : 0,
      continuity = clamp((health / 100) * 0.45 + homeostasis * 0.4 + coverage * 0.15, 0, 1);
    s.lastRationCoverage = coverage;
    if (people.length >= 4 && completedBuildings(s, "shelter").length)
      s.stability = Math.max(s.stability, 0.24 + continuity * 0.34);
  }
  return undefined;
};
const updateSettlementsResearchLaborBase = updateSettlements;
updateSettlements = function () {
  updateSettlementsResearchLaborBase();
  for (const s of W.settlements) {
    if (s.ruined) continue;
    const tech = techCatalog().find(
      (t) =>
        !s.knownProcesses.includes(t.id) &&
        (t.prior || []).every((id) => s.knownProcesses.includes(id)) &&
        (t.materials || []).every((sp) => hasResearchMaterial(s, sp)),
    );
    if (!tech) continue;
    const facility = facilityForTechnology(tech.id) || "workshop";
    if (placeHasFacility(s, facility))
      operateFacility(
        s,
        facility,
        `testing archived samples for ${tech.name}`,
        (tech.materials || [])[0] ?? -1,
      );
  }
  return undefined;
};
