// node tools/kinds-probe.ts [seed="alien 20"] [years=300] [every=50] — one open world run on, read
// for its kind (Phase 56): what kind it is and whether the hand made it so, its liquid and its
// warmth in true degrees and in its liquid's, whether anything burns; then every so many years its
// people, its lands' ages and its towns; at the end the ages its world reached and the firsts that
// brought them, each with its year (its kind's own road among them: diamond grit, ice cut and set,
// sun engines). A rocky world is read the same way, for its twin ("alien 20 ~carbon oxygen").
import { YEAR, seedFromText } from "../src/kernel/index.ts";
import { ALIEN } from "../src/host/planet.ts";
import { landEra } from "../src/host/village.ts";
import { stageOf, worldFirstsNow } from "../src/host/inspect/stage.ts";
import { climateMean, worldKindOf } from "../src/gen/index.ts";
import { OCC, kindFacts, makingsOf } from "../src/rules/index.ts";
import { kindBlocks } from "../src/host/kinds.ts";
import { lifeBlock } from "../src/host/biochem.ts";
import { landWords } from "../src/causal/index.ts";
import { homePlanet, populationContext } from "../src/sim/index.ts";

const seed = process.argv[2] ?? "alien 20",
  years = Number(process.argv[3] ?? 300),
  every = Number(process.argv[4] ?? 50),
  started = performance.now(),
  world = ALIEN.build(seedFromText(seed)),
  g = homePlanet(world).generated,
  kind = worldKindOf(g),
  facts = kindFacts(g.planet),
  made = makingsOf(seed),
  ctx = populationContext(world),
  l = facts.liquid;
const c = (k: number) => `${Math.round(k - 273.15)} °C`;
console.log(
  `${seed}: ${facts.icon} ${facts.name}, ${made.carbon || made.volatiles ? "made so by the hand" : "as its seed falls"}`,
);
console.log(
  `  its liquid ${l.name}, between ${c(l.freezeK)} and ${c(l.boilK)}; ${Math.round(g.planet.meanTemperature)} °C on average (${Math.round(climateMean(g.planet))} on its liquid's scale)`,
);
console.log(
  `  ${facts.burns ? "fire burns in its air" : "nothing burns in its air"}; its people of the ${ctx.medium}${g.life.people ? "" : ": none rose"}; fire for them ${ctx.affords.fire}`,
);
for (let y = every; y <= years; y += every) {
  world.runTo(y * YEAR);
  const now = populationContext(world),
    eras: Record<string, number> = {};
  let people = 0;
  for (const p of now.provinces.all()) {
    if (!p.total()) continue;
    people += p.total();
    const era = landEra(world, p.cell);
    eras[era] = (eras[era] ?? 0) + 1;
  }
  console.log(
    `  year ${y}: ${people} people, ${now.settlements.all().length} towns; lands by age ${JSON.stringify(eras)} (${((performance.now() - started) / 1000).toFixed(0)} s)`,
  );
}
const stage = stageOf(world);
console.log(
  `  its ages: ${stage.stages
    .filter((s) => s.year !== null)
    .map((s) => `${s.icon} ${s.name} ${s.year}`)
    .join(", ")}; now ${stage.icon} ${stage.name}`,
);
console.log(
  `  its firsts: ${worldFirstsNow(world)
    .map((f) => `${f.what} ${f.year}`)
    .join(", ")}`,
);

// Its people's living, and its pages as they read (the kind's own block, its life's, and a land's ground in words).
{
  const now = populationContext(world),
    lands = now.provinces.all().filter((p) => p.total() > 0),
    occ = (o: number) => lands.reduce((a, p) => a + p.occupation(o), 0),
    plain = (x: unknown): string =>
      typeof x === "string"
        ? x
        : Array.isArray(x)
          ? x.map(plain).join("")
          : x && typeof x === "object"
            ? plain(
                (x as { text?: unknown; value?: unknown; label?: unknown }).text ?? [
                  (x as { label?: unknown }).label ?? "",
                  ": ",
                  (x as { value?: unknown }).value ?? "",
                ],
              )
            : "";
  console.log(
    `  its people: ${lands.reduce((a, p) => a + p.total(), 0)} on ${lands.length} lands; farmers ${occ(OCC.farmer)}, foragers ${occ(OCC.forager)}, herders ${occ(OCC.herder)}, crafters ${occ(OCC.crafter)}; lands that farm ${lands.filter((p) => p.knowsCultivation).length}; fire for them ${now.affords.fire}`,
  );
  for (const b of [...kindBlocks(world), lifeBlock(world)]) {
    const rows = (b as { rows?: unknown[] }).rows ?? [];
    console.log(`  page “${(b as { title?: string }).title ?? ""}”`);
    for (const r of rows) console.log(`    ${plain(r)}`.slice(0, 330));
  }
  if (lands[0]) console.log(`  a land: ${landWords(world, lands[0].ref)}`);
}
