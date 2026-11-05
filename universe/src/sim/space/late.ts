// Ages past ours, as they are done (Phase 66, asked for 2026-11-03: "the ages past the ages humans
// experienced can still emerge ... with logic there for it to emerge if present for that world"). A
// realm with a station that knows how begins the mirrors about its star, each works building the next
// out of the system's small bodies, until they gather more than falls on its whole world. A realm with
// halls on a body whose pull can hold an air, and giants to draw it from, begins remaking it: its share
// of the air and water brought in, year by year, and those halls' people need keep less and less out,
// until they can walk out under it. A world whose lands are built on from edge to edge is covered. Each a
// first of history, its why the matter of its world, the people who knew how and the machines they gave.
import {
  defineEventType,
  defineStream,
  yearOfMoment,
  type Ref,
  type SimTime,
  type World,
} from "../../kernel/index.ts";
import { cellRef, isProvinceWorld, offworldSite, type HomeWorld } from "../../gen/index.ts";
import {
  COVERED_SHARE,
  COVER_PEOPLE_KM2,
  FIRST_MIRRORS_KM2,
  REMAKE_YEARS,
  cannotRemake,
  mirrorsNextYear,
  mostMirrorsKm2,
  worldDiscKm2,
  type RemakeGround,
} from "../../rules/index.ts";
import { knows, loreOf } from "../lore/lore.ts";
import { politiesOf, type Polity } from "../polity/polity.ts";
import { provinceCapacity, type PopulationContext } from "../population/systems.ts";
import { FLIGHT_PACE, machinesOfRealm, spaceOf, spendMachines } from "./space.ts";
import { lateOf, remakeKey, type LateStore } from "./late-store.ts";
import { starSitesOf } from "./stars.ts";
import { clusterOf, worldsOf } from "./voyages.ts";

export const LATE_EVENTS = {
  mirrors: defineEventType("late.mirrors", 6),
  gathered: defineEventType("late.gathered", 6),
  remaking: defineEventType("late.remaking", 6),
  remade: defineEventType("late.remade", 6),
  covered: defineEventType("late.covered", 7),
};

const LATE = defineStream("space.late");

/** What a first works of mirrors costs, in machines: the works and the craft that tend it. */
export const MIRROR_MACHINES = 1_500_000;
/** The share of a realm's machines it may give the mirrors, or a world's remaking, at the start. */
export const GREAT_WORK_SHARE = 0.5;
/** What beginning a world's remaking costs, in machines: the first comets turned from their courses. */
export const REMAKE_MACHINES = 1_200_000;
/** What it costs a year to go on with it. */
export const REMAKE_YEARLY = 6_000;
/** Years untended before mirrors begin to drift and be lost. */
const MIRRORS_ADRIFT = 60;

/** The rock a system's small bodies hold, in home-world masses. */
export function rockEarths(g: HomeWorld): number {
  let m = 0;
  for (const b of g.system.bodies) if (b.kind === "rocky" || b.kind === "moon") m += b.mass;
  return m;
}

/** The ground of a land of another body as a remaking reads it (null: a ship still sailing). */
export function remakeGround(world: World, g: HomeWorld, cell: number): RemakeGround | null {
  const site = offworldSite(g, cell);
  if (!site) return null;
  if (site.body >= 0) return g.system.bodies[site.body] ?? null;
  const ship = starSitesOf(world)?.get(cell);
  if (!ship?.arrived) return null;
  const star = clusterOf(world).find((s) => s.ref === ship.star);
  return (star && worldsOf(world, star)[ship.planet]) ?? null;
}

