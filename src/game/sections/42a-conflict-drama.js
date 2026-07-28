// ================================================================
// 42A. CAUSAL COMBAT, OCCUPATION, AND INTERNAL SOCIAL DRAMA
// ================================================================
// Conflict uses the same bodies, chemistry, buildings, factions, memories,
// and event graph as the rest of the simulation. A dramatic outcome is never
// substituted for a physical cause: wounds bleed conserved matter, structures
// lose measured integrity, and occupation changes allegiance without erasing
// intact construction.

const COMBAT_TACTICS = Object.freeze([
    { name: "feint and thrust", wound: "puncture", force: 1, accuracy: 0.16, bleed: 1.15 },
    { name: "hooking slash", wound: "laceration", force: 0.92, accuracy: 0.08, bleed: 1.45 },
    { name: "overhand crush", wound: "blunt trauma", force: 1.28, accuracy: -0.1, bleed: 0.45 },
    { name: "shield rush", wound: "impact fracture", force: 0.82, accuracy: 0.12, bleed: 0.25 },
    {
      name: "grapple and strike",
      wound: "tearing trauma",
      force: 1.08,
      accuracy: 0.02,
      bleed: 1.05,
    },
  ]),
  RANGED_TACTICS = Object.freeze([
    { name: "aimed shot", wound: "projectile puncture", force: 1.22, accuracy: 0.1, bleed: 1.35 },
    {
      name: "formation volley",
      wound: "projectile trauma",
      force: 1.05,
      accuracy: 0.18,
      bleed: 1.1,
    },
    {
      name: "suppressing burst",
      wound: "ballistic trauma",
      force: 1.48,
      accuracy: -0.04,
      bleed: 1.5,
    },
  ]),
  COMBAT_DEFENSES = Object.freeze([
    { name: "dodge", skill: 0.16 },
    { name: "parry", skill: 0.12 },
    { name: "shield block", skill: 0.2 },
    { name: "brace", skill: 0.08 },
    { name: "counter-grapple", skill: 0.1 },
  ]),
  COMBAT_BODY_PARTS = Object.freeze([
    { name: "head", vulnerability: 1.55, bleed: 1.05, weight: 8 },
    { name: "torso", vulnerability: 1.2, bleed: 1.1, weight: 30 },
    { name: "arm", vulnerability: 0.78, bleed: 0.85, weight: 22 },
    { name: "leg", vulnerability: 0.86, bleed: 0.95, weight: 25 },
    { name: "hand", vulnerability: 0.58, bleed: 0.7, weight: 8 },
    { name: "neck", vulnerability: 1.75, bleed: 1.8, weight: 7 },
  ]);

function initializeConflictDrama(world = W) {
  if (!world) return null;
  if (!world.implicitMetrics) initializeImplicitSociety(world);
  world.conflictSerial = world.conflictSerial || 1;
  world.internalConflicts = world.internalConflicts || [];
  world.occupationHistory = world.occupationHistory || [];
  world.conflictMetrics = world.conflictMetrics || {
    exchanges: 0,
    misses: 0,
    wounds: 0,
    criticals: 0,
    internalConflicts: 0,
    occupationClashes: 0,
    integrations: 0,
    structuresDamagedInWar: 0,
  };
  for (const faction of world.factions || []) factionXenophobia(faction, world);
  for (const settlement of world.settlements || []) {
    if (settlement.occupation) settlement.occupation.active ??= true;
  }
  return world;
}

const restoreWorldConflictBase = restoreWorldDefaults;
restoreWorldDefaults = function () {
  restoreWorldConflictBase();
  initializeConflictDrama(W);
};

function factionXenophobia(faction, world = W, commit = true) {
  if (!faction) return 0.18;
  if (Number.isFinite(faction.xenophobia)) return clamp(faction.xenophobia, 0, 1);
  const culture = world?.cultures?.find((c) => c.id === faction.cultureId),
    communal = culture?.values?.communal ?? 0.5,
    inherited = hashParts(world?.seedHash || 0, "xenophobia", faction.id) / 4294967295,
    value = clamp(
      0.06 +
        (faction.aggression || 0.3) * 0.34 +
        (1 - communal) * 0.28 +
        (1 - (faction.cohesion || 0.5)) * 0.12 +
        inherited * 0.2,
      0.04,
      0.94,
    );
  if (commit) faction.xenophobia = value;
  return value;
}

function personXenophobia(id, commit = true) {
  const social = W.components.social[id];
  if (!social) return 0;
  if (!Number.isFinite(social.xenophobia)) {
    const faction = W.factions.find((f) => f.id === social.factionId),
      inherited = counterRand("person-xenophobia", id, W.seedHash),
      value = clamp(
        factionXenophobia(faction, W, commit) * 0.62 +
          (social.aggression || 0.3) * 0.16 +
          (social.dominance || 0.5) * 0.08 +
          inherited * 0.14,
        0,
        1,
      );
    if (commit) social.xenophobia = value;
    return value;
  }
  return social.xenophobia;
}

function ensureConflictPerson(id) {
  const life = W.components.life[id],
    social = W.components.social[id],
    identity = W.components.identity[id];
  if (!life || !social) return null;
  life.wounds = Array.isArray(life.wounds) ? life.wounds : [];
  life.pain = Number.isFinite(life.pain) ? life.pain : 0;
  life.trauma = Number.isFinite(life.trauma) ? life.trauma : 0;
  social.resentment = Number.isFinite(social.resentment) ? social.resentment : 0;
  personXenophobia(id);
  if (identity) identity.scars = Array.isArray(identity.scars) ? identity.scars : [];
  return { life, social, identity };
}

function weightedBodyPart(serial, attacker, victim) {
  const total = sum(COMBAT_BODY_PARTS.map((part) => part.weight));
  let roll = counterRand("combat-body-part", serial, attacker, victim) * total;
  for (const part of COMBAT_BODY_PARTS) {
    roll -= part.weight;
    if (roll <= 0) return part;
  }
  return COMBAT_BODY_PARTS[1];
}

function combatUnitFor(id) {
  const unitId = W.components.social[id]?.unitId;
  return unitId ? W.militaryUnits.find((unit) => unit.id === unitId && unit.active) : null;
}

function spillBodyBlood(id, tile, requested) {
  const q = W.components.chemistry[id]?.q;
  if (!q || requested <= 0) return 0;
  const quantity = Math.max(1, Math.ceil(requested));
  executeProcess("bleeding_signal", invEntity(id), quantity);
  const spill = Math.min(q[C.BLOOD] || 0, quantity);
  if (!spill) return 0;
  q[C.BLOOD] -= spill;
  setTileMatterAmount(tile, C.BLOOD, tileMatterAmount(tile, C.BLOOD) + spill);
  return spill;
}

function combatFactions(attacker, victim) {
  return [
    ...new Set(
      [
        W.components.social[attacker]?.factionId || 0,
        W.components.social[victim]?.factionId || 0,
      ].filter(Boolean),
    ),
  ];
}

