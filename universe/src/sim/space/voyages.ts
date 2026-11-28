// Voyages to other stars (docs/architecture §26, Phase 6 M58–M59). A realm with a station,
// habitats and a drive for the dark between stars sends a ship to the nearest star with a
// world its people could live on, within the longest crossing it will ask of its own; the
// ship is a land of the ordinary kind — its people live, are born and die aboard for the
// crossing, their ways and tongue drifting with no one near — and when it arrives it
// becomes halls on that world. Word of it travels at light's speed; its lag weighs on its
// rule as light-years (stars.ts: lightSteps).
import { motionOf } from "../planet/motion.ts";
import {
  Rng,
  YEAR,
  defineEventType,
  defineStream,
  yearOfMoment,
  type CauseRef,
  type Factor,
  type Ref,
  type SimTime,
  type World,
} from "../../kernel/index.ts";
import {
  cellRef,
  foreignPlanets,
  isProvinceWorld,
  type ForeignPlanet,
  type GalaxyStar,
  worldLife,
} from "../../gen/index.ts";
import {
  crossingClocks,
  crossingYears,
  cruise,
  habitability,
  laneThrows,
  longestCrossing,
  routeMachines,
  routeYears,
  starDriveFor,
  thrownYears,
  type LaneRoute,
  type StarDrive,
} from "../../rules/index.ts";
import { politiesOf, type Polity } from "../polity/polity.ts";
import { knows, loreOf } from "../lore/lore.ts";
import { Province } from "../population/model.ts";
import type { PopulationContext } from "../population/systems.ts";
import {
  COLONISTS,
  COLONY_SHARE,
  FLIGHT_PACE,
  machinesOfRealm,
  settle,
  spaceOf,
  spendMachines,
} from "./space.ts";
import { nationsOf } from "./nation-store.ts";
import { clusterOf, StarSiteStore, starSitesOf, type SiteLane, type StarSite } from "./stars.ts";
import { farTaken, filledYear, lastFarSailed, sailFar } from "./filled.ts";
import { LANE_EVENTS, LANE_ROW, laneDraw, laneLawOf, laneRoute, lanesOf } from "./lanes.ts";
import { askedStar, spendAsk } from "./asks.ts";

export { clusterOf };

export const VOYAGE_EVENTS = {
  sailed: defineEventType("space.voyage", 6),
  arrived: defineEventType("space.arrival", 6),
};

const VOYAGE = defineStream("space.voyage");

/** What a starship costs, in machines: its hull, its drive and a century of keeping its people. */
export const STARSHIP_MACHINES = 8_000_000;
/** Years between one ship a realm sends and its next. */
export const VOYAGE_GAP = 60;
/** The share of its people's work a ship takes to keep them alive aboard. */
export const ABOARD = 0.5;

/**
 * A star's worlds, drawn from the world's seed (a pure reading of the seed and the star). Kept for the very star it was drawn for:
 * the cluster's stars are the same objects while the seed is, and are asked for every year; a star read anew with other
 * numbers under the same ref (a far reading's) is drawn afresh and not kept, or the first asked would answer for both.
 */
const WORLDS = new Map<
  string,
  Map<string, { readonly star: GalaxyStar; readonly worlds: readonly ForeignPlanet[] }>
>();
export function worldsOf(world: World, star: GalaxyStar): readonly ForeignPlanet[] {
  const key = world.seed.text;
  let by = WORLDS.get(key);
  if (!by) {
    if (WORLDS.size > 4) WORLDS.clear();
    WORLDS.set(key, (by = new Map()));
  }
  const had = by.get(star.ref);
  if (had?.star === star) return had.worlds;
  const worlds = foreignPlanets(new Rng(world.seed), star);
  if (!had) by.set(star.ref, { star, worlds });
  return worlds;
}

type Target = {
  star: GalaxyStar;
  planet: ForeignPlanet;
  years: number;
  upkeep: number;
  /** The way by lanes it would go (Phase 68; absent: on its drive, straight across). */
  route?: LaneRoute;
};

/** Every world a home people could live on, by star: the whole cluster's, once. */
const LIVABLE = new Map<
  string,
  readonly { star: GalaxyStar; planet: ForeignPlanet; upkeep: number }[]
