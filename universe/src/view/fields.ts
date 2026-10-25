// The year in a town's fields (Phase 44 M206; asked for 2026-10-25: "...work on bringing back og
// causlisis like town/country game play and sim like the depth the og game had ... and just
// actions of stuff yk"). Classic grew each tile's crop from its soil and its rain, and a dry year
// or a blight was seen in the fields before it was felt at the granary. Here a town's crop stands
// in its rows as its land's year has it — sprouting after the sowing, growing tall through the
// summer, gold at the reaping, cut to stubble, the stubble turned in the autumn — and as tall and
// as green as its rain, its soil and the god's hand let it: short and parched in a dry year (the
// god's withholding seen from the days it began), lush under rain sent, a blight running through
// its rows when the god blights its harvest and swelling them when he blesses it, pale where the
// soil is worn. Its grain is reaped field after field through the harvest weeks, each row by row
// in the working hours, back and forth as a reaper turns at the row's end, its sheaves stood in
// stooks behind the reapers till they are carried in; where the rain fails, buckets are carried
// out to the nearest fields; where a blight takes, the blighted crop is pulled and burned at the
// field's corner. Pure: the same plan and moment, the same fields.
import type { VillagePlan } from "../bridge/index.ts";
import {
  ROW_ENDS,
  ROW_GAP,
  cropColor,
  cropsOf,
  fieldPoint,
  mannerOf,
  rowsOf,
  type Crop,
} from "./country.ts";
import { hashText, unitOf } from "./draws.ts";
import { HARVEST, SOWING, restDay } from "./seasons.ts";

const DAY = 86_400,
  YEAR = 365 * DAY,
  HOUR = 3_600;

type Rgb = readonly [number, number, number];
type Point = { readonly x: number; readonly z: number };
/** The fields of a plan, and what a field's crop is chosen by. */
type Fields = Pick<VillagePlan, "ref" | "era" | "biome" | "house" | "fields" | "seed">;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x)),
  ease = (x: number) => {
    const c = clamp01(x);
    return c * c * (3 - 2 * c);
  },
  blend = (a: Rgb, b: Rgb, k: number): Rgb => [
    a[0] + (b[0] - a[0]) * k,
    a[1] + (b[1] - a[1]) * k,
    a[2] + (b[2] - a[2]) * k,
  ];

/** How the god's rain moves a year's (as history's ACT_STRENGTH.rain); the days its sending or withholding takes to show in the crop. */
const RAIN_ACT = 0.55,
  RAIN_SHOWS = 12;
/** The days a blight takes to run through the rows it takes, and a blessing to swell them; the most of the rows a blight takes. */
const BLIGHT_SPREADS = 14,
  BLESSING_SHOWS = 8,
  MOST_BLIGHTED = 0.7;

/**
 * The year in a town's fields at a moment, as it shows in them: the rain on them this year against
 * its usual (the god's sending or withholding counted from when it began), how parched they stand
 * (0 … 1) and how lush, how far a blight sent on them has run (0 … 1) and a blessing swelled
 * them, how worn their soil shows, and what they give against a fair year's (about 1).
 */
export type FieldsNow = {
  readonly rain: number;
  readonly dry: number;
  readonly lush: number;
  readonly blight: number;
  readonly blessed: number;
  readonly worn: number;
  readonly growth: number;
};

export const FAIR_YEAR: FieldsNow = {
  rain: 1,
  dry: 0,
  lush: 0,
  blight: 0,
  blessed: 0,
  worn: 0,
  growth: 1,
};

