// Who registers what, in the order it runs.
//
//   node scripts/registry-map.cjs                 the tick: the calendar, then the systems after the core
//   node scripts/registry-map.cjs --events        every event type and the sections that tell it
//   node scripts/registry-map.cjs --events Road   the types whose names contain "Road"
//
// A system of the tick and an event's sentence are registrations now (16, 15),
// not wrappers; this reads them from the sections in manifest order, which is
// the order they run and are asked. who-overrides.cjs still reads the chains
// that remain.
const { readSections } = require("./compose-runtime.cjs");

const sections = readSections(),
  argv = process.argv.slice(2);
if (argv[0] === "--events") {
  const filter = argv[1] || "",
    tellers = new Map();
  for (const { name, source } of sections)
    for (const m of source.matchAll(/^eventText\(\s*\[([^\]]*)\]/gm))
      for (const t of m[1].matchAll(/"([^"]+)"/g))
        if (t[1].includes(filter))
          (tellers.get(t[1]) || tellers.set(t[1], []).get(t[1])).push(name);
  for (const [type, by] of [...tellers].sort())
    console.log(`${type.padEnd(34)} ${by.join(" -> ")}`);
  console.log(
    `${tellers.size} event types told by a section; the rest fall to 15's core sentences`,
  );
} else {
  const phases = { calendar: [], after: [] };
  let memoEnd = -1;
  for (const { name, source } of sections) {
    for (const m of source.matchAll(
      /^(tickSystem|calendarSystem|endTickMemoWindow)\(\s*(?:"([^"]+)")?/gm,
    )) {
      if (m[1] === "endTickMemoWindow") memoEnd = phases.after.length;
      else phases[m[1] === "tickSystem" ? "after" : "calendar"].push(`${m[2]}  (${name})`);
    }
  }
  console.log("The core tick (16): W.tick++, then the calendar (17's weather, then these):");
  phases.calendar.forEach((s, i) => console.log(`  c${String(i + 1).padStart(2, "0")}  ${s}`));
  console.log("... the fields, the substrate, every life, the slower passes; then the systems:");
  phases.after.forEach((s, i) =>
    console.log(
      `  ${String(i + 1).padStart(3, "0")}  ${s}${i === memoEnd ? "   <- memo window ends before this (70)" : ""}`,
    ),
  );
}
