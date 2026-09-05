// ═══════════════════════════════════════════════════════════════════════════
// 50. BELIEF: HOW EACH CULTURE COMES TO KNOW ITS GOD
// ═══════════════════════════════════════════════════════════════════════════
// The player is the god of this world, and omens already told each settlement
// what it made of a single act. Belief turns those readings into a culture's
// standing picture of the power that moves its world: a running favour, the
// attention and awe the acts have earned, a name in the culture's own tongue
// with an epithet drawn from the acts most often seen, tenets, rites held at
// shrines on the solstices with offerings of real stored matter, a Speaker who
// prophesies plenty or fire and is remembered when the prophecy comes true,
// myths that retell what happened and drift with every retelling, and schisms
// when two towns of one people read the god in opposite ways. Belief is
// authoritative state on each culture; rendering only reads it.
const BELIEF_EPITHETS = Object.freeze({
  rain: ["Rain-Giver", "Storm-Bringer"],
  heal: ["the Mender", "the Mender"],
  bless: ["the Bountiful", "the Bountiful"],
  plants: ["the Green Hand", "the Green Hand"],
  water: ["the Wellspring", "the Flood"],
  resources: ["the Giver of Stone", "the Giver of Stone"],
  ignite: ["the Hearth-Fire", "the Burning One"],
  lightning: ["the Sky-Spark", "the Sky-Spark"],
  drought: ["the Withholder", "the Withholder"],
  blight: ["the Withering", "the Withering"],
  disease: ["the Fever", "the Fever"],
  erase: ["the Unmaker", "the Unmaker"],
  disaster: ["the Breaker", "the Breaker"],
  raise: ["the Shaper", "the Shaper"],
  lower: ["the Shaper", "the Shaper"],
  claim: ["the Border-Maker", "the Border-Maker"],
  herbivore: ["the Seeder of Beasts", "the Seeder of Beasts"],
  predator: ["the Seeder of Beasts", "the Loosener of Fangs"],
  person: ["the Kin-Maker", "the Kin-Maker"],
});
const BELIEF_TENETS = Object.freeze({
  rain: [
    "Water is holy; rain is answered with offerings.",
    "Storms are a judgement; the roof is mended before the harvest.",
  ],
  heal: ["The sick are tended in the god's name.", "The sick are tended in the god's name."],
  bless: [
    "Plenty is lent, not owned; a share is given back.",
    "Plenty is lent, not owned; a share is given back.",
  ],
  plants: ["No green thing is cut without thanks.", "No green thing is cut without thanks."],
  water: [
    "Wells are kept clean and no one is refused water.",
    "The flood is remembered; homes are set on high ground.",
  ],
  resources: [
    "Stone taken from the ground is taken with a word of thanks.",
    "Stone taken from the ground is taken with a word of thanks.",
  ],
  ignite: [
    "Hearths are kept small and never left alone.",
    "Fire is the god's anger; hearths are kept small and never left alone.",
  ],
  lightning: [
    "The tallest roof carries a charm against the sky.",
    "The tallest roof carries a charm against the sky.",
  ],
  drought: ["Water is stored against the withholding.", "Water is stored against the withholding."],
  blight: [
    "A withered field is left fallow a full year.",
    "A withered field is left fallow a full year.",
  ],
  disease: [
    "The fevered are set apart and fed by the whole town.",
    "The fevered are set apart and fed by the whole town.",
  ],
  erase: [
    "The unmade are named each solstice so they are not lost twice.",
    "The unmade are named each solstice so they are not lost twice.",
  ],
  disaster: [
    "The broken ground is not built on for a generation.",
    "The broken ground is not built on for a generation.",
  ],
  claim: [
    "Borders are marked with stones and walked each year.",
    "Borders are marked with stones and walked each year.",
  ],
});
const TOOL_NOUNS = Object.freeze({
  rain: "rain",
  bless: "a blessing",
  heal: "healing",
  plants: "green growth",
  water: "water",
  resources: "riches",
  ignite: "fire",
  lightning: "lightning",
  drought: "drought",
  blight: "blight",
  disease: "sickness",
  erase: "unmaking",
  disaster: "ruin",
  raise: "the shaping of the land",
  lower: "the shaping of the land",
  claim: "a claim on the land",
  herbivore: "new beasts",
  predator: "new hunters",
  person: "new kin",
});
function toolNoun(tool) {
  return (
    TOOL_NOUNS[tool] ||
    String(tool || "a change")
      .replace(/event$/i, "")
      .toLowerCase()
  );
}
function ensureBeliefs(world = W) {
  if (!world) return;
  for (const c of world.cultures || []) if (!c.belief) c.belief = freshBelief();
  world.living = world.living || {};
  if (world.living.lastBeliefEventId == null) world.living.lastBeliefEventId = 0;
}
function freshBelief() {
  return {
    version: 1,
    favour: 0,
    attention: 0,
    awe: 0,
    named: false,
    name: "",
    gloss: "",
    tenets: [],
    myths: [],
    rites: 0,
    lastRiteTick: -1,
    prophetId: 0,
    prophecy: null,
    schisms: 0,
    readings: { favour: 0, wrath: 0, portent: 0 },
    tools: {},
  };
}
const restoreWorldBeliefBase = restoreWorldDefaults;
restoreWorldDefaults = function () {
  restoreWorldBeliefBase();
  ensureBeliefs(W);
};
function cultureFactions(culture) {
  return W.factions.filter((f) => f.cultureId === culture.id);
}
function cultureSettlements(culture) {
  return W.settlements.filter((s) => !s.ruined && s.cultureId === culture.id);
}
function cultureSpirituality(culture) {
  const factions = cultureFactions(culture);
  return factions.length ? mean(factions.map((f) => f.ethos.spiritual)) : 0.4;
}
function beliefLean(b) {
  return b.favour >= 3 ? "favour" : b.favour <= -3 ? "wrath" : "portent";
}
function dominantTool(b) {
  let best = "",
    count = 0;
  for (const [tool, n] of Object.entries(b.tools))
    if (n > count || (n === count && tool < best)) ((best = tool), (count = n));
  return best;
}
function godTitle(culture) {
  const b = culture?.belief;
  if (!b?.named) return "";
  return b.gloss ? `${b.name}, ${b.gloss}` : b.name;
}
// ── Readings ───────────────────────────────────────────────────────────────────
function witnessReading(culture, tool, favour, event) {
  ensureBeliefs();
  const b = culture.belief,
    spiritual = cultureSpirituality(culture);
  b.tools[tool] = (b.tools[tool] || 0) + 1;
  b.attention++;
  b.favour = clamp(b.favour + favour * (0.6 + spiritual), -12, 12);
  b.readings[favour > 0 ? "favour" : favour < 0 ? "wrath" : "portent"]++;
  if (!b.named && b.attention >= 3) nameTheGod(culture, event);
  if (b.named && b.attention % 4 === 0) deriveTenets(culture);
  if (b.named && spiritual > 0.45 && Math.abs(favour) > 0) recordMyth(culture, event, favour);
  if (b.named && !b.prophetId && b.attention >= 6 && spiritual > 0.5) raiseProphet(culture, event);
}
function nameTheGod(culture, cause) {
  const b = culture.belief,
    lang = languageOf(culture),
    r = makeRng(hashParts(W.seedHash, "god-name", culture.id), "god"),
    tool = dominantTool(b),
    lean = beliefLean(b),
    epithets = BELIEF_EPITHETS[tool] || ["the Unseen Hand", "the Unseen Hand"];
  b.name = lang.legacy
    ? ["Aurel", "Thessa", "Morwen", "Kaelis", "Ondir", "Vesk"][r.int(6)]
    : titleWord(langWord(lang, r, 2));
  b.gloss = lean === "wrath" ? epithets[1] : epithets[0];
  b.named = true;
  const settlement = cultureSettlements(culture)[0];
  emitEvent("NamingEvent", {
    subjects: [culture.entityId, ...(settlement ? [settlement.entityId] : [])],
    location: settlement ? idx(settlement.x, settlement.y) : (cause?.location ?? -1),
    factions: cultureFactions(culture).map((f) => f.id),
    causes: cause ? [cause.id] : [],
    evidence: [
      `${b.attention} acts witnessed`,
      `read as ${lean}`,
      `the most seen act: ${tool || "none"}`,
    ],
    importance: 4,
    data: { culture: culture.name, name: b.name, gloss: b.gloss, lean },
  });
  deriveTenets(culture);
}
function deriveTenets(culture) {
  const b = culture.belief,
    lean = beliefLean(b),
    ranked = Object.entries(b.tools)
      .sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1))
      .slice(0, 3),
    tenets = [];
  for (const [tool] of ranked) {
    const pair = BELIEF_TENETS[tool];
    if (pair) tenets.push(lean === "wrath" ? pair[1] : pair[0]);
  }
  if (b.awe > 3)
    tenets.push("When the ground itself moves, the town gathers at the shrine and waits.");
  b.tenets = tenets.slice(0, 3);
}
// ── Myths ──────────────────────────────────────────────────────────────────────
function mythTelling(culture, event, favour) {
  const b = culture.belief,
    god = godTitle(culture) || "a power without a name",
    place = event.location >= 0 ? locationName(event.location) : "the land",
    tool = toolNoun(event.data?.tool || event.type),
    act =
      favour > 0
        ? `${god} sent ${tool} upon ${place}, and the people knew favour`
        : favour < 0
          ? `${god} turned ${tool} upon ${place}, and the people knew wrath`
          : `${god} passed over ${place} with ${tool}, and the people wondered`;
  return `In the year ${event.year}, ${act}.`;
}
function recordMyth(culture, event, favour) {
  const b = culture.belief;
  if (!event || b.myths.some((m) => m.eventId === event.id)) return;
  b.myths.push({
    id: b.myths.length + 1,
    tick: W.tick,
    eventId: event.id,
    truth: eventSentence(event),
    told: mythTelling(culture, event, favour),
    retellings: 0,
    favour,
  });
  if (b.myths.length > 12) b.myths.shift();
}
const MYTH_DRIFTS = Object.freeze([
  [/ sent ([a-z]+) upon /, " sent a flood of $1 upon "],
  [/ turned ([a-z]+) upon /, " turned a great $1 upon "],
  [/the people knew favour/, "a hundred were fed and none went hungry"],
  [/the people knew wrath/, "half the town was lost and the rest went on their knees"],
  [/the people wondered/, "the elders read it as a warning to the young"],
  [/In the year (\d+),/, "In the years of the grandmothers,"],
  [/a flood of/, "an ocean of"],
  [/a great/, "a terrible"],
]);
// Every retelling changes a detail; the truth stays pinned to the event.
function retellMyths(culture) {
  const b = culture.belief;
  for (const m of b.myths) {
    const roll = counterRand("myth-drift", Math.floor(W.tick / 1024), culture.id, m.id);
    if (roll > 0.45) continue;
    const drift =
        MYTH_DRIFTS[
          Math.floor(
            counterRand("myth-choice", Math.floor(W.tick / 1024), culture.id, m.id) *
              MYTH_DRIFTS.length,
          )
        ],
      told = m.told.replace(drift[0], drift[1]);
    if (told !== m.told) {
      m.told = told;
      m.retellings++;
    }
  }
}
// ── Prophets ───────────────────────────────────────────────────────────────────
function raiseProphet(culture, cause) {
  const b = culture.belief,
    settlements = cultureSettlements(culture),
    voices = new Set(W.factions.map((f) => f.leaderId).filter(Boolean)),
    candidates = [];
  for (const s of settlements)
    for (const id of entityAtRadius(idx(s.x, s.y), 8, KINDS.PERSON))
      if (classifyAlive(id) && !voices.has(id) && W.components.social[id]?.cultureId === culture.id)
        candidates.push(id);
  if (!candidates.length) return;
  candidates.sort(
    (x, y) =>
      (W.components.social[y]?.dominance || 0) - (W.components.social[x]?.dominance || 0) || x - y,
  );
  const prophet = candidates[0],
    lean = beliefLean(b),
    foretold =
      lean === "wrath"
        ? "fire and broken ground"
        : lean === "favour"
          ? "years of plenty"
          : "a sign none will mistake",
    home = settlements[0];
  b.prophetId = prophet;
  b.prophecy = { tick: W.tick, lean, foretold, fulfilledEventId: 0 };
  W.components.identity[prophet].titles.push(`Speaker of ${b.name}`);
  W.components.identity[prophet].significance += 6;
  emitEvent("ProphecyEvent", {
    subjects: [prophet, culture.entityId],
    location: home ? idx(home.x, home.y) : -1,
    factions: cultureFactions(culture).map((f) => f.id),
    causes: cause ? [cause.id] : [],
    evidence: [`${b.attention} acts witnessed`, `read as ${lean}`],
    importance: 3,
    data: { culture: culture.name, god: godTitle(culture), foretold, lean },
  });
}
function checkProphecies() {
  for (const c of W.cultures) {
    const b = c.belief,
      p = b?.prophecy;
    if (!p || p.fulfilledEventId || W.tick - p.tick > TICKS_PER_YEAR * 8) continue;
    const settlements = cultureSettlements(c);
    if (!settlements.length) continue;
    const match = (W.annals || []).slice(-60).find((a) => {
      if (a.tick <= p.tick) return false;
      const near =
        a.location >= 0 && settlements.some((s) => dist2(...xy(a.location), s.x, s.y) <= 196);
      if (p.lean === "wrath")
        return (
          near &&
          ["EruptionEvent", "EarthquakeEvent", "MeteorEvent", "FireDisasterEvent"].includes(a.type)
        );
      if (p.lean === "favour") return a.type === "CropHarvestedEvent" && near;
      return near && a.importance >= 4;
    });
    if (!match) continue;
    p.fulfilledEventId = match.id;
    const prophet = b.prophetId;
    if (prophet && W.components.identity[prophet])
      W.components.identity[prophet].significance += 10;
    b.favour = clamp(b.favour + (p.lean === "wrath" ? -2 : 2), -12, 12);
    emitEvent("ProphecyFulfilledEvent", {
      subjects: [prophet, c.entityId].filter(Boolean),
      location: match.location,
      factions: cultureFactions(c).map((f) => f.id),
      causes: [match.id],
      evidence: [`foretold ${p.foretold}`],
      importance: 4,
      data: { culture: c.name, god: godTitle(c), foretold: p.foretold },
    });
  }
}
// ── Rites and offerings ────────────────────────────────────────────────────────
function holdRites(force = false) {
  for (const c of W.cultures) {
    const b = c.belief;
    if (!b?.named) continue;
    const spiritual = cultureSpirituality(c);
    for (const s of cultureSettlements(c)) {
      const shrine = completedBuildings(s, "shrine")[0];
      if (!shrine && !force) continue;
      if (!force && W.tick - (b.lastRiteTick || -1) < 64) continue;
      const tile = shrine ? idx(shrine.x, shrine.y) : idx(s.x, s.y),
        offering = resolveTransfer({
          fromType: "settlement",
          from: s.id,
          toType: "tile",
          to: tile,
          amounts: [
            [C.ORGANIC, 4],
            [C.PIGMENT, 1],
          ],
        });
      s.stability = clamp(s.stability + 0.02 * (0.5 + spiritual), 0, 1);
      for (const f of cultureFactions(c))
        f.cohesion = clamp(f.cohesion + 0.01 * spiritual, 0.12, 1);
      b.rites++;
      b.lastRiteTick = W.tick;
      emitEvent("RiteEvent", {
        subjects: [s.entityId, c.entityId],
        location: tile,
        factions: s.factionId ? [s.factionId] : [],
        causes: [W.lastEventByType.SeasonEvent].filter(Boolean),
        evidence: [
          shrine ? "a shrine stood" : "the town gathered in the open",
          `${offering || 0} units offered`,
        ],
        importance: b.attention >= 6 ? 3 : 2,
        data: { culture: c.name, god: godTitle(c), name: s.name, offering: offering || 0 },
      });
    }
  }
}
// ── Schism ─────────────────────────────────────────────────────────────────────
function schism(culture, settlement, cause = 0) {
  ensureLanguages();
  const parentLang = languageOf(culture),
    id = W.cultures.length + 1,
    lang = deriveLanguage(W, parentLang, `schism-${id}`),
    r = makeRng(hashParts(W.seedHash, "schism", id), "schism"),
    entityId = allocEntity("culture"),
    fresh = freshBelief(),
    child = {
      id,
      entityId,
      name: cultureName(lang, r),
      values: {
        ...culture.values,
        communal: clamp(culture.values.communal + (r.next() - 0.5) * 0.3, 0, 1),
      },
      drift: 0,
      originSettlementId: settlement.id,
      parentCultureId: culture.id,
      language: lang,
      belief: fresh,
    };
  // The breakaway keeps the god's name but reads the acts the other way.
  fresh.named = culture.belief.named;
  fresh.name = culture.belief.name;
  fresh.gloss = culture.belief.gloss;
  fresh.favour = -Math.sign(culture.belief.favour) * Math.min(4, Math.abs(culture.belief.favour));
  fresh.attention = Math.round(culture.belief.attention / 2);
  fresh.tools = { ...culture.belief.tools };
  fresh.tenets = culture.belief.tenets.slice(0, 1);
  W.cultures.push(child);
  W.components.position[entityId] = {
    x: settlement.x,
    y: settlement.y,
    layer: 0,
    regionId: regionId(settlement.x, settlement.y),
  };
  W.components.identity[entityId] = {
    generatedName: child.name,
    significance: 3,
    notable: false,
    titles: ["Culture"],
  };
  settlement.cultureId = id;
  settlement.omenFavour = 0;
  for (const pid of entityAtRadius(idx(settlement.x, settlement.y), 8, KINDS.PERSON))
    if (W.components.social[pid]?.cultureId === culture.id) W.components.social[pid].cultureId = id;
  culture.belief.schisms = (culture.belief.schisms || 0) + 1;
  deriveTenets(child);
  emitEvent("SchismEvent", {
    subjects: [child.entityId, culture.entityId, settlement.entityId],
    location: idx(settlement.x, settlement.y),
    factions: settlement.factionId ? [settlement.factionId] : [],
    causes: [cause].filter(Boolean),
    evidence: ["two towns read the same god in opposite ways", `the breakaway speaks ${lang.name}`],
    importance: 4,
    data: {
      culture: culture.name,
      child: child.name,
      name: settlement.name,
      god: godTitle(culture),
    },
  });
  return child;
}
function checkSchisms() {
  for (const c of W.cultures.slice()) {
    const b = c.belief;
    if (!b?.named || cultureSpirituality(c) < 0.5) continue;
    const towns = cultureSettlements(c);
    if (towns.length < 2) continue;
    const lean = Math.sign(b.favour);
    if (!lean) continue;
    const dissenter = towns.find(
      (s) => Math.sign(s.omenFavour || 0) === -lean && Math.abs(s.omenFavour || 0) >= 3,
    );
    if (dissenter) schism(c, dissenter, W.lastEventByType.OmenEvent || 0);
  }
}
// ── The belief update ──────────────────────────────────────────────────────────
function updateBelief() {
  ensureBeliefs();
  const since = W.living.lastBeliefEventId || 0,
    fresh = [];
  for (let n = W.events.length - 1; n >= 0; n--) {
    const e = W.events[n];
    if (e.id <= since) break;
    if (
      e.type === "OmenEvent" ||
      e.type === "EruptionEvent" ||
      e.type === "EarthquakeEvent" ||
      e.type === "MeteorEvent"
    )
      fresh.push(e);
  }
  if (W.events.length) W.living.lastBeliefEventId = W.events[W.events.length - 1].id;
  fresh.reverse();
  for (const e of fresh) {
    if (e.type === "OmenEvent") {
      const f = W.factions.find((x) => x.id === e.factions?.[0]),
        culture = f ? W.cultures.find((c) => c.id === f.cultureId) : null;
      if (culture) witnessReading(culture, e.data?.tool || "unknown", e.data?.favour || 0, e);
      continue;
    }
    // Calamities near a people's towns are read as wrath by the fearful and as portents by the rest.
    if (!(e.location >= 0)) continue;
    const [ex, ey] = xy(e.location);
    for (const c of W.cultures) {
      if (!cultureSettlements(c).some((s) => dist2(s.x, s.y, ex, ey) <= 196)) continue;
      ensureBeliefs();
      c.belief.awe += e.magnitude || 1;
      witnessReading(c, "disaster", c.belief.favour < 0 ? -1 : 0, e);
    }
  }
  // Belief steadies or unsettles the towns that hold it.
  for (const c of W.cultures) {
    const b = c.belief;
    if (!b?.named) continue;
    const lean = beliefLean(b);
    if (lean === "portent") continue;
    for (const s of cultureSettlements(c))
      s.stability = clamp(s.stability + (lean === "favour" ? 0.002 : -0.002), 0, 1);
  }
  checkProphecies();
}
const updateWeatherCycleBeliefBase = updateWeatherCycle;
updateWeatherCycle = function () {
  updateWeatherCycleBeliefBase();
  if (W.tick % 128 === 100) updateBelief();
  if (W.tick % 1024 === 600) {
    ensureBeliefs();
    for (const c of W.cultures) retellMyths(c);
    checkSchisms();
  }
};
// Rites follow the solstices the seasons already chronicle.
const updateSeasonsBeliefBase = updateSeasons;
updateSeasons = function () {
  const before = W.lastEventByType.SeasonEvent || 0;
  updateSeasonsBeliefBase();
  if ((W.lastEventByType.SeasonEvent || 0) !== before) {
    ensureBeliefs();
    holdRites();
  }
};
// ── Chronicle sentences ────────────────────────────────────────────────────────
const eventSentenceBeliefBase = eventSentence;
eventSentence = function (e) {
  switch (e.type) {
    case "NamingEvent":
      return `${e.data.culture} named the power that moves their world: ${e.data.name}, ${e.data.gloss}, whom they read as ${e.data.lean === "portent" ? "a mystery" : e.data.lean}.`;
    case "ProphecyEvent":
      return `${entityName(e.subjects?.[0] || 0)} rose as Speaker of ${e.data.god || "the god"} among ${e.data.culture} and foretold ${e.data.foretold}.`;
    case "ProphecyFulfilledEvent":
      return `What the Speaker foretold came to pass: ${e.data.foretold} fell upon ${e.data.culture}.`;
    case "RiteEvent":
      return `${e.data.name} held rites to ${e.data.god || "the unnamed"} and offered ${e.data.offering} units of stored matter.`;
    case "SchismEvent":
      return `${e.data.name} broke from ${e.data.culture} over the meaning of ${e.data.god || "the god"} and became ${e.data.child}.`;
    case "OmenEvent": {
      const f = W.factions.find((x) => x.id === e.factions?.[0]),
        culture = f ? W.cultures.find((c) => c.id === f.cultureId) : null,
        god = culture ? godTitle(culture) : "";
      if (god)
        return `${e.data.name} read ${toolNoun(e.data.tool)} as ${e.data.reading} from ${god}.`;
      return eventSentenceBeliefBase(e);
    }
    default:
      return eventSentenceBeliefBase(e);
  }
};
// ── Legends and map mode ───────────────────────────────────────────────────────
function cultureBeliefExtras(c) {
  const b = c.belief;
  if (!b || (!b.attention && !b.named))
    return `<div class="subhead">Faith</div><div class="empty">This people has seen nothing it could call a god.</div>`;
  const lean = beliefLean(b),
    prophet = b.prophetId ? lifeLink(b.prophetId) : "";
  return `<div class="subhead">Faith</div><div class="kv"><span>The god</span><b>${b.named ? esc(godTitle(c)) : "unnamed, though watched"}</b><span>Reading</span><b>${lean === "favour" ? "favour" : lean === "wrath" ? "wrath" : "portents"} · ${b.readings.favour} kind, ${b.readings.wrath} harsh, ${b.readings.portent} strange</b><span>Attention</span><b>${b.attention} acts witnessed${b.awe ? ` · awe ${b.awe.toFixed(1)}` : ""}</b>${
    b.tenets.length ? `<span>Tenets</span><b>${b.tenets.map(esc).join(" ")}</b>` : ""
  }${prophet ? `<span>Speaker</span><b>${prophet}${b.prophecy ? ` · foretold ${esc(b.prophecy.foretold)}${b.prophecy.fulfilledEventId ? " (fulfilled)" : ""}` : ""}</b>` : ""}<span>Rites</span><b>${b.rites}</b>${
    b.schisms ? `<span>Schisms</span><b>${b.schisms}</b>` : ""
  }${
    c.parentCultureId
      ? `<span>Broke from</span><b>${(() => {
          const p = W.cultures.find((x) => x.id === c.parentCultureId);
          return p ? legendLink("culture", p.id, p.name) : "a lost people";
        })()}</b>`
      : ""
  }</div>${
    b.myths.length
      ? `<div class="subhead">Myths</div>${b.myths
          .slice()
          .reverse()
          .map(
            (m) =>
              `<div class="legend-row" data-legend="event:${m.eventId}"><span class="legend-year">${m.retellings ? `${m.retellings}×` : "new"}</span><span><i>${esc(m.told)}</i><br><small class="muted">What happened: ${esc(m.truth)}</small></span></div>`,
          )
          .join("")}`
      : ""
  }`;
}
const cultureLegendExtrasBeliefBase = cultureLegendExtras;
cultureLegendExtras = function (c) {
  return cultureLegendExtrasBeliefBase(c) + cultureBeliefExtras(c);
};
const renderLegendIndexBeliefBase = renderLegendIndex;
renderLegendIndex = function (query = "") {
  const q = query.trim().toLowerCase(),
    believers = W.cultures.filter(
      (c) =>
        c.belief?.named &&
        (!q || c.name.toLowerCase().includes(q) || godTitle(c).toLowerCase().includes(q)),
    );
  return (
    renderLegendIndexBeliefBase(query) +
    `<div class="row between" style="margin-top:10px"><span class="subhead" style="margin:0">Beliefs</span><span class="muted">${believers.length}</span></div>${
      believers.length
        ? `<div class="legend-grid">${believers
            .map(
              (c) =>
                `<div class="legend-card" data-legend="culture:${c.id}"><b>${esc(godTitle(c))}</b><small>as ${esc(c.name)} know the god · read as ${beliefLean(c.belief)} · ${c.belief.myths.length} myths</small></div>`,
            )
            .join("")}</div>`
        : `<div class="empty">No people has yet named the power that moves its world.</div>`
    }`
  );
};
const overlayStyleBeliefBase = overlayStyle;
overlayStyle = function (name, i) {
  if (name !== "belief") return overlayStyleBeliefBase(name, i);
  const cultureId = W.tiles.cultureOwner[i];
  if (!cultureId) return "transparent";
  const c = W.cultures.find((x) => x.id === cultureId),
    b = c?.belief;
  if (!b?.named) return c ? hsl(0, 0, 60, 0.12) : "transparent";
  const lean = beliefLean(b),
    strength = clamp(Math.abs(b.favour) / 12, 0.15, 1);
  return hsl(lean === "favour" ? 120 : lean === "wrath" ? 5 : 270, 70, 55, 0.15 + strength * 0.45);
};
const overlayValueBeliefBase = overlayValue;
overlayValue = function (name, i) {
  if (name !== "belief") return overlayValueBeliefBase(name, i);
  const c = W.cultures.find((x) => x.id === W.tiles.cultureOwner[i]);
  return c?.belief?.named ? 50 + (c.belief.favour / 12) * 50 : 0;
};
const overlayLegendColorBeliefBase = overlayLegendColor;
overlayLegendColor = function (id) {
  return id === "belief" ? "#9fd88f" : overlayLegendColorBeliefBase(id);
};
const setOverlayBeliefBase = setOverlay;
setOverlay = function (name) {
  setOverlayBeliefBase(name);
  if (UI.overlay === "belief" && DOM.mapOverlay)
    DOM.mapOverlay.textContent =
      "Belief · green where the god is read as favour, red as wrath, violet as portents";
};
window.ALIFE_BELIEF_DEBUG = Object.freeze({
  update: () => {
    updateBelief();
    return W.cultures.map((c) => ({ id: c.id, name: c.name, god: godTitle(c), belief: c.belief }));
  },
  rites: (force = true) => {
    ensureBeliefs();
    const before = W.events.length;
    holdRites(force);
    return W.events.slice(before).filter((e) => e.type === "RiteEvent").length;
  },
  prophet: (cultureId) => {
    ensureBeliefs();
    const c = W.cultures.find((x) => x.id === cultureId);
    if (!c) return null;
    if (!c.belief.named) nameTheGod(c, null);
    raiseProphet(c, null);
    return c.belief.prophetId;
  },
  schism: (cultureId, settlementId) => {
    const c = W.cultures.find((x) => x.id === cultureId),
      s = W.settlements.find((x) => x.id === settlementId);
    if (!c || !s) return null;
    ensureBeliefs();
    if (!c.belief.named) nameTheGod(c, null);
    return schism(c, s)?.id || null;
  },
  retell: (cultureId) => {
    const c = W.cultures.find((x) => x.id === cultureId);
    if (!c?.belief) return null;
    for (const m of c.belief.myths) {
      const drift = MYTH_DRIFTS.find(([from]) => from.test(m.told));
      if (drift) {
        m.told = m.told.replace(drift[0], drift[1]);
        m.retellings++;
      }
    }
    return c.belief.myths.map((m) => ({ told: m.told, truth: m.truth, retellings: m.retellings }));
  },
});
