// What a world holds, read raw (Phase 65): the facts of each peopled land that what a people can do
// is measured from (rules/ages.ts), without touching the world. Asking never moves history.
import { YEAR, type World } from "../kernel/index.ts";
import {
  functionsOf,
  matterOf,
  offworldSite,
  worldChemistry,
  worldKindOf,
  type HomeWorld,
  type ProvinceWorld,
} from "../gen/index.ts";
import {
  CLADES,
  G,
  OCC,
  PRINCIPLE_INDEX,
  PRINCIPLES,
  COVER_PEOPLE_KM2,
  FLAME_GAIN,
  MIRROR_DOUBLING,
  WANTS,
  affordancesOf,
  energyOf,
  hasBeams,
  noBeamGrip,
  kindBurns,
  lacksForNext,
  mirrorKw,
  readWorld,
  worldDiscKm2,
  type AgeWorld,
  type Lack,
  type LandFacts,
  type MatterWorld,
  type WorldFacts,
  type WorldReading,
} from "../rules/index.ts";
import {
  citiesOf,
  coverOf,
  designsOf,
  lateOf,
  loreOf,
  marketsOf,
  COLONY_SHARE,
  GREAT_WORK_SHARE,
  MACHINES_PER_COST,
  MIRROR_MACHINES,
  REMAKE_MACHINES,
  PROGRAM_SHARE,
  SATELLITE_TONNES,
  STATION_TONNES,
  STARSHIP_MACHINES,
  launcherOfRealm,
  politiesOf,
  populationContext,
  prospects,
  spaceOf,
  starSitesOf,
  type Polity,
} from "../sim/index.ts";

/** The columns of a land's row of a raw reading. */
export const RAW_LAND = [
  "cell",
  "people",
  "forager",
  "farmer",
  "herder",
  "crafter",
  "trader",
  "leader",
  "flags",
  "driven",
  "machines",
] as const;
export const RAW_FLAG = {
  sown: 1,
  metal: 2,
  herds: 4,
  offworld: 8,
  ship: 16,
  arrived: 32,
} as const;

/** What the world holds as a whole. */
export type RawWorld = {
  readonly realms: number;
  readonly biggestRealm: number;
  readonly towns: number;
  readonly biggestTown: number;
  readonly cities: number;
  readonly sat: number;
  readonly crew: number;
  readonly station: number;
  /** Ages past ours (Phase 66): realms bearing beams, worlds remade, lands built on, of those peopled; mirrors (km²). */
  readonly beams?: number;
  readonly remade?: number;
  readonly built?: number;
  readonly lands?: number;
  readonly mirrors?: number;
};

/** A world's raw reading at a moment: its year, what it holds as a whole, its peopled lands in rows. */
export type RawReading = {
  readonly y: number;
  readonly w: RawWorld;
  /** Eleven numbers for each peopled land: RAW_LAND. */
  readonly l: readonly number[];
};

/** A land's works' power last year, in units of fuel or its like (burned, or given free). */
export function drivenOf(world: World, cell: number): number {
  const ctx = populationContext(world),
    m = marketsOf(world).get(cell);
  if (!m || !m.powerCover) return 0;
  const crafters = ctx.provinces.get(cell)?.occupation(OCC.crafter) ?? 0,
    industry = Math.min(1.5, loreOf(world).effect(cell, "industry")),
    engines = Math.round(crafters * industry * WANTS.fuelPerCrafter);
  return Math.round((engines * m.powerCover) / 1000);
}

