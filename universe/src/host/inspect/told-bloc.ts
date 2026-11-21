// An alliance's year told (asked 2026-11-20: "do the summary thing for alliances too pleae actually too like years, decade like
// what you got for countries alone but also now on alliance tab"): what one alliance's year was, read as a realm's is, from what
// it is: who stood in it and who led it, who came in and who left and why, the wars its realms called each other to and who
// came, the foes they fought side by side, the peace they made, the marriages and roads among them, their quarrels, and how it
// stood against the other alliances of the world by its people, its hosts and its lands' wealth.
//
// An alliance is no thing the world keeps: it is the realms who stand with the strongest they are bound to (ties.ts blocsOf),
// named by whoever stands at its head. What it was in a year is read from what the years keep of each realm (host/years.ts):
// the head of the alliance each stood in, as it changed. So an alliance's past is the past of its head realm's alliance:
// in a year that realm stood under a stronger one, the alliance is the stronger's, and said so. Built when its page asks and
// kept with the reading of its years (told.ts READERS); nothing is kept in the world, nothing read as the years go by.
import type { HistoryEvent, Ref, World } from "../../kernel/index.ts";
import { offworldSite } from "../../gen/index.ts";
import { homePlanet, hostOf, politiesOf, populationContext, warsOf } from "../../sim/index.ts";
import type { Line, Span } from "../../bridge/index.ts";
import { LAND_COLUMNS, fromSteps, logAt, yearsOf, type RealmLog } from "../years.ts";
import { realmColor } from "../colors.ts";
import { alliancesOf, blocsOf } from "./ties.ts";
import { count, link, sentence, yearNow } from "./words.ts";
import type { Told } from "./annals.ts";

type Rgb = readonly [number, number, number];

/** The ref an alliance's tellings are asked by: its head realm's, as its page's (`bloc:pol:0:12`). */
export const BLOC = "bloc:";

/** What a run of an alliance's own numbers is read over, either side of a year asked. */
const NUMBERS_BACK = 22;

/** A realm's numbers in a year: its people and lands on its home world, and its host. */
export type Numbers = { realms: number; people: number; lands: number; host: number };

/** An alliance's years, read from the years kept of its realms. */
export type BlocYears = {
  /** The realm whose alliance it is (its page's head). */
  readonly head: string;
  readonly now: number;
  /** The first year kept of its head realm (none before it can be told). */
  readonly first: number;
  /** The realm it stood under in a year ("": it stood in none). */
  headAt(y: number): string;
  /** Its realms in a year, its head first. */
  members(y: number): readonly string[];
  /** The head of the alliance any realm stood under in a year ("": none). */
  under(ref: string, y: number): string;
  /** Whether a realm stood in it in a year. */
  isIn(ref: string, y: number): boolean;
  /** The first year of a realm's unbroken stand in it, to a year. */
  sinceOf(ref: string, y: number): number;
  /** The first year of its own unbroken stand, to a year (it stood then). */
  standingSince(y: number): number;
  /** Its realms' numbers summed, in a year (null: not kept). */
  numbers(y: number): Numbers | null;
  /** Every alliance's numbers in a year, by its head. */
  table(y: number): ReadonlyMap<string, Numbers>;
  /** A realm's own numbers in a year (null: not counted). */
  realm(ref: string, y: number): Numbers | null;
  /** The year its numbers of a year were last counted in (far back, the decade's; null: none near). */
  counted(y: number): number | null;
  /** How many times a realm has come into it, to a year (this coming the last). */
  comings(ref: string, y: number): number;
  /** How many times a realm has left it, to a year (this going the last). */
  goings(ref: string, y: number): number;
  /** How many other realms of its seat's name stood in it before a year (a name comes back, centuries on). */
  namesakes(ref: string, y: number): number;
  /** The people of every realm in a year, summed (the world's who stand in a realm). */
  peopled(y: number): number;
  /** What its lands held a head at a decade's year, summed over its people (undefined: not kept). */
  worth(y: number): number | undefined;
  /** Read the numbers of a run of years at once (one pass over the lands). */
  prepare(from: number, to: number): void;
  /** The years kept are thinned past a century: who stood with whom then is kept by the half-century. */
  readonly rough: (y: number) => boolean;
};

const townOf = (world: World, ref: string): string =>
  politiesOf(world).get(ref as Ref)?.town ?? "a realm now gone";

/** An alliance's name in a year: by who stood at its head then. */
export function blocNameAt(world: World, head: string): string {
  return head ? `the alliance of ${townOf(world, head)}` : "no alliance";
}

/** Whether a ref asks for an alliance. */
export const isBloc = (ref: string | null | undefined): ref is string => !!ref?.startsWith(BLOC);

