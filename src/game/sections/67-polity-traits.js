// ═══════════════════════════════════════════════════════════════════════════
// 67. POLITY TRAITS — what a people comes to be known for
// ═══════════════════════════════════════════════════════════════════════════
// Every polity has an ethos of continuous numbers. Here those numbers, and the
// deeds in the annals, are read into a few named traits in the WorldBox manner:
// Expansionist, Isolationist, Warlike, Peaceful, Merchants, Zealots, Scholars,
// Builders, Seafarers, Slavers, Colonizers, Hierarchs, Egalitarians, Feuding,
// Singers, Xenophobes, Rebels, Fractious. Traits are earned by history, kept
// for at least eight years once earned, chronicled when gained or lost, shown
// as tags on polity pages and inspectors, and they feed back: each trait pulls
// the ethos further its way and tilts the systems it names (settlers, envoys,
// marriages, truces, voyages, unrest).
const TRAIT_HOLD = TICKS_PER_YEAR * 8,
  TRAIT_LIMIT = 3;
const POLITY_TRAITS = Object.freeze([
  { id: "Rebels", gloss: "born of a rising; the old power is not forgotten", test: (f, s) => !!f.parentFactionId && s.age < TICKS_PER_YEAR * 20 },
  { id: "Seafarers", gloss: "boats at every shore; caravans and settlers go by water", test: (f, s) => s.docks > 0 && s.sails },
  { id: "Colonizers", gloss: "founders of far towns; settlers set out often", test: (f, s) => s.colonies >= 2 },
  { id: "Expansionist", gloss: "hungry for land; settlers and claims come easier", test: (f, s) => f.ethos.expansionist > 0.6 || s.towns >= 4 },
  { id: "Isolationist", gloss: "keeps to itself; few envoys, no marriages abroad", test: (f, s) => f.ethos.isolationist > 0.6 && s.envoys < 2 },
  { id: "Warlike", gloss: "quick to arms; pressure builds fast", test: (f, s) => f.aggression > 0.62 || s.wars >= 2 },
  { id: "Peaceful", gloss: "slow to arms; truces come easier", test: (f, s) => f.aggression < 0.3 && s.wars === 0 && s.age > TICKS_PER_YEAR * 8 },
  { id: "Merchants", gloss: "roads busy with barter", test: (f, s) => f.ethos.mercantile > 0.62 || s.trades >= 12 },
  { id: "Zealots", gloss: "the god is never far from their minds", test: (f, s) => f.ethos.spiritual > 0.66 || s.rites >= 4 },
  { id: "Scholars", gloss: "quick to learn; processes spread", test: (f, s) => f.ethos.inventive > 0.62 || f.technologyLevel >= 8 },
  { id: "Builders", gloss: "stone upon stone", test: (f, s) => s.buildings >= 14 },
  { id: "Slavers", gloss: "the defeated are taken", test: (f, s) => s.captives >= 3 },
  { id: "Hierarchs", gloss: "the Voice's word is law; blood inherits", test: (f, s) => f.ethos.hierarchical > 0.66 },
  { id: "Egalitarians", gloss: "the many decide", test: (f, s) => f.ethos.communal > 0.62 && f.ethos.hierarchical < 0.4 },
  { id: "Feuding", gloss: "houses at each other's throats", test: (f, s) => s.feuds >= 2 },
  { id: "Singers", gloss: "every deed becomes a song", test: (f, s) => s.songs >= 6 },
  { id: "Xenophobes", gloss: "strangers are not welcome", test: (f, s) => s.xenophobia > 0.6 },
  { id: "Fractious", gloss: "risings and coups come easily", test: (f, s) => s.upheavals >= 2 },
]);
const TRAIT_GLOSS = Object.freeze(Object.fromEntries(POLITY_TRAITS.map((t) => [t.id, t.gloss])));
function ensureTraits(world = W) {
  if (!world) return;
  for (const f of world.factions || []) {
    f.traits = f.traits || [];
    f.traitSince = f.traitSince || {};
  }
}
const restoreWorldTraitsBase = restoreWorldDefaults;
restoreWorldDefaults = function () {
  restoreWorldTraitsBase();
  ensureTraits(W);
};
function polityStats(f) {
  const towns = W.settlements.filter((s) => !s.ruined && s.factionId === f.id),
    culture = W.cultures.find((c) => c.id === f.cultureId),
    annals = W.annals || [],
    count = (types) => annals.reduce((n, a) => (types.includes(a.type) && a.factions?.includes(f.id) ? n + 1 : n), 0),
    founded = annals.find((a) => a.type === "FactionFoundedEvent" && a.factions?.includes(f.id));
  return {
    age: W.tick - (f.foundedTick ?? founded?.tick ?? 0),
    towns: towns.length,
    docks: W.buildings.filter((b) => b.type === "dock" && b.complete && !b.ruined && towns.some((s) => s.id === b.placeId)).length,
    sails: !!f.id && factionHasTech(f.id, "navigation"),
    colonies: count(["ColonyEvent", "SettlersEvent"]),
    envoys: (W.diplomacy?.envoys || []).filter((e) => e.from === f.id).length + count(["EnvoyEvent"]),
    wars: W.activeWars.filter((w) => w.a === f.id || w.b === f.id).length,
    trades: typeof reciprocalTradeTrips === "function" ? W.factions.reduce((n, g) => (g === f ? n : n + reciprocalTradeTrips(f, g)), 0) : 0,
    rites: culture?.belief?.rites || 0,
    buildings: W.buildings.filter((b) => b.complete && !b.ruined && towns.some((s) => s.id === b.placeId)).length,
    captives: count(["CaptiveEvent"]),
    feuds: (W.feuds || []).filter((fd) => !fd.ended && typeof housePolity === "function" && (housePolity(fd.a) === f.id || housePolity(fd.b) === f.id)).length,
    songs: (culture?.songs || []).filter((s) => !s.spreadFrom).length,
    xenophobia: typeof factionXenophobia === "function" ? factionXenophobia(f, W, false) : 0,
    upheavals: count(["RebellionEvent", "CoupEvent", "CivilWarEvent"]),
  };
}
function traitsFor(f, stats) {
  const earned = POLITY_TRAITS.filter((t) => t.test(f, stats)).map((t) => t.id),
    kept = (f.traits || []).filter((id) => W.tick - (f.traitSince?.[id] || 0) < TRAIT_HOLD || earned.includes(id)),
    out = [];
  for (const id of [...kept, ...earned]) if (!out.includes(id)) out.push(id);
  // Opposites never sit together; the older one stays.
  for (const [a, b] of [["Warlike", "Peaceful"], ["Expansionist", "Isolationist"], ["Hierarchs", "Egalitarians"]])
    if (out.includes(a) && out.includes(b)) out.splice(out.indexOf((f.traitSince?.[a] || 0) <= (f.traitSince?.[b] || 0) ? b : a), 1);
  return out.slice(0, TRAIT_LIMIT);
}
function applyTraitEffects(f) {
  const nudge = (key, delta) => {
    if (f.ethos && Number.isFinite(f.ethos[key])) f.ethos[key] = clamp(f.ethos[key] + delta, 0.05, 0.95);
  };
  for (const id of f.traits) {
    if (id === "Expansionist" || id === "Colonizers") nudge("expansionist", 0.01);
    if (id === "Isolationist") nudge("isolationist", 0.01);
    if (id === "Warlike") f.aggression = clamp(f.aggression + 0.01, 0.1, 0.95);
    if (id === "Peaceful") f.aggression = clamp(f.aggression - 0.01, 0.1, 0.95);
    if (id === "Merchants") nudge("mercantile", 0.01);
    if (id === "Zealots") nudge("spiritual", 0.01);
    if (id === "Scholars") nudge("inventive", 0.01);
    if (id === "Hierarchs") nudge("hierarchical", 0.01);
    if (id === "Egalitarians") nudge("communal", 0.01);
  }
}
function updatePolityTraits() {
  ensureTraits();
  for (const f of W.factions) {
    if (f.stability <= 0) continue;
    const stats = polityStats(f),
      next = traitsFor(f, stats),
      capital = W.settlements.find((s) => s.id === f.capitalSettlementId);
    for (const id of next)
      if (!f.traits.includes(id)) {
        f.traitSince[id] = W.tick;
        emitEvent("TraitGainedEvent", {
          subjects: [f.entityId],
          location: capital ? idx(capital.x, capital.y) : -1,
          factions: [f.id],
          causes: [W.causalIndex.entity[f.entityId] || 0].filter(Boolean),
          evidence: [TRAIT_GLOSS[id]],
          importance: 3,
          data: { polity: f.name, trait: id, gloss: TRAIT_GLOSS[id] },
        });
      }
    for (const id of f.traits)
      if (!next.includes(id))
        emitEvent("TraitLostEvent", {
          subjects: [f.entityId],
          location: capital ? idx(capital.x, capital.y) : -1,
          factions: [f.id],
          causes: [],
          evidence: [`${id} for ${((W.tick - (f.traitSince[id] || 0)) / TICKS_PER_YEAR).toFixed(0)} years`],
          importance: 2,
          data: { polity: f.name, trait: id },
        });
    f.traits = next;
    applyTraitEffects(f);
  }
}
function polityHasTrait(f, id) {
  return !!f?.traits?.includes(id);
}
const updateWeatherCycleTraitsBase = updateWeatherCycle;
updateWeatherCycle = function () {
  updateWeatherCycleTraitsBase();
  if (W?.factions && W.tick % 512 === 300) updatePolityTraits();
};
// Traits tilt what unrest reads and what settlers dare.
const unrestOfTraitsBase = unrestOf;
unrestOf = function (place) {
  const base = unrestOfTraitsBase(place),
    f = polityOf(place);
  return +clamp(base + (polityHasTrait(f, "Fractious") ? 0.05 : 0) - (polityHasTrait(f, "Egalitarians") ? 0.03 : 0), 0, 1).toFixed(3);
};
// ── Chronicle, Legends, inspector ──────────────────────────────────────────────
const eventSentenceTraitsBase = eventSentence;
eventSentence = function (e) {
  const d = e.data || {};
  switch (e.type) {
    case "TraitGainedEvent":
      return `${d.polity} came to be known as ${d.trait}: ${d.gloss}.`;
    case "TraitLostEvent":
      return `${d.polity} were no longer called ${d.trait}.`;
    default:
      return eventSentenceTraitsBase(e);
  }
};
function traitTags(f) {
  return (f?.traits || []).map((id) => `<span class="tag gold" title="${esc(TRAIT_GLOSS[id] || "")}">${esc(id)}</span>`).join("");
}
const renderFactionPageTraitsBase = renderFactionPage;
renderFactionPage = function (id) {
  const html = renderFactionPageTraitsBase(id),
    f = W.factions.find((x) => x.id === id);
  if (!f?.traits?.length) return html;
  const at = html.indexOf('<div class="kv">');
  const block = `<div class="row wrap" style="gap:4px;margin:0 0 8px">${traitTags(f)}</div>`;
  return at < 0 ? html + block : html.slice(0, at) + block + html.slice(at);
};
const nonLifeInspectorTraitsBase = nonLifeInspector;
nonLifeInspector = function (id) {
  const html = nonLifeInspectorTraitsBase(id),
    f = W.factions.find((x) => x.entityId === id);
  if (!f?.traits?.length) return html;
  const at = html.indexOf('<div class="kv">');
  const block = `<div class="row wrap" style="gap:4px;margin:4px 0 8px">${traitTags(f)}</div>`;
  return at < 0 ? html + block : html.slice(0, at) + block + html.slice(at);
};
window.ALIFE_TRAITS_DEBUG = Object.freeze({
  update: () => {
    updatePolityTraits();
    return W.factions.map((f) => ({ id: f.id, name: f.name, traits: f.traits.slice() }));
  },
  stats: (factionId) => polityStats(W.factions.find((f) => f.id === factionId)),
  gloss: TRAIT_GLOSS,
  has: (factionId, trait) => polityHasTrait(W.factions.find((f) => f.id === factionId), trait),
});