>();
function livableWorlds(ctx: PopulationContext) {
  const key = ctx.world.seed.text;
  let list = LIVABLE.get(key);
  if (!list) {
    if (LIVABLE.size > 4) LIVABLE.clear();
    const g = ctx.generated,
      out: { star: GalaxyStar; planet: ForeignPlanet; upkeep: number }[] = [];
    for (const star of clusterOf(ctx.world))
      for (const planet of worldsOf(ctx.world, star)) {
        const h = habitability(
          planet,
          g.life.people?.body ?? null,
          g.system.bodies[0]!,
          worldLife(g),
        );
        if (h.livable) out.push({ star, planet, upkeep: h.upkeep });
      }
    LIVABLE.set(key, (list = out));
    const by = new Map<string, { star: GalaxyStar; planet: ForeignPlanet; upkeep: number }[]>();
    for (const w of out) (by.get(w.star.ref) ?? by.set(w.star.ref, []).get(w.star.ref)!).push(w);
    if (LIVABLE_AT.size > 4) LIVABLE_AT.clear();
    LIVABLE_AT.set(key, by);
  }
  return list;
}
/** The same by star (each star's livable worlds in its own order): a realm weighing where to sail asks star by star, every year. */
const LIVABLE_AT = new Map<
  string,
  ReadonlyMap<string, readonly { star: GalaxyStar; planet: ForeignPlanet; upkeep: number }[]>
>();
function livableAt(ctx: PopulationContext) {
  livableWorlds(ctx);
  return LIVABLE_AT.get(ctx.world.seed.text)!;
}

/**
 * A world far from all a realm holds is one its word and fleets reach last, and help comes from the nearest of its own: a star this
 * many light-years from the nearest counts as twice as far off, however quick the crossing (est.). So a realm grows outward from what
 * it holds, and two realms come to have a border, where before each took whatever star was next.
 */
const FROM_ITS_OWN = 5;

const STAR_BY_REF = new Map<string, Map<string, GalaxyStar>>();

/** The stars of the worlds a realm holds. */
function heldStars(world: World, realm: Ref): GalaxyStar[] {
  const store = nationsOf(world);
  if (!store || store.dormant()) return [];
  const key = world.seed.text;
  let by = STAR_BY_REF.get(key);
  if (!by) {
    if (STAR_BY_REF.size > 4) STAR_BY_REF.clear();
    STAR_BY_REF.set(key, (by = new Map(clusterOf(world).map((s) => [s.ref as string, s]))));
  }
  const out: GalaxyStar[] = [];
  for (const h of store.all()) {
    if (h.holder !== realm) continue;
    const s = by.get(h.star);
    if (s) out.push(s);
  }
  return out;
}

/** How much dearer a star is for how far it lies from all a realm holds (1, for a realm that holds none). */
function dearFromItsOwn(star: GalaxyStar, held: readonly GalaxyStar[]): number {
  if (!held.length) return 1;
  let least = Infinity;
  for (const h of held) {
    const dx = star.x - h.x,
      dy = star.y - h.y,
      dz = star.z - h.z,
      d = dx * dx + dy * dy + dz * dz;
    if (d < least) least = d;
  }
  return 1 + Math.sqrt(least) / FROM_ITS_OWN;
}

