// ═══════════════════════════════════════════════════════════════════════════
// 25. CAMPS, SETTLEMENTS, AND CONSTRUCTION
// ═══════════════════════════════════════════════════════════════════════════
function campNear(tile, r = 5) {
  const [x, y] = xy(tile);
  return W.camps.find((c) => c.active && dist2(x, y, c.x, c.y) <= r * r);
}
function settlementNear(tile, r = 6) {
  const [x, y] = xy(tile);
  return W.settlements.find((s) => !s.ruined && dist2(x, y, s.x, s.y) <= r * r);
}
function nearestSettlement(tile, r = Infinity) {
  const [x, y] = xy(tile);
  let best = null,
    bd = r * r;
  for (const s of W.settlements)
    if (!s.ruined) {
      const d = dist2(x, y, s.x, s.y);
      if (d <= bd) {
        bd = d;
        best = s;
      }
    }
  return best;
}
function createCamp(tile, founderId, cause = 0) {
  if (W.camps.filter((c) => c.active).length >= CAPS.camp || campNear(tile, 5)) return null;
  const [x, y] = xy(tile),
    id = allocEntity(KINDS.CAMP),
    r = makeRng(hashParts(W.seedHash, tile, W.tick), "camp-name"),
    name = `${NAME_B[r.int(NAME_B.length)]}${["rest", "hearth", "hold", "camp"][r.int(4)]}`,
    inventory = new Uint16Array(SPECIES_COUNT),
    structureQ = new Uint16Array(SPECIES_COUNT);
  for (const sp of [C.ORGANIC, C.MINERAL, C.SOLVENT]) {
    const amount = Math.min(W.tiles.chem[sp][tile], sp === C.SOLVENT ? 80 : 30);
    W.tiles.chem[sp][tile] -= amount;
    inventory[sp] += amount;
  }
  const fiberRaw = Math.min(30, W.tiles.chem[C.ORGANIC][tile]);
  W.tiles.chem[C.ORGANIC][tile] -= fiberRaw;
  inventory[C.ORGANIC] += fiberRaw;
  executeProcess("fiber_curing", invArray(inventory), fiberRaw);
  const camp = {
    id: W.camps.length + 1,
    entityId: id,
    name,
    x,
    y,
    founderId,
    factionId: W.components.social[founderId]?.factionId || 0,
    inventory,
    structure: { patternId: 12, order: 300, integrity: 460, composition: structureQ },
    foundedTick: W.tick,
    active: true,
    stableTicks: 0,
    lastOccupied: W.tick,
  };
  W.camps.push(camp);
  W.components.position[id] = { x, y, layer: 0, regionId: regionId(x, y) };
  W.components.identity[id] = { generatedName: name, significance: 2, notable: false, titles: [] };
  const ev = emitEvent("CampFoundedEvent", {
    subjects: [founderId, id],
    location: tile,
    causes: [cause],
    evidence: ["repeated habitation", "potable solvent", "metabolizable matter", "social cohesion"],
    importance: 2,
    data: { name },
  });
  addRelation(founderId, id, "founded", 1, ev.id);
  W.components.identity[founderId].settlementsFounded.push(id);
  W.tiles.culture[tile] = u16(W.tiles.culture[tile] + 250);
  return camp;
}
const createCampHomeBase = createCamp;
createCamp = function (tile, founderId, cause = 0) {
  const social = W.components.social[founderId],
    existing =
      social?.homePlaceKind === "camp"
        ? W.camps.find((c) => c.id === social.homePlaceId && c.active)
        : social?.homePlaceKind === "settlement"
          ? W.settlements.find((s) => s.id === social.homePlaceId && !s.ruined)
          : null;
  if (existing) return null;
  const camp = createCampHomeBase(tile, founderId, cause);
  if (camp) {
    for (const id of entityAtRadius(tile, 6, KINDS.PERSON).filter(classifyAlive)) {
      const member = W.components.social[id],
        prior =
          member?.homePlaceKind === "camp"
            ? W.camps.find((c) => c.id === member.homePlaceId && c.active)
            : member?.homePlaceKind === "settlement"
              ? W.settlements.find((s) => s.id === member.homePlaceId && !s.ruined)
              : null;
      if (prior) continue;
      member.homePlaceKind = "camp";
      member.homePlaceId = camp.id;
    }
  }
  return camp;
};
function createSettlement(campId, cause = 0) {
  const camp = W.camps.find((c) => c.id === campId && c.active);
  if (!camp || W.settlements.filter((s) => !s.ruined).length >= CAPS.settlement) return null;
  camp.active = false;
  W.kind[camp.entityId] = KINDS.SETTLEMENT;
  const r = makeRng(hashParts(W.seedHash, camp.id, W.tick), "settlement-name"),
    name = `${NAME_B[r.int(NAME_B.length)]}${["watch", "hollow", "reach", "haven", "ford", "spire"][r.int(6)]}`,
    composition = camp.structure.composition;
  for (const sp of [C.MINERAL, C.ORGANIC]) {
    const amount = Math.min(camp.inventory[sp], 20);
    camp.inventory[sp] -= amount;
    composition[sp] += amount;
  }
  const inventory = camp.inventory.slice(),
    structureComposition = composition.slice();
  camp.inventory.fill(0);
  camp.structure.composition.fill(0);
  const s = {
    id: W.settlements.length + 1,
    entityId: camp.entityId,
    name,
    x: camp.x,
    y: camp.y,
    founderId: camp.founderId,
    factionId: camp.factionId,
    cultureId: 0,
    inventory,
    structure: { patternId: 12, order: 460, integrity: 650, composition: structureComposition },
    housing: 8,
    storageCapacity: 300,
    stability: 0.68,
    defense: 0,
    knownProcesses: [],
    observations: [],
    foundedTick: W.tick,
    heat: 0,
    productionTemperature: 20,
    outbreakActive: 0,
    importantEvents: [],
    ruined: false,
  };
  W.settlements.push(s);
  W.components.identity[s.entityId].generatedName = name;
  const ev = emitEvent("SettlementFoundedEvent", {
    subjects: [s.founderId, s.entityId],
    location: idx(s.x, s.y),
    causes: [cause, W.lastEventByType.CampFoundedEvent],
    evidence: ["camp persisted", "material stores supported permanent structure"],
    importance: 4,
    data: { name },
  });
  s.importantEvents.push(ev.id);
  addRelation(s.founderId, s.entityId, "founded", 1, ev.id);
  return s;
}
function settlementPopulation(s) {
  let n = 0;
  for (const id of W.activeIds) {
    if (W.kind[id] !== KINDS.PERSON) continue;
    const p = W.components.position[id];
    if (p && dist2(p.x, p.y, s.x, s.y) <= 49) n++;
  }
  const localRegion = regionId(s.x, s.y);
  for (const c of W.cohorts)
    if (c.kind === KINDS.PERSON && c.regionId === localRegion) n += c.count;
  return n;
}
function settlementFood(s) {
  return clamp(
    (s.inventory[C.ORGANIC] * 0.35 + s.inventory[C.ENERGY] * 0.8 - s.inventory[C.TOXIN] * 0.5) /
      (1 + settlementPopulation(s) * 0.12),
    0,
    999,
  );
}
function settlementWater(s) {
  return clamp(
    (s.inventory[C.SOLVENT] - s.inventory[C.TOXIN] * 0.3) / (1 + settlementPopulation(s) * 0.08),
    0,
    999,
  );
}
function settlementDefense(s) {
  const c = s.structure.composition,
    material = c[C.MINERAL] + c[C.FIBER] * 0.7 + c[C.METAL] * 1.8 + c[C.CERAMIC] * 1.3,
    fort = s.knownProcesses.includes("fortification") ? 1.45 : 1;
  return clamp(((material * s.structure.integrity) / 70000) * fort, 0, 100);
}
function ruinSettlement(s, causes = [], evidence = "structural material failed") {
  if (!s || s.ruined) return null;
  s.ruined = true;
  W.kind[s.entityId] = "ruin";
  const ti = idx(s.x, s.y),
    ev = emitEvent("SettlementDestroyedEvent", {
      subjects: [s.entityId],
      location: ti,
      factions: [s.factionId],
      causes: Array.isArray(causes) ? causes : [causes],
      evidence: [evidence],
      importance: 4,
      data: { name: s.name },
    });
  s.importantEvents.push(ev.id);
  W.tiles.danger[ti] = u16(W.tiles.danger[ti] + 180);
  return ev;
}
function updateSettlements() {
  assignPartners();
  const candidates = [];
  for (const id of W.activeIds)
    if (W.kind[id] === KINDS.PERSON && classifyAlive(id)) {
      const p = W.components.position[id],
        ti = idx(p.x, p.y);
      W.tiles.habitation[ti] = u16(W.tiles.habitation[ti] + 12);
      if (W.tiles.habitation[ti] > 380 && !campNear(ti, 5) && !settlementNear(ti, 6))
        candidates.push({
          id,
          tile: ti,
          score:
            W.tiles.habitation[ti] +
            tileFood(ti, "omnivore") * 8 +
            tileMoisture(ti) * 5 -
            W.tiles.danger[ti],
        });
    }
  candidates.sort((a, b) => b.score - a.score || a.id - b.id);
  for (const c of candidates.slice(0, 2)) {
    const local = entityAtRadius(c.tile, 3, KINDS.PERSON);
    if (
      local.length >= 4 &&
      socialCohesionAt(c.tile) > 0.32 &&
      tileMoisture(c.tile) > 22 &&
      tileFood(c.tile, "omnivore") > 8
    )
      queueEffect(
        "CreateCamp",
        { tile: c.tile, founderId: c.id, causeEvent: W.causalIndex.tile[c.tile] || 0 },
        c.id,
      );
  }
  for (const c of W.camps) {
    if (!c.active) continue;
    const ti = idx(c.x, c.y),
      people = entityAtRadius(ti, 5, KINDS.PERSON);
    if (people.length) {
      c.lastOccupied = W.tick;
      c.stableTicks += 32;
      for (const id of people) {
        const inv = W.components.inventory[id].materials;
        for (const sp of [C.ORGANIC, C.MINERAL, C.FUEL, C.SOLVENT, C.ORE, C.CATALYST]) {
          const amount = Math.min(inv[sp], 3);
          inv[sp] -= amount;
          c.inventory[sp] = u16(c.inventory[sp] + amount);
        }
      }
    } else c.structure.integrity = u16(c.structure.integrity - 5);
    if (c.stableTicks > 128 && people.length >= 5 && constructionPotential(c.inventory) > 2)
      queueEffect(
        "CreateSettlement",
        { campId: c.id, causeEvent: W.lastEventByType.CampFoundedEvent },
        c.entityId,
      );
    if (W.tick - c.lastOccupied > 512 || c.structure.integrity < 20) {
      c.active = false;
      for (let sp = 0; sp < SPECIES_COUNT; sp++) {
        const amount = c.inventory[sp] + c.structure.composition[sp];
        if (sp < COMMON_CHEM) W.tiles.chem[sp][ti] = u16(W.tiles.chem[sp][ti] + amount);
        else W.tiles.rareChem[`${ti}:${sp}`] = u16((W.tiles.rareChem[`${ti}:${sp}`] || 0) + amount);
      }
      emitEvent("CampAbandonedEvent", {
        subjects: [c.entityId],
        location: ti,
        causes: [W.causalIndex.tile[ti] || 0],
        evidence: ["habitation and stored matter fell below persistence"],
        importance: 2,
        data: { name: c.name },
      });
    }
  }
  for (const s of W.settlements) {
    if (s.ruined) continue;
    const ti = idx(s.x, s.y),
      people = entityAtRadius(ti, 7, KINDS.PERSON).filter(classifyAlive);
    for (const id of people) {
      const inv = W.components.inventory[id].materials;
      for (const sp of [C.ORGANIC, C.MINERAL, C.FUEL, C.SOLVENT, C.ORE, C.CATALYST, C.FIBER]) {
        const amount = Math.min(inv[sp], 4, 65535 - s.inventory[sp]);
        inv[sp] -= amount;
        s.inventory[sp] += amount;
      }
      if (s.factionId) W.components.social[id].factionId = s.factionId;
    }
    const harvest = Math.min(W.tiles.chem[C.ORGANIC][ti], Math.max(0, people.length * 2));
    W.tiles.chem[C.ORGANIC][ti] -= harvest;
    s.inventory[C.ORGANIC] = u16(s.inventory[C.ORGANIC] + harvest);
    const water = Math.min(W.tiles.chem[C.SOLVENT][ti], people.length * 2 + 2);
    W.tiles.chem[C.SOLVENT][ti] -= water;
    s.inventory[C.SOLVENT] = u16(s.inventory[C.SOLVENT] + water);
    const rawPop = settlementPopulation(s),
      safePop = Math.max(1, rawPop);
    for (const id of people) {
      const digestive = W.components.inventory[id].digestive,
        body = W.components.chemistry[id].q,
        food = Math.min(2, s.inventory[C.ORGANIC], 65535 - digestive[C.ORGANIC]),
        drink = Math.min(3, s.inventory[C.SOLVENT], 65535 - body[C.SOLVENT]);
      s.inventory[C.ORGANIC] -= food;
      digestive[C.ORGANIC] += food;
      s.inventory[C.SOLVENT] -= drink;
      body[C.SOLVENT] += drink;
    }
    for (const c of W.cohorts)
      if (
        c.kind === KINDS.PERSON &&
        c.count &&
        ((s.factionId && c.factionId === s.factionId) || c.regionId === regionId(s.x, s.y))
      ) {
        const food = Math.min(c.count, s.inventory[C.ORGANIC]),
          drink = Math.min(c.count, s.inventory[C.SOLVENT]);
        s.inventory[C.ORGANIC] -= food;
        c.chemistryTotals[C.ORGANIC] += food;
        s.inventory[C.SOLVENT] -= drink;
        c.chemistryTotals[C.SOLVENT] += drink;
      }
    if (s.knownProcesses.includes("storage")) {
      if (W.tick % 256 === 0) executeProcess("decomposition", invSettlement(s), 1);
    } else
      executeProcess(
        "decomposition",
        invSettlement(s),
        Math.max(0, Math.floor(s.inventory[C.ORGANIC] / 180)),
      );
    if (constructionPotential(s.inventory) > 3 && s.structure.integrity < 950) {
      for (const sp of [C.MINERAL, C.FIBER]) {
        const amount = Math.min(s.inventory[sp], 5);
        s.inventory[sp] -= amount;
        s.structure.composition[sp] = u16(s.structure.composition[sp] + amount);
      }
      s.structure.integrity = u16(s.structure.integrity + 6);
      s.structure.order = u16(s.structure.order + 3);
      s.housing += 0.12;
    }
    s.defense = settlementDefense(s);
    const needs =
      (settlementFood(s) < 10 ? -0.04 : 0.015) +
      (settlementWater(s) < 10 ? -0.04 : 0.01) -
      settlementDisease(s) * 0.001;
    s.stability = clamp(s.stability + needs, 0, 1);
    if (s.structure.integrity < 10 || (rawPop < 1 && W.tick - s.foundedTick > 512))
      ruinSettlement(
        s,
        W.causalIndex.tile[ti] || 0,
        s.structure.integrity < 10 ? "structural material failed" : "population dispersed",
      );
  }
  updateMaterialProcesses();
}
function entityAtRadius(tile, r, kind) {
  const [cx, cy] = xy(tile),
    out = [];
  for (let y = Math.max(0, cy - r); y <= Math.min(W.height - 1, cy + r); y++)
    for (let x = Math.max(0, cx - r); x <= Math.min(W.width - 1, cx + r); x++)
      if (dist2(x, y, cx, cy) <= r * r)
        for (const id of W.spatialBins[idx(x, y)] || [])
          if (!kind || W.kind[id] === kind) out.push(id);
  return out.sort((a, b) => a - b);
}
