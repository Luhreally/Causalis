// ═══════════════════════════════════════════════════════════════════════════
// 13. PROCESS DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════
function reactionById(id) {
  return W.definitions.reactions.find((r) => r.id === id);
}
function tileMatterKey(tile, species) {
  return `${tile}:${species}`;
}
function tileMatterAmount(tile, species) {
  const overflow = W.tiles.rareChem[tileMatterKey(tile, species)] || 0;
  return (species < COMMON_CHEM ? W.tiles.chem[species][tile] : 0) + overflow;
}
function setTileMatterAmount(tile, species, value) {
  value = Number(value);
  value = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  const key = tileMatterKey(tile, species);
  if (species < COMMON_CHEM) {
    const primary = Math.min(65535, value);
    W.tiles.chem[species][tile] = primary;
    const overflow = value - primary;
    if (overflow) W.tiles.rareChem[key] = overflow;
    else delete W.tiles.rareChem[key];
  } else if (value) W.tiles.rareChem[key] = value;
  else delete W.tiles.rareChem[key];
  return value;
}
function invEntity(id) {
  const q = W.components.chemistry[id].q;
  return {
    get: (s) => q[s] || 0,
    set: (s, v) => (q[s] = u16(v)),
    capacity: () => 65535,
    temperature: () => W.components.chemistry[id].temperature / 10,
    hasStructure: (req) =>
      req !== "bounded reaction space" || W.components.structure[id]?.boundaryStrength > 0.2,
    structure: (kind, amount) => {
      const l = W.components.life[id];
      if (kind === "damage") l.integrity = u16(l.integrity - amount);
      if (kind === "repair") l.integrity = Math.min(1000, u16(l.integrity + amount));
      W.components.genome[id].dirty = true;
    },
    energy: (d) => {
      const c = W.components.chemistry[id];
      c.storedFreeEnergy = Math.max(0, c.storedFreeEnergy + d);
    },
  };
}
function invTile(i) {
  return {
    get: (s) => tileMatterAmount(i, s),
    set: (s, v) => setTileMatterAmount(i, s, v),
    capacity: () => Number.MAX_SAFE_INTEGER,
    temperature: () => W.tiles.temperature[i] / 10,
    hasStructure: () => true,
    structure: (kind, amount) => {
      if (kind === "damage" || kind === "decay")
        W.tiles.structureOrder[i] = u16(W.tiles.structureOrder[i] - amount);
      else if (kind === "repair" || kind === "growth" || kind === "order")
        W.tiles.structureOrder[i] = u16(W.tiles.structureOrder[i] + amount);
      else if (kind === "disorder") W.tiles.soilOrder[i] = u16(W.tiles.soilOrder[i] - amount);
    },
    energy: (d) => {
      W.tiles.temperature[i] = i16(W.tiles.temperature[i] + d * 0.8);
    },
  };
}
function invSettlement(s) {
  const q = s.inventory;
  return {
    get: (i) => q[i] || 0,
    set: (i, v) => (q[i] = u16(v)),
    capacity: () => 65535,
    temperature: () => s.productionTemperature || 20,
    hasStructure: (req) => req !== "bounded reaction space" || s.structure.integrity > 80,
    structure: (kind, amount) => {
      if (kind === "damage") s.structure.integrity = u16(s.structure.integrity - amount);
      else if (kind === "decay") s.structure.order = u16(s.structure.order - amount);
      else if (kind === "repair" || kind === "growth" || kind === "order")
        s.structure.order = u16(s.structure.order + amount);
    },
    energy: (d) => {
      s.heat = u16((s.heat || 0) + d);
    },
  };
}
function invArray(q, temp = 21) {
  return {
    get: (s) => q[s] || 0,
    set: (s, v) => (q[s] = u16(v)),
    capacity: () => 65535,
    temperature: () => temp,
    hasStructure: () => true,
    structure: () => {},
    energy: () => {},
  };
}
function executeProcess(processId, inventory, requested = 1, context = {}) {
  const rx = reactionById(processId);
  if (!rx || !rx.balanced) return 0;
  const temp = inventory.temperature(),
    mediumOk = rx.requiredMedium == null || inventory.get(rx.requiredMedium) > 0,
    catalystsOk = rx.requiredCatalysts.every((s) => inventory.get(s) > 0),
    structureOk = rx.structuralRequirements.every(
      (s) => !inventory.hasStructure || inventory.hasStructure(s),
    ),
    externalPer = Math.max(0, Number(context.externalEnergy) || 0),
    externalFlux = Math.max(0, Number(context.externalFlux ?? 1) || 0);
  if (
    temp < rx.minimumTemperature ||
    temp > rx.maximumTemperature ||
    !mediumOk ||
    !catalystsOk ||
    !structureOk ||
    externalPer < rx.externalEnergyRequirement ||
    rx.inhibitedBy.some((s) => inventory.get(s) > 800)
  )
    return 0;
  const thermal = clamp(
      (temp - rx.minimumTemperature + 25) /
        (25 + rx.activationEnergy * 6 + rx.pressureSensitivity * (context.pressure || 1)),
      0.2,
      1,
    ),
    kinetic = clamp(rx.baseRate * 4 + thermal * 0.65, 0.2, 1),
    potentialExtent = Math.max(0, requested * kinetic * externalFlux);
  let extent = Math.floor(potentialExtent);
  if (
    requested > 0 &&
    potentialExtent > 0 &&
    extent === 0 &&
    counterRand(
      "fractional-process",
      processId,
      W.tick,
      Number(context.location) || 0,
      Number(context.subjects?.[0]) || 0,
    ) < potentialExtent
  )
    extent = 1;
  for (const [s, n] of rx.reactants) extent = Math.min(extent, Math.floor(inventory.get(s) / n));
  for (const [s, n] of rx.products) {
    const capacity = inventory.capacity ? inventory.capacity(s) : 65535;
    extent = Math.min(extent, Math.floor((capacity - inventory.get(s)) / n));
  }
  if (extent <= 0) return 0;
  for (const [s, n] of rx.reactants) inventory.set(s, inventory.get(s) - n * extent);
  for (const [s, n] of rx.products) inventory.set(s, inventory.get(s) + n * extent);
  const dissipate = context.dissipate || 0,
    thermalChange = (externalPer - rx.chemicalEnergyDelta - dissipate) * extent;
  inventory.energy(thermalChange);
  W.conservation.thermalEnergy = (W.conservation.thermalEnergy || 0) + thermalChange;
  for (const kind of rx.structuralEffects)
    inventory.structure(kind, Math.max(1, Math.floor(extent * 0.25)));
  W.conservation.radiantInput += externalPer * extent;
  W.conservation.dissipatedEnergy += dissipate * extent;
  if (context.recordEvent && context.location != null)
    for (const type of rx.emittedEvents || []) {
      if (type === "FireStartedEvent" && !context.wildfire) continue;
      const ev = emitEvent(type, {
        subjects: context.subjects || [],
        location: context.location,
        factions: context.factions || [],
        causes: context.causes || [],
        evidence: [
          `balanced ${processId.replaceAll("_", " ")} transformed ${extent} matter packets`,
        ],
        magnitude: extent,
        importance: context.importance ?? 2,
        data: {
          processId,
          text: `${titleCase(processId.replaceAll("_", " "))} became a reproducible material transformation`,
        },
      });
      if (context.eventSink) context.eventSink.push(ev.id);
    }
  return extent;
}
function executeAggregateProcess(q, processId, requested = 1, context = {}) {
  const rx = reactionById(processId);
  if (!rx) return 0;
  const batch = Array(SPECIES_COUNT).fill(0),
    needed = new Set(
      [...rx.reactants.map((x) => x[0]), ...rx.requiredCatalysts, rx.requiredMedium].filter(
        (x) => x != null,
      ),
    );
  for (const sp of needed) batch[sp] = Math.min(60000, q[sp] || 0);
  const before = batch.slice(),
    done = executeProcess(processId, invArray(batch), requested, context);
  if (done)
    for (let sp = 0; sp < SPECIES_COUNT; sp++) q[sp] = (q[sp] || 0) + batch[sp] - before[sp];
  return done;
}
function auditReactions() {
  const bad = [],
    details = [];
  for (const r of W.definitions.reactions) {
    const left = Array(W.definitions.families.length).fill(0),
      right = Array(left.length).fill(0);
    for (const [sp, n] of r.reactants)
      for (const [f, k] of W.definitions.species[sp].composition) left[f] += n * k;
    for (const [sp, n] of r.products)
      for (const [f, k] of W.definitions.species[sp].composition) right[f] += n * k;
    const familyOk = left.every((v, i) => v === right[i]),
      chargeLeft = sum(left.map((v, i) => v * W.definitions.families[i].charge)),
      chargeRight = sum(right.map((v, i) => v * W.definitions.families[i].charge)),
      chargeOk = Math.abs(chargeLeft - chargeRight) < 1e-9,
      energyAccounted =
        Number.isFinite(r.energyDelta) &&
        Number.isFinite(r.chemicalEnergyDelta) &&
        Math.abs(r.energyDelta + r.chemicalEnergyDelta) < 1e-6;
    if (!familyOk || !chargeOk || !energyAccounted) bad.push(r.id);
    details.push({ id: r.id, familyOk, chargeOk, energyAccounted });
  }
  return {
    ok: bad.length === 0,
    balanced: W.definitions.reactions.length - bad.length,
    total: W.definitions.reactions.length,
    bad,
    details,
  };
}
function totalMatter() {
  let total = 0;
  for (const v of Object.values(W.reservoirs || {})) {
    if (typeof v === "number") total += v;
    else if (v) for (const n of v) total += n;
  }
  for (const q of W.tiles.chem) for (let i = 0; i < q.length; i++) total += q[i];
  for (const v of Object.values(W.tiles.rareChem)) total += v;
  for (const id of W.activeIds) {
    const q = W.components.chemistry[id]?.q,
      inv = W.components.inventory[id];
    if (q) for (const v of q) total += v;
    if (inv) {
      for (const v of inv.materials || []) total += v;
      for (const v of inv.digestive || []) total += v;
    }
  }
  for (const c of W.camps)
    if (c.active) {
      for (const v of c.inventory) total += v;
      for (const v of c.structure.composition) total += v;
    }
  for (const s of W.settlements) {
    for (const v of s.inventory) total += v;
    for (const v of s.structure.composition) total += v;
  }
  for (const c of W.cohorts) for (const v of c.chemistryTotals) total += v;
  return total;
}
function totalChemicalEnergy() {
  const energy = W.definitions.species.map((s) => s.freeEnergy),
    sumStore = (q) => {
      let n = 0;
      for (let s = 0; s < SPECIES_COUNT; s++) n += (q?.[s] || 0) * energy[s];
      return n;
    };
  let total =
    (W.reservoirs.atmosphericSolvent || 0) * energy[C.SOLVENT] +
    (W.reservoirs.deepMineral || 0) * energy[C.MINERAL] +
    sumStore(W.reservoirs.primordialPackets);
  for (let s = 0; s < COMMON_CHEM; s++) for (const v of W.tiles.chem[s]) total += v * energy[s];
  for (const [key, v] of Object.entries(W.tiles.rareChem)) {
    const sp = Number(key.slice(key.lastIndexOf(":") + 1));
    total += v * (energy[sp] || 0);
  }
  for (const id of W.activeIds) {
    total +=
      sumStore(W.components.chemistry[id]?.q) +
      sumStore(W.components.inventory[id]?.materials) +
      sumStore(W.components.inventory[id]?.digestive);
  }
  for (const c of W.camps)
    if (c.active) total += sumStore(c.inventory) + sumStore(c.structure.composition);
  for (const s of W.settlements) total += sumStore(s.inventory) + sumStore(s.structure.composition);
  for (const c of W.cohorts) total += sumStore(c.chemistryTotals);
  return total;
}
const totalMatterActive = totalMatter,
  totalChemicalEnergyActive = totalChemicalEnergy;
totalMatter = function () {
  let total = totalMatterActive();
  for (const refuge of W.biosphere?.refugia || [])
    for (const store of [refuge.chemistry, refuge.materials, refuge.digestive])
      for (const amount of store || []) total += amount;
  return total;
};
totalChemicalEnergy = function () {
  let total = totalChemicalEnergyActive(),
    energy = W.definitions.species.map((s) => s.freeEnergy);
  for (const refuge of W.biosphere?.refugia || [])
    for (const store of [refuge.chemistry, refuge.materials, refuge.digestive])
      for (let s = 0; s < SPECIES_COUNT; s++) total += (store?.[s] || 0) * energy[s];
  return total;
};
function auditMatter() {
  const current = totalMatter(),
    expected = W.conservation.initialMatter + W.conservation.playerInput - W.conservation.exported;
  return {
    current,
    expected,
    delta: current - expected,
    relative: expected ? Math.abs(current - expected) / expected : 0,
    note: "Integer matter packets; solar and dissipated heat are tracked outside mass.",
  };
}
