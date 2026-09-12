// Why does a starving town not walk to the fed one?
//
// Mosshollow sits between sixty and eighty in a hundred hungry for forty years,
// dying of chemical energy depletion, while Willowwatch a short way off holds a
// food score near eight hundred with nobody hungry at all. Making a store feed
// relative to its mouths drained the false comfort out of Mosshollow's granary
// and changed nothing: its people still do not go. Something between the two
// towns refuses the call, and `granaryCallPlace` returns null without saying
// which of its clauses did it.
//
// This runs to the window and interrogates the call for real hungry people:
// where they are, what is underfoot, which places would feed them, which are
// friendly, how far, and what the call finally answers.
//
// node scripts/hunger-call-probe.cjs <seed> <size> <complexity> <presses>
const { loadRuntime } = require("./runtime-probe.cjs");
const rt = loadRuntime(),
  seed = process.argv[2] || "causal-origin",
  size = process.argv[3] || "small",
  complexity = process.argv[4] || "lean",
  presses = Number(process.argv[5] || 12);
rt.game.createTestWorld({ seed, size, complexity });
const tick = rt.get("simTick"),
  year = rt.get("TICKS_PER_YEAR");
console.log(JSON.stringify({ seed, size, complexity, presses }));
for (let i = 0; i < year * 30; i++) tick();
for (let press = 1; press <= presses; press++) rt.get(`(() => { runCausalSkipForDebug(); return "1"; })()`);

const report = `(() => {
  const g = window.ALIFE_GRANARY_CALL_DEBUG,
    towns = W.settlements.filter((s) => !s.ruined);
  const places = towns.map((s) => {
    const f = g.feeds(s.id);
    return { id: s.id, name: s.name.slice(0, 11), x: s.x, y: s.y,
      faction: s.factionId || 0, pop: settlementPopulation(s),
      food: +settlementFood(s).toFixed(0), ...f };
  });
  // The hungriest people in the world, and what the call says for each.
  const hungry = [];
  for (const id of W.activeIds) {
    if (W.kind[id] !== KINDS.PERSON || !classifyAlive(id)) continue;
    const l = W.components.life[id];
    if (!l || l.hunger < 52) continue;
    hungry.push({ id, hunger: Math.round(l.hunger) });
  }
  hungry.sort((a, b) => b.hunger - a.hunger);
  const sample = hungry.slice(0, 6).map((h) => {
    const p = W.components.position[h.id],
      social = W.components.social[h.id],
      home = nearestFriendlyPlace(h.id),
      answer = g.place(h.id),
      ground = +tileFood(idx(p.x, p.y), "omnivore").toFixed(1);
    // Each town measured against this person: would it feed them, is it
    // friendly, and how far is the walk.
    const options = towns.map((s) => ({
      name: s.name.slice(0, 9),
      feeds: g.feeds(s.id).feeds,
      sameFaction: !(social?.factionId && s.factionId && s.factionId !== social.factionId),
      hostile: typeof personIsHostileVisitor === "function" ? !!personIsHostileVisitor(h.id, s.factionId) : false,
      d: +Math.sqrt(dist2(p.x, p.y, s.x, s.y)).toFixed(1),
    }));
    return { hunger: h.hunger, ground, faction: social?.factionId || 0,
      homePlace: home ? home.name.slice(0, 11) : null,
      answer: answer ? (towns.find((s) => s.id === answer) || {}).name?.slice(0, 11) || answer : null,
      reachable: options.filter((o) => o.feeds && o.sameFaction && !o.hostile && o.d > 8 && o.d <= 48).map((o) => o.name + "@" + o.d),
      fedTowns: options.filter((o) => o.feeds).map((o) => o.name + "@" + o.d + (o.sameFaction ? "" : " OTHERFLAG") + (o.hostile ? " HOSTILE" : "")),
    };
  });
  return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR),
    people: modernLivingPeople(), hungryCount: hungry.length,
    calls: g.counts(), places, sample }, null, 1);
})()`;

console.log(rt.get(report));
