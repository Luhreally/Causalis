// Whom a town learns from (30f): a craft a sister town of the same polity
// practises is learned at the polity's pace (3), even though every craft some
// town has found is also in the world's memory (1.8), which once stood in for
// it; with no sister town practising it the pace falls back to a neighbour's or
// the memory's; the archive's record is the quickest teacher; and the chronicle
// names the teacher that set the pace. On the grown battery fixture, which has
// polities of several towns.
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
  rt.sandbox.localStorage.setItem("causalis.save.teachers", archive.toString("utf8"));
  if (!(await rt.sandbox.window.ALIFE_SAVE_DEBUG.load("teachers")))
    throw new Error("fixture did not load");
  const result = rt.get(`(() => {
    const out = {}, towns = W.settlements.filter((s) => !s.ruined && s.factionId);
    // a craft one town of a polity knows and a sister town does not, with no
    // ruin near the sister that knew it
    let pick = null;
    for (const b of towns) {
      for (const a of towns) {
        if (a === b || a.factionId !== b.factionId) continue;
        const craft = a.knownProcesses.find((t) => !b.knownProcesses.includes(t) &&
          !W.settlements.some((r) => r.ruined && r.knownProcesses?.includes(t) && dist2(r.x, r.y, b.x, b.y) <= 196));
        if (craft) { pick = { a, b, craft }; break; }
      }
      if (pick) break;
    }
    if (!pick) return { none: true };
    const { b, craft } = pick, memory = (W.civilization.legacyProcesses ||= []);
    if (!memory.includes(craft)) memory.push(craft);
    out.craft = craft;
    out.withSister = researchTeacher(b, craft, false);
    out.withArchive = researchTeacher(b, craft, true);
    // take the craft from every sister town for a moment
    const sisters = W.settlements.filter((s) => s !== b && s.factionId === b.factionId && s.knownProcesses.includes(craft));
    for (const s of sisters) s.knownProcesses = s.knownProcesses.filter((t) => t !== craft);
    out.withoutSister = researchTeacher(b, craft, false);
    for (const s of sisters) s.knownProcesses.push(craft);
    out.teachers = RESEARCH_TEACHERS;
    return out;
  })()`);
  if (result.none) failures.push("the fixture has no polity with a craft one town lacks");
  else {
    const T = result.teachers;
    if (result.withSister?.evidence !== T.sister.evidence)
      failures.push(
        `a sister town's craft was not taught by the sister: ${JSON.stringify(result.withSister)}`,
      );
    if (!(result.withSister?.pace >= 3))
      failures.push("a sister town's craft is not learned at the polity's pace");
    if (!(result.withSister?.pace > T.memory.pace))
      failures.push("the world's memory still stands in for the polity");
    if (!result.withoutSister || result.withoutSister.pace >= result.withSister.pace)
      failures.push(
        `without a sister town the pace did not fall: ${JSON.stringify(result.withoutSister)}`,
      );
    if (result.withArchive?.pace !== T.archive.pace)
      failures.push("the archive's record is not the quickest teacher");
  }
  report(
    { craft: result.craft, withSister: result.withSister, withoutSister: result.withoutSister },
    failures,
  );
})().catch((error) => {
  report({ error: String(error?.stack || error) }, [String(error?.message || error)]);
});
