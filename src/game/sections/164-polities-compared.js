// ═══════════════════════════════════════════════════════════════════════════
// 164. THE POLITIES SIDE BY SIDE
// ═══════════════════════════════════════════════════════════════════════════
// A polity's page tells its own story, and the Legends index gave each living
// one a card of its people and places; to see which was rising, which was
// strong and which was coming apart, a reader opened them one by one. Now the
// Legends have a page that sets the living polities side by side: people,
// towns, crafts, strength of arms, stability, how they are governed and their
// wars, sorted by any column. It only reads the world.
const POLITY_COLUMNS = Object.freeze([
  { key: "people", label: "People", value: (f) => f.population || 0 },
  { key: "towns", label: "Towns", value: (f) => (f.settlementIds || []).length },
  { key: "crafts", label: "Crafts", value: (f) => Math.round(f.technologyLevel || 0) },
  { key: "arms", label: "Arms", value: (f) => Math.round(f.militaryStrength || 0) },
  {
    key: "stability",
    label: "Stable",
    value: (f) => Math.round((f.stability || 0) * 100),
    show: (v) => `${v}%`,
  },
  {
    key: "wars",
    label: "Wars",
    value: (f) =>
      (W.activeWars || []).filter((w) => !w.ended && (w.a === f.id || w.b === f.id)).length,
  },
]);
function renderPolitiesCompared(sortKey = UI.legend.compareSort || "people") {
  const column = POLITY_COLUMNS.find((c) => c.key === sortKey) || POLITY_COLUMNS[0],
    living = W.factions
      .filter((f) => f.stability > 0)
      .sort((a, b) => column.value(b) - column.value(a) || a.id - b.id);
  if (!living.length) return `<div class="empty">No polity stands yet.</div>`;
  const head = POLITY_COLUMNS.map(
      (c) =>
        `<th><button class="link-button${c.key === column.key ? " active" : ""}" data-compare-sort="${c.key}" aria-pressed="${c.key === column.key}">${c.label}</button></th>`,
    ).join(""),
    rows = living
      .map(
        (f) =>
          `<tr><th scope="row"><span class="lens-swatch" style="--c:${esc(f.color || "#888")}"></span>${legendLink("faction", f.id, f.name)}<small class="muted">${esc(titleCase(String(f.government || f.ideology?.name || "")))}</small></th>${POLITY_COLUMNS.map(
            (c) => `<td>${c.show ? c.show(c.value(f)) : fmt(c.value(f))}</td>`,
          ).join("")}</tr>`,
      )
      .join("");
  return `<div class="eyebrow">Legends of ${esc(W.seed)}</div><h3 style="margin:4px 0 8px">The polities side by side</h3><div class="compare-wrap"><table class="compare-table"><thead><tr><th>Polity</th>${head}</tr></thead><tbody>${rows}</tbody></table></div><small class="muted">Year ${formatYear()}. Choose a heading to sort by it; a name opens its polity.</small>`;
}
const renderLegendPageCompareBase = renderLegendPage;
renderLegendPage = function (kind = UI.legend.kind, id = UI.legend.id) {
  if (W && kind === "compare") return renderPolitiesCompared();
  return renderLegendPageCompareBase(kind, id);
};
// A card at the head of the index leads to it.
const renderLegendIndexCompareBase = renderLegendIndex;
renderLegendIndex = function (query = "") {
  const html = renderLegendIndexCompareBase(query),
    living = W.factions.filter((f) => f.stability > 0).length;
  if (living < 2 || query) return html;
  const card = `<div class="legend-grid" style="margin-top:8px"><div class="legend-card" data-legend="compare:0"><b>The polities side by side</b><small>${living} living · people, towns, crafts, arms, wars</small></div></div>`,
    at = html.indexOf('<div class="row between"');
  return at < 0 ? html + card : html.slice(0, at) + card + html.slice(at);
};
let COMPARE_WIRED = false;
function wirePolitiesCompared() {
  if (COMPARE_WIRED || typeof DOM.rightPanel?.addEventListener !== "function") return;
  COMPARE_WIRED = true;
  DOM.rightPanel.addEventListener("click", (e) => {
    const sort = e.target.closest?.("[data-compare-sort]");
    if (!sort) return;
    UI.legend.compareSort = sort.dataset.compareSort;
    refreshLegends();
  });
}
const refreshLegendsCompareBase = refreshLegends;
refreshLegends = function () {
  wirePolitiesCompared();
  return refreshLegendsCompareBase();
};
window.ALIFE_COMPARE_DEBUG = Object.freeze({ html: (key) => renderPolitiesCompared(key) });
