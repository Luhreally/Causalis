// ═══════════════════════════════════════════════════════════════════════════
// 154. JUSTICE — offences seen, courts that sit, sentences carried out
// ═══════════════════════════════════════════════════════════════════════════
// Asked for: a more sophisticated law. A polity that knew governance chose
// one of three codes once and never again (99): a blood-price, fines, or
// banishment. Only a robbery was ever judged, the moment it happened and by
// whatever town stood within twelve tiles; a theft from the stores, a
// killing inside the community, a brawl and the eating of the dead were
// never offences in law. Nobody saw a crime: every robbery near a town was
// punished and every one away from a town was not. There were no courts,
// cells or trials, a banished person's order lapsed and they walked home,
// and nothing that might happen to a thief ever stayed a thief's hand.
//
// Now an offence is a case. A theft, a robbery, a killing inside the
// community (42a's KillEvent of importance four: a brawl, a revenge, an
// internal clash), a brawl that came to blows (53) and the eating of the dead
// (78) open a case with its witnesses, the waking people within four tiles; each of
// them and the victim knows it of the offender (the relationship's
// heardCrimes), and talk carries it further (152's gossip). A town with a
// hall under a polity with a code holds a court every sixty-four ticks: it
// tries the open cases whose offender stands within its reach, on evidence of
// those who know (a witness, the victim, or those who heard it said, of the
// polity's people) against the proof the code asks, and the verdict is
// carried out:
//   the blood-price (wergild): the offender, or their household, pays the
//     victim's kin in coin under coin, or in food, and the kin's grievance
//     eases;
//   fines and restitution: restitution to the victim and a fine to the
//     treasury, or days in the cell for one who cannot pay;
//   banishment: out of the polity, and a return inside five years is a new
//     offence;
//   the cell (a codified law, of a polity that rules and writes): days in the
//     hall's cell by the offence's weight, held there and fed there;
//   restoration (of an open polity): restitution and a reconciliation;
//   and under the harshest rule, death for a killing.
// A polity's code follows its ideology (91) and is revised when the two part
// (at most once in four years); a court seen to judge steadies its town. And
// a hungry person who is not desperate (under ninety hunger), and not bold,
// does not rob or steal where the law's eye is on them: near a court town,
// with its watch standing and people about. The old instant judgement of a
// robbery (99) gives way to the courts, and the community's own banishment
// of a thrice-caught thief (52) now happens only where there is no law.
const JUSTICE = {
  cases: 0,
  witnesses: 0,
  trials: 0,
  convicted: 0,
  acquitted: 0,
  dropped: 0,
  jailed: 0,
  banished: 0,
  executed: 0,
  fined: 0,
  compensated: 0,
  deterred: 0,
  revised: 0,
  returned: 0,
};
const JUSTICE_WITNESS_REACH = 4,
  COURT_EVERY = 64,
  COURT_REACH = 12,
  CASE_LAPSE = 4 * 256,
  CELL_MONTH = 21,
  BANISH_YEARS = 5,
  REVISE_EVERY = 4 * 256,
  OFFENCE_WEIGHT = Object.freeze({
    theft: 1,
    robbery: 2,
    assault: 2,
    banishment: 2,
    cannibalism: 3,
    murder: 4,
  }),
  OFFENCE_WORD = Object.freeze({
    theft: "theft from the stores",
    robbery: "robbery",
    assault: "assault",
    banishment: "returning from banishment",
    cannibalism: "eating of the dead",
    murder: "killing",
  }),
  LAW_CODE_NAMES = Object.freeze({
    wergild: "the blood-price",
    fines: "fines and restitution",
    exile: "banishment",
    cell: "the cell and the written law",
    restoration: "restitution and reconciliation",
  }),
  CODE_PROOF = Object.freeze({ wergild: 1, fines: 1, exile: 1, cell: 2, restoration: 1 });
