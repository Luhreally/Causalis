function boot() {
  cacheDom();
  cacheCameraDom();
  buildControls();
  bindUI();
  bindCameraUI();
  installClipboardFallback();
  installResponsivePanels();
  const settings = loadSettings();
  UI.quality = settings.quality;
  UI.labels = settings.labels;
  DOM.renderQuality.value = UI.quality;
  DOM.showLabels.checked = UI.labels;
  setAudio(false, settings.volume);
  refreshContinueButton();
  window.ALIFE_DEBUG = Object.freeze({
    createTestWorld: debugCreateWorld,
    step: (n) => stepTicks(n || 1),
    hashNow: () => worldHash(),
    summary: debugSummary,
    baseline: debugBaselineAudit,
    populationMechanics: debugPopulationMechanics,
    civilization: civilizationSummary,
    progressAudit: civilizationProgressAudit,
    cognitionAudit: debugCognitionAudit,
    civicAudit: debugCivicAudit,
    archiveReplay: debugArchiveReplay,
    hydrology: hydrologySummary,
    auditMatter: () => auditMatter(),
    auditEnergy,
    nicheAudit: debugNicheAudit,
    auditReactions: () => auditReactions(),
    auditRelations,
    exportInterventions: () => W?.interventions.slice() || [],
    replay: debugReplay,
    determinismProbe,
    runSmoke: (ticks) => {
      const before = debugSummary();
      stepTicks(ticks || 256);
      return {
        before,
        after: debugSummary(),
        matter: auditMatter(),
        relations: auditRelations(),
        reactions: auditReactions(),
        cognition: debugCognitionAudit(),
        civic: debugCivicAudit(),
      };
    },
  });
  window.ALIFE_SENTIENCE_DEBUG = Object.freeze({
    summary: sentienceContinuitySummary,
    collapse: debugSentienceCollapse,
    ensure: ensureSentientContinuity,
    archiveDiff: debugSentienceArchiveDiff,
    legacyRecovery: debugLegacySentienceRecovery,
  });
  window.ALIFE_SETTLEMENT_DEBUG = Object.freeze({
    summary: settlementReadinessSummary,
    ensure: ensureProtoSettlement,
  });
  requestAnimationFrame(mainLoop);
}
const bootImplicitDebugBase = boot;
boot = function () {
  bootImplicitDebugBase();
  window.ALIFE_IMPLICIT_DEBUG = Object.freeze({
    summary: implicitSocietySummary,
    audit: implicitSocietyAudit,
    fixture: debugImplicitConflictFixture,
    updateEconomy: updateImplicitEconomy,
    schism: maybeFactionSchism,
    muster: updateEmergentMilitias,
  });
};
function debugVisualSummary() {
  if (!W) return null;
  const v = makePlanetVisualGenome(),
    e = W.tiles.elevation,
    liquid = W.tiles.liquid,
    models = W.activeIds
      .filter((id) => W.components.genome[id])
      .slice(0, 24)
      .map((id) => {
        const m = creatureModel(id);
        return {
          id,
          role: m.role,
          topology: m.topology,
          segments: m.segments,
          appendages: m.appendages,
          eyes: m.eyes,
          pattern: m.pattern,
          primaryHue: +m.primaryHue.toFixed(2),
        };
      }),
    featureCounts = { canopy: 0, highland: 0, cavern: 0, geothermal: 0, aquatic: 0, deposit: 0 };
  let water = 0,
    mountains = 0,
    min = 65535,
    max = 0,
    subsurface = 0,
    digest = 2166136261 >>> 0,
    featureDigest = 2166136261 >>> 0;
  for (let i = 0; i < W.tileCount; i++) {
    if (liquid[i] > 140) water++;
    if (e[i] > 860) mountains++;
    if (e[i] < min) min = e[i];
    if (e[i] > max) max = e[i];
    const type = W.tiles.featureType?.[i] || 0;
    if (type) featureCounts[FEATURE_CATEGORY[type]]++;
    if (W.tiles.subsurfaceType?.[i]) subsurface++;
    digest ^= (e[i] + liquid[i] * 3 + W.tiles.basePattern[i] * 17) >>> 0;
    digest = Math.imul(digest, 16777619) >>> 0;
    featureDigest ^=
      (type * 131 +
        (W.tiles.featureStrength?.[i] || 0) * 7 +
        (W.tiles.subsurfaceType?.[i] || 0) * 977) >>>
      0;
    featureDigest = Math.imul(featureDigest, 16777619) >>> 0;
  }
  const grammar = W.terrainGenome?.structureGenome;
  return {
    seed: W.seed,
    terrain: {
      topology: v.terrain.topology,
      climate: v.terrain.climate,
      alienness: v.alienness,
      waterTarget: v.terrain.targetWater,
      actualWater: water / W.tileCount,
      elevation: [min, max],
      mountains,
      digest: (digest >>> 0).toString(16).padStart(8, "0"),
    },
    structures: {
      counts: featureCounts,
      total: Object.values(featureCounts).reduce((a, b) => a + b, 0),
      subsurface,
      digest: (featureDigest >>> 0).toString(16).padStart(8, "0"),
      signature: grammar?.signature || "",
      forms: Object.values(grammar?.categories || {}).map((x) => ({
        category: x.category,
        name: x.name,
        form: x.form,
      })),
    },
    palette: {
      liquid: v.liquidHue,
      flora: v.floraHue,
      mineral: v.mineralHue,
      accent: v.accentHue,
      floraForm: v.floraForm,
      geologyForm: v.geologyForm,
      waterForm: v.waterForm,
    },
    models,
  };
}
function debugConstructionSummary() {
  if (!W) return null;
  const labor = [];
  for (const id of W.activeIds)
    if (
      W.kind[id] === KINDS.PERSON &&
      W.components.work?.[id]?.task &&
      W.components.work[id].task !== "idle" &&
      W.tick -
        (Number.isFinite(W.components.work[id].handledTick)
          ? W.components.work[id].handledTick
          : -Infinity) <=
        8
    ) {
      const w = W.components.work[id];
      labor.push({
        id,
        task: w.task,
        phase: w.phase,
        targetTile: w.targetTile,
        buildingId: w.buildingId,
        toolId: w.toolId,
      });
    }
  return {
    buildings: W.buildings
      .filter((b) => !b.ruined)
      .map((b) => ({
        id: b.id,
        type: b.type,
        x: b.x,
        y: b.y,
        stage: b.stage,
        progress: b.progress,
        complete: b.complete,
        integrity: b.integrity,
        maxIntegrity: b.maxIntegrity,
      })),
    labor,
  };
}
function debugInteriorSummary() {
  if (!W) return null;
  const priorCamera = { ...UI.camera },
    priorIds = ACTIVE_INTERIOR_IDS,
    priorState = ACTIVE_INTERIOR_STATE;
  UI.camera.cutaway = true;
  UI.camera.zoom = Math.max(5, UI.camera.zoom);
  ACTIVE_INTERIOR_IDS = new Set();
  const state = makeInteriorState({ x0: 0, x1: W.width - 1, y0: 0, y1: W.height - 1 }),
    seen = new Map();
  for (const ids of state.inside.values())
    for (const id of ids) seen.set(id, (seen.get(id) || 0) + 1);
  const result = {
    visible: state.visible.size,
    homes: Array.from(state.homes.entries())
      .filter(([id]) => state.visible.has(id))
      .map(([buildingId, ids]) => ({ buildingId, residents: ids.slice() })),
    inside: Array.from(state.inside.entries()).map(([buildingId, ids]) => ({
      buildingId,
      occupants: ids.slice(),
    })),
    duplicateOccupants: Array.from(seen)
      .filter(([, n]) => n > 1)
      .map(([id]) => id),
    invalidOccupants: Array.from(seen.keys()).filter(
      (id) => W.kind[id] !== KINDS.PERSON || !classifyAlive(id),
    ),
    capacityViolations: Array.from(state.homes.entries())
      .filter(([buildingId, ids]) => {
        const b = W.buildings.find((x) => x.id === buildingId);
        return b && ids.length > Math.max(1, b.housing);
      })
      .map(([id]) => id),
  };
  UI.camera = priorCamera;
  ACTIVE_INTERIOR_IDS = priorIds;
  ACTIVE_INTERIOR_STATE = priorState;
  return result;
}
function debugCombatSummary() {
  if (!W) return null;
  const state = makeCombatVisualState({ x0: 0, x1: W.width - 1, y0: 0, y1: W.height - 1 });
  return {
    window: state.window,
    recent: state.events.map((x) => ({
      id: x.e.id,
      type: x.e.type,
      tick: x.e.tick,
      location: x.e.location,
      subjects: x.e.subjects.slice(),
      combat: x.combat,
      death: x.death,
    })),
    actors: Array.from(state.actors.entries()).map(([id, x]) => ({
      id,
      role: x.role,
      eventId: x.event.id,
    })),
    wars: W.activeWars
      .filter((w) => !w.ended)
      .map((w) => ({
        id: w.id,
        a: w.a,
        b: w.b,
        casualties: w.casualties,
        lastEventId: w.lastEventId || 0,
      })),
  };
}
const debugCombatSummaryEventBase = debugCombatSummary;
debugCombatSummary = function () {
  const out = debugCombatSummaryEventBase();
  if (!out) return out;
  const now = performance.now();
  out.realtime = (UI.combatVisuals || [])
    .filter((v) => v.world === W && now - v.started < v.duration)
    .map((v) => ({
      attacker: v.attacker,
      victim: v.victim,
      damage: v.damage,
      lethal: v.lethal,
      style: v.style,
      remaining: Math.max(0, Math.round(v.duration - (now - v.started))),
    }));
  return out;
};
function debugPredationDemo(lethal = true) {
  const attacker = W?.activeIds.find((id) => W.kind[id] === KINDS.PREDATOR && classifyAlive(id)),
    victim = W?.activeIds.find((id) => W.kind[id] === KINDS.HERBIVORE && classifyAlive(id));
  if (!attacker || !victim) return { ok: false, reason: "predator or prey unavailable" };
  const ap = W.components.position[attacker],
    vp = W.components.position[victim];
  vp.x = clamp(ap.x + 1, 0, W.width - 1);
  vp.y = ap.y;
  vp.regionId = regionId(vp.x, vp.y);
  W.components.life[attacker].lastAttackTick = W.tick - 10;
  if (lethal)
    W.components.life[victim].integrity = Math.min(W.components.life[victim].integrity, 24);
  rebuildSpatialBins();
  const before = W.events.length,
    hit = performHunt(attacker, [victim]);
  resolveEffects();
  const visual = debugCombatSummary().realtime.find(
      (v) => v.attacker === attacker && v.victim === victim,
    ),
    injury = W.events
      .slice(before)
      .find(
        (event) =>
          event.type === "InjuryEvent" &&
          event.subjects[0] === victim &&
          event.subjects[1] === attacker,
      ),
    splatters = (W.fluidSplatters || []).filter(
      (splatter) => splatter.victimId === victim && splatter.eventId === injury?.id,
    );
  return {
    ok: !!hit && !!visual && !!injury?.data?.bodyPart && splatters.length > 0,
    attacker,
    victim,
    lethal: W.kind[victim] === KINDS.CORPSE,
    events: W.events.slice(before).map((e) => e.type),
    bodyPart: injury?.data?.bodyPart || "",
    severed: !!injury?.data?.limbLostEventId,
    fluidSplatters: splatters.length,
    bloodLost: injury?.data?.bloodLost || 0,
    fluid: splatters.map((splatter) => ({
      amount: splatter.amount,
      lifeTicks: splatter.lifeTicks,
      severed: splatter.severed,
      gorePile: splatter.gorePile,
      source: splatter.source,
    })),
    visual,
  };
}
function debugCameraProjection(angle = -0.73, tilt = 0.47) {
  if (!W) return null;
  const view = UI.view,
    camera = { ...UI.camera };
  UI.view = "oblique";
  UI.camera.angle = angle;
  UI.camera.tilt = tilt;
  UI.camera.zoom = 7.5;
  UI.camera.x = W.width * 0.47;
  UI.camera.y = W.height * 0.53;
  const m = projectionMetrics(),
    points = [
      [UI.camera.x, UI.camera.y],
      [UI.camera.x + 3.25, UI.camera.y - 2.75],
      [UI.camera.x - 5.5, UI.camera.y + 4.125],
    ],
    roundTrips = points.map(([x, y]) => {
      const screen = projectWithMetrics(x, y, 0, m),
        world = cameraWorldAtScreen(screen.x, screen.y);
      return { x, y, screen, world, error: Math.hypot(world.x - x, world.y - y) };
    }),
    maxError = Math.max(...roundTrips.map((x) => x.error));
  UI.view = view;
  UI.camera = camera;
  return { angle, tilt, maxError, roundTrips };
}
function debugSimsCameraProbe() {
  if (!W) return null;
  const saved = {
      view: UI.view,
      camera: { ...UI.camera },
      motion: { ...UI.cameraMotion },
      keys: new Set(UI.keys),
      pointerInside: UI.pointerInside,
      lastPointer: { ...UI.lastPointer },
      followId: UI.followId,
    },
    beforeHash = worldHash();
  UI.view = "oblique";
  UI.camera = {
    x: W.width / 2,
    y: W.height / 2,
    zoom: 5,
    angle: -0.35,
    tilt: 0.58,
    cutaway: false,
    edgeScroll: false,
  };
  UI.cameraMotion = { x: 0, y: 0, orbit: 0, tilt: 0 };
  UI.keys = new Set(["w", "d", "e"]);
  const start = { ...UI.camera };
  updateCameraKeys(180);
  const afterKeys = { ...UI.camera };
  UI.keys.clear();
  updateCameraKeys(90);
  const afterGlide = { ...UI.camera };
  UI.camera = { ...start, edgeScroll: true };
  UI.cameraMotion = { x: 0, y: 0, orbit: 0, tilt: 0 };
  UI.pointerInside = true;
  const m = projectionMetrics();
  UI.lastPointer = { x: m.w - 1, y: m.h / 2 };
  updateCameraKeys(180);
  const afterEdge = { ...UI.camera },
    result = {
      keyboardMove: Math.hypot(afterKeys.x - start.x, afterKeys.y - start.y),
      keyboardOrbit: Math.abs(afterKeys.angle - start.angle),
      inertiaMove: Math.hypot(afterGlide.x - afterKeys.x, afterGlide.y - afterKeys.y),
      edgeMove: Math.hypot(afterEdge.x - start.x, afterEdge.y - start.y),
      hashIsolated: beforeHash === worldHash(),
    };
  UI.view = saved.view;
  UI.camera = saved.camera;
  UI.cameraMotion = saved.motion;
  UI.keys = saved.keys;
  UI.pointerInside = saved.pointerInside;
  UI.lastPointer = saved.lastPointer;
  UI.followId = saved.followId;
  refreshCameraControls();
  return result;
}
window.ALIFE_VISUAL_DEBUG = Object.freeze({
  summary: debugVisualSummary,
  constructionSummary: debugConstructionSummary,
  interiorSummary: debugInteriorSummary,
  combatSummary: debugCombatSummary,
  cameraProjection: debugCameraProjection,
  renderIsolation: (now) => {
    const before = worldHash(),
      beforeState = Object.fromEntries(
        Object.keys(W).map((key) => [key, JSON.stringify(W[key], saveReplacer)]),
      );
    renderWorld(now || 0);
    const after = worldHash(),
      changedKeys = Object.keys(W)
        .filter((key) => beforeState[key] !== JSON.stringify(W[key], saveReplacer))
        .filter((key) => !["hash", "spatialBins"].includes(key))
        .sort();
    return { ok: before === after, before, after, changedKeys };
  },
  renderOnly: (options = {}) => {
    const before = options.audit ? worldHash() : "",
      beforeState = options.audit
        ? Object.fromEntries(
            Object.keys(W).map((key) => [key, JSON.stringify(W[key], saveReplacer)]),
          )
        : null,
      beforeComponents = options.audit
        ? Object.fromEntries(
            Object.keys(W.components).map((key) => [
              key,
              JSON.stringify(W.components[key], saveReplacer),
            ]),
          )
        : null;
    UI.view = options.view || "top";
    UI.quality = options.quality || "high";
    if (options.overlay !== undefined) UI.overlay = options.overlay;
    UI.camera.x = options.x ?? W.width / 2;
    UI.camera.y = options.y ?? W.height / 2;
    UI.camera.zoom = options.zoom ?? 1;
    UI.camera.angle = options.angle ?? cameraAngle();
    UI.camera.tilt = options.tilt ?? cameraTilt();
    UI.camera.cutaway = options.cutaway ?? !!UI.camera.cutaway;
    renderWorld(options.now || 1234);
    if (!options.audit) return true;
    const after = worldHash(),
      changedKeys = Object.keys(W)
        .filter((key) => beforeState[key] !== JSON.stringify(W[key], saveReplacer))
        .filter((key) => !["hash", "spatialBins"].includes(key))
        .sort(),
      changedComponentStores = Object.keys(W.components)
        .filter((key) => beforeComponents[key] !== JSON.stringify(W.components[key], saveReplacer))
        .sort();
    return { ok: before === after, before, after, changedKeys, changedComponentStores };
  },
  renderFrame: (options = {}) => {
    window.ALIFE_VISUAL_DEBUG.renderOnly(options);
    return {
      world: debugVisualSummary(),
      construction: debugConstructionSummary(),
      interiors: debugInteriorSummary(),
      combat: debugCombatSummary(),
    };
  },
  model: (id) => {
    const m = creatureModel(id);
    return { ...m };
  },
  portrait: (id) => {
    mountCreaturePortrait(id);
    return true;
  },
  biomeName: (i) => biomeDisplayName(i),
});
window.ALIFE_CONTROL_DEBUG = Object.freeze({
  setSpeed,
  setRunning: (value) => {
    UI.running = !!value;
    if (UI.running) UI.clockInterrupted = false;
  },
  resetClock: () => (accumulator = 0),
  advanceClock: (dt, budgetMs = 10000) => runSimulationClock(dt, budgetMs),
  cameraState: () => ({ ...UI.camera }),
  worldAt: (x, y) => cameraWorldAtScreen(x, y),
  zoomAt: (factor, x, y) => zoomCamera(factor, x, y),
  orbit: (angle, tilt = 0) => orbitCamera(angle, tilt),
  cutaway: (value) => toggleCutaway(value),
  createCivicTestScenario: debugCreateCivicScenario,
  setCityPriority: (kind, id, key, value) => setCityPriority(kind, id, key, value, true),
  setCityPolicy: (kind, id, policy) => setCityPolicy(kind, id, policy, true),
  planBuilding: (kind, id, type) => requestCityBuilding(kind, id, type, true),
  induceSurfaceFloodForTest,
  collapseKindForTest,
  armFollowedDeathForTest,
  controlState: () => ({
    running: UI.running,
    interrupted: !!UI.clockInterrupted,
    followId: UI.followId,
    selectedEntity: UI.selectedEntity,
    accumulator,
    tick: W?.tick || 0,
    population: populationSummary(),
  }),
});
function debugCameraGlideProbe() {
  if (!W) return null;
  const saved = { view: UI.view, camera: { ...UI.camera } },
    beforeHash = worldHash();
  CAMERA_GLIDE.zoom = null;
  CAMERA_GLIDE.px = null;
  CAMERA_GLIDE.py = null;
  CAMERA_GLIDE.angle = null;
  CAMERA_GLIDE.last = 0;
  UI.view = "oblique";
  UI.camera = {
    x: W.width / 2,
    y: W.height / 2,
    zoom: 1.4,
    angle: -0.35,
    tilt: 0.6,
    cutaway: false,
    edgeScroll: false,
  };
  const z0 = UI.camera.zoom;
  zoomCamera(2.4, 480, 360);
  let t = 9e6;
  for (let n = 0; n < 60; n++) {
    t += 33;
    renderWorld(t);
  }
  const z1 = UI.camera.zoom;
  orbitCameraEased(0.9);
  const a0 = cameraAngle();
  for (let n = 0; n < 60; n++) {
    t += 33;
    renderWorld(t);
  }
  const a1 = cameraAngle(),
    motionEntries = VISUAL_MOTION.size,
    result = {
      zoomStart: z0,
      zoomEnd: z1,
      zoomTargetReached: Math.abs(z1 - clamp(z0 * 2.4, 0.16, 36)) < 0.02,
      orbitStart: a0,
      orbitEnd: a1,
      orbitDelta: Math.abs(a1 - a0),
      motionEntries,
      hashIsolated: beforeHash === worldHash(),
    };
  CAMERA_GLIDE.zoom = null;
  CAMERA_GLIDE.px = null;
  CAMERA_GLIDE.py = null;
  CAMERA_GLIDE.angle = null;
  UI.view = saved.view;
  UI.camera = saved.camera;
  refreshCameraControls();
  return result;
}
window.ALIFE_CAMERA_DEBUG = Object.freeze({
  probe: debugSimsCameraProbe,
  glide: debugCameraGlideProbe,
  state: () => ({
    camera: { ...UI.camera },
    motion: { ...UI.cameraMotion },
    keys: Array.from(UI.keys),
    pointerInside: UI.pointerInside,
    dragMode: UI.dragMode,
  }),
});
window.ALIFE_PREDATION_DEBUG = Object.freeze({
  demo: debugPredationDemo,
  summary: debugCombatSummary,
});
function stageConsistencyAudit() {
  if (!W) return { ok: false, failures: ["no active world"] };
  const priorTab = UI.activeTab,
    authority = normalizeCivilizationAuthority(),
    summary = civilizationSummary();
  UI.activeTab = "worldinfo";
  refreshUI(true);
  const expected = titleCase(authority.stage),
    failures = [];
  if (summary.stage !== authority.stage || summary.stageIndex !== authority.stageIndex)
    failures.push("civilization summary disagrees with authoritative stage");
  if (authority.stageIndex > 0 && DOM.topEpoch.textContent !== expected)
    failures.push(`header shows ${DOM.topEpoch.textContent} while authority is ${expected}`);
  if (!DOM.worldPane.innerHTML.includes(`<b>${esc(expected)}</b>`))
    failures.push(`World progression panel does not show ${expected}`);
  if (UI.lastCivilizationStageIndex !== authority.stageIndex)
    failures.push("UI refresh stamp trails authoritative stage");
  UI.activeTab = priorTab;
  return {
    ok: !failures.length,
    failures,
    tick: W.tick,
    stage: authority.stage,
    stageIndex: authority.stageIndex,
    header: DOM.topEpoch.textContent,
    next: CIV_STAGE_ORDER[authority.stageIndex + 1] || null,
  };
}
window.ALIFE_STAGE_DEBUG = Object.freeze({ audit: stageConsistencyAudit });
window.ALIFE_CAUSAL_SKIP_DEBUG = Object.freeze({
  plan: () => (W ? makeCausalSkipState() : null),
  run: runCausalSkipForDebug,
});
window.ALIFE_SAVE_DEBUG = Object.freeze({
  save: (slot = "test", name = "Test archive", quiet = true) => saveWorld(slot, name, quiet),
  load: (slot) => loadWorld(slot),
  remove: (slot) => deleteSave(slot),
  list: () => saveList(),
  status: () => ({ autosaveWriteBlocked, autosaveWarningShown, autosaveInFlight }),
  codecProbe: debugSaveCodecProbe,
  loadRollbackProbe: debugLoadRollbackProbe,
  saveSwitchProbe: debugSaveSwitchProbe,
  indexRecoveryProbe: debugSaveIndexRecoveryProbe,
  eventRetentionProbe: debugEventRetentionProbe,
});
