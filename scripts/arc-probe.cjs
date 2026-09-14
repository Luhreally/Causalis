// The arc past the ship: orbit, the stars, the colonies, and the epilogue.
//
// Every world measured launches now; nothing has watched what follows. This
// presses Causal skip from a year-30 world until a ship leaves and then keeps
// pressing, and reports each press: the civilisation stage, the ships away,
// the charted stars, every voyage with its star and arrival year, every colony
// with its status and what the galaxy has made of it, the shortfalls the
// orbital and interstellar stages name, the micro-stages still pending, the
// epilogue, and — because the world beneath must survive its own ascent — the
// people, the towns, the hungry share and the matter drift.
//
// node scripts/arc-probe.cjs <seed> <size> <complexity> <presses>
const { loadRuntime } = require("./runtime-probe.cjs");
const rt = loadRuntime(),
  seed = process.argv[2] || "causal-origin",
  size = process.argv[3] || "battery",
  complexity = process.argv[4] || "lean",
  presses = Number(process.argv[5] || 40);
rt.game.createTestWorld({ seed, size, complexity });
const tick = rt.get("simTick"),
  year = rt.get("TICKS_PER_YEAR");
console.log(JSON.stringify({ seed, size, complexity, presses }));
for (let i = 0; i < year * 30; i++) tick();

const press = `(() => {
  const r = runCausalSkipForDebug();
  const towns = W.settlements.filter((s) => !s.ruined && s.knownProcesses);
  let hungry = 0, people = 0;
  for (const s of towns) { const pop = settlementPopulation(s); people += pop; if (typeof hungryShare === "function") hungry += hungryShare(s) * pop; }
  const stages = typeof causalSkipMicroStages === "function" ? causalSkipMicroStages().filter((s) => !s.done()).map((s) => s.key) : [];
  const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o && o[k] !== undefined).map((k) => [k, o[k]]));
  return JSON.stringify({
    year: Math.floor(W.tick / TICKS_PER_YEAR), stop: r.stopReason, milestone: r.milestone?.label || "",
    stage: W.civilization?.stage || null, stageIndex: W.civilization?.stageIndex,
    people: biospherePopulation(KINDS.PERSON), townPeople: people, towns: towns.length,
    hungry: people ? +(hungry / people).toFixed(2) : 0, drift: auditMatter().delta,
    ships: (W.ascensions || []).length,
    stars: typeof chartedStars === "function" ? chartedStars().length : null,
    voyages: (W.voyages || []).map((v) => pick(v, ["id", "name", "status", "starName", "arriveTick", "fromSettlementId", "crew", "people"])),
    colonies: (W.colonies || []).map((c) => pick(c, ["id", "name", "status", "starName", "population", "pop", "cap", "foundedTick", "independent", "independentTick", "daughters", "shipments", "hardship", "research", "factionId", "parentId"])),
    colonyKeys: (W.colonies || [])[0] ? Object.keys(W.colonies[0]) : [],
    voyageKeys: (W.voyages || [])[0] ? Object.keys(W.voyages[0]) : [],
    orbital: typeof orbitalShortfall === "function" ? orbitalShortfall() : null,
    interstellar: typeof interstellarShortfall === "function" ? interstellarShortfall() : null,
    pending: stages,
    target: W.civilization?.concertedTarget ? W.civilization.concertedTarget.key + "#" + (W.civilization.concertedTarget.pushes || 0) : null,
    epilogue: typeof epilogueActive === "function" ? !!epilogueActive() : null,
    galaxy: W.galaxy ? Object.keys(W.galaxy) : null,
    ages: (W.ages || []).length,
  });
})()`;

let shipYear = null;
for (let n = 1; n <= presses; n++) {
  const row = JSON.parse(rt.get(press));
  if (row.ships && shipYear == null) shipYear = row.year;
  console.log(JSON.stringify({ press: n, ...row }));
  if (Math.abs(row.drift || 0) >= 64) {
    console.log(JSON.stringify({ halt: "matter drift", drift: row.drift }));
    break;
  }
  if (row.people < 4) break;
}
console.log(JSON.stringify({ shipYear }));
