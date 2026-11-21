// A year told (asked 2026-11-19: "whats a good way to like absorb everything thats going on like a summary of the year but quite
// detailed or enough where each year is distinct and like an encompassing of the main things that going on ... and not just for
// the years but also for countries maybe? or is the budget not gonna allow something like this?"): one year of a world, or of
// one realm in it, or a run of years, read in a minute.
//
// It costs nothing unless it is opened. Nothing is kept in the world for it, nothing saved, nothing read as the years go by:
// every word is read from what history already holds when its page asks, by the reading the Years are read by (annals.ts,
// a stretch of years at a time), and kept outside the world until its log has moved on (TOLD_KEPT tellings, no more).
//
//   - Its lead is what stands out against the twenty years about it, not what is greatest by a fixed order: a line's worth as
//     the Years weigh it, and more the rarer its like is in those years. A war begun in an age of wars leads less than the one
//     plague of a generation.
//   - A quiet year still tells something true: how its people's number moved, which land grew most, how long a peace has held.
//   - Its sections hold what the Years tell of each side of life, with what was counted of it; each line opens its happening,
//     whose page tells why.
//   - A year long gone tells what is still kept of it, and says plainly that less is.
import {
  YEAR,
  hashString,
  yearOfMoment,
  type HistoryEvent,
  type Ref,
  type World,
} from "../../kernel/index.ts";
import { offworldSite } from "../../gen/index.ts";
import { why } from "../../causal/index.ts";
import { homePlanet, politiesOf, populationContext, warsOf } from "../../sim/index.ts";
import {
  ALL_WORTH,
  KIND_WORTH,
  worthWords,
  type Line,
  type PageModel,
  type ToldFigure,
  type ToldItem,
  type ToldLead,
  type ToldMap,
  type ToldMapBase,
  type ToldMark,
  type ToldMotif,
  type ToldSection,
  type ToldVignette,
  type YearTold,
} from "../../bridge/index.ts";
import {
  eventsOf,
  landName,
  lineOf,
  ruleOf,
  STRETCH_YEARS,
  stretchRead,
  stretchesForget,
  toldOf,
  toldWords,
  type Told,
} from "./annals.ts";
import { sceneBanner, worldArt } from "./art.ts";
import { nameOf } from "./names.ts";
import { count, link, sentence, yearNow } from "./words.ts";
import { logAt, yearsOf, EVERY_YEARS } from "../years.ts";
import { realmThrough } from "./time.ts";
import { realmColor } from "../colors.ts";
import {
  BLOC,
  blocOwn,
  blocSubject,
  blocTold,
  blocText,
  blocYears,
  isBloc,
  realmBlocAt,
  shortWords,
  standingLine,
  type BlocYears,
} from "./told-bloc.ts";

/** How many years either side a year is weighed against. */
const ABOUT = 10;
/**
 * What is left of a line's worth where its like is told in every year about it: a realm's fall is worth 6 as the Years weigh
 * it, and in a late world one falls most years; the one plague of a generation, worth 5, leads over it.
 */
const COMMON = 0.45;
/** The most sentences a lead tells, and the most lines a section shows. */
const LEAD_LINES = 3,
  SECTION_LINES = 4;
/** A second or third thing leads beside the first only where it is worth this much. */
const LEAD_WORTH = ALL_WORTH;
/** And where its like is not told in most of the years about it (its worth, and what its rarity adds). */
const BESIDE_SCORE = 3.9;
/** The tellings kept (a year or a run, of the world or of a realm), until the log has moved on. */
const TOLD_KEPT = 16;
/** The longest run of years told as one. */
export const TOLD_SPAN = 100;
/** Of a run of years, how many are named by their headlines. */
const YEARS_SHOWN = 12;
/** The most marks of a kind a map bears. */
const MARKS = 14;

const plain = (l: Line) => l.map((s) => (typeof s === "string" ? s : s.text)).join("");

// ————— What is asked —————

/**
 * What a page's ref asks to be told: `told:1204`, `told:1200..1209`, either of a realm (`told:1204:pol:0:12`) or of an alliance
 * (`told:1204:bloc:pol:0:12`, by its head realm, as its page's ref). `realm` is whose: a realm's ref or an alliance's.
 */
export function toldAsk(ref: string): { year: number; to: number; realm: string | null } | null {
  const m = /^told:(-?\d+)(?:\.\.(-?\d+))?(?::((?:bloc:)?pol:.+))?$/.exec(ref);
  if (!m) return null;
  const year = Number(m[1]),
    to = m[2] === undefined ? year : Math.max(year, Number(m[2]));
  return { year, to: Math.min(to, year + TOLD_SPAN - 1), realm: m[3] ?? null };
}

/** The ref that asks for a year (or a run), of the world or of a realm. */
export function toldRef(year: number, to = year, realm: string | null = null): string {
  return `told:${year}${to > year ? `..${to}` : ""}${realm ? `:${realm}` : ""}`;
}

// ————— Which side of life a line is of —————

const SECTIONS = [
  // (An alliance's own doings: its year's alone.)
  { id: "bloc", icon: "🪢", name: "The alliance" },
  { id: "power", icon: "👑", name: "Power" },
  { id: "war", icon: "⚔️", name: "War and peace" },
  { id: "money", icon: "💰", name: "Money and trade" },
  { id: "people", icon: "👥", name: "People" },
  { id: "minds", icon: "💡", name: "Minds" },
  { id: "bodies", icon: "🏛️", name: "Institutions and the underworld" },
  { id: "nature", icon: "🌿", name: "Nature" },
  { id: "far", icon: "🌌", name: "The far places" },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

/** A domain of events, and the side of life it is told under. */
const DOMAIN_SECTION: Readonly<Record<string, SectionId>> = {
  polity: "power",
  strife: "power",
  court: "power",
  reign: "power",
  houses: "power",
  ties: "power",
  war: "war",
  terms: "war",
  fire: "war",
  diplomacy: "war",
  money: "money",
  credit: "money",
  finance: "money",
  trade: "money",
  industry: "money",
  people: "people",
  health: "people",
  settlement: "people",
  city: "people",
  town: "people",
  province: "people",
  society: "people",
  order: "people",
  lore: "minds",
  knowledge: "minds",
  lessons: "minds",
  belief: "minds",
  language: "minds",
  design: "minds",
  notable: "minds",
  culture: "minds",
  bodies: "bodies",
  groups: "bodies",
  underworld: "bodies",
  weather: "nature",
  climate: "nature",
  ecology: "nature",
  beast: "nature",
  life: "nature",
  wild: "nature",
  planet: "nature",
  toy: "nature",
  farlife: "far",
  space: "far",
  lanes: "far",
  contact: "far",
  peoples: "far",
  filled: "far",
  nation: "far",
  far: "far",
  late: "far",
  starwar: "far",
  frontier: "far",
  star: "far",
  // (Those a war takes and uproots: prisoners, what was done to them, the reckoning for it.)
  held: "war",
  // (Schools of thought, their works and their places of pilgrimage.)
  ideas: "minds",
  // (The god's own acts, where none is told under what it struck: the hand over those who rule.)
  act: "power",
  hand: "people",
  person: "people",
};
/** The kinds a domain's rule does not hold for. */
const TYPE_SECTION: Readonly<Record<string, SectionId>> = {
  "order.elected": "power",
  "order.held": "power",
  "order.law": "power",
  "order.crisis": "power",
  "order.abolished": "power",
  "trade.embargo": "war",
  "trade.relief": "people",
  "trade.first": "far",
  "trade.first-raid": "far",
  "trade.opened": "far",
  "trade.came": "far",
  "trade.closed": "far",
  "trade.raided": "far",
  "trade.rich": "far",
  "act.body": "bodies",
  "order.lesson": "minds",
  "society.written": "power",
  "act.plague": "people",
  "act.curse": "people",
  "act.flood": "nature",
  "act.fire": "nature",
  "act.meteor": "nature",
  "act.quake": "nature",
  "act.flare": "nature",
  "act.warm": "nature",
  "act.loose": "nature",
  "people.smoke": "nature",
  "war.herds-driven": "nature",
  "groups.hired": "war",
  "held.fled": "people",
  "ecology.sea-few": "nature",
  "bodies.sentenced": "bodies",
  "bodies.told": "bodies",
  "groups.struck": "bodies",
  "underworld.struck": "bodies",
  "act.group": "bodies",
  "reign.charter": "power",
};
/** A line of the Years' own kinds, where its happening is not known: wars, firsts, sorrows, people, the stars. */
const KIND_SECTION: readonly SectionId[] = ["war", "minds", "nature", "power", "far"];

function sectionOf(e: HistoryEvent | undefined, t?: Told): SectionId {
  if (!e) return KIND_SECTION[t?.kind ?? 3] ?? "power";
  if ((e.data as { natural?: boolean } | null)?.natural) return "nature";
  return (
    TYPE_SECTION[e.type] ??
    DOMAIN_SECTION[e.type.slice(0, e.type.indexOf("."))] ??
    KIND_SECTION[t?.kind ?? ruleOf(e)[0]] ??
    "power"
  );
}

/** What is counted of a side of life, in the order it is said: each kind's words for one and for more. */
const COUNTED: Readonly<Record<SectionId, readonly (readonly [string, string, string])[]>> = {
  // (An alliance's counts are its own sentence: told-bloc.ts blocText.)
  bloc: [],
  power: [
    ["polity.ended", "realm fell", "realms fell"],
    ["polity.formed", "realm rose", "realms rose"],
    ["polity.seceded", "land broke from its realm", "lands broke from their realms"],
    ["strife.coup", "ruler was thrown down", "rulers were thrown down"],
    ["polity.succession", "seat passed on", "seats passed on"],
    ["order.elected", "realm chose who rules it", "realms chose who rules them"],
    ["polity.reformed", "realm changed how it is ruled", "realms changed how they are ruled"],
    ["court.plot", "plot was laid at a court", "plots were laid at courts"],
  ],
  war: [
    ["war.declared", "war began", "wars began"],
    ["war.peace", "war ended in a peace", "wars ended in a peace"],
    ["war.battle", "battle was fought", "battles were fought"],
    ["war.taken", "land was taken by the sword", "lands were taken by the sword"],
    ["war.siege", "seat was besieged", "seats were besieged"],
    ["war.strike", "town was struck from the air", "towns were struck from the air"],
    ["war.rebellion", "land rose in arms", "lands rose in arms"],
    [
      "war.raid",
      "raid fell on soldiers posted in a land",
      "raids fell on soldiers posted in lands",
    ],
    ["war.fleet", "fleet met another at sea", "fleets met at sea"],
    ["war.company", "hired company took the field", "hired companies took the field"],
    [
      "held.crime",
      "wrong was done to those a war had taken",
      "wrongs were done to those wars had taken",
    ],
    ["held.reckoned", "such wrong was answered for", "such wrongs were answered for"],
  ],
  money: [
    ["trade.crash", "market crashed", "markets crashed"],
    ["trade.slump", "realm's trade slumped", "realms' trade slumped"],
    ["credit.defaulted", "realm did not pay what it owed", "realms did not pay what they owed"],
    ["money.debased", "realm thinned its coin", "realms thinned their coin"],
    ["trade.route-opened", "road of trade opened", "roads of trade opened"],
    ["trade.sea-route", "sea route opened", "sea routes opened"],
    ["credit.founded", "house of lending opened", "houses of lending opened"],
    ["industry.mine", "mine was sunk", "mines were sunk"],
  ],
  people: [
    ["people.famine", "land went hungry", "lands went hungry"],
    ["health.outbreak", "land was struck by a sickness", "lands were struck by a sickness"],
    ["city.founded", "town grew to a city", "towns grew to cities"],
    ["settlement.founded", "town was founded", "towns were founded"],
    ["town.forsaken", "town was forsaken", "towns were forsaken"],
    ["order.revolt", "rising of the unfree broke out", "risings of the unfree broke out"],
    ["order.freed", "realm freed its unfree", "realms freed their unfree"],
    ["held.fled", "land took in those who fled a war", "lands took in those who fled wars"],
  ],
  minds: [
    ["lore.found", "craft was found", "crafts were found"],
    ["belief.founded", "faith was founded", "faiths were founded"],
    ["belief.schism", "faith split", "faiths split"],
    ["language.arose", "tongue arose", "tongues arose"],
    ["language.died", "tongue fell silent", "tongues fell silent"],
    ["notable.arose", "person of name rose", "people of name rose"],
    ["notable.died", "person of name died", "people of name died"],
    ["lore.lost-world", "craft was lost to the world", "crafts were lost to the world"],
    ["ideas.founded", "school of thought was founded", "schools of thought were founded"],
    ["ideas.split", "school of thought broke in two", "schools of thought broke in two"],
    ["ideas.work", "work of name was made", "works of name were made"],
    ["ideas.pilgrimage", "land became a place of pilgrimage", "lands became places of pilgrimage"],
  ],
  bodies: [
    ["bodies.founded", "institution was founded", "institutions were founded"],
    ["bodies.ended", "institution came to its end", "institutions came to their end"],
    ["bodies.strike", "strike was called", "strikes were called"],
    ["groups.rose", "group rose", "groups rose"],
    ["underworld.rose", "crime group rose", "crime groups rose"],
    ["underworld.war", "war broke out in the underworld", "wars broke out in the underworld"],
    ["underworld.ended", "crime group came to its end", "crime groups came to their end"],
    [
      "bodies.sentenced",
      "court passed a sentence that was told",
      "courts passed sentences that were told",
    ],
    ["groups.struck", "group struck at one of name", "groups struck at people of name"],
    ["groups.razed", "group's hold was razed", "groups' holds were razed"],
  ],
  nature: [
    ["act.flood", "land was flooded", "lands were flooded"],
    ["weather.drought", "land went dry", "lands went dry"],
    ["act.quake", "land was shaken", "lands were shaken"],
    ["wild.fire", "land burned", "lands burned"],
    ["act.fire", "land burned", "lands burned"],
    ["planet.eruption", "mountain burst", "mountains burst"],
    ["ecology.hunters-gone", "land lost its great hunters", "lands lost their great hunters"],
    ["life.kind-gone", "kind of creature died out", "kinds of creature died out"],
    ["ecology.sea-few", "sea ran low of its catch", "seas ran low of their catch"],
  ],
  far: [
    ["space.satellite", "craft was put above the sky", "craft were put above the sky"],
    ["space.crew", "crew went up", "crews went up"],
    ["space.colony", "hall was raised on another body", "halls were raised on other bodies"],
    ["filled.sailed", "ship set out for another star", "ships set out for other stars"],
    ["filled.landed", "world was settled", "worlds were settled"],
    ["starwar.battle", "fleet came to its war", "fleets came to their wars"],
    ["trade.opened", "run of trade opened among the stars", "runs of trade opened among the stars"],
  ],
};

const WORDS = "zero one two three four five six seven eight nine ten eleven twelve".split(" ");
const said = (n: number): string => WORDS[n] ?? count(n);
const ORDINALS =
  "zeroth first second third fourth fifth sixth seventh eighth ninth tenth eleventh twelfth".split(
    " ",
  );
function ordinal(n: number): string {
  if (ORDINALS[n]) return ORDINALS[n]!;
  const teen = n % 100 >= 11 && n % 100 <= 13;
  return `${count(n)}${teen ? "th" : n % 10 === 1 ? "st" : n % 10 === 2 ? "nd" : n % 10 === 3 ? "rd" : "th"}`;
}

/** Clauses as one sentence: "a, b and c." */
function clauses(parts: readonly string[]): string {
  if (!parts.length) return "";
  const head = parts.slice(0, -1).join(", ");
  return `${sentence(head ? `${head} and ${parts.at(-1)}` : parts[0]!)}.`;
}

/** A number said short, for a small tile: 1.13 billion, 29.2 million, 14,200. */
function short(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(a >= 1e10 ? 1 : 2)} billion`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(a >= 1e7 ? 1 : 2)} million`;
  return count(n);
}

