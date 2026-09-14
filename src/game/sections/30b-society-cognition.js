// ═══════════════════════════════════════════════════════════════════════════
// 30b. SOCIETY — COGNITION: the liquid controller behind every person
// ═══════════════════════════════════════════════════════════════════════════
// The quantised liquid time-constant controller each organism thinks with: its
// inputs, its update, and the biases behaviour reads from it.
// This section was one file of four thousand nine hundred lines, 30a-material-
// society.js, split in six along its own seams on 2026-09-14; the composed
// runtime is unchanged, and `scripts/who-overrides.cjs <name>` shows a
// function's layers across them.
const LTC_Q = 1024,
  LTC_HIDDEN = 8,
  LTC_INPUT_FAN = 6,
  LTC_REC_FAN = 4,
  LTC_OUTPUT_FAN = 5,
  LTC_ACTIONS = Object.freeze([
    "wander",
    "rest",
    "food",
    "water",
    "flee",
    "mate",
    "hunt",
    "scavenge",
    "gather",
    "return",
    "socialize",
    "defend",
    "work",
    "shelter",
  ]),
  LTC_SENSE_LABELS = Object.freeze([
    "Hunger",
    "Thirst",
    "Fatigue",
    "Injury",
    "Energy need",
    "Structural damage",
    "Threat pressure",
    "Local food",
    "Local moisture",
    "Prey density",
    "Prey proximity",
    "Prey vulnerability",
    "Predator density",
    "Predator proximity",
    "Carrion scent",
    "Material resources",
    "Nearby allies",
    "Mating readiness",
    "Available mates",
    "Distance from home",
    "Habitat stress",
    "Work urgency",
    "Weather exposure",
    "Shelter cover",
    "Food gradient",
    "Water gradient",
    "Safety gradient",
    "Escape routes",
    "Fear memory",
    "Blood scent",
    "Fire heat",
    "Disease pressure",
  ]);
const LTC_INPUT_SEED = Object.freeze([
    1600, 900, 350, 250, 1750, 850, 1050, 700, 1900, 1100, 650, 800, 1200, 1500, 650, -1000, 1250,
    1550, 750, -850,
  ]),
  LTC_REC_SEED = Object.freeze([800, -1100, 600, 200, 850, -300, 850, -900, 750, -1000]),
  LTC_OUT_SEED = Object.freeze([
    650, -500, 150, 1250, -250, -400, 1500, -150, -500, 1500, -100, -500, 1800, 150, -300, 1500,
    -250, -800, 1100, 250, 350, 950, 450, -350, 1400, 200, -700, 800, 600, -100, 1500, 100, -700,
    1050, 650, 250, 1600, 250, -700, 1100, 500, 300,
  ]);
const expandLTCBase = (seed, length, salt) =>
    Object.freeze(
      Array.from({ length }, (_, i) =>
        clamp(seed[i % seed.length] + ((i * 137 + salt * 71) % 321) - 160, -2300, 2300),
      ),
    ),
  LTC_INPUT_BASE = expandLTCBase(LTC_INPUT_SEED, LTC_HIDDEN * LTC_INPUT_FAN, 1),
  LTC_REC_BASE = expandLTCBase(LTC_REC_SEED, LTC_HIDDEN * LTC_REC_FAN, 2),
  LTC_OUT_BASE = expandLTCBase(LTC_OUT_SEED, LTC_ACTIONS.length * LTC_OUTPUT_FAN, 3);
