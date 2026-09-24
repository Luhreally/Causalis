// ═══════════════════════════════════════════════════════════════════════════
// 142. THE WAR SEEN — a warfare lens, formations and objectives on the map, a
// Warfare tab that reads the war
// ═══════════════════════════════════════════════════════════════════════════
// The war was there and could not be watched. A unit was a pennant with a
// count at zoom 1.6 and above (32i, drawMilitaryBanners); its phase, its
// objective and the ground it held were in its record and nowhere on the
// map; the war front was a dashed line from each polity's anchor to the last
// event; and the Warfare tab was the attack plan's gates, true and real, but
// no view of the columns once they marched. Asked for: a warfare lens, the
// tab brought up to date, formations and their motion, and strategy.
//
// The lens veils the ground and tints each holding lightly so the borders
// and fronts of section 140 read under it, paints the danger field as a red
// heat that breathes, and draws over everything the war's own things: each
// unit's formation as an outline round its fighters in the colour of its
// phase (amber mustering, ochre marching, red engaged, magenta flanking,
// blue screening and withdrawing, green guarding), its objective as a
// running arrow from the column to the town it marches on, its supply as a
// faint thread home, its phase word under its pennant, and a pulsing ring
// round a town under assault. Outside the lens the same marks are drawn for
// units at war when the zoom is close enough to read them. The tab lists
// every war as a card: the two sides with their strength, the aim and the
// years, the plan and its gates, each column with its phase, tactic,
// fighters, morale and supply, and a Watch that puts the camera on it and
// the lens on the map; then the tensions and the wars that ended, with how.
// The view reads the world and writes only the camera and the lens.
const WARVIEW = {
  banners: 0,
  outlines: 0,
  arrows: 0,
  rings: 0,
  heat: 0,
  labels: 0,
  cards: 0,
  sites: { at: 0, world: null, list: [] },
};
const WAR_LENS = "warfare",
  WAR_PHASE_HUE = Object.freeze({
    mustering: 46,
    forming: 46,
    levy: 46,
    marching: 34,
    rallying: 74,
    intercepting: 186,
    rerouting: 28,
    engaged: 4,
    skirmishing: 8,
    assaulting: 2,
    besieging: 14,
    raiding: 22,
    volleying: 18,
    flanking: 318,
    screening: 205,
    withdrawing: 212,
    recovering: 190,
    returning: 160,
    guarding: 150,
    "at ease": 140,
    inactive: 0,
  }),
  WAR_VEIL_LAND = "rgba(8,14,20,0.44)",
  WAR_VEIL_SEA = "rgba(8,14,20,0.2)",
  WAR_HOLDING_ALPHA = 0.22,
  WAR_MARK_ZOOM = 1.2,
  // The formation is the fighters who stand together: the largest knot within
  // this many tiles of one of them. On the year-58 war a column's members were
  // split between the assault and home, and an outline round all of them spanned
  // half the map (25 tiles at zoom 1.7); the knot is the formation, the rest are
  // stragglers, and no formation is drawn wider than WAR_FORMATION_MAX tiles.
  WAR_CORE_RADIUS = 5,
  WAR_FORMATION_MAX = 6.5;
