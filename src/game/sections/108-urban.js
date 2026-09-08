// ═══════════════════════════════════════════════════════════════════════════
// 108. THE PULL OF THE CITY — villagers move to the polity's great town, and cities rise
// ═══════════════════════════════════════════════════════════════════════════
// A hundred and sixty years on the Earth-like seed raised twenty-three villages
// and not one city: settlers kept founding new hamlets, the largest town held
// forty-five people, and the towers, offices, and factories that wait on a
// city never came. People had no reason to move to town. Now they do. Once a
// polity knows Recorded Governance, the Census, or Public Works, its largest
// town with a hall becomes the pull of the city: every year a few people leave
// each village of the polity for it while it has food to spare and the peace
// to keep, walking there as migrants and taking it as their home, so that
// beds run short, tenements and towers are planned, research quickens with
// the crowd, and the urban stage arrives. A village is never drained below a
// living floor, and the great town itself sends out fewer settlers than a
// village would. Every year's movement is chronicled and the town's page
// counts who it has drawn in. Rendering only reads.
const URBAN_TICK = 184,
  URBAN_MIN_HUB = 20,
  URBAN_VILLAGE_FLOOR = 8,
  URBAN_PER_VILLAGE = 2,
  URBAN_ROUGH = 2,
  URBAN_REACH = 60,
  URBAN_FOOD = 5,
  URBAN_UNREST = 0.45,
  URBAN_VILLAGE_REST = TICKS_PER_YEAR * 2,
  URBAN_HUB_URGE = 0.5,
  URBAN_AGE_TECHS = Object.freeze(["governance", "census", "public_works"]);
