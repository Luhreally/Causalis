// A town's cases (J1, classic 52, 78, 99 and 154): who was brought before whoever judges there, for what, why, and what came of it. It reads, it
// never touches: nothing here is kept in the world and nothing it says flows back. A case is a reading, as a home or a person's day is: drawn by a
// stream from its town, its year and its number, of what the record holds of the year before (a land's fed and its market's book for that year, the
// battles and strikes that fell by then, the law as it stood then), so the same town and the same year tell the same cases each time they are read,
// from the first day of the year to long after. Slow things the record keeps no year of (a realm's standing, what it skims, a land's grievance) are
// read in bands, so they turn a year's list only if they cross one in that year.
//
// Those named are the town's own: holders of its lines (`folk:`), the ones its homes and its battles' rolls name, or under the god's hand, its
// `agent:`s. A plan draws whoever a case of this year or last names, so one tried is someone you can go and find. One who has since died keeps their
// case: its page says so. A case can't kill: the roster holds its dead by what history did, and a reading doesn't get to add to them.
//
// What a crime is and what comes of it is who they are: a hive tries no one, it turns from them; a people with no written word has its old ones; a
// water people has no cell; a realm that binds its condemned sends them to the works; custom has its kin and a blood-price; one law for all, a bench
// of the town's own, who can find a person not guilty. Only ever what happened, who and why: never how it was done.
//
// Its grave matters (2026-11-17) are host/inspect/grave.ts's: the killings its land's rows keep, what a group that holds it lives on, what
// its realm forbids, those of a circle it has outlawed, a spy found out, a boss taken. Each stands on a row, a record or an event the world
// keeps, is told first and marked, and may end as no small wrong does: in death (never for one of the town's lines: a reading can't kill),
// long years, the works, a mark for life, being sent out of the realm; in one let go because those who judged were paid or no one dared
// speak, only where a group or a crew holds the town; in a pardon; or with no one brought at all. They are drawn after the small wrongs.
import { notablesIn } from "./notables.ts";
import { lawBodiesRows } from "./bodies.ts";
import { courtIn as courtHeldRow } from "../../sim/index.ts";
import { finish, hashString, mix, type Ref, type World } from "../../kernel/index.ts";
import { meansOfWorld } from "../../gen/index.ts";
import {
  DAY_WAGE,
  FAMILY_SIZE,
  G,
  GOODS,
  OCC,
  RENT_DAY,
  priceTerm,
  reckonDay,
  usualPrice,
  wageTimes,
  CRIME_KINDS,
  CRIME_WORDS,
  crimeLean,
  leanWord,
  type CrimeKind,
  type CrimeScene,
} from "../../rules/index.ts";
import {
  BOND,
  KILLING,
  cartelOf,
  agentName,
  beliefOf,
  handOf,
  homePlanet,
  lawOf,
  lifeOf,
  loreOf,
  marketsOf,
  orderOf,
  politiesOf,
  populationContext,
  realmName,
  underworldOf,
  warsOf,
  type Polity,
  type RealmOrder,
  type Settlement,
} from "../../sim/index.ts";
import { streetInTownOf } from "../../sim/index.ts";
import { JUDGED, ROOF } from "../../rules/index.ts";
import { cellRef } from "../../gen/index.ts";
import { townUnderworldBlocks } from "./mobs.ts";
import { townRolesOf } from "./townlife.ts";
import {
  GRAVE_KIND,
  GRAVE_NAMES,
  cameOfGrave,
  chiefTown,
  graveRead,
  unansweredWhy,
  type CourtRead,
  type Draft,
  type GraveOffence,
  type Outcome,
} from "./grave.ts";
import { agentDeath } from "../death.ts";
import { groupOf } from "../underworld.ts";
import { orgOf } from "../groups.ts";
import type {
  Block,
  CourtForm,
  CourtSentence,
  Item,
  Line,
  PageModel,
  Span,
  Stat,
  Tab,
  TownCourt,
} from "../../bridge/index.ts";
import { landStone } from "../chain.ts";
import { breadCoin, homeNumberOf, landMadeHead, personLiving, dwellRef } from "../home.ts";
import { folkWork, levyHead, linesOf, rosterCost, townRoster, workOf } from "../roster.ts";
import { landPast } from "../past.ts";
import { keyedStanding, leanThen, type SelfRead } from "../self.ts";
import { goodCoin, goodName, boardRef } from "./board.ts";
import { coinWords } from "./living.ts";
import { memoryOf } from "./memory.ts";
import { landLink, realmLink, townLink } from "./names.ts";
import { count, item, link, many, part, sentence, stat, yearNow } from "./words.ts";

/** What a town's court hears most days: the small wrongs of those who live there. */
export type Petty =
  | "stores"
  | "bread"
  | "rent"
  | "stall"
  | "house"
  | "road"
  | "loot"
  | "desert"
  | "brawl"
  | "speech"
  | "faith"
  | "flight"
  | "poach"
  | "fence";
/** All a court hears: the small wrongs, and the grave matters the world keeps (host/inspect/grave.ts). */
export type Offence = Petty | GraveOffence;

/** One of a town named in a case: their page, their name, as old as they were then. */
export type Party = {
  /** Not one of the town's lines: a group's own, its head, a spy, an officer. Their ref is the page that tells of them; no age is kept. */
  readonly outside?: boolean;
  readonly ref: string;
  readonly name: string;
  readonly age: number;
  readonly sex: number;
  readonly work: string;
  readonly line: number;
};

export type Case = {
  readonly ref: string;
  readonly town: string;
  readonly year: number;
  readonly index: number;
  /** The day it is heard (days since the world began). */
  readonly day: number;
  readonly offence: Offence;
  readonly accused: Party;
  readonly wronged: Party | null;
  /** What they did, after their name ("took food from the town's store"). */
  readonly what: Line;
  readonly whatWords: string;
  /** Why: each true of this town this year, and where it can be followed. */
  readonly why: readonly Line[];
  readonly form: CourtForm;
  readonly sentence: CourtSentence;
  /** What came of it, after their name; what it cost; how many days it is seen for. */
  readonly came: string;
  readonly cost: string;
  readonly days: number;
  /** A grave matter (host/inspect/grave.ts): told first, and marked. */
  readonly grave: boolean;
  /** What came of a grave matter, wider than what the town's day shows of it. */
  readonly outcome?: Outcome;
  /** The group it is of, the event of history it stands on, one killed whom the world keeps by name. */
  readonly group?: { readonly ref: string; readonly name: string };
  readonly event?: string;
  readonly victim?: { readonly name: string; readonly ref: string };
  /** Brought before this court the year before, and known to it. */
  readonly repeat?: boolean;
};

/** A killing no one was brought for: what the land's rows keep of it, and why no one answered. */
export type Open = {
  readonly ref: string;
  readonly town: string;
  readonly year: number;
  readonly index: number;
  readonly day: number;
  /** What happened ("Someone killed …"), and why no one was brought. */
  readonly what: Line;
  readonly whatWords: string;
  readonly unanswered: string;
  readonly why: readonly Line[];
  readonly group?: { readonly ref: string; readonly name: string };
  readonly victim?: { readonly name: string; readonly ref: string };
};

/** A town's year before its court: its cases, the killings no one answered for, and the killing by the numbers. */
export type Docket = {
  readonly cases: readonly Case[];
  readonly open: readonly Open[];
  /** Those killed in the town in the year by its land's rows, and how many of them someone was brought for. */
  readonly killed: number;
  readonly answered: number;
  /** The sentences of earlier years still running as the year begins: who is held, and by which case. */
  readonly running: readonly Case[];
};

const MOST_CASES = 14;
/** The grave matters a year's book tells one by one (the rest are in its numbers). */
const MOST_GRAVE = 7;
const MOST_OPEN = 3;
const DAYS_A_YEAR = 365;
/** Lines a case's people are drawn from: those any device draws first. */
const POOL = 40;
/** How many years a case is still told. */
export const CASE_YEARS = 2;

const OCC_WORD: Readonly<Record<number, string>> = {
  [OCC.forager]: "forager",
  [OCC.farmer]: "farmer",
  [OCC.herder]: "herder",
  [OCC.crafter]: "crafter",
  [OCC.trader]: "trader",
  [OCC.leader]: "headman",
};

const u = (h: number, n: number): number => finish(mix(h, n), 13) / 4294967296;
const pct = (x: number): number => Math.round(x * 100);
const NUMBER = [
  "no",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
];
const spoken = (n: number): string => NUMBER[n] ?? count(n);
const monthsWords = (days: number): string => {
  if (days >= 700) return "two years";
  if (days >= 350) return "a year";
  const m = Math.round(days / 30);
  return m <= 1 ? "a month" : `${spoken(m)} months`;
};

// —— What the record holds of a town's year ——————————————————————————————————————————————————

type Cause = {
  readonly line: Line;
  readonly weight: number;
  readonly offences: readonly Petty[];
};

type Facts = {
  readonly s: Settlement;
  readonly year: number;
  readonly realm: Polity | undefined;
  readonly order: RealmOrder | undefined;
  readonly justice: number;
  readonly land: number;
  readonly form: CourtForm;
  readonly far: boolean;
  readonly grips: boolean;
  readonly water: boolean;
  readonly coined: boolean;
  readonly bread: number;
  readonly food: string;
  readonly store: string;
  readonly causes: readonly Cause[];
  readonly rate: number;
  readonly convicts: boolean;
  readonly corrupt: boolean;
  readonly strict: boolean;
  /** The town's year as what could lead one of it wrong reads it (rules/self.ts crimeLean); its realm forbids its faith. */
  readonly scene: CrimeScene;
  /** How organised those who carry what its realm forbids are (round B, 0 … 1). */
  readonly cartel: number;
  readonly barred: boolean;
  /** What weighs on its peace, all told (0.5 a quiet year), and each of it by name. */
  readonly weigh: number;
  readonly pressing: readonly (readonly [string, number])[];
  /** Its realm's law of faith as it stood (-1: no realm), and what the land makes and trades that can be carried off. */
  readonly faithLaw: number;
  readonly goods: readonly string[];
  /** Where in the town a thing can be said to have happened: its market, the quarters of its plan. */
  readonly places: readonly string[];
};

/** What the people of a world are, for their law: a hive, of the water, no hands. */
export function peopleLaw(world: World): {
  readonly hive: boolean;
  readonly water: boolean;
  readonly grips: boolean;
} {
  const g = homePlanet(world).generated,
    body = g.life.people?.body,
    means = meansOfWorld(g);
  return {
    // (As their homes are read, rules/designs.ts: a large close-knit people is not a hive.)
    hive: (body?.social ?? 0) >= 0.9 && (body?.size ?? 100) < 100 && body?.medium !== "water",
    water: body?.medium === "water",
    grips: means.grips,
  };
}

/** The law of a kind as it stood in a year: a law's last change after that year is taken back. */
function lawThen(world: World, order: RealmOrder, law: "land" | "justice" | "faith", year: number) {
  const k = law === "land" ? 0 : law === "faith" ? 2 : 3,
    event = order.lawEvents[k],
    e = event ? world.events.get(event) : undefined,
    now = lawOf(order, law).position;
  if (!e) return now;
  const changed = Math.floor(e.t / (DAYS_A_YEAR * 86400));
  return changed >= year ? (((e.data as { from?: number } | null)?.from ?? now) as number) : now;
}

