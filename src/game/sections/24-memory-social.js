// ═══════════════════════════════════════════════════════════════════════════
// 24. MEMORY, RELATIONSHIPS, AND SOCIAL BEHAVIOR
// ═══════════════════════════════════════════════════════════════════════════
const createOffspringSelected = createOffspring;
createOffspring = function (kind, parents, tile) {
  const id = createOffspringSelected(kind, parents, tile),
    generation =
      1 + Math.max(0, ...parents.map((parent) => W.components.life[parent]?.generation || 0));
  tuneGenomeToHabitat(
    id,
    tile,
    0.16,
    W.components.life[parents[0]]?.emergenceStage || "multicellular",
    generation,
  );
  for (const parent of parents)
    W.components.reproduction[parent].cooldown =
      900 + Math.floor(counterRand("sexual-recovery", W.tick, parent, id) * 600);
  const byKind =
    W.statistics.birthsByKind ||
    (W.statistics.birthsByKind = { herbivore: 0, predator: 0, person: 0 });
  byKind[kind] = (byKind[kind] || 0) + 1;
  return id;
};
const updatePairedReproduction = updateReproduction;
updateReproduction = function () {
  const ids = W.activeIds
      .filter(
        (id) =>
          [KINDS.HERBIVORE, KINDS.PREDATOR, KINDS.PERSON].includes(W.kind[id]) &&
          (W.kind[id] === KINDS.PREDATOR ? canJoinPredatorPair(id) : canReproduce(id)),
      )
      .sort(
        (a, b) =>
          counterRand("reproduction-order", Math.floor(W.tick / 16), a) -
            counterRand("reproduction-order", Math.floor(W.tick / 16), b) || a - b,
      ),
    used = new Set();
  for (const id of ids) {
    const kind = W.kind[id];
    if (used.has(id) || !(kind === KINDS.PREDATOR ? canJoinPredatorPair(id) : canReproduce(id)))
      continue;
    const p = W.components.position[id],
      radius = kind === KINDS.PERSON ? 7 : 4,
      mates = nearbyIds(
        id,
        radius,
        (other) =>
          other !== id &&
          W.kind[other] === kind &&
          (kind === KINDS.PREDATOR
            ? canJoinPredatorPair(other) && predatorPairHasMatter(id, other)
            : canReproduce(other)) &&
          !used.has(other),
      ).sort((a, b) => mateChoiceScore(id, b) - mateChoiceScore(id, a) || a - b),
      mate = mates.find((candidate) => Number.isFinite(mateChoiceScore(id, candidate)));
    if (!mate) continue;
    const parents = [id, mate],
      tile = idx(p.x, p.y);
    if (activeCount(kind) < CAPS[kind]) createOffspring(kind, parents, tile);
    else {
      const r = makeRng(hashParts(W.seedHash, W.tick, id, mate), "cohort-sexual-birth"),
        g = genomeFrom(r, kind, W.components.genome[id], W.components.genome[mate]),
        chem = makeCohortBirthMatter(parents);
      addBirthToCohort(kind, p.regionId, parents, chem, g);
      for (const parent of parents) W.components.reproduction[parent].cooldown = 1100;
    }
    used.add(id);
    used.add(mate);
  }
};
function remember(id, eventId, emotion = "observed") {
  const m = W.components.memory[id];
  if (!m) return;
  m.rememberedEvents.push(eventId);
  m.ring.push({ eventId, tick: W.tick, emotion });
  if (m.rememberedEvents.length > 30) m.rememberedEvents.shift();
  if (m.ring.length > 16) m.ring.shift();
}
function rememberFearLocation(id, tile) {
  const memory = W.components.memory[id];
  if (!memory) return;
  memory.fearLocations = (memory.fearLocations || []).filter((entry) => {
    const rememberedTile = typeof entry === "number" ? entry : entry?.tile;
    return rememberedTile !== tile;
  });
  memory.fearLocations.push({ tile, tick: W.tick });
  if (memory.fearLocations.length > 16)
    memory.fearLocations.splice(0, memory.fearLocations.length - 16);
}
function fearMemoryStrength(id, tile) {
  const entries = W.components.memory[id]?.fearLocations || [];
  let strongest = 0;
  for (const entry of entries) {
    if (typeof entry === "number") {
      if (entry === tile) strongest = Math.max(strongest, 0.2);
      continue;
    }
    if (entry?.tile !== tile) continue;
    strongest = Math.max(strongest, clamp(1 - (W.tick - entry.tick) / 1536, 0, 1));
  }
  return strongest;
}
function decayMemories() {
  for (const id of W.activeIds) {
    const m = W.components.memory[id];
    if (!m) continue;
    m.fearLocations = (m.fearLocations || [])
      .filter((entry) => typeof entry !== "object" || W.tick - entry.tick < 1536)
      .slice(-16);
    for (const k of Object.keys(m.socialMemories)) m.socialMemories[k] *= 0.995;
  }
}
function socialCohesionAt(i) {
  const ids = [],
    [cx, cy] = xy(i);
  for (let y = Math.max(0, cy - 3); y <= Math.min(W.height - 1, cy + 3); y++)
    for (let x = Math.max(0, cx - 3); x <= Math.min(W.width - 1, cx + 3); x++)
      for (const id of W.spatialBins[idx(x, y)] || [])
        if (W.kind[id] === KINDS.PERSON) ids.push(id);
  return ids.length ? mean(ids.map((id) => phenotype(id).cooperation)) * W.laws.socialCohesion : 0;
}
function assignPartners() {
  const people = W.activeIds.filter(
    (id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && !W.components.social[id].partnerId,
  );
  for (const id of people) {
    const near = nearbyIds(
        id,
        2,
        (o) => W.kind[o] === KINDS.PERSON && !W.components.social[o].partnerId,
      ),
      mate = near.find((o) => (W.components.social[id].trust[o] || 0) > 0.48);
    if (mate) {
      W.components.social[id].partnerId = mate;
      W.components.social[mate].partnerId = id;
      addRelation(id, mate, "partner_of", 1);
      addRelation(mate, id, "partner_of", 1);
    }
  }
}
