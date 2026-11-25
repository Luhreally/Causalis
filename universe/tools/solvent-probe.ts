// node tools/solvent-probe.ts [count=400] [from=0] — the liquid of each open world's seas, read from its numbers
// (rules/solvent.ts): each kind's share, which seeds' seas are of a liquid not their kind's own (ethane), whether
// the liquid derived still lies liquid where the world was set, whether its life took hold and a people rose; and
// the liquids on the faces of the other bodies of each star's system.
import { seedFromText } from "../src/kernel/index.ts";
import { generateHomeWorld, worldKindOf } from "../src/gen/index.ts";
import {
  KINDS,
  KIND_SOLVENT,
  OPEN,
  bodyLiquid,
  kindFacts,
  liquidBand,
} from "../src/rules/index.ts";

const count = Number(process.argv[2] ?? 400),
  from = Number(process.argv[3] ?? 0),
  kinds: Record<string, number> = {},
  bodies: Record<string, number> = {},
  derived: string[] = [];
let unstable = 0,
  n = 0;
for (let i = from; i < from + count; i++) {
  const seed = `alien ${i}`,
    g = generateHomeWorld(seedFromText(seed), OPEN),
    kind = worldKindOf(g),
    liquid = g.planet.liquid ?? KIND_SOLVENT[kind],
    key = `${kind}/${liquid}`;
  kinds[key] = (kinds[key] ?? 0) + 1;
  n++;
  for (const b of g.system.bodies) {
    if (b.kind === "home") continue;
    const around = g.system.bodies.find((x) => x.ref === b.orbit.around),
      a = b.orbit.around === g.star.ref ? b.orbit.a : (around?.orbit.a ?? b.orbit.a),
      l =
        bodyLiquid({
          kind: b.kind,
          temperature: b.temperature,
          pressure: b.pressure,
          water: b.water,
          pastFrost: a > g.system.frostLine,
        }).liquid ?? "none";
    bodies[l] = (bodies[l] ?? 0) + 1;
  }
  if (kind === "rocky") continue;
  const band = liquidBand(liquid, KINDS[kind].body.pressure),
    k = g.planet.meanTemperature + 273.15,
    holds = !!band && k * 1.05 > band[0] && k * 0.95 < band[1];
  if (!holds) {
    unstable++;
    console.log(
      `  not liquid: ${seed} ${key} at ${Math.round(k)} K, its scale ${Math.round(g.planet.climate ?? g.planet.meanTemperature)}`,
    );
  }
  if (g.planet.liquid)
    derived.push(
      `${seed}: ${kindFacts(g.planet).name}, ${Math.round(g.planet.meanTemperature)} °C, ${holds ? "liquid there" : "NOT liquid there"}, star ${g.star.ageGyr.toFixed(1)} Gyr, pull ${g.planet.gravity.toFixed(2)} g, ${g.life.species.length} kinds of living thing, ${g.life.people ? "a people" : "no people"}`,
    );
}
console.log(`${n} open worlds, by kind/liquid: ${JSON.stringify(kinds)}`);
console.log(`worlds of a kind whose liquid does not lie liquid where they stand: ${unstable}`);
console.log(`seas of a liquid not their kind's own (${derived.length}):`);
for (const d of derived) console.log(`  ${d}`);
console.log(`liquids on the other bodies' faces: ${JSON.stringify(bodies)}`);