/** The star a realm's ship would sail for now: the nearest in time with a world its people could live on, and the nearer what it holds the better. */
export function voyageTarget(
  ctx: PopulationContext,
  p: Polity,
  machines = Infinity,
): { drive: StarDrive; target: Target } | null {
  const k = (id: string) => knows(ctx, p.seat, id),
    drive = starDriveFor(k);
  if (!drive) return null;
  const g = ctx.generated,
    home = g.system.bodies[0]!,
    body = g.life.people?.body ?? null,
    longest = longestCrossing(k),
    taken = new Set<string>((starSitesOf(ctx.world)?.all() ?? []).map(([, s]) => s.star));
  // (And those a far colony went to, once every kept land was taken.)
  for (const s of farTaken(ctx.world)) taken.add(s);
  const held = heldStars(ctx.world, p.ref),
    livable = livableAt(ctx);
  // (Asked by a hand for a star, Live a Line's space, asks.ts: that star, if within its longest crossing and holding a world
  // its people could live on that no one has taken, the least to keep of them. Else the voyage as it would have been.)
  const asked = askedStar(ctx.world, p.ref);
  if (asked && !taken.has(asked)) {
    const star = clusterOf(ctx.world).find((s) => s.ref === asked),
      years = star ? crossingYears(star.distance, drive) : Infinity;
    if (star && years <= longest) {
      let pick: { planet: Target["planet"]; upkeep: number } | null = null;
      for (const w of livable.get(star.ref) ?? []) if (!pick || w.upkeep < pick.upkeep) pick = w;
      if (pick) return { drive, target: { star, planet: pick.planet, years, upkeep: pick.upkeep } };
    }
  }
  let best: Target | null = null,
    bestScore = Infinity;
  for (const star of clusterOf(ctx.world)) {
    const years = crossingYears(star.distance, drive);
    // The cluster is nearest first: past the longest crossing, no star is nearer in time.
    if (years > longest) break;
    if (taken.has(star.ref)) continue;
    const dear = dearFromItsOwn(star, held);
    for (const w of livable.get(star.ref) ?? []) {
      const score = years * (1 + w.upkeep / 10) * dear;
      if (score < bestScore) {
        bestScore = score;
        best = { star, planet: w.planet, years, upkeep: w.upkeep };
      }
    }
  }
  // By the lanes (Phase 68): where the law holds and this people has found them, any star they run to, nearest in time.
  if (laneLawOf(ctx.world).open && k(LANE_ROW)) {
    const v = cruise(drive),
      home = g.star.ref as string;
    for (const w of livableWorlds(ctx)) {
      if (taken.has(w.star.ref)) continue;
      const route = laneRoute(ctx.world, home, w.star.ref);
      if (!route || machines * COLONY_SHARE < STARSHIP_MACHINES + routeMachines(route)) continue;
      const years = routeYears(route, v),
        score = years * (1 + w.upkeep / 10) * dearFromItsOwn(w.star, held);
      if (score < bestScore) {
        bestScore = score;
        best = { star: w.star, planet: w.planet, years, upkeep: w.upkeep, route };
      }
    }
  }
  return best ? { drive, target: best } : null;
}

/** A star a realm's ship could sail for now, with the best world there its people could live on (Live a Line's space). */
export type ReachStar = {
  readonly star: GalaxyStar;
  readonly years: number;
  readonly upkeep: number;
  /** Another's ship or colony has it already. */
  readonly taken: boolean;
};

/**
 * What a realm lacks to send a ship to the stars, by the voyage's own rules (none: it can, when it chooses), and the stars in its
 * reach, nearest in time first, each with the world there least to keep. A pure reading, asked by Live a Line (host/line.ts).
 */
export function voyageReach(
  ctx: PopulationContext,
  p: Polity,
  most = 8,
): { wants: string[]; stars: ReachStar[] } {
  const wants: string[] = [],
    k = (id: string) => knows(ctx, p.seat, id),
    drive = starDriveFor(k);
  if (!spaceOf(ctx.world).of(p.ref)?.station) wants.push("a station kept in orbit");
  if (!k("habitats")) wants.push("habitats its people could live in out there");
  if (!drive) wants.push("a drive to cross between the stars");
  if (machinesOfRealm(ctx, p) * COLONY_SHARE < STARSHIP_MACHINES)
    wants.push("machines to spare enough to build a ship");
  if (!drive) return { wants, stars: [] };
  const longest = longestCrossing(k),
    taken = new Set<string>((starSitesOf(ctx.world)?.all() ?? []).map(([, s]) => s.star));
  for (const s of farTaken(ctx.world)) taken.add(s);
  const livable = livableAt(ctx),
    stars: ReachStar[] = [];
  for (const star of clusterOf(ctx.world)) {
    const years = crossingYears(star.distance, drive);
    if (years > longest) break;
    let upkeep = Infinity;
    for (const w of livable.get(star.ref) ?? []) upkeep = Math.min(upkeep, w.upkeep);
    if (upkeep < Infinity) stars.push({ star, years, upkeep, taken: taken.has(star.ref) });
    if (stars.length >= most) break;
  }
  return { wants, stars };
}

