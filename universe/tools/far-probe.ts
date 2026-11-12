// node tools/far-probe.ts "alien 7" […]: a world's far peoples as made, their bodies (B4: risen from their own worlds' life
// where the home world's is read from its numbers), and its natives.
import { seedFromText } from "../src/kernel/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import { civKind } from "../src/gen/index.ts";
import { civilizationsEver, farBodies, folksNear } from "../src/sim/index.ts";

for (const seed of process.argv.slice(2)) {
  const t0 = Date.now(),
    world = (seed === "first light" ? EARTH : ALIEN).build(seedFromText(seed)),
    civs = civilizationsEver(world),
    t1 = Date.now(),
    folks = folksNear(world),
    t2 = Date.now();
  console.log(
    `== ${seed}: read bodies ${farBodies(world) === null ? "no" : "yes"}; ${civs.length} far peoples (${t1 - t0} ms with the world), ${folks.length} natives (${t2 - t1} ms)`,
  );
  for (const c of civs)
    console.log(
      `  civ ${c.ref} ${c.clade} ${civKind(c)} (${c.medium}${c.body ? `, legs ${c.body.legs}, ${c.body.size} kg` : ""})`,
    );
  for (const f of folks)
    console.log(
      `  native ${f.ref} ${f.name}: ${f.body.name} (${f.body.clade}, ${f.body.medium}${f.body.legs !== undefined ? `, legs ${f.body.legs}` : ""}) ${f.followed ? "followed" : ""} ceiling ${f.ceiling}`,
    );
}