/** The mirrors' year: tended, they double; left alone, they drift. A realm able to begins them. */
function mirrorsYear(ctx: PopulationContext, t: SimTime, late: LateStore): void {
  const { world, generated: g } = ctx,
    year = yearOfMoment(t),
    space = spaceOf(world),
    realms = politiesOf(world).living();
  const able = (p: Polity) => !!space.of(p.ref)?.station && knows(ctx, p.seat, "star-mirrors"),
    m = late.mirrors;
  if (m) {
    const by = realms.find(able);
    if (by) m.tended = year;
    else {
      if (year - m.tended > MIRRORS_ADRIFT) m.km2 *= 0.98;
      return;
    }
    m.km2 = mirrorsNextYear(m.km2, mostMirrorsKm2(rockEarths(g), g.system.bodies[0]!.orbit.a));
    if (!m.gathered && m.km2 >= worldDiscKm2(g.planet.radius))
      m.gathered = world.events.emit({
        type: LATE_EVENTS.gathered.type,
        place: cellRef(0, by.seat),
        subjects: [by.ref],
        causes: [{ ref: m.begun, role: "trigger", weight: 1 }],
        data: { km2: Math.round(m.km2), year },
      });
    return;
  }
  for (const p of realms) {
    if (!able(p)) continue;
    const machines = machinesOfRealm(ctx, p);
    if (machines * GREAT_WORK_SHARE < MIRROR_MACHINES) continue;
    if (!(world.rng.real(LATE, p.seat, t, 0) < FLIGHT_PACE * 0.3)) continue;
    spendMachines(ctx, p, MIRROR_MACHINES);
    const known = loreOf(world).get(p.seat, "star-mirrors"),
      decision = world.decisions.record({
        rule: "late.mirrors",
        subject: p.ref,
        outcome: { km2: FIRST_MIRRORS_KM2 },
        score: machines,
        threshold: MIRROR_MACHINES / GREAT_WORK_SHARE,
        factors: [
          {
            name: `${Math.round(rockEarths(g) * 1000) / 1000} home-world masses of rock in its system's small bodies, a kilogram to the square metre`,
            value: rockEarths(g),
            contribution: 1,
            source: { ref: g.star.ref as Ref, role: "enabler" as const, weight: 1 },
          },
          {
            name: "machines enough to build the first works",
            value: machines / MIRROR_MACHINES,
            contribution: 0.4,
            source: { ref: p.ref, role: "agent" as const, weight: 1 },
          },
        ],
      }),
      event = world.events.emit({
        type: LATE_EVENTS.mirrors.type,
        place: cellRef(0, p.seat),
        subjects: [p.ref],
        causes: [
          { ref: decision, role: "trigger", weight: 1 },
          ...(known ? [{ ref: known.event, role: "enabler" as const, weight: 0.8 }] : []),
        ],
        data: { realm: p.town, km2: FIRST_MIRRORS_KM2, year },
      });
    late.mirrors = {
      km2: FIRST_MIRRORS_KM2,
      year,
      realm: p.ref,
      begun: event,
      gathered: null,
      tended: year,
    };
    return;
  }
}

