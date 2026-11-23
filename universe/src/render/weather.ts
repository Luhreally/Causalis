// The weather drawn (Phase 30 M162): rain and snow falling about what the eye looks at, as near or
// as far as it is — the same at every scale on the ground (a band's camp, a town, a land), sized by
// the eye's distance (to a power of two, each drop at a place of the ground's) so a shower reads as
// a shower however high the eye. Still while the clock is.
import * as pc from "playcanvas";
import type { Weather } from "../view/index.ts";
import { InstancedBatch, boxMesh, keptMesh } from "./batch.ts";
import { flatMaterial, type Rgb, type Stage } from "./stage.ts";

/** The most drops, and flakes, drawn at once. */
const MOST = 1600;
/** Rain falls through its height in this many seconds; snow, drifting, in this many. */
const RAIN_FALL = 0.85,
  SNOW_FALL = 7;
const RAIN: Rgb = [0.72, 0.8, 0.94];
/**
 * How long a shower takes to come on or go (s of the viewer's own time, to within a third of the way): what it shows is eased
 * to what the weather asks, never at once (2026-11-23: a view's sky read a moment after it was come to, a spell ended, the
 * clock's pace changed — each put a shower in or out whole in a frame).
 */
const EASE = 0.9;
const SNOW: Rgb = [0.97, 0.98, 1];

/** Seen by its own light a little, so a night's rain is not lost in the dark. */
function weatherMaterial(color: Rgb, opacity: number): pc.StandardMaterial {
  const m = flatMaterial(color, opacity);
  m.emissive = new pc.Color(color[0] * 0.5, color[1] * 0.5, color[2] * 0.5);
  m.update();
  return m;
}

