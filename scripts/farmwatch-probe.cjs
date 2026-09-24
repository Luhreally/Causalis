const fs = require("node:fs"),
  zlib = require("node:zlib");
const { loadRuntime } = require("./runtime-probe.cjs");
const rt = loadRuntime();
(async () => {
  rt.sandbox.localStorage.setItem(
    "causalis.save.launch",
    zlib.gunzipSync(fs.readFileSync("tests/fixtures/launch-battery.json.gz")).toString("utf8"),
  );
  if (!(await rt.sandbox.window.ALIFE_SAVE_DEBUG.load("launch"))) throw new Error("no load");
  for (let p = 0; p < 2; p++) rt.get("runCausalSkipForDebug()");
  for (let y = 0; y < 8; y++) {
    console.log(
      rt.get(`(() => {
      const s = W.settlements.find((x) => !x.ruined && x.name.startsWith("Zephyrford"));
      let planned = 0, sites = 0, tries = 0;
      const base = planBuilding;
      planBuilding = function (place, type, priority) { const b = base(place, type, priority); if (place === s && type === "farm") { tries++; if (b) planned++; } return b; };
      for (let i = 0; i < TICKS_PER_YEAR; i++) simTick();
      planBuilding = base;
      const o = foodOutlook(s), farms = W.buildings.filter((b) => !b.ruined && b.placeKind === "settlement" && b.placeId === s.id && b.type === "farm");
      const ordinal = W.buildings.filter((b) => !b.ruined && b.placeKind === "settlement" && b.placeId === s.id).length;
      return "y" + Math.floor(W.tick / TICKS_PER_YEAR) + " pop" + o.pop + " farms " + farms.filter((b) => b.complete).length + " done + " + farms.filter((b) => !b.complete).map((b) => "s" + b.stage + (missingBuildingMaterial(b) ? " needs " + missingBuildingMaterial(b).needed + " sp" + missingBuildingMaterial(b).sp : " stocked")).join(",") + " | desired " + (clamp(Math.ceil(o.pop / GRANARY_PEOPLE_PER_FARM), 1, GRANARY_MAX_FARMS) + (o.lean ? 1 : 0)) + " tries" + tries + " planned" + planned + " backoff" + JSON.stringify(s.siteBackoff || {}) + " tick" + W.tick + " site" + JSON.stringify(plannedBuildingTile(s, "farm", ordinal)) + " active" + activeBuildings(s).length + " hungry" + o.hungry.toFixed(2) + " store" + (s.inventory[C.ORGANIC] || 0);
    })()`),
    );
  }
})();
