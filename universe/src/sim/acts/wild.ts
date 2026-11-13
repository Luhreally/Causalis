// The world acting on its own (N1, Classic 17, 46 and 73). The ground shakes where a world's own plates meet; a mountain goes up where
// they go under; lightning from a land's own weather lights a dry year's woods, and a fire crosses what can burn; a stone falls from its
// sky. Each is an event history keeps, with causes that can be followed, and what it does to a town it does through the god's own strike
// (acts/disasters.ts, acts/local.ts: the same events, `natural` in their data and no hand among their causes), lot by lot, so everything
// that already follows a strike (a town's page, its brigades, its dead buried, a stone raised, a song) follows these. A ruler answers,
// or is seen not to. No draw is taken unless a thing is due: a whole year costs one count of each, and a look at each land once a year.
// Read a world's worst before changing a rate: tools/n1-tally.ts.
import { switchedOff } from "./switches.ts";
import {
  DAY,
  MONTH,
  YEAR,
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
import {
  BIOME,
  BIOME_NAMES,
  BOUNDARY,
  cellRef,
  isProvinceWorld,
  meansNumbers,
  offworldSite,
  regionPoint,
  windAt,
  worldKindOf,
  type ProvinceWorld,
} from "../../gen/index.ts";
import {
  G,
  KIND_ROCKS,
  NATURE,
  STARS,
  answerChance,
  countOf,
  crossDays,
  dryness,
  faultRate,
  fireHomes,
  flashesOf,
  kindBurns,
  litChance,
  magnitudeOf,
  natureImportance,
  reachesGround,
  shakeAt,
  shakeShares,
  skyRate,
  spreadChance,
  stakesOf,
  type FaultKind,
  type StarClass,
} from "../../rules/index.ts";
import { ecologyOf, firstForest, wildsOf } from "../ecology/ecology.ts";
import { woodsBurned, woodsStanding } from "../ecology/woods.ts";
import type { MarketStore } from "../economy/market.ts";
import { capacityOf, orderOf } from "../order/order.ts";
import { homePlanet } from "../planet/store.ts";
import { surfaceBiome } from "../planet/surface.ts";
import { politiesOf, realmName } from "../polity/polity.ts";
import { REGION_SIZE, PROVINCE_TILE_KM, type PopulationContext } from "../population/systems.ts";
import type { Settlement } from "../population/stores.ts";
import { townsOf } from "../town/fabric.ts";
import { landSpare } from "../war/bonds.ts";
import { lessened } from "../lore/lessons-store.ts";
import { actsOf } from "./acts.ts";
import { DISASTER, DISASTER_EVENTS, deathsIn, grieve, razeOne, spill } from "./disasters.ts";
import { LOCAL_ACT_EVENTS } from "./local.ts";

export const UNBIDDEN_EVENTS = {
  /** A fire on the land: its size is told, the towns it reached each their own `act.fire`. */
  fire: defineEventType("wild.fire", 3),
  /** A new mountain. */
  rise: defineEventType("wild.rise", 5),
  /** A stone from the sky seen, whether or not it struck anyone. */
  star: defineEventType("wild.star", 3),
  /** What a ruler did about it. */
  answer: defineEventType("wild.answer", 4),
};

const QUAKES = defineStream("wild.quakes");
const FIRES = defineStream("wild.fires");
const SKY = defineStream("wild.sky");
const RISES = defineStream("wild.rises");
const ANSWERS = defineStream("wild.answers");

/** A fire's scar, while it lasts: what the land draws of it, and what a page tells. */
export type Wildfire = {
  readonly event: Ref;
  readonly year: number;
  /** The moment it lit. */
  readonly from: number;
  /** The moment the last of it burned out, and the moment its ground has grown back. */
  readonly until: number;
  readonly gone: number;
  /** The land it lit in, and every land it crossed. */
  readonly cell: number;
  readonly lands: readonly number[];
  /** The patches of the fine grid it took, in order, and the day it reached each. */
  readonly patches: readonly number[];
  readonly days: readonly number[];
};

/** How many of each have come, and how many have died of them, for ever (a world's own total: small ones leave the log). */
export type WildTally = {
  quakes: number;
  quakeDead: number;
  fires: number;
  fireDead: number;
  burnedKm2: number;
  townsBurned: number;
  homesLost: number;
  stars: number;
  starDead: number;
  rises: number;
  answered: number;
  failed: number;
};

const emptyTally = (): WildTally => ({
  quakes: 0,
  quakeDead: 0,
  fires: 0,
  fireDead: 0,
  burnedKm2: 0,
  townsBurned: 0,
  homesLost: 0,
  stars: 0,
  starDead: 0,
  rises: 0,
  answered: 0,
  failed: 0,
});

/** What can burn, by its land's cover, and how long it takes to grow back (years, Fire ecology): none of it in sea, ice or bare ground. */
const FUEL: Readonly<Record<number, readonly [number, number]>> = {
  [BIOME.borealForest]: [0.85, 70],
  [BIOME.temperateForest]: [0.7, 60],
  [BIOME.temperateRainforest]: [0.32, 90],
  [BIOME.tropicalDryForest]: [0.85, 30],
  [BIOME.tropicalRainforest]: [0.22, 60],
  [BIOME.savanna]: [0.8, 5],
  [BIOME.steppe]: [0.45, 4],
  [BIOME.tundra]: [0.12, 30],
};
const fuelOf = (biome: number): number => FUEL[biome]?.[0] ?? 0;

/** What a world holds for all this, read once: never part of its state. */
type Index = {
  /** The lands with a chance of a shock, by a running total of their rates. */
  readonly faults: Int32Array;
  readonly upTo: Float64Array;
  /** How many shocks a year in all. */
  readonly shocks: number;
  /** Where a mountain may go up. */
  readonly cones: readonly number[];
  /** The lands with something to burn, by the month each is looked at (a twelfth of them in each). */
  readonly burnable: readonly (readonly number[])[];
  /** What its air gives a flame (0: nothing burns here). */
  readonly air: number;
  /** A patch of ground, in km². */
  readonly patchKm2: number;
  /** How much of its sky it has beyond an Earth's, and its air (bar). */
  readonly sky: number;
  readonly airBar: number;
};

function faultKind(boundary: number): FaultKind {
  return boundary === BOUNDARY.convergent
    ? "convergent"
    : boundary === BOUNDARY.transform
      ? "transform"
      : boundary === BOUNDARY.divergent
        ? "divergent"
        : "within";
}

/** Fine grid's patches of a land, and the fine patch nearest a point. */
function patchNear(g: ProvinceWorld, cell: number, p: readonly [number, number, number]): number {
  const P = g.fine.grid.positions;
  let best = -1,
    most = -Infinity;
  for (let k = g.childOffsets[cell]!; k < g.childOffsets[cell + 1]!; k++) {
    const c = g.children[k]!,
      d = P[3 * c]! * p[0] + P[3 * c + 1]! * p[1] + P[3 * c + 2]! * p[2];
    if (d > most) {
      most = d;
      best = c;
    }
  }
  return best;
}

function readWorld(g: ProvinceWorld): Index {
  const t = g.tectonics,
    n = g.offworld.base,
    lid = g.planet.plateCount < NATURE.quake.leastPlates,
    cells: number[] = [],
    rates: number[] = [],
    cones: number[] = [],
    hot = new Set(t.hotspots.map((c) => g.provinceOf[c]!));
  for (let c = 0; c < n; c++) {
    if (lid) break;
    const kind = faultKind(t.boundary[c]!),
      own = t.plates[t.plate[c]!]?.speed ?? NATURE.quake.plateSpeed,
      other = t.across[c]! >= 0 ? (t.plates[t.across[c]!]?.speed ?? own) : own,
      rate = faultRate(kind, t.toBoundary[c]!, (own + other) / 2);
    cells.push(c);
    rates.push(rate);
    if (
      t.elevation[c]! > 0 &&
      ((t.boundary[c] === BOUNDARY.convergent && t.toBoundary[c]! <= 3) || hot.has(c))
    )
      cones.push(c);
  }
  const upTo = new Float64Array(cells.length);
  let sum = 0;
  rates.forEach((r, i) => {
    sum += r;
    upTo[i] = sum;
  });
  const burnable: number[][] = Array.from({ length: 12 }, () => []);
  for (let c = 0; c < n; c++) {
    if (g.tectonics.elevation[c]! <= 0) continue;
    let fuel = 0;
    for (let k = g.childOffsets[c]!; k < g.childOffsets[c + 1]! && fuel <= 0; k++)
      fuel = fuelOf(g.fine.climate.biome[g.children[k]!]!);
    if (fuel > 0) burnable[c % 12]!.push(c);
  }
  const numbers = meansNumbers(g),
    // Read off its air and its kind: free oxygen to burn with, thin air burning slower.
    air =
      numbers.freeOxygen && kindBurns(worldKindOf(g))
        ? Math.min(1, Math.max(0.25, numbers.airBar))
        : 0,
    R = 6371 * g.planet.radius;
  return {
    faults: Int32Array.from(cells),
    upTo,
    shocks: sum,
    cones,
    burnable,
    air,
    patchKm2: (4 * Math.PI * R * R) / g.fine.grid.count,
    sky: skyRate(g.star.ageGyr, g.system.bodies.length),
    airBar: numbers.airBar,
  };
}

export class WildStore implements StateStore {
  readonly name = "acts.wild";
  /** Fires whose scars still stand, oldest first. */
  scars: Wildfire[] = [];
  tally: WildTally = emptyTally();
  /** Read from the world's own ground once, not state. */
  index: Index | null = null;

  dormant(): boolean {
    return (
      !this.scars.length &&
      !this.tally.quakes &&
      !this.tally.fires &&
      !this.tally.stars &&
      !this.tally.rises
    );
  }
  hashInto(h: Hasher): void {
    if (!this.dormant()) h.value({ scars: this.scars, tally: this.tally });
  }
  save(): unknown {
    return { scars: this.scars, tally: this.tally };
  }
  load(state: unknown): void {
    const s = (state ?? {}) as { scars?: Wildfire[]; tally?: Partial<WildTally> };
    this.scars = (s.scars ?? []).map((f) => ({ ...f }));
    this.tally = { ...emptyTally(), ...s.tally };
  }
  pinned(): Ref[] {
    return this.scars.map((s) => s.event);
  }
  /** The fires still scarring a land. */
  on(cell: number): Wildfire[] {
    return this.scars.filter((s) => s.lands.includes(cell));
  }
}

export function wildOf(world: World): WildStore | null {
  return world.hasStore("acts.wild") ? world.store<WildStore>("acts.wild") : null;
}

const key = (ref: Ref): number => Number(ref.split(":")[2]) || 0;

/** The world's people, for what a great loss is against them: only when one has come. */
function worldPeople(ctx: PopulationContext): number {
  let n = 0;
  for (const p of ctx.provinces.all()) n += p.total();
  return n;
}

/** A tile's distance from another of a land's (km). */
function tilesKm(a: number, b: number): number {
  const dx = (a % REGION_SIZE) - (b % REGION_SIZE),
    dy = Math.floor(a / REGION_SIZE) - Math.floor(b / REGION_SIZE);
  return Math.sqrt(dx * dx + dy * dy) * PROVINCE_TILE_KM;
}

const standing = (ctx: PopulationContext, cell: number): readonly Settlement[] =>
  ctx.settlements.inProvince(cell).filter((v) => v.population > 0 || townsOf(ctx.world).get(v.ref));

/** What fell on a land did this much: its people's dead, its towns' homes (by town), its blocks, its worst place's strength. */
type Struck = { dead: number; blocks: number; homes: Record<string, number>; worst: number };

/** A shock's strength at each town of a land, and at its countryside: what the god's own quake does, by that share. */
function shakeLand(
  ctx: PopulationContext,
  cell: number,
  mag: number,
  kmOf: (v: Settlement) => number,
  t: SimTime,
): Struck {
  const prov = ctx.provinces.get(cell),
    q = NATURE.quake,
    homes: Record<string, number> = {},
    // (What its machines have built stands up to more: 20,000 of tens of millions in the greatest quake of a machine age, a fifth of a mud-brick town in a lesser one.)
    built = (ctx.world.store<MarketStore>("economy.markets").get(cell)?.machineCover ?? 0) / 1000,
    // (And what its people have learned of quakes, their own and their neighbours': exactly 1 where they have learned nothing.)
    learned = lessened(ctx.world, cellRef(0, cell), "quake", yearOfMoment(t)),
    spared = (1 - q.builtSpares * built) * learned,
    stands = (1 - q.builtStands * built) * learned;
  let dead = 0,
    blocks = 0,
    worst = 0,
    inTowns = 0;
  for (const v of standing(ctx, cell)) {
    const h = shakeAt(mag, kmOf(v));
    inTowns += v.population;
    if (h < q.felt) continue;
    const s = shakeShares(h, DISASTER.quake);
    worst = Math.max(worst, h);
    blocks += razeOne(ctx, v, s.homes * stands, t, homes);
    dead += Math.round(v.population * s.dead * spared);
  }
  const rest = Math.max(0, (prov?.total() ?? 0) - inTowns),
    h = shakeAt(mag, q.countryKm);
  if (h >= q.felt) {
    dead += Math.round(rest * shakeShares(h, DISASTER.quake).dead * q.countryside * spared);
    worst = Math.max(worst, h);
  }
  const fell = dead > 0 ? deathsIn(ctx, cell, dead, t) : 0;
  if (worst > 0) spill(ctx, cell, shakeShares(worst, DISASTER.quake).stores * 0.5);
  return { dead: fell, blocks, homes, worst };
}

const homesIn = (s: Struck): number => Object.values(s.homes).reduce((a, b) => a + b, 0);

/** What a ruler does about what befell a land (a real act, by its stores and its reach), and what its people make of it. */
function answer(
  ctx: PopulationContext,
  cell: number,
  event: Ref,
  dead: number,
  what: "quake" | "fire" | "star",
  town: string,
  t: SimTime,
): void {
  const { world } = ctx,
    a = NATURE.answer;
  if (dead < a.leastDead) return;
  const p = politiesOf(world).of(cell);
  if (!p || p.ended !== null) return;
  const o = orderOf(world)?.of(p.ref),
    prov = ctx.provinces.get(cell),
    left = prov?.total() ?? 0,
    need = Math.max(1, Math.round((left * a.months) / 12)),
    capacity = capacityOf(ctx, p).value,
    // What the rest of the realm has laid by, the seat's first.
    spare = [p.seat, ...p.members.filter((c) => c !== p.seat && c !== cell)]
      .slice(0, 12)
      .reduce((n, c) => n + landSpare(ctx, c), 0),
    chance = answerChance(capacity, spare / need),
    draw = world.rng.real(ANSWERS, cell, t, key(event)),
    answered = draw < chance,
    stakes = stakesOf(dead),
    factors: Factor[] = [
      {
        name: "how far the realm's hand reaches",
        value: Math.round(capacity * 100) / 100,
        contribution: capacity,
        source: null,
      },
      {
        name: "what it had laid by",
        value: Math.round(spare),
        contribution: Math.min(1, spare / need),
        source: null,
      },
    ],
    decision = world.decisions.record({
      rule: "wild.answer",
      subject: p.ref,
      outcome: { answered, ruler: p.ruler.name },
      score: chance,
      threshold: draw,
      factors,
    });
  let sent = 0;
  if (answered) {
    const markets = world.store<MarketStore>("economy.markets"),
      into = markets.get(cell);
    let wanted = need;
    if (into)
      for (const c of [p.seat, ...p.members.filter((x) => x !== p.seat && x !== cell)].slice(
        0,
        12,
      )) {
        if (wanted <= 0) break;
        const out = markets.get(c),
          n = Math.min(wanted, landSpare(ctx, c));
        if (!out || n <= 0 || c === cell) continue;
        into.move("in", G.grain, out.move("out", G.grain, n));
        sent += n;
        wanted -= n;
      }
  }
  const moved = answered ? a.won * stakes : -a.lost * stakes;
  if (o) o.legitimacy = Math.max(0.02, Math.min(0.98, o.legitimacy + moved));
  const done = world.events.emit({
    type: UNBIDDEN_EVENTS.answer.type,
    importance: Math.max(3, natureImportance(dead, worldPeople(ctx)) - 1),
    subjects: [p.ref],
    place: cellRef(0, cell),
    causes: [
      { ref: event, role: "trigger", weight: 1 },
      { ref: decision, role: "agent", weight: 1 },
    ],
    data: {
      a: realmName(p),
      ruler: p.ruler.name,
      answered,
      grain: Math.round(sent),
      town,
      what,
      dead,
      standing: Math.round(moved * 1000) / 1000,
    },
  });
  // (Help that came is grief eased; none coming is another grief.)
  const realms = politiesOf(world),
    d = realms.discontent(cell);
  if (answered)
    realms.setDiscontent(cell, {
      level: Math.max(0, d.level - a.eased * stakes),
      cause: d.cause ?? done,
    });
  else grieve(world, cell, 0.2 * stakes, done);
  const tally = wildOf(world)!.tally;
  if (answered) tally.answered++;
  else tally.failed++;
}

/** The month's shocks: how many are due in all the world's faults, and for each one due, where. Most fall where no one is. */
function quakesMonth(ctx: PopulationContext, g: ProvinceWorld, idx: Index, t: SimTime): void {
  if (!idx.faults.length) return;
  const { world } = ctx,
    n = countOf(idx.shocks / 12, world.rng.real(QUAKES, 0, t, 0));
  for (let i = 0; i < n; i++) {
    const at = world.rng.real(QUAKES, 1, t, i) * idx.shocks;
    let lo = 0,
      hi = idx.upTo.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (idx.upTo[mid]! < at) lo = mid + 1;
      else hi = mid;
    }
    const cell = idx.faults[lo]!,
      prov = ctx.provinces.get(cell);
    if (!prov || prov.total() <= 0) continue;
    const kind = faultKind(g.tectonics.boundary[cell]!),
      steps = g.tectonics.toBoundary[cell]!,
      // (Too far from the meeting to count as on it: a shock within the plate, and as great as one can be.)
      felt: FaultKind = kind !== "within" && steps <= 6 ? kind : "within",
      mag = magnitudeOf(world.rng.real(QUAKES, 2, t, i), NATURE.quake.most[felt]),
      middle = Math.floor(world.rng.real(QUAKES, 3, t, i) * REGION_SIZE * REGION_SIZE),
      struck = shakeLand(ctx, cell, mag, (v) => tilesKm(v.tile, middle), t);
    if (struck.dead <= 0 && homesIn(struck) <= 0) continue;
    tellQuake(ctx, g, cell, mag, felt, middle, struck, t);
  }
}