/** The alliance's own name and colour now (a gone one: by its head realm). */
export function blocSubject(
  world: World,
  ref: string,
): { ref: string; name: string; color: Rgb } | null {
  const head = ref.slice(BLOC.length),
    p = politiesOf(world).get(head as Ref);
  if (!p && !yearsOf(world)?.realms.has(head)) return null;
  const a = alliancesOf(world).find((x) => x.head === head);
  return {
    ref,
    name: a ? a.name : `the alliance of ${p?.town ?? "a realm now gone"}`,
    color: a ? a.color : realmColor(head),
  };
}

/** An alliance's years (null: no years of its head are kept). */
export function blocYears(world: World, head: string): BlocYears | null {
  const store = yearsOf(world);
  if (!store) return null;
  const log = store.realms.get(head),
    realms = politiesOf(world),
    now = yearNow(world),
    live = blocsOf(world),
    liveHead = live.head.get(head as Ref),
    liveBloc = liveHead && live.blocs.has(liveHead) ? liveHead : "";
  if (!log && !liveBloc) return null;
  const alive = (ref: string, y: number) => {
    const p = realms.get(ref as Ref);
    return !!p && p.founded <= y && (p.ended === null || y < p.ended);
  };
  const at = (l: RealmLog | undefined, ref: string, y: number): string => {
    if (y >= now) {
      const h = live.head.get(ref as Ref);
      return h && live.blocs.has(h) ? h : "";
    }
    if (!l || y < l.first || !alive(ref, y)) return "";
    return logAt(l.bloc, y) ?? "";
  };
  // Every realm that ever stood under a head its own alliance stood under.
  const heads = new Set<string>(log?.bloc.v.filter(Boolean) ?? []);
  if (liveBloc) heads.add(liveBloc);
  const candidates: [string, RealmLog | undefined][] = [];
  for (const [ref, l] of store.realms)
    if (l.bloc.v.some((h) => heads.has(h))) candidates.push([ref, l]);
  if (liveBloc)
    for (const r of live.blocs.get(liveBloc) ?? [])
      if (!candidates.some(([c]) => c === r)) candidates.push([r, store.realms.get(r)]);
  const headMemo = new Map<number, string>(),
    memberMemo = new Map<number, readonly string[]>(),
    headAt = (y: number) => {
      let h = headMemo.get(y);
      if (h === undefined) headMemo.set(y, (h = at(log, head, y)));
      return h;
    },
    members = (y: number): readonly string[] => {
      let m = memberMemo.get(y);
      if (m) return m;
      const h = headAt(y);
      if (!h) m = [];
      else if (y >= now) m = [...(live.blocs.get(h as Ref) ?? [])];
      else {
        const list: string[] = [];
        for (const [ref, l] of candidates) if (at(l, ref, y) === h) list.push(ref);
        // (Its head first, then the realms as the log lists them.)
        list.sort((a, b) => Number(b === h) - Number(a === h));
        m = list.length >= 2 ? list : [];
      }
      memberMemo.set(y, m);
      return m;
    },
    isIn = (ref: string, y: number) => members(y).includes(ref);
  // Every coming in and going out, year by year (one realm's place turns on the others too: two make an
  // alliance, so it can stop standing with no change of its own). Read once, when a coming is first counted.
  let passMemo: { came: Map<string, number[]>; left: Map<string, number[]> } | null = null;
  const passes = () => {
    if (passMemo) return passMemo;
    const came = new Map<string, number[]>(),
      left = new Map<string, number[]>(),
      push = (m: Map<string, number[]>, r: string, y: number) => {
        const l = m.get(r);
        if (l) l.push(y);
        else m.set(r, [y]);
      };
    let prev = new Set<string>();
    for (let y = Math.max(0, log?.first ?? now); y <= now; y++) {
      const cur = new Set(members(y));
      for (const r of cur) if (!prev.has(r)) push(came, r, y);
      for (const r of prev) if (!cur.has(r)) push(left, r, y);
      prev = cur;
    }
    return (passMemo = { came, left });
  };
  /** The years a realm's place in it could have changed, latest first, to a year. */
  const turns = (ref: string, y: number): number[] => {
    const set = new Set<number>([now]);
    for (const l of [log, store.realms.get(ref)]) if (l) for (const t of l.bloc.y) set.add(t);
    for (const r of [head, ref]) {
      const p = realms.get(r as Ref);
      if (p) {
        set.add(p.founded);
        if (p.ended !== null) set.add(p.ended);
      }
    }
    return [...set].filter((t) => t <= y).sort((a, b) => b - a);
  };
  const first = log?.first ?? now,
    b0 = Math.max(0, first);
  const sinceMemo = new Map<string, number>();
  const sinceOf = (ref: string, y: number): number => {
    const key = `${ref}|${y}`,
      hit = sinceMemo.get(key);
    if (hit !== undefined) return hit;
    let since = y;
    for (const t of turns(ref, y)) {
      // (In it the year the change was written, and not the year before: there it came in.)
      if (t < first) break;
      since = t;
      if (!isIn(ref, t - 1)) break;
      since = Math.max(first, t - 1);
    }
    sinceMemo.set(key, since);
    return since;
  };
  const standingSince = (y: number): number => {
    let since = y;
    for (const t of turns(head, y)) {
      if (t < first) break;
      since = t;
      if (!headAt(t - 1)) break;
      since = Math.max(first, t - 1);
    }
    return since;
  };
  // Each realm's people, lands and host in a year: one pass over the lands for the years asked.
  const g = homePlanet(world).generated,
    ctx = populationContext(world),
    per = new Map<number, Map<string, Numbers>>(),
    hostShare = (ref: string, y: number) => logAt(store.realms.get(ref)?.host, y),
    prepare = (from: number, to: number) => {
      const want = new Set<number>();
      for (let y = Math.max(0, from); y <= Math.min(now, to); y++) if (!per.has(y)) want.add(y);
      if (!want.size) return;
      for (const y of want) per.set(y, new Map());
      if (want.has(now)) {
        const m = per.get(now)!;
        for (const p of realms.living()) {
          let people = 0,
            lands = 0;
          for (const c of p.members) {
            if (offworldSite(g, c)) continue;
            lands++;
            people += ctx.provinces.get(c)?.total() ?? 0;
          }
          m.set(p.ref, { realms: 1, people, lands, host: hostOf(ctx, p) });
        }
      }
      for (const [cell, l] of store.landRealm) {
        if (offworldSite(g, cell)) continue;
        for (const line of ctx.history.yearsOf(cell)) {
          const y = line.year;
          if (y >= now || !want.has(y) || y < l.first) continue;
          const ref = logAt(l, y);
          if (!ref) continue;
          const m = per.get(y)!,
            a = m.get(ref);
          if (a) {
            a.people += line.population;
            a.lands++;
          } else m.set(ref, { realms: 1, people: line.population, lands: 1, host: 0 });
        }
      }
      for (const y of want) {
        if (y >= now) continue;
        for (const [ref, a] of per.get(y)!) {
          const s = hostShare(ref, y);
          a.host = s === undefined ? 0 : Math.round((a.people * s) / 10_000);
        }
      }
    },
    realmNumbers = (y: number): Map<string, Numbers> | null => {
      if (y < 0 || y > now) return null;
      if (!per.has(y)) prepare(y - NUMBERS_BACK, y + 1);
      const m = per.get(y)!;
      // (A year whose lands were not counted: no line of history holds it.)
      return m.size ? m : null;
    };
  const numbers = (y: number): Numbers | null => {
    const list = members(y),
      m = realmNumbers(y);
    if (!list.length || !m) return null;
    const out: Numbers = { realms: list.length, people: 0, lands: 0, host: 0 };
    for (const r of list) {
      const a = m.get(r);
      if (!a) continue;
      out.people += a.people;
      out.lands += a.lands;
      out.host += a.host;
    }
    return out;
  };
  const tables = new Map<number, Map<string, Numbers>>();
  const table = (y: number): ReadonlyMap<string, Numbers> => {
    const hit = tables.get(y);
    if (hit) return hit;
    const out = new Map<string, Numbers>(),
      m = realmNumbers(y);
    // (Every realm by the alliance it stood in, counted whether or not its lands were: an alliance is its realms.)
    if (m) {
      const add = (ref: string, h: string) => {
        if (!h) return;
        const a = m.get(ref),
          s = out.get(h) ?? { realms: 0, people: 0, lands: 0, host: 0 };
        s.realms++;
        s.people += a?.people ?? 0;
        s.lands += a?.lands ?? 0;
        s.host += a?.host ?? 0;
        out.set(h, s);
      };
      if (y >= now) for (const [h, list] of live.blocs) for (const r of list) add(r, h);
      else for (const [ref, l] of store.realms) add(ref, at(l, ref, y));
    }
    // (Two or more stand in an alliance: a head alone is none.)
    for (const [h, s] of out) if (s.realms < 2) out.delete(h);
    tables.set(y, out);
    return out;
  };
  const peopledMemo = new Map<number, number>(),
    peopled = (y: number): number => {
      let n = peopledMemo.get(y);
      if (n === undefined) {
        n = 0;
        for (const a of realmNumbers(y)?.values() ?? []) n += a.people;
        peopledMemo.set(y, n);
      }
      return n;
    };
  const worthMemo = new Map<number, number | undefined>(),
    WORTH = LAND_COLUMNS.indexOf("worth");
  const worth = (y: number): number | undefined => {
    if (worthMemo.has(y)) return worthMemo.get(y);
    const list = new Set(members(y));
    let n: number | undefined;
    if (list.size && store.landYears.includes(y)) {
      n = 0;
      for (const [cell, l] of store.landRealm) {
        if (offworldSite(g, cell) || y < l.first || !list.has(logAt(l, y) ?? "")) continue;
        const rows = store.landRows(cell),
          i = rows ? rows.years.indexOf(y) : -1;
        if (!rows || i < 0) continue;
        const k = rows.cols[WORTH]![i]!;
        if (k <= -1_000_000) continue;
        const people = ctx.history.yearsOf(cell).find((x) => x.year === y)?.population ?? 0;
        n += Math.max(0, fromSteps(k)) * people;
      }
    }
    worthMemo.set(y, n);
    return n;
  };
  return {
    head,
    now,
    first,
    headAt,
    members,
    under: (ref, y) => at(store.realms.get(ref), ref, y),
    isIn,
    sinceOf,
    standingSince,
    numbers,
    table,
    realm: (ref, y) => realmNumbers(y)?.get(ref) ?? null,
    counted: (y) => {
      for (const at of [y, Math.floor(y / 10) * 10, Math.floor(y / 100) * 100])
        if (at >= b0 && realmNumbers(at) && headAt(at)) return at;
      return null;
    },
    comings: (ref, y) => (passes().came.get(ref) ?? []).filter((t) => t <= y).length,
    goings: (ref, y) => (passes().left.get(ref) ?? []).filter((t) => t <= y).length,
    namesakes: (ref, y) => {
      const town = realms.get(ref as Ref)?.town;
      if (!town) return 0;
      let n = 0;
      for (const [r, years] of passes().came)
        if (r !== ref && years[0]! < y && realms.get(r as Ref)?.town === town) n++;
      return n;
    },
    peopled,
    worth,
    prepare,
    rough: (y) => y < now - 100,
  };
}

