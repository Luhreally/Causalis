// ═══════════════════════════════════════════════════════════════════════════
// 105. GHOST TOWNS — a fallen town stands empty, weathers, and is cleared or reclaimed
// ═══════════════════════════════════════════════════════════════════════════
// When a town fell, every building it had fell with it in the same tick, and
// the rubble lay where it fell for ever: it was drawn even when the last of
// it had been carried off, and new houses were planned straight on top of the
// stones. Now a town that falls stands empty. Its finished buildings are
// abandoned rather than collapsed: they keep their walls and their solid
// bodies, lose their lights, and are drawn bleached of their colour, cracked
// and grown over as they age. Each empty building weathers
// year by year at a rate set by the hardness of what it was built from, and
// falls to rubble when its integrity is gone, so a fibre hut is bare ground
// within a couple of decades while a stone hall stands for a generation. Rubble
// weathers too: a share of it sinks into the tile's conserved ground matter
// every year, the pile is drawn smaller and greener as it goes, and when the
// last of it is gone the ruin is cleared and no longer drawn at all. A living
// town pulls down the rubble within its reach before it builds, and planning
// a building over an emptied ruin clears that ruin from the ground. Settlers
// who found a town on a ghost town take its standing buildings for their own.
// All of it is chronicled. Rendering only reads.
const GHOST_LIFE_MIN_YEARS = 4,
  GHOST_LIFE_HARD_YEARS = 28,
  GHOST_RECLAIM_REACH = 7,
  RUBBLE_WEATHER_SHARE = 0.15,
  RUINS_TICK = 152,
  BLOCK_TYPES = new Set(["tower", "office", "tenement"]),
  RUINS = { ghostsDrawn: 0, weatheredDrawn: 0, skipped: 0 };
let RUINING_PLACE = null,
  ACTIVE_GHOST = null;
