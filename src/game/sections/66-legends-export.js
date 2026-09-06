// ═══════════════════════════════════════════════════════════════════════════
// 66. LEGENDS EXPORT — the whole history of a world as a file to share
// ═══════════════════════════════════════════════════════════════════════════
// A save could be exported but the story could not. Two buttons on the
// Legends index write the world out: a self-contained HTML file with every
// polity, people, place, house, notable life, war, feud, species, and artifact
// page and the annals year by year, where every name is a link to its own
// section; and a plain-text chronicle, year by year, for reading anywhere.
// The export reuses the Legends renderers and turns their live controls into
// anchors. Rendering is pure; the download is the only side effect.
const EXPORT_CSS = `
body{margin:0;background:#0f1418;color:#e6e1d6;font:14px/1.5 system-ui,Segoe UI,Roboto,sans-serif}
main{max-width:920px;margin:0 auto;padding:24px 20px 60px}
h1{font-family:Georgia,serif;font-weight:400;font-size:34px;margin:0 0 4px}
h2{font-size:15px;letter-spacing:.14em;text-transform:uppercase;color:#e0b060;margin:36px 0 10px;border-bottom:1px solid #2a3238;padding-bottom:6px}
h3{margin:0}
section.page{border:1px solid #2a3238;border-radius:12px;padding:14px 16px;margin:12px 0;background:#131a20}
.eyebrow{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#e0b060}
.muted{opacity:.7}.gold{color:#e0b060}.red{color:#e0645c}
.kv{display:grid;grid-template-columns:130px 1fr;gap:4px 10px;margin:8px 0;font-size:13px}
.kv span:nth-child(odd){opacity:.7}
.legend-hero{display:flex;gap:10px;align-items:center;margin:4px 0 8px}
.legend-hero .swatch{width:14px;height:14px;border-radius:50%;flex:none}
.row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.between{justify-content:space-between}
.tag{display:inline-block;border:1px solid #2a3238;border-radius:999px;padding:1px 8px;font-size:11px;margin:2px}
.subhead{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#e0b060;margin:14px 0 4px}
.legend-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.legend-card{border:1px solid #2a3238;border-radius:10px;padding:8px 10px;background:rgba(255,255,255,.03)}
.legend-card b{display:block}.legend-card small{opacity:.7;display:block}
.legend-row{display:grid;grid-template-columns:52px 1fr;gap:8px;padding:6px 4px;border-bottom:1px solid #2a3238;font-size:12.5px}
.legend-list .legend-row{grid-template-columns:1fr auto}
.legend-year{opacity:.72;font-family:ui-monospace,Consolas,monospace;font-size:11px;padding-top:2px}
.legend-link,[data-legend],[data-world-target]{cursor:pointer;text-decoration:underline dotted;text-underline-offset:2px;color:#e0b060}
.empty{opacity:.6;font-style:italic;padding:6px 0}
.tree,.tree ul{list-style:none;margin:0;padding:0}.tree ul{margin-left:12px;padding-left:10px;border-left:1px solid #2a3238}
.tree li{position:relative;margin:3px 0;padding-left:6px;font-size:12.5px}
.years-bars,.years-chips,.filter-pills,.legend-search,.item-portrait svg{display:none}
.years-group{margin-top:10px}.years-digest{font-size:12px;opacity:.85;padding:6px 8px;border-left:2px solid #e0b06088;margin:4px 0}
.card{border:1px solid #2a3238;border-radius:10px;padding:10px 12px;margin:8px 0;background:rgba(255,255,255,.03)}
.story-card p{margin:6px 0}
nav.toc{display:flex;flex-wrap:wrap;gap:6px 14px;margin:10px 0 20px;font-size:13px}
`;
const EXPORT_SCRIPT = `
document.addEventListener("click",function(e){var el=e.target.closest("[data-legend],[data-world-target]");if(!el)return;var key=el.getAttribute("data-legend");if(key){var parts=key.split(":");if(parts[0]==="back"||parts[0]==="index"||parts[0]==="list"){e.preventDefault();return;}var target=document.getElementById(parts[0]+"-"+parts[1]);if(target){e.preventDefault();target.scrollIntoView({behavior:"smooth",block:"start"});history.replaceState(null,"","#"+parts[0]+"-"+parts[1]);}return;}var id=el.getAttribute("data-world-target");var life=document.getElementById("life-"+id);if(life){e.preventDefault();life.scrollIntoView({behavior:"smooth",block:"start"});}});
`;
function exportClean(html) {
  return String(html)
    .replace(/<canvas[^>]*>[\s\S]*?<\/canvas>/g, "")
    .replace(/<canvas[^>]*\/?>/g, "")
    .replace(/<input[^>]*data-legend-search[^>]*>/g, "")
    .replace(
      /<button[^>]*data-(world-target|world-goto|follow|years-cat|years-year|legend-export)[^>]*>[^<]*<\/button>/g,
      "",
    )
    .replace(
      /<button[^>]*data-legend="(back|index:0|life:\d+|years:\d+|house:\d+)"[^>]*>[^<]*<\/button>/g,
      "",
    );
}
function exportPage(kind, id, title, body) {
  return `<section class="page" id="${kind}-${id}"><div class="eyebrow">${esc(titleCase(kind))}</div>${exportClean(body)}</section>`;
}
function exportChronicleYears() {
  const byYear = new Map();
  for (const a of W.annals || []) {
    if (a.type === "YearEvent") continue;
    if (!byYear.has(a.year)) byYear.set(a.year, []);
    byYear.get(a.year).push(a);
  }
  return [...byYear.entries()].sort((x, y) => x[0] - y[0]);
}
function exportLegendsHtml() {
  ensureAnnals();
  const parts = [],
    toc = [],
    add = (label, id) => toc.push(`<a href="#${id}">${esc(label)}</a>`),
    section = (label, id, pages) => {
      if (!pages.length) return;
      add(label, id);
      parts.push(`<h2 id="${id}">${esc(label)}</h2>${pages.join("")}`);
    };
  const factions = W.factions.slice(),
    cultures = W.cultures.slice(),
    places = W.settlements.slice(),
    houses = Object.values(W.houses || {})
      .filter((h) => h.members.length >= 2)
      .sort((a, b) => b.voices.length - a.voices.length || b.members.length - a.members.length)
      .slice(0, 60),
    lives = legendLives().slice(0, 80),
    wars = W.activeWars.slice(),
    feuds = (W.feuds || []).slice(),
    species = Object.values(W.speciesRegistry)
      .sort((a, b) => b.peakCount - a.peakCount)
      .slice(0, 30),
    artifacts = W.artifacts.slice(0, 60),
    people = W.factions.reduce((n, f) => n + (f.population || 0), 0);
  section(
    "Polities",
    "polities",
    factions.map((f) => exportPage("faction", f.id, f.name, renderFactionPage(f.id))),
  );
  section(
    "Peoples",
    "peoples",
    cultures.map((c) => exportPage("culture", c.id, c.name, renderCulturePage(c.id))),
  );
  section(
    "Places",
    "places",
    places.map((s) => exportPage("place", s.id, s.name, renderPlacePage(s.id))),
  );
  if (typeof renderHousePage === "function")
    section(
      "Houses",
      "houses",
      houses.map((h) => exportPage("house", h.id, h.name, renderHousePage(h.id))),
    );
  section(
    "Lives",
    "lives",
    lives.map((l) => exportPage("life", l.id, l.name, renderLifePage(l.id))),
  );
  section(
    "Wars",
    "wars",
    wars.map((w) => exportPage("war", w.id, warTitle(w), renderWarPage(w.id))),
  );
  if (typeof renderFeudPage === "function")
    section(
      "Feuds",
      "feuds",
      feuds.map((f) => exportPage("feud", f.id, feudTitle(f), renderFeudPage(f.id))),
    );
  section(
    "Species",
    "species",
    species.map((s) =>
      exportPage(
        "species",
        String(s.key).replace(/[^a-zA-Z0-9_-]/g, "_"),
        s.name,
        renderSpeciesPage(s.key),
      ),
    ),
  );
  section(
    "Artifacts",
    "artifacts",
    artifacts.map((a) => exportPage("artifact", a.id, a.name, renderArtifactPage(a.id))),
  );
  const years = exportChronicleYears().map(
    ([year, annals]) =>
      `<div class="years-group" id="year-${year}"><div class="row between"><span class="subhead" style="margin:0">Year ${year}</span><span class="muted">${annals.length} event${annals.length === 1 ? "" : "s"}</span></div>${
        typeof yearDigest === "function"
          ? `<div class="years-digest">${esc(yearDigest(year))}</div>`
          : ""
      }<div class="legend-timeline">${annals
        .map(
          (a) =>
            `<div class="legend-row" id="event-${a.id}"><span class="legend-year">${esc(String(a.epoch || "").slice(0, 7))}</span><span>${esc(eventSentence(a))}</span></div>`,
        )
        .join("")}</div></div>`,
  );
  add("The annals, year by year", "annals");
  parts.push(
    `<h2 id="annals">The annals, year by year</h2>${years.join("") || `<div class="empty">Nothing recorded.</div>`}`,
  );
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Legends of ${esc(W.seed)}</title><style>${EXPORT_CSS}</style></head><body><main><div class="eyebrow">Causalis · exported Year ${formatYear()}</div><h1>Legends of ${esc(W.seed)}</h1><div class="muted">${factions.filter((f) => f.stability > 0).length} living polities · ${people} people under polities · ${places.filter((s) => !s.ruined).length} standing places · ${(W.annals || []).length} notable events in the annals${typeof worldAgeName === "function" ? ` · ${esc(worldAgeName())}` : ""}</div><nav class="toc">${toc.join("")}</nav>${parts.join("")}</main><script>${EXPORT_SCRIPT}</script></body></html>`;
}
function exportLegendsText() {
  ensureAnnals();
  const lines = [
    `LEGENDS OF ${String(W.seed).toUpperCase()}`,
    `Exported Year ${formatYear()} · ${(W.annals || []).length} notable events`,
    "",
  ];
  lines.push("POLITIES");
  for (const f of W.factions) {
    const culture = W.cultures.find((c) => c.id === f.cultureId),
      places = f.settlementIds
        .map((sid) => W.settlements.find((s) => s.id === sid)?.name)
        .filter(Boolean);
    lines.push(
      `  ${f.name} — ${f.stability > 0 ? "living" : "fallen"} · ${f.population} people · ${culture ? culture.name : "no people"} · ${places.join(", ") || "no places"}${f.leaderId ? ` · Voice ${entityName(f.leaderId)}` : ""}${f.traits?.length ? ` · ${f.traits.join(", ")}` : ""}`,
    );
  }
  lines.push("");
  lines.push("THE ANNALS, YEAR BY YEAR");
  for (const [year, annals] of exportChronicleYears()) {
    lines.push(
      "",
      `Year ${year}${typeof yearDigest === "function" ? ` — ${yearDigest(year)}` : ""}`,
    );
    for (const a of annals) lines.push(`  [${a.category}] ${eventSentence(a)}`);
  }
  return lines.join("\n");
}
function exportLegends(kind) {
  if (!W) return "";
  const stamp = `${W.seed}-year-${formatYear()}`.replace(/[^a-zA-Z0-9_-]/g, "_");
  if (kind === "text") {
    const text = exportLegendsText();
    downloadText(`legends-${stamp}.txt`, text);
    return text;
  }
  const html = exportLegendsHtml();
  downloadText(`legends-${stamp}.html`, html);
  return html;
}
// ── Buttons on the Legends index ───────────────────────────────────────────────
const renderLegendIndexExportBase = renderLegendIndex;
renderLegendIndex = function (query = "") {
  const html = renderLegendIndexExportBase(query);
  if (query.trim()) return html;
  const buttons = `<div class="row wrap" style="gap:6px;margin:6px 0 4px"><button class="small" data-legend-export="html" title="Every page of these Legends as one linked file">Export the Legends</button><button class="small" data-legend-export="text" title="The annals year by year as plain text">Export the chronicle</button></div>`,
    at = html.indexOf('<input class="legend-search"');
  return at < 0 ? html + buttons : html.slice(0, at) + buttons + html.slice(at);
};
let EXPORT_WIRED = false;
function wireLegendsExport() {
  if (EXPORT_WIRED || !DOM.rightPanel?.addEventListener) return;
  EXPORT_WIRED = true;
  DOM.rightPanel.addEventListener("click", (e) => {
    const button = e.target.closest?.("[data-legend-export]");
    if (!button) return;
    e.stopPropagation();
    exportLegends(button.dataset.legendExport);
    toast(
      button.dataset.legendExport === "text"
        ? "The chronicle is being downloaded."
        : "The Legends are being downloaded.",
    );
  });
}
const refreshTabsExportBase = refreshTabs;
refreshTabs = function (tab) {
  refreshTabsExportBase(tab);
  wireLegendsExport();
};
window.ALIFE_EXPORT_DEBUG = Object.freeze({
  html: () => exportLegendsHtml(),
  text: () => exportLegendsText(),
});
