// ═══════════════════════════════════════════════════════════════════════════
// 98. INDUSTRY — rails carry, lenses see, factories work, knowledge travels
// ═══════════════════════════════════════════════════════════════════════════
// The late crafts were mostly names on the tree. Railways now carry: every
// completed rail link moves a polity's surplus between its two towns each
// year, twice as much as a cart and before the caravans set out. Lenses see:
// an observatory that knows Lenses charts a second star with every look.
// Factories work: a town that knows Electricity and Terrestrial Mechanization
// raises a Factory in its industrial quarter, an electric furnace that smelts
// stored ore into worked metal and fires spare mineral into ceramic at scale
// by the world's own balanced reactions, so nothing is created; its chimney
// smokes while it works and its windows light at night. And knowledge
// travels: a craft practised in a town joined to yours by a completed road or
// rail, by a working trade route, or by an embassy between your polities is
// a craft your town may learn, and a printed record kept by an embassy
// partner is a record your town may read. Everything here is deterministic
// and matter-conserving; rendering only reads.
const FACTORY_CADENCE = 64,
  FACTORY_OFFSET = 24,
  FACTORY_RUNS = 6,
  FACTORY_TEMPERATURE = 900,
  FACTORY_MINERAL_FLOOR = 40,
  RAIL_CADENCE = 256,
  RAIL_OFFSET = 96,
  RAIL_TRANSFERS = 6,
  RAIL_FACTOR = 2,
  INDUSTRY = { railFreight: 0, factoryRuns: 0, firstFactoryWorld: null };
