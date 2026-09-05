// ═══════════════════════════════════════════════════════════════════════════
// 51. CHARACTER: TRAITS, WANTS, AND SKILLS
// ═══════════════════════════════════════════════════════════════════════════
// People had emotions and relationships but no named character, no life goal,
// and no mastery. Each person now carries two or three traits read from their
// genome, phenotype, and culture at birth; one want at a time chosen from those
// traits and their situation, fulfilled or given up in the chronicle; and eight
// skills that grow from what they actually do (crafting, building, farming,
// herding, hunting, fighting, healing, lore), with adept and master titles.
// Skill and boldness sharpen a strike, and a crafter's skill outlasts in the
// tools they make. Character is authoritative state on the identity; rendering
// only reads it and never creates it.
const TRAIT_DEFS = Object.freeze({
  bold: ["Bold", "quick to fight and slow to flee"],
  wary: ["Wary", "counts the exits before the meal"],
  warm: ["Warm", "seeks company and is trusted for it"],
  aloof: ["Aloof", "keeps their own counsel"],
  restless: ["Restless", "always looking past the next ridge"],
  rooted: ["Rooted", "happiest within sight of the hearth"],
  curious: ["Curious", "asks how a thing works"],
  settled: ["Settled", "trusts what the elders knew"],
  devout: ["Devout", "reads the god in every weather"],
  skeptic: ["Skeptic", "wants to see it twice"],
  proud: ["Proud", "does not forget a slight"],
  humble: ["Humble", "gives the credit away"],
  hardy: ["Hardy", "shrugs off cold and hunger"],
  frail: ["Frail", "feels every winter"],
});
const SKILL_KEYS = Object.freeze([
  "craft",
  "build",
  "farm",
  "herd",
  "hunt",
  "fight",
  "heal",
  "lore",
]);
const SKILL_TITLES = Object.freeze({
  craft: "Crafter",
  build: "Builder",
  farm: "Grower",
  herd: "Herder",
  hunt: "Hunter",
  fight: "Fighter",
  heal: "Healer",
  lore: "Keeper of Lore",
});
const WANT_DEFS = Object.freeze({
  partner: ["to find a partner", "found a partner"],
  child: ["to raise a child", "raised a child"],
  voice: ["to become the Voice of their people", "became the Voice of their people"],
  mastery: ["to master a craft", "was named an adept"],
  home: ["to live under a finished roof", "came to live under a finished roof"],
  journey: ["to see what lies beyond the horizon", "walked far beyond the horizon"],
  found: ["to found a place of their own", "founded a place of their own"],
  faith: ["to see the god named and honoured", "saw the god named and honoured"],
});
function freshSkills() {
  return Object.fromEntries(SKILL_KEYS.map((k) => [k, 0]));
}
function deriveTraits(id, ident) {
  const ph = peekPhenotype(id) || {},
    soc = W.components.social[id] || {},
    g = W.components.genome[id],
    h = (salt) => hashParts(W.seedHash, "trait", id, salt) / 4294967296,
    culture = soc.cultureId ? W.cultures.find((c) => c.id === soc.cultureId) : null,
    spiritual = culture ? cultureSpirituality(culture) : 0.4,
    aggression = ph.aggression ?? 0.3,
    social = ph.social ?? 0.5,
    dominance = soc.dominance ?? 0.5,
    pool = [
      [Math.abs(aggression - 0.5) + h(1) * 0.2, aggression > 0.5 ? "bold" : "wary"],
      [Math.abs(social - 0.5) + h(2) * 0.2, social > 0.5 ? "warm" : "aloof"],
      [
        Math.abs(creatureGene(g, 2) - 0.6) + h(3) * 0.25,
        creatureGene(g, 2) > 0.6 ? "restless" : "rooted",
      ],
      [
        Math.abs(creatureGene(g, 7) - 0.6) + h(4) * 0.25,
        creatureGene(g, 7) > 0.6 ? "curious" : "settled",
      ],
      [
        Math.abs(spiritual - 0.5) * 0.8 + h(5) * 0.3,
        spiritual + h(6) * 0.4 > 0.7 ? "devout" : "skeptic",
      ],
      [Math.abs(dominance - 0.5) + h(7) * 0.2, dominance > 0.5 ? "proud" : "humble"],
      [
        Math.abs(creatureGene(g, 11) - 0.6) + h(8) * 0.25,
        creatureGene(g, 11) > 0.6 ? "hardy" : "frail",
      ],
    ];
  pool.sort((a, b) => b[0] - a[0]);
  ident.traits = pool.slice(0, 2 + (h(9) < 0.4 ? 1 : 0)).map((x) => x[1]);
}
// Simulation-side only: rendering must read identities without creating character.
function characterOf(id) {
  const ident = W.components.identity[id];
  if (!ident || W.kind[id] !== KINDS.PERSON) return null;
  if (!ident.traits) deriveTraits(id, ident);
  if (!ident.skills) ident.skills = freshSkills();
  return ident;
}
function hasTrait(id, trait) {
  return !!W.components.identity[id]?.traits?.includes(trait);
}
function personTile(id) {
  const p = W.components.position[id];
  return p ? idx(p.x, p.y) : -1;
}
// ── Skills ─────────────────────────────────────────────────────────────────────
function grantSkill(id, skill, amount, cause = 0) {
  const ident = characterOf(id);
  if (!ident || !SKILL_KEYS.includes(skill) || !classifyAlive(id)) return;
  const before = ident.skills[skill] || 0,
    after = clamp(before + amount * (ident.traits.includes("curious") ? 1.15 : 1), 0, 100);
  ident.skills[skill] = +after.toFixed(2);
  for (const [threshold, rank] of [
    [40, "Adept"],
    [75, "Master"],
  ]) {
    if (!(before < threshold && after >= threshold)) continue;
    const title = `${rank} ${SKILL_TITLES[skill]}`;
    if (!ident.titles.includes(title)) ident.titles.push(title);
    ident.significance += rank === "Master" ? 6 : 3;
    const soc = W.components.social[id];
    emitEvent("MasteryEvent", {
      subjects: [id],
      location: personTile(id),
      factions: soc?.factionId ? [soc.factionId] : [],
      causes: [cause].filter(Boolean),
      evidence: [`${skill} reached ${Math.round(after)}`],
      importance: rank === "Master" ? 3 : 2,
      data: { skill, rank, name: ident.generatedName, title },
    });
  }
}
function fightBonus(id) {
  const ident = W.components.identity[id];
  if (!ident) return 0;
  return (ident.skills?.fight || 0) / 25 + (ident.traits?.includes("bold") ? 1 : 0);
}
const emitEventCharacterBase = emitEvent;
emitEvent = function (type, data = {}) {
  const ev = emitEventCharacterBase(type, data);
  // Probes swap in bare worlds without kinds or identities; character reads nothing there.
  if (!W?.kind || !W.components?.identity || !W.components.life) return ev;
  const people = (ev.subjects || []).filter((id) => W.kind[id] === KINDS.PERSON);
  switch (type) {
    case "ToolCraftedEvent":
    case "EquipmentCraftedEvent":
      for (const id of people) grantSkill(id, "craft", 3, ev.id);
      break;
    case "BuildingCompletedEvent": {
      const built = W.buildings.find(
        (b) => b.completedTick === W.tick && idx(b.x, b.y) === ev.location,
      );
      for (const id of (built?.workers || people).slice(0, 8))
        if (W.kind[id] === KINDS.PERSON) grantSkill(id, "build", 2, ev.id);
      break;
    }
    case "CropHarvestedEvent":
    case "CropSownEvent":
      for (const id of people) grantSkill(id, "farm", 2, ev.id);
      break;
    case "HerdFormedEvent":
    case "HerdMovedEvent":
    case "HerdFedEvent":
      for (const id of people) grantSkill(id, "herd", 1.5, ev.id);
      break;
    case "KillEvent": {
      const killer = ev.subjects?.[0],
        victim = ev.subjects?.[1];
      if (W.kind[killer] === KINDS.PERSON)
        grantSkill(killer, W.kind[victim] === KINDS.PERSON ? "fight" : "hunt", 5, ev.id);
      break;
    }
    case "InjuryEvent": {
      const attacker = ev.subjects?.[1];
      if (W.kind[attacker] === KINDS.PERSON) grantSkill(attacker, "fight", 0.6, ev.id);
      break;
    }
    case "PredatorDefenseEvent":
      for (const id of people) grantSkill(id, "fight", 1, ev.id);
      break;
    case "TechAdvanceEvent":
      for (const id of people) grantSkill(id, "lore", 8, ev.id);
      break;
    case "FireSuppressedEvent":
      for (const id of people) grantSkill(id, "build", 2, ev.id);
      break;
  }
  return ev;
};
// Skill and boldness sharpen a strike.
const militaryStrikeCharacterBase = militaryStrike;
militaryStrike = function (attacker, victim, war, training = 0) {
  return militaryStrikeCharacterBase(attacker, victim, war, training + fightBonus(attacker));
};
// A crafter's skill outlasts in the tool.
const createPersonalToolCharacterBase = createPersonalTool;
createPersonalTool = function (id, recipe) {
  const artifact = createPersonalToolCharacterBase(id, recipe);
  if (!artifact?.tool) return artifact;
  const skill = W.components.identity[id]?.skills?.craft || 0;
  if (skill > 0) {
    artifact.tool.durability = Math.round((artifact.tool.durability || 160) * (1 + skill / 200));
    artifact.quality = (artifact.quality || 0) + Math.round(skill / 10);
  }
  return artifact;
};
// ── Wants ──────────────────────────────────────────────────────────────────────
function isAdultPerson(id) {
  const l = W.components.life[id],
    b = W.components.body[id];
  return !!(l && b) && l.age >= (b.maxAge || 19200) * 0.2;
}
function chooseWant(id, ident) {
  const soc = W.components.social[id],
    traits = ident.traits || [],
    h = hashParts(W.seedHash, "want", id, ident.wantsChosen || 0) / 4294967296,
    candidates = [];
  if (!soc?.partnerId) candidates.push(["partner", 3]);
  if (soc?.partnerId && (ident.children?.length || 0) < 2)
    candidates.push(["child", 2 + (traits.includes("warm") ? 1 : 0)]);
  if (traits.includes("proud") && soc?.factionId) candidates.push(["voice", 2]);
  candidates.push(["mastery", 1 + (traits.includes("curious") ? 2 : 0)]);
  candidates.push(["home", 1 + (traits.includes("rooted") ? 2 : 0)]);
  if (traits.includes("restless"))
    candidates.push(["journey", 3], ["found", traits.includes("bold") ? 2 : 1]);
  if (traits.includes("devout")) candidates.push(["faith", 3]);
  const total = candidates.reduce((sum, c) => sum + c[1], 0);
  let roll = h * total;
  for (const [want, weight] of candidates) {
    roll -= weight;
    if (roll <= 0) return want;
  }
  return candidates[candidates.length - 1][0];
}
function wantFulfilled(id, ident, want) {
  const soc = W.components.social[id],
    p = W.components.position[id];
  switch (want) {
    case "partner":
      return !!soc?.partnerId;
    case "child":
      return (ident.children?.length || 0) > (ident.wantBaseline || 0);
    case "voice":
      return W.factions.some((f) => f.leaderId === id);
    case "mastery":
      return SKILL_KEYS.some((k) => (ident.skills?.[k] || 0) >= 40);
    case "home": {
      const s = p ? nearestSettlement(idx(p.x, p.y), 6) : null;
      return !!s && !s.ruined && completedBuildings(s, "shelter").length > 0;
    }
    case "journey":
      return !!p && ident.birthTile >= 0 && dist2(p.x, p.y, ...xy(ident.birthTile)) >= 900;
    case "found":
      return (ident.settlementsFounded?.length || 0) > 0 || W.camps.some((c) => c.founderId === id);
    case "faith": {
      const c = soc?.cultureId ? W.cultures.find((x) => x.id === soc.cultureId) : null;
      return !!c?.belief?.named && c.belief.rites > 0;
    }
    default:
      return false;
  }
}
function updateWants() {
  for (const id of W.activeIds) {
    if (W.kind[id] !== KINDS.PERSON || !classifyAlive(id) || !isAdultPerson(id)) continue;
    const ident = characterOf(id);
    if (!ident) continue;
    const soc = W.components.social[id];
    if (!ident.want) {
      ident.wantsChosen = (ident.wantsChosen || 0) + 1;
      ident.want = { id: chooseWant(id, ident), since: W.tick };
      if (ident.want.id === "child") ident.wantBaseline = ident.children?.length || 0;
      continue;
    }
    const want = ident.want;
    if (wantFulfilled(id, ident, want.id)) {
      ident.fulfilled = (ident.fulfilled || []).concat(want.id).slice(-6);
      ident.significance += 3;
      setEmotionImpulse(id, { contentment: 0.25 }, 0, "✨");
      emitEvent("AspirationEvent", {
        subjects: [id],
        location: personTile(id),
        factions: soc?.factionId ? [soc.factionId] : [],
        evidence: [`wanted ${WANT_DEFS[want.id][0]} since Year ${formatYear(want.since)}`],
        importance: ident.notable ? 3 : 2,
        data: {
          want: want.id,
          outcome: "fulfilled",
          name: ident.generatedName,
          text: WANT_DEFS[want.id][1],
        },
      });
      ident.want = null;
    } else if (W.tick - want.since > TICKS_PER_YEAR * 6) {
      setEmotionImpulse(id, { sadness: 0.15 }, 0);
      emitEvent("AspirationEvent", {
        subjects: [id],
        location: personTile(id),
        factions: soc?.factionId ? [soc.factionId] : [],
        evidence: [`six years wanting ${WANT_DEFS[want.id][0]}`],
        importance: 1,
        data: {
          want: want.id,
          outcome: "abandoned",
          name: ident.generatedName,
          text: `gave up wanting ${WANT_DEFS[want.id][0]}`,
        },
      });
      ident.want = null;
    }
  }
}
// Birthplace is remembered so a journey can be measured; traits are read at birth.
const createOrganismCharacterBase = createOrganism;
createOrganism = function (kind, x, y, rng, parents = [], sourceTile = -1, divineInput = 0) {
  const id = createOrganismCharacterBase(kind, x, y, rng, parents, sourceTile, divineInput);
  if (kind === KINDS.PERSON && id && W.components.identity[id]) {
    W.components.identity[id].birthTile = idx(x, y);
    characterOf(id);
  }
  return id;
};
const updateWeatherCycleCharacterBase = updateWeatherCycle;
updateWeatherCycle = function () {
  updateWeatherCycleCharacterBase();
  if (W.tick % 128 === 40) updateWants();
};
// ── Chronicle sentences ────────────────────────────────────────────────────────
const eventSentenceCharacterBase = eventSentence;
eventSentence = function (e) {
  switch (e.type) {
    case "MasteryEvent":
      return `${e.data.name} was recognised as ${e.data.title}.`;
    case "AspirationEvent":
      return `${e.data.name} ${e.data.text}.`;
    default:
      return eventSentenceCharacterBase(e);
  }
};
// ── Inspector and Legends ──────────────────────────────────────────────────────
function characterCard(ident) {
  const traits = (ident.traits || [])
      .map(
        (t) =>
          `<span class="tag" title="${esc(TRAIT_DEFS[t]?.[1] || "")}">${esc(TRAIT_DEFS[t]?.[0] || t)}</span>`,
      )
      .join(""),
    skills = SKILL_KEYS.map((k) => [k, ident.skills?.[k] || 0])
      .filter(([, v]) => v >= 5)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4),
    want = ident.want
      ? `${esc(WANT_DEFS[ident.want.id]?.[0] || ident.want.id)} <span class="muted">since Year ${formatYear(ident.want.since)}</span>`
      : ident.fulfilled?.length
        ? `content for now · last ${esc(WANT_DEFS[ident.fulfilled.at(-1)]?.[1] || "")}`
        : "nothing yet";
  return `<div class="card character-card"><div class="subhead" style="margin-top:0">Character</div><div class="row wrap" style="gap:4px">${traits || '<span class="muted">unremarkable so far</span>'}</div><div class="kv" style="margin-top:6px"><span>Wants</span><b>${want}</b><span>Skills</span><b>${skills.length ? skills.map(([k, v]) => `${titleCase(k)} ${Math.round(v)}`).join(" · ") : "none yet"}</b></div></div>`;
}
const refreshInspectorCharacterBase = refreshInspector;
refreshInspector = function () {
  refreshInspectorCharacterBase();
  const id = UI.selectedEntity;
  if (!W || !id || W.kind[id] !== KINDS.PERSON || !DOM.inspectPane?.insertAdjacentHTML) return;
  const ident = W.components.identity[id];
  if (!ident || (!ident.traits && !ident.skills && !ident.want)) return;
  const anchor = DOM.inspectPane.querySelector?.(".legend-entry");
  if (anchor?.insertAdjacentHTML) anchor.insertAdjacentHTML("afterend", characterCard(ident));
  else DOM.inspectPane.insertAdjacentHTML("afterbegin", characterCard(ident));
};
const renderLifePageCharacterBase = renderLifePage;
renderLifePage = function (id) {
  const html = renderLifePageCharacterBase(id),
    ident = W.components.identity[id] || W.historicalIdentities[id];
  if (!ident || (W.kind[id] !== KINDS.PERSON && ident.kind !== KINDS.PERSON && !ident.traits))
    return html;
  if (!ident.traits && !ident.skills) return html;
  return html + characterCard(ident);
};
window.ALIFE_CHARACTER_DEBUG = Object.freeze({
  ensure: (id) => characterOf(id),
  ensureAll: () => {
    let n = 0;
    for (const id of W.activeIds) if (W.kind[id] === KINDS.PERSON && characterOf(id)) n++;
    return n;
  },
  update: () => {
    updateWants();
    return W.activeIds.filter(
      (id) => W.kind[id] === KINDS.PERSON && W.components.identity[id]?.want,
    ).length;
  },
  grant: (id, skill, amount) => {
    grantSkill(id, skill, amount);
    return W.components.identity[id]?.skills;
  },
  fightBonus: (id) => fightBonus(id),
  card: (id) => characterCard(W.components.identity[id] || {}),
  traits: TRAIT_DEFS,
});
