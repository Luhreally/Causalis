// A people on its own ground, as the eye reads it (Phase 69, first slice): the camp or the town of a people
// read off its world (sim/space/natives.ts), its look from that world's numbers and its life's (Phase 34), its
// sky and ground as a colony's are read (Phase 64), what it carries from what its ground gives (F1); who came
// to them, and what a meeting of the two can be. A town is reckoned here by the same builder as any other
// (sim/town/fabric.ts), in a store of its own; nothing here enters history.
import {
  DAY,
  Rng,
  hashString,
  makeRef,
  mix,
  parseRef,
  type Ref,
  type World,
} from "../kernel/index.ts";
import {
  CIVILIZATION,
  COVER,
  civName,
  foreignPlanets,
  type GalaxyStar,
  type Sketched,
} from "../gen/index.ts";
import { CLADES, HOLDS, OCC, pigmentOverride, roofPitch, type BodyPlan } from "../rules/index.ts";
import {
  CHANGE,
  STAGE_WORDS,
  SETTLEMENT,
  TownBuilder,
  TownStore,
  arrivalsAt,
  clusterOf,
  contactBetween,
  civilizationsNear,
  edgeLevel,
  folkArms,
  folkByRef,
  folkGround,
  folkOf,
  folkPeak,
  folkPeople,
  folkPlacePeople,
  folkStage,
  folksNear,
  hasTown,
  homeParty,
  homePlanet,
  housingOf,
  partyOf,
  peopleWords,
  politiesOf,
  populationContext,
  realmName,
  starSitesOf,
  topLevel,
  type Arrival,
  type Fabric,
  type Folk,
  type FolkStage,
  type Party,
  type Settlement,
} from "../sim/index.ts";
import {
  LOT,
  lotStates,
  progress,
  townLots,
  type CampCraft,
  type CampNear,
  type ColonyLook,
  type FolkContact,
  type FolkFacts,
  type FolkList,
  type FolkNear,
  type TownPlan,
  type VillagePlan,
  type Visitor,
} from "../bridge/index.ts";
import { figureBody, starFolk } from "./folk.ts";
import { lifeHere } from "./biochem.ts";
import { PEOPLE_COLORS } from "./peoples.ts";
import { townPlan } from "./town.ts";
import type { QueryHandler } from "./host.ts";

/** A people's town: its star's sector past a thousand, and its place among its star's worlds. */
export function folkTownRef(f: Folk): Ref {
  const { a, b } = parseRef(f.ref);
  return makeRef(SETTLEMENT, 1000 + a, b);
}
/** The people of a town (null: a town of no people of another star). */
export function folkOfTown(world: World, ref: string): Folk | null {
  if (!ref.startsWith("town:")) return null;
  const { a, b } = parseRef(ref as Ref);
  return a >= 1000 ? folkByRef(world, makeRef(CIVILIZATION, a - 1000, b)) : null;
}
/** The star a people's ref speaks of. */
function starOf(world: World, f: Folk): GalaxyStar | null {
  return clusterOf(world).find((s) => s.ref === f.star) ?? null;
}

// —— Its look ——————————————————————————————————————————————————————————————————————————

/** What a people's look is made of: its world's numbers and the forebears it sketched. */
export function folkFactsOf(f: Folk, star: GalaxyStar): FolkFacts {
  if (f.followed) return starFolk(f.followed);
  const g = f.forebear?.genome,
    draw = (n: number) => ((hashString(`${f.ref} folk ${n}`) >>> 0) % 10_000) / 10_000;
  return {
    key: hashString(`${f.ref} folk`) >>> 0,
    gravity: f.gravity,
    star: star.temperature,
    warmth: f.warmth,
    rain: 200 + 2000 * draw(3),
    biome: Math.floor(16 * draw(4)),
    forebears: g
      ? {
          neck: g.neck,
          tail: g.tail,
          grows: [...g.grows],
          eyes: g.eyes,
          feelers: g.feelers,
          pattern: g.pattern,
          covering: g.skin,
          legs: g.legs,
        }
      : null,
    ...(f.life.blood === "iron" ? {} : { blood: f.life.blood }),
    ...(f.life.shell === "calcite" ? {} : { shell: f.life.shell }),
    ...(f.life.pigment === "chlorophyll" ? {} : { lifeLook: f.life.pigment }),
  };
}