function factsOf(world: World, s: Settlement, year: number): Facts {
  const ctx = populationContext(world),
    cell = s.cell,
    realms = politiesOf(world),
    realm = realms.of(cell),
    order = realm ? orderOf(world)?.of(realm.ref) : undefined,
    who = peopleLaw(world),
    writing = loreOf(world).effect(cell, "writing") > 0,
    justice = order ? lawThen(world, order, "justice", year) : -1,
    land = order ? lawThen(world, order, "land", year) : -1,
    far = !!loreOf(world).get(cell, "fusion-power"),
    form: CourtForm = who.hive
      ? "hive"
      : who.water
        ? "reef"
        : !writing || !realm
          ? "elders"
          : justice <= 0
            ? "kin"
            : justice === 1
              ? "magistrate"
              : "bench",
    past = landPast(world, cell),
    market = marketsOf(world).get(cell),
    book = market?.years.find((y) => y.year === year - 1) ?? market?.years.at(-1),
    older = market?.years.find((y) => y.year === year - 4) ?? market?.years[0],
    grain = book?.price[G.grain] ?? usualPrice(G.grain),
    wasGrain = older?.price[G.grain] ?? grain,
    bread = breadCoin(grain),
    coined = goodCoin(world, grain, G.grain) > 0,
    ledger = ctx.history.yearsOf(cell),
    rec = ledger.findLast((y) => y.year <= year - 1),
    fed = rec ? rec.fed / 1000 : 1,
    // (Its leanest month, over the ten years before: at a far age a land may never eat all it needs, and a lean year is one worse than that.)
    before = ledger.filter((y) => y.year < year - 1 && y.year >= year - 11),
    usualFed = before.length ? before.reduce((n, y) => n + y.fed, 0) / before.length / 1000 : 1,
    food = who.water ? "food" : past?.covered ? "vat-bread" : "bread",
    storeWord = who.water
      ? "the town's food store"
      : past?.covered
        ? "the store of the vats"
        : "the town's grain store",
    causes: Cause[] = [];

  const m = memoryOf(world),
    deeds = m.byCell.get(cell) ?? [],
    hunger = deeds.findLast((d) => d.kind === "hunger" && d.year < year && d.year >= year - 2),
    plague = deeds.findLast((d) => d.kind === "plague" && d.year < year && d.year >= year - 2),
    rising = deeds.findLast((d) => d.kind === "rising" && d.year < year && d.year >= year - 4),
    coup = realm
      ? (m.byRealm.get(realm.ref) ?? []).findLast(
          (d) => d.kind === "coup" && d.year < year && d.year >= year - 4,
        )
      : undefined;

  // Hungry.
  let hungry = 0;
  if (hunger) {
    hungry = 1;
    causes.push({
      line: [
        "Their land went hungry: ",
        link(`the hunger of year ${hunger.year}`, hunger.id),
        ", and the stores were all there was.",
      ],
      weight: 2.4,
      offences: ["stores", "bread"],
    });
  } else if (fed < 0.97 && fed < usualFed - 0.03) {
    hungry = Math.min(1, (Math.min(0.97, usualFed) - fed) * 6);
    causes.push({
      line: [
        `It was a lean year. `,
        landLink(world, cell, true),
        ` ate ${pct(fed)} in a hundred of what it needed, at its leanest.`,
      ],
      weight: 0.4 + 2 * hungry,
      offences: ["stores", "bread"],
    });
  } else if (fed < 0.97) {
    // (Not a lean year: only what this land is, every year before the harvest.)
    causes.push({
      line: [
        landLink(world, cell, true),
        ` runs short every year before the harvest: at its leanest it ate ${pct(fed)} in a hundred of what it needed.`,
      ],
      weight: 0.45,
      offences: ["bread", "stall"],
    });
  }
  if (plague) {
    causes.push({
      line: [
        "A sickness had been through their land: ",
        link(plague.what ?? "the sickness", plague.whatRef ?? plague.id),
        ", and those it took left homes with no one earning.",
      ],
      weight: 0.5,
      offences: ["bread", "house"],
    });
  }

  // Dear: what a day's food costs, against three years before.
  const rise = wasGrain > 0 ? grain / wasGrain : 1,
    wasBread = breadCoin(wasGrain),
    costLine = (a: number): string =>
      coined ? `${coinWords(a)} coin` : `${coinWords(a / Math.max(0.1, bread))} days' food`;
  if (rise >= 1.3 && coined)
    causes.push({
      line: [
        `A day's ${food} had gone from ${costLine(wasBread)} to ${costLine(bread)} in three years: `,
        link("the price board", boardRef(s.ref)),
        ".",
      ],
      weight: Math.min(2, 0.6 + (rise - 1.3) * 1.5),
      offences: ["stores", "bread", "stall"],
    });

  // Short: what a poor home earns against what it must pay. Rent where the land's law has it.
  const made = landMadeHead(world, cell),
    wage = (DAY_WAGE[OCC.farmer] ?? 3) * priceTerm(grain / GOODS[G.grain]!.value),
    lets = !who.hive && land >= 0 && land < 2,
    poorDay = reckonDay({
      wages: wage,
      bread,
      mouths: FAMILY_SIZE,
      madeHead: made,
      standing: 0.12,
      court: false,
      rent: lets ? RENT_DAY : 0,
    }),
    usual = wageTimes(made, 0.5, false),
    richEarned = wage * 2 * wageTimes(made, 0.92, false),
    dear = grain / Math.max(0.01, usualPrice(G.grain));
  const short = coined && poorDay.left < 0;
  if (short && lets)
    causes.push({
      line: [
        `A poor home here earns ${coinWords(poorDay.earned)} coin a day, and owes ${coinWords(poorDay.fed)} for ${food} and ${coinWords(poorDay.rent)} in rent: `,
        link("the price board", boardRef(s.ref)),
        ".",
      ],
      weight: 1.1,
      offences: ["rent", "bread"],
    });
  else if (short)
    causes.push({
      line: [
        `A poor home here earns ${coinWords(poorDay.earned)} coin a day, and its ${food} comes to ${coinWords(poorDay.fed)}: `,
        link("the price board", boardRef(s.ref)),
        ".",
      ],
      weight: 0.8,
      offences: ["bread", "stall"],
    });

  // Rich: a town whose land makes much, with its poorer streets beside its richer. A poor one robs on the road.
  const rich = usual >= 1.25 || (s.market !== null && s.market !== undefined && usual >= 1),
    carried =
      (book?.ledger[2]?.reduce((a, b) => a + b, 0) ?? 0) +
      (book?.ledger[3]?.reduce((a, b) => a + b, 0) ?? 0);
  if (rich)
    causes.push({
      line: [`There is money in `, townLink(world, s.ref), `, and it isn't everyone's.`],
      weight: 0.9,
      offences: ["stall", "house"],
    });
  else
    causes.push({
      line: [
        `There is little to be had in `,
        townLink(world, s.ref),
        carried > 0
          ? `, and what there is goes by on the road.`
          : `, and everyone knows who has it.`,
      ],
      weight: carried > 0 ? 0.8 : 0.35,
      offences: carried > 0 ? ["road", "bread"] : ["bread"],
    });

  // A quiet year's cause, true of anywhere with a street better off than the next.
  causes.push({
    line: coined
      ? [
          `Some streets here do better than others: a rich home brings in ${coinWords(richEarned)} coin a day, and a poor one ${coinWords(poorDay.earned)}.`,
        ]
      : [`Some here eat better than others, and everyone can see who.`],
    weight: 0.3,
    offences: ["house", "stall", "brawl"],
  });

  // War: looters where it fell, deserters where it took men.
  let war = 0;
  if (realm) {
    const wars = warsOf(world)
      .fighting(realm.ref)
      .filter((w) => w.ended === null || w.ended >= year - 1);
    for (const w of wars) {
      const near = w.battles.findLast(
          (b) => b.land === cell && b.year < year && b.year >= year - 2,
        ),
        any = w.battles.findLast((b) => b.year < year && b.year >= year - 3);
      if (near) {
        war = Math.max(war, 1);
        causes.push({
          line: [
            "The war came to their land: ",
            link(`the fighting of year ${near.year}`, near.event),
            ", and homes stood empty after it.",
          ],
          weight: 1.5,
          offences: ["loot"],
        });
      }
      if (any) {
        war = Math.max(war, 0.5);
        causes.push({
          line: ["The levy was called for ", link("their realm's war", w.ref), "."],
          weight: 0.7,
          offences: ["desert"],
        });
      }
    }
  }
  const raid = strikesOn(world, s.ref).findLast(
    (k) => k.dead > 0 && k.year < year && k.year >= year - 2,
  );
  if (raid) {
    war = Math.max(war, 1);
    causes.push({
      line: [
        "Fire had fallen on the town: ",
        link(`the raid of year ${raid.year}`, raid.event),
        `, and ${count(raid.homes)} homes lay open.`,
      ],
      weight: 1.8,
      offences: ["loot"],
    });
  }

  // Grievance and doubt: in bands, these are not kept by year.
  const grievance = realm ? realms.discontent(cell) : null,
    angry = (grievance?.level ?? 0) >= 0.35;
  if (angry)
    causes.push({
      line: [
        `Grievance ran high here: `,
        ...(grievance!.cause
          ? [link("what they had against their rule", grievance!.cause)]
          : ["everyone knew why"]),
        ".",
      ],
      weight: 0.9,
      offences: ["brawl", "speech"],
    });
  if (rising)
    causes.push({
      line: [
        "Their land had lately risen: ",
        link(`the rising of year ${rising.year}`, rising.id),
        ".",
      ],
      weight: 0.8,
      offences: ["speech", "brawl"],
    });
  if (coup)
    causes.push({
      line: [
        "The seat had lately been seized: ",
        link(`what happened in year ${coup.year}`, coup.id),
        ".",
      ],
      weight: 0.5,
      offences: ["speech"],
    });
  const doubted = !!order && order.legitimacy < 0.42;
  if (order && realm && doubted && form !== "hive")
    causes.push({
      line: [
        "Few here hold the rule of ",
        realmLink(world, realm.ref),
        " rightful, and some say so aloud.",
      ],
      weight: 0.7,
      offences: ["speech"],
    });

  // One faith: a land of another under a realm that allows none.
  let barred = false;
  if (order && realm && form !== "hive" && lawThen(world, order, "faith", year) === 0) {
    const here = beliefOf(world).of(cell).faith,
      seat = beliefOf(world).of(realm.seat).faith;
    barred = !!here && !!seat && here !== seat;
    if (barred)
      causes.push({
        line: [
          "Their realm keeps one faith, and this land keeps another: ",
          link("its law of faith", realm.ref),
          ".",
        ],
        weight: 0.9,
        offences: ["faith"],
      });
  }

  // The bound: a land that holds them has those who leave.
  const store = orderOf(world),
    bound = store?.bound(cell) ?? 0;
  if (order && store && bound >= 0.02 && order.abolished === null)
    causes.push({
      line: [
        `${pct(bound)} in a hundred of those in `,
        landLink(world, cell, true),
        ` are held bound, and some of them don't stay: `,
        link("what bound them", store.land(cell)?.cause ?? realm?.ref ?? null),
        ".",
      ],
      weight: 0.4 + 2 * bound,
      offences: ["flight"],
    });

  // Those without a roof: on the street, the poorest want is the nearest at hand (the society sweep, society/roofless.ts), read in
  // twentieths so a year turns the list only if it crosses one.
  const roofless = Math.round(20 * streetInTownOf(world, cell)) / 20;
  if (roofless >= 0.05)
    causes.push({
      line: [
        `${pct(roofless)} in a hundred of its people have no roof and no one to take them in: `,
        link("who is without a roof", cellRef(0, cell)),
        ".",
      ],
      weight: 0.4 + 3 * roofless,
      offences: ["stores", "bread", "stall"],
    });

  // The lord's land: its woods and its game are his, and some take of them. (Where the land's law is the lord's.)
  if (realm && order && land === 0 && !who.hive && !who.water)
    causes.push({
      line: [
        "The land here is the lord's, its woods and its game with it: ",
        link("its law of land", order.lawEvents[0] ?? realm.ref),
        ".",
      ],
      weight: 0.45,
      offences: ["poach"],
    });
  // The law of land lately moved toward the lord: those it took ground from don't all leave it.
  if (realm && order && !who.hive && !who.water) {
    const e = order.lawEvents[0] ? world.events.get(order.lawEvents[0]) : undefined,
      changed = e ? Math.floor(e.t / (DAYS_A_YEAR * 86400)) : -1,
      from = (e?.data as { from?: number } | null)?.from;
    if (e && changed < year && changed >= year - 10 && from !== undefined && from > land)
      causes.push({
        line: [
          `The law of land was changed in year ${changed}, and ground that had been its tillers' was not theirs after: `,
          link("the law as it was made", e.id),
          ".",
        ],
        weight: 0.8,
        offences: ["fence"],
      });
  }

  // What the land makes and trades that a hand can carry off, and where in the town a thing can happen.
  const madeLine = book?.ledger[0] ?? [],
    goods = madeLine
      .map((n, good) => ({ n: n * (GOODS[good]?.value ?? 1), good }))
      .filter((x) => x.n > 0 && x.good !== G.grain && x.good !== G.meat && x.good !== G.wild)
      .sort((a, b) => b.n - a.n || a.good - b.good)
      .slice(0, 4)
      .map((x) => goodName(world, x.good)),
    places = who.water
      ? ["by the reef post", "at the edge of the reef"]
      : [
          ...(s.market ? ["at the market", "behind the market"] : ["in the square"]),
          "by the water",
          "on the high ground",
          "by the way in to the town",
          "on the lee side of the town",
        ];

  // How many: by its size and what weighs on it; a loose law more, one law for all fewer. Sizes in half-steps, so a year's growth doesn't move them.
  const size = Math.round(2 * Math.log10(Math.max(10, s.population))) / 2,
    loose = !realm ? 0.25 : order && order.legitimacy < 0.42 ? 0.35 : 0,
    strictLaw = justice === 2 ? -0.3 : 0,
    weigh =
      0.5 +
      1.5 * hungry +
      0.9 * war +
      // (Its people on the street, read in twentieths as slow things are: the society sweep, society/roofless.ts.)
      ROOF.crime * roofless +
      (short ? 0.5 * Math.max(0, Math.min(1, (dear - 0.8) / 1.2)) : 0) +
      (rich ? 0.3 : 0) +
      (angry ? 0.4 : 0) +
      loose +
      strictLaw,
    // (Each of what weighs on it by name, for the underworld lens, host/inspect/underworld.ts: the sum above left as it was
    // added, so no town's count of cases moves by a rounding.)
    pressing: readonly (readonly [string, number])[] = [
      ["a hungry year", 1.5 * hungry],
      ["war and fire", 0.9 * war],
      ["its people on the street", ROOF.crime * roofless],
      ["dear bread on a poor wage", short ? 0.5 * Math.max(0, Math.min(1, (dear - 0.8) / 1.2)) : 0],
      ["money in the town", rich ? 0.3 : 0],
      ["grievance against its rule", angry ? 0.4 : 0],
      ["a law that reaches little", loose],
      ["a strict law", strictLaw],
    ],
    // (And a town's own temper: some keep the peace better than their neighbours, year on year.)
    temper = 0.55 + 1.2 * u(hashString(`temper ${s.ref}`) >>> 0, 1),
    rate = Math.max(0.25, (size - 1) * 0.7) * Math.max(0.25, weigh) * temper;

  const convicts =
      !!order &&
      (order.firsts[BOND.convict] ?? null) !== null &&
      form !== "hive" &&
      form !== "reef",
    // (How far its law reaches: who judges, how rightful the rule they judge for, what is skimmed from it.)
    legit = order ? order.legitimacy : 0.5,
    // (Where its realm forbids what its people take and those who carry it are organised (round B's cartel), they buy and
    // frighten the law's men, and what they carry is to hand: the law reaches less, and there is more to be had.)
    cartel = realm ? cartelOf(world, realm.ref) : 0,
    reach = Math.max(
      0,
      Math.min(
        1,
        REACH[form] * (realm ? 0.6 + 0.8 * legit : 0.6) -
          0.4 * (order?.corruption ?? 0) -
          0.3 * cartel +
          (order && order.caste >= 0.45 ? 0.1 : 0),
      ),
    ),
    scene: CrimeScene = {
      hungry,
      short,
      opportunity: Math.min(
        1,
        (rich ? 0.45 : 0.15) + (carried > 0 ? 0.2 : 0) + 0.35 * war + 0.2 * cartel,
      ),
      reach,
      grievance: Math.min(
        1,
        (grievance?.level ?? 0) + (doubted ? 0.25 : 0) + (rising ? 0.2 : 0) + (coup ? 0.1 : 0),
      ),
    };
  return {
    s,
    year,
    realm,
    order,
    justice,
    land,
    form,
    far,
    grips: who.grips,
    water: who.water,
    coined,
    bread,
    food,
    store: storeWord,
    causes,
    rate,
    convicts,
    corrupt: !!order && order.corruption >= 0.3,
    strict: !!order && order.caste >= 0.45,
    scene,
    barred,
    cartel,
    weigh,
    pressing,
    faithLaw: order ? lawThen(world, order, "faith", year) : -1,
    goods,
    places,
  };
}

