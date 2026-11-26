// A town's tiers and those followed by word, saved in one process and gone on with in another (tests/host/place-tiers.test.ts).
//   whole           enter a town, follow one by word, go on thirty hours and a tick in one process
//   first <save>    the same to twenty-five hours and a tick (between the folk's turns), save
//   second <save>   load, go on the rest: the same place (its tiers and its word with it) and the same world as `whole`
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { HOUR, loadWorld, saveWorld, type World } from "../../src/kernel/index.ts";
import { populationContext } from "../../src/sim/index.ts";
import { EARTH } from "../../src/host/index.ts";
import { advancePlace, enterPlace, placeDigest, placePin, placesOf } from "../../src/host/place.ts";
import { placeFrame } from "../../src/host/placeplan.ts";
import { universeWorld } from "./worlds.ts";

const [step, a] = process.argv.slice(2);

function town(w: World): string {
  const ctx = populationContext(w);
  return ctx.settlements
    .all()
    .filter((s) => ctx.settlements.held(s.ref) && s.population > 0)
    .sort(
      (x, y) =>
        Math.abs(x.population - 900) - Math.abs(y.population - 900) || (x.ref < y.ref ? -1 : 1),
    )[0]!.ref;
}
const go = (w: World, ref: string, hours: number) => {
  for (let h = 0; h < hours; h++) {
    w.runTo(w.now + HOUR);
    placeFrame(w, ref, []);
  }
};
/** A tick past the hour: its clock between the folk's turns. */
const tick = (w: World, ref: string) => {
  w.runTo(w.now + 600);
  advancePlace(w, placesOf(w)!.get(ref)!);
};
const told = (w: World, ref: string) => {
  const place = placesOf(w)!.get(ref)!,
    n = [0, 0, 0];
  for (let i = 0; i < place.people.n; i++) n[place.people.tier[i]! & 3]!++;
  return `${placeDigest(place)} ${w.checkpoints().at(-1)!.chain} ${n.join(" ")} ${(place.pins ?? []).length}`;
};

if (step === "second") {
  const doc = JSON.parse(gunzipSync(readFileSync(a!)).toString("utf8")),
    w = loadWorld(doc, (s) => EARTH.build(s), "r").world,
    ref = placesOf(w)!.places[0]!.town;
  go(w, ref, 5);
  console.log(told(w, ref));
} else {
  const kept = universeWorld(EARTH, "first light", 150),
    w = loadWorld(
      JSON.parse(JSON.stringify(saveWorld(kept, "r", { universe: "earth" }))),
      (s) => EARTH.build(s),
      "r",
    ).world,
    ref = town(w),
    place = enterPlace(w, ref)!;
  // (One of its people followed by word, from the first.)
  placePin(place, place.people.id[Math.floor(place.people.n / 2)]!, -1);
  go(w, ref, 25);
  tick(w, ref);
  if (step === "first")
    writeFileSync(a!, gzipSync(JSON.stringify(saveWorld(w, "r", { universe: "earth" }))));
  else go(w, ref, 5);
  console.log(told(w, ref));
}
