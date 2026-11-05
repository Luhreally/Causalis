// "Can it?" (Phase 65): what a seed's world allows, read from what it holds, with no history run. Its
// pull, its chemistry, the bodies of its system, its life, the lands its first people reach: a principle
// is open to them where its needs can be met and its drivers carried on those lands, by the same rules
// history finds them by (rules/principles.ts, sim/economy/ore.ts). So a world with no seam of coal
// within reach of its people cannot come to steam, however long it runs. What it allows it may still
// never reach in any run: a reading says "plausibly", and only a run ("Does it?": the catalogue) says
// "reached".
import { Rng, type Seed } from "../kernel/index.ts";
import {
  clusterStars,
  foreignPlanets,
  generateHomeWorld,
  makeGalaxy,
  surfaceOre,
  type GalaxyStar,
  type HomeWorld,
  type ProvinceWorld,
} from "../gen/index.ts";
import {
  AGE_LADDER,
  KIND_METAL_ROOTS,
  KINDS,
  PRINCIPLES,
  affordsPrinciple,
  arsenicalFallback,
  cannotRemake,
  crossingYears,
  delivered,
  habitability,
  heatOf,
  launcherFor,
  longestCrossing,
  matterShuts,
  meansOfAge,
  needsMet,
  principleNameOn,
  readFunctions,
  reductionHeat,
  routeTo,
  starDriveFor,
  toOrbit,
  worldOre,
  type AgeWorld,
  type Bodylike,
  type Principle,
  type Prior,
} from "../rules/index.ts";
import { capacity, oresIn, spreadOf, type PopulationContext } from "../sim/index.ts";
import type { SeedAge, SeedLife, SeedReading } from "../bridge/index.ts";
import { ageWorldOf, matterOf } from "./reading.ts";

/** The ores a furnace must reduce (coal, oil and salt need none). */
const SMELTED = new Set(["copper", "tin", "iron"]);

/** A world's lands as a reading goes over them: what each holds near it. */
type Lands = {
  readonly g: ProvinceWorld;
  readonly w: AgeWorld;
  readonly cells: readonly number[];
  readonly coast: boolean;
  readonly hills: boolean;
  readonly river: boolean;
  /** The ore of a kind each land's own ground holds: how it lies. */
  readonly ore: (kind: string) => ReadonlyMap<number, readonly string[]>;
  readonly near1: ReadonlySet<number>;
  readonly near2: ReadonlySet<number>;
};

function landsOf(g: ProvinceWorld, cells: readonly number[], w: AgeWorld): Lands {
  const stand = { generated: g, medium: w.medium } as unknown as PopulationContext,
    near1 = new Set<number>(),
    near2 = new Set<number>(),
    kept = new Map<string, Map<number, string[]>>();
  let coast = false,
    hills = false,
    river = false;
  for (const c of cells) {
    near1.add(c);
    near2.add(c);
    if (g.water.river[c]) river = true;
    if (g.tectonics.elevation[c]! >= 600) hills = true;
    for (let k = g.grid.offsets[c]!; k < g.grid.offsets[c + 1]!; k++) {
      const n = g.grid.neighbours[k]!;
      if (g.tectonics.elevation[n]! <= 0) coast = true;
      near1.add(n);
      near2.add(n);
      for (let j = g.grid.offsets[n]!; j < g.grid.offsets[n + 1]!; j++)
        near2.add(g.grid.neighbours[j]!);
    }
  }
  return {
    g,
    w,
    cells,
    coast,
    hills,
    river,
    near1,
    near2,
    ore: (kind) => {
      let m = kept.get(kind);
      if (!m) {
        m = new Map();
        for (const c of SMELTED.has(kind) ? near1 : near2) {
          const lies = oresIn(stand, c, kind);
          if (lies.length)
            m.set(
              c,
              lies.map((o) => o.lie),
            );
        }
        kept.set(kind, m);
      }
      return m;
    },
  };
}

