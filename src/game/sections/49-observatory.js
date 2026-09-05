// ═══════════════════════════════════════════════════════════════════════════
// 49. OBSERVATORY: PEOPLE BAR, ALERT PAIRS, AND MAP MODES
// ═══════════════════════════════════════════════════════════════════════════
// The drama was in the data but the watcher had to hunt for it. Three surfaces
// put it on screen: a people bar of the lives that matter now (followed,
// selected, pinned, the Voices, and whoever the annals just named) with mood,
// activity, and health; alert cards for notable events as they happen, each
// linked to the earlier event it follows so a death and its succession, or a
// war and its end, read as one arc; and map modes for roads and trade, the
// season, species ranges, and where history has gathered. Everything here
// reads the world and writes only interface state.
UI.observatory = UI.observatory || {
  world: null,
  lastAnnalId: 0,
  alerts: [],
  ring: [],
  muted: false,
  barCollapsed: false,
  barKey: "",
  alertKey: "",
};
const ALERT_LIMIT = 4,
  ALERT_TTL = 45000,
  ALERT_CATEGORIES = new Set(["factions", "war", "disasters", "settlements"]);
// ── People bar ─────────────────────────────────────────────────────────────────
function peopleBarCandidates(limit = 10) {
  const out = [],
    seen = new Set(),
    push = (id, why) => {
      if (!id || seen.has(id) || out.length >= limit) return;
      if (W.kind[id] !== KINDS.PERSON || !W.components.life[id] || !classifyAlive(id)) return;
      seen.add(id);
      out.push({ id, why });
    };
  push(UI.followId, "followed");
  push(UI.selectedEntity, "selected");
  for (const id of (typeof PLAYER_EXPERIENCE !== "undefined" && PLAYER_EXPERIENCE?.pins) || [])
    push(id, "pinned");
  for (const f of W.factions) if (f.stability > 0 && f.leaderId) push(f.leaderId, "voice");
  const recent = (W.annals || []).slice(-40).reverse();
  for (const a of recent) for (const id of a.subjects || []) push(id, "in the annals");
  return out;
}
function personStatusWord(id) {
  const life = W.components.life[id];
  if (!life) return "";
  if (life.wounded) return "wounded";
  if (life.infected) return "sick";
  if (life.hunger > 70) return "hungry";
  if (life.thirst > 70) return "thirsty";
  return life.behavior || "idle";
}
function peopleBarEntry(entry) {
  const id = entry.id,
    life = W.components.life[id],
    ident = W.components.identity[id],
    soc = W.components.social[id],
    fac = soc?.factionId ? W.factions.find((f) => f.id === soc.factionId) : null,
    fullName = ident?.generatedName || `#${id}`,
    name = fullName.split(" ")[0],
    emoji = soc?.emotion?.emoji || "",
    health = clamp((life?.health || 0) / 100, 0, 1),
    status = personStatusWord(id),
    voice = W.factions.some((f) => f.leaderId === id),
    pinned = !!(typeof PLAYER_EXPERIENCE !== "undefined" && PLAYER_EXPERIENCE?.pins?.includes(id)),
    active = id === UI.followId || id === UI.selectedEntity;
  return `<button class="people-entry ${active ? "active" : ""}" data-people="${id}" title="${esc(fullName)} · ${esc(status)}${voice ? " · Voice" : ""}${entry.why === "in the annals" ? " · in the annals" : ""}" style="--fac:${fac?.color || "transparent"}"><canvas class="people-portrait" data-people-portrait="${id}" width="34" height="34"></canvas><span class="people-name">${esc(name)}${voice ? " ◆" : ""}${pinned ? " ●" : ""}</span><span class="people-mood">${emoji}</span><span class="people-health"><i style="width:${Math.round(health * 100)}%;background:${health > 0.5 ? "#8fd18a" : health > 0.25 ? "#d9b56d" : "#e0645c"}"></i></span></button>`;
}
function renderPeopleBar(entries) {
  const o = UI.observatory;
  return `<button class="people-toggle" data-people-toggle title="${o.barCollapsed ? "Show the people bar" : "Collapse the people bar"}">${o.barCollapsed ? "▴ People" : "▾"}</button>${
    o.barCollapsed ? "" : `<div class="people-scroll">${entries.map(peopleBarEntry).join("")}</div>`
  }`;
}
function mountPeoplePortraits(bar) {
  if (!bar?.querySelectorAll) return;
  const v = makePlanetVisualGenome(),
    dpr = Math.min(2, (typeof devicePixelRatio === "number" && devicePixelRatio) || 1);
  for (const canvas of bar.querySelectorAll("canvas[data-people-portrait]")) {
    const id = Number(canvas.dataset.peoplePortrait);
    if (!W.components.genome[id] || !W.components.life[id]) continue;
    canvas.width = Math.floor(34 * dpr);
    canvas.height = Math.floor(34 * dpr);
    const g = canvas.getContext("2d");
    if (!g) continue;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = hsl(v.voidHue, 40, 10);
    g.fillRect(0, 0, 34, 34);
    drawCreatureGlyph(g, id, { x: 17, y: 18 }, W.tick * 12, null, 11, true);
  }
}
function refreshPeopleBar(force = false) {
  const bar = DOM.peopleBar || (DOM.peopleBar = $("#peopleBar")),
    stage = DOM.stage || (DOM.stage = $("#stage"));
  if (!bar || !W) return;
  const entries = peopleBarCandidates(),
    key =
      entries
        .map(
          (e) =>
            `${e.id}:${personStatusWord(e.id)}:${Math.round((W.components.life[e.id]?.health || 0) / 10)}:${W.components.social[e.id]?.emotion?.emoji || ""}`,
        )
        .join("|") + `|${UI.followId}:${UI.selectedEntity}:${UI.observatory.barCollapsed}`;
  if (!force && key === UI.observatory.barKey) return;
  UI.observatory.barKey = key;
  if (!entries.length) {
    bar.classList?.add("hidden");
    bar.innerHTML = "";
    stage?.classList?.remove("has-people-bar");
    return;
  }
  bar.classList?.remove("hidden");
  stage?.classList?.add("has-people-bar");
  bar.innerHTML = renderPeopleBar(entries);
  if (!UI.observatory.barCollapsed) mountPeoplePortraits(bar);
}
// ── Alert pairs ────────────────────────────────────────────────────────────────
function alertWorthy(a) {
  return a.importance >= 4 || (a.importance >= 3 && ALERT_CATEGORIES.has(a.category));
}
function shortSentence(e, max = 120) {
  const s = eventSentence(e);
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}
function ringEntry(a) {
  return {
    id: a.id,
    type: a.type,
    factions: a.factions || [],
    subjects: a.subjects || [],
    text: shortSentence(a, 84),
  };
}
function sameFactionPair(a, b) {
  return a.length === 2 && b.length === 2 && a.every((x) => b.includes(x));
}
// What an event follows: an earlier recorded event among its causes, or the
// beginning of the war it ends.
function alertFollows(a) {
  const ring = UI.observatory.ring;
  for (const c of a.causes || []) {
    const prior = ring.find((r) => r.id === c);
    if (prior) return prior;
  }
  if (a.type === "WarEndedEvent")
    for (let n = ring.length - 1; n >= 0; n--)
      if (ring[n].type === "WarStartedEvent" && sameFactionPair(ring[n].factions, a.factions || []))
        return ring[n];
  if (a.type === "SettlementFoundedEvent" || a.type === "CampFoundedEvent")
    for (let n = ring.length - 1; n >= 0; n--)
      if (
        (ring[n].type === "SettlementDestroyedEvent" || ring[n].type === "CampAbandonedEvent") &&
        ring[n].subjects.some((id) => (a.subjects || []).includes(id))
      )
        return ring[n];
  return null;
}
function collectAlerts() {
  const o = UI.observatory,
    annals = W?.annals || [];
  if (!W) return;
  if (o.world !== W) {
    // A newly opened world seeds the memory silently: old history is not replayed as news.
    o.world = W;
    o.alerts = [];
    o.ring = annals.slice(-200).map(ringEntry);
    o.lastAnnalId = annals.length ? annals[annals.length - 1].id : 0;
    o.alertKey = "";
    return;
  }
  if (!annals.length) return;
  let start = annals.length;
  while (start > 0 && annals[start - 1].id > o.lastAnnalId) start--;
  for (let n = start; n < annals.length; n++) {
    const a = annals[n];
    if (a.id <= o.lastAnnalId) continue;
    if (alertWorthy(a) && !o.muted) {
      const follows = alertFollows(a);
      o.alerts.push({
        id: a.id,
        year: a.year,
        category: a.category,
        type: a.type,
        text: shortSentence(a),
        location: a.location,
        subject: a.subjects?.[0] || 0,
        follows: follows ? { id: follows.id, text: follows.text } : null,
        shown: performance.now(),
      });
      if (o.alerts.length > ALERT_LIMIT) o.alerts.splice(0, o.alerts.length - ALERT_LIMIT);
    }
    o.ring.push(ringEntry(a));
    if (o.ring.length > 200) o.ring.shift();
  }
  o.lastAnnalId = annals[annals.length - 1].id;
}
function renderAlerts() {
  const o = UI.observatory;
  if (!o.alerts.length)
    return o.muted
      ? `<div class="alert-head"><span></span><span><button data-alert-mute title="Alerts are muted">🔕</button></span></div>`
      : "";
  return `<div class="alert-head"><span>Notable now</span><span><button data-alert-mute title="${o.muted ? "Unmute alerts" : "Mute alerts"}">${o.muted ? "🔕" : "🔔"}</button><button data-alert-clear title="Dismiss all">✕</button></span></div>${o.alerts
    .slice()
    .reverse()
    .map(
      (a) =>
        `<div class="alert-card ${esc(a.category)}"><div class="alert-line"><span class="legend-year">Y${a.year}</span><span>${esc(a.text)}</span></div>${
          a.follows
            ? `<div class="alert-follows" data-legend="event:${a.follows.id}">↳ follows: ${esc(a.follows.text)}</div>`
            : ""
        }<div class="alert-actions"><button class="small" data-legend="event:${a.id}">Legends</button>${
          a.location >= 0 || a.subject
            ? `<button class="small" data-alert-go="${a.id}">Go</button>`
            : ""
        }<button class="small" data-alert-dismiss="${a.id}">✕</button></div></div>`,
    )
    .join("")}`;
}
function refreshAlerts() {
  const stack = DOM.alertStack || (DOM.alertStack = $("#alertStack"));
  if (!stack || !W) return;
  collectAlerts();
  const o = UI.observatory,
    now = performance.now();
  o.alerts = o.alerts.filter((a) => now - a.shown < ALERT_TTL);
  const key = o.alerts.map((a) => a.id).join(",") + (o.muted ? "|m" : "");
  if (key === o.alertKey) return;
  o.alertKey = key;
  stack.innerHTML = renderAlerts();
}
// ── Map modes ──────────────────────────────────────────────────────────────────
let ROUTE_MASK = { world: null, key: "", mask: null },
  HISTORY_MASK = { world: null, size: -1, mask: null };
