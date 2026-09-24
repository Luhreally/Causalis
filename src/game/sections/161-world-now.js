// ═══════════════════════════════════════════════════════════════════════════
// 161. THE WORLD NOW
// ═══════════════════════════════════════════════════════════════════════════
// With nothing selected, the Inspect tab asked the player to "choose a tile to
// inspect the common chemical substrate". It is the first thing an observer
// reads, so it now says what is happening: the year, the age and the counts;
// the stage the world is working toward and what it lacks; the wars under way;
// the towns going hungry; and the last notable events, each with its people
// and places linked and a way to the map. Only reads the world.
const WORLD_NOW_EVENTS = 6;

function worldNowHTML() {
  if (!W) return `<div class="empty">No world.</div>`;
  const people = populationSummary().person || 0,
    towns = W.settlements.filter((s) => !s.ruined),
    polities = W.factions.filter((f) => f.stability > 0).length,
    factionName = (id) => W.factions.find((f) => f.id === id)?.name || "a fallen polity",
    wars = (W.activeWars || []).filter((w) => !w.ended),
    hungry = towns
      .map((s) => ({ s, o: foodOutlook(s) }))
      .filter((x) => x.o && (x.o.famine || x.o.lean))
      .sort((a, b) => Number(b.o.famine) - Number(a.o.famine) || b.o.hungry - a.o.hungry),
    events = W.events
      .filter((e) => e.importance >= 3 && e.type !== "YearEvent")
      .slice(-WORLD_NOW_EVENTS)
      .reverse(),
    next = typeof nextGoalText === "function" ? nextGoalText() : "";
  const counts = `${fmt(people)} ${people === 1 ? "person" : "people"} · ${towns.length} ${towns.length === 1 ? "town" : "towns"} · ${polities} ${polities === 1 ? "polity" : "polities"}`;
  const warRows = wars
    .map(
      (w) =>
        `<div class="row between now-row"><span>⚔️ ${esc(factionName(w.a))} against ${esc(factionName(w.b))}</span><small class="muted">${w.casualties || 0} fallen</small></div>`,
    )
    .join("");
  const hungerRows = hungry
    .slice(0, 5)
    .map(
      ({ s, o }) =>
        // Said by what is so: a town can be judged in famine by its larder
        // (82) while no one in it is hungry yet.
        `<div class="row between now-row"><span>${o.hungry >= 0.4 ? "🥀" : "🌾"} ${legendLink("place", s.id, s.name)} ${o.hungry >= 0.4 ? "is in famine" : o.hungry > 0 ? "is going hungry" : o.famine ? "has almost no food put by" : "is running low on food"}</span>${o.hungry > 0 ? `<small class="muted">${Math.round(o.hungry * 100)}% hungry</small>` : ""}</div>`,
    )
    .join("");
  const eventRows = events
    .map(
      (e) =>
        `<div class="now-event"><small class="muted">Year ${e.year}</small><div>${linkedEventSentence(e)}</div>${e.location >= 0 ? worldButtons(0, e.location) : ""}</div>`,
    )
    .join("");
  return `<div class="world-now"><div class="eyebrow">The world now</div><h3 style="margin:4px 0 2px">Year ${formatYear()} · ${esc(epochName())}</h3><div class="muted">${counts}</div>${next ? `<div class="card now-next">${esc(next)}</div>` : ""}${
    wars.length ? `<div class="subhead">Wars under way</div>${warRows}` : ""
  }${hungry.length ? `<div class="subhead">Towns going hungry</div>${hungerRows}` : ""}<div class="subhead">Lately</div>${
    eventRows ||
    `<div class="muted">Nothing the chronicle counts as notable has happened yet.</div>`
  }<small class="muted now-hint">Choose a life or a tile on the map to read it here.</small></div>`;
}
window.ALIFE_WORLD_NOW_DEBUG = Object.freeze({ html: () => worldNowHTML() });
