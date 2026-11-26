// What a town's people remember, saved in one process and gone on with in another (tests/host/place-thoughts.test.ts).
//   whole <years>          enter a town, send a fire on it, go on four days in one process
//   first <years> <save>   enter it, the fire, go on a day, save
//   second <save>          load, go on the rest: the same place (its memories with it) and the same world as `whole`
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { HOUR, loadWorld, saveWorld, type World } from "../../src/kernel/index.ts";
import { populationContext } from "../../src/sim/index.ts";
import { EARTH } from "../../src/host/index.ts";
import { THOUGHTS, enterPlace, placeDigest, placesOf } from "../../src/host/place.ts";
import { placeFrame } from "../../src/host/placeplan.ts";
import { universeWorld } from "./worlds.ts";

const [step, a, b] = process.argv.slice(2);

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
const go = (w: World, ref: string, hours: number) => {
  for (let h = 0; h < hours; h++) {
    w.runTo(w.now + HOUR);
    placeFrame(w, ref, []);
  }
};
const told = (w: World, ref: string) => {
  const place = placesOf(w)!.get(ref)!;
  let held = 0;
  for (let k = 0; k < place.people.n * THOUGHTS; k++) if (place.people.thought[k]) held++;
  return `${placeDigest(place)} ${w.checkpoints().at(-1)!.chain} ${held}`;
};

if (step === "second") {
  const doc = JSON.parse(gunzipSync(readFileSync(a!)).toString("utf8")),
    w = loadWorld(doc, (s) => EARTH.build(s), "r").world,
    ref = placesOf(w)!.places[0]!.town;
  go(w, ref, 72);
  console.log(told(w, ref));
} else {
  const kept = universeWorld(EARTH, "first light", Number(a)),
    w = loadWorld(
      JSON.parse(JSON.stringify(saveWorld(kept, "r", { universe: "earth" }))),
      (s) => EARTH.build(s),
      "r",
    ).world,
    ref = town(w);
  enterPlace(w, ref);
  go(w, ref, 2);
  try {
    w.runTo(w.submit("act.fire", { village: ref }).t);
  } catch {
    // (Nothing to burn: the memories are of what else befell them.)
  }
  go(w, ref, 22);
  if (step === "first")
    writeFileSync(b!, gzipSync(JSON.stringify(saveWorld(w, "r", { universe: "earth" }))));
  else go(w, ref, 72);
  console.log(told(w, ref));
}
