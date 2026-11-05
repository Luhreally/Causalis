// A colony as the eye reads it (Phase 64, asked for 2026-11-03: "emphasize how i wanna see the star
// wars and landing in planets and colonization and all that stuff"). History keeps a colony as a land:
// its people, what they know, who rules it, when and why they came; it keeps no town there, for no
// village is founded on ground it does not farm (population/systems.ts: siteBlocks). So the town is
// reckoned here, year by year from the land's founding, by the same builder and the same rules as a
// town of the home world (sim/town/fabric.ts): homes for as many people as the ledger says the land
// holds, raised higher as its people's knowledge allows, its buildings as it wants them; in a store of
// its own, never the world's. Nothing here enters history: it is read, and read again the same.
import {
  hashString,
  makeRef,
  parseRef,
  yearOfMoment,
  type Ref,
  type World,
} from "../kernel/index.ts";
import { COVER, WATER, isProvinceWorld, offworldSite, placeName } from "../gen/index.ts";
import {
  HOLDS,
  habitability,
  remadeWorld,
  remakingAt,
  routeTo,
  type Bodylike,
} from "../rules/index.ts";
import {
  COLONISTS,
  SETTLEMENT,
  TownBuilder,
  TownStore,
  beliefOf,
  designsOf,
  edgeLevel,
  handOf,
  homePlanet,
  housingOf,
  knows,
  lateOf,
  loreOf,
  politiesOf,
  populationContext,
  realmName,
  remakeKey,
  siteGround,
  siteRegion,
  spaceOf,
  starSitesOf,
  topLevel,
  townsOf,
  type Fabric,
  type Settlement,
  type SettlementStore,
  type SiteGround,
} from "../sim/index.ts";
import type {
  ColonyEntry,
  ColonyGrowth,
  ColonyLook,
  ColonyVoyage,
  TownPlan,
  VillagePlan,
} from "../bridge/index.ts";
import type { QueryHandler } from "./host.ts";

/** A town of a colony's halls: its land's cell, in the kind of a town and a number none is minted with. */
export const colonyTownRef = (cell: number): Ref => makeRef(SETTLEMENT, 1, cell);
/** The land of a colony's town (null: a town of the home world's). */
export function colonyTownCell(ref: string): number | null {
  return ref.startsWith("town:1:") ? parseRef(ref as Ref).b : null;
}

/** People from whom its town counts as a city: its heart may rise to towers (fabric.ts: topLevel). */
const CITY_PEOPLE = 5000;
/** People from whom it keeps a market hall. */
const MARKET_PEOPLE = 800;

type Kept = {
  readonly town: Settlement;
  readonly fabric: Fabric;
  /** The store it is reckoned in, none of the world's. */
  readonly store: TownStore;
  /** The year it has been reckoned to. */
  year: number;
};

/** Where a colony's town stands in its land: its region's middle, or the dry tile nearest it. */
function townTile(world: World, cell: number): number {
  const r = siteRegion(world, cell);
  if (!r) return 0;
  const size = r.size,
    mid = Math.floor(size / 2);
  for (let ring = 0; ring < mid; ring++)
    for (let j = mid - ring; j <= mid + ring; j++)
      for (let i = mid - ring; i <= mid + ring; i++) {
        if (Math.max(Math.abs(i - mid), Math.abs(j - mid)) !== ring) continue;
        const t = j * size + i;
        if (r.water[t] === WATER.land) return t;
      }
  return mid * size + mid;
}

/** The land a colony began as: when, by what event (a ship's arrival, else its founding). */
function beginning(world: World, cell: number): { year: number; event: Ref } | null {
  const land = populationContext(world).provinces.get(cell);
  if (!land || land.settledYear === null || !land.arrival) return null;
  const ship = starSitesOf(world)?.get(cell);
  return ship?.arrived
    ? { year: ship.arrives, event: ship.arrived }
    : { year: land.settledYear, event: land.arrival };
}