function warPhaseColour(phase, alpha = 1) {
  const hue = WAR_PHASE_HUE[phase] ?? 40;
  return phase === "inactive" ? hsl(0, 0, 60, alpha) : hsl(hue, 78, 58, alpha);
}
function warOf(factionId) {
  return W.activeWars?.find((w) => !w.ended && (w.a === factionId || w.b === factionId)) || null;
}
function warUnitGeometryVisible(unit, bounds) {
  const pts = [];
  for (const id of unit.memberIds) {
    if (!peekAlive(id)) continue;
    const p = W.components.position[id];
    if (!p) continue;
    if (
      bounds &&
      (p.x < bounds.x0 - 3 || p.x > bounds.x1 + 3 || p.y < bounds.y0 - 3 || p.y > bounds.y1 + 3)
    )
      continue;
    pts.push(p);
  }
  if (!pts.length) return null;
  // The knot: the member with most others within WAR_CORE_RADIUS seeds it (ties
  // to the first in the roster), and the members within that radius of the seed
  // are the formation; the rest are stragglers, on the road or still at home.
  let seed = pts[0],
    best = -1;
  for (const p of pts) {
    let near = 0;
    for (const q of pts) if (Math.hypot(q.x - p.x, q.y - p.y) <= WAR_CORE_RADIUS) near++;
    if (near > best) {
      best = near;
      seed = p;
    }
  }
  const core = pts.filter((p) => Math.hypot(p.x - seed.x, p.y - seed.y) <= WAR_CORE_RADIUS),
    stragglers = pts.filter((p) => !core.includes(p));
  let cx = 0,
    cy = 0,
    spread = 0;
  for (const p of core) {
    cx += p.x;
    cy += p.y;
  }
  cx /= core.length;
  cy /= core.length;
  for (const p of core) spread = Math.max(spread, Math.hypot(p.x - cx, p.y - cy));
  return {
    x: cx + 0.5,
    y: cy + 0.5,
    n: pts.length,
    coreN: core.length,
    spread,
    pts,
    core,
    stragglers,
  };
}
// A tactic's short word for the map; the tab keeps the full name.
function warTacticShort(tactic) {
  const t = String(tactic || "").toLowerCase();
  if (t.includes("withdraw")) return "falling back";
  if (t.includes("interdict")) return "raid on stores";
  if (t.includes("suppress")) return "volley";
  if (t.includes("flank")) return "flank";
  if (t.includes("assault")) return "assault";
  if (t.includes("skirmish")) return "skirmish";
  return "";
}
// The phase words, one per place: the same word at the same place is one word
// with a count (three columns assaulting one gate printed three labels over each
// other on the year-58 war), and a different word stacks below.
function drawWarLabels(labels) {
  if (!labels.length) return 0;
  const px = Math.round(clamp(9 + UI.camera.zoom * 0.4, 9, 13)),
    step = px + 4,
    placed = [];
  labels.sort((a, b) => a.y - b.y || a.x - b.x);
  for (const label of labels) {
    const same = placed.find(
      (q) => q.word === label.word && Math.abs(q.x - label.x) < 60 && Math.abs(q.y0 - label.y) < 40,
    );
    if (same) {
      same.count++;
      continue;
    }
    let y = label.y;
    for (let pass = 0; pass < 6; pass++) {
      const hit = placed.find((q) => Math.abs(q.x - label.x) < 90 && Math.abs(q.y - y) < step);
      if (!hit) break;
      y = hit.y + step;
    }
    placed.push({ ...label, y0: label.y, y, count: 1 });
  }
  ctx.save();
  ctx.font = `600 ${px}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(4,8,12,0.8)";
  for (const q of placed) {
    const text = q.count > 1 ? `${q.count} columns ${q.word}` : q.word;
    ctx.strokeText(text, q.x, q.y);
    ctx.fillStyle = q.colour;
    ctx.fillText(text, q.x, q.y);
  }
  ctx.restore();
  WARVIEW.labels += placed.length;
  return placed.length;
}
// ── The lens ─────────────────────────────────────────────────────────────────
const lensCategoryAtWarBase = lensCategoryAt;
lensCategoryAt = function (name, i) {
  if (name === WAR_LENS) return W.tiles.owner?.[i] || 0;
  return lensCategoryAtWarBase(name, i);
};
const lensCategoryColourWarBase = lensCategoryColour;
lensCategoryColour = function (name, key) {
  return lensCategoryColourWarBase(name === WAR_LENS ? "territory" : name, key);
};
const lensCategoryNameWarBase = lensCategoryName;
lensCategoryName = function (name, key) {
  return lensCategoryNameWarBase(name === WAR_LENS ? "territory" : name, key);
};
const overlayStyleWarBase = overlayStyle;
overlayStyle = function (name, i) {
  if (name !== WAR_LENS) return overlayStyleWarBase(name, i);
  const owner = W.tiles.owner?.[i] || 0;
  if (!owner) return lensSea(i) ? WAR_VEIL_SEA : WAR_VEIL_LAND;
  return lensColourWithAlpha(
    lensCategoryColour("territory", owner),
    WAR_HOLDING_ALPHA * (lensSea(i) ? 0.4 : 1),
  );
};
const overlayLegendColorWarBase = overlayLegendColor;
overlayLegendColor = function (id) {
  return id === WAR_LENS ? "#e0645c" : overlayLegendColorWarBase(id);
};
const buildControlsWarBase = buildControls;
buildControls = function () {
  buildControlsWarBase();
  if (!DOM.overlayGrid || DOM.overlayGrid.innerHTML.includes(`data-overlay="${WAR_LENS}"`)) return;
  DOM.overlayGrid.innerHTML += `<div class="overlay-group">War</div><button class="overlay-btn" data-overlay="${WAR_LENS}"><span class="dot" style="color:${overlayLegendColor(WAR_LENS)}"></span> Warfare</button>`;
};
const setOverlayWarBase = setOverlay;
setOverlay = function (name) {
  setOverlayWarBase(name);
  if (UI.overlay === WAR_LENS && DOM.mapOverlay) DOM.mapOverlay.innerHTML = warLensLegendHTML();
};
function warLensLegendHTML() {
  const wars = (W.activeWars || []).filter((w) => !w.ended);
  if (!wars.length)
    return "Warfare · no war is being fought; the danger field and every column still show";
  return (
    "Warfare · " +
    wars
      .slice(0, 4)
      .map((w) => {
        const a = factionById(w.a),
          b = factionById(w.b);
        return `<span class="lens-swatch" style="--c:${esc(a?.color || "#888")}"></span>${esc(a?.name || "?")} <span class="muted">vs</span> <span class="lens-swatch" style="--c:${esc(b?.color || "#888")}"></span>${esc(b?.name || "?")}`;
      })
      .join(" · ")
  );
}
// The danger field breathes under the lens: a red heat over every tile with danger in it.
function drawWarHeat(now, m, b) {
  const pulse = 0.75 + 0.25 * Math.sin(now * 0.003);
  let drawn = 0;
  for (let y = b.y0; y <= b.y1; y++)
    for (let x = b.x0; x <= b.x1; x++) {
      const i = idx(x, y),
        d = W.tiles.danger[i];
      if (d < 20) continue;
      const t = clamp((d - 20) / 300, 0, 1),
        a = (0.05 + 0.3 * t) * pulse;
      ctx.fillStyle = hsl(26 - 22 * t, 88, 54, a);
      polygonPath(proceduralTilePolygon(x, y, m));
      ctx.fill();
      drawn++;
    }
  WARVIEW.heat += drawn;
  return drawn;
}
// ── Formations, objectives and sieges on the map ─────────────────────────────
function drawWarArrow(from, to, colour, now, m) {
  const dx = to.x - from.x,
    dy = to.y - from.y,
    len = Math.hypot(dx, dy);
  if (len < 6) return;
  const nx = -dy / len,
    ny = dx / len,
    bow = Math.min(len * 0.18, m.tw * 3),
    cx = (from.x + to.x) / 2 + nx * bow,
    cy = (from.y + to.y) / 2 + ny * bow,
    w = clamp(1.2 + m.tw * 0.05, 1.4, 3.4);
  ctx.save();
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(6,12,18,0.7)";
  ctx.lineWidth = w + 1.8;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.quadraticCurveTo(cx, cy, to.x, to.y);
  ctx.stroke();
  ctx.strokeStyle = colour;
  ctx.lineWidth = w;
  ctx.setLineDash([m.tw * 0.9, m.tw * 0.6]);
  ctx.lineDashOffset = -((now / 18) % (m.tw * 1.5));
  ctx.stroke();
  ctx.setLineDash([]);
  // the head
  const tx = to.x - cx,
    ty = to.y - cy,
    tl = Math.hypot(tx, ty) || 1,
    ux = tx / tl,
    uy = ty / tl,
    h = clamp(m.tw * 0.5, 5, 14);
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - ux * h - uy * h * 0.55, to.y - uy * h + ux * h * 0.55);
  ctx.lineTo(to.x - ux * h + uy * h * 0.55, to.y - uy * h - ux * h * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  WARVIEW.arrows++;
}
function drawWarUnitMarks(now, bounds, m, lens) {
  if (!W.militaryUnits?.length) return 0;
  let drawn = 0;
  const labels = [];
  for (const unit of W.militaryUnits) {
    // A watch at ease (42c) is its fighters at their own work: no formation to draw.
    if (!unit.active || unit.phase === "at ease") continue;
    const war = warOf(unit.factionId);
    if (!lens && (!war || UI.camera.zoom < WAR_MARK_ZOOM)) continue;
    const g = warUnitGeometryVisible(unit, bounds);
    if (!g || g.n < 2) continue;
    const f = factionById(unit.factionId),
      colour = f?.color || "#d8c184",
      s = proceduralProjectTile(g.x, g.y, m),
      phase = unit.phase || "mustering",
      phaseColour = warPhaseColour(phase);
    // The formation: an outline round the fighters, in the phase's colour.
    const rx =
        g.coreN < 2
          ? m.tw * 0.9
          : clamp((g.spread + 0.8) * m.tw, m.tw * 0.9, m.tw * WAR_FORMATION_MAX),
      ry = rx * (UI.view === "top" ? 1 : m.th / m.tw),
      forming = phase === "mustering" || phase === "forming" || phase === "levy";
    ctx.save();
    ctx.lineWidth = clamp(1 + m.tw * 0.05, 1.2, 3);
    ctx.strokeStyle = warPhaseColour(phase, 0.85);
    ctx.fillStyle = warPhaseColour(phase, 0.1);
    if (forming) ctx.setLineDash([m.tw * 0.5, m.tw * 0.4]);
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    // The stragglers: a hollow dot each, in the phase's colour.
    for (const p of g.stragglers) {
      const q = proceduralProjectTile(p.x + 0.5, p.y + 0.5, m);
      ctx.beginPath();
      ctx.arc(q.x, q.y, clamp(m.tw * 0.18, 2.5, 5), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    WARVIEW.outlines++;
    // The objective: a running arrow to the town the column marches on; the supply, a thread home.
    const objective = unit.objectiveSettlementId
        ? W.settlements.find((q) => q.id === unit.objectiveSettlementId && !q.ruined)
        : null,
      home = W.settlements.find((q) => q.id === unit.homeSettlementId && !q.ruined);
    if (objective && war && objective.id !== unit.homeSettlementId) {
      drawWarArrow(
        s,
        proceduralProjectTile(objective.x + 0.5, objective.y + 0.5, m),
        colour,
        now,
        m,
      );
      if (lens && home) {
        const hs = proceduralProjectTile(home.x + 0.5, home.y + 0.5, m);
        ctx.save();
        ctx.strokeStyle = lensColourWithAlpha(colour, 0.35);
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 6]);
        ctx.beginPath();
        ctx.moveTo(hs.x, hs.y);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
        ctx.restore();
      }
    }
    // The phase word under the pennant (the tactic's short word beside it when close).
    if (lens || UI.camera.zoom >= 1.6) {
      const short = UI.camera.zoom >= 2.2 ? warTacticShort(unit.tactic) : "",
        word = short && !phase.startsWith(short.slice(0, 4)) ? `${phase} · ${short}` : phase;
      labels.push({ x: s.x, y: s.y + ry + 2, word, colour: phaseColour });
    }
    // A town under assault is ringed, and the ring breathes.
    const contact = unit.contactPlaceId
      ? W.settlements.find((q) => q.id === unit.contactPlaceId && !q.ruined)
      : null;
    if (contact && ["assaulting", "besieging", "raiding", "engaged"].includes(phase)) {
      const cs = proceduralProjectTile(contact.x + 0.5, contact.y + 0.5, m),
        r = m.tw * (2.2 + 0.25 * Math.sin(now * 0.004 + unit.id));
      ctx.save();
      ctx.strokeStyle = warPhaseColour(phase, 0.9);
      ctx.lineWidth = clamp(1.4 + m.tw * 0.06, 1.6, 4);
      ctx.setLineDash([m.tw * 0.7, m.tw * 0.5]);
      ctx.lineDashOffset = -((now / 30) % (m.tw * 1.2));
      ctx.beginPath();
      ctx.ellipse(cs.x, cs.y, r, r * (UI.view === "top" ? 1 : m.th / m.tw), 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      WARVIEW.rings++;
    }
    drawn++;
  }
  drawWarLabels(labels);
  WARVIEW.banners += drawn;
  return drawn;
}
const drawMilitaryBannersWarBase = drawMilitaryBanners;
drawMilitaryBanners = function (now, bounds) {
  const m = ACTIVE_RENDER_METRICS || projectionMetrics();
  // The marks go under the pennants, so the pennant reads over its own formation.
  drawWarUnitMarks(now, bounds, m, UI.overlay === WAR_LENS);
  drawMilitaryBannersWarBase(now, bounds);
};
const drawLensMotionWarBase = drawLensMotion;
drawLensMotion = function (now, m) {
  const drawn = drawLensMotionWarBase(now, m);
  if (UI.overlay !== WAR_LENS || !W) return drawn;
  return drawn + drawWarHeat(now, m, visibleBounds());
};
// ── The Warfare tab ──────────────────────────────────────────────────────────
function warBar(value, colour, label) {
  const pct = Math.round(clamp(value, 0, 1) * 100);
  return `<div class="war-bar" title="${esc(label)}"><span style="width:${pct}%;background:${esc(colour)}"></span></div>`;
}
function warUnitRow(unit, war) {
  const f = factionById(unit.factionId),
    alive = unit.memberIds.filter((id) => peekAlive(id)).length,
    home = W.settlements.find((q) => q.id === unit.homeSettlementId),
    objective = unit.objectiveSettlementId
      ? W.settlements.find((q) => q.id === unit.objectiveSettlementId)
      : null,
    phase = unit.phase || "mustering";
  return `<div class="war-unit"><span class="lens-swatch" style="--c:${esc(f?.color || "#888")}"></span><b style="color:${warPhaseColour(phase)}">${esc(phase)}</b>${unit.tactic ? ` <span class="muted">· ${esc(unit.tactic)}</span>` : ""}${unit.rally?.holding ? ` <span class="muted">· waiting for ${unit.rally.waitingFor.length} column${unit.rally.waitingFor.length === 1 ? "" : "s"}</span>` : ""}${unit.intercept && objective ? ` <span class="muted">· to the ${esc(objective.name)} road</span>` : ""} <span class="muted">· ${alive} fighter${alive === 1 ? "" : "s"}${home ? ` of ${esc(home.name)}` : ""}${objective && objective.id !== unit.homeSettlementId ? ` → ${esc(objective.name)}` : ""}</span><div class="row" style="gap:6px;margin-top:3px">${warBar(unit.morale ?? 0.5, "#9cd38c", "morale")}${warBar(unit.supply ?? 1, "#7fb0ff", "supply")}<button class="small" data-watch-unit="${unit.id}">Watch</button></div></div>`;
}
function warCard(war) {
  const a = factionById(war.a),
    b = factionById(war.b),
    plan = war.attackPlan,
    attacker = plan ? factionById(plan.attackerId) : null,
    target = plan ? W.settlements.find((q) => q.id === plan.targetSettlementId) : null,
    units = (W.militaryUnits || []).filter(
      (u) => u.active && (u.factionId === war.a || u.factionId === war.b),
    ),
    years = Math.max(0, Math.floor((W.tick - war.started) / TICKS_PER_YEAR)),
    goal = typeof ensureWarAim === "function" ? war.goal || warAim(war) : war.goal || "",
    sa = a?.militaryStrength || 0,
    sb = b?.militaryStrength || 0,
    total = sa + sb || 1;
  let status = "";
  if (plan) {
    if (plan.launchedTick)
      status = `Launched ${Math.max(0, Math.floor((W.tick - plan.launchedTick) / TICKS_PER_YEAR))} years ago`;
    else if (typeof campaignReadiness === "function") {
      const r = campaignReadiness(war, plan),
        gates = (r.blockers || []).map((x) => x.label).slice(0, 3);
      status = gates.length
        ? `Preparing · waiting on ${gates.map(esc).join(", ")}`
        : "Preparing · the order is being issued";
    }
  }
  WARVIEW.cards++;
  return `<article class="card campaign-card war-card"><div class="row between"><div><div class="eyebrow">War #${war.id} · ${esc(goal)} · ${years} year${years === 1 ? "" : "s"}</div><h3 style="margin:4px 0"><span class="lens-swatch" style="--c:${esc(a?.color || "#888")}"></span>${esc(a?.name || "?")} <span class="muted">vs</span> <span class="lens-swatch" style="--c:${esc(b?.color || "#888")}"></span>${esc(b?.name || "?")}</h3></div><div class="muted" style="text-align:right">${war.casualties || 0} fallen<br>${war.wounded || 0} wounded</div></div><div class="war-strength"><span style="width:${Math.round((sa / total) * 100)}%;background:${esc(a?.color || "#888")}"></span><span style="width:${Math.round((sb / total) * 100)}%;background:${esc(b?.color || "#888")}"></span></div>${attacker ? `<div class="muted" style="margin-top:6px">${esc(attacker.name)} marches on ${target ? esc(target.name) : "no town"}${plan?.motive ? ` · ${esc(String(plan.motive))}` : ""}</div>` : ""}${status ? `<div class="campaign-timing">${status}</div>` : ""}${units.length ? `<div class="subhead">Columns · ${units.length}</div>${units.map((u) => warUnitRow(u, war)).join("")}` : `<div class="muted" style="margin-top:6px">No column is in the field.</div>`}</article>`;
}
function warTensionsHTML() {
  const tensions = W.factions
    .flatMap((faction) =>
      Object.entries(faction.relations || {})
        .filter(
          ([otherId, relation]) => faction.id < Number(otherId) && relation.status === "hostile",
        )
        .map(([otherId, relation]) => ({
          faction,
          other: factionById(Number(otherId)),
          pressure: relation.pressure || 0,
        })),
    )
    .filter((t) => t.other)
    .sort((l, r) => r.pressure - l.pressure)
    .slice(0, 5);
  if (!tensions.length) return "";
  return `<div class="subhead">Tensions</div>${tensions.map((t) => `<div class="war-unit"><span class="lens-swatch" style="--c:${esc(t.faction.color)}"></span>${esc(t.faction.name)} <span class="muted">and</span> <span class="lens-swatch" style="--c:${esc(t.other.color)}"></span>${esc(t.other.name)} <span class="muted">· pressure ${Math.round(t.pressure)}</span></div>`).join("")}`;
}
function warEndedHTML() {
  const ended = (W.activeWars || [])
    .filter((w) => w.ended)
    .slice(-6)
    .reverse();
  if (!ended.length) return "";
  return `<div class="subhead">Wars that ended</div>${ended
    .map((w) => {
      const a = factionById(w.a),
        b = factionById(w.b),
        years = Math.max(0, Math.round((w.ended - w.started) / TICKS_PER_YEAR)),
        outcome = typeof warOutcome === "function" ? warOutcome(w.reason || w.outcome || "") : "";
      return `<div class="war-unit"><span class="lens-swatch" style="--c:${esc(a?.color || "#888")}"></span>${esc(a?.name || "?")} <span class="muted">vs</span> <span class="lens-swatch" style="--c:${esc(b?.color || "#888")}"></span>${esc(b?.name || "?")} <span class="muted">· ${years} year${years === 1 ? "" : "s"} · ${w.casualties || 0} fallen${outcome ? ` · ${esc(outcome)}` : ""}</span></div>`;
    })
    .join("")}`;
}
function refreshWarfare() {
  if (!W || !DOM.warfarePane) return;
  const active = (W.activeWars || []).filter((w) => !w.ended),
    units = (W.militaryUnits || []).filter((u) => u.active),
    fielded = units.reduce((n, u) => n + u.memberIds.filter((id) => peekAlive(id)).length, 0);
  DOM.warfarePane.innerHTML = `<div class="row between"><div><div class="eyebrow">The war seen</div><h3 style="margin:5px 0">${active.length} war${active.length === 1 ? "" : "s"} · ${units.length} column${units.length === 1 ? "" : "s"} · ${fielded} in the field</h3></div><button class="small ${UI.overlay === WAR_LENS ? "primary" : ""}" data-war-lens="1">${UI.overlay === WAR_LENS ? "Lens on" : "War lens"}</button></div>${active.length ? active.map(warCard).join("") : `<p class="muted">No war is being fought. Columns guard their towns; the tensions below are where the next one may come from.</p>`}${warTensionsHTML()}${warEndedHTML()}`;
  if (!DOM.warfarePane.dataset.warView) {
    DOM.warfarePane.dataset.warView = "1";
    DOM.warfarePane.addEventListener("click", (e) => {
      const watch = e.target.closest?.("[data-watch-unit]"),
        lens = e.target.closest?.("[data-war-lens]");
      if (lens) {
        setOverlay(UI.overlay === WAR_LENS ? WAR_LENS : WAR_LENS);
        refreshWarfare();
      } else if (watch) {
        const unit = (W.militaryUnits || []).find((u) => u.id === Number(watch.dataset.watchUnit)),
          g = unit && warUnitGeometryVisible(unit, null);
        if (g) {
          if (UI.overlay !== WAR_LENS) setOverlay(WAR_LENS);
          UI.followId = 0;
          CAMERA_GLIDE.cx = g.x;
          CAMERA_GLIDE.cy = g.y;
          if (UI.camera.zoom < 2.2) {
            CAMERA_GLIDE.zoom = 2.6;
            CAMERA_GLIDE.px = null;
            CAMERA_GLIDE.py = null;
          }
          revealWorldOnPhone();
        }
      }
    });
  }
}
window.ALIFE_WARVIEW_DEBUG = Object.freeze({
  counts: () => ({ ...WARVIEW, sites: undefined }),
  units: () =>
    (W.militaryUnits || [])
      .filter((u) => u.active)
      .map((u) => ({
        id: u.id,
        phase: u.phase,
        tactic: u.tactic || "",
        n: u.memberIds.filter((id) => peekAlive(id)).length,
        objective: u.objectiveSettlementId,
        home: u.homeSettlementId,
      })),
  marks: (now = 1234) => drawWarUnitMarks(now, visibleBounds(), projectionMetrics(), true),
  geometry: (id) => {
    const unit = (W.militaryUnits || []).find((u) => u.id === id),
      g = unit && warUnitGeometryVisible(unit, null);
    return g
      ? {
          n: g.n,
          coreN: g.coreN,
          stragglers: g.stragglers.length,
          spread: +g.spread.toFixed(2),
          x: +g.x.toFixed(2),
          y: +g.y.toFixed(2),
        }
      : null;
  },
  heat: (now = 1234) => drawWarHeat(now, projectionMetrics(), visibleBounds()),
  legend: () => warLensLegendHTML(),
  html: () => {
    refreshWarfare();
    return DOM.warfarePane?.innerHTML || "";
  },
});