function tellQuake(
  ctx: PopulationContext,
  g: ProvinceWorld,
  cell: number,
  mag: number,
  felt: FaultKind,
  middle: number,
  struck: Struck,
  t: SimTime,
): void {
  const { world } = ctx,
    tec = g.tectonics,
    own = tec.plates[tec.plate[cell]!],
    other = tec.across[cell]! >= 0 ? tec.plates[tec.across[cell]!] : undefined,
    prov = ctx.provinces.get(cell)!,
    towns = Object.entries(struck.homes).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)),
    worstTown = towns[0] ? ctx.settlements.get(towns[0][0] as Ref) : undefined,
    causes: CauseRef[] = [
      ...(other ? [{ ref: other.ref as Ref, role: "trigger" as const, weight: 1 }] : []),
      ...(own
        ? [
            {
              ref: own.ref as Ref,
              role: other ? ("enabler" as const) : ("trigger" as const),
              weight: 0.6,
            },
          ]
        : []),
    ],
    event = world.events.emit({
      type: DISASTER_EVENTS.quake.type,
      importance: natureImportance(struck.dead, worldPeople(ctx)),
      subjects: [prov.ref],
      place: prov.ref,
      causes,
      data: {
        natural: true,
        mag,
        kind: felt,
        ...(own ? { plate: own.index } : {}),
        ...(other ? { across: other.index } : {}),
        steps: tec.toBoundary[cell]!,
        middle,
        dead: struck.dead,
        blocks: struck.blocks,
        homes: struck.homes,
        town: worstTown?.name ?? null,
      },
    }),
    tally = wildOf(world)!.tally;
  tally.quakes++;
  tally.quakeDead += struck.dead;
  tally.homesLost += homesIn(struck);
  grieve(world, cell, shakeShares(struck.worst, DISASTER.quake).grief, event);
  answer(ctx, cell, event, struck.dead, "quake", worstTown?.name ?? "", t);
  // A great one is felt in the lands about it.
  if (mag < NATURE.quake.besideFrom) return;
  for (let k = g.grid.offsets[cell]!; k < g.grid.offsets[cell + 1]!; k++) {
    const next = g.grid.neighbours[k]!;
    if (offworldSite(g, next) || (ctx.provinces.get(next)?.total() ?? 0) <= 0) continue;
    const near = shakeLand(ctx, next, mag, () => NATURE.quake.besideKm, t);
    if (near.dead <= 0 && homesIn(near) <= 0) continue;
    const beside = world.events.emit({
      type: DISASTER_EVENTS.quake.type,
      importance: natureImportance(near.dead, worldPeople(ctx)),
      subjects: [ctx.provinces.get(next)!.ref],
      place: ctx.provinces.get(next)!.ref,
      causes: [{ ref: event, role: "trigger", weight: 1 }],
      data: {
        natural: true,
        mag,
        kind: felt,
        beside: cell,
        dead: near.dead,
        blocks: near.blocks,
        homes: near.homes,
      },
    });
    tally.quakes++;
    tally.quakeDead += near.dead;
    tally.homesLost += homesIn(near);
    grieve(world, next, shakeShares(near.worst, DISASTER.quake).grief, beside);
  }
}