function detailedCombatExchange(attacker, victim, context = {}) {
  initializeConflictDrama();
  if (!classifyAlive(attacker) || !classifyAlive(victim) || attacker === victim) return 0;
  const a = ensureConflictPerson(attacker),
    v = ensureConflictPerson(victim),
    ap = W.components.position[attacker],
    vp = W.components.position[victim];
  if (!a || !v || !ap || !vp) return 0;
  const engagementRange = attackerRangedTier(attacker) ? 36 : 2;
  if (!context.force && dist2(ap.x, ap.y, vp.x, vp.y) > engagementRange) {
    if (W.kind[attacker] === KINDS.PERSON && typeof moveWorkerToward === "function")
      moveWorkerToward(attacker, idx(vp.x, vp.y), "fight", "closing with an opponent");
    return 0;
  }
  const cooldown = context.internal ? 10 : 5;
  if (!context.force && W.tick - (a.life.lastMilitaryAttackTick ?? -999) < cooldown) return 0;
  a.life.lastMilitaryAttackTick = W.tick;
  const serial = W.conflictSerial++,
    ranged = attackerRangedTier(attacker),
    tactics = ranged ? RANGED_TACTICS : COMBAT_TACTICS,
    tactic = tactics[hashParts(W.seedHash, "tactic", serial, attacker) % tactics.length],
    defense =
      COMBAT_DEFENSES[hashParts(W.seedHash, "defense", serial, victim) % COMBAT_DEFENSES.length],
    part = weightedBodyPart(serial, attacker, victim),
    specificPart = selectEmbodiedBodyPart(victim, part.name, serial, attacker),
    attackerUnit = combatUnitFor(attacker),
    victimUnit = combatUnitFor(victim),
    training = context.training ?? attackerUnit?.training ?? 0,
    defenderTraining = victimUnit?.training || 0,
    equipment = combatEquipmentQuality(attacker),
    defensiveEquipment = combatEquipmentQuality(victim),
    attackerLife = derivedLife(attacker),
    victimLife = derivedLife(victim),
    terrain = idx(vp.x, vp.y),
    terrainCover =
      (W.tiles.featureStrength?.[terrain] || 0) / 1800 +
      (completedBuildings(nearestSettlement(terrain, 3) || {}).length ? 0.08 : 0),
    formation = attackerUnit
      ? clamp(attackerUnit.morale * 0.24 + attackerUnit.supply * 0.18 + training * 0.012, 0, 0.62)
      : 0,
    fatigue =
      ((attackerLife.hunger || 0) + (attackerLife.thirst || 0) + (attackerLife.fatigue || 0)) /
        340 +
      a.life.pain / 180,
    defenderFatigue =
      ((victimLife.hunger || 0) + (victimLife.thirst || 0) + (victimLife.fatigue || 0)) / 340 +
      v.life.pain / 180,
    attackSkill =
      0.38 +
      phenotype(attacker).aggression * 0.36 +
      (a.social.aggression || 0.3) * 0.22 +
      equipment / 145 +
      formation +
      tactic.accuracy -
      fatigue * 0.38,
    defenseSkill =
      0.34 +
      phenotype(victim).speed * 0.1 +
      (v.social.cooperation || 0.5) * 0.08 +
      defensiveEquipment / 190 +
      defenderTraining * 0.014 +
      (victimUnit?.morale || 0) * 0.18 +
      defense.skill +
      terrainCover -
      defenderFatigue * 0.32,
    roll =
      context.rollOverride ??
      counterRand("combat-outcome", W.tick, serial, attacker, victim) * 0.74,
    margin = attackSkill + roll - defenseSkill - 0.37,
    hit = context.forceHit || margin > -0.08,
    critical =
      hit && (context.forceCritical || margin > 0.58 || (part.name === "neck" && margin > 0.34)),
    factions = combatFactions(attacker, victim),
    causeEvent = context.causeEvent || context.war?.lastEventId || context.war?.startEventId || 0,
    exchange = emitEvent("CombatExchangeEvent", {
      subjects: [attacker, victim],
      location: terrain,
      factions,
      causes: [causeEvent],
      evidence: [
        `${entityName(attacker)} used ${tactic.name} against ${defense.name}`,
        `training ${training.toFixed(1)}, equipment ${equipment.toFixed(0)}, formation ${formation.toFixed(2)}`,
        `terrain cover ${terrainCover.toFixed(2)} and defender equipment ${defensiveEquipment.toFixed(0)}`,
      ],
      magnitude: hit ? 1 : 0,
      importance: context.internal || critical ? 2 : 1,
      data: {
        military: !!context.military,
        internal: !!context.internal,
        occupation: !!context.occupation,
        xenophobic: factions.length > 1 && personXenophobia(attacker) > 0.65,
        warId: context.war?.id || 0,
        tactic: tactic.name,
        defense: defense.name,
        bodyPart: specificPart,
        outcome: hit ? (critical ? "critical" : "hit") : "evaded",
      },
    });
  W.conflictMetrics.exchanges++;
  if (!hit) {
    W.conflictMetrics.misses++;
    if (context.military)
      setWorkAction(attacker, "fight", `${tactic.name} was stopped by ${defense.name}`, terrain);
    return 0;
  }

  const armor =
      (W.components.body[victim]?.armor || 0) * 17 +
      defensiveEquipment * 0.11 +
      equipmentProtection(victim),
    intensity = context.intensity ?? 1,
    raw = (12 + equipment * 0.28 + training * 1.15 + Math.max(0, margin) * 28) * tactic.force,
    damage = Math.max(2, Math.floor((raw - armor * 0.42) * part.vulnerability * intensity)),
    before = v.life.integrity;
  v.life.integrity = Math.max(0, v.life.integrity - damage);
  W.components.body[victim].integrity = v.life.integrity;
  const actual = before - v.life.integrity,
    requestedBlood = Math.max(
      1,
      Math.ceil(actual * tactic.bleed * part.bleed * (critical ? 0.36 : 0.2)),
    ),
    spilled = spillBodyBlood(victim, terrain, requestedBlood),
    wound = {
      id: serial,
      tick: W.tick,
      part: specificPart,
      type: tactic.wound,
      severity: clamp(actual / 42 + (critical ? 0.34 : 0), 0.08, 1),
      bleed: clamp(Math.ceil((spilled + requestedBlood) / 3), 1, 18),
      bloodLost: spilled,
      attackerId: attacker,
      causeEvent: exchange.id,
      treated: false,
      healedTick: 0,
      scar: false,
    };
  v.life.wounds.push(wound);
  if (v.life.wounds.length > 10) v.life.wounds.splice(0, v.life.wounds.length - 10);
  v.life.wounded = true;
  v.life.pain = clamp(v.life.pain + actual * 0.62 + (critical ? 14 : 0), 0, 100);
  v.life.trauma = clamp(v.life.trauma + actual * 0.22 + (critical ? 9 : 0), 0, 100);
  if (v.identity) v.identity.injuries = (v.identity.injuries || 0) + 1;
  if (critical) W.conflictMetrics.criticals++;
  W.conflictMetrics.wounds++;
  const injury = emitEvent("InjuryEvent", {
    subjects: [victim, attacker],
    location: terrain,
    factions,
    causes: [exchange.id, causeEvent],
    evidence: [
      `${tactic.name} overcame ${defense.name} and struck the ${specificPart}`,
      `${tactic.wound} removed ${actual} structural integrity and spilled ${spilled} conserved blood mass`,
      critical ? "the exchange produced a critical wound" : "the wound remained survivable",
    ],
    magnitude: actual,
    importance: critical ? 3 : 2,
    data: {
      ...exchange.data,
      military: !!context.military,
      woundId: wound.id,
      wound: tactic.wound,
      bodyPart: specificPart,
      bloodLost: spilled,
      critical,
    },
  });
  wound.causeEvent = injury.id;
  const anatomyTrauma = applyEmbodiedInjury(
    victim,
    specificPart,
    tactic.wound,
    actual,
    wound.severity,
    critical,
    attacker,
    injury.id,
    { forceDismember: !!context.forceDismember },
  );
  injury.data.disabledPart = anatomyTrauma.disabled;
  injury.data.limbLostEventId = anatomyTrauma.eventId;
  injury.data.severed = anatomyTrauma.severed;
  recordFluidSplatter(victim, terrain, injury.id, spilled, {
    critical,
    severed: anatomyTrauma.severed,
    source: context.predatorDefense ? "predator defense" : context.military ? "battle" : "combat",
  });
  exchange.magnitude = actual;
  exchange.data.damage = actual;
  exchange.data.injuryEventId = injury.id;
  const lethal = v.life.integrity <= 0;
  queuePredationVisual(attacker, victim, terrain, actual, lethal, injury.id, ranged);
  const visual = UI.combatVisuals?.at(-1);
  if (visual?.eventId === injury.id) {
    visual.style = tactic.name.toUpperCase();
    visual.bodyPart = specificPart;
    visual.bloodAmount = spilled + wound.bleed;
    visual.critical = critical;
    visual.internal = !!context.internal;
    visual.severedPart = anatomyTrauma.severed ? specificPart : "";
  }
  if (a.identity) a.identity.battles = (a.identity.battles || 0) + 1;
  if (v.identity) v.identity.battles = (v.identity.battles || 0) + 1;
  if (context.military)
    setWorkAction(attacker, "fight", `${tactic.name} against ${entityName(victim)}`, terrain);
  if (!lethal) return 1;

  killEntity(victim, `${tactic.wound} to the ${specificPart} caused structural failure`, injury.id);
  if (a.identity) a.identity.kills = (a.identity.kills || 0) + 1;
  W.statistics.kills++;
  emitEvent("KillEvent", {
    subjects: [attacker, victim],
    location: terrain,
    factions,
    causes: [injury.id, exchange.id, causeEvent],
    evidence: [
      `${tactic.wound} to the ${specificPart} reduced body integrity to zero`,
      `${spilled} blood mass had already entered the local substrate`,
      context.internal
        ? "the lethal exchange arose inside the community"
        : "the death occurred in organized combat",
    ],
    magnitude: actual,
    importance: context.internal ? 4 : 3,
    data: { ...injury.data, attackerId: attacker, lethal: true },
  });
  return 2;
}

