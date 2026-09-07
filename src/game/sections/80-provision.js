// ═══════════════════════════════════════════════════════════════════════════
// 80. PROVISION — every world has a road to letters within reach
// ═══════════════════════════════════════════════════════════════════════════
// Pigment and the information-bearing polymers that writing, archives, and
// governance need were never laid down by the world generator: they reached
// the ground only through the death of whatever plants and animals happened to
// carry them. A world whose flora ran to other chemistries had towns that
// could never learn their letters, however long they stood. The generator now
// provisions the land: every habitable stretch gets an ochre seam and a
// polymer bed within a prospector's reach, placed on deposits, highlands, and
// canopy where the ground already suits them, and booked into the world's
// initial matter so the audit stays exact. Worlds saved before this are
// provisioned once on load. Where pigment is still out of reach, crystal
// stands in for it in research and in the archive's inks.
const PROVISION_REACH = 32,
  PROVISION_BLOCK = 24,
  PROVISION_MIN_SEAM = 6,
  PROVISION_MIN_LAND = 24,
  PROVISION_SEAMS = () => [
    [C.PIGMENT, 24, [TERRAIN_FEATURE.DEPOSIT, TERRAIN_FEATURE.HIGHLAND, TERRAIN_FEATURE.CAVERN]],
    [C.INFO, 16, [TERRAIN_FEATURE.CANOPY, TERRAIN_FEATURE.AQUATIC]],
  ],
  RESEARCH_SUBSTITUTES = () => ({ [C.PIGMENT]: [C.CRYSTAL] });