/** A people's figure, as the view draws it. */
export function folkFigure(f: Folk, star: GalaxyStar): NonNullable<VillagePlan["body"]> {
  const body: BodyPlan = f.followed
    ? (CLADES.find((c) => c.id === f.followed!.clade)!.body as unknown as BodyPlan)
    : f.body;
  return figureBody(body, folkFactsOf(f, star));
}

const tinted = (ref: string) => (hashString(`tint ${ref}`) >>> 0) / 2 ** 32;

/** A people's sky and ground, as a colony's are read: their own world's, and no halls: they breathe it. */
export function folkLook(world: World, f: Folk, star: GalaxyStar): ColonyLook | null {
  const ground = folkGround(world, star, f.planet);
  if (!ground) return null;
  const body = ground.body,
    w = ground.world;
  return {
    body: body.designation,
    bodyRef: body.ref,
    kind: body.kind,
    air: "breathable",
    water: body.water,
    pressure: body.pressure,
    gravity: body.gravity,
    temperature: w.temperature[ground.hall] ?? body.temperature,
    tint: w.tint,
    icy: w.cover[ground.hall] === COVER.ice,
    remade: 1,
    hall: ground.hall,
    star: {
      temperature: ground.star.temperature,
      disc: (0.533 * ground.star.radius) / Math.max(0.02, ground.au),
      light: ground.star.luminosity / Math.max(1e-4, ground.au * ground.au),
    },
    over: null,
    day: 10 + 30 * tinted(body.ref),
    founded: f.arose,
    event: null,
    settlers: 0,
    keeps: [],
  };
}

/** A name for one of them, in their own sounds. */
function oneName(world: World, f: Folk, i: number): string {
  const { a, b } = parseRef(f.ref);
  return civName(new Rng(world.seed), { ref: makeRef(CIVILIZATION, a + 1 + i, b) });
}

/** A sketched body as a meadow's lineage: its niche what the meadow knows, of its way. */
function lineageOf(f: Folk, s: Sketched, i: number) {
  const walking = s.way === "walker" || s.way === "land crawler" || s.way === "burrower";
  return {
    ref: f.ref,
    name: s.name,
    niche: walking ? "grazer" : s.way,
    arose: 0,
    died: null,
    size: (s.body as unknown as { size?: number }).size ?? 40 + 30 * i,
    level: 1,
    body: s.body as never,
    words: null,
  };
}

/** What they make their things of: its ground's keenest stone, and what grows there. */
function campCraft(f: Folk): CampCraft {
  const own = pigmentOverride(f.chem, "basalt");
  return {
    stone: {
      name: f.stone.name,
      from: f.stone.from,
      keen: f.stone.keen,
      tough: f.stone.tough,
      colour: f.stone.colour,
    },
    wood: "stem",
    fibre: "stalk",
    binding: "sinew",
    pigment: own ?? { name: "red ochre", colour: [0.6, 0.22, 0.14] },
    fire: f.means.burns ? "bow drill" : "none",
  };
}

// —— A camp ————————————————————————————————————————————————————————————————————————————

function campOf(
  world: World,
  f: Folk,
  star: GalaxyStar,
  title: string,
  year: number,
  filmed: boolean,
): CampNear {
  const stage = folkStage(f, year),
    size = folkPlacePeople(f, stage),
    beasts = f.beasts.filter(
      (s) =>
        s.way === "walker" ||
        s.way === "grazer" ||
        s.way === "hunter" ||
        s.way === "burrower" ||
        s.way === "land crawler",
    );
  return {
    cell: -1,
    camp: {
      id: 0,
      tile: 0,
      home: 0,
      people: folkPeople(f, year),
      bands: Math.max(1, Math.round(folkPeople(f, year) / size)),
      herds: false,
    },
    land: title,
    people: f.name,
    figure: folkFigure(f, star),
    plan: {
      seed: `${world.seed.text} camp ${f.ref}`,
      ages: [
        {
          index: 0,
          from: 0,
          to: 0,
          kind:
            f.warmth < 8
              ? "icehouse"
              : f.warmth > 32
                ? "dry"
                : f.warmth > 24
                  ? "hothouse"
                  : "quiet",
          seaLevel: 0,
          warmth: 0,
          forests: f.warmth > 2 && f.warmth < 38,
        },
      ],
      ...(f.life.pigment === "chlorophyll" ? {} : { lifeLook: f.life.pigment }),
      lineages: beasts.map((s, i) => lineageOf(f, s, i)) as never,
    },
    flocks: [],
    size,
    names: Array.from({ length: size }, (_, i) => oneName(world, f, i)),
    // (A ship seen coming down is seen by day; else the world's own hour.)
    hour: filmed ? 10 : ((world.now % DAY) / DAY) * 24,
    craft: campCraft(f),
  };
}

