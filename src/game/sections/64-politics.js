// ═══════════════════════════════════════════════════════════════════════════
// 64. POLITICS — unrest, rebellion, secession, coups, and civil war
// ═══════════════════════════════════════════════════════════════════════════
// Polities could only collapse. Now every town carries an unrest reading built
// from hunger, low stability, inequality, tribute and vassalage, feuds among
// its houses, distance from the capital, and grievance against the Voice,
// eased by a recent feast. Unrest that stays high for two years finds a
// leader: a restless town secedes as a free polity under its own Voice and a
// war of independence follows; two or more restless towns leave together in a
// civil war; a restless capital gives a proud claimant the chance to seize the
// Voice, deposing the old one into exile or worse. Pacing is historic: one
// upheaval per polity every six years at most, and one in the world every two.
const UNREST_THRESHOLD = 0.62,
  UPHEAVAL_COOLDOWN = TICKS_PER_YEAR * 6,
  WORLD_UPHEAVAL_GAP = TICKS_PER_YEAR * 2;
function ensurePolitics(world = W) {
  if (!world) return;
  world.politics = world.politics || { lastUpheavalTick: -99999, upheavals: 0 };
}
const restoreWorldPoliticsBase = restoreWorldDefaults;
restoreWorldDefaults = function () {
  restoreWorldPoliticsBase();
  ensurePolitics(W);
};
function polityOf(place) {
  return place?.factionId ? W.factions.find((f) => f.id === place.factionId) || null : null;
}
function unrestOf(place) {
  const residents = townResidents(place);
  if (!residents.length) return 0;
  const f = polityOf(place),
    capital = f ? W.settlements.find((s) => s.id === f.capitalSettlementId && !s.ruined) : null,
    isCapital = !!capital && capital.id === place.id,
    hungry =
      residents.filter((id) => (W.components.life[id]?.hunger || 0) > 60).length / residents.length,
    tribute = W.diplomacy?.treaties.some(
      (t) => t.active && t.kind === "tribute" && t.a === place.factionId,
    )
      ? 0.12
      : 0,
    vassal = f?.overlordId ? 0.08 : 0,
    houses = new Set(residents.map((id) => W.components.social[id]?.kinGroupId)),
    feuding = (W.feuds || []).filter(
      (fd) => !fd.ended && (houses.has(fd.a) || houses.has(fd.b)),
    ).length,
    far =
      isCapital || !capital
        ? 0
        : Math.sqrt(dist2(place.x, place.y, capital.x, capital.y)) > 20
          ? 0.1
          : 0.04,
    eased = W.tick - (place.lastFeastTick || -9999) < 512 ? -0.08 : 0;
  let grievance = 0;
  if (f?.leaderId) {
    let n = 0;
    for (const id of residents) {
      const rel = W.components.social[id]?.relationships?.[f.leaderId];
      if (rel) {
        grievance += rel.grievance || 0;
        n++;
      }
    }
    grievance = n ? grievance / n : 0;
  }
  return +clamp(
    (1 - (place.stability || 0)) * 0.4 +
      hungry * 0.3 +
      (place.inequality || 0) * 0.2 +
      tribute +
      vassal +
      Math.min(0.15, feuding * 0.08) +
      far +
      grievance * 0.2 +
      eased,
    0,
    1,
  ).toFixed(3);
}
function updateUnrest() {
  for (const s of W.settlements) {
    if (s.ruined) continue;
    const before = s.unrest || 0;
    s.unrest = unrestOf(s);
    s.unrestHigh = s.unrest > UNREST_THRESHOLD ? (s.unrestHigh || 0) + 1 : 0;
    if (s.unrestHigh === 1 && before <= UNREST_THRESHOLD) {
      const hungry = townResidents(s).filter(
          (id) => (W.components.life[id]?.hunger || 0) > 60,
        ).length,
        causes = [];
      if (s.stability < 0.4) causes.push("a town losing faith in itself");
      if (hungry) causes.push(`${countNoun(hungry, "hungry mouth")}`);
      if ((s.inequality || 0) > 0.4) causes.push("riches held by a few");
      if (
        W.diplomacy?.treaties.some((t) => t.active && t.kind === "tribute" && t.a === s.factionId)
      )
        causes.push("tribute owed abroad");
      emitEvent("UnrestEvent", {
        subjects: [s.entityId],
        location: idx(s.x, s.y),
        factions: s.factionId ? [s.factionId] : [],
        causes: [W.causalIndex.tile[idx(s.x, s.y)] || 0].filter(Boolean),
        evidence: causes.length ? causes : ["grievances no one could name"],
        importance: 3,
        data: { place: s.name, unrest: s.unrest, causes: causes.slice(0, 2) },
      });
    }
  }
}
// ── Leaders of the discontented ────────────────────────────────────────────────
function rebelLeader(place, f) {
  let best = 0,
    score = -1;
  for (const id of townResidents(place)) {
    if (id === f?.leaderId || !(typeof isAdultPerson !== "function" || isAdultPerson(id))) continue;
    const soc = W.components.social[id],
      ident = W.components.identity[id],
      grievance = f?.leaderId ? soc.relationships?.[f.leaderId]?.grievance || 0 : 0,
      s =
        (soc.dominance || 0) * 2 +
        (ident?.traits?.includes("proud") ? 1 : 0) +
        (ident?.traits?.includes("bold") ? 0.6 : 0) +
        (ident?.significance || 0) / 10 +
        grievance * 2 +
        (ident?.standing === "poor" ? 0.4 : 0);
    if (s > score || (s === score && id < best)) {
      score = s;
      best = id;
    }
  }
  return best;
}
function driftedEthos(ethos, r) {
  const out = {};
  for (const [k, v] of Object.entries(ethos || {}))
    out[k] = clamp(v + (r.next() - 0.5) * 0.2, 0, 1);
  return out;
}
function moveResidents(place, fromFaction, toFaction) {
  let moved = 0;
  for (const pid of entityAtRadius(idx(place.x, place.y), 8, KINDS.PERSON)) {
    const soc = W.components.social[pid];
    if (!classifyAlive(pid) || !soc || soc.factionId !== fromFaction.id) continue;
    soc.factionId = toFaction.id;
    removeRelation(pid, fromFaction.entityId, "member_of");
    addRelation(pid, toFaction.entityId, "member_of", 1);
    moved++;
  }
  return moved;
}
// A town becomes a polity of its own, keeping its people's culture.
function foundPolityFrom(place, leaderId, parent, causeEvent = 0) {
  if (!place || !parent || activeFactionCount() >= CAPS.faction) return null;
  const culture = W.cultures.find((c) => c.id === (place.cultureId || parent.cultureId));
  if (!culture) return null;
  ensureLanguages();
  const r = makeRng(hashParts(W.seedHash, "secession", place.id, W.tick), "faction"),
    name = polityName(languageOf(culture), r),
    id = takeFactionId(),
    entityId = allocEntity("faction"),
    f = {
      id,
      entityId,
      name,
      color: `hsl(${r.int(360)} 62% 58%)`,
      population: 0,
      settlementIds: [place.id],
      capitalSettlementId: place.id,
      ethos: driftedEthos(parent.ethos, r),
      cohesion: 0.55,
      aggression: clamp((parent.aggression || 0.4) + 0.1, 0.1, 0.95),
      expansionPressure: 0.4,
      technologyLevel: 0,
      militaryStrength: 0,
      warPressure: 0,
      stability: 0.55,
      territorySize: 0,
      allies: [],
      rivals: [parent.id],
      grievances: 0,
      relations: {},
      cultureId: culture.id,
      claims: [],
      vassalIds: [],
      overlordId: 0,
      traits: [],
      parentFactionId: parent.id,
      foundedTick: W.tick,
    };
  W.factions.push(f);
  place.factionId = id;
  place.cultureId = culture.id;
  place.stability = clamp((place.stability || 0) + 0.15, 0, 1);
  W.components.position[entityId] = {
    x: place.x,
    y: place.y,
    layer: 0,
    regionId: regionId(place.x, place.y),
  };
  W.components.identity[entityId] = {
    generatedName: name,
    significance: 5,
    notable: true,
    titles: ["Polity"],
  };
  moveResidents(place, parent, f);
  for (const [x, y] of [
    [f, parent],
    [parent, f],
  ]) {
    const rel =
      x.relations[y.id] ||
      (x.relations[y.id] = { status: "neutral", pressure: 0, grievance: 0, trade: 0 });
    rel.status = "hostile";
    rel.pressure = Math.max(rel.pressure || 0, 120);
    rel.grievance = +((rel.grievance || 0) + 40).toFixed(3);
    rel.truceUntil = 0;
  }
  if (!parent.rivals.includes(id)) parent.rivals.push(id);
  parent.cohesion = clamp(parent.cohesion - 0.15, 0.12, 1);
  for (const s of W.settlements)
    if (!s.ruined && s.factionId === parent.id) s.stability = clamp(s.stability - 0.05, 0, 1);
  if (leaderId && W.components.identity[leaderId]) {
    addRelation(leaderId, entityId, "leads", 1, causeEvent);
    W.components.identity[leaderId].titles.push(`First Voice of ${name}`);
    W.components.identity[leaderId].significance += 8;
    W.components.identity[leaderId].notable = true;
    f.leaderId = leaderId;
  }
  return f;
}
function warOfIndependence(parent, rebels, startEventId) {
  const enough =
    typeof factionFieldableFighters === "function"
      ? factionFieldableFighters(parent) >= 2 && factionFieldableFighters(rebels) >= 2
      : true;
  if (!enough) return null;
  for (const [x, y] of [
    [parent, rebels],
    [rebels, parent],
  ]) {
    const rel = x.relations[y.id];
    if (rel) rel.status = "at war";
  }
  addRelation(parent.entityId, rebels.entityId, "at_war_with", 1);
  addRelation(rebels.entityId, parent.entityId, "at_war_with", 1);
  const war = {
    id: Math.max(0, ...W.activeWars.map((w) => w.id || 0)) + 1,
    a: parent.id,
    b: rebels.id,
    attackerId: parent.id,
    started: W.tick,
    startEventId,
    startPopulation: parent.population + rebels.population,
    casualties: 0,
    wounded: 0,
    turns: 0,
    contactTurns: 0,
    ended: 0,
  };
  W.activeWars.push(war);
  if (typeof ensureAttackPlan === "function") ensureAttackPlan(war, true);
  return war;
}
function noteUpheaval(f) {
  ensurePolitics();
  W.politics.lastUpheavalTick = W.tick;
  W.politics.upheavals++;
  if (f) f.lastUpheaval = W.tick;
}
function secede(place, leaderId, reason = "unrest", force = false) {
  const parent = polityOf(place);
  if (!parent) return null;
  const towns = W.settlements.filter((s) => !s.ruined && s.factionId === parent.id);
  if (!force && (towns.length < 2 || place.id === parent.capitalSettlementId)) return null;
  const leader = leaderId || rebelLeader(place, parent);
  if (!leader) return null;
  const rebels = foundPolityFrom(place, leader, parent);
  if (!rebels) return null;
  const ev = emitEvent("RebellionEvent", {
    subjects: [leader, place.entityId, rebels.entityId, parent.entityId],
    location: idx(place.x, place.y),
    factions: [parent.id, rebels.id],
    causes: [W.causalIndex.tile[idx(place.x, place.y)] || 0].filter(Boolean),
    evidence: [`unrest ${place.unrest ?? "high"}`, reason],
    importance: 5,
    data: {
      leader: entityName(leader),
      place: place.name,
      polity: rebels.name,
      parent: parent.name,
      reason,
    },
  });
  rebels.foundingEventId = ev.id;
  const war = warOfIndependence(parent, rebels, ev.id);
  if (war) war.startEventId = ev.id;
  noteUpheaval(parent);
  noteUpheaval(rebels);
  setEmotionImpulse(leader, { resolve: 0.6, contentment: 0.2 }, ev.id, "✊");
  return ev;
}
function civilWar(parent, towns, leaderId) {
  const first = towns[0],
    leader = leaderId || rebelLeader(first, parent);
  if (!leader) return null;
  const rebels = foundPolityFrom(first, leader, parent);
  if (!rebels) return null;
  for (const s of towns.slice(1)) {
    if (s.id === parent.capitalSettlementId) continue;
    s.factionId = rebels.id;
    s.cultureId = rebels.cultureId;
    rebels.settlementIds.push(s.id);
    moveResidents(s, parent, rebels);
  }
  const ev = emitEvent("CivilWarEvent", {
    subjects: [leader, rebels.entityId, parent.entityId],
    location: idx(first.x, first.y),
    factions: [parent.id, rebels.id],
    causes: [W.causalIndex.tile[idx(first.x, first.y)] || 0].filter(Boolean),
    evidence: [
      `${rebels.settlementIds.length} towns rose together`,
      `unrest ${first.unrest ?? "high"}`,
    ],
    importance: 5,
    data: {
      leader: entityName(leader),
      polity: rebels.name,
      parent: parent.name,
      towns: rebels.settlementIds.length,
    },
  });
  rebels.foundingEventId = ev.id;
  const war = warOfIndependence(parent, rebels, ev.id);
  if (war) war.startEventId = ev.id;
  noteUpheaval(parent);
  noteUpheaval(rebels);
  return ev;
}
function coup(f, claimantId, capital) {
  const old = f.leaderId,
    claimant = claimantId || rebelLeader(capital, f);
  if (!claimant || claimant === old) return null;
  for (const e of relationsOf(f.entityId, "leads"))
    if (e.to === f.entityId) removeRelation(e.from, f.entityId, "leads");
  const claimantSoc = W.components.social[claimant],
    oldIdent = old ? W.components.identity[old] : null;
  let fate = "fled";
  if (oldIdent && classifyAlive(old)) {
    if ((claimantSoc?.aggression || 0) > 0.7 && counterRand("coup-blood", f.id, W.tick) < 0.35)
      fate = "slain";
    else {
      const away = farLandTile(capital.x, capital.y, 24, 36, old);
      if (away) issueCivilOrder(old, "exile", away[0], away[1]);
      fate = "driven into exile";
    }
    oldIdent.titles.push("Deposed");
  }
  addRelation(claimant, f.entityId, "leads", 1);
  const ident = W.components.identity[claimant];
  ident.titles.push(`Voice of ${f.name}`);
  ident.significance += 6;
  ident.notable = true;
  f.leaderId = claimant;
  f.successions = (f.successions || 0) + 1;
  f.cohesion = clamp(f.cohesion - 0.15, 0.12, 1);
  capital.stability = clamp(capital.stability - 0.1, 0, 1);
  if (W.living) W.living.successions = (W.living.successions || 0) + 1;
  const ev = emitEvent("CoupEvent", {
    subjects: [claimant, old, f.entityId].filter(Boolean),
    location: idx(capital.x, capital.y),
    factions: [f.id],
    causes: [W.causalIndex.entity[claimant] || 0].filter(Boolean),
    evidence: [`unrest ${capital.unrest ?? "high"}`, `the old Voice was ${fate}`],
    importance: 4,
    data: {
      polity: f.name,
      claimant: entityName(claimant),
      deposed: old ? entityName(old) : "",
      fate,
    },
  });
  if (old && classifyAlive(old)) {
    if (fate === "slain") killEntity(old, "slain in a coup", ev.id);
    else
      for (const id of typeof houseMembers === "function"
        ? houseMembers(W.components.social[old]?.kinGroupId).slice(0, 8)
        : []) {
        const rel = relationshipState(id, claimant);
        if (rel) rel.grievance = clamp((rel.grievance || 0) + 0.6, 0, 1);
      }
  }
  noteUpheaval(f);
  setEmotionImpulse(claimant, { resolve: 0.5, contentment: 0.2 }, ev.id, "👑");
  return ev;
}
function considerUpheavals() {
  ensurePolitics();
  if (W.tick - W.politics.lastUpheavalTick < WORLD_UPHEAVAL_GAP) return null;
  const cycle = Math.floor(W.tick / 256);
  for (const f of W.factions) {
    if (f.stability <= 0 || W.tick - (f.lastUpheaval || -99999) < UPHEAVAL_COOLDOWN) continue;
    const towns = W.settlements.filter((s) => !s.ruined && s.factionId === f.id),
      capital = towns.find((s) => s.id === f.capitalSettlementId),
      restless = towns
        .filter((s) => s.id !== f.capitalSettlementId && (s.unrestHigh || 0) >= 2)
        .sort((a, b) => b.unrest - a.unrest || a.id - b.id);
    if (restless.length && towns.length >= 2) {
      const leader = rebelLeader(restless[0], f);
      if (leader && counterRand("rebellion", f.id, cycle) < 0.35 + restless[0].unrest * 0.4)
        return restless.length >= 2 && counterRand("civil-war", f.id, cycle) < 0.5
          ? civilWar(f, restless, leader)
          : secede(restless[0], leader);
    }
    if (capital && f.leaderId && ((capital.unrestHigh || 0) >= 2 || f.stability < 0.3)) {
      const claimant = rebelLeader(capital, f);
      if (claimant && counterRand("coup", f.id, cycle) < 0.3 + (capital.unrest || 0) * 0.3)
        return coup(f, claimant, capital);
    }
  }
  return null;
}
// ── Tick hook ──────────────────────────────────────────────────────────────────
const updateWeatherCyclePoliticsBase = updateWeatherCycle;
updateWeatherCycle = function () {
  updateWeatherCyclePoliticsBase();
  if (!W?.settlements || !W.factions) return;
  ensurePolitics(W);
  if (W.tick % 256 === 160) {
    updateUnrest();
    considerUpheavals();
  }
};
// ── Chronicle sentences ────────────────────────────────────────────────────────
const eventSentencePoliticsBase = eventSentence;
eventSentence = function (e) {
  const d = e.data || {};
  switch (e.type) {
    case "UnrestEvent":
      return `Unrest simmers in ${d.place}${d.causes?.length ? `: ${d.causes.join(" and ")}` : ""}.`;
    case "RebellionEvent":
      return `${d.leader} raised ${d.place} against ${d.parent} and declared the free polity of ${d.polity}.`;
    case "CivilWarEvent":
      return `Civil war split ${d.parent}: ${d.polity} broke away with ${d.towns} town${d.towns === 1 ? "" : "s"} behind ${d.leader}.`;
    case "CoupEvent":
      return `${d.claimant} seized the Voice of ${d.polity}${d.deposed ? `; ${d.deposed} was ${d.fate}` : ""}.`;
    default:
      return eventSentencePoliticsBase(e);
  }
};
// ── Legends and map mode ───────────────────────────────────────────────────────
const renderFactionPagePoliticsBase = renderFactionPage;
renderFactionPage = function (id) {
  const html = renderFactionPagePoliticsBase(id),
    f = W.factions.find((x) => x.id === id);
  if (!f) return html;
  const towns = W.settlements.filter((s) => !s.ruined && s.factionId === f.id && s.unrest != null);
  if (!towns.length) return html;
  const worst = towns.slice().sort((a, b) => b.unrest - a.unrest)[0],
    mean = towns.reduce((s, t) => s + t.unrest, 0) / towns.length,
    parent = f.parentFactionId ? W.factions.find((x) => x.id === f.parentFactionId) : null,
    block = `<div class="kv"><span>Unrest</span><b>${Math.round(mean * 100)}%${worst.unrest > UNREST_THRESHOLD ? ` · ${legendLink("place", worst.id, worst.name)} restless` : ""}</b>${
      parent ? `<span>Broke from</span><b>${legendLink("faction", parent.id, parent.name)}</b>` : ""
    }</div>`,
    at = html.indexOf('<div class="subhead">Diplomacy</div>');
  return at < 0 ? html + block : html.slice(0, at) + block + html.slice(at);
};
const renderPlacePagePoliticsBase = renderPlacePage;
renderPlacePage = function (id) {
  const html = renderPlacePagePoliticsBase(id),
    s = W.settlements.find((x) => x.id === id);
  if (!s || s.unrest == null) return html;
  const block = `<div class="kv"><span>Unrest</span><b>${Math.round(s.unrest * 100)}%${s.unrestHigh ? ` · high for ${s.unrestHigh} year${s.unrestHigh === 1 ? "" : "s"}` : ""}</b></div>`,
    at = html.indexOf('<div class="subhead">Chronicle</div>');
  return at < 0 ? html + block : html.slice(0, at) + block + html.slice(at);
};
let UNREST_MASK = null,
  UNREST_MASK_TICK = -1,
  UNREST_MASK_WORLD = null;