/** How far a court's word reaches by who judges, before how rightful its rule is: a hive knows all of its own at once. */
const REACH: Readonly<Record<CourtForm, number>> = {
  hive: 0.9,
  reef: 0.5,
  elders: 0.35,
  kin: 0.4,
  magistrate: 0.6,
  bench: 0.75,
};

/** What each wrong a court hears is, of the four that lead a person wrong (rules/self.ts). */
export const OFFENCE_KIND: Readonly<Record<Offence, CrimeKind>> = {
  ...GRAVE_KIND,
  poach: "steal",
  fence: "defy",
  stores: "steal",
  bread: "steal",
  rent: "cheat",
  stall: "steal",
  house: "steal",
  road: "steal",
  loot: "steal",
  desert: "defy",
  brawl: "harm",
  speech: "defy",
  faith: "defy",
  flight: "cheat",
};

/** Of so many drawn of a town, the one brought: the likelier the more they lean to it (`d` a unit of the case's own). */
function weighed<T>(found: readonly T[], weigh: ((x: T) => number) | undefined, d: number): T {
  if (!weigh || found.length === 1) return found[0]!;
  const w = found.map((x) => Math.max(0.01, weigh(x))),
    all = w.reduce((a, b) => a + b, 0);
  let v = d * all;
  for (let i = 0; i < found.length; i++) {
    v -= w[i]!;
    if (v < 0) return found[i]!;
  }
  return found.at(-1)!;
}

/** Of a town's people, how many are drawn for a case before the one brought is chosen among them by how they lean. */
const PICK_FROM = 6;

/** A town's strikes, by town, once for each count of a world's strikes. */
const STRIKES = new WeakMap<
  World,
  { n: number; by: Map<string, ReturnType<ReturnType<typeof warsOf>["allStrikes"]>[number][]> }
>();
function strikesOn(world: World, town: string) {
  const all = warsOf(world).allStrikes();
  let kept = STRIKES.get(world);
  if (!kept || kept.n !== all.length) {
    const by = new Map<string, (typeof all)[number][]>();
    for (const k of all) {
      const l = by.get(k.town);
      if (l) l.push(k);
      else by.set(k.town, [k]);
    }
    STRIKES.set(world, (kept = { n: all.length, by }));
  }
  return kept.by.get(town) ?? [];
}

// —— Who ——————————————————————————————————————————————————————————————————————————————————————

/** How far one of a town leans to what a case is of, by their key and the year they were born. */
type Weigh = (key: number, born: number) => number;

type Folk = {
  readonly lines: number;
  /**
   * One of the town by a draw: someone grown who holds their place there that year (null: none). Weighed: of PICK_FROM drawn, the
   * one brought the likelier the more they lean to it.
   */
  pick(h: number, n: number, not: ReadonlySet<string>, weigh?: Weigh): Party | null;
  /** One this battle's levy stood in (a deserter), by a draw. */
  levied(h: number, not: ReadonlySet<string>): Party | null;
  /** One named in an earlier year, as they are this year (null: no longer of the town's people). */
  still(p: Party): Party | null;
  /**
   * Those grown who hold the first `most` of its lines that year (under the hand, all its grown people), each by a number that
   * stays theirs (their line; under the hand, who they are): what a thing that keeps the same people year on year draws from
   * (host/inspect/townlife.ts).
   */
  slots(most: number): readonly FolkSlot[];
};
export type FolkSlot = {
  readonly id: number;
  readonly key: number;
  readonly born: number;
  readonly party: Party;
};

export function folkOf(world: World, s: Settlement, year: number, asLines = false): Folk {
  const ctx = populationContext(world),
    grown = lifeOf(world).adulthood,
    hand = handOf(world).resting;
  // Under the hand everyone in the town is someone: the hand's people. (`asLines`: its lines' holders even so, as before
  // the hand came to rest on it: whom one it was laid from was, by name.)
  if (!asLines && hand && hand.village === s.ref) {
    const list = hand.agents.filter((a) => year - a.birthYear >= grown);
    const party = (a: (typeof hand.agents)[number]): Party => ({
      ref: `agent:${a.id}`,
      name: agentName(ctx, a, s),
      age: year - a.birthYear,
      sex: a.sex,
      work: OCC_WORD[a.occupation] ?? "one of the town",
      line: a.id,
    });
    return {
      lines: list.length,
      pick: (h, n, not, weigh) => {
        if (!list.length) return null;
        const found: (typeof list)[number][] = [];
        for (let k = 0; k < 8 && found.length < (weigh ? PICK_FROM : 1); k++) {
          const a = list[Math.floor(u(h, n + k) * list.length)]!;
          if (!not.has(`agent:${a.id}`) && !found.includes(a)) found.push(a);
        }
        if (!found.length) return null;
        return party(
          weighed(
            found,
            weigh && ((a) => weigh(hashString(`agent ${s.ref} ${a.id}`) >>> 0, a.birthYear)),
            u(h, n + 40),
          ),
        );
      },
      levied: () => null,
      still: (p) => {
        const a = list.find((x) => `agent:${x.id}` === p.ref);
        return a ? party(a) : null;
      },
      slots: () =>
        list.map((a) => ({
          id: a.id,
          key: hashString(`agent ${s.ref} ${a.id}`) >>> 0,
          born: a.birthYear,
          party: party(a),
        })),
    };
  }
  const lines = linesOf(s.population),
    // (An earlier year's people are read from this year's roster, which knows who held each line then: a roster folded for
    // every year asked cost a great town a fifth of a second each. A year to come is folded as ever.)
    now = yearNow(world),
    roster = townRoster(world, s.ref, Math.max(year, now)),
    holds = (k: number) => (year >= now ? roster.holder(k) : roster.holderAt(k, year)),
    work = folkWork(world, s.cell),
    party = (h: NonNullable<ReturnType<typeof roster.holder>>): Party => ({
      ref: h.ref,
      name: roster.nameOf(h),
      age: year - h.born,
      sex: h.sex,
      work: OCC_WORD[workOf(h.key, work)] ?? "one of the town",
      line: h.line,
    });
  const pool = Math.min(lines, POOL);
  return {
    lines: pool,
    pick: (h, n, not, weigh) => {
      if (!pool) return null;
      const found: NonNullable<ReturnType<typeof roster.holder>>[] = [];
      for (let k = 0; k < 12 && found.length < (weigh ? PICK_FROM : 1); k++) {
        const holder = holds(Math.floor(u(h, n + k) * pool));
        if (!holder || year - holder.born < grown || not.has(holder.ref)) continue;
        if (found.some((x) => x.ref === holder.ref)) continue;
        found.push(holder);
      }
      if (!found.length) return null;
      return party(weighed(found, weigh && ((x) => weigh(x.key, x.born)), u(h, n + 40)));
    },
    levied: (h, not) => {
      const b = roster.battles.findLast((x) => x.year < year && x.year >= year - 3);
      if (!b) return null;
      const men = levyHead(roster, b.event, b.side, [0, 0, 8])[2];
      if (!men.length) return null;
      for (let k = 0; k < men.length; k++) {
        const m = men[(Math.floor(u(h, 40) * men.length) + k) % men.length]!,
          now = holds(m.line);
        if (now && now.n === m.holder.n && !not.has(now.ref) && year - now.born >= grown)
          return party(now);
      }
      return null;
    },
    still: (p) => {
      const now = holds(p.line);
      return now && now.ref === p.ref && year - now.born >= grown ? party(now) : null;
    },
    slots: (most) => {
      const out: FolkSlot[] = [];
      for (let k = 0; k < Math.min(lines, most); k++) {
        const h = holds(k);
        if (h && year - h.born >= grown)
          out.push({ id: k, key: h.key, born: h.born, party: party(h) });
      }
      return out;
    },
  };
}

// —— What they did, and what came of it ——————————————————————————————————————————————————————

const GRAVITY: Readonly<Record<Petty, 1 | 2 | 3>> = {
  poach: 2,
  fence: 2,
  stores: 2,
  bread: 1,
  rent: 1,
  stall: 1,
  house: 2,
  road: 3,
  loot: 3,
  desert: 3,
  brawl: 1,
  speech: 2,
  faith: 2,
  flight: 2,
};

/** What they did, in the chronicle's words: what happened, never how. */
function deedOf(f: Facts, o: Petty, w: Party | null, h: number): Line {
  const them: Span = w ? link(w.name, w.ref) : "a neighbour",
    pick = <T>(l: readonly T[]): T => l[Math.floor(u(h, 11) * l.length)]!,
    food = f.food,
    // (What was taken is what the land makes; where, a place of the town's own plan.)
    good = f.goods.length ? f.goods[Math.floor(u(h, 12) * f.goods.length)]! : "goods",
    at = f.places[Math.floor(u(h, 13) * f.places.length)] ?? "in the square";
  // (A hive keeps no stalls and pays no rent: what one of them can do is take more than their share, or not move with the rest.)
  if (f.form === "hive")
    switch (o) {
      case "stores":
        return [
          pick(["took more than their share from ", "kept back what they carried to "]),
          f.store,
        ];
      case "bread":
        return ["ate the share of ", them];
      case "rent":
        return ["kept back what they owed the store, and ", them, " went short"];
      case "stall":
        return ["took from the cells that ", them, " tends"];
      case "house":
        return ["took what ", them, " had laid by"];
      case "road":
        return ["took what ", them, " was carrying on the road"];
      case "loot":
        return ["took what could be carried from the burnt cells, among them the cell of ", them];
      case "desert":
        return ["left the muster and came home"];
      case "brawl":
        return ["turned on ", them, ", one of their own"];
      case "speech":
        return ["would not move when the rest of the town moved"];
      case "faith":
        return ["kept to a way of their own, apart from the rest"];
      case "flight":
        return ["left the cell they were bound to"];
      case "poach":
      case "fence":
        return ["took of what is kept for all"];
    }
  switch (o) {
    case "stores":
      return [
        pick([
          `took ${food} from ${f.store}`,
          `was found with ${food} from ${f.store}`,
          `carried off ${food} from ${f.store}`,
        ]),
        w ? ", which " : "",
        ...(w ? [them, " keeps"] : []),
      ];
    case "bread":
      return [
        pick([
          `took ${food} from the home of `,
          `stole a week's ${food} from `,
          `was caught with the ${food} of `,
        ]),
        them,
      ];
    case "rent":
      return f.land === 0
        ? ["kept back what was owed to the lord's man, ", them]
        : ["owed ", them, " a season's rent and left without paying"];
    case "stall":
      return f.s.market
        ? [
            pick([
              `stole ${good} from the market stall of `,
              `took ${good} from the stall of `,
              `was caught with ${good} from the stall of `,
            ]),
            them,
          ]
        : [pick([`stole ${good} from the store of `, `took ${good} from the workshop of `]), them];
    case "house":
      return [
        pick([
          "robbed the home of ",
          "took what was of worth from the home of ",
          "broke into the home of ",
        ]),
        them,
        u(h, 14) < 0.5 ? ` ${at}` : `, and carried off its ${good}`,
      ];
    case "road":
      return [
        "robbed ",
        them,
        pick([
          `, carrying ${good} on the road`,
          ", on the road out of town",
          ` of a load of ${good}`,
        ]),
      ];
    case "poach":
      return [
        pick([
          "took game from the lord's wood",
          "cut wood in the lord's wood without leave",
          "set their beasts to graze on the lord's meadow",
          "fished the lord's water",
        ]),
      ];
    case "fence":
      return [
        pick([
          "would not leave the ground the new law gave to the lord",
          "pulled down the fence put round what had been theirs to till",
          "ploughed ground the new law took from them",
        ]),
      ];
    case "loot":
      return [
        pick([
          "took what could be carried from the burnt homes, ",
          "was found with goods from the empty homes, ",
        ]),
        "among them the home of ",
        them,
      ];
    case "desert":
      return [pick(["left the levy and came home", "came home from the levy without leave"])];
    case "brawl":
      return [
        pick(["came to blows with ", "fought ", "set on "]),
        them,
        ` ${at}`,
        u(h, 14) < 0.35
          ? ", over a debt"
          : u(h, 14) < 0.6
            ? ", after a quarrel between their families"
            : "",
      ];
    case "speech":
      return [
        pick([
          "spoke against the ruler in the square",
          "said aloud what many think of the rule here",
        ]),
      ];
    case "faith":
      return [
        pick([
          "kept their land's own faith, where the law allows only the realm's",
          "led others in a faith the law doesn't allow",
        ]),
      ];
    case "flight":
      return [
        pick(["left the land they were bound to", "ran from the one who held their bond, "]),
        ...(w && u(h, 11) >= 0.5 ? [them] : []),
      ];
  }
}

const NEEDS_WRONGED: Readonly<Record<Petty, boolean>> = {
  poach: false,
  fence: false,
  stores: true,
  bread: true,
  rent: true,
  stall: true,
  house: true,
  road: true,
  loot: true,
  desert: false,
  brawl: true,
  speech: false,
  faith: false,
  flight: true,
};

/** What a wrong takes from those wronged that the better off have the more of. */
const ROBBED: Readonly<Partial<Record<Petty, boolean>>> = {
  stall: true,
  house: true,
  road: true,
};

/** What a court here can do, by what they did, how it holds and who they are. */
function sentenceOf(f: Facts, o: Petty, h: number): CourtSentence {
  const g = GRAVITY[o],
    v = u(h, 21),
    up = f.strict && u(h, 22) < 0.5 ? 1 : 0,
    at = Math.min(3, g + up);
  switch (f.form) {
    case "hive":
      return at === 1 ? "shame" : at === 2 ? "labour" : v < 0.6 ? "labour" : "banish";
    case "reef":
      return at === 1
        ? "fine"
        : at === 2
          ? v < 0.6
            ? "stocks"
            : "fine"
          : v < 0.6
            ? "banish"
            : "stocks";
    case "elders":
      return at === 1
        ? v < 0.7
          ? "fine"
          : "shame"
        : at === 2
          ? v < 0.7
            ? "shame"
            : "fine"
          : v < 0.55
            ? "banish"
            : "shame";
    case "kin":
      return at === 1
        ? "fine"
        : at === 2
          ? v < 0.55
            ? "stocks"
            : "fine"
          : v < 0.5
            ? "banish"
            : v < 0.8
              ? "stocks"
              : "fine";
    case "magistrate":
      if (f.corrupt && u(h, 23) < 0.14) return "bribe";
      if (at === 1) return v < 0.55 ? "fine" : "stocks";
      if (at === 2) return f.convicts && v < 0.4 ? "labour" : v < 0.6 ? "stocks" : "cell";
      return f.convicts && v < 0.65 ? "labour" : v < 0.8 ? "cell" : "banish";
    case "bench":
      if (u(h, 23) < 0.2) return "free";
      if (at === 1) return "fine";
      if (at === 2) return v < 0.55 ? "fine" : "cell";
      return f.convicts && v < 0.3 ? "labour" : "cell";
  }
}

