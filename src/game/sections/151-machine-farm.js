// ═══════════════════════════════════════════════════════════════════════════
// 151. THE MACHINE FARM — the industrial crafts grow food, each for a reason
// ═══════════════════════════════════════════════════════════════════════════
// Asked for: the industrial era's chain of crafts to make sense, and its food
// to be far better, so a town can hold far more people (150 keeps them). A
// field grows by one photosynthesis a tile an update (86), an update comes at
// most every thirty-two ticks (42d), and a field is ripe at six organic a
// tile. Of the crafts the industrial age learns, none reached that:
// mechanization and combustion changed construction and freight, electricity
// the factories, and fertilizer, crop rotation, selective breeding and the
// rest only raised how much of a tile a harvest may take (86's harvest cap),
// which the six organic a ripe tile holds never reached. Chemistry counted as
// a water craft, and fertilizer put nothing in the ground.
//
// Now each does what it says, through the ground's own matter:
//   mechanization (reapers and threshers), combustion (the tractor) and
//   electricity (the pump) each give a field another growth update a turn;
//   the breeding and rotation crafts (106's harvest effects) give one for
//   every half again of harvest they promise;
//   an update is a photosynthesis a tile, which takes a water, a nutrient and
//   two gas from the tile; where the ground has none, it does not grow;
//   electricity's pumps water the fields of a town that knows no water craft
//   (126's irrigation);
//   fertilizer carries the muck of the town's streets back to its fields
//   (134, before the ship as behind it), and spreads the stores' salts on the
//   poorest field tiles as nutrient;
//   chemistry is no water craft: its farming is fertilizer;
//   railways run on steam (87's railways need steam_power, 106).
const MACHINE_FARM = { extra: 0, salt: 0, muckTowns: 0, pumped: 0 },
  MACHINE_EXTRA_CAP = 5,
  FERTILIZER_SALT_PER_PASS = 24,
  FERTILIZER_TARGET = 40;
function machineFarmExtra(place) {
  const known = place?.knownProcesses || [];
  let extra = 0;
  for (const tech of ["mechanization", "combustion", "electricity"])
    if (known.includes(tech)) extra++;
  const promised = typeof branchEffects === "function" ? branchEffects(place).harvest || 1 : 1;
  extra += Math.max(0, Math.floor((promised - 1) / 0.5));
  return Math.min(MACHINE_EXTRA_CAP, extra);
}
const updateCultivatedFieldMachineBase = updateCultivatedField;
updateCultivatedField = function (building, place, operatorId = 0) {
  let grew = updateCultivatedFieldMachineBase(building, place, operatorId);
  const extra = grew > 0 ? machineFarmExtra(place) : 0;
  for (let n = 0; n < extra; n++) {
    const field = cultivatedField(building);
    if (!field || !["sown", "growing"].includes(field.stage)) break;
    const more = updateCultivatedFieldMachineBase(building, place, operatorId);
    if (!more) break;
    grew += more;
    MACHINE_FARM.extra++;
  }
  return grew;
};
// Chemistry leaves the water crafts; the count 86 and 126 read is irrigation
// and waterworks.
harvestTechCount = function (place) {
  const known = place?.knownProcesses || [];
  return (known.includes("irrigation") ? 1 : 0) + (known.includes("waterworks") ? 1 : 0);
};
// The pump waters what the bucket did not reach.
const placeIrrigatesMachineBase = placeIrrigates;
placeIrrigates = function (place) {
  return placeIrrigatesMachineBase(place) || !!place?.knownProcesses?.includes("electricity");
};
// ── Fertilizer ──────────────────────────────────────────────────────────────
function fertilizerTown(town) {
  return !!town && !town.ruined && !!town.knownProcesses?.includes("fertilizer");
}
const updateMuckMachineBase = updateMuck;
updateMuck = function () {
  updateMuckMachineBase();
  if (!W?.settlements || shipHasLeft()) return;
  for (const town of W.settlements)
    if (
      W.tick % MUCK_CADENCE === town.id % MUCK_CADENCE &&
      fertilizerTown(town) &&
      !muckExhausted(town)
    ) {
      if (muckTown(town)) MACHINE_FARM.muckTowns++;
      spreadFertilizer(town);
    }
};
// The stores' salts, spread on the poorest field tiles, are the nutrient the
// field lacks: a conserved packet of matter, relabelled by the works that made
// it a fertilizer.
function spreadFertilizer(town) {
  let salt = Math.min(FERTILIZER_SALT_PER_PASS, town.inventory[C.SALT] || 0);
  if (!salt) return 0;
  const tiles = muckFields(town)
    .filter((t) => W.tiles.chem[C.NUTRIENT][t] < FERTILIZER_TARGET * 10)
    .sort((a, b) => W.tiles.chem[C.NUTRIENT][a] - W.tiles.chem[C.NUTRIENT][b] || a - b);
  let spread = 0;
  for (const tile of tiles) {
    if (salt <= 0) break;
    const give = Math.min(salt, 6);
    town.inventory[C.SALT] -= give;
    giveTileMatter(tile, C.NUTRIENT, give);
    salt -= give;
    spread += give;
  }
  MACHINE_FARM.salt += spread;
  return spread;
}
// ── Railways run on steam ───────────────────────────────────────────────────
for (const tech of techCatalog())
  if (tech.id === "railways" && Array.isArray(tech.prior) && !tech.prior.includes("steam_power")) {
    const at = tech.prior.indexOf("mechanization");
    if (Object.isFrozen(tech.prior) || Object.isFrozen(tech)) break;
    if (at >= 0) tech.prior[at] = "steam_power";
    else tech.prior.push("steam_power");
  }
window.ALIFE_MACHINE_FARM_DEBUG = Object.freeze({
  counts: () => ({ ...MACHINE_FARM }),
  extra: (placeId) => machineFarmExtra(W.settlements.find((s) => s.id === placeId)),
  fertilize: (placeId) => spreadFertilizer(W.settlements.find((s) => s.id === placeId)),
  railwaysNeed: () =>
    techCatalog()
      .find((t) => t.id === "railways")
      ?.prior?.slice() || [],
});
