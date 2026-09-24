// ═══════════════════════════════════════════════════════════════════════════
// 30a. SOCIETY — PLACES: stages, crafts, buildings, plans, camps and towns
// ═══════════════════════════════════════════════════════════════════════════
// The civilisation stages, the base crafts and building definitions, where a
// building may stand and what it needs, planning and completion and collapse,
// the camp and the settlement, and the world hooks that create and restore them.
// This section was one file of four thousand nine hundred lines, 30a-material-
// society.js, split in six along its own seams on 2026-09-14; the composed
// runtime is unchanged, and `scripts/who-overrides.cjs <name>` shows a
// function's layers across them.
const CIV_STAGE_ORDER = Object.freeze([
  "multicellular",
  "sapient foraging",
  "tribal",
  "village",
  "civic",
  "urban",
  "complex terrestrial",
  "orbital",
  "interstellar",
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
    threshold: 44,
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
    threshold: 60,
  },
  {
    id: "public_works",
    name: "Public Works Networks",
    materials: [C.MINERAL, C.INFO],
    prior: ["governance", "logistics", "masonry"],
    facility: "hall",
    threshold: 60,
  },
  {
    id: "planetary_stewardship",
    name: "Planetary Stewardship",
    materials: [C.INFO, C.CATALYST],
    prior: ["waterworks", "sanitation", "navigation", "public_works"],
    facility: "archive",
    threshold: 72,
  },
  {
    id: "astronomy",
    name: "Sky Charts",
    materials: [C.INFO, C.MINERAL],
    prior: ["writing", "navigation"],
    facility: "observatory",
    threshold: 56,
  },
  {
    id: "starflight",
    name: "Starflight",
    materials: [C.METAL, C.FUEL],
    prior: [
      "planetary_stewardship",
      "mechanization",
      "astronomy",
      "combustion",
      "electricity",
      "computing",
    ],
    facility: "launch_tower",
    threshold: 90,
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
  tenement: {
    name: "Tenement",
    work: 168,
    housing: 18,
    storage: 40,
    defense: 3,
    priority: "shelter",
  },
  factory: {
    name: "Factory",
    work: 220,
    housing: 0,
    storage: 200,
    defense: 3,
    priority: "materials",
  },
  tower: {
    name: "Tower block",
    work: 360,
    housing: 36,
    storage: 60,
    defense: 3,
    priority: "shelter",
  },
  office: {
    name: "Office tower",
    work: 420,
    housing: 0,
    storage: 200,
    defense: 3,
    priority: "knowledge",
  },
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
  totem: {
    name: "Spirit post",
    work: 48,
    housing: 0,
    storage: 0,
    defense: 1,
    priority: "governance",
  },
  shrine: {
    name: "Shrine",
    work: 70,
    housing: 0,
    storage: 24,
    defense: 2,
    priority: "governance",
  },
  monument: {
    name: "Monument",
    work: 96,
    housing: 0,
    storage: 0,
    defense: 1,
    priority: "governance",
  },
  dock: {
    name: "Dock",
    work: 58,
    housing: 0,
    storage: 40,
    defense: 1,
    priority: "food",
  },
  waterworks: {
    name: "Waterworks",
    work: 136,
    housing: 0,
    storage: 220,
    defense: 6,
    priority: "water",
  },
  observatory: {
    name: "Observatory",
    work: 150,
    housing: 0,
    storage: 40,
    defense: 2,
    priority: "knowledge",
  },
  launch_tower: {
    name: "Launch tower",
    work: 300,
    housing: 0,
    storage: 80,
    defense: 3,
    priority: "knowledge",
  },
  market: {
    name: "Market",
    work: 90,
    housing: 0,
    storage: 60,
    defense: 0,
    priority: "knowledge",
  },
});
// Later sections extend the tree by pushing definitions into TECH_EXTENSIONS.
const TECH_EXTENSIONS = [];
function techCatalog() {
  return [...TECH_BASE, ...ADVANCED_TECH_BASE, ...TECH_EXTENSIONS];
}
function technologyDefinition(id) {
  return techCatalog().find((t) => t.id === id);
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
// A site is chosen by trying plots one at a time, and every try checked every
// building and field in the world: one search on a grown phone world asked
// 4,007 times of 241 buildings (19-66 ms in one tick). Nothing is built,
// cleared or moved while a search runs, so a search lays the footprints in a
// grid of four-tile cells once (withFootprintIndex, opened round the whole of
// plannedBuildingTile in 138) and each try reads only the cells within reach.
// The answer is the one the full scan gives; the grid is dropped when the
// search ends.
const FOOTPRINT_CELL = 4;
let FOOTPRINT_INDEX = null;
function buildFootprintIndex() {
  const cols = Math.ceil(W.width / FOOTPRINT_CELL) + 1,
    rows = Math.ceil(W.height / FOOTPRINT_CELL) + 1,
    cells = new Array(cols * rows);
  let reach = 1;
  const put = (x, y, record) => {
    const col = clamp(Math.floor(x / FOOTPRINT_CELL), 0, cols - 1),
      row = clamp(Math.floor(y / FOOTPRINT_CELL), 0, rows - 1);
    (cells[row * cols + col] ||= []).push(record);
  };
  for (const building of W.buildings || []) {
    if (building.ruined && sum(Array.from(building.composition || [])) <= 0) continue;
    const r = buildingSpatialRadius(building.type);
    reach = Math.max(reach, r);
    put(building.x, building.y, {
      building: true,
      id: building.id,
      x: building.x,
      y: building.y,
      r,
    });
  }
  for (const field of W.fields || []) {
    if (!Number.isInteger(field.tile)) continue;
    const [fieldX, fieldY] = xy(field.tile);
    put(fieldX, fieldY, { building: false, id: field.id, x: fieldX, y: fieldY, r: 1 });
  }
  return { world: W, cols, rows, cells, reach };
}
function withFootprintIndex(search) {
  if (FOOTPRINT_INDEX && FOOTPRINT_INDEX.world === W) return search();
  FOOTPRINT_INDEX = buildFootprintIndex();
  try {
    return search();
  } finally {
    FOOTPRINT_INDEX = null;
  }
}
function footprintIndexClear(index, x, y, radius, ignoreBuildingId, ignoreFieldId) {
  const reach = radius + index.reach,
    col0 = clamp(Math.floor((x - reach) / FOOTPRINT_CELL), 0, index.cols - 1),
    col1 = clamp(Math.floor((x + reach) / FOOTPRINT_CELL), 0, index.cols - 1),
    row0 = clamp(Math.floor((y - reach) / FOOTPRINT_CELL), 0, index.rows - 1),
    row1 = clamp(Math.floor((y + reach) / FOOTPRINT_CELL), 0, index.rows - 1);
  for (let row = row0; row <= row1; row++)
    for (let col = col0; col <= col1; col++) {
      const cell = index.cells[row * index.cols + col];
      if (!cell) continue;
      for (const o of cell) {
        if (o.building ? o.id === ignoreBuildingId : o.id === ignoreFieldId) continue;
        if (spatialFootprintsOverlap(x, y, radius, o.x, o.y, o.r)) return false;
      }
    }
  return true;
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
  const index = FOOTPRINT_INDEX;
  if (
    index &&
    index.world === W &&
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    Number.isFinite(radius)
  )
    return footprintIndexClear(index, x, y, radius, ignoreBuildingId, ignoreFieldId);
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
            : type === "monument"
              ? 1.6
              : type === "shelter"
                ? 1.15
                : type === "tenement"
                  ? 1.8
                  : type === "factory"
                    ? 2
                    : type === "tower"
                      ? 2.6
                      : type === "office"
                        ? 3
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
  if (type === "shrine") raw.push([C.PIGMENT, 4]);
  if (type === "monument") raw.push([C.PIGMENT, 2]);
  if (type === "dock") raw.push([C.FIBER, 6]);
  if (type === "factory") raw.push([C.METAL, 12], [C.CATALYST, 4]);
  if (type === "tower" || type === "office") raw.push([C.METAL, 24], [C.CATALYST, 6]);
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
    housed = completedBuildings(place, "tenement").length * (BUILDING_DEFS.tenement?.housing || 0),
    desiredShelters = Math.max(
      1,
      Math.ceil(Math.max(0, pop - housed) / (compact ? 8 : 6)) +
        (place.management.policy === "growth" ? 1 : 0),
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
function createCamp(tile, founderId, cause = 0) {
  if (
    W.camps.filter((c) => c.active).length >= CAPS.camp ||
    campNear(tile, 5) ||
    !W.components.social[founderId]
  )
    return null;
  const [x, y] = xy(tile),
    id = allocEntity(KINDS.CAMP),
    r = makeRng(hashParts(W.seedHash, tile, W.tick), "camp-name"),
    name = campName(tile, r),
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
}
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
function createSettlement(campId, cause = 0) {
  const camp = W.camps.find((c) => c.id === campId && c.active);
  if (!camp || W.settlements.filter((s) => !s.ruined).length >= CAPS.settlement) return null;
  const shelter = completedBuildings(camp, "shelter").length,
    stockpile = completedBuildings(camp, "stockpile").length,
    hearth = completedBuildings(camp, "hearth").length;
  if (!shelter || !stockpile || !hearth) return null;
  camp.active = false;
  W.kind[camp.entityId] = KINDS.SETTLEMENT;
  const r = makeRng(hashParts(W.seedHash, camp.id, W.tick), "settlement-name"),
    name = settlementName(camp, r),
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
}
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
