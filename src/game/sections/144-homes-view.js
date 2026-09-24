// ═══════════════════════════════════════════════════════════════════════════
// 144. HOMES SEEN — a lens of tenure, the people with no bed, and a count
// ═══════════════════════════════════════════════════════════════════════════
// A town's homes had owners, tenants, rent owed and a landlord who could put a
// household out (121, 125), and none of it could be seen: the place page said
// "housed; seeking a bed" in a sentence, and the map drew every cottage and
// block alike. Asked for: a lens that colours the homes by owner, renter and
// arrears, marks the people sleeping rough, and a count of them in the people
// bar.
//
// The lens veils the ground and draws over every home a ring in the colour of
// its tenure: green where the household that lives there owns it, blue where
// a landlord who lives elsewhere lets it, violet where the town lets it, amber
// deepening to red where a household under its roof is behind on the rent by
// a year and more, a grey dashed ring where nobody lives; and under the ring a
// bar of the beds slept in, with the count when the home is close enough to
// read. Each person of a town with no bed there wears an amber ring that
// breathes, and each grown person with no town at all while towns stand a
// grey one. The legend counts the homes by tenure and the people without a
// bed, and the people bar opens with the same count, which switches to the
// lens when pressed. The place page adds the tenure of its homes. Rendering
// only reads the world; the count is kept beside it for a tick.
const HOMES_LENS = "housing",
  HOMES = { rings: 0, bars: 0, rough: 0, wanderers: 0, legend: 0, chip: 0, census: 0 },
  HOMES_TENURE = Object.freeze({
    owned: { hue: 148, sat: 62, light: 50, word: "owned by the household" },
    let: { hue: 208, sat: 72, light: 58, word: "let by a landlord" },
    municipal: { hue: 268, sat: 58, light: 64, word: "let by the town" },
    arrears: { hue: 30, sat: 92, light: 55, word: "behind on the rent" },
    empty: { hue: 0, sat: 0, light: 70, word: "empty" },
  }),
  HOMES_VEIL_LAND = "rgba(8,14,20,0.5)",
  HOMES_VEIL_SEA = "rgba(8,14,20,0.24)";