// ————— What an alliance's year holds of its own —————

const WORDS = "no one two three four five six seven eight nine ten eleven twelve".split(" ");
const said = (n: number): string => WORDS[n] ?? count(n);
const ORD =
  "zeroth first second third fourth fifth sixth seventh eighth ninth tenth eleventh twelfth".split(
    " ",
  );
const ordinal = (n: number): string => {
  if (ORD[n]) return ORD[n]!;
  const teen = n % 100 >= 11 && n % 100 <= 13;
  return `${count(n)}${teen ? "th" : n % 10 === 1 ? "st" : n % 10 === 2 ? "nd" : n % 10 === 3 ? "rd" : "th"}`;
};
/** A number said short: 1.13 billion, 29.2 million, 14,200. */
export function shortWords(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(a >= 1e10 ? 1 : 2)} billion`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(a >= 1e7 ? 1 : 2)} million`;
  return count(n);
}

/** A realm as a link to its own year told (where it stands still or stood then), else to its page. */
function realmYear(world: World, ref: string, y: number): Span {
  const p = politiesOf(world).get(ref as Ref);
  if (!p) return "a realm now gone";
  return link(p.town, `told:${y}:${ref}`);
}

/** Realms as one list of links: "A, B and C", the first few. */
function realmsSaid(world: World, refs: readonly string[], y: number, most = 6): Line {
  const shown = refs.slice(0, most),
    out: Span[] = [];
  shown.forEach((r, i) => {
    if (i) out.push(i === shown.length - 1 && refs.length <= most ? " and " : ", ");
    out.push(realmYear(world, r, y));
  });
  if (refs.length > most) out.push(`, and ${count(refs.length - most)} more`);
  return out;
}

