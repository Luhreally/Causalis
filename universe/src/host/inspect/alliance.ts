// An alliance read whole, as a grand strategy game's league screen reads one (asked 2026-11-12: "alliances should have more details and stats tbh
// like the leagues"): its weight in the world and its place among the alliances, who leads it and why, each realm of it side by side, what it held
// through the years, the wars it fought and how they went, how it came together, and what holds it and what strains it, each line read from what the
// rules weigh. The same depth for every alliance at once (their ranking, two side by side) and for a compact sworn against one realm. Pure readings:
// nothing is kept in the world, nothing is read each tick; what is read is kept here for the year it was read in.
import { YEAR, yearOfMoment, type Ref, type World } from "../../kernel/index.ts";
import { offworldSite } from "../../gen/index.ts";
import { TIES } from "../../rules/index.ts";
import {
  DIPLOMACY_EVENTS,
  PACT,
  RIVALRY,
  WAR_EVENTS,
  beliefOf,
  bondsOf,
  diplomacyOf,
  fieldedOf,
  homePlanet,
  languagesOf,
  livingMatches,
  loreOf,
  politiesOf,
  populationContext,
  realmName,
  tiesOf,
  warsOf,
  type League,
  type Polity,
  type War,
} from "../../sim/index.ts";
import {
  worthWords,
  type Block,
  type Item,
  type Line,
  type PageModel,
  type Row,
  type Stat,
  type Tab,
} from "../../bridge/index.ts";
import { realmColor } from "../colors.ts";
import { wealthBook } from "../wealth.ts";
import { landEra } from "../village.ts";
import { eraWords } from "./world.ts";
import { faithLink, languageLink, realmLink, spotOfLand } from "./names.ts";
import { claimOf, count, item, link, many, part, share, stat, yearNow } from "./words.ts";
import { alliancesOf, callLine, envoyLine, leagueName, standsHow, type Alliance } from "./ties.ts";

type Rgb = readonly [number, number, number];
type Point = { x: number; y: number };

/** How many years a dated row of an alliance's strength stands apart at the least, and how many rows at most. */
const STEP_LEAST = 10,
  STEP_ROWS = 7;
/** A member this share of an alliance's host or more is "far stronger than the rest". */
const LEANS_ON = 0.6;
/** A pact whose regard is under this is near breaking (it breaks below zero: diplomacy's rule). */
const NEAR_BREAKING = 0.1;
/** How many of the terms its realms' regard is made of are told, each way. */
const TERMS_SHOWN = 5;
/** How far back a war among its members, or a broken pact, still strains it (years). */
const STRAIN_YEARS = 60;

/** A large count, short enough for a phone's table: 9,999 as it is, then 12.3k, 4.56m, 1.2bn. */
export function short(n: number): string {
  const x = Math.round(n);
  if (Math.abs(x) < 10_000) return count(x);
  for (const [u, s] of [
    [1e9, "bn"],
    [1e6, "m"],
    [1e3, "k"],
  ] as const)
    if (Math.abs(x) >= u * 0.9995) return `${Number((x / u).toPrecision(3))}${s}`;
  return count(x);
}

/** A share in words, where a percentage would round to all or none of it. */
const part100 = (x: number) =>
  x >= 0.995 && x < 1 ? "nearly all" : x > 0 && x < 0.005 ? "almost none" : share(x);
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
const yearOfEvent = (world: World, e: Ref | null | undefined): number | null => {
  const t = e ? world.events.get(e)?.t : undefined;
  return t === undefined ? null : Math.floor(t / YEAR);
};

// ————— The world's own sums, and what history holds of lands taken and pacts broken (read once a year) —————

type Taken = { readonly y: number; readonly by: Ref; readonly from: Ref; readonly id: Ref };
type Broken = { readonly y: number; readonly a: Ref; readonly b: Ref; readonly id: Ref };
type YearRead = {
  readonly year: number;
  /** The home world's lands and people, the hosts every standing realm fields, and their wealth in all. */
  readonly lands: number;
  readonly people: number;
  readonly host: number;
  readonly worth: number;
  /** Each standing realm's host and wealth. */
  readonly hostOf: ReadonlyMap<string, number>;
  readonly worthOf: ReadonlyMap<string, number>;
  /** Every land taken in battle that history still holds, and every pact broken. */
  readonly taken: readonly Taken[];
  readonly broken: readonly Broken[];
};
const YEARS = new WeakMap<World, YearRead>();

function yearRead(world: World): YearRead {
  const year = yearOfMoment(world.now),
    hit = YEARS.get(world);
  if (hit && hit.year === year) return hit;
  const ctx = populationContext(world),
    g = homePlanet(world).generated;
  let lands = 0,
    people = 0,
    host = 0,
    worth = 0;
  for (const p of ctx.provinces.all()) {
    if (offworldSite(g, p.cell)) continue;
    lands++;
    people += p.total();
  }
  const hostOf = new Map<string, number>(),
    worthOf = new Map<string, number>();
  for (const r of politiesOf(world).living()) {
    const h = fieldedOf(ctx, r);
    hostOf.set(r.ref, h);
    host += h;
  }
  for (const r of wealthBook(world).realms) {
    worthOf.set(r.ref, r.worth);
    worth += r.worth;
  }
  const taken: Taken[] = [],
    broken: Broken[] = [],
    TAKEN = WAR_EVENTS.taken.type,
    BROKE = DIPLOMACY_EVENTS.broken.type;
  for (const e of world.events.all()) {
    const type = e.type;
    if (type === TAKEN) {
      const [by, from] = e.subjects;
      if (by && from) taken.push({ y: Math.floor(e.t / YEAR), by, from, id: e.id });
    } else if (type === BROKE) {
      const [a, b] = e.subjects;
      if (a && b) broken.push({ y: Math.floor(e.t / YEAR), a, b, id: e.id });
    }
  }
  const read = { year, lands, people, host, worth, hostOf, worthOf, taken, broken };
  YEARS.set(world, read);
  return read;
}

// ————— An alliance's members, side by side —————

export type Member = {
  readonly ref: Ref;
  readonly p: Polity;
  readonly lands: number;
  readonly people: number;
  readonly host: number;
  readonly worth: number;
  /** What its seat knows, and the age that makes it. */
  readonly knows: number;
  readonly era: string;
  readonly faith: Ref | null;
  readonly tongue: Ref | null;
  /** The year of its oldest bond still standing to another of it (null: none written down), and that bond. */
  readonly joined: number | null;
  readonly by: string;
  readonly byEvent: Ref | null;
  /** How it stands in it (at its head, sworn to one, by a pact). */
  readonly how: string;
};

/** A bond between two of an alliance: what it is, since when, and the event that made it. */
type Tie = {
  readonly a: Ref;
  readonly b: Ref;
  readonly kind: "pact" | "oath" | "compact";
  readonly year: number | null;
  readonly event: Ref | null;
};

export type AllianceRead = {
  readonly a: Alliance;
  /** Its realms, the weightiest first (by people, then host). */
  readonly members: readonly Member[];
  readonly lands: number;
  readonly people: number;
  readonly host: number;
  readonly worth: number;
  readonly ties: readonly Tie[];
  readonly world: YearRead;
};

const READS = new WeakMap<
  World,
  { list: readonly Alliance[]; year: number; reads: Map<string, AllianceRead> }
>();

/** An alliance's members and sums, read once for each reading of the alliances. */
export function allianceRead(world: World, a: Alliance): AllianceRead {
  const list = alliancesOf(world),
    year = yearOfMoment(world.now);
  let memo = READS.get(world);
  if (!memo || memo.list !== list || memo.year !== year) {
    memo = { list, year, reads: new Map() };
    READS.set(world, memo);
  }
  const hit = memo.reads.get(a.ref);
  if (hit) return hit;
  const read = readAlliance(world, a);
  memo.reads.set(a.ref, read);
  return read;
}

