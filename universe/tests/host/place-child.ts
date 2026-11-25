// A place saved in one process and gone on with in another (tests/host/place.test.ts): one process shares its module
// caches between a world and its copy, two do not.
//   whole <years>          enter a town, go on a day and a half in one process: its digest and the world's chain
//   first <years> <save>   enter it, go on six hours, save (and say what waits in it to be lived: its `due`)
//   second <save>          load, go on the rest: the same digest and chain as `whole`
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { DAY, HOUR, loadWorld, saveWorld, type World } from "../../src/kernel/index.ts";
import { asksOf, populationContext } from "../../src/sim/index.ts";
import { EARTH } from "../../src/host/index.ts";
import { townOffers } from "../../src/host/inspect/asks.ts";
import { enterPlace, placeDigest, placeDue, placesOf } from "../../src/host/place.ts";
import { universeWorld } from "./worlds.ts";

const [mode, a, b] = process.argv.slice(2);

/**
 * The smallest town of more than 300 that takes up the raising of a building, the site taken in hand (kept in the save
 * with what its crew has done on it); the smallest of them where none does.
 */
function town(w: World): string {
  const ctx = populationContext(w),
    towns = ctx.settlements
      .all()
      .filter((s) => ctx.settlements.held(s.ref) && s.population > 300)
      .sort((x, y) => x.population - y.population || (x.ref < y.ref ? -1 : 1));
  for (const s of towns.slice(0, 12))
    for (const r of townOffers(w, s.ref)?.raises ?? []) {
      if (r.what === "walls" || r.what === "well") continue;
      w.runTo(w.submit("town.ask", { village: s.ref, kind: "raise", what: r.what }).t);
      const a = asksOf(w).ofTown(s.ref).at(-1);
      if (!a?.work) continue;
      w.runTo(w.submit("place.site", { town: s.ref, ask: a.n, hands: a.work.hands }).t);
      return s.ref;
    }
  return towns[0]!.ref;
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
  // (To four hours short of a month's turn, with a sickness loosed on its land: what the matching at the turn reads of it,
  // its dead named and counted and its sick abed, is kept in the save with the rest.)
  w.runTo(w.now + 30 * DAY + 6 * HOUR);
  enterPlace(w, ref);
  try {
    w.runTo(
      w.submit("act.loose", { cell: populationContext(w).settlements.get(ref as never)!.cell }).t,
    );
  } catch {
    // (A world that knows no sickness.)
  }
  // (And given an order: its hands put to other trades, kept in the save with what its land has yet to be told.)
  const c = w.submit("place.work", { town: ref, shares: [300, 100, 500, 100] });
  w.runTo(c.t);
  // (And priorities set for three of its people by name: the trade each is put to, what each turns to, kept in the save.)
  {
    const p = placesOf(w)!.get(ref)!.people;
    let set = 0;
    for (let i = 0; i < p.n && set < 3; i++) {
      const occ = p.sexOcc[i]! & 15;
      if (occ < 2 || occ > 5 || (w.now / DAY - p.born[i]!) / 365 < 25) continue;
      w.runTo(
        w.submit("place.prio", {
          town: ref,
          person: p.id[i]!,
          kinds: [
            [1, 0, 3, 2, 1],
            [3, 2, 0, 1, 0],
            [2, 0, 1, 3, 3],
          ][set++]!,
        }).t,
      );
    }
  }
  // (And held to stand to arms, a building opened to the homeless, and a fire on it: its hurt, its homeless and those
  // under arms kept in the save too.)
  w.runTo(w.submit("place.respond", { town: ref, what: "muster", on: true }).t);
  const hall = placesOf(w)!.get(ref)!.bldgs.lot[1];
  if (hall !== undefined) w.runTo(w.submit("place.shelter", { town: ref, lot: hall }).t);
  try {
    w.runTo(w.submit("act.fire", { village: ref }).t);
  } catch {
    // (Nothing of it stands to burn, or nothing burns in its air: no fire.)
  }
  go(w, ref, 6);
  if (mode === "first") {
    writeFileSync(b!, gzipSync(JSON.stringify(saveWorld(w, "r", { universe: "earth" }))));
    // (What waits for it to live, kept in the save: so many, of which kinds.)
    const due = placeDue(placesOf(w)!.get(ref)!);
    console.log(`due ${due.length} ${[...new Set(due.map((x) => x.what))].sort().join(",")}`);
  } else go(w, ref, 30);
  console.log(told(w, ref));
}