/** A colony's town as it was before anything was built of it, in a store of its own. */
function afresh(world: World, cell: number): Kept {
  // (Where it stands is read off its whole land: found when something first asks.)
  let tile = -1;
  const was = beginning(world, cell)!,
    ctx = populationContext(world),
    ref = colonyTownRef(cell),
    event = world.events.get(was.event),
    store = new TownStore(),
    fabric = store.add({
      town: ref,
      // (Its halls in rings about the first, where its air is kept.)
      family: "rings",
      phase: hashString(`town ${ref}`) % 3,
      next: 0,
      homes: HOLDS.map(() => 0),
      open: [],
      aim: -1,
      raise: 0,
      passed: -1,
      changes: [],
      civics: [],
      walls: null,
      lean: 0,
      forsaken: null,
    });
  return {
    town: {
      ref,
      name: placeName(ctx.culture, 90_000 + cell),
      cell,
      get tile() {
        if (tile < 0) tile = townTile(world, cell);
        return tile;
      },
      founded: was.year,
      decision: (event?.causes[0]?.ref ?? was.event) as Ref,
      event: was.event,
      population: 0,
      market: null,
    },
    fabric,
    store,
    year: was.year - 1,
  };
}

/** Teach a world to read its colonies' towns (its stores are told how, and keep nothing of them). */
export function installColonyTowns(world: World): void {
  if (!world.hasStore("population.settlements") || !world.hasStore("town.fabric")) return;
  const kept = new Map<number, Kept>(),
    fabrics = townsOf(world);
  /** Whether a land of another body has a town to read: it stands on ground, and people have come. */
  const stands = (cell: number): boolean => {
    const g = homePlanet(world).generated;
    if (!isProvinceWorld(g) || cell < g.offworld.base) return false;
    return !!siteGround(world, cell) && !!beginning(world, cell);
  };
  /** A land's town, reckoned to this year. */
  const read = (cell: number): Kept | undefined => {
    if (!stands(cell)) return undefined;
    let k = kept.get(cell);
    if (!k) kept.set(cell, (k = afresh(world, cell)));
    reckon(world, k, yearOfMoment(world.now));
    // (Its people now: under the hand, those in it; else all its land's.)
    const land = populationContext(world).provinces.get(cell),
      hand = handOf(world).over(cell);
    k.town.population = hand ? hand.agents.length + (hand.beyond ?? 0) : (land?.total() ?? 0);
    k.town.market = k.town.population >= MARKET_PEOPLE ? k.town.event : null;
    return k;
  };
  world.store<SettlementStore>("population.settlements").seen = {
    town: (ref) => {
      const cell = colonyTownCell(ref);
      return cell === null ? undefined : read(cell)?.town;
    },
    inLand: (cell) => read(cell)?.town,
  };
  fabrics.seen = (ref) => {
    const cell = colonyTownCell(ref);
    return cell === null ? undefined : read(cell)?.fabric;
  };
}

/** Whether a land knew a principle by a year, as a test of what it knew then. */
function knownIn(world: World, cell: number, year: number): (id: string) => boolean {
  const lore = loreOf(world),
    ctx = populationContext(world);
  return (id) =>
    id.split("|").some((x) => {
      // (The roots are held of a land, not of its lore: they came with its settlers.)
      if (x === "cultivation" || x === "metalworking") return knows(ctx, cell, x);
      const known = lore.get(cell, x);
      return !!known && known.year <= year;
    });
}

/**
 * A colony's town reckoned on to now, a year at a time, as `townYear` reckons a town of the home world
 * (sim/town/fabric.ts): its people from its land's ledger (of the years long gone, which history lets
 * go, the steady growth from its first settlers to the first it still holds; of the years it has
 * thinned to one in ten or a hundred, as they went from the one line to the next; of the year still
 * open, the last it closed), its buildings weighed one year in three, its homes raised as its hands
 * allow.
 */
