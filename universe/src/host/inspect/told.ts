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
  toldOf,
  toldWords,
  withoutYear,
  type Told,
} from "./annals.ts";
import { sceneBanner, worldArt } from "./art.ts";
import { nameOf } from "./names.ts";
import { count, link, sentence, yearNow } from "./words.ts";
import { logAt, yearsOf, EVERY_YEARS } from "../years.ts";
import { realmThrough } from "./time.ts";
import { realmColor } from "../colors.ts";

/** How many years either side a year is weighed against. */
const ABOUT = 10;
/**
 * What is left of a line's worth where its like is told in every year about it: a realm's fall is worth 6 as the Years weigh
 * it, and in a late world one falls most years; the one plague of a generation, worth 5, leads over it.
 */
const COMMON = 0.55;
/** The most sentences a lead tells, and the most lines a section shows. */
const LEAD_LINES = 3,
  SECTION_LINES = 4;
/** A second or third thing leads beside the first only where it is worth this much. */
const LEAD_WORTH = ALL_WORTH;
/** And where its like is not told in most of the years about it (its worth, and what its rarity adds). */
const BESIDE_SCORE = 3.9;
/** The tellings kept (a year or a run, of the world or of a realm), until the log has moved on. */
const TOLD_KEPT = 48;
/** The longest run of years told as one. */
export const TOLD_SPAN = 100;
/** The most marks of a kind a map bears. */
const MARKS = 14;

const plain = (l: Line) => l.map((s) => (typeof s === "string" ? s : s.text)).join("");

// ————— What is asked —————

