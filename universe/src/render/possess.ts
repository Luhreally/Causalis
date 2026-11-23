// The eye behind one of a town's people possessed (Phase 60): it stands behind the body at a stand-off
// and a pitch the viewer turns (a drag on the right half), draws in or stands off (a pinch, the
// wheel), and comes behind it again (a double tap), eased; kept off the walls and the roofs as the
// village keeps free roam's walking eye (below a roof's height, out of the homes, the blocks and the
// walls): hemmed in, it rises to look down over the roofs, and else its arm is drawn in. Its
// stand-off is reckoned in the body's heights as the town draws it (its people drawn larger than
// life, as their things are), and it sees wider on a phone held upright, so the street beside him
// is seen too. And a body struck down drawn on its back where it fell, as a fallen soldier lies.
import * as pc from "playcanvas";
import { HANDED, clearAt, handedViews, type FigurePart, type Ground } from "../view/index.ts";
import type { OrbitRig } from "./orbit.ts";
import type { Stage } from "./stage.ts";

/** Units to a metre, as the village's. */
const M = 0.1;
/** A body held as the screen shows it (CSS px). */
export type BodyOnScreen = { top: number; bottom: number; left: number; right: number };
/** Of his height: the top of his head, his hips (the foot of his head and body), and half his breadth with his arms. */
const BODY_SEEN = { top: 1.04, hips: 0.45, half: 0.3 } as const;

/** Where on the body the eye looks (of its height: about the shoulders). */
const LOOK_AT = 0.8;
/** How near and how far the eye stands off (the body's heights); how far it looks down, and up (radians). */
export const EYE_NEAREST = 1,
  EYE_FARTHEST = 6;
/**
 * How the eye first stands behind a soldier (Phase 61): looking down (radians) over the heads of the
 * ranks behind him, a rank's depth apart — at a townsman's -0.32 the line from the eye to him passes
 * their heads — so many of his heights off; and behind a beast, over its herd's backs and farther
 * off, a beast being longer than it is tall.
 */
export const SOLDIER_EYE = { pitch: -0.55, distance: 2.6 } as const,
  BEAST_EYE = { pitch: -0.5, distance: 3.6 } as const;
const DOWNMOST = -1.25,
  UPMOST = 0.12;
/**
 * In a press about the one held (a soldier among his ranks: render/battle.ts crowd), the eye looks down on him the more, so
 * he reads from above over the heads about him (2026-11-23: in a dense rank he was lost among them): from so many standing
 * about him to so many, by so much more (radians), eased over so long (s), never at once.
 */