/** The world as it stands now, raw. */
export function rawReading(world: World): RawReading {
  const ctx = populationContext(world),
    markets = marketsOf(world),
    g = ctx.generated,
    sites = starSitesOf(world),
    l: number[] = [];
  let towns = 0,
    biggestTown = 0;
  for (const p of ctx.provinces.all()) {
    const people = p.total();
    if (!people) continue;
    const m = markets.get(p.cell),
      site = sites?.get(p.cell);
    for (const s of ctx.settlements.inProvince(p.cell))
      if (s.population > 0) {
        towns++;
        biggestTown = Math.max(biggestTown, s.population);
      }
    l.push(
      p.cell,
      people,
      p.occupation(OCC.forager),
      p.occupation(OCC.farmer),
      p.occupation(OCC.herder),
      p.occupation(OCC.crafter),
      p.occupation(OCC.trader),
      p.occupation(OCC.leader),
      (p.knowsCultivation ? 1 : 0) |
        (m?.metalworking ? 2 : 0) |
        (p.herding ? 4 : 0) |
        (offworldSite(g, p.cell) ? 8 : 0) |
        (site ? (site.arrived ? 32 : 16) : 0),
      drivenOf(world, p.cell),
      m?.stock[G.machines] ?? 0,
    );
  }
  const realms = politiesOf(world).living(),
    space = spaceOf(world),
    past = pastOurs(world);
  let sat = 0,
    crew = 0,
    station = 0;
  for (const r of realms) {
    const prog = space.of(r.ref);
    if (prog?.satellite) sat++;
    if (prog?.crew) crew++;
    if (prog?.station) station++;
  }
  return {
    y: Math.floor(world.now / YEAR),
    w: {
      realms: realms.length,
      biggestRealm: realms.reduce((most, r) => Math.max(most, r.members.length), 0),
      towns,
      biggestTown,
      cities: citiesOf(world).all().length,
      sat,
      crew,
      station,
      beams: past.beams,
      remade: past.remade,
      built: past.built,
      lands: past.lands,
      mirrors: past.mirrors,
    },
    l,
  };
}

/** What a world has come to past our ages, as a record or a reading holds it (Phase 66). */
function pastOurs(world: World): {
  beams: number;
  remade: number;
  built: number;
  lands: number;
  mirrors: number;
} {
  const late = lateOf(world),
    designs = designsOf(world),
    { built, lands } = coverOf(populationContext(world));
  let beams = 0;
  for (const r of politiesOf(world).living()) if (hasBeams(designs.of(r.ref)?.parts ?? [])) beams++;
  return {
    beams,
    remade: late ? late.all().filter((r) => r.done).length : 0,
    built,
    lands,
    mirrors: late?.mirrors?.km2 ?? 0,
  };
}

/** What a world's mirrors gather, and how many times what falls on its whole world that is. */
function gatheredOf(g: HomeWorld, km2: number): { mirrorKw: number; gathered: number } {
  if (km2 <= 0) return { mirrorKw: 0, gathered: 0 };
  return {
    mirrorKw: mirrorKw(km2, g.star.luminosity, g.system.bodies[0]!.orbit.a),
    gathered: km2 / worldDiscKm2(g.planet.radius),
  };
}

/** What every land came to know, and when: for each land, its cell, then principle and year in turn. */
export function rawLore(world: World): number[][] {
  const lore = loreOf(world),
    g = populationContext(world).generated,
    out: number[][] = [];
  for (let cell = 0; cell < g.grid.count; cell++) {
    const known = lore.of(cell);
    if (!known.length) continue;
    const row = [cell];
    for (const [id, k] of known) row.push(PRINCIPLE_INDEX.get(id)!, k.year);
    out.push(row);
  }
  return out;
}

// —— The reading, from a raw record or the world itself ———————————————————————————————————————————

/** What the ages go by on a generated world: its chemistry and kind, its people's body, its girth. */
export function ageWorldOf(g: HomeWorld): AgeWorld {
  const body = g.life.people?.body ?? CLADES.find((c) => c.id === "ape")!.body,
    kind = worldKindOf(g),
    noGrip = noBeamGrip(body);
  return {
    chem: worldChemistry(g),
    kind,
    medium: body.medium,
    fire: kindBurns(kind) && affordancesOf(body).fire,
    radius: g.planet.radius,
    // (Read when its functions are first asked: a world's reading of its first ages never needs them.)
    get functions() {
      return functionsOf(g);
    },
    spectral: g.star.spectral,
    celsius: g.planet.meanTemperature,
    ...(noGrip ? { noGrip } : {}),
  };
}

export { matterOf };

