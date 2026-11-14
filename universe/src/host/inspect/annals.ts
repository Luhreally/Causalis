// The years (A1, classic 55 and 159): a world's history read year by year, and what a run of years came to,
// from one reading, so the two can't disagree. Nothing is kept in the world: every word is read from its log
// of events, and what is kept here is kept outside it, until the log has moved on.
//
// What makes a line worth a person's time (measured over whole worlds, tools/a1-tally.ts):
//   - What only spreads what is already known is never told: a land that learned from its neighbours.
//   - A first in all the world is worth the most. A realm's fall comes next, then what changed who rules.
//   - A war is told by its beginning, its end and its worst year; only the worst fifth of a world's wars are
//     told with no filter. Its other battles and raids are counted, not told.
//   - What goes on from year to year (a famine, a sickness passing from land to land) is told once, in the
//     year it began, with how long it held and what it took.
//   - What several of a kind did in one year is one line: the greatest, and how many more.
import { YEAR, yearOfMoment, type HistoryEvent, type World } from "../../kernel/index.ts";
import { cellRef } from "../../gen/index.ts";
import { landWords, why } from "../../causal/index.ts";
import { homePlanet, politiesOf } from "../../sim/index.ts";
import {
  ALL_WORTH,
  ANNAL_ALL,
  KIND_WORTH,
  type AnnalYear,
  type AnnalsIndex,
  type Line,
  type RunTold,
  type Span,
} from "../../bridge/index.ts";
import { firstsNow } from "./alerts.ts";
import { landTitle, nameOf } from "./names.ts";
import { count, link, many, sentence } from "./words.ts";

/** A line's kind: its place in ANNAL_KINDS. */
const WARS = 0,
  FIRSTS = 1,
  SORROWS = 2,
  PEOPLE = 3,
  STARS = 4;

