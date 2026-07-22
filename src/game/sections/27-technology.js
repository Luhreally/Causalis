// ═══════════════════════════════════════════════════════════════════════════
// 27. TECHNOLOGY AND DISCOVERY
// ═══════════════════════════════════════════════════════════════════════════
function hasMaterial(s, sp) {
  const ti = idx(s.x, s.y),
    local = sp < COMMON_CHEM ? W.tiles.chem[sp][ti] : W.tiles.rareChem[`${ti}:${sp}`] || 0;
  return s.inventory[sp] > 8 || s.structure.composition[sp] > 8 || local > 8;
}
function observedNear(s, type) {
  for (let i = W.events.length - 1; i >= 0 && i > W.events.length - 600; i--) {
    const e = W.events[i];
    if (e.type !== type) continue;
    const local = e.location >= 0 && dist2(...xy(e.location), s.x, s.y) < 225,
      worldwide = e.data?.global === true,
      factionKnowledge = !!s.factionId && e.factions.includes(s.factionId);
    if (local || worldwide || factionKnowledge) return e.id;
  }
  return 0;
}
function factionHasTech(factionId, techId) {
  return (
    !!factionId &&
    W.settlements.some(
      (s) => !s.ruined && s.factionId === factionId && s.knownProcesses.includes(techId),
    )
  );
}
function settlementHasStructure(s, required) {
  const ti = idx(s.x, s.y),
    composition = s.structure.composition,
    pattern = STRUCTURE_PATTERNS[s.structure.patternId],
    built = completedBuildings(s),
    builtAmount = (sp) => built.reduce((n, b) => n + (b.composition?.[sp] || 0), 0),
    hasBuilt = (...types) => built.some((b) => types.includes(b.type));
  if (pattern === required) return true;
  switch (required) {
    case "ceramic matrix":
      return (
        composition[C.CERAMIC] > 3 ||
        s.inventory[C.CERAMIC] > 3 ||
        hasMaterial(s, C.CERAMIC) ||
        (hasBuilt("hearth", "kiln", "forge") &&
          builtAmount(C.CERAMIC) + builtAmount(C.MINERAL) > 5) ||
        (s.knownProcesses.includes("controlled_fire") &&
          s.inventory[C.MINERAL] > 8 &&
          s.inventory[C.FUEL] > 5)
      );
    case "compact soil":
      return hasBuilt("farm") || (W.tiles.soilOrder[ti] > 300 && tileMoisture(ti) > 10);
    case "storage tissue":
      return (
        hasBuilt("stockpile") ||
        (s.storageCapacity >= 200 &&
          s.structure.integrity > 250 &&
          (composition[C.FIBER] + composition[C.ORGANIC] > 5 ||
            s.inventory[C.FIBER] + s.inventory[C.ORGANIC] > 8))
      );
    case "composite":
      return (
        (hasBuilt("workshop", "forge") &&
          builtAmount(C.MINERAL) + builtAmount(C.FIBER) + builtAmount(C.METAL) > 8) ||
        composition[C.MINERAL] + composition[C.FIBER] + composition[C.METAL] > 12 ||
        s.inventory[C.MINERAL] + s.inventory[C.FIBER] > 18
      );
    case "fibrous producer tissue":
      return (
        (hasBuilt("farm") && builtAmount(C.FIBER) + builtAmount(C.ORGANIC) > 3) ||
        (W.tiles.plantOrder[ti] > 160 &&
          (W.tiles.chem[C.ORGANIC][ti] > 20 || s.inventory[C.FIBER] > 3))
      );
    default:
      return false;
  }
}
function settlementTemperatureCapacity(s, tech, observations = []) {
  const ti = idx(s.x, s.y),
    [cx, cy] = xy(ti),
    stored = (sp) => (s.inventory?.[sp] || 0) + (s.researchInventory?.[sp] || 0);
  let available = Math.max(s.productionTemperature || 20, W.tiles.temperature[ti] / 10);
  for (let y = Math.max(0, cy - 4); y <= Math.min(W.height - 1, cy + 4); y++)
    for (let x = Math.max(0, cx - 4); x <= Math.min(W.width - 1, cx + 4); x++) {
      const i = idx(x, y);
      available = Math.max(available, W.tiles.temperature[i] / 10 + W.tiles.fire[i] / 8);
    }
  if (tech.id === "controlled_fire" && observations.length && stored(C.FUEL) > 8)
    available = Math.max(available, 420);
  if (s.knownProcesses.includes("controlled_fire") && stored(C.FUEL) > 5)
    available = Math.max(available, 480);
  if (
    (tech.id === "ceramics" || s.knownProcesses.includes("ceramics")) &&
    s.knownProcesses.includes("controlled_fire") &&
    stored(C.FUEL) > 8
  )
    available = Math.max(available, 560);
  if (tech.id === "metalworking" && s.knownProcesses.includes("ceramics") && stored(C.FUEL) > 12)
    available = Math.max(available, 760);
  return available;
}
function updateTechnology() {
  for (const s of W.settlements) {
    if (s.ruined || settlementPopulation(s) < 4 || s.stability < 0.25) continue;
    for (const tech of TECH_BASE) {
      if (
        s.knownProcesses.includes(tech.id) ||
        !tech.prior.every((p) => s.knownProcesses.includes(p)) ||
        !tech.materials.every((m) => hasMaterial(s, m))
      )
        continue;
      const obs = tech.observed.map((t) => observedNear(s, t)).filter(Boolean);
      if (!obs.length || !tech.structures.every((req) => settlementHasStructure(s, req))) continue;
      const availableTemperature = settlementTemperatureCapacity(s, tech, obs);
      if (availableTemperature < (tech.heat || 0)) continue;
      const inventive = W.factions.find((f) => f.id === s.factionId)?.ethos.inventive || 0.5,
        materialDiversity = s.inventory.filter((v) => v > 3).length,
        score =
          settlementPopulation(s) * s.stability * (0.6 + inventive) * W.laws.technologyRate +
          materialDiversity;
      const threshold = 10 + tech.prior.length * 8;
      if (score < threshold) continue;
      const timing = counterRand("technology", Math.floor(W.tick / 128), s.id, hashString(tech.id));
      if (timing > clamp((score - threshold) / 40 + 0.15, 0, 0.85)) continue;
      s.knownProcesses.push(tech.id);
      s.observations.push(...obs);
      const discoverer = entityAtRadius(idx(s.x, s.y), 7, KINDS.PERSON).sort(
          (a, b) =>
            phenotype(b).sense +
              W.components.identity[b].significance -
              phenotype(a).sense -
              W.components.identity[a].significance || a - b,
        )[0],
        ev = emitEvent("TechAdvanceEvent", {
          subjects: [discoverer, s.entityId].filter(Boolean),
          location: idx(s.x, s.y),
          factions: [s.factionId],
          causes: obs,
          evidence: [
            `available ${W.definitions.species[tech.materials[0]].name}`,
            `required arrangement: ${tech.structures.join(", ") || "open workspace"}`,
            `reproducible temperature ${Math.round(availableTemperature)}°`,
            `stable population of ${settlementPopulation(s)}`,
            `preserved prior processes: ${tech.prior.join(", ") || "none"}`,
          ],
          importance: 4,
          data: { name: tech.name, process: tech.process, risk: tech.risk, settlement: s.name },
        });
      s.importantEvents.push(ev.id);
      W.technologies.push({
        id: W.technologies.length + 1,
        definitionId: tech.id,
        settlementId: s.id,
        discovererId: discoverer,
        tick: W.tick,
        eventId: ev.id,
        temperature: Math.round(availableTemperature),
        structure: tech.structures.slice(),
      });
      if (discoverer) {
        W.components.identity[discoverer].significance += 6;
        remember(discoverer, ev.id, "discovery");
      }
    }
    if (
      s.knownProcesses.length >= 3 &&
      W.artifacts.length < 100 &&
      counterRand("artifact", W.tick, s.id) < 0.08
    )
      queueEffect(
        "CreateArtifact",
        {
          settlementId: s.id,
          creatorId: entityAtRadius(idx(s.x, s.y), 7, KINDS.PERSON)[0],
          causeEvent: s.importantEvents.at(-1) || 0,
        },
        s.entityId,
      );
  }
}
function createArtifact(settlementId, creatorId, cause = 0) {
  const s = W.settlements.find((x) => x.id === settlementId);
  if (!s || !creatorId) return null;
  const materialId =
    s.inventory[C.METAL] > 5 ? C.METAL : s.inventory[C.CRYSTAL] > 5 ? C.CRYSTAL : C.MINERAL;
  if (s.inventory[materialId] < 3) return null;
  s.inventory[materialId] -= 3;
  const id = allocEntity(KINDS.ARTIFACT),
    r = makeRng(hashParts(W.seedHash, W.tick, creatorId), "artifact"),
    name = `${NAME_B[r.int(NAME_B.length)]} ${["Edge", "Lens", "Vessel", "Seal", "Crown", "Needle"][r.int(6)]}`,
    q = new Uint16Array(SPECIES_COUNT);
  q[materialId] = 3;
  const a = {
    id: W.artifacts.length + 1,
    entityId: id,
    name,
    creatorId,
    materialId,
    composition: q,
    structure: {
      patternId: materialId === C.METAL ? 11 : materialId === C.CRYSTAL ? 2 : 12,
      order: 700 + r.int(250),
      integrity: 900,
    },
    quality: 50 + r.int(50),
    creationTick: W.tick,
    ownerId: creatorId,
    settlementId: s.id,
    eventIds: [cause],
    damage: 0,
    culturalMeaning: 0,
  };
  W.artifacts.push(a);
  W.components.position[id] = { x: s.x, y: s.y, layer: 0, regionId: regionId(s.x, s.y) };
  W.components.identity[id] = {
    generatedName: name,
    significance: 4,
    notable: true,
    titles: ["Artifact"],
  };
  W.components.chemistry[id] = {
    q,
    temperature: 20,
    storedFreeEnergy: 0,
    structuralOrder: a.structure.order,
    phaseFractions: { solid: 100, liquid: 0, gas: 0 },
  };
  W.components.identity[creatorId].artifacts.push(id);
  W.components.inventory[creatorId]?.artifactIds?.push(id);
  const ev = emitEvent("ArtifactCreatedEvent", {
    subjects: [creatorId, id],
    location: idx(s.x, s.y),
    factions: [s.factionId],
    causes: [cause],
    evidence: ["available processed material", "reproducible structural knowledge"],
    importance: 3,
    data: { name, material: W.definitions.species[materialId].name, quality: a.quality },
  });
  a.eventIds.push(ev.id);
  addRelation(creatorId, id, "created", 1, ev.id);
  addRelation(creatorId, id, "owns", 1, ev.id);
  return a;
}