/** How long a sentence is seen, in days; a fine is that day's. */
function daysOf(s: CourtSentence, g: number, h: number): number {
  const v = u(h, 24);
  switch (s) {
    case "stocks":
      return g >= 2 ? 3 : 2;
    case "cell":
      return Math.round(30 * (g * 2 + Math.floor(v * 3)));
    case "labour":
      return Math.round(30 * (g * 3 + Math.floor(v * 4)));
    case "banish":
      return 730;
    default:
      return 1;
  }
}

/** What came of it, as a sentence goes on from their name; and what it cost them. */
function cameOf(
  f: Facts,
  s: CourtSentence,
  g: number,
  days: number,
  h: number,
  /** Told differently from the others of its year: a little more, or in other words. */
  bump = 0,
): { came: string; cost: string } {
  const worth = g * (4 + Math.floor(u(h, 25) * 10)) + bump,
    amount = f.coined ? `${coinWords(worth * f.bread)} coin` : `${spoken(worth)} days' ${f.food}`,
    said = <T>(l: readonly T[]): T => l[bump % l.length]!,
    paid = f.coined
      ? `${coinWords(worth * f.bread)} coin, ${spoken(worth)} days' ${f.food} for one person`
      : `${spoken(worth)} days' ${f.food}`,
    term = monthsWords(days),
    hive = f.form === "hive",
    reef = f.form === "reef",
    noHands = !f.grips;
  switch (s) {
    case "free":
      return {
        came: said([
          "was found not guilty by the bench, and went home",
          "was found not guilty: the bench did not believe what was said of them",
          "was found not guilty, the bench being of two minds",
        ]),
        cost: "Nothing but the days it took, and what the neighbours say.",
      };
    case "bribe":
      return {
        came: said([
          "was let go, and it is said the magistrate was paid",
          "was let go before it was heard, and it is said the magistrate was paid",
        ]),
        cost: `${paid}, to no one who would say so.`,
      };
    case "fine":
      return f.form === "kin"
        ? {
            came: `paid a blood-price of ${amount} to those they wronged`,
            cost: `${sentence(paid)}.`,
          }
        : f.form === "elders" || reef
          ? {
              came: `was told to make it good, and gave over ${amount}`,
              cost: `${sentence(paid)}, handed over before everyone.`,
            }
          : { came: `was fined ${amount}`, cost: `${sentence(paid)}, paid at the bench.` };
    case "shame":
      return hive
        ? {
            came: said([
              "was turned from: for a season no one works beside them, or feeds them first",
              "was turned from: for a season they eat last, and work alone",
              "was turned from: until the next brood no one of the town goes near them",
            ]),
            cost: "A season alone among all of them.",
          }
        : {
            came: said([
              "was stood in the ring and named before everyone",
              "was named before the ring, and made to say what they had done",
              "was made to stand at the ring's edge through the whole meeting",
              "was named before everyone, and their family with them",
            ]),
            cost: "Nothing they could count. Everyone here knows it now.",
          };
    case "stocks":
      return reef
        ? {
            came: `was tied to the reef post for ${spoken(days)} days`,
            cost: `${spoken(days)} days' work, and everyone swam past.`,
          }
        : noHands
          ? {
              came: `was penned in the ring of stones for ${spoken(days)} days`,
              cost: `${spoken(days)} days' work, and everyone walked past.`,
            }
          : {
              came: `was put in the stocks in the square for ${spoken(days)} days`,
              cost: `${sentence(spoken(days))} days' work, and everyone walked past.`,
            };
    case "cell":
      return noHands
        ? {
            came: `was shut in the pit for ${term}`,
            cost: `${sentence(term)} of work, that their home went without.`,
          }
        : f.far
          ? {
              came: `was sealed in the town's holding room for ${term}`,
              cost: `${sentence(term)} of work, that their home went without.`,
            }
          : {
              came: `was locked in the town's cell for ${term}`,
              cost: `${sentence(term)} of work, that their home went without.`,
            };
    case "labour":
      return hive
        ? {
            came: `was sent to the far cells to work for ${term}`,
            cost: `${sentence(term)} of work for all, and none for their own.`,
          }
        : f.convicts
          ? {
              came: `was bound to the realm's works for ${term}`,
              cost: `${sentence(term)} at the works, unpaid, and their home went without.`,
            }
          : {
              came: `was set to labour for those they wronged for ${term}`,
              cost: `${sentence(term)} of work, unpaid.`,
            };
    case "banish":
      return hive
        ? {
            came: "was scented out: no one of the town will know them now",
            cost: "Their place among them, and everyone they knew.",
          }
        : reef
          ? {
              came: said([
                "was sent out on the current for two years",
                "was sent beyond the reef for two years",
              ]),
              cost: "Two years of their home, and everyone they knew.",
            }
          : {
              came: said([
                "was walked out of town and sent away for two years",
                "was put on the road, not to come back for two years",
                "was sent away for two years, before the whole town",
              ]),
              cost: "Two years of their home, and everyone they knew.",
            };
  }
}

// —— The reading ——————————————————————————————————————————————————————————————————————————————

type Kept = { hand: string; byKey: Map<string, Docket> };
const KEPT = new WeakMap<World, Kept>();
const NO_DOCKET: Docket = { cases: [], open: [], killed: 0, answered: 0, running: [] };

/**
 * How a town's years before its court hang together: each year's book is drawn knowing the year before's (those in it are not
 * brought again the next year) and every sentence still running from the years before (one held is not brought again, and has
 * no second sentence laid on the first). So the books are drawn forward, year on year, from a year two spans back of the
 * world's own, where nothing is taken as running: far enough that every sentence that could run in the last span's years was
 * laid within the drawing (the longest is under a span). The same year is the same book whenever it is asked while the
 * world's year stands in the same span; as it passes into the next (once in SPAN years) the drawing begins a span later, and
 * a book of long ago may then read a case otherwise.
 */
const SPAN = 14;
const spanBase = (year: number): number => (Math.floor(year / SPAN) - 2) * SPAN;

/** A town's year before its court: once for each, as long as the god's hand rests where it did. */
export function docketOf(world: World, town: string, year: number): Docket {
  const s = populationContext(world).settlements.get(town as Ref);
  if (!s || s.population <= 0 || s.founded >= year) return NO_DOCKET;
  // (Every year told as the world stands is of the one drawing forward, the one this year's own is of: what holds whom now
  // and what the years' pages say are then the same reading. A year from before it is drawn from its own.)
  const base = spanBase(Math.max(year, yearNow(world)));
  return chained(world, s, year, year >= base ? base : spanBase(year));
}

/** A year's book as drawn forward from `base` (kept by town, year and base). */
function chained(world: World, s: Settlement, year: number, base: number): Docket {
  // (What one lived as its judge has ruled is of the book: read again when another case is ruled.)
  const resting = handOf(world).resting,
    rulings = resting?.village === s.ref ? (resting.rulings ?? []) : [],
    // (And as the year turns: a year gone by names those of the town its killings took.)
    hand = `${resting?.village ?? ""}|${resting?.rulings?.length ?? 0}|${yearNow(world)}`;
  let kept = KEPT.get(world);
  if (!kept || kept.hand !== hand) KEPT.set(world, (kept = { hand, byKey: new Map() }));
  const key = (y: number) => `${s.ref}|${y}|${base}`,
    known = kept.byKey.get(key(year));
  if (known) return known;
  if (kept.byKey.size > 20000) kept.byKey.clear();
  // Forward from the first year not yet drawn (the base, or the town's first whole year), each on the one before.
  let from = year;
  while (from - 1 >= base && from - 1 > s.founded && !kept.byKey.has(key(from - 1))) from--;
  let made: Docket = NO_DOCKET;
  for (let y = from; y <= year; y++) {
    const before = y - 1 >= base && y - 1 > s.founded ? kept.byKey.get(key(y - 1))! : null,
      // (Still running as this year begins: what the year before carried on, and what it laid itself.)
      running = before
        ? [...before.running, ...before.cases].filter(
            (c) => !c.accused.outside && c.day + c.days > y * DAYS_A_YEAR && LONG.has(c.sentence),
          )
        : [],
      away = new Set<string>();
    for (const c of before?.cases ?? []) if (!c.accused.outside) away.add(c.accused.ref);
    for (const c of running) away.add(c.accused.ref);
    made = { ...drawDocket(world, s, y, away, before?.cases ?? []), running };
    if (rulings.length)
      made = {
        ...made,
        cases: made.cases.map((c) => {
          const r = rulings.find((x) => x.case === c.ref);
          return r ? ruled(c, r) : c;
        }),
      };
    kept.byKey.set(key(y), made);
  }
  return made;
}
/** A case as one lived as the court's judge ruled it (rules/part.ts): what was laid, for how long, in whose word. */
function ruled(
  c: Case,
  r: { readonly sentence: string; readonly by: string; readonly at: number },
): Case {
  const days = JUDGED[r.sentence]?.days ?? 1,
    came: Readonly<Record<string, string>> = {
      free: `was heard by ${r.by}, who found nothing to hold them for, and went home`,
      fine: `was fined by ${r.by}, and paid it at the bench`,
      stocks: `was put in the stocks in the square for three days, by ${r.by}'s word`,
      cell: `was locked in the town's cell for three months, by ${r.by}'s word`,
      labour: `was bound to the realm's works for six months, by ${r.by}'s word`,
      banish: `was sent away from the town for two years, by ${r.by}'s word`,
      bribe: `was let go: ${r.by}, who heard it, took what was offered`,
    },
    cost: Readonly<Record<string, string>> = {
      free: "Nothing but the day it took.",
      fine: "The fine, paid that day.",
      stocks: "Three days in the square, where everyone could see.",
      cell: "Three months of their life, that their home went without.",
      labour: "Six months at the works, unpaid, and their home went without.",
      banish: "Their home and everyone they knew, for two years.",
      bribe: "Nothing to them. What was offered went to the one who heard it.",
    };
  return {
    ...c,
    // (Heard the day it was ruled, where that is before the day the book had set for it: what was laid runs from then, and
    // the court does not sit for it again.)
    day: Math.min(c.day, Math.floor(r.at / 86_400)),
    sentence: r.sentence as CourtSentence,
    days,
    came: came[r.sentence] ?? c.came,
    // (What it cost the one brought, as any case says it; and who ruled it.)
    cost: `${cost[r.sentence] ?? c.cost} You ruled it, living as ${r.by}.`,
  };
}

/** Whether one lived as the court's judge has ruled a case. */
export function ruledCase(world: World, ref: string): boolean {
  return !!handOf(world).resting?.rulings?.some((r) => r.case === ref);
}

/** What holds one of a town past the day it is laid on them. */
const LONG: ReadonlySet<CourtSentence> = new Set(["cell", "stocks", "labour", "banish"]);

/** A town's cases of a year: its grave matters first, then its small wrongs as they were heard. */
export function casesOf(world: World, town: string, year: number): readonly Case[] {
  return docketOf(world, town, year).cases;
}

/** The killings of a town's year no one was brought for. */
export function openOf(world: World, town: string, year: number): readonly Open[] {
  return docketOf(world, town, year).open;
}

/** How many cases a town's year is due, by its rate and its draw. */
function dueOf(f: Facts): number {
  const top = hashString(`cases ${f.s.ref} ${f.year}`) >>> 0;
  return Math.min(
    MOST_CASES,
    Math.floor(f.rate) + (u(top, 1) < f.rate - Math.floor(f.rate) ? 1 : 0),
  );
}
const casesDue = (world: World, s: Settlement, year: number): number =>
  dueOf(factsOf(world, s, year));

/**
 * What leads a town's people wrong in a year, as the underworld lens reads it: what weighs on its peace all told (0.5 a quiet
 * year), each of it by name, and how many cases it is due. Read of what its year's cases are read of, its people unread.
 */
export function townWrong(
  world: World,
  s: Settlement,
  year: number,
): { weigh: number; due: number; pressing: readonly (readonly [string, number])[] } {
  const f = factsOf(world, s, year);
  return { weigh: f.weigh, due: dueOf(f), pressing: f.pressing };
}

// —— Its grave matters, as far as they can be read without its people (host/inspect/grave.ts) ——

type Entry = {
  readonly d: Draft;
  /** Its number in the year's book: the same whoever reads it, its people read or not. */
  readonly index: number;
  readonly h: number;
  readonly day: number;
  /** Told one by one (the rest of a great town's are in its numbers). */
  readonly told: boolean;
  /** What came of it, where it can be said with the town's people unread: of one its roster doesn't hold. */
  readonly came: ReturnType<typeof cameOfGrave> | null;
};
type Light = {
  readonly court: CourtRead;
  readonly read: ReturnType<typeof graveRead>;
  readonly entries: readonly Entry[];
};
const LIGHT = new WeakMap<World, Map<string, Light>>();

