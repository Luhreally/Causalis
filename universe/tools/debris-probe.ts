// node tools/debris-probe.ts [seed="first light"] [from=60] [years=110] — orbital debris and a ship's clocks on a
// real world, its realms taught the road to orbit by hand (no run reaches the space age in a short probe: the rules
// that decide are the sim's own from there on). Every realm is taught orbital flight, life support, stations,
// habitats and an antimatter drive at `from` and given machines; then the world runs, and each decade is told:
// launches made and the tonnes they lifted, the dead mass aloft against the critical, what a launch costs and the
// chance it is lost, launches lost to it and a cascade told; and each ship between the stars: its speed, the years
// gone at home and aboard, the years its people did not age (the ageing step's own reading), and its arrival's
// telling.
import { YEAR, seedFromText, yearOfMoment } from "../src/kernel/index.ts";
import { G, clockSlips, crossingClocks, principle } from "../src/rules/index.ts";
import { EARTH } from "../src/host/planet.ts";
import {
  SPACE_EVENTS,
  VOYAGE_EVENTS,
  debrisNow,
  liftsOf,
  loreOf,
  marketsOf,
  politiesOf,
  populationContext,
  spaceOf,
  starSitesOf,
} from "../src/sim/index.ts";
import { why } from "../src/causal/index.ts";

const seed = process.argv[2] ?? "first light",
  from = Number(process.argv[3] ?? 60),
  years = Number(process.argv[4] ?? 110),
  world = EARTH.build(seedFromText(seed));
world.runTo(from * YEAR);
const lore = loreOf(world),
  realms = [...politiesOf(world).living()];
for (const realm of realms) {
  for (const id of [
    "mathematics",
    "astronomy",
    "steel",
    "engines",
    "electricity",
    "electronics",
    "rocketry",
    "guidance",
    "orbital-flight",
    "medicine",
    "life-support",
    "stations",
    "habitats",
    "fusion-drive",
    "antimatter-drive",
    "long-sleep",
  ])
    lore.learn(realm.seat, id, { year: from, event: realm.event }, principle(id));
  marketsOf(world).of(realm.seat).move("made", G.machines, 80_000_000);
}
console.log(`${seed}: ${realms.length} realms taught the road to orbit at year ${from}`);
const ctx = populationContext(world),
  slips = new Map<number, number>();
let events0 = world.events.count;
for (let y = from + 1; y <= from + years; y++) {
  world.runTo(y * YEAR);
  const year = yearOfMoment(world.now);
  // (Fresh machines each decade: the probe is of the sky, not of who can afford it.)
  if (y % 10 === 0)
    for (const realm of politiesOf(world).living())
      marketsOf(world).of(realm.seat).move("made", G.machines, 40_000_000);
  for (const [cell, s] of starSitesOf(world)?.all() ?? []) {
    if (s.arrived || s.lane || year <= s.departed || year > s.arrives) continue;
    if (clockSlips(year - s.departed, crossingClocks(s.distance, s.arrives - s.departed).v))
      slips.set(cell, (slips.get(cell) ?? 0) + 1);
  }
  if (y % 10 !== 0 && y !== from + years) continue;
  const lifts = liftsOf(world),
    d = debrisNow(ctx, year);
  let lost = 0,
    cascade = 0;
  for (let i = events0; i < world.events.count; i++) {
    const e = world.events.at(i);
    if (e.type === SPACE_EVENTS.lost.type) {
      lost++;
      if (lost === 1) console.log(`    “${why(world, e.id).claim}”`);
    }
    if (e.type === SPACE_EVENTS.cascade.type) {
      cascade++;
      console.log(`    “${why(world, e.id).claim}” causes ${JSON.stringify(e.causes)}`);
    }
    if (e.type === VOYAGE_EVENTS.arrived.type) console.log(`    “${why(world, e.id).claim}”`);
  }
  events0 = world.events.count;
  console.log(
    `  year ${year}: ${lifts.length} launches (${Math.round(lifts.reduce((a, l) => a + l.tonnes, 0))} t lifted), ${spaceOf(world).all().length} programs; ${d.left.toFixed(0)} t dead aloft = ${(d.load * 100).toFixed(0)}% of the critical ${d.critical.toFixed(0)} t${d.cascade ? ", a cascade" : ""}; a launch costs ×${d.costs.toFixed(3)}, ${(d.loss * 100).toFixed(1)}% lost; this decade ${lost} lost, ${cascade} cascade told`,
  );
}
for (const [cell, s] of starSitesOf(world)?.all() ?? []) {
  const c = crossingClocks(s.distance, s.arrives - s.departed);
  console.log(
    `  ship of land ${cell}: ${s.distance.toFixed(1)} light-years on ${s.drive}${s.lane ? " by lanes" : ""}, sailed ${s.departed}, comes ${s.arrives}: ${(c.v * 100).toFixed(1)}% of light's speed, ${c.home} years at home and ${c.aboard.toFixed(1)} aboard; ${slips.get(cell) ?? 0} years unlived aboard so far; its word reaches home ${c.word} years after`,
  );
}
