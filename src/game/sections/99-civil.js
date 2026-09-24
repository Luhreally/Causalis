// ═══════════════════════════════════════════════════════════════════════════
// 99. CIVIL SOCIETY — children learn, circles speak, and the law has a code
// ═══════════════════════════════════════════════════════════════════════════
// Skill came only from doing. Now it is also taught: every year a child learns
// a little of each living parent's best craft, and a child whose town keeps
// an archive learns a little lore from it, so houses of smiths and houses of
// keepers of lore come to exist. The specialist circles the economy already
// observes gain a voice: a town with circles is calmer for their order, and
// when unrest still climbs a circle petitions its polity, which answers with
// relief and a little steadiness, once in a couple of years. And the law has
// a code: a polity that knows Recorded Governance adopts one from its
// ideology (banishment for the authoritarian, fines and restitution for the
// open, the blood-price for the rest); under any code feuds cool faster and
// towns are calmer; under fines a robber returns what was taken; under
// banishment a twice-caught robber is driven out; under the blood-price a
// cooled feud is settled by payment and a robbery softens once paid. The
// polity page names the law, the place page names its circles, and the
// Chronicle keeps petitions, judgements, and adoptions. Deterministic;
// nothing here creates matter.
const TEACH_CADENCE = 256,
  TEACH_OFFSET = 48,
  TEACH_PARENT = 0.6,
  TEACH_ARCHIVE = 0.5,
  TEACH_MIN_SKILL = 20,
  CIRCLE_CALM = 0.03,
  CIRCLE_CALM_CAP = 0.09,
  PETITION_UNREST = 0.35,
  PETITION_GAP = 512,
  PETITION_RELIEF = 0.1,
  LAW_CODES = Object.freeze({
    wergild: "the blood-price",
    fines: "fines and restitution",
    exile: "banishment",
  }),
  LAW_CALM = 0.05,
  LAW_COOLING = 0.9,
  WERGILD_HEAT = 1.2,
  CIVIL = { taught: 0, petitions: 0, fines: 0, exiles: 0 };