function plotMaskLine(mask, x0, y0, x1, y1) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let n = 0; n <= steps; n++) {
    const t = steps ? n / steps : 0,
      x = Math.round(x0 + (x1 - x0) * t),
      y = Math.round(y0 + (y1 - y0) * t);
    if (inside(x, y)) mask[idx(x, y)] = 1;
  }
}
function routeMask() {
  const routes = W.tradeRoutes || [],
    key =
      routes.map((r) => `${r.a}:${r.b}:${r.trips > 0 ? 1 : 0}`).join("|") +
      `|${W.settlements.length}`;
  if (ROUTE_MASK.world === W && ROUTE_MASK.key === key) return ROUTE_MASK.mask;
  const mask = new Uint8Array(W.tileCount);
  for (const r of routes) {
    if (!(r.trips > 0)) continue;
    const a = W.settlements.find((s) => s.id === r.a),
      b = W.settlements.find((s) => s.id === r.b);
    if (a && b) plotMaskLine(mask, a.x, a.y, b.x, b.y);
  }
  ROUTE_MASK = { world: W, key, mask };
  return mask;
}
function historyMask() {
  const annals = W.annals || [];
  if (HISTORY_MASK.world === W && HISTORY_MASK.size === annals.length) return HISTORY_MASK.mask;
  const mask = new Uint8Array(W.tileCount);
  for (const a of annals) {
    if (!(a.location >= 0) || a.location >= W.tileCount) continue;
    const [cx, cy] = xy(a.location);
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const x = cx + dx,
          y = cy + dy;
        if (!inside(x, y)) continue;
        const i = idx(x, y);
        mask[i] = Math.min(255, mask[i] + (Math.abs(dx) + Math.abs(dy) <= 1 ? 2 : 1));
      }
  }
  HISTORY_MASK = { world: W, size: annals.length, mask };
  return mask;
}
function dominantLineageAt(i) {
  const bin = W.spatialBins?.[i];
  if (!bin) return null;
  let lineage = 0,
    count = 0;
  for (const id of bin) {
    const g = W.components.genome[id];
    if (g && W.components.life[id]) {
      lineage = g.lineageId;
      count++;
    }
  }
  return count ? { lineage, count } : null;
}
const overlayValueObservatoryBase = overlayValue;
overlayValue = function (name, i) {
  switch (name) {
    case "routes":
      return clamp((W.tiles.traffic?.[i] || 0) / 30 + (routeMask()[i] ? 60 : 0), 0, 100);
    case "season": {
      const amp = W.terrainGenome?.landform?.season?.amplitude || 0;
      return amp ? clamp(50 + ((W.tiles.seasonOffset?.[i] || 0) / amp) * 50, 0, 100) : 50;
    }
    case "species":
      return dominantLineageAt(i) ? 100 : 0;
    case "history":
      return clamp(historyMask()[i] * 12, 0, 100);
    default:
      return overlayValueObservatoryBase(name, i);
  }
};
const overlayStyleObservatoryBase = overlayStyle;
overlayStyle = function (name, i) {
  if (name === "routes") {
    const traffic = W.tiles.traffic?.[i] || 0;
    if (routeMask()[i]) return hsl(42, 90, 62, 0.62);
    return traffic > 60 ? hsl(28, 55, 55, clamp(traffic / 3000, 0.12, 0.7)) : "transparent";
  }
  if (name === "season") {
    const off = W.tiles.seasonOffset?.[i] || 0,
      amp = W.terrainGenome?.landform?.season?.amplitude || 0;
    if (!amp || !off) return "transparent";
    return hsl(off > 0 ? 22 : 212, 85, 58, 0.15 + clamp(Math.abs(off) / amp, 0, 1) * 0.5);
  }
  if (name === "species") {
    const found = dominantLineageAt(i);
    return found
      ? hsl(
          hashParts(W.seedHash, "species-hue", found.lineage) % 360,
          72,
          58,
          clamp(0.35 + found.count * 0.15, 0.35, 0.8),
        )
      : "transparent";
  }
  if (name === "history") {
    const v = historyMask()[i];
    return v ? hsl(45, 85, 62, clamp(0.12 + v * 0.1, 0.12, 0.7)) : "transparent";
  }
  return overlayStyleObservatoryBase(name, i);
};
const OVERLAY_LEGENDS = Object.freeze({
  routes: "worn paths in brown, trade routes in gold",
  season: "warm offset red, cold offset blue",
  species: "one colour per species",
  history: "brighter where the annals gather",
  territory: "each polity in its colour",
  culture: "each people in its colour",
  population: "brighter where more live",
});
const overlayLegendColorObservatoryBase = overlayLegendColor;
overlayLegendColor = function (id) {
  return (
    { routes: "#e0b060", season: "#7fb0ff", species: "#b07fff", history: "#ffd27f" }[id] ||
    overlayLegendColorObservatoryBase(id)
  );
};
const setOverlayObservatoryBase = setOverlay;
setOverlay = function (name) {
  setOverlayObservatoryBase(name);
  if (!UI.overlay || !DOM.mapOverlay) return;
  const def = OVERLAY_DEFS.find((d) => d[0] === UI.overlay),
    legend = OVERLAY_LEGENDS[UI.overlay];
  DOM.mapOverlay.textContent = `${def ? def[1] : titleCase(UI.overlay)}${legend ? ` · ${legend}` : ""}`;
};
// ── Wiring ─────────────────────────────────────────────────────────────────────
let OBSERVATORY_WIRED = false;
function wireObservatory() {
  const stage = DOM.stage || (DOM.stage = $("#stage"));
  if (OBSERVATORY_WIRED || !stage?.addEventListener) return;
  OBSERVATORY_WIRED = true;
  stage.addEventListener("click", (e) => {
    const person = e.target.closest?.("[data-people]"),
      toggle = e.target.closest?.("[data-people-toggle]"),
      legend = e.target.closest?.("[data-legend]"),
      go = e.target.closest?.("[data-alert-go]"),
      dismiss = e.target.closest?.("[data-alert-dismiss]"),
      mute = e.target.closest?.("[data-alert-mute]"),
      clear = e.target.closest?.("[data-alert-clear]");
    if (toggle) {
      UI.observatory.barCollapsed = !UI.observatory.barCollapsed;
      refreshPeopleBar(true);
    } else if (person) {
      const id = Number(person.dataset.people);
      if (UI.selectedEntity === id) UI.followId = UI.followId === id ? 0 : id;
      else selectEntity(id);
      focusHistoryTarget(id);
      refreshPeopleBar(true);
    } else if (legend) {
      const [kind, id] = String(legend.dataset.legend).split(":");
      openLegend(kind, kind === "species" || kind === "list" ? id : Number(id));
      if (
        typeof setMobilePanel === "function" &&
        UI.mobileMode &&
        !DOM.rightPanel?.classList?.contains("open")
      )
        setMobilePanel("right", legend);
    } else if (go) {
      const a = UI.observatory.alerts.find((x) => x.id === Number(go.dataset.alertGo));
      if (a)
        focusHistoryTarget(
          a.subject && W.components.position[a.subject] ? a.subject : 0,
          a.location,
        );
    } else if (dismiss) {
      UI.observatory.alerts = UI.observatory.alerts.filter(
        (x) => x.id !== Number(dismiss.dataset.alertDismiss),
      );
      refreshAlerts();
    } else if (mute) {
      UI.observatory.muted = !UI.observatory.muted;
      if (UI.observatory.muted) UI.observatory.alerts = [];
      UI.observatory.alertKey = "";
      refreshAlerts();
    } else if (clear) {
      UI.observatory.alerts = [];
      refreshAlerts();
    } else return;
    e.stopPropagation();
  });
}
const refreshUIObservatoryBase = refreshUI;
refreshUI = function (force = false) {
  refreshUIObservatoryBase(force);
  if (!W) return;
  wireObservatory();
  if (force || W.tick % 8 === 0) refreshPeopleBar(force);
  if (force || W.tick % 4 === 0) refreshAlerts();
};
const refreshInspectorObservatoryBase = refreshInspector;
refreshInspector = function () {
  refreshInspectorObservatoryBase();
  if (W) refreshPeopleBar(true);
};
window.ALIFE_OBSERVATORY_DEBUG = Object.freeze({
  people: () => peopleBarCandidates(),
  renderPeopleBar: () => renderPeopleBar(peopleBarCandidates()),
  alerts: () => {
    collectAlerts();
    return UI.observatory.alerts.slice();
  },
  ring: () => UI.observatory.ring.length,
  overlay: (name, i) => overlayStyle(name, i),
  legend: (name) => OVERLAY_LEGENDS[name] || "",
});
