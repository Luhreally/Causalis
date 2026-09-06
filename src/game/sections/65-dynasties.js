// ═══════════════════════════════════════════════════════════════════════════
// 65. DYNASTIES — houses, family trees, and the Voices a house has held
// ═══════════════════════════════════════════════════════════════════════════
// Parents and children were recorded and houses were named, but there was no
// way to read a family. A registry of houses is kept as the world runs: who
// has belonged to each, living or dead, and which of them held a polity's
// Voice and when. Legends gains a page per house with a tree grown from its
// oldest known members, the Voices it has held, its feuds, and the songs sung
// of its people; polities show their ruling house and call it a dynasty when
// the Voice has passed within one house more than once. Rendering is pure.
function ensureHouses(world = W) {
  if (!world) return;
  world.houses = world.houses || {};
}
const restoreWorldHousesBase = restoreWorldDefaults;
restoreWorldDefaults = function () {
  restoreWorldHousesBase();
  ensureHouses(W);
};
function houseRecord(kinGroupId, create = true) {
  ensureHouses();
  let h = W.houses[kinGroupId];
  if (!h && create) {
    h = W.houses[kinGroupId] = {
      id: kinGroupId,
      name: "",
      members: [],
      voices: [],
      firstTick: W.tick,
    };
  }
  return h || null;
}
function updateHouses() {
  ensureHouses();
  for (const id of W.activeIds) {
    if (W.kind[id] !== KINDS.PERSON || !classifyAlive(id)) continue;
    const kin = W.components.social[id]?.kinGroupId;
    if (!kin) continue;
    const h = houseRecord(kin);
    if (!h.members.includes(id)) h.members.push(id);
    h.names = h.names || {};
    h.names[id] = W.components.identity[id]?.generatedName || h.names[id] || "";
    if (!h.name) h.name = typeof houseName === "function" ? houseName(kin, id) : `House ${kin}`;
  }
  for (const f of W.factions) {
    if (!f.leaderId || !classifyAlive(f.leaderId)) continue;
    const kin = W.components.social[f.leaderId]?.kinGroupId;
    if (!kin) continue;
    const h = houseRecord(kin),
      last = h.voices[h.voices.length - 1];
    if (!last || last.id !== f.leaderId || last.factionId !== f.id)
      h.voices.push({ id: f.leaderId, factionId: f.id, from: W.tick });
  }
}
const updateWeatherCycleHousesBase = updateWeatherCycle;
updateWeatherCycle = function () {
  updateWeatherCycleHousesBase();
  if (W?.houses !== undefined || W?.activeIds) {
    ensureHouses(W);
    if (W.tick % 256 === 72) updateHouses();
  }
};
// ── Reading a house ────────────────────────────────────────────────────────────
function identityOf(id) {
  return W.components.identity[id] || W.historicalIdentities?.[id] || null;
}
function personYears(id) {
  const ident = identityOf(id),
    life = W.components.life[id];
  if (!ident) return "";
  const alive = !!W.kind[id] && W.kind[id] !== KINDS.CORPSE && !!life,
    summary = ident.lifeSummary,
    born = life
      ? formatYear(Math.max(0, W.tick - life.age))
      : summary?.deathTick != null && summary.age != null
        ? formatYear(Math.max(0, summary.deathTick - summary.age))
        : null,
    died = !alive && summary?.deathTick != null ? formatYear(summary.deathTick) : null;
  if (born == null && died == null) return alive ? "living" : "";
  return `${born != null ? `b. Y${born}` : ""}${died != null ? `${born != null ? " · " : ""}d. Y${died}` : alive ? "" : ""}`;
}
function houseVoiceIds(h) {
  return new Set((h?.voices || []).map((v) => v.id));
}
// The tree grows from the members whose parents are outside the house.
function houseTree(h, limit = 120) {
  const members = new Set(h.members),
    seen = new Set(),
    voices = houseVoiceIds(h);
  let count = 0;
  const roots = h.members.filter((id) => {
    const parents = identityOf(id)?.parents || [];
    return !parents.some((p) => members.has(p));
  });
  const node = (id, depth) => {
    if (seen.has(id) || count >= limit || depth > 8) return "";
    seen.add(id);
    count++;
    const ident = identityOf(id),
      name = ident?.generatedName || ident?.name || h.names?.[id] || `#${id}`,
      alive = !!W.kind[id] && W.kind[id] !== KINDS.CORPSE && !!W.components.life[id],
      kids = (ident?.children || []).filter((c) => (identityOf(c) || h.names?.[c]) && !seen.has(c)),
      titles = (ident?.titles || [])
        .filter((t) => /Voice|Chosen|Speaker|Exile|Deposed/.test(t))
        .slice(0, 2),
      label = `${alive ? lifeLink(id) || esc(name) : legendLink("life", id, name, "muted")}${voices.has(id) ? ' <span title="held a Voice">♛</span>' : ""}${
        titles.length ? ` <span class="muted">· ${esc(titles.join(", "))}</span>` : ""
      } <span class="muted">${esc(personYears(id))}</span>`,
      children = kids.map((c) => node(c, depth + 1)).filter(Boolean);
    return `<li>${label}${children.length ? `<ul>${children.join("")}</ul>` : ""}</li>`;
  };
  const items = roots.map((id) => node(id, 0)).filter(Boolean);
  return items.length
    ? `<ul class="tree">${items.join("")}</ul>`
    : `<div class="empty">No line recorded yet.</div>`;
}
function houseSongs(h) {
  const out = [];
  for (const c of W.cultures)
    for (const s of c.songs || []) {
      if (s.spreadFrom) continue;
      const theme = eventById(s.eventId);
      if (theme?.subjects?.some((id) => h.members.includes(id))) out.push([s, c]);
    }
  return out;
}
function renderHousePage(kinGroupId) {
  ensureHouses();
  const h = W.houses[kinGroupId];
  if (!h) return `<div class="empty">No house #${kinGroupId} is recorded.</div>`;
  const living = h.members.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id)),
    dead = h.members.length - living.length,
    polity =
      typeof housePolity === "function"
        ? W.factions.find((f) => f.id === housePolity(kinGroupId))
        : null,
    feuds = typeof houseFeuds === "function" ? houseFeuds(kinGroupId) : [],
    songs = houseSongs(h),
    voices = h.voices
      .slice()
      .reverse()
      .map((v) => {
        const f = W.factions.find((x) => x.id === v.factionId);
        return `<div class="legend-row"><span class="legend-year">Y${formatYear(v.from)}</span><span>${lifeLink(v.id) || legendLink("life", v.id, identityOf(v.id)?.generatedName || identityOf(v.id)?.name || `#${v.id}`)} · Voice of ${f ? legendLink("faction", f.id, f.name) : "a fallen polity"}</span></div>`;
      }),
    dynasty = dynastyOf(h);
  return `${legendHero(`The house of ${h.name || kinGroupId}`, ["House", `${living.length} living`, dead ? `${dead} remembered` : "", dynasty ? `${dynasty.count} Voices held` : ""])}<div class="kv"><span>Polity</span><b>${
    polity ? legendLink("faction", polity.id, polity.name) : "none"
  }</b><span>Known since</span><b>Year ${formatYear(h.firstTick)}</b>${
    feuds.length
      ? `<span>Feuds</span><b>${feuds.map((f) => legendLink("feud", f.id, typeof feudTitle === "function" ? titleCase(feudTitle(f)) : `feud ${f.id}`)).join(", ")}</b>`
      : ""
  }</div><div class="subhead">Family tree</div>${houseTree(h)}<div class="subhead">Voices held</div>${
    voices.length
      ? `<div class="legend-timeline">${voices.join("")}</div>`
      : `<div class="empty">None yet.</div>`
  }${
    songs.length
      ? `<div class="subhead">Sung of</div><div class="legend-timeline">${songs
          .slice(0, 8)
          .map(
            ([s, c]) =>
              `<div class="legend-row" data-legend="event:${s.eventId}"><span class="legend-year">Y${formatYear(s.tick)}</span><span><b>${esc(s.title)}</b> · ${esc(s.kind)} of the ${esc(c.name)}</span></div>`,
          )
          .join("")}</div>`
      : ""
  }`;
}
// A dynasty is a house that has held the same polity's Voice more than once.
function dynastyOf(h) {
  const counts = new Map();
  for (const v of h.voices) counts.set(v.factionId, (counts.get(v.factionId) || 0) + 1);
  let best = 0,
    count = 0;
  for (const [f, n] of counts)
    if (n > count || (n === count && f < best)) ((best = f), (count = n));
  return count >= 2 ? { factionId: best, count } : null;
}
function rulingHouse(f) {
  ensureHouses();
  if (!f?.leaderId) return null;
  const kin = W.components.social[f.leaderId]?.kinGroupId;
  return kin ? W.houses[kin] || null : null;
}
function houseCards(limit = 6, query = "") {
  ensureHouses();
  const q = query.trim().toLowerCase();
  return Object.values(W.houses)
    .filter((h) => h.members.length >= 2 && (!q || (h.name || "").toLowerCase().includes(q)))
    .map((h) => ({
      h,
      living: h.members.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id)).length,
    }))
    .sort((a, b) => b.h.voices.length - a.h.voices.length || b.living - a.living || a.h.id - b.h.id)
    .slice(0, limit);
}
// ── Hooks into Legends ─────────────────────────────────────────────────────────
const renderLegendPageHousesBase = renderLegendPage;
renderLegendPage = function (kind = UI.legend.kind, id = UI.legend.id) {
  if (kind === "house" && W) return renderHousePage(Number(id));
  return renderLegendPageHousesBase(kind, id);
};
const renderLegendIndexHousesBase = renderLegendIndex;
renderLegendIndex = function (query = "") {
  const html = renderLegendIndexHousesBase(query),
    total = Object.values(W.houses || {}).filter((h) => h.members.length >= 2).length,
    cards = houseCards(6, query);
  if (!cards.length) return html;
  return `${html}<div class="row between" style="margin-top:10px"><span class="subhead" style="margin:0">Houses</span>${
    total > 6 ? legendLink("list", "houses", `all ${total}`) : `<span class="muted">${total}</span>`
  }</div><div class="legend-grid">${cards
    .map(
      ({ h, living }) =>
        `<div class="legend-card" data-legend="house:${h.id}"><b>House of ${esc(h.name || String(h.id))}</b><small>${living} living · ${h.members.length - living} remembered${h.voices.length ? ` · ${h.voices.length} Voice${h.voices.length === 1 ? "" : "s"}` : ""}</small></div>`,
    )
    .join("")}</div>`;
};
const renderLegendListHousesBase = renderLegendList;
renderLegendList = function (what, query = "") {
  if (what !== "houses") return renderLegendListHousesBase(what, query);
  const rows = houseCards(400, query).map(
    ({ h, living }) =>
      `<div class="legend-row" data-legend="house:${h.id}"><span>House of ${esc(h.name || String(h.id))}</span><span class="muted">${living} living${h.voices.length ? ` · ${h.voices.length} Voice${h.voices.length === 1 ? "" : "s"}` : ""}</span></div>`,
  );
  return `<input class="legend-search" data-legend-search type="search" placeholder="Search houses…" value="${esc(query)}"><div class="subhead">Houses · ${rows.length}</div>${
    rows.length
      ? `<div class="legend-list">${rows.join("")}</div>`
      : `<div class="empty">None recorded.</div>`
  }`;
};
const renderFactionPageHousesBase = renderFactionPage;
renderFactionPage = function (id) {
  const html = renderFactionPageHousesBase(id),
    f = W.factions.find((x) => x.id === id),
    h = f ? rulingHouse(f) : null;
  if (!f || !h) return html;
  const dynasty = dynastyOf(h),
    held = h.voices.filter((v) => v.factionId === f.id).length,
    block = `<div class="kv"><span>Ruling house</span><b>${legendLink("house", h.id, `House of ${h.name || h.id}`)}${
      dynasty && dynasty.factionId === f.id
        ? ` <span class="muted">· a dynasty of ${held} Voice${held === 1 ? "" : "s"}</span>`
        : held > 1
          ? ` <span class="muted">· ${held} Voices</span>`
          : ""
    }</b></div>`,
    at = html.indexOf('<div class="subhead">Voices</div>');
  return at < 0 ? html + block : html.slice(0, at) + block + html.slice(at);
};
const renderLifePageHousesBase = renderLifePage;
renderLifePage = function (id) {
  const html = renderLifePageHousesBase(id),
    kin = W.components.social[id]?.kinGroupId;
  if (!kin || !W.houses?.[kin]) return html;
  return `${html}<div class="row wrap" style="gap:6px;margin:8px 0"><button class="small" data-legend="house:${kin}">Family tree</button></div>`;
};
window.ALIFE_HOUSES_DEBUG = Object.freeze({
  update: () => {
    updateHouses();
    return Object.keys(W.houses).length;
  },
  page: (kin) => renderHousePage(kin),
  tree: (kin) => (W.houses[kin] ? houseTree(W.houses[kin]) : ""),
  house: (kin) =>
    W.houses[kin]
      ? {
          ...W.houses[kin],
          members: W.houses[kin].members.slice(),
          voices: W.houses[kin].voices.slice(),
        }
      : null,
  dynasty: (kin) => (W.houses[kin] ? dynastyOf(W.houses[kin]) : null),
  cards: () => houseCards(6).map(({ h }) => h.name),
});
