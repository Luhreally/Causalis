// ═══════════════════════════════════════════════════════════════════════════
// 31. GOD TOOLS
// ═══════════════════════════════════════════════════════════════════════════
function brushTiles(center, radius = UI.brush) {
  const [cx, cy] = xy(center),
    out = [];
  for (let y = cy - radius; y <= cy + radius; y++)
    for (let x = cx - radius; x <= cx + radius; x++)
      if (inside(x, y) && dist2(x, y, cx, cy) <= radius * radius) out.push(idx(x, y));
  return out;
}
function recordIntervention(tool, tile, brush) {
  const def = TOOL_DEFS.find((t) => t[0] === tool || t[1] === tool),
    toolId = def?.[0] || tool,
    label = def?.[1] || tool,
    entry = {
      id: W.interventions.length + 1,
      tick: W.tick,
      tool: toolId,
      label,
      tile,
      brush,
      sequence: W.interventions.length,
    };
  W.interventions.push(entry);
  const ev = emitEvent("InterventionEvent", {
    location: tile,
    evidence: ["an external cause entered the deterministic world"],
    importance: toolId === "inspect" ? 0 : 2,
    data: { tool: toolId, label },
  });
  entry.eventId = ev.id;
  return ev;
}
function applyTool(tile) {
  if (tile < 0 || tile >= W.tileCount) return;
  if (UI.tool === "inspect") {
    selectTile(tile);
    return;
  }
  const def = TOOL_DEFS.find((t) => t[0] === UI.tool),
    cause = recordIntervention(def?.[1] || UI.tool, tile, UI.brush),
    tiles = brushTiles(tile),
    input = (n) => (W.conservation.playerInput += n),
    exportMatter = (n) => (W.conservation.exported += n);
  for (const i of tiles) {
    switch (UI.tool) {
      case "ignite":
        queueEffect("IgniteTile", { tile: i, intensity: 330, causeEvent: cause.id });
        break;
      case "lightning":
        queueEffect("ModifyField", { tile: i, field: "temperature", delta: 180 });
        queueEffect("IgniteTile", { tile: i, intensity: 620, causeEvent: cause.id });
        break;
      case "rain":
        queueEffect("ModifyField", { tile: i, chem: C.SOLVENT, delta: 120 });
        queueEffect("ModifyField", { tile: i, field: "liquid", delta: 18 });
        input(120);
        break;
      case "drought": {
        const loss = Math.min(W.tiles.chem[C.SOLVENT][i], 100);
        queueEffect("ModifyField", { tile: i, chem: C.SOLVENT, delta: -loss });
        exportMatter(loss);
        break;
      }
      case "bless":
        queueEffect("ModifyField", { tile: i, chem: C.NUTRIENT, delta: 140 });
        queueEffect("ModifyField", { tile: i, chem: C.CATALYST, delta: 35 });
        queueEffect("ModifyField", { tile: i, chem: C.SOLVENT, delta: 50 });
        input(225);
        break;
      case "blight": {
        const loss = Math.min(W.tiles.chem[C.NUTRIENT][i], 100);
        queueEffect("ModifyField", { tile: i, chem: C.NUTRIENT, delta: -loss });
        queueEffect("ModifyField", { tile: i, chem: C.TOXIN, delta: 45 });
        exportMatter(loss);
        input(45);
        break;
      }
      case "plants":
        queueEffect("ModifyField", { tile: i, chem: C.ORGANIC, delta: 90 });
        queueEffect("ModifyField", { tile: i, chem: C.ENERGY, delta: 60 });
        queueEffect("ModifyField", { tile: i, field: "plantOrder", delta: 180 });
        input(150);
        break;
      case "herbivore":
      case "predator":
      case "person":
        if (i === tile || counterRand("brush-spawn", W.tick, i, cause.id) < 0.22)
          queueEffect(
            "SpawnEntity",
            {
              kind:
                UI.tool === KINDS.HERBIVORE
                  ? KINDS.HERBIVORE
                  : UI.tool === KINDS.PREDATOR
                    ? KINDS.PREDATOR
                    : KINDS.PERSON,
              tile: i,
              divine: true,
              causes: [cause.id],
            },
            0,
          );
        break;
      case "disease":
        queueEffect("ModifyField", { tile: i, chem: C.PATHOGEN, delta: 85 });
        input(85);
        for (const id of W.spatialBins[i] || [])
          queueEffect("InfectEntity", { entityId: id, amount: 22, causeEvent: cause.id });
        break;
      case "heal":
        for (const id of W.spatialBins[i] || []) {
          if (!classifyAlive(id)) continue;
          const q = W.components.chemistry[id].q;
          let added = 0;
          for (const [sp, requested] of [
            [C.ENERGY, 20],
            [C.NUTRIENT, 12],
            [C.ORGANIC, 12],
          ]) {
            const moved = Math.min(requested, 65535 - q[sp]);
            q[sp] += moved;
            added += moved;
          }
          input(added);
          executeProcess("healing", invEntity(id), 8);
        }
        break;
      case "erase":
        for (const id of (W.spatialBins[i] || []).slice())
          if (classifyAlive(id))
            queueEffect("DestroyEntity", {
              entityId: id,
              cause: "divine regulatory cessation",
              causeEvent: cause.id,
              erase: false,
            });
        break;
      case "raise":
        queueEffect("ModifyField", { tile: i, field: "elevation", delta: 35 });
        queueEffect("ModifyField", { tile: i, chem: C.MINERAL, delta: 80 });
        input(80);
        break;
      case "lower": {
        queueEffect("ModifyField", { tile: i, field: "elevation", delta: -35 });
        const loss = Math.min(80, W.tiles.chem[C.MINERAL][i]);
        queueEffect("ModifyField", { tile: i, chem: C.MINERAL, delta: -loss });
        exportMatter(loss);
        break;
      }
      case "water":
        queueEffect("ModifyField", { tile: i, chem: C.SOLVENT, delta: 180 });
        queueEffect("ModifyField", { tile: i, field: "liquid", delta: 90 });
        input(180);
        break;
      case "resources":
        queueEffect("ModifyField", { tile: i, chem: C.ORE, delta: 180 });
        queueEffect("ModifyField", { tile: i, chem: C.CATALYST, delta: 60 });
        queueEffect("ModifyField", { tile: i, chem: C.FUEL, delta: 80 });
        input(320);
        break;
      case "claim": {
        const f = nearestFaction(i);
        if (f)
          queueEffect("ChangeOwnership", {
            tile: i,
            radius: Math.max(1, UI.brush),
            factionId: f.id,
            pressure: 850,
          });
        break;
      }
      case "disaster":
        queueEffect("ModifyField", { tile: i, chem: C.TOXIN, delta: 120 });
        queueEffect("ModifyField", { tile: i, field: "danger", delta: 400 });
        queueEffect("DamageStructure", { tile: i, amount: 120 });
        if (counterRand("disaster-fire", W.tick, i) < 0.35)
          queueEffect("IgniteTile", { tile: i, intensity: 480, causeEvent: cause.id });
        input(120);
        break;
    }
  }
  if (UI.tool === "rain")
    queueEffect("ApplyWeather", { weather: "Rain", intensity: 1.2, causeEvent: cause.id });
  if (UI.tool === "drought")
    queueEffect("ApplyWeather", { weather: "Drought", intensity: 1.1, causeEvent: cause.id });
  if (UI.tool === "faction") {
    const s = nearestSettlement(tile, 10);
    if (s) queueEffect("CreateFaction", { settlementId: s.id, tile, causeEvent: cause.id });
    else toast("A persistent settlement is required to organize a faction.", "warn");
  }
  if (UI.tool === "disaster")
    emitEvent("DisasterEvent", {
      location: tile,
      causes: [cause.id],
      evidence: ["external structural shock", "toxic matter influx"],
      magnitude: UI.brush,
      importance: 4,
      data: { name: "The Falling Ember" },
    });
  resolveEffects();
  rebuildSpatialBins();
  selectTile(tile);
  worldHash();
  refreshUI(true);
  audioClick(UI.tool === "disaster" ? 90 : 220);
}
function nearestFaction(tile) {
  const [x, y] = xy(tile);
  let best = null,
    bd = Infinity;
  for (const f of W.factions) {
    const s = W.settlements.find((q) => q.id === f.capitalSettlementId);
    if (!s) continue;
    const d = dist2(x, y, s.x, s.y);
    if (d < bd) {
      bd = d;
      best = f;
    }
  }
  return best;
}
