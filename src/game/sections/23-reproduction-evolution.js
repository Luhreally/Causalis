// ═══════════════════════════════════════════════════════════════════════════
// 23. REPRODUCTION, HEREDITY, AND EVOLUTION
// ═══════════════════════════════════════════════════════════════════════════
function sustainableSexualCapacity(kind) {
  const food = W.statistics.history.at(-1)?.food ?? 10,
    density = Number(W.config.lifeDensity || 1),
    foodFactor = clamp((food - 2) / 8, 0.5, 1.2);
  if (kind === KINDS.HERBIVORE)
    return Math.max(72, Math.floor(W.tileCount * 0.01 * density * foodFactor));
  if (kind === KINDS.PREDATOR)
    return Math.max(8, Math.floor(sustainableSexualCapacity(KINDS.HERBIVORE) * 0.19));
  const agriculture = W.settlements.some(
    (s) => !s.ruined && (s.knownProcesses.includes("agriculture") || placeHasFacility(s, "farm")),
  )
    ? 1.15
    : 1;
  return Math.max(
    24,
    Math.floor(W.tileCount * 0.0042 * density * clamp(food / 8, 0.6, 1.15) * agriculture),
  );
}
let reproductionDensityCache = { tick: -1, byKind: {} };
let reproductionEligibilityCache = { world: null, tick: -1, values: new Map() };
function reproductionDensityAllows(id, kind) {
  if (reproductionDensityCache.tick !== W.tick)
    reproductionDensityCache = { tick: W.tick, byKind: {} };
  const cached =
      reproductionDensityCache.byKind[kind] ||
      (reproductionDensityCache.byKind[kind] = {
        population: biospherePopulation(kind),
        capacity: sustainableSexualCapacity(kind),
      }),
    population = cached.population,
    capacity = cached.capacity;
  if (population >= capacity) return false;
  const pressure = population / capacity;
  if (pressure <= 0.62) return true;
  const remaining = clamp((1 - pressure) / 0.38, 0.05, 1),
    cycle = Math.floor(W.tick / 128);
  return (
    counterRand(
      "sexual-carrying-capacity",
      cycle,
      id,
      kind === KINDS.HERBIVORE ? 1 : kind === KINDS.PREDATOR ? 2 : 3,
    ) < remaining
  );
}
function canReproduce(id) {
  if (reproductionEligibilityCache.world !== W || reproductionEligibilityCache.tick !== W.tick)
    reproductionEligibilityCache = { world: W, tick: W.tick, values: new Map() };
  if (reproductionEligibilityCache.values.has(id))
    return reproductionEligibilityCache.values.get(id);
  const ch = W.components.chemistry[id],
    l = derivedLife(id),
    r = W.components.reproduction[id],
    body = W.components.body[id],
    kind = W.kind[id],
    social = kind === KINDS.PERSON,
    predator = kind === KINDS.PREDATOR;
  const eligible = !!(
    ch &&
    l &&
    r &&
    body &&
    classifyAlive(id) &&
    r.mode === "paired" &&
    r.cooldown <= 0 &&
    l.age > (body.maturityAge ?? 1200) &&
    l.energy > (social ? 22 : predator ? 8 : 30) &&
    l.health > (predator ? 35 : 48) &&
    (predator
      ? ch.q[C.ORGANIC] > 4 || ch.q[C.ENERGY] > 80
      : ch.q[C.ORGANIC] > (social ? 34 : 40)) &&
    ch.q[C.NUTRIENT] > (social ? 16 : predator ? 8 : 20) &&
    ch.q[C.SOLVENT] > (social ? 75 : predator ? 50 : 90) &&
    ch.q[C.INFO] > (predator ? 5 : 16) &&
    ch.q[C.MEMBRANE] > (predator ? 10 : 23) &&
    reproductionDensityAllows(id, kind)
  );
  reproductionEligibilityCache.values.set(id, eligible);
  return eligible;
}
function canJoinPredatorPair(id) {
  if (W.kind[id] !== KINDS.PREDATOR || !classifyAlive(id)) return false;
  const life = derivedLife(id),
    body = W.components.body[id],
    reproduction = W.components.reproduction[id],
    chemistry = W.components.chemistry[id]?.q;
  return !!(
    body &&
    reproduction &&
    chemistry &&
    reproduction.mode === "paired" &&
    reproduction.cooldown <= 0 &&
    life.age > (body.maturityAge ?? 1400) &&
    life.health > 35 &&
    chemistry[C.SOLVENT] > 50 &&
    chemistry[C.INFO] > 5 &&
    chemistry[C.MEMBRANE] > 10 &&
    reproductionDensityAllows(id, KINDS.PREDATOR)
  );
}
function predatorPairHasMatter(first, second) {
  const a = W.components.chemistry[first]?.q,
    b = W.components.chemistry[second]?.q;
  if (!a || !b) return false;
  return (
    a[C.ENERGY] + b[C.ENERGY] > 80 &&
    a[C.ORGANIC] + b[C.ORGANIC] > 20 &&
    a[C.NUTRIENT] + b[C.NUTRIENT] > 16 &&
    a[C.SOLVENT] + b[C.SOLVENT] > 100 &&
    a[C.INFO] + b[C.INFO] > 10 &&
    a[C.MEMBRANE] + b[C.MEMBRANE] > 20
  );
}
function createOffspring(kind, parents, tile) {
  const r = makeRng(hashParts(W.seedHash, W.tick, ...parents), "offspring"),
    p0 = W.components.position[parents[0]],
    beforeTile = Array.from({ length: COMMON_CHEM }, (_, s) => W.tiles.chem[s][tile]),
    beforeInitial = W.conservation.initialMatter,
    id = createOrganism(kind, p0.x, p0.y, r, parents, tile, 0),
    childQ = W.components.chemistry[id].q;
  for (let s = 0; s < COMMON_CHEM; s++) W.tiles.chem[s][tile] = beforeTile[s];
  W.conservation.initialMatter = beforeInitial;
  for (let s = 0; s < SPECIES_COUNT; s++) {
    let need = childQ[s];
    for (const par of parents) {
      const pq = W.components.chemistry[par].q,
        take = Math.min(pq[s], Math.ceil(need / (parents.length - parents.indexOf(par))));
      pq[s] -= take;
      need -= take;
      if (need <= 0) break;
    }
    if (need > 0) childQ[s] -= need;
  }
  const ev = emitEvent("BirthEvent", {
    subjects: [id, ...parents],
    location: tile,
    causes: parents.map((x) => W.components.identity[x].birthEventId),
    evidence: ["stored parent matter formed a new bounded network"],
    importance: kind === KINDS.PERSON ? 2 : 1,
  });
  W.components.identity[id].birthEventId = ev.id;
  for (const par of parents) {
    W.components.identity[par].children.push(id);
    linkKin(par, id, ev.id);
    W.components.reproduction[par].cooldown =
      180 + Math.floor(counterRand("reproduction-cooldown", W.tick, par) * 140);
  }
  const g = W.components.genome[id],
    base = W.components.genome[parents[0]],
    delta = mean(
      g.instructions.map((x, i) =>
        Math.abs(x.expression - (base.instructions[i]?.expression || 0)),
      ),
    );
  if (delta > W.laws.mutationIntensity * 0.18) {
    const mev = emitEvent("MutationEvent", {
      subjects: [id, ...parents],
      location: tile,
      causes: [ev.id],
      evidence: ["imperfect information-polymer copying"],
      magnitude: delta,
      importance: 1,
    });
    W.components.memory[id].rememberedEvents.push(mev.id);
  }
  W.statistics.births++;
  return id;
}
function makeCohortBirthMatter(parents) {
  const chemistry = new Uint16Array(SPECIES_COUNT);
  for (const sp of [C.SOLVENT, C.ORGANIC, C.ENERGY, C.NUTRIENT, C.INFO, C.MEMBRANE, C.FIBER]) {
    const desired = sp === C.SOLVENT ? 80 : sp === C.ORGANIC ? 45 : sp === C.ENERGY ? 32 : 8;
    for (let index = 0; index < parents.length; index++) {
      const q = W.components.chemistry[parents[index]].q,
        remaining = desired - chemistry[sp],
        take = Math.min(q[sp], Math.ceil(remaining / Math.max(1, parents.length - index)));
      q[sp] -= take;
      chemistry[sp] += take;
    }
  }
  return chemistry;
}
function updateReproduction() {
  const ids = W.activeIds
      .filter(
        (id) =>
          [KINDS.HERBIVORE, KINDS.PREDATOR, KINDS.PERSON].includes(W.kind[id]) && canReproduce(id),
      )
      .sort((a, b) => a - b),
    used = new Set();
  for (const id of ids) {
    if (used.has(id)) continue;
    const kind = W.kind[id],
      p = W.components.position[id],
      mates = nearbyIds(
        id,
        2,
        (o) => o > id && W.kind[o] === kind && canReproduce(o) && !used.has(o),
      ),
      mate = mates[0];
    if (!mate) continue;
    const capacity = activeCount(kind) < CAPS[kind],
      parents = [id, mate],
      tile = idx(p.x, p.y);
    if (capacity) createOffspring(kind, parents, tile);
    else {
      const r = makeRng(hashParts(W.seedHash, W.tick, id, mate), "cohort-birth"),
        g = genomeFrom(r, kind, W.components.genome[id], W.components.genome[mate]),
        chem = makeCohortBirthMatter(parents);
      addBirthToCohort(kind, p.regionId, parents, chem, g);
      for (const par of parents) W.components.reproduction[par].cooldown = 240;
    }
    used.add(id);
    used.add(mate);
  }
}