/** What a world's matter is asked of, for its functions. */
export function matterWorldOf(world: World): MatterWorld {
  return matterOf(populationContext(world).generated);
}

/** How far a body of its system lies from the home world (km). */
export function bodyKm(g: HomeWorld, index: number): number {
  const bodies = g.system.bodies,
    home = bodies[0]!,
    b = bodies[index];
  if (!b) return 0;
  const around = bodies.findIndex((x) => x.ref === b.orbit.around);
  // (A moon of the home world's orbit is told in thousands of km; a planet's in AU.)
  if (around === 0) return b.orbit.a * 1000;
  const planet = around > 0 ? bodies[around]! : b;
  return Math.abs(planet.orbit.a - home.orbit.a) * 1.496e8;
}

/** A raw record as the ages read it, given what each land knew in that year. */
export function factsOfRaw(
  raw: RawReading,
  g: ProvinceWorld,
  knew: (cell: number, id: string) => boolean,
): { lands: LandFacts[]; facts: WorldFacts } {
  const lands: LandFacts[] = [],
    columns = RAW_LAND.length;
  let colonyKm = 0,
    starLy = 0,
    arrived = false;
  for (let i = 0; i < raw.l.length; i += columns) {
    const cell = raw.l[i]!,
      people = raw.l[i + 1]!,
      flags = raw.l[i + 8]!;
    if (flags & RAW_FLAG.ship) starLy = Math.max(starLy, 1);
    else if (flags & RAW_FLAG.arrived) {
      starLy = Math.max(starLy, 1);
      arrived = true;
    } else if (flags & RAW_FLAG.offworld) {
      const site = offworldSite(g, cell);
      if (site && site.body >= 0) colonyKm = Math.max(colonyKm, bodyKm(g, site.body));
    }
    lands.push({
      cell,
      people,
      farmers: raw.l[i + 3]!,
      herders: raw.l[i + 4]!,
      sown: !!(flags & RAW_FLAG.sown),
      driven: raw.l[i + 9]!,
      machines: raw.l[i + 10]!,
      knows: (id) =>
        id === "cultivation"
          ? !!(flags & RAW_FLAG.sown)
          : id === "metalworking"
            ? !!(flags & RAW_FLAG.metal)
            : knew(cell, id),
    });
  }
  return {
    lands,
    facts: {
      ...raw.w,
      colonyKm,
      starLy,
      arrived,
      beams: raw.w.beams ?? 0,
      remade: raw.w.remade ?? 0,
      cover: raw.w.lands ? (raw.w.built ?? 0) / raw.w.lands : 0,
      ...gatheredOf(g, raw.w.mirrors ?? 0),
    },
  };
}

const READ = new WeakMap<World, { at: number; reading: WorldReading; lands: LandFacts[] }>();

/** What each land holds now, and the world as a whole, without a record between. */
function factsNow(world: World): { lands: LandFacts[]; facts: WorldFacts } {
  const ctx = populationContext(world),
    g = ctx.generated,
    lore = loreOf(world),
    markets = marketsOf(world),
    sites = starSitesOf(world),
    lands: LandFacts[] = [];
  let towns = 0,
    biggestTown = 0,
    colonyKm = 0,
    starLy = 0,
    arrived = false;
  for (const p of ctx.provinces.all()) {
    const people = p.total();
    if (!people) continue;
    const cell = p.cell,
      m = markets.get(cell),
      site = offworldSite(g, cell),
      ship = sites?.get(cell);
    if (ship) {
      starLy = Math.max(starLy, ship.distance);
      if (ship.arrived) arrived = true;
    } else if (site && site.body >= 0) colonyKm = Math.max(colonyKm, bodyKm(g, site.body));
    for (const s of ctx.settlements.inProvince(cell))
      if (s.population > 0) {
        towns++;
        biggestTown = Math.max(biggestTown, s.population);
      }
    lands.push({
      cell,
      people,
      farmers: p.occupation(OCC.farmer),
      herders: p.occupation(OCC.herder),
      sown: p.knowsCultivation,
      driven: drivenOf(world, cell),
      machines: m?.stock[G.machines] ?? 0,
      knows: (id) =>
        id === "cultivation"
          ? p.knowsCultivation
          : id === "metalworking"
            ? !!m?.metalworking
            : !!lore.get(cell, id),
    });
  }
  const realms = politiesOf(world).living(),
    space = spaceOf(world),
    past = pastOurs(world);
  let sat = 0,
    crew = 0,
    station = 0;
  for (const r of realms) {
    const prog = space.of(r.ref);
    if (prog?.satellite) sat++;
    if (prog?.crew) crew++;
    if (prog?.station) station++;
  }
  return {
    lands,
    facts: {
      realms: realms.length,
      biggestRealm: realms.reduce((most, r) => Math.max(most, r.members.length), 0),
      towns,
      biggestTown,
      sat,
      crew,
      station,
      colonyKm,
      starLy,
      arrived,
      beams: past.beams,
      remade: past.remade,
      cover: past.lands ? past.built / past.lands : 0,
      ...gatheredOf(g, past.mirrors),
    },
  };
}