/** The types of happening whose two sides an alliance's year holds as its own when one or both stand in it. */
const ONE_SIDE = new Set([
  "diplomacy.pact",
  "diplomacy.broken",
  "ties.league",
  "ties.league.ended",
  "ties.council",
  "war.peace",
]);
const BOTH_SIDES = new Set([
  "ties.match",
  "ties.embassy",
  "ties.envoy",
  "war.declared",
  "trade.embargo",
  "terms.rose",
  "terms.ended",
  "terms.unpaid",
]);

/** Whether a happening is the alliance's own doing (its section's): a call, a bond, a peace, a quarrel among its own. */
export function blocOwn(e: HistoryEvent | undefined, inIt: ReadonlySet<string>): boolean {
  if (!e) return false;
  if (e.type === "ties.answered")
    // (One of it called, or was called: [called, friend, foe].)
    return inIt.has(e.subjects[1] ?? "") || inIt.has(e.subjects[0] ?? "");
  const realms = e.subjects.filter((s) => s.startsWith("pol:"));
  if (ONE_SIDE.has(e.type)) return realms.some((s) => inIt.has(s));
  if (BOTH_SIDES.has(e.type)) return realms.filter((s) => inIt.has(s)).length >= 2;
  return false;
}

/** The kinds of happening that tell why a realm came in, the likeliest first. */
const CAME_BY = [
  "ties.league",
  "diplomacy.pact",
  "war.peace",
  "terms.rose",
  "ties.council",
  "ties.match",
];