/** Whether any of a world's lands can work an ore of a kind, its furnace as what it knows makes it. */
function oreOpen(
  l: Lands,
  kind: string,
  knows: (id: string) => boolean,
  bringing: string,
): boolean {
  const lies = l.ore(kind);
  if (!SMELTED.has(kind)) return lies.size > 0;
  const chem = l.w.chem;
  if (chem.solar || !l.w.fire) {
    if (lies.size) return true;
  } else {
    const heat = heatOf(chem, knows, bringing);
    for (const list of lies.values())
      for (const lie of list) {
        const ore = worldOre(chem, kind, lie);
        if (ore && (lie === "vent" || heat >= reductionHeat(ore))) return true;
      }
  }
  // (Copper roasted for its own arsenic stands in where the hardener's ore cannot be worked.)
  if (kind === "tin" && (arsenicalFallback(chem) || !lies.size))
    return oreOpen(l, "copper", knows, bringing);
  return false;
}

/** The land's own driver a principle waits on, where it is the land, not who lives there. */
function driverOpen(l: Lands, p: Principle, knows: (id: string) => boolean): boolean {
  const d = p.drivers;
  if (d.river && !l.river) return false;
  if (d.coast && !l.coast) return false;
  if (d.hills && !l.hills) return false;
  return !d.ore || oreOpen(l, d.ore, knows, p.id);
}

/** What a people of these lands could come to know, given time: every principle open to them. */
function openTo(l: Lands, sows: boolean): Set<string> {
  const known = new Set<string>(sows ? ["cultivation"] : []),
    knows = (id: string) => known.has(id),
    { medium, fire, kind } = l.w;
  // (What needs nothing but the older systems: fishing, herding and the rest are open to any.)
  for (let changed = true; changed;) {
    changed = false;
    if (!known.has("metalworking") && fire && oreOpen(l, "copper", knows, "metalworking")) {
      known.add("metalworking");
      changed = true;
    }
    for (const p of PRINCIPLES) {
      if (known.has(p.id) || p.rate <= 0) continue;
      if (!affordsPrinciple(p, medium, fire, kind) || !needsMet(p, knows)) continue;
      if (matterShuts(p, l.w.functions ?? [])) continue;
      if (!driverOpen(l, p, knows)) continue;
      known.add(p.id);
      changed = true;
      if (p.id === "vent-working" || KIND_METAL_ROOTS.includes(p.id)) known.add("metalworking");
    }
  }
  return known;
}

/** Why a principle will never be found here: the first thing on the road back to it that is shut. */
function shutBecause(
  id: string,
  known: ReadonlySet<string>,
  l: Lands,
  seen = new Set<string>(),
): string {
  seen.add(id);
  const p = PRINCIPLES.find((x) => x.id === id),
    name = (n: string) => principleNameOn(l.w.chem, n);
  if (!p) return "";
  const { medium, fire, kind } = l.w;
  if (!affordsPrinciple(p, medium, fire, kind)) {
    if (p.body?.kinds && !p.body.kinds.includes(kind))
      return `${name(id)} is not a road open on ${KINDS[kind].name}`;
    if (p.body?.fire && !fire) return `${name(id)} wants fire, which its people cannot keep`;
    return `${name(id)} is not for a people of the ${medium}`;
  }
  // (What it asks of its world's matter, and that matter cannot give: Phase 66.)
  const f = matterShuts(p, l.w.functions ?? []);
  if (f) return `${name(id)} asks a people to ${f.name}: ${f.why}`;
  for (const need of p.needs) {
    const options = need.split("|");
    if (options.some((o) => known.has(o))) continue;
    for (const o of options)
      if (!seen.has(o)) {
        const why = shutBecause(o, known, l, seen);
        if (why) return why;
      }
    return `no road to ${name(options[0]!)}`;
  }
  const d = p.drivers;
  if (d.ore) {
    const held = l.ore(d.ore).size;
    return held
      ? `${name(id)} wants ${d.ore} its furnaces can work, and they cannot`
      : `${name(id)} wants ${d.ore}, and none lies within reach of its people's lands`;
  }
  if (d.river && !l.river) return `${name(id)} wants a river, and its lands have none`;
  if (d.coast && !l.coast) return `${name(id)} wants a coast, and its lands have none`;
  if (d.hills && !l.hills) return `${name(id)} wants high ground, and its lands have none`;
  return "";
}