/** The world's reading now: its measures and the age they make (read once for each moment asked). */
export function worldReadingOf(world: World): { reading: WorldReading; lands: LandFacts[] } {
  const kept = READ.get(world);
  if (kept?.at === world.now) return kept;
  const { lands, facts } = factsNow(world),
    reading = readWorld(lands, facts, ageWorldOf(populationContext(world).generated)),
    fresh = { at: world.now, reading, lands };
  READ.set(world, fresh);
  return fresh;
}

const lands = (world: World) => worldReadingOf(world).lands;

/** What it would take for a realm to do what its people already know how to, in machines; and what the richest holds. */
function wantingFor(world: World, age: string): string | null {
  const ctx = populationContext(world),
    markets = marketsOf(world),
    space = spaceOf(world),
    machines = (r: Polity) =>
      r.members.reduce((n, c) => n + (markets.get(c)?.stock[G.machines] ?? 0), 0),
    richest = (list: readonly Polity[]) => list.reduce((most, r) => Math.max(most, machines(r)), 0),
    many = (n: number) => `${Math.round(n)}`.replace(/\B(?=(\d{3})+(?!\d))/g, ","),
    realms = politiesOf(world).living(),
    stationed = realms.filter((r) => space.of(r.ref)?.station);
  // Past our ages (Phase 66): what stands between knowing how and doing it, where a station is not it.
  if (age === "fusion")
    return `Its flame gives only as much as it has works to drive: ${FLAME_GAIN} times what its fuel did, for each of its crafters' engines. Its foremost land stands at ${Math.round(Math.max(...worldReadingOf(world).lands.map(energyOf)))} kW a head.`;
  if (age === "minds")
    return "Its minds are in its machines: past a tenth of a machine a head, a land's sums rise with them.";
  if (age === "beams")
    return `No realm has armed its host with them yet. A beam arm is made of its machines: a realm takes them up when its smiths hold the machines to make them, and they are better than what it has.`;
  if (age === "covered") {
    const { built, lands: peopled } = coverOf(ctx);
    return `${many(built)} of its ${many(peopled)} peopled lands hold ${COVER_PEOPLE_KM2} people to the square kilometre, and half of them makes a world covered.`;
  }
  if (age === "orbit") {
    const able = realms.filter((r) => launcherOfRealm(ctx, r));
    if (!able.length) return "No realm that knows how has an engine that will lift off its ground.";
    const want = Math.min(
      ...able.map(
        (r) =>
          (launcherOfRealm(ctx, r)!.cost * SATELLITE_TONNES * MACHINES_PER_COST) / PROGRAM_SHARE,
      ),
    );
    return `A first satellite asks a realm to hold ${many(want)} machines; the richest that knows how holds ${many(richest(able))}.`;
  }
  if (!stationed.length) {
    const able = realms.filter((r) => launcherOfRealm(ctx, r));
    if (!able.length) return "No realm has an engine that will lift a station off its ground.";
    const want = Math.min(
        ...able.map(
          (r) =>
            (launcherOfRealm(ctx, r)!.cost * STATION_TONNES * MACHINES_PER_COST) / PROGRAM_SHARE,
        ),
      ),
      makes = lands(world).some((f) => f.knows("factories") || f.knows("sea-works"));
    return `No realm has built a station in orbit to set out from: it asks a realm to hold ${many(want)} machines, and the richest holds ${many(richest(able))}.${makes ? "" : " Nothing here makes machines: what it has, visitors gave."}`;
  }
  if (age === "worlds") {
    const want = stationed.flatMap((r) => prospects(ctx, r).map((x) => x.cost / COLONY_SHARE));
    if (!want.length)
      return "No other body its people could live on is within their drives' reach.";
    return `The nearest settling asks a realm to hold ${many(Math.min(...want))} machines; the richest with a station holds ${many(richest(stationed))}.`;
  }
  if (age === "stars")
    return `A ship to the stars asks a realm with a station to hold ${many(STARSHIP_MACHINES / COLONY_SHARE)} machines; the richest holds ${many(richest(stationed))}.`;
  // Past our ages (Phase 66): what stands between knowing and doing, in machines and years.
  if (age === "gathered") {
    const m = lateOf(world)?.mirrors;
    if (m)
      return `Its mirrors stand at ${many(m.km2)} km², doubling every ${MIRROR_DOUBLING} years while a realm with a station tends them, and it takes ${many(worldDiscKm2(populationContext(world).generated.planet.radius))} km² to gather what falls on its whole world.`;
    return `A first works of mirrors asks a realm with a station to hold ${many(MIRROR_MACHINES / GREAT_WORK_SHARE)} machines; the richest holds ${many(richest(stationed))}.`;
  }
  if (age === "remade") {
    const going = lateOf(world)
      ?.all()
      .filter((r) => !r.done);
    if (going?.length)
      return `${going.length} world${going.length === 1 ? " is" : "s are"} being remade, the furthest ${Math.round(Math.max(...going.map((r) => r.share)) * 100)} in a hundred of the way.`;
    return `A world's remaking asks a realm with halls on it to hold ${many(REMAKE_MACHINES / GREAT_WORK_SHARE)} machines; the richest with a station holds ${many(richest(stationed))}.`;
  }
  return null;
}

