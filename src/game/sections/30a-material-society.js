// ═══════════════════════════════════════════════════════════════════════════
// 30A. MATERIAL SOCIETY, WORK ORDERS, AND TERRESTRIAL PROGRESSION
// ═══════════════════════════════════════════════════════════════════════════
const CIV_STAGE_ORDER = Object.freeze([
  "multicellular",
  "sapient foraging",
  "tribal",
  "village",
  "civic",
  "urban",
  "complex terrestrial",
]);
const ADVANCED_TECH_BASE = Object.freeze([
  {
    id: "masonry",
    name: "Load-Bearing Masonry",
    materials: [C.MINERAL, C.FIBER],
    prior: ["tools"],
    facility: "workshop",
    threshold: 42,
  },
  {
    id: "sanitation",
    name: "Civic Sanitation",
    materials: [C.MINERAL, C.SOLVENT],
    prior: ["medicine", "irrigation"],
    facility: "clinic",
    threshold: 58,
  },
  {
    id: "logistics",
    name: "Recorded Logistics",
    materials: [C.INFO, C.PIGMENT],
    prior: ["writing", "governance"],
    facility: "hall",
    threshold: 62,
  },
  {
    id: "waterworks",
    name: "Pressure Waterworks",
    materials: [C.MINERAL, C.CERAMIC],
    prior: ["irrigation", "masonry"],
    facility: "workshop",
    threshold: 72,
  },
  {
    id: "mechanization",
    name: "Terrestrial Mechanization",
    materials: [C.METAL, C.FUEL],
    prior: ["metalworking", "tools"],
    facility: "forge",
    threshold: 82,
  },
  {
    id: "public_works",
    name: "Public Works Networks",
    materials: [C.MINERAL, C.INFO],
    prior: ["governance", "logistics", "masonry"],
    facility: "hall",
    threshold: 88,
  },
  {
    id: "planetary_stewardship",
    name: "Planetary Stewardship",
    materials: [C.INFO, C.CATALYST],
    prior: ["waterworks", "sanitation", "navigation", "public_works"],
    facility: "archive",
    threshold: 110,
  },
]);
const BUILDING_DEFS = Object.freeze({
  stockpile: {
    name: "Communal stockpile",
    work: 28,
    housing: 0,
    storage: 260,
    defense: 0,
    priority: "materials",
  },
  shelter: { name: "Shelter", work: 64, housing: 6, storage: 30, defense: 3, priority: "shelter" },
  hearth: { name: "Hearth", work: 42, housing: 0, storage: 20, defense: 1, priority: "food" },
  workshop: {
    name: "Tool workshop",
    work: 78,
    housing: 0,
    storage: 90,
    defense: 2,
    priority: "tools",
  },
  farm: {
    name: "Producer garden",
    work: 56,
    housing: 0,
    storage: 80,
    defense: 0,
    priority: "food",
  },
  corral: {
    name: "Material livestock enclosure",
    work: 52,
    housing: 0,
    storage: 18,
    defense: 9,
    priority: "food",
  },
  wall: {
    name: "Defensive wall",
    work: 74,
    housing: 0,
    storage: 0,
    defense: 18,
    priority: "defense",
  },
  kiln: {
    name: "Thermal kiln",
    work: 92,
    housing: 0,
    storage: 60,
    defense: 4,
    priority: "knowledge",
  },
  forge: {
    name: "Reduction forge",
    work: 118,
    housing: 0,
    storage: 80,
    defense: 5,
    priority: "tools",
  },
  clinic: {
    name: "Catalytic clinic",
    work: 104,
    housing: 2,
    storage: 100,
    defense: 2,
    priority: "health",
  },
  archive: {
    name: "Polymer archive",
    work: 112,
    housing: 0,
    storage: 140,
    defense: 3,
    priority: "knowledge",
  },
  hall: {
    name: "Civic hall",
    work: 146,
    housing: 4,
    storage: 180,
    defense: 8,
    priority: "governance",
  },
  waterworks: {
    name: "Waterworks",
    work: 136,
    housing: 0,
    storage: 220,
    defense: 6,
    priority: "water",
  },
});
function technologyDefinition(id) {
  return TECH_BASE.find((t) => t.id === id) || ADVANCED_TECH_BASE.find((t) => t.id === id);
}
function defaultCityManagement() {
  return {
    policy: "balanced",
    priorities: {
      food: 4,
      water: 4,
      shelter: 5,
      materials: 3,
      tools: 3,
      knowledge: 2,
      health: 2,
      defense: 2,
      governance: 2,
    },
    reserve: 20,
    expansion: true,
  };
}
function initializeSocietyState(world) {
  world.components = world.components || {};
  world.components.cognition = world.components.cognition || {};
  world.components.work = world.components.work || {};
  world.buildings = world.buildings || [];
  world.workOrders = world.workOrders || [];
  world.nextBuildingId = world.nextBuildingId || 1;
  world.nextWorkOrderId = world.nextWorkOrderId || 1;
  world.civilization = world.civilization || {
    stage: "multicellular",
    stageIndex: 0,
    stageTick: world.tick || 0,
    milestones: [],
    endpoint: "complex terrestrial",
  };
  world.civicMetrics = world.civicMetrics || {
    gathered: 0,
    delivered: 0,
    constructionWork: 0,
    toolsCrafted: 0,
    buildingsCompleted: 0,
    policyChanges: 0,
  };
  for (const p of [...(world.camps || []), ...(world.settlements || [])]) {
    p.management = p.management || defaultCityManagement();
    p.stage =
      p.stage ||
      ((p.knownProcesses?.length || 0) > 5 ? "civic" : p.knownProcesses ? "village" : "tribal");
    p.researchProgress = p.researchProgress || {};
    p.researchEvidence = p.researchEvidence || {};
    p.researchInventory =
      p.researchInventory instanceof Uint16Array && p.researchInventory.length === SPECIES_COUNT
        ? p.researchInventory
        : new Uint16Array(p.researchInventory || SPECIES_COUNT);
    p.architecture = p.architecture || null;
  }
  return world;
}
function placeByRef(kind, id) {
  return kind === "camp"
    ? W.camps.find((c) => c.id === id)
    : W.settlements.find((s) => s.id === id);
}
function buildingPlace(b) {
  return placeByRef(b.placeKind, b.placeId);
}
function completedBuildings(place, type = null) {
  return W.buildings.filter(
    (b) =>
      b.complete &&
      !b.ruined &&
      b.placeKind === (place.knownProcesses ? "settlement" : "camp") &&
      b.placeId === place.id &&
      (!type || b.type === type),
  );
}
function activeBuildings(place, type = null) {
  return W.buildings.filter(
    (b) =>
      !b.complete &&
      !b.ruined &&
      b.placeKind === (place.knownProcesses ? "settlement" : "camp") &&
      b.placeId === place.id &&
      (!type || b.type === type),
  );
}
function shelterProtectionAt(id, tile) {
  if (!W?.buildings?.length || W.kind[id] !== KINDS.PERSON) return 0;
  const p = W.components.position[id],
    place = nearestFriendlyPlace(id);
  if (!p || !place || dist2(p.x, p.y, place.x, place.y) > 9 * 9) return 0;
  let protection = 0;
  for (const b of completedBuildings(place, "shelter")) {
    if (dist2(p.x, p.y, b.x, b.y) > 3 * 3) continue;
    const occupants = entityAtRadius(idx(b.x, b.y), 3, KINDS.PERSON)
      .filter(classifyAlive)
      .sort((a, c) => {
        const pa = W.components.position[a],
          pc = W.components.position[c];
        return dist2(pa.x, pa.y, b.x, b.y) - dist2(pc.x, pc.y, b.x, b.y) || a - c;
      })
      .slice(0, Math.max(1, b.housing));
    if (occupants.includes(id))
      protection = Math.max(
        protection,
        clamp(b.integrity / Math.max(1, b.maxIntegrity), 0, 1) * 0.82,
      );
  }
  return protection;
}
function buildingAtTile(tile) {
  return W.buildings.find(
    (b) => idx(b.x, b.y) === tile && (!b.ruined || sum(Array.from(b.composition || [])) > 0),
  );
}
function buildingSpatialRadius(type) {
  if (type === "corral") return 2;
  if (type === "farm") return 1.5;
  if (type === "wall") return 0.5;
  return 1;
}
function spatialFootprintsOverlap(ax, ay, ar, bx, by, br) {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by)) < ar + br;
}
function developmentFootprintClear(x, y, radius, ignoreBuildingId = 0, ignoreFieldId = 0) {
  if (
    !inside(x, y) ||
    x - radius < 0 ||
    y - radius < 0 ||
    x + radius >= W.width ||
    y + radius >= W.height
  )
    return false;
  for (const building of W.buildings || []) {
    if (
      building.id === ignoreBuildingId ||
      (building.ruined && sum(Array.from(building.composition || [])) <= 0)
    )
      continue;
    if (
      spatialFootprintsOverlap(
        x,
        y,
        radius,
        building.x,
        building.y,
        buildingSpatialRadius(building.type),
      )
    )
      return false;
  }
  for (const field of W.fields || []) {
    if (field.id === ignoreFieldId || !Number.isInteger(field.tile)) continue;
    const [fieldX, fieldY] = xy(field.tile);
    if (spatialFootprintsOverlap(x, y, radius, fieldX, fieldY, 1)) return false;
  }
  return true;
}

function farmFootprintNaturallyDry(x, y) {
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const tx = x + dx,
        ty = y + dy;
      if (!inside(tx, ty)) return false;
      const tile = idx(tx, ty),
        naturalWater = W.tiles.hydrologyBase?.[tile] ?? W.tiles.liquid[tile];
      if (naturalWater >= 140) return false;
    }
  return true;
}