// ————— A realm's own events —————

/** A land a ref names (-1: none). */
const cellOf = (ref: string | null | undefined): number =>
  ref?.startsWith("cell:") ? Number(ref.split(":")[2]) : -1;

/** The lands a realm held in a year: by the years kept of each land's realm; now, its own. */
function landsIn(world: World, realm: string, year: number): Set<number> {
  const out = new Set<number>(),
    store = yearsOf(world);
  if (year >= yearNow(world) || !store) {
    for (const c of politiesOf(world).get(realm as Ref)?.members ?? []) out.add(c);
    return out;
  }
  for (const [cell, log] of store.landRealm)
    if (year >= log.first && logAt(log, year) === realm) out.add(cell);
  return out;
}

/** The lands any of some realms held in a year, in one reading of the lands' realms. */
function landsOfAll(world: World, realms: ReadonlySet<string>, year: number): Map<number, string> {
  const out = new Map<number, string>(),
    store = yearsOf(world);
  if (!realms.size) return out;
  if (year >= yearNow(world) || !store) {
    for (const r of realms)
      for (const c of politiesOf(world).get(r as Ref)?.members ?? []) out.set(c, r);
    return out;
  }
  for (const [cell, log] of store.landRealm) {
    const r = year >= log.first ? logAt(log, year) : undefined;
    if (r && realms.has(r)) out.set(cell, r);
  }
  return out;
}

/** Whether an event is of a realm in a year: it names it, or fell in one of its lands or towns. */
function keepOf(world: World, realm: string, year: number): (e: HistoryEvent) => boolean {
  const lands = landsIn(world, realm, year),
    towns = populationContext(world).settlements;
  return (e) => {
    if (lands.has(cellOf(e.place))) return true;
    for (const s of e.subjects) {
      if (s === realm) return true;
      if (s.startsWith("cell:") && lands.has(cellOf(s))) return true;
      if (s.startsWith("town:") && lands.has(towns.get(s)?.cell ?? -1)) return true;
    }
    return false;
  };
}

/** What each year tells of the world, of a realm or of an alliance, read once for one telling. */
type Reader = {
  readonly realm: string | null;
  /** An alliance's years, where it is an alliance's telling. */
  readonly bloc: BlocYears | null;
  /** Of an alliance: those who stood in it that year or the year before (whose doings are its own). */
  inIt(year: number): ReadonlySet<string>;
  readonly world: World;
  readonly now: number;
  told(year: number): readonly Told[];
  events(year: number): readonly HistoryEvent[];
  /** How many of each kind a year holds, the greatest of each, and those who fell in its battles. */
  counts(year: number): Counts;
};
type Counts = {
  readonly n: ReadonlyMap<string, number>;
  readonly best: ReadonlyMap<string, HistoryEvent>;
  readonly fallen: number;
  readonly battle: HistoryEvent | null;
};

/**
 * Whether an event is an alliance's in a year: it names one who stood in it then or the year before, or it is a great thing
 * that fell in one of their lands (a land's lesser weather is its realm's to tell, not the alliance's).
 */
function keepOfBloc(world: World, b: BlocYears, y: number, inIt: ReadonlySet<string>) {
  const lands = landsOfAll(world, new Set(b.members(y)), y);
  const towns = populationContext(world).settlements;
  return (e: HistoryEvent): boolean => {
    for (const s of e.subjects) if (inIt.has(s)) return true;
    if (e.importance < 5) return false;
    if (lands.has(cellOf(e.place))) return true;
    for (const s of e.subjects) {
      if (s.startsWith("cell:") && lands.has(cellOf(s))) return true;
      if (s.startsWith("town:") && lands.has(towns.get(s)?.cell ?? -1)) return true;
    }
    return false;
  };
}

function readerOf(world: World, subject: string | null): Reader {
  const told = new Map<number, readonly Told[]>(),
    events = new Map<number, readonly HistoryEvent[]>(),
    counts = new Map<number, Counts>(),
    keeps = new Map<number, (e: HistoryEvent) => boolean>(),
    sets = new Map<number, ReadonlySet<string>>(),
    now = yearNow(world),
    bloc = isBloc(subject) ? blocYears(world, subject.slice(BLOC.length)) : null,
    realm = bloc || isBloc(subject) ? null : subject,
    inIt = (y: number): ReadonlySet<string> => {
      let set = sets.get(y);
      if (!set)
        sets.set(y, (set = new Set(bloc ? [...bloc.members(y), ...bloc.members(y - 1)] : [])));
      return set;
    },
    keep = (y: number) => {
      let k = keeps.get(y);
      if (!k)
        keeps.set(y, (k = bloc ? keepOfBloc(world, bloc, y, inIt(y)) : keepOf(world, realm!, y)));
      return k;
    },
    filtered = !!(realm || bloc);
  return {
    realm,
    bloc,
    inIt,
    world,
    now,
    told(year) {
      if (year < 0 || year > now) return [];
      let t = told.get(year);
      if (!t) {
        t = filtered ? toldOf(world, year, keep(year)) : toldOf(world, year);
        // (An alliance's own: who came and went, its forming and its end, the foes it fought side by side.)
        if (bloc) t = [...blocTold(world, bloc, year, (y) => eventsOf(world, y)), ...t];
        told.set(year, t);
      }
      return t;
    },
    events(year) {
      if (year < 0 || year > now) return [];
      let e = events.get(year);
      if (!e) {
        e = eventsOf(world, year);
        if (filtered) e = e.filter(keep(year));
        events.set(year, e);
      }
      return e;
    },
    counts(year) {
      let c = counts.get(year);
      if (c) return c;
      const n = new Map<string, number>(),
        best = new Map<string, HistoryEvent>();
      let fallen = 0,
        battle: HistoryEvent | null = null,
        most = -1;
      for (const e of this.events(year)) {
        n.set(e.type, (n.get(e.type) ?? 0) + 1);
        const b = best.get(e.type);
        if (!b || e.importance > b.importance) best.set(e.type, e);
        if (e.type !== "war.battle") continue;
        const f = (e.data as { fallen?: number } | null)?.fallen ?? 0;
        fallen += f;
        if (f > most) {
          most = f;
          battle = e;
        }
      }
      counts.set(year, (c = { n, best, fallen, battle }));
      return c;
    },
  };
}

// ————— What leads —————

type Cand = { readonly t: Told; readonly score: number; readonly alone: boolean };

/** A year's lines by how they stand out: worth, and more the rarer their like in the years about. */
function ranked(r: Reader, year: number): Cand[] {
  const mine = r.told(year).filter((t) => t.worth >= KIND_WORTH),
    most = standouts(r, year);
  if (!mine.length) return most;
  const others = new Map<string, number[]>();
  for (let y = year - ABOUT; y <= year + ABOUT; y++) {
    if (y === year) continue;
    const best = new Map<string, number>();
    for (const t of r.told(y)) if (t.worth > (best.get(t.key) ?? 0)) best.set(t.key, t.worth);
    for (const [key, worth] of best) {
      const list = others.get(key);
      if (list) list.push(worth);
      else others.set(key, [worth]);
    }
  }
  return [
    ...most,
    ...mine.map((t) => {
      const like = (others.get(t.key) ?? []).filter((w) => w >= t.worth - 0.5).length,
        // (Of a realm's own year, what it did or what was done to it leads over what befell one of its lands; of an
        // alliance's, its own doings over what one of its realms did alone.)
        own =
          (r.realm && r.world.events.get(t.ref as Ref)?.subjects.includes(r.realm as Ref)) ||
          (r.bloc && isOwn(r, t, year))
            ? 1.5
            : 0;
      return {
        t,
        score: t.worth * (COMMON + (1 - COMMON) / (1 + like / 3)) + own,
        alone: like === 0,
      };
    }),
  ].sort((a, b) => b.score - a.score);
}

/** Whether a line is an alliance's own doing: its comings and goings, or a call, a bond, a peace or a quarrel of its own. */
function isOwn(r: Reader, t: Told, year: number): boolean {
  return t.key.startsWith("bloc.") || blocOwn(r.world.events.get(t.ref as Ref), r.inIt(year));
}

/** What may change who leads an alliance in person: its head realm's ruler, or its rule, changing. */
const HEAD_TYPES = new Set([
  "polity.succession",
  "polity.reformed",
  "strife.coup",
  "strife.revolution",
  "strife.throne",
  "order.elected",
  "court.seized",
]);

/**
 * What may lead a year: of the world or a realm, all of it; of an alliance, its own doings, what changed who leads it, and
 * what is great enough to be told with no filter. A guild founded in one of its realms is that realm's to lead with.
 */
function leading(r: Reader, year: number): Cand[] {
  const all = ranked(r, year);
  if (!r.bloc) return all;
  const h = r.bloc.headAt(year);
  return all.filter((c) => {
    if (c.t.worth >= ALL_WORTH || isOwn(r, c.t, year)) return true;
    const e = r.world.events.get(c.t.ref as Ref);
    return !!e && HEAD_TYPES.has(e.type) && !!h && e.subjects[0] === h;
  });
}

/** A year must hold this many of a kind, and this many times the usual of the years about it, for the count itself to be told. */
const MOST_LEAST = 4,
  MOST_TIMES = 2;

/**
 * What a year held more of than any of the twenty about it: a count that stands out is itself a thing to tell, where no one
 * happening is (a year of a million dead in thirty battles, none of them the worst of its war).
 */
