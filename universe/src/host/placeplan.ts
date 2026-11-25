// A place as the page is told it (town mode, first slice): the town's plan with the place's own people for its people
// (those of the homes the plan draws, household by household, as many as the eye is given), and where each of them is
// tick by tick. Asking brings the place to the world's moment (host/place.ts advancePlace): the place is kept beside
// the world and is no part of its history, so asking moves nothing of it.
import { DAY, MONTH, YEAR, hashString, type Ref, type World } from "../kernel/index.ts";
import { cradleTongue, personName, tongueName, tonguePersonName } from "../gen/index.ts";
import { CIVICS, FOODS, GOODS, OCC, OCCUPATIONS, civic, type CivicKind } from "../rules/index.ts";
import { MANAGED_TRADES, cultureOf, lifeOf, populationContext } from "../sim/index.ts";
import {
  placeLotRef,
  placePersonRef,
  type PlaceFrame,
  type PlaceNotice,
  type PlacePeopleSheet,
  type PlaceStockRow,
  type PlaceStocksSheet,
  type PlaceWorkSheet,
  type VillagePlan,
} from "../bridge/index.ts";
import { townStuff } from "./chain.ts";
import type { QueryHandler } from "./host.ts";
import {
  ACT,
  ACT_WORDS,
  AT,
  IDLE_WORTH,
  MICRO,
  PLACE_TICK,
  WHY,
  enterPlace,
  ordersOf,
  placesOf,
  pressOf,
  workWorth,
  type Place,
} from "./place.ts";
import { townRoster } from "./roster.ts";

const TRADE_WORDS = ["child", "forager", "farmer", "herder", "crafter", "trader", "leader"];
/** What one does for a living, said ("a farmer"; one too old or too young for any: "of the household"). */
export function tradeWords(occ: number, child: boolean): string {
  if (occ === OCC.dependent) return child ? "a child" : "of the household";
  return `a ${TRADE_WORDS[occ] ?? OCCUPATIONS[occ] ?? "worker"}`;
}

const PLACE_KINDS: readonly CivicKind[] = CIVICS.map((c) => c.kind);

/** A lot of a place in words: "the smithy", "the square", "the fields", "the home on lot 12". */
export function lotWords(place: Place, lot: number): string {
  if (lot === AT.square || lot === AT.none) return "the square";
  if (lot === AT.fields) return "the fields";
  const b = place.bldgs.lot.indexOf(lot);
  if (b > 0) {
    const kind = PLACE_KINDS[place.bldgs.kind[b]!];
    return kind ? `the ${civic(kind).name.replace(/^(a|an) /, "")}` : "a building";
  }
  return `the home on lot ${lot}`;
}

