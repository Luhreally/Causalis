// ═══════════════════════════════════════════════════════════════════════════
// 14. EFFECT QUEUE AND EFFECT RESOLVER
// ═══════════════════════════════════════════════════════════════════════════
const EFFECT_PRIORITY = Object.freeze({
  ApplyWeather: 1,
  ModifyField: 2,
  IgniteTile: 3,
  TransferResource: 4,
  MoveEntity: 5,
  DamageStructure: 6,
  InfectEntity: 7,
  ModifyComponent: 8,
  SpawnEntity: 9,
  DestroyEntity: 10,
  AddRelation: 11,
  RemoveRelation: 12,
  CreateCamp: 13,
  CreateSettlement: 14,
  CreateFaction: 15,
  ChangeOwnership: 16,
  CreateArtifact: 17,
  EmitEvent: 18,
});
function queueEffect(type, data = {}, source = 0) {
  W.effects.push({
    type,
    data,
    source,
    priority: EFFECT_PRIORITY[type] || 50,
    seq: ++W.effectSequence,
    target: data.target || data.entityId || data.tile || 0,
  });
}
function resolveEffects() {
  if (!W.effects.length) return;
  const queue = W.effects
    .splice(0)
    .sort(
      (a, b) =>
        a.priority - b.priority || a.target - b.target || a.source - b.source || a.seq - b.seq,
    );
  for (const e of queue) {
    const d = e.data;
    switch (e.type) {
      case "ModifyField": {
        const delta = Number(d.delta);
        if (!Number.isFinite(delta)) break;
        if (d.chem != null)
          setTileMatterAmount(d.tile, d.chem, tileMatterAmount(d.tile, d.chem) + delta);
        else if (W.tiles[d.field])
          W.tiles[d.field][d.tile] =
            d.field === "temperature"
              ? i16(W.tiles[d.field][d.tile] + delta)
              : u16(W.tiles[d.field][d.tile] + delta);
        break;
      }
      case "ModifyComponent": {
        const c = W.components[d.store]?.[d.entityId];
        if (c) c[d.key] = typeof c[d.key] === "number" ? c[d.key] + d.delta : d.value;
        break;
      }
      case "TransferResource":
        resolveTransfer(d);
        break;
      case "MoveEntity": {
        const p = W.components.position[d.entityId];
        if (p && inside(d.x, d.y)) {
          let nx = d.x,
            ny = d.y;
          const kind = W.kind[d.entityId];
          if (
            !d.forced &&
            (kind === KINDS.PERSON || kind === KINDS.HERBIVORE || kind === KINDS.PREDATOR) &&
            (Math.abs(nx - p.x) > 1 || Math.abs(ny - p.y) > 1) &&
            W.tiles.liquid &&
            (W.tiles.liquid[idx(nx, ny)] > 420 || W.tiles.liquid[idx(p.x, p.y)] > 420)
          ) {
            const boat =
              kind === KINDS.PERSON &&
              !!(
                W.components.social[d.entityId]?.factionId &&
                factionHasTech(W.components.social[d.entityId].factionId, "navigation")
              );
            if (!boat) {
              nx = clamp(p.x + Math.sign(nx - p.x), 0, W.width - 1);
              ny = clamp(p.y + Math.sign(ny - p.y), 0, W.height - 1);
            }
          }
          p.x = nx;
          p.y = ny;
          p.regionId = regionId(nx, ny);
        }
        break;
      }
      case "SpawnEntity":
        resolveSpawn(d, e.source, e.seq);
        break;
      case "DestroyEntity":
        killEntity(d.entityId, d.cause || "regulatory collapse", d.causeEvent || 0, d.erase);
        break;
      case "AddRelation":
        addRelation(d.from, d.to, d.relation, d.weight ?? 1, d.eventId || 0);
        break;
      case "RemoveRelation":
        removeRelation(d.from, d.to, d.relation);
        break;
      case "EmitEvent":
        emitEvent(d.eventType, d.payload || {});
        break;
      case "CreateCamp":
        createCamp(d.tile, d.founderId, d.causeEvent || 0);
        break;
      case "CreateSettlement":
        createSettlement(d.campId, d.causeEvent || 0);
        break;
      case "CreateFaction":
        createFaction(d.settlementId, d.tile, d.causeEvent || 0);
        break;
      case "ChangeOwnership":
        applyOwnership(d);
        break;
      case "DamageStructure":
        damageAt(d);
        break;
      case "InfectEntity":
        if ((d.amount ?? 30) > 0) infectEntity(d.entityId, d.amount ?? 30, d.causeEvent || 0);
        break;
      case "IgniteTile":
        if ((d.intensity ?? 300) > 0)
          igniteTile(d.tile, d.intensity ?? 300, d.causeEvent || 0, d.origin);
        break;
      case "ApplyWeather":
        setWeather(d.weather, d.intensity ?? 1, d.causeEvent || 0);
        break;
      case "CreateArtifact":
        createArtifact(d.settlementId, d.creatorId, d.causeEvent || 0);
        break;
    }
  }
}
function resolveTransfer(d) {
  const endpoint = (type, id) => {
      if (type === "tile") return id >= 0 && id < W.tileCount ? invTile(id) : null;
      if (type === "entity") return W.components.chemistry[id] ? invEntity(id) : null;
      if (type === "settlement") {
        const settlement = W.settlements.find((s) => s.id === id && !s.ruined);
        return settlement ? invSettlement(settlement) : null;
      }
      return null;
    },
    source = endpoint(d.fromType, d.from),
    target = endpoint(d.toType, d.to);
  if (!source || !target || !Array.isArray(d.amounts)) return 0;
  let moved = 0;
  for (const [sp, amount] of d.amounts) {
    if (!Number.isInteger(sp) || sp < 0 || sp >= SPECIES_COUNT) continue;
    const requested = Math.max(0, Math.floor(Number(amount) || 0));
    const capacity = target.capacity ? target.capacity(sp) : 65535;
    const actual = Math.min(requested, source.get(sp), capacity - target.get(sp));
    if (actual > 0) {
      source.set(sp, source.get(sp) - actual);
      target.set(sp, target.get(sp) + actual);
      moved += actual;
    }
  }
  return moved;
}
function resolveSpawn(d, source, seq) {
  const [x, y] = xy(d.tile),
    r = makeRng(hashParts(W.seedHash, W.tick, d.tile, d.kind, source, seq), "effect-spawn"),
    id = createOrganism(d.kind, x, y, r, d.parents || [], d.tile, d.divine ? 1 : 0),
    ev = emitEvent(d.parents?.length ? "BirthEvent" : "AbiogenesisEvent", {
      subjects: [id, ...(d.parents || [])],
      location: d.tile,
      causes: d.causes || [],
      evidence: [
        d.divine ? "player-introduced matter packet" : "bounded autocatalytic replication",
      ],
      importance: d.kind === KINDS.PERSON ? 2 : 1,
    });
  W.components.identity[id].birthEventId = ev.id;
  for (const p of d.parents || []) {
    W.components.identity[p]?.children.push(id);
    linkKin(p, id, ev.id);
  }
  return id;
}
function paintOwnership(d) {
  if (d.tiles) {
    for (const tile of d.tiles)
      paintOwnership({ tile, radius: 0, factionId: d.factionId, pressure: d.pressure });
    return;
  }
  const [cx, cy] = xy(d.tile),
    r = d.radius ?? 1;
  for (let y = cy - r; y <= cy + r; y++)
    for (let x = cx - r; x <= cx + r; x++)
      if (inside(x, y) && dist2(x, y, cx, cy) <= r * r) {
        const i = idx(x, y);
        W.tiles.owner[i] = d.factionId;
        W.tiles.territory[i] = u16(Math.max(W.tiles.territory[i], d.pressure || 700));
      }
}
function applyOwnership(d) {
  let claim = W.divineClaims.at(-1);
  if (!claim || claim.tick !== W.tick || claim.factionId !== d.factionId) {
    claim = {
      id: W.divineClaims.length + 1,
      tick: W.tick,
      tiles: [],
      factionId: d.factionId,
      pressure: d.pressure || 700,
    };
    W.divineClaims.push(claim);
  }
  if (!claim.tiles.includes(d.tile)) claim.tiles.push(d.tile);
  paintOwnership({ tile: d.tile, radius: 0, factionId: d.factionId, pressure: d.pressure });
}
function damageAt(d) {
  const amount = Math.max(0, Number(d.amount ?? 20) || 0);
  if (!amount) return;
  if (d.entityId) {
    const l = W.components.life[d.entityId];
    if (l) {
      l.integrity = u16(l.integrity - amount);
      if (W.components.identity[d.entityId]) W.components.identity[d.entityId].injuries++;
      if (l.integrity < 1)
        killEntity(d.entityId, d.cause || "traumatic structural failure", d.causeEvent || 0);
    }
  }
  if (d.settlementId) {
    const s = W.settlements.find((x) => x.id === d.settlementId);
    if (s) s.structure.integrity = u16(s.structure.integrity - amount);
  }
  if (d.tile != null) {
    W.tiles.structureOrder[d.tile] = u16(W.tiles.structureOrder[d.tile] - amount);
    W.tiles.soilOrder[d.tile] = u16(W.tiles.soilOrder[d.tile] - Math.ceil(amount * 0.4));
    for (const s of W.settlements)
      if (idx(s.x, s.y) === d.tile) s.structure.integrity = u16(s.structure.integrity - amount);
  }
}
