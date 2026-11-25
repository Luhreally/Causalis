// How a town entered is run, saved in one process and gone on with in another (tests/host/place-modes.test.ts): one
// process shares its module caches between a world and its copy, two do not.
//   whole <years> <mode>          enter a town, choose the way it is run, go on four days in one process
//   first <years> <mode> <save>   enter it, choose, go on a day, save
//   second <save>                 load, go on the rest: the same way, the same place and the same world as `whole`
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { HOUR, loadWorld, saveWorld, type World } from "../../src/kernel/index.ts";
import { populationContext } from "../../src/sim/index.ts";
import { EARTH } from "../../src/host/index.ts";
import { placeDigest, placesOf } from "../../src/host/place.ts";
import { placeMode, placeModeQueries } from "../../src/host/placewatch.ts";
import { universeWorld } from "./worlds.ts";
import { ranFor } from "./place-modes-run.ts";

const [step, a, b, c] = process.argv.slice(2);
const ask = placeModeQueries();

/** The town of its world nearest 400 people. */
function town(w: World): string {
  const ctx = populationContext(w);
  return ctx.settlements
    .all()
    .filter((s) => ctx.settlements.held(s.ref) && s.population > 0)
    .sort(
      (x, y) =>
        Math.abs(x.population - 400) - Math.abs(y.population - 400) || (x.ref < y.ref ? -1 : 1),
    )[0]!.ref;
}
const told = (w: World, ref: string) => {
  const place = placesOf(w)!.get(ref)!;
  return `${placeMode(place)} ${placeDigest(place)} ${w.checkpoints().at(-1)!.chain} ${JSON.stringify(w.domainHashes()).length}`;
};

if (step === "second") {
  const doc = JSON.parse(gunzipSync(readFileSync(a!)).toString("utf8")),
    w = loadWorld(doc, (s) => EARTH.build(s), "r").world,
    ref = placesOf(w)!.places[0]!.town;
  ranFor(w, ref, 72 * HOUR);
  console.log(told(w, ref));
} else {
  const kept = universeWorld(EARTH, "first light", Number(a)),
    w = loadWorld(
      JSON.parse(JSON.stringify(saveWorld(kept, "r", { universe: "earth" }))),
      (s) => EARTH.build(s),
      "r",
    ).world,
    ref = town(w);
  ask["place.mode"]!(w, { ref, mode: b });
  ranFor(w, ref, 24 * HOUR);
  if (step === "first")
    writeFileSync(c!, gzipSync(JSON.stringify(saveWorld(w, "r", { universe: "earth" }))));
  else ranFor(w, ref, 72 * HOUR);
  console.log(told(w, ref));
}
