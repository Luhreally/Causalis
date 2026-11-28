// What now? (town mode, G3): the one to three things most worth doing next in a town, read off the town as it stands:
// its gravest alerts; its food running short; a threat at its gate or on its land; one of its people near breaking; its
// grown with no work. Each said in plain words with what to do, and a Go to: the eye to where it is, its page, or the
// sheet where it is done. Read only: it adds nothing to the town's tick.
import { DAY, type World } from "../kernel/index.ts";
import {
  placePersonRef,
  placeWhatNowRef,
  type PlaceInspectWhatNow,
  type PlaceTip,
} from "../bridge/index.ts";
import { MOOD_UNHEEDING, WHY, type Place } from "./place.ts";
import { dangersSheet, placeNotices, placeWho, stocksSheet } from "./placeplan.ts";
import { lifeOf } from "../sim/index.ts";

/** The most told. */
const MOST = 3;

/** What now? (G3) */
export function placeWhatNow(world: World, place: Place): PlaceInspectWhatNow {
  const tips: (PlaceTip & { readonly weight: number })[] = [],
    p = place.people,
    who = placeWho(world, place),
    grownAt = lifeOf(world).adulthood;
  for (const n of placeNotices(world, place))
    tips.push({
      weight: n.level >= 3 ? 30 : n.level === 2 ? 15 : 5,
      icon: n.icon,
      words: n.words,
      how: n.id !== null ? "Go to them, and open their page." : "Go there, and see what it is.",
      ref: n.id !== null ? placePersonRef(place.town, n.id) : n.ref,
      go: n.id !== null || n.lot !== null ? { id: n.id, lot: n.lot } : null,
      sheet: null,
    });
  const food = stocksSheet(world, place).foodDays;
  if (food < 30)
    tips.push({
      weight: food < 14 ? 28 : 20,
      icon: "🍞",
      words: `Food will run out in about ${Math.max(0, Math.round(food))} days.`,
      how: "Put more hands to the fields, or hold food back in the granary.",
      ref: null,
      go: null,
      sheet: "work",
    });
  for (const d of dangersSheet(world, place)
    .now.filter((d) => d.icon !== "🕊️")
    .slice(0, 1))
    tips.push({
      weight: 25,
      icon: d.icon,
      words: d.words,
      how: "Hold the town to an answer on the Dangers sheet.",
      ref: d.ref,
      go: null,
      sheet: "dangers",
    });
  // (The one nearest breaking, where any is near it.)
  let low = -1;
  for (let i = 0; i < p.n; i++)
    if (p.mood[i]! < MOOD_UNHEEDING + 15 && (low < 0 || p.mood[i]! < p.mood[low]!)) low = i;
  if (low >= 0) {
    const w = who(low);
    tips.push({
      weight: 18,
      icon: "😟",
      words: `${w.name} is near breaking (mood ${p.mood[low]}).`,
      how: "Open their Mood to see what weighs on them.",
      ref: w.ref,
      go: { id: p.id[low]!, lot: null },
      sheet: null,
    });
  }
  // (Its grown with no trade of their own.)
  const today = place.t / DAY;
  let idle = 0;
  for (let i = 0; i < p.n; i++)
    if (p.why[i] === WHY.young && (today - p.born[i]!) / 365 >= grownAt) idle++;
  if (idle)
    tips.push({
      weight: 10,
      icon: "🧍",
      words: `${idle} grown ${idle === 1 ? "person has" : "people have"} no work.`,
      how: "Give them a trade from their page's Orders, or set the town's shares on Work.",
      ref: null,
      go: null,
      sheet: "work",
    });
  tips.sort((a, b) => b.weight - a.weight);
  const told: PlaceTip[] = tips.slice(0, MOST).map(({ weight: _, ...x }) => x);
  if (!told.length)
    told.push({
      icon: "🌤️",
      words: "All is well in the town for now.",
      how: "Follow someone through their day, or try a lesson from the menu.",
      ref: null,
      go: null,
      sheet: "people",
    });
  return {
    kind: "whatnow",
    ref: placeWhatNowRef(place.town),
    name: "What now?",
    icon: "💡",
    sub: tips.length ? `${told.length} worth doing next, of ${tips.length}` : "Nothing presses",
    tips: told,
  };
}