/** A happening of a year or the one before naming a realm and one of others, of the first kind found in an order. */
function found(
  events: (y: number) => readonly HistoryEvent[],
  y: number,
  ref: string,
  others: ReadonlySet<string>,
  types: readonly string[],
  alone = false,
): HistoryEvent | null {
  for (const type of types)
    for (const at of [y, y - 1])
      for (const e of events(at))
        if (
          e.type === type &&
          e.subjects.includes(ref as Ref) &&
          (alone || e.subjects.some((s) => s !== ref && others.has(s)))
        )
          return e;
  return null;
}

/** The happenings of a year an alliance's lines are read from: every one of the log's, by its years' own reading. */
export type YearEvents = (y: number) => readonly HistoryEvent[];

/**
 * What an alliance's year holds of its own: its forming and its end, who came in and who left and why, a new head, and the
 * foes its realms fought side by side. Each a line the year's telling weighs with the rest, and opens the happening behind it.
 */
export function blocTold(world: World, b: BlocYears, y: number, events: YearEvents): Told[] {
  const out: Told[] = [],
    h = b.headAt(y),
    was = b.headAt(y - 1),
    cur = b.members(y),
    prev = y - 1 >= b.first ? b.members(y - 1) : [],
    inNow = new Set(cur),
    inBefore = new Set(prev),
    joined = cur.filter((r) => !inBefore.has(r)),
    left = prev.filter((r) => !inNow.has(r)),
    known = y - 1 >= b.first,
    name = blocNameAt(world, h),
    add = (key: string, worth: number, ref: string, say: () => Line) =>
      out.push({ kind: 3, worth, ref, key, say });
  const nums = b.numbers(y),
    // (A realm a quarter of its people or more is a great coming.)
    big = (r: string) => !!nums?.people && (b.realm(r, y)?.people ?? 0) / nums.people >= 0.25;
  if (!known && !cur.length) return out;
  // Formed: it stood, and none of its realms stood under its head the year before; else its head realm came into another.
  if (h && !was && known) {
    const formed = !cur.some((r) => r !== b.head && b.under(r, y - 1) === h),
      cause =
        found(events, y, b.head, new Set(cur), CAME_BY) ??
        (formed
          ? found(
              events,
              y,
              cur.find((r) => r !== b.head)!,
              new Set(cur),
              CAME_BY,
            )
          : null);
    // (Which of its stands this is: an alliance of the same two may come apart and be sworn again.)
    let stands = 1;
    for (let x = y - 1; x > b.first; x--) if (b.headAt(x) && !b.headAt(x - 1)) stands++;
    if (formed)
      add("bloc.formed", 6, cause?.id ?? `told:${y}:${h}`, () => [
        sentence(name),
        stands > 1 ? ` came together again, the ${ordinal(stands)} time: ` : " came to be: ",
        ...realmsSaid(world, cur, y),
        ` bound together${cause ? boundBy(world, cause) : ""}.`,
      ]);
    else
      add("bloc.joined", 5, cause?.id ?? `bloc:${h}`, () => [
        realmYear(world, b.head, y),
        ` came into ${name}`,
        cause ? by(world, cause, b.head) : "",
        `, ${said(cur.length)} realms in it now.`,
      ]);
    return out;
  }
  // Ended, or its head realm came to stand alone (or fell).
  if (!h && was && known) {
    const fell = politiesOf(world).get(b.head as Ref)?.ended;
    if (fell !== undefined && fell !== null && fell <= y) return out; // (Its fall is its own line.)
    const why = leftWhy(world, b, y, b.head, new Set(prev), events);
    add(
      was === b.head ? "bloc.ended" : "bloc.left",
      was === b.head ? 6 : 4,
      why.ref ?? `bloc:${was}`,
      () =>
        was === b.head
          ? [sentence(blocNameAt(world, was)), " came apart: ", ...why.line, "."]
          : [realmYear(world, b.head, y), ` left ${blocNameAt(world, was)}: `, ...why.line, "."],
    );
    return out;
  }
  if (!h) return out;
  // A new head: one stronger came in, or the one at its head fell or left (and how many times this one has led it).
  const again = (lead: string) => {
    let n = 0;
    for (let x = y; x > b.first; x--) if (b.headAt(x) === lead && b.headAt(x - 1) !== lead) n++;
    return n;
  };
  if (was && was !== h) {
    const came = !inBefore.has(h),
      cause = came ? found(events, y, h, inBefore, CAME_BY) : null;
    add("bloc.head", 5, cause?.id ?? `told:${y}:${h}`, () => [
      realmYear(world, h, y),
      came
        ? ` came in${cause ? by(world, cause, h) : ""}, and leads it now: it fields more than any of them`
        : ` leads it ${again(h) > 1 ? `again, the ${ordinal(again(h))} time` : "now"}, in place of ${townOf(world, was)}`,
      came && joined.length > 1
        ? `, and ${said(joined.length - 1)} of its own came in with it`
        : "",
      ".",
    ]);
  }
  // Who came in, and why.
  const newcomers = joined.filter((r) => r !== h || !(was && was !== h));
  // (A realm of a name another realm stood in it under before: which of that name it is, "a second Stougyney".)
  const namesake = (r: string) => {
    const n = b.namesakes(r, y);
    return n ? `A ${ordinal(n + 1)} ` : "";
  };
  // (A whole alliance come in with a new head is one line, said above.)
  if (!(was && was !== h && !inBefore.has(h)))
    for (const r of newcomers.slice(0, 4)) {
      const cause = found(events, y, r, inNow, CAME_BY),
        times = b.comings(r, y);
      add("bloc.joined", big(r) ? 5 : 4, cause?.id ?? `told:${y}:${r}`, () => [
        namesake(r),
        realmYear(world, r, y),
        ` came into ${name}${times > 1 ? ` for the ${ordinal(times)} time` : ""}`,
        cause ? by(world, cause, r, h) : ", drawn in by those it was bound to",
        ".",
      ]);
    }
  // Who left, and why (a fall is told by its own line).
  for (const r of left.slice(0, 4)) {
    const p = politiesOf(world).get(r as Ref);
    if (p?.ended !== null && p?.ended !== undefined && p.ended <= y) continue;
    const why = leftWhy(world, b, y, r, inBefore, events),
      times = b.goings(r, y);
    add("bloc.left", 4, why.ref ?? `told:${y}:${r}`, () => [
      namesake(r),
      realmYear(world, r, y),
      ` left ${name}${times > 1 ? ` for the ${ordinal(times)} time` : ""}: `,
      ...why.line,
      ".",
    ]);
  }
  // The foes two or more of it fought side by side.
  for (const t of together(world, b, y).slice(0, 2))
    add(`bloc.together`, t.fallen >= 10_000 ? 5 : 4, t.ref, () => [
      ...realmsSaid(world, t.sides, y, 4),
      " fought ",
      realmYear(world, t.foe, y),
      " side by side",
      y === t.since
        ? ` from ${count(y)}`
        : `, the ${ordinal(y - t.since + 1)} year since ${count(t.since)}`,
      t.battles ? `: ${said(t.battles)} ${t.battles === 1 ? "battle" : "battles"} in the year` : "",
      t.fallen ? `, ${count(t.fallen)} fallen` : "",
      ".",
    ]);
  return out;
}