function readAlliance(world: World, a: Alliance): AllianceRead {
  const ctx = populationContext(world),
    g = homePlanet(world).generated,
    realms = politiesOf(world),
    y = yearRead(world),
    inIt = new Set<string>(a.members),
    lore = loreOf(world),
    faiths = beliefOf(world),
    tongues = languagesOf(world),
    diplomacy = diplomacyOf(world),
    bonds = bondsOf(world),
    ties: Tie[] = [];
  // The bonds that hold it, each once.
  for (const r of a.members)
    for (const x of diplomacy.of(r))
      if (x.pact && x.a === r && inIt.has(x.b))
        ties.push({
          a: x.a,
          b: x.b,
          kind: "pact",
          year: yearOfEvent(world, x.pact),
          event: x.pact,
        });
  for (const b of bonds.all())
    if (b.kind === "vassal" && inIt.has(b.from) && inIt.has(b.to))
      ties.push({ a: b.from, b: b.to, kind: "oath", year: b.since, event: b.event });
  if (a.compact)
    for (const m of a.compact.members)
      if (m !== a.compact.members[0] && inIt.has(m) && inIt.has(a.compact.members[0]!))
        ties.push({
          a: m,
          b: a.compact.members[0]!,
          kind: "compact",
          year: a.compact.since,
          event: a.compact.event,
        });
  const members: Member[] = [];
  for (const r of a.members) {
    const p = realms.get(r);
    if (!p) continue;
    let lands = 0,
      people = 0;
    for (const c of p.members) {
      if (offworldSite(g, c)) continue;
      lands++;
      people += ctx.provinces.get(c)?.total() ?? 0;
    }
    // (Its oldest bond to another of it: the year it came in, as history still tells it.)
    let joined: number | null = null,
      by = "",
      byEvent: Ref | null = null;
    for (const t of ties)
      if ((t.a === r || t.b === r) && t.year !== null && (joined === null || t.year < joined)) {
        joined = t.year;
        const other = realms.get(t.a === r ? t.b : t.a)?.town ?? "another";
        by =
          t.kind === "pact"
            ? `a pact with ${other}`
            : t.kind === "oath"
              ? t.a === r
                ? `an oath to ${other}`
                : `the oath of ${other}`
              : "the compact";
        byEvent = t.event;
      }
    members.push({
      ref: r,
      p,
      lands,
      people,
      host: y.hostOf.get(r) ?? 0,
      worth: y.worthOf.get(r) ?? 0,
      knows: lore.of(p.seat).length,
      era: eraWords(world, landEra(world, p.seat)),
      faith: (faiths.of(p.seat).faith as Ref | null | undefined) ?? null,
      tongue: (tongues.of(p.seat)?.ref as Ref | undefined) ?? null,
      joined,
      by,
      byEvent,
      how: standsHow(world, a.head, a.members, r),
    });
  }
  members.sort((x, z) => z.people - x.people || z.host - x.host || (x.ref < z.ref ? -1 : 1));
  const sum = (f: (m: Member) => number) => members.reduce((n, m) => n + f(m), 0);
  return {
    a,
    members,
    lands: sum((m) => m.lands),
    people: sum((m) => m.people),
    host: sum((m) => m.host),
    worth: sum((m) => m.worth),
    ties,
    world: y,
  };
}

/** Every alliance read, the greatest first. */
function allReads(world: World): AllianceRead[] {
  return alliancesOf(world).map((a) => allianceRead(world, a));
}

/** Where an alliance stands among them by a measure, from 1. */
function rankBy(reads: readonly AllianceRead[], r: AllianceRead, f: (x: AllianceRead) => number) {
  return 1 + reads.filter((x) => f(x) > f(r) || (f(x) === f(r) && x.a.head < r.a.head)).length;
}

// ————— Its wars —————

type Outcome = "won" | "lost" | "drawn" | "on";
const OUTCOME_WORDS: Readonly<Record<Outcome, string>> = {
  won: "won",
  lost: "lost",
  drawn: "drawn",
  on: "still fought",
};

/** How a war went for one side: by its peace, as history wrote it (won, lost, or neither could win); while fought, fought on. */
export function outcomeFor(world: World, w: War, side: Ref): Outcome {
  if (w.ended === null) return "on";
  const attacking = w.attacker === side,
    d = (w.peace ? world.events.get(w.peace)?.data : null) as {
      won?: boolean;
      terms?: { kind?: string; lands?: number; beaten?: string; payer?: string };
    } | null;
  if (d && typeof d.won === "boolean") {
    if (d.won) return attacking ? "won" : "lost";
    const t = d.terms;
    if (t?.kind === "truce" && !t.beaten && !t.lands) return "drawn";
    if (t?.kind === "fell") {
      const fell = politiesOf(world).get(side);
      return fell && t.payer === realmName(fell) ? "lost" : "won";
    }
    // (The attacker did not get what it came for: the defender held.)
    return attacking ? "lost" : "won";
  }
  // (A peace history no longer holds: as a realm's army tab tells it, by who holds the prize now.)
  const held = politiesOf(world).of(w.prize)?.ref === w.attacker;
  return attacking === held ? "won" : "lost";
}

type Fought = { readonly w: War; readonly side: Ref; readonly foe: Ref; readonly how: Outcome };
type WarsRead = {
  readonly fought: readonly Fought[];
  readonly won: number;
  readonly lost: number;
  readonly drawn: number;
  readonly on: number;
  readonly battles: number;
  readonly battlesWon: number;
  readonly fallen: number;
  readonly foeFallen: number;
  readonly gained: number;
  readonly lostLands: number;
  /** Foes two or more of it fought, side by side. */
  readonly together: number;
  /** Realms brought down by its wars. */
  readonly felled: number;
  /** Wars among its own, since they were bound. */
  readonly among: readonly War[];
  readonly greatest: Fought | null;
};
const WARS = new WeakMap<AllianceRead, WarsRead>();

/** The wars its realms fought since each was bound to it, against those outside it; and those among its own. */
/** The wars its realms fought since each was bound to it, against those outside it, and those among its own: who and whom, not yet how they went. */
function foughtOf(world: World, r: AllianceRead): { fought: Omit<Fought, "how">[]; among: War[] } {
  const hit = FOUGHT.get(r);
  if (hit) return hit;
  const inIt = new Set<string>(r.a.members),
    since = new Map(r.members.map((m) => [m.ref as string, m.joined ?? r.a.since ?? Infinity])),
    store = warsOf(world),
    seen = new Set<string>(),
    fought: Omit<Fought, "how">[] = [],
    among: War[] = [];
  for (const m of r.members)
    for (const w of store.of(m.ref)) {
      if (seen.has(w.ref)) continue;
      const foe = w.attacker === m.ref ? w.defender : w.attacker,
        from = since.get(m.ref) ?? Infinity;
      if (w.declared < from) continue;
      if (inIt.has(foe)) {
        // (Among its own only once both were bound: a war that ended in one's oath is how it came in.)
        if (foe !== m.ref && w.declared >= (since.get(foe) ?? Infinity)) {
          seen.add(w.ref);
          among.push(w);
        }
        continue;
      }
      seen.add(w.ref);
      fought.push({ w, side: m.ref, foe });
    }
  fought.sort((x, z) => x.w.declared - z.w.declared || (x.w.ref < z.w.ref ? -1 : 1));
  among.sort((x, z) => x.declared - z.declared);
  const read = { fought, among };
  FOUGHT.set(r, read);
  return read;
}
const FOUGHT = new WeakMap<AllianceRead, { fought: Omit<Fought, "how">[]; among: War[] }>();