function ensureJustice() {
  W.justice ||= { cases: [], nextCaseId: 1, jailed: [] };
  return W.justice;
}
// ── Offences become cases ────────────────────────────────────────────────────
function openCase(offence, offender, victim, location, eventId) {
  if (!offender || W.kind[offender] !== KINDS.PERSON) return null;
  const j = ensureJustice(),
    town = location >= 0 ? nearestSettlement(location, COURT_REACH) : null,
    witnesses =
      location >= 0
        ? entityAtRadius(location, JUSTICE_WITNESS_REACH, KINDS.PERSON)
            .filter(
              (id) =>
                id !== offender &&
                classifyAlive(id) &&
                !(typeof wouldSleep === "function" && wouldSleep(id)),
            )
            .sort((a, b) => a - b)
            .slice(0, 8)
        : [];
  const c = {
    id: j.nextCaseId++,
    offence,
    offender,
    victim: victim && W.kind[victim] === KINDS.PERSON ? victim : 0,
    townId: town?.id || 0,
    tick: W.tick,
    eventId,
    witnesses,
    status: "open",
  };
  j.cases.push(c);
  if (j.cases.length > 240)
    j.cases = j.cases.filter((x) => x.status === "open" || W.tick - x.tick < 2048).slice(-240);
  for (const w of [...witnesses, c.victim].filter(Boolean)) {
    const r = relationshipState(w, offender);
    if (!r) continue;
    r.heardCrimes = (r.heardCrimes || 0) + 1;
    r.grievance = clamp((r.grievance || 0) + 0.05 * (OFFENCE_WEIGHT[offence] || 1), 0, 1);
    r.trust = clamp((r.trust || 0) - 0.05, 0, 1);
  }
  const ident = W.components.identity[offender];
  if (ident && (offence === "assault" || offence === "murder" || offence === "banishment"))
    ident.crimes = (ident.crimes || 0) + 1;
  JUSTICE.cases++;
  JUSTICE.witnesses += witnesses.length;
  return c;
}
const emitEventJusticeBase = emitEvent;
emitEvent = function (type, data = {}) {
  const ev = emitEventJusticeBase(type, data);
  if (!W?.kind || !ev) return ev;
  const [a, b] = ev.subjects || [];
  if (type === "TheftEvent") openCase("theft", a, 0, ev.location, ev.id);
  else if (type === "RobberyEvent") openCase("robbery", a, b, ev.location, ev.id);
  else if (type === "CannibalismEvent") openCase("cannibalism", a, 0, ev.location, ev.id);
  else if (
    type === "KillEvent" &&
    (ev.importance || 0) >= 4 &&
    W.kind[a] === KINDS.PERSON &&
    (W.kind[b] === KINDS.PERSON ||
      (W.kind[b] === KINDS.CORPSE && W.components.identity[b]?.lifeKind === KINDS.PERSON))
  )
    openCase("murder", a, b, ev.location, ev.id);
  else if (type === "QuarrelEvent" && (ev.importance || 0) >= 3)
    openCase("assault", a, b, ev.location, ev.id);
  return ev;
};
// ── The code a polity keeps ─────────────────────────────────────────────────
function lawCodeFor(f) {
  const i = typeof ensureIdeology === "function" ? ensureIdeology(f) : null,
    writes = factionHasTech(f.id, "writing");
  if (i && i.rule > 0.3) return writes ? "cell" : "exile";
  if (i && i.openness > 0.45) return "restoration";
  if (i && i.openness > 0.2) return "fines";
  return "wergild";
}
chooseLawCode = function (f) {
  return lawCodeFor(f);
};
function reviseLawCodes() {
  for (const f of W.factions) {
    if (
      !f.law ||
      f.stability <= 0 ||
      W.tick - (f.law.revisedTick ?? f.law.adoptedTick ?? 0) < REVISE_EVERY
    )
      continue;
    const code = lawCodeFor(f);
    if (code === f.law.code) continue;
    const from = f.law.code,
      capital = factionCapital(f);
    f.law.code = code;
    f.law.revisedTick = W.tick;
    JUSTICE.revised++;
    f.law.eventId = emitEvent("LawEvent", {
      subjects: [f.leaderId, capital?.entityId].filter(Boolean),
      location: capital ? idx(capital.x, capital.y) : -1,
      factions: [f.id],
      causes: [W.lastEventByType.IdeologyEvent, f.law.eventId].filter(Boolean),
      evidence: [`from ${LAW_CODE_NAMES[from] || from}`, `to ${LAW_CODE_NAMES[code]}`],
      importance: 3,
      data: { polity: f.name, code, from, law: LAW_CODE_NAMES[code], revised: true },
    }).id;
  }
}
// ── The court ────────────────────────────────────────────────────────────────
function courtOf(town) {
  const f = town ? polityOf(town) : null,
    code = lawCodeOf(f);
  if (!code || !completedBuildings(town, "hall").length) return null;
  return {
    town,
    faction: f,
    code,
    hall: completedBuildings(town, "hall").sort((a, b) => a.id - b.id)[0],
  };
}
// Those of the polity who know the deed: the witnesses and the victim still
// living, and anyone of the court's town who has heard it said.
function evidenceFor(c, court) {
  const knowers = new Set();
  for (const w of [...c.witnesses, c.victim].filter(Boolean))
    if (classifyAlive(w) && W.components.social[w]?.factionId === court.faction.id) knowers.add(w);
  for (const id of W.activeIds) {
    if (knowers.size >= 4) break;
    if (W.kind[id] !== KINDS.PERSON || id === c.offender || !classifyAlive(id)) continue;
    const soc = W.components.social[id];
    if (soc?.homePlaceKind !== "settlement" || soc.homePlaceId !== court.town.id) continue;
    if ((soc.relationships?.[c.offender]?.heardCrimes || 0) > 0) knowers.add(id);
  }
  return knowers.size;
}
function takeCoin(from, amount) {
  const ident = W.components.identity[from];
  let taken = 0;
  if (!ident) return 0;
  const pay = (who) => {
    const i = W.components.identity[who];
    const t = Math.min(amount - taken, Math.max(0, i?.civicCoins || 0));
    if (t > 0) {
      i.civicCoins -= t;
      taken += t;
    }
  };
  pay(from);
  const head = W.components.social[from]?.householdId;
  if (taken < amount && head && head !== from && classifyAlive(head)) pay(head);
  return taken;
}
// Food restored: from what the offender carries, then from what they have
// eaten and not yet digested (99's fine took it from the gut the same way).
function takeFood(from, to, amount) {
  const inv = W.components.inventory[from],
    dst = W.components.inventory[to]?.materials;
  if (!inv || !dst) return 0;
  let moved = 0;
  for (const src of [inv.materials, inv.digestive]) {
    const take = Math.min(amount - moved, src?.[C.ORGANIC] || 0, 65535 - (dst[C.ORGANIC] || 0));
    if (take > 0) {
      src[C.ORGANIC] -= take;
      dst[C.ORGANIC] += take;
      moved += take;
    }
  }
  return moved;
}
function victimOrKin(c) {
  if (c.victim && classifyAlive(c.victim) && W.kind[c.victim] === KINDS.PERSON) return c.victim;
  const ident = W.components.identity[c.victim] || W.historicalIdentities?.[c.victim];
  for (const k of [...(ident?.children || []), ...(ident?.parents || [])])
    if (classifyAlive(k) && W.kind[k] === KINDS.PERSON) return k;
  return 0;
}
function jail(offender, court, ticks, c) {
  const j = ensureJustice();
  j.jailed = j.jailed.filter((x) => x.id !== offender);
  j.jailed.push({
    id: offender,
    townId: court.town.id,
    hallId: court.hall.id,
    until: W.tick + ticks,
    caseId: c.id,
  });
  clearCivilOrder(offender);
  JUSTICE.jailed++;
  return `${Math.max(1, Math.round(ticks / CELL_MONTH))} months in the cell`;
}
function banish(offender, court, c) {
  const ident = W.components.identity[offender],
    soc = W.components.social[offender],
    away = farLandTile(court.town.x, court.town.y, 24, 36, offender);
  if (!ident || !soc) return "";
  ident.banishedFrom = court.faction.id;
  ident.banishedUntil = W.tick + BANISH_YEARS * TICKS_PER_YEAR;
  if (!ident.titles.includes("Banished")) ident.titles.push("Banished");
  soc.factionId = 0;
  soc.homePlaceKind = "";
  soc.homePlaceId = 0;
  if (away) issueCivilOrder(offender, "exile", away[0], away[1]);
  JUSTICE.banished++;
  return `banished from ${court.faction.name} for ${BANISH_YEARS} years`;
}
function sentence(c, court) {
  const weight = OFFENCE_WEIGHT[c.offence] || 1,
    code = court.code,
    coin = polityCoins(court.faction),
    kin = victimOrKin(c),
    ideology = typeof ensureIdeology === "function" ? ensureIdeology(court.faction) : null;
  if (
    c.offence === "murder" &&
    (code === "cell" || code === "exile") &&
    (ideology?.rule || 0) > 0.55
  ) {
    killEntity(
      c.offender,
      `put to death under the law of ${court.faction.name} for a killing`,
      c.eventId,
    );
    JUSTICE.executed++;
    return "put to death";
  }
  if (code === "exile")
    return weight >= 2 || (W.components.identity[c.offender]?.crimes || 0) >= 2
      ? banish(c.offender, court, c)
      : jail(c.offender, court, CELL_MONTH, c);
  if (code === "cell") return jail(c.offender, court, weight * 2 * CELL_MONTH, c);
  if (code === "wergild" || code === "restoration") {
    let paid = "";
    if (kin) {
      if (coin) {
        const t = takeCoin(c.offender, weight * 4);
        if (t) {
          W.components.identity[kin].civicCoins = (W.components.identity[kin].civicCoins || 0) + t;
          paid = `${t} coin paid to ${entityName(kin)}`;
        }
      }
      if (!paid) {
        const f = takeFood(c.offender, kin, weight * 6);
        if (f) paid = `${f} food given to ${entityName(kin)}`;
      }
      const r = relationshipState(kin, c.offender);
      if (r) r.grievance = clamp((r.grievance || 0) - (code === "restoration" ? 0.35 : 0.25), 0, 1);
    }
    if (paid) {
      JUSTICE.compensated++;
      return code === "restoration" ? `${paid}, and the two reconciled` : paid;
    }
    return weight >= 4
      ? banish(c.offender, court, c)
      : jail(c.offender, court, weight * CELL_MONTH, c);
  }
  // Fines and restitution.
  const due = weight * 3;
  const t = coin ? takeCoin(c.offender, due) : 0;
  if (t) {
    court.faction.treasury = (court.faction.treasury || 0) + t;
    JUSTICE.fined++;
  }
  const restored = kin ? takeFood(c.offender, kin, weight * 6) : 0;
  if (t >= due || (!coin && restored))
    return `${t ? `fined ${t} coin` : ""}${t && restored ? " and " : ""}${restored ? `${restored} food restored to ${entityName(kin)}` : ""}`;
  return jail(c.offender, court, weight * CELL_MONTH, c) + (t ? `, having paid ${t} coin` : "");
}
function recordVerdict(c, court, verdict, punishment) {
  c.status = verdict;
  c.verdictTick = W.tick;
  c.punishment = punishment;
  c.court = court.town.id;
  const ident = W.components.identity[c.offender];
  if (ident) {
    ident.record = [
      ...(ident.record || []),
      {
        caseId: c.id,
        offence: c.offence,
        verdict,
        punishment,
        tick: W.tick,
        court: court.town.name,
      },
    ].slice(-8);
    if (verdict === "convicted" && typeof talkState === "function") {
      const e = talkState(c.offender);
      if (e) e.standing = clamp(e.standing - 0.2, 0, 1);
    }
  }
  if (verdict === "convicted")
    court.town.stability = clamp((court.town.stability || 0) + 0.01, 0, 1);
  emitEvent("VerdictEvent", {
    subjects: [c.offender, c.victim, court.faction.leaderId].filter(Boolean),
    location: idx(court.hall.x, court.hall.y),
    factions: [court.faction.id],
    causes: [c.eventId, court.faction.law?.eventId].filter(Boolean),
    evidence: [
      `${OFFENCE_WORD[c.offence] || c.offence}`,
      `${LAW_CODE_NAMES[court.code] || court.code}`,
      punishment || verdict,
    ],
    importance: c.offence === "murder" || punishment === "put to death" ? 3 : 2,
    data: {
      name: ident?.generatedName || entityName(c.offender),
      offence: c.offence,
      verdict,
      punishment,
      place: court.town.name,
      polity: court.faction.name,
      code: court.code,
    },
  });
}
function holdCourts() {
  for (const town of W.settlements)
    if (!town.ruined && W.tick % COURT_EVERY === (town.id * 7) % COURT_EVERY) holdCourt(town);
}
function holdCourt(town) {
  const j = ensureJustice(),
    court = courtOf(town);
  if (!court) return 0;
  let tried = 0;
  {
    for (const c of j.cases) {
      if (c.status !== "open") continue;
      if (!classifyAlive(c.offender) || W.kind[c.offender] !== KINDS.PERSON) {
        c.status = "dropped";
        continue;
      }
      if (W.tick - c.tick > CASE_LAPSE) {
        c.status = "dropped";
        JUSTICE.dropped++;
        continue;
      }
      const p = W.components.position[c.offender];
      if (!p || dist2(p.x, p.y, town.x, town.y) > COURT_REACH * COURT_REACH) continue;
      const soc = W.components.social[c.offender];
      if (soc?.factionId !== court.faction.id && c.townId !== town.id) continue;
      if (j.jailed.some((x) => x.id === c.offender)) continue;
      JUSTICE.trials++;
      if (evidenceFor(c, court) < (CODE_PROOF[court.code] || 1)) {
        JUSTICE.acquitted++;
        tried++;
        recordVerdict(c, court, "acquitted", "");
        continue;
      }
      JUSTICE.convicted++;
      tried++;
      recordVerdict(c, court, "convicted", sentence(c, court));
    }
  }
  return tried;
}
// ── The cell ─────────────────────────────────────────────────────────────────
function keepCells() {
  const j = W.justice;
  if (!j?.jailed?.length) return;
  let moved = false;
  j.jailed = j.jailed.filter((x) => {
    if (!classifyAlive(x.id) || W.tick >= x.until) return false;
    const hall = buildingById(x.hallId);
    if (!hall || hall.ruined) return false;
    const p = W.components.position[x.id];
    if (p && (p.x !== hall.x || p.y !== hall.y)) {
      p.x = hall.x;
      p.y = hall.y;
      p.regionId = regionId(hall.x, hall.y);
      moved = true;
    }
    const life = W.components.life[x.id];
    if (life) {
      life.behavior = "held";
      life.behaviorReason = `held in the cell of the hall until the sentence is served`;
    }
    return true;
  });
  if (moved) rebuildSpatialBins();
}
function jailed(id) {
  return !!W?.justice?.jailed?.some((x) => x.id === id);
}
const workerReadyForLaborJusticeBase = workerReadyForLabor;
workerReadyForLabor = function (id) {
  return !jailed(id) && workerReadyForLaborJusticeBase(id);
};
// A banished person found inside the polity before their time is up.
function watchForReturned() {
  for (const id of W.activeIds) {
    if (W.kind[id] !== KINDS.PERSON || !classifyAlive(id)) continue;
    const ident = W.components.identity[id];
    if (!ident?.banishedFrom || W.tick >= (ident.banishedUntil || 0) || civilOrderOf(id)) continue;
    const p = W.components.position[id],
      town = p ? nearestSettlement(idx(p.x, p.y), 6) : null;
    if (!town || town.factionId !== ident.banishedFrom) continue;
    if (
      ensureJustice().cases.some(
        (c) => c.offender === id && c.status === "open" && c.offence === "banishment",
      )
    )
      continue;
    openCase("banishment", id, 0, idx(p.x, p.y), 0);
    JUSTICE.returned++;
  }
}
// ── The law's eye ────────────────────────────────────────────────────────────
function lawRisk(id) {
  const p = W.components.position[id];
  if (!p) return 0;
  const town = nearestSettlement(idx(p.x, p.y), COURT_REACH),
    court = town ? courtOf(town) : null;
  if (!court) return 0;
  const watch = (W.militaryUnits || []).some(
      (u) =>
        u.active && u.factionId === court.faction.id && (u.memberIds || []).some(classifyAlive),
    )
      ? 0.2
      : 0,
    eyes = Math.min(
      0.3,
      entityAtRadius(idx(p.x, p.y), 4, KINDS.PERSON).filter((o) => o !== id && classifyAlive(o))
        .length * 0.06,
    );
  return 0.5 + watch + eyes;
}
function deterred(id, hunger) {
  if (hunger >= 90 || W.components.identity[id]?.traits?.includes("bold")) return false;
  if (lawRisk(id) < 0.6) return false;
  JUSTICE.deterred++;
  return true;
}
const robOfFoodJusticeBase = robOfFood;
robOfFood = function (id, victim, hunger) {
  if (deterred(id, hunger)) return null;
  return robOfFoodJusticeBase(id, victim, hunger);
};
const stealFoodJusticeBase = stealFood;
stealFood = function (id, settlement, cause = 0) {
  if (deterred(id, W.components.life[id]?.hunger || 0)) return 0;
  return stealFoodJusticeBase(id, settlement, cause);
};
// The courts judge robbery now; the moment's judgement of 99 stands down.
judgeRobbery = function () {
  return null;
};
// The community's banishment of a thrice-caught thief, where there is no law.
const updateExileJusticeBase = updateExile;
updateExile = function () {
  const lawful = W.settlements.filter((s) => !s.ruined && courtOf(s));
  if (!lawful.length) return updateExileJusticeBase();
  const saved = lawful.map((s) => [s, s.stability]);
  for (const s of lawful) s.stability = 1;
  try {
    return updateExileJusticeBase();
  } finally {
    for (const [s, v] of saved) s.stability = v;
  }
};
tickSystem("justice", function () {
  if (!W?.settlements) return;
  keepCells();
  holdCourts();
  if (W.tick % 32 === 21) watchForReturned();
  if (W.tick % 256 === 180) reviseLawCodes();
});
// ── What it says ─────────────────────────────────────────────────────────────
eventText(["VerdictEvent", "LawEvent"], function (e, next) {
  const d = e.data || {};
  if (e.type === "VerdictEvent")
    return d.verdict === "acquitted"
      ? `⚖️ ${d.name} was tried at ${d.place} for ${OFFENCE_WORD[d.offence] || d.offence} and let go for want of witnesses.`
      : `⚖️ ${d.name} was convicted at ${d.place} of ${OFFENCE_WORD[d.offence] || d.offence} under ${LAW_CODE_NAMES[d.code] || d.code}: ${d.punishment || "judged"}.`;
  if (e.type === "LawEvent" && d.revised)
    return `⚖️ ${d.polity} revised its law from ${LAW_CODE_NAMES[d.from] || d.from} to ${d.law}.`;
  if (e.type === "LawEvent" && LAW_CODE_NAMES[d.code])
    return `⚖️ ${d.polity} set down a law code: ${LAW_CODE_NAMES[d.code]}.`;
  return next(e);
});
const alertWorthyJusticeBase = alertWorthy;
alertWorthy = function (a) {
  return alertWorthyJusticeBase(a) || (a.type === "VerdictEvent" && (a.importance || 0) >= 3);
};
function casesOfYear(filter) {
  return (W.justice?.cases || []).filter((c) => W.tick - c.tick < TICKS_PER_YEAR && filter(c));
}
const renderFactionPageJusticeBase = renderFactionPage;
renderFactionPage = function (id) {
  const html = renderFactionPageJusticeBase(id),
    f = W.factions.find((x) => x.id === id);
  if (!f?.law) return html;
  const courts = W.settlements.filter(
      (s) => !s.ruined && s.factionId === f.id && courtOf(s),
    ).length,
    year = casesOfYear((c) =>
      c.court
        ? W.settlements.find((s) => s.id === c.court)?.factionId === f.id
        : W.settlements.find((s) => s.id === c.townId)?.factionId === f.id,
    ),
    cells = (W.justice?.jailed || []).filter(
      (x) => W.settlements.find((s) => s.id === x.townId)?.factionId === f.id,
    ).length;
  return html.replace(
    /<div class="kv"><span>Law<\/span><b>[^<]*<\/b><\/div>/,
    `<div class="kv" data-justice="${f.law.code}"><span>Law</span><b>${esc(LAW_CODE_NAMES[f.law.code] || f.law.code)} · ${courts} court${courts === 1 ? "" : "s"} · ${year.length} case${year.length === 1 ? "" : "s"} this year, ${year.filter((c) => c.status === "convicted").length} convicted · ${cells} in the cells</b></div>`,
  );
};
const renderPlacePageJusticeBase = renderPlacePage;
renderPlacePage = function (id) {
  const html = renderPlacePageJusticeBase(id),
    town = W.settlements.find((s) => s.id === id),
    court = town ? courtOf(town) : null;
  if (!court) return html;
  const cells = (W.justice?.jailed || []).filter((x) => x.townId === town.id),
    last = (W.justice?.cases || [])
      .filter((c) => c.court === town.id && c.status !== "open")
      .at(-1),
    row = `<div class="kv" data-court="${town.id}"><span>Court</span><b>sits at the ${esc(court.hall.name || "hall")} under ${esc(LAW_CODE_NAMES[court.code] || court.code)} · ${cells.length} in the cell${
      cells.length
        ? `: ${cells
            .map((x) => entityLink(x.id))
            .filter(Boolean)
            .join(", ")}`
        : ""
    }${last ? ` · last: ${esc(entityName(last.offender))} ${last.status} of ${esc(OFFENCE_WORD[last.offence] || last.offence)}${last.punishment ? `, ${esc(last.punishment)}` : ""}` : ""}</b></div>`,
    at = html.indexOf('<div class="subhead">');
  return at < 0 ? html + row : html.slice(0, at) + row + html.slice(at);
};
const organismInspectorJusticeBase = organismInspector;
organismInspector = function (id) {
  const html = organismInspectorJusticeBase(id);
  if (W.kind[id] !== KINDS.PERSON || !W.components.life[id]) return html;
  const ident = W.components.identity[id],
    cell = W.justice?.jailed?.find((x) => x.id === id),
    open = (W.justice?.cases || []).filter((c) => c.offender === id && c.status === "open");
  if (!ident?.record?.length && !cell && !open.length && !ident?.banishedFrom) return html;
  const lines = [
    ...(cell
      ? [
          `in the cell at ${esc(W.settlements.find((s) => s.id === cell.townId)?.name || "the hall")} for ${Math.max(1, Math.round((cell.until - W.tick) / CELL_MONTH))} more months`,
        ]
      : []),
    ...(ident.banishedFrom && W.tick < (ident.banishedUntil || 0)
      ? [
          `banished from ${esc(W.factions.find((f) => f.id === ident.banishedFrom)?.name || "a polity")}`,
        ]
      : []),
    ...open.map((c) => `wanted for ${esc(OFFENCE_WORD[c.offence] || c.offence)}`),
    ...(ident.record || [])
      .slice(-4)
      .map(
        (r) =>
          `${r.verdict} of ${esc(OFFENCE_WORD[r.offence] || r.offence)} at ${esc(r.court)}${r.punishment ? `: ${esc(r.punishment)}` : ""}`,
      ),
  ];
  const block = `<div class="subhead">Before the law</div><div class="kv" data-record="${ident.record?.length || 0}"><span>Record</span><b>${lines.join(" · ")}</b></div>`,
    at = html.indexOf("<details");
  return at < 0 ? html + block : html.slice(0, at) + block + html.slice(at);
};
window.ALIFE_JUSTICE_DEBUG = Object.freeze({
  counts: () => ({ ...JUSTICE }),
  cases: () => JSON.parse(JSON.stringify(W.justice?.cases || [])),
  jailed: () => JSON.parse(JSON.stringify(W.justice?.jailed || [])),
  open: (offence, offender, victim, tile) => openCase(offence, offender, victim, tile, 0),
  courts: () => holdCourts(),
  hold: (townId) => holdCourt(W.settlements.find((s) => s.id === townId)),
  returned: () => watchForReturned(),
  jailedNow: (id) => jailed(id),
  court: (townId) => {
    const c = courtOf(W.settlements.find((s) => s.id === townId));
    return c ? { code: c.code, hall: c.hall.id, faction: c.faction.id } : null;
  },
  code: (factionId) => lawCodeFor(W.factions.find((f) => f.id === factionId)),
  risk: (id) => lawRisk(id),
  cells: () => keepCells(),
  revise: () => reviseLawCodes(),
});
