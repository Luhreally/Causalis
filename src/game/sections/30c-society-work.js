// ═══════════════════════════════════════════════════════════════════════════
// 30c. SOCIETY — WORK: tools, work state, resources, orders and stores
// ═══════════════════════════════════════════════════════════════════════════
// Personal tools and their recipes, a worker's task state and movement to a
// site, extraction, ruin salvage, work orders and their priority, the rare
// inputs drawn from stores, storage and its floors, research samples, and the
// stockpile and gathering labour.
// This section was one file of four thousand nine hundred lines, 30a-material-
// society.js, split in six along its own seams on 2026-09-14; the composed
// runtime is unchanged, and `scripts/who-overrides.cjs <name>` shows a
// function's layers across them.
function isFunctionalTool(a, purpose = null) {
  return (
    !!a?.tool &&
    a.tool.wear < a.tool.durability &&
    (!purpose || a.tool.capabilities.includes(purpose))
  );
}
function groundedToolTile(a) {
  if (Number.isInteger(a?.lastTile) && a.lastTile >= 0) return a.lastTile;
  const p = W.components.position[a?.entityId];
  return p ? idx(p.x, p.y) : -1;
}
function claimGroundTool(id, purpose) {
  const p = W.components.position[id],
    inv = W.components.inventory[id];
  if (!p || !inv) return null;
  const candidates = W.artifacts
    .filter((a) => !a.ownerId && isFunctionalTool(a, purpose))
    .map((a) => ({ a, tile: groundedToolTile(a) }))
    .filter((x) => x.tile >= 0 && dist2(p.x, p.y, ...xy(x.tile)) <= 6 * 6)
    .sort(
      (a, b) =>
        dist2(p.x, p.y, ...xy(a.tile)) - dist2(p.x, p.y, ...xy(b.tile)) ||
        b.a.quality - a.a.quality ||
        a.a.id - b.a.id,
    );
  const found = candidates[0]?.a;
  if (!found) return null;
  found.ownerId = id;
  found.lastTile = idx(p.x, p.y);
  W.components.position[found.entityId] = { x: p.x, y: p.y, layer: 0, regionId: p.regionId };
  if (!inv.artifactIds.includes(found.entityId)) inv.artifactIds.push(found.entityId);
  addRelation(id, found.entityId, "owns", 1, found.eventIds?.at(-1) || 0);
  return found;
}
function toolForPurpose(id, purpose) {
  const ids = W.components.inventory[id]?.artifactIds || [],
    tools = ids
      .map((eid) => W.artifacts.find((a) => a.entityId === eid))
      .filter((a) => isFunctionalTool(a, purpose));
  tools.sort((a, b) => b.quality - a.quality || a.id - b.id);
  return tools[0] || claimGroundTool(id, purpose);
}
function toolRecipeFromInventory(id, purpose) {
  if (purpose === "gather") return null;
  const inv = W.components.inventory[id].materials,
    candidates = [C.METAL, C.CRYSTAL, C.CERAMIC, C.MINERAL, C.ORE, C.BONE, C.ORGANIC]
      .filter((sp) => (sp === C.ORGANIC ? purpose === "war" && inv[sp] >= 4 : inv[sp] >= 2))
      .map((sp) => {
        const m = materialTrait(sp);
        return {
          sp,
          score:
            m.hardness * 2.2 +
            (1 - m.brittleness) +
            (purpose === "cut"
              ? (1 - m.density) * 0.4
              : purpose === "war"
                ? m.hardness * 0.8 + (1 - m.brittleness) * 0.4
                : m.density * 0.35),
        };
      })
      .sort((a, b) => b.score - a.score || a.sp - b.sp),
    binding = [C.FIBER, C.ORGANIC, C.MEMBRANE].filter((sp) => inv[sp] >= 2).sort((a, b) => b - a);
  if (!candidates.length || !binding.length) return null;
  return { head: candidates[0].sp, binding: binding[0], purpose };
}
function toolPurposeForMaterial(sp) {
  return sp === C.ORGANIC || sp === C.FIBER || sp === C.FUEL
    ? "cut"
    : sp === C.SOLVENT || sp === C.NUTRIENT || sp === C.ENERGY
      ? "gather"
      : "mine";
}
function createPersonalTool(id, recipe) {
  const inv = W.components.inventory[id]?.materials;
  if (!inv) return null;
  // A tool's head and its binding can be the same compound, and then it costs
  // four units of that compound, not two. The guard asked for two twice over
  // the one slot and the withdrawal took two twice, so a crafter holding two or
  // three wrapped their own store and made 65,536 units of matter out of
  // nothing. Caught on a battery world at tick 448, two tools in one tick:
  // entity materials rose by 65,516 while every other ledger moved by tens.
  const same = recipe.head === recipe.binding;
  if (
    inv[recipe.head] < (same ? 4 : 2) ||
    (!same && inv[recipe.binding] < 2) ||
    toolForPurpose(id, recipe.purpose)
  )
    return null;
  inv[recipe.head] -= 2;
  inv[recipe.binding] -= 2;
  const headMat = materialTrait(recipe.head),
    bindingMat = materialTrait(recipe.binding),
    eid = allocEntity(KINDS.ARTIFACT),
    q = new Uint16Array(SPECIES_COUNT),
    p = W.components.position[id],
    lastTile = idx(p.x, p.y),
    work = workState(id),
    home = nearestFriendlyPlace(id),
    placeKind = work.toolOrderPlaceKind || placeKindKey(home),
    placeId = work.toolOrderPlaceId || home?.id || 0;
  // Accumulate: a recipe whose head and binding are the same compound must hold all four
  // units it consumed, or two units of matter vanish with every such tool.
  q[recipe.head] += 2;
  q[recipe.binding] += 2;
  const warTier = recipe.purpose === "war" ? warToolTier(id) : 0,
    form =
      recipe.purpose === "war"
        ? warTier === 3
          ? "burst caster"
          : warTier === 2
            ? "tension caster"
            : "war edge"
        : recipe.purpose === "cut"
          ? "cutter"
          : recipe.purpose === "mine"
            ? "impact pick"
            : recipe.purpose === "gather"
              ? "collection scoop"
              : "building maul",
    name = `${W.definitions.species[recipe.head].name} ${form}`,
    quality = Math.round(
      clamp(
        28 + headMat.hardness * 48 + (1 - headMat.brittleness) * 18 + (1 - bindingMat.density) * 8,
        20,
        98,
      ),
    ),
    capabilities =
      recipe.purpose === "war"
        ? warTier === 3
          ? ["war", "ranged", "powder"]
          : warTier === 2
            ? ["war", "ranged"]
            : ["war", "cut"]
        : recipe.purpose === "build"
          ? ["build"]
          : recipe.purpose === "mine"
            ? ["mine", "build"]
            : recipe.purpose === "gather"
              ? ["gather"]
              : ["cut", "build"],
    a = {
      id: W.artifacts.length + 1,
      entityId: eid,
      name,
      creatorId: id,
      materialId: recipe.head,
      composition: q,
      structure: {
        patternId: recipe.head === C.METAL ? 11 : recipe.head === C.CRYSTAL ? 2 : 12,
        order: 620 + quality * 3,
        integrity: 700 + quality * 3,
      },
      quality,
      creationTick: W.tick,
      ownerId: id,
      lastTile,
      placeKind,
      placeId,
      settlementId: placeId,
      eventIds: [],
      damage: 0,
      culturalMeaning: 0,
      tool: {
        form,
        purpose: recipe.purpose,
        capabilities,
        edgeHardness: +headMat.hardness.toFixed(3),
        impact: +((headMat.hardness + headMat.density) * (1 - headMat.brittleness * 0.5)).toFixed(
          3,
        ),
        durability: 160 + quality * 5,
        wear: 0,
      },
    };
  W.artifacts.push(a);
  W.components.position[eid] = { x: p.x, y: p.y, layer: 0, regionId: p.regionId };
  W.components.identity[eid] = {
    generatedName: name,
    significance: 3,
    notable: false,
    titles: [titleCase(form)],
  };
  W.components.chemistry[eid] = {
    q,
    temperature: 20,
    storedFreeEnergy: 0,
    structuralOrder: a.structure.order,
    phaseFractions: { solid: 100, liquid: 0, gas: 0 },
  };
  W.components.inventory[id].artifactIds.push(eid);
  W.components.identity[id].artifacts.push(eid);
  W.civicMetrics.toolsCrafted++;
  const ev = emitEvent("ToolCraftedEvent", {
    subjects: [id, eid],
    location: lastTile,
    causes: [W.causalIndex.entity[id] || 0],
    evidence: [
      `${W.definitions.species[recipe.head].name} supplied the working head`,
      `${W.definitions.species[recipe.binding].name} bound a handle`,
      `the tool is functional for ${a.tool.capabilities.join(" and ")}`,
    ],
    importance: 2,
    data: { name, purpose: recipe.purpose, quality },
  });
  a.eventIds.push(ev.id);
  addRelation(id, eid, "created", 1, ev.id);
  addRelation(id, eid, "owns", 1, ev.id);
  return a;
}
const createPersonalToolUniqueBase = createPersonalTool;
createPersonalTool = function (id, recipe) {
  const work = workState(id),
    home = nearestFriendlyPlace(id),
    kind = work.toolOrderPlaceKind || placeKindKey(home),
    placeId = work.toolOrderPlaceId || home?.id || 0,
    place =
      kind === "camp"
        ? W.camps.find((x) => x.id === placeId && x.active)
        : W.settlements.find((x) => x.id === placeId && !x.ruined);
  if (
    place &&
    !["war", "armor", "shield"].includes(recipe.purpose) &&
    functionalToolsAtPlace(place, recipe.purpose).length
  )
    return null;
  return createPersonalToolUniqueBase(id, recipe);
};
function workState(id) {
  const store = W.components.work || (W.components.work = {});
  return (
    store[id] ||
    (store[id] = {
      task: "idle",
      phase: "",
      targetTile: -1,
      buildingId: 0,
      materialId: -1,
      toolId: 0,
      progress: 0,
      actionStartTick: W.tick,
      actionSerial: 0,
      handledTick: -1,
      lastSuccess: 0,
    })
  );
}
function laborPredatorThreat(id, radius = 7) {
  const position = W.components.position[id];
  if (!position) return 0;
  return nearbyIds(id, radius, (other) => {
    if (W.kind[other] !== KINDS.PREDATOR || !classifyAlive(other)) return false;
    const predator = W.components.position[other],
      preyTargetId = W.components.life[other]?.preyTargetId || 0,
      distance = predator ? dist2(position.x, position.y, predator.x, predator.y) : Infinity;
    return distance <= 2 || preyTargetId === id;
  }).length;
}
function workerReadyForLabor(id) {
  const l = derivedLife(id),
    q = W.components.chemistry[id]?.q,
    p = W.components.position[id];
  if (!l || !q || !p) return false;
  const tile = idx(p.x, p.y),
    locomotion = typeof embodiedCapability === "function" ? embodiedCapability(id).locomotion : 1;
  return (
    l.hunger <= 68 &&
    l.thirst <= 70 &&
    l.fatigue <= 88 &&
    l.health >= 42 &&
    (l.pain || 0) < 76 &&
    q[C.ENERGY] >= 125 &&
    locomotion >= 0.12 &&
    W.tiles.fire[tile] <= 100 &&
    W.tiles.danger[tile] <= 850 &&
    !personNeedsWaterEscape(id) &&
    !laborPredatorThreat(id)
  );
}
function setWorkAction(
  id,
  task,
  phase,
  targetTile = -1,
  materialId = -1,
  buildingId = 0,
  toolId = 0,
) {
  const w = workState(id);
  if (w.task !== task || w.phase !== phase || w.targetTile !== targetTile) {
    w.actionStartTick = W.tick;
    w.actionSerial++;
  }
  Object.assign(w, {
    task,
    phase,
    targetTile,
    materialId,
    buildingId,
    toolId,
    handledTick: W.tick,
  });
  const l = W.components.life[id];
  l.behavior = task;
  l.behaviorReason = phase;
  return w;
}
function resourceAmountAt(tile, sp) {
  return tileMatterAmount(tile, sp);
}
function workResourceAmount(tile, sp) {
  const direct = resourceAmountAt(tile, sp);
  return sp === C.FIBER ? direct + resourceAmountAt(tile, C.ORGANIC) : direct;
}
function findResourceTile(id, sp, radius = 9) {
  const p = W.components.position[id],
    w = workState(id),
    known = w.resourceTiles || (w.resourceTiles = {}),
    cached = w.resourceSpecies === sp ? w.resourceTile : (known[sp] ?? -1);
  // A search that found nothing is not repeated every tick; the tile window changes slowly.
  if (cached < 0 && (w.resourceRetry?.[sp] || 0) > W.tick) return -1;
  if (
    cached >= 0 &&
    workResourceAmount(cached, sp) >= 2 &&
    W.tiles.liquid[cached] <= 900 &&
    W.tiles.fire[cached] <= 350 &&
    dist2(p.x, p.y, ...xy(cached)) <= (radius + 8) * (radius + 8)
  )
    return cached;
  const remembered = W.components.memory[id].discoveredResources || [],
    candidates = [];
  for (let y = Math.max(0, p.y - radius); y <= Math.min(W.height - 1, p.y + radius); y++)
    for (let x = Math.max(0, p.x - radius); x <= Math.min(W.width - 1, p.x + radius); x++) {
      const i = idx(x, y),
        amount = workResourceAmount(i, sp);
      if (amount < 2 || W.tiles.liquid[i] > 900 || W.tiles.fire[i] > 350) continue;
      let affinity = 0;
      const feature = W.tiles.featureType?.[i] || 0;
      if (
        (sp === C.ORGANIC || sp === C.FIBER || sp === C.FUEL) &&
        (feature === TERRAIN_FEATURE.CANOPY || feature === TERRAIN_FEATURE.AQUATIC)
      )
        affinity = 90;
      if (
        (sp === C.MINERAL || sp === C.ORE || sp === C.CRYSTAL || sp === C.CATALYST) &&
        (feature === TERRAIN_FEATURE.DEPOSIT ||
          feature === TERRAIN_FEATURE.CAVERN ||
          feature === TERRAIN_FEATURE.HIGHLAND)
      )
        affinity = 100;
      candidates.push({
        i,
        score: Math.log2(amount + 1) * 12 + affinity - Math.sqrt(dist2(x, y, p.x, p.y)) * 5,
      });
    }
  // Habitat stress is the expensive term; rank cheaply first and only weigh it for the
  // shortlist, which keeps this search from dominating the tick at village populations.
  candidates.sort((a, b) => b.score - a.score || a.i - b.i);
  if (candidates.length > 12) candidates.length = 12;
  for (const candidate of candidates) candidate.score -= organismHabitatStress(id, candidate.i);
  candidates.sort((a, b) => b.score - a.score || a.i - b.i);
  const best = candidates[0]?.i ?? -1;
  w.resourceTile = best;
  w.resourceSpecies = best >= 0 ? sp : -1;
  known[sp] = best;
  if (best < 0) (w.resourceRetry || (w.resourceRetry = {}))[sp] = W.tick + 12;
  if (best >= 0 && !remembered.includes(best)) {
    remembered.push(best);
    if (remembered.length > 24) remembered.shift();
  }
  return best;
}
function moveWorkerToward(id, tile, task, phase, material = -1, buildingId = 0, toolId = 0) {
  const p = W.components.position[id],
    w = workState(id),
    currentTile = idx(p.x, p.y),
    [tx, ty] = xy(tile),
    options = DIRS.slice(0, 8)
      .map((d, n) => {
        const x = p.x + d[0],
          y = p.y + d[1];
        if (!inside(x, y)) return { d, score: -1e9, n };
        if (typeof movementTileBlocked === "function" && movementTileBlocked(id, x, y))
          return { d, score: -1e9, n };
        const i = idx(x, y);
        return {
          d,
          n,
          score:
            -Math.sqrt(dist2(x, y, tx, ty)) * 12 -
            organismHabitatStress(id, i) * 2 -
            W.tiles.fire[i] / 3 -
            W.tiles.danger[i] / 25,
        };
      })
      .sort((a, b) => b.score - a.score || a.n - b.n),
    best = options[0],
    d = best?.d || [0, 0],
    nx = clamp(p.x + d[0], 0, W.width - 1),
    ny = clamp(p.y + d[1], 0, W.height - 1);
  if (
    w.travelTargetTile === tile &&
    w.travelLastTile === currentTile &&
    W.tick > (w.travelAttemptTick ?? -1)
  )
    w.travelStuckTicks = (w.travelStuckTicks || 0) + Math.max(1, W.tick - w.travelAttemptTick);
  else w.travelStuckTicks = 0;
  w.travelTargetTile = tile;
  w.travelLastTile = currentTile;
  w.travelAttemptTick = W.tick;
  if (!best || best.score <= -1e8 || w.travelStuckTicks >= 32) {
    w.blockedTargetTile = tile;
    w.blockedUntil = W.tick + 64;
    w.resourceTile = -1;
    w.resourceSpecies = -1;
    w.resourceTiles = {};
    setWorkAction(
      id,
      task,
      `route blocked; abandoning and replanning ${phase}`,
      tile,
      material,
      buildingId,
      toolId,
    );
    return false;
  }
  if (w.blockedTargetTile === tile && W.tick < (w.blockedUntil || 0)) return false;
  if (d[0] || d[1]) queueEffect("MoveEntity", { entityId: id, x: nx, y: ny }, id);
  setWorkAction(id, task, phase, tile, material, buildingId, toolId);
  return true;
}
function extractForWork(id, tile, sp) {
  let available = resourceAmountAt(tile, sp);
  const purpose = toolPurposeForMaterial(sp),
    tool = toolForPurpose(id, purpose),
    mat = materialTrait(sp),
    bare = sp === C.ORGANIC || sp === C.SOLVENT || sp === C.NUTRIENT ? 2 : 1,
    bonus = tool ? Math.max(1, Math.floor(tool.quality / (14 + mat.hardness * 8))) : 0,
    coordinated = settledPace(),
    limit = (bare + bonus) * (coordinated ? 1 + coordinated : 1);
  if (sp === C.FIBER && available < 1 && resourceAmountAt(tile, C.ORGANIC) > 0) {
    executeProcess(
      "fiber_curing",
      invTile(tile),
      Math.min(limit, resourceAmountAt(tile, C.ORGANIC)),
    );
    available = resourceAmountAt(tile, sp);
  }
  if (available < 1) return 0;
  const amount = Math.min(available, limit, 65535 - W.components.inventory[id].materials[sp]);
  if (!amount) return 0;
  setTileMatterAmount(tile, sp, available - amount);
  W.components.inventory[id].materials[sp] += amount;
  if (sp === C.ORGANIC || sp === C.FIBER || sp === C.FUEL)
    W.tiles.plantOrder[tile] = u16(W.tiles.plantOrder[tile] - amount * 2);
  if (W.tiles.featureStrength?.[tile])
    W.tiles.featureStrength[tile] = u16(W.tiles.featureStrength[tile] - amount);
  if (tool) {
    tool.tool.wear = Math.min(
      tool.tool.durability,
      tool.tool.wear + Math.max(1, Math.ceil(mat.hardness * 2)),
    );
    tool.damage = Math.floor((tool.tool.wear / tool.tool.durability) * tool.structure.integrity);
  }
  W.civicMetrics.gathered += amount;
  W.components.cognition[id].pendingReward += 96;
  if (workResourceAmount(tile, sp) < 2) {
    const w = workState(id);
    w.resourceTile = -1;
    w.resourceSpecies = -1;
    if (w.resourceTiles) delete w.resourceTiles[sp];
  }
  return amount;
}
function nearestWorkPlace(id) {
  const place = nearestFriendlyPlace(id);
  if (!place) return null;
  const p = W.components.position[id];
  return dist2(p.x, p.y, place.x, place.y) <= 28 * 28 ? place : null;
}
function ruinRubble(b) {
  return b?.ruined ? sum(Array.from(b.composition || [])) : 0;
}
function queueRuinSalvage(place) {
  if (!place) return null;
  const kind = place.knownProcesses ? "settlement" : "camp",
    ruin = (W.buildings || [])
      .filter(
        (b) =>
          ruinRubble(b) > 0 &&
          dist2(b.x, b.y, place.x, place.y) <= 196 &&
          !W.workOrders.some(
            (o) => o.status === "open" && o.type === "salvage" && o.buildingId === b.id,
          ),
      )
      .sort(
        (left, right) =>
          dist2(left.x, left.y, place.x, place.y) - dist2(right.x, right.y, place.x, place.y) ||
          left.id - right.id,
      )[0];
  if (!ruin) return null;
  const order = {
    id: W.nextWorkOrderId++,
    type: "salvage",
    buildingId: ruin.id,
    placeKind: kind,
    placeId: place.id,
    priority: 4,
    status: "open",
    createdTick: W.tick,
    claimedBy: 0,
  };
  W.workOrders.push(order);
  return order;
}
function completeRuinSalvage(place, ruin, order) {
  if (order) order.status = "done";
  emitEvent("RuinsClearedEvent", {
    subjects: [place?.entityId].filter(Boolean),
    location: idx(ruin.x, ruin.y),
    factions: [place?.factionId].filter(Boolean),
    causes: [W.lastEventByType.SettlementDestroyedEvent || 0].filter(Boolean),
    evidence: [
      `the collapsed ${ruin.name} was pulled down and its material carried into the stockpile`,
      "the ground it stood on is open for building again",
    ],
    importance: 2,
    data: { type: ruin.type, placeId: place?.id || 0 },
  });
}
function performRuinSalvage(id, place, order, ruin) {
  if (!ruin || !ruin.ruined) {
    if (order) order.status = "done";
    return false;
  }
  if (ruinRubble(ruin) <= 0) {
    completeRuinSalvage(place, ruin, order);
    return false;
  }
  const p = W.components.position[id];
  if (dist2(p.x, p.y, ruin.x, ruin.y) > 2)
    return moveWorkerToward(
      id,
      idx(ruin.x, ruin.y),
      "salvage",
      `going to pull down the ruined ${ruin.name}`,
      -1,
      ruin.id,
      0,
    );
  const inv = W.components.inventory[id].materials,
    budget = settledPace() ? 32 : 8;
  let moved = 0,
    lastSpecies = -1;
  for (let sp = 0; sp < ruin.composition.length && moved < budget; sp++) {
    const take = Math.min(ruin.composition[sp], budget - moved, 65535 - inv[sp]);
    if (take <= 0) continue;
    ruin.composition[sp] -= take;
    inv[sp] += take;
    moved += take;
    lastSpecies = sp;
  }
  if (!moved) {
    completeRuinSalvage(place, ruin, order);
    return false;
  }
  refreshBuildingStage(ruin);
  W.civicMetrics.salvaged = (W.civicMetrics.salvaged || 0) + moved;
  setWorkAction(
    id,
    "salvage",
    `salvaged ${moved} ${W.definitions.species[lastSpecies].name} from the ruined ${ruin.name}`,
    idx(ruin.x, ruin.y),
    lastSpecies,
    ruin.id,
    0,
  );
  W.components.cognition[id].pendingReward += 72;
  if (ruinRubble(ruin) <= 0) completeRuinSalvage(place, ruin, order);
  return true;
}
function orderPriority(order, place, id) {
  const b = buildingById(order.buildingId);
  if (!b) return -1e9;
  if (order.type === "salvage") {
    if (ruinRubble(b) <= 0) return -1e9;
    const q = W.components.position[id];
    return 70 + order.priority * 18 - Math.sqrt(dist2(q.x, q.y, b.x, b.y)) * 2 - b.id * 0.0001;
  }
  if (b.complete || b.ruined) return -1e9;
  const p = W.components.position[id],
    def = BUILDING_DEFS[b.type],
    policy = place.management?.priorities?.[def.priority] || 2,
    foundingNeed =
      !place.knownProcesses && ["stockpile", "shelter", "hearth"].includes(b.type) ? 96 : 0;
  return (
    foundingNeed +
    order.priority * 18 +
    policy * 12 -
    Math.sqrt(dist2(p.x, p.y, b.x, b.y)) * 2 -
    b.id * 0.0001
  );
}
// The rare inputs a prospector or a caravan brings home: builders fetch these
// from the town stores instead of hoping to find them on the ground nearby.
const STORE_DRAWN_MATERIALS = [C.PIGMENT, C.INFO, C.ORE, C.CRYSTAL],
  // The buildings that open the way to letters, law, and metal come first when
  // a rare material is short, and may borrow research samples the town is not
  // studying with right now.
  CIVIC_BUILDING_TYPES = new Set(["archive", "hall", "forge"]);
