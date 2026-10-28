// The god's acts seen near (Phase 30 M163, asked for 2026-10-24: "be able to pause and influence
// and all that"): where the eye is on the ground — among a band, over a land, in a town — the
// god's hand on that land is seen as well as its weather: a blessed harvest's gold drifting up
// off the land, a blight's dust, a plague's pall hanging low, healing's glints, the light of an
// inspiration over the land's middle; a town afire, its flames and smoke; the ground shaking; a
// stone falling from the sky, its flash and smoke; a blessing or a curse settling on the land.
// What lasts is seen while it lasts; what is done in a moment is seen as it happens, for a few
// seconds of the viewer's own at whatever pace the clock runs. Pure.
import { DAY } from "../kernel/index.ts";
import type { ActKindShown, LandSky } from "../bridge/index.ts";

export type NearMote = "gold" | "dust" | "pall" | "glint" | "wisp";

export type ActsNear = {
  /**
   * Motes over the land: their kind, how many (0 … 1), how fast they rise (+) or settle (−), a
   * share of the eye's distance a second, and whether they keep low over the ground.
   */
  readonly motes: readonly {
    readonly kind: NearMote;
    readonly strength: number;
    readonly rise: number;
    readonly low: boolean;
  }[];
  /** An inspiration's light over the land's middle (0 … 1). */
  readonly pillar: number;
  /** The towns afire, and how fiercely (0 … 1). */
  readonly fires: readonly { readonly town: string; readonly strength: number }[];
  /** The ground shaking (0 … 1). */
  readonly shake: number;
  /** A stone from the sky: how far it has fallen (0 … 1), its flash as it strikes, its smoke. */
  readonly strike: { readonly fall: number; readonly flash: number; readonly smoke: number } | null;
  /** The god's hand here: each act's sign and words, the latest first. */
  readonly told: readonly { readonly icon: string; readonly words: string }[];
};

/** A moment's act is seen near for this long of the world's time, or so many of the viewer's seconds at the pace, the longer. */
const SEEN: Partial<Record<ActKindShown, { world: number; real: number }>> = {
  lightning: { world: DAY, real: 3 },
  quake: { world: DAY, real: 5 },
  meteor: { world: DAY, real: 7 },
  fire: { world: 8 * DAY, real: 9 },
  bless: { world: 30 * DAY, real: 10 },
  curse: { world: 30 * DAY, real: 10 },
  inspiration: { world: 60 * DAY, real: 10 },
  ways: { world: 20 * DAY, real: 6 },
  tongue: { world: 20 * DAY, real: 6 },
  faith: { world: 20 * DAY, real: 6 },
  conversion: { world: 20 * DAY, real: 6 },
  spring: { world: 20 * DAY, real: 6 },
  shrine: { world: 20 * DAY, real: 6 },
};

/** Each act's sign and words, as the palette shows it. */
const TOLD: Partial<Record<ActKindShown, readonly [string, string]>> = {
  lightning: ["⚡", "lightning struck"],
  bounty: ["🌽", "the harvest blessed"],
  blight: ["🥀", "a blight on the fields"],
  plague: ["☠️", "a plague"],
  healing: ["💊", "sickness eased"],
  inspiration: ["💡", "an inspiration"],
  fire: ["🔥", "a town afire"],
  quake: ["🏚️", "the ground shaken"],
  meteor: ["☄️", "a stone from the sky"],
  bless: ["🌟", "a blessing on the land"],
  curse: ["🌑", "a curse on the land"],
  ways: ["🎭", "its ways stirred"],
  tongue: ["🗣️", "a new tongue"],
  faith: ["⛩️", "a faith begun"],
  conversion: ["🙏", "a faith brought"],
  spring: ["⛲", "a spring opened"],
  shrine: ["⛩️", "a shrine raised"],
};

/** The motes a lasting or moment's act sets over the land. */
const MOTES: Partial<
  Record<ActKindShown, { kind: NearMote; strength: number; rise: number; low: boolean }>
> = {
  bounty: { kind: "gold", strength: 0.55, rise: 0.05, low: false },
  blight: { kind: "dust", strength: 0.7, rise: -0.004, low: true },
  plague: { kind: "pall", strength: 0.6, rise: 0.004, low: true },
  healing: { kind: "glint", strength: 0.5, rise: 0.06, low: false },
  inspiration: { kind: "glint", strength: 0.45, rise: 0.08, low: false },
  bless: { kind: "gold", strength: 0.8, rise: -0.035, low: false },
  curse: { kind: "wisp", strength: 0.8, rise: 0.01, low: true },
  ways: { kind: "glint", strength: 0.35, rise: 0.05, low: false },
  tongue: { kind: "glint", strength: 0.35, rise: 0.05, low: false },
  faith: { kind: "glint", strength: 0.35, rise: 0.05, low: false },
  conversion: { kind: "glint", strength: 0.35, rise: 0.05, low: false },
  spring: { kind: "glint", strength: 0.3, rise: 0.04, low: true },
  shrine: { kind: "glint", strength: 0.3, rise: 0.04, low: true },
};

/**
 * The god's acts on a land seen near at moment t, the clock's pace (world seconds a second, as
 * chosen, paused or not) setting how long a moment's act is watched.
 */
export function actsNear(sky: LandSky, t: number, pace: number): ActsNear {
  const motes = new Map<
      NearMote,
      { kind: NearMote; strength: number; rise: number; low: boolean }
    >(),
    fires: { town: string; strength: number }[] = [],
    told: { icon: string; words: string; from: number }[] = [];
  let pillar = 0,
    shake = 0,
    strike: ActsNear["strike"] = null;
  for (const a of sky.acts) {
    const seen = SEEN[a.kind],
      age = t - a.from;
    // (A lasting act while it lasts; a moment's while it is watched happening.)
    let k: number;
    if (seen) {
      const span = Math.max(seen.world, pace * seen.real);
      if (age < 0 || age >= span) continue;
      k = 1 - age / span;
    } else if (MOTES[a.kind]) k = Math.min(1, 0.4 + a.left);
    else continue;
    const m = MOTES[a.kind];
    if (m) {
      const was = motes.get(m.kind),
        strength = m.strength * Math.min(1, k * 1.5);
      if (!was || was.strength < strength) motes.set(m.kind, { ...m, strength });
    }
    if (a.kind === "inspiration" || a.kind === "lightning")
      pillar = Math.max(pillar, Math.min(1, k * 1.4));
    if (a.kind === "fire" && a.town) fires.push({ town: a.town, strength: Math.min(1, k * 1.3) });
    if (a.kind === "quake") shake = Math.max(shake, k ** 1.5);
    if (a.kind === "meteor") {
      const u = 1 - k;
      strike = {
        fall: Math.min(1, u / 0.12),
        flash: u >= 0.12 && u < 0.22 ? 1 - (u - 0.12) / 0.1 : 0,
        smoke: u >= 0.12 ? Math.min(1, (1 - u) / 0.5) : 0,
      };
    }
    const say = TOLD[a.kind];
    if (say) told.push({ icon: say[0], words: say[1], from: a.from });
  }
  told.sort((a, b) => b.from - a.from);
  return {
    motes: [...motes.values()],
    pillar,
    fires,
    shake,
    strike,
    told: told
      .filter((x, i) => told.findIndex((y) => y.words === x.words) === i)
      .map(({ icon, words }) => ({ icon, words })),
  };
}
