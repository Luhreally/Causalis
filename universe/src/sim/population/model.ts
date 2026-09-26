// The population's shape (docs/architecture §15): people are counts, never
// individuals — by province, sex, age band and occupation — in integer tables,
// with a province's food store and what it knows. A province is a planet cell;
// it becomes simulated (A0 → A1) the first time people arrive.
import { CountTable, type Hasher, type Ref } from "../../kernel/index.ts";
import { BIOME, cellRef, isProvinceWorld, type HomeWorld } from "../../gen/index.ts";
import { BANDS, OCCUPATIONS, SEXES, type Medium } from "../../rules/index.ts";

export const ROWS = SEXES * BANDS;
export const COLS = OCCUPATIONS.length;

export function row(sex: number, band: number): number {
  return sex * BANDS + band;
}

/** What a province's land gives a year, in person-years of food. */
export type Capacity = {
  readonly forage: number;
  readonly farm: number;
  readonly pasture: number;
  readonly areaKm2: number;
};

// Food a square kilometre gives foragers, herders and early farmers in a year, by biome.
const FORAGE: readonly number[] = [
  0, 0, 0, 0, 0, 0.03, 0.08, 0.02, 0.3, 0.25, 0.28, 0.02, 0.35, 0.35, 0.4, 0.02,
];
const ARABLE: readonly number[] = [
  0, 0, 0, 0, 0, 0, 0.05, 0.02, 0.45, 0.35, 0.25, 0.02, 0.3, 0.28, 0.2, 0.01,
];
const PASTURE: readonly number[] = [
  0, 0, 0, 0, 0, 0.3, 0.1, 0.2, 0.6, 0.2, 0.1, 0.1, 0.5, 0.25, 0.05, 0.2,
];
/**
 * What the sea gives a people of the water, a square kilometre, by biome: the shallow
 * shelf is as rich as a tropical forest (reefs, kelp, shellfish beds), the open ocean
 * gives them nothing to live on; its farms are beds and pens sown and tended.
 */
const SEA_FORAGE: readonly number[] = [0, 0, 0.35];
const SEA_ARABLE: readonly number[] = [0, 0, 0.25];

/** People a square kilometre of early farmland feeds. */
export const FARM_YIELD = 40;
/** People a square kilometre of pasture feeds through its herds. */
export const HERD_YIELD = 6;

export function capacity(w: HomeWorld, cell: number, medium: Medium = "land"): Capacity {
  // A province feeds what its fine cells feed.
  if (isProvinceWorld(w)) {
    let forage = 0,
      farm = 0,
      pasture = 0,
      areaKm2 = 0;
    for (let k = w.childOffsets[cell]!; k < w.childOffsets[cell + 1]!; k++) {
      const c = capacity(w.fine, w.children[k]!, medium);
      forage += c.forage;
      farm += c.farm;
      pasture += c.pasture;
      areaKm2 += c.areaKm2;
    }
    return { forage, farm, pasture, areaKm2 };
  }
  const radiusKm = 6371 * w.planet.radius,
    areaKm2 = w.grid.areas[cell]! * radiusKm * radiusKm,
    biome = w.climate.biome[cell]!;
  // A people of the water lives on the shelf; one of the shore where land and shelf meet.
  if (medium === "water") return sea(w, cell, areaKm2, 1);
  if (medium === "shore") {
    if (!coastal(w, cell)) return { forage: 0, farm: 0, pasture: 0, areaKm2 };
    if (w.tectonics.elevation[cell]! <= 0) return sea(w, cell, areaKm2, 0.5);
  }
  return land(w, cell, areaKm2, biome);
}

/** What a shelf gives a people of the water: the warmer the more (the coldest seas a third as much). */
function sea(w: HomeWorld, cell: number, areaKm2: number, share: number): Capacity {
  const biome = w.climate.biome[cell]!,
    warm = Math.min(1, Math.max(0.3, 0.3 + (0.7 * w.climate.temperature[cell]!) / 18)),
    k = areaKm2 * warm * share;
  return {
    forage: k * (SEA_FORAGE[biome] ?? 0),
    farm: k * (SEA_ARABLE[biome] ?? 0) * FARM_YIELD,
    pasture: 0,
    areaKm2,
  };
}

/** Whether a cell lies where land and sea meet (a neighbour of the other kind). */
export function coastal(w: HomeWorld, cell: number): boolean {
  const up = w.tectonics.elevation[cell]! > 0;
  for (let k = w.grid.offsets[cell]!; k < w.grid.offsets[cell + 1]!; k++)
    if (w.tectonics.elevation[w.grid.neighbours[k]!]! > 0 !== up) return true;
  return false;
}

