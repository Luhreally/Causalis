// node tools/f5-tally.ts [--saves dir] [seed...]: the whys of the tree of what can be done (F5) tallied over worlds, no years run: how many
// sentences come out, for what is shut and for what is odd, and on how many worlds each. Given a folder of far saves, whether a world's history
// ever did what its making's reading calls shut, and what the page costs to open.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { loadWorld, rulesetId, seedFromText } from "../src/kernel/index.ts";
import { generateHomeWorld, provinceWorld, worldKindOf } from "../src/gen/index.ts";
import { canWorldOf } from "../src/host/can.ts";
import { canPage } from "../src/host/inspect/can.ts";
import { pageOf } from "../src/host/inspect/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import {
  EARTHLIKE,
  OPEN,
  PRINCIPLES,
  causesOf,
  oddNumbers,
  openSteps,
  ownRoadOf,
  readCan,
  whyShut,
} from "../src/rules/index.ts";
import { loreOf, populationContext, spreadOf } from "../src/sim/index.ts";

const argv = process.argv.slice(2),
  at = argv.indexOf("--saves"),
  saves = at >= 0 ? argv[at + 1]! : null,
  named = argv.filter((a, i) => a !== "--saves" && i !== at + 1);
const LIST = [
  "alien 41",
  "cinder 570",
  "cinder 671",
  "cinder 792",
  "ember 582",
  "gale 710",
  "harrow 259",
  "harrow 348",
  "kestrel 557",
  "lumen 285",
  "lumen 433",
  "marrow 145",
  "marrow 266",
  "north 292",
  "north 495",
  "osier 692",
  "osier 855",
  "quill 742",
  "thistle 643",
  "vale 471",
  "vale 496",
  "wren 113",
];
const EARTHS = ["first light", "tide 207", "amber 101"];
const seeds: [string, boolean][] = named.length
  ? named.map((s) => [s, false])
  : [
      ...LIST.map((s): [string, boolean] => [s, false]),
      ...EARTHS.map((s): [string, boolean] => [s, true]),
      ...Array.from({ length: 40 }, (_, i): [string, boolean] => [`tally ${i}`, false]),
    ];

const shut = new Map<string, Set<string>>(),
  odd = new Map<string, Set<string>>(),
  heads = new Map<string, Set<string>>(),
  kinds = new Map<string, number>();
const tally = (m: Map<string, Set<string>>, words: string, seed: string) => {
  let s = m.get(words);
  if (!s) m.set(words, (s = new Set()));
  s.add(seed);
};
let lifeless = 0,
  unpeopled = 0,
  bad = 0;