// —— A town ————————————————————————————————————————————————————————————————————————————

/** What a stage's people know, as a building and a home's height ask it. */
const KNOWN: Readonly<Record<string, readonly string[]>> = {
  villages: ["cultivation", "granaries"],
  towns: [
    "cultivation",
    "granaries",
    "pottery-wheel",
    "masonry",
    "writing",
    "law-codes",
    "carpentry",
  ],
  cities: [
    "cultivation",
    "granaries",
    "pottery-wheel",
    "masonry",
    "writing",
    "law-codes",
    "carpentry",
    "bronze",
    "mills",
    "philosophy",
    "sanitation",
    "astronomy",
    "mathematics",
  ],
  works: [
    "cultivation",
    "granaries",
    "pottery-wheel",
    "masonry",
    "writing",
    "law-codes",
    "carpentry",
    "bronze",
    "mills",
    "philosophy",
    "sanitation",
    "astronomy",
    "mathematics",
    "medicine",
    "factories",
    "steam-engine",
    "railways",
  ],
};
for (const k of ["signals", "orbit", "stars"])
  (KNOWN as Record<string, readonly string[]>)[k] = [
    ...KNOWN.works!,
    "steel",
    "electricity",
    "electronics",
  ];

type Kept = {
  readonly town: Settlement;
  readonly fabric: Fabric;
  readonly store: TownStore;
  readonly to: number;
};
const TOWNS = new Map<string, Kept>();

const yearOf = (world: World) => Math.floor(world.now / (365 * DAY));

/** The town of a people, reckoned to a year from its first homes, or all of it let fall. */
function townOf(world: World, f: Folk, year: number): Kept {
  // (Ruins are drawn as walls yet standing, whenever they fell: a page says when. Kept ten years at a time.)
  const step = Math.floor(year / 10) * 10,
    key = `${world.seed.text} ${f.ref} ${step}`,
    known = TOWNS.get(key);
  if (known) return known;
  const ctx = populationContext(world),
    ref = folkTownRef(f),
    store = new TownStore(),
    fabric = store.add({
      town: ref,
      family: (["lanes", "grid", "rings"] as const)[(hashString(`${f.ref} family`) >>> 0) % 3]!,
      phase: (hashString(`town ${ref}`) >>> 0) % 3,
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
    }),
    town: Settlement = {
      ref,
      name: oneName(world, f, 900),
      cell: -1,
      tile: 0,
      founded: f.arose,
      decision: f.ref,
      event: f.ref,
      population: 0,
      market: null,
    } as unknown as Settlement;
  // (Let fall five years before the ten kept begin: roofless, its walls yet high, at every year of them.)
  const gone = step - 5,
    stands = f.fell === null || year < f.fell,
    end = stands ? year : Math.min(f.fell!, gone),
    // (The stage its own years would have it at; ruins, in the years as they are drawn.)
    stageAt = (y: number) =>
      stands
        ? folkStage(f, y)
        : folkStage({ ...f, fell: null, arose: f.arose + (gone - f.fell!) }, y),
    first = stands
      ? f.arose + Math.round(130 * f.pace)
      : gone - Math.max(40, Math.min(240, Math.round(f.fell! - f.arose))),
    last = stands ? end : gone,
    every = Math.max(1, Math.floor((last - first) / 48));
  for (
    let y = Math.min(first, last - 1);
    y <= last;
    y = y + every > last && y < last ? last : y + every
  ) {
    const stage = stageAt(y),
      people = folkPlacePeople(f, stage),
      city =
        stage === "cities" ||
        stage === "works" ||
        stage === "signals" ||
        stage === "orbit" ||
        stage === "stars",
      known = new Set(KNOWN[stage] ?? []),
      knows = (id: string) => id.split("|").some((x) => known.has(x)),
      builder = new TownBuilder(ctx, y, store);
    town.population = people;
    town.market = people >= 800 ? town.event : null;
    builder.settle(fabric);
    builder.civics(
      fabric,
      town,
      knows,
      city,
      () => false,
      () => false,
    );
    if (people > housingOf(fabric)) {
      const top = topLevel(knows, people, city);
      fabric.lean = 0;
      for (let k = 0; k < 8 && people > housingOf(fabric); k++)
        builder.grow(fabric, people, top, edgeLevel(top, city), -1);
    }
    if (y >= last) break;
  }
  if (!stands) {
    // All of it let fall: its homes the year its people went, its other buildings as their years come.
    town.population = 0;
    town.market = null;
    const down = new TownBuilder(ctx, last + 1, store);
    down.settle(fabric);
    down.raze(fabric, 1, true, undefined, CHANGE.fell);
    for (let y = last + 2; y <= last + 4; y++) {
      const builder = new TownBuilder(ctx, y, store);
      builder.settle(fabric);
      builder.civics(
        fabric,
        town,
        () => false,
        false,
        () => false,
        () => false,
      );
    }
  }
  const kept = { town, fabric, store, to: year };
  if (TOWNS.size >= 6) TOWNS.delete(TOWNS.keys().next().value!);
  TOWNS.set(key, kept);
  return kept;
}

