// ═══════════════════════════════════════════════════════════════════════════
// 115. FOUNDRY — metal for the skyline
// ═══════════════════════════════════════════════════════════════════════════
// A tower block needs twenty-four metal and six catalyst, an office the same,
// a factory twelve and four; but a builder could bring a site only what lay on
// the ground within nine tiles or, for four rare inputs, what the town stores
// held. Metal never lies on the ground: the forge and the factory smelt it from
// ore and fuel into the stores, and no builder ever drew it from there, so
// every tower, office, and factory site stood waiting for its metal for ever,
// and only the Causal push, which placed metal at the work face, ever finished
// one. Skylines were rare because the causal chain had a missing link, not
// because towns did not want them. Now metal, catalyst, and ceramic are drawn
// from the stores like the rare inputs; a builder whose site wants metal the
// stores cannot give digs ore and fuel for the forge instead of idling, and the
// gatherers add that feedstock to what they look for; the forge or the factory
// smelts for the site as soon as two ore and two fuel are in, and the kiln
// fires ceramic the same way. Nothing is invented: ore becomes metal by the
// smelting reaction, and every packet is booked like any other.
const FOUNDRY_PRODUCTS = [C.METAL, C.CATALYST, C.CERAMIC],
  FOUNDRY_RECIPES = [
    { sp: C.METAL, process: "smelting", facilities: ["factory", "forge"], craft: "metalworking", heat: 760, feed: C.ORE, feedstock: [C.ORE, C.FUEL], verb: "smelting" },
    { sp: C.CERAMIC, process: "ceramic_firing", facilities: ["kiln"], craft: "ceramics", heat: 560, feed: C.MINERAL, feedstock: [C.MINERAL, C.FUEL], verb: "firing" },
  ],
  FOUNDRY_PERIOD = 8,
  FOUNDRY_RUNS = 3,
  FOUNDRY_CARRY = 6,
  FOUNDRY_FEED_TARGET = 16,
  FOUNDRY = { smelted: 0, fired: 0, dug: 0, hauled: 0, runs: 0 };