/** The year in a town's fields at moment t (a fair year where history tells none). */
export function fieldsNow(plan: Pick<VillagePlan, "life">, t: number): FieldsNow {
  const y = plan.life?.fields;
  if (!y) return FAIR_YEAR;
  const began = Math.floor(t / YEAR) * YEAR,
    shown = (from: number, days: number) => clamp01((t - from) / (days * DAY)),
    // (History moves a year's rain as the year begins: a sending or a withholding begun since is
    // seen in the crop from the days it began.)
    rain =
      y.sent !== 0 && y.sentFrom > began
        ? y.rain * (1 + y.sent * RAIN_ACT * shown(y.sentFrom, RAIN_SHOWS))
        : y.rain,
    blight = y.gift < 0 ? shown(y.giftFrom, BLIGHT_SPREADS) : 0,
    blessed = y.gift > 0 ? shown(y.giftFrom, BLESSING_SHOWS) : 0;
  return {
    rain,
    dry: clamp01((0.9 - rain) / 0.45),
    lush: clamp01((rain - 1.1) / 0.35),
    blight,
    blessed,
    worn: clamp01((0.85 - y.soil) / 0.45),
    growth:
      Math.max(0.35, Math.min(1.6, rain)) *
      (1 + 0.5 * blessed - 0.5 * blight) *
      y.soil *
      y.heat *
      (1 - y.vermin),
  };
}

/** A crop's height grown (metres, sized as the folk are drawn): grain to a body's hip, greens to its knee, grass lying. */
export const CROP_HIGH: Readonly<Record<Crop, number>> = { grain: 2, greens: 1, fallow: 0.45 };
/** The stubble's height after the reaping; a blighted row's against its crop's. */
export const STUBBLE = 0.3,
  WITHERED = 0.5;
/** When the stubble is turned in, and the greens lifted (shares of the year): bare till the sowing. */
const TURNED = 0.86,
  LIFTED = 0.74;

/** The share of the year gone at t (0 … 1). */
function yearShare(t: number): number {
  return (((t % YEAR) + YEAR) % YEAR) / YEAR;
}

/** How a year's growth stands a crop: its height against a fair year's (short in a poor year, a little taller in a rich one). */
export function standOf(growth: number): number {
  return Math.max(0.35, Math.min(1.2, 0.4 + 0.6 * growth));
}

/** How far grown a crop is at share d of the year (0 bare … 1 grown): grain from the sowing's end to midsummer, greens from spring, grass all year. */
export function grownAt(crop: Crop, d: number): number {
  switch (crop) {
    case "grain":
      return d >= TURNED ? 0 : ease((d - SOWING[0] - 0.04) / (0.5 - SOWING[0] - 0.04));
    case "greens":
      return d >= LIFTED ? 0 : ease((d - 0.22) / 0.23);
    case "fallow":
      return 1;
  }
}

/** A reaping day's working hours. */
export const REAP_HOURS: readonly [number, number] = [8, 18];
/** The days a field of grain is reaped over, at the least and the most. */
const REAP_DAYS: readonly [number, number] = [3, 12];
/** The days its sheaves stand in stooks after its reaping, before they are carried in. */
export const STOOK_DAYS = 6;
/** Stooks apart along a cut row in a fair year (metres): fewer in a poor one. */
const STOOK_GAP = 7;

/** When a field is reaped: its first day of the year and the day after its last. */
export type Reaping = { readonly from: number; readonly to: number };

const REAPINGS = new WeakMap<object, readonly (Reaping | null)[]>();

/**
 * When a town reaps each of its fields of grain (days of the year): one after another through the
 * harvest weeks in an order of their own, each over as many days as the weeks allow — two or three
 * at once — none of them left over; null for a field not of grain.
 */
export function reapingsOf(plan: Fields): readonly (Reaping | null)[] {
  const known = REAPINGS.get(plan);
  if (known) return known;
  // (A foraging people's grounds are not sown in rows, nor reaped.)
  const { crop } = cropsOf(plan),
    seed = hashText(`reaping ${plan.ref}`),
    sown = !!mannerOf(plan),
    grain = plan.fields
      .map((_, k) => k)
      .filter((k) => sown && crop[k] === "grain" && rowsOf(plan.fields[k]!) > 0)
      .sort((a, b) => unitOf(seed, a, 0) - unitOf(seed, b, 0)),
    first = Math.ceil(HARVEST[0] * 365),
    last = Math.ceil(HARVEST[1] * 365),
    weeks = last - first,
    n = grain.length,
    // (Two or three at once where there are many; where there are few, each long enough that
    // the next is begun before it is done.)
    span = Math.round(
      Math.max(
        REAP_DAYS[0],
        Math.min(
          Math.max(REAP_DAYS[1], Math.ceil(weeks / Math.max(1, n))),
          (weeks * 2) / Math.max(1, n),
        ),
      ),
    ),
    out: (Reaping | null)[] = plan.fields.map(() => null);
  grain.forEach((k, r) => {
    const from = first + Math.round((n > 1 ? r / (n - 1) : 0) * (weeks - span));
    out[k] = { from, to: from + span };
  });
  REAPINGS.set(plan, out);
  return out;
}

