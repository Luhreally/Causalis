// The fires below (the sweep, Nature lane; the rules are rules/volcanoes.ts). Once a year a world's standing volcanoes erupt as
// their plates feed them: how many from one draw of the year's count, which and how great from two more each. An eruption kills
// about its cone (the greatest on the lands beside it too), buries that year's harvest in ash, and lays its weathered ash on the
// ground as rich new topsoil (ecology/ground.ts: as a river's silt is laid); one great enough to throw its sulphur above the
// weather veils the world, and every land's growing season is shortened for a year or two by as much as its own warmth and
// swing make of the cold (population/systems.ts foodMonth: veilYield, exactly 1 under a clear sky). New cones going up are
// acts/wild.ts's (N1); this is what the old ones do.
//
// What is kept: the eruptions history is told (each land's peopled ones, and every one of VEI 5 or more), the last few dozen;
// the ash on this year's fields; a tally for ever. Nothing grows with history.
import {
  YEAR,
  defineEventType,
  defineStream,
  yearOfMoment,
  type CauseRef,
  type Hasher,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import {
  BOUNDARY,
  cellRef,
  isProvinceWorld,
  keptKey,
  meansNumbers,
  offworldSite,
  worldKindOf,
  type ProvinceWorld,
} from "../../gen/index.ts";
import {
  NATURE,
  VOLCANO,
  ashLoss,
  ashRich,
  cooledYield,
  eruptDead,
  eruptRate,
  kelvinPerDegree,
  poissonCount,
  sulphurMt,
  tephraKm3,
  veilCooling,
  veilLeft,
  veiOf,
  ventsOf,
  type VentKind,
} from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import { deathsIn, grieve, spill } from "../acts/disasters.ts";
import { groundOf } from "../ecology/ground.ts";

export const ERUPTION_EVENTS = {
  /** A volcano erupted (its importance by its size). */
  eruption: defineEventType("planet.eruption", 4),
  /** A veil of its sulphur over the world: summers short and cold. */
  veil: defineEventType("planet.veil", 6),
};

const ERUPTIONS = defineStream("planet.eruptions");

/** The most eruptions kept for the pages (the oldest go first); a veil is told again only so many years after the last. */
export const FIRES_KEPT = 48;
const VEIL_TOLD = 0.3,
  VEIL_AGAIN = 6;
/** A veil is reckoned from the eruptions of so many years past (e-folding of 1.3 years: less than a thousandth left). */
const VEIL_SPAN = 10;

/** An eruption kept: where, when, how great, what it did. */
export type Eruption = {
  readonly cell: number;
  readonly year: number;
  readonly vei: number;
  readonly kind: VentKind;
  /** Its dead, its sulphur above the weather (tenths of a Mt), its ash (km³, thousandths). */
  readonly dead: number;
  readonly sulphur: number;
  readonly tephra: number;
  readonly event: Ref | null;
};

export type FireTally = { eruptions: number; dead: number; greatest: number; veils: number };

/** What a world holds of vents, read once from its ground (never state). */
type Vents = {
  readonly cells: Int32Array;
  readonly kinds: readonly VentKind[];
  /** Running totals of their yearly rates, and the whole. */
  readonly upTo: Float64Array;
  readonly total: number;
};

const VENTS = new Map<string, Vents>();

function ventsOfWorld(g: ProvinceWorld): Vents {
  const key = `${keptKey(g)} ${g.grid.count}`;
  let v = VENTS.get(key);
  if (v) return v;
  const t = g.tectonics,
    n = g.offworld.base,
    lid = g.planet.plateCount < NATURE.quake.leastPlates,
    hot = new Set(t.hotspots.map((c) => g.provinceOf[c]!)),
    R = 6371 * g.planet.radius,
    cells: number[] = [],
    kinds: VentKind[] = [],
    rates: number[] = [];
  for (let c = 0; c < n; c++) {
    if (t.elevation[c]! <= 0) continue;
    const own = t.plates[t.plate[c]!],
      other = t.across[c]! >= 0 ? t.plates[t.across[c]!] : undefined,
      speed = ((own?.speed ?? NATURE.quake.plateSpeed) + (other?.speed ?? own?.speed ?? 0)) / 2,
      kind: VentKind | null = hot.has(c)
        ? own?.continental
          ? "hotspot"
          : "island"
        : lid
          ? null
          : t.boundary[c] === BOUNDARY.convergent && t.toBoundary[c]! <= 3
            ? "arc"
            : t.boundary[c] === BOUNDARY.divergent && t.toBoundary[c]! <= 1
              ? "rift"
              : null;
    if (!kind) continue;
    const areaKm2 = g.grid.areas[c]! * R * R;
    cells.push(c);
    kinds.push(kind);
    rates.push(eruptRate(kind, ventsOf(kind, areaKm2), speed / NATURE.quake.plateSpeed));
  }
  const upTo = new Float64Array(rates.length);
  let sum = 0;
  rates.forEach((r, i) => (upTo[i] = sum += r));
  v = { cells: Int32Array.from(cells), kinds, upTo, total: sum };
  VENTS.set(key, v);
  if (VENTS.size > 6) VENTS.delete(VENTS.keys().next().value!);
  return v;
}

export class EruptionStore implements StateStore {
  readonly name = "planet.fires";
  eruptions: Eruption[] = [];
  tally: FireTally = { eruptions: 0, dead: 0, greatest: 0, veils: 0 };
  /** The ash on a land's fields this year: [cell, the moment it is gone, thousandths of its harvest it takes]. */
  ash: [number, number, number][] = [];
  /** The last veil told, and its year. */
  veil: Ref | null = null;
  veilYear = -1;
  /** The veil reckoned for a year (not state: from the eruptions kept). */
  private kept: { year: number; kelvin: number } | null = null;

  dormant(): boolean {
    return !this.tally.eruptions && !this.eruptions.length && !this.ash.length;
  }
  pinned(): Ref[] {
    const out: Ref[] = [];
    for (const e of this.eruptions) if (e.event) out.push(e.event);
    if (this.veil) out.push(this.veil);
    return out;
  }
  hashInto(h: Hasher): void {
    if (this.dormant()) return;
    h.value({ e: this.eruptions, t: this.tally, a: this.ash, v: this.veilYear });
  }
  save(): unknown {
    if (this.dormant()) return {};
    return {
      eruptions: this.eruptions,
      tally: this.tally,
      ash: this.ash,
      veil: this.veil,
      veilYear: this.veilYear,
    };
  }
  load(state: unknown): void {
    const s = (state ?? {}) as Partial<{
      eruptions: Eruption[];
      tally: FireTally;
      ash: [number, number, number][];
      veil: Ref | null;
      veilYear: number;
    }>;
    this.eruptions = (s.eruptions ?? []).map((e) => ({ ...e }));
    this.tally = { eruptions: 0, dead: 0, greatest: 0, veils: 0, ...s.tally };
    this.ash = (s.ash ?? []).map((a) => [a[0], a[1], a[2]]);
    this.veil = s.veil ?? null;
    this.veilYear = s.veilYear ?? -1;
    this.kept = null;
  }
  /** The world's cooling (K) in a year, from the veils of the eruptions kept. */
  coolingIn(year: number): number {
    if (this.kept?.year === year) return this.kept.kelvin;
    let k = 0;
    for (const e of this.eruptions)
      if (e.sulphur > 0 && year >= e.year && year - e.year <= VEIL_SPAN)
        k += veilCooling(e.sulphur / 10) * veilLeft(year - e.year);
    this.kept = { year, kelvin: k };
    return k;
  }
  forget(): void {
    this.kept = null;
  }
}

export function firesOf(world: World): EruptionStore | null {
  return world.hasStore("planet.fires") ? world.store<EruptionStore>("planet.fires") : null;
}

/** What the world's veil and a land's ash leave of its harvest now (exactly 1 under a clear sky, on clean ground). */
export function veilYield(ctx: PopulationContext, cell: number): number {
  const store = firesOf(ctx.world);
  if (!store || store.dormant() || offworldSite(ctx.generated, cell)) return 1;
  const now = ctx.world.now,
    year = yearOfMoment(now);
  let k = 1;
  for (const [c, until, loss] of store.ash) if (c === cell && now < until) k *= 1 - loss / 1000;
  const cool = store.coolingIn(year);
  if (cool > 0.01) {
    const g = ctx.generated;
    k *= cooledYield(
      g.climate.temperature[cell]!,
      g.climate.seasonality[cell]!,
      cool / kelvinPerDegree(worldKindOf(g)),
    );
  }
  return k;
}

/** The world's cooling under its veil this year (K: 0 under a clear sky). */
export function veilNow(world: World): number {
  return firesOf(world)?.coolingIn(yearOfMoment(world.now)) ?? 0;
}

/** The year's eruptions (129.planet.fires). */
export function firesYear(ctx: PopulationContext, t: SimTime): void {
  const store = firesOf(ctx.world),
    g = ctx.generated;
  if (!store || !isProvinceWorld(g)) return;
  const { world } = ctx,
    year = yearOfMoment(t);
  // (The ash of years past is weathered in.)
  if (store.ash.length) store.ash = store.ash.filter((a) => a[1] > t);
  const vents = ventsOfWorld(g);
  if (vents.total > 0) {
    const n = poissonCount(vents.total, world.rng.real(ERUPTIONS, 0, t, 0));
    for (let i = 0; i < n; i++) {
      const at = world.rng.real(ERUPTIONS, 1, t, i) * vents.total;
      let lo = 0,
        hi = vents.upTo.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (vents.upTo[mid]! > at) hi = mid;
        else lo = mid + 1;
      }
      erupt(
        ctx,
        store,
        g,
        vents.cells[lo]!,
        vents.kinds[lo]!,
        world.rng.real(ERUPTIONS, 2, t, i),
        t,
      );
    }
  }
  store.forget();
  // A veil over the world, told once while it lasts.
  const cool = store.coolingIn(year);
  if (cool >= VEIL_TOLD && (store.veilYear < 0 || year - store.veilYear >= VEIL_AGAIN)) {
    const cause = [...store.eruptions].reverse().find((e) => e.sulphur > 0 && e.event);
    store.veil = world.events.emit({
      type: ERUPTION_EVENTS.veil.type,
      causes: cause?.event ? [{ ref: cause.event, role: "trigger", weight: 1 }] : [],
      data: { kelvin: Math.round(cool * 100) / 100, vei: cause?.vei ?? 0 },
    });
    store.veilYear = year;
    store.tally.veils++;
  }
}

