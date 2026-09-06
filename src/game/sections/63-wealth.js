// ═══════════════════════════════════════════════════════════════════════════
// 63. WEALTH — what a person owns, their standing, and the envy it breeds
// ═══════════════════════════════════════════════════════════════════════════
// People carry materials and own tools and artifacts, but nothing read that as
// riches. Here every resident of a town is valued by what they hold, ranked
// against their neighbours into a standing (poor, common, prosperous, rich),
// and the town gets an inequality reading from how much its top fifth owns.
// Standing shows in stories and on Legends pages, the poor envy the rich and
// rivalries sharpen across a wealth gap, inequality feeds unrest, and a wealth
// map mode shows where the rich stand. No prices and no markets: matter is
// still only moved by the systems that already move it.
const WEALTH_ROLE_VALUE = Object.freeze([
  [/rare conductor|worked metal|crystal|glass/, 6],
  [/pigment|catalyst|medicinal|information/, 3],
  [/ore|ceramic|salt|bone|fiber|membrane/, 1.5],
  [/organic|energy|fuel|mineral/, 0.6],
]);
let WEALTH_VALUE_WORLD = null,
  WEALTH_VALUES = null;
function speciesValue(sp) {
  if (WEALTH_VALUE_WORLD !== W || !WEALTH_VALUES) {
    WEALTH_VALUE_WORLD = W;
    WEALTH_VALUES = new Float32Array(SPECIES_COUNT);
    for (let i = 0; i < SPECIES_COUNT; i++) {
      const role = W.definitions.species[i]?.role || "";
      let value = 0.1;
      for (const [re, v] of WEALTH_ROLE_VALUE)
        if (re.test(role)) {
          value = v;
          break;
        }
      WEALTH_VALUES[i] = value;
    }
  }
  return WEALTH_VALUES[sp] || 0;
}
function personWealth(id) {
  const inv = W.components.inventory[id];
  if (!inv) return 0;
  let wealth = 0;
  if (inv.materials)
    for (let sp = 0; sp < inv.materials.length; sp++)
      if (inv.materials[sp]) wealth += inv.materials[sp] * speciesValue(sp);
  for (const eid of inv.artifactIds || []) {
    const a = W.artifacts.find((x) => x.entityId === eid);
    if (a) wealth += (a.quality || 30) / 10 + (a.tool ? 4 : 8);
  }
  return +wealth.toFixed(1);
}
function standingWord(rank, count) {
  if (count < 4) return "common";
  return rank < 0.2 ? "poor" : rank < 0.6 ? "common" : rank < 0.9 ? "prosperous" : "rich";
}
function townResidents(place, radius = 8) {
  return entityAtRadius(idx(place.x, place.y), radius, KINDS.PERSON).filter(
    (id) =>
      classifyAlive(id) &&
      (!place.factionId || W.components.social[id]?.factionId === place.factionId),
  );
}
function updateWealth() {
  for (const place of W.settlements) {
    if (place.ruined) continue;
    const residents = townResidents(place);
    if (!residents.length) {
      place.inequality = 0;
      continue;
    }
    const valued = residents
      .map((id) => [id, personWealth(id)])
      .sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    const total = valued.reduce((s, [, w]) => s + w, 0),
      topStart = Math.floor(valued.length * 0.8),
      topShare = total > 0 ? valued.slice(topStart).reduce((s, [, w]) => s + w, 0) / total : 0.2;
    place.inequality = +clamp((topShare - 0.2) / 0.6, 0, 1).toFixed(3);
    valued.forEach(([id, wealth], i) => {
      const ident = W.components.identity[id];
      if (!ident) return;
      ident.wealth = wealth;
      ident.standing = standingWord((i + 0.5) / valued.length, valued.length);
      ident.standingPlace = place.name;
    });
    const [richest, richWealth] = valued[valued.length - 1];
    if (richWealth > 20 && place.richestId !== richest) {
      const first = !place.richestId;
      place.richestId = richest;
      if (!first)
        emitEvent("FortuneEvent", {
          subjects: [richest, place.entityId],
          location: idx(place.x, place.y),
          factions: place.factionId ? [place.factionId] : [],
          causes: [W.causalIndex.entity[richest] || 0].filter(Boolean),
          evidence: [`${richWealth} in goods`, `inequality ${place.inequality}`],
          importance: 2,
          data: { name: entityName(richest), place: place.name, wealth: richWealth },
        });
    }
    // The poor look at the rich with envy.
    const rich = new Set(
      valued.filter(([, w], i) => (i + 0.5) / valued.length >= 0.9 && w > 10).map(([id]) => id),
    );
    if (rich.size)
      for (const [id] of valued.slice(0, Math.max(1, Math.floor(valued.length * 0.2)))) {
        const rels = W.components.social[id]?.relationships;
        if (!rels) continue;
        for (const key in rels)
          if (rich.has(+key)) rels[key].jealousy = clamp((rels[key].jealousy || 0) + 0.05, 0, 1);
      }
  }
}
// A wealth gap sharpens a rivalry.
const bondPairUpdateWealthBase = bondPairUpdate;
bondPairUpdate = function (id, other, ar, br, feuds) {
  const measure = bondPairUpdateWealthBase(id, other, ar, br, feuds),
    wa = W.components.identity[id]?.wealth || 0,
    wb = W.components.identity[other]?.wealth || 0,
    gap = Math.abs(wa - wb) / (Math.max(wa, wb) + 10);
  if (gap > 0.4) ar.rivalry = br.rivalry = +clamp((ar.rivalry || 0) + gap * 0.02, 0, 1).toFixed(3);
  return measure;
};
function personStandingLine(id) {
  const ident = W.components.identity[id];
  if (!ident?.standing || ident.standing === "common") return "";
  if (ident.standing === "rich")
    return `Counted among the rich of ${esc(ident.standingPlace || "the town")}, with ${ident.wealth} in goods.`;
  if (ident.standing === "prosperous")
    return `Prosperous by the reckoning of ${esc(ident.standingPlace || "the town")}.`;
  return `Poor by the reckoning of ${esc(ident.standingPlace || "the town")}.`;
}
// ── Tick hook ──────────────────────────────────────────────────────────────────
const updateWeatherCycleWealthBase = updateWeatherCycle;
updateWeatherCycle = function () {
  updateWeatherCycleWealthBase();
  if (W?.settlements && W.tick % 256 === 40) updateWealth();
};
// ── Chronicle, Legends, map mode ───────────────────────────────────────────────
const eventSentenceWealthBase = eventSentence;
eventSentence = function (e) {
  if (e.type === "FortuneEvent")
    return `${e.data?.name} became the richest in ${e.data?.place}, with ${e.data?.wealth} in goods.`;
  return eventSentenceWealthBase(e);
};
const renderLifePageWealthBase = renderLifePage;
renderLifePage = function (id) {
  const html = renderLifePageWealthBase(id),
    ident = W.components.identity[id];
  if (!ident?.standing) return html;
  return `${html}<div class="kv"><span>Standing</span><b>${esc(titleCase(ident.standing))} <span class="muted">· ${ident.wealth} in goods${ident.standingPlace ? ` · ${esc(ident.standingPlace)}` : ""}</span></b></div>`;
};
const renderPlacePageWealthBase = renderPlacePage;
renderPlacePage = function (id) {
  const html = renderPlacePageWealthBase(id),
    s = W.settlements.find((x) => x.id === id);
  if (!s || s.inequality == null) return html;
  const richest = s.richestId && classifyAlive(s.richestId) ? lifeLink(s.richestId) : "",
    block = `<div class="kv"><span>Inequality</span><b>${Math.round(s.inequality * 100)}%${richest ? ` · richest ${richest}` : ""}</b></div>`,
    at = html.indexOf('<div class="subhead">Chronicle</div>');
  return at < 0 ? html + block : html.slice(0, at) + block + html.slice(at);
};
function tileWealth(i) {
  let total = 0;
  for (const id of W.spatialBins[i] || [])
    if (W.kind[id] === KINDS.PERSON) total += W.components.identity[id]?.wealth || 0;
  return total;
}
const overlayValueWealthBase = overlayValue;
overlayValue = function (name, i) {
  if (name === "wealth") return clamp((tileWealth(i) / 40) * 100, 0, 100);
  return overlayValueWealthBase(name, i);
};
const overlayStyleWealthBase = overlayStyle;
overlayStyle = function (name, i) {
  if (name === "wealth") {
    const w = tileWealth(i);
    return w > 0 ? hsl(46, 85, 62, clamp(0.15 + w / 60, 0.15, 0.8)) : "transparent";
  }
  return overlayStyleWealthBase(name, i);
};
const overlayLegendColorWealthBase = overlayLegendColor;
overlayLegendColor = function (id) {
  return id === "wealth" ? "#e8c46a" : overlayLegendColorWealthBase(id);
};
const setOverlayWealthBase = setOverlay;
setOverlay = function (name) {
  setOverlayWealthBase(name);
  if (UI.overlay === "wealth" && DOM.mapOverlay)
    DOM.mapOverlay.textContent = "Wealth · brighter where the rich stand";
};
window.ALIFE_WEALTH_DEBUG = Object.freeze({
  update: () => updateWealth(),
  wealth: (id) => personWealth(id),
  standing: (id) => W.components.identity[id]?.standing || "",
  inequality: (settlementId) =>
    W.settlements.find((s) => s.id === settlementId)?.inequality ?? null,
  line: (id) => personStandingLine(id),
  tile: (i) => tileWealth(i),
});
