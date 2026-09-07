// ═══════════════════════════════════════════════════════════════════════════
// 83. AFTERMATH — ruins are reoccupied, refugees walk, thin towns are colonised
// ═══════════════════════════════════════════════════════════════════════════
// Two of three long worlds had eighteen ruined towns by year two hundred, and
// a ruin stayed a ruin: settlers looked for virgin ground, a sacked town's
// survivors scattered into the wild, and a captured or emptied town dwindled
// until its population reached nothing and the chronicle wrote "population
// dispersed". Here the aftermath of a fall is lived through. Settlers prefer
// a ruin to virgin ground when one lies within reach, and a town raised on a
// ruin inherits part of what the dead town knew from what is left in it. When
// a town falls, its survivors walk to the nearest friendly town and settle
// there instead of dispersing. And a town of a polity that has fallen thin
// (a captured town, a town after plague or siege) receives colonists from the
// polity's largest town, so it recovers instead of emptying. Every walk is a
// real journey and every arrival is chronicled.
const AFTERMATH_RUIN_REACH = 30,
  AFTERMATH_RUIN_CHANCE = 0.6,
  AFTERMATH_REFUGEE_REACH = 60,
  AFTERMATH_THIN = 4,
  AFTERMATH_COLONISTS = 3,
  AFTERMATH_COLONY_REST = 768,
  AFTERMATH_INHERIT_SHARE = 0.5;
