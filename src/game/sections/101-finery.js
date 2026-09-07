// ═══════════════════════════════════════════════════════════════════════════
// 101. FINERY AND THE TITHE — the well-off want worked goods, and the tithe is felt
// ═══════════════════════════════════════════════════════════════════════════
// Wealth was a ranking and coin a tally that bought grain and hands. Now the
// well-off want things: a town with a market and two or more prosperous or
// rich households wants finery, worked metal, pigment, ceramic, or crystal,
// and once a year its polity buys some from a town with a surplus at the
// board price, which contents the well-off and calms the town for a while.
// And the tithe is felt: a polity at war or with an empty treasury raises a
// heavy tithe that doubles what the markets yield and strains every town it
// holds, eases it when the need passes, and a town fed by grain the treasury
// bought is calmer for two years after, because coin spent on relief is coin
// the people see. Coin is a tally; the goods move by the same conserving
// transfers as every other trade. Deterministic; rendering only reads.
const LUXURY_GOODS = () => [C.PIGMENT, C.METAL, C.CERAMIC, C.CRYSTAL],
  FINERY_MIN_DEMAND = 2,
  FINERY_MAX = 12,
  FINERY_EASE = 0.03,
  FINERY_MEMORY = TICKS_PER_YEAR * 2,
  RELIEF_EASE = 0.06,
  RELIEF_MEMORY = TICKS_PER_YEAR * 2,
  TITHE_STRAIN = 0.06,
  TITHE_NEED = 12,
  FINERY_CADENCE = 256,
  FINERY_OFFSET = 216,
  FINERY = { bought: 0, policyChanges: 0 };
