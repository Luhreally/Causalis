// ═══════════════════════════════════════════════════════════════════════════
// 53. BONDS — friends, rivals, quarrels, and feuds between houses
// ═══════════════════════════════════════════════════════════════════════════
// People already carry a measured relationship with everyone they meet
// (familiarity, trust, affection, grievance). This section reads those
// measures into named bonds with consequences: friendships that steady a
// person and are grieved when they end, rivalries that sour into quarrels and
// brawls, and feuds between houses (kin groups) that outlive the people who
// began them, weigh on the polities that shelter them, and end when the blood
// cools, a house dies out, or a marriage joins the two. Render code reads only
// the cached bond lists; it never writes the world.
const BOND_TRAIT_AFFINITY = Object.freeze({
  warm: 1,
  curious: 0.6,
  devout: 0.6,
  rooted: 0.5,
  skeptic: 0.4,
  humble: 0.4,
  hardy: 0.3,
  wary: 0.2,
  bold: 0.2,
  restless: 0.3,
});
const BOND_TRAIT_CLASH = Object.freeze([
  ["proud", "proud"],
  ["bold", "wary"],
  ["devout", "skeptic"],
  ["restless", "rooted"],
  ["warm", "aloof"],
]);
const BOND_SUCCESS_TYPES = new Set([
  "MasteryEvent",
  "AspirationEvent",
  "LeadershipEvent",
  "SuccessionEvent",
  "ArtifactCreatedEvent",
]);
function ensureBonds(world = W) {
  if (!world) return;
  world.feuds = world.feuds || [];
  world.living = world.living || {};
  if (world.living.nextFeudId == null) world.living.nextFeudId = 1;
  if (world.living.lastBondEventId == null) world.living.lastBondEventId = 0;
}
const restoreWorldBondsBase = restoreWorldDefaults;
restoreWorldDefaults = function () {
  restoreWorldBondsBase();
  ensureBonds(W);
};
function bondPerson(id) {
  return W.kind[id] === KINDS.PERSON && !!W.components.social[id] && classifyAlive(id);
}
function traitAffinity(a, b) {
  const ta = W.components.identity[a]?.traits || [],
    tb = W.components.identity[b]?.traits || [];
  let score = 0;
  for (const t of ta) if (tb.includes(t)) score += BOND_TRAIT_AFFINITY[t] || 0.2;
  for (const [x, y] of BOND_TRAIT_CLASH)
    if ((ta.includes(x) && tb.includes(y)) || (ta.includes(y) && tb.includes(x))) score -= 0.7;
  return clamp(score, -1.5, 1.5);
}
// ── Houses ─────────────────────────────────────────────────────────────────────
function feudKey(ka, kb) {
  return ka < kb ? `${ka}:${kb}` : `${kb}:${ka}`;
}
function feudBetween(ka, kb) {
  if (!ka || !kb || ka === kb) return null;
  const key = feudKey(ka, kb);
  return (W.feuds || []).find((f) => !f.ended && f.key === key) || null;
}
function houseFeuds(kinGroupId) {
  return (W.feuds || []).filter((f) => !f.ended && (f.a === kinGroupId || f.b === kinGroupId));
}
function houseMembers(kinGroupId) {
  const out = [];
  if (!kinGroupId) return out;
  for (const id of W.activeIds)
    if (
      W.kind[id] === KINDS.PERSON &&
      W.components.social[id]?.kinGroupId === kinGroupId &&
      classifyAlive(id)
    )
      out.push(id);
  return out;
}
function houseName(kinGroupId, sample = 0) {
  const id = sample || houseMembers(kinGroupId)[0] || kinGroupId,
    name = String(entityName(id) || ""),
    parts = name.split(" ").filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : name || `House ${kinGroupId}`;
}
function housePolity(kinGroupId) {
  const counts = new Map();
  for (const id of houseMembers(kinGroupId)) {
    const f = W.components.social[id].factionId;
    if (f) counts.set(f, (counts.get(f) || 0) + 1);
  }
  let best = 0,
    n = 0;
  for (const [f, c] of counts) if (c > n || (c === n && f < best)) ((best = f), (n = c));
  return best;
}
function addPolityGrievance(fa, fb, amount) {
  const a = W.factions.find((f) => f.id === fa),
    b = W.factions.find((f) => f.id === fb);
  if (!a || !b || a === b) return;
  const ra =
      a.relations[b.id] ||
      (a.relations[b.id] = { status: "neutral", pressure: 0, grievance: 0, trade: 0 }),
    rb =
      b.relations[a.id] ||
      (b.relations[a.id] = { status: "neutral", pressure: 0, grievance: 0, trade: 0 });
  ra.grievance = +((ra.grievance || 0) + amount).toFixed(3);
  rb.grievance = +((rb.grievance || 0) + amount).toFixed(3);
}
// ── Measuring a pair ───────────────────────────────────────────────────────────
function bondPairUpdate(id, other, ar, br, feuds) {
  const a = W.components.social[id],
    b = W.components.social[other],
    ia = W.components.identity[id],
    ib = W.components.identity[other],
    sharedFaction = a.factionId && a.factionId === b.factionId,
    affinity = traitAffinity(id, other),
    sameWant =
      ia?.want &&
      ib?.want &&
      ia.want.id === ib.want.id &&
      ["voice", "partner", "mastery", "found"].includes(ia.want.id)
        ? 1
        : 0,
    proudPair = (ia?.traits?.includes("proud") ? 1 : 0) + (ib?.traits?.includes("proud") ? 1 : 0),
    dominanceClash = a.dominance > 0.7 && b.dominance > 0.7 ? 1 : 0,
    feud = feuds.get(feudKey(a.kinGroupId, b.kinGroupId)),
    trust = (ar.trust + br.trust) / 2,
    affection = (ar.affection + br.affection) / 2,
    grievance = Math.max(ar.grievance, br.grievance),
    jealousy = Math.max(ar.jealousy, br.jealousy),
    betrayal = Math.max(ar.betrayal, br.betrayal),
    friendTarget = clamp(
      0.1 +
        trust * 0.4 +
        affection * 0.35 +
        affinity * 0.12 +
        (sharedFaction ? 0.08 : 0) -
        grievance * 0.7 -
        betrayal * 0.5 -
        (feud ? 0.5 : 0),
      0,
      1,
    ),
    rivalTarget = clamp(
      Math.max(0, -affinity) * 0.25 +
        sameWant * 0.35 +
        proudPair * 0.18 +
        dominanceClash * 0.2 +
        grievance * 0.6 +
        jealousy * 0.3 +
        (feud ? 0.45 + Math.min(1, feud.heat) * 0.2 : 0) -
        affection * 0.35,
      0,
      1,
    );
  ar.friendship = br.friendship = +lerp(ar.friendship || 0, friendTarget, 0.15).toFixed(3);
  ar.rivalry = br.rivalry = +lerp(ar.rivalry || 0, rivalTarget, 0.15).toFixed(3);
  return { affinity, sameWant, proudPair, dominanceClash, grievance, feud, sharedFaction };
}
function rivalryCause(id, measure) {
  if (measure.feud) return "the feud between their houses";
  if (measure.grievance > 0.4) return "old grievances";
  if (measure.sameWant) {
    const want = W.components.identity[id]?.want?.id;
    return `both wanting ${WANT_DEFS[want]?.[0] || "the same thing"}`;
  }
  if (measure.proudPair >= 2) return "pride";
  if (measure.dominanceClash) return "who would lead";
  return "a clash of natures";
}
function friendshipCause(id, other, measure) {
  const p = W.components.position[id],
    place = p ? nearestSettlement(idx(p.x, p.y), 8) : null;
  if (measure.affinity > 0.5) return "kindred natures";
  if (measure.sharedFaction && place) return `seasons side by side in ${place.name}`;
  if (!measure.sharedFaction) return "kindness across a border";
  return "long acquaintance";
}
function declareBond(id, other, ar, br, kind, measure) {
  const a = W.components.social[id],
    b = W.components.social[other],
    p = W.components.position[id],
    notable = !!(W.components.identity[id]?.notable || W.components.identity[other]?.notable),
    cause = kind === "friend" ? friendshipCause(id, other, measure) : rivalryCause(id, measure);
  ar.bond = br.bond = kind;
  ar.bondTick = br.bondTick = W.tick;
  addRelation(id, other, kind === "friend" ? "friend_of" : "rival_of", 1);
  addRelation(other, id, kind === "friend" ? "friend_of" : "rival_of", 1);
  const ev = emitEvent(kind === "friend" ? "FriendshipEvent" : "RivalryEvent", {
    subjects: [id, other],
    location: p ? idx(p.x, p.y) : -1,
    factions: [...new Set([a.factionId, b.factionId])].filter(Boolean),
    causes: [ar.lastEventId, br.lastEventId, measure.feud?.eventId].filter(Boolean),
    evidence: [
      cause,
      kind === "friend"
        ? `friendship ${ar.friendship.toFixed(2)}`
        : `rivalry ${ar.rivalry.toFixed(2)}`,
    ],
    importance: notable ? 3 : 2,
    data: { a: entityName(id), b: entityName(other), cause, kind },
  });
  ar.lastEventId = br.lastEventId = ev.id;
  const impulse =
      kind === "friend" ? { contentment: 0.15, affection: 0.1 } : { anger: 0.12, jealousy: 0.1 },
    glyph = kind === "friend" ? "🤝" : "⚡";
  setEmotionImpulse(id, impulse, ev.id, glyph);
  setEmotionImpulse(other, impulse, ev.id, glyph);
  return ev;
}
function dissolveBond(id, other, ar, br) {
  const kind = ar.bond,
    p = W.components.position[id],
    a = W.components.social[id],
    b = W.components.social[other];
  ar.bond = br.bond = "";
  removeRelation(id, other, kind === "friend" ? "friend_of" : "rival_of");
  removeRelation(other, id, kind === "friend" ? "friend_of" : "rival_of");
  const ev = emitEvent(kind === "friend" ? "EstrangementEvent" : "ReconciliationEvent", {
    subjects: [id, other],
    location: p ? idx(p.x, p.y) : -1,
    factions: [...new Set([a.factionId, b.factionId])].filter(Boolean),
    causes: [ar.lastEventId].filter(Boolean),
    evidence: [
      kind === "friend"
        ? `friendship fell to ${ar.friendship.toFixed(2)}`
        : `rivalry fell to ${ar.rivalry.toFixed(2)}`,
    ],
    importance: kind === "friend" ? 1 : 2,
    data: { a: entityName(id), b: entityName(other) },
  });
  ar.lastEventId = br.lastEventId = ev.id;
  if (kind === "friend") {
    setEmotionImpulse(id, { sadness: 0.1 }, ev.id);
    setEmotionImpulse(other, { sadness: 0.1 }, ev.id);
  } else {
    setEmotionImpulse(id, { contentment: 0.1, anger: -0.1 }, ev.id, "🕊️");
    setEmotionImpulse(other, { contentment: 0.1, anger: -0.1 }, ev.id, "🕊️");
  }
  return ev;
}
// ── Quarrels ───────────────────────────────────────────────────────────────────
function quarrel(id, other, ar, br, feud = null) {
  const a = W.components.social[id],
    b = W.components.social[other],
    p = W.components.position[id];
  if (!a || !b || !p || !ar || !br) return null;
  const tile = idx(p.x, p.y),
    place = nearestSettlement(tile, 8),
    brawl =
      a.aggression + a.dominance + b.aggression + b.dominance > 1.9 &&
      typeof detailedCombatExchange === "function",
    ev = emitEvent("QuarrelEvent", {
      subjects: [id, other],
      location: tile,
      factions: [...new Set([a.factionId, b.factionId])].filter(Boolean),
      causes: [ar.lastEventId, feud?.eventId].filter(Boolean),
      evidence: [
        `rivalry ${(ar.rivalry || 0).toFixed(2)}`,
        brawl ? "blows were struck" : "hard words only",
      ],
      importance: brawl ? 3 : 2,
      data: {
        a: entityName(id),
        b: entityName(other),
        place: place?.name || locationName(tile),
        brawl,
        feudId: feud?.id || 0,
      },
    });
  ar.grievance = clamp((ar.grievance || 0) + 0.12, 0, 1);
  br.grievance = clamp((br.grievance || 0) + 0.12, 0, 1);
  ar.lastEventId = br.lastEventId = ev.id;
  ar.quarrelTick = br.quarrelTick = W.tick;
  setEmotionImpulse(id, { anger: 0.25, contentment: -0.1 }, ev.id, "💢");
  setEmotionImpulse(other, { anger: 0.25, contentment: -0.1 }, ev.id, "💢");
  if (brawl)
    detailedCombatExchange(id, other, {
      internal: true,
      causeEvent: ev.id,
      intensity: 0.35,
      force: true,
    });
  if (feud) {
    feud.heat = Math.min(6, feud.heat + (brawl ? 0.3 : 0.1));
    feud.lastTick = W.tick;
    noteFeudEvent(feud, ev.id);
  } else if (brawl && a.kinGroupId && b.kinGroupId && a.kinGroupId !== b.kinGroupId) {
    // Bad blood: the third brawl between two houses is a feud without a death.
    const brawls = (W.living.brawls = W.living.brawls || {}),
      key = feudKey(a.kinGroupId, b.kinGroupId);
    brawls[key] = (brawls[key] || 0) + 1;
    if (brawls[key] >= 3) {
      delete brawls[key];
      beginFeud(a.kinGroupId, b.kinGroupId, ev.id, id, other, "brawls");
    }
  }
  return ev;
}
// ── The bond pass ──────────────────────────────────────────────────────────────
function updateBonds() {
  ensureBonds();
  const feuds = new Map();
  for (const f of W.feuds) if (!f.ended) feuds.set(f.key, f);
  const cycle = Math.floor(W.tick / 32);
  let quarrels = 0;
  for (const id of W.activeIds) {
    if (!bondPerson(id) || !isAdultPerson(id)) continue;
    const a = W.components.social[id],
      rels = a.relationships;
    if (!rels) continue;
    const friends = [],
      rivals = [],
      foes = [];
    for (const key in rels) {
      const other = +key,
        ar = rels[key];
      if (!(other > 0) || !bondPerson(other)) {
        if (ar.bond) ar.bond = "";
        continue;
      }
      const b = W.components.social[other],
        br = b.relationships?.[id];
      if (!br) continue;
      if (id < other && (ar.bond || ar.familiarity >= 0.25)) {
        const measure = bondPairUpdate(id, other, ar, br, feuds);
        if (!ar.bond) {
          if (ar.friendship > 0.55 && ar.rivalry < 0.35)
            declareBond(id, other, ar, br, "friend", measure);
          else if (ar.rivalry > 0.6 && ar.friendship < 0.4 && isAdultPerson(other))
            declareBond(id, other, ar, br, "rival", measure);
        } else if (ar.bond === "friend" && (ar.friendship < 0.3 || ar.rivalry > 0.65))
          dissolveBond(id, other, ar, br);
        else if (ar.bond === "rival" && ar.rivalry < 0.3) dissolveBond(id, other, ar, br);
        if (
          ar.bond === "rival" &&
          quarrels < 6 &&
          ar.rivalry > 0.65 &&
          W.tick - (ar.quarrelTick || -9999) > 512
        ) {
          const p = W.components.position[id],
            q = W.components.position[other];
          if (
            p &&
            q &&
            dist2(p.x, p.y, q.x, q.y) <= 6.25 &&
            counterRand("quarrel", cycle, id, other) < 0.2
          ) {
            quarrel(id, other, ar, br, measure.feud || null);
            quarrels++;
          }
        }
        // Friends close by steady each other a little.
        if (ar.bond === "friend" && counterRand("friend-ease", cycle, id, other) < 0.1) {
          const p = W.components.position[id],
            q = W.components.position[other];
          if (p && q && dist2(p.x, p.y, q.x, q.y) <= 9) {
            setEmotionImpulse(id, { contentment: 0.03 });
            setEmotionImpulse(other, { contentment: 0.03 });
          }
        }
      }
      if (ar.bond === "friend") friends.push(other);
      else if (ar.bond === "rival") {
        rivals.push(other);
        if (feuds.has(feudKey(a.kinGroupId, b.kinGroupId))) foes.push(other);
      }
    }
    a.bonds = { friends: friends.slice(0, 6), rivals: rivals.slice(0, 4), foes: foes.slice(0, 4) };
  }
  scanBondEvents();
}
// A rival's triumph stings; a friend's is shared. Marriages can end feuds.
function scanBondEvents() {
  const since = W.living.lastBondEventId || 0,
    fresh = [];
  for (let n = W.events.length - 1; n >= 0; n--) {
    const e = W.events[n];
    if (e.id <= since) break;
    if (BOND_SUCCESS_TYPES.has(e.type) || e.type === "LoveBondEvent") fresh.push(e);
  }
  if (W.events.length) W.living.lastBondEventId = W.events[W.events.length - 1].id;
  fresh.reverse();
  for (const e of fresh) {
    if (e.type === "LoveBondEvent") {
      marriageEndsFeud(e);
      continue;
    }
    if (e.type === "AspirationEvent" && e.data?.outcome !== "fulfilled") continue;
    const winner = e.subjects?.[0];
    if (!bondPerson(winner)) continue;
    const bonds = W.components.social[winner].bonds;
    if (!bonds) continue;
    for (const rival of bonds.rivals) {
      if (!bondPerson(rival)) continue;
      const rel = W.components.social[rival].relationships?.[winner];
      if (!rel) continue;
      rel.rivalry = clamp((rel.rivalry || 0) + 0.15, 0, 1);
      rel.jealousy = clamp((rel.jealousy || 0) + 0.2, 0, 1);
      setEmotionImpulse(rival, { jealousy: 0.2, anger: 0.08 }, e.id, "😒");
    }
    for (const friend of bonds.friends)
      if (bondPerson(friend)) setEmotionImpulse(friend, { contentment: 0.08 }, e.id);
  }
}
// ── Feuds ──────────────────────────────────────────────────────────────────────
function noteFeudEvent(feud, eventId) {
  if (!eventId || feud.eventIds.includes(eventId)) return;
  feud.eventIds.push(eventId);
  if (feud.eventIds.length > 40) feud.eventIds.shift();
}
function feudTitle(f) {
  return `the ${f.names[0]}–${f.names[1]} feud`;
}
function feudHeatWord(f) {
  return f.heat > 2 ? "burning" : f.heat > 0.8 ? "smouldering" : "cooling";
}
function beginFeud(ka, kb, causeEvent, killer, victim, reason = "killing") {
  ensureBonds();
  const [first, second] = ka < kb ? [ka, kb] : [kb, ka],
    sampleFor = (k) => (W.components.social[killer]?.kinGroupId === k ? killer : victim),
    feud = {
      id: W.living.nextFeudId++,
      key: feudKey(ka, kb),
      a: first,
      b: second,
      names: [houseName(first, sampleFor(first)), houseName(second, sampleFor(second))],
      heat: 1,
      deaths: reason === "killing" ? 1 : 0,
      started: W.tick,
      lastTick: W.tick,
      eventId: 0,
      eventIds: [],
      ended: 0,
      endReason: "",
    },
    p = W.components.position[victim] || W.components.position[killer];
  W.feuds.push(feud);
  const ev = emitEvent("FeudEvent", {
    subjects: [killer, victim].filter(Boolean),
    location: p ? idx(p.x, p.y) : -1,
    factions: [...new Set([housePolity(ka), housePolity(kb)])].filter(Boolean),
    causes: [causeEvent].filter(Boolean),
    evidence: [
      reason === "killing"
        ? `${entityName(killer)} killed ${entityName(victim)}`
        : `a third brawl between ${entityName(killer)} and ${entityName(victim)}`,
      "the houses were not at war",
    ],
    importance: reason === "killing" ? 4 : 3,
    data: {
      feudId: feud.id,
      houseA: feud.names[0],
      houseB: feud.names[1],
      killer: entityName(killer),
      victim: entityName(victim),
      reason,
    },
  });
  feud.eventId = ev.id;
  noteFeudEvent(feud, causeEvent);
  noteFeudEvent(feud, ev.id);
  return feud;
}
// A killing between houses that are not at war starts or feeds a feud.
function noteKilling(killer, victim, causeEvent = 0) {
  const ks = W.components.social[killer],
    vs = W.components.social[victim];
  if (!ks || !vs || W.kind[killer] !== KINDS.PERSON || !W.components.identity[victim]) return null;
  const ka = ks.kinGroupId,
    kb = vs.kinGroupId;
  if (!ka || !kb || ka === kb) return null;
  const fa = ks.factionId,
    fb = vs.factionId;
  if (
    fa &&
    fb &&
    fa !== fb &&
    W.activeWars.some((w) => !w.ended && ((w.a === fa && w.b === fb) || (w.a === fb && w.b === fa)))
  )
    return null;
  let feud = feudBetween(ka, kb);
  if (feud) {
    feud.heat = Math.min(6, feud.heat + 1);
    feud.deaths++;
    feud.lastTick = W.tick;
    noteFeudEvent(feud, causeEvent);
  } else feud = beginFeud(ka, kb, causeEvent, killer, victim);
  const pa = housePolity(ka),
    pb = housePolity(kb);
  if (pa && pb && pa !== pb) addPolityGrievance(pa, pb, 4);
  for (const id of houseMembers(kb).slice(0, 12)) {
    if (id === victim || id === killer) continue;
    const rel = relationshipState(id, killer);
    if (!rel) continue;
    rel.grievance = clamp((rel.grievance || 0) + 0.5, 0, 1);
    rel.familiarity = Math.max(rel.familiarity, 0.4);
    rel.lastEventId = feud.eventId;
  }
  return feud;
}
function endFeud(feud, reason, importance = 2, cause = 0) {
  if (feud.ended) return null;
  feud.ended = W.tick;
  feud.endReason = reason;
  const sample = houseMembers(feud.a)[0] || houseMembers(feud.b)[0],
    p = sample ? W.components.position[sample] : null,
    ev = emitEvent("FeudEndedEvent", {
      subjects: [],
      location: p ? idx(p.x, p.y) : -1,
      factions: [...new Set([housePolity(feud.a), housePolity(feud.b)])].filter(Boolean),
      causes: [feud.eventId, cause].filter(Boolean),
      evidence: [
        `${feud.deaths} dead`,
        `${((W.tick - feud.started) / TICKS_PER_YEAR).toFixed(1)} years`,
      ],
      importance,
      data: {
        feudId: feud.id,
        houseA: feud.names[0],
        houseB: feud.names[1],
        reason,
        deaths: feud.deaths,
      },
    });
  noteFeudEvent(feud, ev.id);
  return ev;
}
function marriageEndsFeud(e) {
  const [a, b] = e.subjects || [];
  if (!bondPerson(a) || !bondPerson(b)) return null;
  const feud = feudBetween(W.components.social[a].kinGroupId, W.components.social[b].kinGroupId);
  if (!feud) return null;
  W.components.identity[a].significance += 4;
  W.components.identity[b].significance += 4;
  return endFeud(
    feud,
    `the marriage of ${entityName(a)} and ${entityName(b)} joined the houses`,
    3,
    e.id,
  );
}
function updateFeuds() {
  ensureBonds();
  for (const feud of W.feuds) {
    if (feud.ended) continue;
    const membersA = houseMembers(feud.a),
      membersB = houseMembers(feud.b);
    if (!membersA.length || !membersB.length) {
      endFeud(feud, `the house of ${membersA.length ? feud.names[1] : feud.names[0]} died out`, 2);
      continue;
    }
    feud.heat = +(feud.heat * 0.94).toFixed(4);
    if (feud.heat < 0.25 && W.tick - feud.lastTick > TICKS_PER_YEAR * 3) {
      endFeud(feud, "the blood cooled and the houses let it lie", 2);
      continue;
    }
    const pa = housePolity(feud.a),
      pb = housePolity(feud.b);
    if (pa && pb && pa !== pb && feud.heat > 0.5) addPolityGrievance(pa, pb, feud.heat * 0.4);
    // Members of feuding houses know each other on sight.
    const [small, large] =
      membersA.length <= membersB.length ? [membersA, membersB] : [membersB, membersA];
    for (const id of small.slice(0, 12)) {
      const targetHouse = W.components.social[id].kinGroupId === feud.a ? feud.b : feud.a;
      for (const other of nearbyIds(
        id,
        3,
        (o) => W.kind[o] === KINDS.PERSON && W.components.social[o]?.kinGroupId === targetHouse,
      )) {
        if (!large.includes(other)) continue;
        const rel = relationshipState(id, other),
          rev = relationshipState(other, id);
        if (!rel || !rev) continue;
        rel.familiarity = rev.familiarity = Math.max(rel.familiarity, rev.familiarity, 0.3);
        rel.grievance = clamp((rel.grievance || 0) + 0.05, 0, 1);
        rev.grievance = clamp((rev.grievance || 0) + 0.05, 0, 1);
      }
    }
  }
  if (W.feuds.length > 40)
    W.feuds = W.feuds.filter((f) => !f.ended).concat(W.feuds.filter((f) => f.ended).slice(-12));
}
// Deaths already ripple through grief and revenge; here a killing between houses
// is also remembered as a feud.
const notifySocialDeathBondsBase = notifySocialDeath;
notifySocialDeath = function (victimId, causeEvent) {
  notifySocialDeathBondsBase(victimId, causeEvent);
  if (!W?.components?.social || !W.activeWars) return;
  ensureBonds(W);
  const killer =
    typeof knownKillerFromCause === "function" ? knownKillerFromCause(victimId, causeEvent) : 0;
  if (killer && W.kind[killer] === KINDS.PERSON) noteKilling(killer, victimId, causeEvent);
};
// ── Tick hook ──────────────────────────────────────────────────────────────────
const updateWeatherCycleBondsBase = updateWeatherCycle;
updateWeatherCycle = function () {
  updateWeatherCycleBondsBase();
  if (!W?.components?.social) return;
  ensureBonds(W);
  if (W.tick % 32 === 9) updateBonds();
  if (W.tick % 128 === 40) updateFeuds();
};
// ── Chronicle sentences ────────────────────────────────────────────────────────
const eventSentenceBondsBase = eventSentence;
eventSentence = function (e) {
  const d = e.data || {};
  switch (e.type) {
    case "FriendshipEvent":
      return `${d.a} and ${d.b} became fast friends${d.cause ? ` after ${d.cause}` : ""}.`;
    case "RivalryEvent":
      return `${d.a} and ${d.b} became rivals over ${d.cause || "a clash of natures"}.`;
    case "EstrangementEvent":
      return `${d.a} and ${d.b} drifted apart.`;
    case "ReconciliationEvent":
      return `${d.a} and ${d.b} set their rivalry aside.`;
    case "QuarrelEvent":
      return `${d.a} quarrelled with ${d.b} in ${d.place}${d.brawl ? " and blows were struck" : ""}.`;
    case "FeudEvent":
      return d.reason === "brawls"
        ? `A feud began between the houses of ${d.houseA} and ${d.houseB} after the third brawl between ${d.killer} and ${d.victim}.`
        : `A feud began between the houses of ${d.houseA} and ${d.houseB} after ${d.killer} killed ${d.victim}.`;
    case "FeudEndedEvent":
      return `The feud between the houses of ${d.houseA} and ${d.houseB} ended: ${d.reason}.`;
    default:
      return eventSentenceBondsBase(e);
  }
};
// ── Inspector and Legends ──────────────────────────────────────────────────────
function bondNames(ids) {
  return (ids || [])
    .map((x) => lifeLink(x))
    .filter(Boolean)
    .join(", ");
}
function bondsCard(id) {
  const soc = W.components.social[id];
  if (!soc || W.kind[id] !== KINDS.PERSON) return "";
  const bonds = soc.bonds || { friends: [], rivals: [], foes: [] },
    feuds = houseFeuds(soc.kinGroupId),
    house = houseName(soc.kinGroupId, id),
    kin = houseMembers(soc.kinGroupId).length;
  return `<div class="card bonds-card"><div class="subhead" style="margin-top:0">Bonds</div><div class="kv"><span>House</span><b>${esc(house)} <span class="muted">· ${kin} living</span></b><span>Friends</span><b>${bondNames(bonds.friends) || '<span class="muted">none yet</span>'}</b><span>Rivals</span><b>${bondNames(bonds.rivals) || '<span class="muted">none</span>'}</b>${
    feuds.length
      ? `<span>Feud</span><b>${feuds.map((f) => legendLink("feud", f.id, titleCase(feudTitle(f)))).join(", ")} <span class="muted">· ${feuds.map(feudHeatWord).join(", ")}</span></b>`
      : ""
  }</div></div>`;
}
const refreshInspectorBondsBase = refreshInspector;
refreshInspector = function () {
  refreshInspectorBondsBase();
  const id = UI.selectedEntity;
  if (!W || !id || W.kind[id] !== KINDS.PERSON || !DOM.inspectPane?.insertAdjacentHTML) return;
  const card = bondsCard(id);
  if (!card) return;
  const anchor =
    DOM.inspectPane.querySelector?.(".character-card") ||
    DOM.inspectPane.querySelector?.(".legend-entry");
  if (anchor?.insertAdjacentHTML) anchor.insertAdjacentHTML("afterend", card);
  else DOM.inspectPane.insertAdjacentHTML("afterbegin", card);
};
const renderLifePageBondsBase = renderLifePage;
renderLifePage = function (id) {
  const html = renderLifePageBondsBase(id);
  return W.kind[id] === KINDS.PERSON && W.components.social[id] ? html + bondsCard(id) : html;
};
function renderFeudPage(id) {
  const f = (W.feuds || []).find((x) => x.id === id);
  if (!f) return `<div class="empty">No feud #${id} is recorded.</div>`;
  const membersA = houseMembers(f.a),
    membersB = houseMembers(f.b),
    pa = W.factions.find((x) => x.id === housePolity(f.a)),
    pb = W.factions.find((x) => x.id === housePolity(f.b)),
    events = f.eventIds
      .map((eid) => eventById(eid))
      .filter(Boolean)
      .sort((x, y) => x.tick - y.tick || x.id - y.id),
    house = (name, members, polity) =>
      `<span>House of ${esc(name)}</span><b>${members.length ? `${members.length} living` : "died out"}${
        polity ? ` · ${legendLink("faction", polity.id, polity.name)}` : ""
      }${members.length ? ` · ${bondNames(members.slice(0, 4))}` : ""}</b>`;
  return `${legendHero(titleCase(feudTitle(f)), [f.ended ? "Ended" : titleCase(feudHeatWord(f)), `${f.deaths} dead`])}<div class="kv">${house(f.names[0], membersA, pa)}${house(f.names[1], membersB, pb)}<span>Began</span><b>Year ${formatYear(f.started)}</b><span>${
    f.ended ? "Ended" : "Heat"
  }</span><b>${f.ended ? `Year ${formatYear(f.ended)} · ${esc(f.endReason)}` : `${feudHeatWord(f)} · last blood Year ${formatYear(f.lastTick)}`}</b></div><div class="subhead">Chronicle</div>${timelineRows(events)}`;
}
const renderLegendIndexBondsBase = renderLegendIndex;
renderLegendIndex = function (query = "") {
  const html = renderLegendIndexBondsBase(query),
    q = query.trim().toLowerCase(),
    feuds = (W.feuds || []).filter((f) => !q || feudTitle(f).toLowerCase().includes(q));
  if (!feuds.length) return html;
  const cards = feuds
    .slice(-6)
    .reverse()
    .map(
      (f) =>
        `<div class="legend-card" data-legend="feud:${f.id}"><b>${esc(titleCase(feudTitle(f)))}</b><small>${
          f.ended ? `ended Year ${formatYear(f.ended)}` : `${feudHeatWord(f)} · ${f.deaths} dead`
        } · since Year ${formatYear(f.started)}</small></div>`,
    )
    .join("");
  return `${html}<div class="row between" style="margin-top:10px"><span class="subhead" style="margin:0">Feuds</span>${
    feuds.length > 6
      ? legendLink("list", "feuds", `all ${feuds.length}`)
      : `<span class="muted">${feuds.length}</span>`
  }</div><div class="legend-grid">${cards}</div>`;
};
const renderLegendListBondsBase = renderLegendList;
renderLegendList = function (what, query = "") {
  if (what !== "feuds") return renderLegendListBondsBase(what, query);
  const q = query.trim().toLowerCase(),
    rows = (W.feuds || [])
      .filter((f) => !q || feudTitle(f).toLowerCase().includes(q))
      .slice()
      .reverse()
      .map(
        (f) =>
          `<div class="legend-row" data-legend="feud:${f.id}"><span>${esc(titleCase(feudTitle(f)))}</span><span class="muted">${
            f.ended ? `ended Year ${formatYear(f.ended)}` : `${feudHeatWord(f)} · ${f.deaths} dead`
          }</span></div>`,
      );
  return `<input class="legend-search" data-legend-search type="search" placeholder="Search feuds…" value="${esc(query)}"><div class="subhead">Feuds · ${rows.length}</div>${
    rows.length
      ? `<div class="legend-list">${rows.slice(0, 200).join("")}</div>`
      : `<div class="empty">None recorded.</div>`
  }`;
};
const renderLegendPageBondsBase = renderLegendPage;
renderLegendPage = function (kind = UI.legend.kind, id = UI.legend.id) {
  if (kind === "feud" && W) return renderFeudPage(Number(id));
  return renderLegendPageBondsBase(kind, id);
};
// ── Drawing: bonds shown between people who are near each other ────────────────
// Friends close together share a warm arc; rivals a crackling line; members of
// feuding houses trade embers. All of it reads cached lists and screen anchors.
const drawWorkerActivityBondsBase = drawWorkerActivity;
drawWorkerActivity = function (now, bounds) {
  drawWorkerActivityBondsBase(now, bounds);
  if (UI.quality === "low" || UI.camera.zoom < 1.8) return;
  const m = ACTIVE_RENDER_METRICS || projectionMetrics(),
    v = ACTIVE_PLANET_VISUAL || makePlanetVisualGenome(),
    still = ACTIVE_REDUCED_MOTION,
    pos = W.components.position,
    life = W.components.life;
  let drawn = 0;
  const visible = (p) =>
    p &&
    p.x >= bounds.x0 - 1 &&
    p.x <= bounds.x1 + 1 &&
    p.y >= bounds.y0 - 1 &&
    p.y <= bounds.y1 + 1;
  for (const id of W.activeIds) {
    if (drawn > 40) break;
    if (W.kind[id] !== KINDS.PERSON) continue;
    const bonds = W.components.social[id]?.bonds;
    if (!bonds || (!bonds.friends.length && !bonds.rivals.length)) continue;
    const p = pos[id];
    if (!visible(p) || life[id]?.insideBuildingId) continue;
    const s = visualAnchor(id, p, m, now).s,
      r = clamp(m.tw * 0.3, 3, 40);
    for (const other of bonds.friends) {
      if (other < id) continue;
      const q = pos[other];
      if (!visible(q) || life[other]?.insideBuildingId || dist2(p.x, p.y, q.x, q.y) > 6.5) continue;
      const t = visualAnchor(other, q, m, now).s,
        pulse = still ? 0.5 : 0.5 + 0.5 * Math.sin(now * 0.004 + id * 0.7),
        mx = (s.x + t.x) / 2,
        my = Math.min(s.y, t.y) - r * (1.4 + pulse * 0.4);
      ctx.strokeStyle = hsl(v.accentHue, 70, 72, 0.25 + pulse * 0.3);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - r * 0.9);
      ctx.quadraticCurveTo(mx, my, t.x, t.y - r * 0.9);
      ctx.stroke();
      ctx.fillStyle = hsl(v.accentHue, 80, 80, 0.5 + pulse * 0.4);
      ctx.beginPath();
      ctx.arc(mx, my + r * 0.35, Math.max(1.2, r * 0.12), 0, Math.PI * 2);
      ctx.fill();
      drawn++;
    }
    for (const other of bonds.rivals) {
      if (other < id) continue;
      const q = pos[other];
      if (!visible(q) || life[other]?.insideBuildingId || dist2(p.x, p.y, q.x, q.y) > 9) continue;
      const t = visualAnchor(other, q, m, now).s,
        flicker = still ? 0.6 : Math.sin(now * 0.021 + id * 1.3),
        foe = bonds.foes.includes(other);
      if (!still && flicker < -0.2 && !foe) continue;
      ctx.strokeStyle = hsl(foe ? 8 : 24, 90, 62, 0.35 + Math.abs(flicker) * 0.4);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - r * 0.9);
      for (let k = 1; k <= 3; k++) {
        const f = k / 4,
          jitter =
            (visualHash01(id + other, k + (still ? 0 : Math.floor(now / 90))) - 0.5) * r * 0.9;
        ctx.lineTo(
          s.x + (t.x - s.x) * f + jitter,
          s.y - r * 0.9 + (t.y - s.y) * f - Math.abs(jitter) * 0.6,
        );
      }
      ctx.lineTo(t.x, t.y - r * 0.9);
      ctx.stroke();
      if (foe) {
        ctx.fillStyle = hsl(18, 95, 62, 0.85);
        for (let k = 0; k < 3; k++) {
          const u = still ? 0.25 + k * 0.25 : (now * 0.0006 + k * 0.33 + visualHash01(id, k)) % 1,
            ex = s.x + (t.x - s.x) * u,
            ey = s.y - r * 0.9 + (t.y - s.y) * u - u * r * 1.2;
          ctx.beginPath();
          ctx.arc(ex, ey, Math.max(0.8, r * 0.07), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      drawn++;
    }
  }
};
window.ALIFE_BONDS_DEBUG = Object.freeze({
  update: () => {
    updateBonds();
    let friends = 0,
      rivals = 0;
    for (const id of W.activeIds) {
      const b = W.components.social[id]?.bonds;
      if (!b) continue;
      friends += b.friends.length;
      rivals += b.rivals.length;
    }
    return { friends: friends / 2, rivals: rivals / 2, feuds: W.feuds.length };
  },
  updateFeuds: () => updateFeuds(),
  befriend: (a, b) => {
    for (const r of [relationshipState(a, b), relationshipState(b, a)]) {
      if (!r) return "";
      r.familiarity = 0.9;
      r.trust = 0.85;
      r.affection = 0.8;
      r.grievance = 0;
      r.betrayal = 0;
    }
    for (let i = 0; i < 16; i++) updateBonds();
    return relationshipState(a, b).bond;
  },
  antagonize: (a, b) => {
    for (const r of [relationshipState(a, b), relationshipState(b, a)]) {
      if (!r) return "";
      r.familiarity = 0.7;
      r.trust = 0.1;
      r.affection = 0.05;
      r.grievance = 0.9;
      r.jealousy = 0.6;
    }
    for (let i = 0; i < 16; i++) updateBonds();
    return relationshipState(a, b).bond;
  },
  quarrel: (a, b) =>
    quarrel(
      a,
      b,
      relationshipState(a, b),
      relationshipState(b, a),
      feudBetween(W.components.social[a]?.kinGroupId, W.components.social[b]?.kinGroupId),
    ),
  feud: (killer, victim, cause = 0) => noteKilling(killer, victim, cause),
  feuds: () => (W.feuds || []).map((f) => ({ ...f, eventIds: f.eventIds.slice() })),
  marriage: (a, b) => {
    const ev = formLoveBond(a, b);
    return ev ? marriageEndsFeud(ev) : null;
  },
  bonds: (id) => W.components.social[id]?.bonds || null,
  house: (id) => houseName(W.components.social[id]?.kinGroupId || 0, id),
  card: (id) => bondsCard(id),
  page: (id) => renderFeudPage(id),
});