militaryStrike = function (attacker, victim, war, training = 0) {
  return detailedCombatExchange(attacker, victim, {
    war,
    training,
    military: true,
    intensity: 1,
  });
};

const militaryUnitStrengthConflictBase = militaryUnitStrength;
militaryUnitStrength = function (unit) {
  const base = militaryUnitStrengthConflictBase(unit),
    members = unit.memberIds.filter(classifyAlive),
    impairment = members.length
      ? mean(
          members.map((id) => {
            const state = ensureConflictPerson(id);
            return state ? state.life.pain / 180 + state.life.trauma / 320 : 0;
          }),
        )
      : 1,
    formation = clamp((unit.morale || 0.5) * 0.3 + (unit.supply || 0.5) * 0.25, 0.2, 0.6);
  return base * clamp(1 + formation - impairment, 0.25, 1.45);
};

razeStrike = function (id, place, building, war) {
  const position = W.components.position[id];
  if (!position || !building || building.ruined || !building.complete) return 0;
  if (dist2(position.x, position.y, building.x, building.y) > 6.25) {
    moveWorkerToward(
      id,
      idx(building.x, building.y),
      "march",
      `advancing to breach the ${building.name}`,
      -1,
      0,
      0,
    );
    return 0;
  }
  const intended = Math.max(5, Math.floor(6 + combatEquipmentQuality(id) * 0.12)),
    location = idx(building.x, building.y),
    ev = emitEvent("BuildingDamagedEvent", {
      subjects: [place.entityId, id],
      location,
      factions: [W.components.social[id]?.factionId, place.factionId].filter(Boolean),
      causes: [war.lastEventId || war.startEventId],
      evidence: [
        `${entityName(id)} physically struck ${building.name}`,
        `equipment delivered ${intended} measured structural force`,
        "collapse can occur only if the building's remaining integrity is exhausted",
      ],
      magnitude: intended,
      importance: building.type === "wall" ? 2 : 3,
      data: { buildingId: building.id, name: building.name, warId: war.id, siege: true },
    }),
    damage = damageBuildingDirect(
      building,
      intended,
      `${building.name} failed under a recorded siege breach`,
      ev.id,
    );
  ev.magnitude = damage;
  building.lastDamage = {
    tick: W.tick,
    amount: damage,
    causeEvent: ev.id,
    attackerId: id,
    warId: war.id,
  };
  war.lastEventId = ev.id;
  W.conflictMetrics.structuresDamagedInWar++;
  setWorkAction(
    id,
    "raze",
    `breaching the ${building.name}; ${building.integrity} integrity remains`,
    location,
    -1,
    building.id,
  );
  return damage;
};

function settlementBuildingsByCondition(target) {
  const all = W.buildings.filter(
      (building) => building.placeKind === "settlement" && building.placeId === target.id,
    ),
    standing = all.filter((building) => building.complete && !building.ruined);
  return {
    all,
    standing,
    preserved: standing.filter((building) => building.integrity >= building.maxIntegrity).length,
    damaged: standing.filter((building) => building.integrity < building.maxIntegrity).length,
    destroyed: all.filter((building) => building.ruined).length,
  };
}

function occupationResidents(target) {
  return entityAtRadius(idx(target.x, target.y), 8, KINDS.PERSON)
    .filter(classifyAlive)
    .filter((id) => {
      const social = W.components.social[id];
      return (
        !social?.homePlaceKind ||
        social.homePlaceKind !== "settlement" ||
        social.homePlaceId === target.id
      );
    });
}

function captureSettlementCausally(target, attacker, defender, war, attackers) {
  initializeConflictDrama();
  const former = target.factionId,
    tile = idx(target.x, target.y),
    condition = settlementBuildingsByCondition(target),
    occupierXenophobia = factionXenophobia(attacker),
    residents = occupationResidents(target),
    adopted = [],
    resisting = [];
  target.factionId = attacker.id;
  target.stability = clamp(Math.max(0.18, target.stability * 0.72), 0, 1);
  target.management = target.management || defaultCityManagement();
  target.management.priorities.defense = Math.max(4, target.management.priorities.defense || 0);
  target.management.priorities.shelter = Math.max(4, target.management.priorities.shelter || 0);
  target.management.priorities.materials = Math.max(3, target.management.priorities.materials || 0);
  for (const id of residents) {
    const state = ensureConflictPerson(id);
    if (!state || state.social.factionId !== former) continue;
    state.social.formerFactionId = former;
    state.social.occupiedBy = attacker.id;
    state.social.occupiedSettlementId = target.id;
    state.social.occupationTick = W.tick;
    state.social.resentment = clamp(
      state.social.resentment + 0.18 + occupierXenophobia * 0.34,
      0,
      1,
    );
    const willingness =
      0.07 +
      (1 - occupierXenophobia) * 0.18 +
      (state.social.cooperation || 0.5) * 0.08 -
      state.social.resentment * 0.12;
    if (counterRand("capture-allegiance", war.id, target.id, id) < willingness) {
      state.social.factionId = attacker.id;
      state.social.integrated = true;
      adopted.push(id);
    } else {
      state.social.integrated = false;
      resisting.push(id);
    }
  }
  attacker.settlementIds = attacker.settlementIds || [];
  defender.settlementIds = defender.settlementIds || [];
  if (!attacker.settlementIds.includes(target.id)) attacker.settlementIds.push(target.id);
  defender.settlementIds = defender.settlementIds.filter((id) => id !== target.id);
  if (defender.capitalSettlementId === target.id)
    defender.capitalSettlementId =
      W.settlements.find((settlement) => !settlement.ruined && settlement.factionId === defender.id)
        ?.id || 0;
  paintOwnership({ tile, radius: 6, factionId: attacker.id, pressure: 980 });
  const doctrine = applyConquestDoctrine(target, attacker, tile, attackers),
    resistance = residents.length ? resisting.length / residents.length : 0,
    occupation = {
      active: true,
      formerFactionId: former,
      occupierFactionId: attacker.id,
      capturedTick: W.tick,
      resistance,
      rebuildPriority: condition.damaged + condition.destroyed,
      warId: war.id,
      causeEvent: war.lastEventId || war.startEventId,
      adopted: adopted.length,
      resisting: resisting.length,
    };
  target.occupation = occupation;
  W.occupationHistory.push({ settlementId: target.id, ...occupation });
  const ev = emitEvent("SettlementCapturedEvent", {
    subjects: [
      target.entityId,
      attacker.entityId,
      defender.entityId,
      ...attackers.slice(0, 2).map((x) => x.id),
    ],
    location: tile,
    factions: [attacker.id, defender.id],
    causes: [war.startEventId, war.lastEventId],
    evidence: [
      `${attackers.filter((entry) => classifyAlive(entry.id)).length} physically present attackers held the settlement`,
      `${condition.preserved} intact structures transferred with the settlement; ${condition.damaged} were damaged and ${condition.destroyed} had already collapsed from recorded causes`,
      `${adopted.length} residents accepted the new polity while ${resisting.length} retained their former allegiance`,
      doctrine.plundered
        ? `${doctrine.plundered} conserved material packets were physically carried away as plunder`
        : "no stored matter was removed by the occupation doctrine",
      doctrine.razed || doctrine.massacred
        ? `the victors' doctrine razed ${doctrine.razed || 0} structures and killed ${doctrine.massacred || 0} resisting residents`
        : "the victors incorporated the settlement without razing or reprisals",
      "ownership and faction color changed without deleting or inventing building matter",
    ],
    importance: 5,
    data: {
      name: target.name,
      preserved: condition.preserved,
      damaged: condition.damaged,
      destroyed: condition.destroyed,
      adopted: adopted.length,
      resisting: resisting.length,
      resistance,
      plundered: doctrine.plundered || 0,
    },
  });
  occupation.causeEvent = ev.id;
  target.importantEvents?.push(ev.id);
  W.implicitMetrics.captures++;
  return ev;
}

