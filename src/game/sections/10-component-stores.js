// ═══════════════════════════════════════════════════════════════════════════
// 10. COMPONENT STORES
// ═══════════════════════════════════════════════════════════════════════════
function blankChem() {
  return {
    q: new Uint16Array(SPECIES_COUNT),
    temperature: 210,
    storedFreeEnergy: 0,
    chargeBalance: 0,
    structuralOrder: 0,
    phaseFractions: { solid: 65, liquid: 32, gas: 3 },
  };
}
function genomeFrom(rng, kind, parentA = null, parentB = null) {
  const funcs = [
      "catalyst",
      "membrane",
      "transport",
      "regulation",
      "support",
      "pigment",
      "growth",
      "receptor",
      "actuator",
      "reproduction",
      "detox",
      "thermal",
      "signal",
    ],
    instructions = [];
  for (let i = 0; i < 13; i++) {
    const pa = parentA?.instructions?.[i],
      pb = parentB?.instructions?.[i],
      base =
        pa && pb
          ? (rng.next() < 0.5 ? pa : pb).expression
          : (pa?.expression ?? 0.35 + rng.next() * 0.55),
      mutation = (rng.next() - 0.5) * W.laws.mutationIntensity;
    instructions.push({
      function: funcs[i],
      expression: +clamp(base + mutation, 0.08, 0.98).toFixed(3),
      active: !(rng.next() < W.laws.mutationIntensity * 0.02),
      copies: 1 + (rng.next() < W.laws.mutationIntensity * 0.04 ? 1 : 0),
    });
  }
  return {
    polymer: instructions.map((g) => Math.floor(g.expression * 35).toString(36)).join(""),
    instructions,
    lineageId:
      parentA?.lineageId || parentB?.lineageId || hashParts(W.seedHash, kind, W.nextEntityId),
    ancestorSignature:
      parentA?.ancestorSignature || hashParts(W.seedHash, kind, "founder", W.nextEntityId),
    mutationRate: W.laws.mutationIntensity,
    dirty: true,
  };
}
function compilePhenotype(id) {
  const g = W.components.genome[id],
    b = W.components.body[id],
    ch = W.components.chemistry[id],
    ins = g.instructions,
    ex = (n) => (ins[n]?.active ? ins[n].expression * ins[n].copies : 0),
    energy = ch.q[C.ENERGY],
    mass = Math.max(20, sum(Array.from(ch.q))),
    support = ex(4) + ch.q[C.BONE] / 500,
    actuator = ex(8) + b.tissues.actuator / 100,
    speed = clamp((actuator * (0.8 + energy / 900)) / (mass / 500 + 1), 0.25, 2.5),
    size = clamp(Math.sqrt(mass) / 14, 0.45, 2.2),
    sense = clamp((ex(7) + b.tissues.sensory / 100) * 3, 1, 7),
    resist = clamp((ex(10) + ex(1) + b.tissues.boundary / 130) * 0.45, 0, 1),
    heatTol = 15 + ex(11) * 38,
    aggression = clamp(
      ex(8) * 0.45 + ex(12) * 0.25 + (W.kind[id] === KINDS.PREDATOR ? 0.35 : 0),
      0,
      1,
    ),
    social = clamp(ex(12) * 0.65 + ex(3) * 0.25, 0, 1),
    cooperation = clamp(social - aggression * 0.25, 0, 1),
    fertility = clamp((ex(9) * (0.5 + ch.q[C.NUTRIENT] / 500)) / W.laws.reproductionCost, 0, 1.5),
    hue = (ch.q[C.PIGMENT] + Math.floor(ex(5) * 320) + id * 17) % 360;
  b.mass = mass;
  b.size = size;
  b.speed = speed;
  b.integrity = W.components.life[id].integrity;
  b.armor = clamp(support * 0.3, 0, 1.5);
  g.phenotype = {
    speed,
    size,
    sense,
    diseaseResistance: resist,
    heatTolerance: heatTol,
    aggression,
    social,
    cooperation,
    fertility,
    hue,
    metabolism: clamp(ex(0) * W.laws.metabolicEfficiency, 0.25, 1.7),
  };
  g.dirty = false;
  return g.phenotype;
}
function phenotype(id) {
  const g = W.components.genome[id];
  return g?.dirty || !g?.phenotype ? compilePhenotype(id) : g.phenotype;
}
function classifyAlive(id) {
  const l = W.components.life[id],
    ch = W.components.chemistry[id],
    g = W.components.genome[id];
  if (!l || !ch || !g) return false;
  const alive = l.regulation > 0 && l.integrity > 0 && ch.q[C.INFO] > 0 && ch.q[C.MEMBRANE] > 0;
  l.alive = alive;
  return alive;
}
function derivedLife(id) {
  const l = W.components.life[id],
    ch = W.components.chemistry[id],
    p = phenotype(id),
    energy = ch.q[C.ENERGY],
    solvent = ch.q[C.SOLVENT],
    tox = ch.q[C.TOXIN],
    path = ch.q[C.PATHOGEN];
  l.energy = clamp(energy / 6, 0, 100);
  l.hunger = clamp(100 - energy / 5, 0, 100);
  l.thirst = clamp(100 - solvent / 5, 0, 100);
  l.health = clamp(l.integrity / 10 - tox / 20 - (path * (1 - p.diseaseResistance)) / 14, 0, 100);
  l.infected = path > 18;
  l.wounded = l.integrity < 760;
  l.fatigue = clamp(Number.isFinite(l.fatigue) ? l.fatigue : 0, 0, 100);
  return l;
}
function createOrganism(kind, x, y, rng, parents = [], sourceTile = -1, divineInput = 0) {
  const id = allocEntity(kind),
    tile = sourceTile >= 0 ? sourceTile : idx(x, y),
    chem = blankChem(),
    q = chem.q,
    tq = W.tiles.chem;
  const bodyMass = kind === KINDS.PREDATOR ? 430 : kind === KINDS.PERSON ? 360 : 300,
    needs = [
      [C.SOLVENT, Math.round(bodyMass * 0.45)],
      [C.ORGANIC, Math.round(bodyMass * 0.24)],
      [C.ENERGY, Math.round(bodyMass * 0.18)],
      [C.NUTRIENT, Math.round(bodyMass * 0.08)],
      [C.CATALYST, 12],
      [C.INFO, 9],
      [C.MEMBRANE, 16],
      [C.PIGMENT, 5],
      [C.FIBER, 20],
      [C.BONE, kind === KINDS.PREDATOR ? 35 : 20],
    ];
  for (const [sp, amt] of needs) {
    let got = 0;
    if (sp < COMMON_CHEM) {
      got = Math.min(amt, tq[sp][tile]);
      tq[sp][tile] -= got;
    }
    if (got < amt) {
      const add = amt - got;
      q[sp] += add;
      if (divineInput) W.conservation.playerInput += add;
      else W.conservation.initialMatter += add;
    }
    q[sp] += got;
  }
  chem.storedFreeEnergy = q[C.ENERGY] * W.definitions.species[C.ENERGY].freeEnergy;
  chem.structuralOrder = 760;
  const pg = parents[0] ? W.components.genome[parents[0]] : null,
    qg = parents[1] ? W.components.genome[parents[1]] : null,
    g = genomeFrom(rng, kind, pg, qg),
    name = generatedName(rng, kind === KINDS.PERSON);
  W.components.position[id] = { x, y, layer: 0, regionId: regionId(x, y) };
  W.components.chemistry[id] = chem;
  W.components.genome[id] = g;
  W.components.structure[id] = {
    patternId: 13,
    order: 760,
    porosity: 0.32,
    connectivity: 0.78,
    integrity: 1000,
    grainScale: 0.2,
    surfaceArea: 0.6,
    boundaryStrength: 0.72,
  };
  W.components.body[id] = {
    mass: bodyMass,
    size: 1,
    speed: 1,
    integrity: 1000,
    bodyTemperature: 210,
    heatTolerance: 40,
    coldTolerance: -5,
    armor: 0.2,
    diet:
      kind === KINDS.HERBIVORE
        ? "producer-compatible"
        : kind === KINDS.PREDATOR
          ? "tissue-compatible"
          : "generalist",
    maxAge: kind === KINDS.PREDATOR ? 1250 : kind === KINDS.PERSON ? 2100 : 1050,
    tissues: {
      boundary: 18,
      support: 18,
      actuator: 20,
      transport: 14,
      sensory: 10,
      processing: kind === KINDS.PERSON ? 20 : 6,
      reproductive: 8,
      storage: 14,
    },
  };
  W.components.life[id] = {
    age: 0,
    regulation: 1000,
    integrity: 1000,
    energy: 0,
    health: 100,
    hunger: 0,
    thirst: 0,
    fatigue: 0,
    stress: 0,
    alive: true,
    infected: false,
    wounded: false,
    wounds: [],
    pain: 0,
    trauma: 0,
    anatomy: null,
    causeOfDeath: "",
  };
  W.components.senses[id] = {
    visionRange: 3,
    smellRange: 3,
    bloodSensitivity: kind === KINDS.PREDATOR ? 0.9 : 0.2,
    fearSensitivity: kind === KINDS.HERBIVORE ? 0.85 : 0.45,
    foodSensitivity: 0.8,
    socialSensitivity: kind === KINDS.PERSON ? 0.9 : 0.25,
  };
  W.components.reproduction[id] = {
    cooldown: 80 + rng.int(100),
    fertility: 0.6,
    matePreference: rng.next(),
    offspringCount: kind === KINDS.PERSON ? 1 : 1 + rng.int(2),
    parentalInvestment: kind === KINDS.PERSON ? 0.75 : 0.3,
  };
  W.components.memory[id] = {
    rememberedEvents: [],
    knownLocations: [tile],
    fearLocations: [],
    socialMemories: {},
    kinDeaths: [],
    discoveredResources: [],
    ring: [],
  };
  W.components.social[id] = {
    factionId: 0,
    cultureId: 0,
    kinGroupId: parents[0] ? W.components.social[parents[0]].kinGroupId : id,
    partnerId: 0,
    relationships: {},
    affairs: [],
    betrayedBy: [],
    revengeTargetId: 0,
    revengeCauseEvent: 0,
    emotion: {
      schema: 1,
      affection: 0,
      anger: 0,
      sadness: 0,
      fear: 0,
      jealousy: 0,
      resolve: 0,
      contentment: 0.5,
      dominant: "contentment",
      emoji: "😌",
      causeEvent: 0,
      updatedTick: 0,
    },
    cohesion: 0.5,
    aggression: 0.3,
    cooperation: 0.5,
    dominance: rng.next(),
    trust: {},
  };
  W.components.identity[id] = {
    generatedName: name,
    birthEventId: 0,
    deathEventId: 0,
    significance: 0,
    titles: [],
    notable: false,
    legendary: false,
    kills: 0,
    children: [],
    parents: [...parents],
    migrations: 0,
    injuries: 0,
    infections: 0,
    disastersSurvived: 0,
    settlementsFounded: [],
    artifacts: [],
    battles: 0,
  };
  W.components.inventory[id] = {
    materials: new Uint16Array(SPECIES_COUNT),
    tools: [],
    artifactIds: [],
    digestive: new Uint16Array(SPECIES_COUNT),
  };
  compilePhenotype(id);
  derivedLife(id);
  return id;
}
const createOrganismBase = createOrganism;
createOrganism = function (kind, x, y, rng, parents = [], sourceTile = -1, divineInput = 0) {
  const tile = sourceTile >= 0 ? sourceTile : idx(x, y),
    beforeInitial = W.conservation.initialMatter,
    before = Array.from({ length: COMMON_CHEM }, (_, sp) => W.tiles.chem[sp][tile]),
    id = createOrganismBase(kind, x, y, rng, parents, sourceTile, divineInput),
    body = W.components.body[id];
  body.maxAge = kind === KINDS.HERBIVORE ? 36000 : kind === KINDS.PREDATOR ? 48000 : 72000;
  body.maturityAge = kind === KINDS.PREDATOR ? 1400 : 1000;
  if (!divineInput && !parents.length && W.tick === 0) {
    const q = W.components.chemistry[id].q,
      pool = W.reservoirs.primordialPackets || [];
    for (let sp = 0; sp < SPECIES_COUNT; sp++) {
      const fromTile = sp < COMMON_CHEM ? Math.min(q[sp], before[sp]) : 0,
        created = Math.max(0, q[sp] - fromTile),
        take = Math.min(created, pool[sp] || 0);
      pool[sp] = (pool[sp] || 0) - take;
      W.conservation.initialMatter -= take;
    }
    if (W.conservation.initialMatter < beforeInitial) W.conservation.initialMatter = beforeInitial;
  }
  return id;
};
const restoreWorldStorageDefaults = restoreWorldDefaults;
restoreWorldDefaults = function () {
  restoreWorldStorageDefaults();
  for (const id of W.activeIds) {
    const kind = W.kind[id],
      body = W.components.body[id],
      rep = W.components.reproduction[id];
    if (!body || !rep || ![KINDS.HERBIVORE, KINDS.PREDATOR, KINDS.PERSON].includes(kind)) continue;
    const target = kind === KINDS.HERBIVORE ? 36000 : kind === KINDS.PREDATOR ? 48000 : 72000;
    if (body.maxAge < target * 0.5) body.maxAge = target;
    body.maturityAge = kind === KINDS.PREDATOR ? 1400 : 1000;
    rep.mode = "paired";
  }
};
function regionId(x, y) {
  return Math.floor(y / 18) * Math.ceil(W.width / 18) + Math.floor(x / 18);
}
