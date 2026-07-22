// ═══════════════════════════════════════════════════════════════════════════
// 35X. ENVIRONMENT CONSUMPTION, REGROWTH, AND EMERGENT ARMAMENT
// Harvest work consumes the physical features it draws from; living groves
// regrow from the plant substrate while mineral formations deplete forever.
// Weapon craft emerges implicitly from each settlement's known processes.
// ═══════════════════════════════════════════════════════════════════════════
const extractMatterFeatureBase = extractMatter;
extractMatter = function (personId, tile, s) {
  const got = extractMatterFeatureBase(personId, tile, s);
  if (got > 0 && W.tiles.featureType && W.tiles.featureType[tile]) {
    const type = W.tiles.featureType[tile],
      living = type === TERRAIN_FEATURE.CANOPY || type === TERRAIN_FEATURE.AQUATIC,
      mineral = s === C.MINERAL || s === C.ORE || s === C.CRYSTAL || s === C.CATALYST,
      organic = s === C.ORGANIC || s === C.FIBER || s === C.FUEL;
    if ((living && organic) || (!living && mineral)) {
      const strength = W.tiles.featureStrength[tile],
        drop = Math.min(strength, got * (living ? 4 : 3));
      W.tiles.featureStrength[tile] = strength - drop;
      if (W.tiles.featureStrength[tile] <= 24) {
        W.tiles.featureStrength[tile] = 0;
        W.tiles.featureType[tile] = 0;
      }
    }
  }
  return got;
};
function updateFeatureEcology() {
  if (!W.tiles.featureType) return;
  const t = W.tiles;
  if (W.tick % 64 === 0) {
    const people = biospherePopulation(KINDS.PERSON);
    for (let i = 0; i < W.tileCount; i++) {
      const type = t.featureType[i];
      if (!type) continue;
      const living = type === TERRAIN_FEATURE.CANOPY || type === TERRAIN_FEATURE.AQUATIC;
      if (living) {
        if (t.fire[i] > 200) t.featureStrength[i] = Math.max(0, t.featureStrength[i] - 120);
        else if (t.featureStrength[i] < 1000 && t.plantOrder[i] > 260)
          t.featureStrength[i] = Math.min(1000, t.featureStrength[i] + 7);
        if (t.featureStrength[i] <= 0) t.featureType[i] = 0;
      } else {
        if (people < 10 && t.featureStrength[i] > 0 && t.featureStrength[i] < 1000)
          t.featureStrength[i] = Math.min(1000, t.featureStrength[i] + 4);
        if (t.featureStrength[i] <= 0) t.featureType[i] = 0;
      }
    }
  }
  if (W.tick % 256 === 0)
    for (let i = 0; i < W.tileCount; i++) {
      if (t.featureType[i] !== TERRAIN_FEATURE.CANOPY || t.featureStrength[i] < 650) continue;
      for (const n of neighbors4(i)) {
        if (t.featureType[n] || t.plantOrder[n] < 430 || t.liquid[n] >= 140) continue;
        if (counterRand("forest-spread", W.tick, n) < 0.05) {
          t.featureType[n] = TERRAIN_FEATURE.CANOPY;
          t.featureStrength[n] = 110;
          break;
        }
      }
    }
}
function updateArmament() {
  if (W.tick % 32 !== 0) return;
  for (const unit of W.militaryUnits || []) {
    if (!unit.active) continue;
    for (const id of unit.memberIds) {
      if (!classifyAlive(id)) continue;
      const w = workState(id);
      if (w.task === "craft" || toolForPurpose(id, "war")) continue;
      const l = derivedLife(id);
      if (l.hunger > 60 || l.thirst > 62) continue;
      if (toolRecipeFromInventory(id, "war")) beginOrAdvanceCraft(id, "war");
    }
  }
}
function updateEmergence() {
  const plan = W.biosphere?.emergencePlan;
  if (!plan || plan.phase >= 5 || W.tick % 32 !== 0) return;
  const t = W.tiles;
  let lush = 0,
    sample = 0;
  for (let i = 0; i < W.tileCount; i += 7) {
    sample++;
    if (t.plantOrder[i] > 220) lush++;
  }
  const lushFrac = lush / Math.max(1, sample),
    age = W.tick - W.biosphere.stageTick,
    rng = makeRng(W.seed, "emergence:" + plan.phase + ":" + W.tick);
  if (plan.phase === 0) {
    if (lushFrac > 0.15 || age > 1400) {
      const colony = emitEvent("AdaptationEvent", {
        location: plan.origins[0],
        causes: [plan.genesisId],
        evidence: ["cooperative cell colonies", "division of chemical labor"],
        importance: 4,
        data: { species: "founder cells", stage: "colonial" },
      });
      plan.colonyId = colony.id;
      W.biosphere.emergenceEvents.push(colony.id);
      W.biosphere.stage = "colonial";
      W.biosphere.stageTick = W.tick;
      plan.phase = 1;
    }
    return;
  }
  if (plan.phase === 1) {
    if (lushFrac > 0.2 || age > 1400) {
      const multi = emitEvent("SpeciesDivergenceEvent", {
        location: plan.origins[1],
        causes: [plan.colonyId],
        evidence: ["stable multicellular adhesion", "specialized transport and regulation"],
        importance: 4,
        data: { species: "multicellular founder networks", stage: "multicellular" },
      });
      plan.multiId = multi.id;
      W.biosphere.emergenceEvents.push(multi.id);
      W.biosphere.stage = "multicellular";
      W.biosphere.stageTick = W.tick;
      plan.phase = 2;
    }
    return;
  }
  if (plan.phase === 2) {
    const herbs = biospherePopulation(KINDS.HERBIVORE);
    if (herbs < plan.herbCount) {
      const burst = Math.min(4, plan.herbCount - herbs),
        site = plan.origins[rng.int(3)];
      for (let n = 0; n < burst; n++)
        createFounder(KINDS.HERBIVORE, site, rng, "multicellular grazer", plan.multiId);
      rebuildSpatialBins();
    } else if (age > 400) {
      const radiation = emitEvent("ChemistryEvent", {
        location: plan.origins[2],
        causes: [plan.multiId],
        evidence: [
          "producer and grazer niches sustained themselves",
          "predatory and social niches opened",
        ],
        importance: 4,
        data: { text: "Habitat-filtered multicellular lineages entered adaptive radiation" },
      });
      plan.radId = radiation.id;
      W.biosphere.emergenceEvents.push(radiation.id);
      W.biosphere.stage = "adaptive radiation";
      W.biosphere.stageTick = W.tick;
      plan.phase = 3;
    }
    return;
  }
  if (plan.phase === 3) {
    const herbs = biospherePopulation(KINDS.HERBIVORE),
      preds = biospherePopulation(KINDS.PREDATOR);
    if (preds < plan.predCount && herbs >= Math.max(8, Math.floor(plan.herbCount * 0.4))) {
      const burst = Math.min(3, plan.predCount - preds),
        site = plan.origins[rng.int(3)];
      for (let n = 0; n < burst; n++)
        createFounder(KINDS.PREDATOR, site, rng, "multicellular hunter", plan.radId);
      rebuildSpatialBins();
      return;
    }
    if (preds >= Math.max(2, Math.floor(plan.predCount * 0.3)) || age > 1200) plan.phase = 4;
    return;
  }
  if (plan.phase === 4) {
    if (!plan.siteStart) {
      const scores = plan.origins.slice(0, 3).map((o) => habitatScore(o, "person")),
        order = [0, 1, 2].sort((a, b) => scores[b] - scores[a] || a - b);
      plan.siteStart = [0, 0, 0];
      for (let rank2 = 0; rank2 < 3; rank2++)
        plan.siteStart[order[rank2]] =
          W.tick + rank2 * Math.floor(96 + counterRand("sapient-onset", W.tick, rank2) * 160);
    }
    let pending = false,
      spawnedAny = false;
    for (let s2 = 0; s2 < 3; s2++) {
      if (plan.spawnedPeople[s2] >= plan.personAlloc[s2]) continue;
      pending = true;
      if (W.tick < plan.siteStart[s2]) continue;
      const burst = Math.min(3, plan.personAlloc[s2] - plan.spawnedPeople[s2]);
      for (let n = 0; n < burst; n++)
        createFounder(KINDS.PERSON, plan.origins[s2], rng, "multicellular social", plan.radId);
      plan.spawnedPeople[s2] += burst;
      spawnedAny = true;
      if (plan.spawnedPeople[s2] >= plan.personAlloc[s2])
        emitEvent("AdaptationEvent", {
          location: plan.origins[s2],
          causes: [plan.radId],
          evidence: [
            "a social tool-using lineage crossed the sapience threshold in its own refuge",
          ],
          importance: 4,
          data: { stage: "sapient emergence", site: s2 },
        });
    }
    if (spawnedAny) rebuildSpatialBins();
    if (!pending) {
      for (const kind of [KINDS.PERSON, KINDS.HERBIVORE, KINDS.PREDATOR])
        for (let n = 0; n < (kind === KINDS.PREDATOR ? 3 : 5); n++)
          createFounder(
            kind,
            plan.origins[(n + (kind === KINDS.PERSON ? 0 : kind === KINDS.HERBIVORE ? 1 : 2)) % 3],
            rng,
            "dormant propagule",
            plan.radId,
            true,
          );
      plan.phase = 5;
      topUpSeedBank();
      rebuildSpatialBins();
      emitEvent("AdaptationEvent", {
        location: plan.origins[0],
        causes: [plan.radId],
        evidence: ["independent social lineages emerged at three chemically distinct refugia"],
        importance: 4,
        data: { stage: "sapient potential" },
      });
    }
  }
}
const damageBuiltPlaceSiegeBase = damageBuiltPlace;
damageBuiltPlace = function (
  place,
  amount,
  cause = "impact damage",
  causeEvent = 0,
  focusTile = -1,
) {
  const key = placeKindKey(place),
    mine = W.buildings.filter((b) => b.placeKind === key && b.placeId === place.id),
    beforeInteg = new Map(mine.map((b) => [b.id, { i: b.integrity, r: b.ruined }])),
    out = damageBuiltPlaceSiegeBase(place, amount, cause, causeEvent, focusTile);
  if (amount > 5 && typeof UI !== "undefined") {
    const now = performance.now();
    UI.siegeVisuals = (UI.siegeVisuals || [])
      .filter((v) => v.world === W && now - v.started < v.duration)
      .slice(-10);
    let queued = 0;
    for (const b of mine) {
      const prev = beforeInteg.get(b.id);
      if (!prev) continue;
      const collapsed = !prev.r && b.ruined,
        drop = prev.i - b.integrity;
      if (collapsed) {
        UI.siegeVisuals.push({
          world: W,
          x: b.x,
          y: b.y,
          amount: Math.max(amount, 20),
          collapsed: 1,
          started: now,
          duration: 2400 / Math.max(1, Math.sqrt(UI.speed || 1)),
        });
        BASH_SHAKE.set(b.id, now + 900);
      } else if (drop >= 3 && queued < 4) {
        UI.siegeVisuals.push({
          world: W,
          x: b.x,
          y: b.y,
          amount: drop,
          collapsed: 0,
          bash: true,
          started: now,
          duration: 950 / Math.max(1, Math.sqrt(UI.speed || 1)),
        });
        BASH_SHAKE.set(b.id, now + 650);
        queued++;
      }
    }
  }
  return out;
};
function updateDrowning() {
  if (W.tick % 8 !== 0) return;
  for (const id of W.activeIds) {
    if (W.kind[id] !== KINDS.PERSON || !classifyAlive(id)) continue;
    const p = W.components.position[id];
    if (!p) continue;
    const ti = idx(p.x, p.y);
    if (W.tiles.liquid[ti] <= 820) continue;
    const fid = W.components.social[id]?.factionId || 0;
    if (fid && factionHasTech(fid, "navigation")) continue;
    const l = W.components.life[id];
    l.integrity = Math.max(0, l.integrity - 46);
    W.components.body[id].integrity = l.integrity;
    if (l.integrity <= 0) killEntity(id, "drowned in deep water");
  }
}
function conquestAggression(f) {
  const home = W.settlements.find((s) => !s.ruined && s.factionId === f.id),
    culture = home ? W.cultures.find((c) => c.id === home.cultureId) : null,
    communal = culture?.values?.communal ?? 0.5;
  return clamp(
    (f.warPressure || 0) / 60 +
      (1 - communal) * 0.6 +
      (f.militaryStrength || 0) / 120 -
      (f.cohesion || 0) * 0.25,
    0,
    1,
  );
}
function applyConquestDoctrine(target, attacker, ti, raiders = null) {
  const aggression = conquestAggression(attacker),
    buildings = W.buildings.filter(
      (b) => b.placeKind === "settlement" && b.placeId === target.id && b.complete && !b.ruined,
    ),
    damaged = buildings.filter((b) => b.integrity < b.maxIntegrity).length;
  let plundered = 0;
  // Capturing a place changes its government, not its matter. Structures are
  // preserved unless a simulated strike, fire, or other recorded cause damaged
  // them before occupation. Aggressive armies can still plunder physical stores.
  if (aggression > 0.5 && raiders?.length) {
    const cap = W.settlements.find((s3) => s3.id === attacker.capitalSettlementId && !s3.ruined);
    for (const atk of raiders) {
      if (!classifyAlive(atk.id)) continue;
      const inv = W.components.inventory[atk.id]?.materials;
      if (!inv) continue;
      let carried = 0,
        firstSp = -1;
      for (let sp = 0; sp < target.inventory.length && carried < 12; sp++) {
        const take = Math.min(target.inventory[sp], 12 - carried, 65535 - inv[sp]);
        if (take > 0) {
          target.inventory[sp] -= take;
          inv[sp] = u16(inv[sp] + take);
          carried += take;
          plundered += take;
          if (firstSp < 0) firstSp = sp;
        }
      }
      if (carried > 0)
        setWorkAction(
          atk.id,
          "haul",
          `carrying plunder from ${target.name}`,
          cap && cap !== target ? idx(cap.x, cap.y) : idx(target.x, target.y),
          firstSp,
          0,
          0,
        );
    }
  }
  UI.captureVisuals = (UI.captureVisuals || [])
    .filter((v) => v.world === W && performance.now() - v.started < v.duration)
    .slice(-4);
  UI.captureVisuals.push({
    world: W,
    x: target.x,
    y: target.y,
    color: W.factions.find((f) => f.id === attacker.id)?.color || "#e8c66f",
    aggression,
    razed: 0,
    burned: false,
    started: performance.now(),
    duration: 5200 / Math.max(1, Math.sqrt(UI.speed || 1)),
  });
  return {
    razed: 0,
    burned: false,
    preserved: buildings.length,
    damaged,
    destroyed: W.buildings.filter(
      (b) => b.placeKind === "settlement" && b.placeId === target.id && b.ruined,
    ).length,
    plundered,
  };
}
function warToolTier(id) {
  const place = nearestFriendlyPlace(id),
    known = place?.knownProcesses || [];
  return known.includes("metalworking") && known.includes("mechanization")
    ? 3
    : known.includes("fortification") || known.includes("navigation") || known.includes("masonry")
      ? 2
      : 1;
}
function attackerRangedTier(id) {
  let tier = 0;
  for (const eid of W.components.inventory[id]?.artifactIds || []) {
    const a = W.artifacts.find((x) => x.entityId === eid);
    if (!a || !isFunctionalTool(a)) continue;
    const caps = a.tool.capabilities;
    if (caps.includes("powder")) tier = Math.max(tier, 3);
    else if (caps.includes("ranged")) tier = Math.max(tier, 2);
  }
  return tier;
}
combatEquipmentQuality = function (id) {
  let best = 0;
  for (const eid of W.components.inventory[id]?.artifactIds || []) {
    const a = W.artifacts.find((x) => x.entityId === eid);
    if (!a || !isFunctionalTool(a)) continue;
    const caps = a.tool.capabilities,
      wearFactor = 1 - a.tool.wear / Math.max(1, a.tool.durability),
      tier = caps.includes("powder")
        ? 3
        : caps.includes("ranged")
          ? 2.1
          : caps.includes("war")
            ? 1.6
            : caps.includes("cut") || caps.includes("mine") || caps.includes("build")
              ? 1
              : 0;
    if (tier) best = Math.max(best, a.quality * wearFactor * tier);
  }
  return best;
};
const simTickEnvironmentBase = simTick;
simTick = function () {
  simTickEnvironmentBase();
  if (W) {
    updateEmergence();
    updateFeatureEcology();
    updateArmament();
    updateDrowning();
  }
};
const updateEmergentMilitiasMembershipBase = updateEmergentMilitias;
updateEmergentMilitias = function () {
  const result = updateEmergentMilitiasMembershipBase();
  for (const unit of W.militaryUnits) if (!unit.memberIds.length) unit.active = false;
  return result;
};
const updateFactionsImplicitBase = updateFactions;
updateFactions = function () {
  const result = updateFactionsImplicitBase();
  initializeImplicitSociety();
  maybeFactionSchism();
  updateImplicitEconomy();
  updateEmergentMilitias();
  return result;
};
const simTickImplicitBase = simTick;
simTick = function () {
  simTickImplicitBase();
  initializeImplicitSociety();
  updateMilitaryMovement();
};
const eventSentenceImplicitBase = eventSentence;
eventSentence = function (e) {
  const f = e.factions.map((id) => W.factions.find((x) => x.id === id)?.name || `Faction ${id}`),
    names = e.subjects.map(entityName),
    loc = locationName(e.location);
  if (e.type === "ExchangeEvent")
    return `${names[0]} and ${names[1]} completed a conserved material exchange in ${loc}.`;
  if (e.type === "InstitutionFormedEvent")
    return `${e.data.name} emerged from repeated behavior in ${loc}.`;
  if (e.type === "FactionSchismEvent")
    return `${f[1]} separated from ${f[0]} after coordination and material interests diverged.`;
  if (e.type === "MilitaryMusterEvent")
    return `${f[0]} residents organized a supplied militia in ${loc}.`;
  if (e.type === "SettlementCapturedEvent")
    return `${f[0]} occupied ${e.data.name} after its defenders lost physical control.`;
  return eventSentenceImplicitBase(e);
};
function implicitSocietySummary() {
  if (!W) return null;
  initializeImplicitSociety();
  const roles = {};
  for (const id of W.activeIds)
    if (W.kind[id] === KINDS.PERSON && classifyAlive(id)) {
      const role = workSpecialization(id);
      roles[role] = (roles[role] || 0) + 1;
    }
  return {
    factions: W.factions
      .filter((f) => f.stability > 0)
      .map((f) => ({
        id: f.id,
        name: f.name,
        population: f.population,
        settlements: f.settlementIds.slice(),
        militaryStrength: +f.militaryStrength.toFixed(2),
      })),
    settlements: W.settlements.filter((s) => !s.ruined).length,
    routes: W.tradeRoutes.filter((r) => r.trips > 0).map((r) => ({ ...r })),
    recentExchanges: W.exchangeRecords.slice(-24),
    institutions: W.institutions.filter((i) => i.active).map((i) => ({ ...i })),
    militaryUnits: W.militaryUnits
      .filter((u) => u.active)
      .map((u) => ({
        ...u,
        memberIds: u.memberIds.slice(),
        strength: +militaryUnitStrength(u).toFixed(2),
      })),
    wars: W.activeWars.map((w) => ({ ...w })),
    roles,
    metrics: { ...W.implicitMetrics },
  };
}
function implicitSocietyAudit() {
  const summary = implicitSocietySummary(),
    failures = [],
    members = new Set();
  for (const route of summary.routes) {
    if (route.volume <= 0 || route.trips <= 0)
      failures.push(`route ${route.id} has no physical exchange`);
  }
  for (const unit of summary.militaryUnits)
    for (const id of unit.memberIds) {
      if (members.has(id)) failures.push(`person ${id} belongs to multiple units`);
      members.add(id);
      if (W.kind[id] !== KINDS.PERSON || !classifyAlive(id))
        failures.push(`unit ${unit.id} retains dead member ${id}`);
      if (W.components.social[id]?.factionId !== unit.factionId)
        failures.push(`unit ${unit.id} retains foreign member ${id}`);
    }
  return { ...summary, failures, matter: auditMatter() };
}
function debugImplicitConflictFixture() {
  initializeImplicitSociety();
  const settlements = W.settlements.filter((s) => !s.ruined).sort((a, b) => a.id - b.id);
  if (settlements.length < 2)
    return { ok: false, reason: "two persistent settlements are required" };
  let a = settlements[0],
    b = settlements.find((s) => s.factionId !== a.factionId) || settlements[1],
    fa = W.factions.find((f) => f.id === a.factionId);
  if (!fa) {
    fa = createFaction(a.id, idx(a.x, a.y), a.importantEvents.at(-1) || 0);
    if (!fa) return { ok: false, reason: "first faction could not form" };
  }
  let fb = W.factions.find((f) => f.id === b.factionId && f.id !== fa.id);
  if (!fb) {
    const old = b.factionId;
    b.factionId = 0;
    fb = createFaction(b.id, idx(b.x, b.y), b.importantEvents.at(-1) || 0);
    if (!fb) {
      b.factionId = old;
      return { ok: false, reason: "second faction could not form" };
    }
    for (const id of entityAtRadius(idx(b.x, b.y), 8, KINDS.PERSON).filter(classifyAlive))
      W.components.social[id].factionId = fb.id;
  }
  const ra =
      fa.relations[fb.id] ||
      (fa.relations[fb.id] = { status: "neutral", pressure: 0, grievance: 0, trade: 0 }),
    rb =
      fb.relations[fa.id] ||
      (fb.relations[fa.id] = { status: "neutral", pressure: 0, grievance: 0, trade: 0 });
  ra.status = rb.status = "neutral";
  ra.pressure = rb.pressure = 112;
  ra.grievance = rb.grievance = 8;
  fa.aggression = Math.max(fa.aggression, 0.72);
  fb.aggression = Math.max(fb.aggression, 0.72);
  for (const [source, target, sp] of [
    [a, b, C.MINERAL],
    [b, a, C.ORGANIC],
  ]) {
    const amount = Math.min(18, source.inventory[sp] || 0, 65535 - target.inventory[sp]);
    source.inventory[sp] -= amount;
    target.inventory[sp] += amount;
  }
  updateImplicitEconomy();
  updateEmergentMilitias();
  return { ok: true, factions: [fa.id, fb.id], settlements: [a.id, b.id], matter: auditMatter() };
}
const refreshStatsImplicitBase = refreshStats;
refreshStats = function () {
  refreshStatsImplicitBase();
  const s = implicitSocietySummary(),
    routes = s.routes.reduce((n, r) => n + r.trips, 0),
    atWar = s.wars.filter((w) => !w.ended).length,
    card = `<div class="subhead">Emergent economy and defense</div><div class="card"><div class="row between"><b>Behavior-derived institutions</b><span class="tag ${atWar ? "red" : "good"}">${atWar ? `${atWar} active war${atWar === 1 ? "" : "s"}` : "civil exchange"}</span></div><div class="kv" style="margin-top:8px"><span>Physical exchange routes / trips</span><b>${s.routes.length} / ${routes}</b><span>Matter moved by exchange</span><b>${fmt(s.metrics.matterMoved)}</b><span>Observed institutions</span><b>${s.institutions.length}</b><span>Militia units / members</span><b>${s.militaryUnits.length} / ${sum(s.militaryUnits.map((u) => u.memberIds.length))}</b><span>Specializations</span><b>${esc(
      Object.entries(s.roles)
        .map(([k, n]) => `${titleCase(k)} ${n}`)
        .join(" · ") || "learning",
    )}</b><span>Settlement captures</span><b>${s.metrics.captures}</b></div><div class="divider"></div><small class="muted">Prices, routes, professions, markets, militias, and wars are inferred from possession, scarcity, repeated exchange, allegiance, training, equipment, supply, movement, and physical control.</small></div>`;
  DOM.statsBody.insertAdjacentHTML("afterbegin", card);
};
const showFactionImplicitBase = showFaction;
showFaction = function (id) {
  showFactionImplicitBase(id);
  const faction = W.factions.find((f) => f.id === id);
  if (!faction) return;
  const routes = W.tradeRoutes.filter((r) => {
      const a = W.settlements.find((s) => s.id === r.a),
        b = W.settlements.find((s) => s.id === r.b);
      return r.trips > 0 && (a?.factionId === id || b?.factionId === id);
    }),
    institutions = W.institutions.filter((i) => i.active && i.factionIds.includes(id)),
    units = W.militaryUnits.filter((u) => u.active && u.factionId === id);
  DOM.modalBody.insertAdjacentHTML(
    "beforeend",
    `<div class="subhead">Material economy</div><div class="card"><div class="kv"><span>Observed routes</span><b>${routes.length}</b><span>Completed exchanges</span><b>${sum(routes.map((r) => r.trips))}</b><span>Emergent institutions</span><b>${esc(institutions.map((i) => i.name).join(" · ") || "none yet")}</b></div></div><div class="subhead">Physical defense</div><div class="card"><div class="kv"><span>Active units</span><b>${units.length}</b><span>Mobilized people</span><b>${sum(units.map((u) => u.memberIds.length))}</b><span>Measured unit strength</span><b>${units.reduce((n, u) => n + militaryUnitStrength(u), 0).toFixed(1)}</b><span>Current objectives</span><b>${esc(units.map((u) => W.settlements.find((s) => s.id === u.objectiveSettlementId)?.name || "home defense").join(" · ") || "none")}</b></div></div>`,
  );
};
