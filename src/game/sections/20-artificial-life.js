// ═══════════════════════════════════════════════════════════════════════════
// 20. ARTIFICIAL-LIFE SYSTEMS
// ═══════════════════════════════════════════════════════════════════════════
function recordEmergenceEvent(eventId) {
  if (!eventId || !W?.biosphere) return eventId;
  const events = W.biosphere.emergenceEvents || (W.biosphere.emergenceEvents = []);
  events.push(eventId);
  if (events.length > 256) events.splice(0, events.length - 256);
  return eventId;
}
function habitatScore(i, kind = "person") {
  const temp = W.tiles.temperature[i] / 10,
    food = tileFood(
      i,
      kind === KINDS.PREDATOR ? "predator" : kind === KINDS.PERSON ? "omnivore" : "grazer",
    ),
    water = tileMoisture(i),
    n = ecologicalNicheAt(i),
    hazard =
      tileDisease(i) * 1.8 +
      W.tiles.danger[i] / 20 +
      W.tiles.fire[i] / 8 +
      (W.tiles.liquid[i] > WATER_DEPTH.WADE_LIMIT ? 120 : 0) +
      n.hazard,
    thermal =
      Math.abs(temp - 20) *
      (kind === KINDS.PREDATOR ? 0.7 : 1) *
      (1 - clamp(n.thermalBuffer, 0, 0.8));
  return (
    food * 1.6 +
    water +
    tileFertility(i) * 0.35 +
    n.shelter * 18 +
    (n[kind] || 0) -
    hazard -
    thermal
  );
}
function findSeparatedOrigins(r, count = 6) {
  const minSep = Math.max(18, Math.floor(Math.min(W.width, W.height) * 0.3)),
    sep2 = minSep * minSep,
    picked = [];
  for (let n = 0; n < count; n++) {
    const kind = n % 3 === 0 ? "person" : "herbivore";
    let best = -1,
      bestScore = -1e9;
    for (let k = 0; k < 900; k++) {
      const i = r.int(W.tileCount);
      if (W.tiles.elevation[i] <= (W.terrainGenome?.seaLevel ?? 430) - 15) continue;
      const [x, y] = xy(i);
      let clear = true;
      for (let q2 = 0; q2 < picked.length; q2++) {
        const [px2, py2] = xy(picked[q2]);
        if (dist2(x, y, px2, py2) < sep2) {
          clear = false;
          break;
        }
      }
      const s = habitatScore(i, kind) - (clear ? 0 : 1e5);
      if (s > bestScore) {
        bestScore = s;
        best = i;
      }
    }
    picked.push(best >= 0 ? best : findHabitable(r, kind));
  }
  return picked;
}
function findHabitable(rng, kind = "person") {
  let best = 0,
    score = -1e9;
  for (let k = 0; k < 700; k++) {
    const i = rng.int(W.tileCount),
      s = habitatScore(i, kind);
    if (W.tiles.elevation[i] > (W.terrainGenome?.seaLevel ?? 430) - 15 && s > score) {
      score = s;
      best = i;
    }
  }
  return best;
}
function findSeparatedHabitats(rng, kind, count) {
  const selected = [],
    separation = Math.max(3, Math.floor(Math.min(W.width, W.height) / 18)),
    separation2 = separation * separation;
  for (let n = 0; n < count; n++) {
    let best = -1,
      bestScore = -Infinity;
    for (let attempt = 0; attempt < 500; attempt++) {
      const tile = rng.int(W.tileCount),
        [x, y] = xy(tile);
      if (W.tiles.elevation[tile] <= (W.terrainGenome?.seaLevel ?? 430) - 15) continue;
      const nearest = selected.length
          ? Math.min(
              ...selected.map((other) => {
                const [ox, oy] = xy(other);
                return dist2(x, y, ox, oy);
              }),
            )
          : Infinity,
        score = habitatScore(tile, kind) - (nearest < separation2 ? 1e5 : 0);
      if (score > bestScore) {
        best = tile;
        bestScore = score;
      }
    }
    selected.push(best >= 0 ? best : findHabitable(rng, kind));
  }
  return selected;
}
function findPairedRescueHabitats(rng, kind, count) {
  const living = W.activeIds
      .filter((id) => W.kind[id] === kind && classifyAlive(id))
      .sort((a, b) => (W.components.life[b]?.age || 0) - (W.components.life[a]?.age || 0) || a - b),
    anchor = living.length
      ? idx(W.components.position[living[0]].x, W.components.position[living[0]].y)
      : findHabitable(rng, kind),
    [cx, cy] = xy(anchor),
    candidates = [];
  for (let radius = 1; radius <= 7; radius++)
    for (let y = cy - radius; y <= cy + radius; y++)
      for (let x = cx - radius; x <= cx + radius; x++) {
        if (!inside(x, y) || Math.max(Math.abs(x - cx), Math.abs(y - cy)) !== radius) continue;
        const tile = idx(x, y);
        if (
          W.tiles.elevation[tile] <= (W.terrainGenome?.seaLevel ?? 430) - 15 ||
          W.tiles.fire[tile] > 100 ||
          W.tiles.liquid[tile] > WATER_DEPTH.WADE_LIMIT
        )
          continue;
        candidates.push({
          tile,
          score:
            habitatScore(tile, kind) -
            radius * 4 +
            counterRand("paired-refuge-tile", W.tick, anchor, tile) * 0.01,
        });
      }
  const selected = candidates
    .sort((a, b) => b.score - a.score || a.tile - b.tile)
    .slice(0, count)
    .map((candidate) => candidate.tile);
  if (selected.length < count)
    for (const tile of findSeparatedHabitats(rng, kind, count - selected.length))
      if (!selected.includes(tile)) selected.push(tile);
  return selected.slice(0, count);
}
function compileCellularResilienceGenome() {
  const candidates = [];
  for (let i = 0; i < W.tileCount; i += Math.max(1, Math.floor(W.tileCount / 720))) {
    if (
      W.tiles.elevation[i] < (W.terrainGenome?.seaLevel ?? 430) - 15 ||
      W.tiles.liquid[i] > WATER_DEPTH.WADE_LIMIT
    )
      continue;
    candidates.push({
      i,
      score: Math.max(habitatScore(i, "person"), habitatScore(i, "herbivore")),
    });
  }
  candidates.sort((a, b) => b.score - a.score || a.i - b.i);
  const selected = candidates.slice(0, Math.max(24, Math.floor(candidates.length * 0.18))),
    temps = selected.map((x) => W.tiles.temperature[x.i] / 10),
    moistures = selected.map((x) => tileMoisture(x.i)),
    toxins = selected.map(
      (x) => (W.tiles.chem[C.TOXIN][x.i] + W.tiles.chem[C.PATHOGEN][x.i]) / 1200,
    ),
    thermalSpan = Math.max(...temps.map((t) => Math.abs(t - 20)), 0),
    dryness = 1 - mean(moistures) / 100,
    toxinPressure = mean(toxins),
    chemistryFitness = W.viability.passed / W.viability.total,
    genes = {
      0: clamp(0.72 + chemistryFitness * 0.16, 0.72, 0.94),
      1: clamp(0.7 + dryness * 0.25, 0.7, 0.96),
      2: 0.82,
      3: 0.9,
      6: 0.74,
      7: 0.76,
      9: 0.72,
      10: clamp(0.68 + toxinPressure * 0.24, 0.68, 0.96),
      11: clamp(0.68 + thermalSpan / 95, 0.68, 0.98),
      12: 0.68,
    },
    viability = clamp(
      chemistryFitness * 0.58 + clamp((mean(selected.map((x) => x.score)) + 80) / 220, 0, 1) * 0.42,
      0,
      1,
    );
  return {
    genes,
    viability: +viability.toFixed(3),
    cellularGenerations: 1200 + (W.seedHash % 3600),
    thermalEnvelope: [Math.min(...temps), Math.max(...temps)],
    hydrationEnvelope: [Math.min(...moistures), Math.max(...moistures)],
    selectedRefugia: selected.slice(0, 12).map((x) => x.i),
  };
}
function tuneGenomeToHabitat(id, tile, strength = 0.5, stage = "multicellular", generation = 0) {
  const g = W.components.genome[id],
    life = W.components.life[id],
    body = W.components.body[id],
    rep = W.components.reproduction[id],
    temp = W.tiles.temperature[tile] / 10,
    moist = tileMoisture(tile),
    toxin = tileDisease(tile) / 100 + W.tiles.chem[C.TOXIN][tile] / 1200,
    inherited = W.biosphere?.cellularAdaptation?.genes || {},
    targets = {
      ...inherited,
      0: Math.max(inherited[0] || 0, 0.72),
      1: Math.max(inherited[1] || 0, moist < 32 ? 0.92 : 0.72),
      2: Math.max(inherited[2] || 0, 0.78),
      3: Math.max(inherited[3] || 0, 0.86),
      6: 0.72,
      7: 0.72,
      9: 0.72,
      10: Math.max(inherited[10] || 0, clamp(0.62 + toxin * 0.34, 0.62, 0.97)),
      11: Math.max(inherited[11] || 0, clamp(0.62 + Math.abs(temp - 20) / 58, 0.62, 0.98)),
      12: 0.66,
    };
  for (const [index, target] of Object.entries(targets)) {
    const gene = g.instructions[index];
    gene.expression = +clamp(lerp(gene.expression, target, strength), 0.08, 0.98).toFixed(3);
    gene.active = true;
  }
  g.polymer = g.instructions.map((gene) => Math.floor(gene.expression * 35).toString(36)).join("");
  g.dirty = true;
  g.emergenceStage = stage;
  g.generation = generation;
  g.cellularResilience = Object.keys(inherited).length ? { ...inherited } : null;
  life.emergenceStage = stage;
  life.generation = generation;
  life.acclimation = { temperature: temp, hydration: moist / 100, toxin: clamp(toxin, 0, 1) };
  body.coldTolerance = Math.min(-8, temp - 12 - Math.abs(temp - 20) * 0.18);
  rep.mode = "paired";
  rep.cooldown = Math.max(
    rep.cooldown,
    420 + Math.floor(counterRand("founder-cooldown", tile, id) * 220),
  );
  compilePhenotype(id);
  derivedLife(id);
  return id;
}
function kindReproductionMode() {
  return "paired";
}
function cloneGenome(g) {
  return {
    polymer: g.polymer,
    instructions: g.instructions.map((x) => ({ ...x })),
    lineageId: g.lineageId,
    ancestorSignature: g.ancestorSignature,
    mutationRate: g.mutationRate,
    emergenceStage: g.emergenceStage,
    generation: g.generation,
    dirty: true,
  };
}
function bankDormantFounder(id, tile) {
  if (!W.kind[id] || UI.followId === id || UI.selectedEntity === id) return null;
  const g = W.components.genome[id],
    inventory = W.components.inventory[id],
    refuge = {
      id: W.biosphere.refugia.length + 1,
      kind: W.kind[id],
      homeTile: tile,
      chemistry: new Uint16Array(W.components.chemistry[id].q),
      materials: new Uint16Array(inventory?.materials || SPECIES_COUNT),
      digestive: new Uint16Array(inventory?.digestive || SPECIES_COUNT),
      genome: cloneGenome(g),
      stage: g.emergenceStage || "multicellular",
      generation: g.generation || 0,
      available: true,
      bankedTick: W.tick,
      germinatedTick: -1,
    };
  groundOwnedArtifacts(id, W.components.position[id]);
  W.biosphere.refugia.push(refuge);
  removeEntity(id);
  return refuge;
}
function createFounder(kind, tile, rng, stage, eventId, bank = false) {
  const [cx, cy] = xy(tile);
  let best = tile,
    bestScore = habitatScore(tile, kind);
  for (let n = 0; n < 18; n++) {
    const x = clamp(cx + rng.int(9) - 4, 0, W.width - 1),
      y = clamp(cy + rng.int(9) - 4, 0, W.height - 1),
      i = idx(x, y),
      score = habitatScore(i, kind);
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  }
  const [x, y] = xy(best),
    id = createOrganism(kind, x, y, rng, [], best, 0);
  tuneGenomeToHabitat(id, best, 0.78, stage, 0);
  if (bank) return bankDormantFounder(id, best);
  const ev = emitEvent("BirthEvent", {
    subjects: [id],
    location: best,
    causes: [eventId],
    evidence: [`${stage} founder passed local viability selection`],
    importance: 1,
  });
  W.components.identity[id].birthEventId = ev.id;
  if (kind === KINDS.PERSON) {
    W.tiles.habitation[best] = u16(W.tiles.habitation[best] + 260);
    W.components.memory[id].knownLocations.push(tile);
  }
  return id;
}
function bootstrapWorld() {
  const r = makeRng(W.seed, "deep-time-bootstrap");
  let matter = (W.reservoirs?.atmosphericSolvent || 0) + (W.reservoirs?.deepMineral || 0);
  for (const q of W.tiles.chem) for (const v of q) matter += v;
  W.conservation.initialMatter = matter;
  const genesis = emitEvent("ChemistryEvent", {
      location: -1,
      evidence: [`${W.viability.passed}/${W.viability.total} viability probes passed`],
      importance: 4,
      data: {
        text: "Stable phases, energy gradients, catalysts, and information polymers assembled",
      },
    }),
    origins = findSeparatedOrigins(r, 6);
  const proto = emitEvent("AbiogenesisEvent", {
    location: origins[0],
    causes: [genesis.id],
    evidence: ["autocatalytic metabolism", "persistent membrane", "heritable information copying"],
    importance: 4,
    data: { stage: "cellular" },
  });
  const density = Number(W.config.lifeDensity || 1),
    personCount = Math.max(15, Math.floor(18 * density)),
    herbCount = Math.max(36, Math.floor(64 * density)),
    predCount = Math.max(6, Math.floor(14 * density)),
    siteScores = [0, 1, 2].map((k) => Math.max(1, habitatScore(origins[k], "person"))),
    siteTot = siteScores[0] + siteScores[1] + siteScores[2];
  let pa0 = Math.max(4, Math.round((personCount * siteScores[0]) / siteTot)),
    pa1 = Math.max(4, Math.round((personCount * siteScores[1]) / siteTot)),
    pa2 = personCount - pa0 - pa1;
  if (pa2 < 4) {
    pa2 = 4;
    pa1 = Math.max(4, personCount - pa0 - pa2);
    pa0 = Math.max(4, personCount - pa1 - pa2);
  }
  if ((W.config.origin || "radiation") === "cellular") {
    W.biosphere.stage = "cellular";
    W.biosphere.stageTick = 0;
    W.biosphere.emergenceEvents = [proto.id];
    W.biosphere.emergencePlan = {
      phase: 0,
      origins: origins.slice(0, 3),
      genesisId: proto.id,
      personAlloc: [pa0, pa1, pa2],
      spawnedPeople: [0, 0, 0],
      herbCount,
      predCount,
      personCount,
    };
  } else {
    const colony = emitEvent("AdaptationEvent", {
        location: origins[0],
        causes: [proto.id],
        evidence: ["cooperative cell colonies", "division of chemical labor"],
        importance: 4,
        data: { species: "founder cells", stage: "colonial" },
      }),
      multi = emitEvent("SpeciesDivergenceEvent", {
        location: origins[1],
        causes: [colony.id],
        evidence: ["stable multicellular adhesion", "specialized transport and regulation"],
        importance: 4,
        data: { species: "multicellular founder networks", stage: "multicellular" },
      }),
      radiation = emitEvent("ChemistryEvent", {
        location: origins[2],
        causes: [multi.id],
        evidence: ["multiple occupied refugia", "producer, grazer, hunter, and social niches"],
        importance: 4,
        data: { text: "Habitat-filtered multicellular lineages entered adaptive radiation" },
      });
    W.biosphere.stage = "adaptive radiation";
    W.biosphere.stageTick = 0;
    W.biosphere.emergenceEvents = [proto.id, colony.id, multi.id, radiation.id];
    for (const [site, count] of [
      [0, pa0],
      [1, pa1],
      [2, pa2],
    ])
      for (let m = 0; m < count; m++)
        createFounder(KINDS.PERSON, origins[site], r, "multicellular social", multi.id);
    for (let n = 0; n < herbCount; n++)
      createFounder(
        KINDS.HERBIVORE,
        origins[n % origins.length],
        r,
        "multicellular grazer",
        radiation.id,
      );
    for (let n = 0; n < predCount; n++)
      createFounder(
        KINDS.PREDATOR,
        origins[(n + 1) % origins.length],
        r,
        "multicellular hunter",
        radiation.id,
      );
    for (const kind of [KINDS.PERSON, KINDS.HERBIVORE, KINDS.PREDATOR])
      for (let n = 0; n < (kind === KINDS.PREDATOR ? 3 : 5); n++)
        createFounder(
          kind,
          origins[
            (n + (kind === KINDS.PERSON ? 0 : kind === KINDS.HERBIVORE ? 1 : 2)) % origins.length
          ],
          r,
          "dormant propagule",
          radiation.id,
          true,
        );
  }
  rebuildSpatialBins();
  recordStatistics();
  worldHash();
}
const bootstrapWorldCellular = bootstrapWorld;
bootstrapWorld = function () {
  W.biosphere.cellularAdaptation = compileCellularResilienceGenome();
  W.biosphere.stage = "cellular selection";
  W.biosphere.stageTick = -W.biosphere.cellularAdaptation.cellularGenerations;
  bootstrapWorldCellular();
};
const bootstrapWorldBase = bootstrapWorld;
bootstrapWorld = function () {
  bootstrapWorldBase();
  W.conservation.initialMatter = totalMatter();
  W.conservation.initialChemicalEnergy = totalChemicalEnergy();
  worldHash();
};
const bootstrapWorldSeedBankBase = bootstrapWorld;
function topUpSeedBank() {
  const targets = { [KINDS.HERBIVORE]: 6, [KINDS.PREDATOR]: 4, [KINDS.PERSON]: 12 },
    tiles = W.biosphere.cellularAdaptation?.selectedRefugia || [],
    r = makeRng(W.seed, "standard-sexual-seed-bank");
  for (const kind of [KINDS.HERBIVORE, KINDS.PREDATOR, KINDS.PERSON]) {
    let available = W.biosphere.refugia.filter(
      (refuge) => refuge.available && refuge.kind === kind,
    ).length;
    while (available < targets[kind]) {
      const tile =
        tiles[
          (available + (kind === KINDS.PERSON ? 0 : kind === KINDS.HERBIVORE ? 3 : 7)) %
            Math.max(1, tiles.length)
        ] ?? findHabitable(r, kind);
      createFounder(
        kind,
        tile,
        r,
        "dormant sexual propagule",
        W.biosphere.emergenceEvents.at(-1),
        true,
      );
      available++;
    }
  }
}
bootstrapWorld = function () {
  bootstrapWorldSeedBankBase();
  if (!(W.biosphere.emergencePlan && W.biosphere.emergencePlan.phase < 5)) topUpSeedBank();
  W.biosphere.lastBankTickByKind = W.biosphere.lastBankTickByKind || {};
  W.conservation.initialMatter = totalMatter();
  W.conservation.initialChemicalEnergy = totalChemicalEnergy();
  worldHash();
};
function biospherePopulation(kind) {
  let count = 0;
  for (const id of W.activeIds) if (W.kind[id] === kind && classifyAlive(id)) count++;
  for (const cohort of W.cohorts) if (cohort.kind === kind) count += cohort.count;
  return count;
}
function germinateRefuge(refuge, targetTile = null) {
  if (!refuge?.available) return 0;
  if (W.biosphere.emergencePlan && W.biosphere.emergencePlan.phase < 5) return 0;
  const r = makeRng(hashParts(W.seedHash, W.tick, refuge.id, refuge.kind), "dormancy-exit"),
    tile = targetTile ?? findHabitable(r, refuge.kind),
    [x, y] = xy(tile),
    beforeTile = Array.from({ length: COMMON_CHEM }, (_, s) => W.tiles.chem[s][tile]),
    beforeInitial = W.conservation.initialMatter,
    id = createOrganism(refuge.kind, x, y, r, [], tile, 0),
    q = W.components.chemistry[id].q,
    inventory = W.components.inventory[id];
  for (let s = 0; s < COMMON_CHEM; s++) W.tiles.chem[s][tile] = beforeTile[s];
  W.conservation.initialMatter = beforeInitial;
  q.set(refuge.chemistry);
  inventory.materials.set(refuge.materials || []);
  inventory.digestive.set(refuge.digestive || []);
  refuge.chemistry.fill(0);
  refuge.materials?.fill(0);
  refuge.digestive?.fill(0);
  refuge.available = false;
  refuge.germinatedTick = W.tick;
  W.components.genome[id] = cloneGenome(refuge.genome);
  W.components.genome[id].generation = (refuge.generation || 0) + 1;
  tuneGenomeToHabitat(
    id,
    tile,
    0.78,
    refuge.stage || "dormancy survivor",
    W.components.genome[id].generation,
  );
  W.components.life[id].integrity = Math.max(W.components.life[id].integrity, 900);
  W.components.life[id].regulation = Math.max(W.components.life[id].regulation, 900);
  const ev = emitEvent("BirthEvent", {
    subjects: [id],
    location: tile,
    causes: [W.lastEventByType.ExtinctionEvent, W.biosphere.emergenceEvents.at(-1)],
    evidence: [
      "dormant cellular propagule exited quiescence",
      "stored founder matter developed into a sexually reproducing creature",
    ],
    importance: 3,
    data: { stage: "dormancy exit", refugeId: refuge.id },
  });
  W.components.identity[id].birthEventId = ev.id;
  W.biosphere.rescueCount++;
  W.biosphere.lastRescueTick = W.tick;
  return id;
}
function updateBiosphereResilience() {
  if (!W.biosphere) return;
  const floors = {
      [KINDS.HERBIVORE]: Math.max(30, Math.floor(W.tileCount / 400)),
      [KINDS.PREDATOR]: Math.max(6, Math.floor(W.tileCount / 2400)),
      [KINDS.PERSON]: 8,
    },
    reserveTargets = { [KINDS.HERBIVORE]: 4, [KINDS.PREDATOR]: 3, [KINDS.PERSON]: 8 },
    bankTicks = W.biosphere.lastBankTickByKind || (W.biosphere.lastBankTickByKind = {});
  let persistent = true;
  for (const kind of [KINDS.HERBIVORE, KINDS.PREDATOR, KINDS.PERSON]) {
    const population = biospherePopulation(kind),
      floor = floors[kind];
    if (population < floor) persistent = false;
    if (population < floor) {
      const refuges = W.biosphere.refugia
          .filter((x) => x.available && x.kind === kind)
          .sort(
            (a, b) =>
              habitatScore(b.homeTile, kind) - habitatScore(a.homeTile, kind) || a.id - b.id,
          ),
        needed = Math.max(1, floor - population);
      if (refuges.length) {
        const r = makeRng(
            hashParts(W.seedHash, W.tick, kind, "paired-refuge"),
            "paired-dormancy-exit",
          ),
          selected = refuges.slice(0, needed),
          targets =
            kind === KINDS.PREDATOR
              ? findPairedRescueHabitats(r, kind, selected.length)
              : findSeparatedHabitats(r, kind, selected.length);
        selected.forEach((refuge, index) => germinateRefuge(refuge, targets[index]));
      }
    }
    const available = W.biosphere.refugia.filter((x) => x.available && x.kind === kind).length;
    if (
      W.tick - (bankTicks[kind] || 0) >= 1024 &&
      population > floor * 2 &&
      available < reserveTargets[kind]
    ) {
      const candidate = W.activeIds
        .filter(
          (id) =>
            W.kind[id] === kind &&
            classifyAlive(id) &&
            W.components.life[id].age < 240 &&
            !W.components.identity[id].notable,
        )
        .sort((a, b) => W.components.life[a].age - W.components.life[b].age || a - b)[0];
      if (candidate) {
        const p = W.components.position[candidate];
        if (bankDormantFounder(candidate, idx(p.x, p.y))) bankTicks[kind] = W.tick;
      }
    }
  }
  if (persistent && W.tick >= 512 && W.biosphere.stage !== "persistent biosphere") {
    W.biosphere.stage = "persistent biosphere";
    W.biosphere.stageTick = W.tick;
    const ev = emitEvent("AdaptationEvent", {
      causes: W.biosphere.emergenceEvents.slice(-2),
      evidence: [
        "all major niches remained above minimum viable population",
        "dormant refugia retained evolutionary memory",
      ],
      importance: 4,
      data: { species: "planetary biosphere", stage: "persistent biosphere" },
    });
    recordEmergenceEvent(ev.id);
  }
}
function updateArtificialLife() {
  const ids = W.activeIds.slice().sort((a, b) => a - b);
  for (const id of ids) {
    const k = W.kind[id];
    if (k !== KINDS.HERBIVORE && k !== KINDS.PREDATOR && k !== KINDS.PERSON) continue;
    if (!classifyAlive(id)) continue;
    const forcedHealthUpdate = W.components.life[id]?.forceHealthUpdateTick === W.tick,
      tier = detailTier(id);
    if (tier === "simplified" && !forcedHealthUpdate) continue;
    const effectiveTier = forcedHealthUpdate ? "detailed" : tier;
    runMetabolism(id, effectiveTier);
    chooseBehavior(id, effectiveTier);
    updateHealth(id, simulationStrideForTier(effectiveTier));
    if (forcedHealthUpdate && W.components.life[id])
      delete W.components.life[id].forceHealthUpdateTick;
    if (UI.clockInterrupted && UI.deathInterruptTick === W.tick) break;
  }
  resolveEffects();
}
