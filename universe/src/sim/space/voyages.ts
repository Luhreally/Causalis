// Voyages to other stars (docs/architecture §26, Phase 6 M58–M59). A realm with a station,
// habitats and a drive for the dark between stars sends a ship to the nearest star with a
// world its people could live on, within the longest crossing it will ask of its own; the
// ship is a land of the ordinary kind — its people live, are born and die aboard for the
// crossing, their ways and tongue drifting with no one near — and when it arrives it
// becomes halls on that world. Word of it travels at light's speed; its lag weighs on its
// rule as light-years (stars.ts: lightSteps).
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
  clusterStars,
  cellRef,
  foreignPlanets,
  isProvinceWorld,
  makeGalaxy,
  type ForeignPlanet,
  type GalaxyStar,
} from "../../gen/index.ts";
import {
  crossingYears,
  cruise,
  habitability,
  longestCrossing,
  starDriveFor,
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
import { StarSiteStore, starSitesOf } from "./stars.ts";

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

/** The stars within reach of home: a pure function of the world's seed, kept while it is the same. */
const CLUSTERS = new Map<string, GalaxyStar[]>();
export function clusterOf(world: World): GalaxyStar[] {
  const key = world.seed.text;
  let stars = CLUSTERS.get(key);
  if (!stars) {
    if (CLUSTERS.size > 8) CLUSTERS.clear();
    const rng = new Rng(world.seed);
    CLUSTERS.set(key, (stars = clusterStars(rng, makeGalaxy(rng))));
  }
  return stars;
}

/** A star's worlds, drawn from the world's seed. */
export function worldsOf(world: World, star: GalaxyStar): ForeignPlanet[] {
  return foreignPlanets(new Rng(world.seed), star);
}

type Target = { star: GalaxyStar; planet: ForeignPlanet; years: number; upkeep: number };

/** The star a realm's ship would sail for now: the nearest in time with a world its people could live on. */
export function voyageTarget(
  ctx: PopulationContext,
  p: Polity,
): { drive: StarDrive; target: Target } | null {
  const k = (id: string) => knows(ctx, p.seat, id),
    drive = starDriveFor(k);
  if (!drive) return null;
  const g = ctx.generated,
    homeGravity = g.system.bodies[0]!.gravity,
    body = g.life.people?.body ?? null,
    longest = longestCrossing(k),
    taken = new Set((starSitesOf(ctx.world)?.all() ?? []).map(([, s]) => s.star));
  let best: Target | null = null;
  for (const star of clusterOf(ctx.world)) {
    const years = crossingYears(star.distance, drive);
    // The cluster is nearest first: past the longest crossing, no star is nearer in time.
    if (years > longest) break;
    if (taken.has(star.ref)) continue;
    for (const planet of worldsOf(ctx.world, star)) {
      const h = habitability(planet, body, homeGravity);
      if (!h.livable) continue;
      if (!best || years * (1 + h.upkeep / 10) < best.years * (1 + best.upkeep / 10))
        best = { star, planet, years, upkeep: h.upkeep };
    }
  }
  return best ? { drive, target: best } : null;
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
      data: { star: s.star, distance: s.distance, people: land?.total() ?? 0, year },
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
    // The crew come from the realm's most crowded land of the home world.
    const origin = p.members
      .map((c) => ctx.provinces.get(c))
      .filter((x): x is Province => x !== undefined && onHome(g, x.cell))
      .sort((a, b) => b.total() - a.total() || a.cell - b.cell)[0];
    if (!origin || origin.total() < COLONISTS * 5) continue;
    const choice = voyageTarget(ctx, p);
    if (!choice) continue;
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
    const drive = reasons.reduce((s, f) => s + f.contribution, 0.3);
    if (!(world.rng.real(VOYAGE, p.seat, t, 0) < FLIGHT_PACE * drive)) continue;
    sail(ctx, p, origin, choice.drive, choice.target, reasons, machines, year);
    // One ship a year in all the world.
    return;
  }
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
  if (free < 0) return;
  const cell = g.offworld.base + free,
    lore = loreOf(world),
    driveKnown = lore.get(p.seat, drive.needs[0]!);
  spendMachines(ctx, p, STARSHIP_MACHINES);
  const decision = world.decisions.record({
    rule: "space.voyage",
    subject: p.ref,
    outcome: {
      star: target.star.ref,
      planet: target.planet.index,
      years: Math.round(target.years),
    },
    score: target.years,
    threshold: 0,
    factors: [
      {
        name: `${target.star.spectral === "white dwarf" ? "a white dwarf" : `a ${target.star.spectral} star`} ${target.star.distance.toFixed(1)} light-years out, with a world its people could live on (${target.upkeep.toFixed(1)} machines a settler a year to keep)`,
        value: target.star.distance,
        contribution: 1,
        source: { ref: target.star.ref, role: "enabler" as const, weight: 1 },
      },
      {
        name: `${drive.words}: ${(cruise(drive) * 100).toFixed(1)} in a hundred of light's speed, ${Math.round(target.years)} years on the way`,
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
      years: Math.round(target.years),
      drive: drive.id,
      year,
    },
  });
  // The ship: a land of the realm, its people aboard.
  settle(ctx, p, origin, cell, decision, event, year);
  const body = g.life.people?.body ?? null,
    there = habitability(target.planet, body, g.system.bodies[0]!.gravity).upkeep;
  sites.set(cell, {
    realm: p.ref,
    from: origin.cell,
    star: target.star.ref,
    planet: target.planet.index,
    distance: target.star.distance,
    drive: drive.id,
    departed: year,
    arrives: year + Math.ceil(target.years),
    voyage: event,
    arrived: null,
    aboard: ABOARD,
    there: Math.min(0.9, there / (there + 6)),
  });
}

export function installVoyages(world: World, ctx: () => PopulationContext): StarSiteStore {
  const store = world.register(new StarSiteStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "198.space.voyage", every: YEAR, run: (t) => voyageYear(ctx(), t) });
  return store;
}