let HOMES_CENSUS = { world: null, tick: -1, value: null };
// The tenure of one home, read from its tenancy: who owns it, whether its
// owner lives in it, and the most years any household under it owes.
function homesTenure(b) {
  const t = b?.tenancy,
    residents = (t?.residents || []).filter(
      (id) => classifyAlive(id) && W.components.social[id]?.homeBuildingId === b.id,
    ),
    beds = habitationBeds(b);
  // Arrears are kept in coin; a year's rent is what the household was asked
  // last (121 keeps it on the tenancy), one coin where it was asked nothing yet.
  const rent = Math.max(1, t?.rent || 1);
  let owed = 0,
    behind = 0;
  if (t?.arrears)
    for (const [head, coin] of Object.entries(t.arrears)) {
      const asked = typeof habitationRentOf === "function" ? habitationRentOf(t, +head) : rent;
      if (
        !(coin >= asked) ||
        !residents.some((id) => W.components.social[id]?.householdId === +head)
      )
        continue;
      behind++;
      owed = Math.max(owed, Math.floor(coin / asked));
    }
  const kind = !residents.length
    ? "empty"
    : behind
      ? "arrears"
      : t?.ownerId && residents.includes(t.ownerId)
        ? "owned"
        : t?.ownerId
          ? "let"
          : "municipal";
  return { kind, residents: residents.length, beds, owed, behind, rent, ownerId: t?.ownerId || 0 };
}
// Housed, or a child under a parent's roof. Addresses are dealt once a year
// (121), so a child born since the last dealing has none yet and sleeps where
// its parents do; counting it as sleeping rough put every newborn of a town
// on the lens for up to a year.
function homesSheltered(id) {
  if (habitationHome(id)) return true;
  if (isAdultPerson(id)) return false;
  const soc = W.components.social[id];
  if (soc?.householdId && soc.householdId !== id && habitationHome(soc.householdId)) return true;
  return (W.components.identity[id]?.parents || []).some(
    (p) => classifyAlive(p) && habitationHome(p),
  );
}
// Every home and every person without a bed, counted once a tick.
function homesCensus() {
  if (!W) return null;
  if (HOMES_CENSUS.world === W && HOMES_CENSUS.tick === W.tick && HOMES_CENSUS.value)
    return HOMES_CENSUS.value;
  const tenure = { owned: 0, let: 0, municipal: 0, arrears: 0, empty: 0 },
    homes = [],
    rough = [],
    wanderers = [];
  let behind = 0,
    beds = 0,
    slept = 0;
  for (const b of W.buildings) {
    if (b.placeKind !== "settlement" || !(habitationBeds(b) > 0)) continue;
    const t = homesTenure(b);
    tenure[t.kind]++;
    behind += t.behind;
    beds += t.beds;
    slept += t.residents;
    homes.push({ b, t });
  }
  const towns = W.settlements.some((s) => !s.ruined && s.knownProcesses),
    byTown = new Map();
  for (const id of W.activeIds) {
    if (W.kind[id] !== KINDS.PERSON || !classifyAlive(id)) continue;
    const soc = W.components.social[id];
    if (soc?.homePlaceKind === "settlement") {
      if (!byTown.has(soc.homePlaceId)) byTown.set(soc.homePlaceId, []);
      byTown.get(soc.homePlaceId).push(id);
    } else if (towns && soc?.homePlaceKind !== "camp" && isAdultPerson(id)) wanderers.push(id);
  }
  // A town not yet dealt its addresses (121 deals them once a year) has none
  // to read, and a new town's people all read as without a bed while its
  // cottages stood empty: its people past the beds it has are the ones
  // without, and no more.
  const bedsOf = new Map();
  for (const { b, t } of homes) bedsOf.set(b.placeId, (bedsOf.get(b.placeId) || 0) + t.beds);
  for (const [townId, people] of byTown) {
    const town = W.settlements.find((s) => s.id === townId);
    if (town?.habitation) {
      for (const id of people) if (!homesSheltered(id)) rough.push(id);
    } else rough.push(...people.sort((a, b) => a - b).slice(bedsOf.get(townId) || 0));
  }
  const value = { tenure, homes, rough, wanderers, behind, beds, slept };
  HOMES_CENSUS = { world: W, tick: W.tick, value };
  HOMES.census++;
  return value;
}
function homesColour(kind, alpha = 1, owed = 0) {
  const c = HOMES_TENURE[kind] || HOMES_TENURE.empty;
  // A year behind is amber; four and more, the landlord's line (121), red.
  const hue = kind === "arrears" ? c.hue - clamp((owed - 1) / 3, 0, 1) * 28 : c.hue;
  return hsl(hue, c.sat, c.light, alpha);
}
// ── The lens ─────────────────────────────────────────────────────────────────
const overlayStyleHomesBase = overlayStyle;
overlayStyle = function (name, i) {
  if (name !== HOMES_LENS) return overlayStyleHomesBase(name, i);
  // The ground is veiled and the homes carry the colour. A first cut lifted
  // the ground a town had lived on out of the veil, and a town's footfall
  // covers most of a battery map by year sixteen, so nothing was veiled.
  return lensSea(i) ? HOMES_VEIL_SEA : HOMES_VEIL_LAND;
};
const overlayLegendColorHomesBase = overlayLegendColor;
overlayLegendColor = function (id) {
  return id === HOMES_LENS ? "#e6a44a" : overlayLegendColorHomesBase(id);
};
// In the Peoples group, after unrest.
const buildControlsHomesBase = buildControls;
buildControls = function () {
  buildControlsHomesBase();
  if (!DOM.overlayGrid || DOM.overlayGrid.innerHTML.includes(`data-overlay="${HOMES_LENS}"`))
    return;
  const button = `<button class="overlay-btn" data-overlay="${HOMES_LENS}"><span class="dot" style="color:${overlayLegendColor(HOMES_LENS)}"></span> Homes and tenure</button>`,
    html = DOM.overlayGrid.innerHTML,
    at = html.indexOf('data-overlay="unrest"'),
    end = at >= 0 ? html.indexOf("</button>", at) : -1;
  DOM.overlayGrid.innerHTML =
    end >= 0 ? html.slice(0, end + 9) + button + html.slice(end + 9) : html + button;
};
function homesLegendHTML() {
  const c = homesCensus();
  if (!c || !c.homes.length) return "Homes and tenure · no town has raised a home yet";
  const sw = (kind, n, word) =>
    n
      ? `<span class="lens-swatch" style="--c:${homesColour(kind, 1, kind === "arrears" ? 2 : 0)}"></span>${n} ${word}`
      : "";
  const parts = [
    sw("owned", c.tenure.owned, "owned"),
    sw("let", c.tenure.let, "let"),
    sw("municipal", c.tenure.municipal, "the town's"),
    sw("arrears", c.tenure.arrears, "behind on rent"),
    sw("empty", c.tenure.empty, "empty"),
  ].filter(Boolean);
  const people = `${c.slept} of ${c.beds} beds slept in · ${c.rough.length} without a bed${c.wanderers.length ? ` · ${c.wanderers.length} with no town` : ""}`;
  return `Homes and tenure · ${parts.join(" ")} · ${people}`;
}
const setOverlayHomesBase = setOverlay;
setOverlay = function (name) {
  setOverlayHomesBase(name);
  if (UI.overlay === HOMES_LENS && DOM.mapOverlay) {
    DOM.mapOverlay.innerHTML = homesLegendHTML();
    HOMES.legend++;
  }
};
// ── The marks ────────────────────────────────────────────────────────────────
function drawHomesMarks(now, m, bounds) {
  const c = homesCensus();
  if (!c) return 0;
  const flat = UI.view === "top" ? 1 : m.th / m.tw,
    line = clamp(1 + m.tw * 0.05, 1.2, 3);
  let drawn = 0;
  ctx.save();
  for (const { b, t } of c.homes) {
    if (
      !b.complete ||
      b.ruined ||
      b.x < bounds.x0 - 1 ||
      b.x > bounds.x1 + 1 ||
      b.y < bounds.y0 - 1 ||
      b.y > bounds.y1 + 1
    )
      continue;
    const s = proceduralProjectTile(b.x + 0.5, b.y + 0.5, m),
      r = buildingScreenSize(b, m),
      rx = r * (b.type === "shelter" ? 0.95 : 1.1),
      ry = rx * flat,
      y = s.y + r * 0.2;
    // A dark line under the coloured one, so a ring reads on any ground.
    ctx.beginPath();
    ctx.ellipse(s.x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.setLineDash([]);
    ctx.lineWidth = line + 2;
    ctx.strokeStyle = "rgba(8,12,16,0.7)";
    ctx.stroke();
    ctx.lineWidth = line;
    ctx.setLineDash(t.kind === "empty" ? [line * 2.5, line * 2] : []);
    ctx.fillStyle =
      t.kind === "empty" ? "rgba(200,206,214,0.08)" : homesColour(t.kind, 0.3, t.owed);
    ctx.strokeStyle =
      t.kind === "empty" ? "rgba(214,220,228,0.95)" : homesColour(t.kind, 0.95, t.owed);
    ctx.fill();
    ctx.stroke();
    HOMES.rings++;
    // The beds slept in: a bar under the ring, full in the tenure's colour.
    const w = rx * 1.4,
      h = clamp(r * 0.12, 2, 5),
      bx = s.x - w / 2,
      by = y + ry + h * 0.8,
      share = t.beds ? clamp(t.residents / t.beds, 0, 1) : 0;
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(10,14,18,0.72)";
    ctx.fillRect(bx, by, w, h);
    ctx.fillStyle = share >= 1 ? homesColour(t.kind, 0.95, t.owed) : "rgba(236,230,214,0.9)";
    ctx.fillRect(bx, by, w * share, h);
    HOMES.bars++;
    if (r >= 16) {
      ctx.font = `${Math.round(clamp(r * 0.32, 9, 13))}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = "rgba(10,14,18,0.8)";
      const text = `${t.residents}/${t.beds}${t.behind ? ` · ${t.owed}y owed` : ""}`;
      ctx.fillText(text, s.x + 1, by + h + 2);
      ctx.fillStyle = "#f4ecd8";
      ctx.fillText(text, s.x, by + h + 1);
    }
    drawn++;
  }
  // The people with no bed: an amber ring that breathes round their feet,
  // over a dark disc so it reads among the crowd; with no town at all, grey.
  const pulse = 0.7 + 0.3 * Math.sin(now * 0.004),
    rr = clamp(m.tw * 0.34, 4, 11);
  ctx.setLineDash([]);
  const mark = (id, hue, sat) => {
    const p = W.components.position[id];
    if (!p || p.x < bounds.x0 || p.x > bounds.x1 || p.y < bounds.y0 || p.y > bounds.y1)
      return false;
    const a = followAnchorWorld(id),
      q = proceduralProjectTile(a.x, a.y, m),
      r = rr * (0.92 + 0.08 * pulse);
    ctx.beginPath();
    ctx.ellipse(q.x, q.y + rr * 0.25, r, r * flat, 0, 0, Math.PI * 2);
    ctx.fillStyle = hsl(hue, sat, 20, 0.35);
    ctx.fill();
    ctx.lineWidth = line + 2;
    ctx.strokeStyle = "rgba(8,12,16,0.75)";
    ctx.stroke();
    ctx.lineWidth = line + 0.5;
    ctx.strokeStyle = hsl(hue, sat, 60, pulse);
    ctx.stroke();
    return true;
  };
  for (const id of c.rough) if (mark(id, 34, 95)) HOMES.rough++;
  for (const id of c.wanderers) if (mark(id, 210, 8)) HOMES.wanderers++;
  ctx.restore();
  return drawn;
}
const drawLensMotionHomesBase = drawLensMotion;
drawLensMotion = function (now, m) {
  const drawn = drawLensMotionHomesBase(now, m);
  if (UI.overlay !== HOMES_LENS || !W) return drawn;
  // The legend's counts move with the town; read them again about once a second.
  if (DOM.mapOverlay && now - (HOMES.legendAt || 0) > 1000) {
    HOMES.legendAt = now;
    DOM.mapOverlay.innerHTML = homesLegendHTML();
    HOMES.legend++;
  }
  return drawn + drawHomesMarks(now, m, visibleBounds());
};
// ── The count in the people bar ──────────────────────────────────────────────
function homesChipHTML() {
  const c = homesCensus();
  if (!c || !c.homes.length) return "";
  const rough = c.rough.length,
    words = [`${rough} without a bed`];
  if (c.behind) words.push(`${c.behind} behind on rent`);
  // Shaped like a person's card, so it sits in the bar as one of them: the
  // portrait's place holds the roof, the name's the count.
  const icon = `<span class="people-portrait" style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;font-size:22px;line-height:1">${rough ? "🏚" : "🏠"}</span>`;
  return `<button class="people-entry homes-chip${UI.overlay === HOMES_LENS ? " active" : ""}" data-homes-chip title="Homes and tenure: ${esc(words.join(" · "))}. Press for the lens." style="--fac:${rough ? "#e6a44a" : "#6f8f7a"}">${icon}<span class="people-name">${rough} no bed</span><span class="people-mood">${c.behind ? `⚠ ${c.behind}` : ""}</span></button>`;
}
const renderPeopleBarHomesBase = renderPeopleBar;
renderPeopleBar = function (entries) {
  const html = renderPeopleBarHomesBase(entries),
    chip = UI.observatory?.barCollapsed ? "" : homesChipHTML();
  if (!chip) return html;
  HOMES.chip++;
  return html.replace('<div class="people-scroll">', `<div class="people-scroll">${chip}`);
};
let HOMES_WIRED = false;
const refreshPeopleBarHomesBase = refreshPeopleBar;
refreshPeopleBar = function (force = false) {
  const c = W ? homesCensus() : null,
    key = c
      ? `${c.rough.length}:${c.behind}:${c.homes.length ? 1 : 0}:${UI.overlay === HOMES_LENS ? 1 : 0}`
      : "";
  if (key !== UI.observatory?.homesKey) {
    if (UI.observatory) UI.observatory.homesKey = key;
    force = true;
  }
  refreshPeopleBarHomesBase(force);
  const stage = DOM.stage || (typeof $ === "function" ? $("#stage") : null);
  if (HOMES_WIRED || !stage?.addEventListener) return;
  HOMES_WIRED = true;
  stage.addEventListener("click", (e) => {
    if (!e.target.closest?.("[data-homes-chip]")) return;
    setOverlay(HOMES_LENS);
    refreshPeopleBar(true);
    e.stopPropagation();
  });
};
// ── The place page ───────────────────────────────────────────────────────────
const renderPlacePageHomesBase = renderPlacePage;
renderPlacePage = function (id) {
  const html = renderPlacePageHomesBase(id),
    town = W.settlements.find((s) => s.id === id);
  if (!town?.habitation) return html;
  const c = { owned: 0, let: 0, municipal: 0, arrears: 0, empty: 0 };
  let behind = 0;
  for (const b of W.buildings) {
    if (b.placeKind !== "settlement" || b.placeId !== id || !(habitationBeds(b) > 0)) continue;
    const t = homesTenure(b);
    c[t.kind]++;
    behind += t.behind;
  }
  const words = [
    c.owned && `${c.owned} owned by the household`,
    c.let && `${c.let} let by a landlord`,
    c.municipal && `${c.municipal} let by the town`,
    c.arrears &&
      `${c.arrears} with ${behind} household${behind === 1 ? "" : "s"} behind on the rent`,
    c.empty && `${c.empty} empty`,
  ].filter(Boolean);
  if (!words.length) return html;
  const row = `<div class="kv"><span>Tenure</span><b>${esc(words.join(" · "))}</b></div>`,
    at = html.indexOf('<div class="subhead">Homes and households</div>');
  return at < 0 ? html + row : html.slice(0, at) + row + html.slice(at);
};
window.ALIFE_HOMES_DEBUG = Object.freeze({
  counts: () => ({ ...HOMES }),
  census: () => {
    const c = homesCensus();
    return c
      ? {
          tenure: { ...c.tenure },
          homes: c.homes.length,
          rough: c.rough.length,
          wanderers: c.wanderers.length,
          behind: c.behind,
          beds: c.beds,
          slept: c.slept,
        }
      : null;
  },
  tenure: (buildingId) => {
    const b = W.buildings.find((x) => x.id === buildingId);
    return b ? homesTenure(b) : null;
  },
  colour: (kind, alpha = 1, owed = 0) => homesColour(kind, alpha, owed),
  legend: () => homesLegendHTML(),
  chip: () => homesChipHTML(),
  marks: (now = 0) => drawHomesMarks(now, projectionMetrics(), visibleBounds()),
  towns: () =>
    W.settlements
      .filter((s) => !s.ruined && s.knownProcesses)
      .map((s) => ({
        id: s.id,
        name: s.name,
        x: s.x,
        y: s.y,
        people: settlementPopulation(s),
        dealt: !!s.habitation,
      }))
      .sort((a, b) => b.people - a.people || a.id - b.id),
  year: () => Math.floor(W.tick / TICKS_PER_YEAR),
});
