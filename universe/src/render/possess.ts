// The eye behind one of a town's people possessed (Phase 60): it stands behind the body at a stand-off
// and a pitch the viewer turns (a drag on the right half), draws in or stands off (a pinch, the
// wheel), and comes behind it again (a double tap), eased; kept off the walls and the roofs as the
// village keeps free roam's walking eye (below a roof's height, out of the homes, the blocks and the
// walls): hemmed in, it rises to look down over the roofs, and else its arm is drawn in. Its
// stand-off is reckoned in the body's heights as the town draws it (its people drawn larger than
// life, as their things are), and it sees wider on a phone held upright, so the street beside him
// is seen too. And a body struck down drawn on its back where it fell, as a fallen soldier lies.
import * as pc from "playcanvas";
import { clearAt, type FigurePart, type Ground } from "../view/index.ts";
import type { Stage } from "./stage.ts";

/** Units to a metre, as the village's. */
const M = 0.1;
/** Where on the body the eye looks (of its height: about the shoulders). */
const LOOK_AT = 0.8;
/** How near and how far the eye stands off (the body's heights); how far it looks down, and up (radians). */
export const EYE_NEAREST = 0.45,
  EYE_FARTHEST = 6;
const DOWNMOST = -1.25,
  UPMOST = 0.12;