/** How a people builds, from what its stage and its ground give. */
function houseOf(f: Folk, stage: FolkStage): VillagePlan["house"] {
  const stone = stage === "cities" || stage === "works" || stage === "towns";
  return {
    walls: stone ? "stone" : "wattle",
    roof: stone ? "flat" : "thatch",
    form: (hashString(`${f.ref} form`) >>> 0) % 2 ? "round" : "long",
    pitch: roofPitch(stone ? "flat" : "thatch", 800),
    design: null,
  };
}

/** A people's town as a village's plan is: lots, folk, its own world's sky and ground. */
export function folkTownPlan(
  world: World,
  f: Folk,
  families: number,
  folk: number,
  /** The year it is read at: now, or as a ship found it (a meeting filmed). */
  at?: number,
): VillagePlan {
  const year = at ?? yearOf(world),
    star = starOf(world, f)!,
    stage = folkStage(f, year),
    peak = folkPeak(f, year),
    kept = townOf(world, f, year),
    ref = folkTownRef(f),
    seed = hashString(`village ${ref}`),
    axis = ((seed >>> 8) % 628) / 100,
    look = folkLook(world, f, star)!,
    built = townPlan(world, ref, axis, families * families * 80, null, kept.fabric),
    house = houseOf(f, peak);
  const town: TownPlan | undefined = built
    ? (() => {
        const {
          struck: _struck,
          kind: _kind,
          lifeLook: _life,
          ...rest
        } = built as TownPlan & {
          struck?: unknown;
          kind?: unknown;
          lifeLook?: unknown;
        };
        return {
          ...rest,
          ...(f.life.pigment === "chlorophyll" ? {} : { lifeLook: f.life.pigment }),
          designs: (built.designs.length
            ? built.designs
            : [{ since: -1, walls: "", roof: "", form: "", pitch: 0 }]
          ).map((d) => ({
            since: d.since,
            walls: house.walls,
            roof: house.roof,
            form: house.form,
            pitch: house.pitch,
          })),
        } as TownPlan;
      })()
    : undefined;
  // Homes for everyone: the lots that stand (ruins: what stood), nearest its square.
  const homes: { x: number; z: number; yaw: number; household: string | null }[] = [],
    population = stage === "ruins" ? 0 : folkPlacePeople(f, stage),
    count = Math.max(4, Math.min(160, Math.ceil(population / 5)));
  if (town) {
    const lots = townLots(town.family, town.seed, town.axis, town.lots, town.water),
      states = lotStates(town);
    for (let p = 0; p < town.lots && homes.length < count; p++)
      if (
        (states.what[p] === LOT.home &&
          progress(states.began[p]!, states.takes[p]!, world.now) >= 1) ||
        stage === "ruins"
      )
        homes.push({ x: lots.x[p]!, z: lots.z[p]!, yaw: lots.yaw[p]!, household: null });
  }
  for (let k = homes.length; k < 4; k++) {
    const a = k * 2.399963;
    homes.push({ x: 24 * Math.cos(a), z: 24 * Math.sin(a), yaw: a, household: null });
  }
  const reach = homes.reduce((m, h) => Math.max(m, Math.hypot(h.x, h.z)), 40),
    fields: VillagePlan["fields"][number][] = [];
  if (stage !== "ruins" && stage !== "stars" && stage !== "orbit")
    for (let k = 0; k < Math.max(6, Math.min(40, Math.round(count * 0.5))); k++) {
      const ring = Math.floor(k / 12),
        an = axis + (((k % 12) - 5.5) / 12) * 2.6,
        rad = reach + 70 + ring * 45;
      fields.push({
        x: rad * Math.cos(an),
        z: rad * Math.sin(an),
        w: 36,
        d: 24,
        yaw: an,
      });
    }
  const era: NonNullable<VillagePlan["era"]> =
      peak === "villages"
        ? "farm"
        : peak === "towns"
          ? "farm"
          : peak === "cities"
            ? "metal"
            : peak === "works"
              ? "industry"
              : "modern",
    shown = Math.min(folk || 24, Math.ceil(population / 12)),
    people: VillagePlan["people"][number][] = [];
  for (let i = 0; i < shown; i++) {
    const k = mix(hashString(`${f.ref} one`), i) >>> 0,
      child = k % 6 === 0;
    people.push({
      ref: folkOneRef(f, i),
      name: oneName(world, f, i),
      home: Math.floor(i / 4) % homes.length,
      age: child ? 4 + ((k >>> 3) % 11) : 18 + ((k >>> 3) % 40),
      occupation: child
        ? OCC.dependent
        : [OCC.farmer, OCC.farmer, OCC.crafter, OCC.herder][(k >>> 8) % 4]!,
      child,
      sex: (k >>> 12) & 1,
      folk: true,
      role: `one of the ${f.name}, of ${kept.town.name}`,
    });
  }
  return {
    ref,
    name: kept.town.name,
    population,
    market: population >= 800,
    hand: false,
    biome: f.warmth > 30 ? 6 : f.warmth < 8 ? 2 : 4,
    ...(f.means.burns ? {} : { fireless: true as const }),
    ...(f.life.pigment === "chlorophyll" ? {} : { lifeLook: f.life.pigment }),
    colony: look,
    seed,
    homes,
    fields,
    pasture: { x: -(reach + 90) * Math.cos(axis), z: -(reach + 90) * Math.sin(axis), r: 60 },
    wild: Math.round(reach + 220),
    water: null,
    house,
    road: { x: (reach + 300) * Math.cos(axis + 2), z: (reach + 300) * Math.sin(axis + 2) },
    districts: null,
    ...(town ? { town } : {}),
    people,
    era,
    fauna: {
      wild: f.beasts
        .filter((s) => s.way === "grazer" || s.way === "hunter" || s.way === "walker")
        .slice(0, 3)
        .map((s) => ({
          ref: f.ref,
          name: s.name,
          niche: s.way === "hunter" ? "hunter" : "grazer",
          size: 80,
          wool: false,
          stock: 0.7,
          body: s.body as never,
        })),
      flock: null,
      raided: false,
    },
    native: { ref: f.ref, star: f.star, index: f.planet, stage },
    body: folkFigure(f, star),
  } as VillagePlan;
}