/** Each kind of event: what kind of line it makes and how much it is worth (0: never told). */
const RULES: Readonly<Record<string, readonly [number, number]>> = {
  "polity.ended": [WARS, 6],
  "polity.split": [WARS, 3],
  "polity.seceded": [WARS, 3],
  "polity.formed": [WARS, 3],
  "polity.joined": [WARS, 1],
  "war.declared": [WARS, 3],
  "war.peace": [WARS, 3],
  "war.battle": [WARS, 2],
  "war.strike": [WARS, 2],
  "war.taken": [WARS, 3],
  "war.rebellion": [WARS, 3],
  "ties.league": [WARS, 5],
  "ties.league.ended": [WARS, 3],
  "ties.claim": [WARS, 3],
  "ties.answered": [WARS, 1],
  "terms.rose": [WARS, 4],
  "terms.unpaid": [WARS, 3],
  "terms.ended": [WARS, 2],
  "terms.sacked": [WARS, 1],
  "strife.revolution": [WARS, 5],
  "strife.repressed": [WARS, 3],
  "strife.throne": [WARS, 5],
  "strife.subdued": [WARS, 3],
  "strife.parted": [WARS, 4],
  "fire.begun": [WARS, 5],
  "fire.held": [WARS, 6],
  "fire.crisis": [WARS, 5],
  "fire.stepped": [WARS, 4],
  "fire.given": [WARS, 5],
  "fire.taken": [WARS, 5],
  "fire.cold": [SORROWS, 7],
  "fire.clear": [SORROWS, 5],
  // Firsts and knowledge.
  "people.origin": [FIRSTS, 7],
  "people.spread": [FIRSTS, 5],
  "lore.found": [FIRSTS, 3],
  "lore.learned": [FIRSTS, 0],
  "lessons.taken": [FIRSTS, 2],
  "lessons.copied": [FIRSTS, 0],
  "knowledge.cultivation": [FIRSTS, 4],
  "knowledge.herding": [FIRSTS, 4],
  "knowledge.metalworking": [FIRSTS, 4],
  "knowledge.cultivation-spread": [FIRSTS, 0],
  "knowledge.herding-spread": [FIRSTS, 0],
  "knowledge.metalworking-spread": [FIRSTS, 0],
  "industry.tools": [FIRSTS, 1],
  "industry.works": [FIRSTS, 2],
  "industry.mine": [FIRSTS, 2],
  "industry.well": [FIRSTS, 2],
  "design.host": [FIRSTS, 2],
  "design.house": [FIRSTS, 1],
  "design.works": [FIRSTS, 1],
  "city.founded": [FIRSTS, 3],
  "city.reshaped": [FIRSTS, 1],
  "settlement.founded": [FIRSTS, 1],
  "settlement.market": [FIRSTS, 1],
  "town.walled": [FIRSTS, 1],
  "town.temple": [FIRSTS, 1],
  "town.forsaken": [SORROWS, 2],
  // (What a town was asked, and raised: H1.)
  "town.asked": [FIRSTS, 2],
  "town.raised": [FIRSTS, 3],
  "province.peopled": [FIRSTS, 1],
  "trade.route-opened": [FIRSTS, 1],
  "trade.sea-route": [FIRSTS, 2],
  "trade.embargo": [WARS, 1],
  "trade.relief": [SORROWS, 2],
  // Disasters and sickness.
  "people.famine": [SORROWS, 3],
  "people.migration": [SORROWS, 0],
  "people.smoke": [SORROWS, 3],
  "health.rose": [SORROWS, 4],
  "health.outbreak": [SORROWS, 3],
  "health.went": [SORROWS, 4],
  "weather.drought": [SORROWS, 1],
  "climate.warmer": [SORROWS, 4],
  "climate.drier": [SORROWS, 3],
  "climate.wetter": [SORROWS, 2],
  "ecology.hunted-out": [SORROWS, 2],
  "ecology.woods-turn": [SORROWS, 5],
  "industry.lode-out": [SORROWS, 5],
  "industry.lode-deeper": [FIRSTS, 5],
  "ecology.hunters-gone": [SORROWS, 2],
  "ecology.herds-gone": [SORROWS, 2],
  "ecology.overgrazed": [SORROWS, 1],
  "beast.known": [SORROWS, 5],
  "beast.took": [SORROWS, 1],
  "beast.after": [SORROWS, 2],
  "beast.ended": [SORROWS, 5],
  "war.herds-driven": [WARS, 2],
  "life.kind-new": [FIRSTS, 5],
  "life.kind-gone": [SORROWS, 5],
  "life.tamed": [FIRSTS, 4],
  "act.flood": [SORROWS, 5],
  "act.fire": [SORROWS, 5],
  "act.meteor": [SORROWS, 6],
  "act.plague": [SORROWS, 5],
  "act.quake": [SORROWS, 6],
  "act.curse": [SORROWS, 5],
  "act.flare": [SORROWS, 5],
  "act.loose": [SORROWS, 6],
  "act.warm": [SORROWS, 5],
  "toy.flood": [SORROWS, 2],
  // People and rulers.
  "polity.succession": [PEOPLE, 3],
  "polity.reformed": [PEOPLE, 4],
  "polity.tithe": [PEOPLE, 1],
  "strife.coup": [PEOPLE, 5],
  "strife.foiled": [PEOPLE, 3],
  "strife.restored": [PEOPLE, 3],
  "court.seized": [PEOPLE, 5],
  "court.regency": [PEOPLE, 3],
  "court.plot": [PEOPLE, 3],
  "court.found": [PEOPLE, 3],
  "court.claim": [PEOPLE, 3],
  "court.heirdied": [PEOPLE, 2],
  "court.heir": [PEOPLE, 1],
  "court.bought": [PEOPLE, 2],
  "reign.wed": [PEOPLE, 3],
  "order.abolished": [PEOPLE, 5],
  "order.freed": [PEOPLE, 6],
  "order.revolt": [PEOPLE, 3],
  "order.crushed": [PEOPLE, 3],
  "order.crisis": [PEOPLE, 4],
  "order.law": [PEOPLE, 2],
  "order.held": [PEOPLE, 3],
  "order.lesson": [PEOPLE, 2],
  "order.movement": [PEOPLE, 3],
  "order.captives": [PEOPLE, 2],
  "order.serfdom": [PEOPLE, 3],
  "order.bondage": [PEOPLE, 2],
  "order.indenture": [PEOPLE, 1],
  "order.corvee": [PEOPLE, 1],
  "order.convicts": [PEOPLE, 1],
  "order.flight": [PEOPLE, 1],
  "credit.founded": [PEOPLE, 2],
  "credit.failed": [PEOPLE, 3],
  "credit.defaulted": [PEOPLE, 4],
  "credit.jubilee": [PEOPLE, 2],
  "credit.chest": [PEOPLE, 2],
  "credit.lent": [PEOPLE, 1],
  "credit.lost": [PEOPLE, 1],
  "belief.founded": [PEOPLE, 5],
  "belief.schism": [PEOPLE, 3],
  "belief.converted": [PEOPLE, 1],
  "language.arose": [PEOPLE, 2],
  "language.contact": [PEOPLE, 2],
  "language.shifted": [PEOPLE, 1],
  "language.died": [PEOPLE, 2],
  "diplomacy.pact": [PEOPLE, 1],
  "diplomacy.broken": [PEOPLE, 1],
  // The stars.
  "space.satellite": [STARS, 2],
  "space.crew": [STARS, 2],
  "space.station": [STARS, 2],
  "space.colony": [STARS, 4],
  "space.voyage": [STARS, 3],
  "space.arrival": [STARS, 4],
  "lanes.first": [STARS, 7],
  "lanes.sent": [STARS, 3],
  "lanes.came": [STARS, 4],
  "contact.met": [STARS, 7],
  "contact.heard": [STARS, 6],
  "contact.exchange": [STARS, 2],
  "peoples.landed": [STARS, 7],
  "peoples.raid": [STARS, 6],
  "peoples.met": [STARS, 5],
  "peoples.sailed": [STARS, 3],
  "peoples.settled": [STARS, 4],
  "starwar.declared": [STARS, 3],
  "starwar.battle": [STARS, 3],
  "starwar.peace": [STARS, 1],
  "filled.sailed": [STARS, 2],
  "filled.landed": [STARS, 2],
  "filled.world": [STARS, 2],
  "nation.left": [STARS, 3],
  "nation.joined": [STARS, 2],
  "nation.taken": [STARS, 3],
  "nation.dark": [STARS, 2],
  "nation.greatest": [STARS, 7],
  "nation.fell": [STARS, 7],
  "nation.first-left": [STARS, 7],
  "nation.first-dark": [STARS, 7],
  "trade.first": [STARS, 7],
  "trade.first-raid": [STARS, 7],
  "trade.opened": [STARS, 2],
  "trade.came": [STARS, 1],
  "trade.closed": [STARS, 1],
  "trade.raided": [STARS, 2],
  "trade.rich": [STARS, 2],
  "far.begun": [STARS, 5],
  "far.held": [STARS, 5],
  "far.crisis": [STARS, 6],
  "far.stepped": [STARS, 5],
  "far.fell": [STARS, 7],
  "far.given": [STARS, 5],
  "late.mirrors": [STARS, 5],
  "late.remaking": [STARS, 3],
  "late.remade": [STARS, 4],
  "late.gathered": [STARS, 6],
  "late.covered": [STARS, 6],
};

