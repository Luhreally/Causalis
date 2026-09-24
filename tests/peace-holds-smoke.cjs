// Three rules that were meant to act and once did not (28, 81, 90): a town's
// archive is read, two polities under a pact are held under the war line, and
// hostility fades when the pressure behind it has gone. On the grown phone
// fixture, which has pacts, hostile neighbours and archives.
const fs = require("node:fs");
const zlib = require("node:zlib");
const path = require("node:path");
const { loadRuntime } = require("../scripts/runtime-probe.cjs");
const { report } = require("./lib/report.cjs");

const failures = [];
(async () => {
  const rt = loadRuntime();
  const archive = zlib.gunzipSync(
    fs.readFileSync(path.join(__dirname, "fixtures", "launch-phone.json.gz")),
  );
  rt.sandbox.localStorage.setItem("causalis.save.peace", archive.toString("utf8"));
  if (!(await rt.sandbox.window.ALIFE_SAVE_DEBUG.load("peace")))
    throw new Error("fixture did not load");
  rt.get(`(() => {
    globalThis.__peace = { recoverCalls: 0, warsUnderPact: 0 };
    const recover = recoverRecordedKnowledge;
    recoverRecordedKnowledge = function (...a) { __peace.recoverCalls++; return recover.apply(this, a); };
    return 1;
  })()`);
  const tick = rt.get("simTick"),
    seen = new Set(rt.get("W.activeWars.map((w) => w.id)"));
  // Hostile pairs at the start: on this fixture one of them thaws within four
  // years once its pressure has gone (none ever did before the rule).
  const hostileAtStart = rt.get(
    `W.factions.flatMap((f) => Object.entries(f.relations || {}).filter(([id, r]) => f.id < Number(id) && r.status === "hostile").map(([id]) => [f.id, Number(id)]))`,
  );
  for (let i = 0; i < 1024; i++) {
    tick();
    if (i % 128 === 127)
      for (const w of rt.get("W.activeWars.map((w) => ({ id: w.id, a: w.a, b: w.b }))"))
        if (!seen.has(w.id)) {
          seen.add(w.id);
          if (rt.get(`activeTreaty("pact", factionById(${w.a}), factionById(${w.b}))`))
            rt.get("__peace.warsUnderPact++");
        }
  }
  const peace = rt.get("({ ...__peace })"),
    pacted = rt.get(
      `(W.diplomacy?.treaties || []).filter((t) => t.active && t.kind === "pact").map((t) => factionById(t.a).relations[t.b]?.pressure ?? 0)`,
    ),
    thawed = hostileAtStart.filter(
      ([a, b]) => rt.get(`factionById(${a})?.relations[${b}]?.status`) === "neutral",
    ).length;
  if (peace.recoverCalls < 3)
    failures.push(`the archives were read ${peace.recoverCalls} times in four years`);
  if (peace.warsUnderPact) failures.push(`${peace.warsUnderPact} wars began under a pact`);
  if (pacted.some((p) => p > 105))
    failures.push(`a pacted pair's pressure stands at ${Math.max(...pacted)}, past the war line`);
  // Hostility fades by the rule, whatever the fixture's course: just after a
  // diplomacy pass no pair outside a war or a truce stands hostile under
  // forty. (Whether a pair's causes fall that low in four years is the
  // world's business; the fixture's own hostile pairs are counted as thawed.)
  while (rt.get("W.tick % 128") !== 1) tick();
  const stale =
    rt.get(`W.factions.flatMap((f) => Object.entries(f.relations || {}).filter(([id, r]) => {
      const b = Number(id);
      if (f.id >= b || r.status !== "hostile" || r.pressure >= 40) return false;
      if (W.tick < (r.truceUntil || 0)) return false;
      return !W.activeWars.some((w) => !w.ended && ((w.a === f.id && w.b === b) || (w.a === b && w.b === f.id)));
    }).map(([id, r]) => [f.id, Number(id), Math.round(r.pressure)]))`);
  if (!hostileAtStart.length) failures.push("the fixture has no hostile pair to watch");
  // And the rule acts: one hostile pair outside war and truce, its causes read
  // as nothing for a pass, comes out of that pass neutral (it stayed hostile
  // before the rule).
  const forced = rt.get(`(() => {
    for (const f of W.factions) for (const [id, r] of Object.entries(f.relations || {})) {
      const b = Number(id);
      if (r.status !== "hostile" || W.tick < (r.truceUntil || 0)) continue;
      if (W.activeWars.some((w) => !w.ended && ((w.a === f.id && w.b === b) || (w.a === b && w.b === f.id)))) continue;
      const pair = [f.id, b], base = relationPressure;
      relationPressure = function (x, y) {
        const out = base(x, y);
        return (x.id === pair[0] && y.id === pair[1]) || (x.id === pair[1] && y.id === pair[0]) ? { ...out, pressure: 0 } : out;
      };
      r.pressure = factionById(b).relations[f.id].pressure = 30;
      globalThis.__forced = { pair, base };
      return pair;
    }
    return null;
  })()`);
  if (forced) {
    do tick();
    while (rt.get("W.tick % 128") !== 1);
    const status = rt.get(`factionById(${forced[0]}).relations[${forced[1]}].status`);
    rt.get("(() => { relationPressure = __forced.base; return 1; })()");
    if (status !== "neutral")
      failures.push(`a hostile pair with nothing behind it stayed ${status}`);
  }
  if (stale.length) failures.push(`hostility outlived its cause: ${JSON.stringify(stale)}`);
  report(
    {
      peace,
      pactPressures: pacted.map((p) => Math.round(p)),
      hostileAtStart: hostileAtStart.length,
      thawed,
      stale,
    },
    failures,
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