/** One of a people's town, by their place in its crowd. */
export const folkOneRef = (f: Folk, i: number) => `folkone:${f.ref}:${i}`;

// —— Who came ———————————————————————————————————————————————————————————————————————————

/** The people who came, as a meeting reads them. */
export function comer(
  world: World,
  a: Arrival,
): { party: Party; figure: Visitor["body"] | null; name: string } {
  if (a.kind === "home") {
    const party = homeParty(world, lifeHere(world));
    return { party, figure: null, name: party.name };
  }
  const civ = civilizationsNear(world).find((c) => c.ref === a.civ)!,
    theirs = folkByRef(world, civ.ref);
  if (!theirs) {
    const home = homeParty(world, lifeHere(world));
    return { party: home, figure: null, name: home.name };
  }
  const star = starOf(world, theirs);
  return {
    party: partyOf(theirs),
    figure: star ? folkFigure(theirs, star) : null,
    name: `the ${peopleWords(world, civ).name}`,
  };
}

/** How the first who came and a people can meet, told; and a sight of them for the eye. */
export function folkContact(world: World, f: Folk): FolkContact | null {
  const year = yearOf(world),
    first = arrivalsAt(world, f).find((a) => a.found !== "ruins") ?? arrivalsAt(world, f)[0];
  if (!first) return null;
  const who = comer(world, first),
    reading = contactBetween(who.party, partyOf(f)),
    civIndex = first.civ ? civilizationsNear(world).findIndex((c) => c.ref === first.civ) : -1,
    color =
      civIndex >= 0
        ? PEOPLE_COLORS[civIndex % PEOPLE_COLORS.length]!
        : ([0.86, 0.9, 0.96] as const),
    site = first.kind === "home" ? starSitesOf(world)?.get(first.cell!) : undefined,
    realm = site ? politiesOf(world).get(site.realm) : undefined;
  return {
    year: first.year,
    kind: first.kind,
    who: who.name,
    sentBy: realm ? realmName(realm) : null,
    cell: first.cell,
    event: first.event,
    foundStage: first.found,
    found: STAGE_WORDS[first.found],
    since: year - first.year,
    reading,
    color,
    ...(who.figure ? { figure: who.figure } : {}),
  };
}

