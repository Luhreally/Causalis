// ═══════════════════════════════════════════════════════════════════════════
// 103. SKYLINE — buildings at their true size, and cities that rise
// ═══════════════════════════════════════════════════════════════════════════
// A house was drawn a little over half a tile across and a person, once made
// legible, stood nearly as tall as the eaves. Structures are now drawn two
// fifths larger (walls, fields, corrals, docks, and waterworks keep their
// tile geometry), so a cottage is a cottage beside a person again. And
// cities rise: a city that knows Electricity, Terrestrial Mechanization, and
// masonry and is short of beds raises a Tower block, a residential tower of
// thirty-six homes drawn five to nine storeys high as the city grows; a city
// that knows Computing and keeps a market raises Office towers, seven to
// twelve storeys of glass, one for every thirty people, which quicken its
// inquiry and pay custom into the treasury. Tenements are drawn as the
// three-storey blocks they are. All of them light their windows at night.
// The first tower and the first office are milestones. Rendering only reads.
const STRUCTURE_SCALE = 1.4,
  STRUCTURE_TILE_TYPES = new Set(["wall", "corral", "farm", "dock", "waterworks"]),
  TOWER_HOUSING = 36,
  OFFICE_PER_PEOPLE = 30,
  OFFICE_RESEARCH = 0.08,
  OFFICE_RESEARCH_CAP = 1.24,
  OFFICE_CUSTOM = 2,
  SKYLINE = { blocksDrawn: 0, litWindows: 0, firstTowerWorld: null, firstOfficeWorld: null };
