// ═══════════════════════════════════════════════════════════════════════════
// 70. PERFORMANCE — the same world, fewer wasted steps
// ═══════════════════════════════════════════════════════════════════════════
// A profile of a standard world at its population cap showed most time going
// to repeated work rather than to new work: every worker re-planned its town's
// buildings every tick, a town with no clear ground for a building searched
// four hundred tiles against every building again each tick, the seasons
// recomputed the same hemisphere weight for the same tile, and each random draw
// built a small array to hash. This section removes that repetition without
// changing what the world does: plans are refreshed once per tick per place, a
// failed site search rests for a while, hemisphere weights are cached per tile,
// and the random stream hashes the same values without allocating. Rendering is
// untouched and nothing here writes the world except the small bookkeeping
// fields on places.
const SITE_BACKOFF = 96;
// ── Building plans once per tick, and no site search while none can succeed ──
// Memos live only inside a simulation tick; inspectors, tests, and debug calls
// between ticks always see fresh values.
let PERF_TICKING = false;
const simTickPerfBase = simTick;
simTick = function () {
  PERF_TICKING = true;
  try {
    return simTickPerfBase();
  } finally {
    PERF_TICKING = false;
  }
};
const ensurePlacePlansPerfBase = ensurePlacePlans;
ensurePlacePlans = function (place) {
  if (!place || (PERF_TICKING && place.plansTick === W?.tick)) return;
  ensurePlacePlansPerfBase(place);
  if (W) place.plansTick = W.tick;
};
const planBuildingPerfBase = planBuilding;
planBuilding = function (place, type, priority = 3) {
  if (!place || !W) return planBuildingPerfBase(place, type, priority);
  const backoff = place.siteBackoff || (place.siteBackoff = {});
  if ((backoff[type] || 0) > W.tick) return null;
  const planned = planBuildingPerfBase(place, type, priority);
  if (!planned) backoff[type] = W.tick + SITE_BACKOFF;
  else delete backoff[type];
  return planned;
};
// ── Hemisphere weights per tile ───────────────────────────────────────────────
let SEASON_HEMISPHERE_CACHE = { world: null, genome: null, values: null };
const seasonHemispherePerfBase = seasonHemisphere;
seasonHemisphere = function (x, y) {
  if (!W || !W.terrainGenome || !Number.isInteger(x) || !Number.isInteger(y) || !inside(x, y))
    return seasonHemispherePerfBase(x, y);
  let cache = SEASON_HEMISPHERE_CACHE;
  if (
    cache.world !== W ||
    cache.genome !== W.terrainGenome ||
    cache.values?.length !== W.tileCount
  ) {
    cache = SEASON_HEMISPHERE_CACHE = {
      world: W,
      genome: W.terrainGenome,
      values: new Float32Array(W.tileCount).fill(NaN),
    };
  }
  const i = y * W.width + x,
    cached = cache.values[i];
  if (cached === cached) return cached;
  return (cache.values[i] = seasonHemispherePerfBase(x, y));
};
// ── Random draws without an arguments array ────────────────────────────────────
// Bit-for-bit the same as hashParts(seedHash, tag, tick, id, purpose, attempt).
counterRand = function (tag, tick = 0, id = 0, purpose = 0, attempt = 0) {
  let h = 2166136261 >>> 0;
  h ^= hashPart(W ? W.seedHash : 0);
  h = Math.imul(h, 16777619);
  h ^= hashPart(tag);
  h = Math.imul(h, 16777619);
  h ^= hashPart(tick);
  h = Math.imul(h, 16777619);
  h ^= hashPart(id);
  h = Math.imul(h, 16777619);
  h ^= hashPart(purpose);
  h = Math.imul(h, 16777619);
  h ^= hashPart(attempt);
  h = Math.imul(h, 16777619);
  return mix32(h) / 4294967296;
};
// hashParts without a rest array; the same fold over the same parts.
hashParts = function () {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < arguments.length; i++) {
    h ^= hashPart(arguments[i]);
    h = Math.imul(h, 16777619);
  }
  return mix32(h);
};
// ── Per-tick memos for reads that many systems repeat within one tick ─────────
// Each memo lives for one tick of one world. Within a tick these answers can go
// stale by at most the tick's own changes, which is what every caller already
// tolerated between ticks.
let PERF_CACHE = { world: null, tick: -1, maps: Object.create(null) };
function perfMemo(name) {
  if (!PERF_TICKING) return null;
  if (PERF_CACHE.world !== W || PERF_CACHE.tick !== W.tick)
    PERF_CACHE = { world: W, tick: W.tick, maps: Object.create(null) };
  return PERF_CACHE.maps[name] || (PERF_CACHE.maps[name] = new Map());
}
const completedBuildingsPerfBase = completedBuildings;
completedBuildings = function (place, type = null) {
  if (!W || !place) return completedBuildingsPerfBase(place, type);
  const memo = perfMemo("completed");
  if (!memo) return completedBuildingsPerfBase(place, type);
  const key = `${place.knownProcesses ? "s" : "c"}${place.id}:${type || "*"}`;
  let out = memo.get(key);
  if (!out) memo.set(key, (out = completedBuildingsPerfBase(place, type)));
  return out.slice();
};
const settlementPopulationPerfBase = settlementPopulation;
settlementPopulation = function (s) {
  if (!W || !s?.id) return settlementPopulationPerfBase(s);
  const memo = perfMemo("population");
  if (!memo) return settlementPopulationPerfBase(s);
  const key = `${s.knownProcesses ? "s" : "c"}${s.id}`;
  let n = memo.get(key);
  if (n === undefined) memo.set(key, (n = settlementPopulationPerfBase(s)));
  return n;
};
const shelterProtectionAtPerfBase = shelterProtectionAt;
shelterProtectionAt = function (id, tile) {
  if (!W) return shelterProtectionAtPerfBase(id, tile);
  const memo = perfMemo("shelter");
  if (!memo) return shelterProtectionAtPerfBase(id, tile);
  const key = id * 4194304 + (tile | 0);
  let v = memo.get(key);
  if (v === undefined) memo.set(key, (v = shelterProtectionAtPerfBase(id, tile)));
  return v;
};
const organismHabitatStressPerfBase = organismHabitatStress;
organismHabitatStress = function (id, tile) {
  if (!W) return organismHabitatStressPerfBase(id, tile);
  const memo = perfMemo("habitat");
  if (!memo) return organismHabitatStressPerfBase(id, tile);
  const key = id * 4194304 + (tile | 0);
  let v = memo.get(key);
  if (v === undefined) memo.set(key, (v = organismHabitatStressPerfBase(id, tile)));
  return v;
};
const functionalToolsAtPlacePerfBase = functionalToolsAtPlace;
functionalToolsAtPlace = function (place, purpose) {
  if (!W || !place) return functionalToolsAtPlacePerfBase(place, purpose);
  const memo = perfMemo("tools");
  if (!memo) return functionalToolsAtPlacePerfBase(place, purpose);
  const key = `${place.knownProcesses ? "s" : "c"}${place.id}:${purpose}`;
  let out = memo.get(key);
  if (!out) memo.set(key, (out = functionalToolsAtPlacePerfBase(place, purpose)));
  return out.slice();
};
// Food on a tile, read once per tick per metabolism. Hungry people scan hundreds
// of tiles each, and the tiles of one town are scanned by everyone in it.
const FOOD_METABOLISMS = ["grazer", "omnivore", "predator"];
let FOOD_CACHE = { world: null, size: 0, values: null, stamps: null };
const tileFoodPerfBase = tileFood;
tileFood = function (i, metabolism = "grazer") {
  if (!PERF_TICKING || !W) return tileFoodPerfBase(i, metabolism);
  const m = FOOD_METABOLISMS.indexOf(metabolism);
  if (m < 0 || !(i >= 0 && i < W.tileCount)) return tileFoodPerfBase(i, metabolism);
  let cache = FOOD_CACHE;
  if (cache.world !== W || cache.size !== W.tileCount) {
    cache = FOOD_CACHE = {
      world: W,
      size: W.tileCount,
      values: new Float32Array(W.tileCount * 3),
      stamps: new Int32Array(W.tileCount * 3).fill(-1),
    };
  }
  const slot = m * W.tileCount + i;
  if (cache.stamps[slot] === W.tick) return cache.values[slot];
  const v = tileFoodPerfBase(i, metabolism);
  cache.values[slot] = v;
  cache.stamps[slot] = W.tick;
  return v;
};
// A building finished mid-tick is seen by the rest of that tick.
const completeBuildingPerfBase = completeBuilding;
completeBuilding = function (b) {
  const out = completeBuildingPerfBase(b);
  if (PERF_CACHE.maps.completed) PERF_CACHE.maps.completed.clear();
  return out;
};
window.ALIFE_PERF_DEBUG = Object.freeze({
  backoff: (settlementId) => ({
    ...(W.settlements.find((s) => s.id === settlementId)?.siteBackoff || {}),
  }),
  hemisphereCached: () =>
    SEASON_HEMISPHERE_CACHE.values
      ? SEASON_HEMISPHERE_CACHE.values.filter((v) => v === v).length
      : 0,
  time: (ticks = 100) => {
    const t0 = performance.now();
    for (let i = 0; i < ticks; i++) simTick();
    return (performance.now() - t0) / ticks;
  },
});