/** The first day of the year of moment t (days since the world began). */
function yearOf(t: number): number {
  const day = Math.floor(t / DAY);
  return day - (((day % 365) + 365) % 365);
}

/**
 * How far through its reaping a field is at t (0 … 1): by the working hours of its days gone,
 * its days of rest left out (none reaps then).
 */
export function reapedAt(plan: Fields, k: number, t: number): number {
  const r = reapingsOf(plan)[k];
  if (!r) return 0;
  const day = Math.floor(t / DAY),
    y0 = yearOf(t),
    from = y0 + r.from,
    to = y0 + r.to;
  if (day < from) return 0;
  if (day >= to) return 1;
  const hours = (REAP_HOURS[1] - REAP_HOURS[0]) * HOUR;
  let done = 0,
    all = 0;
  for (let d = from; d < to; d++) {
    if (restDay(plan, d)) continue;
    all++;
    if (d < day) done++;
    else if (d === day) done += clamp01((t - d * DAY - REAP_HOURS[0] * HOUR) / hours);
  }
  return all ? done / all : 1;
}

/** The fields being reaped on a day (days since the world began). */
export function reapingOn(plan: Fields, day: number): number[] {
  const yd = day - yearOf(day * DAY),
    out: number[] = [];
  reapingsOf(plan).forEach((r, k) => {
    if (r && yd >= r.from && yd < r.to) out.push(k);
  });
  return out;
}

/**
 * Where a field's reaping has come at t: the row being cut and how far along it (metres; the rows
 * cut back and forth, as a reaper turns at each row's end), the point and which way the cutting
 * goes (as the day's stays face: along x = sin, z = cos); before its reaping, its first row's
 * start, after it its last row's end. Null: a field not reaped.
 */
export function frontOf(
  plan: Fields,
  k: number,
  t: number,
): (Point & { readonly row: number; readonly along: number; readonly face: number }) | null {
  const f = plan.fields[k],
    r = reapingsOf(plan)[k];
  if (!f || !r) return null;
  const n = rowsOf(f),
    long = f.w - 2 * ROW_ENDS,
    cut = reapedAt(plan, k, t) * n * long,
    row = Math.min(n - 1, Math.floor(cut / long)),
    along = Math.min(long, cut - row * long),
    p = rowPoint(f, row, along, 0),
    forth = row % 2 === 0,
    // (Along its width, the field turned by its yaw: back or forth.)
    ux = Math.cos(f.yaw),
    uz = -Math.sin(f.yaw);
  return { ...p, row, along, face: forth ? Math.atan2(ux, uz) : Math.atan2(-ux, -uz) };
}

/**
 * Where one at a field's reaping works at t: so far behind its front along the rows it has cut
 * (metres: those who bind and stook behind those who cut), so far to its side (toward its next
 * row); and which way they face, the cutting's. Null: a field not reaped.
 */
export function cutPoint(
  plan: Fields,
  k: number,
  t: number,
  back: number,
  across: number,
): (Point & { readonly face: number }) | null {
  const f = plan.fields[k];
  if (!f || !reapingsOf(plan)[k]) return null;
  const n = rowsOf(f),
    long = f.w - 2 * ROW_ENDS,
    s = Math.max(0, Math.min(n * long, reapedAt(plan, k, t) * n * long - back)),
    row = Math.min(n - 1, Math.floor(s / long)),
    p = rowPoint(f, row, s - row * long, across),
    ux = Math.cos(f.yaw),
    uz = -Math.sin(f.yaw);
  return { ...p, face: row % 2 === 0 ? Math.atan2(ux, uz) : Math.atan2(-ux, -uz) };
}

