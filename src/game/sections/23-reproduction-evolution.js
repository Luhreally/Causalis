// ═══════════════════════════════════════════════════════════════════════════
// 23. REPRODUCTION, HEREDITY, AND EVOLUTION
// ═══════════════════════════════════════════════════════════════════════════
function sustainableSexualCapacity(kind) {
  const food = W.statistics.history.at(-1)?.food ?? 10,
    density = Number(W.config.lifeDensity || 1),
    foodFactor = clamp((food - 2) / 8, 0.5, 1.2);
  if (kind === KINDS.HERBIVORE)
    return Math.max(96, Math.floor(W.tileCount * 0.016 * density * foodFactor));
  if (kind === KINDS.PREDATOR) {
    const prey = biospherePopulation(KINDS.HERBIVORE);
    return clamp(
      Math.floor(prey * 0.16),
      6,
      Math.max(6, Math.floor(sustainableSexualCapacity(KINDS.HERBIVORE) * 0.19)),
    );
  }
  const knows = (process) =>
      W.settlements.some(
        (s) =>
          !s.ruined &&
          (s.knownProcesses.includes(process) ||
            (process === "agriculture" && placeHasFacility(s, "farm"))),
      ),
    techLift =
      1 +
      (knows("agriculture") ? 0.6 : 0) +
      (knows("irrigation") ? 0.5 : 0) +
      (knows("waterworks") ? 0.5 : 0) +
      (knows("sanitation") ? 0.4 : 0) +
      (knows("mechanization") ? 0.6 : 0);
  return Math.max(
    40,
    Math.floor(W.tileCount * 0.008 * density * clamp(food / 8, 0.6, 1.3) * techLift),
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
  if (pressure <= 0.78) return true;
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
// Seventy, not sixty: a townsperson works until sixty-eight and then eats a
// mouthful (30d, 117), so a fed adult's hunger sits between fifty-five and
// seventy-five for life, and at sixty the gate refused half the adults of a
// town whose stores were full — measured on battery causal-origin, twenty to
// thirty of forty-five in the fertile window every year, with nobody
// starving. Above seventy a person is hungrier than the point at which they
// would have eaten: that is the quiet belly the gate was written for.
const CONCEPTION_HUNGER = 70,
  PERSON_FERTILE_SHARE = 0.68;
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
    // People have a fertile window; a village grows by generations, not by centenarians.
    // It closed at 0.62 of the lifespan — forty-six years of seventy-five — and on a
    // battery-saver world the founding cohort aged out of it together: at year
    // sixty-four fifty-five of seventy-three adults were past it, eighteen were
    // in it, and the world bore one child a year and died behind its ship. It
    // closes at 0.68 now, fifty-one years, which is the same window a life of
    // seventy-five would be given anywhere else.
    (!social || l.age < body.maxAge * PERSON_FERTILE_SHARE) &&
    // A hungry people does not grow: conception waits until the belly is quiet, so a
    // town meets its food ceiling by fewer births rather than by famine (93 made
    // rested people mate far more, and seed 7 boomed to 249 and starved).
    (!social || l.hunger < CONCEPTION_HUNGER) &&
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
