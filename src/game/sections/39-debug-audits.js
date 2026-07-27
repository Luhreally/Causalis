function debugDeathCauses() {
  const causes = {};
  for (const event of W?.events || [])
    if (event.type === "DeathEvent") {
      const cause = event.evidence?.[0] || "unknown";
      causes[cause] = (causes[cause] || 0) + (event.magnitude || 1);
    }
  return causes;
}
function debugBaselineAudit() {
  if (!W) return null;
  const byKind = {};
  for (const kind of [KINDS.HERBIVORE, KINDS.PREDATOR, KINDS.PERSON]) {
    const ids = W.activeIds.filter((id) => W.kind[id] === kind && classifyAlive(id)),
      cohort = W.cohorts.filter((c) => c.kind === kind).reduce((n, c) => n + c.count, 0),
      values = ids.map((id) => {
        const l = derivedLife(id),
          q = W.components.chemistry[id].q,
          b = W.components.body[id],
          r = W.components.reproduction[id];
        return {
          age: l.age,
          energy: q[C.ENERGY],
          solvent: q[C.SOLVENT],
          integrity: l.integrity,
          ready: r.cooldown === 0 && l.energy > 65 && l.age > b.maxAge * 0.18,
        };
      });
    byKind[kind] = {
      active: ids.length,
      cohort,
      total: ids.length + cohort,
      meanAge: values.length ? mean(values.map((v) => v.age)) : 0,
      oldest: values.length ? Math.max(...values.map((v) => v.age)) : 0,
      ready: values.filter((v) => v.ready).length,
      meanEnergy: values.length ? mean(values.map((v) => v.energy)) : 0,
      meanSolvent: values.length ? mean(values.map((v) => v.solvent)) : 0,
      meanIntegrity: values.length ? mean(values.map((v) => v.integrity)) : 0,
    };
  }
  const fireEvents = W.events.filter((e) => e.type === "FireStartedEvent"),
    origins = {};
  for (const e of fireEvents) {
    const origin = e.data?.origin || "unknown";
    origins[origin] = (origins[origin] || 0) + 1;
  }
  let burning = 0,
    smoldering = 0,
    maxFire = 0,
    nearLife = 0,
    nearPlaces = 0;
  for (let i = 0; i < W.tileCount; i++) {
    const fire = W.tiles.fire[i];
    if (fire > 0) smoldering++;
    if (fire > 100) burning++;
    if (fire > maxFire) maxFire = fire;
    if (fire > 100) {
      if (livingNearTile(i, 3)) nearLife++;
      if (settlementNear(i, 5) || campNear(i, 5)) nearPlaces++;
    }
  }
  return {
    tick: W.tick,
    byKind,
    fire: {
      burning,
      smoldering,
      max: maxFire,
      nearLife,
      nearPlaces,
      retainedIgnitions: fireEvents.length,
      origins,
      disasters: W.events.filter((e) => e.type === "FireDisasterEvent").length,
      recentMean: W.statistics.history.length
        ? mean(W.statistics.history.slice(-40).map((h) => h.fire))
        : 0,
    },
    ecology: {
      producerTiles: Math.round(
        sampleField((i) => (W.tiles.plantOrder[i] > 220 ? 1 : 0)) * W.tileCount,
      ),
      food: sampleField((i) => tileFood(i, "omnivore")),
      moisture: sampleField(tileMoisture),
      danger: sampleField((i) => W.tiles.danger[i] / 10),
    },
    births: { ...W.statistics.birthsByKind },
    deaths: debugDeathCauses(),
    refugia: (W.biosphere?.refugia || [])
      .filter((r) => r.available)
      .reduce((out, r) => ((out[r.kind] = (out[r.kind] || 0) + 1), out), {}),
  };
}
function debugPopulationMechanics() {
  if (!W) return null;
  const people = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id)),
    value = (id, sp) => W.components.chemistry[id].q[sp],
    average = (fn) => (people.length ? mean(people.map(fn)) : 0),
    places = [...W.camps.filter((c) => c.active), ...W.settlements.filter((s) => !s.ruined)].map(
      (place) => ({
        kind: place.knownProcesses ? "settlement" : "camp",
        id: place.id,
        population: placePopulation(place),
        stability: +(place.stability || 0).toFixed(3),
        storage: place.storageCapacity || 150,
        inventory: {
          organic: place.inventory[C.ORGANIC],
          energy: place.inventory[C.ENERGY],
          nutrient: place.inventory[C.NUTRIENT],
          solvent: place.inventory[C.SOLVENT],
        },
        buildings: {
          complete: completedBuildings(place).length,
          active: activeBuildings(place).length,
        },
      }),
    ),
    criteria = {
      energy: people.filter((id) => derivedLife(id).energy > 22).length,
      health: people.filter((id) => derivedLife(id).health > 48).length,
      organic: people.filter((id) => value(id, C.ORGANIC) > 36).length,
      nutrient: people.filter((id) => value(id, C.NUTRIENT) > 16).length,
      solvent: people.filter((id) => value(id, C.SOLVENT) > 75).length,
      info: people.filter((id) => value(id, C.INFO) > 8).length,
      membrane: people.filter((id) => value(id, C.MEMBRANE) > 14).length,
    };
  return {
    people: people.length,
    mature: people.filter((id) => W.components.life[id].age > W.components.body[id].maturityAge)
      .length,
    cooldownReady: people.filter((id) => W.components.reproduction[id].cooldown <= 0).length,
    reproductionReady: people.filter(canReproduce).length,
    criteria,
    mean: {
      age: average((id) => W.components.life[id].age),
      energy: average((id) => value(id, C.ENERGY)),
      organic: average((id) => value(id, C.ORGANIC)),
      nutrient: average((id) => value(id, C.NUTRIENT)),
      solvent: average((id) => value(id, C.SOLVENT)),
      hunger: average((id) => derivedLife(id).hunger),
      fatigue: average((id) => derivedLife(id).fatigue),
    },
    starving: people.filter((id) => value(id, C.ENERGY) < 30).length,
    working: people.filter(
      (id) =>
        W.components.work?.[id]?.task &&
        W.components.work[id].task !== "idle" &&
        W.tick -
          (Number.isFinite(W.components.work[id].handledTick)
            ? W.components.work[id].handledTick
            : -Infinity) <=
          8,
    ).length,
    places,
  };
}
function debugSummary() {
  return W
    ? {
        seed: W.seed,
        tick: W.tick,
        year: formatYear(),
        hash: worldHash(),
        population: populationSummary(),
        entities: W.activeIds.length,
        cohorts: W.cohorts.reduce((n, c) => n + c.count, 0),
        settlements: W.settlements.length,
        factions: W.factions.length,
        events: W.events.length,
        technologies: W.technologies.length,
        births: W.statistics.births,
        birthsByKind: { herbivore: 0, predator: 0, person: 0, ...W.statistics.birthsByKind },
        deaths: W.statistics.deaths,
        deathCauses: debugDeathCauses(),
        hydrology: hydrologySummary(),
        biosphere: W.biosphere
          ? {
              stage: W.biosphere.stage,
              rescues: W.biosphere.rescueCount,
              dormant: W.biosphere.refugia.filter((r) => r.available).length,
              cellularViability: W.biosphere.cellularAdaptation?.viability ?? null,
              cellularGenerations: W.biosphere.cellularAdaptation?.cellularGenerations ?? 0,
            }
          : null,
      }
    : null;
}
const debugSummarySocietyBase = debugSummary;
debugSummary = function () {
  const out = debugSummarySocietyBase();
  if (out) out.civilization = civilizationSummary();
  return out;
};
function debugCognitionAudit() {
  if (!W) return null;
  const malformed = [],
    ids = W.activeIds.filter((id) => W.components.cognition?.[id]).sort((a, b) => a - b);
  let digest = 2166136261 >>> 0,
    nonzeroStates = 0,
    nonzeroOutputs = 0,
    updates = 0,
    influences = 0;
  const mix = (value) => {
    digest ^= (Number(value) || 0) & 0xffffffff;
    digest = Math.imul(digest, 16777619) >>> 0;
  };
  for (const id of ids) {
    const g = W.components.genome[id]?.controller,
      c = W.components.cognition[id],
      checks = [
        ["input", g?.input, Int16Array, 20, -2560, 2560],
        ["rec", g?.rec, Int16Array, 10, -2560, 2560],
        ["out", g?.out, Int16Array, 42, -2560, 2560],
        ["tau", g?.tau, Uint16Array, 5, 768, 12288],
        ["leak", g?.leak, Int16Array, 5, -2560, 2560],
        ["state", c.state, Int16Array, 5, -LTC_Q, LTC_Q],
        ["plastic", c.plastic, Int16Array, 42, -384, 384],
        ["value", c.value, Int16Array, 14, -LTC_Q, LTC_Q],
        ["output", c.output, Int16Array, 14, -LTC_Q, LTC_Q],
      ];
    mix(id);
    for (const [name, array, T, length, min, max] of checks) {
      if (!(array instanceof T) || array.length !== length) {
        malformed.push(`${id}:${name}:shape`);
        continue;
      }
      for (const value of array) {
        if (value < min || value > max) malformed.push(`${id}:${name}:range:${value}`);
        mix(value);
      }
    }
    if (Array.from(c.state).some(Boolean)) nonzeroStates++;
    if (Array.from(c.output).some(Boolean)) nonzeroOutputs++;
    updates += c.updates || 0;
    influences += c.influenceCount || 0;
    mix(c.updates);
    mix(c.influenceCount);
    mix(c.lastReward);
  }
  return {
    agents: ids.length,
    updates,
    influences,
    nonzeroStates,
    nonzeroOutputs,
    malformed,
    digest: (digest >>> 0).toString(16).padStart(8, "0"),
  };
}
debugCognitionAudit = function () {
  if (!W) return null;
  const malformed = [],
    ids = W.activeIds.filter((id) => W.components.cognition?.[id]).sort((a, b) => a - b);
  let digest = 2166136261 >>> 0,
    nonzeroStates = 0,
    nonzeroOutputs = 0,
    updates = 0,
    influences = 0;
  const mix = (value) => {
    digest ^= (Number(value) || 0) & 0xffffffff;
    digest = Math.imul(digest, 16777619) >>> 0;
  };
  for (const id of ids) {
    const g = W.components.genome[id]?.controller,
      c = W.components.cognition[id],
      checks = [
        ["input", g?.input, Int16Array, LTC_HIDDEN * LTC_INPUT_FAN, -2560, 2560],
        ["rec", g?.rec, Int16Array, LTC_HIDDEN * LTC_REC_FAN, -2560, 2560],
        ["out", g?.out, Int16Array, LTC_ACTIONS.length * LTC_OUTPUT_FAN, -2560, 2560],
        ["tau", g?.tau, Uint16Array, LTC_HIDDEN, 768, 12288],
        ["leak", g?.leak, Int16Array, LTC_HIDDEN, -2560, 2560],
        ["inputs", c.inputs, Int16Array, LTC_SENSE_LABELS.length, 0, LTC_Q],
        ["state", c.state, Int16Array, LTC_HIDDEN, -LTC_Q, LTC_Q],
        ["plastic", c.plastic, Int16Array, LTC_ACTIONS.length * LTC_OUTPUT_FAN, -384, 384],
        ["value", c.value, Int16Array, LTC_ACTIONS.length, -LTC_Q, LTC_Q],
        ["output", c.output, Int16Array, LTC_ACTIONS.length, -LTC_Q, LTC_Q],
      ];
    mix(id);
    for (const [name, array, T, length, min, max] of checks) {
      if (!(array instanceof T) || array.length !== length) {
        malformed.push(`${id}:${name}:shape`);
        continue;
      }
      for (const value of array) {
        if (value < min || value > max) malformed.push(`${id}:${name}:range:${value}`);
        mix(value);
      }
    }
    if (Array.from(c.state).some(Boolean)) nonzeroStates++;
    if (Array.from(c.output).some(Boolean)) nonzeroOutputs++;
    updates += c.updates || 0;
    influences += c.influenceCount || 0;
    mix(c.updates);
    mix(c.influenceCount);
    mix(c.lastReward);
  }
  return {
    agents: ids.length,
    topology: {
      senses: LTC_SENSE_LABELS.length,
      hidden: LTC_HIDDEN,
      inputConnections: LTC_INPUT_BASE.length,
      recurrentConnections: LTC_REC_BASE.length,
      outputConnections: LTC_OUT_BASE.length,
    },
    updates,
    influences,
    nonzeroStates,
    nonzeroOutputs,
    malformed,
    digest: (digest >>> 0).toString(16).padStart(8, "0"),
  };
};
function debugCivicAudit() {
  if (!W) return null;
  const failures = [];
  for (const place of [
    ...W.camps.filter((c) => c.active),
    ...W.settlements.filter((s) => !s.ruined),
  ]) {
    const a = makeArchitectureGenome(place),
      expected = `${a.layout}:${a.wallForm}:${a.roofForm}:${a.rigid}:${a.flexible}`;
    if (a.signature !== expected)
      failures.push(`architecture ${placeKindKey(place)}:${place.id} signature mismatch`);
    const capacity = completedBuildings(place).reduce(
      (n, b) =>
        n + Math.floor(b.housing * clamp((b.integrity / Math.max(1, b.maxIntegrity)) * 1.25, 0, 1)),
      0,
    );
    if ((place.housing || 0) !== capacity)
      failures.push(
        `place ${placeKindKey(place)}:${place.id} housing includes unfinished structures`,
      );
  }
  for (const b of W.buildings) {
    if (
      b.complete &&
      (b.workDone < b.workRequired ||
        b.requirements.some(([sp, n]) => (b.composition[sp] || 0) < n))
    )
      failures.push(`building ${b.id} completed without matter or labor`);
    if (b.progress < 0 || b.progress > 1 || b.stage < 0 || b.stage > 6)
      failures.push(`building ${b.id} invalid stage`);
  }
  for (const a of W.artifacts.filter((a) => a.tool)) {
    if (!a.tool.capabilities.length || a.tool.wear < 0 || a.tool.wear > a.tool.durability)
      failures.push(`tool ${a.id} invalid function or wear`);
    const linked = a.ownerId
      ? W.components.inventory[a.ownerId]?.artifactIds?.includes(a.entityId)
      : groundedToolTile(a) >= 0 && !!W.components.position[a.entityId];
    if (!linked) failures.push(`tool ${a.id} missing owner link`);
    if (sum(Array.from(a.composition)) < 4) failures.push(`tool ${a.id} lacks conserved material`);
  }
  const workers = {};
  for (const id of W.activeIds)
    if (W.kind[id] === KINDS.PERSON) {
      const task = W.components.work?.[id]?.task || "idle";
      workers[task] = (workers[task] || 0) + 1;
    }
  return {
    stage: W.civilization.stage,
    camps: W.camps.filter((c) => c.active).length,
    settlements: W.settlements.filter((s) => !s.ruined).length,
    buildings: W.buildings.map((b) => ({
      id: b.id,
      placeKind: b.placeKind,
      placeId: b.placeId,
      type: b.type,
      position: [b.x, b.y],
      stage: b.stage,
      progress: b.progress,
      complete: b.complete,
      work: [b.workDone, b.workRequired],
      requirements: b.requirements.map(([sp, n]) => ({
        sp,
        name: W.definitions.species[sp].name,
        current: b.composition[sp] || 0,
        needed: n,
      })),
    })),
    orders: {
      open: W.workOrders.filter((o) => o.status === "open").length,
      complete: W.workOrders.filter((o) => o.status === "complete").length,
    },
    tools: W.artifacts
      .filter((a) => a.tool)
      .map((a) => ({
        id: a.id,
        entityId: a.entityId,
        ownerId: a.ownerId,
        name: a.name,
        purpose: a.tool.purpose,
        placeKind: a.placeKind,
        placeId: a.placeId,
        functional: isFunctionalTool(a),
        capabilities: a.tool.capabilities.slice(),
        quality: a.quality,
        wear: a.tool.wear,
        durability: a.tool.durability,
        composition: Array.from(a.composition),
      })),
    workers,
    metrics: { ...W.civicMetrics },
    events: {
      construction: W.events.filter((e) => e.type === "ConstructionStartedEvent").length,
      buildings: W.events.filter((e) => e.type === "BuildingCompletedEvent").length,
      tools: W.events.filter((e) => e.type === "ToolCraftedEvent").length,
      stages: W.events.filter((e) => e.type === "StageAdvanceEvent").length,
    },
    failures,
    matter: auditMatter(),
  };
}
function debugArchiveReplay(ticks = 128) {
  const raw = JSON.stringify(snapshot(), saveReplacer),
    savedHash = W.hash;
  stepTicks(ticks);
  const firstContinuation = worldHash(),
    snap = migrateSave(JSON.parse(raw, saveReviver));
  W = snap.world;
  restoreWorldDefaults();
  const restoredHash = worldHash(),
    typed = {
      buildingComposition: W.buildings.every((b) => b.composition instanceof Uint16Array),
      cognition: W.activeIds
        .filter((id) => W.components.cognition[id])
        .every(
          (id) =>
            W.components.cognition[id].state instanceof Int16Array &&
            W.components.cognition[id].output instanceof Int16Array,
        ),
    };
  stepTicks(ticks);
  const replayContinuation = worldHash();
  return {
    ok:
      savedHash === restoredHash &&
      firstContinuation === replayContinuation &&
      typed.buildingComposition &&
      typed.cognition,
    savedHash,
    restoredHash,
    firstContinuation,
    replayContinuation,
    typed,
  };
}
function recordDebugControl(action, data = {}, tile = -1) {
  const event = recordIntervention("debug-control", tile, 0),
    entry = W.interventions.at(-1);
  if (entry) entry.data = { action, ...data };
  return event.id;
}
function induceSurfaceFloodForTest(amount = 600, record = true) {
  ensureHydrologyBaseline(W);
  const rise = clamp(Math.floor(amount), 1, 4000);
  if (record) recordDebugControl("surface-flood", { amount: rise });
  for (let i = 0; i < W.tileCount; i++)
    if (W.tiles.hydrologyBase[i] < 100) W.tiles.liquid[i] = u16(W.tiles.liquid[i] + rise);
  return hydrologySummary();
}
function collapseKindForTest(kind, record = true) {
  if (record) recordDebugControl("collapse-kind", { kind });
  for (const id of W.activeIds.slice())
    if (W.kind[id] === kind) killEntity(id, "controlled extinction test", 0);
  return populationSummary();
}
function armFollowedDeathForTest(kind = KINDS.HERBIVORE, record = true, entityId = 0) {
  const id = entityId || W.activeIds.find((entity) => W.kind[entity] === kind && peekAlive(entity));
  if (!id) return 0;
  if (record) recordDebugControl("arm-followed-death", { kind, entityId: id });
  UI.followId = id;
  UI.selectedEntity = id;
  const life = W.components.life[id],
    chemistry = W.components.chemistry[id]?.q;
  if (!life || !chemistry) return 0;
  life.regulation = 1;
  life.forceHealthUpdateTick = W.tick + 1;
  chemistry[C.ENERGY] = 0;
  chemistry[C.ORGANIC] = 0;
  chemistry[C.NUTRIENT] = 0;
  life.integrity = Math.min(life.integrity, 2);
  W.components.body[id].integrity = life.integrity;
  return id;
}
function auditEnergy() {
  const chemical = totalChemicalEnergy(),
    thermal = W.conservation.thermalEnergy || 0,
    current = chemical + thermal,
    expected =
      (W.conservation.initialChemicalEnergy || 0) +
      W.conservation.radiantInput -
      W.conservation.dissipatedEnergy;
  return {
    chemical,
    thermal,
    current,
    expected,
    delta: current - expected,
    radiantInput: W.conservation.radiantInput,
    dissipated: W.conservation.dissipatedEnergy,
  };
}
function debugNicheAudit() {
  const result = {};
  for (const kind of [KINDS.HERBIVORE, KINDS.PREDATOR, KINDS.PERSON]) {
    const active = W.activeIds
      .filter((id) => W.kind[id] === kind && peekAlive(id))
      .map((id) => {
        const life = peekDerivedLife(id),
          chemistry = W.components.chemistry[id]?.q,
          identity = W.components.identity[id],
          position = W.components.position[id],
          reproduction = W.components.reproduction[id],
          nearestMateDistance = Math.min(
            Infinity,
            ...W.activeIds
              .filter((other) => other !== id && W.kind[other] === kind && peekAlive(other))
              .map((other) => {
                const otherPosition = W.components.position[other];
                return otherPosition
                  ? Math.sqrt(dist2(position.x, position.y, otherPosition.x, otherPosition.y))
                  : Infinity;
              }),
          );
        return {
          id,
          age: W.components.life[id]?.age || 0,
          maturityAge: W.components.body[id]?.maturityAge || 0,
          health: life?.health || 0,
          hunger: life?.hunger || 0,
          energy: chemistry?.[C.ENERGY] || 0,
          organic: chemistry?.[C.ORGANIC] || 0,
          nutrient: chemistry?.[C.NUTRIENT] || 0,
          solvent: chemistry?.[C.SOLVENT] || 0,
          info: chemistry?.[C.INFO] || 0,
          membrane: chemistry?.[C.MEMBRANE] || 0,
          regulation: W.components.life[id]?.regulation || 0,
          behavior: W.components.life[id]?.behavior || "",
          cooldown: reproduction?.cooldown || 0,
          reproductionReady: canReproduce(id),
          nearestMateDistance: Number.isFinite(nearestMateDistance)
            ? +nearestMateDistance.toFixed(2)
            : null,
          kills: identity?.kills || 0,
          children: identity?.children?.length || 0,
        };
      });
    result[kind] = {
      active,
      cohorts: sum(
        (W.cohorts || []).filter((cohort) => cohort.kind === kind).map((cohort) => cohort.count),
      ),
      availableRefuges: W.biosphere.refugia.filter(
        (refuge) => refuge.available && refuge.kind === kind,
      ).length,
      deaths: W.events
        .filter((event) => event.type === "DeathEvent" && event.data?.kind === kind)
        .reduce((counts, event) => {
          const cause = event.evidence?.[0] || "unknown";
          counts[cause] = (counts[cause] || 0) + 1;
          return counts;
        }, {}),
    };
  }
  return result;
}
function auditRelations() {
  const bad = [];
  for (const e of W.relations.edges)
    if (
      e &&
      ((!W.kind[e.from] && !W.historicalIdentities[e.from]) ||
        (!W.kind[e.to] && !W.historicalIdentities[e.to]))
    )
      bad.push(e.id);
  return { ok: bad.length === 0, total: W.relations.edges.filter(Boolean).length, bad };
}
function runIsolatedWorldProbe(probe) {
  if (!W || typeof probe !== "function") return null;
  const priorWorld = W,
    priorUi = {
      selectedTile: UI.selectedTile,
      selectedEntity: UI.selectedEntity,
      selectedEvent: UI.selectedEvent,
      followId: UI.followId,
      combatVisuals: UI.combatVisuals,
      emotionVisuals: UI.emotionVisuals,
      clockInterrupted: UI.clockInterrupted,
    },
    encoded = JSON.stringify(priorWorld, saveReplacer);
  W = JSON.parse(encoded, saveReviver);
  restoreWorldDefaults();
  rebuildSpatialBins();
  try {
    return probe();
  } finally {
    W = priorWorld;
    Object.assign(UI, priorUi);
  }
}
const debugArchiveReplayInPlace = debugArchiveReplay;
debugArchiveReplay = function (ticks = 128) {
  return runIsolatedWorldProbe(() => debugArchiveReplayInPlace(ticks));
};
function applyRecordedIntervention(entry) {
  if (entry.tool === "city-management") {
    const d = entry.data || {};
    if (typeof d.priority === "string") return setCityPriority(d.kind, d.id, d.priority, d.value);
    if (typeof d.policy === "string") return setCityPolicy(d.kind, d.id, d.policy);
    if (typeof d.type === "string") return requestCityBuilding(d.kind, d.id, d.type);
    return false;
  }
  if (entry.tool === "debug-control") {
    const data = entry.data || {};
    if (data.action === "surface-flood") return induceSurfaceFloodForTest(data.amount, true);
    if (data.action === "collapse-kind") return collapseKindForTest(data.kind, true);
    if (data.action === "arm-followed-death")
      return armFollowedDeathForTest(data.kind, true, data.entityId);
    return false;
  }
  UI.tool = entry.tool;
  UI.brush = entry.brush;
  applyTool(entry.tile);
  return true;
}
function debugReplay(seed, interventions = [], ticks = 200, options = null) {
  const oldW = W,
    oldTool = UI.tool,
    oldBrush = UI.brush,
    replayConfig = {
      origin: "cellular",
      size: "small",
      lifeDensity: 0.7,
      harshness: 0.5,
      variability: 0.5,
      disasterFrequency: 1,
      complexity: "standard",
      tutorial: false,
      unfiltered: false,
      ...(oldW?.config || {}),
      ...(options || {}),
      seed,
    };
  delete replayConfig.width;
  delete replayConfig.height;
  W = createWorld(replayConfig);
  bootstrapWorld();
  const sorted = interventions.slice().sort((a, b) => a.tick - b.tick || a.sequence - b.sequence);
  let n = 0;
  for (let t = 0; t < ticks; t++) {
    while (sorted[n]?.tick === W.tick) {
      applyRecordedIntervention(sorted[n]);
      n++;
    }
    simTick();
  }
  const result = { hash: worldHash(), summary: debugSummary(), config: { ...W.config } };
  W = oldW;
  UI.tool = oldTool;
  UI.brush = oldBrush;
  return result;
}
function determinismProbe(seed = "probe", ticks = 200) {
  const a = debugReplay(seed, [], ticks),
    b = debugReplay(seed, [], ticks);
  return { ok: a.hash === b.hash, first: a.hash, second: b.hash, ticks };
}
function installClipboardFallback() {
  DOM.copySeedBtn.onclick = async () => {
    const seed = W?.seed || "";
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(seed);
        toast("Seed copied");
        return;
      }
      const area = document.createElement("textarea");
      area.value = seed;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand && document.execCommand("copy");
      area.remove();
      if (ok) {
        toast("Seed copied");
        return;
      }
    } catch {}
    openModal(
      "World seed",
      `<p class="muted">Copy this exact deterministic seed:</p><input id="seedFallback" class="seed-input" readonly value="${esc(seed)}">`,
      `<button id="closeSeedFallback">Close</button>`,
    );
    $("#seedFallback").select();
    $("#closeSeedFallback").onclick = closeModal;
  };
}
function installResponsivePanels() {
  const leftBtn = document.getElementById("mobileLeftBtn"),
    rightBtn = document.getElementById("mobileRightBtn"),
    close = () => {
      DOM.leftPanel.classList.remove("open");
      DOM.rightPanel.classList.remove("open");
    };
  leftBtn.onclick = () => {
    const open = DOM.leftPanel.classList.toggle("open");
    DOM.rightPanel.classList.remove("open");
    leftBtn.setAttribute("aria-expanded", String(open));
  };
  rightBtn.onclick = () => {
    const open = DOM.rightPanel.classList.toggle("open");
    DOM.leftPanel.classList.remove("open");
    rightBtn.setAttribute("aria-expanded", String(open));
  };
  DOM.canvas.addEventListener("pointerdown", () => {
    if (innerWidth <= 570) close();
  });
}
function debugCreateWorld(options = {}) {
  UI.selectedTile = -1;
  UI.selectedEntity = 0;
  UI.selectedEvent = 0;
  UI.followId = 0;
  UI.running = false;
  UI.clockInterrupted = false;
  UI.followDeathWasRunning = false;
  UI.combatVisuals = [];
  UI.keys.clear();
  accumulator = 0;
  frameTime = 0;
  W = createWorld(
    Object.assign(
      {
        seed: "debug-world",
        size: "small",
        lifeDensity: 0.7,
        harshness: 0.5,
        variability: 0.5,
        disasterFrequency: 1,
        complexity: "standard",
        tutorial: false,
        unfiltered: false,
      },
      options,
    ),
  );
  bootstrapWorld();
  return debugSummary();
}
function debugCreateCivicScenario() {
  if (!W) return null;
  const existing = W.camps.find((c) => c.active);
  if (existing)
    return {
      campId: existing.id,
      tile: idx(existing.x, existing.y),
      architecture: existing.architecture,
      matterDelta: 0,
    };
  const people = W.activeIds
    .filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id))
    .sort((a, b) => a - b)
    .slice(0, 10);
  if (people.length < 4) return null;
  let tile = -1,
    best = -Infinity;
  for (let y = 3; y < W.height - 3; y += 2)
    for (let x = 3; x < W.width - 3; x += 2) {
      const i = idx(x, y);
      if (W.tiles.liquid[i] > 520 || W.tiles.fire[i] || W.tiles.danger[i] > 300) continue;
      const rigid =
          localMaterialAbundance(i, C.MINERAL, 4) +
          localMaterialAbundance(i, C.ORE, 4) +
          localMaterialAbundance(i, C.CRYSTAL, 4),
        flex = localMaterialAbundance(i, C.FIBER, 4) + localMaterialAbundance(i, C.ORGANIC, 4),
        score =
          Math.log2(rigid + 1) * 18 +
          Math.log2(flex + 1) * 20 +
          tileFood(i, "omnivore") * 2 +
          tileMoisture(i) -
          organismHabitatStress(people[0], i);
      if (score > best) {
        best = score;
        tile = i;
      }
    }
  if (tile < 0) tile = idx(W.components.position[people[0]].x, W.components.position[people[0]].y);
  const [cx, cy] = xy(tile),
    offsets = [
      [0, 0],
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
      [2, 0],
    ];
  for (let n = 0; n < people.length; n++) {
    const p = W.components.position[people[n]],
      o = offsets[n];
    p.x = clamp(cx + o[0], 0, W.width - 1);
    p.y = clamp(cy + o[1], 0, W.height - 1);
    p.regionId = regionId(p.x, p.y);
    const l = W.components.life[people[n]];
    l.hunger = Math.min(l.hunger, 18);
    l.thirst = Math.min(l.thirst, 18);
    l.fatigue = Math.min(l.fatigue, 12);
    l.health = Math.max(l.health, 88);
  }
  rebuildSpatialBins();
  const before = totalMatter(),
    camp = createCamp(tile, people[0], W.causalIndex.tile[tile] || 0);
  rebuildDerivedCaches();
  const after = totalMatter();
  return camp
    ? {
        campId: camp.id,
        entityId: camp.entityId,
        tile,
        people: people.slice(),
        architecture: { ...camp.architecture },
        matterBefore: before,
        matterAfter: after,
        matterDelta: after - before,
        buildings: activeBuildings(camp).map((b) => b.id),
      }
    : null;
}
