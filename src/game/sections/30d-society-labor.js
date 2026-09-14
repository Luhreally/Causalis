// ═══════════════════════════════════════════════════════════════════════════
// 30d. SOCIETY — LABOUR: civil labour, maintenance, the labour tick, life
// ═══════════════════════════════════════════════════════════════════════════
// Civil labour and its layers, building maintenance, the cognition-and-labour
// tick that assigns hands, the metabolism, death and feeding hooks.
// This section was one file of four thousand nine hundred lines, 30a-material-
// society.js, split in six along its own seams on 2026-09-14; the composed
// runtime is unchanged, and `scripts/who-overrides.cjs <name>` shows a
// function's layers across them.
function performCivilLabor(id) {
  const l = derivedLife(id),
    p = W.components.position[id],
    ti = idx(p.x, p.y),
    w = workState(id);
  if (w.task === "craft" && w.craftPurpose) return beginOrAdvanceCraft(id, w.craftPurpose);
  if (
    l.hunger > 68 ||
    l.thirst > 70 ||
    l.fatigue > 88 ||
    W.tiles.fire[ti] > 100 ||
    W.tiles.danger[ti] > 850
  )
    return false;
  const place = nearestWorkPlace(id);
  if (!place) return false;
  ensurePlacePlans(place);
  const order = selectWorkOrder(id, place);
  if (!order) return performStockpileLabor(id, place);
  const b = W.buildings.find((x) => x.id === order.buildingId);
  if (!b) return false;
  if (order.type === "salvage") return performRuinSalvage(id, place, order, b);
  const missing = missingBuildingMaterial(b),
    inv = W.components.inventory[id].materials;
  if (missing) {
    const sp = missing.sp,
      purpose = toolPurposeForMaterial(sp),
      tool = toolForPurpose(id, purpose);
    if (
      !tool &&
      !functionalToolsAtPlace(place, purpose).length &&
      toolRecipeFromInventory(id, purpose)
    )
      return beginOrAdvanceCraft(id, purpose);
    if (inv[sp] > 0) {
      const site = idx(b.x, b.y);
      if (dist2(p.x, p.y, b.x, b.y) > 2)
        return moveWorkerToward(
          id,
          site,
          "haul",
          `hauling ${W.definitions.species[sp].name} to ${b.name}`,
          sp,
          b.id,
          tool?.entityId || 0,
        );
      const amount = Math.min(
        inv[sp],
        missing.needed,
        concertedIntensity() ? 32 : 8,
        65535 - b.composition[sp],
      );
      inv[sp] -= amount;
      b.composition[sp] += amount;
      W.civicMetrics.delivered += amount;
      refreshBuildingStage(b);
      setWorkAction(
        id,
        "haul",
        `placed ${amount} ${W.definitions.species[sp].name} at the ${b.name}`,
        site,
        sp,
        b.id,
        tool?.entityId || 0,
      );
      W.components.cognition[id].pendingReward += 96;
      return true;
    }
    if (
      STORE_DRAWN_MATERIALS.includes(sp) &&
      (CIVIC_BUILDING_TYPES.has(b.type) || !civicBuildingWants(place, sp, b))
    ) {
      const reserve = Math.max(
          0,
          researchMaterialReserve(place, sp) - (place.researchInventory?.[sp] || 0),
        ),
        borrowable =
          CIVIC_BUILDING_TYPES.has(b.type) && !researchFocusNeeds(place, sp)
            ? place.researchInventory?.[sp] || 0
            : 0,
        stocked = (place.inventory[sp] || 0) - reserve,
        available = Math.min(stocked + borrowable, missing.needed, 8);
      if (available > 0) {
        // Borrow from the research samples only what the stores cannot give.
        const borrowed = Math.max(0, available - Math.max(0, stocked));
        if (borrowed > 0) {
          place.researchInventory[sp] -= borrowed;
          place.inventory[sp] = (place.inventory[sp] || 0) + borrowed;
        }
        const store = idx(place.x, place.y);
        if (dist2(p.x, p.y, place.x, place.y) > 4)
          return moveWorkerToward(
            id,
            store,
            "haul",
            `fetching ${W.definitions.species[sp].name} from the stores of ${place.name}`,
            sp,
            b.id,
            tool?.entityId || 0,
          );
        place.inventory[sp] -= available;
        inv[sp] += available;
        setWorkAction(
          id,
          "haul",
          `drew ${available} ${W.definitions.species[sp].name} from the stores for the ${b.name}`,
          store,
          sp,
          b.id,
          tool?.entityId || 0,
        );
        W.components.cognition[id].pendingReward += 48;
        return true;
      }
    }
    const source = findResourceTile(id, sp),
      toolId = tool?.entityId || 0;
    if (source < 0) return performStockpileLabor(id, place);
    if (ti !== source)
      return moveWorkerToward(
        id,
        source,
        purpose === "cut" ? "cut" : "mine",
        `travelling to a ${W.definitions.species[sp].name} source`,
        sp,
        b.id,
        toolId,
      );
    const got = extractForWork(id, source, sp);
    if (got) {
      setWorkAction(
        id,
        purpose === "cut" ? "cut" : "mine",
        `${tool ? `using ${tool.name}` : "working loose material by hand"} for ${b.name}`,
        source,
        sp,
        b.id,
        toolId,
      );
      return true;
    }
    return false;
  }
  const buildTool = toolForPurpose(id, "build");
  if (
    !buildTool &&
    !functionalToolsAtPlace(place, "build").length &&
    toolRecipeFromInventory(id, "build")
  )
    return beginOrAdvanceCraft(id, "build");
  const site = idx(b.x, b.y);
  if (dist2(p.x, p.y, b.x, b.y) > 2)
    return moveWorkerToward(
      id,
      site,
      "build",
      `moving to the ${b.name} work face`,
      -1,
      b.id,
      buildTool?.entityId || 0,
    );
  const effort =
    (3 +
      (buildTool ? Math.max(1, Math.floor(buildTool.quality / 24)) : 0) +
      Math.floor((W.components.cognition[id]?.state?.[4] || 0) / 700)) *
    // Engines and electricity quicken the work face (87).
    (typeof constructionTempoFactor === "function" ? constructionTempoFactor(place) : 1) *
    (concertedIntensity() ? 4 + 2 * concertedIntensity() : 1);
  b.workDone = Math.min(b.workRequired, b.workDone + effort);
  if (buildTool) {
    buildTool.tool.wear = Math.min(buildTool.tool.durability, buildTool.tool.wear + 1);
    buildTool.damage = Math.floor(
      (buildTool.tool.wear / buildTool.tool.durability) * buildTool.structure.integrity,
    );
  }
  W.civicMetrics.constructionWork += effort;
  refreshBuildingStage(b);
  setWorkAction(
    id,
    "build",
    `${b.stage < 3 ? "setting foundation" : b.stage < 4 ? "raising the frame" : b.stage < 5 ? "placing wall courses" : b.stage < 6 ? "closing the roof" : "finishing the structure"} of ${b.name}`,
    site,
    -1,
    b.id,
    buildTool?.entityId || 0,
  );
  W.components.cognition[id].pendingReward += 128;
  return true;
}
const performCivilLaborSafetyBase = performCivilLabor;
performCivilLabor = function (id) {
  const l = derivedLife(id),
    p = W.components.position[id],
    ti = idx(p.x, p.y);
  if (
    l.hunger > 68 ||
    l.thirst > 70 ||
    l.fatigue > 88 ||
    W.tiles.fire[ti] > 100 ||
    W.tiles.danger[ti] > 850
  ) {
    clearStaleWork(id);
    return false;
  }
  const place = nearestWorkPlace(id),
    w = workState(id);
  let handled = false;
  if (w.task === "craft" && w.craftPurpose) handled = performCivilLaborSafetyBase(id);
  if (!handled && place) handled = performPlaceToolmaking(id, place);
  if (
    !handled &&
    place?.knownProcesses &&
    eligibleResearchMaterialNeeds(place).length &&
    localPlaceWorkers(place).indexOf(id) % 4 === 0
  )
    handled = performStockpileLabor(id, place);
  if (!handled) handled = performCivilLaborSafetyBase(id);
  if (handled) {
    l.fatigue = clamp(l.fatigue + 0.16, 0, 100);
    if (/^(travelling|moving to|seeking)/.test(w.phase)) {
      w.travelTask = w.task;
      w.task = "travel";
    } else if (w.materialId >= 0 && ["mine", "gather", "cut"].includes(w.task))
      w.task = toolPurposeForMaterial(w.materialId);
  }
  return handled;
};
function placeNeedsLabor(place) {
  if (!place) return false;
  if (activeBuildings(place).length) return true;
  if (placeStorageRemaining(place) <= 0) return false;
  if (eligibleResearchMaterialNeeds(place).length) return true;
  return essentialStockTargets(place).some(([sp, target]) => (place.inventory[sp] || 0) < target);
}
function damagedPlaceBuildings(place) {
  return completedBuildings(place)
    .filter((b) => b.integrity < b.maxIntegrity)
    .sort((a, b) => a.integrity / a.maxIntegrity - b.integrity / b.maxIntegrity || a.id - b.id);
}
function performBuildingMaintenance(id, place) {
  const b = damagedPlaceBuildings(place)[0];
  if (!b) return false;
  const workers = localPlaceWorkers(place)
    .filter((pid) => {
      const l = derivedLife(pid);
      return l.hunger < 70 && l.thirst < 72 && l.fatigue < 90;
    })
    .sort((a, c) => {
      const pa = W.components.position[a],
        pc = W.components.position[c];
      return dist2(pa.x, pa.y, b.x, b.y) - dist2(pc.x, pc.y, b.x, b.y) || a - c;
    });
  if (workers[0] !== id) return false;
  const p = W.components.position[id],
    site = idx(b.x, b.y),
    tool = toolForPurpose(id, "build");
  if (dist2(p.x, p.y, b.x, b.y) > 2)
    return moveWorkerToward(
      id,
      site,
      "build",
      `moving to repair fire and impact damage on ${b.name}`,
      -1,
      b.id,
      tool?.entityId || 0,
    );
  const before = b.integrity,
    repair = 3 + (tool ? Math.max(1, Math.floor(tool.quality / 24)) : 0);
  b.integrity = Math.min(b.maxIntegrity, b.integrity + repair);
  if (tool) tool.tool.wear = Math.min(tool.tool.durability, tool.tool.wear + 1);
  recomputePlaceCapacity(place);
  setWorkAction(
    id,
    "build",
    `re-seating damaged courses and sealing ${b.name}`,
    site,
    -1,
    b.id,
    tool?.entityId || 0,
  );
  W.components.cognition[id].pendingReward += 72;
  if (before < b.maxIntegrity && b.integrity >= b.maxIntegrity) {
    const repairEvent = emitEvent("BuildingRepairedEvent", {
      subjects: [place.entityId, id].filter(Boolean),
      location: site,
      factions: [place.factionId].filter(Boolean),
      causes: [b.lastDamage?.causeEvent || place.importantEvents?.at(-1) || 0],
      evidence: [
        `${entityName(id)} completed measured repair labor on ${b.name}`,
        "existing conserved structural material was re-seated and sealed",
        `integrity recovered from ${before} to ${b.integrity}`,
      ],
      magnitude: b.integrity - before,
      importance: b.type === "wall" ? 2 : 1,
      data: { buildingId: b.id, name: b.name, place: place.name },
    });
    b.lastRepair = { tick: W.tick, causeEvent: repairEvent.id, workerId: id };
    place.importantEvents?.push(repairEvent.id);
  }
  return true;
}
const placeNeedsLaborMaintenanceBase = placeNeedsLabor;
placeNeedsLabor = function (place) {
  return (
    !!place && (damagedPlaceBuildings(place).length > 0 || placeNeedsLaborMaintenanceBase(place))
  );
};
const performCivilLaborMaintenanceBase = performCivilLabor;
performCivilLabor = function (id) {
  const place = nearestWorkPlace(id),
    l = derivedLife(id),
    p = W.components.position[id],
    ti = p ? idx(p.x, p.y) : -1;
  if (
    place &&
    l.hunger <= 70 &&
    l.thirst <= 72 &&
    l.fatigue <= 90 &&
    ti >= 0 &&
    W.tiles.fire[ti] <= 100 &&
    performBuildingMaintenance(id, place)
  )
    return true;
  return performCivilLaborMaintenanceBase(id);
};
const performCivilLaborHomeostasisBase = performCivilLabor;
performCivilLabor = function (id) {
  if (!workerReadyForLabor(id)) {
    clearStaleWork(id);
    return false;
  }
  return performCivilLaborHomeostasisBase(id);
};
const directionScoreCognitionBase = directionScore;
directionScore = function (id, dx, dy, goal) {
  return directionScoreCognitionBase(id, dx, dy, goal);
};
const chooseBehaviorCognitionBase = chooseBehavior;
chooseBehavior = function (id, tier) {
  const w = W.components.work?.[id],
    l = W.components.life[id],
    conscript = W.kind[id] === KINDS.PERSON && !!W.components.campaign?.[id],
    unsafe = W.kind[id] === KINDS.PERSON && !workerReadyForLabor(id),
    urgent = unsafe || conscript || l?.hunger > 55 || l?.thirst > 58 || l?.fatigue > 62;
  if (
    w?.handledTick === W.tick ||
    (w &&
      w.task !== "idle" &&
      W.tick - (Number.isFinite(w.handledTick) ? w.handledTick : -Infinity) <= 4 &&
      !unsafe &&
      !conscript)
  )
    return;
  if (tier === "detailed" && !urgent && W.tick % 2 !== id % 2) return;
  return chooseBehaviorCognitionBase(id, tier);
};
function clearStaleWork(id) {
  const w = W.components.work?.[id];
  if (!w || w.task === "idle") return;
  Object.assign(w, {
    task: "idle",
    phase: "",
    targetTile: -1,
    buildingId: 0,
    materialId: -1,
    toolId: 0,
    progress: 0,
    craftPurpose: "",
    recipe: null,
    facilityBuildingId: 0,
    facilityUntil: 0,
  });
}
function facilityAssignment(id) {
  const w = W.components.work?.[id];
  if (!w?.facilityBuildingId || W.tick > (w.facilityUntil || 0)) return null;
  const building = W.buildings.find(
    (candidate) =>
      candidate.id === w.facilityBuildingId &&
      candidate.complete &&
      !candidate.ruined &&
      candidate.integrity > 0,
  );
  if (!building) {
    w.facilityBuildingId = 0;
    w.facilityUntil = 0;
    return null;
  }
  return building;
}
function updateCognitionAndLabor() {
  initializeSocietyState(W);
  const ids = W.activeIds.slice().sort((a, b) => a - b),
    essential = new Set(),
    places = [...W.camps.filter((c) => c.active), ...W.settlements.filter((s) => !s.ruined)],
    coordinatedLabor = concertedIntensity() > 0;
  for (const place of places) {
    if (!placeNeedsLabor(place)) continue;
    const healthy = localPlaceWorkers(place)
        .filter((id) => {
          const l = derivedLife(id),
            p = W.components.position[id],
            ti = idx(p.x, p.y);
          return (
            l.hunger <= 68 &&
            l.thirst <= 70 &&
            l.fatigue <= 88 &&
            W.tiles.fire[ti] <= 100 &&
            W.tiles.danger[ti] <= 850
          );
        })
        .sort((a, b) => derivedLife(a).fatigue - derivedLife(b).fatigue || a - b),
      projects = activeBuildings(place).length,
      research = eligibleResearchMaterialNeeds(place).length,
      slots = Math.min(
        healthy.length,
        concertedIntensity()
          ? healthy.length
          : Math.max(2, Math.ceil(healthy.length * (projects ? 0.55 : research ? 0.4 : 0.3))),
      );
    for (const id of healthy.slice(0, slots)) essential.add(id);
  }
  for (const id of ids) {
    if (
      ![KINDS.HERBIVORE, KINDS.PREDATOR, KINDS.PERSON].includes(W.kind[id]) ||
      !classifyAlive(id) ||
      (W.tick % 4 !== id % 4 && !(coordinatedLabor && W.kind[id] === KINDS.PERSON))
    )
      continue;
    const thinkCadence = W.kind[id] === KINDS.PERSON ? 4 : 8,
      c = W.tick % thinkCadence === id % thinkCadence ? advanceLTC(id) : initCognition(id);
    if (W.kind[id] !== KINDS.PERSON) continue;
    // Fighters under marching orders belong to the column, not to the labor pool;
    // nor do travellers under a fresh civil order (caravans, settlers, exiles,
    // migrants), who would otherwise be called back to the workshop at every
    // labour tick and reach the road's end a year late.
    const marching = W.components.campaign?.[id];
    if (
      marching &&
      (marching.role === "attack" ||
        (marching.warId === 0 && W.tick - (marching.issuedTick || 0) <= 1500))
    )
      continue;
    const w = workState(id),
      facility = facilityAssignment(id),
      place = nearestWorkPlace(id),
      continuing = w.task !== "idle" && W.tick - w.handledTick <= 8,
      hasWork = placeNeedsLabor(place),
      workDrive = cognitionBias(id, "work") + cognitionBias(id, "shelter") * 0.35,
      networkChoosesWork = c.dominant === "work" || c.dominant === "shelter" || workDrive > -12,
      // Hungry hands go to a lean town's fields whatever their mind is set on (86).
      assigned =
        essential.has(id) ||
        (typeof hungryHandsWanted === "function" && hungryHandsWanted(id, place));
    if (facility) {
      if (!workerReadyForLabor(id)) {
        clearStaleWork(id);
        continue;
      }
      const p = W.components.position[id],
        site = idx(facility.x, facility.y);
      if (dist2(p.x, p.y, facility.x, facility.y) > 2)
        moveWorkerToward(
          id,
          site,
          "operate",
          `moving to operate ${facility.name}`,
          w.facilityMaterialId ?? -1,
          facility.id,
          w.toolId || 0,
        );
      else
        setWorkAction(
          id,
          "operate",
          w.facilityPhase || `waiting to operate ${facility.name}`,
          site,
          w.facilityMaterialId ?? -1,
          facility.id,
          w.toolId || 0,
        );
      continue;
    }
    if ((continuing || (hasWork && (assigned || networkChoosesWork))) && performCivilLabor(id)) {
      w.handledTick = W.tick;
      const action = w.task === "gather" ? "gather" : "work",
        n = LTC_ACTIONS.indexOf(action);
      if (n >= 0) c.lastAction = n;
      if (!continuing && (assigned || networkChoosesWork)) {
        c.influenceCount++;
        c.lastInfluenceTick = W.tick;
        c.lastInfluence = `idle→${w.task}`;
      }
    } else if (!continuing || W.tick - w.handledTick > 8) clearStaleWork(id);
  }
  for (const a of W.artifacts)
    if (a.tool && a.ownerId) {
      const p = W.components.position[a.ownerId];
      if (p) {
        a.lastTile = idx(p.x, p.y);
        W.components.position[a.entityId] = { x: p.x, y: p.y, layer: 0, regionId: p.regionId };
      }
    }
}
const updateCognitionHomeBase = updateCognitionAndLabor;
updateCognitionAndLabor = function () {
  updateCognitionHomeBase();
  if (W.tick % 32) return;
  for (const camp of W.camps.filter((c) => c.active)) {
    const members = W.activeIds.filter(
      (id) =>
        W.kind[id] === KINDS.PERSON &&
        classifyAlive(id) &&
        W.components.social[id]?.homePlaceKind === "camp" &&
        W.components.social[id].homePlaceId === camp.id,
    );
    if (
      camp.stableTicks > 256 &&
      members.length >= 5 &&
      completedBuildings(camp, "shelter").length &&
      completedBuildings(camp, "stockpile").length &&
      completedBuildings(camp, "hearth").length
    )
      createSettlement(camp.id, W.lastEventByType.BuildingCompletedEvent || camp.causeEvent);
  }
};
const runMetabolismSocietyBase = runMetabolism;
runMetabolism = function (id, tier) {
  return runMetabolismSocietyBase(id, tier);
};
function prepareSexualPropagule(id) {
  if (!classifyAlive(id)) return 0;
  const life = W.components.life[id],
    body = W.components.body[id],
    rep = W.components.reproduction[id],
    q = W.components.chemistry[id].q,
    digestive = W.components.inventory[id].digestive;
  if (rep.mode !== "paired" || life.age <= (body.maturityAge ?? 1200)) return 0;
  const assimilated = Math.min(6, digestive[C.ORGANIC], Math.max(0, 68 - q[C.ORGANIC]));
  if (assimilated) {
    digestive[C.ORGANIC] -= assimilated;
    q[C.ORGANIC] += assimilated;
  }
  if (rep.cooldown > 480 || q[C.ENERGY] < 115 || q[C.NUTRIENT] < 18 || q[C.ORGANIC] < 36)
    return assimilated;
  let made = assimilated;
  if (q[C.INFO] < 18)
    made += executeProcess("polymer_copying", invEntity(id), Math.min(2, 18 - q[C.INFO]));
  if (q[C.MEMBRANE] < 26 && q[C.ORGANIC] > 35)
    made += executeProcess("healing", invEntity(id), Math.min(2, 26 - q[C.MEMBRANE]));
  if (made) {
    life.behaviorReason =
      "prepared a conserved sexual propagule from food, energy, and hereditary polymer";
    W.components.genome[id].dirty = true;
  }
  return made;
}
const runMetabolismViabilityBase = runMetabolism;
runMetabolism = function (id, tier) {
  const result = runMetabolismViabilityBase(id, tier);
  if (W.tick % 16 === id % 16) prepareSexualPropagule(id);
  return result;
};
const runMetabolismEmergencyRationBase = runMetabolism;
runMetabolism = function (id, tier) {
  if (W.kind[id] === KINDS.PERSON) {
    const q = W.components.chemistry[id].q,
      inv = W.components.inventory[id].digestive,
      p = W.components.position[id],
      ti = idx(p.x, p.y),
      place = nearestFriendlyPlace(id);
    if (q[C.ENERGY] < 18) {
      if (inv[C.ORGANIC] < 4 && place && dist2(p.x, p.y, place.x, place.y) <= 12 * 12) {
        const take = Math.min(8, place.inventory[C.ORGANIC], 65535 - inv[C.ORGANIC]);
        place.inventory[C.ORGANIC] -= take;
        inv[C.ORGANIC] += take;
      }
      if (inv[C.ORGANIC] < 4) performFeeding(id, ti);
      const assimilated = Math.min(8, inv[C.ORGANIC], 65535 - q[C.ORGANIC]);
      inv[C.ORGANIC] -= assimilated;
      q[C.ORGANIC] += assimilated;
      if (assimilated)
        executeProcess("digestion", invEntity(id), Math.max(1, Math.floor(assimilated / 2)));
    }
    if (q[C.SOLVENT] < 18) {
      if (place && dist2(p.x, p.y, place.x, place.y) <= 12 * 12) {
        const take = Math.min(18, place.inventory[C.SOLVENT], 65535 - q[C.SOLVENT]);
        place.inventory[C.SOLVENT] -= take;
        q[C.SOLVENT] += take;
      }
      if (q[C.SOLVENT] < 18) performDrinking(id, ti);
    }
  }
  return runMetabolismEmergencyRationBase(id, tier);
};
const updateArtificialLifeSocietyBase = updateArtificialLife;
updateArtificialLife = function () {
  updateCognitionAndLabor();
  updateArtificialLifeSocietyBase();
};
function groundOwnedArtifacts(ownerId, position = null, artifactIds = null) {
  const p = position || W.components.position[ownerId],
    ids = (artifactIds || W.components.inventory[ownerId]?.artifactIds || [])
      .slice()
      .sort((a, b) => a - b),
    tile = p ? idx(p.x, p.y) : -1;
  for (const eid of ids) {
    const a = W.artifacts.find((x) => x.entityId === eid);
    if (!a || a.ownerId !== ownerId) continue;
    a.ownerId = 0;
    a.lastTile = tile;
    if (p) W.components.position[eid] = { x: p.x, y: p.y, layer: 0, regionId: p.regionId };
    removeRelation(ownerId, eid, "owns");
  }
  const carried = W.components.inventory[ownerId]?.artifactIds;
  if (carried)
    W.components.inventory[ownerId].artifactIds = carried.filter((eid) => !ids.includes(eid));
  return ids.length;
}
const killEntityArtifactBase = killEntity;
killEntity = function (id, cause = "regulatory collapse", causeEvent = 0, erase = false) {
  const kind = W.kind[id],
    alive = !!kind && kind !== KINDS.CORPSE;
  if (alive) {
    const ident = W.components.identity[id];
    if (ident) ident.lifeKind = kind;
    groundOwnedArtifacts(id);
  }
  const result = killEntityArtifactBase(id, cause, causeEvent, erase);
  if (alive) {
    const ident = W.components.identity[id],
      ev = ident?.deathEventId ? W.events.find((e) => e.id === ident.deathEventId) : null;
    if (ev) ev.data = { ...(ev.data || {}), lifeKind: kind };
  }
  return result;
};
const aggregateIntoCohortSocietyBase = aggregateIntoCohort;
aggregateIntoCohort = function (id, reason = "density cap") {
  const w = W.components.work?.[id];
  if (w && w.task !== "idle" && W.tick - w.handledTick <= 12) return false;
  const p = W.components.position[id] ? { ...W.components.position[id] } : null,
    artifactIds = (W.components.inventory[id]?.artifactIds || []).slice(),
    aggregated = aggregateIntoCohortSocietyBase(id, reason);
  if (aggregated) groundOwnedArtifacts(id, p, artifactIds);
  return aggregated;
};

