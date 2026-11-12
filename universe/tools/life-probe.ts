// node tools/life-probe.ts "alien 7" ["alien 29" …]: one world's living things as made (its roles, beasts and people), not run.
import { seedFromText } from "../src/kernel/index.ts";
import { generateHomeWorld } from "../src/gen/index.ts";
import { EARTHLIKE, OPEN } from "../src/rules/index.ts";

const all = process.argv.includes("--dead");
for (const seed of process.argv.slice(2).filter((a) => !a.startsWith("--"))) {
  const t0 = Date.now(),
    g = generateHomeWorld(seedFromText(seed), seed === "first light" ? EARTHLIKE : OPEN, 64),
    ms = Date.now() - t0,
    life = g.life,
    living = life.species.filter((s) => s.died === null);
  console.log(
    `== ${seed}: ${ms} ms, ${life.species.length} lineages (${living.length} living), digest ${g.digest.slice(0, 12)}`,
  );
  for (const s of living)
    if (s.body)
      console.log(
        `  ${s.name} [${s.niche}${s.role ? ` ${s.role}` : ""}] ${s.body.symmetry}${s.body.rays ? `/${s.body.rays}` : ""} legs ${s.body.legs} fins ${s.body.fins} wings ${s.body.wings} arms ${s.body.arms ?? 0}${s.body.grasp ? ` ${s.body.grasp}` : ""} ${s.body.moves} ${s.body.covering} ${s.body.size} kg${s.body.warm ? " warm" : ""} stock ${s.body.stock ?? "-"}`,
      );
    else if (s.niche !== "upright ape")
      console.log(`  ${s.name} [${s.niche}${s.form ? ` ${s.form}` : ""}]`);
  if (all)
    for (const s of life.species)
      if (s.died !== null)
        console.log(`  † ${s.name} [${s.role ?? s.niche}] arose ${s.arose} died ${s.died}`);
  console.log(
    life.people
      ? `  PEOPLE: ${life.people.body.name} (${life.people.body.manipulators} ${life.people.body.limbs}, legs ${life.people.body.legs ?? "-"}, ${life.people.body.medium}, ${life.people.body.size} kg) — ${life.people.because}`
      : `  NO PEOPLE: ${life.noPeople ?? "(none said)"}`,
  );
}
