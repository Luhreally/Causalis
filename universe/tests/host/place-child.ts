// A place saved in one process and gone on with in another (tests/host/place.test.ts): one process shares its module
// caches between a world and its copy, two do not.
//   whole <years>          enter a town, go on a day and a half in one process: its digest and the world's chain
//   first <years> <save>   enter it, go on six hours, save
//   second <save>          load, go on the rest: the same digest and chain as `whole`
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { HOUR, loadWorld, saveWorld, type World } from "../../src/kernel/index.ts";
import { populationContext } from "../../src/sim/index.ts";
import { EARTH } from "../../src/host/index.ts";
import { enterPlace, placeDigest, placesOf } from "../../src/host/place.ts";
import { universeWorld } from "./worlds.ts";

const [mode, a, b] = process.argv.slice(2);

function town(w: World): string {
  const ctx = populationContext(w);
  return ctx.settlements
    .all()
    .filter((s) => ctx.settlements.held(s.ref) && s.population > 300)
    .sort((x, y) => x.population - y.population || (x.ref < y.ref ? -1 : 1))[0]!.ref;
}
function go(w: World, ref: string, hours: number): void {
  for (let h = 0; h < hours; h += 3) {
    w.runTo(w.now + 3 * HOUR);
    enterPlace(w, ref);
  }
}
const told = (w: World, ref: string) =>
  `${placeDigest(placesOf(w)!.get(ref)!)} ${w.checkpoints().at(-1)!.chain}`;

if (mode === "second") {
  const doc = JSON.parse(gunzipSync(readFileSync(a!)).toString("utf8")),
    w = loadWorld(doc, (s) => EARTH.build(s), "r").world,
    ref = placesOf(w)!.places[0]!.town;
  go(w, ref, 30);
  console.log(told(w, ref));
} else {
  // (A copy through a save, as the tests' own: the shared world is never entered.)
  const kept = universeWorld(EARTH, "first light", Number(a)),
    w = loadWorld(
      JSON.parse(JSON.stringify(saveWorld(kept, "r", { universe: "earth" }))),
      (s) => EARTH.build(s),
      "r",
    ).world,
    ref = town(w);
  enterPlace(w, ref);
  // (And given an order: its hands put to other trades, kept in the save with what its land has yet to be told.)
  const c = w.submit("place.work", { town: ref, shares: [300, 100, 500, 100] });
  w.runTo(c.t);
  go(w, ref, 6);
  if (mode === "first")
    writeFileSync(b!, gzipSync(JSON.stringify(saveWorld(w, "r", { universe: "earth" }))));
  else go(w, ref, 30);
  console.log(told(w, ref));
}
