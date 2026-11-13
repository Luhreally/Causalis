// node tools/signals-probe.ts <seed> [years=1500] [every=100] — signals and the known world (docs/architecture/first-principles-plan.md, "Signals"):
// one world run on, read every so many years for the shape of its history (people, realms and their sizes, wars) and its
// markets (how far a good's price stands apart between neighbouring lands), and at the end the year each signal step and
// each step of the sky first came, each century's run time, and what of its world's surface its people know. A seed
// "earth:<text>" is Earth's prior, any other the open. Pure reading; it changes nothing. It runs on a commit without the
// signal steps too (what is missing reads as null), so the same worlds can be compared before and after.
import { YEAR, seedFromText } from "../src/kernel/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import { stageOf } from "../src/host/inspect/stage.ts";
import { GOODS, G } from "../src/rules/index.ts";
import {
  homePlanet,
  loreOf,
  marketsOf,
  politiesOf,
  populationContext,
  warsOf,
} from "../src/sim/index.ts";

const arg = process.argv[2] ?? "earth:first light",
  years = Number(process.argv[3] ?? 1500),
  every = Number(process.argv[4] ?? 100),
  earth = arg.startsWith("earth:"),
  text = earth ? arg.slice(6) : arg,
  world = (earth ? EARTH : ALIEN).build(seedFromText(text)),
  g = homePlanet(world).generated;

const STEPS = [
  "writing",
  "railways",
  "electricity",
  "sea-electricity",
  "graphite-dynamos",
  "ground-dynamos",
  "polymer-wire",
  "electronics",
  "telegraph",
  "telephone",
  "radio",
  "sea-sound",
  "computing",
  "hand-sets",
  "solid-state",
  "networks",
  "pocket-machines",
  "powered-wings",
  "orbital-flight",
];

/** The spread of a good's price between neighbouring peopled lands: the mean of |log(a/b)| over every pair. */
function spread(good: number): number | null {
  const markets = marketsOf(world),
    ctx = populationContext(world);
  let sum = 0,
    n = 0;
  for (const p of ctx.provinces.all()) {
    if (!p.total()) continue;
    const a = p.cell,
      ma = markets.get(a);
    if (!ma) continue;
    for (let k = g.grid.offsets[a]!; k < g.grid.offsets[a + 1]!; k++) {
      const b = g.grid.neighbours[k]!;
      if (b <= a || !ctx.provinces.get(b)?.total()) continue;
      const mb = markets.get(b);
      if (!mb) continue;
      sum += Math.abs(Math.log(ma.price[good]! / mb.price[good]!));
      n++;
    }
  }
  return n ? Math.round((1000 * sum) / n) / 1000 : null;
}

// (The readings of the signal steps and the known world, where this commit has them.)
const signals = await import("../src/rules/signals.ts").catch(() => null);
const known = await import("../src/host/known.ts").catch(() => null);

const started = performance.now(),
  centuries: number[] = [],
  shape: unknown[] = [];
for (let y = every; y <= years; y += every) {
  const c0 = performance.now();
  world.runTo(y * YEAR);
  centuries.push(Math.round(performance.now() - c0));
  const ctx = populationContext(world),
    realms = politiesOf(world).living(),
    sizes = realms.map((r) => r.members.length).sort((a, b) => b - a);
  let people = 0,
    peopled = 0;
  for (const p of ctx.provinces.all())
    if (p.total()) {
      people += p.total();
      peopled++;
    }
  shape.push({
    year: y,
    people,
    peopled,
    realms: realms.length,
    biggest: sizes.slice(0, 3),
    wars: warsOf(world).all().length,
    grain: spread(G.grain),
    tools: spread(G.tools),
    ...(known ? { knownShare: known.knownShare(world) } : {}),
  });
  console.error(`  ${arg} year ${y} (${((performance.now() - started) / 1000).toFixed(0)} s)`);
}
const lore = loreOf(world),
  ctx = populationContext(world),
  first: Record<string, number | null> = {};
for (const id of STEPS) {
  let best: number | null = null;
  for (const p of ctx.provinces.all()) {
    const k = lore.get(p.cell, id);
    if (k && (best === null || k.year < best)) best = k.year;
  }
  // (And lands no longer peopled that knew it.)
  for (let c = 0; c < g.grid.offsets.length - 1; c++) {
    const k = lore.get(c, id);
    if (k && (best === null || k.year < best)) best = k.year;
  }
  first[id] = best;
}
// A few lands' connectivity and delay: the most peopled.
const lands = ctx.provinces
  .all()
  .filter((p) => p.total())
  .sort((a, b) => b.total() - a.total() || a.cell - b.cell)
  .slice(0, 5)
  .map((p) => ({
    cell: p.cell,
    people: p.total(),
    ...(signals
      ? (() => {
          const knows = (id: string) => !!lore.get(p.cell, id),
            pace = signals.wordPace(knows, ctx.medium);
          return {
            connectivity:
              Math.round(100 * signals.connectivityOf(lore.effect(p.cell, "signal" as never))) /
              100,
            word1000km: pace.words,
            infoWork:
              Math.round(
                1000 *
                  signals.infoShare(signals.connectivityOf(lore.effect(p.cell, "signal" as never))),
              ) / 1000,
          };
        })()
      : {}),
  }));
console.log(
  JSON.stringify({
    seed: arg,
    years,
    centuries,
    msAYear: Math.round(centuries.reduce((a, b) => a + b, 0) / years),
    lateMsAYear: Math.round(centuries.slice(-3).reduce((a, b) => a + b, 0) / (3 * every)),
    first,
    lands,
    ...(known ? { knownAtOrbit: known.knownAtOrbit(world) } : {}),
    ages: Object.fromEntries(
      stageOf(world)
        .stages.filter((x) => x.year !== null)
        .map((x) => [x.name, x.year]),
    ),
    shape,
    goods: GOODS.length,
  }),
);
process.exit(0);
