// Sentience is an ecological invariant, not a lucky roll. Individual people remain mortal,
// but a seed can no longer become reproductively stranded or exhaust a one-use rescue bank.
const SENTIENT_MINIMUM_VIABLE = 8,
  SENTIENT_RECOVERY_TARGET = 16,
  SENTIENT_ARCHIVE_DIVERSITY = 12;
function livingSentientIds() {
  return W.activeIds
    .filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id))
    .sort((a, b) => a - b);
}
function ensurePrimordialPacketShape() {
  const reservoirs = W.reservoirs || (W.reservoirs = {}),
    old = reservoirs.primordialPackets || [];
  if (!Array.isArray(old) || old.length !== SPECIES_COUNT)
    reservoirs.primordialPackets = Array.from({ length: SPECIES_COUNT }, (_, sp) =>
      Math.max(0, Number(old[sp]) || 0),
    );
  return reservoirs.primordialPackets;
}
function takePlanetSpecies(sp, requested, avoidId = 0) {
  let need = Math.max(0, Math.floor(requested)),
    taken = 0;
  if (!need) return 0;
  const pool = ensurePrimordialPacketShape(),
    fromPool = Math.min(need, pool[sp] || 0);
  pool[sp] -= fromPool;
  need -= fromPool;
  taken += fromPool;
  if (!need) return taken;
  if (sp === C.SOLVENT && W.reservoirs.atmosphericSolvent) {
    const n = Math.min(need, W.reservoirs.atmosphericSolvent);
    W.reservoirs.atmosphericSolvent -= n;
    need -= n;
    taken += n;
  } else if (sp === C.MINERAL && W.reservoirs.deepMineral) {
    const n = Math.min(need, W.reservoirs.deepMineral);
    W.reservoirs.deepMineral -= n;
    need -= n;
    taken += n;
  }
  if (!need) return taken;
  if (sp < COMMON_CHEM) {
    const field = W.tiles.chem[sp],
      start = hashParts(W.seedHash, W.tick, sp, "sentience-matter") % W.tileCount;
    for (let n = 0; n < W.tileCount && need; n++) {
      const i = (start + n) % W.tileCount,
        amount = Math.min(need, field[i]);
      field[i] -= amount;
      need -= amount;
      taken += amount;
    }
  } else {
    for (const key of Object.keys(W.tiles.rareChem)
      .filter((key) => Number(key.slice(key.lastIndexOf(":") + 1)) === sp)
      .sort()) {
      if (!need) break;
      const amount = Math.min(need, W.tiles.rareChem[key] || 0);
      W.tiles.rareChem[key] -= amount;
      if (!W.tiles.rareChem[key]) delete W.tiles.rareChem[key];
      need -= amount;
      taken += amount;
    }
  }
  if (!need) return taken;
  for (const id of W.activeIds.slice().sort((a, b) => a - b)) {
    if (!need) break;
    if (id === avoidId || W.kind[id] !== KINDS.CORPSE) continue;
    for (const store of [
      W.components.chemistry[id]?.q,
      W.components.inventory[id]?.materials,
      W.components.inventory[id]?.digestive,
    ]) {
      if (!store || !need) continue;
      const amount = Math.min(need, store[sp] || 0);
      store[sp] -= amount;
      need -= amount;
      taken += amount;
    }
  }
  return taken;
}
function transferPlanetSpeciesToEntity(id, sp, target) {
  const q = W.components.chemistry[id]?.q;
  if (!q) return 0;
  const need = Math.max(0, Math.floor(target - (q[sp] || 0))),
    taken = takePlanetSpecies(sp, need, id);
  q[sp] = u16(q[sp] + taken);
  return taken;
}
function sentienceArchiveSources() {
  const seen = new Set(),
    out = [];
  for (const id of livingSentientIds()) {
    const g = W.components.genome[id];
    if (g && !seen.has(g.lineageId)) {
      seen.add(g.lineageId);
      out.push(cloneGenome(g));
    }
  }
  for (const refuge of W.biosphere?.refugia || [])
    if (refuge.kind === KINDS.PERSON && refuge.genome && !seen.has(refuge.genome.lineageId)) {
      seen.add(refuge.genome.lineageId);
      out.push(cloneGenome(refuge.genome));
    }
  return out;
}
function initializeSentienceContinuity() {
  if (!W?.biosphere) return null;
  ensurePrimordialPacketShape();
  const state =
    W.biosphere.sentience ||
    (W.biosphere.sentience = {
      minimumViable: SENTIENT_MINIMUM_VIABLE,
      recoveryTarget: SENTIENT_RECOVERY_TARGET,
      archiveDiversity: SENTIENT_ARCHIVE_DIVERSITY,
      emerged: true,
      archive: [],
      recoveries: 0,
      lastRecoveryTick: -1,
      lowestPopulation: Infinity,
      schemaVersion: 0,
    });
  state.minimumViable = SENTIENT_MINIMUM_VIABLE;
  state.recoveryTarget = Math.max(SENTIENT_RECOVERY_TARGET, state.recoveryTarget || 0);
  state.archiveDiversity = SENTIENT_ARCHIVE_DIVERSITY;
  state.emerged = true;
  if (state.schemaVersion !== 1) {
    state.archive = Array.isArray(state.archive)
      ? state.archive.filter(Boolean).map(cloneGenome)
      : [];
    state.schemaVersion = 1;
  } else if (!Array.isArray(state.archive)) state.archive = [];
  state.lowestPopulation = Number.isFinite(state.lowestPopulation)
    ? state.lowestPopulation
    : biospherePopulation(KINDS.PERSON);
  if (state.archive.length >= SENTIENT_ARCHIVE_DIVERSITY) return state;
  const sources = [...state.archive, ...sentienceArchiveSources()];
  if (!sources.length) {
    const r = makeRng(
      hashParts(W.seedHash, "sentience-archive-origin"),
      "sentience-archive-origin",
    );
    sources.push(genomeFrom(r, KINDS.PERSON));
  }
  const r = makeRng(
    hashParts(W.seedHash, "sentience-archive-diversity"),
    "sentience-archive-diversity",
  );
  while (sources.length < SENTIENT_ARCHIVE_DIVERSITY) {
    const n = sources.length,
      a = sources[n % Math.max(1, sources.length)],
      b = sources[(n * 5 + 3) % Math.max(1, sources.length)] || a,
      g = genomeFrom(r, KINDS.PERSON, a, b);
    g.lineageId = hashParts(W.seedHash, "sentient-lineage", n);
    g.ancestorSignature = hashParts(W.seedHash, "sentient-ancestor", n);
    sources.push(g);
  }
  state.archive = sources.slice(0, SENTIENT_ARCHIVE_DIVERSITY).map(cloneGenome);
  return state;
}
function reconcileFounderMatter(id, beforeInitial, beforeTile) {
  if (W.conservation.initialMatter === beforeInitial) return id;
  const q = W.components.chemistry[id].q;
  for (let sp = 0; sp < SPECIES_COUNT; sp++) {
    const fromTile = sp < COMMON_CHEM ? Math.min(q[sp], beforeTile[sp] || 0) : 0,
      created = Math.max(0, q[sp] - fromTile),
      matched = takePlanetSpecies(sp, created, id),
      unmatched = created - matched;
    if (unmatched) q[sp] -= Math.min(q[sp], unmatched);
    W.conservation.initialMatter -= created;
  }
  if (W.conservation.initialMatter < beforeInitial) W.conservation.initialMatter = beforeInitial;
  return id;
}
function hardenSentientFounder(id, tile, sequence) {
  const state = initializeSentienceContinuity(),
    r = makeRng(hashParts(W.seedHash, W.tick, sequence, "sentient-founder"), "sentient-founder"),
    a = state.archive[sequence % state.archive.length],
    b = state.archive[(sequence * 5 + 3) % state.archive.length] || a,
    g = genomeFrom(r, KINDS.PERSON, a, b);
  g.lineageId = hashParts(W.seedHash, "continuity-lineage", state.recoveries, sequence);
  g.ancestorSignature = a.ancestorSignature;
  W.components.genome[id] = g;
  tuneGenomeToHabitat(
    id,
    tile,
    0.94,
    "sentient continuity lineage",
    Math.max(a.generation || 0, b.generation || 0) + 1,
  );
  const body = W.components.body[id],
    life = W.components.life[id],
    rep = W.components.reproduction[id],
    social = W.components.social[id],
    senses = W.components.senses[id];
  body.maxAge = Math.max(body.maxAge, 72000);
  body.maturityAge = 1000;
  body.coldTolerance = Math.min(body.coldTolerance, W.tiles.temperature[tile] / 10 - 18);
  life.age =
    sequence < SENTIENT_MINIMUM_VIABLE
      ? body.maturityAge + 60 + r.int(260)
      : Math.max(120, body.maturityAge - 420 + r.int(240));
  life.integrity = Math.max(life.integrity, 940);
  life.regulation = Math.max(life.regulation, 940);
  rep.mode = "paired";
  rep.fertility = Math.max(rep.fertility, 0.86);
  rep.parentalInvestment = Math.max(rep.parentalInvestment, 0.86);
  rep.cooldown = sequence < SENTIENT_MINIMUM_VIABLE ? (sequence % 2) * 48 : 180 + r.int(180);
  social.kinGroupId = hashParts(W.seedHash, "continuity-kin", state.recoveries, sequence);
  social.cohesion = Math.max(social.cohesion, 0.72);
  social.cooperation = Math.max(social.cooperation, 0.72);
  senses.visionRange = Math.max(senses.visionRange, 5);
  senses.smellRange = Math.max(senses.smellRange, 4);
  senses.fearSensitivity = Math.min(senses.fearSensitivity, 0.28);
  for (const [sp, target] of [
    [C.SOLVENT, 240],
    [C.ORGANIC, 120],
    [C.ENERGY, 170],
    [C.NUTRIENT, 46],
    [C.INFO, 30],
    [C.MEMBRANE, 38],
    [C.CATALYST, 18],
    [C.OXIDANT, 24],
  ])
    transferPlanetSpeciesToEntity(id, sp, target);
  compilePhenotype(id);
  const cognition = initCognition(id);
  if (cognition) cognition.updates = Math.max(cognition.updates || 0, 96);
  derivedLife(id);
  return id;
}
function createArchivedSentientFounder(tile, sequence) {
  const [x, y] = xy(tile),
    r = makeRng(hashParts(W.seedHash, W.tick, sequence, "archive-regrowth"), "archive-regrowth"),
    beforeInitial = W.conservation.initialMatter,
    beforeTile = Array.from({ length: COMMON_CHEM }, (_, sp) => W.tiles.chem[sp][tile]),
    id = createOrganism(KINDS.PERSON, x, y, r, [], tile, 0);
  reconcileFounderMatter(id, beforeInitial, beforeTile);
  hardenSentientFounder(id, tile, sequence);
  const ev = emitEvent("BirthEvent", {
    subjects: [id],
    location: tile,
    causes: [W.lastEventByType.ExtinctionEvent || W.biosphere.emergenceEvents.at(-1) || 0],
    evidence: [
      "planetary cellular archive regrew a genetically distinct social founder",
      "conserved matter formed a sexually compatible member of a viable community",
    ],
    importance: 3,
    data: { stage: "sentience continuity", archive: true },
  });
  W.components.identity[id].birthEventId = ev.id;
  return id;
}
function sentientRecoverySites() {
  const r = makeRng(
      hashParts(W.seedHash, W.tick, "sentient-recovery-sites"),
      "sentient-recovery-sites",
    ),
    sites = [];
  for (let n = 0; n < 3; n++) {
    let site = findHabitable(r, KINDS.PERSON);
    if (sites.length) {
      let best = site,
        bestScore = -Infinity;
      for (let k = 0; k < 180; k++) {
        const candidate = r.int(W.tileCount),
          distance = Math.min(
            ...sites.map((other) => {
              const [ax, ay] = xy(candidate),
                [bx, by] = xy(other);
              return Math.sqrt(dist2(ax, ay, bx, by));
            }),
          ),
          score = habitatScore(candidate, KINDS.PERSON) + Math.min(distance, 20) * 2;
        if (score > bestScore) {
          bestScore = score;
          best = candidate;
        }
      }
      site = best;
    }
    sites.push(site);
  }
  return sites;
}
function ensureSentientContinuity(force = false) {
  if (!W?.biosphere) return null;
  if (W.biosphere.emergencePlan && W.biosphere.emergencePlan.phase < 5) return null;
  const state = initializeSentienceContinuity(),
    before = biospherePopulation(KINDS.PERSON);
  state.lowestPopulation = Math.min(state.lowestPopulation, before);
  const detailed = livingSentientIds();
  if (before >= state.minimumViable && detailed.length >= state.minimumViable)
    return { recovered: 0, before, after: before };
  if (!force && state.lastRecoveryTick >= 0 && W.tick - state.lastRecoveryTick < 256)
    return { recovered: 0, before, after: before, cooldown: true };
  const sites = sentientRecoverySites(),
    needed = Math.max(0, state.recoveryTarget - before),
    recovered = [];
  for (const refuge of (W.biosphere.refugia || [])
    .filter((x) => x.available && x.kind === KINDS.PERSON)
    .sort((a, b) => a.id - b.id)) {
    if (recovered.length >= needed) break;
    const target = sites[recovered.length % sites.length],
      id = germinateRefuge(refuge, target);
    if (id) {
      hardenSentientFounder(id, target, recovered.length);
      recovered.push(id);
    }
  }
  while (recovered.length < needed) {
    const site = sites[recovered.length % sites.length],
      [cx, cy] = xy(site),
      ring = [
        [0, 0],
        [1, 0],
        [0, 1],
        [-1, 0],
        [0, -1],
        [1, 1],
        [-1, 1],
        [1, -1],
        [-1, -1],
      ],
      offset = ring[recovered.length % ring.length],
      tile = idx(clamp(cx + offset[0], 0, W.width - 1), clamp(cy + offset[1], 0, W.height - 1));
    recovered.push(createArchivedSentientFounder(tile, recovered.length));
  }
  if (recovered.length) {
    state.recoveries++;
    state.lastRecoveryTick = W.tick;
    W.biosphere.rescueCount = (W.biosphere.rescueCount || 0) + 1;
    const event = emitEvent("AdaptationEvent", {
      subjects: recovered.slice(0, 8),
      location: sites[0],
      causes: [W.lastEventByType.DeathEvent || W.biosphere.emergenceEvents.at(-1) || 0],
      evidence: [
        `people-level intelligence fell below the viable floor of ${state.minimumViable}`,
        `${recovered.length} diverse founders emerged together rather than a single reproductively stranded survivor`,
        `cellular archive and environmental matter restored sexual population structure`,
      ],
      importance: 5,
      data: {
        species: "sentient continuity community",
        stage: "sentient continuity",
        before,
        after: biospherePopulation(KINDS.PERSON),
      },
    });
    recordEmergenceEvent(event.id);
    rebuildSpatialBins();
  }
  return { recovered: recovered.length, before, after: biospherePopulation(KINDS.PERSON) };
}
const bootstrapWorldSentienceBase = bootstrapWorld;
bootstrapWorld = function () {
  bootstrapWorldSentienceBase();
  initializeSentienceContinuity();
  ensureSentientContinuity(true);
  W.conservation.initialMatter = totalMatter();
  W.conservation.initialChemicalEnergy = totalChemicalEnergy();
  worldHash();
};
const restoreWorldSentienceBase = restoreWorldDefaults;
restoreWorldDefaults = function () {
  restoreWorldSentienceBase();
  initializeSentienceContinuity();
  rebuildSpatialBins();
};
const germinateRefugeSentienceBase = germinateRefuge;
germinateRefuge = function (refuge, targetTile = null) {
  const pool = ensurePrimordialPacketShape(),
    before = pool.slice(),
    id = germinateRefugeSentienceBase(refuge, targetTile);
  for (let sp = 0; sp < SPECIES_COUNT; sp++)
    if (pool[sp] < before[sp]) pool[sp] += before[sp] - pool[sp];
  return id;
};
function sentientClusters() {
  const clusters = [];
  for (const id of livingSentientIds().sort((a, b) => a - b)) {
    const p = W.components.position[id];
    if (!p) continue;
    let home = clusters.find((c) => dist2(c.x / c.n, c.y / c.n, p.x, p.y) <= 676);
    if (!home) clusters.push((home = { x: 0, y: 0, n: 0 }));
    home.x += p.x;
    home.y += p.y;
    home.n++;
  }
  return clusters.filter((c) => c.n >= 3);
}
function ensureParallelPeoples() {
  if (!W?.biosphere) return null;
  if (W.biosphere.emergencePlan && W.biosphere.emergencePlan.phase < 5) return null;
  if (W.tick % 1024 !== 512) return null;
  const state = initializeSentienceContinuity(),
    clusters = sentientClusters(),
    clusterCap = clamp(Math.floor(W.tileCount / 3300), 3, 8);
  if (!clusters.length || clusters.length >= clusterCap) return null;
  if (biospherePopulation(KINDS.PERSON) < state.minimumViable) return null;
  const lonely = clusters.length === 1,
    cooldown = lonely ? 8192 : 12288;
  if (W.tick - (state.lastParallelSeedTick ?? -Infinity) < cooldown) return null;
  if (!lonely && counterRand("wild-sapience", Math.floor(W.tick / 1024)) > 0.35) return null;
  const separated = sentientRecoverySites().filter((tile) => {
    const [x, y] = xy(tile);
    return clusters.every((c) => dist2(x, y, c.x / c.n, c.y / c.n) > 1600);
  });
  if (!separated.length) return null;
  const site = separated[0],
    [cx, cy] = xy(site),
    ring = [
      [0, 0],
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
      [1, 1],
    ],
    seeded = [];
  for (let n = 0; n < 6; n++) {
    const offset = ring[n % ring.length],
      tile = idx(clamp(cx + offset[0], 0, W.width - 1), clamp(cy + offset[1], 0, W.height - 1)),
      id = createArchivedSentientFounder(tile, n);
    if (id) seeded.push(id);
  }
  if (!seeded.length) return null;
  state.lastParallelSeedTick = W.tick;
  emitEvent("AdaptationEvent", {
    subjects: seeded.slice(0, 6),
    location: site,
    causes: [W.biosphere.emergenceEvents?.at(-1) || 0],
    evidence: [
      lonely
        ? "an isolated band of people-level intelligence took root far from the surviving heartland"
        : "deep time and living chemistry kindled a new people in the unclaimed wilds",
      `${clusters.length + 1} peoples now walk the world; their histories will diverge`,
      `${(W.civilization?.legacyProcesses || []).length} remembered crafts await rediscovery in ruins and stories`,
    ],
    importance: 5,
    data: { species: "people-level tool users", stage: "parallel emergence" },
  });
  return seeded;
}
const simTickSentienceBase = simTick;
simTick = function () {
  simTickSentienceBase();
  ensureSentientContinuity();
  ensureParallelPeoples();
};
const huntTargetScoreSentienceBase = huntTargetScore;
huntTargetScore = function (id, target) {
  let score = huntTargetScoreSentienceBase(id, target);
  if (W.kind[target] === KINDS.PERSON) {
    const allies = nearbyIds(
        target,
        5,
        (o) => W.kind[o] === KINDS.PERSON && classifyAlive(o),
      ).length,
      tools = (W.components.inventory[target]?.artifactIds || []).length,
      mind = W.components.cognition?.[target],
      learnedDefense = Math.min(14, Math.log2(1 + (mind?.updates || 0)) * 1.6);
    score += allies * 18 + tools * 28 + learnedDefense;
  }
  return score;
};
function sentienceContinuitySummary() {
  if (!W) return null;
  const state = initializeSentienceContinuity(),
    ids = livingSentientIds(),
    mature = ids.filter((id) => W.components.life[id].age > W.components.body[id].maturityAge),
    ready = ids.filter(canReproduce),
    lineages = new Set(ids.map((id) => W.components.genome[id]?.lineageId).filter(Boolean)),
    population = biospherePopulation(KINDS.PERSON),
    developmentallyYoung =
      state.recoveries === 0 &&
      ids.every((id) => W.components.life[id].age <= W.components.body[id].maturityAge);
  return {
    population,
    detailed: ids.length,
    mature: mature.length,
    reproductionReady: ready.length,
    lineages: lineages.size,
    minimumViable: state.minimumViable,
    recoveryTarget: state.recoveryTarget,
    archiveDiversity: state.archive.length,
    recoveries: state.recoveries,
    lastRecoveryTick: state.lastRecoveryTick,
    lowestObserved: state.lowestPopulation,
    developmentallyYoung,
    viable:
      population >= state.minimumViable &&
      ids.length >= state.minimumViable &&
      lineages.size >= 4 &&
      (mature.length >= 2 || developmentallyYoung),
  };
}
function debugSentienceCollapse() {
  if (!W) return null;
  const beforeMatter = totalMatter(),
    before = sentienceContinuitySummary();
  for (const id of livingSentientIds()) killEntity(id, "controlled sentience continuity test", 0);
  for (const cohort of W.cohorts.filter((c) => c.kind === KINDS.PERSON && c.count)) {
    const [x, y] = regionCenter(cohort.regionId),
      tile = idx(x, y);
    for (let sp = 0; sp < SPECIES_COUNT; sp++) {
      const amount = cohort.chemistryTotals[sp] || 0;
      if (amount) depositTileMatter(tile, sp, amount);
      cohort.chemistryTotals[sp] = 0;
    }
    cohort.count = 0;
    cohort.ageBins.fill(0);
  }
  const collapsed = biospherePopulation(KINDS.PERSON),
    result = ensureSentientContinuity(true),
    after = sentienceContinuitySummary(),
    afterMatter = totalMatter();
  return { before, collapsed, result, after, matterDelta: afterMatter - beforeMatter };
}
function debugSentienceArchiveDiff() {
  const encoded = JSON.stringify(snapshot(), saveReplacer),
    before = JSON.parse(encoded),
    snap = migrateSave(JSON.parse(encoded, saveReviver));
  W = snap.world;
  restoreWorldDefaults();
  const after = JSON.parse(JSON.stringify(snapshot(), saveReplacer)),
    diffs = [];
  const walk = (a, b, path) => {
    if (diffs.length >= 24) return;
    if (a === b) return;
    if (a == null || b == null || typeof a !== "object" || typeof b !== "object") {
      diffs.push({ path, before: a, after: b });
      return;
    }
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) walk(a[key], b[key], path ? `${path}.${key}` : key);
  };
  walk(before.world, after.world, "world");
  return { beforeHash: before.savedHash, afterHash: after.savedHash, diffs };
}
function debugLegacySentienceRecovery() {
  const people = livingSentientIds(),
    beforeMatter = totalMatter();
  for (const id of people.slice(1)) killEntity(id, "legacy save migration test", 0);
  for (const refuge of W.biosphere.refugia || [])
    if (refuge.kind === KINDS.PERSON) refuge.available = false;
  delete W.biosphere.sentience;
  const legacyPopulation = biospherePopulation(KINDS.PERSON);
  restoreWorldDefaults();
  ensureSentientContinuity(true);
  const after = sentienceContinuitySummary();
  return { legacyPopulation, after, matterDelta: totalMatter() - beforeMatter };
}
function habitationMemoryAround(tile, radius = 4) {
  const [cx, cy] = xy(tile);
  let total = 0;
  for (let y = Math.max(0, cy - radius); y <= Math.min(W.height - 1, cy + radius); y++)
    for (let x = Math.max(0, cx - radius); x <= Math.min(W.width - 1, cx + radius); x++) {
      const d = Math.sqrt(dist2(cx, cy, x, y));
      if (d <= radius) total += (W.tiles.habitation[idx(x, y)] || 0) * (1 - d / (radius + 1));
    }
  return total;
}
function protoSettlementCandidate() {
  let best = null;
  for (const id of livingSentientIds()) {
    const p = W.components.position[id],
      tile = idx(p.x, p.y),
      local = entityAtRadius(tile, 6, KINDS.PERSON).filter(classifyAlive),
      memory = habitationMemoryAround(tile),
      niche = ecologicalNicheAt(tile),
      food = tileFood(tile, "omnivore"),
      moisture = tileMoisture(tile),
      danger = W.tiles.danger[tile],
      flood = W.tiles.liquid[tile],
      fire = W.tiles.fire[tile];
    if (flood > WATER_DEPTH.WADE_LIMIT || fire > 120 || moisture < 10 || food < 2) continue;
    const score =
      local.length * 210 +
      Math.log2(memory + 1) * 55 +
      food * 7 +
      moisture * 2 +
      tileFertility(tile) +
      niche.shelter * 90 -
      danger * 0.45 -
      organismHabitatStress(id, tile) * 1.4;
    if (!best || score > best.score || (score === best.score && id < best.id))
      best = {
        id,
        tile,
        score,
        local: local.length,
        memory,
        food,
        moisture,
        danger,
        flood,
        shelter: niche.shelter,
      };
  }
  return best;
}
function settlementReadinessSummary() {
  if (!W) return null;
  initializeSocietyState(W);
  const people = biospherePopulation(KINDS.PERSON),
    camps = W.camps.filter((c) => c.active),
    settlements = W.settlements.filter((s) => !s.ruined),
    candidate = protoSettlementCandidate(),
    projects = W.buildings.filter((b) => !b.ruined && !b.complete),
    complete = W.buildings.filter((b) => !b.ruined && b.complete),
    blockers = [];
  if (!camps.length && !settlements.length) {
    if (people < 8) blockers.push(`people-level population ${people}/8`);
    if (W.tick < 1024) blockers.push(`communal learning ${W.tick}/1024 ticks`);
    if (!candidate) blockers.push("no safe food-and-water site");
    else {
      if (candidate.local < 2) blockers.push("foragers are widely dispersed");
      if (candidate.food < 5) blockers.push("best site has little food");
      if (candidate.moisture < 18) blockers.push("best site lacks reliable solvent");
    }
  } else if (camps.length && !settlements.length) {
    if (!complete.some((b) => b.type === "stockpile"))
      blockers.push("communal stockpile unfinished");
    if (!complete.some((b) => b.type === "shelter")) blockers.push("shelter unfinished");
    if (!complete.some((b) => b.type === "hearth")) blockers.push("worked hearth unfinished");
  }
  return {
    people,
    camps: camps.length,
    settlements: settlements.length,
    projects: projects.length,
    complete: complete.length,
    candidate: candidate
      ? {
          tile: candidate.tile,
          local: candidate.local,
          habitationMemory: Math.round(candidate.memory),
          food: +candidate.food.toFixed(1),
          moisture: +candidate.moisture.toFixed(1),
          danger: +(candidate.danger / 10).toFixed(1),
          score: +candidate.score.toFixed(1),
        }
      : null,
    blockers,
    ready: people >= 8 && W.tick >= 1024 && !!candidate,
    next:
      camps.length || settlements.length
        ? projects.length
          ? "Haul matter and build the marked structures"
          : "Expand the built place"
        : blockers.length
          ? blockers.join(" · ")
          : "Founding council will choose a communal home on the next civic update",
  };
}
function ensureProtoSettlement() {
  initializeSocietyState(W);
  if (
    W.camps.some((c) => c.active) ||
    W.settlements.some((s) => !s.ruined) ||
    W.tick < 1024 ||
    biospherePopulation(KINDS.PERSON) < 8
  )
    return null;
  const last = W.civilization.lastCampAttemptTick ?? -2048;
  if (W.tick - last < 512) return null;
  W.civilization.lastCampAttemptTick = W.tick;
  const candidate = protoSettlementCandidate();
  if (!candidate) return null;
  const camp = createCamp(
    candidate.tile,
    candidate.id,
    W.causalIndex.tile[candidate.tile] || W.biosphere?.emergenceEvents?.at(-1) || 0,
  );
  if (!camp) return null;
  W.civilization.firstCampFoundedTick = W.civilization.firstCampFoundedTick ?? W.tick;
  camp.foundingMode = "regional habitation council";
  camp.foundingReadiness = {
    local: candidate.local,
    habitationMemory: Math.round(candidate.memory),
    food: +candidate.food.toFixed(1),
    moisture: +candidate.moisture.toFixed(1),
  };
  for (const id of livingSentientIds()) {
    const memory = W.components.memory[id];
    if (memory && !memory.knownLocations.includes(candidate.tile))
      memory.knownLocations.push(candidate.tile);
    const cognition = W.components.cognition?.[id];
    if (cognition)
      cognition.pendingReward = clamp((cognition.pendingReward || 0) + 64, -LTC_Q, LTC_Q);
  }
  const ev = emitEvent("AdaptationEvent", {
    subjects: [candidate.id, camp.entityId],
    location: candidate.tile,
    causes: [camp.causeEvent || W.biosphere?.emergenceEvents?.at(-1) || 0],
    evidence: [
      "regional habitation memory identified a safe communal home",
      `${candidate.local} nearby people and dispersed social knowledge supported the founding council`,
      `stockpile and shelter remained blueprints requiring hauled matter and visible labor`,
      ...(W.civilization?.legacyProcesses?.length
        ? [
            `stories and ruins preserved ${W.civilization.legacyProcesses.length} crafts of earlier peoples for rediscovery`,
          ]
        : []),
    ],
    importance: 4,
    data: { species: "people-level tool users", stage: "communal home selection", campId: camp.id },
  });
  recordEmergenceEvent(ev.id);
  return camp;
}
const updateSettlementsEmergenceBase = updateSettlements;
updateSettlements = function () {
  const result = updateSettlementsEmergenceBase();
  ensureProtoSettlement();
  return result;
};
const refreshStatsSettlementReadinessBase = refreshStats;
refreshStats = function () {
  refreshStatsSettlementReadinessBase();
  const s = settlementReadinessSummary(),
    status = s.settlements ? "good" : s.camps ? "gold" : s.ready ? "good" : "",
    candidate = s.candidate
      ? `<span>Best social cluster</span><b>${s.candidate.local} nearby · memory ${fmt(s.candidate.habitationMemory)}</b><span>Candidate site</span><b>food ${s.candidate.food} · moisture ${s.candidate.moisture}% · danger ${s.candidate.danger}</b>`
      : "";
  const card = `<div class="subhead">Settlement readiness</div><div class="card"><div class="row between"><b>${s.settlements ? "Permanent settlement established" : s.camps ? "Camp construction underway" : "Communal home selection"}</b><span class="tag ${status}">${s.settlements ? `${s.settlements} settlement${s.settlements === 1 ? "" : "s"}` : s.camps ? `${s.camps} active camp${s.camps === 1 ? "" : "s"}` : s.ready ? "Ready" : "Learning"}</span></div><div class="kv" style="margin-top:8px"><span>People-level population</span><b>${s.people}</b><span>Planned / completed structures</span><b>${s.projects} / ${s.complete}</b>${candidate}<span>Next causal step</span><b>${esc(s.next)}</b></div><div class="divider"></div><small class="muted">Gathered matter cannot become construction until people choose a communal home, mark blueprints, haul the exact materials, and perform the visible building labor.</small></div>`;
  DOM.statsBody.innerHTML = DOM.statsBody.innerHTML.replace(
    `<div class="subhead">Average derived traits</div>`,
    `${card}<div class="subhead">Average derived traits</div>`,
  );
};
const refreshStatsSentienceBase = refreshStats;
refreshStats = function () {
  refreshStatsSentienceBase();
  const s = sentienceContinuitySummary(),
    status = s.viable ? "good" : "red",
    card = `<div class="subhead">Sentient continuity</div><div class="card"><div class="row between"><h4>People-level intelligence</h4><span class="tag ${status}">${s.viable ? "Viable" : "Recovering"}</span></div><div class="kv"><span>Living population</span><b>${s.population}</b><span>Detailed individuals</span><b>${s.detailed}</b><span>Minimum viable floor</span><b>${s.minimumViable}</b><span>Mature / reproduction-ready</span><b>${s.mature} / ${s.reproductionReady}</b><span>Living genetic lineages</span><b>${s.lineages}</b><span>Cellular archive diversity</span><b>${s.archiveDiversity}</b><span>Continuity recoveries</span><b>${s.recoveries}</b></div><div class="divider"></div><small class="muted">Individuals can die. The planet cannot remain without people-level intelligence: a conserved cellular archive rebuilds a diverse sexual community before the lineage becomes reproductively stranded.</small></div>`;
  DOM.statsBody.innerHTML = DOM.statsBody.innerHTML
    .replace(
      `<div class="subhead">Known species</div>`,
      `${card}<div class="subhead">Known species</div>`,
    )
    .replace(/<h4>Person ·/g, "<h4>People-level intelligence ·");
};
const refreshWorldInfoSentienceBase = refreshWorldInfo;
refreshWorldInfo = function () {
  refreshWorldInfoSentienceBase();
  const s = sentienceContinuitySummary(),
    card = `<div class="subhead">Sentience invariant</div><div class="card"><div class="row between"><b>Viable people-level lineage</b><span class="tag ${s.viable ? "good" : "red"}">${s.viable ? "Maintained" : "Recovering"}</span></div><div class="kv" style="margin-top:8px"><span>Population / floor</span><b>${s.population} / ${s.minimumViable}</b><span>Genetic lineages</span><b>${s.lineages} living · ${s.archiveDiversity} archived</b><span>Recovery mechanism</span><b>sexual community from conserved cellular archive</b></div><div class="divider"></div><small class="muted">This is the simulation's anthropic rule: every viable seed eventually and persistently supports tool-using intelligence. It does not make individuals immortal.</small></div>`;
  DOM.worldPane.innerHTML = DOM.worldPane.innerHTML.replace(
    `<div class="subhead">Evolutionary emergence</div>`,
    `${card}<div class="subhead">Evolutionary emergence</div>`,
  );
};
