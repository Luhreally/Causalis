// ═══════════════════════════════════════════════════════════════════════════
// 149. LABOUR THRIFT — a town's work, looked up once
// ═══════════════════════════════════════════════════════════════════════════
// Asked for: a grown world that a slow phone can keep up with. Measured in
// the browser (scratchpad/phone-frames.cjs, the processor slowed four times
// by Chrome's emulation) phone causal-origin at year sixty-nine ran three
// ticks a second where the clock wants ten: the tick was the limit. The
// profile of six hundred of its ticks (perf-probe.cjs with PROFILE,
// prof-incl.py and prof-under.py) put 44 in a hundred of the tick under the
// civil labour of 30d, and most of that was the same answer asked by every
// worker in turn. Every person labours every tick while a town makes a
// concerted effort, and the effort never lapses (towns keep no water), so a
// town of a hundred and twenty asks each of these a hundred and twenty times
// a tick:
//
//   the town's plans (13 in a hundred of the tick): section 70 planned once a
//   tick, but only at the bottom of the chain, and the eleven sections that
//   wrap ensurePlacePlans after it (82 to 128) ran on every call;
//   the work orders (3): every order the world ever raised is kept, and each
//   worker filtered them all for its own town's;
//   the building an order is for, and a farm's field: a scan of every
//   building or field by id;
//   a field's footprint and baselines, rebuilt on every lookup of the field
//   though they change only when the farm is sown or moved;
//   who mends a damaged building (5): each worker sorted the whole town's
//   hands by distance to see whether it was the nearest;
//   who makes the town's tools (5): each worker scanned every living thing
//   twice a purpose for the claims on the town's tool orders.
//
// The orders, the buildings, the fields and the tool claims give the same
// answers as before and are exact. The plans are made once a town in sixteen
// ticks, so a plan that a worker's labour would have set off later
// in the same tick waits for the next; and the mender is found by asking
// only the hands nearer than the worker, so the rest are not weighed (their
// hunger read, 10's derivedLife) that tick. Both move the hash; the launch
// sweep of the round holds them.
const LABOUR_THRIFT = {
  plans: 0,
  plansKept: 0,
  mendChecks: 0,
  orderIndexes: 0,
  buildingIndexes: 0,
  fieldIndexes: 0,
  fieldsKept: 0,
  toolScans: 0,
};
// ── The plans, once a town in sixteen ticks ────────────────────────────────
// A town's plans are the buildings it means to raise; they change with its
// people, its crafts and its ground, over seasons and not ticks. Made once a
// tick they took 8 in a hundred of the tick; once in four, still 8 in a
// hundred of a grown world's leaner tick (the site searches of 30a's
// planBuilding); once in sixteen, a plan set off by a worker's labour or a
// craft learned waits fifteen ticks at most, a sixteenth of a month.
// The tick a place last planned is kept on the place, so a saved world plans
// when the world it was saved from would have (held in a map beside W, a
// loaded world planned every town at once and parted from its original in
// one tick).
const LABOUR_PLAN_EVERY = 16;
const ensurePlacePlansLabourBase = ensurePlacePlans;
ensurePlacePlans = function (place) {
  if (place && PERF_TICKING && W) {
    const last = place.labourPlannedTick;
    if (last !== undefined && last <= W.tick && W.tick - last < LABOUR_PLAN_EVERY) {
      LABOUR_THRIFT.plansKept++;
      return;
    }
    place.labourPlannedTick = W.tick;
  }
  LABOUR_THRIFT.plans++;
  return ensurePlacePlansLabourBase(place);
};
// ── Buildings and fields by id ──────────────────────────────────────────────
// Buildings are never taken out of the list (a fallen one is ruined, 105), and
// a field is dropped only by filtering the list anew (42d), so an index kept
// against the list, its length and the next id is never stale.
let BUILDING_INDEX = { list: null, length: -1, next: -1, map: null };
function buildingById(id) {
  const list = W.buildings;
  let ix = BUILDING_INDEX;
  if (ix.list !== list || ix.length !== list.length || ix.next !== W.nextBuildingId) {
    const map = new Map();
    for (const b of list) if (!map.has(b.id)) map.set(b.id, b);
    ix = BUILDING_INDEX = { list, length: list.length, next: W.nextBuildingId, map };
    LABOUR_THRIFT.buildingIndexes++;
  }
  const b = ix.map.get(id);
  return b && b.id === id ? b : undefined;
}
let FIELD_INDEX = { list: null, length: -1, next: -1, map: null };
function fieldByBuildingId(buildingId) {
  const list = W.fields || [];
  let ix = FIELD_INDEX;
  if (ix.list !== list || ix.length !== list.length || ix.next !== W.nextFieldId) {
    const map = new Map();
    for (const f of list) if (!map.has(f.buildingId)) map.set(f.buildingId, f);
    ix = FIELD_INDEX = { list, length: list.length, next: W.nextFieldId, map };
    LABOUR_THRIFT.fieldIndexes++;
  }
  const f = ix.map.get(buildingId);
  return f && f.buildingId === buildingId ? f : undefined;
}
// A field's footprint and baselines are rebuilt from themselves on every
// lookup (42d); they are kept while the farm stands where it stood and the
// sowing has not laid new baselines (a new array), which is when the rebuild
// would give back the same values.
const FIELD_SHAPE = new WeakMap();
const cultivatedFieldLabourBase = cultivatedField;
cultivatedField = function (building) {
  if (building && building.type === "farm" && building.complete && !building.ruined && W?.fields) {
    initializeAgricultureHerding();
    const field = fieldByBuildingId(building.id),
      shape = field && FIELD_SHAPE.get(field);
    if (
      shape &&
      shape.x === building.x &&
      shape.y === building.y &&
      shape.tiles === field.tiles &&
      shape.baselines === field.baselines &&
      field.tile === idx(building.x, building.y)
    ) {
      LABOUR_THRIFT.fieldsKept++;
      return field;
    }
  }
  const out = cultivatedFieldLabourBase(building);
  if (
    out &&
    building &&
    out.baselines?.every((b) => b.organic != null && b.energy != null && b.plantOrder != null)
  )
    FIELD_SHAPE.set(out, {
      x: building.x,
      y: building.y,
      tiles: out.tiles,
      baselines: out.baselines,
    });
  return out;
};
// ── The work orders of one town ─────────────────────────────────────────────
// Orders are only ever appended (30a, 30c), and moved from a camp to its town
// when the town is founded (30a's createSettlement), when the index is laid
// again. Each town's list keeps the world list's order, and the status and
// the town are read again at every call.
let ORDER_INDEX = { list: null, seen: 0, byPlace: new Map() };
function placeWorkOrders(kind, placeId) {
  const list = W.workOrders;
  let ix = ORDER_INDEX;
  if (ix.list !== list || ix.seen > list.length) {
    ix = ORDER_INDEX = { list, seen: 0, byPlace: new Map() };
    LABOUR_THRIFT.orderIndexes++;
  }
  for (; ix.seen < list.length; ix.seen++) {
    const o = list[ix.seen],
      key = `${o.placeKind}:${o.placeId}`;
    let at = ix.byPlace.get(key);
    if (!at) ix.byPlace.set(key, (at = []));
    at.push(o);
  }
  return ix.byPlace.get(`${kind}:${placeId}`) || [];
}
const createSettlementLabourBase = createSettlement;
createSettlement = function (...args) {
  const out = createSettlementLabourBase(...args);
  ORDER_INDEX = { list: null, seen: 0, byPlace: new Map() };
  return out;
};
function selectWorkOrder(id, place) {
  const kind = place.knownProcesses ? "settlement" : "camp",
    orders = placeWorkOrders(kind, place.id)
      .filter(
        (o) =>
          o.status === "open" &&
          o.placeKind === kind &&
          o.placeId === place.id &&
          !(o.blockedUntil > W.tick),
      )
      .map((o) => ({ o, score: orderPriority(o, place, id) }))
      .sort((a, b) => b.score - a.score || a.o.id - b.o.id);
  return orders[0]?.o || null;
}
// ── Who mends a damaged building ────────────────────────────────────────────
// The nearest fit hand does (30d sorts the town's hands by distance for every
// worker to see whether it is the one). The same answer is found by weighing
// only the hands nearer than this worker, or as near with a lower id, and
// stopping at the first fit one; only the nearest goes on to 30d, which finds
// itself first and mends.
const performBuildingMaintenanceLabourBase = performBuildingMaintenance;
performBuildingMaintenance = function (id, place) {
  const b = damagedPlaceBuildings(place)[0];
  if (!b) return false;
  LABOUR_THRIFT.mendChecks++;
  const fit = (pid) => {
      const l = derivedLife(pid);
      return l.hunger < 70 && l.thirst < 72 && l.fatigue < 90;
    },
    workers = localPlaceWorkers(place);
  if (!workers.includes(id) || !fit(id)) return false;
  const p = W.components.position[id],
    mine = dist2(p.x, p.y, b.x, b.y);
  for (const pid of workers) {
    if (pid === id) continue;
    const q = W.components.position[pid],
      d = dist2(q.x, q.y, b.x, b.y);
    if ((d < mine || (d === mine && pid < id)) && fit(pid)) return false;
  }
  return performBuildingMaintenanceLabourBase(id, place);
};
// ── Who makes the town's tools ──────────────────────────────────────────────
// The same rule as 30c: one scan of the living for the town's claimants (the
// work state is made for each as before), filtered by purpose as each is asked.
function placeToolOrderForWorker(id, place) {
  const workers = localPlaceWorkers(place),
    kind = placeKindKey(place);
  if (!workers.includes(id)) return "";
  let pool = null;
  const claims = (purpose) => {
    if (!pool) {
      LABOUR_THRIFT.toolScans++;
      pool = W.activeIds
        .filter(
          (pid) =>
            W.kind[pid] === KINDS.PERSON &&
            classifyAlive(pid) &&
            workState(pid).toolOrderPlaceKind === kind &&
            workState(pid).toolOrderPlaceId === place.id,
        )
        .sort((a, b) => a - b);
    }
    return pool.filter((pid) => {
      const state = workState(pid);
      return (
        state.toolOrderPurpose === purpose &&
        state.toolOrderPlaceKind === kind &&
        state.toolOrderPlaceId === place.id
      );
    });
  };
  for (const purpose of ["cut", "mine"])
    if (functionalToolsAtPlace(place, purpose).length)
      for (const pid of claims(purpose)) {
        const state = workState(pid);
        state.toolOrderPurpose = "";
        state.toolOrderRecipe = null;
        state.toolOrderPlaceKind = "";
        state.toolOrderPlaceId = 0;
      }
  for (const purpose of ["cut", "mine"]) {
    if (functionalToolsAtPlace(place, purpose).length) continue;
    const claimant = claims(purpose)[0];
    if (claimant) return claimant === id ? purpose : "";
    const available = workers.find((pid) => !workState(pid).toolOrderPurpose);
    if (available === id) {
      const w = workState(id),
        a = makeArchitectureGenome(place);
      w.toolOrderPurpose = purpose;
      w.toolOrderRecipe = { purpose, head: a.rigid, binding: a.flexible };
      w.toolOrderPlaceKind = kind;
      w.toolOrderPlaceId = place.id;
      return purpose;
    }
    if (available) return "";
  }
  return "";
}
// ── A predator near the work ────────────────────────────────────────────────
// Every worker asks every tick whether a predator is at hand (30c), a search of
// seven tiles round it. Where no predator lives there is none at hand: the
// living predators are counted once while the list of the living and the next
// id stand as they were (a predator is only ever born into a new id, and a
// death leaves the count too high, which only means the search is made).
let PREDATOR_CENSUS = { list: null, length: -1, next: -1, count: 0 };
function livingPredatorCount() {
  const list = W.activeIds;
  let c = PREDATOR_CENSUS;
  if (c.list !== list || c.length !== list.length || c.next !== W.nextEntityId) {
    let count = 0;
    for (const id of list) if (W.kind[id] === KINDS.PREDATOR && classifyAlive(id)) count++;
    c = PREDATOR_CENSUS = { list, length: list.length, next: W.nextEntityId, count };
  }
  return c.count;
}
const laborPredatorThreatLabourBase = laborPredatorThreat;
laborPredatorThreat = function (id, radius = 7) {
  if (W && !livingPredatorCount()) return 0;
  return laborPredatorThreatLabourBase(id, radius);
};
window.ALIFE_LABOUR_THRIFT_DEBUG = Object.freeze({
  counts: () => ({ ...LABOUR_THRIFT }),
  building: (id) => buildingById(id) || null,
  field: (buildingId) => fieldByBuildingId(buildingId) || null,
  orders: (kind, placeId) => placeWorkOrders(kind, placeId).length,
  predators: () => livingPredatorCount(),
});
