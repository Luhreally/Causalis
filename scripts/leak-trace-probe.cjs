// Every move of the leaking species in the tick the audit moves, with who made it.
//
// The leak-who probe named the species whose world total moves (on phone
// variety-8 at year 71: the record-only species 17 and 28, gained by
// herbivores sixteen and six at a time) but not the code. This wraps the tile
// helpers of section 13 and every other function that hands matter to an
// entity, records each call touching a watched species during the watched
// press — tile, species, amount asked, amount moved, and the two frames of
// stack above the helper mapped to section:line — and prints the ticks whose
// audit moved with the calls that landed in them.
//
// node scripts/leak-trace-probe.cjs <seed> <size> <complexity> <watchFrom> <species,species>
const path = require("node:path");
const { loadRuntime } = require("./runtime-probe.cjs");
const { mapCompositeLine } = require(path.join(__dirname, "compose-runtime.cjs"));
const rt = loadRuntime(),
  seed = process.argv[2] || "variety-8",
  size = process.argv[3] || "phone",
  complexity = process.argv[4] || "lean",
  watchFrom = Number(process.argv[5] || 10),
  watched = String(process.argv[6] || "17,28")
    .split(",")
    .map(Number);
rt.game.createTestWorld({ seed, size, complexity });
const tick = rt.get("simTick"),
  year = rt.get("TICKS_PER_YEAR");
console.log(
  JSON.stringify({
    seed,
    size,
    complexity,
    watchFrom,
    watched,
    names: rt.get(
      `JSON.stringify(Object.fromEntries(Object.entries(C).filter(([k, v]) => [${watched.join(",")}].includes(v))))`,
    ),
    common: rt.get("COMMON_CHEM"),
  }),
);
for (let i = 0; i < year * 30; i++) tick();
const coarse = `(() => { const r = runCausalSkipForDebug(); return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR), stop: r.stopReason, delta: auditMatter().delta }); })()`;
for (let press = 1; press < watchFrom; press++) {
  const row = JSON.parse(rt.get(coarse));
  console.log(JSON.stringify({ press, ...row }));
  if (row.delta !== 0) {
    console.log("drifted before the watched press");
    process.exit(0);
  }
}
rt.get(`(() => {
  globalThis.__trace = [];
  const watched = new Set([${watched.join(",")}]);
  const frames = () => String(new Error().stack).split("\\n").slice(3, 6).map((l) => { const m = l.match(/causalis\\.runtime\\.js:(\\d+)/); return m ? Number(m[1]) : l.trim().slice(0, 40); });
  const held = (tile, sp) => (tile == null || sp == null ? null : sp < COMMON_CHEM ? W.tiles.chem[sp][tile] + (W.tiles.rareChem[tileMatterKey(tile, sp)] || 0) : (W.tiles.rareChem[tileMatterKey(tile, sp)] || 0));
  const wrap = (name, pick) => {
    const base = eval(name);
    eval(name + " = function (...args) { const before = watched.has(args[1]) ? held(args[0], args[1]) : null; const out = base.apply(this, args); const info = pick(args, out); if (info && watched.has(info.sp)) globalThis.__trace.push({ fn: name, ...info, before, after: held(args[0], args[1]), frames: frames() }); return out; }");
  };
  wrap("takeTileMatter", (a, out) => ({ tile: a[0], sp: a[1], asked: a[2], moved: out }));
  wrap("giveTileMatter", (a, out) => ({ tile: a[0], sp: a[1], asked: a[2], moved: out }));
  wrap("setTileMatterAmount", (a, out) => ({ tile: a[0], sp: a[1], asked: a[2], moved: out }));
  if (typeof transferPlanetSpeciesToEntity === "function") wrap("transferPlanetSpeciesToEntity", (a, out) => ({ entity: a[0], sp: a[1], asked: a[2], moved: out }));
  return 1;
})()`);
const fine = `(() => {
  const state = makeCausalSkipState();
  let last = auditMatter().delta;
  const found = [];
  for (let i = 0; i < state.limit && !state.done && found.length < 4; i++) {
    globalThis.__trace.length = 0;
    causalSkipStep(state);
    const d = auditMatter().delta;
    if (d === last) continue;
    found.push({ tick: W.tick, change: d - last, calls: globalThis.__trace.slice(0, 60) });
    last = d;
  }
  return JSON.stringify(found);
})()`;
const rows = JSON.parse(rt.get(fine));
for (const r of rows) {
  console.log(`tick ${r.tick} change ${r.change} calls ${r.calls.length}`);
  for (const c of r.calls)
    console.log(
      `   ${c.fn} tile${c.tile ?? "-"} ent${c.entity ?? "-"} sp${c.sp} asked${c.asked} moved${c.moved} held ${c.before}->${c.after} <- ${c.frames.map((f) => (typeof f === "number" ? JSON.stringify(mapCompositeLine(f)) : f)).join(" < ")}`,
    );
}
