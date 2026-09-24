// ═══════════════════════════════════════════════════════════════════════════
// 166. THE PLAYER BETWEEN TICKS
// ═══════════════════════════════════════════════════════════════════════════
// The page runs a tick in slices (16, 38), so the world can be part-way through
// a tick when the player reaches for it. Whatever the player does lands between
// ticks: a click, a changed control or a sent form ends the tick in progress
// before any handler of theirs runs (a listener in the capture phase comes
// first), a tool laid on the map does so itself, and a save or an export never
// holds half a tick. The drawing and the panels only read, and may see a tick
// part-way; the next frame goes on with it.
const applyToolSlicedBase = applyTool;
applyTool = function (tile) {
  finishPendingTick();
  return applyToolSlicedBase(tile);
};
const snapshotSlicedBase = snapshot;
snapshot = function () {
  finishPendingTick();
  return snapshotSlicedBase();
};
if (typeof document !== "undefined" && typeof document.addEventListener === "function")
  for (const type of ["click", "change", "submit"])
    document.addEventListener(type, () => finishPendingTick(), true);
window.ALIFE_SLICED_CLOCK_DEBUG = Object.freeze({
  inProgress: () => tickInProgress(),
  advance: (ms) => advanceTick(performance.now() + ms),
  finish: () => finishPendingTick(),
  slice: () => TICK_SLICE,
});