/** What a kind of event not named above makes, by its domain: a new kind of history is told at once. */
const DOMAINS: Readonly<Record<string, number>> = {
  wild: SORROWS,
  war: WARS,
  polity: WARS,
  strife: WARS,
  fire: WARS,
  knowledge: FIRSTS,
  lore: FIRSTS,
  industry: FIRSTS,
  design: FIRSTS,
  city: FIRSTS,
  settlement: FIRSTS,
  town: FIRSTS,
  health: SORROWS,
  weather: SORROWS,
  climate: SORROWS,
  ecology: SORROWS,
  space: STARS,
  starwar: STARS,
  peoples: STARS,
  contact: STARS,
  nation: STARS,
  filled: STARS,
  lanes: STARS,
  far: STARS,
  late: STARS,
  trade: STARS,
};

function ruleOf(e: HistoryEvent): readonly [number, number] {
  // (What the world did by itself goes in by how great it was: N1.)
  if ((e.data as { natural?: boolean } | null)?.natural) return [SORROWS, e.importance - 1];
  return (
    RULES[e.type] ?? [DOMAINS[e.type.slice(0, e.type.indexOf("."))] ?? PEOPLE, e.importance - 2]
  );
}

/** How many of a thing, said: "three", up to twelve. */
const WORDS = "zero one two three four five six seven eight nine ten eleven twelve".split(" ");
const said = (n: number): string => WORDS[n] ?? count(n);

/** So many, said: "three realms", "21 realms", "one realm". */
const told = (n: number, one: string, more: string): string =>
  n <= 12 ? `${said(n)} ${n === 1 ? one : more}` : many(n, one, more);

/** A share in plain words: "half", "one in ten". */
function oneIn(share: number): string {
  if (share >= 0.45) return "half";
  if (share >= 0.3) return "a third";
  if (share >= 0.22) return "a quarter";
  return `one in ${said(Math.round(1 / share))}`;
}

/** An event's words for a line that says its year first: the year gone from them, wherever it stood. */
export function withoutYear(claim: string, year: number): string {
  return claim
    .replace(/,? (?:in )?year (-?\d+)(?=[:;,.]|$)/g, (all, n: string) =>
      Math.abs(Number(n) - year) <= 1 ? "" : all,
    )
    .trim();
}

/** A sentence's end. */
const ended = (text: string): string => (/[.!?…]$/.test(text) ? text : `${text}.`);

/** A land's words, without where it lies: on the page a press away, and no one reads a coordinate aloud. */
export function landName(world: World, cell: number): string {
  return landTitle(world, cell, true).replace(/ at -?\d[\d.]*°[NS].*$/, "");
}

/** A land's words where they say where it lies, in a sentence. */
const IN_FIGURES = /\b[Tt]he [a-z][a-z -]* at -?\d[\d.]*°[NS] -?\d[\d.]*°[EW]/g;
const LAND_WORDS = new WeakMap<World, Map<string, number>>();
/** Every land by its words: asked for only by a claim that names a land its event does not. */
function landsByWords(world: World): Map<string, number> {
  let m = LAND_WORDS.get(world);
  if (!m) {
    m = new Map();
    const n = homePlanet(world).generated.offworld.base;
    for (let c = 0; c < n; c++) m.set(landWords(world, cellRef(0, c)).toLowerCase(), c);
    LAND_WORDS.set(world, m);
  }
  return m;
}

type Found = { at: number; len: number; ref: string; as?: string };

/** Where names lie in a sentence: longest first, none over another, each name wherever it stands. */
function foundIn(text: string, names: readonly { text: string; ref: string; as?: string }[]) {
  const low = text.toLowerCase(),
    found: Found[] = [];
  for (const n of [...names].sort((a, b) => b.text.length - a.text.length)) {
    if (!n.text) continue;
    const want = n.text.toLowerCase();
    for (let at = low.indexOf(want); at >= 0; at = low.indexOf(want, at + want.length)) {
      // (A whole word only: Gel is not in Gelwick.)
      if (/[\p{L}\p{N}]/u.test(text[at + want.length] ?? "")) continue;
      if (at > 0 && /[\p{L}\p{N}]/u.test(text[at - 1]!)) continue;
      if (found.some((f) => at < f.at + f.len && f.at < at + want.length)) continue;
      found.push({ at, len: want.length, ref: n.ref, ...(n.as ? { as: n.as } : {}) });
    }
  }
  return found.sort((a, b) => a.at - b.at);
}

/** Every name an event names, as the words its claim has it in, with what opens its page. */
function namesOf(world: World, e: HistoryEvent) {
  const d = (e.data ?? {}) as Record<string, unknown>,
    str = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : ""),
    realms = politiesOf(world),
    pols = e.subjects.filter((s) => s.startsWith("pol:")),
    names: { text: string; ref: string; as?: string }[] = [];
  pols.forEach((ref, i) => {
    const r = realms.get(ref),
      said = i === 0 ? [str("a"), str("name"), str("realm")] : i === 1 ? [str("b")] : [];
    for (const text of said) if (text) names.push({ text, ref });
    if (r) {
      names.push({ text: nameOf(world, ref), ref });
      names.push({ text: r.town, ref });
    }
  });
  for (const s of e.subjects) {
    // (A land's name is said below, as a person says it.)
    if (/^(pol|war|star|cell):/.test(s)) continue;
    if (s.startsWith("sick:") && str("sickness")) {
      names.push({ text: str("sickness"), ref: s });
      continue;
    }
    if (s.startsWith("town:") && str("name")) names.push({ text: str("name"), ref: s });
    const text = nameOf(world, s);
    if (text.length <= 48) names.push({ text, ref: s });
  }
  // The land it happened in, and any other named by number: by a name a person can say.
  const lands = new Set<number>();
  for (const v of [e.place, ...e.subjects])
    if (v?.startsWith("cell:")) lands.add(Number(v.split(":")[2]));
  for (const k of ["from", "to", "cell", "land"])
    if (typeof d[k] === "number" && Number.isInteger(d[k])) lands.add(d[k] as number);
  for (const c of lands) {
    const ref = cellRef(0, c);
    try {
      names.push({ text: landWords(world, ref), ref, as: landName(world, c) });
    } catch {
      // (A number that is no land.)
    }
  }
  // (And a land its data does not number: its words are enough to find it by.)
  for (const m of why(world, e.id).claim.matchAll(IN_FIGURES)) {
    // (From the last "the": "The bound of the hot desert at" is of the hot desert.)
    const text = m[0].slice(m[0].toLowerCase().lastIndexOf("the ")),
      c = landsByWords(world).get(text.toLowerCase());
    if (c !== undefined) {
      names.push({ text, ref: cellRef(0, c), as: landName(world, c) });
      continue;
    }
    // (Its own ground, at the place of a land it happened in, as a fire tells it: the same words, without the figures.)
    const at = text.slice(text.indexOf(" at "));
    for (const l of lands)
      if (landWords(world, cellRef(0, l)).endsWith(at))
        names.push({ text, ref: cellRef(0, l), as: text.slice(0, -at.length) });
  }
  // One of a court, with a page of their own.
  if (typeof d.fig === "number" && e.subjects[0]) {
    const who = str("who") || str("general") || str("to") || str("by");
    if (who) names.push({ text: who, ref: `court:${e.subjects[0]}:${d.fig}` });
  }
  return { names, d };
}

