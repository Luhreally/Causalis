// ═══════════════════════════════════════════════════════════════════════════
// 74. WAR-WEARINESS — polities tire of war and fight one at a time
// ═══════════════════════════════════════════════════════════════════════════
// War pressure between two polities decays by a fixed share each cycle and is
// fed by borders, scarcity, grievance, ethos, and aggression, so once a dozen
// polities share a map most pairs settle above the threshold and everyone is
// at war with everyone: a probe counted twenty-eight wars running at once
// among twelve polities. Here each polity carries a weariness that rises for
// every war it fights and every casualty it takes and fades slowly in peace.
// Weariness and the wars already under way shrink a polity's appetite for new
// pressure, wars whose peoples are both weary end, wars with no battle in three
// years peter out, weary courts accept peace more readily, and a weary people
// simmers. Rendering only reads the world.
const WEARINESS_PER_WAR = 0.035,
  WEARINESS_PER_CASUALTY = 0.01,
  WEARINESS_REST = 0.012,
  WEARY_END = 1.0,
  STALE_WAR = TICKS_PER_YEAR * 3;
function ensureWeariness(world = W) {
  if (!world) return;
  for (const f of world.factions || []) if (!Number.isFinite(f.weariness)) f.weariness = 0;
}
const restoreWorldWearinessBase = restoreWorldDefaults;
restoreWorldDefaults = function () {
  restoreWorldWearinessBase();
  ensureWeariness(W);
};
function warsActive(f) {
  if (!f) return 0;
  let n = 0;
  for (const w of W.activeWars) if (!w.ended && (w.a === f.id || w.b === f.id)) n++;
  return n;
}
// Appetite for a new war: 1 when idle and rested, falling with wars already
// fought and with weariness.
function warAppetite(a, b) {
  const wars = Math.min(3, warsActive(a)) + Math.min(3, warsActive(b)),
    weary = Math.max(a?.weariness || 0, b?.weariness || 0);
  return (1 / (1 + 0.7 * wars)) * (1 - 0.5 * weary);
}
const relationPressureWearinessBase = relationPressure;
relationPressure = function (a, b) {
  const p = relationPressureWearinessBase(a, b),
    appetite = warAppetite(a, b),
    wars = Math.max(warsActive(a), warsActive(b)),
    weary = Math.max(a?.weariness || 0, b?.weariness || 0);
  p.appetite = appetite;
  p.pressure *= appetite;
  // A polity already fighting two wars will not be pressed into a third, and an
  // exhausted people barely feels the old grievances.
  if (wars >= 2 && !warBetween(a, b)) p.pressure = Math.min(p.pressure, 10);
  if (weary > 0.6) p.pressure *= 0.4;
  return p;
};
function updateWeariness() {
  ensureWeariness();
  const fought = new Map();
  for (const w of W.activeWars) {
    if (w.ended) continue;
    const gained = (w.casualties || 0) - (w.wearinessCasualties || 0);
    w.wearinessCasualties = w.casualties || 0;
    for (const id of [w.a, w.b])
      fought.set(
        id,
        (fought.get(id) || 0) +
          WEARINESS_PER_WAR +
          Math.max(0, gained) * WEARINESS_PER_CASUALTY * 0.5,
      );
  }
  for (const f of W.factions) {
    if (f.stability <= 0) continue;
    const gain = fought.get(f.id);
    f.weariness = gain
      ? Math.min(1, f.weariness + gain)
      : Math.max(0, f.weariness - WEARINESS_REST);
  }
  // Grievances fade a little each cycle when the two are not at war.
  for (const f of W.factions)
    for (const rel of Object.values(f.relations || {}))
      if (rel.status !== "at war" && rel.grievance > 0) rel.grievance *= 0.97;
  // Polities already fighting two wars do not slide into a third.
  for (const a of W.factions) {
    if (a.stability <= 0 || warsActive(a) < 2) continue;
    for (const [id, rel] of Object.entries(a.relations || {})) {
      const b = W.factions.find((f) => f.id === Number(id));
      if (!b || rel.status === "at war" || warBetween(a, b)) continue;
      if (rel.pressure > 90) {
        rel.pressure = 90;
        const rev = b.relations?.[a.id];
        if (rev && rev.pressure > 90) rev.pressure = 90;
      }
    }
  }
  // Wars end when both peoples are weary, or when nothing has happened for years.
  for (const war of W.activeWars.slice()) {
    if (war.ended) continue;
    const a = W.factions.find((f) => f.id === war.a),
      b = W.factions.find((f) => f.id === war.b);
    if (!a || !b) continue;
    if (war.turns >= 6 && (a.weariness || 0) + (b.weariness || 0) >= WEARY_END)
      endWar(war, a, b, "both peoples were weary of war");
    else if (!(war.casualties > 0) && W.tick - war.started > STALE_WAR)
      endWar(war, a, b, "the war petered out without a battle");
  }
}
const updateWeatherCycleWearinessBase = updateWeatherCycle;
updateWeatherCycle = function () {
  updateWeatherCycleWearinessBase();
  if (!W?.factions || !W.activeWars) return;
  if (W.tick % 128 === 100) updateWeariness();
};
const unrestOfWearinessBase = unrestOf;
unrestOf = function (place) {
  const f = place?.factionId ? W.factions.find((x) => x.id === place.factionId) : null;
  return unrestOfWearinessBase(place) + (f?.weariness || 0) * 0.1;
};
function wearinessWord(f) {
  const w = f?.weariness || 0;
  return w >= 0.75
    ? "exhausted by war"
    : w >= 0.45
      ? "war-weary"
      : w >= 0.2
        ? "tired of fighting"
        : "";
}
const renderFactionPageWearinessBase = renderFactionPage;
renderFactionPage = function (id) {
  const html = renderFactionPageWearinessBase(id),
    f = W.factions.find((x) => x.id === id),
    word = f ? wearinessWord(f) : "";
  if (!word) return html;
  const row = `<div class="kv"><span>War-weariness</span><b>${esc(word)} · ${Math.round(f.weariness * 100)}%</b></div>`,
    at = html.indexOf('<div class="subhead">');
  return at < 0 ? html + row : html.slice(0, at) + row + html.slice(at);
};
window.ALIFE_WEARINESS_DEBUG = Object.freeze({
  update: () => updateWeariness(),
  weariness: (factionId) => W.factions.find((f) => f.id === factionId)?.weariness ?? null,
  wars: (factionId) => warsActive(W.factions.find((f) => f.id === factionId)),
  appetite: (a, b) =>
    warAppetite(
      W.factions.find((f) => f.id === a),
      W.factions.find((f) => f.id === b),
    ),
  pressure: (a, b) =>
    relationPressure(
      W.factions.find((f) => f.id === a),
      W.factions.find((f) => f.id === b),
    ),
});
