// ═══════════════════════════════════════════════════════════════════════════
// 126. IRRIGATION — a field that has water carried to it does not dry out
// ═══════════════════════════════════════════════════════════════════════════
// A cultivated field grows by photosynthesis, which draws water from its own
// tiles, and nothing ever put any back but the rain. Knowing "irrigation" only
// made the field grow faster — that is, drink faster — so on the driest maps a
// town's fields died within a decade of being laid. Measured on battery
// causal-origin: Flinthollow's eight farms gave six to eight harvests a year
// while the ground under them read moisture 21, five points above the 16 that
// photosynthesis needs; by year 48 fifty-one of the seventy-two field tiles
// were dry, seven of eight fields sat fallow however often they were sown, and
// the town starved with a lake three tiles off. The same seed on a small map
// starts its fields at moisture 48 and reaches a starship.
//
// Irrigation is now what it says. A town that knows a water craft, whose
// farmers have tended a field this season, carries water from surface water
// within reach onto that field's dry tiles — a bucket a tile a pass, never below
// the water the source's own depth accounts for, so a lake is not drunk dry by
// a garden. The water moves; it is not made. Rain wrote depth and matter
// together and evaporation takes them together, but a bucket is matter alone,
// and the depth model is left to the hydrology that owns it.
// A channel reaches further than a bucket, and it draws a little from the whole
// shore rather than draining the tile nearest the field. Measured with a reach
// of seven and nearest-first draw on battery causal-origin: only three to five
// of eight fields had any water within reach at all, and the few lake tiles
// that were in reach were drawn down by nine hundred a year and refilled by
// rain at fifty, so the water within reach of the first field fell from nine
// and a half thousand to under five in fifteen years while the lake as a whole
// held a million and a half. Twelve tiles finds the shore for nearly every
// field, and a sip from each of many tiles stays under what rain gives back —
// for a while. Measured again with twelve on the same world, forty years on:
// ten fields drew two to five thousand a year, the shore within reach held
// four and a half thousand to spare at year thirty-nine and nothing from year
// fifty-nine, the ground under the fields fell from moisture thirty to twelve
// by year sixty-seven, harvests from fifteen a year to one, and the town
// starved with the lake still holding its million and a half. Rain refills a
// tile at about fifty a year, so a shore of a few dozen tiles cannot keep ten
// fields; a shore of a few hundred can. Twenty-four tiles reaches one.
const IRRIGATION_TICK = 32,
  IRRIGATION_TARGET = 26,
  IRRIGATION_BUCKET = 10,
  IRRIGATION_SIP = 2,
  IRRIGATION_REACH = 24,
  IRRIGATION = { passes: 0, fieldsWatered: 0, tilesWatered: 0, moved: 0, dryLeft: 0 };