function standouts(r: Reader, year: number): Cand[] {
  const here = r.counts(year),
    about: Counts[] = [];
  for (let y = year - ABOUT; y <= year + ABOUT; y++)
    if (y !== year && y >= 0 && y <= r.now) about.push(r.counts(y));
  // (Against a few years alone, the most means little.)
  if (about.length < ABOUT) return [];
  const first = Math.max(0, year - ABOUT),
    last = Math.min(r.now, year + ABOUT),
    span = `from ${count(first)} to ${count(last)}`,
    out: Cand[] = [],
    weigh = (n: number, others: readonly number[]) => {
      const mean = others.reduce((a, b) => a + b, 0) / others.length,
        top = Math.max(...others);
      return n >= top + 2 && n >= MOST_TIMES * Math.max(1, mean) ? n / Math.max(1, mean) : 0;
    },
    add = (key: string, kind: number, times: number, e: HistoryEvent | null, words: string) =>
      out.push({
        t: {
          kind,
          worth: ALL_WORTH,
          ref: e?.id ?? "world:chronicle#years",
          key,
          say: () => [`${sentence(words)}, more than in any other year ${span}.`],
        },
        score: 3.6 + Math.min(1.4, times / 5),
        alone: false,
      });
  const seen = new Set<string>();
  for (const id of Object.keys(COUNTED) as SectionId[])
    for (const [type, one, more] of COUNTED[id]) {
      const n = here.n.get(type) ?? 0;
      // (Of one realm's lands a handful is no count to tell.)
      if (n < (r.realm || r.bloc ? 2 * MOST_LEAST : MOST_LEAST) || seen.has(one)) continue;
      seen.add(one);
      const times = weigh(
        n,
        about.map((c) => c.n.get(type) ?? 0),
      );
      if (times) add(`most:${type}`, 3, times, here.best.get(type) ?? null, `${said(n)} ${more}`);
    }
  if (here.fallen >= 10_000) {
    const times = weigh(
      here.fallen,
      about.map((c) => c.fallen),
    );
    if (times)
      add("most:fallen", 0, times + 3, here.battle, `${short(here.fallen)} fell in battle`);
  }
  return out;
}

/** A sentence cut to a headline: at a break in it where one falls short enough, else at a word. */
function clip(words: string, most = 84): string {
  let s = words.replace(/[.!?…]+$/, "").trim();
  if (s.length <= most) return s;
  // (What stands between two commas after its first words says who they are, not what happened: "…, the voice of the court, …".)
  s = s.replace(/^([^,:;]{3,48}), [^,:;]{3,64}, (?=[a-z])/, "$1 ");
  if (s.length <= most) return s;
  for (const mark of [". ", ": ", "; ", ", and ", ", who ", ", its ", ", as ", ", after ", ", "]) {
    const at = s.lastIndexOf(mark, most);
    if (at >= 30) return s.slice(0, at);
  }
  const at = s.lastIndexOf(" ", most);
  return `${s.slice(0, at > 0 ? at : most)}…`;
}

const SAME = new WeakMap<
  World,
  {
    stamp: string;
    /** Where in the log each kind's events lie: read once, from its column of kinds alone. */
    rows: Map<string, number[]>;
    by: Map<string, { t: number; who: string; i: number }[]>;
    /** Each earlier happening's headline words, once read (the same ones are asked of year after year). */
    words: Map<number, string>;
  }
>();

/**
 * Whether a headline was said before of the same one, said after it ("…, for the second time"): a realm of a name ends, and
 * centuries on another of that name does; a coup in a realm is foiled, and again. Only where the earlier headline is the same
 * word for word: a seat that passes thirty times passes each time to another. Read from the log's own column of kinds, a kind
 * at a time, and kept until the log moves on.
 */
function againWords(world: World, t: Told, said: string): string {
  const e = world.events.get(t.ref as Ref);
  // (A line of many happenings, or a count, is its own; and what a land suffers again says its own numbers.)
  // (Who it is of: its realms, in order; a war's peace names its war first, then its two sides.)
  const of = (x: HistoryEvent) => x.subjects.filter((s) => s.startsWith("pol:"));
  if (!e || t.key !== e.type || !of(e)[0]) return "";
  const stamp = stampOf(world);
  let kept = SAME.get(world);
  if (!kept || kept.stamp !== stamp) {
    const rows = new Map<string, number[]>(),
      log = world.events;
    for (let i = 0; i < log.count; i++) {
      // (What mattered little is never a headline.)
      if (log.importanceAt(i) < 3) continue;
      const type = log.at(i).type,
        list = rows.get(type);
      if (list) list.push(i);
      else rows.set(type, [i]);
    }
    SAME.set(world, (kept = { stamp, rows, by: new Map(), words: new Map() }));
  }
  let list = kept.by.get(e.type);
  if (!list) {
    list = [];
    for (const i of kept.rows.get(e.type) ?? []) {
      const x = world.events.at(i);
      const who = of(x);
      if (who[0]) list.push({ t: x.t, who: who.join("|"), i });
    }
    kept.by.set(e.type, list);
  }
  // (A realm's seat names it whatever its rule is called from age to age.)
  const seatOf = (ref: string) => politiesOf(world).get(ref as Ref)?.town ?? "",
    who = of(e).join("|"),
    name = seatOf(of(e)[0]!),
    like: number[] = [];
  for (const x of list) {
    if (x.t >= e.t) break;
    if (x.who === who || (name && seatOf(x.who.split("|")[0]!) === name)) like.push(x.i);
  }
  // (The last few dozen of them are read for their words: a headline said longer ago than that is said again.)
  // (The same up to its first break: what follows a comma is how, or by whom, and may differ.)
  const head = said.split(/, |: |…/)[0]!;
  let same = 0;
  // (The last forty: a council left and joined forty times over is said again past them, and its count would stall.)
  for (const i of like.slice(-40)) {
    let words = kept.words.get(i);
    if (words === undefined) {
      const x = world.events.at(i);
      kept.words.set(i, (words = headWords(world, lineOf(world, x, yearOfMoment(x.t)))));
    }
    if (words.startsWith(head)) same++;
  }
  if (!same) return "";
  return e.type === "polity.ended"
    ? `, the ${ordinal(same + 1)} of that name`
    : `, for the ${ordinal(same + 1)} time`;
}

/** A line as a headline's words, before they are cut short: who, where, how many. */
function headWords(world: World, line: Line): string {
  const g = world.hasStore("planet.home") ? homePlanet(world).generated : null;
  return (
    line
      // (A land with no name of its own is told by where it lies: "the hot desert" is a hundred lands.)
      .map((s) => {
        if (typeof s === "string") return s;
        const cell = cellOf(s.ref);
        if (
          !g ||
          cell < 0 ||
          cell >= g.offworld.base ||
          /\p{Lu}/u.test(s.text.replace(/^The /, "the "))
        )
          return s.text;
        const lat = (g.grid.lat[cell]! * 180) / Math.PI,
          lon = (g.grid.lon[cell]! * 180) / Math.PI;
        return `${s.text} at ${Math.abs(Math.round(lat))}°${lat < 0 ? "S" : "N"} ${Math.abs(Math.round(lon))}°${lon < 0 ? "W" : "E"}`;
      })
      .join("")
      // (How many more like it is the line's to say.)
      .replace(/, and (?:\w+|[\d,]+) more [^,.;:]*?(?=[.;:]|$)/, "")
      // (Signals heard: from how far, not what they looked like who sent them.)
      .replace(/ — [^—]*?, of a world ([\d.]+ light-years) away — .*$/, " $1 away")
      // (What all the world waits on: who stands at the brink is the headline.)
      .replace(/^The whole world holds its breath: (.)/, (_, c: string) => `At the brink: ${c}`)
      // (Several realms fallen: by their short names, so the headline holds who they were.)
      .replace(
        /^(\w+) realms came to an end: (.*)$/,
        (_, n: string, names: string) =>
          `${n} realms fell: ${names.replace(/\bthe [a-z][a-z ]*? of (?=\p{Lu})/gu, "")}`,
      )
  );
}

/** A line's headline with nothing said after it: cut where it has named someone or counted something. */
function baseHeadline(world: World, line: Line, room = 0): string {
  const words = headWords(world, line),
    short = clip(words, 96 - room),
    names = line.flatMap((s) =>
      typeof s !== "string" && /\p{Lu}/u.test(s.text.slice(1)) ? [s.text] : [],
    );
  // (Cut before it named anyone or counted anything: the longer cut, which does.)
  if (
    short.length < words.replace(/[.!?…]+$/, "").length &&
    !/\d/.test(short) &&
    !names.some((n) => short.includes(n))
  )
    return clip(words, 118 - room);
  return short;
}

/** A line's headline: its own words, short, and holding who or where or how many, so that no two years share one. */
function headlineOf(world: World, t: Told, year: number): string {
  const line = toldWords(world, t, year),
    again = againWords(world, t, baseHeadline(world, line));
  return again ? `${baseHeadline(world, line, again.length)}${again}` : baseHeadline(world, line);
}

/** What a lead's picture shows, by its happening's kind. */
const TYPE_MOTIF: readonly (readonly [RegExp, ToldMotif])[] = [
  [/^(planet\.eruption|wild\.rise)/, "eruption"],
  [/^(war\.fleet)/, "ship"],
  [/^(ideas\.pilgrimage)/, "faith"],
  [/^(ideas\.split)/, "strife"],
  [/^(groups\.razed)/, "fire"],
  [/^(groups\.unpaid)/, "coin"],
  [/^(held\.(crime|fled)|ecology\.sea-few)/, "fall"],
  [/^(held\.reckoned|bodies\.sentenced)/, "crown"],
  [/^(held\.settled)/, "peace"],
  [/^(groups\.struck|underworld\.struck)/, "strife"],
  [/^(fire\.clear|wild\.answer)/, "found"],
  [/^(act\.quake)/, "quake"],
  [/^(act|toy)\.flood/, "flood"],
  [/^(act\.(fire|meteor|flare)|wild\.fire|war\.strike|fire\.)/, "fire"],
  [/^(war\.peace|terms\.|diplomacy\.pact|ties\.league$|underworld\.(pax|truce))/, "peace"],
  [/^(war\.|underworld\.(war|feud|clash|operation)|groups\.hired)/, "battle"],
  [
    /^(polity\.ended|town\.forsaken|lore\.lost|nation\.(fell|dark)|far\.fell|language\.died)/,
    "fall",
  ],
  [/^(polity\.(formed|seceded|joined)|city\.|settlement\.|town\.|province\.)/, "rise"],
  [
    /^(strife\.|polity\.split|order\.(revolt|crushed|crisis|movement)|houses\.(purged|overthrown)|bodies\.strike)/,
    "strife",
  ],
  [/^(polity\.|court\.|reign\.|order\.|notable\.|houses\.|ties\.)/, "crown"],
  [/^(health\.|act\.(plague|curse))/, "sickness"],
  [/^(ecology\.(woods-turn|forest-cleared))/, "woods"],
  [/^(industry\.(lode-out|lode-deeper|mine|well))/, "dig"],
  [/^(people\.famine|weather\.|climate\.|ecology\.|people\.smoke)/, "famine"],
  [/^(belief\.)/, "faith"],
  [/^(trade\.sea-route|war\.sea)/, "ship"],
  [
    /^(money\.|credit\.|finance\.|trade\.(crash|slump|cartel|route-opened|machines|relief|embargo))/,
    "coin",
  ],
  [
    /^(space\.|lanes\.|contact\.|peoples\.|filled\.|nation\.|far\.|late\.|starwar\.|trade\.|frontier\.)/,
    "star",
  ],
  [/^(beast\.|life\.|wild\.)/, "beast"],
  [
    /^(lore\.|knowledge\.|lessons\.|industry\.|design\.|language\.|bodies\.|groups\.|underworld\.)/,
    "found",
  ],
];

function vignetteOf(world: World, t: Told | null, land: number | null): ToldVignette | null {
  if (!world.hasStore("planet.home")) return null;
  const e = t ? world.events.get(t.ref as Ref) : undefined,
    realms = (e?.subjects ?? []).filter((s) => s.startsWith("pol:")) as string[],
    town = e?.subjects.find((s) => s.startsWith("town:")),
    place = e ? cellOf(e.place) : -1,
    seat = realms[0] ? (politiesOf(world).get(realms[0] as Ref)?.seat ?? -1) : -1,
    at = place >= 0 ? place : seat >= 0 ? seat : (land ?? -1),
    motif: ToldMotif = !t
      ? "quiet"
      : e
        ? (TYPE_MOTIF.find(([re]) => re.test(e.type))?.[1] ?? "found")
        : t.key === "first"
          ? "found"
          : (["battle", "found", "famine", "crown", "star"] as const)[t.kind]!,
    g = homePlanet(world).generated,
    here = at >= 0 && at < g.offworld.base ? at : undefined,
    // (Two sides: their banners against each other. A seat and its people: the land they stand on. Else what it names.)
    scene =
      realms.length >= 2 && (motif === "battle" || motif === "peace" || motif === "fire")
        ? sceneBanner(world, {
            sides: [realms[0]!, realms[1]!],
            ...(here !== undefined ? { land: here } : {}),
          })
        : motif === "rise" || motif === "fall"
          ? sceneBanner(world, {
              ...(town ? { town } : {}),
              ...(realms[0] ? { realm: realms[0] } : {}),
              ...(here !== undefined ? { land: here } : {}),
            })
          : // (A realm's arms over the shape of its lands are a rising's or a fall's: anything else is drawn on ground.)
            sceneBanner(world, {
              ...(here !== undefined ? { land: here } : {}),
              ...(town ? { town } : {}),
            });
  return {
    motif,
    scene,
    key: hashString(`told ${t?.ref ?? land ?? 0}`) >>> 0,
    tints: realms.slice(0, 2).map((ref) => realmColor(ref)),
  };
}