/** Its wars and how each went (a peace long past is read from history's cold blocks: in the order they were written, so each block is read once). */
function warsRead(world: World, r: AllianceRead): WarsRead {
  const hit = WARS.get(r);
  if (hit) return hit;
  const inIt = new Set<string>(r.a.members),
    since = new Map(r.members.map((m) => [m.ref as string, m.joined ?? r.a.since ?? Infinity])),
    realms = politiesOf(world),
    { fought: who, among } = foughtOf(world, r),
    serial = (x: Ref | null) => (x ? Number(x.split(":")[2]) : -1),
    how = new Map<string, Outcome>();
  for (const f of [...who].sort((x, z) => serial(x.w.peace) - serial(z.w.peace)))
    how.set(f.w.ref, outcomeFor(world, f.w, f.side));
  const fought: Fought[] = who.map((f) => ({ ...f, how: how.get(f.w.ref)! }));
  let won = 0,
    lost = 0,
    drawn = 0,
    on = 0,
    battles = 0,
    battlesWon = 0,
    fallen = 0,
    foeFallen = 0,
    felled = 0,
    greatest: Fought | null = null;
  const byFoe = new Map<string, Set<string>>(),
    felledSeen = new Set<string>();
  for (const f of fought) {
    if (f.how === "won") won++;
    else if (f.how === "lost") lost++;
    else if (f.how === "drawn") drawn++;
    else on++;
    const attacking = f.w.attacker === f.side;
    for (const b of f.w.battles) {
      battles++;
      if (b.won === attacking) battlesWon++;
    }
    fallen += attacking ? f.w.fallen[0] : f.w.fallen[1];
    foeFallen += attacking ? f.w.fallen[1] : f.w.fallen[0];
    const of = byFoe.get(f.foe) ?? byFoe.set(f.foe, new Set()).get(f.foe)!;
    of.add(f.side);
    const foe = realms.get(f.foe);
    if (
      f.how === "won" &&
      foe &&
      foe.ended !== null &&
      f.w.ended !== null &&
      foe.ended === f.w.ended &&
      !felledSeen.has(f.foe)
    ) {
      felledSeen.add(f.foe);
      felled++;
    }
    if (!greatest || f.w.fallen[0] + f.w.fallen[1] > greatest.w.fallen[0] + greatest.w.fallen[1])
      greatest = f;
  }
  let gained = 0,
    lostLands = 0;
  for (const t of r.world.taken) {
    const by = inIt.has(t.by),
      from = inIt.has(t.from);
    if (by === from) continue;
    const m = by ? t.by : t.from;
    if (t.y < (since.get(m) ?? Infinity)) continue;
    if (by) gained++;
    else lostLands++;
  }
  const read = {
    fought,
    won,
    lost,
    drawn,
    on,
    battles,
    battlesWon,
    fallen,
    foeFallen,
    gained,
    lostLands,
    together: [...byFoe.values()].filter((s) => s.size >= 2).length,
    felled,
    among,
    greatest,
  };
  WARS.set(r, read);
  return read;
}

// ————— Through the years —————

type Through = {
  readonly people: Point[];
  readonly host: Point[];
  /** The greatest few members' people, each its own. */
  readonly each: { readonly m: Member; readonly points: Point[] }[];
};
const THROUGH = new WeakMap<AllianceRead, Through>();

/** Its realms' lands (those they hold now) through the years history keeps: their people, and the host each would field as it fields now. */
function throughYears(world: World, r: AllianceRead): Through {
  const hit = THROUGH.get(r);
  if (hit) return hit;
  const history = populationContext(world).history,
    g = homePlanet(world).generated,
    people = new Map<number, number>(),
    host = new Map<number, number>(),
    each: { m: Member; points: Point[] }[] = [];
  r.members.forEach((m, i) => {
    const k = m.people ? m.host / m.people : 0,
      own = i < 5 ? new Map<number, number>() : null;
    for (const c of m.p.members) {
      if (offworldSite(g, c)) continue;
      for (const s of history.yearsOf(c)) {
        people.set(s.year, (people.get(s.year) ?? 0) + s.population);
        host.set(s.year, (host.get(s.year) ?? 0) + s.population * k);
        if (own) own.set(s.year, (own.get(s.year) ?? 0) + s.population);
      }
    }
    if (own)
      each.push({
        m,
        points: [...own].sort((x, z) => x[0] - z[0]).map(([x, y]) => ({ x, y })),
      });
  });
  const pts = (m: Map<number, number>) =>
    [...m].sort((x, z) => x[0] - z[0]).map(([x, y]) => ({ x, y: Math.round(y) }));
  const read = { people: pts(people), host: pts(host), each };
  THROUGH.set(r, read);
  return read;
}

/** At most `most` points, evenly through (the first and last kept). */
function thin(points: readonly Point[], most = 120): Point[] {
  if (points.length <= most) return [...points];
  return Array.from(
    { length: most },
    (_, i) => points[Math.round((i * (points.length - 1)) / (most - 1))]!,
  );
}

/** A few years history keeps, evenly through what it holds, at least STEP_LEAST apart, the last now. */
function sampledYears(years: readonly number[]): number[] {
  if (!years.length) return [];
  const out: number[] = [],
    first = years[0]!,
    last = years.at(-1)!;
  for (let i = 0; i < STEP_ROWS; i++) {
    const want = first + ((last - first) * i) / (STEP_ROWS - 1);
    let best = years[0]!;
    for (const y of years) if (Math.abs(y - want) < Math.abs(best - want)) best = y;
    if (!out.length || best - out.at(-1)! >= STEP_LEAST) out.push(best);
  }
  if (out.at(-1) !== last) {
    if (out.length && last - out.at(-1)! < STEP_LEAST) out.pop();
    out.push(last);
  }
  return out;
}

// ————— Its page —————

/** An alliance's own page: its weight, who leads it, its realms, its years, its wars, its story, and what holds it. */
export function blocPage(world: World, ref: string): PageModel {
  const head = ref.slice("bloc:".length) as Ref,
    realms = politiesOf(world),
    h = realms.get(head),
    a = alliancesOf(world).find((x) => x.head === head);
  if (!a) return lonePage(world, ref, h);
  const r = allianceRead(world, a),
    reads = allReads(world),
    seat = h ? spotOfLand(world, h.seat) : null,
    fights = warsNowLine(world, a);
  return {
    ref,
    kind: "bloc",
    icon: "🪢",
    title: cap(a.name),
    subtitle: [
      `${count(a.members.length)} realms who would answer each other's call; ${ordinal(reads.indexOf(r) + 1)} of ${many(reads.length, "alliance", "alliances")} by its people. `,
      link("Every alliance", "world:alliances"),
    ],
    color: a.color,
    place: seat === null ? null : { scale: "globe", spot: seat },
    stats: [
      stat("Realms", count(r.members.length)),
      stat("Lands", count(r.lands), {
        parts: [part("of the world's", share(r.world.lands ? r.lands / r.world.lands : 0))],
      }),
      stat("People", count(r.people), {
        parts: [part("of the world's", share(r.world.people ? r.people / r.world.people : 0))],
      }),
      stat("Hosts", count(Math.round(r.host)), {
        parts: [part("of all the world fields", share(r.world.host ? r.host / r.world.host : 0))],
      }),
      stat("Wealth", worthWords(r.worth), {
        parts: [part("of the world's", share(r.world.worth ? r.worth / r.world.worth : 0))],
      }),
      stat("Bound since", a.since !== null ? `year ${a.since}` : "no one wrote it down"),
      stat("At war", fights.length ? fights : "at peace", { why: a.wars[0]?.war ?? null }),
      ...(a.compact
        ? [stat("Sworn against", [realmLink(world, a.compact.against)], { why: a.compact.event })]
        : []),
    ],
    tabs: [
      overviewTab(world, r, reads),
      membersTab(world, r),
      strengthTab(world, r),
      warsTab(world, r),
      historyTab(world, r),
      withinTab(world, r),
    ],
    followable: false,
    year: yearNow(world),
  };
}

