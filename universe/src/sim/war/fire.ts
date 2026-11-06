// The greatest fire in history (War past the line, W5): a realm's great works, the year the world holds its breath, a ruler
// who decides, a town lost, what the wind carries, the dark cold years and a world's dread after. The rule, the owner's: the
// greater the fire, the rarer it falls and the more everyone feels it. Nothing here says "realms that both hold it stop
// fighting": what a strike back would cost is read by the one who would begin a war and the one who would loose it, by one
// number. Nothing stirs until a people knows it, and until then this store is dormant, so history holds bit for bit before
// the first find. Treaties and tests are later slices: a pact may read `heldBy`, a test may add soot. It is not the top of any
// ladder (rules/greatfire.ts `unmakeMj`, W6).
import {
  defineEventType,
  defineStream,
  dmath,
  yearOfMoment,
  type CauseRef,
  type Factor,
  type Hasher,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { cellRef, windAt } from "../../gen/index.ts";
import {
  FIRE,
  FIRE_ID,
  G,
  chanceOfFall,
  coldDegrees,
  desperationOf,
  fearOf,
  greatFallOf,
  holdBackBy,
  missOf,
  rocketMiss,
  sootOfBurned,
  worksChance,
  type Rung,
} from "../../rules/index.ts";
import { deathsIn, grieve, spill } from "../acts/disasters.ts";
import { WAY, cultureOf } from "../culture/culture.ts";
import { diplomacyOf, relationRef } from "../diplomacy/diplomacy.ts";
import type { MarketStore } from "../economy/market.ts";
import { loreOf } from "../lore/lore.ts";
import { orderOf } from "../order/order.ts";
import { rulerProblem } from "../order/reign.ts";
import { politiesOf, realmName, type Polity } from "../polity/polity.ts";
import type { PopulationContext } from "../population/systems.ts";
import { flattenTown, townsOf } from "../town/fabric.ts";
import { fleetOf, foodIn, thrownAtOf, throwerOf, type Thrower } from "./air.ts";
import { WAR_EVENTS, fieldedOf, frontier, strengthOf, warsOf, type War } from "./war.ts";

export const FIRE_EVENTS = {
  /** A realm begins a great works. */
  begun: defineEventType("fire.begun", 6),
  /** Its works are done: it holds it. */
  held: defineEventType("fire.held", 6),
  /** A year when the whole world holds its breath. */
  crisis: defineEventType("fire.crisis", 7),
  /** Someone stepped back: told as the event it is. */
  stepped: defineEventType("fire.stepped", 7),
  /** The dark years come, and go. */
  cold: defineEventType("fire.cold", 7),
  clear: defineEventType("fire.clear", 5),
  /** By the god's hand. */
  given: defineEventType("fire.given", 6),
  taken: defineEventType("fire.taken", 6),
};

const CHOICE = defineStream("war.fire");

/** A realm's great works: where, since when, what it has cost. */
export type GreatWorks = {
  readonly realm: Ref;
  readonly cell: number;
  readonly place: string;
  readonly begun: number;
  done: number | null;
  /** The machines it has taken. */
  paid: number;
  readonly event: Ref;
  held: Ref | null;
  readonly given?: boolean;
  /** The year it was given up, taken, or went with its realm. */
  gone?: number;
};

/** A year the world held its breath. `war` null: two holders at the brink with no war between them. */
export type FireCrisis = {
  readonly year: number;
  readonly holder: Ref;
  readonly foe: Ref;
  readonly war: Ref | null;
  readonly desperation: number;
  readonly ruler: string;
  readonly event: Ref;
  /** A ruler's word, played by the god's hand. */
  answer?: "hold" | "loose";
  ended: number | null;
  end?: "stepped" | "fell" | "gone";
  /** Who stepped back. */
  who?: "holder" | "foe";
  endEvent?: Ref;
};

/** One that fell. */
export type GreatFall = {
  readonly year: number;
  readonly by: Ref;
  readonly on: Ref;
  readonly war: Ref;
  readonly town: Ref;
  readonly cell: number;
  readonly dead: number;
  readonly homes: number;
  /** The lands the wind carried it over, and those who died of it there. */
  readonly wind: readonly number[];
  readonly windDead: number;
  readonly soot: number;
  readonly event: Ref;
  readonly decision: Ref;
};

/** A realm's works of turning its star's light on a far mark (W6): as a great works, over generations. */
export type FarWorks = {
  readonly realm: Ref;
  readonly cell: number;
  readonly place: string;
  readonly begun: number;
  done: number | null;
  paid: number;
  readonly event: Ref;
  held: Ref | null;
  readonly given?: boolean;
  gone?: number;
};

/** The year before a fleet comes in, with what its realm could bring (W6). */
export type FarCrisis = {
  readonly year: number;
  readonly holder: Ref;
  readonly foe: Ref;
  readonly war: Ref;
  readonly star: Ref;
  readonly planet: number;
  readonly rung: Rung;
  readonly going: number;
  readonly mj: number;
  readonly byLight: boolean;
  readonly ruler: string;
  readonly event: Ref;
  answer?: "hold" | "loose";
  ended: number | null;
  end?: "stepped" | "fell" | "gone";
  endEvent?: Ref;
};

/** One that fell on a world (W6): `by` null is the god's hand. */
export type FarFall = {
  readonly rung: Rung;
  readonly year: number;
  readonly by: Ref | null;
  readonly name: string;
  readonly on: Ref | null;
  readonly war: Ref | null;
  readonly star: Ref;
  readonly planet: number;
  readonly lands: readonly number[];
  readonly people: number;
  readonly dead: number;
  readonly mj: number;
  readonly need: number;
  readonly byLight: boolean;
  readonly event: Ref;
  readonly decision: Ref | null;
  /** How long a burned sky stays dark. */
  readonly until?: number;
};

/** What has come of arms past the town's: absent until the first word of them, so history holds bit for bit before. */
export type FarState = {
  works: FarWorks[];
  crises: FarCrisis[];
  falls: FarFall[];
  /** The first of each rung. */
  firsts: Partial<Record<Rung, Ref>>;
};

type FireState = {
  works: GreatWorks[];
  crises: FireCrisis[];
  falls: GreatFall[];
  soot: number;
  dread: number;
  /** Lands whose fields lie sick: land, until, what they yield. */
  sick: [number, number, number][];
  /** While the dark years last: the event that told them, and when they began. */
  dark: Ref | null;
  darkSince: number;
  /** Past the town's (W6). */
  far?: FarState;
};

const empty = (): FireState => ({
  works: [],
  crises: [],
  falls: [],
  soot: 0,
  dread: 0,
  sick: [],
  dark: null,
  darkSince: 0,
});

export class FireStore implements StateStore {
  readonly name = "war.fire";
  state: FireState = empty();

  /** Nothing has happened yet: no part of the world's hash, so history holds until the first find. */
  dormant(): boolean {
    const s = this.state;
    return !s.works.length && !s.crises.length && !s.falls.length && !s.soot && !s.dread && !s.far;
  }
  hashInto(h: Hasher): void {
    h.value(this.state);
  }
  save(): unknown {
    return this.state;
  }
  load(state: unknown): void {
    this.state = { ...empty(), ...(state as Partial<FireState>) };
  }
  pinned(): Ref[] {
    const s = this.state,
      out: Ref[] = [];
    for (const w of s.works) {
      out.push(w.event);
      if (w.held) out.push(w.held);
    }
    for (const c of s.crises) {
      out.push(c.event);
      if (c.endEvent) out.push(c.endEvent);
    }
    for (const f of s.falls) out.push(f.event, f.decision);
    if (s.dark) out.push(s.dark);
    if (s.far) {
      for (const w of s.far.works) {
        out.push(w.event);
        if (w.held) out.push(w.held);
      }
      for (const c of s.far.crises) {
        out.push(c.event);
        if (c.endEvent) out.push(c.endEvent);
      }
      for (const f of s.far.falls) {
        out.push(f.event);
        if (f.decision) out.push(f.decision);
      }
    }
    return out;
  }

  /** A realm's far crisis not yet come to its end (W6; none: none). */
  farOpenFor(realm: Ref): FarCrisis | null {
    return this.state.far?.crises.find((c) => c.ended === null && c.holder === realm) ?? null;
  }
  /** What unmade a world of a star, by either of the star's names (W6; none: it stands). */
  unmade(star: string, planet: number): FarFall | null {
    const far = this.state.far;
    if (!far) return null;
    const key = starNumbers(star);
    return (
      far.falls.find(
        (f) => f.rung === "world" && f.planet === planet && starNumbers(f.star) === key,
      ) ?? null
    );
  }
  /** What burned a world's sky, while it stays dark (W6; none: a clear sky). */
  burned(star: string, planet: number, year: number): FarFall | null {
    const far = this.state.far;
    if (!far) return null;
    const key = starNumbers(star);
    return (
      far.falls.find(
        (f) =>
          f.rung === "sky" &&
          f.planet === planet &&
          (f.until ?? 0) > year &&
          starNumbers(f.star) === key,
      ) ?? null
    );
  }

  /** A realm's works standing or under way (none: it has none). */
  worksOf(realm: Ref): GreatWorks | null {
    return this.state.works.find((w) => w.realm === realm && w.gone === undefined) ?? null;
  }
  /** How many a realm holds now (0: none). */
  loadsOf(realm: Ref, year: number): number {
    const w = this.worksOf(realm);
    if (!w || w.done === null) return 0;
    const years = Math.max(0, year - w.done);
    return Math.min(FIRE.mostLoads, 1 + Math.floor(years / FIRE.everyYears));
  }
  /** Who holds it now, the first first. */
  holders(): readonly GreatWorks[] {
    return this.state.works.filter((w) => w.done !== null && w.gone === undefined);
  }
  /** The year's crisis not yet come to its end, for a realm (none: none). */
  openFor(realm: Ref): FireCrisis | null {
    return this.state.crises.find((c) => c.ended === null && c.holder === realm) ?? null;
  }
  open(): readonly FireCrisis[] {
    return this.state.crises.filter((c) => c.ended === null);
  }
}

export function fireOf(world: World): FireStore {
  return world.store<FireStore>("war.fire");
}

/** What has come of arms past the town's (W6; null: nothing yet, or a world with no fire to speak of). */
export function farOf(world: World): FarState | null {
  return world.hasStore("war.fire") ? (fireOf(world).state.far ?? null) : null;
}

/** A star's two names as one: "star:sector:k", or "gstar:i:j:l:k", its sector's cube in the galaxy's zig-zag coding. */
function starNumbers(ref: string): string {
  const p = ref.split(":");
  if (p[0] !== "gstar") return `${p[1]}:${p[2]}`;
  const zig = (n: number) => (n >= 0 ? 2 * n : -2 * n - 1);
  return `${zig(Number(p[1])) + 1024 * zig(Number(p[2])) + 1048576 * zig(Number(p[3]))}:${p[4]}`;
}

const keyOf = (ref: Ref) => Number(ref.split(":")[2]);
const clampRegard = (x: number) => Math.round(x * 1000) / 1000;

/** What a realm has of machines in all its lands. */
export function machinesOf(ctx: PopulationContext, p: Polity): number {
  const markets = ctx.world.store<MarketStore>("economy.markets");
  let n = 0;
  for (const c of p.members) n += markets.get(c)?.stock[G.machines] ?? 0;
  return n;
}

const peopleOf = (ctx: PopulationContext, p: Polity): number =>
  p.members.reduce((n, c) => n + (ctx.provinces.get(c)?.total() ?? 0), 0);

/** What each of a realm's lands gives up to it, of its machines, iron and fuel: the machines taken. */
export function payWorks(ctx: PopulationContext, p: Polity, share: number): number {
  const markets = ctx.world.store<MarketStore>("economy.markets");
  let machines = 0;
  for (const c of [...p.members].sort((a, b) => a - b)) {
    const m = markets.get(c);
    if (!m) continue;
    machines += m.move("used", G.machines, Math.floor(m.stock[G.machines]! * share));
    for (const g of [G.iron, G.coal, G.oil]) m.move("used", g, Math.floor(m.stock[g]! * share));
  }
  return machines;
}

/** What would carry it: a realm's rockets, else its wings (W3, W2): the same reach and miss. Null: nothing it has. */
type Carrier = Thrower & { readonly wing: boolean };
function carrierOf(ctx: PopulationContext, p: Polity): Carrier | null {
  const fielded = () => fieldedOf(ctx, p),
    thrower = throwerOf(ctx, p, fielded);
  if (thrower) return { ...thrower, wing: false };
  const fleet = fleetOf(ctx, p, fielded);
  if (!fleet) return null;
  return {
    rockets: 1,
    mj: 0,
    steered: !!loreOf(ctx.world).get(p.seat, "guidance"),
    rocket: {
      stages: 0,
      kg: fleet.flyer.kg,
      loadKg: fleet.flyer.loadKg,
      thrown: 0,
      speed: fleet.flyer.speed,
      reachKm: fleet.flyer.reachKm,
      around: false,
    },
    wing: true,
  };
}

const worldKm = (ctx: PopulationContext) => 6371 * ctx.generated.planet.radius;

/** The share of `by`'s people a strike from `foe` would kill, on the towns it would hurt most (0: it holds none, or nothing reaches). */
export function answerCost(ctx: PopulationContext, by: Polity, foe: Polity, year: number): number {
  const loads = fireOf(ctx.world).loadsOf(foe.ref, year);
  if (!loads) return 0;
  const carrier = carrierOf(ctx, foe);
  if (!carrier) return 0;
  const towns = townsOf(ctx.world);
  let dead = 0;
  for (const target of thrownAtOf(ctx, by, foe.seat, carrier, worldKm(ctx)).slice(0, loads)) {
    const v = ctx.settlements.get(target.ref)!;
    dead += greatFallOf({
      lots: Math.max(1, towns.get(target.ref)!.next),
      people: v.population,
      miss: carrier.wing ? missOf(carrier.steered) : rocketMiss(target.km, carrier.steered),
    }).dead;
  }
  const people = peopleOf(ctx, by);
  return people > 0 ? dead / people : 0;
}

/**
 * How much less likely a war on `defender` is, by what its answer would cost the one who would begin it. Exactly 1 where
 * it holds nothing, so that before the first find not a bit of history moves.
 */
export function holdBack(
  ctx: PopulationContext,
  attacker: Polity,
  defender: Polity,
  year: number,
): number {
  const s = fireOf(ctx.world);
  if (s.dormant() || !s.loadsOf(defender.ref, year)) return 1;
  return holdBackBy(fearOf(answerCost(ctx, attacker, defender, year)));
}

/** How a war is going for one of its sides, as its ruler reads it. */
export function warGoing(ctx: PopulationContext, w: War, side: 0 | 1, p: Polity): number {
  const foe = politiesOf(ctx.world).get(side === 0 ? w.defender : w.attacker),
    people = Math.max(1, peopleOf(ctx, p));
  let lost = 0,
    won = 0,
    gone = 0;
  for (const b of w.battles) {
    if (b.won === (side === 0)) won++;
    else {
      lost++;
      if (side === 1 && b.won) gone++;
    }
  }
  return desperationOf({
    lost,
    won,
    fallen: w.fallen[side] / people,
    gone: gone / Math.max(1, p.members.length + gone),
    seat: !!foe && foe.ended === null && frontier(ctx, foe, p).includes(p.seat),
  });
}

/** The year's sky: the soot fading, the dark years told and over, sick fields healing, the dread growing old. */
function skyYear(ctx: PopulationContext, year: number): void {
  const { world } = ctx,
    s = fireOf(world).state;
  if (s.dread > 0)
    s.dread = Math.max(
      s.falls.length || s.far?.falls.length ? FIRE.dreadLeast : 0,
      s.dread * FIRE.dreadKept,
    );
  if (s.soot > 0) {
    s.soot *= FIRE.sootKept;
    if (s.soot < FIRE.sootTold / 4) s.soot = 0;
  }
  if (s.sick.length) s.sick = s.sick.filter(([, until]) => until > year);
  if (s.dark && s.soot < FIRE.sootTold) {
    const last = s.falls.at(-1);
    world.events.emit({
      type: FIRE_EVENTS.clear.type,
      causes: [{ ref: s.dark, role: "trigger", weight: 1 }],
      data: { years: year - s.darkSince, name: last ? townName(ctx, last.town) : "" },
    });
    s.dark = null;
  }
}

const townName = (ctx: PopulationContext, ref: Ref) => ctx.settlements.get(ref)?.name ?? "a town";

/** The lands the wind goes over from one, in order, its sea crossed and its lands counted: on its world's own wind (gen/climate.ts). */
export function downwindOf(ctx: PopulationContext, from: number, lands: number): number[] {
  const g = ctx.generated,
    p = g.grid.positions,
    out: number[] = [];
  let at = from;
  const seen = new Set([from]);
  for (let step = 0; step < lands * 3 && out.length < lands; step++) {
    const [wx, wy, wz] = windAt(p, g.grid.lat[at]!, g.climate.bands, at);
    let next = -1,
      best = -Infinity;
    for (let k = g.grid.offsets[at]!; k < g.grid.offsets[at + 1]!; k++) {
      const m = g.grid.neighbours[k]!;
      if (seen.has(m)) continue;
      const along =
        (p[3 * m]! - p[3 * at]!) * wx +
        (p[3 * m + 1]! - p[3 * at + 1]!) * wy +
        (p[3 * m + 2]! - p[3 * at + 2]!) * wz;
      if (along > best || (along === best && m < next)) {
        best = along;
        next = m;
      }
    }
    if (next < 0) break;
    seen.add(next);
    at = next;
    if (g.tectonics.elevation[at]! > 0 && (ctx.provinces.get(at)?.total() ?? 0) > 0) out.push(at);
  }
  return out;
}

/** It falls: W2's burning and dead; what the wind carries; the soot; every realm's regard; the dread. Null: nothing it can reach. */
function fall(
  ctx: PopulationContext,
  c: FireCrisis,
  by: Polity,
  foe: Polity,
  w: War,
  decision: Ref,
  t: SimTime,
): GreatFall | null {
  const { world } = ctx,
    carrier = carrierOf(ctx, by);
  if (!carrier) return null;
  const side: 0 | 1 = w.attacker === by.ref ? 0 : 1,
    from = by.seat,
    target = thrownAtOf(ctx, foe, from, carrier, worldKm(ctx))[0];
  if (!target) return null;
  const s = fireOf(world).state,
    year = yearOfMoment(t),
    v = ctx.settlements.get(target.ref)!,
    f = townsOf(world).get(target.ref)!,
    prov = ctx.provinces.get(target.cell)!,
    all = prov.total(),
    miss = carrier.wing ? missOf(carrier.steered) : rocketMiss(target.km, carrier.steered),
    lots = Math.max(1, f.next),
    done = greatFallOf({ lots, people: v.population, miss }),
    homes = flattenTown(ctx, target.ref, done.share, t, FIRE.ashYears),
    dead = done.dead > 0 && all > 0 ? deathsIn(ctx, target.cell, done.dead, t) : 0,
    food = foodIn(ctx, target.cell);
  spill(ctx, target.cell, all > 0 ? done.share * Math.min(1, v.population / all) : 0);
  const m = world.store<MarketStore>("economy.markets").get(target.cell);
  let machines = 0;
  if (m?.works) {
    machines = m.move("spoiled", G.machines, Math.floor(m.stock[G.machines]! * done.share));
    m.idleUntil = Math.max(m.idleUntil, year + FIRE.worksDown);
  }
  const first = s.falls.length === 0,
    event = world.events.emit({
      type: WAR_EVENTS.strike.type,
      importance: 7,
      subjects: [target.ref, w.ref, by.ref, foe.ref],
      place: prov.ref,
      causes: [
        { ref: decision, role: "agent", weight: 1 },
        { ref: c.event, role: "trigger", weight: 0.8 },
        { ref: w.event, role: "pressure", weight: 0.4 },
      ],
      data: {
        name: target.name,
        a: realmName(by),
        b: realmName(foe),
        ruler: c.ruler,
        dead,
        homes,
        stores: Math.round(food - foodIn(ctx, target.cell)),
        flyers: 1,
        great: true,
        first,
        ...(carrier.wing
          ? { span: 40, speed: Math.round(carrier.rocket.speed) }
          : { rocket: true, speed: Math.round(carrier.rocket.speed) }),
        from,
        km: Math.round(target.km),
        landed: Math.round(done.landed * 100) / 100,
        machines,
        idled: !!m?.works,
      },
    });
  warsOf(world).noteStrike({
    war: w.ref,
    year,
    side,
    town: target.ref,
    cell: target.cell,
    dead,
    homes,
    stores: Math.round(food - foodIn(ctx, target.cell)),
    flyers: 1,
    event,
    great: true,
    ...(carrier.wing ? {} : { kind: "rocket" as const }),
    from,
    landed: Math.round(done.landed * 100) / 100,
    machines,
    idled: !!m?.works,
  });
  grieve(world, target.cell, 0.6, event);
  // What the wind carries: on down its own way, less at each land, their fields sick and some of their people dead.
  const wind = downwindOf(ctx, target.cell, FIRE.windLands);
  let windDead = 0;
  wind.forEach((cell, i) => {
    const thin = dmath.pow(0.6, i),
      n = ctx.provinces.get(cell)!.total();
    windDead += deathsIn(ctx, cell, Math.round(n * FIRE.windDead * thin), t);
    s.sick.push([
      cell,
      year + Math.max(1, Math.round(FIRE.sickYears * thin)),
      FIRE.sickFields + (1 - FIRE.sickFields) * (1 - thin),
    ]);
    grieve(world, cell, 0.1 * thin, event);
  });
  s.sick.push([target.cell, year + FIRE.sickYears, FIRE.sickFields]);
  // The soot of what burned, the cold under it, and a world's dread.
  const soot = sootOfBurned(done.share * v.population);
  s.soot = Math.min(1, s.soot + soot);
  s.dread = first ? FIRE.dreadFirst : Math.min(0.9, s.dread + FIRE.dreadMore);
  if (!s.dark && s.soot >= FIRE.sootTold) {
    s.darkSince = year;
    s.dark = world.events.emit({
      type: FIRE_EVENTS.cold.type,
      causes: [{ ref: event, role: "trigger", weight: 1 }],
      data: { name: target.name, cold: Math.round(coldDegrees(s.soot) * 10) / 10 },
    });
  }
  const fell: GreatFall = {
    year,
    by: by.ref,
    on: foe.ref,
    war: w.ref,
    town: target.ref,
    cell: target.cell,
    dead,
    homes,
    wind,
    windDead,
    soot: Math.round(soot * 1000) / 1000,
    event,
    decision,
  };
  s.falls.push(fell);
  // Every realm that meets it remembers who did this.
  const regard = diplomacyOf(world);
  regard.remember(by.ref, foe.ref, {
    name: `the fire at ${target.name}`,
    value: -1,
    year,
    source: event,
  });
  for (const p of politiesOf(world).living())
    if (p !== by && p !== foe)
      regard.remember(by.ref, p.ref, {
        name: `the fire at ${target.name}`,
        value: -0.5,
        year,
        source: event,
      });
  return fell;
}

/** A war ended by what the year came to. */
function endWar(ctx: PopulationContext, w: War, cause: Ref, year: number, fire: string): void {
  if (w.ended !== null) return;
  const { world } = ctx,
    realms = politiesOf(world),
    a = realms.get(w.attacker)!,
    b = realms.get(w.defender)!;
  w.ended = year;
  w.peace = world.events.emit({
    type: WAR_EVENTS.peace.type,
    subjects: [w.ref, a.ref, b.ref],
    place: ctx.provinces.get(a.seat)?.ref ?? null,
    causes: [{ ref: cause, role: "trigger", weight: 1 }],
    data: { a: realmName(a), b: realmName(b), years: year - w.declared, won: false, fire },
  });
}

/** Last year's crises come to their ends: a ruler decides, once. */
function resolve(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = fireOf(world),
    s = store.state,
    realms = politiesOf(world),
    wars = warsOf(world),
    year = yearOfMoment(t);
  for (const c of [...store.open()]) {
    if (c.year >= year) continue;
    const by = realms.get(c.holder),
      foe = realms.get(c.foe),
      w = c.war ? wars.get(c.war) : undefined;
    // (One of them is gone: it ended itself, and it is told by what ended it.)
    if (!by || !foe || by.ended !== null || foe.ended !== null) {
      c.ended = year;
      c.end = "gone";
      continue;
    }
    const side: 0 | 1 = w?.attacker === by.ref ? 0 : 1,
      going = w ? Math.max(c.desperation, warGoing(ctx, w, side, by)) : c.desperation,
      valour = cultureOf(world).get(by.seat)?.traits[WAY.valour] ?? 0.5,
      cost = answerCost(ctx, by, foe, year),
      fear = fearOf(cost),
      // (Its war over in the year it stood there: the moment passed, and a world that held its breath is told so.)
      chance =
        w && w.ended === null
          ? chanceOfFall({ desperation: going, valour, fear, dread: s.dread })
          : 0,
      draw = world.rng.real(CHOICE, keyOf(by.ref), t, 1),
      loose = c.answer ? c.answer === "loose" && w?.ended === null : draw < chance,
      factors: Factor[] = [
        {
          name: "how the war was going",
          value: Math.round(going * 100) / 100,
          contribution: going,
          source: c.war ? { ref: w!.event, role: "pressure", weight: 1 } : null,
        },
        {
          name: "what a strike back would cost",
          value: Math.round(cost * 10000) / 10000,
          contribution: -fear,
          source: null,
        },
        {
          name: "a people who prize valour",
          value: Math.round(valour * 100) / 100,
          contribution: valour - 0.5,
          source: null,
        },
        ...(s.falls.length
          ? [
              {
                name: "the world's dread, since the first fell",
                value: Math.round(s.dread * 100) / 100,
                contribution: -s.dread,
                source: { ref: s.falls[0]!.event, role: "constraint" as const, weight: 1 },
              },
            ]
          : []),
      ],
      decision = world.decisions.record({
        rule: "fire.use",
        subject: by.ref,
        outcome: { loose, against: foe.ref, ruler: c.ruler, by: c.answer ? "word" : "numbers" },
        score: chance,
        threshold: draw,
        factors,
      });
    if (loose && w) {
      const fell = fall(ctx, c, by, foe, w, decision, t);
      if (fell) {
        c.ended = year;
        c.end = "fell";
        c.endEvent = fell.event;
        // (A holder struck may answer: it stands at the brink a year, by the same numbers. Else their war is over.)
        if (store.loadsOf(foe.ref, year) && !store.openFor(foe.ref))
          open(ctx, foe, by, w, 1, t, fell.event);
        else endWar(ctx, w, fell.event, year, "fell");
        continue;
      }
    }
    // Someone stepped back. Who: the one the more afraid of what the other could do.
    const theirs = fearOf(answerCost(ctx, foe, by, year)),
      who: "holder" | "foe" = theirs > fear || !store.loadsOf(foe.ref, year) ? "foe" : "holder",
      stepped = world.events.emit({
        type: FIRE_EVENTS.stepped.type,
        subjects: [by.ref, foe.ref, ...(w ? [w.ref] : [])],
        place: ctx.provinces.get(by.seat)?.ref ?? null,
        causes: [
          { ref: decision, role: "agent", weight: 1 },
          { ref: c.event, role: "trigger", weight: 1 },
        ],
        data: {
          a: realmName(by),
          b: realmName(foe),
          ruler: c.ruler,
          who,
          held: c.answer === "hold",
        },
      });
    c.ended = year;
    c.end = "stepped";
    c.who = who;
    c.endEvent = stepped;
    diplomacyOf(world).remember(by.ref, foe.ref, {
      name: "the year they stepped back",
      value: 0.4,
      year,
      source: stepped,
    });
    if (w) endWar(ctx, w, stepped, year, "stepped");
  }
}

/** A year when the world holds its breath. */
function open(
  ctx: PopulationContext,
  holder: Polity,
  foe: Polity,
  w: War | null,
  desperation: number,
  t: SimTime,
  after?: Ref,
): void {
  const { world } = ctx,
    s = fireOf(world).state,
    event = world.events.emit({
      type: FIRE_EVENTS.crisis.type,
      subjects: [holder.ref, foe.ref, ...(w ? [w.ref] : [])],
      place: ctx.provinces.get(holder.seat)?.ref ?? null,
      causes: [
        ...(after ? [{ ref: after, role: "trigger" as const, weight: 1 }] : []),
        ...(w ? [{ ref: w.event, role: "pressure" as const, weight: 0.8 }] : []),
        { ref: holder.ruler.event, role: "enabler" as const, weight: 0.3 },
      ],
      data: {
        a: realmName(holder),
        b: realmName(foe),
        ruler: holder.ruler.name,
        going: Math.round(desperation * 100) / 100,
        war: !!w,
        answer: !!after,
      },
    });
  s.crises.push({
    year: yearOfMoment(t),
    holder: holder.ref,
    foe: foe.ref,
    war: w?.ref ?? null,
    desperation,
    ruler: holder.ruler.name,
    event,
    ended: null,
  });
}

/** Those who know of it begin, pay, finish, keep; a realm gone takes its works with it. */
function worksYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = fireOf(world),
    s = store.state,
    realms = politiesOf(world),
    lore = loreOf(world),
    year = yearOfMoment(t);
  for (const w of s.works) {
    if (w.gone !== undefined) continue;
    const p = realms.get(w.realm);
    if (!p || p.ended !== null) {
      w.gone = year;
      continue;
    }
    if (w.done !== null) {
      payWorks(ctx, p, FIRE.keepShare);
      continue;
    }
    w.paid += payWorks(ctx, p, FIRE.worksShare);
    if (year - w.begun < FIRE.worksYears) continue;
    w.done = year;
    w.held = world.events.emit({
      type: FIRE_EVENTS.held.type,
      importance: store.holders().length <= 1 ? 7 : 6,
      subjects: [p.ref],
      place: cellRef(0, w.cell),
      causes: [{ ref: w.event, role: "trigger", weight: 1 }],
      data: {
        a: realmName(p),
        place: w.place,
        years: year - w.begun,
        machines: Math.round(w.paid),
        first: store.holders().length <= 1,
      },
    });
  }
  const knowing = realms
    .living()
    .filter((p) => !!lore.get(p.seat, FIRE_ID) && !store.worksOf(p.ref));
  if (!knowing.length) return;
  // Only a power among powers can pay for one.
  let richest = 0;
  for (const p of realms.living()) richest = Math.max(richest, machinesOf(ctx, p));
  const able = knowing.filter((p) => machinesOf(ctx, p) >= FIRE.worksRich * richest && richest > 0);
  if (!able.length) return;
  const regard = diplomacyOf(world),
    rivals = new Map<string, { hatred: number; rival: Ref; rel: Ref }>();
  for (const r of regard.all()) {
    const hatred = Math.max(0, -r.opinion);
    if (hatred <= 0) continue;
    for (const [me, them] of [
      [r.a, r.b],
      [r.b, r.a],
    ] as const) {
      const was = rivals.get(me);
      if (!was || hatred > was.hatred || (hatred === was.hatred && them < was.rival))
        rivals.set(me, { hatred, rival: them, rel: relationRef(r.a, r.b) });
    }
  }
  for (const p of able) {
    const mine = rivals.get(p.ref);
    if (!mine) continue;
    const rival = realms.get(mine.rival);
    if (!rival || rival.ended !== null) continue;
    const ratio = strengthOf(ctx, rival) / Math.max(1, strengthOf(ctx, p)),
      rivalHolds = store.loadsOf(rival.ref, year) > 0,
      atWar = warsOf(world)
        .hotOf(p.ref)
        .some((w) => w.ended === null),
      chance = worksChance({ hatred: mine.hatred, ratio, rivalHolds, atWar, dread: s.dread }),
      draw = world.rng.real(CHOICE, keyOf(p.ref), t, 0);
    if (!(draw < chance)) continue;
    const machines = machinesOf(ctx, p),
      factors: Factor[] = [
        {
          name: `their rivalry with ${realmName(rival)}`,
          value: clampRegard(-mine.hatred),
          contribution: mine.hatred,
          source: { ref: mine.rel, role: "pressure", weight: 1 },
        },
        {
          name: "a stronger rival",
          value: clampRegard(ratio),
          contribution: ratio - 1,
          source: null,
        },
        {
          name: "the machines to pay for it",
          value: Math.round(machines),
          contribution: 0.5,
          source: null,
        },
        ...(rivalHolds
          ? [
              {
                name: `${realmName(rival)} holds it`,
                value: 1,
                contribution: 1,
                source: {
                  ref: store.worksOf(rival.ref)!.held!,
                  role: "trigger" as const,
                  weight: 1,
                },
              },
            ]
          : []),
      ],
      decision = world.decisions.record({
        rule: "fire.works",
        subject: p.ref,
        outcome: { against: rival.ref, ruler: p.ruler.name },
        score: chance,
        threshold: draw,
        factors,
      }),
      causes: CauseRef[] = [
        { ref: decision, role: "trigger", weight: 1 },
        { ref: lore.get(p.seat, FIRE_ID)!.event, role: "enabler", weight: 0.5 },
      ],
      event = world.events.emit({
        type: FIRE_EVENTS.begun.type,
        subjects: [p.ref],
        place: cellRef(0, p.seat),
        causes,
        data: {
          a: realmName(p),
          place: p.town,
          ruler: p.ruler.name,
          years: FIRE.worksYears,
          share: Math.round(FIRE.worksShare * 100),
        },
      });
    s.works.push({
      realm: p.ref,
      cell: p.seat,
      place: p.town,
      begun: year,
      done: null,
      paid: 0,
      event,
      held: null,
    });
  }
}