/** Words with every name in them a link, in the words a person says it in. */
function linked(text: string, names: readonly { text: string; ref: string; as?: string }[]): Line {
  const out: Span[] = [];
  let from = 0;
  for (const f of foundIn(text, names)) {
    if (f.at > from) out.push(text.slice(from, f.at));
    out.push(link(f.as ?? text.slice(f.at, f.at + f.len), f.ref));
    from = f.at + f.len;
  }
  if (from < text.length) out.push(text.slice(from));
  return capital(out);
}

/** The first letter of a line up, whether it is words or a name. */
function capital(line: readonly Span[]): Line {
  const [head, ...rest] = line;
  if (head === undefined) return [];
  return typeof head === "string"
    ? [sentence(head), ...rest]
    : [{ ...head, text: sentence(head.text) }, ...rest];
}

/** An event, as a line. */
export function lineOf(world: World, e: HistoryEvent, year: number, after = ""): Line {
  const { names, d } = namesOf(world, e),
    text = ended(`${withoutYear(why(world, e.id).claim, year).replace(/\.$/, "")}${after}`),
    line = linked(text, names),
    star = typeof d.star === "string" ? d.star : null,
    key = typeof d.key === "string" ? d.key : null,
    world_ = key ?? (star && typeof d.planet === "number" ? `${star}/${d.planet}` : null);
  if (!world_) return line;
  // (A world of another star: "a world" opens it.)
  return line.flatMap((s, i): Span[] => {
    if (typeof s !== "string") return [s];
    const m = /\b[Aa] world\b/.exec(s);
    if (!m || line.slice(0, i).some((x) => typeof x !== "string" && x.ref === world_)) return [s];
    return [
      ...(m.index ? [s.slice(0, m.index)] : []),
      link(m[0], world_),
      ...(m.index + m[0].length < s.length ? [s.slice(m.index + m[0].length)] : []),
    ];
  });
}

/** A realm an event's data names, as a link. */
function realmSpan(e: HistoryEvent, i: number, words: string): Span {
  const ref = e.subjects.filter((s) => s.startsWith("pol:"))[i];
  return ref ? link(words, ref) : words;
}

/** What is told of a year: its kind, its worth, what it opens, and its words when they are asked for. */
type Told = {
  readonly kind: number;
  readonly worth: number;
  readonly ref: string;
  /** What it is, for a tally and for what a run came to. */
  readonly key: string;
  readonly say: () => Line;
  /** A realm it tells the fall of: a run counts them. */
  readonly fell?: readonly Span[];
};

type Run = { first: HistoryEvent; year: number; years: number; lands: number; dead: number };

/** What a year's words ask of the rest of history: each war's worst, and what goes on from year to year. */
type Whole = {
  /** Each war: all who fell in it, its year of battle and of raids that took the most, and if it is of the worst. */
  readonly wars: Map<
    string,
    { dead: number; battleYear: number; strikeYear: number; great: boolean }
  >;
  /** A famine or a sickness: its run, by the event that began it; what goes on from one is not told again. */
  readonly runs: Map<string, Run>;
  readonly later: Set<string>;
  /** The strikes that were the greatest fire. */
  readonly great: Set<string>;
  /** The world's firsts, by the event that was one. */
  readonly firsts: Map<string, string>;
  /** The firsts with no event left, by their year. */
  readonly bare: Map<number, { what: string; land: number | null }[]>;
};

/** How many years may lie between a sickness's coming to one land and the next, and be one sickness's passing. */
const SICK_GAP = 2;
/** A famine of fewer people than this is told only under its filter. */
const GREAT_FAMINE = 100_000;
/** Of a world's wars, the share told with no filter. */
const GREAT_WARS = 0.2;
/** And never more of them than one to so many of a world's years. */
const GREAT_WAR_YEARS = 10;

