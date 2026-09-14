const fs = require("node:fs"), zlib = require("node:zlib");
const { loadRuntime } = require("./runtime-probe.cjs");
const rt = loadRuntime();
(async () => {
  rt.sandbox.localStorage.setItem("causalis.save.launch", zlib.gunzipSync(fs.readFileSync("tests/fixtures/launch-battery.json.gz")).toString("utf8"));
  if (!(await rt.sandbox.window.ALIFE_SAVE_DEBUG.load("launch"))) throw new Error("no load");
  for (let p = 0; p < 2; p++) rt.get("runCausalSkipForDebug()");
  console.log(rt.get(`(() => {
    const out = [];
    for (const s of W.settlements.filter((x) => !x.ruined && x.knownProcesses)) {
      const o = foodOutlook(s), pr = s.management?.priorities || {};
      const desired = clamp(Math.ceil(o.pop / GRANARY_PEOPLE_PER_FARM), 1, GRANARY_MAX_FARMS) + (o.lean ? 1 : 0);
      const active = activeBuildings(s), activeFarms = activeBuildings(s, "farm");
      const ring = zoneTarget("farm", s, townPlan(s), townBuildings(s)), outer = townOuterRing(s);
      const tile = plannedBuildingTile(s, "farm", 0);
      const blocks = active.map((b) => b.type.slice(0, 5) + ":s" + b.stage).join(","); const planned = granaryCount(s, "farm") < desired ? (planBuilding(s, "farm", 5) ? "planned" : "REFUSED backoff" + JSON.stringify(s.siteBackoff || {}) + " tick" + W.tick + " base:" + (planBuildingPerfBase(s, "farm", 5) ? "ok" : "no") + " buildings" + W.buildings.filter((b) => !b.ruined).length) : "enough";
      out.push([s.name.slice(0, 9), "pop" + o.pop, "farms" + granaryCount(s, "farm"), "desired" + desired, "activeFarms" + activeFarms.length, "active" + active.length + "/" + (GRANARY_ACTIVE_CAP + GRANARY_ACTIVE_FIELDS * 2), "outer" + outer, "ring" + ring, "site" + (tile == null ? "none" : tile), planned, o.lean ? "lean" : "fed", "hungry" + o.hungry.toFixed(2), blocks].join(" "));
    }
    return out.join(" || ");
  })()`));
})();
