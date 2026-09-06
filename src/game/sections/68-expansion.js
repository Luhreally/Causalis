// ═══════════════════════════════════════════════════════════════════════════
// 68. EXPANSION — settlers fill the land, and the land can be vaster
// ═══════════════════════════════════════════════════════════════════════════
// Towns grew where camps happened to be and polities rarely reached past a
// few places. Here a crowded, stable town sends a party of settlers with
// provisions to a reachable site a day or two away, chosen for food and free
// land, to raise a new camp that grows into a town of the same polity; the
// Expansionist and Colonizers are keenest. The world's caps on people, camps,
// towns, and polities scale with the map's area, so larger maps hold more, and
// a vast size joins the presets. Rendering only reads the world.
const SETTLER_COOLDOWN = TICKS_PER_YEAR * 4;
function ensureExpansion(world = W) {
  if (!world) return;
  world.expeditions = world.expeditions || [];
  if (world.nextExpeditionId == null) world.nextExpeditionId = 1;
}
// Caps grow with the map. Smaller maps keep the original numbers.
function scaleCaps(width, height) {
  const k = clamp(Math.sqrt((width * height) / (180 * 110)), 1, 2.2),
    scaled = {};
  for (const [name, base] of Object.entries(CAP_BASE)) scaled[name] = Math.round(base * k);
  CAPS = Object.freeze(scaled);
  return CAPS;
}
const createWorldExpansionBase = createWorld;
createWorld = function (options) {
  const [width, height] = SIZE_PRESETS[options?.size] || SIZE_PRESETS.standard;
  scaleCaps(width, height);
  const world = createWorldExpansionBase(options);
  if (options?.size === "vast" && typeof toast === "function")
    toast("A vast world: expect slower ticks, and slower still on phones.", "warn");
  return world;
};
const restoreWorldExpansionBase = restoreWorldDefaults;
restoreWorldDefaults = function () {
  restoreWorldExpansionBase();
  ensureExpansion(W);
  if (W?.width && W?.height) scaleCaps(W.width, W.height);
};
// ── Choosing where to go ───────────────────────────────────────────────────────
function compassWord(dx, dy) {
  const a = Math.atan2(dy, dx),
    words = ["east", "southeast", "south", "southwest", "west", "northwest", "north", "northeast"];
  return words[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];
}
function settlerSite(place) {
  const from = idx(place.x, place.y),
    cycle = Math.floor(W.tick / 256);
  let best = -1,
    score = -Infinity;
  for (let attempt = 0; attempt < 40; attempt++) {
    const a = counterRand("settle-angle", cycle, place.id, attempt) * Math.PI * 2,
      d = 10 + counterRand("settle-dist", cycle, place.id, attempt) * 16,
      x = Math.round(place.x + Math.cos(a) * d),
      y = Math.round(place.y + Math.sin(a) * d);
    if (!inside(x, y) || x < 2 || y < 2 || x >= W.width - 2 || y >= W.height - 2) continue;
    const tile = idx(x, y);
    if (W.tiles.liquid[tile] > WATER_DEPTH.SURFACE || W.tiles.fire[tile] >= 100) continue;
    if (W.tiles.owner[tile] && W.tiles.owner[tile] !== place.factionId) continue;
    if (campNear(tile, 6) || nearestSettlement(tile, 9)) continue;
    const food = tileFood(tile, "omnivore");
    if (food < 3) continue;
    const s =
      food +
      tileMoisture(tile) * 0.1 -
      d * 0.03 +
      (W.tiles.owner[tile] === place.factionId ? 0.5 : 0) +
      (W.tiles.liquid[tile] > 0 ? 0.3 : 0);
    if (s > score) {
      score = s;
      best = tile;
    }
  }
  if (best >= 0 && typeof civilReachable === "function") {
    const [tx, ty] = xy(best);
    if (!civilReachable(from, { x: tx, y: ty }, place.factionId || 0)) return -1;
  }
  return best;
}
function settlerUrge(place) {
  const f = W.factions.find((x) => x.id === place.factionId),
    pop = settlementPopulation(place),
    has = (t) => typeof polityHasTrait === "function" && polityHasTrait(f, t);
  return (
    0.04 +
    (f?.ethos?.expansionist || 0) * 0.12 +
    (has("Expansionist") ? 0.1 : 0) +
    (has("Colonizers") ? 0.05 : 0) +
    (pop >= 16 ? 0.08 : 0) +
    (pop >= 24 ? 0.08 : 0)
  );
}
function launchSettlers(place, force = false) {
  ensureExpansion();
  if (!place || place.ruined || !place.knownProcesses) return null;
  if (W.expeditions.some((e) => e.active && e.from === place.id)) return null;
  if (!force) {
    if (settlementPopulation(place) < 12 || (place.stability || 0) < 0.5) return null;
    if (W.tick - (place.lastSettlersTick || -99999) < SETTLER_COOLDOWN) return null;
    if (W.camps.filter((c) => c.active).length >= CAPS.camp) return null;
  }
  const target = settlerSite(place);
  if (target < 0) return null;
  const members = typeof caravanCandidates === "function" ? caravanCandidates(place, 4) : [];
  if (members.length < 3) return null;
  for (const id of members)
    resolveTransfer({
      fromType: "settlement",
      from: place.id,
      toType: "entity",
      to: id,
      amounts: [
        [C.ORGANIC, 8],
        [C.SOLVENT, 8],
      ],
    });
  const [tx, ty] = xy(target),
    expedition = {
      id: W.nextExpeditionId++,
      from: place.id,
      factionId: place.factionId || 0,
      members,
      target,
      startedTick: W.tick,
      active: true,
      eventId: 0,
    };
  W.expeditions.push(expedition);
  place.lastSettlersTick = W.tick;
  for (const id of members) issueCivilOrder(id, "settle", tx, ty, { expeditionId: expedition.id });
  const ev = emitEvent("ExpeditionEvent", {
    subjects: [...members.slice(0, 3), place.entityId],
    location: idx(place.x, place.y),
    factions: place.factionId ? [place.factionId] : [],
    causes: [W.causalIndex.tile[idx(place.x, place.y)] || 0].filter(Boolean),
    evidence: [
      `${members.length} settlers`,
      `${Math.round(Math.sqrt(dist2(place.x, place.y, tx, ty)))} tiles to the ${compassWord(tx - place.x, ty - place.y)}`,
    ],
    importance: 2,
    data: {
      place: place.name,
      settlers: members.length,
      direction: compassWord(tx - place.x, ty - place.y),
      distance: Math.round(Math.sqrt(dist2(place.x, place.y, tx, ty))),
    },
  });
  expedition.eventId = ev.id;
  return expedition;
}
function settlerLanding(target) {
  const ok = (t) =>
    W.tiles.liquid[t] <= WATER_DEPTH.SURFACE && W.tiles.fire[t] < 100 && !campNear(t, 5);
  if (ok(target)) return target;
  for (const n of neighbors4(target)) if (ok(n)) return n;
  return -1;
}
function updateSettlers() {
  ensureExpansion();
  for (const e of W.expeditions) {
    if (!e.active) continue;
    e.members = e.members.filter((id) => classifyAlive(id) && W.components.position[id]);
    const place = W.settlements.find((s) => s.id === e.from),
      [tx, ty] = xy(e.target);
    if (!e.members.length) {
      e.active = false;
      continue;
    }
    const arrived = e.members.filter((id) => {
      const p = W.components.position[id];
      return Math.max(Math.abs(p.x - tx), Math.abs(p.y - ty)) <= 2;
    });
    if (arrived.length >= Math.min(e.members.length, 2)) {
      for (const id of arrived) {
        const soc = W.components.social[id];
        if (soc) {
          soc.homePlaceKind = "";
          soc.homePlaceId = 0;
        }
      }
      const site = settlerLanding(e.target),
        camp = site >= 0 ? createCamp(site, arrived[0], e.eventId) : null;
      for (const id of e.members) clearCivilOrder(id);
      e.active = false;
      e.endedTick = W.tick;
      if (camp) {
        camp.settledFrom = e.from;
        e.campId = camp.id;
        emitEvent("SettlersEvent", {
          subjects: [...arrived.slice(0, 3), camp.entityId, ...(place ? [place.entityId] : [])],
          location: site,
          factions: e.factionId ? [e.factionId] : [],
          causes: [e.eventId, W.lastEventByType.CampFoundedEvent].filter(Boolean),
          evidence: [`${arrived.length} settlers`, "free land with food and water"],
          importance: 3,
          data: {
            place: place?.name || "a lost town",
            camp: camp.name,
            settlers: arrived.length,
            direction: place ? compassWord(tx - place.x, ty - place.y) : "",
          },
        });
        for (const id of arrived) W.components.identity[id].significance += 3;
      } else
        emitEvent("SettlersTurnedBackEvent", {
          subjects: [...arrived.slice(0, 2), ...(place ? [place.entityId] : [])],
          location: e.target,
          factions: e.factionId ? [e.factionId] : [],
          causes: [e.eventId].filter(Boolean),
          evidence: ["the site gave no footing"],
          importance: 2,
          data: { place: place?.name || "a lost town", reason: "the site gave no footing" },
        });
      continue;
    }
    if (W.tick - e.startedTick > 1600) {
      for (const id of e.members) clearCivilOrder(id);
      e.active = false;
      e.endedTick = W.tick;
      emitEvent("SettlersTurnedBackEvent", {
        subjects: [...e.members.slice(0, 2), ...(place ? [place.entityId] : [])],
        location: e.target,
        factions: e.factionId ? [e.factionId] : [],
        causes: [e.eventId].filter(Boolean),
        evidence: ["the road outlasted the provisions"],
        importance: 2,
        data: { place: place?.name || "a lost town", reason: "the road outlasted the provisions" },
      });
    }
  }
  if (W.expeditions.length > 40)
    W.expeditions = W.expeditions
      .filter((e) => e.active)
      .concat(W.expeditions.filter((e) => !e.active).slice(-12));
}
function considerSettlers() {
  const cycle = Math.floor(W.tick / 256);
  for (const place of W.settlements) {
    if (place.ruined || !place.knownProcesses) continue;
    if (counterRand("settlers", cycle, place.id) < settlerUrge(place)) launchSettlers(place);
  }
}
// ── Tick hook and reasons ──────────────────────────────────────────────────────
const updateWeatherCycleExpansionBase = updateWeatherCycle;
updateWeatherCycle = function () {
  updateWeatherCycleExpansionBase();
  if (!W?.settlements || !W.camps) return;
  ensureExpansion(W);
  if (W.tick % 16 === 9) updateSettlers();
  if (W.tick % 256 === 232) considerSettlers();
};
const chooseBehaviorExpansionBase = chooseBehavior;
chooseBehavior = function (id, tier) {
  chooseBehaviorExpansionBase(id, tier);
  const l = W.components.life[id];
  if (l?.behavior === "march" && civilOrderOf(id)?.kind === "settle")
    l.behaviorReason = "walking out to found a new camp";
};
// ── Chronicle and Legends ──────────────────────────────────────────────────────
const eventSentenceExpansionBase = eventSentence;
eventSentence = function (e) {
  const d = e.data || {};
  switch (e.type) {
    case "ExpeditionEvent":
      return `${d.settlers} settlers left ${d.place} for free land ${d.distance} tiles to the ${d.direction}.`;
    case "SettlersEvent":
      return `Settlers from ${d.place} raised the camp of ${d.camp}${d.direction ? ` to the ${d.direction}` : ""}.`;
    case "SettlersTurnedBackEvent":
      return `The settlers from ${d.place} turned back: ${d.reason}.`;
    default:
      return eventSentenceExpansionBase(e);
  }
};
function settledFromRow(entityId) {
  const camp = W.camps.find((c) => c.entityId === entityId && c.settledFrom),
    origin = camp ? W.settlements.find((s) => s.id === camp.settledFrom) : null;
  return origin
    ? `<div class="kv"><span>Settled from</span><b>${legendLink("place", origin.id, origin.name)}</b></div>`
    : "";
}
const renderPlacePageExpansionBase = renderPlacePage;
renderPlacePage = function (id) {
  const html = renderPlacePageExpansionBase(id),
    s = W.settlements.find((x) => x.id === id),
    row = s ? settledFromRow(s.entityId) : "";
  if (!row) return html;
  const at = html.indexOf('<div class="subhead">Chronicle</div>');
  return at < 0 ? html + row : html.slice(0, at) + row + html.slice(at);
};
const renderCampPageExpansionBase = renderCampPage;
renderCampPage = function (id) {
  const html = renderCampPageExpansionBase(id),
    c = W.camps.find((x) => x.id === id),
    row = c ? settledFromRow(c.entityId) : "";
  return row ? html + row : html;
};
window.ALIFE_EXPANSION_DEBUG = Object.freeze({
  caps: () => ({ ...CAPS }),
  scale: (w, h) => ({ ...scaleCaps(w, h) }),
  site: (settlementId) => settlerSite(W.settlements.find((s) => s.id === settlementId)),
  urge: (settlementId) => settlerUrge(W.settlements.find((s) => s.id === settlementId)),
  settle: (settlementId, force = true) =>
    launchSettlers(
      W.settlements.find((s) => s.id === settlementId),
      force,
    ),
  expeditions: () => (W.expeditions || []).map((e) => ({ ...e, members: e.members.slice() })),
  tick: () => updateSettlers(),
});