/** The remakings' year: each goes on while its land's realm gives what it takes; a realm able to begins another. */
function remakeYear(ctx: PopulationContext, t: SimTime, late: LateStore): void {
  const { world, generated: g } = ctx;
  if (!isProvinceWorld(g)) return;
  const year = yearOfMoment(t),
    realms = politiesOf(world),
    space = spaceOf(world),
    base = g.offworld.base;
  let begun = false;
  for (let i = 0; i < g.offworld.sites.length; i++) {
    const cell = base + i,
      site = g.offworld.sites[i]!;
    if (!ctx.provinces.get(cell)?.total()) continue;
    const key = remakeKey(site.body, cell),
      r = late.get(key),
      p = realms.of(cell);
    if (!p || !knows(ctx, p.seat, "world-making")) continue;
    if (r) {
      // (Once a year for all its body's lands: the first with a realm able to give what it takes.)
      if (r.done || r.last === year || machinesOfRealm(ctx, p) < REMAKE_YEARLY) continue;
      spendMachines(ctx, p, REMAKE_YEARLY);
      r.last = year;
      r.share = Math.min(1, r.share + 1 / REMAKE_YEARS);
      if (r.share >= 1)
        r.done = world.events.emit({
          type: LATE_EVENTS.remade.type,
          place: cellRef(0, cell),
          subjects: [p.ref, cellRef(0, cell)],
          causes: [{ ref: r.begun, role: "trigger", weight: 1 }],
          data: { realm: p.town, year },
        });
      continue;
    }
    if (begun || !space.of(p.ref)?.station) continue;
    const ground = remakeGround(world, g, cell);
    if (!ground || cannotRemake(ground)) continue;
    const machines = machinesOfRealm(ctx, p);
    if (machines * GREAT_WORK_SHARE < REMAKE_MACHINES) continue;
    if (!(world.rng.real(LATE, cell, t, 1) < FLIGHT_PACE * 0.2)) continue;
    spendMachines(ctx, p, REMAKE_MACHINES);
    const known = loreOf(world).get(p.seat, "world-making"),
      decision = world.decisions.record({
        rule: "late.remaking",
        subject: p.ref,
        outcome: { cell, key },
        score: machines,
        threshold: REMAKE_MACHINES / GREAT_WORK_SHARE,
        factors: [
          {
            name: `a pull of ${Math.round(ground.gravity * 100) / 100} g that will hold an air, at ${Math.round(ground.temperature)} °C under ${Math.round(ground.pressure * 100) / 100} bar`,
            value: ground.gravity,
            contribution: 1,
            source: { ref: cellRef(0, cell), role: "enabler" as const, weight: 1 },
          },
          {
            name: "machines enough to turn the first comets",
            value: machines / REMAKE_MACHINES,
            contribution: 0.4,
            source: { ref: p.ref, role: "agent" as const, weight: 1 },
          },
        ],
      }),
      event = world.events.emit({
        type: LATE_EVENTS.remaking.type,
        place: cellRef(0, cell),
        subjects: [p.ref, cellRef(0, cell)],
        causes: [
          { ref: decision, role: "trigger", weight: 1 },
          ...(known ? [{ ref: known.event, role: "enabler" as const, weight: 0.8 }] : []),
        ],
        data: { realm: p.town, year },
      });
    late.add({ key, cell, realm: p.ref, year, share: 0, begun: event, done: null, last: year });
    begun = true;
  }
}

/** Lands of the home world built on from edge to edge, and lands of it with people. */
export function coverOf(ctx: PopulationContext): { built: number; lands: number } {
  const g = ctx.generated,
    base = isProvinceWorld(g) ? g.offworld.base : g.grid.count;
  let built = 0,
    lands = 0;
  for (const p of ctx.provinces.all()) {
    if (p.cell >= base) continue;
    const people = p.total();
    if (!people) continue;
    lands++;
    if (people >= COVER_PEOPLE_KM2 * provinceCapacity(ctx, p.cell).areaKm2) built++;
  }
  return { built, lands };
}

/** The covering of a world, a first once: one test in ten years, once a land knows the towers. */
function coveredYear(ctx: PopulationContext, t: SimTime, late: LateStore): void {
  const { world } = ctx,
    year = yearOfMoment(t);
  if (late.covered || year % 10 !== 0) return;
  const lore = loreOf(world),
    known = ctx.provinces.all().find((p) => lore.get(p.cell, "world-city"));
  if (!known) return;
  const { built, lands } = coverOf(ctx);
  if (!lands || built < lands * COVERED_SHARE) return;
  late.covered = world.events.emit({
    type: LATE_EVENTS.covered.type,
    place: cellRef(0, known.cell),
    causes: [{ ref: lore.get(known.cell, "world-city")!.event, role: "enabler", weight: 1 }],
    data: { built, lands, year },
  });
}

/** What lies past our ages, in a year: nothing at all until someone knows how. */
export function lateYear(ctx: PopulationContext, t: SimTime): void {
  const late = lateOf(ctx.world);
  if (!late) return;
  mirrorsYear(ctx, t, late);
  remakeYear(ctx, t, late);
  coveredYear(ctx, t, late);
}