for (const sp of FOUNDRY_PRODUCTS) if (!STORE_DRAWN_MATERIALS.includes(sp)) STORE_DRAWN_MATERIALS.push(sp);
function foundryRecipe(sp) {
  return FOUNDRY_RECIPES.find((r) => r.sp === sp) || null;
}
// What the town's sites still want of a material.
function foundryDemand(place, sp) {
  let needed = 0;
  for (const b of activeBuildings(place)) {
    const n = (b.requirements || []).find(([s]) => s === sp)?.[1] || 0;
    needed += Math.max(0, n - (b.composition?.[sp] || 0));
  }
  return needed;
}
// What the stores can give of it once the research samples are held back.
function foundryStock(place, sp) {
  return Math.max(0, (place.inventory?.[sp] || 0) - researchMaterialReserve(place, sp));
}
function foundryShort(place, sp) {
  return Math.max(0, foundryDemand(place, sp) - foundryStock(place, sp));
}
// The facility that makes it, if the town has the craft and the building.
function foundryFacility(place, sp) {
  const recipe = foundryRecipe(sp);
  if (!recipe || !place?.knownProcesses?.includes(recipe.craft)) return null;
  return recipe.facilities.find((t) => completedBuildings(place, t).length) || null;
}
// The feedstock a site's missing material is made from, when the town has the
// craft and the facility to make it and the stores cannot give it.
function constructionFeedstock(place, sp) {
  const recipe = foundryRecipe(sp);
  if (!recipe || !place?.knownProcesses) return [];
  if (!foundryFacility(place, sp) || !foundryShort(place, sp)) return [];
  return recipe.feedstock.filter((feed) => (place.inventory[feed] || 0) < FOUNDRY_FEED_TARGET);
}
function foundrySiteWanting(place, sp) {
  return activeBuildings(place).find((b) => (b.requirements || []).some(([s, n]) => s === sp && n > (b.composition?.[s] || 0))) || null;
}
// ── The forge and the kiln work for the sites ────────────────────────────────
function runFoundry(place, sp) {
  const recipe = foundryRecipe(sp);
  if (!recipe) return 0;
  const short = foundryShort(place, sp);
  if (short <= 0) return 0;
  const facility = foundryFacility(place, sp),
    rx = facility ? reactionById(recipe.process) : null;
  if (!rx) return 0;
  const inv = place.inventory,
    extent = Math.min(FOUNDRY_RUNS, Math.ceil(short / 2), ...rx.reactants.map(([s, n]) => Math.floor((inv[s] || 0) / n)));
  if (extent <= 0) return 0;
  const site = foundrySiteWanting(place, sp),
    operator = operateFacility(place, facility, `${recipe.verb} ${W.definitions.species[sp].name} for the ${site?.name || "works"}`, recipe.feed);
  if (!operator) return 0;
  const base = invSettlement(place),
    furnace = { ...base, temperature: () => Math.max(base.temperature(), recipe.heat) },
    made = executeProcess(recipe.process, furnace, extent, {
      location: idx(place.x, place.y),
      subjects: [operator.id, place.entityId].filter(Boolean),
      factions: place.factionId ? [place.factionId] : [],
      causes: [site?.causeEvent || place.importantEvents?.at(-1) || 0],
      eventSink: place.importantEvents,
      recordEvent: false,
    }) || 0;
  if (made) {
    FOUNDRY.runs++;
    if (sp === C.METAL) FOUNDRY.smelted += made;
    else FOUNDRY.fired += made;
  }
  return made;
}
function updateFoundries() {
  let made = 0;
  for (const place of W.settlements) {
    if (place.ruined || !place.knownProcesses) continue;
    for (const recipe of FOUNDRY_RECIPES) made += runFoundry(place, recipe.sp);
  }
  return made;
}
const updateCivicProductionFoundryBase = updateCivicProduction;
updateCivicProduction = function () {
  updateCivicProductionFoundryBase();
  if (W.tick % FOUNDRY_PERIOD === 0) updateFoundries();
};
// ── A builder digs for the forge when the stores cannot give the metal ───────
function foundryLabor(id, place) {
  const order = selectWorkOrder(id, place);
  if (!order || order.type === "salvage") return false;
  const b = W.buildings.find((x) => x.id === order.buildingId);
  if (!b || b.complete || b.ruined) return false;
  const missing = missingBuildingMaterial(b),
    recipe = missing ? foundryRecipe(missing.sp) : null;
  // While the stores can still give some, the builder draws that first.
  if (!recipe || foundryStock(place, missing.sp) > 0) return false;
  const feeds = constructionFeedstock(place, missing.sp);
  if (!feeds.length) return false;
  const inv = W.components.inventory[id].materials,
    p = W.components.position[id];
  // Feedstock in hand goes to the stores, where the forge takes it.
  if (recipe.feedstock.some((sp) => inv[sp] >= FOUNDRY_CARRY)) {
    if (!depositCarriedToPlace(id, place)) return false;
    FOUNDRY.hauled++;
    return true;
  }
  for (const sp of feeds) {
    const source = findResourceTile(id, sp);
    if (source < 0) continue;
    const purpose = toolPurposeForMaterial(sp),
      tool = toolForPurpose(id, purpose),
      name = W.definitions.species[sp].name;
    if (idx(p.x, p.y) !== source)
      return moveWorkerToward(id, source, purpose === "cut" ? "cut" : "mine", `seeking ${name} to smelt for the ${b.name}`, sp, b.id, tool?.entityId || 0);
    if (extractForWork(id, source, sp)) {
      FOUNDRY.dug++;
      setWorkAction(id, purpose, `digging ${name} to smelt for the ${b.name}`, source, sp, b.id, tool?.entityId || 0);
      return true;
    }
  }
  return false;
}
const performCivilLaborFoundryBase = performCivilLabor;
performCivilLabor = function (id) {
  if (W.kind[id] === KINDS.PERSON && workerReadyForLabor(id)) {
    const w = workState(id);
    if (!(w.task === "craft" && w.craftPurpose)) {
      const place = nearestWorkPlace(id);
      if (place?.knownProcesses && foundryLabor(id, place)) return true;
    }
  }
  return performCivilLaborFoundryBase(id);
};
window.ALIFE_FOUNDRY_DEBUG = Object.freeze({
  drawn: () => STORE_DRAWN_MATERIALS.slice(),
  wants: (placeId) => {
    const s = W.settlements.find((x) => x.id === placeId);
    if (!s) return [];
    return FOUNDRY_PRODUCTS.map((sp) => ({
      species: W.definitions.species[sp].name,
      demand: foundryDemand(s, sp),
      stock: foundryStock(s, sp),
      short: foundryShort(s, sp),
      facility: foundryFacility(s, sp),
      feedstock: constructionFeedstock(s, sp).map((f) => W.definitions.species[f].name),
    }));
  },
  run: (placeId) => {
    const s = W.settlements.find((x) => x.id === placeId);
    return s ? FOUNDRY_RECIPES.reduce((n, r) => n + runFoundry(s, r.sp), 0) : 0;
  },
  labor: (id) => {
    const place = nearestWorkPlace(id);
    return !!place?.knownProcesses && foundryLabor(id, place);
  },
  counts: () => ({ ...FOUNDRY }),
  reset: () => {
    for (const k of Object.keys(FOUNDRY)) FOUNDRY[k] = 0;
  },
});
