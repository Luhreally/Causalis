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
} from "../../rules/index.ts";
import {
  BOND,
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
  warsOf,
  type Polity,
  type RealmOrder,
  type Settlement,
} from "../../sim/index.ts";
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
import { folkWork, levyHead, linesOf, townRoster, workOf } from "../roster.ts";
import { landPast } from "../past.ts";
import { goodCoin, boardRef } from "./board.ts";
import { coinWords } from "./living.ts";
import { memoryOf } from "./memory.ts";
import { landLink, realmLink, townLink } from "./names.ts";
import { count, item, link, many, sentence, stat, yearNow } from "./words.ts";

export type Offence =
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
  | "flight";

/** One of a town named in a case: their page, their name, as old as they were then. */
export type Party = {
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
};

const MOST_CASES = 14;
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
  readonly offences: readonly Offence[];
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
  } else if (fed < 0.97) {
    hungry = Math.min(1, (0.97 - fed) * 6);
    causes.push({
      line: [
        `It was a lean year. `,
        landLink(world, cell, true),
        ` grew ${pct(fed)} in a hundred of what it needed to eat.`,
      ],
      weight: 0.4 + 2 * hungry,
      offences: ["stores", "bread"],
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
    lets = land >= 0 && land < 2,
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
          line: [
            "Their realm was at war: ",
            link("the war", w.ref),
            ", and the levy called again.",
          ],
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
  if (order && realm && form !== "hive" && lawThen(world, order, "faith", year) === 0) {
    const here = beliefOf(world).of(cell).faith,
      seat = beliefOf(world).of(realm.seat).faith;
    if (here && seat && here !== seat)
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

  // How many: by its size and what weighs on it; a loose law more, one law for all fewer. Sizes in half-steps, so a year's growth doesn't move them.
  const size = Math.round(2 * Math.log10(Math.max(10, s.population))) / 2,
    loose = !realm ? 0.25 : order && order.legitimacy < 0.42 ? 0.35 : 0,
    strictLaw = justice === 2 ? -0.3 : 0,
    weigh =
      0.5 +
      1.5 * hungry +
      0.9 * war +
      (short ? 0.5 * Math.max(0, Math.min(1, (dear - 0.8) / 1.2)) : 0) +
      (rich ? 0.3 : 0) +
      (angry ? 0.4 : 0) +
      loose +
      strictLaw,
    // (And a town's own temper: some keep the peace better than their neighbours, year on year.)
    temper = 0.55 + 1.2 * u(hashString(`temper ${s.ref}`) >>> 0, 1),
    rate = Math.max(0.25, (size - 1) * 0.7) * Math.max(0.25, weigh) * temper;

  const convicts =
    !!order && (order.firsts[BOND.convict] ?? null) !== null && form !== "hive" && form !== "reef";
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
  };
}

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

type Folk = {
  readonly lines: number;
  /** One of the town by a draw: someone grown who holds their place there that year (null: none). */
  pick(h: number, n: number, not: ReadonlySet<string>): Party | null;
  /** One this battle's levy stood in (a deserter), by a draw. */
  levied(h: number, not: ReadonlySet<string>): Party | null;
};

function folkOf(world: World, s: Settlement, year: number): Folk {
  const ctx = populationContext(world),
    grown = lifeOf(world).adulthood,
    hand = handOf(world).resting;
  // Under the hand everyone in the town is someone: the hand's people.
  if (hand && hand.village === s.ref) {
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
      pick: (h, n, not) => {
        if (!list.length) return null;
        for (let k = 0; k < 8; k++) {
          const a = list[Math.floor(u(h, n + k) * list.length)]!;
          if (!not.has(`agent:${a.id}`)) return party(a);
        }
        return null;
      },
      levied: () => null,
    };
  }
  const lines = linesOf(s.population),
    roster = townRoster(world, s.ref, year),
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
    pick: (h, n, not) => {
      if (!pool) return null;
      for (let k = 0; k < 12; k++) {
        const holder = roster.holder(Math.floor(u(h, n + k) * pool));
        if (!holder || year - holder.born < grown || not.has(holder.ref)) continue;
        return party(holder);
      }
      return null;
    },
    levied: (h, not) => {
      const b = roster.battles.findLast((x) => x.year < year && x.year >= year - 3);
      if (!b) return null;
      const men = levyHead(roster, b.event, b.side, [0, 0, 8])[2];
      if (!men.length) return null;
      for (let k = 0; k < men.length; k++) {
        const m = men[(Math.floor(u(h, 40) * men.length) + k) % men.length]!,
          now = roster.holder(m.line);
        if (now && now.n === m.holder.n && !not.has(now.ref) && year - now.born >= grown)
          return party(now);
      }
      return null;
    },
  };
}