/**
 * A point of a field's row `j`: so far along it from where its cutting begins (metres; the even
 * rows from the field's one side, the odd from its other), so far across it toward the next row
 * (a furrow's middle at half the rows' gap).
 */
export function rowPoint(
  f: VillagePlan["fields"][number],
  j: number,
  along: number,
  across: number,
): Point {
  const long = f.w - 2 * ROW_ENDS,
    a = Math.max(0, Math.min(long, along)),
    u = j % 2 === 0 ? -long / 2 + a : long / 2 - a;
  return fieldPoint(f, u / f.w, ((j + 1) * ROW_GAP + across) / f.d - 0.5);
}

/**
 * One of a field's rows at t, as its year stands: its standing crop along its length (from, to:
 * shares 0 … 1 from the field's one side) and how high (metres; none: 0); its stubble where it is
 * cut, and how high; whether a blight has taken it.
 */
export type RowNow = {
  readonly from: number;
  readonly to: number;
  readonly high: number;
  readonly stubble: number;
  readonly blighted: boolean;
};

const BARE: RowNow = { from: 0, to: 0, high: 0, stubble: 0, blighted: false };

/** Whether a blight running at `share` has taken row j of field k. */
export function blightedRow(
  plan: Pick<VillagePlan, "ref">,
  k: number,
  j: number,
  share: number,
): boolean {
  return share > 0 && unitOf(hashText(`blight ${plan.ref}`), k * 97 + j, 3) < share * MOST_BLIGHTED;
}

export function rowNow(plan: Fields, k: number, j: number, t: number, year: FieldsNow): RowNow {
  const crop = cropsOf(plan).crop[k];
  if (!crop) return BARE;
  const d = yearShare(t),
    grown = grownAt(crop, d);
  if (crop === "fallow") return { ...BARE, to: 1, high: CROP_HIGH.fallow * (1 - 0.35 * year.dry) };
  const blighted = blightedRow(plan, k, j, year.blight),
    high = CROP_HIGH[crop] * grown * standOf(year.growth) * (blighted ? WITHERED : 1);
  if (crop === "greens") return grown > 0 ? { ...BARE, to: 1, high, blighted } : BARE;
  // Grain: cut back and forth through its reaping, stubble till it is turned in.
  const f = plan.fields[k]!,
    n = rowsOf(f),
    cut = clamp01(reapedAt(plan, k, t) * n - j);
  if (d >= TURNED || (cut <= 0 && grown <= 0)) return BARE;
  const forth = j % 2 === 0;
  return {
    from: forth ? cut : 0,
    to: forth ? 1 : 1 - cut,
    high: cut >= 1 ? 0 : high,
    stubble: cut > 0 ? STUBBLE : 0,
    blighted,
  };
}

/**
 * The stooks in a field's stubble at t (where, which way): stood along each row as it is cut, a
 * few metres behind its reapers, as many as the year gave — none on a blighted row — and carried
 * in over the days after its reaping, the first stood the first gone.
 */
export function stooksOf(
  plan: Fields,
  k: number,
  t: number,
  year: FieldsNow,
): { readonly x: number; readonly z: number; readonly yaw: number }[] {
  const r = reapingsOf(plan)[k],
    f = plan.fields[k];
  if (!r || !f) return [];
  const yd = Math.floor(t / DAY) - yearOf(t);
  if (yd < r.from || yd >= r.to + STOOK_DAYS) return [];
  const n = rowsOf(f),
    long = f.w - 2 * ROW_ENDS,
    behind = reapedAt(plan, k, t) * n * long - 3,
    gap = STOOK_GAP / Math.max(0.3, Math.min(1.4, year.growth)),
    seed = hashText(`stooks ${plan.ref}`),
    out: { x: number; z: number; yaw: number }[] = [];
  for (let j = 0; j < n && j * long < behind; j++) {
    if (blightedRow(plan, k, j, year.blight)) continue;
    for (let a = gap / 2; a < long && j * long + a < behind; a += gap) {
      const p = rowPoint(f, j, a, 0);
      out.push({ ...p, yaw: f.yaw + unitOf(seed, k * 512 + j * 32 + out.length, 1) * Math.PI });
    }
  }
  // (Carried in after its reaping, by the working hours of the days since.)
  const done = (yearOf(t) + r.to) * DAY;
  if (t <= done) return out;
  const gone = clamp01((t - done - REAP_HOURS[0] * HOUR) / (STOOK_DAYS * DAY - 14 * HOUR));
  return out.slice(Math.round(out.length * gone));
}