/** A year's rain in a patch's land: its own year's if anyone keeps it, as usual where no one does. */
const rainIn = (ctx: PopulationContext, cell: number): number =>
  (ctx.provinces.get(cell)?.rain ?? 1000) / 1000;

/** The standing share of a land's woods: as they were at first, where no one has touched them. */
const forestIn = (ctx: PopulationContext, cell: number): number =>
  Math.max(NATURE.fire.farmed, woodsStanding(ctx, cell));

/** A fire goes out from its first patch: through what can burn, slower across a river, nothing at water or bare ground, out with its season. */
function spread(
  ctx: PopulationContext,
  g: ProvinceWorld,
  idx: Index,
  first: number,
  t: SimTime,
): { patches: number[]; days: number[] } {
  const f = g.fine,
    { world } = ctx,
    patches = [first],
    days = [0],
    seen = new Set([first]),
    P = f.grid.positions;
  for (let i = 0; i < patches.length && patches.length < NATURE.fire.most; i++) {
    const at = patches[i]!,
      [wx, wy, wz] = windAt(P, f.grid.lat[at]!, f.climate.bands, at);
    for (let k = f.grid.offsets[at]!; k < f.grid.offsets[at + 1]!; k++) {
      const m = f.grid.neighbours[k]!;
      if (seen.has(m) || patches.length >= NATURE.fire.most) continue;
      seen.add(m);
      const fuel = fuelOf(f.climate.biome[m]!);
      if (fuel <= 0 || f.tectonics.elevation[m]! <= 0 || f.water.lake[m]) continue;
      const land = g.provinceOf[m]!,
        dx = P[3 * m]! - P[3 * at]!,
        dy = P[3 * m + 1]! - P[3 * at + 1]!,
        dz = P[3 * m + 2]! - P[3 * at + 2]!,
        l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1,
        chance = spreadChance({
          fuel: fuel * forestIn(ctx, land),
          dry: dryness(f.climate.precipitation[m]!, rainIn(ctx, land)),
          taken: patches.length,
          along: (dx * wx + dy * wy + dz * wz) / l,
          river: !!f.water.river[m],
          air: idx.air,
        }),
        draw = world.rng.real(FIRES, m, t, 7);
      if (draw >= chance) continue;
      patches.push(m);
      days.push(
        days[i]! + crossDays(fuel, world.rng.real(FIRES, m, t, 8)) * (f.water.river[m] ? 2 : 1),
      );
    }
  }
  return { patches, days };
}

