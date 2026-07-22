// ═══════════════════════════════════════════════════════════════════════════
// 21. PERCEPTION AND BEHAVIOR SYSTEMS
// ═══════════════════════════════════════════════════════════════════════════
const DIRS = Object.freeze([
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, 0],
]);
function nearbyIds(id, radius = 3, filter = null) {
  const p = W.components.position[id],
    out = [];
  if (!p) return out;
  for (let y = Math.max(0, p.y - radius); y <= Math.min(W.height - 1, p.y + radius); y++)
    for (let x = Math.max(0, p.x - radius); x <= Math.min(W.width - 1, p.x + radius); x++) {
      if (dist2(x, y, p.x, p.y) > radius * radius) continue;
      for (const other of W.spatialBins[idx(x, y)] || [])
        if (other !== id && (!filter || filter(other))) out.push(other);
    }
  out.sort((a, b) => a - b);
  return out;
}
function runMetabolism(id, tier) {
  const ch = W.components.chemistry[id],
    l = W.components.life[id],
    p = phenotype(id),
    rate =
      tier === "simplified-due"
        ? W.config.complexity === "lean"
          ? 8
          : W.config.complexity === "deep"
            ? 2
            : 4
        : 1,
    inv = invEntity(id),
    d = W.components.inventory[id].digestive,
    pos = W.components.position[id],
    ti = idx(pos.x, pos.y);
  for (const sp of [C.ENERGY, C.SOLVENT, C.NUTRIENT, C.CATALYST, C.TOXIN, C.PATHOGEN]) {
    const limit = sp === C.ENERGY ? 14 * rate : sp === C.NUTRIENT ? 6 * rate : 3 * rate,
      take = Math.min(d[sp], limit, 65535 - ch.q[sp]);
    d[sp] -= take;
    ch.q[sp] += take;
  }
  const respiratoryDemand = Math.max(
      1,
      Math.floor((rate * (1 + p.speed * 0.2)) / Math.max(0.35, p.metabolism)),
    ),
    oxidantNeed = Math.max(0, respiratoryDemand + 2 - ch.q[C.OXIDANT]),
    oxidantIntake = Math.min(oxidantNeed, W.tiles.chem[C.OXIDANT][ti], 65535 - ch.q[C.OXIDANT]);
  W.tiles.chem[C.OXIDANT][ti] -= oxidantIntake;
  ch.q[C.OXIDANT] += oxidantIntake;
  const respired = executeProcess("respiration", inv, respiratoryDemand, { dissipate: 1 }),
    exhaled = Math.min(respired, ch.q[C.GAS], 65535 - W.tiles.chem[C.GAS][ti]);
  ch.q[C.GAS] -= exhaled;
  W.tiles.chem[C.GAS][ti] += exhaled;
  const energyReserve = W.kind[id] === KINDS.PERSON ? 200 : 150;
  if (ch.q[C.ENERGY] < energyReserve) {
    const intake = Math.min(10 * rate, d[C.ORGANIC], 65535 - ch.q[C.ORGANIC]);
    d[C.ORGANIC] -= intake;
    ch.q[C.ORGANIC] += intake;
    const cat = Math.min(d[C.CATALYST], 2, 65535 - ch.q[C.CATALYST]);
    d[C.CATALYST] -= cat;
    ch.q[C.CATALYST] += cat;
    const structuralReserve = W.kind[id] === KINDS.PERSON ? 24 : 30,
      available = Math.max(0, ch.q[C.ORGANIC] - structuralReserve),
      amount = Math.min(10 * rate, available);
    if (amount > 0) executeProcess("digestion", inv, Math.max(1, Math.floor(amount / 2)));
  }
  const solventLoss = Math.min(ch.q[C.SOLVENT], rate + (p.size > 1.3 ? 1 : 0));
  ch.q[C.SOLVENT] -= solventLoss;
  setTileMatterAmount(ti, C.SOLVENT, tileMatterAmount(ti, C.SOLVENT) + solventLoss);
  if (ch.q[C.WASTE] > 90) {
    const excrete = Math.min(ch.q[C.WASTE], 6 * rate);
    ch.q[C.WASTE] -= excrete;
    setTileMatterAmount(ti, C.WASTE, tileMatterAmount(ti, C.WASTE) + excrete);
  }
  l.age += rate;
  l.fatigue = clamp(
    l.fatigue + rate * (0.018 + (0.022 * l.age) / Math.max(1, W.components.body[id].maxAge)),
    0,
    100,
  );
  l.regulation = u16(
    l.regulation +
      (respired && ch.q[C.ENERGY] >= 5 ? rate : -2 * rate) -
      (ch.q[C.ENERGY] < 5 ? 5 * rate : 0),
  );
  const rep = W.components.reproduction[id];
  rep.cooldown = Math.max(
    0,
    rep.cooldown -
      rate * (W.kind[id] === KINDS.PERSON && concertedIntensity() ? 2 + concertedIntensity() : 1),
  );
  derivedLife(id);
}
function organismHabitatStress(id, i) {
  const ph = phenotype(id),
    body = W.components.body[id],
    n = ecologicalNicheAt(i),
    temp = W.tiles.temperature[i] / 10,
    heat = Math.max(0, temp - ph.heatTolerance),
    cold = Math.max(0, (body.coldTolerance ?? -8) - temp),
    pathogen = tileDisease(i) * (1 - ph.diseaseResistance),
    toxin = W.tiles.chem[C.TOXIN][i] / 90,
    dry = Math.max(0, 12 - tileMoisture(i)),
    flood = Math.max(0, W.tiles.liquid[i] - 780) / 18,
    oxidant = Math.max(0, 90 - W.tiles.chem[C.OXIDANT][i]) * 0.7,
    thermalFactor = 1 - clamp(n.thermalBuffer, 0, 0.82),
    dryFactor = 1 - clamp(n.hydrationBuffer, 0, 0.7);
  return (
    (heat * 2.5 + cold * 2.5) * thermalFactor +
    pathogen * 0.55 +
    toxin +
    dry * dryFactor +
    flood +
    oxidant +
    n.hazard
  );
}
function directionScore(id, dx, dy, goal) {
  const p = W.components.position[id],
    x = p.x + dx,
    y = p.y + dy;
  if (!inside(x, y)) return -1e9;
  const i = idx(x, y),
    k = W.kind[id],
    life = W.components.life[id],
    ph = phenotype(id),
    fire = W.tiles.fire[i] / 10,
    danger = W.tiles.danger[i] / 12,
    disease = tileDisease(i),
    fear = tileFear(i),
    blood = tileBlood(i),
    moist = tileMoisture(i),
    food = tileFood(
      i,
      k === KINDS.PREDATOR ? "predator" : k === KINDS.PERSON ? "omnivore" : "grazer",
    );
  let score =
    -fire * 5 -
    danger * ph.aggression * 0.25 -
    disease * (1 - ph.diseaseResistance) * 2 -
    organismHabitatStress(id, i) * 2.4;
  if (goal === "flee") {
    score -= danger * 2 + fear * (k === KINDS.HERBIVORE ? 2 : 0.5) + fire * 4;
    const threat = W.components.position[life?.threatId];
    if (threat && classifyAlive(life.threatId))
      score += Math.sqrt(dist2(x, y, threat.x, threat.y)) * 24;
  }
  if (goal === "food") score += food * 3;
  if (goal === "water") score += moist * 2;
  if (goal === "hunt") {
    score += blood * 0.65 + tilePopulation(i) * 3;
    const target = W.components.position[life?.preyTargetId];
    if (target && classifyAlive(life.preyTargetId)) {
      const targetLife = derivedLife(life.preyTargetId);
      score -= Math.sqrt(dist2(x, y, target.x, target.y)) * 31;
      score += (100 - targetLife.health) * 0.16;
    }
  }
  if (goal === "scavenge") score += blood * 2 + disease * -0.5;
  if (goal === "gather") score += tileResource(i) * 2 + food * 0.5;
  if (goal === "return") {
    const s = nearestFriendlyPlace(id);
    if (s) score -= Math.sqrt(dist2(x, y, s.x, s.y)) * 8;
  }
  if (goal === "migrate") score += food + moist - danger - organismHabitatStress(id, i) * 1.5;
  score += counterRand("behavior-tie", W.tick, id, (dx + 2) * 13 + (dy + 2)) * 1e-3;
  return score;
}
function bestDirection(id, goal) {
  let best = DIRS[8],
    score = -1e9;
  for (let n = 0; n < DIRS.length; n++) {
    const d = DIRS[n],
      s = directionScore(id, d[0], d[1], goal);
    if (s > score) {
      score = s;
      best = d;
    }
  }
  return best;
}
function huntTargetScore(id, target) {
  const p = W.components.position[id],
    tp = W.components.position[target],
    life = derivedLife(target),
    body = W.components.body[target],
    ph = phenotype(id),
    distance = Math.sqrt(dist2(p.x, p.y, tp.x, tp.y)),
    vulnerability = (100 - life.health) * 0.24 + tileBlood(idx(tp.x, tp.y)) * 0.08,
    defense = (body?.armor || 0) * 12 + (phenotype(target).size - ph.size) * 7;
  return distance * 18 + defense - vulnerability + target * 0.0001;
}
function chooseBehavior(id, tier) {
  const k = W.kind[id],
    l = derivedLife(id),
    p = W.components.position[id],
    ti = idx(p.x, p.y),
    ph = phenotype(id),
    assignedWork = W.components.work?.[id];
  if (k === KINDS.PERSON && assignedWork?.task !== "idle" && assignedWork?.handledTick === W.tick) {
    l.behavior = assignedWork.task;
    l.behaviorReason = assignedWork.phase || "executing an assigned material task";
    return;
  }
  const senseRadius = clamp(Math.round(ph.sense), 4, 11),
    nearPred =
      k === KINDS.HERBIVORE ? nearbyIds(id, senseRadius, (o) => W.kind[o] === KINDS.PREDATOR) : [],
    nearPrey =
      k === KINDS.PREDATOR
        ? nearbyIds(
            id,
            senseRadius,
            (o) => W.kind[o] === KINDS.HERBIVORE || W.kind[o] === KINDS.PERSON,
          )
        : [],
    nearCorpse = nearbyIds(id, senseRadius, (o) => W.kind[o] === KINDS.CORPSE);
  if (nearPred.length) {
    nearPred.sort(
      (a, b) =>
        dist2(p.x, p.y, W.components.position[a].x, W.components.position[a].y) -
          dist2(p.x, p.y, W.components.position[b].x, W.components.position[b].y) || a - b,
    );
    l.threatId = nearPred[0];
  } else if (
    !classifyAlive(l.threatId) ||
    !W.components.position[l.threatId] ||
    dist2(p.x, p.y, W.components.position[l.threatId].x, W.components.position[l.threatId].y) >
      senseRadius * senseRadius * 2.25
  )
    l.threatId = 0;
  if (k === KINDS.PREDATOR) {
    const remembered = l.preyTargetId;
    if (
      remembered &&
      classifyAlive(remembered) &&
      (W.kind[remembered] === KINDS.HERBIVORE || W.kind[remembered] === KINDS.PERSON) &&
      !nearPrey.includes(remembered)
    ) {
      const rp = W.components.position[remembered];
      if (rp && dist2(p.x, p.y, rp.x, rp.y) <= senseRadius * senseRadius * 2.25)
        nearPrey.push(remembered);
    }
    nearPrey.sort((a, b) => huntTargetScore(id, a) - huntTargetScore(id, b));
    l.preyTargetId = nearPrey[0] || 0;
  }
  const target = l.preyTargetId ? derivedLife(l.preyTargetId) : null,
    targetProximity = l.preyTargetId
      ? clamp(
          1 -
            Math.sqrt(
              dist2(
                p.x,
                p.y,
                W.components.position[l.preyTargetId].x,
                W.components.position[l.preyTargetId].y,
              ),
            ) /
              senseRadius,
          0,
          1,
        )
      : 0,
    scores = [
      {
        id: "wander",
        score: 8 + counterRand("wander", W.tick, id) * 8,
        reason: "exploring nearby chemical gradients",
      },
      { id: "rest", score: l.fatigue * 0.65, reason: "low actuator recovery" },
      {
        id: "food",
        score:
          l.hunger * 1.25 +
          tileFood(
            ti,
            k === KINDS.PREDATOR ? "predator" : k === KINDS.PERSON ? "omnivore" : "grazer",
          ),
        reason: "low accessible chemical energy",
      },
      { id: "water", score: l.thirst * 1.3, reason: "low internal solvent balance" },
      {
        id: "flee",
        score:
          W.tiles.fire[ti] / 4 +
          W.tiles.danger[ti] / 6 +
          nearPred.length * 82 +
          tileFear(ti) * (k === KINDS.HERBIVORE ? 1.1 : 0.25),
        reason: nearPred.length
          ? "a predator entered sensory range and its position was localized"
          : "fire, danger, or alarm compounds were sensed",
      },
      {
        id: "mate",
        score:
          W.components.reproduction[id].cooldown === 0 && l.energy > 65 ? ph.fertility * 50 : 0,
        reason: "stored matter permits reproduction",
      },
    ];
  if (k === KINDS.PREDATOR)
    scores.push(
      {
        id: "hunt",
        score:
          l.hunger * 0.95 +
          nearPrey.length * 34 +
          targetProximity * 78 +
          (target ? 100 - target.health : 0) * 0.25 +
          tileBlood(ti) * 0.3,
        reason: nearPrey.length
          ? "the controller localized and ranked vulnerable compatible prey"
          : "blood volatiles formed a search gradient",
      },
      {
        id: "scavenge",
        score: nearCorpse.length * 48 + l.hunger * 0.4,
        reason: "decomposition volatiles revealed tissue",
      },
    );
  if (k === KINDS.PERSON) {
    const place = nearestFriendlyPlace(id),
      homeostaticMargin = Math.max(0, 100 - l.hunger);
    scores.push(
      {
        id: "gather",
        score: homeostaticMargin * 0.18 + tileResource(ti) * 0.65 + 12,
        reason:
          l.hunger > 58
            ? "gathering deferred until chemical energy recovers"
            : "the community needs transformable matter",
      },
      {
        id: "return",
        score: place ? Math.sqrt(dist2(p.x, p.y, place.x, place.y)) * 4 : 0,
        reason: "stored social memory points toward home",
      },
      {
        id: "socialize",
        score:
          nearbyIds(id, 2, (o) => W.kind[o] === KINDS.PERSON).length *
          14 *
          ph.social *
          (l.hunger < 55 ? 1 : 0.2),
        reason: "kin signaling and trust",
      },
      {
        id: "defend",
        score: W.tiles.danger[ti] * 0.16 * ph.aggression,
        reason: "danger overlaps kin territory",
      },
    );
  }
  const heuristicWinner = scores
      .slice()
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))[0],
    cognition = W.components.cognition?.[id];
  if (cognition) {
    for (const candidate of scores) {
      const n = LTC_ACTIONS.indexOf(candidate.id);
      candidate.cognitionBias =
        n < 0
          ? 0
          : ((cognition.output?.[n] || 0) * 30) / LTC_Q +
            ((cognition.value?.[n] || 0) * 10) / LTC_Q;
      candidate.score += candidate.cognitionBias;
    }
  }
  scores.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const action = scores[0];
  if (W.tiles.fire[ti] > 90) {
    action.id = "flee";
    action.reason = "combustion heat and smoke exceeded the immediate escape threshold";
  }
  if (cognition) {
    const actual = LTC_ACTIONS.indexOf(action.id);
    if (actual >= 0) cognition.lastAction = actual;
    if (action.id !== heuristicWinner.id) {
      cognition.influenceCount++;
      cognition.lastInfluenceTick = W.tick;
      cognition.lastInfluence = `${heuristicWinner.id}→${action.id}`;
    }
    action.reason += ` · LTC ${titleCase(cognition.dominant)} drive ${action.cognitionBias >= 0 ? "+" : ""}${(action.cognitionBias || 0).toFixed(1)}`;
  }
  l.behavior = action.id;
  l.behaviorReason = action.reason;
  let dir = [0, 0];
  if (action.id === "flee") {
    dir = bestDirection(id, "flee");
    const made = executeProcess("fear_signal", invEntity(id), 2);
    if (made) {
      const q = W.components.chemistry[id].q,
        emit = Math.min(made, q[C.FEAR]);
      q[C.FEAR] -= emit;
      setTileMatterAmount(ti, C.FEAR, tileMatterAmount(ti, C.FEAR) + emit);
      W.components.memory[id].fearLocations.push(ti);
    }
  } else if (action.id === "rest") {
    const recovery =
        tier === "simplified-due"
          ? W.config.complexity === "lean"
            ? 8
            : W.config.complexity === "deep"
              ? 2
              : 4
          : 1,
      shelter = 1 + shelterProtectionAt(id, ti) * 0.65;
    l.fatigue = clamp(l.fatigue - 2.4 * recovery * shelter, 0, 100);
  } else if (action.id === "mate") {
    const mates = nearbyIds(id, 8, (o) => W.kind[o] === k && canReproduce(o)).sort(
        (a, b) =>
          dist2(p.x, p.y, W.components.position[a].x, W.components.position[a].y) -
            dist2(p.x, p.y, W.components.position[b].x, W.components.position[b].y) || a - b,
      ),
      mate = mates[0];
    if (mate) {
      const mp = W.components.position[mate];
      dir = [Math.sign(mp.x - p.x), Math.sign(mp.y - p.y)];
    } else dir = bestDirection(id, "migrate");
  } else if (action.id === "food") performFeeding(id, ti) || (dir = bestDirection(id, "food"));
  else if (action.id === "water") performDrinking(id, ti) || (dir = bestDirection(id, "water"));
  else if (action.id === "hunt") performHunt(id, nearPrey) || (dir = bestDirection(id, "hunt"));
  else if (action.id === "scavenge")
    performScavenge(id, nearCorpse) || (dir = bestDirection(id, "scavenge"));
  else if (action.id === "gather") performGather(id, ti) || (dir = bestDirection(id, "gather"));
  else if (action.id === "return") dir = bestDirection(id, "return");
  else if (action.id === "socialize") performSocialInteraction(id);
  else if (action.id === "defend") dir = bestDirection(id, "flee");
  else if (action.id === "wander") dir = bestDirection(id, "migrate");
  if (dir[0] || dir[1]) {
    const nx = clamp(p.x + dir[0], 0, W.width - 1),
      ny = clamp(p.y + dir[1], 0, W.height - 1);
    if (W.tiles.liquid[idx(nx, ny)] < 1100 && W.tiles.fire[idx(nx, ny)] < 700) {
      queueEffect("MoveEntity", { entityId: id, x: nx, y: ny }, id);
      if (k !== KINDS.PERSON || W.tick % 2 === id % 2)
        executeProcess(
          "motion_dissipation",
          invEntity(id),
          Math.max(1, Math.ceil(ph.speed * ph.size * 0.35)),
          { dissipate: 1 },
        );
    }
  }
  if (k === KINDS.PERSON) W.tiles.habitation[ti] = u16(W.tiles.habitation[ti] + 1);
}
function performFeeding(id, tile) {
  const k = W.kind[id],
    available = tileFood(tile, k === KINDS.PERSON ? "omnivore" : "grazer");
  if (available < 3) return false;
  const inv = W.components.inventory[id].digestive,
    amount = Math.min(
      18,
      W.tiles.chem[C.ORGANIC][tile],
      Math.floor(available / 2) + 2,
      65535 - inv[C.ORGANIC],
    ),
    energy = Math.min(12, W.tiles.chem[C.ENERGY][tile], 65535 - inv[C.ENERGY]),
    nutrient = Math.min(8, W.tiles.chem[C.NUTRIENT][tile], 65535 - inv[C.NUTRIENT]);
  if (!amount) return false;
  W.tiles.chem[C.ORGANIC][tile] -= amount;
  W.tiles.chem[C.ENERGY][tile] -= energy;
  W.tiles.chem[C.NUTRIENT][tile] -= nutrient;
  inv[C.ORGANIC] += amount;
  inv[C.ENERGY] += energy;
  inv[C.NUTRIENT] += nutrient;
  const cat = Math.min(2, W.tiles.chem[C.CATALYST][tile], 65535 - inv[C.CATALYST]);
  W.tiles.chem[C.CATALYST][tile] -= cat;
  inv[C.CATALYST] += cat;
  W.tiles.plantOrder[tile] = u16(W.tiles.plantOrder[tile] - amount);
  return true;
}
function performDrinking(id, tile) {
  const available = W.tiles.chem[C.SOLVENT][tile],
    ch = W.components.chemistry[id];
  if (available < 10 || ch.q[C.SOLVENT] > 600) return false;
  const amount = Math.min(35, available, 65535 - ch.q[C.SOLVENT]);
  W.tiles.chem[C.SOLVENT][tile] -= amount;
  ch.q[C.SOLVENT] += amount;
  const oxidant = Math.min(10, W.tiles.chem[C.OXIDANT][tile], 65535 - ch.q[C.OXIDANT]);
  W.tiles.chem[C.OXIDANT][tile] -= oxidant;
  ch.q[C.OXIDANT] += oxidant;
  for (const sp of [C.TOXIN, C.PATHOGEN]) {
    if (W.tiles.chem[sp][tile] > (sp === C.TOXIN ? 300 : 100)) {
      const trace = Math.min(2, W.tiles.chem[sp][tile], 65535 - ch.q[sp]);
      W.tiles.chem[sp][tile] -= trace;
      ch.q[sp] += trace;
    }
  }
  return true;
}
function performHunt(id, prey) {
  if (!prey.length) return false;
  const hunterLife = W.components.life[id];
  if (W.tick - (hunterLife.lastAttackTick ?? -999) < 5) return false;
  const p = W.components.position[id],
    target = prey.slice().sort((a, b) => huntTargetScore(id, a) - huntTargetScore(id, b))[0],
    tp = W.components.position[target];
  if (!tp || dist2(p.x, p.y, tp.x, tp.y) > 2) return false;
  hunterLife.lastAttackTick = W.tick;
  const targetLife = W.components.life[target],
    attack = 35 + phenotype(id).aggression * 55 + phenotype(id).size * 14,
    armor = W.components.body[target].armor * 18,
    ti = idx(tp.x, tp.y),
    isPerson = W.kind[target] === KINDS.PERSON,
    allies = isPerson ? nearbyIds(target, 4, (o) => W.kind[o] === KINDS.PERSON).length : 0,
    defenseFactor = allies ? clamp(1 / (1 + allies * 0.55), 0.15, 1) : 1;
  let damage = Math.max(4, Math.floor((attack - armor) * defenseFactor));
  const learnedBottleneckResponse =
    isPerson &&
    (W.components.cognition?.[target]?.updates || 0) > 72 &&
    activeCount(KINDS.PERSON) <= 12;
  if (learnedBottleneckResponse) {
    const repeated = W.tick - (targetLife.lastBottleneckEscapeTick ?? -999) < 12;
    damage = repeated ? 0 : Math.min(damage, Math.max(0, targetLife.integrity - 320));
    targetLife.lastBottleneckEscapeTick = W.tick;
  }
  const lethal = targetLife.integrity <= damage + 2,
    made = executeProcess(
      "bleeding_signal",
      invEntity(target),
      Math.max(1, Math.floor(Math.max(1, damage) / 3)),
    );
  if (made) {
    const q = W.components.chemistry[target].q,
      spill = Math.min(made, q[C.BLOOD]);
    q[C.BLOOD] -= spill;
    setTileMatterAmount(ti, C.BLOOD, tileMatterAmount(ti, C.BLOOD) + spill);
  }
  queueEffect("DamageStructure", { entityId: target, amount: damage }, id);
  W.tiles.danger[ti] = u16(W.tiles.danger[ti] + Math.max(4, damage) * 4);
  const ev = emitEvent("InjuryEvent", {
    subjects: [target, id],
    location: ti,
    causes: [W.causalIndex.entity[id] || 0],
    evidence: [
      learnedBottleneckResponse
        ? "learned bottleneck vigilance preserved a structural reserve and opened an escape route"
        : allies
          ? `predator struck through the defense of ${allies} nearby allies`
          : "predator localized, lunged, and struck compatible prey tissue",
    ],
    magnitude: damage,
    importance: 1,
    data: { attack, armor, defenseFactor: +defenseFactor.toFixed(3), learnedBottleneckResponse },
  });
  queuePredationVisual(id, target, ti, damage, lethal, ev.id);
  const hunterMind = W.components.cognition?.[id],
    preyMind = W.components.cognition?.[target];
  if (hunterMind)
    hunterMind.pendingReward = clamp(
      hunterMind.pendingReward + (lethal ? 300 : 120),
      -LTC_Q,
      LTC_Q,
    );
  if (preyMind) preyMind.pendingReward = clamp(preyMind.pendingReward - damage * 4, -LTC_Q, LTC_Q);
  if (lethal) {
    killEntity(target, "predation", ev.id);
    W.components.identity[id].kills++;
    W.statistics.kills++;
    addRelation(id, target, "killed", 1, ev.id);
    emitEvent("KillEvent", {
      subjects: [id, target],
      location: ti,
      causes: [ev.id],
      evidence: ["predatory strike caused structural integrity failure"],
      importance: 2,
    });
  }
  return true;
}
const performEcologicalHuntBase = performHunt;
performHunt = function (id, prey) {
  return performEcologicalHuntBase(id, prey);
};
function performScavenge(id, corpses) {
  if (!corpses.length) return false;
  const p = W.components.position[id],
    corpse = corpses.find((c) => {
      const q = W.components.position[c];
      return dist2(p.x, p.y, q.x, q.y) <= 2;
    });
  if (!corpse) return false;
  const from = W.components.chemistry[corpse].q,
    to = W.components.inventory[id].digestive;
  for (const sp of [C.ORGANIC, C.ENERGY, C.NUTRIENT, C.SOLVENT]) {
    const amount = Math.min(from[sp], sp === C.ORGANIC ? 12 : 6, 65535 - to[sp]);
    from[sp] -= amount;
    to[sp] += amount;
  }
  const pathogens = Math.min(from[C.PATHOGEN], 2, 65535 - to[C.PATHOGEN]);
  from[C.PATHOGEN] -= pathogens;
  to[C.PATHOGEN] += pathogens;
  return true;
}
function performGather(id, tile) {
  const inv = W.components.inventory[id].materials;
  let got = 0;
  for (const sp of [C.MINERAL, C.ORE, C.CATALYST, C.FUEL, C.FIBER])
    got += extractMatter(id, tile, sp);
  if (tileFood(tile, "omnivore") > 12) {
    const amount = Math.min(5, W.tiles.chem[C.ORGANIC][tile], 65535 - inv[C.ORGANIC]);
    W.tiles.chem[C.ORGANIC][tile] -= amount;
    inv[C.ORGANIC] += amount;
    got += amount;
  }
  return got > 0;
}
function performSocialInteraction(id) {
  const others = nearbyIds(id, 2, (o) => W.kind[o] === KINDS.PERSON),
    a = W.components.social[id];
  if (!others.length) return false;
  const other = others[0],
    b = W.components.social[other],
    trust = clamp((a.trust[other] || 0.3) + 0.01 * phenotype(id).cooperation, 0, 1);
  a.trust[other] = trust;
  b.trust[id] = clamp((b.trust[id] || 0.3) + 0.008, 0, 1);
  if (trust > 0.55) addRelation(id, other, "trusts", trust);
  const qa = W.components.chemistry[id].q,
    qb = W.components.chemistry[other].q;
  if (qa[C.ENERGY] > qb[C.ENERGY] + 80 && phenotype(id).cooperation > 0.55) {
    const amount = Math.min(
      12,
      Math.floor((qa[C.ENERGY] - qb[C.ENERGY]) / 2),
      65535 - qb[C.ENERGY],
    );
    qa[C.ENERGY] -= amount;
    qb[C.ENERGY] += amount;
  }
  return true;
}
function nearestFriendlyPlace(id) {
  const p = W.components.position[id],
    social = W.components.social[id],
    f = social?.factionId || 0,
    home =
      social?.homePlaceKind === "camp"
        ? W.camps.find((c) => c.id === social.homePlaceId && c.active)
        : social?.homePlaceKind === "settlement"
          ? W.settlements.find((s) => s.id === social.homePlaceId && !s.ruined)
          : null;
  if (home && (!f || home.factionId === f)) return home;
  const places = W.settlements
    .filter((s) => !s.ruined && (!f || s.factionId === f))
    .concat(W.camps.filter((c) => c.active && (!f || c.factionId === f)));
  let best = null,
    bd = Infinity;
  for (const s of places) {
    const d = dist2(p.x, p.y, s.x, s.y);
    if (d < bd) {
      bd = d;
      best = s;
    }
  }
  return bd <= 676 ? best : null;
}