/** How a happening bound realms together, as an alliance's beginning: "by a pact", "by the compact sworn against X". */
function boundBy(world: World, e: HistoryEvent): string {
  switch (e.type) {
    case "diplomacy.pact":
      return " by a pact";
    case "ties.league":
      return ` by the compact sworn against ${townOf(world, e.subjects[0]!)}`;
    case "war.peace":
      return " by the peace that ended their war";
    case "terms.rose":
      return " by an oath";
    case "ties.council":
      return " in a council of realms";
    case "ties.match":
      return " by a marriage of their houses";
    default:
      return "";
  }
}

/** How a happening bound a realm in: "by a pact with X", "by the compact against X", "by the peace that made it X's". */
function by(world: World, e: HistoryEvent, ref: string, head = ""): string {
  const other = e.subjects.find((s) => s !== ref && s.startsWith("pol:"));
  switch (e.type) {
    case "diplomacy.pact":
      return other === head
        ? " by a pact sworn with its head"
        : other
          ? ` by a pact with ${townOf(world, other)}`
          : " by a pact";
    case "ties.league":
      return " by the compact sworn against " + townOf(world, e.subjects[0]!);
    case "war.peace":
      return other ? ` by the peace it made with ${townOf(world, other)}` : " by a peace";
    case "terms.rose":
      return " by the terms of an oath";
    case "ties.council":
      return " by a council of realms";
    case "ties.match":
      return other ? ` by a marriage with the house of ${townOf(world, other)}` : " by a marriage";
    default:
      return "";
  }
}

const LEFT_BY = [
  "diplomacy.broken",
  "war.declared",
  "ties.league.ended",
  "terms.ended",
  "strife.coup",
  "strife.revolution",
];

/** Why a realm stood no longer with those it stood with: the happening behind it where history holds one. */
function leftWhy(
  world: World,
  b: BlocYears,
  y: number,
  r: string,
  before: ReadonlySet<string>,
  events: YearEvents,
): { line: Line; ref: string | null } {
  // (Gone over to another alliance.)
  const other = b.under(r, y);
  if (other === r) return { line: ["it leads an alliance of its own now"], ref: `bloc:${r}` };
  if (other && other !== b.headAt(y - 1)) {
    const cause = found(events, y, r, new Set([other]), [
      "diplomacy.pact",
      "ties.league",
      "war.peace",
      "terms.rose",
    ]);
    return {
      line: [
        `it went over to `,
        link(blocNameAt(world, other), `bloc:${other}`),
        cause ? by(world, cause, r) : "",
      ],
      ref: cause?.id ?? `bloc:${other}`,
    };
  }
  for (const type of LEFT_BY) {
    const alone = type.startsWith("strife.");
    const e = found(events, y, r, before, [type], alone);
    if (!e) continue;
    const with_ = e.subjects.find((s) => s !== r && before.has(s));
    const words: Line =
      type === "diplomacy.broken"
        ? [`its pact with ${with_ ? townOf(world, with_) : "another of it"} broke`]
        : type === "war.declared"
          ? [`it went to war with ${with_ ? townOf(world, with_) : "another of it"}`]
          : type === "ties.league.ended"
            ? ["the compact that bound it ended"]
            : type === "terms.ended"
              ? ["the oath that bound it ended"]
              : type === "strife.coup"
                ? ["its rulers were thrown down, and those who took the seat stood apart"]
                : ["a revolution overturned its rule, and the new rule stood apart"];
    return { line: words, ref: e.id };
  }
  // (Its partner fell.)
  for (const m of before) {
    if (m === r) continue;
    const p = politiesOf(world).get(m as Ref);
    if (p?.ended === y || p?.ended === y - 1)
      return { line: [`${p.town}, which it stood by, fell`], ref: p.ref };
  }
  return { line: ["no bond held it to the rest any longer"], ref: null };
}

