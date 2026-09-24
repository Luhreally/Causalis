// The polities side by side (164): a Legends page that sets the living
// polities in a table sortable by any column, reached from the index; reading
// it writes nothing.
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
  rt.sandbox.localStorage.setItem("causalis.save.compare", archive.toString("utf8"));
  if (!(await rt.sandbox.window.ALIFE_SAVE_DEBUG.load("compare")))
    throw new Error("fixture did not load");
  const hash = rt.get("worldHash()"),
    living = rt.get("W.factions.filter((f) => f.stability > 0).length"),
    byPeople = rt.sandbox.window.ALIFE_COMPARE_DEBUG.html("people"),
    byArms = rt.sandbox.window.ALIFE_COMPARE_DEBUG.html("arms"),
    rows = (byPeople.match(/<tr><th scope="row">/g) || []).length;
  if (rows !== living) failures.push(`${rows} rows for ${living} living polities`);
  if (/undefined|NaN/.test(byPeople + byArms)) failures.push("the table printed undefined or NaN");
  if (byPeople === byArms && living > 1) failures.push("sorting by arms changed nothing");
  if (!rt.get('renderLegendIndex("")').includes('data-legend="compare:0"'))
    failures.push("the Legends index does not lead to the table");
  if (rt.get("worldHash()") !== hash) failures.push("the table changed the world");
  report({ living, rows }, failures);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
