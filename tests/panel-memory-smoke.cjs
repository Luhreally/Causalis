// A section opened or closed by hand stays so through a rebuild (156): its key
// ignores the numbers in its heading, a rebuilt pane gets the reader's choices
// back, and the open tab waits while a button is held.
const { loadRuntime } = require("../scripts/runtime-probe.cjs");
const { report } = require("./lib/report.cjs");

const failures = [];
const rt = loadRuntime();
rt.sandbox.window.ALIFE_DEBUG.createTestWorld({
  seed: "causal-origin",
  size: "battery",
  complexity: "lean",
});
// A stand-in for <details><summary>…</summary></details> inside the inspector.
const details = (heading, open) => ({
  tagName: "DETAILS",
  open,
  dataset: {},
  querySelector: (s) => (s === ":scope > summary" ? { textContent: heading } : null),
  closest: () => ({ id: "tab-inspect" }),
});
const key = rt.get("panelDetailsKey");
const a = key(details("Chemical substrate · 1,204 mass", true)),
  b = key(details("Chemical substrate · 988 mass", false));
if (a !== b) failures.push(`a heading's numbers changed its key: ${a} vs ${b}`);
if (!a.startsWith("tab-inspect|")) failures.push(`the key does not name its tab: ${a}`);

rt.get("PANEL_MEMORY").open.set(a, false);
const rebuilt = [details("Chemical substrate · 1,300 mass", true), details("Mind", true)];
rt.get("restorePanelState")({ querySelectorAll: () => rebuilt });
if (rebuilt[0].open !== false)
  failures.push("a section closed by hand opened again after a rebuild");
if (rebuilt[1].open !== true) failures.push("a section never touched changed");

const memory = rt.get("PANEL_MEMORY"),
  held = rt.get("panelHeld");
memory.pressedUntil = Infinity;
if (!held()) failures.push("the tab was rebuilt while a button was held");
memory.pressedUntil = 0;
memory.pointerInside = true;
memory.lastHeldRefresh = rt.get("performance.now()");
if (!held()) failures.push("the tab was rebuilt twice in a second under the pointer");
memory.pointerInside = false;
if (held()) failures.push("the tab waited with nothing holding it");
// A refresh while held still runs without error and leaves the active tab as it was.
memory.pressedUntil = Infinity;
rt.get('UI.activeTab = "chronicle"');
rt.get("refreshUI()");
if (rt.get("UI.activeTab") !== "chronicle") failures.push("a held refresh lost the open tab");
memory.pressedUntil = 0;

report({ key: a, held: memory.held, restored: memory.restored }, failures);
