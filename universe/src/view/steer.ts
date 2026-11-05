// Steering the camera as a builder's camera is steered (asked for 2026-09-28: "like the Sims
// 3"): W A S D or the arrows to go, Q and E to turn, R and F (or Page Up and Page Down) to
// tilt, + and − (or Z and X) to zoom, Shift to hurry; a drag that takes hold of the ground.
// Pure: which key asks what, the velocity eased toward what the keys ask (quick to start and
// to stop), and the view moved by it. Over a flat land its middle slides along the ground as
// far each second as the camera stands from it, so the land goes by the screen at one pace
// at every height; about a globe the view turns over its face as fast as it stands high.

/** What a key asks of the camera. */
export type SteerAction =
  | "ahead"
  | "back"
  | "left"
  | "right"
  | "turnLeft"
  | "turnRight"
  | "tiltUp"
  | "tiltDown"
  | "zoomIn"
  | "zoomOut";

/** The action a key names (by where the key is, for the letters; by what it says, for + and −). */
export function steerKey(e: { readonly code: string; readonly key: string }): SteerAction | null {
  switch (e.code) {
    case "KeyW":
    case "ArrowUp":
      return "ahead";
    case "KeyS":
    case "ArrowDown":
      return "back";
    case "KeyA":
    case "ArrowLeft":
      return "left";
    case "KeyD":
    case "ArrowRight":
      return "right";
    case "KeyQ":
      return "turnLeft";
    case "KeyE":
      return "turnRight";
    case "KeyR":
    case "PageUp":
      return "tiltUp";
    case "KeyF":
    case "PageDown":
      return "tiltDown";
    case "KeyZ":
    case "NumpadAdd":
      return "zoomIn";
    case "KeyX":
    case "NumpadSubtract":
      return "zoomOut";
  }
  if (e.key === "+" || e.key === "=") return "zoomIn";
  if (e.key === "-" || e.key === "_") return "zoomOut";
  return null;
}

/** How hard the camera goes each way (-1 … 1): ahead, aside (right), turn (right), tilt (up), zoom (in). */
export type Steer = {
  readonly ahead: number;
  readonly aside: number;
  readonly turn: number;
  readonly tilt: number;
  readonly zoom: number;
};

export const STILL: Steer = { ahead: 0, aside: 0, turn: 0, tilt: 0, zoom: 0 };

/** What the keys held ask: each way -1, 0 or 1. */
export function asked(held: ReadonlySet<SteerAction>): Steer {
  const d = (a: SteerAction, b: SteerAction) => (held.has(a) ? 1 : 0) - (held.has(b) ? 1 : 0);
  return {
    ahead: d("ahead", "back"),
    aside: d("right", "left"),
    turn: d("turnRight", "turnLeft"),
    tilt: d("tiltUp", "tiltDown"),
    zoom: d("zoomIn", "zoomOut"),
  };
}

/** The velocity eased toward what is asked: most of the way in a tenth of a second. */
export function ease(v: Steer, want: Steer, dt: number): Steer {
  const k = 1 - Math.exp(-dt * 14),
    f = (a: number, b: number) => {
      const x = a + (b - a) * k;
      return b === 0 && Math.abs(x) < 1e-3 ? 0 : x;
    };
  return {
    ahead: f(v.ahead, want.ahead),
    aside: f(v.aside, want.aside),
    turn: f(v.turn, want.turn),
    tilt: f(v.tilt, want.tilt),
    zoom: f(v.zoom, want.zoom),
  };
}

/** Whether it is still (nothing asked, nothing left of the last push). */
export function still(v: Steer): boolean {
  return !v.ahead && !v.aside && !v.turn && !v.tilt && !v.zoom;
}

/**
 * How fast: over a flat land, the camera's own distance each second; about a globe, its
 * height over the face (in radii) times this in radians; turning and tilting in degrees a
 * second; zooming by e to this power each second; Shift three times all of it.
 */
export const STEER = { pan: 0.75, globe: 0.5, space: 60, turn: 90, tilt: 60, zoom: 1.3, fast: 3 };

/** What kind of scene it steers over: a flat land, a globe about its middle, the open sky. */
export type SteerScene = "flat" | "round" | "space";

type Point = { readonly x: number; readonly y: number; readonly z: number };
type Bounds = { readonly x: number; readonly z: number; readonly reach: number };