// —— What they did, and what came of it ——————————————————————————————————————————————————————

const GRAVITY: Readonly<Record<Offence, 1 | 2 | 3>> = {
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
function deedOf(f: Facts, o: Offence, w: Party | null, h: number): Line {
  const them: Span = w ? link(w.name, w.ref) : "a neighbour",
    pick = <T>(l: readonly T[]): T => l[Math.floor(u(h, 11) * l.length)]!,
    food = f.food;
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
        ? [pick(["stole from the market stall of ", "took goods from the stall of "]), them]
        : [pick(["stole from the store of ", "took goods from the workshop of "]), them];
    case "house":
      return [pick(["robbed the home of ", "took what was of worth from the home of "]), them];
    case "road":
      return ["robbed ", them, pick([", carrying goods on the road", ", on the road out of town"])];
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
      return ["came to blows with ", them, " in the square"];
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

const NEEDS_WRONGED: Readonly<Record<Offence, boolean>> = {
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

/** What a court here can do, by what they did, how it holds and who they are. */
function sentenceOf(f: Facts, o: Offence, h: number): CourtSentence {
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
): { came: string; cost: string } {
  const worth = g * (4 + Math.floor(u(h, 25) * 10)),
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
        came: "was found not guilty by the bench, and went home",
        cost: "Nothing but the days it took, and what the neighbours say.",
      };
    case "bribe":
      return {
        came: "was let go, and it is said the magistrate was paid",
        cost: `${paid}, to no one who would say so.`,
      };
    case "fine":
      return f.form === "kin"
        ? { came: `paid a blood-price to those they wronged`, cost: `${sentence(paid)}.` }
        : f.form === "elders" || reef
          ? {
              came: "was told to make it good, and did",
              cost: `${sentence(paid)}, handed over before everyone.`,
            }
          : { came: `was fined`, cost: `${sentence(paid)}, paid at the bench.` };
    case "shame":
      return hive
        ? {
            came: "was turned from: for a season no one works beside them, or feeds them first",
            cost: "A season alone among all of them.",
          }
        : {
            came: "was stood in the ring and named before everyone",
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
              came: "was sent out on the current for two years",
              cost: "Two years of their home, and everyone they knew.",
            }
          : {
              came: "was walked out of town and sent away for two years",
              cost: "Two years of their home, and everyone they knew.",
            };
  }
}

// —— The reading ——————————————————————————————————————————————————————————————————————————————

type Kept = { hand: string; byKey: Map<string, readonly Case[]> };
const KEPT = new WeakMap<World, Kept>();

/** A town's cases of a year: once for each, as long as the god's hand rests where it did. */
export function casesOf(world: World, town: string, year: number): readonly Case[] {
  const hand = handOf(world).resting?.village ?? "";
  let kept = KEPT.get(world);
  if (!kept || kept.hand !== hand) KEPT.set(world, (kept = { hand, byKey: new Map() }));
  const key = `${town}|${year}`,
    known = kept.byKey.get(key);
  if (known) return known;
  const s = populationContext(world).settlements.get(town as Ref),
    made = s && s.population > 0 && s.founded < year ? readCases(world, s, year) : [];
  if (kept.byKey.size > 6000) kept.byKey.clear();
  kept.byKey.set(key, made);
  return made;
}

/** Those sent away in the year before, or still shut up from it: not to be brought up again. */
function awayFrom(world: World, town: string, year: number): ReadonlySet<string> {
  const out = new Set<string>();
  const s = populationContext(world).settlements.get(town as Ref);
  if (!s || s.population <= 0 || s.founded >= year - 1) return out;
  for (const c of rawCases(world, s, year - 1)) out.add(c.accused.ref);
  return out;
}

const RAW = new WeakMap<World, Map<string, readonly Case[]>>();
function rawCases(world: World, s: Settlement, year: number): readonly Case[] {
  let m = RAW.get(world);
  if (!m) RAW.set(world, (m = new Map()));
  const key = `${s.ref}|${year}|${handOf(world).resting?.village ?? ""}`,
    known = m.get(key);
  if (known) return known;
  const made = drawCases(world, s, year, new Set());
  if (m.size > 6000) m.clear();
  m.set(key, made);
  return made;
}

function readCases(world: World, s: Settlement, year: number): readonly Case[] {
  return drawCases(world, s, year, awayFrom(world, s.ref, year));
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

function drawCases(
  world: World,
  s: Settlement,
  year: number,
  away: ReadonlySet<string>,
): readonly Case[] {
  const f = factsOf(world, s, year),
    folk = folkOf(world, s, year),
    want = dueOf(f),
    all = f.causes.reduce((n, c) => n + c.weight, 0),
    out: Case[] = [],
    taken = new Set<string>(away),
    yearDay = year * DAYS_A_YEAR;
  if (!all || !folk.lines) return out;
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
      accused = offence === "desert" ? folk.levied(h, taken) : folk.pick(h, 100, taken);
    if (!accused) continue;
    taken.add(accused.ref);
    const wronged = NEEDS_WRONGED[offence] ? folk.pick(h, 200, new Set([...taken])) : null;
    // (Not one the whole town could not name: a town of one person has no one to wrong.)
    if (NEEDS_WRONGED[offence] && !wronged) continue;
    const sentenceWord = sentenceOf(f, offence, h),
      days = daysOf(sentenceWord, GRAVITY[offence], h),
      told = cameOf(f, sentenceWord, GRAVITY[offence], days, h),
      what = deedOf(f, offence, wronged, h),
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
    });
  }
  return out;
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
  for (const c of last) if (c.sentence === "banish") away.add(c.accused.ref);
  for (const c of [...now, ...last])
    for (const p of [c.accused, c.wronged])
      if (p && !seen.has(p.ref)) {
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

const OFFENCE_NAMES: Readonly<Record<Offence, string>> = {
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
const heard = (world: World, c: Case): boolean => world.now >= c.day * 86400 + 14 * 3600;
const sitting = (world: World, c: Case): boolean =>
  !heard(world, c) && world.now >= c.day * 86400 + 8.5 * 3600;

const firstName = (p: Party): string => p.name.split(" ")[0]!;

function caseItem(world: World, c: Case): Item {
  return item(
    heard(world, c)
      ? [
          link(c.accused.name, c.ref),
          `, ${c.accused.age}, ${c.whatWords}. ${firstName(c.accused)} ${c.came}.`,
        ]
      : [
          link(c.accused.name, c.ref),
          `, ${c.accused.age}, ${c.whatWords}. ${sitting(world, c) ? "It is being heard today." : "To be heard later this year."}`,
        ],
    c.ref,
    c.year,
  );
}

/** Whose sentence runs now: the page's "held" list. */
function heldNow(world: World, town: string): readonly Case[] {
  const year = yearNow(world),
    day = world.now / 86400;
  return [...casesOf(world, town, year), ...casesOf(world, town, year - 1)].filter(
    (c) =>
      (c.sentence === "cell" ||
        c.sentence === "stocks" ||
        c.sentence === "labour" ||
        c.sentence === "banish") &&
      day >= c.day &&
      day < c.day + c.days,
  );
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
        ],
      },
      { type: "text", title: words.title, lines: [[words.line]] },
    ];
  if (compare)
    blocks.push({ type: "text", title: "Beside its land's other towns", lines: [compare] });
  if (held.length)
    blocks.push({
      type: "list",
      title: "Held now",
      items: held.map((c) =>
        item([link(c.accused.name, c.ref), `, who ${c.came}.`], c.ref, c.year),
      ),
    });
  blocks.push(
    done.length
      ? { type: "list", title: "Heard this year", items: done.map((c) => caseItem(world, c)) }
      : {
          type: "text",
          title: "Heard this year",
          lines: [
            [
              coming.length
                ? "No one yet."
                : "No one has been brought before them this year. It has been quiet.",
            ],
          ],
        },
  );
  if (coming.length)
    blocks.push({
      type: "list",
      title: "To be heard",
      items: coming.map((c) => caseItem(world, c)),
    });
  if (last.length)
    blocks.push({ type: "list", title: "Last year", items: last.map((c) => caseItem(world, c)) });
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
  const c = casesOf(world, m[1]!, Number(m[2])).find((x) => x.index === Number(m[3]));
  if (!c) return lostPage(world, ref);
  const s = populationContext(world).settlements.get(c.town as Ref)!,
    words = COURT_WORDS[c.form],
    done = heard(world, c),
    home = homeOf(world, c.town, c.accused),
    theirNow = nowWords(world, c, c.accused),
    wrongedNow = c.wronged ? nowWords(world, c, c.wronged) : null,
    year = yearNow(world),
    rows: Stat[] = [
      stat("Brought", [
        link(c.accused.name, c.accused.ref),
        `, ${c.accused.age}, ${article(c.accused.work)} of `,
        townLink(world, c.town),
      ]),
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
        lines: [[link(c.accused.name, c.accused.ref), " ", ...c.what, "."]],
      },
      { type: "text", title: "Why", lines: c.why.map((l) => [...l]) },
      {
        type: "text",
        title: "What came of it",
        lines: done
          ? [
              [`${c.accused.name} ${c.came}.`],
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
            "History counts a town's hungry, its prices and its wars, and doesn't keep its court's book. A case is read from those: the same town, the same year, the same case, each time.",
          ],
        ],
      },
    ];
  return {
    ref,
    kind: "event",
    icon: "⚖️",
    title: `${OFFENCE_NAMES[c.offence]}: ${c.accused.name}`,
    subtitle: [`${words.title} of `, townLink(world, c.town), `, year ${c.year}`],
    color: null,
    place: { scale: "village", town: c.town, stone: ref },
    stats: [stat("Year", `${c.year}`), stat("Town", [townLink(world, c.town)])],
    tabs: [{ id: "overview", name: "Overview", blocks }],
    followable: false,
    year,
  };
}

