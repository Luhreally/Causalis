// node tools/finance-save.ts <year> [seed]: what a realm's money and fears cost a save (sim/finance), on a world run to the year as
// the app makes it: the whole save gzipped, the store's own part and the kept years', and of the events and decisions the log
// still holds, how many are of this module, by type, and their share of the log's bytes (the save's `history.events` and
// `history.decisions` scaled by it).
import { gzipSync } from "node:zlib";
import { YEAR, rulesetId, saveWorld, seedFromText } from "../src/kernel/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";

const [yearArg = "3100", s = "earth:first light"] = process.argv.slice(2),
  earth = s.startsWith("earth:"),
  world = (earth ? EARTH : ALIEN).build(seedFromText(earth ? s.slice(6) : s));
world.runTo(Number(yearArg) * YEAR);
const doc = saveWorld(world, rulesetId(world, "probe")),
  gz = (x: unknown) => gzipSync(JSON.stringify(x)).length,
  mb = (n: number) => (n / 1e6).toFixed(3),
  stores = doc.stores as Record<string, unknown>,
  byType = new Map<string, [number, number]>();
let all = 0,
  mine = 0;
for (let i = 0; i < world.events.count; i++) {
  const e = world.events.at(i),
    n = JSON.stringify({
      t: e.t,
      type: e.type,
      subjects: e.subjects,
      place: e.place,
      causes: e.causes,
      data: e.data,
    }).length;
  all += n;
  if (!e.type.startsWith("finance.")) continue;
  mine += n;
  const had = byType.get(e.type) ?? [0, 0];
  byType.set(e.type, [had[0] + 1, had[1] + n]);
}
let decisions = 0,
  decisionsMine = 0,
  countMine = 0;
for (const d of world.decisions.all()) {
  const n = JSON.stringify(d).length;
  decisions += n;
  if (d.rule.startsWith("finance.")) {
    decisionsMine += n;
    countMine++;
  }
}
const events = gz(stores["history.events"]),
  decs = gz(stores["history.decisions"]);
console.log(`== ${s} at ${yearArg}: the save ${mb(gz(doc))} MB`);
console.log(
  `  finance.realms ${mb(gz(stores["finance.realms"]))} MB; readings.years ${mb(gz(stores["readings.years"]))} MB; credit.houses ${mb(gz(stores["credit.houses"]))} MB`,
);
console.log(
  `  history.events ${mb(events)} MB for ${world.events.count} events: ${[...byType].map(([k, [c, n]]) => `${k} ${c} (${(n / 1e3).toFixed(0)} kB raw)`).join(", ")}; this module's ${((100 * mine) / all).toFixed(2)}% of their bytes, some ${mb((events * mine) / all)} MB`,
);
console.log(
  `  history.decisions ${mb(decs)} MB: ${countMine} of this module, ${((100 * decisionsMine) / Math.max(1, decisions)).toFixed(2)}% of their bytes, some ${mb((decs * decisionsMine) / Math.max(1, decisions))} MB`,
);