/** The first shut road, of an age's roads, with what shuts it. */
function shutOf(roads: readonly string[], known: ReadonlySet<string>, l: Lands): string {
  for (const id of roads) {
    const why = shutBecause(id, known, l);
    if (why) return why;
  }
  return "nothing brings it here";
}

/** Fewer lands than this, and what takes many hands comes late if it comes at all (the catalogue's measure). */
const FEW_LANDS = 30;

/** What a world's matter and bodies allow beyond what it can know: flight, and where to fly. */
function flightOf(g: ProvinceWorld, seed: Seed, known: ReadonlySet<string>) {
  const knows = (id: string) => known.has(id),
    bodies = g.system.bodies,
    home = bodies[0]!,
    speed = toOrbit(home).total,
    lift = launcherFor(knows, speed),
    body = g.life.people?.body ?? null;
  // Other bodies of its own system its people could live on and be carried to.
  const list: Bodylike[] = bodies.map((b) => ({
    around: bodies.findIndex((x) => x.ref === b.orbit.around),
    a: b.orbit.a,
    periodDays: b.orbit.periodDays,
    mass: b.mass,
    radius: b.radius,
    pressure: b.pressure,
  }));
  let livable = 0,
    carried = 0,
    nearest: string | null = null,
    // (The first of them a world's remaking could work on: Phase 66; else why not.)
    remade: string | null = null,
    unmade: string | null = null;
  for (const site of g.offworld.sites) {
    if (site.site > 0 || site.body < 0) continue;
    const b = bodies[site.body]!;
    if (!habitability(b, body, home.gravity).livable) continue;
    livable++;
    if (delivered(knows, speed, routeTo(list, site.body, g.star.mass).speed)) {
      carried++;
      nearest ??= b.designation;
      const cannot = cannotRemake(b);
      if (!cannot) remade ??= b.designation;
      else unmade ??= `${b.designation}: ${cannot}`;
    }
  }
  // Other stars, nearest first: the first its people's crossing could reach with a world to live on.
  const drive = starDriveFor(knows),
    rng = new Rng(seed),
    longest = longestCrossing(knows);
  let target: { star: GalaxyStar; years: number } | null = null;
  if (drive)
    for (const star of clusterStars(rng, makeGalaxy(rng))) {
      const years = crossingYears(star.distance, drive);
      if (years > longest) break;
      if (
        foreignPlanets(new Rng(seed), star).some((p) => habitability(p, body, home.gravity).livable)
      ) {
        target = { star, years };
        break;
      }
    }
  return { speed, lift, livable, carried, nearest, remade, unmade, drive, target };
}

const round = (x: number, k = 10) => Math.round(x * k) / k;

/** The ages past what a people may come to anywhere: from here on, a world must hold what they want. */
const PAST_METAL = new Set([
  "engines",
  "electricity",
  "orbit",
  "worlds",
  "stars",
  "fusion",
  "minds",
  "beams",
  "bodies",
  "remade",
  "covered",
  "gathered",
]);
/** How fine a world a glance makes: some forty times less work than the whole. */
const GLANCE_FREQUENCY = 8;

/**
 * A glance at a seed before it is read: the whole of a reading is a world's generation, so a seed that
 * a coarse world shows can have no people, or no coal for a people that burns, is passed by. Never told
 * as a result: only what a full reading allows is told, and a fine world the glance missed is one less
 * to list, no more.
 */