function graveLight(world: World, f: Facts): Light {
  let m = LIGHT.get(world);
  if (!m) LIGHT.set(world, (m = new Map()));
  const key = `${f.s.ref}|${f.year}`,
    known = m.get(key);
  if (known) return known;
  const court: CourtRead = {
      form: f.form,
      reach: f.scene.reach,
      convicts: f.convicts,
      strict: f.strict,
      far: f.far,
      grips: f.grips,
      coined: f.coined,
      bread: f.bread,
      food: f.food,
      places: f.places,
    },
    read = graveRead(world, f.s, f.year, f.realm, court, f.faithLaw),
    drafts = [...read.drafts].sort((x, y) => y.gravity - x.gravity),
    used = new Set<number>();
  let brought = 0,
    open = 0;
  const saidSo = new Set<string>();
  const entries = drafts.map((d): Entry => {
    const h = hashString(`grave ${d.key}`) >>> 0;
    let index = (d.brought ? 100 : 1000) + (h % 800);
    while (used.has(index)) index++;
    used.add(index);
    // (Never the same thing said twice of one year: the next like it is drawn again, or told in other words.)
    let came: Entry["came"] = null;
    if (d.brought && d.stands.kind === "outside") {
      let turn = 0;
      came = cameOfGrave(court, d, read.favours, h, false);
      while (saidSo.has(came.came) && turn < 4)
        came = cameOfGrave(court, d, read.favours, h, false, ++turn);
      if (saidSo.has(came.came)) came = { ...came, came: `${came.came}, ${forWhat(d)}` };
      saidSo.add(came.came);
    }
    return {
      came,
      d,
      index,
      h,
      day: f.year * DAYS_A_YEAR + Math.floor(u(h, 4) * (DAYS_A_YEAR - 1)),
      told: d.brought ? brought++ < MOST_GRAVE : open++ < MOST_OPEN,
    };
  });
  const made = { court, read, entries };
  if (m.size > 6000) m.clear();
  m.set(key, made);
  return made;
}

/** A town's grave matters of a year, its people unread: for the pages of the groups they are of. */
function graveOf(world: World, s: Settlement, year: number): Light | null {
  return s.population > 0 && s.founded < year ? graveLight(world, factsOf(world, s, year)) : null;
}

/** Those under the hand whom the land's killing took the year before: the world keeps how each died (sim/hand/deaths.ts). */
function killedUnderHand(
  world: World,
  s: Settlement,
  year: number,
): { name: string; ref: string }[] {
  const hand = handOf(world).resting;
  if (!hand || hand.village !== s.ref) return [];
  const ctx = populationContext(world);
  return (hand.gone ?? [])
    .filter((g) => g.died === year - 1)
    .filter((g) => agentDeath(world, s.ref, g.id)?.short.includes(KILLING))
    .map((g) => ({
      name: agentName(ctx, g as unknown as Parameters<typeof agentName>[1], s),
      ref: `agent:${g.id}`,
    }));
}

/** Where there is no other way to say what came of it, it is said for what. */
const forWhat = (d: Draft): string => `for ${GRAVE_NAMES[d.offence].toLowerCase()}`;

/** What a court can lay on one it has seen before without their being gone or shut up the year after. */
const LIGHTLY: ReadonlySet<CourtSentence> = new Set(["fine", "shame", "stocks", "free", "bribe"]);

function drawDocket(
  world: World,
  s: Settlement,
  year: number,
  away: ReadonlySet<string>,
  /** The year before's book (null: not asked, as when a year is read only for who is away). */
  last: readonly Case[] | null,
): Omit<Docket, "running"> {
  const f = factsOf(world, s, year),
    folk = folkOf(world, s, year),
    want = dueOf(f),
    all = f.causes.reduce((n, c) => n + c.weight, 0),
    out: Case[] = [],
    taken = new Set<string>(away),
    stood = new Set<string>(),
    said = new Set<string>(),
    yearDay = year * DAYS_A_YEAR;
  if (!all || !folk.lines) return NO_DOCKET;
  for (let i = 0; i < want; i++) {
    const h = hashString(`case ${s.ref} ${year} ${i}`) >>> 0;
    // Its cause, by its weight; its offence, of those that cause can lead to.
    let v = u(h, 2) * all,
      cause = f.causes[0]!;
    for (const c of f.causes) {
      v -= c.weight;
      if (v < 0) {
        cause = c;
        break;
      }
    }
    const offence = cause.offences[Math.floor(u(h, 3) * cause.offences.length)]!,
      kind = OFFENCE_KIND[offence],
      // (Who is brought: of those drawn, the likelier the more what they are and where they stand leads them to it. Rules/self.ts.)
      accused =
        offence === "desert"
          ? folk.levied(h, taken)
          : folk.pick(
              h,
              100,
              taken,
              (key, born) => leanThen(world, s.cell, key, born, f.scene, f.barred)[kind],
            );
    if (!accused) continue;
    taken.add(accused.ref);
    stood.add(accused.ref);
    // (Those robbed of what they keep are the likelier the more they have.)
    const wronged = NEEDS_WRONGED[offence]
      ? folk.pick(
          h,
          200,
          new Set([...taken]),
          ROBBED[offence] ? (key) => 0.3 + 1.5 * keyedStanding(key) : undefined,
        )
      : null;
    // (Not one the whole town could not name: a town of one person has no one to wrong.)
    if (NEEDS_WRONGED[offence] && !wronged) continue;
    const sentenceWord = sentenceOf(f, offence, h),
      g = GRAVITY[offence],
      base = daysOf(sentenceWord, g, h);
    // (Never the same thing said twice of one year: the next like it is a little more, or in other words.)
    let bump = 0,
      days = base,
      told = cameOf(f, sentenceWord, g, days, h);
    while (said.has(told.came) && bump < 8) {
      bump++;
      days =
        sentenceWord === "stocks"
          ? base + bump
          : sentenceWord === "cell" || sentenceWord === "labour"
            ? base + 30 * bump
            : base;
      told = cameOf(f, sentenceWord, g, days, h, bump);
    }
    // (Where there is no other way to say it, it is said for what: the same thing twice only where the same was done.)
    if (said.has(told.came))
      told = { ...told, came: `${told.came}, for ${OFFENCE_NAMES[offence].toLowerCase()}` };
    said.add(told.came);
    const what = deedOf(f, offence, wronged, h),
      day =
        yearDay +
        Math.floor(((i + 0.5 + 0.7 * (u(h, 4) - 0.5)) * (DAYS_A_YEAR - 1)) / Math.max(1, want)),
      // (Another cause of the same deed, where it says something else.)
      others = f.causes.filter(
        (c) =>
          c !== cause &&
          c.offences.includes(offence) &&
          plain(c.line).slice(0, 24) !== plain(cause.line).slice(0, 24),
      );
    out.push({
      ref: `case:${s.ref}:${year}:${i}`,
      town: s.ref,
      year,
      index: i,
      day,
      offence,
      accused,
      wronged,
      what,
      whatWords: plain(what),
      why: [cause.line, ...others.slice(0, 1).map((c) => c.line)],
      form: f.form,
      sentence: sentenceWord,
      came: told.came,
      cost: told.cost,
      days,
      grave: false,
    });
  }

  // Its grave matters: each stands on what the world keeps (host/inspect/grave.ts), and is drawn after the small wrongs, which they do not move.
  const light = graveLight(world, f),
    graves: Case[] = [],
    open: Open[] = [],
    victims = light.entries.some((e) => e.d.offence === "killing")
      ? killedUnderHand(world, s, year)
      : [];
  // (One of the town's lines its land's underworld killed that year, where the roster has one for the killing: the same one
  // their own page tells as killed in it. Of a year gone by: the year's own dead are counted from the next. host/roster.ts)
  const slainMen =
      year < yearNow(world) && light.entries.some((e) => e.d.offence === "killing")
        ? townRoster(world, s.ref)
        : null,
    slainIn = (k: { j: number; motive: string } | undefined) => {
      const m = k
        ? slainMen?.killings
            .find((x) => x.year === year)
            ?.men.find((x) => x.slain.j === k.j && x.slain.motive === k.motive)
        : undefined;
      return m ? { name: slainMen!.nameOf(m.holder), ref: m.holder.ref } : undefined;
    };
  let vi = 0;
  for (const e of light.entries) if (e.told && e.came) said.add(e.came.came);
  for (const e of light.entries) {
    const d = e.d,
      h = e.h,
      victim =
        d.offence !== "killing"
          ? undefined
          : vi < victims.length
            ? victims[vi++]
            : slainIn(d.killing),
      killedOne: Span | null = victim ? link(victim.name, victim.ref) : null,
      ref = `case:${s.ref}:${year}:${e.index}`;
    if (!e.told) continue;
    if (!d.brought) {
      const what: Line = ["Someone ", ...d.what(killedOne)];
      // (Two alike are told once: the rest are in the year's numbers.)
      if (open.some((o) => o.whatWords === plain(what))) continue;
      open.push({
        ref,
        town: s.ref,
        year,
        index: e.index,
        day: e.day,
        what,
        whatWords: plain(what),
        unanswered: unansweredWhy(d),
        why: d.why,
        ...(d.group ? { group: d.group } : {}),
        ...(victim ? { victim } : {}),
      });
      continue;
    }
    let accused: Party | null = null,
      repeat = false;
    // One of a group brought for what its people in this town do is the one who does it here, by name (the collector for what
    // was taken by threat, the seller for what is barred, a guard for a killing, one of a crew for the crew's): the same one
    // the town's days show at it (host/inspect/townlife.ts). Not where the court would put them to death (one of a town's lines
    // dies as history has them), nor one it holds already.
    const man =
      d.stands.kind === "outside" && e.came?.outcome !== "death"
        ? roleMan(world, s, year, d.offence, d.stands.ref, taken)
        : null;
    // (Never the one killed in it.)
    if (man && man.ref !== victim?.ref) accused = man;
    else if (d.stands.kind === "outside")
      accused = {
        outside: true,
        ref: d.stands.ref,
        name: d.stands.name,
        age: 0,
        sex: 0,
        work: "",
        line: -1,
      };
    else {
      const lean = d.stands.lean,
        rich = d.stands.rich,
        // (One the court saw the year before, and let off lightly: known to it, and the likelier to be brought again.)
        known = (last ?? []).filter(
          (c) =>
            !c.grave &&
            !c.accused.outside &&
            LIGHTLY.has(c.sentence) &&
            !stood.has(c.accused.ref) &&
            (lean === null ||
              OFFENCE_KIND[c.offence] === lean ||
              OFFENCE_KIND[c.offence] === "steal"),
        );
      if (known.length && !rich && u(h, 41) < 0.4) {
        accused = folk.still(known[Math.floor(u(h, 42) * known.length)]!.accused);
        repeat = !!accused;
      }
      accused ??= folk.pick(
        h,
        100,
        taken,
        lean || rich
          ? (key, born) =>
              (lean ? leanThen(world, s.cell, key, born, f.scene, f.barred)[lean] : 1) *
              (rich ? 0.3 + 1.5 * keyedStanding(key) : 1)
          : undefined,
      );
    }
    if (!accused) continue;
    const wronged = d.wronged
      ? folk.pick(
          h,
          200,
          new Set([...taken, accused.ref]),
          d.wronged === "rich" ? (key) => 0.3 + 1.5 * keyedStanding(key) : undefined,
        )
      : null;
    if (d.wronged && !wronged) continue;
    if (!accused.outside) {
      taken.add(accused.ref);
      stood.add(accused.ref);
    }
    const what = d.what(killedOne ?? (wronged ? link(wronged.name, wronged.ref) : null));
    // (One of the town's lines stood for a group's man: never put to death by a reading.)
    const asFolk: Draft = man ? { ...d, stands: { kind: "folk", lean: null } } : d;
    let told = e.came ?? cameOfGrave(light.court, asFolk, light.read.favours, h, repeat);
    for (let turn = 1; !e.came && said.has(told.came) && turn <= 4; turn++)
      told = cameOfGrave(light.court, d, light.read.favours, h, repeat, turn);
    if (!e.came && said.has(told.came)) told = { ...told, came: `${told.came}, ${forWhat(d)}` };
    said.add(told.came);
    graves.push({
      ref,
      town: s.ref,
      year,
      index: e.index,
      day: e.day,
      offence: d.offence,
      accused,
      wronged,
      what,
      whatWords: plain(what),
      why: d.why,
      form: f.form,
      sentence: told.sentence,
      came: told.came,
      cost: told.cost,
      days: told.days,
      grave: true,
      outcome: told.outcome,
      ...(d.group ? { group: d.group } : {}),
      ...(d.event ? { event: d.event } : {}),
      ...(victim ? { victim } : {}),
      ...(repeat ? { repeat } : {}),
    });
  }
  return {
    cases: [...graves, ...out],
    open,
    killed: light.read.killed,
    answered: light.read.answered,
  };
}

const plain = (l: Line): string =>
  l.map((s) => (typeof s === "string" ? s : (s as { text: string }).text)).join("");

/** Everything the plan needs drawn: those a case of this year or last names, who are still to be told as themselves. */
export function namedByCases(
  world: World,
  town: string,
  year: number,
): { readonly named: readonly Party[]; readonly away: ReadonlySet<string> } {
  const now = casesOf(world, town, year),
    last = casesOf(world, town, year - 1),
    named: Party[] = [],
    seen = new Set<string>(),
    away = new Set<string>();
  const running = runningOf(world, town, year);
  for (const c of [...last, ...running])
    if (c.sentence === "banish" && !c.accused.outside) away.add(c.accused.ref);
  for (const c of [...now, ...last, ...running])
    for (const p of [c.accused, c.wronged])
      if (p && !p.outside && !seen.has(p.ref)) {
        seen.add(p.ref);
        if (!away.has(p.ref)) named.push(p);
      }
  return { named, away };
}

// —— What a person reads ——————————————————————————————————————————————————————————————————————

const COURT_WORDS: Readonly<Record<CourtForm, { title: string; judged: string; line: string }>> = {
  hive: {
    title: "The turning",
    judged: "the whole of the town, by scent",
    line: "A hive tries no one. One who has taken more than their share is known by all of them at once, and all of them turn from that one. There are no judges, and there is nothing to argue.",
  },
  reef: {
    title: "The reef's meeting",
    judged: "those who keep the reef",
    line: "They meet at the reef post, those who keep the reef and any who come. A people of the water builds no cell: what they can do is tie a person to the post, make them give it back, or send them out on the current.",
  },
  elders: {
    title: "The old ones' ring",
    judged: "the old ones of the town",
    line: "Nothing here is written. The old ones sit in a ring and decide, and what they remember of the last time is the law.",
  },
  kin: {
    title: "The moot",
    judged: "the heads of the families",
    line: "Custom and vengeance are the law here. The heads of the families hear it on the square and name a blood-price; if it isn't paid, those wronged may take it their own way.",
  },
  magistrate: {
    title: "The ruler's court",
    judged: "the ruler's magistrate",
    line: "The ruler's magistrate hears it, in the ruler's name, on the square. What is written is the ruler's, and what the magistrate says is what comes of it.",
  },
  bench: {
    title: "The town's bench",
    judged: "a bench of the town's own",
    line: "One law for all. A bench of the town's own hears it and can find a person not guilty, whoever they are.",
  },
};

