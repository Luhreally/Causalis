// Following anyone a page is about, and any family (asked 2026-11-16: "im not able to pin each time i get into a persons tab or
// wtv ... id also like to pin familes if possible too"). The watches of causal/watch.ts know the lands, towns, realms, the people
// met and the hand's; these are the host's people, each told by their own record:
//   - a ruler (`rule:<realm>`): the one who held the seat when followed, by their coming to rule; their realm's weighty news
//     while they reign, and how the reign ended. The seat's ref names whoever holds it now, so once it has passed they are
//     remembered by name and told no more;
//   - one of a court (`court:<realm>:<id>`): every event of the court that names them, and how they left it;
//   - one of a town's many (`folk:<town>:<line>:<n>`): the battles they went to, the fires and quakes that struck them, and the
//     year they were no longer among the town's people;
//   - a maker at their seat, the healer (`seat:`, `heal:`): followed by name; once the seat has passed to another, so told;
//   - one of a battle's levy (`lv:`): known by its roll alone, kept, and told of any event that names him;
//   - one of a far people (`folkone:`): no record of their own, so their people's news;
//   - a family: a realm's great house (`dyn:`), its own events and any that name one of it; a town's line (`line:`), the battles
//     and strikes of its holders, and each new holder who heads it.
// The observer ledger keeps the watches, saved with the world; reading them moves nothing.
import { headLeader } from "./inspect/townlife.ts";
import { goneNotable, notableOf } from "./inspect/notables.ts";
import { groupNews, groupOf } from "./underworld.ts";
import { YEAR, type HistoryEvent, type Ref, type World } from "../kernel/index.ts";
import { politiesOf, folkByRef } from "../sim/index.ts";
import {
  canWatch,
  defineWatchKind,
  firstAfter,
  observer,
  type Tiding,
  type Watch,
} from "../causal/index.ts";
import {
  parseLevyManRef,
  parseSeatRef,
  parseTownsfolkRef,
  type PageModel,
} from "../bridge/index.ts";
import { courtFigure, parseCourtRef } from "./court.ts";
import { seatHolder } from "./kin.ts";
import { townRoster } from "./roster.ts";
import { resolveLevyMan } from "./roll.ts";
import {
  familyHead,
  familyName,
  houseNews,
  houseOf,
  isFamilyRef,
  lineEvents,
  lineOf,
} from "./family.ts";

/** How important a realm's news must be to be news of its ruler (as it is of the realm: causal/watch.ts). */
const NEWS = 4;
/** What a life's turns and its end count for, told (as a person met's are). */
const LIFE = 3,
  END = 5;
/** What takes a seat from the one who holds it: rule passed at a death, or taken. */
const SEAT_ENDS: ReadonlySet<string> = new Set([
  "polity.succession",
  "strife.coup",
  "strife.throne",
  "strife.revolution",
  "court.seized",
]);

const tiding = (
  w: Watch,
  name: string,
  ref: string,
  year: number,
  claim: string,
  type: string,
  importance: number,
): Tiding => ({ watch: w.ref, label: name, ref: ref as Ref, year, claim, type, importance });

// —— A ruler ———————————————————————————————————————————————————————————————————————————————

const realmOfRule = (world: World, ref: string) =>
  politiesOf(world).get(ref.slice("rule:".length) as Ref);

/** Each reign's end once found (a pure memo: what has happened does not change). */
const ENDS = new WeakMap<World, Map<string, HistoryEvent>>();

/** When the reign followed ended: the first event after its start that took the seat (null: it goes on). */
function reignEnd(world: World, realm: Ref, of: Ref): HistoryEvent | null {
  const memo = ENDS.get(world) ?? new Map<string, HistoryEvent>(),
    known = memo.get(of);
  if (known) return known;
  ENDS.set(world, memo);
  const start = world.events.get(of);
  if (!start) return null;
  const events = world.events;
  for (let i = firstAfter(events, start.t); i < events.count; i++) {
    const e = events.at(i);
    if (e.id !== of && SEAT_ENDS.has(e.type) && e.subjects.includes(realm)) {
      memo.set(of, e);
      return e;
    }
  }
  return null;
}

