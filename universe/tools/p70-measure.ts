// node tools/p70-measure.ts <file.save> <out.json>: every real landing on a far save, read as the game reads it; and each set
// against the same people at every step of the ladder (no real arrival meets towns on the 31 saves at 3000, so the sweep says what would).
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { hashString, loadWorld, rulesetId, seedFromText } from "../src/kernel/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import { lifeHere } from "../src/host/biochem.ts";
import { folksNear, landfallsOf } from "../src/sim/index.ts";
import { GRIP, affordancesOf, landfallFight, nativeHost } from "../src/rules/index.ts";

const [file, out] = process.argv.slice(2) as [string, string];
const u = file.includes("earth--") ? EARTH : ALIEN;
const doc = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8")) as Parameters<
  typeof loadWorld
>[0];
const probe = u.build(seedFromText(doc.seed));
const world = loadWorld(doc, (s) => u.build(s), rulesetId(probe, u.version), {
  allowRulesetChange: true,
}).world;
const life = lifeHere(world);
const SPAN: Record<string, [number, number]> = {
  camps: [600, 8000],
  villages: [8000, 60000],
  towns: [60000, 500000],
  cities: [400000, 4000000],
  works: [4000000, 40000000],
};
const rows: unknown[] = [];
const started = performance.now();
let reads = 0;
for (const f of folksNear(world))
  for (const l of landfallsOf(world, f, life)) {
    reads++;
    const key = (s: string) => (hashString(`${f.ref} ${l.n} ${s}`) >>> 0) / 4294967296;
    const sweep: Record<string, number> = {};
    for (const stage of Object.keys(SPAN)) {
      let wins = 0;
      for (let i = 0; i < 12; i++) {
        const [lo, hi] = SPAN[stage]!,
          people = lo * (hi / lo) ** key(`${stage} ${i} n`),
          body = affordancesOf(f.body),
          fight = landfallFight(
            l.comers,
            {
              ...l.natives,
              stage,
              people,
              walls: stage === "towns" || stage === "cities" || stage === "works",
              parts: nativeHost(
                stage,
                { manipulators: f.body.manipulators, dexterity: body.dexterity },
                GRIP,
                f.stone.keen,
                !!f.means.edge,
                !!f.means.handCharge,
              ),
            },
            l.reading.sickness.can,
            {
              where: key(`${stage} ${i} w`),
              sickThere: key(`${stage} ${i} s`),
              sickHome: key(`${stage} ${i} h`),
              round: (r, side) => key(`${stage} ${i} ${r} ${side}`),
            },
          );
        if (fight.won) wins++;
      }
      sweep[stage] = wins;
    }
    rows.push({
      seed: doc.seed,
      uni: u.name,
      name: f.name,
      stage: l.natives.stage,
      year: l.arrival.year,
      kind: l.arrival.kind,
      arm: l.comers.parts[0]!.id,
      flesh: l.comers.flesh,
      made: l.comers.made,
      ships: l.ships,
      years: Math.round(l.years),
      people: l.natives.people,
      met: l.fight.fielded[1],
      won: l.fight.won,
      how: l.fight.how,
      dead: l.fight.dead,
      crossed: l.fight.crossed,
      kg: Math.round(f.body.size),
      g: Math.round(f.gravity * 100) / 100,
      air: l.comers.breathes,
      stay: l.stay,
      sweep,
    });
  }
writeFileSync(out, JSON.stringify({ rows, reads, ms: performance.now() - started }));
console.log(`${doc.seed}: ${rows.length} landings`);
process.exit(0);
