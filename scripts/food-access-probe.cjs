// Why a town with plenty of food has hungry people in it.
//
// `settlementFood` adds stored matter, the forage on the five tiles around the
// centre, and fourteen a completed farm, then divides by the mouths. A town can
// therefore score well on farms it never harvests while its larder is empty and
// its people starve. This prints the score's parts beside what the people
// actually have, so the difference between potential and access is visible.
//
// node scripts/food-access-probe.cjs <seed> <size> <complexity> <presses>
const { loadRuntime } = require("./runtime-probe.cjs");
const rt = loadRuntime(),
  seed = process.argv[2] || "causal-origin",
  size = process.argv[3] || "battery",
  complexity = process.argv[4] || "lean",
  presses = Number(process.argv[5] || 18);
rt.game.createTestWorld({ seed, size, complexity });
const tick = rt.get("simTick"),
  year = rt.get("TICKS_PER_YEAR");
for (let i = 0; i < year * 30; i++) tick();

const report = `(() => {
  const towns = W.settlements.filter((s) => !s.ruined).map((s) => {
    const centre = idx(s.x, s.y);
    let forage = tileFood(centre, "omnivore");
    for (const n of neighbors4(centre)) forage += tileFood(n, "omnivore");
    const farms = completedBuildings(s, "farm").length,
      pop = settlementPopulation(s),
      stored = s.inventory[C.ORGANIC] || 0,
      energy = s.inventory[C.ENERGY] || 0,
      divisor = 1 + pop * 0.12,
      residents = granaryResidents(s);
    let hungry = 0, starving = 0, carrying = 0;
    for (const id of residents) {
      const l = W.components.life[id];
      if (l && l.hunger > 60) hungry++;
      if (l && l.hunger > 80) starving++;
      const inv = W.components.inventory[id]?.materials;
      if (inv && (inv[C.ORGANIC] || 0) > 0) carrying++;
    }
    return {
      name: s.name.slice(0, 11), pop, residents: residents.length,
      food: +settlementFood(s).toFixed(1),
      fromStored: +((stored * 0.35 + energy * 0.8) / divisor).toFixed(1),
      fromForage: +((forage * 0.6) / divisor).toFixed(1),
      fromFarms: +((farms * 14) / divisor).toFixed(1),
      farms, stored, energy,
      hungry: residents.length ? +(hungry / residents.length).toFixed(2) : 0,
      starving: residents.length ? +(starving / residents.length).toFixed(2) : 0,
      carrying,
    };
  });
  return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR),
    people: modernLivingPeople(), towns }, null, 1);
})()`;

for (let press = 1; press <= presses; press++) {
  rt.get(`(() => { runCausalSkipForDebug(); return "1"; })()`);
  if (press % 6 && press !== presses) continue;
  console.log(JSON.stringify({ press, ...JSON.parse(rt.get(report)) }));
}
