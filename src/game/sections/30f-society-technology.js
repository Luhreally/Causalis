// ═══════════════════════════════════════════════════════════════════════════
// 30f. SOCIETY — TECHNOLOGY: research, knowledge, stages and the epoch
// ═══════════════════════════════════════════════════════════════════════════
// Which facility a craft wants, the evidence a discovery rests on, the research
// tick and its layers, knowledge shared across a polity, the development
// stage of a settlement, the gates between civilisation stages, progression,
// and the epoch's name and summary.
// This section was one file of four thousand nine hundred lines, 30a-material-
// society.js, split in six along its own seams on 2026-09-14; the composed
// runtime is unchanged, and `scripts/who-overrides.cjs <name>` shows a
// function's layers across them.
function facilityForTechnology(id) {
  const declared = technologyDefinition(id)?.facility;
  if (declared) return declared;
  if (id === "controlled_fire" || id === "drying") return "hearth";
  if (
    id === "tools" ||
    id === "masonry" ||
    id === "irrigation" ||
    id === "waterworks" ||
    id === "medicine" ||
    id === "writing" ||
    id === "navigation"
  )
    return "workshop";
  if (id === "ceramics") return "hearth";
  if (id === "metalworking") return "kiln";
  if (id === "sanitation") return "clinic";
  if (id === "governance" || id === "planetary_stewardship") return "archive";
  if (id === "logistics" || id === "public_works") return "hall";
  return null;
}
function researchObservationEvidence(s, tech) {
  s.researchEvidence = s.researchEvidence || {};
  const remembered = (s.researchEvidence[tech.id] || []).filter(Boolean);
  if (remembered.length) return remembered;
  const direct = (tech.observed || []).map((type) => observedNear(s, type)).filter(Boolean);
  if (direct.length) {
    s.researchEvidence[tech.id] = direct;
    return direct;
  }
  const ti = idx(s.x, s.y),
    toolTradition = functionalToolsAtPlace(s, "build").length > 0,
    founding =
      s.importantEvents?.[0] ||
      W.lastEventByType.SettlementFoundedEvent ||
      W.lastEventByType.CampFoundedEvent ||
      0;
  let grounded = false;
  if (tech.id === "controlled_fire" || tech.id === "ceramics")
    grounded = placeHasFacility(s, "hearth");
  else if (tech.id === "drying")
    grounded = W.tiles.temperature[ti] / 10 > 18 || W.weather.name === "Drought";
  else if (tech.id === "agriculture")
    grounded = placeHasFacility(s, "farm") || W.tiles.plantOrder[ti] > 160;
  else if (tech.id === "tools") grounded = toolTradition;
  else if (tech.id === "storage")
    grounded = placeHasFacility(s, "stockpile") && s.knownProcesses.includes("controlled_fire");
  else if (tech.id === "medicine")
    grounded = W.tiles.chem[C.PATHOGEN][ti] > 0 || W.tick - s.foundedTick > 384;
  else if (tech.id === "metalworking")
    grounded = s.knownProcesses.includes("ceramics") && s.inventory[C.ORE] > 0;
  else if (tech.id === "irrigation") grounded = s.knownProcesses.includes("agriculture");
  else if (tech.id === "writing") grounded = !!W.lastEventByType.TechAdvanceEvent;
  else if (tech.id === "fortification")
    grounded =
      placeHasFacility(s, "wall") ||
      s.management?.policy === "fortified" ||
      W.tiles.danger[ti] > 50;
  else if (tech.id === "navigation")
    grounded = W.components.identity[s.founderId]?.migrations > 0 || W.tick - s.foundedTick > 512;
  else if (tech.id === "governance") grounded = !!s.factionId;
  else grounded = !!founding;
  if (grounded && founding) {
    s.researchEvidence[tech.id] = [founding];
    return [founding];
  }
  return [];
}
function researchThreshold(tech) {
  return tech.threshold || 20 + (tech.prior?.length || 0) * 11;
}
// The current line of inquiry persists while it stays feasible; otherwise the settlement
// commits to the feasible topic with the most accumulated notes, then the cheapest one.
function chooseResearchFocus(s, eligible) {
  const current = eligible.find((entry) => entry.tech.id === s.researchFocus);
  if (current) return current;
  const ranked = eligible
    .slice()
    .sort(
      (a, b) =>
        (s.researchProgress[b.tech.id] || 0) - (s.researchProgress[a.tech.id] || 0) ||
        researchThreshold(a.tech) - researchThreshold(b.tech),
    );
  s.researchFocus = ranked[0]?.tech.id || "";
  return ranked[0] || null;
}
function neighborPracticesProcess(s, techId) {
  const reach2 = RESEARCH_NEIGHBOR_REACH * RESEARCH_NEIGHBOR_REACH;
  return W.settlements.some(
    (other) =>
      other !== s &&
      !other.ruined &&
      other.knownProcesses.includes(techId) &&
      dist2(other.x, other.y, s.x, s.y) <= reach2,
  );
}
// Whom a town learns a craft from, and how much faster for it. The best
// teacher sets the pace: the polity's archive (4), the ruins of those who came
// before (3), a sister town of the same polity (3), a neighbour who practises it
// (1.8), or the world's memory of a craft once known (1.8); none, and the town
// works it out alone. Every craft some town has found is in that memory from
// the day it is found, and the memory's pace used to stand in for the
// polity's and the neighbour's, so a sister town learned what its own polity
// practised no faster than a stranger to it. Null when no one teaches.
const RESEARCH_TEACHERS = Object.freeze({
  archive: Object.freeze({
    pace: 4,
    evidence: "the craft was learned from the records in the polity's archive",
  }),
  ruin: Object.freeze({
    pace: 3,
    evidence: "surviving practices were studied in the ruins of those who came before",
  }),
  sister: Object.freeze({
    pace: 3,
    evidence: "a sister town of the same polity already practised the process",
  }),
  neighbour: Object.freeze({
    pace: 1.8,
    evidence: "a neighboring people already practiced the process",
  }),
  memory: Object.freeze({
    pace: 1.8,
    evidence: "fragments of a fallen people's knowledge guided the work",
  }),
});
function researchTeacher(
  s,
  techId,
  recorded = typeof processRecorded === "function" && processRecorded(s, techId),
) {
  const legacy = (W.civilization?.legacyProcesses || []).includes(techId);
  if (legacy && recorded) return RESEARCH_TEACHERS.archive;
  if (
    legacy &&
    W.settlements.some(
      (ruin) =>
        ruin.ruined &&
        ruin.knownProcesses?.includes(techId) &&
        dist2(ruin.x, ruin.y, s.x, s.y) <= 196,
    )
  )
    return RESEARCH_TEACHERS.ruin;
  if (
    s.factionId &&
    W.settlements.some(
      (other) =>
        other !== s &&
        !other.ruined &&
        other.factionId === s.factionId &&
        other.knownProcesses.includes(techId),
    )
  )
    return RESEARCH_TEACHERS.sister;
  if (neighborPracticesProcess(s, techId)) return RESEARCH_TEACHERS.neighbour;
  return legacy ? RESEARCH_TEACHERS.memory : null;
}
function updateTechnology() {
  const catalog = techCatalog();
  for (const s of W.settlements) {
    if (s.ruined || settlementPopulation(s) < 1 || s.stability < 0.2) continue;
    s.researchProgress = s.researchProgress || {};
    const eligible = [];
    for (const tech of catalog) {
      if (
        s.knownProcesses.includes(tech.id) ||
        !(tech.prior || []).every((p) => s.knownProcesses.includes(p)) ||
        !(tech.materials || []).every((m) => hasResearchMaterial(s, m))
      )
        continue;
      const facility = facilityForTechnology(tech.id);
      if (facility && !placeHasFacility(s, facility)) continue;
      // A rare craft opens only to a town that has seen the thing itself (106).
      if (typeof tech.gate === "function" && !tech.gate(s)) continue;
      const base = TECH_BASE.includes(tech),
        // A process the polity holds on record needs no fresh observation.
        recorded = typeof processRecorded === "function" && processRecorded(s, tech.id),
        observed = base ? researchObservationEvidence(s, tech) : [],
        obs =
          base && (observed.length || !recorded)
            ? observed
            : [s.importantEvents.at(-1) || W.lastEventByType.TechAdvanceEvent || 0].filter(Boolean);
      if (base && !obs.length) continue;
      if (base && !(tech.structures || []).every((req) => settlementHasStructure(s, req))) continue;
      const temperature = base
        ? settlementTemperatureCapacity(s, tech, obs)
        : s.productionTemperature || 20;
      if (base && temperature < (tech.heat || 0)) continue;
      eligible.push({ tech, facility, base, obs, temperature });
    }
    if (!eligible.length) {
      s.researchFocus = "";
      continue;
    }
    const focus = chooseResearchFocus(s, eligible),
      faction = W.factions.find((f) => f.id === s.factionId),
      inventive = faction?.ethos.inventive || 0.5,
      pop = settlementPopulation(s),
      knowledgePriority = s.management?.priorities?.knowledge || 2,
      workers = entityAtRadius(idx(s.x, s.y), 8, KINDS.PERSON).filter(
        (id) =>
          ["craft", "build"].includes(workState(id).task) ||
          W.components.cognition[id]?.dominant === "work",
      ).length,
      // Population and specialists both help, with diminishing returns: a village of twenty
      // needs about a generation per discovery, a city of sixty roughly half that.
      baseRate =
        (Math.min(pop, 60) * 0.12 + Math.min(workers, 12) * 0.4 + knowledgePriority * 0.35) *
        s.stability *
        (0.65 + inventive) *
        W.laws.technologyRate *
        RESEARCH_TEMPO *
        // Mathematics, printing, and computing quicken inquiry (87).
        (typeof researchTempoFactor === "function" ? researchTempoFactor(s) : 1) *
        // A causal skip is a concerted push, not a warp: it triples inquiry rather than
        // compressing a generation of research into a season.
        (concertedIntensity() ? 3 * concertedIntensity() : 1);
    for (const entry of eligible) {
      const { tech, facility, base, obs, temperature } = entry,
        recorded = typeof processRecorded === "function" && processRecorded(s, tech.id),
        teacher = researchTeacher(s, tech.id, recorded),
        rate = baseRate * (teacher?.pace || 1) * (entry === focus ? 1 : RESEARCH_SIDE_SHARE),
        threshold = researchThreshold(tech) * (recorded ? 0.5 : 1);
      s.researchProgress[tech.id] = (s.researchProgress[tech.id] || 0) + rate;
      if (s.researchProgress[tech.id] < threshold) continue;
      s.knownProcesses.push(tech.id);
      const civ = (W.civilization = W.civilization || {});
      civ.legacyProcesses = civ.legacyProcesses || [];
      if (!civ.legacyProcesses.includes(tech.id)) {
        civ.legacyProcesses.push(tech.id);
        civ.legacyProcesses.sort();
      }
      s.observations.push(...obs);
      const discoverer = entityAtRadius(idx(s.x, s.y), 8, KINDS.PERSON).sort(
          (a, b) =>
            (W.components.cognition[b]?.confidence || 0) +
              phenotype(b).sense -
              (W.components.cognition[a]?.confidence || 0) -
              phenotype(a).sense || a - b,
        )[0],
        ev = emitEvent("TechAdvanceEvent", {
          subjects: [discoverer, s.entityId].filter(Boolean),
          location: idx(s.x, s.y),
          factions: [s.factionId],
          causes: obs,
          evidence: [
            `sustained research reached ${threshold.toFixed(0)} work units`,
            `${(tech.materials || []).map((sp) => W.definitions.species[sp].name).join(" + ")} were physically stockpiled`,
            facility
              ? `${BUILDING_DEFS[facility]?.name || facility} supplied a real workspace`
              : "open-air observation supplied the workspace",
            teacher?.evidence || `knowledge priority ${knowledgePriority}/5`,
          ],
          importance: 4,
          data: {
            name: tech.name,
            process: tech.process || "civic engineering",
            risk: tech.risk || "system complexity",
            settlement: s.name,
          },
        });
      s.importantEvents.push(ev.id);
      W.technologies.push({
        id: W.technologies.length + 1,
        definitionId: tech.id,
        settlementId: s.id,
        discovererId: discoverer,
        tick: W.tick,
        eventId: ev.id,
        temperature: Math.round(temperature),
        structure: [facility].filter(Boolean),
      });
      if (discoverer) {
        W.components.identity[discoverer].significance += 6;
        remember(discoverer, ev.id, "discovery");
      }
      ensurePlacePlans(s);
    }
  }
}
function shareFactionKnowledge() {
  if (W.tick % 256) return;
  const catalog = techCatalog();
  for (const faction of W.factions) {
    const places = W.settlements
      .filter((s) => !s.ruined && s.factionId === faction.id)
      .sort((a, b) => a.id - b.id);
    if (places.length < 2 || !places.some((s) => s.knownProcesses.includes("writing"))) continue;
    for (const target of places) {
      if (settlementPopulation(target) < 4 || target.stability < 0.2) continue;
      // A craft taught by a sister town needs no research samples in the
      // learner's stores: the samples were the discoverer's; the learner still
      // needs the facility, the heat, and the structures to practise it. Without
      // this, current and engines never reached the villages of a polity that
      // had them, and the hub could not be taught what its neighbour knew.
      const transferable = catalog.find(
        (tech) =>
          !target.knownProcesses.includes(tech.id) &&
          (tech.prior || []).every((id) => target.knownProcesses.includes(id)) &&
          (!facilityForTechnology(tech.id) ||
            placeHasFacility(target, facilityForTechnology(tech.id))) &&
          (!TECH_BASE.includes(tech) ||
            (tech.structures || []).every((req) => settlementHasStructure(target, req))) &&
          places.some((source) => source !== target && source.knownProcesses.includes(tech.id)),
      );
      if (!transferable) continue;
      const source = places.find((s) => s !== target && s.knownProcesses.includes(transferable.id)),
        facility = facilityForTechnology(transferable.id),
        temperature = TECH_BASE.includes(transferable)
          ? settlementTemperatureCapacity(target, transferable, [
              source.importantEvents.at(-1) || 1,
            ])
          : target.productionTemperature || 20;
      if (TECH_BASE.includes(transferable) && temperature < (transferable.heat || 0)) continue;
      target.knownProcesses.push(transferable.id);
      target.researchProgress = target.researchProgress || {};
      target.researchProgress[transferable.id] =
        transferable.threshold || 24 + (transferable.prior?.length || 0) * 14;
      const ev = emitEvent("TechAdvanceEvent", {
        subjects: [source.entityId, target.entityId],
        location: idx(target.x, target.y),
        factions: [faction.id],
        causes: [source.importantEvents.at(-1) || W.lastEventByType.TechAdvanceEvent || 0],
        evidence: [
          `${source.name} transmitted a recorded ${transferable.name} process`,
          `${target.name} held the required physical samples`,
          facility
            ? `${BUILDING_DEFS[facility].name} reproduced the process locally`
            : "local practitioners reproduced the process",
          "knowledge moved; matter did not",
        ],
        importance: 3,
        data: {
          name: transferable.name,
          process: transferable.process || "recorded civic practice",
          settlement: target.name,
          source: source.name,
        },
      });
      target.importantEvents.push(ev.id);
      W.technologies.push({
        id: W.technologies.length + 1,
        definitionId: transferable.id,
        settlementId: target.id,
        discovererId: 0,
        tick: W.tick,
        eventId: ev.id,
        temperature: Math.round(temperature),
        structure: [facility].filter(Boolean),
        transmittedFrom: source.id,
      });
      ensurePlacePlans(target);
    }
  }
}
const updateTechnologyKnowledgeBase = updateTechnology;
updateTechnology = function () {
  updateTechnologyKnowledgeBase();
  shareFactionKnowledge();
  if (W.tick % 256 !== 0) return;
  const culturalArtifacts = W.artifacts.filter((artifact) => !artifact.tool).length;
  if (culturalArtifacts >= 100) return;
  let artifactSlots = 100 - culturalArtifacts;
  for (const settlement of W.settlements.filter(
    (candidate) =>
      !candidate.ruined &&
      candidate.knownProcesses.includes("tools") &&
      candidate.knownProcesses.length >= 3,
  )) {
    if (artifactSlots <= 0) break;
    const maker = entityAtRadius(idx(settlement.x, settlement.y), 7, KINDS.PERSON)
      .filter((id) => peekAlive(id))
      .sort(
        (a, b) =>
          (W.components.identity[b]?.significance || 0) -
            (W.components.identity[a]?.significance || 0) ||
          counterRand("artifact-maker", Math.floor(W.tick / 256), settlement.id, a) -
            counterRand("artifact-maker", Math.floor(W.tick / 256), settlement.id, b) ||
          a - b,
      )[0];
    if (!maker) continue;
    queueEffect(
      "CreateArtifact",
      {
        settlementId: settlement.id,
        creatorId: maker,
        causeEvent: settlement.importantEvents.at(-1) || 0,
      },
      settlement.entityId,
    );
    artifactSlots--;
  }
};
function factionNetworkPopulation(s) {
  if (!s?.factionId) return settlementPopulation(s);
  return W.settlements
    .filter((x) => !x.ruined && x.factionId === s.factionId)
    .reduce((n, x) => n + settlementPopulation(x), 0);
}
function settlementStageShortfall(s, target) {
  const complete = completedBuildings(s),
    types = new Set(complete.map((b) => b.type)),
    known = new Set(s.knownProcesses),
    pop = settlementPopulation(s),
    network = factionNetworkPopulation(s),
    reached = ["village", "civic", "urban", "complex terrestrial"],
    missing = [];
  if (target === "village") {
    if (complete.length < 3) missing.push(`completed structures ${complete.length}/3`);
    return missing;
  }
  if (reached.indexOf(settlementDevelopmentStage(s)) >= reached.indexOf(target)) return missing;
  if (target === "civic") {
    if (!s.factionId) missing.push("form a faction");
    if (!types.has("hall")) missing.push("complete a Civic hall");
    if (!known.has("writing") && !known.has("governance"))
      missing.push("develop Polymer Inscription or Recorded Governance");
  } else if (target === "urban") {
    if (!types.has("hall")) missing.push("complete a Civic hall");
    if (!types.has("clinic")) missing.push("complete a Catalytic clinic");
    if (complete.length < 8) missing.push(`completed structures ${complete.length}/8`);
    if (pop < 24 && !(s.factionId && network >= 32))
      missing.push(`local population ${pop}/24 or faction network ${network}/32`);
  } else if (target === "complex terrestrial") {
    if (!known.has("planetary_stewardship")) missing.push("develop Planetary Stewardship");
    if (!known.has("mechanization")) missing.push("develop Terrestrial Mechanization");
    if (!known.has("electricity")) missing.push("develop Electricity");
    if (!types.has("waterworks")) missing.push("complete Waterworks");
  }
  return missing;
}
function civilizationGateStatus() {
  if (!W) return null;
  const authority = normalizeCivilizationAuthority(),
    next = CIV_STAGE_ORDER[authority.stageIndex + 1];
  if (!next) return null;
  if (next === "sapient foraging") {
    const people = biospherePopulation(KINDS.PERSON);
    return {
      next,
      requirement: "4 living people",
      leader: null,
      missing: people >= 4 ? [] : [`living people ${people}/4`],
    };
  }
  if (next === "tribal") {
    const places = [...W.camps.filter((c) => c.active), ...W.settlements.filter((s) => !s.ruined)],
      scored = places
        .map((place) => {
          const missing = [];
          if (!completedBuildings(place, "shelter").length) missing.push("complete a shelter");
          if (!completedBuildings(place, "stockpile").length)
            missing.push("complete a communal stockpile");
          return { place, missing };
        })
        .sort((a, b) => a.missing.length - b.missing.length || a.place.id - b.place.id),
      best = scored[0],
      missing = best ? best.missing : ["establish a camp"];
    if (!W.artifacts.some((a) => isFunctionalTool(a))) missing.push("craft a functional tool");
    return {
      next,
      requirement: "one place with a completed shelter and stockpile, plus a functional tool",
      leader: best?.place.name || null,
      missing,
    };
  }
  const requirements = {
      village: "one settlement with 3 completed structures",
      civic:
        "one settlement with a faction, a completed Civic hall, and Polymer Inscription or Recorded Governance",
      urban:
        "one settlement with a Civic hall, a Catalytic clinic, 8 completed structures, and 24 local or 32 faction-network people",
      "complex terrestrial":
        "one settlement with Planetary Stewardship, Terrestrial Mechanization, and completed Waterworks",
    },
    settlements = W.settlements.filter((s) => !s.ruined);
  if (!settlements.length)
    return {
      next,
      requirement: requirements[next],
      leader: null,
      missing: ["found a persistent settlement"],
    };
  const scored = settlements
      .map((s) => ({ s, missing: settlementStageShortfall(s, next) }))
      .sort((a, b) => a.missing.length - b.missing.length || a.s.id - b.s.id),
    best = scored[0];
  return { next, requirement: requirements[next], leader: best.s.name, missing: best.missing };
}
function technologyBlockers(s, tech) {
  const blockers = [],
    known = new Set(s.knownProcesses),
    facility = facilityForTechnology(tech.id);
  for (const prior of tech.prior || [])
    if (!known.has(prior))
      blockers.push(`prerequisite ${technologyDefinition(prior)?.name || prior}`);
  for (const sp of tech.materials || [])
    if (!hasResearchMaterial(s, sp))
      blockers.push(`stockpile 10 ${W.definitions.species[sp].name}`);
  if (facility && !placeHasFacility(s, facility)) {
    const project = activeBuildings(s, facility)[0];
    blockers.push(
      project
        ? `${BUILDING_DEFS[facility].name} construction ${Math.round(project.progress * 100)}%`
        : `build ${BUILDING_DEFS[facility]?.name || facility}`,
    );
  }
  if (
    TECH_BASE.includes(tech) &&
    !s.researchEvidence?.[tech.id]?.length &&
    !(tech.observed || []).some((type) => observedNear(s, type))
  )
    blockers.push(`observe ${tech.observed?.join(" or ") || "a reproducible phenomenon"}`);
  if (TECH_BASE.includes(tech))
    for (const req of tech.structures || [])
      if (!settlementHasStructure(s, req)) blockers.push(`arrange ${req}`);
  if (TECH_BASE.includes(tech) && (tech.heat || 0) > 0) {
    const evidence = (s.researchEvidence?.[tech.id] || []).filter(Boolean),
      observed = evidence.length
        ? evidence
        : (tech.observed || []).map((type) => observedNear(s, type)).filter(Boolean),
      temperature = settlementTemperatureCapacity(s, tech, observed);
    if (temperature < tech.heat) blockers.push(`heat ${Math.round(temperature)}°/${tech.heat}°`);
  }
  if (settlementPopulation(s) < 4) blockers.push(`local researchers ${settlementPopulation(s)}/4`);
  if (s.stability < 0.2) blockers.push(`stability ${Math.round(s.stability * 100)}%/20%`);
  return blockers;
}
function civilizationProgressAudit() {
  if (!W) return null;
  initializeSocietyState(W);
  const catalog = techCatalog(),
    definitions = [];
  for (const tech of catalog) {
    for (const prior of tech.prior || [])
      if (!catalog.some((x) => x.id === prior))
        definitions.push(`${tech.id}: missing prerequisite definition ${prior}`);
    const facility = facilityForTechnology(tech.id);
    if (facility && !BUILDING_DEFS[facility])
      definitions.push(`${tech.id}: missing facility definition ${facility}`);
  }
  const settlements = W.settlements
    .filter((s) => !s.ruined)
    .map((s) => {
      const complete = completedBuildings(s),
        active = activeBuildings(s),
        types = new Set(complete.map((b) => b.type)),
        localPopulation = settlementPopulation(s),
        networkPopulation = factionNetworkPopulation(s),
        faction = W.factions.find((f) => f.id === s.factionId),
        isCapital = !!faction && faction.capitalSettlementId === s.id,
        stage = settlementDevelopmentStage(s),
        stageBlockers = settlementStageShortfall(
          s,
          { village: "civic", civic: "urban", urban: "complex terrestrial" }[stage] || null,
        );
      const research = catalog
        .filter((t) => !s.knownProcesses.includes(t.id))
        .map((tech) => ({
          id: tech.id,
          name: tech.name,
          progress: +(s.researchProgress?.[tech.id] || 0).toFixed(1),
          threshold: tech.threshold || 24 + (tech.prior?.length || 0) * 14,
          blockers: technologyBlockers(s, tech),
        }));
      return {
        id: s.id,
        name: s.name,
        stage,
        localPopulation,
        networkPopulation,
        isCapital,
        stability: +s.stability.toFixed(3),
        known: s.knownProcesses.slice(),
        complete: complete.map((b) => b.type),
        active: active.map((b) => ({ type: b.type, progress: +b.progress.toFixed(3) })),
        stageBlockers,
        research,
      };
    });
  const next = CIV_STAGE_ORDER[W.civilization.stageIndex + 1] || null;
  return {
    tick: W.tick,
    stage: W.civilization.stage,
    next,
    gate: civilizationGateStatus(),
    definitions,
    settlements,
    matter: auditMatter(),
  };
}
function civilizationStageGate(index) {
  const stage = CIV_STAGE_ORDER[index];
  if (stage === "sapient foraging") return biospherePopulation(KINDS.PERSON) >= 4;
  if (stage === "tribal") {
    const places = [...W.camps.filter((c) => c.active), ...W.settlements.filter((s) => !s.ruined)],
      builtTradition = places.some(
        (place) =>
          completedBuildings(place, "shelter").length &&
          completedBuildings(place, "stockpile").length,
      );
    return builtTradition && W.artifacts.some((a) => isFunctionalTool(a));
  }
  if (stage === "village")
    return W.settlements.some((s) => !s.ruined && completedBuildings(s).length >= 3);
  if (stage === "civic")
    return W.settlements.some(
      (s) =>
        !s.ruined &&
        ["civic", "urban", "complex terrestrial"].includes(settlementDevelopmentStage(s)),
    );
  if (stage === "urban")
    return W.settlements.some(
      (s) => !s.ruined && ["urban", "complex terrestrial"].includes(settlementDevelopmentStage(s)),
    );
  if (stage === "complex terrestrial")
    return W.settlements.some(
      (s) => !s.ruined && settlementDevelopmentStage(s) === "complex terrestrial",
    );
  return true;
}
function updateCivilizationProgression() {
  initializeSocietyState(W);
  for (const s of W.settlements) if (!s.ruined) s.stage = settlementDevelopmentStage(s);
  for (const c of W.camps)
    if (c.active) c.stage = completedBuildings(c, "shelter").length ? "tribal" : "encampment";
  const next = W.civilization.stageIndex + 1;
  if (next < CIV_STAGE_ORDER.length && civilizationStageGate(next)) {
    const prior = W.civilization.stage,
      stage = CIV_STAGE_ORDER[next];
    W.civilization.stage = stage;
    W.civilization.stageIndex = next;
    W.civilization.stageTick = W.tick;
    const ev = emitEvent("StageAdvanceEvent", {
      causes: [
        W.lastEventByType.BuildingCompletedEvent ||
          W.lastEventByType.TechAdvanceEvent ||
          W.biosphere?.emergenceEvents?.at(-1) ||
          0,
      ],
      evidence: [
        `progression advanced from ${prior} to ${stage}`,
        stage === "tribal"
          ? "functional tools, a communal cache, and a completed shelter"
          : "material, demographic, and institutional gates were satisfied",
        "the ladder runs on to orbit and the stars once a ship has left",
      ],
      importance: 5,
      data: { name: titleCase(stage), stage, prior },
    });
    W.civilization.milestones.push({ stage, tick: W.tick, eventId: ev.id });
  }
}
const updateFactionsSocietyBase = updateFactions;
updateFactions = function () {
  updateFactionsSocietyBase();
  updateCivilizationProgression();
};
const updateFactionsProgressionBase = updateFactions;
updateFactions = function () {
  updateFactionsProgressionBase();
  for (let n = 0; n < 2; n++) {
    const before = W.civilization.stageIndex;
    updateCivilizationProgression();
    if (W.civilization.stageIndex === before) break;
  }
};
const epochNameSocietyBase = epochName;
function normalizeCivilizationAuthority(world = W) {
  if (!world?.civilization) return { stage: "multicellular", stageIndex: 0 };
  let index = Number.isInteger(world.civilization.stageIndex)
    ? world.civilization.stageIndex
    : CIV_STAGE_ORDER.indexOf(world.civilization.stage);
  index = clamp(index < 0 ? 0 : index, 0, CIV_STAGE_ORDER.length - 1);
  world.civilization.stageIndex = index;
  world.civilization.stage = CIV_STAGE_ORDER[index];
  return { stage: world.civilization.stage, stageIndex: index };
}
const initializeSocietyStateAuthorityBase = initializeSocietyState;
initializeSocietyState = function (world) {
  const result = initializeSocietyStateAuthorityBase(world);
  normalizeCivilizationAuthority(world);
  return result;
};
epochName = function () {
  if (!W) return epochNameSocietyBase();
  const civilization = normalizeCivilizationAuthority();
  if (civilization.stageIndex > 0) return titleCase(civilization.stage);
  const biosphere = W.biosphere?.stage;
  if (biosphere && biosphere !== "prebiotic") return titleCase(biosphere);
  return epochNameSocietyBase();
};
function civilizationSummary() {
  if (!W) return null;
  const authority = normalizeCivilizationAuthority(),
    workers = { idle: 0, gather: 0, mine: 0, cut: 0, haul: 0, craft: 0, build: 0 };
  for (const id of W.activeIds)
    if (W.kind[id] === KINDS.PERSON) {
      const task = W.components.work?.[id]?.task || "idle";
      workers[task] = (workers[task] || 0) + 1;
    }
  const cognition = W.activeIds.filter((id) => W.components.cognition?.[id]),
    tools = W.artifacts.filter((a) => isFunctionalTool(a));
  return {
    stage: authority.stage,
    stageIndex: authority.stageIndex,
    endpoint: W.civilization.endpoint,
    buildings: {
      planned: W.buildings.filter((b) => !b.complete && !b.ruined).length,
      complete: W.buildings.filter((b) => b.complete && !b.ruined).length,
      ruined: W.buildings.filter((b) => b.ruined).length,
    },
    orders: {
      open: W.workOrders.filter((o) => o.status === "open").length,
      complete: W.workOrders.filter((o) => o.status === "complete").length,
    },
    tools: {
      count: tools.length,
      cut: tools.filter((a) => isFunctionalTool(a, "cut")).length,
      mine: tools.filter((a) => isFunctionalTool(a, "mine")).length,
      build: tools.filter((a) => isFunctionalTool(a, "build")).length,
    },
    workers,
    cognition: {
      agents: cognition.length,
      updates: sum(cognition.map((id) => W.components.cognition[id].updates)),
      influences: sum(cognition.map((id) => W.components.cognition[id].influenceCount)),
      confidence: cognition.length
        ? mean(cognition.map((id) => W.components.cognition[id].confidence)) / LTC_Q
        : 0,
    },
    metrics: { ...W.civicMetrics },
    milestones: W.civilization.milestones.slice(),
  };
}
const recordStatisticsSocietyBase = recordStatistics;
recordStatistics = function () {
  recordStatisticsSocietyBase();
  const h = W.statistics.history.at(-1),
    c = civilizationSummary();
  if (h && c)
    Object.assign(h, {
      buildings: c.buildings.complete,
      projects: c.buildings.planned,
      tools: c.tools.count,
      construction: c.metrics.constructionWork,
      civilization: c.stageIndex,
    });
};