function warCampaignRouteExists(attacker, defender) {
  const origins = W.settlements.filter(
      (s) => !s.ruined && s.factionId === attacker.id,
    ),
    targets = W.settlements.filter((s) => !s.ruined && s.factionId === defender.id);
  if (!origins.length || !targets.length) return false;
  const origin =
      origins.find((s) => s.id === attacker.capitalSettlementId) || origins[0],
    sails = factionHasTech(attacker.id, "navigation"),
    passable = (tile) => sails || W.tiles.liquid[tile] <= WATER_DEPTH.WADE_LIMIT,
    goal = (tile) => {
      const [x, y] = xy(tile);
      return targets.some((s) => Math.max(Math.abs(s.x - x), Math.abs(s.y - y)) <= 3);
    },
    start = idx(origin.x, origin.y),
    visited = new Uint8Array(W.tileCount),
    queue = [start];
  visited[start] = 1;
  let explored = 0;
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const current = queue[cursor];
    if (goal(current)) return true;
    if (++explored > 12000) return false;
    for (const next of neighbors4(current)) {
      if (visited[next] || !passable(next)) continue;
      visited[next] = 1;
      queue.push(next);
    }
  }
  return false;
}
function resolveImplicitWarTurn(war, a, b) {
  initializeConflictDrama();
  war.turns++;
  war.captureProgress = war.captureProgress || {};
  const settlementsA = W.settlements.filter(
      (settlement) => settlement.factionId === a.id && !settlement.ruined,
    ),
    settlementsB = W.settlements.filter(
      (settlement) => settlement.factionId === b.id && !settlement.ruined,
    );
  if (!settlementsA.length || !settlementsB.length) return endWar(war, a, b, "political collapse");
  if (war.turns === 1 && !warCampaignRouteExists(a, b) && !warCampaignRouteExists(b, a))
    return endWar(war, a, b, "no campaign route existed between the belligerents");
  const combinedPopulation = a.population + b.population;
  if (war.turns > 4 && war.startPopulation && combinedPopulation < war.startPopulation * 0.72)
    return endWar(war, a, b, "attrition and desertion exhausted both polities");
  const powerA = W.militaryUnits
      .filter((unit) => unit.active && unit.factionId === a.id)
      .reduce((total, unit) => total + militaryUnitStrength(unit), 0),
    powerB = W.militaryUnits
      .filter((unit) => unit.active && unit.factionId === b.id)
      .reduce((total, unit) => total + militaryUnitStrength(unit), 0);
  if (!war.attackerId) war.attackerId = powerA >= powerB ? a.id : b.id;
  const attacker = war.attackerId === a.id ? a : b,
    defender = attacker === a ? b : a,
    targets = defender === a ? settlementsA : settlementsB,
    contactRecord = (war.contactRecords || [])
      .filter(
        (record) =>
          record.factionId === attacker.id &&
          W.settlements.some(
            (settlement) =>
              settlement.id === record.placeId &&
              !settlement.ruined &&
              settlement.factionId === defender.id,
          ),
      )
      .sort((left, right) => right.tick - left.tick || left.unitId - right.unitId)[0],
    contactedTarget = contactRecord
      ? W.settlements.find(
          (settlement) =>
            settlement.id === contactRecord.placeId &&
            !settlement.ruined &&
            settlement.factionId === defender.id,
        )
      : null,
    ownSettlements = attacker === a ? settlementsA : settlementsB,
    marchOrigin =
      ownSettlements.find((s) => s.id === attacker.capitalSettlementId) || ownSettlements[0],
    target =
      contactedTarget ||
      (marchOrigin
        ? targets.sort(
            (left, right) =>
              dist2(left.x, left.y, marchOrigin.x, marchOrigin.y) -
                dist2(right.x, right.y, marchOrigin.x, marchOrigin.y) || left.id - right.id,
          )[0]
        : targets.sort((left, right) => left.defense - right.defense || left.id - right.id)[0]),
    battleX = contactRecord?.x ?? target.x,
    battleY = contactRecord?.y ?? target.y,
    tile = idx(
      clamp(Math.round(battleX), 0, W.width - 1),
      clamp(Math.round(battleY), 0, W.height - 1),
    ),
    attackers = W.militaryUnits
      .filter((unit) => unit.active && unit.factionId === attacker.id)
      .flatMap((unit) => unit.memberIds.map((id) => ({ id, u: unit })))
      .filter((entry) => {
        const position = W.components.position[entry.id];
        return (
          position &&
          dist2(position.x, position.y, battleX, battleY) <= 36 &&
          classifyAlive(entry.id)
        );
      }),
    defenders = W.activeIds
      .filter((id) => {
        const position = W.components.position[id];
        return (
          W.kind[id] === KINDS.PERSON &&
          position &&
          dist2(position.x, position.y, battleX, battleY) <= 49 &&
          classifyAlive(id) &&
          W.components.social[id]?.factionId === defender.id
        );
      })
      .map((id) => ({ id, u: combatUnitFor(id) || { training: 0 } }));
  if (!attackers.length) {
    war.marches = (war.marches || 0) + 1;
    const marchers = W.militaryUnits
      .filter((unit) => unit.active && unit.factionId === attacker.id)
      .flatMap((unit) => unit.memberIds)
      .filter((id) => classifyAlive(id))
      .slice(0, 8);
    for (const id of marchers) {
      const p = W.components.position[id];
      if (!p) continue;
      for (let step = 0; step < 3; step++) {
        const dx = Math.sign(battleX - p.x),
          dy = Math.sign(battleY - p.y);
        if (!dx && !dy) break;
        const options = [
          [p.x + dx, p.y + dy],
          [p.x + dx, p.y],
          [p.x, p.y + dy],
        ].filter(
          ([x, y]) =>
            inside(x, y) &&
            (dx || dy) &&
            !(x === p.x && y === p.y) &&
            (W.tiles.liquid[idx(x, y)] <= WATER_DEPTH.WADE_LIMIT ||
              factionHasTech(attacker.id, "navigation")),
        );
        if (!options.length) break;
        const [nx, ny] = options[0];
        p.x = nx;
        p.y = ny;
        p.regionId = regionId(nx, ny);
      }
    }
    if (war.turns > 12)
      return endWar(war, a, b, "mobilization exhausted before either force could sustain contact");
    return;
  }
  W.implicitMetrics.battles++;
  war.contactTurns = (war.contactTurns || 0) + 1;
  if (war.contactTurns > 6 && !(war.casualties > 0 || (war.wounded || 0) > 0))
    return endWar(war, a, b, "a bloodless standoff proved neither side could reach the other");
  let casualties = 0;
  const previousEventId = W.events.at(-1)?.id || 0;
  const exchanges = Math.min(7, attackers.length, Math.max(1, defenders.length));
  for (let n = 0; n < exchanges; n++) {
    const attack = attackers[n % attackers.length],
      attackPosition = W.components.position[attack.id],
      defense =
        defenders
          .filter((entry) => {
            const position = W.components.position[entry.id];
            return position && attackPosition && classifyAlive(entry.id);
          })
          .sort((left, right) => {
            const lp = W.components.position[left.id],
              rp = W.components.position[right.id];
            return (
              dist2(lp.x, lp.y, attackPosition.x, attackPosition.y) -
                dist2(rp.x, rp.y, attackPosition.x, attackPosition.y) || left.id - right.id
            );
          })[0] || null;
    if (defense && classifyAlive(attack.id) && classifyAlive(defense.id)) {
      const strike = militaryStrike(attack.id, defense.id, war, attack.u.training);
      casualties += strike === 2 ? 1 : 0;
      war.wounded = (war.wounded || 0) + (strike === 1 ? 1 : 0);
      if (classifyAlive(defense.id) && classifyAlive(attack.id)) {
        const counter = militaryStrike(defense.id, attack.id, war, defense.u.training);
        casualties += counter === 2 ? 1 : 0;
        war.wounded = (war.wounded || 0) + (counter === 1 ? 1 : 0);
      }
    }
  }
  war.casualties += casualties;
  war.lastEventId =
    W.events.findLast(
      (event) =>
        event.id > previousEventId &&
        ["KillEvent", "InjuryEvent", "CombatExchangeEvent"].includes(event.type),
    )?.id ||
    war.lastEventId ||
    war.startEventId;
  const livingAttackers = attackers.filter((entry) => classifyAlive(entry.id)),
    livingDefenders = defenders.filter((entry) => classifyAlive(entry.id)),
    control = livingAttackers.length - livingDefenders.length,
    standingWalls = completedBuildings(target, "wall").filter((wall) => !wall.ruined);
  const aggregateFaction = control >= 0 ? defender.id : attacker.id,
    aggregate = removeCohortWarCasualties(
      aggregateFaction,
      casualties + (control > 0 ? 2 : war.contactTurns % 4 === 0 ? 1 : 0),
      tile,
      war.lastEventId || war.startEventId,
    );
  if (aggregate.count) {
    war.casualties += aggregate.count;
    war.lastEventId = aggregate.eventId;
  }
  if (control > 0 && livingDefenders.length && standingWalls.length) {
    let breached = 0;
    for (const entry of livingAttackers) {
      if (breached >= 4 || !standingWalls.some((wall) => !wall.ruined)) break;
      const wall = standingWalls
        .filter((candidate) => !candidate.ruined)
        .sort(
          (left, right) =>
            left.integrity / left.maxIntegrity - right.integrity / right.maxIntegrity ||
            left.id - right.id,
        )[0];
      if (wall && razeStrike(entry.id, target, wall, war)) breached++;
    }
  }
  const wallsStillBlocking =
      livingDefenders.length > 0 && completedBuildings(target, "wall").length > 0,
    gain =
      control > 0
        ? (control * 0.052 + (livingDefenders.length ? 0 : 0.1)) * (wallsStillBlocking ? 0.32 : 1)
        : -0.045;
  war.captureProgress[target.id] = clamp((war.captureProgress[target.id] || 0) + gain, 0, 1);
  if (control > 0) {
    target.stability = clamp(target.stability - control * 0.0035, 0, 1);
    W.tiles.danger[tile] = u16(W.tiles.danger[tile] + control * 12);
  }
  if (
    livingAttackers.length >= 2 &&
    control >= 2 &&
    war.captureProgress[target.id] >= 0.62 &&
    (!livingDefenders.length || control >= 3)
  ) {
    const ev = captureSettlementCausally(target, attacker, defender, war, livingAttackers);
    war.lastEventId = ev.id;
    return endWar(war, a, b, `${target.name} was physically occupied`);
  }
  const foodA = mean(settlementsA.map(settlementFood)),
    foodB = mean(settlementsB.map(settlementFood));
  if (
    (war.turns > 10 &&
      (war.casualties > Math.max(2, Math.min(a.population, b.population) * 0.18) ||
        Math.min(foodA, foodB) < 3)) ||
    war.turns > 48
  )
    endWar(war, a, b, "casualties, supply, morale, and control ended sustained operations");
}

