// Why does the home world bear one child a year behind its ship?
//
// The transit probe read nought to three births a year on eighty people for
// forty years after the launch, against one to three deaths of old age; the
// famine only finished what the empty cradle began. This generates the seed,
// presses to the ship, steps the press to the year asked for, and then reads
// every living person against each gate of `canReproduce` in turn — alive and
// paired, cooldown, maturity, the fertile window, hunger under seventy,
// energy, health, the body's stores of organic, nutrient, water, information
// and membrane, and the room the cradle or the density rule allows — counting
// how many fall at each gate, and for the eligible, whether they have a
// partner, whether the partner is eligible and near, and how many couplings
// and conceptions the next year brings. The age pyramid is read too.
//
// node scripts/fertility-probe.cjs <seed:size:complexity> <year> [years]
const { loadRuntime } = require("./runtime-probe.cjs");
const rt = loadRuntime(),
  source = process.argv[2] || "causal-origin:battery:lean",
  target = Number(process.argv[3] || 80),
  years = Number(process.argv[4] || 3);
const year = rt.get("TICKS_PER_YEAR");
const [seed, size = "battery", complexity = "lean"] = source.split(":");
rt.game.createTestWorld({ seed, size, complexity });
const tick = rt.get("simTick");
for (let i = 0; i < year * 30; i++) tick();
for (let press = 1; press <= 40; press++) {
  const row = JSON.parse(rt.get(`(() => { const r = runCausalSkipForDebug(); return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR), stop: r.stopReason, ships: (W.ascensions || []).length }); })()`));
  console.log(JSON.stringify({ press, ...row }));
  if (row.ships || row.year >= target) break;
}
const gates = `(() => {
  const tally = {}, count = (k) => { tally[k] = (tally[k] || 0) + 1; };
  const gateOf = (id) => {
    const ch = W.components.chemistry[id], l = derivedLife(id), r = W.components.reproduction[id], body = W.components.body[id];
    if (!ch || !r || !body) return "no-parts";
    if (r.mode !== "paired") return "mode:" + r.mode;
    if (l.age <= (body.maturityAge ?? 1200)) return "child";
    if (l.age >= body.maxAge * PERSON_FERTILE_SHARE) return "past-fertile-window";
    if (r.cooldown > 0) return "cooldown";
    if (l.hunger >= CONCEPTION_HUNGER) return "hunger>=70";
    if (l.energy <= 22) return "energy<=22";
    if (l.health <= 48) return "health<=48";
    if (ch.q[C.ORGANIC] <= 34) return "organic<=34";
    if (ch.q[C.NUTRIENT] <= 16) return "nutrient<=16";
    if (ch.q[C.SOLVENT] <= 75) return "water<=75";
    if (ch.q[C.INFO] <= 16) return "info<=16";
    if (ch.q[C.MEMBRANE] <= 23) return "membrane<=23";
    if (!reproductionDensityAllows(id, KINDS.PERSON)) return "no-room";
    return "eligible";
  };
  const eligible = [], pyramid = {};
  for (const id of W.activeIds) {
    if (W.kind[id] !== KINDS.PERSON || !classifyAlive(id)) continue;
    const l = derivedLife(id), body = W.components.body[id];
    if (body) { const band = Math.floor(l.age / body.maxAge * 10) / 10; pyramid[band] = (pyramid[band] || 0) + 1; }
    const g = gateOf(id);
    count(g);
    if (g === "eligible") eligible.push(id);
  }
  // For the eligible: the partner's own gate, how far they stand, whether they share a home, and whether it is night there.
  const partners = { none: 0, partnerDead: 0, partnerIneligible: 0, partnerFar: 0, partnerEligibleNear: 0 }, partnerGates = {}, distances = {}, homes = { same: 0, different: 0 }, nights = { night: 0, day: 0 };
  for (const id of eligible) {
    const soc = W.components.social[id], p = W.components.position[id];
    if (!soc?.partnerId) { partners.none++; continue; }
    if (!classifyAlive(soc.partnerId)) { partners.partnerDead++; continue; }
    const pp = W.components.position[soc.partnerId], ps = W.components.social[soc.partnerId];
    const d = pp ? Math.sqrt(dist2(p.x, p.y, pp.x, pp.y)) : 99;
    const bucket = d <= 4 ? "<=4" : d <= 8 ? "<=8" : d <= 16 ? "<=16" : d <= 24 ? "<=24" : ">24";
    distances[bucket] = (distances[bucket] || 0) + 1;
    if (ps && ps.homePlaceKind === soc.homePlaceKind && ps.homePlaceId === soc.homePlaceId) homes.same++; else homes.different++;
    if (typeof nightAt === "function" && nightAt(p.x, p.y)) nights.night++; else nights.day++;
    if (!canReproduce(soc.partnerId)) { partners.partnerIneligible++; const g = gateOf(soc.partnerId); partnerGates[g] = (partnerGates[g] || 0) + 1; continue; }
    if (d > 8) { partners.partnerFar++; continue; }
    partners.partnerEligibleNear++;
  }
  const rooms = W.settlements.filter((s) => !s.ruined && s.knownProcesses).map((s) => { const r = window.ALIFE_CRADLE_DEBUG.room(s.id); return s.name.slice(0, 8) + ":" + (r ? r.people + "p/" + r.cap + " hungry" + r.hungry + " larder" + r.larder + (r.room ? " ROOM" : r.fed ? " full" : " unfed") : "-"); });
  return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR), people: biospherePopulation(KINDS.PERSON), tally, partners, partnerGates, distances, homes, nights, pyramid, rooms });
})()`;
const aYear = `(() => {
  const state = globalThis.__state || (globalThis.__state = makeCausalSkipState());
  const births0 = W.statistics.birthsByKind?.person || 0, couplings0 = W.living?.couplings || 0, cradle0 = window.ALIFE_CRADLE_DEBUG.counts();
  const stop = W.tick + ${year};
  while (W.tick < stop && !state.done) causalSkipStep(state);
  if (state.done) globalThis.__state = makeCausalSkipState();
  const cradle1 = window.ALIFE_CRADLE_DEBUG.counts();
  return JSON.stringify({ born: (W.statistics.birthsByKind?.person || 0) - births0, couplings: (W.living?.couplings || 0) - couplings0, courted: cradle1.courted - cradle0.courted, roomPasses: cradle1.roomPasses - cradle0.roomPasses, widowed: cradle1.widowed - cradle0.widowed });
})()`;
rt.get(`(() => { for (let presses = 0; presses < 400 && Math.floor(W.tick / TICKS_PER_YEAR) < ${target}; presses++) { const state = makeCausalSkipState(); while (Math.floor(W.tick / TICKS_PER_YEAR) < ${target} && !state.done) causalSkipStep(state); } return 1; })()`);
for (let n = 0; n < years; n++) {
  const g = JSON.parse(rt.get(gates));
  console.log(`y${g.year} people${g.people} gates${JSON.stringify(g.tally)} partners${JSON.stringify(g.partners)} partnerGates${JSON.stringify(g.partnerGates)} distances${JSON.stringify(g.distances)} homes${JSON.stringify(g.homes)} nights${JSON.stringify(g.nights)} pyramid${JSON.stringify(g.pyramid)}`);
  for (const r of g.rooms) console.log("   " + r);
  const y = JSON.parse(rt.get(aYear));
  console.log(`   next year: ${JSON.stringify(y)}`);
}
