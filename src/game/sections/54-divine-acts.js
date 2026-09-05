// ═══════════════════════════════════════════════════════════════════════════
// 54. DIVINE ACTS — the god speaks to people and polities
// ═══════════════════════════════════════════════════════════════════════════
// Every earlier tool acts on matter, weather, terrain, or seeding life. These
// five act on minds and on the ties between polities: marking a chosen one,
// whispering a process into a town, writing a sign across the sky for prophets
// to read, binding a truce, and sowing discord. Each is recorded as an
// intervention like any other, so omens and belief read it through the same
// path, and each leaves an event of its own in the annals. Knowledge moves,
// matter does not; the visuals below only read UI state and the world.
const DIVINE_TOOLS = new Set(["anoint", "whisper", "sign", "truce", "discord"]);
const DIVINE_OMENS = Object.freeze({
  anoint: [1, "a life marked before all eyes"],
  whisper: [1, "knowledge arriving whole in a dream"],
  sign: [0, "a sign written across the sky"],
  truce: [1, "raised hands stayed by an unseen will"],
  discord: [-1, "old wounds torn open by an unseen hand"],
});
const SKY_SIGNS = Object.freeze([
  "a comet with a forked tail",
  "a second dawn in the north",
  "a ring around the sun",
  "a rain of green sparks",
  "a slow star crossing the noon sky",
  "the moons standing still",
]);
const omenReadingDivineBase = omenReading;
omenReading = function (tool) {
  const entry = DIVINE_OMENS[tool];
  return entry ? { favour: entry[0], sign: entry[1] } : omenReadingDivineBase(tool);
};
// Visual bursts live in UI state, never in the world.
function divineVisual(kind, tile, extra = {}) {
  const now = performance.now();
  UI.divineVisuals = (UI.divineVisuals || []).filter((x) => now - x.started < 12000);
  UI.divineVisuals.push({ kind, tile, started: now, world: W, ...extra });
}
function nearestPersonTo(tile, radius = 2) {
  const [cx, cy] = xy(tile);
  let best = 0,
    bd = Infinity;
  for (const i of brushTiles(tile, Math.max(radius, UI.brush)))
    for (const id of W.spatialBins[i] || []) {
      if (W.kind[id] !== KINDS.PERSON || !classifyAlive(id)) continue;
      const p = W.components.position[id],
        d = dist2(p.x, p.y, cx, cy);
      if (d < bd || (d === bd && id < best)) {
        bd = d;
        best = id;
      }
    }
  return best;
}
function cultureOfFaction(f) {
  return f ? W.cultures.find((c) => c.id === f.cultureId) || null : null;
}
function cultureOfPerson(id) {
  const soc = W.components.social[id];
  if (!soc) return null;
  return (
    (soc.cultureId && W.cultures.find((c) => c.id === soc.cultureId)) ||
    cultureOfFaction(W.factions.find((f) => f.id === soc.factionId)) ||
    null
  );
}
// ── Mark a chosen one ──────────────────────────────────────────────────────────
function makeProphet(culture, id, cause) {
  const b = culture.belief,
    lean = beliefLean(b),
    foretold =
      lean === "wrath"
        ? "fire and broken ground"
        : lean === "favour"
          ? "years of plenty"
          : "a sign none will mistake",
    home = cultureSettlements(culture)[0],
    ident = W.components.identity[id],
    title = `Speaker of ${b.name}`;
  b.prophetId = id;
  b.prophecy = { tick: W.tick, lean, foretold, fulfilledEventId: 0 };
  if (!ident.titles.includes(title)) ident.titles.push(title);
  ident.significance += 6;
  return emitEvent("ProphecyEvent", {
    subjects: [id, culture.entityId],
    location: home ? idx(home.x, home.y) : -1,
    factions: cultureFactions(culture).map((f) => f.id),
    causes: cause ? [cause.id] : [],
    evidence: ["chosen by the god", `read as ${lean}`],
    importance: 3,
    data: { culture: culture.name, god: godTitle(culture), foretold, lean },
  });
}
function anointPerson(id, cause) {
  const ident = W.components.identity[id],
    soc = W.components.social[id];
  if (!ident || !soc) return null;
  if (typeof characterOf === "function") characterOf(id);
  const culture = cultureOfPerson(id);
  if (culture) ensureBeliefs();
  const god = culture?.belief?.named ? culture.belief.name : "the Unseen",
    title = `Chosen of ${god}`,
    p = W.components.position[id];
  if (!ident.titles.includes(title)) ident.titles.push(title);
  ident.chosen = { tick: W.tick, eventId: 0, god };
  ident.notable = true;
  ident.significance += 8;
  if (ident.traits) {
    ident.want = { id: ident.traits.includes("proud") ? "voice" : "faith", since: W.tick };
    ident.wantsChosen = (ident.wantsChosen || 0) + 1;
  }
  const ev = emitEvent("ChosenEvent", {
    subjects: [id, ...(culture ? [culture.entityId] : [])],
    location: p ? idx(p.x, p.y) : -1,
    factions: soc.factionId ? [soc.factionId] : [],
    causes: cause ? [cause.id] : [],
    evidence: [
      "marked by the god before witnesses",
      culture?.belief?.named
        ? `${culture.name} know the god as ${godTitle(culture)}`
        : "the god is not yet named",
    ],
    importance: 4,
    data: { name: ident.generatedName, god, culture: culture?.name || "" },
  });
  ident.chosen.eventId = ev.id;
  if (culture?.belief) {
    const b = culture.belief;
    b.attention += 2;
    b.awe += 1;
    if (b.named && (!b.prophetId || !classifyAlive(b.prophetId))) makeProphet(culture, id, ev);
    if (b.named) recordMyth(culture, ev, 1);
  }
  setEmotionImpulse(id, { resolve: 0.4, contentment: 0.2 }, ev.id, "✨");
  if (typeof remember === "function") remember(id, ev.id, "chosen");
  divineVisual("anoint", p ? idx(p.x, p.y) : -1, { id });
  return ev;
}
// ── Whisper knowledge ──────────────────────────────────────────────────────────
function whisperableTech(place) {
  const known = new Set(place.knownProcesses || []),
    catalog = [
      ...TECH_BASE,
      ...(typeof ADVANCED_TECH_BASE !== "undefined" ? ADVANCED_TECH_BASE : []),
    ];
  for (const tech of catalog)
    if (!known.has(tech.id) && (tech.prior || []).every((p) => known.has(p))) return tech;
  return null;
}
function whisperKnowledge(place, cause) {
  const tech = whisperableTech(place);
  if (!tech || !place.knownProcesses) return null;
  place.knownProcesses.push(tech.id);
  place.researchProgress = place.researchProgress || {};
  place.researchProgress[tech.id] = tech.threshold || 24 + (tech.prior?.length || 0) * 14;
  const here = idx(place.x, place.y),
    hearer =
      entityAtRadius(here, 8, KINDS.PERSON)
        .filter((id) => classifyAlive(id))
        .sort(
          (a, b) =>
            (W.components.identity[b]?.significance || 0) -
              (W.components.identity[a]?.significance || 0) || a - b,
        )[0] || 0,
    culture =
      W.cultures.find((c) => c.id === place.cultureId) ||
      cultureOfFaction(W.factions.find((f) => f.id === place.factionId)),
    factions = place.factionId ? [place.factionId] : [],
    ev = emitEvent("WhisperEvent", {
      subjects: [hearer, place.entityId].filter(Boolean),
      location: here,
      factions,
      causes: cause ? [cause.id] : [],
      evidence: [
        `${tech.name} arrived whole, without observation`,
        hearer ? `${entityName(hearer)} woke knowing it` : "no one could say who first knew it",
        "knowledge moved; matter did not",
      ],
      importance: 4,
      data: {
        name: tech.name,
        process: tech.process || "a civic practice",
        settlement: place.name,
        hearer: hearer ? entityName(hearer) : "",
      },
    });
  // The ordinary technology ledger stays honest about what the town knows.
  const advance = emitEvent("TechAdvanceEvent", {
    subjects: [hearer, place.entityId].filter(Boolean),
    location: here,
    factions,
    causes: [ev.id],
    evidence: ["a whisper from the god", "knowledge moved; matter did not"],
    importance: 2,
    data: { name: tech.name, process: tech.process, risk: tech.risk, settlement: place.name },
  });
  place.importantEvents = place.importantEvents || [];
  place.importantEvents.push(ev.id);
  W.technologies.push({
    id: W.technologies.length + 1,
    definitionId: tech.id,
    settlementId: place.id,
    discovererId: hearer,
    tick: W.tick,
    eventId: advance.id,
    temperature: Math.round(place.productionTemperature || 20),
    structure: (tech.structures || []).slice(),
    divine: true,
  });
  if (hearer) {
    W.components.identity[hearer].significance += 4;
    if (typeof grantSkill === "function" && SKILL_KEYS.includes("lore"))
      grantSkill(hearer, "lore", 10, ev.id);
    setEmotionImpulse(hearer, { resolve: 0.2, contentment: 0.1 }, ev.id, "💭");
    if (typeof remember === "function") remember(hearer, ev.id, "discovery");
  }
  if (culture) {
    ensureBeliefs();
    culture.belief.attention += 1;
  }
  divineVisual("whisper", here);
  return ev;
}
// ── Sign in the sky ────────────────────────────────────────────────────────────
function newProphecy(culture, cause) {
  const b = culture.belief,
    lean = beliefLean(b),
    foretold =
      lean === "wrath"
        ? "a fire that eats a town"
        : lean === "favour"
          ? "a harvest that fills every store"
          : "a stranger who will change the people",
    home = cultureSettlements(culture)[0];
  b.prophecy = { tick: W.tick, lean, foretold, fulfilledEventId: 0 };
  W.components.identity[b.prophetId].significance += 3;
  return emitEvent("ProphecyEvent", {
    subjects: [b.prophetId, culture.entityId],
    location: home ? idx(home.x, home.y) : -1,
    factions: cultureFactions(culture).map((f) => f.id),
    causes: cause ? [cause.id] : [],
    evidence: ["a sign in the sky", `read as ${lean}`],
    importance: 3,
    data: { culture: culture.name, god: godTitle(culture), foretold, lean },
  });
}
function signInSky(tile, cause) {
  const [tx, ty] = xy(tile),
    witnesses = W.settlements
      .filter((s) => !s.ruined && s.factionId && dist2(s.x, s.y, tx, ty) <= 400)
      .sort((a, b) => dist2(a.x, a.y, tx, ty) - dist2(b.x, b.y, tx, ty) || a.id - b.id)
      .slice(0, 4),
    cultures = [];
  for (const s of witnesses) {
    const c = cultureOfFaction(W.factions.find((f) => f.id === s.factionId));
    if (c && !cultures.includes(c)) cultures.push(c);
  }
  const sign = SKY_SIGNS[hashParts(W.seedHash, "sky-sign", tile, W.tick) % SKY_SIGNS.length],
    ev = emitEvent("SkySignEvent", {
      subjects: cultures.map((c) => c.entityId),
      location: tile,
      factions: [...new Set(witnesses.map((s) => s.factionId))],
      causes: cause ? [cause.id] : [],
      evidence: [witnesses.length ? `${witnesses.length} towns saw it` : "no town saw it"],
      importance: witnesses.length ? 4 : 2,
      data: { towns: witnesses.map((s) => s.name), sign },
    });
  for (const c of cultures) {
    ensureBeliefs();
    const b = c.belief;
    b.attention += 2;
    b.awe += 2;
    if (
      b.named &&
      b.prophetId &&
      classifyAlive(b.prophetId) &&
      (!b.prophecy || b.prophecy.fulfilledEventId || W.tick - b.prophecy.tick > TICKS_PER_YEAR * 8)
    )
      newProphecy(c, ev);
    if (b.named) recordMyth(c, ev, 0);
  }
  divineVisual("sign", tile, { sign });
  return ev;
}
// ── Bind a truce ───────────────────────────────────────────────────────────────
function ensureRelation(a, b) {
  return (
    a.relations[b.id] ||
    (a.relations[b.id] = { status: "neutral", pressure: 0, grievance: 0, trade: 0 })
  );
}
function capitalTile(f, fallback) {
  const s = W.settlements.find((x) => x.id === f.capitalSettlementId && !x.ruined);
  return s ? idx(s.x, s.y) : fallback;
}
function truceTarget(tile) {
  const f = nearestFaction(tile);
  if (!f) return null;
  const war = W.activeWars.find((w) => !w.ended && (w.a === f.id || w.b === f.id));
  let other = null;
  if (war) other = W.factions.find((x) => x.id === (war.a === f.id ? war.b : war.a)) || null;
  else {
    let bp = -1;
    for (const [id, rel] of Object.entries(f.relations || {}))
      if ((rel.status === "hostile" || rel.status === "mobilizing") && rel.pressure > bp) {
        bp = rel.pressure;
        other = W.factions.find((x) => x.id === Number(id)) || null;
      }
  }
  return other ? { f, other, war: war || null } : null;
}
function bindTruce(tile, cause, target = truceTarget(tile)) {
  if (!target) return null;
  const { f, other, war } = target;
  if (war) endWar(war, f, other, "a truce bound by the god");
  const until = W.tick + TICKS_PER_YEAR * 8;
  for (const [x, y] of [
    [f, other],
    [other, f],
  ]) {
    const rel = ensureRelation(x, y);
    rel.status = "truce";
    rel.truceUntil = Math.max(rel.truceUntil || 0, until);
    rel.pressure = Math.min(rel.pressure || 0, 30);
    rel.grievance = +((rel.grievance || 0) * 0.5).toFixed(3);
    rel.mobilizeSince = 0;
  }
  const ev = emitEvent("DivineTruceEvent", {
    subjects: [f.entityId, other.entityId],
    location: tile,
    factions: [f.id, other.id],
    causes: [cause?.id, war?.startEventId].filter(Boolean),
    evidence: [war ? "a war ended by decree" : "a quarrel stilled before war", "eight years bound"],
    importance: 4,
    data: { a: f.name, b: other.name, war: !!war },
  });
  for (const x of [f, other]) {
    const c = cultureOfFaction(x);
    if (c) {
      ensureBeliefs();
      c.belief.attention += 1;
    }
  }
  divineVisual("truce", tile, { tiles: [capitalTile(f, tile), capitalTile(other, tile)] });
  return ev;
}
// ── Sow discord ────────────────────────────────────────────────────────────────
function discordTarget(tile) {
  const f = nearestFaction(tile);
  if (!f) return null;
  const ca = W.settlements.find((s) => s.id === f.capitalSettlementId);
  let other = null,
    bd = Infinity;
  for (const x of W.factions) {
    if (x === f || x.stability <= 0) continue;
    const cx = W.settlements.find((s) => s.id === x.capitalSettlementId);
    if (!cx || !ca || !factionsHaveContact(f, x)) continue;
    const d = dist2(ca.x, ca.y, cx.x, cx.y);
    if (d < bd) {
      bd = d;
      other = x;
    }
  }
  return other ? { f, other } : null;
}
function sowDiscord(tile, cause, target = discordTarget(tile)) {
  if (!target) return null;
  const { f, other } = target;
  for (const [x, y] of [
    [f, other],
    [other, f],
  ]) {
    const rel = ensureRelation(x, y);
    rel.grievance = +((rel.grievance || 0) + 30).toFixed(3);
    rel.pressure = Math.min(200, (rel.pressure || 0) + 40);
    rel.truceUntil = 0;
    if (rel.status === "neutral" || rel.status === "truce" || rel.status === "allied")
      rel.status = "hostile";
    x.allies = (x.allies || []).filter((id) => id !== y.id);
    x.rivals = x.rivals || [];
    if (!x.rivals.includes(y.id)) x.rivals.push(y.id);
  }
  removeRelation(f.entityId, other.entityId, "allied_with");
  removeRelation(other.entityId, f.entityId, "allied_with");
  const ev = emitEvent("DiscordEvent", {
    subjects: [f.entityId, other.entityId],
    location: tile,
    factions: [f.id, other.id],
    causes: cause ? [cause.id] : [],
    evidence: [
      "old wounds torn open",
      `grievance now ${Math.round(f.relations[other.id].grievance)}`,
    ],
    importance: 4,
    data: { a: f.name, b: other.name },
  });
  for (const x of [f, other]) {
    const c = cultureOfFaction(x);
    if (c) {
      ensureBeliefs();
      c.belief.attention += 1;
      c.belief.awe += 1;
    }
  }
  divineVisual("discord", tile, { tiles: [capitalTile(f, tile), capitalTile(other, tile)] });
  return ev;
}
// ── The tool path ──────────────────────────────────────────────────────────────
const applyToolDivineBase = applyTool;
applyTool = function (tile) {
  if (!W || !DIVINE_TOOLS.has(UI.tool) || tile < 0 || tile >= W.tileCount)
    return applyToolDivineBase(tile);
  // An act that cannot land is refused before anything is recorded, so a
  // refusal is never read as an omen.
  let target = null,
    refusal = "";
  switch (UI.tool) {
    case "anoint":
      target = nearestPersonTo(tile, 2);
      if (!target) refusal = "No one stands here to be chosen.";
      break;
    case "whisper": {
      const s = nearestSettlement(tile, 10);
      if (!s || s.ruined) refusal = "No town here can receive knowledge.";
      else if (!whisperableTech(s)) refusal = `${s.name} already knows all it can hold for now.`;
      else target = s;
      break;
    }
    case "sign":
      target = tile;
      break;
    case "truce":
      target = truceTarget(tile);
      if (!target) refusal = "No quarrel to bind here.";
      break;
    case "discord":
      target = discordTarget(tile);
      if (!target) refusal = "No rival polity within reach to set against this one.";
      break;
  }
  if (refusal) {
    toast(refusal, "warn");
    selectTile(tile);
    return null;
  }
  const def = TOOL_DEFS.find((t) => t[0] === UI.tool),
    cause = recordIntervention(def?.[1] || UI.tool, tile, UI.brush);
  let ev = null;
  switch (UI.tool) {
    case "anoint":
      ev = anointPerson(target, cause);
      break;
    case "whisper":
      ev = whisperKnowledge(target, cause);
      break;
    case "sign":
      ev = signInSky(tile, cause);
      break;
    case "truce":
      ev = bindTruce(tile, cause, target);
      break;
    case "discord":
      ev = sowDiscord(tile, cause, target);
      break;
  }
  resolveEffects();
  rebuildSpatialBins();
  if (UI.tool === "anoint" && ev) selectEntity(ev.subjects[0]);
  else selectTile(tile);
  worldHash();
  refreshUI(true);
  audioClick(UI.tool === "discord" ? 120 : 330);
  return ev;
};
// ── Chronicle sentences ────────────────────────────────────────────────────────
const eventSentenceDivineBase = eventSentence;
eventSentence = function (e) {
  const d = e.data || {};
  switch (e.type) {
    case "ChosenEvent":
      return `${d.name} was marked as Chosen of ${d.god}${d.culture ? ` before the ${d.culture}` : ""}.`;
    case "WhisperEvent":
      return `${d.settlement} woke knowing ${d.name}${d.hearer ? `; ${d.hearer} heard it first` : ""}.`;
    case "SkySignEvent":
      return `${String(d.sign || "a sign").replace(/^./, (c) => c.toUpperCase())} appeared in the sky${d.towns?.length ? ` over ${d.towns.slice(0, 3).join(", ")}` : ""}.`;
    case "DivineTruceEvent":
      return `${d.a} and ${d.b} were bound to a truce${d.war ? " and their war ended" : ""}.`;
    case "DiscordEvent":
      return `Discord was sown between ${d.a} and ${d.b}.`;
    case "InterventionEvent":
      return DIVINE_TOOLS.has(d.tool)
        ? `The god acted: ${d.label || d.tool} at ${locationName(e.location)}.`
        : eventSentenceDivineBase(e);
    default:
      return eventSentenceDivineBase(e);
  }
};
// ── Drawing ────────────────────────────────────────────────────────────────────
// Chosen ones carry a halo of orbiting sparks; whispers spiral up from a town;
// a truce sends white rings out from both capitals and joins them with light;
// discord flickers a dark bolt between them. The sky sign crosses the heavens.
function liveDivineVisuals(now) {
  return (UI.divineVisuals || []).filter(
    (x) => x.world === W && now - x.started < 9000 && x.tile >= 0 && x.tile < W.tileCount,
  );
}
const drawWorkerActivityDivineBase = drawWorkerActivity;
drawWorkerActivity = function (now, bounds) {
  drawWorkerActivityDivineBase(now, bounds);
  if (UI.quality === "low") return;
  const m = ACTIVE_RENDER_METRICS || projectionMetrics(),
    v = ACTIVE_PLANET_VISUAL || makePlanetVisualGenome(),
    still = ACTIVE_REDUCED_MOTION,
    clock = performance.now();
  if (UI.camera.zoom >= 1.4) {
    let halos = 0;
    for (const id of W.activeIds) {
      if (halos > 24 || W.kind[id] !== KINDS.PERSON) continue;
      const ident = W.components.identity[id];
      if (!ident?.chosen) continue;
      const p = W.components.position[id];
      if (
        !p ||
        W.components.life[id]?.insideBuildingId ||
        p.x < bounds.x0 ||
        p.x > bounds.x1 ||
        p.y < bounds.y0 ||
        p.y > bounds.y1
      )
        continue;
      const s = visualAnchor(id, p, m, now).s,
        r = clamp(m.tw * 0.3, 3, 40),
        cy = s.y - r * 1.9;
      ctx.strokeStyle = hsl(46, 90, 72, 0.55);
      ctx.lineWidth = Math.max(1, r * 0.08);
      ctx.beginPath();
      ctx.ellipse(s.x, cy, r * 0.75, r * 0.3, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = hsl(46, 95, 82, 0.9);
      for (let k = 0; k < 3; k++) {
        const a = still ? k * 2.09 : now * 0.003 + k * 2.09 + id;
        ctx.beginPath();
        ctx.arc(
          s.x + Math.cos(a) * r * 0.75,
          cy + Math.sin(a) * r * 0.3,
          Math.max(1, r * 0.09),
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      halos++;
    }
  }
  for (const d of liveDivineVisuals(clock)) {
    const age = clamp((clock - d.started) / 6000, 0, 1),
      [tx, ty] = xy(d.tile),
      p = proceduralProjectTile(tx + 0.5, ty + 0.5, m);
    if (d.kind === "whisper") {
      for (let k = 0; k < 7; k++) {
        const t = ((still ? 0.5 : age * 1.4) + k * 0.14) % 1,
          a = t * 9 + k;
        ctx.fillStyle = hsl(v.accentHue, 70, 80, (1 - t) * 0.8);
        ctx.beginPath();
        ctx.arc(
          p.x + Math.cos(a) * m.tw * (0.4 + t * 0.8),
          p.y - t * m.th * 4,
          Math.max(1, m.tw * 0.07 * (1.2 - t)),
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    } else if (d.kind === "anoint") {
      ctx.strokeStyle = hsl(46, 90, 75, (1 - age) * 0.7);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(
        p.x,
        p.y,
        m.tw * (0.6 + age * 2.4),
        m.th * (0.6 + age * 2.4) * 0.6,
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    } else if ((d.kind === "truce" || d.kind === "discord") && d.tiles?.length === 2) {
      const [a, b] = d.tiles.map((t) => {
        const [x, y] = xy(t);
        return proceduralProjectTile(x + 0.5, y + 0.5, m);
      });
      if (d.kind === "truce") {
        ctx.strokeStyle = hsl(0, 0, 100, (1 - age) * 0.6);
        ctx.lineWidth = 2;
        for (const c of [a, b]) {
          for (let n = 1; n <= 2; n++) {
            ctx.beginPath();
            ctx.ellipse(
              c.x,
              c.y,
              m.tw * age * 6 * n * 0.5,
              m.th * age * 6 * n * 0.3,
              0,
              0,
              Math.PI * 2,
            );
            ctx.stroke();
          }
        }
        ctx.strokeStyle = hsl(52, 80, 85, (1 - age) * 0.5);
        ctx.setLineDash([m.tw * 0.4, m.tw * 0.4]);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y - m.th);
        ctx.quadraticCurveTo((a.x + b.x) / 2, Math.min(a.y, b.y) - m.th * 6, b.x, b.y - m.th);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        const flicker = still ? 0.7 : 0.4 + 0.6 * Math.abs(Math.sin(clock * 0.02));
        ctx.strokeStyle = hsl(4, 90, 55, (1 - age) * flicker);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y - m.th);
        for (let k = 1; k <= 5; k++) {
          const f = k / 6,
            jitter =
              (visualHash01(d.tile, k + (still ? 0 : Math.floor(clock / 80))) - 0.5) * m.tw * 2;
          ctx.lineTo(
            a.x + (b.x - a.x) * f + jitter,
            a.y - m.th + (b.y - a.y) * f - Math.abs(jitter) * 0.5,
          );
        }
        ctx.lineTo(b.x, b.y - m.th);
        ctx.stroke();
        ctx.fillStyle = hsl(4, 70, 30, (1 - age) * 0.25);
        for (const c of [a, b]) {
          ctx.beginPath();
          ctx.ellipse(c.x, c.y, m.tw * 3, m.th * 1.8, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
};
const drawProceduralAtmosphereDivineBase = drawProceduralAtmosphere;
drawProceduralAtmosphere = function (now, m, v) {
  drawProceduralAtmosphereDivineBase(now, m, v);
  const clock = performance.now(),
    signs = liveDivineVisuals(clock).filter((d) => d.kind === "sign");
  if (!signs.length) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const d of signs) {
    const age = clamp((clock - d.started) / 7000, 0, 1),
      x = m.w * (-0.1 + (ACTIVE_REDUCED_MOTION ? 0.6 : age * 1.2)),
      y = m.h * (0.14 + Math.sin(age * 2.2) * 0.05),
      fade = age < 0.85 ? 1 : (1 - age) / 0.15;
    for (let k = 0; k < 9; k++) {
      const t = k / 9;
      ctx.fillStyle = hsl(v.accentHue, 80, 85, fade * (1 - t) * 0.55);
      ctx.beginPath();
      ctx.arc(
        x - t * m.w * 0.16,
        y + t * m.h * 0.02,
        Math.max(2, m.w * 0.006 * (1.4 - t)),
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.fillStyle = hsl(50, 90, 92, fade * 0.95);
    ctx.beginPath();
    ctx.arc(x, y, Math.max(3, m.w * 0.008), 0, Math.PI * 2);
    ctx.fill();
    if (d.tile >= 0 && d.tile < W.tileCount) {
      const [tx, ty] = xy(d.tile),
        p = proceduralProjectTile(tx + 0.5, ty + 0.5, m);
      ctx.fillStyle = hsl(v.accentHue, 70, 80, fade * 0.12);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, m.tw * 6, m.th * 3.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
};
window.ALIFE_DIVINE_DEBUG = Object.freeze({
  tools: [...DIVINE_TOOLS],
  act: (tool, tile) => {
    const previous = UI.tool;
    UI.tool = tool;
    const ev = applyTool(tile);
    UI.tool = previous;
    return ev || null;
  },
  anoint: (id) => anointPerson(id, null),
  whisper: (settlementId) => {
    const s = W.settlements.find((x) => x.id === settlementId);
    return s ? whisperKnowledge(s, null) : null;
  },
  whisperable: (settlementId) => {
    const s = W.settlements.find((x) => x.id === settlementId);
    return s ? whisperableTech(s)?.id || null : null;
  },
  sign: (tile) => signInSky(tile, null),
  truce: (tile) => bindTruce(tile, null),
  discord: (tile) => sowDiscord(tile, null),
  visuals: () => (UI.divineVisuals || []).map((x) => ({ kind: x.kind, tile: x.tile })),
});
