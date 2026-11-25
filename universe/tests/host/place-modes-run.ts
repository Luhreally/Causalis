// A town entered run on as its page runs it (tests/host/place-modes.test.ts and its child): the world's clock stepped,
// the place asked what is worth the eye at each step, and the orders its head has decided on given as the page gives
// them (commands, each taken at its own moment).
import { HOUR, type World } from "../../src/kernel/index.ts";
import type { PlaceSight, PlaceWatch } from "../../src/bridge/index.ts";
import { placeModeQueries } from "../../src/host/placewatch.ts";

const ask = placeModeQueries();

/** What a town's page is told of it now, since a moment of its clock. */
export const watchOf = (w: World, ref: string, since?: number): PlaceWatch =>
  ask["place.watch"]!(w, since === undefined ? { ref } : { ref, since }) as PlaceWatch;

/** The town run on for so long, asked every `each` seconds: every sight it told, and every order its head gave. */
export function ranFor(
  w: World,
  ref: string,
  seconds: number,
  each = HOUR,
): { sights: PlaceSight[]; orders: PlaceWatch["orders"][number][] } {
  const sights: PlaceSight[] = [],
    orders: PlaceWatch["orders"][number][] = [];
  let since = watchOf(w, ref).t;
  for (const end = w.now + seconds; w.now < end;) {
    w.runTo(Math.min(end, w.now + each));
    const told = watchOf(w, ref, since);
    since = told.t;
    sights.push(...told.sights);
    for (const o of told.orders) {
      w.runTo(w.submit(o.type, { town: ref, ...o.args }).t);
      orders.push(o);
    }
  }
  return { sights, orders };
}
