// A land's weather, day by day (Phase 30 M162, asked for 2026-10-24: "i should be able to be in
// my game ... watch it emerge and be able to pause and influence and all that"): the near views —
// a land, a town, a band's camp — play their land's weather from its climate: showers as often as
// its rain falls, heavy in a wet year and seldom in a dry one, snow in its cold months, storms in
// its warm wet ones, a drought's dry haze; and the god's rain poured down where it is sent, the sky
// left bare and hazed where it is withheld. The world reckons rain by the year; its days and hours
// are the view's own, the same for the same land and moment. Pure.
import { DAY, YEAR } from "../kernel/index.ts";
import type { LandSky } from "../bridge/index.ts";

export type Weather = {
  /** How hard it rains, and snows, now (0 … 1). */
  readonly rain: number;
  readonly snow: number;
  /** How grey the sky is (0 clear … 1 overcast). */
  readonly cloud: number;
  /** A dry year's haze over the land (0 … 1). */
  readonly haze: number;
  /** A lightning flash now (0 … 1). */
  readonly flash: number;
  /** The air now (°C). */
  readonly warmth: number;
  /** The weather in a few words, and its sign. */
  readonly words: string;
  readonly icon: string;
};

/** A spell of weather: four hours, wet or dry, its rain heavy or light. */
const SPELL = DAY / 6;
/** How much of a spell's end it takes to turn into the next. */
const TURN = 0.18;
/** Below this, it snows; up to SLEET over it, rain and snow together (°C). */
const SNOW = 0,
  SLEET = 2;
/** A storm: rain this heavy in air this warm. */
const STORM_RAIN = 0.72,
  STORM_WARMTH = 14;

