// node tools/p72-measure.ts <file.save> <to-year> [--save out.save] [--mid year:out.save] [--off]: a far save forked on, and what became of its realms among the stars. A headless measure of the slice (galaxy-plan.md, Phase 72).
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { YEAR, loadWorld, rulesetId, saveWorld, seedFromText } from "../src/kernel/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import {
  filledOf,
  nationsOf,
  peopleOn,
  politiesOf,
  populationContext,
  seatOf,
  starWarsOf,
  strainNow,
  tradeOf,
} from "../src/sim/index.ts";

const argv = process.argv.slice(2),
  file = argv[0]!,
  to = Number(argv[1]),
  opt = (name: string) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined),
  out = opt("--save"),
  mid = opt("--mid");
const u = file.includes("earth--") ? EARTH : ALIEN;
const doc = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8")) as Parameters<
  typeof loadWorld
>[0];
const probe = u.build(seedFromText(doc.seed));
const world = loadWorld(doc, (s) => u.build(s), rulesetId(probe, u.version), {
  allowRulesetChange: true,
}).world;
const pack = (name: string) =>
  writeFileSync(
    name,
    gzipSync(JSON.stringify(saveWorld(world, rulesetId(world, u.version), { universe: u.name }))),
  );
const from = Math.floor(world.now / YEAR);
let spent = 0,
  worst = 0,
  span = 0,
  spans = 0;
const report = (y: number) => {
  const store = nationsOf(world),
    filled = filledOf(world);
  if (!store || !filled) return;
  const rows = store.all(),
    held = rows.filter((h) => h.holder),
    dark = rows.filter((h) => h.dark),
    nations = store
      .allNations()
      .filter((n) => n.worlds > 0)
      .sort((a, b) => b.worlds - a.worlds);
  console.log(
    `${y}: ${(span / Math.max(1, spans)).toFixed(0)} ms/yr; worlds ${rows.length}, held ${held.length} (taken ${held.filter((h) => h.how === "taken").length}, joined ${held.filter((h) => h.how === "joined").length}), free ${rows.length - held.length}, dark ${dark.length}; realms ${nations.length}, top ${nations
      .slice(0, 6)
      .map((n) => `${n.name} ${n.worlds}/${n.greatest}`)
      .join(
        ", ",
      )}; fallen ${store.allNations().filter((n) => n.fell).length}; wars ${starWarsOf(world).all().length} (for worlds ${
      starWarsOf(world)
        .all()
        .filter((w) => w.at).length
    })`,
  );
  span = 0;
  spans = 0;
};
const started = performance.now();
for (let y = from + 1; y <= to; y++) {
  const a = performance.now();
  world.runTo(y * YEAR);
  const ms = performance.now() - a;
  spent += ms;
  span += ms;
  spans++;
  worst = Math.max(worst, ms);
  if (y % 100 === 0) report(y);
  if (mid && Number(mid.split("@")[0]) === y) pack(mid.split("@")[1]!);
}
const store = nationsOf(world)!,
  ctx = populationContext(world),
  filled = filledOf(world)!;
console.log(
  JSON.stringify({
    seed: doc.seed,
    from,
    to,
    meanYearMs: Math.round(spent / Math.max(1, to - from)),
    worstMs: Math.round(worst),
    wall: Math.round(performance.now() - started),
    first: store.first,
    runs: tradeOf(world)?.all().length,
    open: tradeOf(world)?.open().length,
  }),
);
for (const n of store
  .allNations()
  .sort((a, b) => b.greatest - a.greatest)
  .slice(0, 14)) {
  const seat = seatOf(ctx, n),
    mine = store.all().filter((h) => h.holder === n.ref);
  let worstStrain = 0,
    worstAnswer = 0;
  for (const h of mine) {
    const w = filled.get(h.key);
    if (!w) continue;
    const s = strainNow(ctx, h, w, n, seat, to);
    worstStrain = Math.max(worstStrain, s.strain.total);
    worstAnswer = Math.max(worstAnswer, s.way.answer);
  }
  console.log(
    `  ${n.name} ${n.ref} ${n.realm ? (politiesOf(world).get(n.realm)?.ended ?? "alive") : "far"}: now ${n.worlds}, most ${n.greatest} in ${n.greatestYear}, lost ${n.lost.length}, fell ${n.fell?.year ?? "-"}, drive ${seat.drive?.id ?? "-"} lanes ${seat.lanes} fleet ${seat.fleet} hold ${seat.hold} worst answer ${worstAnswer.toFixed(0)} strain ${worstStrain.toFixed(2)}`,
  );
}
const darks = store.all().filter((h) => h.dark);
for (const h of darks.slice(0, 8)) {
  const w = filled.get(h.key)!;
  console.log(
    `  dark ${h.key} since ${h.dark!.since} poor ${h.dark!.poor}: ${h.dark!.before} then, ${peopleOn(ctx, w)} now`,
  );
}
const events = (t: string) => {
  let n = 0;
  for (let i = 0; i < world.events.count; i++) if (world.events.at(i).type === t) n++;
  return n;
};
console.log(
  [
    "nation.left",
    "nation.first-left",
    "nation.joined",
    "nation.taken",
    "nation.greatest",
    "nation.fell",
    "nation.dark",
    "nation.first-dark",
  ]
    .map((t) => `${t} ${events(t)}`)
    .join("; "),
);
if (out) {
  pack(out);
  console.log("saved", out, readFileSync(out).length);
}
