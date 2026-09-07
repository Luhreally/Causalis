// ═══════════════════════════════════════════════════════════════════════════
// 91. THE LONG AFTERNOON — climate strain, ways of rule, orbital works, epilogue
// ═══════════════════════════════════════════════════════════════════════════
// Once a world reached engines, nothing pushed back: industry cost the sky
// nothing, every polity was ruled the same nameless way, the space between
// the first ship and the stars held no works, and after the ending the
// chronicle went on at the same pitch for ever. Here the home world's late
// loops run. Industry lays a strain on the sky, one part per engine town and
// more per combustion or electric town, that Stewardship and Ecological
// Engineering ease; a strained sky brings more droughts and heat waves and is
// read on the World tab. Every polity has a way of rule on two axes (the many
// or the one; closed or open) drifting with letters, trade, war, peace, coups,
// and civil wars, named as a government on its page and distancing polities
// whose ways differ (statecraft reads it). Polities with Satellites and a
// launch tower raise orbital stations that quicken inquiry. After the ladder
// reaches the stars the world enters its epilogue: the annals keep a decade
// ledger, the alert feed quietens to what matters, and the Ages page tells the
// long afternoon decade by decade. Rendering only reads.
const STRAIN_PER_ENGINE_TOWN = 0.02,
  STRAIN_PER_COMBUSTION_TOWN = 0.03,
  STRAIN_PER_ELECTRIC_TOWN = 0.03,
  STRAIN_FUSION_RELIEF = 0.02,
  STRAIN_EASE_STEWARDSHIP = 0.02,
  STRAIN_EASE_ECOLOGY = 0.05,
  STRAIN_DECAY = 0.985,
  STRAIN_MAX = 3,
  STRAIN_HEAVY = 1,
  STRAIN_EASED = 0.5,
  STATION_YEARS = 10,
  STATION_MAX = 3,
  EPILOGUE_DECADE = TICKS_PER_YEAR * 10;