const ordinal = (n: number) => {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${count(n)}${s}`;
};

/** The page of an alliance no longer standing, or a realm that stands alone. */
function lonePage(world: World, ref: string, h: Polity | undefined): PageModel {
  const seat = h ? spotOfLand(world, h.seat) : null;
  return {
    ref,
    kind: "bloc",
    icon: "🪢",
    title: h ? `The alliance of ${h.town}` : "Those who stood together",
    subtitle: [
      "It stands alone now: no realm is bound to it, nor it to one stronger. ",
      link("Every alliance", "world:alliances"),
    ],
    color: null,
    place: seat === null ? null : { scale: "globe", spot: seat },
    stats: [stat("Realms", h && h.ended === null ? "1" : "none")],
    tabs: [
      {
        id: "overview",
        name: "Overview",
        blocks: [
          {
            type: "list",
            title: "Who stands in it",
            items: h ? [item([realmLink(world, h.ref), ": alone"], h.ref)] : [],
          },
        ],
      },
    ],
    followable: false,
    year: yearNow(world),
  };
}

/** What an alliance fights now, as a line: against whom, each a link (empty: at peace). */
function warsNowLine(world: World, a: Alliance): Line {
  const foes = [...new Map(a.wars.map((w) => [w.foe as string, w])).values()];
  if (!foes.length) return [];
  return [
    "At war with ",
    ...foes.slice(0, 4).flatMap((w, i) => [...(i ? [", "] : []), realmLink(world, w.foe)]),
    ...(foes.length > 4 ? [`, and ${count(foes.length - 4)} more`] : []),
  ];
}

/** Who leads it, and why: the strongest it is bound to, as blocsOf climbs; or one sworn to by oath. */
function leadsLine(world: World, r: AllianceRead): Line {
  const head = r.members.find((m) => m.ref === r.a.head),
    next = [...r.members].filter((m) => m.ref !== r.a.head).sort((x, z) => z.host - x.host)[0];
  if (!head) return [];
  const sworn = bondsOf(world)
      .vassalsOf(head.ref)
      .filter((b) => r.a.members.includes(b.from)).length,
    shareOf = r.host ? head.host / r.host : 0;
  const why: string[] = [];
  if (!next || head.host >= next.host)
    why.push(
      `it fields the greatest host of them, ${count(Math.round(head.host))} men${next ? ` against ${count(Math.round(next.host))} of ${next.p.town}, the next` : ""}, and a realm stands with the strongest it is bound to`,
    );
  else
    why.push(
      `${next.p.town} fields more (${count(Math.round(next.host))} men against ${count(Math.round(head.host))}), but is bound to it by an oath, which binds before strength`,
    );
  if (sworn) why.push(`${many(sworn, "realm of it is", "realms of it are")} sworn to it by oath`);
  if (r.a.compact)
    why.push(
      `it is the strongest of the compact sworn against ${townOf(world, r.a.compact.against)}`,
    );
  return [
    realmLink(world, head.ref),
    ` leads it: ${why.join("; ")}. It holds ${part100(r.people ? head.people / r.people : 0)} of its people and ${part100(shareOf)} of its host.`,
  ];
}

const townOf = (world: World, ref: Ref) => politiesOf(world).get(ref)?.town ?? "a realm now gone";

function overviewTab(world: World, r: AllianceRead, reads: readonly AllianceRead[]): Tab {
  const n = reads.length,
    place = (f: (x: AllianceRead) => number) => `${ordinal(rankBy(reads, r, f))} of ${count(n)}`,
    wars = warsRead(world, r),
    learned = [...r.members].sort((x, z) => z.knows - x.knows || z.people - x.people)[0];
  const blocks: Block[] = [
    {
      type: "list",
      title: "Its colour",
      items: [
        {
          ...item(
            "Its colour on the Alliances lens, over every land of its realms (those who stand alone are grey there)",
          ),
          swatch: r.a.color,
        },
      ],
    },
    { type: "text", title: "Who leads it", lines: [leadsLine(world, r)] },
    {
      type: "facts",
      title: "Its weight in the world",
      rows: [
        stat(
          "Lands",
          `${count(r.lands)} of the world's ${count(r.world.lands)} (${share(r.world.lands ? r.lands / r.world.lands : 0)}); ${place((x) => x.lands)}`,
        ),
        stat(
          "People",
          `${share(r.world.people ? r.people / r.world.people : 0)} of the world's; ${place((x) => x.people)}`,
        ),
        stat(
          "Hosts",
          `${count(Math.round(r.host))} men, ${share(r.world.host ? r.host / r.world.host : 0)} of all the world's realms field; ${place((x) => x.host)}`,
        ),
        stat(
          "Wealth",
          `${worthWords(r.worth)}, ${share(r.world.worth ? r.worth / r.world.worth : 0)} of all the realms'; ${place((x) => x.worth)}`,
          {
            why: null,
          },
        ),
        stat("Realms", `${count(r.members.length)}; ${place((x) => x.members.length)}`),
        ...(learned
          ? [
              stat("Most learned", [
                realmLink(world, learned.ref),
                `: its seat knows ${count(learned.knows)} principles, ${learned.era}`,
              ]),
            ]
          : []),
        stat(
          "Its wars",
          `${count(wars.won)} won, ${count(wars.lost)} lost, ${count(wars.drawn)} drawn${wars.on ? `, ${count(wars.on)} still fought` : ""}, since its realms were bound`,
        ),
      ],
    },
    {
      type: "list",
      title: "Who stands in it",
      items: r.members.map((m) => item([realmLink(world, m.ref), `: ${m.how}`], m.ref)),
    },
    {
      type: "list",
      title: "Set it beside…",
      items: reads
        .filter((x) => x !== r)
        .slice(0, 4)
        .map((x) => ({
          ...item(
            [`${cap(x.a.name)}, ${many(x.members.length, "realm", "realms")}`],
            `allyvs:${r.a.head}|${x.a.head}`,
          ),
          swatch: x.a.color,
        })),
    },
  ];
  return { id: "overview", name: "Overview", blocks };
}

function membersTab(world: World, r: AllianceRead): Tab {
  const mark = (m: Member) => (m.ref === r.a.head ? " (its head)" : "");
  const weight: Row[] = r.members.map((m) => ({
      ref: m.ref,
      cells: [
        [link(m.p.town, m.ref), mark(m)],
        [count(m.lands)],
        [short(m.people)],
        [short(m.host)],
        [worthWords(m.worth)],
      ],
      keys: [m.p.town, m.lands, m.people, Math.round(m.host), m.worth],
    })),
    what: Row[] = r.members.map((m) => ({
      ref: m.ref,
      cells: [
        [link(m.p.town, m.ref)],
        [m.era, `, knows ${count(m.knows)}`],
        [faithLink(world, m.faith)],
        [m.tongue ? languageLink(world, m.tongue) : "none of its own"],
        m.joined !== null
          ? [link(`year ${m.joined}`, m.byEvent), ` by ${m.by}`]
          : ["no one wrote it down"],
      ],
      keys: [m.p.town, m.knows, m.faith ?? "", m.tongue ?? "", m.joined ?? -1],
    }));
  return {
    id: "members",
    name: "Members",
    blocks: [
      {
        type: "table",
        title: "Their weight, the greatest first",
        columns: ["Realm", "Lands", "People", "Host", "Wealth"],
        rows: weight,
      },
      {
        type: "text",
        lines: [
          [
            `In all: ${many(r.lands, "land", "lands")}, ${count(r.people)} people, ${count(Math.round(r.host))} men in their hosts, ${worthWords(r.worth)} in wealth. A host is the men a realm fields now; wealth its lands' stores at their usual worth, less what they owe.`,
          ],
        ],
      },
      {
        type: "table",
        title: "What they are",
        columns: ["Realm", "Age (its seat)", "Faith", "Tongue", "Bound"],
        rows: what,
      },
    ],
  };
}

function strengthTab(world: World, r: AllianceRead): Tab {
  const t = throughYears(world, r),
    years = t.people.map((p) => p.x),
    at = (pts: readonly Point[], y: number) => pts.find((p) => p.x === y)?.y ?? 0,
    // (The rows from before it was bound, as long before as it has stood, to now.)
    now = years.at(-1) ?? yearNow(world),
    since = r.a.since ?? now,
    sampled = sampledYears(years.filter((y) => y >= since - Math.max(40, now - since))),
    blocks: Block[] = [];
  if (t.people.length >= 2)
    blocks.push({
      type: "lines",
      title:
        "Its people and its host through the years (the lands its realms hold now; each host as its realm fields now)",
      unit: "people",
      apart: true,
      series: [
        { name: "People", color: r.a.color, points: thin(t.people) },
        { name: "Host", color: r.a.color, points: thin(t.host) },
      ],
    });
  if (t.each.some((e) => e.points.length >= 2))
    blocks.push({
      type: "lines",
      title: "Its greatest realms' people through the years (the lands each holds now)",
      unit: "people",
      series: t.each.map((e) => ({
        name: e.m.p.town,
        ref: e.m.ref,
        color: realmColor(e.m.ref),
        points: thin(e.points),
      })),
    });
  const rows: Row[] = sampled.map((y, i) => {
    const from = i ? sampled[i - 1]! : -Infinity,
      bound = r.members.filter((m) => m.joined !== null && m.joined <= y).length,
      inIt = new Set<string>(r.a.members);
    let won = 0,
      lost = 0;
    for (const x of r.world.taken) {
      if (x.y <= from || x.y > y) continue;
      const by = inIt.has(x.by),
        of = inIt.has(x.from);
      if (by && !of) won++;
      else if (of && !by) lost++;
    }
    return {
      cells: [
        [`${y}`],
        [count(bound)],
        [short(at(t.people, y))],
        [short(at(t.host, y))],
        [i ? `+${count(won)} −${count(lost)}` : "—"],
      ],
      keys: [y, bound, at(t.people, y), at(t.host, y), won - lost],
    };
  });
  if (rows.length)
    blocks.push({
      type: "table",
      title:
        "By the years: of its realms now, how many were bound by then; its lands' people and host; lands taken and lost in battle since the row before",
      columns: ["Year", "Bound", "People", "Host", "Lands won, lost"],
      rows,
    });
  else blocks.push({ type: "text", lines: [["History holds no years of its lands yet."]] });
  return { id: "strength", name: "Strength", blocks };
}