resolveWarTurn = function (war, a, b) {
  return resolveImplicitWarTurn(war, a, b);
};

function conflictPlaceResidents(place, radius = 8) {
  return entityAtRadius(idx(place.x, place.y), radius, KINDS.PERSON).filter(classifyAlive);
}

function internalConflictTension(place, residents) {
  const factions = new Set(residents.map((id) => W.components.social[id]?.factionId || 0)),
    cultures = new Set(residents.map((id) => W.components.social[id]?.cultureId || 0)),
    foodStress = place.knownProcesses
      ? clamp((12 - settlementFood(place)) / 12, 0, 1)
      : clamp((8 - tileFood(idx(place.x, place.y), "omnivore")) / 8, 0, 1),
    instability = 1 - (place.stability ?? (place.active ? 0.62 : 0.3)),
    crowding = clamp(
      (residents.length - (place.housing || 4)) / Math.max(4, residents.length),
      0,
      1,
    ),
    difference = clamp((factions.size - 1) * 0.22 + (cultures.size - 1) * 0.12, 0, 0.7),
    danger = W.tiles.danger[idx(place.x, place.y)] / 1600,
    occupation = place.occupation?.active ? place.occupation.resistance * 0.55 : 0;
  return clamp(
    foodStress * 0.32 +
      instability * 0.22 +
      crowding * 0.14 +
      difference +
      danger * 0.12 +
      occupation,
    0,
    1,
  );
}

function internalPairScore(attacker, victim, occupation = null) {
  const a = ensureConflictPerson(attacker),
    v = ensureConflictPerson(victim);
  if (!a || !v || attacker === victim) return -Infinity;
  const difference =
      (a.social.factionId !== v.social.factionId ? 0.46 : 0) +
      (a.social.cultureId !== v.social.cultureId ? 0.24 : 0),
    occupationFriction =
      occupation &&
      a.social.formerFactionId === occupation.formerFactionId &&
      v.social.factionId === occupation.occupierFactionId
        ? 0.55
        : 0;
  return (
    (a.social.aggression || 0.3) * 0.36 +
    (a.social.dominance || 0.5) * 0.16 +
    a.social.resentment * 0.34 +
    personXenophobia(attacker) * difference +
    occupationFriction -
    (a.social.trust?.[victim] || 0) * 0.22
  );
}

function triggerInternalConflict(place, options = {}) {
  const residents = conflictPlaceResidents(place);
  if (residents.length < 2) return null;
  let best = null;
  for (const attacker of residents)
    for (const victim of residents) {
      const score = internalPairScore(attacker, victim, place.occupation);
      if (!best || score > best.score || (score === best.score && attacker < best.attacker))
        best = { attacker, victim, score };
    }
  if (!best || best.score < 0.28) return null;
  const a = ensureConflictPerson(best.attacker),
    v = ensureConflictPerson(best.victim),
    tension = options.tension ?? internalConflictTension(place, residents),
    occupation = !!place.occupation?.active,
    scarcity = place.knownProcesses && settlementFood(place) < 12,
    cause =
      place.occupation?.causeEvent ||
      place.importantEvents?.at(-1) ||
      W.lastEventByType.DeathEvent ||
      W.lastEventByType.FactionSchismEvent ||
      0,
    event = emitEvent(occupation ? "OccupationResistanceEvent" : "InternalConflictEvent", {
      subjects: [best.attacker, best.victim, place.entityId].filter(Boolean),
      location: idx(place.x, place.y),
      factions: combatFactions(best.attacker, best.victim),
      causes: [cause],
      evidence: [
        scarcity
          ? "local food scarcity raised material stress"
          : "local stores did not remove accumulated grievance",
        occupation
          ? "occupation divided retained and imposed allegiances"
          : "dominance, resentment, and trust produced a specific confrontation",
        `measured social tension was ${tension.toFixed(2)}; no violence was spawned without participants`,
      ],
      magnitude: tension,
      importance: occupation ? 3 : 2,
      data: {
        name: place.name,
        internal: true,
        occupation,
        tension,
        attackerXenophobia: personXenophobia(best.attacker),
      },
    });
  a.social.resentment = clamp(a.social.resentment + 0.12, 0, 1);
  v.social.resentment = clamp(v.social.resentment + 0.18, 0, 1);
  a.social.trust[best.victim] = clamp((a.social.trust[best.victim] || 0) - 0.22, -1, 1);
  v.social.trust[best.attacker] = clamp((v.social.trust[best.attacker] || 0) - 0.3, -1, 1);
  place.stability = clamp((place.stability ?? 0.6) - 0.035 - tension * 0.025, 0, 1);
  const result = detailedCombatExchange(best.attacker, best.victim, {
    internal: true,
    occupation,
    intensity: occupation ? 0.82 : 0.64,
    causeEvent: event.id,
  });
  W.internalConflicts.push({
    id: event.id,
    tick: W.tick,
    placeKind: place.knownProcesses ? "settlement" : "camp",
    placeId: place.id,
    attacker: best.attacker,
    victim: best.victim,
    tension,
    result,
    occupation,
  });
  W.internalConflicts = W.internalConflicts.slice(-160);
  W.conflictMetrics.internalConflicts++;
  if (occupation) W.conflictMetrics.occupationClashes++;
  return event;
}