/** The foes two or more of an alliance fought in a year: who of it, how many battles, how many fell, and the greatest battle. */
export function together(
  world: World,
  b: BlocYears,
  y: number,
): { foe: string; sides: string[]; battles: number; fallen: number; ref: string; since: number }[] {
  if (!world.hasStore("war.wars")) return [];
  const inIt = new Set(b.members(y)),
    by = new Map<
      string,
      {
        sides: Set<string>;
        battles: number;
        fallen: number;
        best: { n: number; ref: string };
        since: Map<string, number>;
      }
    >();
  for (const r of inIt)
    for (const w of warsOf(world).of(r as Ref)) {
      if (w.declared > y || (w.ended !== null && w.ended < y)) continue;
      const foe = w.attacker === r ? w.defender : w.attacker;
      if (inIt.has(foe)) continue;
      const a = by.get(foe) ?? {
        sides: new Set<string>(),
        battles: 0,
        fallen: 0,
        best: { n: -1, ref: w.event },
        since: new Map<string, number>(),
      };
      a.sides.add(r);
      a.since.set(r, Math.min(a.since.get(r) ?? Infinity, w.declared));
      for (const x of w.battles) {
        if (x.year !== y) continue;
        a.battles++;
        const f = x.fallen[0] + x.fallen[1];
        a.fallen += f;
        if (f > a.best.n) a.best = { n: f, ref: x.event };
      }
      by.set(foe, a);
    }
  return [...by]
    .filter(([, a]) => a.sides.size >= 2)
    .map(([foe, a]) => ({
      foe,
      sides: [...a.sides],
      battles: a.battles,
      fallen: a.fallen,
      ref: a.best.ref,
      // (Since the second of their wars on it began: the year two of it first stood side by side.)
      since: [...a.since.values()].sort((x, z) => x - z)[1] ?? y,
    }))
    .sort((x, z) => z.fallen - x.fallen || z.sides.length - x.sides.length);
}

// ————— Its section: what it was, said —————

/** What an alliance's year (or run of years) counted of itself, said: its realms, who came and went, its calls, its place. */
export function blocText(
  world: World,
  b: BlocYears,
  from: number,
  to: number,
  events: YearEvents,
): Line {
  const h = b.headAt(to),
    out: Span[] = [],
    run = to > from;
  let joined = 0,
    left = 0,
    called = 0,
    came = 0,
    wed = 0,
    roads = 0,
    quarrels = 0;
  for (let y = from; y <= to; y++) {
    const cur = b.members(y),
      prev = y - 1 >= b.first ? b.members(y - 1) : [],
      inIt = new Set([...cur, ...prev]);
    if (y - 1 >= b.first && cur.length && prev.length) {
      joined += cur.filter((r) => !prev.includes(r)).length;
      left += prev.filter((r) => !cur.includes(r)).length;
    }
    if (!inIt.size) continue;
    const lands = landsOf(world, b, y);
    for (const e of events(y)) {
      if (e.type === "ties.answered" && inIt.has(e.subjects[1] ?? "")) {
        called++;
        if ((e.data as { came?: boolean } | null)?.came) came++;
      } else if (e.type === "ties.match" && e.subjects.filter((s) => inIt.has(s)).length >= 2)
        wed++;
      else if (
        (e.type === "war.declared" ||
          e.type === "diplomacy.broken" ||
          e.type === "trade.embargo") &&
        e.subjects.filter((s) => inIt.has(s)).length >= 2
      )
        quarrels++;
      else if (e.type === "trade.route-opened" || e.type === "trade.sea-route") {
        const a = lands.get(e.subjects[0] ?? ""),
          c = lands.get(e.subjects[1] ?? "");
        if (a && c && a !== c) roads++;
      }
    }
  }
  const cur = b.members(to);
  if (cur.length) {
    out.push(
      `${sentence(said(cur.length))} realms stood in it as ${run ? "these years" : "the year"} closed`,
      // (Far back the kept years can have its head standing elsewhere: then it is not said to lead.)
      ...(cur.includes(h) ? [", led by ", realmYear(world, h, to)] : []),
      ": ",
      ...realmsSaid(world, cur, to, 8),
      ".",
    );
  } else if (b.members(from - 1).length || joined || left)
    out.push(`It stood no longer as ${run ? "these years" : "the year"} closed.`);
  else return [];
  const moves: string[] = [];
  if (joined) moves.push(`${said(joined)} ${joined === 1 ? "realm" : "realms"} came in`);
  if (left) moves.push(`${said(left)} left`);
  if (called)
    moves.push(
      `its realms called others to war ${said(called)} ${called === 1 ? "time" : "times"}: ${said(came)} came, ${said(called - came)} stood aside`,
    );
  if (wed) moves.push(`${said(wed)} ${wed === 1 ? "marriage" : "marriages"} tied its houses`);
  if (roads)
    moves.push(
      `${said(roads)} ${roads === 1 ? "road" : "roads"} of trade opened between its realms`,
    );
  if (quarrels)
    moves.push(
      `${said(quarrels)} ${quarrels === 1 ? "quarrel" : "quarrels"} broke out among its own`,
    );
  if (moves.length)
    out.push(
      ` ${sentence(moves.length > 2 ? `${moves.slice(0, -1).join("; ")}; and ${moves.at(-1)}` : moves.join(" and "))}.`,
    );
  // How it stood against the rest.
  const place = standingLine(world, b, to);
  if (place.length) out.push(" ", ...place);
  return out;
}