/** The fields whose sheaves are carried in on a day: reaped, their stooks standing. */
export function stookedOn(plan: Fields, day: number): number[] {
  const yd = day - yearOf(day * DAY),
    out: number[] = [];
  reapingsOf(plan).forEach((r, k) => {
    if (r && yd >= r.to && yd < r.to + STOOK_DAYS) out.push(k);
  });
  return out;
}

/** The most reapers at a field's front: those beyond go to carry in the sheaves of a field reaped. */
export const REAPERS_AT = 8;

/** The most fields watered in a dry year, and pulled of their blight, at once. */
const MOST_WATERED = 4,
  MOST_PULLED = 4;

/** Whether a crop stands growing in a field on a day: sown, up, not yet reaped or lifted. */
function growing(plan: Fields, k: number, t: number): boolean {
  const crop = cropsOf(plan).crop[k];
  if (crop !== "grain" && crop !== "greens") return false;
  const g = grownAt(crop, yearShare(t));
  return g > 0.15 && reapedAt(plan, k, t) <= 0;
}

/** The sown fields standing on a day nearest the town's middle, so many. */
function nearestGrowing(
  plan: Fields,
  t: number,
  most: number,
  ok: (k: number) => boolean,
): number[] {
  return plan.fields
    .map((f, k) => ({ k, r: Math.hypot(f.x, f.z) }))
    .filter(({ k }) => growing(plan, k, t) && ok(k))
    .sort((a, b) => a.r - b.r || a.k - b.k)
    .slice(0, most)
    .map(({ k }) => k);
}

/** The parched fields a town carries water out to on a day (the nearest its middle), none in a fair year or on a day of rest. */
export function wateredOn(plan: Fields, day: number, year: FieldsNow): number[] {
  if (year.dry < 0.3 || restDay(plan, day)) return [];
  return nearestGrowing(plan, day * DAY + 12 * HOUR, MOST_WATERED, () => true);
}

/** The blighted fields a town pulls on a day (the nearest its middle with a row taken), none on a day of rest. */
export function pulledOn(plan: Fields, day: number, year: FieldsNow): number[] {
  if (year.blight < 0.12 || restDay(plan, day)) return [];
  return nearestGrowing(plan, day * DAY + 12 * HOUR, MOST_PULLED, (k) => {
    for (let j = 0, n = rowsOf(plan.fields[k]!); j < n; j++)
      if (blightedRow(plan, k, j, year.blight)) return true;
    return false;
  });
}

/** The hours the blighted crop is burned. */
export const BURN_HOURS: readonly [number, number] = [9, 17];

/** Where a field's pulled blight is burned: a heap inside its corner farthest from the town. */
export function burnSpot(f: VillagePlan["fields"][number]): Point {
  let best: Point = { x: f.x, z: f.z },
    far = -1;
  for (const [u, v] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ] as const) {
    const p = fieldPoint(f, u * (0.5 - 2.5 / f.w), v * (0.5 - 1.2 / f.d)),
      r = Math.hypot(p.x, p.z);
    if (r > far) {
      far = r;
      best = p;
    }
  }
  return best;
}

