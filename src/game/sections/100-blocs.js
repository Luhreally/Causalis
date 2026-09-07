// ═══════════════════════════════════════════════════════════════════════════
// 100. BLOCS AND LOANS — the map shows who stands with whom, and treasuries lend
// ═══════════════════════════════════════════════════════════════════════════
// The territory lens painted every polity its own colour, so a world of
// alliances read as a patchwork. The Alliances lens paints each polity in the
// colour of the bloc it stands in: allies and league-mates share their leading
// polity's colour, and the unaligned are faint in their own. And coin now
// moves between courts: a polity that strikes coin and finds its treasury
// empty asks a cordial neighbour with coin to spare for a loan, repays it
// with a quarter's interest over the years as its treasury allows, and is
// remembered for a decade if it pays and for two if it defaults, which also
// costs it grievance and any further credit. The polity page lists debts and
// credits; the Chronicle keeps loans, repayments, and defaults. Coin is a
// tally, not matter; everything here is deterministic.
const LOAN_TERM_YEARS = 8,
  LOAN_INTEREST = 0.25,
  LOAN_MIN = 20,
  LOAN_MAX = 120,
  LOAN_NEED = 12,
  LOAN_RESERVE = 3,
  LOAN_OPINION = 10,
  LOAN_FLOOR = 5,
  LOAN_CADENCE = 256,
  LOAN_OFFSET = 208,
  DEBT_MEMORY = TICKS_PER_YEAR * 20,
  REPAID_MEMORY = TICKS_PER_YEAR * 10,
  BLOCS = { world: null, tick: -1, of: new Map(), leaders: new Map() };
