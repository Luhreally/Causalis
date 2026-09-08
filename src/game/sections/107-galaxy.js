// ═══════════════════════════════════════════════════════════════════════════
// 107. THE GALAXY — systems with worlds, and colonies that grow, learn, trade, and go on
// ═══════════════════════════════════════════════════════════════════════════
// A star was one number for habitability and a colony was a population that
// grew toward a cap. Here the sky gains depth. Every charted star has a system
// of worlds, each with its own kind, habitability, riches, and hazards, laid
// out at a fixed bearing so the stars have places as well as distances. A
// colony lives on one of those worlds and does what a town does: it works out
// crafts of its own at a pace set by its people and its world, and a polity
// that knows Radio receives what its colonies find into its archives; a rich
// system sends shipments of coin home; a hazardous one takes its toll in hard
// years. A colony grown near its cap that knows Starflight settles the other
// habitable worlds of its system, and later sends ships of its own onward to
// the nearest stars, charting them as it goes, so the frontier moves outward
// from the colonies and not only from home. A colony grown great and far from
// home may declare itself free. The Stars page gains a chart of the galaxy
// with the home star at its centre, every charted star at its bearing, ships'
// courses, and colony marks, and each system lists its worlds. Rendering
// only reads.
const GALAXY_TICK = 232,
  GALAXY_NUMERALS = Object.freeze(["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"]),
  GALAXY_WORLD_KINDS = Object.freeze(["rocky world", "ocean world", "desert world", "ice world", "gas giant"]),
  GALAXY_DAUGHTER_SEED = 12,
  GALAXY_DAUGHTER_YEARS = 20,
  GALAXY_ONWARD_YEARS = 40,
  GALAXY_FREE_YEARS = 60,
  GALAXY_FREE_DISTANCE = 15,
  GALAXY_FREE_CHANCE = 0.05,
  GALAXY_SHIPMENT_MIN_PEOPLE = 50,
  GALAXY_RESEARCH_PEOPLE = 30,
  GALAXY_CLASS_HUES = Object.freeze({ M: "#e0654a", K: "#f0a24a", G: "#f4dc78", F: "#f7f3e4", A: "#bcd4ff" });