function wholeOf(world: World, kept: readonly HistoryEvent[]): Whole {
  const wars: Whole["wars"] = new Map(),
    runs: Whole["runs"] = new Map(),
    later: Whole["later"] = new Set(),
    great: Whole["great"] = new Set(),
    open = new Map<string, Run>(),
    byYear = new Map<string, Map<number, number>>(),
    add = (key: string, year: number, n: number) => {
      const m = byYear.get(key) ?? new Map<number, number>();
      m.set(year, (m.get(year) ?? 0) + n);
      byYear.set(key, m);
    };
  for (const e of kept) {
    const year = yearOfMoment(e.t),
      d = e.data as { fallen?: number; dead?: number; people?: number } | null;
    if (e.type === "war.battle" || e.type === "war.strike") {
      const war = e.subjects.find((s) => s.startsWith("war:"));
      if (!war) continue;
      const dead = (e.type === "war.battle" ? d?.fallen : d?.dead) ?? 0;
      add(`${e.type}|${war}`, year, dead);
      if (e.type === "war.strike" && (d as { great?: boolean } | null)?.great) great.add(e.id);
      const w = wars.get(war) ?? { dead: 0, battleYear: -1, strikeYear: -1, great: false };
      w.dead += dead;
      wars.set(war, w);
    } else if (e.type === "war.declared") {
      const war = e.subjects.find((s) => s.startsWith("war:"));
      if (war && !wars.has(war))
        wars.set(war, { dead: 0, battleYear: -1, strikeYear: -1, great: false });
    } else if (e.type === "people.famine" || e.type === "health.outbreak") {
      const famine = e.type === "people.famine",
        key = famine ? `f|${e.place}` : `s|${e.subjects[0]}`,
        run = open.get(key);
      if (run && year - run.year <= (famine ? 1 : SICK_GAP)) {
        if (run.year !== year) run.years += year - run.year;
        run.year = year;
        run.lands++;
        run.dead += d?.dead ?? 0;
        later.add(e.id);
      } else {
        const fresh: Run = { first: e, year, years: 1, lands: 1, dead: d?.dead ?? 0 };
        open.set(key, fresh);
        runs.set(e.id, fresh);
      }
    }
  }
  const bestYear = (key: string): number => {
    let best = -1,
      most = -1;
    for (const [y, n] of byYear.get(key) ?? [])
      if (n > most) {
        most = n;
        best = y;
      }
    return best;
  };
  for (const [ref, w] of wars) {
    w.battleYear = bestYear(`war.battle|${ref}`);
    w.strikeYear = bestYear(`war.strike|${ref}`);
  }
  const worst = [...wars.values()].sort((a, b) => b.dead - a.dead);
  worst
    .slice(0, Math.ceil(Math.min(worst.length * GREAT_WARS, world.now / YEAR / GREAT_WAR_YEARS)))
    .forEach((w) => (w.great = true));
  const firsts: Whole["firsts"] = new Map(),
    bare: Whole["bare"] = new Map();
  for (const f of firstsNow(world)) {
    const what = f.what.replace(/^\P{L}+/u, "");
    if (f.ref && world.events.get(f.ref)) firsts.set(f.ref, what);
    else bare.set(f.year, [...(bare.get(f.year) ?? []), { what, land: f.land }]);
  }
  return { wars, runs, later, great, firsts, bare };
}

/** A war an event of it is of. */
const warOf = (e: HistoryEvent) => e.subjects.find((s) => s.startsWith("war:")) ?? "";

const dataOf = <T>(e: HistoryEvent) => (e.data ?? {}) as Partial<T>;

/** The words said of a kind of thing happening many times in a year, past the greatest of them. */
const MORE: Readonly<Record<string, (n: number) => string>> = {
  "war.declared": (n) => `, and ${told(n, "more war", "more wars")} began`,
  "war.peace": (n) => `, and ${told(n, "more war", "more wars")} ended`,
  "polity.succession": (n) => `, and ${told(n, "more seat", "more seats")} passed`,
  "polity.formed": (n) => `, and ${told(n, "more realm", "more realms")} rose`,
  "filled.sailed": (n) => `, and ${told(n, "more ship", "more ships")} set out`,
  "filled.landed": (n) => `, and settlers came down on ${told(n, "more world", "more worlds")}`,
  "filled.world": (n) => `, and ${told(n, "more world", "more worlds")} filled`,
  "nation.left": (n) => `, and ${told(n, "more world", "more worlds")} went their own way`,
  "trade.raided": (n) => `, and ${told(n, "more hold", "more holds")} taken`,
  "lore.found": (n) => `, and ${told(n, "more", "more")} came upon something new`,
};

