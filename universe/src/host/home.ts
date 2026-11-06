// A home looked into (Lives L6), the host's part: what is true of a home of a town, read off the plan the view draws, its land's
// market and lore, its realm's law, and furnished by rules/dwelling.ts. Nothing here is kept, drawn from history's streams or read
// by the simulation: the same home holds the same things every time, and asking moves nothing.
import { hashString, YEAR, type Ref, type World } from "../kernel/index.ts";
import {
  BLOCK_LOTS,
  LOT,
  lotStates,
  townLots,
  type HomeInside,
  type HomeMoney,
  type VillagePlan,
} from "../bridge/index.ts";
import {
  COIN_WORDS,
  DAY_WAGE,
  FAMILY_SIZE,
  G,
  GOODS,
  HOME_LEVELS,
  HOME_STOREYS,
  OCC,
  RENT_DAY,
  REIGN,
  ROOM_UNIT,
  WAGE_GOOD,
  coinBand,
  dayWage,
  furnish,
  priceTerm,
  reachIn,
  reckonDay,
  standingOf,
  usualPrice,
  wageTimes,
  type DayReckoned,
  type DwellingFacts,
} from "../rules/index.ts";
import {
  WAY,
  cultureOf,
  ecologyOf,
  handOf,
  homePlanet,
  lawOf,
  loreOf,
  marketsOf,
  orderOf,
  politiesOf,
  populationContext,
  toolMetal,
} from "../sim/index.ts";
import { meansOfWorld } from "../gen/index.ts";
import type { QueryHandler } from "./host.ts";

/** The least spread a town's lens is laid over: as many times over, from its poorest to its richest. */
const MONEY_LEAST_SPREAD = 6;
/** A home of a village's ring, not of a lot of its plan, is numbered past any lot. */
export const RING_HOME = 1_000_000;
/** What a home's page is, and what a thing in it is. */
export const dwellRef = (town: string, n: number): string => `dwell:${town}:${n}`;
export const dweltRef = (town: string, n: number, thing: number): string =>
  `dwelt:${town}:${n}:${thing}`;

/** The town and numbers of a home's or a thing's page (null: it is neither). */
export function dwellOf(ref: string): { town: string; n: number; thing: number | null } | null {
  const parts = ref.split(":"),
    tail = parts[0] === "dwelt" ? 2 : 1;
  if ((parts[0] !== "dwell" && parts[0] !== "dwelt") || parts.length < 2 + tail) return null;
  const town = parts.slice(1, -tail).join(":"),
    n = Number(parts.at(-tail)),
    thing = tail === 2 ? Number(parts.at(-1)) : null;
  if (!Number.isInteger(n) || n < 0 || (thing !== null && !Number.isInteger(thing))) return null;
  return { town, n, thing };
}

/** The plan the view draws, as last asked of the town, or read as it would be (see planet.ts). */
let reader: ((world: World, town: string) => VillagePlan | null) | null = null;
export function homePlanReader(f: (world: World, town: string) => VillagePlan | null): void {
  reader = f;
}
const KEPT = new WeakMap<World, { town: string; year: number; plan: VillagePlan }>();
/** A plan as the view was given it: who lives where is as the view draws it. */
export function planDrawn<T extends VillagePlan>(world: World, plan: T): T {
  KEPT.set(world, { town: plan.ref, year: Math.floor(world.now / YEAR), plan });
  return plan;
}
function planOf(world: World, town: string): VillagePlan | null {
  const kept = KEPT.get(world);
  if (kept && kept.town === town && kept.year === Math.floor(world.now / YEAR)) return kept.plan;
  try {
    return reader?.(world, town) ?? null;
  } catch {
    return null;
  }
}

/** What is true of a home, read off its town: where it stands, what stands there, who lives there. */
export type HomeRead = {
  readonly plan: VillagePlan;
  readonly n: number;
  readonly lot: number;
  readonly k: number;
  readonly state: HomeInside["state"];
  readonly level: number;
  readonly house: { walls: string; roof: string; form: string; pitch: number };
  readonly run: readonly number[] | null;
  readonly residents: readonly number[];
  readonly cell: number;
};

