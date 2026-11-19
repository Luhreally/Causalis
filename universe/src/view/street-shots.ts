// How a fight of the underworld is looked at (asked for 2026-11-19: "the gang war camreas i guess move too fast between battles
// like i cant see the whole scene"). Measured before: its clashes began every six or seven seconds and each lasted nine to
// fourteen, so the eye left each one five to nine seconds before it was decided, a second and a half of each look spent on the way.
// The rules here, each a plain function a test reads:
//   - one clash at a time: the next begins only after this one is decided, a breath taken on what is left of it, and the eye gone over;
//   - a clash lasts by how much happens in it (how many are in it, whether any fall), never less than several seconds;
//   - the eye is on a clash from before its men come until it is decided and a breath more: it never leaves one being fought;
//   - each clash is first seen whole (all its men and the street they hold, fitted to the screen left free, tall or wide), then
//     nearer, still all of those in it;
//   - the way between two is eased and takes as long at any speed of its clock as the eye can follow.
// Nothing here is the world's: the scene is the eye's (view/streetfight.ts), and what it shows dying and winning is what history says.
import type { StreetScript } from "./streetfight.ts";

type Point = { readonly x: number; readonly z: number };

/** How long the two sides stand off at a place before they close (seconds). */
export const STAND_OFF = 2.6;
/** How long the eye stays on a clash after it is decided, and how long its way to the next takes at the clock's own pace (seconds). */
export const LINGER = 2.2,
  TRAVEL = 2.2;
/** How long after they close a clash is still seen whole, before the eye goes nearer; how long going nearer takes (seconds). */
export const WIDE_MORE = 1.5,
  NEARER = 1.8;
/** How long after a clash's first men come all of them have, and stand off still (seconds): where a held film steps to. */
export const HELD_AT = 2.3;
/** The least a clash is fought, and the most (seconds). */
export const FOUGHT_LEAST = 5,
  FOUGHT_MOST = 8;

/**
 * How long a clash is fought once its sides close (seconds): longer the more are in it, and where any fall (it is decided there,
 * not stood off); several seconds at the least, and no more than the eye will stay for.
 */
export function clashFought(fighters: number, falls: boolean): number {
  const n = Math.max(0, fighters);
  return Math.max(FOUGHT_LEAST, Math.min(FOUGHT_MOST, 3 + 0.3 * n + (falls ? 1 : 0)));
}

/** When the clash after one decided at `to` begins: the breath taken on what is left of it, and the eye's way over. */
export function nextClashFrom(to: number): number {
  return to + LINGER + TRAVEL;
}

/**
 * How long the eye's way from one clash to the next takes in real seconds, at a pace of the film's clock (0: held): as long as
 * the clock's own pace gives it, never so short it cannot be followed, never so long a slowed film waits on it.
 */
export function travelSeconds(pace: number): number {
  return pace > 0 ? Math.max(1.2, Math.min(3, TRAVEL / pace)) : TRAVEL;
}

/** When the eye turns to each clash (seconds of the film): the first from its beginning, each after as the one before is left. */
export function shotStarts(script: StreetScript): number[] {
  return script.clashes.map((_, k) => (k === 0 ? 0 : script.clashes[k - 1]!.to + LINGER));
}

/**
 * The clash the eye is on at a second, and whether it is still seen whole (null: the scene has none). It stays until that clash
 * is decided and a breath more, whatever else has begun; on the last it stays to the end.
 */
export function streetShot(
  script: StreetScript,
  s: number,
): { clash: number; wide: boolean } | null {
  const cs = script.clashes;
  if (!cs.length) return null;
  let k = cs.findIndex((c) => s < c.to + LINGER);
  if (k < 0) k = cs.length - 1;
  return { clash: k, wide: s < cs[k]!.from + STAND_OFF + WIDE_MORE };
}

/**
 * Where the film goes when the next clash is asked for, or the one before (a second of it). The one before, asked a few seconds
 * into a clash, is that clash from its beginning; next on the last is where it stands (null: nowhere to go). While the film is
 * `held` a step is to where the clash's men have come and stand off, not to the street before anyone is in it: what is held
 * and looked at is the clash.
 */