/** An event as a line under another year: its own year said first where it is not that year's. */
function eventItem(world: World, e: HistoryEvent, under: number): ToldItem {
  const y = yearOfMoment(e.t),
    line = lineOf(world, e, y);
  return { line: y === under ? line : [`${y}: `, ...line], ref: e.id, year: y };
}

/** How far back, in years, a cause counts for half of what one of the year itself does; how old one is called "long before". */
const NEAR_YEARS = 8,
  LONG_BEFORE = 40;

/**
 * What led to a happening: of the happenings behind it (its causes, and theirs, through the choices between), the one a reader
 * would call the reason, by how much it weighed in what followed and how near it lies. The 1,493 coup of Baisholt named a land
 * that learned a standing army in 659: the heaviest link at each step, eight centuries back. A root long before is kept as a
 * second line, said to be so, only where it mattered greatly.
 */
function ledTo(world: World, ref: string, year: number): ToldItem[] {
  type Found = { e: HistoryEvent; weight: number; depth: number };
  const found = new Map<string, Found>(),
    seen = new Set<string>([ref]),
    walk = (id: string, weight: number, depth: number, steps: number) => {
      // (No more than a score of what lies behind it is read: each may be a far year's, unpacked for the asking.)
      if (steps > 8 || depth > 3 || ++read > 20) return;
      const node = why(world, id as Ref),
        top = Math.max(1e-9, ...node.causes.map((c) => Math.abs(c.cause.weight)));
      for (const edge of [...node.causes]
        .sort((a, b) => b.cause.weight - a.cause.weight)
        .slice(0, 3)) {
        const to = edge.cause.ref;
        if (seen.has(to) || edge.cause.weight <= 0) continue;
        seen.add(to);
        const w = weight * (edge.cause.weight / top),
          e = world.events.get(to);
        // (A choice between them is told on the happening's own page, with what weighed in it: here, what happened before.)
        if (e) {
          found.set(to, { e, weight: w, depth: depth + 1 });
          walk(to, w * 0.6, depth + 1, steps + 1);
        } else walk(to, w, depth, steps + 1);
      }
    };
  let read = 0;
  walk(ref, 1, 0, 0);
  const of = world.events.get(ref as Ref),
    mine = new Set<string>([...(of?.subjects ?? []), ...(of?.place ? [of.place] : [])]);
  if (!found.size) return [];
  const ago = (f: Found) => Math.max(0, year - yearOfMoment(f.e.t)),
    score = (f: Found) => (f.weight * (2 + f.e.importance)) / (1 + ago(f) / NEAR_YEARS),
    // (What lies long before is no one's reason for a thing unless it mattered greatly: it is the root, or nothing.)
    ranked = [...found.values()]
      .filter((f) => ago(f) < LONG_BEFORE)
      .sort((a, b) => score(b) - score(a) || b.e.t - a.e.t),
    reason = ranked[0],
    // (What a year's turn did is stamped a breath after what it caused: told as of the same year.)
    item = (e: HistoryEvent): ToldItem =>
      yearOfMoment(e.t) > year
        ? { line: lineOf(world, e, yearOfMoment(e.t)), ref: e.id, year }
        : eventItem(world, e, year),
    out = reason ? [item(reason.e)] : [],
    // (A second of the same years, where one weighs nearly as much.)
    second = reason
      ? ranked.find((f) => f !== reason && score(f) >= 0.6 * score(reason))
      : undefined,
    root = [...found.values()]
      // (Telling: it mattered greatly, weighed much in what followed, lies within a few lifetimes, and is of the same
      // realm or the same land.)
      .filter(
        (f) =>
          ago(f) >= LONG_BEFORE &&
          ago(f) <= 250 &&
          f.e.importance >= 5 &&
          f.weight >= 0.35 &&
          (f.e.subjects.some((x) => mine.has(x)) || (!!f.e.place && mine.has(f.e.place))),
      )
      .sort((a, b) => b.weight * b.e.importance - a.weight * a.e.importance)[0];
  if (second) out.push(item(second.e));
  if (root) {
    const y = yearOfMoment(root.e.t);
    out.push({
      line: [`Long before, in ${y}: `, ...lineOf(world, root.e, y)],
      ref: root.e.id,
      year: y,
    });
  }
  return out;
}

/** What came of a happening: what the next years hold that names it among its causes, the greatest first. */
function cameOf(world: World, r: Reader, ref: string, year: number): ToldItem[] {
  const found: HistoryEvent[] = [],
    now = yearNow(world);
  for (let y = year; y <= Math.min(now, year + ABOUT) && found.length < 24; y++)
    for (const e of r.realm || r.bloc ? eventsOf(world, y) : r.events(y))
      if (e.id !== ref && e.causes.some((c) => c.ref === ref)) found.push(e);
  return found
    .sort((a, b) => b.importance - a.importance || a.t - b.t)
    .slice(0, 3)
    .sort((a, b) => a.t - b.t)
    .map((e) => eventItem(world, e, year));
}

// ————— The numbers that move —————

type Through = ReadonlyMap<number, number>;

const PEOPLE = new WeakMap<World, { at: number; people: Through; fed: Through }>();

/** The world's people and how they ate, by each year history keeps of its lands (read once a moment). */
function worldThrough(world: World): { people: Through; fed: Through } {
  const hit = PEOPLE.get(world);
  if (hit && hit.at === world.now) return hit;
  const ctx = populationContext(world),
    people = new Map<number, number>(),
    eaten = new Map<number, number>();
  for (const p of ctx.provinces.all())
    for (const line of ctx.history.yearsOf(p.cell)) {
      people.set(line.year, (people.get(line.year) ?? 0) + line.population);
      eaten.set(
        line.year,
        (eaten.get(line.year) ?? 0) + line.population * Math.min(1000, line.fed),
      );
    }
  const fed = new Map<number, number>();
  for (const [y, n] of people) fed.set(y, n ? eaten.get(y)! / n / 1000 : 1);
  // (The year open now: as its lands stand.)
  const now = yearNow(world);
  if (!people.has(now)) people.set(now, ctx.provinces.total());
  const read = { at: world.now, people, fed };
  PEOPLE.set(world, read);
  return read;
}

/** How a number stands against what it was. */
function against(
  now: number,
  was: number | undefined,
  words: string,
  same: string,
  sharePoints = false,
) {
  if (was === undefined) return null;
  // (A share that moved by less than a point in a hundred stands as it was.)
  const d = sharePoints && Math.abs(now - was) < 0.005 ? 0 : now - was,
    way = d > 0 ? 1 : d < 0 ? -1 : 0;
  if (!way) return { words: same, way } as const;
  const sign = d > 0 ? "+" : "−",
    amount = sharePoints
      ? `${sign}${Math.abs(Math.round(d * 100))} points`
      : Math.abs(was) >= 100
        ? d / was >= 2
          ? // (Many times over is said so: "+3084%" is no one's way of saying thirty-two times.)
            `${count(Math.round(now / was))} times what it was,`
          : Math.abs(d / was) >= 0.1
            ? `${sign}${Math.round(Math.abs(d / was) * 100)}%`
            : `${sign}${(Math.abs(d / was) * 100).toFixed(1)}%`
        : `${sign}${count(Math.abs(d))}`;
  return { words: `${amount} ${words}`, way } as const;
}

function figure(
  id: string,
  label: string,
  at: (y: number) => number | undefined,
  year: number,
  write: (n: number) => string,
  good: -1 | 0 | 1,
  extra: { ref?: string; share?: boolean; back?: number; since?: number } = {},
): ToldFigure | null {
  // (Where it was not read in the year itself, a year long gone, the last reading before it: said so.)
  let read = year;
  while (at(read) === undefined && read > year - EVERY_YEARS && read > 0) read--;
  const v = at(read);
  if (v === undefined) return null;
  const points: { x: number; y: number }[] = [],
    since = extra.since,
    back = since !== undefined ? read - since : read < year ? 5 * ABOUT : (extra.back ?? 2 * ABOUT);
  for (let y = read - back; y <= read; y++) {
    const n = at(y);
    if (n !== undefined) points.push({ x: y, y: n });
  }
  // (Of a run of years: how it stood at their end against their beginning, or the first of them it was read in.)
  if (since !== undefined) {
    const first = points.find((q) => q.x < read);
    return {
      id,
      label: read < year ? `${label}, as counted in ${count(read)}` : label,
      value: write(v),
      year1: first
        ? against(v, first.y, `since ${count(first.x)}`, `as in ${count(first.x)}`, extra.share)
        : null,
      year10: null,
      good,
      points,
      ...(extra.ref ? { ref: extra.ref } : {}),
    };
  }
  return {
    id,
    label: read < year ? `${label}, as counted in ${count(read)}` : label,
    value: write(v),
    year1:
      read < year
        ? null
        : against(v, at(year - 1), "on the year before", "as the year before", extra.share),
    year10: against(
      v,
      at(read - 10),
      read < year ? "on ten years before" : "in ten years",
      "as ten years before",
      extra.share,
    ),
    good,
    points,
    ...(extra.ref ? { ref: extra.ref } : {}),
  };
}

const WARS = new WeakMap<World, { n: number; at: number; by: Map<number, number> }>();
/** How many wars were being fought in each year, by the world's own count of its wars (read once as they change). */
function warsThrough(world: World): Map<number, number> {
  if (!world.hasStore("war.wars")) return new Map();
  const all = warsOf(world).all(),
    hit = WARS.get(world),
    now = yearNow(world);
  if (hit && hit.n === all.length && hit.at === now) return hit.by;
  const by = new Map<number, number>();
  for (const w of all)
    for (let y = w.declared; y <= (w.ended ?? now); y++) by.set(y, (by.get(y) ?? 0) + 1);
  WARS.set(world, { n: all.length, at: now, by });
  return by;
}