/** The year's voyages: ships that arrive, and ships that sail. */
export function voyageYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    g = ctx.generated;
  if (!isProvinceWorld(g)) return;
  const sites = starSitesOf(world)!,
    year = yearOfMoment(t);
  // Arrivals: the crossing done, the ship's people set down in halls on the world they sought.
  for (const [cell, s] of sites.all()) {
    if (s.arrived || year < s.arrives) continue;
    const land = ctx.provinces.get(cell);
    s.arrived = world.events.emit({
      type: VOYAGE_EVENTS.arrived.type,
      place: cellRef(0, cell),
      subjects: [s.realm, cellRef(0, cell), s.star],
      causes: [
        { ref: s.voyage, role: "trigger", weight: 1 },
        { ref: s.star, role: "enabler", weight: 0.5 },
      ],
      data: {
        star: s.star,
        distance: s.distance,
        people: land?.total() ?? 0,
        year,
        // (Its clocks: the years lived aboard of those gone at home, and when its word reaches home at light's speed.)
        ...arrivalClocks(s),
      },
    });
  }
  // Departures.
  const space = spaceOf(world);
  for (const p of politiesOf(world).living()) {
    const prog = space.of(p.ref);
    if (!prog?.station || !knows(ctx, p.seat, "habitats")) continue;
    const mine = sites.all().filter(([, s]) => s.realm === p.ref),
      last = mine.at(-1)?.[1];
    if (last && year - last.departed < VOYAGE_GAP) continue;
    const machines = machinesOfRealm(ctx, p);
    if (machines * COLONY_SHARE < STARSHIP_MACHINES) continue;
    if (year - lastFarSailed(world, p.ref) < VOYAGE_GAP) continue;
    // The crew come from the realm's most crowded land of the home world.
    const origin = p.members
      .map((c) => ctx.provinces.get(c))
      .filter((x): x is Province => x !== undefined && onHome(g, x.cell))
      .sort((a, b) => b.total() - a.total() || a.cell - b.cell)[0];
    if (!origin || origin.total() < COLONISTS * 5) continue;
    // A reason: a rival's ship already sailing, hunger at home, the rulers' will.
    const reasons: Factor[] = [],
      rival = sites.all().find(([, s]) => s.realm !== p.ref)?.[1];
    if (rival)
      reasons.push({
        name: "another realm's ship already out",
        value: 1,
        contribution: 1,
        source: { ref: rival.voyage, role: "trigger", weight: 1 },
      });
    if (origin.lastFamine)
      reasons.push({
        name: "hunger at home",
        value: 1,
        contribution: 0.5,
        source: { ref: origin.lastFamine, role: "pressure", weight: 1 },
      });
    // (Their world dying under them, or its star swelling at the end of its life: they must leave, or end. Round D.)
    const dying = motionOf(world)?.state;
    if (dying?.dying || dying?.swelling)
      reasons.push({
        name: dying.dying ? "their world dying under them" : "their star swelling at its end",
        value: 1,
        contribution: dying.dying ? 3 : 1,
        source: { ref: (dying.dying ?? dying.swelling)!, role: "pressure", weight: 1 },
      });
    const drive = reasons.reduce((s, f) => s + f.contribution, 0.3);
    if (!(world.rng.real(VOYAGE, p.seat, t, 0) < FLIGHT_PACE * drive)) continue;
    const choice = voyageTarget(ctx, p, machines);
    if (!choice) continue;
    // (Where it sails for the star it was asked for: said, and the ask spent.)
    const heeded = askedStar(world, p.ref) === choice.target.star.ref;
    if (heeded)
      reasons.push({
        name: "the star it was asked to sail for",
        value: 1,
        contribution: 0,
        source: null,
      });
    sail(ctx, p, origin, choice.drive, choice.target, reasons, machines, year);
    if (heeded) spendAsk(world, p.ref);
    // One ship a year in all the world.
    return;
  }
}

/** A ship's crossing by its own clock and home's, for its arrival's telling (none by a lane's throw: no speed kept). */
function arrivalClocks(s: StarSite): { home?: number; aboard?: number; word?: number } {
  if (s.lane) return {};
  const c = crossingClocks(s.distance, s.arrives - s.departed);
  return { home: c.home, aboard: Math.round(c.aboard * 10) / 10, word: s.arrives + c.word };
}

