// ═══════════════════════════════════════════════════════════════════════════
// 134. MUCK — behind the ship, the town's ground goes back to the fields
// ═══════════════════════════════════════════════════════════════════════════
// Farming carries the soil's nutrient off the field in the crop, into the
// granary, through the people, and out again where they stand: on the streets
// and in the blocks, where the waste mineralises into nutrient that nothing
// harvests. Measured on battery causal-origin at year thirty, a field tile held
// six hundred and sixty nutrient and the town's ground about the same; at year
// a hundred, behind the ship, Zephyrford's fields held two hundred and eighty
// a tile and its streets eight hundred and fifty, Stonespire's fields three
// hundred and sixty and its streets a thousand. Fertility is a tenth of the
// nutrient and a little else (07); plants grow only above ten (19); both towns'
// fields sat at ten or under, six farms fed thirty-five people nothing, and the
// towns starved with the goodness of their soil underfoot in the town.
//
// Every farming people that ever lived carried the muck back out. A town that
// knows agriculture and has finished fields returns, every sixteen ticks, some
// of the nutrient and waste of its own bare and built ground — never ground
// that still grows — to the field tiles whose fertility has fallen under
// thirty, poorest first, as much as its people can cart. It is a move of
// conserved matter from tile to tile through the two helpers of section 13.
//
// It runs only once a ship has left (132's shipHasLeft). Before the ship it
// was measured twice on the launch road and cost the ship both times, from
// living ground and from bare (HANDOFF §11): a richer field before year seventy
// grows the world faster than the effort can carry it. Behind the ship the
// fields are exhausted and nothing else renews them.
const MUCK_CADENCE = 16,
  MUCK_TARGET_FERTILITY = 30,
  MUCK_PER_HAND = 24,
  MUCK_CAP = 600,
  MUCK_SOURCE_FLOOR = 700,
  MUCK_BARE_ORDER = 40;
const MUCK = { moved: 0, passes: 0 };
function muckFields(town) {
  const tiles = [];
  for (const f of W.fields || [])
    if (f.placeKind === "settlement" && f.placeId === town.id)
      for (const t of f.tiles || [f.tile]) if (t != null) tiles.push(t);
  return tiles;
}
// The tiles of the town's own bare ground rich enough to draw from, richest first.
function muckSources(town, fieldTiles, reach) {
  const set = new Set(fieldTiles),
    out = [],
    r2 = reach * reach;
  for (let y = Math.max(0, town.y - reach); y <= Math.min(W.height - 1, town.y + reach); y++)
    for (let x = Math.max(0, town.x - reach); x <= Math.min(W.width - 1, town.x + reach); x++) {
      if (dist2(x, y, town.x, town.y) > r2) continue;
      const i = idx(x, y);
      if (set.has(i) || W.tiles.liquid[i] > WATER_DEPTH.SURFACE) continue;
      if (W.tiles.plantOrder[i] >= MUCK_BARE_ORDER) continue;
      if (W.tiles.chem[C.NUTRIENT][i] > MUCK_SOURCE_FLOOR) out.push(i);
    }
  out.sort((a, b) => W.tiles.chem[C.NUTRIENT][b] - W.tiles.chem[C.NUTRIENT][a] || a - b);
  return out;
}
function muckTown(town) {
  if (!town || town.ruined || !town.knownProcesses?.includes("agriculture")) return 0;
  const fields = muckFields(town);
  if (!fields.length) return 0;
  const poor = fields.filter((t) => tileFertility(t) < MUCK_TARGET_FERTILITY);
  if (!poor.length) return 0;
  const hands = typeof granaryResidents === "function" ? granaryResidents(town).length : 0;
  let budget = Math.min(MUCK_CAP, hands * MUCK_PER_HAND);
  if (budget <= 0) return 0;
  const reach = typeof hearthReach === "function" ? hearthReach(town) : 8,
    sources = muckSources(town, fields, reach);
  if (!sources.length) return 0;
  poor.sort((a, b) => tileFertility(a) - tileFertility(b) || a - b);
  let moved = 0,
    s = 0;
  for (const field of poor) {
    if (budget <= 0 || s >= sources.length) break;
    // Enough to lift this field to the target, in nutrient, drawn from the richest tiles.
    const want = Math.min(budget, Math.max(1, Math.ceil(((MUCK_TARGET_FERTILITY - tileFertility(field)) * 10) / 0.48)));
    let got = 0;
    while (got < want && s < sources.length) {
      const src = sources[s],
        spare = W.tiles.chem[C.NUTRIENT][src] - MUCK_SOURCE_FLOOR;
      if (spare <= 0) {
        s++;
        continue;
      }
      const taken = takeTileMatter(src, C.NUTRIENT, Math.min(spare, want - got));
      if (!taken) {
        s++;
        continue;
      }
      const given = giveTileMatter(field, C.NUTRIENT, taken);
      if (given < taken) giveTileMatter(src, C.NUTRIENT, taken - given);
      got += given;
      if (given < taken) break;
    }
    // The waste that lies in the streets goes out with it and mineralises in the field.
    if (got && got < budget && s < sources.length) {
      const src = sources[s],
        waste = W.tiles.chem[C.WASTE][src];
      if (waste > 40) {
        const taken = takeTileMatter(src, C.WASTE, Math.min(waste - 40, 8, budget - got)),
          given = taken ? giveTileMatter(field, C.WASTE, taken) : 0;
        if (given < taken) giveTileMatter(src, C.WASTE, taken - given);
        got += given;
      }
    }
    budget -= got;
    moved += got;
  }
  if (moved) {
    MUCK.moved += moved;
    MUCK.passes++;
  }
  return moved;
}
// For an A/B before the ship: a town whose fields average under this fertility
// carts muck before any ship has left (nought, the shipped value, never does).
// The food-balance probe sets it with MUCKFERT=15.
let MUCK_POOR_FIELDS = 0;
function muckExhausted(town) {
  if (!(MUCK_POOR_FIELDS > 0) || !town || town.ruined || !town.knownProcesses) return false;
  const tiles = muckFields(town);
  if (!tiles.length) return false;
  let sum = 0;
  for (const t of tiles) sum += tileFertility(t);
  return sum / tiles.length < MUCK_POOR_FIELDS;
}
function updateMuck() {
  if (!W?.settlements) return;
  const behind = shipHasLeft();
  for (const town of W.settlements)
    if (W.tick % MUCK_CADENCE === town.id % MUCK_CADENCE && (behind || muckExhausted(town))) muckTown(town);
}
tickSystem("muck", function () {
  updateMuck();
});
window.ALIFE_MUCK_DEBUG = Object.freeze({
  counts: () => ({ ...MUCK }),
  poorFields: (n) => (n === undefined ? MUCK_POOR_FIELDS : (MUCK_POOR_FIELDS = n)),
  exhausted: (townId) => muckExhausted(W.settlements.find((s) => s.id === townId)),
  run: (townId) => muckTown(W.settlements.find((s) => s.id === townId)),
  pass: () => updateMuck(),
  fields: (townId) => {
    const town = W.settlements.find((s) => s.id === townId),
      tiles = town ? muckFields(town) : [];
    return tiles.map((t) => ({ tile: t, nutrient: W.tiles.chem[C.NUTRIENT][t], waste: W.tiles.chem[C.WASTE][t], fertility: +tileFertility(t).toFixed(1) }));
  },
});