/** Below this the eye keeps out of the walls and the roofs (m: the village's free roam's). */
const ROOFS = 9;
/** How far down the eye looks, rising over the roofs, where the walls hem the body in (radians). */
const HEMMED = [-0.85, -1.2];
/** How far the eye keeps off a wall (m). */
const OFF_WALLS = 0.3;
/** How wide the eye sees, up and down (degrees): a phone held upright, and on its side or a desk. */
const UPRIGHT_FOV = 62,
  WIDE_FOV = 50;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export class PossessEye {
  /** The way the eye looks (radians, as a body's yaw), its pitch (down: less than nothing), how far it stands off (the body's heights). */
  yaw = 0;
  pitch = -0.32;
  distance = 2.6;
  /** How tall the body is drawn (m). */
  height = 1.7;
  private shown: { yaw: number; pitch: number; distance: number } | null = null;
  private readonly stage: Stage;
  /** The field of view the stage had before (to give back). */
  private fov: number | null = null;
  /** Where the eye stood last (m), for the look tools. */
  stood = { x: 0, y: 0, z: 0 };

  constructor(stage: Stage) {
    this.stage = stage;
  }

  /** Behind a body facing `yaw`: swung there, or (`now`) at once. */
  behind(yaw: number, now = false): void {
    this.yaw = yaw;
    if (now) this.shown = null;
  }

  /** Turned by a drag (pixels): to the right, the view turns right; down, it looks down. */
  look(dx: number, dy: number): void {
    this.yaw = wrap(this.yaw - dx * 0.0065);
    this.pitch = clamp(this.pitch - dy * 0.005, DOWNMOST, UPMOST);
  }

  /** Stood off by so much (a pinch's spread, the wheel: more than one, nearer). */
  zoom(factor: number): void {
    this.distance = clamp(this.distance / factor, EYE_NEAREST, EYE_FARTHEST);
  }

  /** The way the eye looks now (the stick's frame: ahead is where it looks). */
  get looking(): number {
    return this.shown?.yaw ?? this.yaw;
  }

  /** The stage's own eye given back (its field of view as it was). */
  release(): void {
    const cam = this.stage.camera.camera;
    if (cam && this.fov !== null) cam.fov = this.fov;
    this.fov = null;
    this.shown = null;
  }

  /** The stage's camera behind a body at (x, z) (m), `dt` seconds on, out of the walls and roofs. */
  update(x: number, z: number, ground: Ground | null, dt: number): void {
    const cam = this.stage.camera,
      lens = cam.camera!;
    if (this.fov === null) this.fov = lens.fov;
    const fov = innerHeight > innerWidth ? UPRIGHT_FOV : WIDE_FOV;
    if (lens.fov !== fov) lens.fov = fov;
    const fresh = !this.shown,
      s = this.shown ?? { yaw: this.yaw, pitch: this.pitch, distance: this.distance },
      k = fresh ? 1 : 1 - Math.exp(-Math.min(0.1, dt) / 0.12);
    this.shown = {
      yaw: wrap(s.yaw + wrap(this.yaw - s.yaw) * k),
      pitch: s.pitch + (this.pitch - s.pitch) * k,
      distance: s.distance + (this.distance - s.distance) * k,
    };
    const { yaw } = this.shown,
      h = this.height,
      look = LOOK_AT * h,
      distance = this.shown.distance * h,
      fx = Math.sin(yaw),
      fz = Math.cos(yaw),
      step = Math.max(0.25, h * 0.05),
      first = Math.min(distance, Math.max(0.6, h * 0.3));
    /**
     * How far the arm from the body back to the eye reaches at a pitch before a wall or a roof
     * stands on it (a great town has hundreds of homes: only those about each point are asked).
     */
    const arm = (pitch: number): number => {
      if (!ground) return distance;
      const cp = Math.cos(pitch),
        sp = Math.sin(pitch);
      for (let a = first; a <= distance; a += step)
        if (
          look - sp * a < ROOFS &&
          !clearAt(ground, { x: x - fx * cp * a, z: z - fz * cp * a }, OFF_WALLS)
        )
          return Math.max(first, a - step);
      return distance;
    };
    // Hemmed in (a lane, a wall behind him): risen over the roofs, looking down, as far as it stands
    // off farther so.
    let pitch = this.shown.pitch,
      reach = arm(pitch);
    for (const over of HEMMED) {
      if (reach >= distance * 0.75 || pitch <= over) break;
      const r = arm(over);
      if (r > reach + step) {
        pitch = over;
        reach = r;
      }
    }
    const cp = Math.cos(pitch),
      sp = Math.sin(pitch),
      to = {
        x: x - fx * cp * reach,
        y: Math.max(0.25, look - sp * reach),
        z: z - fz * cp * reach,
      },
      // (The eye itself eased to where it should stand: no leap as the arm is drawn in or let out.)
      e = fresh ? 1 : 1 - Math.exp(-Math.min(0.1, dt) / 0.1),
      at = fresh
        ? to
        : {
            x: this.stood.x + (to.x - this.stood.x) * e,
            y: this.stood.y + (to.y - this.stood.y) * e,
            z: this.stood.z + (to.z - this.stood.z) * e,
          };
    this.stood = at;
    cam.setPosition(at.x * M, at.y * M, at.z * M);
    cam.lookAt(new pc.Vec3(x * M, look * M, z * M));
  }

  /** Where a point of the town (m) is on the screen (CSS pixels; null: behind the eye). */
  toScreen(x: number, y: number, z: number): { x: number; y: number } | null {
    const p = this.stage.camera.camera!.worldToScreen(
      new pc.Vec3(x * M, y * M, z * M),
      new pc.Vec3(),
    );
    return p.z > 0 ? { x: p.x, y: p.y } : null;
  }
}

/**
 * A part of one struck down, lying on their back where they fell (as render/village.ts lays a fallen
 * soldier): what stood up lies back along the ground. `out` as the village's place() fills it.
 */
export function lieDown(
  out: number[],
  part: FigurePart,
  x: number,
  z: number,
  yaw: number,
  size: number,
  pitch: number,
): void {
  const c = Math.cos(yaw),
    sn = Math.sin(yaw),
    hinge = part.pivot ?? 0,
    up = part.y + hinge - hinge * Math.cos(pitch),
    along = part.z - hinge * Math.sin(pitch),
    py = 0.06 + along,
    pz = -up;
  out[0] = x * M + (part.x * c + pz * sn) * size;
  out[1] = py * size;
  out[2] = z * M + (-part.x * sn + pz * c) * size;
  out[7] = pitch - Math.PI / 2;
}
