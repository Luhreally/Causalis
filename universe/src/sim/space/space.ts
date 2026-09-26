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
import { cellRef, isProvinceWorld, offworldSite, type SystemBody } from "../../gen/index.ts";
import {
  BANDS,
  G,
  GOODS,
  delivered,
  habitability,
  launcherFor,
  principle,
  routeTo,
  toOrbit,
  type Bodylike,
  type Launcher,
} from "../../rules/index.ts";
import { homePlanet } from "../planet/store.ts";
import { politiesOf, type Polity } from "../polity/polity.ts";
import { knows, loreOf } from "../lore/lore.ts";
import { warsOf } from "../war/war.ts";
import { cultureOf, driftedWays } from "../culture/culture.ts";
import { languagesOf } from "../culture/languages.ts";
import { COLS, Province, ROWS } from "../population/model.ts";
import { POPULATION_EVENTS, marketsOf, type PopulationContext } from "../population/systems.ts";

export const SPACE_EVENTS = {
  satellite: defineEventType("space.satellite", 5),
  crew: defineEventType("space.crew", 5),
  station: defineEventType("space.station", 4),
  colony: defineEventType("space.colony", 6),
};

/** The settlers of a first colony, grown people all. */
export const COLONISTS = 500;
/** The tonnes set down for each settler: the settler, the halls' share, the first year's needs. */
export const SETTLER_TONNES = 1;
/** The share of a realm's machines a colony may take: a founding is a realm's great work. */
export const COLONY_SHARE = 0.5;
/** Years between one colony a realm founds and its next. */
export const COLONY_GAP = 40;

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
  /** The colonies it founded: each its land, and the event. */
  colonies: { cell: number; event: Ref; year: number }[];
};

export class SpaceStore implements StateStore {
  readonly name = "space.flight";
  private readonly programs = new Map<string, Program>();
  /** The world's firsts. */
  first: { satellite: Ref | null; crew: Ref | null; station: Ref | null; colony: Ref | null } = {
    satellite: null,
    crew: null,
    station: null,
    colony: null,
  };