export const PRESS = { from: 3, full: 10, most: 0.3, ease: 0.8 } as const;
/** Below this the eye keeps out of the walls and the roofs (m: the village's free roam's; a city's stand higher). */
const ROOFS = 9;
/** The near plane the eye keeps otherwise (the stage's: in its units). */
const EYE_NEAR = 0.1;
/** How much short of the top of his head the eye's cut stops (m). */
const HEAD_ROOM = 0.8;
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
  /** How high its town's homes stand at their tallest (m): an eye does not rise over a city's as over a village's. */
  roofs = 0;
  /** How far what stands in its way is cut away, from nothing to all of it: eased, so nothing leaps. */
  private cutting = 0;
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
  /** How much farther down it looks in a press (radians): as asked (press), and as eased to. */
  private pressTo = 0;
  pressed = 0;

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

  /** So many standing about the one held: the more, the more the eye looks down on him (PRESS). */
  press(about: number): void {
    const u = clamp((about - PRESS.from) / (PRESS.full - PRESS.from), 0, 1);
    this.pressTo = PRESS.most * u * u * (3 - 2 * u);
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
    this.pressTo = this.pressed = 0;
    this.stage.lookedAt = null;
  }

  /**
   * Let go: the stage's eye given back (release) and the orbit handed the camera exactly where this eye had it, flown out
   * over `over` (where the body stood, m) to the town's own look (view/zoom.ts handedViews), over its tallest homes
   * (`roofs`, m); what the eye cut away between it and the body still cut as the flight sets out. Never drawn: the orbit
   * as it is.
   */
  handTo(rig: OrbitRig, over: { x: number; z: number } | null, roofs = this.roofs): void {
    const lens = this.stage.camera.camera,
      seen = this.stage.lookedAt,
      fov = lens?.fov ?? null,
      near = lens?.nearClip ?? EYE_NEAR,
      eye = this.stood,
      drawn = this.shown !== null;
    this.release();
    rig.enabled = true;
    if (!seen || !over || !drawn) return;
    const { from, to } = handedViews(
      { x: eye.x * M, y: eye.y * M, z: eye.z * M },
      seen,
      { x: over.x * M, z: over.z * M },
      M,
      innerWidth / Math.max(1, innerHeight),
      roofs,
    );
    rig.takeBack(
      from,
      to,
      HANDED.seconds,
      fov !== null && lens ? { from: fov, to: lens.fov } : null,
      near,
      roofs >= HANDED.tall,
    );
  }

  /**
   * The stage's camera behind a body at (x, z) (m), `dt` seconds on, out of the walls and roofs;
   * `lift`: how high above the ground the body is drawn (m: a flier as it flies).
   */
  update(x: number, z: number, ground: Ground | null, dt: number, lift = 0): void {
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
      look = LOOK_AT * h + lift,
      distance = this.shown.distance * h,
      fx = Math.sin(yaw),
      fz = Math.cos(yaw),
      step = Math.max(0.25, h * 0.05),
      first = Math.min(distance, Math.max(0.6, h * 0.3));
    /**
     * How far the arm from the body back to the eye reaches at a pitch before a wall or a roof
     * stands on it (a great town has hundreds of homes: only those about each point are asked).
     */
    const arm = (pitch: number, roofs = ROOFS): number => {
      if (!ground) return distance;
      const cp = Math.cos(pitch),
        sp = Math.sin(pitch);
      for (let a = first; a <= distance; a += step)
        if (
          look - sp * a < roofs &&
          !clearAt(ground, { x: x - fx * cp * a, z: z - fz * cp * a }, OFF_WALLS)
        )
          return Math.max(first, a - step);
      return distance;
    };
    // Hemmed in (a lane, a wall behind him): risen over the roofs, looking down, as far as it stands
    // off farther so.
    // (A city's walls stand higher than any eye: over them it cannot go. Hemmed in there it stands off as far as
    // it would, steeply, and what stands between it and the body is cut away, below.)
    const city = this.roofs > ROOFS;
    this.pressed +=
      (this.pressTo - this.pressed) * (fresh ? 1 : 1 - Math.exp(-Math.min(0.1, dt) / PRESS.ease));
    let pitch = clamp(this.shown.pitch - this.pressed, DOWNMOST, UPMOST),
      reach = arm(pitch, Math.max(ROOFS, this.roofs));
    const hemmed = city && reach < distance * 0.75;
    if (hemmed) {
      pitch = Math.min(pitch, HEMMED[HEMMED.length - 1]!);
      reach = distance;
    }
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
    this.stage.lookedAt = {
      x: x * M,
      y: look * M,
      z: z * M,
      distance: Math.max(0.05, Math.hypot(at.x - x, at.y - look, at.z - z) * M),
    };
    // Hemmed in, in a city, what stands between the eye and the body is cut away, as the rig does among spires:
    // the near plane held short of where the ground meets the foot of the screen, so no gap opens there, and
    // short of the body's head.
    this.cutting += ((hemmed ? 1 : 0) - this.cutting) * e;
    if (city) {
      const far = Math.max(0.01, Math.hypot(at.x - x, at.y - look, at.z - z)),
        // (How far down it looks, and half what it sees up and down.)
        down = Math.asin(Math.max(0, Math.min(1, (at.y - look) / far))),
        half = (fov * Math.PI) / 360,
        // (How deep along its gaze the ground comes in at the screen's foot, and the top of his head.)
        foot = (at.y / Math.sin(down + half)) * Math.cos(half),
        head = far + (look - h) * Math.sin(down) - HEAD_ROOM,
        near = Math.max(EYE_NEAR, Math.min(0.97 * foot, head) * M);
      lens.nearClip = EYE_NEAR + (near - EYE_NEAR) * this.cutting;
    }
  }

  /** Where on the ground (m, at its height 0) a point of the screen falls (canvas CSS px; null: above the horizon). */
  groundAt(sx: number, sy: number): { x: number; z: number } | null {
    const cam = this.stage.camera.camera!,
      from = cam.screenToWorld(sx, sy, cam.nearClip),
      to = cam.screenToWorld(sx, sy, cam.farClip),
      dy = to.y - from.y;
    if (Math.abs(dy) < 1e-9) return null;
    const k = -from.y / dy;
    return k < 0 || k > 1
      ? null
      : { x: (from.x + (to.x - from.x) * k) / M, z: (from.z + (to.z - from.z) * k) / M };
  }

  /**
   * Where the one held stands on the screen, his head and his body down to his hips (CSS pixels: the top of his head, the
   * foot of his body, its sides with his arms; null: not before the eye), for what the HUD lays over the world to keep off.
   */
  bodyOnScreen(x: number, z: number, lift = 0): BodyOnScreen | null {
    const h = this.height,
      top = this.toScreen(x, lift + BODY_SEEN.top * h, z),
      foot = this.toScreen(x, lift + BODY_SEEN.hips * h, z);
    if (!top || !foot) return null;
    const half = (Math.abs(foot.y - top.y) * BODY_SEEN.half) / (BODY_SEEN.top - BODY_SEEN.hips);
    return {
      top: Math.min(top.y, foot.y),
      bottom: Math.max(top.y, foot.y),
      left: Math.min(top.x, foot.x) - half,
      right: Math.max(top.x, foot.x) + half,
    };
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