function reckon(world: World, k: Kept, to: number, each?: (year: number) => void): void {
  if (k.year >= to) return;
  const ctx = populationContext(world),
    cell = k.town.cell,
    lines = ctx.history.yearsOf(cell),
    first = lines[0],
    settlers = Math.min(COLONISTS, first?.population ?? COLONISTS),
    begun = k.town.founded,
    beliefs = beliefOf(world),
    land = ctx.provinces.get(cell),
    designs = designsOf(world)
      .list()
      .filter((d) => d.kind === "house" && d.owner === land?.ref)
      .map((d) => d.since)
      .sort((a, b) => a - b),
    peopleIn = (y: number): number => {
      if (!first) return land?.total() ?? settlers;
      if (y < first.year) {
        // (Long past: as it must have grown, from those who came to the first the ledger still holds.)
        const share = Math.max(0, (y - begun) / Math.max(1, first.year - begun));
        return Math.round(settlers * Math.pow(Math.max(1, first.population) / settlers, share));
      }
      while (line + 1 < lines.length && lines[line + 1]!.year <= y) line++;
      const a = lines[line]!,
        b = lines[line + 1];
      return !b || a.year === y
        ? a.population
        : Math.round(
            a.population + ((b.population - a.population) * (y - a.year)) / (b.year - a.year),
          );
    };
  let line = 0;
  for (let y = k.year + 1; y <= to; y++) {
    const f = k.fabric,
      s = k.town,
      people = peopleIn(y),
      city = people >= CITY_PEOPLE,
      knows = knownIn(world, cell, y),
      builder = new TownBuilder(ctx, y, k.store),
      weighs = f.next === 0 || (y + f.phase) % 3 === 0;
    s.population = people;
    s.market = people >= MARKET_PEOPLE ? s.event : null;
    builder.settle(f);
    if (weighs)
      builder.civics(
        f,
        s,
        knows,
        city,
        () => !!beliefs.of(cell).faith,
        // (Its fresh water is made inside its halls: no mill or dock stands on a stream.)
        () => false,
      );
    if (people > housingOf(f)) {
      const top = topLevel(knows, people, city);
      f.lean = 0;
      let design = -1;
      for (const since of designs) if (since <= y) design = since;
      builder.grow(f, people, top, edgeLevel(top, city), design);
    } else builder.shrink(f, people);
    k.year = y;
    each?.(y);
  }
}

/** A keyed tint in [0, 1), from a body's ref. */
const seeded = (ref: string) => (hashString(`tint ${ref}`) >>> 0) / 2 ** 32;

/** How wide a body stands in the sky of another it circles or is circled by (degrees). */
function hangs(radiusEarths: number, thousandsKm: number): number {
  return (2 * 57.3 * (radiusEarths * 6.371)) / Math.max(1, thousandsKm);
}

/** What hangs in its sky: the world it circles, or else its first moon. */
function overOf(ground: SiteGround): ColonyLook["over"] {
  const body = ground.body,
    moon = ground.moons[0];
  return ground.parent
    ? {
        designation: ground.parent.designation,
        kind: ground.parent.kind,
        degrees: hangs(ground.parent.radius, body.orbit.a),
        tint: seeded(ground.parent.ref),
      }
    : moon
      ? {
          designation: moon.designation,
          kind: moon.kind,
          degrees: hangs(moon.radius, moon.orbit.a),
          tint: seeded(moon.ref),
        }
      : null;
}

/** How far the world a colony stands on has been remade (Phase 66; 0: not at all, or not a colony). */
export function colonyRemade(world: World, cell: number): number {
  const site = offworldSite(homePlanet(world).generated, cell);
  return site ? (lateOf(world)?.share(remakeKey(site.body, cell)) ?? 0) : 0;
}

/**
 * A colony's sky and ground, from its world's own numbers: as they are now, or (`landing`) as its first
 * ship found them.
 */
function lookOf(world: World, cell: number, ground: SiteGround, landing = false): ColonyLook {
  const g = homePlanet(world).generated,
    body = ground.body,
    k = beginning(world, cell),
    event = k ? world.events.get(k.event) : undefined,
    w = ground.world,
    settlers = (event?.data as { settlers?: unknown } | null)?.settlers,
    was = w.temperature[ground.hall] ?? body.temperature,
    site = offworldSite(g, cell),
    remaking = site ? lateOf(world)?.get(remakeKey(site.body, cell)) : undefined,
    went = remaking ? { from: remaking.year, to: remaking.last, share: remaking.share } : null,
    // (Its first ship found it as it stood that year: unmade, or some way along if they came late to it.)
    share = landing ? (went ? remakingAt(went, k?.year ?? 0) : 0) : colonyRemade(world, cell),
    base = {
      air: body.air,
      water: body.water,
      pressure: body.pressure,
      temperature: was,
      icy: w.cover[ground.hall] === COVER.ice,
    },
    now = remadeWorld(base, share);
  return {
    body: body.designation,
    bodyRef: body.ref,
    kind: body.kind,
    air: now.air,
    water: now.water,
    pressure: now.pressure,
    gravity: body.gravity,
    temperature: now.temperature,
    tint: w.tint,
    icy: now.icy,
    ...(share > 0 ? { remade: share } : {}),
    ...(landing && went ? { remaking: { ...went, base } } : {}),
    hall: ground.hall,
    star: {
      temperature: ground.star.temperature,
      // (The Sun from Earth stands half a degree wide.)
      disc: (0.533 * ground.star.radius) / Math.max(0.02, ground.au),
      light: ground.star.luminosity / Math.max(1e-4, ground.au * ground.au),
    },
    over: overOf(ground),
    day: ground.parent ? body.orbit.periodDays * 24 : 10 + 30 * seeded(body.ref),
    founded: k?.year ?? 0,
    event: k?.event ?? null,
    settlers: typeof settlers === "number" ? settlers : COLONISTS,
    keeps:
      share >= 1
        ? []
        : habitability(body, g.life.people?.body ?? null, g.system.bodies[0]!.gravity).because,
  };
}

