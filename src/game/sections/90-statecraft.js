// ═══════════════════════════════════════════════════════════════════════════
// 90. STATECRAFT — opinion, pacts, open markets, embassies, coalitions, the wire
// ═══════════════════════════════════════════════════════════════════════════
// Polities went from neutral to hostile to war on a pressure that read borders,
// scarcity, grievance, ethos, and aggression, and nothing else: no memory of
// kindness, no fear of the strongest, no treaty short of tribute or the knee.
// Here every polity holds an opinion of every other it has met, drifting each
// year toward what the facts warrant (trade, one people, grievances, wars
// remembered, tribute paid or received, a yoke, a marriage, an alliance, a
// league, treaties kept, an embassy at the court, ways of rule apart, and fear
// of a hegemon) and shown with its reasons on the polity page. Opinion bears
// on war pressure. Envoys carry four new proposals: a pact of non-aggression
// that caps pressure for twenty years, open markets that widen barter for
// thirty, an embassy that warms opinion for as long as it stands, and an
// alliance in defence. When one polity holds nearly half of all power, the
// others' opinion of it sours and they may join in a coalition league against
// it. Where both courts have radio, terms pass over the wire and are answered
// the same day. Rendering only reads.
const OPINION_CADENCE = 256,
  OPINION_OFFSET = 120,
  OPINION_INERTIA = 0.25,
  PACT_YEARS = 20,
  TRADE_TREATY_YEARS = 30,
  EMBASSY_WARMTH_PER_YEAR = 3,
  EMBASSY_WARMTH_CAP = 24,
  COALITION_SHARE = 0.45,
  COALITION_REST = TICKS_PER_YEAR * 40,
  STATECRAFT_TERMS = Object.freeze({
    pact: "a pact of non-aggression",
    trade: "open markets between the polities",
    embassy: "a resident embassy at the court",
    alliance: "an alliance in defence",
  }),
  STATECRAFT_EVENTS = Object.freeze({
    pact: "PactEvent",
    trade: "TradeTreatyEvent",
    embassy: "EmbassyEvent",
    alliance: "AllianceTreatyEvent",
  });