defineWatchKind({
  test: (ref) => ref.startsWith("rule:"),
  record: (world, ref) => realmOfRule(world, ref)?.ruler.event ?? null,
  label: (world, ref, w) => {
    const r = realmOfRule(world, ref);
    if (!r) return null;
    if (!w?.of || r.ruler.event === w.of) return r.ruler.name;
    return `${w.name ?? "One"}, who ruled ${r.town}`;
  },
  news: (world, w) => {
    const r = realmOfRule(world, w.ref);
    if (!r) return () => false;
    const passed = !!w.of && r.ruler.event !== w.of,
      end = passed ? reignEnd(world, r.ref, w.of as Ref) : null,
      until = passed ? (end?.t ?? -Infinity) : Infinity;
    return (e) =>
      e.t <= until &&
      e.subjects.includes(r.ref) &&
      (e.id === end?.id ||
        e.importance >= NEWS ||
        e.type === "polity.succession" ||
        e.type.startsWith("court."));
  },
});

// —— One of a court ————————————————————————————————————————————————————————————————————————

defineWatchKind({
  test: (ref) => ref.startsWith("court:"),
  label: (world, ref) => {
    const at = courtFigure(world, ref);
    return at ? (at.f ?? at.gone)!.name : null;
  },
  news: (world, w) => {
    const at = parseCourtRef(w.ref),
      read = courtFigure(world, w.ref),
      realm = at?.realm,
      left = read?.gone?.event ?? null;
    if (!at || !realm) return () => false;
    return (e) =>
      e.subjects.includes(realm as Ref) &&
      ((e.data as { fig?: number } | null)?.fig === at.id || e.id === left);
  },
});

// —— One of a town's many ——————————————————————————————————————————————————————————————————

/** A line holder by their ref, with their roster (null: none). */
function holderOf(world: World, ref: string) {
  const at = parseTownsfolkRef(ref);
  if (!at || at.n === null) return null;
  const roster = townRoster(world, at.town),
    h = roster.holderOf(at.line, at.n);
  return h ? { roster, h, holds: roster.holder(at.line)?.n === h.n } : null;
}

defineWatchKind({
  test: (ref) => ref.startsWith("folk:town:"),
  label: (world, ref) => {
    const at = holderOf(world, ref);
    return at ? at.roster.nameOf(at.h) : null;
  },
  news: (world, w) => {
    const at = holderOf(world, w.ref);
    if (!at) return (e) => e.subjects.includes(w.ref as Ref);
    const own = new Set([...at.h.fates.map((f) => f.event), ...at.h.struck.map((s) => s.event)]);
    return (e) => own.has(e.id) || e.subjects.includes(w.ref as Ref);
  },
  lives: (world, w, name, from, to) => {
    const at = holderOf(world, w.ref);
    // (One who fell, or whom a strike killed, is told by that event.)
    if (!at || at.holds || at.h.fates.some((f) => f.fate === "fell")) return [];
    if (at.h.struck.some((s) => s.fate === "died")) return [];
    const year = at.h.died ?? at.h.end - 1;
    return year >= from && year <= to
      ? [
          tiding(
            w,
            name,
            w.ref,
            year,
            `${name} is no longer among the town's people, from year ${year}`,
            "life.died",
            END,
          ),
        ]
      : [];
  },
});

// —— A maker at their seat, the healer ———————————————————————————————————————————————————

function seatOf(world: World, ref: string) {
  if (ref.startsWith("heal:")) return seatHolder(world, ref.slice("heal:".length), "healer", 0);
  const s = parseSeatRef(ref);
  return s ? seatHolder(world, s.town, s.trade, s.seat) : null;
}

defineWatchKind({
  test: (ref) => ref.startsWith("seat:") || ref.startsWith("heal:"),
  label: (world, ref, w) => {
    const h = seatOf(world, ref);
    if (!h) return null;
    return !w?.name || h.name === w.name ? h.name : `${w.name}, who held a seat of ${h.townName}`;
  },
  news: (_world, w) => (e) => e.subjects.includes(w.ref as Ref),
  lives: (world, w, name, from, to) => {
    const h = seatOf(world, w.ref);
    if (!h || !w.name || h.name === w.name) return [];
    // (The seat passed in the year its holder now took it.)
    const year = Math.floor(world.now / YEAR) - h.years;
    return year >= from && year <= to
      ? [
          tiding(
            w,
            name,
            w.ref,
            year,
            `${w.name} no longer holds the seat: ${h.name} took it, in year ${year}`,
            "life.left",
            LIFE,
          ),
        ]
      : [];
  },
});

// —— One of a battle's levy, one of a far people ——————————————————————————————————————————