/** A colony's look (null: a land of the home world, or a ship still sailing). */
export function colonyLook(world: World, cell: number, landing = false): ColonyLook | null {
  const ground = siteGround(world, cell);
  return ground ? lookOf(world, cell, ground, landing) : null;
}

/**
 * How a colony's ship came there, for the watching of it. Within the system: a transfer flight
 * (rules/orbits.ts, its days and the speed it asked), flown as its founding's year began. Between the
 * stars: the voyage history keeps (sim/space/voyages.ts).
 */
export function colonyVoyage(world: World, cell: number): ColonyVoyage | null {
  const g = homePlanet(world).generated;
  if (!isProvinceWorld(g)) return null;
  const site = offworldSite(g, cell);
  if (!site) return null;
  const ship = starSitesOf(world)?.get(cell);
  if (ship)
    return {
      kind: "star",
      star: ship.star,
      planet: ship.planet,
      body: null,
      distance: ship.distance,
      departed: ship.departed,
      arrives: ship.arrives,
      arrived: ship.arrived !== null,
      days: (ship.arrives - ship.departed) * 365,
      speed: null,
      drive: ship.drive,
      event: ship.voyage,
    };
  const k = beginning(world, cell);
  if (site.body < 0 || !k) return null;
  const bodies = g.system.bodies,
    list: Bodylike[] = bodies.map((b) => ({
      around: bodies.findIndex((x) => x.ref === b.orbit.around),
      a: b.orbit.a,
      periodDays: b.orbit.periodDays,
      mass: b.mass,
      radius: b.radius,
      pressure: b.pressure,
    })),
    route = routeTo(list, site.body, g.star.mass);
  return {
    kind: "system",
    star: null,
    planet: null,
    body: site.body,
    distance: 0,
    departed: k.year,
    arrives: k.year,
    arrived: true,
    days: route.days,
    speed: route.speed,
    drive: null,
    event: k.event,
  };
}

/**
 * A colony's town at each of `years`, read again from its founding in a store of its own: a town's
 * fabric holds only what stands now (the hut a tower replaced is gone from it), so what stood then is
 * what the same rules build by then.
 */
export function colonyGrowth(
  world: World,
  cell: number,
  years: readonly number[],
  planOf: (ref: Ref, fabric: Fabric) => TownPlan | null,
): ColonyGrowth {
  if (!siteGround(world, cell) || !beginning(world, cell)) return [];
  const k = afresh(world, cell),
    last = yearOfMoment(world.now),
    land = populationContext(world).provinces.get(cell),
    out: ColonyGrowth[number][] = [];
  for (const year of years) {
    const y = Math.min(year, last);
    reckon(world, k, y);
    const town = planOf(k.town.ref, k.fabric);
    if (town)
      out.push({
        year: y,
        people: y === last ? (land?.total() ?? k.town.population) : k.town.population,
        // (Lots built on: a pod's and a tower's alike, the homes the fewer as they stand the taller.)
        homes: k.fabric.next,
        town,
      });
  }
  return out;
}

/**
 * The years a colony's growth is best drawn at: from its first to now, `frames` of them at most, as
 * evenly spaced in what is seen to change (how many it houses) as its years allow. A town that filled
 * its land in two centuries and has stood as it is for four is not seen standing still for most of a
 * film of it, and one that grew slowly and late is not seen all at the end.
 */