function updateInternalConflict() {
  if (W.tick % 64) return;
  const places = [
    ...W.camps.filter((camp) => camp.active),
    ...W.settlements.filter((settlement) => !settlement.ruined),
  ];
  for (const place of places) {
    const residents = conflictPlaceResidents(place);
    if (residents.length < 4) continue;
    const tension = internalConflictTension(place, residents),
      chance = place.occupation?.active ? tension * 0.28 : tension * 0.13;
    if (counterRand("implicit-internal-conflict", Math.floor(W.tick / 64), place.id) < chance)
      triggerInternalConflict(place, { tension });
    else if (tension < 0.22 && W.tick % 256 === 0) {
      let reconciled = 0;
      for (const id of residents) {
        const social = ensureConflictPerson(id)?.social;
        if (!social?.resentment) continue;
        const before = social.resentment;
        social.resentment = clamp(social.resentment - 0.04, 0, 1);
        if (social.resentment < before) reconciled++;
      }
      if (reconciled && counterRand("reconciliation-record", W.tick, place.id) < 0.18)
        emitEvent("ReconciliationEvent", {
          subjects: [place.entityId].filter(Boolean),
          location: idx(place.x, place.y),
          factions: [place.factionId].filter(Boolean),
          causes: [place.importantEvents?.at(-1) || 0],
          evidence: [
            "stable shelter and adequate stores lowered material stress",
            `${reconciled} residents' accumulated resentment declined through coexistence`,
          ],
          magnitude: reconciled,
          importance: 1,
          data: { name: place.name },
        });
    }
  }
}

function updatePersistentWounds() {
  if (W.tick % 8) return;
  for (const id of W.activeIds.slice()) {
    if (W.kind[id] !== KINDS.PERSON || !classifyAlive(id)) continue;
    const state = ensureConflictPerson(id);
    if (!state) continue;
    state.life.pain = clamp(state.life.pain - 0.35, 0, 100);
    state.life.trauma = clamp(state.life.trauma - 0.025, 0, 100);
    if (!state.life.wounds.length) continue;
    const position = W.components.position[id],
      tile = idx(position.x, position.y),
      local = nearestSettlement(tile, 4),
      medicine = !!local?.knownProcesses?.includes("medicine"),
      sheltered = !!local && completedBuildings(local, "shelter").length > 0;
    let open = 0;
    for (const wound of state.life.wounds) {
      if (wound.healedTick) continue;
      open++;
      wound.peakSeverity = Math.max(wound.peakSeverity || 0, wound.severity || 0);
      const healing =
        0.45 +
        (medicine ? 0.72 : 0) +
        (sheltered ? 0.28 : 0) +
        clamp((state.life.health || 50) / 180, 0, 0.55);
      if (wound.bleed > 0) {
        const pulse = Math.max(1, Math.ceil(wound.bleed * wound.severity * 0.28)),
          spilled = spillBodyBlood(id, tile, pulse);
        wound.bloodLost = (wound.bloodLost || 0) + spilled;
        state.life.integrity = Math.max(
          0,
          state.life.integrity - Math.max(1, Math.ceil(pulse * 0.45)),
        );
        W.components.body[id].integrity = state.life.integrity;
        wound.bleed = Math.max(0, wound.bleed - healing);
      } else wound.severity = Math.max(0, wound.severity - healing * 0.035);
      if (wound.bleed <= 0 && wound.severity < 0.12) {
        wound.healedTick = W.tick;
        wound.treated = medicine;
        wound.scar = wound.bloodLost > 3 || (wound.peakSeverity || 0) > 0.35;
        if (wound.scar && state.identity) {
          state.identity.scars.push(`${wound.type} scar on ${wound.part}`);
          state.identity.scars = [...new Set(state.identity.scars)].slice(-8);
        }
        open--;
      }
      if (state.life.integrity <= 0) {
        killEntity(id, `hemorrhage from ${wound.type} to the ${wound.part}`, wound.causeEvent);
        break;
      }
    }
    if (!classifyAlive(id)) continue;
    state.life.wounded = open > 0;
    state.life.pain = clamp(state.life.pain - (medicine ? 0.85 : 0.2), 0, 100);
    state.life.trauma = clamp(state.life.trauma - (sheltered ? 0.155 : 0.035), 0, 100);
  }
}

function occupationProtectedResidents() {
  const protectedResidents = [];
  for (const settlement of W.settlements) {
    const occupation = settlement.occupation;
    if (!occupation?.active) continue;
    for (const id of occupationResidents(settlement)) {
      const social = W.components.social[id];
      if (
        social?.occupiedSettlementId === settlement.id &&
        social.occupiedBy === occupation.occupierFactionId &&
        !social.integrated
      )
        protectedResidents.push({ id, factionId: social.formerFactionId });
    }
  }
  return protectedResidents;
}

const updateSettlementsOccupationBase = updateSettlements;
updateSettlements = function () {
  const protectedResidents = occupationProtectedResidents(),
    result = updateSettlementsOccupationBase();
  if (W.tick % 32 === 0) updateMaterialProcesses();
  for (const entry of protectedResidents) {
    const social = W.components.social[entry.id];
    if (social && !social.integrated) social.factionId = entry.factionId;
  }
  return result;
};

function updateOccupations() {
  if (W.tick % 128) return;
  for (const settlement of W.settlements) {
    const occupation = settlement.occupation;
    if (!occupation?.active || settlement.ruined) continue;
    const occupier = W.factions.find((f) => f.id === occupation.occupierFactionId),
      residents = occupationResidents(settlement),
      resistant = residents.filter((id) => {
        const social = W.components.social[id];
        return social?.occupiedSettlementId === settlement.id && !social.integrated;
      }),
      xeno = factionXenophobia(occupier),
      stability = settlement.stability || 0,
      food = settlementFood(settlement);
    for (const id of resistant) {
      const social = ensureConflictPerson(id).social,
        chance =
          0.015 +
          (1 - xeno) * 0.06 +
          stability * 0.035 +
          clamp(food / 80, 0, 0.04) -
          social.resentment * 0.04;
      if (
        counterRand("occupation-integration", Math.floor(W.tick / 128), settlement.id, id) < chance
      ) {
        social.factionId = occupation.occupierFactionId;
        social.integrated = true;
        social.resentment = clamp(social.resentment - 0.24, 0, 1);
        occupation.adopted++;
        W.conflictMetrics.integrations++;
      }
    }
    const stillResistant = residents.filter((id) => {
      const social = W.components.social[id];
      return social?.occupiedSettlementId === settlement.id && !social.integrated;
    });
    occupation.resisting = stillResistant.length;
    occupation.resistance = residents.length
      ? clamp(
          stillResistant.length / residents.length +
            mean(stillResistant.map((id) => W.components.social[id]?.resentment || 0)) * 0.35,
          0,
          1,
        )
      : 0;
    if (occupation.resistance < 0.08 && W.tick - occupation.capturedTick > 512) {
      occupation.active = false;
      occupation.endedTick = W.tick;
      emitEvent("ReconciliationEvent", {
        subjects: [settlement.entityId],
        location: idx(settlement.x, settlement.y),
        factions: [occupation.occupierFactionId, occupation.formerFactionId].filter(Boolean),
        causes: [occupation.causeEvent],
        evidence: [
          "resistance declined through individual allegiance changes",
          "the occupied settlement retained its repaired physical fabric",
        ],
        magnitude: occupation.adopted,
        importance: 3,
        data: { name: settlement.name, occupationEnded: true },
      });
    }
  }
}

