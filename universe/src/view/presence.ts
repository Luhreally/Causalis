// Where the people are drawn (a smoothness pass, 2026-09-27): each person drawn where their
// day has them, but carried there smoothly — a spring with a speed it cannot pass, kept out
// of the walls — facing the way they go and striding while they move. However fast the
// world runs, no one jumps: a gap too long to cross (the world run on hours, or a day, a
// second) is a blink — shrunk away where they stood, grown again where they are — and so is
// going in at a door or coming out of one.
import { ACTIVITY, type Moment } from "./village.ts";
import { keepOut, type Ground } from "./ground.ts";

/** What is drawn of one person, carried from frame to frame. */
export type Presence = {
  x: number;
  z: number;
  vx: number;
  vz: number;
  yaw: number;
  /** How much of them is drawn: 0 gone … 1 whole (they shrink away and grow back). */
  size: number;
  /** Shrinking away to reappear where they are, over a gap too long to walk. */
  blinking: boolean;
  /** Their stride's own clock (seconds): quicker as they go faster, so the legs keep pace. */
  stride: number;
};

/** How quickly the drawn place catches where they are (seconds: a spring's time). */
export const SMOOTH = 0.12;
/** A gap longer than this (metres) is not walked but blinked across. */
export const FAR = 45;
/** The fastest they are drawn to move (metres a second): a dash, never a leap. */
export const DASH = 90;
/** How fast they shrink away and grow back (a whole size a this many seconds). */
export const BLINK = 0.15;
/** Faster than this (metres a second, drawn) they are seen to walk. */
const MOVING = 0.4;
/** The fastest they turn (radians a second). */
const TURN = 9;
/** How far they keep off a wall (as the day's walks do). */
const REACH = 1.2;

/** A new presence, nothing yet drawn of them. */
function fresh(m: Moment): Presence {
  return { x: m.x, z: m.z, vx: 0, vz: 0, yaw: m.yaw, size: 0, blinking: false, stride: 0 };
}

/** The angle a turn toward `to` from `from` takes, the short way round. */
function toward(from: number, to: number, most: number): number {
  let d = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  if (d > most) d = most;
  if (d < -most) d = -most;
  return from + d;
}

/**
 * Carry each person's drawn presence (keyed by their ref) toward where their moment has
 * them, `dt` screen seconds on; answer what to draw of each: the moment moved to where
 * they are drawn (their activity walking while they are seen to move), and their size.
 * People no longer in the plan are forgotten.
 */
export function present(
  state: Map<string, Presence>,
  keys: readonly string[],
  moments: readonly Moment[],
  dt: number,
  ground: Ground | null,
): { moment: Moment; size: number; stride: number }[] {
  const step = Math.max(0, Math.min(0.1, dt)),
    grow = step / BLINK,
    out: { moment: Moment; size: number; stride: number }[] = [],
    kept = new Set<string>();
  moments.forEach((m, i) => {
    const key = keys[i]!;
    kept.add(key);
    let p = state.get(key);
    if (!p) {
      if (m.hidden) {
        out.push({ moment: m, size: 0, stride: 0 });
        return;
      }
      state.set(key, (p = fresh(m)));
    }
    if (m.hidden) {
      // In at a door (or out of the day): shrunk away where they stand.
      p.size = Math.max(0, p.size - grow);
      p.vx = p.vz = 0;
      out.push({
        moment: { ...m, x: p.x, z: p.z, yaw: p.yaw, hidden: p.size <= 0 },
        size: p.size,
        stride: p.stride,
      });
      return;
    }
    if (p.size <= 0 && !p.blinking) {
      // Out of a door: grown where they are.
      p.x = m.x;
      p.z = m.z;
      p.vx = p.vz = 0;
      p.yaw = m.yaw;
    }
    const gx = m.x - p.x,
      gz = m.z - p.z,
      gap = Math.hypot(gx, gz);
    if (gap > FAR && p.size > 0) p.blinking = true;
    if (p.blinking) {
      p.size = Math.max(0, p.size - grow);
      if (p.size <= 0) {
        p.blinking = false;
        p.x = m.x;
        p.z = m.z;
        p.vx = p.vz = 0;
        p.yaw = m.yaw;
      }
    } else {
      p.size = Math.min(1, p.size + grow);
      // A critically damped spring toward where they are, never pulled faster than a dash.
      const omega = 2 / SMOOTH,
        x = omega * step,
        decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x),
        most = DASH * SMOOTH,
        pull = gap > most ? most / gap : 1,
        cx = -gx * pull,
        cz = -gz * pull,
        aimX = p.x - cx,
        aimZ = p.z - cz,
        tx = (p.vx + omega * cx) * step,
        tz = (p.vz + omega * cz) * step;
      p.vx = (p.vx - omega * tx) * decay;
      p.vz = (p.vz - omega * tz) * decay;
      p.x = aimX + (cx + tx) * decay;
      p.z = aimZ + (cz + tz) * decay;
      if (ground) keepOut(ground, p, REACH);
    }
    const speed = Math.hypot(p.vx, p.vz),
      moving = speed > MOVING && !p.blinking,
      facing = moving ? Math.atan2(p.vx, p.vz) : m.yaw;
    p.yaw = toward(p.yaw, facing, TURN * step);
    // (The legs quicken with the pace, up to a run at a dash.)
    p.stride += step * (moving ? 1 + Math.min(1.6, speed / 30) : 1);
    out.push({
      moment: {
        ...m,
        x: p.x,
        z: p.z,
        yaw: p.yaw,
        activity: moving ? ACTIVITY.walking : m.activity,
        hidden: p.size <= 0,
      },
      size: p.size,
      stride: p.stride,
    });
  });
  for (const key of [...state.keys()]) if (!kept.has(key)) state.delete(key);
  return out;
}
