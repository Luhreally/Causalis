// ═══════════════════════════════════════════════════════════════════════════
// 52. LIVING SOCIETY: MONUMENTS, CARAVANS, WILDLIFE LIVES, AND CRIME
// ═══════════════════════════════════════════════════════════════════════════
// Monuments engrave history onto the world: a town that has lived through a
// war's end, a succession, a fulfilled prophecy, a naming, or a calamity raises
// a stone to it. Caravans embody the trade the economy already records: real
// people walk the road with real provisions, wear it into a route, and arrive.
// Wildlife keeps lives of its own: herds follow the warmth, predators keep dens
// and return to them, courtship shows, and an old and deadly hunter becomes a
// beast of legend. Crime gives towns their small tragedies: the hungry steal
// from a stranger's store, repeat offenders are exiled, and the wounded losers
// of a war turn are taken captive, to be freed when the war ends or folded into
// their captors. Civil orders reuse the campaign march so travellers move
// through the same effect resolver as everyone else. Nothing here creates or
// destroys matter.
function ensureSociety(world = W) {
  if (!world) return;
  world.civilOrders = world.civilOrders || [];
  world.caravans = world.caravans || [];
  world.captives = world.captives || [];
  world.nextCaravanId = world.nextCaravanId || 1;
}
const restoreWorldLivingSocietyBase = restoreWorldDefaults;
restoreWorldDefaults = function () {
  restoreWorldLivingSocietyBase();
  ensureSociety(W);
};
// ── Civil orders: journeys, caravans, exiles, captives ─────────────────────────
function issueCivilOrder(id, kind, x, y, meta = {}) {
  ensureSociety();
  W.civilOrders = W.civilOrders.filter((o) => o.id !== id);
  const order = { id, kind, x, y, issuedTick: W.tick, ...meta };
  W.civilOrders.push(order);
  applyCivilOrder(order);
  if (typeof clearStaleWork === "function") clearStaleWork(id);
  return order;
}
function applyCivilOrder(order) {
  const orders = W.components.campaign || (W.components.campaign = {});
  orders[order.id] = {
    warId: 0,
    unitId: 0,
    factionId: W.components.social[order.id]?.factionId || 0,
    x: order.x,
    y: order.y,
    placeId: order.placeId || 0,
    role: order.kind,
    issuedTick: order.issuedTick,
  };
}
function clearCivilOrder(id) {
  ensureSociety();
  W.civilOrders = W.civilOrders.filter((o) => o.id !== id);
  if (W.components.campaign?.[id]?.warId === 0) delete W.components.campaign[id];
}
function civilOrderOf(id) {
  return (W.civilOrders || []).find((o) => o.id === id) || null;
}
function orderArrived(order) {
  const p = W.components.position[order.id];
  return !!p && Math.max(Math.abs(p.x - order.x), Math.abs(p.y - order.y)) <= 2;
}
// War orders are rebuilt each cycle and drop anything they did not issue, so
// civil orders are re-asserted after them.
const updateCampaignOrdersSocietyBase = updateCampaignOrders;
updateCampaignOrders = function () {
  updateCampaignOrdersSocietyBase();
  ensureSociety();
  W.civilOrders = W.civilOrders.filter((o) => classifyAlive(o.id) && W.components.position[o.id]);
  for (const order of W.civilOrders)
    if (!W.components.campaign?.[order.id]?.warId) applyCivilOrder(order);
};
const CIVIL_REASONS = Object.freeze({
  caravan: "walking the trade road with the caravan",
  journey: "walking to see what lies beyond the horizon",
  exile: "leaving under sentence of exile",
  captive: "being led away as a captive",
});
const chooseBehaviorSocietyBase = chooseBehavior;
chooseBehavior = function (id, tier) {
  chooseBehaviorSocietyBase(id, tier);
  const l = W.components.life[id];
  if (l?.behavior === "march") {
    const order = civilOrderOf(id);
    if (order) l.behaviorReason = CIVIL_REASONS[order.kind] || l.behaviorReason;
  }
};
function farLandTile(fromX, fromY, minDist, maxDist, salt) {
  for (let attempt = 0; attempt < 24; attempt++) {
    const a = counterRand("civil-angle", salt, attempt) * Math.PI * 2,
      d = minDist + counterRand("civil-dist", salt, attempt) * (maxDist - minDist),
      x = Math.round(fromX + Math.cos(a) * d),
      y = Math.round(fromY + Math.sin(a) * d);
    if (inside(x, y) && W.tiles.liquid[idx(x, y)] <= 140 && W.tiles.fire[idx(x, y)] < 100)
      return [x, y];
  }
  return null;
}
// ── Caravans ───────────────────────────────────────────────────────────────────
// A person is free for a civil duty (a caravan, an embassy, a marriage) when
// they carry no orders, or only a feast or a walk to the horizon, which the
// road interrupts; a column, a caravan, an exile, or a migration is not broken.
function freeForCivilDuty(id) {
  const order = W.components.campaign?.[id];
  return !order || (order.warId === 0 && ["festival", "journey"].includes(order.role));
}
function caravanCandidates(place, count) {
  const voices = new Set(W.factions.map((f) => f.leaderId).filter(Boolean)),
    out = [];
  for (const id of entityAtRadius(idx(place.x, place.y), 6, KINDS.PERSON)) {
    const life = W.components.life[id],
      social = W.components.social[id];
    if (!classifyAlive(id) || !life || voices.has(id) || !freeForCivilDuty(id)) continue;
    if (social?.factionId !== place.factionId || life.hunger > 70 || life.wounded) continue;
    if (life.age < (W.components.body[id]?.maxAge || 19200) * 0.2) continue;
    out.push(id);
  }
  // Idle hands go first; a busy worker is only taken when no one else is free.
  out.sort((a, b) => {
    const ia = W.components.work?.[a]?.task && W.components.work[a].task !== "idle" ? 1 : 0,
      ib = W.components.work?.[b]?.task && W.components.work[b].task !== "idle" ? 1 : 0;
    return ia - ib || a - b;
  });
  return out.slice(0, count);
}
function spawnCaravan(from, to, route, cargoSp = -1, cargoAmount = 0) {
  ensureSociety();
  if (!from || !to || from.id === to.id || from.ruined || to.ruined) return null;
  if (dist2(from.x, from.y, to.x, to.y) < 36) return null;
  if (W.caravans.some((c) => c.routeId === route?.id && c.active)) return null;
  if (settlementPopulation(from) < 6) return null;
  const members = caravanCandidates(from, 2);
  if (!members.length) return null;
  for (const id of members)
    resolveTransfer({
      fromType: "settlement",
      from: from.id,
      toType: "entity",
      to: id,
      amounts: [
        [C.ORGANIC, 6],
        [C.SOLVENT, 6],
      ],
    });
  const caravan = {
    id: W.nextCaravanId++,
    routeId: route?.id || 0,
    from: from.id,
    to: to.id,
    members,
    phase: "outbound",
    startedTick: W.tick,
    cargoSp,
    cargoAmount,
    active: true,
  };
  W.caravans.push(caravan);
  for (const id of members)
    issueCivilOrder(id, "caravan", to.x, to.y, { placeId: to.id, caravanId: caravan.id });
  return caravan;
}
const recordExchangeSocietyBase = recordExchange;
recordExchange = function (a, b, mode, giveSp, giveAmount, returnSp = -1, returnAmount = 0) {
  const route = recordExchangeSocietyBase(a, b, mode, giveSp, giveAmount, returnSp, returnAmount);
  if (route && W.tick > 0) spawnCaravan(a, b, route, giveSp, giveAmount);
  return route;
};
function updateCaravans() {
  ensureSociety();
  for (const caravan of W.caravans) {
    if (!caravan.active) continue;
    caravan.members = caravan.members.filter(
      (id) => classifyAlive(id) && W.components.position[id],
    );
    const from = W.settlements.find((s) => s.id === caravan.from),
      to = W.settlements.find((s) => s.id === caravan.to),
      overdue = W.tick - caravan.startedTick > 1600;
    if (!caravan.members.length || !from || !to || from.ruined || to.ruined || overdue) {
      for (const id of caravan.members) clearCivilOrder(id);
      caravan.active = false;
      caravan.endedTick = W.tick;
      continue;
    }
    const goal = caravan.phase === "outbound" ? to : from,
      arrived = caravan.members.every((id) => {
        const p = W.components.position[id];
        return Math.max(Math.abs(p.x - goal.x), Math.abs(p.y - goal.y)) <= 2;
      });
    if (!arrived) continue;
    if (caravan.phase === "outbound") {
      const route = W.tradeRoutes.find((r) => r.id === caravan.routeId);
      emitEvent("CaravanEvent", {
        subjects: [...caravan.members.slice(0, 2), from.entityId, to.entityId],
        location: idx(to.x, to.y),
        factions: [from.factionId, to.factionId].filter(Boolean),
        causes: [W.lastEventByType.ExchangeEvent].filter(Boolean),
        evidence: [
          `${caravan.members.length} travellers`,
          route ? `${route.trips} trips on this route` : "a first journey",
        ],
        importance: route && route.trips <= 1 ? 3 : 2,
        data: {
          from: from.name,
          to: to.name,
          travellers: caravan.members.length,
          cargo:
            caravan.cargoSp >= 0
              ? W.definitions.species[caravan.cargoSp]?.name || "goods"
              : "word of the exchange",
        },
      });
      caravan.phase = "return";
      for (const id of caravan.members)
        issueCivilOrder(id, "caravan", from.x, from.y, { placeId: from.id, caravanId: caravan.id });
    } else {
      for (const id of caravan.members) clearCivilOrder(id);
      caravan.active = false;
      caravan.endedTick = W.tick;
    }
  }
  if (W.caravans.length > 60)
    W.caravans = W.caravans
      .filter((c) => c.active)
      .concat(W.caravans.filter((c) => !c.active).slice(-20));
}
// ── Journeys, exile, theft, captives ───────────────────────────────────────────
function updateJourneys() {
  for (const id of W.activeIds) {
    if (W.kind[id] !== KINDS.PERSON || !classifyAlive(id)) continue;
    const ident = W.components.identity[id],
      order = civilOrderOf(id);
    if (order) {
      if (
        (order.kind === "journey" || order.kind === "exile") &&
        (orderArrived(order) || W.tick - order.issuedTick > 1500)
      ) {
        clearCivilOrder(id);
        if (order.kind === "journey") ident.significance += 1;
      }
      continue;
    }
    if (ident?.want?.id !== "journey" || W.components.campaign?.[id]) continue;
    if (counterRand("journey", Math.floor(W.tick / 128), id) > 0.3) continue;
    const p = W.components.position[id],
      target = farLandTile(p.x, p.y, 30, 42, id);
    if (target) issueCivilOrder(id, "journey", target[0], target[1]);
  }
}
function stealFood(id, settlement, cause = 0) {
  const ident = W.components.identity[id],
    social = W.components.social[id],
    taken = resolveTransfer({
      fromType: "settlement",
      from: settlement.id,
      toType: "entity",
      to: id,
      amounts: [[C.ORGANIC, 6]],
    });
  if (!taken) return 0;
  ident.crimes = (ident.crimes || 0) + 1;
  settlement.stability = clamp(settlement.stability - 0.01, 0, 1);
  const victimFaction = W.factions.find((f) => f.id === settlement.factionId),
    thiefFaction = social?.factionId ? W.factions.find((f) => f.id === social.factionId) : null,
    crossFaction = !!(victimFaction && thiefFaction && victimFaction.id !== thiefFaction.id);
  if (crossFaction) {
    const rel =
      victimFaction.relations[thiefFaction.id] ||
      (victimFaction.relations[thiefFaction.id] = {
        status: "neutral",
        pressure: 0,
        grievance: 0,
        trade: 0,
      });
    rel.grievance = (rel.grievance || 0) + 1;
    victimFaction.grievances = (victimFaction.grievances || 0) + 1;
  }
  addRelation(id, settlement.entityId, "stole", 1, 0);
  emitEvent("TheftEvent", {
    subjects: [id, settlement.entityId],
    location: idx(settlement.x, settlement.y),
    factions: [settlement.factionId, social?.factionId].filter(Boolean),
    causes: [cause].filter(Boolean),
    evidence: ["hunger past bearing", crossFaction ? "a stranger's store" : "the town's own store"],
    importance: crossFaction ? 3 : 2,
    data: { name: ident.generatedName, place: settlement.name, taken, crimes: ident.crimes },
  });
  return taken;
}
function updateTheft() {
  for (const s of W.settlements) {
    if (s.ruined || (s.inventory?.[C.ORGANIC] || 0) < 20) continue;
    for (const id of entityAtRadius(idx(s.x, s.y), 3, KINDS.PERSON)) {
      const life = W.components.life[id],
        social = W.components.social[id];
      if (!classifyAlive(id) || !life || life.hunger < 75) continue;
      const stranger = social?.factionId !== s.factionId;
      if (!stranger && s.stability > 0.35) continue;
      if (counterRand("theft", Math.floor(W.tick / 64), id) > 0.35) continue;
      stealFood(id, s);
    }
  }
}
function exilePerson(id, settlement, cause = 0) {
  const ident = W.components.identity[id],
    social = W.components.social[id],
    target = farLandTile(settlement.x, settlement.y, 16, 26, id + 7);
  if (!ident || !social || !target) return false;
  ident.titles.push("Exile");
  ident.exiledTick = W.tick;
  ident.significance += 4;
  social.factionId = 0;
  issueCivilOrder(id, "exile", target[0], target[1]);
  setEmotionImpulse(id, { sadness: 0.3, anger: 0.2 }, 0);
  emitEvent("ExileEvent", {
    subjects: [id, settlement.entityId],
    location: idx(settlement.x, settlement.y),
    factions: [settlement.factionId].filter(Boolean),
    causes: [cause].filter(Boolean),
    evidence: [
      `${ident.crimes || 0} thefts remembered`,
      `stability ${Math.round(settlement.stability * 100)}%`,
    ],
    importance: 3,
    data: { name: ident.generatedName, place: settlement.name },
  });
  return true;
}
function updateExile() {
  for (const s of W.settlements) {
    if (s.ruined || s.stability > 0.5) continue;
    for (const id of entityAtRadius(idx(s.x, s.y), 8, KINDS.PERSON)) {
      const ident = W.components.identity[id];
      if (!classifyAlive(id) || !ident || (ident.crimes || 0) < 3 || ident.exiledTick) continue;
      if (W.components.social[id]?.factionId !== s.factionId) continue;
      exilePerson(id, s, W.lastEventByType.TheftEvent || 0);
      break;
    }
  }
}
function takeCaptive(id, captorFaction, war = null, cause = 0) {
  ensureSociety();
  const social = W.components.social[id],
    ident = W.components.identity[id],
    capital =
      W.settlements.find((s) => s.id === captorFaction.capitalSettlementId && !s.ruined) ||
      W.settlements.find((s) => s.factionId === captorFaction.id && !s.ruined);
  if (!social || !ident || !capital || social.captiveOf) return false;
  social.captiveOf = captorFaction.id;
  ident.titles.push("Captive");
  W.captives.push({
    id,
    captorFactionId: captorFaction.id,
    homeFactionId: social.factionId,
    since: W.tick,
    warId: war?.id || 0,
  });
  issueCivilOrder(id, "captive", capital.x, capital.y, { placeId: capital.id });
  emitEvent("CaptiveEvent", {
    subjects: [id, captorFaction.entityId],
    location: idx(capital.x, capital.y),
    factions: [captorFaction.id, social.factionId].filter(Boolean),
    causes: [cause].filter(Boolean),
    evidence: ["wounded and overtaken after a battle"],
    importance: 3,
    data: { name: ident.generatedName, captor: captorFaction.name },
  });
  return true;
}
function releaseCaptive(record, outcome) {
  const id = record.id,
    social = W.components.social[id],
    ident = W.components.identity[id],
    captor = W.factions.find((f) => f.id === record.captorFactionId),
    home = W.settlements.find((s) => s.factionId === record.homeFactionId && !s.ruined);
  if (social) social.captiveOf = 0;
  if (ident) ident.titles = ident.titles.filter((t) => t !== "Captive");
  clearCivilOrder(id);
  if (outcome === "freed" && home)
    issueCivilOrder(id, "journey", home.x, home.y, { placeId: home.id });
  if (outcome === "integrated" && social && captor) social.factionId = captor.id;
  emitEvent(outcome === "freed" ? "CaptiveFreedEvent" : "CaptiveIntegratedEvent", {
    subjects: [id, captor?.entityId].filter(Boolean),
    location: W.components.position[id]
      ? idx(W.components.position[id].x, W.components.position[id].y)
      : -1,
    factions: [record.captorFactionId, record.homeFactionId].filter(Boolean),
    causes: [W.lastEventByType.WarEndedEvent].filter(Boolean),
    evidence: [
      outcome === "freed"
        ? "the war that took them ended"
        : `${Math.round((W.tick - record.since) / TICKS_PER_YEAR)} years among their captors`,
    ],
    importance: 2,
    data: {
      name: ident?.generatedName || "a captive",
      captor: captor?.name || "a polity",
      outcome,
    },
  });
}
function updateCaptives() {
  ensureSociety();
  const keep = [];
  for (const record of W.captives) {
    if (!classifyAlive(record.id)) continue;
    const war = record.warId ? W.activeWars.find((w) => w.id === record.warId) : null,
      captorAlive = W.factions.some((f) => f.id === record.captorFactionId && f.stability > 0);
    if (!captorAlive || (war && war.ended)) {
      releaseCaptive(record, "freed");
      continue;
    }
    if (W.tick - record.since > TICKS_PER_YEAR * 3) {
      releaseCaptive(record, "integrated");
      continue;
    }
    keep.push(record);
  }
  W.captives = keep;
}
const resolveImplicitWarTurnSocietyBase = resolveImplicitWarTurn;
resolveImplicitWarTurn = function (war, a, b) {
  const woundedBefore = war.wounded || 0;
  const result = resolveImplicitWarTurnSocietyBase(war, a, b);
  if (war.ended || (war.wounded || 0) <= woundedBefore) return result;
  const attackerId = war.attackPlan?.attackerId || war.a,
    attacker = W.factions.find((f) => f.id === attackerId),
    defender = W.factions.find((f) => f.id === (attackerId === war.a ? war.b : war.a)),
    target = W.settlements.find((s) => s.id === war.attackPlan?.targetSettlementId);
  if (!attacker || !defender || !target || attacker.cohesion < 0.45) return result;
  if (counterRand("captive", war.id, war.turns) > 0.5) return result;
  const prisoner = entityAtRadius(idx(target.x, target.y), 6, KINDS.PERSON)
    .filter(
      (id) =>
        classifyAlive(id) &&
        W.components.life[id]?.wounded &&
        W.components.social[id]?.factionId === defender.id &&
        !W.components.social[id].captiveOf,
    )
    .sort((x, y) => x - y)[0];
  if (prisoner) takeCaptive(prisoner, attacker, war, war.lastEventId || 0);
  return result;
};
// ── Monuments ──────────────────────────────────────────────────────────────────
const MONUMENT_TYPES = new Set([
  "WarEndedEvent",
  "SuccessionEvent",
  "ProphecyFulfilledEvent",
  "NamingEvent",
  "EruptionEvent",
  "EarthquakeEvent",
  "MeteorEvent",
]);
function monumentTitle(a) {
  switch (a.type) {
    case "WarEndedEvent":
      return "the war's end";
    case "SuccessionEvent":
      return `the ${a.data?.ordinal ? ordinalWord(a.data.ordinal) : "new"} Voice`;
    case "ProphecyFulfilledEvent":
      return "the prophecy fulfilled";
    case "NamingEvent":
      return `the naming of ${a.data?.name || "the god"}`;
    case "EruptionEvent":
      return "the eruption survived";
    case "EarthquakeEvent":
      return "the earthquake survived";
    case "MeteorEvent":
      return "the falling star";
    default:
      return titleCase(a.type.replace("Event", ""));
  }
}
function commemorableAnnal(place) {
  const since = W.tick - TICKS_PER_YEAR * 8;
  for (let n = (W.annals || []).length - 1; n >= 0; n--) {
    const a = W.annals[n];
    if (a.tick < since) break;
    if (!MONUMENT_TYPES.has(a.type)) continue;
    const near = a.location >= 0 && dist2(...xy(a.location), place.x, place.y) <= 196,
      ours = (a.factions || []).includes(place.factionId);
    if (!near && !ours) continue;
    if (W.buildings.some((b) => b.commemorates === a.id && !b.ruined)) continue;
    return a;
  }
  return null;
}
function planMonument(place, force = false) {
  if (!place?.knownProcesses || place.ruined || place.active === false) return null;
  if (
    !force &&
    (settlementPopulation(place) < 12 ||
      W.tick - (place.lastMonumentTick || -99999) < TICKS_PER_YEAR * 4)
  )
    return null;
  if (
    W.buildings.some(
      (b) =>
        !b.ruined &&
        b.placeKind === "settlement" &&
        b.placeId === place.id &&
        b.type === "monument" &&
        !b.complete,
    )
  )
    return null;
  const annal = commemorableAnnal(place);
  if (!annal) return null;
  const b = planBuilding(place, "monument", 2);
  if (!b) return null;
  b.commemorates = annal.id;
  b.name = `Monument to ${monumentTitle(annal)}`;
  place.lastMonumentTick = W.tick;
  return b;
}
const ensurePlacePlansSocietyBase = ensurePlacePlans;
ensurePlacePlans = function (place) {
  ensurePlacePlansSocietyBase(place);
  planMonument(place);
};
const emitEventSocietyBase = emitEvent;
emitEvent = function (type, data = {}) {
  const ev = emitEventSocietyBase(type, data);
  if (type === "BuildingCompletedEvent" && Array.isArray(W?.buildings)) {
    const b = W.buildings.find(
      (x) => x.type === "monument" && x.completedTick === W.tick && idx(x.x, x.y) === ev.location,
    );
    if (b) {
      const place = buildingPlace(b),
        remembered = b.commemorates ? eventById(b.commemorates) : null;
      emitEventSocietyBase("MonumentRaisedEvent", {
        subjects: [place?.entityId].filter(Boolean),
        location: ev.location,
        factions: place?.factionId ? [place.factionId] : [],
        causes: [b.commemorates, ev.id].filter(Boolean),
        evidence: [
          remembered ? `it remembers Year ${remembered.year}` : "it remembers a lost year",
        ],
        importance: 3,
        data: { name: b.name, place: place?.name || "a town" },
      });
    }
  }
  return ev;
};
function drawMonument(g, b, s, r, p, now, detail) {
  const layout = b.architecture?.layout || "rectilinear",
    h = r * 1.35;
  g.fillStyle = p.base;
  g.strokeStyle = p.dark;
  g.lineWidth = 1;
  // Plinth.
  g.beginPath();
  g.ellipse(s.x, s.y + r * 0.3, r * 0.7, r * 0.28, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.fillStyle = p.light;
  if (layout === "radial") {
    for (let n = 0; n < 6; n++) {
      const a = (n * Math.PI) / 3;
      g.beginPath();
      g.rect(
        s.x + Math.cos(a) * r * 0.5 - r * 0.08,
        s.y + r * 0.25 + Math.sin(a) * r * 0.2 - r * 0.45,
        r * 0.16,
        r * 0.45,
      );
      g.fill();
      g.stroke();
    }
  } else if (layout === "terraced") {
    for (let n = 0; n < 3; n++) {
      g.beginPath();
      g.ellipse(
        s.x,
        s.y + r * 0.2 - n * r * 0.3,
        r * (0.42 - n * 0.1),
        r * (0.2 - n * 0.04),
        0,
        0,
        Math.PI * 2,
      );
      g.fill();
      g.stroke();
    }
  } else if (layout === "courtyard") {
    for (const side of [-1, 1]) {
      g.beginPath();
      g.rect(s.x + side * r * 0.42 - r * 0.09, s.y + r * 0.25 - h * 0.7, r * 0.18, h * 0.7);
      g.fill();
      g.stroke();
    }
    g.beginPath();
    g.rect(s.x - r * 0.55, s.y + r * 0.25 - h * 0.78, r * 1.1, r * 0.12);
    g.fill();
    g.stroke();
  } else if (layout === "branching" || layout === "hive") {
    g.beginPath();
    g.rect(s.x - r * 0.08, s.y + r * 0.25 - h * 0.75, r * 0.16, h * 0.75);
    g.fill();
    g.stroke();
    g.fillStyle = p.accent;
    g.beginPath();
    if (layout === "hive")
      for (let n = 0; n < 6; n++) {
        const a = Math.PI / 6 + (n * Math.PI) / 3,
          x = s.x + Math.cos(a) * r * 0.2,
          y = s.y + r * 0.25 - h * 0.78 + Math.sin(a) * r * 0.2;
        if (n) g.lineTo(x, y);
        else g.moveTo(x, y);
      }
    else g.arc(s.x, s.y + r * 0.25 - h * 0.8, r * 0.18, 0, Math.PI * 2);
    g.closePath();
    g.fill();
  } else {
    g.beginPath();
    g.moveTo(s.x - r * 0.14, s.y + r * 0.25);
    g.lineTo(s.x - r * 0.08, s.y + r * 0.25 - h);
    g.lineTo(s.x + r * 0.08, s.y + r * 0.25 - h);
    g.lineTo(s.x + r * 0.14, s.y + r * 0.25);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = p.accent;
    g.beginPath();
    g.moveTo(s.x - r * 0.08, s.y + r * 0.25 - h);
    g.lineTo(s.x, s.y + r * 0.25 - h - r * 0.16);
    g.lineTo(s.x + r * 0.08, s.y + r * 0.25 - h);
    g.closePath();
    g.fill();
  }
  if (detail) {
    g.strokeStyle = p.accent;
    g.lineWidth = Math.max(0.8, r * 0.04);
    g.beginPath();
    for (let n = 1; n <= 3; n++) {
      const y = s.y + r * 0.25 - h * 0.2 * n;
      g.moveTo(s.x - r * 0.06, y);
      g.lineTo(s.x + r * 0.06, y);
    }
    g.stroke();
  }
}
const renderPlacePageSocietyBase = renderPlacePage;
renderPlacePage = function (id) {
  const html = renderPlacePageSocietyBase(id),
    monuments = W.buildings.filter(
      (b) => b.type === "monument" && b.placeKind === "settlement" && b.placeId === id && !b.ruined,
    );
  if (!monuments.length) return html;
  return (
    html +
    `<div class="subhead">Monuments</div><div class="legend-timeline">${monuments
      .map((b) => {
        const remembered = b.commemorates ? eventById(b.commemorates) : null;
        return `<div class="legend-row" ${b.commemorates ? `data-legend="event:${b.commemorates}"` : ""}><span class="legend-year">${remembered ? `Y${remembered.year}` : "—"}</span><span>${esc(b.name)}${b.complete ? "" : " · being raised"}${remembered ? `<br><small class="muted">${esc(eventSentence(remembered))}</small>` : ""}</span></div>`;
      })
      .join("")}</div>`
  );
};
// ── Wildlife lives ─────────────────────────────────────────────────────────────
const chooseHerdPastureSocietyBase = chooseHerdPasture;
chooseHerdPasture = function (place, herd) {
  const best = chooseHerdPastureSocietyBase(place, herd),
    offsets = W.tiles.seasonOffset,
    amplitude = W.terrainGenome?.landform?.season?.amplitude || 0;
  if (!offsets || !amplitude || offsets[idx(place.x, place.y)] > -amplitude * 0.4) return best;
  // In the cold half of the year a herd is walked to the warmest grazing within reach.
  let warm = best,
    warmScore = -Infinity;
  const bestFood = tileFood(best, "grazer");
  for (let y = Math.max(0, place.y - 7); y <= Math.min(W.height - 1, place.y + 7); y += 2)
    for (let x = Math.max(0, place.x - 7); x <= Math.min(W.width - 1, place.x + 7); x += 2) {
      const tile = idx(x, y);
      if (W.tiles.liquid[tile] > 650 || W.tiles.fire[tile] > 100) continue;
      const food = tileFood(tile, "grazer");
      if (food < bestFood * 0.6) continue;
      const score =
        W.tiles.temperature[tile] + food * 0.5 - Math.sqrt(dist2(x, y, place.x, place.y)) * 2;
      if (score > warmScore) {
        warmScore = score;
        warm = tile;
      }
    }
  return warm;
};
function seasonalDrift(id) {
  const p = W.components.position[id],
    offsets = W.tiles.seasonOffset,
    amplitude = W.terrainGenome?.landform?.season?.amplitude || 0;
  if (!p || !offsets || !amplitude) return;
  const here = idx(p.x, p.y);
  if (offsets[here] > -amplitude * 0.5 || tileFood(here, "grazer") > 15) return;
  // Toward the equator of the climate axis: the direction in which the offset rises.
  let bestDx = 0,
    bestDy = 0,
    bestOffset = offsets[here];
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const x = p.x + dx * 3,
      y = p.y + dy * 3;
    if (!inside(x, y)) continue;
    const o = offsets[idx(x, y)];
    if (o > bestOffset) ((bestOffset = o), (bestDx = dx), (bestDy = dy));
  }
  if (bestDx || bestDy)
    queueEffect("MoveEntity", { entityId: id, x: p.x + bestDx, y: p.y + bestDy });
}
function denFor(id) {
  const life = W.components.life[id],
    p = W.components.position[id];
  if (!life || !p) return -1;
  if (life.denTile >= 0 && life.denTile < W.tileCount) return life.denTile;
  if (life.age < (W.components.body[id]?.maxAge || 3000) * 0.25) return -1;
  let best = idx(p.x, p.y),
    bestScore = -Infinity;
  for (let dy = -6; dy <= 6; dy += 2)
    for (let dx = -6; dx <= 6; dx += 2) {
      const x = p.x + dx,
        y = p.y + dy;
      if (!inside(x, y)) continue;
      const tile = idx(x, y),
        feature = W.tiles.featureType[tile],
        score =
          (feature === TERRAIN_FEATURE.CAVERN
            ? 60
            : feature === TERRAIN_FEATURE.HIGHLAND
              ? 40
              : 0) +
          W.tiles.elevation[tile] / 40 -
          (W.tiles.liquid[tile] > 140 ? 500 : 0) -
          W.tiles.danger[tile] / 20 -
          (settlementNear(tile, 6) ? 200 : 0) +
          counterRand("den", id, tile) * 4;
      if (score > bestScore) {
        bestScore = score;
        best = tile;
      }
    }
  life.denTile = best;
  return best;
}
function updateWildlife() {
  for (const id of W.activeIds) {
    if (!classifyAlive(id)) continue;
    const kind = W.kind[id];
    if (kind === KINDS.HERBIVORE) {
      if (typeof herdForAnimal === "function" && herdForAnimal(id)) continue;
      if (counterRand("drift", Math.floor(W.tick / 64), id) < 0.5) seasonalDrift(id);
    } else if (kind === KINDS.PREDATOR) {
      const den = denFor(id),
        life = W.components.life[id],
        p = W.components.position[id];
      if (den < 0 || !p) continue;
      const [dx, dy] = xy(den);
      if (life.hunger < 45 && Math.max(Math.abs(dx - p.x), Math.abs(dy - p.y)) > 8)
        queueEffect("MoveEntity", {
          entityId: id,
          x: p.x + Math.sign(dx - p.x),
          y: p.y + Math.sign(dy - p.y),
        });
    }
  }
}
function updateBeastsOfLegend() {
  for (const id of W.activeIds) {
    if (W.kind[id] !== KINDS.PREDATOR || !classifyAlive(id)) continue;
    const ident = W.components.identity[id],
      life = W.components.life[id],
      body = W.components.body[id];
    if (!ident || ident.beastOfLegend || !life || !body) continue;
    const old = life.age >= (body.maxAge || 3000) * 0.6,
      huge = (peekPhenotype(id)?.size || 1) >= 1.25,
      deadly = (ident.kills || 0) >= (huge ? 3 : 4);
    if (!(old && deadly)) continue;
    // Legends are rare: at most one new beast in any four years.
    if (W.tick - (W.living?.lastBeastTick || -99999) < TICKS_PER_YEAR * 4) continue;
    if (W.living) W.living.lastBeastTick = W.tick;
    const g = W.components.genome[id],
      species =
        W.speciesRegistry[`${KINDS.PREDATOR}:${g?.lineageId}`]?.name ||
        speciesLabel(KINDS.PREDATOR, g?.lineageId || 0);
    ident.beastOfLegend = true;
    ident.notable = true;
    ident.titles.push(`Great ${species.split(" ").pop()}`);
    ident.significance += 20;
    emitEvent("BeastOfLegendEvent", {
      subjects: [id],
      location: idx(W.components.position[id].x, W.components.position[id].y),
      evidence: [
        `${ident.kills || 0} kills`,
        `${(life.age / TICKS_PER_YEAR).toFixed(1)} years old`,
        huge ? "of unusual size" : "of ordinary size",
      ],
      importance: 3,
      data: { name: ident.generatedName, species, kills: ident.kills || 0 },
    });
  }
}
// Dens and courtship are drawn, never simulated, from state the simulation holds.
const drawWorkerActivitySocietyBase = drawWorkerActivity;
drawWorkerActivity = function (now, bounds) {
  drawWorkerActivitySocietyBase(now, bounds);
  if (UI.quality === "low" || UI.camera.zoom < 1.6) return;
  const m = ACTIVE_RENDER_METRICS || projectionMetrics(),
    v = ACTIVE_PLANET_VISUAL || makePlanetVisualGenome();
  for (const id of W.activeIds) {
    const kind = W.kind[id];
    if (kind !== KINDS.PREDATOR && kind !== KINDS.HERBIVORE && kind !== KINDS.PERSON) continue;
    const life = W.components.life[id],
      p = W.components.position[id];
    if (!life || !p) continue;
    if (kind === KINDS.PREDATOR && life.denTile >= 0) {
      const [dx, dy] = xy(life.denTile);
      if (dx >= bounds.x0 && dx <= bounds.x1 && dy >= bounds.y0 && dy <= bounds.y1) {
        const d = proceduralProjectTile(dx + 0.5, dy + 0.5, m),
          r = clamp(m.tw * 0.18, 2, 14);
        ctx.strokeStyle = hsl(v.mineralHue, 20, 78, 0.55);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(d.x - r, d.y + r * 0.3);
        ctx.lineTo(d.x + r, d.y - r * 0.3);
        ctx.moveTo(d.x - r * 0.8, d.y - r * 0.35);
        ctx.lineTo(d.x + r * 0.8, d.y + r * 0.35);
        ctx.stroke();
      }
    }
    if (
      life.behavior === "mate" &&
      !ACTIVE_REDUCED_MOTION &&
      p.x >= bounds.x0 &&
      p.x <= bounds.x1 &&
      p.y >= bounds.y0 &&
      p.y <= bounds.y1
    ) {
      const s = visualAnchor(id, p, m, now).s,
        pulse = 0.5 + 0.5 * Math.sin(now * 0.006 + id),
        r = clamp(m.tw * 0.32, 4, 40) * (1 + pulse * 0.4);
      ctx.strokeStyle = hsl(v.accentHue, 80, 70, 0.25 + pulse * 0.35);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, r, r * 0.6, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
};
// ── Tick hook ──────────────────────────────────────────────────────────────────
const updateWeatherCycleSocietyBase = updateWeatherCycle;
updateWeatherCycle = function () {
  updateWeatherCycleSocietyBase();
  ensureSociety(W);
  if (W.tick % 8 === 4) updateCaravans();
  if (W.tick % 64 === 20) {
    updateTheft();
    updateWildlife();
  }
  if (W.tick % 128 === 72) {
    updateJourneys();
    updateExile();
    updateCaptives();
    updateBeastsOfLegend();
  }
};
// ── Chronicle sentences ────────────────────────────────────────────────────────
const eventSentenceLivingSocietyBase = eventSentence;
eventSentence = function (e) {
  switch (e.type) {
    case "CaravanEvent":
      return `A caravan of ${e.data.travellers} from ${e.data.from} reached ${e.data.to} carrying ${e.data.cargo}.`;
    case "TheftEvent":
      return `${e.data.name} stole ${e.data.taken} units of food from ${e.data.place}${e.data.crimes > 1 ? ` (${e.data.crimes} thefts now)` : ""}.`;
    case "ExileEvent":
      return `${e.data.name} was exiled from ${e.data.place}.`;
    case "CaptiveEvent":
      return `${e.data.name} was taken captive by ${e.data.captor}.`;
    case "CaptiveFreedEvent":
      return `${e.data.name} was freed by ${e.data.captor} and set out for home.`;
    case "CaptiveIntegratedEvent":
      return `${e.data.name}, long a captive, became one of ${e.data.captor}.`;
    case "MonumentRaisedEvent":
      return `${e.data.place} raised the ${e.data.name}.`;
    case "BeastOfLegendEvent":
      return `${e.data.name} grew into a beast of legend among the ${e.data.species}, with ${countNoun(e.data.kills, "kill")}.`;
    default:
      return eventSentenceLivingSocietyBase(e);
  }
};
window.ALIFE_SOCIETY_DEBUG = Object.freeze({
  caravan: (fromId, toId) => {
    const from = W.settlements.find((s) => s.id === fromId),
      to = W.settlements.find((s) => s.id === toId);
    return spawnCaravan(from, to, tradeRouteBetween(from, to, "barter"), C.ORGANIC, 6);
  },
  caravans: () => (W.caravans || []).map((c) => ({ ...c })),
  orders: () => (W.civilOrders || []).map((o) => ({ ...o })),
  tick: () => {
    updateCampaignOrders();
    updateCaravans();
  },
  steal: (id, settlementId) =>
    stealFood(
      id,
      W.settlements.find((s) => s.id === settlementId),
    ),
  exile: (id, settlementId) =>
    exilePerson(
      id,
      W.settlements.find((s) => s.id === settlementId),
    ),
  capture: (id, factionId) =>
    takeCaptive(
      id,
      W.factions.find((f) => f.id === factionId),
    ),
  releaseAll: () => {
    for (const record of (W.captives || []).slice()) releaseCaptive(record, "freed");
    W.captives = [];
  },
  planMonument: (settlementId) => {
    const s = W.settlements.find((x) => x.id === settlementId),
      b = s ? planMonument(s, true) : null;
    return b ? { id: b.id, name: b.name, commemorates: b.commemorates } : null;
  },
  journey: (id, x, y) => issueCivilOrder(id, "journey", x, y),
  dens: () => {
    updateWildlife();
    return W.activeIds.filter(
      (id) => W.kind[id] === KINDS.PREDATOR && W.components.life[id]?.denTile >= 0,
    ).length;
  },
  legend: (id) => {
    const life = W.components.life[id],
      body = W.components.body[id];
    if (!life || !body) return false;
    life.age = Math.max(life.age, body.maxAge * 0.65);
    W.components.identity[id].kills = Math.max(W.components.identity[id].kills || 0, 4);
    updateBeastsOfLegend();
    return !!W.components.identity[id].beastOfLegend;
  },
  pasture: (settlementId) => {
    const s = W.settlements.find((x) => x.id === settlementId);
    return s ? chooseHerdPasture(s, null) : -1;
  },
});
