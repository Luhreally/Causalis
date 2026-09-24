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
// The horizon first reached all the way to the arrival, up to sixty-four
// years: on battery causal-origin one press ran from year 59 to 104 and came
// back to a home world of fifty-four from seventy-eight, with nothing said of
// the forty-five years between. A voyage press now runs twelve years at most,
// so the player sees the home world every twelve voyage years, and the result
// adds a line on how it stands: the people, the towns, and the hungriest town
// in the plain words of 129.
//
// Nothing here changes the simulation: the same ticks run; only where the
// skip chooses to stop, and two sentences of its report, differ.
const TRANSIT_PRESS_TICKS = TICKS_PER_YEAR * 12;
function transitUnderWay() {
  return (
    (W?.voyages || [])
      .filter((v) => v.status === "under way")
      .sort((a, b) => a.arriveTick - b.arriveTick)[0] || null
  );
}
function transitSentence(voyage) {
  if (!voyage) return "";
  const perLightYear =
      typeof ORBIT_TICKS_PER_LIGHTYEAR === "number"
        ? ORBIT_TICKS_PER_LIGHTYEAR
        : TICKS_PER_YEAR * 2,
    total = Math.max(1, voyage.arriveTick - voyage.departTick),
    left = Math.max(0, voyage.arriveTick - W.tick),
    lightYearsOut = ((total - left) / perLightYear).toFixed(1),
    arrival =
      typeof formatYear === "function"
        ? formatYear(voyage.arriveTick)
        : String(Math.floor(voyage.arriveTick / TICKS_PER_YEAR));
  if (!left) return `${voyage.name} has reached ${voyage.starName}.`;
  return `${voyage.name} is ${lightYearsOut} light-years out, bound for ${voyage.starName}; it arrives in year ${arrival}.`;
}
const makeCausalSkipStateTransitBase = makeCausalSkipState;
makeCausalSkipState = function (limitOverride = 0) {
  const state = makeCausalSkipStateTransitBase(limitOverride),
    voyage = transitUnderWay();
  if (!voyage || !state.pending?.some((s) => s.key === "colony")) return state;
  for (const stage of state.pending)
    if (String(stage.key).startsWith("inquiry:")) stage.quiet = true;
  if (!(limitOverride > 0))
    state.limit = Math.min(
      Math.max(state.limit, voyage.arriveTick - W.tick + 16),
      TRANSIT_PRESS_TICKS,
    );
  state.transit = voyage.id;
  return state;
};
// How the home world stands: the people, the towns, and the hungriest town.
function transitHomeSentence() {
  const towns = (W?.settlements || []).filter((s) => !s.ruined && s.knownProcesses),
    people = biospherePopulation(KINDS.PERSON),
    hungry = typeof plainWordsHunger === "function" ? plainWordsHunger() : null;
  return `At home: ${people} ${people === 1 ? "person" : "people"} in ${towns.length} ${towns.length === 1 ? "town" : "towns"}; ${hungry || "the towns are fed"}.`;
}
const causalSkipResultTransitBase = causalSkipResult;
causalSkipResult = function (state) {
  const out = causalSkipResultTransitBase(state),
    voyage = transitUnderWay() || (W?.voyages || []).find((v) => v.id === state?.transit) || null;
  if (voyage) out.note = `${transitSentence(voyage)} ${transitHomeSentence()}`;
  return out;
};
// ── The effort turns to the next craft within the press ─────────────────────
// A transit press does not stop at a craft (above), and the objective is set
// once, when the press begins (79): a craft learned in the second year of a
// twelve-year press left the effort pushing a done stage for ten. On battery
// causal-origin every continuing craft arrived exactly a horizon apart,
// Stewardship at 71, Hydroponics at 83, Antibiotics at 95, whatever year each
// was actually reached. Now, at each intervention, if the press's objective is
// a craft the world has reached, the effort turns to the first objective not
// yet reached, within the same press.
const TRANSIT = { turned: 0 };
const causalSkipInterveneTransitBase = causalSkipIntervene;
causalSkipIntervene = function () {
  const target = causalTarget();
  if (target && String(target.key).startsWith("inquiry:") && transitUnderWay()) {
    const stages = causalSkipMicroStages(),
      current = stages.find((s) => s.key === target.key);
    if (!current || current.done()) {
      TRANSIT.turned++;
      setCausalTarget(stages.find((s) => !s.done()) || null);
    }
  }
  return causalSkipInterveneTransitBase();
};
window.ALIFE_TRANSIT_DEBUG = Object.freeze({
  underWay: () => transitUnderWay(),
  sentence: () => transitSentence(transitUnderWay()),
  home: () => transitHomeSentence(),
  pressTicks: () => TRANSIT_PRESS_TICKS,
  turned: () => TRANSIT.turned,
});
