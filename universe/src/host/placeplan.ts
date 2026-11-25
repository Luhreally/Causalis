// A place as the page is told it (town mode, first slice): the town's plan with the place's own people for its people
// (those of the homes the plan draws, household by household, as many as the eye is given), and where each of them is
// tick by tick. Asking brings the place to the world's moment (host/place.ts advancePlace): the place is kept beside
// the world and is no part of its history, so asking moves nothing of it.
import { DAY, hashString, type Ref, type World } from "../kernel/index.ts";
import { cradleTongue, personName, tongueName, tonguePersonName } from "../gen/index.ts";
import { CIVICS, OCC, OCCUPATIONS, civic, type CivicKind } from "../rules/index.ts";
import { cultureOf, lifeOf, populationContext } from "../sim/index.ts";
import { placePersonRef, type PlaceFrame, type VillagePlan } from "../bridge/index.ts";
import type { QueryHandler } from "./host.ts";
import {
  ACT,
  ACT_WORDS,
  AT,
  IDLE_WORTH,
  PLACE_TICK,
  WHY,
  enterPlace,
  placesOf,
  pressOf,
  workWorth,
  type Place,
} from "./place.ts";

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
      return p.act[i] === ACT.eat
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
 * A town's plan with its place's people for its people: whole households of the homes the plan draws, lowest lots
 * first, up to `most` people. Each is found again by their ref (bridge/place.ts placePersonRef) however the plan is
 * read. Where the plan draws no home by its lot (a village drawn in a ring), households are dealt over its homes.
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
    names = placeNames(world, place),
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
    people: VillagePlan["people"][number][] = [];
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
        ref = placePersonRef(place.town, p.id[i]!);
      people.push({
        ref,
        name: names(p.id[i]!, sex, h.key[house]!),
        home: at,
        age,
        occupation: occ,
        child,
        sex,
        folk: true,
        role: `${tradeWords(occ, child)} of ${plan.name}`,
        page: ref,
      });
    }
  }
  // (The plan's own goings name its own people by their place among them: none of those are of the place.)
  const { goings: _, ...bare } = plan;
  return { ...bare, people };
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
      // (Gone since the plan was read: dead, or left.)
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
  };
}

/**
 * The page's askings of a place. `place.plan` is the town's plan (as `village.plan` gives it, by the handler given) with
 * the place's people; `place.frame` where they are now; `place.kept` which towns are kept, and what they weigh.
 */
export function placeQueries(villagePlan: QueryHandler): Readonly<Record<string, QueryHandler>> {
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
