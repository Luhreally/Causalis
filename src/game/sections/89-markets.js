// ═══════════════════════════════════════════════════════════════════════════
// 89. MARKETS AND COIN — prices, specialties, treasuries, and what coin buys
// ═══════════════════════════════════════════════════════════════════════════
// Towns bartered by marginal utility and polities kept no purse: a hungry town
// beside a foreign granary could not buy grain, a rich polity could not hire
// hands, and no page said what was dear or cheap where. Here every town has a
// price board read from its own scarcity, a specialty in whatever it holds
// most beyond its needs, and, once its polity knows Coinage, a market where
// barter carries more. Polities that strike coin keep a treasury: a tithe of
// the year's exchanges and market custom, as a number, not as matter. Coin
// buys grain for a hungry town from any town at peace within reach, real food
// moving store to store while the coin changes hands, and coin hires hands at
// a civic work face. A Legends page lays out the treasuries, the busiest roads,
// the price boards, the specialties, and the purchases. Rendering only reads.
const MARKET_KEY_GOODS = () => [C.ORGANIC, C.SOLVENT, C.FUEL, C.MINERAL, C.ORE, C.METAL, C.PIGMENT, C.INFO, C.CATALYST, C.CRYSTAL],
  MARKET_DEAR = 2,
  MARKET_CHEAP = 0.5,
  MARKET_TAX_PER_EXCHANGE = 0.5,
  MARKET_CUSTOM_PER_MARKET = 2,
  PURCHASE_CADENCE = 128,
  PURCHASE_OFFSET = 56,
  PURCHASE_REACH = 70,
  PURCHASE_MAX = 40,
  WORKS_TREASURY_FLOOR = 60,
  WORKS_HIRE_COST = 3,
  WORKS_HIRE_EFFORT = 6;
