// ═══════════════════════════════════════════════════════════════════════════
// 12. POPULATION COHORTS AND AGGREGATION
// ═══════════════════════════════════════════════════════════════════════════
function rebuildSpatialBins() {
  W.spatialBins = Array.from({ length: W.tileCount }, () => null);
  W.tiles.populationPressure.fill(0);
  for (const id of W.activeIds) {
    const p = W.components.position[id];
    if (!p) continue;
    const i = idx(p.x, p.y);
    (W.spatialBins[i] || (W.spatialBins[i] = [])).push(id);
    if ([KINDS.HERBIVORE, KINDS.PREDATOR, KINDS.PERSON].includes(W.kind[id]))
      W.tiles.populationPressure[i] = u16(W.tiles.populationPressure[i] + 80);
  }
  for (const bin of W.spatialBins) if (bin) bin.sort((a, b) => a - b);
}
function cohortLifeSpan(kind) {
  return kind === KINDS.HERBIVORE ? 36000 : kind === KINDS.PREDATOR ? 48000 : 72000;
}
function cohortMaturityAge(kind) {
  return 1000;
}
function ensureCohortState(c) {
  c.count = Math.max(0, Math.floor(Number(c.count) || 0));
  c.chemistryTotals = Array.from({ length: SPECIES_COUNT }, (_, sp) =>
    Math.max(0, Number(c.chemistryTotals?.[sp]) || 0),
  );
  c.bodyChemistryTotals = Array.from({ length: SPECIES_COUNT }, (_, sp) =>
    Math.max(
      0,
      Number.isFinite(Number(c.bodyChemistryTotals?.[sp]))
        ? Number(c.bodyChemistryTotals[sp])
        : Math.min(c.chemistryTotals[sp], c.count * (sp === C.SOLVENT ? 180 : 90)),
    ),
  );
  c.geneSums = Array.from({ length: 13 }, (_, i) => Number(c.geneSums?.[i]) || 0);
  c.geneSquares = Array.from({ length: 13 }, (_, i) =>
    Math.max(0, Number(c.geneSquares?.[i]) || 0),
  );
  c.ageBins = Array.from({ length: 4 }, (_, i) =>
    Math.max(0, Math.floor(Number(c.ageBins?.[i]) || 0)),
  );
  let represented = sum(c.ageBins);
  if (represented < c.count) c.ageBins[0] += c.count - represented;
  else if (represented > c.count) {
    let excess = represented - c.count;
    for (let bin = 3; bin >= 0 && excess; bin--) {
      const take = Math.min(excess, c.ageBins[bin]);
      c.ageBins[bin] -= take;
      excess -= take;
    }
  }
  c.ageCarry = Array.from({ length: 4 }, (_, i) =>
    clamp(Number(c.ageCarry?.[i]) || 0, 0, 0.999999999),
  );
  c.lastAgeTick = Number.isFinite(c.lastAgeTick) ? Math.min(c.lastAgeTick, W.tick) : W.tick;
  c.maxAge = Math.max(1, Math.floor(Number(c.maxAge) || cohortLifeSpan(c.kind)));
  c.reproductionRemainder = clamp(Number(c.reproductionRemainder) || 0, 0, 0.999999999);
  c.materializedCount = Math.max(0, Math.floor(Number(c.materializedCount) || 0));
  c.history = Array.isArray(c.history) ? c.history : [];
  if (!c.count) {
    c.ageBins.fill(0);
    c.ageCarry.fill(0);
  }
  return c;
}
function cohortFor(kind, region, faction = 0, lineage = 0) {
  let c = W.cohorts.find(
    (x) =>
      x.kind === kind &&
      x.regionId === region &&
      x.factionId === faction &&
      x.lineageId === lineage,
  );
  if (!c) {
    c = {
      id: W.cohorts.length + 1,
      kind,
      regionId: region,
      factionId: faction,
      lineageId: lineage,
      count: 0,
      chemistryTotals: Array(SPECIES_COUNT).fill(0),
      bodyChemistryTotals: Array(SPECIES_COUNT).fill(0),
      geneSums: Array(13).fill(0),
      geneSquares: Array(13).fill(0),
      ageBins: [0, 0, 0, 0],
      ageCarry: [0, 0, 0, 0],
      lastAgeTick: W.tick,
      maxAge: cohortLifeSpan(kind),
      reproductionRemainder: 0,
      materializedCount: 0,
      health: 1,
      morale: 0.6,
      cultureId: 0,
      occupations: { gatherer: 0, builder: 0, guard: 0 },
      foodAccess: 0.6,
      growthRate: 0,
      migrationPressure: 0,
      history: [],
    };
    W.cohorts.push(c);
  }
  return ensureCohortState(c);
}
function cohortAgeBin(age, maxAge) {
  return clamp(Math.floor((Math.max(0, Number(age) || 0) / Math.max(1, maxAge)) * 4), 0, 3);
}
function rememberCohortHistory(c, entry) {
  c.history.push({ tick: W.tick, ...entry });
  if (c.history.length > 24) c.history.splice(0, c.history.length - 24);
}
function recordCohortBirths(
  c,
  amount,
  tile,
  causes = [],
  evidence = "conserved parent matter formed aggregate offspring",
) {
  amount = Math.max(0, Math.floor(amount));
  if (!amount) return 0;
  W.statistics.births = (W.statistics.births || 0) + amount;
  const byKind =
    W.statistics.birthsByKind ||
    (W.statistics.birthsByKind = { herbivore: 0, predator: 0, person: 0 });
  byKind[c.kind] = (byKind[c.kind] || 0) + amount;
  const ev = emitEvent("BirthEvent", {
    location: tile,
    causes,
    evidence: [evidence],
    magnitude: amount,
    importance: c.kind === KINDS.PERSON ? 2 : 1,
    data: { kind: c.kind, cohortId: c.id, aggregate: true },
  });
  rememberCohortHistory(c, { reason: "birth", magnitude: amount, eventId: ev.id });
  return ev.id;
}
function aggregateIntoCohort(id, reason = "density cap") {
  const k = W.kind[id],
    p = W.components.position[id],
    g = W.components.genome[id],
    ch = W.components.chemistry[id],
    ident = W.components.identity[id],
    social = W.components.social[id],
    inventory = W.components.inventory[id],
    life = W.components.life[id],
    body = W.components.body[id];
  if (!p || !g || !ch || !life || !body || ident?.notable) return false;
  const c = cohortFor(k, p.regionId, social?.factionId || 0, g.lineageId);
  c.maxAge = Math.max(1, Math.floor(body.maxAge || c.maxAge));
  c.count++;
  for (let i = 0; i < SPECIES_COUNT; i++)
    c.chemistryTotals[i] +=
      ch.q[i] + (inventory?.materials[i] || 0) + (inventory?.digestive[i] || 0);
  for (let i = 0; i < SPECIES_COUNT; i++) c.bodyChemistryTotals[i] += ch.q[i];
  for (let i = 0; i < 13; i++) {
    const v = g.instructions[i]?.expression || 0;
    c.geneSums[i] += v;
    c.geneSquares[i] += v * v;
  }
  c.ageBins[cohortAgeBin(life.age, c.maxAge)]++;
  rememberCohortHistory(c, { name: ident?.generatedName || `Entity ${id}`, reason });
  W.historicalIdentities[id] = {
    ...ident,
    kind: k,
    name: ident?.generatedName || `Entity ${id}`,
    aggregatedTick: W.tick,
    cohortId: c.id,
  };
  if (typeof pruneHistoricalIdentities === "function") pruneHistoricalIdentities();
  removeEntity(id);
  return true;
}
function addBirthToCohort(kind, region, parents, chemistry, genome) {
  parents = parents || [];
  const lineage = genome.lineageId,
    faction = parents[0] ? W.components.social[parents[0]]?.factionId || 0 : 0,
    c = cohortFor(kind, region, faction, lineage),
    parentBody = parents[0] ? W.components.body[parents[0]] : null;
  c.maxAge = Math.max(1, Math.floor(parentBody?.maxAge || c.maxAge));
  c.count++;
  for (let i = 0; i < SPECIES_COUNT; i++) {
    c.chemistryTotals[i] += chemistry[i] || 0;
    c.bodyChemistryTotals[i] += chemistry[i] || 0;
  }
  for (let i = 0; i < 13; i++) {
    const v = genome.instructions[i]?.expression || 0;
    c.geneSums[i] += v;
    c.geneSquares[i] += v * v;
  }
  c.ageBins[0]++;
  c.growthRate = 0.9 * c.growthRate + 0.1;
  const parentPosition = parents[0] ? W.components.position[parents[0]] : null,
    tile = parentPosition ? idx(parentPosition.x, parentPosition.y) : idx(...regionCenter(region)),
    causes = parents.map((parent) => W.components.identity[parent]?.birthEventId || 0);
  recordCohortBirths(
    c,
    1,
    tile,
    causes,
    "stored parent matter formed a new bounded network represented in the regional cohort",
  );
  return c;
}
function storeMaterializedSpecies(id, sp, amount, tile) {
  amount = Math.max(0, Math.floor(amount));
  let remaining = amount;
  const inventory = W.components.inventory[id],
    stores = [W.components.chemistry[id].q, inventory.materials, inventory.digestive];
  for (const store of stores) {
    store[sp] = 0;
    if (!remaining) continue;
    const moved = Math.min(remaining, 65535);
    store[sp] = moved;
    remaining -= moved;
  }
  if (remaining) depositTileMatter(tile, sp, remaining);
  return amount;
}
function materializeSite(regionId) {
  const [cx, cy] = regionCenter(regionId);
  for (let radius = 0; radius <= 8; radius++)
    for (let dy = -radius; dy <= radius; dy++)
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const x = cx + dx,
          y = cy + dy;
        if (!inside(x, y)) continue;
        const tile = idx(x, y);
        if (W.tiles.liquid[tile] <= WATER_DEPTH.WADE_LIMIT && W.tiles.fire[tile] < 100)
          return [x, y];
      }
  return [cx, cy];
}
function materializeCohort(c) {
  ensureCohortState(c);
  if (!c.count) return 0;
  const countBefore = c.count,
    [x, y] = materializeSite(c.regionId),
    tile = idx(x, y),
    before = Array.from({ length: COMMON_CHEM }, (_, s) => W.tiles.chem[s][tile]),
    initial = W.conservation.initialMatter,
    primordial = W.reservoirs.primordialPackets?.slice(),
    r = makeRng(
      hashParts(W.seedHash, W.tick, c.id, c.count, c.materializedCount),
      "cohort-materialization",
    ),
    id = createOrganism(c.kind, x, y, r, [], tile, 0),
    g = W.components.genome[id];
  for (let s = 0; s < COMMON_CHEM; s++) W.tiles.chem[s][tile] = before[s];
  W.conservation.initialMatter = initial;
  if (primordial) W.reservoirs.primordialPackets = primordial;
  for (let s = 0; s < SPECIES_COUNT; s++) {
    const share = Math.max(0, Math.floor(c.chemistryTotals[s] / countBefore));
    storeMaterializedSpecies(id, s, share, tile);
    c.chemistryTotals[s] = Math.max(0, c.chemistryTotals[s] - share);
    c.bodyChemistryTotals[s] = Math.max(
      0,
      c.bodyChemistryTotals[s] -
        Math.min(c.bodyChemistryTotals[s], W.components.chemistry[id].q[s]),
    );
  }
  W.components.chemistry[id].storedFreeEnergy =
    W.components.chemistry[id].q[C.ENERGY] * W.definitions.species[C.ENERGY].freeEnergy;
  for (let i = 0; i < 13; i++) {
    const avg = c.geneSums[i] / countBefore;
    g.instructions[i].expression = +clamp(avg, 0.08, 0.98).toFixed(3);
    c.geneSums[i] -= avg;
    c.geneSquares[i] = Math.max(0, c.geneSquares[i] - avg * avg);
  }
  g.lineageId = c.lineageId;
  g.dirty = true;
  W.components.social[id].factionId = c.factionId;
  W.components.social[id].cultureId = c.cultureId;
  const bin = c.ageBins.findIndex((v) => v > 0);
  c.count--;
  if (bin >= 0) c.ageBins[bin]--;
  W.components.body[id].maxAge = c.maxAge;
  W.components.body[id].maturityAge = cohortMaturityAge(c.kind);
  W.components.life[id].age = Math.floor(((Math.max(0, bin) + 0.5) / 4) * c.maxAge);
  c.materializedCount++;
  if (!c.count) {
    c.geneSums.fill(0);
    c.geneSquares.fill(0);
  }
  ensureCohortState(c);
  compilePhenotype(id);
  derivedLife(id);
  return id;
}
function cohortRemovalByAge(c, amount, oldestFirst = false) {
  const removed = [0, 0, 0, 0];
  if (oldestFirst) {
    let remaining = amount;
    for (let bin = 3; bin >= 0 && remaining; bin--) {
      removed[bin] = Math.min(remaining, c.ageBins[bin]);
      remaining -= removed[bin];
    }
    return removed;
  }
  const count = Math.max(1, c.count),
    rank = [];
  let assigned = 0;
  for (let bin = 0; bin < 4; bin++) {
    const exact = (c.ageBins[bin] * amount) / count,
      take = Math.min(c.ageBins[bin], Math.floor(exact));
    removed[bin] = take;
    assigned += take;
    rank.push({ bin, fraction: exact - take });
  }
  rank.sort((a, b) => b.fraction - a.fraction || a.bin - b.bin);
  for (const { bin } of rank) {
    if (assigned >= amount) break;
    if (removed[bin] < c.ageBins[bin]) {
      removed[bin]++;
      assigned++;
    }
  }
  return removed;
}
function removeCohortMembers(c, amount, tile, cause, oldestFirst = false, importance = 1) {
  ensureCohortState(c);
  amount = Math.min(c.count, Math.max(0, Math.floor(amount)));
  if (!amount) return 0;
  const before = c.count,
    removed = cohortRemovalByAge(c, amount, oldestFirst),
    remainingRatio = (before - amount) / before;
  for (let bin = 0; bin < 4; bin++) c.ageBins[bin] -= removed[bin];
  for (let sp = 0; sp < SPECIES_COUNT; sp++) {
    const total = c.chemistryTotals[sp],
      bodyTotal = c.bodyChemistryTotals[sp],
      released = amount === before ? total : Math.floor((total * amount) / before),
      bodyReleased = amount === before ? bodyTotal : (bodyTotal * amount) / before;
    c.chemistryTotals[sp] = Math.max(0, total - released);
    c.bodyChemistryTotals[sp] = Math.max(0, bodyTotal - bodyReleased);
    depositTileMatter(tile, sp, released);
  }
  for (let i = 0; i < 13; i++) {
    c.geneSums[i] *= remainingRatio;
    c.geneSquares[i] *= remainingRatio;
  }
  c.count -= amount;
  if (!c.count) {
    c.geneSums.fill(0);
    c.geneSquares.fill(0);
  }
  ensureCohortState(c);
  W.statistics.deaths = (W.statistics.deaths || 0) + amount;
  const ev = emitEvent("DeathEvent", {
    location: tile,
    evidence: [cause],
    magnitude: amount,
    importance,
    data: { kind: c.kind, cohortId: c.id, aggregate: true },
  });
  rememberCohortHistory(c, { reason: cause, magnitude: -amount, eventId: ev.id });
  return amount;
}
function advanceCohortAges(c, tile) {
  ensureCohortState(c);
  const elapsed = Math.max(0, W.tick - c.lastAgeTick);
  c.lastAgeTick = W.tick;
  if (!elapsed || !c.count) return 0;
  const before = c.ageBins.slice(),
    width = Math.max(1, c.maxAge / 4),
    moving = [0, 0, 0, 0];
  for (let bin = 0; bin < 4; bin++) {
    const progress = c.ageCarry[bin] + (before[bin] * elapsed) / width;
    moving[bin] = Math.min(before[bin], Math.floor(progress));
    c.ageCarry[bin] = moving[bin] === before[bin] ? 0 : progress - moving[bin];
  }
  c.ageBins[0] = before[0] - moving[0];
  c.ageBins[1] = before[1] - moving[1] + moving[0];
  c.ageBins[2] = before[2] - moving[2] + moving[1];
  c.ageBins[3] = before[3] + moving[2];
  return moving[3]
    ? removeCohortMembers(c, moving[3], tile, "accumulated repair failure in old age", true, 1)
    : 0;
}
function cohortMatterCapacity(c) {
  const requirements = [
      [C.SOLVENT, 80],
      [C.ORGANIC, 45],
      [C.ENERGY, 32],
      [C.NUTRIENT, 8],
      [C.INFO, 8],
      [C.MEMBRANE, 8],
    ],
    capacities = requirements.map(([sp, need]) => Math.floor((c.chemistryTotals[sp] || 0) / need));
  return capacities.length ? Math.max(0, Math.min(...capacities)) : 0;
}
function reproduceCohort(c, tile) {
  ensureCohortState(c);
  if (c.count < 2 || c.health < 0.52 || c.foodAccess < 0.48) return 0;
  const binWidth = c.maxAge / 4,
    matureInYoung = Math.floor(
      c.ageBins[0] * clamp(1 - cohortMaturityAge(c.kind) / Math.max(1, binWidth), 0, 1),
    ),
    mature = matureInYoung + c.ageBins[1] + c.ageBins[2] + c.ageBins[3];
  if (mature < 2) return 0;
  const rate = clamp((c.foodAccess - 0.46) * 0.018 * c.health, 0, 0.009),
    progress = c.reproductionRemainder + mature * rate,
    potential = Math.floor(progress);
  c.reproductionRemainder = progress - potential;
  if (!potential) return 0;
  const globalRoom = Math.max(0, sustainableSexualCapacity(c.kind) - biospherePopulation(c.kind)),
    matterRoom = Math.max(0, cohortMatterCapacity(c) - c.count),
    births = Math.min(potential, Math.floor(mature / 2), globalRoom, matterRoom);
  if (!births) return 0;
  const before = c.count;
  for (let i = 0; i < 13; i++) {
    const avg = c.geneSums[i] / before,
      avgSquare = c.geneSquares[i] / before;
    c.geneSums[i] += avg * births;
    c.geneSquares[i] += avgSquare * births;
  }
  c.count += births;
  c.ageBins[0] += births;
  c.growthRate = 0.9 * c.growthRate + 0.1 * (births / before);
  recordCohortBirths(
    c,
    births,
    tile,
    [],
    "cohort members reorganized conserved stored matter into new bounded offspring",
  );
  return births;
}
function activeCount(kind) {
  let n = 0;
  for (const id of W.activeIds) if (W.kind[id] === kind) n++;
  return n;
}
function cohortEnvironmentTiles(c) {
  const [cx, cy] = regionCenter(c.regionId),
    points = [
      [cx, cy],
      [cx - 6, cy - 6],
      [cx + 6, cy - 6],
      [cx - 6, cy + 6],
      [cx + 6, cy + 6],
    ];
  return [
    ...new Set(points.map(([x, y]) => idx(clamp(x, 0, W.width - 1), clamp(y, 0, W.height - 1)))),
  ];
}
function mergeDuplicateCohorts() {
  const canonical = new Map();
  for (const cohort of W.cohorts.slice().sort((a, b) => a.id - b.id)) {
    if (!cohort.count || cohort.mergedInto) continue;
    ensureCohortState(cohort);
    const key = `${cohort.kind}:${cohort.regionId}:${cohort.factionId || 0}:${cohort.lineageId || 0}`,
      target = canonical.get(key);
    if (!target) {
      canonical.set(key, cohort);
      continue;
    }
    const before = target.count,
      total = before + cohort.count;
    for (let sp = 0; sp < SPECIES_COUNT; sp++) {
      target.chemistryTotals[sp] += cohort.chemistryTotals[sp];
      target.bodyChemistryTotals[sp] += cohort.bodyChemistryTotals[sp];
    }
    for (let gene = 0; gene < 13; gene++) {
      target.geneSums[gene] += cohort.geneSums[gene];
      target.geneSquares[gene] += cohort.geneSquares[gene];
    }
    for (let bin = 0; bin < 4; bin++) target.ageBins[bin] += cohort.ageBins[bin];
    target.health = (target.health * before + cohort.health * cohort.count) / total;
    target.morale = (target.morale * before + cohort.morale * cohort.count) / total;
    target.count = total;
    target.materializedCount += cohort.materializedCount;
    target.history = target.history
      .concat(cohort.history)
      .sort((a, b) => a.tick - b.tick)
      .slice(-24);
    cohort.count = 0;
    cohort.ageBins.fill(0);
    cohort.chemistryTotals.fill(0);
    cohort.bodyChemistryTotals.fill(0);
    cohort.geneSums.fill(0);
    cohort.geneSquares.fill(0);
    cohort.mergedInto = target.id;
  }
}
function detailTier(id) {
  const ident = W.components.identity[id],
    p = W.components.position[id];
  if (!p) return "historical";
  if (
    ident?.notable ||
    W.tiles.fire[idx(p.x, p.y)] > 300 ||
    W.tiles.danger[idx(p.x, p.y)] > 500 ||
    settlementNear(idx(p.x, p.y), 5)
  )
    return "detailed";
  const cadence = W.config.complexity === "lean" ? 8 : W.config.complexity === "deep" ? 2 : 4;
  if (W.tick % cadence === id % cadence) return "simplified-due";
  return "simplified";
}
function updateCohorts() {
  for (const kind of [KINDS.HERBIVORE, KINDS.PREDATOR, KINDS.PERSON]) {
    const over = activeCount(kind) - CAPS[kind];
    if (over > 0) {
      const candidates = W.activeIds
        .filter((id) => W.kind[id] === kind && !W.components.identity[id]?.notable)
        .sort((a, b) => b - a);
      let aggregated = 0;
      for (const id of candidates) {
        if (aggregated >= over) break;
        if (aggregateIntoCohort(id)) aggregated++;
      }
    }
  }
  for (const c of W.cohorts.slice().sort((a, b) => a.id - b.id)) {
    ensureCohortState(c);
    if (!c.count) continue;
    const [rx, ry] = regionCenter(c.regionId),
      i = idx(rx, ry),
      samples = cohortEnvironmentTiles(c);
    advanceCohortAges(c, i);
    if (!c.count) continue;
    c.foodAccess =
      mean(
        samples.map((tile) => tileFood(tile, c.kind === KINDS.PREDATOR ? "predator" : "grazer")),
      ) / 100;
    const disease = mean(samples.map(tileDisease)),
      danger = mean(samples.map((tile) => W.tiles.danger[tile]));
    c.health = clamp(c.health + (c.foodAccess - 0.45) * 0.015 - disease * 0.0005, 0.1, 1);
    c.migrationPressure = clamp(0.35 - c.foodAccess + danger / 1300, 0, 1);
    if (c.health < 0.2 && W.tick % 128 === 0)
      removeCohortMembers(
        c,
        Math.max(1, Math.floor(c.count * 0.08)),
        i,
        "cohort disease and chemical scarcity",
        false,
        2,
      );
    if (!c.count) continue;
    if (W.tick % 128 === 0) reproduceCohort(c, i);
    const active = activeCount(c.kind),
      cap = CAPS[c.kind] || 100;
    const representedInRegion = W.activeIds.some(
      (id) =>
        W.kind[id] === c.kind &&
        W.components.position[id]?.regionId === c.regionId &&
        classifyAlive(id),
    );
    if (
      c.count &&
      active < cap * 0.55 &&
      (W.tiles.danger[i] > 350 ||
        W.tiles.fire[i] > 200 ||
        settlementNear(i, 6) ||
        (!representedInRegion && Math.floor(W.tick / 32) % 8 === c.id % 8))
    )
      materializeCohort(c);
  }
  mergeDuplicateCohorts();
}
function debugCohortInvariants() {
  if (!W) return null;
  const cohorts = W.cohorts
    .slice()
    .sort((a, b) => a.id - b.id)
    .map((c) => {
      const bins = Array.from({ length: 4 }, (_, i) =>
          Math.max(0, Math.floor(Number(c.ageBins?.[i]) || 0)),
        ),
        represented = sum(bins),
        negativeMatter = (c.chemistryTotals || []).some(
          (value) => !Number.isFinite(value) || value < 0,
        ),
        negativeGenes =
          (c.geneSums || []).some((value) => !Number.isFinite(value)) ||
          (c.geneSquares || []).some((value) => !Number.isFinite(value) || value < 0);
      return {
        id: c.id,
        kind: c.kind,
        count: c.count,
        ageBins: bins,
        represented,
        valid: represented === c.count && !negativeMatter && !negativeGenes,
        negativeMatter,
        negativeGenes,
      };
    });
  return { ok: cohorts.every((c) => c.valid), cohorts };
}
function regionCenter(r) {
  const cols = Math.ceil(W.width / 18),
    x = (r % cols) * 18 + 9,
    y = Math.floor(r / cols) * 18 + 9;
  return [clamp(x, 0, W.width - 1), clamp(y, 0, W.height - 1)];
}