function ensureStatecraft(world = W) {
  if (!world) return null;
  ensureDiplomacy(world);
  world.statecraft = world.statecraft || { version: 1, coalitions: 0, hegemonId: 0, lastCoalitionTick: -1e9 };
  return world.statecraft;
}
const restoreWorldDefaultsStatecraftBase = restoreWorldDefaults;
restoreWorldDefaults = function () {
  restoreWorldDefaultsStatecraftBase();
  ensureStatecraft(W);
};
// ── Opinion ───────────────────────────────────────────────────────────────────
function opinionOf(a, b) {
  return (a && b && a.relations?.[b.id]?.opinion) || 0;
}
function opinionWord(o) {
  return o >= 40 ? "warm" : o >= 10 ? "cordial" : o > -10 ? "cool" : o > -40 ? "cold" : "hostile";
}
function recentWarBetween(a, b, years = 10) {
  return (W.activeWars || []).some(
    (w) =>
      ((w.a === a.id && w.b === b.id) || (w.a === b.id && w.b === a.id)) &&
      (!w.ended || W.tick - w.ended < TICKS_PER_YEAR * years),
  );
}
function powerShares() {
  const living = W.factions.filter((f) => f.stability > 0),
    total = living.reduce((n, f) => n + factionPower(f), 0) || 1;
  return { living, total, share: (f) => factionPower(f) / total };
}
function hegemonOf() {
  const { living, share } = powerShares();
  if (living.length < 3) return null;
  const top = living.slice().sort((x, y) => share(y) - share(x))[0];
  return top && share(top) > COALITION_SHARE ? top : null;
}
// What a's opinion of b ought to be, and why.
function opinionTarget(a, b) {
  const rel = relationOf(a, b),
    reasons = [],
    add = (label, value) => {
      if (value) reasons.push({ label, value: Math.round(value) });
    };
  add("trade between them", Math.min(30, (rel.trade || 0) * 2));
  if (a.cultureId && a.cultureId === b.cultureId) add("one people", 15);
  add("old grievances", -Math.min(40, (rel.grievance || 0) * 2));
  if (warBetween(a, b)) add("a war under way", -35);
  else if (recentWarBetween(a, b)) add("a war remembered", -20);
  const tribute = activeTreaty("tribute", a, b);
  if (tribute) add(tribute.a === a.id ? "tribute paid" : "tribute received", tribute.a === a.id ? -12 : 6);
  const vassal = activeTreaty("vassal", a, b);
  if (vassal) add(vassal.a === a.id ? "a yoke borne" : "a vassal held", vassal.a === a.id ? -10 : 6);
  if (
    (W.diplomacy.marriages || []).some(
      (m) =>
        ((m.from === a.id && m.to === b.id) || (m.from === b.id && m.to === a.id)) &&
        W.tick - m.tick < TICKS_PER_YEAR * 20,
    )
  )
    add("a marriage between the houses", 20);
  if (typeof alliedPair === "function" && alliedPair(a, b)) add("allies", 25);
  if (typeof leagueOf === "function") {
    const la = leagueOf(a);
    if (la && la === leagueOf(b)) add("one league", 15);
  }
  if (activeTreaty("pact", a, b)) add("a pact kept", 10);
  if (activeTreaty("trade", a, b)) add("open markets", 12);
  const embassy = activeTreaty("embassy", a, b);
  if (embassy)
    add(
      "an embassy at the court",
      Math.min(EMBASSY_WARMTH_CAP, EMBASSY_WARMTH_PER_YEAR * Math.floor((W.tick - embassy.startedTick) / TICKS_PER_YEAR) + 3),
    );
  if (typeof ideologyDistance === "function") add("ways of rule apart", -Math.round(ideologyDistance(a, b) * 20));
  const hegemon = hegemonOf();
  if (hegemon && hegemon === b) add("fear of a hegemon", -15);
  const target = clamp(reasons.reduce((n, r) => n + r.value, 0), -100, 100);
  reasons.sort((x, y) => Math.abs(y.value) - Math.abs(x.value));
  return { target, reasons };
}
function updateOpinions() {
  ensureStatecraft(W);
  const living = W.factions.filter((f) => f.stability > 0);
  for (const a of living)
    for (const b of living) {
      if (a === b || !factionsHaveContact(a, b)) continue;
      const rel = relationOf(a, b),
        { target } = opinionTarget(a, b);
      rel.opinion = Math.round(((rel.opinion || 0) + (target - (rel.opinion || 0)) * OPINION_INERTIA) * 10) / 10;
    }
}
// Opinion bears on war pressure; a pact caps it.
const relationPressureStatecraftBase = relationPressure;
relationPressure = function (a, b) {
  const p = relationPressureStatecraftBase(a, b),
    o = (opinionOf(a, b) + opinionOf(b, a)) / 2;
  p.opinion = o;
  p.pressure -= o * 0.4;
  if (W.diplomacy && activeTreaty("pact", a, b)) p.pressure = Math.min(p.pressure, 50);
  return p;
};
// ── Treaties of statecraft ────────────────────────────────────────────────────
function makeStatecraftTreaty(kind, a, b, envoy = null) {
  ensureStatecraft(W);
  if (!STATECRAFT_TERMS[kind] || activeTreaty(kind, a, b)) return null;
  if (kind === "alliance" && warBetween(a, b)) return null;
  const years = kind === "pact" ? PACT_YEARS : kind === "trade" ? TRADE_TREATY_YEARS : 0,
    treaty = {
      id: W.diplomacy.nextId++,
      kind,
      a: a.id,
      b: b.id,
      startedTick: W.tick,
      until: years ? W.tick + TICKS_PER_YEAR * years : 0,
      active: true,
      eventId: 0,
      envoyId: envoy?.id || 0,
    };
  W.diplomacy.treaties.push(treaty);
  for (const [x, y] of [
    [a, b],
    [b, a],
  ]) {
    const rel = relationOf(x, y);
    if (kind === "pact") {
      rel.pressure = Math.min(rel.pressure || 0, 40);
      if (rel.status === "hostile" || rel.status === "mobilizing") rel.status = "neutral";
      rel.mobilizeSince = 0;
    }
    if (kind === "trade") rel.trade = (rel.trade || 0) + 4;
    if (kind === "alliance") {
      rel.status = "allied";
      if (!x.allies.includes(y.id)) x.allies.push(y.id);
    }
    rel.opinion = Math.min(100, (rel.opinion || 0) + 6);
  }
  if (kind === "alliance") {
    addRelation(a.entityId, b.entityId, "allied_with", 1);
    addRelation(b.entityId, a.entityId, "allied_with", 1);
  }
  const court = factionCapital(b),
    ev = emitEvent(STATECRAFT_EVENTS[kind], {
      subjects: [envoy?.personId, a.entityId, b.entityId].filter(Boolean),
      location: court ? idx(court.x, court.y) : -1,
      factions: [a.id, b.id],
      causes: [envoy?.eventId].filter(Boolean),
      evidence: [STATECRAFT_TERMS[kind], years ? `for ${years} years` : "for as long as it stands"],
      importance: kind === "alliance" ? 4 : 3,
      data: { a: a.name, b: b.name, kind, terms: STATECRAFT_TERMS[kind], years },
    });
  treaty.eventId = ev.id;
  return ev;
}
const resolveEnvoyStatecraftBase = resolveEnvoy;
resolveEnvoy = function (envoy, force = null) {
  if (!STATECRAFT_TERMS[envoy?.proposal]) return resolveEnvoyStatecraftBase(envoy, force);
  const from = factionById(envoy.from),
    to = factionById(envoy.to);
  if (!livingFaction(from) || !livingFaction(to)) return null;
  const roll = counterRand("statecraft", envoy.id, W.tick),
    o = opinionOf(to, from),
    kind = envoy.proposal;
  let accept;
  if (kind === "pact") accept = roll < 0.35 + o / 200 + (warBetween(from, to) ? 0 : 0.1);
  else if (kind === "trade") accept = roll < 0.4 + o / 150 + (to.ethos?.mercantile || 0) * 0.3;
  else if (kind === "embassy") accept = roll < 0.5 + o / 200;
  else accept = o >= 20 && !warBetween(from, to) && roll < 0.3 + o / 150;
  if (force !== null) accept = !!force;
  const result = accept ? makeStatecraftTreaty(kind, from, to, envoy) : null;
  if (!result) {
    const court = factionCapital(to);
    emitEvent("TreatyRefusedEvent", {
      subjects: [envoy.personId, from.entityId, to.entityId],
      location: court ? idx(court.x, court.y) : -1,
      factions: [from.id, to.id],
      causes: [envoy.eventId].filter(Boolean),
      evidence: [accept ? "the terms could not be kept" : "the court would not hear them"],
      importance: 2,
      data: { from: from.name, to: to.name, terms: STATECRAFT_TERMS[kind] },
    });
    if (court) diplomacyVisual("refusal", idx(court.x, court.y));
  }
  return result;
};
// Courts propose pacts, markets, embassies, and alliances as opinion warrants.
const considerProposalsStatecraftBase = considerProposals;
considerProposals = function () {
  considerProposalsStatecraftBase();
  ensureStatecraft(W);
  const cycle = Math.floor(W.tick / 128);
  for (const f of W.factions) {
    if (!livingFaction(f) || activeEnvoyFrom(f) || !f.leaderId) continue;
    if (typeof polityHasTrait === "function" && polityHasTrait(f, "Isolationist")) continue;
    if (counterRand("statecraft-court", f.id, cycle) > 0.1) continue;
    let best = null,
      bestScore = -Infinity;
    for (const g of W.factions) {
      if (g === f || !livingFaction(g) || !g.leaderId || !factionsHaveContact(f, g)) continue;
      const o = opinionOf(f, g),
        rel = relationOf(f, g),
        war = warBetween(f, g);
      let kind = null;
      if (!war && o >= 30 && !(typeof alliedPair === "function" && alliedPair(f, g)) && !activeTreaty("alliance", f, g)) kind = "alliance";
      else if (!war && o >= 10 && !activeTreaty("trade", f, g) && ((f.ethos?.mercantile || 0) > 0.5 || (g.ethos?.mercantile || 0) > 0.5)) kind = "trade";
      else if (!war && (rel.pressure || 0) > 40 && !activeTreaty("pact", f, g) && o > -30) kind = "pact";
      else if (!war && o >= 0 && !activeTreaty("embassy", f, g) && factionHasTech(f.id, "writing")) kind = "embassy";
      if (!kind) continue;
      const score = (kind === "pact" ? 3 : kind === "alliance" ? 2 : 1) * 10 + o;
      if (score > bestScore) {
        bestScore = score;
        best = { g, kind };
      }
    }
    if (best) sendEnvoy(f, best.g, best.kind);
  }
};
// Pacts and open markets run their term; embassies and alliances stand.
function expireStatecraftTreaties() {
  for (const t of W.diplomacy.treaties)
    if (t.active && STATECRAFT_TERMS[t.kind] && t.until && W.tick >= t.until) endTreaty(t, "the term ran out", 2);
}
// ── Coalitions against a hegemon ──────────────────────────────────────────────
function considerCoalition() {
  const state = ensureStatecraft(W),
    hegemon = hegemonOf();
  state.hegemonId = hegemon?.id || 0;
  if (!hegemon || W.tick - state.lastCoalitionTick < COALITION_REST) return null;
  const others = W.factions.filter(
    (f) => f !== hegemon && f.stability > 0 && f.leaderId && factionsHaveContact(f, hegemon) && opinionOf(f, hegemon) <= -10,
  );
  if (others.length < 2) return null;
  const members = [];
  for (const f of others) {
    if (members.some((m) => warBetween(m, f))) continue;
    if (typeof leagueOf === "function" && leagueOf(f)) continue;
    members.push(f);
    if (members.length >= 4) break;
  }
  if (members.length < 2 || typeof formLeague !== "function") return null;
  const league = formLeague(members.map((f) => f.id));
  league.coalitionAgainst = hegemon.id;
  state.coalitions++;
  state.lastCoalitionTick = W.tick;
  for (const f of members) {
    const rel = relationOf(f, hegemon);
    rel.opinion = Math.max(-100, (rel.opinion || 0) - 10);
    for (const g of members)
      if (g !== f) relationOf(f, g).opinion = Math.min(100, (relationOf(f, g).opinion || 0) + 10);
  }
  const capital = factionCapital(members[0]);
  return emitEvent("CoalitionEvent", {
    subjects: [...members.map((f) => f.entityId), hegemon.entityId],
    location: capital ? idx(capital.x, capital.y) : -1,
    factions: [...members.map((f) => f.id), hegemon.id],
    causes: [league.eventId].filter(Boolean),
    evidence: [`${hegemon.name} held ${Math.round(powerShares().share(hegemon) * 100)}% of all power`],
    importance: 4,
    data: { members: members.map((f) => f.name), against: hegemon.name, league: league.name },
  });
}
// ── The wire: radio courts answer the same day ────────────────────────────────
const sendEnvoyStatecraftBase = sendEnvoy;
sendEnvoy = function (from, to, proposal, terms = {}) {
  const envoy = sendEnvoyStatecraftBase(from, to, proposal, terms);
  if (!envoy || !factionHasTech(from.id, "radio") || !factionHasTech(to.id, "radio")) return envoy;
  envoy.wire = true;
  resolveEnvoy(envoy);
  envoy.phase = "return";
  envoy.resolvedTick = W.tick;
  envoy.active = false;
  envoy.endedTick = W.tick;
  clearCivilOrder(envoy.personId);
  return envoy;
};
function updateStatecraft() {
  if (!W?.factions) return;
  if (W.tick % OPINION_CADENCE === OPINION_OFFSET) {
    updateOpinions();
    expireStatecraftTreaties();
  }
  if (W.tick % OPINION_CADENCE === OPINION_OFFSET + 8) considerCoalition();
}
const simTickStatecraftBase = simTick;
simTick = function () {
  simTickStatecraftBase();
  if (W?.diplomacy) updateStatecraft();
};
// ── Chronicle, alerts, and the Relations table ────────────────────────────────
const eventSentenceStatecraftBase = eventSentence;
eventSentence = function (e) {
  const d = e.data || {};
  if (e.type === "PactEvent") return `${d.a} and ${d.b} swore a pact of non-aggression for ${d.years} years.`;
  if (e.type === "TradeTreatyEvent") return `${d.a} and ${d.b} opened their markets to each other for ${d.years} years.`;
  if (e.type === "EmbassyEvent") return `${d.a} set an embassy at the court of ${d.b}.`;
  if (e.type === "AllianceTreatyEvent") return `${d.a} and ${d.b} bound themselves in alliance.`;
  if (e.type === "CoalitionEvent") {
    const m = d.members || [];
    return `${m.length > 1 ? m.slice(0, -1).join(", ") + " and " + m.at(-1) : m[0]} joined in a coalition against ${d.against}.`;
  }
  return eventSentenceStatecraftBase(e);
};
const alertWorthyStatecraftBase = alertWorthy;
alertWorthy = function (a) {
  return alertWorthyStatecraftBase(a) || a.type === "CoalitionEvent" || a.type === "AllianceTreatyEvent";
};
function relationsTable(f) {
  const rows = W.factions
    .filter((g) => g !== f && g.stability > 0 && factionsHaveContact(f, g))
    .map((g) => {
      const rel = relationOf(f, g),
        o = rel.opinion || 0,
        { reasons } = opinionTarget(f, g),
        top = reasons[0] ? ` <span class="muted">${esc(reasons[0].label)}</span>` : "",
        treaties = W.diplomacy.treaties
          .filter((t) => t.active && STATECRAFT_TERMS[t.kind] && ((t.a === f.id && t.b === g.id) || (t.a === g.id && t.b === f.id)))
          .map((t) => t.kind)
          .join(", ");
      return `<div class="kv"><span>${legendLink("faction", g.id, esc(g.name))}${top}</span><b>${esc(rel.status || "neutral")} · ${opinionWord(o)} (${Math.round(o)})${treaties ? ` · ${esc(treaties)}` : ""}</b></div>`;
    })
    .join("");
  return rows ? `<div class="subhead">Relations</div>${rows}` : "";
}
const renderFactionPageStatecraftBase = renderFactionPage;
renderFactionPage = function (id) {
  const html = renderFactionPageStatecraftBase(id),
    f = W.factions.find((x) => x.id === id);
  if (!f || !W.diplomacy) return html;
  const table = relationsTable(f);
  if (!table) return html;
  const at = html.indexOf('<div class="subhead">');
  return at < 0 ? html + table : html.slice(0, at) + table + html.slice(at);
};
window.ALIFE_STATECRAFT_DEBUG = Object.freeze({
  opinion: (aId, bId) => opinionOf(factionById(aId), factionById(bId)),
  reasons: (aId, bId) => opinionTarget(factionById(aId), factionById(bId)),
  word: (o) => opinionWord(o),
  update: () => updateOpinions(),
  pressure: (aId, bId) => relationPressure(factionById(aId), factionById(bId)),
  propose: (aId, bId, kind, force = true) => {
    const envoy = sendEnvoy(factionById(aId), factionById(bId), kind);
    if (!envoy) return null;
    if (envoy.wire) return envoy;
    const result = resolveEnvoy(envoy, force);
    envoy.phase = "return";
    envoy.resolvedTick = W.tick;
    return result;
  },
  treaty: (kind, aId, bId) => activeTreaty(kind, factionById(aId), factionById(bId)),
  // Bind a treaty without an envoy, for fixtures and probes.
  bind: (kind, aId, bId) => makeStatecraftTreaty(kind, factionById(aId), factionById(bId)),
  accept: (kind, aId, bId, force = null) =>
    resolveEnvoy({ id: W.diplomacy.nextId++, from: aId, to: bId, proposal: kind, personId: 0, eventId: 0 }, force),
  expire: () => expireStatecraftTreaties(),
  hegemon: () => hegemonOf()?.name || null,
  coalition: () => {
    ensureStatecraft(W).lastCoalitionTick = -1e9;
    return considerCoalition();
  },
  table: (factionId) => relationsTable(factionById(factionId)),
});