export function glanceSeed(seed: Seed, prior: Prior, target: string): boolean {
  const g = generateHomeWorld(seed, prior, GLANCE_FREQUENCY);
  if (!g.life.people) return false;
  if (!PAST_METAL.has(target)) return true;
  const w = ageWorldOf(g);
  // (Only a people that burns on a world that burns goes by way of coal.)
  if (!w.fire || w.medium === "water" || w.kind !== "rocky") return true;
  return (
    g.deposits.some((d) => d.kind === "coal") ||
    Array.from({ length: g.grid.count }).some((_, c) => surfaceOre(g, c, "coal"))
  );
}

/**
 * What a seed's world allows, age by age, from what it holds. `fine` is its home world as generated,
 * `g` its lands, `life` whether life arose on it (host/planet.ts).
 */
export function readSeed(
  fine: HomeWorld,
  g: ProvinceWorld,
  seed: Seed,
  universe: string,
  life: SeedLife,
): SeedReading {
  const text = seed.text,
    ages: SeedAge[] = [],
    plain = (id: string) => AGE_LADDER.find((a) => a.id === id)!,
    no = (id: string, why: string) => {
      const a = plain(id);
      ages.push({
        id,
        icon: a.icon,
        name: a.name,
        allowed: false,
        why: `${why[0]!.toUpperCase()}${why.slice(1)}${why.endsWith(".") ? "" : "."}`,
      });
    },
    yes = (id: string, why: string, hard?: string, name?: string) => {
      const a = plain(id);
      ages.push({
        id,
        icon: a.icon,
        name: name ?? a.name,
        allowed: true,
        why,
        ...(hard ? { hard } : {}),
      });
    };
  const w = ageWorldOf(g);
  if (!life.peopled) {
    for (const a of AGE_LADDER)
      no(a.id, life.living ? "No people rose on this world." : "No life arose on this world.");
    return {
      universe,
      seed: text,
      living: life.living,
      peopled: false,
      words: life.words,
      ...(life.world ? { world: life.world } : {}),
      lands: 0,
      medium: w.medium,
      fire: false,
      kind: w.kind,
      ages,
      furthest: null,
      functions: [],
    };
  }
  const { lands } = spreadOf(g, text),
    cells = lands.map(([c]) => c),
    l = landsOf(g, cells, w),
    sows = cells.some((c) => capacity(g, c, w.medium).farm > 0),
    known = openTo(l, sows),
    knows = (id: string) => known.has(id),
    flight = flightOf(g, seed, known),
    few =
      cells.length < FEW_LANDS ? `Only ${cells.length} lands to live on: it will come slowly.` : "",
    // (No recipe makes machines without works of steam or of the tides: what a world of another kind
    // has, visitors gave it, and halls on other bodies are built of them.)
    matter = readFunctions(matterOf(fine)),
    told = (id: string) => matter.find((f) => f.id === id)!.why,
    machines = knows("factories") || knows("sea-works"),
    noMachines = machines
      ? ""
      : "Nothing here makes machines: all it has would have to be given it.",
    bodies = g.system.bodies,
    home = bodies[0]!;
  yes("bands", `${cells.length} lands within reach of its first people.`);
  // Those any people may come to, once it sows.
  if (sows) {
    yes("villages", "Its people have ground that can be sown.");
    yes("realms", "Fields feed rulers.");
    yes("cities", "Fields feed a town of a thousand.");
  } else
    for (const id of ["villages", "realms", "cities"])
      no(id, "None of its people's lands can be sown or tended.");
  const road = (id: string, roads: readonly string[], why: (by: string) => string, hard = "") => {
    const by = roads.find(knows);
    if (by) yes(id, why(principleNameOn(w.chem, by)), hard, meansOfAge(id, knows, w));
    else no(id, shutOf(roads, known, l));
  };
  road("writing", ["writing"], () => "Records follow from fields, towns and trade.");
  road(
    "iron",
    ["iron", "electrochemistry", "cold-hammering", "carbide-blades", "ice-working", "steel"],
    (by) => `A stuff worked to hold an edge: ${by}.`,
  );
  const engines = [
    "steam-engine",
    "vent-heat",
    "current-mills",
    "sun-engines",
    "heat-engines",
    "cold-chemistry",
  ];
  road("engines", engines, (by) => `Its works can be driven by ${by}.`, few);
  road(
    "electricity",
    ["electricity", "sea-electricity", "graphite-dynamos", "ground-dynamos", "polymer-wire"],
    (by) => `The current comes by ${by}. ${told("carry-current")}`,
    few,
  );
  // Orbit: its people's knowledge, and an engine that lifts off its ground.
  if (!knows("orbital-flight")) no("orbit", shutOf(["orbital-flight"], known, l));
  else if (!flight.lift)
    no(
      "orbit",
      `Its pull of ${round(home.gravity, 100)} g asks ${round(flight.speed)} km/s to reach orbit, past any engine its people could build.`,
    );
  else
    yes(
      "orbit",
      `${round(flight.speed)} km/s to reach orbit, by ${flight.lift.propulsion.words}. To steer it: ${told("switch-current")}${machines ? "" : " Nothing here makes machines, so its first flights wait on those visitors give."}`,
      few,
    );
  // Other worlds: halls, and a body to carry them to.
  const halls = !!flight.lift && knows("habitats");
  if (!knows("habitats")) no("worlds", shutOf(["habitats"], known, l));
  else if (!flight.lift) no("worlds", "Nothing it can build reaches orbit.");
  else if (!flight.livable)
    no("worlds", "No other body of its system could keep its people alive.");
  else if (!flight.carried)
    no("worlds", "No drive it could build makes the crossing to a body it could live on.");
  else
    yes(
      "worlds",
      `${flight.carried} bod${flight.carried === 1 ? "y" : "ies"} of its system its people could live on, first ${flight.nearest}.`,
      noMachines || few,
    );
  // Other stars: a drive, a world to reach, halls to come from.
  if (!halls)
    no(
      "stars",
      ages.at(-1)!.allowed ? "It would need halls beyond its world first." : ages.at(-1)!.why,
    );
  else if (!flight.drive) no("stars", shutOf(["fusion-drive"], known, l));
  else if (!flight.target)
    no("stars", "No star within a crossing has a world its people could live on.");
  else
    yes(
      "stars",
      `A world they could live on ${round(flight.target.star.distance)} light-years off, ${Math.round(flight.target.years)} years' crossing by ${flight.drive.words}.`,
      noMachines || few,
    );
  // Ages past ours (Phase 66): each a road a people may walk, its matter having met what it asks.
  const hard = noMachines || few;
  road("fusion", ["fusion-power"], () => `${told("wall-a-flame")} ${told("hold-a-flame")}`, hard);
  road("minds", ["machine-minds"], () => told("think-in-crystal"), hard);
  if (w.noGrip) no("beams", w.noGrip);
  else road("beams", ["beam-arms"], () => told("beam-a-light"), hard);
  road("bodies", ["made-bodies"], () => told("write-a-body"), hard);
  if (!knows("world-making")) no("remade", shutOf(["world-making"], known, l));
  else if (!halls) no("remade", "It would need halls beyond its world first.");
  else if (!flight.remade)
    no(
      "remade",
      flight.unmade ??
        (flight.target
          ? "It would have to carry its halls under another star first."
          : "No body its people could reach and live on."),
    );
  else yes("remade", `${flight.remade} could be remade. ${told("remake-a-world")}`, hard);
  road("covered", ["world-city"], () => told("roof-a-world"), hard);
  road("gathered", ["star-mirrors"], () => told("gather-a-star"), hard);
  const allowed = ages.filter((a) => a.allowed);
  return {
    universe,
    seed: text,
    living: true,
    peopled: true,
    words: life.words,
    ...(life.world ? { world: life.world } : {}),
    lands: cells.length,
    medium: w.medium,
    fire: w.fire,
    kind: w.kind,
    ages,
    furthest: allowed.at(-1)?.id ?? null,
    functions: matter.map((f) => ({
      id: f.id,
      icon: f.icon,
      name: f.name,
      later: f.later,
      met: f.met,
      why: f.why,
    })),
  };
}