function provisionLand(world, tile) {
  return world.tiles.liquid[tile] <= WATER_DEPTH.SURFACE && world.tiles.fire[tile] < 100;
}
// Blocks of land where people could live: enough dry ground with some growth.
function habitableBlocks(world = W) {
  const out = [];
  for (let by = 0; by < world.height; by += PROVISION_BLOCK)
    for (let bx = 0; bx < world.width; bx += PROVISION_BLOCK) {
      let land = 0,
        sx = 0,
        sy = 0;
      for (let y = by; y < Math.min(world.height, by + PROVISION_BLOCK); y++)
        for (let x = bx; x < Math.min(world.width, bx + PROVISION_BLOCK); x++) {
          const i = y * world.width + x;
          if (provisionLand(world, i) && (world.tiles.plantOrder?.[i] || 0) > 40) {
            land++;
            sx += x;
            sy += y;
          }
        }
      if (land >= PROVISION_MIN_LAND)
        out.push({ x: Math.round(sx / land), y: Math.round(sy / land), land });
    }
  return out;
}
function seamWithin(world, cx, cy, sp, reach = PROVISION_REACH) {
  for (let y = Math.max(0, cy - reach); y <= Math.min(world.height - 1, cy + reach); y++)
    for (let x = Math.max(0, cx - reach); x <= Math.min(world.width - 1, cx + reach); x++) {
      const i = y * world.width + x,
        amount =
          sp < COMMON_CHEM ? world.tiles.chem[sp][i] : world.tiles.rareChem[`${i}:${sp}`] || 0;
      if (amount >= PROVISION_MIN_SEAM) return i;
    }
  return -1;
}
// A land tile near the block's heart, preferring ground that suits the seam.
function seamSite(world, cx, cy, sp, features) {
  let best = -1,
    score = -Infinity;
  for (let y = Math.max(1, cy - 10); y <= Math.min(world.height - 2, cy + 10); y++)
    for (let x = Math.max(1, cx - 10); x <= Math.min(world.width - 2, cx + 10); x++) {
      const i = y * world.width + x;
      if (!provisionLand(world, i)) continue;
      const feature = world.tiles.featureType?.[i] || 0,
        s =
          (features.includes(feature) ? 40 : 0) -
          Math.sqrt(dist2(cx, cy, x, y)) +
          (hashParts(world.seedHash, "provision", sp, i) % 1000) / 100;
      if (s > score) {
        score = s;
        best = i;
      }
    }
  return best;
}
function provisionCivicMaterials(world = W, reason = "worldgen") {
  if (!world?.tiles || world.provisioned?.version === 1) return world?.provisioned || null;
  const seams = [];
  let deposited = 0;
  for (const block of habitableBlocks(world))
    for (const [sp, amount, features] of PROVISION_SEAMS()) {
      if (seamWithin(world, block.x, block.y, sp) >= 0) continue;
      const tile = seamSite(world, block.x, block.y, sp, features);
      if (tile < 0) continue;
      const key = `${tile}:${sp}`;
      if (sp < COMMON_CHEM)
        world.tiles.chem[sp][tile] = Math.min(65535, world.tiles.chem[sp][tile] + amount);
      else world.tiles.rareChem[key] = (world.tiles.rareChem[key] || 0) + amount;
      deposited += amount;
      seams.push([tile, sp]);
    }
  // The seams were always part of the world: they join its initial endowment.
  if (world.conservation) world.conservation.initialMatter += deposited;
  world.provisioned = { version: 1, seams: seams.length, deposited, tick: world.tick, reason };
  return world.provisioned;
}
const createWorldProvisionBase = createWorld;
createWorld = function (options) {
  const world = createWorldProvisionBase(options);
  provisionCivicMaterials(world || W, "worldgen");
  return world;
};
const restoreWorldProvisionBase = restoreWorldDefaults;
restoreWorldDefaults = function () {
  restoreWorldProvisionBase();
  if (W?.tiles && !W.provisioned) provisionCivicMaterials(W, "load");
};
// ── Crystal stands in for pigment where there is none ──────────────────────────
const hasResearchMaterialProvisionBase = hasResearchMaterial;
hasResearchMaterial = function (place, sp) {
  if (hasResearchMaterialProvisionBase(place, sp)) return true;
  for (const alt of RESEARCH_SUBSTITUTES()[sp] || [])
    if (hasResearchMaterialProvisionBase(place, alt)) return true;
  return false;
};
let PROVISION_FORCE_SWAP = false;
function pigmentOutOfReach(place) {
  if (PROVISION_FORCE_SWAP) return true;
  if (!place?.knownProcesses || typeof resourceWithin !== "function") return false;
  return (
    (place.inventory?.[C.PIGMENT] || 0) < 4 &&
    (place.researchInventory?.[C.PIGMENT] || 0) < 4 &&
    resourceWithin(place, C.PIGMENT, 40) < 0
  );
}
const buildingRequirementsProvisionBase = buildingRequirements;
buildingRequirements = function (place, type) {
  const raw = buildingRequirementsProvisionBase(place, type);
  if (!raw.some(([sp]) => sp === C.PIGMENT) || !pigmentOutOfReach(place)) return raw;
  const crystalNear =
    (place.inventory?.[C.CRYSTAL] || 0) >= 4 ||
    (typeof resourceWithin === "function" && resourceWithin(place, C.CRYSTAL, 40) >= 0);
  if (!crystalNear) return raw;
  const totals = new Map();
  for (const [sp, n] of raw) {
    const species = sp === C.PIGMENT ? C.CRYSTAL : sp;
    totals.set(species, (totals.get(species) || 0) + n);
  }
  return Array.from(totals.entries()).sort((a, b) => a[0] - b[0]);
};
window.ALIFE_PROVISION_DEBUG = Object.freeze({
  provision: () => provisionCivicMaterials(W, "debug"),
  state: () => (W?.provisioned ? { ...W.provisioned } : null),
  blocks: () => habitableBlocks(W),
  coverage: () => {
    const blocks = habitableBlocks(W),
      missing = [];
    for (const block of blocks)
      for (const [sp] of PROVISION_SEAMS())
        if (seamWithin(W, block.x, block.y, sp) < 0)
          missing.push({ x: block.x, y: block.y, material: W.definitions.species[sp].name });
    return { blocks: blocks.length, missing };
  },
  forceSwap: (on) => {
    PROVISION_FORCE_SWAP = !!on;
    return PROVISION_FORCE_SWAP;
  },
  requirements: (placeId, type) =>
    buildingRequirements(
      W.settlements.find((s) => s.id === placeId) || W.camps.find((c) => c.id === placeId),
      type,
    ).map(([sp, n]) => [W.definitions.species[sp].name, n]),
});