function erupt(
  ctx: PopulationContext,
  store: EruptionStore,
  g: ProvinceWorld,
  cell: number,
  kind: VentKind,
  u: number,
  t: SimTime,
): void {
  const { world } = ctx,
    year = yearOfMoment(t),
    vei = veiOf(u, kind),
    p = ctx.provinces.get(cell),
    people = p?.total() ?? 0,
    sulphur = sulphurMt(vei, meansNumbers(g).ppm("S"));
  let dead = 0;
  const struck: number[] = [];
  if (people > 0) {
    dead += deathsIn(ctx, cell, Math.round(people * eruptDead(vei)), t);
    spill(ctx, cell, Math.min(0.5, 0.05 * (vei - 2)));
    struck.push(cell);
  }
  const ashOn = (c: number, loss: number) => {
    if (loss > 0 && (ctx.provinces.get(c)?.total() ?? 0) > 0)
      store.ash.push([c, t + YEAR, Math.round(1000 * loss)]);
  };
  ashOn(cell, ashLoss(vei));
  if (vei >= VOLCANO.wideFrom)
    for (let k = g.grid.offsets[cell]!; k < g.grid.offsets[cell + 1]!; k++) {
      const c = g.grid.neighbours[k]!,
        q = ctx.provinces.get(c);
      if (c >= g.offworld.base || !q || q.total() <= 0) continue;
      dead += deathsIn(ctx, c, Math.round(q.total() * eruptDead(vei, true)), t);
      ashOn(c, ashLoss(vei, true));
      struck.push(c);
    }
  // Its ash, weathered, as new topsoil on its own ground (laid at the ground's next step, as a river's silt).
  const ground = groundOf(world)?.get(cell);
  if (ground) {
    ground.silt = Math.round(ground.silt + 1e6 * ashRich(vei));
    groundOf(world)!.set(ground);
  }
  store.tally.eruptions++;
  store.tally.dead += dead;
  store.tally.greatest = Math.max(store.tally.greatest, vei);
  if (people <= 0 && vei < 5) return;
  const tec = g.tectonics,
    own = tec.plates[tec.plate[cell]!],
    other = tec.across[cell]! >= 0 ? tec.plates[tec.across[cell]!] : undefined,
    causes: CauseRef[] = [
      ...(other ? [{ ref: other.ref as Ref, role: "trigger" as const, weight: 1 }] : []),
      ...(own ? [{ ref: own.ref as Ref, role: "enabler" as const, weight: 0.6 }] : []),
    ],
    place = p?.ref ?? (cellRef(0, cell) as Ref),
    event = world.events.emit({
      type: ERUPTION_EVENTS.eruption.type,
      importance: Math.min(7, Math.max(3, vei - 1)),
      place,
      subjects: p ? [p.ref] : [],
      causes,
      data: {
        natural: true,
        vei,
        kind,
        dead,
        sulphur: Math.round(sulphur * 10) / 10,
        tephra: Math.round(tephraKm3(vei) * 1000) / 1000,
        lands: struck.length,
      },
    });
  for (const c of struck)
    grieve(world, c, Math.min(0.5, 0.05 * (vei - 2)) * (c === cell ? 1 : 0.5), event);
  store.eruptions.push({
    cell,
    year,
    vei,
    kind,
    dead,
    sulphur: Math.round(sulphur * 10),
    tephra: Math.round(tephraKm3(vei) * 1000),
    event,
  });
  if (store.eruptions.length > FIRES_KEPT) {
    // (A veil still in the sky keeps its eruption: the oldest without one go first.)
    const i = store.eruptions.findIndex((e) => !(e.sulphur > 0 && year - e.year <= VEIL_SPAN));
    store.eruptions.splice(i >= 0 ? i : 0, 1);
  }
}