// ── The tithe ─────────────────────────────────────────────────────────────────
function titheNeeded(f) {
  return (typeof warsActive === "function" && warsActive(f) > 0) || (f.treasury || 0) < TITHE_NEED;
}
function tithePolicy(f) {
  return f?.tithe?.policy || "light";
}
function setTithePolicy(f, policy, reason = "") {
  if (!f || tithePolicy(f) === policy) return null;
  f.tithe = { policy, sinceTick: W.tick };
  FINERY.policyChanges++;
  const capital = factionCapital(f);
  return emitEvent("TitheEvent", {
    subjects: [f.leaderId, capital?.entityId].filter(Boolean),
    location: capital ? idx(capital.x, capital.y) : -1,
    factions: [f.id],
    causes: [W.lastEventByType.WarStartedEvent, W.lastEventByType.PeaceEvent].filter(Boolean),
    evidence: [reason || (policy === "heavy" ? "the treasury's need" : "the need passed")],
    importance: 2,
    data: { polity: f.name, policy, reason },
  });
}
function updateTithePolicies() {
  let changed = 0;
  for (const f of W.factions) {
    if (f.stability <= 0 || !polityCoins(f)) continue;
    const want = titheNeeded(f) ? "heavy" : "light";
    if (want === tithePolicy(f)) continue;
    const reason =
      want === "heavy"
        ? typeof warsActive === "function" && warsActive(f) > 0
          ? "a war to pay for"
          : "an empty treasury"
        : "the need passed";
    if (setTithePolicy(f, want, reason)) changed++;
  }
  return changed;
}
const collectTaxesFineryBase = collectTaxes;
collectTaxes = function (f) {
  const coin = collectTaxesFineryBase(f);
  if (!(coin > 0) || tithePolicy(f) !== "heavy") return coin;
  f.treasury = Math.round((f.treasury + coin) * 10) / 10;
  return Math.round(coin * 2 * 10) / 10;
};
// Grain the treasury bought is relief the town remembers.
const buyGrainFineryBase = buyGrain;
buyGrain = function (buyer, faction, force = false) {
  const ev = buyGrainFineryBase(buyer, faction, force);
  if (ev && buyer) buyer.reliefTick = W.tick;
  return ev;
};
function titheStrain(place) {
  const f = polityOf(place);
  return f && tithePolicy(f) === "heavy" ? TITHE_STRAIN : 0;
}
function reliefEase(place) {
  return W.tick - (place.reliefTick ?? -1e9) < RELIEF_MEMORY ? RELIEF_EASE : 0;
}
function fineryEase(place) {
  return W.tick - (place.luxuryTick ?? -1e9) < FINERY_MEMORY ? FINERY_EASE : 0;
}
const unrestOfFineryBase = unrestOf;
unrestOf = function (place) {
  const unrest = unrestOfFineryBase(place);
  if (!place?.knownProcesses) return unrest;
  const shift = titheStrain(place) - reliefEase(place) - fineryEase(place);
  return shift ? clamp(+(unrest + shift).toFixed(3), 0, 1) : unrest;
};
// ── Finery ────────────────────────────────────────────────────────────────────
function fineryDemand(place) {
  if (!place?.knownProcesses) return 0;
  let n = 0;
  for (const id of townResidents(place)) {
    const standing = W.components.identity[id]?.standing;
    if (standing === "rich" || standing === "prosperous") n++;
  }
  return n;
}
function fineryWanted(place, demand) {
  let best = -1,
    bestStock = Infinity;
  for (const sp of LUXURY_GOODS()) {
    const stock = place.inventory[sp] || 0;
    if (stock < demand * 2 && stock < bestStock) {
      bestStock = stock;
      best = sp;
    }
  }
  return best;
}
function finerySeller(buyer, faction, sp) {
  let best = null,
    bestScore = -Infinity;
  for (const seller of W.settlements) {
    if (seller === buyer || seller.ruined || !seller.knownProcesses) continue;
    const d = Math.sqrt(dist2(seller.x, seller.y, buyer.x, buyer.y));
    if (d > PURCHASE_REACH) continue;
    const sellerFaction = W.factions.find((f) => f.id === seller.factionId);
    if (seller.factionId !== faction.id && !atPeaceForTrade(sellerFaction, faction)) continue;
    const surplus = materialSurplus(seller, sp);
    if (surplus < 6) continue;
    const price = priceOf(seller, sp),
      score = surplus / price - d * 0.4;
    if (score > bestScore) {
      bestScore = score;
      best = { seller, surplus, price, sellerFaction };
    }
  }
  return best;
}
function buyFinery(buyer, faction) {
  if (!buyer || !faction || !polityCoins(faction) || faction.treasury < 1) return null;
  if (!placeHasFacility(buyer, "market")) return null;
  const demand = fineryDemand(buyer);
  if (demand < FINERY_MIN_DEMAND) return null;
  const sp = fineryWanted(buyer, demand);
  if (sp < 0) return null;
  const found = finerySeller(buyer, faction, sp);
  if (!found) return null;
  const { seller, surplus, price, sellerFaction } = found,
    room = placeStorageRemaining(buyer),
    amount = Math.min(FINERY_MAX, surplus, room, Math.floor(faction.treasury / price));
  if (amount < 2) return null;
  if (typeof ensureTownEconomy === "function") {
    ensureTownEconomy(buyer);
    ensureTownEconomy(seller);
  }
  const moved = transferSettlementMatter(seller, buyer, sp, amount);
  if (!moved) return null;
  const cost = Math.round(moved * price * 10) / 10;
  faction.treasury = Math.round((faction.treasury - cost) * 10) / 10;
  if (sellerFaction && sellerFaction !== faction && polityCoins(sellerFaction))
    sellerFaction.treasury = Math.round((sellerFaction.treasury + cost) * 10) / 10;
  recordExchange(seller, buyer, "purchase", sp, moved);
  buyer.luxuryTick = W.tick;
  buyer.luxuryGood = sp;
  FINERY.bought += moved;
  if (typeof setEmotionImpulse === "function")
    for (const id of townResidents(buyer)) {
      const standing = W.components.identity[id]?.standing;
      if (standing === "rich" || standing === "prosperous") setEmotionImpulse(id, { contentment: 0.05 });
    }
  const good = typeof marketGoodName === "function" ? marketGoodName(sp) : W.definitions.species[sp]?.name || "finery",
    ev = emitEvent("FineryEvent", {
      subjects: [buyer.entityId, seller.entityId],
      location: idx(buyer.x, buyer.y),
      factions: [faction.id, seller.factionId].filter(Boolean),
      causes: [W.lastEventByType.WealthEvent, W.lastEventByType.MarketEvent].filter(Boolean),
      evidence: [`${moved} of ${good} at ${price} coin apiece`, `${demand} well-off households`],
      importance: buyer.luxuryEventId ? 1 : 2,
      data: { place: buyer.name, seller: seller.name, polity: faction.name, good, amount: moved, cost, demand },
    });
  if (!buyer.luxuryEventId) buyer.luxuryEventId = ev.id;
  return ev;
}
function buyLuxuries() {
  let bought = 0;
  for (const f of W.factions) {
    if (f.stability <= 0 || !polityCoins(f)) continue;
    for (const s of W.settlements) {
      if (s.ruined || s.factionId !== f.id || W.tick - (s.luxuryTick ?? -1e9) < FINERY_CADENCE) continue;
      if (buyFinery(s, f)) bought++;
    }
  }
  return bought;
}
const simTickFineryBase = simTick;
simTick = function () {
  simTickFineryBase();
  if (!W?.factions || !W.settlements) return;
  if (W.tick % FINERY_CADENCE === FINERY_OFFSET) {
    updateTithePolicies();
    buyLuxuries();
  }
};
// ── Chronicle and Legends ─────────────────────────────────────────────────────
const eventSentenceFineryBase = eventSentence;
eventSentence = function (e) {
  const d = e.data || {};
  if (e.type === "TitheEvent")
    return d.policy === "heavy" ? `${d.polity} raised a heavy tithe: ${d.reason}.` : `${d.polity} eased the tithe: ${d.reason}.`;
  if (e.type === "FineryEvent")
    return `${d.place} bought ${d.amount} of ${d.good} from ${d.seller} for its ${d.demand} well-off households.`;
  return eventSentenceFineryBase(e);
};
const renderFactionPageFineryBase = renderFactionPage;
renderFactionPage = function (id) {
  const html = renderFactionPageFineryBase(id),
    f = W.factions.find((x) => x.id === id);
  if (!f || !polityCoins(f)) return html;
  const row = `<div class="kv"><span>Tithe</span><b>${esc(tithePolicy(f) === "heavy" ? "heavy, and felt" : "light")}</b></div>`,
    at = html.indexOf('<div class="subhead">');
  return at < 0 ? html + row : html.slice(0, at) + row + html.slice(at);
};
const renderPlacePageFineryBase = renderPlacePage;
renderPlacePage = function (id) {
  const html = renderPlacePageFineryBase(id),
    place = W.settlements.find((s) => s.id === id);
  if (!place?.knownProcesses) return html;
  const demand = fineryDemand(place);
  if (!demand && !place.luxuryTick) return html;
  const good = place.luxuryGood != null ? (typeof marketGoodName === "function" ? marketGoodName(place.luxuryGood) : "finery") : "",
    text = `${demand} well-off household${demand === 1 ? "" : "s"}${place.luxuryTick ? `; last bought ${good} in Year ${formatYear(place.luxuryTick)}` : ""}`,
    row = `<div class="kv"><span>Finery</span><b>${esc(text)}</b></div>`,
    at = html.indexOf('<div class="subhead">');
  return at < 0 ? html + row : html.slice(0, at) + row + html.slice(at);
};
window.ALIFE_FINERY_DEBUG = Object.freeze({
  policy: (factionId) => tithePolicy(W.factions.find((f) => f.id === factionId)),
  needed: (factionId) => titheNeeded(W.factions.find((f) => f.id === factionId)),
  update: () => updateTithePolicies(),
  set: (factionId, policy) => !!setTithePolicy(W.factions.find((f) => f.id === factionId), policy, "set for the test"),
  strain: (placeId) => titheStrain(W.settlements.find((s) => s.id === placeId)),
  relief: (placeId) => reliefEase(W.settlements.find((s) => s.id === placeId)),
  demand: (placeId) => fineryDemand(W.settlements.find((s) => s.id === placeId)),
  buy: () => buyLuxuries(),
  buyFor: (placeId) => {
    const s = W.settlements.find((x) => x.id === placeId);
    return s ? !!buyFinery(s, polityOf(s)) : false;
  },
  counts: () => ({ ...FINERY }),
});
