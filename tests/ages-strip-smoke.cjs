// The world's years at a glance (165): the History tab opens on the ages as
// bands and the wars as marks, read from the world without writing it.
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
  rt.sandbox.localStorage.setItem("causalis.save.strip", archive.toString("utf8"));
  if (!(await rt.sandbox.window.ALIFE_SAVE_DEBUG.load("strip")))
    throw new Error("fixture did not load");
  const hash = rt.get("worldHash()"),
    html = rt.sandbox.window.ALIFE_AGES_STRIP_DEBUG.html(),
    bands = (html.match(/<rect x="[^"]+" y="2"/g) || []).length,
    wars = (html.match(/fill="var\(--red\)"/g) || []).length,
    distinctAgeTicks = rt.get("new Set((W.ages || []).map((a) => a.tick)).size");
  if (bands !== distinctAgeTicks + 1)
    failures.push(`${bands} bands for ${distinctAgeTicks} ages and the time before them`);
  if (wars !== rt.get("W.activeWars.length"))
    failures.push(`${wars} war marks for ${rt.get("W.activeWars.length")} wars`);
  if (/undefined|NaN/.test(html)) failures.push("the strip printed undefined or NaN");
  if (rt.get("worldHash()") !== hash) failures.push("the strip changed the world");
  report({ bands, wars }, failures);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
