// ═══════════════════════════════════════════════════════════════════════════
// 162. THE EXPEDITION'S SECOND CHAPTER
// ═══════════════════════════════════════════════════════════════════════════
// The first expedition (45) taught a person, time, rain, the record of it and a
// save, and then said the world was the player's, never having shown the way a
// world is carried forward, where its history is read, what the lenses show or
// what a god can say. Four more steps do: a Causal skip, the Legends, a lens,
// a whisper. Each is taken as the player does the thing, however they come to
// it; an expedition past its first five steps simply goes on.
const causalSkipForwardExpeditionBase = causalSkipForward;
causalSkipForward = async function () {
  const out = await causalSkipForwardExpeditionBase();
  if (W && out) advanceExpedition(5);
  return out;
};
const refreshTabsExpeditionBase = refreshTabs;
refreshTabs = function (tab) {
  const out = refreshTabsExpeditionBase(tab);
  if (tab === "legends") advanceExpedition(6);
  return out;
};
const setOverlayExpeditionBase = setOverlay;
setOverlay = function (name) {
  const out = setOverlayExpeditionBase(name);
  if (UI.overlay) advanceExpedition(7);
  return out;
};
const applyToolExpeditionBase = applyTool;
applyTool = function (tile) {
  const tool = UI.tool,
    out = applyToolExpeditionBase(tile);
  if (typeof DIVINE_TOOLS !== "undefined" && DIVINE_TOOLS.has(tool)) advanceExpedition(8);
  return out;
};
