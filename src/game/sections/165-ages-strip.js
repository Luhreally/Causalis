// ═══════════════════════════════════════════════════════════════════════════
// 165. THE WORLD'S YEARS AT A GLANCE
// ═══════════════════════════════════════════════════════════════════════════
// The History tab listed the last ninety notable events and the Years page the
// last forty years; nothing showed the shape of the whole: how long the world
// sat by its hearths, when metal came, how the ages crowded together at the
// end, where the wars fell. The History tab now opens on a strip of the
// world's years from the first to now: the ages as bands (ages that began in
// the same year share one), the wars as marks beneath, and the year under the
// pointer. It only reads the world.
const STRIP_W = 300,
  STRIP_H = 30,
  STRIP_WAR_Y = 24;

function agesStripHTML() {
  if (!W || W.tick < TICKS_PER_YEAR) return "";
  const end = W.tick,
    x = (tick) => (clamp(tick, 0, end) / end) * STRIP_W,
    groups = [];
  for (const age of (W.ages || []).slice().sort((a, b) => a.tick - b.tick)) {
    const last = groups[groups.length - 1];
    if (last && last.tick === age.tick) last.names.push(age.gloss);
    else groups.push({ tick: age.tick, names: [age.gloss] });
  }
  const bands = [{ tick: 0, names: ["The first peoples"] }, ...groups],
    shade = (n) => 16 + (n / Math.max(1, bands.length - 1)) * 34,
    rects = bands
      .map((band, n) => {
        const from = x(band.tick),
          to = x(bands[n + 1]?.tick ?? end),
          label = band.names.join(" · ");
        return `<rect x="${from.toFixed(1)}" y="2" width="${Math.max(0.8, to - from).toFixed(1)}" height="18" fill="hsl(200 45% ${shade(n).toFixed(0)}%)"><title>${esc(label)}: year ${formatYear(band.tick)}${n + 1 < bands.length ? ` to ${formatYear(bands[n + 1].tick)}` : " to now"}</title></rect>`;
      })
      .join(""),
    wars = (W.activeWars || [])
      .map((w) => {
        const from = x(w.started || 0),
          to = x(w.ended || end);
        return `<rect x="${from.toFixed(1)}" y="${STRIP_WAR_Y}" width="${Math.max(1.2, to - from).toFixed(1)}" height="4" fill="var(--red)"><title>A war from year ${formatYear(w.started || 0)}${w.ended ? ` to ${formatYear(w.ended)}` : ", still fought"}</title></rect>`;
      })
      .join(""),
    latest = groups[groups.length - 1];
  return `<div class="ages-strip"><div class="row between"><span class="eyebrow">The world's years</span><small class="muted">${latest ? `${esc(latest.names.join(" · "))} since year ${formatYear(latest.tick)}` : "no age yet"}</small></div><svg viewBox="0 0 ${STRIP_W} ${STRIP_H}" preserveAspectRatio="none" role="img" aria-label="${bands.length} ages and ${(W.activeWars || []).length} wars over ${formatYear(end)} years">${rects}${wars}</svg><div class="row between"><small class="muted">year 0</small><small class="muted">${(W.activeWars || []).length ? "wars in red" : ""}</small><small class="muted">year ${formatYear(end)}</small></div></div>`;
}
const refreshChronicleStripBase = refreshChronicle;
refreshChronicle = function () {
  const out = refreshChronicleStripBase();
  if (W && typeof DOM.chroniclePane?.insertAdjacentHTML === "function")
    DOM.chroniclePane.insertAdjacentHTML("afterbegin", agesStripHTML());
  return out;
};
window.ALIFE_AGES_STRIP_DEBUG = Object.freeze({ html: () => agesStripHTML() });
