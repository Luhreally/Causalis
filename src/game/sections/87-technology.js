// ═══════════════════════════════════════════════════════════════════════════
// 87. THE LONG TREE — technology past the age of engines, and what it changes
// ═══════════════════════════════════════════════════════════════════════════
// The tree of crafts ran from fire to metal to letters to engines, then leapt
// to stewardship and the stars with nothing between: no wheel, no coin, no
// printing press, no electricity, no radio. Here sixteen crafts fill the long
// middle and late tree, each with priors, materials, and a facility as the
// existing ones have, and each with a real hand on the world: mathematics,
// printing, and computing quicken inquiry; engines and electricity quicken the
// work face; sanitation and germ theory thin the pathogens a town meets;
// printing puts every craft a polity knows on record for all its towns;
// coinage widens barter; radio keeps distant polities in contact; satellites
// chart the sky in a season. The wheel, roads, rails, and engines carry people
// and goods in section 88. The ladder of ages gains Electricity and
// Information rungs before Stewardship, old archives are re-tiered on load, a
// ledger of milestones marks the firsts that are not crafts (the hundredth
// person, the first town of fifty, the first polity of five towns), and a
// Legends page lays the whole tree out era by era. Rendering only reads.
const TECH_ERAS = Object.freeze([
  {
    key: "stone",
    name: "The first crafts",
    techs: ["controlled_fire", "drying", "tools", "storage", "agriculture", "ceramics", "fortification", "navigation"],
  },
  { key: "metal", name: "Metal and medicine", techs: ["metalworking", "medicine", "irrigation", "masonry", "wheel"] },
  {
    key: "letters",
    name: "Letters and law",
    techs: ["writing", "governance", "logistics", "mathematics", "currency", "road_building", "public_works", "sanitation", "optics", "printing", "astronomy"],
  },
  {
    key: "engines",
    name: "Engines and chemistry",
    techs: ["waterworks", "mechanization", "chemistry", "germ_theory", "railways", "combustion"],
  },
  { key: "electricity", name: "Electricity and the wire", techs: ["electricity", "radio"] },
  { key: "information", name: "Information", techs: ["computing", "fusion", "ecological_engineering"] },
  { key: "beyond", name: "Stewardship and the stars", techs: ["planetary_stewardship", "starflight", "satellites"] },
]);
const TECH_EXTENDED_DEFS = Object.freeze([
  { id: "wheel", name: "The Wheel", materials: [C.FIBER, C.MINERAL], prior: ["tools", "ceramics"], threshold: 40, facility: "workshop", process: "a turned axle bearing a load" },
  { id: "road_building", name: "Paved Roads", materials: [C.MINERAL, C.FIBER], prior: ["masonry", "logistics"], threshold: 50, facility: "hall", process: "a graded bed of stone between towns" },
  { id: "currency", name: "Coinage", materials: [C.METAL, C.PIGMENT], prior: ["metalworking", "writing"], threshold: 52, facility: "forge", process: "struck metal standing for any good" },
  { id: "mathematics", name: "Mathematics", materials: [C.INFO, C.PIGMENT], prior: ["writing"], threshold: 48, facility: "archive", process: "number and proof kept on the page" },
  { id: "printing", name: "Printing", materials: [C.INFO, C.METAL], prior: ["writing", "metalworking"], threshold: 58, facility: "archive", process: "movable type pressing a page in moments" },
  { id: "optics", name: "Lenses", materials: [C.CRYSTAL, C.MINERAL], prior: ["ceramics", "mathematics"], threshold: 56, facility: "workshop", process: "ground crystal bending light to a point" },
  { id: "chemistry", name: "Industrial Chemistry", materials: [C.CATALYST, C.SOLVENT], prior: ["metalworking", "medicine"], threshold: 64, facility: "forge", process: "reactions run at scale for yield" },
  { id: "germ_theory", name: "Germ Theory", materials: [C.CATALYST, C.ORGANIC], prior: ["medicine", "optics"], threshold: 62, facility: "clinic", process: "the living cause of infection seen and named" },
  { id: "electricity", name: "Electricity", materials: [C.METAL, C.CATALYST], prior: ["mechanization", "chemistry"], threshold: 70, facility: "forge", process: "current drawn along a wire to do work" },
  { id: "combustion", name: "Combustion Engines", materials: [C.METAL, C.FUEL], prior: ["mechanization", "chemistry"], threshold: 68, facility: "forge", process: "fuel burned inside a cylinder to drive a wheel" },
  { id: "railways", name: "Railways", materials: [C.METAL, C.FUEL], prior: ["mechanization", "road_building"], threshold: 66, facility: "forge", process: "iron rails carrying an engine and its train" },
  { id: "radio", name: "Radio", materials: [C.METAL, C.CRYSTAL], prior: ["electricity", "mathematics"], threshold: 66, facility: "archive", process: "a voice carried over the horizon without wire" },
  { id: "computing", name: "Computing", materials: [C.CRYSTAL, C.METAL], prior: ["electricity", "mathematics", "printing"], threshold: 78, facility: "archive", process: "reckoning done by a machine faster than thought" },
  { id: "satellites", name: "Satellites", materials: [C.METAL, C.FUEL], prior: ["starflight", "radio"], threshold: 82, facility: "observatory", process: "an eye set in orbit above the weather" },
  { id: "fusion", name: "Fusion Power", materials: [C.CATALYST, C.METAL], prior: ["computing", "chemistry"], threshold: 88, facility: "forge", process: "light nuclei joined for their binding energy" },
  { id: "ecological_engineering", name: "Ecological Engineering", materials: [C.CATALYST, C.INFO], prior: ["planetary_stewardship", "chemistry"], threshold: 76, facility: "hall", process: "a biosphere tended as a whole" },
]);
for (const def of TECH_EXTENDED_DEFS)
  if (!TECH_EXTENSIONS.some((t) => t.id === def.id)) TECH_EXTENSIONS.push(def);