const simTickConflictBase = simTick;
simTick = function () {
  simTickConflictBase();
  if (!W) return;
  initializeConflictDrama();
  updatePersistentWounds();
  updateOccupations();
  updateInternalConflict();
};

const eventSentenceConflictBase = eventSentence;
eventSentence = function (event) {
  const names = event.subjects.map(entityName),
    location = locationName(event.location),
    factions = event.factions.map(
      (id) => W.factions.find((faction) => faction.id === id)?.name || `Faction ${id}`,
    );
  switch (event.type) {
    case "CombatExchangeEvent":
      return `${names[0] || "A combatant"} used ${event.data.tactic || "a strike"} against ${names[1] || "an opponent"}'s ${event.data.defense || "defense"} in ${location}; the exchange ${event.data.outcome === "evaded" ? "was evaded" : `hit the ${event.data.bodyPart || "body"}`}.`;
    case "InternalConflictEvent":
      return `Accumulated grievance inside ${event.data.name || location} brought ${names[0]} into violence with ${names[1]}.`;
    case "OccupationResistanceEvent":
      return `${names[0]} resisted the occupation of ${event.data.name || location}, confronting ${names[1]}.`;
    case "OccupationViolenceEvent":
      return `Occupation violence altered ${event.data.name || location} through a recorded physical act.`;
    case "BuildingDamagedEvent":
      return `${event.data.name || "A structure"} took ${fmt(event.magnitude)} measured damage in ${location}; it remained standing unless its integrity reached zero.`;
    case "BuildingRepairedEvent":
      return `${event.data.name || "A structure"} was restored in ${location} through measured labor after its recorded damage.`;
    case "ReconciliationEvent":
      return `${event.data.name || names[0] || "A community"} reduced conflict through stability, coexistence, and changing allegiance.`;
    case "InjuryEvent":
      if (event.data?.wound)
        return `${names[1] || "An attacker"} inflicted ${event.data.wound} on ${names[0] || "a combatant"}'s ${event.data.bodyPart} in ${location}, spilling ${event.data.bloodLost || 0} blood mass.`;
      return eventSentenceConflictBase(event);
    default:
      return eventSentenceConflictBase(event);
  }
};

const organismInspectorConflictBase = organismInspector;
organismInspector = function (id) {
  let html = organismInspectorConflictBase(id);
  const life = W.components.life[id],
    identity = W.components.identity[id];
  if (!life || W.kind[id] !== KINDS.PERSON) return html;
  const open = (life.wounds || []).filter((wound) => !wound.healedTick),
    wounds = open
      .map(
        (wound) =>
          `${wound.type} to ${wound.part} (${Math.round(wound.severity * 100)}% severity, bleed ${Number(wound.bleed).toFixed(1)})`,
      )
      .join("; "),
    scars = identity?.scars?.join("; ") || "none";
  html = html.replace(
    "<span>Cause of death</span>",
    `<span>Open wounds</span><b>${esc(wounds || "none")}</b><span>Pain / trauma</span><b>${Number(life.pain || 0).toFixed(1)} / ${Number(life.trauma || 0).toFixed(1)}</b><span>Scars</span><b>${esc(scars)}</b><span>Cause of death</span>`,
  );
  const social = W.components.social[id];
  html = html.replace(
    "<span>Kills</span>",
    `<span>Xenophobia / resentment</span><b>${pct(personXenophobia(id, false) * 100)} / ${pct((social?.resentment || 0) * 100)}</b><span>Kills</span>`,
  );
  return html;
};

const settlementCardConflictBase = settlementCard;
settlementCard = function (settlement) {
  let html = settlementCardConflictBase(settlement);
  if (!settlement.occupation) return html;
  const occupation = settlement.occupation,
    occupier = W.factions.find((faction) => faction.id === occupation.occupierFactionId),
    former = W.factions.find((faction) => faction.id === occupation.formerFactionId);
  return html.replace(
    "<span>Culture</span>",
    `<span>Occupation</span><b>${occupation.active ? `${esc(occupier?.name || "occupier")} over ${esc(former?.name || "former polity")} · ${pct(occupation.resistance * 100)} resistance` : "integrated"}</b><span>Culture</span>`,
  );
};

const showFactionConflictBase = showFaction;
showFaction = function (id) {
  showFactionConflictBase(id);
  const faction = W.factions.find((candidate) => candidate.id === id);
  if (!faction) return;
  const xenophobia = factionXenophobia(faction, W, false),
    occupations = W.settlements.filter(
      (settlement) =>
        settlement.occupation?.active && settlement.occupation.occupierFactionId === id,
    ),
    resistance = occupations.length
      ? mean(occupations.map((settlement) => settlement.occupation.resistance))
      : 0;
  DOM.modalBody.insertAdjacentHTML(
    "beforeend",
    `<div class="subhead">Conflict temperament and occupation</div><div class="card"><div class="kv"><span>Xenophobia</span><b>${pct(xenophobia * 100)}</b><span>Conflict tendency</span><b>${xenophobia > 0.7 ? "strong out-group hostility" : xenophobia > 0.42 ? "guarded toward outsiders" : "comparatively open"}</b><span>Active occupations</span><b>${occupations.length}</b><span>Mean occupation resistance</span><b>${pct(resistance * 100)}</b></div><div class="divider"></div><small class="muted">This trait changes whom residents distrust, internal-conflict pressure, allegiance after capture, and occupation integration; it does not create violence by itself.</small></div>`,
  );
};

const implicitSocietySummaryConflictBase = implicitSocietySummary;
implicitSocietySummary = function () {
  initializeConflictDrama();
  const summary = implicitSocietySummaryConflictBase();
  if (!summary) return summary;
  summary.factions = summary.factions.map((entry) => {
    const faction = W.factions.find((candidate) => candidate.id === entry.id);
    return { ...entry, xenophobia: +factionXenophobia(faction).toFixed(3) };
  });
  summary.occupations = W.settlements
    .filter((settlement) => settlement.occupation)
    .map((settlement) => ({
      settlementId: settlement.id,
      name: settlement.name,
      ...settlement.occupation,
    }));
  summary.internalConflicts = W.internalConflicts.slice(-24).map((conflict) => ({ ...conflict }));
  summary.conflictMetrics = { ...W.conflictMetrics };
  return summary;
};

function conflictDramaAudit() {
  initializeConflictDrama();
  const failures = [];
  for (const settlement of W.settlements) {
    const occupation = settlement.occupation;
    if (occupation?.active && settlement.factionId !== occupation.occupierFactionId)
      failures.push(`settlement ${settlement.id} occupation owner mismatch`);
  }
  for (const building of W.buildings) {
    if (building.lastDamage?.warId && !building.lastDamage.causeEvent)
      failures.push(`building ${building.id} has uncited war damage`);
    if (building.ruined && building.lastDamage?.warId) {
      const collapse = W.events.find(
        (event) =>
          event.type === "BuildingCollapsedEvent" && event.data?.buildingId === building.id,
      );
      if (!collapse) failures.push(`war-ruined building ${building.id} lacks collapse event`);
    }
  }
  for (const id of W.activeIds) {
    const wounds = W.components.life[id]?.wounds;
    if (!wounds) continue;
    for (const wound of wounds)
      if (!wound.causeEvent || wound.severity < 0 || wound.severity > 1)
        failures.push(`person ${id} has malformed wound ${wound.id}`);
  }
  return {
    failures,
    metrics: { ...W.conflictMetrics },
    occupations: W.settlements.filter((s) => s.occupation?.active).length,
    recentInternalConflicts: W.internalConflicts.slice(-12),
    matter: auditMatter(),
  };
}