function figuresOf(world: World, r: Reader, year: number, from = year): ToldFigure[] {
  const run = from < year ? { since: from } : {},
    now = yearNow(world),
    out: (ToldFigure | null)[] = [],
    pct = (n: number) => `${Math.round(n * 100)}%`;
  if (r.bloc) {
    // An alliance's numbers: its realms of each year, summed (not its realms of now), and its share of the world's people.
    const b = r.bloc,
      ref = `bloc:${b.head}`;
    if (b.headAt(year)) {
      // (Its numbers from the year it last came to stand: before then they were another alliance's, or none.)
      const since = b.standingSince(year),
        mine = (y: number) => y >= since && y <= now;
      b.prepare(Math.max(since, Math.min(from, year - 2 * ABOUT)) - 1, year);
      const of =
          (f: (n: { realms: number; people: number; host: number }) => number) => (y: number) => {
            const n = mine(y) ? b.numbers(y) : null;
            return n ? f(n) : undefined;
          },
        foes = (y: number) => {
          if (!world.hasStore("war.wars") || !mine(y)) return undefined;
          const inIt = new Set(b.members(y));
          if (!inIt.size) return undefined;
          const seen = new Set<string>();
          for (const m of inIt)
            for (const w of warsOf(world).of(m as Ref))
              if (
                w.declared <= y &&
                (w.ended ?? now) >= y &&
                !inIt.has(w.attacker === m ? w.defender : w.attacker)
              )
                seen.add(w.ref);
          return seen.size;
        };
      out.push(
        figure(
          "realms",
          "Realms in it",
          of((n) => n.realms),
          year,
          count,
          1,
          {
            ref: `${ref}#time`,
            ...run,
          },
        ),
        figure(
          "people",
          "People",
          of((n) => n.people),
          year,
          short,
          1,
          { ref, ...run },
        ),
        figure(
          "share",
          "Of the world's people",
          (y) => {
            const n = mine(y) ? b.numbers(y) : null,
              all = n ? b.peopled(y) : 0;
            return n && all ? n.people / all : undefined;
          },
          year,
          pct,
          1,
          { share: true, ref: "world:alliances", ...run },
        ),
        figure(
          "host",
          "Their hosts",
          of((n) => n.host),
          year,
          short,
          0,
          run,
        ),
        figure(
          "worth",
          "Its lands' wealth",
          (y) => (mine(y) ? b.worth(y) : undefined),
          year,
          worthWords,
          1,
          run,
        ),
        figure("wars", "Wars its realms fight", foes, year, count, -1, run),
      );
    }
  } else if (r.realm) {
    const t = realmThrough(world, r.realm),
      realm = politiesOf(world).get(r.realm as Ref),
      at = (list: readonly (number | null)[] | undefined) => {
        const by = new Map<number, number>();
        t?.years.forEach((y, i) => {
          const v = list?.[i];
          if (v !== null && v !== undefined) by.set(y, v);
        });
        return by;
      },
      people = at(t?.people),
      lands = at(t?.lands),
      fed = at(t?.fed),
      host = at(t?.host);
    // (The year open now: as it stands.)
    if (realm && realm.ended === null && year >= now) {
      const ctx = populationContext(world);
      people.set(
        now,
        realm.members.reduce((n, c) => n + (ctx.provinces.get(c)?.total() ?? 0), 0),
      );
      lands.set(now, realm.members.length);
    }
    const mine = world.hasStore("war.wars")
      ? warsOf(world)
          .all()
          .filter((w) => w.attacker === r.realm || w.defender === r.realm)
      : [];
    out.push(
      figure("people", "People", (y) => people.get(y), year, short, 1, {
        ref: `${r.realm}#time`,
        ...run,
      }),
      figure("lands", "Lands", (y) => lands.get(y), year, count, 1, {
        ref: `${r.realm}#time`,
        ...run,
      }),
      figure("fed", "Fed in the leanest month", (y) => fed.get(y), year, pct, 1, {
        share: true,
        ...run,
      }),
      figure("host", "Its host", (y) => host.get(y), year, short, 0, run),
      figure(
        "wars",
        "Wars it fights",
        (y) =>
          y > now || y < (realm?.founded ?? 0)
            ? undefined
            : mine.filter((w) => w.declared <= y && (w.ended ?? now) >= y).length,
        year,
        count,
        -1,
        run,
      ),
    );
  } else {
    const { people, fed } = worldThrough(world),
      wars = warsThrough(world),
      store = yearsOf(world),
      realms = new Map<number, number>(),
      realmsIn = (y: number): number | undefined => {
        if (!store || y > now || y < 0) return undefined;
        // (By the year, for as long as every change is kept; further back the years between are not.)
        if (y < now - EVERY_YEARS && y !== year && y !== from) return undefined;
        let n = realms.get(y);
        if (n === undefined) {
          const seen = new Set<string>();
          for (const log of store.landRealm.values()) {
            const v = y >= log.first ? logAt(log, y) : undefined;
            if (v) seen.add(v);
          }
          realms.set(y, (n = seen.size));
        }
        return n || undefined;
      };
    out.push(
      figure("people", "People", (y) => people.get(y), year, short, 1, {
        ref: "world:chronicle#story",
        ...run,
      }),
      figure("fed", "Fed in the leanest month", (y) => fed.get(y), year, pct, 1, {
        share: true,
        ...run,
      }),
      figure("realms", "Realms standing", realmsIn, year, count, 0, {
        ref: "world:ledger#realms",
        ...run,
      }),
      figure(
        "wars",
        "Wars being fought",
        (y) => (y > now || y < 0 || !world.hasStore("war.wars") ? undefined : (wars.get(y) ?? 0)),
        year,
        count,
        -1,
        { ref: "world:ledger#wars", ...run },
      ),
    );
  }
  // (Those who fell: read from the year's own battles, and from the ten years before it only; of a run, in all its years.)
  const fell = new Map<number, number>();
  let all = 0;
  for (let y = Math.max(0, from < year ? from : year - ABOUT); y <= year; y++) {
    fell.set(y, r.counts(y).fallen);
    all += r.counts(y).fallen;
  }
  if (from < year) {
    if (all > 0)
      out.push({
        id: "fallen",
        label: "Fell in battle, in all",
        value: short(all),
        year1: null,
        year10: null,
        good: -1,
        points: [...fell].map(([x, y]) => ({ x, y })),
      });
  } else if ([...fell.values()].some((n) => n > 0))
    out.push(
      figure("fallen", "Fell in battle", (y) => fell.get(y), year, short, -1, { back: ABOUT }),
    );
  return out.filter((f): f is ToldFigure => !!f);
}

// ————— A quiet year —————

/** What quietly changed: its people's number, the land that grew most, how long a peace has held. */
function quietLines(
  world: World,
  r: Reader,
  year: number,
): { headline: string; lines: ToldItem[]; land: number | null } {
  if (r.bloc) return blocQuiet(world, r.bloc, year);
  const now = yearNow(world),
    lines: ToldItem[] = [];
  let land: number | null = null,
    headline = "";
  const ctx = populationContext(world),
    lands = r.realm ? landsIn(world, r.realm, year) : null,
    at = (cell: number, y: number): number | undefined => {
      if (y >= now) return ctx.provinces.get(cell)?.total();
      // (A land's years lie oldest first; the last hundred are every year's.)
      const list = ctx.history.yearsOf(cell);
      for (let i = list.length - 1; i >= 0 && list[i]!.year >= y; i--)
        if (list[i]!.year === y) return list[i]!.population;
      return undefined;
    };
  let was = 0,
    is = 0,
    best = -1,
    most = 0,
    counted = 0;
  for (const p of ctx.provinces.all()) {
    if (lands && !lands.has(p.cell)) continue;
    const a = at(p.cell, year - 1),
      b = at(p.cell, year);
    if (a === undefined || b === undefined) continue;
    counted++;
    was += a;
    is += b;
    // (A land of some size: a hamlet doubling is no one's news.)
    if (a >= 2000 && b / a - 1 > most) {
      most = b / a - 1;
      best = p.cell;
    }
  }
  const whose = r.realm ? "Its" : "The world's",
    begun = year >= now && world.now - year * YEAR < 0.1 * YEAR;
  if (begun) {
    lines.push({ line: [`The year has only begun: ${short(is)} people stand in it.`], ref: null });
    headline = `Year ${count(year)} has only begun`;
  } else if (counted && was > 0) {
    const d = is - was;
    lines.push({
      line: [
        d === 0
          ? `${whose} people stood as they were, at ${short(is)}.`
          : `${whose} people ${d > 0 ? "grew" : "fell"} by ${short(Math.abs(d))} to ${short(is)}.`,
      ],
      ref: r.realm ? `${r.realm}#time` : "world:chronicle#story",
    });
    headline =
      d === 0
        ? `A still year: ${short(is)} people`
        : `A quiet year: ${short(Math.abs(d))} ${d > 0 ? "more" : "fewer"} people`;
  }
  if (best >= 0 && most >= 0.02) {
    land = best;
    lines.push({
      line: [
        link(sentence(landName(world, best)), `cell:0:${best}`),
        ` grew the most: ${Math.round(most * 100) >= 1 ? `${Math.round(most * 100)} in a hundred` : "a little"} more people in the year.`,
      ],
      ref: `cell:0:${best}#people`,
    });
  }
  // How long a peace has held, or how many wars go on.
  if (world.hasStore("war.wars")) {
    const all = warsOf(world).all(),
      mine = r.realm ? all.filter((w) => w.attacker === r.realm || w.defender === r.realm) : all,
      on = mine.filter((w) => w.declared <= year && (w.ended ?? now) >= year).length;
    if (on)
      lines.push({
        line: [
          r.realm
            ? `It was at war: ${said(on)} ${on === 1 ? "war" : "wars"} went on through the year.`
            : year >= now
              ? `${sentence(said(on))} ${on === 1 ? "war is" : "wars are"} being fought.`
              : `${sentence(said(on))} ${on === 1 ? "war was" : "wars were"} being fought as the year closed.`,
        ],
        ref: r.realm ? `${r.realm}#wars` : "world:ledger#wars",
      });
    else {
      let last = -1;
      for (const w of mine) if (w.ended !== null && w.ended < year) last = Math.max(last, w.ended);
      const since = last < 0 ? null : year - last;
      if (since !== null && since >= 1) {
        lines.push({
          line: [
            r.realm
              ? `It fought no war on its own world, the ${ordinal(since)} year since its last ended.`
              : `No war was fought on the world, the ${ordinal(since)} year of it.`,
          ],
          ref: r.realm ? `${r.realm}#wars` : "world:ledger#wars",
        });
        if (since >= 3)
          // (Of a realm, no war on its own world: its fleets may be years out among the stars.)
          headline = `${r.realm ? `Its ${ordinal(since)} year with no war at home` : `The world's ${ordinal(since)} year without a war`}${headline ? `: ${headline.replace(/^A (quiet|still) year: /, "")}` : ""}`;
      }
    }
  }
  return { headline, lines, land };
}

/**
 * What quietly held of an alliance: how many stood together and how many they were, where it stood among the alliances, and
 * how long its realms have kept from war. A year it did not stand says so, and whom its head realm stood with.
 */
function blocQuiet(
  world: World,
  b: BlocYears,
  year: number,
): { headline: string; lines: ToldItem[]; land: number | null } {
  const now = yearNow(world),
    h = b.headAt(year),
    lines: ToldItem[] = [],
    home = politiesOf(world).get(b.head as Ref);
  if (!h) {
    const gone = home && home.ended !== null && home.ended <= year,
      before = home && home.founded > year;
    lines.push({
      line: [
        gone
          ? `${sentence(home.town)} had fallen by then: its alliance stood no longer.`
          : before
            ? `${sentence(home.town)} had not yet risen.`
            : `${sentence(home?.town ?? "Its head realm")} stood in no alliance in the year: none stronger was bound to it, nor it to one.`,
      ],
      ref: home?.ref ?? null,
    });
    return {
      headline: gone
        ? `${sentence(home.town)} had fallen by ${count(year)}`
        : `${sentence(home?.town ?? "It")} stood alone in ${count(year)}`,
      lines,
      land: home?.seat ?? null,
    };
  }
  const n = b.numbers(year),
    since = b.standingSince(year),
    k = year - since + 1,
    // (Its years kept begin after it stood: how long before, no one can say.)
    unknown = since <= b.first && b.first > (home?.founded ?? 0),
    cur = b.members(year);
  lines.push({
    line: [
      `${sentence(said(cur.length))} realms stood together under `,
      link(politiesOf(world).get(h as Ref)?.town ?? "its head", `told:${year}:${h}`),
      n
        ? `: ${short(n.people)} people, ${short(n.host)} under arms${year >= now ? "" : " as the year closed"}.`
        : ".",
    ],
    ref: `bloc:${b.head}`,
  });
  const place = standingLine(world, b, year);
  if (place.length) lines.push({ line: place, ref: "world:alliances" });
  if (world.hasStore("war.wars")) {
    const inIt = new Set(cur),
      all = [...inIt].flatMap((m) =>
        warsOf(world)
          .of(m as Ref)
          .filter((w) => !inIt.has(w.attacker === m ? w.defender : w.attacker)),
      ),
      on = new Set(
        all.filter((w) => w.declared <= year && (w.ended ?? now) >= year).map((w) => w.ref),
      );
    if (on.size)
      lines.push({
        line: [
          `Its realms were at war: ${said(on.size)} ${on.size === 1 ? "war" : "wars"} against those outside it went on through the year.`,
        ],
        ref: `bloc:${b.head}#wars`,
      });
    else {
      let last = -1;
      for (const w of all) if (w.ended !== null && w.ended < year) last = Math.max(last, w.ended);
      if (last >= 0)
        lines.push({
          line: [
            `Its realms fought no war against those outside it, the ${ordinal(year - last)} year since the last ended.`,
          ],
          ref: `bloc:${b.head}#wars`,
        });
    }
  }
  return {
    headline: `${unknown ? `Together since ${count(b.first)} at least` : `Its ${ordinal(k)} year together`}: ${said(cur.length)} realms${n ? `, ${short(n.people)} people` : ""}`,
    lines,
    land: politiesOf(world).get(h as Ref)?.seat ?? null,
  };
}

// ————— The sections —————

/**
 * A section's lines: its two greatest, the greatest of the kinds the year before did not show, and one of the rest in its
 * turn. By worth alone a war's four lines were its peace, its beginning, its worst battle and its lands taken, year after
 * year, and a raid, a reckoning or prisoners settled were counted and never told.
 */
function preferred<T extends { t: Told }>(
  all: readonly T[],
  before: ReadonlySet<string>,
  turn: number,
): T[] {
  if (all.length <= SECTION_LINES) return [...all];
  const out = all.slice(0, 2),
    fresh = all.find((x) => !out.includes(x) && !before.has(x.t.key)) ?? all[2]!;
  out.push(fresh);
  // (And the last line goes round those left, a year each: the least of a section's kinds is told in its turn.)
  const left = all.filter((x) => !out.includes(x));
  out.push(left[turn % left.length]!);
  return all.filter((x) => out.includes(x));
}