/** What the world lacks for the next age: what any of its lands knows is known to it. */
export function lacksNow(
  world: World,
): { age: WorldReading["age"]; lacks: (Lack & { readonly wanting?: string })[] } | null {
  const { reading, lands } = worldReadingOf(world),
    known = (id: string) => lands.some((f) => f.knows(id)),
    got = lacksForNext(reading, known, ageWorldOf(populationContext(world).generated));
  if (!got) return null;
  return {
    age: got.age,
    lacks: got.lacks.map((l) => {
      const wanting = l.known ? wantingFor(world, got.age.id) : null;
      return wanting ? { ...l, wanting } : l;
    }),
  };
}

/** A world's domains' hashes in one short mark: what a catalogue keeps to tell its history has not moved. */
export function historyCheck(hashes: readonly (readonly [string, string])[]): string {
  let h = 0;
  for (const [k, v] of [...hashes].sort((a, b) => (a[0] < b[0] ? -1 : 1)))
    for (const c of `${k}:${v};`) h = (Math.imul(h, 31) + c.charCodeAt(0)) | 0;
  return (h >>> 0).toString(16);
}

/**
 * A short check on what a record holds of a world at a year far on. A catalogue's years hold only while
 * the history they were run under does, and a universe's version is moved by hand, so a far year is
 * compared where a world is run there anyway (tools/bake.ts).
 */
export function readingMark(raw: RawReading): string {
  let h = 0;
  for (const c of JSON.stringify(raw)) h = (Math.imul(h, 31) + c.charCodeAt(0)) | 0;
  return (h >>> 0).toString(16);
}

/** Every principle in its place, for a record that keeps them by number. */
export const RAW_PRINCIPLES = PRINCIPLES.map((p) => p.id);