function warsTab(world: World, r: AllianceRead): Tab {
  const w = warsRead(world, r),
    blocks: Block[] = [];
  if (!w.fought.length && !w.among.length)
    return {
      id: "wars",
      name: "Wars",
      blocks: [{ type: "text", lines: [["Its realms have fought no war since they were bound."]] }],
    };
  blocks.push({
    type: "facts",
    rows: [
      stat(
        "Wars",
        `${count(w.fought.length)} since its realms were bound, against realms outside it`,
        {
          parts: [
            part("won", count(w.won)),
            part("lost", count(w.lost)),
            part("drawn: neither could win", count(w.drawn)),
            part("still fought", count(w.on)),
          ],
        },
      ),
      stat(
        "Side by side",
        `${many(w.together, "foe", "foes")} fought by two or more of its realms`,
      ),
      stat("Battles", `${count(w.battlesWon)} won of ${count(w.battles)}`),
      stat("Its fallen", count(w.fallen), { parts: [part("its foes'", count(w.foeFallen))] }),
      stat("Lands", `${count(w.gained)} taken in battle, ${count(w.lostLands)} lost`, {
        parts: [part("realms brought down", count(w.felled))],
      }),
      ...(w.greatest
        ? [
            stat(
              "The greatest",
              [
                link(claimOf(world, w.greatest.w.event), w.greatest.w.ref),
                `: ${count(w.greatest.w.fallen[0] + w.greatest.w.fallen[1])} fell; ${OUTCOME_WORDS[w.greatest.how]} for ${townOf(world, w.greatest.side)}`,
              ],
              { why: w.greatest.w.event },
            ),
          ]
        : []),
    ],
  });
  const rows: Row[] = [...w.fought].reverse().map((f) => {
    const attacking = f.w.attacker === f.side,
      mine = f.w.battles.filter((b) => b.won === attacking).length,
      fell = attacking ? f.w.fallen[0] : f.w.fallen[1];
    return {
      ref: f.w.ref,
      cells: [
        [
          link(townOf(world, f.side), f.side),
          attacking ? " upon " : " against ",
          link(townOf(world, f.foe), f.foe),
        ],
        [`${f.w.declared}${f.w.ended === null ? "–" : `–${f.w.ended}`}`],
        [`${count(mine)} of ${count(f.w.battles.length)}`],
        [count(fell)],
        [link(OUTCOME_WORDS[f.how], f.w.ref)],
      ],
      keys: [townOf(world, f.side), f.w.declared, mine, fell, f.how],
    };
  });
  if (rows.length)
    blocks.push({
      type: "table",
      title: "Its wars, the latest first",
      columns: ["Who, upon whom", "Years", "Battles won", "Its fallen", "How it went"],
      rows,
    });
  if (w.among.length)
    blocks.push({
      type: "list",
      title: "Wars among its own, since they were bound",
      items: [...w.among]
        .reverse()
        .slice(0, 12)
        .map((x) =>
          item([`Year ${x.declared}: `, link(claimOf(world, x.event), x.ref)], x.ref, x.declared),
        ),
    });
  return { id: "wars", name: "Wars", blocks };
}

function historyTab(world: World, r: AllianceRead): Tab {
  const year = yearNow(world),
    inIt = new Set<string>(r.a.members),
    store = tiesOf(world),
    items: Item[] = [],
    first = r.members.reduce((y, m) => (m.joined !== null && m.joined < y ? m.joined : y), year);
  // Who came in, and when: the bond each still stands by.
  const oldest = [...r.ties].filter((t) => t.year !== null).sort((x, z) => x.year! - z.year!)[0];
  if (oldest)
    items.push(
      item(
        [
          `Year ${oldest.year}: its oldest bond still standing, `,
          oldest.kind === "pact"
            ? "a pact between "
            : oldest.kind === "oath"
              ? "the oath of "
              : "the compact of ",
          realmLink(world, oldest.a),
          oldest.kind === "oath" ? " to " : " and ",
          realmLink(world, oldest.b),
        ],
        oldest.event,
        oldest.year!,
      ),
    );
  for (const m of r.members)
    if (m.joined !== null && m.byEvent !== oldest?.event)
      items.push(
        item(
          [`Year ${m.joined}: `, realmLink(world, m.ref), ` came in, by ${m.by}`],
          m.byEvent ?? m.ref,
          m.joined,
        ),
      );
  // The marriages that tie its houses (or what its peoples have for one).
  const matched = new Set<string>();
  for (const m of r.members)
    for (const x of livingMatches(world, m.ref, year)) {
      if (!inIt.has(x.with) || matched.has(x.event)) continue;
      matched.add(x.event);
      items.push(
        item(
          [
            `Year ${x.year}: `,
            link(`${x.who} and ${x.to}`, `match:${x.event}`),
            " tie the houses of ",
            realmLink(world, m.ref),
            " and ",
            realmLink(world, x.with),
          ],
          `match:${x.event}`,
          x.year,
        ),
      );
    }
  // Envoys between its realms.
  for (const e of store.envoys())
    if (inIt.has(e.from) && inIt.has(e.to))
      items.push(item(envoyLine(world, e), `envoy:${e.event}`, e.year));
  // Calls among its own, answered or not.
  for (const c of store.allCalls())
    if (inIt.has(c.friend) && inIt.has(c.called))
      items.push(item(callLine(world, c), c.event, c.year));
  // Pacts broken with its realms: those now outside left; those inside still stand by another bond.
  for (const b of r.world.broken) {
    const ia = inIt.has(b.a),
      ib = inIt.has(b.b);
    if (!ia && !ib) continue;
    if (b.y < first - STRAIN_YEARS) continue;
    items.push(
      item(
        [
          `Year ${b.y}: `,
          realmLink(world, b.a),
          " and ",
          realmLink(world, b.b),
          ia && ib
            ? " broke their pact, but stand in it by other bonds"
            : ` broke their pact; ${townOf(world, ia ? b.b : b.a)} stands outside it now`,
        ],
        b.id,
        b.y,
      ),
    );
  }
  // Those who broke away from one of its realms, or from whom one of its realms broke.
  for (const p of politiesOf(world).all()) {
    if (!p.from) continue;
    const ip = inIt.has(p.ref),
      iff = inIt.has(p.from);
    if (!ip && !iff) continue;
    if (p.founded < first - STRAIN_YEARS) continue;
    items.push(
      item(
        [
          `Year ${p.founded}: `,
          realmLink(world, p.ref),
          " broke away from ",
          realmLink(world, p.from),
          ip && iff
            ? ", and both stand in it now"
            : ip
              ? "; it stands in it now"
              : p.ended === null
                ? "; it stands outside it"
                : `; it fell in year ${p.ended}`,
        ],
        p.event,
        p.founded,
      ),
    );
  }
  // Wars among its own.
  for (const w of warsRead(world, r).among)
    items.push(
      item(
        [
          `Year ${w.declared}: `,
          link(claimOf(world, w.event), w.ref),
          " — one of it turned on another",
        ],
        w.ref,
        w.declared,
      ),
    );
  if (r.a.compact)
    items.push(
      item(
        [
          `Year ${r.a.compact.since}: `,
          link(cap(leagueName(world, r.a.compact)), `league:${r.a.compact.event}`),
          " sworn against ",
          realmLink(world, r.a.compact.against),
        ],
        `league:${r.a.compact.event}`,
        r.a.compact.since,
      ),
    );
  items.sort((x, z) => (z.year ?? 0) - (x.year ?? 0));
  const from = Math.min(first, ...r.members.map((m) => m.joined ?? year)),
    blocks: Block[] = [
      {
        type: "text",
        lines: [
          [
            r.a.since !== null
              ? `Bound since year ${r.a.since}: the oldest bond among its realms still standing. `
              : "No one wrote down when its oldest bond was sworn. ",
            `Its realms stand together by ${many(r.ties.filter((t) => t.kind === "pact").length, "pact", "pacts")}, ${many(r.ties.filter((t) => t.kind === "oath").length, "oath", "oaths")}${r.a.compact ? " and a compact" : ""}.`,
          ],
        ],
      },
    ];
  if (r.members.some((m) => m.joined !== null) && year > from)
    blocks.push({
      type: "timeline",
      title: "Each realm in it, from the year it was bound",
      from,
      to: year,
      rows: r.members
        .filter((m) => m.joined !== null)
        .sort((x, z) => x.joined! - z.joined!)
        .map((m) => ({
          label: [m.p.town],
          ref: m.ref,
          from: m.joined!,
          to: null,
          color: realmColor(m.ref),
          words: m.by,
        })),
    });
  blocks.push({
    type: "list",
    title: "What happened among them, the latest first",
    items: items.slice(0, 40),
    ...(items.length > 40 ? { more: items.length - 40 } : {}),
  });
  return { id: "history", name: "History", blocks };
}