/** What was counted of a side of life, said: its four first kinds that there were any of. */
export function sectionSentence(id: string, counts: ReadonlyMap<string, number>): string {
  const table = COUNTED[id as SectionId] ?? [],
    parts: string[] = [],
    seen = new Set<string>();
  for (const [type, one, more] of table) {
    const n = counts.get(type) ?? 0;
    // (Two kinds told in the same words are one count.)
    if (!n || seen.has(one)) continue;
    const sum =
      n +
      table
        .filter((c) => c[1] === one && c[0] !== type)
        .reduce((k, c) => k + (counts.get(c[0]) ?? 0), 0);
    seen.add(one);
    parts.push(`${said(sum)} ${sum === 1 ? one : more}`);
    if (parts.length >= 4) break;
  }
  return clauses(parts);
}

/** The side of life and the picture a kind of event is told by (for a check that every kind has both). */
export function toldPlace(type: string): { section: string; ruled: boolean; motif: string } {
  return {
    section: TYPE_SECTION[type] ?? DOMAIN_SECTION[type.slice(0, type.indexOf("."))] ?? "power",
    ruled: !!(TYPE_SECTION[type] ?? DOMAIN_SECTION[type.slice(0, type.indexOf("."))]),
    motif: TYPE_MOTIF.find(([re]) => re.test(type))?.[1] ?? "found",
  };
}

function sectionsOf(
  world: World,
  r: Reader,
  from: number,
  to: number,
  skip: ReadonlySet<Told>,
): ToldSection[] {
  const lines = new Map<SectionId, { t: Told; year: number }[]>(),
    counts = new Map<string, number>(),
    run = to > from;
  let fallen = 0;
  // (Of an alliance, its own doings are its own side of life.)
  const side = (t: Told, y: number): SectionId =>
    r.bloc && isOwn(r, t, y) ? "bloc" : sectionOf(world.events.get(t.ref as Ref), t);
  for (let y = from; y <= to; y++) {
    for (const t of r.told(y)) {
      if (t.worth < KIND_WORTH) continue;
      const id = side(t, y),
        list = lines.get(id);
      if (list) list.push({ t, year: y });
      else lines.set(id, [{ t, year: y }]);
    }
    for (const [type, n] of r.counts(y).n) counts.set(type, (counts.get(type) ?? 0) + n);
    fallen += r.counts(y).fallen;
  }
  // What the year before showed of each side of life, by worth alone: this year's later lines prefer other kinds.
  const before = new Map<SectionId, Set<string>>();
  if (!run) {
    const was = new Map<SectionId, Told[]>();
    for (const t of r.told(from - 1)) {
      if (t.worth < KIND_WORTH) continue;
      const id = side(t, from - 1);
      was.set(id, [...(was.get(id) ?? []), t]);
    }
    for (const [id, list] of was)
      before.set(
        id,
        new Set(
          list
            .sort((a, b) => b.worth - a.worth)
            .slice(0, SECTION_LINES)
            .map((t) => t.key),
        ),
      );
  }
  const out: ToldSection[] = [];
  for (const s of SECTIONS) {
    const all = (lines.get(s.id) ?? []).sort((a, b) => b.t.worth - a.t.worth || a.year - b.year),
      kinds = new Set<string>(),
      // (Of a run of years, one line a kind: ten years' floods are one flood's line, and how many were counted.)
      rest = all.filter((x) => {
        if (skip.has(x.t)) return false;
        if (!run) return true;
        if (kinds.has(x.t.key)) return false;
        kinds.add(x.t.key);
        return true;
      }),
      shown = preferred(rest, before.get(s.id) ?? new Set(), from);
    if (s.id === "bloc" && !r.bloc) continue;
    let text = sectionSentence(s.id, counts);
    if (s.id === "war" && fallen > 0)
      text += ` ${count(fallen)} fell in the battles history still keeps.`;
    // (An alliance's own: who stood in it, who came and went, its calls, its place among the alliances.)
    const said: Line =
      s.id === "bloc" && r.bloc
        ? blocText(world, r.bloc, from, to, (y) => eventsOf(world, y))
        : text
          ? [text]
          : [];
    if (!all.length && !said.length) continue;
    out.push({
      id: s.id,
      icon: s.icon,
      name: s.name,
      text: said,
      items: shown.map(({ t, year }) => {
        const line = toldWords(world, t, year);
        return { line: run ? [`${year}: `, ...line] : line, ref: t.ref, year };
      }),
      more: Math.max(0, all.length - shown.length - all.filter((x) => skip.has(x.t)).length),
    });
  }
  return out;
}

// ————— The map —————

const BASES = new WeakMap<World, ToldMapBase>();

/** A world's lands as a flat map draws them: asked once a world. */
export function toldBase(world: World): ToldMapBase | null {
  if (!world.hasStore("planet.home")) return null;
  const hit = BASES.get(world);
  if (hit) return hit;
  const g = homePlanet(world).generated,
    n = g.offworld.base,
    lon: number[] = [],
    lat: number[] = [],
    biome: number[] = [];
  for (let c = 0; c < n; c++) {
    lon.push(Math.round(g.grid.lon[c]! * 1000));
    lat.push(Math.round(g.grid.lat[c]! * 1000));
    biome.push(g.climate.biome[c]!);
  }
  const base: ToldMapBase = {
    key: baseKey(world),
    lon,
    lat,
    biome,
    step: Math.sqrt((4 * Math.PI) / Math.max(1, n)),
  };
  BASES.set(world, base);
  return base;
}

const baseKey = (world: World): string => {
  const g = homePlanet(world).generated;
  return `${g.offworld.base}:${hashString(`${g.grid.lon[1]}|${g.climate.biome.slice(0, 64).join("")}|${g.star.temperature}`) >>> 0}`;
};

const MARK_TYPES: Readonly<Record<string, ToldMark["kind"]>> = {
  "war.battle": "battle",
  "war.siege": "battle",
  "war.strike": "strike",
  "health.outbreak": "sickness",
  "act.plague": "sickness",
  "people.famine": "famine",
  "act.quake": "quake",
  "planet.eruption": "quake",
  "act.fire": "fire",
  "wild.fire": "fire",
  "act.meteor": "fire",
  "act.flood": "flood",
  "city.founded": "town",
  "settlement.founded": "town",
};
const MARK_WORDS: Readonly<Record<ToldMark["kind"], string>> = {
  battle: "a battle",
  strike: "struck from the air",
  sickness: "a sickness",
  famine: "hunger",
  quake: "the ground shook or burst",
  fire: "fire",
  flood: "a flood",
  town: "a new town or city",
};

function mapOf(world: World, r: Reader, from: number, to: number): ToldMap | null {
  const store = yearsOf(world);
  if (!world.hasStore("planet.home") || !store) return null;
  if (r.bloc) return blocMap(world, r, r.bloc, from, to);
  const g = homePlanet(world).generated,
    base = g.offworld.base,
    now = yearNow(world),
    polities = politiesOf(world),
    at = (cell: number, y: number): string => {
      if (y >= now) return polities.of(cell)?.ref ?? "";
      const log = store.landRealm.get(cell);
      return log && y >= log.first ? (logAt(log, y) ?? "") : "";
    },
    realms: { ref: string; name: string; color: readonly [number, number, number] }[] = [],
    index = new Map<string, number>(),
    lands: number[] = [],
    owner: number[] = [],
    gained: number[] = [],
    lost: number[] = [],
    cells = new Set<number>(store.landRealm.keys());
  if (to >= now) for (const p of populationContext(world).provinces.all()) cells.add(p.cell);
  for (const cell of cells) {
    if (cell >= base || offworldSite(g, cell)) continue;
    const is = at(cell, to),
      was = at(cell, from - 1);
    if (is) {
      let i = index.get(is);
      if (i === undefined) {
        index.set(is, (i = realms.length));
        realms.push({ ref: is, name: nameOf(world, is), color: realmColor(is) });
      }
      lands.push(cell);
      owner.push(i);
      if (was !== is && (was || from - 1 >= (store.landRealm.get(cell)?.first ?? 0)))
        gained.push(cell);
    } else if (was) lost.push(cell);
  }
  // Where the year's great things fell: the greatest of each kind.
  const found = new Map<ToldMark["kind"], { cell: number; worth: number }[]>();
  for (let y = from; y <= to; y++)
    for (const e of r.events(y)) {
      const kind = MARK_TYPES[e.type],
        cell = cellOf(e.place);
      if (!kind || cell < 0 || cell >= base) continue;
      const list = found.get(kind);
      if (list) list.push({ cell, worth: e.importance });
      else found.set(kind, [{ cell, worth: e.importance }]);
    }
  const marks: ToldMark[] = [],
    legend: { kind: string; words: string }[] = [];
  for (const [kind, list] of found) {
    const seen = new Set<number>();
    for (const m of list.sort((a, b) => b.worth - a.worth)) {
      if (seen.has(m.cell) || seen.size >= MARKS) continue;
      seen.add(m.cell);
      marks.push({ kind, cell: m.cell });
    }
    legend.push({ kind, words: MARK_WORDS[kind] });
  }
  if (gained.length) legend.unshift({ kind: "gained", words: "came under a new realm" });
  if (lost.length) legend.push({ kind: "lost", words: "fell to no realm" });
  const focus = r.realm ? [...landsIn(world, r.realm, to)].filter((c) => c < base) : null,
    rough = from - 1 < now - EVERY_YEARS;
  return {
    base: baseKey(world),
    realms,
    lands,
    owner,
    gained,
    lost,
    marks,
    ...(focus ? { focus } : {}),
    legend,
    ...(rough
      ? {
          note: "This far back the borders are remembered by the half-century, not the year: who held what is as near as is kept.",
        }
      : {}),
  };
}

/** A colour between two. */
const between = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
type Rgb = readonly [number, number, number];
/** Those its realms fought, on its map. */
const FOE: Rgb = [0.7, 0.2, 0.17];

/**
 * An alliance's map: its realms' lands, each realm in its alliance's colour, the deeper the longer it has stood in it (those
 * come in lately pale); the lands of those its realms fought, red; what its realms took or lost, hatched or dashed; and where
 * its great things fell.
 */
function blocMap(world: World, r: Reader, b: BlocYears, from: number, to: number): ToldMap | null {
  const g = homePlanet(world).generated,
    base = g.offworld.base,
    cur = b.members(to);
  if (!cur.length) return null;
  const start = b.standingSince(to),
    color = blocSubject(world, `${BLOC}${b.head}`)?.color ?? realmColor(b.head),
    pale = between(color, [1, 1, 1], 0.62),
    tone = (since: number) => between(color, pale, to > start ? (since - start) / (to - start) : 0),
    realms: { ref: string; name: string; color: Rgb }[] = [],
    lands: number[] = [],
    owner: number[] = [],
    focus: number[] = [],
    mine = new Map<number, string>();
  const index = new Map<string, number>();
  for (const m of cur) {
    const since = b.sinceOf(m, to);
    index.set(m, realms.length);
    realms.push({
      ref: m,
      name: `${nameOf(world, m)}, in it since ${count(since)}`,
      color: tone(since),
    });
  }
  for (const [c, m] of landsOfAll(world, new Set(cur), to)) {
    if (c >= base || offworldSite(g, c)) continue;
    lands.push(c);
    owner.push(index.get(m)!);
    focus.push(c);
    mine.set(c, m);
  }
  // Those its realms fought in these years.
  const inIt = new Set(cur),
    foes = new Set<string>();
  if (world.hasStore("war.wars"))
    for (const m of cur)
      for (const w of warsOf(world).of(m as Ref)) {
        const foe = w.attacker === m ? w.defender : w.attacker;
        if (!inIt.has(foe) && w.declared <= to && (w.ended ?? b.now) >= from) foes.add(foe);
      }
  if (foes.size) {
    realms.push({ ref: "", name: "its foes", color: FOE });
    for (const c of landsOfAll(world, foes, to).keys()) {
      if (c >= base || offworldSite(g, c) || mine.has(c)) continue;
      lands.push(c);
      owner.push(realms.length - 1);
    }
  }
  // What its realms took and lost in these years (not what came and went with a realm).
  const store = yearsOf(world)!,
    was = new Map<number, string>(),
    before = new Set(b.members(from - 1));
  for (const [c, m] of landsOfAll(world, before, from - 1)) was.set(c, m);
  const gained: number[] = [],
    lost: number[] = [];
  for (const [c, m] of mine) {
    if (was.get(c) === m) continue;
    const log = store.landRealm.get(c),
      then = log && from - 1 >= log.first ? logAt(log, from - 1) : undefined;
    // (Another realm's then, and none of it: taken. A realm come in with its lands is no taking.)
    if (then && then !== m && !inIt.has(then)) gained.push(c);
  }
  for (const [c, m] of was) {
    if (mine.has(c) || c >= base) continue;
    const holder = to >= b.now ? politiesOf(world).of(c)?.ref : logAt(store.landRealm.get(c), to);
    // (Held now by one outside it, while the realm that held it stands in it still.)
    if (inIt.has(m) && holder !== m) lost.push(c);
  }
  // Where its great things fell.
  const found = new Map<ToldMark["kind"], { cell: number; worth: number }[]>();
  for (let y = from; y <= to; y++)
    for (const e of r.events(y)) {
      const kind = MARK_TYPES[e.type],
        cell = cellOf(e.place);
      if (!kind || cell < 0 || cell >= base) continue;
      const list = found.get(kind);
      if (list) list.push({ cell, worth: e.importance });
      else found.set(kind, [{ cell, worth: e.importance }]);
    }
  const marks: ToldMark[] = [],
    legend: { kind: string; words: string }[] = [];
  for (const [kind, list] of found) {
    const seen = new Set<number>();
    for (const m of list.sort((a, c) => c.worth - a.worth)) {
      if (seen.has(m.cell) || seen.size >= MARKS) continue;
      seen.add(m.cell);
      marks.push({ kind, cell: m.cell });
    }
    legend.push({ kind, words: MARK_WORDS[kind] });
  }
  if (gained.length) legend.unshift({ kind: "gained", words: "taken by its realms" });
  if (lost.length) legend.push({ kind: "lost", words: "lost by its realms" });
  const mid = Math.round((start + to) / 2),
    key: { color: Rgb; words: string }[] = [
      { color: tone(start), words: `in it since ${count(start)}` },
      ...(to - start >= 20 ? [{ color: tone(mid), words: `came in about ${count(mid)}` }] : []),
      ...(to > start ? [{ color: tone(to), words: "came in lately" }] : []),
      ...(foes.size ? [{ color: FOE, words: "those its realms fought" }] : []),
    ];
  return {
    base: baseKey(world),
    realms,
    lands,
    owner,
    gained,
    lost,
    marks,
    focus,
    legend,
    key,
    ...(b.rough(to) || from - 1 < b.now - EVERY_YEARS
      ? {
          note: "This far back who stood with whom, and the borders, are remembered by the half-century: as near as is kept.",
        }
      : {}),
  };
}

