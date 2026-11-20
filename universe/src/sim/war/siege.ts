// Sieges, as they are fought (the last sweep, war; the rules are rules/siege.ts). In a war's year (sim/war/war.ts), a battle won
// before a land of the defender's that stands behind walls (its heart's walls done and still ringing it), its seat or not, lays
// a siege where none is laid (a land with none is stormed or entered with the field; only where a battle was won that year, so
// a war has one at a time). Each later year that the besiegers win there again,
// the siege goes one year on. The town eats into what it had in store, fed only by what its walls grow and its ships bring in. The walls open by
// what the besiegers know and throw. Their camp sickens and the town sickens and starves, and those deaths are written into the
// lands' ledgers. The land falls when its walls are open (stormed) or its stores are gone (starved). A year the besiegers lose
// there lifts the siege. One row a siege, kept while it is laid; none in a world at peace. The deaths are drawn from the
// siege's own stream: no other stream's draws move.
import {
  defineEventType,
  defineStream,
  drawWithoutReplacement,
  yearOfMoment,
  type Hasher,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { cellRef } from "../../gen/index.ts";
import {
  BANDS,
  FOODS,
  LAND_HEART_KM,
  WALLS_OUTGROWN,
  apportionCapped,
  siegeStep,
  storeMonths,
  type SiegeOutcome,
} from "../../rules/index.ts";
import {
  PROVINCE_TILE_KM,
  REGION_SIZE,
  marketsOf,
  mouths,
  type PopulationContext,
} from "../population/systems.ts";
import type { Settlement } from "../population/stores.ts";
import { COLS, ROWS } from "../population/model.ts";
import { politiesOf, realmName, type Polity } from "../polity/polity.ts";
import { loreOf } from "../lore/lore.ts";
import { townsOf } from "../town/fabric.ts";
import { handOf } from "../hand/hand.ts";
import { levyOf } from "./levy.ts";
import { coastal, seaRelief } from "./navy.ts";
import { warsOf, type War } from "./war.ts";

export const SIEGE_EVENTS = {
  /** A siege laid about a walled land or a seat, lifted, or ended with it stormed or starved into giving up. */
  siege: defineEventType("war.siege", 4),
};

const STREAM = defineStream("war.siege");

/** A siege, as kept. */
export type Siege = {
  readonly war: Ref;
  /** The land besieged, and whether it is its realm's seat. */
  readonly land: number;
  readonly seat: boolean;
  readonly since: number;
  /** Months of food the seat has left; how far its walls are open (0 … 1). */
  months: number;
  breach: number;
  /** Of the besiegers, those their camp's sickness has killed; of the town, those its crowding and hunger have killed. */
  campDead: number;
  townDead: number;
  /** The share of its food the sea brought in this year. */
  relief: number;
  /** The event it was laid by. */
  readonly event: Ref;
};

function fold(d: [number, number], xs: readonly number[]): void {
  let a = d[0],
    b = d[1];
  for (const x of xs) {
    const lo = x | 0,
      hi = Math.floor(x / 4294967296) | 0;
    a = Math.imul(a ^ lo, 0x01000193) ^ hi;
    b = Math.imul(b + lo + 0x9e3779b9, 0x85ebca6b) ^ (b >>> 13);
  }
  d[0] = a;
  d[1] = b;
}

const refNumber = (r: Ref): number => {
  const n = Number(r.split(":").at(-1));
  return Number.isFinite(n) ? n : r.length;
};

export class SiegeStore implements StateStore {
  readonly name = "war.sieges";
  private readonly rows = new Map<Ref, Siege>();
  private readonly digest: [number, number] = [0x811c9dc5, 0];
  private sets = 0;
  dormant(): boolean {
    return this.rows.size === 0;
  }
  of(war: Ref): Readonly<Siege> | undefined {
    return this.rows.get(war);
  }
  wars(): Ref[] {
    return [...this.rows.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }
  set(s: Siege): void {
    this.rows.set(s.war, s);
    fold(this.digest, [
      refNumber(s.war),
      s.land,
      Math.round(s.months * 100),
      Math.round(s.breach * 1000),
      s.campDead,
      s.townDead,
    ]);
    this.sets++;
  }
  end(war: Ref): void {
    this.rows.delete(war);
  }
  pinned(): Ref[] {
    return [...this.rows.values()].map((s) => s.event);
  }
  hashInto(h: Hasher): void {
    h.int(this.rows.size).int(this.sets).int(this.digest[0]).int(this.digest[1]);
  }
  save(): unknown {
    return {
      rows: this.wars().map((w) => this.rows.get(w)),
      digest: [...this.digest],
      sets: this.sets,
    };
  }
  load(state: unknown): void {
    this.rows.clear();
    const s = state as { rows?: Siege[]; digest?: [number, number]; sets?: number } | null;
    for (const r of s?.rows ?? []) this.rows.set(r.war, { ...r });
    this.digest[0] = s?.digest?.[0] ?? 0x811c9dc5;
    this.digest[1] = s?.digest?.[1] ?? 0;
    this.sets = s?.sets ?? 0;
  }
}

export function siegesOf(world: World): SiegeStore | null {
  return world.peek<SiegeStore>("war.sieges") ?? null;
}

/** Take `n` of a land's people as dead, drawn from `rows` (each `r × COLS + o`) by the siege's own stream; never the hand's own. */
function bury(
  ctx: PopulationContext,
  cell: number,
  rows: readonly number[] | null,
  n: number,
  t: SimTime,
  purpose: number,
): number {
  const prov = ctx.provinces.get(cell);
  if (!prov || !(n > 0)) return 0;
  const year = yearOfMoment(t),
    windowed = handOf(ctx.world).composition(cell, year, ctx.life),
    at: number[] = [],
    counts: number[] = [];
  const each = (i: number) => {
    const r = Math.floor(i / COLS),
      o = i % COLS,
      k = Math.max(0, prov.counts.get(r, o) - (windowed ? windowed[i]! : 0));
    at.push(i);
    counts.push(k);
  };
  if (rows) for (const i of rows) each(i);
  else for (let i = 0; i < ROWS * COLS; i++) each(i);
  const drawn = drawWithoutReplacement(Math.round(n), counts, (i) =>
    ctx.world.rng.real(STREAM, cell, t, purpose, i),
  );
  let took = 0;
  drawn.forEach((k, i) => {
    if (!k) return;
    const r = Math.floor(at[i]! / COLS),
      o = at[i]! % COLS;
    prov.counts.add(r, o, -k);
    ctx.history.addDeaths(cell, year, r % BANDS, k);
    took += k;
  });
  return took;
}

/** What a besieged land holds against a siege, as the step reads it (`walls`: the principles of walls it knows, and what it raised). */
function landYear(
  ctx: PopulationContext,
  w: War,
  a: Polity,
  seat: number,
  walls: number,
  fire: number,
  camp: number,
  s: Siege,
) {
  const lore = loreOf(ctx.world),
    g = ctx.generated,
    relief = coastal(ctx, seat) ? seaRelief(ctx.world, w, 1) : 0;
  return {
    relief,
    step: siegeStep({
      months: s.months,
      breach: s.breach,
      walls,
      engines: lore.effect(a.seat, "sieges"),
      fire,
      relief,
      camp,
      warmth: (g.climate.temperature[seat] ?? g.planet.meanTemperature) - g.planet.meanTemperature,
      careCamp: lore.effect(a.seat, "health"),
      careTown: lore.effect(seat, "health"),
    }),
  };
}

/**
 * A land's heart, the town its battles are fought before and its sieges laid about: the greatest of its peopled towns within
 * LAND_HEART_KM of its middle, else the one nearest that (as the land is drawn: bridge/wars.ts heartTown, its towns where its map
 * has them; null: none peopled).
 */
export function heartOf(ctx: PopulationContext, land: number): Settlement | null {
  const half = ((REGION_SIZE - 1) * PROVINCE_TILE_KM) / 2;
  let best: Settlement | null = null,
    near: Settlement | null = null,
    nearAt = Infinity;
  for (const s of ctx.settlements.kept(land)) {
    if (s.population <= 0) continue;
    // (Squared, km: exact on every engine.)
    const dx = (s.tile % REGION_SIZE) * PROVINCE_TILE_KM - half,
      dz = Math.floor(s.tile / REGION_SIZE) * PROVINCE_TILE_KM - half,
      at = dx * dx + dz * dz;
    if (
      at <= LAND_HEART_KM * LAND_HEART_KM &&
      (!best ||
        s.population > best.population ||
        (s.population === best.population && s.ref < best.ref))
    )
      best = s;
    if (at < nearAt) {
      nearAt = at;
      near = s;
    }
  }
  return best ?? near;
}

/**
 * Whether a land stands behind walls: its heart's walls are done and still ring it (not grown past them so far that they were
 * pulled down). A land behind walls is besieged; one without is stormed or entered, its heart taken with the field.
 */
export function wallsStand(ctx: PopulationContext, land: number, year: number): boolean {
  const heart = heartOf(ctx, land),
    f = heart ? townsOf(ctx.world).of(heart) : undefined,
    w = f?.walls;
  return !!w && w.end <= year && f!.next < w.reach * WALLS_OUTGROWN;
}

/** The principles of walls a land knows, and the walls its towns raised as so many more (sim/town/asks.ts guard: a principle's worth, 0.25, a battle reads). */
export function wallsOf(ctx: PopulationContext, land: number, guard: number): number {
  return loreOf(ctx.world).effect(land, "walls") + Math.max(0, guard - 1) / 0.25;
}

/**
 * A battle fought at the defender's seat or a walled land of its (sim/war/war.ts): whether the land falls this year, and those
 * the siege killed besides the battle's dead (the besiegers', the town's). Won and no siege laid there: one is laid (a siege
 * elsewhere in the war is let go: the host has moved on). Won with one laid: it goes a year on, and the land may be stormed or
 * starved. Lost in the open: it is lifted; lost only before the walls (`linesHold`), it goes its year on. Without a siege store, as before it: the second win at a seat takes it, a land at once.
 */
export function siegeAt(
  ctx: PopulationContext,
  w: War,
  a: Polity,
  b: Polity,
  seat: number,
  walls: number,
  won: boolean,
  fire: number,
  camp: number,
  t: SimTime,
  /** Whether the besiegers' lines hold where the day before the walls went against them: beaten in the storm, not in the open. */
  linesHold = false,
): { falls: boolean; how: SiegeOutcome | null; dead: [number, number] } {
  const { world } = ctx,
    store = siegesOf(world),
    isSeat = seat === b.seat,
    year = yearOfMoment(t);
  if (!store)
    return {
      falls: won && (!isSeat || w.battles.slice(0, -1).some((x) => x.land === seat && x.won)),
      how: null,
      dead: [0, 0],
    };
  const was = store.of(w.ref),
    tell = (kind: "laid" | "lifted" | SiegeOutcome, s: Siege, cause: Ref | null) =>
      world.events.emit({
        type: SIEGE_EVENTS.siege.type,
        subjects: [w.ref, a.ref, b.ref],
        place: cellRef(0, seat),
        causes: [
          { ref: w.event, role: "trigger", weight: 1 },
          ...(cause ? [{ ref: cause, role: "pressure" as const, weight: 1 }] : []),
        ],
        data: {
          a: realmName(a),
          b: realmName(b),
          kind,
          seat: s.seat,
          since: s.since,
          months: Math.round(s.months * 10) / 10,
          breach: Math.round(s.breach * 100) / 100,
          campDead: s.campDead,
          townDead: s.townDead,
        },
      });
  // (A storm thrown back is not a siege lifted: the lines stay while those within could not break them in the open, and the
  // siege goes its year on. Only a host beaten in the open is driven off.)
  const sits = !won && linesHold && !!was && was.land === seat;
  if (!won && !sits) {
    if (was && was.land === seat) {
      tell("lifted", was, was.event);
      store.end(w.ref);
    }
    return { falls: false, how: null, dead: [0, 0] };
  }
  // A first victory before its walls: the lines close, on what it has in store.
  if (!was || was.land !== seat) {
    const prov = ctx.provinces.get(seat),
      m = marketsOf(world).get(seat),
      months = prov && m ? storeMonths(m.food(FOODS), mouths(prov, ctx.life)) : 0,
      s: Siege = {
        war: w.ref,
        land: seat,
        seat: isSeat,
        since: year,
        months: Math.round(months * 100) / 100,
        breach: 0,
        campDead: 0,
        townDead: 0,
        relief: 0,
        event: "" as Ref,
      };
    store.set({ ...s, event: tell("laid", s, null) });
    return { falls: false, how: null, dead: [0, 0] };
  }
  // A year more of it.
  const { relief, step } = landYear(ctx, w, a, seat, walls, fire, camp, was),
    levy = levyOf(ctx, a, Math.round(camp), year),
    campDead = Math.min(camp, Math.round(step.campDead * camp)),
    shares = apportionCapped(campDead, levy.sent, levy.sent);
  let fellA = 0;
  levy.pools.forEach((pool, k) => {
    fellA += bury(ctx, pool.cell, pool.rows, shares[k]!, t, 10 + k);
  });
  const people = ctx.provinces.get(seat)?.total() ?? 0,
    fellB = bury(ctx, seat, null, Math.round(step.townDead * people), t, 1),
    s: Siege = {
      ...was,
      months: Math.round(step.months * 100) / 100,
      breach: Math.round(step.breach * 1000) / 1000,
      campDead: was.campDead + fellA,
      townDead: was.townDead + fellB,
      relief: Math.round(relief * 1000) / 1000,
    };
  if (step.outcome === "holds") {
    store.set(s);
    return { falls: false, how: null, dead: [fellA, fellB] };
  }
  tell(step.outcome, s, was.event);
  store.end(w.ref);
  return { falls: true, how: step.outcome, dead: [fellA, fellB] };
}

/** A war's siege, if one is laid (for its page). */
export function siegeOf(world: World, war: Ref): Readonly<Siege> | null {
  return siegesOf(world)?.of(war) ?? null;
}

/** The year's sieges let go where their war is over or the land is no longer its defender's. */
export function siegesYear(ctx: PopulationContext, t: SimTime): void {
  const store = siegesOf(ctx.world);
  if (!store || store.dormant()) return;
  const wars = warsOf(ctx.world),
    realms = politiesOf(ctx.world);
  for (const r of store.wars()) {
    const w = wars.get(r),
      s = store.of(r)!,
      b = w ? realms.get(w.defender) : undefined;
    if (!w || w.ended !== null || !b || b.ended !== null || realms.of(s.land) !== b) store.end(r);
  }
  void t;
}