function controllerArray(base, id, salt, parentA, parentB, min = -2560, max = 2560) {
  const out = new Int16Array(base.length);
  for (let i = 0; i < base.length; i++) {
    let value = base[i],
      pa = parentA?.[i],
      pb = parentB?.[i];
    if (pa != null || pb != null)
      value =
        pa != null && pb != null ? (hashParts(W.seedHash, id, salt, i) & 1 ? pa : pb) : (pa ?? pb);
    else value += Math.floor(hashParts(W.seedHash, id, salt, i) % 129) - 64;
    if (
      (pa != null || pb != null) &&
      counterRand(`ltc-mutation-${salt}`, id, i) < W.laws.mutationIntensity * 0.6
    )
      value += Math.floor(hashParts(W.seedHash, id, "ltc-step", salt, i) % 385) - 192;
    out[i] = clamp(Math.round(value), min, max);
  }
  return out;
}
function makeLTCController(id, kind, parents = []) {
  const a = W.components.genome[parents[0]]?.controller,
    b = W.components.genome[parents[1]]?.controller,
    tauBase = [4096, 3072, 1536, 6144, 5120, 2304, 7168, 3584],
    tau = new Uint16Array(LTC_HIDDEN);
  for (let i = 0; i < LTC_HIDDEN; i++) {
    const pa = a?.tau?.[i],
      pb = b?.tau?.[i],
      v =
        pa && pb
          ? hashParts(W.seedHash, id, "ltc-tau-parent", i) & 1
            ? pa
            : pb
          : pa ||
            pb ||
            tauBase[i] + Math.floor(hashParts(W.seedHash, id, "ltc-tau", i) % 513) - 256;
    tau[i] = clamp(v, 768, 12288);
  }
  const input = controllerArray(LTC_INPUT_BASE, id, "input", a?.input, b?.input);
  if (kind === KINDS.PREDATOR) {
    for (const n of [2, 3, 13, 14, 26, 27]) input[n] = clamp(input[n] + 420, -2560, 2560);
  }
  if (kind === KINDS.HERBIVORE)
    for (const n of [4, 12, 15, 25]) input[n] = clamp(input[n] + 360, -2560, 2560);
  if (kind === KINDS.PERSON) {
    for (const n of [0, 1, 5, 7, 16, 22, 28, 30, 34, 36, 45])
      input[n] = clamp(input[n] + 380, -2560, 2560);
    for (const n of [9, 11, 24, 29, 32, 38, 40]) input[n] = clamp(input[n] + 300, -2560, 2560);
  }
  return {
    version: 2,
    input,
    rec: controllerArray(LTC_REC_BASE, id, "rec", a?.rec, b?.rec),
    out: controllerArray(LTC_OUT_BASE, id, "out", a?.out, b?.out),
    tau,
    leak: new Int16Array([-160, -120, -220, -80, -100, -145, -185, -110]),
    plasticity: clamp(
      Math.round(
        (a?.plasticity || b?.plasticity || 24) +
          (hashParts(W.seedHash, id, "ltc-plasticity") % 9) -
          4,
      ),
      8,
      64,
    ),
  };
}
function resizedTyped(value, T, length) {
  if (value instanceof T && value.length === length) return value;
  const out = new T(length);
  if (value && typeof value.length === "number")
    for (let i = 0; i < Math.min(length, value.length); i++) out[i] = value[i];
  return out;
}
function initCognition(id, parents = []) {
  if (!W.components?.genome?.[id]) return null;
  const g = W.components.genome[id],
    old = g.controller,
    shapeOk =
      old?.version === 2 &&
      old.input?.length === LTC_INPUT_BASE.length &&
      old.rec?.length === LTC_REC_BASE.length &&
      old.out?.length === LTC_OUT_BASE.length &&
      old.tau?.length === LTC_HIDDEN &&
      old.leak?.length === LTC_HIDDEN;
  if (!shapeOk) {
    const upgraded = makeLTCController(id, W.kind[id], parents);
    if (old) {
      for (const key of ["input", "rec", "out", "tau", "leak"]) {
        const src = old[key],
          dst = upgraded[key];
        if (src && dst) for (let i = 0; i < Math.min(src.length, dst.length); i++) dst[i] = src[i];
      }
      if (Number.isFinite(old.plasticity)) upgraded.plasticity = clamp(old.plasticity, 8, 64);
    }
    g.controller = upgraded;
  }
  const store = W.components.cognition || (W.components.cognition = {}),
    fresh = !store[id],
    c =
      store[id] ||
      (store[id] = {
        inputs: new Int16Array(LTC_SENSE_LABELS.length),
        state: new Int16Array(LTC_HIDDEN),
        plastic: new Int16Array(LTC_ACTIONS.length * LTC_OUTPUT_FAN),
        value: new Int16Array(LTC_ACTIONS.length),
        output: new Int16Array(LTC_ACTIONS.length),
        lastTick: W.tick,
        lastAction: -1,
        lastUtility: 0,
        pendingReward: 0,
        lastReward: 0,
        confidence: 0,
        updates: 0,
        influenceCount: 0,
        dominant: "wander",
      });
  c.inputs = resizedTyped(c.inputs, Int16Array, LTC_SENSE_LABELS.length);
  if (fresh && W.kind[id] === KINDS.PERSON) {
    const innate = {
      water: 300,
      flee: 340,
      food: 260,
      socialize: 220,
      work: 240,
      shelter: 160,
      rest: 90,
    };
    for (const [action, value] of Object.entries(innate)) {
      const n = LTC_ACTIONS.indexOf(action);
      if (n >= 0) c.value[n] = value;
    }
  }
  if (fresh && parents.length) {
    const teachers = parents
      .map((parent) => store[parent])
      .filter((t) => t && t.plastic?.length === c.plastic.length);
    if (teachers.length) {
      for (let i = 0; i < c.plastic.length; i++) {
        const t = teachers[hashParts(W.seedHash, id, "ltc-taught", i) % teachers.length];
        c.plastic[i] = clamp(Math.round(t.plastic[i] * 0.6), -LTC_Q, LTC_Q);
      }
      for (let i = 0; i < c.value.length; i++) {
        const t = teachers[hashParts(W.seedHash, id, "ltc-taught-value", i) % teachers.length];
        c.value[i] = clamp(Math.round(c.value[i] * 0.5 + t.value[i] * 0.5), -LTC_Q, LTC_Q);
      }
      c.confidence = Math.round(
        teachers.reduce((sum, t) => sum + (t.confidence || 0), 0) / (teachers.length * 2),
      );
    }
  }
  c.state = resizedTyped(c.state, Int16Array, LTC_HIDDEN);
  c.plastic = resizedTyped(c.plastic, Int16Array, LTC_ACTIONS.length * LTC_OUTPUT_FAN);
  c.value = resizedTyped(c.value, Int16Array, LTC_ACTIONS.length);
  c.output = resizedTyped(c.output, Int16Array, LTC_ACTIONS.length);
  c.lastTick = Number.isFinite(c.lastTick) ? c.lastTick : W.tick;
  c.lastAction = Number.isFinite(c.lastAction) ? c.lastAction : -1;
  c.lastUtility = Number.isFinite(c.lastUtility) ? c.lastUtility : 0;
  c.pendingReward = Number.isFinite(c.pendingReward) ? c.pendingReward : 0;
  c.lastReward = Number.isFinite(c.lastReward) ? c.lastReward : 0;
  c.confidence = Number.isFinite(c.confidence) ? c.confidence : 0;
  c.updates = Number.isFinite(c.updates) ? c.updates : 0;
  c.influenceCount = Number.isFinite(c.influenceCount) ? c.influenceCount : 0;
  c.dominant = c.dominant || "wander";
  return c;
}
const createOrganismCognitionBase = createOrganism;
createOrganism = function (kind, x, y, rng, parents = [], sourceTile = -1, divineInput = 0) {
  const id = createOrganismCognitionBase(kind, x, y, rng, parents, sourceTile, divineInput);
  initCognition(id, parents);
  W.components.work[id] = {
    task: "idle",
    phase: "",
    targetTile: -1,
    buildingId: 0,
    materialId: -1,
    toolId: 0,
    progress: 0,
    actionStartTick: W.tick,
    actionSerial: 0,
    handledTick: -1,
    lastSuccess: 0,
  };
  return id;
};
const cloneGenomeCognitionBase = cloneGenome;
cloneGenome = function (g) {
  const q = cloneGenomeCognitionBase(g);
  if (g.controller)
    q.controller = {
      ...g.controller,
      input: new Int16Array(g.controller.input),
      rec: new Int16Array(g.controller.rec),
      out: new Int16Array(g.controller.out),
      tau: new Uint16Array(g.controller.tau),
      leak: new Int16Array(g.controller.leak),
    };
  return q;
};
function cognitionUtilityQ(id) {
  const l = derivedLife(id),
    p = W.components.position[id],
    stress = p ? organismHabitatStress(id, idx(p.x, p.y)) : 100;
  return clamp(
    Math.round(
      ((l.energy * 0.3 +
        l.health * 0.3 +
        (100 - l.thirst) * 0.2 +
        (100 - l.fatigue) * 0.1 +
        (100 - clamp(stress, 0, 100)) * 0.1) *
        LTC_Q) /
        100,
    ),
    0,
    LTC_Q,
  );
}
function cognitionInputs(id) {
  const k = W.kind[id],
    l = derivedLife(id),
    p = W.components.position[id],
    ti = idx(p.x, p.y),
    ph = phenotype(id),
    body = W.components.body[id],
    place = nearestFriendlyPlace(id),
    sense = clamp(Math.round(ph.sense), 4, 10),
    near = nearbyIds(id, sense),
    predatorIds = near.filter((o) => W.kind[o] === KINDS.PREDATOR),
    preyIds = near.filter((o) => W.kind[o] === KINDS.HERBIVORE || W.kind[o] === KINDS.PERSON),
    corpses = near.filter((o) => W.kind[o] === KINDS.CORPSE),
    allies = near.filter((o) => W.kind[o] === k),
    mates = allies.filter((o) => W.components.reproduction[o]?.cooldown === 0),
    nearest = (ids) =>
      ids.length
        ? Math.min(
            ...ids.map((o) =>
              Math.sqrt(dist2(p.x, p.y, W.components.position[o].x, W.components.position[o].y)),
            ),
          )
        : sense,
    closestPred = nearest(predatorIds),
    closestPrey = nearest(preyIds),
    targetVulnerability = preyIds.length
      ? Math.max(...preyIds.map((o) => (100 - derivedLife(o).health) / 100))
      : 0,
    localFood = tileFood(
      ti,
      k === KINDS.PREDATOR ? "predator" : k === KINDS.PERSON ? "omnivore" : "grazer",
    ),
    localHazard = W.tiles.fire[ti] / 5 + W.tiles.danger[ti] / 10 + organismHabitatStress(id, ti),
    localMoist = tileMoisture(ti);
  let bestFood = localFood,
    bestMoist = localMoist,
    safest = localHazard,
    openRoutes = 0;
  for (const d of DIRS.slice(0, 8)) {
    const x = p.x + d[0],
      y = p.y + d[1];
    if (!inside(x, y)) continue;
    const i = idx(x, y),
      haz = W.tiles.fire[i] / 5 + W.tiles.danger[i] / 10 + organismHabitatStress(id, i);
    bestFood = Math.max(
      bestFood,
      tileFood(i, k === KINDS.PREDATOR ? "predator" : k === KINDS.PERSON ? "omnivore" : "grazer"),
    );
    bestMoist = Math.max(bestMoist, tileMoisture(i));
    safest = Math.min(safest, haz);
    if (W.tiles.fire[i] < 180 && W.tiles.liquid[i] < 1050 && haz < localHazard + 30) openRoutes++;
  }
  const threat = clamp(
      W.tiles.fire[ti] / 500 +
        W.tiles.danger[ti] / 1000 +
        tileFear(ti) / 150 +
        (k === KINDS.HERBIVORE ? predatorIds.length * 0.28 : 0),
      0,
      1,
    ),
    workUrgency = k === KINDS.PERSON && place ? clamp(activeBuildings(place).length / 3, 0, 1) : 0,
    home = place ? clamp(Math.sqrt(dist2(p.x, p.y, place.x, place.y)) / 24, 0, 1) : 0,
    stress = clamp(organismHabitatStress(id, ti) / 120, 0, 1),
    shelter = shelterProtectionAt(id, ti),
    severeWeather = W.weather.name === "Storm" || W.weather.name === "Drought" ? 0.25 : 0,
    exposure = clamp(stress + severeWeather - shelter * 0.4, 0, 1),
    fearMemory = Math.max(fearMemoryStrength(id, ti), clamp(tileFear(ti) / 140, 0, 1)),
    values = [
      l.hunger / 100,
      l.thirst / 100,
      l.fatigue / 100,
      (100 - l.health) / 100,
      clamp((100 - l.energy) / 100, 0, 1),
      clamp((1000 - l.integrity) / 1000, 0, 1),
      threat,
      clamp(localFood / 100, 0, 1),
      localMoist / 100,
      clamp(preyIds.length / 5, 0, 1),
      clamp(1 - closestPrey / sense, 0, 1),
      targetVulnerability,
      clamp(predatorIds.length / 4, 0, 1),
      clamp(1 - closestPred / sense, 0, 1),
      clamp(corpses.length / 3, 0, 1),
      tileResource(ti) / 100,
      clamp(allies.length / 6, 0, 1),
      W.components.reproduction[id].cooldown === 0 && l.age > body.maturityAge ? 1 : 0,
      clamp(mates.length / 3, 0, 1),
      home,
      stress,
      workUrgency,
      exposure,
      shelter,
      clamp((bestFood - localFood) / 65, 0, 1),
      clamp((bestMoist - localMoist) / 70, 0, 1),
      clamp((localHazard - safest) / 100, 0, 1),
      openRoutes / 8,
      fearMemory,
      clamp(tileBlood(ti) / 120, 0, 1),
      clamp(W.tiles.fire[ti] / 500, 0, 1),
      clamp(tileDisease(ti) / 120, 0, 1),
    ];
  return Int16Array.from(values.map((v) => clamp(Math.round(v * LTC_Q), 0, LTC_Q)));
}
function fastSigmoidQ(z) {
  return clamp(512 + Math.trunc((512 * z) / (1024 + Math.abs(z))), 0, LTC_Q);
}
function advanceLTC(id) {
  const g = W.components.genome[id],
    c = initCognition(id),
    inputs = cognitionInputs(id),
    dt = clamp(W.tick - c.lastTick, 1, 8),
    utility = cognitionUtilityQ(id),
    reward = clamp((utility - c.lastUtility) * 4 + c.pendingReward, -LTC_Q, LTC_Q);
  c.inputs.set(inputs);
  if (c.lastAction >= 0) {
    const a = c.lastAction,
      rate = g.controller.plasticity;
    c.value[a] = clamp(
      c.value[a] + Math.round((rate * (reward - c.value[a])) / LTC_Q),
      -LTC_Q,
      LTC_Q,
    );
    for (let n = 0; n < LTC_OUTPUT_FAN; n++) {
      const pos = a * LTC_OUTPUT_FAN + n,
        h = (a * 3 + n * 5) % LTC_HIDDEN;
      c.plastic[pos] = clamp(
        c.plastic[pos] + Math.round((rate * reward * c.state[h]) / (LTC_Q * LTC_Q)),
        -384,
        384,
      );
    }
  }
  c.lastReward = reward;
  c.pendingReward = 0;
  c.lastUtility = utility;
  const next = new Int16Array(LTC_HIDDEN);
  for (let h = 0; h < LTC_HIDDEN; h++) {
    let drive = g.controller.leak[h] * 2,
      conductance = 0;
    for (let n = 0; n < LTC_INPUT_FAN; n++) {
      const pos = h * LTC_INPUT_FAN + n,
        w = g.controller.input[pos],
        source = inputs[(pos * 13 + (pos >= inputs.length ? 7 : 0)) % inputs.length];
      drive += Math.round((w * source) / LTC_Q);
      conductance += Math.round((Math.abs(w) * source) / (LTC_Q * 8));
    }
    for (let n = 0; n < LTC_REC_FAN; n++) {
      const w = g.controller.rec[h * LTC_REC_FAN + n],
        source = c.state[(h + n + 1) % LTC_HIDDEN];
      drive += Math.round((w * source) / LTC_Q);
      conductance += Math.round((Math.abs(w) * Math.abs(source)) / (LTC_Q * 8));
    }
    const target = fastSigmoidQ(drive),
      tau = Math.max(512, g.controller.tau[h] - conductance),
      delta = Math.round(((target - c.state[h]) * dt * LTC_Q) / tau);
    next[h] = clamp(c.state[h] + delta, -LTC_Q, LTC_Q);
  }
  c.state.set(next);
  let first = -1e9,
    second = -1e9,
    best = 0;
  for (let a = 0; a < LTC_ACTIONS.length; a++) {
    let raw = c.value[a];
    for (let n = 0; n < LTC_OUTPUT_FAN; n++) {
      const pos = a * LTC_OUTPUT_FAN + n,
        h = (a * 3 + n * 5) % LTC_HIDDEN;
      raw += Math.round(((g.controller.out[pos] + c.plastic[pos]) * c.state[h]) / LTC_Q);
    }
    c.value[a] = clamp(c.value[a], -LTC_Q, LTC_Q);
    const output = clamp(Math.round((LTC_Q * raw) / (LTC_Q + Math.abs(raw))), -LTC_Q, LTC_Q);
    c.output[a] = output;
    if (output > first) {
      second = first;
      first = output;
      best = a;
    } else if (output > second) second = output;
  }
  c.confidence = clamp(first - second, 0, LTC_Q);
  c.dominant = LTC_ACTIONS[best];
  c.lastAction = best;
  c.lastTick = W.tick;
  c.updates++;
  return c;
}
function cognitionBias(id, action) {
  const c = W.components.cognition?.[id],
    n = LTC_ACTIONS.indexOf(action);
  if (!c || n < 0) return 0;
  const bias = ((c.output?.[n] || 0) * 30) / LTC_Q + ((c.value?.[n] || 0) * 10) / LTC_Q,
    l = W.components.life[id];
  if (!l) return bias;
  const survival = action === "food" || action === "water" || action === "flee",
    desperate = l.hunger > 72 || l.thirst > 72;
  if (
    (action === "food" && l.hunger > 72) ||
    (action === "water" && l.thirst > 72) ||
    (action === "flee" && l.threatId)
  )
    return Math.max(0, bias);
  if (desperate && !survival) return Math.min(0, bias);
  return bias;
}
