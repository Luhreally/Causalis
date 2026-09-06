// ═══════════════════════════════════════════════════════════════════════════
// 72. NAVAL WARFARE — sea battles and blockades
// ═══════════════════════════════════════════════════════════════════════════
// Docks made the coast a place of fishing and voyages; here they make it a
// front. When two polities at war both hold docks, their boats meet: the side
// with more docks, more fighters, and the sea in its blood wins, the loser's
// dock is battered, and the winner's boats sit off the loser's coast in a
// blockade that stops fishing and voyages, sours the town, and lasts until the
// war ends, the boats are recalled, or the blockader loses its own docks. Sea
// battles and blockades are chronicled and drawn as hulls riding off the
// blockaded shore. Rendering only reads the world.
const BLOCKADE_LENGTH = 320,
  SEA_BATTLE_CHANCE = 0.2,
  SEA_BATTLE_REST = 384;
function ensureNaval(world = W) {
  if (!world) return;
  world.naval = world.naval || { lastEventId: 0, blockades: [], battles: 0, nextId: 1 };
}
const restoreWorldNavalBase = restoreWorldDefaults;
restoreWorldDefaults = function () {
  restoreWorldNavalBase();
  ensureNaval(W);
};
function factionDocks(f) {
  const towns = W.settlements.filter((s) => !s.ruined && s.factionId === f.id);
  return W.buildings.filter(
    (b) =>
      b.type === "dock" &&
      b.complete &&
      !b.ruined &&
      b.placeKind === "settlement" &&
      towns.some((s) => s.id === b.placeId),
  );
}
function navalStrength(f, docks) {
  const fighters = typeof factionFieldableFighters === "function" ? factionFieldableFighters(f) : 2,
    seafarers = typeof polityHasTrait === "function" && polityHasTrait(f, "Seafarers") ? 1.5 : 1;
  return (
    (docks.length * 2 + Math.min(12, fighters) * 0.5 + (f.militaryStrength || 0) * 0.1) *
    seafarers *
    (0.6 + (f.cohesion || 0.5))
  );
}
function blockadeOf(place) {
  return (W.naval?.blockades || []).find((b) => b.active && b.placeId === place?.id) || null;
}
function blockadesBy(f) {
  return (W.naval?.blockades || []).filter((b) => b.active && b.byFactionId === f.id);
}
function establishBlockade(winner, loser, dock, war, cause) {
  const place = W.settlements.find((s) => s.id === dock.placeId);
  if (!place) return null;
  let blockade = blockadeOf(place);
  if (blockade && blockade.byFactionId === winner.id) {
    blockade.until = W.tick + BLOCKADE_LENGTH;
    return blockade;
  }
  if (blockade) blockade.active = false;
  blockade = {
    id: W.naval.nextId++,
    byFactionId: winner.id,
    factionId: loser.id,
    placeId: place.id,
    dockId: dock.id,
    warId: war.id,
    startedTick: W.tick,
    until: W.tick + BLOCKADE_LENGTH,
    active: true,
  };
  W.naval.blockades.push(blockade);
  emitEvent("BlockadeEvent", {
    subjects: [place.entityId],
    location: idx(dock.x, dock.y),
    factions: [winner.id, loser.id],
    causes: [cause, war.startEventId].filter(Boolean),
    evidence: [`${winner.name} held the water off ${place.name}`],
    importance: 3,
    data: { by: winner.name, place: place.name, polity: loser.name },
  });
  return blockade;
}
function liftBlockade(blockade, reason) {
  if (!blockade.active) return;
  blockade.active = false;
  blockade.endedTick = W.tick;
  const place = W.settlements.find((s) => s.id === blockade.placeId),
    by = W.factions.find((f) => f.id === blockade.byFactionId);
  emitEvent("BlockadeLiftedEvent", {
    subjects: place ? [place.entityId] : [],
    location: place ? idx(place.x, place.y) : -1,
    factions: [blockade.byFactionId, blockade.factionId],
    causes: [W.lastEventByType.WarEndedEvent, W.lastEventByType.BlockadeEvent].filter(Boolean),
    evidence: [reason],
    importance: 2,
    data: { by: by?.name || "a lost polity", place: place?.name || "a lost town", reason },
  });
}
function seaBattle(war, a, b) {
  ensureNaval();
  const docksA = factionDocks(a),
    docksB = factionDocks(b);
  if (!docksA.length || !docksB.length) return null;
  const sa = navalStrength(a, docksA),
    sb = navalStrength(b, docksB),
    swing = (counterRand("sea-battle", war.id, W.tick) - 0.5) * 0.6 * Math.max(sa, sb),
    winner = sa + swing >= sb ? a : b,
    loser = winner === a ? b : a,
    loserDocks = winner === a ? docksB : docksA,
    dock = loserDocks.sort((x, y) => x.integrity - y.integrity || x.id - y.id)[0],
    place = W.settlements.find((s) => s.id === dock.placeId),
    lost = 1 + Math.floor(counterRand("sea-battle-lost", war.id, W.tick) * 3),
    ev = emitEvent("SeaBattleEvent", {
      subjects: [winner.leaderId, loser.leaderId, place?.entityId].filter(Boolean),
      location: idx(dock.x, dock.y),
      factions: [winner.id, loser.id],
      causes: [war.startEventId, war.holyEventId || 0].filter(Boolean),
      evidence: [
        `${docksA.length} docks against ${docksB.length}`,
        `${lost} boat${lost === 1 ? "" : "s"} of ${loser.name} went under`,
      ],
      importance: 4,
      data: {
        winner: winner.name,
        loser: loser.name,
        place: place?.name || "a lost shore",
        boats: lost,
      },
    });
  W.naval.battles++;
  war.seaBattles = (war.seaBattles || 0) + 1;
  war.lastSeaBattleTick = W.tick;
  war.casualties = (war.casualties || 0) + lost;
  war.lastEventId = ev.id;
  damageBuildingDirect(dock, 40 + lost * 30, "boats broke against the pier in a sea battle", ev.id);
  if (place) establishBlockade(winner, loser, dock, war, ev.id);
  return ev;
}
function updateNaval() {
  ensureNaval();
  for (const war of W.activeWars) {
    if (war.ended) continue;
    const a = W.factions.find((f) => f.id === war.a),
      b = W.factions.find((f) => f.id === war.b);
    if (!a || !b) continue;
    if (W.tick - (war.lastSeaBattleTick || -99999) < SEA_BATTLE_REST) continue;
    if (counterRand("sea-battle-roll", war.id, Math.floor(W.tick / 128)) < SEA_BATTLE_CHANCE)
      seaBattle(war, a, b);
  }
  for (const blockade of W.naval.blockades) {
    if (!blockade.active) continue;
    const war = W.activeWars.find((w) => w.id === blockade.warId),
      by = W.factions.find((f) => f.id === blockade.byFactionId),
      place = W.settlements.find((s) => s.id === blockade.placeId);
    if (!war || war.ended) liftBlockade(blockade, "the war ended");
    else if (!by || by.stability <= 0 || !factionDocks(by).length)
      liftBlockade(blockade, "the blockaders lost their own docks");
    else if (!place || place.ruined) liftBlockade(blockade, "there was nothing left to blockade");
    else if (W.tick > blockade.until) liftBlockade(blockade, "the boats were recalled");
  }
  if (W.naval.blockades.length > 40)
    W.naval.blockades = W.naval.blockades
      .filter((b) => b.active)
      .concat(W.naval.blockades.filter((b) => !b.active).slice(-12));
}
const updateWeatherCycleNavalBase = updateWeatherCycle;
updateWeatherCycle = function () {
  updateWeatherCycleNavalBase();
  if (!W?.activeWars || !W.buildings) return;
  ensureNaval(W);
  if (W.tick % 128 === 88) updateNaval();
};
// ── What a blockade stops ──────────────────────────────────────────────────────
const startFishingNavalBase = startFishing;
startFishing = function (place) {
  if (blockadeOf(place)) return [];
  return startFishingNavalBase(place);
};
const launchVoyageNavalBase = launchVoyage;
launchVoyage = function (place, force = false) {
  if (!force && blockadeOf(place)) return null;
  return launchVoyageNavalBase(place, force);
};
const unrestOfNavalBase = unrestOf;
unrestOf = function (place) {
  return unrestOfNavalBase(place) + (blockadeOf(place) ? 0.08 : 0);
};
// ── Chronicle, songs, Legends ──────────────────────────────────────────────────
const eventSentenceNavalBase = eventSentence;
eventSentence = function (e) {
  const d = e.data || {};
  switch (e.type) {
    case "SeaBattleEvent":
      return `The boats of ${d.winner} beat the boats of ${d.loser} off ${d.place}; ${d.boats} went under.`;
    case "BlockadeEvent":
      return `${d.by} blockaded ${d.place} of ${d.polity}; no boat could fish or sail.`;
    case "BlockadeLiftedEvent":
      return `The blockade of ${d.place} by ${d.by} was lifted: ${d.reason}.`;
    default:
      return eventSentenceNavalBase(e);
  }
};
const songTitleForNavalBase = songTitleFor;
songTitleFor = function (event) {
  const d = event.data || {};
  if (event.type === "SeaBattleEvent") return { kind: "song", title: `The Boats Off ${d.place}` };
  return songTitleForNavalBase(event);
};
const renderPlacePageNavalBase = renderPlacePage;
renderPlacePage = function (id) {
  const html = renderPlacePageNavalBase(id),
    s = W.settlements.find((x) => x.id === id),
    blockade = s ? blockadeOf(s) : null;
  if (!blockade) return html;
  const by = W.factions.find((f) => f.id === blockade.byFactionId),
    row = `<div class="kv"><span>Blockaded</span><b>by ${by ? legendLink("faction", by.id, by.name) : "a lost polity"} since year ${formatYear(blockade.startedTick)}</b></div>`,
    at = html.indexOf('<div class="subhead">Chronicle</div>');
  return at < 0 ? html + row : html.slice(0, at) + row + html.slice(at);
};
const renderWarPageNavalBase = renderWarPage;
renderWarPage = function (id) {
  const html = renderWarPageNavalBase(id),
    war = W.activeWars.find((w) => w.id === id);
  if (!war || !(war.seaBattles || war.holy)) return html;
  const rows = `${war.holy ? `<div class="kv"><span>Holy war</span><b>fought in a god's name</b></div>` : ""}${
      war.seaBattles ? `<div class="kv"><span>Sea battles</span><b>${war.seaBattles}</b></div>` : ""
    }`,
    at = html.indexOf('<div class="subhead">');
  return at < 0 ? html + rows : html.slice(0, at) + rows + html.slice(at);
};
// ── Hulls off a blockaded shore ────────────────────────────────────────────────
const drawWorkerActivityNavalBase = drawWorkerActivity;
drawWorkerActivity = function (now, bounds) {
  drawWorkerActivityNavalBase(now, bounds);
  const live = (W?.naval?.blockades || []).filter((b) => b.active);
  if (!live.length || UI.quality === "low" || UI.camera.zoom < 1.2) return;
  const m = ACTIVE_RENDER_METRICS || projectionMetrics(),
    still = ACTIVE_REDUCED_MOTION;
  ctx.save();
  for (const blockade of live) {
    const dock = W.buildings.find((b) => b.id === blockade.dockId);
    if (!dock) continue;
    const by = W.factions.find((f) => f.id === blockade.byFactionId),
      hue = (blockade.byFactionId * 67) % 360;
    for (let k = 0; k < 3; k++) {
      const angle = (k / 3) * Math.PI * 2 + blockade.id,
        r = 3.2 + (k % 2) * 0.8,
        tx = dock.x + Math.cos(angle) * r,
        ty = dock.y + Math.sin(angle) * r,
        tile = inside(Math.round(tx), Math.round(ty)) ? idx(Math.round(tx), Math.round(ty)) : -1;
      if (tile < 0 || W.tiles.liquid[tile] <= WATER_DEPTH.SURFACE) continue;
      const p = proceduralProjectTile(tx + 0.5, ty + 0.5, m),
        bob = still ? 0 : Math.sin(now * 0.002 + k * 1.7 + blockade.id) * m.th * 0.08,
        w = m.tw * 0.7;
      ctx.fillStyle = by?.color || hsl(hue, 45, 32);
      ctx.strokeStyle = hsl(hue, 40, 18);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x - w, p.y + bob);
      ctx.quadraticCurveTo(p.x, p.y + bob + m.th * 0.45, p.x + w, p.y + bob);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = hsl(hue, 50, 70, 0.9);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y + bob);
      ctx.lineTo(p.x, p.y + bob - m.th * 0.9);
      ctx.stroke();
      ctx.fillStyle = hsl(hue, 60, 60, 0.85);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y + bob - m.th * 0.9);
      ctx.lineTo(p.x + w * 0.6, p.y + bob - m.th * 0.6);
      ctx.lineTo(p.x, p.y + bob - m.th * 0.35);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
};
window.ALIFE_NAVAL_DEBUG = Object.freeze({
  update: () => updateNaval(),
  battle: (warId) => {
    const war = W.activeWars.find((w) => w.id === warId);
    if (!war) return null;
    return seaBattle(
      war,
      W.factions.find((f) => f.id === war.a),
      W.factions.find((f) => f.id === war.b),
    );
  },
  blockades: () => (W.naval?.blockades || []).map((b) => ({ ...b })),
  blockaded: (settlementId) => blockadeOf(W.settlements.find((s) => s.id === settlementId)),
  docks: (factionId) => factionDocks(W.factions.find((f) => f.id === factionId)).length,
});