/** What a page's ref asks to be told: `told:1204`, `told:1200..1209`, either of a realm (`told:1204:pol:0:12`). */
export function toldAsk(ref: string): { year: number; to: number; realm: string | null } | null {
  const m = /^told:(-?\d+)(?:\.\.(-?\d+))?(?::(pol:.+))?$/.exec(ref);
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
  ],
  bodies: [
    ["bodies.founded", "institution was founded", "institutions were founded"],
    ["bodies.ended", "institution came to its end", "institutions came to their end"],
    ["bodies.strike", "strike was called", "strikes were called"],
    ["groups.rose", "group rose", "groups rose"],
    ["underworld.rose", "crime group rose", "crime groups rose"],
    ["underworld.war", "war broke out in the underworld", "wars broke out in the underworld"],
    ["underworld.ended", "crime group came to its end", "crime groups came to their end"],
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

/** What each year tells of the world or of a realm, read once for one telling. */
type Reader = {
  readonly realm: string | null;
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

function readerOf(world: World, realm: string | null): Reader {
  const told = new Map<number, readonly Told[]>(),
    events = new Map<number, readonly HistoryEvent[]>(),
    counts = new Map<number, Counts>(),
    keeps = new Map<number, (e: HistoryEvent) => boolean>(),
    now = yearNow(world),
    keep = (y: number) => {
      let k = keeps.get(y);
      if (!k) keeps.set(y, (k = keepOf(world, realm!, y)));
      return k;
    };
  return {
    realm,
    now,
    told(year) {
      if (year < 0 || year > now) return [];
      let t = told.get(year);
      if (!t) told.set(year, (t = realm ? toldOf(world, year, keep(year)) : toldOf(world, year)));
      return t;
    },
    events(year) {
      if (year < 0 || year > now) return [];
      let e = events.get(year);
      if (!e) {
        e = eventsOf(world, year);
        if (realm) e = e.filter(keep(year));
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
      const like = (others.get(t.key) ?? []).filter((w) => w >= t.worth - 0.5).length;
      return { t, score: t.worth * (COMMON + (1 - COMMON) / (1 + like / 3)), alone: like === 0 };
    }),
  ].sort((a, b) => b.score - a.score);
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
  const span = about.length >= 2 * ABOUT ? "the twenty about it" : `${said(about.length)} years`,
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
          say: () => [`${sentence(words)}, the most of any year in ${span}.`],
        },
        score: 3.6 + Math.min(1.4, times / 5),
        alone: false,
      });
  const seen = new Set<string>();
  for (const id of Object.keys(COUNTED) as SectionId[])
    for (const [type, one, more] of COUNTED[id]) {
      const n = here.n.get(type) ?? 0;
      if (n < MOST_LEAST || seen.has(one)) continue;
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

/** A line's headline: its own words, short. */
function headlineOf(world: World, t: Told, year: number): string {
  const words = plain(toldWords(world, t, year))
    // (How many more like it is the line's to say.)
    .replace(/, and (?:\w+|[\d,]+) more [^,.;:]*?(?=[.;:]|$)/, "")
    .replace(/, the most of any year in the twenty about it/, ", the most in twenty years")
    .replace(/, the most of any year in (\w+) years/, ", the most in $1 years")
    .replace(/^(\w+) realms came to an end: .*$/, "$1 realms came to an end");
  return clip(words);
}

/** What a lead's picture shows, by its happening's kind. */
const TYPE_MOTIF: readonly (readonly [RegExp, ToldMotif])[] = [
  [/^planet\.eruption/, "eruption"],
  [/^(act\.quake)/, "quake"],
  [/^(act|toy)\.flood/, "flood"],
  [/^(act\.(fire|meteor|flare)|wild\.fire|war\.strike|fire\.)/, "fire"],
  [
    /^(war\.peace|terms\.|diplomacy\.pact|ties\.(league|council)$|underworld\.(pax|truce))/,
    "peace",
  ],
  [/^(war\.|underworld\.(war|feud|clash|operation)|groups\.hired)/, "battle"],
  [
    /^(polity\.ended|town\.forsaken|lore\.lost|nation\.(fell|dark)|far\.fell|language\.died)/,
    "fall",
  ],
  [/^(polity\.(formed|split|seceded|joined)|city\.|settlement\.|town\.|province\.)/, "rise"],
  [
    /^(strife\.|order\.(revolt|crushed|crisis|movement)|houses\.(purged|overthrown)|bodies\.strike)/,
    "strife",
  ],
  [/^(polity\.|court\.|reign\.|order\.|notable\.|houses\.|ties\.)/, "crown"],
  [/^(health\.|act\.(plague|curse))/, "sickness"],
  [/^(ecology\.(woods-turn|forest-cleared))/, "woods"],
  [/^(industry\.(lode-out|lode-deeper|mine|well))/, "dig"],
  [/^(people\.famine|weather\.|climate\.|ecology\.|people\.smoke)/, "famine"],
  [/^(belief\.)/, "faith"],
  [/^(trade\.(sea-route)|peoples\.sailed)/, "ship"],
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
      : t.key === "first"
        ? "found"
        : e
          ? (TYPE_MOTIF.find(([re]) => re.test(e.type))?.[1] ?? "found")
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

/** What led to a happening: the strongest of its causes, a step or two back, as far as history holds them. */
function ledTo(world: World, ref: string, year: number): ToldItem[] {
  const out: ToldItem[] = [],
    seen = new Set<string>([ref]);
  let node = why(world, ref as Ref);
  for (let step = 0; step < 6 && out.length < 2; step++) {
    const edge = [...node.causes].sort((a, b) => b.cause.weight - a.cause.weight)[0];
    if (!edge || seen.has(edge.cause.ref)) break;
    seen.add(edge.cause.ref);
    node = edge.next();
    if (node.basis === "unknown") break;
    // (A choice between them is told on the happening's own page, with what weighed in it: here, what happened before.)
    const e = world.events.get(node.ref);
    if (e) {
      out.push(eventItem(world, e, year));
      continue;
    }
    if (!world.events.tombstone(node.ref)) continue;
    // (Forgotten but for its outline: its words, without where on the globe it lay.)
    const y = node.t === null ? null : yearOfMoment(node.t),
      words = sentence(withoutYear(node.claim, y ?? year))
        .replace(/ at -?\d[\d.]*°[NS] -?\d[\d.]*°[EW]/g, "")
        .replace(/\.$/, "");
    out.push({
      line: [y !== null && y !== year ? `${y}: ${words}.` : `${words}.`],
      ref: node.ref,
      ...(y !== null ? { year: y } : {}),
    });
  }
  return out;
}

/** What came of a happening: what the next years hold that names it among its causes, the greatest first. */
function cameOf(world: World, r: Reader, ref: string, year: number): ToldItem[] {
  const found: HistoryEvent[] = [],
    now = yearNow(world);
  for (let y = year; y <= Math.min(now, year + ABOUT) && found.length < 24; y++)
    for (const e of r.realm ? eventsOf(world, y) : r.events(y))
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
        ? Math.abs(d / was) >= 0.1
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
  if (r.realm) {
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
function quietLines(world: World, r: Reader, year: number) {
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
          headline = `The ${ordinal(since)} year of peace${headline ? `, ${headline.replace(/^A (quiet|still) year: /, "")}` : ""}`;
      }
    }
  }
  return { headline, lines, land };
}

// ————— The sections —————

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
  for (let y = from; y <= to; y++) {
    for (const t of r.told(y)) {
      if (t.worth < KIND_WORTH) continue;
      const id = sectionOf(world.events.get(t.ref as Ref), t),
        list = lines.get(id);
      if (list) list.push({ t, year: y });
      else lines.set(id, [{ t, year: y }]);
    }
    for (const [type, n] of r.counts(y).n) counts.set(type, (counts.get(type) ?? 0) + n);
    fallen += r.counts(y).fallen;
  }
  const out: ToldSection[] = [];
  for (const s of SECTIONS) {
    const all = (lines.get(s.id) ?? []).sort((a, b) => b.t.worth - a.t.worth || a.year - b.year),
      kinds = new Set<string>(),
      // (Of a run of years, one line a kind: ten years' floods are one flood's line, and how many were counted.)
      shown = all
        .filter((x) => {
          if (skip.has(x.t)) return false;
          if (!run) return true;
          if (kinds.has(x.t.key)) return false;
          kinds.add(x.t.key);
          return true;
        })
        .slice(0, SECTION_LINES),
      parts: string[] = [],
      seen = new Set<string>();
    for (const [type, one, more] of COUNTED[s.id]) {
      const n = counts.get(type) ?? 0;
      // (Two kinds told in the same words are one count.)
      if (!n || seen.has(one)) continue;
      const also = COUNTED[s.id].filter((c) => c[1] === one && c[0] !== type),
        sum = n + also.reduce((k, c) => k + (counts.get(c[0]) ?? 0), 0);
      seen.add(one);
      parts.push(`${said(sum)} ${sum === 1 ? one : more}`);
      if (parts.length >= 4) break;
    }
    let text = clauses(parts);
    if (s.id === "war" && fallen > 0)
      text += ` ${count(fallen)} fell in the battles history still keeps.`;
    if (!all.length && !text) continue;
    out.push({
      id: s.id,
      icon: s.icon,
      name: s.name,
      text: text ? [text] : [],
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

// ————— The telling —————

const TOLD = new WeakMap<World, { stamp: string; at: number; by: Map<string, YearTold> }>();

const stampOf = (world: World) => {
  const n = world.events.count;
  return `${n}:${n ? world.events.at(n - 1).id : ""}`;
};

/** How many tellings a world keeps now (for a test of its bound). */
export function toldKept(world: World): number {
  return TOLD.get(world)?.by.size ?? 0;
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
    before: isEvent ? ledTo(world, t.ref, year) : [],
    after: isEvent ? cameOf(world, r, t.ref, year) : [],
  };
}

/** A year told, or a run of years, of the world or of one realm. */
export function yearTold(world: World, ask: { year: number; to?: number; realm?: string | null }) {
  const t0 = performance.now(),
    now = yearNow(world),
    first = firstYear(world),
    year = Math.max(0, Math.min(now, Math.round(ask.year))),
    to = Math.max(year, Math.min(now, Math.round(ask.to ?? year), year + TOLD_SPAN - 1)),
    realm = ask.realm && politiesOf(world).get(ask.realm as Ref) ? ask.realm : null,
    key = `${year}..${to}|${realm ?? ""}`,
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
  const r = readerOf(world, realm),
    run = to > year,
    leads: ToldLead[] = [],
    years: { year: number; headline: string; worth: number }[] = [],
    used = new Set<Told>();
  if (!run) {
    const cands = ranked(r, year),
      top = cands[0] ?? null,
      // (Beside it, what else would lead a year of its own: of another kind, the greatest first.)
      beside: Cand[] = [];
    const quiet = quietLines(world, r, year),
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
        room = loud ? Math.max(0, LEAD_LINES - said) : quiet.lines.length;
      leads.push({
        ...lead,
        lines: [...lead.lines, ...quiet.lines.slice(0, said >= 2 && loud ? 0 : room)],
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
        headline: realm
          ? "Nothing is kept of its year"
          : first > year
            ? "Before anyone could tell of it"
            : "Nothing is kept of this year by itself",
        lines: [
          {
            line: [
              realm
                ? "History keeps nothing that this realm did or suffered in the year."
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
    // A run of years: its years' leads ranked, the greatest told first, each year a way in.
    const tops: { c: Cand; year: number }[] = [];
    for (let y = year; y <= to; y++) {
      const c = ranked(r, y)[0];
      if (!c) continue;
      tops.push({ c, year: y });
      years.push({ year: y, headline: headlineOf(world, c.t, y), worth: c.score });
    }
    tops.sort((a, b) => b.c.score - a.c.score || a.year - b.year);
    const seen = new Set<string>();
    for (const { c, year: y } of tops) {
      if (leads.length >= LEAD_LINES) break;
      // (Two of one kind would read as one: the greatest, and on to something else. A first is each its own.)
      if (seen.has(c.t.key) && c.t.key !== "first") continue;
      seen.add(c.t.key);
      const lead = leadOf(world, r, c, y, [], true);
      if (lead) leads.push({ ...lead, headline: `${y}: ${lead.headline}` });
      used.add(c.t);
    }
    years.sort((a, b) => b.worth - a.worth || a.year - b.year);
    if (!leads.length)
      leads.push({
        headline: "Nothing is kept of these years",
        lines: [{ line: ["History keeps no happening of these years worth a line."], ref: null }],
        vignette: vignetteOf(world, null, null),
        before: [],
        after: [],
      });
  }
  const subject = realm
      ? { ref: realm, name: nameOf(world, realm), color: realmColor(realm) }
      : null,
    told: YearTold = {
      year,
      to,
      now,
      first,
      subject,
      kicker: run
        ? `Years ${count(year)} to ${count(to)}`
        : year === now
          ? `Year ${count(year)}, so far`
          : `Year ${count(year)}`,
      leads,
      years,
      sections: sectionsOf(world, r, year, to, used),
      figures: figuresOf(world, r, to, year),
      map: mapOf(world, r, year, to),
      less: lessOf(world, year, realm),
      art: world.hasStore("planet.home") ? worldArt(world) : null,
      ms: 0,
    },
    done = { ...told, ms: Math.round((performance.now() - t0) * 10) / 10 };
  kept.by.set(key, done);
  while (kept.by.size > TOLD_KEPT) kept.by.delete(kept.by.keys().next().value!);
  return done;
}

/** The page a year told stands in: its tool reads it, and goes from year to year in place. */
export function toldPage(world: World, ref: string): PageModel {
  const ask = toldAsk(ref) ?? { year: yearNow(world), to: yearNow(world), realm: null },
    now = yearNow(world),
    realm = ask.realm && politiesOf(world).get(ask.realm as Ref) ? ask.realm : null,
    name = realm ? nameOf(world, realm) : "";
  return {
    ref,
    kind: "year",
    icon: "🗓️",
    title: realm ? `${sentence(name)}: its year` : "The year told",
    subtitle: realm
      ? ["What each year was to ", link(name, realm), ", from what history keeps."]
      : [
          "What each year was, from what history keeps. Line by line: ",
          link("The Years", "world:chronicle#years"),
          ".",
        ],
    color: realm ? realmColor(realm) : null,
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