/** A month's look over one twelfth of the lands: in a dry year, on its woods, under the lightning its weather makes. */
function firesMonth(
  ctx: PopulationContext,
  g: ProvinceWorld,
  idx: Index,
  month: number,
  t: SimTime,
): void {
  if (idx.air <= 0) return;
  const { world } = ctx;
  for (const cell of idx.burnable[month]!) {
    const p = ctx.provinces.get(cell),
      // (A land no one lives in keeps no year's rain: its dry years as often, by a draw of its own.)
      rain =
        p && p.total() > 0
          ? p.rain / 1000
          : world.rng.real(FIRES, cell, t, 2) < NATURE.fire.dryOften
            ? 0.6
            : 1;
    if (rain >= NATURE.fire.dryYear) continue;
    let woods = firstForest(g, cell);
    if (woods <= 0)
      for (let k = g.childOffsets[cell]!; k < g.childOffsets[cell + 1]!; k++)
        woods = Math.max(woods, fuelOf(g.fine.climate.biome[g.children[k]!]!) * 0.4);
    const wild = forestIn(ctx, cell),
      flashes = flashesOf(g.climate.temperature[cell]!, g.climate.precipitation[cell]!),
      dry = dryness(g.climate.precipitation[cell]!, rain),
      chance = litChance(flashes, woods * wild, dry, idx.air);
    if (world.rng.real(FIRES, cell, t, 0) >= chance) continue;
    // It lights where most stands to burn.
    let start = -1,
      best = 0;
    for (let k = g.childOffsets[cell]!; k < g.childOffsets[cell + 1]!; k++) {
      const c = g.children[k]!,
        fuel =
          g.fine.tectonics.elevation[c]! > 0 && !g.fine.water.lake[c]
            ? fuelOf(g.fine.climate.biome[c]!)
            : 0,
        v = fuel * (0.4 + world.rng.real(FIRES, c, t, 1));
      if (v > best) {
        best = v;
        start = c;
      }
    }
    if (start < 0) continue;
    wildfire(ctx, g, idx, cell, start, flashes, rain, woods * wild, t);
  }
}