/** The fires the pulled blight burns on at moment t (where, of which field). */
export function blightFires(
  plan: Fields,
  t: number,
  year: FieldsNow,
): (Point & { readonly field: number })[] {
  const day = Math.floor(t / DAY),
    hour = (t - day * DAY) / HOUR;
  if (hour < BURN_HOURS[0] || hour >= BURN_HOURS[1]) return [];
  return pulledOn(plan, day, year).map((k) => ({ ...burnSpot(plan.fields[k]!), field: k }));
}

const PARCHED: Rgb = [0.72, 0.64, 0.4],
  RICH: Rgb = [0.16, 0.42, 0.14],
  SALLOW: Rgb = [0.66, 0.68, 0.34],
  PALE_GOLD: Rgb = [0.8, 0.74, 0.52],
  DEEP_GOLD: Rgb = [0.9, 0.7, 0.2];
/** A blighted row's colour: the crop rotting where it stands. */
export const BLIGHTED: Rgb = [0.3, 0.22, 0.12];

/**
 * A crop's colour at moment t as its year stands: parched toward straw in a dry year, deep under
 * rain sent or a blessing, yellowed where the soil is worn; ripe, a pale gold in a poor year and a
 * deep one in a rich.
 */
export function cropTint(crop: Crop, t: number, year: FieldsNow): Rgb {
  const base = cropColor(crop, t),
    d = yearShare(t),
    ripe = crop === "grain" && d >= 0.6 && d < 0.75;
  if (ripe)
    return blend(
      blend(base, PALE_GOLD, clamp01(year.dry * 0.8 + year.worn * 0.3)),
      DEEP_GOLD,
      clamp01(year.blessed * 0.6 + year.lush * 0.3),
    );
  return blend(
    blend(blend(base, PARCHED, year.dry * 0.75), SALLOW, year.worn * 0.45),
    RICH,
    clamp01(year.lush * 0.45 + year.blessed * 0.4) * (1 - year.dry),
  );
}

/** The stubble's colour: pale straw, greyer in a dry year. */
export function stubbleTint(year: FieldsNow): Rgb {
  return blend([0.74, 0.65, 0.42], [0.7, 0.66, 0.54], year.dry);
}

/** The field's earth between its rows: darker in a wet year, pale and dusty in a dry one. */
export function soilTint(year: FieldsNow): Rgb {
  return blend(blend([0.42, 0.32, 0.22], [0.6, 0.52, 0.4], year.dry), [0.3, 0.23, 0.17], year.lush);
}

/** Grass in a dry year: browning toward straw (the pasture, the fallow). */
export function grassTint(base: Rgb, year: FieldsNow): Rgb {
  return blend(base, PARCHED, year.dry * 0.7);
}

/**
 * The year in the fields in words, for the town's stores card: how the crop stands and why, its
 * reaping under way. Null: a fair year with nothing to tell.
 */
export function fieldsWords(plan: VillagePlan, t: number): string | null {
  const year = fieldsNow(plan, t),
    y = plan.life?.fields,
    told: string[] = [],
    pct = (x: number) => `${Math.round(x * 100)}%`;
  if (!y) return null;
  if (year.blight > 0.05)
    told.push("blight running through the crop — the god's hand on the harvest");
  else if (year.blessed > 0.05) told.push("the crop standing heavy — the harvest blessed");
  if (year.dry > 0.2)
    told.push(
      `parched: the rain at ${pct(year.rain)} of its usual${y.sent < 0 ? ", the god withholding it" : ""}`,
    );
  else if (year.lush > 0.2)
    told.push(
      `lush: the rain at ${pct(year.rain)} of its usual${y.sent > 0 ? ", sent by the god" : ""}`,
    );
  if (year.worn > 0.2) told.push(`the soil worn thin (${pct(y.soil)} of what it was)`);
  if (y.vermin > 0.03) told.push(`vermin in the grain (${pct(y.vermin)} of it eaten)`);
  const day = Math.floor(t / DAY),
    reaping = reapingOn(plan, day).length;
  if (reaping) told.push(`${reaping} field${reaping > 1 ? "s" : ""} being reaped`);
  if (!told.length) return null;
  const give = Math.max(0, year.growth);
  return `The fields: ${told.join("; ")} — about ${pct(give)} of a fair year's crop`;
}