/** A year's events, as what is told of it. */
function tellYear(world: World, year: number, events: readonly HistoryEvent[], w: Whole): Told[] {
  const out: Told[] = [],
    types = new Map<string, HistoryEvent[]>(),
    add = (t: Told) => out.push(t);
  for (const e of events) {
    const what = w.firsts.get(e.id);
    if (what !== undefined) {
      const [kind] = ruleOf(e);
      add({
        kind: kind === WARS ? FIRSTS : kind,
        worth: 8,
        ref: e.id,
        key: "first",
        say: () => {
          const line = lineOf(world, e, year),
            words = line.map((s) => (typeof s === "string" ? s : s.text)).join(""),
            low = what.toLowerCase();
          if (/\bfirst\b/i.test(words)) return line;
          return words.toLowerCase().includes(low.replace(/^(a|an|the) /, ""))
            ? lineOf(world, e, year, ", the first anywhere")
            : [`The world's first: ${low}. `, ...line];
        },
      });
      continue;
    }
    if (w.later.has(e.id) || ruleOf(e)[1] <= 0) continue;
    const list = types.get(e.type);
    if (list) list.push(e);
    else types.set(e.type, [e]);
  }
  for (const { what, land } of w.bare.get(year) ?? [])
    add({
      kind: FIRSTS,
      worth: 8,
      ref: "world:chronicle#firsts",
      key: "first",
      say: () => [
        `The world's first: ${what.toLowerCase()}`,
        ...(land !== null ? [", in ", link(landName(world, land), cellRef(0, land))] : []),
        ".",
      ],
    });
  const take = (type: string) => {
    const list = types.get(type) ?? [];
    types.delete(type);
    return list;
  };
  // A realm's fall: what took it is told with it, and its war's end not again.
  const fallen = new Map<string, { ref: string; by: string; e: HistoryEvent }>();
  for (const e of take("polity.ended")) {
    const name = dataOf<{ name: string }>(e).name ?? "";
    fallen.set(name, { ref: e.id, by: "", e });
  }
  const taken = new Map<string, HistoryEvent[]>();
  for (const e of take("war.taken")) {
    const d = dataOf<{ a: string; b: string }>(e),
      f = fallen.get(d.b ?? "");
    if (f) {
      f.by = d.a ?? "";
      continue;
    }
    const key = `${d.a}|${d.b}`;
    taken.set(key, [...(taken.get(key) ?? []), e]);
  }
  const peace = take("war.peace").filter((e) => {
    const d = dataOf<{ a: string; b: string }>(e);
    return !fallen.has(d.a ?? "") && !fallen.has(d.b ?? "");
  });
  if (peace.length) types.set("war.peace", peace);
  if (fallen.size > 1) {
    const all = [...fallen.values()],
      spans = all.map(({ e }) => realmSpan(e, 0, dataOf<{ name: string }>(e).name ?? "a realm"));
    add({
      kind: WARS,
      worth: 6,
      ref: all[0]!.e.id,
      key: "polity.ended",
      fell: spans,
      say: () =>
        capital([`${told(all.length, "realm", "realms")} came to an end: `, ...listed(spans), "."]),
    });
  } else
    for (const [, f] of fallen) {
      const { e, by } = f;
      add({
        kind: WARS,
        worth: 6,
        ref: e.id,
        key: e.type,
        fell: [realmSpan(e, 0, dataOf<{ name: string }>(e).name ?? "a realm")],
        say: () => lineOf(world, e, year, by ? `, its last land taken by ${by}` : ""),
      });
    }
  for (const list of taken.values()) {
    const e = list[0]!,
      d = dataOf<{ a: string; b: string }>(e);
    add({
      kind: WARS,
      worth: RULES["war.taken"]![1],
      ref: e.id,
      key: e.type,
      say: () =>
        list.length === 1
          ? lineOf(world, e, year)
          : capital([
              realmSpan(e, 0, d.a ?? "a realm"),
              ` took ${told(list.length, "land", "lands")} from `,
              realmSpan(e, 1, d.b ?? "a realm"),
              ".",
            ]),
    });
  }
  // A war's battles, each war's in a year as one line, told in the year it lost the most.
  const battles = new Map<string, HistoryEvent[]>();
  for (const e of take("war.battle")) {
    const ref = warOf(e),
      list = battles.get(ref);
    if (w.wars.get(ref)?.battleYear !== year) continue;
    if (list) list.push(e);
    else battles.set(ref, [e]);
  }
  for (const [ref, list] of battles) {
    const war = w.wars.get(ref),
      worst = list.reduce((a, b) =>
        (dataOf<{ fallen: number }>(b).fallen ?? 0) > (dataOf<{ fallen: number }>(a).fallen ?? 0)
          ? b
          : a,
      ),
      d = dataOf<{ a: string; b: string; fallen: number }>(worst),
      top = war?.battleYear === year;
    if (!top) continue;
    const all = list.reduce((n, e) => n + (dataOf<{ fallen: number }>(e).fallen ?? 0), 0);
    add({
      kind: WARS,
      worth: war?.great ? 4 : 2,
      ref: worst.id,
      key: "war.battle",
      say: () =>
        list.length === 1
          ? lineOf(world, worst, year)
          : capital([
              realmSpan(worst, 0, d.a ?? "a realm"),
              " and ",
              realmSpan(worst, 1, d.b ?? "a realm"),
              ` fought ${told(list.length, "battle", "battles")}, and ${count(all)} fell`,
              ...(worst.place?.startsWith("cell:")
                ? [
                    ", the most in ",
                    link(landName(world, Number(worst.place.split(":")[2])), worst.place),
                  ]
                : []),
              ".",
            ]),
    });
  }
  // What fell from the air, each war's in a year as one line, told in the year it took the most.
  const strikes = new Map<string, HistoryEvent[]>();
  for (const e of take("war.strike")) {
    if (w.great.has(e.id)) {
      add({ kind: WARS, worth: 7, ref: e.id, key: "war.fire", say: () => lineOf(world, e, year) });
      continue;
    }
    const ref = warOf(e);
    if (w.wars.get(ref)?.strikeYear !== year) continue;
    const list = strikes.get(ref);
    if (list) list.push(e);
    else strikes.set(ref, [e]);
  }
  for (const [ref, list] of strikes) {
    const war = w.wars.get(ref);
    if (war?.strikeYear !== year) continue;
    type Strike = { a: string; b: string; dead: number; rocket: boolean };
    const worst = list.reduce((a, b) =>
        (dataOf<Strike>(b).dead ?? 0) > (dataOf<Strike>(a).dead ?? 0) ? b : a,
      ),
      d = dataOf<Strike>(worst),
      all = list.reduce((n, e) => n + (dataOf<Strike>(e).dead ?? 0), 0),
      town = worst.subjects.find((s) => s.startsWith("town:")),
      place = nameOf(world, town ?? "");
    add({
      kind: WARS,
      worth: war.great ? 4 : 2,
      ref: worst.id,
      key: "war.strike",
      say: () =>
        list.length === 1
          ? lineOf(world, worst, year)
          : capital([
              d.rocket ? "Rockets of " : "Machines of ",
              realmSpan(worst, 0, d.a ?? "a realm"),
              d.rocket
                ? ` fell on ${told(list.length, "town", "towns")} of `
                : ` struck ${told(list.length, "town", "towns")} of `,
              realmSpan(worst, 1, d.b ?? "a realm"),
              d.rocket ? ": " : " from the air: ",
              `${count(all)} died, the most at `,
              town ? link(place, town) : "one of them",
              ".",
            ]),
    });
  }
  // A famine: where it began, how long it held. Several in a year: the worst, and how many.
  const hungry = take("people.famine");
  if (hungry.length) {
    const fed = (e: HistoryEvent) => dataOf<{ fed: number }>(e).fed ?? 1000,
      worst = hungry.reduce((a, b) => (fed(b) < fed(a) ? b : a)),
      run = w.runs.get(worst.id),
      long = run && run.years > 1 ? `, and it held ${said(run.years)} years` : "";
    add({
      kind: SORROWS,
      worth:
        (dataOf<{ people: number }>(worst).people ?? 0) < GREAT_FAMINE
          ? 2
          : fed(worst) < 500
            ? 5
            : (run?.years ?? 1) >= 5
              ? 4
              : 3,
      ref: worst.id,
      key: "people.famine",
      say: () => {
        const line = lineOf(world, worst, year, long);
        return hungry.length === 1
          ? line
          : [...line, ` It was not alone: ${told(hungry.length - 1, "more land", "more lands")}.`];
      },
    });
  }
  // A sickness's passing: told in the year it first came, with all it took on its way.
  for (const e of take("health.outbreak")) {
    const run = w.runs.get(e.id),
      d = dataOf<{ sickness: string; dead: number; people: number }>(e),
      share = (d.dead ?? 0) / Math.max(1, d.people ?? 1),
      dead = run?.dead ?? d.dead ?? 0,
      many_ = (run?.lands ?? 1) > 1;
    add({
      kind: SORROWS,
      worth: dead >= 1_000_000 || share >= 0.1 ? 5 : 3,
      ref: e.id,
      key: e.type,
      say: () => {
        if (!many_) {
          const line = lineOf(world, e, year);
          return share >= 0.1 ? [...line, ` It took ${oneIn(share)} of them.`] : line;
        }
        const sick = e.subjects[0],
          name = d.sickness ?? "a sickness";
        return capital([
          sick ? link(name, sick) : name,
          ` came to ${told(run!.lands, "land", "lands")}`,
          run!.years > 1 ? ` over ${said(run!.years)} years` : "",
          `, and ${count(dead)} died.`,
        ]);
      },
    });
  }
  // A dry year, only if it was a hard one: most are nothing to tell.
  const dry = take("weather.drought");
  if (dry.length) {
    const rain = (e: HistoryEvent) => dataOf<{ rain: number }>(e).rain ?? 1000,
      worst = dry.reduce((a, b) => (rain(b) < rain(a) ? b : a));
    if (rain(worst) <= 500)
      add({
        kind: SORROWS,
        worth: 3,
        ref: worst.id,
        key: "weather.drought",
        say: () =>
          lineOf(
            world,
            worst,
            year,
            dry.length > 1
              ? `, and ${told(dry.length - 1, "more land", "more lands")} went dry`
              : "",
          ),
      });
  }
  // A fleet's coming to its war: who it was. Its peace, the same fact again, is said only where nothing else tells it.
  const fights = take("starwar.battle");
  for (const e of fights) {
    const realm = e.subjects.find((s) => s.startsWith("pol:"));
    add({
      kind: STARS,
      worth: 3,
      ref: e.id,
      key: e.type,
      say: () => {
        const words = withoutYear(why(world, e.id).claim, year);
        return realm && words.startsWith("A fleet ")
          ? ["A fleet of ", link(nameOf(world, realm), realm), ended(words.slice("A fleet".length))]
          : lineOf(world, e, year);
      },
    });
  }
  // A rising crushed the year it rose: the crushing says it rose.
  if (types.has("order.crushed")) types.delete("order.revolt");
  // The rest: one line a kind, its greatest, and how many more.
  for (const [type, list] of types) {
    const best = list.reduce((a, b) => (b.importance > a.importance ? b : a)),
      [kind, base] = ruleOf(best),
      more = list.length - 1,
      war = type === "war.declared" || type === "war.peace" ? warOf(best) : "",
      great = list.some((e) => w.wars.get(warOf(e))?.great),
      // (The first in all the world to take up a lesson is told among the year's greatest: the lessons.)
      first =
        type === "lessons.taken"
          ? list.find((e) => (e.data as { first?: boolean } | null)?.first)
          : undefined,
      worth = war && great ? 4 : first ? ALL_WORTH : base,
      lead =
        war && great ? (list.find((e) => w.wars.get(warOf(e))?.great) ?? best) : (first ?? best);
    add({
      kind,
      worth,
      ref: lead.id,
      key: type,
      say: () =>
        lineOf(
          world,
          lead,
          year,
          more ? (MORE[type]?.(more) ?? `, and ${told(more, "more", "more")} like it`) : "",
        ),
    });
  }
  return out.sort((a, b) => b.worth - a.worth);
}

