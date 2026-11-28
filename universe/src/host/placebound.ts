// The bound of a town (town mode, P6): its land's people held in each kind of bondage (sim/order/order.ts, the share of
// them in each), the town's own so held by its keyed draw on their numbers (host/place.ts placeBondOf), and those freed by
// your word; the captives its realm holds in its land through a war (sim/war/held.ts), at the town's share of its land's
// people; and those its justice holds (N11). Read only.
import { DAY, type World } from "../kernel/index.ts";
import { BONDS, displacedOf, politiesOf, populationContext } from "../sim/index.ts";
import {
  PLACE_AT,
  placeBoundRef,
  placeLotRef,
  placePersonRef,
  type PlaceInspectBound,
} from "../bridge/index.ts";
import { placeBondOf, placeBonds, type Place } from "./place.ts";
import { placeWho } from "./placeplan.ts";

/** Each kind of bondage, as one held in it is told. */
export const BOND_WORDS: Readonly<Record<string, string>> = {
  chattel: "held as chattel, owned outright",
  debt: "bound for a debt, till it is worked off",
  serf: "a serf, bound to the land and its lord",
  indenture: "indentured, bound for a term of years",
  convict: "a convict, bound to labour for a crime",
};
/** The most of the town's bound named on its page (the rest counted). */
const BOUND_LISTED = 30;

/** One's bondage in words (P6; null: free). */
export function bondWords(
  world: World,
  place: Place,
  id: number,
): { words: string; freeable: boolean } | null {
  const b = placeBonds(world, place),
    k = placeBondOf(place, id, b);
  if (k >= 0) {
    const kind = BONDS[k]!,
      share = Math.round((b.shares[k] ?? 0) * 1000) / 10;
    return {
      words: `${BOND_WORDS[kind] ?? kind}, as ${share}% of their land's people are`,
      freeable: true,
    };
  }
  const was = placeBondOf(place, id, { shares: b.shares, freed: new Set() });
  return was >= 0
    ? {
        words: `Freed by your word: once ${BOND_WORDS[BONDS[was]!] ?? BONDS[was]}`,
        freeable: false,
      }
    : null;
}

/** The bound of a town (P6). */
export function placeBound(world: World, place: Place): PlaceInspectBound {
  const b = placeBonds(world, place),
    p = place.people,
    who = placeWho(world, place),
    here = BONDS.map(() => 0),
    people: PlaceInspectBound["people"][number][] = [];
  let freed = 0;
  for (let i = 0; i < p.n; i++) {
    const id = p.id[i]!,
      k = placeBondOf(place, id, b);
    if (k >= 0) {
      here[k]!++;
      if (people.length < BOUND_LISTED)
        people.push({
          name: who(i).name,
          ref: placePersonRef(place.town, id),
          words: `${BOND_WORDS[BONDS[k]!]}, ${Math.floor((place.t / DAY - p.born[i]!) / 365)}`,
        });
    } else if (b.freed.has(id)) freed++;
  }
  // (Captives its realm holds in its land through a war, at the town's share of its land's people.)
  const ctx = populationContext(world),
    s = ctx.settlements.get(place.town as never),
    all = ctx.provinces.get(place.cell)?.total() ?? 0,
    share = s && all > 0 ? Math.min(1, s.population / all) : 0,
    realm = politiesOf(world).of(place.cell),
    kept = realm
      ? (displacedOf(world)
          ?.heldBy(realm.ref)
          .filter((c) => c.at === place.cell)
          .reduce((a, c) => a + c.men + c.folk, 0) ?? 0)
      : 0,
    captives = Math.round(kept * share),
    held = (place.held?.length ?? 0) / 3,
    bound = here.reduce((a, x) => a + x, 0);
  return {
    kind: "bound",
    ref: placeBoundRef(place.town),
    lotRef: placeLotRef(place.town, PLACE_AT.square),
    name: "The bound",
    icon: "⛓️",
    kinds: BONDS.map((k, n) => ({
      name: k.charAt(0).toUpperCase() + k.slice(1),
      words: `${Math.round((b.shares[n] ?? 0) * 1000) / 10}% of its land's people: ${BOND_WORDS[k]}`,
      here: here[n]!,
    })).filter((x, n) => (b.shares[n] ?? 0) > 0 || here[n]! > 0),
    captives: kept
      ? `${captives} captives of a war held in the town, of the ${kept} its realm keeps in its land till the peace says what becomes of them`
      : null,
    held,
    people,
    freed,
    words: bound
      ? `${bound} of its people are held in bondage, as its land's are${freed ? `; ${freed} freed by your word` : ""}. Each weighs on their mood by its kind; your word may free any of them, on their page.`
      : `None of its people is held in bondage${freed ? `; ${freed} freed by your word` : ""}.`,
  };
}
