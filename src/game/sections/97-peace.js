// ═══════════════════════════════════════════════════════════════════════════
// 97. WAR AIMS AND PEACE — every war wants something, and every peace has terms
// ═══════════════════════════════════════════════════════════════════════════
// A war was a pressure that broke and a column that marched at the weakest
// town, and it ended with a reason and a four-year truce. Every war now has
// an aim read from what drove it: a contested border, a granary for a hungry
// people, tribute for old grievances, the rebels' independence, a league's
// oath, or plain plunder and standing. The column marches where the aim
// points: the nearest border town, the fullest granary, the capital. And
// every peace has terms drawn from the aim and the outcome: a beaten polity
// pays tribute, a failed revolt bends the knee, a revolt that holds is
// recognised, a captured border settles into a long truce, a failed war into
// a middling one, and an exhausted draw into a short one. When a league's
// member makes peace, the league makes it as one: its other wars against the
// same enemy end at the same table. The war page shows the aim and the
// terms and the Chronicle reads the peace in a sentence. The rules are
// deterministic and the annals keep them.
const WAR_AIMS = Object.freeze({
    border: "a contested border",
    granary: "a granary for a hungry people",
    tribute: "tribute for old grievances",
    liberation: "the rebels' independence",
    oath: "a league's oath",
    plunder: "plunder and standing",
  }),
  PEACE_YEARS = Object.freeze({ border: 12, holds: 10, recognised: 20, draw: 6, tribute: 8 });