function wildfire(
  ctx: PopulationContext,
  g: ProvinceWorld,
  idx: Index,
  cell: number,
  start: number,
  flashes: number,
  rain: number,
  woods: number,
  t: SimTime,
): void {
  const { world } = ctx,
    store = wildOf(world)!,
    { patches, days } = spread(ctx, g, idx, start, t),
    lands = [...new Set(patches.map((c) => g.provinceOf[c]!))],
    biome = g.fine.climate.biome[start]!,
    regrow = Math.max(
      ...patches.map((c) => FUEL[g.fine.climate.biome[c]!]?.[1] ?? 0),
      FUEL[biome]?.[1] ?? 5,
    ),
    km2 = Math.round(patches.length * idx.patchKm2),
    last = Math.max(...days) + NATURE.fire.lastDays,
    prov = ctx.provinces.get(cell),
    place = cellRef(0, cell),
    drought = prov?.lastDrought ?? null,
    plateFree: Factor[] = [
      {
        name: "a dry year",
        value: Math.round(rain * 100) / 100,
        contribution: 1 - rain,
        source: drought ? { ref: drought, role: "trigger", weight: 1 } : null,
      },
      {
        name: "the lightning its weather makes",
        value: flashes,
        contribution: flashes / 10,
        source: null,
      },
      {
        name: `its ${BIOME_NAMES[biome]} standing`,
        value: Math.round(woods * 100) / 100,
        contribution: woods,
        source: { ref: cellRef(0, cell), role: "enabler", weight: 1 },
      },
    ],
    someone = (c: number) => (ctx.provinces.get(c)?.total() ?? 0) > 0,
    seen =
      lands.some(someone) ||
      lands.some((c) => {
        for (let k = g.grid.offsets[c]!; k < g.grid.offsets[c + 1]!; k++)
          if (someone(g.grid.neighbours[k]!)) return true;
        return false;
      });
  // (Where no one lives or lives near, it is nothing to anyone: no one's history keeps it. Its woods burn all the same: E1.)
  if (!seen) {
    for (const land of lands) {
      const share =
        patches.filter((c) => g.provinceOf[c] === land).length /
        Math.max(1, g.childOffsets[land + 1]! - g.childOffsets[land]!);
      woodsBurned(ctx, land, share * (1 - NATURE.fire.forestLeft), yearOfMoment(t));
    }
    return;
  }
  const decision = world.decisions.record({
    rule: "wild.lit",
    subject: place,
    outcome: { patches: patches.length, km2 },
    score: woods,
    threshold: 0,
    factors: plateFree,
  });
  // What it comes to: a town of a land it crossed that stands on a patch it took.
  const burned = new Set(patches),
    towns: { v: Settlement; homes: number; dead: number }[] = [],
    event0 = {
      type: UNBIDDEN_EVENTS.fire.type,
      subjects: [place],
      place,
      causes: [{ ref: decision, role: "trigger" as const, weight: 1 }],
    };
  let dead = 0,
    homes = 0;
  const homesBy: Record<string, number> = {};
  for (const land of lands) {
    const here = ctx.provinces.get(land);
    if (!here) continue;
    for (const v of standing(ctx, land)) {
      if (offworldSite(g, v.cell)) continue;
      const point = regionPoint(g.fine, g.centre[v.cell]!, REGION_SIZE, PROVINCE_TILE_KM, v.tile),
        on = patchNear(g, v.cell, point);
      if (!burned.has(on)) continue;
      const fuel = fuelOf(g.fine.climate.biome[on]!) * forestIn(ctx, land);
      if (
        world.rng.real(FIRES, key(v.ref), t, 9) >=
        NATURE.fire.reachLeast + NATURE.fire.reachFuel * fuel
      )
        continue;
      // (What its people have learned of fire keeps it to fewer roofs: exactly 1 where they have learned nothing of it.)
      const share =
        fireHomes(fuel, dryness(g.fine.climate.precipitation[on]!, here.rain / 1000)) *
        lessened(world, cellRef(0, land), "fire", yearOfMoment(t));
      const fabric = townsOf(world).get(v.ref),
        lot = fabric ? Math.max(0, fabric.next - 1) : undefined,
        lost = razeOne(ctx, v, share, t, homesBy, lot),
        cut = homesBy[v.ref] ?? lost,
        toll = Math.round(v.population * share * NATURE.fire.deadOfHomes),
        fell = toll > 0 ? deathsIn(ctx, land, toll, t) : 0;
      dead += fell;
      homes += cut;
      towns.push({ v, homes: cut, dead: fell });
      spill(ctx, land, 0.12 * share);
    }
  }
  const event = world.events.emit({
      ...event0,
      importance: Math.max(
        natureImportance(dead, worldPeople(ctx)),
        towns.length ? 4 : 3,
        km2 >= 100000 ? 5 : 3,
      ),
      data: {
        natural: true,
        cover: BIOME_NAMES[biome] ?? "ground",
        ...(worldKindOf(g) === "sulfur" ? { flame: "sulfur" } : {}),
        km2,
        lands: lands.length,
        towns: towns.map((x) => x.v.name),
        dead,
        homes,
        rain: Math.round(rain * 100) / 100,
        flashes,
        days: last,
      },
    }),
    from = t,
    until = t + last * DAY,
    gone = t + regrow * YEAR;
  for (const { v, homes: lost, dead: fell } of towns)
    world.events.emit({
      type: LOCAL_ACT_EVENTS.fire.type,
      importance: Math.max(natureImportance(fell, worldPeople(ctx)), 4),
      subjects: [v.ref],
      place: cellRef(0, v.cell),
      causes: [{ ref: event, role: "trigger", weight: 1 }],
      data: {
        natural: true,
        name: v.name,
        blocks: 0,
        homes: lost,
        dead: fell,
        cover: BIOME_NAMES[biome] ?? "ground",
      },
    });
  // What it took of the land's woods.
  const wilds = ecologyOf(world);
  for (const land of lands) {
    const w = wilds.get(land),
      share =
        patches.filter((c) => g.provinceOf[c] === land).length /
        Math.max(1, g.childOffsets[land + 1]! - g.childOffsets[land]!);
    if (!w) {
      // (A land no one keeps: its woods' reach itself. E1.)
      woodsBurned(ctx, land, share * (1 - NATURE.fire.forestLeft), yearOfMoment(t));
      continue;
    }
    w.forest = Math.max(0, w.forest * (1 - share * (1 - NATURE.fire.forestLeft)));
  }
  store.scars.push({
    event,
    year: yearOfMoment(t),
    from,
    until,
    gone,
    cell,
    lands,
    patches,
    days,
  });
  if (store.scars.length > NATURE.fire.mostScars) store.scars.shift();
  const tally = store.tally;
  tally.fires++;
  tally.fireDead += dead;
  tally.burnedKm2 += km2;
  tally.townsBurned += towns.length;
  tally.homesLost += homes;
  for (const { v } of towns)
    if (dead > 0)
      grieve(world, v.cell, Math.min(0.5, 0.1 + 0.05 * dmath.log10(Math.max(1, dead))), event);
  if (towns.length) answer(ctx, towns[0]!.v.cell, event, dead, "fire", towns[0]!.v.name, t);
}