/** A number in [0, 1) of its own for a land, a spell and a kind of draw. */
function draw(cell: number, spell: number, kind: number): number {
  let h =
    (Math.imul(cell ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(spell + 0x632be5ab, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 15) ^ Math.imul(kind, 0x27d4eb2d), 0x2c1b3c6d) >>> 0;
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const smooth = (x: number) => x * x * (3 - 2 * x);

/** The share of a land's spells that are wet: by its rain, this year's, and the god's. */
export function wetShare(land: LandSky): number {
  // (A spell in six wet where 800 mm fall in a year; one in forty in a desert; a rainforest's
  // afternoon storms most days.)
  const x = land.wet / 800,
    usual = clamp(x <= 1 ? 0.17 * x : 0.17 + 0.1 * (x - 1), 0.01, 0.5);
  if (land.sent > 0) return Math.max(0.85, usual * 2);
  if (land.sent < 0) return 0;
  return clamp(usual * Math.pow(clamp(land.year, 0.3, 1.8), 1.6), 0.01, 0.7);
}

/** The air of a land at moment t (°C): its mean, its season (0 midwinter), and its hour if `hourly`. */
export function warmthAt(land: LandSky, t: number, hourly = true): number {
  const year = (((t % YEAR) + YEAR) % YEAR) / YEAR,
    hour = (((t % DAY) + DAY) % DAY) / DAY;
  return (
    land.warmth -
    land.swing * Math.cos(2 * Math.PI * year) +
    (hourly ? 4 * Math.sin(2 * Math.PI * (hour - 0.375)) : 0)
  );
}

/**
 * How finely the weather is told at a pace of the clock (world seconds a second): by the spell
 * while hours pass watched; by the day while days pass a second or so (each day's own sky);
 * faster, by the season (a day's weather would flicker).
 */
export function weatherGrain(pace: number): "spell" | "day" | "season" {
  return pace > 2 * DAY ? "season" : pace > DAY / 4 ? "day" : "spell";
}

/**
 * A land's weather at moment t, at a pace of the clock (world seconds a second; told finely or by
 * the day or the season, weatherGrain). `wall`: seconds of the viewer's own time while the
 * clock runs (a storm's lightning), else null.
 */
export function weatherAt(land: LandSky, t: number, pace = 0, wall: number | null = null): Weather {
  const grain = weatherGrain(pace),
    fine = grain === "spell",
    share = wetShare(land),
    warmth = warmthAt(land, t, fine),
    hour = (((t % DAY) + DAY) % DAY) / DAY,
    // (Told by the day or the season, it is told as by day.)
    day = !fine || (hour > 0.27 && hour < 0.77),
    // A dry year's haze by day; the god's withholding, the more.
    dry =
      land.sent < 0
        ? 0.75
        : land.sent === 0 && land.year < 0.72
          ? clamp((0.72 - land.year) / 0.3, 0.25, 0.7)
          : 0,
    haze = day ? dry : dry * 0.3;
  let wet: number, grey: number;
  if (grain === "season") {
    // (The season's sky: as grey as its spells are wet; rain only where the god sends it.)
    wet = land.sent > 0 ? 0.6 : 0;
    grey = land.sent > 0 ? 0.85 : land.sent < 0 ? 0 : clamp(share * 0.9, 0, 0.6);
  } else {
    // (By the day: each day its midday's spell, turning into the next at the day's end.)
    const span = fine ? SPELL : DAY,
      at = t / span,
      k = Math.floor(at),
      u = at - k,
      key = (n: number) => (fine ? n : n * 6 + 2),
      spell = (m: number) => {
        const n = key(m),
          r = draw(land.cell, n, 0),
          q = draw(land.cell, n, 1);
        if (r < share)
          return {
            wet: (land.sent > 0 ? 0.6 : 0.2) + (land.sent > 0 ? 0.4 : 0.8) * q,
            grey: 0.6 + 0.4 * q,
          };
        // (Dry, but grey a while either side of the wet.)
        return { wet: 0, grey: r < Math.min(0.92, share * 1.7) ? 0.38 : 0.06 * q };
      },
      a = spell(k),
      b = spell(k + 1),
      w = u > 1 - TURN ? smooth((u - (1 - TURN)) / TURN) : 0;
    wet = a.wet + (b.wet - a.wet) * w;
    grey = a.grey + (b.grey - a.grey) * w;
  }
  // Snow in the cold, rain and snow together about the freezing, rain above it.
  const snowy = warmth < SNOW ? 1 : warmth < SLEET ? (SLEET - warmth) / (SLEET - SNOW) : 0,
    snow = wet * snowy,
    rain = wet - snow,
    stormy = fine && rain > STORM_RAIN && warmth > STORM_WARMTH;
  let flash = 0;
  if (stormy && wall !== null) {
    const beat = Math.floor(wall / 1.1),
      since = wall - beat * 1.1;
    if (draw(land.cell + 7919, beat, 2) < 0.22) flash = Math.max(0, 1 - since / 0.22);
  }
  const cloud = clamp(Math.max(grey, wet > 0 ? 0.55 + 0.45 * wet : 0) - haze * 0.5, 0, 1),
    [icon, words] =
      land.sent > 0 && wet > 0
        ? snow > rain
          ? ["🌨️", "Snow sent by your hand"]
          : ["🌧️", "Rain sent by your hand"]
        : land.sent < 0
          ? ["☀️", "Dry: the rain withheld by your hand"]
          : stormy
            ? ["⛈️", "A thunderstorm"]
            : snow > 0.05 && rain > 0.05
              ? ["🌨️", "Sleet"]
              : snow > 0.55
                ? ["❄️", "Snow"]
                : snow > 0
                  ? ["🌨️", "Light snow"]
                  : rain > 0.55
                    ? ["🌧️", "Heavy rain"]
                    : rain > 0
                      ? ["🌦️", "Showers"]
                      : haze > 0.2
                        ? ["🌫️", "Dry haze: a year of drought"]
                        : cloud > 0.5
                          ? ["☁️", "Overcast"]
                          : cloud > 0.25
                            ? ["⛅", "Some cloud"]
                            : day
                              ? ["☀️", "Clear"]
                              : ["🌙", "A clear night"];
  return { rain, snow, cloud, haze, flash, warmth, words, icon };
}

/** Rain or snow this heavy sends those at their ease indoors. */
const DOWNPOUR = 0.5;

/**
 * The downpour a land is under at moment t, as weatherAt tells its weather at the pace: the span
 * (world seconds) of its heavy spells about t — from halfway through the rain coming on to
 * halfway through its going — or null while none falls. Told by the season, a downpour is the
 * god's rain, for as long as it is sent.
 */
export function downpourAt(
  land: LandSky,
  t: number,
  pace = 0,
): { readonly from: number; readonly to: number } | null {
  const grain = weatherGrain(pace),
    share = wetShare(land);
  if (grain === "season") return land.sent > 0 ? { from: -Infinity, to: Infinity } : null;
  const fine = grain === "spell",
    span = fine ? SPELL : DAY,
    heavy = (m: number) => {
      const n = fine ? m : m * 6 + 2;
      if (draw(land.cell, n, 0) >= share) return false;
      const q = draw(land.cell, n, 1);
      return (land.sent > 0 ? 0.6 + 0.4 * q : 0.2 + 0.8 * q) >= DOWNPOUR;
    },
    // (A spell's rain comes on over the turning before it: told from halfway through it.)
    k = Math.floor(t / span + TURN / 2);
  if (!heavy(k)) return null;
  let first = k,
    last = k;
  while (first > k - 12 && heavy(first - 1)) first--;
  while (last < k + 12 && heavy(last + 1)) last++;
  return { from: (first - TURN / 2) * span, to: (last + 1 - TURN / 2) * span };
}

/**
 * How the ground stands at a moment of the year (Phase 30 M164): snow lying (0 … 1), the broad
 * leaves (0 bare … 1 in full leaf) and how far they have turned (0 green … 1 in autumn's
 * colours), ice on still water (0 … 1). `rise`: metres above the land's middle (the air is
 * colder up high: snow lies on the hills first).
 */
export type GroundSeason = {
  readonly snow: number;
  readonly leaf: number;
  readonly turned: number;
  readonly ice: number;
};

/** How much colder the air is a metre up (°C). */
const LAPSE = 0.0065;
/** Snow lies, and ice holds, as the air was a while ago (they come and go behind it). */
const LAG = 12 * DAY;

export function seasonAt(land: LandSky, t: number, rise = 0): GroundSeason {
  const was = warmthAt(land, t - LAG, false) - LAPSE * rise,
    now = warmthAt(land, t, false) - LAPSE * rise,
    year = (((t % YEAR) + YEAR) % YEAR) / YEAR,
    // (Where the year swings, the broad leaves fall in its cold and turn as it cools.)
    seasonal = land.swing >= 5 && land.warmth < 22,
    leaf = seasonal ? clamp((now - 2) / 5, 0, 1) : 1,
    // (Snow lies as deep as the land's snows fall: none on a polar desert — unless the god sends
    // them, and then as on a wet land.)
    wet = land.sent > 0 ? Math.max(land.wet, 800) : land.wet;
  return {
    snow: wet < 40 ? 0 : clamp((0.5 - was) / 5, 0, 1) * clamp(wet / 250, 0.25, 1),
    leaf,
    turned: seasonal && year > 0.5 ? clamp((14 - now) / 6, 0, 1) : 0,
    ice: clamp((-was - 2) / 6, 0, 1),
  };
}

type Rgb = readonly [number, number, number];
const SNOW_LYING: Rgb = [0.92, 0.94, 0.98],
  AUTUMN: Rgb = [0.82, 0.46, 0.12],
  BARE: Rgb = [0.4, 0.33, 0.25],
  ICE: Rgb = [0.8, 0.88, 0.95];
const mix = (a: Rgb, b: Rgb, k: number): Rgb => [
  a[0] + (b[0] - a[0]) * k,
  a[1] + (b[1] - a[1]) * k,
  a[2] + (b[2] - a[2]) * k,
];

/** The ground's colour as the season leaves it: snow lying over it. */
export function seasonGround(c: Rgb, s: GroundSeason): Rgb {
  return mix(c, SNOW_LYING, s.snow * 0.92);
}

/** Broad leaves as the season leaves them: green, turned, fallen to bare twigs; snow on them. */
export function seasonLeaf(c: Rgb, s: GroundSeason): Rgb {
  return mix(mix(BARE, mix(c, AUTUMN, s.turned), s.leaf), SNOW_LYING, s.snow * 0.45);
}

/** Needles keep green through the year, but for the snow on them. */
export function seasonNeedle(c: Rgb, s: GroundSeason): Rgb {
  return mix(c, SNOW_LYING, s.snow * 0.5);
}

/** Still water, frozen over. */
export function seasonWater(c: Rgb, s: GroundSeason): Rgb {
  return mix(c, ICE, s.ice);
}

/** A season to the twentieth (scenes recolour only when it changes). */
export function seasonKey(s: GroundSeason): string {
  const q = (x: number) => Math.round(x * 20);
  return `${q(s.snow)}:${q(s.leaf)}:${q(s.turned)}:${q(s.ice)}`;
}
