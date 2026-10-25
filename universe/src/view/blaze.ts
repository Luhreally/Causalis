// What strikes a town, seen as it plays out (Phase 42 M201; asked for 2026-10-25: "...and just
// actions of stuff"): each of its homes the god's fire took alight from the moment it caught, its
// flames rising, at their fiercest, dying down; their smoke, and the thinner smoke of the
// smouldering after; the dust over homes a quake shook down; the ground shaking. Pure: the same
// scene at the same moment burns the same.
import {
  DUST_S,
  FLAMES_S,
  SHAKE_S,
  SMOULDER_S,
  RUBBLE_HIGH,
  homeSize,
  strikeSpan,
  thrownDown,
  type TownScene,
} from "./town.ts";

/**
 * A home struck, as it is now: where (metres from the middle), how fierce (0…1), how big a fire
 * (a hut's 0.7 to a tower's 3.4), how high it stood and how broad (metres).
 */
export type Alight = {
  readonly lot: number;
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly k: number;
  readonly size: number;
  readonly high: number;
  readonly wide: number;
};

export type BlazeNow = {
  /** Homes alight. */
  readonly fires: readonly Alight[];
  /** Smoke rising: over the fires, and thinner over the smouldering. */
  readonly smoke: readonly Alight[];
  /** Dust over homes shaken down. */
  readonly dust: readonly Alight[];
  /** How hard the ground shakes now (0…1). */
  readonly shake: number;
};

const NONE: BlazeNow = { fires: [], smoke: [], dust: [], shake: 0 };

/** How big a home's fire is, by its level: a hut's to a tower's. */
const SIZE = [0.7, 1, 1.5, 2.1, 2.8, 3.4];
/** How long flames take to rise to their fiercest, and to die down at the end (seconds). */
const RISE_S = 600,
  DIE_S = 3000;

/** What of a town is alight, smoking and in dust at moment t (none: nothing struck it). */
export function blazeNow(scene: TownScene | null, t: number): BlazeNow {
  const span = scene ? strikeSpan(scene) : null;
  if (!scene || !span || t < span.from - SHAKE_S || t > span.until + FLAMES_S + SMOULDER_S)
    return NONE;
  const { states, lots, plan } = scene,
    fires: Alight[] = [],
    smoke: Alight[] = [],
    dust: Alight[] = [];
  let shake = 0;
  for (const k of plan.struck ?? [])
    if (k.kind === "quake" && t >= k.at && t < k.at + SHAKE_S)
      shake = Math.max(shake, 1 - (t - k.at) / SHAKE_S);
  for (const p of scene.struck) {
    const since = t - states.began[p]!;
    // (In the order they caught: the rest are yet to.)
    if (since < 0) break;
    const at = {
      lot: p,
      x: lots.x[p]!,
      z: lots.z[p]!,
      yaw: lots.yaw[p]!,
      size: SIZE[Math.max(0, Math.min(5, states.level[p]!))]!,
      ...homeSize(scene, p),
      // (A home thrown down burns low, in its rubble.)
      ...(thrownDown(scene, p) ? { high: RUBBLE_HIGH } : {}),
    };
    if (states.burns[p] === 1) {
      if (since < FLAMES_S) {
        const k = Math.max(0.05, Math.min(1, since / RISE_S, (FLAMES_S - since) / DIE_S));
        fires.push({ ...at, k });
        smoke.push({ ...at, k });
      } else if (since < FLAMES_S + SMOULDER_S)
        smoke.push({ ...at, k: 0.45 * (1 - (since - FLAMES_S) / SMOULDER_S) });
    } else if (since < DUST_S) dust.push({ ...at, k: 1 - since / DUST_S });
  }
  return { fires, smoke, dust, shake };
}
