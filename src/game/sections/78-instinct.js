// ═══════════════════════════════════════════════════════════════════════════
// 78. INSTINCT — a brain stem in the genome, and what hunger makes people do
// ═══════════════════════════════════════════════════════════════════════════
// Newborn minds used to start from one table: every person the same innate
// leanings, animals none at all, and the rest left to learning. Here the
// baseline joins the genome. Each creature carries an instinct vector over the
// controller's actions, a deliberation gene, and a restraint gene, all
// inherited from its parents and mutated like the rest of the controller, so a
// line can grow bolder or more careful over generations. Founders' output
// wiring is laid down from the senses each neuron actually reads (hunger
// toward food, threat toward flight, thirst toward water), so a mind is never
// born pointing nowhere. Deliberate minds damp impulses they are not sure of;
// desperate ones act on reflex. And when hunger passes bearing with nothing to
// eat, people do what people do: they eat carrion, they eat the dead, and they
// rob the weak of the food they carry — each act weighed against the person's
// restraint, faith, boldness, and strength, and each one remembered.
const INSTINCT_BASE = Object.freeze({
    person: {
      food: 260,
      water: 300,
      flee: 340,
      socialize: 220,
      work: 240,
      shelter: 160,
      rest: 90,
      gather: 120,
      return: 100,
    },
    predator: { hunt: 320, scavenge: 200, water: 260, rest: 120, flee: 80, mate: 160 },
    herbivore: { food: 300, water: 300, flee: 380, rest: 100, mate: 140, wander: 60 },
  }),
  // How strongly each sense should push each action in a newborn's wiring.
  INSTINCT_AFFINITY = Object.freeze({
    food: { Hunger: 1, "Local food": 0.6, "Food gradient": 0.6, "Energy need": 0.4 },
    water: { Thirst: 1, "Local moisture": 0.5, "Water gradient": 0.6 },
    flee: {
      "Threat pressure": 1,
      "Predator proximity": 0.9,
      "Fire heat": 0.8,
      "Fear memory": 0.5,
      "Escape routes": 0.3,
    },
    rest: { Fatigue: 1, "Shelter cover": 0.4, Injury: 0.3 },
    shelter: { "Weather exposure": 1, "Habitat stress": 0.6, "Structural damage": 0.3 },
    hunt: { "Prey proximity": 0.9, "Prey vulnerability": 0.7, Hunger: 0.5, "Blood scent": 0.4 },
    scavenge: { "Carrion scent": 1, Hunger: 0.5 },
    gather: { "Material resources": 0.8, "Work urgency": 0.5 },
    work: { "Work urgency": 1, "Nearby allies": 0.3 },
    return: { "Distance from home": 1, "Weather exposure": 0.3 },
    socialize: { "Nearby allies": 0.8, "Mating readiness": 0.2 },
    mate: { "Mating readiness": 1, "Available mates": 0.8 },
    defend: { "Threat pressure": 0.5, "Nearby allies": 0.5, "Predator density": 0.4 },
    wander: { "Escape routes": 0.2 },
  }),
  INSTINCT_JITTER = 96,
  INSTINCT_MUTATION = 160,
  DESPERATE_HUNGER = 78,
  DESPERATE_REST = 8;
