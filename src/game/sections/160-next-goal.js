// ═══════════════════════════════════════════════════════════════════════════
// 160. THE NEXT STEP, IN VIEW
// ═══════════════════════════════════════════════════════════════════════════
// The world has a road, from a band of foragers to a ship among the stars, and
// the Causal skip follows it; but between presses the line under the button
// said only that the skip "drives the world to its next milestone". Now, while
// no skip runs and a press's own result has had its moment, it names the next
// stage and what the world still needs for it, read from the gate the stages
// are judged by (30f's civilizationGateStatus, 3.5 ms on a grown world, asked
// once every three seconds). Nothing here is a goal the world is pushed to;
// it is what the world's own next stage asks.
const NEXT_GOAL = { askedAt: 0, pressEndedAt: -Infinity, text: "" };
const NEXT_GOAL_EVERY_MS = 3000,
  NEXT_GOAL_AFTER_PRESS_MS = 15000;

function nextGoalText() {
  const gate = civilizationGateStatus();
  if (!gate) return "This world has reached the last stage it can.";
  const next = titleCase(gate.next),
    missing = gate.missing || [];
  if (!missing.length) return `Next: ${next}. What it asks is in place; it comes with time.`;
  const shown =
    missing.slice(0, 2).join(" · ") +
    (missing.length > 2 ? ` · and ${missing.length - 2} more` : "");
  return `Next: ${next}. ${gate.leader ? `${gate.leader} still needs` : "Still needed"}: ${shown}.`;
}
const refreshUINextGoalBase = refreshUI;
refreshUI = function (force = false) {
  const out = refreshUINextGoalBase(force),
    now = performance.now();
  if (
    W &&
    DOM.causalSkipStatus &&
    !UI.causalSkipActive &&
    now - NEXT_GOAL.pressEndedAt > NEXT_GOAL_AFTER_PRESS_MS &&
    (force || now - NEXT_GOAL.askedAt > NEXT_GOAL_EVERY_MS)
  ) {
    NEXT_GOAL.askedAt = now;
    NEXT_GOAL.text = nextGoalText();
    DOM.causalSkipStatus.textContent = NEXT_GOAL.text;
  }
  return out;
};
const causalSkipForwardNextGoalBase = causalSkipForward;
causalSkipForward = async function () {
  const out = await causalSkipForwardNextGoalBase();
  NEXT_GOAL.pressEndedAt = performance.now();
  return out;
};
window.ALIFE_NEXT_GOAL_DEBUG = Object.freeze({ text: () => nextGoalText() });
