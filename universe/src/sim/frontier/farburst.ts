// The galaxy's fire on the far peoples (the Frontier lane): a burst that struck the home world struck every world near it,
// each by its own distance from it (galactic.ts burstAt). In the year after a burst is told, each far people history holds
// a life of loses those of its people the burst's years take past their usual deaths, its fields' yield with them, and it
// is told so (a sickness, by the burst's event). Read from sim/space/farlife.ts's year, once a burst.
import type { World } from "../../kernel/index.ts";
import { CROSSING, fieldsUnderBurst } from "../../rules/index.ts";
import { pack, tellOn, unpack, type FarLifeStore } from "../space/farlife-store.ts";
import { followedIn } from "../space/farlife.ts";
import { folkByRef } from "../space/natives.ts";
import { starPoint } from "../space/peoples.ts";
import { burstAt, galacticOf } from "./galactic.ts";

/** The share of a people a burst's harm takes over its years, past their usual deaths (and what its fields lose). */
export function burstToll(harm: number, years: number): number {
  return Math.min(0.5, Math.max(0, harm - 1) * CROSSING.restDeaths * Math.max(0, years));
}

/** A burst told last year, on each far people history holds a life of. */
export function farBurstsYear(world: World, store: FarLifeStore, year: number): void {
  const b = galacticOf(world)?.burst;
  if (!b || b.year !== year - 1 || store.dormant()) return;
  for (const row of store.all()) {
    if (row.fell !== null) continue;
    const star =
      followedIn(world, year).find((c) => c.ref === row.ref)?.star ??
      folkByRef(world, row.ref)?.star;
    if (!star) continue;
    const at = starPoint(world, star),
      harm = burstAt(world, at.x, at.y, at.z),
      toll = burstToll(harm, b.years);
    if (toll <= 0.001) continue;
    const s = unpack(row);
    row.s = pack({
      ...s,
      people: Math.round(s.people * (1 - toll)),
      fed: s.fed * fieldsUnderBurst(harm),
    });
    tellOn(row, { year, what: "sickness", by: null, amount: toll, event: b.event });
    store.set(row);
  }
}