/** What holds it together and what strains it: the terms its realms' regard is the sum of, a pact's margin, the kin, the faith and the tongue, the foe. */
function withinTab(world: World, r: AllianceRead): Tab {
  const year = yearNow(world),
    diplomacy = diplomacyOf(world),
    inIt = new Set<string>(r.a.members),
    terms = new Map<string, { n: number; sum: number; source: Ref | null }>(),
    pairs: { a: Ref; b: Ref; opinion: number; pact: boolean }[] = [];
  for (const x of diplomacy.all()) {
    if (!inIt.has(x.a) || !inIt.has(x.b)) continue;
    pairs.push({ a: x.a, b: x.b, opinion: x.opinion, pact: !!x.pact });
    for (const t of x.terms) {
      const k = terms.get(t.name) ?? { n: 0, sum: 0, source: t.source };
      k.n++;
      k.sum += t.value;
      terms.set(t.name, k);
    }
  }
  const holds: Item[] = [],
    strains: Item[] = [],
    sign = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(2)}`,
    termLine = (name: string, k: { n: number; sum: number }) =>
      `${cap(name)}: ${sign(k.sum / k.n)} to their regard, between ${many(k.n, "pair", "pairs")} of its realms`;
  {
    let up = 0,
      down = 0;
    for (const [name, k] of [...terms].sort((x, z) => Math.abs(z[1].sum) - Math.abs(x[1].sum))) {
      if (Math.abs(k.sum / k.n) < 0.005) continue;
      // (The weightiest few of each way: the rest are the same terms between other pairs.)
      if (k.sum >= 0 ? up++ >= TERMS_SHOWN : down++ >= TERMS_SHOWN) continue;
      (k.sum >= 0 ? holds : strains).push(item(termLine(name, k), k.source));
    }
  }
  // Its bonds, and how near the weakest is to breaking.
  const pacts = pairs.filter((p) => p.pact).sort((x, z) => x.opinion - z.opinion),
    oaths = r.ties.filter((t) => t.kind === "oath").length,
    kin = new Set<string>();
  for (const m of r.members)
    for (const x of livingMatches(world, m.ref, year)) if (inIt.has(x.with)) kin.add(x.event);
  holds.unshift(
    item(
      `Its bonds: ${many(r.ties.filter((t) => t.kind === "pact").length, "pact", "pacts")} (sworn when two think better than ${PACT.toFixed(2)} of each other), ${many(oaths, "oath", "oaths")} of vassals${r.a.compact ? ", and the compact" : ""}. Each called answers by its bond: an overlord most surely, then a vassal, a compact, a pact, kin least.`,
    ),
  );
  if (kin.size)
    holds.push(
      item(
        `Kin: ${many(kin.size, "marriage ties", "marriages tie")} the houses of its realms, and kin are called too`,
      ),
    );
  const weakest = pacts[0];
  if (weakest)
    (weakest.opinion < NEAR_BREAKING ? strains : holds).push(
      item([
        "The weakest pact, ",
        realmLink(world, weakest.a),
        " with ",
        realmLink(world, weakest.b),
        `: their regard ${sign(weakest.opinion)}; a pact breaks below zero${weakest.opinion < NEAR_BREAKING ? ", and this one is near it" : ""}`,
      ]),
    );
  // A faith and a tongue in common, by its people.
  const byPeople = (key: (m: Member) => string | null) => {
    const m = new Map<string, number>();
    for (const x of r.members) {
      const k = key(x);
      if (k) m.set(k, (m.get(k) ?? 0) + x.people);
    }
    return [...m].sort((x, z) => z[1] - x[1])[0] ?? null;
  };
  const faith = byPeople((m) => m.faith),
    tongue = byPeople((m) => m.tongue);
  if (faith) {
    const s = r.people ? faith[1] / r.people : 0;
    (s >= 0.5 ? holds : strains).push(
      item([
        "Faith: ",
        faithLink(world, faith[0]),
        ` is held at the seats of ${share(s)} of its people${s >= 0.5 ? "; a shared faith makes realms think better of each other" : "; the rest keep other faiths, and rival faiths think the worse of each other"}`,
      ]),
    );
  }
  if (tongue) {
    const s = r.people ? tongue[1] / r.people : 0;
    (s >= 0.5 ? holds : strains).push(
      item([
        "Tongue: ",
        languageLink(world, tongue[0]),
        ` is spoken at the seats of ${share(s)} of its people; alike speech draws realms together, strange speech apart`,
      ]),
    );
  }
  // A common foe.
  if (r.a.compact)
    holds.push(
      item(
        [
          "A common foe: they swore the compact against ",
          realmLink(world, r.a.compact.against),
          `, who held ${share(r.a.compact.share)} of the world's people under it`,
        ],
        r.a.compact.event,
      ),
    );
  const foes = new Map<string, Set<string>>();
  for (const w of r.a.wars) {
    const war = warsOf(world).get(w.war);
    if (!war) continue;
    const side = war.attacker === w.foe ? war.defender : war.attacker;
    (foes.get(w.foe) ?? foes.set(w.foe, new Set()).get(w.foe)!).add(side);
  }
  for (const [foe, sides] of foes)
    if (sides.size >= 2)
      holds.push(
        item([
          "A war in common: ",
          many(sides.size, "realm", "realms"),
          " of it fight ",
          realmLink(world, foe as Ref),
          " now",
        ]),
      );
  // Calls among its own.
  const calls = tiesOf(world)
      .allCalls()
      .filter((c) => inIt.has(c.friend) && inIt.has(c.called)),
    came = calls.filter((c) => c.came).length;
  if (calls.length)
    (came * 2 >= calls.length ? holds : strains).push(
      item(
        `Called to each other's wars ${many(calls.length, "time", "times")} in the years kept: ${count(came)} came, ${count(calls.length - came)} stood by`,
      ),
    );
  // Rivals within, wars among its own, one far stronger, pacts broken.
  const rivals = pairs.filter((p) => p.opinion < RIVALRY);
  for (const p of rivals.slice(0, 3))
    strains.push(
      item([
        realmLink(world, p.a),
        " and ",
        realmLink(world, p.b),
        `: rivals, their regard ${sign(p.opinion)} (below ${sign(RIVALRY)})`,
      ]),
    );
  const among = warsRead(world, r).among.filter((w) => w.declared >= year - STRAIN_YEARS);
  if (among.length)
    strains.push(
      item(
        `Wars among its own: ${many(among.length, "war", "wars")} in the last ${STRAIN_YEARS} years`,
        among.at(-1)!.ref,
      ),
    );
  const top = [...r.members].sort((x, z) => z.host - x.host)[0];
  if (top && r.host && top.host / r.host >= LEANS_ON && r.members.length >= 2)
    strains.push(
      item([
        "One far stronger than the rest: ",
        realmLink(world, top.ref),
        ` fields ${part100(top.host / r.host)} of its host; the others stand with it for its strength, and would fall away if it fell`,
      ]),
    );
  const broke = r.world.broken.filter(
    (b) => b.y >= year - STRAIN_YEARS && (inIt.has(b.a) || inIt.has(b.b)),
  );
  if (broke.length)
    strains.push(
      item(
        `Pacts broken with its realms: ${many(broke.length, "pact", "pacts")} in the last ${STRAIN_YEARS} years`,
        broke.at(-1)!.id,
      ),
    );
  const mean = pairs.length ? pairs.reduce((s, p) => s + p.opinion, 0) / pairs.length : null;
  return {
    id: "within",
    name: "Within",
    blocks: [
      {
        type: "text",
        lines: [
          [
            mean === null
              ? "None of its realms meet another at a border or down a road, so none has a regard for another to weigh: they stand together by their bonds alone."
              : `Its realms' regard for each other, where they meet: ${sign(mean)} on the average over ${many(pairs.length, "pair", "pairs")}. A regard is the sum of the terms below; above ${PACT.toFixed(2)} two swear a pact, below zero a pact breaks, below ${sign(RIVALRY)} they are rivals.`,
          ],
        ],
      },
      { type: "list", title: "What holds it together", items: holds },
      ...(strains.length
        ? [{ type: "list" as const, title: "What strains it", items: strains }]
        : [
            {
              type: "text" as const,
              title: "What strains it",
              lines: [["Nothing its realms weigh against each other now."]],
            },
          ]),
    ],
  };
}

