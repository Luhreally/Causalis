// A town watched (town mode; asked 2026-11-25: "a gameplay mode where i just observe the sim too"): what of a place is
// worth the eye, read off what it keeps already. Its log says what befell whom and when (host/place.ts HAP); a fire being
// fought and a burial being held go on for a while and say until when; a building that stood up since it was last
// looked at is told once. Nothing is added to the place for it and nothing of the world is asked to change: a town
// watched gives no order, so its world runs exactly as one never entered (tests/host/place-modes.test.ts).
//
// How much a happening is worth the eye is not listed anywhere: it is how seldom its kind has come in this town, as far
// as its log remembers (of all its lines, the share that are of other kinds). So in a town where children are born
// every week a birth is passed over for a burial, and in one that has not seen a fire there is nothing rarer.
//
// Which way a town is run (by hand, watched, stewarded) is kept with its place, and so in the save; a place is no part of
// its world's hash, so choosing moves nothing of history.
import { DAY, type World } from "../kernel/index.ts";
import {
  PLACE_MODES,
  placeLotRef,
  type PlaceMode,
  type PlaceSight,
  type PlaceWatch,
  type PlaceWatched,
} from "../bridge/index.ts";
import { lifeOf } from "../sim/index.ts";
import type { QueryHandler } from "./host.ts";
import {
  ACT,
  AT,
  HAP,
  enterPlace,
  hapRef,
  hapSubject,
  hapTold,
  ordersOf,
  placeIndexOf,
  type Place,
} from "./place.ts";
import { doingWords, goneNames, lotWords, placeNamed, placeWho, tradeWords } from "./placeplan.ts";
import { stewardHead, stewardOrders, stewardTaken, temperWords } from "./steward.ts";

/** How a place is run, and set. */
export const placeMode = (place: Place): PlaceMode => PLACE_MODES[place.mode ?? 0] ?? "hand";
export function setPlaceMode(world: World, place: Place, mode: PlaceMode): void {
  const next = Math.max(0, PLACE_MODES.indexOf(mode)),
    was = place.mode ?? 0;
  if (was === next) return;
  // (By hand is the way of a place that says nothing.)
  if (next) place.mode = next;
  else delete place.mode;
  // (Its head given the town, or the town taken from them: host/steward.ts.)
  if (next === 2) stewardTaken(world, place, true);
  else if (was === 2) stewardTaken(world, place, false);
}

/** What a town's own orders did, which only a town given orders tells of: no sight in one watched for its own sake. */
export const ORDERED: ReadonlySet<number> = new Set([
  HAP.ordered,
  HAP.assigned,
  HAP.moved,
  HAP.unheeded,
  HAP.crew,
  HAP.uncrew,
  HAP.mustered,
  HAP.stoodDown,
  HAP.steward,
]);
/** Where a lot is, said for under a happening: "At the smithy", "In the fields". */
const whereWords = (place: Place, lot: number): string =>
  lot === AT.fields ? "In the fields" : `At ${lotWords(place, lot)}`;
/** As many as one asking is told. */
const SIGHTS_MOST = 8;

/** The sites a place had going up when it was last looked at (the lots), for telling one that has stood up since. */
const RISING = new WeakMap<Place, Set<number>>();

/**
 * What happened in a place after `since` (its clock) that is worth the eye, the oldest first, and what goes on now: at
 * most SIGHTS_MOST, the rarest kept where there were more.
 */