/** Whichever class fell (most fall small), or none. */
function starOf(u: number, rate: number): StarClass | null {
  let sum = 0;
  for (let i = STARS.length - 1; i >= 0; i--) {
    sum += (STARS[i]!.perYear * rate) / 12;
    if (u < sum) return STARS[i]!;
  }
  return null;
}

/** A month's sky: seldom anything, anywhere. It can fall on any of a world's lands or its seas, and be seen for hundreds of km about. */
function skyMonth(ctx: PopulationContext, g: ProvinceWorld, idx: Index, t: SimTime): void {
  const { world } = ctx,
    cls = starOf(world.rng.real(SKY, 0, t, 0), idx.sky);
  if (!cls) return;
  const cell = Math.floor(world.rng.real(SKY, 1, t, 0) * g.offworld.base),
    P = g.grid.positions,
    R = 6371 * g.planet.radius,
    reach = dmath.cos(NATURE.star.seenKm / R),
    seen: number[] = [],
    out = [cell],
    done = new Set(out);
  // Lands under it: the rings of those about, till none is in sight.
  for (let i = 0; i < out.length; i++) {
    const c = out[i]!,
      d =
        P[3 * c]! * P[3 * cell]! +
        P[3 * c + 1]! * P[3 * cell + 1]! +
        P[3 * c + 2]! * P[3 * cell + 2]!;
    if (d < reach) continue;
    if ((ctx.provinces.get(c)?.total() ?? 0) > 0) seen.push(c);
    for (let k = g.grid.offsets[c]!; k < g.grid.offsets[c + 1]!; k++) {
      const m = g.grid.neighbours[k]!;
      if (!done.has(m) && m < g.offworld.base) {
        done.add(m);
        out.push(m);
      }
    }
  }
  if (!seen.length) return;
  const ground = reachesGround(cls.metres, idx.airBar),
    middle = Math.floor(world.rng.real(SKY, 2, t, 0) * REGION_SIZE * REGION_SIZE),
    prov = ctx.provinces.get(cell),
    land = g.tectonics.elevation[cell]! > 0,
    star = world.events.emit({
      type: UNBIDDEN_EVENTS.star.type,
      importance: cls.id === "crater" ? 6 : cls.id === "flattening" ? 5 : 3,
      subjects: seen.slice(0, 4).map((c) => cellRef(0, c)),
      place: cellRef(0, cell),
      causes: [{ ref: g.planet.ref as Ref, role: "enabler", weight: 1 }],
      data: {
        natural: true,
        cls: cls.id,
        metres: cls.metres,
        ground,
        land,
        seen: seen.length,
        air: Math.round(idx.airBar * 100) / 100,
        sky: Math.round(idx.sky * 100) / 100,
      },
    }),
    tally = wildOf(world)!.tally;
  tally.stars++;
  if (!prov || prov.total() <= 0) {
    if (land && ground && cls.id !== "bright")
      actsOf(world).addCrater({ cell, year: yearOfMoment(t), event: star });
    return;
  }
  // What it does to a land's towns: within its reach, by what is left of it there: the god's meteor's own shares.
  const k = DISASTER.meteor,
    homes: Record<string, number> = {};
  let dead = 0,
    blocks = 0,
    worst = 0;
  for (const v of standing(ctx, cell)) {
    const km = tilesKm(v.tile, middle);
    if (km >= cls.reachKm) continue;
    const h = cls.strength * (1 - km / cls.reachKm);
    worst = Math.max(worst, h);
    blocks += razeOne(ctx, v, k.blocks * h, t, homes);
    dead += Math.round(v.population * k.dead * h);
  }
  if (cls.id === "crater") {
    const inTowns = standing(ctx, cell).reduce((n, v) => n + v.population, 0),
      rest = Math.max(0, prov.total() - inTowns);
    dead += Math.round(rest * k.dead * 0.3);
    worst = Math.max(worst, 0.3);
  }
  const fell = dead > 0 ? deathsIn(ctx, cell, dead, t) : 0;
  if (ground && land && cls.id !== "bright")
    actsOf(world).addCrater({ cell, year: yearOfMoment(t), event: star });
  if (fell <= 0 && !Object.keys(homes).length) return;
  spill(ctx, cell, k.stores * worst * 0.5);
  const town = Object.keys(homes)[0],
    strikeEvent = world.events.emit({
      type: DISASTER_EVENTS.meteor.type,
      importance: natureImportance(fell, worldPeople(ctx)),
      subjects: [prov.ref],
      place: prov.ref,
      causes: [{ ref: star, role: "trigger", weight: 1 }],
      data: {
        natural: true,
        cls: cls.id,
        metres: cls.metres,
        ground,
        dead: fell,
        blocks,
        years: cls.id === "crater" ? k.blighted : 0,
        homes,
        town: town ? (ctx.settlements.get(town as Ref)?.name ?? null) : null,
      },
    });
  tally.starDead += fell;
  tally.homesLost += Object.values(homes).reduce((a, b) => a + b, 0);
  grieve(world, cell, k.grief * worst, strikeEvent);
  answer(
    ctx,
    cell,
    strikeEvent,
    fell,
    "star",
    town ? (ctx.settlements.get(town as Ref)?.name ?? "") : "",
    t,
  );
}

