// ================================================================
// 42E. SEALED REFUGES, CAMPAIGN PLANS, AND DEEP PRIMITIVE GEAR
// ================================================================
// Buildings and livestock enclosures are physical attack barriers. Campaigns
// expose their real launch gates, and primitive artifacts carry functional
// profiles rather than collapsing into one generic weapon or armor form.

const PROTECTIVE_BUILDING_TYPES = new Set([
  "stockpile",
  "shelter",
  "workshop",
  "kiln",
  "forge",
  "clinic",
  "archive",
  "hall",
]);

function farmTiles(building) {
  return farmFootprintTiles(building);
}

const buildingAtTileFootprintBase = buildingAtTile;
buildingAtTile = function (tile) {
  const [x, y] = xy(tile),
    farm = (W.buildings || []).find(
      (building) =>
        building.type === "farm" &&
        (!building.ruined || sum(Array.from(building.composition || [])) > 0) &&
        Math.abs(x - building.x) <= 1 &&
        Math.abs(y - building.y) <= 1,
    );
  return farm || buildingAtTileFootprintBase(tile);
};

const buildingScreenSizeFarmBase = buildingScreenSize;
buildingScreenSize = function (building, metrics) {
  if (building?.type === "farm") return Math.max(5, metrics.tw * 1.38);
  return buildingScreenSizeFarmBase(building, metrics);
};

function cultivatedCropVisual(field, building) {
  const chemistry = field?.cropChemistry || fieldChemistrySignature(field),
    values = [
      chemistry?.[C.ORGANIC] || 0,
      chemistry?.[C.NUTRIENT] || 0,
      chemistry?.[C.SOLVENT] || 0,
      chemistry?.[C.PIGMENT] || 0,
      chemistry?.[C.CATALYST] || 0,
      chemistry?.[C.MINERAL] || 0,
    ],
    seed = hashParts(
      W.seedHash,
      "cultivated-crop-visual",
      building.styleSeed || building.id,
      ...values.map((value) => value >> 3),
    ),
    forms = ["stalk", "rosette", "reed", "fruiting-vine", "fanleaf", "bulb"],
    pigmentHue = W.definitions.species[C.PIGMENT]?.colorHue ?? W.terrainGenome?.floraHue ?? 110,
    nutrientBias = (values[1] % 61) - 30,
    catalystBias = (values[4] % 47) - 23;
  return {
    seed,
    form: forms[seed % forms.length],
    stemHue: wrapHue(pigmentHue + nutrientBias + (seed % 37) - 18),
    bloomHue: wrapHue(pigmentHue + 95 + catalystBias + ((seed >>> 8) % 53)),
    height: 0.78 + ((seed >>> 12) % 45) / 100,
    leafWidth: 0.72 + ((seed >>> 18) % 55) / 100,
  };
}

function cropQuadPoint(points, u, v) {
  const topX = lerp(points[0][0], points[1][0], u),
    topY = lerp(points[0][1], points[1][1], u),
    bottomX = lerp(points[3][0], points[2][0], u),
    bottomY = lerp(points[3][1], points[2][1], u);
  return [lerp(topX, bottomX, v), lerp(topY, bottomY, v)];
}

