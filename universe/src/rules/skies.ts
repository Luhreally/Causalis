// A world's air and what it keeps off and lets go (the planet's last gaps, 2026-11-24). Pure functions.
//
// - Escape: a star's wind tears at the top of an air its world's field does not hold it off; what it carries away a billion
//   years is as the wind's pressure, the share of it the field lets through and the face the world shows it, over the weight
//   of its air and the depth of the well it must climb out of (its mass over its radius). A small unsheltered world near an
//   active star is left thin air; a heavy one, or one behind a field, keeps its own. Its fire below breathes air back, so it
//   thins toward where the two balance and not to nothing.
import { dmath } from "../kernel/index.ts";

export const ESCAPE = {
  /**
   * The share of an Earth's air an unsheltered Earth would lose a billion years to the Sun's wind at Earth's distance (est:
   * fitted so that a world of Mars's size and place, with no field, loses about a quarter of a bar-deep air in four billion).
   */
  rate: 0.15,
  /** The share of its air a world's fire below breathes back a billion years, where its plates turn (est). */
  breath: 0.2,
  /** Under this share lost a world's air is as it was made (nothing is reckoned). */
  least: 0.05,
} as const;

/**
 * The share of its air a world loses a billion years to its star's wind: the wind's pressure at its orbit (the Sun's at Earth
 * 1), the share its field keeps off (0 … 1), its mass and radius against Earth's and its air's pressure in bars.
 */
export function airLoss(w: {
  readonly wind: number;
  readonly shelter: number;
  readonly mass: number;
  readonly radius: number;
  readonly pressure: number;
}): number {
  // (Its face over its well's depth: R² over M/R. The weight of its air: its pressure over its pull, on its face.)
  const well = (w.radius * w.radius * w.radius) / Math.max(0.01, w.mass);
  return (
    (ESCAPE.rate * Math.max(0, w.wind) * dmath.clamp(1 - w.shelter, 0, 1) * well) /
    Math.max(0.05, w.pressure)
  );
}

/**
 * What is left of a world's air after so many billion years of losing that share, its fire below breathing some back (`fire`:
 * 1 where its plates turn): it falls toward where the two balance. 1 where the loss is under a twentieth.
 */
export function airKept(lossAGyr: number, gyr: number, fire = 1): number {
  const loss = Math.max(0, lossAGyr),
    back = ESCAPE.breath * Math.max(0, fire),
    rests = loss + back > 0 ? back / (loss + back) : 1,
    kept = rests + (1 - rests) * dmath.exp(-(loss + back) * Math.max(0, gyr));
  return 1 - kept < ESCAPE.least ? 1 : kept;
}

// - The shield: an air that holds free oxygen makes ozone high up, which stops the star's hard light (the ultraviolet that
//   breaks what living things are built of). The ozone goes as the oxygen's pressure to a low power (Kasting: a tenth of the
//   oxygen still makes most of the shield); a haze of tholins shields as well; and a cool star gives little hard light to stop.
//   What reaches the ground harms leaves that stand in the open: land growth and fields give less under it; the sea shields
//   its own. A star's great flare let through its world's field, or a supernova's burst, strips the ozone while it lasts.

export const SHIELD = {
  /** How deep Earth's ozone is to the hard light at the ground (it lets through some thirtieth). */
  depth: 3.5,
  /** The power of the oxygen's pressure its ozone goes by. */
  power: 0.3,
  /** Earth's oxygen, bars. */
  earthO2: 0.2095,
  /** The wavelength the hard light is reckoned at, as hc/λk in kelvin (300 nm), and the Sun's face's warmth. */
  hardK: 47960,
  sunK: 5778,
  /** The hard light living things mend as fast as it breaks them, against Earth's (est: half as much again). */
  bears: 1.5,
  /** The share of a land's growth lost for each multiple of Earth's hard light at its ground past what they bear (est). */
  crop: 0.02,
  /** The share of the ozone stripped for each share more of deaths a burst or a flare lays on its world (half at a supernova 26 light-years off). */
  strip: 2.4,
  /** The same for a star's flare let through its world's field: its particles strip a third as much as a burst's light (est). */
  flare: 0.8,
  most: 0.9,
} as const;

/** A world's ozone against Earth's, by the pressure of the free oxygen in its air (bars): none where there is none. */
export function ozoneColumn(o2Bar: number): number {
  return o2Bar > 0 ? dmath.pow(o2Bar / SHIELD.earthO2, SHIELD.power) : 0;
}

/** The hard light in a star's light against the Sun's, by its face's warmth (kelvin): Planck's law at 300 nm, over its whole light. */
export function hardLight(starK: number): number {
  const t = Math.max(1500, starK),
    at = (k: number) => 1 / (dmath.exp(SHIELD.hardK / k) - 1) / (k * k * k * k);
  return at(t) / at(SHIELD.sunK);
}

/** The hard light at a world's ground against Earth's: its star's, through its ozone (Earth's 1) and its haze. */
export function hardAtGround(hard: number, ozone: number, haze: boolean): number {
  return hard * dmath.exp(-SHIELD.depth * (Math.max(0, ozone) + (haze ? 1 : 0) - 1));
}

/** What the hard light leaves of growth in the open (1 at what living things bear and under it). */
export function growthUnderHard(uv: number): number {
  return 1 / (1 + SHIELD.crop * Math.max(0, uv - SHIELD.bears));
}

/** The share of its ozone a burst strips (or a flare, `flare`), by what it lays on its world's deaths (1: nothing). */
export function ozoneStripped(harm: number, flare = false): number {
  return dmath.clamp((flare ? SHIELD.flare : SHIELD.strip) * (harm - 1), 0, SHIELD.most);
}