function instinctKindKey(kind) {
  return kind === KINDS.PREDATOR ? "predator" : kind === KINDS.HERBIVORE ? "herbivore" : "person";
}
// The senses hidden neuron h reads, and the neurons action a listens to, follow
// the controller's fixed wiring; the innate output weights are built from them.
function instinctSensesOf(h) {
  const senses = [];
  for (let n = 0; n < LTC_INPUT_FAN; n++) {
    const pos = h * LTC_INPUT_FAN + n;
    senses.push((pos * 13 + (pos >= LTC_SENSE_LABELS.length ? 7 : 0)) % LTC_SENSE_LABELS.length);
  }
  return senses;
}
const INSTINCT_OUT_CACHE = {};
function instinctOutBase(kind) {
  const key = instinctKindKey(kind);
  if (INSTINCT_OUT_CACHE[key]) return INSTINCT_OUT_CACHE[key];
  const out = new Array(LTC_ACTIONS.length * LTC_OUTPUT_FAN).fill(0),
    innate = INSTINCT_BASE[key];
  for (let a = 0; a < LTC_ACTIONS.length; a++) {
    const affinity = INSTINCT_AFFINITY[LTC_ACTIONS[a]] || {},
      lean = innate[LTC_ACTIONS[a]] || 0;
    for (let n = 0; n < LTC_OUTPUT_FAN; n++) {
      const h = (a * 3 + n * 5) % LTC_HIDDEN;
      let weight = 0;
      for (const s of instinctSensesOf(h)) weight += (affinity[LTC_SENSE_LABELS[s]] || 0) * 900;
      // A leaning the kind is born with also shows in a small standing bias.
      out[a * LTC_OUTPUT_FAN + n] = clamp(Math.round(weight + lean * 0.4 - 120), -2300, 2300);
    }
  }
  INSTINCT_OUT_CACHE[key] = Object.freeze(out);
  return INSTINCT_OUT_CACHE[key];
}
function inheritGene(id, salt, base, pa, pb, min, max, spread) {
  let v;
  if (pa != null && pb != null) v = hashParts(W.seedHash, id, salt) & 1 ? pa : pb;
  else if (pa != null || pb != null) v = pa ?? pb;
  else v = base + (hashParts(W.seedHash, id, salt) % (spread * 2 + 1)) - spread;
  if (
    (pa != null || pb != null) &&
    counterRand(`instinct-mutation-${salt}`, id) < (W.laws?.mutationIntensity || 0.1) * 0.6
  )
    v +=
      (hashParts(W.seedHash, id, "instinct-step", salt) % (INSTINCT_MUTATION * 2 + 1)) -
      INSTINCT_MUTATION;
  return clamp(Math.round(v), min, max);
}
function ensureInstinct(controller, id, parents = []) {
  if (!controller) return null;
  const a = W.components.genome[parents[0]]?.controller,
    b = W.components.genome[parents[1]]?.controller,
    kind = W.kind[id];
  if (controller.instinct?.length !== LTC_ACTIONS.length) {
    const innate = INSTINCT_BASE[instinctKindKey(kind)],
      instinct = new Int16Array(LTC_ACTIONS.length);
    for (let i = 0; i < LTC_ACTIONS.length; i++)
      instinct[i] = inheritGene(
        id,
        `instinct-${i}`,
        innate[LTC_ACTIONS[i]] || 0,
        a?.instinct?.[i],
        b?.instinct?.[i],
        -LTC_Q,
        LTC_Q,
        INSTINCT_JITTER,
      );
    controller.instinct = instinct;
  }
  if (!Number.isFinite(controller.deliberation))
    controller.deliberation = inheritGene(
      id,
      "deliberation",
      560,
      a?.deliberation,
      b?.deliberation,
      0,
      LTC_Q,
      192,
    );
  if (!Number.isFinite(controller.restraint))
    controller.restraint = inheritGene(
      id,
      "restraint",
      520,
      a?.restraint,
      b?.restraint,
      0,
      LTC_Q,
      224,
    );
  return controller;
}
const makeLTCControllerInstinctBase = makeLTCController;
makeLTCController = function (id, kind, parents = []) {
  const controller = makeLTCControllerInstinctBase(id, kind, parents),
    a = W.components.genome[parents[0]]?.controller,
    b = W.components.genome[parents[1]]?.controller;
  // A founder's output wiring follows the senses; a child's follows its parents.
  if (!a?.out && !b?.out)
    controller.out = controllerArray(instinctOutBase(kind), id, "out-instinct");
  ensureInstinct(controller, id, parents);
  return controller;
};
const cloneGenomeInstinctBase = cloneGenome;
cloneGenome = function (g) {
  const q = cloneGenomeInstinctBase(g);
  if (g?.controller && q.controller) {
    if (g.controller.instinct) q.controller.instinct = new Int16Array(g.controller.instinct);
    if (Number.isFinite(g.controller.deliberation))
      q.controller.deliberation = g.controller.deliberation;
    if (Number.isFinite(g.controller.restraint)) q.controller.restraint = g.controller.restraint;
  }
  return q;
};
// A fresh mind starts from its own instinct, blended with what a parent's mind
// has learned, in place of the one table every person used to be born with.
const initCognitionInstinctBase = initCognition;
initCognition = function (id, parents = []) {
  const c = initCognitionInstinctBase(id, parents);
  if (!c) return c;
  const g = W.components.genome[id];
  if (!g?.controller) return c;
  const kin = parents.length ? parents : W.components.identity[id]?.parents || [];
  ensureInstinct(g.controller, id, kin);
  if (c.updates === 0 && !c.instinctSeeded) {
    const store = W.components.cognition,
      teachers = kin
        .map((parent) => store[parent])
        .filter((t) => t && t.value?.length === c.value.length);
    for (let i = 0; i < c.value.length; i++) {
      let v = g.controller.instinct[i];
      if (teachers.length) {
        const t = teachers[hashParts(W.seedHash, id, "ltc-taught-value", i) % teachers.length];
        v = Math.round(v * 0.5 + t.value[i] * 0.5);
      }
      c.value[i] = clamp(v, -LTC_Q, LTC_Q);
    }
    c.instinctSeeded = true;
  }
  return c;
};
// Deliberation: an impulse the mind is not sure of is damped, unless the body
// is in extremity, when reflex rules.
function inExtremity(id) {
  const l = W.components.life[id];
  return !!l && (l.hunger > 72 || l.thirst > 72 || !!l.threatId);
}
const advanceLTCInstinctBase = advanceLTC;
advanceLTC = function (id) {
  const c = advanceLTCInstinctBase(id),
    g = W.components.genome[id]?.controller;
  if (!c || !g || !Number.isFinite(g.deliberation) || inExtremity(id)) return c;
  const confidence = clamp(c.confidence / LTC_Q, 0, 1),
    keep = 1 - (g.deliberation / LTC_Q) * (1 - confidence) * 0.8;
  if (keep < 1)
    for (let a = 0; a < c.output.length; a++) c.output[a] = Math.round(c.output[a] * keep);
  return c;
};
// ── What hunger makes people do ────────────────────────────────────────────────
function personStrength(id) {
  const ph = peekPhenotype(id) || {},
    l = W.components.life[id] || {};
  return (
    (ph.size || 1) * 0.5 +
    (ph.aggression || 0.3) * 0.5 +
    (typeof fightBonus === "function" ? fightBonus(id) : 0) * 0.15 +
    ((100 - (l.hunger || 0)) / 100) * 0.3
  );
}
function noFoodAround(id) {
  const p = W.components.position[id];
  if (!p) return true;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const x = p.x + dx,
        y = p.y + dy;
      if (inside(x, y) && tileFood(idx(x, y), "omnivore") >= 3) return false;
    }
  return true;
}
// The hunger at which a person will eat the dead: restraint and faith raise it,
// boldness lowers it, and nobody does it before hunger passes desperation.
function tabooThreshold(id) {
  const g = W.components.genome[id]?.controller,
    ident = W.components.identity[id],
    restraint = (g?.restraint ?? 512) / LTC_Q;
  return clamp(
    82 +
      restraint * 12 +
      (ident?.traits?.includes("devout") ? 5 : 0) -
      (ident?.traits?.includes("bold") ? 4 : 0),
    DESPERATE_HUNGER + 1,
    99,
  );
}
function grieveKin(victimId, culpritId, weight) {
  const ident = W.components.identity[victimId] || W.historicalIdentities?.[victimId],
    soc = W.components.social[victimId],
    kin = new Set([...(ident?.parents || []), ...(ident?.children || [])]);
  if (soc?.partnerId) kin.add(soc.partnerId);
  for (const k of kin) {
    if (!classifyAlive(k) || k === culpritId || typeof relationshipState !== "function") continue;
    const rel = relationshipState(k, culpritId);
    rel.grievance = clamp((rel.grievance || 0) + weight, 0, 1);
    rel.trust = clamp((rel.trust || 0) - weight * 0.5, -1, 1);
  }
}
function eatTheDead(id, corpse, hunger) {
  if (!performScavenge(id, [corpse])) return null;
  const ident = W.components.identity[id],
    dead = W.components.identity[corpse],
    soc = W.components.social[id],
    p = W.components.position[id];
  ident.taboos = (ident.taboos || 0) + 1;
  ident.cannibalTick = W.tick;
  if (!ident.titles.includes("Ate of the dead")) {
    ident.titles.push("Ate of the dead");
    ident.significance = (ident.significance || 0) + 3;
  }
  grieveKin(corpse, id, 0.6);
  if (typeof setEmotionImpulse === "function")
    setEmotionImpulse(id, { sadness: 0.3, fear: 0.2 }, 0);
  return emitEvent("CannibalismEvent", {
    subjects: [id, corpse],
    location: idx(p.x, p.y),
    factions: soc?.factionId ? [soc.factionId] : [],
    causes: [W.causalIndex.tile[idx(p.x, p.y)] || 0].filter(Boolean),
    evidence: [`hunger at ${Math.round(hunger)}`, "no food within reach"],
    importance: 4,
    data: {
      name: ident.generatedName,
      corpse: dead?.generatedName || "one of the dead",
      hunger: Math.round(hunger),
      taboos: ident.taboos,
    },
  });
}
function robOfFood(id, victim, hunger) {
  const carried = W.components.inventory[victim]?.materials,
    mouth = W.components.inventory[id]?.digestive;
  if (!carried || !mouth) return null;
  const taken = Math.min(carried[C.ORGANIC], 8, 65535 - mouth[C.ORGANIC]);
  if (taken < 1) return null;
  carried[C.ORGANIC] -= taken;
  mouth[C.ORGANIC] += taken;
  const ident = W.components.identity[id],
    victimIdent = W.components.identity[victim],
    soc = W.components.social[id],
    p = W.components.position[id];
  ident.crimes = (ident.crimes || 0) + 1;
  ident.robberies = (ident.robberies || 0) + 1;
  if (typeof relationshipState === "function") {
    const rel = relationshipState(victim, id);
    rel.grievance = clamp((rel.grievance || 0) + 0.5, 0, 1);
    rel.trust = clamp((rel.trust || 0) - 0.4, -1, 1);
  }
  addRelation(victim, id, "robbed", 1, 0);
  if (typeof setEmotionImpulse === "function")
    setEmotionImpulse(victim, { anger: 0.4, fear: 0.2 }, 0);
  return emitEvent("RobberyEvent", {
    subjects: [id, victim],
    location: idx(p.x, p.y),
    factions: [soc?.factionId, W.components.social[victim]?.factionId].filter(Boolean),
    causes: [W.causalIndex.tile[idx(p.x, p.y)] || 0].filter(Boolean),
    evidence: [`hunger at ${Math.round(hunger)}`, `${taken} units of food taken`],
    importance: 3,
    data: {
      name: ident.generatedName,
      victim: victimIdent?.generatedName || "a stranger",
      taken,
      hunger: Math.round(hunger),
      crimes: ident.crimes,
    },
  });
}
// A starving person with nothing to eat looks first to carrion, then to the
// dead, then to whoever beside them carries food and is weaker than they are.
function desperateAct(id, override = null) {
  if (W.kind[id] !== KINDS.PERSON || !classifyAlive(id)) return null;
  const l = derivedLife(id),
    hunger = override?.hunger ?? l.hunger;
  if (
    hunger < DESPERATE_HUNGER ||
    (!override && W.tick - (l.lastDesperateTick || -999) < DESPERATE_REST)
  )
    return null;
  if (!override?.ignoreFood && !noFoodAround(id)) return null;
  l.lastDesperateTick = W.tick;
  const corpses = nearbyIds(id, 2, (o) => W.kind[o] === KINDS.CORPSE),
    isPersonCorpse = (o) => W.components.identity[o]?.lifeKind === KINDS.PERSON,
    carrion = corpses.filter(
      (o) => !isPersonCorpse(o) && (W.components.chemistry[o]?.q[C.ORGANIC] || 0) > 0,
    ),
    dead = corpses.filter(
      (o) => isPersonCorpse(o) && (W.components.chemistry[o]?.q[C.ORGANIC] || 0) > 0,
    );
  if (carrion.length && performScavenge(id, carrion)) {
    l.behavior = "scavenge";
    l.behaviorReason = "hunger drove them to carrion";
    return { act: "carrion" };
  }
  if (dead.length && hunger >= tabooThreshold(id)) {
    const ev = eatTheDead(id, dead[0], hunger);
    if (ev) {
      l.behavior = "scavenge";
      l.behaviorReason = "hunger past bearing: they ate of the dead";
      return { act: "cannibalism", event: ev };
    }
  }
  const g = W.components.genome[id]?.controller,
    restraint = (g?.restraint ?? 512) / LTC_Q,
    bold = !!W.components.identity[id]?.traits?.includes("bold"),
    mine = personStrength(id),
    victims = nearbyIds(id, 1, (o) => W.kind[o] === KINDS.PERSON && o !== id && classifyAlive(o))
      .filter(
        (o) =>
          (W.components.inventory[o]?.materials?.[C.ORGANIC] || 0) >= 4 &&
          !(typeof isKin === "function" && isKin(id, o)) &&
          mine > personStrength(o) * (1 + restraint * 0.5) &&
          (bold || hunger >= 88),
      )
      .sort((a, b) => personStrength(a) - personStrength(b) || a - b);
  if (victims.length) {
    const ev = robOfFood(id, victims[0], hunger);
    if (ev) {
      l.behavior = "food";
      l.behaviorReason = "hunger past bearing: they robbed the weaker of food";
      return { act: "robbery", event: ev };
    }
  }
  return null;
}
const chooseBehaviorInstinctBase = chooseBehavior;
chooseBehavior = function (id, tier) {
  if (W.kind[id] === KINDS.PERSON && desperateAct(id)) return;
  return chooseBehaviorInstinctBase(id, tier);
};
// ── Chronicle, alerts, stories, the Mind card ──────────────────────────────────
const eventSentenceInstinctBase = eventSentence;
eventSentence = function (e) {
  const d = e.data || {};
  if (e.type === "CannibalismEvent")
    return `${d.name}, with hunger at ${d.hunger} and nothing else to eat, ate of the dead: ${d.corpse}.`;
  if (e.type === "RobberyEvent")
    return `${d.name}, starving, robbed ${d.victim} of ${d.taken} units of food.`;
  return eventSentenceInstinctBase(e);
};
const alertWorthyInstinctBase = alertWorthy;
alertWorthy = function (a) {
  return (
    alertWorthyInstinctBase(a) ||
    a.type === "CannibalismEvent" ||
    (a.type === "RobberyEvent" && a.importance >= 3)
  );
};
const personStoryInstinctBase = personStory;
personStory = function (id) {
  let html = personStoryInstinctBase(id);
  const ident = W.components.identity[id];
  if (!ident || !html) return html;
  const lines = [];
  if (ident.cannibalTick)
    lines.push(
      `Ate of the dead in year ${Math.floor(ident.cannibalTick / TICKS_PER_YEAR)}${ident.taboos > 1 ? `, and ${ident.taboos - 1} more time${ident.taboos > 2 ? "s" : ""}` : ""}.`,
    );
  if (ident.robberies)
    lines.push(
      `Has robbed the weaker of food ${ident.robberies} time${ident.robberies === 1 ? "" : "s"} when starving.`,
    );
  if (!lines.length) return html;
  const cut = html.lastIndexOf("</div>");
  return cut < 0
    ? html
    : `${html.slice(0, cut)}<p class="muted">${esc(lines.join(" "))}</p>${html.slice(cut)}`;
};
const mindCardInstinctBase = mindCard;
mindCard = function (id) {
  const html = mindCardInstinctBase(id),
    g = W.components.genome[id]?.controller;
  if (!html || !g?.instinct) return html;
  const leanings = LTC_ACTIONS.map((a, i) => [a, g.instinct[i]])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([a, v]) => `${esc(titleCase(a))} ${v >= 0 ? "+" : ""}${Math.round((v / LTC_Q) * 100)}`)
      .join(" · "),
    row = `<div class="kv"><span>Instinct</span><b>${leanings} <span class="muted">· inherited</span></b><span>Temperament</span><b>deliberation ${Math.round(((g.deliberation || 0) / LTC_Q) * 100)}% · restraint ${Math.round(((g.restraint || 0) / LTC_Q) * 100)}%</b></div>`;
  return html.replace('<div class="mind-neurons">', `${row}<div class="mind-neurons">`);
};
window.ALIFE_INSTINCT_DEBUG = Object.freeze({
  base: (kind) => ({ ...INSTINCT_BASE[instinctKindKey(kind)] }),
  outBase: (kind) => instinctOutBase(kind).slice(),
  instinct: (id) => Array.from(W.components.genome[id]?.controller?.instinct || []),
  genes: (id) => ({
    deliberation: W.components.genome[id]?.controller?.deliberation,
    restraint: W.components.genome[id]?.controller?.restraint,
  }),
  threshold: (id) => tabooThreshold(id),
  strength: (id) => personStrength(id),
  act: (id, override = null) => desperateAct(id, override),
  extremity: (id) => inExtremity(id),
});
