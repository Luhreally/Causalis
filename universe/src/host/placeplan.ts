// A place as the page is told it (town mode, first slice): the town's plan with the place's own people for its people
// (those of the homes the plan draws, household by household, as many as the eye is given), and where each of them is
// tick by tick. Asking brings the place to the world's moment (host/place.ts advancePlace): the place is kept beside
// the world and is no part of its history, so asking moves nothing of it.
import { DAY, MONTH, YEAR, hashString, type Ref, type World } from "../kernel/index.ts";
import { cradleTongue, personName, tongueName, tonguePersonName } from "../gen/index.ts";
import {
  CIVICS,
  FOODS,
  GOODS,
  HEAL_CARE,
  LESSON_RESPONSE,
  OCC,
  MEMBERS,
  limbShare,
  OCCUPATIONS,
  civic,
  type CivicKind,
} from "../rules/index.ts";
import {
  ASK_PULL,
  HELD,
  MANAGED_TRADES,
  cultureOf,
  healthOf,
  lifeOf,
  populationContext,
} from "../sim/index.ts";
import { builtOf } from "./inspect/asks.ts";
import {
  placeLotRef,
  placePersonRef,
  type PlaceDangersSheet,
  type PlaceFrame,
  type PlaceLogSheet,
  type PlaceNotice,
  type PlacePeopleSheet,
  type PlaceSiteRow,
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
  BOUND_ARMS,
  BOUND_SITE,
  CAUSE,
  CAUSE_WORDS,
  HAP,
  HAP_GRAVE,
  hapMany,
  armsWanted,
  watchWanted,
  placeCold,
  placeMark,
  tendedOf,
  gaitOf,
  hurtOf,
  placeLimbs,
  placeMember,
  woundTakes,
  hapRef,
  hapTold,
  MOOD_UNHEEDING,
  hapWords,
  IDLE_WORTH,
  MICRO,
  PLACE_TICK,
  WHY,
  enterPlace,
  ordersOf,
  placeFigure,
  placeHomes,
  placeIndexOf,
  placeSites,
  placesOf,
  pressOf,
  siteStage,
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

/** What is going up on a site, from its lot's words: "the school" of "the school's site". */
export const siteOf = (words: string): string => words.replace(/'s site$/, "");

/** A lot of a place in words: "the smithy", "the square", "the fields", "the home on lot 12", "the school's site". */
export function lotWords(place: Place, lot: number): string {
  if (lot === AT.square || lot === AT.none) return "the square";
  if (lot === AT.fields) return "the fields";
  if (lot === AT.walls) return place.bldgs.lot.includes(lot) ? "the walls' site" : "the walls";
  const b = place.bldgs.lot.indexOf(lot);
  if (b > 0) {
    const kind = PLACE_KINDS[place.bldgs.kind[b]!],
      rising = place.bldgs.site[b] ? "'s site" : "";
    return kind ? `the ${civic(kind).name.replace(/^(a|an) /, "")}${rising}` : "a building";
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
/** A trade's work, said: "the fields". */
export const OCCUPATION_WORK: readonly string[] = [
  "",
  "foraging",
  "the fields",
  "the herds",
  "a craft",
  "hauling",
  "leading",
];

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
      // (No roof: their household lost its home and found no room under another.)
      return place.houses.home[p.house[i]!]! < 0 && place.houses.lost[p.house[i]!]! >= 0
        ? `The cold (${pct(need(2))} full) passed ${bar}, and they have no roof to get warm under: their household lost its home and lives in the square, in the weather`
        : `The cold (${pct(need(2))} full) passed ${bar}: indoors to get warm${going}`;
    case WHY.lone:
      return `Want of company passed ${bar}: among others in the square until it eases (${pct(need(3))} full now)${going}`;
    case WHY.turned:
      return `Their own work has nothing for them now: turned to ${OCCUPATION_WORK[p.turn[i]!] ?? "other work"}, as your priorities for them say, and at it as one new to it${going}`;
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
    case WHY.shut:
      return `The work of ${lotWords(place, p.work[i]!)} is stopped by your order: at home until it goes on`;
    case WHY.abed:
      return `${healthWords(world, place, i) ?? ailWords(place, i)}, and fed from the pantry by their household`;
    case WHY.site:
      return `Put to raising ${siteOf(lotWords(place, p.work[i]!))} by your order. Nothing presses harder than ${bar}${going}`;
    case WHY.stuff:
      return `Nothing lies on the site to build in: a load of what it is built of is fetched from outside the town, a third of their own weight at a time${going}`;
    case WHY.stopped:
      return `Work on ${siteOf(lotWords(place, p.work[i]!))} is stopped, as its land's month stops it (fighting on its land, the ground's shaking, or nothing in store to feed its hands): at home until it goes on`;
    case WHY.raised:
      return `All that ${siteOf(lotWords(place, p.work[i]!))} wants is done. Its land is told at the month's turn, or on leaving, and then it stands`;
    case WHY.fire:
      return `A fire in the town: turned out to fight it at ${lotWords(place, p.to[i]!)}, until it is out or hunger takes them off`;
    case WHY.arms:
      return "Standing to arms in the square by your order, in the hours their work would have had";
    case WHY.siege:
      return "A siege lies about the town: no one goes out to its fields. At home until it is lifted";
    case WHY.apart:
      return "There is sickness in their household, and the sick are kept apart by your order: at home, though they want company";
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
    // (One of its realm's key figures: by their own name and page.)
    const fig = place.figId.indexOf(p.id[i]!);
    if (fig >= 0) return { ref: place.figRef[fig]!, name: place.figName[fig]! };
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
  // Its realm's key figures who live here, each one of the place's own people (host/place.ts placeFigure): drawn as the
  // town view draws them, with their own name and page, where the place has them, with needs as anyone's.
  const figures = new Map<number, VillagePlan["people"][number]>();
  for (const q of plan.people) {
    if (!q.figure) continue;
    const id = placeFigure(place, q.figure, q.name, q.sex, grown);
    if (id !== null) figures.set(id, q);
  }
  for (const [id, q] of figures) {
    const i = placeIndexOf(place, id),
      at = homeOf.get(h.home[p.house[i]!]!) ?? q.home;
    people.push({ ...q, home: at, occupation: p.sexOcc[i]! & 15, child: false });
    placed.push(id);
  }
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
      if (figures.has(p.id[i]!)) continue;
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
  // (A figure no one of the place could be stands as the plan has them, before their door.)
  for (const q of plan.people)
    if (q.figure && !place.figRef.includes(q.figure)) {
      people.push(q);
      placed.push(-1);
    }
  // (The plan's own goings name its own people by their place among them: none of those are of the place.)
  const { goings: _, ...bare } = plan;
  // A site the place has in hand is drawn as far as its own people have got it, going on at its hands' usual rate.
  const sites = placeSites(world, place).filter((x) => x.inHand),
    town =
      bare.town && sites.length
        ? {
            ...bare.town,
            civics: bare.town.civics.map((c) => {
              const x = c.asked ? sites.find((q) => q.lot === (c.truly ?? c.at)) : undefined;
              return x && c.asked
                ? {
                    ...c,
                    asked: {
                      ...c.asked,
                      read: place.t,
                      share: x.share,
                      stopped: x.stopped || x.raised,
                      done: place.t + x.months * MONTH + (x.stopped ? YEAR : 0),
                      hands: x.hands,
                      // (Its crew are the place's own people, at the site: none of the plan's stand in for them.)
                      crew: [],
                    },
                  }
                : c;
            }),
          }
        : bare.town;
  // (Its walls in hand likewise: as far about their ring as its own people have raised them.)
  const wall = sites.find((q) => q.lot === AT.walls),
    walled =
      town && wall && town.walls?.asked
        ? {
            ...town,
            walls: {
              ...town.walls,
              asked: {
                ...town.walls.asked,
                read: place.t,
                share: wall.share,
                stopped: wall.stopped || wall.raised,
                done: place.t + wall.months * MONTH + (wall.stopped ? YEAR : 0),
                hands: wall.hands,
                crew: [],
              },
            },
          }
        : town;
  return { ...bare, ...(walled ? { town: walled } : {}), people, placed };
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
    // (Those whose building's work an order stopped wait by that order: no notice of it is wanted. A site's crew waiting
    // are told of with their site, below.)
    if (
      p.act[i] === ACT.wait &&
      p.why[i] !== WHY.shut &&
      p.why[i] !== WHY.stopped &&
      p.why[i] !== WHY.raised
    )
      waiting.set(p.work[i]!, (waiting.get(p.work[i]!) ?? 0) + 1);
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
  // (Those who work at home, one notice for them all: a town of home crafters filled the line with a notice a house.)
  let atHome = 0,
    firstHome = -1;
  for (const [lot, n] of waiting) {
    if (lot >= 0 && place.bldgs.lot.indexOf(lot) < 0) {
      atHome += n;
      if (firstHome < 0) firstHome = lot;
      continue;
    }
    out.push({
      key: `wait${lot}`,
      words: `${n} at ${lotWords(place, lot)} wait for want of what they work`,
      ref: placeLotRef(place.town, lot),
    });
  }
  if (atHome)
    out.push({
      key: "waithome",
      words: `${atHome} who work at home wait for want of what they work`,
      ref: placeLotRef(place.town, firstHome),
    });
  // What threatens it, seen on its own people.
  const fire = place.fire.length && place.t < place.fire[1]! ? place.fire[0]! : null;
  if (fire !== null) {
    let out2 = 0;
    for (let i = 0; i < p.n; i++) if (p.act[i] === ACT.brigade) out2++;
    out.unshift({
      key: `fire${place.fire[1]}`,
      words: `Fire at ${lotWords(place, fire)}: ${out2} of its grown have turned out to fight it`,
      ref: fire === AT.square ? null : placeLotRef(place.town, fire),
    });
  }
  if (place.matched.sieged)
    out.unshift({
      key: "siege",
      words: "A siege lies about the town: no one goes out to its fields",
      ref: null,
    });
  const day = Math.floor(place.t / DAY);
  let roofless = 0;
  for (let k = 0; k < place.houses.n; k++)
    if (
      place.houses.members[k]! > 0 &&
      place.houses.lost[k]! >= 0 &&
      day - place.houses.lost[k]! <= 60
    )
      roofless++;
  if (roofless)
    out.push({
      key: `roofless${roofless}`,
      words: `${roofless} ${roofless === 1 ? "household has" : "households have"} lost ${roofless === 1 ? "its home" : "their homes"}: see Dangers`,
      ref: null,
    });
  for (const x of placeSites(world, place)) {
    if (!x.inHand) continue;
    const name = siteOf(lotWords(place, x.lot));
    if (x.raised)
      out.push({
        key: `raised${x.lot}`,
        words: `All that ${name} wants is done: it stands once its land is told`,
        ref: placeLotRef(place.town, x.lot),
      });
    else if (x.stopped)
      out.push({
        key: `stopped${x.lot}`,
        words: `Work on ${name} is stopped`,
        ref: placeLotRef(place.town, x.lot),
      });
    else if (x.crew.length < x.hands)
      out.push({
        key: `crew${x.lot}`,
        words: `${name} has ${x.crew.length} of the ${x.hands} hands ordered to it: no more of its grown are free and well`,
        ref: placeLotRef(place.town, x.lot),
      });
  }
  const unsettled = place.moves.length / 4 + place.dead.length / 3;
  if (unsettled && ordersOf(world, place.town))
    out.push({
      key: "unsettled",
      words: `${unsettled} of its doings by your orders ${unsettled === 1 ? "is" : "are"} told to its land at the month's turn, or on leaving`,
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
    sites: placeSites(world, place)
      .filter((x) => x.inHand)
      .map((x) => ({ lot: x.lot, share: x.share, stopped: x.stopped, raised: x.raised })),
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
  const posts: { lot: number; name: string }[] = [];
  for (let b = 1; b < place.bldgs.lot.length; b++)
    if (!place.bldgs.site[b])
      posts.push({
        lot: place.bldgs.lot[b]!,
        name: lotWords(place, place.bldgs.lot[b]!).replace(/^the /, ""),
      });
  return {
    trades,
    all: order.length,
    posts,
    homes: placeHomes(world, place, 6),
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
        mood: p.mood[i]!,
        health: p.health[i]!,
        bound:
          p.bound[i] === BOUND_ARMS
            ? "under arms"
            : p.bound[i] === BOUND_SITE
              ? "builder"
              : p.bound[i] && p.bound[i] !== 255
                ? tradeWords(p.bound[i]! - 1, false).replace(/^a /, "")
                : null,
        id: p.id[i]!,
        house: place.houses.key[p.house[i]!]!,
        homeLot: place.houses.home[p.house[i]!]!,
        post: p.bound[i] === 255 ? p.work[i]! : null,
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
    if (
      held <= 0 &&
      made <= 0 &&
      used <= 0 &&
      place.cameDay[g]! <= 0 &&
      !orders?.forbidden.includes(g)
    )
      continue;
    rows.push({
      good: g,
      name: GOODS[g]!.name,
      food: GOODS[g]!.food,
      stuff: stuff(g),
      held,
      made,
      used,
      came: place.cameDay[g]! / MICRO,
      where,
      forbidden: !!orders?.forbidden.includes(g),
    });
  }
  // (A unit of food is one person's for a month.)
  return { rows, hold: orders?.hold ?? 0, foodDays: p.n > 0 ? (food * 30) / p.n : 0 };
}

/** A place's hands for its Work sheet. */
/** How many of a place's people its priorities grid shows at once. */
export const GRID_ROWS = 48;

/** A place's priorities grid (PlaceWorkSheet.grid): narrowed to a trade where one is said. */
function prioGrid(world: World, place: Place, occ: number | null): PlaceWorkSheet["grid"] {
  const p = place.people,
    grown = lifeOf(world).adulthood,
    who = placeWho(world, place),
    list: { i: number; kinds: number[] | null }[] = [];
  for (let i = 0; i < p.n; i++) {
    const o = p.sexOcc[i]! & 15;
    if (!(MANAGED_TRADES as readonly number[]).includes(o)) continue;
    if (occ !== null && o !== occ) continue;
    if ((place.t / DAY - p.born[i]!) / 365 < grown) continue;
    list.push({ i, kinds: placePrio(world, place, p.id[i]!) });
  }
  // (Those with priorities set first; then by trade, then as they were numbered.)
  list.sort(
    (a, b) =>
      (a.kinds ? 0 : 1) - (b.kinds ? 0 : 1) ||
      (p.sexOcc[a.i]! & 15) - (p.sexOcc[b.i]! & 15) ||
      p.id[a.i]! - p.id[b.i]!,
  );
  return {
    kinds: ["Fields", "Herds", "Crafts", "Hauling", "Building"],
    all: list.length,
    rows: list.slice(0, GRID_ROWS).map(({ i, kinds }) => {
      const o = p.sexOcc[i]! & 15,
        w = who(i);
      return {
        id: p.id[i]!,
        ref: w.ref,
        name: w.name,
        occ: o,
        skill: placeSkill(place, i).words,
        // (Of themselves: their own trade and no other, and building when a site's crew is made up.)
        kinds: kinds ?? [...MANAGED_TRADES.map((t) => (t === o ? 3 : 0)), 1],
        set: !!kinds,
        turned: p.turn[i]!,
      };
    }),
  };
}

export function workSheet(
  world: World,
  place: Place,
  /** The trade its priorities grid is narrowed to (null: all). */
  gridOcc: number | null = null,
): PlaceWorkSheet {
  const p = place.people,
    grown = lifeOf(world).adulthood,
    hands = MANAGED_TRADES.map(() => 0);
  const working = place.bldgs.lot.map(() => 0);
  let leaders = 0,
    dependents = 0,
    waiting = 0,
    inWant = 0,
    unheeding = 0,
    abed = 0;
  for (let i = 0; i < p.n; i++) {
    const occ = p.sexOcc[i]! & 15,
      k = (MANAGED_TRADES as readonly number[]).indexOf(occ);
    if (k >= 0 && (place.t / DAY - p.born[i]!) / 365 >= grown) hands[k]!++;
    else if (occ === OCC.leader) leaders++;
    else dependents++;
    if (p.act[i] === ACT.wait) waiting++;
    if (p.lack[i]! >= 144) inWant++;
    if (p.mood[i]! < MOOD_UNHEEDING) unheeding++;
    if (p.ill[i]! > 0 && p.health[i] !== 3) abed++;
    const b = place.bldgs.lot.indexOf(p.work[i]!);
    if (b > 0) working[b]!++;
  }
  const shut = ordersOf(world, place.town)?.shut ?? [],
    stuff = placeSites(world, place).length ? builtOf(world, place.cell) : "",
    sites: PlaceSiteRow[] = placeSites(world, place).map((x) => ({
      ask: x.n,
      ref: placeLotRef(place.town, x.lot),
      name: lotWords(place, x.lot)
        .replace(/^the /, "")
        .replace(/'s site$/, ""),
      share: x.share,
      stage: siteStage(x.share, x.kind),
      inHand: x.inHand,
      hands: x.hands,
      most: x.most,
      busy: x.busy,
      spares:
        x.answer === "glad"
          ? "all it can spare: the town took the asking up gladly"
          : x.answer === "grudged"
            ? "seven in ten of what it could spare: the town grudged the asking"
            : "half of what it could spare: the town took up half the asking",
      stuff,
      lying: x.stuff,
      wants: x.wants,
      stopped: x.stopped,
      raised: x.raised,
      months: x.months,
    }));
  return {
    unheeding,
    abed,
    sites,
    buildings: place.bldgs.lot
      .map((lot, b) => ({
        lot,
        ref: placeLotRef(place.town, lot),
        name: lotWords(place, lot).replace(/^the /, ""),
        working: working[b]!,
        shut: shut.includes(lot),
      }))
      .filter((x, b) => b > 0 && !place.bldgs.site[b] && (x.working > 0 || x.shut)),
    hands,
    shares: ordersOf(world, place.town)?.work ?? null,
    leaders,
    dependents,
    waiting,
    inWant,
    unsettled: place.moves.length / 4 + place.dead.length / 3,
    grid: prioGrid(world, place, gridOcc),
  };
}

/** How many times as long, said: "twice", "half again", "1.3 times". */
function timesWords(x: number): string {
  return Math.abs(x - 2) < 0.01
    ? "twice"
    : Math.abs(x - 1.5) < 0.01
      ? "half again"
      : Math.abs(x - 3) < 0.01
        ? "three times"
        : Math.abs(x - 4) < 0.01
          ? "four times"
          : `${Math.round(x * 10) / 10} times`;
}

/** What ails one of a place's people, said: "Hurt at their work", "Sick of the red flux". */
export function ailWords(place: Place, i: number): string {
  const { cause } = hurtOf(place, i);
  if (place.people.health[i] === 2)
    return `Sick of ${(place.ills[cause - CAUSE.sickness] ?? "a sickness").split("|")[0]}`;
  return cause === CAUSE.battle
    ? "Wounded in battle"
    : cause >= CAUSE.fire && CAUSE_WORDS[cause]
      ? `Hurt ${CAUSE_WORDS[cause]}`
      : cause === CAUSE.accident
        ? "Hurt at their work"
        : "Ailing";
}

const TENDED_WORDS = {
  hospital: "at the town's hospital",
  healer: "by the town's healer",
  household: "by their household",
  kin: "by kin",
} as const;

/** How one of a place's people is, said in full (null: well): what ails them, how long, who tends them. */
export function healthWords(world: World, place: Place, i: number): string | null {
  const p = place.people,
    days = Math.ceil(p.ill[i]! / 144),
    more = `${days} more ${days === 1 ? "day" : "days"}`;
  if (!p.health[i]) return null;
  if (p.health[i] === 3) {
    // (What the member bound takes of their work and their going till it is mended: rules/anatomy.ts limbShare.)
    const takes = woundTakes(world, place, i),
      member = hurtOf(place, i).member,
      where = member ? placeMember(world, place, i, member) : null,
      leads = (p.sexOcc[i]! & 15) === OCC.leader || (p.sexOcc[i]! & 15) === OCC.dependent,
      work =
        takes.handling > 0 && !leads
          ? takes.handling >= 1
            ? ", and no work of their hands till then"
            : `, their work worth ${Math.round((1 - takes.handling) * 100)} in a hundred of what it was till then`
          : "",
      walk =
        takes.going > 0 ? `, a walk taking them ${timesWords(gaitOf(takes.going))} as long` : "";
    return `Up again with the wound${where ? ` to ${where}` : ""} bound: ${more} of mending${work}${walk}`;
  }
  const mark = p.health[i] === 1 ? placeMark(world, place, i) : null;
  return `${ailWords(place, i)}${mark ? `, in ${mark.member}` : ""}: abed ${more}, tended ${TENDED_WORDS[tendedOf(place, i)]}`;
}

/** What a wound left one of a place's people with for good, said (null: nothing). */
export function markWords(world: World, place: Place, i: number): string | null {
  const m = placeMark(world, place, i);
  if (!m) return null;
  const member = `${m.member.charAt(0).toUpperCase()}${m.member.slice(1)}`;
  if (m.outcome !== "lame") return `A scar on ${m.member}`;
  // (What it takes of their going or their handling: the share of their body's legs or arms that the member was.)
  const p = place.people,
    mark = p.mark[i]!,
    f = placeLimbs(world, place, i),
    share = limbShare(MEMBERS[(mark & 15) - 1]!, f.legs, f.arms),
    leads = (p.sexOcc[i]! & 15) === OCC.leader;
  return share.going > 0
    ? `${member} was left lame: they walk with a limp, a walk taking them ${timesWords(gaitOf(share.going))} as long`
    : `${member} was left stiff: ${
        leads
          ? "their work is words, and is worth what it was"
          : share.handling >= 1
            ? "they can do no work of their hands"
            : `their work is worth ${Math.round((1 - share.handling) * 100)} in a hundred of what it was`
      }`;
}

/** Who tends a place's hurt and sick, and what its land knows of care (rules/wounds.ts CARE_PRINCIPLES), said. */
export function careWords(place: Place): string {
  const care = place.matched.care ?? 0,
    hospital = place.bldgs.kind.some(
      (k, b) => b > 0 && !place.bldgs.site[b] && CIVICS[k]?.kind === "hospital",
    );
  return `${hospital ? "The town keeps a hospital: its hurt and sick are tended there." : place.matched.healer ? "The town keeps a healer, for its land knows herb-lore: its hurt and sick are tended by them." : "Its land knows no herb-lore, and the town keeps no healer: its hurt and sick are tended by their households."} ${care > 0 ? `By what its land knows of care, a wound heals ${Math.round(HEAL_CARE * care * 100)} in a hundred sooner and half as many limbs again are saved from laming as care is known (${Math.round(care * 100)} in a hundred of it).` : "Its land knows nothing yet of the care of wounds."}`;
}

const pctOf = (x: number) => `${Math.round(x * 1000) / 10}`;

/** What threatens a place now, whom it has touched, and what it can be held to against it (its Dangers sheet). */
export function dangersSheet(world: World, place: Place): PlaceDangersSheet {
  const p = place.people,
    h = place.houses,
    ctx = populationContext(world),
    s = ctx.settlements.get(place.town as Ref),
    total = ctx.provinces.get(place.cell)?.total() ?? 0,
    share = s && total > 0 ? Math.min(1, s.population / total) : 1,
    orders = ordersOf(world, place.town),
    who = placeWho(world, place),
    day = Math.floor(place.t / DAY),
    year = Math.floor(place.t / YEAR),
    now: { icon: string; words: string; ref: string | null }[] = [],
    hurt: { name: string; words: string; ref: string }[] = [];
  // What bears on it now.
  const fire = place.fire.length && place.t < place.fire[1]! ? place.fire[0]! : null;
  if (fire !== null)
    now.push({
      icon: "🔥",
      words: `Fire at ${lotWords(place, fire)}, being fought until it is out.`,
      ref: fire === AT.square ? null : placeLotRef(place.town, fire),
    });
  if (place.matched.sieged)
    now.push({
      icon: "🏰",
      words: "A siege lies about the town. No one goes out to its fields.",
      ref: null,
    });
  const health = healthOf(world),
    last = health?.land(place.cell)?.last,
    sickness = last && year - last.year <= 1 ? health!.get(last.sickness) : undefined;
  let sick = 0,
    abed = 0,
    want = 0,
    arms = 0,
    hands = 0;
  for (let i = 0; i < p.n; i++) {
    if (p.health[i] === 2) sick++;
    if (p.lack[i]! >= 144) want++;
    if (p.bound[i] === BOUND_ARMS) arms++;
    const occ = p.sexOcc[i]! & 15;
    if (
      occ >= OCC.farmer &&
      occ <= OCC.trader &&
      (place.t / DAY - p.born[i]!) / 365 >= lifeOf(world).adulthood
    )
      hands++;
    if (p.health[i] === 1 && (p.cause[i]! & 7) >= CAUSE.fire) {
      abed++;
      if (hurt.length < 40) {
        const w = who(i),
          days = Math.ceil(p.ill[i]! / 144);
        hurt.push({
          name: w.name,
          words: `${healthWords(world, place, i) ?? ailWords(place, i)}`,
          ref: w.ref,
        });
      }
    }
  }
  if (sickness)
    now.push({
      icon: "🤒",
      words: `${sickness.name} is about in its land: ${sick} of the town lie sick of it now.`,
      ref: sickness.ref,
    });
  const fed = place.matched.fed ?? 1000;
  if (fed < 1000)
    now.push({
      icon: "🌾",
      words: `Its land's food met ${Math.round(fed / 10)} in a hundred of its needs in the year last reckoned${fed < 800 ? ": a lean year. Those long in want are the first it takes" : ""}. ${want} of the town have gone a day or more in want.`,
      ref: null,
    });
  // (Its dead of what struck it, of its battles, of a sickness and of want, this year and last: by the count kept beside
  // its log, which lets go of its oldest lines.)
  const c = place.counts;
  for (let k = 0; k < c.length; k += 4) {
    const what = c[k + 1]!,
      n = c[k + 3]!;
    if (what === HAP.died) continue;
    const x = { t: 0, what, id: 0, a: c[k + 2]!, b: 0 },
      when = c[k] === year ? "this year" : "last year";
    now.push(
      what === HAP.sick
        ? {
            icon: "🤒",
            words: `${n} of the town took ${(place.ills[x.a] ?? "a sickness").split("|")[0]} when it came ${when}, and lived.`,
            ref: hapRef(place, x),
          }
        : {
            icon: what === HAP.fell ? "⚔️" : "🕯️",
            words: `${n} of the town ${hapMany(place, what, x.a)} ${when}.`,
            ref: hapRef(place, x),
          },
    );
  }
  if (abed > 0)
    now.push({
      icon: "🩹",
      words: `${abed} lie abed, hurt by what struck the town or wounded in its battles.`,
      ref: null,
    });
  if (!now.length)
    now.push({
      icon: "🕊️",
      words: "Nothing threatens the town now, and none of its people lie hurt by what has.",
      ref: null,
    });
  // Its homeless.
  let households = 0,
    people = 0,
    sheltered = 0,
    roofless = 0;
  for (let k = 0; k < h.n; k++) {
    if (h.members[k]! <= 0 || h.lost[k]! < 0) continue;
    // (Those with no roof are told of for as long as they have none.)
    if (h.home[k]! < 0) roofless += h.members[k]!;
    else if (day - h.lost[k]! > 60) continue;
    households++;
    people += h.members[k]!;
    if (place.bldgs.lot.indexOf(h.home[k]!) > 0) sheltered += h.members[k]!;
  }
  const options: { lot: number; name: string }[] = [];
  for (let b = 1; b < place.bldgs.lot.length; b++)
    if (!place.bldgs.site[b])
      options.push({
        lot: place.bldgs.lot[b]!,
        name: lotWords(place, place.bldgs.lot[b]!).replace(/^the /, ""),
      });
  // What it can be held to: the world's own answers (rules/lessons.ts), said by what they do, who they take, what they cost.
  const cost = (asks: number) =>
      `Takes ${pctOf(asks * ASK_PULL.glad)} in a hundred of its hands from its fields while it stands.`,
    responses = HELD.map((what) => {
      const on = !!orders?.held.includes(what),
        r = LESSON_RESPONSE.get(what);
      if (what === "muster")
        return {
          what,
          name: "Stand to arms",
          on,
          does: `Its land's defenders count ${pctOf(ASK_PULL.glad * share)} in a hundred more when its land is fought for, as a town that has put its arms first.`,
          who: on
            ? `${arms} of its grown stand in the square in their working hours.`
            : `${armsWanted(hands)} of its grown would stand in the square in their working hours.`,
          cost: cost(1),
        };
      const most = r?.most ?? 0;
      return {
        what,
        name:
          what === "firebreaks"
            ? "Keep a fire watch"
            : what === "quarantine"
              ? "Keep the sick apart"
              : "Put grain by",
        on,
        does:
          what === "firebreaks"
            ? `A fire on the town burns ${pctOf(most)} in a hundred fewer of its homes, and kills as many fewer.`
            : what === "quarantine"
              ? `A sickness in its land takes ${pctOf(most * share)} in a hundred fewer of its land's people (this town's part of them); here, ${pctOf(most)} in a hundred fewer take it.`
              : `Its land can keep about ${Math.round(most * share * 30)} days more of its food than a year's keeping lets it now (this town's part). Of use where its land wins more than it eats in its good years; a land that eats all it wins has nothing to put by.`,
        who:
          what === "firebreaks"
            ? `${watchWanted(hands)} of its grown keep the watch and go to any fire in the town; those who live within a cry of it turn out as they would without.`
            : what === "quarantine"
              ? "Households with sickness in them keep from the square."
              : "Its households, each putting by from what it brings in.",
        cost: cost(r?.asks ?? 0),
      };
    });
  return {
    now,
    hurt,
    care: careWords(place),
    homeless: { households, people, sheltered, roofless, cold: placeCold(world, place) },
    shelter: { lot: orders && orders.shelter >= 0 ? orders.shelter : null, options },
    responses,
  };
}

/** The names of those gone from a place (dead, or left), by what the telling of their going kept of them (null: nothing kept). */
export function goneNames(world: World, place: Place): (id: number) => string | null {
  const kept = new Map<number, readonly [number, number]>();
  for (const x of place.log) if (x.k !== undefined) kept.set(x.id, [x.s ?? 0, x.k]);
  const names = placeNames(world, place);
  return (id) => {
    const one = kept.get(id);
    return one ? names(id, one[0], one[1]) : null;
  };
}

/** Of a kind that is counted, how many a day tells one by one; and of a death, a hurt or a home lost. */
const LOG_EACH = 4,
  LOG_GRAVE = 12;

/**
 * What has happened in a place, day by day, the latest first, each said with who it befell and the page that tells of
 * them. A death, a hurt, a home lost has a line of its own however many there were; of the rest a day tells the latest
 * few of a kind and counts the others ("and 38 more came to the town").
 */
export function logSheet(world: World, place: Place, most = 160): PlaceLogSheet {
  const who = placeWho(world, place),
    index = new Map<number, number>(),
    today = Math.floor(place.t / DAY),
    rows: PlaceLogSheet["rows"][number][] = [];
  for (let i = 0; i < place.people.n; i++) index.set(place.people.id[i]!, i);
  // (One gone is still named: by what the telling of their going kept of them.)
  const gone = goneNames(world, place);
  const dayWords = (d: number) =>
    d === today
      ? "Today"
      : d === today - 1
        ? "Yesterday"
        : `Day ${(((d % 365) + 365) % 365) + 1} of year ${Math.floor(d / 365)}`;
  for (let k = place.log.length - 1; k >= 0 && rows.length < most;) {
    // (A day's happenings: from the latest back to its first.)
    const d = Math.floor(place.log[k]!.t / DAY),
      day = dayWords(d),
      shown = new Map<number, number>(),
      more = new Map<number, number>();
    for (; k >= 0 && Math.floor(place.log[k]!.t / DAY) === d; k--) {
      // (A kind is a happening and what it was of: the dead of one sickness, the fallen of one battle.)
      const x = place.log[k]!,
        of = HAP_GRAVE.has(x.what) ? x.what * 256 + (x.a & 255) : x.what * 256,
        n = shown.get(of) ?? 0;
      if (n >= (HAP_GRAVE.has(x.what) ? LOG_GRAVE : LOG_EACH)) {
        more.set(of, (more.get(of) ?? 0) + 1);
        continue;
      }
      shown.set(of, n + 1);
      const i = index.get(x.id),
        one = i === undefined ? null : who(i);
      rows.push({
        t: x.t,
        words: `${one ? one.name : (gone(x.id) ?? "One of the town")} ${hapTold(place, x)}`,
        // (One gone leads to what took them, where a page tells of it: the battle, the sickness.)
        ref: one ? one.ref : (hapRef(place, x) ?? placePersonRef(place.town, x.id)),
        day,
      });
    }
    for (const [of, n] of more)
      rows.push({
        t: d * DAY,
        words: `and ${n} more ${hapMany(place, Math.floor(of / 256), HAP_GRAVE.has(Math.floor(of / 256)) ? of % 256 : 0)}`,
        ref: null,
        day,
      });
  }
  return { rows };
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
      const place = kept(world, args),
        occ = (args as { occ?: unknown } | null)?.occ;
      return place ? workSheet(world, place, typeof occ === "number" ? occ : null) : null;
    },
    "place.log": (world, args) => {
      const place = kept(world, args);
      return place ? logSheet(world, place) : null;
    },
    "place.dangers": (world, args) => {
      const place = kept(world, args);
      return place ? dangersSheet(world, place) : null;
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
