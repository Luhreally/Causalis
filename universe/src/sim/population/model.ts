// The population's shape (docs/architecture §15): people are counts, never
// individuals — by province, sex, age band and occupation — in integer tables,
// with a province's food store and what it knows. A province is a planet cell;
// it becomes simulated (A0 → A1) the first time people arrive.
import { CountTable, type Hasher, type Ref } from "../../kernel/index.ts";
import {
  BIOME,
  cellRef,
  classify,
  isProvinceWorld,
  offworldSite,
  type HomeWorld,
} from "../../gen/index.ts";
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
/** How much of a hall's floor is field under its roof, against open farmland's best. */
export const HALL_FARM = 0.35;
/** People a square kilometre of pasture feeds through its herds. */
export const HERD_YIELD = 6;

/**
 * How a place's rain moves with a world `warm` degrees warmer, as a share of what it was: the dry lands and the
 * subtropics lose it, the wet lands and the high latitudes gain (the rule a year's rain already moves by: climate/air.ts
 * rainShift, here as a pure reading for the ground's own turning).
 */
export function rainUnderWarmth(lat: number, rain: number, warm: number): number {
  if (!warm) return 1;
  const at = Math.abs(lat),
    drying = (at >= 0.2618 && at <= 0.6109 ? 1 : 0) + (rain < 500 ? 1 : 0),
    wetting = (at >= 0.8727 ? 1 : 0) + (rain > 1500 ? 1 : 0),
    sign = Math.max(-1, Math.min(1, wetting - drying));
  return Math.max(0.5, 1 + sign * 0.06 * warm);
}

/**
 * A cell's biome with its world's ground `warm` degrees warmer or colder than it was made (the god's hand, held long
 * enough for ice, woods and grass to follow: acts/great.ts groundWarming): by the rule that named every biome when the
 * world was made (gen/climate.ts classify), so ice gives way to tundra and tundra to woods as it warms, grass to
 * desert where it also dries, and the other way as it cools. As made wherever the warmth carries it across no line,
 * and always at 0.
 */
export function biomeUnder(w: HomeWorld, cell: number, warm: number): number {
  const made = w.climate.biome[cell]!;
  if (!warm) return made;
  const e = w.tectonics.elevation[cell]!,
    t = w.climate.temperature[cell]!,
    p = w.climate.precipitation[cell]!,
    was = classify(e, t, p),
    now = classify(e, t + warm, p * rainUnderWarmth(w.grid.lat[cell]!, p, warm));
  return now === was ? made : now;
}

export function capacity(
  w: HomeWorld,
  cell: number,
  medium: Medium = "land",
  /** The degrees its ground has turned warmer by the god's hand (0: as it was made, nearly always). */
  warm = 0,
): Capacity {
  // Halls on another world are farmed under their roofs alone: no wild, no pasture.
  const site = offworldSite(w, cell);
  if (site)
    return { forage: 0, farm: site.area * HALL_FARM * FARM_YIELD, pasture: 0, areaKm2: site.area };
  // A province feeds what its fine cells feed.
  if (isProvinceWorld(w)) {
    let forage = 0,
      farm = 0,
      pasture = 0,
      areaKm2 = 0;
    for (let k = w.childOffsets[cell]!; k < w.childOffsets[cell + 1]!; k++) {
      const c = capacity(w.fine, w.children[k]!, medium, warm);
      forage += c.forage;
      farm += c.farm;
      pasture += c.pasture;
      areaKm2 += c.areaKm2;
    }
    return { forage, farm, pasture, areaKm2 };
  }
  const radiusKm = 6371 * w.planet.radius,
    areaKm2 = w.grid.areas[cell]! * radiusKm * radiusKm,
    biome = biomeUnder(w, cell, warm);
  // A people of the water lives on the shelf; one of the shore where land and shelf meet.
  if (medium === "water") return sea(w, cell, areaKm2, 1, warm);
  if (medium === "shore") {
    if (!coastal(w, cell)) return { forage: 0, farm: 0, pasture: 0, areaKm2 };
    if (w.tectonics.elevation[cell]! <= 0) return sea(w, cell, areaKm2, 0.5, warm);
  }
  return land(w, cell, areaKm2, biome);
}

/** What a shelf gives a people of the water: the warmer the more (the coldest seas a third as much). */
function sea(w: HomeWorld, cell: number, areaKm2: number, share: number, warmer = 0): Capacity {
  const biome = biomeUnder(w, cell, warmer),
    warm = Math.min(1, Math.max(0.3, 0.3 + (0.7 * (w.climate.temperature[cell]! + warmer)) / 18)),
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
export function livable(w: HomeWorld, cell: number, medium: Medium, warm = 0): boolean {
  if (medium === "land") {
    if (w.tectonics.elevation[cell]! <= 0) return false;
    const biome = biomeUnder(w, cell, warm);
    if (biome === BIOME.ice || biome === BIOME.alpine) return false;
  }
  return capacity(w, cell, medium, warm).forage > 0;
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

/** A stream of people a land sends year on year to another (Province.going). */
export type Going = {
  readonly to: number;
  readonly event: Ref;
  readonly decision: Ref;
  year: number;
  readonly count: number;
};

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
  /**
   * The months since its births and deaths were last reckoned, and how it ate in them: the
   * sum of each month's shortfall of food (thousandths short of enough) and of each month's
   * `fed` squared (thousandths squared). A land is reckoned for those months at once, by
   * their hunger as it was — so a land fed for the one month after the year's imports and
   * starving the other eleven is reckoned by its eleven lean months, not by the one.
   */
  vitalMonths = 0;
  vitalShort = 0;
  vitalFed2 = 0;
  /** The months' summed pressure on life (hunger × plague or healing × a star's flare), thousandths. */
  vitalPressure = 0;
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
  /**
   * Those it sends year on year to a land, told once (round "peoples"): each stream's land, the event that told it set out,
   * the last year it went on, and how many went the year it set out. A stream goes on untold while as many go as did then,
   * within half and twice.
   */
  going: Going[] = [];

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
      .int(this.vitalMonths)
      .int(this.vitalShort)
      .int(this.vitalFed2)
      .int(this.vitalPressure)
      .int(this.settledYear)
      .string(this.arrival ?? "");
    h.string(this.lastFamine ?? "")
      .string(this.lastDrought ?? "")
      .int(this.famineMonth);
    for (const g of this.going)
      h.int(g.to).string(g.event).string(g.decision).int(g.year).int(g.count);
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
      vitalMonths: this.vitalMonths,
      vitalShort: this.vitalShort,
      vitalFed2: this.vitalFed2,
      vitalPressure: this.vitalPressure,
      settledYear: this.settledYear,
      arrival: this.arrival,
      lastFamine: this.lastFamine,
      lastDrought: this.lastDrought,
      famineMonth: this.famineMonth,
      ...(this.going.length ? { going: this.going.map((g) => ({ ...g })) } : {}),
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
    p.vitalMonths = (s.vitalMonths as number | undefined) ?? 0;
    p.vitalShort = (s.vitalShort as number | undefined) ?? 0;
    p.vitalFed2 = (s.vitalFed2 as number | undefined) ?? 0;
    p.vitalPressure = (s.vitalPressure as number | undefined) ?? 0;
    p.lastFamine = s.lastFamine as Ref | null;
    p.lastDrought = s.lastDrought as Ref | null;
    p.famineMonth = s.famineMonth as number;
    // (A save from before streams were told once: every one of them set out anew.)
    p.going = ((s.going as Going[] | undefined) ?? []).map((g) => ({ ...g }));
    return p;
  }
}