/** A world's years as read: what is told of each. Outside the world, read again when its log has moved on. */
type Annals = {
  readonly stamp: string;
  readonly count: number;
  readonly now: number;
  readonly years: readonly number[];
  readonly told: ReadonlyMap<number, readonly Told[]>;
  readonly words: Map<number, AnnalYear>;
};

const KEPT = new WeakMap<World, Annals>();

const stampOf = (world: World) => {
  const n = world.events.count;
  return `${n}:${n ? world.events.at(n - 1).id : ""}`;
};

/** A world's years: read once, and kept until its log has moved on. */
export function annalsOf(world: World): Annals {
  const stamp = stampOf(world),
    was = KEPT.get(world);
  if (was?.stamp === stamp) return was;
  const log = world.events,
    n = log.count,
    byYear = new Map<number, HistoryEvent[]>(),
    kept: HistoryEvent[] = [];
  for (let i = 0; i < n; i++) {
    const e = log.at(i);
    if (RULES[e.type]?.[1] === 0) continue;
    kept.push(e);
    const y = yearOfMoment(e.t),
      list = byYear.get(y);
    if (list) list.push(e);
    else byYear.set(y, [e]);
  }
  const whole = wholeOf(world, kept),
    told = new Map<number, readonly Told[]>();
  for (const year of whole.bare.keys()) if (!byYear.has(year)) byYear.set(year, []);
  for (const [year, events] of byYear) {
    const said = tellYear(world, year, events, whole).filter((t) => t.worth >= KIND_WORTH);
    if (said.length) told.set(year, said);
  }
  const annals: Annals = {
    stamp,
    count: n,
    now: Math.floor(world.now / YEAR),
    years: [...told.keys()].sort((a, b) => a - b),
    told,
    words: new Map(),
  };
  KEPT.set(world, annals);
  return annals;
}

