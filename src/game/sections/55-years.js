// ═══════════════════════════════════════════════════════════════════════════
// 55. YEARS — the annals read year by year
// ═══════════════════════════════════════════════════════════════════════════
// Legends has linked pages but no timeline. This section adds one: a
// year-by-year scroll of the annals, filtered to the whole world, one polity,
// one place, or one people, with a bar for every year that can be picked out,
// category chips, and a digest written at the turn of each year from what the
// annals hold. The digest is also chronicled as a YearEvent so it survives
// compression and reads back in every page's chronicle. Rendering is pure.
const YEARS_CATEGORIES = Object.freeze([
  ["all", "All"],
  ["factions", "Polities"],
  ["war", "War"],
  ["conflict", "Conflict"],
  ["people", "People"],
  ["settlements", "Settlements"],
  ["disasters", "Disasters"],
  ["ecology", "Ecology"],
  ["species", "Species"],
  ["history", "History"],
]);
const YEARS_ROW_LIMIT = 240;
function ensureYearsState() {
  if (!UI.legend) return;
  if (UI.legend.yearsCat == null) UI.legend.yearsCat = "all";
  if (UI.legend.yearsYear == null) UI.legend.yearsYear = -1;
}
// Scope ids are numbers so the shared link parser can carry them: 0 is the
// whole world, f*10+1 a polity, p*10+2 a place, c*10+3 a people.
function yearsScope(id) {
  const n = Number(id) || 0,
    kind = n % 10,
    key = Math.floor(n / 10);
  if (kind === 1) {
    const f = W.factions.find((x) => x.id === key);
    return f
      ? { kind: "faction", id: key, name: f.name, entity: f }
      : { kind: "world", id: 0, name: W.seed };
  }
  if (kind === 2) {
    const s = W.settlements.find((x) => x.id === key);
    return s
      ? { kind: "place", id: key, name: s.name, entity: s }
      : { kind: "world", id: 0, name: W.seed };
  }
  if (kind === 3) {
    const c = W.cultures.find((x) => x.id === key);
    return c
      ? { kind: "culture", id: key, name: c.name, entity: c }
      : { kind: "world", id: 0, name: W.seed };
  }
  return { kind: "world", id: 0, name: W.seed };
}
function yearsScopeId(kind, id) {
  return kind === "faction"
    ? id * 10 + 1
    : kind === "place"
      ? id * 10 + 2
      : kind === "culture"
        ? id * 10 + 3
        : 0;
}
function yearsFilter(scope) {
  if (scope.kind === "faction") {
    const f = scope.entity;
    return (e) => e.factions?.includes(f.id) || e.subjects?.includes(f.entityId);
  }
  if (scope.kind === "place") {
    const s = scope.entity;
    return (e) =>
      e.subjects?.includes(s.entityId) ||
      (e.location >= 0 && dist2(...xy(e.location), s.x, s.y) <= 36);
  }
  if (scope.kind === "culture") {
    const c = scope.entity,
      factionIds = new Set(W.factions.filter((f) => f.cultureId === c.id).map((f) => f.id));
    return (e) =>
      e.subjects?.includes(c.entityId) || (e.factions || []).some((fid) => factionIds.has(fid));
  }
  return () => true;
}
function yearsEvents(scope, category = "all") {
  const pass = yearsFilter(scope);
  return legendEvents(
    (e) => e.type !== "YearEvent" && pass(e) && (category === "all" || e.category === category),
  );
}
function shortLine(text, max = 120) {
  const s = String(text || "");
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}
// What a year amounted to, from the annals alone.
function yearDigest(year, scopeId = 0, category = "all") {
  const events = yearsEvents(yearsScope(scopeId), category).filter(
    (e) => e.year === year && e.importance >= 3,
  );
  if (!events.length) return "";
  const byCategory = {};
  for (const e of events) byCategory[e.category] = (byCategory[e.category] || 0) + 1;
  const top = events
      .slice()
      .sort((a, b) => b.importance - a.importance || a.id - b.id)
      .slice(0, 3)
      .map((e) => shortLine(eventSentence(e), 110)),
    parts = Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k, n]) => `${n} ${YEARS_CATEGORIES.find((c) => c[0] === k)?.[1].toLowerCase() || k}`);
  return `${events.length} notable event${events.length === 1 ? "" : "s"} (${parts.join(", ")}). ${top.join(" ")}`;
}
// The turn of the year writes the digest into the annals.
function recordYearTurn(year = formatYear() - 1) {
  if (year < 0 || W.living?.lastYearRecorded === year) return null;
  W.living = W.living || {};
  W.living.lastYearRecorded = year;
  const text = yearDigest(year);
  if (!text) return null;
  const events = (W.annals || []).filter((a) => a.year === year && a.type !== "YearEvent"),
    top = events.slice().sort((a, b) => b.importance - a.importance || a.id - b.id)[0];
  return emitEvent("YearEvent", {
    subjects: [],
    location: top?.location ?? -1,
    factions: [...new Set(events.flatMap((a) => a.factions || []))].slice(0, 6),
    causes: events
      .slice()
      .sort((a, b) => b.importance - a.importance || a.id - b.id)
      .slice(0, 4)
      .map((a) => a.id),
    evidence: [`${events.length} entries in the annals`],
    importance: 3,
    data: { year, text, count: events.length },
  });
}
const updateWeatherCycleYearsBase = updateWeatherCycle;
updateWeatherCycle = function () {
  updateWeatherCycleYearsBase();
  if (W?.annals && W.tick > 0 && W.tick % TICKS_PER_YEAR === 0) recordYearTurn(formatYear() - 1);
};
// ── Rendering ──────────────────────────────────────────────────────────────────
function yearsBars(events, selected, firstYear, lastYear) {
  const counts = new Map();
  for (const e of events) counts.set(e.year, (counts.get(e.year) || 0) + 1);
  const span = Math.max(1, lastYear - firstYear + 1),
    from = Math.max(firstYear, lastYear - 39),
    max = Math.max(
      1,
      ...Array.from({ length: lastYear - from + 1 }, (_, i) => counts.get(from + i) || 0),
    ),
    bars = [];
  for (let y = from; y <= lastYear; y++) {
    const n = counts.get(y) || 0,
      h = n ? Math.max(8, Math.round((n / max) * 100)) : 4;
    bars.push(
      `<button class="years-bar${y === selected ? " active" : ""}${n ? "" : " empty"}" data-years-year="${y}" title="Year ${y} · ${n} event${n === 1 ? "" : "s"}" style="--h:${h}%;animation-delay:${((y - from) * 14) % 400}ms"><span class="years-bar-fill"></span>${
        y % 5 === 0 || y === lastYear ? `<span class="years-bar-label">${y}</span>` : ""
      }</button>`,
    );
  }
  return `<div class="years-bars" role="group" aria-label="Events per year">${bars.join("")}</div>${
    span > 40
      ? `<div class="muted" style="font-size:11px">Showing the last 40 of ${span} years.</div>`
      : ""
  }`;
}
function renderYearsPage(id = 0) {
  ensureYearsState();
  const scope = yearsScope(id),
    category = UI.legend.yearsCat || "all",
    selected = UI.legend.yearsYear ?? -1,
    all = yearsEvents(scope, category),
    lastYear = formatYear(),
    firstYear = all.length ? Math.min(...all.map((e) => e.year)) : lastYear,
    shown = selected >= 0 ? all.filter((e) => e.year === selected) : all,
    byYear = new Map();
  for (const e of shown.slice(-YEARS_ROW_LIMIT)) {
    if (!byYear.has(e.year)) byYear.set(e.year, []);
    byYear.get(e.year).push(e);
  }
  const years = [...byYear.keys()].sort((a, b) => b - a),
    chips = YEARS_CATEGORIES.map(
      ([key, label]) =>
        `<button class="filt${key === category ? " active" : ""}" data-years-cat="${key}">${label}</button>`,
    ).join(""),
    scopeLink =
      scope.kind === "faction"
        ? legendLink("faction", scope.id, scope.name)
        : scope.kind === "place"
          ? legendLink("place", scope.id, scope.name)
          : scope.kind === "culture"
            ? legendLink("culture", scope.id, scope.name)
            : esc(scope.name),
    groups = years
      .map((y) => {
        const rows = byYear
            .get(y)
            .slice()
            .sort((a, b) => b.tick - a.tick || b.id - a.id)
            .map(
              (e) =>
                `<div class="legend-row" data-legend="event:${e.id}"><span class="legend-year">${esc(String(e.epoch || "").slice(0, 6))}</span><span>${esc(eventSentence(e))}</span></div>`,
            ),
          digest = yearDigest(y, id, category);
        return `<div class="years-group"><div class="row between years-head"><span class="subhead" style="margin:0">Year ${y}</span><span class="muted">${rows.length} event${rows.length === 1 ? "" : "s"}</span></div>${
          digest ? `<div class="years-digest">${esc(digest)}</div>` : ""
        }<div class="legend-timeline">${rows.join("")}</div></div>`;
      })
      .join("");
  return `<div class="eyebrow">The annals, year by year</div><h3 style="margin:2px 0 6px">${scopeLink}</h3><div class="muted" style="margin-bottom:6px">${all.length} recorded event${all.length === 1 ? "" : "s"} · Year ${firstYear} to ${lastYear}${
    scope.kind !== "world" ? ` · ${legendLink("years", 0, "whole world")}` : ""
  }</div>${yearsBars(all, selected, firstYear, lastYear)}<div class="filter-pills years-chips">${chips}${
    selected >= 0
      ? `<button class="filt active" data-years-year="${selected}">Year ${selected} ✕</button>`
      : ""
  }</div>${groups || `<div class="empty">Nothing recorded${category !== "all" ? " in this category" : ""}${selected >= 0 ? ` in Year ${selected}` : ""}.</div>`}`;
}
// Latest digest for the index, and links from the pages that have a scope.
function latestYearDigest() {
  for (let n = (W.annals || []).length - 1; n >= 0; n--) {
    const a = W.annals[n];
    if (a.type === "YearEvent") return a;
  }
  return null;
}
const renderLegendIndexYearsBase = renderLegendIndex;
renderLegendIndex = function (query = "") {
  const html = renderLegendIndexYearsBase(query);
  if (query.trim()) return html;
  const latest = latestYearDigest(),
    card = `<div class="legend-card years-card" data-legend="years:0"><b>The annals, year by year</b><small>${
      latest
        ? `Year ${latest.data?.year}: ${esc(shortLine(latest.data?.text, 160))}`
        : `${(W.annals || []).length} entries since Year 0 · open the timeline`
    }</small></div>`,
    at = html.indexOf('<div class="row between"');
  return at < 0 ? html + card : html.slice(0, at) + card + html.slice(at);
};
function yearsLink(kind, id) {
  return `<div class="row wrap" style="gap:6px;margin:8px 0"><button class="small" data-legend="years:${yearsScopeId(kind, id)}">Chronicle by year</button></div>`;
}
const renderFactionPageYearsBase = renderFactionPage;
renderFactionPage = function (id) {
  const html = renderFactionPageYearsBase(id);
  return W.factions.some((f) => f.id === id) ? html + yearsLink("faction", id) : html;
};
const renderPlacePageYearsBase = renderPlacePage;
renderPlacePage = function (id) {
  const html = renderPlacePageYearsBase(id);
  return W.settlements.some((s) => s.id === id) ? html + yearsLink("place", id) : html;
};
const renderCulturePageYearsBase = renderCulturePage;
renderCulturePage = function (id) {
  const html = renderCulturePageYearsBase(id);
  return W.cultures.some((c) => c.id === id) ? html + yearsLink("culture", id) : html;
};
const renderLegendPageYearsBase = renderLegendPage;
renderLegendPage = function (kind = UI.legend.kind, id = UI.legend.id) {
  if (kind === "years" && W) return renderYearsPage(Number(id) || 0);
  return renderLegendPageYearsBase(kind, id);
};
const eventSentenceYearsBase = eventSentence;
eventSentence = function (e) {
  if (e.type === "YearEvent") return `Year ${e.data?.year}: ${e.data?.text || "a quiet year"}`;
  return eventSentenceYearsBase(e);
};
// ── Wiring: chips and bars are plain buttons inside the Legends pane ───────────
let YEARS_WIRED = false;
function wireYears() {
  if (YEARS_WIRED || !DOM.rightPanel?.addEventListener) return;
  YEARS_WIRED = true;
  DOM.rightPanel.addEventListener("click", (e) => {
    const chip = e.target.closest?.("[data-years-cat]"),
      bar = e.target.closest?.("[data-years-year]");
    if (!chip && !bar) return;
    ensureYearsState();
    if (chip) UI.legend.yearsCat = chip.dataset.yearsCat;
    if (bar) {
      const y = Number(bar.dataset.yearsYear);
      UI.legend.yearsYear = UI.legend.yearsYear === y ? -1 : y;
    }
    e.stopPropagation();
    refreshTabs("legends");
  });
}
const refreshTabsYearsBase = refreshTabs;
refreshTabs = function (tab) {
  refreshTabsYearsBase(tab);
  wireYears();
};
window.ALIFE_YEARS_DEBUG = Object.freeze({
  render: (scopeId = 0) => renderYearsPage(scopeId),
  digest: (year, scopeId = 0) => yearDigest(year, scopeId),
  turn: (year = formatYear()) => recordYearTurn(year),
  scope: (id) => yearsScope(id),
  setCategory: (c) => {
    ensureYearsState();
    UI.legend.yearsCat = c;
  },
  setYear: (y) => {
    ensureYearsState();
    UI.legend.yearsYear = y;
  },
});
