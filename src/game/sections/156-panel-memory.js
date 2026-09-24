// ═══════════════════════════════════════════════════════════════════════════
// 156. PANELS THAT KEEP THEIR PLACE
// ═══════════════════════════════════════════════════════════════════════════
// The observatory rebuilds the open tab four times a second while the world
// runs (240 ms at 1x, 38's main loop), from strings, so every rebuild shut the
// sections a reader had opened inside it, threw away where they had scrolled,
// and swallowed a click that landed between the press and the release. The
// town's own policies sat inside two such sections and closed under the hand.
//
// Now a section opened or closed by hand stays so through every rebuild, and
// wherever it appears again (the same heading on the next person's page), the
// scroll of each tab is kept for as long as the same thing is selected, and no
// tab is rebuilt while a button is held in it or text in it is selected; while
// the pointer rests over the panel it is rebuilt once a second, not four times.
// Only the panel's own state is kept: nothing here reads or writes the world.
const PANEL_MEMORY = {
  open: new Map(),
  scroll: new Map(),
  pressedUntil: 0,
  pointerInside: false,
  lastHeldRefresh: 0,
  restored: 0,
  held: 0,
  installed: false,
};
const PANEL_HOVER_REFRESH_MS = 1000;

// A section is known by its heading with the numbers taken out, so "Chemical
// substrate · 1,204 mass" is the same section when the mass changes, and by the
// tab or dialog it is in.
function panelDetailsKey(details) {
  const summary = details.querySelector(":scope > summary"),
    heading = (details.dataset?.block || summary?.textContent || "")
      .replace(/[0-9][0-9.,:%]*/g, "#")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80),
    home = details.closest?.(".tabpane, #modalBody, .people-bar")?.id || "panel";
  return heading ? `${home}|${heading}` : "";
}
function panelScrollKey() {
  return `${UI.activeTab}|${UI.selectedEntity || 0}|${UI.selectedTile ?? -1}`;
}
function panelScroller() {
  return DOM.rightPanel?.querySelector?.(".side-scroll") || null;
}
function restorePanelState(root) {
  if (!root?.querySelectorAll) return;
  for (const details of root.querySelectorAll("details")) {
    const key = panelDetailsKey(details);
    if (!key || !PANEL_MEMORY.open.has(key)) continue;
    const open = PANEL_MEMORY.open.get(key);
    if (details.open !== open) {
      details.open = open;
      PANEL_MEMORY.restored++;
    }
  }
  const scroller = panelScroller(),
    saved = PANEL_MEMORY.scroll.get(panelScrollKey());
  if (scroller && saved != null && Math.abs(scroller.scrollTop - saved) > 1)
    scroller.scrollTop = saved;
}
function panelSelectionInside() {
  const selection = window.getSelection?.();
  if (!selection || selection.isCollapsed || !selection.rangeCount) return false;
  const node = selection.anchorNode;
  return !!(node && DOM.rightPanel?.contains?.(node));
}
// Whether the open tab should wait: a press in progress (and a moment after, so
// the click the release makes lands on the button it began on), text selected
// in it, or the pointer resting over it since the last rebuild under a second ago.
function panelHeld(now = performance.now()) {
  if (now < PANEL_MEMORY.pressedUntil || panelSelectionInside()) return true;
  if (PANEL_MEMORY.pointerInside && now - PANEL_MEMORY.lastHeldRefresh < PANEL_HOVER_REFRESH_MS)
    return true;
  return false;
}
function installPanelMemory() {
  const panel = DOM.rightPanel;
  if (
    PANEL_MEMORY.installed ||
    typeof panel?.addEventListener !== "function" ||
    typeof document.addEventListener !== "function" ||
    typeof window.addEventListener !== "function"
  )
    return;
  PANEL_MEMORY.installed = true;
  // A click on a summary opens or closes its section once the click is done.
  document.addEventListener(
    "click",
    (event) => {
      const summary = event.target?.closest?.("summary");
      const details = summary?.parentElement;
      if (!details || details.tagName !== "DETAILS" || !panel.contains(details)) return;
      const key = panelDetailsKey(details);
      if (key) PANEL_MEMORY.open.set(key, !details.open);
    },
    true,
  );
  panel.addEventListener("pointerdown", () => (PANEL_MEMORY.pressedUntil = Infinity));
  const release = () => (PANEL_MEMORY.pressedUntil = performance.now() + 300);
  window.addEventListener("pointerup", release);
  window.addEventListener("pointercancel", release);
  panel.addEventListener("pointerenter", () => (PANEL_MEMORY.pointerInside = true));
  panel.addEventListener("pointerleave", () => (PANEL_MEMORY.pointerInside = false));
  const scroller = panelScroller();
  scroller?.addEventListener?.(
    "scroll",
    () => PANEL_MEMORY.scroll.set(panelScrollKey(), scroller.scrollTop),
    { passive: true },
  );
  // Whatever rebuilt the tab, its sections are set back before the frame is drawn.
  if (typeof MutationObserver === "function")
    new MutationObserver((records) => {
      for (const record of records)
        if (record.type === "childList" && record.addedNodes.length) {
          restorePanelState(panel);
          return;
        }
    }).observe(panel, { childList: true, subtree: true });
}

// The outermost refresh: the top bar and counts always, the open tab only when
// nothing is holding it.
const refreshUIPanelMemoryBase = refreshUI;
refreshUI = function (force = false) {
  installPanelMemory();
  if (force || !panelHeld()) {
    if (PANEL_MEMORY.pointerInside) PANEL_MEMORY.lastHeldRefresh = performance.now();
    return refreshUIPanelMemoryBase(force);
  }
  PANEL_MEMORY.held++;
  const tab = UI.activeTab;
  UI.activeTab = "held";
  try {
    return refreshUIPanelMemoryBase(force);
  } finally {
    UI.activeTab = tab;
  }
};

// The specimen portrait is drawn last, after 45 has wrapped the record in its
// summary: drawn first (34), the wrap copied the pane as text and left the
// canvas blank.
const refreshInspectorPortraitBase = refreshInspector;
refreshInspector = function () {
  refreshInspectorPortraitBase();
  if (W && UI.selectedEntity && W.components.life[UI.selectedEntity])
    mountCreaturePortrait(UI.selectedEntity);
};

window.ALIFE_PANEL_DEBUG = Object.freeze({
  state: () => ({
    open: Object.fromEntries(PANEL_MEMORY.open),
    scroll: Object.fromEntries(PANEL_MEMORY.scroll),
    restored: PANEL_MEMORY.restored,
    held: PANEL_MEMORY.held,
    installed: PANEL_MEMORY.installed,
  }),
  held: () => panelHeld(),
  key: (details) => panelDetailsKey(details),
});
