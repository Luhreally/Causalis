// Where do the bellies of a town's adults sit? A histogram of hunger for the
// adults in the fertile window, on the post-ship fixture and on a fresh world.
const fs = require("node:fs"),
  zlib = require("node:zlib");
const { loadRuntime } = require("./runtime-probe.cjs");
const rt = loadRuntime(),
  source = process.argv[2] || "tests/fixtures/launch-battery.json.gz",
  years = Number(process.argv[3] || 6),
  presses = Number(process.argv[4] ?? 2);
const year = rt.get("TICKS_PER_YEAR");
(async () => {
  if (fs.existsSync(source)) {
    rt.sandbox.localStorage.setItem(
      "causalis.save.launch",
      zlib.gunzipSync(fs.readFileSync(source)).toString("utf8"),
    );
    if (!(await rt.sandbox.window.ALIFE_SAVE_DEBUG.load("launch")))
      throw new Error("fixture did not load");
  } else {
    rt.game.createTestWorld({ seed: source, size: "battery", complexity: "lean" });
    const tick = rt.get("simTick");
    for (let i = 0; i < year * 30; i++) tick();
  }
  for (let press = 1; press <= presses; press++) rt.get("runCausalSkipForDebug()");
  const sample = `(() => {
    const hist = [0, 0, 0, 0, 0], eat = {}, towns = [];
    for (let i = 0; i < ${year}; i++) {
      simTick();
      if (W.tick % 32) continue;
      for (const id of W.activeIds) {
        if (W.kind[id] !== KINDS.PERSON || !classifyAlive(id) || !isAdultPerson(id)) continue;
        const l = W.components.life[id], body = W.components.body[id];
        if (l.age >= body.maxAge * PERSON_FERTILE_SHARE) continue;
        hist[Math.min(4, Math.floor(l.hunger / 20))]++;
        const t = W.components.work?.[id]?.task || "idle"; eat[t] = (eat[t] || 0) + 1;
      }
    }
    for (const s of W.settlements) { if (s.ruined || !s.knownProcesses) continue; const o = foodOutlook(s); towns.push(s.name.slice(0, 8) + " p" + o.pop + " food" + Math.round(o.food) + " larder" + Math.round(o.larder) + " stock" + o.stock + " hungry" + o.hungry.toFixed(2) + (o.famine ? " FAMINE" : o.lean ? " lean" : " fed")); }
    const total = hist.reduce((a, b) => a + b, 0) || 1;
    return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR), people: biospherePopulation(KINDS.PERSON), hunger: hist.map((n) => Math.round((100 * n) / total)), tasks: eat, towns });
  })()`;
  for (let n = 0; n < years; n++) {
    const r = JSON.parse(rt.get(sample));
    console.log(
      `y${r.year} ppl${r.people} hunger% [0-20,20-40,40-60,60-80,80+] = ${JSON.stringify(r.hunger)} tasks ${JSON.stringify(r.tasks)}`,
    );
    for (const t of r.towns) console.log("     " + t);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
