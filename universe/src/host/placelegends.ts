// A town's works on their own pages and its legends (town mode, O9). A work is read off what the place keeps of it
// (host/place.ts placeWorks: where it is kept, when it was made and by whom, what it shows, how fine); the homes it is in
// sight of, whose finest it is, off their day's needs (placeNeedsDay seen). Its legends are what its log has kept that
// came seldom, as its sights reckon a happening's rarity (host/placewatch.ts), the battles its men were in, and its works,
// the finest first. Read only.
import { DAY, type World } from "../kernel/index.ts";
import {
  PLACE_AT,
  placeLegendsRef,
  placeLotRef,
  placePersonRef,
  placeWorkRef,
  type PlaceInspectLegends,
  type PlaceInspectWork,
} from "../bridge/index.ts";
import {
  WORK_QUALITY,
  hapTold,
  hapWords,
  placeIndexOf,
  placeNeedsDay,
  placeWorks,
  type Place,
} from "./place.ts";
import { lotWords, placeDay, placeNamed, placeWho } from "./placeplan.ts";
import { ORDERED } from "./placewatch.ts";

/** The most of a town's works, its battles and its rarest happenings its legends tell. */
const LEGEND_WORKS = 8,
  LEGEND_BATTLES = 6,
  LEGEND_LINES = 10;
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** Every work the place keeps, at any lot: its own and its lot's. */
function allWorks(world: World, place: Place) {
  const lots = new Set<number>(),
    w = place.works ?? [];
  for (let k = 0; k + 6 < w.length; k += 7) lots.add(w[k]!);
  return [...lots].flatMap((lot) => placeWorks(world, place, lot).map((x) => ({ ...x, lot })));
}

/** A work of the town on its own page (O9; null: none such kept now). */
export function placeWork(
  world: World,
  place: Place,
  lot: number,
  made: number,
  maker: number,
): PlaceInspectWork | null {
  const x = placeWorks(world, place, lot).find((y) => y.made === made && y.maker === maker);
  if (!x) return null;
  const who = placeWho(world, place),
    named = placeNamed(world, place),
    m = placeIndexOf(place, x.maker),
    s = x.what >= 0 ? placeIndexOf(place, x.whom) : -1,
    nd = placeNeedsDay(world, place);
  let seenBy = 0;
  for (let h = 0; h < nd.seen.length; h++)
    if (nd.seen[h] === lot && place.houses.home[h]! >= 0) seenBy++;
  const quality = WORK_QUALITY[x.quality] ?? "plain",
    whomName = x.what >= 0 ? (s >= 0 ? who(s).name : (named(x.whom) ?? "one of the town")) : null;
  return {
    kind: "work",
    ref: placeWorkRef(place.town, lot, made, maker),
    lotRef: placeLotRef(place.town, lot),
    name: `${cap(quality)} ${x.form}`,
    icon: "🖼️",
    quality,
    kept: cap(lotWords(place, lot)),
    made: cap(placeDay(x.made)),
    maker: {
      name: m >= 0 ? who(m).name : (named(x.maker) ?? "one gone from the town"),
      ref: m >= 0 ? placePersonRef(place.town, x.maker) : null,
    },
    shows:
      x.what < 0
        ? "The town itself"
        : `${whomName} who ${hapWords(x.what)}, on ${placeDay(x.day * DAY)}`,
    whom:
      x.what >= 0 && s >= 0 ? { name: who(s).name, ref: placePersonRef(place.town, x.whom) } : null,
    seenBy,
    words: seenBy
      ? `In sight of the doors of ${seenBy} ${seenBy === 1 ? "household" : "households"}, the finest each sees: their beauty of it.`
      : "In sight of no household's door as the finest it sees.",
  };
}

/** A town's legends (O9): its works, its battles, the rarest of what its log keeps. */
export function placeLegends(world: World, place: Place): PlaceInspectLegends {
  const log = place.log,
    named = placeNamed(world, place),
    kinds = new Map<number, number>();
  for (const x of log) kinds.set(x.what, (kinds.get(x.what) ?? 0) + 1);
  // (How seldom a kind has come: of the log's lines, the share not of it, as its sights reckon it.)
  const rare = (what: number): number => 1 - (kinds.get(what) ?? 0) / (log.length + 1),
    lines = log
      .map((x, k) => ({ x, k }))
      .filter(({ x }) => !ORDERED.has(x.what))
      .sort((a, b) => rare(b.x.what) - rare(a.x.what) || b.x.t - a.x.t)
      .slice(0, LEGEND_LINES)
      .sort((a, b) => a.k - b.k)
      .map(({ x }) => {
        const i = placeIndexOf(place, x.id),
          name = named(x.id);
        return {
          when: cap(placeDay(x.t)),
          words: `${name ?? "One of the town"} ${hapTold(place, x, named)}`,
          ref: i >= 0 ? placePersonRef(place.town, x.id) : null,
        };
      }),
    works = allWorks(world, place)
      .sort((a, b) => b.quality - a.quality || b.made - a.made)
      .slice(0, LEGEND_WORKS)
      .map((x) => ({
        ref: placeWorkRef(place.town, x.lot, x.made, x.maker),
        name: `${cap(WORK_QUALITY[x.quality] ?? "plain")} ${x.form}`,
        words: `Kept at ${lotWords(place, x.lot)}; made ${placeDay(x.made)}`,
      })),
    battles = place.wars.slice(-LEGEND_BATTLES).map((w) => {
      const [name, ref] = w.split("|");
      return { name: cap(name ?? "a battle"), ref: ref ?? "" };
    });
  return {
    kind: "legends",
    ref: placeLegendsRef(place.town),
    lotRef: placeLotRef(place.town, PLACE_AT.square),
    name: "Its legends",
    icon: "📜",
    works,
    battles,
    lines,
    words: `Told of what its log keeps (${log.length} happenings), the seldomest first chosen; its works, the finest first; the battles its men were in.`,
  };
}
