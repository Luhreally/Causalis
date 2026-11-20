// The great stones in play (the Frontier lane; the rules are rules/impacts.ts, the small stones sim/acts/wild.ts). Each
// year the stones that will fall a century on are drawn, by the year they fall (so a world stepped a thousand years at
// once draws the same stones as one stepped year by year): how often its system's age, its giant and its comet cloud say.
// A realm that watches its sky (a satellite up, and the reckoning to follow what it sees) finds a stone as many years
// before it falls as its width allows, and one that can reach it turns it aside, if its machines will pay for the craft
// the nudge needs with the years left. A stone not turned falls: what stands within its reach comes down and its people
// die, the more near its middle; in a sea, its wave runs up the coasts for ten times as far; past some hundred thousand
// megatons its dust and its fires' soot darken the whole sky for years (its fields and rain under it: frontierFields,
// frontierRain), and the greatest burn the sky itself. A few stones a chronicle at most; nothing grows with history.
import {
  YEAR,
  Hasher,
  dmath,
  defineEventType,
  defineStream,
  yearOfMoment,
  type CauseRef,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { LOCAL_DENSITY, cellRef, type HomeWorld } from "../../gen/index.ts";
import {
  FIRE,
  IMPACT,
  IMPACTS,
  burningSky,
  fieldsUnder,
  leadYears,
  rainUnder,
  showerChance,
  strikeChance,
  strikeDead,
  strikeDust,
  strikeMt,
  strikeRate,
  strikeReachKm,
  turningTonnes,
  type ImpactClass,
} from "../../rules/index.ts";
import { knows } from "../lore/lore.ts";
import { politiesOf } from "../polity/polity.ts";
import { homePlanet } from "../planet/store.ts";
import { actsOf } from "../acts/acts.ts";
import { deathsIn, raze, spill, strike } from "../acts/disasters.ts";
import type { PopulationContext } from "../population/systems.ts";
import {
  MACHINES_PER_COST,
  launcherOfRealm,
  machinesOfRealm,
  spaceOf,
  spendMachines,
} from "../space/space.ts";
import { fold, homeLands } from "./common.ts";
import { rogueStir } from "./galactic.ts";

export const IMPACT_EVENTS = {
  /** A stone or comet found on its way to the world. */
  found: defineEventType("frontier.stone-found", 5),
  /** One turned aside. */
  turned: defineEventType("frontier.stone-turned", 6),
  /** One that fell. */
  struck: defineEventType("frontier.stone-struck", 6),
  /** The sky darkened by a strike's dust and soot. */
  dark: defineEventType("frontier.dark-sky", 6),
};

const IMPACTS_STREAM = defineStream("frontier.impacts");

/** How many years ahead the stones are drawn (the longest any watched sky finds one before it falls). */
export const LOOK_AHEAD = IMPACT.leadMost;
/** Stones that fell or were turned, kept. */
export const STONES_KEPT = 16;

export type Stone = {
  /** The year it falls, its class, its width (m), whether a comet, and the land it falls on. */
  readonly year: number;
  readonly cls: ImpactClass["id"];
  readonly metres: number;
  readonly comet: boolean;
  readonly cell: number;
  /** Who found it and when (null: none yet), who turned it, and its fall. */
  found: Ref | null;
  foundBy: Ref | null;
  foundYear: number | null;
  turned: Ref | null;
  struck: Ref | null;
  /** What it did, where it fell: megatons, dead, lands. */
  mt: number;
  dead: number;
  lands: number;
};

export type ImpactState = {
  /** The last year whose stones are drawn. */
  drawnTo: number;
  /** The dust and soot in the high air now (as the great fire's soot), and its dark years' event. */
  dust: number;
  dark: Ref | null;
  /** All told: stones fallen, turned, the dead. */
  fell: number;
  turned: number;
  dead: number;
};

const firstState = (): ImpactState => ({
  drawnTo: -1,
  dust: 0,
  dark: null,
  fell: 0,
  turned: 0,
  dead: 0,
});

export class ImpactStore implements StateStore {
  readonly name = "frontier.impacts";
  state: ImpactState = firstState();
  stones: Stone[] = [];
  private readonly digest: [number, number] = [0x811c9dc5, 0];

  dormant(): boolean {
    return !this.stones.length && this.state.dust === 0;
  }
  note(xs: readonly number[]): void {
    fold(this.digest, xs);
  }
  pinned(): Ref[] {
    const out: Ref[] = [];
    if (this.state.dark) out.push(this.state.dark);
    for (const s of this.stones) for (const r of [s.found, s.turned, s.struck]) if (r) out.push(r);
    return out;
  }
  hashInto(h: Hasher): void {
    if (this.dormant()) return;
    h.value(this.state).value(this.stones).int(this.digest[0]).int(this.digest[1]);
  }
  save(): unknown {
    if (this.dormant() && this.state.drawnTo < 0) return {};
    return { state: this.state, stones: this.stones, digest: [...this.digest] };
  }
  load(state: unknown): void {
    const s = (state ?? {}) as { state?: ImpactState; stones?: Stone[]; digest?: [number, number] };
    this.state = { ...firstState(), ...s.state };
    this.stones = (s.stones ?? []).map((x) => ({ ...x }));
    this.digest[0] = s.digest?.[0] ?? 0x811c9dc5;
    this.digest[1] = s.digest?.[1] ?? 0;
  }
  /** Keep the done stones to their bound, the oldest first to go. */
  trim(): void {
    const done = this.stones.filter((s) => s.turned || s.struck);
    if (done.length <= STONES_KEPT) return;
    const drop = new Set(done.slice(0, done.length - STONES_KEPT));
    this.stones = this.stones.filter((s) => !drop.has(s));
  }
}

export function impactsOf(world: World): ImpactStore | null {
  return world.peek<ImpactStore>("frontier.impacts") ?? null;
}

// —— The home system's sky ————————————————————————————————————————————————————————————————————————

/** Whether a giant past the home star's frost line stirs its belt. */
export function stirredOf(g: HomeWorld): boolean {
  return g.system.bodies.some(
    (b) => b.kind === "giant" && b.orbit.around === g.star.ref && b.orbit.a > g.system.frostLine,
  );
}

/** Whether a comet shower falls on the home system now: a star passed close within two million years (keyed on the world). */
export function showerOf(world: World): boolean {
  return world.rng.real(IMPACTS_STREAM, 0, 0, 9) < showerChance(LOCAL_DENSITY);
}

/** How much more the home world is struck than an Earth now, in a year. */
export function homeStrikeRate(world: World, year: number): number {
  const g = homePlanet(world).generated;
  // (And a rogue world's pass, while its stirring presses: galactic.ts.)
  return (
    strikeRate(g.star.ageGyr + Math.max(0, year) / 1e9, stirredOf(g), showerOf(world)) *
    rogueStir(world, year)
  );
}

/** The share of the great stones that are comets on this sky. */
function cometShare(world: World): number {
  const k = IMPACT,
    g = homePlanet(world).generated,
    stones = (1 - k.comets) * (stirredOf(g) ? 1 : k.unstirred),
    comets = k.comets * (showerOf(world) ? k.showerTimes : 1);
  return comets / (stones + comets);
}

/** The stone that falls in a year, if one does (the greatest of its classes drawn). Pure of the year. */
export function stoneOf(world: World, year: number): Stone | null {
  const g = homePlanet(world).generated,
    rate = homeStrikeRate(world, year);
  for (let i = IMPACTS.length - 1; i >= 0; i--) {
    const cls = IMPACTS[i]!;
    if (!(world.rng.real(IMPACTS_STREAM, year, 1, i) < strikeChance(cls, rate, 1))) continue;
    const comet = world.rng.real(IMPACTS_STREAM, year, 2, i) < cometShare(world),
      // (A width about its class's: from two thirds of it to half again.)
      metres = Math.round(cls.metres * (0.67 + 0.83 * world.rng.real(IMPACTS_STREAM, year, 3, i))),
      cell = Math.floor(world.rng.real(IMPACTS_STREAM, year, 4, i) * homeLands(g));
    return {
      year,
      cls: cls.id,
      metres,
      comet,
      cell,
      found: null,
      foundBy: null,
      foundYear: null,
      turned: null,
      struck: null,
      mt: 0,
      dead: 0,
      lands: 0,
    };
  }
  return null;
}

/** What the strikes' dust leaves of a land's fields, and of its rain (exactly 1 under a clear sky). */
export function dustFields(world: World): number {
  const d = impactsOf(world)?.state.dust ?? 0;
  return d > 0 ? fieldsUnder(d) : 1;
}
export function dustRain(world: World): number {
  const d = impactsOf(world)?.state.dust ?? 0;
  return d > 0 ? rainUnder(d) : 1;
}

// —— The year ———————————————————————————————————————————————————————————————————————————————————————

/** Who watches the sky, finds what is coming, and turns it if it can. */
function watch(ctx: PopulationContext, store: ImpactStore, stone: Stone, year: number): void {
  const world = ctx.world,
    g = homePlanet(world).generated,
    left = stone.year - year;
  if (stone.turned || left < 0) return;
  const space = spaceOf(world),
    watchers = politiesOf(world)
      .living()
      .filter(
        (p) =>
          !!space.of(p.ref)?.satellite &&
          knows(ctx, p.seat, "orbital-flight") &&
          knows(ctx, p.seat, "computing"),
      );
  if (!watchers.length) return;
  if (!stone.found) {
    if (left > leadYears(stone.metres, stone.comet)) return;
    const by = watchers[0]!;
    stone.found = world.events.emit({
      type: IMPACT_EVENTS.found.type,
      subjects: [by.ref],
      place: cellRef(0, stone.cell),
      causes: [{ ref: space.of(by.ref)!.satellite!, role: "enabler", weight: 1 }],
      data: { realm: by.town, metres: stone.metres, comet: stone.comet, falls: stone.year, left },
    });
    stone.foundBy = by.ref;
    stone.foundYear = year;
    store.note([stone.year, year, 1]);
  }
  // Those able to reach it: a launcher, guidance; the craft's weight by the years left.
  const radiusKm = 6371 * g.planet.radius;
  for (const p of watchers) {
    if (!knows(ctx, p.seat, "guidance")) continue;
    const launcher = launcherOfRealm(ctx, p);
    if (!launcher) continue;
    const fire = knows(ctx, p.seat, "greatest-fire"),
      tonnes = turningTonnes(stone.metres, stone.comet, Math.max(0.1, left), radiusKm, fire),
      cost = launcher.cost * tonnes * MACHINES_PER_COST * IMPACT.pastOrbit,
      machines = machinesOfRealm(ctx, p);
    if (machines * 0.5 < cost) continue;
    spendMachines(ctx, p, cost);
    const decision = world.decisions.record({
      rule: "frontier.turn-stone",
      subject: p.ref,
      outcome: { tonnes: Math.round(tonnes), fire },
      score: machines,
      threshold: cost * 2,
      factors: [
        {
          name: `a stone ${stone.metres} m wide${stone.comet ? ", a comet" : ""}, ${left} years from falling`,
          value: stone.metres,
          contribution: 1,
          source: { ref: stone.found!, role: "trigger", weight: 1 },
        },
        {
          name: `a craft of ${Math.round(tonnes)} tonnes to nudge it by its world's girth${fire ? ", the greatest fire set off beside it" : ""}`,
          value: tonnes,
          contribution: 0.6,
          source: { ref: p.ref, role: "agent", weight: 1 },
        },
      ],
    });
    stone.turned = world.events.emit({
      type: IMPACT_EVENTS.turned.type,
      importance: stone.cls === "regional" ? 5 : 7,
      subjects: [p.ref],
      place: cellRef(0, stone.cell),
      causes: [
        { ref: decision, role: "trigger", weight: 1 },
        { ref: stone.found!, role: "enabler", weight: 1 },
      ],
      data: {
        realm: p.town,
        metres: stone.metres,
        comet: stone.comet,
        tonnes: Math.round(tonnes),
        cost: Math.round(cost),
      },
    });
    store.state.turned++;
    store.note([stone.year, year, 2]);
    return;
  }
}

/** A stone falls. */
function fall(ctx: PopulationContext, store: ImpactStore, stone: Stone, t: SimTime): void {
  const world = ctx.world,
    g = homePlanet(world).generated,
    year = yearOfMoment(t),
    home = g.system.bodies[0]!,
    mt = strikeMt(stone.metres, stone.comet, home.escape),
    reach = strikeReachKm(mt),
    elevation = g.tectonics.elevation,
    sea = !(elevation[stone.cell]! > 0),
    P = g.grid.positions,
    R = 6371 * g.planet.radius,
    base = homeLands(g),
    c0 = stone.cell,
    burning = burningSky(mt);
  let dead = 0,
    lands = 0;
  const coast = (c: number) => {
    if (!(elevation[c]! > 0)) return false;
    for (let k = g.grid.offsets[c]!; k < g.grid.offsets[c + 1]!; k++)
      if (!(elevation[g.grid.neighbours[k]!]! > 0)) return true;
    return false;
  };
  for (const p of ctx.provinces.all()) {
    const c = p.cell;
    if (c >= base || p.total() <= 0) continue;
    const dot =
        P[3 * c]! * P[3 * c0]! + P[3 * c + 1]! * P[3 * c0 + 1]! + P[3 * c + 2]! * P[3 * c0 + 2]!,
      km = R * dmath.acos(dmath.clamp(dot, -1, 1));
    let share = c === c0 && !sea ? IMPACT.deadAtMiddle : strikeDead(km, reach, false);
    if (sea && coast(c)) share = Math.max(share, strikeDead(km, reach, true));
    if (share > 0.001) {
      raze(ctx, c, Math.min(0.9, share * 1.2), t);
      spill(ctx, c, Math.min(0.9, share));
      dead += deathsIn(ctx, c, Math.floor(p.total() * share), t);
      lands++;
    }
    if (burning > 0) dead += strike(ctx, c, burning, t);
  }
  const causes: CauseRef[] = [{ ref: g.planet.ref as Ref, role: "enabler", weight: 1 }];
  if (stone.found) causes.push({ ref: stone.found, role: "trigger", weight: 0.5 });
  stone.struck = world.events.emit({
    type: IMPACT_EVENTS.struck.type,
    importance: stone.cls === "regional" ? (dead > 0 ? 6 : 4) : 7,
    place: cellRef(0, c0),
    causes,
    data: {
      cls: stone.cls,
      metres: stone.metres,
      comet: stone.comet,
      mt: Math.round(mt),
      reach: Math.round(reach),
      sea,
      dead,
      lands,
      seen: !!stone.found,
    },
  });
  stone.mt = Math.round(mt);
  stone.dead = dead;
  stone.lands = lands;
  if (!sea && stone.metres >= 300) actsOf(world).addCrater({ cell: c0, year, event: stone.struck });
  const s = store.state;
  s.fell++;
  s.dead += dead;
  s.dust = Math.min(1, s.dust + strikeDust(mt));
  if (!s.dark && s.dust >= FIRE.sootTold)
    s.dark = world.events.emit({
      type: IMPACT_EVENTS.dark.type,
      importance: 7,
      place: cellRef(0, c0),
      causes: [{ ref: stone.struck, role: "trigger", weight: 1 }],
      data: { dust: Math.round(s.dust * 1000) / 1000 },
    });
  store.note([stone.year, Math.round(mt), dead, lands]);
}

/** A year of the great stones: drawn a century ahead, watched for, turned or fallen; the dust settling. */
export function impactsYear(ctx: PopulationContext, t: SimTime): void {
  const world = ctx.world,
    store = impactsOf(world);
  if (!store) return;
  const year = yearOfMoment(t),
    s = store.state;
  // (The first year draws the century ahead; each year after, the year a century on. A span stepped at once draws its years.)
  for (let y = Math.max(year, s.drawnTo + 1); y <= year + LOOK_AHEAD; y++) {
    const stone = stoneOf(world, y);
    if (stone) {
      store.stones.push(stone);
      store.note([y, stone.metres, stone.cell]);
    }
  }
  s.drawnTo = Math.max(s.drawnTo, year + LOOK_AHEAD);
  // The dust of the years before settles.
  if (s.dust > 0) {
    s.dust *= IMPACT.dustKept;
    if (s.dust < FIRE.sootTold / 4) s.dust = 0;
    if (s.dark && s.dust < FIRE.sootTold) s.dark = null;
  }
  for (const stone of store.stones) {
    if (stone.turned || stone.struck) continue;
    // (A stone whose year a deep-time step passed over fell then, unseen.)
    if (stone.year > year) watch(ctx, store, stone, year);
    else if (!stone.turned) fall(ctx, store, stone, t);
  }
  store.trim();
}

/** Teach a world its great stones. */
export function installImpacts(world: World, ctx: () => PopulationContext): ImpactStore {
  const store = world.register(new ImpactStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "207.frontier.impacts", every: YEAR, run: (t) => impactsYear(ctx(), t) });
  return store;
}
