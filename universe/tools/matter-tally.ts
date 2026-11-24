// node tools/matter-tally.ts <earth|alien> <seed> <to> [out.json]: a young world run from nothing by tens to a year, for the
// gaps round on goods and what can be known: when each principle was first found (the order of finding), when the seeds of
// sickness and vaccination came and to how many lands, the year its people's numbers took off, and what filled its fuel
// slot (kinds drawn and burned, by decade). Writes the numbers as JSON where a file is named, for an A/B.
import { writeFileSync } from "node:fs";
import * as k from "../src/kernel/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import { energyBooks, loreOf, marketsOf, populationContext } from "../src/sim/index.ts";
import { BLENDED, BLEND_WHOLE, G, PRINCIPLES, keptLife } from "../src/rules/index.ts";

const [uni, seedArg, toArg, out] = process.argv.slice(2),
  U = uni === "earth" ? EARTH : ALIEN,
  seed = seedArg!.startsWith("kept:") ? keptLife(seedArg!.slice(5)) : seedArg!,
  to = Number(toArg);
const world = U.build(k.seedFromText(seed)),
  lore = loreOf(world),
  ctx = () => populationContext(world),
  first = new Map<string, number>(),
  pops: [number, number][] = [],
  started = performance.now();
const fuels: Record<string, number>[] = [];
/** The fuel slot as it stood in a year: who cut or gathered, what was burned of it, what crossed a border, what it fetched. */
function fuelLine(y: number): void {
  const books = energyBooks(world),
    markets = marketsOf(world),
    wood = BLENDED.indexOf("wood");
  let gatherers = 0,
    gathered = 0,
    burners = 0,
    cut = 0,
    own = 0,
    coal = 0,
    felled = 0,
    wanted = 0,
    holders = 0,
    woodStock = 0,
    stock = 0,
    price = 0,
    priced = 0;
  for (const e of books?.all() ?? []) {
    if (e.gathered > 0) gatherers++;
    gathered += e.gathered;
    if (e.cut > 0) burners++;
    cut += e.cut / 4;
    own += e.own / 4;
    coal += e.coal / 4;
    felled += e.felled / 4;
    wanted += e.fuelWanted / 4;
  }
  for (const m of markets.all()) {
    const n = m.stock[G.coal]!;
    stock += n;
    if (n > 0 && m.blend[wood]! > 0) {
      holders++;
      woodStock += (n * m.blend[wood]!) / BLEND_WHOLE;
    }
    if (n > 0) {
      price += m.price[G.coal]!;
      priced++;
    }
  }
  const flows = markets.flows.filter((f) => f.good === G.coal),
    carried = flows.reduce((s, f) => s + f.count, 0),
    row = {
      y,
      gatherers,
      gathered,
      burners,
      cut: Math.round(cut),
      own: Math.round(own),
      coal: Math.round(coal),
      felled: Math.round(felled),
      wanted: Math.round(wanted),
      holders,
      woodStock: Math.round(woodStock),
      stock,
      flows: flows.length,
      carried,
      price: priced ? Math.round((100 * price) / priced) / 100 : 0,
      miners: lore.landsKnowing("coal-mining"),
    };
  fuels.push(row);
  console.log(
    `  fuel y${y}: ${gatherers} lands put ${gathered} units in the solid class past any seam; ${burners} burned ${row.cut} units of market wood, ${row.own} of their world's own, ${row.coal} of coal; felled ${row.felled}, still wanted ${row.wanted}; ${holders} markets hold ${row.woodStock} of wood in ${stock}; ${flows.length} flows carried ${carried}; mean price ${row.price}; coal-mining in ${row.miners} lands`,
  );
}
for (let y = 10; y <= to; y += 10) {
  world.runTo(y * k.YEAR);
  let people = 0;
  for (const p of ctx().provinces.all()) people += p.total();
  pops.push([y, people]);
  for (const p of PRINCIPLES)
    if (!first.has(p.id) && lore.landsKnowing(p.id) > 0) {
      let at = y;
      for (const c of lore.knowers(p.id)) at = Math.min(at, lore.get(c, p.id)!.year);
      first.set(p.id, at);
    }
  if (y % 100 === 0) fuelLine(y);
  if (y % 100 === 0)
    console.log(
      `y${y}: ${people} people, ${first.size} principles found, germs in ${lore.landsKnowing("germs")} lands, vaccines in ${lore.landsKnowing("vaccines")} [${((performance.now() - started) / 1000).toFixed(0)} s]`,
    );
}
// The take-off: the first decade from which its people grow by half a part in a hundred a year, or more, over the fifty years after.
let takeoff: number | null = null;
for (let i = 0; i + 5 < pops.length; i++) {
  const [y, a] = pops[i]!,
    b = pops[i + 5]![1];
  if (y >= 200 && a > 0 && Math.pow(b / a, 1 / 50) - 1 >= 0.005) {
    takeoff = y;
    break;
  }
}
// (And the first decade its people pass twice what they were at year 600, a second reading of the same turn.)
const at600 = pops.find(([y]) => y === 600)?.[1] ?? 0,
  doubled = pops.find(([y, n]) => y > 600 && at600 > 0 && n >= 2 * at600)?.[0] ?? null;
const order = [...first].sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1));
console.log(`${seedArg} to ${to}: take-off ${takeoff}, doubled since 600 by ${doubled}`);
console.log(
  `  healing: ${["herbalism", "medicine", "sanitation", "germs", "vaccines", "quarantine"].map((id) => `${id} ${first.get(id) ?? "-"}`).join(", ")}`,
);
console.log(`  order: ${order.map(([id, y]) => `${id}@${y}`).join(" ")}`);
if (out)
  writeFileSync(
    out,
    JSON.stringify({
      seed: seedArg,
      to,
      takeoff,
      doubled,
      first: Object.fromEntries(first),
      pops,
      fuels,
    }),
  );