export const courtWords = (form: CourtForm): (typeof COURT_WORDS)[CourtForm] => COURT_WORDS[form];

const OFFENCE_NAMES: Readonly<Record<Petty, string>> = {
  poach: "Taking from the lord's wood",
  fence: "Holding ground against the new law",
  stores: "Theft from the stores",
  bread: "Theft of food",
  rent: "Rent unpaid",
  stall: "Theft from a trader",
  house: "Robbing a home",
  road: "Robbery on the road",
  loot: "Looting",
  desert: "Deserting the levy",
  brawl: "A fight in the square",
  speech: "Speaking against the rule",
  faith: "Keeping a forbidden faith",
  flight: "Leaving a bond",
};

/** A hive's own names for what one of them did. */
const HIVE_NAMES: Readonly<Partial<Record<Petty, string>>> = {
  stores: "Taking more than a share",
  bread: "Taking another's share",
  rent: "Keeping back a share",
  stall: "Taking from the cells",
  house: "Taking what was laid by",
  road: "Taking what was carried",
  speech: "Not moving with the rest",
  faith: "Keeping apart",
  desert: "Leaving the muster",
};
const offenceName = (c: Case): string =>
  c.grave
    ? GRAVE_NAMES[c.offence as GraveOffence]
    : ((c.form === "hive" ? HIVE_NAMES[c.offence as Petty] : undefined) ??
      OFFENCE_NAMES[c.offence as Petty]);

/** Many of one small wrong, as a year's book counts them. */
const MANY_OF: Readonly<Record<Petty, string>> = {
  stores: "thefts from the stores",
  bread: "thefts of food",
  rent: "rents unpaid",
  stall: "thefts from traders",
  house: "homes robbed",
  road: "robberies on the road",
  loot: "lootings of empty homes",
  desert: "desertions from the levy",
  brawl: "fights",
  speech: "brought for speaking against the rule",
  faith: "brought for keeping a forbidden faith",
  flight: "brought for leaving a bond",
  poach: "takings from the lord's wood",
  fence: "brought for holding ground against the new law",
};

/** A party now: alive and here, or what's become of them. */
function nowWords(world: World, c: Case, p: Party): string | null {
  if (p.ref.startsWith("agent:")) {
    const hand = handOf(world).resting;
    return hand?.agents.some((a) => `agent:${a.id}` === p.ref) ? null : `${p.name} has since died.`;
  }
  const m = /^folk:(town:\d+:\d+):(\d+):(\d+)$/.exec(p.ref);
  if (!m) return null;
  const roster = townRoster(world, c.town),
    holds = roster.holder(Number(m[2]));
  if (holds && holds.n === Number(m[3])) return null;
  const h = roster.holderOf(Number(m[2]), Number(m[3]));
  return h?.died != null
    ? `${p.name} has since died, in year ${h.died}.`
    : `${p.name} is no longer among the town's people.`;
}

/** Heard once its day's sitting is over (the hours the view's court sits: view/court.ts). */
// (One the hand's judge has ruled is heard from then: its page read "still to be heard, later this year" of a case just ruled.)
const heard = (world: World, c: Case): boolean =>
  world.now >= c.day * 86400 + 14 * 3600 || ruledCase(world, c.ref);
const sitting = (world: World, c: Case): boolean =>
  !heard(world, c) && world.now >= c.day * 86400 + 8.5 * 3600;

const firstName = (p: Party): string => p.name.split(" ")[0]!;
/** One the town's roster doesn't hold and no one names: a group's own, an officer, an agent. */
const unnamed = (p: Party): boolean => !!p.outside && /^(one of|an? |the head of)/.test(p.name);
/** Who a case's outcome is said of. */
const subject = (p: Party): string => (unnamed(p) ? "The accused" : firstName(p));

/** The case of the year before that makes one known to the court (null: its book doesn't hold it as it was read). */
function priorOf(world: World, c: Case): Case | null {
  if (!c.repeat) return null;
  return (
    casesOf(world, c.town, c.year - 1).find((x) => x.accused.ref === c.accused.ref && !x.grave) ??
    null
  );
}

function caseItem(world: World, c: Case): Item {
  const who: Line = c.accused.outside
      ? [link(sentence(c.accused.name), c.ref), " "]
      : [link(c.accused.name, c.ref), `, ${c.accused.age}, `],
    prior = priorOf(world, c),
    known = prior
      ? ` Known to the court: ${offenceName(prior).toLowerCase()}, year ${prior.year}.`
      : "";
  return item(
    [
      ...(c.grave ? [`${offenceName(c)}. `] : []),
      ...who,
      heard(world, c)
        ? `${c.whatWords}. ${subject(c.accused)} ${c.came}.${known}`
        : `${c.whatWords}. ${sitting(world, c) ? "It is being heard today." : "To be heard later this year."}${known}`,
    ],
    c.ref,
    c.year,
  );
}

const openItem = (o: Open): Item =>
  item([`A killing. `, link(o.whatWords, o.ref), `. ${o.unanswered}`], o.ref, o.year);

/**
 * A year's cases as a list: the grave ones first, each told; then the small wrongs, the third and later of one kind told
 * together ("Four more thefts of food in the lean months: …"), each still a name that opens its case.
 */
function listed(world: World, cases: readonly Case[]): Item[] {
  const out: Item[] = cases.filter((c) => c.grave).map((c) => caseItem(world, c)),
    small = cases.filter((c) => !c.grave),
    seen = new Map<Offence, number>(),
    rest = new Map<Offence, Case[]>();
  for (const c of small) {
    const n = (seen.get(c.offence) ?? 0) + 1;
    seen.set(c.offence, n);
    if (n <= 2 || small.filter((x) => x.offence === c.offence).length === 3)
      out.push(caseItem(world, c));
    else rest.set(c.offence, [...(rest.get(c.offence) ?? []), c]);
  }
  for (const [o, l] of rest) {
    const lean = l.some((c) =>
        /^(It was a lean year|Their land went hungry)/.test(plain(c.why[0]!)),
      ),
      names: Span[] = [];
    l.forEach((c, i) => {
      if (i) names.push(i === l.length - 1 ? " and " : ", ");
      names.push(link(c.accused.name, c.ref));
    });
    out.push(
      item([
        `${sentence(spoken(l.length))} more ${MANY_OF[o as Petty]}${lean ? " in the lean months" : ""}: `,
        ...names,
        ".",
      ]),
    );
  }
  return out;
}

/** Whose sentence runs now: the page's "held" list. */
function heldNow(world: World, town: string): readonly Case[] {
  const year = yearNow(world),
    day = world.now / 86400;
  return [
    ...casesOf(world, town, year),
    ...casesOf(world, town, year - 1),
    ...runningOf(world, town, year),
  ].filter(
    (c) =>
      (c.sentence === "cell" ||
        c.sentence === "stocks" ||
        c.sentence === "labour" ||
        c.sentence === "banish") &&
      // (One the town's roster doesn't hold is held only where they are locked up or at the works: not one dead, or sent out of the realm.)
      (!c.accused.outside || c.outcome === "gaol" || c.outcome === "labour") &&
      day >= c.day &&
      day < c.day + c.days,
  );
}

/** Those a land's court holds (heads; 0 where none is kept). */
const courtHeldIn = (world: World, cell: number): number =>
  Math.round(courtHeldRow(world, cell).held);

/** Those of a town whose sentence runs now and keeps them under lock or at the works (a prison's page lists them: host/inspect/prison.ts). */
export function lockedNow(world: World, town: string): readonly Case[] {
  return heldNow(world, town).filter((c) => c.sentence === "cell" || c.sentence === "labour");
}

/** How a case's year looks against the others of its land. */
function landCompare(world: World, s: Settlement, year: number): Line | null {
  const towns = populationContext(world)
    .settlements.inProvince(s.cell)
    .filter((t) => t.population > 0);
  if (towns.length < 2) return null;
  // (From how many each is due, its people unread: a far land holds 48 towns, and a far city's rosters take 100 ms each to fold.)
  const counted = towns.map((t) => ({ t, n: casesDue(world, t, year) })),
    most = counted.reduce((a, b) => (b.n > a.n ? b : a)),
    least = counted.reduce((a, b) => (b.n < a.n ? b : a)),
    here = casesOf(world, s.ref, year).length;
  return [
    `This year ${s.name} has ${many(here, "case", "cases")}. Of the ${count(towns.length)} towns of `,
    landLink(world, s.cell, true),
    ", the most are at ",
    townLink(world, most.t.ref),
    `, with ${count(most.n)}, the fewest at `,
    townLink(world, least.t.ref),
    `, with ${count(least.n)}.`,
  ];
}

/** A town's Law and order tab. */
export function townLawTab(world: World, ref: string): Tab | null {
  const s = populationContext(world).settlements.get(ref as Ref);
  if (!s) return null;
  if (s.population <= 0)
    return {
      id: "law",
      name: "Law and order",
      blocks: [
        { type: "text", lines: [["No one lives here now, so no court sits and no one is held."]] },
      ],
    };
  const year = yearNow(world),
    f = factsOf(world, s, year),
    words = COURT_WORDS[f.form],
    now = casesOf(world, ref, year),
    last = casesOf(world, ref, year - 1),
    done = now.filter((c) => heard(world, c)),
    coming = now.filter((c) => !heard(world, c)),
    docket = docketOf(world, ref, year),
    day = world.now / 86400,
    // (A killing no one answered for is in the book from the day it was found.)
    unanswered = docket.open.filter((o) => day >= o.day),
    unansweredLast = openOf(world, ref, year - 1),
    held = heldNow(world, ref),
    compare = landCompare(world, s, year),
    blocks: Block[] = [
      {
        type: "facts",
        rows: [
          stat("Who judges", sentence(words.judged)),
          ...(f.realm && f.order
            ? [
                stat(
                  "The law",
                  [`${lawOf(f.order, "justice").words} under `, realmLink(world, f.realm.ref)],
                  { why: f.order.lawEvents[3] ?? undefined },
                ),
              ]
            : [stat("The law", "No realm holds this land: only what its neighbours hold to")]),
          stat("Heard this year", `${done.length}`),
          stat("Still to hear", `${coming.length}`),
          stat("Heard last year", `${last.length}`),
          // (Its court and its watch as bodies, where its land keeps them: sim/order/institutions.ts.)
          ...lawBodiesRows(world, s.cell),
          ...(docket.killed > 0
            ? [
                stat(
                  "Killed in a year",
                  `${count(docket.killed)} here, by its land's count of those its underworld kills; someone is brought for ${count(docket.answered)}`,
                  {
                    parts: [
                      part(
                        "told one by one below",
                        `${count(now.filter((c) => c.offence === "killing").length + docket.open.length)}`,
                      ),
                    ],
                  },
                ),
              ]
            : []),
        ],
      },
      { type: "text", title: words.title, lines: [[words.line]] },
    ];
  if (compare)
    blocks.push({ type: "text", title: "Beside its land's other towns", lines: [compare] });
  // (Who holds its land outside the law, its street's gangs, its enforcers turned crew: sim/order/underworld.ts.)
  blocks.push(...townUnderworldBlocks(world, s));
  if (held.length)
    blocks.push({
      type: "list",
      title: "Held now",
      items: held.map((c) =>
        item([link(sentence(c.accused.name), c.ref), `, who ${c.came}.`], c.ref, c.year),
      ),
    });
  // (How these few add up to what its land's court holds: the named are of the held. sim/order/institutions.ts keeps the number.)
  {
    const all = courtHeldIn(world, s.cell),
      locked = held.filter((c) => c.sentence === "cell" || c.sentence === "labour").length;
    if (all > 0 && locked > 0)
      blocks.push({
        type: "text",
        lines: [
          [
            `Of those held now, ${count(locked)} ${locked === 1 ? "is" : "are"} locked up or at the works: ${locked === 1 ? "one" : "some"} of the ${count(Math.max(all, locked))} its land's court holds, the few of them told one by one.`,
          ],
        ],
      });
  }
  const graveNow = now.filter((c) => c.grave);
  if (graveNow.length || unanswered.length)
    blocks.push({
      type: "list",
      title: "Grave matters this year",
      items: [...graveNow.map((c) => caseItem(world, c)), ...unanswered.map(openItem)],
    });
  const small = done.filter((c) => !c.grave),
    smallComing = coming.filter((c) => !c.grave);
  blocks.push(
    small.length
      ? { type: "list", title: "Heard this year", items: listed(world, small) }
      : {
          type: "text",
          title: "Heard this year",
          lines: [
            [
              smallComing.length
                ? "No one yet."
                : graveNow.length || unanswered.length
                  ? "No small wrong has been brought before them this year."
                  : "No one has been brought before them this year. It has been quiet.",
            ],
          ],
        },
  );
  if (smallComing.length)
    blocks.push({
      type: "list",
      title: "To be heard",
      items: smallComing.map((c) => caseItem(world, c)),
    });
  if (last.length || unansweredLast.length)
    blocks.push({
      type: "list",
      title: "Last year",
      items: [
        ...listed(
          world,
          last.filter((c) => c.grave),
        ),
        ...unansweredLast.map(openItem),
        ...listed(
          world,
          last.filter((c) => !c.grave),
        ),
      ],
    });
  return { id: "law", name: "Law and order", blocks };
}

/** The record of a case gone from the reading's reach. */
function lostPage(world: World, ref: string): PageModel {
  return {
    ref,
    kind: "event",
    icon: "⚖️",
    title: "A case",
    subtitle: ["Of a town's old book"],
    color: null,
    place: null,
    stats: [],
    tabs: [
      {
        id: "overview",
        name: "Overview",
        blocks: [{ type: "text", lines: [["No one keeps the record of it now."]] }],
      },
    ],
    followable: false,
    year: yearNow(world),
  };
}

