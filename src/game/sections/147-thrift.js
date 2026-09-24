// ═══════════════════════════════════════════════════════════════════════════
// 147. THRIFT — the same answers, asked once
// ═══════════════════════════════════════════════════════════════════════════
// Worlds hold half again to twice the people they did (127), and a person
// costs the tick near enough one for one. The perf probe
// (scratchpad/perf-probe.cjs) grew phone causal-origin with the Causal skip
// to year sixty-nine, 194 people and 799 living things, and profiled a
// thousand ticks: 66 ms a tick on the desktop in Node, more than the frame
// the phone can give it at 1x. The heaviest single cost was the bonds of 53:
// every thirty-two ticks each grown person weighs every pair it knows well,
// and for each pair asked afresh who each of the two is most drawn to (a walk
// over all of their relationships), which town each stands in, which god
// each keeps and what each does best; rivalContest, sharedBeloved and
// topAttraction took 16 in a hundred of every tick between them. And the
// fields of 42d re-counted every field and herd to check two id counters on
// every lookup of a field, 1.8 in a hundred more.
//
// Both are asked once now, with the same answers. Within one pass of the
// bonds nothing writes a person's attractions, place, faith or skills, save
// what an event it emits sets off elsewhere, so the four readings are kept
// for the pass and dropped whenever the pass emits an event. The fields'
// counters are only ever advanced by the two places that make a field or a
// herd (42d), so once a world has been counted in full they are never behind
// its lists, and the count is skipped until a world is loaded or made. The
// world's hash over the grown phone world and a thousand ticks is the same
// with and without this section; that is the test of it.
const THRIFT = {
  bondPasses: 0,
  attraction: 0,
  town: 0,
  faith: 0,
  skill: 0,
  cleared: 0,
  fieldCounts: 0,
  fieldSkips: 0,
};
let BOND_PASS = null;
const updateBondsThriftBase = updateBonds;
updateBonds = function () {
  const outer = BOND_PASS;
  BOND_PASS = {
    world: W,
    tick: W?.tick,
    attraction: new Map(),
    town: new Map(),
    faith: new Map(),
    skill: new Map(),
  };
  THRIFT.bondPasses++;
  try {
    return updateBondsThriftBase();
  } finally {
    BOND_PASS = outer;
  }
};
function thriftBondPass() {
  return BOND_PASS && BOND_PASS.world === W && BOND_PASS.tick === W.tick ? BOND_PASS : null;
}
const emitEventThriftBase = emitEvent;
emitEvent = function (type, data) {
  const ev = emitEventThriftBase(type, data);
  const pass = thriftBondPass();
  if (pass) {
    pass.attraction.clear();
    pass.town.clear();
    pass.faith.clear();
    pass.skill.clear();
    THRIFT.cleared++;
  }
  return ev;
};
const topAttractionThriftBase = topAttraction;
topAttraction = function (id, minimum = 0.55) {
  const pass = thriftBondPass();
  if (!pass || minimum !== 0.55) return topAttractionThriftBase(id, minimum);
  let x = pass.attraction.get(id);
  if (x === undefined) {
    x = topAttractionThriftBase(id, minimum);
    pass.attraction.set(id, x);
  } else THRIFT.attraction++;
  return x;
};
const personTownNameThriftBase = personTownName;
personTownName = function (id) {
  const pass = thriftBondPass();
  if (!pass) return personTownNameThriftBase(id);
  let x = pass.town.get(id);
  if (x === undefined) {
    x = personTownNameThriftBase(id);
    pass.town.set(id, x);
  } else THRIFT.town++;
  return x;
};
const personFaithKeyThriftBase = personFaithKey;
personFaithKey = function (id) {
  const pass = thriftBondPass();
  if (!pass) return personFaithKeyThriftBase(id);
  let x = pass.faith.get(id);
  if (x === undefined) {
    x = personFaithKeyThriftBase(id);
    pass.faith.set(id, x);
  } else THRIFT.faith++;
  return x;
};
const topSkillThriftBase = topSkill;
topSkill = function (ident) {
  const pass = thriftBondPass();
  if (!pass || !ident) return topSkillThriftBase(ident);
  let x = pass.skill.get(ident);
  if (x === undefined) {
    x = topSkillThriftBase(ident);
    pass.skill.set(ident, x);
  } else THRIFT.skill++;
  return x;
};
// The fields' counters: counted in full once a world, then only when a world
// is loaded or made (restoreWorldDefaults and createWorld both count it).
let THRIFT_FIELDS_COUNTED = new WeakSet();
const initializeAgricultureHerdingThriftBase = initializeAgricultureHerding;
initializeAgricultureHerding = function (world = W) {
  if (!world) return null;
  if (
    THRIFT_FIELDS_COUNTED.has(world) &&
    Array.isArray(world.fields) &&
    Array.isArray(world.herds) &&
    Array.isArray(world.fluidSplatters) &&
    world.nextFieldId >= 1 &&
    world.nextHerdId >= 1
  ) {
    THRIFT.fieldSkips++;
    return world;
  }
  const out = initializeAgricultureHerdingThriftBase(world);
  THRIFT_FIELDS_COUNTED.add(world);
  THRIFT.fieldCounts++;
  return out;
};
const restoreWorldDefaultsThriftBase = restoreWorldDefaults;
restoreWorldDefaults = function () {
  if (W) THRIFT_FIELDS_COUNTED.delete(W);
  return restoreWorldDefaultsThriftBase();
};
window.ALIFE_THRIFT_DEBUG = Object.freeze({
  counts: () => ({ ...THRIFT }),
});