/** A land's eruptions kept, newest first (its page). */
export function eruptionsOn(world: World, cell: number): Eruption[] {
  return (firesOf(world)?.eruptions ?? []).filter((e) => e.cell === cell).reverse();
}

/** Whether a land stands where a volcano does, and of what kind (its page). */
export function ventOn(ctx: PopulationContext, cell: number): VentKind | null {
  const g = ctx.generated;
  if (!isProvinceWorld(g)) return null;
  const v = ventsOfWorld(g),
    i = v.cells.indexOf(cell);
  return i >= 0 ? v.kinds[i]! : null;
}

/** How many a world's vents give a year, all told (its page). */
export function eruptionsAYear(ctx: PopulationContext): number {
  const g = ctx.generated;
  return isProvinceWorld(g) ? ventsOfWorld(g).total : 0;
}

/** Teach a peopled world its fires below. */
export function installFires(world: World, ctx: () => PopulationContext): EruptionStore {
  const store = world.register(new EruptionStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "129.planet.fires", every: YEAR, run: (t) => firesYear(ctx(), t) });
  return store;
}

/** (For tests and tools: a vent's land's rate a year.) */
export function ventRateOf(ctx: PopulationContext, cell: number): number {
  const g = ctx.generated;
  if (!isProvinceWorld(g)) return 0;
  const v = ventsOfWorld(g),
    i = v.cells.indexOf(cell);
  return i < 0 ? 0 : v.upTo[i]! - (i > 0 ? v.upTo[i - 1]! : 0);
}
