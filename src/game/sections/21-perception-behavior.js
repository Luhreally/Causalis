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
function mateChoiceScore(id, other) {
  const p = W.components.position[id],
    op = W.components.position[other];
  if (!p || !op || id === other) return -Infinity;
  const a = W.components.reproduction[id],
    b = W.components.reproduction[other],
    compatibility = 1 - Math.abs((a?.matePreference ?? 0.5) - (b?.matePreference ?? 0.5)),
    social = W.components.social[id],
    otherSocial = W.components.social[other];
  if (W.kind[id] === KINDS.PERSON) {
    if (social?.partnerId && social.partnerId !== other && peekAlive(social.partnerId))
      return -Infinity;
    if (otherSocial?.partnerId && otherSocial.partnerId !== id && peekAlive(otherSocial.partnerId))
      return -Infinity;
  }
  const relationship = social?.relationships?.[other],
    bond =
      (social?.partnerId === other ? 6 : 0) +
      (relationship?.affection || 0) * 2 +
      (relationship?.trust || social?.trust?.[other] || 0) * 1.5,
    distance = Math.sqrt(dist2(p.x, p.y, op.x, op.y)),
    stableVariation =
      (hashParts(W.seedHash, "mate-choice", Math.min(id, other), Math.max(id, other)) >>> 0) /
      4294967295;
  return compatibility * 5 + bond + stableVariation * 0.5 - distance * 0.28;
}
function eligibleMateCandidates(id, radius = 32) {
  const position = W.components.position[id],
    kind = W.kind[id];
  if (!position) return [];
  return W.activeIds
    .filter((other) => {
      if (other === id || W.kind[other] !== kind) return false;
      const available = kind === KINDS.PREDATOR ? canJoinPredatorPair(other) : canReproduce(other);
      if (!available) return false;
      const otherPosition = W.components.position[other];
      return (
        otherPosition &&
        dist2(position.x, position.y, otherPosition.x, otherPosition.y) <= radius * radius &&
        Number.isFinite(mateChoiceScore(id, other))
      );
    })
    .sort((a, b) => mateChoiceScore(id, b) - mateChoiceScore(id, a) || a - b);
}
function simulationStrideForTier(tier) {
  if (tier !== "simplified-due") return 1;
  return W.config.complexity === "lean" ? 8 : W.config.complexity === "deep" ? 2 : 4;
}
function runMetabolism(id, tier) {
  const ch = W.components.chemistry[id],
    l = W.components.life[id],
    p = phenotype(id),
    rate = simulationStrideForTier(tier),
    inv = invEntity(id),
    d = W.components.inventory[id].digestive,
    pos = W.components.position[id],
    ti = idx(pos.x, pos.y);
  for (const sp of [
    C.ENERGY,
    C.SOLVENT,
    C.NUTRIENT,
    C.CATALYST,
    C.INFO,
    C.MEMBRANE,
    C.TOXIN,
    C.PATHOGEN,
  ]) {
    const limit =
        sp === C.ENERGY
          ? 14 * rate
          : sp === C.NUTRIENT
            ? 6 * rate
            : sp === C.INFO || sp === C.MEMBRANE
              ? 2 * rate
              : 3 * rate,
      take = Math.min(d[sp], limit, 65535 - ch.q[sp]);
    d[sp] -= take;
    ch.q[sp] += take;
  }
  const trophicScale = W.kind[id] === KINDS.PREDATOR ? 0.14 : 1,
    rawRespiratoryDemand =
      (rate * METABOLIC_PACE * (1 + p.speed * 0.2) * trophicScale) / Math.max(0.35, p.metabolism),
    respiratoryBudget = (l.respiratoryRemainder || 0) + rawRespiratoryDemand,
    respiratoryDemand = Math.floor(respiratoryBudget),
    oxidantNeed = Math.max(0, respiratoryDemand + 2 - ch.q[C.OXIDANT]),
    oxidantIntake = Math.min(oxidantNeed, W.tiles.chem[C.OXIDANT][ti], 65535 - ch.q[C.OXIDANT]);
  l.respiratoryRemainder = respiratoryBudget - respiratoryDemand;
  W.tiles.chem[C.OXIDANT][ti] -= oxidantIntake;
  ch.q[C.OXIDANT] += oxidantIntake;
  const respired = executeProcess("respiration", inv, respiratoryDemand, { dissipate: 1 }),
    exhaled = Math.min(respired, ch.q[C.GAS], 65535 - W.tiles.chem[C.GAS][ti]);
  ch.q[C.GAS] -= exhaled;
  W.tiles.chem[C.GAS][ti] += exhaled;
  const organicReserveTarget =
      W.kind[id] === KINDS.PERSON ? 150 : W.kind[id] === KINDS.PREDATOR ? 88 : 68,
    assimilatedOrganic = Math.min(
      d[C.ORGANIC],
      6 * rate,
      Math.max(0, organicReserveTarget - ch.q[C.ORGANIC]),
    );
  d[C.ORGANIC] -= assimilatedOrganic;
  ch.q[C.ORGANIC] += assimilatedOrganic;
  const energyReserve = W.kind[id] === KINDS.PERSON ? 500 : 150;
  if (ch.q[C.ENERGY] < energyReserve) {
    const intake = Math.min(14 * rate, d[C.ORGANIC], 65535 - ch.q[C.ORGANIC]);
    d[C.ORGANIC] -= intake;
    ch.q[C.ORGANIC] += intake;
    const cat = Math.min(d[C.CATALYST], 2, 65535 - ch.q[C.CATALYST]);
    d[C.CATALYST] -= cat;
    ch.q[C.CATALYST] += cat;
    const structuralReserve = W.kind[id] === KINDS.PERSON ? 64 : 30,
      available = Math.max(0, ch.q[C.ORGANIC] - structuralReserve),
      amount = Math.min(14 * rate, available);
    if (amount > 0) executeProcess("digestion", inv, Math.max(1, Math.floor(amount / 2)));
  }
  const solventBudget =
      (l.solventLossRemainder || 0) +
      (rate + (p.size > 1.3 ? 1 : 0)) * METABOLIC_PACE * (W.kind[id] === KINDS.PREDATOR ? 0.3 : 1),
    solventLoss = Math.min(ch.q[C.SOLVENT], Math.floor(solventBudget));
  l.solventLossRemainder = solventBudget - Math.floor(solventBudget);
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
      ((respiratoryDemand === 0 || respired) && ch.q[C.ENERGY] >= 5 ? rate : -2 * rate) -
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
  if ((dx || dy) && typeof movementTileBlocked === "function" && movementTileBlocked(id, x, y))
    return -1e9;
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
    const localPrey = (W.spatialBins[i] || []).filter((other) => {
      const kind = W.kind[other],
        otherLife = W.components.life[other];
      return (
        (kind === KINDS.HERBIVORE || kind === KINDS.PERSON) &&
        otherLife?.regulation > 0 &&
        otherLife.integrity > 0
      );
    }).length;
    score += blood * 0.65 + localPrey * 18;
    const target = W.components.position[life?.preyTargetId];
    if (target && classifyAlive(life.preyTargetId)) {
      const targetLife = derivedLife(life.preyTargetId);
      score -= Math.sqrt(dist2(x, y, target.x, target.y)) * 31;
      score += (100 - targetLife.health) * 0.16;
    }
  }
  if (goal === "defend") {
    const threat = W.components.position[life?.threatId];
    if (threat && classifyAlive(life.threatId))
      score -= Math.sqrt(dist2(x, y, threat.x, threat.y)) * 28;
    else score += danger * 1.5 + fire * 0.3;
  }
  if (goal === "wander") {
    score -= W.tiles.habitation[i] * 0.018 + W.tiles.populationPressure[i] * 0.025;
    score +=
      counterRand("wander-direction", Math.floor(W.tick / 8), id, (dx + 2) * 13 + (dy + 2)) * 18;
    if (!dx && !dy) score -= 24;
  }
  if (goal === "scavenge") {
    score += blood * 2 + disease * -0.5;
    const corpse = W.components.position[life?.scavengeTargetId];
    if (corpse && W.kind[life.scavengeTargetId] === KINDS.CORPSE)
      score -= Math.sqrt(dist2(x, y, corpse.x, corpse.y)) * 30;
  }
  if (goal === "gather") score += tileResource(i) * 2 + food * 0.5;
  if (goal === "return") {
    const destination =
      typeof preferredReturnBuilding === "function"
        ? preferredReturnBuilding(id)
        : nearestFriendlyPlace(id);
    if (destination) score -= Math.sqrt(dist2(x, y, destination.x, destination.y)) * 8;
  }
  if (goal === "migrate") score += food + moist - danger - organismHabitatStress(id, i) * 1.5;
  score += counterRand("behavior-tie", W.tick, id, (dx + 2) * 13 + (dy + 2)) * 0.05;
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
function personNeedsWaterEscape(id) {
  if (W.kind[id] !== KINDS.PERSON) return false;
  const position = W.components.position[id];
  return !!(
    position &&
    W.tiles.liquid[idx(position.x, position.y)] > WATER_DEPTH.WADE_LIMIT &&
    (typeof hasNavigableWatercraft !== "function" || !hasNavigableWatercraft(id))
  );
}
function bestWaterEscapeDirection(id) {
  const position = W.components.position[id];
  if (!position) return [0, 0];
  const start = idx(position.x, position.y);
  if (W.tiles.liquid[start] <= WATER_DEPTH.WADE_LIMIT) return [0, 0];
  const search = (avoidDeep) => {
    const predecessor = new Int32Array(W.tileCount);
    predecessor.fill(-2);
    predecessor[start] = -1;
    const queue = [start];
    let goal = -1;
    for (let cursor = 0; cursor < queue.length && goal < 0; cursor++) {
      const current = queue[cursor];
      for (const next of neighbors4(current)) {
        if (predecessor[next] !== -2) continue;
        const [nextX, nextY] = xy(next);
        if (typeof movementTileBlocked === "function" && movementTileBlocked(id, nextX, nextY))
          continue;
        if (avoidDeep && W.tiles.liquid[next] > WATER_DEPTH.DEEP) continue;
        predecessor[next] = current;
        if (W.tiles.liquid[next] <= WATER_DEPTH.WADE_LIMIT) {
          goal = next;
          break;
        }
        queue.push(next);
      }
    }
    return { predecessor, goal };
  };
  let { predecessor, goal } = search(true);
  if (goal < 0) ({ predecessor, goal } = search(false));
  if (goal < 0) {
    const fallback = neighbors4(start)
      .filter((tile) => {
        const [x, y] = xy(tile);
        return typeof movementTileBlocked !== "function" || !movementTileBlocked(id, x, y);
      })
      .sort((left, right) => W.tiles.liquid[left] - W.tiles.liquid[right] || left - right)[0];
    if (fallback === undefined) return [0, 0];
    const [x, y] = xy(fallback);
    return [Math.sign(x - position.x), Math.sign(y - position.y)];
  }
  while (predecessor[goal] !== start && predecessor[goal] >= 0) goal = predecessor[goal];
  const [x, y] = xy(goal);
  return [Math.sign(x - position.x), Math.sign(y - position.y)];
}
function huntTargetScore(id, target) {
  const p = W.components.position[id],
    tp = W.components.position[target],
    life = derivedLife(target),
    body = W.components.body[target],
    ph = phenotype(id),
    distance = Math.sqrt(dist2(p.x, p.y, tp.x, tp.y)),
    vulnerability = (100 - life.health) * 0.24 + tileBlood(idx(tp.x, tp.y)) * 0.08,
    defense =
      (body?.armor || 0) * 12 +
      (phenotype(target).size - ph.size) * 7 +
      (W.kind[target] === KINDS.PERSON ? 60 : 0);
  return (
    distance * 18 +
    defense -
    vulnerability +
    counterRand("hunt-target-tie", Math.floor(W.tick / 8), id, target) * 0.01
  );
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
  const senseRadius = clamp(Math.round(ph.sense), 2, 11),
    huntableHerbivores = k === KINDS.PREDATOR ? biospherePopulation(KINDS.HERBIVORE) > 8 : true,
    huntablePeople =
      k === KINDS.PREDATOR
        ? !huntableHerbivores &&
          biospherePopulation(KINDS.PERSON) > 10 &&
          derivedLife(id).hunger > 70
        : true,
    nearPred =
      k !== KINDS.PREDATOR
        ? nearbyIds(id, senseRadius, (o) => W.kind[o] === KINDS.PREDATOR && classifyAlive(o))
        : [],
    wildGameSustains = k === KINDS.PERSON ? biospherePopulation(KINDS.HERBIVORE) > 20 : false,
    nearPrey =
      k === KINDS.PERSON
        ? wildGameSustains
          ? nearbyIds(
              id,
              senseRadius,
              (o) =>
                W.kind[o] === KINDS.HERBIVORE &&
                classifyAlive(o) &&
                !(typeof herdForAnimal === "function" && herdForAnimal(o)),
            )
          : []
        : k === KINDS.PREDATOR
        ? nearbyIds(
            id,
            senseRadius,
            (o) =>
              (W.kind[o] === KINDS.HERBIVORE && huntableHerbivores) ||
              (W.kind[o] === KINDS.PERSON && huntablePeople),
          )
        : [],
    nearCorpse = nearbyIds(id, senseRadius, (o) => W.kind[o] === KINDS.CORPSE);
  nearCorpse.sort((a, b) => {
    const ap = W.components.position[a],
      bp = W.components.position[b];
    return dist2(p.x, p.y, ap.x, ap.y) - dist2(p.x, p.y, bp.x, bp.y) || a - b;
  });
  l.scavengeTargetId = nearCorpse[0] || 0;
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
      ((W.kind[remembered] === KINDS.HERBIVORE && huntableHerbivores) ||
        (W.kind[remembered] === KINDS.PERSON && huntablePeople)) &&
      !nearPrey.includes(remembered)
    ) {
      const rp = W.components.position[remembered];
      if (rp && dist2(p.x, p.y, rp.x, rp.y) <= senseRadius * senseRadius * 2.25)
        nearPrey.push(remembered);
    }
    if (!nearPrey.length && l.hunger > 28) {
      const searchRadius = l.hunger > 50 ? Math.hypot(W.width, W.height) : senseRadius * 5,
        distantPrey = W.activeIds
          .filter((other) => {
            if (
              other === id ||
              !peekAlive(other) ||
              (W.kind[other] === KINDS.HERBIVORE
                ? !huntableHerbivores
                : W.kind[other] === KINDS.PERSON
                  ? !huntablePeople
                  : true)
            )
              return false;
            const otherPosition = W.components.position[other];
            return (
              otherPosition &&
              dist2(p.x, p.y, otherPosition.x, otherPosition.y) <= searchRadius * searchRadius
            );
          })
          .sort((a, b) => huntTargetScore(id, a) - huntTargetScore(id, b));
      if (distantPrey[0]) nearPrey.push(distantPrey[0]);
    }
    nearPrey.sort((a, b) => huntTargetScore(id, a) - huntTargetScore(id, b));
    l.preyTargetId = nearPrey[0] || 0;
  }
  const threatPosition = l.threatId ? W.components.position[l.threatId] : null,
    threatLife = l.threatId ? W.components.life[l.threatId] : null,
    threatDistance =
      threatPosition && classifyAlive(l.threatId)
        ? Math.sqrt(dist2(p.x, p.y, threatPosition.x, threatPosition.y))
        : Infinity,
    threatProximity = Number.isFinite(threatDistance)
      ? clamp(1 - threatDistance / Math.max(1, senseRadius * 1.5), 0, 1)
      : 0,
    threatTargetsSelf =
      Number.isFinite(threatDistance) &&
      (threatDistance <= Math.SQRT2 || threatLife?.preyTargetId === id),
    localizedFlight =
      Number.isFinite(threatDistance) &&
      (k === KINDS.HERBIVORE
        ? 280 + threatProximity * 120
        : threatTargetsSelf
          ? 300 + threatProximity * 140
          : 70 + threatProximity * 150),
    waterEscape = personNeedsWaterEscape(id),
    target = l.preyTargetId ? derivedLife(l.preyTargetId) : null,
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
          k === KINDS.PREDATOR
            ? 0
            : l.hunger * 1.25 +
              Math.max(0, l.hunger - 55) * 3 +
              tileFood(ti, k === KINDS.PERSON ? "omnivore" : "grazer"),
        reason: "low accessible chemical energy",
      },
      {
        id: "water",
        score: l.thirst > 72 ? 1e6 : l.thirst * 1.3,
        reason: "low internal solvent balance",
      },
      {
        id: "flee",
        score:
          (waterEscape ? 1e9 : 0) +
          W.tiles.fire[ti] / 4 +
          W.tiles.danger[ti] / 6 +
          localizedFlight +
          tileFear(ti) * (k === KINDS.HERBIVORE ? 1.1 : 0.25),
        reason: waterEscape
          ? "deep water exceeded unassisted locomotion; following the shortest reachable route to land"
          : threatTargetsSelf
            ? "a predator localized this individual and began an immediate approach"
            : Number.isFinite(threatDistance)
              ? "a predator entered sensory range and its position was localized"
              : "fire, danger, or alarm compounds were sensed",
      },
      {
        id: "mate",
        score: canReproduce(id) ? (k === KINDS.PREDATOR ? 180 : 48) + ph.fertility * 38 : 0,
        reason: "stored matter permits reproduction",
      },
    ];
  if (k === KINDS.PERSON && nearPrey.length)
    scores.push({
      id: "hunt",
      score: l.hunger * 0.9 + nearPrey.length * 12 + targetProximity * 40,
      reason: "hunger and nearby game made a hunt worth the risk",
    });
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
        score: Math.min(2, nearCorpse.length) * 36 + l.hunger * 0.4,
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
  const campaignOrder = k === KINDS.PERSON ? W.components.campaign?.[id] : null;
  if (campaignOrder && l.hunger < 78 && l.thirst < 70) {
    const away = Math.max(Math.abs(campaignOrder.x - p.x), Math.abs(campaignOrder.y - p.y));
    scores.push({
      id: "march",
      score: 140 + Math.min(90, away * 3),
      reason:
        campaignOrder.role === "attack"
          ? "campaign orders carried the column toward the objective"
          : "the muster fell back to hold the threatened settlement",
    });
  }
  if (W.tiles.fire[ti] > 90) {
    const forcedFlee = scores.find((candidate) => candidate.id === "flee");
    forcedFlee.score = 1e9;
    forcedFlee.reason = "combustion heat and smoke exceeded the immediate escape threshold";
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
  const actionStride = simulationStrideForTier(tier);
  if (action.id === "flee") {
    dir = waterEscape ? bestWaterEscapeDirection(id) : bestDirection(id, "flee");
    if (l.hunger > 88) performFeeding(id, ti, actionStride) || feedFromAdjacent(id, actionStride);
    if (l.thirst > 88) performDrinking(id, ti, actionStride) || drinkFromAdjacent(id, actionStride);
    const made = executeProcess("fear_signal", invEntity(id), 2);
    if (made) {
      const q = W.components.chemistry[id].q,
        emit = Math.min(made, q[C.FEAR]);
      q[C.FEAR] -= emit;
      setTileMatterAmount(ti, C.FEAR, tileMatterAmount(ti, C.FEAR) + emit);
      rememberFearLocation(id, ti);
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
    const mate = eligibleMateCandidates(
      id,
      k === KINDS.PREDATOR ? Math.max(W.width, W.height) : 32,
    )[0];
    if (mate) {
      const mp = W.components.position[mate];
      dir = [Math.sign(mp.x - p.x), Math.sign(mp.y - p.y)];
    } else dir = bestDirection(id, "migrate");
  } else if (action.id === "food") {
    if (!performFeeding(id, ti, actionStride) && !feedFromAdjacent(id, actionStride)) {
      dir = bestDirection(id, "food");
      if (
        (!dir[0] && !dir[1]) ||
        (l.hunger > 74 && tileFood(ti, k === KINDS.PERSON ? "omnivore" : "grazer") < 3)
      ) {
        const sensed = bestSensedFoodStep(id, senseRadius);
        if (sensed[0] || sensed[1]) dir = sensed;
      }
    }
  } else if (action.id === "water")
    performDrinking(id, ti, actionStride) ||
      drinkFromAdjacent(id, actionStride) ||
      (dir = bestDirection(id, "water"));
  else if (action.id === "hunt") performHunt(id, nearPrey) || (dir = bestDirection(id, "hunt"));
  else if (action.id === "scavenge")
    performScavenge(id, nearCorpse) || (dir = bestDirection(id, "scavenge"));
  else if (action.id === "gather") performGather(id, ti) || (dir = bestDirection(id, "gather"));
  else if (action.id === "march") {
    dir = campaignMarchStep(id);
    if (l.hunger > 52) performFeeding(id, ti, actionStride) || feedFromAdjacent(id, actionStride);
    if (l.thirst > 52) performDrinking(id, ti, actionStride) || drinkFromAdjacent(id, actionStride);
  } else if (action.id === "return") dir = bestDirection(id, "return");
  else if (action.id === "socialize") performSocialInteraction(id);
  else if (action.id === "defend") dir = bestDirection(id, "defend");
  else if (action.id === "wander") dir = bestDirection(id, "wander");
  if (dir[0] || dir[1]) {
    const nx = clamp(p.x + dir[0], 0, W.width - 1),
      ny = clamp(p.y + dir[1], 0, W.height - 1),
      chargeMotion = k !== KINDS.PERSON || W.tick % 2 === id % 2,
      motionEffort = chargeMotion
        ? ph.speed * ph.size * 0.22 * (k === KINDS.PREDATOR ? 0.45 : 1)
        : 0;
    if ((waterEscape || W.tiles.liquid[idx(nx, ny)] < 1100) && W.tiles.fire[idx(nx, ny)] < 700) {
      queueEffect("MoveEntity", { entityId: id, x: nx, y: ny, motionEffort, waterEscape }, id);
      if (k === KINDS.PREDATOR && action.id === "hunt" && l.preyTargetId) {
        const pursuitChance = clamp(
          0.42 +
            (ph.speed - (peekPhenotype(l.preyTargetId)?.speed || 1)) * 0.35 +
            ph.aggression * 0.18,
          0.25,
          0.85,
        );
        if (counterRand("predator-pursuit-step", W.tick, id, l.preyTargetId) < pursuitChance) {
          queueEffect(
            "MoveEntity",
            {
              entityId: id,
              x: clamp(p.x + dir[0] * 2, 0, W.width - 1),
              y: clamp(p.y + dir[1] * 2, 0, W.height - 1),
              pursuit: true,
              motionEffort,
            },
            id,
          );
        }
      }
    }
  }
  if (k === KINDS.PERSON) W.tiles.habitation[ti] = u16(W.tiles.habitation[ti] + 1);
}
function performFeeding(id, tile, stride = 1) {
  const k = W.kind[id],
    available = tileFood(tile, k === KINDS.PERSON ? "omnivore" : "grazer");
  if (k === KINDS.PREDATOR) return false;
  if (available < 0.5) return false;
  const inv = W.components.inventory[id].digestive,
    amount = Math.min(
      18 * stride,
      W.tiles.chem[C.ORGANIC][tile],
      (Math.floor(available / 2) + 2) * stride,
      65535 - inv[C.ORGANIC],
    ),
    energy = Math.min(12 * stride, W.tiles.chem[C.ENERGY][tile], 65535 - inv[C.ENERGY]),
    nutrient = Math.min(8 * stride, W.tiles.chem[C.NUTRIENT][tile], 65535 - inv[C.NUTRIENT]);
  if (!amount) return false;
  W.tiles.chem[C.ORGANIC][tile] -= amount;
  W.tiles.chem[C.ENERGY][tile] -= energy;
  W.tiles.chem[C.NUTRIENT][tile] -= nutrient;
  inv[C.ORGANIC] += amount;
  inv[C.ENERGY] += energy;
  inv[C.NUTRIENT] += nutrient;
  const cat = Math.min(2 * stride, W.tiles.chem[C.CATALYST][tile], 65535 - inv[C.CATALYST]);
  W.tiles.chem[C.CATALYST][tile] -= cat;
  inv[C.CATALYST] += cat;
  for (const [species, limit] of [
    [C.INFO, 1],
    [C.MEMBRANE, 2],
  ]) {
    const moved = Math.min(limit * stride, tileMatterAmount(tile, species), 65535 - inv[species]);
    setTileMatterAmount(tile, species, tileMatterAmount(tile, species) - moved);
    inv[species] += moved;
  }
  W.tiles.plantOrder[tile] = u16(W.tiles.plantOrder[tile] - amount);
  return true;
}
function performDrinking(id, tile, stride = 1) {
  const available = W.tiles.chem[C.SOLVENT][tile],
    ch = W.components.chemistry[id];
  if (available < 10 || ch.q[C.SOLVENT] > 600) return false;
  const amount = Math.min(35 * stride, available, 65535 - ch.q[C.SOLVENT]);
  W.tiles.chem[C.SOLVENT][tile] -= amount;
  ch.q[C.SOLVENT] += amount;
  const oxidant = Math.min(10 * stride, W.tiles.chem[C.OXIDANT][tile], 65535 - ch.q[C.OXIDANT]);
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
function bestSensedFoodStep(id, radius) {
  const p = W.components.position[id],
    metabolism = W.kind[id] === KINDS.PERSON ? "omnivore" : "grazer";
  let bx = 0,
    by = 0,
    bestScore = 4;
  for (let dy = -radius; dy <= radius; dy++)
    for (let dx = -radius; dx <= radius; dx++) {
      if (!dx && !dy) continue;
      const x = p.x + dx,
        y = p.y + dy;
      if (!inside(x, y)) continue;
      const score = tileFood(idx(x, y), metabolism) - Math.max(Math.abs(dx), Math.abs(dy)) * 2;
      if (score > bestScore) {
        bestScore = score;
        bx = dx;
        by = dy;
      }
    }
  return [Math.sign(bx), Math.sign(by)];
}
function feedFromAdjacent(id, stride = 1) {
  if (W.kind[id] !== KINDS.PERSON) return false;
  const p = W.components.position[id];
  let best = -1,
    bestScore = 0;
  for (let k = 0; k < 8; k++) {
    const x = p.x + DIRS[k][0],
      y = p.y + DIRS[k][1];
    if (!inside(x, y)) continue;
    const tile = idx(x, y),
      score = tileFood(tile, "omnivore");
    if (score > bestScore) {
      bestScore = score;
      best = tile;
    }
  }
  return best >= 0 && performFeeding(id, best, stride);
}
function drinkFromAdjacent(id, stride = 1) {
  const p = W.components.position[id];
  let best = -1,
    bestScore = 9;
  for (let k = 0; k < 8; k++) {
    const x = p.x + DIRS[k][0],
      y = p.y + DIRS[k][1];
    if (!inside(x, y)) continue;
    const tile = idx(x, y),
      score = W.tiles.chem[C.SOLVENT][tile];
    if (score > bestScore) {
      bestScore = score;
      best = tile;
    }
  }
  return best >= 0 && performDrinking(id, best, stride);
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
  const requestedBlood = clamp(Math.ceil(Math.max(1, damage) / 12), 1, 12),
    lethal = targetLife.integrity <= damage + 2;
  executeProcess("bleeding_signal", invEntity(target), requestedBlood);
  const q = W.components.chemistry[target].q,
    spilled = Math.min(q[C.BLOOD] || 0, requestedBlood);
  if (spilled) {
    q[C.BLOOD] -= spilled;
    setTileMatterAmount(ti, C.BLOOD, tileMatterAmount(ti, C.BLOOD) + spilled);
  }
  const hunterDigestive = W.components.inventory[id].digestive,
    targetChemistry = W.components.chemistry[target].q;
  let consumed = 0;
  for (const [species, requested] of [
    [C.ORGANIC, Math.max(3, Math.ceil(damage / 7))],
    [C.ENERGY, Math.max(2, Math.ceil(damage / 12))],
    [C.NUTRIENT, Math.max(1, Math.ceil(damage / 18))],
    [C.SOLVENT, Math.max(1, Math.ceil(damage / 20))],
    [C.INFO, Math.max(1, Math.ceil(damage / 36))],
    [C.MEMBRANE, Math.max(1, Math.ceil(damage / 24))],
    [C.CATALYST, 1],
  ]) {
    const moved = Math.min(requested, targetChemistry[species], 65535 - hunterDigestive[species]);
    targetChemistry[species] -= moved;
    hunterDigestive[species] += moved;
    consumed += moved;
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
    data: {
      attack,
      armor,
      defenseFactor: +defenseFactor.toFixed(3),
      learnedBottleneckResponse,
      bloodLost: spilled,
      consumed,
    },
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
    corpse = corpses
      .filter((candidate) => {
        const position = W.components.position[candidate];
        return position && dist2(p.x, p.y, position.x, position.y) <= 2;
      })
      .sort((a, b) => {
        const aq = W.components.chemistry[a]?.q,
          bq = W.components.chemistry[b]?.q;
        return (bq?.[C.ORGANIC] || 0) - (aq?.[C.ORGANIC] || 0) || a - b;
      })[0];
  if (!corpse) return false;
  const from = W.components.chemistry[corpse].q,
    to = W.components.inventory[id].digestive;
  for (const sp of [C.ORGANIC, C.ENERGY, C.NUTRIENT, C.SOLVENT, C.INFO, C.MEMBRANE, C.CATALYST]) {
    const amount = Math.min(
      from[sp],
      sp === C.ORGANIC ? 24 : sp === C.INFO || sp === C.CATALYST ? 3 : 12,
      65535 - to[sp],
    );
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
  const others = nearbyIds(id, 2, (o) => W.kind[o] === KINDS.PERSON).sort((left, right) => {
      const a = W.components.social[id],
        leftTrust = a.trust[left] || 0,
        rightTrust = a.trust[right] || 0,
        cycle = Math.floor(W.tick / 16);
      return (
        leftTrust - rightTrust ||
        counterRand("social-partner", cycle, id, left) -
          counterRand("social-partner", cycle, id, right)
      );
    }),
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
  return best;
}
