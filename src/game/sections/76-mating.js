// ═══════════════════════════════════════════════════════════════════════════
// 76. MATING — coupling is an act between two people, not an accident
// ═══════════════════════════════════════════════════════════════════════════
// Children used to appear whenever two fertile adults of the same kind stood
// within two tiles of each other, whoever they were: partners, strangers, or
// kin. People now couple by choice. A person seeks their partner first, then a
// lover they already have, then someone they are mutually drawn to; kin never.
// A partnered person who couples with someone else is having an affair, and
// the affair record, the discovery, the jealousy, and the revenge of the
// social layer follow from that act. Each coupling is chronicled, only some
// conceive, lovers remember each other, and a person's story says who they
// have lain with. Animals keep the old way. Rendering only reads the world.
const MATE_ATTRACTION = 0.2,
  CONCEIVE_CHANCE = 0.85,
  MATE_REST = 32;
let MATING_ANIMALS_ONLY = false;
function ensureMating(world = W) {
  if (!world) return;
  world.living = world.living || {};
  if (world.living.couplings == null) world.living.couplings = 0;
}
const restoreWorldMatingBase = restoreWorldDefaults;
restoreWorldDefaults = function () {
  restoreWorldMatingBase();
  ensureMating(W);
};
function loversOf(soc) {
  return (soc.lovers = soc.lovers || {});
}
function sameKin(a, b) {
  return !!(a?.kinGroupId && a.kinGroupId === b?.kinGroupId);
}
// Partner first, then a lover, then the strongest mutual attraction; never kin.
function mateChoice(id, candidates) {
  const soc = W.components.social[id];
  if (!soc) return 0;
  const pool = candidates.filter((o) => {
    const os = W.components.social[o];
    return os && !sameKin(soc, os) && isAdultPerson(o);
  });
  if (!pool.length) return 0;
  if (soc.partnerId && pool.includes(soc.partnerId)) return soc.partnerId;
  if (typeof affairBetween === "function") {
    const lover = pool.find((o) => affairBetween(id, o));
    if (lover) return lover;
  }
  // A partnered person strays only through an affair already begun by temptation.
  if (soc.partnerId) return 0;
  let best = 0,
    score = 0;
  for (const o of pool) {
    const os = W.components.social[o],
      ar = soc.relationships?.[o],
      br = os.relationships?.[id],
      mutual = Math.min(ar?.attraction || 0, br?.attraction || 0);
    if (os.partnerId) continue;
    if (mutual >= MATE_ATTRACTION && mutual > score) {
      score = mutual;
      best = o;
    }
  }
  return best;
}
function couple(id, other, tile) {
  const a = W.components.social[id],
    b = W.components.social[other];
  if (!a || !b) return null;
  const strayA = !!(a.partnerId && a.partnerId !== other),
    strayB = !!(b.partnerId && b.partnerId !== id);
  let affairEvent = null;
  if (typeof affairBetween === "function" && typeof startAffair === "function") {
    if (strayA && !affairBetween(id, other)) affairEvent = startAffair(id, other);
    else if (strayB && !affairBetween(other, id)) affairEvent = startAffair(other, id);
  }
  const la = loversOf(a),
    lb = loversOf(b);
  la[other] = { count: (la[other]?.count || 0) + 1, lastTick: W.tick };
  lb[id] = { count: (lb[id]?.count || 0) + 1, lastTick: W.tick };
  const ar = relationshipState(id, other),
    br = relationshipState(other, id),
    partners = a.partnerId === other && b.partnerId === id,
    secret = strayA || strayB;
  for (const r of [ar, br]) {
    r.attraction = clamp((r.attraction || 0) + 0.05, 0, 1);
    r.affection = clamp((r.affection || 0) + 0.04, 0, 1);
    r.familiarity = clamp((r.familiarity || 0) + 0.05, 0, 1);
    if (partners) r.commitment = clamp((r.commitment || 0) + 0.03, 0, 1);
  }
  ensureMating();
  W.living.couplings++;
  const place = nearestSettlement(tile, 8),
    notable = !!(W.components.identity[id]?.notable || W.components.identity[other]?.notable),
    ev = emitEvent("MatingEvent", {
      subjects: [id, other],
      location: tile,
      factions: [...new Set([a.factionId, b.factionId])].filter(Boolean),
      causes: [affairEvent?.id, ar.lastEventId].filter(Boolean),
      evidence: [
        partners ? "partners" : secret ? "an affair" : "lovers with no bond between them",
        `mutual attraction ${Math.min(ar.attraction, br.attraction).toFixed(2)}`,
      ],
      importance: secret || notable ? 2 : 1,
      data: {
        a: entityName(id),
        b: entityName(other),
        place: place?.name || locationName(tile),
        partners,
        secret,
      },
    });
  ar.lastEventId = br.lastEventId = ev.id;
  setEmotionImpulse(id, { affection: 0.12, contentment: 0.1 }, ev.id, "💞");
  setEmotionImpulse(other, { affection: 0.12, contentment: 0.1 }, ev.id, "💞");
  return ev;
}
// The house a child is born into: partners pass on the older house, so a line
// keeps one name across generations; otherwise the child follows the bearer.
function houseBearer(id, other) {
  const a = W.components.social[id],
    b = W.components.social[other];
  if (a?.partnerId === other && b?.partnerId === id && (b.kinGroupId || 0) < (a.kinGroupId || 0))
    return [other, id];
  return [id, other];
}
function conceive(id, other, tile) {
  const kind = W.kind[id],
    p = W.components.position[id],
    parents = houseBearer(id, other);
  if (activeCount(kind) < CAPS[kind]) {
    const child = createOffspring(kind, parents, tile),
      bearerId = parents[0],
      loverId = parents[1],
      bearer = W.components.social[bearerId],
      affair = typeof affairBetween === "function" ? affairBetween(bearerId, loverId) : null;
    // A child of a secret affair is raised as the partner’s child.
    if (
      child &&
      bearer?.partnerId &&
      bearer.partnerId !== loverId &&
      affair &&
      !affair.discovered &&
      typeof setSecretParentage === "function"
    )
      setSecretParentage(child, bearerId, loverId, bearer.partnerId);
    return child;
  }
  const r = makeRng(hashParts(W.seedHash, W.tick, id, other), "cohort-birth"),
    g = genomeFrom(r, kind, W.components.genome[parents[0]], W.components.genome[parents[1]]),
    chem = makeCohortBirthMatter(parents);
  addBirthToCohort(kind, p.regionId, parents, chem, g);
  for (const par of parents) W.components.reproduction[par].cooldown = 240;
  return null;
}
// Fertility follows the town: full stores and a roof raise it, hunger, a
// blockade, and a fresh calamity lower it.
function fertilityFactor(id, other) {
  const p = W.components.position[id],
    place = p ? nearestSettlement(idx(p.x, p.y), 8) : null,
    hunger = Math.max(W.components.life[id]?.hunger || 0, W.components.life[other]?.hunger || 0);
  let factor = hunger > 75 ? 0.6 : 1;
  if (!place) return factor;
  const food = typeof settlementFood === "function" ? settlementFood(place) : 6;
  factor *= food >= 6 ? 1.2 : food >= 2 ? 1 : 0.7;
  factor *= completedBuildings(place, "shelter").length ? 1.1 : 0.95;
  if (typeof blockadeOf === "function" && blockadeOf(place)) factor *= 0.7;
  if ((place.calamity || 0) > 0.3) factor *= 0.8;
  return clamp(factor, 0.2, 1.35);
}
function fertilityWord(place) {
  const food = typeof settlementFood === "function" ? settlementFood(place) : 6,
    blockaded = typeof blockadeOf === "function" && blockadeOf(place),
    roof = completedBuildings(place, "shelter").length > 0;
  if (blockaded || food < 3) return "lean";
  if (food >= 6 && roof) return "thriving";
  return "steady";
}
const renderPlacePageMatingBase = renderPlacePage;
renderPlacePage = function (id) {
  const html = renderPlacePageMatingBase(id),
    s = W.settlements.find((x) => x.id === id);
  if (!s) return html;
  const row = `<div class="kv"><span>Fertility</span><b>${fertilityWord(s)}</b></div>`,
    at = html.indexOf('<div class="subhead">Chronicle</div>');
  return at < 0 ? html + row : html.slice(0, at) + row + html.slice(at);
};
// Animals keep the old adjacency; people are hidden from it and couple below.
const canReproduceMatingBase = canReproduce;
canReproduce = function (id) {
  if (MATING_ANIMALS_ONLY && W.kind[id] === KINDS.PERSON) return false;
  return canReproduceMatingBase(id);
};
function updateCouplings() {
  ensureMating();
  const people = W.activeIds
      .filter((id) => W.kind[id] === KINDS.PERSON && canReproduce(id) && isAdultPerson(id))
      .sort((a, b) => a - b),
    used = new Set();
  for (const id of people) {
    if (used.has(id)) continue;
    const p = W.components.position[id];
    if (!p) continue;
    const soc = W.components.social[id],
      partnerNear =
        soc?.partnerId &&
        !used.has(soc.partnerId) &&
        classifyAlive(soc.partnerId) &&
        W.components.genome[soc.partnerId] &&
        canReproduce(soc.partnerId) &&
        W.components.position[soc.partnerId] &&
        dist2(
          p.x,
          p.y,
          W.components.position[soc.partnerId].x,
          W.components.position[soc.partnerId].y,
        ) <= 16,
      near = partnerNear
        ? [soc.partnerId]
        : nearbyIds(
            id,
            2,
            (o) => o !== id && W.kind[o] === KINDS.PERSON && !used.has(o) && canReproduce(o),
          ),
      mate = mateChoice(id, near);
    if (!mate) continue;
    const tile = idx(p.x, p.y);
    couple(id, mate, tile);
    if (counterRand("conceive", W.tick, id, mate) < CONCEIVE_CHANCE * fertilityFactor(id, mate))
      conceive(id, mate, tile);
    else
      for (const par of [id, mate])
        W.components.reproduction[par].cooldown = Math.max(
          W.components.reproduction[par].cooldown || 0,
          MATE_REST,
        );
    used.add(id);
    used.add(mate);
  }
}
const updateReproductionMatingBase = updateReproduction;
updateReproduction = function () {
  MATING_ANIMALS_ONLY = true;
  try {
    updateReproductionMatingBase();
  } finally {
    MATING_ANIMALS_ONLY = false;
  }
  if (W?.components?.social) updateCouplings();
};
// ── Chronicle and story ────────────────────────────────────────────────────────
const eventSentenceMatingBase = eventSentence;
eventSentence = function (e) {
  if (e.type !== "MatingEvent") return eventSentenceMatingBase(e);
  const d = e.data || {};
  if (d.secret) return `${d.a} and ${d.b} lay together in secret in ${d.place}.`;
  if (d.partners) return `${d.a} and ${d.b}, partners, coupled in ${d.place}.`;
  return `${d.a} and ${d.b} coupled in ${d.place}, with no bond between them.`;
};
function loversLine(id) {
  const soc = W.components.social[id],
    lovers = soc?.lovers ? Object.entries(soc.lovers) : [];
  if (!lovers.length) return "";
  const named = lovers
    .filter(([k]) => W.components.identity[+k] || W.historicalIdentities?.[+k])
    .sort((x, y) => y[1].lastTick - x[1].lastTick)
    .slice(0, 4)
    .map(([k, v]) => {
      const who = +k,
        partner = soc.partnerId === who,
        name = typeof loreName === "function" ? loreName(who) : esc(entityName(who));
      return `${name}${partner ? " (their partner)" : ""}${v.count > 1 ? ` ${v.count} times` : ""}`;
    });
  const last = lovers.reduce((m, [, v]) => Math.max(m, v.lastTick), 0);
  return `Has lain with ${named.join(", ")}; last in year ${formatYear(last)}.`;
}
const personStoryMatingBase = personStory;
personStory = function (id) {
  const html = personStoryMatingBase(id);
  if (!html) return html;
  const line = loversLine(id);
  if (!line) return html;
  const para = `<p>${line}</p>`,
    at = html.indexOf('<div class="subhead">Lately</div>');
  return at < 0 ? html + para : html.slice(0, at) + para + html.slice(at);
};
window.ALIFE_MATING_DEBUG = Object.freeze({
  update: () => updateCouplings(),
  choose: (id) => {
    const p = W.components.position[id];
    return p
      ? mateChoice(
          id,
          nearbyIds(id, 2, (o) => o !== id && W.kind[o] === KINDS.PERSON),
        )
      : 0;
  },
  couple: (a, b) => {
    const p = W.components.position[a];
    return p ? couple(a, b, idx(p.x, p.y)) : null;
  },
  conceive: (a, b) => {
    const p = W.components.position[a];
    return p ? conceive(a, b, idx(p.x, p.y)) : null;
  },
  lovers: (id) => ({ ...(W.components.social[id]?.lovers || {}) }),
  couplings: () => W.living?.couplings || 0,
  fertility: (a, b) => fertilityFactor(a, b),
});