function warFactions(war) {
  return [factionById(war.a), factionById(war.b)];
}
// What a war is for, read from what drove it.
function warAim(war) {
  const [a, b] = warFactions(war);
  if (!a || !b) return "plunder";
  if (war.leagueId) return "oath";
  if (a.parentFactionId === b.id || b.parentFactionId === a.id) return "liberation";
  const p = relationPressure(a, b);
  if ((p.grievance || 0) >= 4) return "tribute";
  if ((p.scarcity || 0) > 0) return "granary";
  if ((p.border || 0) > 0) return "border";
  return "plunder";
}
function ensureWarAim(war) {
  if (war && !war.goal) war.goal = warAim(war);
  return war?.goal || "plunder";
}
const ensureAttackPlanPeaceBase = ensureAttackPlan;
ensureAttackPlan = function (war, create = false) {
  if (war && !war.ended) ensureWarAim(war);
  return ensureAttackPlanPeaceBase(war, create);
};
// The column marches where the aim points.
const campaignTargetPeaceBase = campaignTarget;
campaignTarget = function (war, attackerId) {
  const goal = war?.goal;
  if (!goal || goal === "plunder" || goal === "oath") return campaignTargetPeaceBase(war, attackerId);
  const defenderId = attackerId === war.a ? war.b : war.a,
    towns = W.settlements.filter((s) => !s.ruined && s.factionId === defenderId);
  if (!towns.length) return campaignTargetPeaceBase(war, attackerId);
  if (goal === "border") {
    const homes = W.settlements.filter((s) => !s.ruined && s.factionId === attackerId);
    if (!homes.length) return campaignTargetPeaceBase(war, attackerId);
    const near = (s) => Math.min(...homes.map((h) => dist2(h.x, h.y, s.x, s.y)));
    return towns.slice().sort((l, r) => near(l) - near(r) || l.id - r.id)[0];
  }
  if (goal === "granary")
    return towns.slice().sort((l, r) => settlementFood(r) - settlementFood(l) || l.id - r.id)[0];
  // Tribute and liberation strike at the capital.
  const capital = factionCapital(factionById(defenderId));
  return capital && towns.includes(capital) ? capital : campaignTargetPeaceBase(war, attackerId);
};
// ── The peace ──────────────────────────────────────────────────────────────────
function warOutcome(reason) {
  const r = String(reason || "");
  if (/political collapse/.test(r)) return "collapse";
  if (/tribute|vassal|submission|envoy|marriage|bound by the god/.test(r)) return "settled";
  if (/occupied|\bfell\b/.test(r)) return "attacker";
  if (
    /column was broken|withdrew|stalled|mobilization failed|could not field|standoff|no campaign route|could not reach/.test(
      r,
    )
  )
    return "defender";
  return "draw";
}
function warAttacker(war, a, b) {
  const id = war.attackerId || war.attackPlan?.attackerId || war.a;
  return id === b.id ? b : a;
}
function concludePeace(war, a, b, reason) {
  const goal = ensureWarAim(war),
    outcome = warOutcome(reason),
    attacker = warAttacker(war, a, b),
    defender = attacker === a ? b : a,
    winner = outcome === "attacker" ? attacker : outcome === "defender" ? defender : null,
    loser = winner ? (winner === a ? b : a) : null,
    rebels = a.parentFactionId === b.id ? a : b.parentFactionId === a.id ? b : null;
  let terms = "",
    years = 0;
  const truce = (n, why) => {
    years = n;
    bindPeace(a, b, n, null, why);
  };
  if (outcome === "collapse") terms = "no terms; one of them had fallen apart";
  else if (outcome === "settled") terms = "as the envoys agreed";
  else if (winner) {
    if (goal === "liberation" && rebels) {
      if (winner === rebels) {
        truce(PEACE_YEARS.recognised, "independence recognised");
        terms = `${rebels.name}'s independence was recognised for ${years} years`;
      } else if (!rebels.overlordId && makeVassal(rebels, winner, null, war))
        terms = `${rebels.name} bent the knee to ${winner.name}`;
      else {
        truce(PEACE_YEARS.holds, "the revolt failed");
        terms = `the revolt failed; a ${years}-year truce`;
      }
    } else if (winner === attacker && goal === "border") {
      truce(PEACE_YEARS.border, "the border moved");
      terms = `the border moved with the captured town; a ${years}-year truce`;
    } else if (winner === attacker) {
      const paid =
        !loser.overlordId && !activeTreaty("tribute", loser, winner)
          ? makeTribute(loser, winner, null, war)
          : null;
      if (paid) {
        const treaty = W.diplomacy.treaties.at(-1);
        years = PEACE_YEARS.tribute;
        terms = `${loser.name} pays ${winner.name} ${treaty ? `${treaty.amount} measures of food` : "food"} a year for ${years} years`;
      } else {
        truce(PEACE_YEARS.holds, "the victor was satisfied");
        terms = `${loser.name} conceded ${WAR_AIMS[goal]}; a ${years}-year truce`;
      }
    } else {
      truce(PEACE_YEARS.holds, "the old border stood");
      terms = `${loser.name}'s war for ${WAR_AIMS[goal]} failed; the old border stood for ${years} years`;
    }
  } else {
    truce(PEACE_YEARS.draw, "a peace of exhaustion");
    terms = `a peace of exhaustion for ${years} years`;
  }
  war.peace = { goal, outcome, terms, years, winnerId: winner?.id || 0, tick: W.tick };
  const ev = emitEvent("PeaceEvent", {
    subjects: [a.leaderId, b.leaderId].filter(Boolean),
    location: (() => {
      const court = factionCapital(winner || a);
      return court ? idx(court.x, court.y) : -1;
    })(),
    factions: [a.id, b.id],
    causes: [W.lastEventByType.WarEndedEvent, war.startEventId].filter(Boolean),
    evidence: [WAR_AIMS[goal], outcome === "draw" ? "neither side prevailed" : outcome, terms],
    importance: outcome === "collapse" ? 2 : 4,
    data: {
      a: a.name,
      b: b.name,
      goal,
      aim: WAR_AIMS[goal],
      outcome,
      terms,
      years,
      winner: winner?.name || "",
      conference: !!war.conference,
    },
  });
  war.peaceEventId = ev.id;
  return war.peace;
}
// A league makes peace as one: its other wars against the same enemy end too.
function leaguePeace(war, a, b) {
  if (typeof leagueOf !== "function" || !W.leagues?.length) return 0;
  let ended = 0;
  for (const [member, enemy] of [
    [a, b],
    [b, a],
  ]) {
    const league = leagueOf(member);
    if (!league || league.dissolvedTick) continue;
    for (const other of W.activeWars.slice()) {
      if (other === war || other.ended || (other.a !== enemy.id && other.b !== enemy.id)) continue;
      const allyId = other.a === enemy.id ? other.b : other.a;
      if (allyId === member.id || !league.members.includes(allyId)) continue;
      const x = factionById(other.a),
        y = factionById(other.b);
      if (!x || !y) continue;
      other.conference = { warId: war.id, leagueId: league.id };
      endWar(other, x, y, `${league.name} made peace as one`);
      ended++;
    }
  }
  return ended;
}
const endWarPeaceBase = endWar;
endWar = function (war, a, b, reason) {
  const fresh = !!war && !war.ended;
  endWarPeaceBase(war, a, b, reason);
  if (!fresh || !war.ended || !a || !b || !W.diplomacy) return;
  concludePeace(war, a, b, reason);
  leaguePeace(war, a, b);
};
// ── Chronicle, alerts, and the war page ───────────────────────────────────────
const eventSentencePeaceBase = eventSentence;
eventSentence = function (e) {
  if (e.type !== "PeaceEvent") return eventSentencePeaceBase(e);
  const d = e.data || {};
  if (d.outcome === "collapse") return `${d.a} and ${d.b} stopped fighting when one of them fell apart.`;
  if (d.outcome === "settled") return `${d.a} and ${d.b} made peace on the envoys' terms.`;
  if (d.conference) return `${d.a} and ${d.b} made peace at the league's table: ${d.terms}.`;
  if (d.winner) return `${d.winner} won the war for ${d.aim}: ${d.terms}.`;
  return `${d.a} and ${d.b} made peace, neither having won ${d.aim}: ${d.terms}.`;
};
const alertWorthyPeaceBase = alertWorthy;
alertWorthy = function (a) {
  return alertWorthyPeaceBase(a) || (a.type === "PeaceEvent" && a.data?.outcome !== "collapse");
};
const renderWarPagePeaceBase = renderWarPage;
renderWarPage = function (id) {
  const html = renderWarPagePeaceBase(id),
    w = W.activeWars.find((x) => x.id === id);
  if (!w) return html;
  const rows =
      `<span>War aim</span><b>${esc(WAR_AIMS[ensureWarAim(w)] || "")}</b>` +
      (w.peace ? `<span>Peace</span><b>${esc(w.peace.terms)}</b>` : ""),
    at = html.indexOf("<span>Toll</span>");
  return at < 0 ? html : html.slice(0, at) + rows + html.slice(at);
};
window.ALIFE_PEACE_DEBUG = Object.freeze({
  aims: () => ({ ...WAR_AIMS }),
  aim: (warId) => ensureWarAim(W.activeWars.find((w) => w.id === warId)),
  derive: (aId, bId) => warAim({ a: aId, b: bId }),
  outcome: (reason) => warOutcome(reason),
  target: (warId, attackerId) => {
    const w = W.activeWars.find((x) => x.id === warId);
    return w ? campaignTarget(w, attackerId)?.id || 0 : 0;
  },
  peace: (warId) => {
    const w = W.activeWars.find((x) => x.id === warId);
    return w?.peace ? { ...w.peace } : null;
  },
});
