// ═══════════════════════════════════════════════════════════════════════════
// 18. MATERIAL AND RESOURCE SYSTEMS
// ═══════════════════════════════════════════════════════════════════════════
function constructionPotential(inv) {
  const mat = inv[C.MINERAL] + inv[C.FIBER] * 0.8 + inv[C.METAL] * 1.8 + inv[C.CERAMIC] * 1.2,
    tox = inv[C.TOXIN];
  return Math.max(0, (mat - tox * 0.3) / 50);
}
function toolQuality(inv, structure = 500) {
  const metal = inv[C.METAL] * 1.8,
    crystal = inv[C.CRYSTAL] * 1.1,
    fiber = inv[C.FIBER] * 0.5;
  return clamp(((metal + crystal + fiber) * structure) / 500000, 0, 100);
}
function carriedToolQuality(personId) {
  const inventory = W.components.inventory[personId],
    ids = inventory?.artifactIds || [];
  let quality = 0;
  for (const id of ids) {
    const a = W.artifacts.find((x) => x.entityId === id);
    if (a && a.damage < a.structure.integrity)
      quality +=
        (a.quality * (a.structure.integrity - a.damage)) / Math.max(1, a.structure.integrity);
  }
  return clamp(quality / 6, 0, 28);
}
function extractMatter(personId, tile, s) {
  const inv = W.components.inventory[personId].materials,
    q = W.tiles.chem,
    hard = W.definitions.materials.find((m) => m.speciesId === s)?.hardness || 1,
    tool = toolQuality(inv) + carriedToolQuality(personId) + 10,
    amount = Math.max(1, Math.floor(tool / (hard * 12)));
  if (s < COMMON_CHEM) {
    const got = Math.min(amount, q[s][tile], 65535 - inv[s]);
    q[s][tile] -= got;
    inv[s] += got;
    return got;
  }
  const key = `${tile}:${s}`,
    rare = Math.min(amount, W.tiles.rareChem[key] || 0, 65535 - inv[s]);
  if (rare) {
    W.tiles.rareChem[key] -= rare;
    inv[s] += rare;
    return rare;
  }
  if (s === C.FIBER) {
    const raw = Math.min(amount, q[C.ORGANIC][tile], 65535 - inv[C.ORGANIC]);
    q[C.ORGANIC][tile] -= raw;
    inv[C.ORGANIC] += raw;
    return executeProcess("fiber_curing", invArray(inv), raw);
  }
  return 0;
}
function updateMaterialProcesses() {
  for (const s of W.settlements) {
    if (s.ruined) continue;
    const inv = invSettlement(s),
      ti = idx(s.x, s.y),
      record = W.tick % 128 === 0,
      processContext = {
        location: ti,
        subjects: [s.entityId],
        factions: s.factionId ? [s.factionId] : [],
        causes: [s.importantEvents.at(-1) || 0],
        eventSink: s.importantEvents,
        recordEvent: record,
      };
    if (
      s.knownProcesses.includes("controlled_fire") &&
      s.inventory[C.FUEL] > 2 &&
      W.tick % 64 === 0
    ) {
      const oxidant = Math.min(3, W.tiles.chem[C.OXIDANT][ti], 65535 - s.inventory[C.OXIDANT]);
      W.tiles.chem[C.OXIDANT][ti] -= oxidant;
      s.inventory[C.OXIDANT] += oxidant;
      s.productionTemperature = Math.max(s.productionTemperature || 20, 420);
      executeProcess("combustion", inv, 1);
    }
    if (s.knownProcesses.includes("agriculture") && W.tick % 64 === 0) {
      const solar = reactionById("photosynthesis")?.externalEnergyRequirement || 0,
        grew = executeProcess("photosynthesis", invTile(ti), 2, { externalEnergy: solar });
      if (grew) W.tiles.plantOrder[ti] = u16(W.tiles.plantOrder[ti] + grew * 6);
    }
    if (
      s.knownProcesses.includes("metalworking") &&
      s.inventory[C.ORE] > 20 &&
      s.inventory[C.FUEL] > 20
    ) {
      s.productionTemperature = 760;
      executeProcess("smelting", inv, 2, processContext);
    }
    if (
      s.knownProcesses.includes("ceramics") &&
      s.inventory[C.MINERAL] > 18 &&
      s.inventory[C.FUEL] > 8
    ) {
      s.productionTemperature = 560;
      executeProcess("ceramic_firing", inv, 1, processContext);
    }
    if (
      s.knownProcesses.includes("drying") &&
      s.inventory[C.ORGANIC] > 20 &&
      s.inventory[C.CATALYST] > 0
    )
      executeProcess("fermentation", inv, 2);
    if (
      s.knownProcesses.includes("medicine") &&
      s.inventory[C.ORGANIC] > 8 &&
      s.inventory[C.NUTRIENT] > 8 &&
      s.inventory[C.CATALYST] > 0
    )
      executeProcess("medicine_synthesis", inv, 1, processContext);
    if (
      s.knownProcesses.includes("writing") &&
      s.inventory[C.INFO] > 2 &&
      s.inventory[C.ENERGY] > 2 &&
      s.inventory[C.NUTRIENT] > 2
    )
      executeProcess("polymer_copying", inv, 1, processContext);
    if (
      s.knownProcesses.includes("irrigation") &&
      s.inventory[C.MINERAL] > 2 &&
      s.inventory[C.SOLVENT] > 4
    )
      executeProcess("dissolution", inv, 1);
    if (
      s.knownProcesses.includes("storage") &&
      s.inventory[C.NUTRIENT] > 12 &&
      s.inventory[C.SOLVENT] > 2 &&
      W.tick % 256 === 0
    )
      executeProcess("crystallization", inv, 1);
    if (s.inventory[C.METAL] > 5 && s.inventory[C.SOLVENT] > 20 && W.tick % 256 === 0)
      executeProcess("corrosion", inv, 1);
    if (s.knownProcesses.includes("tools") && W.tick % 256 === 0 && W.artifacts.length < 100) {
      const maker = entityAtRadius(ti, 7, KINDS.PERSON)
          .filter(classifyAlive)
          .find((id) => !(W.components.inventory[id]?.artifactIds || []).length),
        cause =
          W.technologies.find((t) => t.settlementId === s.id && t.definitionId === "tools")
            ?.eventId || 0;
      if (maker) createArtifact(s.id, maker, cause);
    }
  }
}
