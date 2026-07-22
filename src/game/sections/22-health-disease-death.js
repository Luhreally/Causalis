// ═══════════════════════════════════════════════════════════════════════════
// 22. HEALTH, DISEASE, INJURY, AND DEATH
// ═══════════════════════════════════════════════════════════════════════════
function infectEntity(id, amount = 30, cause = 0) {
  if (!classifyAlive(id)) return;
  const ch = W.components.chemistry[id],
    p = phenotype(id),
    ti = idx(W.components.position[id].x, W.components.position[id].y),
    requested = Math.max(1, Math.floor(amount * (1 - p.diseaseResistance))),
    accepted = Math.min(requested, W.tiles.chem[C.PATHOGEN][ti], 65535 - ch.q[C.PATHOGEN]);
  if (!accepted) return;
  W.tiles.chem[C.PATHOGEN][ti] -= accepted;
  ch.q[C.PATHOGEN] += accepted;
  const ident = W.components.identity[id];
  ident.infections++;
  const ev = emitEvent("InfectionEvent", {
    subjects: [id],
    location: ti,
    causes: [cause],
    evidence: ["receptor-compatible pathogen pattern entered tissue"],
    magnitude: accepted,
    importance: 1,
  });
  W.components.memory[id].rememberedEvents.push(ev.id);
}
function updateHealth(id) {
  const l = W.components.life[id],
    ch = W.components.chemistry[id],
    p = phenotype(id),
    body = W.components.body[id],
    pos = W.components.position[id],
    ti = idx(pos.x, pos.y),
    temp = W.tiles.temperature[ti] / 10,
    accl =
      l.acclimation ||
      (l.acclimation = { temperature: temp, hydration: tileMoisture(ti) / 100, toxin: 0 });
  accl.temperature = lerp(accl.temperature, temp, 0.004);
  accl.hydration = lerp(accl.hydration, tileMoisture(ti) / 100, 0.006);
  accl.toxin = lerp(accl.toxin, clamp(ch.q[C.TOXIN] / 300, 0, 1), 0.003);
  const heatLimit = p.heatTolerance + Math.max(0, accl.temperature - 20) * 0.22,
    coldLimit = (body.coldTolerance ?? -8) - Math.max(0, 20 - accl.temperature) * 0.18,
    niche = ecologicalNicheAt(ti),
    shelter = shelterProtectionAt(id, ti),
    thermalExposure = (1 - clamp(niche.thermalBuffer, 0, 0.82)) * (1 - shelter * 0.72),
    heatDamage =
      Math.max(0, temp - heatLimit) * 0.11 * thermalExposure +
      (Math.max(0, W.tiles.fire[ti] - 140) / 240) * (1 - shelter * 0.45),
    coldDamage = Math.max(0, coldLimit - temp) * 0.065 * thermalExposure,
    toxDamage = ch.q[C.TOXIN] / (260 + accl.toxin * 180),
    pathDamage = (ch.q[C.PATHOGEN] * (1 - p.diseaseResistance)) / 180,
    starve = ch.q[C.ENERGY] < 3 ? 2.5 : 0,
    dehydrate = ch.q[C.SOLVENT] < 4 ? 3 : 0,
    asphyxia = ch.q[C.OXIDANT] < 1 && W.tiles.chem[C.OXIDANT][ti] < 1 ? 4 : 0,
    ageDamage = l.age > body.maxAge ? (l.age - body.maxAge) / 170 : 0,
    total =
      heatDamage + coldDamage + toxDamage + pathDamage + starve + dehydrate + asphyxia + ageDamage;
  if (total > 0) l.integrity = u16(l.integrity - total);
  if (
    W.tiles.chem[C.PATHOGEN][ti] > 80 &&
    counterRand("infection", W.tick, id) < 0.006 * (1 - p.diseaseResistance) * (1 - shelter * 0.35)
  )
    infectEntity(id, 4, W.causalIndex.tile[ti] || 0);
  if (l.integrity < 1 || l.regulation < 1) {
    let cause = "structural failure";
    if (starve) cause = "chemical energy depletion";
    else if (dehydrate) cause = "solvent deprivation";
    else if (asphyxia) cause = "oxidant deprivation";
    else if (pathDamage > heatDamage) cause = "infection";
    else if (heatDamage > 1) cause = "thermal destruction";
    else if (ageDamage) cause = "accumulated repair failure";
    killEntity(id, cause, W.causalIndex.tile[ti] || 0);
  } else {
    if (l.integrity < 920 && ch.q[C.ENERGY] > 20 && ch.q[C.NUTRIENT] > 10)
      executeProcess("healing", invEntity(id), 1);
    derivedLife(id);
  }
}
function killEntity(id, cause = "regulatory collapse", causeEvent = 0, erase = false) {
  if (!W.kind[id] || W.kind[id] === KINDS.CORPSE) return;
  const lifeKind = W.kind[id],
    l = W.components.life[id],
    p = W.components.position[id],
    ident = W.components.identity[id],
    ch = W.components.chemistry[id];
  l.regulation = 0;
  l.alive = false;
  l.causeOfDeath = cause;
  l.deathTick = W.tick;
  ident.lifeKind = lifeKind;
  W.kind[id] = KINDS.CORPSE;
  ch.structuralOrder = Math.min(ch.structuralOrder, 420);
  W.components.structure[id].patternId = 14;
  W.components.structure[id].order = 420;
  const ti = idx(p.x, p.y);
  for (const sp of [C.BLOOD, C.PATHOGEN]) {
    const released = Math.min(sp === C.BLOOD ? 24 : 8, ch.q[sp], 65535 - W.tiles.chem[sp][ti]);
    ch.q[sp] -= released;
    W.tiles.chem[sp][ti] += released;
  }
  W.tiles.danger[ti] = u16(W.tiles.danger[ti] + 90);
  const ev = emitEvent("DeathEvent", {
    subjects: [id],
    location: ti,
    causes: [causeEvent],
    evidence: [cause],
    importance: ident.notable ? 4 : 1,
    data: {
      kind: lifeKind,
      age: l.age,
      kills: ident.kills,
      children: ident.children.length,
      title: ident.titles.at(-1) || "",
    },
  });
  ident.deathEventId = ev.id;
  W.statistics.deaths++;
  if (UI.followId === id) {
    UI.followId = 0;
    showLifeSummary(id);
  }
  if (erase) finalizeCorpse(id);
  capCorpses();
}
const killEntityLifecycle = killEntity;
killEntity = function (id, cause = "regulatory collapse", causeEvent = 0, erase = false) {
  const kind = W.kind[id],
    wasAlive = !!kind && kind !== KINDS.CORPSE,
    wasFollowed = wasAlive && UI.followId === id,
    wasRunning = UI.running;
  if (wasFollowed) {
    UI.followId = 0;
    const ident = W.components.identity[id];
    if (ident) ident.lifeKind = kind;
  }
  killEntityLifecycle(id, cause, causeEvent, erase);
  if (wasFollowed) {
    UI.running = false;
    UI.clockInterrupted = true;
    UI.followDeathWasRunning = wasRunning;
    accumulator = 0;
    UI.keys.clear();
    DOM.pauseBtn.textContent = "▶";
    refreshTopbar();
    showLifeSummary(id);
  }
};
function updateDiseaseAndDecay() {
  for (const id of W.activeIds.slice()) {
    if (W.kind[id] === KINDS.CORPSE) {
      const p = W.components.position[id],
        ti = idx(p.x, p.y),
        ch = W.components.chemistry[id],
        moist = tileMoisture(ti),
        decay = Math.max(1, Math.floor((moist + W.tiles.temperature[ti] / 10 + 40) / 35));
      executeProcess("decomposition", invEntity(id), decay);
      for (const sp of [C.SOLVENT, C.WASTE, C.NUTRIENT, C.GAS, C.PATHOGEN, C.BLOOD]) {
        const amount = Math.min(
          ch.q[sp],
          decay + (sp === C.PATHOGEN ? 1 : 3),
          65535 - W.tiles.chem[sp][ti],
        );
        ch.q[sp] -= amount;
        W.tiles.chem[sp][ti] += amount;
      }
      W.components.structure[id].order = u16(W.components.structure[id].order - decay);
      if (sum(Array.from(ch.q)) < 22 || W.components.structure[id].order < 2) finalizeCorpse(id);
    } else if (classifyAlive(id)) {
      const ch = W.components.chemistry[id];
      if (ch.q[C.PATHOGEN] > 5) {
        executeProcess("pathogen_replication", invEntity(id), 1);
        if (ch.q[C.MEDICINE] > 0) executeProcess("medicine_neutralization", invEntity(id), 3);
      }
    }
  }
  for (const s of W.settlements) {
    const disease = settlementDisease(s);
    if (disease > 45 && !s.outbreakActive) {
      const cause = lastCauseForTile(idx(s.x, s.y), ["DeathEvent", "InfectionEvent"]),
        ev = emitEvent("DiseaseOutbreakEvent", {
          subjects: [s.entityId],
          location: idx(s.x, s.y),
          factions: [s.factionId],
          causes: [cause],
          evidence: ["pathogen inventory exceeded settlement detoxification capacity"],
          magnitude: disease,
          importance: 3,
        });
      s.outbreakActive = ev.id;
    } else if (disease < 20) s.outbreakActive = 0;
  }
}
function depositTileMatter(ti, sp, amount) {
  amount = Math.max(0, Math.floor(amount));
  if (!amount) return 0;
  if (sp < COMMON_CHEM) {
    const moved = Math.min(amount, 65535 - W.tiles.chem[sp][ti]);
    W.tiles.chem[sp][ti] += moved;
    const overflow = amount - moved;
    if (overflow)
      W.tiles.rareChem[`${ti}:${sp}`] = (W.tiles.rareChem[`${ti}:${sp}`] || 0) + overflow;
  } else W.tiles.rareChem[`${ti}:${sp}`] = (W.tiles.rareChem[`${ti}:${sp}`] || 0) + amount;
  return amount;
}
function releaseEntityMatter(id, ti) {
  const stores = [
    W.components.chemistry[id]?.q,
    W.components.inventory[id]?.materials,
    W.components.inventory[id]?.digestive,
  ].filter(Boolean);
  for (const store of stores)
    for (let s = 0; s < SPECIES_COUNT; s++) {
      const amount = store[s] || 0;
      if (!amount) continue;
      depositTileMatter(ti, s, amount);
      store[s] = 0;
    }
}
function finalizeCorpse(id) {
  const ident = W.components.identity[id],
    life = W.components.life[id],
    p = W.components.position[id];
  if (p) releaseEntityMatter(id, idx(p.x, p.y));
  W.historicalIdentities[id] = {
    ...ident,
    kind: "corpse",
    name: ident.generatedName,
    lifeSummary: life
      ? {
          age: life.age,
          causeOfDeath: life.causeOfDeath,
          deathEventId: ident.deathEventId,
          deathTick: life.deathTick,
        }
      : null,
  };
  removeEntity(id);
}
function corpseDeathTick(id) {
  const life = W.components.life[id];
  if (Number.isFinite(life?.deathTick)) return life.deathTick;
  const event = eventById(W.components.identity[id]?.deathEventId || 0),
    tick = Number.isFinite(event?.tick) ? event.tick : -1;
  if (life) life.deathTick = tick;
  return tick;
}
function capCorpses() {
  const corpses = W.activeIds.filter((id) => W.kind[id] === KINDS.CORPSE);
  if (corpses.length <= CAPS.corpse) return;
  corpses.sort((a, b) => corpseDeathTick(a) - corpseDeathTick(b) || a - b);
  const excess = corpses.length - CAPS.corpse;
  for (let n = 0; n < excess; n++) finalizeCorpse(corpses[n]);
}
function settlementDisease(s) {
  return clamp(
    (s.inventory[C.PATHOGEN] + W.tiles.chem[C.PATHOGEN][idx(s.x, s.y)]) /
      (8 + settlementPopulation(s)) -
      (s.knownProcesses.includes("medicine") ? 18 : 0),
    0,
    100,
  );
}
