// Why does a hungry townsperson's meal fail while the store is full?
//
// The famine probe counted thousands of feeding attempts a year by the hungry
// of a famine town and a few hundred meals. This steps the transit press and
// wraps the meal's three doors — the forage underfoot (21), the conserved
// rations within eight tiles of a friendly place (30d), and the ration at
// home within the town's reach (117, 133) — recording for every failed
// attempt by a hungry resident of a lean town which door was tried and why it
// did not open: no home, home ruined, store empty, store at its seed reserve,
// out of reach (with distance and reach), hostile, or the rations rule of 30d
// refusing. The tally names the door to fix.
//
// node scripts/ration-why-probe.cjs <fixture.json.gz> <years> <presses>
const fs = require("node:fs");
const zlib = require("node:zlib");
const { loadRuntime } = require("./runtime-probe.cjs");
const rt = loadRuntime(),
  source = process.argv[2] || "tests/fixtures/launch-battery.json.gz",
  years = Number(process.argv[3] || 2),
  presses = Number(process.argv[4] ?? 8);
const year = rt.get("TICKS_PER_YEAR");
(async () => {
  rt.sandbox.localStorage.setItem("causalis.save.launch", zlib.gunzipSync(fs.readFileSync(source)).toString("utf8"));
  if (!(await rt.sandbox.window.ALIFE_SAVE_DEBUG.load("launch"))) throw new Error("fixture did not load");
  for (let press = 1; press <= presses; press++) {
    const row = JSON.parse(rt.get(`(() => { const r = runCausalSkipForDebug(); return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR), stop: r.stopReason, ships: (W.ascensions || []).length }); })()`));
    console.log(JSON.stringify({ press, ...row }));
    if (row.ships) break;
  }
  rt.get(`(() => {
    globalThis.__why = {};
    const tally = (k) => { globalThis.__why[k] = (globalThis.__why[k] || 0) + 1; };
    const f = performFeeding;
    performFeeding = function (id, tile, stride = 1) {
      const out = f(id, tile, stride);
      if (out || W.kind[id] !== KINDS.PERSON) return out;
      const l = W.components.life[id], soc = W.components.social[id], p = W.components.position[id];
      if (!l || l.hunger <= 70 || !soc || !p) return out;
      const home = soc.homePlaceKind === "settlement" ? W.settlements.find((s) => s.id === soc.homePlaceId) : null;
      const o = home && !home.ruined ? foodOutlook(home) : null;
      if (!o || !(o.lean || o.famine)) return out;
      const town = home.name.slice(0, 8);
      if (!home) { tally(town + ":no-home"); return out; }
      if (home.ruined) { tally(town + ":home-ruined"); return out; }
      const held = home.inventory?.[C.ORGANIC] || 0;
      if (held <= 0) { tally(town + ":store-empty"); return out; }
      if (typeof hearthSpareFood === "function" && hearthSpareFood(home, C.ORGANIC) <= 0) { tally(town + ":store-at-seed(" + held + "<=" + seedReserve(home) + ")"); return out; }
      if (typeof personIsHostileVisitor === "function" && personIsHostileVisitor(id, home.factionId)) { tally(town + ":hostile"); return out; }
      const d = Math.sqrt(dist2(p.x, p.y, home.x, home.y)), reach = typeof hearthReach === "function" ? hearthReach(home) : 8;
      if (d > reach) { tally(town + ":out-of-reach(d" + Math.round(d) + ">reach" + reach + ")" + (W.components.campaign?.[id] ? " campaign" : "") + (W.civilOrders?.some((c) => c.id === id) ? " order" : "")); return out; }
      const dig = W.components.inventory[id]?.digestive;
      tally(town + ":in-reach-but-failed(dig" + (dig ? dig[C.ORGANIC] : "?") + " tileFood" + tileFood(tile, "omnivore").toFixed(1) + " reason=" + String(l.behaviorReason || "").slice(0, 30) + ")");
      return out;
    };
    return 1; })()`);
  const aYear = `(() => {
    const state = globalThis.__state || (globalThis.__state = makeCausalSkipState());
    globalThis.__why = {};
    const stop = W.tick + ${year};
    while (W.tick < stop && !state.done) causalSkipStep(state);
    if (state.done) globalThis.__state = makeCausalSkipState();
    const rows = Object.entries(globalThis.__why).sort((a, b) => b[1] - a[1]).slice(0, 30);
    return JSON.stringify({ year: Math.floor(W.tick / TICKS_PER_YEAR), rows });
  })()`;
  for (let n = 0; n < years; n++) {
    const r = JSON.parse(rt.get(aYear));
    console.log("y" + r.year);
    for (const [k, v] of r.rows) console.log("   " + String(v).padStart(6) + "  " + k);
  }
})().catch((e) => { console.error(e); process.exit(1); });
