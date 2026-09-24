// A town remembers its last lean season (82): on the grown battery fixture,
// with one town's granary read as fed for the test, a fed person there hurries
// the next child; within a year of a lean reading nobody there hurries; a year
// and a day after it the hurry returns; and the granary's memory writes down a
// lean reading when it sees one.
const fs = require("node:fs");
const zlib = require("node:zlib");
const path = require("node:path");
const { loadRuntime } = require("../scripts/runtime-probe.cjs");
const { report } = require("./lib/report.cjs");

const failures = [];
(async () => {
  const rt = loadRuntime();
  const archive = zlib.gunzipSync(
    fs.readFileSync(path.join(__dirname, "fixtures", "launch-battery.json.gz")),
  );
  rt.sandbox.localStorage.setItem("causalis.save.memory", archive.toString("utf8"));
  if (!(await rt.sandbox.window.ALIFE_SAVE_DEBUG.load("memory")))
    throw new Error("fixture did not load");
  const out = rt.get(`(() => {
    // a fed adult beside a town
    let person = 0, town = null;
    for (const id of W.activeIds) {
      if (W.kind[id] !== KINDS.PERSON || !classifyAlive(id)) continue;
      const p = W.components.position[id], s = p ? nearestSettlement(idx(p.x, p.y), 8) : null;
      if (s && !s.ruined && (W.components.life[id]?.hunger ?? 99) < 40) { person = id; town = s; break; }
    }
    if (!person) return { none: "no fed person beside a town" };
    const base = foodOutlook, fed = { food: 200, larder: 200, stock: 5000, pop: 20, hungry: 0, lean: false, famine: false };
    let read = fed;
    foodOutlook = (place) => (place === town ? { ...read } : base(place));
    const haste = () => { hasteCache.tick = -1; return concertedBirthHaste(person, derivedLife(person)); };
    const saved = town.hardTick, savedRelief = town.causalReliefUntil;
    town.causalReliefUntil = 0;
    const out = { town: town.name };
    delete town.hardTick;
    out.noMemory = haste();
    town.hardTick = W.tick - 5;
    out.afterLean = haste();
    town.hardTick = W.tick - TICKS_PER_YEAR - 1;
    out.aYearOn = haste();
    // the memory writes a lean reading down
    delete town.hardTick;
    read = { ...fed, lean: true, larder: 4 };
    const tick = W.tick;
    W.tick = tick - (tick % 32) + 20;
    TICK_SYSTEMS.after.find((s) => s.name === "granary memory").run();
    out.recorded = town.hardTick === W.tick;
    W.tick = tick;
    foodOutlook = base;
    if (saved === undefined) delete town.hardTick; else town.hardTick = saved;
    town.causalReliefUntil = savedRelief;
    return out;
  })()`);
  if (out.none) failures.push(out.none);
  else {
    if (!(out.noMemory > 1))
      failures.push(`a fed person in a fed town did not hurry (haste ${out.noMemory})`);
    if (out.afterLean !== 1)
      failures.push(`a town lean five ticks ago still hurried (haste ${out.afterLean})`);
    if (!(out.aYearOn > 1))
      failures.push(
        `a year and a day after a lean reading the hurry did not return (haste ${out.aYearOn})`,
      );
    if (!out.recorded) failures.push("the granary's memory did not write down a lean reading");
  }
  report(out, failures);
})().catch((error) => {
  report({ error: String(error?.stack || error) }, [String(error?.message || error)]);
});