const round1 = (x) => Math.round(x * 10) / 10;
// ── Blocs ─────────────────────────────────────────────────────────────────────
function computeBlocs() {
  if (BLOCS.world === W && BLOCS.tick === W.tick) return;
  BLOCS.world = W;
  BLOCS.tick = W.tick;
  BLOCS.of.clear();
  BLOCS.leaders.clear();
  const living = W.factions.filter((f) => f.stability > 0),
    parent = new Map(living.map((f) => [f.id, f.id])),
    find = (x) => {
      while (parent.get(x) !== x) {
        parent.set(x, parent.get(parent.get(x)));
        x = parent.get(x);
      }
      return x;
    },
    union = (a, b) => {
      if (!parent.has(a) || !parent.has(b)) return;
      const ra = find(a),
        rb = find(b);
      if (ra !== rb) parent.set(Math.max(ra, rb), Math.min(ra, rb));
    };
  for (const f of living) for (const id of f.allies || []) union(f.id, id);
  for (const l of W.leagues || [])
    if (!l.dissolvedTick) for (let i = 1; i < l.members.length; i++) union(l.members[0], l.members[i]);
  const groups = new Map();
  for (const f of living) {
    const root = find(f.id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(f);
  }
  for (const [root, members] of groups) {
    const leader = members
      .slice()
      .sort((x, y) => (y.population || 0) - (x.population || 0) || x.id - y.id)[0];
    for (const f of members) {
      BLOCS.of.set(f.id, root);
      BLOCS.leaders.set(f.id, leader.id);
    }
  }
}
function blocOf(factionId) {
  computeBlocs();
  return BLOCS.of.get(factionId) ?? factionId;
}
function blocLeader(factionId) {
  computeBlocs();
  return factionById(BLOCS.leaders.get(factionId) ?? factionId);
}
function blocSize(factionId) {
  computeBlocs();
  const root = blocOf(factionId);
  let n = 0;
  for (const r of BLOCS.of.values()) if (r === root) n++;
  return n;
}
const overlayStyleBlocsBase = overlayStyle;
overlayStyle = function (name, i) {
  if (name !== "alliances") return overlayStyleBlocsBase(name, i);
  const ownerId = W.tiles.owner?.[i],
    owner = ownerId ? factionById(ownerId) : null;
  if (!owner) return "transparent";
  const a = clamp((W.tiles.territory[i] / 1000) * 0.72, 0.1, 0.72),
    leader = blocLeader(ownerId) || owner,
    alone = blocSize(ownerId) < 2,
    colour = leader.color || owner.color || "hsl(0 0% 50%)";
  return colour.replace(")", ` / ${alone ? +(a * 0.45).toFixed(3) : +a.toFixed(3)})`);
};
const overlayLegendColorBlocsBase = overlayLegendColor;
overlayLegendColor = function (id) {
  return id === "alliances" ? "#f3a3c8" : overlayLegendColorBlocsBase(id);
};
const setOverlayBlocsBase = setOverlay;
setOverlay = function (name) {
  setOverlayBlocsBase(name);
  if (UI.overlay === "alliances" && DOM.mapOverlay)
    DOM.mapOverlay.textContent =
      "Alliances and blocs · allies and league-mates share their leading polity's colour; the unaligned are faint";
};
// ── Loans ─────────────────────────────────────────────────────────────────────
function activeLoans(f) {
  return (W.diplomacy?.treaties || []).filter(
    (t) => t.active && t.kind === "loan" && (t.a === f.id || t.b === f.id),
  );
}
function loanNeed(f) {
  const towns = W.settlements.filter((s) => !s.ruined && s.factionId === f.id).length;
  return clamp(20 + 10 * towns, LOAN_MIN, LOAN_MAX);
}
function seekLoans() {
  if (!W.diplomacy) return 0;
  if (typeof ensureMarkets === "function") ensureMarkets(W);
  let made = 0;
  const living = W.factions.filter((f) => f.stability > 0 && polityCoins(f)).sort((a, b) => a.id - b.id);
  for (const borrower of living) {
    if (borrower.treasury >= LOAN_NEED || activeLoans(borrower).some((t) => t.b === borrower.id)) continue;
    if (W.tick - (borrower.defaultedTick || -1e9) < DEBT_MEMORY) continue;
    const principal = loanNeed(borrower),
      lender = living
        .filter(
          (a) =>
            a !== borrower &&
            a.treasury >= principal * LOAN_RESERVE &&
            !warBetween(a, borrower) &&
            factionsHaveContact(a, borrower) &&
            opinionOf(a, borrower) >= LOAN_OPINION,
        )
        .sort((x, y) => opinionOf(y, borrower) - opinionOf(x, borrower) || y.treasury - x.treasury || x.id - y.id)[0];
    if (!lender) continue;
    lender.treasury = round1(lender.treasury - principal);
    borrower.treasury = round1(borrower.treasury + principal);
    const treaty = {
      id: W.diplomacy.nextId++,
      kind: "loan",
      a: lender.id,
      b: borrower.id,
      principal,
      owed: Math.round(principal * (1 + LOAN_INTEREST)),
      paid: 0,
      startedTick: W.tick,
      until: W.tick + TICKS_PER_YEAR * LOAN_TERM_YEARS,
      active: true,
      eventId: 0,
    };
    W.diplomacy.treaties.push(treaty);
    const court = factionCapital(lender);
    treaty.eventId = emitEvent("LoanEvent", {
      subjects: [lender.leaderId, borrower.leaderId].filter(Boolean),
      location: court ? idx(court.x, court.y) : -1,
      factions: [lender.id, borrower.id],
      causes: [W.lastEventByType.TreatyEvent, W.lastEventByType.EmbassyEvent].filter(Boolean),
      evidence: [`${principal} coin lent`, `${treaty.owed} owed within ${LOAN_TERM_YEARS} years`],
      importance: 3,
      data: { lender: lender.name, borrower: borrower.name, principal, owed: treaty.owed, years: LOAN_TERM_YEARS },
    }).id;
    made++;
  }
  return made;
}
function serviceLoans() {
  if (!W.diplomacy) return 0;
  let settled = 0;
  for (const t of W.diplomacy.treaties.slice()) {
    if (!t.active || t.kind !== "loan") continue;
    const lender = factionById(t.a),
      borrower = factionById(t.b);
    if (!lender || !borrower || lender.stability <= 0 || borrower.stability <= 0) {
      endTreaty(t, "a polity fell before the debt was settled", 2);
      continue;
    }
    const due = t.owed - t.paid,
      pay = Math.min(due, Math.max(0, Math.floor(borrower.treasury - LOAN_FLOOR)));
    if (pay > 0) {
      borrower.treasury = round1(borrower.treasury - pay);
      lender.treasury = round1(lender.treasury + pay);
      t.paid += pay;
    }
    const court = factionCapital(lender);
    if (t.paid >= t.owed) {
      relationOf(lender, borrower).debtRepaidTick = W.tick;
      endTreaty(t, "the loan was repaid with interest", 2);
      emitEvent("RepaymentEvent", {
        subjects: [borrower.leaderId, lender.leaderId].filter(Boolean),
        location: court ? idx(court.x, court.y) : -1,
        factions: [borrower.id, lender.id],
        causes: [t.eventId].filter(Boolean),
        evidence: [`${t.owed} coin repaid`],
        importance: 2,
        data: { lender: lender.name, borrower: borrower.name, owed: t.owed },
      });
      settled++;
    } else if (W.tick >= t.until) {
      t.defaulted = true;
      borrower.defaultedTick = W.tick;
      const rel = relationOf(lender, borrower);
      rel.debtDefaultTick = W.tick;
      rel.grievance = clamp((rel.grievance || 0) + 2, 0, 100);
      rel.opinion = (rel.opinion || 0) - 20;
      endTreaty(t, "the borrower defaulted", 3);
      emitEvent("DefaultEvent", {
        subjects: [borrower.leaderId, lender.leaderId].filter(Boolean),
        location: court ? idx(court.x, court.y) : -1,
        factions: [borrower.id, lender.id],
        causes: [t.eventId].filter(Boolean),
        evidence: [`${due} coin unpaid`, `${LOAN_TERM_YEARS} years passed`],
        importance: 3,
        data: { lender: lender.name, borrower: borrower.name, unpaid: due },
      });
      settled++;
    }
  }
  return settled;
}
// Debts remembered bear on opinion.
const opinionTargetBlocsBase = opinionTarget;
opinionTarget = function (a, b) {
  const out = opinionTargetBlocsBase(a, b),
    rel = relationOf(a, b);
  let extra = 0;
  if (rel.debtDefaultTick && W.tick - rel.debtDefaultTick < DEBT_MEMORY) {
    out.reasons.push({ label: "a debt defaulted", value: -20 });
    extra -= 20;
  }
  if (rel.debtRepaidTick && W.tick - rel.debtRepaidTick < REPAID_MEMORY) {
    out.reasons.push({ label: "a debt repaid", value: 6 });
    extra += 6;
  }
  if (extra) {
    out.target = clamp(out.target + extra, -100, 100);
    out.reasons.sort((x, y) => Math.abs(y.value) - Math.abs(x.value));
  }
  return out;
};
const simTickBlocsBase = simTick;
simTick = function () {
  simTickBlocsBase();
  if (!W?.factions || !W.diplomacy) return;
  if (W.tick % LOAN_CADENCE === LOAN_OFFSET) {
    serviceLoans();
    seekLoans();
  }
};
// ── Chronicle and Legends ─────────────────────────────────────────────────────
const eventSentenceBlocsBase = eventSentence;
eventSentence = function (e) {
  const d = e.data || {};
  if (e.type === "LoanEvent")
    return `${d.lender} lent ${d.principal} coin to ${d.borrower}, ${d.owed} to be repaid within ${d.years} years.`;
  if (e.type === "RepaymentEvent") return `${d.borrower} repaid its debt of ${d.owed} coin to ${d.lender}.`;
  if (e.type === "DefaultEvent") return `${d.borrower} defaulted on ${d.unpaid} coin owed to ${d.lender}.`;
  return eventSentenceBlocsBase(e);
};
const alertWorthyBlocsBase = alertWorthy;
alertWorthy = function (a) {
  return alertWorthyBlocsBase(a) || a.type === "DefaultEvent";
};
const renderFactionPageBlocsBase = renderFactionPage;
renderFactionPage = function (id) {
  const html = renderFactionPageBlocsBase(id),
    f = W.factions.find((x) => x.id === id);
  if (!f) return html;
  const loans = activeLoans(f).map((t) => {
      const other = factionById(t.a === f.id ? t.b : t.a),
        left = t.owed - t.paid;
      return t.b === f.id
        ? `owes ${left} coin to ${other?.name || "a lost court"} (due Year ${formatYear(t.until)})`
        : `lent ${left} coin to ${other?.name || "a lost court"}`;
    }),
    bloc = blocSize(f.id) >= 2 ? blocLeader(f.id) : null,
    rows =
      (bloc ? `<div class="kv"><span>Bloc</span><b>${esc(`${blocSize(f.id)} polities standing with ${bloc.name}`)}</b></div>` : "") +
      (loans.length ? `<div class="kv"><span>Loans</span><b>${esc(loans.join("; "))}</b></div>` : "");
  if (!rows) return html;
  const at = html.indexOf('<div class="subhead">');
  return at < 0 ? html + rows : html.slice(0, at) + rows + html.slice(at);
};
window.ALIFE_BLOCS_DEBUG = Object.freeze({
  bloc: (factionId) => blocOf(factionId),
  leader: (factionId) => blocLeader(factionId)?.id || 0,
  size: (factionId) => blocSize(factionId),
  style: (i) => overlayStyle("alliances", i),
  seek: () => seekLoans(),
  service: () => serviceLoans(),
  loans: (factionId) => activeLoans(W.factions.find((f) => f.id === factionId) || { id: 0 }).map((t) => ({ ...t })),
});
