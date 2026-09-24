// ═══════════════════════════════════════════════════════════════════════════
// 158. TRENDS YOU CAN READ
// ═══════════════════════════════════════════════════════════════════════════
// The Trends tab drew seven measures on one canvas, each stretched to its own
// highest value, with no axis, no years and no way to read a number: a line
// could not say whether it meant twelve people or twelve hundred. Now each
// measure has a small chart of its own, one line on its own scale, named, with
// its present value and its highest, the years along the bottom, and a reading
// under the pointer. The samples are the ones 29 has always recorded, every 128
// ticks over the last 160 years; nothing new is kept in the world.
const TREND_SERIES = Object.freeze([
  { key: "person", title: "People", group: "People and places" },
  { key: "settlements", title: "Towns", group: "People and places" },
  { key: "factions", title: "Polities", group: "People and places" },
  { key: "technology", title: "Crafts known", group: "People and places" },
  { key: "herbivore", title: "Grazers", group: "The living world" },
  { key: "predator", title: "Hunters", group: "The living world" },
  { key: "food", title: "Food in the land", group: "The living world", decimals: 1 },
  { key: "disease", title: "Disease", group: "The living world", decimals: 2 },
  { key: "fire", title: "Fire", group: "The living world", decimals: 2 },
]);
const TREND_W = 260,
  TREND_H = 44;

function trendNumber(value, decimals = 0) {
  if (!Number.isFinite(value)) return "–";
  return decimals ? value.toFixed(decimals) : fmt(Math.round(value));
}
// The top of a chart's scale: the highest value rounded up to a readable step.
function trendScaleTop(max) {
  if (!(max > 0)) return 1;
  const step = 10 ** Math.floor(Math.log10(max)),
    unit = [1, 2, 2.5, 5, 10].find((u) => u * step >= max) || 10;
  return unit * step;
}
function trendCard(series, history, hover) {
  const values = history.map((h) => Number(h[series.key]) || 0),
    n = values.length,
    top = trendScaleTop(Math.max(...values)),
    x = (i) => (n < 2 ? TREND_W / 2 : (i / (n - 1)) * TREND_W),
    y = (v) => TREND_H - 2 - (v / top) * (TREND_H - 4),
    points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`),
    line = points.length ? `M${points.join("L")}` : "",
    area = points.length ? `${line}L${x(n - 1).toFixed(1)},${TREND_H}L0,${TREND_H}Z` : "",
    at = hover?.key === series.key ? clamp(hover.index, 0, n - 1) : -1,
    shown = at >= 0 ? values[at] : values[n - 1],
    when = formatYear(history[at >= 0 ? at : n - 1]?.tick ?? W.tick),
    guide =
      at >= 0
        ? `<line class="trend-guide" x1="${x(at)}" x2="${x(at)}" y1="0" y2="${TREND_H}"/><circle class="trend-dot" cx="${x(at)}" cy="${y(shown)}" r="3"/>`
        : "";
  return `<div class="trend-card"><div class="trend-head"><span>${esc(series.title)}</span><b>${trendNumber(shown, series.decimals)}</b></div><svg class="trend-plot" data-trend="${series.key}" data-trend-n="${n}" viewBox="0 0 ${TREND_W} ${TREND_H}" preserveAspectRatio="none" role="img" aria-label="${esc(series.title)} over the last ${Math.max(0, formatYear(history[n - 1]?.tick) - formatYear(history[0]?.tick))} years, now ${trendNumber(values[n - 1], series.decimals)}"><line class="trend-base" x1="0" x2="${TREND_W}" y1="${TREND_H - 1}" y2="${TREND_H - 1}"/><path class="trend-area" d="${area}"/><path class="trend-line" d="${line}"/>${guide}</svg><div class="trend-foot"><span>year ${formatYear(history[0]?.tick ?? 0)}</span><span>${at >= 0 ? `year ${when}` : `highest ${trendNumber(Math.max(...values), series.decimals)}`}</span><span>year ${formatYear(history[n - 1]?.tick ?? W.tick)}</span></div></div>`;
}
function trendsHTML() {
  const history = W?.statistics?.history || [];
  if (history.length < 2)
    return `<div class="empty">The trends begin once the world has kept two samples (a sample every 128 ticks).</div>`;
  const groups = [...new Set(TREND_SERIES.map((s) => s.group))];
  return groups
    .map(
      (group) =>
        `<div class="subhead">${esc(group)}</div><div class="trend-grid">${TREND_SERIES.filter(
          (s) => s.group === group,
        )
          .map((s) => trendCard(s, history, UI.trendHover))
          .join("")}</div>`,
    )
    .join("");
}
// A reading under the pointer: the sample nearest it, shown until it leaves.
let TRENDS_WIRED = false;
function wireTrends() {
  if (TRENDS_WIRED || typeof DOM.rightPanel?.addEventListener !== "function") return;
  TRENDS_WIRED = true;
  DOM.rightPanel.addEventListener("pointermove", (e) => {
    const plot = e.target.closest?.("[data-trend]");
    if (!plot) return;
    const box = plot.getBoundingClientRect(),
      n = Number(plot.dataset.trendN) || 0,
      index = clamp(
        Math.round(((e.clientX - box.left) / Math.max(1, box.width)) * (n - 1)),
        0,
        n - 1,
      );
    if (UI.trendHover?.key === plot.dataset.trend && UI.trendHover.index === index) return;
    UI.trendHover = { key: plot.dataset.trend, index };
    const series = TREND_SERIES.find((s) => s.key === plot.dataset.trend),
      card = plot.closest(".trend-card");
    if (series && card) card.outerHTML = trendCard(series, W.statistics.history, UI.trendHover);
  });
  DOM.rightPanel.addEventListener("pointerleave", () => {
    if (!UI.trendHover) return;
    UI.trendHover = null;
    if (UI.activeTab === "stats") refreshStats();
  });
}
const refreshStatsTrendsBase = refreshStats;
// Drawn last and put first: the trends are what the tab is for, and the
// summaries of 34a and 42 are put at the top of the tab as they are drawn.
refreshStats = function () {
  wireTrends();
  const out = refreshStatsTrendsBase();
  if (W && typeof DOM.statsBody?.insertAdjacentHTML === "function")
    DOM.statsBody.insertAdjacentHTML("afterbegin", trendsHTML());
  return out;
};

window.ALIFE_TRENDS_DEBUG = Object.freeze({
  html: () => trendsHTML(),
  top: (max) => trendScaleTop(max),
  series: () => TREND_SERIES.map((s) => s.key),
});