/** Whether a land is of the home world. */
function onHome(g: PopulationContext["generated"], cell: number): boolean {
  return isProvinceWorld(g) ? cell < g.offworld.base : true;
}

/** A ship sails: its site taken, its people aboard, its why the star, its world and its drive. */
function sail(
  ctx: PopulationContext,
  p: Polity,
  origin: Province,
  drive: StarDrive,
  target: Target,
  reasons: Factor[],
  machines: number,
  year: number,
): void {
  const { world } = ctx,
    g = ctx.generated;
  if (!isProvinceWorld(g)) return;
  const sites = starSitesOf(world)!,
    // The first kept site no ship holds and no one lives in.
    free = g.offworld.sites.findIndex(
      (s, i) =>
        s.body < 0 &&
        !sites.get(g.offworld.base + i) &&
        !ctx.provinces.get(g.offworld.base + i)?.total(),
    );
  // (Every kept land taken: the ship still sails, and the colony it founds is a number on its world.)
  if (free < 0) {
    sailFar(ctx, p, origin, drive, target, reasons, machines, year);
    return;
  }
  const cell = g.offworld.base + free,
    lore = loreOf(world),
    driveKnown = lore.get(p.seat, drive.needs[0]!);
  const route = target.route,
    lane = route ? laneOfShip(ctx, route, drive, target.star.distance, cell, year) : null,
    years = target.years + (lane?.thrown?.years ?? 0);
  spendMachines(ctx, p, STARSHIP_MACHINES + (route ? routeMachines(route) : 0));
  const decision = world.decisions.record({
    rule: "space.voyage",
    subject: p.ref,
    outcome: {
      star: target.star.ref,
      planet: target.planet.index,
      years: Math.round(years),
    },
    score: years,
    threshold: 0,
    factors: [
      {
        name: `${target.star.spectral === "white dwarf" || target.star.spectral === "neutron star" ? `a ${target.star.spectral}` : `a ${target.star.spectral} star`} ${target.star.distance.toFixed(1)} light-years out, with a world its people could live on (${target.upkeep.toFixed(1)} machines a settler a year to keep)`,
        value: target.star.distance,
        contribution: 1,
        source: { ref: target.star.ref, role: "enabler" as const, weight: 1 },
      },
      {
        name: route
          ? `${route.hops} lane${route.hops === 1 ? "" : "s"} between the stars, ${Math.round(route.ly)} light-years, ${Math.round(years)} years on the way; ${lane!.byDrive} by ${drive.words} alone`
          : `${drive.words}: ${(cruise(drive) * 100).toFixed(1)} in a hundred of light's speed, ${Math.round(target.years)} years on the way`,
        value: cruise(drive),
        contribution: 0.8,
        source: driveKnown ? { ref: driveKnown.event, role: "enabler" as const, weight: 1 } : null,
      },
      ...reasons,
      {
        name: "machines enough to build a ship",
        value: machines / STARSHIP_MACHINES,
        contribution: 0.4,
        source: { ref: p.ref, role: "agent" as const, weight: 1 },
      },
    ].slice(0, 6),
  });
  const causes: CauseRef[] = [{ ref: decision, role: "trigger", weight: 1 }];
  const habitats = lore.get(p.seat, "habitats");
  if (habitats) causes.push({ ref: habitats.event, role: "enabler", weight: 0.6 });
  const event = world.events.emit({
    type: VOYAGE_EVENTS.sailed.type,
    importance: sites.all().length ? 5 : 6,
    place: cellRef(0, cell),
    subjects: [p.ref, cellRef(0, cell), target.star.ref],
    causes,
    data: {
      realm: p.town,
      star: target.star.ref,
      distance: Math.round(target.star.distance * 10) / 10,
      years: Math.round(years),
      drive: drive.id,
      ...(route ? { lanes: route.hops, byDrive: lane!.byDrive } : {}),
      year,
    },
  });
  // The ship: a land of the realm, its people aboard.
  settle(ctx, p, origin, cell, decision, event, year);
  const body = g.life.people?.body ?? null,
    there = habitability(target.planet, body, g.system.bodies[0]!).upkeep;
  sites.set(cell, {
    realm: p.ref,
    from: origin.cell,
    star: target.star.ref,
    planet: target.planet.index,
    distance: target.star.distance,
    drive: drive.id,
    departed: year,
    arrives: year + Math.ceil(years),
    voyage: event,
    arrived: null,
    aboard: ABOARD,
    there: Math.min(0.9, there / (there + 6)),
    ...(lane ? { lane } : {}),
  });
  if (route)
    noteFirstJump(ctx, p, {
      what: "settlers",
      cell,
      star: target.star.ref,
      planet: target.planet.index,
      route,
      drive,
      distance: target.star.distance,
      arrives: year + Math.ceil(years),
      thrown: lane!.thrown,
      cause: event,
      year,
    });
}

