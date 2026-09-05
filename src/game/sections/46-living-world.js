// ═══════════════════════════════════════════════════════════════════════════
// 46. LIVING WORLD: SEASONS, WORN PATHS, SUCCESSION, DISASTERS, OMENS
// ═══════════════════════════════════════════════════════════════════════════
// Five systems the design promised but the code had not yet delivered, each
// deterministic and recorded in the chronicle: the year turns with the axial
// tilt in the terrain genome; foot traffic wears paths that speed travel; a
// polity chooses a new Voice when its leader dies, and the new Voice pulls the
// polity toward their temperament; the ground itself acts through eruptions,
// earthquakes, and falling stars scaled by the disaster setting and the
// landforms; and cultures read the player's interventions as omens, which
// spiritual peoples answer with shrines. Nothing here creates or destroys
// matter: eruptions and impacts move mass between species on a tile.
const SEASON_STEP = 16,
  SEASON_NAMES = Object.freeze(["Thaw", "High sun", "Fall", "Deep cold"]),
  TRAFFIC_VISIBLE = 260,
  TRAFFIC_ROAD = 900;
function ensureLivingWorldColumns(world = W) {
  if (!world) return;
  const n = world.tileCount,
    t = world.tiles;
  if (!t.traffic || t.traffic.length !== n) t.traffic = new Uint16Array(n);
  if (!t.seasonOffset || t.seasonOffset.length !== n) t.seasonOffset = new Int16Array(n);
  world.living = world.living || { lastOmenEventId: 0, disasters: 0, successions: 0 };
}
const restoreWorldLivingBase = restoreWorldDefaults;
restoreWorldDefaults = function () {
  restoreWorldLivingBase();
  ensureLivingWorldColumns(W);
};
// ── Seasons ────────────────────────────────────────────────────────────────────
function seasonGenome() {
  return W?.terrainGenome?.landform?.season || null;
}
function seasonPhase(tick = W.tick) {
  const s = seasonGenome();
  return s ? (((tick / TICKS_PER_YEAR + s.phase) % 1) + 1) % 1 : 0;
}
// Hemisphere factor: +1 where the year's first half is the warm half, -1 where
// it is the cold half, weaker near the equator; radial and banded climates
// swing as one.
function seasonHemisphere(x, y) {
  const g = W.terrainGenome;
  if (!g || g.climate === "radial" || g.climate === "banded") return 1;
  const nx = (x / (W.width - 1) - 0.5) * 2,
    ny = (y / (W.height - 1) - 0.5) * 2,
    c = Math.cos(g.climateAngle || 0),
    s = Math.sin(g.climateAngle || 0),
    axis = g.climate === "latitudinal" || g.climate === "inverted" ? ny : nx * s + ny * c;
  return (axis >= 0 ? 1 : -1) * (0.35 + 0.65 * Math.min(1, Math.abs(axis) * 1.4));
}
function seasonName(tick = W.tick, hemisphere = 1) {
  const s = seasonGenome();
  if (!s || !s.amplitude) return "";
  let phase = seasonPhase(tick);
  if (hemisphere < 0) phase = (phase + 0.5) % 1;
  return SEASON_NAMES[Math.floor(((phase + 0.125) % 1) * 4)];
}
// The HUD names the season under the camera, so the south reads its own year.
function seasonLabel() {
  if (!W) return "";
  const name = seasonName(
    W.tick,
    seasonHemisphere(
      clamp(Math.round(UI.camera.x), 0, W.width - 1),
      clamp(Math.round(UI.camera.y), 0, W.height - 1),
    ),
  );
  return name ? ` · ${name}` : "";
}
function updateSeasons() {
  const s = seasonGenome();
  if (!s || !s.amplitude || W.tick % SEASON_STEP) return;
  const t = W.tiles,
    wave = Math.sin(seasonPhase(W.tick) * Math.PI * 2),
    w = W.width,
    h = W.height;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x,
        target = Math.round(s.amplitude * seasonHemisphere(x, y) * wave),
        delta = target - t.seasonOffset[i];
      if (!delta) continue;
      t.temperature[i] = i16(t.temperature[i] + delta);
      t.seasonOffset[i] = target;
    }
  // The two solstices enter the chronicle so a cold snap or a heat death has a cause to cite.
  const step = Math.floor(seasonPhase(W.tick) * 16),
    previous = Math.floor(seasonPhase(W.tick - SEASON_STEP) * 16);
  if (step !== previous && (step === 4 || step === 12))
    emitEvent("SeasonEvent", {
      evidence: ["the axial tilt carried the planet to a solstice"],
      magnitude: s.amplitude / 100,
      importance: 1,
      data: { season: step === 4 ? "High sun" : "Deep cold", amplitude: s.amplitude, global: true },
    });
}
// ── Worn paths ─────────────────────────────────────────────────────────────────
// Movement writes traffic in the effect resolver; here it fades so an abandoned
// route grows back over a few years.
function updateTraffic() {
  if (W.tick % 32) return;
  const t = W.tiles.traffic;
  if (!t) return;
  for (let i = 0; i < t.length; i++) {
    const v = t[i];
    if (v) t[i] = Math.max(0, v - (v >> 5) - 1);
  }
}
// ── Leadership succession ──────────────────────────────────────────────────────
function factionLeaderId(f) {
  for (const e of relationsOf(f.entityId, "leads"))
    if (e.type === "leads" && e.to === f.entityId && classifyAlive(e.from)) return e.from;
  return 0;
}
function chooseSuccessor(f, capital) {
  const members = entityAtRadius(idx(capital.x, capital.y), 10, KINDS.PERSON).filter(
    (id) => classifyAlive(id) && W.components.social[id]?.factionId === f.id,
  );
  if (!members.length) return null;
  const previous = f.leaderId ? W.components.identity[f.leaderId] : null,
    heirs =
      f.ethos.hierarchical > 0.6 && previous?.children?.length
        ? members.filter((id) => previous.children.includes(id))
        : [],
    pool = heirs.length ? heirs : members;
  pool.sort(
    (a, b) =>
      (W.components.social[b]?.dominance || 0) - (W.components.social[a]?.dominance || 0) || a - b,
  );
  return { leader: pool[0], hereditary: heirs.length > 0 };
}
function updateSuccession() {
  for (const f of W.factions) {
    if (f.stability <= 0 || !f.settlementIds?.length) continue;
    const living = factionLeaderId(f);
    if (living) {
      f.leaderId = living;
      continue;
    }
    const capital =
      W.settlements.find((s) => s.id === f.capitalSettlementId && !s.ruined) ||
      W.settlements.find((s) => f.settlementIds.includes(s.id) && !s.ruined);
    if (!capital) continue;
    const choice = chooseSuccessor(f, capital);
    if (!choice) continue;
    const { leader, hereditary } = choice,
      ordinal = (f.successions || 0) + 1,
      lastWord = f.leaderId ? W.causalIndex.entity[f.leaderId] : 0,
      ev = emitEvent("SuccessionEvent", {
        subjects: [leader, f.entityId],
        location: idx(capital.x, capital.y),
        factions: [f.id],
        causes: [lastWord, W.lastEventByType.LeadershipEvent].filter(Boolean),
        evidence: [
          hereditary
            ? "the line of the last Voice held the polity together"
            : "social dominance and community trust chose the new Voice",
          f.ethos.hierarchical > 0.6 ? "a hierarchical ethos" : "a communal ethos",
        ],
        importance: 3,
        data: { name: f.name, hereditary, ordinal },
      });
    addRelation(leader, f.entityId, "leads", 1, ev.id);
    W.components.identity[leader].titles.push(`Voice of ${f.name}`);
    W.components.identity[leader].significance += 4;
    f.leaderId = leader;
    f.successions = ordinal;
    // A new Voice pulls the polity toward their temperament.
    const ph = peekPhenotype(leader);
    if (ph) f.aggression = clamp(lerp(f.aggression, ph.aggression, 0.35), 0.1, 0.95);
    W.living.successions++;
  }
}
// ── Natural disasters ──────────────────────────────────────────────────────────
function disasterRoll(tag) {
  return counterRand(tag, Math.floor(W.tick / 128));
}
function hottestVentTile() {
  const g = W.tiles.geothermal;
  let best = -1,
    heat = 300;
  for (let i = 0; i < W.tileCount; i++)
    if (g[i] > heat) {
      heat = g[i];
      best = i;
    }
  return best;
}
function randomLandTile(tag) {
  const n = W.tileCount,
    start = Math.floor(disasterRoll(tag) * n);
  for (let k = 0; k < n; k++) {
    const i = (start + k * 97) % n;
    if (W.tiles.liquid[i] <= 140) return i;
  }
  return -1;
}
function damageBuildingsAround(cx, cy, radius, share, cause, eventId) {
  let damaged = 0;
  for (const b of W.buildings) {
    if (b.ruined || !b.complete) continue;
    const d = Math.hypot(b.x - cx, b.y - cy);
    if (d > radius) continue;
    const brittle = materialTrait(b.architecture?.rigid ?? C.MINERAL).brittleness,
      amount = b.maxIntegrity * share * (1 - d / (radius + 1)) * (0.7 + brittle * 0.6);
    if (damageBuildingDirect(b, amount, cause, eventId) > 0) damaged++;
    if (typeof BASH_SHAKE !== "undefined") BASH_SHAKE.set(b.id, performance.now() + 1200);
  }
  return damaged;
}
function erupt(center = hottestVentTile()) {
  if (center < 0) return null;
  const [cx, cy] = xy(center),
    t = W.tiles,
    ev = emitEvent("EruptionEvent", {
      location: center,
      evidence: ["geothermal pressure breached the crust at the hottest vent"],
      magnitude: 1,
      importance: 4,
      data: { name: "Eruption" },
    });
  for (let dy = -4; dy <= 4; dy++)
    for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx,
        y = cy + dy,
        d = Math.hypot(dx, dy);
      if (d > 4 || !inside(x, y)) continue;
      const i = idx(x, y),
        share = 1 - d / 4.5,
        // Rock becomes ash: a mass-conserving transfer between species on the tile.
        ash = Math.min(t.chem[C.MINERAL][i], Math.round(160 * share));
      t.chem[C.MINERAL][i] -= ash;
      t.chem[C.ASH][i] = u16(t.chem[C.ASH][i] + ash);
      t.temperature[i] = i16(t.temperature[i] + Math.round(140 * share));
      t.geothermal[i] = u16(Math.min(1000, t.geothermal[i] + 300 * share));
      t.danger[i] = u16(Math.min(65535, t.danger[i] + 400 * share));
      if (d <= 2 && t.liquid[i] < 400)
        queueEffect("IgniteTile", {
          tile: i,
          intensity: 420,
          causeEvent: ev.id,
          origin: "temperature",
        });
    }
  if (t.liquid[center] < 400) t.elevation[center] = u16(Math.min(955, t.elevation[center] + 25));
  ev.data.buildingsDamaged = damageBuildingsAround(cx, cy, 5, 0.35, "eruption", ev.id);
  W.living.disasters++;
  UI.disasterVisual = {
    kind: "eruption",
    tile: center,
    startedAt: performance.now(),
    until: performance.now() + 7000,
  };
  return ev;
}
function quake(center = randomLandTile("quake-site"), magnitude = 1) {
  if (center < 0) return null;
  const [cx, cy] = xy(center),
    radius = Math.round(6 + magnitude * 6),
    ev = emitEvent("EarthquakeEvent", {
      location: center,
      evidence: ["strain along the rift released through the crust"],
      magnitude,
      importance: magnitude > 1.1 ? 4 : 3,
      data: { name: "Earthquake", magnitude: +magnitude.toFixed(2) },
    });
  for (let dy = -radius; dy <= radius; dy++)
    for (let dx = -radius; dx <= radius; dx++) {
      const x = cx + dx,
        y = cy + dy,
        d = Math.hypot(dx, dy);
      if (d > radius || !inside(x, y)) continue;
      const i = idx(x, y);
      W.tiles.danger[i] = u16(
        Math.min(65535, W.tiles.danger[i] + 250 * magnitude * (1 - d / radius)),
      );
    }
  ev.data.buildingsDamaged = damageBuildingsAround(
    cx,
    cy,
    radius,
    0.3 * magnitude,
    "earthquake",
    ev.id,
  );
  W.living.disasters++;
  UI.disasterVisual = {
    kind: "earthquake",
    tile: center,
    radius,
    startedAt: performance.now(),
    until: performance.now() + 2500,
  };
  return ev;
}
function meteorStrike(center = Math.floor(disasterRoll("meteor-site") * W.tileCount)) {
  if (center < 0 || center >= W.tileCount) return null;
  const [cx, cy] = xy(center),
    t = W.tiles,
    sea = W.terrainGenome?.seaLevel ?? 430,
    ev = emitEvent("MeteorEvent", {
      location: center,
      evidence: ["a body from outside the world struck the surface"],
      magnitude: 1.2,
      importance: 4,
      data: { name: "Falling star" },
    });
  for (let dy = -3; dy <= 3; dy++)
    for (let dx = -3; dx <= 3; dx++) {
      const x = cx + dx,
        y = cy + dy,
        d = Math.hypot(dx, dy);
      if (d > 3 || !inside(x, y)) continue;
      const i = idx(x, y),
        share = 1 - d / 3.5;
      if (t.liquid[i] < 400)
        t.elevation[i] = u16(Math.max(sea + 6, t.elevation[i] - Math.round(110 * share)));
      t.temperature[i] = i16(t.temperature[i] + Math.round(200 * share));
      t.danger[i] = u16(Math.min(65535, t.danger[i] + 500 * share));
      if (d <= 1.5) {
        // Iron from the sky: the impact metamorphoses rock into ore, mass for mass.
        const ore = Math.min(t.chem[C.MINERAL][i], Math.round(120 * share));
        t.chem[C.MINERAL][i] -= ore;
        t.chem[C.ORE][i] = u16(t.chem[C.ORE][i] + ore);
      }
      if (d <= 2 && t.liquid[i] < 400)
        queueEffect("IgniteTile", {
          tile: i,
          intensity: 380,
          causeEvent: ev.id,
          origin: "temperature",
        });
    }
  ev.data.buildingsDamaged = damageBuildingsAround(cx, cy, 6, 0.5, "meteor strike", ev.id);
  W.living.disasters++;
  UI.lightningVisual = {
    tile: center,
    startedAt: performance.now(),
    until: performance.now() + 900,
    eventId: ev.id,
  };
  UI.disasterVisual = {
    kind: "meteor",
    tile: center,
    startedAt: performance.now(),
    until: performance.now() + 5000,
  };
  return ev;
}
function updateDisasters() {
  const freq = W.config.disasterFrequency || 1,
    g = W.terrainGenome || {},
    lf = g.landform || {},
    volcanic = (lf.cones?.length || 0) > 0,
    rifted =
      g.topology === "rifted" ||
      (lf.landforms || []).some((l) => l.kind === "rift" || l.kind === "shattered");
  if (disasterRoll("eruption") < 0.02 * freq * (volcanic ? 1.6 : 0.45)) erupt();
  else if (disasterRoll("earthquake") < 0.016 * freq * (rifted ? 2 : 0.6))
    quake(randomLandTile("quake-site"), 0.6 + disasterRoll("quake-magnitude") * 0.9);
  else if (disasterRoll("meteor") < 0.005 * freq) meteorStrike();
}
// ── Omens and shrines ──────────────────────────────────────────────────────────
const OMEN_READINGS = Object.freeze({
  rain: [1, "rain called down from a clear sky"],
  heal: [1, "wounds closed without a healer"],
  bless: [1, "a sudden fullness of the land"],
  plants: [1, "growth where nothing was sown"],
  resources: [1, "riches found where none were known"],
  water: [1, "water welling from dry ground"],
  ignite: [-1, "fire with no spark"],
  lightning: [-1, "lightning from a clear sky"],
  drought: [-1, "the rains withheld"],
  blight: [-1, "the land withering overnight"],
  disease: [-1, "sickness without a source"],
  erase: [-1, "lives unmade without a wound"],
  disaster: [-1, "the ground turning on its people"],
});
function omenReading(tool) {
  const entry = OMEN_READINGS[tool];
  return entry
    ? { favour: entry[0], sign: entry[1] }
    : { favour: 0, sign: "a change no one could account for" };
}
function updateOmens() {
  const since = W.living.lastOmenEventId || 0,
    fresh = [];
  for (let n = W.events.length - 1; n >= 0; n--) {
    const e = W.events[n];
    if (e.id <= since) break;
    if (e.type === "InterventionEvent" && e.location >= 0 && e.data?.tool !== "inspect")
      fresh.push(e);
  }
  if (W.events.length) W.living.lastOmenEventId = W.events[W.events.length - 1].id;
  fresh.reverse();
  for (const ev of fresh) {
    const [ex, ey] = xy(ev.location),
      reading = omenReading(ev.data.tool),
      witnesses = W.settlements
        .filter((s) => !s.ruined && s.factionId && dist2(s.x, s.y, ex, ey) <= 144)
        .sort((a, b) => dist2(a.x, a.y, ex, ey) - dist2(b.x, b.y, ex, ey) || a.id - b.id)
        .slice(0, 3);
    for (const s of witnesses) {
      const f = W.factions.find((x) => x.id === s.factionId);
      if (!f) continue;
      const spiritual = f.ethos.spiritual,
        culture = W.cultures.find((c) => c.id === f.cultureId);
      s.omens = (s.omens || 0) + 1;
      s.omenFavour = (s.omenFavour || 0) + reading.favour;
      s.stability = clamp(s.stability + reading.favour * 0.05 * spiritual, 0, 1);
      f.cohesion = clamp(f.cohesion + reading.favour * 0.02 * spiritual, 0.12, 1);
      emitEvent("OmenEvent", {
        subjects: [s.entityId, f.entityId],
        location: ev.location,
        factions: [f.id],
        causes: [ev.id],
        evidence: [
          reading.sign,
          spiritual > 0.6 ? "a spiritual ethos" : "a people slow to see signs",
        ],
        importance: spiritual > 0.6 ? 3 : 2,
        data: {
          tool: ev.data.tool,
          favour: reading.favour,
          name: s.name,
          culture: culture?.name || "",
          reading: reading.favour > 0 ? "favour" : reading.favour < 0 ? "wrath" : "a portent",
        },
      });
    }
  }
}
function placeWantsShrine(place) {
  if (!place.knownProcesses || place.ruined) return false;
  const f = W.factions.find((x) => x.id === place.factionId);
  if (!f) return false;
  return (f.ethos.spiritual > 0.55 && settlementPopulation(place) >= 10) || (place.omens || 0) >= 2;
}
const ensurePlacePlansLivingBase = ensurePlacePlans;
ensurePlacePlans = function (place) {
  ensurePlacePlansLivingBase(place);
  if (!place || place.ruined || place.active === false || !placeWantsShrine(place)) return;
  const kind = "settlement";
  if (
    W.buildings.some(
      (b) => !b.ruined && b.placeKind === kind && b.placeId === place.id && b.type === "shrine",
    )
  )
    return;
  planBuilding(place, "shrine", Math.max(3, place.management?.priorities?.governance || 3));
};
// Shrines steady a spiritual people: a completed shrine adds stability to its
// settlement and cohesion to its polity, more when the culture is spiritual.
const updateFactionsLivingBase = updateFactions;
updateFactions = function () {
  updateFactionsLivingBase();
  for (const f of W.factions) {
    if (f.stability <= 0) continue;
    let shrines = 0;
    for (const s of W.settlements) {
      if (s.ruined || s.factionId !== f.id) continue;
      const built = completedBuildings(s, "shrine").length;
      if (!built) continue;
      shrines += built;
      s.stability = clamp(
        s.stability + 0.004 * Math.min(2, built) * (0.5 + f.ethos.spiritual),
        0,
        1,
      );
    }
    if (shrines) f.cohesion = clamp(f.cohesion + 0.003 * (0.5 + f.ethos.spiritual), 0.12, 1);
  }
};
// ── Tick hook ──────────────────────────────────────────────────────────────────
const updateWeatherCycleLivingBase = updateWeatherCycle;
updateWeatherCycle = function () {
  updateWeatherCycleLivingBase();
  ensureLivingWorldColumns(W);
  updateSeasons();
  updateTraffic();
  if (W.tick % 128 === 64) updateDisasters();
  if (W.tick % 128 === 96) {
    updateSuccession();
    updateOmens();
  }
};
// ── Chronicle sentences ────────────────────────────────────────────────────────
const eventSentenceLivingBase = eventSentence;
eventSentence = function (e) {
  const loc = locationName(e.location);
  switch (e.type) {
    case "SeasonEvent":
      return `${e.data.season} came: the axial tilt swung the year's temperature by ${(e.data.amplitude / 5).toFixed(0)} degrees.`;
    case "EruptionEvent":
      return `A vent erupted near ${loc}: rock became ash, the ground burned, and ${countNoun(e.data.buildingsDamaged, "building")} ${e.data.buildingsDamaged === 1 ? "was" : "were"} damaged.`;
    case "EarthquakeEvent":
      return `An earthquake of magnitude ${e.data.magnitude} shook ${loc}, damaging ${countNoun(e.data.buildingsDamaged, "building")}.`;
    case "MeteorEvent":
      return `A falling star struck near ${loc}, cratering the ground, igniting it, and leaving ore in the rock.`;
    case "SuccessionEvent":
      return `${e.data.name} chose its ${ordinalWord(e.data.ordinal)} Voice${e.data.hereditary ? " from the line of the last" : " by trust and dominance"}.`;
    case "OmenEvent":
      return `${e.data.name} read ${e.data.tool} as ${e.data.reading}${e.data.culture ? ` under ${e.data.culture}` : ""}.`;
    default:
      return eventSentenceLivingBase(e);
  }
};
function countNoun(n, noun) {
  const count = n || 0;
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
function ordinalWord(n) {
  return n === 1 ? "first" : n === 2 ? "second" : n === 3 ? "third" : n === 4 ? "fourth" : `${n}th`;
}
// ── Disaster visuals (render side; reads UI state and the wall clock only) ─────
const drawProceduralAtmosphereLivingBase = drawProceduralAtmosphere;
drawProceduralAtmosphere = function (now, m, v) {
  const d = UI.disasterVisual;
  if (d && performance.now() < d.until && W && d.tile >= 0 && d.tile < W.tileCount) {
    const [tx, ty] = xy(d.tile),
      p = proceduralProjectTile(tx + 0.5, ty + 0.5, m),
      age = (performance.now() - d.startedAt) / Math.max(1, d.until - d.startedAt);
    ctx.save();
    if (d.kind === "eruption") {
      ctx.fillStyle = hsl(22, 95, 60, 0.35 * (1 - age));
      ctx.beginPath();
      ctx.arc(p.x, p.y, m.tw * (1.2 + age * 2.5), 0, Math.PI * 2);
      ctx.fill();
      for (let n = 0; n < 6; n++) {
        const t = (age * 1.6 + n * 0.17) % 1;
        ctx.fillStyle = hsl(v.mineralHue, 14, 30, (1 - t) * 0.5);
        ctx.beginPath();
        ctx.arc(
          p.x + Math.sin(t * 7 + n) * m.tw * (0.6 + t),
          p.y - t * m.th * 7,
          m.tw * (0.5 + t * 1.6),
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    } else if (d.kind === "earthquake") {
      ctx.strokeStyle = hsl(v.mineralHue, 30, 70, 0.5 * (1 - age));
      ctx.lineWidth = 2;
      for (let n = 1; n <= 3; n++) {
        ctx.beginPath();
        ctx.ellipse(
          p.x,
          p.y,
          m.tw * (d.radius || 8) * age * n * 0.4,
          m.th * (d.radius || 8) * age * n * 0.24,
          0,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
      }
    } else if (d.kind === "meteor") {
      ctx.strokeStyle = hsl(40, 90, 80, 0.7 * (1 - age));
      ctx.lineWidth = Math.max(1.5, m.tw * 0.12);
      ctx.beginPath();
      ctx.moveTo(p.x + m.tw * 9 * (1 - age), p.y - m.th * 14 * (1 - age));
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.fillStyle = hsl(30, 95, 65, 0.4 * (1 - age));
      ctx.beginPath();
      ctx.arc(p.x, p.y, m.tw * (1 + age * 3), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  drawProceduralAtmosphereLivingBase(now, m, v);
};
// ── Debug surface ──────────────────────────────────────────────────────────────
window.ALIFE_LIVING_DEBUG = Object.freeze({
  season: () => ({
    genome: seasonGenome(),
    phase: seasonPhase(),
    name: seasonName(),
    label: seasonLabel(),
    offsets: W?.tiles.seasonOffset
      ? {
          min: W.tiles.seasonOffset.reduce((a, b) => Math.min(a, b), 0),
          max: W.tiles.seasonOffset.reduce((a, b) => Math.max(a, b), 0),
        }
      : null,
  }),
  traffic: () => {
    const t = W?.tiles.traffic;
    if (!t) return { worn: 0, roads: 0, max: 0 };
    let worn = 0,
      roads = 0,
      max = 0;
    for (let i = 0; i < t.length; i++) {
      if (t[i] > TRAFFIC_VISIBLE) worn++;
      if (t[i] > TRAFFIC_ROAD) roads++;
      if (t[i] > max) max = t[i];
    }
    return { worn, roads, max };
  },
  erupt: (tile) => erupt(tile ?? hottestVentTile())?.id || 0,
  quake: (tile, magnitude = 1) => quake(tile ?? randomLandTile("quake-site"), magnitude)?.id || 0,
  meteor: (tile) => meteorStrike(tile ?? randomLandTile("meteor-site"))?.id || 0,
  forceSuccession: (factionId) => {
    const f = W.factions.find((x) => x.id === factionId) || W.factions.find((x) => x.stability > 0);
    if (!f) return null;
    for (const e of relationsOf(f.entityId, "leads")) removeRelation(e.from, e.to, "leads");
    const before = W.living?.successions || 0;
    updateSuccession();
    return {
      factionId: f.id,
      leaderId: f.leaderId || 0,
      succeeded: (W.living?.successions || 0) > before,
    };
  },
  omens: () => {
    updateOmens();
    return W.settlements.map((s) => ({ id: s.id, omens: s.omens || 0, favour: s.omenFavour || 0 }));
  },
  planShrine: (settlementId) => {
    const s =
      W.settlements.find((x) => x.id === settlementId) || W.settlements.find((x) => !x.ruined);
    if (!s) return null;
    s.omens = Math.max(s.omens || 0, 2);
    ensurePlacePlans(s);
    return W.buildings.filter((b) => b.placeId === s.id && b.type === "shrine" && !b.ruined).length;
  },
  living: () => W?.living || null,
});