/** A plan read once, whichever or however many of its homes are asked: its lots, which home of the plan stands on which, who lives in each. */
type PlanRead = {
  readonly states: ReturnType<typeof lotStates> | null;
  readonly lots: ReturnType<typeof townLots> | null;
  readonly homeOn: ReadonlyMap<number, number>;
  readonly lotOf: ReadonlyMap<number, number>;
  readonly folkIn: ReadonlyMap<number, readonly number[]>;
};
const READS = new WeakMap<VillagePlan, PlanRead>();
function planRead(plan: VillagePlan): PlanRead {
  const hit = READS.get(plan);
  if (hit) return hit;
  const t = plan.town,
    states = t ? lotStates(t) : null,
    lots = t ? townLots(t.family, t.seed, t.axis, t.lots, t.water) : null,
    homeOn = new Map<number, number>(),
    lotOf = new Map<number, number>(),
    folkIn = new Map<number, number[]>();
  if (t && lots) {
    const spot = (x: number, z: number) => `${Math.round(x)}|${Math.round(z)}`,
      at = new Map<string, number>();
    plan.homes.forEach((h, k) => {
      if (!at.has(spot(h.x, h.z))) at.set(spot(h.x, h.z), k);
    });
    for (let p = 0; p < t.lots; p++) {
      const k = at.get(spot(lots.x[p]!, lots.z[p]!));
      if (k === undefined || homeOn.has(p) || lotOf.has(k)) continue;
      const h = plan.homes[k]!;
      if (Math.hypot(h.x - lots.x[p]!, h.z - lots.z[p]!) >= 0.5) continue;
      homeOn.set(p, k);
      lotOf.set(k, p);
    }
  }
  plan.people.forEach((p, i) => {
    if (p.gone !== undefined) return;
    const here = folkIn.get(p.home);
    if (here) here.push(i);
    else folkIn.set(p.home, [i]);
  });
  const read = { states, lots, homeOn, lotOf, folkIn };
  READS.set(plan, read);
  return read;
}

/** The number a home of the plan goes by (a lot's, or past any lot: a village's ring). */
export function homeNumberOf(plan: VillagePlan, k: number): number {
  return planRead(plan).lotOf.get(k) ?? RING_HOME + k;
}

/** A home's measures alone, the least asked of it: as cheap as a lookup. */
function lotRead(
  world: World,
  plan: VillagePlan,
  n: number,
): Pick<HomeRead, "n" | "lot" | "k" | "state" | "level" | "residents"> | null {
  const read = planRead(plan);
  if (n >= RING_HOME) {
    const k = n - RING_HOME;
    return plan.homes[k]
      ? { n, lot: -1, k, state: "stands", level: 0, residents: read.folkIn.get(k) ?? [] }
      : null;
  }
  const t = plan.town,
    states = read.states;
  if (!t || !states || n >= t.lots) return null;
  const k = read.homeOn.get(n) ?? -1,
    what = states.what[n]!,
    state: HomeInside["state"] =
      what === LOT.home
        ? states.began[n]! + states.takes[n]! > world.now
          ? "rising"
          : "stands"
        : what === LOT.fallen
          ? "fell"
          : what === LOT.razed
            ? "razed"
            : "open";
  return {
    n,
    lot: n,
    k,
    state,
    level: Math.max(0, states.level[n]!),
    residents: k >= 0 && state === "stands" ? (read.folkIn.get(k) ?? []) : [],
  };
}

/** A home of a town by its number (null: no such home, nor any trace of one). */
export function homeRead(world: World, town: string, n: number): HomeRead | null {
  const plan = planOf(world, town);
  if (!plan) return null;
  const at = lotRead(world, plan, n);
  if (!at) return null;
  const cell = plan.cell ?? -1,
    t = plan.town;
  if (n >= RING_HOME || !t) return { ...at, plan, house: plan.house, run: null, cell };
  const states = planRead(plan).states!,
    design = t.designs[states.design[n]!],
    run = t.runs.find((r) => r[1]! <= n && n < r[2]!) ?? null;
  return { ...at, plan, house: design ?? plan.house, run, cell };
}