/** How a ship goes by a route: what each lane does to it, drawn as it sails. */
function laneOfShip(
  ctx: PopulationContext,
  route: LaneRoute,
  drive: StarDrive,
  distance: number,
  subject: number,
  year: number,
): SiteLane {
  const v = cruise(drive);
  let thrown: SiteLane["thrown"] = null;
  for (let hop = 0; hop < route.hops && !thrown; hop++) {
    const tide = route.tides[hop]!;
    if (laneDraw(ctx.world, subject, year, 2 * hop) >= laneThrows(tide)) continue;
    const share = laneDraw(ctx.world, subject, year, 2 * hop + 1),
      ly = route.lengths[hop]!;
    thrown = {
      hop,
      short: Math.round((1 - share) * ly * 10) / 10,
      years: Math.ceil(thrownYears(ly, tide, share, v)),
    };
  }
  return {
    hops: route.hops,
    ly: Math.round(route.ly * 10) / 10,
    tonnes: Math.round(route.tonnes),
    byDrive: Math.round(crossingYears(distance, drive)),
    thrown,
  };
}

/** The first ship of the home world to jump: told once. */
export function noteFirstJump(
  ctx: PopulationContext,
  p: Polity,
  j: {
    readonly what: "settlers" | "envoys" | "fleet";
    readonly cell: number | null;
    readonly star: Ref;
    readonly planet: number;
    readonly route: LaneRoute;
    readonly drive: StarDrive;
    readonly distance: number;
    readonly arrives: number;
    readonly thrown: SiteLane["thrown"];
    readonly cause: Ref;
    readonly year: number;
  },
): void {
  const { world } = ctx,
    store = lanesOf(world);
  if (!store || store.first) return;
  const known = loreOf(world).get(p.seat, LANE_ROW),
    byDrive = Math.round(crossingYears(j.distance, j.drive)),
    machines = Math.round(routeMachines(j.route)),
    event = world.events.emit({
      type: LANE_EVENTS.first.type,
      place: j.cell !== null ? cellRef(0, j.cell) : cellRef(0, p.seat),
      subjects: [p.ref, j.star],
      causes: [
        { ref: j.cause, role: "trigger", weight: 1 },
        ...(known ? [{ ref: known.event, role: "enabler" as const, weight: 0.8 }] : []),
      ],
      data: {
        realm: p.town,
        what: j.what,
        hops: j.route.hops,
        years: j.arrives - j.year,
        byDrive,
        distance: Math.round(j.distance * 10) / 10,
        year: j.year,
      },
    });
  store.first = {
    event,
    realm: p.ref,
    name: p.town,
    what: j.what,
    cell: j.cell,
    star: j.star,
    planet: j.planet,
    year: j.year,
    arrives: j.arrives,
    hops: j.route.hops,
    ly: Math.round(j.route.ly * 10) / 10,
    tonnes: Math.round(j.route.tonnes),
    machines,
    distance: Math.round(j.distance * 10) / 10,
    byDrive,
    drive: j.drive.id,
    thrown: j.thrown,
  };
}

export function installVoyages(world: World, ctx: () => PopulationContext): StarSiteStore {
  const store = world.register(new StarSiteStore());
  world.addPinner(() => store.pinned());
  world.system({
    key: "198.space.voyage",
    every: YEAR,
    run: (t) => {
      voyageYear(ctx(), t);
      filledYear(ctx(), t);
    },
  });
  return store;
}