const article = (word: string): string => (/^[aeiou]/.test(word) ? `an ${word}` : `a ${word}`);

/** A person's cases, for their own page ("Before the law"; null: none). */
export function lawBlock(world: World, town: string, ref: string): Block | null {
  const year = yearNow(world),
    items: Item[] = [];
  for (const y of [year, year - 1])
    for (const c of casesOf(world, town, y)) {
      if (c.accused.ref === ref && heard(world, c))
        items.push(
          item(
            [
              link(`Year ${c.year}: ${OFFENCE_NAMES[c.offence].toLowerCase()}`, c.ref),
              `. ${firstName(c.accused)} ${c.came}.`,
            ],
            c.ref,
            c.year,
          ),
        );
      else if (c.wronged?.ref === ref && heard(world, c))
        items.push(
          item([link(c.accused.name, c.ref), ` ${c.whatWords}, in year ${c.year}.`], c.ref, c.year),
        );
    }
  return items.length ? { type: "list", title: "Before the law", items } : null;
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

/** A town's court, as its plan carries it (absent: no one lives there, or no one is ever heard). */
export function courtIn(world: World, ref: string): { court?: TownCourt } {
  const s = populationContext(world).settlements.get(ref as Ref);
  if (!s || s.population <= 0) return {};
  const year = yearNow(world),
    f = factsOf(world, s, year),
    sittings = [...casesOf(world, ref, year - 1), ...casesOf(world, ref, year)]
      .filter((c) => c.year === year || c.day + c.days >= year * DAYS_A_YEAR)
      .map((c) => ({
        ref: c.ref,
        day: c.day,
        accused: c.accused.ref,
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