export function shotStep(
  script: StreetScript,
  s: number,
  dir: 1 | -1,
  held = false,
): number | null {
  const at = streetShot(script, s);
  if (!at) return null;
  const starts = shotStarts(script),
    to = (k: number) => (held ? script.clashes[k]!.from + HELD_AT : starts[k]!);
  // (Soldiers still on their way in, the eye with them: next is the first post met, as they come to it.)
  const first = script.clashes[0]!;
  if (script.kind === "army" && s < first.from - TRAVEL - 0.5)
    return dir > 0 ? (held ? first.from + HELD_AT : first.from - TRAVEL) : 0;
  if (dir > 0) return at.clash + 1 < starts.length ? to(at.clash + 1) : null;
  return s - to(at.clash) > 3 || at.clash === 0 ? to(at.clash) : to(at.clash - 1);
}

/**
 * Where the men of a clash are (metres from the town's middle). Seen whole: where each stands off and where he closes to, and
 * the place itself. Nearer: where each is once they have closed (those who only stand, where they stand).
 */
export function clashBounds(script: StreetScript, clash: number, wide: boolean): Point[] {
  const out: Point[] = [],
    c = script.clashes[clash];
  if (!c) return out;
  for (const g of script.figures) {
    if (g.clash !== clash) continue;
    const end = g.path[g.path.length - 1]!;
    if (wide || !g.fight || !g.meet) out.push(end);
    if (g.meet && (wide || g.fight)) out.push(g.meet);
  }
  if (wide || !out.length) out.push(c.spot);
  return out;
}

/** The way a clash's two sides face each other (degrees, from the first's men to the second's; undefined: one side alone there). */
export function clashFacing(script: StreetScript, clash: number): number | undefined {
  const sum = [
    { x: 0, z: 0, n: 0 },
    { x: 0, z: 0, n: 0 },
  ];
  for (const g of script.figures) {
    if (g.clash !== clash) continue;
    const at = g.meet ?? g.path[g.path.length - 1]!,
      m = sum[g.side]!;
    m.x += at.x;
    m.z += at.z;
    m.n++;
  }
  const [a, b] = sum as [(typeof sum)[0], (typeof sum)[0]];
  if (!a.n || !b.n) return undefined;
  const dx = b.x / b.n - a.x / a.n,
    dz = b.z / b.n - a.z / a.n;
  return Math.hypot(dx, dz) > 0.5 ? (Math.atan2(dx, dz) * 180) / Math.PI : undefined;
}

/** The eye's field and the screen left free to it. */
export type EyeFrame = {
  /** Its turn and tilt as the rig has them (degrees: it stands off toward sin, cos of its yaw; a negative pitch looks down). */
  readonly yaw: number;
  readonly pitch: number;
  /** The tangent of half its field from top to bottom, and the screen's width over its height. */
  readonly tan: number;
  readonly aspect: number;
  /** The screen left free, as shares of it from its middle (−1 … 1): from `lo` up to `hi`, and so far to either side. */
  readonly lo: number;
  readonly hi: number;
  readonly side: number;
  /** How tall one stood there is drawn, how far about his place he reaches (lying, he is as long as he was tall), and how high the eye's mark is (metres). */
  readonly high: number;
  readonly about: number;
  readonly level: number;
  /** The nearest and furthest the eye may stand (metres). */
  readonly min: number;
  readonly max: number;
};
export type EyeFit = {
  /** Where the eye's mark is (metres from the town's middle) and how far off it stands. */
  readonly target: Point;
  readonly distance: number;
  /** Whether all of them are in the screen left free from there (not, where the furthest it may stand is too near). */
  readonly fits: boolean;
};

const basis = (f: EyeFrame) => {
  const yaw = (f.yaw * Math.PI) / 180,
    tilt = (Math.max(1, Math.min(89, -f.pitch)) * Math.PI) / 180,
    sy = Math.sin(yaw),
    cy = Math.cos(yaw),
    sp = Math.sin(tilt),
    cp = Math.cos(tilt);
  return { sy, cy, sp, cp };
};

