// ═══════════════════════════════════════════════════════════════════════════
// 26. CULTURE, FACTIONS, POLITICS, AND TERRITORY
// ═══════════════════════════════════════════════════════════════════════════
function makeEthos(r) {
  const keys = [
      "communal",
      "hierarchical",
      "aggressive",
      "expansionist",
      "isolationist",
      "inventive",
      "spiritual",
      "natureBound",
      "mercantile",
    ],
    o = {};
  for (const k of keys) o[k] = +r.range(0.15, 0.95).toFixed(2);
  return o;
}
function activeFactionCount(world = W) {
  return (world?.factions || []).filter((f) => f.stability > 0).length;
}
function takeFactionId(world = W) {
  const floor = (world.factions || []).reduce((highest, f) => Math.max(highest, f.id || 0), 0) + 1,
    id = Math.max(floor, Number.isSafeInteger(world.nextFactionId) ? world.nextFactionId : 1);
  world.nextFactionId = id + 1;
  return id;
}
function factionPopulation(factionId) {
  let population = 0;
  const seen = new Set();
  for (const id of W.activeIds) {
    if (
      seen.has(id) ||
      W.kind[id] !== KINDS.PERSON ||
      !classifyAlive(id) ||
      W.components.social[id]?.factionId !== factionId
    )
      continue;
    seen.add(id);
    population++;
  }
  for (const cohort of W.cohorts)
    if (cohort.kind === KINDS.PERSON && cohort.factionId === factionId && cohort.count > 0)
      population += cohort.count;
  return population;
}
function createFaction(settlementId, tile = -1, cause = 0) {
  if (activeFactionCount() >= CAPS.faction) return null;
  let s = W.settlements.find((x) => x.id === settlementId);
  if (!s && tile >= 0) s = nearestSettlement(tile, 9);
  if (!s || s.factionId) return null;
  const r = makeRng(hashParts(W.seedHash, s.id, W.tick), "faction"),
    name = `The ${NAME_B[r.int(NAME_B.length)]} ${["Kin", "League", "Concord", "Circle", "Hearths", "Accord"][r.int(6)]}`,
    id = takeFactionId(),
    entityId = allocEntity("faction"),
    cultureEntity = allocEntity("culture"),
    culture = {
      id: W.cultures.length + 1,
      entityId: cultureEntity,
      name: `${NAME_B[r.int(NAME_B.length)]} Ways`,
      values: {
        substance: r.int(SPECIES_COUNT),
        environment: biomeAt(idx(s.x, s.y)),
        communal: r.next(),
      },
      drift: 0,
      originSettlementId: s.id,
    },
    f = {
      id,
      entityId,
      name,
      color: `hsl(${r.int(360)} 62% 58%)`,
      population: 0,
      settlementIds: [s.id],
      capitalSettlementId: s.id,
      ethos: makeEthos(r),
      cohesion: 0.58 + r.next() * 0.25,
      aggression: 0.25 + r.next() * 0.5,
      expansionPressure: 0.4,
      technologyLevel: 0,
      militaryStrength: 0,
      warPressure: 0,
      stability: 0.7,
      territorySize: 0,
      allies: [],
      rivals: [],
      grievances: 0,
      relations: {},
      cultureId: culture.id,
    };
  W.cultures.push(culture);
  W.factions.push(f);
  s.factionId = id;
  s.cultureId = culture.id;
  W.components.position[entityId] = { x: s.x, y: s.y, layer: 0, regionId: regionId(s.x, s.y) };
  W.components.identity[entityId] = {
    generatedName: name,
    significance: 5,
    notable: true,
    titles: ["Polity"],
  };
  W.components.position[cultureEntity] = { x: s.x, y: s.y, layer: 0, regionId: regionId(s.x, s.y) };
  W.components.identity[cultureEntity] = {
    generatedName: culture.name,
    significance: 3,
    notable: false,
    titles: ["Culture"],
  };
  for (const pid of entityAtRadius(idx(s.x, s.y), 8, KINDS.PERSON)) {
    W.components.social[pid].factionId = id;
    W.components.social[pid].cultureId = culture.id;
    addRelation(pid, entityId, "member_of", 1);
  }
  const leader = entityAtRadius(idx(s.x, s.y), 8, KINDS.PERSON).sort(
      (a, b) => W.components.social[b].dominance - W.components.social[a].dominance || a - b,
    )[0],
    ev = emitEvent("FactionFoundedEvent", {
      subjects: [entityId, s.entityId, leader].filter(Boolean),
      location: idx(s.x, s.y),
      factions: [id],
      causes: [cause, W.lastEventByType.SettlementFoundedEvent],
      evidence: ["permanent settlement", "shared culture", "resource coordination"],
      importance: 4,
      data: { name },
    });
  if (leader) {
    addRelation(leader, entityId, "leads", 1, ev.id);
    W.components.identity[leader].titles.push(`First Voice of ${name}`);
    emitEvent("LeadershipEvent", {
      subjects: [leader],
      location: idx(s.x, s.y),
      factions: [id],
      causes: [ev.id],
      evidence: ["social dominance and community trust"],
      importance: 3,
    });
  }
  return f;
}
function updateTerritoryCulture() {
  const t = W.tiles;
  t.territory.fill(0);
  t.culture.fill(0);
  t.owner.fill(0);
  t.cultureOwner.fill(0);
  for (const s of W.settlements) {
    if (s.ruined || !s.factionId) continue;
    const f = W.factions.find((x) => x.id === s.factionId),
      radius = Math.min(18, 5 + Math.sqrt(settlementPopulation(s)) * 2 + f.expansionPressure * 5);
    for (
      let y = Math.max(0, Math.floor(s.y - radius));
      y <= Math.min(W.height - 1, Math.ceil(s.y + radius));
      y++
    )
      for (
        let x = Math.max(0, Math.floor(s.x - radius));
        x <= Math.min(W.width - 1, Math.ceil(s.x + radius));
        x++
      ) {
        const d = Math.sqrt(dist2(x, y, s.x, s.y));
        if (d > radius) continue;
        const i = idx(x, y),
          pressure = Math.floor(((radius - d) / radius) * 800 * f.cohesion),
          culture = Math.floor(((radius - d) / radius) * 650 * (0.5 + s.stability));
        if (pressure > t.territory[i]) {
          t.territory[i] = pressure;
          t.owner[i] = f.id;
        } else if (t.owner[i] !== f.id && pressure > t.territory[i] * 0.75)
          t.danger[i] = u16(t.danger[i] + 12);
        if (culture > t.culture[i]) {
          t.culture[i] = culture;
          t.cultureOwner[i] = f.cultureId;
        }
      }
    t.culture[idx(s.x, s.y)] = u16(t.culture[idx(s.x, s.y)] + 100);
  }
  for (const claim of W.divineClaims) paintOwnership(claim);
  for (const f of W.factions) {
    f.territorySize = 0;
    for (const o of t.owner) if (o === f.id) f.territorySize++;
  }
}
function updateFactions() {
  for (const s of W.settlements)
    if (!s.ruined && !s.factionId && W.tick - s.foundedTick > 128)
      queueEffect(
        "CreateFaction",
        { settlementId: s.id, causes: [W.lastEventByType.SettlementFoundedEvent] },
        s.entityId,
      );
  for (const f of W.factions) {
    const ss = W.settlements.filter((s) => s.factionId === f.id && !s.ruined),
      governed = ss.some((s) => s.knownProcesses.includes("governance"));
    f.settlementIds = ss.map((s) => s.id);
    f.population = factionPopulation(f.id);
    f.stability = ss.length ? mean(ss.map((s) => s.stability)) : 0;
    f.technologyLevel = new Set(ss.flatMap((s) => s.knownProcesses)).size;
    if (governed) {
      f.grievances = Math.max(0, f.grievances - 0.6);
      for (const s of ss) s.stability = clamp(s.stability + 0.004, 0, 1);
      f.stability = clamp(f.stability + 0.015, 0, 1);
    }
    f.militaryStrength =
      (f.population * (0.45 + f.aggression) * (1 + f.technologyLevel * 0.08) +
        sum(ss.map(settlementDefense))) *
      (governed ? 1.06 : 1);
    f.expansionPressure = clamp(
      f.ethos.expansionist * 0.6 +
        (f.population / (f.territorySize + 10)) * 0.35 +
        (1 - f.stability) * 0.2,
      0,
      1.5,
    );
    f.cohesion = clamp(
      f.cohesion + (f.stability - 0.5) * 0.01 - f.grievances * 0.0002 + (governed ? 0.008 : 0),
      0.12,
      1,
    );
    if (!ss.length) {
      f.stability = 0;
      f.militaryStrength = 0;
    }
  }
}
function updateLongEpoch() {
  for (const c of W.cultures) {
    c.drift = clamp(c.drift + (counterRand("culture-drift", W.tick, c.id) - 0.5) * 0.08, 0, 1);
    const f = W.factions.find((x) => x.cultureId === c.id);
    if (f && f.stability < 0.3) c.values.communal = clamp(c.values.communal + 0.03, 0, 1);
  }
  for (const t of W.tiles.habitation) void t;
  decayMemories();
  for (const s of W.settlements)
    if (s.ruined && W.tick - s.foundedTick > 2048) s.structure.order = u16(s.structure.order - 6);
}
