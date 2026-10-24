// The clock at every scale (asked for 2026-10-24: "the land view rn i cant even adjust time and
// also the amount i can adjust time should be more clever and relative of what level im
// viewing"): each scale's speeds are those it is watched at — minutes and hours a second over a
// town, days to years over a land, months to centuries over a world, days to a year among a
// star's worlds, years to centuries among the stars. Each scale keeps the speed last chosen at
// it; a pause holds across them all; a window that waits on the viewer holds the clock until it
// is let be, and a speed the viewer chooses lets every hold go. Pure: what runs, and how fast.

const MINUTE = 60,
  HOUR = 3600,
  DAY = 86_400,
  WEEK = 7 * DAY,
  MONTH = 30 * DAY,
  YEAR = 365 * DAY;

/** The scales time is watched at (the sandbox's ring of cells among them). */
export type TimeScale =
  "camp" | "village" | "region" | "globe" | "world" | "system" | "cluster" | "galaxy" | "ring";

/** A scale's speeds (sim seconds a real second), slowest first, and the one it opens at. */
export type TimeLadder = { readonly speeds: readonly number[]; readonly start: number };

export const TIME_LADDERS: Readonly<Record<TimeScale, TimeLadder>> = {
  // A town close: a person's day (a minute, an hour a second), a day a second, and its months
  // and years going by, for the town to be watched growing.
  // A band of a camp seen near (Phase 29 M160): their day in two minutes, in one, in forty seconds.
  camp: { speeds: [12 * MINUTE, 24 * MINUTE, 36 * MINUTE], start: 12 * MINUTE },
  village: { speeds: [MINUTE, HOUR, DAY, MONTH, YEAR], start: HOUR },
  // A land: a day or a week a second (a host on the march), its months, its years and decades.
  region: { speeds: [DAY, WEEK, MONTH, YEAR, 10 * YEAR], start: MONTH },
  // A world, ours or another seen whole: its months, years, decades and centuries.
  globe: { speeds: [MONTH, YEAR, 10 * YEAR, 100 * YEAR], start: YEAR },
  world: { speeds: [MONTH, YEAR, 10 * YEAR, 100 * YEAR], start: YEAR },
  // A star's system: its worlds going round, a day to a year a second.
  system: { speeds: [DAY, 10 * DAY, MONTH, YEAR], start: MONTH },
  // The stars: years to centuries a second, for ships to be seen crossing between them.
  cluster: { speeds: [YEAR, 10 * YEAR, 100 * YEAR], start: 10 * YEAR },
  galaxy: { speeds: [YEAR, 10 * YEAR, 100 * YEAR], start: 10 * YEAR },
  ring: { speeds: [DAY, MONTH, YEAR], start: MONTH },
};

/** Faster than this, a town is watched growing rather than living its day (its light held at day). */
export const LAPSE = 2 * DAY;

/** The clock's state: the scale watched, the speed chosen at each, the pause, the holds. */
export class TimeState {
  scale: TimeScale;
  /** Paused by the viewer: held across every scale until they go on. */
  paused = false;
  private readonly chosen = new Map<TimeScale, number>();
  private readonly holds = new Set<string>();

  constructor(scale: TimeScale) {
    this.scale = scale;
  }

  /** The speed a scale runs at when it runs: the last chosen there, else its own first. */
  speedAt(scale: TimeScale = this.scale): number {
    return this.chosen.get(scale) ?? TIME_LADDERS[scale].start;
  }

  /** Whether the clock is stopped: paused, or held by something waiting on the viewer. */
  get stopped(): boolean {
    return this.paused || this.holds.size > 0;
  }

  /** The speed the world runs at now. */
  get speed(): number {
    return this.stopped ? 0 : this.speedAt();
  }

  /** The speed of the scale's ladder that is lit: 0 stopped, i the i-th speed, -1 one of its own. */
  get lit(): number {
    if (this.stopped) return 0;
    const i = TIME_LADDERS[this.scale].speeds.indexOf(this.speedAt());
    return i < 0 ? -1 : i + 1;
  }

  /** A speed chosen at the scale watched (0 pauses): the viewer's word, so every hold goes. */
  choose(speed: number): void {
    if (!(speed > 0)) {
      this.paused = true;
      return;
    }
    this.paused = false;
    this.holds.clear();
    this.chosen.set(this.scale, speed);
  }

  /** The scale's i-th speed (1 the slowest; 0 pauses); false where the ladder has no such rung. */
  pick(i: number): boolean {
    if (i === 0) {
      this.choose(0);
      return true;
    }
    const s = TIME_LADDERS[this.scale].speeds[i - 1];
    if (s === undefined) return false;
    this.choose(s);
    return true;
  }

  /** Pause, or go on at the scale's speed (letting go of any hold). */
  toggle(): void {
    if (this.stopped) {
      this.paused = false;
      this.holds.clear();
    } else this.paused = true;
  }

  /** Held still by `who` (a window waiting on the viewer) until it lets go. */
  hold(who: string): void {
    this.holds.add(who);
  }

  release(who: string): void {
    this.holds.delete(who);
  }
}

/** A speed as a button says it: "1 hour/s", "10 years/s". */
export function speedLabel(s: number): string {
  const n = (v: number, one: string, many = `${one}s`) =>
    `${Math.round(v)} ${Math.round(v) === 1 ? one : many}/s`;
  if (s >= YEAR) return n(s / YEAR, "year");
  if (s >= MONTH && s % MONTH === 0) return n(s / MONTH, "month");
  if (s >= WEEK && s % WEEK === 0) return n(s / WEEK, "week");
  if (s >= DAY) return n(s / DAY, "day");
  if (s >= HOUR) return n(s / HOUR, "hour");
  return n(s / MINUTE, "min", "min");
}