function debugConflictDramaProbe() {
  initializeConflictDrama();
  const people = W.activeIds
    .filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id))
    .sort((a, b) => a - b);
  if (people.length < 2) return { ok: false, reason: "two living people are required" };
  const attacker = people[0],
    victim = people[1],
    victimLife = W.components.life[victim],
    beforeIntegrity = victimLife.integrity,
    beforeMatter = totalMatter();
  W.components.life[attacker].lastMilitaryAttackTick = -999;
  const result = detailedCombatExchange(attacker, victim, {
      internal: true,
      intensity: 0.5,
      forceHit: true,
      rollOverride: 0.7,
      force: true,
    }),
    wounds = (victimLife.wounds || []).map((wound) => ({ ...wound })),
    syntheticId = 900000 + W.tick,
    testBuildings = [
      {
        id: syntheticId,
        placeKind: "settlement",
        placeId: syntheticId,
        type: "shelter",
        name: "Probe shelter",
        complete: true,
        ruined: false,
        integrity: 100,
        maxIntegrity: 100,
      },
      {
        id: syntheticId + 1,
        placeKind: "settlement",
        placeId: syntheticId,
        type: "wall",
        name: "Probe wall",
        complete: true,
        ruined: false,
        integrity: 100,
        maxIntegrity: 100,
      },
    ],
    target = {
      id: syntheticId,
      entityId: victim,
      name: "Probe settlement",
      x: W.components.position[victim].x,
      y: W.components.position[victim].y,
      inventory: new Uint16Array(SPECIES_COUNT),
      structure: { integrity: 650, composition: new Uint16Array(SPECIES_COUNT) },
      stability: 0.3,
      factionId: syntheticId + 2,
      cultureId: 0,
      knownProcesses: [],
      importantEvents: [],
      management: defaultCityManagement(),
      ruined: false,
    },
    attackerFaction = {
      id: syntheticId,
      entityId: attacker,
      name: "Probe occupiers",
      color: "hsl(14 70% 54%)",
      aggression: 0.1,
      militaryStrength: 0,
      warPressure: 0,
      cohesion: 0.8,
      cultureId: 0,
      settlementIds: [],
      capitalSettlementId: 0,
    },
    defenderFaction = {
      id: syntheticId + 2,
      entityId: victim,
      name: "Probe defenders",
      color: "hsl(212 70% 54%)",
      aggression: 0.2,
      militaryStrength: 0,
      warPressure: 0,
      cohesion: 0.7,
      cultureId: 1,
      settlementIds: [syntheticId],
      capitalSettlementId: syntheticId,
    };
  W.buildings.push(...testBuildings);
  const beforeBuildings = testBuildings.map((building) => ({
      id: building.id,
      integrity: building.integrity,
      ruined: building.ruined,
    })),
    doctrine = applyConquestDoctrine(target, attackerFaction, idx(target.x, target.y), null),
    afterBuildings = testBuildings.map((building) => ({
      id: building.id,
      integrity: building.integrity,
      ruined: building.ruined,
    }));
  const attackerPosition = W.components.position[attacker],
    victimPosition = W.components.position[victim];
  attackerPosition.x = victimPosition.x;
  attackerPosition.y = victimPosition.y;
  attackerPosition.regionId = victimPosition.regionId;
  const attackerSocial = ensureConflictPerson(attacker).social,
    victimSocial = ensureConflictPerson(victim).social;
  attackerSocial.factionId = attackerFaction.id;
  attackerSocial.cultureId = 0;
  attackerSocial.aggression = 0.95;
  attackerSocial.resentment = 0.95;
  victimSocial.factionId = defenderFaction.id;
  victimSocial.cultureId = 1;
  victimSocial.resentment = 0.5;
  victimSocial.unitId = syntheticId + 2;
  W.components.life[attacker].lastMilitaryAttackTick = -999;
  rebuildSpatialBins();
  const siegeWar = { id: syntheticId, startEventId: 0, lastEventId: 0 },
    siegeDamage = razeStrike(attacker, target, testBuildings[1], siegeWar),
    siegeEvent = W.events.find((event) => event.id === testBuildings[1].lastDamage?.causeEvent),
    internalEvent = triggerInternalConflict(target, { tension: 1 });
  W.factions.push(attackerFaction, defenderFaction);
  W.settlements.push(target);
  for (const building of testBuildings) {
    building.x = target.x;
    building.y = target.y;
    building.defense = BUILDING_DEFS[building.type]?.defense || 0;
  }
  const contactUnit = {
      id: syntheticId,
      factionId: attackerFaction.id,
      homeSettlementId: 0,
      memberIds: [attacker],
      training: 6,
      supply: 1,
      morale: 0.8,
      formedTick: W.tick - 64,
      active: true,
    },
    contactWar = {
      id: syntheticId,
      a: attackerFaction.id,
      b: defenderFaction.id,
      attackerId: attackerFaction.id,
      startEventId: internalEvent?.id || 0,
      lastEventId: internalEvent?.id || 0,
      contactRecords: [],
    };
  W.militaryUnits.push(contactUnit);
  W.components.life[attacker].lastMilitaryAttackTick = -999;
  const contact = militaryContact(contactUnit, contactWar),
    contactTactic = contact ? militaryTacticalAssessment(contactUnit, contact) : null,
    contactEventsBefore = W.events.length,
    contactExchanges = contact
      ? resolveMilitaryContact(contactUnit, contact, contactWar, contactTactic)
      : 0,
    contactCombatEvents = W.events
      .slice(contactEventsBefore)
      .filter((event) => event.type === "CombatExchangeEvent").length;
  const captureEvent = captureSettlementCausally(
    target,
    attackerFaction,
    defenderFaction,
    { id: syntheticId, startEventId: internalEvent?.id || 0, lastEventId: internalEvent?.id || 0 },
    [
      { id: attacker, u: { training: 4 } },
      { id: victim, u: { training: 2 } },
    ],
  );
  W.militaryUnits = W.militaryUnits.filter((unit) => unit !== contactUnit);
  victimSocial.unitId = 0;
  return {
    ok: result > 0,
    attacker,
    victim,
    result,
    integrityLost: beforeIntegrity - victimLife.integrity,
    wounds,
    combatEvent: W.events.findLast((event) => event.type === "CombatExchangeEvent")?.data || null,
    injuryEvent: W.events.findLast((event) => event.type === "InjuryEvent")?.data || null,
    doctrine,
    beforeBuildings,
    afterBuildings,
    preservedOnCapture:
      JSON.stringify(beforeBuildings) === JSON.stringify(afterBuildings) && doctrine.razed === 0,
    siege: {
      damage: siegeDamage,
      eventType: siegeEvent?.type || null,
      causeEvent: testBuildings[1].lastDamage?.causeEvent || 0,
      remainingIntegrity: testBuildings[1].integrity,
    },
    internalEvent: internalEvent?.type || null,
    contact: {
      key: contact?.key || "",
      kind: contact?.kind || "",
      buildingId: contact?.building?.id || 0,
      objectiveTileRequired: contact?.distance > 0,
      distance: contact?.distance ?? -1,
      tactic: contactTactic?.name || "",
      phase: contactTactic?.phase || "",
      exchanges: contactExchanges,
      combatEvents: contactCombatEvents,
      recorded: contactWar.contactRecords.length,
    },
    capture: {
      eventId: captureEvent.id,
      owner: target.factionId,
      expectedOwner: attackerFaction.id,
      occupation: { ...target.occupation },
      structures: settlementBuildingsByCondition(target),
      eventData: { ...captureEvent.data },
    },
    matterDelta: totalMatter() - beforeMatter,
  };
}

const debugConflictDramaProbeMutating = debugConflictDramaProbe;
debugConflictDramaProbe = function () {
  return runIsolatedWorldProbe(debugConflictDramaProbeMutating);
};

window.ALIFE_CONFLICT_DEBUG = Object.freeze({
  summary: () => implicitSocietySummary(),
  audit: conflictDramaAudit,
  probe: debugConflictDramaProbe,
  strike: (attacker, victim, options = {}) =>
    detailedCombatExchange(attacker, victim, { ...options, force: true }),
  factionXenophobia: (id) => factionXenophobia(W.factions.find((faction) => faction.id === id)),
});