function ensureGalaxy(world = W) {
  if (!world) return;
  if (typeof ensureOrbit === "function") ensureOrbit(world);
  for (const star of world.stars || []) {
    if (star.angle == null) star.angle = +(makeRng(`${world.seed}:bearing:${star.id}`, "bearing").next() * Math.PI * 2).toFixed(4);
    if (!Array.isArray(star.worlds) || star.worlds.length !== star.planets) star.worlds = generateWorlds(world, star);
  }
  for (const c of world.colonies || []) {
    if (c.worldIndex == null) c.worldIndex = 0;
    if (c.research == null) c.research = 0;
    if (c.shipments == null) c.shipments = 0;
    if (c.discoveries == null) c.discoveries = 0;
    if (c.independent == null) c.independent = false;
  }
}
// The worlds of a system: the prime world is the one the star was read by; the
// rest range from garden to gas giant.
function generateWorlds(world, star) {
  const r = makeRng(`${world.seed}:worlds:${star.id}:${star.name}`, "worlds"),
    worlds = [];
  for (let i = 0; i < star.planets; i++) {
    const prime = i === 0,
      roll = r.next(),
      habitability = prime ? star.habitability : +clamp(star.habitability * (0.1 + roll * 0.8) + (r.next() - 0.5) * 0.1, 0.02, 0.92).toFixed(2),
      kind = prime ? (habitability >= 0.5 ? "ocean world" : "rocky world") : habitability < 0.12 && roll > 0.5 ? "gas giant" : GALAXY_WORLD_KINDS[Math.min(3, Math.floor((1 - habitability) * 4))];
    worlds.push({
      index: i,
      name: `${star.name} ${GALAXY_NUMERALS[i] || i + 1}`,
      kind,
      habitability,
      resources: +clamp(star.resources * (0.6 + r.next() * 0.8), 0.02, 1.5).toFixed(2),
      hazards: +clamp(star.hazards * (0.6 + r.next() * 0.8), 0.02, 1.5).toFixed(2),
    });
  }
  return worlds;
}
function starPosition(star) {
  return { x: star.distance * Math.cos(star.angle || 0), y: star.distance * Math.sin(star.angle || 0) };
}
function starsApart(a, b) {
  if (!a || !b) return Infinity;
  const p = starPosition(a),
    q = starPosition(b);
  return Math.sqrt((p.x - q.x) ** 2 + (p.y - q.y) ** 2);
}
function starOf(colony) {
  return (W.stars || []).find((s) => s.id === colony.starId) || null;
}
function worldOf(colony) {
  const star = starOf(colony);
  return star?.worlds?.[colony.worldIndex || 0] || null;
}
function colonyCap(colony) {
  return Math.round(60 + 340 * colony.habitability);
}
function colonyYears(colony) {
  return Math.floor((W.tick - (colony.foundedTick || 0)) / TICKS_PER_YEAR);
}
function colonyFaction(colony) {
  return colony.factionId ? W.factions.find((f) => f.id === colony.factionId) || null : null;
}
// ── Colonies work out crafts of their own ───────────────────────────────────
function colonyResearchTarget(colony) {
  const known = colony.knownProcesses || [];
  return techCatalog()
    .filter((t) => !known.includes(t.id) && typeof t.gate !== "function" && (t.prior || []).every((p) => known.includes(p)))
    .sort((a, b) => researchThreshold(a) - researchThreshold(b) || (a.id < b.id ? -1 : 1))[0] || null;
}
function colonyResearch(colony) {
  if (colony.status !== "founded" || colony.population < GALAXY_RESEARCH_PEOPLE) return null;
  const tech = colonyResearchTarget(colony);
  if (!tech) return null;
  colony.research += (colony.population / 40) * (0.5 + colony.habitability);
  const threshold = researchThreshold(tech) * 0.6;
  if (colony.research < threshold) return null;
  colony.research = 0;
  colony.knownProcesses.push(tech.id);
  colony.discoveries++;
  const faction = colonyFaction(colony),
    homeKnows = !!faction && W.settlements.some((s) => !s.ruined && s.factionId === faction.id && s.knownProcesses.includes(tech.id)),
    archives = faction && typeof factionArchives === "function" ? factionArchives(faction) : [],
    relayed = !!faction && !homeKnows && archives.length > 0 && factionHasTech(faction.id, "radio") && typeof recordProcesses === "function";
  if (relayed) recordProcesses(faction, [tech.id], archives[0]);
  emitEvent("ColonyDiscoveryEvent", {
    subjects: [],
    location: -1,
    factions: faction ? [faction.id] : [],
    causes: [],
    evidence: [
      `${colony.population} people on ${habitabilityWord(colony.habitability)} worked out ${tech.name}`,
      relayed ? `the finding was received by radio into the archive of ${archives[0].name}` : homeKnows ? "the home world already knew it" : "no radio carried the finding home",
    ],
    importance: 2,
    data: { colony: colony.name, tech: tech.name, relayed, polity: faction?.name || "" },
  });
  return tech.id;
}
// ── Shipments home and hard years ────────────────────────────────────────────
function colonyShipment(colony, year) {
  const star = starOf(colony),
    world = worldOf(colony),
    faction = colonyFaction(colony);
  if (!star || !faction || colony.population < GALAXY_SHIPMENT_MIN_PEOPLE) return 0;
  const riches = world?.resources ?? star.resources;
  if (riches < 0.5 || typeof polityCoins !== "function" || !polityCoins(faction)) return 0;
  const coin = Math.round(1 + riches * 4);
  faction.treasury = Math.round((faction.treasury + coin) * 10) / 10;
  colony.shipments += coin;
  if (year % 5 === 0)
    emitEvent("ShipmentEvent", {
      subjects: [],
      location: -1,
      factions: [faction.id],
      causes: [],
      evidence: [`${coin} coin of ore and rare matter this year`, `${colony.shipments} coin in all since the founding`],
      importance: 1,
      data: { colony: colony.name, polity: faction.name, coin, total: colony.shipments },
    });
  return coin;
}
function colonyHardship(colony, year, force = false) {
  const world = worldOf(colony),
    hazards = world?.hazards ?? starOf(colony)?.hazards ?? 0.5;
  if (!force && (hazards <= 0.5 || counterRand("colony-hardship", year, colony.id) >= (hazards - 0.4) * 0.12)) return null;
  const before = colony.population;
  colony.population = Math.max(4, Math.round(colony.population * 0.8));
  return emitEvent("ColonyHardshipEvent", {
    subjects: [],
    location: -1,
    factions: colony.factionId ? [colony.factionId] : [],
    causes: [],
    evidence: [`${before - colony.population} people lost to ${world ? world.kind : "the world"}'s hazards`, `${colony.population} remain`],
    importance: 2,
    data: { colony: colony.name, lost: before - colony.population, left: colony.population },
  });
}
// ── Daughter colonies and onward ships ───────────────────────────────────────
function freeWorldsOf(star) {
  const taken = new Set((W.colonies || []).filter((c) => c.starId === star.id && c.status !== "lost").map((c) => c.worldIndex || 0));
  return (star.worlds || []).filter((w) => !taken.has(w.index));
}
function foundDaughterColony(colony, force = false) {
  const star = starOf(colony);
  if (!star || colony.status !== "founded") return null;
  if (!force) {
    if (!colony.knownProcesses.includes("starflight") || colony.population < colonyCap(colony) * 0.7) return null;
    if (colonyYears(colony) < GALAXY_DAUGHTER_YEARS || W.tick - (colony.lastDaughterTick || -1e9) < TICKS_PER_YEAR * GALAXY_DAUGHTER_YEARS) return null;
  }
  const world = freeWorldsOf(star)
    .filter((w) => force || w.habitability >= 0.3)
    .sort((a, b) => b.habitability - a.habitability || a.index - b.index)[0];
  if (!world) return null;
  const daughter = {
    id: W.nextColonyId++,
    name: world.name,
    starId: star.id,
    starName: star.name,
    worldIndex: world.index,
    voyageId: 0,
    parentColonyId: colony.id,
    factionId: colony.factionId,
    factionName: colony.factionName,
    foundedTick: W.tick,
    population: GALAXY_DAUGHTER_SEED,
    peak: GALAXY_DAUGHTER_SEED,
    knownProcesses: colony.knownProcesses.slice(),
    habitability: world.habitability,
    status: "founded",
    lastYearTick: W.tick,
    research: 0,
    shipments: 0,
    discoveries: 0,
    independent: colony.independent,
  };
  W.colonies.push(daughter);
  colony.population = Math.max(4, colony.population - GALAXY_DAUGHTER_SEED);
  colony.lastDaughterTick = W.tick;
  emitEvent("DaughterColonyEvent", {
    subjects: [],
    location: -1,
    factions: colony.factionId ? [colony.factionId] : [],
    causes: [],
    evidence: [`${GALAXY_DAUGHTER_SEED} settlers crossed from ${colony.name}`, `${world.name} is ${world.kind}, ${habitabilityWord(world.habitability)}`],
    importance: 3,
    data: { colony: daughter.name, from: colony.name, star: star.name, kind: world.kind, habitability: habitabilityWord(world.habitability) },
  });
  return daughter;
}
function nearestOpenStar(from) {
  const taken = new Set((W.voyages || []).filter((v) => v.starId && v.status !== "lost").map((v) => v.starId));
  for (const c of W.colonies || []) if (c.status !== "lost") taken.add(c.starId);
  return (W.stars || [])
    .filter((s) => s.id !== from.id && !taken.has(s.id))
    .sort((a, b) => starsApart(from, a) - starsApart(from, b) || a.id - b.id)[0] || null;
}
function chartFromColony(colony, star) {
  if (star.chartedTick) return null;
  star.chartedTick = W.tick;
  star.chartedBy = colony.name;
  return emitEvent("StarChartedEvent", {
    subjects: [],
    location: -1,
    factions: colony.factionId ? [colony.factionId] : [],
    causes: [],
    evidence: [`${star.name} lies ${starsApart(starOf(colony), star).toFixed(1)} light-years from ${colony.name}`, `its prime world reads as ${habitabilityWord(star.habitability)}`],
    importance: 2,
    data: { star: star.name, distance: +starsApart(starOf(colony), star).toFixed(1), habitability: habitabilityWord(star.habitability), town: colony.name, first: false },
  });
}
function launchOnward(colony, force = false) {
  const star = starOf(colony);
  if (!star || colony.status !== "founded") return null;
  if (!force) {
    if (!colony.knownProcesses.includes("starflight") || colony.population < colonyCap(colony) * 0.8) return null;
    if (colonyYears(colony) < GALAXY_ONWARD_YEARS || W.tick - (colony.lastShipTick || -1e9) < TICKS_PER_YEAR * GALAXY_ONWARD_YEARS) return null;
  }
  const target = nearestOpenStar(star);
  if (!target) return null;
  chartFromColony(colony, target);
  const distance = starsApart(star, target),
    voyage = {
      id: W.nextVoyageId++,
      ascensionId: 0,
      name: `${colony.name} ${(W.voyages || []).filter((v) => v.fromColonyId === colony.id).length + 1}`,
      fromSettlementId: 0,
      fromColonyId: colony.id,
      fromName: colony.name,
      factionId: colony.factionId || 0,
      factionName: colony.factionName || "",
      crew: [],
      crafts: colony.knownProcesses.slice(),
      starId: target.id,
      starName: target.name,
      departTick: W.tick,
      arriveTick: W.tick + Math.round(distance * ORBIT_TICKS_PER_LIGHTYEAR),
      status: "under way",
    };
  W.voyages.push(voyage);
  colony.population = Math.max(4, colony.population - GALAXY_DAUGHTER_SEED);
  colony.lastShipTick = W.tick;
  emitEvent("OnwardVoyageEvent", {
    subjects: [],
    location: -1,
    factions: colony.factionId ? [colony.factionId] : [],
    causes: [],
    evidence: [`${voyage.name} left ${colony.name} for ${target.name}`, `${distance.toFixed(1)} light-years and ${Math.round((voyage.arriveTick - W.tick) / TICKS_PER_YEAR)} years away`],
    importance: 3,
    data: { ship: voyage.name, from: colony.name, star: target.name, years: Math.round((voyage.arriveTick - W.tick) / TICKS_PER_YEAR) },
  });
  return voyage;
}
// A colony founded by a colony's ship takes its world's name, not "New New".
const foundColonyGalaxyBase = foundColony;
foundColony = function (voyage) {
  const ev = foundColonyGalaxyBase(voyage);
  if (!ev || !voyage?.fromColonyId) return ev;
  const colony = (W.colonies || []).find((c) => c.id === voyage.colonyId);
  if (!colony) return ev;
  ensureGalaxy();
  const world = worldOf(colony);
  if (world) {
    colony.name = world.name;
    colony.parentColonyId = voyage.fromColonyId;
    ev.data.colony = colony.name;
  }
  return ev;
};
// ── Independence ─────────────────────────────────────────────────────────────
function declareColonyIndependence(colony, year, force = false) {
  if (!colony.factionId || colony.status !== "founded") return null;
  const star = starOf(colony);
  if (!force) {
    if (colony.population < colonyCap(colony) * 0.9 || colonyYears(colony) < GALAXY_FREE_YEARS) return null;
    if (!star || star.distance < GALAXY_FREE_DISTANCE) return null;
    if (counterRand("colony-free", year, colony.id) >= GALAXY_FREE_CHANCE) return null;
  }
  const former = colonyFaction(colony);
  colony.formerFactionName = former?.name || colony.factionName || "";
  colony.formerFactionId = colony.factionId;
  colony.factionId = 0;
  colony.factionName = "";
  colony.independent = true;
  return emitEvent("ColonyIndependenceEvent", {
    subjects: [],
    location: -1,
    factions: former ? [former.id] : [],
    causes: [],
    evidence: [`${colony.population} people under ${colony.starName}, ${star ? star.distance : "many"} light-years from home`, `${colonyYears(colony)} years after the founding`],
    importance: 4,
    data: { colony: colony.name, polity: colony.formerFactionName, population: colony.population },
  });
}
// ── The yearly pass ───────────────────────────────────────────────────────────
function updateGalaxy() {
  ensureGalaxy();
  const year = Math.floor(W.tick / TICKS_PER_YEAR),
    report = { learned: 0, coin: 0, hardships: 0, daughters: 0, ships: 0, freed: 0 };
  for (const colony of (W.colonies || []).slice()) {
    if (colony.status !== "founded") continue;
    if (colonyResearch(colony)) report.learned++;
    report.coin += colonyShipment(colony, year);
    if (colonyHardship(colony, year)) report.hardships++;
    if (foundDaughterColony(colony)) report.daughters++;
    if (launchOnward(colony)) report.ships++;
    if (declareColonyIndependence(colony, year)) report.freed++;
  }
  return report;
}
const simTickGalaxyBase = simTick;
simTick = function () {
  simTickGalaxyBase();
  if (W?.colonies?.length && W.tick % 256 === GALAXY_TICK) updateGalaxy();
};
const restoreWorldGalaxyBase = restoreWorldDefaults;
restoreWorldDefaults = function () {
  restoreWorldGalaxyBase();
  if (W) ensureGalaxy(W);
};
// ── Chronicle ─────────────────────────────────────────────────────────────────
const eventSentenceGalaxyBase = eventSentence;
eventSentence = function (e) {
  const d = e.data || {};
  if (e.type === "ColonyDiscoveryEvent") return `${d.colony} worked out ${d.tech}${d.relayed ? ", and the finding was received at home by radio" : ""}.`;
  if (e.type === "ShipmentEvent") return `${d.colony} sent ${d.coin} coin of ore and rare matter home to ${d.polity}.`;
  if (e.type === "ColonyHardshipEvent") return `A hard year on ${d.colony} took ${d.lost} people; ${d.left} remain.`;
  if (e.type === "DaughterColonyEvent") return `Settlers from ${d.from} founded ${d.colony}, ${d.habitability} in the same system.`;
  if (e.type === "OnwardVoyageEvent") return `${d.ship} left ${d.from} for ${d.star}, ${d.years} years away.`;
  if (e.type === "ColonyIndependenceEvent") return `${d.colony} declared itself free of ${d.polity} with ${d.population} people.`;
  return eventSentenceGalaxyBase(e);
};
const alertWorthyGalaxyBase = alertWorthy;
alertWorthy = function (a) {
  return alertWorthyGalaxyBase(a) || a.type === "DaughterColonyEvent" || a.type === "OnwardVoyageEvent" || a.type === "ColonyIndependenceEvent";
};
// ── The chart of the galaxy and the systems' worlds ──────────────────────────
function galaxyChart() {
  ensureGalaxy();
  const charted = (W.stars || []).filter((s) => s.chartedTick > 0),
    size = 320,
    half = size / 2,
    reach = Math.max(10, ...charted.map((s) => s.distance)) * 1.12,
    scale = (half - 14) / reach,
    px = (star) => {
      const p = starPosition(star);
      return { x: +(half + p.x * scale).toFixed(1), y: +(half + p.y * scale).toFixed(1) };
    },
    rings = [10, 20, 30, 40]
      .filter((r) => r < reach)
      .map((r) => `<circle cx="${half}" cy="${half}" r="${(r * scale).toFixed(1)}" fill="none" stroke="#2a3350" stroke-width="1"/><text x="${half + 3}" y="${(half - r * scale - 2).toFixed(1)}" fill="#4a5578" font-size="8">${r} ly</text>`)
      .join(""),
    home = W.stars ? { x: half, y: half } : null,
    colonies = (W.colonies || []).filter((c) => c.status !== "lost"),
    courses = (W.voyages || [])
      .filter((v) => v.starId && v.status !== "lost")
      .map((v) => {
        const to = charted.find((s) => s.id === v.starId);
        if (!to) return "";
        const fromColony = v.fromColonyId ? colonies.find((c) => c.id === v.fromColonyId) : null,
          fromStar = fromColony ? charted.find((s) => s.id === fromColony.starId) : null,
          a = fromStar ? px(fromStar) : home,
          b = px(to);
        return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${v.status === "arrived" ? "#6f8fd8" : "#9fb4ff"}" stroke-width="1" stroke-dasharray="${v.status === "arrived" ? "none" : "3 3"}" opacity="0.8"/>`;
      })
      .join(""),
    dots = charted
      .map((s) => {
        const p = px(s),
          held = colonies.filter((c) => c.starId === s.id),
          free = held.some((c) => c.independent),
          r = (2 + s.planets * 0.35).toFixed(1);
        return `${held.length ? `<circle cx="${p.x}" cy="${p.y}" r="${(+r + 4).toFixed(1)}" fill="none" stroke="${free ? "#f0c86a" : "#7fe0a8"}" stroke-width="1.5"/>` : ""}<circle cx="${p.x}" cy="${p.y}" r="${r}" fill="${GALAXY_CLASS_HUES[s.starClass] || "#ddd"}"/><text x="${p.x + 6}" y="${p.y + 3}" fill="#c8d0ea" font-size="9">${esc(s.name)}</text>`;
      })
      .join("");
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" style="display:block;max-width:100%;margin:6px auto;background:#0b1020;border-radius:8px" aria-label="the charted galaxy"><rect width="${size}" height="${size}" fill="#0b1020"/>${rings}${courses}<circle cx="${half}" cy="${half}" r="3.5" fill="#f4dc78" stroke="#fff6c8" stroke-width="1"/><text x="${half + 6}" y="${half + 3}" fill="#f4dc78" font-size="9">home</text>${dots}</svg><div class="muted" style="text-align:center;margin-bottom:6px">Charted stars at their bearings and distances · dashed courses are ships under way · a green ring holds a colony, a gold ring a free world</div>`;
}
function systemRows() {
  ensureGalaxy();
  const charted = (W.stars || []).filter((s) => s.chartedTick > 0);
  if (!charted.length) return "";
  return `<div class="subhead">Systems</div>${charted
    .map((s) => {
      const worlds = (s.worlds || [])
        .map((w) => {
          const colony = (W.colonies || []).find((c) => c.starId === s.id && (c.worldIndex || 0) === w.index && c.status !== "lost");
          return `<div class="kv"><span>${esc(w.name)} <span class="muted">${esc(w.kind)}</span></span><b>${esc(habitabilityWord(w.habitability))} · riches ${Math.round(w.resources * 100)}%${colony ? ` · ${legendLink("colony", colony.id, esc(colony.name))}${colony.independent ? " (free)" : ""}` : ""}</b></div>`;
        })
        .join("");
      return `<div class="muted" style="margin-top:6px">${esc(s.name)} · ${s.planets} world${s.planets === 1 ? "" : "s"} · charted by ${esc(s.chartedBy || "the sky-watchers")}</div>${worlds}`;
    })
    .join("")}`;
}
const renderStarsPageGalaxyBase = renderStarsPage;
renderStarsPage = function () {
  const html = renderStarsPageGalaxyBase(),
    chart = galaxyChart(),
    at = html.indexOf('<div class="muted"');
  return (at < 0 ? html + chart : html.slice(0, at) + chart + html.slice(at)) + systemRows();
};
const renderColonyPageGalaxyBase = renderColonyPage;
renderColonyPage = function (id) {
  const html = renderColonyPageGalaxyBase(id),
    c = (W.colonies || []).find((x) => x.id === id);
  if (!c) return html;
  ensureGalaxy();
  const world = worldOf(c),
    target = colonyResearchTarget(c),
    parent = c.parentColonyId ? W.colonies.find((x) => x.id === c.parentColonyId) : null,
    rows = [
      `<div class="kv"><span>World</span><b>${esc(world?.name || c.starName)}${world ? ` · ${esc(world.kind)} · riches ${Math.round(world.resources * 100)}% · hazards ${Math.round(world.hazards * 100)}%` : ""}</b></div>`,
      `<div class="kv"><span>Crafts</span><b>${c.knownProcesses.length} known · ${c.discoveries || 0} worked out here${target ? ` · at work on ${esc(target.name)} (${Math.min(99, Math.round(((c.research || 0) / Math.max(1, researchThreshold(target) * 0.6)) * 100))}%)` : ""}</b></div>`,
      c.shipments ? `<div class="kv"><span>Shipments home</span><b>${c.shipments} coin</b></div>` : "",
      parent ? `<div class="kv"><span>Settled from</span><b>${legendLink("colony", parent.id, esc(parent.name))}</b></div>` : "",
      c.independent ? `<div class="kv"><span>Standing</span><b>a free world${c.formerFactionName ? `, once of ${esc(c.formerFactionName)}` : ""}</b></div>` : "",
    ].join(""),
    at = html.indexOf('<div class="kv">');
  return at < 0 ? html + rows : html.slice(0, at) + rows + html.slice(at);
};
window.ALIFE_GALAXY_DEBUG = Object.freeze({
  ensure: () => ensureGalaxy(),
  worlds: (starId) => {
    ensureGalaxy();
    return ((W.stars || []).find((s) => s.id === starId)?.worlds || []).map((w) => ({ ...w }));
  },
  positions: () => {
    ensureGalaxy();
    return (W.stars || []).map((s) => ({ id: s.id, name: s.name, angle: s.angle, ...starPosition(s) }));
  },
  apart: (a, b) => starsApart((W.stars || []).find((s) => s.id === a), (W.stars || []).find((s) => s.id === b)),
  tick: () => updateGalaxy(),
  research: (colonyId) => colonyResearch((W.colonies || []).find((c) => c.id === colonyId)),
  target: (colonyId) => colonyResearchTarget((W.colonies || []).find((c) => c.id === colonyId))?.id || null,
  shipment: (colonyId) => colonyShipment((W.colonies || []).find((c) => c.id === colonyId), Math.floor(W.tick / TICKS_PER_YEAR)),
  hardship: (colonyId, force = true) => colonyHardship((W.colonies || []).find((c) => c.id === colonyId), Math.floor(W.tick / TICKS_PER_YEAR), force),
  daughter: (colonyId, force = false) => foundDaughterColony((W.colonies || []).find((c) => c.id === colonyId), force),
  onward: (colonyId, force = false) => launchOnward((W.colonies || []).find((c) => c.id === colonyId), force),
  independence: (colonyId, force = false) => declareColonyIndependence((W.colonies || []).find((c) => c.id === colonyId), Math.floor(W.tick / TICKS_PER_YEAR), force),
  cap: (colonyId) => colonyCap((W.colonies || []).find((c) => c.id === colonyId)),
  chart: () => galaxyChart(),
});
