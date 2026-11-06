// node tools/z1-tally.ts <file.save | seed text> <earth|alien> <to-year> [step]: gate 100's tally, a whole world run on: its creatures by century, how far they go through a
// year and how far their middle has moved, beasts known by century and how they ended, herds taken in war and what the land lost, kinds new and gone, what its people ate, its
// age and people by year, and what a year costs. A save from before these rules loads with all of it empty.
import { existsSync, readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { YEAR, loadWorld, rulesetId, seedFromText, type World } from "../src/kernel/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import { herdsOf, homePlanet, populationContext } from "../src/sim/index.ts";
import { landHerds, herdPass } from "../src/host/inspect/herds.ts";

const [what, universe, toArg, stepArg] = process.argv.slice(2),
  U = universe === "earth" ? EARTH : ALIEN,
  to = Number(toArg ?? 1000),
  step = Number(stepArg ?? 100);
let world: World;
if (existsSync(what!)) {
  const doc = JSON.parse(gunzipSync(readFileSync(what!)).toString("utf8"));
  world = loadWorld(doc, (s) => U.build(s), rulesetId(U.build(seedFromText(doc.seed)), U.version), {
    allowRulesetChange: true,
  }).world;
} else world = U.build(seedFromText(what!));
const ctx = populationContext(world),
  g = homePlanet(world).generated,
  from = Math.floor(world.now / YEAR);
console.log(
  `${what} ${universe}: from ${from} to ${to}; kind ${(U.queries["world.stage"]!(world, {}) as { id?: string })?.id}; lands ${g.offworld.base}; medium ${ctx.medium}; begun ${herdsOf(world)?.begun}`,
);
const stage = () => (U.queries["world.stage"]!(world, {}) as { id?: string })?.id ?? "?";
const costs: number[] = [];
const mark = {
  known: 0,
  ended: 0,
  driven: 0,
  head: 0,
  newKinds: 0,
  goneKinds: 0,
  tamed: 0,
  emptied: 0,
  fallen: 0,
};
let centre: [number, number, number] | null = null;
const read = (y: number) => {
  const store = herdsOf(world),
    P = g.grid.positions;
  let lands = 0,
    sum = 0,
    x = 0,
    yy = 0,
    z = 0,
    none = 0;
  if (store?.begun)
    for (let c = 0; c < g.offworld.base; c++) {
      const s = store.stock[c]!;
      if (store.most[c]! <= 0) continue;
      lands++;
      sum += s;
      if (s < 3) none++;
      x += P[3 * c]! * s;
      yy += P[3 * c + 1]! * s;
      z += P[3 * c + 2]! * s;
    }
  const l = Math.sqrt(x * x + yy * yy + z * z) || 1,
    now: [number, number, number] = [x / l, yy / l, z / l],
    R = 6371 * g.planet.radius,
    drift =
      centre && sum > 0
        ? Math.round(
            Math.acos(Math.min(1, now[0] * centre[0] + now[1] * centre[1] + now[2] * centre[2])) *
              R,
          )
        : 0;
  if (!centre && sum > 0) centre = now;
  let people = 0,
    fed = 0;
  for (const p of ctx.provinces.all()) {
    people += p.total();
    fed += (p.fed / 1000) * p.total();
  }
  const t = store?.tally,
    alive = store?.beasts().length ?? 0;
  console.log(
    `${String(y).padStart(5)} ${stage().padEnd(12)} people ${Math.round(people / 1000)}k fed ${people ? (fed / people).toFixed(3) : "-"} | herds ${lands} lands, mean ${lands ? Math.round(sum / lands) : 0}, none ${none}, middle moved ${drift} km | known +${(t?.known ?? 0) - mark.known} ended +${(t?.knownEnded ?? 0) - mark.ended} at large ${alive} fallen +${(t?.fallen ?? 0) - mark.fallen} | driven +${(t?.driven ?? 0) - mark.driven} head +${(t?.head ?? 0) - mark.head} (now ${store?.driven.size ?? 0}) | kinds new +${(t?.newKinds ?? 0) - mark.newKinds} gone +${(t?.goneKinds ?? 0) - mark.goneKinds} tame +${(t?.tamed ?? 0) - mark.tamed} | emptied +${(t?.emptied ?? 0) - mark.emptied} | events ${world.events.count}`,
  );
  if (t) {
    mark.known = t.known;
    mark.ended = t.knownEnded;
    mark.driven = t.driven;
    mark.head = t.head;
    mark.newKinds = t.newKinds;
    mark.goneKinds = t.goneKinds;
    mark.tamed = t.tamed;
    mark.emptied = t.emptied;
    mark.fallen = t.fallen;
  }
};
for (let y = from; y <= to;) {
  read(y);
  const next = Math.min(to, y + step);
  if (next === y) break;
  for (let yy = y + 1; yy <= next; yy++) {
    const b = performance.now();
    world.runTo(yy * YEAR);
    costs.push(performance.now() - b);
  }
  y = next;
}
read(to);
const sorted = [...costs].sort((a, b) => a - b),
  store = herdsOf(world)!;
console.log(
  `a year: median ${Math.round(sorted[Math.floor(sorted.length / 2)] ?? 0)} ms, 95th ${Math.round(sorted[Math.floor(sorted.length * 0.95)] ?? 0)} ms; store's save ${JSON.stringify(store.save()).length} bytes; ${store.known.length} known, ${store.kinds.length} new kinds, ${store.gone.length} gone, ${store.tame.length} tame`,
);
// How far they go: each land's way through, across the world.
let routes = 0,
  still = 0,
  shown = 0;
const a = performance.now();
for (let c = 0; c < g.offworld.base && routes < 400; c++) {
  if (store.stock[c]! < 3) continue;
  const p = herdPass(world, c);
  routes++;
  if (p.still) still++;
  shown += landHerds(world, c).herds.length;
}
console.log(
  `of ${routes} lands read: ${still} stay the year round; ${(shown / Math.max(1, routes)).toFixed(2)} kinds drawn a land; ${((performance.now() - a) / Math.max(1, routes)).toFixed(2)} ms to read a land`,
);
process.exit(0);