/** A year's mask: a bit for each kind told, and one if it says something with no filter. */
function maskOf(lines: readonly Told[]): number {
  let m = 0;
  for (const t of lines) {
    m |= 1 << t.kind;
    if (t.worth >= ALL_WORTH) m |= ANNAL_ALL;
  }
  return m;
}

/** Which years have something told. */
export function annalsIndex(world: World): AnnalsIndex {
  const a = annalsOf(world);
  return {
    now: Math.floor(world.now / YEAR),
    years: a.years,
    masks: a.years.map((y) => maskOf(a.told.get(y)!)),
  };
}

/** A line's words; a line whose event has since been forgotten says what the explainer keeps of it. */
function wordsOf(world: World, t: Told, year: number): Line {
  try {
    return t.say();
  } catch {
    const claim = why(world, t.ref as HistoryEvent["id"]).claim;
    return [ended(sentence(withoutYear(claim, year)))];
  }
}

/** What a few years say. Kept once said, so a thumb going back and forth reads nothing twice. */
export function annalsRead(world: World, years: readonly number[]): AnnalYear[] {
  const was = KEPT.get(world),
    // (While the world runs on, a page already open reads on from what was read: it asks again for what is new.)
    a = was && was.count <= world.events.count ? was : annalsOf(world);
  return years.slice(0, 240).flatMap((year) => {
    const kept = a.words.get(year);
    if (kept) return [kept];
    const lines = a.told.get(year);
    if (!lines) return [];
    const said: AnnalYear = {
      year,
      lines: lines.map((t) => ({
        kind: t.kind,
        worth: t.worth,
        ref: t.ref,
        line: wordsOf(world, t, year),
      })),
    };
    a.words.set(year, said);
    return [said];
  });
}

/** Names as words, the last with "and", past three a count. */
function listed(names: readonly Span[]): Span[] {
  const shown = names.slice(0, 3),
    more = names.length - shown.length;
  return shown.flatMap((s, i): Span[] => [
    ...(i === 0 ? [] : i === shown.length - 1 && !more ? [" and "] : [", "]),
    s,
    ...(more && i === shown.length - 1 ? [` and ${told(more, "more", "more")}`] : []),
  ]);
}

/** The most lines a run's note tells. */
const RUN_LINES = 3;

/**
 * What the years from one moment to another came to: the realms that fell, then the greatest of what else
 * the years themselves tell, with the year of each. Null: nothing worth a person's time.
 */
export function runTold(world: World, from: number, to: number): RunTold | null {
  const a = annalsOf(world),
    first = Math.floor(from / YEAR),
    last = Math.floor(to / YEAR),
    fell: Span[] = [],
    all: { t: Told; year: number }[] = [];
  let fellRef: string | null = null,
    began = 0,
    over = 0;
  for (const year of a.years) {
    if (year <= first || year > last) continue;
    for (const t of a.told.get(year)!) {
      if (t.fell) {
        fell.push(...t.fell);
        fellRef ??= t.ref;
        continue;
      }
      if (t.key === "war.declared") began++;
      if (t.key === "war.peace") over++;
      if (t.worth >= ALL_WORTH) all.push({ t, year });
    }
  }
  const lines: { line: Line; ref: string | null }[] = [];
  if (fell.length)
    lines.push({
      line: capital([`${told(fell.length, "realm", "realms")} fell: `, ...listed(fell), "."]),
      ref: fellRef,
    });
  const seen = new Set<string>();
  for (const { t, year } of all
    .filter(({ t }) => t.key !== "war.declared" && t.key !== "war.peace")
    .sort((x, y) => y.t.worth - x.t.worth || y.year - x.year)) {
    if (lines.length >= RUN_LINES) break;
    // (Two lines of one kind would read as one: the greatest, and on to something else.)
    if (seen.has(t.key) && t.key !== "first") continue;
    seen.add(t.key);
    lines.push({ line: [`${year}: `, ...wordsOf(world, t, year)], ref: t.ref });
  }
  if (lines.length < RUN_LINES && began + over)
    lines.push({
      line: capital([
        began && over
          ? `${told(began, "war", "wars")} began and ${said(over)} ended.`
          : began
            ? `${told(began, "war", "wars")} began.`
            : `${told(over, "war", "wars")} ended.`,
      ]),
      ref: "world:ledger#wars",
    });
  if (!lines.length) return null;
  return { from: first, to: last, years: last - first, lines };
}

/** How many years are told, of how many, and each kind's own count: for a tally. */
export function annalsTally(world: World) {
  const a = annalsOf(world),
    out = new Map<number, { key: string; worth: number; kind: number }[]>();
  for (const [y, t] of a.told)
    out.set(
      y,
      t.map((x) => ({ key: x.key, worth: x.worth, kind: x.kind })),
    );
  return out;
}
