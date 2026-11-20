// Crops tamed and carried (the sweep, Nature lane; the rules are rules/crops.ts). A land that finds sowing sows what grows wild
// on it (its best wild grass, else its roots and fruit, a sea people its beds), and sown, the crop turns tame over the
// generations, as fast as its seed and the share of its land sown let it; a land that learns sowing from a neighbour sows the
// neighbour's crop. Each crop fits the warmth, rain and days it was bred under, and moves toward the land it is sown on; every
// five years a land looks at the crops of the lands it meets (beside it, and across the sea where its ships trade) and takes up
// one that would give a tenth more than its own. What a land's crop gives, against what its fields always gave, is its fields'
// yield in the year's food (population/systems.ts foodMonth): exactly 1 on a land sowing its own best plant, tamed, where it was
// bred. A land that knew sowing before the chronicle is reckoned to have tamed its own long since.
//
// One small row a land; a fifth of the lands step each year, five years at once (cell + year). No draw.
import {
  YEAR,
  Hasher,
  defineEventType,
  yearOfMoment,
  type CauseRef,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { isProvinceWorld, offworldSite } from "../../gen/index.ts";
import {
  CROPS,
  adaptStep,
  cropGives,
  cropFit,
  gardenStrain,
  tameStep,
  type CropField,
  type CropStrain,
} from "../../rules/index.ts";
import { marketsOf, type PopulationContext } from "../population/systems.ts";
import type { Province } from "../population/model.ts";
import { shiftNow } from "../planet/motion.ts";
import { farmedOf } from "./farmed.ts";

export const CROP_EVENTS = {
  /** A land's crop turned tame in the chronicle. */
  tamed: defineEventType("life.crop-tamed", 4),
  /** A land took up the crop of a land it meets. */
  carried: defineEventType("life.crop-carried", 3),
};

/** A fifth of the lands step each year, each five years at once. */
export const CROP_STEP = 5;
/** What a crop of roots and fruit is, and a sea people's beds of weed and shell. */
export const ROOTS = -1,
  BEDS = -2;

/** A land's crop, in whole numbers. */
export type CropLand = {
  readonly cell: number;
  /** The plant: a lineage of its world (a grass), ROOTS or BEDS. */
  crop: number;
  /** How tame it is (thousandths), its seed's weight (hundredths). */
  tame: number;
  seed: number;
  /** Its strain: the warmth (tenths of a degree) and the latitude (tenths of a degree, north or south alike) it fits now, its
   * tolerance (tenths of a degree) and its rain (mm). */
  warm: number;
  lat: number;
  tol: number;
  rainMin: number;
  rainMax: number;
  /** The land it was first sown on, and the year it was first sown here. */
  from: number;
  since: number;
  /** The seed of the land's own best wild plant (hundredths): what its fields always gave by. */
  own: number;
  /** What it gives against that (thousandths), and how it fits here (thousandths). */
  gives: number;
  fit: number;
  /** The event of its turning tame here, and of its coming from another land (null: neither in the chronicle). */
  tamed: Ref | null;
  came: Ref | null;
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

export class CropStore implements StateStore {
  readonly name = "life.crops";
  readonly packed = true;
  private readonly map = new Map<number, CropLand>();
  private readonly digest: [number, number] = [0x811c9dc5, 0];
  /** Whether its first year has passed (the lands that sowed before the chronicle reckoned tamed). */
  begun = false;

  get(cell: number): CropLand | undefined {
    return this.map.get(cell);
  }
  set(l: CropLand): void {
    this.map.set(l.cell, l);
    fold(this.digest, [
      l.cell,
      l.crop,
      l.tame,
      l.seed,
      l.warm,
      l.lat,
      l.from,
      l.gives,
      l.fit,
      l.tamed ? 1 : 0,
      l.came ? 1 : 0,
    ]);
  }
  delete(cell: number): void {
    if (this.map.delete(cell)) fold(this.digest, [-1, cell]);
  }
  all(): CropLand[] {
    return [...this.map.values()].sort((a, b) => a.cell - b.cell);
  }
  get size(): number {
    return this.map.size;
  }
  dormant(): boolean {
    return !this.begun && this.map.size === 0;
  }
  pinned(): Ref[] {
    const out: Ref[] = [];
    for (const l of this.map.values()) for (const r of [l.tamed, l.came]) if (r) out.push(r);
    return out;
  }
  hashInto(h: Hasher): void {
    if (this.dormant()) return;
    h.int(this.map.size)
      .int(this.digest[0])
      .int(this.digest[1])
      .int(this.begun ? 1 : 0);
  }
  save(): unknown {
    if (this.dormant()) return {};
    return { lands: this.all(), digest: [...this.digest], begun: this.begun };
  }
  load(state: unknown): void {
    const s = (state ?? {}) as { lands?: CropLand[]; digest?: [number, number]; begun?: boolean };
    this.map.clear();
    for (const l of s.lands ?? []) this.map.set(l.cell, { ...l });
    this.digest[0] = s.digest?.[0] ?? 0x811c9dc5;
    this.digest[1] = s.digest?.[1] ?? 0;
    this.begun = s.begun ?? false;
  }
}

export function cropsOf(world: World): CropStore | null {
  return world.peek<CropStore>("life.crops") ?? null;
}

/** What a land's crop gives its fields against what they always gave (1 where it keeps no crop). */
export function cropsGive(world: World, cell: number): number {
  const l = cropsOf(world)?.get(cell);
  return l ? l.gives / 1000 : 1;
}

const DEG = 180 / Math.PI;

/** A land as its crop meets it now: its warmth as its ground has turned, its rain, its latitude. */
export function cropFieldOf(ctx: PopulationContext, cell: number): CropField {
  const g = ctx.generated;
  return {
    warm: g.climate.temperature[cell]! + shiftNow(ctx.world).warm,
    rain: g.climate.precipitation[cell]!,
    lat: Math.abs(g.grid.lat[cell]! * DEG),
  };
}

const strainOf = (l: CropLand): CropStrain => ({
  warm: l.warm / 10,
  lat: l.lat / 10,
  tolerance: l.tol / 10,
  rainMin: l.rainMin,
  rainMax: l.rainMax,
});

/** The land's own best wild plant to sow: its wild grass, else its roots and fruit (a sea people's shelf, its beds). */
function ownPlant(
  ctx: PopulationContext,
  cell: number,
): { crop: number; seed: number; strain: CropStrain } {
  const g = ctx.generated,
    f = cropFieldOf(ctx, cell),
    grass = g.life.seedGrass[cell] ?? -1;
  if (grass >= 0) {
    const s = g.life.species[grass]!;
    return {
      crop: grass,
      seed: s.seed,
      strain: {
        // (The stand that grows wild on this land is this land's own: fitted to its warmth as to its days. Read at its kind's
        // middling warmth, a land at the edge of its grass's range sowed its own at half what its fields "always gave".)
        warm: f.warm,
        lat: f.lat,
        tolerance: s.tolerance,
        rainMin: s.rainMin,
        rainMax: s.rainMax,
      },
    };
  }
  const beds = ctx.medium !== "land" && g.tectonics.elevation[cell]! <= 0;
  return { crop: beds ? BEDS : ROOTS, seed: CROPS.gardenSeed, strain: gardenStrain(f) };
}

function landOf(
  cell: number,
  crop: number,
  seed: number,
  strain: CropStrain,
  tame: number,
  from: number,
  year: number,
  own: number,
): CropLand {
  return {
    cell,
    crop,
    tame: Math.round(1000 * tame),
    seed: Math.round(100 * seed),
    warm: Math.round(10 * strain.warm),
    lat: Math.round(10 * strain.lat),
    tol: Math.round(10 * strain.tolerance),
    rainMin: Math.round(strain.rainMin),
    rainMax: Math.round(strain.rainMax),
    from,
    since: year,
    own: Math.round(100 * own),
    gives: 1000,
    fit: 1000,
    tamed: null,
    came: null,
  };
}

/** What a land's crop (or one it meets) would give it now (against its fields' as they always were). */
function worthOn(l: CropLand, f: CropField, own: number): { gives: number; fit: number } {
  const fit = cropFit(strainOf(l), f);
  return { fit, gives: cropGives(l.tame / 1000, fit, l.seed / 100, own / 100) };
}

/** The lands a land meets: those beside it, and those its ships trade with. */
export function cropMeets(ctx: PopulationContext, cell: number): number[] {
  const g = ctx.generated,
    out: number[] = [];
  for (let k = g.grid.offsets[cell]!; k < g.grid.offsets[cell + 1]!; k++)
    out.push(g.grid.neighbours[k]!);
  for (const c of marketsOf(ctx.world).seaPartners(cell)) if (!out.includes(c)) out.push(c);
  return out;
}

/** A land newly sowing: a neighbour's crop where it learned from one (the best of those it meets), else its own. */
function firstCrop(ctx: PopulationContext, store: CropStore, p: Province, year: number): CropLand {
  const cell = p.cell,
    own = ownPlant(ctx, cell),
    f = cropFieldOf(ctx, cell),
    taught = p.cultivation ? ctx.world.events.get(p.cultivation)?.type : undefined,
    learned = taught === "knowledge.cultivation-spread";
  let best: CropLand | null = null,
    most = -1;
  if (learned)
    for (const c of cropMeets(ctx, cell)) {
      const l = store.get(c);
      if (!l) continue;
      const w = worthOn(l, f, Math.round(100 * own.seed)).gives;
      if (w > most) {
        most = w;
        best = l;
      }
    }
  // (A neighbour's crop only where it gives more here than this land's own wild plant sown afresh: no one sows a stranger's
  // seed that yields a fifth of their own. Taken whatever it gave, new sowers starved in their first years: of first light's
  // famines to 200, 672 had no drought and a crop giving a median two fifths.)
  const fresh = landOf(cell, own.crop, own.seed, own.strain, 0, cell, year, own.seed);
  if (best && most > worthOn(fresh, f, Math.round(100 * own.seed)).gives)
    return {
      ...best,
      cell,
      since: year,
      own: Math.round(100 * own.seed),
      tamed: null,
      came: null,
    };
  return fresh;
}

/** A land's crop over `years`: tamer, fitted closer to its land, and the best crop it meets taken up. */
function stepLand(
  ctx: PopulationContext,
  store: CropStore,
  p: Province,
  l: CropLand,
  year: number,
): void {
  const { world } = ctx,
    f = cropFieldOf(ctx, p.cell),
    farmed = farmedOf(ctx, p),
    wasTame = l.tame;
  l.tame = Math.round(1000 * tameStep(l.tame / 1000, CROP_STEP, l.seed / 100, farmed, l.crop < 0));
  const s = adaptStep(strainOf(l), f, CROP_STEP);
  l.warm = Math.round(10 * s.warm);
  l.lat = Math.round(10 * s.lat);
  if (wasTame < 1000 && l.tame >= 1000)
    l.tamed = world.events.emit({
      type: CROP_EVENTS.tamed.type,
      place: p.ref,
      causes: p.cultivation ? [{ ref: p.cultivation, role: "enabler", weight: 1 }] : [],
      data: { crop: cropName(ctx, l.crop), years: year - l.since },
    });
  // The crops of the lands it meets, and its own wild plant sown afresh where its crop fits it ill.
  let now = worthOn(l, f, l.own).gives,
    taken: CropLand | null = null,
    takenFrom = -1;
  for (const c of cropMeets(ctx, p.cell)) {
    const o = store.get(c);
    if (!o || (o.crop === l.crop && o.from === l.from)) continue;
    const w = worthOn(o, f, l.own).gives;
    if (w > now * CROPS.better && (!taken || w > worthOn(taken, f, l.own).gives)) {
      taken = o;
      takenFrom = c;
    }
  }
  if (!taken) {
    const own = ownPlant(ctx, p.cell);
    if (own.crop !== l.crop) {
      const fresh = landOf(p.cell, own.crop, own.seed, own.strain, 0, p.cell, year, own.seed),
        w = worthOn(fresh, f, l.own).gives;
      if (w > now * CROPS.better) {
        Object.assign(l, { ...fresh, own: l.own, tamed: null, came: null });
        now = w;
      }
    }
  } else {
    const from = ctx.provinces.get(takenFrom),
      causes: CauseRef[] = [];
    if (taken.came) causes.push({ ref: taken.came, role: "enabler", weight: 0.5 });
    else if (from?.cultivation)
      causes.push({ ref: from.cultivation, role: "enabler", weight: 0.5 });
    const had = l.crop;
    Object.assign(l, {
      crop: taken.crop,
      tame: taken.tame,
      seed: taken.seed,
      warm: taken.warm,
      lat: taken.lat,
      tol: taken.tol,
      rainMin: taken.rainMin,
      rainMax: taken.rainMax,
      from: taken.from,
      since: year,
    });
    l.came = world.events.emit({
      type: CROP_EVENTS.carried.type,
      place: p.ref,
      subjects: from ? [p.ref, from.ref] : [p.ref],
      causes,
      data: { crop: cropName(ctx, l.crop), had: cropName(ctx, had), from: takenFrom },
    });
  }
  const w = worthOn(l, f, l.own);
  l.gives = Math.round(1000 * w.gives);
  l.fit = Math.round(1000 * w.fit);
}

/** A crop's name: its lineage's, or what it is. */
export function cropName(
  ctx: { generated: { life: { species: readonly { name: string }[] } } },
  crop: number,
): string {
  return crop >= 0
    ? (ctx.generated.life.species[crop]?.name ?? "a grass")
    : crop === BEDS
      ? "beds of weed and shell"
      : "roots and fruit";
}

/** The year's crops (151.life.crops, after sowing is found): new sowers given their crop, a fifth of the lands stepped. */
export function cropsYear(ctx: PopulationContext, t: SimTime): void {
  const store = cropsOf(ctx.world);
  if (!store || !isProvinceWorld(ctx.generated)) return;
  const year = yearOfMoment(t),
    first = !store.begun;
  for (const p of ctx.provinces.all()) {
    if (!p.knowsCultivation || offworldSite(ctx.generated, p.cell)) continue;
    let l = store.get(p.cell);
    if (!l) {
      if (first) {
        // (It sowed before the chronicle: its own best plant, tamed long since, where it was bred.)
        const own = ownPlant(ctx, p.cell);
        l = landOf(p.cell, own.crop, own.seed, own.strain, 1, p.cell, year, own.seed);
      } else l = firstCrop(ctx, store, p, year);
      const w = worthOn(l, cropFieldOf(ctx, p.cell), l.own);
      l.gives = Math.round(1000 * w.gives);
      l.fit = Math.round(1000 * w.fit);
      store.set(l);
      continue;
    }
    if ((p.cell + year) % CROP_STEP !== 0) continue;
    stepLand(ctx, store, p, l, year);
    store.set(l);
  }
  store.begun = true;
}

/** What a land's crop reads as, for its page (null where it sows none). */
export function cropReading(world: World, ctx: PopulationContext, cell: number) {
  const l = cropsOf(world)?.get(cell);
  if (!l) return null;
  return {
    name: cropName(ctx, l.crop),
    lineage: l.crop >= 0 ? (ctx.generated.life.species[l.crop]?.ref ?? null) : null,
    tame: l.tame / 1000,
    fit: l.fit / 1000,
    gives: l.gives / 1000,
    from: l.from,
    since: l.since,
    bredLat: l.lat / 10,
    bredWarm: l.warm / 10,
    tamed: l.tamed,
    came: l.came,
  };
}

/** Teach a peopled world its crops. */
export function installCrops(world: World, ctx: () => PopulationContext): CropStore {
  const store = world.register(new CropStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "151.life.crops", every: YEAR, run: (t) => cropsYear(ctx(), t) });
  return store;
}