/** Wars going badly for a holder come to the brink; and two holders deep at odds, with no war between them. */
function brinks(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = fireOf(world),
    realms = politiesOf(world),
    year = yearOfMoment(t),
    holders = store.holders(),
    last = fireOf(world).state.crises.at(-1)?.year ?? -Infinity;
  if (!holders.length || year - last < FIRE.crisisQuiet) return;
  for (const h of holders) {
    const holder = realms.get(h.realm);
    if (!holder || holder.ended !== null || store.open().length) continue;
    for (const w of warsOf(world).hotOf(holder.ref)) {
      if (w.ended !== null || w.civil) continue;
      const side: 0 | 1 = w.attacker === holder.ref ? 0 : 1,
        foe = realms.get(side === 0 ? w.defender : w.attacker);
      if (!foe || foe.ended !== null) continue;
      const going = warGoing(ctx, w, side, holder);
      if (going < FIRE.crisisLine || !carrierOf(ctx, holder)) continue;
      open(ctx, holder, foe, w, going, t);
      break;
    }
  }
  // Two holders, deep at odds: the year comes when one moves too close to the other, with no war between them.
  const regard = diplomacyOf(world);
  for (let i = 0; i < holders.length; i++)
    for (let j = i + 1; j < holders.length; j++) {
      const a = realms.get(holders[i]!.realm),
        b = realms.get(holders[j]!.realm);
      if (!a || !b || a.ended !== null || b.ended !== null) continue;
      if (store.open().length) continue;
      const hatred = -(regard.get(a.ref, b.ref)?.opinion ?? 0);
      if (hatred < FIRE.brinkHatred) continue;
      const draw = world.rng.real(CHOICE, keyOf(a.ref) * 4096 + keyOf(b.ref), t, 2);
      if (draw < FIRE.brinkChance * Math.min(2, hatred)) open(ctx, a, b, null, 0.2, t);
    }
}

