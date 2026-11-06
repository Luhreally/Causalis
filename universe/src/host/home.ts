// A home looked into (Lives L6), the host's part: what is true of a home of a town, read off the plan the view draws, its land's
// market and lore, its realm's law, and furnished by rules/dwelling.ts. Nothing here is kept, drawn from history's streams or read
// by the simulation: the same home holds the same things every time, and asking moves nothing.
import { hashString, YEAR, type Ref, type World } from "../kernel/index.ts";
import { LOT, lotStates, townLots, type HomeInside, type VillagePlan } from "../bridge/index.ts";
import {
  DAY_WAGE,
  FAMILY_SIZE,
  G,
  GOODS,
  HEART_SHARE,
  HOME_LEVELS,
  HOME_STOREYS,
  OCC,
  RENT_DAY,
  REIGN,
  ROOM_UNIT,
  coinOf,
  furnish,
  priceTerm,
  reachIn,
  usualPrice,
  type DwellingFacts,
} from "../rules/index.ts";
import {
  WAY,
  cultureOf,
  ecologyOf,
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

/** A home of a town by its number (null: no such home, nor any trace of one). */
export function homeRead(world: World, town: string, n: number): HomeRead | null {
  const plan = planOf(world, town);
  if (!plan) return null;
  const ring = n >= RING_HOME,
    k0 = ring ? n - RING_HOME : -1,
    cell = plan.cell ?? -1,
    of = (k: number) =>
      plan.people.flatMap((p, i) => (p.home === k && p.gone === undefined ? [i] : []));
  if (ring) {
    if (!plan.homes[k0]) return null;
    return {
      plan,
      n,
      lot: -1,
      k: k0,
      state: "stands",
      level: 0,
      house: plan.house,
      run: null,
      residents: of(k0),
      cell,
    };
  }
  const t = plan.town;
  if (!t || n >= t.lots) return null;
  const states = lotStates(t),
    lots = townLots(t.family, t.seed, t.axis, t.lots, t.water),
    k = plan.homes.findIndex((h) => Math.hypot(h.x - lots.x[n]!, h.z - lots.z[n]!) < 0.5),
    what = states.what[n]!,
    design = t.designs[states.design[n]!],
    run = t.runs.find((r) => r[1]! <= n && n < r[2]!) ?? null,
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
    plan,
    n,
    lot: n,
    k,
    state,
    level: Math.max(0, states.level[n]!),
    house: design ?? plan.house,
    run,
    residents: k >= 0 && state === "stands" ? of(k) : [],
    cell,
  };
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

/** What they pay to live there and to whom, as its realm's law of land has it (null: no rent is known). */
export function rentOf(
  world: World,
  cell: number,
  level: number,
): { readonly pays: number; readonly words: string; readonly to: Ref | null } | null {
  const realm = politiesOf(world).of(cell),
    order = realm ? orderOf(world)?.of(realm.ref) : null;
  if (!realm || !order) return null;
  const position = lawOf(order, "land").position,
    day = `${RENT_DAY} coin a day`;
  if (position === 0)
    return {
      pays: RENT_DAY,
      words: `Land here is the lord's: they owe him ${day}. History does not name him, unless it be the ruler of `,
      to: realm.ref,
    };
  if (position === 1 || level >= 3)
    return {
      pays: RENT_DAY,
      words: `${position === 1 ? "Land here is leased" : "A tall home is let by the floor"}: they pay ${day}, to a landlord history does not name, under the law of `,
      to: realm.ref,
    };
  return {
    pays: 0,
    words: "They own it: land here is the tiller's own, by the law of ",
    to: realm.ref,
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
    price = (g: number) => market?.price[g] ?? usualPrice(g),
    bread = Math.max(0.3, price(G.grain) / GOODS[G.grain]!.value),
    wages = people.length
      ? people.reduce((sum, p) => {
          const good = [-1, G.wild, G.grain, G.meat, G.tools, -1, -1][p.occupation] ?? -1;
          return (
            sum +
            (DAY_WAGE[p.occupation] ?? 0) *
              priceTerm(good >= 0 ? price(good) / GOODS[good]!.value : 1)
          );
        }, 0)
      : 2 * (DAY_WAGE[OCC.farmer] ?? 3),
    whole = plan.town?.whole ?? plan.homes.length,
    place = r.lot >= 0 ? r.lot : r.k,
    keyed = (hashString(`${plan.ref}:${r.n}`) >>> 0) / 2 ** 32,
    heart = 1 - Math.min(1, Math.sqrt(place / Math.max(1, whole))),
    court = people.some((p) => p.figure),
    rent = plan.native || r.state !== "stands" ? null : rentOf(world, cell, r.level),
    forest = ecologyOf(world).get(cell),
    bare = plan.lifeLook === "bare",
    fire = means.burns && body?.medium !== "water" && !plan.fireless,
    lived = !plan.native ? reachIn(means, knows) : false,
    way = cultureOf(world).get(cell)?.traits[WAY.kinship],
    coin = coinOf({
      wages,
      bread,
      mouths: people.length || FAMILY_SIZE,
      madeHead: plan.native ? 4 : landMadeHead(world, cell),
      standing: HEART_SHARE * heart + (1 - HEART_SHARE) * keyed,
      court,
      rent: rent?.pays ?? 0,
    }),
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
    coin,
    price,
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
    noHouses: !plan.native && way !== undefined && way < REIGN.noHouses,
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

export const HOME_QUERIES: Readonly<Record<string, QueryHandler>> = {
  "home.survey": (world, args) => homeSurvey(world, (args as { town: string }).town),
  /** A home's insides, built when it is opened (null: no such home). */
  "home.inside": (world, args) => {
    const a = args as { town: string; n: number };
    return homeInside(world, a.town, a.n);
  },
};
