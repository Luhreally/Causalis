// ═══════════════════════════════════════════════════════════════════════════
// 85. ORBIT — the ladder runs past the ground: charted stars, ships, colonies
// ═══════════════════════════════════════════════════════════════════════════
// The civilization ladder ended at "complex terrestrial" and the first ship
// away fired an ending and then meant nothing: no destination, no crew, no
// colony. This is the groundwork for what comes after, as records and pages,
// without a single new scene. The ladder gains two stages, orbital (the first
// ship away) and interstellar (a colony founded), so the gate readout and the
// causal skip keep aiming. The seed lays down a catalogue of nearby stars
// with the same physical-law grammar the home world was built from (distance,
// class, worlds, habitability, riches, hazards, and a seed a future world file
// can be generated from); an observatory with astronomy charts them, nearest
// first. A ship that leaves picks the best charted star, carries a roster and
// the crafts of the town that built it, travels at half a light-year a year,
// and founds a colony on arrival that grows or is lost by its world's
// habitability; a launch tower can send another ship a generation later.
// Legends gains a Stars page and colony pages, polities count the worlds they
// hold, and every charting, departure, founding, and loss is chronicled.
const ORBIT_TICKS_PER_LIGHTYEAR = TICKS_PER_YEAR * 2,
  ORBIT_CHART_CADENCE = 256,
  ORBIT_COLONY_SEED = 24,
  ORBIT_RELAUNCH_TICKS = TICKS_PER_YEAR * 40,
  ORBIT_STAR_CLASSES = ["M", "M", "K", "K", "G", "F", "A"];