if (typeof INDUSTRY_TYPES !== "undefined") INDUSTRY_TYPES.add("factory");
if (typeof LIT_TYPES !== "undefined") LIT_TYPES.add("factory");
// ── Rails carry ───────────────────────────────────────────────────────────────
function completeRailLinks() {
  return (W.roads?.links || []).filter((l) => l.complete && l.kind === "rail");
}
function railFreight() {
  if (!W.roads) return 0;
  // A town founded this year may not yet carry an economy record (41).
  if (typeof initializeImplicitSociety === "function") initializeImplicitSociety(W);
  let moved = 0;
  for (const link of completeRailLinks()) {
    const a = W.settlements.find((s) => s.id === link.a),
      b = W.settlements.find((s) => s.id === link.b);
    if (!a || !b || a.ruined || b.ruined || !a.factionId || a.factionId !== b.factionId) continue;
    let carried = 0,
      tonnage = 0;
    for (const [from, to] of [
      [a, b],
      [b, a],
    ])
      for (let n = 0; n < RAIL_TRANSFERS && carried < RAIL_TRANSFERS; n++) {
        const offer = bestInternalTransfer(from, to);
        if (!offer) break;
        const amount = transferSettlementMatter(
          from,
          to,
          offer.sp,
          Math.min(offer.amount * RAIL_FACTOR, materialSurplus(from, offer.sp)),
        );
        if (!amount) break;
        recordExchange(from, to, "rail", offer.sp, amount);
        carried++;
        tonnage += amount;
      }
    if (tonnage) {
      link.freight = (link.freight || 0) + tonnage;
      if (!link.freightEventId) {
        const faction = W.factions.find((f) => f.id === link.factionId);
        link.freightEventId = emitEvent("RailFreightEvent", {
          subjects: [a.entityId, b.entityId],
          location: idx(a.x, a.y),
          factions: faction ? [faction.id] : [],
          causes: [link.completedEventId || W.lastEventByType.RailEvent].filter(Boolean),
          evidence: [`${tonnage} measures carried by rail`, `${a.name} and ${b.name}`],
          importance: 3,
          data: { a: a.name, b: b.name, polity: faction?.name || "", tonnage },
        }).id;
      }
    }
    moved += tonnage;
  }
  INDUSTRY.railFreight += moved;
  return moved;
}
// ── Lenses see ────────────────────────────────────────────────────────────────
const chartStarsIndustryBase = chartStars;
chartStars = function (force = false) {
  const ev = chartStarsIndustryBase(force);
  if (!ev) return ev;
  const towns = W.settlements.filter((s) => !s.ruined && s.knownProcesses);
  if (towns.some((s) => knowsTech(s, "satellites")) || !towns.some((s) => knowsTech(s, "optics")))
    return ev;
  return chartStarsIndustryBase(true) || ev;
};
// ── Factories work ────────────────────────────────────────────────────────────
function factoryFurnace(place) {
  const inv = invSettlement(place);
  return { ...inv, temperature: () => Math.max(inv.temperature(), FACTORY_TEMPERATURE) };
}
function runFactory(place, factory) {
  const inv = factoryFurnace(place),
    runs = Math.round(FACTORY_RUNS * (knowsTech(place, "fusion") ? 1.5 : 1)),
    q = place.inventory;
  let made = 0;
  for (let n = 0; n < runs; n++) {
    if ((q[C.ORE] || 0) >= 2 && (q[C.FUEL] || 0) >= 2 && executeProcess("smelting", inv, 1)) made += 2;
    else if (
      (q[C.MINERAL] || 0) > FACTORY_MINERAL_FLOOR &&
      (q[C.FUEL] || 0) >= 1 &&
      executeProcess("ceramic_firing", inv, 1)
    )
      made += 2;
    else break;
  }
  if (made) {
    factory.workedTick = W.tick;
    factory.made = (factory.made || 0) + made;
    INDUSTRY.factoryRuns++;
  }
  return made;
}
function updateFactories() {
  let made = 0;
  for (const place of W.settlements) {
    if (place.ruined || !place.knownProcesses) continue;
    const factories = completedBuildings(place, "factory");
    if (!factories.length) continue;
    if (INDUSTRY.firstFactoryWorld !== W && typeof recordMilestone === "function") {
      INDUSTRY.firstFactoryWorld = W;
      recordMilestone("first-factory", "the first factory", place, {
        evidence: "an electric furnace smelting ore at scale",
      });
    }
    for (const factory of factories) made += runFactory(place, factory);
  }
  return made;
}
function wantsFactory(place) {
  if (!place?.knownProcesses || place.ruined) return false;
  if (!knowsTech(place, "electricity") || !knowsTech(place, "mechanization")) return false;
  return !W.buildings.some(
    (b) => !b.ruined && b.placeKind === "settlement" && b.placeId === place.id && b.type === "factory",
  );
}
const ensurePlacePlansIndustryBase = ensurePlacePlans;
ensurePlacePlans = function (place) {
  ensurePlacePlansIndustryBase(place);
  if (!place?.knownProcesses || place.ruined) return;
  if (wantsFactory(place) && activeBuildings(place).length < 6)
    planBuilding(place, "factory", Math.max(3, place.management?.priorities?.materials || 3));
};
const simTickIndustryBase = simTick;
simTick = function () {
  simTickIndustryBase();
  if (!W?.settlements) return;
  if (W.tick % FACTORY_CADENCE === FACTORY_OFFSET) updateFactories();
  if (W.roads && W.tick % RAIL_CADENCE === RAIL_OFFSET) railFreight();
};
// ── Knowledge travels ─────────────────────────────────────────────────────────
const LINKED_CACHE = { world: null, tick: -1, map: new Map() };
function linkedTowns(s) {
  if (LINKED_CACHE.world !== W || LINKED_CACHE.tick !== W.tick) {
    LINKED_CACHE.world = W;
    LINKED_CACHE.tick = W.tick;
    LINKED_CACHE.map.clear();
  }
  let ids = LINKED_CACHE.map.get(s.id);
  if (ids) return ids;
  const out = new Set();
  for (const link of W.roads?.links || [])
    if (link.complete) {
      if (link.a === s.id) out.add(link.b);
      else if (link.b === s.id) out.add(link.a);
    }
  for (const r of W.tradeRoutes || [])
    if (r.trips > 0) {
      if (r.a === s.id) out.add(r.b);
      else if (r.b === s.id) out.add(r.a);
    }
  if (s.factionId && W.diplomacy?.treaties)
    for (const t of W.diplomacy.treaties) {
      if (!t.active || t.kind !== "embassy") continue;
      const other = t.a === s.factionId ? t.b : t.b === s.factionId ? t.a : 0;
      if (!other) continue;
      for (const town of W.settlements) if (!town.ruined && town.factionId === other) out.add(town.id);
    }
  out.delete(s.id);
  ids = [...out];
  LINKED_CACHE.map.set(s.id, ids);
  return ids;
}
const neighborPracticesProcessIndustryBase = neighborPracticesProcess;
neighborPracticesProcess = function (s, techId) {
  if (neighborPracticesProcessIndustryBase(s, techId)) return true;
  return linkedTowns(s).some((id) => {
    const t = W.settlements.find((x) => x.id === id);
    return !!t && !t.ruined && t.knownProcesses.includes(techId);
  });
};
const processRecordedIndustryBase = processRecorded;
processRecorded = function (place, techId) {
  if (processRecordedIndustryBase(place, techId)) return true;
  if (!place?.factionId || !W.diplomacy?.treaties) return false;
  for (const t of W.diplomacy.treaties) {
    if (!t.active || t.kind !== "embassy") continue;
    const other = t.a === place.factionId ? t.b : t.b === place.factionId ? t.a : 0;
    if (!other) continue;
    const towns = W.settlements.filter((s) => !s.ruined && s.factionId === other);
    if (towns.some((s) => knowsTech(s, "printing")) && towns.some((s) => knowsTech(s, techId))) return true;
  }
  return false;
};
// ── Rendering: a factory is a broad works with a chimney that smokes ─────────
const drawCompletedBuildingIndustryBase = drawCompletedBuilding;
drawCompletedBuilding = function (g, b, s, r, p, now, m) {
  if (b.type !== "factory") return drawCompletedBuildingIndustryBase(g, b, s, r, p, now, m);
  return drawCompletedBuildingIndustryBase(g, { ...b, type: "workshop" }, s, r * 1.35, p, now, m);
};
const drawBuildingExteriorDetailsIndustryBase = drawBuildingExteriorDetails;
drawBuildingExteriorDetails = function (g, b, now, m) {
  drawBuildingExteriorDetailsIndustryBase(g, b, now, m);
  if (b.type !== "factory" || !b.complete || b.ruined || UI.quality === "low" || UI.camera.zoom < 1.4) return;
  const s = proceduralProjectTile(b.x + 0.5, b.y + 0.5, m),
    r = buildingScreenSize(b, m),
    cx = s.x + r * 0.55,
    top = s.y - r * 1.7;
  g.save();
  g.fillStyle = "#4a4046";
  g.fillRect(cx - r * 0.09, top, r * 0.18, r * 1.25);
  g.fillStyle = "#6a5f66";
  g.fillRect(cx - r * 0.12, top, r * 0.24, r * 0.12);
  const working = W.tick - (b.workedTick || -1e9) < FACTORY_CADENCE * 2;
  if (working) {
    const still = ACTIVE_REDUCED_MOTION;
    for (let i = 0; i < 3; i++) {
      const t = still ? (i + 1) / 3 : ((now * 0.0006 + i / 3 + b.id * 0.17) % 1),
        px = cx + Math.sin(t * 5 + i) * r * 0.12 * t,
        py = top - t * r * 0.9,
        pr = Math.max(1, r * (0.08 + t * 0.14));
      g.fillStyle = `rgba(190,190,200,${0.45 * (1 - t)})`;
      g.beginPath();
      g.arc(px, py, pr, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.restore();
};
// ── Chronicle ─────────────────────────────────────────────────────────────────
const eventSentenceIndustryBase = eventSentence;
eventSentence = function (e) {
  if (e.type !== "RailFreightEvent") return eventSentenceIndustryBase(e);
  const d = e.data || {};
  return `The first train ran between ${d.a} and ${d.b}, carrying ${d.tonnage} measures of ${d.polity || "the polity"}'s stores.`;
};
window.ALIFE_INDUSTRY_DEBUG = Object.freeze({
  rail: () => railFreight(),
  freight: () => INDUSTRY.railFreight,
  links: () => completeRailLinks().map((l) => ({ a: l.a, b: l.b, freight: l.freight || 0 })),
  factories: (placeId) =>
    completedBuildings(W.settlements.find((s) => s.id === placeId) || {}, "factory").map((b) => ({
      id: b.id,
      made: b.made || 0,
      workedTick: b.workedTick || 0,
    })),
  wants: (placeId) => wantsFactory(W.settlements.find((s) => s.id === placeId)),
  plan: (placeId) => ensurePlacePlans(W.settlements.find((s) => s.id === placeId)),
  run: (placeId) => {
    const s = W.settlements.find((x) => x.id === placeId);
    if (!s) return 0;
    let made = 0;
    for (const f of completedBuildings(s, "factory")) made += runFactory(s, f);
    return made;
  },
  update: () => updateFactories(),
  linked: (placeId) => {
    LINKED_CACHE.tick = -1; // a debug look sees the world as it is now
    return linkedTowns(W.settlements.find((s) => s.id === placeId) || { id: 0 });
  },
});
