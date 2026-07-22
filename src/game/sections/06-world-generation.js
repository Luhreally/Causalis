// ═══════════════════════════════════════════════════════════════════════════
// 6. WORLD LAWS AND WORLD GENERATION
// ═══════════════════════════════════════════════════════════════════════════
function generatedName(rng, two = true) {
  const a = NAME_A[rng.int(NAME_A.length)],
    b = NAME_B[rng.int(NAME_B.length)];
  return two ? `${a} ${b}` : a + b.toLowerCase();
}
function makeWorldLaws(seed, variability, harshness, unfiltered) {
  const r = makeRng(seed, "laws"),
    spread = unfiltered ? 1.35 : variability * 0.65 + 0.2,
    around = (m, d, min, max) => clamp(m + (r.next() - 0.5) * d * spread, min, max);
  return Object.freeze({
    heatDiffusion: around(0.12, 0.16, 0.025, 0.32),
    moistureDiffusion: around(0.09, 0.12, 0.02, 0.25),
    plantEfficiency: around(1.04, 0.65, 0.42, 1.8),
    combustionThreshold: around(515, 330, 260, 850),
    diseasePersistence: around(0.965, 0.055, 0.82, 0.997),
    mutationIntensity: around(0.045, 0.055, 0.008, 0.14),
    reproductionCost: around(1, 0.65, 0.5, 2),
    metabolicEfficiency: around(1, 0.5, 0.5, 1.55),
    materialHardness: around(1, 0.7, 0.4, 1.8),
    resourceRichness: around(1, 0.85, 0.25, 2),
    climateVolatility: around(0.8 + harshness * 0.45, 0.9, 0.2, 2),
    socialCohesion: around(1, 0.8, 0.35, 1.8),
    technologyRate: around(1, 0.8, 0.35, 1.9),
    solarFlux: around(1, 0.45, 0.55, 1.55),
    solventRetention: around(1, 0.55, 0.5, 1.6),
    oxidationPotential: around(1, 0.5, 0.55, 1.55),
  });
}
function generateChemistry(seed, laws, unfiltered) {
  const r = makeRng(seed, "matter-families"),
    families = [];
  for (let i = 0; i < 10; i++) {
    const syll = FAMILY_SYL[(r.int(FAMILY_SYL.length) + i) % FAMILY_SYL.length],
      tail = ["on", "ite", "ium", "ene", "yl"][r.int(5)];
    families.push(
      Object.freeze({
        id: i,
        name: titleCase(syll + tail),
        symbol: (syll[0] + (r.next() > 0.55 ? syll[1] : "")).toUpperCase(),
        mass: u16(r.range(8, 190)),
        charge: +r.range(-1, 1).toFixed(2),
        bonding: 3 + r.int(3),
        bondStrength: +r.range(0.25, 1.8).toFixed(2),
        geometry: ["linear", "angular", "tetrahedral", "lattice", "ring"][r.int(5)],
        stability: +r.range(0.25, 0.98).toFixed(2),
        abundance: +r.range(0.08, 1).toFixed(2),
        thermal: +r.range(0.2, 1.7).toFixed(2),
        catalytic: +r.range(0, 1).toFixed(2),
        solventAffinity: +r.range(0, 1).toFixed(2),
        toxicity: +r.range(0, 0.75).toFixed(2),
        energyTransfer: +r.range(0, 1).toFixed(2),
      }),
    );
  }
  const species = [],
    formulas = Array.from({ length: SPECIES_COUNT }, () => []),
    connected = [0, 1, 2, 3, 4, 5, 9, 10, 11, 12, 13, 14, 15, 16, 17, 19, 22, 28];
  for (let f = 0; f < families.length; f++) {
    const a = 1 + r.int(3),
      b = Math.ceil((a + 1) / 2) + r.int(2),
      salt = 1 + r.int(Math.max(1, 2 * a - 1)),
      v = Array(SPECIES_COUNT).fill(0);
    for (const sp of connected) v[sp] = a;
    v[C.ORE] = v[C.METAL] = 2 * b - a;
    v[C.CATALYST] = 1 + r.int(4);
    v[C.TOXIN] = 1 + r.int(3);
    v[C.PIGMENT] = 1 + r.int(4);
    v[C.CRYSTAL] = 2 * a - salt;
    v[C.SALT] = salt;
    v[C.ACID] = 1 + r.int(4);
    v[C.BASE] = 1 + r.int(4);
    v[C.SPORE] = 1 + r.int(4);
    v[C.BONE] = 1 + r.int(4);
    v[C.GLASS] = 1 + r.int(4);
    v[C.CORROSION] = b;
    v[C.RARE] = 1 + r.int(4);
    for (let sp = 0; sp < SPECIES_COUNT; sp++)
      if (v[sp] > 0) formulas[sp].push(Object.freeze([f, v[sp]]));
  }
  const graphSignatures = new Set(),
    structuralRepairs = [];
  const structuralModes = (role) => {
    const modes = [];
    if (/solvent|dissolved nutrient|metabolic waste|medicinal inhibitor/.test(role))
      modes.push("fluid");
    if (/ gas|volatile|alarm signal/.test(role)) modes.push("volatile");
    if (/energy carrier|fuel compound|organic tissue/.test(role)) modes.push("energetic");
    if (/catalyst|crystal|rare conductor/.test(role)) modes.push("catalytic");
    if (/information|pathogen|spore|pigment/.test(role)) modes.push("information");
    if (
      /structural|mineral|ore|metal|crystal|ceramic|bone|fiber|glass|conductor|membrane/.test(role)
    )
      modes.push("network");
    if (/toxin|corrosion/.test(role)) modes.push("reactive");
    return modes;
  };
  function buildBondGraph(composition, speciesId, modes, attempt) {
    const repair = attempt >= 96,
      gr = makeRng(
        hashParts(seed, "bond-graph", speciesId, attempt, modes.join("|")),
        "molecular-structure",
      ),
      ranked = [];
    for (const [familyId, count] of composition)
      for (let n = 0; n < count; n++) {
        const f = families[familyId];
        let priority = -f.bonding * 0.24 + gr.next();
        if (modes.includes("volatile")) priority -= f.solventAffinity * 0.8;
        if (modes.includes("fluid")) priority += f.solventAffinity * 0.8;
        if (modes.includes("catalytic")) priority += f.catalytic * 0.7;
        ranked.push({ familyId, priority, serial: n });
      }
    ranked.sort(
      (a, b) => a.priority - b.priority || a.familyId - b.familyId || a.serial - b.serial,
    );
    const atomFamilies = ranked.map((x) => x.familyId),
      n = atomFamilies.length,
      bonds = [],
      valence = Array(n).fill(0),
      edgeKeys = new Set();
    const addBond = (a, b, order = 1) => {
      if (a === b) return false;
      if (a > b) [a, b] = [b, a];
      const key = `${a}:${b}`;
      if (edgeKeys.has(key)) return false;
      edgeKeys.add(key);
      bonds.push({ a, b, order });
      valence[a] += order;
      valence[b] += order;
      return true;
    };
    for (let i = 1; i < n; i++) {
      let parent = 0,
        best = -1e9;
      for (let j = 0; j < i; j++) {
        const f = families[atomFamilies[j]],
          spare = f.bonding - valence[j];
        let score = spare * 2 + gr.next();
        if (modes.includes("volatile")) score += f.solventAffinity * 1.4;
        if (modes.includes("fluid")) score -= f.solventAffinity * 1.4;
        if (modes.includes("catalytic")) score -= f.catalytic;
        if (modes.includes("information") && atomFamilies[j] !== atomFamilies[i]) score += 0.8;
        if (score > best) {
          best = score;
          parent = j;
        }
      }
      addBond(parent, i, 1);
    }
    if (modes.some((x) => x === "energetic" || x === "information" || x === "reactive")) {
      const intense = modes.includes("energetic") || modes.includes("reactive"),
        upgrades = Math.max(1, Math.ceil(n * (repair && intense ? 0.55 : intense ? 0.36 : 0.18))),
        ordered = bonds.slice().sort((a, b) => a.a - b.a || a.b - b.b);
      for (let pass = 0, promoted = 0; pass < ordered.length * 4 && promoted < upgrades; pass++) {
        const b = ordered[(pass + attempt) % ordered.length],
          capA = families[atomFamilies[b.a]].bonding,
          capB = families[atomFamilies[b.b]].bonding;
        if (b.order < 3 && valence[b.a] < capA && valence[b.b] < capB) {
          b.order++;
          valence[b.a]++;
          valence[b.b]++;
          promoted++;
        }
      }
    }
    let crosslinks = 0;
    if (modes.includes("fluid")) crosslinks++;
    if (modes.includes("network")) crosslinks += Math.ceil(n * 0.24);
    if (modes.includes("energetic")) crosslinks += Math.ceil(n * (repair ? 0.2 : 0.08));
    if (modes.includes("catalytic")) crosslinks += Math.ceil(n * 0.07);
    if (modes.includes("information")) crosslinks += Math.ceil(n * 0.04);
    if (modes.includes("reactive")) crosslinks += Math.ceil(n * (repair ? 0.2 : 0.06));
    if (!modes.length) crosslinks = attempt % 3;
    if (repair) {
      const pairs = [];
      for (let gap = 2; gap < n; gap++) for (let a = 0; a + gap < n; a++) pairs.push([a, a + gap]);
      pairs.sort(
        (a, b) =>
          hashParts(speciesId, attempt, a[0], a[1]) - hashParts(speciesId, attempt, b[0], b[1]),
      );
      for (let p = 0, added = 0; p < pairs.length && added < crosslinks; p++) {
        const [a, b] = pairs[p],
          high = modes.includes("energetic") || modes.includes("reactive"),
          order = high && p % 2 === 0 ? 2 : 1;
        if (
          valence[a] + order > families[atomFamilies[a]].bonding ||
          valence[b] + order > families[atomFamilies[b]].bonding
        )
          continue;
        if (addBond(a, b, order)) added++;
      }
    } else
      for (let tries = 0, added = 0; tries < n * n && added < crosslinks; tries++) {
        const a = gr.int(n),
          b = gr.int(n),
          order =
            (modes.includes("energetic") || modes.includes("reactive")) && tries % 3 === 0 ? 2 : 1;
        if (
          a === b ||
          valence[a] + order > families[atomFamilies[a]].bonding ||
          valence[b] + order > families[atomFamilies[b]].bonding
        )
          continue;
        if (addBond(a, b, order)) added++;
      }
    const degree = Array(n).fill(0),
      bondValence = Array(n).fill(0),
      neighbors = Array.from({ length: n }, () => []);
    for (const b of bonds) {
      degree[b.a]++;
      degree[b.b]++;
      bondValence[b.a] += b.order;
      bondValence[b.b] += b.order;
      neighbors[b.a].push(atomFamilies[b.b]);
      neighbors[b.b].push(atomFamilies[b.a]);
    }
    const cycles = Math.max(0, bonds.length - n + 1),
      branchPoints = degree.filter((v) => v > 2).length,
      highOrder = bonds.filter((b) => b.order > 1).length,
      flexibility = clamp(
        (bonds.filter((b) => b.order === 1).length / Math.max(1, bonds.length)) *
          (1 - cycles / Math.max(1, n)) *
          (1 - (branchPoints / Math.max(2, n)) * 0.5),
        0,
        1,
      ),
      neighborDiversity = mean(neighbors.map((a) => new Set(a).size / Math.max(1, a.length))),
      asymmetry =
        new Set(
          atomFamilies.map(
            (f, i) =>
              `${f}:${degree[i]}:${neighbors[i]
                .slice()
                .sort((a, b) => a - b)
                .join(".")}`,
          ),
        ).size / Math.max(1, n),
      packing = clamp(
        0.18 * ((bonds.length * 2) / Math.max(1, n)) +
          0.5 * (cycles / Math.max(1, n)) +
          0.18 * (1 - flexibility) +
          0.14 * (1 - asymmetry),
        0,
        1,
      ),
      sequenceComplexity =
        n > 1
          ? sum(atomFamilies.slice(1).map((f, i) => (f === atomFamilies[i] ? 0 : 1))) / (n - 1)
          : 0;
    const signature = `${atomFamilies.join(".")}|${bonds
      .slice()
      .sort((a, b) => a.a - b.a || a.b - b.b || a.order - b.order)
      .map((b) => `${b.a}-${b.b}-${b.order}`)
      .join(".")}`;
    const topology =
      cycles > Math.max(1, n * 0.12)
        ? "network"
        : cycles
          ? "ring"
          : branchPoints > Math.max(1, n * 0.08)
            ? "branched"
            : highOrder > bonds.length * 0.2
              ? "conjugated"
              : "chain";
    return Object.freeze({
      signature,
      topology,
      atoms: Object.freeze(atomFamilies.map((familyId, id) => Object.freeze({ id, familyId }))),
      bonds: Object.freeze(bonds.map((b) => Object.freeze({ ...b }))),
      cycleCount: cycles,
      branchPoints,
      flexibility: +flexibility.toFixed(4),
      packing: +packing.toFixed(4),
      sequenceComplexity: +sequenceComplexity.toFixed(4),
      neighborDiversity: +neighborDiversity.toFixed(4),
      asymmetry: +asymmetry.toFixed(4),
      highOrderFraction: +(highOrder / Math.max(1, bonds.length)).toFixed(4),
      bondValence: Object.freeze(bondValence),
    });
  }
  function deriveCompound(composition, graph, molecularMass) {
    const atoms = graph.atoms,
      atomCount = atoms.length,
      weighted = (key) => mean(atoms.map((a) => families[a.familyId][key])),
      exposure = atoms.map((a, i) =>
        clamp(1 - graph.bondValence[i] / (families[a.familyId].bonding + 1), 0.04, 1),
      ),
      surface = (key) => {
        const w = sum(exposure);
        return (
          sum(atoms.map((a, i) => families[a.familyId][key] * exposure[i])) / Math.max(0.001, w)
        );
      },
      avgCharge = mean(atoms.map((a) => Math.abs(families[a.familyId].charge))),
      avgBond = mean(
        graph.bonds.map(
          (b) =>
            ((families[atoms[b.a].familyId].bondStrength +
              families[atoms[b.b].familyId].bondStrength) *
              0.5 *
              b.order) /
            3,
        ),
      ),
      overValence =
        sum(atoms.map((a, i) => Math.max(0, graph.bondValence[i] - families[a.familyId].bonding))) /
        Math.max(1, atomCount),
      cycleDensity = graph.cycleCount / Math.max(1, atomCount),
      polarity = clamp(
        0.38 * surface("solventAffinity") +
          0.24 * avgCharge +
          0.2 * graph.asymmetry +
          0.18 * graph.neighborDiversity,
        0,
        1,
      ),
      stability = clamp(
        0.43 * weighted("stability") +
          0.25 * clamp(avgBond / 1.8, 0, 1) +
          0.18 * graph.packing +
          0.14 *
            (1 - clamp(overValence + graph.highOrderFraction * 0.22 + cycleDensity * 0.18, 0, 1)),
        0.08,
        0.99,
      ),
      energyCarrierPotential = clamp(
        0.2 * weighted("energyTransfer") +
          0.46 * graph.highOrderFraction +
          0.18 * cycleDensity +
          0.12 * overValence +
          0.12 * (1 - stability),
        0,
        1,
      ),
      freeEnergy = 0.5 + energyCarrierPotential * 22,
      catalyticPotential = clamp(
        0.28 * weighted("catalytic") +
          0.42 * surface("catalytic") +
          0.13 * graph.neighborDiversity +
          0.1 * graph.asymmetry +
          0.09 * polarity,
        0,
        1,
      ),
      informationPotential = clamp(
        0.31 * graph.sequenceComplexity +
          0.24 * graph.asymmetry +
          0.2 * graph.neighborDiversity +
          0.15 * graph.highOrderFraction +
          0.1 * clamp((atomCount - 6) / 24, 0, 1),
        0,
        1,
      ),
      toxicity = clamp(
        0.25 * surface("toxicity") +
          0.15 * weighted("toxicity") +
          0.42 * graph.highOrderFraction +
          0.22 * cycleDensity +
          0.15 * (1 - stability) +
          0.1 * overValence,
        0,
        1,
      ),
      size = clamp((atomCount - 8) / 28, 0, 1),
      cohesion = clamp(
        0.48 * surface("solventAffinity") +
          0.18 * avgCharge +
          0.19 * graph.packing +
          0.15 * stability,
        0,
        1,
      ),
      volatility = clamp(
        0.48 * graph.flexibility +
          0.24 * (1 - cohesion) +
          0.15 * (1 - size) +
          0.13 * (1 - graph.packing),
        0,
        1,
      ),
      phase =
        cycleDensity < 0.025 && graph.packing < 0.44 && graph.flexibility > 0.7
          ? "gas"
          : cycleDensity > 0.12 || graph.packing > 0.62 || graph.flexibility < 0.28
            ? "solid"
            : "liquid";
    return {
      phase,
      polarity: +polarity.toFixed(2),
      stability: +stability.toFixed(2),
      freeEnergy: +freeEnergy.toFixed(2),
      toxicity: +toxicity.toFixed(2),
      catalyticPotential: +catalyticPotential.toFixed(3),
      informationPotential: +informationPotential.toFixed(3),
      energyCarrierPotential: +energyCarrierPotential.toFixed(3),
    };
  }
  const modeSatisfied = (d, modes) =>
    (!modes.includes("fluid") || d.phase === "liquid") &&
    (!modes.includes("volatile") || d.phase === "gas") &&
    (!modes.includes("network") || d.phase === "solid") &&
    (!modes.includes("energetic") || d.freeEnergy > 6) &&
    (!modes.includes("catalytic") || d.catalyticPotential >= 0.4) &&
    (!modes.includes("information") || d.informationPotential >= 0.5) &&
    (!modes.includes("reactive") || d.toxicity >= 0.33);
  for (let i = 0; i < SPECIES_COUNT; i++) {
    const a = (i * 3 + r.int(10)) % 10,
      b = (a + 1 + r.int(9)) % 10,
      role = SPECIES_ROLES[i],
      name =
        i < 16
          ? `${FAMILY_SYL[a]}${FAMILY_SYL[b]}-${["ate", "ene", "ol", "ite", "ase"][i % 5]}`
          : `${FAMILY_SYL[b]}${FAMILY_SYL[a]}${["in", "yl", "ox", "ide"][i % 4]}`,
      composition = Object.freeze(formulas[i]),
      molecularMass = sum(composition.map(([f, n]) => families[f].mass * n)),
      modes = structuralModes(role);
    let compiled = null;
    for (let attempt = 0; attempt < 160; attempt++) {
      const graph = buildBondGraph(composition, i, modes, attempt);
      if (graphSignatures.has(graph.signature)) continue;
      const derived = deriveCompound(composition, graph, molecularMass);
      if (!modeSatisfied(derived, modes)) continue;
      compiled = { graph, derived, attempt };
      break;
    }
    if (!compiled) throw new Error(`Structural viability repair failed for ${role}`);
    graphSignatures.add(compiled.graph.signature);
    if (modes.length)
      structuralRepairs.push(
        Object.freeze({
          speciesId: i,
          attempts: compiled.attempt + 1,
          targets: Object.freeze(modes.slice()),
        }),
      );
    const { graph, derived } = compiled;
    species.push(
      Object.freeze({
        id: i,
        name: titleCase(name),
        role,
        phase: derived.phase,
        composition,
        molecularMass,
        isomerClass: composition.map(([f, n]) => `${f}:${n}`).join("|"),
        constitutionalIsomer: graph.signature,
        bondTopology: graph.topology,
        bondGraph: graph,
        polarity: derived.polarity,
        freeEnergy: derived.freeEnergy,
        stability: derived.stability,
        toxicity: derived.toxicity,
        catalyticPotential: derived.catalyticPotential,
        informationPotential: derived.informationPotential,
        energyCarrierPotential: derived.energyCarrierPotential,
        colorHue: hashParts(seed, graph.signature, "compound-color") % 360,
      }),
    );
  }
  const rankedBy = (key) => species.slice().sort((a, b) => b[key] - a[key] || a.id - b.id),
    catalystSpecies = rankedBy("catalyticPotential")
      .filter((s) => s.catalyticPotential >= 0.4)
      .slice(0, 6),
    energyCarriers = rankedBy("energyCarrierPotential")
      .filter((s) => s.freeEnergy > 6)
      .slice(0, 8),
    informationPolymers = rankedBy("informationPotential")
      .filter((s) => s.informationPotential >= 0.5)
      .slice(0, 8);
  if (catalystSpecies.length < 3 || energyCarriers.length < 3 || informationPolymers.length < 2)
    throw new Error("Structural capability repair produced an incomplete chemistry");
  const vector = (terms) => {
      const v = Array(families.length).fill(0);
      for (const [sp, n] of terms) for (const [f, k] of species[sp].composition) v[f] += n * k;
      return v;
    },
    balanced = (inputs, outputs) => {
      const a = vector(inputs),
        b = vector(outputs);
      return a.every((v, i) => v === b[i]);
    },
    chemicalDelta = (inputs, outputs) =>
      sum(outputs.map(([sp, n]) => species[sp].freeEnergy * n)) -
      sum(inputs.map(([sp, n]) => species[sp].freeEnergy * n)),
    makeReaction = (p, rate) => {
      const ok = balanced(p.inputs, p.outputs),
        delta = +chemicalDelta(p.inputs, p.outputs).toFixed(3),
        structuralEffects = p.structure ? [p.structure] : [],
        structuralRequirements = ["biology", "metabolism", "information", "disease"].includes(
          p.domain,
        )
          ? ["bounded reaction space"]
          : [];
      return Object.freeze({
        id: p.id,
        reactants: p.inputs,
        products: p.outputs,
        minimumTemperature: p.id.includes("smelt") ? 650 : p.id.includes("combust") ? 28 : -30,
        maximumTemperature:
          p.domain === "biology" || p.domain === "metabolism" || p.domain === "disease" ? 85 : 1600,
        requiredMedium: p.domain === "metabolism" || p.domain === "biology" ? C.SOLVENT : null,
        requiredCatalysts: p.inputs.filter((x) => x[0] === C.CATALYST).map((x) => x[0]),
        inhibitedBy: p.domain === "biology" ? [C.TOXIN] : [],
        activationEnergy: p.energyCost || 0,
        chemicalEnergyDelta: delta,
        energyDelta: -delta,
        externalEnergyRequirement: p.domain === "producer" ? Math.max(0, delta) : 0,
        baseRate: rate,
        reversibility: p.domain === "geology" ? 0.45 : 0,
        pressureSensitivity: +r.range(0, 0.4).toFixed(2),
        structuralRequirements,
        structuralEffects,
        emittedFields: p.domain === "physical" ? ["heat", "smoke"] : [],
        emittedEvents: p.event ? [p.event] : [],
        familyBalance: ok,
        chargeDelta: 0,
        balanced: ok,
      });
    };
  const reactions = [];
  for (let pi = 0; pi < PROCESS_TEMPLATES.length; pi++) {
    const p = PROCESS_TEMPLATES[pi];
    reactions.push(makeReaction(p, pi === 0 ? 0.12 : +r.range(0.03, 0.24).toFixed(3)));
  }
  for (let i = reactions.length; i < 52; i++) {
    const a = connected[i % connected.length],
      b = connected[(i * 7 + 3) % connected.length],
      inputs = [[a, 1]],
      outputs = [[b, 1]],
      ok = balanced(inputs, outputs),
      delta = +chemicalDelta(inputs, outputs).toFixed(3),
      offset = Math.floor((i - PROCESS_TEMPLATES.length) / 4) % catalystSpecies.length,
      catalyst = catalystSpecies
        .map((_, j) => catalystSpecies[(offset + j) % catalystSpecies.length])
        .find((s) => s.id !== a && s.id !== b).id;
    reactions.push(
      Object.freeze({
        id: `isomerization_${i}`,
        reactants: inputs,
        products: outputs,
        minimumTemperature: -20 + (i % 5) * 20,
        maximumTemperature: 200 + (i % 7) * 80,
        requiredMedium: i % 3 === 0 ? C.SOLVENT : null,
        requiredCatalysts: i % 4 === 0 ? [catalyst] : [],
        inhibitedBy: i % 6 === 0 ? [C.TOXIN] : [],
        activationEnergy: i % 9,
        chemicalEnergyDelta: delta,
        energyDelta: -delta,
        externalEnergyRequirement: Math.max(0, delta),
        baseRate: +r.range(0.01, 0.12).toFixed(3),
        reversibility: (i % 4) / 4,
        pressureSensitivity: +r.range(0, 0.6).toFixed(2),
        structuralRequirements: [],
        structuralEffects: [],
        emittedFields: [],
        familyBalance: ok,
        chargeDelta: 0,
        balanced: ok,
      }),
    );
  }
  const materialRoles = [
    ["water", C.SOLVENT, 15],
    ["soil", C.NUTRIENT, 1],
    ["sand", C.MINERAL, 0],
    ["clay", C.MINERAL, 1],
    ["wood", C.FIBER, 8],
    ["plant matter", C.ORGANIC, 3],
    ["flesh", C.ORGANIC, 13],
    ["bone", C.BONE, 4],
    ["stone", C.MINERAL, 2],
    ["ore", C.ORE, 2],
    ["metal", C.METAL, 11],
    ["ash", C.ASH, 0],
    ["glass", C.GLASS, 10],
  ];
  const meanFormulaMass = mean(species.map((s) => s.molecularMass)),
    materials = materialRoles.map((m, i) => {
      const sp = species[m[1]];
      let hard = clamp((sp.stability * 0.8 + (m[2] / 15) * 1.5) * laws.materialHardness, 0.1, 2.5);
      if (!unfiltered && ["bone", "stone", "ore", "metal", "ceramic", "glass"].includes(m[0]))
        hard = Math.max(0.78, hard);
      if (!unfiltered && m[0] === "water") hard = Math.min(0.32, hard);
      return Object.freeze({
        id: i,
        category: m[0],
        name: `${sp.name.split(" ")[0]} ${titleCase(m[0])}`,
        speciesId: m[1],
        structurePattern: m[2],
        density: +(0.3 + sp.molecularMass / (meanFormulaMass * 2)).toFixed(2),
        hardness: +hard.toFixed(2),
        brittleness: +clamp(1.2 - hard * 0.35 + r.range(-0.15, 0.15), 0.1, 1.7).toFixed(2),
        melting: +(160 + sp.stability * 900).toFixed(0),
        heatCapacity: +r.range(0.3, 1.8).toFixed(2),
        conductivity: +(m[1] === C.METAL ? 1.5 : r.range(0.05, 0.7)).toFixed(2),
        flammability: m[1] === C.ORGANIC || m[1] === C.FIBER ? +0.82 : +0.03,
        corrosionResistance: +sp.stability.toFixed(2),
        toxicity: +sp.toxicity.toFixed(2),
        fertility: m[1] === C.NUTRIENT ? 1 : m[1] === C.ASH ? 0.35 : 0,
        waterRetention: m[0] === "soil" || m[0] === "clay" ? 0.8 : 0.2,
        biocompatibility:
          m[1] === C.ORGANIC || m[1] === C.SOLVENT ? 0.85 : clamp(1 - sp.toxicity, 0.05, 0.8),
        rarity: +(1 - mean(families.map((f) => f.abundance))).toFixed(2),
      });
    });
  const capabilities = Object.freeze({
    catalysts: Object.freeze(catalystSpecies.map((s) => s.id)),
    energyCarriers: Object.freeze(energyCarriers.map((s) => s.id)),
    informationPolymers: Object.freeze(informationPolymers.map((s) => s.id)),
    liquids: Object.freeze(species.filter((s) => s.phase === "liquid").map((s) => s.id)),
    gases: Object.freeze(species.filter((s) => s.phase === "gas").map((s) => s.id)),
  });
  return Object.freeze({
    families: Object.freeze(families),
    species: Object.freeze(species),
    reactions: Object.freeze(reactions),
    materials: Object.freeze(materials),
    structures: STRUCTURE_PATTERNS,
    processes: PROCESS_TEMPLATES,
    technologies: TECH_BASE,
    capabilities,
    structuralRepairs: Object.freeze(structuralRepairs),
  });
}
function viabilityProbe(defs, unfiltered) {
  const catalystRequirements = new Set(defs.reactions.flatMap((r) => r.requiredCatalysts)),
    tests = {
      stableMatter: defs.species.filter((s) => s.stability > 0.45).length >= 10,
      multiplePhases: new Set(defs.species.map((s) => s.phase)).size === 3,
      persistentSolvent: defs.species[C.SOLVENT].phase === "liquid",
      energyGradient:
        defs.capabilities.energyCarriers.length >= 3 &&
        defs.capabilities.energyCarriers.every((id) => defs.species[id].freeEnergy > 6),
      temperedKinetics: defs.reactions.some((r) => r.baseRate > 0.02 && r.baseRate < 0.25),
      structuralCompounds: defs.materials.filter((m) => m.hardness > 0.7).length >= 3,
      catalysis: defs.capabilities.catalysts.length >= 3 && catalystRequirements.size >= 3,
      informationCarrier: defs.capabilities.informationPolymers.length >= 2,
      uniqueBondGraphs:
        new Set(defs.species.map((s) => s.bondGraph.signature)).size === defs.species.length,
      membrane:
        defs.species[C.MEMBRANE].phase === "solid" && defs.species[C.MEMBRANE].stability > 0.45,
      autocatalysis: defs.reactions.some((r) => r.id === "polymer_copying"),
      decomposition: defs.reactions.some((r) => r.id === "decomposition"),
      propertyVariation:
        Math.max(...defs.materials.map((m) => m.hardness)) -
          Math.min(...defs.materials.map((m) => m.hardness)) >
        0.35,
    };
  const passed = Object.values(tests).filter(Boolean).length;
  return {
    tests,
    passed,
    total: Object.keys(tests).length,
    viable: unfiltered ? passed >= 6 : passed === Object.keys(tests).length,
    repairs: defs.structuralRepairs.map(
      (r) => `recompiled ${defs.species[r.speciesId].role} graph (${r.targets.join("+")})`,
    ),
    mode: unfiltered ? "Unfiltered cosmos" : "Viability-filtered",
  };
}
function newTileColumns(n) {
  return {
    elevation: new Uint16Array(n),
    temperature: new Int16Array(n),
    liquid: new Uint16Array(n),
    hydrologyBase: new Uint16Array(n),
    fire: new Uint16Array(n),
    danger: new Uint16Array(n),
    territory: new Uint16Array(n),
    culture: new Uint16Array(n),
    plantOrder: new Uint16Array(n),
    soilOrder: new Uint16Array(n),
    habitation: new Uint16Array(n),
    populationPressure: new Uint16Array(n),
    structureOrder: new Uint16Array(n),
    featureType: new Uint8Array(n),
    featureStrength: new Uint16Array(n),
    subsurfaceType: new Uint8Array(n),
    geothermal: new Uint16Array(n),
    slope: new Uint16Array(n),
    owner: new Uint8Array(n),
    cultureOwner: new Uint8Array(n),
    basePattern: new Uint8Array(n),
    chem: Array.from({ length: COMMON_CHEM }, () => new Uint16Array(n)),
    rareChem: {},
    tempDelta: new Int32Array(n),
    chemDelta: Array.from({ length: COMMON_CHEM }, () => new Int32Array(n)),
  };
}
function generateTileWorld(world) {
  const { width: w, height: h, seedHash: s, laws, tiles: t } = world,
    sea = 430;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x,
        n = fbm(s, x / 43, y / 43),
        ridge = Math.abs(noise2(s ^ 0x51f2, x / 19, y / 19) - 0.5),
        basin = noise2(s ^ 0xaf31, x / 71, y / 71),
        river = Math.abs(noise2(s ^ 0x9911, x / 31, y / 12) - 0.5);
      let e = clamp(n * 820 + ridge * 250 - basin * 120, 40, 980);
      t.elevation[i] = u16(e);
      const water =
        e < sea
          ? u16((sea - e) * 12)
          : river < 0.018 && e < 720
            ? u16((0.018 - river) * 19000 + 180)
            : 0;
      t.liquid[i] = water;
      const lat = Math.abs(y / (h - 1) - 0.5) * 2,
        temp = 295 - lat * 185 - e * 0.11 + (noise2(s ^ 0x1837, x / 55, y / 55) - 0.5) * 70;
      t.temperature[i] = i16(temp);
      const wet = clamp(
        water ? 900 : 720 - (e - sea) * 0.75 + (noise2(s ^ 0x77a1, x / 22, y / 22) - 0.5) * 520,
        60,
        850,
      );
      t.chem[C.SOLVENT][i] = u16(water + wet);
      t.chem[C.OXIDANT][i] = u16(620 + laws.oxidationPotential * 120);
      t.chem[C.NUTRIENT][i] = u16(
        (420 + noise2(s ^ 0x2281, x / 17, y / 17) * 950) * laws.resourceRichness,
      );
      t.chem[C.MINERAL][i] = u16(1500 + e * 3.2);
      t.chem[C.ORE][i] = u16(
        Math.max(0, (noise2(s ^ 0x4921, x / 13, y / 13) - 0.67) * 7500) * laws.resourceRichness,
      );
      t.chem[C.CATALYST][i] = u16(40 + noise2(s ^ 0x7719, x / 9, y / 9) * 180);
      t.chem[C.TOXIN][i] = u16(Math.max(0, (noise2(s ^ 0x9953, x / 15, y / 15) - 0.82) * 1200));
      t.chem[C.GAS][i] = u16(480 + noise2(s ^ 0x61c3, x / 47, y / 47) * 120);
      t.soilOrder[i] = u16(e < sea ? 120 : 480 + wet * 0.35);
      t.structureOrder[i] = u16(e < sea ? 250 : 520 + e * 0.28);
      t.basePattern[i] = e < sea ? 15 : e > 830 ? 2 : wet > 650 ? 1 : 0;
      const compat = clamp(1 - Math.abs(temp - 205) / 220, 0, 1),
        plant =
          e > sea - 15
            ? u16(clamp((wet - 150) * compat * laws.plantEfficiency, 0, 900))
            : u16(water < 700 ? wet * 0.15 : 0);
      t.plantOrder[i] = plant;
      t.chem[C.ORGANIC][i] = u16(plant * 1.9);
      t.chem[C.ENERGY][i] = u16(plant * 1.4);
      t.chem[C.FUEL][i] = u16(plant * 0.45);
    }
}
function createWorld(options) {
  const [width, height] = SIZE_PRESETS[options.size] || SIZE_PRESETS.standard,
    seed = String(options.seed || "causal-origin").trim() || "causal-origin",
    seedHash = hashString(seed),
    laws = makeWorldLaws(
      seed,
      Number(options.variability),
      Number(options.harshness),
      !!options.unfiltered,
    ),
    definitions = generateChemistry(seed, laws, !!options.unfiltered),
    n = width * height,
    streams = {};
  for (const s of STREAM_NAMES) streams[s] = hashParts(seedHash, s) || 1;
  const world = {
    version: VERSION,
    seed,
    seedHash,
    config: { ...options, width, height },
    laws,
    definitions,
    viability: viabilityProbe(definitions, !!options.unfiltered),
    width,
    height,
    tileCount: n,
    tick: 0,
    weather: { name: "Clear", started: 0, intensity: 0, cycleCause: 0 },
    streams,
    tiles: newTileColumns(n),
    nextEntityId: 1,
    nextEventId: 1,
    nextFactionId: 1,
    effectSequence: 0,
    activeIds: [],
    kind: {},
    components: {
      position: {},
      body: {},
      genome: {},
      life: {},
      senses: {},
      reproduction: {},
      memory: {},
      social: {},
      identity: {},
      inventory: {},
      chemistry: {},
      structure: {},
    },
    relations: { edges: [], byEntity: {} },
    cohorts: [],
    camps: [],
    settlements: [],
    factions: [],
    cultures: [],
    technologies: [],
    artifacts: [],
    scheduled: [],
    effects: [],
    events: [],
    causalIndex: { tile: {}, entity: {}, domain: {} },
    interventions: [],
    divineClaims: [],
    statistics: { history: [], births: 0, deaths: 0, kills: 0, extinctions: 0 },
    reservoirs: { atmosphericSolvent: n * 260, deepMineral: n * 400 },
    conservation: {
      initialMatter: 0,
      playerInput: 0,
      exported: 0,
      radiantInput: 0,
      dissipatedEnergy: 0,
    },
    saveMetadata: {},
    hash: "00000000",
    lastEventByType: {},
    speciesRegistry: {},
    activeWars: [],
    spatialBins: [],
    worldSummary: [],
    historicalIdentities: {},
  };
  generateTileWorld(world);
  return world;
}
const createWorldBase = createWorld;
createWorld = function (options) {
  const world = createWorldBase(options),
    n = world.tileCount;
  world.reservoirs.primordialPackets = Array.from({ length: SPECIES_COUNT }, (_, sp) =>
    sp === C.SOLVENT || sp === C.MINERAL ? 0 : n * (sp < COMMON_CHEM ? 2 : 3),
  );
  world.conservation.thermalEnergy = 0;
  world.conservation.initialChemicalEnergy = 0;
  world.biosphere = {
    stage: "prebiotic",
    stageTick: 0,
    emergenceEvents: [],
    refugia: [],
    rescueCount: 0,
    lastRescueTick: -1024,
    lastBankTick: 0,
  };
  return world;
};
function restoreWorldDefaults() {
  W.tileCount = W.width * W.height;
  W.tiles.tempDelta = new Int32Array(W.tileCount);
  W.tiles.chemDelta = Array.from({ length: COMMON_CHEM }, () => new Int32Array(W.tileCount));
  W.spatialBins = [];
  W.effects = [];
  W.components = W.components || {};
  for (const k of [
    "position",
    "body",
    "genome",
    "life",
    "senses",
    "reproduction",
    "memory",
    "social",
    "identity",
    "inventory",
    "chemistry",
    "structure",
  ])
    W.components[k] = W.components[k] || {};
  W.causalIndex = W.causalIndex || { tile: {}, entity: {}, domain: {} };
  W.interventions = W.interventions || [];
  W.divineClaims = W.divineClaims || [];
  W.activeWars = W.activeWars || [];
  W.speciesRegistry = W.speciesRegistry || {};
  W.worldSummary = W.worldSummary || [];
  W.historicalIdentities = W.historicalIdentities || {};
  W.reservoirs = W.reservoirs || { atmosphericSolvent: 0, deepMineral: 0 };
  W.biosphere = W.biosphere || {
    stage: "multicellular",
    stageTick: W.tick || 0,
    emergenceEvents: [],
    refugia: [],
    rescueCount: 0,
    lastRescueTick: -1024,
    lastBankTick: 0,
  };
  W.nextEventId = W.nextEventId || (W.events.at(-1)?.id || 0) + 1;
  W.nextFactionId = Math.max(
    Number.isSafeInteger(W.nextFactionId) ? W.nextFactionId : 1,
    (W.factions || []).reduce((highest, f) => Math.max(highest, f.id || 0), 0) + 1,
  );
  W.effectSequence = W.effectSequence || 0;
}