/** The names of a place's people: given by who they are, a family's by their household, in their land's tongue. */
export function placeNames(
  world: World,
  place: Place,
): (id: number, sex: number, houseKey: number) => string {
  const ctx = populationContext(world),
    tongue = cultureOf(world).get(place.cell)?.tongue,
    family = tongue ?? cradleTongue(ctx.culture),
    houses = new Map<number, string>();
  return (id, sex, houseKey) => {
    const key = hashString(`${place.town} person ${id}`),
      given = tongue ? tonguePersonName(tongue, key, sex) : personName(ctx.culture, key, sex);
    let house = houses.get(houseKey);
    if (house === undefined) {
      house = tongueName({ ...family, seed: family.seed ^ 0xf00d }, houseKey);
      houses.set(houseKey, house);
    }
    return `${given} ${house}`;
  };
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Why one of a place's people does what they do, in words, with the numbers that decided it. */
export function whyWords(world: World, place: Place, i: number): string {
  const p = place.people,
    need = (q: number) => p.needs[i * 4 + q]! / 65535,
    worth = workWorth(world, place, i),
    // (What a need must pass to be served: their work's worth where they keep a trade, else what rest is worth.)
    bar =
      worth > 0
        ? `what the next hour's work is worth to them (${pct(worth)} by day, less in the dark)`
        : `what rest is worth (${pct(IDLE_WORTH)})`,
    going = p.eta[i]! > 0 ? `; on the way to ${lotWords(place, p.to[i]!)}` : "";
  switch (p.why[i]) {
    case WHY.hunger:
      // (Once they have eaten, the hunger that sent them is stilled: its fullness now would say nothing of why.)
      return p.act[i] === ACT.eat && !p.eta[i] && need(0) < 0.5
        ? `Hunger passed ${bar}: they came home and ate, and it is stilled`
        : `Hunger (${pct(need(0))} full, pressing ${pct(pressOf(need(0)))}) passed ${bar}${going}`;
    case WHY.tired:
      return `Tiredness (${pct(need(1))} full, pressing ${pct(pressOf(need(1)))}) passed ${bar}${going}`;
    case WHY.cold:
      return `The cold (${pct(need(2))} full) passed ${bar}: indoors to get warm${going}`;
    case WHY.lone:
      return `Want of company passed ${bar}: among others in the square until it eases (${pct(need(3))} full now)${going}`;
    case WHY.work:
      return `Nothing presses harder than ${bar}: hunger pressing ${pct(pressOf(need(0)))}, tiredness ${pct(pressOf(need(1)))}${going}`;
    case WHY.pantry:
      return `Hungry, and the pantry at home is bare: food fetched from the town's stores${going}`;
    case WHY.noFood:
      return "Hungry, with nothing in the pantry and nothing in the town's stores";
    case WHY.noStuff:
      return "At their work with nothing to work: what their making is made of has run out here";
    case WHY.young:
      return `No trade of their own, and no need presses past what rest is worth (${pct(IDLE_WORTH)})`;
    case WHY.load:
      return `A load to carry${going}`;
    case WHY.asleep:
      return `Asleep until rested (tiredness ${pct(need(1))} full), unless hunger or cold wakes them`;
    case WHY.dark:
      return `It is dark: work by sight is worth less than rest (${pct(IDLE_WORTH)}) until light`;
    default:
      return ACT_WORDS[p.act[i]!] ?? "";
  }
}

/**
 * Who each of a place's people is, for the pages and the plan: one who holds a line of the town's roster is that holder
 * (host/roster.ts), by the holder's own name and page; the rest by a name and page of the place's own.
 */
export function placeWho(
  world: World,
  place: Place,
): (i: number) => { readonly ref: string; readonly name: string } {
  const p = place.people,
    names = placeNames(world, place);
  let roster: ReturnType<typeof townRoster> | null = null;
  return (i) => {
    if (p.line[i]) {
      roster ??= townRoster(world, place.town, Math.floor(place.t / YEAR));
      const h = roster.holder(p.line[i]! - 1);
      if (h && h.n === p.lineN[i]) return { ref: h.ref, name: roster.nameOf(h) };
    }
    return {
      ref: placePersonRef(place.town, p.id[i]!),
      name: names(p.id[i]!, p.sexOcc[i]! >> 4, place.houses.key[p.house[i]!]!),
    };
  };
}

/** The one of a place who holds a line of its town's roster, by the holder's page ("folk:<town>:<line>:<n>"): their place among its people (-1: none). */
export function placedHolder(place: Place, line: number, n: number): number {
  const p = place.people;
  for (let i = 0; i < p.n; i++) if (p.line[i] === line + 1 && p.lineN[i] === n) return i;
  return -1;
}

/**
 * A town's plan with its place's people for its people: whole households of the homes the plan draws, lowest lots
 * first, up to `most` people. Each is found again by who they are in the place (`placed`), however the plan is read;
 * those of them the god game names (its roster's line-holders) by the god game's own name and page. The realm's key
 * figures the plan stands before their doors stay as it has them. Where the plan draws no home by its lot (a village
 * drawn in a ring), households are dealt over its homes.
 */
export function placePlan(
  world: World,
  plan: VillagePlan,
  place: Place,
  most: number,
): VillagePlan {
  const p = place.people,
    h = place.houses,
    grown = lifeOf(world).adulthood,
    who = placeWho(world, place),
    homeOf = new Map<number, number>();
  plan.homes.forEach((home, k) => {
    if (home.lot !== undefined && !home.flat && !homeOf.has(home.lot)) homeOf.set(home.lot, k);
  });
  const byHouse = new Map<number, number[]>();
  for (let i = 0; i < p.n; i++) {
    const list = byHouse.get(p.house[i]!);
    if (list) list.push(i);
    else byHouse.set(p.house[i]!, [i]);
  }
  const houses = [...byHouse.keys()].sort((a, b) => h.home[a]! - h.home[b]! || a - b),
    people: VillagePlan["people"][number][] = [],
    placed: number[] = [];
  let dealt = 0;
  for (const house of houses) {
    const members = byHouse.get(house)!,
      at = homeOf.size
        ? homeOf.get(h.home[house]!)
        : plan.homes.length
          ? dealt++ % plan.homes.length
          : undefined;
    if (at === undefined) continue;
    if (people.length && people.length + members.length > most) break;
    for (const i of members) {
      const age = (place.t / DAY - p.born[i]!) / 365,
        occ = p.sexOcc[i]! & 15,
        sex = p.sexOcc[i]! >> 4,
        child = age < grown,
        { ref, name } = who(i);
      people.push({
        ref,
        name,
        home: at,
        age,
        occupation: occ,
        child,
        sex,
        folk: true,
        role: `${tradeWords(occ, child)} of ${plan.name}`,
        page: ref,
      });
      placed.push(p.id[i]!);
    }
  }
  // (Its realm's key figures as the plan has them, before their doors: not of the place's count.)
  for (const q of plan.people)
    if (q.figure) {
      people.push(q);
      placed.push(-1);
    }
  // (The plan's own goings name its own people by their place among them: none of those are of the place.)
  const { goings: _, ...bare } = plan;
  return { ...bare, people, placed };
}

/** What wants a manager's eye in a place now, the most pressing first. */
export function placeNotices(world: World, place: Place): PlaceNotice[] {
  const p = place.people,
    out: PlaceNotice[] = [],
    bare = new Set<number>(),
    waiting = new Map<number, number>();
  let want = 0;
  for (let i = 0; i < p.n; i++) {
    if (p.lack[i]! >= 144) want++;
    if (p.why[i] === WHY.noFood || p.why[i] === WHY.pantry) bare.add(p.house[i]!);
    if (p.act[i] === ACT.wait) waiting.set(p.work[i]!, (waiting.get(p.work[i]!) ?? 0) + 1);
  }
  if (want)
    out.push({
      key: "want",
      words: `${want} ${want === 1 ? "has" : "have"} gone a day or more hungry, cold or without rest`,
      ref: null,
    });
  if (bare.size)
    out.push({
      key: "pantry",
      words: `${bare.size} ${bare.size === 1 ? "pantry is" : "pantries are"} bare`,
      ref: placeLotRef(place.town, place.houses.home[[...bare][0]!]!),
    });
  for (const [lot, n] of waiting)
    out.push({
      key: `wait${lot}`,
      words: `${n} at ${lotWords(place, lot)} wait for want of what they work`,
      ref: placeLotRef(place.town, lot),
    });
  const unsettled = place.moves.length / 4 + place.dead.length / 3;
  if (unsettled && ordersOf(world, place.town))
    out.push({
      key: "unsettled",
      words: `${unsettled} of its doings by your orders are told to its land at the month's turn, or on leaving`,
      ref: null,
    });
  return out;
}

/** A place at its tick, for those asked (by their ids, in the order asked): brought to the world's moment first. */
export function placeFrame(world: World, town: string, ids: readonly number[]): PlaceFrame | null {
  const place = enterPlace(world, town);
  if (!place) return null;
  const p = place.people,
    s = populationContext(world).settlements.get(town as Ref),
    doing = new Array<number>(ACT_WORDS.length).fill(0),
    index = new Map<number, number>();
  for (let i = 0; i < p.n; i++) {
    doing[p.act[i]!]!++;
    index.set(p.id[i]!, i);
  }
  const at: number[] = [],
    to: number[] = [],
    eta: number[] = [],
    trip: number[] = [],
    act: number[] = [],
    hunger: number[] = [],
    tired: number[] = [],
    carries: boolean[] = [],
    why: string[] = [];
  for (const id of ids) {
    const i = index.get(id);
    if (i === undefined) {
      // (Gone since the plan was read: dead, or left. Or one of the plan's own, not of the place.)
      at.push(AT.none);
      to.push(AT.none);
      eta.push(0);
      trip.push(0);
      act.push(ACT.idle);
      hunger.push(0);
      tired.push(0);
      carries.push(false);
      why.push("");
      continue;
    }
    at.push(p.at[i]!);
    to.push(p.to[i]!);
    eta.push(p.eta[i]!);
    trip.push(p.trip[i]!);
    act.push(p.act[i]!);
    hunger.push(p.needs[i * 4]! / 65535);
    tired.push(p.needs[i * 4 + 1]! / 65535);
    carries.push(p.carry[i]! > 0);
    why.push(whyWords(world, place, i));
  }
  return {
    town,
    t: place.t,
    tick: PLACE_TICK,
    people: Math.round(s?.population ?? p.n),
    kept: p.n,
    households: place.houses.members.filter((m) => m > 0).length,
    at,
    to,
    eta,
    trip,
    act,
    hunger,
    tired,
    carries,
    why,
    doing,
    notices: placeNotices(world, place),
    managed: !!ordersOf(world, town),
    unsettled: place.moves.length / 4 + place.dead.length / 3,
    month: Math.floor(place.t / MONTH),
  };
}

/** A place's people for its sheet: the most pressed first, those of one trade if asked (the world's occupation column). */
export function peopleSheet(
  world: World,
  place: Place,
  occ: number | null,
  most = 60,
): PlacePeopleSheet {
  const p = place.people,
    grown = lifeOf(world).adulthood,
    who = placeWho(world, place),
    trades = new Array<number>(OCCUPATIONS.length).fill(0),
    order: number[] = [],
    worst = (i: number) => Math.max(p.needs[i * 4]!, p.needs[i * 4 + 1]!, p.needs[i * 4 + 2]!);
  for (let i = 0; i < p.n; i++) {
    trades[p.sexOcc[i]! & 15]!++;
    if (occ === null || (p.sexOcc[i]! & 15) === occ) order.push(i);
  }
  order.sort((a, b) => p.lack[b]! - p.lack[a]! || worst(b) - worst(a) || p.id[a]! - p.id[b]!);
  return {
    trades,
    all: order.length,
    rows: order.slice(0, most).map((i) => {
      const needs = [0, 1, 2, 3].map((q) => p.needs[i * 4 + q]! / 65535),
        age = (place.t / DAY - p.born[i]!) / 365;
      let top = 0;
      for (let q = 1; q < 3; q++) if (needs[q]! > needs[top]!) top = q;
      return {
        ...who(i),
        occ: p.sexOcc[i]! & 15,
        trade: tradeWords(p.sexOcc[i]! & 15, age < grown).replace(/^a /, ""),
        doing: `${ACT_WORDS[p.act[i]!]}${p.eta[i]! > 0 ? `, to ${lotWords(place, p.to[i]!)}` : ""}`,
        needs,
        worst: top,
        lack: Math.floor(p.lack[i]! / 144),
      };
    }),
  };
}

/** What each good is made of in a place's land, as its making chain names it (null: it is what it is). */
export function placeStuff(world: World, place: Place): (good: number) => string | null {
  let stuff: ReturnType<typeof townStuff> | null = null;
  const of = () => (stuff ??= townStuff(world, place.cell, Math.floor(place.t / YEAR)));
  return (good) => {
    const id = GOODS[good]?.id;
    if (id === "tools") return of().tool.name;
    if (id === "clothing") return of().cloth.name;
    if (id === "pottery") return of().clay.name;
    if (id === "copper" || id === "tin" || id === "iron")
      return of().ore?.yields === id ? `smelted from ${of().ore!.name}` : null;
    return null;
  };
}

/** A place's goods for its sheet: each it holds or made or used today, where it lies, what it is made of. */
export function stocksSheet(world: World, place: Place): PlaceStocksSheet {
  const { bldgs, houses, people: p } = place,
    orders = ordersOf(world, place.town),
    stuff = placeStuff(world, place),
    rows: PlaceStockRow[] = [];
  let food = 0;
  for (let g = 0; g < GOODS.length; g++) {
    const where: { ref: string | null; name: string; n: number }[] = [];
    for (let b = 0; b < bldgs.lot.length; b++) {
      const n = bldgs.stock[b * GOODS.length + g]! / MICRO;
      if (n > 0)
        where.push({
          ref: placeLotRef(place.town, bldgs.lot[b]!),
          name: lotWords(place, bldgs.lot[b]!).replace(/^the /, ""),
          n,
        });
    }
    const f = FOODS.indexOf(g);
    let pantries = 0,
      hand = 0;
    if (f >= 0) for (let h = 0; h < houses.n; h++) pantries += houses.pantry[h * FOODS.length + f]!;
    for (let i = 0; i < p.n; i++) if (p.carry[i]! > 0 && p.carryGood[i] === g) hand += p.carry[i]!;
    if (pantries > 0) where.push({ ref: null, name: "pantries", n: pantries / MICRO });
    if (hand > 0) where.push({ ref: null, name: "in hand", n: hand / MICRO });
    where.sort((a, b) => b.n - a.n);
    const held = where.reduce((n, w) => n + w.n, 0),
      made = place.madeDay[g]! / MICRO,
      used = place.usedDay[g]! / MICRO;
    if (GOODS[g]!.food) food += held;
    if (held <= 0 && made <= 0 && used <= 0 && !orders?.forbidden.includes(g)) continue;
    rows.push({
      good: g,
      name: GOODS[g]!.name,
      food: GOODS[g]!.food,
      stuff: stuff(g),
      held,
      made,
      used,
      where,
      forbidden: !!orders?.forbidden.includes(g),
    });
  }
  // (A unit of food is one person's for a month.)
  return { rows, hold: orders?.hold ?? 0, foodDays: p.n > 0 ? (food * 30) / p.n : 0 };
}

/** A place's hands for its Work sheet. */
export function workSheet(world: World, place: Place): PlaceWorkSheet {
  const p = place.people,
    grown = lifeOf(world).adulthood,
    hands = MANAGED_TRADES.map(() => 0);
  let leaders = 0,
    dependents = 0,
    waiting = 0,
    inWant = 0;
  for (let i = 0; i < p.n; i++) {
    const occ = p.sexOcc[i]! & 15,
      k = (MANAGED_TRADES as readonly number[]).indexOf(occ);
    if (k >= 0 && (place.t / DAY - p.born[i]!) / 365 >= grown) hands[k]!++;
    else if (occ === OCC.leader) leaders++;
    else dependents++;
    if (p.act[i] === ACT.wait) waiting++;
    if (p.lack[i]! >= 144) inWant++;
  }
  return {
    hands,
    shares: ordersOf(world, place.town)?.work ?? null,
    leaders,
    dependents,
    waiting,
    inWant,
    unsettled: place.moves.length / 4 + place.dead.length / 3,
  };
}

/**
 * The page's askings of a place. `place.plan` is the town's plan (as `village.plan` gives it, by the handler given) with
 * the place's people; `place.frame` where they are now; its sheets (`place.people`, `place.stocks`, `place.work`);
 * `place.kept` which towns are kept, and what they weigh.
 */
export function placeQueries(villagePlan: QueryHandler): Readonly<Record<string, QueryHandler>> {
  const kept = (world: World, args: unknown) => enterPlace(world, (args as { ref: string }).ref);
  return {
    "place.plan": (world, args) => {
      const a = args as { ref: string; folk?: number },
        plan = villagePlan(world, args) as VillagePlan | null,
        place = plan ? enterPlace(world, a.ref) : null;
      if (!plan || !place) return plan;
      return placePlan(world, plan, place, Math.max(24, Math.min(480, Math.round(a.folk ?? 120))));
    },
    "place.frame": (world, args) => {
      const a = args as { ref: string; ids?: number[] };
      return placeFrame(world, a.ref, a.ids ?? []);
    },
    "place.people": (world, args) => {
      const place = kept(world, args),
        occ = (args as { occ?: number | null }).occ;
      return place ? peopleSheet(world, place, typeof occ === "number" ? occ : null) : null;
    },
    "place.stocks": (world, args) => {
      const place = kept(world, args);
      return place ? stocksSheet(world, place) : null;
    },
    "place.work": (world, args) => {
      const place = kept(world, args);
      return place ? workSheet(world, place) : null;
    },
    "place.kept": (world) => {
      const store = placesOf(world);
      return {
        bytes: store?.bytes() ?? 0,
        places: (store?.places ?? []).map((p) => ({
          town: p.town,
          people: p.people.n,
          t: p.t,
          entered: p.entered,
        })),
      };
    },
  };
}
