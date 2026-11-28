// What now? (town mode, G3): the one to three things most worth doing next in a town, read off the town as it stands:
// its gravest alerts; its food running short; a threat at its gate or on its land; one of its people near breaking; its
// grown with no work. Each said in plain words with what to do, and a Go to: the eye to where it is, its page, or the
// sheet where it is done. Read only: it adds nothing to the town's tick.
//
// By the way the town is run (U6; bridge/placemodes.ts): by hand, as above. Run by its head, what the head is about to
// do, what they hold the town to now and what you hold in their stead, each with the sheet where it is taken over; and
// what is grave first, as by hand. Watched, no order at all: what is worth the eye, its alerts, the seldomest of what
// befell its people this last day, one near breaking, each with a Go to and their page, and no sheet.
import { DAY, type World } from "../kernel/index.ts";
import {
  PLACE_MODES,
  placePersonRef,
  placeWhatNowRef,
  type PlaceInspectWhatNow,
  type PlaceTip,
} from "../bridge/index.ts";
import { AT, MOOD_UNHEEDING, WHY, hapTold, placeIndexOf, placeSites, type Place } from "./place.ts";
import {
  dangersSheet,
  lotWords,
  placeNamed,
  placeNotices,
  placeRarity,
  placeWho,
  siteOf,
  stocksSheet,
} from "./placeplan.ts";
import { ORDERED } from "./placewatch.ts";
import { stewardHead } from "./steward.ts";
import { lifeOf } from "../sim/index.ts";

/** The most told. */
const MOST = 3;

type Weighed = PlaceTip & { readonly weight: number };
/** A thing's words read for whether two tips tell one thing (an alert's and a danger's of one fire: U2). */
const said = (words: string): string =>
  words
    .toLowerCase()
    .replace(/[.:;,]+\s*/g, " ")
    .trim();

/**
 * The tips gathered, and a tip added to them. (One row a thing: a tip that tells what another already does (its words,
 * or its page where one of the two only opens a page or a sheet) is made one with it, the first's words, the keys of
 * both and the graver weight kept. U2: a fire was told twice, as an alert and as a danger.)
 */
function gathered(): { tips: Weighed[]; add: (x: Weighed) => void } {
  const tips: Weighed[] = [];
  const add = (x: Weighed): void => {
    const k = tips.findIndex(
      (y) =>
        said(y.words) === said(x.words) || (x.ref !== null && y.ref === x.ref && (!x.go || !y.go)),
    );
    if (k < 0) return void tips.push(x);
    const y = tips[k]!;
    tips[k] = {
      ...y,
      weight: Math.max(x.weight, y.weight),
      how:
        y.how === x.how
          ? y.how
          : `${y.how.replace(/\.$/, "")}; or ${x.how.charAt(0).toLowerCase()}${x.how.slice(1)}`,
      ref: y.ref ?? x.ref,
      go: y.go ?? x.go,
      sheet: y.sheet ?? x.sheet,
    };
  };
  return { tips, add };
}

/** The gravest few told, in the page's words; `none` where nothing is. */
function told(
  place: Place,
  tips: Weighed[],
  none: PlaceTip,
  sub: (shown: number, of: number) => string,
  quiet = "Nothing presses",
): PlaceInspectWhatNow {
  tips.sort((a, b) => b.weight - a.weight);
  const out: PlaceTip[] = tips.slice(0, MOST).map(({ weight: _, ...x }) => x);
  if (!out.length) out.push(none);
  return {
    kind: "whatnow",
    ref: placeWhatNowRef(place.town),
    name: "What now?",
    icon: "💡",
    sub: tips.length ? sub(out.length, tips.length) : quiet,
    tips: out,
  };
}

/** The one of a place nearest breaking (their number in it; -1: none near it). */
function nearestBreaking(place: Place): number {
  const p = place.people;
  let low = -1;
  for (let i = 0; i < p.n; i++)
    if (p.mood[i]! < MOOD_UNHEEDING + 15 && (low < 0 || p.mood[i]! < p.mood[low]!)) low = i;
  return low;
}