function buildingTerrainFootprintValid(type, x, y) {
  const radius = type === "farm" || type === "corral" ? 1 : 0;
  if (type === "farm" && !farmFootprintNaturallyDry(x, y)) return false;
  for (let dy = -radius; dy <= radius; dy++)
    for (let dx = -radius; dx <= radius; dx++) {
      const tx = x + dx,
        ty = y + dy;
      if (!inside(tx, ty)) return false;
      const tile = idx(tx, ty),
        naturalWater = W.tiles.hydrologyBase?.[tile] ?? 0;
      if (
        W.tiles.fire[tile] >= 200 ||
        W.tiles.liquid[tile] > (type === "farm" ? 140 : WATER_DEPTH.SHALLOW) ||
        naturalWater > WATER_DEPTH.SHALLOW ||
        (W.tiles.featureType?.[tile] && (W.tiles.featureStrength?.[tile] || 0) >= 150)
      )
        return false;
    }
  return true;
}
function localMaterialAbundance(tile, sp, r = 4) {
  const [cx, cy] = xy(tile);
  let total = 0;
  for (let y = Math.max(0, cy - r); y <= Math.min(W.height - 1, cy + r); y += 2)
    for (let x = Math.max(0, cx - r); x <= Math.min(W.width - 1, cx + r); x += 2) {
      const i = idx(x, y);
      total += tileMatterAmount(i, sp);
    }
  return total;
}
function materialTrait(sp) {
  return (
    W.definitions.materials
      .filter((m) => m.speciesId === sp)
      .sort((a, b) => b.hardness - a.hardness || a.id - b.id)[0] || {
      hardness: 0.35,
      brittleness: 0.4,
      density: 0.5,
      flammability: 0.2,
    }
  );
}
function chooseLocalRigid(tile) {
  const candidates = [C.MINERAL, C.ORE, C.CRYSTAL, C.CERAMIC, C.METAL]
    .map((sp) => {
      const m = materialTrait(sp),
        available = localMaterialAbundance(tile, sp);
      return { sp, score: Math.log2(available + 1) * 4 + m.hardness * 8 - m.brittleness * 2 };
    })
    .filter((x) => x.score > 0);
  candidates.sort((a, b) => b.score - a.score || a.sp - b.sp);
  return candidates[0]?.sp ?? C.MINERAL;
}
function chooseLocalFlexible(tile) {
  return localMaterialAbundance(tile, C.FIBER) > 20 ? C.FIBER : C.ORGANIC;
}
function makeArchitectureGenome(place, tile = idx(place.x, place.y)) {
  if (place.architecture) return place.architecture;
  const alien = W.terrainGenome?.alienness ?? makePlanetVisualGenome().alienness,
    r = makeRng(hashParts(W.seedHash, "architecture", place.id, tile), "architecture"),
    forms =
      alien < 0.2
        ? ["rectilinear", "courtyard"]
        : ["radial", "branching", "terraced", "hive", "courtyard", "rectilinear"],
    wallForms = ["stacked plate", "woven rib", "grown shell", "cut prism", "interlocked lattice"],
    roofForms = ["pitched", "membrane", "rib vault", "layered cap", "open lattice"],
    layout = forms[r.int(forms.length)],
    wallForm = wallForms[r.int(wallForms.length)],
    roofForm = roofForms[r.int(roofForms.length)],
    rigid = chooseLocalRigid(tile),
    flexible = chooseLocalFlexible(tile);
  place.architecture = {
    signature: `${layout}:${wallForm}:${roofForm}:${rigid}:${flexible}`,
    layout,
    wallForm,
    roofForm,
    rigid,
    flexible,
    orientation: r.int(4),
    paletteShift: r.int(61) - 30,
  };
  return place.architecture;
}
function buildingRequirements(place, type) {
  const a = makeArchitectureGenome(place),
    def = BUILDING_DEFS[type],
    scale =
      type === "wall"
        ? 1
        : type === "corral"
          ? 0.72
          : type === "hall"
            ? 2.2
            : type === "shelter"
              ? 1.15
              : 1,
    rigid = Math.max(6, Math.round(def.work * 0.18 * scale)),
    flex = Math.max(3, Math.round(def.work * 0.13 * scale)),
    raw = [[a.rigid, rigid]];
  if (type !== "wall" && type !== "waterworks") raw.push([a.flexible, flex]);
  if (type === "hearth" || type === "kiln" || type === "forge")
    raw.push([C.FUEL, type === "hearth" ? 8 : 18]);
  if (type === "farm") raw.push([C.NUTRIENT, 12], [C.SOLVENT, 16]);
  if (type === "clinic") raw.push([C.CATALYST, 8], [C.ORGANIC, 10]);
  if (type === "archive" || type === "hall") raw.push([C.INFO, 8], [C.PIGMENT, 4]);
  const totals = new Map();
  for (const [sp, n] of raw) totals.set(sp, (totals.get(sp) || 0) + n);
  return Array.from(totals.entries()).sort((a, b) => a[0] - b[0]);
}
function plannedBuildingTile(place, type, ordinal) {
  const a = makeArchitectureGenome(place),
    radius = 1 + Math.floor(ordinal / 5),
    slot = ordinal % 12,
    angle = (slot / 12) * Math.PI * 2 + (a.orientation * Math.PI) / 2;
  let ox, oy;
  if (a.layout === "rectilinear" || a.layout === "courtyard") {
    const grid = [
      [-2, -2],
      [0, -2],
      [2, -2],
      [2, 0],
      [2, 2],
      [0, 2],
      [-2, 2],
      [-2, 0],
      [-4, 0],
      [4, 0],
      [0, -4],
      [0, 4],
    ][slot];
    ox = grid[0] * radius * 0.55;
    oy = grid[1] * radius * 0.55;
  } else {
    ox = Math.round(Math.cos(angle) * (2 + radius));
    oy = Math.round(Math.sin(angle) * (2 + radius));
  }
  const x = clamp(place.x + Math.round(ox), 1, W.width - 2),
    y = clamp(place.y + Math.round(oy), 1, W.height - 2),
    footprint = buildingSpatialRadius(type),
    candidates = [];
  for (let ring = 0; ring <= 10; ring++)
    for (let dy = -ring; dy <= ring; dy++)
      for (let dx = -ring; dx <= ring; dx++) {
        if (ring && Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        candidates.push([x + dx, y + dy]);
      }
  for (const [tx, ty] of candidates) {
    if (!inside(tx, ty)) continue;
    if (developmentFootprintClear(tx, ty, footprint) && buildingTerrainFootprintValid(type, tx, ty))
      return [tx, ty];
  }
  return null;
}
function buildingMaterialRatio(b) {
  let ratio = 1;
  for (const [sp, required] of b.requirements)
    ratio = Math.min(ratio, (b.composition[sp] || 0) / Math.max(1, required));
  return clamp(ratio, 0, 1);
}
function refreshBuildingStage(b) {
  if (b.ruined) {
    b.complete = false;
    b.stage = 1;
    b.progress = buildingMaterialRatio(b) * 0.18;
    return 1;
  }
  if (b.complete) {
    b.stage = 6;
    b.progress = 1;
    return 6;
  }
  const material = buildingMaterialRatio(b),
    work = clamp(b.workDone / b.workRequired, 0, 1);
  if (!material) b.stage = 0;
  else if (material < 1) b.stage = 1;
  else b.stage = Math.min(5, 2 + Math.floor(work * 4));
  b.progress = material < 1 ? material * 0.18 : 0.18 + work * 0.82;
  if (material >= 1 && b.workDone >= b.workRequired) completeBuilding(b);
  return b.stage;
}
function planBuilding(place, type, priority = 3) {
  if (!place || !BUILDING_DEFS[type] || W.buildings.filter((b) => !b.ruined).length >= 480)
    return null;
  const kind = place.knownProcesses ? "settlement" : "camp",
    same = W.buildings.filter(
      (b) => !b.ruined && b.placeKind === kind && b.placeId === place.id && b.type === type,
    ),
    ordinal = W.buildings.filter(
      (b) => !b.ruined && b.placeKind === kind && b.placeId === place.id,
    ).length,
    plannedTile = plannedBuildingTile(place, type, ordinal);
  if (!plannedTile) {
    queueRuinSalvage(place);
    return null;
  }
  const def = BUILDING_DEFS[type],
    x = plannedTile?.[0],
    y = plannedTile?.[1],
    b = {
      id: W.nextBuildingId++,
      placeKind: kind,
      placeId: place.id,
      type,
      name: def.name,
      x,
      y,
      orientation: makeArchitectureGenome(place).orientation,
      styleSeed: hashParts(W.seedHash, kind, place.id, type, ordinal),
      architecture: { ...makeArchitectureGenome(place) },
      requirements: buildingRequirements(place, type),
      composition: new Uint16Array(SPECIES_COUNT),
      workDone: 0,
      workRequired: def.work,
      stage: 0,
      progress: 0,
      complete: false,
      ruined: false,
      integrity: 0,
      maxIntegrity: 500 + def.work * 4,
      housing: def.housing,
      storage: def.storage,
      defense: def.defense,
      createdTick: W.tick,
      completedTick: -1,
      workers: [],
    };
  W.buildings.push(b);
  const order = {
    id: W.nextWorkOrderId++,
    type: "construct",
    buildingId: b.id,
    placeKind: kind,
    placeId: place.id,
    priority,
    status: "open",
    createdTick: W.tick,
    claimedBy: 0,
  };
  W.workOrders.push(order);
  const ev = emitEvent("ConstructionStartedEvent", {
    subjects: [place.entityId].filter(Boolean),
    location: idx(x, y),
    causes: [place.importantEvents?.at(-1) || W.lastEventByType.CampFoundedEvent || 0],
    evidence: [
      `${def.name} blueprint laid out`,
      `architecture: ${b.architecture.wallForm} / ${b.architecture.roofForm}`,
      `planned from ${b.requirements.map(([sp, n]) => `${W.definitions.species[sp].name} ${n}`).join(", ")}`,
    ],
    importance: 1,
    data: { name: def.name, buildingId: b.id },
  });
  b.causeEvent = ev.id;
  return b;
}
function recomputePlaceCapacity(place) {
  if (!place) return { housing: 0, storage: 0, defense: 0 };
  const completed = completedBuildings(place),
    factor = (b) => clamp(b.integrity / Math.max(1, b.maxIntegrity), 0, 1),
    defense = sum(completed.map((b) => b.defense * factor(b))),
    housing = sum(completed.map((b) => Math.floor(b.housing * clamp(factor(b) * 1.25, 0, 1)))),
    storage = 150 + sum(completed.map((b) => Math.floor(b.storage * factor(b))));
  place.housing = housing;
  place.storageCapacity = storage;
  place.defense = defense;
  const kind = place.knownProcesses ? "settlement" : "camp",
    history = W.buildings.filter(
      (b) => b.placeKind === kind && b.placeId === place.id && (b.completedTick ?? -1) >= 0,
    ),
    current = sum(history.map((b) => b.integrity || 0)),
    maximum = sum(history.map((b) => b.maxIntegrity || 0)),
    integrity = maximum
      ? (current / maximum) * 1000
      : Math.max(20, place.structure?.integrity || 20);
  if (place.structure) place.structure.integrity = u16(integrity);
  return { housing, storage, defense };
}
const settlementDefenseBuildingsBase = settlementDefense;
settlementDefense = function (s) {
  if (!s) return 0;
  const built = completedBuildings(s).reduce((n, b) => {
      const hardness = materialTrait(b.architecture?.rigid ?? C.MINERAL).hardness,
        condition = clamp(b.integrity / Math.max(1, b.maxIntegrity), 0, 1);
      return n + b.defense * condition * (0.75 + hardness * 0.5);
    }, 0),
    fortification = s.knownProcesses?.includes("fortification") ? 1.45 : 1;
  return clamp(settlementDefenseBuildingsBase(s) + built * fortification, 0, 100);
};
function completeBuilding(b) {
  if (!b || b.ruined) return;
  b.complete = true;
  b.stage = 6;
  b.progress = 1;
  b.integrity = b.maxIntegrity;
  b.completedTick = W.tick;
  if (typeof invalidateDevelopmentMovementCache === "function")
    invalidateDevelopmentMovementCache();
  const order = W.workOrders.find((o) => o.buildingId === b.id && o.status !== "complete");
  if (order) order.status = "complete";
  const place = buildingPlace(b);
  recomputePlaceCapacity(place);
  W.civicMetrics.buildingsCompleted++;
  const ev = emitEvent("BuildingCompletedEvent", {
    subjects: [place?.entityId].filter(Boolean),
    location: idx(b.x, b.y),
    causes: [b.causeEvent || 0],
    evidence: [
      `${b.name} received its required matter`,
      `foundation, frame, walls, and roof were completed by visible labor`,
      b.requirements.map(([sp]) => W.definitions.species[sp].name).join(" + "),
    ],
    importance: b.type === "hall" || b.type === "waterworks" ? 4 : 2,
    data: { name: b.name, buildingId: b.id, place: place?.name },
  });
  if (place?.importantEvents) place.importantEvents.push(ev.id);
}
function collapseBuilding(b, evidence = "structural integrity failed", causeEvent = 0) {
  if (!b || b.ruined) return null;
  b.ruined = true;
  b.complete = false;
  b.stage = 1;
  b.progress = buildingMaterialRatio(b) * 0.18;
  b.integrity = 0;
  if (typeof invalidateDevelopmentMovementCache === "function")
    invalidateDevelopmentMovementCache();
  const order = W.workOrders.find((o) => o.buildingId === b.id && o.status !== "complete");
  if (order) order.status = "cancelled";
  for (const id of W.activeIds)
    if (W.components.work?.[id]?.buildingId === b.id) clearStaleWork(id);
  const place = buildingPlace(b),
    ev = emitEvent("BuildingCollapsedEvent", {
      subjects: [place?.entityId].filter(Boolean),
      location: idx(b.x, b.y),
      causes: [causeEvent, b.causeEvent || 0],
      evidence: [
        evidence,
        `${b.name} no longer contributes housing, storage, or defense`,
        `its material remains as conserved rubble`,
      ],
      importance: b.type === "wall" ? 2 : 3,
      data: { name: b.name, buildingId: b.id, place: place?.name },
    });
  if (place) {
    place.importantEvents?.push(ev.id);
    recomputePlaceCapacity(place);
  }
  return ev;
}
function damageBuiltPlace(place, amount, cause = "impact damage", causeEvent = 0, focusTile = -1) {
  if (!place || amount <= 0) return 0;
  const targets = completedBuildings(place).sort(
    (a, b) =>
      (a.type === "wall" ? -1 : 0) - (b.type === "wall" ? -1 : 0) ||
      (focusTile >= 0
        ? dist2(a.x, a.y, ...xy(focusTile)) - dist2(b.x, b.y, ...xy(focusTile))
        : 0) ||
      a.id - b.id,
  );
  if (!targets.length) return 0;
  const b = targets[0],
    hardness = materialTrait(b.architecture?.rigid ?? C.MINERAL).hardness,
    resistance = 1 + hardness * 1.4 + (b.type === "wall" ? 1.2 : 0),
    damage = Math.max(1, Math.ceil(amount / resistance));
  b.integrity = u16(b.integrity - damage);
  if (b.integrity < 1) collapseBuilding(b, cause, causeEvent);
  else recomputePlaceCapacity(place);
  return damage;
}
function damageBuildingDirect(b, amount, cause = "structural damage", causeEvent = 0) {
  if (!b || b.ruined || !b.complete || amount <= 0) return 0;
  const before = b.integrity;
  b.integrity = u16(b.integrity - Math.max(1, Math.ceil(amount)));
  if (b.integrity < 1) collapseBuilding(b, cause, causeEvent);
  else recomputePlaceCapacity(buildingPlace(b));
  CIVIC_OVERLAY_CACHE = null;
  return before - b.integrity;
}
const damageAtBuildingsBase = damageAt;
damageAt = function (d) {
  damageAtBuildingsBase(d);
  const amount = d.amount || 20,
    seen = new Set();
  if (d.settlementId) {
    const place = W.settlements.find((s) => s.id === d.settlementId);
    if (place) {
      damageBuiltPlace(
        place,
        amount,
        d.cause || "structural impact",
        d.causeEvent || 0,
        d.tile ?? -1,
      );
      seen.add(`settlement:${place.id}`);
    }
  }
  if (d.tile != null) {
    const [x, y] = xy(d.tile),
      direct = W.buildings
        .filter((b) => !b.ruined && dist2(x, y, b.x, b.y) <= 2)
        .sort((a, b) => a.id - b.id);
    for (const b of direct) {
      const key = `${b.placeKind}:${b.placeId}`;
      if (seen.has(key)) continue;
      const place = buildingPlace(b);
      if (place)
        damageBuiltPlace(
          place,
          amount,
          d.cause || "local structural impact",
          d.causeEvent || 0,
          d.tile,
        );
      seen.add(key);
    }
  }
};
const ruinSettlementBuildingsBase = ruinSettlement;
ruinSettlement = function (s, causes = [], evidence = "structural material failed") {
  const ev = ruinSettlementBuildingsBase(s, causes, evidence);
  if (!ev) return ev;
  for (const b of W.buildings.filter(
    (b) => b.placeKind === "settlement" && b.placeId === s.id && !b.ruined,
  ))
    collapseBuilding(b, `${s.name} was lost because ${evidence}`, ev.id);
  for (const id of W.activeIds)
    if (
      W.components.work?.[id] &&
      buildingPlace(W.buildings.find((b) => b.id === W.components.work[id].buildingId) || {}) === s
    )
      clearStaleWork(id);
  recomputePlaceCapacity(s);
  return ev;
};
const resolveWarTurnBuildingsBase = resolveWarTurn;
resolveWarTurn = function (war, a, b) {
  const beforeCasualties = war.casualties,
    beforeStability = new Map(
      W.settlements.filter((s) => !s.ruined).map((s) => [s.id, s.stability]),
    );
  const result = resolveWarTurnBuildingsBase(war, a, b),
    loss = Math.max(0, war.casualties - beforeCasualties);
  if (loss) {
    const target = W.settlements
      .filter((s) => beforeStability.has(s.id))
      .sort(
        (x, y) =>
          x.stability - beforeStability.get(x.id) - (y.stability - beforeStability.get(y.id)) ||
          x.id - y.id,
      )[0];
    if (target && !target.ruined)
      damageBuiltPlace(
        target,
        loss * 18,
        "organized siege damage",
        war.lastEventId || war.startEventId,
        idx(target.x, target.y),
      );
  }
  return result;
};
const updatePhysicalSubstrateBuildingsBase = updatePhysicalSubstrate;
updatePhysicalSubstrate = function () {
  const row = W.tick % W.height,
    exposed = W.buildings
      .filter((b) => b.complete && !b.ruined && b.y === row)
      .map((b) => ({ b, fire: W.tiles.fire[idx(b.x, b.y)] || 0 }));
  updatePhysicalSubstrateBuildingsBase();
  for (const { b, fire: before } of exposed) {
    const tile = idx(b.x, b.y),
      fire = Math.max(before, W.tiles.fire[tile] || 0);
    if (fire < 320) continue;
    const rigid = materialTrait(b.architecture?.rigid ?? C.MINERAL),
      flex = materialTrait(b.architecture?.flexible ?? C.ORGANIC),
      flammability = rigid.flammability * 0.7 + (b.type === "wall" ? 0 : flex.flammability * 0.3),
      damage = clamp(Math.ceil(((fire - 280) / 170) * (0.25 + flammability)), 1, 6);
    damageBuildingDirect(
      b,
      damage,
      "sustained combustion weakened the built material",
      W.causalIndex.tile[tile] || W.lastEventByType.FireStartedEvent || 0,
    );
  }
};
function ensurePlacePlans(place) {
  if (!place || place.ruined || place.active === false) return;
  place.management = place.management || defaultCityManagement();
  makeArchitectureGenome(place);
  const settlement = !!place.knownProcesses,
    kind = settlement ? "settlement" : "camp",
    pop = settlement
      ? settlementPopulation(place)
      : entityAtRadius(idx(place.x, place.y), 6, KINDS.PERSON).filter(classifyAlive).length,
    count = (type) =>
      W.buildings.filter(
        (b) => !b.ruined && b.placeKind === kind && b.placeId === place.id && b.type === type,
      ).length,
    plan = (type, priority) => {
      if (!count(type)) planBuilding(place, type, priority);
    };
  plan("stockpile", place.management.priorities.materials);
  plan("shelter", place.management.priorities.shelter);
  if (completedBuildings(place, "stockpile").length)
    plan("hearth", place.management.priorities.food);
  if (completedBuildings(place, "shelter").length)
    plan("workshop", place.management.priorities.tools);
  if (!settlement) return;
  const compact = !place.management.expansion,
    desiredShelters = Math.max(
      1,
      Math.ceil(pop / (compact ? 8 : 6)) + (place.management.policy === "growth" ? 1 : 0),
    );
  while (count("shelter") < desiredShelters && activeBuildings(place).length < 4) {
    if (!planBuilding(place, "shelter", place.management.priorities.shelter)) break;
  }
  const desiredFarms = place.management.policy === "growth" ? 2 : 1;
  while (count("farm") < desiredFarms && activeBuildings(place).length < 4) {
    if (!planBuilding(place, "farm", place.management.priorities.food)) break;
  }
  if (W.herds?.some((herd) => herd.active && herd.placeKind === kind && herd.placeId === place.id))
    plan("corral", Math.max(place.management.priorities.food, place.management.priorities.defense));
  if (place.knownProcesses.includes("controlled_fire"))
    plan("kiln", place.management.priorities.knowledge);
  if (place.knownProcesses.includes("metalworking"))
    plan("forge", place.management.priorities.tools);
  if (place.knownProcesses.includes("medicine")) plan("clinic", place.management.priorities.health);
  if (place.knownProcesses.includes("writing"))
    plan("archive", place.management.priorities.knowledge);
  if (place.knownProcesses.includes("governance"))
    plan("hall", place.management.priorities.governance);
  if (place.knownProcesses.includes("waterworks"))
    plan("waterworks", place.management.priorities.water);
  const desiredWalls =
    place.management.policy === "fortified"
      ? 6
      : place.knownProcesses.includes("fortification")
        ? 4
        : 0;
  while (count("wall") < desiredWalls && activeBuildings(place).length < 5) {
    if (!planBuilding(place, "wall", place.management.priorities.defense)) break;
  }
}
function compileLegacyPlaceBuildings() {
  for (const place of [
    ...W.camps.filter((c) => c.active),
    ...W.settlements.filter((s) => !s.ruined),
  ]) {
    const kind = place.knownProcesses ? "settlement" : "camp";
    if (W.buildings.some((b) => b.placeKind === kind && b.placeId === place.id)) continue;
    place.management = place.management || defaultCityManagement();
    makeArchitectureGenome(place);
    const types = place.knownProcesses
      ? ["stockpile", "shelter", "workshop"]
      : ["stockpile", "shelter"];
    for (const [n, type] of types.entries()) {
      const planned = plannedBuildingTile(place, type, n);
      if (!planned) continue;
      const def = BUILDING_DEFS[type],
        [x, y] = planned,
        b = {
          id: W.nextBuildingId++,
          placeKind: kind,
          placeId: place.id,
          type,
          name: def.name,
          x,
          y,
          orientation: place.architecture.orientation,
          styleSeed: hashParts(W.seedHash, "legacy-building", place.id, n),
          architecture: { ...place.architecture },
          requirements: [],
          composition: new Uint16Array(SPECIES_COUNT),
          workDone: def.work,
          workRequired: def.work,
          stage: 6,
          progress: 1,
          complete: true,
          ruined: false,
          integrity: 500 + def.work * 4,
          maxIntegrity: 500 + def.work * 4,
          housing: def.housing,
          storage: def.storage,
          defense: def.defense,
          createdTick: place.foundedTick || 0,
          completedTick: place.foundedTick || 0,
          workers: [],
          legacy: true,
        };
      if (n === 0 && place.structure?.composition) {
        b.composition.set(place.structure.composition);
        place.structure.composition.fill(0);
      }
      W.buildings.push(b);
    }
    recomputePlaceCapacity(place);
  }
}
const createWorldSocietyBase = createWorld;
createWorld = function (options) {
  return initializeSocietyState(createWorldSocietyBase(options));
};
const restoreWorldSocietyBase = restoreWorldDefaults;
restoreWorldDefaults = function () {
  restoreWorldSocietyBase();
  const legacy = !W.buildings;
  initializeSocietyState(W);
  for (const id of W.activeIds)
    if ([KINDS.HERBIVORE, KINDS.PREDATOR, KINDS.PERSON].includes(W.kind[id])) {
      initCognition(id);
      workState(id);
    }
  if (legacy) compileLegacyPlaceBuildings();
  for (const b of W.buildings) refreshBuildingStage(b);
  rebuildSpatialBins();
};
const restoreWorldRefugiaBase = restoreWorldDefaults;
restoreWorldDefaults = function () {
  restoreWorldRefugiaBase();
  if (W.biosphere) W.biosphere.lastBankTickByKind = W.biosphere.lastBankTickByKind || {};
  for (const refuge of W.biosphere?.refugia || []) {
    refuge.chemistry =
      refuge.chemistry instanceof Uint16Array && refuge.chemistry.length === SPECIES_COUNT
        ? refuge.chemistry
        : Uint16Array.from(refuge.chemistry || Array(SPECIES_COUNT).fill(0));
    refuge.materials =
      refuge.materials instanceof Uint16Array && refuge.materials.length === SPECIES_COUNT
        ? refuge.materials
        : Uint16Array.from(refuge.materials || Array(SPECIES_COUNT).fill(0));
    refuge.digestive =
      refuge.digestive instanceof Uint16Array && refuge.digestive.length === SPECIES_COUNT
        ? refuge.digestive
        : Uint16Array.from(refuge.digestive || Array(SPECIES_COUNT).fill(0));
  }
};
const totalMatterSocietyBase = totalMatter;
totalMatter = function () {
  let total = totalMatterSocietyBase();
  for (const b of W.buildings || []) for (const amount of b.composition || []) total += amount;
  for (const place of [...(W.camps || []), ...(W.settlements || [])])
    for (const amount of place.researchInventory || []) total += amount;
  return total;
};
const totalChemicalEnergySocietyBase = totalChemicalEnergy;
totalChemicalEnergy = function () {
  let total = totalChemicalEnergySocietyBase(),
    energy = W.definitions.species.map((s) => s.freeEnergy);
  for (const b of W.buildings || [])
    for (let sp = 0; sp < SPECIES_COUNT; sp++)
      total += (b.composition?.[sp] || 0) * (energy[sp] || 0);
  for (const place of [...(W.camps || []), ...(W.settlements || [])])
    for (let sp = 0; sp < SPECIES_COUNT; sp++)
      total += (place.researchInventory?.[sp] || 0) * (energy[sp] || 0);
  return total;
};
createCamp = function (tile, founderId, cause = 0) {
  if (
    W.camps.filter((c) => c.active).length >= CAPS.camp ||
    campNear(tile, 5) ||
    !W.components.social[founderId]
  )
    return null;
  const [x, y] = xy(tile),
    id = allocEntity(KINDS.CAMP),
    r = makeRng(hashParts(W.seedHash, tile, W.tick), "camp-name"),
    name = `${NAME_B[r.int(NAME_B.length)]}${["rest", "hearth", "hold", "camp"][r.int(4)]}`,
    camp = {
      id: W.camps.length + 1,
      entityId: id,
      name,
      x,
      y,
      founderId,
      factionId: W.components.social[founderId]?.factionId || 0,
      inventory: new Uint16Array(SPECIES_COUNT),
      structure: {
        patternId: 12,
        order: 30,
        integrity: 30,
        composition: new Uint16Array(SPECIES_COUNT),
      },
      foundedTick: W.tick,
      active: true,
      stableTicks: 0,
      lastOccupied: W.tick,
      management: defaultCityManagement(),
      stage: "encampment",
      researchProgress: {},
      researchEvidence: {},
      researchInventory: new Uint16Array(SPECIES_COUNT),
      architecture: null,
    };
  W.camps.push(camp);
  W.components.position[id] = { x, y, layer: 0, regionId: regionId(x, y) };
  W.components.identity[id] = {
    generatedName: name,
    significance: 2,
    notable: false,
    titles: ["Building camp"],
  };
  makeArchitectureGenome(camp, tile);
  const ev = emitEvent("CampFoundedEvent", {
    subjects: [founderId, id],
    location: tile,
    causes: [cause],
    evidence: [
      "a social home was chosen",
      "stockpile and shelter blueprints were marked",
      "no shelter matter was conjured",
    ],
    importance: 2,
    data: { name },
  });
  camp.causeEvent = ev.id;
  addRelation(founderId, id, "founded", 1, ev.id);
  W.components.identity[founderId].settlementsFounded.push(id);
  W.tiles.culture[tile] = u16(W.tiles.culture[tile] + 250);
  planBuilding(camp, "stockpile", 5);
  planBuilding(camp, "shelter", 5);
  return camp;
};
const createCampSocietyHomeBase = createCamp;
createCamp = function (tile, founderId, cause = 0) {
  const social = W.components.social[founderId],
    existing =
      social?.homePlaceKind === "camp"
        ? W.camps.find((c) => c.id === social.homePlaceId && c.active)
        : social?.homePlaceKind === "settlement"
          ? W.settlements.find((s) => s.id === social.homePlaceId && !s.ruined)
          : null;
  if (existing) return null;
  const camp = createCampSocietyHomeBase(tile, founderId, cause);
  if (camp)
    for (const id of entityAtRadius(tile, 6, KINDS.PERSON).filter(classifyAlive)) {
      const member = W.components.social[id],
        prior =
          member?.homePlaceKind === "camp"
            ? W.camps.find((c) => c.id === member.homePlaceId && c.active)
            : member?.homePlaceKind === "settlement"
              ? W.settlements.find((s) => s.id === member.homePlaceId && !s.ruined)
              : null;
      if (!prior) {
        member.homePlaceKind = "camp";
        member.homePlaceId = camp.id;
      }
    }
  return camp;
};
createSettlement = function (campId, cause = 0) {
  const camp = W.camps.find((c) => c.id === campId && c.active);
  if (!camp || W.settlements.filter((s) => !s.ruined).length >= CAPS.settlement) return null;
  const shelter = completedBuildings(camp, "shelter").length,
    stockpile = completedBuildings(camp, "stockpile").length,
    hearth = completedBuildings(camp, "hearth").length;
  if (!shelter || !stockpile || !hearth) return null;
  camp.active = false;
  W.kind[camp.entityId] = KINDS.SETTLEMENT;
  const r = makeRng(hashParts(W.seedHash, camp.id, W.tick), "settlement-name"),
    name = `${NAME_B[r.int(NAME_B.length)]}${["watch", "hollow", "reach", "haven", "ford", "spire"][r.int(6)]}`,
    inventory = camp.inventory.slice();
  camp.inventory.fill(0);
  const s = {
    id: W.settlements.length + 1,
    entityId: camp.entityId,
    name,
    x: camp.x,
    y: camp.y,
    founderId: camp.founderId,
    factionId: camp.factionId,
    cultureId: 0,
    inventory,
    structure: {
      patternId: 12,
      order: 460,
      integrity: 650,
      composition: new Uint16Array(SPECIES_COUNT),
    },
    housing: 0,
    storageCapacity: 0,
    stability: 0.68,
    defense: 0,
    knownProcesses: [],
    observations: [],
    foundedTick: W.tick,
    heat: 0,
    productionTemperature: 20,
    outbreakActive: 0,
    importantEvents: [],
    ruined: false,
    management: camp.management,
    stage: "village",
    researchProgress: {},
    researchEvidence: {},
    architecture: camp.architecture,
  };
  W.settlements.push(s);
  for (const b of W.buildings)
    if (b.placeKind === "camp" && b.placeId === camp.id) {
      b.placeKind = "settlement";
      b.placeId = s.id;
    }
  for (const o of W.workOrders)
    if (o.placeKind === "camp" && o.placeId === camp.id) {
      o.placeKind = "settlement";
      o.placeId = s.id;
    }
  W.components.identity[s.entityId].generatedName = name;
  W.components.identity[s.entityId].titles = ["Built settlement"];
  recomputePlaceCapacity(s);
  const ev = emitEvent("SettlementFoundedEvent", {
    subjects: [s.founderId, s.entityId],
    location: idx(s.x, s.y),
    causes: [cause, camp.causeEvent || W.lastEventByType.CampFoundedEvent],
    evidence: [
      "completed shelter enclosed its inhabitants",
      "a communal stockpile retained gathered matter",
      "a worked hearth supported permanent occupation",
    ],
    importance: 4,
    data: { name },
  });
  s.importantEvents.push(ev.id);
  addRelation(s.founderId, s.entityId, "founded", 1, ev.id);
  ensurePlacePlans(s);
  return s;
};
const createSettlementResearchBase = createSettlement;
createSettlement = function (campId, cause = 0) {
  const camp = W.camps.find((c) => c.id === campId && c.active),
    samples = camp?.researchInventory?.slice() || new Uint16Array(SPECIES_COUNT),
    s = createSettlementResearchBase(campId, cause);
  if (s) {
    s.researchInventory = samples;
    if (camp?.researchInventory) camp.researchInventory.fill(0);
    for (const a of W.artifacts)
      if (a.placeKind === "camp" && a.placeId === campId) {
        a.placeKind = "settlement";
        a.placeId = s.id;
        a.settlementId = s.id;
      }
    for (const id of W.activeIds) {
      const work = W.components.work?.[id];
      if (work?.toolOrderPlaceKind === "camp" && work.toolOrderPlaceId === campId) {
        work.toolOrderPlaceKind = "settlement";
        work.toolOrderPlaceId = s.id;
      }
    }
  }
  return s;
};
const createSettlementHomeBase = createSettlement;
createSettlement = function (campId, cause = 0) {
  const s = createSettlementHomeBase(campId, cause);
  if (s)
    for (const id of W.activeIds) {
      const social = W.components.social[id];
      if (social?.homePlaceKind === "camp" && social.homePlaceId === campId) {
        social.homePlaceKind = "settlement";
        social.homePlaceId = s.id;
      }
    }
  return s;
};
const initializeSocietyPromotionBase = initializeSocietyState;
initializeSocietyState = function (world) {
  initializeSocietyPromotionBase(world);
  for (const camp of world.camps || []) {
    if (camp.active) continue;
    const settlement = (world.settlements || []).find((s) => s.entityId === camp.entityId);
    if (!settlement) continue;
    for (const a of world.artifacts || [])
      if (a.placeKind === "camp" && a.placeId === camp.id) {
        a.placeKind = "settlement";
        a.placeId = settlement.id;
        a.settlementId = settlement.id;
      }
    for (const id of world.activeIds || []) {
      const work = world.components.work?.[id];
      if (work?.toolOrderPlaceKind === "camp" && work.toolOrderPlaceId === camp.id) {
        work.toolOrderPlaceKind = "settlement";
        work.toolOrderPlaceId = settlement.id;
      }
    }
  }
  return world;
};

const LTC_Q = 1024,
  LTC_HIDDEN = 8,
  LTC_INPUT_FAN = 6,
  LTC_REC_FAN = 4,
  LTC_OUTPUT_FAN = 5,
  LTC_ACTIONS = Object.freeze([
    "wander",
    "rest",
    "food",
    "water",
    "flee",
    "mate",
    "hunt",
    "scavenge",
    "gather",
    "return",
    "socialize",
    "defend",
    "work",
    "shelter",
  ]),
  LTC_SENSE_LABELS = Object.freeze([
    "Hunger",
    "Thirst",
    "Fatigue",
    "Injury",
    "Energy need",
    "Structural damage",
    "Threat pressure",
    "Local food",
    "Local moisture",
    "Prey density",
    "Prey proximity",
    "Prey vulnerability",
    "Predator density",
    "Predator proximity",
    "Carrion scent",
    "Material resources",
    "Nearby allies",
    "Mating readiness",
    "Available mates",
    "Distance from home",
    "Habitat stress",
    "Work urgency",
    "Weather exposure",
    "Shelter cover",
    "Food gradient",
    "Water gradient",
    "Safety gradient",
    "Escape routes",
    "Fear memory",
    "Blood scent",
    "Fire heat",
    "Disease pressure",
  ]);
const LTC_INPUT_SEED = Object.freeze([
    1600, 900, 350, 250, 1750, 850, 1050, 700, 1900, 1100, 650, 800, 1200, 1500, 650, -1000, 1250,
    1550, 750, -850,
  ]),
  LTC_REC_SEED = Object.freeze([800, -1100, 600, 200, 850, -300, 850, -900, 750, -1000]),
  LTC_OUT_SEED = Object.freeze([
    650, -500, 150, 1250, -250, -400, 1500, -150, -500, 1500, -100, -500, 1800, 150, -300, 1500,
    -250, -800, 1100, 250, 350, 950, 450, -350, 1400, 200, -700, 800, 600, -100, 1500, 100, -700,
    1050, 650, 250, 1600, 250, -700, 1100, 500, 300,
  ]);
const expandLTCBase = (seed, length, salt) =>
    Object.freeze(
      Array.from({ length }, (_, i) =>
        clamp(seed[i % seed.length] + ((i * 137 + salt * 71) % 321) - 160, -2300, 2300),
      ),
    ),
  LTC_INPUT_BASE = expandLTCBase(LTC_INPUT_SEED, LTC_HIDDEN * LTC_INPUT_FAN, 1),
  LTC_REC_BASE = expandLTCBase(LTC_REC_SEED, LTC_HIDDEN * LTC_REC_FAN, 2),
  LTC_OUT_BASE = expandLTCBase(LTC_OUT_SEED, LTC_ACTIONS.length * LTC_OUTPUT_FAN, 3);
function controllerArray(base, id, salt, parentA, parentB, min = -2560, max = 2560) {
  const out = new Int16Array(base.length);
  for (let i = 0; i < base.length; i++) {
    let value = base[i],
      pa = parentA?.[i],
      pb = parentB?.[i];
    if (pa != null || pb != null)
      value =
        pa != null && pb != null ? (hashParts(W.seedHash, id, salt, i) & 1 ? pa : pb) : (pa ?? pb);
    else value += Math.floor(hashParts(W.seedHash, id, salt, i) % 129) - 64;
    if (
      (pa != null || pb != null) &&
      counterRand(`ltc-mutation-${salt}`, id, i) < W.laws.mutationIntensity * 0.6
    )
      value += Math.floor(hashParts(W.seedHash, id, "ltc-step", salt, i) % 385) - 192;
    out[i] = clamp(Math.round(value), min, max);
  }
  return out;
}
function makeLTCController(id, kind, parents = []) {
  const a = W.components.genome[parents[0]]?.controller,
    b = W.components.genome[parents[1]]?.controller,
    tauBase = [4096, 3072, 1536, 6144, 5120, 2304, 7168, 3584],
    tau = new Uint16Array(LTC_HIDDEN);
  for (let i = 0; i < LTC_HIDDEN; i++) {
    const pa = a?.tau?.[i],
      pb = b?.tau?.[i],
      v =
        pa && pb
          ? hashParts(W.seedHash, id, "ltc-tau-parent", i) & 1
            ? pa
            : pb
          : pa ||
            pb ||
            tauBase[i] + Math.floor(hashParts(W.seedHash, id, "ltc-tau", i) % 513) - 256;
    tau[i] = clamp(v, 768, 12288);
  }
  const input = controllerArray(LTC_INPUT_BASE, id, "input", a?.input, b?.input);
  if (kind === KINDS.PREDATOR) {
    for (const n of [2, 3, 13, 14, 26, 27]) input[n] = clamp(input[n] + 420, -2560, 2560);
  }
  if (kind === KINDS.HERBIVORE)
    for (const n of [4, 12, 15, 25]) input[n] = clamp(input[n] + 360, -2560, 2560);
  if (kind === KINDS.PERSON) {
    for (const n of [0, 1, 5, 7, 16, 22, 28, 30, 34, 36, 45])
      input[n] = clamp(input[n] + 380, -2560, 2560);
    for (const n of [9, 11, 24, 29, 32, 38, 40]) input[n] = clamp(input[n] + 300, -2560, 2560);
  }
  return {
    version: 2,
    input,
    rec: controllerArray(LTC_REC_BASE, id, "rec", a?.rec, b?.rec),
    out: controllerArray(LTC_OUT_BASE, id, "out", a?.out, b?.out),
    tau,
    leak: new Int16Array([-160, -120, -220, -80, -100, -145, -185, -110]),
    plasticity: clamp(
      Math.round(
        (a?.plasticity || b?.plasticity || 24) +
          (hashParts(W.seedHash, id, "ltc-plasticity") % 9) -
          4,
      ),
      8,
      64,
    ),
  };
}
function resizedTyped(value, T, length) {
  if (value instanceof T && value.length === length) return value;
  const out = new T(length);
  if (value && typeof value.length === "number")
    for (let i = 0; i < Math.min(length, value.length); i++) out[i] = value[i];
  return out;
}
function initCognition(id, parents = []) {
  if (!W.components?.genome?.[id]) return null;
  const g = W.components.genome[id],
    old = g.controller,
    shapeOk =
      old?.version === 2 &&
      old.input?.length === LTC_INPUT_BASE.length &&
      old.rec?.length === LTC_REC_BASE.length &&
      old.out?.length === LTC_OUT_BASE.length &&
      old.tau?.length === LTC_HIDDEN &&
      old.leak?.length === LTC_HIDDEN;
  if (!shapeOk) {
    const upgraded = makeLTCController(id, W.kind[id], parents);
    if (old) {
      for (const key of ["input", "rec", "out", "tau", "leak"]) {
        const src = old[key],
          dst = upgraded[key];
        if (src && dst) for (let i = 0; i < Math.min(src.length, dst.length); i++) dst[i] = src[i];
      }
      if (Number.isFinite(old.plasticity)) upgraded.plasticity = clamp(old.plasticity, 8, 64);
    }
    g.controller = upgraded;
  }
  const store = W.components.cognition || (W.components.cognition = {}),
    fresh = !store[id],
    c =
      store[id] ||
      (store[id] = {
        inputs: new Int16Array(LTC_SENSE_LABELS.length),
        state: new Int16Array(LTC_HIDDEN),
        plastic: new Int16Array(LTC_ACTIONS.length * LTC_OUTPUT_FAN),
        value: new Int16Array(LTC_ACTIONS.length),
        output: new Int16Array(LTC_ACTIONS.length),
        lastTick: W.tick,
        lastAction: -1,
        lastUtility: 0,
        pendingReward: 0,
        lastReward: 0,
        confidence: 0,
        updates: 0,
        influenceCount: 0,
        dominant: "wander",
      });
  c.inputs = resizedTyped(c.inputs, Int16Array, LTC_SENSE_LABELS.length);
  if (fresh && W.kind[id] === KINDS.PERSON) {
    const innate = {
      water: 300,
      flee: 340,
      food: 260,
      socialize: 220,
      work: 240,
      shelter: 160,
      rest: 90,
    };
    for (const [action, value] of Object.entries(innate)) {
      const n = LTC_ACTIONS.indexOf(action);
      if (n >= 0) c.value[n] = value;
    }
  }
  if (fresh && parents.length) {
    const teachers = parents
      .map((parent) => store[parent])
      .filter((t) => t && t.plastic?.length === c.plastic.length);
    if (teachers.length) {
      for (let i = 0; i < c.plastic.length; i++) {
        const t = teachers[hashParts(W.seedHash, id, "ltc-taught", i) % teachers.length];
        c.plastic[i] = clamp(Math.round(t.plastic[i] * 0.6), -LTC_Q, LTC_Q);
      }
      for (let i = 0; i < c.value.length; i++) {
        const t = teachers[hashParts(W.seedHash, id, "ltc-taught-value", i) % teachers.length];
        c.value[i] = clamp(Math.round(c.value[i] * 0.5 + t.value[i] * 0.5), -LTC_Q, LTC_Q);
      }
      c.confidence = Math.round(
        teachers.reduce((sum, t) => sum + (t.confidence || 0), 0) / (teachers.length * 2),
      );
    }
  }
  c.state = resizedTyped(c.state, Int16Array, LTC_HIDDEN);
  c.plastic = resizedTyped(c.plastic, Int16Array, LTC_ACTIONS.length * LTC_OUTPUT_FAN);
  c.value = resizedTyped(c.value, Int16Array, LTC_ACTIONS.length);
  c.output = resizedTyped(c.output, Int16Array, LTC_ACTIONS.length);
  c.lastTick = Number.isFinite(c.lastTick) ? c.lastTick : W.tick;
  c.lastAction = Number.isFinite(c.lastAction) ? c.lastAction : -1;
  c.lastUtility = Number.isFinite(c.lastUtility) ? c.lastUtility : 0;
  c.pendingReward = Number.isFinite(c.pendingReward) ? c.pendingReward : 0;
  c.lastReward = Number.isFinite(c.lastReward) ? c.lastReward : 0;
  c.confidence = Number.isFinite(c.confidence) ? c.confidence : 0;
  c.updates = Number.isFinite(c.updates) ? c.updates : 0;
  c.influenceCount = Number.isFinite(c.influenceCount) ? c.influenceCount : 0;
  c.dominant = c.dominant || "wander";
  return c;
}
const createOrganismCognitionBase = createOrganism;
createOrganism = function (kind, x, y, rng, parents = [], sourceTile = -1, divineInput = 0) {
  const id = createOrganismCognitionBase(kind, x, y, rng, parents, sourceTile, divineInput);
  initCognition(id, parents);
  W.components.work[id] = {
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
  };
  return id;
};
const cloneGenomeCognitionBase = cloneGenome;
cloneGenome = function (g) {
  const q = cloneGenomeCognitionBase(g);
  if (g.controller)
    q.controller = {
      ...g.controller,
      input: new Int16Array(g.controller.input),
      rec: new Int16Array(g.controller.rec),
      out: new Int16Array(g.controller.out),
      tau: new Uint16Array(g.controller.tau),
      leak: new Int16Array(g.controller.leak),
    };
  return q;
};
function cognitionUtilityQ(id) {
  const l = derivedLife(id),
    p = W.components.position[id],
    stress = p ? organismHabitatStress(id, idx(p.x, p.y)) : 100;
  return clamp(
    Math.round(
      ((l.energy * 0.3 +
        l.health * 0.3 +
        (100 - l.thirst) * 0.2 +
        (100 - l.fatigue) * 0.1 +
        (100 - clamp(stress, 0, 100)) * 0.1) *
        LTC_Q) /
        100,
    ),
    0,
    LTC_Q,
  );
}
function cognitionInputs(id) {
  const k = W.kind[id],
    l = derivedLife(id),
    p = W.components.position[id],
    ti = idx(p.x, p.y),
    ph = phenotype(id),
    body = W.components.body[id],
    place = nearestFriendlyPlace(id),
    sense = clamp(Math.round(ph.sense), 4, 10),
    near = nearbyIds(id, sense),
    predatorIds = near.filter((o) => W.kind[o] === KINDS.PREDATOR),
    preyIds = near.filter((o) => W.kind[o] === KINDS.HERBIVORE || W.kind[o] === KINDS.PERSON),
    corpses = near.filter((o) => W.kind[o] === KINDS.CORPSE),
    allies = near.filter((o) => W.kind[o] === k),
    mates = allies.filter((o) => W.components.reproduction[o]?.cooldown === 0),
    nearest = (ids) =>
      ids.length
        ? Math.min(
            ...ids.map((o) =>
              Math.sqrt(dist2(p.x, p.y, W.components.position[o].x, W.components.position[o].y)),
            ),
          )
        : sense,
    closestPred = nearest(predatorIds),
    closestPrey = nearest(preyIds),
    targetVulnerability = preyIds.length
      ? Math.max(...preyIds.map((o) => (100 - derivedLife(o).health) / 100))
      : 0,
    localFood = tileFood(
      ti,
      k === KINDS.PREDATOR ? "predator" : k === KINDS.PERSON ? "omnivore" : "grazer",
    ),
    localHazard = W.tiles.fire[ti] / 5 + W.tiles.danger[ti] / 10 + organismHabitatStress(id, ti),
    localMoist = tileMoisture(ti);
  let bestFood = localFood,
    bestMoist = localMoist,
    safest = localHazard,
    openRoutes = 0;
  for (const d of DIRS.slice(0, 8)) {
    const x = p.x + d[0],
      y = p.y + d[1];
    if (!inside(x, y)) continue;
    const i = idx(x, y),
      haz = W.tiles.fire[i] / 5 + W.tiles.danger[i] / 10 + organismHabitatStress(id, i);
    bestFood = Math.max(
      bestFood,
      tileFood(i, k === KINDS.PREDATOR ? "predator" : k === KINDS.PERSON ? "omnivore" : "grazer"),
    );
    bestMoist = Math.max(bestMoist, tileMoisture(i));
    safest = Math.min(safest, haz);
    if (W.tiles.fire[i] < 180 && W.tiles.liquid[i] < 1050 && haz < localHazard + 30) openRoutes++;
  }
  const threat = clamp(
      W.tiles.fire[ti] / 500 +
        W.tiles.danger[ti] / 1000 +
        tileFear(ti) / 150 +
        (k === KINDS.HERBIVORE ? predatorIds.length * 0.28 : 0),
      0,
      1,
    ),
    workUrgency = k === KINDS.PERSON && place ? clamp(activeBuildings(place).length / 3, 0, 1) : 0,
    home = place ? clamp(Math.sqrt(dist2(p.x, p.y, place.x, place.y)) / 24, 0, 1) : 0,
    stress = clamp(organismHabitatStress(id, ti) / 120, 0, 1),
    shelter = shelterProtectionAt(id, ti),
    severeWeather = W.weather.name === "Storm" || W.weather.name === "Drought" ? 0.25 : 0,
    exposure = clamp(stress + severeWeather - shelter * 0.4, 0, 1),
    fearMemory = Math.max(fearMemoryStrength(id, ti), clamp(tileFear(ti) / 140, 0, 1)),
    values = [
      l.hunger / 100,
      l.thirst / 100,
      l.fatigue / 100,
      (100 - l.health) / 100,
      clamp((100 - l.energy) / 100, 0, 1),
      clamp((1000 - l.integrity) / 1000, 0, 1),
      threat,
      clamp(localFood / 100, 0, 1),
      localMoist / 100,
      clamp(preyIds.length / 5, 0, 1),
      clamp(1 - closestPrey / sense, 0, 1),
      targetVulnerability,
      clamp(predatorIds.length / 4, 0, 1),
      clamp(1 - closestPred / sense, 0, 1),
      clamp(corpses.length / 3, 0, 1),
      tileResource(ti) / 100,
      clamp(allies.length / 6, 0, 1),
      W.components.reproduction[id].cooldown === 0 && l.age > body.maturityAge ? 1 : 0,
      clamp(mates.length / 3, 0, 1),
      home,
      stress,
      workUrgency,
      exposure,
      shelter,
      clamp((bestFood - localFood) / 65, 0, 1),
      clamp((bestMoist - localMoist) / 70, 0, 1),
      clamp((localHazard - safest) / 100, 0, 1),
      openRoutes / 8,
      fearMemory,
      clamp(tileBlood(ti) / 120, 0, 1),
      clamp(W.tiles.fire[ti] / 500, 0, 1),
      clamp(tileDisease(ti) / 120, 0, 1),
    ];
  return Int16Array.from(values.map((v) => clamp(Math.round(v * LTC_Q), 0, LTC_Q)));
}
function fastSigmoidQ(z) {
  return clamp(512 + Math.trunc((512 * z) / (1024 + Math.abs(z))), 0, LTC_Q);
}
function advanceLTC(id) {
  const g = W.components.genome[id],
    c = initCognition(id),
    inputs = cognitionInputs(id),
    dt = clamp(W.tick - c.lastTick, 1, 8),
    utility = cognitionUtilityQ(id),
    reward = clamp((utility - c.lastUtility) * 4 + c.pendingReward, -LTC_Q, LTC_Q);
  c.inputs.set(inputs);
  if (c.lastAction >= 0) {
    const a = c.lastAction,
      rate = g.controller.plasticity;
    c.value[a] = clamp(
      c.value[a] + Math.round((rate * (reward - c.value[a])) / LTC_Q),
      -LTC_Q,
      LTC_Q,
    );
    for (let n = 0; n < LTC_OUTPUT_FAN; n++) {
      const pos = a * LTC_OUTPUT_FAN + n,
        h = (a * 3 + n * 5) % LTC_HIDDEN;
      c.plastic[pos] = clamp(
        c.plastic[pos] + Math.round((rate * reward * c.state[h]) / (LTC_Q * LTC_Q)),
        -384,
        384,
      );
    }
  }
  c.lastReward = reward;
  c.pendingReward = 0;
  c.lastUtility = utility;
  const next = new Int16Array(LTC_HIDDEN);
  for (let h = 0; h < LTC_HIDDEN; h++) {
    let drive = g.controller.leak[h] * 2,
      conductance = 0;
    for (let n = 0; n < LTC_INPUT_FAN; n++) {
      const pos = h * LTC_INPUT_FAN + n,
        w = g.controller.input[pos],
        source = inputs[(pos * 13 + (pos >= inputs.length ? 7 : 0)) % inputs.length];
      drive += Math.round((w * source) / LTC_Q);
      conductance += Math.round((Math.abs(w) * source) / (LTC_Q * 8));
    }
    for (let n = 0; n < LTC_REC_FAN; n++) {
      const w = g.controller.rec[h * LTC_REC_FAN + n],
        source = c.state[(h + n + 1) % LTC_HIDDEN];
      drive += Math.round((w * source) / LTC_Q);
      conductance += Math.round((Math.abs(w) * Math.abs(source)) / (LTC_Q * 8));
    }
    const target = fastSigmoidQ(drive),
      tau = Math.max(512, g.controller.tau[h] - conductance),
      delta = Math.round(((target - c.state[h]) * dt * LTC_Q) / tau);
    next[h] = clamp(c.state[h] + delta, -LTC_Q, LTC_Q);
  }
  c.state.set(next);
  let first = -1e9,
    second = -1e9,
    best = 0;
  for (let a = 0; a < LTC_ACTIONS.length; a++) {
    let raw = c.value[a];
    for (let n = 0; n < LTC_OUTPUT_FAN; n++) {
      const pos = a * LTC_OUTPUT_FAN + n,
        h = (a * 3 + n * 5) % LTC_HIDDEN;
      raw += Math.round(((g.controller.out[pos] + c.plastic[pos]) * c.state[h]) / LTC_Q);
    }
    c.value[a] = clamp(c.value[a], -LTC_Q, LTC_Q);
    const output = clamp(Math.round((LTC_Q * raw) / (LTC_Q + Math.abs(raw))), -LTC_Q, LTC_Q);
    c.output[a] = output;
    if (output > first) {
      second = first;
      first = output;
      best = a;
    } else if (output > second) second = output;
  }
  c.confidence = clamp(first - second, 0, LTC_Q);
  c.dominant = LTC_ACTIONS[best];
  c.lastAction = best;
  c.lastTick = W.tick;
  c.updates++;
  return c;
}
function cognitionBias(id, action) {
  const c = W.components.cognition?.[id],
    n = LTC_ACTIONS.indexOf(action);
  if (!c || n < 0) return 0;
  const bias = ((c.output?.[n] || 0) * 30) / LTC_Q + ((c.value?.[n] || 0) * 10) / LTC_Q,
    l = W.components.life[id];
  if (!l) return bias;
  const survival = action === "food" || action === "water" || action === "flee",
    desperate = l.hunger > 72 || l.thirst > 72;
  if (
    (action === "food" && l.hunger > 72) ||
    (action === "water" && l.thirst > 72) ||
    (action === "flee" && l.threatId)
  )
    return Math.max(0, bias);
  if (desperate && !survival) return Math.min(0, bias);
  return bias;
}
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
  if (!inv || inv[recipe.head] < 2 || inv[recipe.binding] < 2 || toolForPurpose(id, recipe.purpose))
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
  q[recipe.head] = 2;
  q[recipe.binding] = 2;
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
  if (place && functionalToolsAtPlace(place, recipe.purpose).length) return null;
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
    cached = w.resourceSpecies === sp ? w.resourceTile : -1;
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
        score:
          Math.log2(amount + 1) * 12 +
          affinity -
          Math.sqrt(dist2(x, y, p.x, p.y)) * 5 -
          organismHabitatStress(id, i),
      });
    }
  candidates.sort((a, b) => b.score - a.score || a.i - b.i);
  const best = candidates[0]?.i ?? -1;
  w.resourceTile = best;
  w.resourceSpecies = best >= 0 ? sp : -1;
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
    coordinated = concertedIntensity(),
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
    budget = concertedIntensity() ? 32 : 8;
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
  const b = W.buildings.find((x) => x.id === order.buildingId);
  if (!b) return -1e9;
  if (order.type === "salvage") {
    if (ruinRubble(b) <= 0) return -1e9;
    const q = W.components.position[id];
    return (
      70 + order.priority * 18 - Math.sqrt(dist2(q.x, q.y, b.x, b.y)) * 2 - b.id * 0.0001
    );
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
function selectWorkOrder(id, place) {
  const kind = place.knownProcesses ? "settlement" : "camp",
    orders = W.workOrders
      .filter((o) => o.status === "open" && o.placeKind === kind && o.placeId === place.id)
      .map((o) => ({ o, score: orderPriority(o, place, id) }))
      .sort((a, b) => b.score - a.score || a.o.id - b.o.id);
  return orders[0]?.o || null;
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
function placeToolOrderForWorker(id, place) {
  const workers = localPlaceWorkers(place),
    kind = placeKindKey(place);
  if (!workers.includes(id)) return "";
  const claims = (purpose) =>
    W.activeIds
      .filter(
        (pid) =>
          W.kind[pid] === KINDS.PERSON &&
          classifyAlive(pid) &&
          workState(pid).toolOrderPurpose === purpose &&
          workState(pid).toolOrderPlaceKind === kind &&
          workState(pid).toolOrderPlaceId === place.id,
      )
      .sort((a, b) => a - b);
  for (const purpose of ["cut", "mine"])
    if (functionalToolsAtPlace(place, purpose).length)
      for (const pid of claims(purpose)) {
        const state = workState(pid);
        state.toolOrderPurpose = "";
        state.toolOrderRecipe = null;
        state.toolOrderPlaceKind = "";
        state.toolOrderPlaceId = 0;
      }
  for (const purpose of ["cut", "mine"]) {
    if (functionalToolsAtPlace(place, purpose).length) continue;
    const claimant = claims(purpose)[0];
    if (claimant) return claimant === id ? purpose : "";
    const available = workers.find((pid) => !workState(pid).toolOrderPurpose);
    if (available === id) {
      const w = workState(id),
        a = makeArchitectureGenome(place);
      w.toolOrderPurpose = purpose;
      w.toolOrderRecipe = { purpose, head: a.rigid, binding: a.flexible };
      w.toolOrderPlaceKind = kind;
      w.toolOrderPlaceId = place.id;
      return purpose;
    }
    if (available) return "";
  }
  return "";
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
function hasResearchMaterial(place, sp) {
  return (place.researchInventory?.[sp] || 0) >= 10 || (place.inventory?.[sp] || 0) >= 10;
}
function researchMaterialReserve(place, sp) {
  if (!place?.knownProcesses) return 0;
  for (const tech of [...TECH_BASE, ...ADVANCED_TECH_BASE]) {
    if (
      place.knownProcesses.includes(tech.id) ||
      !(tech.prior || []).every((id) => place.knownProcesses.includes(id))
    )
      continue;
    const facility = facilityForTechnology(tech.id);
    if ((!facility || placeHasFacility(place, facility)) && (tech.materials || []).includes(sp))
      return 10;
  }
  return 0;
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
  for (const tech of [...TECH_BASE, ...ADVANCED_TECH_BASE]) {
    if (
      place.knownProcesses.includes(tech.id) ||
      !(tech.prior || []).every((id) => place.knownProcesses.includes(id))
    )
      continue;
    const facility = facilityForTechnology(tech.id);
    if (facility && !placeHasFacility(place, facility)) continue;
    for (const sp of tech.materials || [])
      if (!hasResearchMaterial(place, sp) && !seen.has(sp)) {
        seen.add(sp);
        out.push({ techId: tech.id, sp, target: 10 });
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
    if (!researchMaterialReserve(place, sp) || place.researchInventory[sp] >= 10) continue;
    const amount = Math.min(inv[sp], 10 - place.researchInventory[sp]);
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
      if (missing) add(missing.sp);
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
  if (w.task === "craft" && w.craftPurpose && !w.toolOrderPurpose)
    handled = performCivilLaborSafetyBase(id);
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
    const w = workState(id),
      facility = facilityAssignment(id),
      place = nearestWorkPlace(id),
      continuing = w.task !== "idle" && W.tick - w.handledTick <= 8,
      hasWork = placeNeedsLabor(place),
      workDrive = cognitionBias(id, "work") + cognitionBias(id, "shelter") * 0.35,
      networkChoosesWork = c.dominant === "work" || c.dominant === "shelter" || workDrive > -12,
      assigned = essential.has(id);
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
            food = Math.min(
              4,
              W.tiles.chem[C.ORGANIC][i],
              Math.max(0, 24 - foodMoved),
              Math.max(0, room),
              65535 - s.inventory[C.ORGANIC],
            );
          if (food > 0) {
            W.tiles.chem[C.ORGANIC][i] -= food;
            s.inventory[C.ORGANIC] += food;
            foodMoved += food;
            room -= food;
          }
          const water = Math.min(
            6,
            W.tiles.chem[C.SOLVENT][i],
            Math.max(0, 32 - waterMoved),
            Math.max(0, room),
            65535 - s.inventory[C.SOLVENT],
          );
          if (water > 0) {
            W.tiles.chem[C.SOLVENT][i] -= water;
            s.inventory[C.SOLVENT] += water;
            waterMoved += water;
            room -= water;
          }
        }
    }
    if (placeHasFacility(s, "hearth") && s.inventory[C.FUEL] > 2 && W.tick % 64 === 0) {
      const operator = operateFacility(s, "hearth", "tending a bounded combustion bed", C.FUEL);
      if (operator) {
        const room = placeStorageRemaining(s),
          oxidant = Math.min(3, room, W.tiles.chem[C.OXIDANT][ti], 65535 - s.inventory[C.OXIDANT]);
        W.tiles.chem[C.OXIDANT][ti] -= oxidant;
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
      s.inventory[C.FUEL] > 8 &&
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
    placeCapacity = Math.max(4, Math.floor(biospherePopulation(KINDS.PERSON) / 6));
  for (const c of candidates.slice(0, 2)) {
    if (livePlaceCount >= placeCapacity) break;
    const [ccx, ccy] = xy(c.tile),
      nearPeople = entityAtRadius(c.tile, 22, KINDS.PERSON).filter(classifyAlive).length,
      nearPlaces = [
        ...W.camps.filter((q) => q.active),
        ...W.settlements.filter((q) => !q.ruined),
      ].filter((q) => dist2(q.x, q.y, ccx, ccy) <= 484).length;
    if (nearPlaces >= Math.max(1, Math.floor(nearPeople / 9))) continue;
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
      if (s.factionId) W.components.social[id].factionId = s.factionId;
      const digestive = W.components.inventory[id].digestive,
        body = W.components.chemistry[id].q,
        foodNeed = Math.max(0, 24 - digestive[C.ORGANIC]),
        drinkNeed = Math.max(0, 560 - body[C.SOLVENT]),
        food = Math.min(18, foodNeed, s.inventory[C.ORGANIC], 65535 - digestive[C.ORGANIC]),
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
        const food = Math.min(c.count, s.inventory[C.ORGANIC]),
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
    const tech = [...TECH_BASE, ...ADVANCED_TECH_BASE].find(
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
function facilityForTechnology(id) {
  const declared = technologyDefinition(id)?.facility;
  if (declared) return declared;
  if (id === "controlled_fire" || id === "drying") return "hearth";
  if (
    id === "tools" ||
    id === "masonry" ||
    id === "irrigation" ||
    id === "waterworks" ||
    id === "medicine" ||
    id === "writing" ||
    id === "navigation"
  )
    return "workshop";
  if (id === "ceramics") return "hearth";
  if (id === "metalworking") return "kiln";
  if (id === "sanitation") return "clinic";
  if (id === "governance" || id === "planetary_stewardship") return "archive";
  if (id === "logistics" || id === "public_works") return "hall";
  return null;
}
function researchObservationEvidence(s, tech) {
  s.researchEvidence = s.researchEvidence || {};
  const remembered = (s.researchEvidence[tech.id] || []).filter(Boolean);
  if (remembered.length) return remembered;
  const direct = (tech.observed || []).map((type) => observedNear(s, type)).filter(Boolean);
  if (direct.length) {
    s.researchEvidence[tech.id] = direct;
    return direct;
  }
  const ti = idx(s.x, s.y),
    toolTradition = functionalToolsAtPlace(s, "build").length > 0,
    founding =
      s.importantEvents?.[0] ||
      W.lastEventByType.SettlementFoundedEvent ||
      W.lastEventByType.CampFoundedEvent ||
      0;
  let grounded = false;
  if (tech.id === "controlled_fire" || tech.id === "ceramics")
    grounded = placeHasFacility(s, "hearth");
  else if (tech.id === "drying")
    grounded = W.tiles.temperature[ti] / 10 > 18 || W.weather.name === "Drought";
  else if (tech.id === "agriculture")
    grounded = placeHasFacility(s, "farm") || W.tiles.plantOrder[ti] > 160;
  else if (tech.id === "tools") grounded = toolTradition;
  else if (tech.id === "storage")
    grounded = placeHasFacility(s, "stockpile") && s.knownProcesses.includes("controlled_fire");
  else if (tech.id === "medicine")
    grounded = W.tiles.chem[C.PATHOGEN][ti] > 0 || W.tick - s.foundedTick > 384;
  else if (tech.id === "metalworking")
    grounded = s.knownProcesses.includes("ceramics") && s.inventory[C.ORE] > 0;
  else if (tech.id === "irrigation") grounded = s.knownProcesses.includes("agriculture");
  else if (tech.id === "writing") grounded = !!W.lastEventByType.TechAdvanceEvent;
  else if (tech.id === "fortification")
    grounded =
      placeHasFacility(s, "wall") ||
      s.management?.policy === "fortified" ||
      W.tiles.danger[ti] > 50;
  else if (tech.id === "navigation")
    grounded = W.components.identity[s.founderId]?.migrations > 0 || W.tick - s.foundedTick > 512;
  else if (tech.id === "governance") grounded = !!s.factionId;
  else grounded = !!founding;
  if (grounded && founding) {
    s.researchEvidence[tech.id] = [founding];
    return [founding];
  }
  return [];
}
updateTechnology = function () {
  const catalog = [...TECH_BASE, ...ADVANCED_TECH_BASE];
  for (const s of W.settlements) {
    if (s.ruined || settlementPopulation(s) < 1 || s.stability < 0.2) continue;
    s.researchProgress = s.researchProgress || {};
    for (const tech of catalog) {
      if (
        s.knownProcesses.includes(tech.id) ||
        !(tech.prior || []).every((p) => s.knownProcesses.includes(p)) ||
        !(tech.materials || []).every((m) => hasMaterial(s, m))
      )
        continue;
      const facility = facilityForTechnology(tech.id);
      if (facility && !placeHasFacility(s, facility)) continue;
      const base = TECH_BASE.includes(tech),
        obs = base
          ? (tech.observed || []).map((t) => observedNear(s, t)).filter(Boolean)
          : [s.importantEvents.at(-1) || W.lastEventByType.TechAdvanceEvent || 0];
      if (base && !obs.length) continue;
      if (base && !(tech.structures || []).every((req) => settlementHasStructure(s, req))) continue;
      const temperature = base
        ? settlementTemperatureCapacity(s, tech, obs)
        : s.productionTemperature || 20;
      if (base && temperature < (tech.heat || 0)) continue;
      const faction = W.factions.find((f) => f.id === s.factionId),
        inventive = faction?.ethos.inventive || 0.5,
        pop = settlementPopulation(s),
        knowledgePriority = s.management?.priorities?.knowledge || 2,
        workers = entityAtRadius(idx(s.x, s.y), 8, KINDS.PERSON).filter(
          (id) => workState(id).task === "craft" || W.components.cognition[id]?.dominant === "work",
        ).length,
        rate =
          (pop * 0.18 + workers * 0.8 + knowledgePriority * 0.35) *
          s.stability *
          (0.65 + inventive) *
          W.laws.technologyRate,
        threshold = tech.threshold || 24 + (tech.prior?.length || 0) * 14;
      s.researchProgress[tech.id] = (s.researchProgress[tech.id] || 0) + rate;
      if (s.researchProgress[tech.id] < threshold) continue;
      s.knownProcesses.push(tech.id);
      s.observations.push(...obs);
      const discoverer = entityAtRadius(idx(s.x, s.y), 8, KINDS.PERSON).sort(
          (a, b) =>
            (W.components.cognition[b]?.confidence || 0) +
              phenotype(b).sense -
              (W.components.cognition[a]?.confidence || 0) -
              phenotype(a).sense || a - b,
        )[0],
        ev = emitEvent("TechAdvanceEvent", {
          subjects: [discoverer, s.entityId].filter(Boolean),
          location: idx(s.x, s.y),
          factions: [s.factionId],
          causes: obs,
          evidence: [
            `sustained research reached ${threshold.toFixed(0)} work units`,
            `${(tech.materials || []).map((sp) => W.definitions.species[sp].name).join(" + ")} were available`,
            facility
              ? `${BUILDING_DEFS[facility]?.name || facility} supplied a real workspace`
              : "open-air observation supplied the workspace",
            `knowledge priority ${knowledgePriority}/5`,
          ],
          importance: 4,
          data: {
            name: tech.name,
            process: tech.process || "civic engineering",
            risk: tech.risk || "system complexity",
            settlement: s.name,
          },
        });
      s.importantEvents.push(ev.id);
      W.technologies.push({
        id: W.technologies.length + 1,
        definitionId: tech.id,
        settlementId: s.id,
        discovererId: discoverer,
        tick: W.tick,
        eventId: ev.id,
        temperature: Math.round(temperature),
        structure: [facility].filter(Boolean),
      });
      if (discoverer) {
        W.components.identity[discoverer].significance += 6;
        remember(discoverer, ev.id, "discovery");
      }
      ensurePlacePlans(s);
    }
  }
};
updateTechnology = function () {
  const catalog = [...TECH_BASE, ...ADVANCED_TECH_BASE];
  for (const s of W.settlements) {
    if (s.ruined || settlementPopulation(s) < 1 || s.stability < 0.2) continue;
    s.researchProgress = s.researchProgress || {};
    for (const tech of catalog) {
      if (
        s.knownProcesses.includes(tech.id) ||
        !(tech.prior || []).every((p) => s.knownProcesses.includes(p)) ||
        !(tech.materials || []).every((m) => hasResearchMaterial(s, m))
      )
        continue;
      const facility = facilityForTechnology(tech.id);
      if (facility && !placeHasFacility(s, facility)) continue;
      const base = TECH_BASE.includes(tech),
        obs = base
          ? researchObservationEvidence(s, tech)
          : [s.importantEvents.at(-1) || W.lastEventByType.TechAdvanceEvent || 0].filter(Boolean);
      if (base && !obs.length) continue;
      if (base && !(tech.structures || []).every((req) => settlementHasStructure(s, req))) continue;
      const temperature = base
        ? settlementTemperatureCapacity(s, tech, obs)
        : s.productionTemperature || 20;
      if (base && temperature < (tech.heat || 0)) continue;
      const faction = W.factions.find((f) => f.id === s.factionId),
        inventive = faction?.ethos.inventive || 0.5,
        pop = settlementPopulation(s),
        knowledgePriority = s.management?.priorities?.knowledge || 2,
        workers = entityAtRadius(idx(s.x, s.y), 8, KINDS.PERSON).filter(
          (id) =>
            ["craft", "build"].includes(workState(id).task) ||
            W.components.cognition[id]?.dominant === "work",
        ).length,
        legacy = (W.civilization?.legacyProcesses || []).includes(tech.id),
        ruinMemory =
          legacy &&
          W.settlements.some(
            (ruin) =>
              ruin.ruined &&
              ruin.knownProcesses?.includes(tech.id) &&
              dist2(ruin.x, ruin.y, s.x, s.y) <= 196,
          ),
        rate =
          (pop * 0.18 + workers * 0.8 + knowledgePriority * 0.35) *
          s.stability *
          (0.65 + inventive) *
          W.laws.technologyRate *
          (legacy ? (ruinMemory ? 3 : 1.8) : 1) *
          (concertedIntensity() ? 8 * concertedIntensity() : 1),
        threshold = tech.threshold || 24 + (tech.prior?.length || 0) * 14;
      s.researchProgress[tech.id] = (s.researchProgress[tech.id] || 0) + rate;
      if (s.researchProgress[tech.id] < threshold) continue;
      s.knownProcesses.push(tech.id);
      const civ = (W.civilization = W.civilization || {});
      civ.legacyProcesses = civ.legacyProcesses || [];
      if (!civ.legacyProcesses.includes(tech.id)) {
        civ.legacyProcesses.push(tech.id);
        civ.legacyProcesses.sort();
      }
      s.observations.push(...obs);
      const discoverer = entityAtRadius(idx(s.x, s.y), 8, KINDS.PERSON).sort(
          (a, b) =>
            (W.components.cognition[b]?.confidence || 0) +
              phenotype(b).sense -
              (W.components.cognition[a]?.confidence || 0) -
              phenotype(a).sense || a - b,
        )[0],
        ev = emitEvent("TechAdvanceEvent", {
          subjects: [discoverer, s.entityId].filter(Boolean),
          location: idx(s.x, s.y),
          factions: [s.factionId],
          causes: obs,
          evidence: [
            `sustained research reached ${threshold.toFixed(0)} work units`,
            `${(tech.materials || []).map((sp) => W.definitions.species[sp].name).join(" + ")} were physically stockpiled`,
            facility
              ? `${BUILDING_DEFS[facility]?.name || facility} supplied a real workspace`
              : "open-air observation supplied the workspace",
            legacy
              ? ruinMemory
                ? "surviving practices were studied in the ruins of those who came before"
                : "fragments of a fallen people's knowledge guided the work"
              : `knowledge priority ${knowledgePriority}/5`,
          ],
          importance: 4,
          data: {
            name: tech.name,
            process: tech.process || "civic engineering",
            risk: tech.risk || "system complexity",
            settlement: s.name,
          },
        });
      s.importantEvents.push(ev.id);
      W.technologies.push({
        id: W.technologies.length + 1,
        definitionId: tech.id,
        settlementId: s.id,
        discovererId: discoverer,
        tick: W.tick,
        eventId: ev.id,
        temperature: Math.round(temperature),
        structure: [facility].filter(Boolean),
      });
      if (discoverer) {
        W.components.identity[discoverer].significance += 6;
        remember(discoverer, ev.id, "discovery");
      }
      ensurePlacePlans(s);
    }
  }
};
function shareFactionKnowledge() {
  if (W.tick % 256) return;
  const catalog = [...TECH_BASE, ...ADVANCED_TECH_BASE];
  for (const faction of W.factions) {
    const places = W.settlements
      .filter((s) => !s.ruined && s.factionId === faction.id)
      .sort((a, b) => a.id - b.id);
    if (places.length < 2 || !places.some((s) => s.knownProcesses.includes("writing"))) continue;
    for (const target of places) {
      if (settlementPopulation(target) < 4 || target.stability < 0.2) continue;
      const transferable = catalog.find(
        (tech) =>
          !target.knownProcesses.includes(tech.id) &&
          (tech.prior || []).every((id) => target.knownProcesses.includes(id)) &&
          (tech.materials || []).every((sp) => hasResearchMaterial(target, sp)) &&
          (!facilityForTechnology(tech.id) ||
            placeHasFacility(target, facilityForTechnology(tech.id))) &&
          (!TECH_BASE.includes(tech) ||
            (tech.structures || []).every((req) => settlementHasStructure(target, req))) &&
          places.some((source) => source !== target && source.knownProcesses.includes(tech.id)),
      );
      if (!transferable) continue;
      const source = places.find((s) => s !== target && s.knownProcesses.includes(transferable.id)),
        facility = facilityForTechnology(transferable.id),
        temperature = TECH_BASE.includes(transferable)
          ? settlementTemperatureCapacity(target, transferable, [
              source.importantEvents.at(-1) || 1,
            ])
          : target.productionTemperature || 20;
      if (TECH_BASE.includes(transferable) && temperature < (transferable.heat || 0)) continue;
      target.knownProcesses.push(transferable.id);
      target.researchProgress = target.researchProgress || {};
      target.researchProgress[transferable.id] =
        transferable.threshold || 24 + (transferable.prior?.length || 0) * 14;
      const ev = emitEvent("TechAdvanceEvent", {
        subjects: [source.entityId, target.entityId],
        location: idx(target.x, target.y),
        factions: [faction.id],
        causes: [source.importantEvents.at(-1) || W.lastEventByType.TechAdvanceEvent || 0],
        evidence: [
          `${source.name} transmitted a recorded ${transferable.name} process`,
          `${target.name} held the required physical samples`,
          facility
            ? `${BUILDING_DEFS[facility].name} reproduced the process locally`
            : "local practitioners reproduced the process",
          "knowledge moved; matter did not",
        ],
        importance: 3,
        data: {
          name: transferable.name,
          process: transferable.process || "recorded civic practice",
          settlement: target.name,
          source: source.name,
        },
      });
      target.importantEvents.push(ev.id);
      W.technologies.push({
        id: W.technologies.length + 1,
        definitionId: transferable.id,
        settlementId: target.id,
        discovererId: 0,
        tick: W.tick,
        eventId: ev.id,
        temperature: Math.round(temperature),
        structure: [facility].filter(Boolean),
        transmittedFrom: source.id,
      });
      ensurePlacePlans(target);
    }
  }
}
const updateTechnologyKnowledgeBase = updateTechnology;
updateTechnology = function () {
  updateTechnologyKnowledgeBase();
  shareFactionKnowledge();
  if (W.tick % 256 !== 0) return;
  const culturalArtifacts = W.artifacts.filter((artifact) => !artifact.tool).length;
  if (culturalArtifacts >= 100) return;
  let artifactSlots = 100 - culturalArtifacts;
  for (const settlement of W.settlements.filter(
    (candidate) =>
      !candidate.ruined &&
      candidate.knownProcesses.includes("tools") &&
      candidate.knownProcesses.length >= 3,
  )) {
    if (artifactSlots <= 0) break;
    const maker = entityAtRadius(idx(settlement.x, settlement.y), 7, KINDS.PERSON)
      .filter((id) => peekAlive(id))
      .sort(
        (a, b) =>
          (W.components.identity[b]?.significance || 0) -
            (W.components.identity[a]?.significance || 0) ||
          counterRand("artifact-maker", Math.floor(W.tick / 256), settlement.id, a) -
            counterRand("artifact-maker", Math.floor(W.tick / 256), settlement.id, b) ||
          a - b,
      )[0];
    if (!maker) continue;
    queueEffect(
      "CreateArtifact",
      {
        settlementId: settlement.id,
        creatorId: maker,
        causeEvent: settlement.importantEvents.at(-1) || 0,
      },
      settlement.entityId,
    );
    artifactSlots--;
  }
};
function settlementDevelopmentStage(s) {
  const buildings = completedBuildings(s),
    types = new Set(buildings.map((b) => b.type)),
    tech = new Set(s.knownProcesses),
    pop = settlementPopulation(s),
    network = factionNetworkPopulation(s),
    metro = pop >= 24 || (!!s.factionId && network >= 32 && buildings.length >= 8);
  if (tech.has("planetary_stewardship") && tech.has("mechanization") && types.has("waterworks"))
    return "complex terrestrial";
  if (metro && types.has("hall") && types.has("clinic") && buildings.length >= 8) return "urban";
  if (s.factionId && types.has("hall") && (tech.has("governance") || tech.has("writing")))
    return "civic";
  return "village";
}
function factionNetworkPopulation(s) {
  if (!s?.factionId) return settlementPopulation(s);
  return W.settlements
    .filter((x) => !x.ruined && x.factionId === s.factionId)
    .reduce((n, x) => n + settlementPopulation(x), 0);
}
function settlementStageShortfall(s, target) {
  const complete = completedBuildings(s),
    types = new Set(complete.map((b) => b.type)),
    known = new Set(s.knownProcesses),
    pop = settlementPopulation(s),
    network = factionNetworkPopulation(s),
    reached = ["village", "civic", "urban", "complex terrestrial"],
    missing = [];
  if (target === "village") {
    if (complete.length < 3) missing.push(`completed structures ${complete.length}/3`);
    return missing;
  }
  if (reached.indexOf(settlementDevelopmentStage(s)) >= reached.indexOf(target)) return missing;
  if (target === "civic") {
    if (!s.factionId) missing.push("form a faction");
    if (!types.has("hall")) missing.push("complete a Civic hall");
    if (!known.has("writing") && !known.has("governance"))
      missing.push("develop Polymer Inscription or Recorded Governance");
  } else if (target === "urban") {
    if (!types.has("hall")) missing.push("complete a Civic hall");
    if (!types.has("clinic")) missing.push("complete a Catalytic clinic");
    if (complete.length < 8) missing.push(`completed structures ${complete.length}/8`);
    if (pop < 24 && !(s.factionId && network >= 32))
      missing.push(`local population ${pop}/24 or faction network ${network}/32`);
  } else if (target === "complex terrestrial") {
    if (!known.has("planetary_stewardship")) missing.push("develop Planetary Stewardship");
    if (!known.has("mechanization")) missing.push("develop Terrestrial Mechanization");
    if (!types.has("waterworks")) missing.push("complete Waterworks");
  }
  return missing;
}
function civilizationGateStatus() {
  if (!W) return null;
  const authority = normalizeCivilizationAuthority(),
    next = CIV_STAGE_ORDER[authority.stageIndex + 1];
  if (!next) return null;
  if (next === "sapient foraging") {
    const people = biospherePopulation(KINDS.PERSON);
    return {
      next,
      requirement: "4 living people",
      leader: null,
      missing: people >= 4 ? [] : [`living people ${people}/4`],
    };
  }
  if (next === "tribal") {
    const places = [...W.camps.filter((c) => c.active), ...W.settlements.filter((s) => !s.ruined)],
      scored = places
        .map((place) => {
          const missing = [];
          if (!completedBuildings(place, "shelter").length) missing.push("complete a shelter");
          if (!completedBuildings(place, "stockpile").length)
            missing.push("complete a communal stockpile");
          return { place, missing };
        })
        .sort((a, b) => a.missing.length - b.missing.length || a.place.id - b.place.id),
      best = scored[0],
      missing = best ? best.missing : ["establish a camp"];
    if (!W.artifacts.some((a) => isFunctionalTool(a))) missing.push("craft a functional tool");
    return {
      next,
      requirement: "one place with a completed shelter and stockpile, plus a functional tool",
      leader: best?.place.name || null,
      missing,
    };
  }
  const requirements = {
      village: "one settlement with 3 completed structures",
      civic:
        "one settlement with a faction, a completed Civic hall, and Polymer Inscription or Recorded Governance",
      urban:
        "one settlement with a Civic hall, a Catalytic clinic, 8 completed structures, and 24 local or 32 faction-network people",
      "complex terrestrial":
        "one settlement with Planetary Stewardship, Terrestrial Mechanization, and completed Waterworks",
    },
    settlements = W.settlements.filter((s) => !s.ruined);
  if (!settlements.length)
    return {
      next,
      requirement: requirements[next],
      leader: null,
      missing: ["found a persistent settlement"],
    };
  const scored = settlements
      .map((s) => ({ s, missing: settlementStageShortfall(s, next) }))
      .sort((a, b) => a.missing.length - b.missing.length || a.s.id - b.s.id),
    best = scored[0];
  return { next, requirement: requirements[next], leader: best.s.name, missing: best.missing };
}
function technologyBlockers(s, tech) {
  const blockers = [],
    known = new Set(s.knownProcesses),
    facility = facilityForTechnology(tech.id);
  for (const prior of tech.prior || [])
    if (!known.has(prior))
      blockers.push(`prerequisite ${technologyDefinition(prior)?.name || prior}`);
  for (const sp of tech.materials || [])
    if (!hasResearchMaterial(s, sp))
      blockers.push(`stockpile 10 ${W.definitions.species[sp].name}`);
  if (facility && !placeHasFacility(s, facility)) {
    const project = activeBuildings(s, facility)[0];
    blockers.push(
      project
        ? `${BUILDING_DEFS[facility].name} construction ${Math.round(project.progress * 100)}%`
        : `build ${BUILDING_DEFS[facility]?.name || facility}`,
    );
  }
  if (
    TECH_BASE.includes(tech) &&
    !s.researchEvidence?.[tech.id]?.length &&
    !(tech.observed || []).some((type) => observedNear(s, type))
  )
    blockers.push(`observe ${tech.observed?.join(" or ") || "a reproducible phenomenon"}`);
  if (TECH_BASE.includes(tech))
    for (const req of tech.structures || [])
      if (!settlementHasStructure(s, req)) blockers.push(`arrange ${req}`);
  if (TECH_BASE.includes(tech) && (tech.heat || 0) > 0) {
    const evidence = (s.researchEvidence?.[tech.id] || []).filter(Boolean),
      observed = evidence.length
        ? evidence
        : (tech.observed || []).map((type) => observedNear(s, type)).filter(Boolean),
      temperature = settlementTemperatureCapacity(s, tech, observed);
    if (temperature < tech.heat) blockers.push(`heat ${Math.round(temperature)}°/${tech.heat}°`);
  }
  if (settlementPopulation(s) < 4) blockers.push(`local researchers ${settlementPopulation(s)}/4`);
  if (s.stability < 0.2) blockers.push(`stability ${Math.round(s.stability * 100)}%/20%`);
  return blockers;
}
function civilizationProgressAudit() {
  if (!W) return null;
  initializeSocietyState(W);
  const catalog = [...TECH_BASE, ...ADVANCED_TECH_BASE],
    definitions = [];
  for (const tech of catalog) {
    for (const prior of tech.prior || [])
      if (!catalog.some((x) => x.id === prior))
        definitions.push(`${tech.id}: missing prerequisite definition ${prior}`);
    const facility = facilityForTechnology(tech.id);
    if (facility && !BUILDING_DEFS[facility])
      definitions.push(`${tech.id}: missing facility definition ${facility}`);
  }
  const settlements = W.settlements
    .filter((s) => !s.ruined)
    .map((s) => {
      const complete = completedBuildings(s),
        active = activeBuildings(s),
        types = new Set(complete.map((b) => b.type)),
        localPopulation = settlementPopulation(s),
        networkPopulation = factionNetworkPopulation(s),
        faction = W.factions.find((f) => f.id === s.factionId),
        isCapital = !!faction && faction.capitalSettlementId === s.id,
        stage = settlementDevelopmentStage(s),
        stageBlockers = settlementStageShortfall(
          s,
          { village: "civic", civic: "urban", urban: "complex terrestrial" }[stage] || null,
        );
      const research = catalog
        .filter((t) => !s.knownProcesses.includes(t.id))
        .map((tech) => ({
          id: tech.id,
          name: tech.name,
          progress: +(s.researchProgress?.[tech.id] || 0).toFixed(1),
          threshold: tech.threshold || 24 + (tech.prior?.length || 0) * 14,
          blockers: technologyBlockers(s, tech),
        }));
      return {
        id: s.id,
        name: s.name,
        stage,
        localPopulation,
        networkPopulation,
        isCapital,
        stability: +s.stability.toFixed(3),
        known: s.knownProcesses.slice(),
        complete: complete.map((b) => b.type),
        active: active.map((b) => ({ type: b.type, progress: +b.progress.toFixed(3) })),
        stageBlockers,
        research,
      };
    });
  const next = CIV_STAGE_ORDER[W.civilization.stageIndex + 1] || null;
  return {
    tick: W.tick,
    stage: W.civilization.stage,
    next,
    gate: civilizationGateStatus(),
    definitions,
    settlements,
    matter: auditMatter(),
  };
}
function civilizationStageGate(index) {
  const stage = CIV_STAGE_ORDER[index];
  if (stage === "sapient foraging") return biospherePopulation(KINDS.PERSON) >= 4;
  if (stage === "tribal") {
    const places = [...W.camps.filter((c) => c.active), ...W.settlements.filter((s) => !s.ruined)],
      builtTradition = places.some(
        (place) =>
          completedBuildings(place, "shelter").length &&
          completedBuildings(place, "stockpile").length,
      );
    return builtTradition && W.artifacts.some((a) => isFunctionalTool(a));
  }
  if (stage === "village")
    return W.settlements.some((s) => !s.ruined && completedBuildings(s).length >= 3);
  if (stage === "civic")
    return W.settlements.some(
      (s) =>
        !s.ruined &&
        ["civic", "urban", "complex terrestrial"].includes(settlementDevelopmentStage(s)),
    );
  if (stage === "urban")
    return W.settlements.some(
      (s) => !s.ruined && ["urban", "complex terrestrial"].includes(settlementDevelopmentStage(s)),
    );
  if (stage === "complex terrestrial")
    return W.settlements.some(
      (s) => !s.ruined && settlementDevelopmentStage(s) === "complex terrestrial",
    );
  return true;
}
function updateCivilizationProgression() {
  initializeSocietyState(W);
  for (const s of W.settlements) if (!s.ruined) s.stage = settlementDevelopmentStage(s);
  for (const c of W.camps)
    if (c.active) c.stage = completedBuildings(c, "shelter").length ? "tribal" : "encampment";
  const next = W.civilization.stageIndex + 1;
  if (next < CIV_STAGE_ORDER.length && civilizationStageGate(next)) {
    const prior = W.civilization.stage,
      stage = CIV_STAGE_ORDER[next];
    W.civilization.stage = stage;
    W.civilization.stageIndex = next;
    W.civilization.stageTick = W.tick;
    const ev = emitEvent("StageAdvanceEvent", {
      causes: [
        W.lastEventByType.BuildingCompletedEvent ||
          W.lastEventByType.TechAdvanceEvent ||
          W.biosphere?.emergenceEvents?.at(-1) ||
          0,
      ],
      evidence: [
        `progression advanced from ${prior} to ${stage}`,
        stage === "tribal"
          ? "functional tools, a communal cache, and a completed shelter"
          : "material, demographic, and institutional gates were satisfied",
        "development remains terrestrial; spaceflight is outside this simulation",
      ],
      importance: 5,
      data: { name: titleCase(stage), stage, prior },
    });
    W.civilization.milestones.push({ stage, tick: W.tick, eventId: ev.id });
  }
}
const updateFactionsSocietyBase = updateFactions;
updateFactions = function () {
  updateFactionsSocietyBase();
  updateCivilizationProgression();
};
const updateFactionsProgressionBase = updateFactions;
updateFactions = function () {
  updateFactionsProgressionBase();
  for (let n = 0; n < 2; n++) {
    const before = W.civilization.stageIndex;
    updateCivilizationProgression();
    if (W.civilization.stageIndex === before) break;
  }
};
const epochNameSocietyBase = epochName;
function normalizeCivilizationAuthority(world = W) {
  if (!world?.civilization) return { stage: "multicellular", stageIndex: 0 };
  let index = Number.isInteger(world.civilization.stageIndex)
    ? world.civilization.stageIndex
    : CIV_STAGE_ORDER.indexOf(world.civilization.stage);
  index = clamp(index < 0 ? 0 : index, 0, CIV_STAGE_ORDER.length - 1);
  world.civilization.stageIndex = index;
  world.civilization.stage = CIV_STAGE_ORDER[index];
  return { stage: world.civilization.stage, stageIndex: index };
}
const initializeSocietyStateAuthorityBase = initializeSocietyState;
initializeSocietyState = function (world) {
  const result = initializeSocietyStateAuthorityBase(world);
  normalizeCivilizationAuthority(world);
  return result;
};
epochName = function () {
  if (!W) return epochNameSocietyBase();
  const civilization = normalizeCivilizationAuthority();
  if (civilization.stageIndex > 0) return titleCase(civilization.stage);
  const biosphere = W.biosphere?.stage;
  if (biosphere && biosphere !== "prebiotic") return titleCase(biosphere);
  return epochNameSocietyBase();
};
function civilizationSummary() {
  if (!W) return null;
  const authority = normalizeCivilizationAuthority(),
    workers = { idle: 0, gather: 0, mine: 0, cut: 0, haul: 0, craft: 0, build: 0 };
  for (const id of W.activeIds)
    if (W.kind[id] === KINDS.PERSON) {
      const task = W.components.work?.[id]?.task || "idle";
      workers[task] = (workers[task] || 0) + 1;
    }
  const cognition = W.activeIds.filter((id) => W.components.cognition?.[id]),
    tools = W.artifacts.filter((a) => isFunctionalTool(a));
  return {
    stage: authority.stage,
    stageIndex: authority.stageIndex,
    endpoint: W.civilization.endpoint,
    buildings: {
      planned: W.buildings.filter((b) => !b.complete && !b.ruined).length,
      complete: W.buildings.filter((b) => b.complete && !b.ruined).length,
      ruined: W.buildings.filter((b) => b.ruined).length,
    },
    orders: {
      open: W.workOrders.filter((o) => o.status === "open").length,
      complete: W.workOrders.filter((o) => o.status === "complete").length,
    },
    tools: {
      count: tools.length,
      cut: tools.filter((a) => isFunctionalTool(a, "cut")).length,
      mine: tools.filter((a) => isFunctionalTool(a, "mine")).length,
      build: tools.filter((a) => isFunctionalTool(a, "build")).length,
    },
    workers,
    cognition: {
      agents: cognition.length,
      updates: sum(cognition.map((id) => W.components.cognition[id].updates)),
      influences: sum(cognition.map((id) => W.components.cognition[id].influenceCount)),
      confidence: cognition.length
        ? mean(cognition.map((id) => W.components.cognition[id].confidence)) / LTC_Q
        : 0,
    },
    metrics: { ...W.civicMetrics },
    milestones: W.civilization.milestones.slice(),
  };
}
const recordStatisticsSocietyBase = recordStatistics;
recordStatistics = function () {
  recordStatisticsSocietyBase();
  const h = W.statistics.history.at(-1),
    c = civilizationSummary();
  if (h && c)
    Object.assign(h, {
      buildings: c.buildings.complete,
      projects: c.buildings.planned,
      tools: c.tools.count,
      construction: c.metrics.constructionWork,
      civilization: c.stageIndex,
    });
};
