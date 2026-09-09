// ═══════════════════════════════════════════════════════════════════════════
// 79. CAUSAL PUSH — the skip aims at the next objective and tilts the odds
// ═══════════════════════════════════════════════════════════════════════════
// Causal skip used to run real ticks under a general concerted effort (food,
// safety, faster inquiry) and hope the next micro-milestone fell inside an
// eight-second search. On a standard world that is a few hundred ticks, and
// the milestone rarely came. Here the skip knows what it is seeking. The
// pending micro-stage becomes the concerted target, and every push nudges the
// causes that lead to it: the research path toward a missing process gets its
// focus, its samples, its facility, and a chance of insight; a missing building
// gets planned and its rare inputs delivered to the stores; a thin band gets
// food and shorter rest between births; a camp that qualifies gets its
// founding. Nothing is invented and matter stays conserved (every unit added
// is booked as player input); the pushes only raise the probability of what
// the world was already able to do, and they escalate the longer the
// objective holds out. Micro-stages continue past the terrestrial stages into
// the ages: astronomy, the observatory, starflight, the launch tower, and the
// first ship away. The button runs until the milestone or the horizon, shows
// what it seeks, and can be stopped.
const CAUSAL_PUSH_STORE_DRAWN = () => [C.PIGMENT, C.INFO, C.ORE, C.CRYSTAL];
function causalPushInput(n) {
  if (n > 0) W.conservation.playerInput += n;
}
function causalTarget() {
  return W?.civilization?.concertedTarget || null;
}
function setCausalTarget(stage) {
  if (!W?.civilization) return null;
  const current = W.civilization.concertedTarget;
  if (!stage) {
    W.civilization.concertedTarget = null;
    return null;
  }
  if (current?.key === stage.key) return current;
  W.civilization.concertedTarget = { key: stage.key, label: stage.label, since: W.tick, pushes: 0 };
  return W.civilization.concertedTarget;
}
// The town closest to the next stage: fewest shortfalls, then most built.
function causalLeadSettlement() {
  const living = W.settlements.filter((s) => !s.ruined);
  if (!living.length) return null;
  const next = CIV_STAGE_ORDER[normalizeCivilizationAuthority().stageIndex + 1];
  return living
    .map((s) => ({
      s,
      missing: next ? settlementStageShortfall(s, next).length : 0,
      built: completedBuildings(s).length + activeBuildings(s).length,
      known: s.knownProcesses.length,
    }))
    .sort(
      (a, b) => a.missing - b.missing || b.known - a.known || b.built - a.built || a.s.id - b.s.id,
    )[0].s;
}
// The first process on the way to a technology that the town does not know yet.
function causalNextStep(place, techId, seen = new Set()) {
  if (!place || place.knownProcesses.includes(techId) || seen.has(techId)) return null;
  seen.add(techId);
  const tech = technologyDefinition(techId);
  if (!tech) return null;
  for (const prior of tech.prior || []) {
    const step = causalNextStep(place, prior, seen);
    if (step) return step;
  }
  return tech;
}
function causalPushBuilding(place, type, pushes) {
  if (!place || !BUILDING_DEFS[type]) return false;
  const kind = place.knownProcesses ? "settlement" : "camp",
    // A town with one finished field and a second one planned was told it
    // already had a field, and the planned one never got its material. A push
    // works on the unfinished one wherever there is one.
    standing = W.buildings.filter(
      (b) => !b.ruined && b.placeKind === kind && b.placeId === place.id && b.type === type,
    ),
    existing = standing.find((b) => !b.complete) || standing[0];
  if (existing?.complete) return false;
  const b = existing || planBuilding(place, type, 9);
  if (!b) return false;
  const missing = missingBuildingMaterial(b);
  if (!missing) return true;
  const rare = CAUSAL_PUSH_STORE_DRAWN().includes(missing.sp);
  if (rare || pushes >= 3) {
    // Rare inputs reach the stores, where builders now fetch them; a push that
    // has gone on for a while places common material at the work face itself.
    const store = !rare && pushes >= 3 ? b.composition : place.inventory,
      amount = Math.min(
        missing.needed,
        rare ? missing.needed : 24,
        65535 - (store[missing.sp] || 0),
      );
    if (amount > 0) {
      store[missing.sp] = (store[missing.sp] || 0) + amount;
      causalPushInput(amount);
      if (store === b.composition) refreshBuildingStage(b);
    }
  }
  return true;
}
function causalPushResearch(place, techId, pushes) {
  if (!place?.knownProcesses) return false;
  const step = causalNextStep(place, techId);
  if (!step) return false;
  const facility = facilityForTechnology(step.id);
  if (facility && !placeHasFacility(place, facility)) causalPushBuilding(place, facility, pushes);
  if ((step.heat || 0) >= 500 && !placeHasFacility(place, "kiln"))
    causalPushBuilding(place, "kiln", pushes);
  else if ((step.heat || 0) > 0 && !placeHasFacility(place, "hearth"))
    causalPushBuilding(place, "hearth", pushes);
  place.researchInventory = place.researchInventory || new Uint16Array(SPECIES_COUNT);
  for (const sp of step.materials || []) {
    const want = 12 - (place.researchInventory[sp] || 0);
    if (want > 0) {
      place.researchInventory[sp] += want;
      causalPushInput(want);
    }
  }
  // Ore Reduction wants ore in hand before anyone thinks of it.
  if (step.id === "metalworking" && (place.inventory[C.ORE] || 0) < 4) {
    place.inventory[C.ORE] = (place.inventory[C.ORE] || 0) + 6;
    causalPushInput(6);
  }
  place.researchProgress = place.researchProgress || {};
  place.researchFocus = step.id;
  // A chance of insight, growing with every push the objective holds out against.
  const threshold = researchThreshold(step),
    progress = place.researchProgress[step.id] || 0,
    chance = clamp(0.3 + pushes * 0.06, 0.3, 0.85);
  if (
    progress < threshold * 0.95 &&
    counterRand("causal-insight", W.tick, place.id, step.id) < chance
  )
    place.researchProgress[step.id] = Math.min(threshold * 0.95, progress + threshold * 0.08);
  return true;
}
function causalPushPopulation(centerTile, radius = 10) {
  if (centerTile < 0) return;
  // Deposited at once and booked exactly, so the audit balances mid-skip.
  if (tileFood(centerTile, "omnivore") < 20)
    causalPushInput(depositTileMatter(centerTile, C.ORGANIC, 40));
  if (tileMoisture(centerTile) < 40) causalPushInput(depositTileMatter(centerTile, C.SOLVENT, 60));
  let eased = 0;
  for (const id of entityAtRadius(centerTile, radius, KINDS.PERSON)) {
    if (eased >= 6 || !classifyAlive(id)) continue;
    const r = W.components.reproduction[id];
    if (r && r.cooldown > 0) {
      r.cooldown = Math.floor(r.cooldown * 0.5);
      eased++;
    }
  }
}
// The largest band of people with no camp or town near them.
function causalBandTile() {
  const cells = new Map();
  for (const id of W.activeIds) {
    if (W.kind[id] !== KINDS.PERSON || !classifyAlive(id)) continue;
    const p = W.components.position[id],
      key = (p.y >> 4) * 4096 + (p.x >> 4),
      c = cells.get(key) || { x: 0, y: 0, n: 0, ids: [] };
    c.x += p.x;
    c.y += p.y;
    c.n++;
    c.ids.push(id);
    cells.set(key, c);
  }
  const bands = [...cells.values()]
    .filter((c) => c.n >= 3)
    .map((c) => ({ x: Math.round(c.x / c.n), y: Math.round(c.y / c.n), n: c.n, ids: c.ids }))
    .sort((a, b) => b.n - a.n || a.x - b.x);
  for (const band of bands) {
    const near = [
      ...W.camps.filter((c) => c.active),
      ...W.settlements.filter((s) => !s.ruined),
    ].some((q) => dist2(q.x, q.y, band.x, band.y) <= 484);
    if (!near)
      return { tile: idx(clamp(band.x, 0, W.width - 1), clamp(band.y, 0, W.height - 1)), band };
  }
  return bands[0]
    ? {
        tile: idx(clamp(bands[0].x, 0, W.width - 1), clamp(bands[0].y, 0, W.height - 1)),
        band: bands[0],
        placed: true,
      }
    : null;
}
function causalPushCamp(pushes) {
  const found = causalBandTile();
  if (!found || found.placed) return false;
  const { tile, band } = found;
  causalPushPopulation(tile, 6);
  if (W.tiles.liquid[tile] > WATER_DEPTH.SURFACE) return false;
  if (counterRand("causal-camp", W.tick, tile) < clamp(0.35 + pushes * 0.1, 0.35, 0.9)) {
    const founder = band.ids.sort((a, b) => a - b)[0];
    queueEffect(
      "CreateCamp",
      { tile, founderId: founder, causeEvent: W.causalIndex.tile[tile] || 0 },
      founder,
    );
    return true;
  }
  return false;
}
function causalBestCamp() {
  return W.camps
    .filter((c) => c.active)
    .map((c) => ({
      c,
      people: entityAtRadius(idx(c.x, c.y), 6, KINDS.PERSON).filter(classifyAlive).length,
    }))
    .sort((a, b) => b.people - a.people || a.c.id - b.c.id)[0];
}
function causalPushTool(pushes) {
  const place = causalLeadSettlement() || causalBestCamp()?.c;
  if (!place) return false;
  for (const [sp, amount] of [
    [C.MINERAL, 12],
    [C.FIBER, 8],
    [C.ORGANIC, 6],
  ]) {
    place.inventory[sp] = (place.inventory[sp] || 0) + amount;
    causalPushInput(amount);
  }
  const maker = entityAtRadius(idx(place.x, place.y), 6, KINDS.PERSON).filter(classifyAlive)[0];
  if (maker && pushes >= 1) {
    const inv = W.components.inventory[maker]?.materials;
    if (inv) {
      inv[C.MINERAL] += 6;
      inv[C.FIBER] += 4;
      causalPushInput(10);
    }
  }
  return true;
}
function causalPushSettlement(pushes) {
  const best = causalBestCamp();
  if (!best) return causalPushCamp(pushes);
  const camp = best.c;
  for (const type of ["stockpile", "shelter", "hearth"])
    if (!completedBuildings(camp, type).length) causalPushBuilding(camp, type, pushes);
  camp.stableTicks = Math.max(camp.stableTicks || 0, 300);
  if (best.people < 5) causalPushPopulation(idx(camp.x, camp.y), 8);
  return true;
}
// One push toward the current objective.
function causalPushToward(target = causalTarget()) {
  if (!target || !W) return null;
  target.pushes = (target.pushes || 0) + 1;
  const pushes = target.pushes,
    lead = causalLeadSettlement(),
    leadTile = lead ? idx(lead.x, lead.y) : -1,
    research = (tech) => lead && causalPushResearch(lead, tech, pushes),
    building = (type) => lead && causalPushBuilding(lead, type, pushes);
  switch (target.key) {
    case "first":
    case "pair":
    case "band":
    case "viable": {
      const found = causalBandTile();
      causalPushPopulation(found ? found.tile : leadTile, 12);
      return "population";
    }
    case "camp":
      return causalPushCamp(pushes) ? "camp" : "band";
    case "tool":
      return causalPushTool(pushes) ? "tool" : null;
    case "shelter":
    case "stockpile": {
      const place = lead || causalBestCamp()?.c;
      return place && causalPushBuilding(place, target.key, pushes) ? target.key : null;
    }
    case "settlement":
      return causalPushSettlement(pushes) ? "settlement" : null;
    case "first-structure":
    case "second-structure":
    case "third-structure":
    case "eight": {
      if (!lead) return null;
      ensurePlacePlans(lead);
      let pushed = 0;
      for (const b of activeBuildings(lead).slice(0, 3))
        if (causalPushBuilding(lead, b.type, pushes)) pushed++;
      if (!pushed) causalPushBuilding(lead, "shelter", pushes);
      return "structures";
    }
    case "faction":
      return lead ? "faction" : null;
    case "records":
      return research(lead?.knownProcesses.includes("governance") ? "writing" : "writing")
        ? "research"
        : null;
    case "hall-started":
      if (lead && !lead.knownProcesses.includes("governance"))
        return research("governance") ? "research" : null;
      return building("hall") ? "hall" : null;
    case "hall":
      return building("hall") ? "hall" : null;
    case "clinic":
      if (lead && !lead.knownProcesses.includes("medicine"))
        return research("medicine") ? "research" : null;
      return building("clinic") ? "clinic" : null;
    case "metro":
      causalPushPopulation(leadTile, 12);
      return "population";
    case "center":
      building("hall");
      if (lead && !lead.knownProcesses.includes("medicine")) research("medicine");
      else building("clinic");
      return "center";
    case "metalworking":
    case "mechanization":
    case "astronomy":
    case "starflight":
      return research(target.key) ? "research" : null;
    case "stewardship":
      return research("planetary_stewardship") ? "research" : null;
    case "electricity":
      return research("electricity") ? "research" : null;
    case "waterworks":
      if (lead && !lead.knownProcesses.includes("waterworks"))
        return research("waterworks") ? "research" : null;
      return building("waterworks") ? "waterworks" : null;
    case "observatory":
      if (
        lead &&
        !(lead.knownProcesses.includes("writing") && lead.knownProcesses.includes("navigation"))
      )
        return research(lead.knownProcesses.includes("writing") ? "navigation" : "writing")
          ? "research"
          : null;
      return building("observatory") ? "observatory" : null;
    case "tower":
      if (lead)
        for (const t of typeof STARFLIGHT_GROUNDWORK !== "undefined"
          ? STARFLIGHT_GROUNDWORK
          : ["astronomy", "mechanization", "planetary_stewardship"])
          if (!lead.knownProcesses.includes(t)) return research(t) ? "research" : null;
      return building("launch_tower") ? "tower" : null;
    case "ascension":
      if (lead && !lead.knownProcesses.includes("starflight"))
        return research("starflight") ? "research" : null;
      if (lead && lead.stability < 0.4) lead.stability = clamp(lead.stability + 0.03, 0, 1);
      return "ascension";
    default:
      return null;
  }
}
// ── Micro-stages continue into the ages ────────────────────────────────────────
const causalSkipMicroStagesBase = causalSkipMicroStages;
causalSkipMicroStages = function () {
  const stages = causalSkipMicroStagesBase();
  if (stages.length) return stages;
  const towns = () => W.settlements.filter((s) => !s.ruined),
    knows = (t) => towns().some((s) => s.knownProcesses.includes(t)),
    has = (type) => towns().some((s) => completedBuildings(s, type).length > 0);
  return [
    { key: "astronomy", label: "Astronomy", done: () => knows("astronomy") },
    { key: "observatory", label: "a completed Observatory", done: () => has("observatory") },
    { key: "starflight", label: "Starflight", done: () => knows("starflight") },
    { key: "tower", label: "a completed Launch tower", done: () => has("launch_tower") },
    {
      key: "ascension",
      label: "the first ship away",
      done: () => !!W.lastEventByType?.AscensionEvent,
    },
  ];
};
// ── The skip records its objective and pushes toward it ────────────────────────
const makeCausalSkipStatePushBase = makeCausalSkipState;
makeCausalSkipState = function (limitOverride = 0) {
  const state = makeCausalSkipStatePushBase(limitOverride);
  setCausalTarget(state.pending[0] || null);
  state.target = state.pending[0]?.key || "";
  if (W.civilization)
    W.civilization.concertedEffortLevel = Math.max(2, W.civilization.concertedEffortLevel || 0);
  return state;
};
const causalSkipIntervenePushBase = causalSkipIntervene;
causalSkipIntervene = function () {
  causalSkipIntervenePushBase();
  const target = causalTarget();
  if (target) causalPushToward(target);
};
// When the skip ends, the concerted effort fades quickly instead of running on
// for the rest of the horizon, and the objective is released.
function finishCausalPush() {
  if (!W?.civilization) return;
  W.civilization.concertedEffortUntil = Math.min(
    W.civilization.concertedEffortUntil || 0,
    W.tick + 256,
  );
  setCausalTarget(null);
}
const runCausalSkipForDebugPushBase = runCausalSkipForDebug;
runCausalSkipForDebug = function (limit = 0) {
  const result = runCausalSkipForDebugPushBase(limit);
  finishCausalPush();
  return result;
};
// ── The button: seek until the milestone, show the aim, allow a stop ───────────
causalSkipForward = async function () {
  if (!W) return;
  if (UI.causalSkipActive) {
    UI.causalSkipCancel = true;
    if (DOM.causalSkipBtn) DOM.causalSkipBtn.textContent = "⏩ Stopping…";
    return;
  }
  togglePause(false);
  UI.clockInterrupted = false;
  UI.causalSkipActive = true;
  UI.causalSkipCancel = false;
  const state = makeCausalSkipState(),
    aim = state.pending[0]?.label || "the next epoch boundary",
    started = performance.now();
  DOM.causalSkipBtn.disabled = false;
  DOM.causalSkipBtn.textContent = "■ Stop skip";
  DOM.causalSkipStatus.textContent = `Seeking ${aim} within ${state.limit.toLocaleString()} future ticks…`;
  try {
    while (!state.done) {
      const frameStart = performance.now(),
        frameBudget = UI.quality === "low" ? 24 : 16;
      do {
        causalSkipStep(state);
      } while (!state.done && performance.now() - frameStart < frameBudget);
      if (UI.causalSkipCancel && !state.done) {
        state.done = true;
        state.stopReason = "stopped";
      }
      refreshTopbar();
      DOM.causalSkipStatus.textContent = `Seeking ${aim} · ${state.advanced.toLocaleString()} of ${state.limit.toLocaleString()} ticks · ${Math.round((performance.now() - started) / 1000)}s`;
      if (!state.done)
        await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
    }
    finishCausalPush();
    worldHash();
    refreshUI(true);
    renderWorld(performance.now());
    const result = causalSkipResult(state),
      gate = ["horizon", "stopped"].includes(state.stopReason) ? civilizationGateStatus() : null,
      ticks = state.advanced.toLocaleString(),
      message =
        state.stopReason === "epoch"
          ? `Reached ${epochName()} after ${ticks} causal ticks.`
          : state.milestone
            ? `Reached ${state.milestone.label || causalSkipEventLabel(state.milestone)} after ${ticks} causal ticks.`
            : state.stopReason === "interrupted"
              ? `Stopped after ${ticks} ticks because followed life ended.`
              : state.stopReason === "stopped"
                ? `Stopped after ${ticks} ticks; ${aim} not yet reached.`
                : gate && gate.missing.length
                  ? `Advanced ${ticks} causal ticks toward ${aim}; ${gate.leader ? `${gate.leader} still needs: ` : "next: "}${gate.missing.join(" · ")}.`
                  : `Advanced ${ticks} causal ticks; ${aim} did not occur inside this horizon.`;
    const told = result.toll > 0 ? `${message} ${result.toll} fewer people than when it began.` : message;
    DOM.causalSkipStatus.textContent = told;
    toast(told);
    return result;
  } finally {
    UI.causalSkipActive = false;
    UI.causalSkipCancel = false;
    DOM.causalSkipBtn.disabled = false;
    DOM.causalSkipBtn.textContent = "⏩ Causal skip";
  }
};
// The frozen debug surface from the bootstrap captured the old function values.
window.ALIFE_CAUSAL_SKIP_DEBUG = Object.freeze({
  plan: () => (W ? makeCausalSkipState() : null),
  run: (limit = 0) => runCausalSkipForDebug(limit),
});
window.ALIFE_CAUSAL_PUSH_DEBUG = Object.freeze({
  target: () => (causalTarget() ? { ...causalTarget() } : null),
  stages: () =>
    causalSkipMicroStages().map((s) => ({ key: s.key, label: s.label, done: s.done() })),
  lead: () => causalLeadSettlement()?.name || null,
  nextStep: (settlementId, techId) =>
    causalNextStep(
      W.settlements.find((s) => s.id === settlementId),
      techId,
    )?.id || null,
  push: (key = null) => {
    const stages = causalSkipMicroStages(),
      stage = key ? stages.find((s) => s.key === key) : stages.find((s) => !s.done());
    if (!stage) return null;
    setCausalTarget(stage);
    return causalPushToward(causalTarget());
  },
  finish: () => finishCausalPush(),
});
