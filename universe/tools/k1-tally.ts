// node tools/k1-tally.ts <earth|alien> <seed> <save|-> <to> [--report]: what was lost, by century, why, how long until it came back and from where, what's
// lost to the world at each age, what's kept in archives and what was found again. Forks a far save, or runs a young world from nothing.
import { readFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import * as k from "../src/kernel/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import { loreOf, lostOf, populationContext } from "../src/sim/index.ts";
import { PRINCIPLE_DEPTH } from "../src/rules/index.ts";

const [uni, seed, file, toArg] = process.argv.slice(2),
  U = uni === "earth" ? EARTH : ALIEN,
  to = Number(toArg);
const world =
  file && file !== "-"
    ? k.loadWorld(
        JSON.parse(gunzipSync(readFileSync(file)).toString()),
        U.build,
        k.rulesetId(U.build(k.seedFromText(seed!)), U.version),
        { allowRulesetChange: true },
      ).world
    : U.build(k.seedFromText(seed!));
const from = Math.floor(world.now / k.YEAR),
  ctx = () => populationContext(world);
const lore = loreOf(world),
  store = lostOf(world);
const countLand = () => {
  let lands = 0,
    known = 0;
  for (const p of ctx().provinces.all()) {
    if (p.total() > 0) lands++;
    known += lore.sizeOf(p.cell);
  }
  return { lands, known };
};
const seenAt = new Set<string>();
const started = performance.now();
let lostEvents = 0,
  emptied = 0;
const byCentury = new Map<number, { lands: Set<number>; crafts: number }>(),
  byWhy = new Map<string, number>(),
  byCraft = new Map<string, number>(),
  backs: number[] = [],
  backHow = new Map<string, number>(),
  worldLost: string[] = [];
for (let y = from + 1; y <= to; y += 10) {
  world.runTo(Math.min(to, y + 9) * k.YEAR);
  const year = Math.min(to, y + 9);
  for (const l of [...store.allOpen(), ...store.closed]) {
    const key = `${l.cell}:${l.id}:${l.year}`;
    if (seenAt.has(key)) continue;
    seenAt.add(key);
    lostEvents++;
    const c = Math.floor(l.year / 100) * 100,
      b = byCentury.get(c) ?? { lands: new Set<number>(), crafts: 0 };
    b.lands.add(l.cell);
    b.crafts++;
    byCentury.set(c, b);
    byWhy.set(l.why, (byWhy.get(l.why) ?? 0) + 1);
    byCraft.set(l.id, (byCraft.get(l.id) ?? 0) + 1);
    if (l.why === "emptied") emptied++;
  }
  void year;
}
for (const l of store.closed) {
  backs.push(l.back!.year - l.year);
  backHow.set(l.back!.how, (backHow.get(l.back!.how) ?? 0) + 1);
}
for (const w of store.worldLosses())
  worldLost.push(`${w.id}@${w.year}(d${PRINCIPLE_DEPTH.get(w.id)})`);
const sorted = [...backs].sort((a, b) => a - b);
const { lands, known } = countLand();
console.log(
  `${seed} ${from}->${to} [${((performance.now() - started) / 1000).toFixed(0)} s] lands ${lands}, known ${known}, losses ${lostEvents}, emptied ${emptied}, open ${store.allOpen().length}, closed ${store.closed.length}`,
);
console.log(
  `  by century: ${[...byCentury]
    .sort((a, b) => a[0] - b[0])
    .map(([c, b]) => `${c}:${b.lands.size}/${b.crafts}`)
    .join(" ")}`,
);
console.log(
  `  why: ${[...byWhy]
    .sort((a, b) => b[1] - a[1])
    .map(([w, n]) => `${w} ${n}`)
    .join(", ")}`,
);
console.log(
  `  most lost: ${[...byCraft]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([w, n]) => `${w} ${n}`)
    .join(", ")}`,
);
console.log(
  `  back: ${backs.length}, median ${sorted[sorted.length >> 1] ?? "-"}, least ${sorted[0] ?? "-"}, most ${sorted.at(-1) ?? "-"}; how: ${[...backHow].map(([w, n]) => `${w} ${n}`).join(", ")}`,
);
console.log(
  `  lost to the world now: ${worldLost.join(", ") || "none"}; found again: ${store.foundAgain.map((w) => `${w.id} ${w.year}->${w.found!.year}`).join(", ") || "none"}`,
);
console.log(
  `  archives: ${store.archives.length}, live ${store.liveArchives().length}, holding ${store.archives.reduce((n, a) => n + a.crafts.length, 0)}, read ${store.archives.reduce((n, a) => n + a.read.length, 0)}; forms ${[...new Set(store.archives.map((a) => a.form))].join(",")}`,
);
if (process.argv.includes("--report")) {
  const chunk = JSON.stringify(store.save());
  console.log(`  store's json: ${chunk.length} bytes, gz ${gzipSync(chunk).length}`);
}
process.exit(0);