/** The greatest fire's year: at the end of the wars', before they are sealed. Nothing at all until a people knows it. */
export function fireYear(ctx: PopulationContext, t: SimTime): void {
  const year = yearOfMoment(t);
  skyYear(ctx, year);
  resolve(ctx, t);
  worksYear(ctx, t);
  brinks(ctx, t);
}

/** A ruler's word at the brink. */
export type FireAnswerArgs = {
  readonly realm: Ref;
  readonly ruler: string;
  readonly answer: "hold" | "loose";
};

/** Why a ruler's word at the brink would not hold (null: it would). */
export function fireAnswerProblem(world: World, args: unknown): string | null {
  const bad = rulerProblem(world, args);
  if (bad) return bad;
  const a = args as Partial<FireAnswerArgs>,
    c = fireOf(world).openFor(a.realm as Ref) ?? fireOf(world).farOpenFor(a.realm as Ref);
  if (a.answer !== "hold" && a.answer !== "loose") return "it is held or loosed";
  if (!c) return "no one stands at the brink";
  if (a.answer === "loose" && !c.war)
    return "no war stands between you: there is nothing to loose it for";
  const o = orderOf(world)?.of(a.realm as Ref);
  if (a.answer === "loose" && o && o.legitimacy < 0.3)
    return `Only ${Math.round(o.legitimacy * 100)} in a hundred hold your rule rightful: no one would turn the key.`;
  return null;
}