  of(realm: Ref): Program | undefined {
    return this.programs.get(realm);
  }
  program(realm: Ref): Program {
    let p = this.programs.get(realm);
    if (!p)
      this.programs.set(
        realm,
        (p = { realm, satellite: null, crew: null, station: null, launches: 0, colonies: [] }),
      );
    return p;
  }
  all(): Program[] {
    return [...this.programs.values()].sort((a, b) => (a.realm < b.realm ? -1 : 1));
  }
  pinned(): Ref[] {
    const out: Ref[] = [];
    for (const p of this.programs.values())
      for (const r of [p.satellite, p.crew, p.station, ...p.colonies.map((c) => c.event)])
        if (r) out.push(r);
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
    s.first.colony ??= null;
    this.programs.clear();
    for (const p of s.programs)
      this.programs.set(p.realm, { ...p, colonies: (p.colonies ?? []).map((c) => ({ ...c })) });
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
  colonyYear(ctx, t);
}

/** A body a realm could settle: its site, the cost of setting its settlers down, the halls' upkeep. */
type Prospect = { cell: number; body: SystemBody; cost: number; upkeep: number; route: number };

/** The bodies a realm's seat could settle now: livable for its people, within its drive's reach, a site free. */
export function prospects(ctx: PopulationContext, p: Polity): Prospect[] {
  const g = ctx.generated;
  if (!isProvinceWorld(g)) return [];
  const bodies = g.system.bodies,
    home = bodies[0]!,
    knowsHere = (id: string) => knows(ctx, p.seat, id),
    list: Bodylike[] = bodies.map((b) => ({
      around: bodies.findIndex((x) => x.ref === b.orbit.around),
      a: b.orbit.a,
      periodDays: b.orbit.periodDays,
      mass: b.mass,
      radius: b.radius,
      pressure: b.pressure,
    })),
    out: Prospect[] = [];
  g.offworld.sites.forEach((site, i) => {
    const cell = g.offworld.base + i;
    if (ctx.provinces.get(cell)?.total()) return;
    // One settled site on a body at a time is where a colony begins; its others fill from it.
    if (site.site > 0) return;
    const body = bodies[site.body]!,
      h = habitability(body, g.life.people?.body ?? null, home.gravity);
    if (!h.livable) return;
    const route = routeTo(list, site.body, g.star.mass),
      way = delivered(knowsHere, toOrbit(home).total, route.speed);
    if (!way) return;
    out.push({
      cell,
      body,
      cost: way.cost * SETTLER_TONNES * COLONISTS * MACHINES_PER_COST,
      upkeep: h.upkeep,
      route: route.speed,
    });
  });
  // The cheapest to reach and keep first (ties to the lower land).
  return out.sort(
    (a, b) => a.cost * (1 + a.upkeep / 10) - b.cost * (1 + b.upkeep / 10) || a.cell - b.cell,
  );
}

/** A realm with a station and the knowledge of habitats sets its first settlers down on another body. */
function colonyYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = spaceOf(world),
    year = yearOfMoment(t),
    realms = politiesOf(world);
  for (const p of realms.living()) {
    const prog = store.of(p.ref);
    if (!prog?.station || !knows(ctx, p.seat, "habitats") || !knows(ctx, p.seat, "transfer-flight"))
      continue;
    const last = prog.colonies.at(-1);
    if (last && year - last.year < COLONY_GAP) continue;
    // The settlers come from the realm's most crowded land, which must keep four times as many.
    const origin = p.members
      .map((c) => ctx.provinces.get(c))
      .filter((x): x is Province => x !== undefined && !offworldSite(ctx.generated, x.cell))
      .sort((a, b) => b.total() - a.total() || a.cell - b.cell)[0];
    if (!origin || origin.total() < COLONISTS * 5) continue;
    const seat = origin;
    const machines = machinesOf(ctx, p),
      choice = prospects(ctx, p).find((x) => x.cost <= machines * COLONY_SHARE);
    if (!choice) continue;
    // A reason to go: a rival already there, crowding at home, and the rulers' will.
    const reasons: Factor[] = [],
      rival = store.first.colony;
    if (rival)
      reasons.push({
        name: "another realm's colony",
        value: 1,
        contribution: 1,
        source: { ref: rival, role: "trigger", weight: 1 },
      });
    if (seat.lastFamine)
      reasons.push({
        name: "hunger at home",
        value: 1,
        contribution: 0.5,
        source: { ref: seat.lastFamine, role: "pressure", weight: 1 },
      });
    const drive = reasons.reduce((s, f) => s + f.contribution, 0.3);
    if (!(world.rng.real(FLIGHT, p.seat, t, 3) < FLIGHT_PACE * drive)) continue;
    found(ctx, p, origin, choice, reasons, machines, year, t);
    // One founding a year in all the world (each the year's great voyage).
    return;
  }
}

