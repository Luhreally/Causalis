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
  if (hostileAtStart.length && !thawed) failures.push("no hostility faded in four years");
  report({ peace, pactPressures: pacted.map((p) => Math.round(p)), thawed }, failures);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
