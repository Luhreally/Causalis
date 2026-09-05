// ═══════════════════════════════════════════════════════════════════════════
// 57. SEAFARING — docks, fishing, voyages to far shores, and sea caravans
// ═══════════════════════════════════════════════════════════════════════════
// People already learn Gradient Navigation and craft watercraft, and their
// marches may cross water once the polity knows it. What was missing is the
// life of the coast: a dock where a town meets the water, fishers who bring
// the shallows' organic matter into the store (conserved, tile to hand to
// store), voyages that carry settlers across deep water to found a camp on a
// far shore, and caravans and envoys who sail when both ends know the sea.
// Boats launched from a dock count as watercraft for whoever is aboard on the
// town's business. Rendering only reads the world.
const SEA_REASONS = Object.freeze({
  fish: "casting nets from the town's boat",
  voyage: "sailing for a far shore",
});
function ensureSea(world = W) {
  if (!world) return;
  world.sea = world.sea || { trips: [], voyages: [], nextId: 1, catches: 0 };
}
const restoreWorldSeaBase = restoreWorldDefaults;
restoreWorldDefaults = function () {
  restoreWorldSeaBase();
  ensureSea(W);
};
function seaVisual(kind, tile, extra = {}) {
  const now = performance.now();
  UI.seaVisuals = (UI.seaVisuals || []).filter((x) => now - x.started < 9000);
  UI.seaVisuals.push({ kind, tile, started: now, world: W, ...extra });
}
function isWater(tile) {
  return W.tiles.liquid[tile] > WATER_DEPTH.WADE_LIMIT;
}
function isSolidLand(tile) {
  return W.tiles.liquid[tile] <= WATER_DEPTH.SURFACE && W.tiles.fire[tile] < 100;
}
function waterTilesNear(x, y, radius) {
  let n = 0;
  for (let dy = -radius; dy <= radius; dy++)
    for (let dx = -radius; dx <= radius; dx++) {
      const tx = x + dx,
        ty = y + dy;
      if (inside(tx, ty) && isWater(idx(tx, ty))) n++;
    }
  return n;
}
// Count deep-water tiles along the straight line between two tiles.
function waterBetween(a, b) {
  const [ax, ay] = xy(a),
    [bx, by] = xy(b),
    steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
  let n = 0;
  for (let k = 1; k < steps; k++) {
    const x = Math.round(ax + ((bx - ax) * k) / steps),
      y = Math.round(ay + ((by - ay) * k) / steps);
    if (inside(x, y) && isWater(idx(x, y))) n++;
  }
  return n;
}
function placeDock(place) {
  return W.buildings.find(
    (b) =>
      !b.ruined &&
      b.complete &&
      b.type === "dock" &&
      b.placeKind === "settlement" &&
      b.placeId === place.id,
  );
}
function placeSails(place) {
  return !!place?.factionId && factionHasTech(place.factionId, "navigation");
}
// ── Docks ──────────────────────────────────────────────────────────────────────
function placeWantsDock(place) {
  if (!place?.knownProcesses || place.ruined || place.active === false) return false;
  return settlementPopulation(place) >= 6 && waterTilesNear(place.x, place.y, 5) >= 4;
}
const ensurePlacePlansSeaBase = ensurePlacePlans;
ensurePlacePlans = function (place) {
  ensurePlacePlansSeaBase(place);
  if (!placeWantsDock(place)) return;
  if (
    W.buildings.some(
      (b) =>
        !b.ruined && b.placeKind === "settlement" && b.placeId === place.id && b.type === "dock",
    )
  )
    return;
  planBuilding(place, "dock", Math.max(3, place.management?.priorities?.food || 3));
};
// A dock stands on land at the water's edge, as near the town as the shore allows.
const plannedBuildingTileSeaBase = plannedBuildingTile;
plannedBuildingTile = function (place, type, ordinal) {
  if (type !== "dock") return plannedBuildingTileSeaBase(place, type, ordinal);
  let best = null,
    bd = Infinity;
  for (let dy = -6; dy <= 6; dy++)
    for (let dx = -6; dx <= 6; dx++) {
      const x = place.x + dx,
        y = place.y + dy;
      if (!inside(x, y) || x < 1 || y < 1 || x >= W.width - 1 || y >= W.height - 1) continue;
      const tile = idx(x, y);
      if (W.tiles.liquid[tile] > WATER_DEPTH.SHALLOW) continue;
      if (!neighbors4(tile).some((n) => isWater(n))) continue;
      if (!developmentFootprintClear(x, y, 1) || !buildingTerrainFootprintValid(type, x, y))
        continue;
      const d = dx * dx + dy * dy;
      if (d < bd || (d === bd && tile < idx(best[0], best[1]))) {
        bd = d;
        best = [x, y];
      }
    }
  return best;
};
// ── Boats belong to the town ───────────────────────────────────────────────────
function aboardTownBoat(id) {
  const order = typeof civilOrderOf === "function" ? civilOrderOf(id) : null;
  if (!order) return false;
  if (order.kind === "fish" || order.kind === "voyage") return true;
  if (order.kind === "caravan" || order.kind === "envoy" || order.kind === "wedding")
    return (
      !!W.components.social[id]?.factionId &&
      factionHasTech(W.components.social[id].factionId, "navigation")
    );
  return false;
}
const hasNavigableWatercraftSeaBase = hasNavigableWatercraft;
hasNavigableWatercraft = function (id) {
  return hasNavigableWatercraftSeaBase(id) || (W?.kind[id] === KINDS.PERSON && aboardTownBoat(id));
};
const spawnCaravanSeaBase = spawnCaravan;
spawnCaravan = function (from, to, route, cargoSp = -1, cargoAmount = 0) {
  const caravan = spawnCaravanSeaBase(from, to, route, cargoSp, cargoAmount);
  if (
    caravan &&
    placeSails(from) &&
    placeSails(to) &&
    waterBetween(idx(from.x, from.y), idx(to.x, to.y)) >= 3
  ) {
    caravan.sea = true;
    for (const id of caravan.members) {
      const order = civilOrderOf(id);
      if (order) order.sea = true;
    }
  }
  return caravan;
};
// ── Fishing ────────────────────────────────────────────────────────────────────
function fishingGround(place, dock) {
  const sails = placeSails(place),
    cx = dock.x,
    cy = dock.y;
  let best = -1,
    score = 0;
  for (let dy = -6; dy <= 6; dy++)
    for (let dx = -6; dx <= 6; dx++) {
      const x = cx + dx,
        y = cy + dy;
      if (!inside(x, y)) continue;
      const tile = idx(x, y),
        l = W.tiles.liquid[tile];
      // Walking never enters water past 1100, so grounds stop short of it.
      if (l <= WATER_DEPTH.SURFACE || l >= 1100) continue;
      if (
        !sails &&
        l > WATER_DEPTH.WADE_LIMIT &&
        !neighbors4(tile).some((n) => W.tiles.liquid[n] <= WATER_DEPTH.WADE_LIMIT)
      )
        continue;
      const organic = W.tiles.chem[C.ORGANIC][tile];
      if (organic < 4) continue;
      const s = organic - Math.sqrt(dx * dx + dy * dy) * 2;
      if (s > score || (s === score && tile < best)) {
        score = s;
        best = tile;
      }
    }
  return best;
}
// Without boats the fisher stands where the shallows can be reached.
function castingTile(place, ground) {
  if (placeSails(place) || W.tiles.liquid[ground] <= WATER_DEPTH.WADE_LIMIT) return ground;
  const shore = neighbors4(ground).filter((n) => W.tiles.liquid[n] <= WATER_DEPTH.WADE_LIMIT);
  return shore.length ? shore.sort((a, b) => a - b)[0] : ground;
}
function startFishing(place) {
  ensureSea();
  const dock = placeDock(place);
  if (!dock || place.ruined || settlementPopulation(place) < 5) return [];
  const active = W.sea.trips.filter((t) => t.active && t.placeId === place.id).length;
  if (active >= 2) return [];
  const ground = fishingGround(place, dock);
  if (ground < 0) return [];
  const fishers =
      typeof caravanCandidates === "function" ? caravanCandidates(place, 2 - active) : [],
    cast = castingTile(place, ground),
    [tx, ty] = xy(cast),
    trips = [];
  for (const id of fishers) {
    const trip = {
      id: W.sea.nextId++,
      personId: id,
      placeId: place.id,
      dockId: dock.id,
      ground,
      startedTick: W.tick,
      phase: "out",
      carried: 0,
      active: true,
    };
    W.sea.trips.push(trip);
    issueCivilOrder(id, "fish", tx, ty, { placeId: place.id, tripId: trip.id });
    trips.push(trip);
  }
  return trips;
}
function updateFishing() {
  ensureSea();
  for (const trip of W.sea.trips) {
    if (!trip.active) continue;
    const id = trip.personId,
      place = W.settlements.find((s) => s.id === trip.placeId),
      dock = W.buildings.find((b) => b.id === trip.dockId && !b.ruined),
      p = W.components.position[id];
    if (
      !classifyAlive(id) ||
      !p ||
      !place ||
      place.ruined ||
      !dock ||
      W.tick - trip.startedTick > 700
    ) {
      if (classifyAlive(id)) clearCivilOrder(id);
      trip.active = false;
      continue;
    }
    const order = civilOrderOf(id);
    if (!order || order.kind !== "fish") {
      trip.active = false;
      continue;
    }
    if (trip.phase === "out") {
      if (!orderArrived(order)) continue;
      const [gx, gy] = xy(trip.ground);
      if (Math.max(Math.abs(p.x - gx), Math.abs(p.y - gy)) > 2) continue;
      trip.carried = resolveTransfer({
        fromType: "tile",
        from: trip.ground,
        toType: "entity",
        to: id,
        amounts: [
          [C.ORGANIC, 8],
          [C.NUTRIENT, 2],
        ],
      });
      trip.phase = "home";
      issueCivilOrder(id, "fish", dock.x, dock.y, { placeId: place.id, tripId: trip.id });
    } else if (orderArrived(order)) {
      const landed = resolveTransfer({
        fromType: "entity",
        from: id,
        toType: "settlement",
        to: place.id,
        amounts: [
          [C.ORGANIC, Math.max(0, trip.carried)],
          [C.NUTRIENT, 2],
        ],
      });
      clearCivilOrder(id);
      trip.active = false;
      trip.landed = landed;
      if (landed > 0) {
        W.sea.catches++;
        const heavy = W.sea.catches % 5 === 0;
        emitEvent("CatchEvent", {
          subjects: [id, place.entityId],
          location: trip.ground,
          factions: place.factionId ? [place.factionId] : [],
          causes: [W.causalIndex.tile[trip.ground] || 0].filter(Boolean),
          evidence: [`${landed} units moved from the water into ${place.name}'s store`],
          magnitude: landed,
          importance: heavy ? 2 : 1,
          data: { name: entityName(id), place: place.name, amount: landed, heavy },
        });
        if (typeof grantSkill === "function") grantSkill(id, "hunt", 1.5);
        setEmotionImpulse(id, { contentment: 0.06 });
      }
    }
  }
  if (W.sea.trips.length > 60)
    W.sea.trips = W.sea.trips
      .filter((t) => t.active)
      .concat(W.sea.trips.filter((t) => !t.active).slice(-16));
}
// ── Voyages: settlers for a far shore ──────────────────────────────────────────
function colonySite(place) {
  const from = idx(place.x, place.y),
    cycle = Math.floor(W.tick / 256);
  let best = -1,
    score = 0;
  for (let attempt = 0; attempt < 48; attempt++) {
    const a = counterRand("voyage-angle", place.id, cycle, attempt) * Math.PI * 2,
      d = 12 + counterRand("voyage-dist", place.id, cycle, attempt) * 28,
      x = Math.round(place.x + Math.cos(a) * d),
      y = Math.round(place.y + Math.sin(a) * d);
    if (!inside(x, y) || x < 2 || y < 2 || x >= W.width - 2 || y >= W.height - 2) continue;
    const tile = idx(x, y);
    if (
      !isSolidLand(tile) ||
      W.tiles.owner[tile] ||
      campNear(tile, 6) ||
      nearestSettlement(tile, 8)
    )
      continue;
    if (waterBetween(from, tile) < 3) continue;
    const food = tileFood(tile, "omnivore");
    if (food < 3) continue;
    const s = food + tileMoisture(tile) * 0.1 - d * 0.05;
    if (s > score) {
      score = s;
      best = tile;
    }
  }
  return best;
}
function launchVoyage(place, force = false) {
  ensureSea();
  if (!place || place.ruined || !placeSails(place) || !placeDock(place)) return null;
  if (!force && (settlementPopulation(place) < 14 || (place.stability || 0) < 0.5)) return null;
  if (W.sea.voyages.some((v) => v.active && v.from === place.id)) return null;
  const target = colonySite(place);
  if (target < 0) return null;
  const [sx, sy] = xy(target);
  if (
    typeof civilReachable === "function" &&
    !civilReachable(idx(place.x, place.y), { x: sx, y: sy }, place.factionId || 0, "sea")
  )
    return null;
  const members = typeof caravanCandidates === "function" ? caravanCandidates(place, 4) : [];
  if (members.length < 3) return null;
  for (const id of members)
    resolveTransfer({
      fromType: "settlement",
      from: place.id,
      toType: "entity",
      to: id,
      amounts: [
        [C.ORGANIC, 8],
        [C.SOLVENT, 8],
      ],
    });
  const [tx, ty] = xy(target),
    voyage = {
      id: W.sea.nextId++,
      from: place.id,
      factionId: place.factionId || 0,
      members,
      target,
      startedTick: W.tick,
      active: true,
      eventId: 0,
    };
  W.sea.voyages.push(voyage);
  for (const id of members)
    issueCivilOrder(id, "voyage", tx, ty, { voyageId: voyage.id, sea: true });
  const ev = emitEvent("VoyageEvent", {
    subjects: [...members.slice(0, 3), place.entityId],
    location: idx(place.x, place.y),
    factions: place.factionId ? [place.factionId] : [],
    causes: [W.lastEventByType.TechAdvanceEvent || 0].filter(Boolean),
    evidence: [
      `${members.length} settlers`,
      `${waterBetween(idx(place.x, place.y), target)} tiles of open water`,
    ],
    importance: 3,
    data: {
      place: place.name,
      settlers: members.length,
      distance: Math.round(Math.sqrt(dist2(place.x, place.y, tx, ty))),
    },
  });
  voyage.eventId = ev.id;
  seaVisual("launch", idx(place.x, place.y));
  return voyage;
}
function landingTile(target) {
  if (isSolidLand(target) && !campNear(target, 5)) return target;
  for (const n of neighbors4(target)) if (isSolidLand(n) && !campNear(n, 5)) return n;
  return -1;
}
function updateVoyages() {
  ensureSea();
  for (const voyage of W.sea.voyages) {
    if (!voyage.active) continue;
    voyage.members = voyage.members.filter((id) => classifyAlive(id) && W.components.position[id]);
    const place = W.settlements.find((s) => s.id === voyage.from),
      [tx, ty] = xy(voyage.target),
      overdue = W.tick - voyage.startedTick > 2400;
    if (!voyage.members.length) {
      voyage.active = false;
      continue;
    }
    const arrived = voyage.members.filter((id) => {
      const p = W.components.position[id];
      return Math.max(Math.abs(p.x - tx), Math.abs(p.y - ty)) <= 2;
    });
    if (arrived.length >= Math.min(voyage.members.length, 2)) {
      // Settlers leave their home town behind before founding another.
      for (const id of arrived) {
        const soc = W.components.social[id];
        if (soc) {
          soc.homePlaceKind = "";
          soc.homePlaceId = 0;
        }
      }
      const site = landingTile(voyage.target),
        camp = site >= 0 ? createCamp(site, arrived[0], voyage.eventId) : null;
      for (const id of voyage.members) clearCivilOrder(id);
      voyage.active = false;
      voyage.endedTick = W.tick;
      if (camp) {
        voyage.campId = camp.id;
        emitEvent("ColonyEvent", {
          subjects: [...arrived.slice(0, 3), camp.entityId, ...(place ? [place.entityId] : [])],
          location: site,
          factions: voyage.factionId ? [voyage.factionId] : [],
          causes: [voyage.eventId, W.lastEventByType.CampFoundedEvent].filter(Boolean),
          evidence: [`${arrived.length} landed`, "a far shore across open water"],
          importance: 4,
          data: { place: place?.name || "a lost town", camp: camp.name, settlers: arrived.length },
        });
        for (const id of arrived) {
          W.components.identity[id].significance += 4;
          if (typeof grantSkill === "function") grantSkill(id, "lore", 3);
        }
        seaVisual("landing", site);
      } else
        emitEvent("VoyageLostEvent", {
          subjects: [...arrived.slice(0, 2), ...(place ? [place.entityId] : [])],
          location: voyage.target,
          factions: voyage.factionId ? [voyage.factionId] : [],
          causes: [voyage.eventId].filter(Boolean),
          evidence: ["no landing could be made"],
          importance: 3,
          data: { place: place?.name || "a lost town", reason: "the shore gave no footing" },
        });
      continue;
    }
    if (overdue) {
      for (const id of voyage.members) clearCivilOrder(id);
      voyage.active = false;
      voyage.endedTick = W.tick;
      emitEvent("VoyageLostEvent", {
        subjects: [...voyage.members.slice(0, 2), ...(place ? [place.entityId] : [])],
        location: voyage.target,
        factions: voyage.factionId ? [voyage.factionId] : [],
        causes: [voyage.eventId].filter(Boolean),
        evidence: ["the crossing outlasted the provisions"],
        importance: 3,
        data: {
          place: place?.name || "a lost town",
          reason: "the crossing outlasted the provisions",
        },
      });
    }
  }
  if (W.sea.voyages.length > 30)
    W.sea.voyages = W.sea.voyages
      .filter((v) => v.active)
      .concat(W.sea.voyages.filter((v) => !v.active).slice(-10));
}
function considerVoyages() {
  const cycle = Math.floor(W.tick / 256);
  for (const place of W.settlements) {
    if (place.ruined || !placeSails(place) || !placeDock(place)) continue;
    if (settlementPopulation(place) < 14 || (place.stability || 0) < 0.5) continue;
    const f = W.factions.find((x) => x.id === place.factionId),
      restless = entityAtRadius(idx(place.x, place.y), 8, KINDS.PERSON).some(
        (id) =>
          classifyAlive(id) && ["found", "journey"].includes(W.components.identity[id]?.want?.id),
      ),
      chance = 0.08 + (f?.ethos?.expansionist || 0) * 0.15 + (restless ? 0.15 : 0);
    if (counterRand("voyage", place.id, cycle) < chance) launchVoyage(place);
  }
}
// ── Tick hook ──────────────────────────────────────────────────────────────────
const updateWeatherCycleSeaBase = updateWeatherCycle;
updateWeatherCycle = function () {
  updateWeatherCycleSeaBase();
  if (!W?.settlements || !W.buildings) return;
  ensureSea(W);
  if (W.tick % 16 === 6) {
    updateFishing();
    updateVoyages();
  }
  if (W.tick % 64 === 44) for (const place of W.settlements) if (!place.ruined) startFishing(place);
  if (W.tick % 256 === 200) considerVoyages();
};
const chooseBehaviorSeaBase = chooseBehavior;
chooseBehavior = function (id, tier) {
  chooseBehaviorSeaBase(id, tier);
  const l = W.components.life[id];
  if (l?.behavior === "march") {
    const order = civilOrderOf(id);
    if (order && SEA_REASONS[order.kind]) l.behaviorReason = SEA_REASONS[order.kind];
  }
};
// ── Chronicle sentences ────────────────────────────────────────────────────────
const eventSentenceSeaBase = eventSentence;
eventSentence = function (e) {
  const d = e.data || {};
  switch (e.type) {
    case "CatchEvent":
      return d.heavy
        ? `The nets came in heavy at ${d.place}: ${d.name} landed ${d.amount} units.`
        : `${d.name} brought ${d.amount} units of the catch into ${d.place}.`;
    case "VoyageEvent":
      return `${d.settlers} settlers set sail from ${d.place} for a shore ${d.distance} tiles across the water.`;
    case "ColonyEvent":
      return `Settlers from ${d.place} landed across the water and founded ${d.camp}.`;
    case "VoyageLostEvent":
      return `The voyage from ${d.place} came to nothing: ${d.reason}.`;
    default:
      return eventSentenceSeaBase(e);
  }
};
// ── Legends ────────────────────────────────────────────────────────────────────
const renderPlacePageSeaBase = renderPlacePage;
renderPlacePage = function (id) {
  const html = renderPlacePageSeaBase(id),
    s = W.settlements.find((x) => x.id === id);
  if (!s || !placeDock(s)) return html;
  ensureSea();
  const catches = legendEvents(
      (e) => e.type === "CatchEvent" && e.subjects?.includes(s.entityId),
    ).length,
    voyages = W.sea.voyages.filter((v) => v.from === s.id),
    colonies = voyages.filter((v) => v.campId).length,
    at = html.indexOf('<div class="subhead">Chronicle</div>');
  const block = `<div class="subhead">Harbour</div><div class="kv"><span>Boats</span><b>${placeSails(s) ? "seagoing" : "shore craft only"}</b><span>Catches of note</span><b>${catches}</b><span>Voyages</span><b>${voyages.length}${colonies ? ` · ${colonies} landed` : ""}</b></div>`;
  return at < 0 ? html + block : html.slice(0, at) + block + html.slice(at);
};
// ── Drawing ────────────────────────────────────────────────────────────────────
// A dock runs a plank pier out over the water on piles, with a moored boat
// that bobs, a hanging net, and gulls turning above it; fishers cast a line
// with a float; boats under way leave fading ripples; a launch or landing
// rings the shore in light.
function dockWaterDirection(b) {
  let best = null,
    depth = 0;
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const x = b.x + dx,
      y = b.y + dy;
    if (!inside(x, y)) continue;
    const l = W.tiles.liquid[idx(x, y)];
    if (l > depth) {
      depth = l;
      best = [dx, dy];
    }
  }
  return best || [1, 0];
}
function drawDock(g, b, s, r, p, now, detail) {
  const v = ACTIVE_PLANET_VISUAL || makePlanetVisualGenome(),
    [dx, dy] = dockWaterDirection(b),
    ex = dx * r * 1.7 + dy * r * 0.9,
    ey = dy * r * 0.85 - dx * r * 0.2,
    bob = ACTIVE_REDUCED_MOTION ? 0 : Math.sin(now * 0.0025 + b.id) * r * 0.05,
    px = (t) => s.x + ex * t,
    py = (t) => s.y + r * 0.25 + ey * t;
  // Landing platform.
  g.fillStyle = p.base;
  g.strokeStyle = p.dark;
  g.lineWidth = 1;
  g.beginPath();
  g.ellipse(s.x, s.y + r * 0.3, r * 0.6, r * 0.28, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  // Piles, then planks.
  g.strokeStyle = p.dark;
  g.lineWidth = Math.max(1, r * 0.08);
  for (const t of [0.35, 0.7, 1.0]) {
    for (const side of [-1, 1]) {
      const ox = -dy * r * 0.22 * side,
        oy = dx * r * 0.11 * side;
      g.beginPath();
      g.moveTo(px(t) + ox, py(t) + oy - r * 0.35);
      g.lineTo(px(t) + ox, py(t) + oy + r * 0.12);
      g.stroke();
    }
  }
  g.strokeStyle = p.light;
  g.lineWidth = Math.max(2, r * 0.42);
  g.beginPath();
  g.moveTo(px(0), py(0) - r * 0.32);
  g.lineTo(px(1.05), py(1.05) - r * 0.32);
  g.stroke();
  if (detail) {
    g.strokeStyle = p.dark;
    g.lineWidth = 1;
    for (let t = 0.1; t < 1.05; t += 0.12) {
      g.beginPath();
      g.moveTo(px(t) - dy * r * 0.2, py(t) - r * 0.32 + dx * r * 0.1);
      g.lineTo(px(t) + dy * r * 0.2, py(t) - r * 0.32 - dx * r * 0.1);
      g.stroke();
    }
  }
  // Moored boat at the pier's end.
  const bx = px(1.1) + dy * r * 0.5,
    by = py(1.1) + bob + dx * r * 0.2;
  g.fillStyle = hsl(v.mineralHue, 38, 30);
  g.strokeStyle = hsl(v.mineralHue, 30, 16);
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(bx - r * 0.55, by - r * 0.05);
  g.quadraticCurveTo(bx, by + r * 0.35, bx + r * 0.55, by - r * 0.05);
  g.closePath();
  g.fill();
  g.stroke();
  if (detail) {
    // Net drying on a post, and the water lapping the piles.
    const nx = px(0.5) - dy * r * 0.5,
      ny = py(0.5) - r * 0.3 + dx * r * 0.2;
    g.strokeStyle = p.dark;
    g.beginPath();
    g.moveTo(nx, ny + r * 0.1);
    g.lineTo(nx, ny - r * 0.9);
    g.stroke();
    g.strokeStyle = hsl(v.accentHue, 30, 80, 0.7);
    g.lineWidth = 0.8;
    for (let k = 0; k < 4; k++) {
      g.beginPath();
      g.moveTo(nx, ny - r * 0.85 + k * r * 0.14);
      g.quadraticCurveTo(nx + r * 0.3, ny - r * 0.5 + k * r * 0.14, nx + r * 0.05, ny + r * 0.05);
      g.stroke();
    }
    const lap = ACTIVE_REDUCED_MOTION ? 0.5 : 0.5 + 0.5 * Math.sin(now * 0.003 + b.id);
    g.strokeStyle = hsl(v.liquidHue, 60, 78, 0.35 + lap * 0.3);
    g.lineWidth = 1;
    for (const t of [0.7, 1.0]) {
      g.beginPath();
      g.ellipse(
        px(t),
        py(t) + r * 0.14,
        r * (0.35 + lap * 0.12),
        r * (0.12 + lap * 0.04),
        0,
        0,
        Math.PI,
      );
      g.stroke();
    }
  }
}
const drawWorkerActivitySeaBase = drawWorkerActivity;
drawWorkerActivity = function (now, bounds) {
  drawWorkerActivitySeaBase(now, bounds);
  if (UI.quality === "low" || !W.sea) return;
  const m = ACTIVE_RENDER_METRICS || projectionMetrics(),
    v = ACTIVE_PLANET_VISUAL || makePlanetVisualGenome(),
    still = ACTIVE_REDUCED_MOTION,
    clock = performance.now(),
    inView = (x, y) =>
      x >= bounds.x0 - 1 && x <= bounds.x1 + 1 && y >= bounds.y0 - 1 && y <= bounds.y1 + 1;
  if (UI.camera.zoom >= 1.3) {
    let docks = 0;
    for (const b of W.buildings) {
      if (b.type !== "dock" || !b.complete || b.ruined || docks > 6 || !inView(b.x, b.y)) continue;
      docks++;
      const s = proceduralProjectTile(b.x + 0.5, b.y + 0.5, m),
        r = clamp(m.tw * 0.5, 4, 60);
      ctx.strokeStyle = "rgba(250,250,245,0.9)";
      ctx.lineWidth = Math.max(1, r * 0.05);
      for (let k = 0; k < 2; k++) {
        const t = still ? k * 2.1 : clock * 0.0007 + k * 2.1 + b.id,
          gx = s.x + Math.cos(t) * r * 1.6,
          gy = s.y - r * 2.1 + Math.sin(t * 2) * r * 0.35,
          flap = still ? 0.3 : Math.abs(Math.sin(clock * 0.012 + k)) * 0.5,
          w = r * 0.28;
        ctx.beginPath();
        ctx.moveTo(gx - w, gy - w * flap);
        ctx.lineTo(gx, gy + w * 0.2);
        ctx.lineTo(gx + w, gy - w * flap);
        ctx.stroke();
      }
    }
    for (const trip of W.sea.trips) {
      if (!trip.active || trip.phase !== "out") continue;
      const p = W.components.position[trip.personId];
      if (!p || !inView(p.x, p.y)) continue;
      const [gx, gy] = xy(trip.ground);
      if (Math.max(Math.abs(p.x - gx), Math.abs(p.y - gy)) > 2) continue;
      const s = visualAnchor(trip.personId, p, m, now).s,
        g = proceduralProjectTile(gx + 0.5, gy + 0.5, m),
        r = clamp(m.tw * 0.3, 3, 40),
        bob = still ? 0 : Math.sin(clock * 0.004 + trip.id) * r * 0.1;
      ctx.strokeStyle = "rgba(240,240,230,0.7)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(s.x + r * 0.4, s.y - r * 0.9);
      ctx.quadraticCurveTo(s.x + r * 1.1, s.y - r * 1.3, g.x, g.y + bob);
      ctx.stroke();
      ctx.fillStyle = hsl(4, 80, 60, 0.95);
      ctx.beginPath();
      ctx.arc(g.x, g.y + bob, Math.max(1, r * 0.1), 0, Math.PI * 2);
      ctx.fill();
    }
    // Ripples behind anyone under way on open water.
    let ripples = 0;
    for (const order of W.civilOrders || []) {
      if (ripples > 24) break;
      const p = W.components.position[order.id];
      if (!p || !inView(p.x, p.y) || !isWater(idx(p.x, p.y))) continue;
      const motion = visualAnchor(order.id, p, m, now);
      if (!motion.moving) continue;
      const s = motion.s,
        r = clamp(m.tw * 0.3, 3, 40);
      for (let k = 0; k < 3; k++) {
        const t = still ? 0.3 + k * 0.25 : (clock * 0.0008 + k * 0.33 + order.id * 0.1) % 1;
        ctx.strokeStyle = hsl(v.liquidHue, 60, 80, (1 - t) * 0.5);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(
          s.x - t * r * 1.5,
          s.y + r * 0.4 + t * r * 0.3,
          r * (0.4 + t * 1.2),
          r * (0.15 + t * 0.4),
          0,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
      }
      ripples++;
    }
  }
  for (const d of (UI.seaVisuals || []).filter(
    (x) => x.world === W && clock - x.started < 6000 && x.tile >= 0 && x.tile < W.tileCount,
  )) {
    const age = clamp((clock - d.started) / 6000, 0, 1),
      [tx, ty] = xy(d.tile),
      p = proceduralProjectTile(tx + 0.5, ty + 0.5, m);
    ctx.strokeStyle = hsl(
      d.kind === "landing" ? v.accentHue : v.liquidHue,
      70,
      80,
      (1 - age) * 0.7,
    );
    ctx.lineWidth = 2;
    for (let n = 1; n <= 3; n++) {
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, m.tw * age * 4 * n * 0.5, m.th * age * 4 * n * 0.3, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
};
window.ALIFE_SEA_DEBUG = Object.freeze({
  planDock: (settlementId) => {
    const s = W.settlements.find((x) => x.id === settlementId);
    if (!s) return null;
    const b = planBuilding(s, "dock", 3);
    return b ? { id: b.id, x: b.x, y: b.y } : null;
  },
  wantsDock: (settlementId) => placeWantsDock(W.settlements.find((x) => x.id === settlementId)),
  fish: (settlementId) =>
    startFishing(W.settlements.find((x) => x.id === settlementId)).map((t) => ({ ...t })),
  trips: () => (W.sea?.trips || []).map((t) => ({ ...t })),
  tick: () => {
    updateFishing();
    updateVoyages();
  },
  ground: (settlementId) => {
    const s = W.settlements.find((x) => x.id === settlementId),
      dock = s && placeDock(s);
    return dock ? fishingGround(s, dock) : -1;
  },
  site: (settlementId) => colonySite(W.settlements.find((x) => x.id === settlementId)),
  voyage: (settlementId) =>
    launchVoyage(
      W.settlements.find((x) => x.id === settlementId),
      true,
    ),
  voyages: () => (W.sea?.voyages || []).map((v) => ({ ...v, members: v.members.slice() })),
  aboard: (id) => aboardTownBoat(id),
  waterBetween: (a, b) => waterBetween(a, b),
  sails: (settlementId) => placeSails(W.settlements.find((x) => x.id === settlementId)),
});