function ensureMarkets(world = W) {
  if (!world) return null;
  world.markets = world.markets || { version: 1, year: -1, exchangeSeen: {}, purchases: 0, hires: 0 };
  world.markets.exchangeSeen = world.markets.exchangeSeen || {};
  for (const f of world.factions || []) if (!Number.isFinite(f.treasury)) f.treasury = 0;
  return world.markets;
}
const restoreWorldDefaultsMarketsBase = restoreWorldDefaults;
restoreWorldDefaults = function () {
  restoreWorldDefaultsMarketsBase();
  ensureMarkets(W);
};
// ── Prices and specialties ────────────────────────────────────────────────────
function priceOf(place, sp) {
  if (!place?.inventory) return 1;
  return +clamp(marginalUtility(place, sp), 0.05, 24).toFixed(2);
}
function priceWord(price) {
  return price >= MARKET_DEAR ? "dear" : price <= MARKET_CHEAP ? "cheap" : "fair";
}
function townSpecialty(place) {
  if (!place?.inventory || !place.knownProcesses) return null;
  const targets = new Map(essentialStockTargets(place));
  let best = null,
    score = 0;
  for (const sp of MARKET_KEY_GOODS()) {
    const surplus = materialSurplus(place, sp);
    if (surplus <= 0) continue;
    const s = surplus / ((targets.get(sp) || 0) + 8);
    if (s > score) {
      score = s;
      best = sp;
    }
  }
  return best;
}
function polityCoins(f) {
  return !!f && factionHasTech(f.id, "currency");
}
function factionMarkets(f) {
  return W.settlements.filter((s) => !s.ruined && s.factionId === f.id && placeHasFacility(s, "market")).length;
}
// ── Markets: barter carries more where a market stands ──────────────────────
const bestBarterMarketsBase = bestBarter;
bestBarter = function (a, b) {
  const offer = bestBarterMarketsBase(a, b);
  if (!offer) return offer;
  if (placeHasFacility(a, "market") || placeHasFacility(b, "market")) {
    offer.amountA = Math.round(offer.amountA * 1.25);
    offer.amountB = Math.round(offer.amountB * 1.25);
    offer.market = true;
  }
  return offer;
};
const ensurePlacePlansMarketsBase = ensurePlacePlans;
ensurePlacePlans = function (place) {
  ensurePlacePlansMarketsBase(place);
  if (!place?.knownProcesses || place.ruined || !place.factionId) return;
  if (!factionHasTech(place.factionId, "currency") || settlementPopulation(place) < 10) return;
  const has = W.buildings.some((b) => !b.ruined && b.placeKind === "settlement" && b.placeId === place.id && b.type === "market");
  if (!has) planBuilding(place, "market", place.management?.priorities?.trade || 3);
};
// ── Treasuries: a tithe of the year's exchanges, and market custom ────────────
function collectTaxes(f) {
  const markets = ensureMarkets(W);
  if (!polityCoins(f)) return 0;
  let coin = 0;
  for (const s of W.settlements) {
    if (s.ruined || s.factionId !== f.id) continue;
    const seen = markets.exchangeSeen[s.id] || 0,
      now = s.economy?.exchangeCount || 0;
    if (now > seen) coin += (now - seen) * MARKET_TAX_PER_EXCHANGE;
    markets.exchangeSeen[s.id] = now;
    if (placeHasFacility(s, "market")) coin += MARKET_CUSTOM_PER_MARKET;
  }
  coin = Math.round(coin * 10) / 10;
  f.treasury = Math.round((f.treasury + coin) * 10) / 10;
  return coin;
}
function updateTreasuries() {
  if (W.tick % TICKS_PER_YEAR !== 200) return;
  ensureMarkets(W);
  for (const f of W.factions) if (f.stability > 0) collectTaxes(f);
}
// ── What coin buys: grain in a famine, hands at the work face ────────────────
function atPeaceForTrade(a, b) {
  if (!a || !b || a === b) return true;
  const rel = a.relations?.[b.id];
  return !rel || !["hostile", "at war", "mobilizing"].includes(rel.status);
}
function grainSeller(buyer, faction) {
  let best = null,
    bestScore = -Infinity;
  for (const seller of W.settlements) {
    if (seller === buyer || seller.ruined || !seller.knownProcesses) continue;
    const d = Math.sqrt(dist2(seller.x, seller.y, buyer.x, buyer.y));
    if (d > PURCHASE_REACH) continue;
    const sellerFaction = W.factions.find((f) => f.id === seller.factionId);
    if (seller.factionId !== faction.id && !atPeaceForTrade(sellerFaction, faction)) continue;
    const surplus = materialSurplus(seller, C.ORGANIC);
    if (surplus < 12) continue;
    const price = priceOf(seller, C.ORGANIC),
      score = surplus / price - d * 0.4;
    if (score > bestScore) {
      bestScore = score;
      best = { seller, surplus, price, sellerFaction };
    }
  }
  return best;
}
function buyGrain(buyer, faction, force = false) {
  ensureMarkets(W);
  if (!buyer || !faction || !polityCoins(faction) || faction.treasury < 1) return null;
  const outlook = typeof foodOutlook === "function" ? foodOutlook(buyer) : null;
  if (!force && !outlook?.lean) return null;
  const found = grainSeller(buyer, faction);
  if (!found) return null;
  const { seller, surplus, price, sellerFaction } = found,
    room = placeStorageRemaining(buyer),
    amount = Math.min(PURCHASE_MAX, surplus, room, Math.floor(faction.treasury / price));
  if (amount < 4) return null;
  if (typeof ensureTownEconomy === "function") {
    ensureTownEconomy(buyer);
    ensureTownEconomy(seller);
  }
  const moved = transferSettlementMatter(seller, buyer, C.ORGANIC, amount);
  if (!moved) return null;
  const cost = Math.round(moved * price * 10) / 10;
  faction.treasury = Math.round((faction.treasury - cost) * 10) / 10;
  if (sellerFaction && sellerFaction !== faction && polityCoins(sellerFaction))
    sellerFaction.treasury = Math.round((sellerFaction.treasury + cost) * 10) / 10;
  recordExchange(seller, buyer, "purchase", C.ORGANIC, moved);
  W.markets.purchases++;
  buyer.lastPurchaseTick = W.tick;
  return emitEvent("PurchaseEvent", {
    subjects: [buyer.entityId, seller.entityId],
    location: idx(buyer.x, buyer.y),
    factions: [faction.id, seller.factionId].filter(Boolean),
    causes: [buyer.importantEvents?.at(-1) || 0].filter(Boolean),
    evidence: [
      `${moved} units of grain at ${price} coin apiece`,
      `${buyer.name} held ${Math.round(outlook?.food || 0)} food`,
    ],
    importance: moved >= 30 ? 3 : 2,
    data: { to: buyer.name, from: seller.name, amount: moved, cost, price, polity: faction.name },
  });
}
function hireHands(faction) {
  ensureMarkets(W);
  if (!polityCoins(faction) || faction.treasury < WORKS_TREASURY_FLOOR) return 0;
  let hired = 0;
  for (const b of W.buildings) {
    if (b.ruined || b.complete || b.placeKind !== "settlement") continue;
    if (typeof HORIZON_CIVIC_TYPES !== "undefined" && !HORIZON_CIVIC_TYPES.has(b.type) && b.type !== "market") continue;
    const place = W.settlements.find((s) => s.id === b.placeId);
    if (!place || place.ruined || place.factionId !== faction.id) continue;
    if (faction.treasury < WORKS_TREASURY_FLOOR) break;
    faction.treasury = Math.round((faction.treasury - WORKS_HIRE_COST) * 10) / 10;
    b.workDone = Math.min(b.workRequired, b.workDone + WORKS_HIRE_EFFORT);
    hired++;
    W.markets.hires++;
  }
  return hired;
}
function updatePurchases() {
  if (W.tick % PURCHASE_CADENCE !== PURCHASE_OFFSET) return;
  ensureMarkets(W);
  for (const f of W.factions) {
    if (!(f.stability > 0) || !polityCoins(f)) continue;
    for (const town of W.settlements) {
      if (town.ruined || town.factionId !== f.id) continue;
      if (W.tick - (town.lastPurchaseTick || -99999) < PURCHASE_CADENCE * 2) continue;
      buyGrain(town, f);
    }
    hireHands(f);
  }
}
const simTickMarketsBase = simTick;
simTick = function () {
  simTickMarketsBase();
  if (W?.settlements) {
    updateTreasuries();
    updatePurchases();
  }
};
// ── Chronicle and pages ───────────────────────────────────────────────────────
const eventSentenceMarketsBase = eventSentence;
eventSentence = function (e) {
  const d = e.data || {};
  if (e.type === "PurchaseEvent") return `${d.to} bought ${d.amount} units of grain from ${d.from} for ${d.cost} coin.`;
  return eventSentenceMarketsBase(e);
};
const alertWorthyMarketsBase = alertWorthy;
alertWorthy = function (a) {
  return alertWorthyMarketsBase(a) || (a.type === "PurchaseEvent" && (a.data?.amount || 0) >= 30);
};
function marketGoodName(sp) {
  return W.definitions.species[sp]?.name || `#${sp}`;
}
function priceBoard(place, limit = 4) {
  const rows = MARKET_KEY_GOODS()
    .filter((sp) => (place.inventory?.[sp] || 0) > 0 || (new Map(essentialStockTargets(place)).get(sp) || 0) > 0)
    .map((sp) => ({ sp, price: priceOf(place, sp) }));
  const dear = rows.filter((r) => r.price >= MARKET_DEAR).sort((a, b) => b.price - a.price).slice(0, limit),
    cheap = rows.filter((r) => r.price <= MARKET_CHEAP).sort((a, b) => a.price - b.price).slice(0, limit);
  return { dear, cheap };
}
function renderEconomyPage() {
  ensureMarkets(W);
  const living = W.factions.filter((f) => f.stability > 0),
    treasuries = living
      .filter((f) => polityCoins(f))
      .sort((a, b) => b.treasury - a.treasury)
      .map((f) => `<div class="kv"><span>${legendLink("faction", f.id, esc(f.name))}</span><b>${f.treasury} coin · ${factionMarkets(f)} market${factionMarkets(f) === 1 ? "" : "s"}</b></div>`)
      .join(""),
    name = (id) => W.settlements.find((s) => s.id === id)?.name || "a lost town",
    routes = (W.tradeRoutes || [])
      .filter((r) => r.trips > 0)
      .sort((a, b) => b.trips - a.trips || b.volume - a.volume)
      .slice(0, 6)
      .map((r) => `<div class="kv"><span>${esc(name(r.a))} – ${esc(name(r.b))} <span class="muted">${esc(r.mode)}</span></span><b>${r.trips} trips · ${Math.round(r.volume)} units</b></div>`)
      .join(""),
    towns = W.settlements.filter((s) => !s.ruined && s.knownProcesses).sort((a, b) => settlementPopulation(b) - settlementPopulation(a)),
    boards = towns
      .slice(0, 4)
      .map((s) => {
        const board = priceBoard(s),
          fmt = (rows) => rows.map((r) => `${esc(marketGoodName(r.sp))} ${r.price}`).join(", ");
        return `<div class="kv"><span>${legendLink("place", s.id, esc(s.name))}</span><b>${board.dear.length ? `dear: ${fmt(board.dear)}` : "nothing dear"}${board.cheap.length ? ` · cheap: ${fmt(board.cheap)}` : ""}</b></div>`;
      })
      .join(""),
    specialties = towns
      .map((s) => ({ s, sp: townSpecialty(s) }))
      .filter((x) => x.sp !== null)
      .slice(0, 8)
      .map((x) => `<div class="kv"><span>${legendLink("place", x.s.id, esc(x.s.name))}</span><b>${esc(marketGoodName(x.sp))}</b></div>`)
      .join(""),
    purchases = timelineRows(legendEvents((e) => e.type === "PurchaseEvent"), 8);
  return `${legendHero("The economy", [`${(W.tradeRoutes || []).filter((r) => r.trips > 0).length} roads of trade`, `${W.markets.purchases} purchases`])}<div class="subhead">Treasuries</div>${
    treasuries || `<div class="empty">No polity strikes coin yet.</div>`
  }<div class="subhead">Busiest roads</div>${routes || `<div class="empty">No caravan has gone between towns.</div>`}<div class="subhead">Price boards</div>${
    boards || `<div class="empty">No town keeps a store.</div>`
  }<div class="subhead">Specialties</div>${specialties || `<div class="empty">No town holds a surplus of anything.</div>`}<div class="subhead">Purchases</div>${purchases}`;
}
const renderLegendPageMarketsBase = renderLegendPage;
renderLegendPage = function (kind = UI.legend.kind, id = UI.legend.id) {
  if (W && kind === "economy") return renderEconomyPage();
  return renderLegendPageMarketsBase(kind, id);
};
const renderLegendIndexMarketsBase = renderLegendIndex;
renderLegendIndex = function (query = "") {
  const html = renderLegendIndexMarketsBase(query);
  if (!W?.settlements?.some((s) => !s.ruined)) return html;
  ensureMarkets(W);
  const routes = (W.tradeRoutes || []).filter((r) => r.trips > 0).length,
    coin = W.factions.filter((f) => f.stability > 0).reduce((n, f) => n + (f.treasury || 0), 0),
    card = `<div class="row between" style="margin-top:10px"><span class="subhead" style="margin:0">The economy</span></div><div class="legend-grid"><div class="legend-card" data-legend="economy:0"><b>Economy</b><small>${routes} road${routes === 1 ? "" : "s"} of trade · ${Math.round(coin)} coin · ${W.markets.purchases} purchase${W.markets.purchases === 1 ? "" : "s"}</small></div></div>`;
  return html + card;
};
const renderFactionPageMarketsBase = renderFactionPage;
renderFactionPage = function (id) {
  const html = renderFactionPageMarketsBase(id),
    f = W.factions.find((x) => x.id === id);
  if (!f || !polityCoins(f)) return html;
  const row = `<div class="kv"><span>Treasury</span><b>${f.treasury} coin · ${factionMarkets(f)} market${factionMarkets(f) === 1 ? "" : "s"}</b></div>`,
    at = html.indexOf('<div class="subhead">');
  return at < 0 ? html + row : html.slice(0, at) + row + html.slice(at);
};
const renderPlacePageMarketsBase = renderPlacePage;
renderPlacePage = function (id) {
  const html = renderPlacePageMarketsBase(id),
    s = W.settlements.find((x) => x.id === id);
  if (!s || !s.knownProcesses) return html;
  const sp = townSpecialty(s),
    board = priceBoard(s, 3),
    fmt = (rows) => rows.map((r) => `${esc(marketGoodName(r.sp))} ${r.price}`).join(", "),
    rows = `<div class="kv"><span>Specialty</span><b>${sp === null ? "none" : esc(marketGoodName(sp))}</b></div><div class="kv"><span>Prices</span><b>${
      board.dear.length ? `dear: ${fmt(board.dear)}` : "nothing dear"
    }${board.cheap.length ? ` · cheap: ${fmt(board.cheap)}` : ""}</b></div>`,
    at = html.indexOf('<div class="subhead">');
  return at < 0 ? html + rows : html.slice(0, at) + rows + html.slice(at);
};
// ── The market stall ──────────────────────────────────────────────────────────
function drawMarketStall(g, b, s, r, p, now, detail) {
  const hue = (b.id * 53) % 360,
    w = r * 1.5,
    h = r * 0.55;
  g.fillStyle = hsl(30, 25, 30);
  g.fillRect(s.x - w / 2, s.y - h * 0.3, w, h * 0.3);
  for (const x of [-w * 0.45, w * 0.45]) {
    g.fillStyle = "#6b5a44";
    g.fillRect(s.x + x - r * 0.05, s.y - h * 1.5, r * 0.1, h * 1.3);
  }
  // A striped awning.
  const stripes = detail > 0 ? 6 : 3,
    sw = w / stripes;
  for (let i = 0; i < stripes; i++) {
    g.fillStyle = i % 2 ? hsl(hue, 60, 62) : "#f1e7d2";
    g.fillRect(s.x - w / 2 + i * sw, s.y - h * 1.75, sw, h * 0.45);
  }
  g.fillStyle = hsl(hue, 45, 40);
  g.beginPath();
  g.moveTo(s.x - w / 2, s.y - h * 1.75);
  g.lineTo(s.x, s.y - h * 2.15);
  g.lineTo(s.x + w / 2, s.y - h * 1.75);
  g.closePath();
  g.fill();
  if (detail > 0) {
    // Goods on the counter.
    for (let i = 0; i < 4; i++) {
      g.fillStyle = hsl((hue + i * 70) % 360, 55, 55);
      g.fillRect(s.x - w * 0.4 + i * w * 0.22, s.y - h * 0.6, w * 0.16, h * 0.3);
    }
  }
}
const drawCompletedBuildingMarketsBase = drawCompletedBuilding;
drawCompletedBuilding = function (g, b, s, r, p, now, m) {
  if (b.type === "market") return drawMarketStall(g, b, s, r, p, now, buildingDetailLevel());
  return drawCompletedBuildingMarketsBase(g, b, s, r, p, now, m);
};
window.ALIFE_MARKET_DEBUG = Object.freeze({
  price: (placeId, sp) => priceOf(W.settlements.find((s) => s.id === placeId), sp),
  word: (price) => priceWord(price),
  specialty: (placeId) => townSpecialty(W.settlements.find((s) => s.id === placeId)),
  tax: (factionId) => collectTaxes(W.factions.find((f) => f.id === factionId)),
  treasury: (factionId) => {
    ensureMarkets(W);
    return W.factions.find((f) => f.id === factionId)?.treasury ?? null;
  },
  buy: (placeId, force = true) => {
    const s = W.settlements.find((x) => x.id === placeId);
    return s ? buyGrain(s, W.factions.find((f) => f.id === s.factionId), force) : null;
  },
  hire: (factionId) => hireHands(W.factions.find((f) => f.id === factionId)),
  plan: (placeId) => {
    const s = W.settlements.find((x) => x.id === placeId);
    if (s) ensurePlacePlans(s);
    return W.buildings.some((b) => !b.ruined && b.placeKind === "settlement" && b.placeId === placeId && b.type === "market");
  },
  page: () => renderEconomyPage(),
});