function knowsTech(place, id) {
  return !!place?.knownProcesses?.includes(id);
}
function homeSettlementOf(id) {
  const soc = W.components.social?.[id];
  if (!soc || soc.homePlaceKind !== "settlement" || !soc.homePlaceId) return null;
  return W.settlements.find((s) => s.id === soc.homePlaceId && !s.ruined) || null;
}
// ── What the crafts change ────────────────────────────────────────────────────
// Inquiry: number, lenses, the press, and the machine each quicken it (read by 30a).
function researchTempoFactor(place) {
  let f = 1;
  if (knowsTech(place, "mathematics")) f *= 1.2;
  if (knowsTech(place, "optics")) f *= 1.1;
  if (knowsTech(place, "printing")) f *= 1.15;
  if (knowsTech(place, "computing")) f *= 1.5;
  return Math.min(2.4, f);
}
// The work face: engines, current, and fusion heat quicken it (read by 30a).
function constructionTempoFactor(place) {
  let f = 1;
  if (knowsTech(place, "mechanization")) f *= 1.25;
  if (knowsTech(place, "electricity")) f *= 1.25;
  if (knowsTech(place, "fusion")) f *= 1.2;
  return Math.min(2, f);
}
// Pathogens met at home: sanitation and germ theory thin them (read by 22).
function hygieneFactor(id) {
  const home = homeSettlementOf(id);
  if (!home) return 1;
  let f = 1;
  if (knowsTech(home, "sanitation")) f *= 0.6;
  if (knowsTech(home, "germ_theory")) f *= 0.5;
  return f;
}
// Printing puts every craft a polity knows on the record for all its towns.
const processRecordedTreeBase = processRecorded;
processRecorded = function (place, techId) {
  if (processRecordedTreeBase(place, techId)) return true;
  if (!place?.factionId) return false;
  const towns = W.settlements.filter((s) => !s.ruined && s.factionId === place.factionId);
  return towns.some((s) => knowsTech(s, "printing")) && towns.some((s) => knowsTech(s, techId));
};
// Coinage widens barter: a coin stands for the goods a caravan cannot carry twice.
const bestBarterTreeBase = bestBarter;
bestBarter = function (a, b) {
  const offer = bestBarterTreeBase(a, b);
  if (!offer) return offer;
  if (factionHasTech(a.factionId, "currency") && factionHasTech(b.factionId, "currency")) {
    offer.amountA = Math.round(offer.amountA * 1.5);
    offer.amountB = Math.round(offer.amountB * 1.5);
    offer.coined = true;
  }
  return offer;
};
// Radio keeps polities in contact across any distance once both have towns.
const factionsHaveContactTreeBase = factionsHaveContact;
factionsHaveContact = function (a, b) {
  if (factionsHaveContactTreeBase(a, b)) return true;
  if (!(factionHasTech(a.id, "radio") || factionHasTech(b.id, "radio"))) return false;
  return (
    W.settlements.some((s) => !s.ruined && s.factionId === a.id) &&
    W.settlements.some((s) => !s.ruined && s.factionId === b.id)
  );
};
// Satellites chart the whole sky within the year.
const chartStarsTreeBase = chartStars;
chartStars = function (force = false) {
  let ev = chartStarsTreeBase(force);
  if (!ev || !W.settlements.some((s) => !s.ruined && knowsTech(s, "satellites"))) return ev;
  for (let guard = 0; guard < 12; guard++) {
    const more = chartStarsTreeBase(true);
    if (!more) break;
    ev = more;
  }
  return ev;
};
// ── The ladder of ages, with Electricity and Information rungs ───────────────
const AGES_LADDER = Object.freeze([
  { tier: 0, gloss: "Stone", techs: [] },
  { tier: 1, gloss: "Hearths", techs: ["controlled_fire"] },
  { tier: 2, gloss: "Metal", techs: ["metalworking"] },
  { tier: 3, gloss: "Letters", techs: ["writing", "governance"] },
  { tier: 4, gloss: "Engines", techs: ["mechanization", "waterworks"] },
  { tier: 5, gloss: "Electricity", techs: ["electricity"] },
  { tier: 6, gloss: "Information", techs: ["computing", "radio"] },
  { tier: 7, gloss: "Stewardship", techs: ["planetary_stewardship"] },
  { tier: 8, gloss: "Stars", techs: [] },
]);
techTierOf = function (place) {
  let tier = 0;
  for (const age of AGES_LADDER)
    if (age.techs.some((t) => place.knownProcesses.includes(t))) tier = Math.max(tier, age.tier);
  return tier;
};
reachedTier = function () {
  let tier = 0,
    leader = null;
  for (const s of W.settlements) {
    if (s.ruined || !s.knownProcesses) continue;
    const t = techTierOf(s);
    if (t > tier) {
      tier = t;
      leader = s;
    }
  }
  if (W.ascensions?.length) {
    tier = AGES_LADDER.length - 1;
    leader = W.settlements.find((s) => s.id === W.ascensions[0].settlementId) || leader;
  }
  return { tier, leader };
};
updateAges = function (silent = false) {
  ensureEras();
  const { tier, leader } = reachedTier(),
    current = currentAge();
  if (tier <= current.tier) return null;
  let last = null;
  for (let t = current.tier + 1; t <= tier; t++) {
    const def = AGES_LADDER[t],
      f = leader ? W.factions.find((x) => x.id === leader.factionId) : null,
      age = {
        tier: t,
        gloss: def.gloss,
        name: ageName(t),
        tick: W.tick,
        eventId: 0,
        place: leader?.name || "",
        factionId: f?.id || 0,
      };
    W.ages.push(age);
    if (!silent) {
      const ev = emitEvent("AgeEvent", {
        subjects: leader ? [leader.entityId] : [],
        location: leader ? idx(leader.x, leader.y) : -1,
        factions: f ? [f.id] : [],
        causes: [W.lastEventByType.AscensionEvent, W.lastEventByType.TechAdvanceEvent].filter(
          Boolean,
        ),
        evidence:
          def.gloss === "Stars"
            ? ["a ship left the world"]
            : [
                `${def.techs.map((x) => technologyDefinition(x)?.name || x).join(" or ")} was known`,
              ],
        importance: 5,
        data: {
          tier: t,
          gloss: def.gloss,
          name: age.name,
          place: leader?.name || "",
          polity: f?.name || "",
          year: formatYear(),
        },
      });
      age.eventId = ev.id;
    }
    last = age;
  }
  return last;
};
// Archives written with the seven-rung ladder are re-tiered by their gloss.
function retierAges(world = W) {
  if (!world?.ages) return 0;
  let changed = 0;
  for (const age of world.ages) {
    const t = AGES_LADDER.findIndex((a) => a.gloss === age.gloss);
    if (t >= 0 && age.tier !== t) {
      age.tier = t;
      changed++;
    }
  }
  return changed;
}
// ── Milestones: the firsts that are not crafts ───────────────────────────────
function ensureMilestones(world = W) {
  if (!world) return null;
  world.milestones = world.milestones || [];
  return world.milestones;
}
const restoreWorldDefaultsTreeBase = restoreWorldDefaults;
restoreWorldDefaults = function () {
  restoreWorldDefaultsTreeBase();
  ensureMilestones(W);
  retierAges(W);
};
function recordMilestone(key, label, place = null, extra = {}) {
  const ledger = ensureMilestones(W);
  if (ledger.some((m) => m.key === key)) return null;
  const faction = place?.factionId ? W.factions.find((f) => f.id === place.factionId) : null,
    ev = emitEvent("MilestoneEvent", {
      subjects: place?.entityId ? [place.entityId] : [],
      location: place ? idx(place.x, place.y) : -1,
      factions: faction ? [faction.id] : [],
      causes: [W.lastEventByType.TechAdvanceEvent, W.lastEventByType.StageAdvanceEvent].filter(
        Boolean,
      ),
      evidence: [extra.evidence || "a first the annals keep"],
      importance: 4,
      data: {
        key,
        label,
        place: place?.name || "",
        polity: faction?.name || "",
        year: formatYear(),
        ...(extra.data || {}),
      },
    });
  ledger.push({
    key,
    label,
    tick: W.tick,
    eventId: ev.id,
    place: place?.name || "",
    factionId: faction?.id || 0,
  });
  return ev;
}
const MILESTONE_PEOPLE = Object.freeze([100, 250, 500, 1000]);
function checkMilestones() {
  if (W.tick % 128 !== 100) return;
  const people = biospherePopulation(KINDS.PERSON);
  for (const n of MILESTONE_PEOPLE)
    if (people >= n)
      recordMilestone(`people-${n}`, `The world held ${n} people`, null, {
        evidence: `${people} people alive`,
      });
  const towns = W.settlements.filter((s) => !s.ruined);
  for (const s of towns) {
    const pop = settlementPopulation(s);
    if (pop >= 50)
      recordMilestone("town-50", `${s.name} became the first town of fifty`, s, {
        evidence: `${pop} residents`,
      });
    if (pop >= 100)
      recordMilestone("town-100", `${s.name} became the first city of a hundred`, s, {
        evidence: `${pop} residents`,
      });
  }
  for (const f of W.factions) {
    if (!(f.stability > 0)) continue;
    const held = towns.filter((s) => s.factionId === f.id);
    if (held.length >= 5)
      recordMilestone("polity-5", `${f.name} became the first polity of five towns`, held[0], {
        evidence: `${held.length} towns under one Voice`,
      });
    if (held.length >= 10)
      recordMilestone("polity-10", `${f.name} became the first polity of ten towns`, held[0], {
        evidence: `${held.length} towns under one Voice`,
      });
  }
  for (const era of TECH_ERAS) {
    if (era.key === "stone") continue;
    const first = towns.find((s) => era.techs.some((t) => knowsTech(s, t)));
    if (first)
      recordMilestone(`era-${era.key}`, `${first.name} opened the era of ${era.name.toLowerCase()}`, first, {
        evidence: era.techs
          .filter((t) => knowsTech(first, t))
          .map((t) => technologyDefinition(t)?.name || t)
          .join(", "),
      });
  }
}
const updateWeatherCycleTreeBase = updateWeatherCycle;
updateWeatherCycle = function () {
  updateWeatherCycleTreeBase();
  if (W?.settlements) checkMilestones();
};
// ── Chronicle, alerts, and the Technology page ───────────────────────────────
const eventSentenceTreeBase = eventSentence;
eventSentence = function (e) {
  if (e.type === "MilestoneEvent") return `${e.data?.label || "A milestone was passed"}.`;
  return eventSentenceTreeBase(e);
};
const alertWorthyTreeBase = alertWorthy;
alertWorthy = function (a) {
  return alertWorthyTreeBase(a) || a.type === "MilestoneEvent";
};
function techKnownCount(id) {
  return W.settlements.filter((s) => !s.ruined && knowsTech(s, id)).length;
}
function techFirstRecord(id) {
  return (W.technologies || []).find((t) => t.definitionId === id) || null;
}
function renderTechnologyPage() {
  const catalog = techCatalog(),
    known = catalog.filter((t) => techKnownCount(t.id) > 0).length,
    towns = W.settlements.filter((s) => !s.ruined && s.knownProcesses),
    lead = towns.slice().sort((a, b) => b.knownProcesses.length - a.knownProcesses.length)[0],
    sections = TECH_ERAS.map((era) => {
      const rows = era.techs
        .map((id) => technologyDefinition(id))
        .filter(Boolean)
        .map((t) => {
          const n = techKnownCount(t.id),
            first = techFirstRecord(t.id),
            place = first ? W.settlements.find((s) => s.id === first.settlementId) : null,
            researching = towns.filter((s) => s.researchFocus === t.id).length,
            status = n
              ? `${n} town${n === 1 ? "" : "s"}${
                  first
                    ? ` · year ${formatYear(first.tick)}${
                        place ? ` · ${legendLink("place", place.id, esc(place.name))}` : ""
                      }`
                    : ""
                }`
              : `<span class="muted">—</span>`,
            note = n
              ? ""
              : ` <span class="muted">${
                  researching
                    ? `${researching} town${researching === 1 ? "" : "s"} at work`
                    : "not yet"
                }</span>`;
          return `<div class="kv"><span>${esc(t.name)}${note}</span><b>${status}</b></div>`;
        })
        .join("");
      return rows ? `<div class="subhead">${esc(era.name)}</div>${rows}` : "";
    }).join(""),
    focusTech = lead?.researchFocus ? technologyDefinition(lead.researchFocus) : null,
    focus = focusTech
      ? (() => {
          const progress = lead.researchProgress?.[lead.researchFocus] || 0,
            threshold =
              typeof researchThreshold === "function"
                ? researchThreshold(focusTech)
                : focusTech.threshold || 24;
          return `<p>${legendLink("place", lead.id, esc(lead.name))} is working out <b>${esc(
            focusTech.name,
          )}</b> (${Math.min(99, Math.round((progress / Math.max(1, threshold)) * 100))}%).</p>`;
        })()
      : "",
    milestones = (W.milestones || [])
      .slice(-12)
      .reverse()
      .map(
        (m) => `<div class="kv"><span>${esc(m.label)}</span><b>year ${formatYear(m.tick)}</b></div>`,
      )
      .join("");
  return `${legendHero("The tree of knowledge", [
    `${known} of ${catalog.length} crafts`,
    ageLabel(currentAge()),
  ])}${focus}${sections}${milestones ? `<div class="subhead">Milestones</div>${milestones}` : ""}`;
}
const renderLegendPageTreeBase = renderLegendPage;
renderLegendPage = function (kind = UI.legend.kind, id = UI.legend.id) {
  if (W && kind === "technology") return renderTechnologyPage();
  return renderLegendPageTreeBase(kind, id);
};
const renderLegendIndexTreeBase = renderLegendIndex;
renderLegendIndex = function (query = "") {
  const html = renderLegendIndexTreeBase(query);
  if (!W?.settlements?.some((s) => !s.ruined)) return html;
  const catalog = techCatalog(),
    known = catalog.filter((t) => techKnownCount(t.id) > 0).length,
    count = (W.milestones || []).length,
    card = `<div class="row between" style="margin-top:10px"><span class="subhead" style="margin:0">The tree of knowledge</span></div><div class="legend-grid"><div class="legend-card" data-legend="technology:0"><b>Technology</b><small>${known} of ${
      catalog.length
    } crafts · ${esc(ageLabel(currentAge()))}${
      count ? ` · ${count} milestone${count === 1 ? "" : "s"}` : ""
    }</small></div></div>`;
  return html + card;
};
window.ALIFE_TECH_DEBUG = Object.freeze({
  catalog: () => techCatalog().map((t) => t.id),
  eras: () => TECH_ERAS.map((e) => ({ key: e.key, techs: e.techs.slice() })),
  ladder: () => AGES_LADDER.map((a) => a.gloss),
  tier: (settlementId) => techTierOf(W.settlements.find((s) => s.id === settlementId)),
  research: (settlementId) => researchTempoFactor(W.settlements.find((s) => s.id === settlementId)),
  construction: (settlementId) =>
    constructionTempoFactor(W.settlements.find((s) => s.id === settlementId)),
  hygiene: (id) => hygieneFactor(id),
  recorded: (settlementId, techId) =>
    processRecorded(W.settlements.find((s) => s.id === settlementId), techId),
  retier: () => retierAges(W),
  milestone: (key, label, settlementId = 0) =>
    recordMilestone(key, label, W.settlements.find((s) => s.id === settlementId) || null),
  milestones: () => (W.milestones || []).map((m) => ({ ...m })),
  check: () => {
    const t = W.tick;
    W.tick = t - (t % 128) + 100;
    checkMilestones();
    W.tick = t;
  },
  page: () => renderTechnologyPage(),
});
