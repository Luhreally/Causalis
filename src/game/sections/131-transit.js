// ═══════════════════════════════════════════════════════════════════════════
// 131. TRANSIT — a press runs with the ship, and says where it is
// ═══════════════════════════════════════════════════════════════════════════
// After the first ship leaves, the skip's objectives are the continuing
// crafts (120) and, past them, the colony. Every craft learned is a milestone
// and stops the press, so on battery causal-origin the forty-seven years of
// the voyage were sixteen presses of "Reached Hydroponics", "Reached
// Antibiotics", each a year or two long, with nothing said of the ship. The
// research is worth doing and worth recording; it is not worth sixteen stops.
// While a ship is under way and the colony is what the world waits for, the
// crafts are still worked toward and still recorded in the chronicle but do
// not end the press, and the press's horizon reaches to the arrival, so a
// voyage is one or two presses. The result says where the ship is.
//
// Nothing here changes the simulation: the same ticks run; only where the
// skip chooses to stop, and one sentence of its report, differ.
const TRANSIT_MAX_TICKS = TICKS_PER_YEAR * 64;
function transitUnderWay() {
  return (W?.voyages || []).filter((v) => v.status === "under way").sort((a, b) => a.arriveTick - b.arriveTick)[0] || null;
}
function transitSentence(voyage) {
  if (!voyage) return "";
  const perLightYear = typeof ORBIT_TICKS_PER_LIGHTYEAR === "number" ? ORBIT_TICKS_PER_LIGHTYEAR : TICKS_PER_YEAR * 2,
    total = Math.max(1, voyage.arriveTick - voyage.departTick),
    left = Math.max(0, voyage.arriveTick - W.tick),
    lightYearsOut = ((total - left) / perLightYear).toFixed(1),
    arrival = typeof formatYear === "function" ? formatYear(voyage.arriveTick) : String(Math.floor(voyage.arriveTick / TICKS_PER_YEAR));
  if (!left) return `${voyage.name} has reached ${voyage.starName}.`;
  return `${voyage.name} is ${lightYearsOut} light-years out, bound for ${voyage.starName}; it arrives in year ${arrival}.`;
}
const makeCausalSkipStateTransitBase = makeCausalSkipState;
makeCausalSkipState = function (limitOverride = 0) {
  const state = makeCausalSkipStateTransitBase(limitOverride),
    voyage = transitUnderWay();
  if (!voyage || !state.pending?.some((s) => s.key === "colony")) return state;
  for (const stage of state.pending) if (String(stage.key).startsWith("inquiry:")) stage.quiet = true;
  if (!(limitOverride > 0)) state.limit = Math.max(state.limit, Math.min(TRANSIT_MAX_TICKS, voyage.arriveTick - W.tick + 16));
  state.transit = voyage.id;
  return state;
};
const causalSkipResultTransitBase = causalSkipResult;
causalSkipResult = function (state) {
  const out = causalSkipResultTransitBase(state),
    voyage = transitUnderWay() || (W?.voyages || []).find((v) => v.id === state?.transit) || null;
  if (voyage) out.note = transitSentence(voyage);
  return out;
};
window.ALIFE_TRANSIT_DEBUG = Object.freeze({
  underWay: () => transitUnderWay(),
  sentence: () => transitSentence(transitUnderWay()),
});
