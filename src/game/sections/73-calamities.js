// ═══════════════════════════════════════════════════════════════════════════
// 73. CALAMITIES — disasters feed unrest and topple Voices
// ═══════════════════════════════════════════════════════════════════════════
// Quakes, eruptions, and meteor strikes already crack buildings and kill. Here
// they also shake the order of a town: a stricken town carries a calamity that
// fades over years, raises its unrest while it lasts, and can cost the Voice
// of the polity its seat when the capital itself is struck, since a people
// reads a disaster as a judgement on whoever rules them. Each stricken town is
// chronicled, and a Voice deposed for a calamity is remembered as blamed for
// it. Rendering only reads the world.
const CALAMITY_REACH = Object.freeze({ EarthquakeEvent: 14, EruptionEvent: 18, MeteorEvent: 10 }),
  CALAMITY_WORDS = Object.freeze({
    EarthquakeEvent: "quake",
    EruptionEvent: "eruption",
    MeteorEvent: "meteor",
  }),
  CALAMITY_DECAY = 0.03,
  BLAME_THRESHOLD = 0.5;
function ensureCalamities(world = W) {
  if (!world) return;
  world.calamities = world.calamities || { lastEventId: 0, blamed: 0 };
}
const restoreWorldCalamityBase = restoreWorldDefaults;
restoreWorldDefaults = function () {
  restoreWorldCalamityBase();
  ensureCalamities(W);
};
function strikeTown(s, kind, magnitude, cause) {
  s.calamity = Math.min(1, (s.calamity || 0) + magnitude);
  s.calamityTick = W.tick;
  s.calamityKind = kind;
  const f = W.factions.find((x) => x.id === s.factionId);
  return emitEvent("CalamityEvent", {
    subjects: [s.entityId, f?.leaderId].filter(Boolean),
    location: idx(s.x, s.y),
    factions: f ? [f.id] : [],
    causes: [cause].filter(Boolean),
    evidence: [`the ${kind} reached ${s.name}`, `calamity ${s.calamity.toFixed(2)}`],
    importance: 3,
    data: {
      place: s.name,
      kind,
      polity: f?.name || "",
      capital: !!f && f.capitalSettlementId === s.id,
      magnitude: +magnitude.toFixed(2),
    },
  });
}
function scanCalamities() {
  const since = W.calamities.lastEventId || 0,
    fresh = [];
  for (let n = W.events.length - 1; n >= 0; n--) {
    const e = W.events[n];
    if (e.id <= since) break;
    if (CALAMITY_REACH[e.type] && e.location >= 0) fresh.push(e);
  }
  if (W.events.length) W.calamities.lastEventId = W.events[W.events.length - 1].id;
  fresh.reverse();
  for (const e of fresh) {
    const [ex, ey] = xy(e.location),
      reach = CALAMITY_REACH[e.type],
      kind = CALAMITY_WORDS[e.type];
    for (const s of W.settlements) {
      if (s.ruined || !s.knownProcesses) continue;
      const d = Math.sqrt(dist2(s.x, s.y, ex, ey));
      if (d > reach) continue;
      const magnitude = clamp(
        (1 - d / reach) * (0.35 + (e.magnitude || e.data?.magnitude || 1) * 0.25),
        0.1,
        0.9,
      );
      strikeTown(s, kind, magnitude, e.id);
    }
  }
}
function blameVoices(force = false) {
  for (const f of W.factions) {
    if (f.stability <= 0 || !f.leaderId) continue;
    const capital = W.settlements.find((s) => s.id === f.capitalSettlementId);
    if (!capital || capital.ruined || (capital.calamity || 0) < BLAME_THRESHOLD) continue;
    if (W.tick - (capital.calamityTick || 0) > TICKS_PER_YEAR * 2) continue;
    if (!force && W.tick - (f.lastUpheaval || -99999) < TICKS_PER_YEAR * 6) continue;
    if (!force && counterRand("blame", Math.floor(W.tick / 256), f.id) > 0.25) continue;
    const claimant = typeof rebelLeader === "function" ? rebelLeader(capital, f) : 0;
    if (!claimant || claimant === f.leaderId) continue;
    const voice = f.leaderId,
      kind = capital.calamityKind || "calamity",
      ev = typeof coup === "function" ? coup(f, claimant, capital) : null;
    if (!ev) continue;
    W.calamities.blamed++;
    emitEvent("BlamedVoiceEvent", {
      subjects: [voice, claimant, capital.entityId].filter(Boolean),
      location: idx(capital.x, capital.y),
      factions: [f.id],
      causes: [W.lastEventByType.CalamityEvent, ev.id || W.lastEventByType.CoupEvent].filter(
        Boolean,
      ),
      evidence: [`the ${kind} struck the capital`, `calamity ${capital.calamity.toFixed(2)}`],
      importance: 4,
      data: { polity: f.name, place: capital.name, kind },
    });
    capital.calamity = Math.max(0, capital.calamity - 0.3);
  }
}
function fadeCalamities() {
  for (const s of W.settlements)
    if (s.calamity > 0) {
      s.calamity = Math.max(0, s.calamity - CALAMITY_DECAY);
      if (!s.calamity) s.calamityKind = "";
    }
}
function updateCalamities() {
  ensureCalamities();
  scanCalamities();
  blameVoices();
}
const updateWeatherCycleCalamityBase = updateWeatherCycle;
updateWeatherCycle = function () {
  updateWeatherCycleCalamityBase();
  if (!W?.settlements) return;
  ensureCalamities(W);
  if (W.tick % 64 === 20) updateCalamities();
  if (W.tick % 128 === 104) fadeCalamities();
};
const unrestOfCalamityBase = unrestOf;
unrestOf = function (place) {
  return unrestOfCalamityBase(place) + (place?.calamity || 0) * 0.25;
};
// ── Chronicle and Legends ──────────────────────────────────────────────────────
const eventSentenceCalamityBase = eventSentence;
eventSentence = function (e) {
  const d = e.data || {};
  switch (e.type) {
    case "CalamityEvent":
      return `The ${d.kind} reached ${d.place}${d.polity ? ` of ${d.polity}` : ""}${
        d.capital ? ", the capital itself," : ""
      } and the people looked to their Voice.`;
    case "BlamedVoiceEvent":
      return `The Voice of ${d.polity} was blamed for the ${d.kind} that struck ${d.place} and deposed.`;
    default:
      return eventSentenceCalamityBase(e);
  }
};
const songTitleForCalamityBase = songTitleFor;
songTitleFor = function (event) {
  const d = event.data || {};
  if (event.type === "CalamityEvent")
    return {
      kind: "song",
      title: `The ${d.kind.charAt(0).toUpperCase() + d.kind.slice(1)} at ${d.place}`,
    };
  if (event.type === "BlamedVoiceEvent")
    return { kind: "tale", title: `How ${d.polity} Blamed Its Voice` };
  return songTitleForCalamityBase(event);
};
const renderPlacePageCalamityBase = renderPlacePage;
renderPlacePage = function (id) {
  const html = renderPlacePageCalamityBase(id),
    s = W.settlements.find((x) => x.id === id);
  if (!s || !(s.calamity > 0)) return html;
  const row = `<div class="kv"><span>Calamity</span><b>${esc(s.calamityKind || "struck")} in year ${formatYear(s.calamityTick || 0)} · ${Math.round(s.calamity * 100)}% still felt</b></div>`,
    at = html.indexOf('<div class="subhead">Chronicle</div>');
  return at < 0 ? html + row : html.slice(0, at) + row + html.slice(at);
};
window.ALIFE_CALAMITY_DEBUG = Object.freeze({
  update: () => updateCalamities(),
  fade: () => fadeCalamities(),
  strike: (settlementId, kind = "quake", magnitude = 0.7) => {
    const s = W.settlements.find((x) => x.id === settlementId);
    return s ? strikeTown(s, kind, magnitude, 0) : null;
  },
  blame: (force = false) => blameVoices(force),
  state: (settlementId) => {
    const s = W.settlements.find((x) => x.id === settlementId);
    return s
      ? { calamity: s.calamity || 0, kind: s.calamityKind || "", tick: s.calamityTick || 0 }
      : null;
  },
});