const OCC_WORD: Readonly<Record<number, string>> = {
  [OCC.forager]: "forager",
  [OCC.farmer]: "farmer",
  [OCC.herder]: "herder",
  [OCC.crafter]: "crafter",
  [OCC.trader]: "trader",
};

/** What a land knows, as a people of another world's age has it, whose lore is not kept (Phase 69). */
const AGE_KNOWS: Readonly<Record<string, readonly string[]>> = {
  forage: [],
  farm: ["dyeing"],
  metal: ["dyeing", "carpentry", "masonry", "writing"],
  industry: [
    "dyeing",
    "carpentry",
    "masonry",
    "writing",
    "glass",
    "clockwork",
    "coal-mining",
    "steam-engine",
  ],
  modern: [
    "dyeing",
    "carpentry",
    "masonry",
    "writing",
    "glass",
    "clockwork",
    "coal-mining",
    "steam-engine",
    "electricity",
    "electronics",
    "sanitation",
  ],
};

/** What a land made last year, a head, at its goods' usual worth (the L2 book's own reckoning for a land). */
export function landMadeHead(world: World, cell: number): number {
  const m = marketsOf(world).get(cell),
    people = populationContext(world).provinces.get(cell)?.total() ?? 0;
  if (!m || people <= 0) return 0;
  let made = 0;
  for (let g = 0; g < GOODS.length; g++)
    made += (m.years.at(-1)?.ledger[0]?.[g] ?? 0) * GOODS[g]!.value;
  return made / people;
}

/** A land's law of land, and the realm that holds it (null: none is kept). */
function lawOfLand(
  world: World,
  cell: number,
): { readonly position: number; readonly realm: Ref } | null {
  const realm = politiesOf(world).of(cell),
    order = realm ? orderOf(world)?.of(realm.ref) : null;
  return realm && order ? { position: lawOf(order, "land").position, realm: realm.ref } : null;
}

/** What they pay to live there and to whom, as that law has it. */
function rentByLaw(
  law: { readonly position: number; readonly realm: Ref } | null,
  level: number,
): { readonly pays: number; readonly words: string; readonly to: Ref | null } | null {
  if (!law) return null;
  const { position, realm } = law,
    day = `${RENT_DAY} coin a day`;
  if (position === 0)
    return {
      pays: RENT_DAY,
      words: `Land here is the lord's: they owe him ${day}. History does not name him, unless it be the ruler of `,
      to: realm,
    };
  if (position === 1 || level >= 3)
    return {
      pays: RENT_DAY,
      words: `${position === 1 ? "Land here is leased" : "A tall home is let by the floor"}: they pay ${day}, to a landlord history does not name, under the law of `,
      to: realm,
    };
  return {
    pays: 0,
    words: "They own it: land here is the tiller's own, by the law of ",
    to: realm,
  };
}

/** What they pay to live there and to whom, as its realm's law of land has it (null: no rent is known). */
export function rentOf(
  world: World,
  cell: number,
  level: number,
): { readonly pays: number; readonly words: string; readonly to: Ref | null } | null {
  return rentByLaw(lawOfLand(world, cell), level);
}

/** What a town's homes are all reckoned from: read once, for one home or for all of them. */
type TownLedger = {
  readonly price: (good: number) => number;
  /** A person's bread for a day, in coin. */
  readonly bread: number;
  readonly madeHead: number;
  readonly noHouses: boolean;
  readonly law: ReturnType<typeof lawOfLand>;
};
function townLedger(world: World, plan: VillagePlan): TownLedger {
  const cell = plan.cell ?? -1,
    market = marketsOf(world).get(cell),
    price = (g: number) => market?.price[g] ?? usualPrice(g),
    way = cultureOf(world).get(cell)?.traits[WAY.kinship];
  return {
    price,
    bread: Math.max(0.3, price(G.grain) / GOODS[G.grain]!.value),
    madeHead: plan.native ? 4 : landMadeHead(world, cell),
    noHouses: !plan.native && way !== undefined && way < REIGN.noHouses,
    law: plan.native ? null : lawOfLand(world, cell),
  };
}

