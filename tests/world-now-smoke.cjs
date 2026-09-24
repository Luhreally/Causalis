// The world now (161): with nothing selected, the Inspect tab says the year,
// the counts, the next stage, the wars and hungry towns, and the latest
// notable events; it writes nothing.
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
  rt.sandbox.localStorage.setItem("causalis.save.now", archive.toString("utf8"));
  if (!(await rt.sandbox.window.ALIFE_SAVE_DEBUG.load("now")))
    throw new Error("fixture did not load");
  const hash = rt.get("worldHash()");
  rt.get("(UI.selectedEntity = 0, UI.selectedTile = -1, refreshInspector())");
  const html = rt.get("DOM.inspectPane.innerHTML");
  if (!/The world now/.test(html))
    failures.push("the empty Inspect tab does not show the world now");
  if (!/Year \d+/.test(html) || !/people/.test(html))
    failures.push("the world now lacks its year or counts");
  if (!/Lately/.test(html)) failures.push("the world now lacks its latest events");
  if (/undefined|NaN/.test(html)) failures.push("the world now printed undefined or NaN");
  if (rt.get("worldHash()") !== hash) failures.push("the world now changed the world");
  report({ bytes: html.length }, failures);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