// The water a field tile is short of the target, in the units the tile holds.
// `tileMoisture` reads (solvent - liquid * 0.55) / 9, so a target in moisture
// is a solvent figure once the tile's standing water is allowed for.
function irrigationDeficit(tile) {
  const want = IRRIGATION_TARGET * 9 + W.tiles.liquid[tile] * 0.55;
  return Math.max(0, Math.ceil(want - W.tiles.chem[C.SOLVENT][tile]));
}
// What a surface-water tile can spare: the matter above what its depth accounts
// for. A tile whose solvent has fallen to its depth has nothing to give.
function irrigationSpare(tile) {
  if (W.tiles.liquid[tile] <= WATER_DEPTH.SURFACE) return 0;
  return Math.max(0, W.tiles.chem[C.SOLVENT][tile] - W.tiles.liquid[tile]);
}
function irrigationSources(fieldTile) {
  const [fx, fy] = xy(fieldTile),
    out = [];
  for (let dy = -IRRIGATION_REACH; dy <= IRRIGATION_REACH; dy++)
    for (let dx = -IRRIGATION_REACH; dx <= IRRIGATION_REACH; dx++) {
      const x = fx + dx,
        y = fy + dy;
      if (!inside(x, y)) continue;
      const i = idx(x, y);
      if (irrigationSpare(i) > 0) out.push({ tile: i, d: dx * dx + dy * dy });
    }
  return out.sort((a, b) => a.d - b.d || a.tile - b.tile);
}
// Water one field. Returns the solvent moved.
function irrigateField(place, field) {
  const tiles = field.tiles?.length ? field.tiles : [field.tile],
    sources = irrigationSources(field.tile);
  if (!sources.length) return 0;
  let moved = 0,
    watered = 0;
  for (let k = 0; k < tiles.length; k++) {
    const tile = tiles[k];
    let need = Math.min(IRRIGATION_BUCKET, irrigationDeficit(tile));
    if (!need) continue;
    const wanted = need;
    // Round the shore: a sip from each source in turn, starting from a
    // different tile for each field tile, until the bucket is filled or a full
    // circuit finds nothing left to sip.
    let start = k % sources.length,
      circuit = 0;
    while (need > 0 && circuit < 4) {
      let took = 0;
      for (let n = 0; n < sources.length && need > 0; n++) {
        const src = sources[(start + n) % sources.length],
          give = Math.min(need, IRRIGATION_SIP, irrigationSpare(src.tile), 65535 - W.tiles.chem[C.SOLVENT][tile]);
        if (give <= 0) continue;
        W.tiles.chem[C.SOLVENT][src.tile] -= give;
        W.tiles.chem[C.SOLVENT][tile] += give;
        need -= give;
        moved += give;
        took += give;
      }
      if (!took) break;
      circuit++;
    }
    if (need < wanted) watered++;
    else IRRIGATION.dryLeft++;
  }
  if (watered) IRRIGATION.fieldsWatered++;
  IRRIGATION.tilesWatered += watered;
  IRRIGATION.moved += moved;
  return moved;
}
// Which towns may irrigate: those that know a water craft. The same list 86
// uses to quicken growth, so the craft that makes a field drink faster is the
// craft that lets its people carry water to it.
function placeIrrigates(place) {
  return !!place?.knownProcesses && typeof harvestTechCount === "function" && harvestTechCount(place) > 0;
}
function irrigationPass() {
  IRRIGATION.passes++;
  for (const building of W.buildings) {
    if (building.type !== "farm" || !building.complete || building.ruined) continue;
    const place = buildingPlace(building);
    if (!placeIrrigates(place)) continue;
    const field = cultivatedField(building);
    if (!field) continue;
    // The farmer's act, not the field's: a field nobody has tended this season
    // is not watered either.
    if (typeof fieldTended === "function" && !fieldTended(field)) continue;
    irrigateField(place, field);
  }
}
const updateCultivatedFieldsIrrigationBase = updateCultivatedFields;
updateCultivatedFields = function () {
  if (W.tick % IRRIGATION_TICK === 0) irrigationPass();
  return updateCultivatedFieldsIrrigationBase();
};
window.ALIFE_IRRIGATION_DEBUG = Object.freeze({
  counts: () => ({ ...IRRIGATION }),
  reset: () => {
    for (const k of Object.keys(IRRIGATION)) IRRIGATION[k] = 0;
  },
  pass: () => irrigationPass(),
  deficit: (x, y) => irrigationDeficit(idx(x, y)),
  spare: (x, y) => irrigationSpare(idx(x, y)),
  irrigates: (placeId) => placeIrrigates(W.settlements.find((s) => s.id === placeId)),
  // A town's fields, each with its dry tile count and the water within reach.
  fields: (placeId) =>
    W.buildings
      .filter((b) => b.type === "farm" && b.complete && !b.ruined && b.placeKind === "settlement" && b.placeId === placeId)
      .map((b) => {
        const f = cultivatedField(b),
          tiles = f?.tiles?.length ? f.tiles : f ? [f.tile] : [];
        return {
          building: b.id,
          stage: f?.stage || null,
          tended: f && typeof fieldTended === "function" ? fieldTended(f) : null,
          dry: tiles.filter((t) => tileMoisture(t) <= 16).length,
          tiles: tiles.length,
          sources: f ? irrigationSources(f.tile).length : 0,
        };
      }),
});