/** A day's work of one who has it, at their land's usual and this market's price of what it makes, in coin: nothing for a child. */
function wageAtUsual(ledger: TownLedger, occupation: number, child: boolean): number {
  if (child) return 0;
  const good = WAGE_GOOD[occupation] ?? -1;
  return (
    (DAY_WAGE[occupation] ?? 0) * priceTerm(good >= 0 ? ledger.price(good) / GOODS[good]!.value : 1)
  );
}

/** A home's day, the one reckoning: their furniture, their pages and the town's lens all read this. */
export type HomeReckoned = DayReckoned & {
  /** A person's bread for a day, and how many eat here. */
  readonly bread: number;
  readonly mouths: number;
  /** What a wage at the land's usual comes to here: their land's making, their standing, a seat at court. */
  readonly times: number;
  readonly court: boolean;
  /** One who rules from here: it goes with the seat. */
  readonly seated: boolean;
  /** No one grown is named here: two at the land's first work are reckoned. */
  readonly unnamed: boolean;
};

function reckonHome(
  plan: VillagePlan,
  r: Pick<HomeRead, "n" | "lot" | "k" | "state" | "level" | "residents">,
  ledger: TownLedger,
): HomeReckoned {
  const people = r.residents.map((i) => plan.people[i]!),
    grown = people.filter((p) => !p.child),
    wages = grown.length
      ? grown.reduce((sum, p) => sum + wageAtUsual(ledger, p.occupation, false), 0)
      : 2 * (DAY_WAGE[OCC.farmer] ?? 3),
    whole = plan.town?.whole ?? plan.homes.length,
    place = Math.max(0, r.lot >= 0 ? r.lot : r.k),
    unit = (key: string) => (hashString(key) >>> 0) / 2 ** 32,
    heart = 1 - Math.min(1, Math.sqrt(place / Math.max(1, whole))),
    standing = standingOf(
      heart,
      unit(`${plan.ref}:street:${Math.floor(place / BLOCK_LOTS)}`),
      unit(`${plan.ref}:${r.n}`),
    ),
    court = people.some((p) => p.figure),
    seated = people.some((p) => p.figure?.startsWith("rule:")),
    rent =
      plan.native || r.state !== "stands" || ledger.noHouses || seated
        ? null
        : rentByLaw(ledger.law, r.level),
    mouths = people.length || FAMILY_SIZE,
    day = reckonDay({
      wages,
      bread: ledger.bread,
      mouths,
      madeHead: ledger.madeHead,
      standing,
      court,
      rent: rent?.pays ?? 0,
    });
  return {
    ...day,
    bread: ledger.bread,
    mouths,
    times: wageTimes(ledger.madeHead, standing, court),
    court,
    seated,
    unnamed: !grown.length,
  };
}

