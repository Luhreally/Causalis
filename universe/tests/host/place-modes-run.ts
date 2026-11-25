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

/**
 * The town run on for so long, asked every `each` seconds: every sight it told, every order its head gave (the host
 * hands each over once), and each as given: when it was given from, the command and what it asked.
 */
export function ranFor(
  w: World,
  ref: string,
  seconds: number,
  each = HOUR,
  _steward = false,
): {
  sights: PlaceSight[];
  orders: PlaceWatch["orders"][number][];
  given: { at: number; type: string; args: Record<string, unknown> }[];
} {
  const sights: PlaceSight[] = [],
    orders: PlaceWatch["orders"][number][] = [],
    given: { at: number; type: string; args: Record<string, unknown> }[] = [];
  let since = watchOf(w, ref).t;
  const give = (told: PlaceWatch) => {
    for (const o of told.orders) {
      const at = w.now,
        args = { town: ref, ...o.args };
      w.runTo(w.submit(o.type, args).t);
      orders.push(o);
      given.push({ at, type: o.type, args });
    }
  };
  give(ask["place.watch"]!(w, { ref, since }) as PlaceWatch);
  for (const end = w.now + seconds; w.now < end;) {
    w.runTo(Math.min(end, w.now + each));
    const told = ask["place.watch"]!(w, { ref, since }) as PlaceWatch;
    since = told.t;
    sights.push(...told.sights);
    give(told);
  }
  return { sights, orders, given };
}