function ensureOrbit(world = W) {
  if (!world) return;
  if (!Array.isArray(world.stars) || !world.stars.length) world.stars = generateStars(world);
  world.voyages = world.voyages || [];
  world.colonies = world.colonies || [];
  if (world.nextVoyageId == null) world.nextVoyageId = 1;
  if (world.nextColonyId == null) world.nextColonyId = 1;
}
function starName(lang, r, i) {
  if (!lang || lang.legacy) {
    const a = NAME_B[(r.int(NAME_B.length) + i * 7) % NAME_B.length],
      b = ["Reach", "Hollow", "Star", "Watch", "Deep", "Ford"][r.int(6)];
    return `${a} ${b}`;
  }
  return titleWord(langWord(lang, r, 2 + r.int(2)));
}
function habitabilityWord(h) {
  return h >= 0.75
    ? "a garden world"
    : h >= 0.5
      ? "a temperate world"
      : h >= 0.3
        ? "a harsh world"
        : "a hostile world";
}
// Nearby stars, each with a prime world drawn from the same law grammar.
function generateStars(world) {
  const r = makeRng(world.seed, "stars"),
    lang = typeof protoLanguageOf === "function" ? protoLanguageOf(world) : null,
    count = 6 + r.int(4),
    variability = world.config?.variability ?? 0.5,
    harshness = world.config?.harshness ?? 0.5,
    stars = [];
  for (let i = 0; i < count; i++) {
    const name = starName(lang, r, i),
      laws = makeWorldLaws(`${world.seed}:star:${i}:${name}`, variability, harshness, false),
      strain =
        Math.abs(laws.solarFlux - 1) * 0.8 +
        Math.abs(laws.solventRetention - 1) * 0.6 +
        Math.abs(laws.oxidationPotential - 1) * 0.5 +
        Math.abs(laws.plantEfficiency - 1.04) * 0.5,
      habitability = +clamp(1 - strain / 1.6 - r.next() * 0.15, 0.05, 0.98).toFixed(2);
    stars.push({
      id: i + 1,
      name,
      distance: +(3 + r.next() * 34 + i * 3).toFixed(1),
      starClass: ORBIT_STAR_CLASSES[r.int(ORBIT_STAR_CLASSES.length)],
      planets: 1 + r.int(8),
      habitability,
      resources: +laws.resourceRichness.toFixed(2),
      hazards: +laws.climateVolatility.toFixed(2),
      seed: `${world.seed}:${name}`,
      chartedTick: 0,
      chartedBy: "",
    });
  }
  stars.sort((a, b) => a.distance - b.distance || a.id - b.id);
  return stars;
}
function chartedStars() {
  ensureOrbit();
  return W.stars.filter((s) => s.chartedTick > 0);
}
function observatoryTowns() {
  return W.settlements.filter(
    (s) =>
      !s.ruined &&
      s.knownProcesses.includes("astronomy") &&
      completedBuildings(s, "observatory").length > 0,
  );
}
// An observatory with astronomy charts the nearest unknown star.
function chartStars(force = false) {
  ensureOrbit();
  const towns = observatoryTowns();
  if (!towns.length && !force) return null;
  const star = W.stars.find((s) => !s.chartedTick);
  if (!star) return null;
  const town = towns.sort(
    (a, b) => b.knownProcesses.length - a.knownProcesses.length || a.id - b.id,
  )[0];
  star.chartedTick = W.tick;
  star.chartedBy = town?.name || "the sky-watchers";
  const first = chartedStars().length === 1;
  return emitEvent("StarChartedEvent", {
    subjects: [town?.entityId].filter(Boolean),
    location: town ? idx(town.x, town.y) : -1,
    factions: town?.factionId ? [town.factionId] : [],
    causes: [W.lastEventByType.TechAdvanceEvent || 0].filter(Boolean),
    evidence: [
      `${star.name} lies ${star.distance} light-years away`,
      `its prime world reads as ${habitabilityWord(star.habitability)}`,
    ],
    importance: first ? 3 : 2,
    data: {
      star: star.name,
      distance: star.distance,
      habitability: habitabilityWord(star.habitability),
      town: star.chartedBy,
      first,
    },
  });
}
// The best charted star nobody has set out for.
function chooseDestination() {
  ensureOrbit();
  const taken = new Set(W.voyages.filter((v) => v.starId).map((v) => v.starId));
  let best = null,
    score = -Infinity;
  for (const star of chartedStars()) {
    if (taken.has(star.id)) continue;
    const s = star.habitability * 2 - star.distance / 40;
    if (s > score) {
      score = s;
      best = star;
    }
  }
  return best || chartedStars().sort((a, b) => a.distance - b.distance)[0] || null;
}
// ── Ships ──────────────────────────────────────────────────────────────────────
const launchShipOrbitBase = launchShip;
launchShip = function (place, force = false) {
  ensureOrbit();
  const ascension = launchShipOrbitBase(place, force);
  if (!ascension) return ascension;
  const ev = W.events.find((e) => e.id === ascension.eventId),
    crew = (ev?.subjects || []).filter((id) => id !== place.entityId).map((id) => entityName(id)),
    star = chooseDestination(),
    faction = W.factions.find((f) => f.id === place.factionId),
    voyage = {
      id: W.nextVoyageId++,
      ascensionId: ascension.id,
      name: `${place.name} ${W.voyages.filter((v) => v.fromSettlementId === place.id).length + 1}`,
      fromSettlementId: place.id,
      fromName: place.name,
      factionId: place.factionId || 0,
      factionName: faction?.name || "",
      crew,
      crafts: place.knownProcesses.slice(),
      starId: star?.id || 0,
      starName: star?.name || "",
      departTick: W.tick,
      arriveTick: star ? W.tick + Math.round(star.distance * ORBIT_TICKS_PER_LIGHTYEAR) : 0,
      status: star ? "under way" : "in orbit",
    };
  W.voyages.push(voyage);
  ev?.evidence.push(
    star
      ? `bound for ${star.name}, ${star.distance} light-years and ${Math.round((voyage.arriveTick - W.tick) / TICKS_PER_YEAR)} years away`
      : "no star was charted, so it holds orbit and waits for the sky to be read",
  );
  ascension.voyageId = voyage.id;
  return ascension;
};
function foundColony(voyage) {
  const star = W.stars.find((s) => s.id === voyage.starId);
  if (!star) return null;
  const colony = {
    id: W.nextColonyId++,
    name: `New ${voyage.fromName}`,
    starId: star.id,
    starName: star.name,
    voyageId: voyage.id,
    factionId: voyage.factionId,
    factionName: voyage.factionName,
    foundedTick: W.tick,
    population: ORBIT_COLONY_SEED,
    peak: ORBIT_COLONY_SEED,
    knownProcesses: voyage.crafts.slice(),
    habitability: star.habitability,
    status: "founded",
    lastYearTick: W.tick,
  };
  W.colonies.push(colony);
  voyage.status = "arrived";
  voyage.colonyId = colony.id;
  const from = W.settlements.find((s) => s.id === voyage.fromSettlementId),
    first = W.colonies.length === 1;
  return emitEvent("ColonyFoundedEvent", {
    subjects: [from?.entityId].filter(Boolean),
    location: from ? idx(from.x, from.y) : -1,
    factions: voyage.factionId ? [voyage.factionId] : [],
    causes: [W.ascensions.find((a) => a.id === voyage.ascensionId)?.eventId || 0].filter(Boolean),
    evidence: [
      `${voyage.crew.length} names on the roster of ${voyage.name}`,
      `${colony.knownProcesses.length} crafts carried from ${voyage.fromName}`,
      `${star.name}'s prime world is ${habitabilityWord(star.habitability)}`,
    ],
    importance: 5,
    data: {
      colony: colony.name,
      star: star.name,
      from: voyage.fromName,
      polity: voyage.factionName,
      years: Math.round((W.tick - voyage.departTick) / TICKS_PER_YEAR),
      first,
    },
  });
}
function growColonies() {
  for (const c of W.colonies) {
    if (c.status !== "founded" || W.tick - c.lastYearTick < TICKS_PER_YEAR) continue;
    c.lastYearTick = W.tick;
    const star = W.stars.find((s) => s.id === c.starId),
      h = c.habitability,
      cap = Math.round(60 + 340 * h),
      growth = 1 + 0.035 * h - (star?.hazards || 1) * 0.004;
    c.population = Math.min(cap, Math.max(1, Math.round(c.population * growth)));
    c.peak = Math.max(c.peak, c.population);
    if (h < 0.3 && counterRand("colony-lost", Math.floor(W.tick / TICKS_PER_YEAR), c.id) < 0.03) {
      c.status = "lost";
      c.lostTick = W.tick;
      emitEvent("ColonyLostEvent", {
        subjects: [],
        location: -1,
        factions: c.factionId ? [c.factionId] : [],
        causes: [],
        evidence: [`${c.name} held ${c.population} people on ${habitabilityWord(h)}`],
        importance: 4,
        data: { colony: c.name, star: c.starName, population: c.population },
      });
    }
  }
}
function updateStarVoyages() {
  ensureOrbit();
  const founded = [];
  for (const v of W.voyages) {
    if (v.status === "in orbit" && !v.starId) {
      const star = chooseDestination();
      if (star) {
        v.starId = star.id;
        v.starName = star.name;
        v.departTick = W.tick;
        v.arriveTick = W.tick + Math.round(star.distance * ORBIT_TICKS_PER_LIGHTYEAR);
        v.status = "under way";
      }
      continue;
    }
    if (v.status === "under way" && W.tick >= v.arriveTick) {
      const ev = foundColony(v);
      if (ev) founded.push(ev);
    }
  }
  return founded;
}
function updateOrbit() {
  if (W.tick % ORBIT_CHART_CADENCE === 160) chartStars();
  if (W.tick % 64 === 8) {
    updateStarVoyages();
    growColonies();
  }
}
const simTickOrbitBase = simTick;
simTick = function () {
  simTickOrbitBase();
  if (W?.settlements) updateOrbit();
};
const restoreWorldOrbitBase = restoreWorldDefaults;
restoreWorldDefaults = function () {
  restoreWorldOrbitBase();
  if (W) ensureOrbit(W);
};
// ── Two more rungs on the ladder ───────────────────────────────────────────────
function orbitalStageReached() {
  return (W.ascensions?.length || 0) > 0;
}
function interstellarStageReached() {
  ensureOrbit();
  return W.colonies.some((c) => c.status === "founded" || c.status === "lost");
}
const civilizationStageGateOrbitBase = civilizationStageGate;
civilizationStageGate = function (index) {
  const stage = CIV_STAGE_ORDER[index];
  if (stage === "orbital") return orbitalStageReached();
  if (stage === "interstellar") return interstellarStageReached();
  return civilizationStageGateOrbitBase(index);
};
function orbitalShortfall() {
  const towns = W.settlements.filter((s) => !s.ruined && s.knownProcesses),
    missing = [];
  if (!towns.some((s) => s.knownProcesses.includes("starflight")))
    missing.push("develop Starflight");
  if (!towns.some((s) => completedBuildings(s, "launch_tower").length))
    missing.push("complete a Launch tower");
  if (typeof cityStage === "function" && !towns.some((s) => cityStage(s)))
    missing.push("grow a city to the urban stage");
  if (!missing.length && !orbitalStageReached()) missing.push("launch the first ship");
  return missing;
}
function interstellarShortfall() {
  ensureOrbit();
  const missing = [];
  if (!chartedStars().length) missing.push("chart a star (astronomy and an observatory)");
  const underWay = W.voyages.filter((v) => v.status === "under way");
  if (!underWay.length && !W.voyages.some((v) => v.status === "arrived"))
    missing.push("launch a ship toward a charted star");
  if (!interstellarStageReached() && underWay.length)
    missing.push(
      `a colony (${underWay[0].name} reaches ${underWay[0].starName} in year ${formatYear(underWay[0].arriveTick)})`,
    );
  return missing;
}
const settlementStageShortfallOrbitBase = settlementStageShortfall;
settlementStageShortfall = function (s, target) {
  if (target === "orbital") return orbitalShortfall();
  if (target === "interstellar") return interstellarShortfall();
  return settlementStageShortfallOrbitBase(s, target);
};
const civilizationGateStatusOrbitBase = civilizationGateStatus;
civilizationGateStatus = function () {
  const status = civilizationGateStatusOrbitBase();
  if (!status) return status;
  if (status.next === "orbital") {
    status.requirement = "Starflight, a completed Launch tower, and the first ship away";
    status.missing = orbitalShortfall();
  } else if (status.next === "interstellar") {
    status.requirement = "a charted star, a ship under way to it, and a colony founded on arrival";
    status.missing = interstellarShortfall();
  }
  return status;
};
const causalSkipMicroStagesOrbitBase = causalSkipMicroStages;
causalSkipMicroStages = function () {
  const next = CIV_STAGE_ORDER[normalizeCivilizationAuthority().stageIndex + 1];
  if (next !== "interstellar") return causalSkipMicroStagesOrbitBase();
  return [
    { key: "chart", label: "a charted star", done: () => chartedStars().length > 0 },
    {
      key: "voyage",
      label: "a ship under way to a charted star",
      done: () => (W.voyages || []).some((v) => v.status === "under way" || v.status === "arrived"),
    },
    { key: "colony", label: "a colony founded", done: () => interstellarStageReached() },
  ];
};
const causalPushTowardOrbitBase = causalPushToward;
causalPushToward = function (target = causalTarget()) {
  if (!target) return null;
  if (target.key === "chart") {
    const lead = causalLeadSettlement();
    if (lead && !lead.knownProcesses.includes("astronomy"))
      causalPushResearch(lead, "astronomy", target.pushes || 1);
    else if (lead) causalPushBuilding(lead, "observatory", target.pushes || 1);
    if (observatoryTowns().length) chartStars();
    target.pushes = (target.pushes || 0) + 1;
    return "chart";
  }
  if (target.key === "voyage") {
    const lead = causalLeadSettlement();
    if (lead) {
      if (!lead.knownProcesses.includes("starflight"))
        causalPushResearch(lead, "starflight", target.pushes || 1);
      else if (!completedBuildings(lead, "launch_tower").length)
        causalPushBuilding(lead, "launch_tower", target.pushes || 1);
      else if (lead.stability < 0.4) lead.stability = clamp(lead.stability + 0.03, 0, 1);
    }
    target.pushes = (target.pushes || 0) + 1;
    return "voyage";
  }
  if (target.key === "colony") {
    target.pushes = (target.pushes || 0) + 1;
    return "colony";
  }
  return causalPushTowardOrbitBase(target);
};
// ── Chronicle and pages ────────────────────────────────────────────────────────
const eventSentenceOrbitBase = eventSentence;
eventSentence = function (e) {
  const d = e.data || {};
  if (e.type === "StarChartedEvent")
    return `${d.town} charted ${d.star}, ${d.distance} light-years away, and read its prime world as ${d.habitability}.`;
  if (e.type === "ColonyFoundedEvent")
    return `${d.colony} was founded under ${d.star} by the ship from ${d.from}${d.polity ? ` of ${d.polity}` : ""}, ${d.years} years after it left.`;
  if (e.type === "ColonyLostEvent")
    return `${d.colony} under ${d.star} fell silent with ${d.population} people.`;
  return eventSentenceOrbitBase(e);
};
const alertWorthyOrbitBase = alertWorthy;
alertWorthy = function (a) {
  return (
    alertWorthyOrbitBase(a) ||
    a.type === "ColonyFoundedEvent" ||
    a.type === "ColonyLostEvent" ||
    (a.type === "StarChartedEvent" && a.importance >= 3)
  );
};
function starRow(star) {
  const voyage = (W.voyages || []).find((v) => v.starId === star.id),
    colony = (W.colonies || []).find((c) => c.starId === star.id);
  return `<div class="kv"><span>${esc(star.name)} <span class="muted">${esc(star.starClass)} · ${star.distance} ly · ${star.planets} world${star.planets === 1 ? "" : "s"}</span></span><b>${
    star.chartedTick
      ? `${esc(habitabilityWord(star.habitability))} · riches ${Math.round(star.resources * 100)}% · hazards ${Math.round(star.hazards * 100)}%${
          colony
            ? ` · ${legendLink("colony", colony.id, esc(colony.name))}`
            : voyage
              ? ` · ${esc(voyage.name)} ${voyage.status}, arrives year ${formatYear(voyage.arriveTick)}`
              : ""
        }`
      : "uncharted"
  }</b></div>`;
}
function renderStarsPage() {
  ensureOrbit();
  const charted = chartedStars().length,
    colonies = W.colonies.filter((c) => c.status === "founded"),
    voyages = W.voyages.filter((v) => v.status === "under way");
  return `${legendHero("The stars", [
    `${charted}/${W.stars.length} charted`,
    `${voyages.length} ship${voyages.length === 1 ? "" : "s"} under way`,
    `${colonies.length} colon${colonies.length === 1 ? "y" : "ies"}`,
  ])}<div class="muted" style="margin:4px 0 8px">Charted by observatories that know astronomy, nearest first. A ship covers half a light-year a year and carries the crafts of the town that built it.</div><div class="kv-list">${W.stars
    .map(starRow)
    .join("")}</div>${
    W.voyages.length
      ? `<div class="subhead">Ships</div>${W.voyages
          .map(
            (v) =>
              `<div class="kv"><span>${esc(v.name)} <span class="muted">from ${esc(v.fromName)}${v.factionName ? ` of ${esc(v.factionName)}` : ""}</span></span><b>${esc(v.status)}${v.starName ? ` · ${esc(v.starName)}` : ""} · left year ${formatYear(v.departTick)}${v.status === "under way" ? ` · arrives ${formatYear(v.arriveTick)}` : ""} · ${v.crew.length} named aboard</b></div>`,
          )
          .join("")}`
      : ""
  }`;
}
function renderColonyPage(id) {
  ensureOrbit();
  const c = W.colonies.find((x) => x.id === id);
  if (!c) return `<div class="empty">No such colony.</div>`;
  const star = W.stars.find((s) => s.id === c.starId),
    voyage = W.voyages.find((v) => v.id === c.voyageId);
  return `${legendHero(c.name, [
    esc(c.status),
    `${c.population} people`,
    `founded year ${formatYear(c.foundedTick)}`,
  ])}<div class="kv"><span>Star</span><b>${esc(c.starName)}${star ? ` · ${esc(habitabilityWord(star.habitability))} · ${star.distance} ly` : ""}</b><span>From</span><b>${esc(voyage?.fromName || "")}${c.factionName ? ` of ${esc(c.factionName)}` : ""}</b><span>Crafts carried</span><b>${c.knownProcesses.length}</b><span>Roster</span><b>${esc((voyage?.crew || []).join(", ") || "unrecorded")}</b><span>Peak</span><b>${c.peak} people</b></div>`;
}
const renderLegendPageOrbitBase = renderLegendPage;
renderLegendPage = function (kind = UI.legend.kind, id = UI.legend.id) {
  if (!W) return renderLegendPageOrbitBase(kind, id);
  if (kind === "stars") return renderStarsPage();
  if (kind === "colony") return renderColonyPage(Number(id));
  return renderLegendPageOrbitBase(kind, id);
};
const renderLegendIndexOrbitBase = renderLegendIndex;
renderLegendIndex = function (query = "") {
  const html = renderLegendIndexOrbitBase(query);
  ensureOrbit();
  const charted = chartedStars().length,
    colonies = W.colonies.filter((c) => c.status === "founded").length;
  if (!charted && !W.voyages.length) return html;
  return `${html}<div class="row between" style="margin-top:10px"><span class="subhead" style="margin:0">The stars</span></div><div class="legend-grid"><div class="legend-card" data-legend="stars:0"><b>The stars</b><small>${charted} charted · ${W.voyages.length} ship${W.voyages.length === 1 ? "" : "s"} · ${colonies} colon${colonies === 1 ? "y" : "ies"}</small></div></div>`;
};
const renderFactionPageOrbitBase = renderFactionPage;
renderFactionPage = function (id) {
  const html = renderFactionPageOrbitBase(id);
  ensureOrbit();
  const held = W.colonies.filter((c) => c.factionId === id && c.status === "founded");
  if (!held.length) return html;
  const row = `<div class="kv"><span>Worlds held</span><b>${held.map((c) => legendLink("colony", c.id, esc(c.name))).join(", ")}</b></div>`,
    at = html.indexOf('<div class="subhead">');
  return at < 0 ? html + row : html.slice(0, at) + row + html.slice(at);
};
window.ALIFE_ORBIT_DEBUG = Object.freeze({
  stars: () => {
    ensureOrbit();
    return W.stars.map((s) => ({ ...s }));
  },
  chart: (force = false) => chartStars(force),
  voyages: () => (W.voyages || []).map((v) => ({ ...v })),
  colonies: () => (W.colonies || []).map((c) => ({ ...c })),
  launch: (settlementId, force = true) =>
    launchShip(
      W.settlements.find((s) => s.id === settlementId),
      force,
    ),
  arrive: (voyageId) => {
    const v = (W.voyages || []).find((x) => x.id === voyageId);
    if (v && v.status === "under way") v.arriveTick = W.tick;
    return updateStarVoyages();
  },
  grow: () => growColonies(),
  shortfall: () => ({ orbital: orbitalShortfall(), interstellar: interstellarShortfall() }),
});