/** The facts a home's things are chosen from. */
export function homeFacts(world: World, r: HomeRead): DwellingFacts {
  const { plan, cell } = r,
    body = plan.body,
    gen = homePlanet(world).generated,
    means = meansOfWorld(gen),
    market = marketsOf(world).get(cell),
    lore = loreOf(world),
    era = plan.era ?? "farm",
    knows = (id: string) =>
      plan.native ? (AGE_KNOWS[era] ?? []).includes(id) : !!lore.get(cell, id),
    people = r.residents.map((i) => plan.people[i]!),
    ledger = townLedger(world, plan),
    day = reckonHome(plan, r, ledger),
    forest = ecologyOf(world).get(cell),
    bare = plan.lifeLook === "bare",
    fire = means.burns && body?.medium !== "water" && !plan.fireless,
    lived = !plan.native ? reachIn(means, knows) : false,
    court = day.court,
    work = people.flatMap((p) => {
      if (p.child) return [];
      const trade = p.trade?.kind,
        word =
          trade === "smith" || trade === "potter" || trade === "weaver"
            ? trade
            : (OCC_WORD[p.occupation] ?? null);
      return word ? [word] : [];
    });
  return {
    key: hashString(`${plan.ref}:${r.n}:home`) >>> 0,
    level: r.level,
    form: plan.town?.sealed ? "round" : r.house.form,
    walls: r.house.walls,
    people: people.length,
    medium: body?.medium ?? "land",
    grips: plan.native ? body?.manipulators !== "mandibles" : means.grips,
    scale: Math.max(0.6, Math.min(2.4, Math.cbrt((body?.size ?? 60) / 60))),
    burns: fire,
    heat: !fire && !plan.fireless && typeof lived === "number" && lived >= 700 ? "heat" : null,
    warmth: populationContext(world).generated.climate.temperature[cell] ?? 15,
    knows,
    coin: day.coin,
    price: ledger.price,
    // (Trees standing here, or a market that deals in what is made of them: wood comes down the road.)
    wood:
      !bare &&
      (!forest || forest.forest * forest.firstForest > 0.004 || (market?.stock[G.tools] ?? 0) > 0),
    cloth: !bare,
    vessel: era === "forage" ? null : (means.vessel?.name ?? null),
    metal: plan.native
      ? (plan.metal ?? "stone")
      : toolMetal(populationContext(world), cell, Math.floor(world.now / YEAR)),
    work,
    fought: people.some((p) => p.war),
    court,
    noHouses: ledger.noHouses,
    ruin: r.state === "fell" ? 1 : r.state === "razed" ? 2 : 0,
  };
}

/** The family a name's last word tells (null: they keep no family's name). */
function familyName(plan: VillagePlan, residents: readonly number[]): string | null {
  const grown = residents.map((i) => plan.people[i]!).filter((p) => p.figure || !p.child);
  const named = (grown[0] ?? plan.people[residents[0] ?? -1])?.name;
  if (!named) return null;
  const words = named
    .replace(/ of .*$/, "")
    .trim()
    .split(/\s+/);
  return words.length > 1 ? words.at(-1)! : null;
}

/** What a home is called, as what is true of it says. */
export function homeTitle(r: HomeRead, f: DwellingFacts): string {
  const level = HOME_LEVELS[r.level] ?? "home",
    place = r.plan.name;
  if (r.state === "fell" || r.state === "razed") return `A ruined ${level} of ${place}`;
  if (r.state === "open") return `Open ground in ${place}`;
  if (f.noHouses) return `A sleeping hall of ${place}`;
  const family = familyName(r.plan, r.residents);
  return family ? `The ${family} home` : `A ${level} of ${place}`;
}

/** Its measures said: "one room", "a house of five rooms on two floors". */
export function homeLine(r: HomeRead, rooms: number, floors: number, people: number): string {
  if (r.state === "fell") return "Let fall, its people gone: no one lives here";
  if (r.state === "razed") return "Burnt or shaken down: no one lives here";
  if (r.state === "open") return "Nothing stands here";
  const roomWords = rooms === 1 ? "One room" : `${rooms} rooms`,
    onFloors = floors > 1 ? ` on ${floors} floors` : "",
    who =
      people === 0 ? "no one known living here" : people === 1 ? "one person" : `${people} people`;
  return `${roomWords}${onFloors}, ${who}`;
}

/** What they call a person's food for a day: a people of the water bake no bread. */
export const foodWord = (plan: VillagePlan): string =>
  plan.body?.medium === "water" ? "food" : "bread";

