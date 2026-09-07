// ═══════════════════════════════════════════════════════════════════════════
// 56. DIPLOMACY — envoys, tribute, vassals, and marriages between houses
// ═══════════════════════════════════════════════════════════════════════════
// Polities knew war, truce, and alliance. Now they send envoys: real people
// who walk from capital to capital carrying terms. A losing side offers
// tribute or bends the knee; a long, even war is offered peace; neighbours at
// peace offer a marriage between the Voices' kin, which moves a person across
// a border and leaves a claim on the other house. Tribute is paid yearly as
// real food carried by a caravan; vassals follow their overlord into war and
// are protected by them; claims speak up at successions and can bind two
// polities as one house or start a war of succession. Rendering only reads.
const DIPLOMACY_TERMS = Object.freeze({
  tribute: "tribute for peace",
  vassal: "submission as a vassal",
  peace: "peace",
  marriage: "a marriage between the houses",
});
const DIPLOMACY_REASONS = Object.freeze({
  envoy: "carrying terms to another polity",
  wedding: "travelling to be wed across the border",
});
function ensureDiplomacy(world = W) {
  if (!world) return;
  world.diplomacy = world.diplomacy || {
    treaties: [],
    envoys: [],
    marriages: [],
    nextId: 1,
    lastEventId: 0,
  };
  for (const f of world.factions || []) {
    f.claims = f.claims || [];
    f.vassalIds = f.vassalIds || [];
    if (f.overlordId == null) f.overlordId = 0;
  }
}
const restoreWorldDiplomacyBase = restoreWorldDefaults;
restoreWorldDefaults = function () {
  restoreWorldDiplomacyBase();
  ensureDiplomacy(W);
};
function diplomacyVisual(kind, tile, extra = {}) {
  const now = performance.now();
  UI.diplomacyVisuals = (UI.diplomacyVisuals || []).filter((x) => now - x.started < 9000);
  UI.diplomacyVisuals.push({ kind, tile, started: now, world: W, ...extra });
}
function factionById(id) {
  return W.factions.find((f) => f.id === id) || null;
}
function factionCapital(f) {
  if (!f) return null;
  return (
    W.settlements.find((s) => s.id === f.capitalSettlementId && !s.ruined) ||
    W.settlements.find((s) => f.settlementIds?.includes(s.id) && !s.ruined) ||
    null
  );
}
function factionPower(f) {
  return (f?.militaryStrength || 0) * (0.5 + (f?.cohesion || 0.5)) + (f?.population || 0) * 0.05;
}
function relationOf(a, b) {
  return (
    a.relations[b.id] ||
    (a.relations[b.id] = { status: "neutral", pressure: 0, grievance: 0, trade: 0 })
  );
}
function warBetween(a, b) {
  return (
    W.activeWars.find(
      (w) => !w.ended && ((w.a === a.id && w.b === b.id) || (w.a === b.id && w.b === a.id)),
    ) || null
  );
}
function livingFaction(f) {
  return !!f && f.stability > 0 && !!factionCapital(f);
}
// ── Dynastic candidates ────────────────────────────────────────────────────────
function voiceKin(f) {
  const capital = factionCapital(f);
  if (!capital || !f.leaderId) return [];
  const voice = W.components.identity[f.leaderId],
    voiceHouse = W.components.social[f.leaderId]?.kinGroupId,
    members = entityAtRadius(idx(capital.x, capital.y), 10, KINDS.PERSON).filter(
      (id) =>
        id !== f.leaderId &&
        classifyAlive(id) &&
        W.components.social[id]?.factionId === f.id &&
        !W.components.social[id].partnerId &&
        freeForCivilDuty(id) &&
        isAdultPerson(id),
    ),
    children = members.filter((id) => voice?.children?.includes(id)),
    house = members.filter((id) => W.components.social[id].kinGroupId === voiceHouse),
    // Failing kin of the blood, a person of standing stands for the house.
    standing = members
      .slice()
      .sort(
        (a, b) =>
          (W.components.identity[b]?.significance || 0) -
            (W.components.identity[a]?.significance || 0) || a - b,
      )
      .slice(0, 2);
  return children.length ? children : house.length ? house : standing;
}
// ── Envoys ─────────────────────────────────────────────────────────────────────
function activeEnvoyFrom(f) {
  return (
    W.diplomacy.envoys.find((e) => e.active && e.from === f.id && e.phase === "outbound") || null
  );
}
function sendEnvoy(from, to, proposal, terms = {}) {
  ensureDiplomacy();
  if (!livingFaction(from) || !livingFaction(to) || from === to || activeEnvoyFrom(from))
    return null;
  if (W.diplomacy.envoys.filter((e) => e.active).length >= 6) return null;
  const home = factionCapital(from),
    court = factionCapital(to),
    byLand =
      typeof civilReachable !== "function" || civilReachable(idx(home.x, home.y), court, from.id),
    bySea =
      !byLand &&
      factionHasTech(from.id, "navigation") &&
      factionHasTech(to.id, "navigation") &&
      civilReachable(idx(home.x, home.y), court, from.id, "sea");
  if (!byLand && !bySea) return null;
  const candidates = typeof caravanCandidates === "function" ? caravanCandidates(home, 3) : [];
  // The polity sends its most commanding free adult.
  candidates.sort(
    (a, b) =>
      (W.components.identity[b]?.skills?.lore || 0) +
        (W.components.social[b]?.dominance || 0) * 20 -
        (W.components.identity[a]?.skills?.lore || 0) -
        (W.components.social[a]?.dominance || 0) * 20 || a - b,
  );
  let person = candidates[0];
  if (!person) {
    // A polity at war still finds an envoy: the muster gives up its most
    // commanding free adult, and the civil order outranks the column.
    const voices = new Set(W.factions.map((f) => f.leaderId).filter(Boolean));
    person = entityAtRadius(idx(home.x, home.y), 6, KINDS.PERSON)
      .filter((id) => {
        const life = W.components.life[id],
          body = W.components.body[id];
        return (
          classifyAlive(id) &&
          life &&
          !voices.has(id) &&
          W.components.social[id]?.factionId === from.id &&
          !!W.components.campaign?.[id]?.warId &&
          !life.wounded &&
          life.hunger <= 70 &&
          life.age >= (body?.maxAge || 19200) * 0.2
        );
      })
      .sort(
        (a, b) =>
          (W.components.social[b]?.dominance || 0) - (W.components.social[a]?.dominance || 0) ||
          a - b,
      )[0];
    if (!person) return null;
  }
  const envoy = {
    id: W.diplomacy.nextId++,
    personId: person,
    from: from.id,
    to: to.id,
    proposal,
    terms,
    startedTick: W.tick,
    phase: "outbound",
    active: true,
    eventId: 0,
    sea: bySea,
  };
  W.diplomacy.envoys.push(envoy);
  issueCivilOrder(person, "envoy", court.x, court.y, {
    placeId: court.id,
    envoyId: envoy.id,
    sea: bySea,
  });
  const ev = emitEvent("EnvoyEvent", {
    subjects: [person, from.entityId, to.entityId],
    location: idx(home.x, home.y),
    factions: [from.id, to.id],
    causes: [warBetween(from, to)?.startEventId, W.lastEventByType.WarTensionEvent].filter(Boolean),
    evidence: [DIPLOMACY_TERMS[proposal] || proposal],
    importance: 2,
    data: {
      name: entityName(person),
      from: from.name,
      to: to.name,
      proposal,
      terms: DIPLOMACY_TERMS[proposal] || proposal,
    },
  });
  envoy.eventId = ev.id;
  if (typeof grantSkill === "function") grantSkill(person, "lore", 2, ev.id);
  return envoy;
}
function envoyArrived(envoy, place) {
  const p = W.components.position[envoy.personId];
  return !!p && !!place && Math.max(Math.abs(p.x - place.x), Math.abs(p.y - place.y)) <= 2;
}
function resolveEnvoy(envoy, force = null) {
  const from = factionById(envoy.from),
    to = factionById(envoy.to);
  if (!livingFaction(from) || !livingFaction(to)) return null;
  const roll = counterRand("envoy", envoy.id, W.tick),
    rel = relationOf(to, from),
    war = warBetween(from, to);
  let accept = false,
    result = null;
  switch (envoy.proposal) {
    case "tribute":
      accept = force ?? roll < 0.8;
      if (accept) result = makeTribute(from, to, envoy, war);
      break;
    case "vassal":
      accept = force ?? roll < 0.9;
      if (accept) result = makeVassal(from, to, envoy, war);
      break;
    case "peace": {
      const exhaustion = war
        ? Math.min(0.4, ((war.casualties || 0) / Math.max(1, to.population)) * 2)
        : 0;
      accept =
        force ??
        roll <
          0.45 +
            exhaustion +
            (to.weariness || 0) * 0.3 +
            (typeof polityHasTrait === "function" && polityHasTrait(to, "Peaceful") ? 0.25 : 0);
      if (accept) result = makePeace(from, to, envoy, war);
      break;
    }
    case "marriage":
      accept =
        force ??
        roll <
          0.5 +
            (rel.trade || 0) * 0.05 +
            (to.ethos?.hierarchical || 0) * 0.3 -
            (typeof polityHasTrait === "function" && polityHasTrait(to, "Isolationist") ? 0.3 : 0);
      if (accept) result = makeMarriage(from, to, envoy);
      break;
  }
  if (!result) {
    const court = factionCapital(to);
    emitEvent("TreatyRefusedEvent", {
      subjects: [envoy.personId, from.entityId, to.entityId],
      location: court ? idx(court.x, court.y) : -1,
      factions: [from.id, to.id],
      causes: [envoy.eventId].filter(Boolean),
      evidence: [accept ? "the terms could not be kept" : "the court would not hear them"],
      importance: 2,
      data: {
        from: from.name,
        to: to.name,
        terms: DIPLOMACY_TERMS[envoy.proposal] || envoy.proposal,
      },
    });
    if (court) diplomacyVisual("refusal", idx(court.x, court.y));
  }
  return result;
}
function updateEnvoys() {
  for (const envoy of W.diplomacy.envoys) {
    if (!envoy.active) continue;
    const from = factionById(envoy.from),
      to = factionById(envoy.to),
      home = factionCapital(from),
      court = factionCapital(to),
      alive = classifyAlive(envoy.personId) && !!W.components.position[envoy.personId];
    if (!alive || !home || !court || !livingFaction(from) || !livingFaction(to)) {
      if (alive) clearCivilOrder(envoy.personId);
      envoy.active = false;
      envoy.endedTick = W.tick;
      continue;
    }
    if (envoy.phase === "outbound") {
      if (envoyArrived(envoy, court)) {
        resolveEnvoy(envoy);
        envoy.phase = "return";
        envoy.resolvedTick = W.tick;
        issueCivilOrder(envoy.personId, "envoy", home.x, home.y, {
          placeId: home.id,
          envoyId: envoy.id,
          sea: !!envoy.sea,
        });
      } else if (W.tick - envoy.startedTick > 1400) {
        emitEvent("EnvoyLostEvent", {
          subjects: [envoy.personId, from.entityId, to.entityId],
          location: idx(court.x, court.y),
          factions: [from.id, to.id],
          causes: [envoy.eventId].filter(Boolean),
          evidence: ["the road proved too long"],
          importance: 2,
          data: { name: entityName(envoy.personId), from: from.name, to: to.name },
        });
        clearCivilOrder(envoy.personId);
        envoy.active = false;
        envoy.endedTick = W.tick;
      }
    } else if (envoyArrived(envoy, home) || W.tick - (envoy.resolvedTick || W.tick) > 1400) {
      clearCivilOrder(envoy.personId);
      W.components.identity[envoy.personId].significance += 2;
      envoy.active = false;
      envoy.endedTick = W.tick;
    }
  }
  if (W.diplomacy.envoys.length > 40)
    W.diplomacy.envoys = W.diplomacy.envoys
      .filter((e) => e.active)
      .concat(W.diplomacy.envoys.filter((e) => !e.active).slice(-12));
}
// ── Treaties ───────────────────────────────────────────────────────────────────
function activeTreaty(kind, a, b) {
  return (
    W.diplomacy.treaties.find(
      (t) =>
        t.active &&
        t.kind === kind &&
        ((t.a === a.id && t.b === b.id) || (t.a === b.id && t.b === a.id)),
    ) || null
  );
}
function bindPeace(a, b, years, war, reason) {
  if (war) endWar(war, a, b, reason);
  const until = W.tick + TICKS_PER_YEAR * years;
  for (const [x, y] of [
    [a, b],
    [b, a],
  ]) {
    const rel = relationOf(x, y);
    rel.status = "truce";
    rel.truceUntil = Math.max(rel.truceUntil || 0, until);
    rel.pressure = Math.min(rel.pressure || 0, 30);
    rel.mobilizeSince = 0;
  }
  return until;
}
function makeTribute(payer, receiver, envoy, war) {
  const home = factionCapital(payer),
    court = factionCapital(receiver);
  if (!home || !court) return null;
  const amount = clamp(Math.round(settlementPopulation(home) * 1.5), 12, 60),
    years = 8,
    until = bindPeace(payer, receiver, years, war, "tribute bought peace"),
    treaty = {
      id: W.diplomacy.nextId++,
      kind: "tribute",
      a: payer.id,
      b: receiver.id,
      amount,
      started: W.tick,
      until,
      paid: 0,
      defaults: 0,
      active: true,
      eventId: 0,
    };
  W.diplomacy.treaties.push(treaty);
  const ev = emitEvent("TreatyEvent", {
    subjects: [envoy?.personId, payer.entityId, receiver.entityId].filter(Boolean),
    location: idx(court.x, court.y),
    factions: [payer.id, receiver.id],
    causes: [envoy?.eventId, war?.startEventId].filter(Boolean),
    evidence: [`${amount} measures of food a year`, `${years} years`],
    importance: 4,
    data: { kind: "tribute", a: payer.name, b: receiver.name, amount, years, war: !!war },
  });
  treaty.eventId = ev.id;
  diplomacyVisual("treaty", idx(court.x, court.y), {
    tiles: [idx(home.x, home.y), idx(court.x, court.y)],
  });
  return ev;
}
function makeVassal(vassal, overlord, envoy, war) {
  if (vassal.overlordId || overlord.overlordId === vassal.id) return null;
  const tribute = makeTribute(vassal, overlord, envoy, war);
  if (!tribute) return null;
  vassal.overlordId = overlord.id;
  if (!overlord.vassalIds.includes(vassal.id)) overlord.vassalIds.push(vassal.id);
  const treaty = {
    id: W.diplomacy.nextId++,
    kind: "vassal",
    a: vassal.id,
    b: overlord.id,
    started: W.tick,
    until: Infinity,
    active: true,
    eventId: 0,
  };
  W.diplomacy.treaties.push(treaty);
  addRelation(vassal.entityId, overlord.entityId, "vassal_of", 1);
  const court = factionCapital(overlord),
    ev = emitEvent("VassalageEvent", {
      subjects: [envoy?.personId, vassal.entityId, overlord.entityId].filter(Boolean),
      location: court ? idx(court.x, court.y) : -1,
      factions: [vassal.id, overlord.id],
      causes: [tribute.id],
      evidence: ["the weaker polity bent the knee", "tribute and protection"],
      importance: 5,
      data: { a: vassal.name, b: overlord.name },
    });
  treaty.eventId = ev.id;
  return ev;
}
function makePeace(a, b, envoy, war) {
  if (!war) return null;
  bindPeace(a, b, 4, war, "peace made by envoy");
  const court = factionCapital(b),
    ev = emitEvent("TreatyEvent", {
      subjects: [envoy?.personId, a.entityId, b.entityId].filter(Boolean),
      location: court ? idx(court.x, court.y) : -1,
      factions: [a.id, b.id],
      causes: [envoy?.eventId, war.startEventId].filter(Boolean),
      evidence: ["four years of truce", `${war.casualties || 0} dead in the war`],
      importance: 4,
      data: { kind: "peace", a: a.name, b: b.name, envoy: envoy ? entityName(envoy.personId) : "" },
    });
  W.diplomacy.treaties.push({
    id: W.diplomacy.nextId++,
    kind: "peace",
    a: a.id,
    b: b.id,
    started: W.tick,
    until: W.tick + TICKS_PER_YEAR * 4,
    active: true,
    eventId: ev.id,
  });
  if (court) diplomacyVisual("treaty", idx(court.x, court.y));
  return ev;
}
function makeMarriage(from, to, envoy) {
  const bride = voiceKin(from)[0],
    groom = voiceKin(to)[0];
  if (!bride || !groom) return null;
  const bond = formLoveBond(bride, groom);
  if (!bond) return null;
  const court = factionCapital(to),
    home = factionCapital(from),
    marriage = {
      id: W.diplomacy.nextId++,
      a: bride,
      b: groom,
      from: from.id,
      to: to.id,
      tick: W.tick,
      eventId: 0,
      settled: false,
    };
  W.diplomacy.marriages.push(marriage);
  from.claims.push({ on: to.id, personId: bride, marriageId: marriage.id, tick: W.tick });
  for (const id of [bride, groom]) {
    const ident = W.components.identity[id];
    ident.significance += 5;
    ident.notable = true;
  }
  W.components.identity[bride].titles.push(`Wed into ${to.name}`);
  W.components.identity[groom].titles.push(`Wed to the house of ${from.name}`);
  issueCivilOrder(bride, "wedding", court.x, court.y, {
    placeId: court.id,
    marriageId: marriage.id,
    sea: !!envoy?.sea,
  });
  const ev = emitEvent("RoyalMarriageEvent", {
    subjects: [bride, groom, from.entityId, to.entityId],
    location: idx(court.x, court.y),
    factions: [from.id, to.id],
    causes: [envoy?.eventId, bond.id].filter(Boolean),
    evidence: ["kin of both Voices", "a claim now rests on the other house"],
    importance: 4,
    data: { a: entityName(bride), b: entityName(groom), from: from.name, to: to.name },
  });
  marriage.eventId = ev.id;
  for (const [x, y] of [
    [from, to],
    [to, from],
  ]) {
    const rel = relationOf(x, y);
    rel.pressure = Math.min(rel.pressure || 0, 20);
    rel.grievance = +((rel.grievance || 0) * 0.5).toFixed(3);
  }
  diplomacyVisual("marriage", idx(court.x, court.y), {
    tiles: [home ? idx(home.x, home.y) : idx(court.x, court.y), idx(court.x, court.y)],
  });
  return ev;
}
// The travelling spouse settles into the other polity when they arrive.
function updateMarriages() {
  for (const m of W.diplomacy.marriages) {
    if (m.settled) continue;
    const to = factionById(m.to),
      court = factionCapital(to),
      soc = W.components.social[m.a];
    if (!soc || !classifyAlive(m.a) || !court) {
      m.settled = true;
      continue;
    }
    const p = W.components.position[m.a],
      arrived = p && Math.max(Math.abs(p.x - court.x), Math.abs(p.y - court.y)) <= 2;
    if (arrived || W.tick - m.tick > 1600) {
      clearCivilOrder(m.a);
      if (arrived) soc.factionId = to.id;
      m.settled = true;
    }
  }
}
// ── Yearly tribute, carried as real food ───────────────────────────────────────
function payTributes() {
  for (const t of W.diplomacy.treaties) {
    if (!t.active || t.kind !== "tribute") continue;
    const payer = factionById(t.a),
      receiver = factionById(t.b),
      home = factionCapital(payer),
      court = factionCapital(receiver);
    if (!livingFaction(payer) || !livingFaction(receiver) || !home || !court) {
      endTreaty(t, "one of the polities fell");
      continue;
    }
    if (W.tick >= t.until) {
      endTreaty(t, "its term was served");
      continue;
    }
    const moved = resolveTransfer({
      fromType: "settlement",
      from: home.id,
      toType: "settlement",
      to: court.id,
      amounts: [[C.ORGANIC, t.amount]],
    });
    if (moved >= t.amount * 0.5) {
      t.paid += moved;
      emitEvent("TributeEvent", {
        subjects: [payer.entityId, receiver.entityId],
        location: idx(court.x, court.y),
        factions: [payer.id, receiver.id],
        causes: [t.eventId].filter(Boolean),
        evidence: [`${moved} units of food moved from store to store`],
        importance: 2,
        data: { a: payer.name, b: receiver.name, amount: moved },
      });
      if (typeof spawnCaravan === "function" && dist2(home.x, home.y, court.x, court.y) >= 36) {
        const caravan = spawnCaravan(home, court, null, C.ORGANIC, moved);
        if (caravan) caravan.tribute = true;
      }
    } else {
      t.defaults++;
      emitEvent("TributeDefaultEvent", {
        subjects: [payer.entityId, receiver.entityId],
        location: idx(home.x, home.y),
        factions: [payer.id, receiver.id],
        causes: [t.eventId].filter(Boolean),
        evidence: [`only ${moved} of ${t.amount} could be paid`, `${t.defaults} defaults`],
        importance: 3,
        data: { a: payer.name, b: receiver.name, amount: t.amount, defaults: t.defaults },
      });
      relationOf(receiver, payer).grievance += 10;
      relationOf(payer, receiver).grievance += 4;
      if (t.defaults >= 2) {
        endTreaty(t, "the tribute went unpaid");
        relationOf(receiver, payer).status = "hostile";
        relationOf(payer, receiver).status = "hostile";
        relationOf(receiver, payer).truceUntil = relationOf(payer, receiver).truceUntil = 0;
      }
    }
  }
}
function endTreaty(t, reason, importance = 3) {
  if (!t.active) return null;
  t.active = false;
  t.endedTick = W.tick;
  const a = factionById(t.a),
    b = factionById(t.b);
  if (t.kind === "vassal") {
    if (a) a.overlordId = 0;
    if (b) b.vassalIds = (b.vassalIds || []).filter((id) => id !== t.a);
    if (a && b) removeRelation(a.entityId, b.entityId, "vassal_of");
  }
  const court = factionCapital(b) || factionCapital(a);
  return emitEvent("TreatyEndedEvent", {
    subjects: [a?.entityId, b?.entityId].filter(Boolean),
    location: court ? idx(court.x, court.y) : -1,
    factions: [t.a, t.b],
    causes: [t.eventId].filter(Boolean),
    evidence: [reason],
    importance,
    data: {
      kind: t.kind,
      a: a?.name || "a fallen polity",
      b: b?.name || "a fallen polity",
      reason,
    },
  });
}
// ── Vassals: following into war, protection, independence ──────────────────────
function enforceTreaties() {
  for (const t of W.diplomacy.treaties) {
    if (!t.active) continue;
    const a = factionById(t.a),
      b = factionById(t.b);
    if (!livingFaction(a) || !livingFaction(b)) {
      endTreaty(t, "one of the polities fell");
      continue;
    }
    if (t.kind === "peace" && W.tick >= t.until) {
      endTreaty(t, "its term was served", 2);
      continue;
    }
    if (t.kind !== "vassal") continue;
    const vassal = a,
      overlord = b;
    if (
      factionPower(vassal) > factionPower(overlord) * 1.4 &&
      counterRand("independence", t.id, Math.floor(W.tick / 128)) < 0.3
    ) {
      declareIndependence(t, vassal, overlord);
      continue;
    }
    for (const war of W.activeWars) {
      if (war.ended) continue;
      const overlordAt = war.a === overlord.id ? war.b : war.b === overlord.id ? war.a : 0,
        vassalAt = war.a === vassal.id ? war.b : war.b === vassal.id ? war.a : 0;
      if (overlordAt && overlordAt !== vassal.id) {
        const enemy = factionById(overlordAt);
        if (enemy) {
          const rel = relationOf(vassal, enemy);
          if (rel.status === "neutral" || rel.status === "truce") rel.status = "hostile";
          rel.pressure = Math.max(rel.pressure || 0, 70);
          rel.truceUntil = 0;
          if (!vassal.rivals.includes(enemy.id)) vassal.rivals.push(enemy.id);
        }
      }
      if (vassalAt && vassalAt !== overlord.id) {
        const attacker = factionById(vassalAt);
        if (attacker) {
          const rel = relationOf(overlord, attacker);
          rel.grievance = +((rel.grievance || 0) + 6).toFixed(3);
          rel.pressure = Math.max(rel.pressure || 0, 70);
          if (rel.status === "neutral" || rel.status === "truce") rel.status = "hostile";
          rel.truceUntil = 0;
        }
      }
    }
  }
}
function declareIndependence(t, vassal, overlord) {
  t.active = false;
  t.endedTick = W.tick;
  vassal.overlordId = 0;
  overlord.vassalIds = (overlord.vassalIds || []).filter((id) => id !== vassal.id);
  removeRelation(vassal.entityId, overlord.entityId, "vassal_of");
  for (const tribute of W.diplomacy.treaties)
    if (
      tribute.active &&
      tribute.kind === "tribute" &&
      tribute.a === vassal.id &&
      tribute.b === overlord.id
    )
      endTreaty(tribute, "the vassal threw off its overlord", 2);
  relationOf(vassal, overlord).grievance += 8;
  relationOf(overlord, vassal).grievance += 15;
  relationOf(overlord, vassal).pressure = Math.max(relationOf(overlord, vassal).pressure || 0, 60);
  const home = factionCapital(vassal);
  return emitEvent("IndependenceEvent", {
    subjects: [vassal.entityId, overlord.entityId],
    location: home ? idx(home.x, home.y) : -1,
    factions: [vassal.id, overlord.id],
    causes: [t.eventId].filter(Boolean),
    evidence: [
      `strength ${Math.round(factionPower(vassal))} against ${Math.round(factionPower(overlord))}`,
    ],
    importance: 4,
    data: { a: vassal.name, b: overlord.name },
  });
}
// ── Proposals ──────────────────────────────────────────────────────────────────
function considerProposals() {
  const cycle = Math.floor(W.tick / 128);
  for (const war of W.activeWars) {
    if (war.ended || war.turns < 2 || W.tick - war.started < TICKS_PER_YEAR) continue;
    const a = factionById(war.a),
      b = factionById(war.b);
    if (!livingFaction(a) || !livingFaction(b)) continue;
    const pa = factionPower(a),
      pb = factionPower(b),
      ratio = pa / Math.max(0.01, pb),
      weaker = ratio < 1 ? a : b,
      stronger = weaker === a ? b : a,
      weakRatio = Math.min(ratio, 1 / ratio);
    if (weakRatio < 0.7) {
      if (counterRand("sue", war.id, cycle) < 0.5)
        sendEnvoy(weaker, stronger, weakRatio < 0.4 && !weaker.overlordId ? "vassal" : "tribute");
    } else if (W.tick - war.started > TICKS_PER_YEAR * 2 && (war.casualties || 0) > 0) {
      if (counterRand("peace", war.id, cycle) < 0.35) sendEnvoy(weaker, stronger, "peace");
    }
  }
  for (const f of W.factions) {
    if (!livingFaction(f) || activeEnvoyFrom(f) || !f.leaderId) continue;
    if (typeof polityHasTrait === "function" && polityHasTrait(f, "Isolationist")) continue;
    if (counterRand("court", f.id, cycle) > 0.12) continue;
    const home = factionCapital(f);
    let best = null,
      bd = Infinity;
    for (const g of W.factions) {
      if (g === f || !livingFaction(g) || !g.leaderId || warBetween(f, g)) continue;
      const rel = f.relations[g.id];
      if (rel && (rel.status === "hostile" || rel.status === "mobilizing")) continue;
      if (!factionsHaveContact(f, g)) continue;
      if (
        W.diplomacy.marriages.some(
          (m) =>
            ((m.from === f.id && m.to === g.id) || (m.from === g.id && m.to === f.id)) &&
            W.tick - m.tick < TICKS_PER_YEAR * 20,
        )
      )
        continue;
      const court = factionCapital(g),
        d = dist2(home.x, home.y, court.x, court.y);
      if (d < bd) {
        bd = d;
        best = g;
      }
    }
    if (best && voiceKin(f).length && voiceKin(best).length) sendEnvoy(f, best, "marriage");
  }
}
// ── Claims at successions ──────────────────────────────────────────────────────
function inheritClaims() {
  for (const f of W.factions) {
    if (!f.claims?.length) continue;
    f.claims = f.claims
      .map((c) => {
        if (classifyAlive(c.personId)) return c;
        const heir = (
          W.components.identity[c.personId] || W.historicalIdentities?.[c.personId]
        )?.children?.find((id) => classifyAlive(id));
        return heir ? { ...c, personId: heir, inherited: true } : null;
      })
      .filter(Boolean);
  }
}
function claimAtSuccession(f, leader, successionEvent) {
  for (const claimant of W.factions) {
    if (claimant === f || !livingFaction(claimant)) continue;
    const claim = claimant.claims?.find((c) => c.on === f.id && classifyAlive(c.personId));
    if (!claim) continue;
    const person = claim.personId,
      parents = W.components.identity[leader]?.parents || [],
      ofTheBlood = leader === person || parents.includes(person),
      capital = factionCapital(f);
    if (ofTheBlood) {
      claimant.claims = claimant.claims.filter((c) => c !== claim);
      for (const [x, y] of [
        [claimant, f],
        [f, claimant],
      ]) {
        const rel = relationOf(x, y);
        rel.status = "allied";
        rel.pressure = 0;
        rel.grievance = 0;
        rel.truceUntil = 0;
        if (!x.allies.includes(y.id)) x.allies.push(y.id);
        x.rivals = (x.rivals || []).filter((id) => id !== y.id);
      }
      addRelation(claimant.entityId, f.entityId, "allied_with", 1);
      addRelation(f.entityId, claimant.entityId, "allied_with", 1);
      W.components.identity[leader].significance += 8;
      W.components.identity[leader].titles.push(`Of the blood of ${claimant.name}`);
      emitEvent("DynasticUnionEvent", {
        subjects: [leader, f.entityId, claimant.entityId],
        location: capital ? idx(capital.x, capital.y) : -1,
        factions: [f.id, claimant.id],
        causes: [
          successionEvent?.id,
          claim.marriageId && W.diplomacy.marriages.find((m) => m.id === claim.marriageId)?.eventId,
        ].filter(Boolean),
        evidence: ["the new Voice carries the blood of both houses"],
        importance: 5,
        data: { leader: entityName(leader), a: claimant.name, b: f.name },
      });
      if (capital) diplomacyVisual("union", idx(capital.x, capital.y));
      continue;
    }
    const proud = ["proud", "bold"].some((t) => W.components.identity[person]?.traits?.includes(t));
    for (const [x, y, g] of [
      [claimant, f, 20],
      [f, claimant, 12],
    ]) {
      const rel = relationOf(x, y);
      rel.grievance = +((rel.grievance || 0) + g).toFixed(3);
      rel.pressure = Math.min(200, (rel.pressure || 0) + 25 + (proud ? 20 : 0));
      if (rel.status === "allied") {
        rel.status = "neutral";
        x.allies = x.allies.filter((id) => id !== y.id);
      }
    }
    removeRelation(claimant.entityId, f.entityId, "allied_with");
    removeRelation(f.entityId, claimant.entityId, "allied_with");
    emitEvent("SuccessionClaimEvent", {
      subjects: [person, leader, claimant.entityId, f.entityId],
      location: capital ? idx(capital.x, capital.y) : -1,
      factions: [claimant.id, f.id],
      causes: [successionEvent?.id].filter(Boolean),
      evidence: [
        proud ? "a proud claimant pressed hard" : "the claim was pressed",
        `grievance now ${Math.round(relationOf(claimant, f).grievance)}`,
      ],
      importance: 4,
      data: {
        a: claimant.name,
        b: f.name,
        claimant: entityName(person),
        leader: entityName(leader),
      },
    });
  }
}
function scanDiplomacyEvents() {
  const since = W.diplomacy.lastEventId || 0,
    fresh = [];
  for (let n = W.events.length - 1; n >= 0; n--) {
    const e = W.events[n];
    if (e.id <= since) break;
    if (e.type === "SuccessionEvent" || e.type === "LeadershipEvent") fresh.push(e);
  }
  if (W.events.length) W.diplomacy.lastEventId = W.events[W.events.length - 1].id;
  fresh.reverse();
  for (const e of fresh) {
    const f = factionById(e.factions?.[0]),
      leader = e.subjects?.[0];
    if (f && leader && W.components.identity[leader]) claimAtSuccession(f, leader, e);
  }
}
function updateDiplomacy() {
  ensureDiplomacy();
  updateEnvoys();
  updateMarriages();
  inheritClaims();
  scanDiplomacyEvents();
  enforceTreaties();
  considerProposals();
}
const updateWeatherCycleDiplomacyBase = updateWeatherCycle;
updateWeatherCycle = function () {
  updateWeatherCycleDiplomacyBase();
  if (!W?.factions || !W.activeWars) return;
  ensureDiplomacy(W);
  if (W.tick % 16 === 12) {
    updateEnvoys();
    updateMarriages();
  }
  if (W.tick % 128 === 96) updateDiplomacy();
  if (W.tick % TICKS_PER_YEAR === 128) payTributes();
};
const chooseBehaviorDiplomacyBase = chooseBehavior;
chooseBehavior = function (id, tier) {
  chooseBehaviorDiplomacyBase(id, tier);
  const l = W.components.life[id];
  if (l?.behavior === "march") {
    const order = civilOrderOf(id);
    if (order && DIPLOMACY_REASONS[order.kind]) l.behaviorReason = DIPLOMACY_REASONS[order.kind];
  }
};
// ── Chronicle sentences ────────────────────────────────────────────────────────
const eventSentenceDiplomacyBase = eventSentence;
eventSentence = function (e) {
  const d = e.data || {};
  switch (e.type) {
    case "EnvoyEvent":
      return `${d.name} set out from ${d.from} to ${d.to} bearing terms of ${d.terms}.`;
    case "EnvoyLostEvent":
      return `${d.name}, envoy of ${d.from}, never reached ${d.to}.`;
    case "TreatyEvent":
      return d.kind === "tribute"
        ? `${d.a} agreed to pay ${d.b} ${d.amount} measures of food each year for ${d.years} years${d.war ? ", and the war ended" : ""}.`
        : `${d.a} and ${d.b} made peace${d.envoy ? ` through ${d.envoy}'s embassy` : ""}.`;
    case "TreatyRefusedEvent":
      return `${d.to} refused ${d.from}'s offer of ${d.terms}.`;
    case "VassalageEvent":
      return `${d.a} bent the knee to ${d.b} and became its vassal.`;
    case "IndependenceEvent":
      return `${d.a} threw off the overlordship of ${d.b}.`;
    case "RoyalMarriageEvent":
      return `${d.a} of ${d.from} was wed to ${d.b} of ${d.to}, joining the houses of two polities.`;
    case "SuccessionClaimEvent":
      return `${d.a} claimed a voice in the succession of ${d.b} through ${d.claimant}, against ${d.leader}.`;
    case "DynasticUnionEvent":
      return `${d.leader}, of the blood of both ${d.a} and ${d.b}, took the Voice of ${d.b}; the polities are bound as one house.`;
    case "TributeEvent":
      return `${d.a} sent ${d.amount} measures of food to ${d.b} in tribute.`;
    case "TributeDefaultEvent":
      return `${d.a} failed to pay its tribute to ${d.b}${d.defaults > 1 ? " again" : ""}.`;
    case "TreatyEndedEvent":
      return `The ${d.kind === "vassal" ? "vassalage" : d.kind === "peace" ? "peace" : "tribute"} between ${d.a} and ${d.b} ended: ${d.reason}.`;
    default:
      return eventSentenceDiplomacyBase(e);
  }
};
// ── Legends ────────────────────────────────────────────────────────────────────
function diplomacySection(f) {
  ensureDiplomacy();
  const treaties = W.diplomacy.treaties.filter((t) => t.active && (t.a === f.id || t.b === f.id)),
    marriages = W.diplomacy.marriages.filter((m) => m.from === f.id || m.to === f.id),
    envoys = W.diplomacy.envoys.filter((e) => e.active && (e.from === f.id || e.to === f.id)),
    claimsOut = (f.claims || [])
      .map((c) => ({ ...c, other: factionById(c.on) }))
      .filter((c) => c.other),
    claimsIn = W.factions.filter((g) => g !== f && g.claims?.some((c) => c.on === f.id)),
    overlord = f.overlordId ? factionById(f.overlordId) : null,
    vassals = (f.vassalIds || []).map(factionById).filter(Boolean),
    rows = [];
  if (overlord) rows.push(`<span>Overlord</span><b>${factionLink(overlord.id)}</b>`);
  if (vassals.length)
    rows.push(`<span>Vassals</span><b>${vassals.map((v) => factionLink(v.id)).join(", ")}</b>`);
  for (const t of treaties) {
    if (t.kind === "vassal") continue;
    const other = factionById(t.a === f.id ? t.b : t.a);
    if (!other) continue;
    rows.push(
      `<span>${t.kind === "tribute" ? (t.a === f.id ? "Pays tribute" : "Receives tribute") : "Peace"}</span><b>${factionLink(other.id)}${
        t.kind === "tribute"
          ? ` · ${t.amount} a year until Year ${formatYear(t.until)} · ${t.paid} paid`
          : ` · until Year ${formatYear(t.until)}`
      }</b>`,
    );
  }
  for (const m of marriages.slice(-4))
    rows.push(
      `<span>Marriage</span><b>${lifeLink(m.a) || esc(entityName(m.a))} and ${lifeLink(m.b) || esc(entityName(m.b))} · Year ${formatYear(m.tick)}</b>`,
    );
  for (const c of claimsOut)
    rows.push(
      `<span>Claim on</span><b>${factionLink(c.other.id)} through ${lifeLink(c.personId) || esc(entityName(c.personId))}</b>`,
    );
  for (const g of claimsIn) rows.push(`<span>Claimed by</span><b>${factionLink(g.id)}</b>`);
  for (const e of envoys) {
    const other = factionById(e.from === f.id ? e.to : e.from);
    if (other)
      rows.push(
        `<span>Envoy</span><b>${lifeLink(e.personId) || esc(entityName(e.personId))} · ${e.from === f.id ? "to" : "from"} ${factionLink(other.id)} · ${esc(DIPLOMACY_TERMS[e.proposal] || e.proposal)}</b>`,
      );
  }
  return `<div class="subhead">Diplomacy</div>${rows.length ? `<div class="kv">${rows.join("")}</div>` : `<div class="empty">No treaties, marriages, or envoys.</div>`}`;
}
const renderFactionPageDiplomacyBase = renderFactionPage;
renderFactionPage = function (id) {
  const html = renderFactionPageDiplomacyBase(id),
    f = factionById(id);
  if (!f) return html;
  const at = html.indexOf('<div class="subhead">Voices</div>');
  return at < 0
    ? html + diplomacySection(f)
    : html.slice(0, at) + diplomacySection(f) + html.slice(at);
};
// ── Drawing ────────────────────────────────────────────────────────────────────
// Envoys carry a swaying pennant; travelling spouses walk in a ring of petals;
// tribute caravans shoulder gold-tinted bundles; a vassal capital flies its
// overlord's pennant above its own; treaties, marriages, and unions ring the
// court in light, refusals in grey.
function drawPennant(s, h, color, ribbon = "") {
  ctx.strokeStyle = "#2c2620";
  ctx.lineWidth = Math.max(1, h * 0.06);
  ctx.beginPath();
  ctx.moveTo(s.x, s.y);
  ctx.lineTo(s.x, s.y - h);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(s.x, s.y - h);
  ctx.lineTo(s.x + h * 0.55, s.y - h * 0.82);
  ctx.lineTo(s.x, s.y - h * 0.64);
  ctx.closePath();
  ctx.fill();
  if (ribbon) {
    ctx.strokeStyle = ribbon;
    ctx.lineWidth = Math.max(1, h * 0.05);
    ctx.beginPath();
    ctx.moveTo(s.x, s.y - h * 0.6);
    ctx.lineTo(s.x + h * 0.35, s.y - h * 0.45);
    ctx.stroke();
  }
}
const drawWorkerActivityDiplomacyBase = drawWorkerActivity;
drawWorkerActivity = function (now, bounds) {
  drawWorkerActivityDiplomacyBase(now, bounds);
  if (UI.quality === "low" || !W.diplomacy) return;
  const m = ACTIVE_RENDER_METRICS || projectionMetrics(),
    v = ACTIVE_PLANET_VISUAL || makePlanetVisualGenome(),
    still = ACTIVE_REDUCED_MOTION,
    clock = performance.now(),
    inView = (p) =>
      p &&
      p.x >= bounds.x0 - 1 &&
      p.x <= bounds.x1 + 1 &&
      p.y >= bounds.y0 - 1 &&
      p.y <= bounds.y1 + 1;
  if (UI.camera.zoom >= 1.4) {
    for (const order of W.civilOrders || []) {
      if (order.kind !== "envoy" && order.kind !== "wedding") continue;
      const p = W.components.position[order.id];
      if (!inView(p) || W.components.life[order.id]?.insideBuildingId) continue;
      const s = visualAnchor(order.id, p, m, now).s,
        r = clamp(m.tw * 0.3, 3, 40),
        f = factionById(W.components.social[order.id]?.factionId);
      if (order.kind === "envoy") {
        const sway = still ? 0 : Math.sin(now * 0.005 + order.id) * r * 0.12;
        drawPennant(
          { x: s.x + r * 0.7 + sway, y: s.y - r * 0.4 },
          r * 2.2,
          f?.color || "#d8c184",
          "#f4f1e6",
        );
      } else {
        ctx.fillStyle = hsl(v.accentHue, 75, 78, 0.8);
        for (let k = 0; k < 6; k++) {
          const a = (still ? 0 : now * 0.002) + (k * Math.PI) / 3 + order.id,
            rr = r * (1.1 + (still ? 0 : 0.15 * Math.sin(now * 0.004 + k)));
          ctx.beginPath();
          ctx.ellipse(
            s.x + Math.cos(a) * rr,
            s.y - r * 0.6 + Math.sin(a) * rr * 0.5,
            Math.max(1, r * 0.1),
            Math.max(0.7, r * 0.06),
            a,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
      }
    }
    for (const caravan of W.caravans || []) {
      if (!caravan.active || !caravan.tribute) continue;
      for (const id of caravan.members) {
        const p = W.components.position[id];
        if (!inView(p)) continue;
        const s = visualAnchor(id, p, m, now).s,
          r = clamp(m.tw * 0.3, 3, 40);
        ctx.fillStyle = hsl(44, 70, 60);
        ctx.strokeStyle = hsl(36, 50, 25);
        ctx.lineWidth = 1;
        ctx.fillRect(s.x - r * 0.55, s.y - r * 1.5, r * 1.1, r * 0.7);
        ctx.strokeRect(s.x - r * 0.55, s.y - r * 1.5, r * 1.1, r * 0.7);
      }
    }
  }
  if (UI.camera.zoom >= 1.1) {
    for (const f of W.factions) {
      if (!f.overlordId) continue;
      const capital = factionCapital(f),
        overlord = factionById(f.overlordId);
      if (
        !capital ||
        !overlord ||
        capital.x < bounds.x0 ||
        capital.x > bounds.x1 ||
        capital.y < bounds.y0 ||
        capital.y > bounds.y1
      )
        continue;
      const s = proceduralProjectTile(capital.x + 0.5, capital.y - 0.4, m),
        h = Math.max(14, m.tw * 0.7);
      drawPennant({ x: s.x, y: s.y }, h, overlord.color || "#d8c184");
      ctx.fillStyle = f.color || "#d8c184";
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - h * 0.55);
      ctx.lineTo(s.x + h * 0.4, s.y - h * 0.42);
      ctx.lineTo(s.x, s.y - h * 0.3);
      ctx.closePath();
      ctx.fill();
    }
  }
  for (const d of (UI.diplomacyVisuals || []).filter(
    (x) => x.world === W && clock - x.started < 6000 && x.tile >= 0 && x.tile < W.tileCount,
  )) {
    const age = clamp((clock - d.started) / 6000, 0, 1),
      [tx, ty] = xy(d.tile),
      p = proceduralProjectTile(tx + 0.5, ty + 0.5, m),
      hue =
        d.kind === "marriage"
          ? v.accentHue
          : d.kind === "union"
            ? 46
            : d.kind === "refusal"
              ? 0
              : 52,
      sat = d.kind === "refusal" ? 0 : 80;
    ctx.strokeStyle = hsl(hue, sat, 82, (1 - age) * 0.7);
    ctx.lineWidth = 2;
    for (let n = 1; n <= 2; n++) {
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, m.tw * age * 5 * n * 0.5, m.th * age * 5 * n * 0.3, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (d.tiles?.length === 2 && d.kind !== "refusal") {
      const [a, b] = d.tiles.map((t) => {
        const [x, y] = xy(t);
        return proceduralProjectTile(x + 0.5, y + 0.5, m);
      });
      ctx.strokeStyle = hsl(hue, sat, 85, (1 - age) * 0.45);
      ctx.setLineDash([m.tw * 0.4, m.tw * 0.4]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y - m.th);
      ctx.quadraticCurveTo((a.x + b.x) / 2, Math.min(a.y, b.y) - m.th * 5, b.x, b.y - m.th);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
};
window.ALIFE_DIPLOMACY_DEBUG = Object.freeze({
  send: (fromId, toId, proposal) => sendEnvoy(factionById(fromId), factionById(toId), proposal),
  envoys: () => (W.diplomacy?.envoys || []).map((e) => ({ ...e })),
  treaties: () => (W.diplomacy?.treaties || []).map((t) => ({ ...t })),
  marriages: () => (W.diplomacy?.marriages || []).map((m) => ({ ...m })),
  // Teleport the envoy to the court and resolve the embassy, forcing the answer.
  arrive: (envoyId, force = null) => {
    const envoy = W.diplomacy.envoys.find((e) => e.id === envoyId);
    if (!envoy?.active) return null;
    const court = factionCapital(factionById(envoy.to)),
      p = W.components.position[envoy.personId];
    if (!court || !p) return null;
    p.x = court.x;
    p.y = court.y;
    rebuildSpatialBins();
    const result = resolveEnvoy(envoy, force);
    envoy.phase = "return";
    envoy.resolvedTick = W.tick;
    const home = factionCapital(factionById(envoy.from));
    if (home)
      issueCivilOrder(envoy.personId, "envoy", home.x, home.y, {
        placeId: home.id,
        envoyId: envoy.id,
        sea: !!envoy.sea,
      });
    return result;
  },
  settle: () => {
    for (const m of W.diplomacy.marriages) {
      if (m.settled) continue;
      const court = factionCapital(factionById(m.to)),
        p = W.components.position[m.a];
      if (court && p) {
        p.x = court.x;
        p.y = court.y;
      }
    }
    rebuildSpatialBins();
    updateMarriages();
    return W.diplomacy.marriages.filter((m) => m.settled).length;
  },
  war: (aId, bId) => {
    const a = factionById(aId),
      b = factionById(bId);
    if (!a || !b || warBetween(a, b)) return warBetween(a, b);
    for (const [x, y] of [
      [a, b],
      [b, a],
    ]) {
      const rel = relationOf(x, y);
      rel.status = "at war";
      rel.pressure = 120;
      rel.truceUntil = 0;
    }
    const ev = emitEvent("WarStartedEvent", {
        factions: [a.id, b.id],
        evidence: ["a war declared for the test"],
        importance: 5,
      }),
      war = {
        id: Math.max(0, ...W.activeWars.map((w) => w.id || 0)) + 1,
        a: a.id,
        b: b.id,
        started: W.tick - TICKS_PER_YEAR * 2,
        startEventId: ev.id,
        startPopulation: a.population + b.population,
        casualties: 3,
        wounded: 0,
        turns: 4,
        contactTurns: 2,
        ended: 0,
      };
    W.activeWars.push(war);
    addRelation(a.entityId, b.entityId, "at_war_with", 1);
    addRelation(b.entityId, a.entityId, "at_war_with", 1);
    return war;
  },
  pay: () => {
    const before = W.events.length;
    payTributes();
    return W.events.slice(before).map((e) => e.type);
  },
  enforce: () => enforceTreaties(),
  independence: (vassalId) => {
    const t = W.diplomacy.treaties.find((x) => x.active && x.kind === "vassal" && x.a === vassalId);
    return t ? declareIndependence(t, factionById(t.a), factionById(t.b)) : null;
  },
  succession: (factionId, leaderId) => claimAtSuccession(factionById(factionId), leaderId, null),
  propose: () => considerProposals(),
  section: (factionId) => diplomacySection(factionById(factionId)),
  kin: (factionId) => voiceKin(factionById(factionId)),
});
