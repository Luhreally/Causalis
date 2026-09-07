// ═══════════════════════════════════════════════════════════════════════════
// 92. TOWNSCAPE — streets, squares, quarters, countryside, and alien forms
// ═══════════════════════════════════════════════════════════════════════════
// Buildings were dropped in a loose spiral round the town centre with no
// streets between them, no square, no quarter, and no countryside, and every
// world's towns were drawn from the same handful of facades. Here each town
// carries a plan. The plan sets a family of forms (the Earth-adjacent seeds
// build in brick, timber, and slate, with a domed hall, a clock tower over the
// archive, and terraces in the cities; other worlds build hives, spires,
// stilts, burrows, lattices, or tessellated slabs), a street pattern (gridded,
// radial, linear, hexagonal, or clustered), a square kept open at the heart,
// and quarters: civic buildings round the square, dwellings in blocks along
// the streets, workshops and furnaces on the town's leeward side, farms and
// pasture in a belt beyond the last houses, and farmsteads out among the far
// fields once a town is large. Streets stay open as buildings go up, feet wear
// them, and a town that knows masonry paves them with mineral from its stores
// into the road ledger. Rendering reads the plan and the family and draws each
// form; it writes nothing.
const TOWN_FAMILIES = Object.freeze(["earthen", "hive", "spire", "stilt", "burrow", "lattice", "tessellated"]),
  FAMILY_PATTERN = Object.freeze({
    earthen: "gridded",
    hive: "radial",
    spire: "radial",
    stilt: "linear",
    burrow: "clustered",
    lattice: "gridded",
    tessellated: "hex",
  }),
  TOWN_SPACING = 3,
  TOWN_SEARCH = 12,
  CIVIC_TYPES = new Set(["hall", "archive", "shrine", "clinic", "market", "monument"]),
  INDUSTRY_TYPES = new Set(["workshop", "kiln", "forge", "hearth", "stockpile"]),
  EDGE_TYPES = new Set(["observatory", "launch_tower"]),
  BASE_SITED_TYPES = new Set(["dock", "waterworks"]),
  FARMSTEAD_POP = 20,
  FARMSTEAD_FARMS = 4,
  STREET_PASS_CADENCE = 256,
  STREET_PASS_OFFSET = 40,
  STREET_TILES_PER_PASS = 8,
  STREET_COST = 1;