/** A month's chance of a new mountain: where the world has them, and on ground where no town stands; its first year's height. */
function risesMonth(ctx: PopulationContext, g: ProvinceWorld, idx: Index, t: SimTime): void {
  if (!idx.cones.length) return;
  const { world } = ctx,
    due = countOf((idx.cones.length * NATURE.rise.perYear) / 12, world.rng.real(RISES, 0, t, 0));
  if (!due) return;
  const cell = idx.cones[Math.floor(world.rng.real(RISES, 1, t, 0) * idx.cones.length)]!,
    prov = ctx.provinces.get(cell);
  // (No one to see it go up: nothing to tell, and the world keeps its ground.)
  if (!prov || prov.total() <= 0) return;
  const taken = new Set(
      standing(ctx, cell).map((v) =>
        patchNear(
          g,
          cell,
          regionPoint(g.fine, g.centre[cell]!, REGION_SIZE, PROVINCE_TILE_KM, v.tile),
        ),
      ),
    ),
    home = homePlanet(world),
    free: number[] = [];
  for (let k = g.childOffsets[cell]!; k < g.childOffsets[cell + 1]!; k++) {
    const c = g.children[k]!;
    if (g.fine.tectonics.elevation[c]! > 0 && !taken.has(c)) free.push(c);
  }
  if (!free.length) return;
  const at = free[Math.floor(world.rng.real(RISES, 2, t, 0) * free.length)]!,
    metres = Math.round(
      NATURE.rise.least + (NATURE.rise.most - NATURE.rise.least) * world.rng.real(RISES, 3, t, 0),
    ),
    p = home.surface(at);
  p.elevation = Math.fround(Math.min(16000, p.elevation + metres));
  p.temperature = Math.fround(p.temperature - metres * 0.0065);
  surfaceBiome(p, g.fine.climate.precipitation[at]!);
  home.changeSurface([p]);
  const kind = worldKindOf(g),
    rock =
      kind !== "rocky"
        ? (KIND_ROCKS as Record<string, Record<string, { name: string }>>)[kind]?.andesite?.name
        : null,
    tec = g.tectonics,
    own = tec.plates[tec.plate[cell]!],
    other = tec.across[cell]! >= 0 ? tec.plates[tec.across[cell]!] : undefined,
    event = world.events.emit({
      type: UNBIDDEN_EVENTS.rise.type,
      subjects: [prov.ref],
      place: prov.ref,
      causes: [
        ...(other ? [{ ref: other.ref as Ref, role: "trigger" as const, weight: 1 }] : []),
        ...(own ? [{ ref: own.ref as Ref, role: "enabler" as const, weight: 0.6 }] : []),
      ],
      data: {
        natural: true,
        metres,
        rock: rock ?? "andesite",
        ...(own ? { plate: own.index } : {}),
        ...(other ? { across: other.index } : {}),
      },
    });
  home.recordStroke({ event, kind: "raise", cells: [at], provinces: [cell], t, dead: 0 });
  // (Its ash on that year's fields.)
  actsOf(world).add({
    command: event,
    event,
    kind: "harvest",
    cell,
    sign: -1,
    from: t,
    until: t + YEAR,
  });
  wildOf(world)!.tally.rises++;
}

/** The month. Nothing on a world with no one on it, or on any but a world of lands. */
export function wildMonth(ctx: PopulationContext, t: SimTime): void {
  const g = ctx.generated;
  if (!isProvinceWorld(g) || !ctx.provinces.all().length) return;
  const store = wildOf(ctx.world);
  if (!store) return;
  const idx = (store.index ??= readWorld(g)),
    month = Math.floor((t % YEAR) / MONTH);
  // (Its disasters, unless the player has turned them off: a mountain still rises where no one is.)
  if (!switchedOff(ctx.world, "disasters")) {
    quakesMonth(ctx, g, idx, t);
    firesMonth(ctx, g, idx, month, t);
    skyMonth(ctx, g, idx, t);
  }
  risesMonth(ctx, g, idx, t);
  if (month === 0 && store.scars.length) store.scars = store.scars.filter((s) => s.gone > t);
}

/** Teach a peopled world to act on its own (its disasters a switch the player may turn off). */
export function installWild(world: World, ctx: () => PopulationContext): WildStore {
  const store = world.register(new WildStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "192.wild.month", every: MONTH, run: (t) => wildMonth(ctx(), t) });
  return store;
}