function urbanAge(f) {
  return !!f && URBAN_AGE_TECHS.some((t) => factionHasTech(f.id, t));
}
function polityTowns(f) {
  return W.settlements.filter((s) => !s.ruined && s.knownProcesses && s.factionId === f.id);
}
// The largest town of the polity that keeps a hall.
function urbanHub(f) {
  if (!f) return null;
  return (
    polityTowns(f)
      .filter((s) => completedBuildings(s, "hall").length > 0)
      .map((s) => ({ s, pop: settlementPopulation(s) }))
      .filter((x) => x.pop >= URBAN_MIN_HUB)
      .sort((a, b) => b.pop - a.pop || a.s.id - b.s.id)[0]?.s || null
  );
}
// Beds to spare; a city without them still draws a couple who live rough, so
// the shortage is felt and housing gets planned.
function hubRoom(hub) {
  const spare = housingCapacity(hub) - settlementPopulation(hub);
  if (spare > 0) return spare;
  return typeof cityStage === "function" && cityStage(hub) ? URBAN_ROUGH : 0;
}
function urbanPull(f, force = false) {
  const hub = urbanHub(f);
  if (!hub) return null;
  if (!force) {
    if (settlementFood(hub) < URBAN_FOOD) return null;
    if (typeof unrestOf === "function" && unrestOf(hub) > URBAN_UNREST) return null;
    if (typeof blockadeOf === "function" && blockadeOf(hub)) return null;
  }
  let room = hubRoom(hub);
  if (force) room = Math.max(room, URBAN_PER_VILLAGE);
  if (room <= 0) return null;
  const from = idx(hub.x, hub.y),
    movers = [],
    villages = [];
  for (const village of polityTowns(f)
    .filter((s) => s !== hub)
    .sort((a, b) => dist2(a.x, a.y, hub.x, hub.y) - dist2(b.x, b.y, hub.x, hub.y) || a.id - b.id)) {
    if (movers.length >= room) break;
    if (!force && W.tick - (village.lastUrbanTick || -1e9) < URBAN_VILLAGE_REST) continue;
    if (Math.sqrt(dist2(village.x, village.y, hub.x, hub.y)) > URBAN_REACH) continue;
    const pop = settlementPopulation(village),
      take = Math.min(URBAN_PER_VILLAGE, room - movers.length, pop - URBAN_VILLAGE_FLOOR);
    if (take <= 0) continue;
    if (typeof civilReachable === "function" && !civilReachable(from, { x: village.x, y: village.y }, f.id)) continue;
    const people = typeof caravanCandidates === "function" ? caravanCandidates(village, take) : [];
    if (!people.length) continue;
    for (const id of people) issueCivilOrder(id, "migrate", hub.x, hub.y, { placeId: hub.id, fromPlaceId: village.id });
    village.lastUrbanTick = W.tick;
    movers.push(...people);
    villages.push(village.name);
  }
  if (!movers.length) return null;
  hub.urbanIn = (hub.urbanIn || 0) + movers.length;
  hub.lastUrbanTick = W.tick;
  return emitEvent("UrbanMigrationEvent", {
    subjects: [...movers, hub.entityId],
    location: from,
    factions: [f.id],
    causes: [hub.importantEvents?.at(-1) || 0].filter(Boolean),
    evidence: [
      `${movers.length} people left ${villages.length} village${villages.length === 1 ? "" : "s"} for ${hub.name}`,
      `${hub.name} held ${settlementPopulation(hub)} people and ${housingCapacity(hub)} beds`,
    ],
    importance: movers.length >= 6 ? 3 : 2,
    data: { count: movers.length, hub: hub.name, polity: f.name, villages: villages.join(", ") },
  });
}
function updateUrban() {
  const out = [];
  for (const f of W.factions) {
    if (!(f.stability > 0) || !urbanAge(f)) continue;
    const ev = urbanPull(f);
    if (ev) out.push(ev);
  }
  return out;
}
const simTickUrbanBase = simTick;
simTick = function () {
  simTickUrbanBase();
  if (W?.settlements && W.tick % 256 === URBAN_TICK) updateUrban();
};
// The great town keeps its people: it sends out half the settlers a village would.
const settlerUrgeUrbanBase = settlerUrge;
settlerUrge = function (place) {
  const urge = settlerUrgeUrbanBase(place),
    f = place?.factionId ? W.factions.find((x) => x.id === place.factionId) : null;
  if (f && urbanAge(f) && urbanHub(f) === place) return urge * URBAN_HUB_URGE;
  return urge;
};
// ── Chronicle and Legends ────────────────────────────────────────────────────
const eventSentenceUrbanBase = eventSentence;
eventSentence = function (e) {
  const d = e.data || {};
  if (e.type === "UrbanMigrationEvent") return `${d.count} people left ${d.villages || "the villages"} for ${d.hub}${d.polity ? ` of ${d.polity}` : ""}.`;
  return eventSentenceUrbanBase(e);
};
const alertWorthyUrbanBase = alertWorthy;
alertWorthy = function (a) {
  return alertWorthyUrbanBase(a) || (a.type === "UrbanMigrationEvent" && a.importance >= 3);
};
const renderPlacePageUrbanBase = renderPlacePage;
renderPlacePage = function (id) {
  const html = renderPlacePageUrbanBase(id),
    s = W.settlements.find((x) => x.id === id);
  if (!s?.urbanIn) return html;
  const row = `<div class="kv"><span>Drawn in</span><b>${s.urbanIn} ${s.urbanIn === 1 ? "person" : "people"} from the villages</b></div>`,
    at = html.indexOf('<div class="subhead">');
  return at < 0 ? html + row : html.slice(0, at) + row + html.slice(at);
};
window.ALIFE_URBAN_DEBUG = Object.freeze({
  age: (factionId) => urbanAge(W.factions.find((f) => f.id === factionId)),
  hub: (factionId) => urbanHub(W.factions.find((f) => f.id === factionId))?.id || 0,
  room: (placeId) => hubRoom(W.settlements.find((s) => s.id === placeId)),
  pull: (factionId, force = false) => urbanPull(W.factions.find((f) => f.id === factionId), force),
  tick: () => updateUrban(),
});
