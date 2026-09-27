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
    regionTrees: 800,
    villageTrees: 0.35,
    wildlife: 30,
    detail: 0,
    motion: false,
    families: 5,
  },
  balanced: {
    name: "balanced",
    pixelRatio: 1.5,
    shadows: false,
    shadowResolution: 1024,
    clouds: true,
    glows: true,
    crowdCap: 40,
    regionTrees: 2500,
    villageTrees: 0.7,
    wildlife: 80,
    detail: 1,
    motion: true,
    families: 8,
  },
  high: {
    name: "high",
    pixelRatio: 2,
    shadows: true,
    shadowResolution: 1024,
    clouds: true,
    glows: true,
    crowdCap: 80,
    regionTrees: 4000,
    villageTrees: 1,
    wildlife: 160,
    detail: 2,
    motion: true,
    families: 10,
  },
  ultra: {
    name: "ultra",
    pixelRatio: 3,
    shadows: true,
    shadowResolution: 2048,
    clouds: true,
    glows: true,
    crowdCap: 140,
    regionTrees: 8000,
    villageTrees: 1.4,
    wildlife: 320,
    detail: 3,
    motion: true,
    families: 14,
  },
};

/**
 * Auto: the setting moves by the frames the device holds. Frame times (ms) are gathered
 * in windows; a window whose slower frames run past `slow` steps down, and windows
 * that all run well under `fast` step up (after a while, so it does not hunt), never
 * past `ceiling`. A pure state machine: fed frame times, it says where to go.
 */
export class AutoQuality {
  private readonly window: number[] = [];
  private calm = 0;
  current: QualityName;
  readonly ceiling: QualityName;
  /** Frame time (ms) past which a window is too slow, and under which it is easy. */
  readonly slow: number;
  readonly fast: number;
  /** Frames to a window; easy windows before stepping up. */
  readonly size: number;
  readonly patience: number;
  constructor(
    start: QualityName,
    ceiling: QualityName = "ultra",
    slow = 22,
    fast = 12,
    size = 90,
    patience = 4,
  ) {
    this.current = start;
    this.ceiling = ceiling;
    this.slow = slow;
    this.fast = fast;
    this.size = size;
    this.patience = patience;
  }

  /** One frame's time; returns the new setting when it should change, else null. */
  frame(ms: number): QualityName | null {
    this.window.push(ms);
    if (this.window.length < this.size) return null;
    const sorted = [...this.window].sort((a, b) => a - b),
      // The slower frames of the window (its 80th percentile): a hitch alone does not count.
      p80 = sorted[Math.floor(sorted.length * 0.8)]!;
    this.window.length = 0;
    const at = QUALITY_NAMES.indexOf(this.current),
      top = QUALITY_NAMES.indexOf(this.ceiling);
    if (p80 > this.slow && at > 0) {
      this.calm = 0;
      return (this.current = QUALITY_NAMES[at - 1]!);
    }
    if (p80 < this.fast) {
      if (++this.calm >= this.patience && at < top) {
        this.calm = 0;
        return (this.current = QUALITY_NAMES[at + 1]!);
      }
    } else this.calm = 0;
    return null;
  }
}