function ensureAfternoon(world = W) {
  if (!world) return null;
  world.afternoon = world.afternoon || {
    version: 1,
    strain: 0,
    peakStrain: 0,
    heavy: false,
    droughts: 0,
    stations: {},
    epilogue: [],
    epilogueLast: -1,
  };
  world.afternoon.stations = world.afternoon.stations || {};
  world.afternoon.epilogue = world.afternoon.epilogue || [];
  for (const f of world.factions || []) ensureIdeology(f);
  return world.afternoon;
}
const restoreWorldDefaultsAfternoonBase = restoreWorldDefaults;
restoreWorldDefaults = function () {
  restoreWorldDefaultsAfternoonBase();
  ensureAfternoon(W);
};
// ── Climate strain ────────────────────────────────────────────────────────────
function industrialStrainDelta() {
  let delta = 0;
  for (const s of W.settlements) {
    if (s.ruined || !s.knownProcesses) continue;
    const k = s.knownProcesses;
    if (k.includes("mechanization")) delta += STRAIN_PER_ENGINE_TOWN;
    if (k.includes("combustion")) delta += STRAIN_PER_COMBUSTION_TOWN;
    if (k.includes("electricity")) delta += k.includes("fusion") ? STRAIN_PER_ELECTRIC_TOWN - STRAIN_FUSION_RELIEF : STRAIN_PER_ELECTRIC_TOWN;
    if (k.includes("planetary_stewardship")) delta -= STRAIN_EASE_STEWARDSHIP;
    if (k.includes("ecological_engineering")) delta -= STRAIN_EASE_ECOLOGY;
  }
  return delta;
}
function strainWord(strain) {
  return strain >= 2 ? "choking" : strain >= STRAIN_HEAVY ? "heavy" : strain >= STRAIN_EASED ? "hazed" : "clear";
}
function updateClimateStrain() {
  const a = ensureAfternoon(W),
    before = a.strain;
  a.strain = clamp(a.strain * STRAIN_DECAY + industrialStrainDelta(), 0, STRAIN_MAX);
  a.peakStrain = Math.max(a.peakStrain, a.strain);
  const lead = W.settlements.filter((s) => !s.ruined && s.knownProcesses?.includes("mechanization")).sort((x, y) => settlementPopulation(y) - settlementPopulation(x))[0];
  if (!a.heavy && a.strain >= STRAIN_HEAVY) {
    a.heavy = true;
    const ev = emitEvent("ClimateEvent", {
      subjects: lead ? [lead.entityId] : [],
      location: lead ? idx(lead.x, lead.y) : -1,
      factions: lead?.factionId ? [lead.factionId] : [],
      causes: [W.lastEventByType.TechAdvanceEvent].filter(Boolean),
      evidence: [`strain ${a.strain.toFixed(2)} on the sky`, `${W.settlements.filter((s) => !s.ruined && s.knownProcesses?.includes("mechanization")).length} engine towns`],
      importance: 4,
      data: { strain: +a.strain.toFixed(2), word: strainWord(a.strain), place: lead?.name || "" },
    });
    if (typeof recordMilestone === "function") recordMilestone("climate-strain", "The sky grew heavy with industry", lead || null, { evidence: `strain ${a.strain.toFixed(2)}` });
    return ev;
  }
  if (a.heavy && a.strain < STRAIN_EASED) {
    a.heavy = false;
    return emitEvent("ClimateEasedEvent", {
      subjects: lead ? [lead.entityId] : [],
      location: lead ? idx(lead.x, lead.y) : -1,
      factions: lead?.factionId ? [lead.factionId] : [],
      causes: [W.lastEventByType.ClimateEvent, W.lastEventByType.TechAdvanceEvent].filter(Boolean),
      evidence: [`strain fell from ${before.toFixed(2)} to ${a.strain.toFixed(2)}`],
      importance: 4,
      data: { strain: +a.strain.toFixed(2), word: strainWord(a.strain) },
    });
  }
  return null;
}
// A strained sky tips the season toward drought and heat.
function strainedWeatherRoll(cycle = Math.floor(W.tick / 256)) {
  const a = W.afternoon;
  if (!a || a.strain < 0.3) return null;
  const chance = Math.min(0.5, a.strain * 0.2);
  if (counterRand("strain-weather", cycle) >= chance) return null;
  return counterRand("strain-kind", cycle) < 0.5 ? "Drought" : "Heat Wave";
}
const updateWeatherCycleAfternoonBase = updateWeatherCycle;
updateWeatherCycle = function () {
  updateWeatherCycleAfternoonBase();
  if (!W?.settlements) return;
  if (W.tick % 256 === 1) {
    const forced = strainedWeatherRoll();
    if (forced && W.weather?.name !== forced) {
      setWeather(forced, 0.8 + Math.min(1, W.afternoon.strain) * 0.4, W.lastEventByType.ClimateEvent || 0);
      W.afternoon.droughts++;
    }
  }
  if (W.tick % TICKS_PER_YEAR === 180) {
    updateClimateStrain();
    driftIdeologies();
    raiseStations();
  }
  if (W.tick % EPILOGUE_DECADE === 0 && W.tick > 0) recordEpilogue();
};
// ── Ways of rule ──────────────────────────────────────────────────────────────
function ensureIdeology(f) {
  if (!f) return null;
  if (!f.ideology) {
    f.ideology = {
      rule: clamp(((f.ethos?.hierarchical ?? 0.5) - 0.5) * 1.4 + (counterRand("ideology-rule", f.id) - 0.5) * 0.3, -1, 1),
      openness: clamp(
        ((f.ethos?.mercantile ?? 0.5) + (f.ethos?.inventive ?? 0.5) - 1) * 0.9 + (counterRand("ideology-open", f.id) - 0.5) * 0.3,
        -1,
        1,
      ),
    };
    f.government = governmentName(f);
  }
  return f.ideology;
}
function governmentName(f) {
  const i = f.ideology,
    tech = (t) => W.settlements.some((s) => !s.ruined && s.factionId === f.id && s.knownProcesses?.includes(t));
  if (i.rule > 0.4) return i.openness > 0.3 ? (tech("computing") ? "Technocracy" : "Crowned republic") : i.openness < -0.3 ? "Autocracy" : "Monarchy";
  if (i.rule < -0.4) return i.openness > 0.3 ? "Open republic" : i.openness < -0.3 ? "Closed commune" : "Council of the many";
  return i.openness > 0.3 ? "Merchant oligarchy" : i.openness < -0.3 ? "Closed oligarchy" : "Assembly of houses";
}
function ideologyDistance(a, b) {
  const x = ensureIdeology(a),
    y = ensureIdeology(b);
  if (!x || !y) return 0;
  return clamp((Math.abs(x.rule - y.rule) + Math.abs(x.openness - y.openness)) / 4, 0, 1);
}
function driftIdeologies() {
  for (const f of W.factions) {
    if (!(f.stability > 0)) continue;
    const i = ensureIdeology(f),
      towns = W.settlements.filter((s) => !s.ruined && s.factionId === f.id),
      knows = (t) => towns.some((s) => s.knownProcesses?.includes(t)),
      wars = (W.activeWars || []).filter((w) => !w.ended && (w.a === f.id || w.b === f.id)).length,
      trade = Object.values(f.relations || {}).reduce((n, r) => n + (r.trade || 0), 0),
      recentUpheaval = (W.events || []).some(
        (e) => ["CivilWarEvent", "CoupEvent", "SecessionEvent"].includes(e.type) && e.factions?.includes(f.id) && W.tick - e.tick < TICKS_PER_YEAR,
      );
    let dRule = wars > 0 ? 0.04 : -0.02,
      dOpen = (knows("writing") ? 0.02 : 0) + (knows("printing") ? 0.03 : 0) + (knows("radio") ? 0.02 : 0) + Math.min(0.04, trade * 0.004) - (wars > 1 ? 0.03 : 0);
    if (recentUpheaval) dRule -= Math.sign(i.rule) * 0.3;
    i.rule = clamp(i.rule + dRule, -1, 1);
    i.openness = clamp(i.openness + dOpen, -1, 1);
    const name = governmentName(f);
    if (name !== f.government) {
      const capital = factionCapital(f),
        ev = emitEvent("IdeologyEvent", {
          subjects: [f.entityId],
          location: capital ? idx(capital.x, capital.y) : -1,
          factions: [f.id],
          causes: [W.lastEventByType.CivilWarEvent, W.lastEventByType.SuccessionEvent].filter(Boolean),
          evidence: [`rule ${i.rule.toFixed(2)}, openness ${i.openness.toFixed(2)}`],
          importance: 3,
          data: { polity: f.name, from: f.government, to: name },
        });
      f.government = name;
      f.governmentEventId = ev.id;
    }
  }
}
// ── Orbital works ─────────────────────────────────────────────────────────────
function stationCount(factionId) {
  return (W.afternoon?.stations || {})[factionId] || 0;
}
function raiseStations() {
  const a = ensureAfternoon(W),
    out = [];
  for (const f of W.factions) {
    if (!(f.stability > 0) || stationCount(f.id) >= STATION_MAX) continue;
    if (!factionHasTech(f.id, "satellites")) continue;
    const tower = W.settlements.find((s) => !s.ruined && s.factionId === f.id && completedBuildings(s, "launch_tower").length);
    if (!tower) continue;
    const last = a.stationLast?.[f.id] ?? -1e9;
    if (W.tick - last < TICKS_PER_YEAR * STATION_YEARS) continue;
    a.stationLast = a.stationLast || {};
    a.stationLast[f.id] = W.tick;
    a.stations[f.id] = stationCount(f.id) + 1;
    out.push(
      emitEvent("StationEvent", {
        subjects: [tower.entityId, f.entityId],
        location: idx(tower.x, tower.y),
        factions: [f.id],
        causes: [W.lastEventByType.TechAdvanceEvent, W.lastEventByType.AscensionEvent].filter(Boolean),
        evidence: [`${a.stations[f.id]} station${a.stations[f.id] === 1 ? "" : "s"} in orbit`],
        importance: 4,
        data: { polity: f.name, place: tower.name, count: a.stations[f.id] },
      }),
    );
    if (typeof recordMilestone === "function") recordMilestone("first-station", `${f.name} raised the first orbital station`, tower, { evidence: "an eye and a workshop above the sky" });
  }
  return out;
}
// Stations quicken inquiry for the polity that holds them (read through 87).
const researchTempoFactorAfternoonBase = researchTempoFactor;
researchTempoFactor = function (place) {
  const base = researchTempoFactorAfternoonBase(place),
    n = place?.factionId ? Math.min(STATION_MAX, stationCount(place.factionId)) : 0;
  return base * (1 + 0.1 * n);
};
// ── Epilogue ──────────────────────────────────────────────────────────────────
function epilogueActive() {
  return !!W && (W.civilization?.stage === "interstellar" || !!W.endingShownTick);
}
function recordEpilogue() {
  if (!epilogueActive()) return null;
  const a = ensureAfternoon(W),
    year = formatYear();
  if (a.epilogueLast === year) return null;
  a.epilogueLast = year;
  const living = W.factions.filter((f) => f.stability > 0),
    lead = living.slice().sort((x, y) => factionPower(y) - factionPower(x))[0],
    entry = {
      year,
      people: biospherePopulation(KINDS.PERSON),
      towns: W.settlements.filter((s) => !s.ruined).length,
      polities: living.length,
      colonies: (W.colonies || []).filter((c) => c.status === "founded").length,
      strain: +a.strain.toFixed(2),
      stations: Object.values(a.stations).reduce((n, v) => n + v, 0),
      leading: lead?.name || "",
      government: lead?.government || "",
    };
  a.epilogue.push(entry);
  if (a.epilogue.length > 60) a.epilogue = a.epilogue.slice(-60);
  return emitEvent("EpilogueEvent", {
    subjects: lead ? [lead.entityId] : [],
    location: -1,
    factions: lead ? [lead.id] : [],
    causes: [W.lastEventByType.ColonyFoundedEvent, W.lastEventByType.AscensionEvent].filter(Boolean),
    evidence: [`${entry.people} people, ${entry.towns} towns, ${entry.polities} polities, ${entry.colonies} colonies`],
    importance: 3,
    data: entry,
  });
}
// In the epilogue the alert feed keeps only what matters.
const alertWorthyAfternoonBase = alertWorthy;
alertWorthy = function (a) {
  const base = alertWorthyAfternoonBase(a);
  if (!base) return a.type === "ClimateEvent" || a.type === "ClimateEasedEvent" || a.type === "StationEvent" || a.type === "EpilogueEvent";
  if (epilogueActive() && (a.importance || 0) < 4 && a.type !== "MilestoneEvent") return false;
  return true;
};
// ── Chronicle and pages ───────────────────────────────────────────────────────
const eventSentenceAfternoonBase = eventSentence;
eventSentence = function (e) {
  const d = e.data || {};
  if (e.type === "ClimateEvent") return `The sky over ${d.place || "the engine towns"} grew ${d.word} with industry.`;
  if (e.type === "ClimateEasedEvent") return `The sky cleared to ${d.word} as industry was tended.`;
  if (e.type === "IdeologyEvent") return `${d.polity} passed from ${(d.from || "its old way").toLowerCase()} to ${(d.to || "a new way").toLowerCase()}.`;
  if (e.type === "StationEvent") return `${d.polity} raised an orbital station from ${d.place}, its ${d.count === 1 ? "first" : d.count === 2 ? "second" : "third"}.`;
  if (e.type === "EpilogueEvent")
    return `Year ${d.year}: ${d.people} people in ${d.towns} towns under ${d.polities} polit${d.polities === 1 ? "y" : "ies"}, ${d.colonies} colon${d.colonies === 1 ? "y" : "ies"} among the stars${d.leading ? `, ${d.leading} foremost as ${String(d.government).toLowerCase()}` : ""}.`;
  return eventSentenceAfternoonBase(e);
};
const renderFactionPageAfternoonBase = renderFactionPage;
renderFactionPage = function (id) {
  const html = renderFactionPageAfternoonBase(id),
    f = W.factions.find((x) => x.id === id);
  if (!f) return html;
  ensureIdeology(f);
  const stations = stationCount(f.id),
    row = `<div class="kv"><span>Rule</span><b>${esc(f.government || governmentName(f))} <span class="muted">${f.ideology.rule > 0.2 ? "the one" : f.ideology.rule < -0.2 ? "the many" : "the few"} · ${f.ideology.openness > 0.2 ? "open" : f.ideology.openness < -0.2 ? "closed" : "guarded"}</span>${stations ? ` · ${stations} orbital station${stations === 1 ? "" : "s"}` : ""}</b></div>`,
    at = html.indexOf('<div class="subhead">');
  return at < 0 ? html + row : html.slice(0, at) + row + html.slice(at);
};
const renderAgesPageAfternoonBase = renderAgesPage;
renderAgesPage = function () {
  const html = renderAgesPageAfternoonBase();
  ensureAfternoon(W);
  const a = W.afternoon,
    sky = `<div class="subhead">The sky</div><div class="kv"><span>Strain of industry</span><b>${strainWord(a.strain)} (${a.strain.toFixed(2)}${a.peakStrain > a.strain + 0.05 ? `, once ${a.peakStrain.toFixed(2)}` : ""}) · ${a.droughts} strained season${a.droughts === 1 ? "" : "s"}</b></div>`,
    epilogue = a.epilogue.length
      ? `<div class="subhead">The long afternoon</div>${a.epilogue
          .slice()
          .reverse()
          .map((e) => `<div class="kv"><span>year ${e.year}</span><b>${e.people} people · ${e.towns} towns · ${e.polities} polities · ${e.colonies} colonies${e.stations ? ` · ${e.stations} stations` : ""} · sky ${strainWord(e.strain)}</b></div>`)
          .join("")}`
      : "";
  return html + sky + epilogue;
};
const refreshWorldInfoAfternoonBase = refreshWorldInfo;
refreshWorldInfo = function () {
  refreshWorldInfoAfternoonBase();
  if (!W || !DOM?.worldPane) return;
  ensureAfternoon(W);
  const a = W.afternoon,
    engines = W.settlements.filter((s) => !s.ruined && s.knownProcesses?.includes("mechanization")).length;
  if (!engines && !a.strain && !a.epilogue.length) return;
  const card = `<div class="subhead">The sky</div><div class="card"><div class="row between"><b>${esc(strainWord(a.strain).replace(/^./, (c) => c.toUpperCase()))} sky</b><span class="tag mono">strain ${a.strain.toFixed(2)}</span></div><small class="muted">${engines} engine town${engines === 1 ? "" : "s"} · ${a.droughts} strained season${a.droughts === 1 ? "" : "s"}${a.epilogue.length ? ` · epilogue, ${a.epilogue.length} decade${a.epilogue.length === 1 ? "" : "s"} kept` : ""}</small></div>`,
    anchor = `<div class="subhead">Chemistry viability`;
  DOM.worldPane.innerHTML = DOM.worldPane.innerHTML.includes(anchor) ? DOM.worldPane.innerHTML.replace(anchor, card + anchor) : DOM.worldPane.innerHTML + card;
};
window.ALIFE_AFTERNOON_DEBUG = Object.freeze({
  strain: () => ensureAfternoon(W).strain,
  delta: () => industrialStrainDelta(),
  tick: () => updateClimateStrain(),
  weather: (cycle) => strainedWeatherRoll(cycle),
  word: (s) => strainWord(s),
  ideology: (factionId) => ({ ...ensureIdeology(W.factions.find((f) => f.id === factionId)) }),
  government: (factionId) => governmentName(W.factions.find((f) => f.id === factionId)),
  distance: (aId, bId) => ideologyDistance(W.factions.find((f) => f.id === aId), W.factions.find((f) => f.id === bId)),
  drift: () => driftIdeologies(),
  stations: (factionId) => stationCount(factionId),
  raise: () => raiseStations(),
  epilogue: () => ensureAfternoon(W).epilogue.map((e) => ({ ...e })),
  record: () => recordEpilogue(),
  active: () => epilogueActive(),
});
