// ═══════════════════════════════════════════════════════════════════════════
// 47. LEGENDS: A LINKED ENCYCLOPEDIA OF THE WORLD'S HISTORY
// ═══════════════════════════════════════════════════════════════════════════
// A simulated history is only as good as the way in. The chronicle feed already
// records everything with causes, but it is a feed. Legends adds two things: the
// annals, a durable ledger of every notable event kept for the life of the world
// so old history survives event compression, and linked pages for lives,
// polities, peoples, places, species, artifacts, wars, and calamities, each one
// click from the others and from the world itself. The annals are authoritative
// state (written inside emitEvent, deterministic, saved); the pages only read.
const ANNALS_LIMIT = 6000;
function ensureAnnals(world = W) {
  if (world && !Array.isArray(world.annals)) world.annals = [];
}
const restoreWorldLegendsBase = restoreWorldDefaults;
restoreWorldDefaults = function () {
  restoreWorldLegendsBase();
  ensureAnnals(W);
};
function recordAnnal(ev) {
  ensureAnnals();
  const subjects = ev.subjects.slice(0, 6);
  W.annals.push({
    id: ev.id,
    tick: ev.tick,
    year: ev.year,
    epoch: ev.epoch,
    type: ev.type,
    category: ev.category,
    importance: ev.importance,
    magnitude: ev.magnitude,
    subjects,
    names: subjects.map((id) => entityName(id)),
    factions: ev.factions.slice(0, 4),
    location: ev.location,
    causes: ev.causes.slice(0, 6),
    evidence: ev.evidence.slice(0, 4),
    data: ev.data,
  });
  if (W.annals.length > ANNALS_LIMIT) {
    const drop = W.annals.findIndex((a) => a.importance < 4);
    W.annals.splice(drop < 0 ? 0 : drop, 1);
  }
}
const emitEventLegendsBase = emitEvent;
emitEvent = function (type, data = {}) {
  const ev = emitEventLegendsBase(type, data);
  if (W && ev.importance >= 3) recordAnnal(ev);
  return ev;
};
// Annals are appended in id order, so an old event can be found by bisection
// after the live feed has compressed it away.
function annalById(id) {
  const annals = W?.annals;
  if (!annals?.length) return null;
  let lo = 0,
    hi = annals.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1,
      v = annals[mid].id;
    if (v === id) return annals[mid];
    if (v < id) lo = mid + 1;
    else hi = mid - 1;
  }
  return null;
}
const eventByIdLegendsBase = eventById;
eventById = function (id) {
  const live = eventByIdLegendsBase(id);
  if (live && live.type !== "ArchivedEvent") return live;
  return annalById(id) || live;
};
// Names of the long dead survive in the annals even after their identity
// record has been pruned.
let ANNAL_NAME_INDEX = { world: null, size: 0, map: new Map() };
function annalName(id) {
  const annals = W?.annals;
  if (!annals?.length) return "";
  if (ANNAL_NAME_INDEX.world !== W || ANNAL_NAME_INDEX.size !== annals.length) {
    const map = new Map();
    for (const a of annals)
      for (let n = 0; n < a.subjects.length; n++)
        if (a.names?.[n] && !/^Entity \d+$/.test(a.names[n])) map.set(a.subjects[n], a.names[n]);
    ANNAL_NAME_INDEX = { world: W, size: annals.length, map };
  }
  return ANNAL_NAME_INDEX.map.get(id) || "";
}
const entityNameLegendsBase = entityName;
entityName = function (id) {
  const base = entityNameLegendsBase(id);
  return base === `Entity ${id}` ? annalName(id) || base : base;
};
// ── Navigation state ───────────────────────────────────────────────────────────
UI.legend = UI.legend || { kind: "index", id: null, stack: [], query: "" };
function legendTarget(entityId) {
  const faction = W.factions.find((f) => f.entityId === entityId);
  if (faction) return { kind: "faction", id: faction.id };
  const culture = W.cultures.find((c) => c.entityId === entityId);
  if (culture) return { kind: "culture", id: culture.id };
  const settlement = W.settlements.find((s) => s.entityId === entityId);
  if (settlement) return { kind: "place", id: settlement.id };
  const camp = W.camps.find((c) => c.entityId === entityId);
  if (camp) return { kind: "camp", id: camp.id };
  const artifact = W.artifacts.find((a) => a.entityId === entityId);
  if (artifact) return { kind: "artifact", id: artifact.id };
  return { kind: "life", id: entityId };
}
function openLegend(kind, id = null) {
  if (kind === "back") {
    const prev = UI.legend.stack.pop();
    if (prev) {
      UI.legend.kind = prev.kind;
      UI.legend.id = prev.id;
    } else {
      UI.legend.kind = "index";
      UI.legend.id = null;
    }
  } else {
    if (kind === "entity") ({ kind, id } = legendTarget(Number(id)));
    if (UI.legend.kind !== kind || UI.legend.id !== id) {
      UI.legend.stack.push({ kind: UI.legend.kind, id: UI.legend.id });
      if (UI.legend.stack.length > 40) UI.legend.stack.shift();
    }
    UI.legend.kind = kind;
    UI.legend.id = id;
  }
  refreshTabs("legends");
}
// ── Rendering helpers ──────────────────────────────────────────────────────────
function legendLink(kind, id, label, cls = "") {
  return `<span class="legend-link gold ${cls}" data-legend="${kind}:${id}">${esc(String(label))}</span>`;
}
function lifeLink(id) {
  if (!id) return "";
  const name = entityName(id);
  if (!name) return "";
  const target = legendTarget(id);
  return legendLink(target.kind, target.id, name);
}
function factionLink(id) {
  const f = W.factions.find((x) => x.id === id);
  return f ? legendLink("faction", f.id, f.name) : "";
}
function placeLink(id) {
  const s = W.settlements.find((x) => x.id === id);
  return s ? legendLink("place", s.id, s.name) : "";
}
function linkList(ids, linker = lifeLink) {
  const out = (ids || []).map((id) => linker(id)).filter(Boolean);
  return out.length ? out.join(", ") : "none";
}
function legendHero(title, tags = [], color = null) {
  return `<div class="legend-hero">${color ? `<span class="swatch" style="background:${color}"></span>` : ""}<h3>${esc(title)}</h3></div>${
    tags.filter(Boolean).length
      ? `<div class="row wrap" style="gap:4px;margin-bottom:8px">${tags
          .filter(Boolean)
          .map((t) =>
            String(t).includes("<")
              ? `<span class="tag">${t}</span>`
              : `<span class="tag">${esc(String(t))}</span>`,
          )
          .join("")}</div>`
      : ""
  }`;
}
function worldButtons(entityId, tile = -1) {
  const target = entityId
    ? `data-world-target="${entityId}" data-world-tile="${tile}"`
    : tile >= 0
      ? `data-world-goto="${tile}"`
      : "";
  return target
    ? `<div class="row wrap" style="gap:6px;margin:8px 0"><button class="small" ${target}>Go there</button>${
        entityId && W.kind[entityId] && W.components.life[entityId]
          ? `<button class="small" data-follow="${entityId}">${UI.followId === entityId ? "Following" : "Follow"}</button>`
          : ""
      }</div>`
    : "";
}
// Every notable event, from the annals and the live feed, newest last.
function legendEvents(filter) {
  const seen = new Set(),
    out = [];
  for (const a of W.annals || [])
    if (filter(a)) {
      seen.add(a.id);
      out.push(a);
    }
  for (const e of W.events) if (!seen.has(e.id) && e.importance >= 2 && filter(e)) out.push(e);
  out.sort((a, b) => a.tick - b.tick || a.id - b.id);
  return out;
}
function timelineRows(events, limit = 60) {
  const rows = events
    .slice(-limit)
    .reverse()
    .map(
      (e) =>
        `<div class="legend-row" data-legend="event:${e.id}"><span class="legend-year">Y${e.year}</span><span>${esc(eventSentence(e))}</span></div>`,
    );
  return rows.length
    ? `<div class="legend-timeline">${rows.join("")}</div>`
    : `<div class="empty">Nothing notable recorded yet.</div>`;
}
function relationsList(id) {
  const rows = relationsOf(id)
    .filter((e) => e.type !== "member_of")
    .slice(-24)
    .map((e) => {
      const other = e.from === id ? e.to : e.from,
        verb = e.from === id ? e.type.replace(/_/g, " ") : `${e.type.replace(/_/g, " ")} (by)`;
      return `<div class="legend-row"><span class="legend-year">Y${formatYear(e.createdTick)}</span><span>${esc(verb)} · ${lifeLink(other) || esc(entityName(other))}</span></div>`;
    });
  return rows.length
    ? `<div class="subhead">Bonds</div><div class="legend-timeline">${rows.join("")}</div>`
    : "";
}
function mountLegendPortraits(pane) {
  if (!pane?.querySelectorAll) return;
  for (const canvas of pane.querySelectorAll("canvas[data-portrait]")) {
    const id = Number(canvas.dataset.portrait);
    if (!W.components.genome[id] || !W.components.life[id]) continue;
    const v = makePlanetVisualGenome(),
      width = Math.max(200, Math.floor(canvas.clientWidth || 260)),
      height = 110,
      dpr = Math.min(2, (typeof devicePixelRatio === "number" && devicePixelRatio) || 1);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    const g = canvas.getContext("2d");
    if (!g) continue;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = hsl(v.voidHue, 45, 8);
    g.fillRect(0, 0, width, height);
    drawCreatureGlyph(g, id, { x: width * 0.5, y: height * 0.5 }, W.tick * 12, null, 32, true);
  }
}
// ── Pages ──────────────────────────────────────────────────────────────────────
function renderLegendIndex(query = "") {
  const q = query.trim().toLowerCase(),
    match = (name) => !q || String(name).toLowerCase().includes(q),
    card = (kind, id, title, sub) =>
      `<div class="legend-card" data-legend="${kind}:${id}"><b>${esc(title)}</b><small>${esc(sub)}</small></div>`,
    section = (title, listKind, cards, total) =>
      `<div class="row between" style="margin-top:10px"><span class="subhead" style="margin:0">${title}</span>${
        total > cards.length
          ? legendLink("list", listKind, `all ${total}`)
          : `<span class="muted">${total}</span>`
      }</div>${cards.length ? `<div class="legend-grid">${cards.join("")}</div>` : `<div class="empty">None ${q ? "match" : "yet"}.</div>`}`,
    factions = W.factions.filter((f) => match(f.name)),
    cultures = W.cultures.filter((c) => match(c.name)),
    places = W.settlements.filter((s) => match(s.name)),
    lives = legendLives().filter((x) => match(x.name)),
    species = Object.values(W.speciesRegistry).filter((s) => match(s.name)),
    artifacts = W.artifacts.filter((a) => match(a.name)),
    wars = W.activeWars.filter((w) => match(warTitle(w))),
    calamities = legendEvents((e) => e.category === "disasters" && e.importance >= 3).filter((e) =>
      match(eventSentence(e)),
    ),
    people = W.factions.reduce((n, f) => n + (f.population || 0), 0),
    years = formatYear();
  return `<div class="eyebrow">Legends of ${esc(W.seed)}</div><div class="muted" style="margin:4px 0 6px">Year ${years} · ${W.factions.filter((f) => f.stability > 0).length} living polities · ${people} people under polities · ${Object.values(W.speciesRegistry).filter((s) => !s.extinct).length} living species · ${(W.annals || []).length} notable events in the annals</div><input class="legend-search" data-legend-search type="search" placeholder="Search names…" value="${esc(query)}">
${section(
  "Polities",
  "factions",
  factions
    .slice(0, 6)
    .map((f) =>
      card(
        "faction",
        f.id,
        f.name,
        `${f.stability > 0 ? "living" : "fallen"} · ${f.population} people · ${f.settlementIds.length} places`,
      ),
    ),
  factions.length,
)}
${section(
  "Peoples",
  "cultures",
  cultures
    .slice(0, 6)
    .map((c) =>
      card(
        "culture",
        c.id,
        c.name,
        `origin ${W.settlements.find((s) => s.id === c.originSettlementId)?.name || "lost"}`,
      ),
    ),
  cultures.length,
)}
${section(
  "Places",
  "places",
  places
    .slice(-6)
    .reverse()
    .map((s) =>
      card(
        "place",
        s.id,
        s.name,
        `${s.ruined ? "ruin" : titleCase(s.stage || "settlement")} · founded Year ${formatYear(s.foundedTick)}`,
      ),
    ),
  places.length,
)}
${section(
  "Lives",
  "lives",
  lives.slice(0, 8).map((x) => card("life", x.id, x.name, x.sub)),
  lives.length,
)}
${section(
  "Species",
  "species",
  species
    .sort((a, b) => b.peakCount - a.peakCount)
    .slice(0, 6)
    .map((s) =>
      card(
        "species",
        s.key,
        s.name,
        `${titleCase(s.kind)} · ${s.extinct ? "extinct" : `${s.count} living`} · since Year ${formatYear(s.firstTick)}`,
      ),
    ),
  species.length,
)}
${section(
  "Artifacts",
  "artifacts",
  artifacts
    .slice(-6)
    .reverse()
    .map((a) =>
      card(
        "artifact",
        a.id,
        a.name,
        `made Year ${formatYear(a.creationTick)} by ${entityName(a.creatorId)}`,
      ),
    ),
  artifacts.length,
)}
${section(
  "Wars",
  "wars",
  wars
    .slice(-6)
    .reverse()
    .map((w) =>
      card(
        "war",
        w.id,
        warTitle(w),
        w.ended
          ? `Year ${formatYear(w.started)} to ${formatYear(w.ended)}`
          : `since Year ${formatYear(w.started)} · ongoing`,
      ),
    ),
  wars.length,
)}
${section(
  "Calamities",
  "calamities",
  calamities
    .slice(-6)
    .reverse()
    .map((e) =>
      card(
        "event",
        e.id,
        titleCase(e.type.replace("Event", "")),
        `Year ${e.year} · ${locationName(e.location)}`,
      ),
    ),
  calamities.length,
)}`;
}
function legendLives() {
  const out = [],
    seen = new Set(),
    push = (id, ident, alive) => {
      if (!id || seen.has(id) || !ident) return;
      seen.add(id);
      const name = ident.generatedName || ident.name;
      if (!name) return;
      out.push({
        id,
        name,
        renown: ident.significance || 0,
        sub: `${alive ? "living" : "dead"} · ${ident.legendary ? "legendary" : ident.notable ? "notable" : "known"}${ident.titles?.length ? ` · ${ident.titles.at(-1)}` : ""}`,
      });
    };
  for (const f of W.factions)
    if (f.leaderId) push(f.leaderId, W.components.identity[f.leaderId], true);
  for (const id of PLAYER_EXPERIENCE?.pins || [])
    push(id, W.components.identity[id] || W.historicalIdentities[id], !!W.kind[id]);
  for (const id of W.activeIds) {
    const ident = W.components.identity[id];
    if (ident?.notable || ident?.legendary) push(id, ident, true);
  }
  for (const [key, ident] of Object.entries(W.historicalIdentities))
    if (ident?.notable || ident?.legendary) push(Number(key), ident, false);
  out.sort((a, b) => b.renown - a.renown || a.id - b.id);
  return out;
}
function warTitle(w) {
  const a = W.factions.find((f) => f.id === w.a),
    b = W.factions.find((f) => f.id === w.b);
  return `${a?.name || `Polity ${w.a}`} against ${b?.name || `Polity ${w.b}`}`;
}
function renderLegendList(what, query = "") {
  const q = query.trim().toLowerCase(),
    match = (name) => !q || String(name).toLowerCase().includes(q),
    row = (kind, id, title, sub) =>
      `<div class="legend-row" data-legend="${kind}:${id}"><span>${esc(title)}</span><span class="muted">${esc(sub)}</span></div>`;
  let rows = [],
    title = titleCase(what);
  if (what === "factions")
    rows = W.factions
      .filter((f) => match(f.name))
      .map((f) =>
        row(
          "faction",
          f.id,
          f.name,
          `${f.stability > 0 ? "living" : "fallen"} · ${f.population} people`,
        ),
      );
  else if (what === "cultures")
    rows = W.cultures
      .filter((c) => match(c.name))
      .map((c) =>
        row(
          "culture",
          c.id,
          c.name,
          `${W.factions.filter((f) => f.cultureId === c.id).length} polities`,
        ),
      );
  else if (what === "places")
    rows = W.settlements
      .filter((s) => match(s.name))
      .map((s) =>
        row(
          "place",
          s.id,
          s.name,
          `${s.ruined ? "ruin" : titleCase(s.stage || "settlement")} · Year ${formatYear(s.foundedTick)}`,
        ),
      );
  else if (what === "lives")
    rows = legendLives()
      .filter((x) => match(x.name))
      .map((x) => row("life", x.id, x.name, x.sub));
  else if (what === "species")
    rows = Object.values(W.speciesRegistry)
      .filter((s) => match(s.name))
      .sort((a, b) => b.peakCount - a.peakCount)
      .map((s) =>
        row(
          "species",
          s.key,
          s.name,
          `${titleCase(s.kind)} · ${s.extinct ? "extinct" : `${s.count} living`}`,
        ),
      );
  else if (what === "artifacts")
    rows = W.artifacts
      .filter((a) => match(a.name))
      .map((a) => row("artifact", a.id, a.name, `Year ${formatYear(a.creationTick)}`));
  else if (what === "wars")
    rows = W.activeWars
      .filter((w) => match(warTitle(w)))
      .map((w) =>
        row(
          "war",
          w.id,
          warTitle(w),
          w.ended ? `Y${formatYear(w.started)}–Y${formatYear(w.ended)}` : "ongoing",
        ),
      );
  else if (what === "calamities")
    rows = legendEvents((e) => e.category === "disasters" && e.importance >= 3)
      .reverse()
      .map((e) =>
        row(
          "event",
          e.id,
          titleCase(e.type.replace("Event", "")),
          `Year ${e.year} · ${locationName(e.location)}`,
        ),
      );
  return `<input class="legend-search" data-legend-search type="search" placeholder="Search ${esc(title.toLowerCase())}…" value="${esc(query)}"><div class="subhead">${esc(title)} · ${rows.length}</div>${
    rows.length
      ? `<div class="legend-list">${rows.slice(0, 200).join("")}</div>`
      : `<div class="empty">None recorded.</div>`
  }`;
}
function renderLifePage(id) {
  const ident = W.components.identity[id] || W.historicalIdentities[id];
  if (!ident) return `<div class="empty">No record survives of #${id}.</div>`;
  const alive = !!W.kind[id] && W.kind[id] !== KINDS.CORPSE && !!W.components.life[id],
    kind = W.kind[id] || ident.kind || ident.lifeKind || "life",
    life = W.components.life[id],
    summary = ident.lifeSummary,
    g = W.components.genome[id],
    species = g ? W.speciesRegistry[`${W.kind[id]}:${g.lineageId}`] : null,
    soc = W.components.social[id],
    fac = soc?.factionId ? W.factions.find((f) => f.id === soc.factionId) : null,
    culture = soc?.cultureId ? W.cultures.find((c) => c.id === soc.cultureId) : null,
    birth = ident.birthEventId ? eventById(ident.birthEventId) : null,
    deathId = ident.deathEventId || summary?.deathEventId || 0,
    death = deathId ? eventById(deathId) : null,
    bornYear = birth
      ? birth.year
      : life
        ? formatYear(Math.max(0, W.tick - life.age))
        : summary?.deathTick != null && summary.age != null
          ? formatYear(Math.max(0, summary.deathTick - summary.age))
          : null,
    diedYear =
      death && death.type !== "ArchivedEvent"
        ? death.year
        : summary?.deathTick != null
          ? formatYear(summary.deathTick)
          : null,
    cause = summary?.causeOfDeath || life?.causeOfDeath || "",
    partners = relationsOf(id, "partner_of").map((e) => (e.from === id ? e.to : e.from)),
    events = legendEvents((e) => e.subjects?.includes(id)),
    ledFactions = W.factions.filter((f) => f.leaderId === id);
  return `${legendHero(ident.generatedName || ident.name || `Entity ${id}`, [alive ? "Living" : "Dead", titleCase(kind), species ? legendLink("species", species.key, species.name) : ""], fac?.color)}${
    ident.titles?.length
      ? `<div class="row wrap" style="gap:4px;margin-bottom:8px">${ident.titles.map((t) => `<span class="tag gold">${esc(t)}</span>`).join("")}</div>`
      : ""
  }${alive && g ? `<canvas class="legend-portrait" data-portrait="${id}" aria-label="Portrait of ${esc(ident.generatedName || "")}"></canvas>` : ""}<div class="kv"><span>Born</span><b>${
    bornYear != null ? `Year ${bornYear}` : "unknown"
  }</b><span>${alive ? "Age" : "Died"}</span><b>${
    alive
      ? `${((life?.age || 0) / TICKS_PER_YEAR).toFixed(1)} years`
      : `${diedYear != null ? `Year ${diedYear}` : "unknown"}${cause ? ` · ${esc(cause)}` : ""}`
  }</b><span>Polity</span><b>${fac ? legendLink("faction", fac.id, fac.name) : "none"}${ledFactions.length ? ` · leads ${ledFactions.map((f) => legendLink("faction", f.id, f.name)).join(", ")}` : ""}</b><span>Culture</span><b>${
    culture ? legendLink("culture", culture.id, culture.name) : "none"
  }</b><span>Parents</span><b>${linkList(ident.parents)}</b><span>Partners</span><b>${linkList(partners)}</b><span>Children</span><b>${linkList(ident.children)}</b><span>Deeds</span><b>${ident.kills || 0} kills · ${ident.migrations || 0} migrations · ${ident.injuries || 0} injuries · ${ident.disastersSurvived || 0} disasters survived</b>${
    ident.settlementsFounded?.length
      ? `<span>Founded</span><b>${
          ident.settlementsFounded
            .map((sid) => placeLink(sid) || lifeLink(sid))
            .filter(Boolean)
            .join(", ") || "places now lost"
        }</b>`
      : ""
  }${
    ident.artifacts?.length
      ? `<span>Made</span><b>${
          ident.artifacts
            .map((aid) => {
              const a = W.artifacts.find((x) => x.id === aid || x.entityId === aid);
              return a ? legendLink("artifact", a.id, a.name) : "";
            })
            .filter(Boolean)
            .join(", ") || "artifacts now lost"
        }</b>`
      : ""
  }<span>Renown</span><b>${(ident.significance || 0).toFixed(1)}${ident.legendary ? " · legendary" : ident.notable ? " · notable" : ""}</b></div>${worldButtons(alive ? id : 0, death?.location ?? -1)}<div class="subhead">Chronicle</div>${timelineRows(events)}${relationsList(id)}`;
}
function renderFactionPage(id) {
  const f = W.factions.find((x) => x.id === id);
  if (!f) return `<div class="empty">No polity #${id} is recorded.</div>`;
  const culture = W.cultures.find((c) => c.id === f.cultureId),
    places = f.settlementIds.map((sid) => W.settlements.find((s) => s.id === sid)).filter(Boolean),
    capital = W.settlements.find((s) => s.id === f.capitalSettlementId),
    founding = legendEvents(
      (e) => e.type === "FactionFoundedEvent" && e.factions?.includes(f.id),
    )[0],
    voices = legendEvents(
      (e) =>
        (e.type === "LeadershipEvent" || e.type === "SuccessionEvent") &&
        e.factions?.includes(f.id),
    ),
    wars = W.activeWars.filter((w) => w.a === f.id || w.b === f.id),
    ethos = Object.entries(f.ethos || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3),
    allies = (f.allies || []).map(factionLink).filter(Boolean),
    enemies = Object.entries(f.relations || {})
      .filter(([, r]) => r.status === "hostile" || r.status === "at war")
      .map(([x]) => factionLink(Number(x)))
      .filter(Boolean),
    events = legendEvents((e) => e.factions?.includes(f.id) || e.subjects?.includes(f.entityId));
  return `${legendHero(f.name, [f.stability > 0 ? "Living polity" : "Fallen polity", culture ? legendLink("culture", culture.id, culture.name) : ""], f.color)}<div class="kv"><span>Founded</span><b>${founding ? `Year ${founding.year}` : "before the annals"}</b><span>People</span><b>${f.population}</b><span>Capital</span><b>${capital ? legendLink("place", capital.id, capital.name) : "none"}</b><span>Places</span><b>${places.map((s) => legendLink("place", s.id, s.name)).join(", ") || "none"}</b><span>Voice</span><b>${f.leaderId ? lifeLink(f.leaderId) || "unknown" : "none"}${f.successions ? ` · ${f.successions} succession${f.successions === 1 ? "" : "s"}` : ""}</b><span>Ethos</span><b>${ethos.map(([k, v]) => `${titleCase(k)} ${Math.round(v * 100)}%`).join(" · ") || "unknown"}</b><span>Stability</span><b>${Math.round(f.stability * 100)}% · cohesion ${Math.round(f.cohesion * 100)}% · aggression ${Math.round(f.aggression * 100)}%</b><span>Allies</span><b>${allies.join(", ") || "none"}</b><span>Enemies</span><b>${enemies.join(", ") || "none"}</b><span>Knowledge</span><b>${f.technologyLevel} reproducible processes</b></div>${worldButtons(f.entityId)}<div class="subhead">Voices</div>${
    voices.length
      ? `<div class="legend-timeline">${voices
          .slice()
          .reverse()
          .map(
            (e) =>
              `<div class="legend-row" data-legend="event:${e.id}"><span class="legend-year">Y${e.year}</span><span>${lifeLink(e.subjects?.[0]) || esc(entityName(e.subjects?.[0] || 0))}${e.data?.hereditary ? " · by blood" : ""}</span></div>`,
          )
          .join("")}</div>`
      : `<div class="empty">No Voice recorded.</div>`
  }<div class="subhead">Wars</div>${
    wars.length
      ? `<div class="legend-timeline">${wars
          .slice()
          .reverse()
          .map(
            (w) =>
              `<div class="legend-row" data-legend="war:${w.id}"><span class="legend-year">Y${formatYear(w.started)}</span><span>${esc(warTitle(w))}${w.ended ? ` · ended Year ${formatYear(w.ended)}` : " · ongoing"}</span></div>`,
          )
          .join("")}</div>`
      : `<div class="empty">No wars.</div>`
  }<div class="subhead">Chronicle</div>${timelineRows(events)}`;
}
function renderCulturePage(id) {
  const c = W.cultures.find((x) => x.id === id);
  if (!c) return `<div class="empty">No people #${id} is recorded.</div>`;
  const factions = W.factions.filter((f) => f.cultureId === c.id),
    places = W.settlements.filter((s) => s.cultureId === c.id),
    origin = W.settlements.find((s) => s.id === c.originSettlementId),
    factionIds = new Set(factions.map((f) => f.id)),
    events = legendEvents(
      (e) =>
        e.subjects?.includes(c.entityId) || (e.factions || []).some((fid) => factionIds.has(fid)),
    );
  return `${legendHero(c.name, ["People", `${factions.length} polities`])}<div class="kv"><span>Origin</span><b>${origin ? legendLink("place", origin.id, origin.name) : "lost"}</b><span>Valued substance</span><b>${esc(W.definitions.species[c.values?.substance]?.name || "unknown")}</b><span>Home biome</span><b>${esc(String(c.values?.environment || "unknown"))}</b><span>Communal</span><b>${Math.round((c.values?.communal || 0) * 100)}%</b><span>Drift</span><b>${Math.round((c.drift || 0) * 100)}%</b><span>Polities</span><b>${factions.map((f) => legendLink("faction", f.id, f.name)).join(", ") || "none"}</b><span>Places</span><b>${places.map((s) => legendLink("place", s.id, s.name)).join(", ") || "none"}</b></div>${typeof cultureLegendExtras === "function" ? cultureLegendExtras(c) : ""}<div class="subhead">Chronicle</div>${timelineRows(events)}`;
}
function renderPlacePage(id) {
  const s = W.settlements.find((x) => x.id === id);
  if (!s) return `<div class="empty">No place #${id} is recorded.</div>`;
  const f = s.factionId ? W.factions.find((x) => x.id === s.factionId) : null,
    culture = s.cultureId ? W.cultures.find((x) => x.id === s.cultureId) : null,
    tile = idx(s.x, s.y),
    buildings = W.buildings.filter(
      (b) => b.placeKind === "settlement" && b.placeId === s.id && !b.ruined && b.complete,
    ),
    byType = {},
    events = legendEvents(
      (e) =>
        e.subjects?.includes(s.entityId) ||
        (e.location >= 0 && dist2(...xy(e.location), s.x, s.y) <= 16),
    ),
    wars = W.activeWars.filter((w) => w.attackPlan?.targetSettlementId === s.id);
  for (const b of buildings) byType[b.type] = (byType[b.type] || 0) + 1;
  return `${legendHero(s.name, [s.ruined ? "Ruin" : titleCase(s.stage || "Settlement"), f ? legendLink("faction", f.id, f.name) : "", culture ? legendLink("culture", culture.id, culture.name) : ""], f?.color)}<div class="kv"><span>Founded</span><b>Year ${formatYear(s.foundedTick)}${s.founderId ? ` by ${lifeLink(s.founderId) || esc(entityName(s.founderId))}` : ""}</b><span>People</span><b>${s.ruined ? "none" : settlementPopulation(s)}</b><span>Built</span><b>${
    Object.entries(byType)
      .map(([t, n]) => `${n} ${esc(BUILDING_DEFS[t]?.name || t)}`)
      .join(" · ") || "nothing standing"
  }</b><span>Knowledge</span><b>${(s.knownProcesses || []).map((k) => titleCase(k.replace(/_/g, " "))).join(", ") || "none"}</b><span>Stability</span><b>${Math.round((s.stability || 0) * 100)}%</b>${s.omens ? `<span>Omens</span><b>${s.omens} witnessed · favour ${s.omenFavour > 0 ? "+" : ""}${s.omenFavour || 0}</b>` : ""}</div>${worldButtons(s.entityId, tile)}${
    wars.length
      ? `<div class="subhead">Wars fought over it</div><div class="legend-timeline">${wars.map((w) => `<div class="legend-row" data-legend="war:${w.id}"><span class="legend-year">Y${formatYear(w.started)}</span><span>${esc(warTitle(w))}</span></div>`).join("")}</div>`
      : ""
  }<div class="subhead">Chronicle</div>${timelineRows(events)}`;
}
function renderCampPage(id) {
  const c = W.camps.find((x) => x.id === id);
  if (!c) return `<div class="empty">No camp #${id} is recorded.</div>`;
  const events = legendEvents(
    (e) =>
      e.subjects?.includes(c.entityId) ||
      (e.location >= 0 && dist2(...xy(e.location), c.x, c.y) <= 9),
  );
  return `${legendHero(c.name, [c.active ? "Camp" : "Abandoned camp"])}<div class="kv"><span>Founded</span><b>Year ${formatYear(c.foundedTick)}${c.founderId ? ` by ${lifeLink(c.founderId) || esc(entityName(c.founderId))}` : ""}</b><span>Standing</span><b>${c.active ? `${c.stableTicks} ticks of occupancy` : "abandoned"}</b></div>${worldButtons(c.entityId, idx(c.x, c.y))}<div class="subhead">Chronicle</div>${timelineRows(events)}`;
}
function renderSpeciesPage(key) {
  const s = W.speciesRegistry[key];
  if (!s) return `<div class="empty">No species ${esc(String(key))} is recorded.</div>`;
  const member = W.activeIds.find(
      (id) =>
        W.kind[id] === s.kind &&
        W.components.genome[id]?.lineageId === s.lineage &&
        W.components.life[id],
    ),
    model = member ? creatureModel(member) : null,
    needle = String(s.lineage),
    events = legendEvents((e) => {
      const d = e.data || {};
      return (
        d.lineage === s.lineage ||
        d.lineageId === s.lineage ||
        d.speciesKey === key ||
        d.species === s.name ||
        d.name === s.name ||
        (typeof d.lineage === "string" && d.lineage === needle) ||
        (member && e.subjects?.includes(member))
      );
    }),
    notable = legendLives()
      .filter((x) => W.components.genome[x.id]?.lineageId === s.lineage && W.kind[x.id] === s.kind)
      .slice(0, 8);
  return `${legendHero(s.name, [titleCase(s.kind), s.extinct ? "Extinct" : `${s.count} living`, model ? model.label : ""])}${member ? `<canvas class="legend-portrait" data-portrait="${member}" aria-label="Specimen"></canvas>` : ""}<div class="kv"><span>First seen</span><b>Year ${formatYear(s.firstTick)}</b><span>Last seen</span><b>Year ${formatYear(s.lastSeen)}</b><span>Peak</span><b>${s.peakCount} at once</b><span>Traits</span><b>speed ${(s.avg?.speed || 0).toFixed(2)} · size ${(s.avg?.size || 0).toFixed(2)} · heat ${(s.avg?.heat || 0).toFixed(2)} · resist ${(s.avg?.resist || 0).toFixed(2)}</b>${notable.length ? `<span>Notable</span><b>${notable.map((x) => legendLink("life", x.id, x.name)).join(", ")}</b>` : ""}</div>${member ? worldButtons(member) : ""}<div class="subhead">Chronicle</div>${timelineRows(events)}`;
}
function renderArtifactPage(id) {
  const a = W.artifacts.find((x) => x.id === id);
  if (!a) return `<div class="empty">No artifact #${id} is recorded.</div>`;
  const s = W.settlements.find((x) => x.id === a.settlementId),
    events = legendEvents((e) => e.subjects?.includes(a.entityId) || e.data?.artifactId === a.id);
  return `${legendHero(a.name, ["Artifact", a.tool ? `${titleCase(a.tool.purpose || "utility")} tool` : a.form ? String(a.form) : ""])}<div class="kv"><span>Made</span><b>Year ${formatYear(a.creationTick)}</b><span>Maker</span><b>${lifeLink(a.creatorId) || esc(entityName(a.creatorId))}</b><span>Keeper</span><b>${lifeLink(a.ownerId) || esc(entityName(a.ownerId)) || "none"}</b><span>Origin</span><b>${s ? legendLink("place", s.id, s.name) : "lost"}</b></div>${worldButtons(a.ownerId && W.components.position[a.ownerId] ? a.ownerId : 0, s ? idx(s.x, s.y) : -1)}<div class="subhead">Chronicle</div>${timelineRows(events)}`;
}
function renderWarPage(id) {
  const w = W.activeWars.find((x) => x.id === id);
  if (!w) return `<div class="empty">No war #${id} is recorded.</div>`;
  const a = W.factions.find((f) => f.id === w.a),
    b = W.factions.find((f) => f.id === w.b),
    target = W.settlements.find((s) => s.id === w.attackPlan?.targetSettlementId),
    start = w.startEventId ? eventById(w.startEventId) : null,
    end = w.ended ? W.tick : W.tick,
    events = legendEvents(
      (e) =>
        e.tick >= w.started &&
        e.tick <= (w.ended || end) &&
        (e.category === "war" || e.category === "conflict") &&
        (e.factions || []).some((fid) => fid === w.a || fid === w.b),
    );
  return `${legendHero(warTitle(w), [w.ended ? "Ended" : "Ongoing", `${w.turns || 0} turns`], a?.color)}<div class="kv"><span>Began</span><b>Year ${formatYear(w.started)}${start?.evidence?.length ? ` · ${esc(start.evidence[0])}` : ""}</b><span>${w.ended ? "Ended" : "Now"}</span><b>${w.ended ? `Year ${formatYear(w.ended)} · ${esc(w.endReason || "peace")}` : "still fought"}</b><span>Attacker</span><b>${a ? legendLink("faction", a.id, a.name) : "unknown"}</b><span>Defender</span><b>${b ? legendLink("faction", b.id, b.name) : "unknown"}</b>${target ? `<span>Objective</span><b>${legendLink("place", target.id, target.name)}</b>` : ""}<span>Toll</span><b>${w.casualties || 0} dead · ${w.wounded || 0} wounded</b></div>${target ? worldButtons(target.entityId, idx(target.x, target.y)) : ""}<div class="subhead">Chronicle</div>${timelineRows(events, 80)}`;
}
function renderEventPage(id) {
  const e = eventById(id);
  if (!e || e.type === "ArchivedEvent")
    return `<div class="empty">Event #${id} has passed out of memory.</div>`;
  const consequences = legendEvents((x) => (x.causes || []).includes(id))
    .slice(-12)
    .reverse();
  return `${legendHero(titleCase(e.type.replace("Event", "")), [`Year ${e.year}`, titleCase(e.category), `importance ${e.importance}`])}<p style="line-height:1.55;margin:4px 0 8px">${esc(eventSentence(e))}</p><div class="kv"><span>Subjects</span><b>${linkList(e.subjects)}</b><span>Polities</span><b>${(e.factions || []).map(factionLink).filter(Boolean).join(", ") || "none"}</b><span>Where</span><b>${e.location >= 0 ? esc(locationName(e.location)) : "the wider world"}</b>${e.evidence?.length ? `<span>Evidence</span><b>${esc(e.evidence.join("; "))}</b>` : ""}</div>${worldButtons(0, e.location)}<div class="subhead">Causes</div>${e.causes?.length ? e.causes.map((c) => eventTree(c)).join("") || `<div class="empty">Causes have passed out of memory.</div>` : `<div class="empty">No recorded cause.</div>`}<div class="subhead">Consequences</div>${timelineRows(consequences)}`;
}
function renderLegendPage(kind = UI.legend.kind, id = UI.legend.id) {
  if (!W) return `<div class="empty">No world.</div>`;
  ensureAnnals();
  switch (kind) {
    case "index":
      return renderLegendIndex(UI.legend.query || "");
    case "list":
      return renderLegendList(String(id), UI.legend.query || "");
    case "life":
      return renderLifePage(Number(id));
    case "faction":
      return renderFactionPage(Number(id));
    case "culture":
      return renderCulturePage(Number(id));
    case "place":
      return renderPlacePage(Number(id));
    case "camp":
      return renderCampPage(Number(id));
    case "species":
      return renderSpeciesPage(String(id));
    case "artifact":
      return renderArtifactPage(Number(id));
    case "war":
      return renderWarPage(Number(id));
    case "event":
      return renderEventPage(Number(id));
    default:
      return renderLegendIndex("");
  }
}
function legendCrumbs() {
  const here =
    UI.legend.kind === "index"
      ? "Legends"
      : UI.legend.kind === "list"
        ? titleCase(String(UI.legend.id))
        : titleCase(UI.legend.kind);
  return `<div class="legend-nav">${UI.legend.kind !== "index" ? `<button class="small" data-legend="back">‹ Back</button><button class="small" data-legend="index:0">Legends</button>` : ""}<span class="crumb">${esc(here)}</span></div>`;
}
function refreshLegends() {
  if (!W) return;
  const pane = DOM.legendsPane || (DOM.legendsPane = $("#tab-legends"));
  if (!pane) return;
  pane.innerHTML = legendCrumbs() + renderLegendPage();
  mountLegendPortraits(pane);
}
// ── Wiring ─────────────────────────────────────────────────────────────────────
let LEGENDS_WIRED = false;
function wireLegends() {
  if (LEGENDS_WIRED || !DOM.rightPanel?.addEventListener) return;
  LEGENDS_WIRED = true;
  DOM.rightPanel.addEventListener("click", (e) => {
    const link = e.target.closest?.("[data-legend]");
    if (!link) return;
    const [kind, id] = String(link.dataset.legend).split(":");
    e.stopPropagation();
    openLegend(
      kind,
      id === undefined ? null : kind === "species" || kind === "list" ? id : Number(id),
    );
  });
  DOM.rightPanel.addEventListener("input", (e) => {
    const box = e.target.closest?.("[data-legend-search]");
    if (!box) return;
    UI.legend.query = box.value || "";
    const pane = DOM.legendsPane || $("#tab-legends");
    if (!pane) return;
    // Re-render the body but keep the caret in the search box.
    const pos = box.selectionStart;
    pane.innerHTML = legendCrumbs() + renderLegendPage();
    const again = pane.querySelector?.("[data-legend-search]");
    if (again) {
      again.focus?.();
      try {
        again.setSelectionRange?.(pos, pos);
      } catch (error) {
        /* not focusable in this environment */
      }
    }
  });
  const tab = $$(".tab").find?.((b) => b.dataset.tab === "legends");
  if (tab && !tab.onclick) tab.onclick = () => refreshTabs("legends");
}
const refreshTabsLegendsBase = refreshTabs;
refreshTabs = function (tab) {
  refreshTabsLegendsBase(tab);
  wireLegends();
  if (tab === "legends") refreshLegends();
};
const refreshUILegendsBase = refreshUI;
refreshUI = function (force = false) {
  const tick = W?.tick;
  refreshUILegendsBase(force);
  if (W && UI.activeTab === "legends" && (force || tick % 64 === 0)) refreshLegends();
};
// Every inspector gets a way into the legends of what is selected.
const refreshInspectorLegendsBase = refreshInspector;
refreshInspector = function () {
  refreshInspectorLegendsBase();
  if (!W || !DOM.inspectPane?.insertAdjacentHTML) return;
  const id = UI.selectedEntity,
    tile = UI.selectedTile,
    settlement = !id && tile >= 0 ? nearestSettlement(tile, 1) : null,
    target = id ? legendTarget(id) : settlement ? { kind: "place", id: settlement.id } : null;
  if (!target) return;
  DOM.inspectPane.insertAdjacentHTML(
    "afterbegin",
    `<div class="row wrap legend-entry" style="gap:6px;margin-bottom:6px"><button class="small" data-legend="${target.kind}:${target.id}">Open in Legends</button></div>`,
  );
};
window.ALIFE_LEGENDS_DEBUG = Object.freeze({
  render: (kind, id) => renderLegendPage(kind, id),
  open: (kind, id) => openLegend(kind, id),
  annals: () => (W?.annals || []).length,
  annalById: (id) => annalById(id),
  lives: () => legendLives(),
});