function placeHasFacility(place, type) {
  return completedBuildings(place, type).length > 0;
}
function personIsHostileVisitor(id, factionId) {
  const social = W.components.social[id];
  if (!social || !factionId || social.factionId === factionId) return false;
  if (W.components.campaign?.[id]) return true;
  if (
    social.unitId &&
    (W.militaryUnits || []).some(
      (unit) => unit.active && unit.id === social.unitId && unit.factionId !== factionId,
    )
  )
    return true;
  return (W.activeWars || []).some(
    (war) =>
      !war.ended &&
      ((war.a === factionId && war.b === social.factionId) ||
        (war.b === factionId && war.a === social.factionId)),
  );
}
const performFeedingSocietyBase = performFeeding;
performFeeding = function (id, tile, stride = 1) {
  if (performFeedingSocietyBase(id, tile, stride)) return true;
  if (W.kind[id] !== KINDS.PERSON) return false;
  const place = nearestFriendlyPlace(id),
    p = W.components.position[id];
  if (!place || dist2(p.x, p.y, place.x, place.y) > 8 * 8) return false;
  const digestive = W.components.inventory[id].digestive;
  let moved = 0;
  for (const [sp, limit] of [
    [C.ORGANIC, 18],
    [C.ENERGY, 10],
    [C.NUTRIENT, 8],
    [C.CATALYST, 2],
  ]) {
    const amount = Math.min(limit * stride, place.inventory[sp] || 0, 65535 - digestive[sp]);
    place.inventory[sp] -= amount;
    digestive[sp] += amount;
    moved += amount;
  }
  if (moved) {
    W.components.life[id].behaviorReason = `ate conserved rations from ${place.name}`;
    return true;
  }
  return false;
};
const performDrinkingSocietyBase = performDrinking;
performDrinking = function (id, tile, stride = 1) {
  if (performDrinkingSocietyBase(id, tile, stride)) return true;
  if (W.kind[id] !== KINDS.PERSON) return false;
  const place = nearestFriendlyPlace(id),
    p = W.components.position[id],
    body = W.components.chemistry[id].q;
  if (!place || dist2(p.x, p.y, place.x, place.y) > 8 * 8 || !place.inventory[C.SOLVENT])
    return false;
  const amount = Math.min(42 * stride, place.inventory[C.SOLVENT], 65535 - body[C.SOLVENT]);
  place.inventory[C.SOLVENT] -= amount;
  body[C.SOLVENT] += amount;
  if (amount) W.components.life[id].behaviorReason = `drank conserved solvent from ${place.name}`;
  return amount > 0;
};