defineWatchKind({
  test: (ref) => parseLevyManRef(ref) !== null,
  label: (world, ref) => resolveLevyMan(world, ref)?.name ?? null,
  news: (_world, w) => (e) => e.subjects.includes(w.ref as Ref),
});

/** A far people's one: their people's ref. */
const folkOfOne = (ref: string) => ref.slice("folkone:".length, ref.lastIndexOf(":"));

defineWatchKind({
  test: (ref) => ref.startsWith("folkone:"),
  label: (world, ref) => {
    const f = folkByRef(world, folkOfOne(ref));
    return f ? `One of the ${f.name}` : null;
  },
  news: (world, w) => {
    const of = folkOfOne(w.ref) as Ref;
    return (e) => e.subjects.includes(of);
  },
});

// —— A family ——————————————————————————————————————————————————————————————————————————————

defineWatchKind({
  test: (ref) => isFamilyRef(ref),
  label: (world, ref) => familyName(world, ref),
  news: (world, w) => {
    const h = w.ref.startsWith("dyn:") ? houseOf(world, w.ref) : null;
    if (h) return houseNews(world, h);
    const l = w.ref.startsWith("line:") ? lineOf(world, w.ref) : null;
    if (!l) return () => false;
    const own = lineEvents(l);
    return (e) => own.has(e.id);
  },
  lives: (world, w, name, from, to) => {
    // (A line's new holder heads it from the year they took it up.)
    const l = w.ref.startsWith("line:") ? lineOf(world, w.ref) : null,
      h = l?.holder;
    if (!l || !h || h.from < from || h.from > to || !l.before.length) return [];
    return [
      tiding(
        w,
        name,
        h.ref,
        h.from,
        `${l.nameOf(h)} took up ${name}, after ${l.nameOf(l.before[0]!)}, in year ${h.from}`,
        "life.heads",
        LIFE,
      ),
    ];
  },
});

// —— On a page ———————————————————————————————————————————————————————————————————————————

/** Why one a page is about cannot be followed, where they cannot. */
function whyNot(ref: string): string {
  if (ref.startsWith("agent:"))
    return "One under your hand is followed while your hand rests on their town: lay it there again to follow them.";
  return "History keeps no record of them to follow: only what this page shows.";
}

/**
 * A page about a person or a family, with the way to follow it and to keep it on the people bar: every one of them, whatever
 * kind of record holds them. Where they cannot be followed the page says why, and the button stays.
 */
export function withFollow(world: World, page: PageModel): PageModel {
  const person = page.kind === "person" || page.kind === "agent",
    family = page.kind === "family";
  // (A group, a federation, an operation: kept on the bar as it stands, though history follows no one of it.)
  if (!person && !family)
    return /^(mob|gfed|uop|org|ofed):/.test(page.ref)
      ? { ...page, pin: { ref: page.ref, name: page.title } }
      : page;
  const can = canWatch(world, page.ref as Ref),
    // (A ruler followed whose seat has passed: this page is of the one there now, who is not followed.)
    had = page.ref.startsWith("rule:") ? observer(world).watches.get(page.ref) : undefined,
    r = had?.of ? realmOfRule(world, page.ref) : undefined,
    stale = had && r && r.ruler.event !== had.of ? had.name : undefined;
  return {
    ...page,
    followable: can,
    ...(can ? {} : { followWhy: whyNot(page.ref) }),
    ...(stale ? { followPassed: stale } : {}),
    pin: { ref: page.ref, name: page.title },
  };
}

/** Who stands for a family on the people bar: its head (null: no one history names heads it). */
export function familyOnBar(
  world: World,
  ref: string,
): { head: { ref: string; name: string } | null; name: string } | null {
  const name = familyName(world, ref);
  return name ? { head: familyHead(world, ref), name } : null;
}

// —— A group's head; one who holds an office ————————————————————————————————————————————————

defineWatchKind({
  test: (ref) => /^boss:pol:d+:d+:ev:d+:d+$/.test(ref),
  label: (world, ref) => headLeader(world, ref)?.name ?? null,
  // (What is news of their group is news of them: its wars, soldiers sent against it, its head taken.)
  news: (world, w) => {
    const g = groupOf(world, w.ref.replace(/^boss:/, "mob:"));
    return g ? groupNews(g) : () => false;
  },
});
defineWatchKind({
  test: (ref) => ref.startsWith("note:"),
  label: (world, ref) => notableOf(world, ref)?.name ?? goneNotable(world, ref)?.name ?? null,
  news: () => () => false,
});
