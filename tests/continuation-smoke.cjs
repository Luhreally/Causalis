// A save is a bookmark: a world loaded from its own save runs on exactly as the
// world it was saved from. Checked from a fresh world's first tick, a young
// village and a grown city, by hashing both worlds every sixteen ticks after the
// load. Before 2026-09, a loaded world parted from its original within a tick:
// the load made fields a live world makes lazily, and the plans' timing and the
// cars' fuel tally were held beside W, not in it.
const fs = require("node:fs");
const zlib = require("node:zlib");
const path = require("node:path");
const { loadRuntime } = require("../scripts/runtime-probe.cjs");
const { report } = require("./lib/report.cjs");

const failures = [],
  cases = [];
const FRESH = { seed: "causal-origin", size: "battery", complexity: "lean" };
const KEYS = `(() => { const out = {}; for (const k of Object.keys(W).sort()) { if (k === "tiles" || k === "components") for (const s of Object.keys(W[k] || {}).sort()) out[k + "." + s] = JSON.stringify(W[k][s], saveReplacer); else if (k !== "hash" && k !== "saveMetadata") out[k] = JSON.stringify(W[k], saveReplacer); } return out; })()`;

async function check(label, setup, warm, span = 160) {
  const live = loadRuntime(),
    loaded = loadRuntime();
  await setup(live);
  const tickLive = live.get("simTick");
  for (let i = 0; i < warm; i++) tickLive();
  loaded.sandbox.localStorage.setItem(
    "causalis.save.continuation",
    live.get("JSON.stringify(snapshot(), saveReplacer)"),
  );
  if (!(await loaded.sandbox.window.ALIFE_SAVE_DEBUG.load("continuation"))) {
    failures.push(`${label}: the save did not load`);
    return;
  }
  const tickLoaded = loaded.get("simTick");
  let parted = null;
  for (let n = 0; n <= span && !parted; n++) {
    if (n) {
      tickLive();
      tickLoaded();
    }
    if (n % 16 === 0 && live.get("worldHash()") !== loaded.get("worldHash()")) {
      const a = live.get(KEYS),
        b = loaded.get(KEYS);
      parted = {
        tick: n,
        keys: [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => a[k] !== b[k]),
      };
    }
  }
  cases.push({ label, warm, parted: parted || false, hash: live.get("worldHash()") });
  if (parted)
    failures.push(
      `${label}: the loaded world parted from its original ${parted.tick} ticks after loading (${parted.keys.slice(0, 6).join(", ")})`,
    );
}

const fresh = async (rt) => rt.sandbox.window.ALIFE_DEBUG.createTestWorld(FRESH);
const fixture = (name) => async (rt) => {
  const archive = zlib.gunzipSync(
    fs.readFileSync(path.join(__dirname, "fixtures", `launch-${name}.json.gz`)),
  );
  rt.sandbox.localStorage.setItem("causalis.save.fixture", archive.toString("utf8"));
  if (!(await rt.sandbox.window.ALIFE_SAVE_DEBUG.load("fixture")))
    throw new Error("fixture did not load");
};
(async () => {
  await check("a new world", fresh, 0);
  await check("a world sixteen ticks old", fresh, 16);
  await check("a village in its second year", fresh, 300);
  await check("the battery city", fixture("battery"), 100, 128);
  report({ cases }, failures);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