function townFamilyFor(place) {
  if (typeof canonicalPlanetSeed === "function" && canonicalPlanetSeed(W.seed)) return "earthen";
  const key = place.cultureId || place.id,
    n = hashParts(W.seedHash, "town-family", key) % (TOWN_FAMILIES.length - 1);
  return TOWN_FAMILIES[1 + n];
}
function townPlan(place) {
  if (!place) return null;
  if (place.plan?.family && FAMILY_PATTERN[place.plan.family]) return place.plan;
  const arch = makeArchitectureGenome(place),
    family = townFamilyFor(place);
  place.plan = {
    version: 1,
    family,
    pattern: FAMILY_PATTERN[family],
    axis: arch.orientation % 4,
    spacing: TOWN_SPACING,
    paved: false,
    pavedTiles: 0,
    nextShelterZone: "",
  };
  arch.family = family;
  return place.plan;
}
function townLocal(place, plan, x, y) {
  const dx = x - place.x,
    dy = y - place.y;
  switch (plan.axis) {
    case 1:
      return [dy, -dx];
    case 2:
      return [-dx, -dy];
    case 3:
      return [-dy, dx];
    default:
      return [dx, dy];
  }
}
const mod = (n, m) => ((n % m) + m) % m;
// The square: the heart of the town stays open.
function isPlazaTile(place, plan, x, y) {
  if (plan.pattern === "clustered") return false;
  const [u, v] = townLocal(place, plan, x, y);
  return Math.max(Math.abs(u), Math.abs(v)) <= 1;
}
// Streets: the lanes a plan keeps clear of buildings.
function isLaneTile(place, plan, x, y) {
  const [u, v] = townLocal(place, plan, x, y),
    s = plan.spacing;
  if (plan.pattern === "gridded") return mod(u, s) === 0 || mod(v, s) === 0;
  if (plan.pattern === "radial") {
    const ring = Math.max(Math.abs(u), Math.abs(v));
    return ring % s === 0 || u === 0 || v === 0 || Math.abs(u) === Math.abs(v);
  }
  if (plan.pattern === "linear") return mod(v, s) === 0;
  if (plan.pattern === "hex") return mod(v, s) === 0 || mod(u + Math.floor(Math.abs(v) / s), 4) === 0;
  return false;
}
function townBuildings(place) {
  const kind = place.knownProcesses ? "settlement" : "camp";
  return W.buildings.filter((b) => !b.ruined && b.placeKind === kind && b.placeId === place.id);
}
// The edge of the built town: the farthest house within a town's reach; a dock
// or a lone hut sited far off by another system does not stretch the belt.
const TOWN_RING_CAP = 8;
function townOuterRing(place, buildings = townBuildings(place)) {
  let ring = 3;
  for (const b of buildings) {
    if (b.type === "farm" || b.type === "corral" || b.type === "wall" || b.type === "dock") continue;
    const d = Math.max(Math.abs(b.x - place.x), Math.abs(b.y - place.y));
    if (d <= TOWN_RING_CAP + 1) ring = Math.max(ring, Math.min(TOWN_RING_CAP, d));
  }
  return ring;
}
function zoneOf(type) {
  if (type === "hall") return "hall";
  if (CIVIC_TYPES.has(type)) return "civic";
  if (INDUSTRY_TYPES.has(type)) return "industry";
  if (EDGE_TYPES.has(type)) return "edge";
  if (type === "farm") return "farm";
  if (type === "corral") return "pasture";
  if (type === "wall") return "wall";
  return "dwelling";
}
// Where a building of this type wants to stand, as a ring round the centre.
function zoneTarget(zone, place, plan, buildings) {
  const outer = townOuterRing(place, buildings);
  if (zone === "hall") return 2;
  if (zone === "civic") return 2.5;
  if (zone === "industry") return Math.max(3, Math.min(outer, 5));
  if (zone === "edge") return outer + 2;
  if (zone === "farm") return outer + 2.5;
  if (zone === "pasture") return outer + 4;
  if (zone === "wall") return outer + 1;
  if (zone === "belt") return outer + 2.5;
  return Math.min(outer + 1, 7);
}
const plannedBuildingTileTownBase = plannedBuildingTile;
plannedBuildingTile = function (place, type, ordinal) {
  if (!place?.knownProcesses || BASE_SITED_TYPES.has(type))
    return plannedBuildingTileTownBase(place, type, ordinal);
  const plan = townPlan(place),
    buildings = townBuildings(place),
    zone = plan.nextShelterZone === "belt" && type === "shelter" ? "belt" : zoneOf(type),
    target = zoneTarget(zone, place, plan, buildings),
    footprint = buildingSpatialRadius(type),
    leeward = (plan.axis + 2) % 4,
    reach = Math.min(TOWN_SEARCH, Math.ceil(target) + 5),
    candidates = [];
  if (zone === "belt") plan.nextShelterZone = "";
  for (let dy = -reach; dy <= reach; dy++)
    for (let dx = -reach; dx <= reach; dx++) {
      const x = place.x + dx,
        y = place.y + dy;
      if (x < 1 || y < 1 || x >= W.width - 1 || y >= W.height - 1) continue;
      if (isPlazaTile(place, plan, x, y)) continue;
      if (zone !== "wall" && isLaneTile(place, plan, x, y)) continue;
      const ring = Math.max(Math.abs(dx), Math.abs(dy));
      let score = -(zone === "wall" ? 6 : 3) * Math.abs(ring - target);
      if (zone === "wall" && isLaneTile(place, plan, x, y)) score -= 1.5;
      if (zone === "industry") {
        const side = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 0 : 2) : dy > 0 ? 1 : 3;
        if (side === leeward) score += 2.5;
      }
      if (zone === "dwelling" || zone === "industry" || zone === "civic")
        for (const b of buildings)
          if (zoneOf(b.type) === zone && Math.max(Math.abs(b.x - x), Math.abs(b.y - y)) <= 2) score += 1.2;
      if (zone === "farm" || zone === "belt")
        for (const b of buildings)
          if (b.type === "farm" && Math.max(Math.abs(b.x - x), Math.abs(b.y - y)) <= 3) score += zone === "belt" ? 2 : 0.6;
      score += (hashParts(W.seedHash, "site", place.id, x, y) % 7) * 0.05;
      candidates.push({ x, y, score });
    }
  candidates.sort((a, b) => b.score - a.score || a.y - b.y || a.x - b.x);
  for (const c of candidates)
    if (developmentFootprintClear(c.x, c.y, footprint) && buildingTerrainFootprintValid(type, c.x, c.y))
      return [c.x, c.y];
  return plannedBuildingTileTownBase(place, type, ordinal);
};
// Farmsteads: a large town's far fields get a house beside them.
const ensurePlacePlansTownBase = ensurePlacePlans;
ensurePlacePlans = function (place) {
  ensurePlacePlansTownBase(place);
  if (!place?.knownProcesses || place.ruined) return;
  const plan = townPlan(place),
    buildings = townBuildings(place),
    farms = buildings.filter((b) => b.type === "farm"),
    outer = townOuterRing(place, buildings);
  if (settlementPopulation(place) < FARMSTEAD_POP || farms.length < FARMSTEAD_FARMS) return;
  const farmsteads = buildings.filter(
    (b) => b.type === "shelter" && Math.max(Math.abs(b.x - place.x), Math.abs(b.y - place.y)) >= outer + 1,
  ).length;
  if (farmsteads >= Math.floor(farms.length / 3)) return;
  if (buildings.some((b) => b.type === "shelter" && !b.complete)) return;
  plan.nextShelterZone = "belt";
  planBuilding(place, "shelter", 2);
  plan.nextShelterZone = "";
};
// ── Paved streets ─────────────────────────────────────────────────────────────
function paveStreets(place) {
  const plan = townPlan(place),
    buildings = townBuildings(place).filter((b) => b.complete);
  if (!place.knownProcesses.includes("masonry") && !place.knownProcesses.includes("road_building")) return 0;
  if (typeof ensureRoads !== "function") return 0;
  ensureRoads();
  const outer = townOuterRing(place, buildings),
    road = W.tiles.road;
  let laid = 0;
  for (let dy = -outer; dy <= outer && laid < STREET_TILES_PER_PASS; dy++)
    for (let dx = -outer; dx <= outer && laid < STREET_TILES_PER_PASS; dx++) {
      const x = place.x + dx,
        y = place.y + dy;
      if (!inside(x, y)) continue;
      const tile = idx(x, y);
      if (road[tile] || W.tiles.liquid[tile] > 140) continue;
      if (!isPlazaTile(place, plan, x, y) && !isLaneTile(place, plan, x, y)) continue;
      let neighbours = 0;
      for (const b of buildings) if (Math.max(Math.abs(b.x - x), Math.abs(b.y - y)) <= 1) neighbours++;
      if (neighbours < 2) continue;
      if ((place.inventory[C.MINERAL] || 0) < STREET_COST) return laid;
      place.inventory[C.MINERAL] -= STREET_COST;
      W.roads.matter[C.MINERAL] += STREET_COST;
      road[tile] = 1;
      plan.pavedTiles++;
      laid++;
    }
  if (laid && !plan.paved) {
    plan.paved = true;
    emitEvent("StreetsPavedEvent", {
      subjects: [place.entityId],
      location: idx(place.x, place.y),
      factions: place.factionId ? [place.factionId] : [],
      causes: [W.lastEventByType.TechAdvanceEvent, W.lastEventByType.BuildingCompletedEvent].filter(Boolean),
      evidence: [`${plan.pattern} streets`, `${buildings.length} buildings stand`],
      importance: 3,
      data: { place: place.name, pattern: plan.pattern, family: plan.family },
    });
    if (typeof recordMilestone === "function")
      recordMilestone("first-streets", `${place.name} paved its streets`, place, { evidence: `${plan.pattern} streets` });
  }
  return laid;
}
function updateStreets() {
  if (W.tick % STREET_PASS_CADENCE !== STREET_PASS_OFFSET) return;
  for (const s of W.settlements) if (!s.ruined && s.knownProcesses) paveStreets(s);
}
const simTickTownBase = simTick;
simTick = function () {
  simTickTownBase();
  if (W?.settlements) updateStreets();
};
const eventSentenceTownBase = eventSentence;
eventSentence = function (e) {
  if (e.type === "StreetsPavedEvent") return `${e.data?.place} paved its ${e.data?.pattern} streets.`;
  return eventSentenceTownBase(e);
};
const renderPlacePageTownBase = renderPlacePage;
renderPlacePage = function (id) {
  const html = renderPlacePageTownBase(id),
    s = W.settlements.find((x) => x.id === id);
  if (!s?.knownProcesses) return html;
  const plan = townPlan(s),
    row = `<div class="kv"><span>Townscape</span><b>${esc(plan.family)} forms · ${esc(plan.pattern)} streets${plan.paved ? ` · ${plan.pavedTiles} paved` : ""}</b></div>`,
    at = html.indexOf('<div class="subhead">');
  return at < 0 ? html + row : html.slice(0, at) + row + html.slice(at);
};
// ── The families of form ──────────────────────────────────────────────────────
const familyCache = { world: null, frame: -1, byPlace: new Map() };
function buildingFamily(b) {
  if (b.architecture?.family && FAMILY_PATTERN[b.architecture.family]) return b.architecture.family;
  const key = `${b.placeKind}:${b.placeId}`;
  if (familyCache.world !== W || familyCache.frame !== W.tick) {
    familyCache.world = W;
    familyCache.frame = W.tick;
    familyCache.byPlace.clear();
  }
  let f = familyCache.byPlace.get(key);
  if (!f) {
    const place = b.placeKind === "settlement" ? W.settlements.find((s) => s.id === b.placeId) : W.camps.find((c) => c.id === b.placeId);
    f = place?.plan?.family && FAMILY_PATTERN[place.plan.family] ? place.plan.family : place ? townFamilyFor(place) : "earthen";
    familyCache.byPlace.set(key, f);
  }
  return f;
}
const FAMILY_SPECIAL = new Set(["wall", "stockpile", "waterworks", "shrine", "monument", "dock", "observatory", "launch_tower", "market", "corral", "farm"]);
function townIsUrban(b) {
  if (b.placeKind !== "settlement") return false;
  const s = W.settlements.find((x) => x.id === b.placeId);
  return !!s && ["urban", "complex terrestrial"].includes(s.stage || "");
}
function facadeGeometry(s, r, tall, wide) {
  const hw = r * 0.82 * wide,
    h = r * 0.78 * tall,
    baseY = s.y + r * 0.35,
    topY = baseY - h;
  return { hw, h, baseY, topY, facade: { x: s.x - hw, y: topY, w: hw * 2, h } };
}
function drawEarthen(g, b, s, r, p, now, detail) {
  const type = b.type,
    urban = townIsUrban(b),
    tall = type === "hall" ? 1.35 : type === "archive" ? 1.9 : type === "clinic" ? 1.1 : type === "hearth" ? 0.45 : urban && type === "shelter" ? 1.15 : 1,
    wide = type === "hall" ? 1.25 : urban && type === "shelter" ? 1.3 : 1,
    { hw, h, baseY, topY, facade } = facadeGeometry(s, r, tall, wide),
    brick = hsl(14, 42, 44),
    brickDark = hsl(12, 40, 26),
    slate = hsl(212, 12, 34),
    slateLight = hsl(212, 10, 46);
  g.lineWidth = 1;
  g.strokeStyle = brickDark;
  g.fillStyle = type === "hall" || type === "archive" ? hsl(38, 22, 66) : brick;
  g.beginPath();
  g.rect(facade.x, facade.y, facade.w, facade.h);
  g.fill();
  g.stroke();
  if (detail) {
    // Brick courses, then windows and a door.
    g.save();
    g.beginPath();
    g.rect(facade.x, facade.y, facade.w, facade.h);
    g.clip();
    g.strokeStyle = brickDark;
    g.globalAlpha = 0.35;
    g.lineWidth = Math.max(0.5, h * 0.015);
    g.beginPath();
    const rows = detail > 1 ? 7 : 4;
    for (let n = 1; n < rows; n++) {
      const y = facade.y + (facade.h * n) / rows;
      g.moveTo(facade.x, y);
      g.lineTo(facade.x + facade.w, y);
    }
    g.stroke();
    g.restore();
    const cols = urban && type === "shelter" ? 3 : type === "hall" ? 3 : 2,
      ww = facade.w / (cols * 2 + 1),
      wh = h * 0.22;
    g.fillStyle = hsl(205, 30, 78, 0.9);
    for (let c = 0; c < cols; c++) g.fillRect(facade.x + ww * (2 * c + 1), topY + h * 0.22, ww, wh);
    g.fillStyle = brickDark;
    g.fillRect(s.x - ww * 0.45, baseY - h * 0.38, ww * 0.9, h * 0.38);
    if (urban && type === "shelter") g.fillRect(facade.x + ww * 0.8, baseY - h * 0.38, ww * 0.9, h * 0.38);
  }
  // Roofs: pitched slate with a chimney; a dome and lantern on the hall; a clock tower on the archive.
  g.fillStyle = slate;
  g.strokeStyle = brickDark;
  if (type === "hall") {
    g.beginPath();
    g.rect(facade.x - hw * 0.08, topY - h * 0.12, facade.w + hw * 0.16, h * 0.12);
    g.fill();
    g.stroke();
    g.fillStyle = slateLight;
    g.beginPath();
    g.ellipse(s.x, topY - h * 0.12, hw * 0.55, h * 0.45, 0, Math.PI, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = hsl(44, 60, 70);
    g.beginPath();
    g.moveTo(s.x - hw * 0.1, topY - h * 0.55);
    g.lineTo(s.x, topY - h * 0.95);
    g.lineTo(s.x + hw * 0.1, topY - h * 0.55);
    g.closePath();
    g.fill();
    g.stroke();
  } else if (type === "archive") {
    g.beginPath();
    g.moveTo(facade.x - hw * 0.1, topY);
    g.lineTo(s.x, topY - h * 0.28);
    g.lineTo(facade.x + facade.w + hw * 0.1, topY);
    g.closePath();
    g.fill();
    g.stroke();
    if (detail) {
      // The clock face.
      g.fillStyle = hsl(44, 45, 82);
      g.beginPath();
      g.arc(s.x, topY + h * 0.14, Math.max(1.5, hw * 0.22), 0, Math.PI * 2);
      g.fill();
      g.stroke();
      const a = ACTIVE_REDUCED_MOTION ? 0 : (now * 0.0004) % (Math.PI * 2);
      g.beginPath();
      g.moveTo(s.x, topY + h * 0.14);
      g.lineTo(s.x + Math.cos(a) * hw * 0.16, topY + h * 0.14 + Math.sin(a) * hw * 0.16);
      g.stroke();
    }
  } else {
    g.beginPath();
    g.moveTo(facade.x - hw * 0.1, topY + r * 0.04);
    g.lineTo(s.x, topY - r * 0.42);
    g.lineTo(facade.x + facade.w + hw * 0.1, topY + r * 0.04);
    g.closePath();
    g.fill();
    g.stroke();
    if (detail && type !== "hearth") {
      g.fillStyle = brickDark;
      g.fillRect(s.x + hw * 0.4, topY - r * 0.36, Math.max(1, hw * 0.16), r * 0.3);
    }
  }
  drawBuildingFunctionMarks(g, b, s, r, p, now, detail, { hw, h, baseY, topY });
  if (detail && b.integrity < b.maxIntegrity * 0.5) drawBuildingCracks(g, b, facade);
}
function drawHive(g, b, s, r, p, now, detail) {
  const type = b.type,
    big = type === "hall" || type === "archive",
    hw = r * (big ? 1.1 : 0.85),
    h = r * (big ? 1.2 : 0.8),
    baseY = s.y + r * 0.35,
    topY = baseY - h;
  g.fillStyle = p.base;
  g.strokeStyle = p.dark;
  g.lineWidth = 1;
  g.beginPath();
  g.ellipse(s.x, baseY, hw, h, 0, Math.PI, Math.PI * 2);
  g.fill();
  g.stroke();
  if (detail) {
    g.strokeStyle = p.dark;
    g.globalAlpha = 0.45;
    for (let n = 1; n <= (big ? 3 : 2); n++) {
      g.beginPath();
      g.ellipse(s.x, baseY, hw * (1 - n * 0.22), h * (1 - n * 0.22), 0, Math.PI, Math.PI * 2);
      g.stroke();
    }
    g.globalAlpha = 1;
    g.fillStyle = hsl(ACTIVE_PLANET_VISUAL?.accentHue ?? 40, 70, 60, 0.85);
    const pores = big ? 4 : 2;
    for (let n = 0; n < pores; n++) {
      const a = Math.PI * (0.25 + (0.5 * (n + 0.5)) / pores);
      g.beginPath();
      g.arc(s.x + Math.cos(a) * hw * 0.55, baseY - Math.sin(a) * h * 0.55, Math.max(1, r * 0.09), 0, Math.PI * 2);
      g.fill();
    }
  }
  drawBuildingFunctionMarks(g, b, s, r, p, now, detail, { hw, h, baseY, topY });
}
function drawSpire(g, b, s, r, p, now, detail) {
  const type = b.type,
    big = type === "hall" || type === "archive",
    count = big ? 3 : 1,
    baseY = s.y + r * 0.35;
  g.strokeStyle = p.dark;
  g.lineWidth = 1;
  for (let n = 0; n < count; n++) {
    const off = (n - (count - 1) / 2) * r * 0.7,
      hw = r * (big && n === 1 ? 0.42 : 0.3),
      h = r * (big && n === 1 ? 2.2 : big ? 1.5 : 1.4),
      topY = baseY - h;
    g.fillStyle = n % 2 ? p.light : p.base;
    g.beginPath();
    g.moveTo(s.x + off - hw, baseY);
    g.lineTo(s.x + off - hw * 0.45, topY + h * 0.18);
    g.lineTo(s.x + off, topY);
    g.lineTo(s.x + off + hw * 0.45, topY + h * 0.18);
    g.lineTo(s.x + off + hw, baseY);
    g.closePath();
    g.fill();
    g.stroke();
    if (detail) {
      g.fillStyle = hsl(ACTIVE_PLANET_VISUAL?.accentHue ?? 190, 80, 78, 0.8);
      g.beginPath();
      g.moveTo(s.x + off, topY);
      g.lineTo(s.x + off + hw * 0.45, topY + h * 0.18);
      g.lineTo(s.x + off, topY + h * 0.3);
      g.closePath();
      g.fill();
    }
  }
  const hw = r * 0.8,
    h = r * 1.4;
  drawBuildingFunctionMarks(g, b, s, r, p, now, detail, { hw, h, baseY, topY: baseY - h });
}
function drawStilt(g, b, s, r, p, now, detail) {
  const type = b.type,
    big = type === "hall" || type === "archive",
    hw = r * (big ? 1.2 : 0.8),
    legH = r * 0.55,
    hutH = r * (big ? 0.7 : 0.55),
    baseY = s.y + r * 0.35,
    deckY = baseY - legH,
    topY = deckY - hutH;
  g.strokeStyle = p.dark;
  g.lineWidth = Math.max(1, r * 0.08);
  g.beginPath();
  for (const x of big ? [-0.9, -0.3, 0.3, 0.9] : [-0.7, 0.7]) {
    g.moveTo(s.x + hw * x, baseY);
    g.lineTo(s.x + hw * x, deckY);
  }
  g.stroke();
  g.lineWidth = 1;
  g.fillStyle = p.dark;
  g.fillRect(s.x - hw, deckY - r * 0.08, hw * 2, r * 0.12);
  g.fillStyle = p.base;
  g.beginPath();
  g.rect(s.x - hw * 0.75, topY, hw * 1.5, hutH);
  g.fill();
  g.stroke();
  g.fillStyle = p.light;
  g.beginPath();
  g.ellipse(s.x, topY, hw * 0.85, hutH * 0.45, 0, Math.PI, Math.PI * 2);
  g.fill();
  g.stroke();
  if (detail) {
    g.strokeStyle = p.dark;
    g.globalAlpha = 0.5;
    g.beginPath();
    for (let n = 1; n < 4; n++) {
      g.moveTo(s.x - hw * 0.75, topY + (hutH * n) / 4);
      g.lineTo(s.x + hw * 0.75, topY + (hutH * n) / 4);
    }
    g.stroke();
    g.globalAlpha = 1;
  }
  drawBuildingFunctionMarks(g, b, s, r, p, now, detail, { hw, h: legH + hutH, baseY, topY });
}
function drawBurrow(g, b, s, r, p, now, detail) {
  const type = b.type,
    big = type === "hall" || type === "archive",
    hw = r * (big ? 1.2 : 0.85),
    baseY = s.y + r * 0.35,
    rim = r * (big ? 0.28 : 0.2),
    topY = baseY - rim - r * 0.3;
  g.strokeStyle = p.dark;
  g.lineWidth = 1;
  g.fillStyle = p.dark;
  g.beginPath();
  g.ellipse(s.x, baseY, hw, hw * 0.45, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = p.base;
  g.beginPath();
  g.ellipse(s.x, baseY - rim * 0.5, hw * 1.05, hw * 0.5, 0, Math.PI, Math.PI * 2);
  g.fill();
  g.stroke();
  g.fillStyle = hsl(0, 0, 8, 0.85);
  g.beginPath();
  g.ellipse(s.x, baseY - rim * 0.2, hw * 0.55, hw * 0.24, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = p.light;
  g.beginPath();
  g.ellipse(s.x - hw * 0.35, baseY - rim, hw * 0.35, r * 0.3, 0, Math.PI, Math.PI * 2);
  g.fill();
  g.stroke();
  if (detail && big) {
    g.strokeStyle = p.dark;
    g.globalAlpha = 0.5;
    for (let n = 1; n <= 2; n++) {
      g.beginPath();
      g.ellipse(s.x, baseY, hw * (1 + n * 0.18), hw * 0.45 * (1 + n * 0.18), 0, 0, Math.PI * 2);
      g.stroke();
    }
    g.globalAlpha = 1;
  }
  drawBuildingFunctionMarks(g, b, s, r, p, now, detail, { hw, h: rim + r * 0.3, baseY, topY });
}
function drawLattice(g, b, s, r, p, now, detail) {
  const type = b.type,
    big = type === "hall" || type === "archive",
    hw = r * (big ? 1.05 : 0.8),
    h = r * (big ? 1.7 : 1.1),
    baseY = s.y + r * 0.35,
    topY = baseY - h;
  g.strokeStyle = p.dark;
  g.lineWidth = Math.max(1, r * 0.07);
  g.beginPath();
  g.rect(s.x - hw, topY, hw * 2, h);
  g.moveTo(s.x - hw, topY);
  g.lineTo(s.x + hw, baseY);
  g.moveTo(s.x + hw, topY);
  g.lineTo(s.x - hw, baseY);
  g.moveTo(s.x - hw, baseY - h * 0.5);
  g.lineTo(s.x + hw, baseY - h * 0.5);
  g.stroke();
  g.lineWidth = 1;
  const pods = big ? 3 : 2;
  for (let n = 0; n < pods; n++) {
    const px = s.x + (n - (pods - 1) / 2) * hw * 0.9,
      py = topY + h * (0.35 + 0.25 * (n % 2));
    g.fillStyle = n % 2 ? p.light : p.base;
    g.beginPath();
    g.ellipse(px, py, hw * 0.3, h * 0.2, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    if (detail) {
      g.beginPath();
      g.moveTo(px, topY);
      g.lineTo(px, py - h * 0.2);
      g.stroke();
    }
  }
  drawBuildingFunctionMarks(g, b, s, r, p, now, detail, { hw, h, baseY, topY });
}
function hexPath(g, cx, cy, rad, squash) {
  g.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = Math.PI / 6 + (k * Math.PI) / 3,
      x = cx + Math.cos(a) * rad,
      y = cy + Math.sin(a) * rad * squash;
    if (k === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
}
function drawTessellated(g, b, s, r, p, now, detail) {
  const type = b.type,
    big = type === "hall" || type === "archive",
    tiers = big ? 3 : 2,
    baseY = s.y + r * 0.35,
    rad = r * (big ? 1.15 : 0.85),
    step = r * 0.32;
  g.strokeStyle = p.dark;
  g.lineWidth = 1;
  for (let t = 0; t < tiers; t++) {
    const cy = baseY - t * step,
      rr = rad * (1 - t * 0.22);
    g.fillStyle = t % 2 ? p.light : p.base;
    // The slab's side, then its top.
    g.fillRect(s.x - rr * 0.87, cy - step, rr * 1.73, step);
    g.strokeRect(s.x - rr * 0.87, cy - step, rr * 1.73, step);
    hexPath(g, s.x, cy - step, rr, 0.5);
    g.fill();
    g.stroke();
  }
  if (detail) {
    g.fillStyle = hsl(ACTIVE_PLANET_VISUAL?.accentHue ?? 40, 60, 62, 0.8);
    hexPath(g, s.x, baseY - tiers * step, rad * 0.22, 0.5);
    g.fill();
  }
  const h = tiers * step + r * 0.2;
  drawBuildingFunctionMarks(g, b, s, r, p, now, detail, { hw: rad * 0.87, h, baseY, topY: baseY - h });
}
const drawCompletedBuildingTownBase = drawCompletedBuilding;
drawCompletedBuilding = function (g, b, s, r, p, now, m) {
  if (FAMILY_SPECIAL.has(b.type)) return drawCompletedBuildingTownBase(g, b, s, r, p, now, m);
  const family = buildingFamily(b),
    detail = buildingDetailLevel();
  if (family === "earthen") return drawEarthen(g, b, s, r, p, now, detail);
  if (family === "hive") return drawHive(g, b, s, r, p, now, detail);
  if (family === "spire") return drawSpire(g, b, s, r, p, now, detail);
  if (family === "stilt") return drawStilt(g, b, s, r, p, now, detail);
  if (family === "burrow") return drawBurrow(g, b, s, r, p, now, detail);
  if (family === "lattice") return drawLattice(g, b, s, r, p, now, detail);
  if (family === "tessellated") return drawTessellated(g, b, s, r, p, now, detail);
  return drawCompletedBuildingTownBase(g, b, s, r, p, now, m);
};
window.ALIFE_TOWNSCAPE_DEBUG = Object.freeze({
  families: () => TOWN_FAMILIES.slice(),
  plan: (placeId) => {
    const s = W.settlements.find((x) => x.id === placeId);
    return s ? { ...townPlan(s) } : null;
  },
  family: (placeId) => {
    const s = W.settlements.find((x) => x.id === placeId);
    return s ? townPlan(s).family : null;
  },
  lane: (placeId, x, y) => {
    const s = W.settlements.find((x2) => x2.id === placeId);
    return s ? isLaneTile(s, townPlan(s), x, y) : null;
  },
  plaza: (placeId, x, y) => {
    const s = W.settlements.find((x2) => x2.id === placeId);
    return s ? isPlazaTile(s, townPlan(s), x, y) : null;
  },
  zone: (type) => zoneOf(type),
  outer: (placeId) => {
    const s = W.settlements.find((x) => x.id === placeId);
    return s ? townOuterRing(s) : null;
  },
  site: (placeId, type, ordinal = 0) => {
    const s = W.settlements.find((x) => x.id === placeId);
    return s ? plannedBuildingTile(s, type, ordinal) : null;
  },
  pave: (placeId) => {
    const s = W.settlements.find((x) => x.id === placeId);
    return s ? paveStreets(s) : 0;
  },
  setFamily: (placeId, family) => {
    const s = W.settlements.find((x) => x.id === placeId);
    if (!s || !FAMILY_PATTERN[family]) return null;
    townPlan(s);
    s.plan.family = family;
    s.plan.pattern = FAMILY_PATTERN[family];
    makeArchitectureGenome(s).family = family;
    for (const b of townBuildings(s)) if (b.architecture) b.architecture.family = family;
    return { ...s.plan };
  },
});