// ————— The telling —————

const READERS = new WeakMap<
  World,
  { stamp: string; at: number; read: number; by: Map<string, Reader> }
>();
const TOLD = new WeakMap<World, { stamp: string; at: number; by: Map<string, YearTold> }>();

const stampOf = (world: World) => {
  const n = world.events.count;
  return `${n}:${n ? world.events.at(n - 1).id : ""}`;
};

/** A year's stretch read ahead of a long run's telling, one asking a stretch: the next year not yet read (null: all read). */
export function toldWarm(world: World, year: number, to: number): number | null {
  const now = yearNow(world),
    last = Math.min(now, to + ABOUT);
  let y = Math.max(0, Math.min(now, year) - ABOUT);
  const t0 = performance.now();
  for (; y <= last; y = (Math.floor(y / STRETCH_YEARS) + 1) * STRETCH_YEARS) {
    const fresh = !stretchRead(world, y);
    toldOf(world, y);
    // (One stretch not yet read an asking, or as many as come in a few milliseconds.)
    if (fresh && performance.now() - t0 > 25) {
      const next = (Math.floor(y / STRETCH_YEARS) + 1) * STRETCH_YEARS;
      return next <= last ? next : null;
    }
  }
  return null;
}

/** What led to a happening and what came of it, read when a reader opens either. */
export function toldWays(
  world: World,
  ask: { ref: string; year: number; realm?: string | null },
): { before: ToldItem[]; after: ToldItem[] } {
  if (!world.events.get(ask.ref as Ref)) return { before: [], after: [] };
  const realm = subjectOf(world, ask.realm);
  return {
    before: ledTo(world, ask.ref, ask.year),
    after: cameOf(world, readerOf(world, realm), ask.ref, ask.year),
  };
}

/** How many tellings a world keeps now (for a test of its bound). */
export function toldKept(world: World): number {
  return TOLD.get(world)?.by.size ?? 0;
}

/** Let go of everything kept for the tellings (a measure of what they hold; the log's moving on does the same). */
export function toldForget(world: World): void {
  TOLD.delete(world);
  SAME.delete(world);
  READERS.delete(world);
  PEOPLE.delete(world);
  WARS.delete(world);
  GONE.delete(world);
  stretchesForget(world);
}

/** The first year anything is told of. */
function firstYear(world: World): number {
  return world.events.count ? yearOfMoment(world.events.at(0).t) : 0;
}

/** What is said where less is remembered of a year than of one lately lived. */
function lessOf(world: World, year: number, realm: string | null): Line | null {
  const now = yearNow(world),
    memory = Math.round(world.retention.window / YEAR),
    ago = now - year,
    parts: string[] = [];
  if (ago > memory)
    parts.push(
      `${count(ago)} years gone, past living memory (${count(memory)} years): less is remembered of it. History keeps what mattered and has let its lesser things go`,
    );
  if (ago > EVERY_YEARS)
    parts.push(
      `${realm ? "its" : "the world's"} people are counted by the decade this far back, and borders by the half-century`,
    );
  if (!parts.length) return null;
  return [`${sentence(parts.join("; "))}.`];
}

/** How many lesser happenings of a year's decade history has let go: counted still, no longer told. */
const GONE = new WeakMap<World, { stamp: string; by: Map<number, number> }>();
export function toldGone(world: World, year: number): number {
  const stamp = stampOf(world);
  let hit = GONE.get(world);
  if (!hit || hit.stamp !== stamp) {
    const by = new Map<number, number>();
    for (const s of world.events.summaries()) {
      let n = 0;
      for (const k in s.counts) n += s.counts[k]!;
      by.set(s.decade, (by.get(s.decade) ?? 0) + n);
    }
    GONE.set(world, (hit = { stamp, by }));
  }
  return hit.by.get(Math.floor(year / 10)) ?? 0;
}

function leadOf(
  world: World,
  r: Reader,
  cand: Cand | null,
  year: number,
  more: readonly Cand[],
  run: boolean,
): ToldLead | null {
  if (!cand) return null;
  const { t } = cand,
    words = (c: Cand, y: number): ToldItem => {
      const line = toldWords(world, c.t, y);
      return { line: run ? [`${y}: `, ...line] : line, ref: c.t.ref, year: y };
    },
    lines = [words(cand, year)];
  if (cand.alone && t.worth >= ALL_WORTH && !run)
    lines.push({
      line: [`Nothing like it is told in the ${said(ABOUT)} years either side.`],
      ref: null,
    });
  // (A count that stands out is of many happenings: the greatest of them is told after it.)
  const most = t.key.startsWith("most:") ? world.events.get(t.ref as Ref) : undefined;
  if (most) lines.push(eventItem(world, most, year));
  lines.push(...more.map((c) => words(c, year)));
  const isEvent = !!world.events.get(t.ref as Ref);
  return {
    headline: headlineOf(world, t, year),
    lines,
    vignette: vignetteOf(world, t, null),
    // (What led to it and what came of it are read when a reader asks: each may be a far year's.)
    before: [],
    after: [],
    ...(isEvent ? { ways: { ref: t.ref, year } } : {}),
  };
}

/** A year told, or a run of years, of the world or of one realm. */
export function yearTold(
  world: World,
  ask: {
    year: number;
    to?: number;
    realm?: string | null;
    /** Its lead alone, the rest to be asked after (a long run of years, drawn as it comes). */
    lead?: boolean;
  },
) {
  const t0 = performance.now(),
    now = yearNow(world),
    first = firstYear(world),
    year = Math.max(0, Math.min(now, Math.round(ask.year))),
    to = Math.max(year, Math.min(now, Math.round(ask.to ?? year), year + TOLD_SPAN - 1)),
    realm = subjectOf(world, ask.realm),
    key = `${year}..${to}|${realm ?? ""}${ask.lead ? "|lead" : ""}`,
    stamp = stampOf(world);
  let kept = TOLD.get(world);
  if (!kept || kept.stamp !== stamp || kept.at !== now)
    TOLD.set(world, (kept = { stamp, at: now, by: new Map() }));
  const was = kept.by.get(key);
  if (was) {
    kept.by.delete(key);
    kept.by.set(key, was);
    return was;
  }
  // (The reading of its years is kept from a run's lead to the rest of it: the same years, weighed once.)
  let readers = READERS.get(world);
  if (!readers || readers.stamp !== stamp || readers.at !== now)
    READERS.set(world, (readers = { stamp, at: now, read: 0, by: new Map() }));
  let r = readers.by.get(realm ?? "");
  if (!r || readers.read > 400) {
    readers.by.clear();
    readers.read = 0;
    readers.by.set(realm ?? "", (r = readerOf(world, realm)));
  }
  readers.read += to - year + 1;
  const // (A world no one lives on, and never has: its years are its own.)
    alone = populationContext(world).provinces.total() === 0 && !politiesOf(world).all().length,
    run = to > year,
    leads: ToldLead[] = [],
    years: { year: number; headline: string; worth: number }[] = [],
    used = new Set<Told>();
  let moreYears = 0;
  if (!run) {
    const cands = leading(r, year),
      top = cands[0] ?? null,
      // (Beside it, what else would lead a year of its own: of another kind, the greatest first.)
      beside: Cand[] = [];
    const quiet = alone ? { headline: "", lines: [], land: null } : quietLines(world, r, year),
      loud = !!top && top.t.worth >= LEAD_WORTH;
    if (loud)
      for (const c of cands.slice(1)) {
        if (beside.length >= LEAD_LINES - 1) break;
        if (c.t.worth < LEAD_WORTH || c.score < BESIDE_SCORE || c.t.key === top.t.key) continue;
        if (beside.some((b) => b.t.key === c.t.key)) continue;
        beside.push(c);
      }
    const lead = leadOf(world, r, top, year, beside, false);
    if (lead) {
      used.add(top!.t);
      for (const b of beside) used.add(b.t);
      // (A lead of one line is no telling: what quietly changed is said after it. A quiet year says all of it.)
      const said = lead.lines.filter((l) => l.ref !== null).length,
        room = loud ? Math.max(0, LEAD_LINES - said) : quiet.lines.length,
        lines = [...lead.lines, ...quiet.lines.slice(0, said >= 2 && loud ? 0 : room)];
      // (Still one line, in a year whose people were not counted: the next greatest of what it holds, of another kind.)
      for (const c of cands.slice(1)) {
        if (lines.filter((l) => l.ref !== null).length >= 2) break;
        if (used.has(c.t) || [...used].some((u) => u.key === c.t.key)) continue;
        used.add(c.t);
        lines.push({ line: toldWords(world, c.t, year), ref: c.t.ref, year });
      }
      leads.push({
        ...lead,
        lines,
        vignette: lead.vignette?.scene ? lead.vignette : vignetteOf(world, top!.t, quiet.land),
      });
    } else if (quiet.lines.length)
      leads.push({
        headline: quiet.headline || `Year ${count(year)}: nothing is kept of it by itself`,
        lines: quiet.lines,
        vignette: vignetteOf(world, null, quiet.land),
        before: [],
        after: [],
      });
    else
      leads.push({
        headline: r.bloc
          ? `Nothing is kept of its year ${count(year)}`
          : realm
            ? "Nothing is kept of its year"
            : alone
              ? `Year ${count(year)} of a world alone`
              : first > year
                ? "Before anyone could tell of it"
                : "Nothing is kept of this year by itself",
        lines: [
          {
            line: [
              r.bloc
                ? "History keeps nothing that this alliance or its realms did or suffered in the year."
                : realm
                  ? "History keeps nothing that this realm did or suffered in the year."
                  : alone
                    ? "No one lives on this world, and nothing that befell it in the year is kept: with no one to tell it, a year here is its star's light, its seas and its weather."
                    : "History keeps no happening of this year, and its people were not counted in it.",
            ],
            ref: null,
          },
        ],
        vignette: vignetteOf(world, null, null),
        before: [],
        after: [],
      });
  } else {
    // A run of years: its years' leads ranked, the greatest told first, each year a way in. Of an alliance, its arc first.
    if (r.bloc) {
      const arc = blocArc(world, r, r.bloc, year, to);
      leads.push(arc.lead);
      for (const t of arc.used) used.add(t);
    }
    const tops: { c: Cand; year: number }[] = [];
    for (let y = year; y <= to; y++) {
      const c = leading(r, y)[0];
      if (!c) continue;
      tops.push({ c, year: y });
    }
    tops.sort((a, b) => b.c.score - a.c.score || a.year - b.year);
    // (The greatest of its years by their headlines; the rest are counted, and stepped to.)
    for (const { c, year: y } of tops.slice(0, YEARS_SHOWN))
      years.push({ year: y, headline: headlineOf(world, c.t, y), worth: c.score });
    moreYears = Math.max(0, tops.length - YEARS_SHOWN);
    const seen = new Set<string>();
    for (const { c, year: y } of tops) {
      if (leads.length >= LEAD_LINES) break;
      // (Two of one kind would read as one: the greatest, and on to something else. A first is each its own.)
      if ((seen.has(c.t.key) && c.t.key !== "first") || used.has(c.t)) continue;
      seen.add(c.t.key);
      const lead = leadOf(world, r, c, y, [], true);
      if (lead) leads.push({ ...lead, headline: `${y}: ${lead.headline}` });
      used.add(c.t);
    }
    if (!leads.length)
      leads.push({
        headline: "Nothing is kept of these years",
        lines: [{ line: ["History keeps no happening of these years worth a line."], ref: null }],
        vignette: vignetteOf(world, null, null),
        before: [],
        after: [],
      });
  }
  const subject = r.bloc
      ? blocSubject(world, realm!)
      : realm
        ? { ref: realm, name: nameOf(world, realm), color: realmColor(realm) }
        : null,
    // (A realm's year beside its alliance's, and an alliance's beside its head realm's.)
    allied = realm && !r.bloc ? realmBlocAt(world, realm, to) : "",
    leader = r.bloc ? r.bloc.headAt(to) || r.bloc.head : "",
    also = allied
      ? [{ words: "🪢 Its alliance's", ref: toldRef(year, to, `${BLOC}${allied}`) }]
      : leader && politiesOf(world).get(leader as Ref)
        ? [
            {
              words: `👑 ${politiesOf(world).get(leader as Ref)!.town}'s`,
              ref: toldRef(year, to, leader),
            },
          ]
        : [],
    told: YearTold = {
      year,
      to,
      now,
      first,
      subject,
      ...(also.length ? { also } : {}),
      kicker: run
        ? `Years ${count(year)} to ${count(to)}`
        : year === now
          ? `Year ${count(year)}, so far`
          : `Year ${count(year)}`,
      leads,
      years,
      moreYears,
      sections: ask.lead ? [] : sectionsOf(world, r, year, to, used),
      figures: alone || ask.lead ? [] : figuresOf(world, r, to, year),
      map: ask.lead ? null : mapOf(world, r, year, to),
      partial: !!ask.lead,
      less: lessOf(world, year, realm),
      art: world.hasStore("planet.home") ? worldArt(world) : null,
      ms: 0,
    },
    done = { ...told, ms: Math.round((performance.now() - t0) * 10) / 10 };
  kept.by.set(key, done);
  while (kept.by.size > TOLD_KEPT) kept.by.delete(kept.by.keys().next().value!);
  return done;
}

