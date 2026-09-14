// Why do twenty hands on a stocked tower build nothing?
//
// On causal-origin phone at year fifty-six Lakeford held two tower blocks at
// stage two, "stocked", with nine to twenty-three workers assigned to each,
// and neither moved a stage in five years. Building itself is quick once a
// hand is at the face — a few dozen work a tick under the concerted effort —
// so the hands are not at the face. This runs to the press and reads, for
// every unfinished block at the launch site, each assigned hand's task, its
// phase, how far it stands from the site and how long it has been stuck, and
// whether the site's eight neighbours can be stood on at all.
//
// node scripts/hands-probe.cjs <seed> <size> <complexity> <quiet>
const { loadRuntime } = require("./runtime-probe.cjs");
const rt = loadRuntime(),
  seed = process.argv[2] || "causal-origin",
  size = process.argv[3] || "phone",
  complexity = process.argv[4] || "lean",
  quiet = Number(process.argv[5] || 16);
rt.game.createTestWorld({ seed, size, complexity });
const tick = rt.get("simTick"),
  year = rt.get("TICKS_PER_YEAR");
console.log(JSON.stringify({ seed, size, complexity, quiet }));
for (let i = 0; i < year * 30; i++) tick();
for (let press = 1; press <= quiet; press++) {
  const row = JSON.parse(rt.get(`(() => { const r = runCausalSkipForDebug(); return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR), people: modernLivingPeople(), stop: r.stopReason }); })()`));
  console.log(JSON.stringify({ press, ...row }));
}
// A year inside the skip so the hands are under the concerted effort, then read.
console.log(rt.get(`(() => {
  const state = makeCausalSkipState(), stop = W.tick + ${year};
  while (W.tick < stop && !state.done) causalSkipStep(state);
  const site = modernLaunchSite(), out = { year: Math.floor(W.tick / TICKS_PER_YEAR), site: site?.name, pop: site ? settlementPopulation(site) : 0, blocks: [] };
  if (!site) return JSON.stringify(out);
  const blocks = W.buildings.filter((b) => !b.ruined && !b.complete && b.placeKind === "settlement" && b.placeId === site.id && ["tower", "tenement", "factory", "office", "launch_tower"].includes(b.type));
  for (const b of blocks) {
    const hands = [];
    for (const id of W.activeIds) {
      if (W.kind[id] !== KINDS.PERSON) continue;
      const w = W.components.work?.[id];
      if (!w || w.buildingId !== b.id) continue;
      const p = W.components.position[id];
      hands.push({ id, task: w.task, phase: String(w.phase || "").slice(0, 46), d: +Math.sqrt(dist2(p.x, p.y, b.x, b.y)).toFixed(1),
        stuck: w.travelStuckTicks || 0, blockedFor: Math.max(0, (w.blockedUntil || 0) - W.tick), hunger: Math.round(W.components.life[id]?.hunger || 0) });
    }
    const probe = hands[0]?.id ?? W.activeIds.find((id) => W.kind[id] === KINDS.PERSON);
    const ring = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const x = b.x + dx, y = b.y + dy;
      ring.push(inside(x, y) ? (movementTileBlocked(probe, x, y) ? "X" : ".") : "#");
    }
    out.blocks.push({ id: b.id, type: b.type, at: [b.x, b.y], stage: b.stage, work: b.workDone + "/" + b.workRequired,
      missing: missingBuildingMaterial(b)?.needed || 0, ring: ring.join(""), hands: hands.length,
      phases: hands.reduce((m, h) => { const k = h.task + ": " + h.phase.replace(/[0-9]+/g, "n"); m[k] = (m[k] || 0) + 1; return m; }, {}),
      near: hands.filter((h) => h.d <= 1.5).length, stuck: hands.filter((h) => h.stuck >= 8 || h.blockedFor > 0).length,
      sample: hands.slice(0, 4) });
  }
  return JSON.stringify(out, null, 1);
})()`));