function ghostBuildings(placeId) {
  return W.buildings.filter(
    (b) => b.abandoned && !b.ruined && b.complete && b.placeKind === "settlement" && b.placeId === placeId,
  );
}
function rubbleOf(placeId) {
  return W.buildings.filter((b) => b.ruined && !b.cleared && b.placeKind === "settlement" && b.placeId === placeId);
}
// What a building is mostly made of: the compound it holds the most of.
function buildingMainMaterial(b) {
  const comp = b.composition || [];
  let best = -1,
    bestAmount = 0;
  for (let sp = 0; sp < comp.length; sp++)
    if (comp[sp] > bestAmount) {
      bestAmount = comp[sp];
      best = sp;
    }
  return best >= 0 ? best : (b.architecture?.rigid ?? C.MINERAL);
}
// How long an empty building stands: a few years for the softest fibre, over
// thirty for the hardest stone, each building a little different.
function ghostLifeYears(b) {
  if (!b) return 0;
  const hardness = clamp(materialTrait(buildingMainMaterial(b)).hardness || 0, 0, 1),
    jitter = 0.75 + ((Math.abs(hashParts(W.seedHash, "ghost-life", b.id)) % 1000) / 1000) * 0.5;
  return (GHOST_LIFE_MIN_YEARS + hardness * GHOST_LIFE_HARD_YEARS) * jitter;
}
// ── A town that falls stands empty ───────────────────────────────────────────
function abandonBuilding(b) {
  if (!b || b.ruined || !b.complete || b.abandoned) return false;
  b.abandoned = true;
  b.abandonedTick = W.tick;
  for (const o of W.workOrders) if (o.buildingId === b.id && o.status !== "complete" && o.status !== "done") o.status = "cancelled";
  for (const id of W.activeIds) if (W.components.work?.[id]?.buildingId === b.id) clearStaleWork(id);
  return true;
}
const collapseBuildingGhostBase = collapseBuilding;
collapseBuilding = function (b, evidence, causeEvent = 0) {
  if (
    RUINING_PLACE &&
    b &&
    !b.ruined &&
    b.complete &&
    b.placeKind === "settlement" &&
    b.placeId === RUINING_PLACE.id
  ) {
    abandonBuilding(b);
    return null;
  }
  const ev = evidence === undefined ? collapseBuildingGhostBase(b, undefined, causeEvent) : collapseBuildingGhostBase(b, evidence, causeEvent);
  if (ev && b) {
    b.rubbleAtCollapse = ruinRubble(b);
    if (b.abandoned) {
      b.abandoned = false;
      b.fellTick = W.tick;
    }
  }
  return ev;
};
const ruinSettlementGhostBase = ruinSettlement;
ruinSettlement = function (s, causes = [], evidence = "structural material failed") {
  if (!s || s.ruined) return ruinSettlementGhostBase(s, causes, evidence);
  RUINING_PLACE = s;
  let ev;
  try {
    ev = ruinSettlementGhostBase(s, causes, evidence);
  } finally {
    RUINING_PLACE = null;
  }
  if (!ev) return ev;
  const standing = ghostBuildings(s.id);
  if (standing.length) {
    const ghost = emitEvent("GhostTownEvent", {
      subjects: [s.entityId],
      location: idx(s.x, s.y),
      factions: [s.factionId].filter(Boolean),
      causes: [ev.id],
      evidence: [
        `${standing.length} building${standing.length === 1 ? "" : "s"} of ${s.name} stand empty`,
        "roofed by no one, they will weather and fall in their own time, or shelter whoever settles the ruin",
      ],
      importance: 3,
      data: { name: s.name, standing: standing.length },
    });
    s.importantEvents.push(ghost.id);
  }
  return ev;
};
// ── The years take the empty buildings, and the rubble sinks into the ground ──
function activeSalvageFor(place) {
  return W.workOrders.some(
    (o) =>
      o.type === "salvage" &&
      o.placeKind === "settlement" &&
      o.placeId === place.id &&
      o.status !== "done" &&
      o.status !== "complete" &&
      o.status !== "cancelled",
  );
}
function weatherRuins() {
  const report = { fell: 0, weathered: 0, cleared: 0, salvage: 0 };
  for (const b of W.buildings) {
    if (b.abandoned && !b.ruined && b.complete) {
      const step = Math.max(1, Math.ceil(Math.max(1, b.maxIntegrity) / Math.max(1, ghostLifeYears(b))));
      b.integrity = u16(Math.max(0, b.integrity - step));
      if (b.integrity < 1) {
        const place = buildingPlace(b);
        collapseBuilding(b, `years of weather and no hand to mend it${place ? `, empty since the fall of ${place.name}` : ""}`, 0);
        report.fell++;
      }
      continue;
    }
    if (!b.ruined || b.cleared) continue;
    const tile = idx(b.x, b.y);
    let left = 0,
      moved = 0;
    for (let sp = 0; sp < b.composition.length; sp++) {
      const v = b.composition[sp];
      if (!v) continue;
      const take = Math.min(v, Math.max(1, Math.ceil(v * RUBBLE_WEATHER_SHARE)));
      b.composition[sp] = v - take;
      depositTileMatter(tile, sp, take);
      moved += take;
      left += v - take;
    }
    if (moved) report.weathered++;
    if (left <= 0) {
      b.cleared = true;
      b.clearedTick = W.tick;
      report.cleared++;
      const place = buildingPlace(b);
      emitEvent("RuinsClearedEvent", {
        subjects: [place?.entityId].filter(Boolean),
        location: tile,
        factions: [place?.factionId].filter(Boolean),
        causes: [],
        evidence: [
          `the last stones of the ${b.name}${place ? ` of ${place.name}` : ""} sank into the ground`,
          "the ground it stood on is open again",
        ],
        importance: 1,
        data: { type: b.type, placeId: place?.id || 0, name: b.name, place: place?.name, weathered: true },
      });
    }
  }
  // Living towns pull down the rubble within their reach before they build over it.
  for (const s of W.settlements) {
    if (s.ruined || activeSalvageFor(s) || settlementPopulation(s) < 3) continue;
    if (queueRuinSalvage(s)) report.salvage++;
  }
  return report;
}
const simTickGhostBase = simTick;
simTick = function () {
  simTickGhostBase();
  if (W?.buildings && W.tick % 256 === RUINS_TICK) weatherRuins();
};
// Planning a building over a ruin whose rubble is gone clears the ruin.
function clearRuinsUnder(b) {
  if (!b) return 0;
  const radius = buildingSpatialRadius(b.type);
  let n = 0;
  for (const r of W.buildings) {
    if (r === b || !r.ruined || r.cleared || ruinRubble(r) > 0) continue;
    if (spatialFootprintsOverlap(b.x, b.y, radius, r.x, r.y, buildingSpatialRadius(r.type))) {
      r.cleared = true;
      r.clearedTick = W.tick;
      n++;
    }
  }
  return n;
}
const planBuildingGhostBase = planBuilding;
planBuilding = function (place, type, priority = 3) {
  const b = planBuildingGhostBase(place, type, priority);
  if (b) clearRuinsUnder(b);
  return b;
};
// ── Settlers on a ghost town take its standing buildings ─────────────────────
const createSettlementGhostBase = createSettlement;
createSettlement = function (campId, cause = 0) {
  const s = createSettlementGhostBase(campId, cause);
  if (!s) return s;
  const taken = [],
    from = new Set();
  for (const b of W.buildings) {
    if (!b.abandoned || b.ruined || !b.complete || b.placeKind !== "settlement" || b.placeId === s.id) continue;
    if (dist2(b.x, b.y, s.x, s.y) > GHOST_RECLAIM_REACH * GHOST_RECLAIM_REACH) continue;
    const old = W.settlements.find((x) => x.id === b.placeId);
    if (old && !old.ruined) continue;
    if (old) from.add(old.name);
    b.reclaimedFrom = old?.name || b.reclaimedFrom || "";
    b.placeId = s.id;
    b.abandoned = false;
    delete b.abandonedTick;
    taken.push(b);
  }
  if (!taken.length) return s;
  recomputePlaceCapacity(s);
  if (typeof invalidateDevelopmentMovementCache === "function") invalidateDevelopmentMovementCache();
  const names = [...from].sort().join(", ");
  s.reclaimed = { count: taken.length, from: names };
  const ev = emitEvent("TownReclaimedEvent", {
    subjects: [s.entityId],
    location: idx(s.x, s.y),
    factions: [s.factionId].filter(Boolean),
    causes: [s.importantEvents?.at(-1) || 0].filter(Boolean),
    evidence: [
      `${taken.length} standing building${taken.length === 1 ? "" : "s"} of ${names || "a fallen town"} were taken up by ${s.name}`,
      taken
        .map((b) => b.name)
        .slice(0, 5)
        .join(", "),
    ],
    importance: 3,
    data: { name: s.name, from: names, count: taken.length },
  });
  s.importantEvents.push(ev.id);
  return s;
};
// ── Rendering: bleached colours, cracks and growth, sinking rubble ───────────
// Weathered walls go pale and grey rather than dark: the colour drains and the
// lightness drifts toward bone.
function deadColor(c) {
  if (typeof c !== "string") return c;
  const m = c.match(/^hsla\(([-\d.]+),([-\d.]+)%,([-\d.]+)%,([-\d.]+)\)$/);
  if (!m) return c;
  return hsl(+m[1], +m[2] * 0.18, Math.min(78, +m[3] * 0.75 + 16), +m[4]);
}
function ghostPalette(p) {
  const out = {};
  for (const k in p) out[k] = deadColor(p[k]);
  return out;
}
function buildingWear(b) {
  return 1 - clamp((b.integrity || 0) / Math.max(1, b.maxIntegrity || 1), 0, 1);
}
// Tower blocks are drawn in fixed concrete tones, so a block gets a bleaching
// veil the exact size of its body; every other building is already bleached
// and gets only its cracks and growth.
function drawGhostVeil(g, b, s, r, detail) {
  const wear = buildingWear(b),
    storeys = BLOCK_TYPES.has(b.type) && typeof blockStoreys === "function" ? blockStoreys(b) : 0,
    bottom = storeys ? s.y + r * 0.35 : s.y + r * 0.3,
    top = storeys ? bottom - r * 0.34 * storeys : s.y - r * 0.95,
    hw = r * (storeys ? (b.type === "office" ? 0.62 : 0.7) : 0.5);
  g.save();
  if (storeys) {
    g.fillStyle = `rgba(196,192,186,${0.34 + 0.22 * wear})`;
    g.fillRect(s.x - hw, top, hw * 2, bottom - top);
  }
  if (detail >= 1 && r >= 6) {
    // Cracks down the walls, more as it weathers.
    g.strokeStyle = "rgba(24,20,28,0.6)";
    g.lineWidth = Math.max(1, r * 0.05);
    g.lineCap = "round";
    const cracks = 1 + Math.round(wear * 2);
    for (let n = 0; n < cracks; n++) {
      const x0 = s.x - hw * 0.6 + (visualHash01(b.styleSeed ^ 0x51, n) * 1.2 * hw),
        y0 = top + (bottom - top) * (0.15 + visualHash01(b.styleSeed ^ 0x77, n) * 0.25),
        len = (bottom - top) * (0.25 + 0.35 * wear);
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x0 + r * 0.12 * (n % 2 ? 1 : -1), y0 + len * 0.45);
      g.lineTo(x0 - r * 0.06 * (n % 2 ? 1 : -1), y0 + len);
      g.stroke();
    }
    // Growth creeping up from the ground.
    if (wear > 0.2) {
      g.fillStyle = hsl((W.terrainGenome?.baseHue || 35) + 75, 32, 30, 0.22 + 0.3 * wear);
      g.beginPath();
      g.ellipse(s.x, bottom - r * 0.15, hw * 0.9, r * (0.18 + 0.25 * wear), 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.restore();
}
const drawCompletedBuildingGhostBase = drawCompletedBuilding;
drawCompletedBuilding = function (g, b, s, r, p, now, m) {
  if (!b.abandoned) return drawCompletedBuildingGhostBase(g, b, s, r, p, now, m);
  ACTIVE_GHOST = b;
  let out;
  try {
    out = drawCompletedBuildingGhostBase(g, b, s, r, ghostPalette(p), now, m);
  } finally {
    ACTIVE_GHOST = null;
  }
  drawGhostVeil(g, b, s, r, buildingDetailLevel());
  RUINS.ghostsDrawn++;
  return out;
};
// No lit windows on an empty block, no lamps or masts on an empty house, and
// no glow from a ghost town at night.
const nightStrengthGhostBase = nightStrength;
nightStrength = function (light) {
  if (ACTIVE_GHOST) return 0;
  return light === undefined ? nightStrengthGhostBase() : nightStrengthGhostBase(light);
};
const drawBuildingExteriorDetailsGhostBase = drawBuildingExteriorDetails;
drawBuildingExteriorDetails = function (g, b, now, m) {
  if (b.abandoned) return;
  return drawBuildingExteriorDetailsGhostBase(g, b, now, m);
};
const townLightingGhostBase = townLighting;
townLighting = function (b) {
  if (b.abandoned) return "dark";
  return townLightingGhostBase(b);
};
// Rubble is drawn smaller and greener as it sinks, and not at all once it is gone.
function drawWeatheredRubble(g, b, now, m, frac) {
  const s = proceduralProjectTile(b.x + 0.5, b.y + 0.5, m),
    r = buildingScreenSize(b, m),
    p = buildingPalette(b),
    hue = W.terrainGenome?.baseHue || 35,
    stones = Math.max(1, Math.round(7 * frac));
  g.save();
  drawBuildingFootprint(g, s, r, UI.view, hsl(hue, 10, 18, 0.72 * frac), hsl(hue, 12, 36, 0.4 + 0.6 * frac), false);
  g.fillStyle = hsl(hue + 75, 30, 30, 0.28 * (1 - frac));
  g.beginPath();
  g.ellipse(s.x, s.y, r * 0.8, r * 0.42, 0, 0, Math.PI * 2);
  g.fill();
  for (let n = 0; n < stones; n++) {
    const ox = (visualHash01(b.styleSeed ^ 0x91, n) - 0.5) * r * 1.55,
      oy = (visualHash01(b.styleSeed ^ 0x37, n) - 0.5) * r * 0.8,
      size = r * (0.12 + visualHash01(b.styleSeed, n) * 0.2) * (0.55 + 0.45 * frac);
    g.fillStyle = n % 2 ? p.dark : p.base;
    g.save();
    g.translate(s.x + ox, s.y + oy);
    g.rotate(visualHash01(n, b.styleSeed) * Math.PI);
    g.fillRect(-size, -size * 0.45, size * 2, size * 0.9);
    g.restore();
  }
  g.restore();
  RUINS.weatheredDrawn++;
}
const drawBuildingSiteGhostBase = drawBuildingSite;
drawBuildingSite = function (g, b, now, m) {
  if (b.cleared) {
    RUINS.skipped++;
    return;
  }
  if (b.ruined && b.rubbleAtCollapse > 0) {
    const frac = clamp(ruinRubble(b) / b.rubbleAtCollapse, 0, 1);
    if (frac < 0.97) return drawWeatheredRubble(g, b, now, m, frac);
  }
  return drawBuildingSiteGhostBase(g, b, now, m);
};
// ── Chronicle and Legends ────────────────────────────────────────────────────
const eventSentenceGhostBase = eventSentence;
eventSentence = function (e) {
  const d = e.data || {};
  if (e.type === "GhostTownEvent")
    return `${d.standing} building${d.standing === 1 ? "" : "s"} of ${d.name} stood empty after its fall, a ghost town for the years to take.`;
  if (e.type === "TownReclaimedEvent")
    return `${d.name} took up ${d.count} standing building${d.count === 1 ? "" : "s"} of ${d.from || "a fallen town"}.`;
  if (e.type === "RuinsClearedEvent" && d.weathered)
    return `The last stones of the ${d.name || "ruin"}${d.place ? ` of ${d.place}` : ""} sank into the ground.`;
  return eventSentenceGhostBase(e);
};
const alertWorthyGhostBase = alertWorthy;
alertWorthy = function (a) {
  return alertWorthyGhostBase(a) || a.type === "TownReclaimedEvent";
};
const renderPlacePageGhostBase = renderPlacePage;
renderPlacePage = function (id) {
  const html = renderPlacePageGhostBase(id),
    s = W.settlements.find((x) => x.id === id);
  if (!s) return html;
  const rows = [];
  if (s.ruined) {
    const standing = ghostBuildings(s.id).length,
      rubble = rubbleOf(s.id).length,
      cleared = W.buildings.filter((b) => b.cleared && b.placeKind === "settlement" && b.placeId === s.id).length;
    rows.push(
      `<div class="kv"><span>Ruins</span><b>${standing} standing empty · ${rubble} in rubble · ${cleared} cleared</b></div>`,
    );
  }
  if (s.reclaimed?.count)
    rows.push(
      `<div class="kv"><span>Reclaimed</span><b>${s.reclaimed.count} building${s.reclaimed.count === 1 ? "" : "s"} of ${esc(s.reclaimed.from || "a fallen town")}</b></div>`,
    );
  if (!rows.length) return html;
  const row = rows.join(""),
    at = html.indexOf('<div class="subhead">');
  return at < 0 ? html + row : html.slice(0, at) + row + html.slice(at);
};
window.ALIFE_RUINS_DEBUG = Object.freeze({
  standing: (placeId) => ghostBuildings(placeId).map((b) => b.id),
  rubble: (placeId) => rubbleOf(placeId).map((b) => ({ id: b.id, left: ruinRubble(b), at: b.rubbleAtCollapse || 0 })),
  cleared: (placeId) => W.buildings.filter((b) => b.cleared && b.placeKind === "settlement" && b.placeId === placeId).length,
  life: (buildingId) => ghostLifeYears(W.buildings.find((b) => b.id === buildingId)),
  material: (buildingId) => W.definitions.species[buildingMainMaterial(W.buildings.find((b) => b.id === buildingId) || {})]?.name || null,
  fall: (placeId, why = "struck down from above") => ruinSettlement(W.settlements.find((s) => s.id === placeId), [], why),
  wear: (buildingId) => buildingWear(W.buildings.find((b) => b.id === buildingId) || {}),
  weather: (years = 1) => {
    let r = null;
    for (let i = 0; i < years; i++) r = weatherRuins();
    return r;
  },
  clearUnder: (buildingId) => clearRuinsUnder(W.buildings.find((b) => b.id === buildingId)),
  counts: () => ({ ...RUINS }),
  reset: () => {
    RUINS.ghostsDrawn = 0;
    RUINS.weatheredDrawn = 0;
    RUINS.skipped = 0;
  },
});
