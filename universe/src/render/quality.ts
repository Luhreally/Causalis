// Quality (Phase 8 M76): how finely the world is drawn and how deep the microscope looks,
// by a setting the viewer chooses — or Auto, which starts from the device and moves by
// the frames it holds. Presentation only: no setting changes the history (§2), only how
// much of it is shown and how richly.

export const QUALITY_NAMES = ["low", "balanced", "high", "ultra"] as const;
export type QualityName = (typeof QUALITY_NAMES)[number];

export type Quality = {
  readonly name: QualityName;
  /** The most device pixels drawn to a CSS pixel. */
  readonly pixelRatio: number;
  /** Shadows cast by the sun on the ground's scales, and their map's size. */
  readonly shadows: boolean;
  readonly shadowResolution: number;
  /** Clouds over the globe; glows about the globe's rim, stars and the sun. */
  readonly clouds: boolean;
  readonly glows: boolean;
  /** Figures of a crowd per cell and class (the sandbox's). */
  readonly crowdCap: number;
  /** Trees over a region at most; a village's trees against the full count. */
  readonly regionTrees: number;
  readonly villageTrees: number;
  /** Wild beasts, birds and fish drawn about a village or over a region at most. */
  readonly wildlife: number;
  /** How finely bodies, homes and tools are built: 0 plain … 3 the finest. */
  readonly detail: 0 | 1 | 2 | 3;
  /** Small motions: smoke, the sway of trees, birds' wings, the idle shifting of people. */
  readonly motion: boolean;
  /** Families of a village the microscope meets (its depth; the observer's work). */
  readonly families: number;
  /** Lots of its towns a land draws at most (its great cities' far lots their sprawl). */
  readonly landLots: number;
  /** Carts, trains and ships going along a land's ways at most (Phase 26 M153). */
  readonly landTraffic: number;
};

export const QUALITIES: Readonly<Record<QualityName, Quality>> = {
  low: {
    name: "low",
    pixelRatio: 1,
    shadows: false,
    shadowResolution: 512,
    clouds: false,
    glows: false,
    crowdCap: 24,
    regionTrees: 2400,
    villageTrees: 0.35,
    wildlife: 30,
    detail: 0,
    motion: false,
    families: 5,
    landLots: 2500,
    landTraffic: 40,
  },
  balanced: {
    name: "balanced",
    pixelRatio: 1.5,
    shadows: false,
    shadowResolution: 1024,
    clouds: true,
    glows: true,
    crowdCap: 40,
    regionTrees: 6000,
    villageTrees: 0.7,
    wildlife: 80,
    detail: 1,
    motion: true,
    families: 8,
    landLots: 6000,
    landTraffic: 120,
  },
  high: {
    name: "high",
    pixelRatio: 2,
    shadows: true,
    shadowResolution: 1024,
    clouds: true,
    glows: true,
    crowdCap: 80,
    regionTrees: 10000,
    villageTrees: 1,
    wildlife: 160,
    detail: 2,
    motion: true,
    families: 10,
    landLots: 12000,
    landTraffic: 240,
  },
  ultra: {
    name: "ultra",
    pixelRatio: 3,
    shadows: true,
    shadowResolution: 2048,
    clouds: true,
    glows: true,
    crowdCap: 140,
    regionTrees: 18000,
    villageTrees: 1.4,
    wildlife: 320,
    detail: 3,
    motion: true,
    families: 14,
    landLots: 24000,
    landTraffic: 400,
  },
};

/**
 * Auto: the setting moves by the frames the device holds. Frame times (ms) are gathered
 * in windows; a window whose slower frames run past `slow` steps down, and windows
 * that all run well under `fast` step up (after a while, so it does not hunt), never
 * past `ceiling`. A screen that shows its frames at its own pace (sixty a second: a phone's)
 * never runs under `fast`: a long spell of windows at its pace (under `steady`) tries the
 * setting above — not one too slow lately, and the longer the more often it was (M197: a device
 * stepped down by a heavy moment is not held down for good). A pure state machine: fed frame
 * times, it says where to go.
 */
export class AutoQuality {
  private readonly window: number[] = [];
  private calm = 0;
  /** Windows at the screen's own pace in a row; windows seen; when each setting was last too slow, and how often. */
  private even = 0;
  private windows = 0;
  private readonly fell: Partial<Record<QualityName, { at: number; times: number }>> = {};
  current: QualityName;
  readonly ceiling: QualityName;
  /** Frame time (ms) past which a window is too slow, and under which it is easy. */
  readonly slow: number;
  readonly fast: number;
  /** Frames to a window; easy windows before stepping up. */
  readonly size: number;
  readonly patience: number;
  /** Frame time (ms) under which a window keeps a sixty-a-second screen's pace; windows to wait, at the least, before trying again a setting that was too slow. */
  readonly steady: number;
  readonly cool: number;
  constructor(
    start: QualityName,
    ceiling: QualityName = "ultra",
    slow = 22,
    fast = 12,
    size = 90,
    patience = 4,
    steady = 18,
    cool = 40,
  ) {
    this.current = start;
    this.ceiling = ceiling;
    this.slow = slow;
    this.fast = fast;
    this.size = size;
    this.patience = patience;
    this.steady = steady;
    this.cool = cool;
  }

  /** One frame's time; returns the new setting when it should change, else null. */
  frame(ms: number): QualityName | null {
    this.window.push(ms);
    if (this.window.length < this.size) return null;
    const sorted = [...this.window].sort((a, b) => a - b),
      // The slower frames of the window (its 80th percentile): a hitch alone does not count.
      p80 = sorted[Math.floor(sorted.length * 0.8)]!;
    this.window.length = 0;
    this.windows++;
    const at = QUALITY_NAMES.indexOf(this.current),
      top = QUALITY_NAMES.indexOf(this.ceiling);
    if (p80 > this.slow && at > 0) {
      this.calm = 0;
      this.even = 0;
      const was = this.fell[this.current];
      this.fell[this.current] = { at: this.windows, times: (was?.times ?? 0) + 1 };
      return (this.current = QUALITY_NAMES[at - 1]!);
    }
    if (p80 < this.fast) {
      this.even = 0;
      if (++this.calm >= this.patience && at < top) {
        this.calm = 0;
        return (this.current = QUALITY_NAMES[at + 1]!);
      }
      return null;
    }
    this.calm = 0;
    if (p80 >= this.steady) {
      this.even = 0;
      return null;
    }
    // At the screen's own pace: after a long spell, the setting above tried — if it was not too
    // slow lately (the wait doubling each time it was).
    const above = QUALITY_NAMES[at + 1],
      fell = above ? this.fell[above] : undefined,
      rested = !fell || this.windows - fell.at >= this.cool * 2 ** (fell.times - 1);
    if (++this.even >= this.patience * 4 && above && at < top && rested) {
      this.even = 0;
      return (this.current = above);
    }
    return null;
  }
}
