// ═══════════════════════════════════════════════════════════════════════════
// 82. GRANARY — towns answer scarcity before it becomes famine
// ═══════════════════════════════════════════════════════════════════════════
// A town of sixty planned the same one or two farms and one stockpile as a
// town of six, redistributed food to a hungry neighbour fourteen units at a
// time, sent settlers only when it felt like it, and let its people eat the
// stores to nothing in a day. Once a world passed a hundred and fifty people a
// third of them were hungry and the population boomed and crashed. Here a town
// reads its own outlook. Farms and granaries scale with the people they feed
// and grow when the stores run lean; rations are stretched when the stores are
// low so nobody eats the last of them at once; a starving town's neighbours
// send relief by the caravan-load; a crowded, hungry town sends settlers
// sooner and its starving households walk to a fed town nearby and settle
// there; and births slow when the stores cannot carry more mouths. Every
// transfer is a real move of conserved matter, and every relief and migration
// is chronicled.
const GRANARY_PEOPLE_PER_FARM = 8,
  GRANARY_PEOPLE_PER_STORE = 14,
  GRANARY_MAX_FARMS = 6,
  GRANARY_MAX_STORES = 4,
  GRANARY_ACTIVE_CAP = 6,
  LEAN_FOOD = 10,
  FAMINE_FOOD = 5,
  RELIEF_LOAD = 60,
  RELIEF_REACH = 58,
  RELIEF_CADENCE = 128,
  MIGRATE_REACH = 40,
  MIGRATE_PER_PASS = 3,
  MIGRATE_TIMEOUT = 2000;
