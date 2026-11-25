// node tools/field-probe.ts [count=40] [from=0] — how each world's field turns over (rules/planet.ts turnRate,
// fieldTurn): first light's and each open world's rate, whether one falls in its first 10,000 years, and on the
// first open world where one does the year's weather run at its beginning (the sim's own caller), to see the event
// told and what its weak field lets down.
import { YEAR, hashString, seedFromText, type SimTime } from "../src/kernel/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import { EARTHLIKE, OPEN, flareThrough, turnBegun, fieldTurn } from "../src/rules/index.ts";
import { generateHomeWorld } from "../src/gen/index.ts";
import {
  homeField,
  homeFieldAt,
  homeSky,
  homeTurn,
  homeTurns,
  populationContext,
  homePlanet,
} from "../src/sim/index.ts";
import { weatherYear, WEATHER_EVENTS } from "../src/sim/frontier/weather.ts";
import { why } from "../src/causal/index.ts";

const count = Number(process.argv[2] ?? 40),
  from = Number(process.argv[3] ?? 0);
function read(seed: string, earth: boolean) {
  const g = generateHomeWorld(seedFromText(seed), earth ? EARTHLIKE : OPEN),
    t = homeTurns(g);
  let first: number | null = null;
  for (let y = 0; y < 10000 && first === null; y += 50) if (homeTurn(g, y)) first = y;
  return { g, t, first };
}
const fl = read("first light", true);
console.log(
  `first light: a turn of ${fl.t.rate.turnYears} years, once in ${fl.t.rate.chance > 0 ? Math.round(fl.t.rate.turnYears / fl.t.rate.chance) : "never"}; in its first 10,000 years: ${fl.first === null ? "none" : `at year ${fl.first}`}`,
);
for (const k of ["field"]) {
  const key = hashString(`${k} ${fl.g.ground}`);
  let at: number | null = null;
  for (let y = 0; y < 30000 && at === null; y += 50) if (fieldTurn(key, y, fl.t.rate)) at = y;
  console.log(
    `  first light under key "${k}": ${at === null ? "no turn in 30,000 years" : `a turn by year ${at}`}`,
  );
}
let never = 0,
  within = 0,
  target: { seed: string; year: number } | null = null;
const every: number[] = [];
for (let i = from; i < from + count; i++) {
  const seed = `alien ${i}`,
    r = read(seed, false);
  if (r.t.rate.chance <= 0) never++;
  else every.push(Math.round(r.t.rate.turnYears / r.t.rate.chance));
  const next = turnBegun(r.t.key, 0, 300000, r.t.rate);
  if (!target && next) target = { seed, year: next.from };
  if (r.first !== null) {
    within++;
    const turn = homeTurn(r.g, r.first)!;

    console.log(
      `  ${seed}: turning over in years ${turn.from}–${turn.to}; shelter ${homeField(r.g).shelter.toFixed(3)} → ${homeFieldAt(r.g, Math.floor((turn.from + turn.to) / 2)).shelter.toFixed(3)} at its middle; a flare of 5 lets ${flareThrough(5, homeField(r.g).shelter).toFixed(3)} → ${flareThrough(5, homeFieldAt(r.g, Math.floor((turn.from + turn.to) / 2)).shelter).toFixed(3)} through`,
    );
  }
}
every.sort((a, b) => a - b);
console.log(
  `${count} open worlds: ${never} with no one pole to turn, ${every.length} that turn (once in ${every[0]} … median ${every[every.length >> 1]} … ${every.at(-1)} years); ${within} turning over within their first 10,000 years`,
);
if (target) {
  const world = ALIEN.build(seedFromText(target.seed)),
    ctx = populationContext(world),
    before = world.events.count,
    // (The sim reads its own world, whose ground is not the fine one's: its turns are its own.)
    sg = homePlanet(world).generated,
    st = homeTurns(sg),
    begun = turnBegun(st.key, 0, 3000000, st.rate);
  void EARTH;
  if (!begun) throw new Error("no turn begins on the sim's world");
  target.year = begun.from;
  weatherYear(ctx, ((target.year + 1) * YEAR) as SimTime);
  const told = world.events.all().filter((e) => e.type === WEATHER_EVENTS.turn.type);
  console.log(
    `${target.seed}, the year's weather run at year ${target.year}: ${world.events.count - before} event(s), ${told.length} of the field turning`,
  );
  for (const e of told)
    console.log(`  “${why(world, e.id).claim}” causes ${JSON.stringify(e.causes)}`);
  console.log(
    `  homeSky at the world's now (year 0): ${homeSky(world).toFixed(4)}; its field's shelter whole ${homeField(sg).shelter.toFixed(3)}, at the turn's middle ${homeFieldAt(sg, begun.from + Math.floor((begun.to - begun.from) / 2)).shelter.toFixed(3)}`,
  );
}