/** The sight of those who came, on a people's ground. */
export function comersSeen(world: World, f: Folk, c: FolkContact): Visitor {
  const home = homePlanet(world).generated.life.people?.body,
    apeBody = CLADES.find((x) => x.id === "ape")!.body as unknown as BodyPlan;
  return {
    civ: f.ref,
    name: c.who,
    kind: "",
    body: c.figure ?? figureBody(home ?? apeBody, null),
    color: c.color,
    why: "landing",
    year: c.year,
    event: c.event ?? f.ref,
    count: 6,
    theirs: null,
    ours: null,
  };
}

// —— The queries ————————————————————————————————————————————————————————————————————————

/** What the eye goes down to, on a people's world. */
export function folkNear(
  world: World,
  starRef: string,
  index: number,
  /** The year to read them at: now, or as a ship found them. */
  when?: number,
): FolkNear | null {
  const parts = starRef.split(":"),
    s =
      clusterOf(world).find((x) => x.ref === starRef) ??
      (parts[0] === "star"
        ? clusterOf(world).find((x) => x.sector === Number(parts[1]) && x.k === Number(parts[2]))
        : undefined);
  if (!s) return null;
  const f = folkOf(world, s, index);
  if (!f) return null;
  const year = yearOf(world),
    at = when ?? year,
    stage = folkStage(f, at),
    look = folkLook(world, f, s),
    title = `the ${ordinal(index + 1)} world of a star ${s.distance.toFixed(0)} light-years out`;
  if (!look) return null;
  return {
    ref: f.ref,
    name: f.name,
    star: s.ref,
    index,
    year,
    stage,
    stageWords: STAGE_WORDS[stage],
    look,
    camp: hasTown(stage)
      ? null
      : {
          ...campOf(world, f, s, title, at, when !== undefined),
          native: { ref: f.ref, star: s.ref, index, look },
        },
    town: hasTown(stage) ? folkTownRef(f) : null,
    contact: folkContact(world, f),
    arms: folkArms(f, stage),
    title,
    ...(when !== undefined ? { at } : {}),
  };
}

const ordinal = (n: number) =>
  `${n}${n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th"}`;

/** Who lives where about the stars within reach, and how far they have come (kept for each year). */
const LISTS = new Map<string, FolkList>();
export function folkList(world: World): FolkList {
  const year = yearOf(world),
    key = `${world.seed.text} ${year}`,
    known = LISTS.get(key);
  if (known) return known;
  const list: FolkList = folksNear(world).map((f) => ({
    ref: f.ref,
    name: f.name,
    star: f.star,
    index: f.planet,
    stage: folkStage(f, year),
    followed: !!f.followed,
    came: arrivalsAt(world, f)[0]?.year ?? null,
  }));
  LISTS.clear();
  LISTS.set(key, list);
  return list;
}

/** A star's worlds, and who lives on each. */
export function folkOnWorlds(
  world: World,
  s: GalaxyStar,
): { index: number; name: string; stage: string }[] {
  const year = yearOf(world),
    out: { index: number; name: string; stage: string }[] = [];
  const parts = s.ref.split(":"),
    cluster =
      parts[0] === "star"
        ? s
        : (clusterOf(world).find((x) => x.sector === s.sector && x.k === s.k) ?? s);
  for (const p of foreignPlanets(new Rng(world.seed), cluster)) {
    const f = folkOf(world, cluster, p.index);
    if (f) out.push({ index: p.index, name: f.name, stage: STAGE_WORDS[folkStage(f, year)] });
  }
  return out;
}

export const NATIVES_QUERIES: Readonly<Record<string, QueryHandler>> = {
  /** Who lives about the stars, and how far they have come. */
  "folk.list": (world) => folkList(world),
  /** Down to a people's camp or town. */
  "folk.near": (world, args) => {
    const a = args as { star: string; index: number; at?: number };
    return folkNear(world, a.star, a.index, a.at);
  },
};