function granaryResidents(place) {
  const out = [];
  for (const id of entityAtRadius(idx(place.x, place.y), 7, KINDS.PERSON))
    if (classifyAlive(id) && W.components.social[id]?.homePlaceId === place.id) out.push(id);
  return out;
}
function hungryShare(place) {
  const residents = granaryResidents(place);
  if (!residents.length) return 0;
  let hungry = 0;
  for (const id of residents) if ((W.components.life[id]?.hunger || 0) > 60) hungry++;
  return hungry / residents.length;
}
function foodOutlook(place) {
  if (!place || place.ruined || !place.knownProcesses) return null;
  const food = settlementFood(place),
    hungry = hungryShare(place),
    pop = settlementPopulation(place);
  return {
    food,
    stock: place.inventory[C.ORGANIC] || 0,
    pop,
    hungry,
    lean: food < LEAN_FOOD || hungry > 0.25,
    famine: food < FAMINE_FOOD || hungry > 0.4,
  };
}
function granaryCount(place, type) {
  return W.buildings.filter(
    (b) => !b.ruined && b.placeKind === "settlement" && b.placeId === place.id && b.type === type,
  ).length;
}
// Farms and granaries scale with the mouths they feed, and lean stores add one.
const ensurePlacePlansGranaryBase = ensurePlacePlans;
ensurePlacePlans = function (place) {
  ensurePlacePlansGranaryBase(place);
  if (!place?.knownProcesses || place.ruined || place.active === false) return;
  const outlook = foodOutlook(place);
  if (!outlook) return;
  const pr = place.management?.priorities || {},
    foodPriority = Math.max(pr.food || 3, outlook.famine ? 5 : outlook.lean ? 4 : 0),
    desiredFarms =
      clamp(Math.ceil(outlook.pop / GRANARY_PEOPLE_PER_FARM), 1, GRANARY_MAX_FARMS) +
      (outlook.lean ? 1 : 0),
    desiredStores = clamp(Math.ceil(outlook.pop / GRANARY_PEOPLE_PER_STORE), 1, GRANARY_MAX_STORES);
  while (
    granaryCount(place, "farm") < desiredFarms &&
    activeBuildings(place).length < GRANARY_ACTIVE_CAP
  )
    if (!planBuilding(place, "farm", foodPriority)) break;
  while (
    granaryCount(place, "stockpile") < desiredStores &&
    activeBuildings(place).length < GRANARY_ACTIVE_CAP
  )
    if (!planBuilding(place, "stockpile", Math.max(pr.materials || 3, outlook.lean ? 4 : 0))) break;
  if (outlook.lean && place.management?.priorities)
    place.management.priorities.food = Math.max(place.management.priorities.food || 0, 4);
};
// Seed corn: enough food to sow the fallow fields is kept back from the daily
// draw, so a hungry town does not eat the seed of next season's harvest.
function seedReserve(place) {
  if (!place?.knownProcesses || !W.fields) return 0;
  let fallow = 0,
    tiles = 9;
  for (const f of W.fields)
    if (f.placeKind === "settlement" && f.placeId === place.id && f.stage === "fallow") {
      fallow++;
      tiles = Math.max(tiles, f.tiles?.length || 9);
    }
  return Math.min(2, fallow) * tiles;
}
// Stretched rations: the daily draw shrinks as the stores run low.
function rationCap(place) {
  const outlook = foodOutlook(place);
  if (!outlook) return 18;
  return outlook.famine ? 8 : outlook.lean ? 12 : 18;
}
// ── Relief caravans ────────────────────────────────────────────────────────────
function atPeaceForRelief(a, b) {
  if (!a || !b || a === b) return true;
  const rel = a.relations?.[b.id];
  return !rel || !["hostile", "at war"].includes(rel.status);
}
function reliefDonor(town) {
  const faction = W.factions.find((f) => f.id === town.factionId);
  let best = null,
    score = -Infinity;
  for (const donor of W.settlements) {
    if (donor === town || donor.ruined || !donor.knownProcesses) continue;
    const d = Math.sqrt(dist2(donor.x, donor.y, town.x, town.y));
    if (d > RELIEF_REACH) continue;
    const donorFaction = W.factions.find((f) => f.id === donor.factionId);
    if (donor.factionId !== town.factionId && !atPeaceForRelief(donorFaction, faction)) continue;
    if (settlementFood(donor) < 20) continue;
    const surplus = typeof materialSurplus === "function" ? materialSurplus(donor, C.ORGANIC) : 0;
    if (surplus < 16) continue;
    const s = surplus - d * 0.5 + (donor.factionId === town.factionId ? 20 : 0);
    if (s > score) {
      score = s;
      best = { donor, surplus };
    }
  }
  return best;
}
// A town raised mid-run may not yet carry its ledger of exchanges.
function ensureTownEconomy(s) {
  if (s && !s.economy)
    s.economy = { imports: 0, exports: 0, exchangeCount: 0, lastExchangeTick: -1, priceMemory: {} };
  return s;
}
function sendRelief(town, force = false) {
  const outlook = foodOutlook(town);
  if (!outlook || (!force && !outlook.lean)) return null;
  const found = reliefDonor(town);
  if (!found) return null;
  ensureTownEconomy(town);
  ensureTownEconomy(found.donor);
  const { donor, surplus } = found,
    amount = transferSettlementMatter(donor, town, C.ORGANIC, Math.min(RELIEF_LOAD, surplus));
  if (!amount) return null;
  let water = 0;
  if (settlementWater(town) < 8 && (donor.inventory[C.SOLVENT] || 0) > 120)
    water = transferSettlementMatter(donor, town, C.SOLVENT, 40);
  recordExchange(donor, town, "relief", C.ORGANIC, amount, water ? C.SOLVENT : -1, water);
  town.lastReliefTick = W.tick;
  return emitEvent("ReliefEvent", {
    subjects: [town.entityId, donor.entityId],
    location: idx(town.x, town.y),
    factions: [town.factionId, donor.factionId].filter(Boolean),
    causes: [town.importantEvents.at(-1) || 0].filter(Boolean),
    evidence: [
      `${town.name} held ${Math.round(outlook.food)} food for ${outlook.pop} people`,
      `${amount} units of food${water ? ` and ${water} of water` : ""} carried from ${donor.name}`,
    ],
    importance: 3,
    data: {
      to: town.name,
      from: donor.name,
      amount,
      water,
      hungry: Math.round(outlook.hungry * 100),
      crossPolity: donor.factionId !== town.factionId,
    },
  });
}
function updateRelief() {
  const sent = [];
  for (const town of W.settlements) {
    if (town.ruined || !town.knownProcesses) continue;
    if (W.tick - (town.lastReliefTick || -99999) < RELIEF_CADENCE) continue;
    const ev = sendRelief(town);
    if (ev) sent.push(ev);
  }
  return sent;
}
// ── Starving households walk to a fed town ─────────────────────────────────────
function migrationTarget(town) {
  const faction = W.factions.find((f) => f.id === town.factionId),
    from = idx(town.x, town.y);
  let best = null,
    score = -Infinity;
  for (const other of W.settlements) {
    if (other === town || other.ruined || !other.knownProcesses) continue;
    const d = Math.sqrt(dist2(other.x, other.y, town.x, town.y));
    if (d > MIGRATE_REACH) continue;
    const otherFaction = W.factions.find((f) => f.id === other.factionId);
    if (other.factionId !== town.factionId && !atPeaceForRelief(otherFaction, faction)) continue;
    const food = settlementFood(other);
    if (food < 20) continue;
    const s = food - d * 0.4 + (other.factionId === town.factionId ? 15 : 0);
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
function migrateHouseholds(town, force = false) {
  const outlook = foodOutlook(town);
  if (!outlook || (!force && !outlook.famine)) return null;
  const target = migrationTarget(town);
  if (!target) return null;
  const movers = granaryResidents(town)
    .filter((id) => {
      const life = W.components.life[id];
      return (
        life &&
        (force || life.hunger > 65) &&
        !civilOrderOf(id) &&
        !W.components.campaign?.[id] &&
        isAdultPerson(id)
      );
    })
    .sort(
      (a, b) => (W.components.life[b].hunger || 0) - (W.components.life[a].hunger || 0) || a - b,
    )
    .slice(0, MIGRATE_PER_PASS);
  if (!movers.length) return null;
  // Children walk with their parents.
  const household = new Set(movers);
  for (const id of movers)
    for (const child of W.components.identity[id]?.children || [])
      if (
        classifyAlive(child) &&
        !isAdultPerson(child) &&
        W.components.social[child]?.homePlaceId === town.id &&
        !civilOrderOf(child)
      )
        household.add(child);
  for (const id of household)
    issueCivilOrder(id, "migrate", target.x, target.y, {
      placeId: target.id,
      fromPlaceId: town.id,
    });
  town.lastMigrationTick = W.tick;
  return emitEvent("MigrationEvent", {
    subjects: [...household, town.entityId, target.entityId],
    location: idx(town.x, town.y),
    factions: [town.factionId, target.factionId].filter(Boolean),
    causes: [town.importantEvents.at(-1) || 0].filter(Boolean),
    evidence: [
      `${town.name} held ${Math.round(outlook.food)} food and ${Math.round(outlook.hungry * 100)}% of its people were hungry`,
      `${target.name} held ${Math.round(settlementFood(target))} food`,
    ],
    importance: 2,
    data: {
      count: household.size,
      from: town.name,
      to: target.name,
      names: movers.map(entityName),
    },
  });
}
function settleMigrant(id, order) {
  const target = W.settlements.find((s) => s.id === order.placeId && !s.ruined),
    soc = W.components.social[id];
  clearCivilOrder(id);
  if (!target || !soc) return false;
  soc.homePlaceKind = "settlement";
  soc.homePlaceId = target.id;
  if (target.factionId) soc.factionId = target.factionId;
  if (target.cultureId && !soc.cultureId) soc.cultureId = target.cultureId;
  return true;
}
function updateMigrations() {
  const arrived = [];
  for (const order of (W.civilOrders || []).slice()) {
    if (order.kind !== "migrate") continue;
    if (!classifyAlive(order.id)) {
      clearCivilOrder(order.id);
      continue;
    }
    if (orderArrived(order)) {
      if (settleMigrant(order.id, order)) arrived.push(order.id);
    } else if (W.tick - order.issuedTick > MIGRATE_TIMEOUT) clearCivilOrder(order.id);
  }
  return arrived;
}
function updateGranaryFamine() {
  if (W.tick % RELIEF_CADENCE === 96) updateRelief();
  if (W.tick % RELIEF_CADENCE === 40)
    for (const town of W.settlements) {
      if (town.ruined || !town.knownProcesses) continue;
      if (W.tick - (town.lastMigrationTick || -99999) < RELIEF_CADENCE * 2) continue;
      migrateHouseholds(town);
    }
  if (W.tick % 8 === 4) updateMigrations();
}
const simTickGranaryBase = simTick;
simTick = function () {
  simTickGranaryBase();
  if (W && W.settlements) updateGranaryFamine();
};
// ── Hungry, crowded towns send settlers sooner ─────────────────────────────────
const settlerUrgeGranaryBase = settlerUrge;
settlerUrge = function (place) {
  const outlook = foodOutlook(place);
  return (
    settlerUrgeGranaryBase(place) +
    (outlook?.lean && outlook.pop >= 10 ? 0.12 : 0) +
    (outlook?.famine && outlook.pop >= 10 ? 0.15 : 0)
  );
};
const launchSettlersGranaryBase = launchSettlers;
launchSettlers = function (place, force = false) {
  if (!force && place && !place.ruined && place.knownProcesses) {
    const outlook = foodOutlook(place);
    if (
      outlook?.lean &&
      outlook.pop >= 10 &&
      (place.stability || 0) >= 0.15 &&
      W.tick - (place.lastSettlersTick || -99999) >= SETTLER_COOLDOWN &&
      W.camps.filter((c) => c.active).length < CAPS.camp &&
      !(W.expeditions || []).some((e) => e.active && e.from === place.id)
    )
      return launchSettlersGranaryBase(place, true);
  }
  return launchSettlersGranaryBase(place, force);
};
// ── Births answer the stores ───────────────────────────────────────────────────
const fertilityFactorGranaryBase = fertilityFactor;
fertilityFactor = function (id, other) {
  let f = fertilityFactorGranaryBase(id, other);
  const p = W.components.position[id],
    town = p ? nearestSettlement(idx(p.x, p.y), 8) : null,
    outlook = town ? foodOutlook(town) : null;
  if (outlook?.famine) f *= 0.45;
  else if (outlook?.lean) f *= 0.75;
  return clamp(f, 0.1, 1.35);
};
// ── Chronicle and pages ────────────────────────────────────────────────────────
const eventSentenceGranaryBase = eventSentence;
eventSentence = function (e) {
  const d = e.data || {};
  if (e.type === "ReliefEvent")
    return `${d.from} sent ${d.amount} units of food${d.water ? ` and ${d.water} of water` : ""} to ${d.to}, where ${d.hungry}% went hungry.`;
  if (e.type === "MigrationEvent")
    return `${d.count} starving ${d.count === 1 ? "person" : "people"} left ${d.from} for the fed stores of ${d.to}.`;
  return eventSentenceGranaryBase(e);
};
const alertWorthyGranaryBase = alertWorthy;
alertWorthy = function (a) {
  return alertWorthyGranaryBase(a) || a.type === "ReliefEvent";
};
function granaryWord(place) {
  const outlook = foodOutlook(place);
  if (!outlook) return "";
  return outlook.famine
    ? "famine · rations stretched thin"
    : outlook.lean
      ? "lean · rations stretched"
      : "provisioned";
}
const renderPlacePageGranaryBase = renderPlacePage;
renderPlacePage = function (id) {
  const html = renderPlacePageGranaryBase(id),
    s = W.settlements.find((x) => x.id === id);
  if (!s || s.ruined) return html;
  const outlook = foodOutlook(s),
    row = `<div class="kv"><span>Granaries</span><b>${granaryCount(s, "farm")} farm${granaryCount(s, "farm") === 1 ? "" : "s"} · ${granaryCount(s, "stockpile")} store${granaryCount(s, "stockpile") === 1 ? "" : "s"} for ${outlook.pop} · ${esc(granaryWord(s))}${s.lastReliefTick ? ` · relief in year ${Math.floor(s.lastReliefTick / TICKS_PER_YEAR)}` : ""}</b></div>`,
    at = html.indexOf('<div class="subhead">');
  return at < 0 ? html + row : html.slice(0, at) + row + html.slice(at);
};
window.ALIFE_GRANARY_DEBUG = Object.freeze({
  outlook: (settlementId) => foodOutlook(W.settlements.find((s) => s.id === settlementId)),
  ration: (settlementId) => rationCap(W.settlements.find((s) => s.id === settlementId)),
  seedReserve: (settlementId) => seedReserve(W.settlements.find((s) => s.id === settlementId)),
  plan: (settlementId) => {
    const s = W.settlements.find((x) => x.id === settlementId);
    if (s) ensurePlacePlans(s);
    return s
      ? {
          farms: granaryCount(s, "farm"),
          stores: granaryCount(s, "stockpile"),
          active: activeBuildings(s).length,
        }
      : null;
  },
  relief: (settlementId, force = true) =>
    sendRelief(
      W.settlements.find((s) => s.id === settlementId),
      force,
    ),
  donor: (settlementId) =>
    reliefDonor(W.settlements.find((s) => s.id === settlementId))?.donor?.name || null,
  migrate: (settlementId, force = true) =>
    migrateHouseholds(
      W.settlements.find((s) => s.id === settlementId),
      force,
    ),
  arrivals: () => updateMigrations(),
  target: (settlementId) =>
    migrationTarget(W.settlements.find((s) => s.id === settlementId))?.name || null,
  movers: (settlementId) => {
    const town = W.settlements.find((s) => s.id === settlementId);
    return granaryResidents(town).map((id) => ({
      id,
      adult: isAdultPerson(id),
      order: civilOrderOf(id)?.kind || null,
      campaign: !!W.components.campaign?.[id],
      hunger: Math.round(W.components.life[id]?.hunger || 0),
    }));
  },
  urge: (settlementId) => settlerUrge(W.settlements.find((s) => s.id === settlementId)),
  word: (settlementId) => granaryWord(W.settlements.find((s) => s.id === settlementId)),
});