// ————— Every alliance —————

/** Every alliance in the world, ranked: their bars, a table of their weight, each its realms, and two side by side. */
export function alliancesPage(world: World): PageModel {
  const reads = allReads(world),
    living = politiesOf(world).living().length,
    inOne = reads.reduce((n, a) => n + a.members.length, 0),
    top = reads[0],
    y = yearRead(world),
    held = reads.reduce((s, x) => s + x.people, 0);
  const ranking: Block[] = reads.length
    ? [
        {
          type: "bars",
          title: "By their people",
          bars: reads.slice(0, 12).map((r) => ({
            // (By its head's seat: the chart is narrow on a phone, and the page says what they are.)
            label: [politiesOf(world).get(r.a.head)?.town ?? cap(r.a.name)],
            ref: r.a.ref,
            value: Math.round(r.people),
            color: r.a.color,
          })),
          unit: "people",
        },
        {
          type: "table",
          title:
            "Their weight, the greatest first (each by its head's seat; its wars since its realms were bound)",
          columns: ["Alliance", "Realms", "Lands", "People", "Host", "Wealth", "Wars"],
          rows: reads.map((r) => {
            const w = foughtOf(world, r).fought;
            return {
              ref: r.a.ref,
              swatch: r.a.color,
              cells: [
                [link(politiesOf(world).get(r.a.head)?.town ?? cap(r.a.name), r.a.ref)],
                [count(r.members.length)],
                [count(r.lands)],
                [short(r.people)],
                [short(r.host)],
                [worthWords(r.worth)],
                [count(w.length)],
              ],
              keys: [
                r.a.name,
                r.members.length,
                r.lands,
                r.people,
                Math.round(r.host),
                r.worth,
                w.length,
              ],
            };
          }),
        },
        {
          type: "text",
          lines: [
            [
              `Together they hold ${share(y.people ? held / y.people : 0)} of the world's people. ${many(living - inOne, "realm stands", "realms stand")} alone, in no alliance.`,
            ],
          ],
        },
      ]
    : [
        {
          type: "text",
          lines: [
            [
              "No two realms stand together now: none is bound to another stronger by a pact, an oath or a compact.",
            ],
          ],
        },
      ];
  const lists: Block[] = reads.map((r) => ({
    type: "list",
    title: cap(r.a.name),
    items: [
      {
        ...item(
          [
            link(cap(r.a.name), r.a.ref),
            `: ${many(r.members.length, "realm", "realms")}, ${many(r.lands, "land", "lands")}, ${many(Math.round(r.people), "soul", "people")}`,
            r.a.since !== null ? `; bound since year ${r.a.since}` : "",
            ...(r.a.wars.length ? [". ", ...warsNowLine(world, r.a)] : ["; at peace"]),
            ".",
          ],
          r.a.ref,
        ),
        swatch: r.a.color,
      },
      ...r.members.map((m) => item([realmLink(world, m.ref), `: ${m.how}`], m.ref)),
    ],
  }));
  const pairs: Item[] = [];
  for (let i = 0; i < Math.min(4, reads.length); i++)
    for (let j = i + 1; j < Math.min(5, reads.length); j++)
      pairs.push({
        ...item(
          [
            `${politiesOf(world).get(reads[i]!.a.head)?.town ?? "One"} beside ${politiesOf(world).get(reads[j]!.a.head)?.town ?? "another"}`,
          ],
          `allyvs:${reads[i]!.a.head}|${reads[j]!.a.head}`,
        ),
        swatch: reads[i]!.a.color,
      });
  return {
    ref: "world:alliances",
    kind: "alliances",
    icon: "🪢",
    title: "Alliances",
    subtitle: [
      "who stands with whom, the world over: realms bound by a pact, an oath or a compact answer each other's call",
    ],
    color: null,
    place: null,
    stats: [
      stat("Alliances", count(reads.length)),
      stat("Realms in one", `${count(inOne)} of ${count(living)}`),
      stat("The greatest", top ? [link(cap(top.a.name), top.a.ref)] : "none"),
      stat("At war", many(reads.filter((r) => r.a.wars.length).length, "alliance", "alliances")),
    ],
    tabs: [
      { id: "overview", name: "Ranking", blocks: ranking },
      { id: "members", name: "Their realms", blocks: lists },
      ...(pairs.length
        ? [
            {
              id: "compare",
              name: "Compare",
              blocks: [{ type: "list" as const, title: "Set two side by side", items: pairs }],
            },
          ]
        : []),
    ],
    followable: false,
    year: yearNow(world),
  };
}

/** Two alliances side by side: `allyvs:A|B`, by their heads. */
export function allianceComparePage(world: World, ref: string): PageModel {
  const [x, z] = ref.slice("allyvs:".length).split("|") as [string, string],
    list = alliancesOf(world),
    a = list.find((q) => q.head === x),
    b = list.find((q) => q.head === z);
  if (!a || !b || a === b)
    return {
      ref,
      kind: "compare",
      icon: "⚖️",
      title: "Nothing to set side by side",
      subtitle: ["two alliances standing now are wanted"],
      color: null,
      place: null,
      stats: [],
      tabs: [{ id: "side", name: "Side by side", blocks: [] }],
      followable: false,
      year: yearNow(world),
    };
  const ra = allianceRead(world, a),
    rb = allianceRead(world, b),
    wa = warsRead(world, ra),
    wb = warsRead(world, rb),
    row = (label: string, p: number, q: number, say: (n: number) => string) => ({
      label,
      a: p,
      b: q,
      words: [say(p), say(q)] as const,
    }),
    ta = throughYears(world, ra),
    tb = throughYears(world, rb);
  return {
    ref,
    kind: "compare",
    icon: "⚖️",
    title: `${townOf(world, a.head)} and ${townOf(world, b.head)}, side by side`,
    subtitle: [link(cap(a.name), a.ref), " beside ", link(cap(b.name), b.ref)],
    color: null,
    place: null,
    stats: [],
    tabs: [
      {
        id: "side",
        name: "Side by side",
        blocks: [
          {
            type: "tally",
            title: "Their numbers, pulled against each other",
            sides: [
              { name: [link(cap(a.name), a.ref)], color: a.color },
              { name: [link(cap(b.name), b.ref)], color: b.color },
            ],
            rows: [
              row("Realms", ra.members.length, rb.members.length, count),
              row("Lands", ra.lands, rb.lands, count),
              row("People", ra.people, rb.people, count),
              row("Host", Math.round(ra.host), Math.round(rb.host), count),
              row("Wealth", ra.worth, rb.worth, worthWords),
              row("Wars won", wa.won, wb.won, count),
              row("Wars lost", wa.lost, wb.lost, count),
              row("Battles won", wa.battlesWon, wb.battlesWon, count),
              row("Fallen in war", wa.fallen, wb.fallen, count),
              row("Lands taken in battle", wa.gained, wb.gained, count),
            ],
          },
          {
            type: "lines",
            title: "Their people through the years (the lands their realms hold now)",
            unit: "people",
            series: [
              { name: townOf(world, a.head), ref: a.ref, color: a.color, points: thin(ta.people) },
              { name: townOf(world, b.head), ref: b.ref, color: b.color, points: thin(tb.people) },
            ],
          },
        ],
      },
    ],
    followable: false,
    year: yearNow(world),
  };
}

// ————— A compact —————

/** Why a compact ended, by the rule that ended it. */
const ENDED_WHY: Readonly<Record<string, string>> = {
  fell: "the one they feared fell",
  faded: `the fear faded: the one they feared held less than ${share(TIES.leagueFade)} of the share of the world it held when they swore`,
  old: `it had held ${TIES.leagueYears} years, as long as such a fear holds`,
  few: "fewer than two of them were left in it",
};

