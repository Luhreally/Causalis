// ═══════════════════════════════════════════════════════════════════════════
// 41. IMPLICIT ECONOMIES, POLITICAL DIVERGENCE, AND MATERIAL WARFARE
// Macro institutions below are observations of repeated agent behavior. Matter
// always moves through the same conserved inventories used by survival/building.
// ═══════════════════════════════════════════════════════════════════════════
function initializeImplicitSociety(world = W) {
  if (!world) return null;
  world.tradeRoutes = world.tradeRoutes || [];
  world.exchangeRecords = world.exchangeRecords || [];
  world.institutions = world.institutions || [];
  world.militaryUnits = world.militaryUnits || [];
  world.nextTradeRouteId = world.nextTradeRouteId || 1;
  world.nextInstitutionId = world.nextInstitutionId || 1;
  world.nextMilitaryUnitId = world.nextMilitaryUnitId || 1;
  world.implicitMetrics = world.implicitMetrics || {
    internalTransfers: 0,
    barters: 0,
    matterMoved: 0,
    marketsFormed: 0,
    schisms: 0,
    militiasFormed: 0,
    battles: 0,
    captures: 0,
  };
  for (const s of world.settlements || []) {
    s.economy = s.economy || {
      imports: 0,
      exports: 0,
      exchangeCount: 0,
      lastExchangeTick: -1,
      priceMemory: {},
    };
  }
  for (const id of world.activeIds || []) {
    const work = world.components.work?.[id];
    if (work) {
      work.experience = work.experience || {};
      work.specialization = work.specialization || "generalist";
    }
  }
  return world;
}
function workSpecialization(id) {
  const exp = W.components.work?.[id]?.experience || {},
    groups = {
      builder: (exp.build || 0) + (exp.haul || 0) * 0.35,
      extractor: (exp.mine || 0) + (exp.cut || 0) + (exp.gather || 0) * 0.7,
      artisan: (exp.craft || 0) + (exp.build || 0) * 0.25,
      carrier: (exp.haul || 0) + (exp.travel || 0) * 0.2,
      defender: (exp.guard || 0) + (exp.march || 0) + (exp.fight || 0),
    };
  return (
    Object.entries(groups).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ||
    "generalist"
  );
}
const setWorkActionImplicitBase = setWorkAction;
setWorkAction = function (
  id,
  task,
  phase,
  targetTile = -1,
  materialId = -1,
  buildingId = 0,
  toolId = 0,
) {
  const w = setWorkActionImplicitBase(id, task, phase, targetTile, materialId, buildingId, toolId);
  w.experience = w.experience || {};
  if (w.lastExperienceTick !== W.tick) {
    w.experience[task] = (w.experience[task] || 0) + 1;
    w.lastExperienceTick = W.tick;
    w.specialization = workSpecialization(id);
  }
  return w;
};
function economicTargets(place) {
  return new Map(essentialStockTargets(place));
}
function marginalUtility(place, sp) {
  const target =
      economicTargets(place).get(sp) ||
      (eligibleResearchMaterialNeeds(place).some((n) => n.sp === sp) ? 10 : 3),
    stock = (place.inventory?.[sp] || 0) + (place.researchInventory?.[sp] || 0);
  return clamp((target + 4) / (stock + 2), 0.05, 24);
}
function materialSurplus(place, sp) {
  const target = economicTargets(place).get(sp) || 0,
    reserve = researchMaterialReserve(place, sp);
  return Math.max(0, (place.inventory?.[sp] || 0) - Math.max(reserve, target * 1.15 + 4));
}
function materialDeficit(place, sp) {
  const target = economicTargets(place).get(sp) || 0,
    stock = (place.inventory?.[sp] || 0) + (place.researchInventory?.[sp] || 0);
  return Math.max(0, target * 0.72 - stock);
}
function transferSettlementMatter(from, to, sp, wanted) {
  if (!from || !to || from === to || wanted <= 0) return 0;
  const room = Math.max(0, (to.storageCapacity || 150) - placeStorageUsed(to)),
    amount = Math.min(Math.floor(wanted), from.inventory[sp] || 0, room, 65535 - to.inventory[sp]);
  if (amount < 1) return 0;
  from.inventory[sp] -= amount;
  to.inventory[sp] += amount;
  from.economy.exports += amount;
  to.economy.imports += amount;
  from.economy.exchangeCount++;
  to.economy.exchangeCount++;
  from.economy.lastExchangeTick = to.economy.lastExchangeTick = W.tick;
  W.implicitMetrics.matterMoved += amount;
  return amount;
}
function tradeRouteBetween(a, b, mode) {
  const lo = Math.min(a.id, b.id),
    hi = Math.max(a.id, b.id);
  let route = W.tradeRoutes.find((r) => r.a === lo && r.b === hi && r.mode === mode);
  if (!route) {
    route = {
      id: W.nextTradeRouteId++,
      a: lo,
      b: hi,
      mode,
      trips: 0,
      volume: 0,
      lastTick: -1,
      createdTick: W.tick,
      ratios: {},
      mediumSpecies: -1,
    };
    W.tradeRoutes.push(route);
  }
  return route;
}
function recordExchange(a, b, mode, giveSp, giveAmount, returnSp = -1, returnAmount = 0) {
  if (giveAmount < 1) return null;
  const route = tradeRouteBetween(a, b, mode);
  route.trips++;
  route.volume += giveAmount + returnAmount;
  route.lastTick = W.tick;
  route.ratios[`${giveSp}:${returnSp}`] = returnAmount
    ? +(giveAmount / returnAmount).toFixed(3)
    : 0;
  const record = {
    tick: W.tick,
    routeId: route.id,
    mode,
    fromSettlementId: a.id,
    toSettlementId: b.id,
    giveSp,
    giveAmount,
    returnSp,
    returnAmount,
  };
  W.exchangeRecords.push(record);
  if (W.exchangeRecords.length > 320) W.exchangeRecords.shift();
  if (mode === "barter") W.implicitMetrics.barters++;
  else W.implicitMetrics.internalTransfers++;
  if (route.trips === 1 || route.trips % 6 === 0)
    emitEvent("ExchangeEvent", {
      subjects: [a.entityId, b.entityId],
      location: idx(b.x, b.y),
      factions: [a.factionId, b.factionId].filter(Boolean),
      causes: [a.importantEvents.at(-1) || b.importantEvents.at(-1) || 0],
      evidence: [
        `${giveAmount} ${W.definitions.species[giveSp].name} physically moved from ${a.name} to ${b.name}`,
        returnAmount
          ? `${returnAmount} ${W.definitions.species[returnSp].name} moved in return`
          : "shared membership substituted for immediate repayment",
        `route completed ${route.trips} observed exchanges`,
      ],
      importance: route.trips > 5 ? 3 : 1,
      data: { mode, routeId: route.id },
    });
  deriveEconomicInstitutions(route);
  return record;
}
function createObservedInstitution(type, name, settlementIds, cause = 0, mediumSpecies = -1) {
  const key = `${type}:${settlementIds
    .slice()
    .sort((a, b) => a - b)
    .join(",")}`;
  if (W.institutions.some((i) => i.key === key)) return null;
  const institution = {
    id: W.nextInstitutionId++,
    key,
    type,
    name,
    settlementIds: settlementIds.slice(),
    factionIds: Array.from(
      new Set(
        settlementIds
          .map((id) => W.settlements.find((s) => s.id === id)?.factionId)
          .filter(Boolean),
      ),
    ),
    formedTick: W.tick,
    causeEvent: cause,
    mediumSpecies,
    active: true,
  };
  W.institutions.push(institution);
  const places = settlementIds.map((id) => W.settlements.find((s) => s.id === id)).filter(Boolean),
    ev = emitEvent("InstitutionFormedEvent", {
      subjects: places.map((s) => s.entityId),
      location: places[0] ? idx(places[0].x, places[0].y) : -1,
      factions: institution.factionIds,
      causes: [cause],
      evidence: [
        `${name} was inferred from persistent repeated behavior`,
        `no era flag or institution object initiated the exchanges`,
        mediumSpecies >= 0
          ? `${W.definitions.species[mediumSpecies].name} became a commonly accepted accounting medium`
          : "reciprocal material obligations remained the accounting system",
      ],
      importance: 4,
      data: { name, type },
    });
  institution.eventId = ev.id;
  return institution;
}
function deriveEconomicInstitutions(route) {
  const a = W.settlements.find((s) => s.id === route.a),
    b = W.settlements.find((s) => s.id === route.b);
  if (!a || !b) return;
  if (route.mode === "redistribution" && route.trips >= 4)
    createObservedInstitution(
      "mutual_aid",
      `${a.name}–${b.name} provisioning network`,
      [a.id, b.id],
      W.lastEventByType.ExchangeEvent || 0,
    );
  if (route.mode === "barter" && route.trips >= 4) {
    const made = createObservedInstitution(
      "barter_market",
      `${a.name}–${b.name} exchange assembly`,
      [a.id, b.id],
      W.lastEventByType.ExchangeEvent || 0,
    );
    if (made) W.implicitMetrics.marketsFormed++;
  }
  if (
    route.mode === "barter" &&
    route.trips >= 10 &&
    a.knownProcesses.includes("writing") &&
    b.knownProcesses.includes("writing") &&
    route.mediumSpecies < 0
  ) {
    const candidates = [C.INFO, C.PIGMENT, C.CRYSTAL, C.METAL]
      .map((sp) => ({ sp, n: (a.inventory[sp] || 0) + (b.inventory[sp] || 0) }))
      .sort((x, y) => y.n - x.n || x.sp - y.sp);
    if (candidates[0].n >= 8) {
      route.mediumSpecies = candidates[0].sp;
      createObservedInstitution(
        "accounting_medium",
        `${W.definitions.species[route.mediumSpecies].name} clearing convention`,
        [a.id, b.id],
        W.lastEventByType.ExchangeEvent || 0,
        route.mediumSpecies,
      );
    }
  }
}
function bestInternalTransfer(from, to) {
  let best = null;
  for (let sp = 0; sp < SPECIES_COUNT; sp++) {
    const surplus = materialSurplus(from, sp),
      deficit = materialDeficit(to, sp);
    if (surplus < 1 || deficit < 1) continue;
    const score = Math.min(surplus, deficit) * marginalUtility(to, sp);
    if (!best || score > best.score || (score === best.score && sp < best.sp))
      best = { sp, amount: Math.min(14, surplus, deficit), score };
  }
  return best;
}
function bestBarter(a, b) {
  let offerA = null,
    offerB = null;
  for (let sp = 0; sp < SPECIES_COUNT; sp++) {
    const surplusA = materialSurplus(a, sp),
      needB = materialDeficit(b, sp),
      surplusB = materialSurplus(b, sp),
      needA = materialDeficit(a, sp);
    if (surplusA > 0 && needB > 0) {
      const score = Math.min(surplusA, needB) * marginalUtility(b, sp);
      if (!offerA || score > offerA.score)
        offerA = {
          sp,
          available: Math.min(12, surplusA, needB),
          score,
          value: marginalUtility(b, sp),
        };
    }
    if (surplusB > 0 && needA > 0) {
      const score = Math.min(surplusB, needA) * marginalUtility(a, sp);
      if (!offerB || score > offerB.score)
        offerB = {
          sp,
          available: Math.min(12, surplusB, needA),
          score,
          value: marginalUtility(a, sp),
        };
    }
  }
  if (!offerA || !offerB || offerA.sp === offerB.sp) return null;
  const amountA = Math.max(
      1,
      Math.floor(Math.min(offerA.available, (offerB.available * offerB.value) / offerA.value)),
    ),
    amountB = Math.max(
      1,
      Math.floor(Math.min(offerB.available, (amountA * offerA.value) / offerB.value)),
    );
  return { a: offerA.sp, amountA, b: offerB.sp, amountB };
}
function updateImplicitEconomy() {
  if (W.tick % 256) return;
  for (const faction of W.factions) {
    const places = W.settlements
      .filter((s) => !s.ruined && s.factionId === faction.id)
      .sort((a, b) => a.id - b.id);
    let moved = 0;
    for (const to of places)
      for (const from of places) {
        if (from === to || moved >= 4) continue;
        const offer = bestInternalTransfer(from, to);
        if (!offer) continue;
        const amount = transferSettlementMatter(from, to, offer.sp, offer.amount);
        if (amount) {
          recordExchange(from, to, "redistribution", offer.sp, amount);
          moved++;
        }
      }
  }
  let barters = 0;
  const places = W.settlements.filter((s) => !s.ruined && s.factionId).sort((a, b) => a.id - b.id);
  for (let i = 0; i < places.length && barters < 4; i++)
    for (let j = i + 1; j < places.length && barters < 4; j++) {
      const a = places[i],
        b = places[j];
      if (a.factionId === b.factionId || dist2(a.x, a.y, b.x, b.y) > 58 * 58) continue;
      const rel = W.factions.find((f) => f.id === a.factionId)?.relations?.[b.factionId];
      if (rel && ["hostile", "at war"].includes(rel.status)) continue;
      const deal = bestBarter(a, b);
      if (!deal) continue;
      const sentA = transferSettlementMatter(a, b, deal.a, deal.amountA),
        sentB = transferSettlementMatter(b, a, deal.b, deal.amountB);
      if (sentA && sentB) {
        recordExchange(a, b, "barter", deal.a, sentA, deal.b, sentB);
        const fa = W.factions.find((f) => f.id === a.factionId),
          fb = W.factions.find((f) => f.id === b.factionId),
          ra =
            fa.relations[fb.id] ||
            (fa.relations[fb.id] = { status: "neutral", pressure: 0, grievance: 0, trade: 0 }),
          rb =
            fb.relations[fa.id] ||
            (fb.relations[fa.id] = { status: "neutral", pressure: 0, grievance: 0, trade: 0 });
        ra.trade = rb.trade = (ra.trade || 0) + 1;
        barters++;
      }
    }
  deriveProfessionalInstitutions();
}
function deriveProfessionalInstitutions() {
  if (W.tick % 512) return;
  for (const s of W.settlements.filter((x) => !x.ruined)) {
    const roles = {};
    for (const id of localPlaceWorkers(s)) {
      const w = W.components.work?.[id],
        role = workSpecialization(id),
        experience = sum(Object.values(w?.experience || {}));
      if (experience < 80) continue;
      (roles[role] || (roles[role] = [])).push(id);
    }
    for (const [role, ids] of Object.entries(roles))
      if (ids.length >= 3)
        createObservedInstitution(
          "specialist_circle",
          `${s.name} ${role} circle`,
          [s.id],
          W.causalIndex.entity[ids[0]] || 0,
        );
  }
}
function maybeFactionSchism() {
  if (W.tick < 4096 || W.tick % 1024 || activeFactionCount() >= CAPS.faction) return null;
  const candidates = [];
  for (const parent of W.factions) {
    const capital = W.settlements.find((s) => s.id === parent.capitalSettlementId && !s.ruined),
      places = W.settlements.filter(
        (s) => !s.ruined && s.factionId === parent.id && s.id !== parent.capitalSettlementId,
      );
    if (!capital || places.length < 1) continue;
    for (const s of places) {
      if (W.tick - s.foundedTick < 1536) continue;
      const distance = Math.sqrt(dist2(s.x, s.y, capital.x, capital.y)),
        scarcity = (settlementFood(s) < 10 ? 1 : 0) + (settlementWater(s) < 10 ? 1 : 0),
        materialDifference =
          makeArchitectureGenome(s).rigid ===
          W.cultures.find((c) => c.id === parent.cultureId)?.values.substance
            ? 0
            : 0.18,
        autonomy =
          distance / 42 +
          (1 - parent.cohesion) * 0.7 +
          (1 - s.stability) * 0.65 +
          scarcity * 0.22 +
          materialDifference;
      if (autonomy > 1.02) candidates.push({ s, parent, autonomy });
    }
  }
  candidates.sort((a, b) => b.autonomy - a.autonomy || a.s.id - b.s.id);
  const pick = candidates[0];
  if (
    !pick ||
    counterRand("political-schism", Math.floor(W.tick / 1024), pick.parent.id, pick.s.id) >
      clamp((pick.autonomy - 1) * 0.32 + 0.05, 0.05, 0.42)
  )
    return null;
  const oldId = pick.parent.id;
  pick.s.factionId = 0;
  const faction = createFaction(
    pick.s.id,
    idx(pick.s.x, pick.s.y),
    pick.s.importantEvents.at(-1) || 0,
  );
  if (!faction) {
    pick.s.factionId = oldId;
    return null;
  }
  const r = makeRng(hashParts(W.seedHash, "schism-ethos", W.tick, pick.s.id), "schism-ethos");
  for (const key of Object.keys(faction.ethos))
    faction.ethos[key] = +clamp(
      pick.parent.ethos[key] + (r.next() - 0.5) * 0.42,
      0.05,
      0.98,
    ).toFixed(2);
  faction.cohesion = 0.62;
  faction.relations[oldId] = { status: "neutral", pressure: 18, grievance: 2, trade: 0 };
  pick.parent.relations[faction.id] = { status: "neutral", pressure: 18, grievance: 2, trade: 0 };
  pick.parent.grievances += 2;
  for (const c of W.cohorts)
    if (
      c.kind === KINDS.PERSON &&
      c.regionId === regionId(pick.s.x, pick.s.y) &&
      c.factionId === oldId
    )
      c.factionId = faction.id;
  W.implicitMetrics.schisms++;
  const ev = emitEvent("FactionSchismEvent", {
    subjects: [pick.s.entityId, faction.entityId, pick.parent.entityId],
    location: idx(pick.s.x, pick.s.y),
    factions: [oldId, faction.id],
    causes: [W.lastEventByType.FactionFoundedEvent, pick.s.importantEvents.at(-1) || 0],
    evidence: [
      `distance from ${W.settlements.find((s) => s.id === pick.parent.capitalSettlementId)?.name || "the old center"} weakened coordination`,
      `${pick.s.name} accumulated distinct material and survival priorities`,
      `autonomy pressure ${pick.autonomy.toFixed(2)} crossed the locally evolved tolerance`,
    ],
    importance: 5,
    data: { name: faction.name, parent: pick.parent.name },
  });
  pick.s.importantEvents.push(ev.id);
  return faction;
}
function combatEquipmentQuality(id) {
  return (W.components.inventory[id]?.artifactIds || [])
    .map((eid) => W.artifacts.find((a) => a.entityId === eid))
    .filter(
      (a) =>
        a &&
        isFunctionalTool(a) &&
        (a.tool.capabilities.includes("cut") ||
          a.tool.capabilities.includes("mine") ||
          a.tool.capabilities.includes("build")),
    )
    .reduce(
      (n, a) => Math.max(n, a.quality * (1 - a.tool.wear / Math.max(1, a.tool.durability))),
      0,
    );
}
function militaryUnitStrength(unit) {
  const members = unit.memberIds.filter(
    (id) =>
      W.kind[id] === KINDS.PERSON &&
      classifyAlive(id) &&
      W.components.social[id]?.factionId === unit.factionId,
  );
  return (
    members.reduce(
      (n, id) => n + 1 + phenotype(id).aggression * 0.8 + combatEquipmentQuality(id) / 60,
      0,
    ) *
    (1 + unit.training * 0.04) *
    unit.supply
  );
}
function militiaSurvivalCrisis(id) {
  const life = derivedLife(id);
  return life.hunger > 70 || life.thirst > 72 || life.health < 40;
}
function concertedIntensity() {
  return W?.civilization?.concertedEffortUntil > W.tick
    ? 1 + (W.civilization.concertedEffortLevel || 0)
    : 0;
}
function causalSkipIntervene() {
  const level = W?.civilization?.concertedEffortLevel || 0;
  const next = CIV_STAGE_ORDER[normalizeCivilizationAuthority().stageIndex + 1];
  if (!next) return;
  const input = (n) => (W.conservation.playerInput += n),
    living = W.settlements.filter((s) => !s.ruined);
  {
    const cells = new Map();
    for (const id of W.activeIds) {
      if (W.kind[id] !== KINDS.PERSON || !classifyAlive(id)) continue;
      const p = W.components.position[id],
        key = (p.y >> 4) * 4096 + (p.x >> 4),
        c2 = cells.get(key) || { x: 0, y: 0, n: 0 };
      c2.x += p.x;
      c2.y += p.y;
      c2.n++;
      cells.set(key, c2);
    }
    const cands = [...cells.values()]
        .filter((c2) => c2.n >= 3)
        .map((c2) => ({ x: Math.round(c2.x / c2.n), y: Math.round(c2.y / c2.n), n: c2.n }))
        .sort((a, b) => b.n - a.n || a.x - b.x),
      bands = [];
    for (const c2 of cands) {
      if (bands.length >= 3) break;
      if (bands.every((t2) => dist2(t2.x, t2.y, c2.x, c2.y) > 676)) bands.push(c2);
    }
    for (const band of bands) {
      const bti = idx(clamp(band.x, 0, W.width - 1), clamp(band.y, 0, W.height - 1));
      for (const pid of entityAtRadius(bti, 8, KINDS.PREDATOR).slice(0, 6)) {
        const p = W.components.position[pid];
        if (!p) continue;
        queueEffect("MoveEntity", {
          entityId: pid,
          x: clamp(p.x + (p.x > band.x ? 14 : -14), 0, W.width - 1),
          y: clamp(p.y + (p.y > band.y ? 14 : -14), 0, W.height - 1),
          forced: true,
        });
      }
      const localPlace =
        W.settlements.find((s2) => !s2.ruined && dist2(s2.x, s2.y, band.x, band.y) <= 64) ||
        W.camps.find((c3) => c3.active && dist2(c3.x, c3.y, band.x, band.y) <= 64);
      if (!localPlace && tileFood(bti, "omnivore") < 10) {
        queueEffect("ModifyField", { tile: bti, chem: C.ORGANIC, delta: 30 });
        input(30);
        queueEffect("ModifyField", { tile: bti, chem: C.SOLVENT, delta: 40 });
        input(40);
      }
    }
  }
  if (!living.length) {
    const camp = W.camps.filter((c) => c.active).sort((a, b) => a.id - b.id)[0];
    if (!camp) return;
    const campTile = idx(camp.x, camp.y);
    queueEffect("ModifyField", { tile: campTile, chem: C.ORGANIC, delta: 40 });
    input(40);
    queueEffect("ModifyField", { tile: campTile, chem: C.SOLVENT, delta: 60 });
    input(60);
    for (const pid of entityAtRadius(campTile, 8, KINDS.PREDATOR).slice(0, 6)) {
      const p = W.components.position[pid];
      if (!p) continue;
      queueEffect("MoveEntity", {
        entityId: pid,
        x: clamp(p.x + (p.x > camp.x ? 14 : -14), 0, W.width - 1),
        y: clamp(p.y + (p.y > camp.y ? 14 : -14), 0, W.height - 1),
        forced: true,
      });
    }
    return;
  }
  const scored = living
      .map((s) => ({
        s,
        missing: settlementStageShortfall(s, next),
        built: completedBuildings(s).length + activeBuildings(s).length,
      }))
      .sort((a, b) => a.missing.length - b.missing.length || b.built - a.built || a.s.id - b.s.id),
    lead = scored[0].s,
    ti = idx(lead.x, lead.y),
    theaters = (() => {
      const out = [];
      for (const entry of scored) {
        if (out.length >= 3) break;
        if (out.every((t2) => dist2(t2.x, t2.y, entry.s.x, entry.s.y) > 676)) out.push(entry.s);
      }
      return out;
    })();
  for (const town of theaters) {
    const tti = idx(town.x, town.y);
    for (const pid of entityAtRadius(tti, 8, KINDS.PREDATOR).slice(0, 6)) {
      const p = W.components.position[pid];
      if (!p) continue;
      queueEffect("MoveEntity", {
        entityId: pid,
        x: clamp(p.x + (p.x > town.x ? 14 : -14), 0, W.width - 1),
        y: clamp(p.y + (p.y > town.y ? 14 : -14), 0, W.height - 1),
        forced: true,
      });
    }
    if (settlementFood(town) < 12) {
      queueEffect("ModifyField", { tile: tti, chem: C.ORGANIC, delta: 40 });
      input(40);
    }
    if (settlementWater(town) < 12) {
      queueEffect("ModifyField", { tile: tti, chem: C.SOLVENT, delta: 60 });
      input(60);
    }
  }
  if (level < 3) return;
  lead.researchInventory = lead.researchInventory || new Uint16Array(SPECIES_COUNT);
  for (const need of eligibleResearchMaterialNeeds(lead).slice(0, 4)) {
    const amount = Math.max(0, (need.target || 10) + 2 - (lead.researchInventory[need.sp] || 0));
    if (amount > 0) {
      lead.researchInventory[need.sp] += amount;
      input(amount);
    }
  }
  for (const b of activeBuildings(lead).slice(0, 3)) {
    const missing = missingBuildingMaterial(b);
    if (missing) {
      const delta = Math.min(60, missing.needed || 24);
      const store = level >= 4 ? b.composition : lead.inventory,
        actual = Math.min(delta, 65535 - store[missing.sp]);
      store[missing.sp] += actual;
      input(actual);
    }
  }
}
function updateEmergentMilitias() {
  for (const unit of W.militaryUnits) {
    unit.memberIds = unit.memberIds.filter((id) => {
      const keep =
        W.kind[id] === KINDS.PERSON &&
        classifyAlive(id) &&
        W.components.social[id]?.factionId === unit.factionId &&
        !militiaSurvivalCrisis(id);
      if (!keep && classifyAlive(id) && W.components.social[id]?.unitId === unit.id) {
        W.components.social[id].militaryRole = "";
        W.components.social[id].unitId = 0;
      }
      return keep;
    });
    unit.active = unit.memberIds.length > 0;
  }
  const assigned = new Set(W.militaryUnits.filter((u) => u.active).flatMap((u) => u.memberIds));
  for (const faction of W.factions.filter((f) => f.stability > 0)) {
    const war = W.activeWars.find((w) => !w.ended && (w.a === faction.id || w.b === faction.id)),
      pressure = Math.max(0, ...Object.values(faction.relations).map((r) => r.pressure || 0)),
      places = W.settlements.filter((s) => !s.ruined && s.factionId === faction.id);
    for (const home of places) {
      const locals = localPlaceWorkers(home)
          .filter((id) => {
            const life = derivedLife(id),
              body = W.components.body[id];
            return (
              !assigned.has(id) &&
              W.components.social[id]?.factionId === faction.id &&
              life.health > 62 &&
              life.hunger < 58 &&
              life.thirst < 60 &&
              W.components.life[id].age >= (body.maturityAge || 1000)
            );
          })
          .sort(
            (a, b) =>
              W.components.social[b].aggression +
                W.components.social[b].dominance +
                combatEquipmentQuality(b) / 100 -
                (W.components.social[a].aggression +
                  W.components.social[a].dominance +
                  combatEquipmentQuality(a) / 100) || a - b,
          ),
        desired = war
          ? Math.min(
              settlementFood(home) < 12 ? 2 : 8,
              Math.max(
                2,
                Math.ceil(
                  (locals.length +
                    (W.militaryUnits.find((u) => u.active && u.homeSettlementId === home.id)
                      ?.memberIds.length || 0)) *
                    0.25,
                ),
              ),
            )
          : pressure > 48
            ? Math.min(6, Math.max(2, Math.ceil(locals.length * 0.2)))
            : completedBuildings(home, "wall").length
              ? 1
              : 0;
      let unit = W.militaryUnits.find(
        (u) => u.active && u.factionId === faction.id && u.homeSettlementId === home.id,
      );
      if (!unit && desired > 0) {
        unit = {
          id: W.nextMilitaryUnitId++,
          factionId: faction.id,
          homeSettlementId: home.id,
          memberIds: [],
          training: 0,
          supply: 1,
          morale: 0.7,
          objectiveSettlementId: 0,
          formedTick: W.tick,
          lastBattleTick: -1,
          phase: "mustering",
          phaseDetail: `residents are gathering and drawing supplies at ${home.name}`,
          phaseTick: W.tick,
          lastProgressTick: W.tick,
          stalledTicks: 0,
          active: true,
        };
        W.militaryUnits.push(unit);
      }
      if (!unit) continue;
      while (unit.memberIds.length < desired && locals.length) {
        const id = locals.shift();
        unit.memberIds.push(id);
        assigned.add(id);
        W.components.social[id].militaryRole = "militia";
        W.components.social[id].unitId = unit.id;
      }
      if (!war && pressure < 24 && unit.memberIds.length > 1) {
        for (const id of unit.memberIds.splice(1)) {
          W.components.social[id].militaryRole = "";
          W.components.social[id].unitId = 0;
        }
      }
      unit.training = clamp(unit.training + unit.memberIds.length * 0.012, 0, 25);
      let supplied = 0;
      for (const id of unit.memberIds) {
        const inv = W.components.inventory[id],
          body = W.components.chemistry[id].q,
          food = Math.min(5, home.inventory[C.ORGANIC], 65535 - inv.digestive[C.ORGANIC]),
          energy = Math.min(5, home.inventory[C.ENERGY], 65535 - body[C.ENERGY]),
          water = Math.min(8, home.inventory[C.SOLVENT], 65535 - body[C.SOLVENT]);
        home.inventory[C.ORGANIC] -= food;
        inv.digestive[C.ORGANIC] += food;
        home.inventory[C.ENERGY] -= energy;
        body[C.ENERGY] += energy;
        home.inventory[C.SOLVENT] -= water;
        body[C.SOLVENT] += water;
        supplied += food + energy + water;
      }
      unit.supply = clamp(
        unit.supply * 0.78 + (supplied >= unit.memberIds.length * 9 ? 1 : 0.45) * 0.22,
        0.3,
        1,
      );
      if (unit.formedTick === W.tick) {
        W.implicitMetrics.militiasFormed++;
        emitEvent("MilitaryMusterEvent", {
          subjects: [home.entityId, ...unit.memberIds.slice(0, 4)],
          location: idx(home.x, home.y),
          factions: [faction.id],
          causes: [W.lastEventByType.WarTensionEvent || home.importantEvents.at(-1) || 0],
          evidence: [
            `${unit.memberIds.length} residents accepted coordinated defense roles`,
            `food, energy, and solvent came from ${home.name}'s conserved stores`,
            `training and equipment—not population alone—determine combat power`,
          ],
          importance: 3,
          data: { unitId: unit.id, name: `${home.name} militia` },
        });
      }
    }
  }
  for (const faction of W.factions) {
    const units = W.militaryUnits.filter((u) => u.active && u.factionId === faction.id),
      built = W.settlements
        .filter((s) => !s.ruined && s.factionId === faction.id)
        .reduce((n, s) => n + settlementDefense(s) * 0.35, 0);
    faction.militaryStrength = units.reduce((n, u) => n + militaryUnitStrength(u), 0) + built;
  }
}
function updateMilitaryMovement() {
  if (W.tick % 4) return;
  for (const unit of W.militaryUnits.filter((u) => u.active)) {
    const war = W.activeWars.find(
        (w) => !w.ended && (w.a === unit.factionId || w.b === unit.factionId),
      ),
      home = W.settlements.find((s) => s.id === unit.homeSettlementId && !s.ruined);
    let target = home;
    if (war) {
      if (!war.attackerId) {
        const fa = W.factions.find((f) => f.id === war.a),
          fb = W.factions.find((f) => f.id === war.b);
        war.attackerId = (fa?.militaryStrength || 0) >= (fb?.militaryStrength || 0) ? war.a : war.b;
      }
      const defenderId = war.attackerId === war.a ? war.b : war.a,
        candidates = W.settlements
          .filter((s) => !s.ruined && s.factionId === defenderId)
          .sort((a, b) => a.defense - b.defense || a.id - b.id);
      target = candidates[0] || home;
      unit.objectiveSettlementId = target?.id || 0;
    } else unit.objectiveSettlementId = 0;
    if (!target) continue;
    let fcx = 0,
      fcy = 0,
      alive = 0;
    for (const mid of unit.memberIds) {
      const mp = W.components.position[mid];
      if (mp && classifyAlive(mid)) {
        fcx += mp.x;
        fcy += mp.y;
        alive++;
      }
    }
    const ux = alive ? fcx / alive : target.x,
      uy = alive ? fcy / alive : target.y,
      centroidToTarget = Math.sqrt(dist2(ux, uy, target.x, target.y));
    for (const id of unit.memberIds) {
      const p = W.components.position[id];
      if (!p) continue;
      if (militiaSurvivalCrisis(id)) {
        const w = W.components.work?.[id];
        if (w && ["march", "guard", "raze"].includes(w.task)) clearStaleWork(id);
        continue;
      }
      const distance = dist2(p.x, p.y, target.x, target.y);
      if (alive >= 3 && dist2(p.x, p.y, ux, uy) > 25 && centroidToTarget > 3) {
        moveWorkerToward(
          id,
          idx(clamp(Math.round(ux), 0, W.width - 1), clamp(Math.round(uy), 0, W.height - 1)),
          war ? "march" : "guard",
          `re-forming with unit ${unit.id}`,
          -1,
          0,
          0,
        );
        continue;
      }
      if (alive >= 3 && centroidToTarget - Math.sqrt(distance) > 6 && distance > (war ? 3 : 16)) {
        setWorkAction(id, "guard", `holding for unit ${unit.id} to form up`, idx(p.x, p.y));
        continue;
      }
      if (distance > (war ? 3 : 16))
        moveWorkerToward(
          id,
          idx(target.x, target.y),
          war ? "march" : "guard",
          war
            ? `moving with unit ${unit.id} toward ${target.name}`
            : `patrolling approaches to ${target.name}`,
          -1,
          0,
          0,
        );
      else
        setWorkAction(
          id,
          "guard",
          war
            ? `holding formation at the ${target.name} front`
            : `watching ${target.name}'s approaches`,
          idx(target.x, target.y),
        );
    }
  }
}
function razeStrike(id, place, b, war) {
  const p = W.components.position[id];
  if (!p) return 0;
  if (dist2(p.x, p.y, b.x, b.y) > 6.25) {
    moveWorkerToward(id, idx(b.x, b.y), "march", `advancing on the ${b.name}`, -1, 0, 0);
    return 0;
  }
  const damage = Math.max(5, Math.floor(6 + combatEquipmentQuality(id) * 0.12));
  setWorkAction(id, "raze", `tearing down the ${b.name}`, idx(b.x, b.y), -1, b.id);
  damageBuiltPlace(
    place,
    damage,
    "deliberate razing in war",
    war.lastEventId || war.startEventId,
    idx(b.x, b.y),
  );
  return damage;
}
function militaryStrike(attacker, victim, war, training = 0) {
  const al = W.components.life[attacker],
    vl = W.components.life[victim],
    vp = W.components.position[victim];
  if (!al || !vl || !vp || W.tick - (al.lastMilitaryAttackTick ?? -999) < 5) return 0;
  al.lastMilitaryAttackTick = W.tick;
  const equipment = combatEquipmentQuality(attacker),
    attack = 22 + phenotype(attacker).aggression * 30 + equipment * 0.32 + training * 1.5,
    armor = W.components.body[victim].armor * 16 + combatEquipmentQuality(victim) * 0.12,
    damage = Math.max(3, Math.floor(attack - armor)),
    ti = idx(vp.x, vp.y);
  vl.integrity = Math.max(0, vl.integrity - damage);
  W.components.body[victim].integrity = vl.integrity;
  const made = executeProcess(
    "bleeding_signal",
    invEntity(victim),
    Math.max(1, Math.floor(damage / 4)),
  );
  if (made) {
    const q = W.components.chemistry[victim].q,
      spill = Math.min(made, q[C.BLOOD]);
    q[C.BLOOD] -= spill;
    setTileMatterAmount(ti, C.BLOOD, tileMatterAmount(ti, C.BLOOD) + spill);
  }
  const lethal = vl.integrity <= 0,
    ev = emitEvent("InjuryEvent", {
      subjects: [victim, attacker],
      location: ti,
      factions: [W.components.social[attacker].factionId, W.components.social[victim].factionId],
      causes: [war.startEventId],
      evidence: [
        `trained formation strike with equipment rating ${equipment.toFixed(0)}`,
        `defensive armor and tools absorbed ${armor.toFixed(0)} force`,
      ],
      magnitude: damage,
      importance: 2,
      data: { warId: war.id, military: true },
    });
  queuePredationVisual(attacker, victim, ti, damage, lethal, ev.id, attackerRangedTier(attacker));
  W.components.identity[attacker].battles++;
  W.components.identity[victim].battles++;
  setWorkAction(attacker, "fight", `engaging ${entityName(victim)} in organized combat`, ti);
  if (lethal) {
    killEntity(victim, "organized combat injury", ev.id);
    W.components.identity[attacker].kills++;
    W.statistics.kills++;
    emitEvent("KillEvent", {
      subjects: [attacker, victim],
      location: ti,
      factions: [W.components.social[attacker].factionId, W.components.social[victim].factionId],
      causes: [ev.id, war.startEventId],
      evidence: ["organized combat caused structural integrity failure"],
      importance: 3,
    });
  }
  return lethal ? 2 : 1;
}