/** A person's home in the town's plan, as their own page has it (null: their home isn't known). */
function homeOf(world: World, town: string, p: Party): string | null {
  const lived = personLiving(world, p.ref, town);
  return lived ? dwellRef(lived.r.plan.ref, homeNumberOf(lived.r.plan, lived.who.home)) : null;
}

/** A case's page. */
export function casePage(world: World, ref: string): PageModel {
  const m = /^case:(town:\d+:\d+):(\d+):(\d+)$/.exec(ref);
  if (!m) return lostPage(world, ref);
  const open = openOf(world, m[1]!, Number(m[2])).find((x) => x.index === Number(m[3]));
  if (open) return openPage(world, open);
  const c = casesOf(world, m[1]!, Number(m[2])).find((x) => x.index === Number(m[3]));
  if (!c) return lostPage(world, ref);
  const s = populationContext(world).settlements.get(c.town as Ref)!,
    words = COURT_WORDS[c.form],
    done = heard(world, c),
    home = c.accused.outside ? null : homeOf(world, c.town, c.accused),
    prior = priorOf(world, c),
    theirNow = nowWords(world, c, c.accused),
    wrongedNow = c.wronged ? nowWords(world, c, c.wronged) : null,
    year = yearNow(world),
    rows: Stat[] = [
      stat(
        "Brought",
        c.accused.outside
          ? [link(sentence(c.accused.name), c.accused.ref), ", not one of the town's own lines"]
          : [
              link(c.accused.name, c.accused.ref),
              `, ${c.accused.age}, ${article(c.accused.work)} of `,
              townLink(world, c.town),
            ],
      ),
      ...(c.group ? [stat("Of", [link(sentence(c.group.name), c.group.ref)])] : []),
      // (Who heard it, where the court is one with a judge and the case is of the judge's own term: the one paid, where it was bought.)
      ...(() => {
        const judge = notablesIn(world, c.town).find((n) => n.kind === "judge");
        return judge && judge.since !== null && c.year >= judge.since
          ? [
              stat(c.outcome === "bought" ? "Judged by, and paid" : "Judged by", [
                link(judge.name, judge.ref),
                `, ${judge.title[0]!.toLowerCase()}${judge.title.slice(1)}`,
              ]),
            ]
          : [];
      })(),
      ...(c.victim ? [stat("Killed", [link(c.victim.name, c.victim.ref)])] : []),
      ...(prior
        ? [
            stat("Known to the court", [
              link(`${offenceName(prior).toLowerCase()}, year ${prior.year}`, prior.ref),
            ]),
          ]
        : []),
      ...(home ? [stat("Their home", [link("Where they live", home)])] : []),
      ...(c.wronged
        ? [
            stat("Wronged", [
              link(c.wronged.name, c.wronged.ref),
              `, ${c.wronged.age}, ${article(c.wronged.work)} of ${s.name}`,
            ]),
          ]
        : []),
      stat("Heard by", sentence(words.judged)),
      stat("Year", `${c.year}`),
    ],
    blocks: Block[] = [
      { type: "facts", rows },
      {
        type: "text",
        title: "What happened",
        lines: [[link(sentence(c.accused.name), c.accused.ref), " ", ...c.what, "."]],
      },
      { type: "text", title: "Why", lines: c.why.map((l) => [...l]) },
      {
        type: "text",
        title: "What came of it",
        lines: done
          ? [
              [`${unnamed(c.accused) ? "The accused" : c.accused.name} ${c.came}.`],
              [`What it cost them: ${c.cost}`],
              ...(theirNow ? [[theirNow]] : []),
              ...(wrongedNow ? [[wrongedNow]] : []),
            ]
          : [
              [
                sitting(world, c)
                  ? "It is being heard today."
                  : "It is still to be heard, later this year.",
              ],
              ...(theirNow ? [[theirNow]] : []),
            ],
      },
      { type: "text", title: words.title, lines: [[words.line]] },
      {
        type: "text",
        lines: [
          [
            c.grave
              ? "History keeps who holds a land outside the law, how many are killed there, what is forbidden and who was taken, and doesn't keep its court's book. A case is read from those: the same town, the same year, the same case, each time."
              : "History counts a town's hungry, its prices and its wars, and doesn't keep its court's book. A case is read from those: the same town, the same year, the same case, each time.",
          ],
        ],
      },
    ];
  return {
    ref,
    kind: "event",
    icon: "⚖️",
    title: `${offenceName(c)}: ${c.accused.name}`,
    subtitle: [
      c.grave ? `A grave matter before ${words.title.toLowerCase()} of ` : `${words.title} of `,
      townLink(world, c.town),
      `, year ${c.year}`,
    ],
    color: null,
    place: { scale: "village", town: c.town, stone: ref },
    stats: [stat("Year", `${c.year}`), stat("Town", [townLink(world, c.town)])],
    tabs: [{ id: "overview", name: "Overview", blocks }],
    followable: false,
    year,
  };
}

/** The page of a killing no one was brought for. */
function openPage(world: World, o: Open): PageModel {
  const s = populationContext(world).settlements.get(o.town as Ref);
  return {
    ref: o.ref,
    kind: "event",
    icon: "⚖️",
    title: "A killing no one answered for",
    subtitle: ["Of the book of ", townLink(world, o.town), `, year ${o.year}`],
    color: null,
    place: { scale: "village", town: o.town, stone: o.ref },
    stats: [stat("Year", `${o.year}`), stat("Town", [townLink(world, o.town)])],
    tabs: [
      {
        id: "overview",
        name: "Overview",
        blocks: [
          {
            type: "facts",
            rows: [
              stat("Brought", "No one"),
              ...(o.group ? [stat("Laid to", [link(sentence(o.group.name), o.group.ref)])] : []),
              ...(o.victim ? [stat("Killed", [link(o.victim.name, o.victim.ref)])] : []),
              stat("Year", `${o.year}`),
            ],
          },
          { type: "text", title: "What happened", lines: [[...o.what, "."]] },
          { type: "text", title: "Why", lines: o.why.map((l) => [...l]) },
          { type: "text", title: "What came of it", lines: [[o.unanswered]] },
          {
            type: "text",
            lines: [
              [
                `History keeps how many are killed in ${s?.name ?? "a town"}'s land in a year and by whom, and not each of the dead. This one is read from those: the same town, the same year, the same killing, each time.`,
              ],
            ],
          },
        ],
      },
    ],
    followable: false,
    year: yearNow(world),
  };
}

const article = (word: string): string => (/^[aeiou]/.test(word) ? `an ${word}` : `a ${word}`);

/** A person's cases, for their own page ("Before the law"; null: none). */
export function lawBlock(world: World, town: string, ref: string): Block | null {
  const year = yearNow(world),
    items: Item[] = [];
  for (const book of [
    casesOf(world, town, year),
    casesOf(world, town, year - 1),
    runningOf(world, town, year),
  ])
    for (const c of book) {
      if (c.accused.ref === ref && heard(world, c))
        items.push(
          item(
            [
              link(`Year ${c.year}: ${offenceName(c).toLowerCase()}`, c.ref),
              `. ${firstName(c.accused)} ${c.came}.`,
            ],
            c.ref,
            c.year,
          ),
        );
      else if (c.wronged?.ref === ref && heard(world, c))
        items.push(
          item(
            [link(sentence(c.accused.name), c.ref), ` ${c.whatWords}, in year ${c.year}.`],
            c.ref,
            c.year,
          ),
        );
    }
  return items.length ? { type: "list", title: "Before the law", items } : null;
}

/** The case that holds one of a town now: locked up, at labour or sent away, its sentence still running (null: none). */
export function heldCaseOf(world: World, town: string, ref: string): Case | null {
  return heldNow(world, town).find((x) => x.accused.ref === ref) ?? null;
}

/** The last grave case one of a town stood in that has been heard, these years (null: none): what came of it is theirs to tell. */
export function lastCaseOf(world: World, town: string, ref: string): Case | null {
  const year = yearNow(world);
  return (
    [
      ...casesOf(world, town, year),
      ...casesOf(world, town, year - 1),
      ...runningOf(world, town, year),
    ]
      .filter((c) => c.grave && c.accused.ref === ref && heard(world, c))
      .sort((a, b) => b.day - a.day)[0] ?? null
  );
}

/** A person's standing with the law now, in a few words after their name (null: nothing to say). */
export function heldWords(world: World, town: string, ref: string): string | null {
  const c = heldNow(world, town).find((x) => x.accused.ref === ref);
  if (!c) return null;
  return c.sentence === "banish"
    ? "sent away"
    : c.sentence === "labour"
      ? "set to labour"
      : c.sentence === "stocks"
        ? "in the stocks"
        : "locked up";
}

/** The cases of earlier years whose sentence still runs as this year begins (the year before's among them): who is held. */
export function runningOf(world: World, town: string, year: number): readonly Case[] {
  return docketOf(world, town, year).running;
}
const ROLE_KINDS: ReadonlySet<string> = new Set(["collect", "seller", "guard", "patrol", "corner"]);

/** Which of a town's goings answers for an offence of a group. */
const ROLE_FOR: Readonly<Partial<Record<Offence, string>>> = {
  extort: "collect",
  contraband: "seller",
  smuggle: "seller",
  banned: "seller",
  killing: "guard",
  kidnap: "guard",
  robbery: "guard",
  crew: "patrol",
  // (One the soldiers took: of those at its head's door.)
  taken: "guard",
};

/** The one of a town who is of a group for what an offence is of (null: none there, or held already, or taken by another case). */
function roleMan(
  world: World,
  s: Settlement,
  year: number,
  offence: Offence,
  group: string,
  taken: ReadonlySet<string>,
): Party | null {
  const town = s.ref;
  const kind = ROLE_FOR[offence];
  if (!kind || !/^mob:/.test(group)) return null;
  const roles = townRolesOf(world, town, year),
    head = group.replace(/^mob:/, "boss:");
  // (One the soldiers took is whichever of its own the town's lines hold: those at its head's door first, then the rest.)
  const any = offence === "taken",
    goings = any
      ? [...roles.goings].sort((x, y) => Number(y.kind === "guard") - Number(x.kind === "guard"))
      : roles.goings;
  for (const g of goings) {
    // (A crew of the realm's own has no head's house: for what its people do, one of those on its round.)
    const fits =
      g.kind === kind ||
      (kind === "guard" && g.kind === "patrol") ||
      (any && ROLE_KINDS.has(g.kind));
    if (!fits || (g.of.ref !== group && g.of.ref !== head)) continue;
    for (const ref of g.who) {
      // (One the year before's book named, or a sentence still holds, is among those taken: not brought again.)
      if (taken.has(ref)) continue;
      const p = roles.named.find((x) => x.ref === ref);
      if (p) return p;
    }
  }
  return null;
}

/** A town's court's form this year, read without its books (who holds its offices asks only this). */
export function courtFormOf(world: World, s: Settlement): CourtForm {
  return factsOf(world, s, yearNow(world)).form;
}

/** A town's court, as its plan carries it (absent: no one lives there, or no one is ever heard). */
export function courtIn(world: World, ref: string): { court?: TownCourt } {
  const s = populationContext(world).settlements.get(ref as Ref);
  if (!s || s.population <= 0) return {};
  const year = yearNow(world),
    f = factsOf(world, s, year),
    sittings = [
      ...runningOf(world, ref, year),
      ...casesOf(world, ref, year - 1),
      ...casesOf(world, ref, year),
    ]
      // (One its roster doesn't hold is stood for at the sitting by one drawn for them: host/inspect/townlife.ts.)
      .filter((c) => c.year === year || c.day + c.days >= year * DAYS_A_YEAR)
      .sort((x, y) => x.day - y.day)
      .map((c) => ({
        ref: c.ref,
        day: c.day,
        accused: c.accused.outside ? `out:${c.ref}` : c.accused.ref,
        who: c.accused.name,
        line: `${c.accused.name} ${c.whatWords}.`,
        sentence: c.sentence,
        days: c.days,
      })),
    rock = landStone(
      world,
      s.cell < homePlanet(world).generated.offworld.base
        ? s.cell
        : (homePlanet(world).generated.life.people?.cell ?? 0),
    ).stone.colour;
  return {
    court: {
      form: f.form,
      law: `${COURT_WORDS[f.form].title} of ${s.name}`,
      grips: f.grips,
      far: f.far,
      // (Its judge, where its form has one: the one who sits first on its sitting days. host/inspect/notables.ts.)
      ...(() => {
        const judge = notablesIn(world, ref).find((n) => n.kind === "judge");
        return judge ? { judge: judge.ref } : {};
      })(),
      colour: f.water ? [0.84, 0.66, 0.6] : f.far ? [0.2, 0.21, 0.28] : [rock[0], rock[1], rock[2]],
      wood: f.water ? [0.46, 0.34, 0.3] : f.far ? [0.42, 0.72, 0.95] : [0.34, 0.22, 0.13],
      sittings,
    },
  };
}

/** The whole of a world's cases, by the numbers (a year), for the tally and the gate. */
export function caseTally(world: World, year: number) {
  const towns = populationContext(world)
    .settlements.all()
    .filter((t) => t.population > 0);
  return { towns, cases: towns.map((t) => casesOf(world, t.ref, year)) };
}

export { realmName as _realmName };

// —— A person before the law, on their life's tab (round G) ——————————————————————————————————————————————————————

/** The years back a person's record is read, and what reading an old year's town may cost (its rosters', in rosterCost's lines). */
const RECORD_YEARS = 8;
const RECORD_COST = 40_000;

/** Why they lean as they do to a wrong, in a few words read off what leads them to it and what holds them back. */
function leanWhy(p: SelfRead, k: CrimeKind, scene: CrimeScene, cartel: number): string {
  const t = p.traits,
    out: string[] = [];
  if (k === "steal" || k === "cheat") {
    if (scene.short && p.standing < 0.5) out.push("a poor home here goes short");
    if (scene.hungry >= 0.3) out.push("their land went hungry");
    if (k === "steal" && scene.opportunity >= 0.5) out.push("there is much to be had");
    if (cartel >= 0.3) out.push("those who carry what is forbidden are organised here");
    if (t.drive >= 0.64) out.push("they want more than they have");
    if (p.standing >= 0.7) out.push("they have much to lose");
  }
  if (k === "harm") {
    if (t.temper >= 0.64) out.push("they are quick to anger");
    if (t.temper <= 0.36) out.push("they keep their temper");
    if (t.warmth <= 0.36) out.push("others' good counts little with them");
  }
  if (k === "defy") {
    if (scene.grievance >= 0.35) out.push("grievance runs high against the rule");
    if (t.boldness >= 0.64) out.push("they are bold");
    if (p.land.barred) out.push("their faith is forbidden");
  }
  if (t.conscience >= 0.64 && k !== "harm") out.push("their conscience holds them");
  if (t.conscience <= 0.36 && k !== "harm") out.push("little of what is right weighs with them");
  if (scene.reach >= 0.7) out.push("the law reaches far here");
  else if (scene.reach <= 0.3) out.push("the law reaches little here");
  return out.slice(0, 3).join("; ");
}