/** Whose a telling is, as asked: a realm the world knows, or an alliance whose years are kept (null: the world's). */
function subjectOf(world: World, ask: string | null | undefined): string | null {
  if (!ask) return null;
  if (isBloc(ask))
    return blocSubject(world, ask) && blocYears(world, ask.slice(BLOC.length)) ? ask : null;
  return politiesOf(world).get(ask as Ref) ? ask : null;
}

/**
 * An alliance's run of years read as its arc: whether it formed in them, how far it grew and when it stood greatest, who came
 * and went, and whether it came apart. Each piece a way to the year it happened in.
 */
function blocArc(
  world: World,
  r: Reader,
  b: BlocYears,
  from: number,
  to: number,
): { lead: ToldLead; used: Told[] } {
  const last = Math.min(to, b.now);
  b.prepare(from - 1, last);
  const stood: number[] = [];
  for (let y = from; y <= last; y++) if (b.headAt(y)) stood.push(y);
  const home = politiesOf(world).get(b.head as Ref),
    who = home?.town ?? "Its head realm",
    span = `from ${count(from)} to ${count(last)}`;
  if (!stood.length)
    return {
      lead: {
        headline: `${sentence(who)} stood in no alliance ${span}`,
        lines: [
          {
            line: [`In none of these years were two or more realms bound together with ${who}.`],
            ref: home?.ref ?? null,
          },
        ],
        vignette: vignetteOf(world, null, home?.seat ?? null),
        before: [],
        after: [],
      },
      used: [],
    };
  // Its stands in these years: each from the year it came to stand (or the run's first) to the last it stood.
  const own = (y: number, keys: readonly string[]) =>
      r.told(y).find((t) => keys.includes(t.key)) ?? null,
    stands: { from: number; to: number; formed: Told | null; ended: Told | null }[] = [];
  for (const y of stood) {
    const s = stands.at(-1);
    if (s && s.to === y - 1) s.to = y;
    else
      stands.push({
        from: y,
        to: y,
        formed:
          y - 1 >= b.first && !b.headAt(y - 1) ? own(y, ["bloc.formed", "bloc.joined"]) : null,
        ended: null,
      });
  }
  for (const s of stands) if (s.to < last) s.ended = own(s.to + 1, ["bloc.ended", "bloc.left"]);
  const first = stood[0]!,
    end = stood.at(-1)!,
    one = stands[0]!,
    apart = stands.filter((s) => s.to < last).length;
  let peak = 0,
    peakYear = first,
    most = 0,
    mostYear = first,
    joined = 0,
    left = 0,
    heads = 0,
    split: { y: number; n: number } | null = null;
  for (const y of stood) {
    const n = b.members(y).length,
      p = b.numbers(y)?.people ?? 0;
    if (n > peak) {
      peak = n;
      peakYear = y;
    }
    if (p > most) {
      most = p;
      mostYear = y;
    }
    if (y - 1 >= b.first && b.headAt(y - 1)) {
      const prev = b.members(y - 1),
        cur = b.members(y),
        out = prev.filter((x) => !cur.includes(x)).length;
      joined += cur.filter((x) => !prev.includes(x)).length;
      left += out;
      if (b.headAt(y - 1) !== b.headAt(y)) heads++;
      if (out >= 2 && (!split || out > split.n)) split = { y, n: out };
    }
  }
  const n0 = b.members(first).length,
    n1 = b.members(end).length,
    standsNow = end === last,
    parts = [
      one.formed?.key === "bloc.formed"
        ? `Formed in ${count(one.from)}`
        : one.formed
          ? `Came into an alliance in ${count(one.from)}`
          : `${sentence(said(n0))} realms in ${count(first)}`,
      peak > Math.max(n0, n1) ? `${said(peak)} at its height in ${count(peakYear)}` : "",
      apart === 0
        ? n1 > n0
          ? `grew to ${said(n1)} by ${count(end)}`
          : n1 < n0
            ? `down to ${said(n1)} by ${count(end)}`
            : `${said(n1)} still in ${count(end)}`
        : apart === 1 && stands.length === 1
          ? `came apart in ${count(one.to + 1)}`
          : `came apart ${apart === 1 ? "once" : apart === 2 ? "twice" : `${said(apart)} times`}${standsNow ? `, together again from ${count(stands.at(-1)!.from)}` : `, the last in ${count(stands.filter((s) => s.to < last).at(-1)!.to + 1)}`}`,
    ].filter(Boolean),
    lines: ToldItem[] = [],
    used: Told[] = [],
    piece = (t: Told | null, y: number) => {
      if (!t) return;
      used.push(t);
      lines.push({ line: [`${y}: `, ...toldWords(world, t, y)], ref: t.ref, year: y });
    };
  // (Its first stand's beginning, then its greatest year; the ends and beginnings after, the last few.)
  piece(one.formed, one.from);
  const whole = b.numbers(mostYear),
    all = b.peopled(mostYear);
  if (whole)
    lines.push({
      line: [
        `At its greatest in ${count(mostYear)}: ${shortWords(whole.people)} people in ${said(whole.realms)} realms`,
        all ? `, ${Math.round((whole.people / all) * 100)}% of the world's` : "",
        `, ${shortWords(whole.host)} under arms.`,
      ],
      ref: toldRef(mostYear, mostYear, `${BLOC}${b.head}`),
      year: mostYear,
    });
  if (joined || left || heads)
    lines.push({
      line: [
        sentence(
          [
            joined ? `${said(joined)} ${joined === 1 ? "realm" : "realms"} came in` : "",
            left ? `${said(left)} left` : "",
            heads ? `its head changed ${heads === 1 ? "once" : `${said(heads)} times`}` : "",
          ]
            .filter(Boolean)
            .join(", "),
        ),
        ` ${span}.`,
      ],
      ref: `bloc:${b.head}#time`,
    });
  if (split && !stands.some((s) => s.to + 1 === split!.y))
    lines.push({
      line: [`${split.y}: ${said(split.n)} of its realms left it in one year.`],
      ref: toldRef(split.y, split.y, `${BLOC}${b.head}`),
      year: split.y,
    });
  // (Each end and new beginning after its first, the last three of them.)
  const turns: { t: Told; y: number }[] = [];
  stands.forEach((s, i) => {
    if (i && s.formed) turns.push({ t: s.formed, y: s.from });
    if (s.ended) turns.push({ t: s.ended, y: s.to + 1 });
  });
  for (const x of turns.slice(-3)) piece(x.t, x.y);
  return {
    lead: {
      headline: clip(parts.join(", "), 110),
      lines,
      vignette: vignetteOf(world, one.formed ?? stands.at(-1)!.ended, home?.seat ?? null),
      before: [],
      after: [],
    },
    used,
  };
}

/**
 * A realm's or an alliance's last years, each with its headline (the alliance page's Years told): read when its tab is
 * opened, one reading of the years for all of them. Its decades and centuries are the ways on.
 */
export function toldList(
  world: World,
  ask: { subject: string; most?: number },
): { years: { year: number; headline: string }[]; decades: number[]; now: number; first: number } {
  const now = yearNow(world),
    subject = subjectOf(world, ask.subject),
    r = readerOf(world, subject),
    most = Math.max(1, Math.min(40, ask.most ?? 20)),
    home = r.bloc ? null : subject ? politiesOf(world).get(subject as Ref) : null,
    first = r.bloc ? r.bloc.first : (home?.founded ?? firstYear(world)),
    years: { year: number; headline: string }[] = [];
  for (let y = home?.ended ?? now; y >= Math.max(0, first) && years.length < most; y--) {
    if (r.bloc && !r.bloc.headAt(y)) {
      // (A gap in its standing: the years it stood before are told after, the gap once.)
      if (years.length && !years.at(-1)!.headline.startsWith("—")) {
        let back = y;
        while (back > first && !r.bloc.headAt(back - 1)) back--;
        years.push({
          year: back,
          headline: `— it stood no longer from ${count(back)} to ${count(y)} —`,
        });
        y = back;
      }
      continue;
    }
    const top = leading(r, y)[0];
    years.push({
      year: y,
      headline: top
        ? headlineOf(world, top.t, y)
        : quietLines(world, r, y).headline || "Nothing is kept of it",
    });
  }
  const decades: number[] = [];
  for (
    let d = Math.floor((home?.ended ?? now) / 10) * 10;
    d >= Math.max(0, first - 9) && decades.length < 10;
    d -= 10
  )
    if (!r.bloc || [0, 3, 6, 9].some((k) => r.bloc!.headAt(Math.min(now, d + k)))) decades.push(d);
  return { years, decades, now, first };
}

/** The page a year told stands in: its tool reads it, and goes from year to year in place. */
export function toldPage(world: World, ref: string): PageModel {
  const ask = toldAsk(ref) ?? { year: yearNow(world), to: yearNow(world), realm: null },
    now = yearNow(world),
    realm = subjectOf(world, ask.realm),
    bloc = isBloc(realm) ? blocSubject(world, realm) : null,
    name = bloc ? bloc.name : realm ? nameOf(world, realm) : "";
  return {
    ref,
    kind: "year",
    icon: "🗓️",
    title: realm ? `${sentence(name)}: its year` : "The year told",
    subtitle: bloc
      ? ["What each year was to ", link(name, realm), ", and to the realms who stood in it then."]
      : realm
        ? ["What each year was to ", link(name, realm), "."]
        : [
            "From what history keeps. Line by line: ",
            link("The Years", "world:chronicle#years"),
            ".",
          ],
    color: bloc ? bloc.color : realm ? realmColor(realm) : null,
    place: null,
    stats: [],
    tabs: [
      {
        id: "told",
        name: "Told",
        blocks: [
          {
            type: "tool",
            tool: "told.year",
            args: {
              year: Math.max(0, Math.min(now, ask.year)),
              to: Math.max(0, Math.min(now, ask.to)),
              realm,
            },
          },
        ],
      },
    ],
    followable: false,
    year: now,
    // (It reads nothing as the world runs: its tool asks when a reader does.)
    every: 600_000,
  };
}
