// What strikes a town, seen as it plays out (Phase 42 M201; asked for 2026-10-25: "...and just
// actions of stuff"): each of its homes the god's fire took alight from the moment it caught, its
// flames rising, at their fiercest, dying down; their smoke, and the thinner smoke of the
// smouldering after; the dust over homes a quake shook down; the ground shaking. Pure: the same
// scene at the same moment burns the same.
import { LOT, progress } from "../bridge/index.ts";
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
import { farBurnsOf } from "./raid.ts";

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
const SIZE = [0.7, 1, 1.5, 2.1, 2.8, 3.4, 4.2];
/** How long flames take to rise to their fiercest, and to die down at the end (seconds). */
const RISE_S = 600,
  DIE_S = 3000;

/** What of a town is alight, smoking and in dust at moment t (none: nothing struck it). */
export function blazeNow(scene: TownScene | null, t: number): BlazeNow {
  const span = scene ? strikeSpan(scene) : null,
    // (What burned past the streets drawn, out in a great city's sprawl.)
    far = scene?.plan.struck?.some((k) => farBurnsOf(k).length > 0) ?? false;
  if (
    !scene ||
    (!far && (!span || t < span.from - SHAKE_S || t > span.until + FLAMES_S + SMOULDER_S))
  )
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
      size: SIZE[Math.max(0, Math.min(SIZE.length - 1, states.level[p]!))]!,
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
  if (far)
    for (const strike of plan.struck ?? [])
      for (const b of farBurnsOf(strike)) {
        const since = t - b.at;
        if (since < 0) continue;
        const at = {
          lot: -1,
          x: b.x,
          z: b.z,
          yaw: b.yaw,
          size: SIZE[4]!,
          high: b.high,
          wide: b.wide,
        };
        if (since < FLAMES_S) {
          const k = Math.max(0.05, Math.min(1, since / RISE_S, (FLAMES_S - since) / DIE_S));
          fires.push({ ...at, k });
          smoke.push({ ...at, k });
        } else if (since < FLAMES_S + SMOULDER_S)
          smoke.push({ ...at, k: 0.45 * (1 - (since - FLAMES_S) / SMOULDER_S) });
      }
  return { fires, smoke, dust, shake };
}

/** A home a film may set alight: all a fire on it needs but how fierce it is. */
export type Burnable = Omit<Alight, "k">;

/** How high up a home a film's fire is seen (metres): a spire burns from its lower floors, where the eye over the streets can see it. */
const FILM_FIRE_HIGH = 50;

/**
 * The homes standing at moment t nearest a way through the town (metres from its middle), nearest
 * first, for a film's burning. Pure.
 */
export function homesAlong(
  scene: TownScene,
  t: number,
  way: readonly { readonly x: number; readonly z: number }[],
  most: number,
): Burnable[] {
  const { states, lots, plan } = scene,
    found: { d: number; home: Burnable }[] = [];
  for (let p = 0; p < plan.lots; p++) {
    if (states.what[p] !== LOT.home || progress(states.began[p]!, states.takes[p]!, t) < 1)
      continue;
    const x = lots.x[p]!,
      z = lots.z[p]!,
      size = homeSize(scene, p);
    let d = Infinity;
    for (const q of way) d = Math.min(d, Math.hypot(x - q.x, z - q.z));
    found.push({
      d,
      home: {
        lot: p,
        x,
        z,
        yaw: lots.yaw[p]!,
        size: SIZE[Math.max(0, Math.min(SIZE.length - 1, states.level[p]!))]!,
        high: Math.min(FILM_FIRE_HIGH, size.high),
        wide: size.wide,
      },
    });
  }
  return found
    .sort((a, b) => a.d - b.d)
    .slice(0, most)
    .map((h) => h.home);
}