/** A home's insides as the view draws them (null: no such home). */
export function homeInside(world: World, town: string, n: number): HomeInside | null {
  const r = homeRead(world, town, n);
  if (!r) return null;
  const f = homeFacts(world, r),
    d = furnish(f),
    floors = 1 + Math.max(0, ...d.rooms.map((x) => x.floor)),
    storeys = HOME_STOREYS[r.level] ?? 1,
    storey = storeys > 3 ? 1 + Math.floor((((f.key >>> 3) % 1000) / 1000) * (storeys - 1)) : 0;
  return {
    ref: dwellRef(town, n),
    town,
    townName: r.plan.name,
    n,
    lot: r.lot,
    home: r.k,
    title: homeTitle(r, f),
    line: homeLine(r, d.rooms.length, floors, r.residents.length),
    state: r.state,
    level: r.level,
    storeys,
    storey,
    form: f.form,
    walls: r.house.walls,
    roof: r.house.roof,
    pitch: r.house.pitch,
    scale: ROOM_UNIT * f.scale,
    medium: f.medium,
    coin: f.coin,
    spent: d.spent,
    residents: r.residents,
    noHouses: f.noHouses,
    dwelling: d,
  };
}

/** The homes of a town drawn, each as what is true of it says: the look tools'. */
export function homeSurvey(
  world: World,
  town: string,
): readonly {
  readonly n: number;
  readonly level: number;
  readonly state: string;
  readonly coin: number;
  readonly rooms: number;
  readonly people: number;
  readonly figure: boolean;
}[] {
  const plan = planOf(world, town);
  if (!plan) return [];
  const out = [];
  const numbers = plan.town
    ? Array.from({ length: Math.min(plan.town.lots, 600) }, (_, p) => p)
    : plan.homes.map((_, k) => RING_HOME + k);
  for (const n of numbers) {
    const r = homeRead(world, town, n);
    if (!r || r.state === "open") continue;
    const f = homeFacts(world, r),
      d = furnish(f);
    out.push({
      n,
      level: r.level,
      state: r.state,
      coin: f.coin,
      rooms: d.rooms.length,
      people: r.residents.length,
      figure: f.court,
    });
  }
  return out;
}

/** A town's homes as the lens colours them: what each can spend, from the one reckoning, furnishing none of them. */
export function homeMoney(world: World, town: string): HomeMoney | null {
  const plan = planOf(world, town);
  if (!plan) return null;
  const ledger = townLedger(world, plan),
    numbers = plan.town
      ? Array.from({ length: plan.town.lots }, (_, p) => p)
      : plan.homes.map((_, k) => RING_HOME + k),
    n: number[] = [],
    coin: number[] = [],
    lets: number[] = [],
    counts = COIN_WORDS.map(() => 0);
  let ruins = 0,
    rented = 0,
    standing = 0;
  for (const m of numbers) {
    const r = lotRead(world, plan, m);
    if (!r || r.state === "open") continue;
    n.push(m);
    if (r.state === "fell" || r.state === "razed") {
      coin.push(-1);
      lets.push(0);
      ruins++;
      continue;
    }
    const day = reckonHome(plan, r, ledger);
    coin.push(Math.round(day.coin));
    counts[coinBand(day.coin)]!++;
    standing++;
    lets.push(day.rent > 0 ? 1 : 0);
    if (day.rent > 0) rented++;
  }
  const position = ledger.law?.position ?? null,
    spread = coin.filter((c) => c >= 0).sort((a, b) => a - b),
    atLeast = spread[Math.floor(spread.length * 0.03)] ?? 0,
    atMost = spread[Math.floor(spread.length * 0.97)] ?? atLeast,
    // (Nearly alike, they stay nearly one colour: a spread of less than this is laid about its middle.)
    wide = Math.max(1, MONEY_LEAST_SPREAD / (atMost / Math.max(1, atLeast))),
    lo = spread.length ? Math.max(1, atLeast) / Math.sqrt(wide) : 0,
    hi = spread.length ? Math.max(1, atMost) * Math.sqrt(wide) : 0;
  return {
    town,
    year: Math.floor(world.now / YEAR),
    n,
    coin,
    lets,
    counts,
    ruins,
    words: COIN_WORDS,
    lo,
    hi,
    tenure: ledger.noHouses
      ? "halls"
      : plan.native || position === null
        ? "untold"
        : standing === 0
          ? "none"
          : rented === standing
            ? position === 0
              ? "lord"
              : "leased"
            : rented === 0
              ? "owned"
              : "mixed",
  };
}