function civicBuildingWants(place, sp, except) {
  return activeBuildings(place).some(
    (o) =>
      o !== except &&
      CIVIC_BUILDING_TYPES.has(o.type) &&
      (o.requirements || []).some(([s, n]) => s === sp && n - (o.composition?.[s] || 0) > 0),
  );
}
function researchFocusNeeds(place, sp) {
  const focus = place?.researchFocus ? technologyDefinition(place.researchFocus) : null;
  return !!focus && (focus.materials || []).includes(sp);
}
function missingBuildingMaterial(b) {
  const missing = b.requirements
    .map(([sp, n]) => ({
      sp,
      needed: Math.max(0, n - (b.composition[sp] || 0)),
      ratio: (b.composition[sp] || 0) / n,
    }))
    .filter((x) => x.needed > 0)
    .sort((a, b) => a.ratio - b.ratio || b.needed - a.needed || a.sp - b.sp);
  return missing[0] || null;
}
function beginOrAdvanceCraft(id, purpose) {
  const w = workState(id);
  if (w.task !== "craft" || w.craftPurpose !== purpose) {
    const recipe = toolRecipeFromInventory(id, purpose);
    if (!recipe) return false;
    w.task = "craft";
    w.craftPurpose = purpose;
    w.recipe = recipe;
    w.progress = 0;
    w.actionStartTick = W.tick;
    w.actionSerial++;
  }
  w.progress += 4;
  w.handledTick = W.tick;
  setWorkAction(
    id,
    "craft",
    `shaping a ${w.craftPurpose} tool from ${W.definitions.species[w.recipe.head].name}`,
    idx(W.components.position[id].x, W.components.position[id].y),
    w.recipe.head,
    0,
    0,
  );
  if (w.progress >= 24) {
    const tool = createPersonalTool(id, w.recipe);
    w.progress = 0;
    w.craftPurpose = "";
    w.recipe = null;
    w.task = "idle";
    if (tool) {
      w.toolId = tool.entityId;
      W.components.cognition[id].pendingReward += 160;
    }
  }
  return true;
}
function functionalToolsAtPlace(place, purpose) {
  const kind = placeKindKey(place),
    workers = new Set(localPlaceWorkers(place));
  return W.artifacts.filter(
    (a) =>
      isFunctionalTool(a, purpose) &&
      ((a.placeKind === kind && a.placeId === place.id) ||
        workers.has(a.ownerId) ||
        (!a.ownerId &&
          groundedToolTile(a) >= 0 &&
          dist2(place.x, place.y, ...xy(groundedToolTile(a))) <= 8 * 8)),
  );
}
function performPlaceToolmaking(id, place) {
  const w = workState(id),
    purpose = w.toolOrderPurpose || placeToolOrderForWorker(id, place);
  if (!purpose) return false;
  if (functionalToolsAtPlace(place, purpose).length) {
    w.toolOrderPurpose = "";
    w.toolOrderRecipe = null;
    return false;
  }
  const recipe = w.toolOrderRecipe || {
    purpose,
    head: makeArchitectureGenome(place).rigid,
    binding: makeArchitectureGenome(place).flexible,
  };
  w.toolOrderRecipe = recipe;
  if (
    W.components.inventory[id].materials[recipe.head] >= 2 &&
    W.components.inventory[id].materials[recipe.binding] >= 2
  ) {
    if (w.task !== "craft" || w.craftPurpose !== purpose) {
      w.task = "craft";
      w.craftPurpose = purpose;
      w.recipe = recipe;
      w.progress = 0;
    }
    return beginOrAdvanceCraft(id, purpose);
  }
  const sp = W.components.inventory[id].materials[recipe.head] < 2 ? recipe.head : recipe.binding,
    source = findResourceTile(id, sp),
    p = W.components.position[id],
    task = toolPurposeForMaterial(sp);
  if (source < 0) return false;
  if (idx(p.x, p.y) !== source)
    return moveWorkerToward(
      id,
      source,
      task,
      `travelling to gather ${W.definitions.species[sp].name} for a ${purpose} tool`,
      sp,
      0,
      0,
    );
  const got = extractForWork(id, source, sp);
  if (got) {
    setWorkAction(
      id,
      task,
      `preparing ${W.definitions.species[sp].name} for a ${purpose} tool`,
      source,
      sp,
      0,
      toolForPurpose(id, task)?.entityId || 0,
    );
    return true;
  }
  return false;
}
function placeStorageUsed(place) {
  let used = 0;
  for (let sp = 0; sp < SPECIES_COUNT; sp++) used += place.inventory?.[sp] || 0;
  return used;
}
function placeStorageRemaining(place) {
  return Math.max(0, (place.storageCapacity || 150) - placeStorageUsed(place));
}
function storageFloor(place, sp) {
  const target = essentialStockTargets(place).find(([id]) => id === sp)?.[1] || 0;
  return Math.max(
    researchMaterialReserve(place, sp),
    sp === C.ORGANIC || sp === C.SOLVENT || sp === C.ENERGY || sp === C.NUTRIENT
      ? Math.floor(target * 0.3)
      : 0,
  );
}
function spillStoredMatter(place, amount, incomingSp = -1) {
  let remaining = Math.max(0, amount),
    moved = 0;
  const tile = idx(place.x, place.y),
    candidates = Array.from({ length: SPECIES_COUNT }, (_, sp) => ({
      sp,
      excess: Math.max(0, (place.inventory[sp] || 0) - storageFloor(place, sp)),
      protected:
        sp === incomingSp ||
        sp === C.ORGANIC ||
        sp === C.SOLVENT ||
        sp === C.ENERGY ||
        sp === C.NUTRIENT,
    }))
      .filter((x) => x.excess > 0)
      .sort((a, b) => a.protected - b.protected || b.excess - a.excess || b.sp - a.sp);
  for (const { sp, excess } of candidates) {
    const take = Math.min(remaining, excess);
    if (!take) continue;
    place.inventory[sp] -= take;
    depositTileMatter(tile, sp, take);
    remaining -= take;
    moved += take;
    if (!remaining) break;
  }
  return moved;
}
function rebalancePlaceStorage(place) {
  const overflow = Math.max(0, placeStorageUsed(place) - (place.storageCapacity || 150));
  if (overflow) spillStoredMatter(place, overflow);
  return placeStorageRemaining(place);
}
// Samples a town keeps by for a craft it is working toward. Ten of a thing is
// enough to study it, but a craft that wants a hot fire wants a woodpile behind
// it: Ore Reduction asks for seven hundred degrees, which a town can raise only
// with fuel in hand, and the hearth burns the stores down to a couple of sticks
// every day, so a town that kept the usual ten samples stood for ever at twelve
// and never grew hot enough to smelt. A hot craft banks a woodpile instead.
const RESEARCH_SAMPLE = 10,
  RESEARCH_WOODPILE = 24,
  RESEARCH_HOT = 700;