function ruinsNear(x, y, reach) {
  return W.settlements
    .filter((s) => s.ruined && Math.sqrt(dist2(s.x, s.y, x, y)) <= reach)
    .sort((a, b) => dist2(a.x, a.y, x, y) - dist2(b.x, b.y, x, y) || a.id - b.id);
}
// A ruin within reach is a better site than virgin ground: cleared land,
// rubble to salvage, and a name the chronicle remembers.
function ruinSiteFor(place) {
  const from = idx(place.x, place.y);
  for (const ruin of ruinsNear(place.x, place.y, AFTERMATH_RUIN_REACH)) {
    const d = Math.sqrt(dist2(ruin.x, ruin.y, place.x, place.y));
    if (d < 8) continue;
    const tile = idx(ruin.x, ruin.y);
    if (W.tiles.liquid[tile] > WATER_DEPTH.SURFACE || W.tiles.fire[tile] >= 100) continue;
    if (campNear(tile, 6) || nearestSettlement(tile, 9)) continue;
    if (W.tiles.owner[tile] && W.tiles.owner[tile] !== place.factionId) continue;
    if (tileFood(tile, "omnivore") < 3) continue;
    if (
      typeof civilReachable === "function" &&
      !civilReachable(from, { x: ruin.x, y: ruin.y }, place.factionId || 0)
    )
      continue;
    return tile;
  }
  return -1;
}
const settlerSiteAftermathBase = settlerSite;
settlerSite = function (place) {
  const cycle = Math.floor(W.tick / 256);
  if (counterRand("settle-ruin", cycle, place.id) < AFTERMATH_RUIN_CHANCE) {
    const ruin = ruinSiteFor(place);
    if (ruin >= 0) return ruin;
  }
  return settlerSiteAftermathBase(place);
};
// A town raised on a ruin inherits part of what the dead town knew.
const createSettlementAftermathBase = createSettlement;
createSettlement = function (campId, cause = 0) {
  const s = createSettlementAftermathBase(campId, cause);
  if (!s) return s;
  const ruin = ruinsNear(s.x, s.y, 3)[0];
  if (!ruin || !ruin.knownProcesses?.length) return s;
  const crafts = ruin.knownProcesses
      .slice()
      .sort()
      .filter((t) => !s.knownProcesses.includes(t)),
    keep = Math.floor(crafts.length * AFTERMATH_INHERIT_SHARE),
    inherited = crafts
      .filter((t, i) => i < keep || hashParts(W.seedHash, "ruin-craft", s.id, t) % 2 === 0)
      .slice(0, Math.max(keep, 1));
  for (const t of inherited) s.knownProcesses.push(t);
  s.resettledFrom = ruin.name;
  const ev = emitEvent("SettlementResettledEvent", {
    subjects: [s.entityId, ruin.entityId],
    location: idx(s.x, s.y),
    factions: [s.factionId].filter(Boolean),
    causes: [ruin.importantEvents?.at(-1) || 0].filter(Boolean),
    evidence: [
      `${s.name} rose on the ruins of ${ruin.name}`,
      inherited.length
        ? `${inherited.length} of its crafts were found again in what was left: ${inherited.join(", ")}`
        : "nothing of its crafts survived to be found",
    ],
    importance: 3,
    data: { name: s.name, ruin: ruin.name, crafts: inherited.length },
  });
  s.importantEvents.push(ev.id);
  return s;
};
// ── Refugees ───────────────────────────────────────────────────────────────────
function refugeFor(town) {
  const faction = W.factions.find((f) => f.id === town.factionId),
    from = idx(town.x, town.y);
  let best = null,
    score = -Infinity;
  for (const other of W.settlements) {
    if (other === town || other.ruined || !other.knownProcesses) continue;
    const d = Math.sqrt(dist2(other.x, other.y, town.x, town.y));
    if (d > AFTERMATH_REFUGEE_REACH) continue;
    const otherFaction = W.factions.find((f) => f.id === other.factionId),
      same = other.factionId && other.factionId === town.factionId;
    if (!same && typeof atPeaceForRelief === "function" && !atPeaceForRelief(otherFaction, faction))
      continue;
    const s = (same ? 40 : 0) + settlementFood(other) * 0.5 - d * 0.6;
    if (
      s > score &&
      (typeof civilReachable !== "function" ||
        civilReachable(from, { x: other.x, y: other.y }, town.factionId || 0))
    ) {
      score = s;
      best = other;
    }
  }
  return best;
}
const ruinSettlementAftermathBase = ruinSettlement;
ruinSettlement = function (s, causes = [], evidence = "structural material failed") {
  const survivors =
    s && !s.ruined
      ? entityAtRadius(idx(s.x, s.y), 8, KINDS.PERSON).filter(
          (id) =>
            classifyAlive(id) &&
            W.components.social[id]?.homePlaceId === s.id &&
            !W.components.campaign?.[id]?.warId,
        )
      : [];
  const ev = ruinSettlementAftermathBase(s, causes, evidence);
  if (!ev || !survivors.length) return ev;
  const refuge = refugeFor(s);
  if (!refuge) {
    ev.evidence.push(`${survivors.length} survivors had no town within reach to flee to`);
    return ev;
  }
  let sent = 0;
  for (const id of survivors) {
    if (civilOrderOf(id)) continue;
    issueCivilOrder(id, "migrate", refuge.x, refuge.y, { placeId: refuge.id, fromPlaceId: s.id });
    sent++;
  }
  if (!sent) return ev;
  ev.evidence.push(`${sent} survivors set out for ${refuge.name}`);
  emitEvent("RefugeesEvent", {
    subjects: [s.entityId, refuge.entityId],
    location: idx(s.x, s.y),
    factions: [s.factionId, refuge.factionId].filter(Boolean),
    causes: [ev.id],
    evidence: [
      `${sent} people left the ruins of ${s.name}`,
      `${refuge.name} lay ${Math.round(Math.sqrt(dist2(s.x, s.y, refuge.x, refuge.y)))} tiles away`,
    ],
    importance: 3,
    data: { count: sent, from: s.name, to: refuge.name },
  });
  return ev;
};
// ── Colonists for thin towns ───────────────────────────────────────────────────
function colonySource(town) {
  return W.settlements
    .filter(
      (s) =>
        s !== town &&
        !s.ruined &&
        s.knownProcesses &&
        s.factionId === town.factionId &&
        settlementPopulation(s) >= 10 &&
        settlementFood(s) >= 12 &&
        Math.sqrt(dist2(s.x, s.y, town.x, town.y)) <= AFTERMATH_REFUGEE_REACH,
    )
    .sort((a, b) => settlementPopulation(b) - settlementPopulation(a) || a.id - b.id)[0];
}
function sendColonists(town, force = false) {
  if (!town || town.ruined || !town.knownProcesses || !town.factionId) return null;
  if (!force && W.tick - (town.lastColonyTick || -99999) < AFTERMATH_COLONY_REST) return null;
  const pop = settlementPopulation(town);
  if (!force && pop >= AFTERMATH_THIN) return null;
  const source = colonySource(town);
  if (!source) return null;
  const from = idx(source.x, source.y);
  if (
    typeof civilReachable === "function" &&
    !civilReachable(from, { x: town.x, y: town.y }, town.factionId || 0)
  )
    return null;
  const movers =
    typeof caravanCandidates === "function" ? caravanCandidates(source, AFTERMATH_COLONISTS) : [];
  if (!movers.length) return null;
  for (const id of movers)
    issueCivilOrder(id, "migrate", town.x, town.y, { placeId: town.id, fromPlaceId: source.id });
  town.lastColonyTick = W.tick;
  return emitEvent("ColonistsEvent", {
    subjects: [...movers, town.entityId, source.entityId],
    location: idx(town.x, town.y),
    factions: [town.factionId],
    causes: [town.importantEvents.at(-1) || 0].filter(Boolean),
    evidence: [
      `${town.name} held ${pop} people${town.occupation?.active ? " under occupation" : ""}`,
      `${movers.length} colonists set out from ${source.name}`,
    ],
    importance: 2,
    data: {
      count: movers.length,
      from: source.name,
      to: town.name,
      occupied: !!town.occupation?.active,
    },
  });
}
function updateColonists() {
  const sent = [];
  for (const town of W.settlements) {
    const ev = sendColonists(town);
    if (ev) sent.push(ev);
  }
  return sent;
}
const simTickAftermathBase = simTick;
simTick = function () {
  simTickAftermathBase();
  if (W?.settlements && W.tick % 256 === 200) updateColonists();
};
// ── Chronicle ──────────────────────────────────────────────────────────────────
const eventSentenceAftermathBase = eventSentence;
eventSentence = function (e) {
  const d = e.data || {};
  if (e.type === "SettlementResettledEvent")
    return `${d.name} rose on the ruins of ${d.ruin}${d.crafts ? `, and ${d.crafts} of the old crafts were found again in the rubble` : ""}.`;
  if (e.type === "RefugeesEvent") return `${d.count} survivors of ${d.from} walked to ${d.to}.`;
  if (e.type === "ColonistsEvent")
    return `${d.count} colonists left ${d.from} for thinly held ${d.to}${d.occupied ? ", newly taken" : ""}.`;
  return eventSentenceAftermathBase(e);
};
const alertWorthyAftermathBase = alertWorthy;
alertWorthy = function (a) {
  return (
    alertWorthyAftermathBase(a) ||
    a.type === "SettlementResettledEvent" ||
    a.type === "RefugeesEvent"
  );
};
const renderPlacePageAftermathBase = renderPlacePage;
renderPlacePage = function (id) {
  const html = renderPlacePageAftermathBase(id),
    s = W.settlements.find((x) => x.id === id);
  if (!s?.resettledFrom) return html;
  const row = `<div class="kv"><span>Raised on</span><b>the ruins of ${esc(s.resettledFrom)}</b></div>`,
    at = html.indexOf('<div class="subhead">');
  return at < 0 ? html + row : html.slice(0, at) + row + html.slice(at);
};
window.ALIFE_AFTERMATH_DEBUG = Object.freeze({
  ruinSite: (settlementId) => ruinSiteFor(W.settlements.find((s) => s.id === settlementId)),
  refuge: (settlementId) =>
    refugeFor(W.settlements.find((s) => s.id === settlementId))?.name || null,
  colonists: (settlementId, force = true) =>
    sendColonists(
      W.settlements.find((s) => s.id === settlementId),
      force,
    ),
  source: (settlementId) =>
    colonySource(W.settlements.find((s) => s.id === settlementId))?.name || null,
  ruins: () => W.settlements.filter((s) => s.ruined).map((s) => s.name),
});