/** A flat land's middle kept within its reach. */
export function withinBounds(
  x: number,
  z: number,
  bounds: Bounds | null,
): { x: number; z: number } {
  if (!bounds) return { x, z };
  const dx = x - bounds.x,
    dz = z - bounds.z,
    d = Math.hypot(dx, dz);
  return d > bounds.reach
    ? { x: bounds.x + (dx / d) * bounds.reach, z: bounds.z + (dz / d) * bounds.reach }
    : { x, z };
}

/**
 * The view moved by the velocity for `dt` seconds: its new middle, turn and tilt, and the
 * factor its distance is to be zoomed by (zooming goes through the rig, which may go on
 * through to the next scale).
 */
export function steerView(
  view: {
    readonly target: Point;
    readonly yaw: number;
    readonly pitch: number;
    readonly distance: number;
  },
  v: Steer,
  dt: number,
  scene: SteerScene,
  fast: boolean,
  limits: { readonly minPitch: number; readonly maxPitch: number },
  bounds: Bounds | null,
): { target: Point; yaw: number; pitch: number; zoom: number } {
  const k = fast ? STEER.fast : 1,
    tilt = (p: number) => Math.max(limits.minPitch, Math.min(limits.maxPitch, p)),
    zoom = Math.exp(-v.zoom * STEER.zoom * dt * (fast ? 2 : 1));
  if (scene === "flat") {
    // Ahead: away from the camera along the ground; aside: across the screen.
    const a = (view.yaw * Math.PI) / 180,
      step = STEER.pan * view.distance * k * dt,
      moved = withinBounds(
        view.target.x + (-Math.sin(a) * v.ahead + Math.cos(a) * v.aside) * step,
        view.target.z + (-Math.cos(a) * v.ahead - Math.sin(a) * v.aside) * step,
        bounds,
      );
    return {
      target: { x: moved.x, y: view.target.y, z: moved.z },
      yaw: view.yaw + v.turn * STEER.turn * dt,
      pitch: tilt(view.pitch + v.tilt * STEER.tilt * dt),
      zoom,
    };
  }
  // About a globe (or among the stars): ahead goes north (the tilt toward the pole), aside
  // and turning go round; as fast as it stands high over the face.
  const rate =
      scene === "round"
        ? ((STEER.globe * Math.max(0.02, view.distance - 1) * 180) / Math.PI) * k
        : STEER.space * k,
    round = v.aside + v.turn;
  return {
    target: view.target,
    yaw: view.yaw + round * rate * dt,
    pitch: tilt(view.pitch - v.ahead * rate * dt),
    zoom,
  };
}

/**
 * A flat land's middle when the ground under a pointer is taken hold of and moved: the
 * point that was under it (`from`) comes to be under it where it is now (`to`).
 */
export function grabbed(target: Point, from: Point, to: Point, bounds: Bounds | null): Point {
  const moved = withinBounds(target.x + from.x - to.x, target.z + from.z - to.z, bounds);
  return { x: moved.x, y: target.y, z: moved.z };
}

/** How far a drag turns a globe, degrees a pixel: less the nearer its face (as its face is held). */
export function globeDrag(distance: number): number {
  return Math.min(0.3, Math.max(0.012, 0.09 * (distance - 1)));
}

/**
 * The eye in a town of spires (Phase 66). Towers of 400 m stand in the way of an eye that comes down among them,
 * and a wall filling the screen shows nothing. So it comes in over them, tilting down as it nears (from 110 out
 * to 35, and by then 60 degrees down, or more if it is asked), until it is down among the folk under 14, where it
 * looks as it is asked again. And what stands between it and what it looks at is cut away: the near plane is
 * held just short of where the ground meets the foot of the screen, so that no gap opens there. Far out, nothing
 * is cut. Degrees, and the eye's own tilt stays as it was asked: drawn back, it is that again.
 */
export function eyeAmongSpires(distance: number, pitch: number): { pitch: number; near: number } {
  const smooth = (x: number) => {
      const t = Math.max(0, Math.min(1, x));
      return t * t * (3 - 2 * t);
    },
    steep = 60 * smooth((110 - distance) / 75) * (1 - smooth((14 - distance) / 8)),
    down = Math.max(-pitch, steep),
    a = (down * Math.PI) / 180,
    half = (22.5 * Math.PI) / 180,
    foot = (distance * Math.sin(a) * Math.cos(half)) / Math.sin(a + half);
  return { pitch: -down, near: Math.max(0.1, 0.85 * foot * smooth((130 - distance) / 40)) };
}