/** Set a colony down: settlers, their share of the seat's goods, its knowledge and ways, a place in the realm. */
function found(
  ctx: PopulationContext,
  p: Polity,
  seat: Province,
  choice: Prospect,
  reasons: Factor[],
  machines: number,
  year: number,
  t: SimTime,
): void {
  const { world, history } = ctx,
    store = spaceOf(world),
    lore = loreOf(world),
    g = ctx.generated,
    habitsKnown = lore.get(p.seat, "habitats");
  spend(ctx, p, choice.cost);
  const decision = world.decisions.record({
    rule: "space.colony",
    subject: p.ref,
    outcome: { cell: choice.cell, body: choice.body.designation },
    score: choice.cost,
    threshold: 0,
    factors: [
      {
        name: `${choice.body.designation}, livable in halls: ${choice.upkeep.toFixed(1)} machines a settler a year to keep`,
        value: choice.upkeep,
        contribution: 1,
        source: { ref: choice.body.ref, role: "enabler" as const, weight: 1 },
      },
      {
        name: `the way there: ${choice.route.toFixed(1)} km/s from the home world's orbit`,
        value: choice.route,
        contribution: 0.7,
        source: lore.get(p.seat, "transfer-flight")
          ? { ref: lore.get(p.seat, "transfer-flight")!.event, role: "enabler" as const, weight: 1 }
          : null,
      },
      ...reasons,
      {
        name: "machines enough to spare",
        value: machines / Math.max(1, choice.cost),
        contribution: 0.4,
        source: { ref: p.ref, role: "agent" as const, weight: 1 },
      },
    ].slice(0, 6),
  });
  const causes: CauseRef[] = [{ ref: decision, role: "trigger", weight: 1 }];
  if (habitsKnown) causes.push({ ref: habitsKnown.event, role: "enabler", weight: 0.8 });
  const event = world.events.emit({
    type: SPACE_EVENTS.colony.type,
    importance: store.first.colony ? 5 : 6,
    place: cellRef(0, choice.cell),
    subjects: [p.ref, cellRef(0, choice.cell), choice.body.ref],
    causes,
    data: { realm: p.town, body: choice.body.designation, settlers: COLONISTS, year },
  });
  // The settlers: grown people of the seat, drawn from each band and work as they are.
  const moved = new Array<number>(ROWS * COLS).fill(0),
    byOccupation = new Array<number>(COLS).fill(0);
  let pool = 0;
  for (let r = 0; r < ROWS; r++) {
    const band = r % BANDS;
    if (ctx.life.bands[band]! < ctx.life.adulthood || band > 6) continue;
    for (let o = 0; o < COLS; o++) pool += seat.counts.get(r, o);
  }
  let left = COLONISTS;
  for (let r = 0; r < ROWS && left > 0; r++) {
    const band = r % BANDS;
    if (ctx.life.bands[band]! < ctx.life.adulthood || band > 6) continue;
    for (let o = 0; o < COLS && left > 0; o++) {
      const n = Math.min(
        left,
        seat.counts.get(r, o),
        Math.ceil((seat.counts.get(r, o) * COLONISTS) / pool),
      );
      if (n <= 0) continue;
      moved[r * COLS + o] = n;
      byOccupation[o] = byOccupation[o]! + n;
      left -= n;
    }
  }
  const settlers = COLONISTS - left,
    colony = ctx.provinces.add(new Province(choice.cell, year, event));
  moved.forEach((n, i) => {
    if (!n) return;
    const r = Math.floor(i / COLS),
      o = i % COLS;
    seat.counts.add(r, o, -n);
    colony.counts.add(r, o, n);
  });
  history.addFlow({
    from: seat.cell,
    to: choice.cell,
    year,
    count: settlers,
    byOccupation,
    decision,
    event,
  });
  world.events.emit({
    type: POPULATION_EVENTS.peopled.type,
    place: colony.ref,
    causes: [{ ref: event, role: "trigger", weight: 1 }],
    data: { people: settlers },
  });
  // They carry what they know: sowing, and every principle the seat knows.
  colony.knowsCultivation = true;
  colony.cultivation = seat.cultivation;
  colony.herding = seat.herding;
  for (const [id, k] of lore.of(p.seat)) lore.learn(choice.cell, id, k, principle(id));
  // A year of food and their share of the seat's goods.
  const markets = marketsOf(world),
    from = markets.of(seat.cell),
    to = markets.of(choice.cell),
    people = Math.max(1, seat.total() + settlers);
  for (let good = 0; good < GOODS.length; good++)
    to.move(
      "carriedIn",
      good,
      from.move("carriedOut", good, Math.floor((from.stock[good]! * settlers) / people)),
    );
  to.move("carriedIn", G.grain, settlers * 12);
  if (from.metalworking) to.metalworking = from.metalworking;
  // Their ways and tongue, the seat's as they left it (the far world's ways drift from there).
  const culture = cultureOf(world),
    ways = culture.get(seat.cell);
  if (ways) culture.set(driftedWays(world, ways, choice.cell, 1, event));
  const langs = languagesOf(world),
    spoken = langs.of(seat.cell);
  if (spoken) langs.speak(choice.cell, spoken.index, event);
  // A land of the realm.
  politiesOf(world).join(p, choice.cell);
  store.program(p.ref).colonies.push({ cell: choice.cell, event, year });
  if (!store.first.colony) store.first.colony = event;
  void g;
}

export function installSpace(world: World, ctx: () => PopulationContext): SpaceStore {
  const store = world.register(new SpaceStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "197.space.year", every: YEAR, run: (t) => spaceYear(ctx(), t) });
  return store;
}