// ── Children learn ────────────────────────────────────────────────────────────
function homeTownOf(id) {
  const soc = W.components.social[id];
  if (soc?.homePlaceKind !== "settlement") return null;
  const home = W.settlements.find((s) => s.id === soc.homePlaceId);
  return home && !home.ruined ? home : null;
}
function teachChild(id) {
  const ident = characterOf(id);
  if (!ident) return 0;
  let lessons = 0;
  for (const parent of ident.parents || []) {
    if (!classifyAlive(parent) || W.kind[parent] !== KINDS.PERSON) continue;
    const pi = W.components.identity[parent],
      skill = pi?.skills ? topSkill(pi) : "";
    if (!skill || (pi.skills[skill] || 0) < TEACH_MIN_SKILL) continue;
    grantSkill(id, skill, TEACH_PARENT);
    lessons++;
  }
  const home = homeTownOf(id);
  if (home && completedBuildings(home, "archive").length) {
    grantSkill(id, "lore", TEACH_ARCHIVE);
    lessons++;
  }
  return lessons;
}
function teachChildren() {
  let taught = 0;
  for (const id of W.activeIds) {
    if (W.kind[id] !== KINDS.PERSON || !classifyAlive(id) || isAdultPerson(id)) continue;
    taught += teachChild(id);
  }
  CIVIL.taught += taught;
  return taught;
}
// ── Circles speak ─────────────────────────────────────────────────────────────
function townCircles(place) {
  if (!place) return [];
  return (W.institutions || []).filter(
    (i) => i.active && i.type === "specialist_circle" && i.settlementIds.includes(place.id),
  );
}
function circleCalm(place) {
  return Math.min(CIRCLE_CALM_CAP, townCircles(place).length * CIRCLE_CALM);
}
function lawCodeOf(f) {
  return f && f.stability > 0 && f.law ? f.law.code : null;
}
const unrestOfCivilBase = unrestOf;
unrestOf = function (place) {
  const unrest = unrestOfCivilBase(place);
  if (!place?.knownProcesses) return unrest;
  const calm = circleCalm(place) + (lawCodeOf(polityOf(place)) ? LAW_CALM : 0);
  return calm ? Math.max(0, +(unrest - calm).toFixed(3)) : unrest;
};
function circlePetitions() {
  let heard = 0;
  for (const place of W.settlements) {
    if (place.ruined || !place.knownProcesses || (place.unrest || 0) < PETITION_UNREST) continue;
    if (W.tick - (place.lastPetitionTick || -1e9) < PETITION_GAP) continue;
    const circles = townCircles(place),
      f = polityOf(place);
    if (!circles.length || !f) continue;
    place.lastPetitionTick = W.tick;
    place.unrest = Math.max(0, +(place.unrest - PETITION_RELIEF).toFixed(3));
    place.stability = clamp((place.stability || 0) + 0.02, 0, 1);
    emitEvent("PetitionEvent", {
      subjects: [place.entityId, f.leaderId].filter(Boolean),
      location: idx(place.x, place.y),
      factions: [f.id],
      causes: [W.lastEventByType.UnrestEvent, circles[0].causeEvent].filter(Boolean),
      evidence: [
        `${circles.length} circle${circles.length === 1 ? "" : "s"} spoke`,
        `unrest ${place.unrest.toFixed(2)}`,
      ],
      importance: 3,
      data: { place: place.name, polity: f.name, circle: circles[0].name, circles: circles.length },
    });
    heard++;
  }
  CIVIL.petitions += heard;
  return heard;
}
// ── The law has a code ────────────────────────────────────────────────────────
function adoptLawCodes() {
  let adopted = 0;
  for (const f of W.factions) {
    if (f.stability <= 0 || f.law || !factionHasTech(f.id, "governance")) continue;
    const code = chooseLawCode(f),
      capital = factionCapital(f);
    f.law = { code, adoptedTick: W.tick, eventId: 0 };
    f.law.eventId = emitEvent("LawEvent", {
      subjects: [f.leaderId, capital?.entityId].filter(Boolean),
      location: capital ? idx(capital.x, capital.y) : -1,
      factions: [f.id],
      causes: [W.lastEventByType.TechAdvanceEvent, W.lastEventByType.IdeologyEvent].filter(Boolean),
      evidence: [LAW_CODES[code], f.government || "its rule"],
      importance: 3,
      data: { polity: f.name, code, law: LAW_CODES[code], government: f.government || "" },
    }).id;
    adopted++;
  }
  return adopted;
}
function houseLaw(kinGroupId) {
  return lawCodeOf(housePolity(kinGroupId) ? factionById(housePolity(kinGroupId)) : null);
}
const updateFeudsCivilBase = updateFeuds;
updateFeuds = function () {
  updateFeudsCivilBase();
  for (const feud of W.feuds || []) {
    if (feud.ended) continue;
    const lawA = houseLaw(feud.a),
      lawB = houseLaw(feud.b);
    if (!lawA && !lawB) continue;
    feud.heat = +(feud.heat * LAW_COOLING).toFixed(4);
    if (lawA === "wergild" && lawB === "wergild" && feud.heat < WERGILD_HEAT)
      endFeud(feud, "a blood-price was paid under the law", 3);
  }
};
const robOfFoodCivilBase = robOfFood;
robOfFood = function (id, victim, hunger) {
  const ev = robOfFoodCivilBase(id, victim, hunger);
  if (ev) judgeRobbery(id, victim, ev);
  return ev;
};
// ── Tick hook ─────────────────────────────────────────────────────────────────
tickSystem("civil society", function () {
  if (!W?.settlements || !W.factions) return;
  if (W.tick % TEACH_CADENCE === TEACH_OFFSET) teachChildren();
  if (W.tick % 256 === 168) circlePetitions();
  if (W.tick % 256 === 176) adoptLawCodes();
});
// ── Chronicle and Legends ─────────────────────────────────────────────────────
eventText(["PetitionEvent", "LawEvent", "JudgementEvent"], function (e, next) {
  const d = e.data || {};
  if (e.type === "PetitionEvent")
    return `The ${d.circle} petitioned ${d.polity} over unrest in ${d.place}, and was heard.`;
  if (e.type === "LawEvent") return `${d.polity} set down a law code: ${d.law}.`;
  if (e.type === "JudgementEvent")
    return d.banished
      ? `${d.name} was banished from ${d.place} under ${d.polity}'s law of ${LAW_CODES[d.code] || d.code}.`
      : `${d.name} was made to return ${d.fine} units of food to ${d.victim} under ${d.polity}'s law.`;
  return next(e);
});
const alertWorthyCivilBase = alertWorthy;
alertWorthy = function (a) {
  return alertWorthyCivilBase(a) || a.type === "LawEvent" || a.type === "PetitionEvent";
};
pageBlock("faction", '<div class="subhead">', function (id) {
  const f = W.factions.find((x) => x.id === id);
  if (!f?.law) return "";
  const row = `<div class="kv"><span>Law</span><b>${esc(LAW_CODES[f.law.code] || f.law.code)}</b></div>`;
  return row;
});
pageBlock("place", '<div class="subhead">', function (id) {
  const place = W.settlements.find((s) => s.id === id),
    circles = townCircles(place);
  if (!circles.length) return "";
  const row = `<div class="kv"><span>Circles</span><b>${esc(circles.map((c) => c.name).join(", "))}</b></div>`;
  return row;
});
window.ALIFE_CIVIL_DEBUG = Object.freeze({
  codes: () => ({ ...LAW_CODES }),
  teach: () => teachChildren(),
  teachOne: (id) => teachChild(id),
  circles: (placeId) => townCircles(W.settlements.find((s) => s.id === placeId)).map((c) => c.name),
  calm: (placeId) => circleCalm(W.settlements.find((s) => s.id === placeId)),
  petition: () => circlePetitions(),
  adopt: () => adoptLawCodes(),
  law: (factionId) => lawCodeOf(W.factions.find((f) => f.id === factionId)),
  choose: (factionId) => chooseLawCode(W.factions.find((f) => f.id === factionId)),
  counts: () => ({ ...CIVIL }),
});