/** A number in [0, 1) of its own for a drop and its fall. */
function rand(i: number, fall: number, k: number): number {
  let h =
    (Math.imul(i ^ 0x5bd1e995, 0x85ebca6b) ^ Math.imul(fall + k * 0x27d4eb2d, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

/**
 * A place of the ground's own for a mote of a shower `S` across (region or scene units), wrapped about the point looked at
 * (`ax`, `az`): out[0], out[1] its offset from that point, out[2] how much of it shows (fading out toward the shower's edge,
 * where it wraps round). The same mote (`id`, its round `lap`) stands at the same place of the world wherever the eye looks.
 */
export function latticeAt(
  ax: number,
  az: number,
  S: number,
  id: number,
  lap: number,
  k: number,
  out: Float32Array,
): void {
  const reach = S * 0.95,
    span = reach * 2,
    wx = rand(id, lap, k) * span,
    wz = rand(id, lap, k + 1) * span,
    dx = ((((wx - ax + reach) % span) + span) % span) - reach,
    dz = ((((wz - az + reach) % span) + span) % span) - reach;
  out[0] = dx;
  out[1] = dz;
  out[2] = Math.min(1, Math.max(0, (1 - Math.hypot(dx, dz) / reach) / 0.2));
}

/** The two powers of two about the eye's distance a shower is laid at, and the lower's share of its motes (`n` of them). */
export function tiersOf(distance: number, n: number): { t0: number; n0: number; low: number } {
  const level = Math.log2(Math.max(0.5, distance)),
    t0 = Math.floor(level),
    low = 1 - (level - t0);
  return { t0, n0: Math.round(n * low), low };
}

/**
 * Which of the two scales mote `i` falls at (its own draw against the lower's share: a mote keeps its scale, and its place,
 * as more or fewer fall, where shared out by its index each one's place leapt as the count did), and its id there.
 */
export function moteOf(i: number, t0: number, low: number): { tier: number; id: number } {
  const tier = rand(i, 0, 11) < low ? t0 : t0 + 1;
  return { tier, id: i + tier * 7919 };
}

/** How much of a mote shows by the eye: none within 0.4 of its shower's breadth `S`, all from 0.6. */
export function clearOfEye(
  x: number,
  y: number,
  z: number,
  eye: { x: number; y: number; z: number },
  S: number,
): number {
  const e = Math.hypot(x - eye.x, y - eye.y, z - eye.z) / (S * 0.4);
  return Math.min(1, Math.max(0, (e - 1) / 0.5));
}

export class WeatherLayer {
  readonly root = new pc.Entity("weather");
  private readonly drops: InstancedBatch;
  private readonly flakes: InstancedBatch;
  private readonly rainLook = weatherMaterial(RAIN, 0.5);
  private readonly snowLook = weatherMaterial(SNOW, 0.92);
  /** How many drops and flakes were drawn last (the look tools). */
  shown = { drops: 0, flakes: 0 };
  /** A drop's place, worked out (kept, so nothing is made each frame). */
  private readonly at = new Float32Array(4);
  /** How hard it rains and snows as drawn (eased to the weather's: EASE), and when last drawn (the viewer's seconds). */
  private rainShown = 0;
  private snowShown = 0;
  private drawnAt = -1;

  /** None drawn from now: the view itself changed, where a shower is let go of at once with all else it showed. */
  cut(): void {
    this.rainShown = this.snowShown = 0;
    this.drawnAt = -1;
    this.drops.set(0, () => {});
    this.flakes.set(0, () => {});
    this.shown = { drops: 0, flakes: 0 };
  }

  /** Whether any rain or snow is still drawn (going, after the weather has let go of it). */
  get showing(): boolean {
    return this.rainShown > 0 || this.snowShown > 0;
  }

  constructor(stage: Stage, parent: pc.Entity) {
    const box = keptMesh(boxMesh(stage));
    this.drops = new InstancedBatch(stage, box, RAIN, MOST, this.root, this.rainLook);
    this.flakes = new InstancedBatch(stage, box, SNOW, MOST, this.root, this.snowLook);
    parent.addChild(this.root);
  }

  /** Its looks, for the stage to ready their shaders before they are wanted. */
  materials(): { material: pc.Material; instanced: boolean }[] {
    return [
      { material: this.rainLook, instanced: true },
      { material: this.snowLook, instanced: true },
    ];
  }

  /**
   * The weather about a point the eye looks at from `distance` away (the eye itself at `eye`),
   * at `s` seconds of the viewer's time (held while the clock is): at most `most` drops or
   * flakes, as many as it falls; none so near the eye that it would fill the view; the flakes drawn `flakes` times their size.
   *
   * Each drop falls at a place of the ground's own (the owner's rule, 2026-11-21: nothing drawn moves with the camera): its
   * place is fixed on a lattice of the world the size of the shower, wrapped about the point looked at, so a pan goes over
   * the rain, not with it; it fades out toward the shower's edge (where it wraps) and near the eye. The shower is laid at
   * the power of two nearest the eye's distance below and above it, its drops shared out between the two by how near
   * each is (a drop's size is its scale's): a zoom changes which scale's drops fall, never moves one.
   */
  update(
    w: Weather | null,
    at: { x: number; y: number; z: number },
    eye: { x: number; y: number; z: number },
    distance: number,
    s: number,
    most: number,
    flakes = 1,
  ): void {
    // (A breath of wind: the rain slants a little, the snow drifts.)
    const lean = 0.18;
    // (Eased to the weather asked, by the viewer's own time: a shower comes on and goes by degrees, more motes or fewer,
    // the last of them growing or dwindling, none leaping.)
    const wall = performance.now() / 1000,
      dt = this.drawnAt < 0 ? 0 : Math.min(0.25, Math.max(0, wall - this.drawnAt)),
      ease = 1 - Math.exp(-dt / EASE),
      settle = (shown: number, want: number) => {
        const v = shown + (want - shown) * ease;
        return Math.abs(v - want) < 0.002 ? want : v;
      };
    this.drawnAt = wall;
    this.rainShown = settle(this.rainShown, w ? Math.min(1, w.rain) : 0);
    this.snowShown = settle(this.snowShown, w ? Math.min(1, w.snow) : 0);
    const room = Math.min(MOST, most),
      rainF = room * this.rainShown,
      snowF = room * 0.7 * this.snowShown,
      nRain = Math.min(room, Math.ceil(rainF)),
      nSnow = Math.min(room, Math.ceil(snowF)),
      { t0, low } = tiersOf(distance, 0);
    /** Where drop `j` of scale `tier` falls (out: x, y, z, how much of it shows, its scale), `f` through its fall. */
    const p = this.at,
      place = (tier: number, id: number, fall: number, f: number, k: number, sway: number) => {
        const S = 2 ** tier,
          high = S * 0.85;
        latticeAt(at.x, at.z, S, id, fall, k, p);
        const x = at.x + p[0]! + sway + lean * 0.3 * high * f,
          z = at.z + p[1]! + sway * 0.6,
          y = at.y - S * 0.08 + high * (1 - f);
        p[3] = p[2]! * clearOfEye(x, y, z, eye, S) * S;
        p[0] = x;
        p[1] = y;
        p[2] = z;
      };
    this.drops.set(nRain, (i, out) => {
      const { tier, id } = moteOf(i, t0, low),
        go = s / RAIN_FALL + rand(id, 0, 9),
        fall = Math.floor(go);
      place(tier, id, fall, go - fall, 1, 0);
      // (The last of them as much of it as the count asks: grown in, dwindled out.)
      const k = p[3]! * Math.min(1, rainF - i);
      out[0] = p[0]!;
      out[1] = p[1]!;
      out[2] = p[2]!;
      out[3] = k * 0.0016;
      out[4] = k * 0.045;
      out[5] = k * 0.0016;
      out[6] = 0;
      out[7] = 0;
    });
    this.flakes.set(nSnow, (i, out) => {
      const { tier, id } = moteOf(i, t0, low),
        go = s / SNOW_FALL + rand(id, 0, 7),
        fall = Math.floor(go),
        sway = Math.sin(s * 1.3 + rand(id, 0, 5) * 6.28) * 2 ** tier * 0.02;
      place(tier, id, fall, go - fall, 3, sway);
      const size = p[3]! * flakes * Math.min(1, snowF - i) * (0.0028 + 0.0022 * rand(id, 0, 6));
      out[0] = p[0]!;
      out[1] = p[1]!;
      out[2] = p[2]!;
      out[3] = size;
      out[4] = size;
      out[5] = size;
      out[6] = s * 0.7 + i;
      out[7] = s * 0.5 + i;
    });
    this.shown = { drops: nRain, flakes: nSnow };
  }
}