/** Where a point stands on the screen from a stand (shares of it from its middle: −1 … 1 across and up), and how far before the eye. */
export function eyeSees(
  f: EyeFrame,
  fit: { target: Point; distance: number },
  p: Point,
  high = 0,
): { x: number; y: number; z: number } {
  const { sy, cy, sp, cp } = basis(f),
    qx = p.x - fit.target.x,
    qy = high - f.level,
    qz = p.z - fit.target.z,
    // (Across the screen; up it; away from the eye.)
    x = qx * cy - qz * sy,
    y = -qx * sy * sp + qy * cp - qz * cy * sp,
    z = fit.distance - (qx * sy * cp + qy * sp + qz * cy * cp);
  return { x: x / (z * f.tan * f.aspect), y: y / (z * f.tan), z };
}

/**
 * Where the eye stands to have all of some people in the screen left free, at a turn and tilt: its mark put where they come to
 * the middle of what is free, and as near as still holds every one of them from foot to head. On a tall screen that is further
 * off than on a wide one for the same people; where the furthest it may stand is still too near, it stands there (`fits` false).
 */
export function fitEye(points: readonly Point[], f: EyeFrame): EyeFit {
  if (!points.length) return { target: { x: 0, z: 0 }, distance: f.min, fits: true };
  const { sy, cy, sp, cp } = basis(f),
    tanH = f.tan * f.aspect,
    heights = [0, f.high];
  let tx = 0,
    tz = 0;
  for (const p of points) {
    tx += p.x / points.length;
    tz += p.z / points.length;
  }
  // (How far off it must stand for every one of them, its mark where it is.)
  const needed = (): number => {
    let far = 0;
    for (const p of points)
      for (const h of heights) {
        const qx = p.x - tx,
          qy = h - f.level,
          qz = p.z - tz,
          x = qx * cy - qz * sy,
          y = -qx * sy * sp + qy * cp - qz * cy * sp,
          toward = qx * sy * cp + qy * sp + qz * cy * cp;
        far = Math.max(
          far,
          (Math.abs(x) + f.about) / (f.side * tanH) + toward,
          (y >= 0 ? y / (Math.max(0.05, f.hi) * f.tan) : -y / (Math.max(0.05, -f.lo) * f.tan)) +
            toward,
        );
      }
    return far;
  };
  let distance = Math.max(f.min, needed());
  for (let turn = 0; turn < 12; turn++) {
    // (Its mark moved so they come to the middle of what is free, across and up; then how far off again.)
    let x0 = Infinity,
      x1 = -Infinity,
      y0 = Infinity,
      y1 = -Infinity;
    for (const p of points)
      for (const h of heights) {
        const at = eyeSees(f, { target: { x: tx, z: tz }, distance }, p, h);
        x0 = Math.min(x0, at.x);
        x1 = Math.max(x1, at.x);
        y0 = Math.min(y0, at.y);
        y1 = Math.max(y1, at.y);
      }
    const across = ((x0 + x1) / 2) * distance * tanH,
      up = (((y0 + y1) / 2 - (f.lo + f.hi) / 2) * distance * f.tan) / sp;
    tx += across * cy * 0.9 - up * sy * 0.9;
    tz += -across * sy * 0.9 - up * cy * 0.9;
    distance = Math.max(f.min, needed());
  }
  const fits = distance <= f.max + 1e-6;
  return { target: { x: tx, z: tz }, distance: Math.min(f.max, distance), fits };
}

/** The share of some people who stand whole (foot and head) in the screen left free, from a stand. */
export function shareSeen(
  points: readonly Point[],
  f: EyeFrame,
  fit: { target: Point; distance: number },
): number {
  if (!points.length) return 1;
  let n = 0;
  for (const p of points)
    if (
      [0, f.high].every((h) => {
        const at = eyeSees(f, fit, p, h);
        return (
          at.z > 0 &&
          Math.abs(at.x) + f.about / (at.z * f.tan * f.aspect) <= f.side + 1e-6 &&
          at.y >= f.lo - 1e-6 &&
          at.y <= f.hi + 1e-6
        );
      })
    )
      n++;
  return n / points.length;
}