/** Where someone lives and what their day comes to (null: they are not among those their town draws). */
export type PersonLiving = {
  readonly r: HomeRead;
  readonly who: VillagePlan["people"][number];
  readonly day: HomeReckoned;
  /** What their own day's work brings in, in coin. */
  readonly wage: number;
  /** One lived: what is in their purse (else null). */
  readonly purse: number | null;
};

/** The one a ref is, among those a plan draws. */
function drawnAs(plan: VillagePlan, ref: string): number {
  const seat = /^seat:(.+):([a-z]+):(\d+)$/.exec(ref);
  return plan.people.findIndex(
    (p) =>
      p.gone === undefined &&
      (p.ref === ref ||
        p.figure === ref ||
        (ref === `heal:${plan.ref}` && !!p.healer) ||
        (!!seat &&
          seat[1] === plan.ref &&
          p.trade?.kind === seat[2] &&
          p.trade?.seat === Number(seat[3]))),
  );
}

/** Where someone lives: in the town the view has up if they are drawn there, else in the one given. */
export function personLiving(world: World, ref: string, town: string | null): PersonLiving | null {
  const kept = KEPT.get(world),
    there =
      kept && kept.year === Math.floor(world.now / YEAR) && drawnAs(kept.plan, ref) >= 0
        ? kept.town
        : town,
    plan = there ? planOf(world, there) : null;
  if (!there || !plan) return null;
  const i = drawnAs(plan, ref);
  if (i < 0) return null;
  const who = plan.people[i]!,
    r = plan.homes[who.home] ? homeRead(world, there, homeNumberOf(plan, who.home)) : null;
  if (!r || r.state === "open") return null;
  const ledger = townLedger(world, plan),
    day = reckonHome(plan, r, ledger),
    // (One lived has their own purse and their own day: what their strip says.)
    life = handOf(world).resting?.life;
  if (life && who.ref === `agent:${life.agent}`) {
    const ratio = (occupation: number) => {
        const good = WAGE_GOOD[occupation] ?? -1;
        return good >= 0 ? ledger.price(good) / GOODS[good]!.value : 1;
      },
      wage = who.child ? 0 : dayWage(who.occupation, life.skill, life.tool, ratio(who.occupation)),
      others = r.residents.reduce((sum, i) => {
        const p = plan.people[i]!;
        return p === who || p.child ? sum : sum + dayWage(p.occupation, 0, 0, ratio(p.occupation));
      }, 0),
      rent = life.owned ? 0 : RENT_DAY,
      earned = wage + others;
    return {
      r,
      who,
      wage,
      purse: Math.round(life.purse),
      day: {
        ...day,
        earned,
        rent,
        left: earned - day.fed - rent,
        seated: false,
        unnamed: false,
      },
    };
  }
  return {
    r,
    who,
    day,
    wage: wageAtUsual(ledger, who.occupation, who.child) * day.times,
    purse: null,
  };
}

/** What one of a town earns in a day whose home is not drawn: at the town's middling standing (null: no town). */
export function townWage(
  world: World,
  town: string,
  occupation: number,
): { readonly wage: number; readonly bread: number } | null {
  const plan = planOf(world, town);
  if (!plan) return null;
  const ledger = townLedger(world, plan);
  return {
    wage: wageAtUsual(ledger, occupation, false) * wageTimes(ledger.madeHead, 0.5, false),
    bread: ledger.bread,
  };
}

export const HOME_QUERIES: Readonly<Record<string, QueryHandler>> = {
  "home.survey": (world, args) => homeSurvey(world, (args as { town: string }).town),
  "home.money": (world, args) => homeMoney(world, (args as { town: string }).town),
  /** A home's insides, built when it is opened (null: no such home). */
  "home.inside": (world, args) => {
    const a = args as { town: string; n: number };
    return homeInside(world, a.town, a.n);
  },
};