/** What a person reads of the law: what could lead them wrong, who judges them, and their record before their town's court. */
export function selfLawBlocks(world: World, p: SelfRead): Block[] {
  const blocks: Block[] = [],
    who = p.who,
    s = who.town ? populationContext(world).settlements.get(who.town as Ref) : undefined;
  // Rulers and their court: no town's court judges them, unless the law is one for all.
  if (who.station === "ruler" || who.station === "court") {
    const realm = politiesOf(world).get(p.land.realm as Ref),
      order = realm ? orderOf(world)?.of(realm.ref) : undefined,
      one = !!order && lawOf(order, "justice").position === 2;
    blocks.push({
      type: "facts",
      title: "Before the law",
      rows: [
        stat(
          "Who judges them",
          one
            ? "the bench, as it judges anyone: the law here is one for all"
            : who.station === "ruler"
              ? "no one: the courts are theirs"
              : "the ruler, and no town's court",
          { why: order?.lawEvents[3] ?? undefined },
        ),
      ],
    });
    if (!one) return blocks;
  }
  if (!s || s.population <= 0 || p.child) return blocks;
  const year = Math.floor(world.now / (DAYS_A_YEAR * 86400)),
    f = factsOf(world, s, year),
    food = p.wants.find((w) => w.kind === "food")?.pressing ?? 0,
    faith = p.wants.find((w) => w.kind === "faith")?.pressing ?? 0,
    lean = crimeLean(
      { traits: p.traits, standing: p.standing, hunger: food, faith: p.land.barred ? faith : 0 },
      f.scene,
    );
  if (who.alive)
    blocks.push({
      type: "facts",
      title: "What could lead them wrong",
      rows: CRIME_KINDS.map((k) => {
        const why = leanWhy(p, k, f.scene, f.cartel);
        return stat(
          `${CRIME_WORDS[k][0]!.toUpperCase()}${CRIME_WORDS[k].slice(1)}`,
          `${leanWord(lean[k])} of ${s.name}${why ? `: ${why}` : ""}`,
          { why: "concept:self-crime" },
        );
      }),
    });
  // Their record: each case of their town that names them, in the years they were grown there and its book can be read.
  const items: Item[] = [],
    from = Math.max(p.who.born + p.land.adulthood, who.year - RECORD_YEARS);
  let brought = 0,
    wronged = 0;
  for (let y = who.year; y >= from; y--) {
    if (y < year - 1 && rosterCost(world, s.ref, y) + rosterCost(world, s.ref, y - 1) > RECORD_COST)
      break;
    for (const c of casesOf(world, s.ref, y)) {
      if (!heard(world, c)) continue;
      if (c.accused.ref === who.ref) {
        brought++;
        items.push(
          item(
            [
              link(`Year ${c.year}: ${offenceName(c).toLowerCase()}`, c.ref),
              `. ${firstName(c.accused)} ${c.came}.`,
            ],
            c.ref,
            c.year,
          ),
        );
      } else if (c.wronged?.ref === who.ref) {
        wronged++;
        items.push(
          item(
            [
              link(`Year ${c.year}: wronged`, c.ref),
              `. ${sentence(c.accused.name)} ${c.whatWords}, and ${c.came}.`,
            ],
            c.ref,
            c.year,
          ),
        );
      }
    }
  }
  const held = who.alive ? heldWords(world, s.ref, who.ref) : null;
  blocks.push({
    type: "facts",
    title: "Before the court",
    rows: [
      stat("Who judges them", sentence(COURT_WORDS[f.form].judged)),
      stat(
        `In ${who.year - from + 1} years`,
        brought || wronged
          ? `brought before it ${many(brought, "time", "times")}; wronged ${many(wronged, "time", "times")}`
          : "never brought before it, nor wronged",
      ),
      ...(held ? [stat("Now", sentence(held))] : []),
    ],
  });
  if (items.length) blocks.push({ type: "list", title: "Their cases", items });
  return blocks;
}

/** On a town's Its people tab: how its law reaches, and who of those named lean most to a wrong, and to which. */
export function townLeanBlocks(world: World, town: string, selves: readonly SelfRead[]): Block[] {
  const s = populationContext(world).settlements.get(town as Ref);
  if (!s || s.population <= 0 || !selves.length) return [];
  const f = factsOf(world, s, yearNow(world)),
    leans = selves.map((p) => {
      const lean = crimeLean(
          {
            traits: p.traits,
            standing: p.standing,
            hunger: p.wants.find((w) => w.kind === "food")?.pressing ?? 0,
            faith: p.land.barred ? (p.wants.find((w) => w.kind === "faith")?.pressing ?? 0) : 0,
          },
          f.scene,
        ),
        top = CRIME_KINDS.reduce((a, k) => (lean[k] > lean[a] ? k : a), CRIME_KINDS[0]);
      return { p, k: top, v: lean[top] };
    }),
    most = [...leans]
      .sort((a, b) => b.v - a.v)
      .filter((x) => x.v >= 1.25)
      .slice(0, 4),
    reach =
      f.scene.reach >= 0.7 ? "far" : f.scene.reach >= 0.45 ? "middling far" : "only a little way";
  return [
    {
      type: "facts",
      title: "What could lead them wrong",
      rows: [
        stat("The law reaches", reach, { why: "concept:self-crime" }),
        stat(
          "To hand",
          f.scene.opportunity >= 0.5
            ? "much: there is money here, or goods on the road, or homes left open"
            : "little",
        ),
        ...(f.scene.short ? [stat("A poor home", "goes short here")] : []),
      ],
    },
    ...(most.length
      ? [
          {
            type: "list" as const,
            title: "Those who lean most to a wrong",
            items: most.map((x) =>
              item(
                [link(x.p.who.name, x.p.who.ref), `: ${CRIME_WORDS[x.k]}, ${leanWord(x.v)}`],
                x.p.who.ref,
              ),
            ),
          },
        ]
      : []),
  ];
}

// —— Where a trial is told from: the group it is of, its head, a land's and a realm's underworld, one killed ——————————————

type Trial = {
  readonly town: Settlement;
  readonly year: number;
  readonly e: Entry;
  readonly light: Light;
};

/** The grave matters of some lands' chief towns, this year and last, that a test picks (their people unread). */
function trialsIn(world: World, cells: readonly number[], test: (d: Draft) => boolean): Trial[] {
  const year = yearNow(world),
    out: Trial[] = [],
    seen = new Set<string>();
  for (const cell of cells) {
    const t = chiefTown(world, cell);
    if (!t || seen.has(t.ref)) continue;
    seen.add(t.ref);
    for (const y of [year, year - 1]) {
      const light = graveOf(world, t, y);
      if (!light) continue;
      for (const e of light.entries)
        if (e.told && test(e.d) && (y < year || !e.d.brought ? world.now >= e.day * 86400 : true))
          out.push({ town: t, year: y, e, light });
    }
  }
  return out;
}

/** What came of a trial, where it can be said with the town's people unread: of one its roster doesn't hold. */
function trialCame(world: World, t: Trial): { outcome: Outcome | null; words: string } {
  const d = t.e.d;
  if (!d.brought) return { outcome: null, words: "no one was brought" };
  if (world.now < t.e.day * 86400 + 14 * 3600) return { outcome: null, words: "still to be heard" };
  if (!t.e.came) return { outcome: null, words: "one of the town was brought" };
  return { outcome: t.e.came.outcome, words: t.e.came.came.replace(/^was /, "") };
}

function trialItem(world: World, t: Trial): Item {
  const ref = `case:${t.town.ref}:${t.year}:${t.e.index}`,
    came = trialCame(world, t);
  return item(
    [
      `Year ${t.year}, at `,
      townLink(world, t.town.ref),
      ": ",
      link(
        t.e.d.brought ? GRAVE_NAMES[t.e.d.offence].toLowerCase() : "a killing no one answered for",
        ref,
      ),
      t.e.d.brought ? `: ${came.words}.` : ".",
    ],
    ref,
    t.year,
  );
}

/** A list of trials, the newest first, with how many of them a group's pay or its hold ended. */
function trialList(world: World, title: string, trials: readonly Trial[], most = 10): Block[] {
  if (!trials.length) return [];
  const sorted = [...trials].sort((a, b) => b.e.day - a.e.day),
    cames = sorted.map((t) => trialCame(world, t).outcome),
    bought = cames.filter((o) => o === "bought").length,
    silent = cames.filter((o) => o === "frightened").length,
    open = sorted.filter((t) => !t.e.d.brought).length,
    rows: Stat[] = [
      ...(bought ? [stat("Let go, those who judged being paid", `${count(bought)}`)] : []),
      ...(silent ? [stat("Let go, no one daring to speak", `${count(silent)}`)] : []),
      ...(open ? [stat("Killings no one was brought for", `${count(open)}`)] : []),
    ];
  return [
    ...(rows.length ? [{ type: "facts" as const, title, rows }] : []),
    {
      type: "list",
      title: rows.length ? "Its trials" : title,
      items: sorted.slice(0, most).map((t) => trialItem(world, t)),
      ...(sorted.length > most ? { more: sorted.length - most } : {}),
    },
  ];
}

/**
 * What a thing's page says of the courts: a group's own tried and those let go for its pay or its hold (`mob:`, `org:`), its head's
 * trial (`boss:`), the trials of a land's chief town and of a realm's groups' homes (on their Underworld tab), and the case of one
 * killed under the hand. Nothing where there is none.
 */
export function trialBlocks(world: World, ref: string): { tab: string | null; blocks: Block[] } {
  const none = { tab: null, blocks: [] };
  if (ref.startsWith("mob:") || ref.startsWith("org:")) {
    const lands = ref.startsWith("mob:")
      ? groupOf(world, ref)?.record?.lands
      : orgOf(world, ref)?.record?.lands;
    if (!lands?.length) return none;
    return {
      tab: null,
      blocks: trialList(
        world,
        "Before the courts",
        trialsIn(world, lands.slice(0, 8), (d) => d.group?.ref === ref),
      ),
    };
  }
  if (ref.startsWith("boss:")) {
    const m = /^boss:(pol:\d+:\d+):(ev:\d+:\d+)(?::\d+)?$/.exec(ref),
      home = m ? groupOf(world, `mob:${m[1]}:${m[2]}`)?.record?.home : undefined;
    if (!m || home === undefined) return none;
    const head = `boss:${m[1]}:${m[2]}`;
    return {
      tab: null,
      blocks: trialList(
        world,
        "Before the court",
        trialsIn(
          world,
          [home],
          (d) =>
            d.offence === "boss" &&
            d.stands.kind === "outside" &&
            d.stands.ref.startsWith(`${head}:`) &&
            (ref === head || d.stands.ref === ref),
        ),
      ),
    };
  }
  if (ref.startsWith("cell:")) {
    const cell = Number(ref.split(":")[2]),
      t = chiefTown(world, cell);
    if (!t) return none;
    const blocks = trialList(
      world,
      `Before the court of ${t.name}`,
      trialsIn(world, [cell], () => true),
      8,
    );
    if (blocks.length)
      blocks.push({
        type: "text",
        lines: [
          [
            "All of it, and its small wrongs: ",
            link(`the court of ${t.name}`, `${t.ref}#law`),
            ".",
          ],
        ],
      });
    return { tab: "underworld", blocks };
  }
  if (ref.startsWith("pol:")) {
    const r = politiesOf(world).get(ref as Ref),
      rec = r ? underworldOf(world)?.of(r.ref) : undefined;
    if (!r || !rec) return none;
    const cells = [...new Set([r.seat, ...rec.groups.map((g) => g.home)])].slice(0, 6);
    return {
      tab: "underworld",
      blocks: trialList(
        world,
        "Before its courts",
        trialsIn(world, cells, (d) => !!d.group || d.offence === "killing"),
        10,
      ),
    };
  }
  if (ref.startsWith("agent:")) {
    const hand = handOf(world).resting,
      year = yearNow(world);
    if (!hand || !(hand.gone ?? []).some((g) => `agent:${g.id}` === ref)) return none;
    const items: Item[] = [];
    for (const y of [year, year - 1]) {
      for (const c of casesOf(world, hand.village, y))
        if (c.victim?.ref === ref)
          items.push(
            item(
              [
                link(sentence(c.accused.name), c.ref),
                ` was brought for it in year ${c.year}. ${subject(c.accused)} ${c.came}.`,
              ],
              c.ref,
              c.year,
            ),
          );
      for (const o of openOf(world, hand.village, y))
        if (o.victim?.ref === ref)
          items.push(
            item([link("No one was brought for it", o.ref), `. ${o.unanswered}`], o.ref, o.year),
          );
    }
    return {
      tab: null,
      blocks: items.length ? [{ type: "list", title: "Before the court", items }] : [],
    };
  }
  return none;
}

/** A page with what the courts hold of it (see trialBlocks): on its Underworld tab where it has one, else its first. */
export function withTrials(world: World, ref: string, page: PageModel): PageModel {
  if (!/^(mob|org|boss|cell|pol|agent):/.test(ref)) return page;
  const { tab, blocks } = trialBlocks(world, ref);
  if (!blocks.length) return page;
  const at = tab ? page.tabs.findIndex((t) => t.id === tab) : 0;
  if (at < 0 || !page.tabs[at]) return page;
  return {
    ...page,
    tabs: page.tabs.map((t, i) => (i === at ? { ...t, blocks: [...t.blocks, ...blocks] } : t)),
  };
}

/** A world's readings let go, for a test that changes what they are read of. */
export function forgetDockets(world: World): void {
  KEPT.delete(world);
  LIGHT.delete(world);
}
