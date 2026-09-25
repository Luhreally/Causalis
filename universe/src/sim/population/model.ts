// The population's shape (docs/architecture §15): people are counts, never
// individuals — by province, sex, age band and occupation — in integer tables,
// with a province's food store and what it knows. A province is a planet cell;
// it becomes simulated (A0 → A1) the first time people arrive.
import { CountTable, type Hasher, type Ref } from "../../kernel/index.ts";
import { BIOME, cellRef, type HomeWorld } from "../../gen/index.ts";
import { BANDS, OCCUPATIONS, SEXES } from "../../rules/index.ts";

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
/** People a square kilometre of early farmland feeds. */
export const FARM_YIELD = 40;
/** People a square kilometre of pasture feeds through its herds. */
export const HERD_YIELD = 6;

export function capacity(w: HomeWorld, cell: number): Capacity {
  const radiusKm = 6371 * w.planet.radius,
    areaKm2 = w.grid.areas[cell]! * radiusKm * radiusKm,
    biome = w.climate.biome[cell]!,
    river = w.water.river[cell] === 1,
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
  /** Stored food, in person-months. */
  food = 0;
  /** This year's rain against the usual, in thousandths. */
  rain = 1000;
  /** Last month's food against need, in thousandths (1000 = enough). */
  fed = 1000;
  /** The lowest month's `fed` over the last year. */
  leanest = 1000;
  knowsCultivation = false;
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
    h.int(this.food).int(this.rain).int(this.fed).int(this.leanest).bool(this.knowsCultivation);
    h.string(this.cultivation ?? "")
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
      food: this.food,
      rain: this.rain,
      fed: this.fed,
      leanest: this.leanest,
      knowsCultivation: this.knowsCultivation,
      cultivation: this.cultivation,
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
    p.food = s.food as number;
    p.rain = s.rain as number;
    p.fed = s.fed as number;
    p.leanest = s.leanest as number;
    p.knowsCultivation = s.knowsCultivation as boolean;
    p.cultivation = s.cultivation as Ref | null;
    p.lastFamine = s.lastFamine as Ref | null;
    p.lastDrought = s.lastDrought as Ref | null;
    p.famineMonth = s.famineMonth as number;
    return p;
  }
}