export function colonyMoments(world: World, cell: number, frames: number): number[] {
  if (!siteGround(world, cell) || !beginning(world, cell)) return [];
  const k = afresh(world, cell),
    last = yearOfMoment(world.now),
    begun = k.town.founded,
    changes: { year: number; by: number }[] = [];
  let held = 0,
    whole = 0;
  reckon(world, k, last, (year) => {
    const now = housingOf(k.fabric),
      by = Math.abs(now - held);
    held = now;
    whole += by;
    changes.push({ year, by });
  });
  const out = [begun],
    step = whole / Math.max(1, frames - 1);
  let gone = 0,
    mark = step;
  for (const c of changes) {
    gone += c.by;
    if (gone < mark || c.year <= out.at(-1)!) continue;
    out.push(c.year);
    while (mark <= gone) mark += step;
  }
  if (out.at(-1)! < last) out.push(last);
  return out.slice(-frames - 1);
}

/** Every colony there is, the newest first; and every ship yet sailing. */
export function colonyList(world: World): ColonyEntry[] {
  const g = homePlanet(world).generated;
  if (!isProvinceWorld(g)) return [];
  const ctx = populationContext(world),
    realms = politiesOf(world),
    sites = starSitesOf(world),
    founders = new Map<number, Ref>(),
    out: ColonyEntry[] = [];
  for (const prog of spaceOf(world).all())
    for (const c of prog.colonies) founders.set(c.cell, prog.realm);
  for (let i = 0; i < g.offworld.sites.length; i++) {
    const cell = g.offworld.base + i,
      site = g.offworld.sites[i]!,
      land = ctx.provinces.get(cell);
    if (!land || land.settledYear === null) continue;
    const ship = sites?.get(cell),
      sailing = !!ship && !ship.arrived,
      ground = sailing ? null : siteGround(world, cell);
    if (!sailing && !ground) continue;
    const town = sailing ? null : ctx.settlements.get(colonyTownRef(cell)),
      ruler = realms.of(cell),
      sender = ship?.realm ?? founders.get(cell),
      founder = sender ? realms.get(sender) : undefined;
    out.push({
      cell,
      town: town?.ref ?? null,
      name: town?.name ?? null,
      body: ground?.body.designation ?? null,
      bodyIndex: site.body,
      kind: ground?.body.kind ?? null,
      star: ship?.star ?? null,
      planet: ship?.planet ?? null,
      people: land.total(),
      founded: town?.founded ?? ship?.arrives ?? land.settledYear,
      sailed: ship?.departed ?? null,
      arrives: ship?.arrives ?? null,
      sailing,
      event: ship?.arrived ?? ship?.voyage ?? land.arrival ?? null,
      realm: ruler ? realmName(ruler) : null,
      founder: founder ? realmName(founder) : null,
      sky: ground ? (overOf(ground)?.degrees ?? 0) : 0,
      remade: colonyRemade(world, cell),
    });
  }
  return out.sort((a, b) => b.founded - a.founded || a.cell - b.cell);
}

/**
 * A sealed town's plan: its sky and ground; its fields and pasture the same, under glass (the renderer's
 * to draw); no beast but what it brought, and no tool from a stone's age: it came with its ship.
 */
export function sealedPlan(world: World, plan: VillagePlan): VillagePlan {
  const cell = colonyTownCell(plan.ref),
    look = cell === null ? null : colonyLook(world, cell);
  if (!look) return plan;
  return {
    ...plan,
    colony: look,
    fauna: { wild: [], flock: null, raided: false },
    people: plan.people.map((p) =>
      p.tool ? { ...p, tool: p.tool.replace(STONE_AGE, "$1steel ") } : p,
    ),
  };
}
const STONE_AGE = /^(an? )?(flint|stone|obsidian|bone|wooden|copper|bronze) /;

export const COLONY_QUERIES: Readonly<Record<string, QueryHandler>> = {
  /** Every colony, and every ship under way. */
  "colony.list": (world) => colonyList(world),
  /** A colony's sky and ground, and how its ship came there. */
  "colony.look": (world, args) => {
    // (A landing's film shows the world its first ship found, not what its people made of it.)
    const { cell, landing } = args as { cell: number; landing?: boolean };
    return { look: colonyLook(world, cell, !!landing), voyage: colonyVoyage(world, cell) };
  },
};
