// Why is a town with a stocked store hungry behind the ship?
//
// The transit probe read Flintholl on battery causal-origin at fifty-five to
// a hundred per cent hungry for twenty years with ninety to two hundred bread
// in its store, nine fields, and seven or eight of them fallow. The daily
// draw (30e, and 133 behind the ship) hands each resident up to the ration,
// filling the gut to twenty-four, down to the seed reserve; the seed reserve
// is at most two fallow fields' tiles. Something between the store and the
// mouths is shut. This generates the seed, presses to the ship, steps the
// press to the year asked for, and reads the hungriest town's members one by
// one: hunger, energy, the gut's organic, distance to the hall against the
// reach, whether the granary counts them a resident, campaign, work task, and
// the town's store, reserve, ration cap and outlook; then it steps a day
// (thirty-two ticks) and reads what the two draws handed out.
//
// node scripts/hungry-town-probe.cjs <seed:size:complexity> <year> [town]
const { loadRuntime } = require("./runtime-probe.cjs");
const rt = loadRuntime(),
  source = process.argv[2] || "causal-origin:battery:lean",
  target = Number(process.argv[3] || 90),
  townName = process.argv[4] || "";
const year = rt.get("TICKS_PER_YEAR");
const [seed, size = "battery", complexity = "lean"] = source.split(":");
rt.game.createTestWorld({ seed, size, complexity });
const tick = rt.get("simTick");
for (let i = 0; i < year * 30; i++) tick();
for (let press = 1; press <= 40; press++) {
  const row = JSON.parse(
    rt.get(
      `(() => { const r = runCausalSkipForDebug(); return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR), stop: r.stopReason, ships: (W.ascensions || []).length }); })()`,
    ),
  );
  console.log(JSON.stringify({ press, ...row }));
  if (row.ships || row.year >= target) break;
}
rt.get(
  `(() => { for (let presses = 0; presses < 400 && Math.floor(W.tick / TICKS_PER_YEAR) < ${target}; presses++) { const state = makeCausalSkipState(); while (Math.floor(W.tick / TICKS_PER_YEAR) < ${target} && !state.done) causalSkipStep(state); } return 1; })()`,
);
const report = `(() => {
  const towns = W.settlements.filter((s) => !s.ruined && s.knownProcesses);
  let town = ${JSON.stringify(townName)} ? towns.find((s) => s.name.startsWith(${JSON.stringify(townName)})) : null;
  if (!town) town = towns.slice().sort((a, b) => hungryShare(b) - hungryShare(a))[0];
  if (!town) return JSON.stringify({ error: "no town" });
  const residents = new Set(granaryResidents(town)), reach = hearthReach(town);
  const members = W.activeIds.filter((id) => W.kind[id] === KINDS.PERSON && classifyAlive(id) && W.components.social[id]?.homePlaceKind === "settlement" && W.components.social[id].homePlaceId === town.id);
  const rows = members.map((id) => {
    const l = derivedLife(id), p = W.components.position[id], dig = W.components.inventory[id]?.digestive, ch = W.components.chemistry[id]?.q, w = W.components.work?.[id];
    const d = p ? Math.round(Math.sqrt(dist2(p.x, p.y, town.x, town.y))) : -1;
    return [id, "h" + Math.round(l.hunger), "energy" + Math.round(ch ? ch[C.ENERGY] : -1), "gut" + (dig ? dig[C.ORGANIC] : "?"), "d" + d + "/" + reach, residents.has(id) ? "resident" : "NOT-resident", W.components.campaign?.[id] ? "CAMPAIGN" : "", "age" + Math.round(l.age), "task=" + (w ? w.task : "-"), "beh=" + String(l.behaviorReason || l.behavior || "").slice(0, 40)].join(" ");
  });
  const o = foodOutlook(town);
  const before = { store: town.inventory[C.ORGANIC] || 0, seed: seedReserve(town), cap: rationCap(town), hungry: +o.hungry.toFixed(2), larder: Math.round(o.larder), lean: o.lean, famine: o.famine, pop: settlementPopulation(town), members: members.length, residents: residents.size, reach };
  const hearth0 = window.ALIFE_HEARTH_DEBUG.counts().drawn;
  const guts0 = Object.fromEntries(members.map((id) => [id, W.components.inventory[id]?.digestive?.[C.ORGANIC] || 0]));
  for (let i = 0; i < 32; i++) simTick();
  const gained = {}; for (const id of members) { const g = (W.components.inventory[id]?.digestive?.[C.ORGANIC] || 0) - guts0[id]; if (g) gained[id] = g; }
  const after = { store: town.inventory[C.ORGANIC] || 0, hearthDrawn: window.ALIFE_HEARTH_DEBUG.counts().drawn - hearth0, gutGained: gained };
  return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR), town: town.name, before, after, rows });
})()`;
const r = JSON.parse(rt.get(report));
console.log(
  JSON.stringify({ year: r.year, town: r.town, before: r.before, after: r.after, error: r.error }),
);
for (const row of r.rows || []) console.log("   " + row);