/** Teach a peopled world its greatest fire, and the word of a ruler, and of the god. */
export function installFire(world: World): FireStore {
  const store = world.register(new FireStore());
  world.addPinner(() => store.pinned());
  world.defineCommand({
    type: "fire.answer",
    validate: (args) => fireAnswerProblem(world, args),
    apply: (command) => {
      const a = command.args as FireAnswerArgs,
        c = store.openFor(a.realm) ?? store.farOpenFor(a.realm)!;
      c.answer = a.answer;
    },
  });
  const realmOf = (args: unknown): Polity | null => {
    const ref = (args as { realm?: unknown } | null)?.realm,
      p = typeof ref === "string" ? politiesOf(world).get(ref as Ref) : undefined;
    return p && p.ended === null ? p : null;
  };
  // The god's hand may give it or take it.
  world.defineCommand({
    type: "fire.give",
    validate: (args) => {
      const p = realmOf(args);
      if (!p) return "a realm is wanted";
      return store.worksOf(p.ref) ? "it has its great works already" : null;
    },
    apply: (command, t) => {
      const p = realmOf(command.args)!,
        year = yearOfMoment(t),
        event = world.events.emit({
          type: FIRE_EVENTS.given.type,
          subjects: [p.ref],
          place: cellRef(0, p.seat),
          causes: [{ ref: command.id, role: "agent", weight: 1 }],
          data: { a: realmName(p) },
        });
      store.state.works.push({
        realm: p.ref,
        cell: p.seat,
        place: p.town,
        begun: year,
        done: year,
        paid: 0,
        event,
        held: event,
        given: true,
      });
    },
  });
  world.defineCommand({
    type: "fire.take",
    validate: (args) => {
      const p = realmOf(args);
      if (!p) return "a realm is wanted";
      return store.worksOf(p.ref) ? null : "it has none to take";
    },
    apply: (command, t) => {
      const p = realmOf(command.args)!;
      world.events.emit({
        type: FIRE_EVENTS.taken.type,
        subjects: [p.ref],
        place: cellRef(0, p.seat),
        causes: [{ ref: command.id, role: "agent", weight: 1 }],
        data: { a: realmName(p) },
      });
      store.worksOf(p.ref)!.gone = yearOfMoment(t);
    },
  });
  return store;
}