/** A compact's own page: who gathered, their weight against the one they fear, what it fought and how, when it was sworn and when it broke. */
export function leaguePage(world: World, ref: string): PageModel {
  const event = ref.slice("league:".length),
    l = tiesOf(world).leagueBy(event);
  if (!l) throw new Error(`no league ${ref}`);
  const realmsOf = politiesOf(world),
    foe = realmsOf.get(l.against),
    name = cap(leagueName(world, l)),
    ctx = populationContext(world),
    g = homePlanet(world).generated,
    y = yearRead(world),
    weigh = (r: Ref) => {
      const p = realmsOf.get(r);
      let lands = 0,
        people = 0;
      for (const c of p && p.ended === null ? p.members : []) {
        if (offworldSite(g, c)) continue;
        lands++;
        people += ctx.provinces.get(c)?.total() ?? 0;
      }
      return { r, p, lands, people, host: y.hostOf.get(r) ?? 0, worth: y.worthOf.get(r) ?? 0 };
    },
    members = l.members.map(weigh).sort((x, z) => z.people - x.people),
    them = weigh(l.against),
    sum = (f: (m: (typeof members)[number]) => number) => members.reduce((n, m) => n + f(m), 0),
    // Its wars: those its realms fought upon the one it was sworn against, or it upon them, while it held.
    seen = new Set<string>(),
    fought: Fought[] = [];
  for (const m of l.members)
    for (const w of warsOf(world).of(m)) {
      if (seen.has(w.ref)) continue;
      const other = w.attacker === m ? w.defender : w.attacker;
      if (other !== l.against || w.declared < l.since || (l.until !== null && w.declared > l.until))
        continue;
      seen.add(w.ref);
      fought.push({ w, side: m, foe: other, how: outcomeFor(world, w, m) });
    }
  const tally = (how: Outcome) => fought.filter((f) => f.how === how).length,
    living = members.filter((m) => m.p && m.p.ended === null);
  const rows: Row[] = members.map((m) => ({
    ref: m.r,
    cells: [
      [realmLink(world, m.r)],
      [count(m.lands)],
      [short(m.people)],
      [short(m.host)],
      [worthWords(m.worth)],
    ],
    keys: [m.p?.town ?? "", m.lands, m.people, Math.round(m.host), m.worth],
  }));
  const warRows: Row[] = [...fought].reverse().map((f) => {
    const attacking = f.w.attacker === f.side,
      mine = f.w.battles.filter((b) => b.won === attacking).length;
    return {
      ref: f.w.ref,
      cells: [
        [link(townOf(world, f.side), f.side), attacking ? " upon them" : " held against them"],
        [`${f.w.declared}${f.w.ended === null ? "–" : `–${f.w.ended}`}`],
        [`${count(mine)} of ${count(f.w.battles.length)}`],
        [link(OUTCOME_WORDS[f.how], f.w.ref)],
      ],
      keys: [townOf(world, f.side), f.w.declared, mine, f.how],
    };
  });
  const color = foe ? realmColor(foe.ref) : ([0.5, 0.5, 0.5] as Rgb);
  return {
    ref,
    kind: "league",
    icon: "🛡️",
    title: name,
    subtitle: [
      "Against ",
      realmLink(world, l.against),
      l.until === null ? `, since year ${l.since}` : `, from year ${l.since} to year ${l.until}`,
    ],
    color: foe ? realmColor(foe.ref) : null,
    place: null,
    stats: [
      stat("Sworn", `year ${l.since}`, { why: l.event }),
      stat("Members", count(l.members.length), {
        parts: [part("standing now", count(living.length))],
      }),
      stat(
        "It feared",
        `${Math.round(l.share * 100)} in a hundred of the world's people under one realm`,
      ),
      stat(
        "Against them now",
        `${count(sum((m) => m.people))} people to ${count(them.people)}; ${count(Math.round(sum((m) => m.host)))} men to ${count(Math.round(them.host))}`,
      ),
      stat(
        "Its wars",
        `${count(tally("won"))} won, ${count(tally("lost"))} lost, ${count(tally("drawn"))} drawn${tally("on") ? `, ${count(tally("on"))} still fought` : ""}`,
      ),
      stat(
        "Holds",
        l.until === null
          ? "as long as the fear does: none of them makes war on another, and each answers the others' call"
          : `no longer: ended in year ${l.until}${l.why ? `: ${ENDED_WHY[l.why] ?? "its realms let it go"}` : ""}`,
        { why: l.ended },
      ),
    ],
    tabs: [
      {
        id: "overview",
        name: "Overview",
        blocks: [
          {
            type: "list",
            title: "Who gathered",
            items: l.members.map((m) =>
              item(
                [
                  realmLink(world, m),
                  realmsOf.get(m)?.ended != null ? `: fell in year ${realmsOf.get(m)!.ended}` : "",
                ],
                m,
              ),
            ),
          },
          ...(them.p
            ? [
                {
                  type: "tally" as const,
                  title: "Their weight against the one they fear, now",
                  sides: [
                    { name: [name] as Line, color: [0.74, 0.66, 1] as Rgb },
                    { name: [realmLink(world, l.against)] as Line, color },
                  ] as const,
                  rows: [
                    {
                      label: "Lands",
                      a: sum((m) => m.lands),
                      b: them.lands,
                      words: [count(sum((m) => m.lands)), count(them.lands)] as const,
                    },
                    {
                      label: "People",
                      a: sum((m) => m.people),
                      b: them.people,
                      words: [count(sum((m) => m.people)), count(them.people)] as const,
                    },
                    {
                      label: "Host",
                      a: Math.round(sum((m) => m.host)),
                      b: Math.round(them.host),
                      words: [count(sum((m) => m.host)), count(them.host)] as const,
                    },
                    {
                      label: "Wealth",
                      a: sum((m) => m.worth),
                      b: them.worth,
                      words: [worthWords(sum((m) => m.worth)), worthWords(them.worth)] as const,
                    },
                  ],
                },
              ]
            : [{ type: "text" as const, lines: [["The one they feared is no more."]] }]),
          { type: "why", title: "Why they gathered", ref: l.event },
        ],
      },
      {
        id: "members",
        name: "Members",
        blocks: [
          {
            type: "table",
            title: "Their weight, the greatest first",
            columns: ["Realm", "Lands", "People", "Host", "Wealth"],
            rows,
          },
          {
            type: "text",
            lines: [
              [
                `In all: ${many(
                  sum((m) => m.lands),
                  "land",
                  "lands",
                )}, ${count(sum((m) => m.people))} people, ${count(Math.round(sum((m) => m.host)))} men in their hosts, ${worthWords(sum((m) => m.worth))} in wealth.`,
              ],
            ],
          },
        ],
      },
      {
        id: "wars",
        name: "Wars",
        blocks: warRows.length
          ? [
              {
                type: "table",
                title: "What it fought, the latest first",
                columns: ["Who", "Years", "Battles won", "How it went"],
                rows: warRows,
              },
            ]
          : [
              {
                type: "text",
                lines: [["None of them has fought the one they fear while the compact held."]],
              },
            ],
      },
      {
        id: "history",
        name: "History",
        blocks: [
          {
            type: "timeline",
            title: "The compact, from its swearing",
            from: l.since,
            to: Math.max(l.since + 1, l.until ?? yearNow(world)),
            rows: [
              {
                label: [name],
                ref,
                from: l.since,
                to: l.until,
                color: [0.74, 0.66, 1] as Rgb,
                words: l.until === null ? "holds" : "broke",
              },
            ],
          },
          {
            type: "list",
            items: [
              item(
                [
                  `Year ${l.since}: sworn by ${many(l.members.length, "realm", "realms")} against `,
                  realmLink(world, l.against),
                  ` (${share(l.share)} of the world's people)`,
                ],
                l.event,
                l.since,
              ),
              ...(l.until !== null
                ? [
                    item(
                      [
                        `Year ${l.until}: it ended${l.why ? `: ${ENDED_WHY[l.why] ?? "its realms let it go"}` : ""}`,
                      ],
                      l.ended ?? undefined,
                      l.until,
                    ),
                  ]
                : []),
            ],
          },
        ],
      },
    ],
    followable: false,
    year: yearNow(world),
  };
}