/** Whether a people of a medium can live in a cell at all (and it is not ice or bare rock). */
export function livable(w: HomeWorld, cell: number, medium: Medium): boolean {
  if (medium === "land") {
    if (w.tectonics.elevation[cell]! <= 0) return false;
    const biome = w.climate.biome[cell]!;
    if (biome === BIOME.ice || biome === BIOME.alpine) return false;
  }
  return capacity(w, cell, medium).forage > 0;
}

function land(w: HomeWorld, cell: number, areaKm2: number, biome: number): Capacity {
  const river = w.water.river[cell] === 1,
    // A river greens a dry valley and waters its fields.
    wet = river
      ? biome === BIOME.hotDesert || biome === BIOME.coldDesert || biome === BIOME.steppe
        ? 2.5
        : 1.3
      : 1;
  return {
    forage: areaKm2 * (FORAGE[biome] ?? 0) * wet,
    farm: areaKm2 * Math.min(0.6, (ARABLE[biome] ?? 0) * wet) * FARM_YIELD,
    pasture: areaKm2 * (PASTURE[biome] ?? 0) * HERD_YIELD,
    areaKm2,
  };
}

export class Province {
  readonly cell: number;
  readonly ref: Ref;
  readonly counts = new CountTable(ROWS, COLS);
  /** This year's rain against the usual, in thousandths. */
  rain = 1000;
  /** Last month's food against need, in thousandths (1000 = enough). */
  fed = 1000;
  /** The lowest month's `fed` over the last year. */
  leanest = 1000;
  knowsCultivation = false;
  /** The event through which this province came to keep herds (tamed or learned), if it has. */
  herding: Ref | null = null;
  /** The year its births and deaths were last reckoned whole, in one step (a quiet band's land). */
  paged = -1;
  /** The event through which this province came to know cultivation. */
  cultivation: Ref | null = null;
  /** The year the first people came. */
  settledYear: number;
  /** How the first people came: the origin or a migration event. */
  arrival: Ref | null;
  lastFamine: Ref | null = null;
  lastDrought: Ref | null = null;
  /** The last month a famine began (so one lean season is one famine). */
  famineMonth = -100;

  constructor(cell: number, settledYear: number, arrival: Ref | null) {
    this.cell = cell;
    this.ref = cellRef(0, cell);
    this.settledYear = settledYear;
    this.arrival = arrival;
  }

  total(): number {
    return this.counts.total();
  }

  occupation(col: number): number {
    return this.counts.colSum(col);
  }

  hashInto(h: Hasher): void {
    h.int(this.cell);
    this.counts.hashInto(h);
    h.int(this.rain).int(this.fed).int(this.leanest).bool(this.knowsCultivation);
    h.string(this.cultivation ?? "")
      .string(this.herding ?? "")
      .int(this.paged)
      .int(this.settledYear)
      .string(this.arrival ?? "");
    h.string(this.lastFamine ?? "")
      .string(this.lastDrought ?? "")
      .int(this.famineMonth);
  }

  save(): unknown {
    return {
      cell: this.cell,
      counts: this.counts.save(),
      rain: this.rain,
      fed: this.fed,
      leanest: this.leanest,
      knowsCultivation: this.knowsCultivation,
      cultivation: this.cultivation,
      herding: this.herding,
      paged: this.paged,
      settledYear: this.settledYear,
      arrival: this.arrival,
      lastFamine: this.lastFamine,
      lastDrought: this.lastDrought,
      famineMonth: this.famineMonth,
    };
  }

  static load(state: unknown): Province {
    const s = state as ReturnType<Province["save"]> & Record<string, unknown>;
    const p = new Province(s.cell as number, s.settledYear as number, s.arrival as Ref | null);
    p.counts.load(s.counts as never);
    p.rain = s.rain as number;
    p.fed = s.fed as number;
    p.leanest = s.leanest as number;
    p.knowsCultivation = s.knowsCultivation as boolean;
    p.cultivation = s.cultivation as Ref | null;
    p.herding = (s.herding as Ref | null | undefined) ?? null;
    p.paged = (s.paged as number | undefined) ?? -1;
    p.lastFamine = s.lastFamine as Ref | null;
    p.lastDrought = s.lastDrought as Ref | null;
    p.famineMonth = s.famineMonth as number;
    return p;
  }
}