// A seed chooses an entire planet-building grammar, not merely a different
// offset into the same noise field. The canonical seed is intentionally
// Earth-adjacent; every other seed has a strongly alien but viability-bounded
// profile. These values are authoritative, deterministic world-generation
// inputs. Rendering uses a separate derived cache and never advances a stream.
function canonicalPlanetSeed(seed) {
  const s = String(seed || "")
    .trim()
    .toLowerCase();
  return s === "causal-origin" || s === "earth" || s === "terra";
}
function makeStructureGenome(world, earthlike = canonicalPlanetSeed(world.seed)) {
  const r = makeRng(world.seed, "ecological-structure-grammar-v1"),
    categories = {};
  for (let id = 1; id <= 6; id++) {
    const category = FEATURE_CATEGORY[id],
      pool = FEATURE_POOLS[category],
      chosen = earthlike ? pool[0] : pool[1 + r.int(pool.length - 1)];
    categories[id] = {
      id,
      category,
      name: chosen.name,
      form: chosen.form,
      hueShift: earthlike ? 0 : Math.round(r.range(-54, 54)),
      scale: +r.range(0.82, 1.42).toFixed(2),
      density: +r.range(0.78, 1.35).toFixed(2),
    };
  }
  const signature = Object.values(categories)
    .map((x) => `${x.form}:${x.hueShift}`)
    .join("|");
  return {
    version: 1,
    earthlike,
    categories,
    subsurface: {
      1: earthlike
        ? "cave network"
        : `${categories[TERRAIN_FEATURE.CAVERN].name.toLowerCase()} network`,
      2: earthlike
        ? "geothermal conduit"
        : `${categories[TERRAIN_FEATURE.GEOTHERMAL].name.toLowerCase()} conduit`,
      3: earthlike
        ? "mineral seam"
        : `${categories[TERRAIN_FEATURE.DEPOSIT].name.toLowerCase()} seam`,
    },
    signature,
  };
}
function makeTerrainGenome(world) {
  const earthlike = canonicalPlanetSeed(world.seed),
    r = makeRng(world.seed, "terrain-grammar-v2"),
    topologies = ["continental", "archipelago", "rifted", "cratered", "terraced", "cellular"],
    topology = earthlike ? "continental" : topologies[r.int(topologies.length)],
    alienness = earthlike ? 0.12 : r.range(0.62, 0.96),
    climates = ["latitudinal", "diagonal", "radial", "banded", "inverted"],
    climate = earthlike ? "latitudinal" : climates[r.int(climates.length)],
    craters = [];
  const craterCount = topology === "cratered" ? 4 + r.int(6) : r.int(3);
  for (let i = 0; i < craterCount; i++)
    craters.push({
      x: r.range(-0.82, 0.82),
      y: r.range(-0.82, 0.82),
      radius: r.range(0.09, 0.31),
      depth: r.range(0.09, 0.27),
      rim: r.range(0.04, 0.14),
    });
  return {
    version: 3,
    earthlike,
    alienness,
    topology,
    topologyIndex: topologies.indexOf(topology),
    continentScale: earthlike ? 43 : r.range(24, 76),
    detailScale: earthlike ? 17 : r.range(8, 24),
    ridgeScale: earthlike ? 19 : r.range(10, 38),
    domainWarp: earthlike ? 4 : r.range(8, 31),
    ridgeWeight: earthlike ? 0.15 : r.range(0.08, 0.34),
    edgeFalloff: earthlike ? 0.11 : r.range(0.02, 0.24),
    terraceLevels: topology === "terraced" ? 5 + r.int(11) : 0,
    targetWater: earthlike ? 0.54 : r.range(0.22, 0.7),
    riverScale: r.range(9, 29),
    riverWidth: earthlike ? 0.023 : r.range(0.012, 0.039),
    riverAngle: r.range(0, Math.PI * 2),
    climate,
    climateAngle: earthlike ? 0 : r.range(0, Math.PI * 2),
    thermalBands: 2 + r.int(5),
    baseTemperature: earthlike ? 302 : r.range(278, 358),
    temperatureSpan: earthlike ? 182 : r.range(115, 235),
    temperatureNoise: earthlike ? 66 : r.range(45, 118),
    lapseRate: earthlike ? 0.108 : r.range(0.055, 0.145),
    wetBias: earthlike ? 0 : r.range(-115, 155),
    craters,
    structureGenome: makeStructureGenome(world, earthlike),
  };
}
function terrainGrammarHeight(g, seed, x, y, w, h) {
  const nx = (x / (w - 1) - 0.5) * 2,
    ny = (y / (h - 1) - 0.5) * 2,
    warpX = (noise2(seed ^ 0x51a7, x / 57, y / 57) - 0.5) * g.domainWarp,
    warpY = (noise2(seed ^ 0xa175, x / 61, y / 61) - 0.5) * g.domainWarp,
    xx = x + warpX,
    yy = y + warpY,
    n = fbm(seed ^ 0x7381, xx / g.continentScale, yy / g.continentScale),
    detail = noise2(seed ^ 0x19d3, xx / g.detailScale, yy / g.detailScale) - 0.5,
    ridge = 1 - Math.abs(noise2(seed ^ 0x5e21, xx / g.ridgeScale, yy / g.ridgeScale) * 2 - 1),
    edge = Math.pow(Math.max(Math.abs(nx), Math.abs(ny)), 3);
  let v = n * 0.76 + detail * 0.12 + ridge * g.ridgeWeight - edge * g.edgeFalloff;
  if (g.topology === "archipelago")
    v =
      Math.pow(clamp(n, 0, 1), 1.45) * 0.78 +
      ridge * 0.13 +
      detail * 0.16 -
      edge * (g.edgeFalloff + 0.13);
  else if (g.topology === "rifted") {
    const fault = Math.abs(noise2(seed ^ 0xc731, xx / 34, yy / 11) - 0.5) * 2;
    v = n * 0.73 + ridge * 0.16 + detail * 0.12 - Math.pow(1 - fault, 4) * 0.31;
  } else if (g.topology === "cratered") {
    v = n * 0.66 + ridge * 0.13 + detail * 0.11;
    for (const c of g.craters) {
      const d = Math.hypot(nx - c.x, ny - c.y) / c.radius;
      if (d < 1) v -= Math.pow(1 - d, 1.7) * c.depth;
      const rim = Math.abs(d - 1);
      if (rim < 0.22) v += (1 - rim / 0.22) * c.rim;
    }
  } else if (g.topology === "cellular") {
    const cell = Math.abs(noise2(seed ^ 0x94d1, xx / 22, yy / 22) - 0.5) * 2,
      membrane = Math.pow(1 - cell, 2.2);
    v = n * 0.52 + ridge * 0.12 + cell * 0.28 - membrane * 0.19 + detail * 0.13;
  }
  return v;
}
function terrainClimateDistance(g, seed, x, y, w, h) {
  const nx = (x / (w - 1) - 0.5) * 2,
    ny = (y / (h - 1) - 0.5) * 2,
    c = Math.cos(g.climateAngle),
    s = Math.sin(g.climateAngle),
    axis = clamp(Math.abs(nx * s + ny * c), 0, 1),
    across = nx * c - ny * s;
  if (g.climate === "radial") return clamp(Math.hypot(nx, ny) * 0.76, 0, 1);
  if (g.climate === "banded")
    return clamp(Math.abs(Math.sin(across * Math.PI * g.thermalBands)) * 0.82 + axis * 0.18, 0, 1);
  if (g.climate === "inverted") return 1 - axis;
  if (g.climate === "diagonal")
    return clamp(axis * 0.82 + noise2(seed ^ 0xdd17, x / 53, y / 53) * 0.18, 0, 1);
  return Math.abs(y / (h - 1) - 0.5) * 2;
}
function fitExactOceanQuantile(raw, hist, rank, target, sea, seed) {
  let below = 0;
  for (let e = 0; e < sea; e++) below += hist[e] || 0;
  const needed = target - below,
    tied = hist[sea] || 0;
  if (needed < 0 || needed > tied) return { exact: false, count: below, adjusted: 0 };
  if (needed) {
    const plateau = [];
    for (let i = 0; i < raw.length; i++) if ((raw[i] | 0) === sea) plateau.push(i);
    plateau.sort(
      (a, b) =>
        rank[a] - rank[b] ||
        mix32(seed ^ Math.imul(a + 1, 0x9e3779b1)) - mix32(seed ^ Math.imul(b + 1, 0x9e3779b1)) ||
        a - b,
    );
    for (let i = 0; i < needed; i++) raw[plateau[i]] = sea - 1;
  }
  return { exact: true, count: target, adjusted: needed };
}
function generateProceduralTileWorld(world) {
  const { width: w, height: h, seedHash: s, laws, tiles: t } = world,
    n = w * h,
    g = (world.terrainGenome = makeTerrainGenome(world)),
    raw = new Float32Array(n),
    waterRank = new Float32Array(n);
  let lo = Infinity,
    hi = -Infinity;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x,
        v = terrainGrammarHeight(g, s, x, y, w, h);
      raw[i] = v;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  const hist = new Uint32Array(1001),
    span = Math.max(0.0001, hi - lo);
  for (let i = 0; i < n; i++) {
    let q = clamp((raw[i] - lo) / span, 0, 1);
    q = q * q * (3 - 2 * q);
    waterRank[i] = q;
    if (g.terraceLevels) q = Math.round(q * g.terraceLevels) / g.terraceLevels;
    const e = u16(45 + q * 910);
    raw[i] = e;
    hist[e]++;
  }
  const waterTarget = Math.floor(n * g.targetWater);
  let seen = 0,
    sea = 430;
  for (let e = 0; e < hist.length; e++) {
    seen += hist[e];
    if (seen >= waterTarget) {
      sea = e;
      break;
    }
  }
  sea = clamp(sea, 245, 690);
  const oceanFit = fitExactOceanQuantile(raw, hist, waterRank, waterTarget, sea, s);
  g.seaLevel = sea;
  g.waterTargetTiles = waterTarget;
  g.oceanTileCount = oceanFit.count;
  g.waterTargetExact = oceanFit.exact;
  const rc = Math.cos(g.riverAngle),
    rs = Math.sin(g.riverAngle);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x,
        e = raw[i] | 0,
        rx = (x * rc - y * rs) / g.riverScale,
        ry = (x * rs + y * rc) / (g.riverScale * 0.55),
        river = Math.abs(noise2(s ^ 0x9911, rx, ry) - 0.5),
        surfaceWater =
          e < sea
            ? u16((sea - e) * 12.5)
            : river < g.riverWidth && e < sea + 255
              ? u16((g.riverWidth - river) * 15500 + 150)
              : 0;
      t.elevation[i] = e;
      t.liquid[i] = surfaceWater;
      t.hydrologyBase[i] = surfaceWater;
      const climate = terrainClimateDistance(g, s, x, y, w, h),
        temp =
          g.baseTemperature -
          climate * g.temperatureSpan -
          e * g.lapseRate +
          (noise2(s ^ 0x1837, x / 47, y / 47) - 0.5) * g.temperatureNoise;
      t.temperature[i] = i16(temp);
      const wet = clamp(
        surfaceWater
          ? 900
          : 690 + g.wetBias - (e - sea) * 0.72 + (noise2(s ^ 0x77a1, x / 21, y / 21) - 0.5) * 560,
        45,
        880,
      );
      t.chem[C.SOLVENT][i] = u16(surfaceWater + wet);
      t.chem[C.OXIDANT][i] = u16(610 + laws.oxidationPotential * 130);
      t.chem[C.NUTRIENT][i] = u16(
        (390 + noise2(s ^ 0x2281, x / 15, y / 15) * 1020) * laws.resourceRichness,
      );
      t.chem[C.MINERAL][i] = u16(1450 + e * 3.35);
      t.chem[C.ORE][i] = u16(
        Math.max(0, (noise2(s ^ 0x4921, x / 11, y / 11) - 0.64) * 7800) * laws.resourceRichness,
      );
      t.chem[C.CATALYST][i] = u16(35 + noise2(s ^ 0x7719, x / 8, y / 8) * 210);
      t.chem[C.TOXIN][i] = u16(Math.max(0, (noise2(s ^ 0x9953, x / 14, y / 14) - 0.8) * 1300));
      t.chem[C.GAS][i] = u16(470 + noise2(s ^ 0x61c3, x / 43, y / 43) * 145);
      t.soilOrder[i] = u16(e < sea ? 120 : 450 + wet * 0.39);
      t.structureOrder[i] = u16(e < sea ? 240 : 500 + e * 0.31);
      const motif = mix32(s ^ Math.imul(i + 1, 0x9e3779b1));
      t.basePattern[i] = u16(g.topologyIndex * 24 + (motif % 24));
      const compat = clamp(1 - Math.abs(temp - 205) / 225, 0, 1),
        plant =
          e > sea - 18
            ? u16(clamp((wet - 135) * compat * laws.plantEfficiency, 0, 940))
            : u16(surfaceWater < 720 ? wet * 0.18 : 0);
      t.plantOrder[i] = plant;
      t.chem[C.ORGANIC][i] = u16(plant * 1.9);
      t.chem[C.ENERGY][i] = u16(plant * 1.4);
      t.chem[C.FUEL][i] = u16(plant * 0.45);
    }
  compileEcologicalStructures(world);
}
function ensureEcologicalColumns(world) {
  const n = world.tileCount,
    t = world.tiles;
  if (!t.featureType || t.featureType.length !== n) t.featureType = new Uint8Array(n);
  if (!t.featureStrength || t.featureStrength.length !== n) t.featureStrength = new Uint16Array(n);
  if (!t.subsurfaceType || t.subsurfaceType.length !== n) t.subsurfaceType = new Uint8Array(n);
  if (!t.geothermal || t.geothermal.length !== n) t.geothermal = new Uint16Array(n);
  if (!t.slope || t.slope.length !== n) t.slope = new Uint16Array(n);
}
function naturalSurfaceWaterAt(world, x, y) {
  const g = world.terrainGenome,
    e = world.tiles.elevation[y * world.width + x],
    sea = g?.seaLevel ?? 430;
  if (e < sea) return u16((sea - e) * 12.5);
  if (!g) return 0;
  const rc = Math.cos(g.riverAngle),
    rs = Math.sin(g.riverAngle),
    rx = (x * rc - y * rs) / g.riverScale,
    ry = (x * rs + y * rc) / (g.riverScale * 0.55),
    river = Math.abs(noise2(world.seedHash ^ 0x9911, rx, ry) - 0.5);
  return river < g.riverWidth && e < sea + 255 ? u16((g.riverWidth - river) * 15500 + 150) : 0;
}
function ensureHydrologyBaseline(world) {
  const n = world.tileCount,
    t = world.tiles;
  if (t.hydrologyBase && t.hydrologyBase.length === n) return;
  t.hydrologyBase = new Uint16Array(n);
  for (let y = 0; y < world.height; y++)
    for (let x = 0; x < world.width; x++)
      t.hydrologyBase[y * world.width + x] = naturalSurfaceWaterAt(world, x, y);
}
function structureRand(seed, salt, a, b = 0) {
  return hashParts(seed, hashString(salt), a, b) / 4294967296;
}
function compileEcologicalStructures(world) {
  ensureEcologicalColumns(world);
  const { tiles: t, width: w, height: h, tileCount: n, seedHash: s } = world,
    sea = world.terrainGenome?.seaLevel ?? 430,
    grammar =
      world.terrainGenome?.structureGenome ||
      (world.terrainGenome.structureGenome = makeStructureGenome(world)),
    centers = [],
    byType = {};
  t.featureType.fill(0);
  t.featureStrength.fill(0);
  t.subsurfaceType.fill(0);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x,
        e = t.elevation[i],
        left = t.elevation[y * w + Math.max(0, x - 1)],
        right = t.elevation[y * w + Math.min(w - 1, x + 1)],
        up = t.elevation[Math.max(0, y - 1) * w + x],
        down = t.elevation[Math.min(h - 1, y + 1) * w + x];
      t.slope[i] = u16(
        Math.max(Math.abs(e - left), Math.abs(e - right), Math.abs(e - up), Math.abs(e - down)),
      );
      const thermal =
        noise2(s ^ 0x6e31, x / 17, y / 17) * 0.62 + noise2(s ^ 0xa913, x / 5, y / 5) * 0.38;
      t.geothermal[i] = u16(
        clamp((thermal - 0.42) * 1700 + Math.max(0, t.temperature[i] - 300) * 1.2, 0, 1000),
      );
    }
  const moisture = (i) => clamp((t.chem[C.SOLVENT][i] - t.liquid[i] * 0.55) / 9, 0, 100),
    scoreFor = (type, i) => {
      const e = t.elevation[i],
        liq = t.liquid[i],
        m = moisture(i),
        sl = t.slope[i],
        plant = t.plantOrder[i],
        ore = t.chem[C.ORE][i],
        cat = t.chem[C.CATALYST][i],
        j = noise2(s ^ Math.imul(type, 0x45d9f3b), (i % w) / 7, Math.floor(i / w) / 7) * 90;
      if (type === TERRAIN_FEATURE.CANOPY)
        return liq < 140 && e > sea - 10 && plant > 220 ? plant * 1.3 + m * 3 + j : -1e9;
      if (type === TERRAIN_FEATURE.HIGHLAND)
        return liq < 160 && e > sea + 145 ? e * 1.15 + sl * 5 + j : -1e9;
      if (type === TERRAIN_FEATURE.CAVERN)
        return liq < 300 && e > sea + 45 ? e * 0.35 + sl * 7 + t.structureOrder[i] * 0.3 + j : -1e9;
      if (type === TERRAIN_FEATURE.GEOTHERMAL)
        return t.geothermal[i] * 1.2 + ore * 0.18 + cat * 2.5 + (liq > 160 ? 130 : 0) + j;
      if (type === TERRAIN_FEATURE.AQUATIC)
        return liq > 100 && liq < 2400
          ? plant * 0.75 + t.chem[C.NUTRIENT][i] * 0.32 + cat * 1.8 + j
          : -1e9;
      return liq < 500 ? ore * 1.25 + cat * 5 + sl * 2 + j : -1e9;
    },
    eligible = (type, i) => scoreFor(type, i) > -1e8,
    paint = (type, center, radius, strength) => {
      const [cx, cy] = [center % w, Math.floor(center / w)];
      for (let dy = -radius; dy <= radius; dy++)
        for (let dx = -radius; dx <= radius; dx++) {
          const x = cx + dx,
            y = cy + dy;
          if (x < 0 || y < 0 || x >= w || y >= h) continue;
          const i = y * w + x,
            d = Math.hypot(dx, dy);
          if (d > radius + 0.15 || !eligible(type, i)) continue;
          if (
            i !== center &&
            structureRand(s, "structure-cluster", type * 100000 + center, i) > 0.74 - d * 0.08
          )
            continue;
          if (!t.featureType[i] || i === center) {
            t.featureType[i] = type;
            t.featureStrength[i] = u16(clamp(strength - d * 170, 220, 1000));
          }
        }
      if (type === TERRAIN_FEATURE.CAVERN)
        for (let dy = -3; dy <= 3; dy++)
          for (let dx = -3; dx <= 3; dx++) {
            const x = cx + dx,
              y = cy + dy;
            if (x >= 0 && y >= 0 && x < w && y < h && dx * dx + dy * dy <= 10)
              t.subsurfaceType[y * w + x] = 1;
          }
      else if (type === TERRAIN_FEATURE.GEOTHERMAL)
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++) {
            const x = cx + dx,
              y = cy + dy;
            if (x >= 0 && y >= 0 && x < w && y < h && dx * dx + dy * dy <= 5)
              t.subsurfaceType[y * w + x] = 2;
          }
      else if (type === TERRAIN_FEATURE.DEPOSIT)
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++) {
            const x = cx + dx,
              y = cy + dy;
            if (
              x >= 0 &&
              y >= 0 &&
              x < w &&
              y < h &&
              dx * dx + dy * dy <= 5 &&
              !t.subsurfaceType[y * w + x]
            )
              t.subsurfaceType[y * w + x] = 3;
          }
    },
    place = (type, count, spacing, radius) => {
      const candidates = [];
      for (let i = 0; i < n; i++) {
        const score = scoreFor(type, i);
        if (score > -1e8) candidates.push({ i, score });
      }
      candidates.sort((a, b) => b.score - a.score || a.i - b.i);
      const picked = [];
      for (const c of candidates) {
        const [x, y] = [c.i % w, Math.floor(c.i / w)];
        if (
          picked.some((p) => {
            const px = p % w,
              py = Math.floor(p / w);
            return (x - px) * (x - px) + (y - py) * (y - py) < spacing * spacing;
          })
        )
          continue;
        picked.push(c.i);
        const strength = 650 + Math.floor(structureRand(s, "structure-strength", type, c.i) * 350);
        paint(type, c.i, radius, strength);
        centers.push({ tile: c.i, type, strength });
        if (picked.length >= count) break;
      }
      byType[type] = picked.length;
    };
  const scale = Math.max(0.7, n / (120 * 72)),
    density = (id) => grammar.categories[id]?.density || 1;
  place(TERRAIN_FEATURE.HIGHLAND, Math.max(8, Math.round(13 * scale * density(2))), 5, 1);
  place(TERRAIN_FEATURE.CAVERN, Math.max(7, Math.round(10 * scale * density(3))), 6, 0);
  place(TERRAIN_FEATURE.GEOTHERMAL, Math.max(7, Math.round(9 * scale * density(4))), 7, 1);
  place(TERRAIN_FEATURE.AQUATIC, Math.max(10, Math.round(16 * scale * density(5))), 5, 2);
  place(TERRAIN_FEATURE.CANOPY, Math.max(12, Math.round(20 * scale * density(1))), 5, 2);
  place(TERRAIN_FEATURE.DEPOSIT, Math.max(8, Math.round(11 * scale * density(6))), 6, 1);
  world.ecologicalStructures = { version: 1, centers, byType, signature: grammar.signature };
}
generateTileWorld = generateProceduralTileWorld;
const restoreWorldTerrainDefaults = restoreWorldDefaults;
restoreWorldDefaults = function () {
  restoreWorldTerrainDefaults();
  W.terrainGenome = W.terrainGenome || makeTerrainGenome(W);
  if (!W.terrainGenome.structureGenome)
    W.terrainGenome.structureGenome = makeStructureGenome(W, W.terrainGenome.earthlike);
  ensureHydrologyBaseline(W);
  ensureEcologicalColumns(W);
  if (!W.ecologicalStructures || !W.tiles.featureType.some((v) => v))
    compileEcologicalStructures(W);
};