export function placeSights(world: World, place: Place, since: number): PlaceSight[] {
  const p = place.people,
    log = place.log,
    out: PlaceSight[] = [],
    kinds = new Map<number, number>();
  for (const x of log) kinds.set(x.what, (kinds.get(x.what) ?? 0) + 1);
  /** How seldom a kind has come: of the log's lines, and one more for the happening itself, the share that are not of it. */
  const rare = (what: number): number => 1 - (kinds.get(what) ?? 0) / (log.length + 1);
  let who: ReturnType<typeof placeWho> | null = null,
    gone: ReturnType<typeof goneNames> | null = null,
    named: ReturnType<typeof placeNamed> | null = null;
  const burial = place.rite.length && place.t < place.rite[1]! ? place.rite : null;
  for (let k = log.length - 1; k >= 0 && log[k]!.t > since; k--) {
    const x = log[k]!;
    if (ORDERED.has(x.what)) continue;
    who ??= placeWho(world, place);
    gone ??= goneNames(world, place);
    named ??= placeNamed(world, place);
    const i = placeIndexOf(place, x.id),
      one = i >= 0 ? who(i) : null,
      // (One gone is told of where their household lives; a burial where it is held.)
      house = x.k === undefined ? -1 : place.houses.key.indexOf(x.k),
      held = x.what === HAP.buried && burial && burial[1]! - x.t <= DAY,
      lot = held
        ? burial[0]!
        : i >= 0
          ? p.eta[i]! > 0
            ? p.to[i]!
            : p.at[i]!
          : house >= 0
            ? (place.houses.home[house] ?? AT.square)
            : AT.square;
    out.push({
      t: x.t,
      words: `${one ? one.name : (hapSubject(place, x) ?? gone(x.id) ?? "One of the town")} ${hapTold(place, x, named)}`,
      id: i >= 0 ? x.id : null,
      lot: lot === AT.none ? AT.square : lot,
      where: whereWords(place, lot),
      ref: one ? one.ref : hapRef(place, x),
      rare: rare(x.what),
      ...(held ? { until: burial[1]! } : {}),
    });
  }
  out.reverse();
  // A building that has stood up since the place was last looked at.
  const rising = new Set<number>(),
    was = RISING.get(place);
  for (let b = 1; b < place.bldgs.lot.length; b++) {
    const lot = place.bldgs.lot[b]!;
    if (place.bldgs.site[b]) rising.add(lot);
    else if (was?.has(lot))
      out.push({
        t: place.t,
        words: `${lotWords(place, lot).replace(/^the /, "The ")} stands finished`,
        id: null,
        lot,
        where: whereWords(place, lot),
        ref: placeLotRef(place.town, lot),
        // (Nothing in its log is of its kind: as seldom as anything is.)
        rare: 1,
      });
  }
  RISING.set(place, rising);
  // What goes on now: a fire being fought.
  if (place.fire.length && place.t < place.fire[1]!) {
    let crew = 0;
    for (let i = 0; i < p.n; i++) if (p.act[i] === ACT.brigade) crew++;
    const lot = place.fire[0]!;
    out.push({
      t: place.t,
      words: `Fire at ${lotWords(place, lot)}: ${crew === 1 ? "one fights it" : `${crew} fight it`}`,
      id: null,
      lot,
      where: "Those who live within a cry of it have turned out",
      ref: lot >= 0 ? placeLotRef(place.town, lot) : null,
      rare: 1,
      until: place.fire[1]!,
    });
  }
  if (out.length <= SIGHTS_MOST) return out;
  // (The rarest kept, in the order they came.)
  const keep = new Set([...out].sort((a, b) => b.rare - a.rare || b.t - a.t).slice(0, SIGHTS_MOST));
  return out.filter((x) => keep.has(x));
}

/** Those asked after (by their numbers in the place), each by name with what they are at now, in a line. */
export function placeWatched(world: World, place: Place, ids: readonly number[]): PlaceWatched[] {
  const p = place.people,
    who = placeWho(world, place),
    grown = lifeOf(world).adulthood,
    out: PlaceWatched[] = [];
  for (const id of ids) {
    const i = placeIndexOf(place, id);
    if (i < 0) continue;
    const occ = p.sexOcc[i]! & 15,
      age = (place.t / DAY - p.born[i]!) / 365,
      going = p.eta[i]! > 0,
      at = going ? p.to[i]! : p.at[i]!;
    out.push({
      id,
      ...who(i),
      words: `${tradeWords(occ, age < grown).replace(/^a /, "")}, ${Math.floor(age)} · ${doingWords(place, i)}`,
      lot: at === AT.none ? AT.square : at,
    });
  }
  return out;
}

/**
 * What a town watched or stewarded tells its page: brought to the world's moment first. Stewarded, its head and the
 * orders they have decided on after the one numbered `after` (the last the page gave).
 */
export function placeWatch(
  world: World,
  town: string,
  since: number,
  after = 0,
): PlaceWatch | null {
  const place = enterPlace(world, town);
  if (!place) return null;
  const mode = placeMode(place),
    head = mode === "steward" ? stewardHead(world, place) : null;
  return {
    mode,
    t: place.t,
    sights: placeSights(world, place, since),
    head: head
      ? { name: head.name, ref: head.ref, id: head.id, temper: temperWords(place, head.i) }
      : null,
    orders: mode === "steward" ? stewardOrders(place, after) : [],
    managed: !!ordersOf(world, town),
  };
}

/**
 * The page's askings of a town's mode. `place.mode` says how it is run, and sets it where one is given; `place.watch`
 * what is worth the eye since a moment, and what its head would order; `place.watched` those asked after, in a line each.
 */
export function placeModeQueries(): Readonly<Record<string, QueryHandler>> {
  return {
    "place.mode": (world, args) => {
      const a = args as { ref: string; mode?: unknown },
        place = enterPlace(world, a.ref);
      if (!place) return null;
      if (typeof a.mode === "string" && (PLACE_MODES as readonly string[]).includes(a.mode))
        setPlaceMode(world, place, a.mode as PlaceMode);
      return placeMode(place);
    },
    "place.watch": (world, args) => {
      const a = args as { ref: string; since?: number; after?: number };
      return placeWatch(
        world,
        a.ref,
        typeof a.since === "number" ? a.since : Infinity,
        typeof a.after === "number" ? a.after : 0,
      );
    },
    "place.watched": (world, args) => {
      const a = args as { ref: string; ids?: number[] },
        place = enterPlace(world, a.ref);
      return place ? placeWatched(world, place, a.ids ?? []) : [];
    },
  };
}