/** Which realm each land was of in a year (for the roads among its realms). */
function landsOf(world: World, b: BlocYears, y: number): Map<string, string> {
  const out = new Map<string, string>(),
    store = yearsOf(world),
    inIt = new Set(b.members(y));
  if (!store) return out;
  if (y >= b.now) {
    for (const r of inIt)
      for (const c of politiesOf(world).get(r as Ref)?.members ?? []) out.set(`cell:0:${c}`, r);
    return out;
  }
  for (const [cell, l] of store.landRealm) {
    const r = y >= l.first ? logAt(l, y) : undefined;
    if (r && inIt.has(r)) out.set(`cell:0:${cell}`, r);
  }
  return out;
}

/** How an alliance stood among the world's in a year, by its people: its place, and the greatest's (or the next's). */
export function standingLine(world: World, b: BlocYears, asked: number): Line {
  // (Far back, the lands' people are counted by the decade: its place as it was counted last.)
  const y = b.counted(asked);
  if (y === null) return [];
  const h = b.headAt(y),
    all = [...b.table(y)].sort((x, z) => z[1].people - x[1].people || (x[0] < z[0] ? -1 : 1)),
    i = all.findIndex(([k]) => k === h);
  if (!h || i < 0) return [];
  const mine = all[i]![1],
    world_ = b.peopled(y),
    shareOf = world_ ? ` (${Math.round((mine.people / world_) * 100)}% of the world's)` : "",
    other = i === 0 ? all[1] : all[0],
    out: Span[] = [
      y < asked ? `As counted in ${count(y)}: ` : "",
      i === 0
        ? `${y < asked ? "the" : "The"} greatest of ${said(all.length)} ${all.length === 1 ? "alliance" : "alliances"} by its people: ${shortWords(mine.people)}${shareOf}`
        : `${y < asked ? ordinal(i + 1) : sentence(ordinal(i + 1))} of ${said(all.length)} alliances by its people: ${shortWords(mine.people)}${shareOf}`,
    ];
  if (other) {
    out.push(i === 0 ? "; the next, " : "; the greatest, ");
    out.push(link(blocNameAt(world, other[0]), `bloc:${other[0]}`));
    out.push(`, held ${shortWords(other[1].people)}`);
  }
  // How its place moved in ten years.
  const back = y - 10;
  if (back >= b.first && b.headAt(back)) {
    const then = [...b.table(back)].sort(
        (x, z) => z[1].people - x[1].people || (x[0] < z[0] ? -1 : 1),
      ),
      j = then.findIndex(([k]) => k === b.headAt(back));
    if (j >= 0 && j !== i) out.push(`; ten years before it stood ${ordinal(j + 1)}`);
  }
  out.push(".");
  return out;
}

/** The head of the alliance a realm stood in, in a year ("": none). */
export function realmBlocAt(world: World, realm: string, y: number): string {
  if (y >= yearNow(world)) {
    const live = blocsOf(world),
      h = live.head.get(realm as Ref);
    return h && live.blocs.has(h) ? h : "";
  }
  const l = yearsOf(world)?.realms.get(realm),
    p = politiesOf(world).get(realm as Ref);
  if (!l || y < l.first || !p || (p.ended !== null && y >= p.ended)) return "";
  return logAt(l.bloc, y) ?? "";
}
