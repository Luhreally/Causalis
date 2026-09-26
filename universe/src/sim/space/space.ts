// Flight to orbit (docs/architecture §25, Phase 5 M48–M49): a realm whose seat knows
// orbital flight builds the cheapest launcher its knowledge allows for the speed its own
// world asks (rules/launch.ts: the gravity well, the air, the rocket equation), and sends
// up its first satellite when its works can bear the cost and it has a reason to — a rival
// already in the sky, a war, its rulers' pride; its first crew once it can keep people
// alive up there; its first station once it can build halls in orbit. Each first is an
// event whose why reaches the world's pull and radius, the engine and the realm.
import {
  YEAR,
  defineEventType,
  defineStream,
  yearOfMoment,
  type CauseRef,
  type Factor,
  type Hasher,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { G, launcherFor, toOrbit, type Launcher } from "../../rules/index.ts";
import { homePlanet } from "../planet/store.ts";
import { politiesOf, type Polity } from "../polity/polity.ts";
import { knows, loreOf } from "../lore/lore.ts";
import { warsOf } from "../war/war.ts";
import { marketsOf, type PopulationContext } from "../population/systems.ts";

export const SPACE_EVENTS = {
  satellite: defineEventType("space.satellite", 5),
  crew: defineEventType("space.crew", 5),
  station: defineEventType("space.station", 4),
};

const FLIGHT = defineStream("space.flight");

/** The tonnes a first launch program lifts, in all (the trials and the first satellite). */
export const SATELLITE_TONNES = 40;
/** A crewed program's tonnes; a station's. */
export const CREW_TONNES = 400;
export const STATION_TONNES = 1000;
/**
 * Machines a unit of launch cost takes (rules/launch.ts prices a tonne in frames and
 * propellant): a first satellite program on oil engines from a home-like world costs a
 * large industrial realm about a fiftieth of the machines it holds.
 */
export const MACHINES_PER_COST = 600;
/** The share of a realm's machines it can give a flight program in a year. */
export const PROGRAM_SHARE = 0.15;
/** The yearly chance a realm able to fly does, before its reasons. */
export const FLIGHT_PACE = 0.25;

/** A realm's flight: its firsts, and how many launches since. */
export type Program = {
  readonly realm: Ref;
  satellite: Ref | null;
  crew: Ref | null;
  station: Ref | null;
  launches: number;
};

export class SpaceStore implements StateStore {
  readonly name = "space.flight";
  private readonly programs = new Map<string, Program>();
  /** The world's firsts. */
  first: { satellite: Ref | null; crew: Ref | null; station: Ref | null } = {
    satellite: null,
    crew: null,
    station: null,
  };

  of(realm: Ref): Program | undefined {
    return this.programs.get(realm);
  }
  program(realm: Ref): Program {
    let p = this.programs.get(realm);
    if (!p)
      this.programs.set(
        realm,
        (p = { realm, satellite: null, crew: null, station: null, launches: 0 }),
      );
    return p;
  }
  all(): Program[] {
    return [...this.programs.values()].sort((a, b) => (a.realm < b.realm ? -1 : 1));
  }
  pinned(): Ref[] {
    const out: Ref[] = [];
    for (const p of this.programs.values())
      for (const r of [p.satellite, p.crew, p.station]) if (r) out.push(r);
    return out;
  }
  hashInto(h: Hasher): void {
    h.value(this.all()).value(this.first);
  }
  save(): unknown {
    return { programs: this.all(), first: this.first };
  }
  load(state: unknown): void {
    const s = state as { programs: Program[]; first: SpaceStore["first"] };
    this.programs.clear();
    for (const p of s.programs) this.programs.set(p.realm, { ...p });
    this.first = { ...s.first };
  }
}

export function spaceOf(world: World): SpaceStore {
  return world.store<SpaceStore>("space.flight");
}

/** A realm's machines: what its lands hold in store. */
function machinesOf(ctx: PopulationContext, p: Polity): number {
  const markets = marketsOf(ctx.world);
  let n = 0;
  for (const c of p.members) n += markets.get(c)?.stock[G.machines] ?? 0;
  return n;
}

/** Spend machines from a realm's lands, the richest first, until the cost is met. */
function spend(ctx: PopulationContext, p: Polity, cost: number): void {
  const markets = marketsOf(ctx.world),
    lands = [...p.members].sort(
      (a, b) =>
        (markets.get(b)?.stock[G.machines] ?? 0) - (markets.get(a)?.stock[G.machines] ?? 0) ||
        a - b,
    );
  let left = Math.ceil(cost);
  for (const c of lands) {
    if (left <= 0) break;
    const m = markets.get(c);
    if (m) left -= m.take("used", G.machines, left);
  }
}

/** The launcher a realm's seat can build for its world's speed to orbit, if any. */
export function launcherOfRealm(ctx: PopulationContext, p: Polity): Launcher | null {
  const home = homePlanet(ctx.world).generated.system.bodies[0]!;
  return launcherFor((id) => knows(ctx, p.seat, id), toOrbit(home).total);
}

/** The factors of a first flight: the pull it overcame, the engine, the reasons, the realm's works. */
function flightFactors(
  ctx: PopulationContext,
  p: Polity,
  launcher: Launcher,
  reasons: Factor[],
  machines: number,
  cost: number,
): Factor[] {
  const g = homePlanet(ctx.world).generated,
    home = g.system.bodies[0]!,
    up = toOrbit(home),
    lore = loreOf(ctx.world),
    engine = launcher.propulsion.needs.at(-1)!,
    engineKnown = lore.get(p.seat, engine);
  return [
    {
      name: `the speed to orbit: ${up.total.toFixed(1)} km/s, by the world's pull (${home.gravity.toFixed(2)} g) and girth`,
      value: up.total,
      contribution: 1,
      source: { ref: g.planet.ref as Ref, role: "constraint" as const, weight: 1 },
    },
    {
      name: `${launcher.propulsion.words} (${launcher.propulsion.exhaust} km/s of exhaust), ${launcher.stages} stage${launcher.stages > 1 ? "s" : ""}`,
      value: launcher.fraction,
      contribution: 0.8,
      source: engineKnown ? { ref: engineKnown.event, role: "enabler" as const, weight: 1 } : null,
    },
    ...reasons,
    {
      name: "machines enough to spare",
      value: machines / Math.max(1, cost),
      contribution: 0.4,
      source: { ref: p.ref, role: "agent" as const, weight: 1 },
    },
  ].slice(0, 6);
}

/** The year's flights: each realm able to fly may send up its first, then more. */
export function spaceYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = spaceOf(world),
    lore = loreOf(world),
    year = yearOfMoment(t),
    wars = warsOf(world);
  for (const p of politiesOf(world).living()) {
    const seat = p.seat;
    if (!knows(ctx, seat, "orbital-flight")) continue;
    const launcher = launcherOfRealm(ctx, p);
    if (!launcher) continue;
    const prog = store.program(p.ref),
      // The next first this realm can reach for.
      next: "satellite" | "crew" | "station" | null = !prog.satellite
        ? "satellite"
        : !prog.crew && knows(ctx, seat, "life-support")
          ? "crew"
          : !prog.station && prog.crew && knows(ctx, seat, "stations")
            ? "station"
            : null;
    if (!next) continue;
    const tonnes =
        next === "satellite" ? SATELLITE_TONNES : next === "crew" ? CREW_TONNES : STATION_TONNES,
      cost = launcher.cost * tonnes * MACHINES_PER_COST,
      machines = machinesOf(ctx, p);
    if (machines * PROGRAM_SHARE < cost) continue;
    // Its reasons: a rival already in the sky, a war, and its rulers' will.
    const reasons: Factor[] = [],
      rival = store.first[next];
    if (rival)
      reasons.push({
        name: `another realm there first`,
        value: 1,
        contribution: 1,
        source: { ref: rival, role: "trigger", weight: 1 },
      });
    const war = wars.fighting(p.ref)[0];
    if (war)
      reasons.push({
        name: "a war",
        value: 1,
        contribution: 0.5,
        source: { ref: war.event, role: "pressure", weight: 1 },
      });
    const drive = reasons.reduce((s, f) => s + f.contribution, 0.3);
    if (
      !(
        world.rng.real(FLIGHT, seat, t, next === "satellite" ? 0 : next === "crew" ? 1 : 2) <
        FLIGHT_PACE * drive
      )
    )
      continue;
    spend(ctx, p, cost);
    const known = lore.get(
      seat,
      next === "satellite" ? "orbital-flight" : next === "crew" ? "life-support" : "stations",
    );
    const decision = world.decisions.record({
      rule: `space.${next}`,
      subject: p.ref,
      outcome: {
        launcher: `${launcher.propulsion.id}/${launcher.frame.id}`,
        stages: launcher.stages,
      },
      score: drive,
      threshold: 0,
      factors: flightFactors(ctx, p, launcher, reasons, machines, cost),
    });
    const causes: CauseRef[] = [{ ref: decision, role: "trigger", weight: 1 }];
    if (known) causes.push({ ref: known.event, role: "enabler", weight: 0.8 });
    const event = world.events.emit({
      type: SPACE_EVENTS[next].type,
      importance: store.first[next] ? 4 : 6,
      place: `cell:0:${seat}` as Ref,
      subjects: [p.ref],
      causes,
      data: {
        realm: p.town,
        speed: Math.round(launcher.speed * 10) / 10,
        engine: launcher.propulsion.id,
        stages: launcher.stages,
        cost: Math.round(cost),
        year,
      },
    });
    prog[next] = event;
    prog.launches++;
    if (!store.first[next]) store.first[next] = event;
  }
}

export function installSpace(world: World, ctx: () => PopulationContext): SpaceStore {
  const store = world.register(new SpaceStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "197.space.year", every: YEAR, run: (t) => spaceYear(ctx(), t) });
  return store;
}