for (const t of ["tower", "office"]) {
  if (typeof LIT_TYPES !== "undefined") LIT_TYPES.add(t);
  if (typeof FAMILY_SPECIAL !== "undefined") FAMILY_SPECIAL.add(t);
}
if (typeof CIVIC_TYPES !== "undefined") CIVIC_TYPES.add("office");
if (typeof HORIZON_CIVIC_TYPES !== "undefined") HORIZON_CIVIC_TYPES.add("office");
// ── Structures at their size ──────────────────────────────────────────────────
const buildingScreenSizeSkylineBase = buildingScreenSize;
buildingScreenSize = function (b, m) {
  const r = buildingScreenSizeSkylineBase(b, m);
  return STRUCTURE_TILE_TYPES.has(b.type) ? r : r * STRUCTURE_SCALE;
};
// ── Cities rise ───────────────────────────────────────────────────────────────
function cityKnows(place, ...techs) {
  return techs.every((t) => knowsTech(place, t));
}
function townHas(place, type, incomplete = false) {
  return W.buildings.some(
    (b) => !b.ruined && b.placeKind === "settlement" && b.placeId === place.id && b.type === type && (incomplete ? !b.complete : true),
  );
}
function wantsTower(place) {
  if (!place?.knownProcesses || place.ruined) return false;
  if (typeof cityStage !== "function" || !cityStage(place)) return false;
  if (!cityKnows(place, "electricity", "mechanization", "masonry")) return false;
  if (typeof housingCapacity !== "function" || housingCapacity(place) >= settlementPopulation(place)) return false;
  return !townHas(place, "tower", true) && !townHas(place, "tenement", true);
}
// A computing city wants an office for every thirty people, and one at least.
function officesWanted(place) {
  return Math.max(1, Math.floor(settlementPopulation(place) / OFFICE_PER_PEOPLE));
}
function wantsOffice(place) {
  if (!place?.knownProcesses || place.ruined) return false;
  if (typeof cityStage !== "function" || !cityStage(place)) return false;
  if (!cityKnows(place, "computing", "electricity") || !placeHasFacility(place, "market")) return false;
  if (townHas(place, "office", true)) return false;
  return completedBuildings(place, "office").length < officesWanted(place);
}
const ensurePlacePlansSkylineBase = ensurePlacePlans;
ensurePlacePlans = function (place) {
  ensurePlacePlansSkylineBase(place);
  if (!place?.knownProcesses || place.ruined) return;
  const active = activeBuildings(place).length;
  if (active < 6 && wantsTower(place))
    planBuilding(place, "tower", (place.management?.priorities?.shelter || 5) + 1);
  if (active < 6 && wantsOffice(place))
    planBuilding(place, "office", Math.max(3, place.management?.priorities?.knowledge || 3));
  if (typeof recordMilestone === "function") {
    if (SKYLINE.firstTowerWorld !== W && completedBuildings(place, "tower").length) {
      SKYLINE.firstTowerWorld = W;
      recordMilestone("first-tower", "the first tower block", place, { evidence: `${TOWER_HOUSING} homes stacked in ${place.name}` });
    }
    if (SKYLINE.firstOfficeWorld !== W && completedBuildings(place, "office").length) {
      SKYLINE.firstOfficeWorld = W;
      recordMilestone("first-office", "the first office tower", place, { evidence: `glass over the market of ${place.name}` });
    }
  }
};
// Offices quicken inquiry and pay custom.
const researchTempoFactorSkylineBase = researchTempoFactor;
researchTempoFactor = function (s) {
  const base = researchTempoFactorSkylineBase(s);
  if (!s?.knownProcesses) return base;
  const offices = completedBuildings(s, "office").length;
  return offices ? base * Math.min(OFFICE_RESEARCH_CAP, 1 + OFFICE_RESEARCH * offices) : base;
};
const collectTaxesSkylineBase = collectTaxes;
collectTaxes = function (f) {
  const coin = collectTaxesSkylineBase(f);
  let custom = 0;
  for (const s of W.settlements)
    if (!s.ruined && s.factionId === f.id) custom += completedBuildings(s, "office").length * OFFICE_CUSTOM;
  if (custom && polityCoins(f)) f.treasury = Math.round((f.treasury + custom) * 10) / 10;
  return coin + custom;
};
// A tower is home like a shelter; an office is entered for work.
function towerAsShelter(building) {
  return { ...building, type: "shelter" };
}
const personMayEnterBuildingSkylineBase = personMayEnterBuilding;
personMayEnterBuilding = function (id, building) {
  return personMayEnterBuildingSkylineBase(id, building?.type === "tower" ? towerAsShelter(building) : building);
};
const preferredReturnBuildingSkylineBase = preferredReturnBuilding;
preferredReturnBuilding = function (id) {
  if (W.kind[id] !== KINDS.PERSON) return preferredReturnBuildingSkylineBase(id);
  const place = nearestFriendlyPlace(id),
    position = W.components.position[id];
  if (!place || !position) return preferredReturnBuildingSkylineBase(id);
  const towers = completedBuildings(place, "tower");
  if (!towers.length) return preferredReturnBuildingSkylineBase(id);
  const other = preferredReturnBuildingSkylineBase(id),
    tower = towers.sort((l, r) => dist2(position.x, position.y, l.x, l.y) - dist2(position.x, position.y, r.x, r.y) || l.id - r.id)[0];
  if (!other || other === place || !["shelter", "tenement"].includes(other.type)) return tower;
  return dist2(position.x, position.y, tower.x, tower.y) <= dist2(position.x, position.y, other.x, other.y) ? tower : other;
};
// ── Rendering: blocks of storeys, glass for offices, lit at night ─────────────
function blockStoreys(b) {
  const place = buildingPlace(b),
    pop = place?.knownProcesses ? settlementPopulation(place) : 0;
  if (b.type === "office") return clamp(7 + Math.floor(pop / 30), 7, 12);
  if (b.type === "tower") return clamp(5 + Math.floor(pop / 40), 5, 9);
  return 3;
}
function drawTowerBlock(g, b, s, r, p, now, detail) {
  const storeys = blockStoreys(b),
    office = b.type === "office",
    hw = r * (office ? 0.62 : 0.7),
    storeyH = r * 0.34,
    h = storeyH * storeys,
    baseY = s.y + r * 0.35,
    topY = baseY - h,
    night = typeof nightStrength === "function" ? nightStrength() : 0,
    concrete = office ? hsl(210, 12, 58) : hsl(28, 14, 60),
    concreteDark = office ? hsl(210, 14, 36) : hsl(28, 16, 38),
    glass = hsl(205, 45, night > 0.3 ? 30 : 72);
  // The body, with a darker side face for depth.
  g.fillStyle = concrete;
  g.strokeStyle = concreteDark;
  g.lineWidth = 1;
  g.beginPath();
  g.rect(s.x - hw, topY, hw * 2, h);
  g.fill();
  g.stroke();
  g.fillStyle = concreteDark;
  g.fillRect(s.x + hw * 0.62, topY, hw * 0.38, h);
  if (detail) {
    // Storey bands, then a window grid; lit windows at night.
    g.strokeStyle = hsl(0, 0, 0, 0.18);
    g.lineWidth = Math.max(0.5, r * 0.02);
    g.beginPath();
    for (let n = 1; n < storeys; n++) {
      const y = topY + storeyH * n;
      g.moveTo(s.x - hw, y);
      g.lineTo(s.x + hw * 0.62, y);
    }
    g.stroke();
    const cols = office ? 4 : 3,
      ww = (hw * 1.62) / (cols * 2 + 1),
      wh = storeyH * 0.5;
    for (let n = 0; n < storeys; n++)
      for (let c = 0; c < cols; c++) {
        const lit = night > 0.3 && visualHash01(b.id * 131 + n * 17 + c, 0x5ea) < 0.55;
        g.fillStyle = lit ? hsl(44, 90, 72, 0.9 * night) : glass;
        g.fillRect(s.x - hw + ww * (2 * c + 1), topY + storeyH * n + storeyH * 0.25, ww, wh);
        if (lit) SKYLINE.litWindows++;
      }
    // Ground floor: a doorway; offices a glass lobby.
    g.fillStyle = office ? hsl(205, 40, 40) : concreteDark;
    g.fillRect(s.x - ww * (office ? 1.6 : 0.55), baseY - storeyH * 0.7, ww * (office ? 3.2 : 1.1), storeyH * 0.7);
    // Roof: plant and aerials on an office, a parapet on a tower.
    g.fillStyle = concreteDark;
    if (office) {
      g.fillRect(s.x - hw * 0.3, topY - r * 0.14, hw * 0.4, r * 0.14);
      g.strokeStyle = "#6f7378";
      g.lineWidth = Math.max(1, r * 0.04);
      g.beginPath();
      g.moveTo(s.x + hw * 0.35, topY);
      g.lineTo(s.x + hw * 0.35, topY - r * 0.45);
      g.stroke();
    } else g.fillRect(s.x - hw, topY - r * 0.05, hw * 1.62, r * 0.05);
  }
  SKYLINE.blocksDrawn++;
  drawBuildingFunctionMarks(g, b, s, r, p, now, detail, { hw, h, baseY, topY });
}
const drawCompletedBuildingSkylineBase = drawCompletedBuilding;
drawCompletedBuilding = function (g, b, s, r, p, now, m) {
  if (b.type === "tower" || b.type === "office" || b.type === "tenement")
    return drawTowerBlock(g, b, s, r, p, now, buildingDetailLevel());
  return drawCompletedBuildingSkylineBase(g, b, s, r, p, now, m);
};
// ── Legends ───────────────────────────────────────────────────────────────────
const renderPlacePageSkylineBase = renderPlacePage;
renderPlacePage = function (id) {
  const html = renderPlacePageSkylineBase(id),
    place = W.settlements.find((s) => s.id === id);
  if (!place?.knownProcesses) return html;
  const towers = completedBuildings(place, "tower").length,
    offices = completedBuildings(place, "office").length;
  if (!towers && !offices) return html;
  const parts = [];
  if (towers) parts.push(`${towers} tower block${towers === 1 ? "" : "s"}`);
  if (offices) parts.push(`${offices} office tower${offices === 1 ? "" : "s"}`);
  const row = `<div class="kv"><span>Skyline</span><b>${esc(parts.join(", "))}</b></div>`,
    at = html.indexOf('<div class="subhead">');
  return at < 0 ? html + row : html.slice(0, at) + row + html.slice(at);
};
window.ALIFE_SKYLINE_DEBUG = Object.freeze({
  structureScale: STRUCTURE_SCALE,
  size: (buildingId) => {
    const b = W.buildings.find((x) => x.id === buildingId);
    return b ? buildingScreenSize(b, projectionMetrics()) : 0;
  },
  wantsTower: (placeId) => wantsTower(W.settlements.find((s) => s.id === placeId)),
  wantsOffice: (placeId) => wantsOffice(W.settlements.find((s) => s.id === placeId)),
  storeys: (buildingId) => {
    const b = W.buildings.find((x) => x.id === buildingId);
    return b ? blockStoreys(b) : 0;
  },
  plan: (placeId) => ensurePlacePlans(W.settlements.find((s) => s.id === placeId)),
  // Raise a finished block at once, for previews and tests: the debug surfaces already
  // pave roads and declare wars; this plans a block and completes it from nothing.
  raise: (placeId, type = "tower") => {
    const s = W.settlements.find((x) => x.id === placeId);
    if (!s || !BUILDING_DEFS[type]) return null;
    const b = planBuilding(s, type, 9) || W.buildings.find((x) => !x.ruined && x.placeKind === "settlement" && x.placeId === s.id && x.type === type && !x.complete);
    if (!b) return null;
    b.complete = true;
    b.stage = 6;
    b.integrity = b.maxIntegrity;
    b.completedTick = W.tick;
    for (const [sp, n] of b.requirements || []) b.composition[sp] = n;
    return { id: b.id, x: b.x, y: b.y, type: b.type };
  },
  counts: () => ({ ...SKYLINE, firstTowerWorld: undefined, firstOfficeWorld: undefined }),
  reset: () => {
    SKYLINE.blocksDrawn = 0;
    SKYLINE.litWindows = 0;
  },
});