/** What now? (G3), as the town is run (U6). */
export function placeWhatNow(world: World, place: Place): PlaceInspectWhatNow {
  const way = PLACE_MODES[place.mode ?? 0] ?? "hand";
  if (way === "watch") return watchedNow(world, place);
  if (way === "steward") return headsNow(world, place);
  const { tips, add } = gathered(),
    p = place.people,
    who = placeWho(world, place),
    grownAt = lifeOf(world).adulthood;
  for (const n of placeNotices(world, place))
    add({
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
    add({
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
    add({
      weight: 25,
      icon: d.icon,
      words: d.words,
      how: "Hold the town to an answer on the Dangers sheet.",
      ref: d.ref,
      go: null,
      sheet: "dangers",
    });
  // (The one nearest breaking, where any is near it.)
  const low = nearestBreaking(place);
  if (low >= 0) {
    const w = who(low);
    add({
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
    add({
      weight: 10,
      icon: "🧍",
      words: `${idle} grown ${idle === 1 ? "person has" : "people have"} no work.`,
      how: "Give them a trade from their page's Orders, or set the town's shares on Work.",
      ref: null,
      go: null,
      sheet: "work",
    });
  return told(
    place,
    tips,
    {
      icon: "🌤️",
      words: "All is well in the town for now.",
      how: "Follow someone through their day, or try a lesson from the menu.",
      ref: null,
      go: null,
      sheet: "people",
    },
    (n, of) => `${n} worth doing next, of ${of}`,
  );
}

/**
 * A town watched (U6): what is worth the eye, and no order. Its alerts, as what is happening; the seldomest of what
 * befell its living this last day (by the watch's own measure, placeRarity); one near breaking, someone to stay with.
 * Each with a Go to and their page; never a sheet, where orders are given.
 */
function watchedNow(world: World, place: Place): PlaceInspectWhatNow {
  const { tips, add } = gathered(),
    p = place.people,
    who = placeWho(world, place);
  for (const n of placeNotices(world, place)) {
    if (n.id === null && n.lot === null && n.ref === null) continue;
    add({
      weight: n.level >= 3 ? 30 : n.level === 2 ? 15 : 5,
      icon: n.icon,
      words: n.words,
      how:
        n.id !== null
          ? "Go to them and watch; tap them to have the eye go with them."
          : "Go there, and watch what comes of it.",
      ref: n.id !== null ? placePersonRef(place.town, n.id) : n.ref,
      go: n.id !== null || n.lot !== null ? { id: n.id, lot: n.lot } : null,
      sheet: null,
    });
  }
  // (What befell its living this last day, the seldomest of its kind first: two at most.)
  const rare = placeRarity(place),
    named = placeNamed(world, place),
    befell: { k: number; i: number; rare: number }[] = [];
  for (let k = place.log.length - 1; k >= 0 && place.log[k]!.t > place.t - DAY; k--) {
    const x = place.log[k]!,
      i = placeIndexOf(place, x.id);
    if (i >= 0 && !ORDERED.has(x.what)) befell.push({ k, i, rare: rare(x.what) });
  }
  befell.sort((a, b) => b.rare - a.rare || b.k - a.k);
  const seen = new Set<number>();
  for (const b of befell) {
    if (seen.size >= 2) break;
    if (seen.has(b.i)) continue;
    seen.add(b.i);
    const x = place.log[b.k]!,
      w = who(b.i);
    add({
      weight: 8 + 10 * b.rare,
      icon: "👁",
      words: `${w.name} ${hapTold(place, x, named)}.`,
      how: "Go to them, and see how they are now.",
      ref: w.ref,
      go: { id: x.id, lot: null },
      sheet: null,
    });
  }
  const low = nearestBreaking(place);
  if (low >= 0) {
    const w = who(low);
    add({
      weight: 18,
      icon: "😟",
      words: `${w.name} is near breaking (mood ${p.mood[low]}).`,
      how: "Someone to stay with: go to them, then 📌 Stay keeps the eye with them.",
      ref: w.ref,
      go: { id: p.id[low]!, lot: null },
      sheet: null,
    });
  }
  return told(
    place,
    tips,
    {
      icon: "🌤️",
      words: "Nothing out of the way is happening in the town now.",
      how: "Tap anyone to go with them through their day; ⏭ Next goes on to another.",
      ref: null,
      go: { id: null, lot: AT.square },
      sheet: null,
    },
    (n, of) => `${n} worth seeing now, of ${of}: no orders, only things to watch`,
    "Nothing out of the way now: no orders, only things to watch",
  );
}

/** What the head's answers are called (host/steward.ts ANSWERS, and the call to arms). */
const ANSWER_WORDS: Readonly<Record<string, string>> = {
  firebreaks: "a fire watch",
  quarantine: "the sick kept apart",
  granaries: "grain put by",
  muster: "the town under arms",
};
/** The sheet where a matter of the head's is taken over (host/steward.ts's keys: respond, shelter, site, prio). */
const MATTER_SHEET: Readonly<Record<string, string>> = {
  respond: "dangers",
  shelter: "dangers",
  site: "work",
  prio: "work",
};

/**
 * A town run by its head (U6): what they are about to do, what they hold it to, what they leave to you; and what is
 * grave, which an order of yours would take over. Read off the head's memory as it is (host/steward.ts), nothing of it
 * handed over or decided by asking.
 */
function headsNow(world: World, place: Place): PlaceInspectWhatNow {
  const { tips, add } = gathered(),
    head = stewardHead(world, place),
    s = place.steward,
    who = placeWho(world, place),
    sites = placeSites(world, place),
    name = head?.name ?? "Its head",
    sheetOf = (key: string): string => MATTER_SHEET[key.split(":")[0]!] ?? "dangers",
    sheetWord = (sheet: string): string => `${sheet.charAt(0).toUpperCase()}${sheet.slice(1)}`,
    siteLot = (n: number): number | null => sites.find((x) => x.n === n)?.lot ?? null,
    siteName = (n: number): string => {
      const lot = siteLot(n);
      return lot === null ? "a site" : siteOf(lotWords(place, lot));
    };
  /** Where the eye goes for a matter: the lot it is of, or the one it is of. */
  const goFor = (key: string, args: Record<string, unknown>): PlaceTip["go"] => {
    const [kind, of] = key.split(":");
    if (kind === "shelter" && typeof args.lot === "number") return { id: null, lot: args.lot };
    if (kind === "site") {
      const lot = siteLot(Number(of));
      return lot === null ? null : { id: null, lot };
    }
    if (kind === "prio") {
      const id = Number(of);
      return placeIndexOf(place, id) >= 0 ? { id, lot: null } : null;
    }
    return null;
  };
  // What is grave, first: the head meets it by what the town is held to; an order of yours takes it over.
  for (const n of placeNotices(world, place)) {
    if (n.level < 3) continue;
    add({
      weight: 30,
      icon: n.icon,
      words: n.words,
      how: `${name} meets this by what the town is held to; an order of yours on Dangers takes the matter over.`,
      ref: n.id !== null ? placePersonRef(place.town, n.id) : n.ref,
      go: n.id !== null || n.lot !== null ? { id: n.id, lot: n.lot } : null,
      sheet: "dangers",
    });
  }
  if (!head)
    add({
      weight: 40,
      icon: "🏛",
      words: "The town has no grown one living to head it: nothing is decided for it.",
      how: "Run it by hand: tap ✋ How run on the bar.",
      ref: null,
      go: null,
      sheet: "people",
    });
  /** An order of the head's, said as what they will do. */
  const doing = (type: string, key: string, args: Record<string, unknown>): string => {
    const [, of] = key.split(":");
    if (type === "place.respond")
      return args.on
        ? `hold the town to ${ANSWER_WORDS[String(args.what)] ?? "an answer"}`
        : `let ${ANSWER_WORDS[String(args.what)] ?? "an answer"} go`;
    if (type === "place.shelter")
      return typeof args.lot === "number"
        ? `open ${lotWords(place, args.lot)} to those without a roof`
        : "close the building opened to those without a roof";
    if (type === "place.site")
      return args.hands === null
        ? `give ${siteName(Number(of))} back to the town's month`
        : `put a crew of ${String(args.hands)} to ${siteName(Number(of))}`;
    if (type === "place.prio") {
      const i = placeIndexOf(place, Number(of));
      return `tell ${i >= 0 ? who(i).name : "one of the town"} what to turn to when idle`;
    }
    return "give an order";
  };
  // What the head is about to do: decided, and not yet standing.
  const waiting = new Set<string>();
  for (const o of s?.orders ?? []) {
    waiting.add(o.key);
    const sheet = sheetOf(o.key);
    add({
      weight: 26,
      icon: "🏛",
      words: `${name} is about to ${doing(o.type, o.key, o.args)}: ${o.why}.`,
      how: `Leave it to them, or give an order of your own on ${sheetWord(sheet)}: the matter is yours from then.`,
      ref: head?.ref ?? null,
      go: goFor(o.key, o.args),
      sheet,
    });
  }
  // What the head holds the town to now, as they set it: each yours to take over.
  const held = Object.entries(s?.did ?? {}).filter(
    ([key]) => !waiting.has(key) && !s!.let.includes(key),
  );
  let idle = 0;
  for (const [key, set] of held) {
    const [kind, of] = key.split(":");
    if (kind === "prio") {
      idle++;
      continue;
    }
    const what =
      kind === "respond"
        ? set === "1"
          ? `holds the town to ${ANSWER_WORDS[of!] ?? "an answer"}`
          : null
        : kind === "shelter"
          ? Number(set) >= 0
            ? `keeps ${lotWords(place, Number(set))} open to those without a roof`
            : null
          : kind === "site"
            ? set !== "0"
              ? `keeps a crew of ${set} at ${siteName(Number(of))}`
              : null
            : null;
    if (!what) continue;
    const sheet = sheetOf(key);
    add({
      weight: 12,
      icon: "🏛",
      words: `${name} ${what}.`,
      how: `Yours to take over on ${sheetWord(sheet)}: an order of yours there, and they leave it to you.`,
      ref: head?.ref ?? null,
      go: goFor(key, { lot: Number(set) }),
      sheet,
    });
  }
  if (idle)
    add({
      weight: 11,
      icon: "🏛",
      words: `${name} has told ${idle === 1 ? "one" : idle} who stood idle what to turn to.`,
      how: "Yours to take over on Work: set their priorities on its grid, and they leave it to you.",
      ref: head?.ref ?? null,
      go: null,
      sheet: "work",
    });
  // What you hold in the head's stead: given back only by choosing them anew.
  const yours = new Set((s?.let ?? []).map((key) => key.split(":")[0]!));
  for (const kind of yours) {
    const sheet = MATTER_SHEET[kind] ?? "dangers";
    add({
      weight: 8,
      icon: "✋",
      words: `You hold ${kind === "respond" ? "what the town is held to" : kind === "shelter" ? "the building opened to the homeless" : kind === "site" ? "a site's crew" : "some of the town's work"}: ${name} leaves it to you.`,
      how: "To give it back, tap ✋ How run on the bar, choose ✋ Run it, then 🏛 Its head runs it.",
      ref: null,
      go: null,
      sheet,
    });
  }
  return told(
    place,
    tips,
    {
      icon: "🏛",
      words: `${name} has nothing to see to now.`,
      how: "What they did, and why, is in the Log under their name.",
      ref: head?.ref ?? null,
      go: null,
      sheet: "log",
    },
    (n, of) =>
      `What ${head ? `${name}, its head,` : "its head"} is about to do, and what you might take over: ${n} of ${of}`,
    `${head ? `${name}, its head,` : "Its head"} has nothing in hand now: what you might take over is on the sheets`,
  );
}