function researchMaterialTarget(tech, sp) {
  return sp === C.FUEL && (tech?.heat || 0) >= RESEARCH_HOT ? RESEARCH_WOODPILE : RESEARCH_SAMPLE;
}
function hasResearchMaterial(place, sp, target = RESEARCH_SAMPLE) {
  return (place.researchInventory?.[sp] || 0) >= target || (place.inventory?.[sp] || 0) >= target;
}
function researchMaterialReserve(place, sp) {
  if (!place?.knownProcesses) return 0;
  let reserve = 0;
  for (const tech of techCatalog()) {
    if (
      place.knownProcesses.includes(tech.id) ||
      !(tech.prior || []).every((id) => place.knownProcesses.includes(id))
    )
      continue;
    if (
      tech.branch &&
      typeof branchProvisionAllowed === "function" &&
      !branchProvisionAllowed(place, tech)
    )
      continue;
    const facility = facilityForTechnology(tech.id);
    if ((!facility || placeHasFacility(place, facility)) && (tech.materials || []).includes(sp))
      reserve = Math.max(reserve, researchMaterialTarget(tech, sp));
  }
  return reserve;
}
function essentialStockTargets(place) {
  const pop = Math.max(1, placePopulation(place)),
    reserve = place.management?.reserve || 20,
    a = makeArchitectureGenome(place),
    raw = [
      [C.ORGANIC, Math.max(80 + reserve, pop * 12)],
      [C.SOLVENT, Math.max(160 + reserve * 2, pop * 12)],
      [C.ENERGY, Math.max(30, pop * 8)],
      [C.NUTRIENT, Math.max(20, pop * 3)],
      [a.rigid, 55 + reserve],
      [C.FUEL, 35 + reserve],
    ],
    known = new Set(place.knownProcesses || []);
  if (known.has("ceramics")) raw.push([C.MINERAL, 30]);
  if (known.has("metalworking")) raw.push([C.ORE, 36]);
  if (known.has("medicine")) raw.push([C.CATALYST, 14]);
  if (known.has("writing")) raw.push([C.INFO, 18], [C.PIGMENT, 18]);
  const merged = new Map();
  for (const [sp, target] of raw) merged.set(sp, Math.max(merged.get(sp) || 0, target));
  return Array.from(merged.entries());
}
function eligibleResearchMaterialNeeds(place) {
  if (!place?.knownProcesses || place.ruined) return [];
  const seen = new Set(),
    out = [];
  for (const tech of techCatalog()) {
    if (
      place.knownProcesses.includes(tech.id) ||
      !(tech.prior || []).every((id) => place.knownProcesses.includes(id))
    )
      continue;
    if (
      tech.branch &&
      typeof branchProvisionAllowed === "function" &&
      !branchProvisionAllowed(place, tech)
    )
      continue;
    const facility = facilityForTechnology(tech.id);
    if (facility && !placeHasFacility(place, facility)) continue;
    for (const sp of tech.materials || []) {
      const target = researchMaterialTarget(tech, sp);
      if (!hasResearchMaterial(place, sp, target) && !seen.has(sp)) {
        seen.add(sp);
        out.push({ techId: tech.id, sp, target });
      }
    }
  }
  const feedstock = { [C.METAL]: [C.ORE, C.FUEL], [C.CERAMIC]: [C.MINERAL, C.FUEL] };
  for (const need of out.slice())
    for (const feed of feedstock[need.sp] || [])
      if (!seen.has(feed) && (place.inventory?.[feed] || 0) < 12) {
        seen.add(feed);
        out.push({ techId: need.techId, sp: feed, target: 12 });
      }
  return out;
}
function depositCarriedToPlace(id, place) {
  const inv = W.components.inventory[id].materials,
    p = W.components.position[id],
    tile = idx(place.x, place.y);
  if (dist2(p.x, p.y, place.x, place.y) > 2)
    return moveWorkerToward(
      id,
      tile,
      "haul",
      `carrying gathered matter to ${place.name}`,
      -1,
      0,
      0,
    );
  place.researchInventory = place.researchInventory || new Uint16Array(SPECIES_COUNT);
  let moved = 0,
    sampled = 0;
  for (let sp = 0; sp < SPECIES_COUNT; sp++) {
    const keep = researchMaterialReserve(place, sp);
    if (!keep || place.researchInventory[sp] >= keep) continue;
    const amount = Math.min(inv[sp], keep - place.researchInventory[sp]);
    if (amount) {
      inv[sp] -= amount;
      place.researchInventory[sp] += amount;
      moved += amount;
      sampled += amount;
    }
  }
  let room = rebalancePlaceStorage(place);
  if (!room) {
    const priority = Array.from(inv).findIndex(
      (n, sp) =>
        n > 0 &&
        ((place.inventory[sp] || 0) <
          (essentialStockTargets(place).find(([id]) => id === sp)?.[1] || 0) ||
          researchMaterialReserve(place, sp) > place.inventory[sp]),
    );
    if (priority >= 0) {
      spillStoredMatter(place, Math.min(8, inv[priority]), priority);
      room = placeStorageRemaining(place);
    }
  }
  for (let sp = 0; sp < SPECIES_COUNT && room > 0; sp++) {
    const amount = Math.min(inv[sp], 8, room, 65535 - place.inventory[sp]);
    if (amount) {
      inv[sp] -= amount;
      place.inventory[sp] += amount;
      moved += amount;
      room -= amount;
    }
  }
  if (moved) {
    W.civicMetrics.delivered += moved;
    W.components.cognition[id].pendingReward += 96;
    setWorkAction(
      id,
      "haul",
      sampled
        ? `archived ${sampled} research samples and stored ${moved - sampled} supply packets in ${place.name}`
        : `deposited ${moved} matter packets in ${place.name}`,
      tile,
    );
    return true;
  }
  return false;
}
function transferEmbodiedResearchSample(id, sp) {
  if (sp !== C.INFO && sp !== C.PIGMENT) return false;
  const q = W.components.chemistry[id].q,
    reserve = sp === C.INFO ? 4 : 2,
    inv = W.components.inventory[id].materials;
  if (q[sp] <= reserve || inv[sp] >= 10) return false;
  q[sp]--;
  inv[sp]++;
  W.civicMetrics.gathered++;
  setWorkAction(
    id,
    "craft",
    sp === C.INFO
      ? "encoding a biological information polymer into a durable record"
      : "refining shed pigment into a stable sample",
    idx(W.components.position[id].x, W.components.position[id].y),
    sp,
  );
  W.components.cognition[id].pendingReward += 64;
  return true;
}
function performStockpileLabor(id, place) {
  rebalancePlaceStorage(place);
  const inv = W.components.inventory[id].materials,
    needs = eligibleResearchMaterialNeeds(place);
  let carried = 0,
    researchCargo = false;
  for (let sp = 0; sp < SPECIES_COUNT; sp++) {
    carried += inv[sp];
    if (inv[sp] && needs.some((n) => n.sp === sp)) researchCargo = true;
  }
  if (carried > 18 || researchCargo) return depositCarriedToPlace(id, place);
  if (!carried && placeStorageRemaining(place) <= 0) return false;
  for (const need of needs) {
    const wants = need.sp;
    if (transferEmbodiedResearchSample(id, wants)) return true;
    const source = findResourceTile(id, wants);
    if (source < 0) continue;
    const p = W.components.position[id],
      purpose = toolPurposeForMaterial(wants),
      tool = toolForPurpose(id, purpose);
    if (idx(p.x, p.y) !== source)
      return moveWorkerToward(
        id,
        source,
        purpose,
        `seeking a ${W.definitions.species[wants].name} research sample`,
        wants,
        0,
        tool?.entityId || 0,
      );
    const got = extractForWork(id, source, wants);
    if (got) {
      setWorkAction(
        id,
        purpose,
        `${tool ? "working with " + tool.name : "collecting by hand"} for ${technologyDefinition(need.techId)?.name || "research"}`,
        source,
        wants,
        0,
        tool?.entityId || 0,
      );
      return true;
    }
  }
  const targets = essentialStockTargets(place),
    wants = (targets.find(([sp, target]) => (place.inventory[sp] || 0) < target) ||
      targets[W.tick % targets.length])[0],
    purpose = toolPurposeForMaterial(wants),
    tool = toolForPurpose(id, purpose),
    source = findResourceTile(id, wants),
    p = W.components.position[id];
  if (source < 0) return false;
  if (idx(p.x, p.y) !== source)
    return moveWorkerToward(
      id,
      source,
      purpose,
      `seeking ${W.definitions.species[wants].name}`,
      wants,
      0,
      tool?.entityId || 0,
    );
  const got = extractForWork(id, source, wants);
  if (got) {
    setWorkAction(
      id,
      purpose,
      `${tool ? "working with " + tool.name : "collecting by hand"}`,
      source,
      wants,
      0,
      tool?.entityId || 0,
    );
    return true;
  }
  return false;
}
const performGatherMaterialSocietyBase = performGather;
performGather = function (id, tile) {
  if (W.kind[id] !== KINDS.PERSON) return performGatherMaterialSocietyBase(id, tile);
  const place = nearestWorkPlace(id),
    wanted = [],
    seen = new Set(),
    add = (sp) => {
      if (sp >= 0 && !seen.has(sp)) {
        seen.add(sp);
        wanted.push(sp);
      }
    };
  if (place) {
    for (const b of activeBuildings(place)) {
      const missing = missingBuildingMaterial(b);
      if (missing) {
        add(missing.sp);
        // Metal and ceramic are made, not found: the site's gatherers look
        // for the ore, mineral, and fuel the forge or kiln makes them from.
        if (typeof constructionFeedstock === "function")
          for (const feed of constructionFeedstock(place, missing.sp)) add(feed);
      }
    }
    for (const need of eligibleResearchMaterialNeeds(place)) add(need.sp);
    const a = makeArchitectureGenome(place);
    for (const sp of [C.ORGANIC, C.SOLVENT, a.rigid, C.FUEL]) add(sp);
  } else for (const sp of [C.ORGANIC, C.MINERAL, C.FUEL]) add(sp);
  for (const sp of wanted) {
    if (workResourceAmount(tile, sp) < 1) continue;
    const got = extractForWork(id, tile, sp);
    if (got) {
      const purpose = toolPurposeForMaterial(sp),
        tool = toolForPurpose(id, purpose);
      setWorkAction(
        id,
        purpose,
        place
          ? `gathering ${W.definitions.species[sp].name} for ${place.name}`
          : `foraging one useful ${W.definitions.species[sp].name} material`,
        tile,
        sp,
        0,
        tool?.entityId || 0,
      );
      return true;
    }
  }
  return false;
};