function unrestMask() {
  if (UNREST_MASK_WORLD === W && UNREST_MASK_TICK === W.tick && UNREST_MASK) return UNREST_MASK;
  UNREST_MASK_WORLD = W;
  UNREST_MASK_TICK = W.tick;
  UNREST_MASK = new Float32Array(W.tileCount);
  for (const s of W.settlements) {
    if (s.ruined || !s.unrest) continue;
    for (let dy = -8; dy <= 8; dy++)
      for (let dx = -8; dx <= 8; dx++) {
        const x = s.x + dx,
          y = s.y + dy;
        if (!inside(x, y)) continue;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > 8) continue;
        const i = idx(x, y),
          v = s.unrest * (1 - d / 9);
        if (v > UNREST_MASK[i]) UNREST_MASK[i] = v;
      }
  }
  return UNREST_MASK;
}
const overlayValuePoliticsBase = overlayValue;
overlayValue = function (name, i) {
  if (name === "unrest") return clamp(unrestMask()[i] * 100, 0, 100);
  return overlayValuePoliticsBase(name, i);
};
const overlayStylePoliticsBase = overlayStyle;
overlayStyle = function (name, i) {
  if (name === "unrest") {
    const v = unrestMask()[i];
    return v > 0.05
      ? hsl(v > UNREST_THRESHOLD ? 4 : 28, 85, 55, clamp(v * 0.75, 0.08, 0.7))
      : "transparent";
  }
  return overlayStylePoliticsBase(name, i);
};
const overlayLegendColorPoliticsBase = overlayLegendColor;
overlayLegendColor = function (id) {
  return id === "unrest" ? "#e0645c" : overlayLegendColorPoliticsBase(id);
};
const setOverlayPoliticsBase = setOverlay;
setOverlay = function (name) {
  setOverlayPoliticsBase(name);
  if (UI.overlay === "unrest" && DOM.mapOverlay)
    DOM.mapOverlay.textContent = "Unrest · amber where it simmers, red where it may break";
};
window.ALIFE_POLITICS_DEBUG = Object.freeze({
  unrest: (settlementId) => unrestOf(W.settlements.find((s) => s.id === settlementId)),
  update: () => {
    updateUnrest();
    return W.settlements
      .filter((s) => !s.ruined)
      .map((s) => ({ id: s.id, name: s.name, unrest: s.unrest, high: s.unrestHigh }));
  },
  consider: () => considerUpheavals(),
  leader: (settlementId) => {
    const s = W.settlements.find((x) => x.id === settlementId);
    return s ? rebelLeader(s, polityOf(s)) : 0;
  },
  secede: (settlementId, force = false) => {
    const s = W.settlements.find((x) => x.id === settlementId);
    return s ? secede(s, 0, "unrest", force) : null;
  },
  civilWar: (factionId) => {
    const f = W.factions.find((x) => x.id === factionId),
      towns = f
        ? W.settlements.filter(
            (s) => !s.ruined && s.factionId === f.id && s.id !== f.capitalSettlementId,
          )
        : [];
    return f && towns.length ? civilWar(f, towns, 0) : null;
  },
  coup: (factionId) => {
    const f = W.factions.find((x) => x.id === factionId),
      capital = f && W.settlements.find((s) => s.id === f.capitalSettlementId);
    return f && capital ? coup(f, 0, capital) : null;
  },
  state: () => ({ ...(W.politics || {}) }),
});