const t0 = performance.now();
for (const [seed, earth] of seeds) {
  const fine = generateHomeWorld(seedFromText(seed), earth ? EARTHLIKE : OPEN),
    g = provinceWorld(fine),
    w = canWorldOf(g, fine.life.people ? spreadOf(g, seed).lands.map(([c]) => c) : [], true),
    open = openSteps(w),
    read = readCan(w, open, () => false),
    kind = `${worldKindOf(fine)}${fine.life.people ? `, ${w.medium}` : fine.life.species.length ? ", no people" : ", lifeless"}`;
  kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
  if (!fine.life.species.length) lifeless++;
  if (!fine.life.people) unpeopled++;
  for (const p of PRINCIPLES)
    if (open.has(p.id) === (whyShut(p.id, w, open) !== null)) {
      bad++;
      console.log(`  DISAGREE ${seed} ${p.id}`);
    }
  for (const f of read) {
    tally(heads, `${f.icon} ${f.top ? f.top.name : "shut"}`, seed);
    for (const r of f.rungs) if (r.why) tally(shut, r.why, seed);
  }
  const causes = causesOf(w, open);
  for (const c of causes) tally(odd, c.words, seed);
  for (const n of oddNumbers(w, new Set(causes.map((c) => c.key)))) tally(odd, n.words, seed);
  if (named.length) {
    console.log(`\n${seed}: ${kind}; ${open.size} open`);
    for (const c of causes.slice(0, 4)) console.log(`  cause (${c.steps.length}): ${c.words}`);
    console.log(`  own: ${ownRoadOf(open).join(", ")}`);
    for (const f of read) {
      console.log(`  ${f.icon} ${f.name}: ${f.words}`);
      for (const r of f.rungs)
        if (r.state === "shut")
          console.log(`     x ${r.name}${r.figure ? ` (${r.figure})` : ""}: ${r.why}`);
    }
  }
}
const say = (title: string, m: Map<string, Set<string>>, most: number) => {
  const all = [...m].sort((a, b) => b[1].size - a[1].size);
  console.log(
    `\n${title}: ${all.length} sentences over ${seeds.length} worlds; on every world: ${all.filter(([, s]) => s.size === seeds.length).length}`,
  );
  for (const [w, s] of all.slice(0, most)) console.log(`  ${s.size}x  ${w.slice(0, 170)}`);
  for (const [w, s] of all.slice(-6)) console.log(`  ${s.size}x  ${w.slice(0, 170)}`);
};
console.log(
  `\n${seeds.length} worlds read in ${Math.round(performance.now() - t0)} ms; ${unpeopled} with no people, ${lifeless} lifeless; ${bad} where whether and why disagree`,
);
console.log([...kinds].map(([k, n]) => `${n} ${k}`).join("; "));
say("What is shut says", shut, 12);
say("What is odd says", odd, 12);
say("Each function's best", heads, 10);

// Far saves: what history did against what a world's making reads, and what opening costs.
if (saves)
  for (const file of [
    "alien--vale_471--1500.save",
    "alien--gale_710--1500.save",
    "alien--kestrel_557--1500.save",
    "alien--quill_742--1500.save",
  ]) {
    const path = join(saves, "w2-list-out", file);
    if (!existsSync(path)) continue;
    const doc = JSON.parse(gunzipSync(readFileSync(path)).toString("utf8")) as Parameters<
        typeof loadWorld
      >[0],
      probe = ALIEN.build(seedFromText(doc.seed)),
      world = loadWorld(doc, (s) => ALIEN.build(s), rulesetId(probe, ALIEN.version), {
        allowRulesetChange: true,
      }).world;
    far(world, file);
  }
if (saves) {
  const path = join(saves, "p68/earth-out/earth--first_light--1500.save");
  if (existsSync(path)) {
    const doc = JSON.parse(gunzipSync(readFileSync(path)).toString("utf8")) as Parameters<
        typeof loadWorld
      >[0],
      probe = EARTH.build(seedFromText(doc.seed)),
      world = loadWorld(doc, (s) => EARTH.build(s), rulesetId(probe, EARTH.version), {
        allowRulesetChange: true,
      }).world;
    far(world, "first light at 1500");
  }
}
function far(world: Parameters<typeof pageOf>[0], name: string) {
  const ctx = populationContext(world),
    g = ctx.generated as ReturnType<typeof provinceWorld>,
    first = spreadOf(g, world.seed.text).lands.map(([c]) => c),
    w = canWorldOf(g, first, true),
    open = openSteps(w),
    lore = loreOf(world),
    against = new Set<string>();
  for (const p of ctx.provinces.all())
    for (const [id] of lore.of(p.cell)) if (!open.has(id)) against.add(id);
  const a = performance.now();
  const opened = canPage(world);
  const b = performance.now();
  pageOf(world, "world:can");
  const c = performance.now();
  const peopled = ctx.provinces.all().filter((p) => p.total() > 0).length;
  console.log(
    `\n${name}: ${peopled} peopled lands; read from its first lands, ${open.size} open; history went past that on ${against.size}: ${[...against].join(", ")}; ${opened.kind} page ${Math.round(b - a)} ms first, ${Math.round(c - b)} ms again`,
  );
}
process.exit(0);
