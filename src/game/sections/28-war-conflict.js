// ═══════════════════════════════════════════════════════════════════════════
// 28. WAR AND CONFLICT
// ═══════════════════════════════════════════════════════════════════════════
function relationPressure(a, b) {
  let border = 0,
    scarcity = 0;
  const t = W.tiles;
  for (let y = 0; y < W.height; y++)
    for (let x = 0; x < W.width; x++) {
      const i = idx(x, y);
      if (
        (x + 1 < W.width && t.owner[i] === a.id && t.owner[i + 1] === b.id) ||
        (x + 1 < W.width && t.owner[i] === b.id && t.owner[i + 1] === a.id)
      )
        border++;
      if (
        y + 1 < W.height &&
        ((t.owner[i] === a.id && t.owner[i + W.width] === b.id) ||
          (t.owner[i] === b.id && t.owner[i + W.width] === a.id))
      )
        border++;
    }
  const sa = W.settlements.filter((s) => s.factionId === a.id && !s.ruined),
    sb = W.settlements.filter((s) => s.factionId === b.id && !s.ruined);
  scarcity =
    (sa.some((s) => settlementFood(s) < 12) ? 1 : 0) +
    (sb.some((s) => settlementFood(s) < 12) ? 1 : 0);
  const ethos =
      Math.abs(a.ethos.natureBound - b.ethos.natureBound) +
      Math.abs(a.ethos.hierarchical - b.ethos.hierarchical),
    grievance = (a.relations[b.id]?.grievance || 0) + (b.relations[a.id]?.grievance || 0),
    trade = a.relations[b.id]?.trade || 0,
    pressure =
      border * 3 +
      scarcity * 16 +
      grievance * 1.5 +
      ethos * 8 +
      (a.aggression + b.aggression) * 9 -
      trade * 4;
  return { pressure, border, scarcity, ethos, grievance, trade };
}
function factionsHaveContact(a, b) {
  const rel = a.relations?.[b.id];
  if (rel && (rel.status !== "neutral" || rel.pressure > 0 || rel.trade > 0 || rel.grievance > 0))
    return true;
  const sa = W.settlements.filter((s) => !s.ruined && s.factionId === a.id),
    sb = W.settlements.filter((s) => !s.ruined && s.factionId === b.id),
    reach = factionHasTech(a.id, "navigation") || factionHasTech(b.id, "navigation") ? 44 : 28,
    r2 = reach * reach;
  for (const x of sa) for (const y of sb) if (dist2(x.x, x.y, y.x, y.y) <= r2) return true;
  return false;
}
function reciprocalTradeTrips(a, b) {
  return (
    W.tradeRoutes
      ?.filter((r) => {
        if (r.mode !== "barter" || r.trips <= 0) return false;
        const from = W.settlements.find((s) => s.id === r.a),
          to = W.settlements.find((s) => s.id === r.b);
        return (
          !!from &&
          !!to &&
          ((from.factionId === a.id && to.factionId === b.id) ||
            (from.factionId === b.id && to.factionId === a.id))
        );
      })
      .reduce((n, r) => n + r.trips, 0) || 0
  );
}
function updateDiplomacyAndWar() {
  if (W.activeWars.length > 24) {
    const active = W.activeWars.filter((war) => !war.ended),
      recent = W.activeWars.filter((war) => war.ended).slice(-12);
    W.activeWars = [...active, ...recent];
  }
  for (const war of W.activeWars.filter((candidate) => !candidate.ended)) {
    const a = W.factions.find((faction) => faction.id === war.a),
      b = W.factions.find((faction) => faction.id === war.b),
      aHasPlace = W.settlements.some(
        (settlement) => !settlement.ruined && settlement.factionId === war.a,
      ),
      bHasPlace = W.settlements.some(
        (settlement) => !settlement.ruined && settlement.factionId === war.b,
      );
    if (!a || !b || !aHasPlace || !bHasPlace)
      endWar(war, a, b, "political collapse ended the campaign");
  }
  for (const f of W.factions) f.warPressure = 0;
  for (let i = 0; i < W.factions.length; i++)
    for (let j = i + 1; j < W.factions.length; j++) {
      const a = W.factions[i],
        b = W.factions[j];
      if (!a.stability || !b.stability) continue;
      if (!factionsHaveContact(a, b)) continue;
      const p = relationPressure(a, b),
        rel =
          a.relations[b.id] ||
          (a.relations[b.id] = { status: "neutral", pressure: 0, grievance: 0, trade: 0 }),
        rev =
          b.relations[a.id] ||
          (b.relations[a.id] = { status: "neutral", pressure: 0, grievance: 0, trade: 0 });
      rel.pressure = rev.pressure = clamp(rel.pressure * 0.85 + p.pressure, 0, 200);
      a.warPressure = Math.max(a.warPressure, rel.pressure);
      b.warPressure = Math.max(b.warPressure, rel.pressure);
      const truceUntil = Math.max(rel.truceUntil || 0, rev.truceUntil || 0);
      if (W.tick < truceUntil) {
        rel.status = rev.status = "truce";
        rel.pressure = rev.pressure = Math.min(52, rel.pressure * 0.7);
        continue;
      }
      if (rel.status === "truce" || rev.status === "truce") {
        rel.status = rev.status = rel.pressure < 58 ? "neutral" : "hostile";
        rel.truceUntil = rev.truceUntil = 0;
      }
      const war = W.activeWars.find(
        (w) => !w.ended && ((w.a === a.id && w.b === b.id) || (w.a === b.id && w.b === a.id)),
      );
      if (war) {
        resolveWarTurn(war, a, b);
        continue;
      }
      if (rel.pressure > 58 && rel.status !== "hostile") {
        rel.status = rev.status = "hostile";
        if (!a.rivals.includes(b.id)) a.rivals.push(b.id);
        if (!b.rivals.includes(a.id)) b.rivals.push(a.id);
        emitEvent("WarTensionEvent", {
          factions: [a.id, b.id],
          causes: [W.lastEventByType.SettlementFoundedEvent],
          evidence: [
            p.border ? "contested borders" : "resource competition",
            p.scarcity ? "chemical food scarcity" : "competing expansion",
            p.grievance ? "historical grievances" : "ethos conflict",
          ],
          magnitude: rel.pressure,
          importance: 3,
        });
      }
      if (rel.mobilizeSince && rel.pressure < 80) {
        rel.mobilizeSince = rev.mobilizeSince = 0;
        if (rel.status === "mobilizing") rel.status = rev.status = "hostile";
      }
      if (
        rel.pressure > 105 &&
        Math.min(a.militaryStrength, b.militaryStrength) > 3 &&
        typeof factionFieldableFighters === "function" &&
        factionFieldableFighters(a) >= 2 &&
        factionFieldableFighters(b) >= 2 &&
        typeof warCampaignRouteExists === "function" &&
        (warCampaignRouteExists(a, b) || warCampaignRouteExists(b, a)) &&
        (typeof advanceWarMobilization !== "function" || advanceWarMobilization(a, b, rel, rev))
      ) {
        rel.status = rev.status = "at war";
        addRelation(a.entityId, b.entityId, "at_war_with", 1);
        addRelation(b.entityId, a.entityId, "at_war_with", 1);
        const ev = emitEvent("WarStartedEvent", {
            factions: [a.id, b.id],
            causes: [W.lastEventByType.WarTensionEvent],
            evidence: [
              p.border ? "overlapping territorial pressure" : "strategic competition",
              p.scarcity ? "resource scarcity" : "expansion pressure",
              `military confidence ${Math.round((a.militaryStrength + b.militaryStrength) / 2)}`,
            ],
            magnitude: rel.pressure,
            importance: 5,
          }),
          w = {
            id: Math.max(0, ...W.activeWars.map((candidate) => candidate.id || 0)) + 1,
            a: a.id,
            b: b.id,
            started: W.tick,
            startEventId: ev.id,
            startPopulation: a.population + b.population,
            casualties: 0,
            wounded: 0,
            turns: 0,
            contactTurns: 0,
            ended: 0,
          };
        const createdWar = war || w;
        W.activeWars.push(createdWar);
        if (typeof ensureAttackPlan === "function") ensureAttackPlan(createdWar, true);
      }
    }
  for (const [i, a] of W.factions.entries())
    for (const b of W.factions.slice(i + 1)) {
      const ra = a.relations[b.id];
      if (!ra || ra.status !== "neutral") continue;
      const reciprocal = reciprocalTradeTrips(a, b),
        tradePotential =
          a.ethos.mercantile +
          b.ethos.mercantile -
          Math.abs(a.technologyLevel - b.technologyLevel) * 0.1;
      if (reciprocal >= 6 && tradePotential > 1.05) {
        const rb =
          b.relations[a.id] ||
          (b.relations[a.id] = { status: "neutral", pressure: 0, grievance: 0, trade: 0 });
        ra.trade = rb.trade = Math.max(ra.trade || 0, reciprocal);
        ra.status = rb.status = "allied";
        if (!a.allies.includes(b.id)) a.allies.push(b.id);
        if (!b.allies.includes(a.id)) b.allies.push(a.id);
        addRelation(a.entityId, b.entityId, "allied_with", 1);
        addRelation(a.entityId, b.entityId, "trades_with", 1);
        emitEvent("AllianceEvent", {
          factions: [a.id, b.id],
          causes: [W.lastEventByType.ExchangeEvent || W.lastEventByType.TechAdvanceEvent],
          evidence: [
            `${reciprocal} physically completed exchanges`,
            `compatible mercantile practice reduced strategic uncertainty`,
          ],
          importance: 4,
        });
      }
    }
}
function allocateProportional(items, totalTake, totalCount, getCount, getId) {
  const plans = items.map((item, index) => {
      const exact = totalCount ? (totalTake * getCount(item)) / totalCount : 0,
        n = Math.floor(exact);
      return { item, n, frac: exact - n, id: getId(item, index) };
    }),
    assigned = sum(plans.map((p) => p.n));
  let remaining = totalTake - assigned;
  plans.sort((a, b) => b.frac - a.frac || a.id - b.id);
  for (const p of plans)
    if (remaining > 0 && p.n < getCount(p.item)) {
      p.n++;
      remaining--;
    }
  plans.sort((a, b) => a.id - b.id);
  return plans;
}
function removeCohortWarCasualties(factionId, requested, ti, causeEvent) {
  const regions = new Set(
      W.settlements
        .filter((s) => !s.ruined && s.factionId === factionId)
        .map((s) => regionId(s.x, s.y)),
    ),
    cohorts = W.cohorts.filter(
      (c) =>
        c.kind === KINDS.PERSON &&
        c.count > 0 &&
        (c.factionId === factionId || (!c.factionId && regions.has(c.regionId))),
    ),
    available = sum(cohorts.map((c) => c.count)),
    take = Math.min(Math.max(0, requested), available);
  if (!take) return { count: 0, eventId: 0 };
  const plans = allocateProportional(
    cohorts,
    take,
    available,
    (c) => c.count,
    (c) => c.id,
  );
  let actual = 0;
  for (const plan of plans) {
    const c = plan.item,
      n = Math.min(plan.n, c.count);
    if (!n) continue;
    const before = c.count,
      released = Array(SPECIES_COUNT).fill(0);
    for (let sp = 0; sp < SPECIES_COUNT; sp++) {
      released[sp] = Math.floor(((c.chemistryTotals[sp] || 0) * n) / before);
      c.chemistryTotals[sp] -= released[sp];
    }
    executeAggregateProcess(released, "fear_signal", Math.min(n * 2, released[C.ENERGY] || 0));
    for (let sp = 0; sp < SPECIES_COUNT; sp++) depositTileMatter(ti, sp, released[sp]);
    const agePlans = allocateProportional(
      c.ageBins,
      n,
      before,
      (v) => v,
      (_, i) => i,
    );
    for (let i = 0; i < c.ageBins.length; i++)
      c.ageBins[i] = Math.max(0, c.ageBins[i] - (agePlans.find((p) => p.id === i)?.n || 0));
    const survivorRatio = (before - n) / before;
    for (let i = 0; i < c.geneSums.length; i++) {
      c.geneSums[i] *= survivorRatio;
      c.geneSquares[i] *= survivorRatio;
    }
    for (const key of Object.keys(c.occupations)) c.occupations[key] *= survivorRatio;
    c.count -= n;
    c.health = clamp(c.health - (0.04 * n) / Math.max(1, before), 0.05, 1);
    c.morale = clamp(c.morale - (0.12 * n) / Math.max(1, before), 0, 1);
    c.history.push({ tick: W.tick, reason: `${n} war casualties`, causeEvent });
    if (c.history.length > 24) c.history.shift();
    actual += n;
  }
  if (!actual) return { count: 0, eventId: 0 };
  W.statistics.deaths += actual;
  W.tiles.danger[ti] = u16(W.tiles.danger[ti] + actual * 20);
  const ev = emitEvent("DeathEvent", {
    location: ti,
    factions: [factionId],
    causes: [causeEvent],
    evidence: ["cohort casualties in organized conflict"],
    magnitude: actual,
    importance: actual > 8 ? 4 : 2,
  });
  return { count: actual, eventId: ev.id };
}
function warFinalReckoning(war, a, b) {
  const cause = war.lastEventId || war.startEventId || 0;
  let count = 0,
    eventId = 0;
  for (const faction of [a, b]) {
    if (!faction) continue;
    const places = W.settlements.filter((s) => !s.ruined && s.factionId === faction.id);
    if (!places.length) continue;
    const seat = places.slice().sort((left, right) => left.id - right.id)[0],
      ti = idx(clamp(seat.x, 0, W.width - 1), clamp(seat.y, 0, W.height - 1)),
      toll = removeCohortWarCasualties(faction.id, 1 + (war.turns % 3), ti, cause);
    count += toll.count;
    eventId = toll.eventId || eventId;
    if (toll.count) continue;
    const exposed = W.activeIds
      .filter(
        (id) =>
          W.kind[id] === KINDS.PERSON &&
          classifyAlive(id) &&
          (W.components.social[id]?.factionId || 0) === faction.id &&
          W.components.position[id],
      )
      .sort(
        (left, right) =>
          dist2(W.components.position[left].x, W.components.position[left].y, seat.x, seat.y) -
            dist2(W.components.position[right].x, W.components.position[right].y, seat.x, seat.y) ||
          left - right,
      );
    if (!exposed.length) continue;
    killEntity(exposed[0], "wounds taken in the closing skirmishes of the war", cause);
    count++;
    eventId = W.lastEventByType.DeathEvent || eventId;
  }
  return { count, eventId };
}
function endWar(war, a, b, reason) {
  if (!war || war.ended) return;
  if (!(war.casualties > 0) && !((war.wounded || 0) > 0)) {
    const reckoning = warFinalReckoning(war, a, b);
    if (reckoning.count) {
      war.casualties = (war.casualties || 0) + reckoning.count;
      war.lastEventId = reckoning.eventId || war.lastEventId;
      reason = `${reason} — but ${reckoning.count} still fell in the closing skirmishes`;
    }
  }
  war.ended = W.tick;
  war.endedTick = W.tick;
  war.endReason = reason;
  const ra = a?.relations?.[b?.id],
    rb = b?.relations?.[a?.id];
  const truceUntil = W.tick + 1024;
  if (ra) {
    ra.status = "truce";
    ra.pressure = Math.min(44, (ra.pressure || 0) * 0.25);
    ra.grievance = Math.max(0, (ra.grievance || 0) * 0.82);
    ra.truceUntil = truceUntil;
  }
  if (rb) {
    rb.status = "truce";
    rb.pressure = Math.min(44, (rb.pressure || 0) * 0.25);
    rb.grievance = Math.max(0, (rb.grievance || 0) * 0.82);
    rb.truceUntil = truceUntil;
  }
  if (a?.entityId && b?.entityId) {
    removeRelation(a.entityId, b.entityId, "at_war_with");
    removeRelation(b.entityId, a.entityId, "at_war_with");
  }
  emitEvent("WarEndedEvent", {
    factions: [a?.id, b?.id].filter(Boolean),
    causes: [war.startEventId, war.lastEventId || 0],
    evidence: [reason],
    magnitude: war.casualties,
    importance: 4,
  });
}