function drawCultivatedCrop(g, x, y, size, profile, stage, variant) {
  const mature = stage === "ripe",
    young = stage === "sown",
    height = size * profile.height * (young ? 0.45 : mature ? 1.15 : 0.82),
    width = size * profile.leafWidth,
    sway = ((variant % 5) - 2) * size * 0.07;
  g.save();
  g.translate(x, y);
  g.lineCap = "round";
  g.strokeStyle = hsl(profile.stemHue, 55, mature ? 38 : 46, 0.96);
  g.fillStyle = hsl(profile.stemHue + 8, 62, young ? 55 : 43, 0.94);
  g.lineWidth = Math.max(1, size * 0.13);
  if (profile.form === "rosette") {
    for (let leaf = 0; leaf < (young ? 4 : 7); leaf++) {
      g.save();
      g.rotate((Math.PI * 2 * leaf) / (young ? 4 : 7) + variant * 0.17);
      g.beginPath();
      g.ellipse(0, -width * 0.42, width * 0.22, width * 0.58, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  } else if (profile.form === "reed") {
    for (const offset of [-0.28, 0, 0.28]) {
      g.beginPath();
      g.moveTo(offset * width, 0);
      g.lineTo(offset * width + sway, -height * (1 - Math.abs(offset) * 0.22));
      g.stroke();
      if (!young) {
        g.fillStyle = hsl(profile.bloomHue, 64, mature ? 62 : 49, 0.96);
        g.beginPath();
        g.ellipse(
          offset * width + sway,
          -height * (1 - Math.abs(offset) * 0.22),
          width * 0.13,
          height * 0.18,
          0,
          0,
          Math.PI * 2,
        );
        g.fill();
      }
    }
  } else {
    g.beginPath();
    g.moveTo(0, 0);
    if (profile.form === "fruiting-vine")
      g.quadraticCurveTo(width * 0.7, -height * 0.45, sway, -height);
    else g.lineTo(sway, -height);
    g.stroke();
    for (const side of [-1, 1]) {
      g.save();
      g.translate(sway * 0.45, -height * (side < 0 ? 0.42 : 0.68));
      g.rotate(side * (profile.form === "fanleaf" ? 0.95 : 0.62));
      g.beginPath();
      g.ellipse(0, -width * 0.25, width * 0.2, width * 0.52, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    if (profile.form === "fanleaf" && !young)
      for (const fan of [-1, 0, 1]) {
        g.beginPath();
        g.moveTo(sway, -height * 0.8);
        g.lineTo(sway + fan * width * 0.55, -height * 1.18);
        g.stroke();
      }
    if (mature || profile.form === "bulb") {
      g.fillStyle = hsl(profile.bloomHue, 72, mature ? 58 : 48, 0.98);
      g.beginPath();
      const fruitY = profile.form === "bulb" ? -height * 0.25 : -height;
      g.arc(
        sway,
        fruitY,
        Math.max(1.2, width * (profile.form === "bulb" ? 0.34 : 0.22)),
        0,
        Math.PI * 2,
      );
      g.fill();
    }
  }
  g.restore();
}

const drawBuildingSiteFarmBase = drawBuildingSite;
drawBuildingSite = function (g, building, now, metrics) {
  if (building?.type !== "farm" || building.ruined)
    return drawBuildingSiteFarmBase(g, building, now, metrics);
  const screen = proceduralProjectTile(building.x + 0.5, building.y + 0.5, metrics),
    radius = buildingScreenSize(building, metrics),
    palette = buildingPalette(building),
    field = W.fields?.find((candidate) => candidate.buildingId === building.id),
    stage = field?.stage || (building.complete ? "fallow" : "construction"),
    progress = building.complete ? 1 : clamp(building.progress || 0, 0, 1),
    points = buildingTileFootprintPoints(building, metrics, 3),
    cropHue =
      stage === "ripe"
        ? 52
        : stage === "growing"
          ? 112
          : stage === "sown"
            ? 88
            : W.terrainGenome?.baseHue || 35;
  g.save();
  drawBuildingFootprint(
    g,
    screen,
    radius,
    UI.view,
    hsl(cropHue, stage === "fallow" ? 24 : 48, stage === "ripe" ? 34 : 22, 0.92),
    building.complete ? palette.light : palette.accent,
    !building.complete,
    points,
  );
  g.strokeStyle = hsl(cropHue, 46, 55, 0.7);
  g.lineWidth = Math.max(1, radius * 0.035);
  const line = (a, b, t) => [
    lerp(points[a][0], points[b][0], t),
    lerp(points[a][1], points[b][1], t),
  ];
  for (const t of [1 / 3, 2 / 3]) {
    const top = line(0, 1, t),
      bottom = line(3, 2, t),
      left = line(0, 3, t),
      right = line(1, 2, t);
    g.beginPath();
    g.moveTo(top[0], top[1]);
    g.lineTo(bottom[0], bottom[1]);
    g.moveTo(left[0], left[1]);
    g.lineTo(right[0], right[1]);
    g.stroke();
  }
  if (building.complete && field && ["sown", "growing", "ripe"].includes(stage)) {
    const profile = cultivatedCropVisual(field, building),
      plantsPerTile = stage === "sown" ? 1 : stage === "growing" ? 2 : 3,
      cropSize = Math.max(2.2, radius * 0.105);
    for (let tileRow = 0; tileRow < 3; tileRow++)
      for (let tileColumn = 0; tileColumn < 3; tileColumn++)
        for (let plant = 0; plant < plantsPerTile; plant++) {
          const variant = tileRow * 17 + tileColumn * 5 + plant + profile.seed,
            u =
              (tileColumn +
                (plantsPerTile === 1 ? 0.5 : 0.24 + plant * (0.52 / (plantsPerTile - 1)))) /
              3,
            v = (tileRow + 0.38 + (visualHash01(profile.seed, variant) - 0.5) * 0.24) / 3,
            [x, y] = cropQuadPoint(points, u, v);
          drawCultivatedCrop(g, x, y, cropSize, profile, stage, variant);
        }
  }
  if (!building.complete) {
    g.fillStyle = palette.accent;
    g.fillRect(
      screen.x - radius * 0.52,
      screen.y + radius * 0.48,
      radius * 1.04 * progress,
      Math.max(2, radius * 0.07),
    );
  }
  g.restore();
};

function normalizeHerdEnclosure(herd, enclosure) {
  if (!herd || !enclosure || enclosure.type !== "corral") return enclosure;
  const targetMaximum = 1500 + Math.min(24, herd.animalIds?.length || 0) * 35;
  if (!enclosure.sealedPerimeterVersion || enclosure.maxIntegrity < targetMaximum) {
    const priorMaximum = Math.max(1, enclosure.maxIntegrity || targetMaximum),
      condition = enclosure.complete
        ? clamp((enclosure.integrity || priorMaximum) / priorMaximum, 0, 1)
        : 0;
    enclosure.maxIntegrity = Math.max(priorMaximum, targetMaximum);
    if (enclosure.complete)
      enclosure.integrity = Math.max(1, Math.round(enclosure.maxIntegrity * condition));
    enclosure.defense = Math.max(enclosure.defense || 0, 18);
    enclosure.sealedPerimeterVersion = 2;
  }
  return enclosure;
}

const ensureHerdEnclosureSealedBase = ensureHerdEnclosure;
ensureHerdEnclosure = function (herd, place) {
  return normalizeHerdEnclosure(herd, ensureHerdEnclosureSealedBase(herd, place));
};

const enclosureBlocksPredatorSealedBase = enclosureBlocksPredator;
enclosureBlocksPredator = function (predatorId, animalId) {
  const herd = herdForAnimal(animalId),
    enclosure = normalizeHerdEnclosure(herd, herdEnclosure(herd));
  if (
    !herd ||
    !enclosure?.complete ||
    enclosure.ruined ||
    !animalInsideEnclosure(animalId, herd, enclosure) ||
    enclosure.integrity <= 0
  )
    return false;
  const life = W.components.life[predatorId],
    previous = life?.lastEnclosureAttackTick ?? -999;
  if (life && W.tick - previous >= 8) {
    life.lastEnclosureAttackTick = W.tick;
    const event = emitEvent("EnclosureAttackedEvent", {
        subjects: [predatorId, animalId, herd.herderId].filter(Boolean),
        location: idx(enclosure.x, enclosure.y),
        causes: [herd.causeEvent],
        evidence: [
          `${entityName(predatorId)} was stopped at the sealed perimeter regardless of its attempted movement coordinate`,
          `${enclosure.integrity}/${enclosure.maxIntegrity} structural integrity remained before the strike`,
        ],
        magnitude: 1,
        importance: 1,
        data: { herdId: herd.id, buildingId: enclosure.id, protectedId: animalId },
      }),
      hardness = materialTrait(enclosure.architecture?.rigid ?? C.MINERAL).hardness,
      force =
        (5 + phenotype(predatorId).size * 7 + phenotype(predatorId).aggression * 5) /
        (1 + hardness * 0.8),
      damage = damageBuildingDirect(
        enclosure,
        force,
        `${entityName(predatorId)} tore at one segment of the sealed livestock perimeter`,
        event.id,
      );
    enclosure.lastDamage = { tick: W.tick, damage, causeEvent: event.id, attackerId: predatorId };
    event.magnitude = damage;
    event.data.damage = damage;
    event.data.remainingIntegrity = enclosure.integrity;
    if (enclosure.ruined) markEnclosureBreach(herd, enclosure, predatorId, event.id);
    else herd.state = "predator stopped outside sealed enclosure";
  }
  return true;
};

function pushPredatorsOutsideEnclosures() {
  let moved = false;
  for (const herd of W.herds?.filter((candidate) => candidate.active) || []) {
    const enclosure = normalizeHerdEnclosure(herd, herdEnclosure(herd));
    if (!enclosure?.complete || enclosure.ruined || enclosure.integrity <= 0) continue;
    const radius = herdEnclosureRadius(herd),
      predators = entityAtRadius(idx(enclosure.x, enclosure.y), radius + 1, KINDS.PREDATOR)
        .filter(classifyAlive)
        .sort((left, right) => left - right);
    for (const predatorId of predators) {
      const position = W.components.position[predatorId],
        dx = position.x - enclosure.x,
        dy = position.y - enclosure.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) > radius) continue;
      const axisX = Math.abs(dx) >= Math.abs(dy),
        sign = (axisX ? dx : dy) < 0 ? -1 : 1,
        x = clamp(enclosure.x + (axisX ? sign * (radius + 1) : dx), 0, W.width - 1),
        y = clamp(enclosure.y + (axisX ? dy : sign * (radius + 1)), 0, W.height - 1);
      queueEffect("MoveEntity", { entityId: predatorId, x, y }, enclosure.id);
      W.components.life[predatorId].preyTargetId = 0;
      moved = true;
    }
  }
  if (moved) resolveEffects();
}

const updateLivingHerdsSealedBase = updateLivingHerds;
updateLivingHerds = function () {
  const result = updateLivingHerdsSealedBase();
  pushPredatorsOutsideEnclosures();
  return result;
};

function buildingOccupancyCandidate(id) {
  if (W.kind[id] !== KINDS.PERSON || !classifyAlive(id)) return null;
  const position = W.components.position[id],
    life = W.components.life[id],
    work = W.components.work?.[id];
  if (!position || !life) return null;
  const candidates = W.buildings
    .filter(
      (building) =>
        building.complete &&
        !building.ruined &&
        PROTECTIVE_BUILDING_TYPES.has(building.type) &&
        dist2(position.x, position.y, building.x, building.y) <= 16,
    )
    .map((building) => {
      const distance = dist2(position.x, position.y, building.x, building.y),
        onFootprint =
          Math.max(Math.abs(position.x - building.x), Math.abs(position.y - building.y)) <=
          buildingSpatialRadius(building.type),
        activeWork =
          work?.buildingId === building.id &&
          work.task !== "idle" &&
          W.tick - (work.handledTick ?? -999) <= 16,
        resting =
          ["rest", "socialize"].includes(life.behavior) &&
          ["shelter", "clinic", "hall"].includes(building.type) &&
          distance <= 9;
      if (!onFootprint && !activeWork && !resting) return null;
      return {
        building,
        score: distance - (onFootprint ? 8 : 0) - (activeWork ? 12 : 0) - (resting ? 4 : 0),
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.score - right.score || left.building.id - right.building.id);
  return candidates[0]?.building || null;
}

function protectedBuildingForPerson(id) {
  const building = buildingOccupancyCandidate(id);
  if (W.components.life[id]) W.components.life[id].insideBuildingId = building?.id || 0;
  return building;
}

function attackerOutsideBuilding(attackerId, building) {
  const position = W.components.position[attackerId];
  if (!position || !building) return true;
  return Math.max(Math.abs(position.x - building.x), Math.abs(position.y - building.y)) > 0;
}

function attackOccupiedBuilding(attackerId, victimId, building, context = {}) {
  const attackerLife = W.components.life[attackerId],
    cooldown = W.kind[attackerId] === KINDS.PREDATOR ? 8 : 6,
    previous = attackerLife?.lastOccupiedBuildingAttackTick ?? -999;
  if (!attackerLife || W.tick - previous < cooldown) return true;
  attackerLife.lastOccupiedBuildingAttackTick = W.tick;
  const predator = W.kind[attackerId] === KINDS.PREDATOR,
    force = predator
      ? 4 + phenotype(attackerId).size * 7 + phenotype(attackerId).aggression * 5
      : 7 + combatEquipmentQuality(attackerId) * 0.15 + (context.training || 0) * 0.8,
    event = emitEvent("BuildingDamagedEvent", {
      subjects: [attackerId, victimId].filter(Boolean),
      location: idx(building.x, building.y),
      factions: combatFactions(attackerId, victimId),
      causes: [context.causeEvent, context.war?.lastEventId, context.war?.startEventId].filter(
        Boolean,
      ),
      evidence: [
        `${entityName(victimId)} was inside ${building.name}, so the body could not be targeted`,
        `${entityName(attackerId)} struck one structural segment instead`,
        "the occupant becomes exposed only after the enclosing building physically collapses",
      ],
      magnitude: force,
      importance: context.military ? 2 : 1,
      data: {
        buildingId: building.id,
        protectedId: victimId,
        attackerId,
        military: !!context.military,
      },
    }),
    damage = damageBuildingDirect(
      building,
      force,
      `${entityName(attackerId)} attacked the occupied ${building.name} piece by piece`,
      event.id,
    );
  building.lastDamage = { tick: W.tick, damage, causeEvent: event.id, attackerId };
  event.magnitude = damage;
  event.data.damage = damage;
  event.data.remainingIntegrity = building.integrity;
  if (context.military)
    setWorkAction(
      attackerId,
      "raze",
      `breaching ${building.name} before attacking its occupants`,
      idx(building.x, building.y),
      -1,
      building.id,
    );
  return true;
}

const performHuntBuildingProtectionBase = performHunt;
performHunt = function (predatorId, prey) {
  const accessible = [];
  for (const targetId of prey) {
    const building =
      W.kind[targetId] === KINDS.PERSON ? protectedBuildingForPerson(targetId) : null;
    if (building) attackOccupiedBuilding(predatorId, targetId, building);
    else accessible.push(targetId);
  }
  return accessible.length ? performHuntBuildingProtectionBase(predatorId, accessible) : false;
};

const detailedCombatExchangeBuildingProtectionBase = detailedCombatExchange;
detailedCombatExchange = function (attackerId, victimId, context = {}) {
  const building = W.kind[victimId] === KINDS.PERSON ? protectedBuildingForPerson(victimId) : null;
  if (building && attackerOutsideBuilding(attackerId, building)) {
    if (context.military || W.kind[attackerId] === KINDS.PREDATOR)
      attackOccupiedBuilding(attackerId, victimId, building, context);
    return 0;
  }
  return detailedCombatExchangeBuildingProtectionBase(attackerId, victimId, context);
};

function campaignFactions(war) {
  return {
    a: W.factions.find((faction) => faction.id === war.a),
    b: W.factions.find((faction) => faction.id === war.b),
  };
}

function campaignTarget(war, attackerId) {
  const defenderId = attackerId === war.a ? war.b : war.a;
  return W.settlements
    .filter((settlement) => !settlement.ruined && settlement.factionId === defenderId)
    .sort(
      (left, right) =>
        settlementDefense(left) - settlementDefense(right) ||
        sum(Array.from(right.inventory || [])) - sum(Array.from(left.inventory || [])) ||
        left.id - right.id,
    )[0];
}

function campaignMotive(war, attacker, defender, target) {
  const relation = attacker?.relations?.[defender?.id] || {},
    stores = sum(Array.from(target?.inventory || [])),
    reasons = [];
  if ((relation.grievance || 0) > 4)
    reasons.push(`answer ${Math.round(relation.grievance)} grievance`);
  if ((relation.pressure || 0) > 80) reasons.push("break escalating territorial pressure");
  if (target && settlementFood(target) > 14) reasons.push("seize a food-secure objective");
  if (stores > 160) reasons.push("capture concentrated material stores");
  if (!reasons.length) reasons.push("force a favorable political settlement");
  return reasons.slice(0, 2).join(" and ");
}

function campaignApproach(war, attackerId, target, units) {
  const members = units.flatMap((unit) => unit.memberIds).filter(classifyAlive),
    ranged = members.filter((id) => attackerRangedTier(id) > 0).length,
    shields = members.filter((id) => equipmentProtection(id) > 8).length,
    walls = target ? completedBuildings(target, "wall").length : 0;
  if (walls)
    return ranged >= Math.ceil(members.length / 2)
      ? "screen with ranged volleys, concentrate tools on one wall segment, then occupy intact buildings"
      : "form under shields, breach the weakest wall segment, and assault the local strongpoint";
  if (ranged >= Math.ceil(members.length / 2))
    return "advance in a supplied formation, suppress defenders at range, then establish physical control";
  if (shields >= Math.ceil(members.length / 2))
    return "close behind layered shields, flank the defender formation, and preserve useful structures";
  return "muster a compact column, approach the least-defended route, and force close contact";
}

function campaignReadiness(war, plan) {
  const units = W.militaryUnits.filter((unit) => unit.active && unit.factionId === plan.attackerId),
    members = units.flatMap((unit) => unit.memberIds).filter(classifyAlive),
    target = W.settlements.find(
      (settlement) => settlement.id === plan.targetSettlementId && !settlement.ruined,
    ),
    averageSupply = units.length ? mean(units.map((unit) => unit.supply || 0)) : 0,
    averageTraining = units.length ? mean(units.map((unit) => unit.training || 0)) : 0,
    armed = members.filter((id) => !!toolForPurpose(id, "war")).length,
    protectedCount = members.filter((id) => equipmentProtection(id) >= 8).length,
    healthy = members.filter((id) => derivedLife(id).health >= 55).length,
    requirements = [
      {
        key: "fighters",
        label: "Fighters assembled",
        current: members.length,
        target: plan.minimumFighters,
        ready: members.length >= plan.minimumFighters,
      },
      {
        key: "supply",
        label: "Food, water, and energy supply",
        current: Math.round(averageSupply * 100),
        target: 58,
        unit: "%",
        ready: averageSupply >= 0.58,
      },
      {
        key: "training",
        label: "Formation training",
        current: +averageTraining.toFixed(2),
        target: 0.08,
        ready: averageTraining >= 0.08,
      },
      {
        key: "weapons",
        label: "Members with weapons",
        current: members.length ? Math.round((armed / members.length) * 100) : 0,
        target: 55,
        unit: "%",
        ready: !!members.length && armed / members.length >= 0.55,
      },
      {
        key: "protection",
        label: "Members with armor or shields",
        current: members.length ? Math.round((protectedCount / members.length) * 100) : 0,
        target: 35,
        unit: "%",
        ready: !!members.length && protectedCount / members.length >= 0.35,
      },
      {
        key: "health",
        label: "Healthy enough to march",
        current: members.length ? Math.round((healthy / members.length) * 100) : 0,
        target: 70,
        unit: "%",
        ready: !!members.length && healthy / members.length >= 0.7,
      },
      {
        key: "route",
        label: "Reachable enemy objective",
        current: target ? 1 : 0,
        target: 1,
        ready: !!target,
      },
    ],
    readyCount = requirements.filter((requirement) => requirement.ready).length;
  return {
    units,
    members,
    target,
    requirements,
    readyCount,
    readiness: readyCount / requirements.length,
    blockers: requirements.filter((requirement) => !requirement.ready),
  };
}

function ensureAttackPlan(war) {
  if (!war || war.ended) return war?.attackPlan || null;
  const { a, b } = campaignFactions(war);
  if (!war.attackerId)
    war.attackerId = (a?.militaryStrength || 0) >= (b?.militaryStrength || 0) ? war.a : war.b;
  const attacker = war.attackerId === war.a ? a : b,
    defender = attacker === a ? b : a,
    target = campaignTarget(war, attacker?.id),
    units = W.militaryUnits.filter((unit) => unit.active && unit.factionId === attacker?.id);
  if (!war.attackPlan) {
    const distance = target
        ? Math.min(
            ...W.settlements
              .filter((settlement) => !settlement.ruined && settlement.factionId === attacker?.id)
              .map((home) => Math.sqrt(dist2(home.x, home.y, target.x, target.y))),
          )
        : 0,
      preparation =
        80 + Math.round(distance * 3) + (hashParts(W.seedHash, "attack-plan", war.id) % 65);
    war.attackPlan = {
      createdTick: war.started,
      attackerId: attacker?.id || war.attackerId,
      defenderId: defender?.id || (war.attackerId === war.a ? war.b : war.a),
      targetSettlementId: target?.id || 0,
      plannedLaunchTick: war.started + preparation,
      latestLaunchTick: war.started + preparation + 384,
      minimumFighters: Math.max(
        2,
        Math.min(8, Math.ceil((settlementDefense(target || {}) || 8) / 12)),
      ),
      motive: campaignMotive(war, attacker, defender, target),
      approach: campaignApproach(war, attacker?.id, target, units),
      launchedTick: 0,
      launchEventId: 0,
    };
  } else if (!war.attackPlan.targetSettlementId || !target) {
    war.attackPlan.targetSettlementId = target?.id || 0;
  }
  return war.attackPlan;
}

function updateAttackPlan(war) {
  const plan = ensureAttackPlan(war);
  if (!plan || plan.launchedTick) return plan;
  const readiness = campaignReadiness(war, plan),
    earliestReached = W.tick >= plan.plannedLaunchTick,
    forcedWindow =
      W.tick >= plan.latestLaunchTick &&
      readiness.members.length >= 2 &&
      readiness.requirements.find((requirement) => requirement.key === "supply")?.current >= 42;
  plan.lastReadiness = readiness.readiness;
  plan.lastBlockers = readiness.blockers.map((requirement) => requirement.key);
  if (!earliestReached || (readiness.blockers.length && !forcedWindow)) return plan;
  plan.launchedTick = W.tick || 1;
  const attacker = W.factions.find((faction) => faction.id === plan.attackerId),
    defender = W.factions.find((faction) => faction.id === plan.defenderId),
    target = readiness.target,
    event = emitEvent("MilitaryPhaseEvent", {
      subjects: readiness.units
        .map(
          (unit) =>
            W.settlements.find((settlement) => settlement.id === unit.homeSettlementId)?.entityId,
        )
        .filter(Boolean),
      location: target ? idx(target.x, target.y) : -1,
      factions: [plan.attackerId, plan.defenderId],
      causes: [war.startEventId],
      evidence: [
        `${readiness.members.length} fighters launched at ${Math.round(readiness.readiness * 100)}% plan readiness`,
        `objective: ${target?.name || "remaining enemy territory"}`,
        `method: ${plan.approach}`,
        forcedWindow
          ? "the latest acceptable launch window forced a riskier departure"
          : "all required launch gates were satisfied",
      ],
      magnitude: readiness.members.length,
      importance: 3,
      data: {
        warId: war.id,
        phase: "campaign launched",
        attacker: attacker?.name,
        defender: defender?.name,
        target: target?.name,
        readiness: readiness.readiness,
      },
    });
  plan.launchEventId = event.id;
  war.lastEventId = event.id;
  return plan;
}

const resolveWarTurnPlannedBase = resolveWarTurn;
resolveWarTurn = function (war, a, b) {
  const plan = updateAttackPlan(war);
  if (plan && !plan.launchedTick) return;
  return resolveWarTurnPlannedBase(war, a, b);
};

const militaryObjectivePlannedBase = militaryObjective;
militaryObjective = function (unit) {
  const objective = militaryObjectivePlannedBase(unit);
  if (!objective.war) return objective;
  const plan = ensureAttackPlan(objective.war);
  if (plan && !plan.launchedTick) {
    unit.objectiveSettlementId = 0;
    return { war: null, target: objective.home, home: objective.home, planningWar: objective.war };
  }
  return objective;
};

function requirementRow(requirement) {
  const current = `${requirement.current}${requirement.unit || ""}`,
    target = `${requirement.target}${requirement.unit || ""}`,
    width = clamp(
      (Number(requirement.current) / Math.max(0.001, Number(requirement.target))) * 100,
      0,
      100,
    );
  return `<div class="campaign-requirement"><div class="row between"><span>${esc(requirement.label)}</span><b class="${requirement.ready ? "good-text" : "gold"}">${requirement.ready ? "Ready" : `${current} / ${target}`}</b></div><div class="bar"><i style="width:${width}%;background:${requirement.ready ? "#79c989" : "#d9b56d"}"></i></div></div>`;
}

function campaignCard(war) {
  const plan = ensureAttackPlan(war),
    readiness = campaignReadiness(war, plan),
    attacker = W.factions.find((faction) => faction.id === plan.attackerId),
    defender = W.factions.find((faction) => faction.id === plan.defenderId),
    target = readiness.target,
    launched = !!plan.launchedTick,
    until = Math.max(0, plan.plannedLaunchTick - W.tick),
    timing = launched
      ? `Launched at tick ${plan.launchedTick.toLocaleString()}`
      : W.tick < plan.plannedLaunchTick
        ? `Earliest launch in ${until.toLocaleString()} ticks`
        : readiness.blockers.length
          ? `Launch delayed by ${readiness.blockers.length} unmet gate${readiness.blockers.length === 1 ? "" : "s"}`
          : "Launch order is being issued";
  return `<article class="card campaign-card"><div class="row between"><div><div class="eyebrow">War #${war.id} · ${launched ? "active campaign" : "attack preparation"}</div><h3 style="margin:4px 0">${esc(attacker?.name || "Unknown attacker")} → ${esc(target?.name || defender?.name || "enemy territory")}</h3></div><span class="tag ${launched ? "red" : "gold"}">${Math.round(readiness.readiness * 100)}% ready</span></div><div class="campaign-timing">${esc(timing)}</div><div class="kv" style="margin-top:9px"><span>Defender</span><b>${esc(defender?.name || "unknown")}</b><span>Target</span><b>${esc(target?.name || "selecting a surviving objective")}</b><span>Why this war</span><b>${esc(plan.motive)}</b><span>How they plan to attack</span><b>${esc(plan.approach)}</b><span>Planned launch tick</span><b>${plan.plannedLaunchTick.toLocaleString()}</b><span>Latest acceptable window</span><b>${plan.latestLaunchTick.toLocaleString()}</b><span>Fielded units / fighters</span><b>${readiness.units.length} / ${readiness.members.length}</b><span>Casualties so far</span><b>${war.casualties || 0}</b></div><div class="subhead">Launch gates</div><div class="stack">${readiness.requirements.map(requirementRow).join("")}</div>${readiness.blockers.length ? `<div class="campaign-blockers"><b>Still needed:</b> ${esc(readiness.blockers.map((requirement) => requirement.label).join(" · "))}</div>` : `<div class="campaign-blockers ready"><b>All launch gates satisfied.</b> The force will depart when its planned window opens.</div>`}</article>`;
}

function refreshWarfare() {
  if (!W || !DOM.warfarePane) return;
  const active = W.activeWars.filter((war) => !war.ended),
    ended = W.activeWars
      .filter((war) => war.ended)
      .slice(-6)
      .reverse(),
    tensions = W.factions
      .flatMap((faction) =>
        Object.entries(faction.relations || {})
          .filter(
            ([otherId, relation]) => faction.id < Number(otherId) && relation.status === "hostile",
          )
          .map(([otherId, relation]) => ({
            faction,
            other: W.factions.find((candidate) => candidate.id === Number(otherId)),
            pressure: relation.pressure || 0,
          })),
      )
      .sort((left, right) => right.pressure - left.pressure)
      .slice(0, 5);
  DOM.warfarePane.innerHTML = `<div class="eyebrow">Operational intelligence</div><h3 style="margin:5px 0">Army attack plans</h3><p class="muted">Launch dates are real simulation gates. Armies wait for people, supplies, training, equipment, health, and a reachable objective; after launch, their tactics respond to contact and structures.</p>${active.length ? active.map(campaignCard).join("") : `<div class="empty">No army is preparing an attack. Hostile pressure and defensive musters still appear below.</div>`}${tensions.length ? `<div class="subhead">Hostile pressure before war</div>${tensions.map((entry) => `<div class="faction-row"><div class="row between"><b>${esc(entry.faction.name)} ↔ ${esc(entry.other?.name || "unknown")}</b><span class="tag gold">${Math.round(entry.pressure)} pressure</span></div><small class="muted">War begins only if pressure exceeds the political threshold and both sides can field material military strength.</small></div>`).join("")}` : ""}${ended.length ? `<details><summary>Recently ended wars · ${ended.length}</summary>${ended.map((war) => `<div class="faction-row"><b>War #${war.id}</b><small class="muted">Ended tick ${war.ended.toLocaleString()} · ${war.casualties || 0} casualties · ${war.turns || 0} contact turns</small></div>`).join("")}</details>` : ""}`;
}

EQUIPMENT_PURPOSES.add("helmet");
EQUIPMENT_PURPOSES.add("limb_armor");
EQUIPMENT_PURPOSES.add("utility");

const primitiveWarFormDeepBase = primitiveWarForm;
primitiveWarForm = function (id, recipe) {
  const material = materialTrait(recipe.head),
    tier = warToolTier(id),
    variants =
      tier >= 3
        ? [
            { form: "spark-tube dart caster", capabilities: ["war", "ranged", "powder", "pierce"] },
            { form: "thunder-seed projector", capabilities: ["war", "ranged", "powder", "crush"] },
            {
              form: "rotary ember launcher",
              capabilities: ["war", "ranged", "powder", "suppress"],
            },
          ]
        : tier >= 2
          ? [
              { form: "sinew recurved caster", capabilities: ["war", "ranged", "pierce"] },
              { form: "torsion shard sling", capabilities: ["war", "ranged", "crush"] },
              {
                form: "levered bolt thrower",
                capabilities: ["war", "ranged", "pierce", "shield_break"],
              },
            ]
          : recipe.head === C.BONE
            ? [
                {
                  form: "barbed bone reach-spear",
                  capabilities: ["war", "cut", "pierce", "reach"],
                },
                { form: "jaw-tooth sickle club", capabilities: ["war", "cut", "hook"] },
                { form: "antler fork staff", capabilities: ["war", "reach", "disarm"] },
              ]
            : material.density > 0.72
              ? [
                  { form: "gravity-knot maul", capabilities: ["war", "crush", "shield_break"] },
                  { form: "counterweighted stone axe", capabilities: ["war", "cut", "crush"] },
                  { form: "socketed impact beak", capabilities: ["war", "pierce", "crush"] },
                ]
              : [
                  { form: "flaked crescent edge", capabilities: ["war", "cut", "pierce"] },
                  { form: "hooked thrusting staff", capabilities: ["war", "cut", "reach"] },
                  { form: "weighted cord sling", capabilities: ["war", "ranged", "crush"] },
                  { form: "obsidian-tooth paddle", capabilities: ["war", "cut", "shield_break"] },
                ],
    choice =
      hashParts(W.seedHash, "primitive-war-form", id, recipe.head, recipe.binding) %
      variants.length;
  return variants[choice] || primitiveWarFormDeepBase(id, recipe);
};

const equipmentBlueprintDeepBase = equipmentBlueprint;
equipmentBlueprint = function (id, recipe) {
  const head = materialTrait(recipe.head),
    headName = W.definitions.species[recipe.head].name,
    bindingName = W.definitions.species[recipe.binding].name,
    serial = hashParts(W.seedHash, "equipment-blueprint", id, recipe.purpose, recipe.head),
    choose = (items) => items[serial % items.length];
  if (recipe.purpose === "armor")
    return choose(
      head.density > 0.66
        ? [
            {
              form: "overlapping lamellar mantle",
              name: `${headName} scale mantle`,
              capabilities: ["armor", "torso_guard"],
            },
            {
              form: "corded plate carapace",
              name: `${headName} corded carapace`,
              capabilities: ["armor", "torso_guard", "shoulder_guard"],
            },
            {
              form: "articulated shell coat",
              name: `${headName} shell coat`,
              capabilities: ["armor", "torso_guard", "cut_resist"],
            },
          ]
        : [
            {
              form: "woven impact mantle",
              name: `${bindingName} impact mantle`,
              capabilities: ["armor", "torso_guard"],
            },
            {
              form: "quilted fiber jack",
              name: `${bindingName} layered jack`,
              capabilities: ["armor", "blunt_resist"],
            },
            {
              form: "resin-bound scale vest",
              name: `${headName} resin scale vest`,
              capabilities: ["armor", "cut_resist"],
            },
          ],
    );
  if (recipe.purpose === "shield")
    return choose([
      {
        form: "layered deflection disk",
        name: `${headName} round shield`,
        capabilities: ["shield", "armor", "war", "deflect"],
      },
      {
        form: "tall woven body screen",
        name: `${bindingName} tower screen`,
        capabilities: ["shield", "armor", "war", "formation"],
      },
      {
        form: "hide-faced rib shield",
        name: `${headName} rib shield`,
        capabilities: ["shield", "armor", "war", "brace"],
      },
      {
        form: "sacrificial shard buckler",
        name: `${headName} shard buckler`,
        capabilities: ["shield", "war", "parry"],
      },
    ]);
  if (recipe.purpose === "helmet")
    return choose([
      {
        form: "ridged skull cap",
        name: `${headName} ridge helm`,
        capabilities: ["helmet", "armor", "head_guard"],
      },
      {
        form: "cheek-plated war mask",
        name: `${headName} war mask`,
        capabilities: ["helmet", "armor", "face_guard"],
      },
      {
        form: "woven shock hood",
        name: `${bindingName} shock hood`,
        capabilities: ["helmet", "armor", "blunt_resist"],
      },
    ]);
  if (recipe.purpose === "limb_armor")
    return choose([
      {
        form: "splinted arm and shin guards",
        name: `${headName} limb splints`,
        capabilities: ["limb_armor", "armor", "limb_guard"],
      },
      {
        form: "corded joint scales",
        name: `${headName} joint scales`,
        capabilities: ["limb_armor", "armor", "joint_guard"],
      },
      {
        form: "woven bracers and gaiters",
        name: `${bindingName} limb wraps`,
        capabilities: ["limb_armor", "armor", "cut_resist"],
      },
    ]);
  if (recipe.purpose === "carry_liquid")
    return choose([
      {
        form: "sealed flex-vessel bucket",
        name: `${headName} seal-bucket`,
        capabilities: ["carry_liquid", "firefighting", "gather"],
      },
      {
        form: "shouldered skin amphora",
        name: `${bindingName} carry-vessel`,
        capabilities: ["carry_liquid", "transport", "gather"],
      },
      {
        form: "fired shell dipper",
        name: `${headName} shell dipper`,
        capabilities: ["carry_liquid", "firefighting", "measure"],
      },
    ]);
  if (recipe.purpose === "utility")
    return choose([
      {
        form: "bow-drill fire kit",
        name: `${headName} bow-drill`,
        capabilities: ["utility", "firemaking", "craft"],
      },
      {
        form: "bone awl and fiber gauge",
        name: `${headName} stitch kit`,
        capabilities: ["utility", "sew", "repair"],
      },
      {
        form: "weighted plumb cord",
        name: `${headName} builder's plumb`,
        capabilities: ["utility", "measure", "build"],
      },
      {
        form: "resin scraper and burnisher",
        name: `${headName} finishing kit`,
        capabilities: ["utility", "craft", "repair"],
      },
    ]);
  return equipmentBlueprintDeepBase(id, recipe);
};

function ordinaryToolBlueprint(id, recipe) {
  const material = materialTrait(recipe.head),
    headName = W.definitions.species[recipe.head].name,
    bindingName = W.definitions.species[recipe.binding].name,
    choose = (items) =>
      items[hashParts(W.seedHash, "ordinary-tool", id, recipe.purpose, recipe.head) % items.length];
  if (recipe.purpose === "cut")
    return choose([
      {
        form: "serrated harvest sickle",
        name: `${headName} tooth sickle`,
        capabilities: ["cut", "harvest"],
      },
      {
        form: "drawknife and bark peeler",
        name: `${headName} drawknife`,
        capabilities: ["cut", "shape"],
      },
      { form: "backed flake saw", name: `${headName} flake saw`, capabilities: ["cut", "saw"] },
      { form: "adze-hook cutter", name: `${headName} hooked adze`, capabilities: ["cut", "build"] },
    ]);
  if (recipe.purpose === "mine")
    return choose([
      {
        form: "socketed stone pick",
        name: `${headName} socket pick`,
        capabilities: ["mine", "pierce", "build"],
      },
      {
        form: "wedge and striker set",
        name: `${headName} splitting set`,
        capabilities: ["mine", "split"],
      },
      {
        form: "antler pressure pick",
        name: `${headName} pressure pick`,
        capabilities: ["mine", "gather"],
      },
      {
        form: "two-faced quarry hammer",
        name: `${headName} quarry hammer`,
        capabilities: ["mine", "crush", "build"],
      },
    ]);
  if (recipe.purpose === "build")
    return choose([
      {
        form: "corded assembly maul",
        name: `${headName} assembly maul`,
        capabilities: ["build", "crush"],
      },
      {
        form: "notching chisel",
        name: `${headName} notch chisel`,
        capabilities: ["build", "cut", "shape"],
      },
      {
        form: "lever and tamping bar",
        name: `${headName} setting bar`,
        capabilities: ["build", "lever"],
      },
    ]);
  if (recipe.purpose === "gather")
    return choose([
      {
        form: "woven collection rake",
        name: `${bindingName} gathering rake`,
        capabilities: ["gather", "harvest"],
      },
      {
        form: "shell scoop and sieve",
        name: `${headName} sorting scoop`,
        capabilities: ["gather", "sort"],
      },
    ]);
  return null;
}

function artifactFunctionalProfile(artifact, recipe) {
  const material = materialTrait(recipe.head),
    capabilities = artifact.tool.capabilities,
    slot = capabilities.includes("helmet")
      ? "head"
      : capabilities.includes("limb_armor")
        ? "limbs"
        : capabilities.includes("armor")
          ? "torso"
          : capabilities.includes("shield")
            ? "off-hand"
            : capabilities.includes("war")
              ? "main hand"
              : "tool hand",
    damageType = capabilities.includes("pierce")
      ? "piercing"
      : capabilities.includes("cut")
        ? "cutting"
        : capabilities.includes("crush")
          ? "blunt"
          : "utility";
  return {
    slot,
    damageType,
    reach: capabilities.includes("ranged") ? 6 : capabilities.includes("reach") ? 2.4 : 1,
    coverage: capabilities.includes("helmet")
      ? 0.18
      : capabilities.includes("limb_armor")
        ? 0.34
        : capabilities.includes("armor")
          ? 0.55
          : capabilities.includes("shield")
            ? 0.42
            : 0,
    absorption: +(material.hardness * (1 - material.brittleness * 0.45)).toFixed(3),
    handling: +clamp(1.25 - material.density * 0.55, 0.45, 1.15).toFixed(3),
    novelty: `${artifact.tool.form}; ${capabilities.join(", ")}`,
  };
}

const createPersonalToolDeepBase = createPersonalTool;
createPersonalTool = function (id, recipe) {
  const artifact = createPersonalToolDeepBase(id, recipe);
  if (!artifact) return artifact;
  const ordinary = ordinaryToolBlueprint(id, recipe);
  if (ordinary && !EQUIPMENT_PURPOSES.has(recipe.purpose) && recipe.purpose !== "war") {
    artifact.tool.form = ordinary.form;
    artifact.tool.capabilities = ordinary.capabilities;
    artifact.name = ordinary.name;
    W.components.identity[artifact.entityId].generatedName = artifact.name;
    W.components.identity[artifact.entityId].titles = [titleCase(ordinary.form)];
  }
  artifact.tool.profile = artifactFunctionalProfile(artifact, recipe);
  artifact.tool.generation = "primitive functional morphology";
  return artifact;
};

const equipmentProtectionDeepBase = equipmentProtection;
equipmentProtection = function (id) {
  const base = equipmentProtectionDeepBase(id);
  let coverage = 0;
  for (const entityId of W.components.inventory[id]?.artifactIds || []) {
    const artifact = W.artifacts.find((candidate) => candidate.entityId === entityId);
    if (!isFunctionalTool(artifact) || !artifact.tool.profile?.coverage) continue;
    const wear = 1 - artifact.tool.wear / Math.max(1, artifact.tool.durability);
    coverage +=
      artifact.quality *
      artifact.tool.profile.coverage *
      artifact.tool.profile.absorption *
      wear *
      0.22;
  }
  return base + coverage;
};

const ensurePrimitiveEquipmentDeepBase = ensurePrimitiveEquipment;
ensurePrimitiveEquipment = function () {
  ensurePrimitiveEquipmentDeepBase();
  if (W.tick % 64) return;
  for (const unit of W.militaryUnits || []) {
    if (!unit.active) continue;
    for (const id of unit.memberIds.filter(classifyAlive).slice(0, 6)) {
      const work = workState(id);
      if (work.task === "craft") continue;
      const missing = ["helmet", "limb_armor"].find((purpose) => !toolForPurpose(id, purpose));
      if (!missing) continue;
      const recipe = toolRecipeFromInventory(id, missing) || supplyEquipmentMaterials(id, missing);
      if (recipe) beginOrAdvanceCraft(id, missing);
    }
  }
  const artisan = W.activeIds
    .filter(
      (id) =>
        W.kind[id] === KINDS.PERSON &&
        classifyAlive(id) &&
        !toolForPurpose(id, "utility") &&
        ["builder", "artisan", "researcher"].includes(workSpecialization(id)),
    )
    .sort((left, right) => left - right)[0];
  if (artisan) {
    const recipe =
      toolRecipeFromInventory(artisan, "utility") || supplyEquipmentMaterials(artisan, "utility");
    if (recipe) beginOrAdvanceCraft(artisan, "utility");
  }
};

const organismInspectorDeepEquipmentBase = organismInspector;
organismInspector = function (id) {
  let html = organismInspectorDeepEquipmentBase(id);
  if (W.kind[id] !== KINDS.PERSON) return html;
  const gear = (W.components.inventory[id]?.artifactIds || [])
    .map((entityId) => W.artifacts.find((artifact) => artifact.entityId === entityId))
    .filter((artifact) => isFunctionalTool(artifact) && artifact.tool.profile);
  if (!gear.length) return html;
  html += `<details><summary>Primitive loadout engineering · ${gear.length}</summary>${gear
    .map((artifact) => {
      const profile = artifact.tool.profile,
        condition = Math.round(
          (1 - artifact.tool.wear / Math.max(1, artifact.tool.durability)) * 100,
        );
      return `<div class="card" style="margin:6px 0"><div class="row between"><b>${esc(artifact.name)}</b><span class="tag">${esc(profile.slot)} · ${condition}%</span></div><div class="kv" style="margin-top:6px"><span>Form</span><b>${esc(artifact.tool.form)}</b><span>Functions</span><b>${esc(artifact.tool.capabilities.join(" · "))}</b><span>Damage / work mode</span><b>${esc(profile.damageType)}</b><span>Reach</span><b>${profile.reach} tiles</b><span>Coverage / absorption</span><b>${Math.round(profile.coverage * 100)}% / ${Math.round(profile.absorption * 100)}%</b><span>Handling</span><b>${Math.round(profile.handling * 100)}%</b></div></div>`;
    })
    .join("")}</details>`;
  return html;
};

const nonLifeInspectorDeepEquipmentBase = nonLifeInspector;
nonLifeInspector = function (id) {
  const html = nonLifeInspectorDeepEquipmentBase(id),
    artifact = W.artifacts.find((candidate) => candidate.entityId === id),
    profile = artifact?.tool?.profile;
  if (!profile) return html;
  return (
    html +
    `<div class="subhead">Primitive engineering profile</div><div class="card"><div class="kv"><span>Equipment slot</span><b>${esc(profile.slot)}</b><span>Functional morphology</span><b>${esc(artifact.tool.form)}</b><span>Work / damage mode</span><b>${esc(profile.damageType)}</b><span>Reach</span><b>${profile.reach} tiles</b><span>Coverage</span><b>${Math.round(profile.coverage * 100)}%</b><span>Material absorption</span><b>${Math.round(profile.absorption * 100)}%</b><span>Handling</span><b>${Math.round(profile.handling * 100)}%</b></div></div>`
  );
};

window.ALIFE_PROTECTION_STRATEGY_DEBUG = Object.freeze({
  protectedBuilding: protectedBuildingForPerson,
  enclosureBlocks: enclosureBlocksPredator,
  attackPlan: (warId) => {
    const war = W.activeWars.find((candidate) => candidate.id === warId);
    if (!war) return null;
    const plan = ensureAttackPlan(war);
    return { ...plan, readiness: campaignReadiness(war, plan) };
  },
  warfareHtml: () => {
    refreshWarfare();
    return DOM.warfarePane?.innerHTML || "";
  },
  farmTiles: (buildingId) => {
    const building = W.buildings.find((candidate) => candidate.id === buildingId);
    return building?.type === "farm" ? farmTiles(building) : [];
  },
});
