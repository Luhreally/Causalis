// Why do the hungry of a famine town not eat from a full store?
//
// Inside the transit press the effort's bread arrives and the stores of the
// famine towns stand at three hundred while two in three of their people are
// hungry and nobody works the stocked field. This steps the press behind the
// ship and, every sixteen ticks for a few years, reads the residents of the
// famine towns by hunger band: what each is doing (assigned task or instinct),
// whether the labour pool handled them this tick, whether a ration at home is
// within their reach, and how far they stand from the hall — and counts the
// calls to performFeeding for them, and the ration meals that came of it.
//
// node scripts/famine-probe.cjs <fixture.json.gz> <years> <presses>
const fs = require("node:fs");
const zlib = require("node:zlib");
const { loadRuntime } = require("./runtime-probe.cjs");
const rt = loadRuntime(),
  source = process.argv[2] || "tests/fixtures/launch-battery.json.gz",
  years = Number(process.argv[3] || 3),
  presses = Number(process.argv[4] ?? 8);
const year = rt.get("TICKS_PER_YEAR");
// A seed spec "seed:size:complexity" generates the world instead of loading a
// fixture; YEAR=<n> steps the press to that year before reading (OFF=... as
// the transit probe: field,draw,cradle,match,roomhunger,reach2,reunite,quota).
const off = new Set((process.env.OFF || "").split(",").filter(Boolean)), targetYear = Number(process.env.YEAR || 0);
if (off.has("field")) rt.get("(() => { fieldSupplyAll = () => 0; fieldHandsFit = () => null; return 1; })()");
if (off.has("draw")) rt.get("(() => { hearthDraw = () => 0; return 1; })()");
if (off.has("cradle")) rt.get("(() => { cradleCourtship = () => 0; cradleRoom = () => null; return 1; })()");
if (off.has("match")) rt.get("(() => { cradleMatch = () => false; return 1; })()");
if (off.has("roomhunger")) rt.get("(() => { cradleFed = (outlook, hungry) => !!outlook && outlook.larder >= 10 && hungry <= 0.25; return 1; })()");
if (off.has("reach2")) rt.get("(() => { cradleNightReach = () => 8; return 1; })()");
if (off.has("reunite")) rt.get("(() => { cradleReunite = () => 0; return 1; })()");
if (off.has("quota")) rt.get("(() => { hearthMealQuotaLeft = () => 65535; return 1; })()");
(async () => {
  if (/\.gz$/.test(source)) {
    rt.sandbox.localStorage.setItem("causalis.save.launch", zlib.gunzipSync(fs.readFileSync(source)).toString("utf8"));
    if (!(await rt.sandbox.window.ALIFE_SAVE_DEBUG.load("launch"))) throw new Error("fixture did not load");
  } else {
    const [seed, size = "battery", complexity = "lean"] = source.split(":");
    rt.game.createTestWorld({ seed, size, complexity });
    const tick = rt.get("simTick");
    for (let i = 0; i < year * 30; i++) tick();
    console.log(JSON.stringify({ seed, size, complexity, off: [...off], targetYear }));
  }
  for (let press = 1; press <= presses; press++) {
    const row = JSON.parse(rt.get(`(() => { const r = runCausalSkipForDebug(); return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR), stop: r.stopReason, ships: (W.ascensions || []).length }); })()`));
    console.log(JSON.stringify({ press, ...row }));
    if (row.ships) break;
  }
  if (targetYear > 0) rt.get(`(() => { for (let presses = 0; presses < 400 && Math.floor(W.tick / TICKS_PER_YEAR) < ${targetYear}; presses++) { const state = makeCausalSkipState(); while (Math.floor(W.tick / TICKS_PER_YEAR) < ${targetYear} && !state.done) causalSkipStep(state); } return 1; })()`);
  rt.get(`(() => {
    globalThis.__feed = {};
    const f = performFeeding; performFeeding = function (id, tile, stride = 1) { const out = f(id, tile, stride); if (W.kind[id] === KINDS.PERSON) { const soc = W.components.social[id], k = W.settlements.find((s) => s.id === soc?.homePlaceId)?.name?.slice(0, 8) || "?"; const e = globalThis.__feed[k] || (globalThis.__feed[k] = { calls: 0, ate: 0, rations: 0 }); e.calls++; if (out) e.ate++; if (/rations at home/.test(W.components.life[id]?.behaviorReason || "")) e.rations++; } return out; };
    return 1; })()`);
  const aYear = `(() => {
    const state = globalThis.__state || (globalThis.__state = makeCausalSkipState());
    globalThis.__feed = {};
    const stop = W.tick + ${year}, towns = {}, homeMeals0 = window.ALIFE_HEARTH_DEBUG.counts().homeMeals;
    while (W.tick < stop && !state.done) {
      causalSkipStep(state);
      if (W.tick % 16) continue;
      for (const s of W.settlements) {
        if (s.ruined || !s.knownProcesses) continue;
        const o = foodOutlook(s);
        if (!(o?.famine || o?.lean)) continue;
        const t = towns[s.name.slice(0, 8)] || (towns[s.name.slice(0, 8)] = { samples: 0, hungry: 0, tasks: {}, handled: 0, rationInReach: 0, far: 0, night: 0, hungryTasks: {} });
        t.samples++;
        for (const id of W.activeIds) {
          if (W.kind[id] !== KINDS.PERSON || !classifyAlive(id)) continue;
          const soc = W.components.social[id];
          if (soc?.homePlaceId !== s.id) continue;
          const l = W.components.life[id], w = W.components.work?.[id], p = W.components.position[id];
          const task = (w && w.task !== "idle" && w.handledTick === W.tick) ? "work:" + w.task : "inst:" + (l.behavior || "-");
          t.tasks[task] = (t.tasks[task] || 0) + 1;
          if (l.hunger <= 70) continue;
          t.hungry++;
          t.hungryTasks[task] = (t.hungryTasks[task] || 0) + 1;
          if (w && w.handledTick === W.tick && w.task !== "idle") t.handled++;
          if (homeRationPlace(id)) t.rationInReach++;
          if (p && dist2(p.x, p.y, s.x, s.y) > 64) t.far++;
          if (p && typeof nightAt === "function" && nightAt(p.x, p.y)) t.night++;
        }
      }
    }
    if (state.done) globalThis.__state = makeCausalSkipState();
    const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => k + ":" + v).join(" ");
    const out = [];
    for (const [name, t] of Object.entries(towns)) out.push(name + " samples" + t.samples + " hungry-person-samples" + t.hungry + " handledByLabour" + t.handled + " rationInReach" + t.rationInReach + " far" + t.far + " night" + t.night + " | hungry doing: " + top(t.hungryTasks) + " | all doing: " + top(t.tasks));
    return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR), homeMeals: window.ALIFE_HEARTH_DEBUG.counts().homeMeals - homeMeals0, feed: globalThis.__feed, towns: out });
  })()`;
  for (let n = 0; n < years; n++) {
    const r = JSON.parse(rt.get(aYear));
    console.log(`y${r.year} homeMeals${r.homeMeals} feeding ${JSON.stringify(r.feed)}`);
    for (const t of r.towns) console.log("   " + t);
  }
})().catch((e) => { console.error(e); process.exit(1); });
