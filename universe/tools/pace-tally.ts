// The turning points, people, realms and wars of a world, on any tree: node tools/pace-tally.ts <year> <seed>.
import { YEAR, codeOf, seedFromText, yearOfMoment } from "../src/kernel/index.ts";
import { EARTHLIKE, OPEN, keptLife } from "../src/rules/index.ts";
import * as sim from "../src/sim/index.ts";
import { TURNS } from "./calibration-bands.ts";
const [yearArg, s = "earth:first light"] = process.argv.slice(2),
  last = Number(yearArg ?? 900),
  earth = s.startsWith("earth:"),
  text = earth ? s.slice(6) : s.startsWith("kept:") ? keptLife(s.slice(5)) : s,
  world = sim.makePopulationWorld(seedFromText(text), {
    prior: earth ? EARTHLIKE : OPEN,
    start: "spread",
  }),
  ctx = sim.populationContext(world),
  turns = new Map<string, number>(),
  counts: Record<string, number> = {};
let read = 0;
console.log(`== ${s} to year ${last}`);
for (let y = 1; y <= last; y++) {
  world.runTo(y * YEAR);
  const log = world.events;
  let top = read;
  for (let i = log.count - 1; i >= 0; i--) {
    const e = log.at(i),
      code = codeOf(e.id);
    if (code <= read) break;
    if (code > top) top = code;
    for (const k of [
      "war.declared",
      "strife.revolution",
      "strife.coup",
      "polity.ended",
      "diplomacy.pact",
      "people.famine",
      "credit.defaulted",
      "credit.chest",
      "order.held",
      "ties.league",
    ])
      if (e.type === k) counts[k] = (counts[k] ?? 0) + 1;
    for (const turn of TURNS)
      if (!turns.has(turn.id)) {
        if (turn.event && e.type === turn.event) turns.set(turn.id, yearOfMoment(e.t));
        else if (
          turn.principle &&
          (e.data as { principle?: string } | null)?.principle === turn.principle
        )
          turns.set(turn.id, yearOfMoment(e.t));
      }
  }
  read = top;
  if (y % 100 === 0) {
    const people = ctx.provinces.all().reduce((n, p) => n + p.total(), 0);
    console.log(
      `  year ${y}: ${sim.politiesOf(world).living().length} realms, people ${people}, ${JSON.stringify(counts)}`,
    );
  }
}
console.log(
  `  turning points: ${TURNS.map((t) => `${t.id} ${turns.get(t.id) ?? "—"}${turns.has(t.id) && (turns.get(t.id)! < t.band[0] || turns.get(t.id)! > t.band[1]) ? "!" : ""}`).join(", ")}`,
);
